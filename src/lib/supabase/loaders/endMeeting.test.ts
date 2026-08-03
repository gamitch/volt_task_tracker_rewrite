// T178 (revision 2 -- BUILD HALF ONLY): the first, and this directory's own
// only, test coverage for `src/lib/supabase/loaders/endMeeting.ts`.
// `attendance.ts` (which `endMeeting.ts` reuses via
// `makeLoadAttendanceForSessions`) has no test file of its own -- this file
// is the only proof that reuse path behaves correctly end-to-end here.
//
// No `@vitest-environment jsdom` docblock -- this file only imports loader
// logic + page TYPES (`import type`), same posture `students.test.ts`/
// `outreach.test.ts`/`parentHome.test.ts` (this directory's own existing
// test files) already established.
//
// Criteria 3 and 9 in this file are CORRECTED versions per
// `docs/swarm/active/T178-worker-packet.md` §6 (the premise gate's own
// measured findings, `T178-gate-round1-findings.md`): criterion 3 asserts
// the `.eq('is_active', true)` call ARGUMENT (server-side filters are
// argument-provable only against a stub client, never outcome-provable --
// see `endMeeting.ts`'s own module doc #3 for the full disclosure);
// criterion 9 asserts `isSupabaseLoaderError` + `.cause`, never the
// top-level `.message` (which is always the fixed DES-16 copy, never the
// injected detail -- `runMutation` normalizes every rejection through
// `toLoaderError`, `../loader.ts`).
//
// Criterion 13 (no client-side `audit_log` write anywhere in `endMeeting.ts`)
// is grep-provable and static, per the worker packet's own instruction --
// not a runtime test here; see this task's own worker output
// (`docs/swarm/active/T178-worker-output.md`) for the grep proof. The same
// packet also requires a grep proof that `makeLoadEndMeetingSummary` issues
// no SECOND, independent `attendance` query (criterion 4) -- also reported
// there, not re-encoded as a runtime assertion (this directory has no
// precedent for source-text-scanning tests).
import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it, vi } from 'vitest';
import { makeLoadEndMeetingSummary, makeOnEndMeeting, makeOnEditAttendance } from './endMeeting';
import { isSupabaseLoaderError } from '../loader';
import {
  defaultLoadEndMeetingSummary,
  type AttendanceStatus,
  type EndMeetingPayload,
} from '../../../pages/meetings/EndMeetingDialog';

// ---------------------------------------------------------------------------
// Shared test utilities.
// ---------------------------------------------------------------------------

/** Flushes the whole microtask queue -- a macrotask boundary is guaranteed
 * to run strictly after every pending microtask (the several `await`
 * hand-offs `runMutation`'s own internals + `onEndMeeting`'s own sequential
 * `await`s produce), so this is used between "resolve one deferred" and
 * "assert what happened next" throughout criterion 5's test below. */
