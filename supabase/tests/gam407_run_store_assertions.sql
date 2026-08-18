-- GAM-407 run-store spike -- single-session (postgres) assertions.
--
-- Driven by supabase/tests/run_gam407_run_store_spike.sh, which owns the
-- multi-session halves (criterion 3's negatives from a direct ops_executor
-- login, scenario 2's concurrency, scenario 15's connection kill and the D2a
-- forgery). Run this file on a database that already has the 24 applicable
-- product migrations AND supabase/spikes/gam-407-run-store/schema.sql applied.
--
-- Output convention: one line per assertion,
--     PASS <id> :: <detail>
--     FAIL <id> :: <detail>
-- The driver counts the FAIL lines; nothing here raises, so one broken
-- assertion never hides the twenty after it. Every block traps `others` and
-- records the SQLSTATE rather than aborting the file.
--
-- Every publish_checkpoint call passes BOTH int arguments by name (AC14):
-- publish_checkpoint(text, int, int, jsonb) has two adjacent ints that are both
-- 1 on every freshly reserved run, so a swapped pair would be silently
-- indistinguishable at exactly the state this file starts from.

\set ON_ERROR_STOP on
\set VERBOSITY verbose
\pset format unaligned
\pset tuples_only on
\pset pager off

create temp table gam407_result (
  seq    serial primary key,
  label  text    not null,
  ok     boolean not null,
  detail text    not null
);

create function pg_temp.rec(p_label text, p_ok boolean, p_detail text)
returns void language sql as $fn$
  insert into gam407_result (label, ok, detail)
  values (p_label, coalesce(p_ok, false), coalesce(p_detail, ''));
$fn$;

-- ===========================================================================
-- Standing guards (AC12). These are GUARDS, not re-establishments of findings
-- F2/F4: they keep those findings' preconditions from creeping back in. The
-- findings themselves were measured directly and live in the packet.
-- ===========================================================================

-- D3: every ops object is owned by a NOSUPERUSER NOBYPASSRLS role. Without
-- this every criterion-3 assertion is vacuous, because a security definer
-- function owned by a BYPASSRLS role runs with RLS off.
do $$
declare v_bad text;
begin
  select string_agg(x.obj || ' owned by ' || x.owner, ', ' order by x.obj)
    into v_bad
    from (
      select 'table:' || c.relname as obj, pg_get_userbyid(c.relowner) as owner
        from pg_class c
       where c.relnamespace = 'ops'::regnamespace and c.relkind = 'r'
      union all
      select 'function:' || p.proname, pg_get_userbyid(p.proowner)
        from pg_proc p
       where p.pronamespace = 'ops'::regnamespace
    ) x
    join pg_roles r on r.rolname = x.owner
   where x.owner <> 'ops_owner' or r.rolbypassrls;

  perform pg_temp.rec(
    'guard-d3-ownership',
    v_bad is null,
    coalesce('OFFENDING: ' || v_bad,
             'every ops table and function is owned by ops_owner, rolbypassrls=false'));
exception when others then
  perform pg_temp.rec('guard-d3-ownership', false, 'unexpected ' || sqlstate || ': ' || sqlerrm);
end
$$;

-- Expectation: ops_owner=f, ops_executor=f, postgres=t, service_role=t.
--
-- NOTE, and this is a real discrepancy in packet revision 6 rather than a
-- worker choice. Criterion 3 negative 7 records the measured expectation as
-- "ops_owner=f, ops_executor=f, service_role=f, postgres=t", but AC4 and the
-- harness section REQUIRE `create role service_role nologin noinherit
-- bypassrls` so that "cannot escalate to service_role" measures the hosted
-- condition. Those two cannot both hold: creating service_role BYPASSRLS makes
-- rolbypassrls=t by construction. The gate rounds' `service_role=f` was
-- measured against T503's weaker `create role service_role nologin`.
--
-- The requirement wins, because it is the one the criterion depends on, and
-- because service_role owns no ops object -- D3's load-bearing property is
-- guard-d3-ownership above (no ops object owner is BYPASSRLS), not this line.
do $$
declare v_txt text; v_ok boolean;
begin
  select string_agg(rolname || '=' || case when rolbypassrls then 't' else 'f' end, ' ' order by rolname),
         bool_and(case when rolname in ('postgres', 'service_role') then rolbypassrls else not rolbypassrls end)
    into v_txt, v_ok
    from pg_roles
   where rolname in ('ops_owner', 'ops_executor', 'service_role', 'postgres');
  perform pg_temp.rec('guard-d3-role-attributes', v_ok,
    'rolbypassrls: ' || coalesce(v_txt, '<none>')
    || ' (want ops_owner=f ops_executor=f postgres=t service_role=t -- see the note above about packet negative 7)');
