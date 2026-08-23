// GAM-491 -- the first, and this directory's own only, test coverage for
// `./sessionRoster.ts`. Follows `endMeeting.test.ts`'s hand-rolled
// query-builder stub convention (worker packet §10): every chain method
// records its call and is itself thenable, no real network call anywhere in
// this file.
//
// No `@vitest-environment jsdom` docblock -- this file only imports loader
// logic + a TYPE from a page module (`SessionRosterEntry`, via
// `./sessionRoster.ts`'s own type-only import), same posture
// `endMeeting.test.ts`/`students.test.ts` already established.
//
// Criteria below are numbered exactly as the worker packet's §8 (criteria
// 1-9, the only ones this file is responsible for; 10-12 live in
// `../../../pages/meetings/coach/CoachMeetingsView.test.tsx`).
import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it, vi } from 'vitest';
import {
  makeLoadSessionRoster,
  loadSessionRoster,
  type LoadSessionRosterFn,
} from './sessionRoster';
import { UNMARKED_DB_STATUS } from './attendance';

// ---------------------------------------------------------------------------
// Shared test utilities -- `endMeeting.test.ts`'s own `makeSummaryReadChain`/
// `makeSummaryRecordingClient` shape, generalized slightly to also record
// `.in(...)` calls (`makeLoadAttendanceForSessions`'s own `.in('session_id',
// ...)`), since this loader's own `attendance` read goes through that
// reused function rather than a query this file writes itself.
// ---------------------------------------------------------------------------

interface TableResult {
  data: unknown;
  error: { message: string } | null;
}

interface RecordedTableCalls {
  eqArgs: [string, unknown][];
  inArgs: [string, unknown][];
}

function freshRecordedTableCalls(): RecordedTableCalls {
  return { eqArgs: [], inArgs: [] };
}

function makeReadChain(result: TableResult, recorded: RecordedTableCalls): Record<string, unknown> {
  const chain: Record<string, unknown> = {};
  chain.select = () => chain;
  chain.eq = (column: string, value: unknown) => {
    recorded.eqArgs.push([column, value]);
    return chain;
  };
  chain.in = (column: string, value: unknown) => {
    recorded.inArgs.push([column, value]);
    return chain;
  };
  // T320 pagination links `makeLoadAttendanceForSessions` chains onto every
  // `attendance` read (`attendance.ts:391-402`) -- accepted here even though
  // this file's own `events`/`event_sessions`/`students` queries never call
  // them, same "shared chain accepts both links" posture
  // `endMeeting.test.ts:106-114`'s own comment documents.
  chain.order = () => chain;
  chain.range = () => chain;
  chain.maybeSingle = () => Promise.resolve(result);
  chain.then = (
    onFulfilled: (value: TableResult) => unknown,
    onRejected?: (reason: unknown) => unknown,
  ) => Promise.resolve(result).then(onFulfilled, onRejected);
  return chain;
}

function makeRecordingClient(byTable: Partial<Record<string, TableResult>>): {
  client: SupabaseClient;
  recordedByTable: Record<string, RecordedTableCalls>;
} {
  const recordedByTable: Record<string, RecordedTableCalls> = {};
  const fromSpy = vi.fn((table: string) => {
    const result = byTable[table];
    if (result === undefined) {
      throw new Error(`unexpected table queried: ${table}`);
    }
    recordedByTable[table] = recordedByTable[table] ?? freshRecordedTableCalls();
    return makeReadChain(result, recordedByTable[table]);
  });
  return { client: { from: fromSpy } as unknown as SupabaseClient, recordedByTable };
}

/** Raw `attendance` DB row shape exactly as `attendance.ts`'s own
 * `AttendanceDbRow` expects it (snake_case) -- `endMeeting.test.ts`'s own
 * `makeAttendanceDbRow` precedent, `status` widened to `string` here so a
 * fixture can carry the `'unmarked'` sentinel itself (criterion 4). */
function makeAttendanceDbRow(overrides: {
  session_id: string;
  student_id: string;
  status: string;
}): Record<string, unknown> {
  return {
    id: `attendance-${overrides.session_id}-${overrides.student_id}`,
    session_id: overrides.session_id,
    student_id: overrides.student_id,
    status: overrides.status,
    check_in_at: null,
    check_out_at: null,
    hours_override: null,
    method: 'coach',
    recorded_by: null,
    updated_at: '2026-08-01T00:00:00.000Z',
    created_at: '2026-08-01T00:00:00.000Z',
  };
}

