// T176: the first test in `src/lib/supabase/loaders/students.ts`. Scoped to
// the ONE new function this task adds (`makeResolveStudentScope`/
// `resolveStudentScope`) -- this is NOT a full coverage sweep of
// `loaders/students.ts` (no ledger row currently claims that broader scope;
// `queryStudents`/`makeLoadStudentsTabData`/`setStudentActive`/
// `createStudent`/`updateStudent` remain untested by this file, same as
// before this task).
//
// T176 round 2 (coordinator correction): this file's own read moved from
// the raw `students` table to `v_student_goal_projection`
// (`supabase/migrations/20260723000001_dashboard_views.sql:322-334`), which
// already computes `goal_hours` (`coalesce(goal_hours_override, season
// default_goal_hours)`) in SQL -- see `students.ts`'s own module doc for
// the full record. Every assertion below was rewritten for the new table
// name and column set; the criterion-8 filter-guard technique (MINOR fix)
// is preserved unchanged, just re-scoped to `student_id`.
//
// No `@vitest-environment jsdom` docblock -- `students.ts` only imports page
// types (`import type`), so this exercises pure loader logic in vitest's
// default node environment, same posture `outreach.test.ts` (this
// directory's own first test file, T146) already established.
import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it, vi } from 'vitest';
import {
  aggregateStudentHomeParticipation,
  makeCreateStudent,
  makeLoadStudentHomeData,
  makeResolveStudentIsActive,
  makeResolveStudentScope,
  makeUpdateStudent,
} from './students';

/**
 * Records `.select()`/`.eq()`/`.maybeSingle()` for the
 * `v_student_goal_projection` view, AND (T187) `.select()`/`.eq()`/`.is()`
 * for the new `student_teams` ACTIVE-membership read `makeResolveStudentScope`
 * now also issues (`students.ts`'s own module doc: sequential, only after a
 * non-null `v_student_goal_projection` row).
 *
 * Criterion 8's own MINOR fix (T176-gate-round1-findings.md): `maybeSingle`
 * is exposed at BOTH the filtered chain position (after `.eq(...)`) AND
 * directly on the `.select(...)` result -- so a mutation that drops the
 * `.eq('student_id', studentId)` filter still resolves (via the SAME
 * `maybeSingleSpy`) rather than throwing a misdirecting
 * `TypeError: ...maybeSingle is not a function`. That means the mutation's
 * failure genuinely comes from the intended `eqSpy` assertion going red,
 * not from an unrelated crash -- verified directly below (`it('the eq-drop
 * mutation fails on the intended assertion, not a TypeError' ...`).
 *
 * `activeTeamIds` (T187, new second parameter) defaults to `row ? [row.team_id]
 * : []` -- when a caller supplies only `row`, the fake `student_teams` table
 * mirrors the single legacy `team_id` as that student's one ACTIVE
 * membership, preserving every pre-existing single-team test's own behavior
 * unchanged (real production backfill precedent: one membership row per
 * legacy `team_id`).
 */
function makeRecordingClient(
  row: {
    team_id: string;
    goal_hours: number;
    confirmed_hours: number;
    planned_hours: number;
  } | null,
  activeTeamIds: string[] = row ? [row.team_id] : [],
) {
  const maybeSingleSpy = vi.fn().mockResolvedValue({ data: row, error: null });
  const eqSpy = vi.fn(() => ({ maybeSingle: maybeSingleSpy }));
  const selectSpy = vi.fn(() => ({ eq: eqSpy, maybeSingle: maybeSingleSpy }));

  // T187 -- `student_teams` fake chain: `.select('team_id')
  // .eq('student_id', id).is('left_on', null)`. `resolveActiveRows` is the
  // ONE underlying resolver both the real `.is(...)` terminal call AND the
  // `.eq(...)` stage's own `.then` (below) share -- mirrors real
  // `supabase-js` PostgrestFilterBuilder, where EVERY chain stage is itself
  // directly awaitable, not just the one this loader happens to call last.
  // That `.then` is what lets the criterion-3 "is-drop" mutation proof below
  // resolve without a `TypeError` when `.is(...)` is genuinely never called,
  // the same "mutation fails on the intended spy, not a crash" shape
  // `eqSpy`'s own eq-drop proof above already established -- calling it does
  // NOT itself count as calling `isSpy` (the tracked mock), so that proof's
  // own `expect(isSpy).not.toHaveBeenCalled()` stays meaningful.
  function resolveActiveRows(): Promise<{ data: { team_id: string }[]; error: null }> {
    return Promise.resolve({
      data: activeTeamIds.map((teamId) => ({ team_id: teamId })),
      error: null,
    });
  }
  const isSpy = vi.fn(() => resolveActiveRows());
  const teamsEqSpy = vi.fn(() => ({
    is: isSpy,
    then: (
      onFulfilled: (value: { data: { team_id: string }[]; error: null }) => unknown,
      onRejected?: (reason: unknown) => unknown,
    ) => resolveActiveRows().then(onFulfilled, onRejected),
  }));
  const teamsSelectSpy = vi.fn(() => ({ eq: teamsEqSpy }));

  const fromSpy = vi.fn((table: string) => {
    if (table === 'v_student_goal_projection') return { select: selectSpy };
    if (table === 'student_teams') return { select: teamsSelectSpy };
    throw new Error(`unexpected table: ${table}`);
  });
  return {
    client: { from: fromSpy } as unknown as SupabaseClient,
    fromSpy,
    selectSpy,
    eqSpy,
    maybeSingleSpy,
    teamsSelectSpy,
    teamsEqSpy,
    isSpy,
  };
}

describe('makeResolveStudentScope (T176 criterion 8, round 2: v_student_goal_projection)', () => {
  it("reads v_student_goal_projection, scoped by exactly .eq('student_id', studentId)", async () => {
    const { client, fromSpy, selectSpy, eqSpy } = makeRecordingClient({
      team_id: 'team-real-1',
      goal_hours: 100,
      confirmed_hours: 0,
      planned_hours: 0,
    });
    const resolveStudentScope = makeResolveStudentScope(() => client);

    await resolveStudentScope('student-real-1');

    expect(fromSpy).toHaveBeenCalledWith('v_student_goal_projection');
    expect(selectSpy).toHaveBeenCalledTimes(1);
    expect(eqSpy).toHaveBeenCalledTimes(1);
    expect(eqSpy).toHaveBeenCalledWith('student_id', 'student-real-1');
  });

  it('maps goal_hours/confirmed_hours/planned_hours to goalHours/confirmedHours/plannedHours (camelCase, verbatim -- no coalesce/arithmetic here; T802 removed the team_id passthrough)', async () => {
    const { client } = makeRecordingClient({
      team_id: 'team-real-2',
      goal_hours: 42,
      confirmed_hours: 10,
      planned_hours: 3,
    });
    const resolveStudentScope = makeResolveStudentScope(() => client);

    await expect(resolveStudentScope('student-real-2')).resolves.toEqual({
      teamIds: ['team-real-2'],
      goalHours: 42,
      confirmedHours: 10,
      plannedHours: 3,
    });
  });

  it('preserves the real goal_hours value verbatim, including when it differs from any hypothetical season default (proves no independent coalesce is applied here)', async () => {
    const { client } = makeRecordingClient({
      team_id: 'team-real-3',
      goal_hours: 7,
      confirmed_hours: 0,
      planned_hours: 0,
    });
    const resolveStudentScope = makeResolveStudentScope(() => client);

    await expect(resolveStudentScope('student-real-3')).resolves.toEqual({
      teamIds: ['team-real-3'],
      goalHours: 7,
      confirmedHours: 0,
      plannedHours: 0,
    });
  });

  it('resolves null (never throws) when no row is found (.maybeSingle()\'s own "no rows" outcome -- e.g. an inactive student)', async () => {
    const { client } = makeRecordingClient(null);
    const resolveStudentScope = makeResolveStudentScope(() => client);

    await expect(resolveStudentScope('student-does-not-exist')).resolves.toBeNull();
  });

  it('filters server-side by the REAL supplied studentId, never a hardcoded or omitted one (defense in depth on top of own_or_linked_read RLS)', async () => {
    const { client, eqSpy } = makeRecordingClient(null);
    const resolveStudentScope = makeResolveStudentScope(() => client);

    await resolveStudentScope('student-somebody-else');

    expect(eqSpy).toHaveBeenCalledTimes(1);
    expect(eqSpy).toHaveBeenCalledWith('student_id', 'student-somebody-else');
  });

  /**
   * Criterion 8's own mutation: drop the `.eq('student_id', studentId)`
   * filter (simulated here directly, not by editing the loader) to confirm
   * the intended guard assertion is genuinely what goes red -- not a
   * `TypeError` from a stub that doesn't expose `maybeSingle` on the
   * unfiltered chain position. Mirrors T157's own checker filter-guard
   * technique. This exact mutation was ALSO applied directly to the real
   * loader (`queryStudentGoalProjectionById` in `students.ts`) and run,
   * per item 23/the worker output's own mutation-evidence record -- this
   * test additionally documents, in isolation, why the failure mode is the
   * intended one and not a crash.
   */
  it('the eq-drop mutation fails on the intended eqSpy assertion, not a TypeError (MINOR fix verification)', async () => {
    const { client, eqSpy, maybeSingleSpy } = makeRecordingClient({
      team_id: 'team-real-4',
      goal_hours: 100,
      confirmed_hours: 0,
      planned_hours: 0,
    });
    // Simulates the mutated query:
    // `.from('v_student_goal_projection').select(...).maybeSingle()` --
    // `.eq(...)` genuinely never called.
    const mutatedResult = await (
      client.from('v_student_goal_projection') as unknown as { select: () => unknown }
    ).select();
    const mutatedRow = await (
      mutatedResult as { maybeSingle: () => Promise<unknown> }
    ).maybeSingle();

    expect(mutatedRow).toEqual({
      data: { team_id: 'team-real-4', goal_hours: 100, confirmed_hours: 0, planned_hours: 0 },
      error: null,
    });
    expect(maybeSingleSpy).toHaveBeenCalledTimes(1);
    // The intended guard: eqSpy was never called under the mutated path.
    expect(eqSpy).not.toHaveBeenCalled();
  });
});

