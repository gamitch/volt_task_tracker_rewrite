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
 * (`useState(() => readSeededThemeMode() ?? 'system')`) so the read happens
 * SYNCHRONOUSLY during the first render, before any effect or network call
 * -- not `useState(readStoredThemeMode() ?? 'system')`, which would still
 * read synchronously but re-run the read on every render for no reason; the
 * lazy form only runs it once. Every successful resolve (initial load AND
 * `refresh()`) writes the resolved value back to `localStorage`, so the next
 * boot's synchronous seed reflects the latest known value.
 *
 * A first-ever visit still flashes `'system'` -- as does any visit where the
 * session is absent, corrupt, or belongs to a user with no stored preference
 * yet (T154; see `readSeededThemeMode`). This is an honestly-disclosed
 * residual, not a defect: there is nothing safe to seed from in those cases,
 * and a wrong seed is worse than one flash. The `index.html`-inline-script
 * approach that would avoid it does not work in this app (`Theme`'s own wrapper
 * `<div>` sets `color-scheme` explicitly and is a descendant of `<html>`, so
 * its own value overrides whatever a pre-hydration script set on `<html>`
 * once React mounts -- see the T148 worker packet's "Negative knowledge"
 * section for the full citation trail).
 *
 * `localStorage` (not `sessionStorage`) is used deliberately -- a theme
 * preference should survive across tabs and browser restarts, unlike
 * `guards.tsx`'s `sessionStorage`-backed intended-URL redirect artifact
 * (`guards.tsx:351-360`, the storage-helper shape this module's own
 * `getStorage`/`readSeededThemeMode`/`writeStoredThemeMode` mirror -- same
 * try/catch guard against locked-down/private-browsing contexts, different
 * storage instance and key).
 *
 * -----------------------------------------------------------------------
 * Four specified cases, stated explicitly (not left to be discovered).
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
 * 3. Shared/kiosk browser cross-user bleed -- FIXED by T154, was disclosure
 *    only under T148. T148 keyed the seed per BROWSER (one flat
 *    `volt.themeMode`), so if user A set Dark and signed out, user B's first
 *    paint on the same machine used A's value for one frame. The seed is now
 *    keyed per USER (`volt.themeMode.<uid>`, `themeModeStorageKeyFor`), where
 *    `<uid>` comes from the `user.id` in the session blob the SDK persists
 *    under `SUPABASE_AUTH_STORAGE_KEY` (a key this app now OWNS -- see
 *    `client.ts` for why owning it rather than deriving the SDK's internal
 *    format is a safety property, not a style choice). B's lookup finds
 *    nothing and falls through to his OS; A's preference survives for her
 *    next sign-in rather than being destroyed on logout.
 *
 *    Note this covers the FRESH-LOAD case (B opens the app in a new tab or
 *    after a reload). The in-page account switch is a second, distinct
 *    mechanism -- see case 4, which the first version of T154 got wrong.
 *
 * 4. In-page account switch -- FIXED, and the correction to T154's own first
 *    version. Per-uid keying alone is NOT sufficient, and the earlier claim
 *    that it made the shared-browser question "moot regardless" was
 *    measurably false. The seed is read once per MOUNT, and this provider
 *    mounts above the router in `App.tsx`; `logout()`/`login()`
 *    (`guards.tsx:311-321`, `:293-300`) only call `setState` and never
 *    reload. So on the ordinary sign-out -> /login -> sign-in-as-B flow the
 *    provider is never remounted, the seed is never re-read, and B inherited
 *    A's theme -- PERSISTENTLY for the rest of the page session, because case
 *    1 above deliberately keeps the current value when the fetch resolves
 *    `null`. The provider body now re-seeds from the new user's own key when
 *    the signed-in user id changes away from the last user it seeded for.
 *
 *    RESIDUAL, disclosed rather than closed: between A signing out and B
 *    signing in, the login screen still shows A's theme, because `user` is
 *    `null` there and this provider deliberately does NOT re-seed on null.
 *    That is the correct trade -- `user` is also `null` during every normal
 *    page load while the session resolves, so resetting on null would
 *    re-introduce the very flash T148 fixed, permanently on anonymous visits.
 *    A signed-out login screen briefly carrying the previous user's colour
 *    scheme leaks nothing (no name, no data -- a theme is not PII) and
 *    corrects the moment anyone signs in.
 *
 * -----------------------------------------------------------------------
 * T154's three accepted limitations, stated rather than left to discovery.
 * -----------------------------------------------------------------------
 *
 * a. NO migration of T148's old flat `volt.themeMode` key. Not merely
 *    uneconomic -- migrating it would be INCORRECT. At the only moment a
 *    migration could run (first read after upgrade) this code cannot tell
 *    WHOSE preference the old flat value belongs to. Copying it into the
 *    first uid-keyed slot would hand one user's value to whichever user
 *    happens to load the page first, PERMANENTLY, instead of for the single
 *    honestly-disclosed frame the current design accepts. An orphaned old key
 *    is strictly safer than a guessed migration, so the old key is simply
 *    left where it is, unread by anything.
 *
 * b. NO clear-on-logout, in any form. `logout()` lives in `guards.tsx`
 *    (Forbidden File for this task), and every in-scope variant was already
 *    measured as actively destructive under T148: clearing the seed whenever
 *    `user` reads `null` is NOT a safe substitute, because `user` is `null`
 *    during every normal page load while the session is still resolving, not
 *    only after a real sign-out -- an unguarded clear there would wipe the
 *    seed on every boot (masked when the profile fetch later succeeds and
 *    rewrites it, but PERMANENT when `resolveThemeMode` rejects, and
 *    PERMANENT on any genuinely anonymous visit such as `/login`, since
 *    nothing ever restores it). Note that per-uid keying does NOT make this
 *    question moot on its own -- an earlier version of this file claimed it
 *    did, and that was wrong (see case 4). What closes the shared-browser
 *    bleed is per-uid keying for fresh loads PLUS the in-page re-seed for
 *    account switches. Neither requires destroying anyone's stored
 *    preference, which is what makes clear-on-logout unnecessary rather than
 *    merely undesirable.
 *
 * c. KEY ACCUMULATION, accepted. Every distinct user who has ever signed in
 *    on a given browser leaves a permanent `volt.themeMode.<uid>` entry
 *    behind; nothing deletes an old uid's key when a different user signs in.
 *    On a browser several people share over a season (team laptops, a
 *    kiosk-adjacent machine -- plausible for this app specifically) this
 *    accumulates one small entry per distinct user, unbounded over the life
 *    of the browser profile. This is a real property of the design, not a
 *    defect: each entry is a few bytes, holds no PII beyond a uid already
 *    present in the same browser's session blob, and unbounded-but-tiny
 *    accumulation is a strictly better trade than either overwriting a
 *    stranger's preference or building eviction logic for a cosmetic
 *    setting. No cleanup is built.
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
import { SUPABASE_AUTH_STORAGE_KEY } from '../lib/supabase/client';
import { useAuth } from './guards';

