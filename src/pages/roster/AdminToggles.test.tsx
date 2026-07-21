// @vitest-environment jsdom
/**
 * T028: tests for `AdminToggles.tsx`. T104 (ED-1 Packet P11) UPDATE: adds
 * coverage for the now-real `loadPrivacySetting`/`onTogglePrivacy` defaults
 * (`../../lib/supabase/loaders/leaderboard_privacy.ts`) and removes the
 * now-stale schema-gap-disclosure-`Banner` describe block (that `Banner` no
 * longer exists in `AdminToggles.tsx` -- module doc #2 UPDATE there).
 *
 * Per this task's Allowed Files ("A colocated `AdminToggles.test.tsx` is
 * acceptable per established precedent") this is a deliberate, disclosed
 * addition, the same class of addition `StudentsTab.test.tsx`/T022 and
 * `LiveConsole.test.tsx`/T033 already made in this same directory tree --
 * existing specifically to produce the packet's own "Required Worker Output"
 * proof requirements:
 *
 *   1. Real proof of the SEC-04 default-ON state (module doc #4 in
 *      `AdminToggles.tsx`) -- the `Switch` genuinely renders checked on
 *      first load from the fixture, then genuinely flips (both the on-screen
 *      state and the injected `onTogglePrivacy` persistence seam) when
 *      clicked.
 *   2. Real proof of the admin-only gate (module doc #5) -- a `coach` (who
 *      legitimately reaches the surrounding /roster page per
 *      `RosterShell.tsx`) sees NOTHING from this component, an unauthenticated
 *      user sees nothing, and only an `admin` sees the widget.
 *   3. Real proof the season default-goal shortcut `Link` resolves to
 *      `/settings/season` (module doc #6) -- a real `<a href>`, not a stub.
 *   4. T104: real proof of `makeLoadPrivacySetting`/`makeTogglePrivacy`
 *      (`../../lib/supabase/loaders/leaderboard_privacy.ts`) against a
 *      stubbed `SupabaseClient` -- same DI pattern
 *      `SeasonSettings.test.tsx`/T091 already established for
 *      `loaders/seasons.ts`'s own `makeLoadSeasons`/etc. (that module
 *      likewise has no dedicated test file of its own).
 *
 * Every render-level test below now injects `loadPrivacySetting`/
 * `onTogglePrivacy` explicitly through the component's own seam (same
 * "inject the fixture explicitly" pattern `SeasonSettings.test.tsx`/T091
 * already established for its own now-real `loadData`/etc. defaults) --
 * none rely on the real default any more, since that now performs a real
 * network call requiring a configured Supabase client.
 *
 * No `@testing-library/react` is installed in this repo (confirmed via
 * `package.json`) -- these tests use the same raw `createRoot`/`act` pattern
 * every prior content-page test file in this batch already established,
 * including `LiveConsole.test.tsx`'s `AuthProvider` + `LoginAs` role-login
 * harness (needed here too, since `AdminToggles` reads `useAuth()` directly)
 * and a bare `MemoryRouter` wrapper (no `Routes`/`useParams` needed here,
 * unlike `LiveConsole.test.tsx` -- `AdminToggles` never reads route params,
 * it only needs `MemoryRouter` present so `Link as={RouterLink}` has a
 * router context to render a real `<a href>` into, matching
 * `CheckinResult.test.tsx`'s bare-`MemoryRouter` precedent).
 */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import type { SupabaseClient } from '@supabase/supabase-js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthProvider, type AuthUser } from '../../app/guards';
import { LoginAsDeferred as LoginAs } from '../../test-utils/authHarness';
import {
  makeLoadPrivacySetting,
  makeTogglePrivacy,
} from '../../lib/supabase/loaders/leaderboard_privacy';
import { AdminToggles, defaultLoadPrivacySetting, defaultOnTogglePrivacy } from './AdminToggles';

// ---------------------------------------------------------------------------
// Render harness -- mirrors LiveConsole.test.tsx's LoginAs pattern.
// ---------------------------------------------------------------------------

let container: HTMLDivElement;
let root: Root;

const ADMIN_USER: AuthUser = { id: 'user-admin', email: 'admin@example.com', role: 'admin' };
const COACH_USER: AuthUser = { id: 'user-coach', email: 'coach@example.com', role: 'coach' };

