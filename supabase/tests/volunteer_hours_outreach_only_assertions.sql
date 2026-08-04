-- T322 SQL proof: volunteer hours = `type = 'outreach'` ONLY, both
-- `v_student_hours` and `v_season_kpis` (`20260804000000_volunteer_hours_
-- outreach_only.sql`). Follows the T205 precedent
-- (`t205_anon_grant_assertions.sql`): fixture INSERTs and assertion `DO`
-- blocks in one file, run once after all migrations have applied. All
-- names below are fabricated (constitution item 6) -- no real team, event,
-- or student name from the migrated data appears here.
--
-- Two seasons, deliberately, so assertions 1-4 stay numerically independent
-- of the FLL-titled event's own hours (T322 premise gate's own design
-- note: otherwise a title-based-filtering mutation could land on
-- assertion 1 instead of assertion 5, red for the wrong reason):
--
--   Season Alpha -- one student ("Fixture Student Alpha"), one session of
--   each of the three event types, the competition session's
--   `counts_volunteer_hours` flagged TRUE deliberately (the live gap this
--   task closes -- an admin CAN flip that flag, so the fixture proves the
--   type filter, not the flag, is what now keeps it out of the total).
--
--   Season Bravo -- a second student ("Fixture Student Bravo"), a single
--   outreach-typed session whose title is a fabricated variant of the real
--   `GG FLL Team Meetings` event ("Fixture GG FLL Team Meetings", per
--   constitution item 6 -- never the real title verbatim) -- proves the
--   rule reads `type`, never the word "Meeting" in a title.
--
-- Every attendance row below leaves `check_in_at`/`check_out_at`/
-- `hours_override` NULL, so each view's own formula falls through to its
-- third branch (full session duration) -- session lengths were chosen so
-- every resulting figure is a clean, unambiguous number.

insert into public.seasons (id, name, starts_on, ends_on, default_goal_hours, is_active)
values
  ('90000000-0000-4000-8000-000000000001', 'Fixture Season Alpha', '2026-01-01', '2026-12-31', 90, false),
  ('90000000-0000-4000-8000-000000000002', 'Fixture Season Bravo', '2026-01-01', '2026-12-31', 90, false);

insert into public.teams (id, name, short_name, color)
values ('90000000-0000-4000-8000-000000000010', 'Fixture Team Alpha', 'FTA', '#123456');

insert into public.students (id, display_name, team_id, is_active)
values
  ('90000000-0000-4000-8000-000000000020', 'Fixture Student Alpha', '90000000-0000-4000-8000-000000000010', true),
  ('90000000-0000-4000-8000-000000000021', 'Fixture Student Bravo', '90000000-0000-4000-8000-000000000010', true);

-- Season Alpha: outreach (E1), meeting (E2), competition (E3, flag ON).
insert into public.events
  (id, season_id, type, title, description, location_name, address, counts_participation, counts_volunteer_hours)
