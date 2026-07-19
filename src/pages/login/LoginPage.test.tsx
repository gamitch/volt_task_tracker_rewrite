// @vitest-environment jsdom
/**
 * T073b2: tests for `LoginPage.tsx`'s real-auth wiring -- the
 * `login(email, password)`/`loginWithGoogle(redirectTo)` contract migration
 * and the OAuth-redirect-leg `useEffect` design (see that file's own module
 * doc for the full reasoning). Exercises the real `AuthProvider` (`../../
 * app/guards`) against an injected fake `authModule` (`AuthModule`,
 * T073b2's seam) -- never a real Supabase backend, per this task's worker
 * packet Trap #9 (no `.env` in this environment).
 *
 * No `@testing-library/react` is installed in this repo (confirmed via
 * `package.json`) -- these tests use the same raw `createRoot`/`act`
 * pattern every other test file in this project already established.
 */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthProvider, type AuthModule } from '../../app/guards';
import type { AuthChangeEvent, AuthSession, RoleResolution } from '../../lib/supabase/auth';
import { LoginPage } from './LoginPage';

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
    resolveRole: async () => ({ status: 'found', role: 'coach' }),
    ...overrides,
  };

  return {
    ...module,
    getSubscriptionCallback: () => subscriptionCallback,
  };
}

function renderLoginPage(authModule: AuthModule, initialEntries: string[] = ['/login']): void {
  act(() => {
    root.render(
      <MemoryRouter initialEntries={initialEntries}>
        <AuthProvider authModule={authModule}>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/" element={<div data-testid="home-page">Home</div>} />
            <Route path="/meetings" element={<div data-testid="meetings-page">Meetings</div>} />
          </Routes>
        </AuthProvider>
      </MemoryRouter>,
    );
  });
}

