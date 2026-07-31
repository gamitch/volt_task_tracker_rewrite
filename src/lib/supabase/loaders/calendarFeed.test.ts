// T177: the first test for `src/lib/supabase/loaders/calendarFeed.ts` -- the
// real backend behind `SubscribePopover.tsx`'s injectable `loadCalendarFeed`
// seam. Packet §6 criteria 3/4/5.
//
// No `@vitest-environment jsdom` docblock -- `calendarFeed.ts` only imports
// page TYPES (`import type`), so this exercises pure loader logic in
// vitest's default node environment, same posture `students.test.ts`/
// `outreach.test.ts` (this directory's own existing test files) already
// established.
import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it } from 'vitest';
import { makeLoadCalendarFeed } from './calendarFeed';

// ---------------------------------------------------------------------------
// A fake `.from('calendar_feeds')` chain that ACTUALLY enforces cardinality
// the way the installed `postgrest-js` does (packet §3d/§6 criterion 3) --
// the closest existing precedent in this directory,
// `parentHome.test.ts:40-67`'s own `makeRecordingChain`, is NOT a drop-in
// match: it has no `.is()` and no `.limit()`, and its own `.maybeSingle()`
// just resolves whatever fixed `result` object it was constructed with -- it
// does not emulate real cardinality checking. This fake does: `.limit(n)`
// really slices the underlying row array; `.maybeSingle()` inspects the
// (possibly-limited) array's length -- 0 rows -> `{ data: null, error: null
// }`; 1 row -> `{ data: row, error: null }`; MORE THAN 1 row -> synthesizes
// the real `PGRST116` shape `postgrest-js` produces client-side
// (`PostgrestBuilder.ts`, confirmed against the installed source, packet
// §3d).
// ---------------------------------------------------------------------------

interface FakeCalendarFeedRow {
  id: string;
  profile_id: string;
  token: string;
  revoked_at: string | null;
  created_at: string;
}

interface RecordedCalls {
  selectArgs: unknown[];
  eqArgs: [string, unknown][];
  isArgs: [string, unknown][];
  orderArgs: [string, { ascending?: boolean } | undefined][];
  limitArgs: number[];
}

function freshRecordedCalls(): RecordedCalls {
  return { selectArgs: [], eqArgs: [], isArgs: [], orderArgs: [], limitArgs: [] };
}

interface FakeChain {
  select: (arg: unknown) => FakeChain;
  eq: (column: string, value: unknown) => FakeChain;
  is: (column: string, value: unknown) => FakeChain;
  order: (column: string, opts?: { ascending?: boolean }) => FakeChain;
  limit: (n: number) => FakeChain;
  maybeSingle: () => Promise<{
    data: FakeCalendarFeedRow | null;
    error: { code: string; message: string } | null;
  }>;
}

function filterRows(
  rows: FakeCalendarFeedRow[],
  column: string,
  value: unknown,
): FakeCalendarFeedRow[] {
  return rows.filter((row) => (row as unknown as Record<string, unknown>)[column] === value);
}

function makeCardinalityEnforcingChain(
  rows: FakeCalendarFeedRow[],
  recorded: RecordedCalls,
): FakeChain {
  let currentRows = rows;
  const chain: FakeChain = {
    select: (arg) => {
      recorded.selectArgs.push(arg);
      return chain;
    },
    eq: (column, value) => {
      recorded.eqArgs.push([column, value]);
      currentRows = filterRows(currentRows, column, value);
      return chain;
    },
    is: (column, value) => {
      recorded.isArgs.push([column, value]);
      currentRows = filterRows(currentRows, column, value);
      return chain;
    },
    order: (column, opts) => {
      recorded.orderArgs.push([column, opts]);
      const ascending = opts?.ascending ?? true;
      currentRows = [...currentRows].sort((a, b) => {
        const av = String((a as unknown as Record<string, unknown>)[column]);
        const bv = String((b as unknown as Record<string, unknown>)[column]);
        if (av === bv) return 0;
        const cmp = av < bv ? -1 : 1;
        return ascending ? cmp : -cmp;
      });
      return chain;
    },
    limit: (n) => {
      recorded.limitArgs.push(n);
      currentRows = currentRows.slice(0, n);
      return chain;
    },
    maybeSingle: () => {
      if (currentRows.length === 0) return Promise.resolve({ data: null, error: null });
      if (currentRows.length === 1) return Promise.resolve({ data: currentRows[0], error: null });
      // The real `postgrest-js` client-side cardinality-check shape (packet
      // §3d) -- a synthesized error response, NOT a genuine thrown
      // exception.
      return Promise.resolve({
        data: null,
        error: {
          code: 'PGRST116',
          message: 'JSON object requested, multiple (or no) rows returned',
        },
      });
    },
  };
  return chain;
}

function makeFakeClient(rows: FakeCalendarFeedRow[]): {
  client: SupabaseClient;
  recorded: RecordedCalls;
} {
  const recorded = freshRecordedCalls();
  const from = (table: string): FakeChain => {
    if (table !== 'calendar_feeds') {
      throw new Error(`unexpected table queried: ${table}`);
    }
    return makeCardinalityEnforcingChain(rows, recorded);
  };
  return { client: { from } as unknown as SupabaseClient, recorded };
}

