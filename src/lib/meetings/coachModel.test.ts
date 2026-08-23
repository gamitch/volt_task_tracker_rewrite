/**
 * Tests for `coachModel.ts`'s pure builder functions -- moved verbatim from
 * `src/pages/meetings/MeetingsList.test.tsx` (GAM-444 Stage A), same
 * assertions, same test names, only the import path and file location
 * changed (GAM-444 packet criterion 2: "no assertion text changes -- import
 * paths only").
 */
import { describe, expect, it } from 'vitest';
import {
  buildCoachMeetingRows,
  buildSeriesCardModels,
  defaultLoadCoachMeetingsData,
  partitionCoachMeetingRows,
  summarizeCoachMeetingRow,
} from './coachModel';
import type { CoachMeetingRow } from './types';

// T122 (module doc #10a): a single reusable multi-session fixture event used
// by several tests below -- three sessions on the SAME weekday (one
// scheduled, one completed, one canceled), so `buildRecurrenceChips` has a
// genuine 3-count chip to prove and `summarizeCoachMeetingRow` has all three
// statuses to aggregate across in one event.
const MULTI_SESSION_EVENT = {
  id: 'e1',
  seasonId: 's1',
  type: 'meeting' as const,
  title: 'M',
  teamIds: null,
  countsParticipation: true,
  locationName: 'Robotics Lab',
  address: '123 Main St',
};
const MULTI_SESSION_SESSIONS = [
  {
    id: 'sess-scheduled',
    eventId: 'e1',
    sessionDate: '2026-07-22', // Wed
    startsAt: '2026-07-22T23:00:00.000Z',
    endsAt: '2026-07-23T01:00:00.000Z', // 2h
    status: 'scheduled' as const,
  },
  {
    id: 'sess-completed',
    eventId: 'e1',
    sessionDate: '2026-07-15', // Wed
    startsAt: '2026-07-15T23:00:00.000Z',
    endsAt: '2026-07-16T01:00:00.000Z', // 2h
    status: 'completed' as const,
  },
  {
    id: 'sess-canceled',
    eventId: 'e1',
    sessionDate: '2026-07-08', // Wed
    startsAt: '2026-07-08T23:00:00.000Z',
    endsAt: '2026-07-09T01:00:00.000Z', // 2h
    status: 'canceled' as const,
  },
];

