/**
 * T071/T086: hand-authored row interfaces for the tables/views the app
 * needs. T071 originally covered only the subset the six flagged pages
 * (T018, T020, T021, T034, T035, T056) needed at minimum; T086 (ED-1 Packet
 * P0) extends this file with every remaining table/view every later ED-1
 * page-wiring packet needs. Every field below is transcribed verbatim from
 * the real migration SQL under `supabase/migrations/` -- exact file/line
 * cited per column in each interface's doc comment (checker evidence, per
 * the worker packet's "Required Worker Output"). Types only: this file
 * contains zero metric formula arithmetic and zero RLS logic (constitution
 * item 3, BLOCKER) -- `v_student_participation`, `v_student_hours`, and
 * `v_team_participation` below are all plain 1:1 column renames, matching
 * the approach `src/pages/reports/ParticipationTab.tsx`'s (T056)
 * `ParticipationMetricRow` already established for the first of those views.
 *
 * Nullability: a column is typed `| null` here iff its `create table`
 * definition has no `not null` (cited inline). `timestamptz`/`date` columns
 * are typed `string` (ISO 8601, as they arrive over the wire as JSON), never
 * a `Date` -- this module performs no date parsing/arithmetic of its own.
 */

/**
 * AUTH-05's real role vocabulary, verbatim from `role_enum`
 * (`supabase/migrations/20260716000000_identity_roster.sql`, line 12:
 * `create type role_enum as enum ('admin', 'coach', 'student', 'parent');`).
 *
 * Deliberately NOT `src/app/guards.tsx`'s `Role` type
 * (`'admin' | 'staff' | 'volunteer' | 'coach'`, that file's own stale T005
 * placeholder -- see that file's doc comment). See `auth.ts`'s module doc
 * for the full mismatch note; reconciliation is left to the follow-up task
 * authorized to edit `guards.tsx`, per the worker packet.
 */
export type Role = 'admin' | 'coach' | 'student' | 'parent';

/**
 * `public.profiles` -- created by
 * `supabase/migrations/20260716000000_identity_roster.sql`, lines 16-24:
 * ```
 * create table public.profiles (
 *   id uuid primary key references auth.users (id) on delete restrict,   -- line 17
 *   display_name text not null,                                          -- line 18
 *   email text not null unique,                                          -- line 19
 *   role role_enum not null,                                             -- line 20
 *   avatar_url text not null,                                            -- line 21
 *   theme_mode text not null default 'system',                          -- line 22
 *   created_at timestamptz not null default now()                        -- line 23
 * );
 * ```
 *
 * T086 bug fix: `avatar_url` was later amended from `not null` to nullable
 * by `supabase/migrations/20260718000000_invite_trigger.sql`, lines 44-45:
 * ```
 * alter table public.profiles
 *   alter column avatar_url drop not null;
 * ```
 * That migration's own module doc explains why: T019's invite-acceptance DB
 * trigger's own `insert into public.profiles (...)` omits `avatar_url`
 * entirely (SET-01's "upload later" flow -- a brand-new profile legitimately
 * has no avatar yet), so the column can no longer be `not null` with no
 * default. This is the first multi-migration column citation in this file
 * (no earlier precedent to follow existed); the convention established here
 * for any future one: cite the origin migration's `create table` first, then
 * the amending migration's `alter table` immediately after it, in
 * migration-application order.
 */
export interface ProfileRow {
  id: string;
  displayName: string;
  email: string;
  role: Role;
  avatarUrl: string | null;
  themeMode: string;
  createdAt: string;
}

/** `teams.program` check constraint, line 33 (see `TeamRow` below): nullable
 * (no `not null`). */
export type TeamProgram = 'FRC' | 'FTC' | 'Other';

/**
 * `public.teams` -- `supabase/migrations/20260716000000_identity_roster.sql`,
 * lines 29-38:
 * ```
 * create table public.teams (
 *   id uuid primary key default gen_random_uuid(),                        -- line 30
 *   name text not null unique,                                            -- line 31
 *   short_name text not null,                                             -- line 32
 *   program text check (program in ('FRC', 'FTC', 'Other')),              -- line 33 (nullable)
 *   color text not null,                                                  -- line 34
 *   archived boolean not null default false,                              -- line 35
 *   sort_order integer not null default 0,                                -- line 36
 *   created_at timestamptz not null default now()                         -- line 37
 * );
 * ```
 */
