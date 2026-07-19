/**
 * T037: the real BEH-06 "consistency strip" -- last 5 completed meetings
 * rendered as `StatusDot`s (present/late/excused/absent per DES-05), plus
 * the participation % that sits alongside it, built as a standalone,
 * reusable widget (not a page route on its own).
 *
 * -----------------------------------------------------------------------
 * 0. SCOPE -- how this task reads the overlap with `MeetingsList.tsx`
 *    (T030, Passed, read-only), per the worker packet's Known Context/
 *    Traps #1. Read in full before writing any code here.
 *
 * `MeetingsList.tsx`'s `StudentMeetingsView` ALREADY ships the full MTG-14
 * read-only history page for students/parents: own Upcoming/Past rows (per-
 * session attendance `Badge`s using DES-05's mapping), the participation %
 * `ProgressBar` (sourced from a `v_student_participation`-shaped fixture),
 * and all four DES-12 states. It also renders an explicitly-labeled
 * placeholder `Section` ("Recent attendance") whose copy states, verbatim,
 * that BEH-06's real "last 5 meetings" `StatusDot` consistency strip is
 * T037's deliverable and is NOT built there.
 *
 * Reading that placeholder's own words plus this task's packet (Objective,
 * Known Context/Traps #1, Acceptance Criteria) together, the packet's
 * literal narrowing instruction controls over the ledger-style Objective
 * line's broader-sounding phrasing (constitution item 1's PRD > ledger-text
 * precedence order applies analogously to packet-vs-ledger-framing here,
 * since the packet is this task's authoritative scope statement). This
 * task's chosen scope is therefore the NARROW one the packet spells out:
 *
 *   Build the real, standalone, reusable BEH-06 consistency-strip widget
 *   (last-5 `StatusDot`s + the participation % that belongs next to it)
 *   that a future wiring task can drop into `MeetingsList.tsx`'s named
 *   placeholder slot -- and, per PRD line 235 ("student/parent meeting
 *   views (MTG-14, HOME-03)"), potentially into `ParentHome.tsx` (T055)'s
 *   "next 3 events"/per-student card too, since BEH-06 explicitly names
 *   both surfaces as consumers of the SAME strip.
 *
 * This is NOT a second, competing rebuild of `MeetingsList.tsx`'s own
 * Upcoming/Past history rows or its own participation `ProgressBar` -- this
 * file does not render a session history list at all. This IS judged
 * genuinely resolvable (not ambiguous enough to require a dispute) because
 * the packet's narrowing language is unusually explicit and the placeholder
 * `Section` it points at is unambiguous about what it is deferring. No
 * dispute filed for this scope question; flagged and explained here per the
 * packet's own instruction to "state your read of the situation and your
 * chosen scope clearly" regardless of which way it resolved.
 *
 * -----------------------------------------------------------------------
 * 1. Ground truth -- `event_sessions`/`attendance` column shapes, cited
 *    directly from `supabase/migrations/20260717000000_scheduling_attendance.sql`
 *    (read-only), not redefined with invented fields:
 *
 *    `event_sessions` (lines 53-63): id, event_id, session_date (date),
 *    starts_at (timestamptz), ends_at (timestamptz), status (check:
 *    'scheduled' | 'completed' | 'canceled'), people_reached, notes,
 *    created_at.
 *
 *    `attendance` (lines 82-95): id, session_id, student_id, status (check:
 *    'present' | 'late' | 'excused' | 'absent'), check_in_at, check_out_at,
 *    hours_override, method, recorded_by, updated_at, created_at.
 *
 *    `ConsistencySession`/`ConsistencyAttendanceRecord` below are camelCase
 *    renames of exactly the subset of these columns this widget needs (id/
 *    sessionDate/startsAt/status; sessionId/studentId/status) -- no invented
 *    fields, no re-derived RLS.
 *
 *    `guardian_links` (`supabase/migrations/20260716000000_identity_roster.sql`
 *    lines 72-79): id, parent_profile_id fk profiles, student_id fk
 *    students, relationship, created_at, unique(parent_profile_id,
 *    student_id) -- i.e. genuinely one-to-many (a parent can have multiple
 *    rows, one per linked student). `LinkedStudentSummary` below is the
 *    display-only shape (studentId + a name to label each strip) this
 *    widget needs from that relationship -- not a re-derivation of the
 *    table itself.
 *
 * -----------------------------------------------------------------------
 * 2. Ground truth -- `v_student_participation`'s real column shape
 *    (constitution item 3, BLOCKER if re-derived), cited directly from
 *    `supabase/migrations/20260717000003_metric_views.sql` lines 21-42:
 *
 *   create or replace view v_student_participation as
 *   with expected as (
 *     select s.id as student_id, s.team_id, es.id as session_id, e.season_id
 *     from students s
 *     join events e on e.counts_participation
 *       and (e.team_ids is null or s.team_id = any(e.team_ids))
 *     join event_sessions es on es.event_id = e.id and es.status = 'completed'
 *     where s.is_active
 *   )
 *   select
 *     x.student_id, x.team_id, x.season_id,
 *     count(*) as expected_ct,
 *     count(*) filter (where a.status in ('present','late')) as present_ct,
 *     count(*) filter (where a.status = 'late')    as late_ct,
 *     count(*) filter (where a.status = 'excused') as excused_ct,
 *     round(100.0 * count(*) filter (where a.status in ('present','late'))
 *           / greatest(count(*) - count(*) filter (where a.status = 'excused'), 1), 1)
 *       as participation_pct
 *   from expected x
 *   left join attendance a
 *     on a.session_id = x.session_id and a.student_id = x.student_id
 *   group by x.student_id, x.team_id, x.season_id;
 *
 * `StudentParticipationMetric` below is a verbatim camelCase rename of
 * these seven columns (studentId, teamId, seasonId, expectedCt, presentCt,
 * lateCt, excusedCt, participationPct) -- the same shape/citation
 * `MeetingsList.tsx` and `ParticipationTab.tsx` already established. This
 * file performs NO percentage arithmetic anywhere: grep-provable, no
 * `100.0 *`, no `/ greatest(`, no `presentCt / expectedCt` division of any
 * kind. `FIXTURE_PARTICIPATION_METRICS` below supplies already-computed
 * `participationPct` values (as the view's own SQL would have produced
 * them for the paired counts), never computed by this component.
 *
 * -----------------------------------------------------------------------
 * 3. Constitution item 17 / BEH-06 (BLOCKER-class here) -- no streak
 *    counters, no "don't break it" mechanics, anywhere in this file.
 *
 * `selectLastCompletedAttendance` below selects a bounded, capped-at-5
 * window of a student's own past attendance -- it never counts a
 * consecutive run, never resets/breaks a counter, and never treats one
 * meeting's status as depending on any other meeting's status. Excused
 * marks map to DES-05's `neutral` `StatusDot` variant (`ATTENDANCE_STATUS_DOT`
 * below) -- the SAME neutral treatment every non-present, non-absent,
 * non-late state gets, never `error`/red. No copy anywhere in this file
 * says "streak", "day streak", "keep it up", "don't break", or counts
 * consecutive occurrences of anything (grep-provable -- see this task's
 * worker output for the literal grep run).
 *
 * -----------------------------------------------------------------------
 * 4. "Last 5 completed meetings" selection logic (Known Context/Traps #3).
 *
 * `selectLastCompletedAttendance` only considers sessions with
 * `status === 'completed'` (scheduled/canceled sessions are excluded
 * entirely, even if an attendance row somehow existed for one), looks up
 * this student's own attendance record for each, sorts by `startsAt`
 * descending (most-recent-first), and slices to `CONSISTENCY_STRIP_LIMIT`
 * (5). A student with fewer than 5 qualifying records gets exactly that
 * many entries back -- there is no padding step anywhere in this function,
 * so `entries.length` can be 0..5 and the strip always renders exactly that
 * many dots, never a fixed 5 with empty placeholders. Proven by direct
 * tests in `StudentMeetingView.test.tsx` (4-entry and 8-capped-to-5 cases).
 *
 * -----------------------------------------------------------------------
 * 5. No shared Supabase client wired in -- same posture as every prior
 *    content page (`MeetingsList.tsx`, `ParticipationTab.tsx`, etc.):
 *    injectable `loadData`-style seams (`LoadConsistencyStripDataFn`,
 *    `LoadLinkedStudentsFn`) defaulting to obviously-fake fixture data.
 *
 * -----------------------------------------------------------------------
 * 6. Parent variant -- plural linked students, one strip per student
 *    (Known Context/Traps #6, this task's own design call).
 *
 * `guardian_links` is genuinely one-to-many (module doc #1). This file
 * does NOT assume a parent has exactly one child: `StudentMeetingView`'s
 * `variant="linked"` mode calls an injectable `loadLinkedStudents` seam
 * that returns an array of `LinkedStudentSummary` rows, then renders one
 * independent `Section` containing its own `StudentConsistencyStripCard`
 * per student -- each reaching its own loading/error/populated state on its
 * own schedule (no shared loading gate across siblings). The alternative
 * (a single student-selector dropdown showing one strip at a time) was
 * considered and rejected: BEH-06/HOME-03's "one Card per linked student"
 * framing (PRD line 265, HOME-03) fits a plural-visible-at-once layout
 * better than a selector that hides all-but-one child by default, and this
 * widget is small enough (a handful of dots + one progress bar) that
 * showing every linked student's strip at once does not create the kind of
 * information overload a selector would be solving for. Disclosed per the
 * packet's explicit instruction to state this choice.
 *
 * `variant="own"` (the default) covers the single-student case (a student
 * viewing their own strip, or this widget being dropped into
 * `MeetingsList.tsx`'s own placeholder slot for that same student). This
 * component intentionally does NOT call `useAuth()` to infer which variant
 * to render -- `guards.tsx`'s `Role` union still lacks `student`/`parent`
 * (the same gap `MeetingsList.tsx`'s module doc #5 already disclosed, and
 * `AuthUser` still has no `students.id`/`guardian_links` linkage, the same
 * gap module doc #6 there disclosed), so any inference here would be
 * exactly as provisional as `MeetingsList.tsx`'s own and would duplicate
 * that disclosed gap rather than resolve it. A future wiring task (which
 * will have real role/linkage data by the time it exists) passes `variant`
 * explicitly instead.
 *
 * -----------------------------------------------------------------------
 * 7. DES-12 four states, reached independently per rendered strip.
 *
 * `StudentConsistencyStripCard` (the per-student unit `variant="own"` uses
 * directly and `variant="linked"` repeats once per linked student):
 * loading (`Spinner` while `loadData(studentId)` is pending) / error
 * (`loadData` rejects -- `Banner status="error"`) / empty (zero completed-
 * meeting entries AND no participation row -- rendered inline inside
 * `ConsistencyStrip`, not a page-level `EmptyState`, since this is a
 * compact embeddable widget that may be repeated several times on one
 * page (the `variant="linked"` case) where a full-size `EmptyState` block
 * per child would be disproportionately heavy) / populated (the dot row +
 * `ProgressBar`). `variant="linked"` additionally has its own outer
 * loading/error/empty states for the `loadLinkedStudents` lookup itself
 * (zero linked students -- e.g. before any `guardian_links` row exists --
 * gets a page-level `EmptyState`, since that IS the "nothing to show at
 * all" case a full-size empty state suits).
 *
 * -----------------------------------------------------------------------
 * 8. Astryx prop sourcing (constitution item 2) -- every prop below,
 *    cross-checked against `docs/swarm/astryx-api.md` directly (StatusDot
 *    and ProgressBar re-confirmed live via the doc file; Heading and
 *    ListItem's CLI gap noted by prior tasks re-run live for this task,
 *    not assumed):
 *
 *  - `StatusDot`: "StatusDot" section (`docs/swarm/astryx-api.md` line
 *    5851). Props table: `variant` (`'success'|'warning'|'error'|'accent'|
 *    'neutral'`, required), `label` (required), `tooltip` used below.
 *    `isPulsing` deliberately NEVER used anywhere in this file -- BEH-06's
 *    own ban on gamification/urgency mechanics (module doc #3) makes a
 *    pulsing dot exactly the wrong signal for a routine attendance record.
 *  - `ProgressBar`: "ProgressBar" Props table. `label` (required), `value`,
 *    `isLabelHidden`, `hasValueLabel` used -- the same idiom
 *    `MeetingsList.tsx`/`ParticipationTab.tsx` already established for a
 *    pre-computed percentage.
 *  - `Section`: "Section" Props table. `padding` used (one `Section` per
 *    rendered student strip).
 *  - `Heading`: doc's own "Components > Heading" subsection is `undefined`;
 *    `npm run astryx -- component Heading` (re-run live for this task)
 *    resolves `level` (1-6, required) + `children` (required) -- only
 *    those two used below.
 *  - `Banner`: "Banner" Props table. `status`, `title`, `description` used.
 *  - `EmptyState`: "EmptyState" Props table. `title` (required),
 *    `description` used (the `variant="linked"`/zero-linked-students case
 *    only).
 *  - `Spinner`: "Spinner" Props table. `label` used.
 *  - `VStack`/`HStack`: "Stack" section, `VStack`/`HStack` subsections.
 *    `gap`, `vAlign`, `wrap` used.
 *  - `Text`: "Text" Props table. `type` (`'label'`, `'supporting'`),
 *    `color` used.
 */
