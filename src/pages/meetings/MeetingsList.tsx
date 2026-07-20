/**
 * T030: `/meetings` list page (MTG-01 coach view / MTG-14 student+parent view).
 *
 * Coach (`coach`/`admin`) view: `Section` "Upcoming" / `Section` "Past" lists
 * of **meeting-type** sessions only (NAV-07 -- never outreach/competition),
 * each row showing date+weekday, computed time range+duration (BEH-08),
 * team scope, a status `Badge`, and (Past rows only) an attendance summary.
 * A page-level "Schedule meetings" action and a per-row `MoreMenu`
 * (Edit, Cancel via `AlertDialog`, DES-11) round out MTG-01's literal text
 * (PRD line 272: "Actions: Schedule meetings, per-row MoreMenu (Edit,
 * Cancel session -- AlertDialog)").
 *
 * Student/parent view (MTG-14, PRD line 288: "`/meetings` for students =
 * their own history (status per session) + participation %. ... Read-only.")
 * -- own Upcoming/Past history rows (no MoreMenu, no Schedule action -- this
 * variant is read-only per MTG-14's own text) plus a participation %
 * sourced from a `v_student_participation`-shaped fixture row, never
 * computed by this component (constitution item 3 / Known Context/Traps #3).
 *
 * -----------------------------------------------------------------------
 * 1. Ground truth -- `event_sessions`/`events`/`attendance` column shapes
 *    (Known Context/Traps #1), cited directly from
 *    `supabase/migrations/20260717000000_scheduling_attendance.sql`
 *    (read-only), NOT redefined/renamed with invented fields:
 *
 *    `events` (lines 33-48): id, season_id, type (check: 'meeting' |
 *    'outreach' | 'competition'), title, description, location_name,
 *    address, team_ids uuid[] NULL (null = all teams), counts_participation,
 *    counts_volunteer_hours, adult_volunteers_count, adult_volunteer_hours,
 *    created_by, created_at.
 *
 *    `event_sessions` (lines 53-63): id, event_id, session_date (date),
 *    starts_at (timestamptz), ends_at (timestamptz), status (check:
 *    'scheduled' | 'completed' | 'canceled' -- Known Context/Traps #5's real
 *    status vocabulary, used verbatim below, never an invented string like
 *    "confirmed"/"active"), people_reached, notes, created_at.
 *
 *    `attendance` (lines 82-95): id, session_id, student_id, status (check:
 *    'present' | 'late' | 'excused' | 'absent'), check_in_at, check_out_at,
 *    hours_override, method, recorded_by, updated_at, created_at.
 *
 *    `FixtureEvent`/`FixtureEventSession`/`FixtureAttendanceRecord` below are
 *    camelCase renames of exactly these columns (only the subset this screen
 *    renders) -- no invented fields, no re-derived RLS.
 *
 * -----------------------------------------------------------------------
 * 2. NAV-07 -- this route must show ONLY meeting sessions, never outreach.
 *
 * `buildCoachMeetingRows`/`buildStudentMeetingsData` below both start with
 * `events.filter((event) => event.type === 'meeting')` -- the ONLY type
 * predicate anywhere in this file gating which sessions ever reach either
 * view's rows. `FIXTURE_EVENTS` deliberately includes one `type: 'outreach'`
 * event (`event-food-drive`) with its own session specifically so this
 * filter is genuinely exercised (grep-provable: no outreach-shaped field/
 * import anywhere in this file's rendered output -- see this task's worker
 * output for the render-time proof that its title never appears).
 *
 * -----------------------------------------------------------------------
 * 3. Known Context/Traps #3 -- participation % sourced from
 *    `v_student_participation`'s real shape, never computed here.
 *
 * `StudentParticipationMetric` below is a verbatim camelCase rename of
 * `v_student_participation`'s seven real columns, cited directly from
 * `supabase/migrations/20260717000003_metric_views.sql` lines 21-42
 * (student_id, team_id, season_id, expected_ct, present_ct, late_ct,
 * excused_ct, participation_pct) -- the exact same shape/citation
 * `ParticipationTab.tsx` (T056) already established for this metric.
 * `FIXTURE_PARTICIPATION_METRICS` below supplies already-computed
 * `participationPct` values (as the view's own SQL would have produced
 * them for the paired expected/present/excused counts); this file performs
 * NO percentage arithmetic anywhere -- grep-provable: no `100.0 *`, no
 * `/ greatest(`, no `presentCt / expectedCt` division of any kind.
 * `PastAttendanceSummary` (the coach view's per-session present/late/
 * excused/absent tally) is a DIFFERENT thing: a plain per-session COUNT
 * (`count(*) filter (where status = 'x')`, mirroring the view's own
 * internal counting step, not its percentage step) -- not a percentage,
 * so constitution item 3 does not bar computing it directly from
 * `FIXTURE_ATTENDANCE` records the same way the view's own `expected` CTE
 * would.
 *
 * -----------------------------------------------------------------------
 * 4. BEH-08 -- every date/duration carries a weekday name and a computed
 *    duration; NFR-09 -- timestamps display in America/Chicago.
 *
 * `formatWeekdayDate` (session_date -> "Sat, Jul 25") and
 * `formatTimeRangeWithDuration` (starts_at/ends_at -> "6:00-8:00 PM - 2h",
 * PRD line 237's own worked example) are the ONLY date-formatting functions
 * in this file, used for every Upcoming and Past row in both views -- no row
 * anywhere renders a bare ISO string or an un-computed start/end pair.
 * Both `Intl.DateTimeFormat` instances are pinned to `timeZone:
 * 'America/Chicago'` per NFR-09 ("Timestamps stored UTC, displayed
 * America/Chicago"), not the viewer's local browser timezone.
 *
 * -----------------------------------------------------------------------
 * 5. `guards.tsx` `Role` vocabulary gap (same recurring gap `RosterShell.tsx`/
 *    T021 and `ParticipationTab.tsx`/T056 already disclosed) -- resolved by
 *    T073a, not by this task.
 *
 * `guards.tsx`'s exported `Role` union now matches AUTH-05's real
 * `admin | coach | student | parent` vocabulary exactly (previously a
 * stale `'admin' | 'staff' | 'volunteer' | 'coach'` placeholder). Since
 * `router.tsx` wires `/meetings` with `RequireAuth` only (no `RequireRole`
 * -- confirmed by reading that file directly; it is a forbidden/read-only
 * file here, and per the worker packet this is CORRECT for this route, not
 * a gap to fix: MTG-01 is a role-*variant* page, not a role-*gated* one),
 * this component never imports/uses `RequireRole` -- it only reads
 * `useAuth().user.role` to pick which variant to render.
 * `isCoachOrAdminView` below compares only against the `'coach'`/`'admin'`
 * literals by design (it only needs to distinguish coach/admin from
 * everyone else); everything else, including a real `'student'`/`'parent'`
 * value, now correctly type-checks too and falls through to the
 * student/parent variant.
 *
 * -----------------------------------------------------------------------
 * 6. T096 (ED-1 Packet P7): `PLACEHOLDER_CURRENT_STUDENT_ID` resolution --
 *    `AuthUser` (`guards.tsx`) still carries only `{id, email, role}`, no
 *    direct `students.id` field, but this task DOES resolve a real
 *    `students.id` from that identity instead of leaving it a placeholder
 *    (Trap #4 of this task's own worker packet -- full reasoning restated
 *    here, since this is a genuinely new resolution problem, not a reused
 *    hook):
 *
 *    - Logged-in STUDENT: `students.profile_id = auth.uid()` is a direct,
 *      unambiguous 1:1 lookup -- exactly one (or zero, for a not-yet-linked
 *      account) row.
 *    - Logged-in PARENT: `guardian_links.parent_profile_id = auth.uid()` can
 *      match MULTIPLE rows (one per linked child) -- but `StudentMeetingsView`
 *      below (unchanged by this task) still only ever accepts ONE
 *      `studentId: string`, not a list, and this task's own Allowed Files
 *      (`MeetingsList.tsx` + a new `loaders/meetings.ts`) do not extend to
 *      redesigning this route into ParentHome.tsx's own multi-card-per-child
 *      architecture (`ParentHome.tsx`'s module doc #4) -- that would be a
 *      genuinely new, much larger UI (N independent cards, N independent
 *      loads) this task's packet never asks for and Trap #4 explicitly warns
 *      against inventing. Investigated `ParentHome.tsx` (an already-real-wired
 *      parent-facing surface) for precedent per Trap #4's own instruction:
 *      its OWN precedent for "which parent is this" is to NOT attempt any
 *      `guardian_links`-keyed-by-`auth.uid()` resolution at all (that file's
 *      own module doc #7: "this page does not attempt to resolve 'which
 *      parent is signed in' from `useAuth()`"), because at the time that page
 *      was built no shared Supabase client existed yet to do so. That
 *      specific limiting reason no longer applies to THIS task (a real client
 *      now exists, and Trap #4 explicitly directs a real
 *      `guardian_links.parent_profile_id = auth.uid()` lookup) -- so the
 *      precedent actually followed here is narrower than "don't resolve at
 *      all": resolve for real, but stay honest about the one-student-only
 *      limitation `MeetingsList`'s own pre-existing (not-this-task's)
 *      `studentId: string` signature already imposes, the same way
 *      `ParentHome.tsx` stays honest about ITS OWN pre-existing gap rather
 *      than silently faking a resolution. `resolveCurrentStudentId`
 *      (`../../lib/supabase/loaders/meetings.ts`) resolves a parent to their
 *      EARLIEST-linked child only (`guardian_links` ordered by `created_at`
 *      ascending, first row) -- a disclosed, minimal, real answer for a
 *      single-student parent (the common case), with a known limitation for a
 *      genuinely multi-student parent (documented in this task's own worker
 *      output "Known risks", not silently accepted as correct for that case).
 *    - Coach/admin: `resolveCurrentStudentId` is never called at all (the
 *      `isCoachOrAdminView` branch below renders `CoachMeetingsView`
 *      instead), but returns `null` defensively rather than throwing if it
 *      ever were.
 *
 *    `resolveStudentId` (new injectable prop on `MeetingsListProps`, default
 *    `resolveCurrentStudentId`) is only ever invoked when a caller does NOT
 *    supply an explicit `studentId` prop -- an explicit `studentId` (as every
 *    existing test in `MeetingsList.test.tsx` before this task already
 *    passes) bypasses resolution entirely and is used as-is, unchanged
 *    behavior. `PLACEHOLDER_CURRENT_STUDENT_ID` is KEPT as a named export
 *    (per this task's own Known Context/Traps #5 -- `MeetingsList.test.tsx`
 *    still imports and uses it) but its role changes: it is no longer this
 *    component's own runtime default for an unresolved `studentId` (that
 *    placeholder default is removed below); it now exists solely as the
 *    fixture literal identifying "the current viewer" inside `FIXTURE_*`
 *    data below, for tests/callers that want fixture data rendered
 *    explicitly.
 *
 * -----------------------------------------------------------------------
 * 7. T096 (ED-1 Packet P7): real load/mutation/dialog wiring -- three of the
 *    four former stubs are now real; "Edit" alone remains a disclosed stub
 *    (with new, accurate copy, since the underlying reason changed -- see
 *    (b) below).
 *
 *    a. "Schedule meetings" button (coach view) -- `ScheduleMeetingsDialog.tsx`
 *       (T031, already Passed, already built, already has its own real
 *       injectable `onCreateMeetings` seam) is now imported and rendered for
 *       real by `CoachMeetingsView` below, in CREATE mode. `onClick` opens
 *       the real dialog (`isScheduleDialogOpen` state) instead of showing a
 *       stub `Banner`. `handleCreateMeetingsSubmit` below wires the dialog's
 *       own `onCreateMeetings` prop to a real default
 *       (`createMeetings`, `../../lib/supabase/loaders/meetings.ts`) that
 *       inserts one real `events` row (type `meeting`) + one real
 *       `event_sessions` row per computed date, then reloads this page's own
 *       `rows` from `loadData()` so the newly-scheduled meeting(s) appear
 *       without a manual refresh (a full reload, not a client-side merge --
 *       recomputing `CoachMeetingRow`'s own `teamScopeLabel`/
 *       `attendanceSummary` fields client-side would duplicate
 *       `buildCoachMeetingRows`' real DB-driven joins for no benefit).
 *    b. Row "Edit" menu item (coach view) -- Trap #3 of this task's own
 *       worker packet directed investigating whether
 *       `ScheduleMeetingsDialog.tsx` genuinely supports an "edit an existing
 *       meeting" mode before assuming it does. It does NOT: its own props
 *       (`ScheduleMeetingsDialogProps`) have no `initialData`/"meeting to
 *       edit" field of any kind, its `resetForm()` always resets to the same
 *       hardcoded pristine defaults (never a passed-in existing row), and its
 *       own `CreateMeetingsPayload` shape (`{event, sessions}`, always a
 *       BRAND-NEW `events` insert + N BRAND-NEW `event_sessions` inserts) is
 *       purpose-built for creating a whole new recurring-meeting SERIES, not
 *       mutating one already-scheduled session's fields in place -- there is
 *       no code path in that file that could ever target an existing row for
 *       an UPDATE. Forcing "Edit" onto this dialog would mean either (i)
 *       silently creating a SECOND competing series alongside the original
 *       whenever "Edit" is used (wrong -- corrupts the schedule) or (ii)
 *       inventing new dialog behavior (an `initialData` prop, an edit-mode
 *       branch in its own submit handler) inside `ScheduleMeetingsDialog.tsx`
 *       itself, a forbidden/read-only file for this task. Per the packet's
 *       own explicit instruction for exactly this finding, "Edit" is left as
 *       a clearly-labeled, HONEST stub instead -- new, accurate copy (NOT the
 *       old "dialog not built yet" text, since the dialog genuinely IS built
 *       now; the real remaining gap is narrower and different: "this
 *       particular dialog has no edit mode to open").
 *    c. Row "Cancel" menu item + `AlertDialog` (coach view) -- was already
 *       real-LOOKING before this task (a genuine `AlertDialog`, DES-11), but
 *       only ever flipped local `rows` state; this task pairs it with a real
 *       `event_sessions.status = 'canceled'` mutation
 *       (`onCancelSession`, default `cancelMeetingSession`,
 *       `../../lib/supabase/loaders/meetings.ts`), optimistic-update +
 *       rollback-on-failure, mirroring `StudentsTab.tsx`'s own
 *       `handleConfirmDeactivate` (T089) shape exactly per this task's own
 *       packet steer.
 *    d. "Consistency strip"-shaped area (student/parent view) -- BEH-06's
 *       "last 5 completed meetings as `StatusDot`s" widget is T037's
 *       ("Student/parent meeting view + consistency strip", currently
 *       Blocked on this task) deliverable per `docs/swarm/task-ledger.md`.
 *       This file renders a clearly-labeled placeholder `Section`
 *       explaining that the real strip ships in T037, with NO `StatusDot`
 *       usage and no fabricated "last 5" data anywhere -- it does build the
 *       plain, real Upcoming/Past history rows MTG-14 itself requires (own
 *       status per session), which is a distinct, narrower deliverable than
 *       T037's summary widget on top of it. Untouched by this task.
 *
 * -----------------------------------------------------------------------
 * 8. DES-12 four states, reachable independently per role variant (Known
 *    Context/Traps #6).
 *
 *    Coach view (`CoachMeetingsView`): loading (T081: `Skeleton`,
 *    previewing the known Upcoming/Past meeting-list-row shape, while
 *    `loadCoachData()` is pending -- replacing the prior `Spinner` per
 *    Astryx's own guidance since this list's dimensions are predictable)
 *    / error (`loadCoachData()` rejects --
 *    `Banner status="error"`) / empty (`loadCoachData()` resolves zero
 *    meeting-type rows -- page-level `EmptyState` with an offer to open the
 *    stubbed "Schedule meetings" flow) / populated (Upcoming/Past `Section`s
 *    with real rows; each section independently falls back to its own
 *    smaller `EmptyState` when only ONE of the two buckets is empty, e.g.
 *    "no upcoming meetings, three past ones").
 *
 *    Student/parent view (`StudentMeetingsView`): loading / error / empty
 *    (zero history rows AND no participation row) / populated -- the exact
 *    same four-state shape, built independently against `loadStudentData`,
 *    with its own distinct copy (never sharing a message with the coach
 *    view's states, so the two variants are visually/textually
 *    distinguishable per the packet's Known Context/Traps #6).
 *
 * -----------------------------------------------------------------------
 * 9. Astryx prop sourcing (constitution item 2) -- every prop below,
 *    cross-checked against `docs/swarm/astryx-api.md` directly:
 *
 *  - `Section`: "Section" Props table. `dividers`, `padding`, `children`
 *    used, matching `ParticipationTab.tsx`'s established team-grouping
 *    idiom (one `Section` per Upcoming/Past bucket here, instead of per
 *    team).
 *  - `Heading`: doc's own "Components > Heading" subsection is `undefined`
 *    (same disclosed CLI-cross-checked gap `RosterShell.tsx`/T021 and
 *    `Kiosk.tsx`/T034 already hit); `npm run astryx -- component Heading`
 *    resolves `level` (1-6, required) + `children` (required) -- only those
 *    two used below.
 *  - `List`/`ListItem`: "List" Props table (`children`, `hasDividers`,
 *    `header`) + `ListItem`'s own doc subsection is likewise `undefined`;
 *    `npm run astryx -- component ListItem` (re-run live for this task, not
 *    assumed from a prior task) resolves: `label` (`string`, required),
 *    `description` (`ReactNode`), `startContent`, `endContent`, `onClick`,
 *    `href`, `target`, `rel`, `isDisabled`, `isSelected` -- only `label`,
 *    `description`, `endContent` used below (no `onClick`/`href` -- rows are
 *    not interactive/clickable per this task's scope, avoiding the doc's own
 *    "Don't place interactive elements inside an interactive list item"
 *    warning entirely by never making the row itself interactive).
 *  - `Badge`: "Badge" Props table. `variant`
 *    (`'neutral'|'info'|'success'|'warning'|'error'|...`), `label` used.
 *    Session-status badges use the real `event_sessions.status` enum
 *    (Known Context/Traps #5) mapped to Astryx's semantic variants (a
 *    system-state use, matching the doc's own "Do: use success/warning/
 *    error for system status" guidance, not the "Don't: use semantic
 *    variants for categories" warning). Attendance-status badges (student
 *    view) use DES-05's literal mapping (Present=success, Late=warning,
 *    Excused=neutral, Absent=error), cited from PRD line 195.
 *  - `MoreMenu`: "MoreMenu" Props table. `items` (`DropdownMenuOption[]`,
 *    re-exported from `@astryxdesign/core`'s `./DropdownMenu` barrel per
 *    `node_modules/@astryxdesign/core/dist/index.d.ts` line 81 --
 *    confirmed directly, not assumed), `label` used.
 *  - `AlertDialog`: "AlertDialog" Props table. `isOpen`, `onOpenChange`,
 *    `title`, `description`, `actionLabel`, `onAction` (all required) used;
 *    `actionVariant` left at its documented `'destructive'` default
 *    (canceling a meeting is a destructive-shaped action).
 *  - `Button`: "Button" Props table. `label`, `variant`, `onClick` used.
 *  - `Banner`: "Banner" Props table. `status`, `title`, `description` used.
 *  - `EmptyState`: "EmptyState" Props table. `title` (required),
 *    `description`, `actions` used.
 *  - `Skeleton` (T081): "Skeleton" section, lines 621-655. `width`,
 *    `height`, `index` used, replacing `Spinner`'s prior use in both role
 *    variants per Astryx's own guidance (known-dimension content).
 *    `VisuallyHidden` + the wrapping `VStack`'s `aria-busy` carry the same
 *    "Loading…" announcements `Spinner`'s `label` used to provide.
 *  - `ProgressBar`: "ProgressBar" Props table. `label` (required), `value`,
 *    `isLabelHidden`, `hasValueLabel` used -- same idiom `ParticipationTab.tsx`
 *    already established for rendering a pre-computed percentage.
 *  - `VStack`/`HStack`: "Stack" section, `VStack`/`HStack` subsections.
 *    `gap`, `padding`, `hAlign`, `vAlign`, `wrap` used.
 *  - `Text`: "Text" Props table. `type` (`'supporting'`), `color`,
 *    `hasTabularNumbers` used.
 */
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  AlertDialog,
  Badge,
  Banner,
  Button,
  EmptyState,
  Heading,
  HStack,
  List,
  ListItem,
  MoreMenu,
  ProgressBar,
  Skeleton,
  Text,
  VisuallyHidden,
  VStack,
  type DropdownMenuOption,
} from '@astryxdesign/core';
import { useAuth, type Role } from '../../app/guards';
import { isSupabaseLoaderError } from '../../lib/supabase';
// T096 (ED-1 Packet P7): real load/mutation/studentId-resolution wiring --
// module doc #6/#7. `createMeetings`/`ScheduleMeetingsDialog` (module doc
// #7a) are this task's own wiring of an ALREADY-BUILT, ALREADY-PASSED
// standalone dialog into this page for the first time; nothing inside
// `ScheduleMeetingsDialog.tsx` itself is modified (forbidden/read-only file).
import {
  cancelMeetingSession,
  createMeetings,
  loadCoachMeetingsData,
  loadStudentMeetingsData,
  resolveCurrentStudentId,
} from '../../lib/supabase/loaders/meetings';
import {
  ScheduleMeetingsDialog,
  type CreateMeetingsPayload,
  type OnCreateMeetingsFn,
} from './ScheduleMeetingsDialog';

