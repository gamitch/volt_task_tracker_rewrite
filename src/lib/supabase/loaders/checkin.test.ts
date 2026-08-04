// T161: tests for `loaders/checkin.ts`, which shipped with ZERO tests across
// 521 lines. Brought under test ahead of T196 (making `LiveConsole` real) —
// building on an untested loader is the exact mistake that produced the
// fixture shell in the first place.
//
// Mirrors `loaders/coachHome.test.ts`'s `makeRecordingClient` `.from(table)`
// dispatcher, extended here because this file's five queries use four
// different PostgREST chain shapes (`.order()`, `.eq()`, `.eq().order()`,
// `.in()`) plus `client.auth.getSession()`.
//
// No `@vitest-environment jsdom` docblock — `checkin.ts` imports only types
// from its paired pages, so this exercises loader logic in vitest's default
// node environment, the posture `students.test.ts`/`coachHome.test.ts`
// already established.
import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it, vi } from 'vitest';
import {
  aggregateParticipationForStudent,
  makeGetAccessToken,
  makeLoadConsistencyStripData,
  makeLoadLinkedStudents,
  makeLoadOpenCheckinSessions,
} from './checkin';

// ---------------------------------------------------------------------------
// Fixtures — fabricated names only (constitution item 6).
// ---------------------------------------------------------------------------

type ParticipationRow = Parameters<typeof aggregateParticipationForStudent>[0][number];