export interface TeamRow {
  id: string;
  name: string;
  shortName: string;
  program: TeamProgram | null;
  color: string;
  archived: boolean;
  sortOrder: number;
  createdAt: string;
}

/**
 * `public.seasons` -- `supabase/migrations/20260716000000_identity_roster.sql`,
 * lines 42-50:
 * ```
 * create table public.seasons (
 *   id uuid primary key default gen_random_uuid(),                        -- line 43
 *   name text not null,                                                    -- line 44
 *   starts_on date not null,                                               -- line 45
 *   ends_on date not null,                                                 -- line 46
 *   default_goal_hours numeric not null default 100,                       -- line 47
 *   is_active boolean not null,                                            -- line 48
 *   created_at timestamptz not null default now()                         -- line 49
 * );
 * ```
 * (line 50 is the closing `);`.) No column here is nullable -- every field
 * in the `create table` body carries `not null`, including `is_active`
 * (which has no default, unlike `default_goal_hours`, but is still `not
 * null`: callers must always supply a value). The partial unique index
 * enforcing "at most one active season" (lines 53-55) is a constraint, not a
 * column, and has no corresponding field here.
 */
export interface SeasonRow {
  id: string;
  name: string;
  startsOn: string;
  endsOn: string;
  defaultGoalHours: number;
  isActive: boolean;
  createdAt: string;
}

/**
 * `public.students` -- `supabase/migrations/20260716000000_identity_roster.sql`,
 * lines 59-68:
 * ```
 * create table public.students (
 *   id uuid primary key default gen_random_uuid(),                        -- line 60
 *   profile_id uuid references public.profiles (id) on delete restrict,   -- line 61 (nullable)
 *   display_name text not null,                                           -- line 62
 *   team_id uuid not null references public.teams (id) on delete restrict,-- line 63
 *   grad_year integer,                                                    -- line 64 (nullable)
 *   is_active boolean not null default true,                              -- line 65
 *   goal_hours_override numeric,                                          -- line 66 (nullable)
 *   created_at timestamptz not null default now()                         -- line 67
 * );
 * ```
 */
export interface StudentRow {
  id: string;
  profileId: string | null;
  displayName: string;
  teamId: string;
  gradYear: number | null;
  isActive: boolean;
  goalHoursOverride: number | null;
  createdAt: string;
}

/**
 * `public.guardian_links` -- `supabase/migrations/20260716000000_identity_roster.sql`,
 * lines 72-79:
 * ```
 * create table public.guardian_links (
 *   id uuid primary key default gen_random_uuid(),                        -- line 73
 *   parent_profile_id uuid not null references public.profiles (id) on delete restrict, -- line 74
 *   student_id uuid not null references public.students (id) on delete restrict, -- line 75
 *   relationship text not null,                                            -- line 76
 *   created_at timestamptz not null default now(),                        -- line 77
 *   unique (parent_profile_id, student_id)                                 -- line 78 (table constraint, not a column)
 * );                                                                        -- line 79
 * ```
 */
export interface GuardianLinkRow {
  id: string;
  parentProfileId: string;
  studentId: string;
  relationship: string;
  createdAt: string;
}

/** `invites.status` check constraint, line 24 (see `InviteRow` below). */
export type InviteStatus = 'pending' | 'accepted' | 'expired' | 'revoked';

/**
 * `public.invites` -- `supabase/migrations/20260717000000_scheduling_attendance.sql`,
 * lines 18-27:
 * ```
 * create table public.invites (
 *   id uuid primary key default gen_random_uuid(),                        -- line 19
 *   email text not null,                                                  -- line 20
 *   role role_enum not null,                                              -- line 21
 *   student_id uuid references public.students (id) on delete restrict,   -- line 22 (nullable)
 *   invited_by uuid not null references public.profiles (id) on delete restrict, -- line 23
 *   status text not null check (status in ('pending', 'accepted', 'expired', 'revoked')), -- line 24
 *   expires_at timestamptz not null,                                      -- line 25
 *   created_at timestamptz not null default now()                         -- line 26
 * );
 * ```
 */
