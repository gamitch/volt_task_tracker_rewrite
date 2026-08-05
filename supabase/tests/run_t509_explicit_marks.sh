#!/usr/bin/env bash

# T509: applies every migration to a scratch database and runs the
# explicit-marks denominator assertions. Mirrors
# `run_volunteer_hours_outreach_only.sh` exactly -- same scratch-DB lifecycle,
# same platform stub, same "apply every migration unchanged" loop.
#
# This script is the gap T509 shipped with: the assertions file landed without
# a runner, while every sibling assertion set here has one. Nothing in CI runs
# any of them (see T701 for the `tests/rls/run.sh` half of that problem), so a
# missing runner meant the file could only be executed by someone
# reconstructing the harness by hand.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
MIGRATIONS_DIR="$REPO_ROOT/supabase/migrations"
# T509 guards a CLASS, so unlike its T801 sibling there is no single
# "required" migration to look for -- the guard runs against whatever the
# full migration set produces.
SKIPPED_MIGRATIONS=(
  "20260719000000_cron.sql"
  "20260720000001_avatar_storage.sql"
)
DBNAME="volt_t509_explicit_marks_$$_$(date +%s)"

PSQL=(psql -X -v ON_ERROR_STOP=1)

cleanup() {
  "${PSQL[@]}" -d postgres -c "DROP DATABASE IF EXISTS \"$DBNAME\" WITH (FORCE);" >/dev/null 2>&1 || true
}
trap cleanup EXIT

echo "==> creating scratch database $DBNAME"
"${PSQL[@]}" -d postgres -c "CREATE DATABASE \"$DBNAME\";"

echo "==> applying Supabase platform stub (T195 precedent, same stub T322's runner uses)"
"${PSQL[@]}" -d "$DBNAME" -f "$SCRIPT_DIR/calendar_feed_platform_stub.sql"

for migration in "$MIGRATIONS_DIR"/*.sql; do
  basename="$(basename "$migration")"
  skip=false
  for skipped in "${SKIPPED_MIGRATIONS[@]}"; do
    if [[ "$basename" == "$skipped" ]]; then skip=true; break; fi
  done
  if [[ "$skip" == true ]]; then
    echo "==> skipping migration (Supabase-platform dependency): $basename"
    continue
  fi
  echo "==> applying migration unchanged: $basename"
  "${PSQL[@]}" -d "$DBNAME" -f "$migration"
done

echo "==> running T509 explicit-marks denominator assertions"
"${PSQL[@]}" -d "$DBNAME" -f "$SCRIPT_DIR/t509_explicit_marks_assertions.sql"

echo "==> T509 explicit-marks denominator tests: ALL PASS"
