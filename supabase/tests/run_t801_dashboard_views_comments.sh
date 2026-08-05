#!/usr/bin/env bash

# T801: applies every migration to a scratch database and runs the
# dashboard-views comment assertions. Mirrors
# `run_volunteer_hours_outreach_only.sh` exactly -- same scratch-DB lifecycle,
# same platform stub, same "apply every migration unchanged" loop.
#
# This script is the gap T801 shipped with: the assertions file landed without
# a runner, while every sibling assertion set here has one. Nothing in CI runs
# any of them (see T701 for the `tests/rls/run.sh` half of that problem), so a
# missing runner meant the file could only be executed by someone
# reconstructing the harness by hand.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
MIGRATIONS_DIR="$REPO_ROOT/supabase/migrations"
COMMENT_MIGRATION="20260805000000_dashboard_views_comment_corrections.sql"
SKIPPED_MIGRATION="20260719000000_cron.sql"
DBNAME="volt_t801_dashboard_comments_$$_$(date +%s)"

PSQL=(psql -X -v ON_ERROR_STOP=1)

cleanup() {
  "${PSQL[@]}" -d postgres -c "DROP DATABASE IF EXISTS \"$DBNAME\" WITH (FORCE);" >/dev/null 2>&1 || true
}
trap cleanup EXIT

echo "==> creating scratch database $DBNAME"
"${PSQL[@]}" -d postgres -c "CREATE DATABASE \"$DBNAME\";"

echo "==> applying Supabase platform stub (T195 precedent, same stub T322's runner uses)"
"${PSQL[@]}" -d "$DBNAME" -f "$SCRIPT_DIR/calendar_feed_platform_stub.sql"

found_comment_migration=false
for migration in "$MIGRATIONS_DIR"/*.sql; do
  basename="$(basename "$migration")"

  if [[ "$basename" == "$SKIPPED_MIGRATION" ]]; then
    echo "==> skipping migration: 20260719000000_cron.sql (requires Supabase pg_cron, pg_net, and Vault)"
    continue
  fi

  if [[ "$basename" == "$COMMENT_MIGRATION" ]]; then
    found_comment_migration=true
  fi

  echo "==> applying migration unchanged: $basename"
  "${PSQL[@]}" -d "$DBNAME" -f "$migration"
done

if [[ "$found_comment_migration" != true ]]; then
  echo "Missing required migration: $COMMENT_MIGRATION" >&2
  exit 1
fi

echo "==> running T801 dashboard-views comment assertions"
"${PSQL[@]}" -d "$DBNAME" -f "$SCRIPT_DIR/t801_dashboard_views_comment_assertions.sql"

echo "==> T801 dashboard-views comment tests: ALL PASS"