export type { ThemeMode };

// ---------------------------------------------------------------------------
// localStorage seed -- module-private (not exported). Nothing outside this
// file needs to call these; the provider below is the only consumer. Keeping
// them private avoids two extra `react-refresh/only-export-components`
// warnings this file would otherwise pick up (one per additional
// non-component export) -- see criterion 13 of the T148 worker packet.
// ---------------------------------------------------------------------------

/** T154: the seed key is now per-USER, not per-browser. `<uid>` is the
 * `user.id` of whoever the persisted Supabase session says is signed in. */
function themeModeStorageKeyFor(userId: string): string {
  return `volt.themeMode.${userId}`;
}

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

/**
 * `getStorage()` above guards the property ACCESS to `window.localStorage`, but
 * not the `getItem` CALL, which can itself throw (a stubbed/instrumented
 * `Storage.prototype.getItem`, or a hardened embedding). That distinction
 * matters more here than it looks: both callers below run inside a LAZY
 * `useState` initializer, during the render of a provider mounted above the
 * whole tree in `App.tsx` -- so an escaping exception there is a white screen,
 * not a one-frame flash. Guarded, so "absent, corrupt, or unreadable session
 * data means no seed" is exhaustive on the render path rather than nearly so.
 */
function safeGetItem(key: string): string | null {
  const storage = getStorage();
  if (!storage) {
    return null;
  }
  try {
    return storage.getItem(key);
  } catch {
    return null;
  }
}

/** The minimum shape this module needs out of the persisted session blob.
 * Deliberately narrow: only `user.id`, nothing else is read. */
interface PersistedSessionWithUserId {
  user: { id: string };
}

function isPersistedSessionWithUserId(value: unknown): value is PersistedSessionWithUserId {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const { user } = value as { user?: unknown };
  if (typeof user !== 'object' || user === null) {
    return false;
  }
  const { id } = user as { id?: unknown };
  return typeof id === 'string' && id.length > 0;
}

