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
import { SUPABASE_AUTH_STORAGE_KEY } from '../lib/supabase/client';
import {
  ThemeModeProvider,
  useThemeMode,
  type LoadThemeModeFn,
  type ThemeMode,
} from './ThemeModeProvider';

/**
 * T154: the seed key is per-USER now, not per-browser. This mirrors
 * `ThemeModeProvider.tsx`'s own module-private `themeModeStorageKeyFor`
 * deliberately rather than importing it -- those storage helpers stay
 * module-private so the file picks up no extra
 * `react-refresh/only-export-components` warnings (same reasoning T148
 * recorded for the original flat helper). The duplication is the point: if
 * the production format changes without these tests changing, the cross-user
 * tests below stop finding their seeds and fail loudly.
 */
function themeModeKeyFor(userId: string): string {
  return `volt.themeMode.${userId}`;
}

/** Writes a persisted-session blob shaped like the one `supabase-js` itself
 * stores under `SUPABASE_AUTH_STORAGE_KEY` (`GoTrueClient._saveSession`'s
 * no-`userStorage` branch JSON-stringifies the FULL session, `.user`
 * included). Only `user.id` is ever read back by the provider. */
function seedPersistedSession(userId: string): void {
  window.localStorage.setItem(
    SUPABASE_AUTH_STORAGE_KEY,
    JSON.stringify({
      access_token: `fake-access-token-for-${userId}`,
      refresh_token: `fake-refresh-token-for-${userId}`,
      expires_in: 3600,
      token_type: 'bearer',
      user: { id: userId, email: 'fabricated.person@example.com' },
    }),
  );
}

const TEST_USER: AuthUser = {
  id: 'user-theme-test',
  email: 'fabricated.reporter@example.com',
  role: 'coach',
};

const ALICE: AuthUser = {
  id: 'user-alice',
  email: 'fabricated.alice@example.com',
  role: 'coach',
};

