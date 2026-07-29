// @vitest-environment jsdom
/**
 * T148: tests for `ThemeModeProvider.tsx`/`useThemeMode()` -- the shared
 * theme-mode resolution mechanism this task builds to close the "light
 * mode/dark mode settings do not work" report. Mirrors
 * `SeasonProvider.test.tsx`'s own harness shape (a tiny test-only probe
 * component + raw `createRoot`/`act`, no `@testing-library/react` installed
 * in this repo) rather than a full `<App/>` render.
 *
 * Unlike `SeasonProvider`, `ThemeModeProvider` reads `useAuth()` internally,
 * so every render harness below wraps in a real (or fake-module) `AuthProvider`
 * -- `LoginAs` (`../test-utils/authHarness.tsx`) for the authenticated cases,
 * a locally-built anonymous `AuthModule` for the unauthenticated case.
 *
 * `localStorage` is cleared before every test in this file (inline, per the
 * T148 worker packet's own explicit instruction -- `src/test-setup.ts`
 * clears nothing globally and is not in this packet's Allowed Files).
 */
import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthProvider, type AuthModule, type AuthUser } from './guards';
import { LoginAs } from '../test-utils/authHarness';
import {
  ThemeModeProvider,
  useThemeMode,
  type LoadThemeModeFn,
  type ThemeMode,
} from './ThemeModeProvider';

const THEME_MODE_STORAGE_KEY = 'volt.themeMode';

const TEST_USER: AuthUser = {
  id: 'user-theme-test',
  email: 'fabricated.reporter@example.com',
  role: 'coach',
};

// ---------------------------------------------------------------------------
// Render harness
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

/** Tiny test-only consumer -- renders `useThemeMode()`'s current state as a
 * DOM attribute so tests can assert on it, same pattern
 * `SeasonProvider.test.tsx`'s own `SeasonStateProbe` uses. */
function ThemeModeProbe(): ReactNode {
  const { mode, refresh } = useThemeMode();
  return (
    <div data-testid="theme-mode-state" data-mode={mode}>
      <button type="button" onClick={() => refresh()} data-testid="refresh-button">
        Refresh
      </button>
    </div>
  );
}

function modeOf(): string | null {
  return (
    document.querySelector('[data-testid="theme-mode-state"]')?.getAttribute('data-mode') ?? null
  );
}

function renderAuthenticatedProbe(loadThemeMode: LoadThemeModeFn): void {
  act(() => {
    root.render(
      <LoginAs user={TEST_USER}>
        <ThemeModeProvider loadThemeMode={loadThemeMode}>
          <ThemeModeProbe />
        </ThemeModeProvider>
      </LoginAs>,
    );
  });
}

/** A deterministic, never-signed-in `AuthModule` -- built locally (not
 * imported from `authHarness.tsx`, which only exports authenticated-session
 * helpers) for the one "genuinely anonymous" case this file needs. */
function buildAnonymousAuthModule(): AuthModule {
  return {
    getInitialSession: async () => null,
    subscribeToAuthStateChange: () => () => {},
    signInWithPassword: async () => {
      throw new Error('not implemented in this test');
    },
    signInWithGoogle: async () => {
      throw new Error('not implemented in this test');
    },
    signOut: async () => {},
    resolveRole: async () => ({ status: 'no-profile' }),
  };
}

beforeEach(() => {
  window.localStorage.clear();
});

afterEach(() => {
  window.localStorage.clear();
});