import { useEffect, useState, type ReactNode } from 'react';
import {
  Banner,
  EmptyState,
  Heading,
  HStack,
  ProgressBar,
  Section,
  Spinner,
  StatusDot,
  Text,
  VStack,
} from '@astryxdesign/core';

// ---------------------------------------------------------------------------
// Types -- verbatim camelCase renames of real columns. See module doc #1/#2.
// ---------------------------------------------------------------------------

export type AttendanceStatus = 'present' | 'late' | 'excused' | 'absent';
export type SessionStatus = 'scheduled' | 'completed' | 'canceled';

/** `StatusDot`'s own exported variant union (module doc #8), copied here
 * rather than imported so this file's mapping table below type-checks
 * against the exact set the component accepts. */
type StatusDotVariant = 'success' | 'warning' | 'error' | 'accent' | 'neutral';

export interface ConsistencySession {
  id: string;
  sessionDate: string;
  startsAt: string;
  status: SessionStatus;
}

export interface ConsistencyAttendanceRecord {
  sessionId: string;
  studentId: string;
  status: AttendanceStatus;
}

/**
 * Verbatim camelCase rename of `v_student_participation`'s seven real
 * columns (module doc #2). `null` means the student has no row in the view
 * at all (the real "expected_ct = 0" absence case), rendered as "-" --
 * never a fabricated 0%.
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

/** Display-only shape of a `guardian_links` row for the parent variant
 * (module doc #1/#6) -- NOT a re-derivation of the table itself. */
