#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
MIGRATIONS_DIR="$REPO_ROOT/supabase/migrations"
VOLUNTEER_HOURS_MIGRATION="20260804000000_volunteer_hours_outreach_only.sql"
SKIPPED_MIGRATION="20260719000000_cron.sql"
DBNAME="volt_t322_volunteer_hours_$$_$(date +%s)"

PSQL=(psql -X -v ON_ERROR_STOP=1)

cleanup() {
  "${PSQL[@]}" -d postgres -c "DROP DATABASE IF EXISTS \"$DBNAME\" WITH (FORCE);" >/dev/null 2>&1 || true
}
trap cleanup EXIT

echo "==> creating scratch database $DBNAME"
"${PSQL[@]}" -d postgres -c "CREATE DATABASE \"$DBNAME\";"

echo "==> applying task-specific Supabase platform stub (T195 precedent, reused per T322 packet)"
"${PSQL[@]}" -d "$DBNAME" -f "$SCRIPT_DIR/calendar_feed_platform_stub.sql"

found_volunteer_hours=false
for migration in "$MIGRATIONS_DIR"/*.sql; do
  basename="$(basename "$migration")"

  if [[ "$basename" == "$SKIPPED_MIGRATION" ]]; then
    echo "==> skipping migration: 20260719000000_cron.sql (requires Supabase pg_cron, pg_net, and Vault)"
    continue
  fi

  if [[ "$basename" == "$VOLUNTEER_HOURS_MIGRATION" ]]; then
    found_volunteer_hours=true
  fi

  echo "==> applying migration unchanged: $basename"
  "${PSQL[@]}" -d "$DBNAME" -f "$migration"
done

if [[ "$found_volunteer_hours" != true ]]; then
  echo "Missing required migration: $VOLUNTEER_HOURS_MIGRATION" >&2
  exit 1
fi

echo "==> loading T322 fixtures and running volunteer-hours-outreach-only assertions"
"${PSQL[@]}" -d "$DBNAME" -f "$SCRIPT_DIR/volunteer_hours_outreach_only_assertions.sql"

echo "==> T322 volunteer-hours-outreach-only tests: ALL PASS"
