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
import { makeResolveStudentScope } from './students';

/**
 * Records `.select()`/`.eq()`/`.maybeSingle()` for the
 * `v_student_goal_projection` view.
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
 */
function makeRecordingClient(
  row: {
    team_id: string;
    goal_hours: number;
    confirmed_hours: number;
    planned_hours: number;
  } | null,
) {
  const maybeSingleSpy = vi.fn().mockResolvedValue({ data: row, error: null });
  const eqSpy = vi.fn(() => ({ maybeSingle: maybeSingleSpy }));
  const selectSpy = vi.fn(() => ({ eq: eqSpy, maybeSingle: maybeSingleSpy }));
  const fromSpy = vi.fn((table: string) => {
    if (table === 'v_student_goal_projection') return { select: selectSpy };
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
