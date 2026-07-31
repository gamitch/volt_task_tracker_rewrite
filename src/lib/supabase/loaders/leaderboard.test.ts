// T158: tests for `loaders/leaderboard.ts`'s two new real queries
// (`v_student_hours` filtered by season, `v_leaderboard_students`
// unfiltered) and the composed `makeLoadLeaderboardData`. Structural
// template: `loaders/coachHome.test.ts` (this directory's own
// two-query-composition test, itself built on `students.test.ts`'s
// `makeRecordingClient` `.from(table)` dispatcher), adapted for ONE
// filtered + ONE unfiltered query rather than two unfiltered ones.
//
// Stub shape, deliberately (packet criterion 5): `students.test.ts:26-62`'s
// "resolved value reachable both before AND after `.eq(...)`" technique
// works there because that chain terminates in `.maybeSingle()`.
// `queryLeaderboardHours` has no such terminator -- it awaits the
// `.eq(...)` result directly -- so here the hours `select()` return must
// ITSELF be a thenable resolving to `{ data, error }` while also exposing
// `.eq()`, and `.eq()`'s own return must be a thenable too. That is what
// makes the criterion-5 mutation (drop `.eq('season_id', seasonId)` at the
// call site) fail on the intended `eqSpy` assertion rather than on an
// unrelated `TypeError` -- exercised directly by the last test in the first
// describe block below.
//
// No `@vitest-environment jsdom` docblock -- `leaderboard.ts` only imports
// page types (`import type`), so this exercises pure loader logic in
// vitest's default node environment, same posture `coachHome.test.ts`/
// `students.test.ts`/`outreach.test.ts` already established.
//
// Every display name below is fabricated (constitution item 6), matching
// this repo's existing fixture-name convention.
import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it, vi } from 'vitest';
import { makeLoadLeaderboardData } from './leaderboard';

interface HoursRowFixture {
  student_id: string;
  season_id: string;
  confirmed_hours: number;
}

interface RosterRowFixture {
  id: string;
  display_name: string;
}

function makeRecordingClient(
  hours: HoursRowFixture[] | null,
  roster: RosterRowFixture[] | null,
  errors: {
    hours?: { message: string; code?: string };
    roster?: { message: string; code?: string };
  } = {},
) {
  const hoursResult = { data: errors.hours ? null : hours, error: errors.hours ?? null };
  const rosterResult = { data: errors.roster ? null : roster, error: errors.roster ?? null };

  // `.eq(...)` resolves the hours result directly (no `.maybeSingle()`
  // terminator exists on this chain -- see the file header).
  const hoursEqSpy = vi.fn(() => Promise.resolve(hoursResult));
  // `select()`'s return is BOTH a thenable resolving to the same
  // `{ data, error }` shape AND an object exposing `.eq()`, so the
  // eq-dropping mutation still resolves instead of crashing.
  const hoursSelectSpy = vi.fn(() =>
    Object.assign(Promise.resolve(hoursResult), { eq: hoursEqSpy }),
  );
  const rosterSelectSpy = vi.fn().mockResolvedValue(rosterResult);

  const fromSpy = vi.fn((table: string) => {
    if (table === 'v_student_hours') return { select: hoursSelectSpy };
    // Deliberately exposes ONLY `select` -- the roster query is unfiltered,
    // so any `.eq(...)` added to it would surface here as a hard failure.
    if (table === 'v_leaderboard_students') return { select: rosterSelectSpy };
    throw new Error(`unexpected table: ${table}`);
  });

  return {
    client: { from: fromSpy } as unknown as SupabaseClient,
    fromSpy,
    hoursSelectSpy,
    hoursEqSpy,
    rosterSelectSpy,
  };
}

