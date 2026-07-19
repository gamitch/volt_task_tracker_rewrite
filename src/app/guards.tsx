/**
 * T005: NAV-06 auth/role guards + NAV-08 intended-URL-and-redirect-after-login
 * mechanism.
 *
 * This module is intentionally self-contained: it does not import anything
 * from `main.tsx` / `App.tsx`, and none of its exports depend on the router
 * being wired into the running app (that wiring is T006's job). Everything
 * here can be exercised in isolation by wrapping `RequireAuth` / `RequireRole`
 * in a `MemoryRouter` + `AuthProvider` in a test, or by calling the plain
 * functions (`setIntendedUrl`, `consumeIntendedUrl`, `pushToast`, etc.)
 * directly.
 *
 * T073b2: `AuthProvider` below is now wired to the real, typed Supabase auth
 * module (`../lib/supabase/auth.ts`, T071, Passed) instead of T005's
 * in-memory placeholder. See the "Real auth wiring" section below for the
 * full design (two-step async session->role resolution, the injectable
 * `authModule` seam, and the AUTH-04 no-profile state).
 */
import type { ReactNode } from 'react';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import type { Role } from '../lib/supabase';
import * as supabaseAuthModule from '../lib/supabase/auth';
import type { AuthChangeEvent, AuthSession, RoleResolution } from '../lib/supabase/auth';
import { NoAccessPage } from '../pages/no-access';
import { AccessDeniedPage } from '../pages/no-access/AccessDeniedPage';

// ---------------------------------------------------------------------------
// Auth context
// ---------------------------------------------------------------------------

/**
 * Role identifiers referenced by this task's guard mechanism.
 *
 * T073a: this used to be a hand-retyped local union (`'admin' | 'staff' |
 * 'volunteer' | 'coach'`, a stale T005 placeholder that predated AUTH-05's
 * real role vocabulary and could not represent `'student'`/`'parent'` at
 * all -- flagged as an open gap by T005 and every downstream task that
 * touched a role check since). It is now a direct re-export of
 * `src/lib/supabase/types.ts`'s `Role` (built by T071), which is already
 * transcribed verbatim from `role_enum`
 * (`supabase/migrations/20260716000000_identity_roster.sql`: `create type
 * role_enum as enum ('admin', 'coach', 'student', 'parent');`) -- so this
 * module can no longer drift from that source of truth by hand-editing a
 * second copy of the union here.
 */
export type { Role };

export interface AuthUser {
  id: string;
  email: string;
  role: Role;
}

/**
 * T073b2: the injectable auth-module seam. Same six function shapes
 * `../lib/supabase/auth.ts` (T071) exports, minus each function's optional
 * trailing `client` parameter (the real module's own default -- the shared
 * `getSupabaseClient()` singleton -- still applies when a test doesn't
 * override it via this seam). `AuthProvider` defaults to the real module
 * (`defaultAuthModule` below) when no `authModule` prop is supplied; tests
 * (`src/test-utils/authHarness.tsx`) supply a fake implementation instead so
 * they never touch a real backend.
 */
export interface AuthModule {
  getInitialSession: () => Promise<AuthSession | null>;
  subscribeToAuthStateChange: (
    callback: (event: AuthChangeEvent, session: AuthSession | null) => void,
  ) => () => void;
  signInWithPassword: (email: string, password: string) => Promise<AuthSession>;
  signInWithGoogle: (redirectTo: string) => Promise<void>;
  signOut: () => Promise<void>;
  resolveRole: (userId: string) => Promise<RoleResolution>;
}

/** The real implementation, wired to `../lib/supabase/auth.ts` (T071). This
 * is `AuthProvider`'s default `authModule` -- production code never passes
 * `authModule` explicitly, only tests do. */