// ---------------------------------------------------------------------------
// Types -- verbatim camelCase renames of real columns. See module doc #1/#3.
// ---------------------------------------------------------------------------

export type EventType = 'meeting' | 'outreach' | 'competition';
export type SessionStatus = 'scheduled' | 'completed' | 'canceled';
export type AttendanceStatus = 'present' | 'late' | 'excused' | 'absent';
type BadgeVariant =
  | 'neutral'
  | 'info'
  | 'success'
  | 'warning'
  | 'error'
  | 'blue'
  | 'cyan'
  | 'green'
  | 'orange'
  | 'pink'
  | 'purple'
  | 'red'
  | 'teal'
  | 'yellow';

interface FixtureTeam {
  id: string;
  name: string;
}

interface FixtureEvent {
  id: string;
  seasonId: string;
  type: EventType;
  title: string;
  teamIds: readonly string[] | null;
  countsParticipation: boolean;
}

interface FixtureEventSession {
  id: string;
  eventId: string;
  sessionDate: string;
  startsAt: string;
  endsAt: string;
  status: SessionStatus;
}

interface FixtureAttendanceRecord {
  sessionId: string;
  studentId: string;
  status: AttendanceStatus;
}

/** Plain per-session tally (module doc #3 -- NOT a percentage). */
export interface PastAttendanceSummary {
  presentCt: number;
  lateCt: number;
  excusedCt: number;
  absentCt: number;
}

