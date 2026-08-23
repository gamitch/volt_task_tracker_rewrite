/**
 * @file coachModel.ts
 * @position GAM-444: pure coach-view builder functions and their fixture
 *   data, moved from `src/pages/meetings/MeetingsList.tsx` (GAM-444 packet
 *   §4/§9 item 5). This is a code MOVE, not a rewrite -- every declaration
 *   below is byte-identical to its `MeetingsList.tsx` original except for
 *   import paths and the `export` keyword on names `studentModel.ts` also
 *   needs (`FixtureEvent`, `FixtureEventSession`, `FixtureAttendanceRecord`,
 *   `meetingEventIdsOf`, `PLACEHOLDER_CURRENT_STUDENT_ID`,
 *   `PLACEHOLDER_SEASON_ID`, `FIXTURE_EVENTS`, `FIXTURE_SESSIONS`,
 *   `FIXTURE_ATTENDANCE` -- none of these were exported from
 *   `MeetingsList.tsx` before this move; they were reachable only because
 *   `buildStudentMeetingsData` lived in the same file).
 *
 *   GAM-444 Stage C update: `MeetingsList.tsx`'s own former module doc
 *   sections `#1` (ground truth `events`/`event_sessions`/`attendance`
 *   column shapes), `#2` (NAV-07 -- this route shows meeting-type sessions
 *   only, `meetingEventIdsOf` below is the ONLY type predicate) and `#3`
 *   (participation shape -- `PastAttendanceSummary` is a plain per-session
 *   tally, never a percentage) describe the fixture/builder code in this
 *   file, but their full verbatim text lives in
 *   `../../pages/meetings/coach/CoachMeetingsView.tsx`'s own doc, alongside
 *   the rest of `MeetingsList.tsx`'s former module doc (packet §6b) -- not
 *   duplicated a third time here on top of this file's own `@position`
 *   summary above.
 *
 * @output `buildCoachMeetingRows`, `summarizeCoachMeetingRow`,
 *   `partitionCoachMeetingRows`, `buildCoachMeetingTableRows`,
 *   `defaultLoadCoachMeetingsData`, `PLACEHOLDER_CURRENT_STUDENT_ID` (kept --
 *   `MeetingsList.test.tsx` still imports it), plus the shared
 *   fixture types/constants/helpers `studentModel.ts` also needs.
 */
import type {
  AttendanceStatus,
  CoachMeetingRow,
  CoachMeetingRowSummary,
  CoachMeetingSessionDetail,
  CoachMeetingTableRow,
  CoachMeetingsData,
  EventType,
  PartitionedRows,
  PastAttendanceSummary,
  SeriesCardModel,
  SessionStatus,
  Team,
} from './types';
import {
  buildDateRangeLabel,
  buildRecurrenceChips,
  buildScheduleChips,
  CHICAGO_TIME_ZONE,
  formatWeekdayDate,
  parseDateOnly,
  sessionDurationHours,
  type Dow,
  type ScheduleRule,
} from './format';

// ---------------------------------------------------------------------------
// Fixture data types (constitution item 6: fabricated names only). Former
// module doc #1/#2 travel here (see this file's own header).
// ---------------------------------------------------------------------------

export interface FixtureEvent {
  id: string;
  seasonId: string;
  type: EventType;
  title: string;
  teamIds: readonly string[] | null;
  countsParticipation: boolean;
  /** T122 (module doc #10e) -- real, already-existing `events` columns
   * (`not null`, UXP-08's own resolution note). */
  locationName: string;
  address: string;
  /** T510 -- optional (the 3 existing `FIXTURE_EVENTS` literals need no edit) --
   * real, already-existing `events.description` column, threaded through so
   * `ScheduleMeetingsDialog`'s edit mode can prefill it. */
  description?: string;
}

export interface FixtureEventSession {
  id: string;
  eventId: string;
  sessionDate: string;
  startsAt: string;
  endsAt: string;
  status: SessionStatus;
  /** T605 -- optional (every existing `FIXTURE_SESSIONS`/hand-built literal in
   * this file and its test needs no edit), same "additive, optional at every
   * app-level layer" precedent `teamIds?`/`description?` (below) already
   * established. Real, already-existing `event_sessions.notes` column
   * (`not null` at the DB layer -- see `loaders/meetings.ts`'s own
   * `EventSessionDbRow.notes: string`, required there since a real row always
   * has one); optional here only because fixture literals may omit it. */
  notes?: string;
}