exception when others then
  perform pg_temp.rec('guard-d3-role-attributes', false, 'unexpected ' || sqlstate || ': ' || sqlerrm);
end
$$;

-- service_role must be created nologin noinherit bypassrls, or AC4's "cannot
-- escalate to service_role" measures something weaker than the hosted
-- condition (hosted Supabase's service_role IS BYPASSRLS).
do $$
declare r record;
begin
  select rolcanlogin, rolinherit, rolbypassrls into r from pg_roles where rolname = 'service_role';
  perform pg_temp.rec(
    'guard-service-role-shape',
    r.rolcanlogin = false and r.rolinherit = false and r.rolbypassrls = true,
    format('service_role: rolcanlogin=%s rolinherit=%s rolbypassrls=%s (want f/f/t)',
           r.rolcanlogin, r.rolinherit, r.rolbypassrls));
exception when others then
  perform pg_temp.rec('guard-service-role-shape', false, 'unexpected ' || sqlstate || ': ' || sqlerrm);
end
$$;

-- AC13: ops_executor has a password. Asserted against pg_authid, NOT by
-- "the connection succeeded" -- on this cluster (local all all trust) a WRONG
-- password and NO password both connect, so a connection test is vacuous.
do $$
declare v_pw text;
begin
  select rolpassword into v_pw from pg_authid where rolname = 'ops_executor';
  perform pg_temp.rec(
    'ac13-executor-password',
    v_pw is not null and left(v_pw, 14) = 'SCRAM-SHA-256$',
    format('pg_authid.rolpassword is not null = %s, left(rolpassword,14) = %L',
           v_pw is not null, left(coalesce(v_pw, ''), 14)));
exception when others then
  perform pg_temp.rec('ac13-executor-password', false, 'unexpected ' || sqlstate || ': ' || sqlerrm);
end
$$;

-- ===========================================================================
-- D5 -- the ACL assertions. One ACL assertion is a better regression guard
-- than six behavioural negatives: a NULL proacl means the PostgreSQL default
-- (EXECUTE TO PUBLIC) is in force, which is exactly how BLOCKER-R2-1 happened.
-- ===========================================================================
do $$
declare v_null text; v_all text;
begin
  select string_agg(proname, ', ' order by proname) into v_null
    from pg_proc where pronamespace = 'ops'::regnamespace and proacl is null;
  select string_agg(proname || '=' || coalesce(proacl::text, 'NULL'), ' ' order by proname) into v_all
    from pg_proc where pronamespace = 'ops'::regnamespace;
  perform pg_temp.rec('d5-acl-non-null', v_null is null,
    coalesce('NULL proacl (i.e. EXECUTE TO PUBLIC) on: ' || v_null, 'all ops function ACLs explicit -- ' || coalesce(v_all, '<none>')));
exception when others then
  perform pg_temp.rec('d5-acl-non-null', false, 'unexpected ' || sqlstate || ': ' || sqlerrm);
end
$$;

-- No aclitem anywhere in schema ops names PUBLIC (grantee oid 0).
do $$
declare v_bad text;
begin
  select string_agg(p.proname, ', ' order by p.proname) into v_bad
    from pg_proc p, aclexplode(p.proacl) a
   where p.pronamespace = 'ops'::regnamespace and a.grantee = 0;
  perform pg_temp.rec('d5-public-holds-no-execute', v_bad is null,
    coalesce('PUBLIC still holds a privilege on: ' || v_bad,
             'no ops function grants anything to PUBLIC'));
exception when others then
  perform pg_temp.rec('d5-public-holds-no-execute', false, 'unexpected ' || sqlstate || ': ' || sqlerrm);
end
$$;

-- ops_executor may execute publish_checkpoint and NOTHING else in ops.
do $$
declare v_can text; v_ok boolean;
begin
  select string_agg(proname, ', ' order by proname),
         bool_and(proname = 'publish_checkpoint')
    into v_can, v_ok
    from pg_proc
   where pronamespace = 'ops'::regnamespace
     and has_function_privilege('ops_executor', oid, 'EXECUTE');
  perform pg_temp.rec('d5-executor-execute-scope',
    v_ok is true and v_can = 'publish_checkpoint',
    'ops_executor may EXECUTE: ' || coalesce(v_can, '<nothing>'));
exception when others then
  perform pg_temp.rec('d5-executor-execute-scope', false, 'unexpected ' || sqlstate || ': ' || sqlerrm);
end
$$;

-- "No table grants" IS the enforcement (D6). Assert it as a privilege fact,
-- not as an observed error message.
do $$
declare v_bad text;
begin
  select string_agg(t.tbl || '.' || t.priv, ', ' order by t.tbl, t.priv) into v_bad
    from (
      select tbl, priv
        from unnest(array['ops.run', 'ops.run_event']) tbl,
             unnest(array['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER']) priv
    ) t
   where has_table_privilege('ops_executor', t.tbl, t.priv);
  perform pg_temp.rec('d5-executor-no-table-grants', v_bad is null,
    coalesce('ops_executor unexpectedly holds: ' || v_bad,
             'ops_executor holds none of SELECT/INSERT/UPDATE/DELETE/TRUNCATE/REFERENCES/TRIGGER on ops.run or ops.run_event'));
exception when others then
  perform pg_temp.rec('d5-executor-no-table-grants', false, 'unexpected ' || sqlstate || ': ' || sqlerrm);
end
$$;

-- ===========================================================================
-- AC2 -- criterion 1, mechanically. NECESSARY AND NOT SUFFICIENT: a where
-- clause can name `generation` and still be incapable of rejecting on it.
-- The behavioural half is crit1-stale-generation-* below, and if
-- stale_generation is never observed criterion 1 is PARTIAL, not PASS.
-- ===========================================================================
do $$
declare
  v_def text; v_tail text; v_where text;
  v_updates int; v_where_ok boolean;
begin
  v_def := lower(pg_get_functiondef('ops.publish_checkpoint(text,integer,integer,jsonb)'::regprocedure));
  v_updates := (length(v_def) - length(replace(v_def, 'update ops.run', ''))) / length('update ops.run');
  v_tail  := substring(v_def from position('update ops.run' in v_def));
  v_where := substring(v_tail from position(' where ' in v_tail)
                       for position('returning' in v_tail) - position(' where ' in v_tail));
  v_where_ok := v_where like '%run_id%' and v_where like '%generation%' and v_where like '%version%';

  perform pg_temp.rec('ac2-single-update-cas',
    v_updates = 1 and v_where_ok,
    format('pg_get_functiondef: %s occurrence(s) of "update ops.run"; where clause names run_id/generation/version = %s; where = %L',
           v_updates, v_where_ok, regexp_replace(trim(v_where), '\s+', ' ', 'g')));
exception when others then
  perform pg_temp.rec('ac2-single-update-cas', false, 'unexpected ' || sqlstate || ': ' || sqlerrm);
end
$$;

-- ===========================================================================
-- Return shape (round 2, MINOR-R2-1 / negative 7b): no ops.run column beyond
-- the version reaches the caller. A security definer function that returned
-- the run row -- or capability_hash -- would hand the executor exactly the
-- read access negative #1 asserts it lacks, with the harness green.
-- ===========================================================================
do $$
declare v_out text[]; v_leak text[];
begin
  select array_agg(n order by i) into v_out
    from (
      select unnest(p.proargnames) as n, generate_subscripts(p.proargnames, 1) as i,
             unnest(p.proargmodes) as m
        from pg_proc p
       where p.oid = 'ops.publish_checkpoint(text,integer,integer,jsonb)'::regprocedure
    ) s
   where m = 't';

  select array_agg(a.attname order by a.attname) into v_leak
    from pg_attribute a
   where a.attrelid = 'ops.run'::regclass and a.attnum > 0 and not a.attisdropped
     and a.attname = any(v_out);

  perform pg_temp.rec('return-shape-publish-checkpoint',
    v_out = array['outcome', 'new_version'] and v_leak is null,
    format('OUT columns = %s; ops.run columns leaked = %s',
           coalesce(v_out::text, '<none>'), coalesce(v_leak::text, 'none')));
exception when others then
  perform pg_temp.rec('return-shape-publish-checkpoint', false, 'unexpected ' || sqlstate || ': ' || sqlerrm);
end
$$;

-- Coexistence with the real product schema (packet D1): the spike schema is
-- applied AFTER the 24 applicable product migrations, in the same database.
do $$
declare v_products int; v_ops int;
begin
  select count(*) into v_products from pg_tables where schemaname = 'public';
  select count(*) into v_ops      from pg_tables where schemaname = 'ops';
  perform pg_temp.rec('coexistence-product-schema',
    v_products > 0 and v_ops = 3
      and to_regclass('public.events') is not null
      and to_regclass('ops.run') is not null,
    format('public tables=%s, ops tables=%s, public.events=%s, ops.run=%s',
           v_products, v_ops, to_regclass('public.events'), to_regclass('ops.run')));
exception when others then
  perform pg_temp.rec('coexistence-product-schema', false, 'unexpected ' || sqlstate || ': ' || sqlerrm);
end
$$;

-- ===========================================================================
-- SCENARIO 1 -- the same Todo webhook delivered twice (criterion 2)
-- ===========================================================================
do $$
declare a record; b record; v_rows int;
begin
  select * into a from ops.reserve_run('GAM-407-S1', 'todo-event-s1');
  select * into b from ops.reserve_run('GAM-407-S1', 'todo-event-s1');
  select count(*) into v_rows from ops.run
   where issue_identifier = 'GAM-407-S1' and todo_event_id = 'todo-event-s1';

  perform pg_temp.rec('scenario-1',
    v_rows = 1
      and a.run_id = b.run_id
      and a.created is true and b.created is false
      and a.capability_token is not null and b.capability_token is null,
    format('rows=%s (want 1); run_id %s then %s (same=%s); created %s then %s; token issued %s then %s',
           v_rows, a.run_id, b.run_id, a.run_id = b.run_id, a.created, b.created,
           a.capability_token is not null, b.capability_token is not null));
exception when others then
  perform pg_temp.rec('scenario-1', false, 'unexpected ' || sqlstate || ': ' || sqlerrm);
end
$$;

-- ===========================================================================
-- CRITERION 1 -- the compare-and-set, in BOTH directions.
-- Every failure case is proved by RE-READING THE ROW. A non-matching UPDATE
-- reports UPDATE 0 rather than raising, so an absent exception proves nothing.
-- ===========================================================================

-- (a) a correct CAS succeeds.
do $$
declare a record; res record; r record;
begin
  select * into a from ops.reserve_run('GAM-407-C1A', 'todo-event-c1a');
  select * into res from ops.publish_checkpoint(a.capability_token,
    p_expected_generation => a.generation, p_expected_version => a.version,
    p_payload => '{"head_sha":"c1a-head","status":"checkpointed"}'::jsonb);
  select * into r from ops.run where run_id = a.run_id;

  perform pg_temp.rec('crit1-cas-ok',
    res.outcome = 'ok' and res.new_version = a.version + 1
      and r.version = a.version + 1 and r.generation = a.generation
      and r.head_sha = 'c1a-head' and r.result_refs ->> 'head_sha' = 'c1a-head',
    format('outcome=%s new_version=%s; row re-read: generation=%s version=%s head_sha=%s',
           res.outcome, res.new_version, r.generation, r.version, r.head_sha));
exception when others then
  perform pg_temp.rec('crit1-cas-ok', false, 'unexpected ' || sqlstate || ': ' || sqlerrm);
end
$$;

-- (b) a stale VERSION is rejected, and the row did not move.
do $$
declare a record; res record; before record; after record;
begin
  select * into a from ops.reserve_run('GAM-407-C1B', 'todo-event-c1b');
  perform * from ops.publish_checkpoint(a.capability_token,
    p_expected_generation => a.generation, p_expected_version => a.version,
    p_payload => '{"head_sha":"c1b-first"}'::jsonb);
  select * into before from ops.run where run_id = a.run_id;

  select * into res from ops.publish_checkpoint(a.capability_token,
    p_expected_generation => before.generation, p_expected_version => a.version,  -- stale: version 1, row is at 2
    p_payload => '{"head_sha":"c1b-STALE"}'::jsonb);
  select * into after from ops.run where run_id = a.run_id;

  perform pg_temp.rec('crit1-stale-version',
    res.outcome = 'version_conflict' and res.new_version is null
      and after.version = before.version and after.generation = before.generation
      and after.head_sha = before.head_sha and after.result_refs = before.result_refs
      and after.updated_at = before.updated_at,
    format('outcome=%s; re-read field-by-field: version %s->%s generation %s->%s head_sha %s->%s result_refs unchanged=%s updated_at unchanged=%s',
           res.outcome, before.version, after.version, before.generation, after.generation,
           before.head_sha, after.head_sha, after.result_refs = before.result_refs,
           after.updated_at = before.updated_at));
exception when others then
  perform pg_temp.rec('crit1-stale-version', false, 'unexpected ' || sqlstate || ': ' || sqlerrm);
end
$$;

-- (c) a stale GENERATION is rejected -- scenario 13 route (i), a stale BELIEF,
-- with the CURRENT token. This is the assertion that revision 4's tautological
-- signature could never produce. Both directions of mismatch are exercised.
do $$
declare a record; res_hi record; res_lo record; before record; after record;
begin
  select * into a from ops.reserve_run('GAM-407-C1C', 'todo-event-c1c');
  select * into before from ops.run where run_id = a.run_id;

  select * into res_hi from ops.publish_checkpoint(a.capability_token,
    p_expected_generation => before.generation + 1, p_expected_version => before.version,
    p_payload => '{"head_sha":"c1c-GEN-TOO-HIGH"}'::jsonb);
  select * into res_lo from ops.publish_checkpoint(a.capability_token,
    p_expected_generation => before.generation - 1, p_expected_version => before.version,
    p_payload => '{"head_sha":"c1c-GEN-TOO-LOW"}'::jsonb);

  select * into after from ops.run where run_id = a.run_id;

  perform pg_temp.rec('crit1-stale-generation',
    res_hi.outcome = 'stale_generation' and res_hi.new_version is null
      and res_lo.outcome = 'stale_generation' and res_lo.new_version is null
      and after.version = before.version and after.generation = before.generation
      and after.head_sha is not distinct from before.head_sha
      and after.result_refs = before.result_refs
      and after.updated_at = before.updated_at,
    format('row generation=%s; asserted %s -> %s; asserted %s -> %s; re-read: generation %s->%s version %s->%s head_sha %s row unchanged=%s',
           before.generation, before.generation + 1, res_hi.outcome,
           before.generation - 1, res_lo.outcome,
           before.generation, after.generation, before.version, after.version,
           coalesce(after.head_sha, '<null>'),
           after.updated_at = before.updated_at and after.result_refs = before.result_refs));
exception when others then
  perform pg_temp.rec('crit1-stale-generation', false, 'unexpected ' || sqlstate || ': ' || sqlerrm);
end
$$;

-- Explicit scenario-13 route (i) line, so the scenario is named in the output
-- as the acceptance criteria require.
do $$
declare a record; res record; before record; after record;
begin
  select * into a from ops.reserve_run('GAM-407-S13A', 'todo-event-s13a');
  select * into before from ops.run where run_id = a.run_id;
  select * into res from ops.publish_checkpoint(a.capability_token,
    p_expected_generation => before.generation + 5, p_expected_version => before.version,
    p_payload => '{"head_sha":"s13a-STALE-BELIEF"}'::jsonb);
  select * into after from ops.run where run_id = a.run_id;

  perform pg_temp.rec('scenario-13-route-i-stale-belief',
    res.outcome = 'stale_generation'
      and after.version = before.version and after.generation = before.generation
      and after.head_sha is not distinct from before.head_sha
      and after.result_refs = before.result_refs and after.updated_at = before.updated_at,
    format('current token + p_expected_generation=%s against row generation=%s -> %s; row re-read unchanged (version %s, generation %s, head_sha %s)',
           before.generation + 5, before.generation, res.outcome,
           after.version, after.generation, coalesce(after.head_sha, '<null>')));
exception when others then
  perform pg_temp.rec('scenario-13-route-i-stale-belief', false, 'unexpected ' || sqlstate || ': ' || sqlerrm);
end
$$;

-- (d) an unknown capability is rejected, and nothing moved.
do $$
declare a record; res record; before record; after record; v_forged text;
begin
  select * into a from ops.reserve_run('GAM-407-C1D', 'todo-event-c1d');
  select * into before from ops.run where run_id = a.run_id;
  v_forged := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');

  select * into res from ops.publish_checkpoint(v_forged,
    p_expected_generation => before.generation, p_expected_version => before.version,
    p_payload => '{"head_sha":"c1d-FORGED"}'::jsonb);
  select * into after from ops.run where run_id = a.run_id;

  perform pg_temp.rec('crit1-unknown-capability',
    res.outcome = 'no_such_capability' and res.new_version is null
      and after.version = before.version and after.generation = before.generation
      and after.head_sha is not distinct from before.head_sha
      and after.updated_at = before.updated_at,
    format('forged token -> %s; row re-read: version %s->%s generation %s->%s head_sha %s',
           res.outcome, before.version, after.version, before.generation, after.generation,
           coalesce(after.head_sha, '<null>')));
exception when others then
  perform pg_temp.rec('crit1-unknown-capability', false, 'unexpected ' || sqlstate || ': ' || sqlerrm);
end
$$;

-- ===========================================================================
-- SCENARIO 13 route (ii) -- generation fencing by HASH ROTATION.
-- advance_generation rotates capability_hash, so the paused executor's old
-- token no longer resolves at all: it fails closed as no_such_capability.
-- ===========================================================================
do $$
declare a record; adv record; stale record; fresh record; before record; after record; final record;
begin
  select * into a from ops.reserve_run('GAM-407-S13B', 'todo-event-s13b');
  perform * from ops.publish_checkpoint(a.capability_token,
    p_expected_generation => a.generation, p_expected_version => a.version,
    p_payload => '{"head_sha":"s13b-work","status":"checkpointed"}'::jsonb);
  select * into before from ops.run where run_id = a.run_id;

  -- The controller fences the paused executor.
  select * into adv from ops.advance_generation(a.run_id, before.version);
  select * into after from ops.run where run_id = a.run_id;

  -- The paused executor wakes up and replays with its OLD token.
  select * into stale from ops.publish_checkpoint(a.capability_token,
    p_expected_generation => after.generation, p_expected_version => after.version,
    p_payload => '{"head_sha":"s13b-ZOMBIE"}'::jsonb);
  select * into final from ops.run where run_id = a.run_id;

  -- ...and the NEW token still works, so this is fencing rather than breakage.
  select * into fresh from ops.publish_checkpoint(adv.capability_token,
    p_expected_generation => after.generation, p_expected_version => after.version,
    p_payload => '{"head_sha":"s13b-new-executor"}'::jsonb);

  perform pg_temp.rec('scenario-13-route-ii-fencing',
    adv.outcome = 'ok'
      and after.generation = before.generation + 1
      and after.capability_hash <> before.capability_hash
      and stale.outcome = 'no_such_capability' and stale.new_version is null
      and final.generation = after.generation and final.version = after.version
      and final.head_sha = after.head_sha and final.result_refs = after.result_refs
      and final.updated_at = after.updated_at
      and fresh.outcome = 'ok',
    format('advance_generation -> %s (generation %s->%s, capability_hash rotated=%s); OLD token replay -> %s; row re-read field-by-field unchanged (generation %s, version %s, head_sha %s, result_refs unchanged=%s, updated_at unchanged=%s); NEW token -> %s',
           adv.outcome, before.generation, after.generation,
           after.capability_hash <> before.capability_hash, stale.outcome,
           final.generation, final.version, final.head_sha,
           final.result_refs = after.result_refs, final.updated_at = after.updated_at,
           fresh.outcome));
exception when others then
  perform pg_temp.rec('scenario-13-route-ii-fencing', false, 'unexpected ' || sqlstate || ': ' || sqlerrm);
end
$$;

-- ===========================================================================
-- SCENARIO 14 -- the same terminal event delivered twice, ONE effect.
-- ===========================================================================
do $$
declare a record; first record; second record; before record; after record; v_events int;
begin
  select * into a from ops.reserve_run('GAM-407-S14', 'todo-event-s14');
  select * into before from ops.run where run_id = a.run_id;

  select * into first  from ops.record_terminal_event(a.run_id, 'terminal-1',
    '{"event_type":"run_failed","failure_class":"executor_died","failure_detail":"lease expired","phase":"execute"}'::jsonb);
  select * into second from ops.record_terminal_event(a.run_id, 'terminal-1',
    '{"event_type":"run_failed","failure_class":"executor_died","failure_detail":"lease expired","phase":"execute"}'::jsonb);

  select count(*) into v_events from ops.run_event where run_id = a.run_id and event_key = 'terminal-1';
  select * into after from ops.run where run_id = a.run_id;

  perform pg_temp.rec('scenario-14',
    first.outcome = 'recorded' and second.outcome = 'duplicate'
      and v_events = 1 and second.event_count = 1
      and after.status = 'terminal' and after.failure_class = 'executor_died'
      and after.version = before.version + 1,
    format('outcomes %s then %s; ops.run_event rows for (run,event_key) = %s; ops.run: status=%s failure_class=%s version %s->%s (exactly one effect = %s)',
           first.outcome, second.outcome, v_events, after.status, after.failure_class,
           before.version, after.version, after.version = before.version + 1));
exception when others then
  perform pg_temp.rec('scenario-14', false, 'unexpected ' || sqlstate || ': ' || sqlerrm);
end
$$;

-- ===========================================================================
-- D2a precondition -- the negative control's rig. The forgery itself must be
-- performed from a direct ops_executor login and is asserted by the driver.
-- ===========================================================================
do $$
declare v_enabled boolean; v_forced boolean; v_rows int; v_sel boolean; v_upd boolean;
begin
  select relrowsecurity, relforcerowsecurity into v_enabled, v_forced
    from pg_class where oid = 'ops.rejected_claims_keyed_run'::regclass;
  select count(*) into v_rows from ops.rejected_claims_keyed_run;
  v_sel := has_table_privilege('ops_executor', 'ops.rejected_claims_keyed_run', 'SELECT');
  v_upd := has_table_privilege('ops_executor', 'ops.rejected_claims_keyed_run', 'UPDATE');

  perform pg_temp.rec('d2a-precondition',
    v_enabled and v_forced and v_rows = 2 and v_sel and v_upd,
    format('rowsecurity=%s force=%s seeded rows=%s (seeded BEFORE force, per MINOR-R2-3); executor select=%s update=%s',
           v_enabled, v_forced, v_rows, v_sel, v_upd));
exception when others then
  perform pg_temp.rec('d2a-precondition', false, 'unexpected ' || sqlstate || ': ' || sqlerrm);
end
$$;

-- ===========================================================================
-- Report
-- ===========================================================================
select case when ok then 'PASS ' else 'FAIL ' end || label || ' :: ' || detail
       || case when :'qual' = '' then '' else ' ' || :'qual' end
  from gam407_result
 order by seq;
