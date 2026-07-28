#!/usr/bin/env bash
#
# T014 NFR-03 metric-view fixture-test runner.
#
# Run with:
#   bash supabase/tests/run.sh
#
# What it does: creates a disposable scratch Postgres database, applies
# supabase/tests/auth_stub.sql (minimal `auth` schema scaffolding a bare
# Postgres instance doesn't otherwise have), then applies every file under
# supabase/migrations/ UNCHANGED and in filename order (T009 identity_roster
# -> T010 scheduling_attendance -> T011 support_audit -> T012 rls -> T013
# metric_views), then loads supabase/tests/seed.sql (fabricated-name fixture
# data, constitution item 6) and runs supabase/tests/assertions.sql (the four
# NFR-03 cases: excused-shrinks-denominator, hours_override-wins, check-in
# clamping to the session window (both the positive-clamp and zero-floor
# sub-cases), and the no-completed-sessions "-" case). The scratch database is
# dropped again on exit, whether the run passed or failed, so this script is
# safely re-runnable.
#
# Exit code: 0 if every case in assertions.sql PASSed, non-zero otherwise
# (either a genuine assertion FAIL, surfaced via assertions.sql's own
# `raise exception`, or any other psql error while applying the auth stub /
# migrations / seed, since every psql invocation below runs with
# `-v ON_ERROR_STOP=1`).
#
# Requirements: `psql` on PATH and a reachable Postgres server. No
# `supabase` CLI, no Postgres client npm package, and no new dependency of any
# kind is required -- this is deliberately a plain psql/shell runner because
# no Postgres client library is on the project's dependency allowlist
# (constitution item 9) and pgTAP was not available as a Postgres extension
# in the environment this suite was authored in (checked directly: `select *
# from pg_available_extensions where name='pgtap'` returned zero rows).
#
# Connection: by default (no PGHOST/PGUSER set), this script assumes the
# sandbox pattern used to author/validate it -- a local `postgres` OS user
# reachable via `sudo -u postgres psql` (peer auth), the same scratch-Postgres
# access pattern documented for T009-T013's own validation. If PGHOST or
# PGUSER is already set in the environment (e.g. a CI job pointing at a real
# Postgres service container), that connection info is used directly via a
# plain `psql` invocation instead, and `sudo` is not invoked at all.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
MIGRATIONS_DIR="$REPO_ROOT/supabase/migrations"

DBNAME="volt_nfr03_test_$$_$(date +%s)"

if [ -n "${PGHOST:-}" ] || [ -n "${PGUSER:-}" ]; then
  PSQL=(psql -v ON_ERROR_STOP=1)
else
  PSQL=(sudo -u postgres psql -v ON_ERROR_STOP=1)
fi

cleanup() {
  "${PSQL[@]}" -d postgres -c "DROP DATABASE IF EXISTS \"$DBNAME\";" >/dev/null 2>&1 || true
}
trap cleanup EXIT

echo "==> creating scratch database $DBNAME"
"${PSQL[@]}" -d postgres -c "CREATE DATABASE \"$DBNAME\";"

echo "==> applying auth schema stub"
"${PSQL[@]}" -d "$DBNAME" -f "$SCRIPT_DIR/auth_stub.sql"

for f in "$MIGRATIONS_DIR"/*.sql; do
  echo "==> applying migration: $(basename "$f")"
  "${PSQL[@]}" -d "$DBNAME" -f "$f"
done

echo "==> loading NFR-03 fixture data"
"${PSQL[@]}" -d "$DBNAME" -f "$SCRIPT_DIR/seed.sql"

echo "==> running NFR-03 assertions"
"${PSQL[@]}" -d "$DBNAME" -f "$SCRIPT_DIR/assertions.sql"

echo "==> NFR-03 metric-view fixture tests: ALL PASS"