const defaultAuthModule: AuthModule = {
  getInitialSession: supabaseAuthModule.getInitialSession,
  subscribeToAuthStateChange: supabaseAuthModule.subscribeToAuthStateChange,
  signInWithPassword: supabaseAuthModule.signInWithPassword,
  signInWithGoogle: supabaseAuthModule.signInWithGoogle,
  signOut: supabaseAuthModule.signOut,
  resolveRole: supabaseAuthModule.resolveRole,
};

export interface AuthContextValue {
  /**
   * Null while unauthenticated, while the initial session check is still
   * resolving (`isLoading`), or while `noProfile` is `true` (see below) --
   * never a half-resolved/partial user.
   */
  user: AuthUser | null;
  /**
   * True until the two-step session->role resolution (see module doc
   * "Real auth wiring" below) has resolved ONCE, spanning BOTH steps. A
   * consumer must never treat `user === null` as "signed out" while
   * `isLoading` is still `true` -- it may simply mean "not resolved yet".
   */
  isLoading: boolean;
  /**
   * T073b2 / AUTH-04: `true` when the visitor has a real, signed-in Supabase
   * auth session but no matching `profiles` row (`resolveRole` returned
   * `{ status: 'no-profile' }`, T071's `RoleResolution` type). This is a
   * THIRD auth state, distinct from both "anonymous" (`user === null &&
   * noProfile === false`, not signed in at all) and "authenticated"
   * (`user !== null`) -- redirecting a no-profile visitor to `/login` would
   * loop (they can sign in again, still have no profile, redirect again...).
   * `RequireAuth` renders `<NoAccessPage />` in place for this case instead
   * of redirecting. Chosen as a standalone boolean (over e.g. a `status:
   * 'anonymous' | 'authenticated' | 'no-profile' | 'loading'` enum) because
   * it's additive: every existing `user`/`isLoading` consumer in this
   * codebase keeps its current meaning unchanged, and the one new case this
   * task adds is genuinely boolean ("does this signed-in session have a
   * profile or not"), not one of several mutually-exclusive named statuses
   * layered on top of `user`/`isLoading`'s own already-adequate null-ness/
   * loading-ness.
   */
  noProfile: boolean;
  /**
   * Signs in with email + password (`../lib/supabase/auth.ts`'s
   * `signInWithPassword`), then resolves session->role the same way the
   * initial-mount flow does (see `resolveSessionToAuthState` below) BEFORE
   * this promise resolves -- so a caller's `await login(...)` is guaranteed
   * a fully-resolved `user`/`noProfile` by the time it returns. Lets the
   * real `AuthError` (or a role-resolution failure) propagate unwrapped, per
   * `../lib/supabase/auth.ts`'s own disclosed error-propagation choice --
   * this function does not catch/wrap it.
   */
  login: (email: string, password: string) => Promise<void>;
  /**
   * Starts the Google OAuth round trip (`../lib/supabase/auth.ts`'s
   * `signInWithGoogle`). Does NOT return a user -- a real OAuth flow
   * redirects the browser away before anything meaningful could be
   * returned synchronously. The eventual `SIGNED_IN` event on the return
   * leg is picked up by this provider's own `subscribeToAuthStateChange`
   * listener; callers (`LoginPage.tsx`/`AcceptInvitePage.tsx`) observe the
   * resulting resolved `user` via `useAuth()` itself, not this call's
   * return value -- see those files' module docs for the full return-leg
   * design.
   */
  loginWithGoogle: (redirectTo: string) => Promise<void>;
  /**
   * Signs out (`../lib/supabase/auth.ts`'s `signOut`) and clears local auth
   * state. Deliberately NEVER rejects (internally catches and logs any
   * `signOut()` failure) -- two existing call sites
   * (`src/pages/no-access/NoAccessPage.tsx`, `src/pages/settings/
   * SettingsPage.tsx`) call `logout()` fire-and-forget with no
   * `.catch`/`try`, so a remote failure here must not surface as an
   * unhandled promise rejection. Local session state is cleared regardless
   * of whether the remote `signOut()` call itself succeeded.
   */
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

// ---------------------------------------------------------------------------
// Real auth wiring (T073b2)
// ---------------------------------------------------------------------------

interface ResolvedAuthState {
  user: AuthUser | null;
  noProfile: boolean;
}

/**
 * THE single source of truth for the two-step session->role resolution
 * (Trap #1/#6 of this task's worker packet): `session = await
 * getInitialSession()`, then (if a session exists) `role = await
 * resolveRole(session.user.id)`. Called by all three places that ever need
 * to turn a (possibly-null) session into `user`/`noProfile`: the
 * initial-mount effect, the `subscribeToAuthStateChange` listener, and
 * `login()`'s own explicit resolution -- see each call site below. Never
 * touches `isLoading` itself; every caller is responsible for setting
 * `isLoading: false` only once this promise has settled, which is what
 * guarantees `isLoading` spans BOTH steps no matter which caller invoked it.
 */
async function resolveSessionToAuthState(
  session: AuthSession | null,
  resolveRole: AuthModule['resolveRole'],
): Promise<ResolvedAuthState> {
  if (!session) {
    return { user: null, noProfile: false };
  }

  const roleResolution = await resolveRole(session.user.id);
  if (roleResolution.status === 'no-profile') {
    return { user: null, noProfile: true };
  }

  const { email } = session.user;
  if (!email) {
    // Every real sign-in path this app supports (email/password, Google)
    // supplies an email -- the SDK's own type still allows `email` to be
    // undefined (e.g. phone-based auth, unused here). Fail loud rather than
    // fabricate an empty-string email a downstream screen could mistake for
    // a real one: treated the same as "no usable profile" so `RequireAuth`
    // renders `NoAccessPage` instead of crashing on a malformed `AuthUser`.
    return { user: null, noProfile: true };
  }

  return {
    user: { id: session.user.id, email, role: roleResolution.role },
    noProfile: false,
  };
}

export interface AuthProviderProps {
  children: ReactNode;
  /**
   * T073b2: injectable seam (see `AuthModule` above). Defaults to the real
   * `../lib/supabase/auth.ts`-backed implementation; tests pass a fake here
   * (see `src/test-utils/authHarness.tsx`) instead of hitting a real
   * backend.
   */
  authModule?: AuthModule;
}

export function AuthProvider({
  children,
  authModule = defaultAuthModule,
}: AuthProviderProps): ReactNode {
  const [state, setState] = useState<{
    user: AuthUser | null;
    isLoading: boolean;
    noProfile: boolean;
  }>({
    user: null,
    isLoading: true,
    noProfile: false,
  });

  useEffect(() => {
    let isMounted = true;

    async function init(): Promise<void> {
      try {
        const session = await authModule.getInitialSession();
        const resolved = await resolveSessionToAuthState(session, authModule.resolveRole);
        if (isMounted) {
          setState({ user: resolved.user, isLoading: false, noProfile: resolved.noProfile });
        }
      } catch (error) {
        // Real backend unreachable/unconfigured (e.g. `SupabaseNotConfiguredError`
        // -- no `.env` present, per `src/lib/supabase/client.ts`) or a
        // genuine transport failure resolving the initial session. Fail
        // safe to "anonymous" rather than leaving `isLoading` stuck `true`
        // forever -- that would blank every `RequireAuth`-protected route
        // indefinitely, a worse and less visible failure than the `/login`
        // redirect this produces instead. Logged, never silently swallowed.
        console.error('AuthProvider: failed to resolve the initial auth session.', error);
        if (isMounted) {
          setState({ user: null, isLoading: false, noProfile: false });
        }
      }
    }

    void init();

    async function handleAuthStateChange(session: AuthSession | null): Promise<void> {
      try {
        const resolved = await resolveSessionToAuthState(session, authModule.resolveRole);
        if (isMounted) {
          setState({ user: resolved.user, isLoading: false, noProfile: resolved.noProfile });
        }
      } catch (error) {
        console.error('AuthProvider: failed to resolve an auth state change.', error);
      }
    }

    let unsubscribe = (): void => {};
    try {
      unsubscribe = authModule.subscribeToAuthStateChange((_event, session) => {
        void handleAuthStateChange(session);
      });
    } catch (error) {
      // Same unconfigured/transport-failure family as `init()`'s catch
      // above -- `subscribeToAuthStateChange` is a plain (non-`async`)
      // function, so an unconfigured-client failure throws SYNCHRONOUSLY
      // here rather than rejecting a promise; caught the same way, for the
      // same reason (never let it crash this effect / the render tree).
      console.error('AuthProvider: failed to subscribe to auth state changes.', error);
    }

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, [authModule]);

  const login = useCallback(
    async (email: string, password: string) => {
      const session = await authModule.signInWithPassword(email, password);
      const resolved = await resolveSessionToAuthState(session, authModule.resolveRole);
      setState({ user: resolved.user, isLoading: false, noProfile: resolved.noProfile });
    },
    [authModule],
  );

  const loginWithGoogle = useCallback(
    async (redirectTo: string) => {
      await authModule.signInWithGoogle(redirectTo);
      // No further action here -- see `AuthContextValue.loginWithGoogle`'s
      // doc comment above for the full return-leg design.
    },
    [authModule],
  );

  const logout = useCallback(async () => {
    try {
      await authModule.signOut();
    } catch (error) {
      // See `AuthContextValue.logout`'s doc comment above -- deliberately
      // never rethrown.
      console.error('AuthProvider: signOut() failed; clearing local session anyway.', error);
    } finally {
      setState({ user: null, isLoading: false, noProfile: false });
    }
  }, [authModule]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user: state.user,
      isLoading: state.isLoading,
      noProfile: state.noProfile,
      login,
      loginWithGoogle,
      logout,
    }),
    [state, login, loginWithGoogle, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/** Must be called within an `<AuthProvider>`. Throws otherwise (fail loud). */
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth() must be called within an <AuthProvider>.');
  }
  return ctx;
}

// ---------------------------------------------------------------------------
// NAV-08: intended-URL storage
// ---------------------------------------------------------------------------

const INTENDED_URL_STORAGE_KEY = 'volt.intendedUrl';

function getStorage(): Storage | null {
  try {
    return window.sessionStorage;
  } catch {
    // sessionStorage can throw in locked-down/private-browsing contexts.
    return null;
  }
}

/** Records the URL a guard redirected the user away from (NAV-08). */
export function setIntendedUrl(url: string): void {
  getStorage()?.setItem(INTENDED_URL_STORAGE_KEY, url);
}

/** Reads the stored intended URL, if any, without clearing it. */
export function getIntendedUrl(): string | null {
  return getStorage()?.getItem(INTENDED_URL_STORAGE_KEY) ?? null;
}

export function clearIntendedUrl(): void {
  getStorage()?.removeItem(INTENDED_URL_STORAGE_KEY);
}

/**
 * Reads and clears the stored intended URL in one step, returning
 * `fallback` when none was stored. Intended for use by the `/login` page
 * (or the Google OAuth callback return leg) immediately after a successful
 * login round trip resolves, per NAV-08.
 */
export function consumeIntendedUrl(fallback = '/'): string {
  const intended = getIntendedUrl();
  clearIntendedUrl();
  return intended ?? fallback;
}

// ---------------------------------------------------------------------------
// Toast placeholder (pub/sub)
// ---------------------------------------------------------------------------
// Rendering the actual Toast UI is out of scope for T005 (no src/theme/**
// changes allowed here); T006 (AppShell) is expected to subscribe via
// `subscribeToast` and render whatever the design system's toast component
// is. This module only guarantees the *message* and the *trigger point*
// required by NAV-06.

export const ACCESS_DENIED_TOAST_MESSAGE = "You don't have access to that page.";

type ToastListener = (message: string) => void;

const toastListeners = new Set<ToastListener>();

/** Returns an unsubscribe function. */
export function subscribeToast(listener: ToastListener): () => void {
  toastListeners.add(listener);
  return () => {
    toastListeners.delete(listener);
  };
}

export function pushToast(message: string): void {
  toastListeners.forEach((listener) => listener(message));
}

// ---------------------------------------------------------------------------
// NAV-06 guards
// ---------------------------------------------------------------------------

export interface RequireAuthProps {
  children: ReactNode;
}

/**
 * Redirects unauthenticated users to `/login`, first storing the intended
 * URL (NAV-08) so the login flow can return them to it afterward. Renders
 * nothing while `isLoading` (Trap #1: this must stay `true` across BOTH
 * steps of session->role resolution, or this guard would wrongly bounce an
 * authenticated-but-role-pending user to `/login`). Renders `<NoAccessPage
 * />` in place -- never a redirect -- for AUTH-04's no-profile case (Trap
 * #2), since redirecting to `/login` would loop.
 */
export function RequireAuth({ children }: RequireAuthProps): ReactNode {
  const { user, isLoading, noProfile } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return null;
  }