function participationRow(overrides: Partial<ParticipationRow> = {}): ParticipationRow {
  return {
    student_id: 'student-remy-okafor',
    team_id: 'team-falcons',
    season_id: 'season-2026',
    expected_ct: 10,
    present_ct: 8,
    late_ct: 1,
    excused_ct: 0,
    participation_pct: 80,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// aggregateParticipationForStudent — the one place this file does arithmetic.
// ---------------------------------------------------------------------------

describe('aggregateParticipationForStudent (T161)', () => {
  it('returns null for a student with no rows at all (the real "no completed sessions" absence)', () => {
    expect(aggregateParticipationForStudent([])).toBeNull();
  });

  it('returns a single row VERBATIM — no recomputation, not even a no-op one', () => {
    const row = participationRow({ participation_pct: 77.7 });
    const result = aggregateParticipationForStudent([row]);
    // Identity, not just deep equality: proves the single-row path short-circuits
    // before the arithmetic branch rather than recomputing to the same value.
    expect(result).toBe(row);
    expect(result?.participation_pct).toBe(77.7);
  });

  it('sums a dual-member student across teams WITHIN one season', () => {
    const result = aggregateParticipationForStudent([
      participationRow({ team_id: 'team-falcons', expected_ct: 10, present_ct: 8, excused_ct: 1 }),
      participationRow({ team_id: 'team-comets', expected_ct: 6, present_ct: 3, excused_ct: 1 }),
    ]);
    expect(result?.expected_ct).toBe(16);
    expect(result?.present_ct).toBe(11);
    expect(result?.excused_ct).toBe(2);
    // 100 * 11 / max(16 - 2, 1) = 78.571… -> 78.6
    expect(result?.participation_pct).toBe(78.6);
  });

  it("never aggregates ACROSS seasons — only rows sharing the first row's season", () => {
    const result = aggregateParticipationForStudent([
      participationRow({ season_id: 'season-2026', expected_ct: 10, present_ct: 8 }),
      participationRow({ season_id: 'season-2025', expected_ct: 99, present_ct: 99 }),
    ]);
    // Only one row belongs to season-2026, so the single-row path returns it
    // verbatim — the 2025 row must not contribute at all.
    expect(result?.season_id).toBe('season-2026');
    expect(result?.expected_ct).toBe(10);
    expect(result?.present_ct).toBe(8);
  });

  it('guards the denominator at 1 when every expected session was excused (no divide-by-zero)', () => {
    const result = aggregateParticipationForStudent([
      participationRow({ team_id: 'team-falcons', expected_ct: 4, present_ct: 0, excused_ct: 4 }),
      participationRow({ team_id: 'team-comets', expected_ct: 3, present_ct: 0, excused_ct: 3 }),
    ]);
    // expected - excused = 0 -> greatest(..., 1) -> 1. 100 * 0 / 1 = 0.
    expect(result?.participation_pct).toBe(0);
    expect(Number.isFinite(result?.participation_pct)).toBe(true);
  });

  it("reapplies the SQL view's own expression, not a second invented formula", () => {
    // Pinned against `supabase/migrations/20260722000000_membership_views.sql:75-77`:
    //   round(100.0 * present_ct / greatest(expected_ct - excused_ct, 1), 1)
    // If either side is edited without the other, this fails here rather than
    // silently showing a student a different number than the view computes.
    const cases: ReadonlyArray<{
      present: number;
      expected: number;
      excused: number;
      pct: number;
    }> = [
      { present: 11, expected: 16, excused: 2, pct: 78.6 },
      { present: 1, expected: 3, excused: 0, pct: 33.3 },
      { present: 2, expected: 3, excused: 0, pct: 66.7 },
      { present: 5, expected: 10, excused: 2, pct: 62.5 },
      { present: 0, expected: 5, excused: 5, pct: 0 },
    ];
    for (const { present, expected, excused, pct } of cases) {
      const result = aggregateParticipationForStudent([
        participationRow({
          team_id: 'team-a',
          expected_ct: expected,
          present_ct: present,
          excused_ct: excused,
        }),
        participationRow({ team_id: 'team-b', expected_ct: 0, present_ct: 0, excused_ct: 0 }),
      ]);
      expect(result?.participation_pct).toBe(pct);
    }
  });
});

// ---------------------------------------------------------------------------
// makeGetAccessToken — every failure mode degrades to null, by design.
// ---------------------------------------------------------------------------

function authClient(getSession: () => unknown): SupabaseClient {
  return { auth: { getSession } } as unknown as SupabaseClient;
}

describe('makeGetAccessToken (T161)', () => {
  it('resolves the access token when a real session exists', async () => {
    const client = authClient(() =>
      Promise.resolve({ data: { session: { access_token: 'jwt-abc' } }, error: null }),
    );
    await expect(makeGetAccessToken(() => client)()).resolves.toBe('jwt-abc');
  });

  it('resolves null (never rejects) when Supabase is unconfigured and getClient throws', async () => {
    const getClient = vi.fn(() => {
      throw new Error('SupabaseNotConfiguredError');
    });
    await expect(makeGetAccessToken(getClient)()).resolves.toBeNull();
    expect(getClient).toHaveBeenCalledTimes(1);
  });

  it('resolves null (never rejects) when getSession returns an error', async () => {
    // The session deliberately carries a usable token ALONGSIDE the error.
    // With `{session: null, error}` this assertion passes for the wrong
    // reason — the error branch and the no-session branch return the same
    // value, so deleting the `if (error)` check leaves it green. Measured:
    // that mutation ran clean at exit 0 before this fixture was changed.
    const client = authClient(() =>
      Promise.resolve({
        data: { session: { access_token: 'token-from-an-errored-lookup' } },
        error: { message: 'network down' },
      }),
    );
    await expect(makeGetAccessToken(() => client)()).resolves.toBeNull();
  });

  it('resolves null (never rejects) when getSession itself throws', async () => {
    const client = authClient(() => Promise.reject(new Error('boom')));
    await expect(makeGetAccessToken(() => client)()).resolves.toBeNull();
  });

  it('resolves null when there is simply no signed-in session', async () => {
    const client = authClient(() => Promise.resolve({ data: { session: null }, error: null }));
    await expect(makeGetAccessToken(() => client)()).resolves.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// makeLoadLinkedStudents — two early returns and a client-side join.
// ---------------------------------------------------------------------------

interface LinkedStubOptions {
  sessionUserId: string | null;
  links?: Array<{ student_id: string }>;
  students?: Array<{ id: string; display_name: string }>;
}

function makeLinkedClient(options: LinkedStubOptions) {
  const linksEqSpy = vi.fn(() => ({
    order: vi.fn().mockResolvedValue({ data: options.links ?? [], error: null }),
  }));
  const studentsInSpy = vi.fn().mockResolvedValue({ data: options.students ?? [], error: null });
  const guardianSelectSpy = vi.fn(() => ({ eq: linksEqSpy }));
  const studentsSelectSpy = vi.fn(() => ({ in: studentsInSpy }));
  const fromSpy = vi.fn((table: string) => {
    if (table === 'guardian_links') return { select: guardianSelectSpy };
    if (table === 'students') return { select: studentsSelectSpy };
    throw new Error(`unexpected table: ${table}`);
  });
  const client = {
    from: fromSpy,
    auth: {
      getSession: vi.fn().mockResolvedValue({
        data: { session: options.sessionUserId ? { user: { id: options.sessionUserId } } : null },
        error: null,
      }),
    },
  } as unknown as SupabaseClient;
  return { client, fromSpy, linksEqSpy, studentsInSpy };
}

describe('makeLoadLinkedStudents (T161)', () => {
  it('returns [] and never touches guardian_links when there is no session', async () => {
    const { client, fromSpy } = makeLinkedClient({ sessionUserId: null });
    await expect(makeLoadLinkedStudents(() => client)()).resolves.toEqual([]);
    expect(fromSpy).not.toHaveBeenCalled();
  });

  it('returns [] and never queries students when the parent has no linked children', async () => {
    const { client, fromSpy } = makeLinkedClient({ sessionUserId: 'parent-1', links: [] });
    await expect(makeLoadLinkedStudents(() => client)()).resolves.toEqual([]);
    expect(fromSpy).toHaveBeenCalledWith('guardian_links');
    expect(fromSpy).not.toHaveBeenCalledWith('students');
  });

  it('scopes guardian_links to the signed-in parent from the real session', async () => {
    const { client, linksEqSpy } = makeLinkedClient({
      sessionUserId: 'parent-nadia-brandt',
      links: [{ student_id: 'student-1' }],
      students: [{ id: 'student-1', display_name: 'Remy Okafor' }],
    });
    await makeLoadLinkedStudents(() => client)();
    expect(linksEqSpy).toHaveBeenCalledWith('parent_profile_id', 'parent-nadia-brandt');
  });

  it('joins display names client-side and preserves guardian_links order (earliest-linked first)', async () => {
    const { client, studentsInSpy } = makeLinkedClient({
      sessionUserId: 'parent-1',
      links: [{ student_id: 'student-2' }, { student_id: 'student-1' }],
      // Deliberately returned in the OPPOSITE order to prove ordering comes
      // from guardian_links, not from the students response.
      students: [
        { id: 'student-1', display_name: 'Remy Okafor' },
        { id: 'student-2', display_name: 'Sasha Lindqvist' },
      ],
    });
    await expect(makeLoadLinkedStudents(() => client)()).resolves.toEqual([
      { studentId: 'student-2', displayName: 'Sasha Lindqvist' },
      { studentId: 'student-1', displayName: 'Remy Okafor' },
    ]);
    expect(studentsInSpy).toHaveBeenCalledWith('id', ['student-2', 'student-1']);
  });

  it('falls back to an empty display name when a linked student row is missing (never renders "undefined")', async () => {
    const { client } = makeLinkedClient({
      sessionUserId: 'parent-1',
      links: [{ student_id: 'student-ghost' }],
      students: [],
    });
    await expect(makeLoadLinkedStudents(() => client)()).resolves.toEqual([
      { studentId: 'student-ghost', displayName: '' },
    ]);
  });
});

// ---------------------------------------------------------------------------
// makeLoadConsistencyStripData — query shapes and the RLS defense-in-depth filter.
// ---------------------------------------------------------------------------

function makeStripClient() {
  const sessionsOrderSpy = vi.fn().mockResolvedValue({ data: [], error: null });
  const attendanceEqSpy = vi.fn().mockResolvedValue({ data: [], error: null });
  const participationEqSpy = vi.fn().mockResolvedValue({ data: [], error: null });
  const sessionsSelectSpy = vi.fn(() => ({ order: sessionsOrderSpy }));
  const attendanceSelectSpy = vi.fn(() => ({ eq: attendanceEqSpy }));
  const participationSelectSpy = vi.fn(() => ({ eq: participationEqSpy }));
  const fromSpy = vi.fn((table: string) => {
    if (table === 'event_sessions') return { select: sessionsSelectSpy };
    if (table === 'attendance') return { select: attendanceSelectSpy };
    if (table === 'v_student_participation') return { select: participationSelectSpy };
    throw new Error(`unexpected table: ${table}`);
  });
  return {
    client: { from: fromSpy } as unknown as SupabaseClient,
    fromSpy,
    sessionsSelectSpy,
    attendanceSelectSpy,
    attendanceEqSpy,
    participationEqSpy,
  };
}

describe('makeLoadConsistencyStripData (T161)', () => {
  it('reads all three tables for one student', async () => {
    const stub = makeStripClient();
    await makeLoadConsistencyStripData(() => stub.client)('student-remy-okafor');
    expect(stub.fromSpy).toHaveBeenCalledWith('event_sessions');
    expect(stub.fromSpy).toHaveBeenCalledWith('attendance');
    expect(stub.fromSpy).toHaveBeenCalledWith('v_student_participation');
  });

  it('fetches event_sessions UNFILTERED — the completed-only rule lives in one place, not here', async () => {
    const stub = makeStripClient();
    await makeLoadConsistencyStripData(() => stub.client)('student-1');
    // A `.eq('status', 'completed')` here would duplicate the rule that already
    // lives in StudentMeetingView's selectLastCompletedAttendance.
    expect(stub.sessionsSelectSpy).toHaveBeenCalledWith('id, session_date, starts_at, status');
    expect(stub.sessionsSelectSpy).toHaveBeenCalledTimes(1);
  });

  it('filters attendance by student_id — defense-in-depth on top of the own_or_linked_read RLS policy', async () => {
    const stub = makeStripClient();
    await makeLoadConsistencyStripData(() => stub.client)('student-remy-okafor');
    expect(stub.attendanceSelectSpy).toHaveBeenCalledWith('session_id, student_id, status');
    expect(stub.attendanceEqSpy).toHaveBeenCalledWith('student_id', 'student-remy-okafor');
  });

  it('filters participation by student_id with no .limit(1) — a dual member has more than one row', async () => {
    const stub = makeStripClient();
    await makeLoadConsistencyStripData(() => stub.client)('student-remy-okafor');
    expect(stub.participationEqSpy).toHaveBeenCalledWith('student_id', 'student-remy-okafor');
  });
});

// ---------------------------------------------------------------------------
// makeLoadOpenCheckinSessions (T400) — the session picker's data source.
//
// The defect class that matters here is a WRONG WINDOW: too narrow and the
// student standing in the room sees an empty list (the exact failure T400
// exists to remove); too wide and they are offered a meeting from last week
// and check into the wrong one. So the bounds are asserted as real values
// against a pinned clock, not as "some ISO string was passed".
// ---------------------------------------------------------------------------

interface OpenSessionStubOptions {
  sessions?: Array<{ id: string; event_id: string; starts_at: string; ends_at: string }> | null;
  events?: Array<{ id: string; title: string }> | null;
}

function makeOpenSessionsClient(options: OpenSessionStubOptions = {}) {
  const orderSpy = vi
    .fn()
    .mockResolvedValue({
      data: options.sessions === undefined ? [] : options.sessions,
      error: null,
    });
  const lteSpy = vi.fn(() => ({ order: orderSpy }));
  const gteSpy = vi.fn(() => ({ lte: lteSpy }));
  const sessionsEqSpy = vi.fn(() => ({ gte: gteSpy }));
  const sessionsSelectSpy = vi.fn(() => ({ eq: sessionsEqSpy }));
  const eventsInSpy = vi
    .fn()
    .mockResolvedValue({ data: options.events === undefined ? [] : options.events, error: null });
  const eventsSelectSpy = vi.fn(() => ({ in: eventsInSpy }));
  const fromSpy = vi.fn((table: string) => {
    if (table === 'event_sessions') return { select: sessionsSelectSpy };
    if (table === 'events') return { select: eventsSelectSpy };
    throw new Error(`unexpected table: ${table}`);
  });
  const client = { from: fromSpy } as unknown as SupabaseClient;
  return {
    client,
    fromSpy,
    sessionsSelectSpy,
    sessionsEqSpy,
    gteSpy,
    lteSpy,
    orderSpy,
    eventsInSpy,
  };
}

/** 2026-08-04T18:00:00Z, pinned so the window bounds are exact values. */
const PINNED_NOW = Date.parse('2026-08-04T18:00:00.000Z');

describe('makeLoadOpenCheckinSessions (T400)', () => {
  it('asks only for scheduled sessions — a completed or canceled one must never be offered', async () => {
    const stub = makeOpenSessionsClient();
    await makeLoadOpenCheckinSessions(
      () => stub.client,
      () => PINNED_NOW,
    )();
    expect(stub.sessionsEqSpy).toHaveBeenCalledWith('status', 'scheduled');
  });

  it('opens the window two hours BEFORE the session ends, so a student leaving late can still check in', async () => {
    const stub = makeOpenSessionsClient();
    await makeLoadOpenCheckinSessions(
      () => stub.client,
      () => PINNED_NOW,
    )();
    // ends_at >= now - 2h. A session that ended 90 minutes ago is still listed.
    expect(stub.gteSpy).toHaveBeenCalledWith('ends_at', '2026-08-04T16:00:00.000Z');
  });

  it('opens the window two hours before the session starts, so an early arrival sees it', async () => {
    const stub = makeOpenSessionsClient();
    await makeLoadOpenCheckinSessions(
      () => stub.client,
      () => PINNED_NOW,
    )();
    // starts_at <= now + 2h.
    expect(stub.lteSpy).toHaveBeenCalledWith('starts_at', '2026-08-04T20:00:00.000Z');
  });

  it('joins each session to its event title — a swap here labels the wrong meeting', async () => {
    // Distinct titles AND a deliberately reversed events response: if the join
    // ignored event_id and paired by position, this returns the wrong titles.
    const stub = makeOpenSessionsClient({
      sessions: [
        {
          id: 'session-build-night',
          event_id: 'event-build',
          starts_at: '2026-08-04T18:00:00.000Z',
          ends_at: '2026-08-04T21:00:00.000Z',
        },
        {
          id: 'session-outreach',
          event_id: 'event-outreach',
          starts_at: '2026-08-04T19:00:00.000Z',
          ends_at: '2026-08-04T20:00:00.000Z',
        },
      ],
      events: [
        { id: 'event-outreach', title: 'Library STEM Night' },
        { id: 'event-build', title: 'Tuesday Build Night' },
      ],
    });
    await expect(
      makeLoadOpenCheckinSessions(
        () => stub.client,
        () => PINNED_NOW,
      )(),
    ).resolves.toEqual([
      {
        sessionId: 'session-build-night',
        title: 'Tuesday Build Night',
        startsAt: '2026-08-04T18:00:00.000Z',
      },
      {
        sessionId: 'session-outreach',
        title: 'Library STEM Night',
        startsAt: '2026-08-04T19:00:00.000Z',
      },
    ]);
  });

  it('still lists a session whose event title did not come back, rather than hiding it', async () => {
    const stub = makeOpenSessionsClient({
      sessions: [
        {
          id: 'session-orphan',
          event_id: 'event-missing',
          starts_at: '2026-08-04T18:00:00.000Z',
          ends_at: '2026-08-04T21:00:00.000Z',
        },
      ],
      events: [],
    });
    const result = await makeLoadOpenCheckinSessions(
      () => stub.client,
      () => PINNED_NOW,
    )();
    expect(result).toHaveLength(1);
    expect(result[0].sessionId).toBe('session-orphan');
    expect(result[0].title).toBe('Meeting');
  });

  it('never queries events when no session is open', async () => {
    const stub = makeOpenSessionsClient({ sessions: [] });
    await expect(
      makeLoadOpenCheckinSessions(
        () => stub.client,
        () => PINNED_NOW,
      )(),
    ).resolves.toEqual([]);
    expect(stub.fromSpy).toHaveBeenCalledWith('event_sessions');
    expect(stub.fromSpy).not.toHaveBeenCalledWith('events');
  });

  it('treats a null session response as "none open" rather than crashing', async () => {
    const stub = makeOpenSessionsClient({ sessions: null });
    await expect(
      makeLoadOpenCheckinSessions(
        () => stub.client,
        () => PINNED_NOW,
      )(),
    ).resolves.toEqual([]);
  });

  it('de-duplicates event ids so two sessions of one event cost one events query', async () => {
    const stub = makeOpenSessionsClient({
      sessions: [
        {
          id: 'session-am',
          event_id: 'event-build',
          starts_at: '2026-08-04T17:00:00.000Z',
          ends_at: '2026-08-04T18:30:00.000Z',
        },
        {
          id: 'session-pm',
          event_id: 'event-build',
          starts_at: '2026-08-04T19:00:00.000Z',
          ends_at: '2026-08-04T21:00:00.000Z',
        },
      ],
      events: [{ id: 'event-build', title: 'Tuesday Build Night' }],
    });
    await makeLoadOpenCheckinSessions(
      () => stub.client,
      () => PINNED_NOW,
    )();
    expect(stub.eventsInSpy).toHaveBeenCalledWith('id', ['event-build']);
  });
});