/**
 * T187 (acceptance criterion 3) -- the read is scoped to ACTIVE
 * `student_teams` memberships. Query-shape spy form (not a fixture-visibility
 * test): every fake client in this repo returns configured rows regardless
 * of chained filters, so a left-team fixture would still "appear" and a
 * dropped `.is('left_on', null)` filter would leave a fixture-only test
 * green -- the spy on the ARGUMENTS a mutated call site would still make (or
 * fail to make) is what actually turns red. Precedent for this exact form:
 * `makeResolveStudentScope`'s own `eqSpy` assertions above
 * (`students.test.ts:104-107`/`:151-159`).
 */
describe('makeResolveStudentScope (T187: ACTIVE student_teams memberships)', () => {
  it("reads student_teams scoped by exactly .eq('student_id', studentId).is('left_on', null)", async () => {
    const { client, teamsSelectSpy, teamsEqSpy, isSpy } = makeRecordingClient(
      { team_id: 'team-real-5', goal_hours: 10, confirmed_hours: 1, planned_hours: 0 },
      ['team-real-5', 'team-second-5'],
    );
    const resolveStudentScope = makeResolveStudentScope(() => client);

    await resolveStudentScope('student-real-5');

    expect(teamsSelectSpy).toHaveBeenCalledWith('team_id');
    expect(teamsEqSpy).toHaveBeenCalledTimes(1);
    expect(teamsEqSpy).toHaveBeenCalledWith('student_id', 'student-real-5');
    expect(isSpy).toHaveBeenCalledTimes(1);
    expect(isSpy).toHaveBeenCalledWith('left_on', null);
  });

  it('maps every active team_id row to StudentScope.teamIds, a real dual-team student resolves BOTH ids -- never collapsed to one', async () => {
    const { client } = makeRecordingClient(
      { team_id: 'team-primary-6', goal_hours: 10, confirmed_hours: 1, planned_hours: 0 },
      ['team-primary-6', 'team-second-6'],
    );
    const resolveStudentScope = makeResolveStudentScope(() => client);

    await expect(resolveStudentScope('student-dual-6')).resolves.toEqual({
      teamIds: ['team-primary-6', 'team-second-6'],
      goalHours: 10,
      confirmedHours: 1,
      plannedHours: 0,
    });
  });

  it('resolves an empty teamIds (never a crash) for a student with genuinely zero active memberships', async () => {
    const { client } = makeRecordingClient(
      { team_id: 'team-real-7', goal_hours: 10, confirmed_hours: 1, planned_hours: 0 },
      [],
    );
    const resolveStudentScope = makeResolveStudentScope(() => client);

    await expect(resolveStudentScope('student-real-7')).resolves.toEqual({
      teamIds: [],
      goalHours: 10,
      confirmedHours: 1,
      plannedHours: 0,
    });
  });

  it("never queries student_teams at all when v_student_goal_projection resolves no row (sequential fetch, module doc's own disclosed efficiency decision)", async () => {
    const { client, fromSpy } = makeRecordingClient(null);
    const resolveStudentScope = makeResolveStudentScope(() => client);

    await expect(resolveStudentScope('student-inactive-8')).resolves.toBeNull();

    expect(fromSpy).not.toHaveBeenCalledWith('student_teams');
  });

  /**
   * Criterion 3's own mutation: drop the `.is('left_on', null)` filter
   * (simulated here directly, not by editing the loader) to confirm the
   * intended guard assertion is genuinely what goes red -- same
   * filter-guard technique as `makeResolveStudentScope`'s own `eqSpy`
   * eq-drop proof above (`students.test.ts:175-199`). This exact mutation
   * (deleting `.is('left_on', null)` from `queryActiveTeamIdsByStudentId` in
   * `students.ts`) was ALSO applied directly to the real loader and run, per
   * item 23/this task's own worker output mutation-evidence record.
   */
  it('the is-drop mutation fails on the intended isSpy assertion, not a TypeError', async () => {
    const { client, teamsEqSpy, isSpy } = makeRecordingClient(
      { team_id: 'team-real-9', goal_hours: 10, confirmed_hours: 1, planned_hours: 0 },
      ['team-real-9'],
    );
    // Simulates the mutated query:
    // `.from('student_teams').select('team_id').eq('student_id', id)` --
    // `.is(...)` genuinely never called, and the raw (still-unfiltered by
    // left_on) row list is returned as-is.
    const mutatedResult = await (
      client.from('student_teams') as unknown as { select: (columns: string) => unknown }
    ).select('team_id');
    const mutatedFiltered = await (
      mutatedResult as { eq: (column: string, value: string) => Promise<unknown> }
    ).eq('student_id', 'student-real-9');

    expect(mutatedFiltered).toEqual({
      data: [{ team_id: 'team-real-9' }],
      error: null,
    });
    expect(teamsEqSpy).toHaveBeenCalledTimes(1);
    // The intended guard: isSpy was never called under the mutated path.
    expect(isSpy).not.toHaveBeenCalled();
  });
});

/**
 * T183 -- new tests for `makeLoadStudentHomeData`/`loadStudentHomeData`,
 * mirroring the `makeResolveStudentScope` describe block above but for the
 * raw `students` table (`.eq('id', studentId)`, not the view's own
 * `student_id`).
 *
 * T199 EXTENSION. `makeLoadStudentHomeData` now reads four tables, so this
 * harness has to know all four. The `students` branch is byte-unchanged and
 * still owns `selectSpy`/`eqSpy`/`maybeSingleSpy` EXCLUSIVELY -- every T183
 * assertion above (`selectSpy` called once, `eqSpy` called once) still means
 * what it meant, and the eq-drop mutation test still gets a non-thenable
 * chain to walk. The three new branches carry their own recorded args.
 *
 * Teaching it the new tables is not optional bookkeeping: the old dispatcher
 * threw `unexpected table` for anything but `students`, and a throw there
 * would surface as a rejected `loadStudentHomeData` -- which is EXACTLY what
 * the row-not-found test asserts. It would have passed for the wrong reason.
 * That masking is the same trap T198 hit and `coachHome.test.ts` documents.
 *
 * Filter arguments are RETAINED rather than rebuilt inline (T163's lesson,
 * `reports.test.ts`'s module doc): a passthrough fake returns the same rows
 * whatever it is filtered on, so only the recorded arguments can prove a
 * filter is still there.
 */