  if (noProfile) {
    return <NoAccessPage />;
  }

  if (!user) {
    setIntendedUrl(`${location.pathname}${location.search}${location.hash}`);
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

export interface RequireRoleProps {
  allowedRoles: Role[];
  children: ReactNode;
}

/**
 * Renders in place for a role-denied (or still-anonymous, or no-profile)
 * viewer -- no longer `<Navigate to="/" />` (T073b2, Trap #3: a real,
 * disclosed behavior change). `/` is now a real role dispatcher (T075) that
 * itself just re-enters role logic, so redirecting there on denial is
 * fragile/loop-prone; rendering a screen in place instead of redirecting
 * matches the AUTH-04 no-profile case's own treatment (`RequireAuth` above).
 * Also waits out `isLoading` first, same reasoning as `RequireAuth` -- a
 * role check performed before the role is even known must not treat
 * "still loading" as "denied".
 *
 * T076: the `noProfile` branch below is a genuine AUTH-04 case (this
 * session has NO matching `profiles` row at all) and correctly stays
 * pointed at `NoAccessPage` -- same reasoning as `RequireAuth`'s own
 * `noProfile` branch above. The role-mismatch branch (`!user ||
 * !allowedRoles.includes(user.role)`) is a DIFFERENT case -- a resolved,
 * valid account whose role just doesn't cover this page (or, in the
 * defensive `!user` half, `RequireRole` used standalone with no session to
 * speak of either way) -- and renders `AccessDeniedPage` instead: reusing
 * `NoAccessPage` there was a MAJOR-severity design defect (flagged against
 * T073b2, corrected here) because `NoAccessPage` unconditionally signs the
 * session out on mount and shows "You're not on the roster yet.", both
 * wrong for a perfectly valid role-mismatched account. See
 * `../pages/no-access/AccessDeniedPage.tsx`'s own module doc for the full
 * reasoning and copy.
 *
 * Meant to be nested *inside* `RequireAuth` so `user`/`isLoading`/
 * `noProfile` are already resolved by the time this runs; it still degrades
 * safely (renders `AccessDeniedPage`, never crashes) if used standalone with
 * no authenticated user.
 */
export function RequireRole({ allowedRoles, children }: RequireRoleProps): ReactNode {
  const { user, isLoading, noProfile } = useAuth();

  if (isLoading) {
    return null;
  }

  if (noProfile) {
    return <NoAccessPage />;
  }

  if (!user || !allowedRoles.includes(user.role)) {
    return <AccessDeniedPage />;
  }

  return <>{children}</>;
}