export interface CoachMeetingRow {
  sessionId: string;
  title: string;
  sessionDate: string;
  startsAt: string;
  endsAt: string;
  status: SessionStatus;
  teamScopeLabel: string;
  /** Populated for `status === 'completed'` rows only; `null` otherwise. */
  attendanceSummary: PastAttendanceSummary | null;
}

export interface CoachMeetingsData {
  rows: CoachMeetingRow[];
}

export type LoadCoachMeetingsDataFn = () => Promise<CoachMeetingsData>;

export interface StudentMeetingHistoryRow {
  sessionId: string;
  title: string;
  sessionDate: string;
  startsAt: string;
  endsAt: string;
  status: SessionStatus;
  /** `null` when the session hasn't happened yet (no attendance row exists). */
  myAttendanceStatus: AttendanceStatus | null;
}

/**
 * Verbatim camelCase rename of `v_student_participation`'s seven real
 * columns (module doc #3). `null` means the student has no row in the view
 * at all (the real "expected_ct = 0" absence case, per the same migration's
 * implementation note already cited by `ParticipationTab.tsx`), rendered as
 * "-" -- never a fabricated 0%.
 */
export interface StudentParticipationMetric {
  studentId: string;
  teamId: string;
  seasonId: string;
  expectedCt: number;
  presentCt: number;
  lateCt: number;
  excusedCt: number;
  participationPct: number;
}

