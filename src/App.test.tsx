// @vitest-environment jsdom
/**
 * T148: regression test proving `App.tsx` actually wires the resolved
 * `theme_mode` through to the live `<Theme mode={...}>` provider -- this is
 * the packet's own strongest criterion (criterion 7). The premise gate ran
 * this exact mutation itself: with the fix removed (`Theme`'s `mode` prop
 * reverted to omitted), both the 'dark' and 'light' cases below fail
 * (`data-theme` stays absent regardless of the injected value); restored,
 * both pass. See the worker output doc for a reproduction of that same
 * proof against this tree.
 *
 * `App` hardcodes its own internal `<AuthProvider>` (no `authProviderProps`
 * seam -- see `App.tsx`'s own module doc and the T148 worker packet's
 * Design section 4 for why that seam was rejected), so a fake authenticated
 * session is injected via `vi.mock('./lib/supabase/auth', ...)` instead --
 * the same partial-mock-via-importOriginal convention already established
 * elsewhere in this codebase (e.g. `RosterShell.test.tsx`,
 * `OutreachDetail.test.tsx`), applied here for the first time to this
 * specific module. `App`'s own internal, unmodified `<AuthProvider>` then
 * resolves against the mocked module transparently.
 *
 * The actual theme value under test is controlled independently, via the
 * real `themeModeProviderProps` pass-through prop (`App.tsx`'s own new,
 * narrow seam) injecting a controlled `loadThemeMode` -- never by mocking
 * `resolveThemeMode` itself, which stays real/untouched for these cases.
 */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import type { AuthSession } from '@supabase/supabase-js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from './App';
import { getInitialSession, resolveRole, subscribeToAuthStateChange } from './lib/supabase/auth';
import type { LoadThemeModeFn } from './app/ThemeModeProvider';

vi.mock('./lib/supabase/auth', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./lib/supabase/auth')>();
  return {
    ...actual,
    getInitialSession: vi.fn(),
    subscribeToAuthStateChange: vi.fn(() => () => {}),
    resolveRole: vi.fn(),
  };
});

const mockedGetInitialSession = vi.mocked(getInitialSession);
const mockedResolveRole = vi.mocked(resolveRole);
const mockedSubscribeToAuthStateChange = vi.mocked(subscribeToAuthStateChange);

const FAKE_SESSION = {
  access_token: 'fake-access-token',
  refresh_token: 'fake-refresh-token',
  expires_in: 3600,
  token_type: 'bearer',
  user: { id: 'user-1', email: 'fabricated.user@example.com' },
} as unknown as AuthSession;

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  document.documentElement.removeAttribute('data-theme');
  mockedSubscribeToAuthStateChange.mockReturnValue(() => {});
});

afterEach(() => {
  act(() => {
    root.unmount();
  });
  container.remove();
  document.documentElement.removeAttribute('data-theme');
  vi.clearAllMocks();
});

async function flushMicrotasks(): Promise<void> {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });
}

function renderApp(loadThemeMode: LoadThemeModeFn): void {
  act(() => {
    root.render(<App themeModeProviderProps={{ loadThemeMode }} />);
  });
}

describe('<App /> theme wiring (T148, criterion 7 -- the strongest criterion in the packet)', () => {
  it("sets data-theme='dark' on <html> for an authenticated user whose resolved theme mode is 'dark'", async () => {
    mockedGetInitialSession.mockResolvedValue(FAKE_SESSION);
    mockedResolveRole.mockResolvedValue({ status: 'found', role: 'coach' });
    const loadThemeMode = vi.fn<LoadThemeModeFn>(async () => 'dark');

    renderApp(loadThemeMode);
    await flushMicrotasks();

    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    expect(loadThemeMode).toHaveBeenCalledWith('user-1');
  });

  it("sets data-theme='light' on <html> for an authenticated user whose resolved theme mode is 'light'", async () => {
    mockedGetInitialSession.mockResolvedValue(FAKE_SESSION);
    mockedResolveRole.mockResolvedValue({ status: 'found', role: 'coach' });
    const loadThemeMode = vi.fn<LoadThemeModeFn>(async () => 'light');

    renderApp(loadThemeMode);
    await flushMicrotasks();

    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
  });

  it("leaves data-theme ABSENT on <html> for an authenticated user whose resolved theme mode is 'system' -- matches Theme's own documented 'system' behavior (Theme.tsx:208-213), not an arbitrary choice", async () => {
    mockedGetInitialSession.mockResolvedValue(FAKE_SESSION);
    mockedResolveRole.mockResolvedValue({ status: 'found', role: 'coach' });
    const loadThemeMode = vi.fn<LoadThemeModeFn>(async () => 'system');

    renderApp(loadThemeMode);
    await flushMicrotasks();

    expect(document.documentElement.getAttribute('data-theme')).toBeNull();
  });

  it('leaves data-theme absent (system default) and never fetches a theme mode for a genuinely anonymous session -- injected explicitly, not relied on by environmental accident', async () => {
    // Explicitly mocked to resolve null (a genuinely anonymous session),
    // rather than omitting any override and letting the call fall through
    // to the real, unconfigured module -- the T148 worker packet's own
    // gate-flagged MINOR: the unmocked path happens to end up anonymous
    // today too, but only by environmental accident (no .env in this test
    // run), not by a fixture asserting what is actually under test.
    mockedGetInitialSession.mockResolvedValue(null);
    const loadThemeMode = vi.fn<LoadThemeModeFn>(async () => 'dark');

    renderApp(loadThemeMode);
    await flushMicrotasks();

    expect(document.documentElement.getAttribute('data-theme')).toBeNull();
    expect(loadThemeMode).not.toHaveBeenCalled();
    expect(mockedResolveRole).not.toHaveBeenCalled();
  });
});
