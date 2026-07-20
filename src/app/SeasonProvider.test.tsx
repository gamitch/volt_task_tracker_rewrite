// @vitest-environment jsdom
/**
 * T091 (ED-1 Packet P4): tests for `SeasonProvider.tsx`/`useActiveSeason()`
 * -- the ONE shared active-season mechanism this packet builds -- plus
 * loader-level tests for `../lib/supabase/loaders/seasons.ts`'s
 * `makeLoadActiveSeason`/`makeSetActiveSeason` (that module has no dedicated
 * test file of its own, same posture `loaders/invites.ts`/T087 already
 * established: its loader-level tests live inside its one real consumer's
 * test file). `makeSetActiveSeason`'s own two-step-mutation tests
 * (including the Trap #1 failure-midway scenario) live HERE specifically,
 * per the worker packet's own explicit instruction for this file --
 * `makeLoadSeasons`/`makeCreateSeason`/`makeUpdateSeason` (the other three
 * CRUD loader functions `SeasonSettings.tsx` consumes) are tested in
 * `../pages/settings/SeasonSettings.test.tsx` instead, alongside that file's
 * own component-level CRUD proof.
 *
 * Covers all four `ActiveSeasonState` statuses (`SeasonProvider.tsx`'s own
 * module doc), including `'none'` as the real, first-class "zero seasons in
 * the database today" outcome -- never conflated with `'error'` and never
 * silently bridged to fixture data anywhere in this file (grep-provable: no
 * `FIXTURE_`/`PLACEHOLDER_` literal exists in this file at all).
 *
 * No `@testing-library/react` installed in this repo -- same raw
 * `createRoot`/`act` + a tiny test-only consumer component pattern every
 * other context-provider test file in this project already uses (mirrors
 * `guards.test.tsx`'s own `AuthProvider`/`useAuth()` coverage shape, the one
 * prior shared-context precedent in this codebase).
 */
import { act, Component, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it, vi } from 'vitest';
import { makeLoadActiveSeason, makeSetActiveSeason } from '../lib/supabase/loaders/seasons';
import type { SeasonRow } from '../lib/supabase/types';
import { SeasonProvider, useActiveSeason, type LoadActiveSeasonFn } from './SeasonProvider';

// ---------------------------------------------------------------------------
// SeasonProvider / useActiveSeason() -- render harness.
// ---------------------------------------------------------------------------

let container: HTMLDivElement;
let root: Root;

function setUpContainer(): void {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
}

function tearDownContainer(): void {
  act(() => {
    root.unmount();
  });
  container.remove();
}

async function flushMicrotasks(): Promise<void> {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });
}

/** Tiny test-only consumer -- renders `useActiveSeason()`'s current state as
 * plain text/attributes so tests can assert on it via the DOM, same pattern
 * every raw-`createRoot` test file in this project already uses (no
 * `@testing-library/react` installed). */
function SeasonStateProbe(): ReactNode {
  const state = useActiveSeason();
  return (
    <div data-testid="season-state" data-status={state.status}>
      {state.status === 'ready' && <span data-testid="season-id">{state.season.id}</span>}
      {state.status === 'error' && <span data-testid="season-error">{state.error.message}</span>}
      <button type="button" onClick={() => state.refresh()} data-testid="refresh-button">
        Refresh
      </button>
    </div>
  );
}

function renderProbe(loadActiveSeason: LoadActiveSeasonFn): void {
  act(() => {
    root.render(
      <SeasonProvider loadActiveSeason={loadActiveSeason}>
        <SeasonStateProbe />
      </SeasonProvider>,
    );
  });
}

function statusOf(): string | null {
  return (
    document.querySelector('[data-testid="season-state"]')?.getAttribute('data-status') ?? null
  );
}

const FIXTURE_SEASON: SeasonRow = {
  id: 'season-active-1',
  name: 'Active Season',
  startsOn: '2025-08-01',
  endsOn: '2026-06-30',
  defaultGoalHours: 100,
  isActive: true,
  createdAt: '2025-08-01T00:00:00.000Z',
};

