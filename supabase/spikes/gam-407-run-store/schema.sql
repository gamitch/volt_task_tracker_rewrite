-- GAM-407 -- bounded spike: is Supabase/PostgreSQL a viable operational run store?
--
-- THIS FILE IS NOT A MIGRATION AND MUST NOT BECOME ONE (packet D1).
-- It deliberately lives under supabase/spikes/, not supabase/migrations/.
-- supabase/migrations/ is the chain the owner applies to the hosted project; a
-- file there IS production. The spike harness applies this file explicitly,
-- AFTER the product migrations, so coexistence with the real product schema is
-- still proven. Phase 2 proper builds the production run store.
--
-- Applied by: supabase/tests/run_gam407_run_store_spike.sh
-- Pinned major: PostgreSQL 17 (harness measures 17.11; live server is
-- 17.6.1.141 -- same major, different minor).
--
-- Self-contained: NO extension is required. Randomness is gen_random_uuid()
-- (built-in, PG 13+) and hashing is sha256(bytea) (built-in, PG 11+).
-- gen_random_bytes is DELIBERATELY NOT USED: it is pgcrypto, which is absent on
-- the scratch cluster and present on the hosted project -- exactly the
-- local-red / hosted-green asymmetry this schema exists to avoid (packet,
-- "Required behavior", round 4 MINOR-3).
--
-- Additive and idempotent: safe to re-apply to the same database.

\set ON_ERROR_STOP on

-- ---------------------------------------------------------------------------
-- Roles (packet D3, D5, D7)
-- ---------------------------------------------------------------------------
-- ops_owner   : owns the schema, every table and every function.
--               NOSUPERUSER NOBYPASSRLS is load-bearing (D3): a security
--               definer function owned by a BYPASSRLS role runs with RLS off,
--               which would make every criterion-3 assertion vacuous.
-- ops_executor: the untrusted executor. LOGIN (D7) -- SET ROLE is authorized
--               against session_user, not current_user, so the harness must
--               measure the negatives from a direct login, never from
--               `set role` inside a postgres session.
--
-- The password is a SCRATCH-CLUSTER-ONLY literal. It guards nothing: the
-- scratch cluster's pg_hba.conf is `local all all trust` and accepts any
-- password. Its purpose is portability (AC13) -- a TCP/scram-sha-256 server
-- would reject a passwordless ops_executor and criterion 3's negatives would
-- not run at all. It is never used against a live endpoint.
do $$
begin
  if not exists (select 1 from pg_catalog.pg_roles where rolname = 'ops_owner') then
    create role ops_owner nologin nosuperuser nobypassrls;
  end if;
  if not exists (select 1 from pg_catalog.pg_roles where rolname = 'ops_executor') then
    create role ops_executor login nosuperuser nobypassrls;
  end if;
end
$$;

alter role ops_owner    nologin nosuperuser nobypassrls;
alter role ops_executor login   nosuperuser nobypassrls;
alter role ops_executor password 'gam407_spike_scratch_only';

-- ---------------------------------------------------------------------------
-- Schema
-- ---------------------------------------------------------------------------
create schema if not exists ops authorization ops_owner;
alter schema ops owner to ops_owner;

-- Everything below is created BY ops_owner, so ownership is a property of how
-- the objects were made rather than an afterthought an `alter ... owner` could
-- miss. `create ... if not exists` keeps re-application additive.
set role ops_owner;