export interface LinkedStudentSummary {
  studentId: string;
  displayName: string;
}

/** One dot's worth of data for the strip -- last-5-completed selection
 * output (module doc #4). */
export interface ConsistencyStripEntry {
  sessionId: string;
  sessionDate: string;
  status: AttendanceStatus;
}

export interface ConsistencyStripData {
  entries: ConsistencyStripEntry[];
  participation: StudentParticipationMetric | null;
}

export type LoadConsistencyStripDataFn = (studentId: string) => Promise<ConsistencyStripData>;
export type LoadLinkedStudentsFn = () => Promise<LinkedStudentSummary[]>;

// ---------------------------------------------------------------------------
// Placeholder identifiers -- module doc #6 (same disclosed-gap class as
// `MeetingsList.tsx`'s own `PLACEHOLDER_CURRENT_STUDENT_ID`).
// ---------------------------------------------------------------------------

export const PLACEHOLDER_CONSISTENCY_STUDENT_ID = 'student-consistency-placeholder-viewer';

// ---------------------------------------------------------------------------
// Fixture data (constitution item 6: fabricated names only).
//
// Two students prove the last-5 selection boundary (module doc #4):
//   - `student-jordan-fixture` has 8 completed-session attendance records
//     -> the strip must cap at exactly 5 (the 5 most recent), not show 8.
//   - `student-morgan-fixture` has exactly 4 -> the strip must show exactly
//     4 dots, never padded to 5.
// A third, `student-alex-fixture`, has zero completed-session records at
// all, proving the empty case renders inline rather than crashing/padding.
// The 5 most recent records for Jordan deliberately span all four
// AttendanceStatus values (present/late/excused/absent) so a single render
// proves DES-05's full mapping, including that "excused" never renders as
// a failure (module doc #3).
// ---------------------------------------------------------------------------

