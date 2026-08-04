-- T503 acceptance assertions C1/C2/C3, run AFTER the widening migration is
-- applied. Fixture: `t503_widen_rsvp_read_fixture.sql` (Team A: Student
-- One/Two; unrelated Team B: Student Four).
--
-- Security-sensitive operations explicitly SET ROLE anon/authenticated;
-- setup and postcondition inspection run as the connecting superuser, the
-- T205 precedent (`t205_anon_grant_assertions.sql`).
--
-- HONEST LIMIT, same shape T205's own header discloses: assertion 3's
-- follow-on row-unchanged check does NOT prove this statement's own UPDATE
-- left the row alone by itself -- an `UPDATE 0` already proves that
-- directly (0 rows matched, so 0 rows could have changed). The follow-on
-- SELECT is a belt-and-braces control against a DIFFERENT bug shape (the
-- UPDATE silently targeting the wrong row), not a substitute for the
-- `UPDATE 0` check itself.

-- ---------------------------------------------------------------------------
-- Assertion 1 (C1): a non-staff authenticated user (T503 Student One) can
-- now SELECT every other student's row -- same-team (Student Two) AND an
-- UNRELATED team (Student Four) -- proving the widened policy is genuinely
-- unrestricted ("any authenticated user", the 2026-08-04 ruling's scope),
-- not accidentally still team-scoped.
-- ---------------------------------------------------------------------------
set role authenticated;
select set_config('request.jwt.claim.sub', '20000000-0000-4000-8000-200000000011', false);
do $$
declare
  v_count integer;
begin
  select count(*) into v_count from rsvps;
  if v_count <> 4 then
    raise exception 'FAIL c1-select-all: expected 4 rows visible to Student One, got %', v_count;
  end if;

  if not exists (select 1 from rsvps where id = '20000000-0000-4000-8000-200000000052') then
    raise exception 'FAIL c1-select-all: Student Two''s (same-team) row not visible';
  end if;
  if not exists (select 1 from rsvps where id = '20000000-0000-4000-8000-200000000054') then
    raise exception 'FAIL c1-select-all: Student Four''s (UNRELATED team) row not visible';
  end if;
  raise notice 'PASS c1-select-all (same-team AND cross-team rows both visible)';
end;
$$;
reset role;

-- ---------------------------------------------------------------------------
-- Assertion 2 (C2, INSERT half): Student One still CANNOT create an rsvp
-- for Student Two. Must raise `insufficient_privilege` (SQLSTATE 42501) --
-- `own_or_linked_write`'s `with check` is untouched by this migration.
-- ---------------------------------------------------------------------------
set role authenticated;
select set_config('request.jwt.claim.sub', '20000000-0000-4000-8000-200000000011', false);
do $$
declare
  v_denied boolean := false;
  v_sqlstate text;
begin
  begin
    insert into rsvps (session_id, student_id, status, responded_by)
    values ('20000000-0000-4000-8000-200000000043', '20000000-0000-4000-8000-200000000022', 'going',
            '20000000-0000-4000-8000-200000000011');
  exception
    when insufficient_privilege then
      v_denied := true;
      get stacked diagnostics v_sqlstate = returned_sqlstate;
  end;

  if not v_denied then
    raise exception 'FAIL c2-insert-denied: cross-student INSERT succeeded';
  end if;
  if v_sqlstate <> '42501' then
    raise exception 'FAIL c2-insert-denied: wrong SQLSTATE %, expected 42501', v_sqlstate;
  end if;
  raise notice 'PASS c2-insert-denied (SQLSTATE 42501)';
end;
$$;
reset role;

-- ---------------------------------------------------------------------------
-- Assertion 3 (C2, UPDATE half): Student One attempts to UPDATE Student
-- Two's row (now VISIBLE via the widened SELECT policy). This must NOT
-- raise -- `own_or_linked_update`'s USING clause filters the row out of the
-- update's scope, so it manifests as `UPDATE 0`, never an exception. This
-- is the one packet v2 explicitly warns the T205 exception-catch shape
-- would mis-assert.
-- ---------------------------------------------------------------------------
set role authenticated;
select set_config('request.jwt.claim.sub', '20000000-0000-4000-8000-200000000011', false);
do $$
begin
  update rsvps set status = 'declined' where id = '20000000-0000-4000-8000-200000000052';
  if found then
    raise exception 'FAIL c2-update-denied: cross-student UPDATE matched a row (should be UPDATE 0)';
  end if;
  raise notice 'PASS c2-update-denied (UPDATE 0, no exception)';
end;
$$;
reset role;

do $$
declare
  v_status text;
begin
  select status into v_status from rsvps where id = '20000000-0000-4000-8000-200000000052';
  if v_status <> 'going' then
    raise exception 'FAIL c2-update-denied: Student Two''s row changed to %, expected unchanged ''going''', v_status;
  end if;
  raise notice 'PASS c2-update-denied-row-unchanged (belt-and-braces control, not the UPDATE 0 proof itself)';
end;
$$;

-- ---------------------------------------------------------------------------
-- Assertion 4 (C3): `anon` still gets nothing -- the widened policy is `to
-- authenticated` only; `anon` is not a member of that role and holds no
-- `rsvps` policy of its own.
-- ---------------------------------------------------------------------------
set role anon;
select set_config('request.jwt.claim.sub', '', false);
do $$
declare
  v_count integer;
begin
  select count(*) into v_count from rsvps;
  if v_count <> 0 then
    raise exception 'FAIL c3-anon-denied: anon read % row(s) from rsvps', v_count;
  end if;
  raise notice 'PASS c3-anon-denied';
end;
$$;
reset role;

-- ---------------------------------------------------------------------------
-- Control: Student One's own INSERT still succeeds (writes remain
-- available for one's own student id -- only cross-student writes are
-- denied). Cleaned up immediately so it does not perturb any later
-- comparison.
-- ---------------------------------------------------------------------------
set role authenticated;
select set_config('request.jwt.claim.sub', '20000000-0000-4000-8000-200000000011', false);
do $$
declare
  v_new_id uuid;
begin
  insert into rsvps (session_id, student_id, status, responded_by)
  values ('20000000-0000-4000-8000-200000000043', '20000000-0000-4000-8000-200000000021', 'going',
          '20000000-0000-4000-8000-200000000011')
  returning id into v_new_id;

  if v_new_id is null then
    raise exception 'FAIL control-own-insert: Student One''s own INSERT did not return an id';
  end if;
  raise notice 'PASS control-own-insert';
end;
$$;
reset role;

delete from rsvps where session_id = '20000000-0000-4000-8000-200000000043';

do $$
begin
  raise notice 'T503 widen-rsvp-read tests: ALL PASS';
end;
$$;
