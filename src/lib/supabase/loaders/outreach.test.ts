// T146: the first test in `src/lib/supabase/loaders/` -- guards the loader
// hop T143 fixed (`queryAllTeams`'s `.select()` growing `color`) against a
// silent revert. `tsc` cannot catch a dropped column here: `outreach.ts:734`
// casts the query result to `TeamDbRow[] | null`, which *asserts* `color` is
// present regardless of what the query actually asked for. This test reads
// the recorded `.select()` argument for the `teams` query directly, so a
// revert to `.select('id, name')` fails it even though the cast still
// compiles and every other DOM/loader test stays green (see this task's
// packet for the reverted-string reproduction).
//
// No `@vitest-environment jsdom` docblock -- `outreach.ts` only imports page
// types (`import type`), so this exercises pure loader logic in vitest's
// default node environment.
import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it, vi } from 'vitest';
import { makeLoadOutreachDetail } from './outreach';

/**
 * Splits a recorded `.select()` argument into a normalised set of column
 * names (split on `,`, trim). A bare `'*'` is returned as its own single-
 * element set -- `select('*')` returns every column, so it satisfies any
 * "does the select ask for column X" check by construction (it's the
 * existing pattern for this exact table: `teams.ts:173`, `students.ts:185`).
 * Asserting against this parsed set, rather than string-equality against a
 * literal like `'id, name, color'`, means a harmless reordering or
 * whitespace change never fails the test -- only an actually-dropped column
 * does.
 */
function parseSelectedColumns(selectArg: unknown): Set<string> {
  const raw = String(selectArg);
  if (raw.trim() === '*') return new Set(['*']);
  return new Set(raw.split(',').map((column) => column.trim()));
}

describe('queryAllTeams (via makeLoadOutreachDetail) -- T146 select-string guard', () => {
  it("asks the `teams` table for `color` (plus `id`/`name`), and threads a stubbed row's color through to the loader's result", async () => {
    // `outreach.ts:873` short-circuits (`if (eventRow === null) return null`)
    // before the teams query ever fires, so the event stub MUST resolve a
    // non-null row -- a minimal one suffices since
    // `mapEventDbRowToOutreachDetailEvent` is a pure field copy.
    const eventMaybeSingleSpy = vi.fn().mockResolvedValue({
      data: {
        id: 'event-1',
        season_id: 'season-1',
        type: 'outreach',
        title: 'Food Bank',
        description: '',
        location_name: 'X',
        address: '',
        team_ids: null,
        counts_participation: false,
        counts_volunteer_hours: true,
        adult_volunteers_count: 0,
        adult_volunteer_hours: 0,
        created_by: null,
      },
      error: null,
    });
    // Empty sessions: `.in()` for rsvps is only reached when the sessions
    // stub returns a non-empty array, so leaving it empty keeps `rsvps`
    // (and, since `created_by` is null above, `profiles`) out of the picture
    // entirely -- this test only needs to observe the `teams` query.
    const sessionsOrderSpy = vi.fn().mockResolvedValue({ data: [], error: null });
    const studentsOrderSpy = vi.fn().mockResolvedValue({ data: [], error: null });

    // The recorder: captures the exact argument `queryAllTeams` passes to
    // `.select()` for the `teams` table, per this task's injectable-seam
    // instruction (`makeLoadOutreachDetail`'s `getClient` factory) rather
    // than exporting the module-private `queryAllTeams` itself.
    const teamsSelectSpy = vi.fn(() => ({
      order: vi.fn().mockResolvedValue({
        data: [{ id: 't1', name: 'Ravens', color: 'blue' }],
        error: null,
      }),
    }));

    const fromSpy = vi.fn((table: string) => {
      if (table === 'events') {
        return {
          select: vi.fn(() => ({ eq: vi.fn(() => ({ maybeSingle: eventMaybeSingleSpy })) })),
        };
      }
      if (table === 'event_sessions') {
        return { select: vi.fn(() => ({ eq: vi.fn(() => ({ order: sessionsOrderSpy })) })) };
      }
      if (table === 'students') {
        return { select: vi.fn(() => ({ order: studentsOrderSpy })) };
      }
      if (table === 'teams') {
        return { select: teamsSelectSpy };
      }
      throw new Error(`unexpected table: ${table}`);
    });
    const client = { from: fromSpy } as unknown as SupabaseClient;

    const load = makeLoadOutreachDetail(() => client);
    const result = await load('event-1');

    expect(teamsSelectSpy).toHaveBeenCalledTimes(1);
    // `teamsSelectSpy` is deliberately untyped-as-to-arity above (a bare
    // `vi.fn(() => ...)`) so it can serve as both the recorder and the
    // chain's actual implementation without a dead parameter; the recorded
    // argument is read back here via the mock's call log instead.
    const [recordedSelectArg] = teamsSelectSpy.mock.calls[0] as unknown as [string];
    const columns = parseSelectedColumns(recordedSelectArg);
    const askedForColor = columns.has('*') || columns.has('color');
    expect(askedForColor).toBe(true);
    if (!columns.has('*')) {
      expect(columns.has('id')).toBe(true);
      expect(columns.has('name')).toBe(true);
    }

    // The mapper hop (`mapTeamDbRowToTeamOption`, outreach.ts:607-609): a
    // stubbed `color` on the raw DB row must survive into the loader's
    // reshaped result, not just get asked for.
    expect(result?.teams).toEqual([{ id: 't1', name: 'Ravens', color: 'blue' }]);
  });
});
