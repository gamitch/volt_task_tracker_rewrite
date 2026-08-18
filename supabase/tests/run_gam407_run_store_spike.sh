#!/usr/bin/env bash
#
# GAM-407 -- bounded spike: is Supabase/PostgreSQL a viable operational run
# store? This is the fault harness. It produces EVIDENCE, not infrastructure.
#
# It is LOCAL-ONLY and deliberately NOT wired into .github/workflows/ci.yml:
# the `sql` job runs on a postgres:16 service container and installs only
# postgresql-client, so neither delivery path can run this. Wiring it up is a
# knowing deferral with a filed row (GAM-415), not an oversight.
#
# Shape precedent: supabase/tests/run_t503_widen_rsvp_read.sh (which runs
# standalone), NOT run_t205_anon_grant.sh (which does not).
#
# Usage -- start a scratch cluster first, then point this at it:
#
#   sudo -n bash .claude/skills/scratch-postgres/scripts/start.sh \
#        --port 55440 --repo "$PWD"
#   PGHOST=/tmp PGPORT=55440 PGUSER=postgres \
#        bash supabase/tests/run_gam407_run_store_spike.sh
#   sudo -n bash .claude/skills/scratch-postgres/scripts/start.sh \
#        --stop --port 55440
#
# This harness creates and drops its OWN database on that cluster and applies
# the product migrations itself, so it never depends on the cluster's `scratch`
# database being in any particular state.
#
# Output: one `PASS <id> :: <detail>` / `FAIL <id> :: <detail>` line per
# assertion, then a per-criterion / per-scenario roll-up. Exit non-zero if any
# assertion failed.
#
# AC12: the PostgreSQL version is RECORDED AND DEGRADED HONESTLY, never
# aborted. On a server below 17 every result line carries a PARTIAL qualifier.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
MIGRATIONS_DIR="$REPO_ROOT/supabase/migrations"
SKIPPED_MIGRATION="20260719000000_cron.sql"
SPIKE_SCHEMA="$REPO_ROOT/supabase/spikes/gam-407-run-store/schema.sql"
ASSERTIONS="$SCRIPT_DIR/gam407_run_store_assertions.sql"
PLATFORM_STUB="$SCRIPT_DIR/calendar_feed_platform_stub.sql"

DBNAME="volt_gam407_run_store_$$_$(date +%s)"
WORK="$(mktemp -d)"
RESULTS="$WORK/results.txt"
: > "$RESULTS"

# Scratch-cluster-only credential, matching schema.sql. It guards nothing --
# the scratch cluster is `local all all trust` and accepts any password. Its
# purpose is portability (AC13); the password's EXISTENCE is asserted against
# pg_authid, never by "the connection succeeded", which is vacuous here.
EXECUTOR_PASSWORD='gam407_spike_scratch_only'

QUAL=""

PSQL=(psql -X -q -v ON_ERROR_STOP=1 -v VERBOSITY=verbose)
PSQLV=(psql -X -q -At -v ON_ERROR_STOP=1 -v VERBOSITY=verbose)

cleanup() {
  psql -X -q -d postgres -c "DROP DATABASE IF EXISTS \"$DBNAME\" WITH (FORCE);" >/dev/null 2>&1 || true
  rm -rf "$WORK"
}
trap cleanup EXIT

record() { # status id detail
  local line="$1 $2 :: $3"
  [ -n "$QUAL" ] && line="$line $QUAL"
  printf '%s\n' "$line" | tee -a "$RESULTS"
}

sql1() { "${PSQLV[@]}" -d "$DBNAME" -c "$1"; }

exec_psql() { # run as the untrusted executor, from a DIRECT LOGIN.
  # Never `set role ops_executor` from a postgres session: SET ROLE is
  # authorized against session_user, so that form makes the escalation
  # negatives SUCCEED and turns criterion 3 into a false FAIL (packet D7).
  PGPASSWORD="$EXECUTOR_PASSWORD" \
    psql -X -q -At -v ON_ERROR_STOP=1 -v VERBOSITY=verbose \
         -U ops_executor -d "$DBNAME" "$@"
}

