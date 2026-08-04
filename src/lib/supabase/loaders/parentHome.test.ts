// T181: the first test for `src/lib/supabase/loaders/parentHome.ts` -- the
// real backend behind `ParentHome.tsx`'s two injectable seams. Complements
// `ParentHome.test.tsx`'s own C1-C6/C10/C12 rendering-level proofs (which
// also exercise these same factories, bound to a stub client, through real
// DOM assertions) with query-level proofs: the exact column lists/filters/
// ordering each new query uses, and the client-side join/mapping logic,
// independent of any rendering.
//
// No `@vitest-environment jsdom` docblock -- this file only imports loader
// logic + page TYPES (`import type`), same posture `students.test.ts`/
// `outreach.test.ts` (this directory's own existing test files) already
// established.
import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it, vi } from 'vitest';
import {
  makeLoadLinkedStudentsForParentHome,
  makeLoadStudentHomeCardDataForParentHome,
} from './parentHome';

// ---------------------------------------------------------------------------
// A recording chain -- same minimal-chainable-Postgrest-response-stub shape
// `ParentHome.test.tsx`'s own C3/C5/C12 tests use, extended here to RECORD
// every `.select()`/`.eq()`/`.in()`/`.order()` call per table so this file's
// own assertions can inspect the exact arguments a query used, the same
// "record the call, assert the recorded args" technique `students.test.ts`/
// `outreach.test.ts` already established for this directory.
// ---------------------------------------------------------------------------

interface RecordedCalls {
  selectArgs: unknown[];
  eqArgs: [string, unknown][];
  inArgs: [string, unknown][];
  orderArgs: [string, unknown][];
  // T187 -- `.is('left_on', null)`, the new `student_teams` ACTIVE filter.
  isArgs: [string, unknown][];
}

function freshRecordedCalls(): RecordedCalls {
  return { selectArgs: [], eqArgs: [], inArgs: [], orderArgs: [], isArgs: [] };
}

function makeRecordingChain(
  result: { data: unknown; error: { message: string } | null },
  recorded: RecordedCalls,
): Record<string, unknown> {
  const chain: Record<string, unknown> = {};
  chain.select = (arg: unknown) => {
    recorded.selectArgs.push(arg);
    return chain;
  };
  chain.eq = (column: string, value: unknown) => {
    recorded.eqArgs.push([column, value]);
    return chain;
  };
  chain.in = (column: string, value: unknown) => {
    recorded.inArgs.push([column, value]);
    return chain;
  };
  chain.order = (column: string, opts: unknown) => {
    recorded.orderArgs.push([column, opts]);
    return chain;
  };
  chain.is = (column: string, value: unknown) => {
    recorded.isArgs.push([column, value]);
    return chain;
  };
  chain.maybeSingle = () => Promise.resolve(result);
  chain.then = (
    onFulfilled: (value: typeof result) => unknown,
    onRejected?: (reason: unknown) => unknown,
  ) => Promise.resolve(result).then(onFulfilled, onRejected);
  return chain;
}

/**
 * `byTable` keys are real table/view names. A table queried more than once
 * (e.g. `event_sessions`, queried both by the reused
 * `makeLoadConsistencyStripData` AND by this file's own fuller query --
 * disclosed double-scan, this file's own module doc) accumulates recorded
 * calls across every invocation, inspected via `.some(...)` below rather
 * than assuming exactly one call.
 */
function makeRecordingClient(byTable: Record<string, { data: unknown; error: null }>): {
  client: SupabaseClient;
  fromSpy: ReturnType<typeof vi.fn>;
  recordedByTable: Record<string, RecordedCalls>;
} {
  const recordedByTable: Record<string, RecordedCalls> = {};
  const fromSpy = vi.fn((table: string) => {
    const result = byTable[table];
    if (result === undefined) {
      throw new Error(`unexpected table/view queried: ${table}`);
    }
    recordedByTable[table] = recordedByTable[table] ?? freshRecordedCalls();
    return makeRecordingChain(result, recordedByTable[table]);
  });
  return { client: { from: fromSpy } as unknown as SupabaseClient, fromSpy, recordedByTable };
}