interface StudentHomeTableRows {
  events?: unknown[];
  event_sessions?: unknown[];
  rsvps?: unknown[];
  v_student_participation?: unknown[];
}

function makeStudentsRecordingClient(
  row: { display_name: string } | null,
  rows: StudentHomeTableRows = {},
) {
  const maybeSingleSpy = vi.fn().mockResolvedValue({ data: row, error: null });
  const eqSpy = vi.fn(() => ({ maybeSingle: maybeSingleSpy }));
  const selectSpy = vi.fn(() => ({ eq: eqSpy, maybeSingle: maybeSingleSpy }));

  // One entry per `.select()` issued against a non-`students` table, with the
  // `.eq`/`.in` arguments that followed it.
  const calls: { table: string; select: string; eq: unknown[][]; in: unknown[][] }[] = [];

  function makeChain(table: string, columns: string) {
    const entry = { table, select: columns, eq: [] as unknown[][], in: [] as unknown[][] };
    calls.push(entry);
    const data = rows[table as keyof StudentHomeTableRows] ?? [];
    const chain: Record<string, unknown> = {
      eq: vi.fn((...args: unknown[]) => {
        entry.eq.push(args);
        return chain;
      }),
      in: vi.fn((...args: unknown[]) => {
        entry.in.push(args);
        return chain;
      }),
      then: (resolve: (value: { data: unknown[]; error: null }) => unknown) =>
        Promise.resolve({ data, error: null }).then(resolve),
    };
    return chain;
  }

  const fromSpy = vi.fn((table: string) => {
    if (table === 'students') return { select: selectSpy };
    if (
      table === 'events' ||
      table === 'event_sessions' ||
      table === 'rsvps' ||
      table === 'v_student_participation'
    ) {
      return { select: vi.fn((columns: string) => makeChain(table, columns)) };
    }
    throw new Error(`unexpected table: ${table}`);
  });
  return {
    client: { from: fromSpy } as unknown as SupabaseClient,
    fromSpy,
    selectSpy,
    eqSpy,
    maybeSingleSpy,
    calls,
  };
}

/** Every `.eq(column, value)` / `.in(column, values)` recorded for one table. */
function studentHomeEqArgs(
  calls: ReturnType<typeof makeStudentsRecordingClient>['calls'],
  table: string,
): unknown[][] {
  return calls.filter((call) => call.table === table).flatMap((call) => call.eq);
}

function studentHomeInArgs(
  calls: ReturnType<typeof makeStudentsRecordingClient>['calls'],
  table: string,
): unknown[][] {
  return calls.filter((call) => call.table === table).flatMap((call) => call.in);
}

describe('makeLoadStudentHomeData (T183 criterion 8)', () => {
  it("reads students, scoped by exactly .eq('id', studentId) -- NOT student_id, the raw table's own primary key", async () => {
    const { client, fromSpy, selectSpy, eqSpy } = makeStudentsRecordingClient({
      display_name: 'Priya Chen',
    });
    const loadStudentHomeData = makeLoadStudentHomeData(() => client);

    await loadStudentHomeData('student-real-1', 'season-real-1');

    expect(fromSpy).toHaveBeenCalledWith('students');
    expect(selectSpy).toHaveBeenCalledWith('display_name');
    expect(selectSpy).toHaveBeenCalledTimes(1);
    expect(eqSpy).toHaveBeenCalledTimes(1);
    expect(eqSpy).toHaveBeenCalledWith('id', 'student-real-1');
  });

  // T199 RETITLED, assertion byte-unchanged. Four of the seven fields it
  // covers are no longer literals -- `events`/`sessions`/`rsvps`/
  // `participation` are real reads now, which for a client supplying NO rows
  // land on exactly the same `[]`/`[]`/`[]`/`null`. That the expected object
  // did not have to change is the point worth keeping: the empty case still
  // renders identically, so nothing downstream shifted underneath it. The
  // three that ARE still literals (`defaultGoalHours`/`goalHoursOverride`/
  // `studentHours`) are inert-by-design, not unimplemented -- see the T199
  // doc block in `students.ts`.
  it('maps display_name to displayName (real, per-student), passes seasonId through verbatim, and returns [] / [] / [] / null for a student with no events, plus the three inert literals -- no FIXTURE_* symbol', async () => {
    const { client } = makeStudentsRecordingClient({ display_name: 'Priya Chen' });
    const loadStudentHomeData = makeLoadStudentHomeData(() => client);

    await expect(loadStudentHomeData('student-real-2', 'season-real-2')).resolves.toEqual({
      seasonId: 'season-real-2',
      displayName: 'Priya Chen',
      defaultGoalHours: 0,
      goalHoursOverride: null,
      events: [],
      sessions: [],
      rsvps: [],
      studentHours: null,
      participation: null,
    });
  });

  it('passes a DIFFERENT seasonId through verbatim on a second call, proving it is a real passthrough of the argument, not a hardcoded literal', async () => {
    const { client } = makeStudentsRecordingClient({ display_name: 'Jordan Blake' });
    const loadStudentHomeData = makeLoadStudentHomeData(() => client);

    await expect(loadStudentHomeData('student-real-3', 'season-real-3')).resolves.toMatchObject({
      seasonId: 'season-real-3',
    });
    await expect(loadStudentHomeData('student-real-3', 'season-real-4')).resolves.toMatchObject({
      seasonId: 'season-real-4',
    });
  });

  it('filters server-side by the REAL supplied studentId, never a hardcoded or omitted one (defense in depth on top of own_or_linked_read RLS)', async () => {
    const { client, eqSpy } = makeStudentsRecordingClient({ display_name: 'Priya Chen' });
    const loadStudentHomeData = makeLoadStudentHomeData(() => client);

    await loadStudentHomeData('student-somebody-else', 'season-x');

    expect(eqSpy).toHaveBeenCalledTimes(1);
    expect(eqSpy).toHaveBeenCalledWith('id', 'student-somebody-else');
  });

  it("rejects (fail-loud, never bridged to fixture data) when no row is found -- a genuine anomaly at this point in the call chain, per this module doc's own row-not-found reasoning", async () => {
    const { client } = makeStudentsRecordingClient(null);
    const loadStudentHomeData = makeLoadStudentHomeData(() => client);

    await expect(loadStudentHomeData('student-does-not-exist', 'season-x')).rejects.toThrow();
  });

  /**
   * Criterion 8's own eq-drop filter-guard mutation test, same technique as
   * `makeResolveStudentScope`'s own equivalent test above: drop the
   * `.eq('id', studentId)` filter (simulated here directly, not by editing
   * the loader) to confirm the intended guard assertion is genuinely what
   * goes red -- not a `TypeError` from a stub that doesn't expose
   * `maybeSingle` on the unfiltered chain position.
   */
  it('the eq-drop mutation fails on the intended eqSpy assertion, not a TypeError', async () => {
    const { client, eqSpy, maybeSingleSpy } = makeStudentsRecordingClient({
      display_name: 'Priya Chen',
    });
    // Simulates the mutated query:
    // `.from('students').select('display_name').maybeSingle()` -- `.eq(...)`
    // genuinely never called.
    const mutatedResult = await (
      client.from('students') as unknown as { select: (columns: string) => unknown }
    ).select('display_name');
    const mutatedRow = await (
      mutatedResult as { maybeSingle: () => Promise<unknown> }
    ).maybeSingle();

    expect(mutatedRow).toEqual({
      data: { display_name: 'Priya Chen' },
      error: null,
    });
    expect(maybeSingleSpy).toHaveBeenCalledTimes(1);
    // The intended guard: eqSpy was never called under the mutated path.
    expect(eqSpy).not.toHaveBeenCalled();
  });
});

/**
 * T199 -- the four fields T183 left as literals: `events`, `sessions`,
 * `rsvps`, `participation`.
 *
 * These tests cover what the T183 block above structurally cannot: it
 * supplies no rows, so every one of its assertions holds equally well
 * whether the loader queries anything at all. The cases below therefore all
 * carry rows, and they assert FILTER ARGUMENTS rather than returned data
 * wherever a filter is what is at stake -- the passthrough fake returns the
 * same rows regardless of what it was filtered on, so returned data cannot
 * distinguish a scoped read from an unscoped one (T163's finding, recorded
 * at length in `reports.test.ts`'s module doc).
 *
 * All names fabricated (constitution item 6).
 */
