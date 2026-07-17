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
 * The real auth backend (Supabase) is not wired up by this task -- only
 * `react-router-dom` was installed per the T005 packet. `AuthProvider` below
 * is a self-contained in-memory placeholder that exposes the same shape a
 * real Supabase-backed provider would need (`user`, `isLoading`, `login`,
 * `loginWithGoogle`, `logout`), so a later auth task can swap the internals
 * without changing the public `useAuth()` contract the guards depend on.
 */
import type { ReactNode } from 'react';
import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';

// ---------------------------------------------------------------------------
// Auth context (placeholder implementation -- see module doc above)
// ---------------------------------------------------------------------------

/**
 * Role identifiers referenced by this task's guard mechanism.
 *
 * NOTE: the full RBAC matrix (which routes/actions each role may access) was
 * not excerpted into the T005 worker packet, so this union is a placeholder
 * covering the roles implied elsewhere in the available PRD excerpts. Treat
 * this as provisional and reconcile against the full PRD RBAC section before
 * relying on it for anything beyond demonstrating the guard mechanism.
 */
export type Role = 'admin' | 'staff' | 'volunteer';

export interface AuthUser {
  id: string;
  email: string;
  role: Role;
}

export interface AuthContextValue {
  /** Null while unauthenticated (or before an initial session check resolves). */
  user: AuthUser | null;
  /** True until the placeholder "session check" has resolved once. */
  isLoading: boolean;
  /** Simulates a successful login (e.g. after a credentials or magic-link flow). */
  login: (user: AuthUser) => void;
  /**
   * NAV-08 Google OAuth round-trip placeholder.
   *
   * TODO(auth task): replace this body with a real
   * `supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo } })`
   * call plus a callback-route handler once Supabase auth is wired up. Until
   * then this simulates an immediate successful round trip so the NAV-08
   * "return to intended URL after login" behavior can be built and reasoned
   * about end-to-end against a stable contract.
   */
  loginWithGoogle: () => Promise<AuthUser>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const PLACEHOLDER_GOOGLE_USER: AuthUser = {
  id: 'placeholder-google-user',
  email: 'placeholder.google.user@example.com',
  role: 'staff',
};

export function AuthProvider({ children }: { children: ReactNode }): ReactNode {
  const [user, setUser] = useState<AuthUser | null>(null);
  // No real session lookup exists yet (no Supabase client wired up in this
  // task), so there is nothing async to await on mount. `isLoading` is kept
  // in the contract for when a real session check lands.
  const [isLoading] = useState(false);

  const login = useCallback((nextUser: AuthUser) => {
    setUser(nextUser);
  }, []);

  const loginWithGoogle = useCallback(async () => {
    // Placeholder round trip -- see TODO on AuthContextValue.loginWithGoogle.
    setUser(PLACEHOLDER_GOOGLE_USER);
    return PLACEHOLDER_GOOGLE_USER;
  }, []);

  const logout = useCallback(() => {
    setUser(null);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ user, isLoading, login, loginWithGoogle, logout }),
    [user, isLoading, login, loginWithGoogle, logout],
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
 * (or a future Google OAuth callback handler) immediately after a
 * successful login round trip, per NAV-08.
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
 * URL (NAV-08) so the login flow can return them to it afterward.
 */
export function RequireAuth({ children }: RequireAuthProps): ReactNode {
  const { user, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return null;
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
 * Redirects users whose role is not in `allowedRoles` back to `/` and fires
 * the NAV-06 access-denied toast. Meant to be nested *inside* `RequireAuth`
 * so `user` is guaranteed non-null by the time this runs; it still degrades
 * safely (redirects) if used standalone with no authenticated user.
 */
export function RequireRole({ allowedRoles, children }: RequireRoleProps): ReactNode {
  const { user } = useAuth();

  if (!user || !allowedRoles.includes(user.role)) {
    pushToast(ACCESS_DENIED_TOAST_MESSAGE);
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