expect_denied() { # id sqlstate sql
  local id="$1" state="$2" stmt="$3" out rc
  set +e
  out="$(exec_psql -c "$stmt" 2>&1)"
  rc=$?
  set -e
  local flat
  flat="$(printf '%s' "$out" | tr '\n' ' ' | cut -c1-240)"
  if [ "$rc" -ne 0 ] && printf '%s' "$out" | grep -qE "ERROR:[[:space:]]+$state:"; then
    record PASS "$id" "denied as $state -- $flat"
  else
    record FAIL "$id" "expected SQLSTATE $state; got rc=$rc -- $flat"
  fi
}

# ---------------------------------------------------------------------------
# AC12 -- version first, on the first line, and never an abort.
# ---------------------------------------------------------------------------
if ! psql -X -q -At -d postgres -c 'select 1' >/dev/null 2>&1; then
  echo "FAIL harness-preflight :: cannot connect to a PostgreSQL server." >&2
  echo "  Set PGHOST/PGPORT/PGUSER for a scratch cluster, e.g." >&2
  echo "  PGHOST=/tmp PGPORT=55440 PGUSER=postgres bash $0" >&2
  exit 2
fi

SERVER_VERSION="$(psql -X -q -At -d postgres -c 'show server_version')"
SERVER_VERSION_NUM="$(psql -X -q -At -d postgres -c 'show server_version_num')"
echo "server_version=$SERVER_VERSION server_version_num=$SERVER_VERSION_NUM"

if [ "$SERVER_VERSION_NUM" -lt 170000 ]; then
  QUAL="[PARTIAL: measured on PG $SERVER_VERSION, not the pinned 17]"
  echo "PARTIAL: measured on PG $SERVER_VERSION, not the pinned 17"
  echo "  Every scenario line below carries that qualifier. The harness does not"
  echo "  refuse to run, and it does not present a PG-16 result as a PG-17 one."
else
  echo "OK: server is on the pinned major (PG 17). The live Supabase project is"
  echo "  17.6.1.141 -- same major, DIFFERENT MINOR. Do not collapse the two."
fi

# ---------------------------------------------------------------------------
# Rig: a scratch database carrying the real product migrations, then the spike
# schema applied explicitly ON TOP (packet D1 -- coexistence is part of the
# proof, and the spike SQL is not a migration).
# ---------------------------------------------------------------------------
echo "==> creating scratch database $DBNAME"
psql -X -q -v ON_ERROR_STOP=1 -d postgres -c "CREATE DATABASE \"$DBNAME\";"

echo "==> applying the Supabase platform stub (T195/T205/T322/T503 precedent)"
"${PSQL[@]}" -d "$DBNAME" -f "$PLATFORM_STUB" >/dev/null

# service_role must be BYPASSRLS or "cannot escalate to service_role" measures
# something weaker than the hosted condition. T503:35 creates it merely
# `nologin`; take T503's STRUCTURE, not its role DDL.
echo "==> creating service_role nologin noinherit bypassrls (hosted-shaped)"
"${PSQL[@]}" -d "$DBNAME" -c "
do \$\$
begin
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    create role service_role nologin noinherit bypassrls;
  else
    alter role service_role nologin noinherit bypassrls;
  end if;
end;
\$\$;"

# Supabase's stock default privileges. NOTE what this does and does not do:
# `alter default privileges IN SCHEMA public` produces exactly one
# pg_default_acl row, scoped to public. It is a valid control for criterion 3
# negative #2 (product tables) and constrains NOTHING in schema ops.
echo "==> simulating Supabase's stock default privileges (BEFORE any table exists)"
"${PSQL[@]}" -d "$DBNAME" -c \
  "alter default privileges in schema public grant all on tables to anon, authenticated, service_role;"

