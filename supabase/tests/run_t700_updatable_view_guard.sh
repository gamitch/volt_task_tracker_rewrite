#!/usr/bin/env bash

# T700: applies every migration to a scratch database and runs the
# updatable-view guard assertions. Mirrors
# `run_volunteer_hours_outreach_only.sh` exactly -- same scratch-DB lifecycle,
# same platform stub, same "apply every migration unchanged" loop.
#
# This script is the gap T700 shipped with: the assertions file landed without
# a runner, while every sibling assertion set here has one. Nothing in CI runs
# any of them (see T701 for the `tests/rls/run.sh` half of that problem), so a
# missing runner meant the file could only be executed by someone
# reconstructing the harness by hand.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
MIGRATIONS_DIR="$REPO_ROOT/supabase/migrations"
# T700 guards a CLASS, so unlike its T801 sibling there is no single
# "required" migration to look for -- the guard runs against whatever the
# full migration set produces.
SKIPPED_MIGRATIONS=(
  "20260719000000_cron.sql"
  "20260720000001_avatar_storage.sql"
)
DBNAME="volt_t700_updatable_view_guard_$$_$(date +%s)"

PSQL=(psql -X -v ON_ERROR_STOP=1)

cleanup() {
  "${PSQL[@]}" -d postgres -c "DROP DATABASE IF EXISTS \"$DBNAME\" WITH (FORCE);" >/dev/null 2>&1 || true
}
trap cleanup EXIT

echo "==> creating scratch database $DBNAME"
"${PSQL[@]}" -d postgres -c "CREATE DATABASE \"$DBNAME\";"

echo "==> applying Supabase platform stub (T195 precedent, same stub T322's runner uses)"
"${PSQL[@]}" -d "$DBNAME" -f "$SCRIPT_DIR/calendar_feed_platform_stub.sql"

# The hazard is only reachable when Supabase's stock default grants are in
# play, so the guard would pass vacuously without them (A2 is what says so).
#
# ALTER DEFAULT PRIVILEGES, applied BEFORE the migrations -- deliberately, and
# this took one wrong attempt to get right. A blanket
# `grant ... on all tables` applied AFTER the migrations silently UNDOES
# T205's own `revoke ... from anon`, which is exactly the fix being guarded:
# the first version of this runner did that and made A1/A3 fail against a
# correctly-fixed database. Default privileges attach to objects as they are
# created and leave later explicit REVOKEs standing, which is how the real
# platform behaves.
echo "==> applying Supabase-style DEFAULT privileges (before migrations, so later REVOKEs stand)"
"${PSQL[@]}" -d "$DBNAME" -c "alter default privileges in schema public grant select, insert, update, delete on tables to anon, authenticated;"

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

echo "==> running T700 updatable-view guard assertions"
"${PSQL[@]}" -d "$DBNAME" -f "$SCRIPT_DIR/t700_updatable_view_guard_assertions.sql"

echo "==> T700 updatable-view guard tests: ALL PASS"