export interface FixtureAttendanceRecord {
  sessionId: string;
  studentId: string;
  status: AttendanceStatus;
}

/** T122 (module doc #10a) -- verbatim camelCase rename of `rsvps`'s real
 * columns (`session_id`, `student_id`, `status`), cited directly from
 * `supabase/migrations/20260717000000_scheduling_attendance.sql`'s own
 * `rsvps` table / check constraint. */
interface FixtureRsvpRecord {
  sessionId: string;
  studentId: string;
  status: 'going' | 'maybe' | 'declined';
}

/** T122 (module doc #10a) -- the two `students` columns this file's own
 * attendee-name rendering needs. */
interface FixtureStudent {
  id: string;
  displayName: string;
}

// ---------------------------------------------------------------------------
// Placeholder identifiers -- former module doc #6. `PLACEHOLDER_CURRENT_STUDENT_ID`
// is KEPT (not this component's own runtime default for an unresolved
// `studentId` -- see `studentModel.ts`'s `defaultLoadStudentMeetingsData`) but
// `MeetingsList.test.tsx` still imports it, so it stays a named export,
// re-exported by `MeetingsList.tsx` unchanged.
// ---------------------------------------------------------------------------

export const PLACEHOLDER_CURRENT_STUDENT_ID = 'student-placeholder-current-viewer';
export const PLACEHOLDER_SEASON_ID = 'season-placeholder-current';

// ---------------------------------------------------------------------------
// Fixture data (constitution item 6: fabricated names only).
// ---------------------------------------------------------------------------

const FIXTURE_TEAMS: readonly Team[] = [
  { id: 'team-ravens', name: 'Ravens', archived: false },
  { id: 'team-titans', name: 'Titans', archived: false },
];

export const FIXTURE_EVENTS: readonly FixtureEvent[] = [
  {
    id: 'event-weekly-build',
    seasonId: PLACEHOLDER_SEASON_ID,
    type: 'meeting',
    title: 'Weekly Build Meeting',
    teamIds: null, // null = all teams (module doc #1)
    countsParticipation: true,
    // T122 (module doc #10e) -- real column, fabricated value.
    locationName: 'Robotics Lab',
    address: '123 Main St, Springfield, IL',
  },
  {
    id: 'event-ravens-strategy',
    seasonId: PLACEHOLDER_SEASON_ID,
    type: 'meeting',
    title: 'Ravens Strategy Session',
    teamIds: ['team-ravens'],
    countsParticipation: true,
    locationName: 'Ravens Team Room',
    address: '456 Oak Ave, Springfield, IL',
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
    locationName: 'Community Center',
    address: '789 Elm St, Springfield, IL',
  },
];