function renderToggles(
  user: AuthUser | null,
  props: Parameters<typeof AdminToggles>[0] = {},
): void {
  act(() => {
    root.render(
      <MemoryRouter initialEntries={['/roster']}>
        <AuthProvider>
          {user === null ? (
            <AdminToggles {...props} />
          ) : (
            <LoginAs user={user}>
              <AdminToggles {...props} />
            </LoginAs>
          )}
        </AuthProvider>
      </MemoryRouter>,
    );
  });
}

async function flushMicrotasks(): Promise<void> {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });
}

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
});

// ---------------------------------------------------------------------------
// Fixture defaults -- direct unit proof, independent of any render.
// ---------------------------------------------------------------------------

describe('defaultLoadPrivacySetting (SEC-04 default)', () => {
  it('resolves true -- ON -- by default', async () => {
    await expect(defaultLoadPrivacySetting()).resolves.toBe(true);
  });
});

describe('defaultOnTogglePrivacy', () => {
  it('resolves without throwing (in-memory placeholder, module doc #1)', async () => {
    await expect(defaultOnTogglePrivacy(false)).resolves.toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Admin-only gate -- module doc #5.
// ---------------------------------------------------------------------------

describe('<AdminToggles /> admin-only gate (module doc #5)', () => {
  it('renders nothing for an unauthenticated user', () => {
    renderToggles(null);
    expect(container.textContent).toBe('');
  });

  it('renders nothing for a coach (stricter than the coach/admin page gate)', async () => {
    renderToggles(COACH_USER);
    await flushMicrotasks();
    expect(container.textContent).toBe('');
  });

  it('renders the widget for an admin', async () => {
    renderToggles(ADMIN_USER, { loadPrivacySetting: defaultLoadPrivacySetting });
    await flushMicrotasks();
    expect(container.textContent).toContain('Show first name + last initial publicly');
  });
});

// ---------------------------------------------------------------------------
// SEC-04 default-ON + real toggle proof -- module doc #4.
// ---------------------------------------------------------------------------

describe('<AdminToggles /> leaderboard privacy Switch (SEC-04, module doc #4)', () => {
  it('defaults to ON (checked) using the real fixture seam', async () => {
    renderToggles(ADMIN_USER, { loadPrivacySetting: defaultLoadPrivacySetting });
    await flushMicrotasks();

    const input = container.querySelector('input[type="checkbox"]') as HTMLInputElement | null;
    expect(input, 'expected a Switch checkbox input').toBeTruthy();
    expect(input?.checked).toBe(true);
  });

  it('flips OFF on click, calling the injected onTogglePrivacy seam with false', async () => {
    const persisted: boolean[] = [];
    renderToggles(ADMIN_USER, {
      loadPrivacySetting: defaultLoadPrivacySetting,
      onTogglePrivacy: async (next) => {
        persisted.push(next);
      },
    });
    await flushMicrotasks();

    const input = container.querySelector('input[type="checkbox"]') as HTMLInputElement;
    expect(input.checked).toBe(true);

    act(() => {
      input.click();
    });
    await flushMicrotasks();

    expect(input.checked).toBe(false);
    expect(persisted).toEqual([false]);
  });

  it('starts OFF when the injected loadPrivacySetting resolves false', async () => {
    renderToggles(ADMIN_USER, { loadPrivacySetting: async () => false });
    await flushMicrotasks();

    const input = container.querySelector('input[type="checkbox"]') as HTMLInputElement;
    expect(input.checked).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Season default-goal shortcut -- module doc #6.
// ---------------------------------------------------------------------------

describe('<AdminToggles /> season default-goal shortcut (module doc #6)', () => {
  it('renders a real link to /settings/season', async () => {
    renderToggles(ADMIN_USER, { loadPrivacySetting: defaultLoadPrivacySetting });
    await flushMicrotasks();

    const link = Array.from(container.querySelectorAll('a')).find((a) =>
      a.textContent?.includes("Set this season's default goal"),
    );
    expect(link, 'expected the season default-goal shortcut link').toBeTruthy();
    expect(link?.getAttribute('href')).toBe('/settings/season');
  });
});

// ---------------------------------------------------------------------------
// T104 UPDATE: the schema-gap disclosure Banner describe block that used to
// live here is REMOVED -- `AdminToggles.tsx`'s own `SCHEMA_GAP_BANNER` no
// longer exists (module doc #2 UPDATE there): the gap it disclosed is
// genuinely closed by this same task's migration + real loader below.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// T104: real `loadPrivacySetting`/`onTogglePrivacy` defaults --
// `makeLoadPrivacySetting`/`makeTogglePrivacy`
// (`../../lib/supabase/loaders/leaderboard_privacy.ts`), against a stubbed
// `SupabaseClient`. Same DI pattern `SeasonSettings.test.tsx`/T091 already
// established for `loaders/seasons.ts`'s own loader-level tests (that
// module likewise has no dedicated test file of its own).
// ---------------------------------------------------------------------------

/** Minimal fake `SupabaseClient` supporting exactly the chain
 * `client.from('seasons').select('leaderboard_privacy_enabled').eq('is_active', true).maybeSingle()`. */
function makeFakeSelectEqMaybeSingleClient(result: { data: unknown; error: unknown }): {
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

describe('makeLoadPrivacySetting (T104 real read)', () => {
  it('queries seasons.leaderboard_privacy_enabled for the currently-active season', async () => {
    const { client, fromSpy, selectSpy, eqSpy } = makeFakeSelectEqMaybeSingleClient({
      data: { leaderboard_privacy_enabled: false },
      error: null,
    });
    const load = makeLoadPrivacySetting(() => client);

    const result = await load();

    expect(fromSpy).toHaveBeenCalledWith('seasons');
    expect(selectSpy).toHaveBeenCalledWith('leaderboard_privacy_enabled');
    expect(eqSpy).toHaveBeenCalledWith('is_active', true);
    expect(result).toBe(false);
  });

  it('resolves the true SEC-04 default when no season is currently active (data: null, error: null)', async () => {
    const { client } = makeFakeSelectEqMaybeSingleClient({ data: null, error: null });
    const load = makeLoadPrivacySetting(() => client);

    expect(await load()).toBe(true);
  });

  it('rejects with the real SupabaseLoaderError on a genuine query error -- no fixture fallback', async () => {
    const { client } = makeFakeSelectEqMaybeSingleClient({
      data: null,
      error: { message: 'permission denied for table seasons', code: '42501' },
    });
    const load = makeLoadPrivacySetting(() => client);

    await expect(load()).rejects.toMatchObject({ code: '42501', message: expect.any(String) });
  });
});

/** Minimal fake `SupabaseClient` supporting exactly the chain
 * `client.from('seasons').update({...}).eq('is_active', true)`. */
function makeFakeUpdateEqClient(result: { data: unknown; error: unknown }): {
  client: SupabaseClient;
  fromSpy: ReturnType<typeof vi.fn>;
  updateSpy: ReturnType<typeof vi.fn>;
  eqSpy: ReturnType<typeof vi.fn>;
} {
  const eqSpy = vi.fn().mockResolvedValue(result);
  const updateSpy = vi.fn(() => ({ eq: eqSpy }));
  const fromSpy = vi.fn(() => ({ update: updateSpy }));
  const client = { from: fromSpy } as unknown as SupabaseClient;
  return { client, fromSpy, updateSpy, eqSpy };
}

describe('makeTogglePrivacy (T104 real write)', () => {
  it('updates seasons.leaderboard_privacy_enabled for the currently-active season', async () => {
    const { client, fromSpy, updateSpy, eqSpy } = makeFakeUpdateEqClient({
      data: null,
      error: null,
    });
    const toggle = makeTogglePrivacy(() => client);

    await toggle(false);

    expect(fromSpy).toHaveBeenCalledWith('seasons');
    expect(updateSpy).toHaveBeenCalledWith({ leaderboard_privacy_enabled: false });
    expect(eqSpy).toHaveBeenCalledWith('is_active', true);
  });

  it('resolves successfully even when zero rows match (disclosed "no currently-active season" risk)', async () => {
    // A real Postgrest UPDATE matching zero rows still resolves
    // `{ data: null, error: null }` -- independently confirmed against a
    // real scratch-Postgres run for this task (Required Worker Output).
    const { client } = makeFakeUpdateEqClient({ data: null, error: null });
    const toggle = makeTogglePrivacy(() => client);

    await expect(toggle(true)).resolves.toBeUndefined();
  });

  it('rejects with the real SupabaseLoaderError on a genuine mutation error', async () => {
    const { client } = makeFakeUpdateEqClient({
      data: null,
      error: { message: 'permission denied for table seasons', code: '42501' },
    });
    const toggle = makeTogglePrivacy(() => client);

    await expect(toggle(false)).rejects.toMatchObject({
      code: '42501',
      message: expect.any(String),
    });
  });
});
