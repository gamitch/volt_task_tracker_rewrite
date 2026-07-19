// @vitest-environment jsdom
/**
 * T073b2: deterministic tests for `guards.tsx`'s real Supabase-backed
 * `AuthProvider`/`RequireAuth`/`RequireRole`, against the injectable
 * `authModule` seam (never a real backend -- this environment has no
 * `.env`, per this task's worker packet Trap #9). Covers every property
 * called out as this task's Acceptance Criteria:
 *
 *   1. Happy path: session -> role -> user.
 *   2. No session -> anonymous -> `RequireAuth` redirects to `/login`.
 *   3. No-profile (AUTH-04) -> `RequireAuth` renders `NoAccessPage` in
 *      place, never a redirect.
 *   4. Role-denied -> `RequireRole` renders `NoAccessPage` in place, never
 *      a redirect to `/`.
 *   5. Subscription-driven updates (`SIGNED_IN`/`SIGNED_OUT` events fired
 *      through the fake module's own subscription callback) update `user`
 *      correctly.
 *   6. `isLoading` stays `true` across BOTH steps of session->role
 *      resolution (Trap #1 -- the single most important correctness
 *      property in this task), proven with a `resolveRole` that resolves
 *      on a controlled, later tick.
 *   7. `login`/`loginWithGoogle`/`logout` call the right underlying
 *      `authModule` functions with the right arguments.
 *
 * No `@testing-library/react` is installed in this repo (confirmed via
 * `package.json`) -- these tests use the same raw `createRoot`/`act`
 * pattern every other test file in this project already established.
 */
import { act, useEffect, useRef } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthProvider, RequireAuth, RequireRole, useAuth, type AuthModule } from './guards';
import type { AuthChangeEvent, AuthSession, RoleResolution } from '../lib/supabase/auth';

// ---------------------------------------------------------------------------
// Render harness
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

/** Minimal, real-shaped fake session -- only the fields
 * `resolveSessionToAuthState` (`guards.tsx`, internal) reads
 * (`session.user.id`/`session.user.email`) are meaningful; the rest are
 * obviously-fake placeholder values. */
function buildFakeSession(id: string, email: string): AuthSession {
  return {
    access_token: `fake-access-token-${id}`,
    refresh_token: `fake-refresh-token-${id}`,
    expires_in: 3600,
    token_type: 'bearer',
    user: {
      id,
      email,
      app_metadata: {},
      user_metadata: {},
      aud: 'authenticated',
      created_at: new Date(0).toISOString(),
    },
  } as AuthSession;
}

/**
 * Builds a fully-controllable fake `AuthModule`. Every function defaults to
 * an inert stub (never resolves unexpectedly, never throws); individual
 * tests override only the functions they need. `getSubscriptionCallback()`
 * exposes whatever callback the code under test passed to
 * `subscribeToAuthStateChange`, so a test can simulate a `SIGNED_IN`/
 * `SIGNED_OUT` event directly.
 */
function buildControllableAuthModule(overrides: Partial<AuthModule> = {}): AuthModule & {
  getSubscriptionCallback: () =>
    ((event: AuthChangeEvent, session: AuthSession | null) => void) | null;
} {
  let subscriptionCallback: ((event: AuthChangeEvent, session: AuthSession | null) => void) | null =
    null;

  const module: AuthModule = {
    getInitialSession: async () => null,
    subscribeToAuthStateChange: (callback) => {
      subscriptionCallback = callback;
      return () => {
        subscriptionCallback = null;
      };
    },
    signInWithPassword: async () => {
      throw new Error('signInWithPassword: no default fake -- override in this test.');
    },
    signInWithGoogle: async () => {},
    signOut: async () => {},
    resolveRole: async () => ({ status: 'no-profile' }),
    ...overrides,
  };

  return {
    ...module,
    getSubscriptionCallback: () => subscriptionCallback,
  };
}