export interface InviteRow {
  id: string;
  email: string;
  role: Role;
  studentId: string | null;
  invitedBy: string;
  status: InviteStatus;
  expiresAt: string;
  createdAt: string;
}

/** `events.type` check constraint, line 36 (see `EventRow` below). */
export type EventType = 'meeting' | 'outreach' | 'competition';

/**
 * `public.events` -- `supabase/migrations/20260717000000_scheduling_attendance.sql`,
 * lines 33-48:
 * ```
 * create table public.events (
 *   id uuid primary key default gen_random_uuid(),                        -- line 34
 *   season_id uuid not null references public.seasons (id) on delete restrict, -- line 35
 *   type text not null check (type in ('meeting', 'outreach', 'competition')), -- line 36
 *   title text not null,                                                   -- line 37
 *   description text not null,                                            -- line 38
 *   location_name text not null,                                          -- line 39
 *   address text not null,                                                 -- line 40
 *   team_ids uuid[],                                                       -- line 41 (nullable; null = all teams)
 *   counts_participation boolean not null,                                 -- line 42
 *   counts_volunteer_hours boolean not null,                               -- line 43
 *   adult_volunteers_count integer not null default 0,                     -- line 44
 *   adult_volunteer_hours numeric not null default 0,                      -- line 45
 *   created_by uuid references public.profiles (id) on delete restrict,    -- line 46 (nullable; imports)
 *   created_at timestamptz not null default now()                         -- line 47
 * );                                                                        -- line 48
 * ```
 */
export interface EventRow {
  id: string;
  seasonId: string;
  type: EventType;
  title: string;
  description: string;
  locationName: string;
  address: string;
  teamIds: string[] | null;
  countsParticipation: boolean;
  countsVolunteerHours: boolean;
  adultVolunteersCount: number;
  adultVolunteerHours: number;
  createdBy: string | null;
  createdAt: string;
}

/** `event_sessions.status` check constraint, line 59 (see `EventSessionRow`
 * below). */
export type EventSessionStatus = 'scheduled' | 'completed' | 'canceled';

/**
 * `public.event_sessions` -- `supabase/migrations/20260717000000_scheduling_attendance.sql`,
 * lines 53-63:
 * ```
 * create table public.event_sessions (
 *   id uuid primary key default gen_random_uuid(),                        -- line 54
 *   event_id uuid not null references public.events (id) on delete cascade, -- line 55
 *   session_date date not null,                                           -- line 56
 *   starts_at timestamptz not null,                                       -- line 57
 *   ends_at timestamptz not null,                                         -- line 58
 *   status text not null check (status in ('scheduled', 'completed', 'canceled')), -- line 59
 *   people_reached integer,                                               -- line 60 (nullable)
 *   notes text not null,                                                  -- line 61
 *   created_at timestamptz not null default now()                         -- line 62
 * );
 * ```
 */
export interface EventSessionRow {
  id: string;
  eventId: string;
  sessionDate: string;
  startsAt: string;
  endsAt: string;
  status: EventSessionStatus;
  peopleReached: number | null;
  notes: string;
  createdAt: string;
}

/** `rsvps.status` check constraint, line 71 (see `RsvpRow` below). */
export type RsvpStatus = 'going' | 'maybe' | 'declined';

/**
 * `public.rsvps` -- `supabase/migrations/20260717000000_scheduling_attendance.sql`,
 * lines 67-76:
 * ```
 * create table public.rsvps (
 *   id uuid primary key default gen_random_uuid(),                        -- line 68
 *   session_id uuid not null references public.event_sessions (id) on delete restrict, -- line 69
 *   student_id uuid not null references public.students (id) on delete restrict, -- line 70
 *   status text not null check (status in ('going', 'maybe', 'declined')), -- line 71
 *   responded_by uuid references public.profiles (id) on delete restrict,  -- line 72 (nullable; imports)
 *   updated_at timestamptz not null default now(),                        -- line 73
 *   created_at timestamptz not null default now(),                        -- line 74
 *   unique (session_id, student_id)                                        -- line 75 (table constraint, not a column)
 * );                                                                        -- line 76
 * ```
 */