// ---------------------------------------------------------------------------
// Criterion 3 -- the multi-row hazard.
// ---------------------------------------------------------------------------

describe('makeLoadCalendarFeed (T177 criterion 3 -- multi-row hazard, packet §3d)', () => {
  const olderRow: FakeCalendarFeedRow = {
    id: 'feed-real-older',
    profile_id: 'profile-real-multirow',
    token: '11111111-1111-4111-8111-111111111111',
    revoked_at: null,
    created_at: '2026-01-01T00:00:00.000Z',
  };
  const newerRow: FakeCalendarFeedRow = {
    id: 'feed-real-newer',
    profile_id: 'profile-real-multirow',
    token: '22222222-2222-4222-8222-222222222222',
    revoked_at: null,
    created_at: '2026-06-01T00:00:00.000Z',
  };

  it('resolves the MORE RECENT of two non-revoked rows for the same profileId, without rejecting', async () => {
    const { client } = makeFakeClient([olderRow, newerRow]);
    const loadCalendarFeed = makeLoadCalendarFeed(() => client);

    await expect(loadCalendarFeed('profile-real-multirow')).resolves.toEqual({
      id: 'feed-real-newer',
      profileId: 'profile-real-multirow',
      token: '22222222-2222-4222-8222-222222222222',
      revokedAt: null,
      createdAt: '2026-06-01T00:00:00.000Z',
    });
  });

  it('orders by created_at descending and limits to 1 BEFORE .maybeSingle() (the actual fix -- packet §3d)', async () => {
    const { client, recorded } = makeFakeClient([olderRow, newerRow]);
    const loadCalendarFeed = makeLoadCalendarFeed(() => client);

    await loadCalendarFeed('profile-real-multirow');

    expect(recorded.orderArgs).toEqual([['created_at', { ascending: false }]]);
    expect(recorded.limitArgs).toEqual([1]);
  });

  it("supplies explicit .eq('profile_id', ...) and .is('revoked_at', null) filters, not RLS-only (packet §4/criterion 5)", async () => {
    const { client, recorded } = makeFakeClient([]);
    const loadCalendarFeed = makeLoadCalendarFeed(() => client);

    await loadCalendarFeed('profile-real-filters').catch(() => {
      // Zero rows rejects (criterion 4, below) -- irrelevant to this
      // assertion, which only inspects the recorded query arguments.
    });

    expect(recorded.eqArgs).toEqual([['profile_id', 'profile-real-filters']]);
    expect(recorded.isArgs).toEqual([['revoked_at', null]]);
  });

  it("the fake's own cardinality emulation synthesizes PGRST116 when .order()/.limit(1) are skipped and two rows still match (mutation-sensitivity guard, packet §6 criterion 3's own mutation, simulated directly against the fake)", async () => {
    const recorded = freshRecordedCalls();
    const chain = makeCardinalityEnforcingChain([olderRow, newerRow], recorded);

    // Simulates the mutated query: `.eq(...).is(...).maybeSingle()`, with
    // `.order(...)/.limit(1)` genuinely never called -- both rows still
    // match `eq`/`is`, so `.maybeSingle()` sees an unfiltered two-row array.
    chain.eq('profile_id', 'profile-real-multirow');
    chain.is('revoked_at', null);
    const result = await chain.maybeSingle();

    expect(result).toEqual({
      data: null,
      error: {
        code: 'PGRST116',
        message: 'JSON object requested, multiple (or no) rows returned',
      },
    });
  });
});

// ---------------------------------------------------------------------------
// Criterion 4 -- missing-row posture: fail loud, not fixture-shaped.
// ---------------------------------------------------------------------------

describe('makeLoadCalendarFeed (T177 criterion 4 -- missing-row posture, packet §3e/§3f)', () => {
  it('rejects with a real Error on zero active rows -- never resolves anything shaped like the fixture', async () => {
    const { client } = makeFakeClient([]);
    const loadCalendarFeed = makeLoadCalendarFeed(() => client);

    await expect(loadCalendarFeed('profile-real-none')).rejects.toThrow(
      'No calendar feed was found for your account.',
    );
  });

  it('rejects the same way when every existing row for the profile is revoked (no non-revoked candidate)', async () => {
    const revokedRow: FakeCalendarFeedRow = {
      id: 'feed-real-revoked',
      profile_id: 'profile-real-all-revoked',
      token: '33333333-3333-4333-8333-333333333333',
      revoked_at: '2026-05-01T00:00:00.000Z',
      created_at: '2026-04-01T00:00:00.000Z',
    };
    const { client } = makeFakeClient([revokedRow]);
    const loadCalendarFeed = makeLoadCalendarFeed(() => client);

    await expect(loadCalendarFeed('profile-real-all-revoked')).rejects.toThrow(
      'No calendar feed was found for your account.',
    );
  });
});
