/**
 * @file studentModel.ts
 * @position GAM-444: pure student/parent-view builder functions and their
 *   fixture data, moved from `src/pages/meetings/MeetingsList.tsx` (GAM-444
 *   packet §4/§9 item 5). Code MOVE, not a rewrite -- every declaration
 *   below is byte-identical to its `MeetingsList.tsx` original except for
 *   import paths.
 *
 *   The shared fixture types/constants/helpers this file needs
 *   (`FixtureEvent`, `FixtureEventSession`, `FixtureAttendanceRecord`,
 *   `meetingEventIdsOf`, `FIXTURE_EVENTS`, `FIXTURE_SESSIONS`,
 *   `FIXTURE_ATTENDANCE`, `PLACEHOLDER_CURRENT_STUDENT_ID`,
 *   `PLACEHOLDER_SEASON_ID`) live in `./coachModel` -- not duplicated here.
 *   `MeetingsList.tsx`'s own former module doc section `#6` (student/parent
 *   `studentId` resolution) partially travels here (the fixture-identifier
 *   half); the resolution-wrapper half (`ResolvedStudentMeetingsView`,
 *   `StudentMeetingsViewContainer`) travels to
 *   `src/pages/meetings/student/StudentMeetingsView.tsx` in GAM-444 Stage B,
 *   since that is where the code it documents lives. See
 *   `src/pages/meetings/MeetingsList.tsx`'s own header for the full section
 *   map (GAM-444 packet §6b).
 *
 * @output `buildStudentMeetingsData`, `partitionByStatus`,
 *   `defaultLoadStudentMeetingsData`.
 */
import type { PartitionedRows, SessionStatus, StudentMeetingsData, StudentParticipationMetric } from './types';
import {
  FIXTURE_ATTENDANCE,
  FIXTURE_EVENTS,
  FIXTURE_SESSIONS,
  PLACEHOLDER_CURRENT_STUDENT_ID,
  PLACEHOLDER_SEASON_ID,
  meetingEventIdsOf,
  type FixtureAttendanceRecord,
  type FixtureEvent,
  type FixtureEventSession,
} from './coachModel';

// ---------------------------------------------------------------------------
// Fixture data (constitution item 6: fabricated names only).
// ---------------------------------------------------------------------------

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

/** `scheduled` -> Upcoming; `completed`/`canceled` -> Past. Sorted by start time.
 * UNCHANGED (module doc #10c) -- still used by `StudentMeetingsView`'s own
 * per-session rows. */
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
// Fixture loader -- obviously-fake default for the injectable `loadData`
// seam (Known Context/Traps #1). Real callers pass their own
// (`../../lib/supabase/loaders/meetings.ts`).
// ---------------------------------------------------------------------------

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