describe('<SeasonProvider /> / useActiveSeason() (T091 shared mechanism)', () => {
  it('starts in the `loading` state before loadActiveSeason resolves', () => {
    setUpContainer();
    try {
      renderProbe(() => new Promise(() => {}));
      expect(statusOf()).toBe('loading');
    } finally {
      tearDownContainer();
    }
  });

  it('resolves to `ready` with the real season when loadActiveSeason resolves a row', async () => {
    setUpContainer();
    try {
      renderProbe(async () => FIXTURE_SEASON);
      await flushMicrotasks();
      expect(statusOf()).toBe('ready');
      expect(document.querySelector('[data-testid="season-id"]')?.textContent).toBe(
        'season-active-1',
      );
    } finally {
      tearDownContainer();
    }
  });

  it('resolves to the real, first-class `none` state when loadActiveSeason resolves null (zero seasons in the database today)', async () => {
    setUpContainer();
    try {
      renderProbe(async () => null);
      await flushMicrotasks();
      expect(statusOf()).toBe('none');
    } finally {
      tearDownContainer();
    }
  });

  it('resolves to `error` (never `none`) when loadActiveSeason rejects with a SupabaseLoaderError, preserving its message', async () => {
    setUpContainer();
    try {
      renderProbe(async () => {
        throw { code: '42501', message: 'Permission denied.', cause: null };
      });
      await flushMicrotasks();
      expect(statusOf()).toBe('error');
      expect(document.querySelector('[data-testid="season-error"]')?.textContent).toBe(
        'Permission denied.',
      );
    } finally {
      tearDownContainer();
    }
  });

  it('normalizes a non-SupabaseLoaderError rejection into a displayable `error` state too', async () => {
    setUpContainer();
    try {
      renderProbe(async () => {
        throw new Error('boom');
      });
      await flushMicrotasks();
      expect(statusOf()).toBe('error');
      expect(document.querySelector('[data-testid="season-error"]')?.textContent).toBe('boom');
    } finally {
      tearDownContainer();
    }
  });

  it('refresh() re-runs loadActiveSeason and picks up a new resolved value', async () => {
    setUpContainer();
    try {
      let callCount = 0;
      const loadActiveSeason: LoadActiveSeasonFn = async () => {
        callCount += 1;
        return callCount === 1 ? null : FIXTURE_SEASON;
      };
      renderProbe(loadActiveSeason);
      await flushMicrotasks();
      expect(statusOf()).toBe('none');
      expect(callCount).toBe(1);

      act(() => {
        document.querySelector<HTMLButtonElement>('[data-testid="refresh-button"]')?.click();
      });
      await flushMicrotasks();

      expect(callCount).toBe(2);
      expect(statusOf()).toBe('ready');
    } finally {
      tearDownContainer();
    }
  });

  it('useActiveSeason() throws when called outside a <SeasonProvider> (fail loud, same posture as useAuth())', () => {
    // A minimal class-based error boundary -- React re-renders synchronously
    // through `act()` either way, but catching via a real boundary (rather
    // than asserting `root.render()` itself throws) avoids depending on
    // exactly how the installed React version propagates an uncaught render
    // error through `act()`/`createRoot`, which this codebase has no other
    // existing test asserting on.
    class CaughtErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
      state: { error: Error | null } = { error: null };
      static getDerivedStateFromError(error: Error): { error: Error } {
        return { error };
      }
      render(): ReactNode {
        if (this.state.error) {
          return <div data-testid="boundary-error">{this.state.error.message}</div>;
        }
        return this.props.children;
      }
    }

    setUpContainer();
    try {
      act(() => {
        root.render(
          <CaughtErrorBoundary>
            <SeasonStateProbe />
          </CaughtErrorBoundary>,
        );
      });
      expect(document.querySelector('[data-testid="boundary-error"]')?.textContent).toBe(
        'useActiveSeason() must be called within a <SeasonProvider>.',
      );
    } finally {
      tearDownContainer();
    }
  });
});