describe('buildCoachMeetingRows (NAV-07, T122 module doc #10a)', () => {
  it('excludes outreach-typed events entirely', async () => {
    const { rows } = await defaultLoadCoachMeetingsData();
    expect(rows.some((r) => r.title === 'Community Food Drive')).toBe(false);
    expect(rows.length).toBeGreaterThan(0);
  });

  it('groups sessions into ONE row per event (not one row per session)', () => {
    const rows = buildCoachMeetingRows([MULTI_SESSION_EVENT], MULTI_SESSION_SESSIONS, [], []);
    expect(rows).toHaveLength(1);
    expect(rows[0].eventId).toBe('e1');
    expect(rows[0].locationName).toBe('Robotics Lab');
    expect(rows[0].sessions.map((s) => s.sessionId)).toEqual([
      'sess-canceled',
      'sess-completed',
      'sess-scheduled',
    ]); // sorted ascending by startsAt
  });

  it('an event with zero sessions produces no row', () => {
    const rows = buildCoachMeetingRows([{ ...MULTI_SESSION_EVENT, id: 'e-empty' }], [], [], []);
    expect(rows).toHaveLength(0);
  });

  it('computes a per-session attendance summary only for completed sessions', () => {
    const rows = buildCoachMeetingRows(
      [MULTI_SESSION_EVENT],
      MULTI_SESSION_SESSIONS,
      [],
      [
        { sessionId: 'sess-completed', studentId: 'stu-1', status: 'present' },
        { sessionId: 'sess-completed', studentId: 'stu-2', status: 'late' },
      ],
    );
    const sessions = rows[0].sessions;
    const scheduled = sessions.find((s) => s.sessionId === 'sess-scheduled');
    const completed = sessions.find((s) => s.sessionId === 'sess-completed');
    expect(scheduled?.attendanceSummary).toBeNull();
    expect(completed?.attendanceSummary).toEqual({
      presentCt: 1,
      lateCt: 1,
      excusedCt: 0,
      absentCt: 0,
    });
  });

  it('computes real per-session expected counts from going RSVPs, and attendee names for completed sessions', () => {
    const rows = buildCoachMeetingRows(
      [MULTI_SESSION_EVENT],
      MULTI_SESSION_SESSIONS,
      [],
      [
        { sessionId: 'sess-completed', studentId: 'stu-1', status: 'present' },
        { sessionId: 'sess-completed', studentId: 'stu-2', status: 'late' },
        { sessionId: 'sess-completed', studentId: 'stu-3', status: 'absent' },
        // Present, but no matching row in `students` below -- proves the
        // honest "Unknown student" fallback, never a silent drop.
        { sessionId: 'sess-completed', studentId: 'stu-unmatched', status: 'present' },
      ],
      [
        { sessionId: 'sess-scheduled', studentId: 'stu-1', status: 'going' },
        { sessionId: 'sess-scheduled', studentId: 'stu-2', status: 'going' },
        { sessionId: 'sess-scheduled', studentId: 'stu-3', status: 'declined' },
      ],
      [
        { id: 'stu-1', displayName: 'Zoe Ann' },
        { id: 'stu-2', displayName: 'Amir Lee' },
      ],
    );
    const sessions = rows[0].sessions;
    const scheduled = sessions.find((s) => s.sessionId === 'sess-scheduled');
    const completed = sessions.find((s) => s.sessionId === 'sess-completed');
    // Only 'going' counted, not 'declined'.
    expect(scheduled?.expectedCt).toBe(2);
    // Attendee names sorted alphabetically; 'absent' is excluded entirely;
    // the unmatched present student falls back to an honest placeholder,
    // never a silent drop.
    expect(completed?.attendeeNames).toEqual(['Amir Lee', 'Unknown student', 'Zoe Ann']);
    // Scheduled sessions have no attendance yet -- no names.
    expect(scheduled?.attendeeNames).toEqual([]);
  });

  // T605 §6.1/§7 test 1 -- real `event_sessions.notes` threading, the first
  // time this file's own pure builder ever surfaces that column. Own minimal
  // fixture (not `MULTI_SESSION_SESSIONS`, which carries no `notes` field and
  // is shared by other tests in this describe block) so this addition is
  // purely additive.
  it('T605: threads a fixture session’s real `notes` value into the built `CoachMeetingSessionDetail`', () => {
    const event = {
      id: 'event-notes',
      seasonId: 's1',
      type: 'meeting' as const,
      title: 'Notes Fixture Meeting',
      teamIds: null,
      countsParticipation: true,
      locationName: 'Robotics Lab',
      address: '123 Main St',
    };
    const sessions = [
      {
        id: 'sess-with-notes',
        eventId: 'event-notes',
        sessionDate: '2026-07-22',
        startsAt: '2026-07-22T23:00:00.000Z',
        endsAt: '2026-07-23T01:00:00.000Z',
        status: 'scheduled' as const,
        notes: 'Bring extra batteries.',
      },
      {
        id: 'sess-without-notes',
        eventId: 'event-notes',
        sessionDate: '2026-07-15',
        startsAt: '2026-07-15T23:00:00.000Z',
        endsAt: '2026-07-16T01:00:00.000Z',
        status: 'scheduled' as const,
        // `notes` omitted entirely -- proves the `?? ''` fallback for a
        // fixture literal that never supplied one (every pre-existing
        // literal in this file's own suite, `FIXTURE_SESSIONS` included).
      },
    ];
    const rows = buildCoachMeetingRows([event], sessions, [], []);
    const withNotes = rows[0].sessions.find((s) => s.sessionId === 'sess-with-notes');
    const withoutNotes = rows[0].sessions.find((s) => s.sessionId === 'sess-without-notes');
    expect(withNotes?.notes).toBe('Bring extra batteries.');
    expect(withoutNotes?.notes).toBe('');
  });
});

