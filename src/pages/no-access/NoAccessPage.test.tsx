// @vitest-environment jsdom
/**
 * T102 (ED-1 Packet P13): first dedicated test file for `NoAccessPage.tsx`
 * (T020, Passed, had no component-level tests of its own before this task --
 * confirmed via `git log -- src/pages/no-access/` before writing this file;
 * the RLS-denial guarantees this screen ultimately relies on are covered by
 * a separate `tests/rls/**` suite this task does not touch).
 *
 * Two independent things are exercised here:
 *   1. A baseline render/behavior smoke test with an injected `loadData`
 *      fixture -- sign-out-on-mount still fires, and the resolved
 *      `contactName` renders into the `EmptyState` description -- proving
 *      this task's `AuthProvider`/`loadData` wiring changes did not disturb
 *      T020's pre-existing, already-Passed behavior.
 *   2. `loadNoAccessData`/`makeLoadNoAccessData` (T102's real load, Trap #3)
 *      against a stubbed `SupabaseClient` only -- same DI pattern
 *      `InvitesTab.test.tsx`'s `loadInvitesTabData` suite and
 *      `src/lib/supabase/loader.test.ts` already establish, zero real
 *      network calls -- proving the "exactly one admin -> real name; zero or
 *      two-or-more -> honest fallback" decision documented in
 *      `NoAccessPage.tsx`'s own "T102 -- Trap #3 investigation" module-doc
 *      section.
 *
 * No `@testing-library/react` is installed in this repo (confirmed via
 * `package.json`) -- the render tests use the same raw `createRoot`/`act`
 * pattern every other test file in this project already established (e.g.
 * `AccessDeniedPage.test.tsx`, this screen's own sibling in the same
 * directory).
 */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import type { SupabaseClient } from '@supabase/supabase-js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthProvider, type AuthModule } from '../../app/guards';
import type { AuthSession, RoleResolution } from '../../lib/supabase/auth';
import { NoAccessPage, defaultLoadNoAccessData, makeLoadNoAccessData } from './NoAccessPage';

// ---------------------------------------------------------------------------
// 1. Baseline render/behavior smoke test -- injected `loadData` fixture.
// ---------------------------------------------------------------------------

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => {
    root.unmount();
  });
  container.remove();
  vi.restoreAllMocks();
});

async function flushMicrotasks(): Promise<void> {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });
}

/** Same shape `AccessDeniedPage.test.tsx` already establishes for a
 * signed-in-but-no-profile session -- only `signOut` is meaningful here. */
function buildAuthModule(signOut: AuthModule['signOut']): AuthModule {
  return {
    getInitialSession: async (): Promise<AuthSession | null> => null,
    subscribeToAuthStateChange: () => () => {},
    signInWithPassword: async () => {
      throw new Error('not used by this test');
    },
    signInWithGoogle: async () => {
      throw new Error('not used by this test');
    },
    signOut,
    resolveRole: async (): Promise<RoleResolution> => ({ status: 'no-profile' }),
  };
}

describe('<NoAccessPage /> baseline render (T020, unchanged by T102)', () => {
  it('signs out on mount and renders the resolved contactName from the injected loadData seam', async () => {
    const signOut = vi.fn(async () => {});
    const authModule = buildAuthModule(signOut);

    act(() => {
      root.render(
        <MemoryRouter>
          <AuthProvider authModule={authModule}>
            <NoAccessPage loadData={async () => ({ contactName: 'Priya Sharma' })} />
          </AuthProvider>
        </MemoryRouter>,
      );
    });
    await flushMicrotasks();

    expect(signOut).toHaveBeenCalledTimes(1);
    expect(container.textContent).toContain("You're not on the roster yet.");
    expect(container.textContent).toContain('Priya Sharma');
  });

  it('keeps the generic fallback name when loadData is not supplied (defaultLoadNoAccessData)', async () => {
    const authModule = buildAuthModule(vi.fn(async () => {}));

    act(() => {
      root.render(
        <MemoryRouter>
          <AuthProvider authModule={authModule}>
            <NoAccessPage loadData={defaultLoadNoAccessData} />
          </AuthProvider>
        </MemoryRouter>,
      );
    });
    await flushMicrotasks();

    expect(container.textContent).toContain('your coach or team admin');
  });
});