export interface RsvpRow {
  id: string;
  sessionId: string;
  studentId: string;
  status: RsvpStatus;
  respondedBy: string | null;
  updatedAt: string;
  createdAt: string;
}

/** `attendance.status` check constraint, line 86 (see `AttendanceRow`
 * below). */
export type AttendanceStatus = 'present' | 'late' | 'excused' | 'absent';

/** `attendance.method` check constraint, line 90 (see `AttendanceRow`
 * below). */
export type AttendanceMethod = 'qr' | 'coach' | 'import';

/**
 * `public.attendance` -- `supabase/migrations/20260717000000_scheduling_attendance.sql`,
 * lines 82-95:
 * ```
 * create table public.attendance (
 *   id uuid primary key default gen_random_uuid(),                        -- line 83
 *   session_id uuid not null references public.event_sessions (id) on delete restrict, -- line 84
 *   student_id uuid not null references public.students (id) on delete restrict, -- line 85
 *   status text not null check (status in ('present', 'late', 'excused', 'absent')), -- line 86
 *   check_in_at timestamptz,                                              -- line 87 (nullable)
 *   check_out_at timestamptz,                                             -- line 88 (nullable)
 *   hours_override numeric,                                               -- line 89 (nullable)
 *   method text not null check (method in ('qr', 'coach', 'import')),     -- line 90
 *   recorded_by uuid references public.profiles (id) on delete restrict,  -- line 91 (nullable)
 *   updated_at timestamptz not null default now(),                        -- line 92
 *   created_at timestamptz not null default now()                         -- line 93
 * );
 * ```
 */
export interface AttendanceRow {
  id: string;
  sessionId: string;
  studentId: string;
  status: AttendanceStatus;
  checkInAt: string | null;
  checkOutAt: string | null;
  hoursOverride: number | null;
  method: AttendanceMethod;
  recordedBy: string | null;
  updatedAt: string;
  createdAt: string;
}

/**
 * `public.notification_prefs` -- `supabase/migrations/20260717000001_support_audit.sql`,
 * lines 32-43:
 * ```
 * create table public.notification_prefs (
 *   id uuid primary key default gen_random_uuid(),                        -- line 33
 *   profile_id uuid not null unique references public.profiles (id) on delete restrict, -- line 34
 *   invite boolean not null default true,                                  -- line 35
 *   signup_confirm boolean not null default true,                          -- line 36
 *   event_reminder_48h boolean not null default true,                      -- line 37
 *   event_reminder_3h boolean not null default true,                       -- line 38
 *   meeting_reminder_3h boolean not null default true,                     -- line 39
 *   weekly_digest boolean not null default true,                           -- line 40
 *   digest_enabled boolean not null default true,                          -- line 41
 *   created_at timestamptz not null default now()                         -- line 42
 * );                                                                        -- line 43
 * ```
 * Seven boolean columns total (six per-EML-02-category + `digest_enabled`),
 * none nullable -- every one carries `not null` (with a `default true`,
 * which does not affect nullability).
 */
export interface NotificationPrefsRow {
  id: string;
  profileId: string;
  invite: boolean;
  signupConfirm: boolean;
  eventReminder48h: boolean;
  eventReminder3h: boolean;
  meetingReminder3h: boolean;
  weeklyDigest: boolean;
  digestEnabled: boolean;
  createdAt: string;
}

/**
 * `public.calendar_feeds` -- `supabase/migrations/20260717000001_support_audit.sql`,
 * lines 47-53:
 * ```
 * create table public.calendar_feeds (
 *   id uuid primary key default gen_random_uuid(),                        -- line 48
 *   profile_id uuid not null references public.profiles (id) on delete restrict, -- line 49
 *   token uuid not null unique default gen_random_uuid(),                  -- line 50
 *   revoked_at timestamptz,                                                -- line 51 (nullable)
 *   created_at timestamptz not null default now()                         -- line 52
 * );                                                                        -- line 53
 * ```
 */
