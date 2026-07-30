// T176: the first test in `src/lib/supabase/loaders/students.ts`. Scoped to
// the ONE new function this task adds (`makeResolveStudentScope`/
// `resolveStudentScope`) -- this is NOT a full coverage sweep of
// `loaders/students.ts` (no ledger row currently claims that broader scope;
// `queryStudents`/`makeLoadStudentsTabData`/`setStudentActive`/
// `createStudent`/`updateStudent` remain untested by this file, same as
// before this task).
//
// No `@vitest-environment jsdom` docblock -- `students.ts` only imports page
// types (`import type`), so this exercises pure loader logic in vitest's
// default node environment, same posture `outreach.test.ts` (this
// directory's own first test file, T146) already established.
import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it, vi } from 'vitest';
import { makeResolveStudentScope } from './students';

/**
 * Records `.select()`/`.eq()`/`.maybeSingle()` for the `students` table.
 *
 * Criterion 8's own MINOR fix (T176-gate-round1-findings.md): `maybeSingle`
 * is exposed at BOTH the filtered chain position (after `.eq(...)`) AND
 * directly on the `.select(...)` result -- so a mutation that drops the
 * `.eq('id', studentId)` filter still resolves (via the SAME
 * `maybeSingleSpy`) rather than throwing a misdirecting
 * `TypeError: ...maybeSingle is not a function`. That means the mutation's
 * failure genuinely comes from the intended `eqSpy` assertion going red,
 * not from an unrelated crash -- verified directly below (`it('the eq-drop
 * mutation fails on the intended assertion, not a TypeError' ...`).
 */
function makeRecordingClient(row: { team_id: string; goal_hours_override: number | null } | null) {
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

describe('makeResolveStudentScope (T176 criterion 8)', () => {
  it("scopes the query by exactly .eq('id', studentId), on the students table", async () => {
    const { client, fromSpy, selectSpy, eqSpy } = makeRecordingClient({
      team_id: 'team-real-1',
      goal_hours_override: null,
    });
    const resolveStudentScope = makeResolveStudentScope(() => client);

    await resolveStudentScope('student-real-1');

    expect(fromSpy).toHaveBeenCalledWith('students');
    expect(selectSpy).toHaveBeenCalledTimes(1);
    expect(eqSpy).toHaveBeenCalledTimes(1);
    expect(eqSpy).toHaveBeenCalledWith('id', 'student-real-1');
  });

  it('maps team_id/goal_hours_override to teamId/goalHoursOverride (camelCase)', async () => {
    const { client } = makeRecordingClient({ team_id: 'team-real-2', goal_hours_override: 42 });
    const resolveStudentScope = makeResolveStudentScope(() => client);

    await expect(resolveStudentScope('student-real-2')).resolves.toEqual({
      teamId: 'team-real-2',
      goalHoursOverride: 42,
    });
  });

  it('preserves a real null goal_hours_override (never coerced to a fabricated number)', async () => {
    const { client } = makeRecordingClient({ team_id: 'team-real-3', goal_hours_override: null });
    const resolveStudentScope = makeResolveStudentScope(() => client);

    await expect(resolveStudentScope('student-real-3')).resolves.toEqual({
      teamId: 'team-real-3',
      goalHoursOverride: null,
    });
  });

  it('resolves null (never throws) when no row is found (.maybeSingle()\'s own "no rows" outcome)', async () => {
    const { client } = makeRecordingClient(null);
    const resolveStudentScope = makeResolveStudentScope(() => client);

    await expect(resolveStudentScope('student-does-not-exist')).resolves.toBeNull();
  });

  it('filters server-side by the REAL supplied studentId, never a hardcoded or omitted one (defense in depth on top of own_or_linked_read RLS)', async () => {
    const { client, eqSpy } = makeRecordingClient(null);
    const resolveStudentScope = makeResolveStudentScope(() => client);

    await resolveStudentScope('student-somebody-else');

    expect(eqSpy).toHaveBeenCalledTimes(1);
    expect(eqSpy).toHaveBeenCalledWith('id', 'student-somebody-else');
  });

  /**
   * Criterion 8's own mutation: drop the `.eq('id', studentId)` filter
   * (simulated here directly, not by editing the loader) to confirm the
   * intended guard assertion is genuinely what goes red -- not a
   * `TypeError` from a stub that doesn't expose `maybeSingle` on the
   * unfiltered chain position. Mirrors T157's own checker filter-guard
   * technique.
   */
  it('the eq-drop mutation fails on the intended eqSpy assertion, not a TypeError (MINOR fix verification)', async () => {
    const { client, eqSpy, maybeSingleSpy } = makeRecordingClient({
      team_id: 'team-real-4',
      goal_hours_override: null,
    });
    // Simulates the mutated query: `.from('students').select(...).maybeSingle()`
    // -- `.eq(...)` genuinely never called.
    const mutatedResult = await (
      client.from('students') as unknown as { select: () => unknown }
    ).select();
    const mutatedRow = await (
      mutatedResult as { maybeSingle: () => Promise<unknown> }
    ).maybeSingle();

    expect(mutatedRow).toEqual({
      data: { team_id: 'team-real-4', goal_hours_override: null },
      error: null,
    });
    expect(maybeSingleSpy).toHaveBeenCalledTimes(1);
    // The intended guard: eqSpy was never called under the mutated path.
    expect(eqSpy).not.toHaveBeenCalled();
  });
});