export interface StudentMeetingsData {
  history: StudentMeetingHistoryRow[];
  participation: StudentParticipationMetric | null;
}

export type LoadStudentMeetingsDataFn = (studentId: string) => Promise<StudentMeetingsData>;

/** T096 (module doc #7c) -- the real `event_sessions.status = 'canceled'` mutation seam. */
export type CancelMeetingSessionFn = (sessionId: string) => Promise<void>;

/**
 * T096 (module doc #6, Trap #4) -- the minimal identity shape
 * `resolveCurrentStudentId` needs: `AuthUser.id` (== `auth.uid()` ==
 * `profiles.id`) and `AuthUser.role`, never the full `AuthUser`/`AuthContextValue`
 * (this file has no other use for e.g. `email`).
 */
export interface CurrentViewerIdentity {
  id: string;
  role: Role;
}

/** T096 (module doc #6, Trap #4) -- resolves the real `students.id` this
 * viewer's student/parent view should be scoped to; `null` when none can be
 * resolved (no linked student yet). */
export type ResolveCurrentStudentIdFn = (viewer: CurrentViewerIdentity) => Promise<string | null>;

// ---------------------------------------------------------------------------
// Placeholder identifiers -- module doc #6. `PLACEHOLDER_CURRENT_STUDENT_ID`
// is KEPT (T096 does not remove it -- `MeetingsList.test.tsx` still imports
// it) but is no longer this component's own runtime default for an
// unresolved `studentId`; see module doc #6 for its narrowed role.
// ---------------------------------------------------------------------------

export const PLACEHOLDER_CURRENT_STUDENT_ID = 'student-placeholder-current-viewer';
const PLACEHOLDER_SEASON_ID = 'season-placeholder-current';

// ---------------------------------------------------------------------------
// Fixture data (constitution item 6: fabricated names only). Module doc #1/#2.
// ---------------------------------------------------------------------------

const FIXTURE_TEAMS: readonly FixtureTeam[] = [
  { id: 'team-ravens', name: 'Ravens' },
  { id: 'team-titans', name: 'Titans' },
];

const FIXTURE_EVENTS: readonly FixtureEvent[] = [
  {
    id: 'event-weekly-build',
    seasonId: PLACEHOLDER_SEASON_ID,
    type: 'meeting',
    title: 'Weekly Build Meeting',
    teamIds: null, // null = all teams (module doc #1)
    countsParticipation: true,
  },
  {
    id: 'event-ravens-strategy',
    seasonId: PLACEHOLDER_SEASON_ID,
    type: 'meeting',
    title: 'Ravens Strategy Session',
    teamIds: ['team-ravens'],
    countsParticipation: true,
  },
  // Deliberately type: 'outreach' -- proves NAV-07 filtering (module doc #2).
  // This event's own session ("Community Food Drive") must NEVER appear
  // anywhere this file renders.
  {
    id: 'event-food-drive',
    seasonId: PLACEHOLDER_SEASON_ID,
    type: 'outreach',
    title: 'Community Food Drive',
    teamIds: null,
    countsParticipation: false,
  },
];

const FIXTURE_SESSIONS: readonly FixtureEventSession[] = [
  {
    id: 'session-upcoming-build',
    eventId: 'event-weekly-build',
    sessionDate: '2026-07-22',
    startsAt: '2026-07-22T23:00:00.000Z', // 6:00 PM America/Chicago (UTC-5, DST)
    endsAt: '2026-07-23T01:00:00.000Z', // 8:00 PM America/Chicago
    status: 'scheduled',
  },
  {
    id: 'session-upcoming-ravens',
    eventId: 'event-ravens-strategy',
    sessionDate: '2026-07-25',
    startsAt: '2026-07-25T22:30:00.000Z', // 5:30 PM America/Chicago
    endsAt: '2026-07-26T00:00:00.000Z', // 7:00 PM America/Chicago
    status: 'scheduled',
  },
  {
    id: 'session-past-build-completed',
    eventId: 'event-weekly-build',
    sessionDate: '2026-07-15',
    startsAt: '2026-07-15T23:00:00.000Z',
    endsAt: '2026-07-16T01:00:00.000Z',
    status: 'completed',
  },
  {
    id: 'session-past-ravens-completed',
    eventId: 'event-ravens-strategy',
    sessionDate: '2026-07-11',
    startsAt: '2026-07-11T22:30:00.000Z',
    endsAt: '2026-07-12T00:00:00.000Z',
    status: 'completed',
  },
  {
    id: 'session-past-build-canceled',
    eventId: 'event-weekly-build',
    sessionDate: '2026-07-08',
    startsAt: '2026-07-08T23:00:00.000Z',
    endsAt: '2026-07-09T01:00:00.000Z',
    status: 'canceled',
  },
  // Outreach session -- module doc #2. Must never render anywhere.
  {
    id: 'session-food-drive',
    eventId: 'event-food-drive',
    sessionDate: '2026-07-19',
    startsAt: '2026-07-19T15:00:00.000Z',
    endsAt: '2026-07-19T18:00:00.000Z',
    status: 'scheduled',
  },
];

const FIXTURE_ATTENDANCE: readonly FixtureAttendanceRecord[] = [
  // session-past-build-completed: 3 present, 1 late, 1 excused, 1 absent.
  {
    sessionId: 'session-past-build-completed',
    studentId: 'student-placeholder-current-viewer',
    status: 'present',
  },
  { sessionId: 'session-past-build-completed', studentId: 'student-b', status: 'present' },
  { sessionId: 'session-past-build-completed', studentId: 'student-c', status: 'present' },
  { sessionId: 'session-past-build-completed', studentId: 'student-d', status: 'late' },
  { sessionId: 'session-past-build-completed', studentId: 'student-e', status: 'excused' },
  { sessionId: 'session-past-build-completed', studentId: 'student-f', status: 'absent' },
  // session-past-ravens-completed: current viewer was late; two others present.
  {
    sessionId: 'session-past-ravens-completed',
    studentId: 'student-placeholder-current-viewer',
    status: 'late',
  },
  { sessionId: 'session-past-ravens-completed', studentId: 'student-b', status: 'present' },
  { sessionId: 'session-past-ravens-completed', studentId: 'student-g', status: 'present' },
];

/**
 * Fabricated row shaped exactly like `v_student_participation`'s real output
 * (module doc #3) -- `participationPct` is what the view's own SQL would
 * have produced for these expected/present/excused counts (7 expected, 4
 * present incl. 1 late, 0 excused -> round(100*4/7,1) = 57.1); never
 * computed by this file.
 */
const FIXTURE_PARTICIPATION_METRICS: readonly StudentParticipationMetric[] = [
  {
    studentId: PLACEHOLDER_CURRENT_STUDENT_ID,
    teamId: 'team-ravens',
    seasonId: PLACEHOLDER_SEASON_ID,
    expectedCt: 7,
    presentCt: 4,
    lateCt: 1,
    excusedCt: 0,
    participationPct: 57.1,
  },
];

// ---------------------------------------------------------------------------
// Pure builder functions -- exported for direct testing.
// ---------------------------------------------------------------------------

function teamScopeLabel(teamIds: readonly string[] | null, teams: readonly FixtureTeam[]): string {
  if (teamIds === null) {
    return 'All teams';
  }
  const teamById = new Map(teams.map((team) => [team.id, team.name] as const));
  return teamIds.map((id) => teamById.get(id) ?? id).join(', ');
}