function setNativeInputValue(input: HTMLInputElement, value: string): void {
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
  setter?.call(input, value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

function getFieldControl(labelText: string): HTMLInputElement {
  const labels = Array.from(container.querySelectorAll('label'));
  const label = labels.find((el) => el.textContent?.trim().startsWith(labelText));
  if (!label) {
    throw new Error(`No label found for "${labelText}"`);
  }
  const forId = label.getAttribute('for');
  if (!forId) throw new Error(`Label "${labelText}" has no htmlFor`);
  const control = document.getElementById(forId);
  if (!control) throw new Error(`No control found for id "${forId}"`);
  return control as HTMLInputElement;
}

function findButtonByText(text: string): HTMLButtonElement | undefined {
  return Array.from(document.querySelectorAll('button')).find(
    (button) => button.textContent?.trim() === text,
  );
}

function clickButton(button: HTMLButtonElement | undefined): void {
  expect(button, 'expected a matching <button>').toBeTruthy();
  act(() => {
    button?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
}

async function submitSignInForm(email: string, password: string): Promise<void> {
  setNativeInputValue(getFieldControl('Email'), email);
  setNativeInputValue(getFieldControl('Password'), password);
  clickButton(findButtonByText('Sign in'));
  await flushMicrotasks();
}

// ---------------------------------------------------------------------------
// Email/password sign-in -- login(email, password) contract.
// ---------------------------------------------------------------------------

describe('<LoginPage /> email/password sign-in', () => {
  it('calls login(email, password) with the entered credentials', async () => {
    const signInWithPassword = vi.fn(async () => buildFakeSession('user-1', 'george@example.com'));
    const authModule = buildControllableAuthModule({ signInWithPassword });

    renderLoginPage(authModule);
    await submitSignInForm('george@example.com', 'correct-horse-battery-staple');

    expect(signInWithPassword).toHaveBeenCalledWith(
      'george@example.com',
      'correct-horse-battery-staple',
    );
  });

  it('navigates to "/" (the default fallback) once login() resolves, via the useEffect -- not a double navigate', async () => {
    const authModule = buildControllableAuthModule({
      signInWithPassword: async () => buildFakeSession('user-2', 'george@example.com'),
    });

    renderLoginPage(authModule);
    await submitSignInForm('george@example.com', 'correct-horse-battery-staple');

    expect(container.querySelector('[data-testid="home-page"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="meetings-page"]')).toBeNull();
  });

  it('navigates to the NAV-08 intended URL (not "/") when one was stored', async () => {
    window.sessionStorage.setItem('volt.intendedUrl', '/meetings');
    const authModule = buildControllableAuthModule({
      signInWithPassword: async () => buildFakeSession('user-3', 'george@example.com'),
    });

    renderLoginPage(authModule);
    await submitSignInForm('george@example.com', 'correct-horse-battery-staple');

    expect(container.querySelector('[data-testid="meetings-page"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="home-page"]')).toBeNull();
    // Consumed -- cleared after use (NAV-08), not left behind for the next
    // navigation to accidentally reuse.
    expect(window.sessionStorage.getItem('volt.intendedUrl')).toBeNull();
  });

  it('shows the real error message when login() rejects, and does not navigate', async () => {
    const authModule = buildControllableAuthModule({
      signInWithPassword: async () => {
        throw new Error('Invalid login credentials');
      },
    });

    renderLoginPage(authModule);
    await submitSignInForm('george@example.com', 'wrong-password');

    expect(container.textContent).toContain('Invalid login credentials');
    expect(container.querySelector('[data-testid="home-page"]')).toBeNull();
  });

  it('shows field errors and does not call login() when a field is blank', async () => {
    const signInWithPassword = vi.fn(async () => buildFakeSession('user-4', 'x@example.com'));
    const authModule = buildControllableAuthModule({ signInWithPassword });

    renderLoginPage(authModule);
    clickButton(findButtonByText('Sign in'));
    await flushMicrotasks();

    expect(signInWithPassword).not.toHaveBeenCalled();
    expect(container.textContent).toContain('Sign-in failed');
  });
});

// ---------------------------------------------------------------------------
// Google sign-in -- loginWithGoogle(redirectTo) contract + redirect-leg design.
// ---------------------------------------------------------------------------

describe('<LoginPage /> Google sign-in', () => {
  it('calls loginWithGoogle() with a redirectTo pointing back at this page', async () => {
    const signInWithGoogle = vi.fn<(redirectTo: string) => Promise<void>>(async () => {});
    const authModule = buildControllableAuthModule({ signInWithGoogle });

    renderLoginPage(authModule);
    clickButton(findButtonByText('Continue with Google'));
    await flushMicrotasks();

    expect(signInWithGoogle).toHaveBeenCalledTimes(1);
    const [redirectTo] = signInWithGoogle.mock.calls[0] as [string];
    expect(redirectTo).toContain('/login');
  });

  it('shows the real error message when loginWithGoogle() rejects', async () => {
    const authModule = buildControllableAuthModule({
      signInWithGoogle: async () => {
        throw new Error('OAuth provider unavailable');
      },
    });

    renderLoginPage(authModule);
    clickButton(findButtonByText('Continue with Google'));
    await flushMicrotasks();

    expect(container.textContent).toContain('OAuth provider unavailable');
  });

  it('navigates once the OAuth return-leg SIGNED_IN event resolves a real user (not while merely pending)', async () => {
    const authModule = buildControllableAuthModule({
      // Real OAuth: `signInWithGoogle` itself never resolves a user
      // synchronously (the browser would have redirected away) -- the fake
      // here mirrors that by resolving without updating any auth state.
      signInWithGoogle: async () => {},
    });

    renderLoginPage(authModule);
    clickButton(findButtonByText('Continue with Google'));
    await flushMicrotasks();

    // Still on /login -- no user resolved yet, exactly like a real pending
    // OAuth redirect.
    expect(container.querySelector('[data-testid="home-page"]')).toBeNull();

    // Simulate the return leg: the browser comes back, and
    // `AuthProvider`'s `subscribeToAuthStateChange` listener observes the
    // resulting `SIGNED_IN` event.
    const callback = authModule.getSubscriptionCallback();
    await act(async () => {
      callback?.('SIGNED_IN', buildFakeSession('user-5', 'george@example.com'));
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(container.querySelector('[data-testid="home-page"]')).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// AUTH-04 no-profile -- does not navigate away from /login (no useful
// intended URL exists for a no-profile user).
// ---------------------------------------------------------------------------

describe('<LoginPage /> AUTH-04 no-profile', () => {
  it('does not navigate when the resolved session has no profile', async () => {
    const authModule = buildControllableAuthModule({
      signInWithPassword: async () => buildFakeSession('user-6', 'ghost@example.com'),
      resolveRole: async (): Promise<RoleResolution> => ({ status: 'no-profile' }),
      // `NoAccessPage` is not mounted here (this page is `/login`, not a
      // `RequireAuth`-guarded route) -- this test only asserts the
      // `useEffect`'s own `noProfile` guard, not `NoAccessPage` itself.
    });

    renderLoginPage(authModule);
    await submitSignInForm('ghost@example.com', 'whatever');

    expect(container.querySelector('[data-testid="home-page"]')).toBeNull();
  });
});