/** Renders a `useAuth()` observer that stamps its latest snapshot onto
 * `sink` on every render, so tests can assert on `user`/`isLoading`/
 * `noProfile` at any point in time without needing DOM text assertions. */
function Observer({
  sink,
}: {
  sink: { user: ReturnType<typeof useAuth>['user']; isLoading: boolean; noProfile: boolean };
}): null {
  const { user, isLoading, noProfile } = useAuth();
  sink.user = user;
  sink.isLoading = isLoading;
  sink.noProfile = noProfile;
  return null;
}

// ---------------------------------------------------------------------------
// 1. Happy path: session -> role -> user.
// ---------------------------------------------------------------------------

describe('AuthProvider: session -> role -> user happy path', () => {
  it('resolves a real session + role into a fully-formed AuthUser', async () => {
    const authModule = buildControllableAuthModule({
      getInitialSession: async () => buildFakeSession('user-1', 'coach@example.com'),
      resolveRole: async (): Promise<RoleResolution> => ({ status: 'found', role: 'coach' }),
    });

    const sink = { user: null, isLoading: true, noProfile: false } as {
      user: ReturnType<typeof useAuth>['user'];
      isLoading: boolean;
      noProfile: boolean;
    };

    act(() => {
      root.render(
        <AuthProvider authModule={authModule}>
          <Observer sink={sink} />
        </AuthProvider>,
      );
    });
    await flushMicrotasks();

    expect(sink.isLoading).toBe(false);
    expect(sink.noProfile).toBe(false);
    expect(sink.user).toEqual({ id: 'user-1', email: 'coach@example.com', role: 'coach' });
  });
});

// ---------------------------------------------------------------------------
// 2. No session -> anonymous -> RequireAuth redirects to /login.
// ---------------------------------------------------------------------------

