-- T020 NFR-02 RLS-denial test scaffolding (NOT a migration, NOT applied to any
-- real Supabase project, NOT a modification of `supabase/tests/auth_stub.sql`
-- -- that file is a read-only reference precedent per this task's packet; this
-- is a separate, disclosed copy under this task's own `tests/rls/**` allowed
-- directory, extended for what this task specifically needs).
--
-- A bare local/scratch Postgres instance does not provide the `auth` schema
-- (auth.users, auth.uid()) the real Supabase platform provides managed. This
-- stub supplies just enough of that schema for:
--   - `supabase/migrations/*.sql` to apply cleanly against a scratch database
--     (public.profiles.id references auth.users(id); fn_audit_*() trigger
--     functions and auth_role()/is_staff()/my_student_ids() all call
--     auth.uid(); T019's 20260718000000_invite_trigger.sql additionally
--     requires auth.users.email_confirmed_at, auth.users.last_sign_in_at, and
--     auth.users.raw_user_meta_data to exist -- NOT present in
--     `supabase/tests/auth_stub.sql`'s narrower id/email-only stub, because
--     that file predates T019. This file's auth.users therefore carries a
--     wider column set than that read-only reference precedent, disclosed
--     here explicitly rather than silently copied.)
--   - THIS task's own scenario tests to impersonate a *specific* authenticated
--     `auth.uid()` value per session (unlike `supabase/tests/auth_stub.sql`'s
--     `auth.uid()`, which is a fixed NULL-returning stub -- sufficient for
--     that suite's superuser-only, RLS-bypassing metric-view checks, but not
--     for this task, which specifically needs `auth.uid()` to resolve to a
--     real, distinct, non-null value per impersonated session).
--
-- This file does not touch, redefine, or reimplement any RLS policy,
-- migration table, or trigger function -- it only stands in for
-- infrastructure the real Supabase platform normally provides.
create schema if not exists auth;
grant usage on schema auth to public;

create table if not exists auth.users (
  id uuid primary key default gen_random_uuid(),
  email text,
  encrypted_password text,
  email_confirmed_at timestamptz,
  last_sign_in_at timestamptz,
  raw_user_meta_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- auth.uid() resolution strategy for THIS suite: reads the Postgres custom
-- GUC `request.jwt.claim.sub` (a placeholder-class variable name -- any
-- "namespace.variable"-shaped setting can be SET/read without prior
-- declaration since Postgres 9.2), which each scenario in
-- `tests/rls/assertions.sql` sets via `SET LOCAL request.jwt.claim.sub = ...`
-- immediately after `SET LOCAL ROLE authenticated` and before running its
-- SELECTs, then discards via `ROLLBACK` at the end of that scenario's
-- transaction. This mirrors Supabase's real `auth.uid()` (which resolves the
-- caller's JWT `sub` claim) closely enough for this suite's purpose: proving
-- that `auth.uid()` resolves to a real, non-null value for an authenticated
-- session that nonetheless has no matching `profiles` row.
create or replace function auth.uid() returns uuid
language sql stable
as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;

grant execute on function auth.uid() to public;

-- Table-level grants mimicking the real Supabase platform's default schema
-- grants (Supabase grants SELECT/INSERT/UPDATE/DELETE on every `public`
-- table to `anon`/`authenticated`/`service_role` by default; RLS policies
-- are what actually narrow visibility from there -- table-level GRANTs alone
-- do not bypass RLS). Without this, every query below would fail with a
-- Postgres "permission denied for table ..." error before RLS is even
-- evaluated, which would be a false negative for this suite's purpose (it
-- must prove *zero rows*, not merely *an error*). `anon`/`authenticated`/
-- `service_role` already exist as roles in this scratch environment
-- (confirmed directly: `select rolname from pg_roles where rolname in
-- ('anon','authenticated','service_role')` returns all three) -- this file
-- does not create those roles, only grants against them.
--
-- Deferred to run.sh, AFTER the migrations create the actual tables (a GRANT
-- ... ON ALL TABLES IN SCHEMA public here, before any table exists, would
-- grant nothing) -- see `tests/rls/grants.sql`.
