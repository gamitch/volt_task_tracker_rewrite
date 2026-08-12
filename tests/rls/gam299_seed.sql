-- GAM-299 (T806) fixture data for the active-membership event-visibility
-- assertions in `tests/rls/gam299_assertions.sql`.
--
-- Loaded by `tests/rls/run.sh` AFTER `tests/rls/seed.sql` AND AFTER
-- `tests/rls/assertions.sql` has already run, precisely so that no row added
-- here can move any pre-existing case's count or expected value (constitution
-- non-negotiable "existing tests must pass"; this task's acceptance criterion
-- 8). That ordering is verified by the runner, not assumed.
--
-- All names below are fabricated placeholders (constitution item 6) -- no real
-- VOLT student/parent/coach name, email, or other PII appears anywhere in this
-- file.
--
-- UUID PREFIX: every id minted here begins `c2990000-` (c + 299, the issue
-- number). `tests/rls/seed.sql` mints only ids beginning `1`, `2`, `3`, `4`,
-- `5`, `6` and `7` in that first hex position, so no id in this file can
-- collide with one in that file. The only row this file REUSES rather than
-- creates is the shared season `20000000-0000-0000-0000-000000000001`, because
-- `seasons_single_active_idx` (`20260716000000_identity_roster.sql:53-55`)
-- permits at most one `is_active` season -- and the profile-less "orphan"
-- session `30000000-0000-0000-0000-000000000099`, which this suite reuses
-- rather than duplicating (criterion 4).
--
-- ---------------------------------------------------------------------------
-- PERSONAS (the whole point of the file):
--
--   DUAL-TEAM student (`...d1`, profile `...01`) -- `students.team_id` = team
--     Alpha, plus ACTIVE `student_teams` rows (`left_on is null`) in Alpha AND
--     Bravo. This is the defect's shape: today's shipped `own_or_linked_read`
--     policy tests only `students.team_id`, so Bravo's event is invisible.
--
--   MEMBERSHIP-LESS student (`...d2`, profile `...02`) -- a `students` row with
--     `team_id` = Alpha and NO `student_teams` row at all. This is a real
--     state, not a contrived one: the backfill at
--     `20260721000000_student_teams.sql:37` runs at MIGRATION time, before any
--     seed file is loaded, so every seeded student has no membership row unless
--     the seed adds one (true of `tests/rls/seed.sql`'s two students as well).
--     They must not be made worse off by the new policy.
--
--   LEFT-TEAM student (`...d3`, profile `...03`) -- `students.team_id` = Alpha,
--     ACTIVE membership in Alpha, and a membership in Bravo with `left_on` SET.
--     They must not receive Bravo's events. (Note the deliberate scope: this
--     holds because Bravo is not also their `students.team_id`; see the
--     migration header's given-up configuration (a).)
--
--   ADMIN (`...04`) and COACH (`...05`) -- `staff_all` must be unchanged.
--
--   ORPHAN -- `tests/rls/seed.sql`'s `30000000-0000-0000-0000-000000000099`,
--     a real `auth.users` row with no `profiles` row anywhere, reused here.
--
-- EVENTS: Alpha-scoped (`...e1`), Bravo-scoped (`...e2`) and GLOBAL /
-- `team_ids is null` (`...e3`), each with exactly one session (`...f1`,
-- `...f2`, `...f3`) so `events` and `event_sessions` can be compared row for
-- row (criterion 5).

begin;

-- ---------------------------------------------------------------------------
-- auth.users + profiles (five new sessions; the orphan is reused from
-- tests/rls/seed.sql and deliberately gets no row here either)
-- ---------------------------------------------------------------------------
insert into auth.users (id, email) values
  ('c2990000-0000-0000-0000-000000000001', 'fixture.gam299.dual@example.com'),
  ('c2990000-0000-0000-0000-000000000002', 'fixture.gam299.nomembership@example.com'),
  ('c2990000-0000-0000-0000-000000000003', 'fixture.gam299.leftteam@example.com'),
  ('c2990000-0000-0000-0000-000000000004', 'fixture.gam299.admin@example.com'),
  ('c2990000-0000-0000-0000-000000000005', 'fixture.gam299.coach@example.com'),
  ('c2990000-0000-0000-0000-000000000006', 'fixture.gam299.reteamed@example.com');

insert into profiles (id, display_name, email, role) values
  ('c2990000-0000-0000-0000-000000000001', 'Fixture Dual Team Student', 'fixture.gam299.dual@example.com', 'student'),
  ('c2990000-0000-0000-0000-000000000002', 'Fixture No Membership Student', 'fixture.gam299.nomembership@example.com', 'student'),
  ('c2990000-0000-0000-0000-000000000003', 'Fixture Left Team Student', 'fixture.gam299.leftteam@example.com', 'student'),
  ('c2990000-0000-0000-0000-000000000004', 'Fixture GAM299 Admin', 'fixture.gam299.admin@example.com', 'admin'),
  ('c2990000-0000-0000-0000-000000000005', 'Fixture GAM299 Coach', 'fixture.gam299.coach@example.com', 'coach'),
  ('c2990000-0000-0000-0000-000000000006', 'Fixture Re-teamed Student', 'fixture.gam299.reteamed@example.com', 'student');

-- ---------------------------------------------------------------------------
-- teams (Alpha = the legacy `students.team_id` for all three students below;
-- Bravo = the SECOND team only the dual-team student is actively a member of)
-- ---------------------------------------------------------------------------
insert into teams (id, name, short_name, program, color, archived, sort_order) values
  ('c2990000-0000-0000-0000-0000000000a1', 'Fixture GAM299 Team Alpha', 'GAM299A', 'FRC', '#a1a1a1', false, 299),
  ('c2990000-0000-0000-0000-0000000000b1', 'Fixture GAM299 Team Bravo', 'GAM299B', 'FRC', '#b1b1b1', false, 300);

-- ---------------------------------------------------------------------------
-- students -- the first THREE carry `students.team_id` = Alpha, so the legacy
-- column is held constant across those personas and every difference measured
-- by the assertions is attributable to `student_teams` alone.
--
-- `...d4` is the deliberate exception and the reason it exists: it is the
-- RE-TEAMED student, and it is the only persona here that the APPLICATION can
-- actually produce. `src/lib/supabase/loaders/students.ts` updates
-- `students.team_id` and never writes `student_teams` (there is no writer
-- anywhere in the repo -- GAM-340), so a student moved Alpha -> Bravo ends up
-- with `students.team_id` = Bravo while the 2026-07-21 backfill row for ALPHA
-- is still `left_on is null`. Its `team_id` is therefore Bravo, not Alpha.
--
-- Added on `boss-arbiter`'s ruling (D019). The original five personas covered
-- every configuration EXCEPT the one the app produces, so the residue this
-- migration discloses in capitals was pinned by nothing. D019 also measured
-- that this is NOT a consequence of the route chosen: a memberships-only
-- policy grants the stale Alpha row too, and additionally denies this
-- student's CURRENT team. The cause is the missing writer, not the policy.
-- ---------------------------------------------------------------------------
insert into students (id, profile_id, display_name, team_id, grad_year, is_active, goal_hours_override) values
  ('c2990000-0000-0000-0000-0000000000d1', 'c2990000-0000-0000-0000-000000000001', 'Fixture Dual Team Student',
    'c2990000-0000-0000-0000-0000000000a1', 2028, true, null),
  ('c2990000-0000-0000-0000-0000000000d2', 'c2990000-0000-0000-0000-000000000002', 'Fixture No Membership Student',
    'c2990000-0000-0000-0000-0000000000a1', 2028, true, null),
  ('c2990000-0000-0000-0000-0000000000d3', 'c2990000-0000-0000-0000-000000000003', 'Fixture Left Team Student',
    'c2990000-0000-0000-0000-0000000000a1', 2028, true, null),
  ('c2990000-0000-0000-0000-0000000000d4', 'c2990000-0000-0000-0000-000000000006', 'Fixture Re-teamed Student',
    'c2990000-0000-0000-0000-0000000000b1', 2028, true, null);

-- ---------------------------------------------------------------------------
-- student_teams -- the junction the new policy reads. NOTE what is absent:
-- there is deliberately NO row for `...d2` (the membership-less persona), and
-- the only Bravo row for `...d3` carries a non-null `left_on`.
-- ---------------------------------------------------------------------------
insert into student_teams (student_id, team_id, joined_on, left_on) values
  -- dual-team: ACTIVE in both Alpha and Bravo
  ('c2990000-0000-0000-0000-0000000000d1', 'c2990000-0000-0000-0000-0000000000a1', '2026-01-05', null),
  ('c2990000-0000-0000-0000-0000000000d1', 'c2990000-0000-0000-0000-0000000000b1', '2026-02-09', null),
  -- left-team: ACTIVE in Alpha, LEFT Bravo
  ('c2990000-0000-0000-0000-0000000000d3', 'c2990000-0000-0000-0000-0000000000a1', '2026-01-05', null),
  ('c2990000-0000-0000-0000-0000000000d3', 'c2990000-0000-0000-0000-0000000000b1', '2026-02-09', '2026-06-30'),
  -- re-teamed (`...d4`): exactly what the backfill left behind after the roster
  -- moved this student to Bravo. ONE row, for the team they LEFT, still
  -- `left_on is null` because nothing ever closed it -- and NO row for Bravo,
  -- because nothing ever opened one. Do not "fix" this fixture by adding a
  -- Bravo row or setting `left_on`: the absence and the null ARE the fixture,
  -- and GAM-340 is what makes them impossible.
  ('c2990000-0000-0000-0000-0000000000d4', 'c2990000-0000-0000-0000-0000000000a1', '2026-01-05', null);

-- ---------------------------------------------------------------------------
-- events (season reused -- see the header note on seasons_single_active_idx)
-- ---------------------------------------------------------------------------
insert into events (id, season_id, type, title, description, location_name, address, team_ids,
                    counts_participation, counts_volunteer_hours) values
  ('c2990000-0000-0000-0000-0000000000e1', '20000000-0000-0000-0000-000000000001', 'meeting',
    'Fixture GAM299 Alpha Meeting', 'Fixture event scoped to team Alpha only.', 'Fixture Shop', '1 Fixture Way',
    array['c2990000-0000-0000-0000-0000000000a1']::uuid[], true, false),
  ('c2990000-0000-0000-0000-0000000000e2', '20000000-0000-0000-0000-000000000001', 'meeting',
    'Fixture GAM299 Bravo Meeting', 'Fixture event scoped to team Bravo only -- the row GAM-299 is about.',
    'Fixture Shop', '1 Fixture Way',
    array['c2990000-0000-0000-0000-0000000000b1']::uuid[], true, false),
  ('c2990000-0000-0000-0000-0000000000e3', '20000000-0000-0000-0000-000000000001', 'outreach',
    'Fixture GAM299 Global Outreach', 'Fixture event with team_ids null (all teams).', 'Fixture Library', '2 Fixture Way',
    null, false, true);

insert into event_sessions (id, event_id, session_date, starts_at, ends_at, status, notes) values
  ('c2990000-0000-0000-0000-0000000000f1', 'c2990000-0000-0000-0000-0000000000e1',
    '2026-08-12', '2026-08-12 18:00:00-05', '2026-08-12 20:00:00-05', 'scheduled', 'Fixture GAM299 Alpha session'),
  ('c2990000-0000-0000-0000-0000000000f2', 'c2990000-0000-0000-0000-0000000000e2',
    '2026-08-13', '2026-08-13 18:00:00-05', '2026-08-13 20:00:00-05', 'scheduled', 'Fixture GAM299 Bravo session'),
  ('c2990000-0000-0000-0000-0000000000f3', 'c2990000-0000-0000-0000-0000000000e3',
    '2026-08-14', '2026-08-14 09:00:00-05', '2026-08-14 12:00:00-05', 'scheduled', 'Fixture GAM299 global session');

commit;