const FIXTURE_SESSIONS: readonly ConsistencySession[] = [
  {
    id: 'cs-1',
    sessionDate: '2026-05-06',
    startsAt: '2026-05-06T23:00:00.000Z',
    status: 'completed',
  },
  {
    id: 'cs-2',
    sessionDate: '2026-05-13',
    startsAt: '2026-05-13T23:00:00.000Z',
    status: 'completed',
  },
  {
    id: 'cs-3',
    sessionDate: '2026-05-20',
    startsAt: '2026-05-20T23:00:00.000Z',
    status: 'completed',
  },
  {
    id: 'cs-4',
    sessionDate: '2026-05-27',
    startsAt: '2026-05-27T23:00:00.000Z',
    status: 'completed',
  },
  {
    id: 'cs-5',
    sessionDate: '2026-06-03',
    startsAt: '2026-06-03T23:00:00.000Z',
    status: 'completed',
  },
  {
    id: 'cs-6',
    sessionDate: '2026-06-10',
    startsAt: '2026-06-10T23:00:00.000Z',
    status: 'completed',
  },
  {
    id: 'cs-7',
    sessionDate: '2026-06-17',
    startsAt: '2026-06-17T23:00:00.000Z',
    status: 'completed',
  },
  {
    id: 'cs-8',
    sessionDate: '2026-06-24',
    startsAt: '2026-06-24T23:00:00.000Z',
    status: 'completed',
  },
  // Deliberately NOT completed -- must never be selectable even though an
  // attendance-shaped record could in principle reference it (module doc #4).
  {
    id: 'cs-9-scheduled',
    sessionDate: '2026-07-01',
    startsAt: '2026-07-01T23:00:00.000Z',
    status: 'scheduled',
  },
  {
    id: 'cs-10-canceled',
    sessionDate: '2026-06-20',
    startsAt: '2026-06-20T23:00:00.000Z',
    status: 'canceled',
  },
];