values
  (
    '90000000-0000-4000-8000-000000000030', '90000000-0000-4000-8000-000000000001', 'outreach',
    'Fixture Community Cleanup', 'Fixture outreach event.', 'Fixture Park', '1 Fixture Way',
    false, true
  ),
  (
    '90000000-0000-4000-8000-000000000031', '90000000-0000-4000-8000-000000000001', 'meeting',
    'Fixture Team Meeting', 'Fixture internal meeting.', 'Fixture Shop', '1 Fixture Way',
    true, false
  ),
  (
    -- Deliberately counts_volunteer_hours = TRUE: the live gap (2026-08-04
    -- ruling's own table) -- an admin CAN flip this flag on a competition;
    -- the type filter, not this flag, must be what keeps it out of the total.
    '90000000-0000-4000-8000-000000000032', '90000000-0000-4000-8000-000000000001', 'competition',
    'Fixture Regional Competition', 'Fixture competition event.', 'Fixture Arena', '1 Fixture Way',
    false, true
  );

-- Season Bravo: a single outreach event with a fabricated FLL-title variant.
insert into public.events
  (id, season_id, type, title, description, location_name, address, counts_participation, counts_volunteer_hours)
values
  (
    '90000000-0000-4000-8000-000000000033', '90000000-0000-4000-8000-000000000002', 'outreach',
    'Fixture GG FLL Team Meetings', 'Fixture student-coached FLL outreach session.', 'Fixture School',
    '1 Fixture Way', false, true
  );

insert into public.event_sessions (id, event_id, session_date, starts_at, ends_at, status, notes)
values
  ('90000000-0000-4000-8000-000000000040', '90000000-0000-4000-8000-000000000030', '2026-03-01', '2026-03-01 09:00:00+00', '2026-03-01 13:00:00+00', 'completed', ''), -- 4.0h outreach
  ('90000000-0000-4000-8000-000000000041', '90000000-0000-4000-8000-000000000031', '2026-03-02', '2026-03-02 09:00:00+00', '2026-03-02 11:00:00+00', 'completed', ''), -- 2.0h meeting
  ('90000000-0000-4000-8000-000000000042', '90000000-0000-4000-8000-000000000032', '2026-03-03', '2026-03-03 09:00:00+00', '2026-03-03 12:00:00+00', 'completed', ''), -- 3.0h competition
  ('90000000-0000-4000-8000-000000000043', '90000000-0000-4000-8000-000000000033', '2026-03-04', '2026-03-04 09:00:00+00', '2026-03-04 14:00:00+00', 'completed', ''); -- 5.0h FLL-titled outreach

insert into public.attendance (id, session_id, student_id, status, method)
values
  ('90000000-0000-4000-8000-000000000050', '90000000-0000-4000-8000-000000000040', '90000000-0000-4000-8000-000000000020', 'present', 'coach'),
  ('90000000-0000-4000-8000-000000000051', '90000000-0000-4000-8000-000000000041', '90000000-0000-4000-8000-000000000020', 'present', 'coach'),
  ('90000000-0000-4000-8000-000000000052', '90000000-0000-4000-8000-000000000042', '90000000-0000-4000-8000-000000000020', 'present', 'coach'),
  ('90000000-0000-4000-8000-000000000053', '90000000-0000-4000-8000-000000000043', '90000000-0000-4000-8000-000000000021', 'present', 'coach');

-- ---------------------------------------------------------------------------
-- Assertion 1: an outreach event's hours count toward v_student_hours.
-- confirmed_hours AND v_season_kpis.total_hours (Season Alpha's only
-- outreach session, 4.0h -- E2/E3 must not be in this figure at all).
-- ---------------------------------------------------------------------------
do $$
declare
  v_confirmed_hours numeric;
  v_total_hours numeric;
begin
  select coalesce((
    select confirmed_hours from v_student_hours
    where student_id = '90000000-0000-4000-8000-000000000020'
      and season_id = '90000000-0000-4000-8000-000000000001'
  ), 0) into v_confirmed_hours;

  select coalesce((
    select total_hours from v_season_kpis
    where season_id = '90000000-0000-4000-8000-000000000001'
  ), 0) into v_total_hours;

  if v_confirmed_hours is distinct from 4.0 or v_total_hours is distinct from 4.0 then
    raise exception
      'FAIL outreach-hours-count: student confirmed_hours %, season total_hours % (expected 4.0 / 4.0)',
      v_confirmed_hours, v_total_hours;
  end if;
  raise notice 'PASS outreach-hours-count (confirmed_hours %, total_hours %)', v_confirmed_hours, v_total_hours;
end;
$$;

-- ---------------------------------------------------------------------------
-- Assertion 2: a competition event with counts_volunteer_hours = TRUE (the
-- live gap) contributes ZERO to both v_student_hours.confirmed_hours and
-- v_season_kpis.total_hours. Re-checks the SAME 4.0h figure as assertion 1
-- -- if the 3.0h competition session leaked in, either number would read
-- 7.0, not 4.0.
-- ---------------------------------------------------------------------------
do $$
declare
  v_confirmed_hours numeric;
  v_total_hours numeric;
begin
  select coalesce((
    select confirmed_hours from v_student_hours
    where student_id = '90000000-0000-4000-8000-000000000020'
      and season_id = '90000000-0000-4000-8000-000000000001'
  ), 0) into v_confirmed_hours;

  select coalesce((
    select total_hours from v_season_kpis
    where season_id = '90000000-0000-4000-8000-000000000001'
  ), 0) into v_total_hours;

  if v_confirmed_hours is distinct from 4.0 or v_total_hours is distinct from 4.0 then
    raise exception
      'FAIL competition-hours-excluded-live-gap: student confirmed_hours %, season total_hours % (expected 4.0 / 4.0, NOT 7.0 -- the 3.0h flag-on competition session must not leak in)',
      v_confirmed_hours, v_total_hours;
  end if;
  raise notice 'PASS competition-hours-excluded-live-gap (confirmed_hours %, total_hours %)', v_confirmed_hours, v_total_hours;
end;
$$;

-- ---------------------------------------------------------------------------
-- Assertion 3: a meeting event contributes zero to both. Already true today
-- via the pre-existing counts_volunteer_hours = false flag (not this
-- task's fix), but re-verified here for completeness -- if the 2.0h
-- meeting session leaked in, either number would read 6.0, not 4.0.
-- ---------------------------------------------------------------------------
do $$
declare
  v_confirmed_hours numeric;
  v_total_hours numeric;
begin
  select coalesce((
    select confirmed_hours from v_student_hours
    where student_id = '90000000-0000-4000-8000-000000000020'
      and season_id = '90000000-0000-4000-8000-000000000001'
  ), 0) into v_confirmed_hours;

  select coalesce((
    select total_hours from v_season_kpis
    where season_id = '90000000-0000-4000-8000-000000000001'
  ), 0) into v_total_hours;

  if v_confirmed_hours is distinct from 4.0 or v_total_hours is distinct from 4.0 then
    raise exception
      'FAIL meeting-hours-excluded: student confirmed_hours %, season total_hours % (expected 4.0 / 4.0, NOT 6.0)',
      v_confirmed_hours, v_total_hours;
  end if;
  raise notice 'PASS meeting-hours-excluded (confirmed_hours %, total_hours %)', v_confirmed_hours, v_total_hours;
end;
$$;

-- ---------------------------------------------------------------------------
-- Assertion 4: the per-type breakdown survives. Asserted ONLY on
-- competition_hours (3.0, still populated) per the worker packet --
-- meeting_hours is measured and reported, NOT asserted non-zero: it is
-- structurally frozen at 0 by the pre-existing counts_volunteer_hours =
-- false flag on every app-reachable meeting event (filed as T704, out of
-- this task's scope), so asserting it non-zero here would require a
-- hand-run UPDATE no UI can issue.
-- ---------------------------------------------------------------------------
do $$
declare
  v_competition_hours numeric;
  v_meeting_hours numeric;
begin
  select coalesce(competition_hours, 0), coalesce(meeting_hours, 0)
    into v_competition_hours, v_meeting_hours
  from v_season_kpis
  where season_id = '90000000-0000-4000-8000-000000000001';

  if v_competition_hours is distinct from 3.0 then
    raise exception
      'FAIL breakdown-survives: competition_hours % (expected 3.0 -- the breakdown column must not be zeroed by the total_hours fix)',
      v_competition_hours;
  end if;
  raise notice 'PASS breakdown-survives (competition_hours %); measured (not asserted) meeting_hours = % (structurally frozen at 0, T704)',
    v_competition_hours, v_meeting_hours;
end;
$$;

-- ---------------------------------------------------------------------------
-- Assertion 5: an event titled like a fabricated `GG FLL Team Meetings`
-- variant, but typed `outreach`, counts IN FULL (5.0h) -- the rule is by
-- `type`, never by name. Season Bravo contains ONLY this one event, so
-- this assertion is numerically independent of Season Alpha (assertions
-- 1-4) in either direction.
-- ---------------------------------------------------------------------------
do $$
declare
  v_confirmed_hours numeric;
  v_total_hours numeric;
begin
  select coalesce((
    select confirmed_hours from v_student_hours
    where student_id = '90000000-0000-4000-8000-000000000021'
      and season_id = '90000000-0000-4000-8000-000000000002'
  ), 0) into v_confirmed_hours;

  select coalesce((
    select total_hours from v_season_kpis
    where season_id = '90000000-0000-4000-8000-000000000002'
  ), 0) into v_total_hours;

  if v_confirmed_hours is distinct from 5.0 or v_total_hours is distinct from 5.0 then
    raise exception
      'FAIL fll-titled-outreach-counts-in-full: student confirmed_hours %, season total_hours % (expected 5.0 / 5.0 -- a "Meetings" title must not exclude a type=outreach event)',
      v_confirmed_hours, v_total_hours;
  end if;
  raise notice 'PASS fll-titled-outreach-counts-in-full (confirmed_hours %, total_hours %)', v_confirmed_hours, v_total_hours;
end;
$$;