// ---------------------------------------------------------------------------
// makeLoadActiveSeason (T091 real load) -- ../lib/supabase/loaders/seasons.ts
// ---------------------------------------------------------------------------

/** Minimal fake `SupabaseClient` supporting exactly the chain
 * `client.from('seasons').select('*').eq('is_active', true).maybeSingle()`. */
function makeFakeActiveSeasonClient(result: { data: unknown; error: unknown }): {
  client: SupabaseClient;
  fromSpy: ReturnType<typeof vi.fn>;
  selectSpy: ReturnType<typeof vi.fn>;
  eqSpy: ReturnType<typeof vi.fn>;
  maybeSingleSpy: ReturnType<typeof vi.fn>;
} {
  const maybeSingleSpy = vi.fn().mockResolvedValue(result);
  const eqSpy = vi.fn(() => ({ maybeSingle: maybeSingleSpy }));
  const selectSpy = vi.fn(() => ({ eq: eqSpy }));
  const fromSpy = vi.fn(() => ({ select: selectSpy }));
  const client = { from: fromSpy } as unknown as SupabaseClient;
  return { client, fromSpy, selectSpy, eqSpy, maybeSingleSpy };
}

describe('makeLoadActiveSeason (T091 real load, loaders/seasons.ts)', () => {
  it('queries seasons where is_active = true via maybeSingle and maps the row to the shared SeasonRow', async () => {
    const dbRow = {
      id: 'season-db-active',
      name: '2025-2026 Season',
      starts_on: '2025-08-01',
      ends_on: '2026-06-30',
      default_goal_hours: 100,
      is_active: true,
      created_at: '2025-07-01T00:00:00.000Z',
    };
    const { client, fromSpy, selectSpy, eqSpy } = makeFakeActiveSeasonClient({
      data: dbRow,
      error: null,
    });
    const load = makeLoadActiveSeason(() => client);

    const result = await load();

    expect(fromSpy).toHaveBeenCalledWith('seasons');
    expect(selectSpy).toHaveBeenCalledWith('*');
    expect(eqSpy).toHaveBeenCalledWith('is_active', true);
    expect(result).toEqual({
      id: 'season-db-active',
      name: '2025-2026 Season',
      startsOn: '2025-08-01',
      endsOn: '2026-06-30',
      defaultGoalHours: 100,
      isActive: true,
      createdAt: '2025-07-01T00:00:00.000Z',
    });
  });

  it('bridges the "no rows" (data: null, error: null) case to null -- the real "zero seasons active" outcome, not an error', async () => {
    const { client } = makeFakeActiveSeasonClient({ data: null, error: null });
    const load = makeLoadActiveSeason(() => client);

    expect(await load()).toBeNull();
  });

  it('rejects with the real SupabaseLoaderError on a genuine query error -- no fixture fallback', async () => {
    const { client } = makeFakeActiveSeasonClient({
      data: null,
      error: { message: 'permission denied for table seasons', code: '42501' },
    });
    const load = makeLoadActiveSeason(() => client);

    await expect(load()).rejects.toMatchObject({ code: '42501', message: expect.any(String) });
  });
});

// ---------------------------------------------------------------------------
// makeSetActiveSeason (T091 real two-step mutation, Trap #1) --
// ../lib/supabase/loaders/seasons.ts
// ---------------------------------------------------------------------------

/** Fake `SupabaseClient` supporting `client.from('seasons').update({...})
 * .eq('id', ...)`, resolving each SEQUENTIAL call against `results[i]` in
 * order -- lets a test observe/control the deactivate call (1st) and the
 * activate call (2nd) independently. */
function makeFakeSequentialUpdateClient(
  results: ReadonlyArray<{ data: unknown; error: unknown }>,
): {
  client: SupabaseClient;
  fromSpy: ReturnType<typeof vi.fn>;
  updateCalls: unknown[];
  eqCalls: Array<[string, string]>;
} {
  const updateCalls: unknown[] = [];
  const eqCalls: Array<[string, string]> = [];
  let callIndex = 0;
  const fromSpy = vi.fn(() => ({
    update: (payload: unknown) => {
      updateCalls.push(payload);
      return {
        eq: (column: string, value: string) => {
          eqCalls.push([column, value]);
          const result = results[callIndex];
          callIndex += 1;
          return Promise.resolve(result);
        },
      };
    },
  }));
  const client = { from: fromSpy } as unknown as SupabaseClient;
  return { client, fromSpy, updateCalls, eqCalls };
}