-- ---------------------------------------------------------------------------
-- ops.run -- the plan section 5.1 fields the five criteria exercise
-- ---------------------------------------------------------------------------
-- NO ROW LEVEL SECURITY on this table, deliberately (packet D6). Measured:
-- with a NOBYPASSRLS owner and a claims-keyed policy, forced RLS makes
-- reserve_run unable to insert at all (42501, "new row violates row-level
-- security policy"), so no run can ever be created and every scenario becomes
-- unreachable. And RLS buys nothing here: ops_executor holds NO table grants,
-- so the privilege check denies it before any policy is consulted. "No table
-- grants" is the enforcement, and it is stronger and simpler than "RLS plus no
-- table grants". RLS appears only on the D2a negative-control table below.
create table if not exists ops.run (
  run_id             uuid primary key default gen_random_uuid(),
  issue_identifier   text not null,
  todo_event_id      text not null,
  todo_at            timestamptz,
  version            integer not null default 1,
  generation         integer not null default 1,
  status             text not null,
  phase              text,
  pipeline_version   text,
  constitution_sha   text,
  branch             text,
  base_sha           text,
  head_sha           text,
  active_executor    text,
  required_next_role text,
  result_refs        jsonb not null default '{}'::jsonb,
  -- Only the sha256 hex of the capability token is ever stored. The plaintext
  -- is returned exactly once, by the reserve_run call that created the run.
  capability_hash    text,
  failure_class      text,
  failure_detail     text,
  reserved_at        timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  -- Criterion 2 lives here. This constraint is what makes duplicate-webhook
  -- idempotency a property of the DATABASE rather than of the caller.
  constraint run_issue_todo_event_key unique (issue_identifier, todo_event_id)
);

create index if not exists run_capability_hash_idx on ops.run (capability_hash);

-- ---------------------------------------------------------------------------
-- ops.run_event -- scenario 14 (a table, not a view)
-- ---------------------------------------------------------------------------
create table if not exists ops.run_event (
  event_id    uuid primary key default gen_random_uuid(),
  run_id      uuid not null references ops.run (run_id) on delete cascade,
  event_key   text not null,
  event_type  text,
  payload     jsonb not null default '{}'::jsonb,
  recorded_at timestamptz not null default now(),
  constraint run_event_run_key unique (run_id, event_key)
);

-- ---------------------------------------------------------------------------
-- ops.reserve_run -- criterion 2, scenarios 1 and 2
-- ---------------------------------------------------------------------------
-- Create-or-return, atomically. NOT granted to ops_executor (D5).
-- The `on conflict do nothing` speculative insert is the whole mechanism: a
-- concurrent loser blocks on the winner's speculative-insert token by itself,
-- with no advisory-lock barrier, and then reads the winner's row back.
create or replace function ops.reserve_run(
  p_issue          text,
  p_todo_event_id  text
)
returns table (
  run_id           uuid,
  created          boolean,
  capability_token text,
  generation       integer,
  version          integer
)
language plpgsql
security definer
set search_path = ops, pg_catalog
as $$
declare
  v_token text;
  v_run   ops.run%rowtype;
begin
  -- 244 bits from two concatenated UUIDs. NOT gen_random_bytes (pgcrypto).
  v_token := replace(gen_random_uuid()::text, '-', '')
          || replace(gen_random_uuid()::text, '-', '');

  insert into ops.run (
    issue_identifier, todo_event_id, status, capability_hash
  )
  values (
    p_issue, p_todo_event_id, 'reserved', encode(sha256(v_token::bytea), 'hex')
  )
  on conflict (issue_identifier, todo_event_id) do nothing
  returning * into v_run;

  if found then
    run_id           := v_run.run_id;
    created          := true;
    capability_token := v_token;   -- returned once, and only to the creator
    generation       := v_run.generation;
    version          := v_run.version;
    return next;
    return;
  end if;

  -- Duplicate delivery: return the existing record, create nothing, and hand
  -- back NO token (the plaintext is unrecoverable by construction).
  select * into v_run
    from ops.run r
   where r.issue_identifier = p_issue
     and r.todo_event_id    = p_todo_event_id;

  run_id           := v_run.run_id;
  created          := false;
  capability_token := null;
  generation       := v_run.generation;
  version          := v_run.version;
  return next;
end;
$$;

-- ---------------------------------------------------------------------------
-- ops.publish_checkpoint -- criterion 3's capability AND criterion 1's CAS
-- ---------------------------------------------------------------------------
-- The ONLY function ops_executor may execute.
--
-- p_expected_generation is the CALLER'S ASSERTED VALUE, not the row's. Deriving
-- the generation from the row the update then filters on is tautological and
-- can never reject -- measured, and it makes criterion 1 untestable (round 3,
-- MAJOR-R3-1). The executor must assert the generation it believes it holds,
-- exactly as it already asserts the version.
--
-- Only run_id is derived from the token.
--
-- Return shape is pinned to (outcome text, new_version int) and NOTHING more
-- (round 2, MINOR-R2-1): returning the run row -- or capability_hash -- would
-- hand the executor exactly the read access criterion 3 negative #1 asserts it
-- lacks, with the harness green.
create or replace function ops.publish_checkpoint(
  p_token               text,
  p_expected_generation integer,
  p_expected_version    integer,
  p_payload             jsonb
)
returns table (
  outcome     text,
  new_version integer
)
language plpgsql
security definer
set search_path = ops, pg_catalog
as $$
declare
  v_hash        text;
  v_run_id      uuid;
  v_rows        integer;
  v_new_version integer;
  v_gen_matches boolean;
begin
  v_hash := encode(sha256(coalesce(p_token, '')::bytea), 'hex');

  select r.run_id into v_run_id
    from ops.run r
   where r.capability_hash = v_hash;

  if v_run_id is null then
    -- Unknown or rotated token. This is also scenario 13 route (ii): after
    -- advance_generation rotates capability_hash the paused executor's old
    -- token no longer resolves at all, so it fails closed.
    outcome     := 'no_such_capability';
    new_version := null;
    return next;
    return;
  end if;

  -- CRITERION 1: exactly ONE update statement, whose where clause validates
  -- run_id, generation and version TOGETHER. There is no `select ... for
  -- update` preamble deciding this update.
  update ops.run r
     set version     = r.version + 1,
         result_refs = coalesce(p_payload, '{}'::jsonb),
         head_sha    = coalesce(p_payload ->> 'head_sha', r.head_sha),
         status      = coalesce(p_payload ->> 'status',   r.status),
         phase       = coalesce(p_payload ->> 'phase',    r.phase),
         updated_at  = now()
   where r.run_id     = v_run_id
     and r.generation = p_expected_generation
     and r.version    = p_expected_version
  returning r.version into v_new_version;

  get diagnostics v_rows = row_count;

  if v_rows = 1 then
    outcome     := 'ok';
    new_version := v_new_version;
    return next;
    return;
  end if;

  -- A zero-row CAS cannot self-classify (round 1, NIT-1). One POST-FAILURE
  -- classifying select -- explicitly not the read-then-write criterion 1
  -- forbids, which is a read that DECIDES the write.
  select (r.generation = p_expected_generation) into v_gen_matches
    from ops.run r
   where r.run_id = v_run_id;

  if v_gen_matches is distinct from true then
    outcome := 'stale_generation';   -- scenario 13 route (i): a stale BELIEF
  else
    outcome := 'version_conflict';
  end if;
  new_version := null;
  return next;
end;
$$;

-- ---------------------------------------------------------------------------
-- ops.advance_generation -- fencing (plan section 5.2, scenario 13 route ii)
-- ---------------------------------------------------------------------------
-- Bumps generation AND ROTATES capability_hash, so a paused executor's old
-- token fails closed. NOT granted to ops_executor (D5).
create or replace function ops.advance_generation(
  p_run_id           uuid,
  p_expected_version integer
)
returns table (
  outcome          text,
  new_generation   integer,
  new_version      integer,
  capability_token text
)
language plpgsql
security definer
set search_path = ops, pg_catalog
as $$
declare
  v_token text;
  v_rows  integer;
  v_gen   integer;
  v_ver   integer;
begin
  v_token := replace(gen_random_uuid()::text, '-', '')
          || replace(gen_random_uuid()::text, '-', '');

  update ops.run r
     set generation      = r.generation + 1,
         version         = r.version + 1,
         capability_hash = encode(sha256(v_token::bytea), 'hex'),
         active_executor = null,
         updated_at      = now()
   where r.run_id  = p_run_id
     and r.version = p_expected_version
  returning r.generation, r.version into v_gen, v_ver;

  get diagnostics v_rows = row_count;

  if v_rows = 1 then
    outcome          := 'ok';
    new_generation   := v_gen;
    new_version      := v_ver;
    capability_token := v_token;
    return next;
    return;
  end if;

  if not exists (select 1 from ops.run r where r.run_id = p_run_id) then
    outcome := 'no_such_run';
  else
    outcome := 'version_conflict';
  end if;
  new_generation   := null;
  new_version      := null;
  capability_token := null;
  return next;
end;
$$;

-- ---------------------------------------------------------------------------
-- ops.record_terminal_event -- scenario 14
-- ---------------------------------------------------------------------------
-- Idempotent on (run_id, event_key): the same terminal event delivered twice
-- yields ONE ops.run_event row and ONE effect on ops.run.
-- NOT granted to ops_executor (D5).
create or replace function ops.record_terminal_event(
  p_run_id    uuid,
  p_event_key text,
  p_payload   jsonb
)
returns table (
  outcome     text,
  event_count integer
)
language plpgsql
security definer
set search_path = ops, pg_catalog
as $$
declare
  v_rows  integer;
  v_count integer;
begin
  insert into ops.run_event (run_id, event_key, event_type, payload)
  values (p_run_id, p_event_key, coalesce(p_payload ->> 'event_type', 'terminal'),
          coalesce(p_payload, '{}'::jsonb))
  on conflict (run_id, event_key) do nothing;

  get diagnostics v_rows = row_count;

  if v_rows = 1 then
    update ops.run r
       set status         = 'terminal',
           phase          = coalesce(p_payload ->> 'phase', r.phase),
           failure_class  = p_payload ->> 'failure_class',
           failure_detail = p_payload ->> 'failure_detail',
           version        = r.version + 1,
           updated_at     = now()
     where r.run_id = p_run_id;
    outcome := 'recorded';
  else
    outcome := 'duplicate';
  end if;

  select count(*)::integer into v_count
    from ops.run_event e
   where e.run_id = p_run_id;

  event_count := v_count;
  return next;
end;
$$;

-- ---------------------------------------------------------------------------
-- D2a -- NEGATIVE CONTROL. This is the REJECTED design, kept so the finding is
-- a standing, re-runnable fact rather than prose.
-- ---------------------------------------------------------------------------
-- request.jwt.claims is an unrecognised two-part custom GUC and is therefore
-- USERSET. A NOSUPERUSER NOBYPASSRLS role can re-set its own claim to another
-- run's id and move that row, and `revoke set on parameter` does not restrain
-- it (re-measured on 17.11). The harness asserts the forgery SUCCEEDS.
--
-- The rows are seeded BEFORE `force row level security` is applied (round 2,
-- MINOR-R2-3); otherwise the seed hits the same insert deadlock D6 describes
-- and the control never gets off the ground. The disable/enable dance also
-- makes re-application idempotent.
--
-- nullif(current_setting(..., true), '')::jsonb, not the bare form: on an
-- empty GUC the bare cast raises `invalid input syntax for type json`, which
-- would make an exception-catching assertion pass while proving nothing
-- (round 1, MINOR-4).
create table if not exists ops.rejected_claims_keyed_run (
  run_ref text primary key,
  marker  text not null
);

alter table ops.rejected_claims_keyed_run disable row level security;

insert into ops.rejected_claims_keyed_run (run_ref, marker)
values ('r1', 'OK'), ('r2', 'OK')
on conflict (run_ref) do update set marker = excluded.marker;

alter table ops.rejected_claims_keyed_run enable row level security;
alter table ops.rejected_claims_keyed_run force  row level security;

drop policy if exists claims_keyed_scope on ops.rejected_claims_keyed_run;
create policy claims_keyed_scope on ops.rejected_claims_keyed_run
  for all
  using      (run_ref = nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'run_id')
  with check (run_ref = nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'run_id');

-- ---------------------------------------------------------------------------
-- Grants (packet D5) -- PUBLIC is revoked FIRST, then one explicit grant.
-- ---------------------------------------------------------------------------
-- PostgreSQL grants EXECUTE on every new function to PUBLIC by default. Not
-- granting is NOT the same as denying: measured, an executor called reserve_run,
-- then advance_generation on ANOTHER run, was handed that run's freshly-rotated
-- plaintext token, and published to it. These revokes are load-bearing.
--
-- A null proacl means the PostgreSQL default is in force, i.e. EXECUTE TO
-- PUBLIC. The harness asserts proacl is non-null for every ops function.
revoke execute on function ops.reserve_run(text, text)                  from public;
revoke execute on function ops.advance_generation(uuid, integer)        from public;
revoke execute on function ops.record_terminal_event(uuid, text, jsonb) from public;
revoke execute on function ops.publish_checkpoint(text, integer, integer, jsonb) from public;

grant  execute on function ops.publish_checkpoint(text, integer, integer, jsonb) to ops_executor;

-- ops_executor gets USAGE on the schema (without it the one granted function
-- is unreachable) and NO TABLE PRIVILEGES WHATSOEVER on ops.run/ops.run_event.
grant usage on schema ops to ops_executor;

-- ...except on the D2a negative control, which exists precisely to be broken.
grant select, update on ops.rejected_claims_keyed_run to ops_executor;

reset role;