/**
 * Reads the signed-in `user.id` SYNCHRONOUSLY out of the session blob the SDK
 * itself persists under the key this app owns
 * (`SUPABASE_AUTH_STORAGE_KEY`). Returns `null` -- meaning NO SEED, fall back
 * to the single `'system'` flash -- on every failure axis: no storage, a
 * throwing `getItem` (see `safeGetItem`), no key present, unparseable JSON, or
 * a blob without a non-empty string `user.id`. It never returns a guessed or
 * stale id, which is the whole safety property T154 rests on.
 */
function readSessionUserId(): string | null {
  const raw = safeGetItem(SUPABASE_AUTH_STORAGE_KEY);
  if (!raw) {
    return null;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    // Corrupt/truncated entry -- treat as absent. Never guess.
    return null;
  }
  return isPersistedSessionWithUserId(parsed) ? parsed.user.id : null;
}

/** Reads one specific user's stored preference. Never consults any other
 * user's key, and never falls back to a different user's value. */
function readStoredThemeModeFor(userId: string): ThemeMode | null {
  const raw = safeGetItem(themeModeStorageKeyFor(userId));
  return isValidThemeMode(raw) ? raw : null;
}

/** The synchronous mount-time seed read. `null` whenever the session is
 * absent, corrupt, or has no usable id -- and also whenever THAT user simply
 * has no stored preference yet (a different user's key is never consulted). */
function readSeededThemeMode(): ThemeMode | null {
  const userId = readSessionUserId();
  if (userId === null) {
    return null;
  }
  return readStoredThemeModeFor(userId);
}

function writeStoredThemeMode(userId: string, mode: ThemeMode): void {
  getStorage()?.setItem(themeModeStorageKeyFor(userId), mode);
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
  const [mode, setMode] = useState<ThemeMode>(() => readSeededThemeMode() ?? 'system');
  // Bumped by `refresh()` to force the effect below to re-run without
  // changing `loadThemeMode`'s own identity/deps -- same mechanism
  // `SeasonProvider.tsx`'s own `refreshToken` uses.
  const [refreshToken, setRefreshToken] = useState(0);

  // -------------------------------------------------------------------------
  // In-page account switch (T154 rework). See module doc "case 4".
  // -------------------------------------------------------------------------
  // The mount-time seed above runs ONCE. This provider mounts in `App.tsx`
  // above the router, and neither `logout()` (`guards.tsx:311-321`) nor
  // `login()` (`:293-300`) reloads the page -- both only call `setState`. So
  // the ordinary SPA sign-out -> /login -> sign-in-as-B flow never remounts
  // this provider, and without the block below B would keep A's theme for the
  // rest of the page session (not one frame: case 1 deliberately KEEPS the
  // current value when `resolveThemeMode` resolves `null`).
  //
  // `lastSeededUserId` tracks the last NON-NULL user this provider has seeded
  // for. Comparing against that -- rather than against the previous rendered
  // value -- is deliberate and load-bearing: the real logout->login flow is
  // A -> null -> B, so a "previous render was non-null and different" test
  // would never fire on the very flow this fixes.
  //
  // Two things this must NOT do, both of which would re-introduce the flash
  // T148 fixed:
  //   * never re-seed while `user` is null -- that is every normal page load
  //     while the session resolves, not just a real sign-out;
  //   * never re-seed on null -> FIRST user -- guarded by the
  //     `lastSeededUserId !== null` test.
  //
  // Assigning state during render (rather than in an effect) is React's
  // sanctioned "adjust state when input changes" pattern and is what keeps the
  // synchronous-first-commit property: React discards the in-progress render
  // and re-renders this component BEFORE its children render or anything
  // commits, so the stale theme never reaches the DOM even for one frame.
  const [lastSeededUserId, setLastSeededUserId] = useState<string | null>(() =>
    readSessionUserId(),
  );
  if (user && user.id !== lastSeededUserId) {
    setLastSeededUserId(user.id);
    if (lastSeededUserId !== null) {
      // Genuine account switch on a live page. Re-seed from the NEW user's own
      // key, falling back to 'system' when this user has nothing stored --
      // never leaving the previous user's value in place.
      setMode(readStoredThemeModeFor(user.id) ?? 'system');
    }
  }

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
        // Write-through is keyed by the AUTHENTICATED user's own id, taken
        // from `useAuth()` rather than re-read from storage -- inside this
        // branch `user` is known non-null, so this cannot write under
        // someone else's key.
        writeStoredThemeMode(user.id, resolved);
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
