-- T205 anon/authenticated grant assertions, following the T195 precedent
-- (`calendar_feed_lifecycle_assertions.sql`). Security-sensitive operations
-- explicitly SET ROLE anon/authenticated; setup and postcondition
-- inspection run as the connecting superuser.
--
-- Paired, not absence-only: the base-table read is a genuine RLS-driven
-- control, not a structural guarantee (see acceptance criterion 4 in the
-- T205 worker packet -- adding a permissive anon policy on `students` must
-- turn it red).
--
-- HONEST LIMIT on the row-count guards that follow each write-path check
-- (T205 checker, MINOR-1, proven not asserted): they do NOT prove this
-- statement's own DELETE left the data alone. The DELETE and the follow-on
-- count sit in the same `DO` block, so PL/pgSQL rolls the DELETE back before
-- the count runs -- the count reads unchanged whatever the DELETE did. They
-- remain useful as a guard against data loss committed by some OTHER source,
-- and that is all they are claimed to be here. What actually proves the
-- write path is shut is the mutation evidence: replacing `revoke all` with
-- `revoke select` turns `anon-delete-denied` red, and deleting the migration's
-- `authenticated` line turns `authenticated-delete-denied` red. Both were run
-- by the worker, the orchestrator and the checker independently.

-- ---------------------------------------------------------------------------
-- Fixture: one team, one ACTIVE student (visible through the view), one
-- INACTIVE student (must stay invisible through the view, per
-- `20260731000000_leaderboard_students_view.sql`'s own `where is_active`),
-- and one non-staff `authenticated` profile to exercise the "plain
-- logged-in session" threat model line 2 of the migration closes.
-- ---------------------------------------------------------------------------
insert into public.teams (id, name, short_name, color)
values ('a0000000-0000-4000-8000-00000000a001', 'T205 Fixture Team', 'T205', '#000000');

insert into public.students (id, display_name, team_id, is_active)
values
  ('b0000000-0000-4000-8000-00000000b001', 'T205 Active Student', 'a0000000-0000-4000-8000-00000000a001', true),
  ('b0000000-0000-4000-8000-00000000b002', 'T205 Inactive Student', 'a0000000-0000-4000-8000-00000000a001', false);

insert into auth.users (id, email)
values ('c0000000-0000-4000-8000-00000000c001', 'nonstaff.fixture@example.test');

insert into public.profiles (id, display_name, email, role, avatar_url)
values (
  'c0000000-0000-4000-8000-00000000c001',
  'T205 Non-Staff Fixture',
  'nonstaff.fixture@example.test',
  'parent',
  ''
);

-- ---------------------------------------------------------------------------
-- Assertion 1: `anon` SELECT on the view is denied.
-- ---------------------------------------------------------------------------
set role anon;
select set_config('request.jwt.claim.sub', '', false);
do $$
declare
  v_count integer;
  v_denied boolean := false;
begin
  begin
    select count(*) into v_count from public.v_leaderboard_students;
  exception
    when insufficient_privilege then
      v_denied := true;
  end;

  if not v_denied then
    raise exception 'FAIL anon-select-denied: anon read % row(s)', v_count;
  end if;
  raise notice 'PASS anon-select-denied';
end;
$$;
reset role;

-- ---------------------------------------------------------------------------
-- Assertion 2: `authenticated` SELECT still returns the active row (and only
-- the active row -- the view's own `is_active` filter, unmodified by T205).
-- ---------------------------------------------------------------------------
set role authenticated;
select set_config('request.jwt.claim.sub', 'c0000000-0000-4000-8000-00000000c001', false);
do $$
declare
  v_count integer;
begin
  select count(*) into v_count from public.v_leaderboard_students;

  if v_count <> 1 then
    raise exception 'FAIL authenticated-select-active: expected 1 row, got %', v_count;
  end if;

  if not exists (
    select 1 from public.v_leaderboard_students
    where id = 'b0000000-0000-4000-8000-00000000b001'
  ) then
    raise exception 'FAIL authenticated-select-active: active row not returned';
  end if;
  raise notice 'PASS authenticated-select-active';
end;
$$;
reset role;

-- ---------------------------------------------------------------------------
-- Assertion 3 (paired write-path assertion, both callers): neither `anon`
-- nor a plain logged-in non-staff `authenticated` caller can write through
-- the view, and `students` is untouched by either attempt. This is the
-- BLOCKER's own regression test -- an unqualified DELETE needs no SELECT
-- privilege, so it is checked independently of assertion 1.
-- ---------------------------------------------------------------------------
set role anon;
select set_config('request.jwt.claim.sub', '', false);
do $$
declare
  v_denied boolean := false;
begin
  begin
    delete from public.v_leaderboard_students;
  exception
    when insufficient_privilege then
      v_denied := true;
  end;

  if not v_denied then
    raise exception 'FAIL anon-delete-denied: unauthenticated DELETE via view succeeded';
  end if;
  raise notice 'PASS anon-delete-denied';
end;
$$;
reset role;

do $$
declare
  v_count integer;
begin
  select count(*) into v_count from public.students;
  if v_count <> 2 then
    raise exception 'FAIL anon-delete-denied: students row count changed to %', v_count;
  end if;
end;
$$;

set role authenticated;
select set_config('request.jwt.claim.sub', 'c0000000-0000-4000-8000-00000000c001', false);
do $$
declare
  v_denied boolean := false;
begin
  begin
    delete from public.v_leaderboard_students;
  exception
    when insufficient_privilege then
      v_denied := true;
  end;

  if not v_denied then
    raise exception 'FAIL authenticated-delete-denied: logged-in non-staff DELETE via view succeeded';
  end if;
  raise notice 'PASS authenticated-delete-denied';
end;
$$;
reset role;

do $$
declare
  v_count integer;
begin
  select count(*) into v_count from public.students;
  if v_count <> 2 then
    raise exception 'FAIL authenticated-delete-denied: students row count changed to %', v_count;
  end if;
  raise notice 'PASS write-path-denied (students table untouched by either caller)';
end;
$$;

-- ---------------------------------------------------------------------------
-- Assertion 4: base-table control. `anon` reading `public.students` directly
-- still returns 0 rows -- proves this is a view-grant question and that RLS
-- on the base table is intact, the same distinction T158's checker drew.
-- This is a genuine RLS-driven control (mutation-sensitive): `students` has
-- no anon-facing policy, so this must go to 0 rows only because of that
-- absence, not because anon lacks a table-level grant.
-- ---------------------------------------------------------------------------
set role anon;
select set_config('request.jwt.claim.sub', '', false);
do $$
declare
  v_count integer;
begin
  select count(*) into v_count from public.students;
  if v_count <> 0 then
    raise exception 'FAIL anon-base-table-control: anon read % row(s) directly from students', v_count;
  end if;
  raise notice 'PASS anon-base-table-control';
end;
$$;
reset role;

do $$
begin
  raise notice 'T205 anon/authenticated grant tests: ALL PASS';
end;
$$;
