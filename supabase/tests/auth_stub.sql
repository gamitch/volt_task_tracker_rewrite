-- T014 test scaffolding (NOT a migration, NOT applied to any real Supabase
-- project). Real Supabase projects provide the `auth` schema (auth.users,
-- auth.uid()) via the managed platform; a bare local/scratch Postgres
-- instance does not. This stub supplies just enough of that schema for the
-- five files under supabase/migrations/ to apply cleanly against a scratch
-- database:
--   - public.profiles.id references auth.users(id)            (T009)
--   - fn_audit_*() trigger functions call auth.uid()           (T011)
--   - auth_role()/is_staff()/my_student_ids() call auth.uid()  (T012)
-- This file does not touch, redefine, or reimplement any RLS policy or
-- metric-view formula -- it only stands in for infrastructure the real
-- Supabase platform normally provides, the same role the Supabase CLI's
-- local dev stack plays for T009-T013's own scratch-Postgres validation.
create schema if not exists auth;

-- T701 -- this stub declared only `id`/`email`, which was enough when it was
-- written and stopped being enough once `20260718000000_invite_trigger.sql`
-- began referencing `new.email_confirmed_at` / `old.email_confirmed_at` /
-- `new.last_sign_in_at` / `old.last_sign_in_at` / `new.raw_user_meta_data`.
-- The trigger body is only parsed when the migration applies, so the suite
-- failed at apply time with `column old.email_confirmed_at does not exist`
-- and never reached a single assertion. The columns below are exactly the
-- set that migration touches -- not a guess at Supabase's real table, and
-- deliberately no wider than what is referenced.
create table if not exists auth.users (
  id uuid primary key default gen_random_uuid(),
  email text,
  email_confirmed_at timestamptz,
  last_sign_in_at timestamptz,
  raw_user_meta_data jsonb default '{}'::jsonb
);

-- Every command in this test suite runs as the Postgres superuser (which
-- bypasses RLS entirely), so no session here ever needs auth.uid() to
-- resolve to a real value to exercise v_student_hours / v_student_participation
-- / v_team_participation -- a stable NULL-returning stub is sufficient to
-- satisfy the function-existence dependency at migration-apply time.
create or replace function auth.uid() returns uuid
language sql stable
as $$ select null::uuid $$;
