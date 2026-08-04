-- T503 test fixture. Fabricated names only (constitution item 6).
--
-- TWO teams, deliberately -- Team A (One, Two) and an UNRELATED Team B
-- (Four) -- so the C1 assertion can prove the widened policy is genuinely
-- unrestricted ("any authenticated user", the 2026-08-04 ruling's scope),
-- not merely widened to same-team visibility, which a same-team-only
-- fixture cannot discriminate.
--
-- Session hours (2h/3h/1h) mirror the premise gate's own fixture so the
-- view row counts this file's assertions expect line up with the gate's
-- already-measured numbers; the cross-team student/session are new.
begin;

insert into seasons (id, name, starts_on, ends_on, default_goal_hours, is_active)
values ('20000000-0000-4000-8000-200000000001', 'T503 Test Season', '2026-01-01', '2026-12-31', 100, true);

insert into teams (id, name, short_name, color)
values
  ('20000000-0000-4000-8000-200000000002', 'T503 Team A', 'T503A', '#111111'),
  ('20000000-0000-4000-8000-200000000003', 'T503 Team B', 'T503B', '#222222');

insert into auth.users (id, email) values
  ('20000000-0000-4000-8000-200000000011', 't503.student.one@example.test'),
  ('20000000-0000-4000-8000-200000000012', 't503.student.two@example.test'),
  ('20000000-0000-4000-8000-200000000014', 't503.student.four@example.test');

insert into public.profiles (id, display_name, email, role, avatar_url) values
  ('20000000-0000-4000-8000-200000000011', 'T503 Student One', 't503.student.one@example.test', 'student', ''),
  ('20000000-0000-4000-8000-200000000012', 'T503 Student Two', 't503.student.two@example.test', 'student', ''),
  ('20000000-0000-4000-8000-200000000014', 'T503 Student Four', 't503.student.four@example.test', 'student', '');

insert into students (id, profile_id, display_name, team_id, grad_year, is_active) values
  ('20000000-0000-4000-8000-200000000021', '20000000-0000-4000-8000-200000000011', 'T503 Student One', '20000000-0000-4000-8000-200000000002', 2027, true),
  ('20000000-0000-4000-8000-200000000022', '20000000-0000-4000-8000-200000000012', 'T503 Student Two', '20000000-0000-4000-8000-200000000002', 2027, true),
  ('20000000-0000-4000-8000-200000000024', '20000000-0000-4000-8000-200000000014', 'T503 Student Four', '20000000-0000-4000-8000-200000000003', 2027, true);

-- Event / sessions for Team A (matches the premise gate's own 2h/3h/1h shape).
insert into events (id, season_id, type, title, description, location_name, address, team_ids, counts_participation, counts_volunteer_hours)
values ('20000000-0000-4000-8000-200000000031', '20000000-0000-4000-8000-200000000001', 'outreach',
        'T503 Team A Outreach', 'T503 test fixture.', 'Test Site A', '1 Test Way',
        array['20000000-0000-4000-8000-200000000002']::uuid[], false, true);

insert into event_sessions (id, event_id, session_date, starts_at, ends_at, status, notes) values
  ('20000000-0000-4000-8000-200000000041', '20000000-0000-4000-8000-200000000031', '2026-08-10', '2026-08-10 09:00:00-05', '2026-08-10 11:00:00-05', 'scheduled', 'S1 2h'),
  ('20000000-0000-4000-8000-200000000042', '20000000-0000-4000-8000-200000000031', '2026-08-11', '2026-08-11 09:00:00-05', '2026-08-11 12:00:00-05', 'scheduled', 'S2 3h'),
  ('20000000-0000-4000-8000-200000000043', '20000000-0000-4000-8000-200000000031', '2026-08-12', '2026-08-12 09:00:00-05', '2026-08-12 10:00:00-05', 'scheduled', 'S3 1h no-rsvps');

-- Event / session for the UNRELATED Team B (proves C1 is org-wide, not team-scoped).
insert into events (id, season_id, type, title, description, location_name, address, team_ids, counts_participation, counts_volunteer_hours)
values ('20000000-0000-4000-8000-200000000032', '20000000-0000-4000-8000-200000000001', 'outreach',
        'T503 Team B Outreach', 'T503 test fixture, unrelated team.', 'Test Site B', '2 Test Way',
        array['20000000-0000-4000-8000-200000000003']::uuid[], false, true);

insert into event_sessions (id, event_id, session_date, starts_at, ends_at, status, notes) values
  ('20000000-0000-4000-8000-200000000044', '20000000-0000-4000-8000-200000000032', '2026-08-13', '2026-08-13 09:00:00-05', '2026-08-13 10:00:00-05', 'scheduled', 'S4 1h, Team B only');

insert into rsvps (id, session_id, student_id, status, responded_by) values
  ('20000000-0000-4000-8000-200000000051', '20000000-0000-4000-8000-200000000041', '20000000-0000-4000-8000-200000000021', 'going', '20000000-0000-4000-8000-200000000011'),
  ('20000000-0000-4000-8000-200000000052', '20000000-0000-4000-8000-200000000041', '20000000-0000-4000-8000-200000000022', 'going', '20000000-0000-4000-8000-200000000012'),
  ('20000000-0000-4000-8000-200000000053', '20000000-0000-4000-8000-200000000042', '20000000-0000-4000-8000-200000000022', 'going', '20000000-0000-4000-8000-200000000012'),
  ('20000000-0000-4000-8000-200000000054', '20000000-0000-4000-8000-200000000044', '20000000-0000-4000-8000-200000000024', 'going', '20000000-0000-4000-8000-200000000014');
commit;
