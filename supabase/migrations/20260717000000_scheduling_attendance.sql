-- T010: Scheduling/attendance tables (PRD Section 8.1)
-- Additive migration only. Creates: invites, events, event_sessions, rsvps, attendance.
-- Every table gets: id uuid pk default gen_random_uuid(), created_at timestamptz
-- default now().
-- FKs use `on delete restrict` per PRD 8.1's stated default, EXCEPT
-- event_sessions.event_id, which is the one explicitly noted `on delete cascade`
-- exception in this batch.
--
-- This migration reuses `role_enum`, created in T009's
-- 20260716000000_identity_roster.sql migration; it is not redefined here.
-- References to `profiles`, `students`, and `seasons` target tables created in
-- that same T009 migration, which applies first.
--
-- NOTE: no PII in this file. No seed/fixture data is included.

-- invites: email text, role role_enum, student_id uuid null (self for students /
-- linked kid for parents), invited_by fk profiles, status text(...), expires_at
create table public.invites (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  role role_enum not null,
  student_id uuid references public.students (id) on delete restrict,
  invited_by uuid not null references public.profiles (id) on delete restrict,
  status text not null check (status in ('pending', 'accepted', 'expired', 'revoked')),
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

-- events: season_id fk, type text(...), title, description, location_name,
-- address, team_ids uuid[] null (null = all teams), counts_participation bool,
-- counts_volunteer_hours bool, adult_volunteers_count int default 0,
-- adult_volunteer_hours numeric default 0, created_by fk profiles null (imports)
create table public.events (
  id uuid primary key default gen_random_uuid(),
  season_id uuid not null references public.seasons (id) on delete restrict,
  type text not null check (type in ('meeting', 'outreach', 'competition')),
  title text not null,
  description text not null,
  location_name text not null,
  address text not null,
  team_ids uuid[],
  counts_participation boolean not null,
  counts_volunteer_hours boolean not null,
  adult_volunteers_count integer not null default 0,
  adult_volunteer_hours numeric not null default 0,
  created_by uuid references public.profiles (id) on delete restrict,
  created_at timestamptz not null default now()
);

-- event_sessions: event_id fk **on delete cascade** (only exception in this
-- batch), session_date date, starts_at timestamptz, ends_at timestamptz,
-- status text(...), people_reached int null, notes text
create table public.event_sessions (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  session_date date not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status text not null check (status in ('scheduled', 'completed', 'canceled')),
  people_reached integer,
  notes text not null,
  created_at timestamptz not null default now()
);

-- rsvps: session_id fk, student_id fk, status text(...), responded_by fk
-- profiles null (imports), updated_at, unique(session, student)
create table public.rsvps (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.event_sessions (id) on delete restrict,
  student_id uuid not null references public.students (id) on delete restrict,
  status text not null check (status in ('going', 'maybe', 'declined')),
  responded_by uuid references public.profiles (id) on delete restrict,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (session_id, student_id)
);

-- attendance: session_id fk, student_id fk, status text(...), check_in_at
-- timestamptz null, check_out_at timestamptz null, hours_override numeric
-- null, method text(...), recorded_by fk profiles null, updated_at,
-- unique(session, student)
create table public.attendance (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.event_sessions (id) on delete restrict,
  student_id uuid not null references public.students (id) on delete restrict,
  status text not null check (status in ('present', 'late', 'excused', 'absent')),
  check_in_at timestamptz,
  check_out_at timestamptz,
  hours_override numeric,
  method text not null check (method in ('qr', 'coach', 'import')),
  recorded_by uuid references public.profiles (id) on delete restrict,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (session_id, student_id)
);