describe('queryLeaderboardHours (T158 criterion 5)', () => {
  it("reads v_student_hours via exactly .select('student_id, season_id, confirmed_hours').eq('season_id', seasonId)", async () => {
    const { client, fromSpy, hoursSelectSpy, hoursEqSpy } = makeRecordingClient([], []);

    await makeLoadLeaderboardData(() => client)('season-1');

    expect(fromSpy).toHaveBeenCalledWith('v_student_hours');
    expect(hoursSelectSpy).toHaveBeenCalledTimes(1);
    expect(hoursSelectSpy).toHaveBeenCalledWith('student_id, season_id, confirmed_hours');
    expect(hoursEqSpy).toHaveBeenCalledTimes(1);
    expect(hoursEqSpy).toHaveBeenCalledWith('season_id', 'season-1');
  });

  it('filters server-side by the REAL supplied seasonId, never a hardcoded or omitted one', async () => {
    const { client, hoursEqSpy } = makeRecordingClient([], []);

    await makeLoadLeaderboardData(() => client)('season-some-other-one');

    expect(hoursEqSpy).toHaveBeenCalledTimes(1);
    expect(hoursEqSpy).toHaveBeenCalledWith('season_id', 'season-some-other-one');
  });

  /**
   * Criterion 5's own mutation: drop the `.eq('season_id', seasonId)` call
   * (simulated here directly, not by editing the loader) to confirm the
   * intended guard assertion is genuinely what goes red -- not a
   * `TypeError` from a stub whose `select()` return is not itself a
   * thenable. Same technique `students.test.ts:145-169` uses for its own
   * `.eq(...)`-drop mutation. This exact mutation was ALSO applied directly
   * to the real loader (`queryLeaderboardHours` in `leaderboard.ts`) and
   * run, per the worker output's own mutation-evidence record -- this test
   * additionally documents, in isolation, why the failure mode is the
   * intended one and not a crash.
   */
  it('the eq-drop mutation fails on the intended eqSpy assertion, not a TypeError', async () => {
    const { client, hoursEqSpy } = makeRecordingClient(
      [{ student_id: 'student-remy-okafor', season_id: 'season-1', confirmed_hours: 12 }],
      [],
    );

    // Simulates the mutated query:
    // `.from('v_student_hours').select(...)` with `.eq(...)` never called.
    const mutatedResult = await (
      client.from('v_student_hours') as unknown as { select: (columns: string) => unknown }
    ).select('student_id, season_id, confirmed_hours');

    expect(mutatedResult).toEqual({
      data: [{ student_id: 'student-remy-okafor', season_id: 'season-1', confirmed_hours: 12 }],
      error: null,
    });
    // The intended guard: eqSpy was never called under the mutated path.
    expect(hoursEqSpy).not.toHaveBeenCalled();
  });
});

describe('queryLeaderboardRoster (T158 criterion 6)', () => {
  it("reads v_leaderboard_students, unfiltered, via exactly .select('id, display_name') -- the view's own `where is_active` is the only filter, never duplicated in TS", async () => {
    const { client, fromSpy, rosterSelectSpy } = makeRecordingClient([], []);

    await makeLoadLeaderboardData(() => client)('season-1');

    expect(fromSpy).toHaveBeenCalledWith('v_leaderboard_students');
    expect(rosterSelectSpy).toHaveBeenCalledTimes(1);
    expect(rosterSelectSpy).toHaveBeenCalledWith('id, display_name');
  });

  it("never reads the base `students` table directly (RLS: own_or_linked_read would silently return at most the caller's own row on this non-staff-gated surface)", async () => {
    const { client, fromSpy } = makeRecordingClient([], []);

    await makeLoadLeaderboardData(() => client)('season-1');

    expect(fromSpy).not.toHaveBeenCalledWith('students');
    expect(fromSpy).toHaveBeenCalledTimes(2);
  });
});

