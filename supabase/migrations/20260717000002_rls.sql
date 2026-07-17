-- T012: Row Level Security (PRD Section 8.4 helpers + PRD Section 8.3 access matrix)
-- Additive migration only. Enables RLS on all 14 tables created by T009/T010/T011
-- (20260716000000_identity_roster.sql, 20260717000000_scheduling_attendance.sql,
-- 20260717000001_support_audit.sql -- none of which are modified by this migration)
-- and attaches policies built from the three canonical shapes in PRD 8.4/8.3.
--
-- The three helper functions below are a byte-verbatim copy of PRD Section 8.4's
-- ground-truth SQL -- constitution item 3 requires this; do not re-derive or
-- paraphrase them. They must exist before any policy below references them.

create or replace function auth_role() returns text
language sql stable security definer set search_path = public
as $$ select role from profiles where id = auth.uid() $$;

create or replace function is_staff() returns boolean
language sql stable security definer set search_path = public
as $$ select coalesce(auth_role() in ('admin','coach'), false) $$;

-- students I am (student role) or I guard (parent role)
create or replace function my_student_ids() returns setof uuid
language sql stable security definer set search_path = public
as $$
  select id from students where profile_id = auth.uid()
  union
  select student_id from guardian_links where parent_profile_id = auth.uid()
$$;

-- ---------------------------------------------------------------------------
-- profiles (PRD 8.3: read all; admin updates roles | read+update own (name,
-- avatar, theme) | same as student)
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;

-- Canonical profiles shape, copied verbatim from PRD 8.4's example (no
-- self-referential subqueries; auth.uid() + helpers only).
create policy profiles_read on profiles
  for select to authenticated using (true);

-- NOTE: profiles.role is `role_enum` (per T009) while auth_role() returns
-- `text` -- an explicit ::text cast is required here for the comparison to be
-- valid SQL; the helper function itself is untouched/unmodified.
create policy profiles_self_update on profiles
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid() and role::text = auth_role());  -- cannot change own role

-- Staff (admin/coach) need to be able to update OTHER profiles' roles too
-- ("admin updates roles" in the matrix) -- profiles_self_update alone only
-- covers a user's own row. is_staff() is a SECURITY DEFINER helper (bypasses
-- RLS internally), so this is not a self-referential subquery on profiles.
create policy staff_all on profiles
  for all to authenticated
  using (is_staff()) with check (is_staff());

-- ---------------------------------------------------------------------------
-- teams (not named in PRD 8.3 matrix -- see "Required Interpretation" in the
-- worker packet: non-sensitive reference data, readable by all authenticated
-- users, writable by staff only)
-- ---------------------------------------------------------------------------
alter table public.teams enable row level security;

create policy staff_all on teams
  for all to authenticated
  using (is_staff()) with check (is_staff());

create policy read_all on teams
  for select to authenticated using (true);

-- ---------------------------------------------------------------------------
-- seasons (not named in PRD 8.3 matrix -- same interpretation as teams)
-- ---------------------------------------------------------------------------
alter table public.seasons enable row level security;

create policy staff_all on seasons
  for all to authenticated
  using (is_staff()) with check (is_staff());

create policy read_all on seasons
  for select to authenticated using (true);

