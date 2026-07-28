-- T020 NFR-02 RLS-denial test fixture data. Loaded via `tests/rls/run.sh`
-- against a scratch Postgres database that already has
-- `tests/rls/auth_stub.sql`, all six files under `supabase/migrations/`, and
-- `tests/rls/grants.sql` applied, in that order.
--
-- All names below are fabricated placeholders (constitution item 6) -- no
-- real VOLT student/parent/coach name, email, or other PII appears anywhere
-- in this file.
--
-- Fixed UUID literals are used (instead of gen_random_uuid()) purely so this
-- file and `tests/rls/assertions.sql` can reference the same rows by a
-- readable, stable id without needing psql variables or a scripting layer --
-- same pattern as `supabase/tests/seed.sql` (T014).
--
-- Deliberately includes REAL, non-empty rows in `students`/`events`/
-- `attendance` (not an empty database) -- this is required for the
-- profile-less-session assertions in `tests/rls/assertions.sql` to be
-- meaningful: "zero rows returned" must be because RLS is actively filtering
-- real data away, not merely because there was nothing to return in the
-- first place.
--
-- Three `auth.users` rows:
--   - fixture-student-one-auth: HAS a matching `profiles` row (role
--     'student') and an owned `students` row -- used for the secondary,
--     NFR-02-literal-wording scenario ("student fetching another student's
--     attendance").
--   - fixture-student-two-auth: HAS a matching `profiles` row (role
--     'student') and an owned `students` row -- the "other student" in that
--     same scenario.
--   - fixture-orphan-auth: the PRIMARY scenario. A real `auth.users` row
--     exists (so `auth.uid()` resolves to a real, non-null value under an
--     `authenticated` session), but deliberately has NO matching `profiles`
--     row anywhere -- reproducing AUTH-04's "no pending invite or existing
--     profile" case / T012's own "orphan authenticated session" scenario
--     (see `docs/swarm/verification-log.md`'s `## T012` entry) exactly.

begin;

-- ---------------------------------------------------------------------------
-- auth.users (three sessions -- see file header above)
-- ---------------------------------------------------------------------------
insert into auth.users (id, email) values
  ('30000000-0000-0000-0000-000000000001', 'fixture.student.one@example.com'),
  ('30000000-0000-0000-0000-000000000002', 'fixture.student.two@example.com'),
  ('30000000-0000-0000-0000-000000000099', 'fixture.orphan.no.profile@example.com');
-- NOTE: no `profiles` row is ever inserted for
-- '30000000-0000-0000-0000-000000000099' -- that omission IS the fixture for
-- the primary profile-less scenario. This is deliberate, not an oversight.

-- ---------------------------------------------------------------------------
-- profiles (student one and two only -- orphan has none, by design)
-- ---------------------------------------------------------------------------
insert into profiles (id, display_name, email, role) values
  ('30000000-0000-0000-0000-000000000001', 'Fixture Student One', 'fixture.student.one@example.com', 'student'),
  ('30000000-0000-0000-0000-000000000002', 'Fixture Student Two', 'fixture.student.two@example.com', 'student');

-- ---------------------------------------------------------------------------
-- season / team (shared)
-- ---------------------------------------------------------------------------
insert into seasons (id, name, starts_on, ends_on, default_goal_hours, is_active)
values ('20000000-0000-0000-0000-000000000001', 'Fixture RLS Test Season', '2026-01-01', '2026-12-31', 100, true);

insert into teams (id, name, short_name, program, color, archived, sort_order)
values ('10000000-0000-0000-0000-000000000001', 'Fixture RLS Test Team', 'FIXTURE', 'FRC', '#123456', false, 1);

-- ---------------------------------------------------------------------------
-- students (one per profile, both on the same team)
-- ---------------------------------------------------------------------------
insert into students (id, profile_id, display_name, team_id, grad_year, is_active, goal_hours_override) values
  ('40000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 'Fixture Student One', '10000000-0000-0000-0000-000000000001', 2027, true, null),
  ('40000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000002', 'Fixture Student Two', '10000000-0000-0000-0000-000000000001', 2027, true, null);

-- ---------------------------------------------------------------------------
-- event / event_session (team-scoped, completed)
-- ---------------------------------------------------------------------------
insert into events (id, season_id, type, title, description, location_name, address, team_ids, counts_participation, counts_volunteer_hours)
values (
  '50000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'meeting',
  'Fixture RLS Test Meeting', 'Fixture event for the RLS-denial test suite.', 'Fixture Shop', '1 Fixture Way',
  array['10000000-0000-0000-0000-000000000001']::uuid[], true, false
);

insert into event_sessions (id, event_id, session_date, starts_at, ends_at, status, notes)
values (
  '60000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000001',
  '2026-07-18', '2026-07-18 18:00:00-05', '2026-07-18 20:00:00-05', 'completed', 'Fixture RLS test session'
);

-- ---------------------------------------------------------------------------
-- attendance (one row per student, same session -- this is the row set the
-- secondary "student fetching another student's attendance" scenario checks
-- student1 CANNOT see student2's row in, and the primary orphan scenario
-- checks is entirely invisible)
-- ---------------------------------------------------------------------------
insert into attendance (id, session_id, student_id, status, check_in_at, check_out_at, hours_override, method) values
  ('70000000-0000-0000-0000-000000000001', '60000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000001', 'present', '2026-07-18 18:00:00-05', '2026-07-18 20:00:00-05', null, 'coach'),
  ('70000000-0000-0000-0000-000000000002', '60000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000002', 'present', '2026-07-18 18:00:00-05', '2026-07-18 20:00:00-05', null, 'coach');

commit;
