#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
MIGRATIONS_DIR="$REPO_ROOT/supabase/migrations"
REVOKE_MIGRATION="20260803000001_revoke_anon_leaderboard_students.sql"
SKIPPED_MIGRATION="20260719000000_cron.sql"
DBNAME="volt_t205_anon_grant_$$_$(date +%s)"

PSQL=(psql -X -v ON_ERROR_STOP=1)

cleanup() {
  "${PSQL[@]}" -d postgres -c "DROP DATABASE IF EXISTS \"$DBNAME\" WITH (FORCE);" >/dev/null 2>&1 || true
}
trap cleanup EXIT

echo "==> creating scratch database $DBNAME"
"${PSQL[@]}" -d postgres -c "CREATE DATABASE \"$DBNAME\";"

echo "==> applying task-specific Supabase platform stub"
"${PSQL[@]}" -d "$DBNAME" -f "$SCRIPT_DIR/calendar_feed_platform_stub.sql"

echo "==> simulating Supabase's stock default privileges (must run BEFORE the"
echo "    migrations create the view under test, or the suite passes vacuously"
echo "    with the view owner-only for the wrong reason)"
"${PSQL[@]}" -d "$DBNAME" -c \
  "alter default privileges in schema public grant all on tables to anon, authenticated, service_role;"

found_revoke=false
for migration in "$MIGRATIONS_DIR"/*.sql; do
  basename="$(basename "$migration")"

  if [[ "$basename" == "$SKIPPED_MIGRATION" ]]; then
    echo "==> skipping migration: 20260719000000_cron.sql (requires Supabase pg_cron, pg_net, and Vault)"
    continue
  fi

  if [[ "$basename" == "$REVOKE_MIGRATION" ]]; then
    found_revoke=true
  fi

  echo "==> applying migration unchanged: $basename"
  "${PSQL[@]}" -d "$DBNAME" -f "$migration"
done

if [[ "$found_revoke" != true ]]; then
  echo "Missing required migration: $REVOKE_MIGRATION" >&2
  exit 1
fi

echo "==> running T205 anon/authenticated grant assertions"
"${PSQL[@]}" -d "$DBNAME" -f "$SCRIPT_DIR/t205_anon_grant_assertions.sql"

echo "==> T205 anon/authenticated grant tests: ALL PASS"