const T199_EVENT_ROWS = [
  {
    id: 'event-build-night',
    season_id: 'season-real-9',
    type: 'meeting',
    title: 'Fixture Build Night',
    team_ids: null,
    counts_volunteer_hours: false,
  },
  {
    id: 'event-park-cleanup',
    season_id: 'season-real-9',
    type: 'outreach',
    title: 'Fixture Park Cleanup',
    team_ids: ['team-real-9'],
    counts_volunteer_hours: true,
  },
];

const T199_SESSION_ROWS = [
  {
    id: 'session-build-1',
    event_id: 'event-build-night',
    starts_at: '2026-08-10T23:00:00.000Z',
    ends_at: '2026-08-11T01:00:00.000Z',
    status: 'scheduled',
  },
];

const T199_RSVP_ROWS = [
  {
    id: 'rsvp-1',
    session_id: 'session-build-1',
    student_id: 'student-real-9',
    status: 'going',
    updated_at: '2026-08-01T12:00:00.000Z',
  },
];

describe('makeLoadStudentHomeData -- events/sessions/rsvps (T199)', () => {
  it('reads events season-scoped, selecting counts_volunteer_hours -- the column HomeEventRow declares and computePlannedHours reads', async () => {
    const { client, calls } = makeStudentsRecordingClient({ display_name: 'Priya Chen' });

    await makeLoadStudentHomeData(() => client)('student-real-9', 'season-real-9');

    expect(calls.filter((call) => call.table === 'events')).toHaveLength(1);
    expect(calls.find((call) => call.table === 'events')?.select).toBe(
      'id, season_id, type, title, team_ids, counts_volunteer_hours',
    );
    expect(studentHomeEqArgs(calls, 'events')).toContainEqual(['season_id', 'season-real-9']);
  });

  it('passes a DIFFERENT seasonId through to the events read on a second call -- a real passthrough, not a constant', async () => {
    const { client, calls } = makeStudentsRecordingClient({ display_name: 'Priya Chen' });
    const load = makeLoadStudentHomeData(() => client);

    await load('student-real-9', 'season-one');
    await load('student-real-9', 'season-two');

    expect(studentHomeEqArgs(calls, 'events').map(([, value]) => value)).toEqual([
      'season-one',
      'season-two',
    ]);
  });

  it('chains events -> sessions -> rsvps on the ids each stage returns, never on a hardcoded set', async () => {
    const { client, calls } = makeStudentsRecordingClient(
      { display_name: 'Priya Chen' },
      {
        events: T199_EVENT_ROWS,
        event_sessions: T199_SESSION_ROWS,
        rsvps: T199_RSVP_ROWS,
      },
    );

    await makeLoadStudentHomeData(() => client)('student-real-9', 'season-real-9');

    expect(studentHomeInArgs(calls, 'event_sessions')).toContainEqual([
      'event_id',
      ['event-build-night', 'event-park-cleanup'],
    ]);
    expect(studentHomeInArgs(calls, 'rsvps')).toContainEqual(['session_id', ['session-build-1']]);
  });

  /**
   * The RSVP student filter is NOT redundant with RLS: `my_student_ids()`
   * unions in `guardian_links`, so a parent's session legitimately sees
   * several children's rows. Dropping this `.eq` would put another student's
   * RSVPs into `StudentHomeData.rsvps`, which `withLocalRsvpOverride`
   * mutates on a "Can't go" click.
   */
  it("filters rsvps by BOTH session_id and the student's own id", async () => {
    const { client, calls } = makeStudentsRecordingClient(
      { display_name: 'Priya Chen' },
      { events: T199_EVENT_ROWS, event_sessions: T199_SESSION_ROWS, rsvps: T199_RSVP_ROWS },
    );

    await makeLoadStudentHomeData(() => client)('student-real-9', 'season-real-9');

    expect(studentHomeEqArgs(calls, 'rsvps')).toContainEqual(['student_id', 'student-real-9']);
  });

  it('never issues an empty .in(...) -- a season with no events queries neither sessions nor rsvps', async () => {
    const { client, fromSpy } = makeStudentsRecordingClient({ display_name: 'Priya Chen' });

    await makeLoadStudentHomeData(() => client)('student-real-9', 'season-real-9');

    expect(fromSpy).toHaveBeenCalledWith('events');
    expect(fromSpy).not.toHaveBeenCalledWith('event_sessions');
    expect(fromSpy).not.toHaveBeenCalledWith('rsvps');
  });

  it('never issues an empty .in(...) -- events with no sessions queries no rsvps', async () => {
    const { client, fromSpy } = makeStudentsRecordingClient(
      { display_name: 'Priya Chen' },
      { events: T199_EVENT_ROWS },
    );

    await makeLoadStudentHomeData(() => client)('student-real-9', 'season-real-9');

    expect(fromSpy).toHaveBeenCalledWith('event_sessions');
    expect(fromSpy).not.toHaveBeenCalledWith('rsvps');
  });

  /**
   * `team_ids: null` is the real "all teams" sentinel. Coercing it to `[]`
   * would invert `isEventInTeamScope` (`StudentHome.tsx:686`) for exactly
   * the events every student is meant to see: `null` means "in scope for
   * everyone", `[]` means "in scope for nobody".
   */
  it('maps snake_case to camelCase and preserves team_ids: null as null, never []', async () => {
    const { client } = makeStudentsRecordingClient(
      { display_name: 'Priya Chen' },
      { events: T199_EVENT_ROWS, event_sessions: T199_SESSION_ROWS, rsvps: T199_RSVP_ROWS },
    );

    const data = await makeLoadStudentHomeData(() => client)('student-real-9', 'season-real-9');

    expect(data.events).toEqual([
      {
        id: 'event-build-night',
        seasonId: 'season-real-9',
        type: 'meeting',
        title: 'Fixture Build Night',
        teamIds: null,
        countsVolunteerHours: false,
      },
      {
        id: 'event-park-cleanup',
        seasonId: 'season-real-9',
        type: 'outreach',
        title: 'Fixture Park Cleanup',
        teamIds: ['team-real-9'],
        countsVolunteerHours: true,
      },
    ]);
    expect(data.sessions).toEqual([
      {
        id: 'session-build-1',
        eventId: 'event-build-night',
        startsAt: '2026-08-10T23:00:00.000Z',
        endsAt: '2026-08-11T01:00:00.000Z',
        status: 'scheduled',
      },
    ]);
    expect(data.rsvps).toEqual([
      {
        id: 'rsvp-1',
        sessionId: 'session-build-1',
        studentId: 'student-real-9',
        status: 'going',
        updatedAt: '2026-08-01T12:00:00.000Z',
      },
    ]);
  });

  it('keeps the three inert fields literal -- no v_student_hours read is issued', async () => {
    const { client, fromSpy } = makeStudentsRecordingClient(
      { display_name: 'Priya Chen' },
      { events: T199_EVENT_ROWS, event_sessions: T199_SESSION_ROWS },
    );

    const data = await makeLoadStudentHomeData(() => client)('student-real-9', 'season-real-9');

    expect(fromSpy).not.toHaveBeenCalledWith('v_student_hours');
    expect(data.defaultGoalHours).toBe(0);
    expect(data.goalHoursOverride).toBeNull();
    expect(data.studentHours).toBeNull();
  });
});

describe('makeLoadStudentHomeData -- participation (T199)', () => {
  it('reads v_student_participation scoped to BOTH student_id and season_id', async () => {
    const { client, calls } = makeStudentsRecordingClient({ display_name: 'Priya Chen' });

    await makeLoadStudentHomeData(() => client)('student-real-9', 'season-real-9');

    const eqArgs = studentHomeEqArgs(calls, 'v_student_participation');
    expect(eqArgs).toContainEqual(['student_id', 'student-real-9']);
    expect(eqArgs).toContainEqual(['season_id', 'season-real-9']);
  });

  it('maps a single row verbatim into StudentHomeData.participation', async () => {
    const { client } = makeStudentsRecordingClient(
      { display_name: 'Priya Chen' },
      {
        v_student_participation: [
          {
            student_id: 'student-real-9',
            team_id: 'team-real-9',
            season_id: 'season-real-9',
            expected_ct: 4,
            present_ct: 3,
            late_ct: 1,
            excused_ct: 0,
            participation_pct: 75.0,
          },
        ],
      },
    );

    const data = await makeLoadStudentHomeData(() => client)('student-real-9', 'season-real-9');

    expect(data.participation).toEqual({
      studentId: 'student-real-9',
      teamId: 'team-real-9',
      seasonId: 'season-real-9',
      expectedCt: 4,
      presentCt: 3,
      lateCt: 1,
      excusedCt: 0,
      participationPct: 75.0,
    });
  });
});

