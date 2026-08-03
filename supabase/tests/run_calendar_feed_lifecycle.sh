#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
MIGRATIONS_DIR="$REPO_ROOT/supabase/migrations"
LIFECYCLE_MIGRATION="20260802000000_calendar_feed_lifecycle.sql"
SKIPPED_MIGRATION="20260719000000_cron.sql"
DBNAME="volt_calendar_feed_$$_$(date +%s)"

PSQL=(psql -X -v ON_ERROR_STOP=1)

cleanup() {
  "${PSQL[@]}" -d postgres -c "DROP DATABASE IF EXISTS \"$DBNAME\" WITH (FORCE);" >/dev/null 2>&1 || true
}
trap cleanup EXIT

echo "==> creating scratch database $DBNAME"
"${PSQL[@]}" -d postgres -c "CREATE DATABASE \"$DBNAME\";"

echo "==> applying task-specific Supabase platform stub"
"${PSQL[@]}" -d "$DBNAME" -f "$SCRIPT_DIR/calendar_feed_platform_stub.sql"

found_lifecycle=false
for migration in "$MIGRATIONS_DIR"/*.sql; do
  basename="$(basename "$migration")"

  if [[ "$basename" == "$SKIPPED_MIGRATION" ]]; then
    echo "==> skipping migration: 20260719000000_cron.sql (requires Supabase pg_cron, pg_net, and Vault)"
    continue
  fi

  if [[ "$basename" == "$LIFECYCLE_MIGRATION" ]]; then
    found_lifecycle=true
    echo "==> loading pre-lifecycle fixtures"
    "${PSQL[@]}" -d "$DBNAME" -f "$SCRIPT_DIR/calendar_feed_lifecycle_pre.sql"
  fi

  echo "==> applying migration unchanged: $basename"
  "${PSQL[@]}" -d "$DBNAME" -f "$migration"
done

if [[ "$found_lifecycle" != true ]]; then
  echo "Missing required migration: $LIFECYCLE_MIGRATION" >&2
  exit 1
fi

echo "==> running calendar feed lifecycle assertions"
"${PSQL[@]}" -d "$DBNAME" -f "$SCRIPT_DIR/calendar_feed_lifecycle_assertions.sql"

echo "==> calendar feed lifecycle tests: ALL PASS"
