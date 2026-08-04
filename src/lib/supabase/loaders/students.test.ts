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
  makeLoadStudentHomeData,
  makeResolveStudentIsActive,
  makeResolveStudentScope,
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

  it('maps team_id/goal_hours/confirmed_hours/planned_hours to teamId/goalHours/confirmedHours/plannedHours (camelCase, verbatim -- no coalesce/arithmetic here)', async () => {
    const { client } = makeRecordingClient({
      team_id: 'team-real-2',
      goal_hours: 42,
      confirmed_hours: 10,
      planned_hours: 3,
    });
    const resolveStudentScope = makeResolveStudentScope(() => client);

    await expect(resolveStudentScope('student-real-2')).resolves.toEqual({
      teamId: 'team-real-2',
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
      teamId: 'team-real-3',
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
      teamId: 'team-primary-6',
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
      teamId: 'team-real-7',
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
 */
function makeStudentsRecordingClient(row: { display_name: string } | null) {
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

  it('maps display_name to displayName (real, per-student), passes seasonId through verbatim, and returns the SEVEN remaining fields as honest-empty literals -- no FIXTURE_* symbol', async () => {
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