describe('RequireAuth: anonymous', () => {
  it('redirects to /login when there is no session', async () => {
    const authModule = buildControllableAuthModule({
      getInitialSession: async () => null,
    });

    act(() => {
      root.render(
        <MemoryRouter initialEntries={['/protected']}>
          <AuthProvider authModule={authModule}>
            <Routes>
              <Route
                path="/protected"
                element={
                  <RequireAuth>
                    <div data-testid="protected-content">Protected</div>
                  </RequireAuth>
                }
              />
              <Route path="/login" element={<div data-testid="login-page">Login</div>} />
            </Routes>
          </AuthProvider>
        </MemoryRouter>,
      );
    });
    await flushMicrotasks();

    expect(container.querySelector('[data-testid="login-page"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="protected-content"]')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// 3. AUTH-04 no-profile -> RequireAuth renders NoAccessPage, never redirects.
// ---------------------------------------------------------------------------

describe('RequireAuth: AUTH-04 no-profile', () => {
  it('renders NoAccessPage in place, not a /login redirect', async () => {
    const authModule = buildControllableAuthModule({
      getInitialSession: async () => buildFakeSession('user-2', 'ghost@example.com'),
      resolveRole: async (): Promise<RoleResolution> => ({ status: 'no-profile' }),
      // `NoAccessPage` (T020) signs the user out on mount -- once that
      // resolves, this provider's own state clears `noProfile` back to
      // `false` and `RequireAuth` would then redirect to `/login` (a real,
      // separate, already-disclosed consequence of `NoAccessPage`'s own
      // pre-existing design, not this test's concern). Deliberately never
      // resolving `signOut()` here keeps the render stable at the
      // `NoAccessPage` state this test is actually asserting on.
      signOut: () => new Promise<void>(() => {}),
    });

    act(() => {
      root.render(
        <MemoryRouter initialEntries={['/protected']}>
          <AuthProvider authModule={authModule}>
            <Routes>
              <Route
                path="/protected"
                element={
                  <RequireAuth>
                    <div data-testid="protected-content">Protected</div>
                  </RequireAuth>
                }
              />
              <Route path="/login" element={<div data-testid="login-page">Login</div>} />
            </Routes>
          </AuthProvider>
        </MemoryRouter>,
      );
    });
    await flushMicrotasks();

    expect(container.textContent).toContain("You're not on the roster yet.");
    expect(container.querySelector('[data-testid="login-page"]')).toBeNull();
    expect(container.querySelector('[data-testid="protected-content"]')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// 4. Role-denied -> RequireRole renders NoAccessPage, never redirects to /.
// ---------------------------------------------------------------------------

describe('RequireRole: role-denied', () => {
  it('renders NoAccessPage in place, not a "/" redirect', async () => {
    const authModule = buildControllableAuthModule({
      getInitialSession: async () => buildFakeSession('user-3', 'student@example.com'),
      resolveRole: async (): Promise<RoleResolution> => ({ status: 'found', role: 'student' }),
      // See the identical `signOut` note in the AUTH-04 no-profile test
      // above -- `NoAccessPage` signs the user out on mount, which would
      // otherwise race this test's own assertion.
      signOut: () => new Promise<void>(() => {}),
    });

    act(() => {
      root.render(
        <MemoryRouter initialEntries={['/coach-only']}>
          <AuthProvider authModule={authModule}>
            <Routes>
              <Route
                path="/coach-only"
                element={
                  <RequireAuth>
                    <RequireRole allowedRoles={['coach', 'admin']}>
                      <div data-testid="coach-content">Coach-only</div>
                    </RequireRole>
                  </RequireAuth>
                }
              />
              <Route path="/" element={<div data-testid="redirected-home">Home</div>} />
            </Routes>
          </AuthProvider>
        </MemoryRouter>,
      );
    });
    await flushMicrotasks();

    expect(container.textContent).toContain("You're not on the roster yet.");
    expect(container.querySelector('[data-testid="redirected-home"]')).toBeNull();
    expect(container.querySelector('[data-testid="coach-content"]')).toBeNull();
  });

  it('renders children for an allowed role', async () => {
    const authModule = buildControllableAuthModule({
      getInitialSession: async () => buildFakeSession('user-4', 'coach@example.com'),
      resolveRole: async (): Promise<RoleResolution> => ({ status: 'found', role: 'coach' }),
    });

    act(() => {
      root.render(
        <MemoryRouter initialEntries={['/coach-only']}>
          <AuthProvider authModule={authModule}>
            <Routes>
              <Route
                path="/coach-only"
                element={
                  <RequireAuth>
                    <RequireRole allowedRoles={['coach', 'admin']}>
                      <div data-testid="coach-content">Coach-only</div>
                    </RequireRole>
                  </RequireAuth>
                }
              />
            </Routes>
          </AuthProvider>
        </MemoryRouter>,
      );
    });
    await flushMicrotasks();

    expect(container.querySelector('[data-testid="coach-content"]')).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// 5. Subscription-driven updates.
// ---------------------------------------------------------------------------

describe('AuthProvider: subscription-driven updates', () => {
  it('updates user on a SIGNED_IN event, then clears it on SIGNED_OUT', async () => {
    const authModule = buildControllableAuthModule({
      getInitialSession: async () => null,
      resolveRole: async (): Promise<RoleResolution> => ({ status: 'found', role: 'parent' }),
    });

    const sink = { user: null, isLoading: true, noProfile: false } as {
      user: ReturnType<typeof useAuth>['user'];
      isLoading: boolean;
      noProfile: boolean;
    };

    act(() => {
      root.render(
        <AuthProvider authModule={authModule}>
          <Observer sink={sink} />
        </AuthProvider>,
      );
    });
    await flushMicrotasks();

    // Starts anonymous -- no initial session.
    expect(sink.user).toBeNull();

    const callback = authModule.getSubscriptionCallback();
    expect(callback, 'expected subscribeToAuthStateChange to have been called').toBeTruthy();

    await act(async () => {
      callback?.('SIGNED_IN', buildFakeSession('user-5', 'parent@example.com'));
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(sink.user).toEqual({ id: 'user-5', email: 'parent@example.com', role: 'parent' });

    await act(async () => {
      callback?.('SIGNED_OUT', null);
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(sink.user).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// 6. isLoading spans BOTH steps of session -> role resolution (Trap #1).
// ---------------------------------------------------------------------------

describe('AuthProvider: isLoading spans both resolution steps', () => {
  it('stays true while getInitialSession has resolved but resolveRole has not', async () => {
    let resolveRoleLater: ((result: RoleResolution) => void) | null = null;
    const roleResolution = new Promise<RoleResolution>((resolve) => {
      resolveRoleLater = resolve;
    });

    const authModule = buildControllableAuthModule({
      // Resolves promptly -- step 1 completes quickly.
      getInitialSession: async () => buildFakeSession('user-6', 'slow-role@example.com'),
      // Step 2 deliberately does NOT resolve until the test says so.
      resolveRole: () => roleResolution,
    });

    const sink = { user: null, isLoading: true, noProfile: false } as {
      user: ReturnType<typeof useAuth>['user'];
      isLoading: boolean;
      noProfile: boolean;
    };

    act(() => {
      root.render(
        <AuthProvider authModule={authModule}>
          <Observer sink={sink} />
        </AuthProvider>,
      );
    });

    // Let `getInitialSession()` resolve and `resolveRole()` get called, but
    // NOT let `resolveRole()`'s own promise resolve yet -- this is exactly
    // the "step 1 done, step 2 still pending" midpoint Trap #1 is about.
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(sink.isLoading).toBe(true);
    expect(sink.user).toBeNull();
    expect(sink.noProfile).toBe(false);

    // Now let step 2 resolve.
    await act(async () => {
      resolveRoleLater?.({ status: 'found', role: 'coach' });
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(sink.isLoading).toBe(false);
    expect(sink.user).toEqual({ id: 'user-6', email: 'slow-role@example.com', role: 'coach' });
  });
});

// ---------------------------------------------------------------------------
// 7. login / loginWithGoogle / logout call the right underlying functions.
// ---------------------------------------------------------------------------

// Each helper below fires its call exactly ONCE, via a `useEffect` with an
// empty dependency array (a `useRef` guard makes the "exactly once" property
// explicit rather than relying solely on the empty deps array) -- calling
// `login`/`loginWithGoogle`/`logout` directly in a render body would be both
// an impure render (a real React rules-of-hooks violation, not just a test
// wart) AND an infinite loop here specifically: each of those calls updates
// `AuthProvider`'s own state, which re-renders this component, which would
// call it again.

function LoginButton(): null {
  const { login } = useAuth();
  const hasFired = useRef(false);
  useEffect(() => {
    if (!hasFired.current) {
      hasFired.current = true;
      void login('worker@example.com', 'correct-horse-battery-staple');
    }
  }, [login]);
  return null;
}

function LoginWithGoogleButton({ redirectTo }: { redirectTo: string }): null {
  const { loginWithGoogle } = useAuth();
  const hasFired = useRef(false);
  useEffect(() => {
    if (!hasFired.current) {
      hasFired.current = true;
      void loginWithGoogle(redirectTo);
    }
  }, [loginWithGoogle, redirectTo]);
  return null;
}

function LogoutButton(): null {
  const { logout } = useAuth();
  const hasFired = useRef(false);
  useEffect(() => {
    if (!hasFired.current) {
      hasFired.current = true;
      void logout();
    }
  }, [logout]);
  return null;
}

describe('AuthProvider: login/loginWithGoogle/logout call the underlying authModule', () => {
  it('login() calls signInWithPassword with the given credentials, then resolves session->role', async () => {
    const signInWithPassword = vi.fn(async () => buildFakeSession('user-7', 'worker@example.com'));
    const authModule = buildControllableAuthModule({
      getInitialSession: async () => null,
      signInWithPassword,
      resolveRole: async (): Promise<RoleResolution> => ({ status: 'found', role: 'admin' }),
    });

    const sink = { user: null, isLoading: true, noProfile: false } as {
      user: ReturnType<typeof useAuth>['user'];
      isLoading: boolean;
      noProfile: boolean;
    };

    act(() => {
      root.render(
        <AuthProvider authModule={authModule}>
          <Observer sink={sink} />
          <LoginButton />
        </AuthProvider>,
      );
    });
    await flushMicrotasks();

    expect(signInWithPassword).toHaveBeenCalledWith(
      'worker@example.com',
      'correct-horse-battery-staple',
    );
    expect(sink.user).toEqual({ id: 'user-7', email: 'worker@example.com', role: 'admin' });
  });

  it('loginWithGoogle() calls signInWithGoogle with the given redirectTo', async () => {
    const signInWithGoogle = vi.fn(async () => {});
    const authModule = buildControllableAuthModule({
      getInitialSession: async () => null,
      signInWithGoogle,
    });

    act(() => {
      root.render(
        <AuthProvider authModule={authModule}>
          <LoginWithGoogleButton redirectTo="https://volt.example/login" />
        </AuthProvider>,
      );
    });
    await flushMicrotasks();

    expect(signInWithGoogle).toHaveBeenCalledWith('https://volt.example/login');
  });

  it('logout() calls signOut and clears local user state', async () => {
    const signOut = vi.fn(async () => {});
    const authModule = buildControllableAuthModule({
      getInitialSession: async () => buildFakeSession('user-8', 'someone@example.com'),
      resolveRole: async (): Promise<RoleResolution> => ({ status: 'found', role: 'coach' }),
      signOut,
    });

    const sink = { user: null, isLoading: true, noProfile: false } as {
      user: ReturnType<typeof useAuth>['user'];
      isLoading: boolean;
      noProfile: boolean;
    };

    act(() => {
      root.render(
        <AuthProvider authModule={authModule}>
          <Observer sink={sink} />
        </AuthProvider>,
      );
    });
    await flushMicrotasks();
    expect(sink.user).not.toBeNull();

    act(() => {
      root.render(
        <AuthProvider authModule={authModule}>
          <Observer sink={sink} />
          <LogoutButton />
        </AuthProvider>,
      );
    });
    await flushMicrotasks();

    expect(signOut).toHaveBeenCalledTimes(1);
    expect(sink.user).toBeNull();
  });

  it('logout() never rejects even when signOut() itself fails, and still clears local state', async () => {
    const signOut = vi.fn(async () => {
      throw new Error('network down');
    });
    const authModule = buildControllableAuthModule({
      getInitialSession: async () => buildFakeSession('user-9', 'someone-else@example.com'),
      resolveRole: async (): Promise<RoleResolution> => ({ status: 'found', role: 'coach' }),
      signOut,
    });

    function LogoutObserver(): null {
      const { logout } = useAuth();
      const hasFired = useRef(false);
      useEffect(() => {
        if (!hasFired.current) {
          hasFired.current = true;
          void logout().catch(() => {
            throw new Error('logout() must never reject, per its own documented contract.');
          });
        }
      }, [logout]);
      return null;
    }

    const sink = { user: null, isLoading: true, noProfile: false } as {
      user: ReturnType<typeof useAuth>['user'];
      isLoading: boolean;
      noProfile: boolean;
    };

    act(() => {
      root.render(
        <AuthProvider authModule={authModule}>
          <Observer sink={sink} />
        </AuthProvider>,
      );
    });
    await flushMicrotasks();
    expect(sink.user).not.toBeNull();

    act(() => {
      root.render(
        <AuthProvider authModule={authModule}>
          <Observer sink={sink} />
          <LogoutObserver />
        </AuthProvider>,
      );
    });
    await flushMicrotasks();

    expect(signOut).toHaveBeenCalledTimes(1);
    expect(sink.user).toBeNull();
  });
});
