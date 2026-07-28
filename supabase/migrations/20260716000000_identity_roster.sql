-- T009: Identity/roster tables (PRD Section 8.1)
-- Additive migration only. Creates: profiles, teams, seasons, students, guardian_links.
-- Every table gets: id uuid pk default gen_random_uuid() (except profiles.id, which is
-- auth.users.id per PRD 8.1), created_at timestamptz default now().
-- FKs use `on delete restrict` per PRD 8.1's stated default (no relationship below is
-- noted as an exception in 8.1).
--
-- NOTE: no PII in this file. No seed/fixture data is included.

-- Shared enum for profiles.role (also referenced by other PRD 8.1 tables such as
-- `invites`, which are out of scope for this migration).
create type role_enum as enum ('admin', 'coach', 'student', 'parent');

-- profiles: id = auth.users.id (pk, fk), display_name text, email text unique,
-- role role_enum(...), avatar_url text, theme_mode text default 'system'
create table public.profiles (
  id uuid primary key references auth.users (id) on delete restrict,
  display_name text not null,
  email text not null unique,
  role role_enum not null,
  avatar_url text not null,
  theme_mode text not null default 'system',
  created_at timestamptz not null default now()
);

-- teams: name text unique, short_name text, program text null check in
-- ('FRC','FTC','Other'), color text, archived bool default false, sort_order int
-- default 0
create table public.teams (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  short_name text not null,
  program text check (program in ('FRC', 'FTC', 'Other')),
  color text not null,
  archived boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

-- seasons: name text, starts_on date, ends_on date, default_goal_hours numeric
-- default 100, is_active bool (partial unique index where true)
create table public.seasons (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  starts_on date not null,
  ends_on date not null,
  default_goal_hours numeric not null default 100,
  is_active boolean not null,
  created_at timestamptz not null default now()
);

-- Partial unique index: at most one season may have is_active = true.
create unique index seasons_single_active_idx
  on public.seasons (is_active)
  where is_active = true;

-- students: profile_id uuid null fk profiles, display_name text, team_id fk teams,
-- grad_year int null, is_active bool default true, goal_hours_override numeric null
create table public.students (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references public.profiles (id) on delete restrict,
  display_name text not null,
  team_id uuid not null references public.teams (id) on delete restrict,
  grad_year integer,
  is_active boolean not null default true,
  goal_hours_override numeric,
  created_at timestamptz not null default now()
);

-- guardian_links: parent_profile_id fk profiles, student_id fk students,
-- relationship text, unique(parent, student)
create table public.guardian_links (
  id uuid primary key default gen_random_uuid(),
  parent_profile_id uuid not null references public.profiles (id) on delete restrict,
  student_id uuid not null references public.students (id) on delete restrict,
  relationship text not null,
  created_at timestamptz not null default now(),
  unique (parent_profile_id, student_id)
);