const FIXTURE_ATTENDANCE: readonly ConsistencyAttendanceRecord[] = [
  // student-jordan-fixture: 8 completed records. Most recent 5 (cs-8..cs-4,
  // descending) are present/absent/late/present/excused -- all four states.
  { sessionId: 'cs-1', studentId: 'student-jordan-fixture', status: 'present' },
  { sessionId: 'cs-2', studentId: 'student-jordan-fixture', status: 'late' },
  { sessionId: 'cs-3', studentId: 'student-jordan-fixture', status: 'present' },
  { sessionId: 'cs-4', studentId: 'student-jordan-fixture', status: 'excused' },
  { sessionId: 'cs-5', studentId: 'student-jordan-fixture', status: 'present' },
  { sessionId: 'cs-6', studentId: 'student-jordan-fixture', status: 'late' },
  { sessionId: 'cs-7', studentId: 'student-jordan-fixture', status: 'absent' },
  { sessionId: 'cs-8', studentId: 'student-jordan-fixture', status: 'present' },

  // student-morgan-fixture: exactly 4 completed records -- fewer-than-5
  // boundary case (module doc #4).
  { sessionId: 'cs-5', studentId: 'student-morgan-fixture', status: 'present' },
  { sessionId: 'cs-6', studentId: 'student-morgan-fixture', status: 'late' },
  { sessionId: 'cs-7', studentId: 'student-morgan-fixture', status: 'excused' },
  { sessionId: 'cs-8', studentId: 'student-morgan-fixture', status: 'absent' },

  // student-alex-fixture: zero records -- empty case.
];

/**
 * Fabricated rows shaped exactly like `v_student_participation`'s real
 * output (module doc #2) -- `participationPct` is what the view's own SQL
 * would have produced for these expected/present/excused counts, never
 * computed by this file.
 *   jordan: present+late = 6 of 8 (1 excused) -> round(100*6/(8-1),1) = 85.7
 *   morgan: present+late = 2 of 4 (1 excused) -> round(100*2/(4-1),1) = 66.7
 *   alex: no row at all (zero expected sessions yet) -> renders "-"
 */
const FIXTURE_PARTICIPATION_METRICS: readonly StudentParticipationMetric[] = [
  {
    studentId: 'student-jordan-fixture',
    teamId: 'team-ravens',
    seasonId: 'season-placeholder-current',
    expectedCt: 8,
    presentCt: 6,
    lateCt: 2,
    excusedCt: 1,
    participationPct: 85.7,
  },
  {
    studentId: 'student-morgan-fixture',
    teamId: 'team-ravens',
    seasonId: 'season-placeholder-current',
    expectedCt: 4,
    presentCt: 2,
    lateCt: 1,
    excusedCt: 1,
    participationPct: 66.7,
  },
];