describe('makeSetActiveSeason (T091 real two-step mutation, Trap #1)', () => {
  it('deactivates the old season FIRST, then activates the new one -- two separate ordered calls, never a combined update', async () => {
    const { client, fromSpy, updateCalls, eqCalls } = makeFakeSequentialUpdateClient([
      { data: null, error: null },
      { data: null, error: null },
    ]);
    const setActiveSeason = makeSetActiveSeason(() => client);

    await setActiveSeason({ activateSeasonId: 'season-new', deactivateSeasonId: 'season-old' });

    expect(fromSpy).toHaveBeenCalledTimes(2);
    expect(fromSpy).toHaveBeenNthCalledWith(1, 'seasons');
    expect(fromSpy).toHaveBeenNthCalledWith(2, 'seasons');
    // Deactivate first (is_active: false, the OLD season id) ...
    expect(updateCalls[0]).toEqual({ is_active: false });
    expect(eqCalls[0]).toEqual(['id', 'season-old']);
    // ... THEN activate (is_active: true, the NEW season id).
    expect(updateCalls[1]).toEqual({ is_active: true });
    expect(eqCalls[1]).toEqual(['id', 'season-new']);
  });

  it('skips the deactivate call entirely when deactivateSeasonId is null (activating the very first season)', async () => {
    const { client, fromSpy, updateCalls, eqCalls } = makeFakeSequentialUpdateClient([
      { data: null, error: null },
    ]);
    const setActiveSeason = makeSetActiveSeason(() => client);

    await setActiveSeason({ activateSeasonId: 'season-only', deactivateSeasonId: null });

    expect(fromSpy).toHaveBeenCalledTimes(1);
    expect(updateCalls).toEqual([{ is_active: true }]);
    expect(eqCalls).toEqual([['id', 'season-only']]);
  });

  it('Trap #1 disclosed risk: if deactivate succeeds but activate then rejects, the deactivate write already landed (zero seasons active) and the overall promise rejects', async () => {
    const { client, updateCalls } = makeFakeSequentialUpdateClient([
      { data: null, error: null }, // deactivate succeeds
      { data: null, error: { message: 'network down', code: 'UNKNOWN' } }, // activate fails
    ]);
    const setActiveSeason = makeSetActiveSeason(() => client);

    await expect(
      setActiveSeason({ activateSeasonId: 'season-new', deactivateSeasonId: 'season-old' }),
    ).rejects.toMatchObject({ code: 'UNKNOWN' });

    // BOTH calls were attempted (deactivate landed, activate was attempted
    // and failed) -- proving the database is left with the old season
    // deactivated and the new one NOT yet activated (zero active seasons)
    // until a caller retries the same payload (SeasonSettings.tsx's own
    // T082 retry Banner is that caller in the real app).
    expect(updateCalls).toEqual([{ is_active: false }, { is_active: true }]);
  });

  it('never calls activate at all if the deactivate call itself rejects (fails before landing anything for the new season)', async () => {
    const { client, updateCalls } = makeFakeSequentialUpdateClient([
      { data: null, error: { message: 'network down', code: 'UNKNOWN' } }, // deactivate fails
      { data: null, error: null }, // would-be activate result, never reached
    ]);
    const setActiveSeason = makeSetActiveSeason(() => client);

    await expect(
      setActiveSeason({ activateSeasonId: 'season-new', deactivateSeasonId: 'season-old' }),
    ).rejects.toMatchObject({ code: 'UNKNOWN' });

    // Only the (failed) deactivate call happened -- activate was never
    // attempted once deactivate itself rejected.
    expect(updateCalls).toEqual([{ is_active: false }]);
  });
});