/**
 * `aggregateStudentHomeParticipation` is exported and tested directly, the
 * same posture `StudentHome.tsx` takes with its own pure helpers -- the
 * dual-team and all-excused cases are arithmetic, and going through a fake
 * transport to reach them would add noise without adding coverage.
 */
describe('aggregateStudentHomeParticipation (T199)', () => {
  type T199ParticipationRow = Parameters<typeof aggregateStudentHomeParticipation>[0][number];

  function participationRow(overrides: Partial<T199ParticipationRow> = {}): T199ParticipationRow {
    return {
      student_id: 'student-real-9',
      team_id: 'team-frc',
      season_id: 'season-real-9',
      expected_ct: 0,
      present_ct: 0,
      late_ct: 0,
      excused_ct: 0,
      participation_pct: null,
      ...overrides,
    };
  }

  it('returns null when the student has no row at all -- T509 made "never marked" produce no row', () => {
    expect(aggregateStudentHomeParticipation([])).toBeNull();
  });

  /**
   * The case `loaders/meetings.ts`'s `.limit(1)` got wrong before T122, and
   * the reason this cannot just take `rows[0]`: the view groups by
   * `(student_id, team_id, season_id)`, so a dual-team student has one row
   * per membership WITHIN one season.
   */
  it('sums a dual-team student across both membership rows rather than picking one', () => {
    // Fixture chosen so the correct answer is distinguishable from EITHER
    // wrong one: team-frc alone scores 100.0, team-ftc alone scores 0.0, and
    // only the sum scores 40.0. A `.limit(1)`-style pick would land on one
    // of the extremes, not near the right answer.
    const result = aggregateStudentHomeParticipation([
      participationRow({ team_id: 'team-frc', expected_ct: 4, present_ct: 4, excused_ct: 0 }),
      participationRow({ team_id: 'team-ftc', expected_ct: 6, present_ct: 0, excused_ct: 0 }),
    ]);

    // v_team_participation's own expression over the sums:
    // round(100.0 * (4+0) / ((4+6) - (0+0)), 1) = 40.0
    expect(result).toMatchObject({ expectedCt: 10, presentCt: 4, excusedCt: 0 });
    expect(result?.participationPct).toBe(40.0);
  });

  /**
   * T509 (`20260806000000_met01_explicit_marks.sql`) replaced the view's
   * `greatest(expected_ct - excused_ct, 1)` floor with an explicit
   * `case ... then null`, precisely so an all-excused student stops
   * reporting a fabricated 0%. `loaders/meetings.ts:516` still applies the
   * old floor; this must not copy it.
   */
  it('returns null when every mark is excused -- never the pre-T509 fabricated 0%', () => {
    const result = aggregateStudentHomeParticipation([
      participationRow({ expected_ct: 3, present_ct: 0, excused_ct: 3, participation_pct: null }),
    ]);

    expect(result).toBeNull();
  });

  it('returns null when a dual-team student is all-excused across BOTH teams', () => {
    const result = aggregateStudentHomeParticipation([
      participationRow({ team_id: 'team-frc', expected_ct: 2, present_ct: 0, excused_ct: 2 }),
      participationRow({ team_id: 'team-ftc', expected_ct: 5, present_ct: 0, excused_ct: 5 }),
    ]);

    expect(result).toBeNull();
  });

  it("rounds to one decimal, matching the view's own round(x, 1)", () => {
    const result = aggregateStudentHomeParticipation([
      participationRow({ expected_ct: 3, present_ct: 1, excused_ct: 0 }),
    ]);

    // 100 * 1 / 3 = 33.333... -> 33.3
    expect(result?.participationPct).toBe(33.3);
  });
});

/**
 * T189 -- new tests for `makeResolveStudentIsActive`, same shape as
 * `makeLoadStudentHomeData`'s own describe block above (`.eq('id',
 * studentId).maybeSingle()` against the raw `students` table), reusing
 * `makeStudentsRecordingClient`'s own shape since both read the same table
 * via the same chain, just a different column.
 */
function makeStudentsIsActiveRecordingClient(row: { is_active: boolean } | null) {
  const maybeSingleSpy = vi.fn().mockResolvedValue({ data: row, error: null });
  const eqSpy = vi.fn(() => ({ maybeSingle: maybeSingleSpy }));
  const selectSpy = vi.fn(() => ({ eq: eqSpy, maybeSingle: maybeSingleSpy }));
  const fromSpy = vi.fn((table: string) => {
    if (table === 'students') return { select: selectSpy };
    throw new Error(`unexpected table: ${table}`);
  });
  return {
    client: { from: fromSpy } as unknown as SupabaseClient,
    fromSpy,
    selectSpy,
    eqSpy,
    maybeSingleSpy,
  };
}

describe('makeResolveStudentIsActive (T189)', () => {
  it("reads students, scoped by exactly .eq('id', studentId), selecting only is_active", async () => {
    const { client, fromSpy, selectSpy, eqSpy } = makeStudentsIsActiveRecordingClient({
      is_active: true,
    });
    const resolveStudentIsActive = makeResolveStudentIsActive(() => client);

    await resolveStudentIsActive('student-real-1');

    expect(fromSpy).toHaveBeenCalledWith('students');
    expect(selectSpy).toHaveBeenCalledWith('is_active');
    expect(selectSpy).toHaveBeenCalledTimes(1);
    expect(eqSpy).toHaveBeenCalledTimes(1);
    expect(eqSpy).toHaveBeenCalledWith('id', 'student-real-1');
  });

  it('resolves true for an active student (real, verbatim column passthrough)', async () => {
    const { client } = makeStudentsIsActiveRecordingClient({ is_active: true });
    const resolveStudentIsActive = makeResolveStudentIsActive(() => client);

    await expect(resolveStudentIsActive('student-active')).resolves.toBe(true);
  });

  it('resolves false for a deactivated student -- the ONE outcome this task exists to make reachable, never collapsed into null', async () => {
    const { client } = makeStudentsIsActiveRecordingClient({ is_active: false });
    const resolveStudentIsActive = makeResolveStudentIsActive(() => client);

    await expect(resolveStudentIsActive('student-inactive')).resolves.toBe(false);
  });

  it('resolves null (never throws, never coerced to false) when no student row is found -- distinct from a real deactivated row', async () => {
    const { client } = makeStudentsIsActiveRecordingClient(null);
    const resolveStudentIsActive = makeResolveStudentIsActive(() => client);

    await expect(resolveStudentIsActive('student-does-not-exist')).resolves.toBeNull();
  });

  it('filters server-side by the REAL supplied studentId, never a hardcoded or omitted one (defense in depth on top of own_or_linked_read RLS)', async () => {
    const { client, eqSpy } = makeStudentsIsActiveRecordingClient({ is_active: false });
    const resolveStudentIsActive = makeResolveStudentIsActive(() => client);

    await resolveStudentIsActive('student-somebody-else');

    expect(eqSpy).toHaveBeenCalledTimes(1);
    expect(eqSpy).toHaveBeenCalledWith('id', 'student-somebody-else');
  });

  /**
   * Same eq-drop filter-guard mutation technique as the two describe blocks
   * above -- confirms the intended guard assertion is genuinely what goes
   * red, not a `TypeError` from a stub that doesn't expose `maybeSingle` on
   * the unfiltered chain position.
   */
  it('the eq-drop mutation fails on the intended eqSpy assertion, not a TypeError', async () => {
    const { client, eqSpy, maybeSingleSpy } = makeStudentsIsActiveRecordingClient({
      is_active: false,
    });
    const mutatedResult = await (
      client.from('students') as unknown as { select: (columns: string) => unknown }
    ).select('is_active');
    const mutatedRow = await (
      mutatedResult as { maybeSingle: () => Promise<unknown> }
    ).maybeSingle();

    expect(mutatedRow).toEqual({ data: { is_active: false }, error: null });
    expect(maybeSingleSpy).toHaveBeenCalledTimes(1);
    expect(eqSpy).not.toHaveBeenCalled();
  });
});