function summarizeAttendance(
  sessionId: string,
  attendance: readonly FixtureAttendanceRecord[],
): PastAttendanceSummary {
  const records = attendance.filter((record) => record.sessionId === sessionId);
  return {
    presentCt: records.filter((r) => r.status === 'present').length,
    lateCt: records.filter((r) => r.status === 'late').length,
    excusedCt: records.filter((r) => r.status === 'excused').length,
    absentCt: records.filter((r) => r.status === 'absent').length,
  };
}

/** Module doc #2 -- the ONLY `event.type` filter in this file. */
function meetingEventIdsOf(events: readonly FixtureEvent[]): Set<string> {
  return new Set(events.filter((event) => event.type === 'meeting').map((event) => event.id));
}

export function buildCoachMeetingRows(
  events: readonly FixtureEvent[],
  sessions: readonly FixtureEventSession[],
  teams: readonly FixtureTeam[],
  attendance: readonly FixtureAttendanceRecord[],
): CoachMeetingRow[] {
  const meetingEventIds = meetingEventIdsOf(events);
  const eventById = new Map(events.map((event) => [event.id, event] as const));

  return sessions
    .filter((session) => meetingEventIds.has(session.eventId))
    .map((session) => {
      const event = eventById.get(session.eventId);
      return {
        sessionId: session.id,
        title: event?.title ?? 'Untitled meeting',
        sessionDate: session.sessionDate,
        startsAt: session.startsAt,
        endsAt: session.endsAt,
        status: session.status,
        teamScopeLabel: teamScopeLabel(event?.teamIds ?? null, teams),
        attendanceSummary:
          session.status === 'completed' ? summarizeAttendance(session.id, attendance) : null,
      };
    });
}

export interface PartitionedRows<T> {
  upcoming: T[];
  past: T[];
}

/** `scheduled` -> Upcoming; `completed`/`canceled` -> Past. Sorted by start time. */
export function partitionByStatus<T extends { status: SessionStatus; startsAt: string }>(
  rows: readonly T[],
): PartitionedRows<T> {
  const upcoming = rows
    .filter((row) => row.status === 'scheduled')
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  const past = rows
    .filter((row) => row.status !== 'scheduled')
    .sort((a, b) => b.startsAt.localeCompare(a.startsAt));
  return { upcoming, past };
}

export function buildStudentMeetingsData(
  studentId: string,
  events: readonly FixtureEvent[],
  sessions: readonly FixtureEventSession[],
  attendance: readonly FixtureAttendanceRecord[],
  participationMetrics: readonly StudentParticipationMetric[],
): StudentMeetingsData {
  const meetingEventIds = meetingEventIdsOf(events);
  const eventById = new Map(events.map((event) => [event.id, event] as const));

  const history = sessions
    .filter((session) => meetingEventIds.has(session.eventId))
    .map((session) => {
      const event = eventById.get(session.eventId);
      const myRecord = attendance.find(
        (record) => record.sessionId === session.id && record.studentId === studentId,
      );
      return {
        sessionId: session.id,
        title: event?.title ?? 'Untitled meeting',
        sessionDate: session.sessionDate,
        startsAt: session.startsAt,
        endsAt: session.endsAt,
        status: session.status,
        myAttendanceStatus: myRecord?.status ?? null,
      };
    });

  const participation =
    participationMetrics.find((metric) => metric.studentId === studentId) ?? null;

  return { history, participation };
}

// ---------------------------------------------------------------------------
// Fixture loaders -- obviously-fake defaults for the injectable `loadData`
// seam (Known Context/Traps #1). Real callers (once T071's Supabase client
// is wired to a page -- a separate, not-yet-dispatched task) pass their own.
// ---------------------------------------------------------------------------

export async function defaultLoadCoachMeetingsData(): Promise<CoachMeetingsData> {
  return {
    rows: buildCoachMeetingRows(
      FIXTURE_EVENTS,
      FIXTURE_SESSIONS,
      FIXTURE_TEAMS,
      FIXTURE_ATTENDANCE,
    ),
  };
}

export async function defaultLoadStudentMeetingsData(
  studentId: string,
): Promise<StudentMeetingsData> {
  return buildStudentMeetingsData(
    studentId,
    FIXTURE_EVENTS,
    FIXTURE_SESSIONS,
    FIXTURE_ATTENDANCE,
    FIXTURE_PARTICIPATION_METRICS,
  );
}

// ---------------------------------------------------------------------------
// BEH-08 / NFR-09 date + duration formatting -- module doc #4. The ONLY
// date-formatting functions in this file.
// ---------------------------------------------------------------------------

const CHICAGO_TIME_ZONE = 'America/Chicago';

const WEEKDAY_DATE_FORMATTER = new Intl.DateTimeFormat('en-US', {
  weekday: 'short',
  month: 'short',
  day: 'numeric',
  timeZone: CHICAGO_TIME_ZONE,
});

const CLOCK_TIME_FORMATTER = new Intl.DateTimeFormat('en-US', {
  hour: 'numeric',
  minute: '2-digit',
  timeZone: CHICAGO_TIME_ZONE,
});

/** `session_date` ('YYYY-MM-DD') -> a real calendar date, parsed without a
 * local-timezone day-shift (BEH-08 needs the literal stored date). */
function parseDateOnly(isoDate: string): Date {
  const [year, month, day] = isoDate.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day, 12)); // noon UTC avoids DST edge cases
}

/** e.g. "Sat, Jul 25" (BEH-08). */
export function formatWeekdayDate(sessionDate: string): string {
  return WEEKDAY_DATE_FORMATTER.format(parseDateOnly(sessionDate));
}

/** e.g. "2h", "1h 30m", "45m" (BEH-08's computed-duration requirement). */
export function formatDuration(startsAt: string, endsAt: string): string {
  const totalMinutes = Math.round(
    (new Date(endsAt).getTime() - new Date(startsAt).getTime()) / 60000,
  );
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) return `${minutes}m`;
  if (minutes === 0) return `${hours}h`;
  return `${hours}h ${minutes}m`;
}

/** Splits a formatted "6:00 PM"-shaped string into its numeric time and
 * trailing meridiem, so `formatTimeRangeWithDuration` below can drop a
 * duplicate meridiem off the start time (PRD line 237's own worked example,
 * "6:00-8:00 PM", never fabricated -- `Intl.DateTimeFormat` alone produces
 * "6:00 PM-8:00 PM", with the meridiem repeated on every instant). */
function splitMeridiem(formatted: string): { time: string; meridiem: string | null } {
  const match = /^(.*?)\s?([AP]M)$/i.exec(formatted);
  return match ? { time: match[1], meridiem: match[2] } : { time: formatted, meridiem: null };
}

/** e.g. "6:00-8:00 PM - 2h" (PRD BEH-08's own worked example, en-dash separators). */
export function formatTimeRangeWithDuration(startsAt: string, endsAt: string): string {
  const startFormatted = CLOCK_TIME_FORMATTER.format(new Date(startsAt));
  const endFormatted = CLOCK_TIME_FORMATTER.format(new Date(endsAt));
  const start = splitMeridiem(startFormatted);
  const end = splitMeridiem(endFormatted);
  const startText =
    start.meridiem !== null && start.meridiem === end.meridiem ? start.time : startFormatted;
  return `${startText}–${endFormatted} · ${formatDuration(startsAt, endsAt)}`;
}

function formatPastAttendanceSummary(summary: PastAttendanceSummary): string {
  // Mirrors MTG-13's own literal worked example format ("14 present - 2
  // late - 1 excused - 1 absent"), PRD line 287.
  return `${summary.presentCt} present · ${summary.lateCt} late · ${summary.excusedCt} excused · ${summary.absentCt} absent`;
}

// ---------------------------------------------------------------------------
// Status -> Badge variant mappings.
// ---------------------------------------------------------------------------

const SESSION_STATUS_BADGE: Record<SessionStatus, { variant: BadgeVariant; label: string }> = {
  scheduled: { variant: 'info', label: 'Scheduled' },
  completed: { variant: 'success', label: 'Completed' },
  canceled: { variant: 'error', label: 'Canceled' },
};

