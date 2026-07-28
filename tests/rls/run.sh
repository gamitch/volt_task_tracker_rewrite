#!/usr/bin/env bash
#
# T020 NFR-02 RLS-denial test runner.
#
# Run with:
#   bash tests/rls/run.sh
#
# What it does: creates a disposable scratch Postgres database, applies
# `tests/rls/auth_stub.sql` (minimal `auth` schema scaffolding a bare
# Postgres instance doesn't otherwise have -- see that file's header comment
# for why this is a separate, wider stub than `supabase/tests/auth_stub.sql`,
# not a copy/modification of it), then applies EVERY file under
# `supabase/migrations/` UNCHANGED and in filename order (identity_roster ->
# scheduling_attendance -> support_audit -> rls -> metric_views ->
# invite_trigger), then `tests/rls/grants.sql` (post-migration table grants
# to the `authenticated` role, mirroring the real Supabase platform's default
# schema grants), then loads `tests/rls/seed.sql` (fabricated-name fixture
# data, constitution item 6), then runs `tests/rls/assertions.sql`, which
# prints a PASS/FAIL table for every scenario. The scratch database is
# dropped again on exit, whether the run passed or failed, so this script is
# safely re-runnable, and never leaves scratch data committed anywhere.
#
# Exit code: 0 if every scenario in assertions.sql's final report is PASS,
# non-zero otherwise (either a genuine assertion FAIL, detected by grepping
# the final report for the literal string "FAIL", or any other psql error
# while applying the auth stub / migrations / grants / seed, since every
# psql invocation below runs with `-v ON_ERROR_STOP=1`).
#
# Requirements: `psql` on PATH and a reachable Postgres server. No
# `supabase` CLI, no Postgres client npm package, and no new dependency of
# any kind -- same reasoning as `supabase/tests/run.sh` (T014): this is
# deliberately a plain psql/shell runner, not a JS/TS test file, so it is not
# swept into `npm run lint` / `npm run test`'s default scope (see this task's
# worker output, Acceptance Criterion 8).
#
# Connection: by default (no PGHOST/PGUSER set), this script assumes the
# sandbox pattern used to author/validate it -- a local `postgres` OS user
# reachable via `sudo -u postgres psql` (peer auth), same as
# `supabase/tests/run.sh`. If PGHOST or PGUSER is already set in the
# environment (e.g. a CI job pointing at a real Postgres service container),
# that connection info is used directly via a plain `psql` invocation
# instead, and `sudo` is not invoked at all.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
MIGRATIONS_DIR="$REPO_ROOT/supabase/migrations"

DBNAME="volt_rls_denial_test_$$_$(date +%s)"
REPORT_FILE="$(mktemp)"

if [ -n "${PGHOST:-}" ] || [ -n "${PGUSER:-}" ]; then
  PSQL=(psql -v ON_ERROR_STOP=1)
else
  PSQL=(sudo -u postgres psql -v ON_ERROR_STOP=1)
fi

cleanup() {
  "${PSQL[@]}" -d postgres -c "DROP DATABASE IF EXISTS \"$DBNAME\";" >/dev/null 2>&1 || true
  rm -f "$REPORT_FILE"
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

echo "==> applying post-migration grants to the authenticated role"
"${PSQL[@]}" -d "$DBNAME" -f "$SCRIPT_DIR/grants.sql"

echo "==> loading RLS-denial fixture data"
"${PSQL[@]}" -d "$DBNAME" -f "$SCRIPT_DIR/seed.sql"

echo "==> running RLS-denial assertions"
"${PSQL[@]}" -d "$DBNAME" -f "$SCRIPT_DIR/assertions.sql" | tee "$REPORT_FILE"

if grep -q 'FAIL' "$REPORT_FILE"; then
  echo "==> T020 NFR-02 RLS-denial test suite: AT LEAST ONE CASE FAILED"
  exit 1
fi

echo "==> T020 NFR-02 RLS-denial test suite: ALL CASES PASSED"