export interface CalendarFeedRow {
  id: string;
  profileId: string;
  token: string;
  revokedAt: string | null;
  createdAt: string;
}

/**
 * `public.email_log` -- `supabase/migrations/20260717000001_support_audit.sql`,
 * lines 68-77:
 * ```
 * create table public.email_log (
 *   id uuid primary key default gen_random_uuid(),                        -- line 69
 *   to_email text not null,                                                -- line 70
 *   template text not null,                                                -- line 71
 *   session_id uuid,                                                       -- line 72 (nullable, deliberately no FK -- see migration's own design note)
 *   profile_id uuid,                                                       -- line 73 (nullable, deliberately no FK -- see migration's own design note)
 *   status text not null,                                                  -- line 74
 *   sent_at timestamptz not null default now(),                           -- line 75
 *   created_at timestamptz not null default now()                         -- line 76
 * );                                                                        -- line 77
 * ```
 * `sessionId`/`profileId` are both nullable by design (no FK): the
 * migration's own comment explains a delivery log must remain queryable
 * even after the referenced session/profile row is later deleted.
 */
export interface EmailLogRow {
  id: string;
  toEmail: string;
  template: string;
  sessionId: string | null;
  profileId: string | null;
  status: string;
  sentAt: string;
  createdAt: string;
}

/**
 * `public.audit_log` -- `supabase/migrations/20260717000001_support_audit.sql`,
 * lines 86-94:
 * ```
 * create table public.audit_log (
 *   id uuid primary key default gen_random_uuid(),                        -- line 87
 *   actor uuid not null references public.profiles (id) on delete restrict, -- line 88
 *   action text not null,                                                  -- line 89
 *   entity text not null,                                                  -- line 90
 *   entity_id uuid not null,                                               -- line 91
 *   meta jsonb not null default '{}'::jsonb,                              -- line 92
 *   created_at timestamptz not null default now()                         -- line 93
 * );                                                                        -- line 94
 * ```
 * `meta` is `jsonb` -- typed as `Record<string, unknown>` (an arbitrary JSON
 * object, per the trigger functions in this same migration file, which all
 * write `jsonb_build_object(...)` payloads of varying shape depending on
 * `action`). This module does not narrow `meta` per-action; interpreting its
 * contents belongs to whichever future page/task consumes `audit_log`.
 */
export interface AuditLogRow {
  id: string;
  actor: string;
  action: string;
  entity: string;
  entityId: string;
  meta: Record<string, unknown>;
  createdAt: string;
}

/**
 * `v_student_participation` -- `supabase/migrations/20260717000003_metric_views.sql`,
 * lines 21-42 (final `select` list, lines 30-38):
 * ```
 * select
 *   x.student_id, x.team_id, x.season_id,                                          -- line 31
 *   count(*) as expected_ct,                                                       -- line 32
 *   count(*) filter (where a.status in ('present','late')) as present_ct,          -- line 33
 *   count(*) filter (where a.status = 'late')    as late_ct,                       -- line 34
 *   count(*) filter (where a.status = 'excused') as excused_ct,                    -- line 35
 *   round(100.0 * count(*) filter (where a.status in ('present','late'))
 *         / greatest(count(*) - count(*) filter (where a.status = 'excused'), 1), 1)
 *     as participation_pct                                                        -- lines 36-38
 * from expected x
 * left join attendance a
 *   on a.session_id = x.session_id and a.student_id = x.student_id
 * group by x.student_id, x.team_id, x.season_id;
 * ```
 *
 * `VStudentParticipationRow` is a VERBATIM camelCase rename of these seven
 * columns -- every field is a 1:1 copy of a column the view itself already
 * computed. This file performs none of the `round(100.0 * ... / greatest(...))`
 * arithmetic shown above; that formula lives ONLY in the migration SQL
 * (constitution item 3, BLOCKER if re-derived here) -- see
 * `src/pages/reports/ParticipationTab.tsx`'s (T056) own module doc for the
 * same non-re-derivation discipline applied to this exact view.
 *
 * All seven columns are the `group by`'d/aggregated result of a query with
 * no `left join`-introduced nulls on these particular columns, so none are
 * typed nullable here -- the view's own "no completed sessions" case is
 * represented by the ROW BEING ABSENT entirely (see the migration's own
 * implementation note, line 1: "expected_ct = 0 rows simply absent"), not by
 * a null column value.
 */
