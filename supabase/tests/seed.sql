-- T014 NFR-03 fixture data for v_student_hours / v_student_participation /
-- v_team_participation. Loaded via supabase/tests/run.sh against a scratch
-- Postgres database that already has supabase/tests/auth_stub.sql and all
-- five files under supabase/migrations/ applied, in that order.
--
-- All names below are fabricated placeholders (constitution item 6) -- no
-- real VOLT student/parent name, email, or other PII appears anywhere in
-- this file.
--
-- Fixed UUID literals are used (instead of gen_random_uuid()) purely so this
-- file and supabase/tests/assertions.sql can reference the same rows by a
-- readable, stable id without needing psql variables or a scripting layer.
-- One team/one event/one-or-two sessions/one student per NFR-03 case below,
-- kept on separate teams and separate events so each case's expected/present/
-- excused/hours counts cannot leak into another case's numbers.

begin;

-- ---------------------------------------------------------------------------
-- season (shared by all cases)
-- ---------------------------------------------------------------------------
insert into seasons (id, name, starts_on, ends_on, default_goal_hours, is_active)
values ('00000000-0000-0000-0000-00000000b001', 'Fixture Season One', '2026-01-01', '2026-12-31', 100, true);

-- ---------------------------------------------------------------------------
-- teams (one per case, so cross-case contamination is structurally impossible
-- even though every case's event also scopes team_ids explicitly)
-- ---------------------------------------------------------------------------
insert into teams (id, name, short_name, program, color, archived, sort_order) values
  ('00000000-0000-0000-0000-00000000a001', 'Fixture Team Alpha',   'ALPHA',   'FRC', '#111111', false, 1),
  ('00000000-0000-0000-0000-00000000a002', 'Fixture Team Bravo',   'BRAVO',   'FRC', '#222222', false, 2),
  ('00000000-0000-0000-0000-00000000a003', 'Fixture Team Charlie', 'CHARLIE', 'FRC', '#333333', false, 3),
  ('00000000-0000-0000-0000-00000000a004', 'Fixture Team Delta',   'DELTA',   'FRC', '#444444', false, 4),
  ('00000000-0000-0000-0000-00000000a005', 'Fixture Team Echo',    'ECHO',    'FRC', '#555555', false, 5);

-- ---------------------------------------------------------------------------
-- students (one per case; profile_id left null -- nullable per T009, and no
-- auth.users/profiles row is needed to exercise these three aggregate views)
-- ---------------------------------------------------------------------------
insert into students (id, profile_id, display_name, team_id, grad_year, is_active, goal_hours_override) values
  ('00000000-0000-0000-0000-00000000c001', null, 'Fixture Student Alpha',   '00000000-0000-0000-0000-00000000a001', 2027, true, null),
  ('00000000-0000-0000-0000-00000000c002', null, 'Fixture Student Bravo',   '00000000-0000-0000-0000-00000000a002', 2027, true, null),
  ('00000000-0000-0000-0000-00000000c003', null, 'Fixture Student Charlie', '00000000-0000-0000-0000-00000000a003', 2027, true, null),
  ('00000000-0000-0000-0000-00000000c004', null, 'Fixture Student Delta',   '00000000-0000-0000-0000-00000000a004', 2027, true, null),
  ('00000000-0000-0000-0000-00000000c005', null, 'Fixture Student Echo',    '00000000-0000-0000-0000-00000000a005', 2027, true, null);

-- ---------------------------------------------------------------------------
-- Case (a): excused-shrinks-denominator
-- One counts_participation event, two completed sessions, scoped to Team
-- Alpha only. Student Alpha is 'present' at session 1 and 'excused' at
-- session 2: expected_ct = 2, present_ct = 1, excused_ct = 1.
-- ---------------------------------------------------------------------------
insert into events (id, season_id, type, title, description, location_name, address, team_ids, counts_participation, counts_volunteer_hours)
values (
  '00000000-0000-0000-0000-00000000d001', '00000000-0000-0000-0000-00000000b001', 'meeting',
  'Fixture Event Alpha Participation', 'Fixture event for case (a).', 'Fixture Shop', '1 Fixture Way',
  array['00000000-0000-0000-0000-00000000a001']::uuid[], true, false
);

insert into event_sessions (id, event_id, session_date, starts_at, ends_at, status, notes) values
  ('00000000-0000-0000-0000-00000000e001', '00000000-0000-0000-0000-00000000d001', '2026-07-20', '2026-07-20 09:00:00-05', '2026-07-20 10:00:00-05', 'completed', 'Fixture session a1'),
  ('00000000-0000-0000-0000-00000000e002', '00000000-0000-0000-0000-00000000d001', '2026-07-21', '2026-07-21 09:00:00-05', '2026-07-21 10:00:00-05', 'completed', 'Fixture session a2');

insert into attendance (id, session_id, student_id, status, check_in_at, check_out_at, hours_override, method) values
  ('00000000-0000-0000-0000-0000000f0001', '00000000-0000-0000-0000-00000000e001', '00000000-0000-0000-0000-00000000c001', 'present', '2026-07-20 09:00:00-05', '2026-07-20 10:00:00-05', null, 'coach'),
  ('00000000-0000-0000-0000-0000000f0002', '00000000-0000-0000-0000-00000000e002', '00000000-0000-0000-0000-00000000c001', 'excused', null, null, null, 'coach');

-- ---------------------------------------------------------------------------
-- Case (b): hours_override wins
-- One counts_volunteer_hours event/session for Team Bravo. Check-in/check-out
-- span clamps to the 2-hour session window (X = 2.0h if the override were
-- ignored), but hours_override is explicitly set to 9.25h (Y). Expect
-- confirmed_hours = 9.25, not 2.0.
-- ---------------------------------------------------------------------------
insert into events (id, season_id, type, title, description, location_name, address, team_ids, counts_participation, counts_volunteer_hours)
values (
  '00000000-0000-0000-0000-00000000d002', '00000000-0000-0000-0000-00000000b001', 'outreach',
  'Fixture Event Bravo Hours', 'Fixture event for case (b).', 'Fixture Shop', '1 Fixture Way',
  array['00000000-0000-0000-0000-00000000a002']::uuid[], false, true
);

insert into event_sessions (id, event_id, session_date, starts_at, ends_at, status, notes) values
  ('00000000-0000-0000-0000-00000000e003', '00000000-0000-0000-0000-00000000d002', '2026-07-20', '2026-07-20 09:00:00-05', '2026-07-20 11:00:00-05', 'completed', 'Fixture session b1');

insert into attendance (id, session_id, student_id, status, check_in_at, check_out_at, hours_override, method) values
  ('00000000-0000-0000-0000-0000000f0003', '00000000-0000-0000-0000-00000000e003', '00000000-0000-0000-0000-00000000c002', 'present', '2026-07-20 09:00:00-05', '2026-07-20 12:00:00-05', 9.25, 'coach');

-- ---------------------------------------------------------------------------
-- Case (c-i): check-in clamping to the session window (positive case)
-- One counts_volunteer_hours event/session for Team Charlie, 2-hour window
-- (09:00-11:00). check_in_at is before starts_at, check_out_at is after
-- ends_at; the actual span is 4.5h but credited hours must clamp to the
-- 2-hour window, not the wider actual span. No hours_override set, so the
-- clamped check-in/check-out branch of the view's coalesce() is exercised.
-- ---------------------------------------------------------------------------
insert into events (id, season_id, type, title, description, location_name, address, team_ids, counts_participation, counts_volunteer_hours)
values (
  '00000000-0000-0000-0000-00000000d003', '00000000-0000-0000-0000-00000000b001', 'outreach',
  'Fixture Event Charlie Clamp Positive', 'Fixture event for case (c-i).', 'Fixture Shop', '1 Fixture Way',
  array['00000000-0000-0000-0000-00000000a003']::uuid[], false, true
);

insert into event_sessions (id, event_id, session_date, starts_at, ends_at, status, notes) values
  ('00000000-0000-0000-0000-00000000e004', '00000000-0000-0000-0000-00000000d003', '2026-07-20', '2026-07-20 09:00:00-05', '2026-07-20 11:00:00-05', 'completed', 'Fixture session c1');

insert into attendance (id, session_id, student_id, status, check_in_at, check_out_at, hours_override, method) values
  ('00000000-0000-0000-0000-0000000f0004', '00000000-0000-0000-0000-00000000e004', '00000000-0000-0000-0000-00000000c003', 'present', '2026-07-20 08:00:00-05', '2026-07-20 12:30:00-05', null, 'qr');

-- ---------------------------------------------------------------------------
-- Case (c-ii): check-in clamping to the session window (zero-floor case)
-- One counts_volunteer_hours event/session for Team Delta, 2-hour window
-- (09:00-11:00). Both check_in_at and check_out_at fall entirely after
-- ends_at, so the naive (unclamped-least/greatest) subtraction would be
-- negative; the view's greatest(...,0) must floor this at exactly 0, never a
-- negative number.
-- ---------------------------------------------------------------------------
insert into events (id, season_id, type, title, description, location_name, address, team_ids, counts_participation, counts_volunteer_hours)
values (
  '00000000-0000-0000-0000-00000000d004', '00000000-0000-0000-0000-00000000b001', 'outreach',
  'Fixture Event Delta Clamp Zero', 'Fixture event for case (c-ii).', 'Fixture Shop', '1 Fixture Way',
  array['00000000-0000-0000-0000-00000000a004']::uuid[], false, true
);

insert into event_sessions (id, event_id, session_date, starts_at, ends_at, status, notes) values
  ('00000000-0000-0000-0000-00000000e005', '00000000-0000-0000-0000-00000000d004', '2026-07-20', '2026-07-20 09:00:00-05', '2026-07-20 11:00:00-05', 'completed', 'Fixture session d1');

insert into attendance (id, session_id, student_id, status, check_in_at, check_out_at, hours_override, method) values
  ('00000000-0000-0000-0000-0000000f0005', '00000000-0000-0000-0000-00000000e005', '00000000-0000-0000-0000-00000000c004', 'present', '2026-07-20 12:00:00-05', '2026-07-20 13:00:00-05', null, 'qr');

-- ---------------------------------------------------------------------------
-- Case (d): no-completed-sessions "-" case
-- One counts_participation event/session for Team Echo, left in status
-- 'scheduled' (never 'completed'). No attendance row is inserted at all --
-- v_student_participation's `expected` CTE requires es.status = 'completed',
-- so Student Echo/Team Echo must produce zero rows from both
-- v_student_participation and v_team_participation, not a row with
-- expected_ct = 0.
-- ---------------------------------------------------------------------------
insert into events (id, season_id, type, title, description, location_name, address, team_ids, counts_participation, counts_volunteer_hours)
values (
  '00000000-0000-0000-0000-00000000d005', '00000000-0000-0000-0000-00000000b001', 'meeting',
  'Fixture Event Echo Not Yet Completed', 'Fixture event for case (d).', 'Fixture Shop', '1 Fixture Way',
  array['00000000-0000-0000-0000-00000000a005']::uuid[], true, false
);

insert into event_sessions (id, event_id, session_date, starts_at, ends_at, status, notes) values
  ('00000000-0000-0000-0000-00000000e006', '00000000-0000-0000-0000-00000000d005', '2026-08-01', '2026-08-01 09:00:00-05', '2026-08-01 10:00:00-05', 'scheduled', 'Fixture session e1');

commit;