/** DES-05's literal mapping (PRD line 195), used for the student's own
 * per-session attendance status only -- never for the coach's session
 * status badge above, which uses `SESSION_STATUS_BADGE` instead. */
const ATTENDANCE_STATUS_BADGE: Record<AttendanceStatus, { variant: BadgeVariant; label: string }> =
  {
    present: { variant: 'success', label: 'Present' },
    late: { variant: 'warning', label: 'Late' },
    excused: { variant: 'neutral', label: 'Excused' },
    absent: { variant: 'error', label: 'Absent' },
  };

// ---------------------------------------------------------------------------
// Generic DES-12 load-state hook -- module doc #8.
// ---------------------------------------------------------------------------

type LoadState<T> =
  | { status: 'loading' }
  | { status: 'error'; error: unknown; retry: () => void }
  | { status: 'success'; data: T };

function useLoadState<T>(load: () => Promise<T>, deps: readonly unknown[]): LoadState<T> {
  const [state, setState] = useState<LoadState<T>>({ status: 'loading' });
  // Bumped by the error Banner's "Retry" action (DES-12) to force the effect
  // below to re-run without changing the caller-supplied `deps` semantics.
  const [retryToken, setRetryToken] = useState(0);

  useEffect(() => {
    let isMounted = true;
    setState({ status: 'loading' });
    load()
      .then((data) => {
        if (isMounted) setState({ status: 'success', data });
      })
      .catch((error: unknown) => {
        if (isMounted) {
          setState({ status: 'error', error, retry: () => setRetryToken((token) => token + 1) });
        }
      });
    return () => {
      isMounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `deps` is the caller-supplied dependency list; `retryToken` is an additional internal trigger.
  }, [...deps, retryToken]);

  return state;
}

// ---------------------------------------------------------------------------
// Coach view -- module doc #7/#8.
// ---------------------------------------------------------------------------

interface StubNotice {
  title: string;
  description: string;
}

function StubBanner({
  notice,
  onDismiss,
}: {
  notice: StubNotice;
  onDismiss: () => void;
}): ReactNode {
  return (
    <Banner
      status="info"
      title={notice.title}
      description={notice.description}
      isDismissable
      onDismiss={onDismiss}
    />
  );
}

function CoachMeetingRowItem({
  row,
  onEdit,
  onCancel,
}: {
  row: CoachMeetingRow;
  onEdit: (row: CoachMeetingRow) => void;
  onCancel: (row: CoachMeetingRow) => void;
}): ReactNode {
  const statusBadge = SESSION_STATUS_BADGE[row.status];

  const menuItems: DropdownMenuOption[] = [
    { label: 'Edit', onClick: () => onEdit(row) },
    { label: 'Cancel meeting', onClick: () => onCancel(row) },
  ];

  const description = (
    <VStack gap={0.5}>
      <Text type="supporting">
        {formatWeekdayDate(row.sessionDate)} ·{' '}
        {formatTimeRangeWithDuration(row.startsAt, row.endsAt)}
      </Text>
      <Text type="supporting">{row.teamScopeLabel}</Text>
      {row.attendanceSummary !== null && (
        <Text type="supporting">{formatPastAttendanceSummary(row.attendanceSummary)}</Text>
      )}
      {row.status === 'canceled' && (
        <Text type="supporting">Canceled &mdash; no attendance recorded.</Text>
      )}
    </VStack>
  );

  const endContent = (
    <HStack gap={2} vAlign="center">
      <Badge variant={statusBadge.variant} label={statusBadge.label} />
      {row.status === 'scheduled' && (
        <MoreMenu items={menuItems} label={`Actions for ${row.title}`} />
      )}
    </HStack>
  );

  return <ListItem label={row.title} description={description} endContent={endContent} />;
}

function CoachMeetingsSection({
  title,
  rows,
  emptyDescription,
  onEdit,
  onCancel,
}: {
  title: string;
  rows: CoachMeetingRow[];
  emptyDescription: string;
  onEdit: (row: CoachMeetingRow) => void;
  onCancel: (row: CoachMeetingRow) => void;
}): ReactNode {
  return (
    <VStack gap={3}>
      <Heading level={2}>{title}</Heading>
      {rows.length === 0 ? (
        <EmptyState
          headingLevel={3}
          title={`No ${title.toLowerCase()} meetings`}
          description={emptyDescription}
        />
      ) : (
        <List hasDividers header={`${title} meetings`}>
          {rows.map((row) => (
            <CoachMeetingRowItem
              key={row.sessionId}
              row={row}
              onEdit={onEdit}
              onCancel={onCancel}
            />
          ))}
        </List>
      )}
    </VStack>
  );
}

/** T096 (module doc #7c) -- real success/error messaging for Cancel and
 * Schedule, same "success Banner + error Banner, dismissable, same
 * `feedback` slot" pattern `StudentsTab.tsx`'s own `FeedbackBanner` (T089)
 * already established. */
interface FeedbackBanner {
  status: 'success' | 'error';
  title: string;
  description: string;
}

export interface CoachMeetingsViewProps {
  loadData: LoadCoachMeetingsDataFn;
  /** T096 (module doc #7c). Defaults to a real `event_sessions.status =
   * 'canceled'` mutation (`cancelMeetingSession`,
   * `../../lib/supabase/loaders/meetings.ts`). */
  onCancelSession: CancelMeetingSessionFn;
  /** T096 (module doc #7a). Passed straight through to
   * `<ScheduleMeetingsDialog onCreateMeetings={...} />`; defaults to a real
   * `events`/`event_sessions` insert (`createMeetings`, same loader module). */
  onCreateMeetings: OnCreateMeetingsFn;
}

function CoachMeetingsView({
  loadData,
  onCancelSession,
  onCreateMeetings,
}: CoachMeetingsViewProps): ReactNode {
  const loadState = useLoadState(loadData, [loadData]);
  const [rows, setRows] = useState<CoachMeetingRow[]>([]);
  const [stubNotice, setStubNotice] = useState<StubNotice | null>(null);
  const [cancelTarget, setCancelTarget] = useState<CoachMeetingRow | null>(null);
  // T096 (module doc #7a) -- drives the one rendered `<ScheduleMeetingsDialog>`
  // instance, in CREATE mode only (module doc #7b: this dialog has no edit
  // mode to open at all).
  const [isScheduleDialogOpen, setIsScheduleDialogOpen] = useState(false);
  const [feedback, setFeedback] = useState<FeedbackBanner | null>(null);

  useEffect(() => {
    if (loadState.status === 'success') {
      setRows(loadState.data.rows);
    }
  }, [loadState]);

  const { upcoming, past } = useMemo(() => partitionByStatus(rows), [rows]);

  function openScheduleDialog(): void {
    setIsScheduleDialogOpen(true);
  }

  // T096 (module doc #7b, Trap #3 finding) -- `ScheduleMeetingsDialog.tsx`
  // has no `initialData`/"meeting to edit" prop of any kind and its own
  // `CreateMeetingsPayload` shape always creates a brand-new
  // `events`/`event_sessions` series; it genuinely cannot edit one
  // already-scheduled session in place. Honest, accurate stub copy -- NOT
  // the old "dialog not built yet" text, since the dialog IS built now.
  function showEditStub(row: CoachMeetingRow): void {
    setStubNotice({
      title: "Editing an existing meeting isn't supported yet",
      description: `"${row.title}" can't be edited in place. The real scheduling dialog (T031, MTG-02) only knows how to create a brand-new meeting series -- it has no way to load an already-scheduled session's fields, so opening it here would create a second, competing series instead of changing this one. Cancel this meeting and schedule a new one if its details need to change.`,
    });
  }

  // T096 (module doc #7c) -- real mutation, optimistic update + rollback on
  // failure, mirroring `StudentsTab.tsx`'s own `handleConfirmDeactivate`
  // (T089) shape.
  async function handleConfirmCancel(): Promise<void> {
    if (cancelTarget === null) return;
    const target = cancelTarget;
    setRows((prev) =>
      prev.map((row) =>
        row.sessionId === target.sessionId ? { ...row, status: 'canceled' } : row,
      ),
    );
    setCancelTarget(null);
    try {
      await onCancelSession(target.sessionId);
      setFeedback({
        status: 'success',
        title: 'Meeting canceled',
        description: `"${target.title}" is marked canceled. No attendance will be recorded for it.`,
      });
    } catch (error) {
      setRows((prev) =>
        prev.map((row) =>
          row.sessionId === target.sessionId ? { ...row, status: target.status } : row,
        ),
      );
      setFeedback({
        status: 'error',
        title: "Couldn't cancel meeting",
        description: isSupabaseLoaderError(error)
          ? error.message
          : `Something went wrong canceling "${target.title}". Try again in a moment.`,
      });
    }
  }

  // T096 (module doc #7a) -- real `onCreateMeetings` wiring. Reloads `rows`
  // from `loadData()` on success (a full reload, not a client-side merge --
  // see module doc #7a for why).
  async function handleCreateMeetingsSubmit(payload: CreateMeetingsPayload): Promise<void> {
    await onCreateMeetings(payload);
    const sessionCount = payload.sessions.length;
    try {
      const fresh = await loadData();
      setRows(fresh.rows);
      setFeedback({
        status: 'success',
        title: 'Meetings scheduled',
        description: `${sessionCount} meeting${sessionCount === 1 ? '' : 's'} scheduled.`,
      });
    } catch {
      // The create itself already succeeded (this catch only guards the
      // follow-up reload) -- disclosed, not fatal: `rows` just won't reflect
      // the new meeting(s) until the next successful load/retry.
      setFeedback({
        status: 'success',
        title: 'Meetings scheduled',
        description: `${sessionCount} meeting${sessionCount === 1 ? '' : 's'} scheduled. Refresh the page to see ${sessionCount === 1 ? 'it' : 'them'} in the list below.`,
      });
    }
  }

  if (loadState.status === 'loading') {
    return (
      <VStack gap={6} aria-busy="true">
        <VisuallyHidden as="div" role="status">
          Loading meetings…
        </VisuallyHidden>
        <HStack hAlign="between" vAlign="center" wrap="wrap" gap={3}>
          <Skeleton width={140} height={28} index={0} />
          <Skeleton width={160} height={32} index={1} />
        </HStack>
        <VStack gap={3}>
          <Skeleton width={100} height={20} index={2} />
          <VStack gap={2}>
            {[0, 1, 2].map((row) => (
              <HStack key={row} gap={4} vAlign="center">
                <Skeleton width={220} height={16} index={row * 2 + 3} />
                <Skeleton width={80} height={16} index={row * 2 + 4} />
              </HStack>
            ))}
          </VStack>
        </VStack>
      </VStack>
    );
  }

  if (loadState.status === 'error') {
    return (
      <Banner
        status="error"
        title="Couldn't load meetings"
        description="Something went wrong loading this season's meetings. Try refreshing the page."
        endContent={<Button variant="ghost" label="Retry" onClick={loadState.retry} />}
      />
    );
  }

  const hasAnyMeetings = rows.length > 0;

  return (
    <VStack gap={6}>
      <HStack hAlign="between" vAlign="center" wrap="wrap" gap={3}>
        <Heading level={1}>Meetings</Heading>
        <Button label="Schedule meetings" variant="primary" onClick={openScheduleDialog} />
      </HStack>

      {stubNotice !== null && (
        <StubBanner notice={stubNotice} onDismiss={() => setStubNotice(null)} />
      )}

      {feedback !== null && (
        <Banner
          status={feedback.status}
          title={feedback.title}
          description={feedback.description}
          isDismissable
          onDismiss={() => setFeedback(null)}
        />
      )}

      {!hasAnyMeetings ? (
        <EmptyState
          headingLevel={2}
          // DES-15 verbatim (PRD line 212): "No meetings scheduled. Set up
          // your weekly build meetings once and check-in takes care of
          // itself." -- title carries the first sentence, description the
          // second; concatenated they reproduce the PRD text exactly.
          title="No meetings scheduled."
          description="Set up your weekly build meetings once and check-in takes care of itself."
          actions={
            <Button label="Schedule meetings" variant="primary" onClick={openScheduleDialog} />
          }
        />
      ) : (
        <>
          <CoachMeetingsSection
            title="Upcoming"
            rows={upcoming}
            emptyDescription="No meetings are currently scheduled."
            onEdit={showEditStub}
            onCancel={(row) => setCancelTarget(row)}
          />
          <CoachMeetingsSection
            title="Past"
            rows={past}
            emptyDescription="Completed and canceled meetings will show up here."
            onEdit={showEditStub}
            onCancel={(row) => setCancelTarget(row)}
          />
        </>
      )}

      <AlertDialog
        isOpen={cancelTarget !== null}
        onOpenChange={(isOpen) => {
          if (!isOpen) setCancelTarget(null);
        }}
        title={`Cancel "${cancelTarget?.title ?? ''}"?`}
        description="This marks the session canceled. Students won't be expected to attend, and no attendance will be recorded for it."
        actionLabel="Cancel meeting"
        onAction={() => {
          void handleConfirmCancel();
        }}
      />

      {/* T096 (module doc #7a) -- `ScheduleMeetingsDialog.tsx` (T031,
          already Passed, already built) wired into this page for the first
          time, in CREATE mode only (module doc #7b: this dialog has no edit
          mode). `teams` is deliberately NOT overridden here -- it falls back
          to that component's own already-disclosed fixture team list (same
          "still fixture-backed" posture `StudentsTab.tsx`'s own module doc
          #12 already established for `StudentDialog`'s `season` prop); this
          task's own Allowed Files do not include a second teams-loading
          mechanism for scheduling specifically, and inventing one would be
          scope creep beyond wiring the dialog itself. */}
      <ScheduleMeetingsDialog
        isOpen={isScheduleDialogOpen}
        onOpenChange={setIsScheduleDialogOpen}
        onCreateMeetings={handleCreateMeetingsSubmit}
      />
    </VStack>
  );
}

// ---------------------------------------------------------------------------
// Student/parent view -- module doc #3/#7/#8.
// ---------------------------------------------------------------------------

function StudentHistoryRowItem({ row }: { row: StudentMeetingHistoryRow }): ReactNode {
  const description = (
    <VStack gap={0.5}>
      <Text type="supporting">
        {formatWeekdayDate(row.sessionDate)} ·{' '}
        {formatTimeRangeWithDuration(row.startsAt, row.endsAt)}
      </Text>
    </VStack>
  );

  const endContent =
    row.myAttendanceStatus !== null ? (
      <Badge
        variant={ATTENDANCE_STATUS_BADGE[row.myAttendanceStatus].variant}
        label={ATTENDANCE_STATUS_BADGE[row.myAttendanceStatus].label}
      />
    ) : (
      <Text type="supporting" color="secondary">
        Not yet held
      </Text>
    );

  return <ListItem label={row.title} description={description} endContent={endContent} />;
}

function StudentHistorySection({
  title,
  rows,
  emptyDescription,
}: {
  title: string;
  rows: StudentMeetingHistoryRow[];
  emptyDescription: string;
}): ReactNode {
  return (
    <VStack gap={3}>
      <Heading level={2}>{title}</Heading>
      {rows.length === 0 ? (
        <EmptyState
          headingLevel={3}
          title={`No ${title.toLowerCase()} meetings`}
          description={emptyDescription}
        />
      ) : (
        <List hasDividers header={`${title} meetings`}>
          {rows.map((row) => (
            <StudentHistoryRowItem key={row.sessionId} row={row} />
          ))}
        </List>
      )}
    </VStack>
  );
}

export interface StudentMeetingsViewProps {
  studentId: string;
  loadData: LoadStudentMeetingsDataFn;
}

function StudentMeetingsView({ studentId, loadData }: StudentMeetingsViewProps): ReactNode {
  const loadState = useLoadState(() => loadData(studentId), [loadData, studentId]);

  if (loadState.status === 'loading') {
    return (
      <VStack gap={3} aria-busy="true">
        <VisuallyHidden as="div" role="status">
          Loading your meetings…
        </VisuallyHidden>
        <Skeleton width={100} height={20} index={0} />
        <VStack gap={2}>
          {[0, 1, 2].map((row) => (
            <HStack key={row} gap={4} vAlign="center">
              <Skeleton width={220} height={16} index={row * 2 + 1} />
              <Skeleton width={80} height={16} index={row * 2 + 2} />
            </HStack>
          ))}
        </VStack>
      </VStack>
    );
  }

  if (loadState.status === 'error') {
    return (
      <Banner
        status="error"
        title="Couldn't load your meeting history"
        description="Something went wrong loading your meeting history. Try refreshing the page."
        endContent={<Button variant="ghost" label="Retry" onClick={loadState.retry} />}
      />
    );
  }

  const { history, participation } = loadState.data;
  const { upcoming, past } = partitionByStatus(history);
  const isEmpty = history.length === 0 && participation === null;

  return (
    <VStack gap={6}>
      <Heading level={1}>Meetings</Heading>

      {isEmpty ? (
        <EmptyState
          headingLevel={2}
          title="No meeting history yet"
          description="Your meeting attendance and participation will show up here once meetings for your team have been scheduled and recorded."
        />
      ) : (
        <>
          <VStack gap={2}>
            <Heading level={2}>Participation</Heading>
            {participation === null ? (
              <Text type="supporting">
                {'—'} (no completed meetings recorded for you yet this season)
              </Text>
            ) : (
              <ProgressBar
                label={`Your participation: ${participation.participationPct}%`}
                isLabelHidden
                value={participation.participationPct}
                hasValueLabel
              />
            )}
          </VStack>

          <StudentHistorySection
            title="Upcoming"
            rows={upcoming}
            emptyDescription="You have no upcoming meetings scheduled."
          />
          <StudentHistorySection
            title="Past"
            rows={past}
            emptyDescription="Your past meeting attendance will show up here."
          />

          {/* Module doc #7d -- deliberate "consistency strip"-shaped
              reference only. BEH-06's real last-5 StatusDot strip is T037's
              deliverable, not built here. */}
          <VStack gap={1}>
            <Heading level={2}>Recent attendance</Heading>
            <Text type="supporting">
              A visual "last 5 meetings" consistency strip (BEH-06) ships with T037 (Student/parent
              meeting view + consistency strip), which is not part of this task. Your full history
              is listed above in the meantime.
            </Text>
          </VStack>
        </>
      )}
    </VStack>
  );
}

// ---------------------------------------------------------------------------
// Student/parent `studentId` resolution wrapper -- module doc #6, Trap #4.
// Only ever mounted when the caller does NOT supply an explicit `studentId`
// prop; an explicit `studentId` bypasses this entirely (unchanged behavior
// for every pre-existing `MeetingsList.test.tsx` case that already passes
// one).
// ---------------------------------------------------------------------------

interface ResolvedStudentMeetingsViewProps {
  viewer: CurrentViewerIdentity;
  resolveStudentId: ResolveCurrentStudentIdFn;
  loadData: LoadStudentMeetingsDataFn;
}

function ResolvedStudentMeetingsView({
  viewer,
  resolveStudentId,
  loadData,
}: ResolvedStudentMeetingsViewProps): ReactNode {
  const loadState = useLoadState(
    () => resolveStudentId(viewer),
    [resolveStudentId, viewer.id, viewer.role],
  );

  if (loadState.status === 'loading') {
    return (
      <VStack gap={3} aria-busy="true">
        <VisuallyHidden as="div" role="status">
          Finding your student record…
        </VisuallyHidden>
        <Skeleton width={100} height={20} index={0} />
        <Skeleton width={220} height={16} index={1} />
      </VStack>
    );
  }

  if (loadState.status === 'error') {
    return (
      <Banner
        status="error"
        title="Couldn't find your student record"
        description="Something went wrong looking up which student this is for you. Try refreshing the page."
        endContent={<Button variant="ghost" label="Retry" onClick={loadState.retry} />}
      />
    );
  }

  if (loadState.data === null) {
    return (
      <EmptyState
        headingLevel={1}
        title="No student account linked yet"
        description="We couldn't find a student record linked to your account yet. Once one is linked, your meetings will show up here."
      />
    );
  }

  return <StudentMeetingsView studentId={loadState.data} loadData={loadData} />;
}

interface StudentMeetingsViewContainerProps {
  viewer: CurrentViewerIdentity;
  explicitStudentId: string | undefined;
  resolveStudentId: ResolveCurrentStudentIdFn;
  loadData: LoadStudentMeetingsDataFn;
}

/** Module doc #6 -- an explicit `studentId` (every pre-existing test case)
 * renders `StudentMeetingsView` directly, exactly as before this task;
 * `undefined` (the new real-world default) routes through
 * `ResolvedStudentMeetingsView`'s own real `resolveStudentId` load state. */
function StudentMeetingsViewContainer({
  viewer,
  explicitStudentId,
  resolveStudentId,
  loadData,
}: StudentMeetingsViewContainerProps): ReactNode {
  if (explicitStudentId !== undefined) {
    return <StudentMeetingsView studentId={explicitStudentId} loadData={loadData} />;
  }
  return (
    <ResolvedStudentMeetingsView
      viewer={viewer}
      resolveStudentId={resolveStudentId}
      loadData={loadData}
    />
  );
}

// ---------------------------------------------------------------------------
// Top-level component -- module doc #5/#6.
// ---------------------------------------------------------------------------

export interface MeetingsListProps {
  /** Coach/admin view seam. Defaults to a real query
   * (`../../lib/supabase/loaders/meetings.ts`). */
  loadCoachData?: LoadCoachMeetingsDataFn;
  /** Student/parent view seam. Defaults to a real query, same module. */
  loadStudentData?: LoadStudentMeetingsDataFn;
  /** T096 (module doc #7c). Defaults to a real mutation, same module. */
  onCancelSession?: CancelMeetingSessionFn;
  /** T096 (module doc #7a). Defaults to a real mutation, same module. */
  onCreateMeetings?: OnCreateMeetingsFn;
  /** T096 (module doc #6, Trap #4). Defaults to a real resolution, same
   * module. Only ever invoked when `studentId` below is NOT supplied. */
  resolveStudentId?: ResolveCurrentStudentIdFn;
  /**
   * Which student the student/parent view is currently scoped to (module
   * doc #6). When omitted (the real-world default), this is resolved for
   * real via `resolveStudentId` instead of falling back to a placeholder --
   * supplying it explicitly (as every fixture-driven caller/test does)
   * bypasses that resolution entirely.
   */
  studentId?: string;
}

export function MeetingsList({
  loadCoachData = loadCoachMeetingsData,
  loadStudentData = loadStudentMeetingsData,
  onCancelSession = cancelMeetingSession,
  onCreateMeetings = createMeetings,
  resolveStudentId = resolveCurrentStudentId,
  studentId,
}: MeetingsListProps = {}): ReactNode {
  const { user } = useAuth();

  // Module doc #5 -- only the two role literals present in guards.tsx's
  // stale `Role` union are compared directly; everything else (including a
  // real 'student'/'parent' value) falls through to the student/parent view.
  const isCoachOrAdminView = user !== null && (user.role === 'coach' || user.role === 'admin');

  if (user === null) {
    return (
      <VStack gap={4} padding={6}>
        <EmptyState
          headingLevel={1}
          title="Sign in to view meetings"
          description="You need to be signed in to see this page."
        />
      </VStack>
    );
  }

  return (
    <VStack gap={6} padding={6}>
      {isCoachOrAdminView ? (
        <CoachMeetingsView
          loadData={loadCoachData}
          onCancelSession={onCancelSession}
          onCreateMeetings={onCreateMeetings}
        />
      ) : (
        <StudentMeetingsViewContainer
          viewer={{ id: user.id, role: user.role }}
          explicitStudentId={studentId}
          resolveStudentId={resolveStudentId}
          loadData={loadStudentData}
        />
      )}
    </VStack>
  );
}

export default MeetingsList;
