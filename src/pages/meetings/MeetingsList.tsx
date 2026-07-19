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
 * 6. No student/profile linkage on `AuthUser` yet -- a real gap, disclosed
 *    and stood in for, not silently assumed.
 *
 * `AuthUser` (`guards.tsx`) carries only `{id, email, role}` -- no
 * `students.id` linkage for a `student`-role user, and no `guardian_links`
 * lookup for a `parent`-role user (who may have multiple linked students,
 * needing a selector this task does not build). `PLACEHOLDER_CURRENT_STUDENT_ID`
 * below is a disclosed stand-in for "the one student this viewer is
 * currently looking at", the same class of gap `ParticipationTab.tsx`/T056
 * documented for `PLACEHOLDER_CURRENT_SEASON_ID` (a real implementation
 * would resolve this from `students.profile_id = auth.uid()` for a student,
 * or a `guardian_links` row + selector for a parent, once a shared Supabase
 * client exists -- Known Context/Traps #1).
 *
 * -----------------------------------------------------------------------
 * 7. Deliberate stubs (per Forbidden Files -- disclosed, not silently
 *    built as if real):
 *
 *    a. "Schedule meetings" button (coach view) -- `ScheduleMeetingsDialog.tsx`
 *       is T031's (currently Blocked) deliverable, a forbidden file here.
 *       The button is real, visible, and clickable, but its `onClick`
 *       shows an inline `Banner` disclosing that the real scheduling dialog
 *       is not built yet, rather than silently doing nothing or faking a
 *       dialog.
 *    b. Row "Edit" menu item (coach view) -- editing a meeting's fields
 *       almost certainly reuses T031's same field set (MTG-02); this task
 *       does not invent a second, competing edit form. `onClick` shows the
 *       same disclosure `Banner` as (a), scoped to the specific session.
 *    c. Row "Cancel" menu item + `AlertDialog` (coach view) -- built FOR
 *       REAL (not a stub): confirming sets that row's local `status` to
 *       `'canceled'` (DES-11), same as PRD MTG-01's literal "Cancel
 *       session -- AlertDialog"; only the persistence layer is fixture-only
 *       (Known Context/Traps #1 -- no Supabase client wiring in this task).
 *    d. "Consistency strip"-shaped area (student/parent view) -- BEH-06's
 *       "last 5 completed meetings as `StatusDot`s" widget is T037's
 *       ("Student/parent meeting view + consistency strip", currently
 *       Blocked on this task) deliverable per `docs/swarm/task-ledger.md`.
 *       This file renders a clearly-labeled placeholder `Section`
 *       explaining that the real strip ships in T037, with NO `StatusDot`
 *       usage and no fabricated "last 5" data anywhere -- it does build the
 *       plain, real Upcoming/Past history rows MTG-14 itself requires (own
 *       status per session), which is a distinct, narrower deliverable than
 *       T037's summary widget on top of it.
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
import { useAuth } from '../../app/guards';

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

// ---------------------------------------------------------------------------
// Placeholder identifiers -- module doc #6.
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

export interface CoachMeetingsViewProps {
  loadData: LoadCoachMeetingsDataFn;
}

function CoachMeetingsView({ loadData }: CoachMeetingsViewProps): ReactNode {
  const loadState = useLoadState(loadData, [loadData]);
  const [rows, setRows] = useState<CoachMeetingRow[]>([]);
  const [stubNotice, setStubNotice] = useState<StubNotice | null>(null);
  const [cancelTarget, setCancelTarget] = useState<CoachMeetingRow | null>(null);

  useEffect(() => {
    if (loadState.status === 'success') {
      setRows(loadState.data.rows);
    }
  }, [loadState]);

  const { upcoming, past } = useMemo(() => partitionByStatus(rows), [rows]);

  function showScheduleStub(): void {
    setStubNotice({
      title: 'Scheduling dialog not built yet',
      description:
        "This action opens the meeting-scheduling dialog (T031, MTG-02). That dialog hasn't shipped yet, so nothing was scheduled.",
    });
  }

  function showEditStub(row: CoachMeetingRow): void {
    setStubNotice({
      title: 'Edit dialog not built yet',
      description: `Editing "${row.title}" would open the same scheduling dialog (T031, MTG-02) in edit mode. That dialog hasn't shipped yet, so nothing was changed.`,
    });
  }

  function handleConfirmCancel(): void {
    if (cancelTarget === null) return;
    setRows((prev) =>
      prev.map((row) =>
        row.sessionId === cancelTarget.sessionId ? { ...row, status: 'canceled' } : row,
      ),
    );
    setCancelTarget(null);
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
        <Button label="Schedule meetings" variant="primary" onClick={showScheduleStub} />
      </HStack>

      {stubNotice !== null && (
        <StubBanner notice={stubNotice} onDismiss={() => setStubNotice(null)} />
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
            <Button label="Schedule meetings" variant="primary" onClick={showScheduleStub} />
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
        onAction={handleConfirmCancel}
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
// Top-level component -- module doc #5/#6.
// ---------------------------------------------------------------------------

export interface MeetingsListProps {
  /** Coach/admin view seam. Defaults to fixture data (Known Context/Traps #1). */
  loadCoachData?: LoadCoachMeetingsDataFn;
  /** Student/parent view seam. Defaults to fixture data. */
  loadStudentData?: LoadStudentMeetingsDataFn;
  /** Which student the student/parent view is currently scoped to (module doc #6). */
  studentId?: string;
}

export function MeetingsList({
  loadCoachData = defaultLoadCoachMeetingsData,
  loadStudentData = defaultLoadStudentMeetingsData,
  studentId = PLACEHOLDER_CURRENT_STUDENT_ID,
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
        <CoachMeetingsView loadData={loadCoachData} />
      ) : (
        <StudentMeetingsView studentId={studentId} loadData={loadStudentData} />
      )}
    </VStack>
  );
}

export default MeetingsList;
