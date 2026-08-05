// T163: colocated tests for `loaders/reports.ts`.
//
// ---------------------------------------------------------------------------
// WHAT THIS FILE IS FOR, stated precisely, because the ledger row that asked
// for it was WRONG about the premise.
//
// T163 read: "`loaders/reports.ts` has 0 tests (729 lines)". That is false.
// All SIX exports (`makeLoadParticipationData`/`loadParticipationData`,
// `makeLoadHoursData`/`loadHoursData`, `makeLoadEventSessionsData`/
// `loadEventSessionsData`) are already imported and exercised by
// `pages/reports/{Participation,Hours,Events}Tab.test.tsx` against stubbed
// clients. The file was never untested -- it just had no COLOCATED test file.
//
// Measured before writing anything (5 mutations against the real loaders,
// running the existing `pages/reports` suite):
//
//   participation: return [] instead of built rows ................ RED  (caught)
//   events:        skip the sessions chain entirely ............... RED  (caught)
//   participation: pass a WRONG seasonId to the metrics query ..... GREEN (missed)
//   hours:         pass a WRONG seasonId to the season-goal query .. GREEN (missed)
//   events:        pass a WRONG seasonId to the events query ....... GREEN (missed)
//
// So the real gap is narrow and specific, and it is NOT "no coverage":
// **season scoping is unguarded in all three loaders.** Structural breakage
// is caught; passing the wrong season is not.
//
// WHY the existing tests cannot catch it -- the mechanism, not a guess. Their
// fake clients build the filter spy inline and throw the handle away:
//
//     select: vi.fn(() => ({ eq: vi.fn().mockResolvedValue({ data, error }) }))
//
// That `.eq` returns the same rows for every argument and is unreachable from
// the test body, so no assertion about what was passed is even possible. It is
// the same passthrough-fake trap `loaders/coachHome.test.ts` documents (T198)
// and `supabase/tests/t700_*` guards against in SQL: a fixture-visibility test
// passes identically whether or not the filter is applied.
//
// This file therefore does NOT re-test what the tab tests already cover
// (mapping, row building, empty-guards). It covers exactly the gap: every
// query's FILTER ARGUMENT, asserted by keeping the spy handles.
// ---------------------------------------------------------------------------
import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it, vi } from 'vitest';
import { makeLoadEventSessionsData, makeLoadHoursData, makeLoadParticipationData } from './reports';

/**
 * A recording client whose `.eq`/`.in`/`.order`/`.maybeSingle` handles are
 * RETAINED, so a test can assert what each query was actually filtered on.
 *
 * Deliberately a passthrough on the data side -- it returns whatever rows the
 * caller supplied, regardless of filter. That is the point: if a loader stops
 * filtering, the DATA is unchanged and only the recorded ARGUMENTS reveal it.
 * Asserting on returned rows here would reproduce the very blind spot this
 * file exists to close.
 */
function makeRecordingClient(rows: Record<string, unknown[]> = {}) {
  const calls: { table: string; select: string; eq: unknown[][]; in: unknown[][] }[] = [];

  const fromSpy = vi.fn((table: string) => ({
    select: vi.fn((cols: string) => {
      const entry = { table, select: cols, eq: [] as unknown[][], in: [] as unknown[][] };
      calls.push(entry);
      const data = rows[table] ?? [];
      const chain: Record<string, unknown> = {
        eq: vi.fn((...args: unknown[]) => {
          entry.eq.push(args);
          return chain;
        }),
        in: vi.fn((...args: unknown[]) => {
          entry.in.push(args);
          return chain;
        }),
        order: vi.fn(() => Promise.resolve({ data, error: null })),
        maybeSingle: vi.fn(() => Promise.resolve({ data: data[0] ?? null, error: null })),
        then: (resolve: (v: { data: unknown[]; error: null }) => unknown) =>
          Promise.resolve({ data, error: null }).then(resolve),
      };
      return chain;
    }),
  }));

  return { client: { from: fromSpy } as unknown as SupabaseClient, calls, fromSpy };
}

/** Every `.eq(column, value)` recorded against one table. */
function eqArgsFor(
  calls: ReturnType<typeof makeRecordingClient>['calls'],
  table: string,
): unknown[][] {
  return calls.filter((c) => c.table === table).flatMap((c) => c.eq);
}

