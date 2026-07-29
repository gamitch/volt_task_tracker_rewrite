/**
 * T148: closes the wiring gap the human owner reported directly ("light
 * mode/dark mode settings do not work, it all stays dark mode"). `App.tsx`
 * mounted `<Theme theme={voltTheme}>` with no `mode` prop, which the
 * installed `@astryxdesign/core` `Theme` component defaults to `'system'`
 * -- on a dark-set OS with no manual override reachable, that is
 * permanently dark. `SettingsPage.tsx`'s Appearance control already writes
 * `profiles.theme_mode` (module doc #6 there), but nothing ever read it back
 * into the live `Theme` provider. This file is the missing read side,
 * modeled directly on this codebase's one existing precedent for "a shared,
 * app-wide resolved value sourced from the user's own session, refreshable
 * when something else edits the underlying row": `./SeasonProvider.tsx` /
 * `useActiveSeason()`.
 *
 * -----------------------------------------------------------------------
 * The flash fix -- seeded synchronously from `localStorage`.
 * -----------------------------------------------------------------------
 *
 * The naive fix (expose `'system'` while the network resolves, same as
 * `SeasonProvider`'s own `{ status: 'loading' }` state) was measured and
 * rejected: for the reporting user (picked Light, OS dark-set), every page
 * load would boot fully dark and snap to light across two sequential round
 * trips (session, then profile) -- still experienced as "broken".
 *
 * Fix: `mode` is seeded with a LAZY `useState` initializer
 * (`useState(() => readStoredThemeMode() ?? 'system')`) so the read happens
 * SYNCHRONOUSLY during the first render, before any effect or network call
 * -- not `useState(readStoredThemeMode() ?? 'system')`, which would still
 * read synchronously but re-run the read on every render for no reason; the
 * lazy form only runs it once. Every successful resolve (initial load AND
 * `refresh()`) writes the resolved value back to `localStorage`, so the next
 * boot's synchronous seed reflects the latest known value.
 *
 * A first-ever visit (no `localStorage` entry yet) still flashes `'system'`
 * -- this is an honestly-disclosed residual, not a defect: there is nothing
 * to seed from on that visit, and the `index.html`-inline-script approach
 * that would avoid it does not work in this app (`Theme`'s own wrapper
 * `<div>` sets `color-scheme` explicitly and is a descendant of `<html>`, so
 * its own value overrides whatever a pre-hydration script set on `<html>`
 * once React mounts -- see the T148 worker packet's "Negative knowledge"
 * section for the full citation trail).
 *
 * `localStorage` (not `sessionStorage`) is used deliberately -- a theme
 * preference should survive across tabs and browser restarts, unlike
 * `guards.tsx`'s `sessionStorage`-backed intended-URL redirect artifact
 * (`guards.tsx:351-360`, the storage-helper shape this module's own
 * `getStorage`/`readStoredThemeMode`/`writeStoredThemeMode` mirror -- same
 * try/catch guard against locked-down/private-browsing contexts, different
 * storage instance and key).
 *
 * -----------------------------------------------------------------------
 * Three unhandled cases, specified explicitly (not left to be discovered).
 * -----------------------------------------------------------------------
 *
 * 1. `resolveThemeMode` resolves `null` while a real `localStorage` seed is
 *    present (e.g. the row went missing, or the stored value failed
 *    server-side validation): the existing seeded value is KEPT, never
 *    overwritten with `null`-coerced-to-`'system'` -- this is normative, not
 *    a choice (see `handleResolvedMode` below).
 * 2. `resolveThemeMode` rejects: caught, logged, and `mode` is left exactly
 *    as it currently reads (seeded or previously resolved) -- never crashes,
 *    never silently reverts to `'system'`. Without this `.catch`, a
 *    rejecting `loadThemeMode` would leak an unhandled promise rejection --
 *    see `ThemeModeProvider.test.tsx` for the process-level proof (`npx
 *    vitest run`'s own error count), which is the only way this specific
 *    case is actually provable (an `expect(mode).toBe(...)`-shaped assertion
 *    passes green either way and proves nothing about the `.catch` itself).
 * 3. Logout on a shared/kiosk browser -- DISCLOSURE ONLY, deliberately not
 *    fixed here. The `localStorage` seed is not user-scoped: if user A sets
 *    Dark and signs out, user B's first paint on the same browser may use
 *    A's stored value for one frame until B's own `theme_mode` resolves.
 *    `logout()` lives in `guards.tsx` (Forbidden File for this task -- see
 *    the worker packet); reaching into it would repeat a mistake this
 *    codebase has already corrected once elsewhere. There is also no
 *    in-scope alternative: clearing the seed unconditionally whenever `user`
 *    reads `null` is NOT a safe substitute, because `user` is `null` during
 *    every normal page load while the session is still resolving, not only
 *    after a real sign-out -- an unguarded clear there would wipe the seed
 *    on every boot (masked when the profile fetch later succeeds and
 *    rewrites it, but PERMANENT when `resolveThemeMode` rejects, and
 *    PERMANENT on any genuinely anonymous visit -- `/login`, a signed-out
 *    landing page -- since nothing ever restores it). Accepted, documented
 *    limitation; not built.
 *
 * -----------------------------------------------------------------------
 * Mount point -- `App.tsx`, between `AuthProvider` and `Theme`.
 * -----------------------------------------------------------------------
 *
 * Unlike `SeasonProvider` (mounted inside `AppShell.tsx`, itself already
 * inside `App.tsx`'s `<AuthProvider>`), `Theme` lives in `App.tsx` itself,
 * above `AppShell` -- so `ThemeModeProvider` must also mount in `App.tsx`,
 * inside `<AuthProvider>` (it needs `useAuth()`) and wrapping `<Theme>` (so
 * a small nested component can read `useThemeMode()` and pass `mode` to
 * `Theme`, since `Theme` cannot itself call the hook that supplies its own
 * `mode` prop). See `App.tsx`'s own top-of-file doc comment for the full
 * resulting provider order.
 */