const BOB: AuthUser = {
  id: 'user-bob',
  email: 'fabricated.bob@example.com',
  role: 'student',
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

/**
 * T154: records `mode` on EVERY render, so a test can inspect what the FIRST
 * render actually produced rather than only the settled DOM.
 *
 * This exists because asserting on the DOM after `act(() => root.render(...))`
 * canNOT distinguish a synchronous lazy-`useState` seed from a seed applied in
 * a `useEffect`: `act` flushes passive effects before returning, so both land
 * the same final attribute. Verified by mutation -- moving the seed into an
 * effect leaves every DOM-only assertion in this file green. Reading
 * `renders[0]` is what actually pins the property, because an effect-based
 * seed necessarily renders `'system'` first and corrects on a SECOND render.
 */
function RecordingProbe({ renders }: { renders: ThemeMode[] }): ReactNode {
  const { mode } = useThemeMode();
  renders.push(mode);
  return <div data-testid="theme-mode-state" data-mode={mode} />;
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
    // T154: the seed is found via the persisted session's user.id, so BOTH
    // the session blob and the per-uid theme entry must be present.
    seedPersistedSession(TEST_USER.id);
    window.localStorage.setItem(themeModeKeyFor(TEST_USER.id), 'light');
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
      expect(window.localStorage.getItem(themeModeKeyFor(TEST_USER.id))).toBe('light');

      // Now resolve the network value and confirm it updates, and that the
      // write-through updates localStorage too -- under the per-uid key.
      act(() => {
        resolveLoad('dark');
      });
      await flushMicrotasks();
      expect(modeOf()).toBe('dark');
      expect(window.localStorage.getItem(themeModeKeyFor(TEST_USER.id))).toBe('dark');
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
    seedPersistedSession(TEST_USER.id);
    window.localStorage.setItem(themeModeKeyFor(TEST_USER.id), 'dark');
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
    seedPersistedSession(TEST_USER.id);
    window.localStorage.setItem(themeModeKeyFor(TEST_USER.id), 'light');
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
      expect(window.localStorage.getItem(themeModeKeyFor(TEST_USER.id))).toBe('dark');

      act(() => {
        document.querySelector<HTMLButtonElement>('[data-testid="refresh-button"]')?.click();
      });
      await flushMicrotasks();

      expect(callCount).toBe(2);
      expect(modeOf()).toBe('light');
      expect(window.localStorage.getItem(themeModeKeyFor(TEST_USER.id))).toBe('light');
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

  it('T154 criterion 5: the per-uid seed lands on the FIRST synchronous commit, beating both round trips', () => {
    // The seed exists purely to beat two sequential network round trips
    // (session, then profile). Proven the only way that is really provable:
    // a loader whose promise NEVER resolves, and a synchronous assertion with
    // no `await`/microtask flush anywhere before it. If the seed moved into an
    // effect, `mode` would read 'system' here and this test would fail.
    seedPersistedSession(TEST_USER.id);
    window.localStorage.setItem(themeModeKeyFor(TEST_USER.id), 'dark');
    setUpContainer();
    try {
      const neverResolves: LoadThemeModeFn = () => new Promise<ThemeMode | null>(() => {});
      const renders: ThemeMode[] = [];
      act(() => {
        root.render(
          <LoginAs user={TEST_USER}>
            <ThemeModeProvider loadThemeMode={neverResolves}>
              <RecordingProbe renders={renders} />
            </ThemeModeProvider>
          </LoginAs>,
        );
      });
      // No await above this line, by design.
      expect(modeOf()).toBe('dark');
      // The load-bearing assertion: the VERY FIRST render already carried the
      // seeded value. An effect-based seed would make renders[0] === 'system'.
      // 'system' must never appear at all -- not even transiently.
      expect(renders[0]).toBe('dark');
      expect(renders).not.toContain('system');
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

/**
 * T154: the seed is keyed per USER, not per browser. T148 shipped one flat
 * `volt.themeMode`, so on a shared machine user B's first paint briefly used
 * user A's theme. These tests are the reason the task exists.
 */
describe('<ThemeModeProvider /> T154 per-user seed keying', () => {
  const neverResolves: LoadThemeModeFn = () => new Promise<ThemeMode | null>(() => {});

  /** Mounts a fresh root and runs `assert` against the first synchronous
   * commit, passing it every recorded render so a test can assert a value was
   * never shown even TRANSIENTLY (the reported bug was a brief wrong frame,
   * so "never at any point" is the property that matters, not just the
   * settled value). Each direction of the cross-user proof needs its own
   * mount, since the seed is read once per mount. */
  function mountAndAssertSync(user: AuthUser, assert: (renders: ThemeMode[]) => void): void {
    setUpContainer();
    try {
      const renders: ThemeMode[] = [];
      act(() => {
        root.render(
          <LoginAs user={user}>
            <ThemeModeProvider loadThemeMode={neverResolves}>
              <RecordingProbe renders={renders} />
            </ThemeModeProvider>
          </LoginAs>,
        );
      });
      assert(renders);
    } finally {
      tearDownContainer();
    }
  }

  // -------------------------------------------------------------------------
  // Criterion 3 -- cross-user isolation, BOTH directions.
  // -------------------------------------------------------------------------

  it("does NOT serve user A's theme to user B on a shared browser (the reported bug)", () => {
    // Alice left 'dark' behind on this machine; the live session is Bob's.
    window.localStorage.setItem(themeModeKeyFor(ALICE.id), 'dark');
    seedPersistedSession(BOB.id);

    // Bob falls through to his OS ('system'), NOT Alice's 'dark' -- and not
    // even for one frame, which is what "briefly sees user A's theme" meant.
    mountAndAssertSync(BOB, (renders) => {
      expect(modeOf()).toBe('system');
      expect(renders).not.toContain('dark');
    });

    // Alice's preference is preserved, not destroyed, for her next sign-in.
    expect(window.localStorage.getItem(themeModeKeyFor(ALICE.id))).toBe('dark');
  });

  it('DOES serve user B his own seeded theme -- proving the correct per-uid key is read, not merely that the wrong one is avoided', () => {
    // Same shared browser, but now Bob has his own stored preference. The two
    // values are deliberately DISTINGUISHABLE ('dark' vs 'light' vs the
    // 'system' fallback) so a dead lookup returning null cannot pass this:
    // asserting only "B does not see A's theme" would be a tautology.
    window.localStorage.setItem(themeModeKeyFor(ALICE.id), 'dark');
    window.localStorage.setItem(themeModeKeyFor(BOB.id), 'light');
    seedPersistedSession(BOB.id);

    mountAndAssertSync(BOB, (renders) => {
      expect(modeOf()).toBe('light');
      // His own value, on the first commit, and Alice's never appears.
      expect(renders[0]).toBe('light');
      expect(renders).not.toContain('dark');
    });
  });

  it('serves Alice her own theme from the very same storage state, when the session is hers', () => {
    // The mirror image of the test above, same localStorage, different
    // session -- the ONLY thing that changes which value is read.
    window.localStorage.setItem(themeModeKeyFor(ALICE.id), 'dark');
    window.localStorage.setItem(themeModeKeyFor(BOB.id), 'light');
    seedPersistedSession(ALICE.id);

    mountAndAssertSync(ALICE, (renders) => {
      expect(modeOf()).toBe('dark');
      expect(renders[0]).toBe('dark');
      expect(renders).not.toContain('light');
    });
  });

  // -------------------------------------------------------------------------
  // Criteria 2 + 4 -- fail-safe on every axis: no seed, never a wrong one.
  // -------------------------------------------------------------------------

  it('no session key present at all -> no seed, falls back to system', () => {
    window.localStorage.setItem(themeModeKeyFor(ALICE.id), 'dark');
    // No SUPABASE_AUTH_STORAGE_KEY entry written.
    expect(window.localStorage.getItem(SUPABASE_AUTH_STORAGE_KEY)).toBeNull();

    mountAndAssertSync(BOB, (renders) => {
      expect(modeOf()).toBe('system');
      expect(renders).not.toContain('dark');
    });
  });

  it('session key present but not valid JSON -> no throw, no seed, falls back to system', () => {
    window.localStorage.setItem(themeModeKeyFor(ALICE.id), 'dark');
    window.localStorage.setItem(SUPABASE_AUTH_STORAGE_KEY, 'not json{');

    expect(() => {
      mountAndAssertSync(BOB, (renders) => {
        expect(modeOf()).toBe('system');
        expect(renders).not.toContain('dark');
      });
    }).not.toThrow();
  });

  it.each([
    ['no .user at all', JSON.stringify({ access_token: 'x' })],
    ['user is null', JSON.stringify({ user: null })],
    ['no .user.id', JSON.stringify({ user: { email: 'fabricated@example.com' } })],
    ['user.id is an empty string', JSON.stringify({ user: { id: '' } })],
    ['user.id is not a string', JSON.stringify({ user: { id: 12345 } })],
    ['blob is a bare JSON string', JSON.stringify('nope')],
    ['blob is JSON null', JSON.stringify(null)],
  ])('session JSON valid but unusable (%s) -> no seed, falls back to system', (_label, blob) => {
    window.localStorage.setItem(themeModeKeyFor(ALICE.id), 'dark');
    window.localStorage.setItem(SUPABASE_AUTH_STORAGE_KEY, blob);

    mountAndAssertSync(BOB, (renders) => {
      expect(modeOf()).toBe('system');
      expect(renders).not.toContain('dark');
    });
  });

  it('a corrupt session never yields a STALE theme even when only one per-uid entry exists', () => {
    // The fail-dangerous shape T154 was designed to make unreachable: a single
    // orphaned preference plus an unreadable session must NOT resolve to that
    // preference by default.
    window.localStorage.setItem(themeModeKeyFor(ALICE.id), 'dark');
    window.localStorage.setItem(SUPABASE_AUTH_STORAGE_KEY, '{"user":{"id":');

    mountAndAssertSync(ALICE, (renders) => {
      expect(modeOf()).toBe('system');
      // Not even transiently -- a stale theme is exactly what must not happen.
      expect(renders).not.toContain('dark');
    });
  });

  it('an invalid stored theme value under a VALID session -> no seed, falls back to system', () => {
    seedPersistedSession(BOB.id);
    window.localStorage.setItem(themeModeKeyFor(BOB.id), 'chartreuse');

    mountAndAssertSync(BOB, () => {
      expect(modeOf()).toBe('system');
    });
  });

  // -------------------------------------------------------------------------
  // Criterion 6 -- anonymous mount touches no theme key at all.
  // -------------------------------------------------------------------------

  it('an anonymous mount reads and writes no volt.themeMode.* key whatsoever', async () => {
    const getItemSpy = vi.spyOn(Storage.prototype, 'getItem');
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem');
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

      const touchedThemeKeys = [...getItemSpy.mock.calls, ...setItemSpy.mock.calls]
        .map(([key]) => String(key))
        .filter((key) => key.startsWith('volt.themeMode'));
      expect(touchedThemeKeys).toEqual([]);
    } finally {
      tearDownContainer();
      getItemSpy.mockRestore();
      setItemSpy.mockRestore();
    }
  });

  it('the old flat T148 key is never read and never migrated', () => {
    // Criterion "no migration": an orphaned flat key is strictly safer than a
    // guessed migration, because at first read this code cannot tell whose
    // preference it was. It must be inert -- not adopted by whoever loads
    // the page first.
    window.localStorage.setItem('volt.themeMode', 'dark');
    seedPersistedSession(BOB.id);

    mountAndAssertSync(BOB, () => {
      expect(modeOf()).toBe('system');
    });

    // Left exactly where it was, unread and unmodified.
    expect(window.localStorage.getItem('volt.themeMode')).toBe('dark');
    expect(window.localStorage.getItem(themeModeKeyFor(BOB.id))).toBeNull();
  });
});