describe('makeLoadParticipationData -- season scoping (T163: the gap the tab tests cannot see)', () => {
  it('filters v_student_participation by the seasonId it was called with, verbatim', async () => {
    const { client, calls } = makeRecordingClient();
    await makeLoadParticipationData(() => client)('season-alpha');
    expect(eqArgsFor(calls, 'v_student_participation')).toContainEqual([
      'season_id',
      'season-alpha',
    ]);
  });

  it('passes a DIFFERENT seasonId through on a second call -- proves a real passthrough, not a constant', async () => {
    const { client, calls } = makeRecordingClient();
    const load = makeLoadParticipationData(() => client);
    await load('season-one');
    await load('season-two');
    const seasons = eqArgsFor(calls, 'v_student_participation').map(([, v]) => v);
    expect(seasons).toEqual(['season-one', 'season-two']);
  });

  it('scopes students to active only -- the filter both loaders share (module doc #98)', async () => {
    const { client, calls } = makeRecordingClient();
    await makeLoadParticipationData(() => client)('season-alpha');
    expect(eqArgsFor(calls, 'students')).toContainEqual(['is_active', true]);
  });
});

describe('makeLoadHoursData -- season scoping', () => {
  it('filters the season row, v_student_hours and events by the SAME seasonId', async () => {
    const { client, calls } = makeRecordingClient();
    await makeLoadHoursData(() => client)('season-bravo');
    // All three independent season-scoped reads must agree; a loader that
    // scoped one of them to a different season would still return plausible
    // data and is exactly what the tab tests cannot detect.
    expect(eqArgsFor(calls, 'seasons')).toContainEqual(['id', 'season-bravo']);
    expect(eqArgsFor(calls, 'v_student_hours')).toContainEqual(['season_id', 'season-bravo']);
    expect(eqArgsFor(calls, 'events')).toContainEqual(['season_id', 'season-bravo']);
  });

  // T201 -- INVERTED, not deleted. This asserted the hours roster was filtered
  // to active students. That filter was the whole defect: `v_student_hours`
  // (read unfiltered) already contained departed students' hours, and the
  // roster filter silently discarded them, making HoursTab's team subtotal
  // disagree with `v_team_hours` and so with CoachHome's "Hours by team".
  //
  // Owner ruled 2026-08-05 that the hours count: "that's actual work that was
  // done regardless if that person is no longer with the team or not."
  // `buildStudentRows` now keeps an inactive student ONLY when they have
  // hours, so the filter must NOT come back here.
  //
  // Note the participation loader above still DOES filter to active, and its
  // test still asserts that -- these two loaders legitimately differ now.
  it('does NOT filter the roster to active students -- departed members with hours must survive (T201)', async () => {
    const { client, calls } = makeRecordingClient();
    await makeLoadHoursData(() => client)('season-bravo');
    expect(eqArgsFor(calls, 'students')).not.toContainEqual(['is_active', true]);
  });

  it('never issues an empty .in(...) -- no events means no session or rsvp query', async () => {
    const { client, fromSpy } = makeRecordingClient({ events: [] });
    await makeLoadHoursData(() => client)('season-bravo');
    expect(fromSpy).toHaveBeenCalledWith('events');
    expect(fromSpy).not.toHaveBeenCalledWith('event_sessions');
    expect(fromSpy).not.toHaveBeenCalledWith('rsvps');
  });
});

describe('makeLoadEventSessionsData -- season scoping and the id chain', () => {
  it('filters events by the seasonId it was called with', async () => {
    const { client, calls } = makeRecordingClient();
    await makeLoadEventSessionsData(() => client)('season-charlie');
    expect(eqArgsFor(calls, 'events')).toContainEqual(['season_id', 'season-charlie']);
  });

  it('chains events -> sessions -> (attendance, rsvps) on the ids each stage returns', async () => {
    const { client, calls } = makeRecordingClient({
      events: [{ id: 'event-1', season_id: 'season-charlie', type: 'outreach', title: 'X' }],
      event_sessions: [
        {
          id: 'session-1',
          event_id: 'event-1',
          session_date: '2026-08-01',
          starts_at: '2026-08-01T00:00:00.000Z',
          ends_at: '2026-08-01T01:00:00.000Z',
          status: 'completed',
          people_reached: null,
        },
      ],
    });
    await makeLoadEventSessionsData(() => client)('season-charlie');
    const inArgs = (table: string) => calls.filter((c) => c.table === table).flatMap((c) => c.in);
    expect(inArgs('event_sessions')).toContainEqual(['event_id', ['event-1']]);
    expect(inArgs('attendance')).toContainEqual(['session_id', ['session-1']]);
    expect(inArgs('rsvps')).toContainEqual(['session_id', ['session-1']]);
  });

  it('never issues an empty .in(...) when a season has no events', async () => {
    const { client, fromSpy } = makeRecordingClient({ events: [] });
    await makeLoadEventSessionsData(() => client)('season-charlie');
    expect(fromSpy).toHaveBeenCalledWith('events');
    expect(fromSpy).not.toHaveBeenCalledWith('event_sessions');
    expect(fromSpy).not.toHaveBeenCalledWith('attendance');
    expect(fromSpy).not.toHaveBeenCalledWith('rsvps');
  });
});