describe('summarizeCoachMeetingRow (T122 module doc #10b)', () => {
  it('sums planned hours across non-canceled sessions and logged hours across completed sessions only', () => {
    const rows = buildCoachMeetingRows([MULTI_SESSION_EVENT], MULTI_SESSION_SESSIONS, [], []);
    const summary = summarizeCoachMeetingRow(rows[0].sessions);
    // planned = scheduled (2h) + completed (2h) = 4h; canceled excluded.
    expect(summary.plannedHours).toBe(4);
    // logged = completed only = 2h.
    expect(summary.loggedHours).toBe(2);
    expect(summary.canceledCt).toBe(1);
  });

  it('builds recurrence chips grouped by weekday, and a date range label', () => {
    const rows = buildCoachMeetingRows([MULTI_SESSION_EVENT], MULTI_SESSION_SESSIONS, [], []);
    const summary = summarizeCoachMeetingRow(rows[0].sessions);
    // All three sessions fall on a Wednesday -- UXD-02's own worked example
    // shape ("MON (18) · THU (18)"), here a single "WED (3)" chip.
    expect(summary.recurrenceChips).toEqual(['WED (3)']);
    expect(summary.dateRangeLabel).toBe('Wed, Jul 8 – Wed, Jul 22');
  });

  it('produces no recurrence chips for a single-session event (the date range line covers it alone)', () => {
    const rows = buildCoachMeetingRows([MULTI_SESSION_EVENT], [MULTI_SESSION_SESSIONS[0]], [], []);
    const summary = summarizeCoachMeetingRow(rows[0].sessions);
    expect(summary.recurrenceChips).toEqual([]);
    expect(summary.dateRangeLabel).toBe('Wed, Jul 22');
  });

  it('sums expected/attended counts across every session (cumulative, not unique headcount)', () => {
    const rows = buildCoachMeetingRows(
      [MULTI_SESSION_EVENT],
      MULTI_SESSION_SESSIONS,
      [],
      [
        { sessionId: 'sess-completed', studentId: 'stu-1', status: 'present' },
        { sessionId: 'sess-completed', studentId: 'stu-2', status: 'late' },
      ],
      [
        { sessionId: 'sess-scheduled', studentId: 'stu-1', status: 'going' },
        { sessionId: 'sess-scheduled', studentId: 'stu-2', status: 'going' },
        { sessionId: 'sess-scheduled', studentId: 'stu-3', status: 'going' },
      ],
      [],
    );
    const summary = summarizeCoachMeetingRow(rows[0].sessions);
    expect(summary.expectedCt).toBe(3); // scheduled session's 'going' RSVPs
    expect(summary.attendedCt).toBe(2); // completed session's present+late
  });

  it('hasUpcomingSession is true when ANY session is still scheduled, sortStartsAt picks the nearest upcoming one', () => {
    const rows = buildCoachMeetingRows([MULTI_SESSION_EVENT], MULTI_SESSION_SESSIONS, [], []);
    const summary = summarizeCoachMeetingRow(rows[0].sessions);
    expect(summary.hasUpcomingSession).toBe(true);
    expect(summary.sortStartsAt).toBe('2026-07-22T23:00:00.000Z');
  });

  it('hasUpcomingSession is false once every session is completed/canceled, sortStartsAt picks the latest one', () => {
    const pastOnly = MULTI_SESSION_SESSIONS.filter((s) => s.status !== 'scheduled');
    const rows = buildCoachMeetingRows([MULTI_SESSION_EVENT], pastOnly, [], []);
    const summary = summarizeCoachMeetingRow(rows[0].sessions);
    expect(summary.hasUpcomingSession).toBe(false);
    expect(summary.sortStartsAt).toBe('2026-07-15T23:00:00.000Z'); // sess-completed, latest of the two
  });
});

describe('partitionCoachMeetingRows (T122 module doc #10c)', () => {
  it('buckets a row into Upcoming when it has ANY scheduled session, even alongside past ones', () => {
    const rows = buildCoachMeetingRows([MULTI_SESSION_EVENT], MULTI_SESSION_SESSIONS, [], []);
    const { upcoming, past } = partitionCoachMeetingRows(rows);
    expect(upcoming.map((r) => r.eventId)).toEqual(['e1']);
    expect(past).toEqual([]);
  });

  it('buckets a row into Past once every one of its sessions is completed/canceled', () => {
    const pastOnly = MULTI_SESSION_SESSIONS.filter((s) => s.status !== 'scheduled');
    const rows = buildCoachMeetingRows([MULTI_SESSION_EVENT], pastOnly, [], []);
    const { upcoming, past } = partitionCoachMeetingRows(rows);
    expect(upcoming).toEqual([]);
    expect(past.map((r) => r.eventId)).toEqual(['e1']);
  });
});

