-- Persona fixtures for the UI end-to-end harness.
--
-- Every name below is fabricated (constitution item 6) — no real student,
-- parent, coach or contact detail appears anywhere in this file.
--
-- Loaded by tests/e2e-harness/start.sh AFTER supabase/migrations/*.sql, as
-- the postgres superuser, so RLS does not filter the seed itself. What the
-- personas can then SEE is decided entirely by the real policies at request
-- time — this file grants no visibility of its own.

-- The harness stores a SHA-256 of the persona password on the auth.users
-- stub. Real GoTrue uses bcrypt in its own `encrypted_password` column; this
-- is harness bookkeeping and is never part of the app's own surface.
alter table auth.users add column if not exists harness_password text;
alter table auth.users add column if not exists updated_at timestamptz default now();

-- Re-runnable: drop harness rows in FK-safe order.
truncate table attendance, rsvps, audit_log, calendar_feeds, notification_prefs,
  invites, guardian_links, student_teams, event_sessions, events, students,
  profiles, teams, seasons restart identity cascade;
delete from auth.users;

/* --------------------------------------------------------------- seasons */
insert into seasons (id, name, starts_on, ends_on, default_goal_hours, is_active, leaderboard_privacy_enabled)
values
  ('50000000-0000-4000-8000-000000000001', '2026 Build Season',
   (current_date - interval '90 days')::date, (current_date + interval '120 days')::date, 100, true, true),
  ('50000000-0000-4000-8000-000000000002', '2025 Build Season',
   (current_date - interval '450 days')::date, (current_date - interval '200 days')::date, 90, false, true);

/* ----------------------------------------------------------------- teams */
insert into teams (id, name, short_name, program, color, archived, sort_order) values
  ('7ea11000-0000-4000-8000-000000000001', 'Volt Robotics 9911', 'Volt 9911', 'FRC', '#F5C518', false, 1),
  ('7ea11000-0000-4000-8000-000000000002', 'Volt Junior 4402',   'Volt 4402', 'FTC', '#3B82F6', false, 2),
  ('7ea11000-0000-4000-8000-000000000003', 'Volt Legacy 2201',   'Volt 2201', 'FRC', '#9CA3AF', true,  3);

/* -------------------------------------------------------- auth + profiles */
-- Password for every persona is 'VoltTest!2026'; the SHA-256 below is that
-- literal string. Keep the two in sync if you change it.
insert into auth.users (id, email, email_confirmed_at, last_sign_in_at, raw_user_meta_data, harness_password) values
  ('a0000000-0000-4000-8000-000000000001', 'admin@volt.test',   now() - interval '200 days', null, '{}'::jsonb, encode(sha256('VoltTest!2026'::bytea), 'hex')),
  ('a0000000-0000-4000-8000-000000000002', 'coach@volt.test',   now() - interval '190 days', null, '{}'::jsonb, encode(sha256('VoltTest!2026'::bytea), 'hex')),
  ('a0000000-0000-4000-8000-000000000003', 'student@volt.test', now() - interval '180 days', null, '{}'::jsonb, encode(sha256('VoltTest!2026'::bytea), 'hex')),
  ('a0000000-0000-4000-8000-000000000004', 'parent@volt.test',  now() - interval '170 days', null, '{}'::jsonb, encode(sha256('VoltTest!2026'::bytea), 'hex')),
  ('a0000000-0000-4000-8000-000000000005', 'student2@volt.test',now() - interval '160 days', null, '{}'::jsonb, encode(sha256('VoltTest!2026'::bytea), 'hex'));

insert into profiles (id, display_name, email, role, theme_mode) values
  ('a0000000-0000-4000-8000-000000000001', 'Marcus Webb',   'admin@volt.test',    'admin',   'system'),
  ('a0000000-0000-4000-8000-000000000002', 'Dana Reyes',    'coach@volt.test',    'coach',   'system'),
  ('a0000000-0000-4000-8000-000000000003', 'Priya Raman',   'student@volt.test',  'student', 'system'),
  ('a0000000-0000-4000-8000-000000000004', 'Alex Raman',    'parent@volt.test',   'parent',  'system'),
  ('a0000000-0000-4000-8000-000000000005', 'Jordan Okafor', 'student2@volt.test', 'student', 'system');