/* ==========================================================================
 * GAM-340 -- `makeCreateStudent`/`makeUpdateStudent` now write
 * `student_teams`. Before this change neither function touched the junction
 * table at all, and neither had any coverage in this file (its old dispatcher
 * threw `unexpected table: students` for the write chains).
 *
 * The harness below is deliberately STATEFUL rather than a passthrough spy
 * recorder. Call-shape assertions alone cannot distinguish the prescribed
 * writer from the one Trap B forbids: a `.neq('team_id', newTeam)` close
 * never NAMES a bystander team, so "assert no write targets team C" passes
 * for the very design that wipes team C out. Only the post-write row state
 * separates them, which is the `scratch-postgres` skill's own standing rule
 * -- assert the rows, not the SQL you issued. `student_teams` rows are
 * therefore really held here, really filtered by the recorded predicates, and
 * really mutated.
 *
 * `.neq()` and `.insert()` are exposed on the `student_teams` fake even
 * though the correct implementation calls NEITHER. That is not dead scaffolding:
 * without them the criterion-3 and criterion-4 mutation replays would die on
 * `TypeError: ....neq is not a function` instead of failing on the assertion
 * they exist to exercise -- a misdirecting red this file already has a
 * documented convention against (see the eq-drop proofs above, whose whole
 * point is that the mutation's failure "genuinely comes from the intended
 * `eqSpy` assertion going red, not from an unrelated crash").
 *
 * All names fabricated (constitution item 6).
 * ==========================================================================
 */

interface GAM340MembershipRow {
  student_id: string;
  team_id: string;
  joined_on: string;
  left_on: string | null;
}

/** The `default current_date` a brand-new `student_teams` row would take. */
const GAM340_ROW_DEFAULT_JOINED_ON = '2026-08-14';

function gam340Membership(
  studentId: string,
  teamId: string,
  overrides: Partial<GAM340MembershipRow> = {},
): GAM340MembershipRow {
  return {
    student_id: studentId,
    team_id: teamId,
    joined_on: '2026-01-05',
    left_on: null,
    ...overrides,
  };
}

/** `{ [teamId]: 'active' | 'closed' }` -- the shape criterion 3 asserts. */
function gam340MembershipState(rows: readonly GAM340MembershipRow[]): Record<string, string> {
  return Object.fromEntries(
    rows.map((row) => [row.team_id, row.left_on === null ? 'active' : 'closed']),
  );
}

interface GAM340MembershipFilterChain {
  eq: (column: string, value: unknown) => GAM340MembershipFilterChain;
  neq: (column: string, value: unknown) => GAM340MembershipFilterChain;
  is: (column: string, value: unknown) => GAM340MembershipFilterChain;
  then: (
    onFulfilled: (value: {
      data: null;
      error: { message: string; code: string } | null;
    }) => unknown,
    onRejected?: (reason: unknown) => unknown,
  ) => Promise<unknown>;
}

interface GAM340ClientOptions {
  /** Seeded `student_teams` rows, mutated in place by the writes under test. */
  memberships?: GAM340MembershipRow[];
  /** What the previous-team read-back (`students.team_id`) resolves. */
  previousTeamId?: string;
  /** Overrides on the row the `students` insert/update resolves. */
  studentRow?: Partial<{
    id: string;
    display_name: string;
    team_id: string;
    grad_year: number | null;
    is_active: boolean;
    goal_hours_override: number | null;
  }>;
  /** Injected PostgREST error on the `student_teams` upsert. */
  upsertError?: { message: string; code: string };
}

function makeGAM340RosterWriteClient(options: GAM340ClientOptions = {}) {
  const memberships: GAM340MembershipRow[] = (options.memberships ?? []).map((row) => ({ ...row }));
  const studentRow = {
    id: 'student-gam340',
    profile_id: null,
    display_name: 'Rowan Vance',
    team_id: 'team-alder',
    grad_year: null,
    is_active: true,
    goal_hours_override: null,
    created_at: '2026-01-01T00:00:00.000Z',
    ...options.studentRow,
  };

  // `students` -- the previous-team read-back chain
  // (`.select('team_id').eq('id', id).single()`).
  const readBackSingleSpy = vi
    .fn()
    .mockResolvedValue(
      options.previousTeamId === undefined
        ? { data: null, error: null }
        : { data: { team_id: options.previousTeamId }, error: null },
    );
  const readBackEqSpy = vi.fn(() => ({ single: readBackSingleSpy }));
  const readBackSelectSpy = vi.fn(() => ({ eq: readBackEqSpy }));

  // `students` -- the pre-existing write chains, both ending `.select().single()`.
  const writeSingleSpy = vi.fn().mockResolvedValue({ data: studentRow, error: null });
  const writeSelectSpy = vi.fn(() => ({ single: writeSingleSpy }));
  const writeEqSpy = vi.fn(() => ({ select: writeSelectSpy }));
  const studentsInsertSpy = vi.fn(() => ({ select: writeSelectSpy }));
  const studentsUpdateSpy = vi.fn(() => ({ eq: writeEqSpy }));

  // `student_teams` -- stateful.
  const membershipEqSpy = vi.fn();
  const membershipNeqSpy = vi.fn();
  const membershipIsSpy = vi.fn();

  function makeMembershipFilterChain(values: Record<string, unknown>): GAM340MembershipFilterChain {
    const predicates: ((row: GAM340MembershipRow) => boolean)[] = [];
    let applied = false;
    function apply(): void {
      if (applied) return;
      applied = true;
      for (const row of memberships) {
        if (predicates.every((predicate) => predicate(row))) Object.assign(row, values);
      }
    }
    const chain: GAM340MembershipFilterChain = {
      eq: (column, value) => {
        membershipEqSpy(column, value);
        predicates.push((row) => (row as unknown as Record<string, unknown>)[column] === value);
        return chain;
      },
      neq: (column, value) => {
        membershipNeqSpy(column, value);
        predicates.push((row) => (row as unknown as Record<string, unknown>)[column] !== value);
        return chain;
      },
      is: (column, value) => {
        membershipIsSpy(column, value);
        predicates.push((row) => (row as unknown as Record<string, unknown>)[column] === value);
        return chain;
      },
      then: (onFulfilled, onRejected) => {
        apply();
        return Promise.resolve({ data: null, error: null }).then(onFulfilled, onRejected);
      },
    };
    return chain;
  }

  const membershipUpdateSpy = vi.fn((values: Record<string, unknown>) =>
    makeMembershipFilterChain(values),
  );

  // Declared with one parameter, but `vi.fn` records EVERY argument the call
  // site passed -- which is what lets the `{ onConflict: 'student_id,team_id' }`
  // options object still be asserted below.
  const membershipUpsertSpy = vi.fn((payload: Record<string, unknown>) => {
    if (options.upsertError !== undefined) {
      return Promise.resolve({ data: null, error: options.upsertError });
    }
    const existing = memberships.find(
      (row) => row.student_id === payload.student_id && row.team_id === payload.team_id,
    );
    if (existing === undefined) {
      memberships.push({
        student_id: payload.student_id as string,
        team_id: payload.team_id as string,
        // A brand-new row takes the column's own `default current_date`
        // whenever the payload omits `joined_on`.
        joined_on: (payload.joined_on as string | undefined) ?? GAM340_ROW_DEFAULT_JOINED_ON,
        left_on: (payload.left_on as string | null | undefined) ?? null,
      });
      return Promise.resolve({ data: null, error: null });
    }
    // Real `ON CONFLICT ... DO UPDATE SET` semantics: exactly the columns
    // PRESENT in the payload are overwritten. `joined_on` is absent from the
    // prescribed payload, which is what preserves an existing row's join
    // date -- so including it here would be observable, and is asserted.
    if ('left_on' in payload) existing.left_on = payload.left_on as string | null;
    if ('joined_on' in payload) existing.joined_on = payload.joined_on as string;
    return Promise.resolve({ data: null, error: null });
  });

  const membershipInsertSpy = vi.fn(() => Promise.resolve({ data: null, error: null }));

  const fromSpy = vi.fn((table: string) => {
    if (table === 'students') {
      return {
        select: readBackSelectSpy,
        insert: studentsInsertSpy,
        update: studentsUpdateSpy,
      };
    }
    if (table === 'student_teams') {
      return {
        upsert: membershipUpsertSpy,
        update: membershipUpdateSpy,
        insert: membershipInsertSpy,
      };
    }
    throw new Error(`unexpected table: ${table}`);
  });

  return {
    client: { from: fromSpy } as unknown as SupabaseClient,
    fromSpy,
    memberships,
    readBackSelectSpy,
    readBackEqSpy,
    studentsInsertSpy,
    studentsUpdateSpy,
    membershipUpsertSpy,
    membershipUpdateSpy,
    membershipInsertSpy,
    membershipEqSpy,
    membershipNeqSpy,
    membershipIsSpy,
  };
}

