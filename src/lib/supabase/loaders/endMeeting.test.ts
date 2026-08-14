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
  markCalls: { upsertArgs: [unknown, unknown][] };
  checkoutCalls: { updateArgs: unknown[]; chainCalls: [string, unknown[]][] };
  flipCalls: { updateArgs: unknown[]; chainCalls: [string, unknown[]][] };
  markDeferred: Deferred<MutationResult>;
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
 * `.from('attendance')` dispatches on the METHOD called (`upsert` -> mark
 * absences, `update` -> checkout), not on call order -- this also makes the
 * criterion-5 concurrent-mutation proof step (running the old
 * `Promise.all`-based implementation against this same client) route each
 * call to the correct recorder regardless of dispatch order.
 */
function makeMutationRecordingClient(): MutationRecordingSetup {
  const markDeferred = makeDeferred<MutationResult>();
  const checkoutDeferred = makeDeferred<MutationResult>();
  const flipDeferred = makeDeferred<MutationResult>();

  const markCalls: MutationRecordingSetup['markCalls'] = { upsertArgs: [] };
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
          markCalls.upsertArgs.push([rows, opts]);
          return {
            then: (
              onFulfilled: (value: MutationResult) => unknown,
              onRejected?: (reason: unknown) => unknown,
            ) => markDeferred.promise.then(onFulfilled, onRejected),
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
    markCalls,
    checkoutCalls,
    flipCalls,
    markDeferred,
    checkoutDeferred,
    flipDeferred,
  };
}

function resolveAllMutations(setup: MutationRecordingSetup): void {
  setup.markDeferred.resolve({ data: null, error: null });
  setup.checkoutDeferred.resolve({ data: null, error: null });
  setup.flipDeferred.resolve({ data: null, error: null });
}

function chainArgsFor(chainCalls: [string, unknown[]][], method: string): unknown[][] {
  return chainCalls.filter(([m]) => m === method).map(([, args]) => args);
}

const SAMPLE_PAYLOAD: EndMeetingPayload = {
  sessionId: 'session-real-mtg',
  endsAt: '2026-07-31T02:00:00.000Z',
  markAbsentStudentIds: ['student-mark-a'],
  checkoutStudentIds: ['student-checkout-b'],
};

