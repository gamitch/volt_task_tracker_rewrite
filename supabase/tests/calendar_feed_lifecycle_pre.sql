-- Rows that must exist before the lifecycle migration runs. All identities
-- and names are fabricated test data.

insert into auth.users (id, email, raw_user_meta_data) values
  ('10000000-0000-4000-8000-000000000001', 'admin.fixture@example.test', '{}'),
  ('20000000-0000-4000-8000-000000000002', 'owner.fixture@example.test', '{}'),
  ('30000000-0000-4000-8000-000000000003', 'duplicate.fixture@example.test', '{}'),
  ('40000000-0000-4000-8000-000000000004', 'staff-created.fixture@example.test', '{}'),
  ('50000000-0000-4000-8000-000000000005', 'future.fixture@example.test', '{}'),
  (
    '60000000-0000-4000-8000-000000000006',
    'invitee.fixture@example.test',
    '{"full_name":"Fixture Invitee"}'
  );

insert into public.profiles (id, display_name, email, role) values
  (
    '10000000-0000-4000-8000-000000000001',
    'Fixture Admin',
    'admin.fixture@example.test',
    'admin'
  ),
  (
    '20000000-0000-4000-8000-000000000002',
    'Fixture Owner',
    'owner.fixture@example.test',
    'student'
  ),
  (
    '30000000-0000-4000-8000-000000000003',
    'Fixture Duplicate',
    'duplicate.fixture@example.test',
    'student'
  );

-- The greatest (created_at, id) pair is ...a003. The migration must retain it
-- as active, revoke ...a001/...a002, and preserve all three rows.
insert into public.calendar_feeds (id, profile_id, token, created_at) values
  (
    '70000000-0000-4000-8000-00000000a001',
    '30000000-0000-4000-8000-000000000003',
    '71000000-0000-4000-8000-00000000a001',
    '2026-08-01 10:00:00+00'
  ),
  (
    '70000000-0000-4000-8000-00000000a002',
    '30000000-0000-4000-8000-000000000003',
    '71000000-0000-4000-8000-00000000a002',
    '2026-08-01 11:00:00+00'
  ),
  (
    '70000000-0000-4000-8000-00000000a003',
    '30000000-0000-4000-8000-000000000003',
    '71000000-0000-4000-8000-00000000a003',
    '2026-08-01 11:00:00+00'
  );

insert into public.invites (email, role, student_id, invited_by, status, expires_at)
values (
  'invitee.fixture@example.test',
  'coach',
  null,
  '10000000-0000-4000-8000-000000000001',
  'pending',
  now() + interval '7 days'
);