// ---------------------------------------------------------------------------
// GAM-452 §1/§9e -- `buildSeriesCardModels`. Every UTC instant below is
// hand-computed against a real Chicago wall-clock time (verified against
// `Intl.DateTimeFormat` directly, not guessed) -- packet criterion 5 requires
// a hand-built Tue/Sun row since no repo fixture has one (`coachModel.ts`'s
// own `FIXTURE_SESSIONS` is Wed/Sat only).
// ---------------------------------------------------------------------------
describe('buildSeriesCardModels (GAM-452 §1, criteria 5/6/11/12)', () => {
  const BASE_EVENT: CoachMeetingRow = {
    eventId: 'event-a',
    title: 'Robotics Build',
    locationName: 'Robotics Lab',
    teamScopeLabel: 'Ravens',
    sessions: [],
  };

  function session(
    overrides: Partial<CoachMeetingRow['sessions'][number]> &
      Pick<CoachMeetingRow['sessions'][number], 'sessionId' | 'sessionDate' | 'startsAt' | 'endsAt' | 'status'>,
  ): CoachMeetingRow['sessions'][number] {
    return {
      durationHours: 2,
      expectedCt: 0,
      attendanceSummary: null,
      attendeeNames: [],
      ...overrides,
    };
  }

  const identityPalette = (eventId: string): number => eventId.length;

  it('criterion 5: two-weekday series (Tue/Sun) produces chips with en dash and collapsed meridiem, first-seen order', () => {
    const row: CoachMeetingRow = {
      ...BASE_EVENT,
      sessions: [
        // Sun, Aug 23 2026, 3:30-6:30 PM Chicago.
        session({
          sessionId: 's-sun',
          sessionDate: '2026-08-23',
          startsAt: '2026-08-23T20:30:00.000Z',
          endsAt: '2026-08-23T23:30:00.000Z',
          status: 'scheduled',
        }),
        // Tue, Aug 25 2026, 6-8 PM Chicago.
        session({
          sessionId: 's-tue',
          sessionDate: '2026-08-25',
          startsAt: '2026-08-25T23:00:00.000Z',
          endsAt: '2026-08-26T01:00:00.000Z',
          status: 'scheduled',
        }),
      ],
    };
    const [model] = buildSeriesCardModels([row], identityPalette);
    expect(model.scheduleChips).toEqual(['Sun 3:30–6:30 PM', 'Tue 6–8 PM']);
  });

  it('criterion 11: a 10 PM-1 AM (midnight-spanning) session yields no chip and throws nothing', () => {
    const row: CoachMeetingRow = {
      ...BASE_EVENT,
      sessions: [
        // Mon, Aug 24 2026, 10 PM-1 AM Chicago -- unrepresentable by
        // `ScheduleRule` (format.ts:217-220); must be dropped, not thrown.
        session({
          sessionId: 's-spanning',
          sessionDate: '2026-08-24',
          startsAt: '2026-08-25T03:00:00.000Z',
          endsAt: '2026-08-25T06:00:00.000Z',
          status: 'scheduled',
        }),
      ],
    };
    expect(() => buildSeriesCardModels([row], identityPalette)).not.toThrow();
    const [model] = buildSeriesCardModels([row], identityPalette);
    expect(model.scheduleChips).toEqual([]);
    // The "next session" line falls back to the date alone rather than
    // fabricate a time range it cannot honestly produce.
    expect(model.nextSessionLabel).toBe('Next: Mon, Aug 24');
  });

  it('excludes canceled sessions from schedule-chip derivation entirely', () => {
    const row: CoachMeetingRow = {
      ...BASE_EVENT,
      sessions: [
        session({
          sessionId: 's-canceled',
          sessionDate: '2026-08-25',
          startsAt: '2026-08-25T23:00:00.000Z',
          endsAt: '2026-08-26T01:00:00.000Z',
          status: 'canceled',
        }),
      ],
    };
    const [model] = buildSeriesCardModels([row], identityPalette);
    expect(model.scheduleChips).toEqual([]);
  });

  it('dedupes to one chip per distinct (dow, startMinutes, endMinutes), first-seen order', () => {
    const row: CoachMeetingRow = {
      ...BASE_EVENT,
      sessions: [
        session({
          sessionId: 's-tue-1',
          sessionDate: '2026-08-25',
          startsAt: '2026-08-25T23:00:00.000Z',
          endsAt: '2026-08-26T01:00:00.000Z',
          status: 'completed',
        }),
        session({
          sessionId: 's-tue-2',
          sessionDate: '2026-09-01', // Also a Tuesday, same 6-8 PM slot.
          startsAt: '2026-09-01T23:00:00.000Z',
          endsAt: '2026-09-02T01:00:00.000Z',
          status: 'scheduled',
        }),
        session({
          sessionId: 's-sun',
          sessionDate: '2026-08-23',
          startsAt: '2026-08-23T20:30:00.000Z',
          endsAt: '2026-08-23T23:30:00.000Z',
          status: 'scheduled',
        }),
      ],
    };
    const [model] = buildSeriesCardModels([row], identityPalette);
    expect(model.scheduleChips).toEqual(['Tue 6–8 PM', 'Sun 3:30–6:30 PM']);
  });

  it('criterion 6: attendancePct is a true passthrough -- never `?? 0`, real value/undefined/null all handled honestly', () => {
    const withReal: CoachMeetingRow = { ...BASE_EVENT, eventId: 'e-real', attendancePct: 87.5 };
    const withUndefined: CoachMeetingRow = { ...BASE_EVENT, eventId: 'e-undef' };
    const withNull: CoachMeetingRow = { ...BASE_EVENT, eventId: 'e-null', attendancePct: null };
    const [real, undef, nullVal] = buildSeriesCardModels(
      [withReal, withUndefined, withNull],
      identityPalette,
    );
    expect(real.attendancePct).toBe(87.5);
    expect(undef.attendancePct).toBeNull();
    expect(nullVal.attendancePct).toBeNull();
  });

  it('criterion 12: nextSessionLabel/sessionsCompleted/sessionsTotal/teamScopeLabel match MTG-01a\'s literal example shape', () => {
    const row: CoachMeetingRow = {
      ...BASE_EVENT,
      teamScopeLabel: 'Ravens',
      sessions: [
        session({
          sessionId: 's-completed',
          sessionDate: '2026-07-15',
          startsAt: '2026-07-15T23:00:00.000Z',
          endsAt: '2026-07-16T01:00:00.000Z',
          status: 'completed',
        }),
        session({
          sessionId: 's-canceled',
          sessionDate: '2026-07-08',
          startsAt: '2026-07-08T23:00:00.000Z',
          endsAt: '2026-07-09T01:00:00.000Z',
          status: 'canceled',
        }),
        // Tue, Aug 25 2026, 6-8 PM Chicago -- the nearest upcoming session.
        session({
          sessionId: 's-scheduled',
          sessionDate: '2026-08-25',
          startsAt: '2026-08-25T23:00:00.000Z',
          endsAt: '2026-08-26T01:00:00.000Z',
          status: 'scheduled',
        }),
      ],
    };
    const [model] = buildSeriesCardModels([row], identityPalette);
    // PRD:306-308's own literal worked example shape: "Next: Tue, Aug 26 · 6–8 PM".
    expect(model.nextSessionLabel).toBe('Next: Tue, Aug 25 · 6–8 PM');
    expect(model.sessionsCompleted).toBe(1);
    // Total excludes the canceled session (completed + scheduled = 2).
    expect(model.sessionsTotal).toBe(2);
    expect(model.teamScopeLabel).toBe('Ravens');
  });

  it('a row with no scheduled session yields nextSessionLabel: null (the finished state)', () => {
    const row: CoachMeetingRow = {
      ...BASE_EVENT,
      sessions: [
        session({
          sessionId: 's-completed',
          sessionDate: '2026-07-15',
          startsAt: '2026-07-15T23:00:00.000Z',
          endsAt: '2026-07-16T01:00:00.000Z',
          status: 'completed',
        }),
      ],
    };
    const [model] = buildSeriesCardModels([row], identityPalette);
    expect(model.nextSessionLabel).toBeNull();
  });

  it('injects the palette index rather than hashing it internally (GAM-476: no second hash)', () => {
    const row: CoachMeetingRow = { ...BASE_EVENT, eventId: 'event-xyz' };
    const paletteIndexFor = (eventId: string): number => (eventId === 'event-xyz' ? 42 : -1);
    const [model] = buildSeriesCardModels([row], paletteIndexFor);
    expect(model.paletteIndex).toBe(42);
  });
});
