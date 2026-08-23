#!/usr/bin/env bash

# GAM-479: applies every migration to a scratch database and runs the
# `'unmarked'` sentinel assertions. Mirrors `run_t509_explicit_marks.sh`
# exactly -- same scratch-DB lifecycle, same platform stub, same "apply every
# migration unchanged" loop.
#
# The assertions this runs are the ones that cannot be established by reading:
# that a coach-cleared attendance row keeps its `check_in_at` and
# `hours_override`, and that both views reading `attendance` directly report
# that row exactly as they reported a missing one.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
MIGRATIONS_DIR="$REPO_ROOT/supabase/migrations"
REQUIRED_MIGRATION="20260822000000_attendance_unmarked_sentinel.sql"
SKIPPED_MIGRATIONS=(
  "20260719000000_cron.sql"
  "20260720000001_avatar_storage.sql"
)
DBNAME="volt_gam479_unmarked_$$_$(date +%s)"

PSQL=(psql -X -v ON_ERROR_STOP=1)

cleanup() {
  "${PSQL[@]}" -d postgres -c "DROP DATABASE IF EXISTS \"$DBNAME\" WITH (FORCE);" >/dev/null 2>&1 || true
}
trap cleanup EXIT

if [[ ! -f "$MIGRATIONS_DIR/$REQUIRED_MIGRATION" ]]; then
  echo "missing $REQUIRED_MIGRATION -- nothing for these assertions to guard" >&2
  exit 1
fi

echo "==> creating scratch database $DBNAME"
"${PSQL[@]}" -d postgres -c "CREATE DATABASE \"$DBNAME\";"

echo "==> applying Supabase platform stub"
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

echo "==> running GAM-479 unmarked-sentinel assertions"
"${PSQL[@]}" -d "$DBNAME" -f "$SCRIPT_DIR/gam479_unmarked_sentinel_assertions.sql"

echo "==> GAM-479 unmarked-sentinel tests: ALL PASS"