describe('makeOnEndMeeting', () => {
  it('criterion 5 (CORRECTED, BLOCKER 2): the three writes are truly sequenced (await-gated), not dispatched concurrently', async () => {
    const setup = makeMutationRecordingClient();
    const onEndMeeting = makeOnEndMeeting(() => setup.client);

    const resultPromise = onEndMeeting(SAMPLE_PAYLOAD);

    // Only the mark-absences call has been issued so far -- checkout's and
    // the flip's underlying client.from(...) calls have NOT happened yet.
    expect(setup.markCalls.upsertArgs).toHaveLength(1);
    expect(setup.checkoutCalls.updateArgs).toHaveLength(0);
    expect(setup.flipCalls.updateArgs).toHaveLength(0);

    setup.markDeferred.resolve({ data: null, error: null });
    await flushMicrotasks();

    expect(setup.checkoutCalls.updateArgs).toHaveLength(1);
    expect(setup.flipCalls.updateArgs).toHaveLength(0);

    setup.checkoutDeferred.resolve({ data: null, error: null });
    await flushMicrotasks();

    expect(setup.flipCalls.updateArgs).toHaveLength(1);

    setup.flipDeferred.resolve({ data: null, error: null });
    await expect(resultPromise).resolves.toBeUndefined();
  });

  it('criterion 6: mark-absences upsert shape -- one absent/coach/null row per marked student, plus onConflict + ignoreDuplicates:true', async () => {
    const setup = makeMutationRecordingClient();
    resolveAllMutations(setup);
    const onEndMeeting = makeOnEndMeeting(() => setup.client);

    await onEndMeeting(SAMPLE_PAYLOAD);

    expect(setup.markCalls.upsertArgs[0][0]).toEqual([
      {
        session_id: 'session-real-mtg',
        student_id: 'student-mark-a',
        status: 'absent',
        method: 'coach',
        recorded_by: null,
      },
    ]);
    expect(setup.markCalls.upsertArgs[0][1]).toEqual({
      onConflict: 'session_id,student_id',
      ignoreDuplicates: true,
    });
  });

  it('C1 (T508): with markAbsentStudentIds empty (box left unticked), no upsert call reaches attendance at all -- asserted at the transport, not by reading the payload object', async () => {
    const OPTED_OUT_PAYLOAD: EndMeetingPayload = {
      sessionId: 'session-opt-out-1',
      endsAt: '2026-08-05T02:00:00.000Z',
      markAbsentStudentIds: [], // the ordinary case -- checkbox left unticked.
      checkoutStudentIds: ['student-checkout-x', 'student-checkout-y'],
    };
    const setup = makeMutationRecordingClient();
    resolveAllMutations(setup);
    const onEndMeeting = makeOnEndMeeting(() => setup.client);

    await onEndMeeting(OPTED_OUT_PAYLOAD);

    // The recorded call to the fake client's own `.upsert(...)`, not the
    // payload object -- an `upsert([])` with an empty row array is still a
    // real write request against `attendance`, and this is what would catch
    // it if the `length > 0` guard were deleted.
    expect(setup.markCalls.upsertArgs).toHaveLength(0);
  });

  it('C2 (T508): the checkout and status-flip legs still run when nothing is marked absent', async () => {
    const OPTED_OUT_PAYLOAD: EndMeetingPayload = {
      sessionId: 'session-opt-out-2',
      endsAt: '2026-08-05T03:00:00.000Z',
      markAbsentStudentIds: [],
      checkoutStudentIds: ['student-checkout-p', 'student-checkout-q'],
    };
    const setup = makeMutationRecordingClient();
    resolveAllMutations(setup);
    const onEndMeeting = makeOnEndMeeting(() => setup.client);

    await onEndMeeting(OPTED_OUT_PAYLOAD);

    expect(setup.checkoutCalls.updateArgs).toHaveLength(1);
    expect(chainArgsFor(setup.checkoutCalls.chainCalls, 'in')).toContainEqual([
      'student_id',
      ['student-checkout-p', 'student-checkout-q'],
    ]);
    expect(setup.flipCalls.updateArgs).toHaveLength(1);
    expect(setup.flipCalls.updateArgs[0]).toEqual({ status: 'completed' });
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
    setup.markDeferred.resolve({ data: null, error: null });
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
    // (a) the mark-absences call was issued, (b) the checkout call was
    // issued, before the rejection.
    expect(setup.markCalls.upsertArgs).toHaveLength(1);
    expect(setup.checkoutCalls.updateArgs).toHaveLength(1);
  });

  it('criterion 10: retry after a resolved call re-issues the same three writes without throwing', async () => {
    const setup = makeMutationRecordingClient();
    resolveAllMutations(setup);
    const onEndMeeting = makeOnEndMeeting(() => setup.client);

    await expect(onEndMeeting(SAMPLE_PAYLOAD)).resolves.toBeUndefined();
    await expect(onEndMeeting(SAMPLE_PAYLOAD)).resolves.toBeUndefined();

    expect(setup.markCalls.upsertArgs).toHaveLength(2);
    expect(setup.checkoutCalls.updateArgs).toHaveLength(2);
    expect(setup.flipCalls.updateArgs).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------
// GAM-338 -- `makeOnEndMeeting` retry idempotency, outcome-provable against a
// semantic fake `attendance` table, not call-shape. Criterion 10 above (and
// criterion 5's concurrency proof) only prove no *throw* on a second call --
// they use `makeMutationRecordingClient`, which records call arguments and
// resolves whatever `MutationResult` the test hands it, so it cannot show
// what a real Postgrest server would have done to the ROW. Removing
// `ignoreDuplicates: true` (`endMeeting.ts:405`) or the `.is('check_out_at',
// null)` guard (`endMeeting.ts:417`) leaves every existing assertion green,
// because none of them models `ON CONFLICT` or the guard's filtering
// semantics -- only what is recorded here can turn red for either mutation.
// Same "physical fake table" discipline the T197 section above already
// established for `makeOnEditAttendance`.
// ---------------------------------------------------------------------------

interface FakeEndMeetingAttendanceRow {
  session_id: string;
  student_id: string;
  status: AttendanceStatus;
  method: 'qr' | 'coach' | 'import';
  recorded_by: string | null;
  check_in_at: string | null;
  check_out_at: string | null;
}

type AttendanceFilter =
  | { type: 'eq' | 'is'; column: string; value: unknown }
  | { type: 'in'; column: string; value: unknown[] };

function rowMatchesFilters(
  row: FakeEndMeetingAttendanceRow,
  filters: AttendanceFilter[],
): boolean {
  return filters.every((filter) => {
    const cell = (row as unknown as Record<string, unknown>)[filter.column];
    return filter.type === 'in' ? filter.value.includes(cell) : cell === filter.value;
  });
}

/**
 * Models the two pieces of real Postgrest semantics this task's mutation
 * targets, against a small in-memory `attendance` table:
 *   - `.upsert(rows, { onConflict, ignoreDuplicates })` -- when a row with a
 *     matching `(session_id, student_id)` already exists, `ignoreDuplicates:
 *     true` leaves it byte-for-byte untouched (ON CONFLICT DO NOTHING); a
 *     falsy value overwrites it (what the mutation under test produces).
 *   - `.update(patch)` with chained `.eq()`/`.in()`/`.is()` -- the patch only
 *     applies to rows matching EVERY accumulated filter, so a dropped
 *     `.is('check_out_at', null)` (source-side, not modeled here) makes the
 *     filter list shorter and the row match unconditionally.
 * `event_sessions` is not modeled beyond resolving success -- neither test
 * below asserts on session status.
 */
function makeSemanticEndMeetingClient(initialAttendanceRows: FakeEndMeetingAttendanceRow[]): {
  client: SupabaseClient;
  attendanceRows: FakeEndMeetingAttendanceRow[];
} {
  const attendanceRows = initialAttendanceRows.map((row) => ({ ...row }));

  function makeUpdateChain(applyPatch: (row: FakeEndMeetingAttendanceRow) => void) {
    const filters: AttendanceFilter[] = [];
    const chain: Record<string, unknown> = {};
    chain.eq = (column: string, value: unknown) => {
      filters.push({ type: 'eq', column, value });
      return chain;
    };
    chain.in = (column: string, value: unknown[]) => {
      filters.push({ type: 'in', column, value });
      return chain;
    };
    chain.is = (column: string, value: unknown) => {
      filters.push({ type: 'is', column, value });
      return chain;
    };
    chain.then = (
      onFulfilled: (value: MutationResult) => unknown,
      onRejected?: (reason: unknown) => unknown,
    ) =>
      Promise.resolve()
        .then(() => {
          for (const row of attendanceRows) {
            if (rowMatchesFilters(row, filters)) applyPatch(row);
          }
          return { data: null, error: null } as MutationResult;
        })
        .then(onFulfilled, onRejected);
    return chain;
  }

  const fromSpy = vi.fn((table: string) => {
    if (table === 'attendance') {
      return {
        upsert: (
          rows: FakeEndMeetingAttendanceRow[],
          opts: { onConflict: string; ignoreDuplicates?: boolean },
        ) => ({
          then: (
            onFulfilled: (value: MutationResult) => unknown,
            onRejected?: (reason: unknown) => unknown,
          ) =>
            Promise.resolve()
              .then(() => {
                for (const incoming of rows) {
                  const existing = attendanceRows.find(
                    (row) =>
                      row.session_id === incoming.session_id &&
                      row.student_id === incoming.student_id,
                  );
                  if (existing) {
                    if (!opts.ignoreDuplicates) Object.assign(existing, incoming);
                    // ignoreDuplicates: true -- ON CONFLICT DO NOTHING, existing row untouched.
                  } else {
                    attendanceRows.push({ check_in_at: null, check_out_at: null, ...incoming });
                  }
                }
                return { data: null, error: null } as MutationResult;
              })
              .then(onFulfilled, onRejected),
        }),
        update: (patch: Partial<FakeEndMeetingAttendanceRow>) =>
          makeUpdateChain((row) => Object.assign(row, patch)),
      };
    }
    if (table === 'event_sessions') {
      return {
        update: () => ({
          eq: () => ({
            then: (
              onFulfilled: (value: MutationResult) => unknown,
              onRejected?: (reason: unknown) => unknown,
            ) => Promise.resolve({ data: null, error: null } as MutationResult).then(onFulfilled, onRejected),
          }),
        }),
      };
    }
    throw new Error(`unexpected table: ${table}`);
  });

  return { client: { from: fromSpy } as unknown as SupabaseClient, attendanceRows };
}

describe('makeOnEndMeeting retry idempotency (GAM-338) -- outcome-provable against a semantic fake table', () => {
  it('mutation: ignoreDuplicates:true means a retry never re-marks a student whose row was corrected in between -- ON CONFLICT DO NOTHING, not DO UPDATE', async () => {
    const { client, attendanceRows } = makeSemanticEndMeetingClient([]);
    const onEndMeeting = makeOnEndMeeting(() => client);

    // Clean run: no row exists yet for the marked student, so the upsert inserts one.
    await onEndMeeting(SAMPLE_PAYLOAD);
    expect(attendanceRows.filter((row) => row.student_id === 'student-mark-a')).toHaveLength(1);
    expect(attendanceRows.find((row) => row.student_id === 'student-mark-a')).toMatchObject({
      status: 'absent',
      method: 'coach',
      recorded_by: null,
    });

    // Between the coach's first (ambiguous) attempt and their retry, a real
    // correction lands through the edit-attendance path: the student
    // actually WAS present.
    const corrected = attendanceRows.find((row) => row.student_id === 'student-mark-a')!;
    corrected.status = 'present';
    corrected.method = 'qr';
    corrected.recorded_by = 'coach-real-9';

    // The coach retries the SAME End Meeting action.
    await onEndMeeting(SAMPLE_PAYLOAD);

    // The on-screen promise is that nothing is recorded twice -- which
    // includes not silently reverting a correction that landed in between.
    expect(attendanceRows.filter((row) => row.student_id === 'student-mark-a')).toHaveLength(1);
    expect(attendanceRows.find((row) => row.student_id === 'student-mark-a')).toMatchObject({
      status: 'present',
      method: 'qr',
      recorded_by: 'coach-real-9',
    });
  });

  it('mutation: .is(check_out_at, null) means a retry never overwrites a checkout stamp already set for a different reason', async () => {
    const { client, attendanceRows } = makeSemanticEndMeetingClient([
      {
        session_id: SAMPLE_PAYLOAD.sessionId,
        student_id: 'student-checkout-b',
        status: 'present',
        method: 'qr',
        recorded_by: null,
        check_in_at: '2026-07-31T00:05:00.000Z',
        // Already checked out for a real reason unrelated to this call --
        // distinct from SAMPLE_PAYLOAD.endsAt so an overwrite is observable.
        check_out_at: '2026-07-31T01:58:00.000Z',
      },
    ]);
    const onEndMeeting = makeOnEndMeeting(() => client);

    await onEndMeeting(SAMPLE_PAYLOAD);

    expect(attendanceRows[0].check_out_at).toBe('2026-07-31T01:58:00.000Z');
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