/* -------------------------------------------------------------- students */
insert into students (id, profile_id, display_name, team_id, grad_year, is_active, goal_hours_override) values
  ('57000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000003', 'Priya Raman',   '7ea11000-0000-4000-8000-000000000001', 2027, true, null),
  ('57000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000005', 'Jordan Okafor', '7ea11000-0000-4000-8000-000000000001', 2026, true, 120),
  ('57000000-0000-4000-8000-000000000003', null, 'Sam Whitfield',  '7ea11000-0000-4000-8000-000000000001', 2028, true,  null),
  ('57000000-0000-4000-8000-000000000004', null, 'Nina Kowalski',  '7ea11000-0000-4000-8000-000000000002', 2027, true,  null),
  ('57000000-0000-4000-8000-000000000005', null, 'Theo Brandt',    '7ea11000-0000-4000-8000-000000000002', 2029, true,  null),
  ('57000000-0000-4000-8000-000000000006', null, 'Casey Lindqvist','7ea11000-0000-4000-8000-000000000001', 2026, false, null);

insert into student_teams (student_id, team_id, joined_on) select id, team_id, (current_date - 80) from students;

/* ------------------------------------------------- parent guardian link  */
insert into guardian_links (parent_profile_id, student_id, relationship, created_at) values
  ('a0000000-0000-4000-8000-000000000004', '57000000-0000-4000-8000-000000000001', 'parent', '2026-01-01T00:00:00Z'),
  ('a0000000-0000-4000-8000-000000000004', '57000000-0000-4000-8000-000000000004', 'parent', '2026-01-02T00:00:00Z');

/* ---------------------------------------------------------------- events */
insert into events (id, season_id, type, title, description, location_name, address, team_ids,
                    counts_participation, counts_volunteer_hours, adult_volunteers_count, adult_volunteer_hours, created_by)
values
  ('e0e00000-0000-4000-8000-000000000001', '50000000-0000-4000-8000-000000000001', 'meeting',
   'Weeknight Build Session', 'Regular build night in the shop.', 'Shop Bay 2', '1400 Foundry Rd',
   array['7ea11000-0000-4000-8000-000000000001']::uuid[], true, false, 0, 0, 'a0000000-0000-4000-8000-000000000002'),
  ('e0e00000-0000-4000-8000-000000000002', '50000000-0000-4000-8000-000000000001', 'outreach',
   'Library STEM Night', 'Demo table for elementary visitors.', 'Central Library', '22 Civic Plaza',
   null, true, true, 3, 9, 'a0000000-0000-4000-8000-000000000001'),
  ('e0e00000-0000-4000-8000-000000000003', '50000000-0000-4000-8000-000000000001', 'competition',
   'District Qualifier', 'Two-day district event.', 'Riverside Arena', '900 Riverside Dr',
   array['7ea11000-0000-4000-8000-000000000001','7ea11000-0000-4000-8000-000000000002']::uuid[],
   true, false, 2, 16, 'a0000000-0000-4000-8000-000000000001'),
  ('e0e00000-0000-4000-8000-000000000004', '50000000-0000-4000-8000-000000000001', 'meeting',
   'Nina Team Meeting', 'A distinct FTC meeting for Nina.', 'FTC Lab', '22 Circuit Way',
   array['7ea11000-0000-4000-8000-000000000002']::uuid[], true, false, 0, 0, 'a0000000-0000-4000-8000-000000000002'),
  ('e0e00000-0000-4000-8000-000000000005', '50000000-0000-4000-8000-000000000001', 'meeting',
   'Nina Retrospective', 'A completed FTC meeting that distinguishes Nina history.', 'FTC Review Room', '22 Circuit Way',
   array['7ea11000-0000-4000-8000-000000000002']::uuid[], true, false, 0, 0, 'a0000000-0000-4000-8000-000000000002');