const GAM340_PAYLOAD = {
  displayName: 'Rowan Vance',
  teamId: 'team-alder',
  gradYear: null,
  isActive: true,
  goalHoursOverride: null,
};

describe('makeCreateStudent (GAM-340 criterion 1: opens a student_teams membership)', () => {
  it('upserts (student_id, team_id) with left_on: null on conflict target student_id,team_id', async () => {
    const { client, fromSpy, membershipUpsertSpy } = makeGAM340RosterWriteClient({
      studentRow: { id: 'student-new-1', team_id: 'team-alder' },
    });

    await makeCreateStudent(() => client)({ ...GAM340_PAYLOAD, teamId: 'team-alder' });

    expect(fromSpy).toHaveBeenCalledWith('student_teams');
    expect(membershipUpsertSpy).toHaveBeenCalledTimes(1);
    expect(membershipUpsertSpy).toHaveBeenCalledWith(
      { student_id: 'student-new-1', team_id: 'team-alder', left_on: null },
      { onConflict: 'student_id,team_id' },
    );
  });

  it("uses the DB-assigned id from the students insert, never a value from the caller's payload", async () => {
    const { client, membershipUpsertSpy } = makeGAM340RosterWriteClient({
      studentRow: { id: 'student-assigned-by-db', team_id: 'team-birch' },
    });

    await makeCreateStudent(() => client)({ ...GAM340_PAYLOAD, teamId: 'team-birch' });

    expect(membershipUpsertSpy.mock.calls[0][0]).toMatchObject({
      student_id: 'student-assigned-by-db',
    });
  });

  it('writes students FIRST and student_teams second -- the roster surface never shows a student whose base row failed to save', async () => {
    const { client, fromSpy } = makeGAM340RosterWriteClient({
      studentRow: { id: 'student-new-2', team_id: 'team-alder' },
    });

    await makeCreateStudent(() => client)(GAM340_PAYLOAD);

    expect(fromSpy.mock.calls.map(([table]) => table)).toEqual(['students', 'student_teams']);
  });

  it('leaves the resolved value unchanged -- still the mapped StudentRow from the students insert', async () => {
    const { client } = makeGAM340RosterWriteClient({
      studentRow: { id: 'student-new-3', team_id: 'team-alder', grad_year: 2029 },
    });

    await expect(makeCreateStudent(() => client)(GAM340_PAYLOAD)).resolves.toEqual({
      id: 'student-new-3',
      profileId: null,
      displayName: 'Rowan Vance',
      teamId: 'team-alder',
      gradYear: 2029,
      isActive: true,
      goalHoursOverride: null,
    });
  });

  it('creates the membership row itself -- final state is one ACTIVE row for the new team', async () => {
    const { client, memberships } = makeGAM340RosterWriteClient({
      studentRow: { id: 'student-new-4', team_id: 'team-cedar' },
    });

    await makeCreateStudent(() => client)({ ...GAM340_PAYLOAD, teamId: 'team-cedar' });

    expect(memberships).toEqual([
      {
        student_id: 'student-new-4',
        team_id: 'team-cedar',
        joined_on: GAM340_ROW_DEFAULT_JOINED_ON,
        left_on: null,
      },
    ]);
  });
});

describe('makeUpdateStudent (GAM-340 criterion 2: moves the membership)', () => {
  it('reads the previous students.team_id BEFORE the update, then closes exactly that team and opens the new one', async () => {
    const {
      client,
      fromSpy,
      readBackSelectSpy,
      readBackEqSpy,
      membershipUpdateSpy,
      membershipEqSpy,
      membershipIsSpy,
      membershipUpsertSpy,
    } = makeGAM340RosterWriteClient({
      previousTeamId: 'team-alder',
      studentRow: { id: 'student-moved', team_id: 'team-birch' },
      memberships: [gam340Membership('student-moved', 'team-alder')],
    });

    await makeUpdateStudent(() => client)('student-moved', {
      ...GAM340_PAYLOAD,
      teamId: 'team-birch',
    });

    expect(readBackSelectSpy).toHaveBeenCalledWith('team_id');
    expect(readBackEqSpy).toHaveBeenCalledWith('id', 'student-moved');
    // Read-back first, students update second, membership writes after.
    expect(fromSpy.mock.calls.map(([table]) => table)).toEqual([
      'students',
      'students',
      'student_teams',
      'student_teams',
    ]);
    expect(membershipUpdateSpy).toHaveBeenCalledTimes(1);
    expect(membershipEqSpy).toHaveBeenCalledWith('student_id', 'student-moved');
    expect(membershipEqSpy).toHaveBeenCalledWith('team_id', 'team-alder');
    expect(membershipIsSpy).toHaveBeenCalledWith('left_on', null);
    expect(membershipUpsertSpy).toHaveBeenCalledWith(
      { student_id: 'student-moved', team_id: 'team-birch', left_on: null },
      { onConflict: 'student_id,team_id' },
    );
  });

  /**
   * The `left_on` literal, pinned. `current_date` cannot be sent through
   * PostgREST (only JSON values), so the writer derives today in UTC --
   * matching `ScheduleMeetingsDialog.tsx:369` and
   * `OutreachEventDialog.tsx:699,710`, the two existing in-repo derivations
   * for a `date` column. The clock is frozen here so this asserts the exact
   * value rather than a shape.
   */
  it('stamps left_on with the UTC-derived YYYY-MM-DD date, not a timestamp and not a SQL expression', async () => {
    vi.useFakeTimers();
    try {
      // 01:30 UTC on 2026-03-04 -- 19:30 the PREVIOUS day in America/Chicago,
      // i.e. inside the disclosed drift window. The writer records the UTC
      // date, deliberately and knowingly.
      vi.setSystemTime(new Date('2026-03-04T01:30:00.000Z'));
      const { client, membershipUpdateSpy } = makeGAM340RosterWriteClient({
        previousTeamId: 'team-alder',
        studentRow: { id: 'student-moved', team_id: 'team-birch' },
        memberships: [gam340Membership('student-moved', 'team-alder')],
      });

      await makeUpdateStudent(() => client)('student-moved', {
        ...GAM340_PAYLOAD,
        teamId: 'team-birch',
      });

      expect(membershipUpdateSpy).toHaveBeenCalledWith({ left_on: '2026-03-04' });
    } finally {
      vi.useRealTimers();
    }
  });

  it('leaves the resolved value unchanged -- still the mapped, freshly-updated StudentRow', async () => {
    const { client } = makeGAM340RosterWriteClient({
      previousTeamId: 'team-alder',
      studentRow: {
        id: 'student-moved',
        display_name: 'Edited Name',
        team_id: 'team-birch',
        is_active: false,
      },
      memberships: [gam340Membership('student-moved', 'team-alder')],
    });

    const result = await makeUpdateStudent(() => client)('student-moved', {
      ...GAM340_PAYLOAD,
      displayName: 'Edited Name',
      teamId: 'team-birch',
      isActive: false,
    });

    expect(result).toEqual({
      id: 'student-moved',
      profileId: null,
      displayName: 'Edited Name',
      teamId: 'team-birch',
      gradYear: null,
      isActive: false,
      goalHoursOverride: null,
    });
  });
});

/**
 * GAM-340 criterion 3 -- Trap B. The schema is deliberately multi-team
 * (`students.team_id` is the LEGACY primary column only) and the roster edit
 * form carries exactly ONE teamId. A writer that closed every ACTIVE
 * membership whose `team_id` differs from the new one would silently delete a
 * dual-team student's legitimate second team.
 *
 * All three assertions below are required, and the third is the only one that
 * distinguishes the two designs: a `.neq('team_id', newTeam)` close never
 * NAMES the bystander team, so a "no write targets team C" call-shape
 * assertion passes for the forbidden implementation. The row state does not.
 */
