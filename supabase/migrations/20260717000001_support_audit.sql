-- T011: Support/audit tables + DATA-02 audit triggers (PRD Section 8.1 / DATA-02)
-- Additive migration only. Creates: notification_prefs, calendar_feeds, email_log,
-- audit_log, plus five trigger functions/triggers that write audit_log rows for the
-- DATA-02 events: post-completion attendance edits, profile role changes, student
-- deactivations, event/session cancellations, and invite revocations.
--
-- Every new table gets: id uuid pk default gen_random_uuid(), created_at timestamptz
-- default now(). FKs use `on delete restrict` per PRD 8.1's stated default, except
-- where the field list below explicitly leaves a column as a bare (non-FK) uuid, as
-- noted per-table.
--
-- This migration reuses `role_enum` and references `profiles`, `students`, `events`,
-- `event_sessions`, `attendance`, and `invites`, all created in T009's
-- 20260716000000_identity_roster.sql and T010's 20260717000000_scheduling_attendance.sql
-- migrations, which apply first. Neither of those files is modified by this migration.
--
-- NOTE: no PII in this file. No seed/fixture data is included. `audit_log.meta` payloads
-- below only ever carry IDs and enum/status values -- never names, emails, or other
-- identifying text (constitution item 6, BLOCKER if violated).

-- ---------------------------------------------------------------------------
-- Support tables (PRD 8.1)
-- ---------------------------------------------------------------------------

-- notification_prefs: profile_id fk profiles (unique, one row per profile), one bool
-- per EML-02 category, digest_enabled bool default true.
-- ASSUMPTION: the packet only specifies a default for `digest_enabled`. The six
-- per-category bools are given the same `not null default true` treatment for
-- consistency (opt-in-by-default notifications) since the PRD excerpt provided here
-- does not state otherwise; flagged in worker output rather than left silently
-- undocumented.
create table public.notification_prefs (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null unique references public.profiles (id) on delete restrict,
  invite boolean not null default true,
  signup_confirm boolean not null default true,
  event_reminder_48h boolean not null default true,
  event_reminder_3h boolean not null default true,
  meeting_reminder_3h boolean not null default true,
  weekly_digest boolean not null default true,
  digest_enabled boolean not null default true,
  created_at timestamptz not null default now()
);