describe('sessionRoster', () => {
  it('criterion 1: exports makeLoadSessionRoster, loadSessionRoster and LoadSessionRosterFn, with an injectable getClient', () => {
    expect(typeof makeLoadSessionRoster).toBe('function');
    expect(typeof loadSessionRoster).toBe('function');
    // Injectable -- calling with an explicit `getClient` produces a function
    // without ever invoking it (so this needs no real/stubbed transport at
    // all -- `getClient` is only called lazily, inside the returned
    // function, same discipline `createLoader` itself documents).
    const injected: LoadSessionRosterFn = makeLoadSessionRoster(() => {
      throw new Error('getClient should not be called just by constructing the loader');
    });
    expect(typeof injected).toBe('function');
    // Defaulting to `getSupabaseClient` -- calling with zero args must not
    // throw synchronously (the default param is merely referenced, not
    // invoked, until the returned function itself is called).
    expect(typeof makeLoadSessionRoster()).toBe('function');
  });

  it('criterion 2: the returned map has one key per session id of the event, including a session with zero attendance rows', async () => {
    const { client } = makeRecordingClient({
      events: { data: { id: 'event-2', team_ids: null }, error: null },
      event_sessions: {
        data: [{ id: 'session-2a' }, { id: 'session-2b' }],
        error: null,
      },
      students: {
        data: [{ id: 'student-2', display_name: 'Ada Lovelace', team_id: 'team-x' }],
        error: null,
      },
      attendance: {
        data: [
          makeAttendanceDbRow({
            session_id: 'session-2a',
            student_id: 'student-2',
            status: 'present',
          }),
        ],
        error: null,
      },
    });
    const load = makeLoadSessionRoster(() => client);

    const roster = await load('event-2');

    expect(roster.size).toBe(2);
    expect(roster.has('session-2a')).toBe(true);
    // `session-2b` has zero attendance rows -- it must still be a key, per
    // worker packet §7 step 6.
    expect(roster.has('session-2b')).toBe(true);
  });

  it('criterion 3: a student with no attendance row for a session appears in that session with status: null', async () => {
    const { client } = makeRecordingClient({
      events: { data: { id: 'event-3', team_ids: null }, error: null },
      event_sessions: { data: [{ id: 'session-3' }], error: null },
      students: {
        data: [{ id: 'student-3', display_name: 'Ada Lovelace', team_id: 'team-x' }],
        error: null,
      },
      attendance: { data: [], error: null },
    });
    const load = makeLoadSessionRoster(() => client);

    const roster = await load('event-3');

    const entries = roster.get('session-3');
    expect(entries).toEqual([{ studentId: 'student-3', displayName: 'Ada L.', status: null }]);
  });

  // The finding that decides this packet's correctness (worker packet §3).
  // The named mutation deletes the `'unmarked'` guard in `sessionRoster.ts`
  // so the sentinel maps straight through -- this test must go red, naming
  // `'unmarked'` where `null` was expected, when that guard is removed.
  it("criterion 4 (BLOCKER, §3): a student whose attendance row has status 'unmarked' appears with status: null, not 'unmarked'", async () => {
    const { client } = makeRecordingClient({
      events: { data: { id: 'event-4', team_ids: null }, error: null },
      event_sessions: { data: [{ id: 'session-4' }], error: null },
      students: {
        data: [{ id: 'student-4', display_name: 'Ada Lovelace', team_id: 'team-x' }],
        error: null,
      },
      attendance: {
        data: [
          makeAttendanceDbRow({
            session_id: 'session-4',
            student_id: 'student-4',
            status: UNMARKED_DB_STATUS,
          }),
        ],
        error: null,
      },
    });
    const load = makeLoadSessionRoster(() => client);

    const roster = await load('event-4');

    const entry = roster.get('session-4')?.find((e) => e.studentId === 'student-4');
    expect(entry?.status).toBe(null);
    expect(entry?.status).not.toBe('unmarked');
  });

  it("criterion 5: a student with a real attendance row appears with that exact 'present' | 'late' | 'excused' | 'absent' status", async () => {
    const { client } = makeRecordingClient({
      events: { data: { id: 'event-5', team_ids: null }, error: null },
      event_sessions: { data: [{ id: 'session-5' }], error: null },
      students: {
        data: [{ id: 'student-5', display_name: 'Ada Lovelace', team_id: 'team-x' }],
        error: null,
      },
      attendance: {
        data: [
          makeAttendanceDbRow({ session_id: 'session-5', student_id: 'student-5', status: 'late' }),
        ],
        error: null,
      },
    });
    const load = makeLoadSessionRoster(() => client);

    const roster = await load('event-5');

    const entry = roster.get('session-5')?.find((e) => e.studentId === 'student-5');
    expect(entry?.status).toBe('late');
  });

  it('criterion 6: team_ids scopes to only that team; team_ids: null includes every active student; the students query is filtered server-side via a recorded .eq(is_active, true) call', async () => {
    const scoped = makeRecordingClient({
      events: { data: { id: 'event-6a', team_ids: ['team-a'] }, error: null },
      event_sessions: { data: [{ id: 'session-6a' }], error: null },
      students: {
        data: [
          { id: 'student-a', display_name: 'Team A Student', team_id: 'team-a' },
          { id: 'student-b', display_name: 'Team B Student', team_id: 'team-b' },
        ],
        error: null,
      },
      attendance: { data: [], error: null },
    });
    const loadScoped = makeLoadSessionRoster(() => scoped.client);

    const scopedRoster = await loadScoped('event-6a');

    expect(scopedRoster.get('session-6a')?.map((e) => e.studentId)).toEqual(['student-a']);
    // Argument-provable only (`endMeeting.test.ts`'s own criterion-3
    // disclosure) -- a stub client does no real server-side filtering.
    expect(scoped.recordedByTable.students.eqArgs).toContainEqual(['is_active', true]);

    const open = makeRecordingClient({
      events: { data: { id: 'event-6b', team_ids: null }, error: null },
      event_sessions: { data: [{ id: 'session-6b' }], error: null },
      students: {
        data: [
          { id: 'student-a', display_name: 'Team A Student', team_id: 'team-a' },
          { id: 'student-b', display_name: 'Team B Student', team_id: 'team-b' },
        ],
        error: null,
      },
      attendance: { data: [], error: null },
    });
    const loadOpen = makeLoadSessionRoster(() => open.client);

    const openRoster = await loadOpen('event-6b');

    expect(
      openRoster
        .get('session-6b')
        ?.map((e) => e.studentId)
        .sort(),
    ).toEqual(['student-a', 'student-b']);
  });

  it('criterion 7 (BLOCKER, constitution item 6): no displayName contains a full last name -- "Jordan Rivera" -> "Jordan R.", "Cher" -> "Cher", "" -> "Student"', async () => {
    const { client } = makeRecordingClient({
      events: { data: { id: 'event-7', team_ids: null }, error: null },
      event_sessions: { data: [{ id: 'session-7' }], error: null },
      students: {
        data: [
          { id: 'student-jordan', display_name: 'Jordan Rivera', team_id: 'team-x' },
          { id: 'student-cher', display_name: 'Cher', team_id: 'team-x' },
          { id: 'student-blank', display_name: '', team_id: 'team-x' },
        ],
        error: null,
      },
      attendance: { data: [], error: null },
    });
    const load = makeLoadSessionRoster(() => client);

    const roster = await load('event-7');

    const byStudentId = new Map(
      (roster.get('session-7') ?? []).map((e) => [e.studentId, e.displayName] as const),
    );
    expect(byStudentId.get('student-jordan')).toBe('Jordan R.');
    expect(byStudentId.get('student-cher')).toBe('Cher');
    expect(byStudentId.get('student-blank')).toBe('Student');
    // Grep-provable-in-spirit: none of the rendered names contain the full
    // "Rivera" last name.
    for (const name of byStudentId.values()) {
      expect(name).not.toContain('Rivera');
    }
  });

  it('criterion 8: an event with zero sessions resolves an empty map without throwing, and issues no students/attendance query', async () => {
    const { client } = makeRecordingClient({
      events: { data: { id: 'event-8', team_ids: null }, error: null },
      event_sessions: { data: [], error: null },
      // Deliberately no `students`/`attendance` entries -- `makeRecordingClient`
      // throws on an unexpected table, so this also proves neither query is
      // issued for a sessionless event (worker packet §7 step 2).
    });
    const load = makeLoadSessionRoster(() => client);

    await expect(load('event-8')).resolves.toEqual(new Map());
  });

  it('criterion 9: an unknown eventId rejects with a plain Error naming the id', async () => {
    const { client } = makeRecordingClient({
      events: { data: null, error: null },
    });
    const load = makeLoadSessionRoster(() => client);

    await expect(load('event-does-not-exist')).rejects.toThrow(/event-does-not-exist/);
  });

  // Worker packet §7a step 9 -- stable ordering (`SessionRow.tsx`'s roving
  // `focusedRowIndex` is positional), not a separately numbered §8
  // criterion but directly specified behavior.
  it("orders each session's entries by displayName then studentId", async () => {
    const { client } = makeRecordingClient({
      events: { data: { id: 'event-order', team_ids: null }, error: null },
      event_sessions: { data: [{ id: 'session-order' }], error: null },
      students: {
        data: [
          { id: 'student-z', display_name: 'Amy Zephyr', team_id: 'team-x' },
          { id: 'student-a', display_name: 'Amy Adams', team_id: 'team-x' },
        ],
        error: null,
      },
      attendance: { data: [], error: null },
    });
    const load = makeLoadSessionRoster(() => client);

    const roster = await load('event-order');

    expect(roster.get('session-order')?.map((e) => e.studentId)).toEqual([
      'student-a',
      'student-z',
    ]);
  });
});