const FIXTURE_LINKED_STUDENTS: readonly LinkedStudentSummary[] = [
  { studentId: 'student-jordan-fixture', displayName: 'Jordan R.' },
  { studentId: 'student-morgan-fixture', displayName: 'Morgan R.' },
  { studentId: 'student-alex-fixture', displayName: 'Alex R.' },
];

// ---------------------------------------------------------------------------
// Pure builder functions -- exported for direct testing. Module doc #3/#4.
// ---------------------------------------------------------------------------

export const CONSISTENCY_STRIP_LIMIT = 5;

/**
 * Selects this student's own attendance records for `status === 'completed'`
 * sessions only, most-recent-first, capped at `limit` (default 5). Returns
 * FEWER than `limit` entries when the student's own completed-and-attended
 * history is shorter -- there is no padding step, deliberately (module doc
 * #4, BEH-06's own "not streaks" framing -- a short history is just a short
 * history, never disguised as a full one or a broken one).
 */
export function selectLastCompletedAttendance(
  sessions: readonly ConsistencySession[],
  attendance: readonly ConsistencyAttendanceRecord[],
  studentId: string,
  limit: number = CONSISTENCY_STRIP_LIMIT,
): ConsistencyStripEntry[] {
  const completedSessionById = new Map(
    sessions.filter((session) => session.status === 'completed').map((s) => [s.id, s] as const),
  );

  return attendance
    .filter(
      (record) => record.studentId === studentId && completedSessionById.has(record.sessionId),
    )
    .map((record) => {
      const session = completedSessionById.get(record.sessionId);
      return {
        sessionId: record.sessionId,
        sessionDate: session?.sessionDate ?? '',
        startsAt: session?.startsAt ?? '',
        status: record.status,
      };
    })
    .sort((a, b) => b.startsAt.localeCompare(a.startsAt))
    .slice(0, limit)
    .map(({ sessionId, sessionDate, status }) => ({ sessionId, sessionDate, status }));
}

export function buildConsistencyStripData(
  studentId: string,
  sessions: readonly ConsistencySession[],
  attendance: readonly ConsistencyAttendanceRecord[],
  participationMetrics: readonly StudentParticipationMetric[],
): ConsistencyStripData {
  return {
    entries: selectLastCompletedAttendance(sessions, attendance, studentId),
    participation: participationMetrics.find((metric) => metric.studentId === studentId) ?? null,
  };
}

// ---------------------------------------------------------------------------
// Fixture loaders -- obviously-fake defaults for the injectable `loadData`
// seams (module doc #5). Real callers (once a shared Supabase client is
// wired to a page -- a separate, not-yet-dispatched task) pass their own.
// ---------------------------------------------------------------------------

export async function defaultLoadConsistencyStripData(
  studentId: string,
): Promise<ConsistencyStripData> {
  return buildConsistencyStripData(
    studentId,
    FIXTURE_SESSIONS,
    FIXTURE_ATTENDANCE,
    FIXTURE_PARTICIPATION_METRICS,
  );
}

export async function defaultLoadLinkedStudents(): Promise<LinkedStudentSummary[]> {
  return [...FIXTURE_LINKED_STUDENTS];
}

// ---------------------------------------------------------------------------
// NFR-09 date formatting -- America/Chicago, the only date-formatting
// function in this file.
// ---------------------------------------------------------------------------

const CHICAGO_TIME_ZONE = 'America/Chicago';

const SHORT_DATE_FORMATTER = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  timeZone: CHICAGO_TIME_ZONE,
});

/** `session_date` ('YYYY-MM-DD') -> a real calendar date, parsed without a
 * local-timezone day-shift. */
function parseDateOnly(isoDate: string): Date {
  const [year, month, day] = isoDate.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day, 12)); // noon UTC avoids DST edge cases
}

/** e.g. "Jun 24" -- used only for each dot's tooltip/label date. */
function formatShortDate(sessionDate: string): string {
  return SHORT_DATE_FORMATTER.format(parseDateOnly(sessionDate));
}