function parseSelectedColumns(selectArg: unknown): Set<string> {
  return new Set(
    String(selectArg)
      .split(',')
      .map((column) => column.trim()),
  );
}

// ---------------------------------------------------------------------------
// Outer seam -- makeLoadLinkedStudentsForParentHome
// ---------------------------------------------------------------------------

describe('makeLoadLinkedStudentsForParentHome', () => {
  function makeAuthedRecordingClient(
    userId: string | null,
    byTable: Record<string, { data: unknown; error: null }>,
  ): { client: SupabaseClient; recordedByTable: Record<string, RecordedCalls> } {
    const { client, recordedByTable } = makeRecordingClient(byTable);
    const authedClient = {
      ...client,
      auth: {
        getSession: async () => ({
          data: { session: userId ? { user: { id: userId } } : null },
          error: null,
        }),
      },
    } as unknown as SupabaseClient;
    return { client: authedClient, recordedByTable };
  }

  it('throws (never resolves an empty result) when the session itself fails to resolve (MINOR 8 decision, C12)', async () => {
    const { client } = makeAuthedRecordingClient(null, {
      guardian_links: { data: [], error: null },
      students: { data: [], error: null },
      teams: { data: [], error: null },
    });
    const loadLinkedStudents = makeLoadLinkedStudentsForParentHome(() => client);

    await expect(loadLinkedStudents()).rejects.toBeTruthy();
  });

  it('resolves {students: [], teams: []} (never throws) for a resolved session with zero guardian_links rows -- distinct from the null-session case', async () => {
    const { client } = makeAuthedRecordingClient('user-real-1', {
      guardian_links: { data: [], error: null },
      students: { data: [], error: null },
      teams: { data: [], error: null },
    });
    const loadLinkedStudents = makeLoadLinkedStudentsForParentHome(() => client);

    await expect(loadLinkedStudents()).resolves.toEqual({ students: [], teams: [] });
  });

  it("reads guardian_links scoped by exactly .eq('parent_profile_id', <session user id>), ordered by created_at ascending", async () => {
    const { client, recordedByTable } = makeAuthedRecordingClient('user-real-2', {
      guardian_links: { data: [{ student_id: 'student-real-1' }], error: null },
      students: {
        data: [
          {
            id: 'student-real-1',
            display_name: 'Real Student',
            team_id: 'team-real-1',
            is_active: true,
          },
        ],
        error: null,
      },
      teams: { data: [{ id: 'team-real-1', name: 'Real Team' }], error: null },
    });
    const loadLinkedStudents = makeLoadLinkedStudentsForParentHome(() => client);

    await loadLinkedStudents();

    const calls = recordedByTable.guardian_links;
    expect(calls.selectArgs[0]).toBe('student_id');
    expect(calls.eqArgs).toContainEqual(['parent_profile_id', 'user-real-2']);
    expect(calls.orderArgs).toContainEqual(['created_at', { ascending: true }]);
  });

  it("reads students with id/display_name/team_id/is_active, filtered by .in('id', <linked student ids>) -- NOT goal_hours_override", async () => {
    const { client, recordedByTable } = makeAuthedRecordingClient('user-real-3', {
      guardian_links: { data: [{ student_id: 'student-real-2' }], error: null },
      students: {
        data: [
          {
            id: 'student-real-2',
            display_name: 'Another Student',
            team_id: 'team-real-2',
            is_active: false,
          },
        ],
        error: null,
      },
      teams: { data: [{ id: 'team-real-2', name: 'Another Team' }], error: null },
    });
    const loadLinkedStudents = makeLoadLinkedStudentsForParentHome(() => client);

    await loadLinkedStudents();

    const calls = recordedByTable.students;
    const columns = parseSelectedColumns(calls.selectArgs[0]);
    expect(columns).toEqual(new Set(['id', 'display_name', 'team_id', 'is_active']));
    expect(columns.has('goal_hours_override')).toBe(false);
    expect(calls.inArgs).toContainEqual(['id', ['student-real-2']]);
  });

  it("maps team_id/is_active verbatim and preserves guardian_links' own earliest-linked-first ordering (not whatever order .in() happens to return)", async () => {
    const { client } = makeAuthedRecordingClient('user-real-4', {
      // guardian_links returns student-b BEFORE student-a (earliest-linked-first).
      guardian_links: {
        data: [{ student_id: 'student-b' }, { student_id: 'student-a' }],
        error: null,
      },
      // students table returns them in the OPPOSITE order -- proves the
      // loader re-orders by guardian_links, not by whatever `.in()` returns.
      students: {
        data: [
          { id: 'student-a', display_name: 'Student A', team_id: 'team-a', is_active: true },
          { id: 'student-b', display_name: 'Student B', team_id: 'team-b', is_active: false },
        ],
        error: null,
      },
      teams: {
        data: [
          { id: 'team-a', name: 'Team A' },
          { id: 'team-b', name: 'Team B' },
        ],
        error: null,
      },
    });
    const loadLinkedStudents = makeLoadLinkedStudentsForParentHome(() => client);

    const result = await loadLinkedStudents();

    expect(result.students).toEqual([
      { studentId: 'student-b', displayName: 'Student B', teamId: 'team-b', isActive: false },
      { studentId: 'student-a', displayName: 'Student A', teamId: 'team-a', isActive: true },
    ]);
    expect(result.teams).toEqual([
      { id: 'team-a', name: 'Team A' },
      { id: 'team-b', name: 'Team B' },
    ]);
  });

  it('never queries students/teams at all for a resolved session with zero guardian_links rows (short-circuit)', async () => {
    const { client, recordedByTable } = makeAuthedRecordingClient('user-real-5', {
      guardian_links: { data: [], error: null },
      students: { data: [], error: null },
      teams: { data: [], error: null },
    });
    const loadLinkedStudents = makeLoadLinkedStudentsForParentHome(() => client);

    await loadLinkedStudents();

    expect(recordedByTable.students).toBeUndefined();
    expect(recordedByTable.teams).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Per-card seam -- makeLoadStudentHomeCardDataForParentHome
// ---------------------------------------------------------------------------

describe('makeLoadStudentHomeCardDataForParentHome', () => {
  const STUDENT_ID = 'student-card-real-1';
  const TEAM_ID = 'team-card-real-1';

  function baseTables(
    overrides: Partial<Record<string, { data: unknown; error: null }>> = {},
  ): Record<string, { data: unknown; error: null }> {
    return {
      event_sessions: { data: [], error: null },
      attendance: { data: [], error: null },
      v_student_participation: { data: [], error: null },
      v_student_goal_projection: {
        data: { team_id: TEAM_ID, goal_hours: 80, confirmed_hours: 12, planned_hours: 3 },
        error: null,
      },
      // T187 -- `makeResolveStudentScope` (`students.ts`) now ALSO reads
      // `student_teams` for the ACTIVE membership set, sequentially after
      // the non-null `v_student_goal_projection` row above. A single row
      // mirroring the legacy `TEAM_ID` (real production backfill precedent:
      // one membership row per legacy `students.team_id`) preserves every
      // test below that doesn't override this key its own pre-T187
      // single-team scope, unchanged.
      student_teams: { data: [{ team_id: TEAM_ID }], error: null },
      events: { data: [], error: null },
      rsvps: { data: [], error: null },
      ...overrides,
    };
  }

  it('resolves goalHours/confirmedHours verbatim from resolveStudentScope (the FACTORY, bound to the injected client -- BLOCKER 2)', async () => {
    const { client } = makeRecordingClient(baseTables());
    const loadStudentData = makeLoadStudentHomeCardDataForParentHome(() => client);

    const data = await loadStudentData(STUDENT_ID, TEAM_ID);

    expect(data.goalHours).toBe(80);
    expect(data.confirmedHours).toBe(12);
  });

  it('resolves an honest goalHours: 0 / confirmedHours: 0 fallback (never a rejection) when resolveStudentScope returns null (e.g. a deactivated student)', async () => {
    const { client } = makeRecordingClient(
      baseTables({ v_student_goal_projection: { data: null, error: null } }),
    );
    const loadStudentData = makeLoadStudentHomeCardDataForParentHome(() => client);

    await expect(loadStudentData(STUDENT_ID, TEAM_ID)).resolves.toMatchObject({
      goalHours: 0,
      confirmedHours: 0,
    });
  });

  /**
   * T187 -- the FIRST of the two disclosed edge cases (`loaders/parentHome.ts`'s
   * own module doc): `scope === null` falls back to the threaded single
   * `teamId`, not to an empty/nothing scope. Extends the test immediately
   * above (which only checked goalHours/confirmedHours) to also prove
   * next-events scoping specifically -- `student_teams` is never even
   * queried here (module doc's own sequential-fetch decision, same as
   * `students.ts`), so this genuinely exercises the fallback branch, not a
   * seeded active row.
   */
  it('falls back to the threaded single teamId for next-events scoping when resolveStudentScope returns null', async () => {
    const eventRow = {
      id: 'event-scope-null-fallback',
      season_id: 'season-scope-null',
      type: 'meeting',
      title: 'Fallback Scope Meeting',
      team_ids: [TEAM_ID],
    };
    const sessionRow = {
      id: 'session-scope-null-fallback',
      event_id: 'event-scope-null-fallback',
      session_date: '2026-06-05',
      starts_at: '2026-06-05T10:00:00.000Z',
      ends_at: '2026-06-05T11:00:00.000Z',
      status: 'scheduled',
    };
    const { client, recordedByTable } = makeRecordingClient(
      baseTables({
        v_student_goal_projection: { data: null, error: null },
        events: { data: [eventRow], error: null },
        event_sessions: { data: [sessionRow], error: null },
      }),
    );
    const loadStudentData = makeLoadStudentHomeCardDataForParentHome(
      () => client,
      () => new Date('2026-06-01T00:00:00.000Z'),
    );

    const data = await loadStudentData(STUDENT_ID, TEAM_ID);

    expect(data.nextEvents).toHaveLength(1);
    expect(data.nextEvents[0]?.title).toBe('Fallback Scope Meeting');
    // The sequential-fetch decision (students.ts's own module doc): no row
    // -> student_teams is never queried at all.
    expect(recordedByTable.student_teams).toBeUndefined();
  });

  /**
   * T187 -- the SECOND disclosed edge case: `scope` present but a genuinely
   * EMPTY active `teamIds` scopes to NOTHING (an honest `[]`), it does NOT
   * fall back to the threaded `teamId`. A real student with zero active
   * `student_teams` rows genuinely has no team-scoped events to show.
   */
  it('scopes to NOTHING (never falls back to teamId) when resolveStudentScope resolves a present scope with zero active memberships', async () => {
    const eventRow = {
      id: 'event-zero-active',
      season_id: 'season-zero-active',
      type: 'meeting',
      title: 'Would Only Show On A Fallback',
      team_ids: [TEAM_ID],
    };
    const sessionRow = {
      id: 'session-zero-active',
      event_id: 'event-zero-active',
      session_date: '2026-06-05',
      starts_at: '2026-06-05T10:00:00.000Z',
      ends_at: '2026-06-05T11:00:00.000Z',
      status: 'scheduled',
    };
    const { client } = makeRecordingClient(
      baseTables({
        student_teams: { data: [], error: null },
        events: { data: [eventRow], error: null },
        event_sessions: { data: [sessionRow], error: null },
      }),
    );
    const loadStudentData = makeLoadStudentHomeCardDataForParentHome(
      () => client,
      () => new Date('2026-06-01T00:00:00.000Z'),
    );

    const data = await loadStudentData(STUDENT_ID, TEAM_ID);

    expect(data.nextEvents).toEqual([]);
  });

  it('reads events with id/season_id/type/title/team_ids, unfiltered (full table, RLS-scoped)', async () => {
    const { client, recordedByTable } = makeRecordingClient(baseTables());
    const loadStudentData = makeLoadStudentHomeCardDataForParentHome(() => client);

    await loadStudentData(STUDENT_ID, TEAM_ID);

    const columns = parseSelectedColumns(recordedByTable.events.selectArgs[0]);
    expect(columns).toEqual(new Set(['id', 'season_id', 'type', 'title', 'team_ids']));
    expect(recordedByTable.events.eqArgs).toEqual([]);
  });

  it("reads a FULLER event_sessions than the reused strip loader's own private query -- id/event_id/session_date/starts_at/ends_at/status", async () => {
    const { client, recordedByTable } = makeRecordingClient(baseTables());
    const loadStudentData = makeLoadStudentHomeCardDataForParentHome(() => client);

    await loadStudentData(STUDENT_ID, TEAM_ID);

    // event_sessions is queried TWICE (disclosed double-scan, this file's
    // own module doc) -- assert at least one of the recorded selects is the
    // FULLER column set this task's own new query uses.
    const selectStrings = recordedByTable.event_sessions.selectArgs.map((arg) =>
      parseSelectedColumns(arg),
    );
    expect(
      selectStrings.some(
        (columns) =>
          columns.has('event_id') && columns.has('ends_at') && columns.has('session_date'),
      ),
    ).toBe(true);
  });

  it("reads rsvps filtered by exactly .eq('student_id', studentId), full columns id/session_id/student_id/status/responded_by/updated_at", async () => {
    const { client, recordedByTable } = makeRecordingClient(baseTables());
    const loadStudentData = makeLoadStudentHomeCardDataForParentHome(() => client);

    await loadStudentData(STUDENT_ID, TEAM_ID);

    const columns = parseSelectedColumns(recordedByTable.rsvps.selectArgs[0]);
    expect(columns).toEqual(
      new Set(['id', 'session_id', 'student_id', 'status', 'responded_by', 'updated_at']),
    );
    expect(recordedByTable.rsvps.eqArgs).toContainEqual(['student_id', STUDENT_ID]);
  });

  it('threads the injectable nowFn clock through to buildNextEventsForStudent -- an event whose session already ended relative to nowFn is excluded', async () => {
    const eventRow = {
      id: 'event-clock-1',
      season_id: 'season-clock',
      type: 'meeting',
      title: 'Clock Test Meeting',
      team_ids: [TEAM_ID],
    };
    const pastSession = {
      id: 'session-clock-past',
      event_id: 'event-clock-1',
      session_date: '2026-01-01',
      starts_at: '2026-01-01T10:00:00.000Z',
      ends_at: '2026-01-01T11:00:00.000Z',
      status: 'scheduled',
    };
    const { client } = makeRecordingClient(
      baseTables({
        events: { data: [eventRow], error: null },
        event_sessions: { data: [pastSession], error: null },
      }),
    );
    // nowFn fixed WELL AFTER the session's own endsAt -- must be excluded.
    const loadStudentDataAfter = makeLoadStudentHomeCardDataForParentHome(
      () => client,
      () => new Date('2026-06-01T00:00:00.000Z'),
    );
    const dataAfter = await loadStudentDataAfter(STUDENT_ID, TEAM_ID);
    expect(dataAfter.nextEvents).toEqual([]);

    // Same fixture, nowFn fixed BEFORE the session's own endsAt -- included.
    const loadStudentDataBefore = makeLoadStudentHomeCardDataForParentHome(
      () => client,
      () => new Date('2025-12-01T00:00:00.000Z'),
    );
    const dataBefore = await loadStudentDataBefore(STUDENT_ID, TEAM_ID);
    expect(dataBefore.nextEvents).toHaveLength(1);
    expect(dataBefore.nextEvents[0]?.title).toBe('Clock Test Meeting');
  });

  it("filters rsvps down to only sessions present in nextEvents (mirrors the fixture loader's own convention)", async () => {
    const eventRow = {
      id: 'event-rsvp-1',
      season_id: 'season-rsvp',
      type: 'outreach',
      title: 'RSVP Test Outreach',
      team_ids: [TEAM_ID],
    };
    const futureSession = {
      id: 'session-rsvp-included',
      event_id: 'event-rsvp-1',
      session_date: '2026-06-05',
      starts_at: '2026-06-05T10:00:00.000Z',
      ends_at: '2026-06-05T11:00:00.000Z',
      status: 'scheduled',
    };
    const rsvpForIncludedSession = {
      id: 'rsvp-included',
      session_id: 'session-rsvp-included',
      student_id: STUDENT_ID,
      status: 'going',
      responded_by: null,
      updated_at: '2026-06-01T00:00:00.000Z',
    };
    const rsvpForUnrelatedSession = {
      id: 'rsvp-unrelated',
      session_id: 'session-not-in-next-events',
      student_id: STUDENT_ID,
      status: 'maybe',
      responded_by: null,
      updated_at: '2026-06-01T00:00:00.000Z',
    };
    const { client } = makeRecordingClient(
      baseTables({
        events: { data: [eventRow], error: null },
        event_sessions: { data: [futureSession], error: null },
        rsvps: { data: [rsvpForIncludedSession, rsvpForUnrelatedSession], error: null },
      }),
    );
    const loadStudentData = makeLoadStudentHomeCardDataForParentHome(
      () => client,
      () => new Date('2026-06-01T00:00:00.000Z'),
    );

    const data = await loadStudentData(STUDENT_ID, TEAM_ID);

    expect(data.rsvps).toHaveLength(1);
    expect(data.rsvps[0]?.id).toBe('rsvp-included');
  });

  it("assigns the reused strip loader's entries/participation to consistencyEntries/participation verbatim (field rename only, no shape change)", async () => {
    const attendanceRow = {
      session_id: 'session-strip-1',
      student_id: STUDENT_ID,
      status: 'present',
    };
    const completedSession = {
      id: 'session-strip-1',
      event_id: 'event-strip-1',
      session_date: '2026-05-01',
      starts_at: '2026-05-01T10:00:00.000Z',
      ends_at: '2026-05-01T11:00:00.000Z',
      status: 'completed',
    };
    const { client } = makeRecordingClient(
      baseTables({
        event_sessions: { data: [completedSession], error: null },
        attendance: { data: [attendanceRow], error: null },
      }),
    );
    const loadStudentData = makeLoadStudentHomeCardDataForParentHome(() => client);

    const data = await loadStudentData(STUDENT_ID, TEAM_ID);

    expect(data.consistencyEntries).toEqual([
      { sessionId: 'session-strip-1', sessionDate: '2026-05-01', status: 'present' },
    ]);
    expect(data.participation).toBeNull();
  });

  /**
   * T187 (acceptance criterion 2) -- a parent's TWO-team child sees events
   * from BOTH real ACTIVE `student_teams` memberships, not just the legacy
   * primary `teamId` threaded in.
   */
  it("includes next-events from BOTH of a student's real ACTIVE student_teams memberships, never just the threaded primary teamId", async () => {
    const SECOND_TEAM_ID = 'team-card-real-second';
    const primaryEvent = {
      id: 'event-real-primary',
      season_id: 'season-real',
      type: 'meeting',
      title: 'Primary Team Real Meeting',
      team_ids: [TEAM_ID],
    };
    const secondEvent = {
      id: 'event-real-second',
      season_id: 'season-real',
      type: 'outreach',
      title: 'Second Team Real Outreach',
      team_ids: [SECOND_TEAM_ID],
    };
    const primarySession = {
      id: 'session-real-primary',
      event_id: 'event-real-primary',
      session_date: '2026-06-05',
      starts_at: '2026-06-05T10:00:00.000Z',
      ends_at: '2026-06-05T11:00:00.000Z',
      status: 'scheduled',
    };
    const secondSession = {
      id: 'session-real-second',
      event_id: 'event-real-second',
      session_date: '2026-06-06',
      starts_at: '2026-06-06T10:00:00.000Z',
      ends_at: '2026-06-06T11:00:00.000Z',
      status: 'scheduled',
    };
    const { client } = makeRecordingClient(
      baseTables({
        // TWO active memberships for this one student.
        student_teams: {
          data: [{ team_id: TEAM_ID }, { team_id: SECOND_TEAM_ID }],
          error: null,
        },
        events: { data: [primaryEvent, secondEvent], error: null },
        event_sessions: { data: [primarySession, secondSession], error: null },
      }),
    );
    const loadStudentData = makeLoadStudentHomeCardDataForParentHome(
      () => client,
      () => new Date('2026-06-01T00:00:00.000Z'),
    );

    const data = await loadStudentData(STUDENT_ID, TEAM_ID);

    expect(data.nextEvents.map((event) => event.title)).toEqual([
      'Primary Team Real Meeting',
      'Second Team Real Outreach',
    ]);
  });
});
