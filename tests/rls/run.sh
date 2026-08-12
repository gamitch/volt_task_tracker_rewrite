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
# not a copy/modification of it), then applies every file under
# `supabase/migrations/` UNCHANGED and in filename order, EXCEPT two that
# depend on Supabase-platform objects a bare Postgres lacks (named and
# justified at the loop below -- T701 corrected this sentence, which
# promised "EVERY file" long after that stopped being true) (identity_roster ->
# scheduling_attendance -> support_audit -> rls -> metric_views ->
# invite_trigger), then `tests/rls/grants.sql` (post-migration table grants
# to the `authenticated` role, mirroring the real Supabase platform's default
# schema grants), then loads `tests/rls/seed.sql` (fabricated-name fixture
# data, constitution item 6), then runs `tests/rls/assertions.sql`, which
# prints a PASS/FAIL table for every scenario -- and then, AFTER that has run,
# the same seed/assertions pair a second time for GAM-299
# (`tests/rls/gam299_seed.sql` + `tests/rls/gam299_assertions.sql`, active
# `student_teams` membership event visibility), whose report is APPENDED to the
# same file (see the `tee -a` note at that step). The scratch database is
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

# T701 -- this loop used to apply EVERY migration unchanged, which the header
# above still promised long after it stopped being achievable. Two migrations
# depend on Supabase-platform objects a bare Postgres does not have, so they
# are skipped BY NAME with the reason stated, exactly as
# `supabase/tests/run_calendar_feed_lifecycle.sh:29-31` already proved:
#
#   20260719000000_cron.sql          -- needs pg_cron AND pg_net; pg_net is
#                                       Supabase-platform-only and is not
#                                       packaged for Debian/Ubuntu at all.
#   20260720000001_avatar_storage.sql -- needs `storage.buckets`, created by
#                                       the Supabase storage service.
#
# Neither defines or alters a table, view, or policy this RLS suite asserts
# against, so skipping them does not narrow what the suite proves. Anything
# they DID cover would be invisible here either way -- the alternative is not
# "more coverage", it is a runner that cannot start.
SKIPPED_MIGRATIONS=(
  "20260719000000_cron.sql"
  "20260720000001_avatar_storage.sql"
)

for f in "$MIGRATIONS_DIR"/*.sql; do
  base="$(basename "$f")"
  skip=false
  for skipped in "${SKIPPED_MIGRATIONS[@]}"; do
    if [[ "$base" == "$skipped" ]]; then skip=true; break; fi
  done
  if [[ "$skip" == true ]]; then
    echo "==> SKIPPING migration (Supabase-platform dependency): $base"
    continue
  fi
  echo "==> applying migration: $base"
  "${PSQL[@]}" -d "$DBNAME" -f "$f"
done

echo "==> applying post-migration grants to the authenticated role"
"${PSQL[@]}" -d "$DBNAME" -f "$SCRIPT_DIR/grants.sql"

echo "==> loading RLS-denial fixture data"
"${PSQL[@]}" -d "$DBNAME" -f "$SCRIPT_DIR/seed.sql"

echo "==> running RLS-denial assertions"
"${PSQL[@]}" -d "$DBNAME" -f "$SCRIPT_DIR/assertions.sql" | tee "$REPORT_FILE"

# GAM-299 (T806): active-membership event visibility. Loaded HERE, after the
# assertions above have already run, so no row this fixture adds can move a
# pre-existing case's count or expected value.
#
# `tee -a`, NOT `tee`, and this is load-bearing rather than stylistic: plain
# `tee` TRUNCATES, so the grep below would only ever see this second report and
# every case in `assertions.sql` above would become advisory -- a guard that no
# longer fires. That was measured, twice: with plain `tee` a deliberately
# planted FAIL in `assertions.sql` printed on screen and the script still
# exited 0. Any future suite appended here must use `tee -a` for the same
# reason.
echo "==> loading GAM-299 active-membership fixture data"
"${PSQL[@]}" -d "$DBNAME" -f "$SCRIPT_DIR/gam299_seed.sql"

echo "==> running GAM-299 active-membership event-visibility assertions"
"${PSQL[@]}" -d "$DBNAME" -f "$SCRIPT_DIR/gam299_assertions.sql" | tee -a "$REPORT_FILE"

if grep -q 'FAIL' "$REPORT_FILE"; then
  echo "==> T020 NFR-02 RLS-denial test suite: AT LEAST ONE CASE FAILED"
  exit 1
fi

echo "==> T020 NFR-02 RLS-denial test suite: ALL CASES PASSED"
