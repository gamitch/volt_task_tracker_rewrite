// GAM-305 (legacy T615) criterion 5 -- select-string guard for the `teams`
// query this loader's `queryTeams` runs, mirroring `outreach.test.ts`'s own
// `parseSelectedColumns` T146 guard pattern (cited by this task's packet).
// `tsc` cannot catch a dropped `archived` column here: `meetings.ts:405`
// casts the query result to `TeamDbRow[] | null`, which *asserts* `archived`
// is present regardless of what the query actually asked for -- only reading
// the recorded `.select()` argument catches a revert.
//
// This is the FIRST test file for this loader module (no `meetings.test.ts`
// existed before this task, per the packet's own Allowed Files note).
//
// No `@vitest-environment jsdom` docblock -- `meetings.ts` value-imports two
// LAZY page modules (`MeetingsList.tsx`/`ScheduleMeetingsDialog.tsx`, see
// `src/lib/meetings/resolveCurrentStudentId.ts`'s own module doc), but
// neither of those pulls in any DOM-dependent code path this test exercises
// -- `outreach.test.ts`/`coachHome.test.ts` establish the same "loader tests
// run in vitest's default node environment" posture for this directory.
import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it, vi } from 'vitest';
import { makeLoadCoachMeetingsData } from './meetings';

/** Same helper `outreach.test.ts` already established for this exact
 * purpose -- reused verbatim, not re-derived. */
function parseSelectedColumns(selectArg: unknown): Set<string> {
  const raw = String(selectArg);
  if (raw.trim() === '*') return new Set(['*']);
  return new Set(raw.split(',').map((column) => column.trim()));
}

/** Thenable passthrough chain -- `queryTeams`/`querySessions` chain
 * `.order(...)` after `.select(...)`, `queryEvents`/`queryAttendance`/
 * `queryRsvps`/`queryStudents` await `.select(...)` directly. Both shapes
 * are supported by making the returned object both thenable AND carry an
 * `.order()` method that resolves the same way. */
function makeThenableChain(rows: unknown[] | null) {
  const resolved = Promise.resolve({ data: rows, error: null });
  const orderSpy = vi.fn(() => resolved);
  return {
    then: resolved.then.bind(resolved),
    order: orderSpy,
    orderSpy,
  };
}

type ExtraRows = Partial<Record<string, unknown[] | null>>;

function makeRecordingClient(teams: unknown[] | null, extra: ExtraRows = {}) {
  const teamsChain = makeThenableChain(teams);
  const teamsSelectSpy = vi.fn(() => teamsChain);

  const OTHER_TABLES = ['events', 'event_sessions', 'attendance', 'rsvps', 'students'] as const;
  const selectSpies: Record<string, ReturnType<typeof vi.fn>> = {};
  for (const table of OTHER_TABLES) {
    const chain = makeThenableChain(extra[table] ?? []);
    selectSpies[table] = vi.fn(() => chain);
  }

  const fromSpy = vi.fn((table: string) => {
    if (table === 'teams') return { select: teamsSelectSpy };
    if (selectSpies[table]) return { select: selectSpies[table] };
    throw new Error(`unexpected table: ${table}`);
  });

  return {
    client: { from: fromSpy } as unknown as SupabaseClient,
    fromSpy,
    teamsSelectSpy,
    teamsChain,
  };
}

describe('queryTeams (via makeLoadCoachMeetingsData) -- GAM-305 criterion 5 select-string guard', () => {
  it("asks the `teams` table for `archived` (plus `id`/`name`), and threads a stubbed row's archived flag through to the loader's result", async () => {
    const { client, teamsSelectSpy } = makeRecordingClient([
      { id: 'team-active', name: 'Active Team', archived: false },
      { id: 'team-archived', name: 'Legacy Forge', archived: true },
    ]);

    const load = makeLoadCoachMeetingsData(() => client);
    const data = await load();

    expect(teamsSelectSpy).toHaveBeenCalledTimes(1);
    const [recordedSelectArg] = teamsSelectSpy.mock.calls[0] as unknown as [string];
    const columns = parseSelectedColumns(recordedSelectArg);
    const askedForArchived = columns.has('*') || columns.has('archived');
    expect(askedForArchived).toBe(true);
    if (!columns.has('*')) {
      expect(columns.has('id')).toBe(true);
      expect(columns.has('name')).toBe(true);
    }

    // The mapper hop (`mapTeamDbRow`): a stubbed `archived` on the raw DB
    // row must survive into the loader's own `teams` result, not just get
    // asked for.
    expect(data.teams).toEqual([
      { id: 'team-active', name: 'Active Team', archived: false },
      { id: 'team-archived', name: 'Legacy Forge', archived: true },
    ]);
  });

  it('resolves an empty array (never null) for teams when zero rows are found', async () => {
    const { client } = makeRecordingClient(null);
    const load = makeLoadCoachMeetingsData(() => client);
    const data = await load();
    expect(data.teams).toEqual([]);
  });
});