import type { ReactNode } from 'react';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { resolveThemeMode as fetchThemeMode, type ThemeMode } from '../lib/supabase/auth';
import { useAuth } from './guards';

export type { ThemeMode };

// ---------------------------------------------------------------------------
// localStorage seed -- module-private (not exported). Nothing outside this
// file needs to call these; the provider below is the only consumer. Keeping
// them private avoids two extra `react-refresh/only-export-components`
// warnings this file would otherwise pick up (one per additional
// non-component export) -- see criterion 13 of the T148 worker packet.
// ---------------------------------------------------------------------------

const THEME_MODE_STORAGE_KEY = 'volt.themeMode';

const VALID_THEME_MODES: readonly ThemeMode[] = ['system', 'light', 'dark'];

function isValidThemeMode(value: unknown): value is ThemeMode {
  return typeof value === 'string' && (VALID_THEME_MODES as readonly string[]).includes(value);
}

function getStorage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    // localStorage can throw in locked-down/private-browsing contexts --
    // same guard `guards.tsx`'s own `getStorage()` uses for `sessionStorage`.
    return null;
  }
}

function readStoredThemeMode(): ThemeMode | null {
  const raw = getStorage()?.getItem(THEME_MODE_STORAGE_KEY) ?? null;
  return isValidThemeMode(raw) ? raw : null;
}

function writeStoredThemeMode(mode: ThemeMode): void {
  getStorage()?.setItem(THEME_MODE_STORAGE_KEY, mode);
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

export type LoadThemeModeFn = (userId: string) => Promise<ThemeMode | null>;

export interface ThemeModeContextValue {
  mode: ThemeMode;
  /** Re-runs the fetch, same `refresh()` mechanism `useActiveSeason()`
   * already establishes for this codebase -- see that provider's own module
   * doc for the full reasoning. Used by `SettingsPage.tsx`'s `persistTheme`
   * after a successful `onChangeTheme`, so every OTHER mounted consumer in
   * the same browser session picks up the change immediately. */
  refresh: () => void;
}

const ThemeModeContext = createContext<ThemeModeContextValue | null>(null);

export interface ThemeModeProviderProps {
  children: ReactNode;
  /**
   * Injectable seam (same convention `SeasonProvider.tsx`'s own
   * `loadActiveSeason` prop establishes). Defaults to the real,
   * STABLE, module-level `resolveThemeMode` reference itself
   * (`../lib/supabase/auth.ts`) -- deliberately NOT an inline wrapper
   * arrow (`(userId) => resolveThemeMode(userId)`), which would be a new
   * function identity on every render and, sitting in this provider's
   * effect dependency array below, would re-fire the fetch on every parent
   * re-render.
   */
  loadThemeMode?: LoadThemeModeFn;
}

export function ThemeModeProvider({
  children,
  loadThemeMode = fetchThemeMode,
}: ThemeModeProviderProps): ReactNode {
  const { user } = useAuth();
  // Lazy initializer: runs synchronously during the FIRST render only, before
  // any effect or network call -- the flash fix (see module doc above).
  const [mode, setMode] = useState<ThemeMode>(() => readStoredThemeMode() ?? 'system');
  // Bumped by `refresh()` to force the effect below to re-run without
  // changing `loadThemeMode`'s own identity/deps -- same mechanism
  // `SeasonProvider.tsx`'s own `refreshToken` uses.
  const [refreshToken, setRefreshToken] = useState(0);

  useEffect(() => {
    if (!user) {
      // No session yet (still resolving) or genuinely anonymous -- no fetch
      // is attempted, but the seeded/previously-resolved `mode` is kept
      // rather than discarded (module doc above: there's no reason to throw
      // away a real last-known preference just because the current session
      // hasn't resolved yet).
      return;
    }
    let isMounted = true;
    loadThemeMode(user.id)
      .then((resolved) => {
        if (!isMounted) return;
        if (resolved === null) {
          // Case 1: keep the existing seeded/previously-resolved value.
          // Normative, not a choice -- see module doc above.
          return;
        }
        setMode(resolved);
        writeStoredThemeMode(resolved);
      })
      .catch((error: unknown) => {
        // Case 2: fail safe -- keep whatever `mode` is currently showing
        // rather than crashing or silently reverting to `'system'`.
        console.error('ThemeModeProvider: failed to resolve theme_mode.', error);
      });
    return () => {
      isMounted = false;
    };
  }, [user, loadThemeMode, refreshToken]);

  const refresh = useCallback(() => {
    setRefreshToken((token) => token + 1);
  }, []);

  const value = useMemo<ThemeModeContextValue>(() => ({ mode, refresh }), [mode, refresh]);

  return <ThemeModeContext.Provider value={value}>{children}</ThemeModeContext.Provider>;
}

/** Must be called within a `<ThemeModeProvider>`. Throws otherwise (fail
 * loud) -- same posture `guards.tsx`'s own `useAuth()` and
 * `SeasonProvider.tsx`'s own `useActiveSeason()` already establish. */
export function useThemeMode(): ThemeModeContextValue {
  const ctx = useContext(ThemeModeContext);
  if (!ctx) {
    throw new Error('useThemeMode() must be called within a <ThemeModeProvider>.');
  }
  return ctx;
}