function flushMicrotasks(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

interface Deferred<T> {
  promise: Promise<T>;
  resolve: (value: T) => void;
}

function makeDeferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

type MutationResult = { data: null; error: { message: string; code?: string } | null };

// ---------------------------------------------------------------------------
// Criteria 1-4 -- `makeLoadEndMeetingSummary`.
// ---------------------------------------------------------------------------

interface RecordedReadCalls {
  selectArgs: unknown[];
  eqArgs: [string, unknown][];
  inArgs: [string, unknown][];
}

function freshRecordedReadCalls(): RecordedReadCalls {
  return { selectArgs: [], eqArgs: [], inArgs: [] };
}

/** Same minimal-chainable-Postgrest-response-stub shape
 * `parentHome.test.ts`/`students.test.ts` (this directory's own existing
 * test files) already use: every chain method records its call and is
 * itself thenable, so both `.maybeSingle()`-terminated and bare-`.eq()`-
 * terminated queries resolve correctly regardless of which terminal method
 * (if any) the real loader calls. */
function makeSummaryReadChain(
  result: { data: unknown; error: { message: string } | null },
  recorded: RecordedReadCalls,
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
  // T320 (W1): `loaders/attendance.ts`'s `makeLoadAttendanceForSessions` --
  // which `endMeeting.ts:191` imports and reuses -- now paginates its read as
  // `.order('id').range(from, to)` so a >1000-row response is no longer
  // silently truncated by PostgREST's `max_rows`. This shared chain has to
  // accept both links. Returning `chain` (already thenable) resolves the
  // configured `result` as page 0; every fixture here is far short of a full
  // page, so the loader's loop exits after one request.
  chain.order = () => chain;
  chain.range = () => chain;
  chain.maybeSingle = () => Promise.resolve(result);
  chain.then = (
    onFulfilled: (value: typeof result) => unknown,
    onRejected?: (reason: unknown) => unknown,
  ) => Promise.resolve(result).then(onFulfilled, onRejected);
  return chain;
}

function makeSummaryRecordingClient(byTable: Record<string, { data: unknown; error: null }>): {
  client: SupabaseClient;
  recordedByTable: Record<string, RecordedReadCalls>;
} {
  const recordedByTable: Record<string, RecordedReadCalls> = {};
  const fromSpy = vi.fn((table: string) => {
    const result = byTable[table];
    if (result === undefined) {
      throw new Error(`unexpected table/view queried: ${table}`);
    }
    recordedByTable[table] = recordedByTable[table] ?? freshRecordedReadCalls();
    return makeSummaryReadChain(result, recordedByTable[table]);
  });
  return { client: { from: fromSpy } as unknown as SupabaseClient, recordedByTable };
}

/** Raw `attendance` DB row shape exactly as `attendance.ts`'s own
 * `AttendanceDbRow` expects it (snake_case) -- the injected data below is
 * only correctly mapped down to `AttendanceRecordState` if `endMeeting.ts`
 * genuinely reuses `attendance.ts`'s real `mapAttendanceDbRowToAttendanceRow`
 * (criterion 4). */
function makeAttendanceDbRow(overrides: {
  session_id: string;
  student_id: string;
  status: AttendanceStatus;
  check_in_at: string | null;
  check_out_at: string | null;
  method: 'qr' | 'coach' | 'import';
  recorded_by: string | null;
}) {
  return {
    id: `attendance-row-${overrides.student_id}`,
    hours_override: null,
    updated_at: '2026-07-31T00:00:00.000Z',
    created_at: '2026-07-31T00:00:00.000Z',
    ...overrides,
  };
}

describe('makeLoadEndMeetingSummary', () => {
  it("criterion 1: returns real, injected DB state, not the dialog's own fixture", async () => {
    const { client } = makeSummaryRecordingClient({
      event_sessions: {
        data: {
          id: 'session-real-1',
          event_id: 'event-real-1',
          ends_at: '2026-07-31T02:00:00.000Z',
          status: 'scheduled',
        },
        error: null,
      },
      events: {
        data: { id: 'event-real-1', title: 'Robotics Shop Night', team_ids: null },
        error: null,
      },
      students: { data: [], error: null },
      attendance: { data: [], error: null },
    });
    const loadSummary = makeLoadEndMeetingSummary(() => client);

    const result = await loadSummary('session-real-1');

    expect(result.session.title).toBe('Robotics Shop Night');
    expect(result.session.endsAt).toBe('2026-07-31T02:00:00.000Z');
    expect(result.session.status).toBe('scheduled');
  });

  it('criterion 1 (positive control): the same title assertion FAILS against defaultLoadEndMeetingSummary -- proves the prior test is not vacuous', async () => {
    const fixtureResult = await defaultLoadEndMeetingSummary('session-real-1');

    expect(fixtureResult.session.title).not.toBe('Robotics Shop Night');
  });

  it("criterion 2: roster is scoped client-side to the event's team_ids -- only the in-scope active student appears", async () => {
    const { client } = makeSummaryRecordingClient({
      event_sessions: {
        data: {
          id: 'session-real-2',
          event_id: 'event-real-2',
          ends_at: '2026-07-31T02:00:00.000Z',
          status: 'scheduled',
        },
        error: null,
      },
      events: {
        data: { id: 'event-real-2', title: 'Team-Scoped Meeting', team_ids: ['team-real-1'] },
        error: null,
      },
      students: {
        data: [
          { id: 'student-in-scope', display_name: 'In Scope', team_id: 'team-real-1' },
          { id: 'student-out-of-scope', display_name: 'Out Of Scope', team_id: 'team-real-2' },
        ],
        error: null,
      },
      attendance: { data: [], error: null },
    });
    const loadSummary = makeLoadEndMeetingSummary(() => client);

    const result = await loadSummary('session-real-2');

    expect(result.roster.map((entry) => entry.studentId)).toEqual(['student-in-scope']);
  });

  it('criterion 2 mutation: team_ids: null makes both the previously in-scope AND out-of-scope students appear', async () => {
    const { client } = makeSummaryRecordingClient({
      event_sessions: {
        data: {
          id: 'session-real-2b',
          event_id: 'event-real-2b',
          ends_at: '2026-07-31T02:00:00.000Z',
          status: 'scheduled',
        },
        error: null,
      },
      events: {
        data: { id: 'event-real-2b', title: 'Open Meeting', team_ids: null },
        error: null,
      },
      students: {
        data: [
          { id: 'student-in-scope', display_name: 'In Scope', team_id: 'team-real-1' },
          { id: 'student-out-of-scope', display_name: 'Out Of Scope', team_id: 'team-real-2' },
        ],
        error: null,
      },
      attendance: { data: [], error: null },
    });
    const loadSummary = makeLoadEndMeetingSummary(() => client);

    const result = await loadSummary('session-real-2b');

    expect(result.roster.map((entry) => entry.studentId).sort()).toEqual([
      'student-in-scope',
      'student-out-of-scope',
    ]);
  });

  it("criterion 3 (CORRECTED, argument-provable only): the students query is filtered server-side via a recorded .eq('is_active', true) call", async () => {
    const { client, recordedByTable } = makeSummaryRecordingClient({
      event_sessions: {
        data: {
          id: 'session-real-3',
          event_id: 'event-real-3',
          ends_at: '2026-07-31T02:00:00.000Z',
          status: 'scheduled',
        },
        error: null,
      },
      events: { data: { id: 'event-real-3', title: 'X', team_ids: null }, error: null },
      students: {
        data: [{ id: 'student-real-3', display_name: 'Real', team_id: 'team-real-1' }],
        error: null,
      },
      attendance: { data: [], error: null },
    });
    const loadSummary = makeLoadEndMeetingSummary(() => client);

    await loadSummary('session-real-3');

    // Argument-provable only -- a stub client does no real server-side
    // filtering, so this asserts the CALL, never the returned data (module
    // doc #3's own disclosure).
    expect(recordedByTable.students.eqArgs).toContainEqual(['is_active', true]);
  });

  it("criterion 4: attendanceByStudentId is populated via attendance.ts's real camelCase mapper, keyed by studentId", async () => {
    const { client } = makeSummaryRecordingClient({
      event_sessions: {
        data: {
          id: 'session-real-4',
          event_id: 'event-real-4',
          ends_at: '2026-07-31T02:00:00.000Z',
          status: 'scheduled',
        },
        error: null,
      },
      events: { data: { id: 'event-real-4', title: 'X', team_ids: null }, error: null },
      students: {
        data: [{ id: 'student-real-4', display_name: 'Real', team_id: 'team-real-1' }],
        error: null,
      },
      attendance: {
        data: [
          makeAttendanceDbRow({
            session_id: 'session-real-4',
            student_id: 'student-real-4',
            status: 'present',
            check_in_at: '2026-07-31T00:05:00.000Z',
            check_out_at: null,
            method: 'qr',
            recorded_by: 'coach-real-9',
          }),
        ],
        error: null,
      },
    });
    const loadSummary = makeLoadEndMeetingSummary(() => client);

    const result = await loadSummary('session-real-4');

    // Only reachable through attendance.ts's real mapAttendanceDbRowToAttendanceRow
    // (snake_case -> camelCase); a hand-rolled second mapper in this file
    // would have to reimplement this exact shape byte-for-byte to pass.
    expect(result.attendanceByStudentId['student-real-4']).toEqual({
      status: 'present',
      checkInAt: '2026-07-31T00:05:00.000Z',
      checkOutAt: null,
      method: 'qr',
      recordedBy: 'coach-real-9',
    });
  });
});

// ---------------------------------------------------------------------------
// Criteria 5-10, 13 -- `makeOnEndMeeting`.
// ---------------------------------------------------------------------------

interface MutationRecordingSetup {
  client: SupabaseClient;
  fromSpy: ReturnType<typeof vi.fn>;
  backfillCalls: { upsertArgs: [unknown, unknown][] };
  checkoutCalls: { updateArgs: unknown[]; chainCalls: [string, unknown[]][] };
  flipCalls: { updateArgs: unknown[]; chainCalls: [string, unknown[]][] };
  backfillDeferred: Deferred<MutationResult>;
  checkoutDeferred: Deferred<MutationResult>;
  flipDeferred: Deferred<MutationResult>;
}

/**
 * Every chain step is itself thenable (real supabase-js's own
 * `PostgrestFilterBuilder` behavior -- every intermediate builder resolves,
 * not only after a specific terminal method), so a mutation that drops a
 * guard call (criterion 7's own mutation) still resolves via whatever the
 * LAST chain method actually called returns, rather than crashing with a
 * `TypeError` -- the intended assertion is what goes red, not an unrelated
 * crash (same discipline `students.test.ts`'s own criterion-8 MINOR fix
 * established for this directory).
 *
 * `.from('attendance')` dispatches on the METHOD called (`upsert` ->
 * backfill, `update` -> checkout), not on call order -- this also makes the
 * criterion-5 concurrent-mutation proof step (running the old
 * `Promise.all`-based implementation against this same client) route each
 * call to the correct recorder regardless of dispatch order.
 */
function makeMutationRecordingClient(): MutationRecordingSetup {
  const backfillDeferred = makeDeferred<MutationResult>();
  const checkoutDeferred = makeDeferred<MutationResult>();
  const flipDeferred = makeDeferred<MutationResult>();

  const backfillCalls: MutationRecordingSetup['backfillCalls'] = { upsertArgs: [] };
  const checkoutCalls: MutationRecordingSetup['checkoutCalls'] = { updateArgs: [], chainCalls: [] };
  const flipCalls: MutationRecordingSetup['flipCalls'] = { updateArgs: [], chainCalls: [] };

  function makeThenableChain(
    deferred: Deferred<MutationResult>,
    onCall: (method: string, args: unknown[]) => void,
  ): Record<string, unknown> {
    const chain: Record<string, unknown> = {};
    for (const method of ['eq', 'in', 'is']) {
      chain[method] = (...args: unknown[]) => {
        onCall(method, args);
        return chain;
      };
    }
    chain.then = (
      onFulfilled: (value: MutationResult) => unknown,
      onRejected?: (reason: unknown) => unknown,
    ) => deferred.promise.then(onFulfilled, onRejected);
    return chain;
  }

  const fromSpy = vi.fn((table: string) => {
    if (table === 'attendance') {
      return {
        upsert: (rows: unknown, opts: unknown) => {
          backfillCalls.upsertArgs.push([rows, opts]);
          return {
            then: (
              onFulfilled: (value: MutationResult) => unknown,
              onRejected?: (reason: unknown) => unknown,
            ) => backfillDeferred.promise.then(onFulfilled, onRejected),
          };
        },
        update: (patch: unknown) => {
          checkoutCalls.updateArgs.push(patch);
          return makeThenableChain(checkoutDeferred, (method, args) =>
            checkoutCalls.chainCalls.push([method, args]),
          );
        },
      };
    }
    if (table === 'event_sessions') {
      return {
        update: (patch: unknown) => {
          flipCalls.updateArgs.push(patch);
          return makeThenableChain(flipDeferred, (method, args) =>
            flipCalls.chainCalls.push([method, args]),
          );
        },
      };
    }
    throw new Error(`unexpected table: ${table}`);
  });

  return {
    client: { from: fromSpy } as unknown as SupabaseClient,
    fromSpy,
    backfillCalls,
    checkoutCalls,
    flipCalls,
    backfillDeferred,
    checkoutDeferred,
    flipDeferred,
  };
}

function resolveAllMutations(setup: MutationRecordingSetup): void {
  setup.backfillDeferred.resolve({ data: null, error: null });
  setup.checkoutDeferred.resolve({ data: null, error: null });
  setup.flipDeferred.resolve({ data: null, error: null });
}

function chainArgsFor(chainCalls: [string, unknown[]][], method: string): unknown[][] {
  return chainCalls.filter(([m]) => m === method).map(([, args]) => args);
}

const SAMPLE_PAYLOAD: EndMeetingPayload = {
  sessionId: 'session-real-mtg',
  endsAt: '2026-07-31T02:00:00.000Z',
  backfillAbsentStudentIds: ['student-backfill-a'],
  checkoutStudentIds: ['student-checkout-b'],
};

describe('makeOnEndMeeting', () => {
  it('criterion 5 (CORRECTED, BLOCKER 2): the three writes are truly sequenced (await-gated), not dispatched concurrently', async () => {
    const setup = makeMutationRecordingClient();
    const onEndMeeting = makeOnEndMeeting(() => setup.client);

    const resultPromise = onEndMeeting(SAMPLE_PAYLOAD);

    // Only the backfill call has been issued so far -- checkout's and the
    // flip's underlying client.from(...) calls have NOT happened yet.
    expect(setup.backfillCalls.upsertArgs).toHaveLength(1);
    expect(setup.checkoutCalls.updateArgs).toHaveLength(0);
    expect(setup.flipCalls.updateArgs).toHaveLength(0);

    setup.backfillDeferred.resolve({ data: null, error: null });
    await flushMicrotasks();

    expect(setup.checkoutCalls.updateArgs).toHaveLength(1);
    expect(setup.flipCalls.updateArgs).toHaveLength(0);

    setup.checkoutDeferred.resolve({ data: null, error: null });
    await flushMicrotasks();

    expect(setup.flipCalls.updateArgs).toHaveLength(1);

    setup.flipDeferred.resolve({ data: null, error: null });
    await expect(resultPromise).resolves.toBeUndefined();
  });

  it('criterion 6: backfill upsert shape -- one absent/coach/null row per backfilled student, plus onConflict + ignoreDuplicates:true', async () => {
    const setup = makeMutationRecordingClient();
    resolveAllMutations(setup);
    const onEndMeeting = makeOnEndMeeting(() => setup.client);

    await onEndMeeting(SAMPLE_PAYLOAD);

    expect(setup.backfillCalls.upsertArgs[0][0]).toEqual([
      {
        session_id: 'session-real-mtg',
        student_id: 'student-backfill-a',
        status: 'absent',
        method: 'coach',
        recorded_by: null,
      },
    ]);
    expect(setup.backfillCalls.upsertArgs[0][1]).toEqual({
      onConflict: 'session_id,student_id',
      ignoreDuplicates: true,
    });
  });

  it('criterion 7: checkout write shape -- check_out_at: endsAt, scoped by session_id + .in(student_id), guarded .is(check_out_at, null)', async () => {
    const setup = makeMutationRecordingClient();
    resolveAllMutations(setup);
    const onEndMeeting = makeOnEndMeeting(() => setup.client);

    await onEndMeeting(SAMPLE_PAYLOAD);

    expect(setup.checkoutCalls.updateArgs[0]).toEqual({ check_out_at: '2026-07-31T02:00:00.000Z' });
    expect(chainArgsFor(setup.checkoutCalls.chainCalls, 'eq')).toContainEqual([
      'session_id',
      'session-real-mtg',
    ]);
    expect(chainArgsFor(setup.checkoutCalls.chainCalls, 'in')).toContainEqual([
      'student_id',
      ['student-checkout-b'],
    ]);
    expect(chainArgsFor(setup.checkoutCalls.chainCalls, 'is')).toContainEqual([
      'check_out_at',
      null,
    ]);
  });

  it('criterion 8: status-flip write shape -- {status: "completed"} scoped .eq("id", sessionId)', async () => {
    const setup = makeMutationRecordingClient();
    resolveAllMutations(setup);
    const onEndMeeting = makeOnEndMeeting(() => setup.client);

    await onEndMeeting(SAMPLE_PAYLOAD);

    expect(setup.flipCalls.updateArgs[0]).toEqual({ status: 'completed' });
    expect(chainArgsFor(setup.flipCalls.chainCalls, 'eq')).toContainEqual([
      'id',
      'session-real-mtg',
    ]);
  });

  it('criterion 9 (CORRECTED, MAJOR 3): rejection satisfies isSupabaseLoaderError, with the injected detail surfacing only via .cause -- never asserts the top-level .message', async () => {
    const setup = makeMutationRecordingClient();
    setup.backfillDeferred.resolve({ data: null, error: null });
    setup.checkoutDeferred.resolve({ data: null, error: null });
    setup.flipDeferred.resolve({
      data: null,
      error: { message: 'flip exploded', code: 'FLIP_FAIL' },
    });
    const onEndMeeting = makeOnEndMeeting(() => setup.client);

    let caught: unknown;
    try {
      await onEndMeeting(SAMPLE_PAYLOAD);
      throw new Error('expected onEndMeeting to reject');
    } catch (error) {
      caught = error;
    }

    expect(isSupabaseLoaderError(caught)).toBe(true);
    expect((caught as { cause: unknown }).cause).toEqual({
      message: 'flip exploded',
      code: 'FLIP_FAIL',
    });
    // (a) the backfill call was issued, (b) the checkout call was issued,
    // before the rejection.
    expect(setup.backfillCalls.upsertArgs).toHaveLength(1);
    expect(setup.checkoutCalls.updateArgs).toHaveLength(1);
  });

  it('criterion 10: retry after a resolved call re-issues the same three writes without throwing', async () => {
    const setup = makeMutationRecordingClient();
    resolveAllMutations(setup);
    const onEndMeeting = makeOnEndMeeting(() => setup.client);

    await expect(onEndMeeting(SAMPLE_PAYLOAD)).resolves.toBeUndefined();
    await expect(onEndMeeting(SAMPLE_PAYLOAD)).resolves.toBeUndefined();

    expect(setup.backfillCalls.upsertArgs).toHaveLength(2);
    expect(setup.checkoutCalls.updateArgs).toHaveLength(2);
    expect(setup.flipCalls.updateArgs).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------
// Criteria 11-12 -- `makeOnEditAttendance`.
// ---------------------------------------------------------------------------

function makeEditAttendanceRecordingClient(): {
  client: SupabaseClient;
  fromSpy: ReturnType<typeof vi.fn>;
  updateArgs: unknown[];
  eqArgs: [string, unknown][];
} {
  const updateArgs: unknown[] = [];
  const eqArgs: [string, unknown][] = [];
  const fromSpy = vi.fn((table: string) => {
    if (table !== 'attendance') {
      throw new Error(`unexpected table: ${table}`);
    }
    return {
      update: (patch: unknown) => {
        updateArgs.push(patch);
        const chain: Record<string, unknown> = {};
        chain.eq = (column: string, value: unknown) => {
          eqArgs.push([column, value]);
          return chain;
        };
        chain.then = (
          onFulfilled: (value: MutationResult) => unknown,
          onRejected?: (reason: unknown) => unknown,
        ) =>
          Promise.resolve({ data: null, error: null } as MutationResult).then(
            onFulfilled,
            onRejected,
          );
        return chain;
      },
    };
  });
  return { client: { from: fromSpy } as unknown as SupabaseClient, fromSpy, updateArgs, eqArgs };
}

describe('makeOnEditAttendance', () => {
  it('criterion 11 (CORRECTED, BLOCKER 1): reads getRecordedBy FRESH on every call of the SAME returned function, not baked at construction', async () => {
    const ids = ['coach-real-id-1', 'coach-real-id-2'];
    let callIndex = 0;
    const getRecordedBy = () => ids[callIndex++] ?? null;
    const { client, updateArgs } = makeEditAttendanceRecordingClient();
    const onEditAttendance = makeOnEditAttendance(getRecordedBy, () => client);

    await onEditAttendance('session-real-11', 'student-real-11a', 'present');
    await onEditAttendance('session-real-11', 'student-real-11b', 'late');

    expect(updateArgs[0]).toMatchObject({ recorded_by: 'coach-real-id-1' });
    expect(updateArgs[1]).toMatchObject({ recorded_by: 'coach-real-id-2' });
  });

  it('criterion 12: null identity rejects before any network call', async () => {
    const { client, fromSpy } = makeEditAttendanceRecordingClient();
    const onEditAttendance = makeOnEditAttendance(
      () => null,
      () => client,
    );

    await expect(
      onEditAttendance('session-real-12', 'student-real-12', 'absent'),
    ).rejects.toBeTruthy();
    expect(fromSpy).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// T197 -- `editAttendance`'s chained `.eq('session_id', ...).eq('student_id',
// ...)` row scoping, outcome-provable, NOT call-shape. A spy assertion like
// `expect(eqArgs).toContainEqual(['session_id', ...])` (the shape criteria
// 11/12 above already use for OTHER properties) proves the call was made; it
// does NOT prove the scoping worked -- this repo has shipped 7+ assertions
// that passed for the wrong reason. Copies T402's own C2 pattern
// (`docs/swarm/verification-log.md`, T402 entry): a fake whose PHYSICAL row
// behaviour makes the defect observable. `.update()`'s patch here is applied
// to whichever accumulated `.eq()` filters actually select against a small
// fake `attendance` table, so a dropped filter is provable by which row(s)
// changed, not by which method was called. (An empty filter list matches
// EVERY row -- `Array.prototype.every` on `[]` is vacuously `true` -- which
// is exactly what a real, unfiltered Postgrest `.update()` does against a
// real table: this is what makes the "delete both `.eq()`s" mutation
// observable as a table-wide write, not merely a crash.)
// ---------------------------------------------------------------------------

interface FakeAttendanceRow {
  session_id: string;
  student_id: string;
  status: AttendanceStatus;
  recorded_by: string | null;
}

function freshFakeAttendanceRows(): FakeAttendanceRow[] {
  // Two sessions x two students -- the packet's own bar (worker packet §4):
  // "at least two sessions and at least two students". `session-A`/
  // `student-1` is the row the test edits; the other three are same-student-
  // different-session, same-session-different-student, and neither-matches
  // controls -- each one is the specific row a dropped `.eq()` would also
  // touch.
  return [
    { session_id: 'session-A', student_id: 'student-1', status: 'absent', recorded_by: null },
    { session_id: 'session-A', student_id: 'student-2', status: 'absent', recorded_by: null },
    { session_id: 'session-B', student_id: 'student-1', status: 'absent', recorded_by: null },
    { session_id: 'session-B', student_id: 'student-2', status: 'absent', recorded_by: null },
  ];
}

function makeAttendanceRowFakeClient(initialRows: FakeAttendanceRow[]): {
  client: SupabaseClient;
  rows: FakeAttendanceRow[];
} {
  const rows: FakeAttendanceRow[] = initialRows.map((row) => ({ ...row }));
  const fromSpy = vi.fn((table: string) => {
    if (table !== 'attendance') {
      throw new Error(`unexpected table: ${table}`);
    }
    return {
      update: (patch: { status: AttendanceStatus; recorded_by: string }) => {
        // Filters accumulate as `.eq()` is chained -- by the time `.then()`
        // is actually invoked (awaited), every `.eq()` in the real chain has
        // already run synchronously, so this closure sees the complete set.
        const filters: [string, unknown][] = [];
        const chain: Record<string, unknown> = {};
        chain.eq = (column: string, value: unknown) => {
          filters.push([column, value]);
          return chain;
        };
        chain.then = (
          onFulfilled: (value: MutationResult) => unknown,
          onRejected?: (reason: unknown) => unknown,
        ) => {
          for (const row of rows) {
            const matches = filters.every(
              ([column, value]) => (row as unknown as Record<string, unknown>)[column] === value,
            );
            if (matches) {
              row.status = patch.status;
              row.recorded_by = patch.recorded_by;
            }
          }
          return Promise.resolve({ data: null, error: null } as MutationResult).then(
            onFulfilled,
            onRejected,
          );
        };
        return chain;
      },
    };
  });
  return { client: { from: fromSpy } as unknown as SupabaseClient, rows };
}

describe('makeOnEditAttendance row scoping (T197) -- outcome-provable, not call-shape', () => {
  it('C1 (session scoping) + C2 (student scoping) + C3 (both together): editing (session-A, student-1) changes ONLY that physical row -- the same-student/different-session row, the same-session/different-student row, and the row matching neither stay exactly as they were', async () => {
    const { client, rows } = makeAttendanceRowFakeClient(freshFakeAttendanceRows());
    const onEditAttendance = makeOnEditAttendance(
      () => 'coach-197',
      () => client,
    );

    await onEditAttendance('session-A', 'student-1', 'present');

    // With BOTH `.eq()`s present (the real/unmutated code), exactly the
    // target row changes; every other row is byte-identical to its initial
    // state.
    expect(rows).toEqual([
      {
        session_id: 'session-A',
        student_id: 'student-1',
        status: 'present',
        recorded_by: 'coach-197',
      },
      // C2's own proof row: same session (session-A) as the target,
      // DIFFERENT student. Deleting `.eq('student_id', ...)` leaves only the
      // session_id filter, which matches this row too (both rows have
      // session_id === 'session-A') -- so under that mutation this row
      // wrongly flips to 'present'/'coach-197' and this assertion reddens.
      { session_id: 'session-A', student_id: 'student-2', status: 'absent', recorded_by: null },
      // C1's own proof row: same student (student-1) as the target,
      // DIFFERENT session. Deleting `.eq('session_id', ...)` leaves only the
      // student_id filter, which matches this row too (both rows have
      // student_id === 'student-1') -- so under that mutation this row
      // wrongly flips to 'present'/'coach-197' and this assertion reddens.
      { session_id: 'session-B', student_id: 'student-1', status: 'absent', recorded_by: null },
      // Matches neither the target session nor the target student -- stays
      // untouched under either single-`.eq()`-deletion mutation, and only
      // reddens under the "delete both `.eq()`s" (C3) mutation, where an
      // empty filter list matches every row unconditionally.
      { session_id: 'session-B', student_id: 'student-2', status: 'absent', recorded_by: null },
    ]);
  });

  // T197 checker NIT-1, closed in-branch. The single-scenario test above is
  // green under a mutation that HARDCODES both filter values to this fixture's
  // own literals (`.eq('session_id', 'session-A').eq('student_id', 'student-1')`,
  // ignoring `args`) -- so on its own it does not prove the filters are
  // args-DERIVED, only that two filters of the right shape are applied. The
  // plausible production form of that defect (a wrong arg threaded through, e.g.
  // `.eq('student_id', args.sessionId)`) IS caught by the test above. This
  // second scenario closes the remaining shape: it targets a DIFFERENT
  // (session, student) pair, so any filter pinned to `session-A`/`student-1`
  // now matches the wrong rows -- or none -- and reddens.
  it('the filter VALUES are derived from arguments, not pinned to one fixture: editing (session-B, student-2) moves that row and only that row', async () => {
    const { client, rows } = makeAttendanceRowFakeClient(freshFakeAttendanceRows());
    const onEditAttendance = makeOnEditAttendance(
      () => 'coach-197',
      () => client,
    );

    await onEditAttendance('session-B', 'student-2', 'late');

    expect(rows).toEqual([
      // Untouched: this is the row the FIRST scenario targets. If either filter
      // were hardcoded to `session-A`/`student-1`, this row would wrongly move.
      { session_id: 'session-A', student_id: 'student-1', status: 'absent', recorded_by: null },
      { session_id: 'session-A', student_id: 'student-2', status: 'absent', recorded_by: null },
      { session_id: 'session-B', student_id: 'student-1', status: 'absent', recorded_by: null },
      // The only row that may change, and it carries the distinct 'late'
      // status so a cross-test copy/paste cannot accidentally satisfy this.
      {
        session_id: 'session-B',
        student_id: 'student-2',
        status: 'late',
        recorded_by: 'coach-197',
      },
    ]);
  });
});