describe('makeLoadLeaderboardData (T158 criteria 7-10)', () => {
  it('composes the full LeaderboardLoadResult shape end-to-end against a stub client -- both queries via Promise.all, camelCase mapping only, no other transform', async () => {
    const { client } = makeRecordingClient(
      [
        { student_id: 'student-remy-okafor', season_id: 'season-fixture-1', confirmed_hours: 42.5 },
        {
          student_id: 'student-tobias-lindqvist',
          season_id: 'season-fixture-1',
          confirmed_hours: 7,
        },
      ],
      [
        { id: 'student-remy-okafor', display_name: 'Remy Okafor' },
        { id: 'student-tobias-lindqvist', display_name: 'Tobias Lindqvist' },
        { id: 'student-marisol-quintero', display_name: 'Marisol Quintero' },
      ],
    );

    const data = await makeLoadLeaderboardData(() => client)('season-fixture-1');

    expect(data).toEqual({
      hours: [
        { studentId: 'student-remy-okafor', seasonId: 'season-fixture-1', confirmedHours: 42.5 },
        { studentId: 'student-tobias-lindqvist', seasonId: 'season-fixture-1', confirmedHours: 7 },
      ],
      students: [
        { id: 'student-remy-okafor', displayName: 'Remy Okafor' },
        { id: 'student-tobias-lindqvist', displayName: 'Tobias Lindqvist' },
        { id: 'student-marisol-quintero', displayName: 'Marisol Quintero' },
      ],
    });
  });

  it('applies NO ranking, slicing or reordering -- rows are returned in query order, including a roster entry with no hours row and more than ten students (topStudentsByHours in Leaderboard.tsx owns that, unmodified by this task)', async () => {
    const roster = Array.from({ length: 12 }, (_unused, index) => ({
      id: `student-fixture-${index}`,
      display_name: `Fixture Student ${index}`,
    }));
    const { client } = makeRecordingClient(
      [{ student_id: 'student-fixture-11', season_id: 'season-1', confirmed_hours: 3 }],
      roster,
    );

    const data = await makeLoadLeaderboardData(() => client)('season-1');

    expect(data.students).toHaveLength(12);
    expect(data.students[0]).toEqual({ id: 'student-fixture-0', displayName: 'Fixture Student 0' });
    expect(data.hours).toEqual([
      { studentId: 'student-fixture-11', seasonId: 'season-1', confirmedHours: 3 },
    ]);
  });

  it('resolves an empty hours array (never null) when the hours query finds zero rows', async () => {
    const { client } = makeRecordingClient(null, [
      { id: 'student-remy-okafor', display_name: 'Remy Okafor' },
    ]);

    const data = await makeLoadLeaderboardData(() => client)('season-1');

    expect(data.hours).toEqual([]);
    expect(data.students).toEqual([{ id: 'student-remy-okafor', displayName: 'Remy Okafor' }]);
  });

  it('resolves an empty students array (never null) when the roster query finds zero rows', async () => {
    const { client } = makeRecordingClient(
      [{ student_id: 'student-remy-okafor', season_id: 'season-1', confirmed_hours: 5 }],
      null,
    );

    const data = await makeLoadLeaderboardData(() => client)('season-1');

    expect(data.students).toEqual([]);
    expect(data.hours).toEqual([
      { studentId: 'student-remy-okafor', seasonId: 'season-1', confirmedHours: 5 },
    ]);
  });

  it('rejects with the real SupabaseLoaderError when the HOURS query errors -- no fixture fallback', async () => {
    const { client } = makeRecordingClient([], [], {
      hours: { message: 'boom', code: '500' },
    });

    await expect(makeLoadLeaderboardData(() => client)('season-1')).rejects.toMatchObject({
      code: '500',
      message: "Couldn't load this data. Check your connection and try again.",
    });
  });

  it('rejects with the real SupabaseLoaderError when the ROSTER query errors -- no fixture fallback', async () => {
    const { client } = makeRecordingClient([], [], {
      roster: { message: 'boom', code: '42P01' },
    });

    await expect(makeLoadLeaderboardData(() => client)('season-1')).rejects.toMatchObject({
      code: '42P01',
      message: "Couldn't load this data. Check your connection and try again.",
    });
  });

  it("is a real seasonId passthrough across two calls: the hours filter uses each distinct value and each call's hours differ accordingly, while the season-less roster query is called identically both times", async () => {
    const hoursBySeason: Record<string, HoursRowFixture[]> = {
      'season-alpha': [
        { student_id: 'student-remy-okafor', season_id: 'season-alpha', confirmed_hours: 11 },
      ],
      'season-beta': [
        { student_id: 'student-tobias-lindqvist', season_id: 'season-beta', confirmed_hours: 22 },
      ],
    };
    const roster: RosterRowFixture[] = [
      { id: 'student-remy-okafor', display_name: 'Remy Okafor' },
      { id: 'student-tobias-lindqvist', display_name: 'Tobias Lindqvist' },
    ];
    const hoursEqSpy = vi.fn((_column: string, seasonId: string) =>
      Promise.resolve({ data: hoursBySeason[seasonId] ?? [], error: null }),
    );
    const hoursSelectSpy = vi.fn(() =>
      Object.assign(Promise.resolve({ data: [] as HoursRowFixture[], error: null }), {
        eq: hoursEqSpy,
      }),
    );
    const rosterSelectSpy = vi.fn().mockResolvedValue({ data: roster, error: null });
    const client = {
      from: vi.fn((table: string) => {
        if (table === 'v_student_hours') return { select: hoursSelectSpy };
        if (table === 'v_leaderboard_students') return { select: rosterSelectSpy };
        throw new Error(`unexpected table: ${table}`);
      }),
    } as unknown as SupabaseClient;

    const loadLeaderboardData = makeLoadLeaderboardData(() => client);
    const dataAlpha = await loadLeaderboardData('season-alpha');
    const dataBeta = await loadLeaderboardData('season-beta');

    expect(hoursEqSpy).toHaveBeenNthCalledWith(1, 'season_id', 'season-alpha');
    expect(hoursEqSpy).toHaveBeenNthCalledWith(2, 'season_id', 'season-beta');
    expect(dataAlpha.hours).toEqual([
      { studentId: 'student-remy-okafor', seasonId: 'season-alpha', confirmedHours: 11 },
    ]);
    expect(dataBeta.hours).toEqual([
      { studentId: 'student-tobias-lindqvist', seasonId: 'season-beta', confirmedHours: 22 },
    ]);
    // The roster query takes no seasonId at all -- same call, same result,
    // both times.
    expect(rosterSelectSpy).toHaveBeenCalledTimes(2);
    expect(rosterSelectSpy).toHaveBeenNthCalledWith(1, 'id, display_name');
    expect(rosterSelectSpy).toHaveBeenNthCalledWith(2, 'id, display_name');
    expect(dataAlpha.students).toEqual(dataBeta.students);
  });
});