/* -------------------------------------------------------------- sessions */
-- Four completed build sessions (so the metric views have something to
-- compute), one live session happening right now, and one scheduled ahead.
insert into event_sessions (id, event_id, session_date, starts_at, ends_at, status, notes) values
  ('5e550000-0000-4000-8000-000000000001', 'e0e00000-0000-4000-8000-000000000001', (current_date - 21), now() - interval '21 days', now() - interval '21 days' + interval '3 hours', 'completed', ''),
  ('5e550000-0000-4000-8000-000000000002', 'e0e00000-0000-4000-8000-000000000001', (current_date - 14), now() - interval '14 days', now() - interval '14 days' + interval '3 hours', 'completed', ''),
  ('5e550000-0000-4000-8000-000000000003', 'e0e00000-0000-4000-8000-000000000001', (current_date - 7),  now() - interval '7 days',  now() - interval '7 days'  + interval '3 hours', 'completed', ''),
  ('5e550000-0000-4000-8000-000000000004', 'e0e00000-0000-4000-8000-000000000001', current_date, now() - interval '30 minutes', now() + interval '2 hours', 'scheduled', ''),
  ('5e550000-0000-4000-8000-000000000005', 'e0e00000-0000-4000-8000-000000000001', (current_date + 7),  now() + interval '7 days',  now() + interval '7 days' + interval '3 hours', 'scheduled', ''),
  ('5e550000-0000-4000-8000-000000000006', 'e0e00000-0000-4000-8000-000000000002', (current_date - 30), now() - interval '30 days', now() - interval '30 days' + interval '4 hours', 'completed', 'Busy night.'),
  ('5e550000-0000-4000-8000-000000000007', 'e0e00000-0000-4000-8000-000000000003', (current_date + 21), now() + interval '21 days', now() + interval '21 days' + interval '9 hours', 'scheduled', ''),
  -- An UPCOMING outreach session with no RSVP rows, so the student home has a
  -- real "Sign-up opportunities" entry to exercise.
  ('5e550000-0000-4000-8000-000000000008', 'e0e00000-0000-4000-8000-000000000002', (current_date + 10), now() + interval '10 days', now() + interval '10 days' + interval '4 hours', 'scheduled', ''),
  ('5e550000-0000-4000-8000-000000000009', 'e0e00000-0000-4000-8000-000000000004', (current_date + 2), now() + interval '2 days', now() + interval '2 days' + interval '2 hours', 'scheduled', ''),
  ('5e550000-0000-4000-8000-000000000010', 'e0e00000-0000-4000-8000-000000000005', (current_date - 5), now() - interval '5 days', now() - interval '5 days' + interval '2 hours', 'completed', 'Nina completed this FTC meeting.');

update event_sessions set people_reached = 140 where id = '5e550000-0000-4000-8000-000000000006';

/* ------------------------------------------------------------ attendance */
-- Priya attends everything, Jordan misses one, Sam is excused once — enough
-- spread that attendance-rate and hours views produce distinguishable numbers.
insert into attendance (session_id, student_id, status, check_in_at, check_out_at, method, recorded_by)
select s.id, st.id, 'present', s.starts_at, s.ends_at, 'coach', 'a0000000-0000-4000-8000-000000000002'
from event_sessions s
cross join (select id from students where id in (
  '57000000-0000-4000-8000-000000000001',
  '57000000-0000-4000-8000-000000000002',
  '57000000-0000-4000-8000-000000000003')) st
where s.id in ('5e550000-0000-4000-8000-000000000001','5e550000-0000-4000-8000-000000000002','5e550000-0000-4000-8000-000000000003');

update attendance set status = 'absent', check_in_at = null, check_out_at = null
where student_id = '57000000-0000-4000-8000-000000000002' and session_id = '5e550000-0000-4000-8000-000000000002';

update attendance set status = 'excused', check_in_at = null, check_out_at = null
where student_id = '57000000-0000-4000-8000-000000000003' and session_id = '5e550000-0000-4000-8000-000000000003';

insert into attendance (session_id, student_id, status, check_in_at, check_out_at, method, recorded_by)
values ('5e550000-0000-4000-8000-000000000006', '57000000-0000-4000-8000-000000000001', 'present',
        now() - interval '30 days', now() - interval '30 days' + interval '4 hours', 'coach',
        'a0000000-0000-4000-8000-000000000001');

insert into attendance (session_id, student_id, status, check_in_at, check_out_at, method, recorded_by)
values ('5e550000-0000-4000-8000-000000000010', '57000000-0000-4000-8000-000000000004', 'late',
        now() - interval '5 days', now() - interval '5 days' + interval '2 hours', 'coach',
        'a0000000-0000-4000-8000-000000000002');

/* ----------------------------------------------------------------- rsvps */
insert into rsvps (session_id, student_id, status, responded_by) values
  ('5e550000-0000-4000-8000-000000000005', '57000000-0000-4000-8000-000000000001', 'going',    'a0000000-0000-4000-8000-000000000003'),
  ('5e550000-0000-4000-8000-000000000005', '57000000-0000-4000-8000-000000000002', 'maybe',    'a0000000-0000-4000-8000-000000000005'),
  ('5e550000-0000-4000-8000-000000000007', '57000000-0000-4000-8000-000000000001', 'going',    'a0000000-0000-4000-8000-000000000003');

select 'seeded' as status,
  (select count(*) from profiles) as profiles,
  (select count(*) from students) as students,
  (select count(*) from events) as events,
  (select count(*) from event_sessions) as sessions,
  (select count(*) from attendance) as attendance;