echo "==> applying product migrations (all but $SKIPPED_MIGRATION, which needs pg_cron)"
applied=0
for migration in "$MIGRATIONS_DIR"/*.sql; do
  base="$(basename "$migration")"
  if [ "$base" = "$SKIPPED_MIGRATION" ]; then
    echo "    skipping $base (requires pg_cron / pg_net / Vault -- hosted only)"
    continue
  fi
  "${PSQL[@]}" -d "$DBNAME" -f "$migration" >/dev/null
  applied=$((applied + 1))
done
echo "    applied $applied product migrations unchanged"

echo "==> applying the spike schema AFTER the product migrations: $SPIKE_SCHEMA"
"${PSQL[@]}" -d "$DBNAME" -f "$SPIKE_SCHEMA" >/dev/null

# Informational, deliberately NOT an exact-match assertion: PostgreSQL 17 adds
# the MAINTAIN privilege, so this string is arwdDxtm on 17 and arwdDxt on 16.
# Asserting the PG-16 string would be red on the pinned major.
echo "==> default-privileges ACL actually produced (informational, not asserted):"
echo "    $(sql1 "select coalesce(string_agg(defaclacl::text, ' '), '<none>') from pg_default_acl")"

# ---------------------------------------------------------------------------
# Single-session assertions (postgres): guards, ACLs, criterion 1 both
# directions, scenarios 1, 13 and 14.
# ---------------------------------------------------------------------------
echo "==> single-session assertions"
"${PSQL[@]}" -d "$DBNAME" -v qual="$QUAL" -f "$ASSERTIONS" | tee -a "$RESULTS"

# ---------------------------------------------------------------------------
# SCENARIO 2 -- raced claims, under GENUINE concurrency.
# No advisory-lock barrier: the loser blocks on the winner's speculative-insert
# token by itself. A sequential proof would only show the caller behaving.
# ---------------------------------------------------------------------------
echo "==> scenario 2: two genuinely concurrent reserve_run sessions"
cat > "$WORK/s2_winner.sql" <<'EOSQL'
begin;
select 'winner|' || run_id::text || '|' || created::text
  from ops.reserve_run('GAM-407-S2', 'todo-event-s2');
select pg_sleep(2);
commit;
EOSQL

"${PSQLV[@]}" -d "$DBNAME" -f "$WORK/s2_winner.sql" > "$WORK/s2_winner.out" 2>&1 &
S2_WINNER_PID=$!
sleep 1
S2_T0=$(date +%s%N)
"${PSQLV[@]}" -d "$DBNAME" \
  -c "select 'loser|' || run_id::text || '|' || created::text from ops.reserve_run('GAM-407-S2', 'todo-event-s2');" \
  > "$WORK/s2_loser.out" 2>&1 || true
S2_T1=$(date +%s%N)
set +e
wait "$S2_WINNER_PID"
S2_WINNER_RC=$?
set -e

S2_WINNER_LINE="$(grep '^winner|' "$WORK/s2_winner.out" || true)"
S2_LOSER_LINE="$(grep '^loser|' "$WORK/s2_loser.out" || true)"
S2_WINNER_RUN="$(printf '%s' "$S2_WINNER_LINE" | cut -d'|' -f2)"
S2_WINNER_CREATED="$(printf '%s' "$S2_WINNER_LINE" | cut -d'|' -f3)"
S2_LOSER_RUN="$(printf '%s' "$S2_LOSER_LINE" | cut -d'|' -f2)"
S2_LOSER_CREATED="$(printf '%s' "$S2_LOSER_LINE" | cut -d'|' -f3)"
S2_WAIT_MS=$(( (S2_T1 - S2_T0) / 1000000 ))
S2_ROWS="$(sql1 "select count(*) from ops.run where issue_identifier = 'GAM-407-S2' and todo_event_id = 'todo-event-s2'")"

if [ "$S2_WINNER_RC" -eq 0 ] \
   && [ "$S2_ROWS" = "1" ] \
   && [ -n "$S2_WINNER_RUN" ] && [ "$S2_WINNER_RUN" = "$S2_LOSER_RUN" ] \
   && [ "$S2_WINNER_CREATED" = "true" ] && [ "$S2_LOSER_CREATED" = "false" ]; then
  record PASS scenario-2 "concurrent sessions: rows=$S2_ROWS, same run_id=$S2_WINNER_RUN, created true then false, second session blocked ${S2_WAIT_MS}ms on the winner's speculative-insert token (no advisory lock)"
else
  record FAIL scenario-2 "rows=$S2_ROWS winner=[$S2_WINNER_LINE] loser=[$S2_LOSER_LINE] winner_rc=$S2_WINNER_RC waited=${S2_WAIT_MS}ms"
fi

# ---------------------------------------------------------------------------
# CRITERION 3 -- both directions, from a DIRECT ops_executor login.
# ---------------------------------------------------------------------------
echo "==> criterion 3: negatives and positive control, as ops_executor"

EXEC_TOKEN="$(sql1 "select capability_token from ops.reserve_run('GAM-407-EXEC', 'todo-event-exec')")"
EXEC_RUN="$(sql1 "select run_id from ops.run where issue_identifier = 'GAM-407-EXEC' and todo_event_id = 'todo-event-exec'")"

# D7 guard, BEFORE the escalation negatives: if the rig regresses to a
# `set role` session, the negatives would all succeed and criterion 3 would
# report a FAIL that measures the rig rather than the design.
D7="$(exec_psql -c "select session_user || '|' || current_user || '|' || coalesce((select usesuper::text from pg_user where usename = session_user), '?')" 2>&1 || true)"
if [ "$D7" = "ops_executor|ops_executor|false" ]; then
  record PASS guard-d7-direct-login "session_user|current_user|usesuper = $D7 (a genuine unprivileged login, not \`set role\`)"
else
  record FAIL guard-d7-direct-login "expected ops_executor|ops_executor|false, got $D7"
fi

expect_denied crit3-neg1-select-ops-run       42501 "select * from ops.run;"
expect_denied crit3-neg1b-select-ops-run-event 42501 "select * from ops.run_event;"
expect_denied crit3-neg2-select-product-table 42501 "select * from public.events;"
expect_denied crit3-neg3a-set-role-ops-owner  42501 "set role ops_owner;"
expect_denied crit3-neg3b-set-role-postgres   42501 "set role postgres;"
expect_denied crit3-neg3c-set-role-service    42501 "set role service_role;"
expect_denied crit3-neg4a-reserve-run         42501 "select * from ops.reserve_run('GAM-407-EVIL', 'evil');"
expect_denied crit3-neg4b-advance-generation  42501 "select * from ops.advance_generation('$EXEC_RUN'::uuid, 1);"
expect_denied crit3-neg4c-record-terminal     42501 "select * from ops.record_terminal_event('$EXEC_RUN'::uuid, 'evil', '{}'::jsonb);"
expect_denied crit3-neg4d-create-in-public    42501 "create table public.gam407_zz_probe (i int);"

# Positive control. A negative-only result proves only that nothing works.
# Both int arguments by name (AC14).
EXEC_OK="$(exec_psql -c "select outcome || '|' || coalesce(new_version::text, 'null') from ops.publish_checkpoint('$EXEC_TOKEN', p_expected_generation => 1, p_expected_version => 1, p_payload => '{\"head_sha\":\"exec-own-head\",\"status\":\"checkpointed\"}'::jsonb);" 2>&1 || true)"
EXEC_ROW="$(sql1 "select version || '|' || generation || '|' || coalesce(head_sha, 'null') from ops.run where run_id = '$EXEC_RUN'")"
if [ "$EXEC_OK" = "ok|2" ] && [ "$EXEC_ROW" = "2|1|exec-own-head" ]; then
  record PASS crit3-pos-control-own-run "executor published for its OWN run with its OWN token: $EXEC_OK; row re-read version|generation|head_sha = $EXEC_ROW"
else
  record FAIL crit3-pos-control-own-run "expected ok|2 and 2|1|exec-own-head, got $EXEC_OK and $EXEC_ROW"
fi

# Negative 5: another run's token is impossible to construct, so assert that a
# forged/random token yields no_such_capability and moves NOTHING. Re-read the
# row -- a non-matching UPDATE reports UPDATE 0 rather than raising.
FORGED="$(sql1 "select replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '')")"
EXEC_FORGE="$(exec_psql -c "select outcome || '|' || coalesce(new_version::text, 'null') from ops.publish_checkpoint('$FORGED', p_expected_generation => 1, p_expected_version => 2, p_payload => '{\"head_sha\":\"FORGED\"}'::jsonb);" 2>&1 || true)"
EXEC_ROW2="$(sql1 "select version || '|' || generation || '|' || coalesce(head_sha, 'null') from ops.run where run_id = '$EXEC_RUN'")"
if [ "$EXEC_FORGE" = "no_such_capability|null" ] && [ "$EXEC_ROW2" = "$EXEC_ROW" ]; then
  record PASS crit3-neg5-forged-token "forged token -> $EXEC_FORGE; row re-read unchanged ($EXEC_ROW2)"
else
  record FAIL crit3-neg5-forged-token "expected no_such_capability|null with the row unchanged ($EXEC_ROW), got $EXEC_FORGE and $EXEC_ROW2"
fi

# Negative 6: after the controller advances the generation, the executor's
# previously-valid token fails CLOSED (scenario 13 route ii, from the
# executor's own session this time).
ADV="$(sql1 "select outcome || '|' || new_generation || '|' || new_version from ops.advance_generation('$EXEC_RUN'::uuid, 2)")"
ADV_ROW="$(sql1 "select version || '|' || generation || '|' || coalesce(head_sha, 'null') from ops.run where run_id = '$EXEC_RUN'")"
EXEC_FENCED="$(exec_psql -c "select outcome || '|' || coalesce(new_version::text, 'null') from ops.publish_checkpoint('$EXEC_TOKEN', p_expected_generation => 2, p_expected_version => 3, p_payload => '{\"head_sha\":\"ZOMBIE\"}'::jsonb);" 2>&1 || true)"
ADV_ROW2="$(sql1 "select version || '|' || generation || '|' || coalesce(head_sha, 'null') from ops.run where run_id = '$EXEC_RUN'")"
if [ "$ADV" = "ok|2|3" ] && [ "$EXEC_FENCED" = "no_such_capability|null" ] && [ "$ADV_ROW2" = "$ADV_ROW" ]; then
  record PASS crit3-neg6-fenced-old-token "advance_generation -> $ADV; the executor's previously-valid token -> $EXEC_FENCED; row re-read unchanged ($ADV_ROW2)"
else
  record FAIL crit3-neg6-fenced-old-token "advance=$ADV replay=$EXEC_FENCED row $ADV_ROW -> $ADV_ROW2"
fi

# ---------------------------------------------------------------------------
# D2a -- NEGATIVE CONTROL: the REJECTED claims-keyed design, shown FORGEABLE by
# the very role it purports to constrain. A PASS here means the forgery worked.
# ---------------------------------------------------------------------------
echo "==> D2a negative control: is the rejected claims-keyed design forgeable?"
D2A="$(exec_psql -c "set request.jwt.claims = '{\"run_id\":\"r1\"}';" -c "select 'own=' || count(*) from ops.rejected_claims_keyed_run;" -c "set request.jwt.claims = '{\"run_id\":\"r2\"}';" -c "select 'forged_visible=' || count(*) from ops.rejected_claims_keyed_run;" -c "update ops.rejected_claims_keyed_run set marker = 'FORGED' where run_ref = 'r2' returning 'moved=' || run_ref || ':' || marker;" 2>&1 || true)"
D2A_FLAT="$(printf '%s' "$D2A" | tr '\n' ' ')"
D2A_REREAD="$(sql1 "select run_ref || '=' || marker from ops.rejected_claims_keyed_run where run_ref = 'r2'")"
if printf '%s' "$D2A_FLAT" | grep -q 'moved=r2:FORGED' && [ "$D2A_REREAD" = "r2=FORGED" ]; then
  record PASS d2a-claims-keyed-forgeable "the executor re-set its own request.jwt.claims to ANOTHER run's id and moved that row -- [$D2A_FLAT]; re-read as postgres: $D2A_REREAD. The rejected design's security is forgeable by the role it constrains, which is why D2 chose the token-verifying RPC"
else
  record FAIL d2a-claims-keyed-forgeable "expected the forgery to SUCCEED (that is the finding); got [$D2A_FLAT] re-read=$D2A_REREAD"
fi

# ---------------------------------------------------------------------------
# SCENARIO 15 (store-side half only) -- the store becomes unavailable mid
# checkpoint publication. The "no external write was attempted" half belongs to
# Worker B's run-store-controller.test.mjs.
# ---------------------------------------------------------------------------
echo "==> scenario 15: killing the connection mid-publication"
S15_TOKEN="$(sql1 "select capability_token from ops.reserve_run('GAM-407-S15', 'todo-event-s15')")"
S15_RUN="$(sql1 "select run_id from ops.run where issue_identifier = 'GAM-407-S15' and todo_event_id = 'todo-event-s15'")"
S15_BEFORE="$(sql1 "select version || '|' || generation || '|' || coalesce(head_sha, 'null') || '|' || status from ops.run where run_id = '$S15_RUN'")"

cat > "$WORK/s15.sql" <<EOSQL
\set VERBOSITY verbose
begin;
select 'published=' || outcome
  from ops.publish_checkpoint('$S15_TOKEN',
       p_expected_generation => 1, p_expected_version => 1,
       p_payload => '{"head_sha":"s15-in-flight","status":"checkpointed"}'::jsonb);
select pg_sleep(30);
commit;
EOSQL

# \set VERBOSITY verbose is REQUIRED: without it psql prints the message
# without the SQLSTATE and the assertion cannot key on 57P01.
PGAPPNAME=gam407_s15_victim "${PSQLV[@]}" -d "$DBNAME" -f "$WORK/s15.sql" \
  > "$WORK/s15.out" 2> "$WORK/s15.err" &
S15_PID=$!

S15_READY=0
for _ in $(seq 1 60); do
  n="$(sql1 "select count(*) from pg_stat_activity where application_name = 'gam407_s15_victim' and query like '%pg_sleep%'")"
  if [ "$n" = "1" ]; then S15_READY=1; break; fi
  sleep 0.25
done
S15_KILLED="$(sql1 "select count(*) from (select pg_terminate_backend(pid) from pg_stat_activity where application_name = 'gam407_s15_victim') k")"
set +e
wait "$S15_PID"
S15_RC=$?
set -e
S15_ERR="$(tr '\n' ' ' < "$WORK/s15.err" | cut -c1-240)"
S15_AFTER="$(sql1 "select version || '|' || generation || '|' || coalesce(head_sha, 'null') || '|' || status from ops.run where run_id = '$S15_RUN'")"

if [ "$S15_READY" = "1" ] && [ "$S15_KILLED" = "1" ] && [ "$S15_RC" -ne 0 ] \
   && grep -q '57P01' "$WORK/s15.err" \
   && [ "$S15_AFTER" = "$S15_BEFORE" ]; then
  record PASS scenario-15-store-side "connection killed mid-statement: psql exit $S15_RC, stderr [$S15_ERR]; the in-flight publication ROLLED BACK -- no row records the checkpoint as published (before=$S15_BEFORE after=$S15_AFTER). The failure is NAMED (57P01), not silent"
else
  record FAIL scenario-15-store-side "ready=$S15_READY killed=$S15_KILLED rc=$S15_RC stderr=[$S15_ERR] before=$S15_BEFORE after=$S15_AFTER"
fi

# ---------------------------------------------------------------------------
# Roll-up
# ---------------------------------------------------------------------------
summarize() { # label regex
  local label="$1" re="$2" total fails
  total="$(grep -cE "^(PASS|FAIL) ($re)" "$RESULTS" || true)"
  fails="$(grep -cE "^FAIL ($re)" "$RESULTS" || true)"
  if [ "$total" -eq 0 ]; then
    printf 'FAIL %s :: no assertions ran (that is a harness defect, not a result)\n' "$label"
  elif [ "$fails" -eq 0 ]; then
    printf 'PASS %s :: %s assertion(s), 0 failed %s\n' "$label" "$total" "$QUAL"
  else
    printf 'FAIL %s :: %s of %s assertion(s) failed %s\n' "$label" "$fails" "$total" "$QUAL"
  fi
}

echo
echo "==> roll-up (the per-criterion verdict the spike report carries)"
summarize criterion-1-atomic-compare-and-set 'crit1-|ac2-'
summarize criterion-2-idempotent-webhooks    'scenario-1 |scenario-2 '
summarize criterion-3-run-scoped-capability  'crit3-|guard-d3|guard-d7|guard-service-role|d5-|ac13-|return-shape'
summarize scenario-13-generation-fencing     'scenario-13'
summarize scenario-14-duplicate-terminal     'scenario-14 '
summarize scenario-15-store-unavailable      'scenario-15'
summarize d2a-negative-control               'd2a-'

TOTAL="$(grep -cE '^(PASS|FAIL) ' "$RESULTS" || true)"
FAILED="$(grep -cE '^FAIL ' "$RESULTS" || true)"
echo
echo "==> $TOTAL assertions, $FAILED failed (PG $SERVER_VERSION / $SERVER_VERSION_NUM)"
echo "    Criteria 4 and 5, and scenario 15's external-write half, belong to"
echo "    Worker B's scripts/run-store-controller.test.mjs and"
echo "    scripts/run-store-episode-summary.test.mjs, not to this harness."

if [ "$FAILED" -ne 0 ]; then
  echo "GAM-407 run-store spike: FAILED ($FAILED assertion(s))" >&2
  exit 1
fi

echo "GAM-407 run-store spike: ALL PASS"
