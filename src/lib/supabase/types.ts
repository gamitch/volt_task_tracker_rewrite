/**
 * T071: hand-authored row interfaces for the tables/views the six flagged
 * pages (T018, T020, T021, T034, T035, T056) need at minimum. Every field
 * below is transcribed verbatim from the real migration SQL under
 * `supabase/migrations/` -- exact file/line cited per column in each
 * interface's doc comment (checker evidence, per the worker packet's
 * "Required Worker Output"). Types only: this file contains zero metric
 * formula arithmetic and zero RLS logic (constitution item 3, BLOCKER) --
 * `v_student_participation` below is a plain 1:1 column rename, matching the
 * approach `src/pages/reports/ParticipationTab.tsx`'s (T056)
 * `ParticipationMetricRow` already established for the same view.
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
 * `public.profiles` -- `supabase/migrations/20260716000000_identity_roster.sql`,
 * lines 16-24:
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
 */
export interface ProfileRow {
  id: string;
  displayName: string;
  email: string;
  role: Role;
  avatarUrl: string;
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