export interface VStudentParticipationRow {
  studentId: string;
  teamId: string;
  seasonId: string;
  expectedCt: number;
  presentCt: number;
  lateCt: number;
  excusedCt: number;
  participationPct: number;
}

/**
 * `v_student_hours` -- `supabase/migrations/20260717000003_metric_views.sql`,
 * lines 3-19:
 * ```
 * create or replace view v_student_hours as
 * select
 *   a.student_id,
 *   e.season_id,
 *   sum(coalesce(
 *     a.hours_override,
 *     case when a.check_in_at is not null and a.check_out_at is not null
 *       then greatest(extract(epoch from
 *         (least(a.check_out_at, es.ends_at) - greatest(a.check_in_at, es.starts_at))) / 3600.0, 0)
 *     end,
 *     extract(epoch from (es.ends_at - es.starts_at)) / 3600.0
 *   )) as confirmed_hours
 * from attendance a
 * join event_sessions es on es.id = a.session_id and es.status = 'completed'
 * join events e on e.id = es.event_id and e.counts_volunteer_hours
 * where a.status in ('present','late')
 * group by a.student_id, e.season_id;
 * ```
 *
 * `VStudentHoursRow` is PASSTHROUGH ONLY: a verbatim camelCase rename of the
 * three columns this view's final `select` list already produces
 * (`student_id`, `season_id`, `confirmed_hours`). This file performs none of
 * the `coalesce(hours_override, case when ... then greatest(extract(epoch
 * from ...)) ..., extract(epoch from ...))` clamping/fallback arithmetic
 * shown above -- that formula (hours_override wins, else check-in/out
 * clamped to the session window, else the full session duration) lives ONLY
 * in the migration SQL (constitution item 3, BLOCKER if re-derived here),
 * same non-re-derivation discipline as `VStudentParticipationRow` above.
 *
 * `confirmedHours` is not typed nullable: the `group by` only ever produces
 * a row when at least one matching `attendance` row exists (an aggregate
 * `sum` over a non-empty group), and the view's own "no completed sessions"
 * case is represented by the row being absent entirely -- same convention
 * `VStudentParticipationRow` above documents for its own `expected_ct`.
 */
export interface VStudentHoursRow {
  studentId: string;
  seasonId: string;
  confirmedHours: number;
}

/**
 * `v_team_participation` -- `supabase/migrations/20260717000003_metric_views.sql`,
 * lines 44-49:
 * ```
 * create or replace view v_team_participation as
 * select team_id, season_id,
 *   round(100.0 * sum(present_ct) / greatest(sum(expected_ct) - sum(excused_ct), 1), 1)
 *     as participation_pct
 * from v_student_participation
 * group by team_id, season_id;
 * ```
 *
 * `VTeamParticipationRow` is PASSTHROUGH ONLY: a verbatim camelCase rename
 * of the three columns this view's `select` list already produces
 * (`team_id`, `season_id`, `participation_pct`). This file performs none of
 * the `round(100.0 * sum(...) / greatest(sum(...) - sum(...), 1), 1)`
 * arithmetic shown above -- that formula lives ONLY in the migration SQL
 * (constitution item 3, BLOCKER if re-derived here), same non-re-derivation
 * discipline as `VStudentParticipationRow`/`VStudentHoursRow` above.
 *
 * `participationPct` is not typed nullable for the same reason as
 * `VStudentHoursRow.confirmedHours` above: the `group by` only ever
 * produces a row when at least one underlying `v_student_participation` row
 * exists for that team/season.
 */
export interface VTeamParticipationRow {
  teamId: string;
  seasonId: string;
  participationPct: number;
}