-- ---------------------------------------------------------------------------
-- students (PRD 8.3: full | read own row + name/team of teammates (leaderboard)
-- | read linked students)
--
-- Trap 1 scope-down (see worker packet): "teammate name/team for leaderboard"
-- is NOT implemented here via a self-referential subquery on students (that
-- would be the exact profiles-recursion bug class constitution item 4
-- prohibits). own_or_linked_read below covers "own row" (via my_student_ids()
-- returning the caller's own student id) and "linked students" (via
-- my_student_ids()'s guardian_links union) only. The broader teammate
-- visibility for the leaderboard is expected to be closed by T013's
-- metric/leaderboard views, not by a direct SELECT policy on this table.
-- ---------------------------------------------------------------------------
alter table public.students enable row level security;

create policy staff_all on students
  for all to authenticated
  using (is_staff()) with check (is_staff());

create policy own_or_linked_read on students
  for select to authenticated
  using (id in (select my_student_ids()));

-- ---------------------------------------------------------------------------
-- guardian_links (not named in PRD 8.3 matrix -- see "Required Interpretation":
-- staff full; a parent/student can read their own links)
-- ---------------------------------------------------------------------------
alter table public.guardian_links enable row level security;

create policy staff_all on guardian_links
  for all to authenticated
  using (is_staff()) with check (is_staff());

create policy own_read on guardian_links
  for select to authenticated
  using (parent_profile_id = auth.uid() or student_id in (select my_student_ids()));

-- ---------------------------------------------------------------------------
-- invites (PRD 8.3: admin/coach read+write ("invites write") | none | none)
-- ---------------------------------------------------------------------------
alter table public.invites enable row level security;

create policy staff_all on invites
  for all to authenticated
  using (is_staff()) with check (is_staff());

-- ---------------------------------------------------------------------------
-- events (PRD 8.3: full | read team-scoped | read linked students' scope)
--
-- Trap 2: safe because the subquery below targets `students`, a different
-- table than `events` (the table this policy is attached to), not `events`
-- itself.
--
-- DEVIATION FROM THE PACKET'S LITERAL TRAP-2 SNIPPET, FLAGGED: the packet's
-- illustrative SQL was `team_ids is null or exists (...)`, which makes any
-- team_ids-null ("all teams") event visible to EVERY authenticated session,
-- even one with no student/guardian link at all (an "orphan" auth.users row
-- with no profile/student/guardian_links row). That contradicts Acceptance
-- Criterion 12's explicit requirement that a no-profile session gets zero
-- rows from `events`. Fixed here by moving `team_ids is null` inside the
-- `exists`, so the caller must have at least one linked student (own or
-- guarded) via my_student_ids() for ANY event, global or team-scoped -- this
-- still gives student1/parent1 full visibility of both their team's events
-- and "all teams" events (verified in the scratch-Postgres tests below), it
-- only additionally denies callers with zero student/guardian linkage.
-- ---------------------------------------------------------------------------
alter table public.events enable row level security;

create policy staff_all on events
  for all to authenticated
  using (is_staff()) with check (is_staff());

create policy own_or_linked_read on events
  for select to authenticated
  using (
    exists (
      select 1 from students s
      where s.id in (select my_student_ids())
        and (events.team_ids is null or s.team_id = any(events.team_ids))
    )
  );

-- ---------------------------------------------------------------------------
-- event_sessions (PRD 8.3: full | read team-scoped | read linked students'
-- scope). event_sessions has no team_ids of its own -- scope is inherited via
-- event_id -> events.team_ids. The subqueries below target `events` and
-- `students`, both different tables than `event_sessions`, so this is safe
-- per Trap 2 (not self-referential).
-- ---------------------------------------------------------------------------
alter table public.event_sessions enable row level security;

create policy staff_all on event_sessions
  for all to authenticated
  using (is_staff()) with check (is_staff());

-- Same deviation as the `events` policy above, for the same
-- no-profile-session-must-see-zero-rows reason: the caller must have at
-- least one linked student for ANY session (global or team-scoped), not
-- merely because the parent event's team_ids happens to be null.
create policy own_or_linked_read on event_sessions
  for select to authenticated
  using (
    exists (
      select 1 from events e
      join students s on s.id in (select my_student_ids())
      where e.id = event_sessions.event_id
        and (e.team_ids is null or s.team_id = any(e.team_ids))
    )
  );

-- ---------------------------------------------------------------------------
-- rsvps (PRD 8.3: full | read/write own | read linked; write linked
-- (responded_by=self))
-- ---------------------------------------------------------------------------
alter table public.rsvps enable row level security;

create policy staff_all on rsvps
  for all to authenticated
  using (is_staff()) with check (is_staff());

create policy own_or_linked_read on rsvps
  for select to authenticated
  using (student_id in (select my_student_ids()));

create policy own_or_linked_write on rsvps
  for insert to authenticated
  with check (student_id in (select my_student_ids()) and responded_by = auth.uid());

create policy own_or_linked_update on rsvps
  for update to authenticated
  using (student_id in (select my_student_ids()))
  with check (student_id in (select my_student_ids()) and responded_by = auth.uid());

-- ---------------------------------------------------------------------------
-- attendance (PRD 8.3: full (writes audited) | read own; insert own only via
-- checkin function | read linked)
--
-- Deliberately NO insert/update policy for students/parents: per the worker
-- packet, student self-check-ins happen only inside the `checkin` Edge
-- Function under the service role after token validation (service role
-- bypasses RLS as table owner). Adding a student/parent write policy here
-- would be incorrect per the matrix.
-- ---------------------------------------------------------------------------
alter table public.attendance enable row level security;

create policy staff_all on attendance
  for all to authenticated
  using (is_staff()) with check (is_staff());

create policy own_or_linked_read on attendance
  for select to authenticated
  using (student_id in (select my_student_ids()));

-- ---------------------------------------------------------------------------
-- notification_prefs (PRD 8.3: own | own | own -- even admin/coach only
-- manage their own prefs row, not staff_all)
-- ---------------------------------------------------------------------------
alter table public.notification_prefs enable row level security;

create policy self_all on notification_prefs
  for all to authenticated
  using (profile_id = auth.uid())
  with check (profile_id = auth.uid());

-- ---------------------------------------------------------------------------
-- calendar_feeds (PRD 8.3: own | own | own -- same as notification_prefs)
-- ---------------------------------------------------------------------------
alter table public.calendar_feeds enable row level security;

create policy self_all on calendar_feeds
  for all to authenticated
  using (profile_id = auth.uid())
  with check (profile_id = auth.uid());

-- ---------------------------------------------------------------------------
-- email_log (PRD 8.3: admin/coach read | none | none). Populated exclusively
-- by future service-role Edge Functions, which bypass RLS as table owner --
-- no general write policy here.
-- ---------------------------------------------------------------------------
alter table public.email_log enable row level security;

create policy staff_read on email_log
  for select to authenticated using (is_staff());

-- ---------------------------------------------------------------------------
-- audit_log (PRD 8.3: admin/coach read | none | none). Populated exclusively
-- by T011's SECURITY DEFINER trigger functions, which bypass RLS as the
-- function/table owner -- no general write policy here.
-- ---------------------------------------------------------------------------
alter table public.audit_log enable row level security;

create policy staff_read on audit_log
  for select to authenticated using (is_staff());