// ---------------------------------------------------------------------------
// 2. `loadNoAccessData`/`makeLoadNoAccessData` (T102 real load, Trap #3) --
// stubbed `SupabaseClient` only, same DI pattern as
// `InvitesTab.test.tsx`/`src/lib/supabase/loader.test.ts`.
// ---------------------------------------------------------------------------

/** Minimal fake `SupabaseClient` supporting exactly the chain
 * `client.from('profiles').select('display_name').eq('role', 'admin')
 * .order('created_at', {...}).limit(2)` used -- nothing else on the client
 * is ever touched by `queryAdminProfiles`. */
function makeFakeAdminProfilesClient(result: { data: unknown; error: unknown }): {
  client: SupabaseClient;
  fromSpy: ReturnType<typeof vi.fn>;
  selectSpy: ReturnType<typeof vi.fn>;
  eqSpy: ReturnType<typeof vi.fn>;
  orderSpy: ReturnType<typeof vi.fn>;
  limitSpy: ReturnType<typeof vi.fn>;
} {
  const limitSpy = vi.fn().mockResolvedValue(result);
  const orderSpy = vi.fn(() => ({ limit: limitSpy }));
  const eqSpy = vi.fn(() => ({ order: orderSpy }));
  const selectSpy = vi.fn(() => ({ eq: eqSpy }));
  const fromSpy = vi.fn(() => ({ select: selectSpy }));
  const client = { from: fromSpy } as unknown as SupabaseClient;
  return { client, fromSpy, selectSpy, eqSpy, orderSpy, limitSpy };
}

describe('loadNoAccessData (T102 real load, Trap #3)', () => {
  it('uses the single admin profile’s display_name when exactly one admin exists', async () => {
    const { client, fromSpy, selectSpy, eqSpy, orderSpy, limitSpy } = makeFakeAdminProfilesClient({
      data: [{ display_name: 'Priya Sharma' }],
      error: null,
    });
    const load = makeLoadNoAccessData(() => client);

    const result = await load();

    expect(fromSpy).toHaveBeenCalledWith('profiles');
    expect(selectSpy).toHaveBeenCalledWith('display_name');
    expect(eqSpy).toHaveBeenCalledWith('role', 'admin');
    expect(orderSpy).toHaveBeenCalledWith('created_at', { ascending: true });
    expect(limitSpy).toHaveBeenCalledWith(2);
    expect(result).toEqual({ contactName: 'Priya Sharma' });
  });

  it('falls back to the honest generic contact when zero admin profiles exist', async () => {
    const { client } = makeFakeAdminProfilesClient({ data: [], error: null });
    const load = makeLoadNoAccessData(() => client);

    const result = await load();

    expect(result).toEqual({ contactName: 'your coach or team admin' });
  });

  it('falls back to the honest generic contact when TWO OR MORE admin profiles exist (no way to know which one is "the" contact)', async () => {
    const { client } = makeFakeAdminProfilesClient({
      data: [{ display_name: 'Priya Sharma' }, { display_name: 'Jordan Rivera' }],
      error: null,
    });
    const load = makeLoadNoAccessData(() => client);

    const result = await load();

    expect(result).toEqual({ contactName: 'your coach or team admin' });
  });

  it('bridges the "no rows" (data: null, error: null) case to the fallback, not a crash', async () => {
    const { client } = makeFakeAdminProfilesClient({ data: null, error: null });
    const load = makeLoadNoAccessData(() => client);

    const result = await load();

    expect(result).toEqual({ contactName: 'your coach or team admin' });
  });

  it('rejects with the real SupabaseLoaderError on a genuine query error -- no fixture fallback', async () => {
    const { client } = makeFakeAdminProfilesClient({
      data: null,
      error: { message: 'permission denied for table profiles', code: '42501' },
    });
    const load = makeLoadNoAccessData(() => client);

    await expect(load()).rejects.toMatchObject({ code: '42501', message: expect.any(String) });
  });
});