-- calendar_feeds: profile_id fk profiles, token uuid unique default gen_random_uuid(),
-- revoked_at timestamptz null (nullable per field list).
create table public.calendar_feeds (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete restrict,
  token uuid not null unique default gen_random_uuid(),
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

-- email_log: to_email text, template text, session_id uuid null, profile_id uuid null,
-- status text, sent_at timestamptz.
-- DESIGN NOTE: unlike notification_prefs.profile_id / calendar_feeds.profile_id, the
-- field list for email_log does NOT annotate session_id/profile_id as `fk` (only as
-- `null`), so this migration deliberately does NOT add foreign-key constraints on
-- email_log.session_id / email_log.profile_id. A delivery log should remain queryable
-- even after the referenced session/profile row is later deleted (e.g. a canceled
-- event's sessions, or a deactivated/removed profile) -- enforcing `on delete restrict`
-- here would otherwise block legitimate deletes elsewhere just because an email was
-- once sent. status is left as unconstrained `text` (no check constraint) because the
-- PRD excerpt in this packet does not enumerate allowed status values, unlike
-- `invites.status` / `event_sessions.status` in T010, which do give explicit value
-- lists.
create table public.email_log (
  id uuid primary key default gen_random_uuid(),
  to_email text not null,
  template text not null,
  session_id uuid,
  profile_id uuid,
  status text not null,
  sent_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

-- audit_log: actor fk profiles, action text, entity text, entity_id uuid, meta jsonb.
-- `actor` is NOT NULL per the literal field list (no `null` annotation given, unlike
-- calendar_feeds.revoked_at / email_log.session_id / email_log.profile_id, which are
-- explicitly marked nullable). See the "actor resolution strategy" note in worker
-- output for the auth.uid()-with-fallback approach used to populate this column from
-- the trigger functions below, and the "known risks" note on what happens when neither
-- resolves.
create table public.audit_log (
  id uuid primary key default gen_random_uuid(),
  actor uuid not null references public.profiles (id) on delete restrict,
  action text not null,
  entity text not null,
  entity_id uuid not null,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- DATA-02: audit-log triggers
-- ---------------------------------------------------------------------------
-- Shared actor-resolution expression used by every trigger function below:
--   coalesce(auth.uid(), nullif(current_setting('app.actor_id', true), '')::uuid)
-- Primary source is auth.uid() (populated from the caller's JWT under normal
-- RLS-authenticated Supabase requests). Fallback is the Postgres session variable
-- app.actor_id, which non-interactive/service-role callers (background jobs, admin
-- scripts, imports) can `set local app.actor_id = '<profile-uuid>'` before running an
-- UPDATE, so their audit rows still resolve to a real acting profile instead of
-- silently failing. If neither resolves, the resulting NULL actor will violate
-- audit_log.actor's NOT NULL constraint and abort the triggering UPDATE -- see "known
-- risks" in worker output.
--
-- All trigger functions are SECURITY DEFINER with a locked-down search_path, so that a
-- caller who is permitted (by RLS on the base table) to perform the UPDATE can always
-- write the corresponding audit_log row, even if audit_log itself later gets stricter
-- RLS than the base tables (RLS policies are out of scope for this migration/task).

-- 1. Attendance edits made after the parent session has completed.
-- Looks up event_sessions.status live via NEW.session_id (not a cached/stored flag),
-- per the packet's explicit instruction. Only fires (writes an audit row) when that
-- live status is 'completed'; edits while the session is still 'scheduled' (or
-- 'canceled') are ordinary/live activity and must NOT be audit-logged.
create or replace function public.fn_audit_attendance_post_completion()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_session_status text;
begin
  select status into v_session_status
  from public.event_sessions
  where id = new.session_id;

  if v_session_status = 'completed' then
    insert into public.audit_log (actor, action, entity, entity_id, meta)
    values (
      coalesce(auth.uid(), nullif(current_setting('app.actor_id', true), '')::uuid),
      'attendance_edited_post_completion',
      'attendance',
      new.id,
      jsonb_build_object(
        'session_id', new.session_id,
        'student_id', new.student_id,
        'old_status', old.status,
        'new_status', new.status
      )
    );
  end if;

  return new;
end;
$$;

create trigger trg_audit_attendance_post_completion
  after update on public.attendance
  for each row
  execute function public.fn_audit_attendance_post_completion();

-- 2. Profile role changes: fires only when role actually changes value.
create or replace function public.fn_audit_profile_role_change()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.audit_log (actor, action, entity, entity_id, meta)
  values (
    coalesce(auth.uid(), nullif(current_setting('app.actor_id', true), '')::uuid),
    'profile_role_changed',
    'profiles',
    new.id,
    jsonb_build_object('old_role', old.role, 'new_role', new.role)
  );
  return new;
end;
$$;

create trigger trg_audit_profile_role_change
  after update on public.profiles
  for each row
  when (old.role is distinct from new.role)
  execute function public.fn_audit_profile_role_change();

-- 3. Student deactivations: fires only on the true -> false transition of is_active.
-- AMBIGUITY (case 3, per packet instruction): PRD DATA-02 (as excerpted in this
-- packet) does not explicitly say whether reactivation (false -> true) should also be
-- audited. Per the packet's explicit fallback instruction ("if ambiguous, audit-log
-- the true->false transition only and note the ambiguity ... rather than guessing
-- silently"), this migration audits ONLY the deactivation direction (true -> false).
-- Reactivations are not audit-logged by this migration. See worker output.
create or replace function public.fn_audit_student_deactivation()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.audit_log (actor, action, entity, entity_id, meta)
  values (
    coalesce(auth.uid(), nullif(current_setting('app.actor_id', true), '')::uuid),
    'student_deactivated',
    'students',
    new.id,
    jsonb_build_object('old_is_active', old.is_active, 'new_is_active', new.is_active)
  );
  return new;
end;
$$;

create trigger trg_audit_student_deactivation
  after update on public.students
  for each row
  when (old.is_active = true and new.is_active = false)
  execute function public.fn_audit_student_deactivation();

-- 4. Event/session cancellations: fires when status transitions specifically to
-- 'canceled'.
-- AMBIGUITY (case 4, per packet instruction): checked both tables per the packet's
-- instruction. public.events (as created by T010's migration, left untouched by this
-- migration) has NO status column at all -- only event_sessions carries the
-- 'scheduled'|'completed'|'canceled' check-constrained status. So this trigger is
-- attached to event_sessions only; there is no events-table cancellation trigger
-- because there is no events.status column to transition. See worker output.
create or replace function public.fn_audit_session_cancellation()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.audit_log (actor, action, entity, entity_id, meta)
  values (
    coalesce(auth.uid(), nullif(current_setting('app.actor_id', true), '')::uuid),
    'session_canceled',
    'event_sessions',
    new.id,
    jsonb_build_object(
      'event_id', new.event_id,
      'old_status', old.status,
      'new_status', new.status
    )
  );
  return new;
end;
$$;

create trigger trg_audit_session_cancellation
  after update on public.event_sessions
  for each row
  when (old.status is distinct from new.status and new.status = 'canceled')
  execute function public.fn_audit_session_cancellation();

-- 5. Invite revocations: fires when status transitions specifically to 'revoked'.
create or replace function public.fn_audit_invite_revocation()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.audit_log (actor, action, entity, entity_id, meta)
  values (
    coalesce(auth.uid(), nullif(current_setting('app.actor_id', true), '')::uuid),
    'invite_revoked',
    'invites',
    new.id,
    jsonb_build_object('old_status', old.status, 'new_status', new.status)
  );
  return new;
end;
$$;

create trigger trg_audit_invite_revocation
  after update on public.invites
  for each row
  when (old.status is distinct from new.status and new.status = 'revoked')
  execute function public.fn_audit_invite_revocation();