describe('makeUpdateStudent (GAM-340 criterion 3: Trap B -- a dual-team student keeps their second team)', () => {
  function moveDualTeamStudentFromAlderToBirch() {
    return makeGAM340RosterWriteClient({
      previousTeamId: 'team-alder',
      studentRow: { id: 'student-dual', team_id: 'team-birch' },
      memberships: [
        gam340Membership('student-dual', 'team-alder'),
        gam340Membership('student-dual', 'team-cedar'),
      ],
    });
  }

  it('3a (positive filter) -- the close names student_id, the PREVIOUS team_id, and left_on is null', async () => {
    const harness = moveDualTeamStudentFromAlderToBirch();

    await makeUpdateStudent(() => harness.client)('student-dual', {
      ...GAM340_PAYLOAD,
      teamId: 'team-birch',
    });

    expect(harness.membershipEqSpy).toHaveBeenCalledWith('student_id', 'student-dual');
    expect(harness.membershipEqSpy).toHaveBeenCalledWith('team_id', 'team-alder');
    expect(harness.membershipIsSpy).toHaveBeenCalledWith('left_on', null);
  });

  it('3b (negative) -- .neq() is never called on student_teams', async () => {
    const harness = moveDualTeamStudentFromAlderToBirch();

    await makeUpdateStudent(() => harness.client)('student-dual', {
      ...GAM340_PAYLOAD,
      teamId: 'team-birch',
    });

    expect(harness.membershipNeqSpy).not.toHaveBeenCalled();
  });

  it('3c (row state) -- moving A->B with ACTIVE {A, C} leaves A closed, B active, C ACTIVE', async () => {
    const harness = moveDualTeamStudentFromAlderToBirch();

    await makeUpdateStudent(() => harness.client)('student-dual', {
      ...GAM340_PAYLOAD,
      teamId: 'team-birch',
    });

    expect(gam340MembershipState(harness.memberships)).toEqual({
      'team-alder': 'closed',
      'team-birch': 'active',
      'team-cedar': 'active',
    });
  });
});

/**
 * GAM-340 criterion 4 -- Trap A. `student_teams`' primary key is
 * `(student_id, team_id)`, and the migration that created it states the
 * intended semantics verbatim: "re-joining a team after leaving is a future
 * UPDATE of `left_on` back to null, not a new row."
 *
 * ONLY THE CALL SHAPE AND THIS FAKE'S ROW STATE ARE OBSERVABLE FROM VITEST.
 * The database behaviour was proved separately, on a real PostgreSQL cluster
 * carrying all 25 migrations, during this issue's premise gate: a plain
 * re-insert raised SQLSTATE 23505 `duplicate key value violates unique
 * constraint "student_teams_pkey"`, while the prescribed upsert reactivated
 * the row and took `v_student_participation` from 0 rows to 1. Cited, not
 * re-derived here.
 */
describe('makeUpdateStudent (GAM-340 criterion 4: Trap A -- re-joining a previously-left team)', () => {
  function rejoinAlder() {
    return makeGAM340RosterWriteClient({
      previousTeamId: 'team-birch',
      studentRow: { id: 'student-returner', team_id: 'team-alder' },
      memberships: [
        gam340Membership('student-returner', 'team-alder', { left_on: '2026-06-30' }),
        gam340Membership('student-returner', 'team-birch'),
      ],
    });
  }

  it('goes through the upsert path with left_on: null and onConflict student_id,team_id', async () => {
    const harness = rejoinAlder();

    await makeUpdateStudent(() => harness.client)('student-returner', {
      ...GAM340_PAYLOAD,
      teamId: 'team-alder',
    });

    expect(harness.membershipUpsertSpy).toHaveBeenCalledWith(
      { student_id: 'student-returner', team_id: 'team-alder', left_on: null },
      { onConflict: 'student_id,team_id' },
    );
  });

  it('never calls .insert() on student_teams -- a plain insert violates the (student_id, team_id) primary key', async () => {
    const harness = rejoinAlder();

    await makeUpdateStudent(() => harness.client)('student-returner', {
      ...GAM340_PAYLOAD,
      teamId: 'team-alder',
    });

    expect(harness.membershipInsertSpy).not.toHaveBeenCalled();
  });

  it('reactivates the existing row rather than adding a second one, and preserves its original joined_on', async () => {
    const harness = rejoinAlder();

    await makeUpdateStudent(() => harness.client)('student-returner', {
      ...GAM340_PAYLOAD,
      teamId: 'team-alder',
    });

    // Two rows in, two rows out -- no third row, and `joined_on` still the
    // original 2026-01-05 because the payload deliberately omits that column.
    expect(harness.memberships).toEqual([
      {
        student_id: 'student-returner',
        team_id: 'team-alder',
        joined_on: '2026-01-05',
        left_on: null,
      },
      {
        student_id: 'student-returner',
        team_id: 'team-birch',
        joined_on: '2026-01-05',
        left_on: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
      },
    ]);
  });
});

describe('makeUpdateStudent (GAM-340 criterion 5: an unchanged team still reconciles, and closes nothing)', () => {
  it('upserts the membership and issues no close at all when teamId did not change', async () => {
    const { client, membershipUpsertSpy, membershipUpdateSpy, memberships } =
      makeGAM340RosterWriteClient({
        previousTeamId: 'team-alder',
        studentRow: { id: 'student-same-team', team_id: 'team-alder' },
        memberships: [],
      });

    await makeUpdateStudent(() => client)('student-same-team', {
      ...GAM340_PAYLOAD,
      teamId: 'team-alder',
    });

    expect(membershipUpdateSpy).not.toHaveBeenCalled();
    expect(membershipUpsertSpy).toHaveBeenCalledWith(
      { student_id: 'student-same-team', team_id: 'team-alder', left_on: null },
      { onConflict: 'student_id,team_id' },
    );
    // A membership-less student is reconciled by an edit to any field --
    // this is the whole reason step 2.4 is unconditional.
    expect(gam340MembershipState(memberships)).toEqual({ 'team-alder': 'active' });
  });

  /**
   * The disclosed, deliberate consequence of that unconditional upsert
   * (`students.ts`'s own GAM-340 block, note (d)): it re-opens a membership
   * somebody closed while `students.team_id` still names that same team.
   * Asserted rather than merely commented, so a future reader who decides to
   * "fix" it has to change a test that says why.
   */
  it('re-opens a deliberately-closed membership when the roster still names that team -- accepted, not a bug', async () => {
    const { client, memberships } = makeGAM340RosterWriteClient({
      previousTeamId: 'team-alder',
      studentRow: { id: 'student-contradictory', team_id: 'team-alder' },
      memberships: [
        gam340Membership('student-contradictory', 'team-alder', { left_on: '2026-06-30' }),
      ],
    });

    await makeUpdateStudent(() => client)('student-contradictory', {
      ...GAM340_PAYLOAD,
      teamId: 'team-alder',
    });

    expect(gam340MembershipState(memberships)).toEqual({ 'team-alder': 'active' });
  });
});

describe('GAM-340 criterion 6: a failed membership write rejects, it never resolves successfully', () => {
  it('createStudent rejects with the real SupabaseLoaderError when the student_teams upsert fails', async () => {
    const { client } = makeGAM340RosterWriteClient({
      studentRow: { id: 'student-new-5', team_id: 'team-alder' },
      upsertError: { message: 'permission denied for table student_teams', code: '42501' },
    });

    await expect(makeCreateStudent(() => client)(GAM340_PAYLOAD)).rejects.toMatchObject({
      code: '42501',
    });
  });

  it('updateStudent rejects with the real SupabaseLoaderError when the student_teams upsert fails -- never swallowed into a silent success', async () => {
    const { client } = makeGAM340RosterWriteClient({
      previousTeamId: 'team-alder',
      studentRow: { id: 'student-moved', team_id: 'team-birch' },
      memberships: [gam340Membership('student-moved', 'team-alder')],
      upsertError: { message: 'permission denied for table student_teams', code: '42501' },
    });

    await expect(
      makeUpdateStudent(() => client)('student-moved', { ...GAM340_PAYLOAD, teamId: 'team-birch' }),
    ).rejects.toMatchObject({ code: '42501' });
  });
});
