// @vitest-environment jsdom
/**
 * T076: tests for `AccessDeniedPage.tsx`, the fix for `RequireRole`'s
 * MAJOR-severity misuse of `NoAccessPage` (T020) for routine role-mismatches
 * (flagged against T073b2, Passed).
 *
 * Proves this task's own Acceptance Criteria directly against the component:
 *   1. Copy is accurate for a role-mismatch -- does NOT claim the user isn't
 *      on the roster / isn't recognized (that would be `NoAccessPage`'s
 *      AUTH-04 copy, not this screen's).
 *   2. A real "go home" action is present and points to `/`.
 *   3. The user's session/`user` state is genuinely still intact after this
 *      screen renders -- proven the same way `SettingsPage.test.tsx`'s
 *      existing logout test does: render a `useAuth()` observer alongside,
 *      assert `user` stays non-null, AND assert the injected `signOut` seam
 *      is never called (this is the core behavioral fix over `NoAccessPage`,
 *      which calls `logout()` unconditionally on mount).
 *
 * No `@testing-library/react` is installed in this repo (confirmed via
 * `package.json`) -- these tests use the same raw `createRoot`/`act` pattern
 * every other test file in this project already established (e.g.
 * `guards.test.tsx`, `SettingsPage.test.tsx`).
 */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AccessDeniedPage } from './AccessDeniedPage';
import { AuthProvider, useAuth, type AuthModule } from '../../app/guards';
import type { AuthSession, RoleResolution } from '../../lib/supabase/auth';

// ---------------------------------------------------------------------------
// Render harness -- same raw createRoot/act pattern as guards.test.tsx.
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

/** Minimal, real-shaped fake session -- same shape `guards.test.tsx` uses;
 * only `session.user.id`/`session.user.email` are meaningful. */
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

/** Builds a fake `AuthModule` (`guards.tsx`'s injectable seam) that resolves
 * to a signed-in `coach` immediately, with an injectable `signOut` spy so
 * tests can assert it is (or is not) called. */
function buildSignedInAuthModule(signOut: AuthModule['signOut']): AuthModule {
  return {
    getInitialSession: async () => buildFakeSession('access-denied-user-1', 'coach@example.com'),
    subscribeToAuthStateChange: () => () => {},
    signInWithPassword: async () => {
      throw new Error('not used by this test');
    },
    signInWithGoogle: async () => {
      throw new Error('not used by this test');
    },
    signOut,
    resolveRole: async (): Promise<RoleResolution> => ({ status: 'found', role: 'coach' }),
  };
}

/** Same shape as `SettingsPage.test.tsx`'s local `AuthObserver` -- stamps the
 * live `useAuth()` snapshot onto `sink` on every render. */
function AuthObserver({ sink }: { sink: { user: ReturnType<typeof useAuth>['user'] } }): null {
  const { user } = useAuth();
  sink.user = user;
  return null;
}

function renderAccessDeniedPage(signOut: AuthModule['signOut']): {
  sink: { user: ReturnType<typeof useAuth>['user'] };
} {
  const sink: { user: ReturnType<typeof useAuth>['user'] } = { user: null };
  const authModule = buildSignedInAuthModule(signOut);

  act(() => {
    root.render(
      <MemoryRouter>
        <AuthProvider authModule={authModule}>
          <AuthObserver sink={sink} />
          <AccessDeniedPage />
        </AuthProvider>
      </MemoryRouter>,
    );
  });

  return { sink };
}

// ---------------------------------------------------------------------------
// 1. Accurate copy -- not NoAccessPage's AUTH-04 copy.
// ---------------------------------------------------------------------------

describe('<AccessDeniedPage /> copy', () => {
  it('renders the VOLT shell and role-mismatch copy, never claiming the user is unrecognized', async () => {
    renderAccessDeniedPage(vi.fn(async () => {}));
    await flushMicrotasks();

    expect(container.textContent).toContain('VOLT');
    expect(container.textContent).toContain("This page isn't part of your role");
    expect(container.textContent).toContain(
      "this specific page just isn't available for your role",
    );

    // Must NOT claim account/roster trouble -- that is NoAccessPage's
    // (T020) distinct AUTH-04 copy, factually wrong for this case.
    expect(container.textContent).not.toContain("You're not on the roster yet.");
    expect(container.textContent).not.toContain('not recognized');
    expect(container.textContent).not.toContain("couldn't find an invite or profile");
  });
});

// ---------------------------------------------------------------------------
// 2. A real "go home" action, pointing to "/".
// ---------------------------------------------------------------------------

describe('<AccessDeniedPage /> "go home" action', () => {
  it('renders a real link to the dashboard ("/")', async () => {
    renderAccessDeniedPage(vi.fn(async () => {}));
    await flushMicrotasks();

    const homeLink = Array.from(container.querySelectorAll('a')).find(
      (anchor) => anchor.textContent?.trim() === 'Go to your dashboard',
    );
    expect(homeLink, 'expected a real "Go to your dashboard" link').toBeTruthy();
    expect(homeLink?.getAttribute('href')).toBe('/');
  });
});

// ---------------------------------------------------------------------------
// 3. Does NOT sign the user out -- the core behavioral fix over NoAccessPage.
// ---------------------------------------------------------------------------

describe('<AccessDeniedPage /> does not sign the user out', () => {
  it('never calls the injected signOut seam, and user/session state stays intact', async () => {
    const signOut = vi.fn(async () => {});
    const { sink } = renderAccessDeniedPage(signOut);
    await flushMicrotasks();

    expect(signOut).not.toHaveBeenCalled();
    expect(sink.user).toEqual({
      id: 'access-denied-user-1',
      email: 'coach@example.com',
      role: 'coach',
    });
  });

  it('still never calls signOut even after further time passes (no delayed effect)', async () => {
    const signOut = vi.fn(async () => {});
    renderAccessDeniedPage(signOut);
    await flushMicrotasks();
    await flushMicrotasks();
    await flushMicrotasks();

    expect(signOut).not.toHaveBeenCalled();
  });
});