// ---------------------------------------------------------------------------
// DES-05's literal mapping (PRD line 195), used verbatim -- module doc #3.
// Excused maps to the SAME `neutral` variant as any other non-failure,
// non-praise state -- never `error`.
// ---------------------------------------------------------------------------

const ATTENDANCE_STATUS_DOT: Record<
  AttendanceStatus,
  { variant: StatusDotVariant; label: string }
> = {
  present: { variant: 'success', label: 'Present' },
  late: { variant: 'warning', label: 'Late' },
  excused: { variant: 'neutral', label: 'Excused' },
  absent: { variant: 'error', label: 'Absent' },
};

// ---------------------------------------------------------------------------
// Generic DES-12 load-state hook -- module doc #7. Independently written
// (small, generic React data-fetching shape, not a metric formula) rather
// than imported from `MeetingsList.tsx`, per this file's standalone-widget
// scope (module doc #0).
// ---------------------------------------------------------------------------

type LoadState<T> =
  { status: 'loading' } | { status: 'error'; error: unknown } | { status: 'success'; data: T };

function useLoadState<T>(load: () => Promise<T>, deps: readonly unknown[]): LoadState<T> {
  const [state, setState] = useState<LoadState<T>>({ status: 'loading' });

  useEffect(() => {
    let isMounted = true;
    setState({ status: 'loading' });
    load()
      .then((data) => {
        if (isMounted) setState({ status: 'success', data });
      })
      .catch((error: unknown) => {
        if (isMounted) setState({ status: 'error', error });
      });
    return () => {
      isMounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `deps` is the caller-supplied dependency list.
  }, deps);

  return state;
}

// ---------------------------------------------------------------------------
// `ConsistencyStrip` -- the reusable presentational widget itself (module
// doc #0, #8). No data-fetching, no role logic: pure props in, dots +
// participation bar out. This is the piece a future wiring task drops into
// `MeetingsList.tsx`'s placeholder `Section` and/or `ParentHome.tsx`'s
// per-student card.
// ---------------------------------------------------------------------------

export interface ConsistencyStripProps {
  entries: readonly ConsistencyStripEntry[];
  participation: StudentParticipationMetric | null;
  /** Optional per-student heading, used by the `variant="linked"` (plural
   * children) case to distinguish cards. Omitted for the single-viewer
   * `variant="own"` case. */
  studentLabel?: string;
}

export function ConsistencyStrip({
  entries,
  participation,
  studentLabel,
}: ConsistencyStripProps): ReactNode {
  return (
    <VStack gap={3}>
      {studentLabel !== undefined && <Heading level={3}>{studentLabel}</Heading>}

      <VStack gap={1}>
        <Text type="label">
          {entries.length === 0
            ? 'Recent meeting attendance'
            : `Last ${entries.length} completed meeting${entries.length === 1 ? '' : 's'}`}
        </Text>
        {entries.length === 0 ? (
          <Text type="supporting" color="secondary">
            No completed meetings recorded yet.
          </Text>
        ) : (
          <HStack gap={2} vAlign="center" wrap="wrap">
            {entries.map((entry) => {
              const dot = ATTENDANCE_STATUS_DOT[entry.status];
              const dotDescription = `${dot.label} — ${formatShortDate(entry.sessionDate)}`;
              return (
                <StatusDot
                  key={entry.sessionId}
                  variant={dot.variant}
                  label={dotDescription}
                  tooltip={dotDescription}
                />
              );
            })}
          </HStack>
        )}
      </VStack>

      <VStack gap={1}>
        <Text type="label">Participation</Text>
        {participation === null ? (
          <Text type="supporting" color="secondary">
            {'—'} (no completed meetings recorded yet this season)
          </Text>
        ) : (
          <ProgressBar
            label={`Participation: ${participation.participationPct}%`}
            isLabelHidden
            value={participation.participationPct}
            hasValueLabel
          />
        )}
      </VStack>
    </VStack>
  );
}

// ---------------------------------------------------------------------------
// `StudentConsistencyStripCard` -- one student's strip, wired to the
// injectable `loadData` seam, with its own DES-12 loading/error states
// (module doc #7).
// ---------------------------------------------------------------------------

interface StudentConsistencyStripCardProps {
  studentId: string;
  studentLabel?: string;
  loadData: LoadConsistencyStripDataFn;
}

function StudentConsistencyStripCard({
  studentId,
  studentLabel,
  loadData,
}: StudentConsistencyStripCardProps): ReactNode {
  const loadState = useLoadState(() => loadData(studentId), [loadData, studentId]);

  if (loadState.status === 'loading') {
    return (
      <Spinner
        label={
          studentLabel !== undefined
            ? `Loading ${studentLabel}'s meeting consistency…`
            : 'Loading your meeting consistency…'
        }
      />
    );
  }

  if (loadState.status === 'error') {
    return (
      <Banner
        status="error"
        title="Couldn't load meeting consistency"
        description="Something went wrong loading this consistency strip. Try refreshing the page."
      />
    );
  }

  return (
    <ConsistencyStrip
      entries={loadState.data.entries}
      participation={loadState.data.participation}
      studentLabel={studentLabel}
    />
  );
}

// ---------------------------------------------------------------------------
// `variant="linked"` -- one `Section` + `StudentConsistencyStripCard` per
// linked student (module doc #6). Genuinely plural, never assumes one child.
// ---------------------------------------------------------------------------

interface ParentConsistencyStripsProps {
  loadLinkedStudents: LoadLinkedStudentsFn;
  loadStripData: LoadConsistencyStripDataFn;
}

function ParentConsistencyStrips({
  loadLinkedStudents,
  loadStripData,
}: ParentConsistencyStripsProps): ReactNode {
  const loadState = useLoadState(loadLinkedStudents, [loadLinkedStudents]);

  if (loadState.status === 'loading') {
    return <Spinner label="Loading linked students…" />;
  }

  if (loadState.status === 'error') {
    return (
      <Banner
        status="error"
        title="Couldn't load linked students"
        description="Something went wrong loading your linked students. Try refreshing the page."
      />
    );
  }

  const linkedStudents = loadState.data;

  if (linkedStudents.length === 0) {
    return (
      <EmptyState
        title="No linked students yet"
        description="Once a student is linked to your account, their meeting consistency will show up here."
      />
    );
  }

  return (
    <VStack gap={4}>
      {linkedStudents.map((student) => (
        <Section key={student.studentId} padding={4}>
          <StudentConsistencyStripCard
            studentId={student.studentId}
            studentLabel={student.displayName}
            loadData={loadStripData}
          />
        </Section>
      ))}
    </VStack>
  );
}

// ---------------------------------------------------------------------------
// Top-level component -- module doc #0/#6.
// ---------------------------------------------------------------------------

export interface StudentMeetingViewProps {
  /**
   * `'own'` (default): a single student's own strip -- the shape a future
   * wiring task drops into `MeetingsList.tsx`'s placeholder slot for the
   * current viewer. `'linked'`: one strip per linked student -- the shape
   * `ParentHome.tsx` (T055)'s per-student card would use. This component
   * does not infer which to use from `useAuth()` (module doc #6) -- the
   * caller decides.
   */
  variant?: 'own' | 'linked';
  /** Used only when `variant === 'own'`. Defaults to a disclosed placeholder
   * (module doc #6, same class of gap `MeetingsList.tsx` already carries). */
  studentId?: string;
  /** Per-student strip data seam. Defaults to fixture data (module doc #5). */
  loadStripData?: LoadConsistencyStripDataFn;
  /** Used only when `variant === 'linked'`. Defaults to fixture data
   * representing three linked students (module doc #5/#6). */
  loadLinkedStudents?: LoadLinkedStudentsFn;
}

export function StudentMeetingView({
  variant = 'own',
  studentId = PLACEHOLDER_CONSISTENCY_STUDENT_ID,
  loadStripData = defaultLoadConsistencyStripData,
  loadLinkedStudents = defaultLoadLinkedStudents,
}: StudentMeetingViewProps = {}): ReactNode {
  if (variant === 'linked') {
    return (
      <ParentConsistencyStrips
        loadLinkedStudents={loadLinkedStudents}
        loadStripData={loadStripData}
      />
    );
  }

  return (
    <Section padding={4}>
      <StudentConsistencyStripCard studentId={studentId} loadData={loadStripData} />
    </Section>
  );
}

export default StudentMeetingView;