export const FIXTURE_SESSIONS: readonly FixtureEventSession[] = [
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

export const FIXTURE_ATTENDANCE: readonly FixtureAttendanceRecord[] = [
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

/** T122 (module doc #10a) -- fabricated display names (constitution item 6)
 * for `FIXTURE_ATTENDANCE`'s own student ids, so the coach view's expander
 * has real attendee names to show instead of "Unknown student". */
const FIXTURE_STUDENTS: readonly FixtureStudent[] = [
  { id: 'student-placeholder-current-viewer', displayName: 'Alex Rivera' },
  { id: 'student-b', displayName: 'Bailey Chen' },
  { id: 'student-c', displayName: 'Casey Nguyen' },
  { id: 'student-d', displayName: 'Drew Patel' },
  { id: 'student-e', displayName: 'Emerson Diaz' },
  { id: 'student-f', displayName: 'Frankie Lopez' },
  { id: 'student-g', displayName: 'Gray Kim' },
];

/** T122 (module doc #10a) -- `'going'` RSVPs for the two still-scheduled
 * sessions, feeding `CoachMeetingSessionDetail.expectedCt` /
 * `CoachMeetingRowSummary.expectedCt`. */
const FIXTURE_RSVPS: readonly FixtureRsvpRecord[] = [
  { sessionId: 'session-upcoming-build', studentId: 'student-b', status: 'going' },
  { sessionId: 'session-upcoming-build', studentId: 'student-c', status: 'going' },
  { sessionId: 'session-upcoming-build', studentId: 'student-d', status: 'going' },
  { sessionId: 'session-upcoming-build', studentId: 'student-e', status: 'going' },
  { sessionId: 'session-upcoming-build', studentId: 'student-f', status: 'going' },
  { sessionId: 'session-upcoming-ravens', studentId: 'student-b', status: 'going' },
  { sessionId: 'session-upcoming-ravens', studentId: 'student-g', status: 'going' },
];

// ---------------------------------------------------------------------------
// Pure builder functions -- exported for direct testing.
// ---------------------------------------------------------------------------

function teamScopeLabel(teamIds: readonly string[] | null, teams: readonly Team[]): string {
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
export function meetingEventIdsOf(events: readonly FixtureEvent[]): Set<string> {
  return new Set(events.filter((event) => event.type === 'meeting').map((event) => event.id));
}

/** T122 (module doc #10a) -- now groups by EVENT (one row per recurring
 * meeting series), not per session; `rsvps`/`students` are new, OPTIONAL
 * (default `[]`) parameters so every pre-existing call site that doesn't
 * pass them (none in this file after this task, but kept optional for a
 * minimal, additive signature change) still type-checks. An event with zero
 * real sessions produces no row (nothing to show). */
export function buildCoachMeetingRows(
  events: readonly FixtureEvent[],
  sessions: readonly FixtureEventSession[],
  teams: readonly Team[],
  attendance: readonly FixtureAttendanceRecord[],
  rsvps: readonly FixtureRsvpRecord[] = [],
  students: readonly FixtureStudent[] = [],
): CoachMeetingRow[] {
  const meetingEventIds = meetingEventIdsOf(events);
  const meetingEvents = events.filter((event) => meetingEventIds.has(event.id));
  const studentNameById = new Map(students.map((student) => [student.id, student.displayName]));

  const rows: CoachMeetingRow[] = [];
  for (const event of meetingEvents) {
    const eventSessions = sessions
      .filter((session) => session.eventId === event.id)
      .slice()
      .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
    if (eventSessions.length === 0) continue;

    const sessionDetails: CoachMeetingSessionDetail[] = eventSessions.map((session) => {
      const expectedCt = rsvps.filter(
        (rsvp) => rsvp.sessionId === session.id && rsvp.status === 'going',
      ).length;
      const attendanceSummary =
        session.status === 'completed' ? summarizeAttendance(session.id, attendance) : null;
      const attendeeNames =
        session.status === 'completed'
          ? attendance
              .filter(
                (record) =>
                  record.sessionId === session.id &&
                  (record.status === 'present' || record.status === 'late'),
              )
              .map((record) => studentNameById.get(record.studentId) ?? 'Unknown student')
              .sort((a, b) => a.localeCompare(b))
          : [];
      return {
        sessionId: session.id,
        sessionDate: session.sessionDate,
        startsAt: session.startsAt,
        endsAt: session.endsAt,
        status: session.status,
        durationHours: sessionDurationHours(session.startsAt, session.endsAt),
        expectedCt,
        attendanceSummary,
        attendeeNames,
        // T605 -- real `event_sessions.notes` column, threaded through for the
        // first time (§3.2/§6.1). `?? ''` matches this same file's own
        // "never leave a real not-null column undefined on a built row"
        // posture, and the real DB column is `not null` with no default
        // regardless.
        notes: session.notes ?? '',
      };
    });

    rows.push({
      eventId: event.id,
      title: event.title,
      locationName: event.locationName,
      teamScopeLabel: teamScopeLabel(event.teamIds, teams),
      sessions: sessionDetails,
      // T510 -- threaded through for `ScheduleMeetingsDialog`'s edit mode.
      teamIds: event.teamIds ?? null,
      description: event.description ?? '',
    });
  }
  return rows;
}

export function summarizeCoachMeetingRow(
  sessions: readonly CoachMeetingSessionDetail[],
): CoachMeetingRowSummary {
  const nonCanceled = sessions.filter((session) => session.status !== 'canceled');
  const completed = sessions.filter((session) => session.status === 'completed');
  const scheduled = sessions.filter((session) => session.status === 'scheduled');
  const canceled = sessions.filter((session) => session.status === 'canceled');

  const plannedHours = nonCanceled.reduce((sum, session) => sum + session.durationHours, 0);
  const loggedHours = completed.reduce((sum, session) => sum + session.durationHours, 0);
  const expectedCt = sessions.reduce((sum, session) => sum + session.expectedCt, 0);
  const attendedCt = completed.reduce(
    (sum, session) =>
      sum +
      (session.attendanceSummary
        ? session.attendanceSummary.presentCt + session.attendanceSummary.lateCt
        : 0),
    0,
  );

  const hasUpcomingSession = scheduled.length > 0;
  const sortedAscending = sessions.slice().sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  const sortStartsAt = hasUpcomingSession
    ? (scheduled.slice().sort((a, b) => a.startsAt.localeCompare(b.startsAt))[0]?.startsAt ?? '')
    : (sortedAscending[sortedAscending.length - 1]?.startsAt ?? '');

  return {
    recurrenceChips: buildRecurrenceChips(sessions),
    dateRangeLabel: buildDateRangeLabel(sessions),
    plannedHours,
    loggedHours,
    expectedCt,
    attendedCt,
    hasUpcomingSession,
    sortStartsAt,
    canceledCt: canceled.length,
  };
}

/** T122 (module doc #10c) -- Upcoming/Past bucketing for grouped event rows
 * (a per-session `partitionByStatus` no longer applies -- see that
 * function's own updated doc). */
export function partitionCoachMeetingRows(
  rows: readonly CoachMeetingRow[],
): PartitionedRows<CoachMeetingRow> {
  const withSummary = rows.map((row) => ({ row, summary: summarizeCoachMeetingRow(row.sessions) }));
  const upcoming = withSummary
    .filter(({ summary }) => summary.hasUpcomingSession)
    .sort((a, b) => a.summary.sortStartsAt.localeCompare(b.summary.sortStartsAt))
    .map(({ row }) => row);
  const past = withSummary
    .filter(({ summary }) => !summary.hasUpcomingSession)
    .sort((a, b) => b.summary.sortStartsAt.localeCompare(a.summary.sortStartsAt))
    .map(({ row }) => row);
  return { upcoming, past };
}

/** Splices each expanded event's session-detail rows directly beneath it in
 * one flat array -- T130's `buildCoachOutreachTableRows` mechanism, copied
 * (not re-derived). Exported for direct testing. */
export function buildCoachMeetingTableRows(
  rows: readonly CoachMeetingRow[],
  expandedEventIds: ReadonlySet<string>,
): CoachMeetingTableRow[] {
  const tableRows: CoachMeetingTableRow[] = [];
  for (const row of rows) {
    const summary = summarizeCoachMeetingRow(row.sessions);
    tableRows.push({ kind: 'event', id: row.eventId, row, summary });
    if (expandedEventIds.has(row.eventId)) {
      for (const session of row.sessions) {
        tableRows.push({
          kind: 'sessionDetail',
          id: `${row.eventId}::session::${session.sessionId}`,
          eventId: row.eventId,
          eventTitle: row.title,
          session,
        });
      }
    }
  }
  return tableRows;
}

// ---------------------------------------------------------------------------
// GAM-452 §1 -- `buildSeriesCardModels`, the one piece of genuinely new
// logic this ticket adds. MTG-01a's coach series `Card` (`types.ts:295-340`,
// `SeriesCardModel`, frozen by GAM-444) needs a `scheduleChips: string[]`
// built from `buildScheduleChips(rules)` (`./format`), but no stored
// recurrence column exists anywhere in this schema
// (`20260717000000_scheduling_attendance.sql:33-48` has none, and
// `ScheduleMeetingsDialog` only ever materialises real dates and discards
// the rule that produced them) -- so every `ScheduleRule` below is DERIVED
// from a `CoachMeetingRow`'s own `sessions`, never read off a column.
// ---------------------------------------------------------------------------

/** GAM-452 §1 -- this is a disclosed FOURTH reimplementation of the Chicago
 * wall-clock-from-instant conversion `ScheduleMeetingsDialog.tsx`'s own
 * unexported `formatChicagoWallTime` (`ScheduleMeetingsDialog.tsx:793-805`)
 * already performs -- that function cites `OutreachList.tsx`'s own copy as
 * its third, and it is deliberately NOT exported (only that file's own
 * `resetForm()` calls it), so importing it here would cross a page-module
 * boundary into a pure `src/lib/**` model file. `hourCycle: 'h23'` avoids an
 * AM/PM split; every `Intl.DateTimeFormat` in this module stays pinned to
 * `CHICAGO_TIME_ZONE` (NFR-09). */
const CHICAGO_MINUTES_FORMATTER = new Intl.DateTimeFormat('en-US', {
  hour: 'numeric',
  minute: 'numeric',
  hourCycle: 'h23',
  timeZone: CHICAGO_TIME_ZONE,
});

function chicagoMinutesFromMidnight(isoDateTime: string): number {
  const parts = CHICAGO_MINUTES_FORMATTER.formatToParts(new Date(isoDateTime));
  const hour = Number(parts.find((part) => part.type === 'hour')?.value ?? '0');
  const minute = Number(parts.find((part) => part.type === 'minute')?.value ?? '0');
  return hour * 60 + minute;
}

/** One `ScheduleRule` per session. `dow` is bucketed from the STORED
 * `sessionDate` (`parseDateOnly(...).getUTCDay()`), never re-derived from the
 * UTC `startsAt` instant -- the live trap already in this file's own fixture
 * (`FIXTURE_SESSIONS[0]`, above: `2026-07-22T23:00:00.000Z` is 6 PM CDT on
 * `sessionDate '2026-07-22'`, but an evening session routinely crosses into
 * the next UTC calendar date, which would silently shift the bucketed
 * weekday if this read the instant instead). `startMinutes`/`endMinutes` come
 * from the real `startsAt`/`endsAt` instants, converted to Chicago wall-clock
 * minutes. A session whose Chicago end time is exactly midnight is
 * `endMinutes: 1440`, never `0` (`format.ts:245-247`,`:308-309`). A session
 * that genuinely SPANS midnight (its converted end minutes fall at or before
 * its start minutes, and the end is not exactly 00:00) is DROPPED here,
 * never clamped or fabricated: `ScheduleRule` cannot represent it
 * (`format.ts:217-220`), and handing it to `buildScheduleChips` would throw a
 * `RangeError` that `RouteErrorBoundary` turns into a whole-page error for a
 * single bad row. */
function deriveScheduleRule(session: {
  sessionDate: string;
  startsAt: string;
  endsAt: string;
}): ScheduleRule | null {
  const dow = parseDateOnly(session.sessionDate).getUTCDay() as Dow;
  const startMinutes = chicagoMinutesFromMidnight(session.startsAt);
  const rawEndMinutes = chicagoMinutesFromMidnight(session.endsAt);
  const endMinutes = rawEndMinutes === 0 ? 1440 : rawEndMinutes;
  if (endMinutes <= startMinutes) {
    return null;
  }
  return { dow, startMinutes, endMinutes };
}

/** Dedupe to one rule per distinct `(dow, startMinutes, endMinutes)`,
 * first-seen order (§1). Canceled sessions are excluded before dedup, so a
 * canceled occurrence of an otherwise-real slot never manufactures a chip. */
function deriveDedupedScheduleRules(
  sessions: readonly CoachMeetingSessionDetail[],
): ScheduleRule[] {
  const seen = new Set<string>();
  const rules: ScheduleRule[] = [];
  for (const session of sessions) {
    if (session.status === 'canceled') continue;
    const rule = deriveScheduleRule(session);
    if (rule === null) continue; // Midnight-spanning -- dropped, not thrown.
    const key = `${rule.dow}:${rule.startMinutes}:${rule.endMinutes}`;
    if (seen.has(key)) continue;
    seen.add(key);
    rules.push(rule);
  }
  return rules;
}

/** MTG-01a's "next-session line" (`PRD:306-308`'s own literal example,
 * `"Next: Tue, Aug 26 · 6–8 PM"`, criterion 12). Reuses `buildScheduleChips`
 * for the time-range half (dropped `:00` minutes, collapsed duplicate
 * meridiem, en dash) instead of a second time formatter -- a chip built from
 * one rule is `"{weekday} {timeRange}"`; this line needs the full calendar
 * date instead of the bare weekday abbreviation, so only the leading weekday
 * word is stripped back off. `null` when nothing is still `scheduled` (the
 * finished state; `SeriesCard.tsx`'s own `FINISHED_SESSIONS_COPY` supplies
 * that copy, not this builder). */
function buildNextSessionLabel(
  nextScheduled: CoachMeetingSessionDetail | undefined,
): string | null {
  if (nextScheduled === undefined) return null;
  const rule = deriveScheduleRule(nextScheduled);
  if (rule === null) {
    // Midnight-spanning next session -- still dropped from time-range
    // derivation (§1); fall back to the date alone rather than fabricate a
    // range `buildScheduleChips` cannot honestly produce.
    return `Next: ${formatWeekdayDate(nextScheduled.sessionDate)}`;
  }
  const [chip] = buildScheduleChips([rule]);
  const timeRange = chip.slice(chip.indexOf(' ') + 1);
  return `Next: ${formatWeekdayDate(nextScheduled.sessionDate)} · ${timeRange}`;
}

/**
 * GAM-452 §1/§3b -- builds MTG-01a's `SeriesCardModel[]` from real
 * `CoachMeetingRow[]`. `paletteIndexFor` is INJECTED, never imported
 * directly from `MeetingsRail.tsx`'s own `paletteIndexForEventId` -- that
 * file does `import './MeetingsRail.css'` and pulls in `@astryxdesign/core`,
 * which would drag a page component into this pure model's own unit test.
 * The composing page (`CoachMeetingsView.tsx`) passes the real
 * `paletteIndexForEventId` at the call site; this builder never writes a
 * second hash of its own (GAM-476).
 */
export function buildSeriesCardModels(
  rows: readonly CoachMeetingRow[],
  paletteIndexFor: (eventId: string) => number,
): SeriesCardModel[] {
  return rows.map((row) => {
    const rules = deriveDedupedScheduleRules(row.sessions);
    const nonCanceled = row.sessions.filter((session) => session.status !== 'canceled');
    const completed = row.sessions.filter((session) => session.status === 'completed');
    const nextScheduled = row.sessions
      .filter((session) => session.status === 'scheduled')
      .slice()
      .sort((a, b) => a.startsAt.localeCompare(b.startsAt))[0];

    return {
      eventId: row.eventId,
      title: row.title,
      teamScopeLabel: row.teamScopeLabel,
      scheduleChips: buildScheduleChips(rules),
      sessionsCompleted: completed.length,
      sessionsTotal: nonCanceled.length,
      /**
       * §9a (WITHDRAWN §0d interim) -- a true passthrough, never `?? 0`,
       * never arithmetic (constitution item 3, BLOCKER). `row.attendancePct`
       * is GAM-446's own `v_event_attendance.attendance_pct` merge
       * (`types.ts:123-134`); `null`/`undefined` both collapse to `null`
       * here, rendered as "—" by `SeriesCard.tsx:362-368`, never a
       * fabricated zero.
       *
       * D014's mitigation now rides beside it: GAM-460 (PR #244) made
       * `gradedMarksCt` a required `SeriesCardModel` field and
       * `SeriesCard.tsx` renders it unconditionally next to the percentage,
       * which is what `types.ts:139-149`'s capitalized warning calls
       * "MANDATORY whenever attendance_pct is rendered". Do not "fix" this
       * back to `null` -- round 2 of this packet's own premise gate proved
       * that withholding a real number here is the worse half of the honesty
       * trade (PRD MTG-01a: "The attendance % is DATA-01 passthrough ...
       * never computed in TypeScript").
       */
      attendancePct: row.attendancePct ?? null,
      /**
       * D014 / GAM-460 -- a COUNT, not a metric, so `?? 0` here is the true
       * value rather than a fabricated one: the GAM-446 merge leaves this
       * `undefined` only when the event has no `v_event_attendance` row at
       * all, i.e. no marks exist ("0 marks graded" is what the view's own
       * `count(...)` would say). `attendancePct` stays `null` on that same
       * row, so the card shows "—" beside the zero count -- never a real
       * percentage without its mark count.
       */
      gradedMarksCt: row.gradedMarksCt ?? 0,
      nextSessionLabel: buildNextSessionLabel(nextScheduled),
      paletteIndex: paletteIndexFor(row.eventId),
    };
  });
}

// ---------------------------------------------------------------------------
// Fixture loader -- obviously-fake default for the injectable `loadData`
// seam (Known Context/Traps #1). Real callers pass their own
// (`../../lib/supabase/loaders/meetings.ts`).
// ---------------------------------------------------------------------------

export async function defaultLoadCoachMeetingsData(): Promise<CoachMeetingsData> {
  return {
    rows: buildCoachMeetingRows(
      FIXTURE_EVENTS,
      FIXTURE_SESSIONS,
      FIXTURE_TEAMS,
      FIXTURE_ATTENDANCE,
      FIXTURE_RSVPS,
      FIXTURE_STUDENTS,
    ),
    // T147 -- same fixture `buildCoachMeetingRows` above already consumes.
    teams: FIXTURE_TEAMS,
  };
}