describe('<ThemeModeProvider /> / useThemeMode() (T148 shared mechanism)', () => {
  it('starts at the "system" default before any localStorage seed exists and loadThemeMode resolves', async () => {
    setUpContainer();
    try {
      renderAuthenticatedProbe(async () => 'dark');
      // Synchronous: no seed exists, so the lazy initializer falls back to
      // 'system' -- the honestly-disclosed first-ever-visit flash residual
      // (see module doc in ThemeModeProvider.tsx).
      expect(modeOf()).toBe('system');
      await flushMicrotasks();
      expect(modeOf()).toBe('dark');
    } finally {
      tearDownContainer();
    }
  });

  it('flash fix: seeds mode synchronously from localStorage before the network resolves the real value -- criterion 5', async () => {
    window.localStorage.setItem(THEME_MODE_STORAGE_KEY, 'light');
    setUpContainer();
    try {
      let resolveLoad!: (mode: ThemeMode | null) => void;
      const pendingLoad: LoadThemeModeFn = () =>
        new Promise((resolve) => {
          resolveLoad = resolve;
        });

      act(() => {
        root.render(
          <LoginAs user={TEST_USER}>
            <ThemeModeProvider loadThemeMode={pendingLoad}>
              <ThemeModeProbe />
            </ThemeModeProvider>
          </LoginAs>,
        );
      });

      // Synchronous assertion -- BEFORE any await/microtask flush. The
      // seeded value must already be showing, not 'system' (the pre-fix
      // default) and not the eventual network value.
      expect(modeOf()).toBe('light');

      // Flushing microtasks resolves LoginAs's own fake session, which
      // triggers this provider's fetch effect -- but the loadThemeMode
      // promise is deliberately still unresolved, so the seeded value must
      // still be showing.
      await flushMicrotasks();
      expect(modeOf()).toBe('light');
      expect(window.localStorage.getItem(THEME_MODE_STORAGE_KEY)).toBe('light');

      // Now resolve the network value and confirm it updates, and that the
      // write-through updates localStorage too.
      act(() => {
        resolveLoad('dark');
      });
      await flushMicrotasks();
      expect(modeOf()).toBe('dark');
      expect(window.localStorage.getItem(THEME_MODE_STORAGE_KEY)).toBe('dark');
    } finally {
      tearDownContainer();
    }
  });

  it.each(['light', 'dark', 'system'] as const)(
    'resolves the exposed mode to the real network value once loadThemeMode resolves (%s)',
    async (value) => {
      setUpContainer();
      try {
        renderAuthenticatedProbe(async () => value);
        await flushMicrotasks();
        expect(modeOf()).toBe(value);
      } finally {
        tearDownContainer();
      }
    },
  );

  it('case 1: a resolved null with a real localStorage seed present KEEPS the seeded value -- normative, not a choice', async () => {
    window.localStorage.setItem(THEME_MODE_STORAGE_KEY, 'dark');
    setUpContainer();
    try {
      renderAuthenticatedProbe(async () => null);
      await flushMicrotasks();
      expect(modeOf()).toBe('dark');
    } finally {
      tearDownContainer();
    }
  });

  it('case 1: a resolved null with NO localStorage seed leaves the "system" default in place', async () => {
    setUpContainer();
    try {
      renderAuthenticatedProbe(async () => null);
      await flushMicrotasks();
      expect(modeOf()).toBe('system');
    } finally {
      tearDownContainer();
    }
  });

  it('case 2: a rejecting loadThemeMode is caught (fail-safe), keeps whatever mode is currently showing, and never crashes', async () => {
    window.localStorage.setItem(THEME_MODE_STORAGE_KEY, 'light');
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    setUpContainer();
    try {
      expect(() => {
        renderAuthenticatedProbe(async () => {
          throw new Error('network down');
        });
      }).not.toThrow();
      await flushMicrotasks();

      // Kept the seeded value -- never crashed, never silently reverted to
      // 'system'.
      expect(modeOf()).toBe('light');
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'ThemeModeProvider: failed to resolve theme_mode.',
        expect.any(Error),
      );
    } finally {
      tearDownContainer();
      consoleErrorSpy.mockRestore();
    }
  });

  it('refresh() re-invokes loadThemeMode and writes the newly resolved value back to localStorage', async () => {
    let callCount = 0;
    const loadThemeMode: LoadThemeModeFn = async () => {
      callCount += 1;
      return callCount === 1 ? 'dark' : 'light';
    };
    setUpContainer();
    try {
      renderAuthenticatedProbe(loadThemeMode);
      await flushMicrotasks();
      expect(callCount).toBe(1);
      expect(modeOf()).toBe('dark');
      expect(window.localStorage.getItem(THEME_MODE_STORAGE_KEY)).toBe('dark');

      act(() => {
        document.querySelector<HTMLButtonElement>('[data-testid="refresh-button"]')?.click();
      });
      await flushMicrotasks();

      expect(callCount).toBe(2);
      expect(modeOf()).toBe('light');
      expect(window.localStorage.getItem(THEME_MODE_STORAGE_KEY)).toBe('light');
    } finally {
      tearDownContainer();
    }
  });

  it('does not attempt a fetch while unauthenticated (user is null) -- mode stays at the seeded/default value', async () => {
    const loadThemeMode = vi.fn(async () => 'dark' as const);
    setUpContainer();
    try {
      act(() => {
        root.render(
          <AuthProvider authModule={buildAnonymousAuthModule()}>
            <ThemeModeProvider loadThemeMode={loadThemeMode}>
              <ThemeModeProbe />
            </ThemeModeProvider>
          </AuthProvider>,
        );
      });
      await flushMicrotasks();

      expect(loadThemeMode).not.toHaveBeenCalled();
      expect(modeOf()).toBe('system');
    } finally {
      tearDownContainer();
    }
  });

  it('useThemeMode() throws when called outside a <ThemeModeProvider> (fail loud, same posture as useAuth()/useActiveSeason())', () => {
    setUpContainer();
    try {
      let caught: unknown = null;
      function Boundary(): ReactNode {
        try {
          useThemeMode();
        } catch (error) {
          caught = error;
        }
        return null;
      }
      act(() => {
        root.render(<Boundary />);
      });
      expect(caught).toBeInstanceOf(Error);
      expect((caught as Error).message).toBe(
        'useThemeMode() must be called within a <ThemeModeProvider>.',
      );
    } finally {
      tearDownContainer();
    }
  });
});
