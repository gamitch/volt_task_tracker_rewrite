-- T020 NFR-02 RLS-denial assertions, run against the fixture data loaded by
-- `tests/rls/seed.sql`. Applied by `tests/rls/run.sh` after
-- `tests/rls/auth_stub.sql`, all six files under `supabase/migrations/`,
-- `tests/rls/grants.sql`, and `tests/rls/seed.sql`.
--
-- Method: each scenario below runs inside its own `BEGIN ... ROLLBACK`
-- block, issuing `SET LOCAL ROLE authenticated;` plus
-- `SET LOCAL request.jwt.claim.sub = '<uuid>';` (per `tests/rls/auth_stub.sql`'s
-- `auth.uid()` implementation) to impersonate a specific authenticated
-- session, runs plain `SELECT ... FROM <table>` with NO `WHERE` clause (so
-- RLS is the only thing limiting rows, per this task's packet), captures the
-- result via psql's `\gset` into a client-side variable, then `ROLLBACK`s
-- (restoring the superuser role for the next scenario -- this also means no
-- scenario below can ever accidentally write real data, even though none of
-- them attempt to). Final PASS/FAIL comparisons run afterward, back under
-- the superuser role, as plain SQL against the captured `\gset` variables --
-- this is a plain-psql/shell approach (no pgTAP, no test-runner npm package),
-- same reasoning/precedent as `supabase/tests/run.sh` (T014): no Postgres
-- client library is on this project's dependency allowlist, and no
-- JS/TS files are added by this suite at all (see this task's worker output,
-- Acceptance Criterion 8).
--
-- Scenario A (PRIMARY -- this task's ledger row's explicit requirement,
-- AUTH-04's underlying RLS guarantee / NFR-02's profile-less case):
-- `fixture-orphan-auth` (`30000000-0000-0000-0000-000000000099`) is a real,
-- authenticated `auth.uid()` with NO matching `profiles` row anywhere.
-- Zero rows must come back from `students`, `events`, AND `attendance`,
-- despite real rows existing in every one of those tables (per
-- `tests/rls/seed.sql`).
begin;
set local role authenticated;
set local request.jwt.claim.sub = '30000000-0000-0000-0000-000000000099';
select count(*) as a_students_ct from students \gset
select count(*) as a_events_ct from events \gset
select count(*) as a_attendance_ct from attendance \gset
rollback;

-- Scenario B (sanity check / contrast, NOT the primary requirement): the
-- SAME `students` table, queried by `fixture-student-one-auth`
-- (`30000000-0000-0000-0000-000000000001`), which DOES have a matching
-- `profiles` row. This must return exactly 1 row (their own), demonstrating
-- Scenario A's zero-row result is specifically because that session has no
-- profile -- not because RLS on this table is broken/always-denies for
-- every authenticated caller regardless of profile status.
begin;
set local role authenticated;
set local request.jwt.claim.sub = '30000000-0000-0000-0000-000000000001';
select count(*) as b_students_ct from students \gset
rollback;

-- Scenario C (SECONDARY -- NFR-02's literal wording: "student fetching
-- another student's attendance gets zero rows"). This is a DISTINCT scenario
-- from Scenario A: `fixture-student-one-auth` DOES have a real `profiles`
-- row and a real, linked `students` row, and is attempting to read
-- `attendance`, which contains both their own row
-- (`70000000-0000-0000-0000-000000000001`) and
-- `fixture-student-two-auth`'s row (`70000000-0000-0000-0000-000000000002`),
-- from the SAME session/event/session_id. Expect exactly 1 row back (their
-- own), and that row's `student_id` must be their own
-- `students.id` (`40000000-0000-0000-0000-000000000001`), never
-- Student Two's (`40000000-0000-0000-0000-000000000002`).
begin;
set local role authenticated;
set local request.jwt.claim.sub = '30000000-0000-0000-0000-000000000001';
select count(*) as c_attendance_ct from attendance \gset
select coalesce(
  (select string_agg(distinct student_id::text, ',') from attendance),
  '(none)'
) as c_attendance_student_ids \gset
rollback;

-- ---------------------------------------------------------------------------
-- Final PASS/FAIL report (back under the superuser role -- no impersonation
-- in effect here, this only reads the already-captured psql variables above).
-- ---------------------------------------------------------------------------
select
  case_name,
  expected,
  actual,
  case when expected = actual then 'PASS' else 'FAIL' end as result
from (
  values
    ('A-orphan-students-zero-rows',    '0', :'a_students_ct'),
    ('A-orphan-events-zero-rows',      '0', :'a_events_ct'),
    ('A-orphan-attendance-zero-rows',  '0', :'a_attendance_ct'),
    ('B-own-profile-students-own-row', '1', :'b_students_ct'),
    ('C-student-vs-student-attendance-count', '1', :'c_attendance_ct'),
    ('C-student-vs-student-attendance-ids',
      '40000000-0000-0000-0000-000000000001', :'c_attendance_student_ids')
) as t(case_name, expected, actual)
order by case_name;
