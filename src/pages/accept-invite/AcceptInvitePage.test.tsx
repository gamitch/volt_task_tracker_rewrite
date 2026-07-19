// @vitest-environment jsdom
/**
 * T073b2: tests for `AcceptInvitePage.tsx`'s real-auth wiring -- the
 * `login(email, password)`/`loginWithGoogle(redirectTo)` contract migration
 * and the OAuth-redirect-leg `useEffect` design (mirrors `../login/
 * LoginPage.test.tsx`'s identical tests; see that file's and this page's
 * own module docs for the full reasoning). Exercises the real
 * `AuthProvider` (`../../app/guards`) against an injected fake `authModule`
 * (`AuthModule`, T073b2's seam) -- never a real Supabase backend, per this
 * task's worker packet Trap #9 (no `.env` in this environment).
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
import type { AuthChangeEvent, AuthSession } from '../../lib/supabase/auth';
import { AcceptInvitePage } from './AcceptInvitePage';
import type { AcceptInviteData } from './types';

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

const PENDING_INVITE: AcceptInviteData = {
  name: 'Riley Nguyen',
  email: 'riley.nguyen@example.com',
  role: 'student',
  status: 'pending',
};

function renderAcceptInvitePage(
  authModule: AuthModule,
  initialEntries: string[] = ['/accept-invite?token=fixture-token'],
): void {
  act(() => {
    root.render(
      <MemoryRouter initialEntries={initialEntries}>
        <AuthProvider authModule={authModule}>
          <Routes>
            <Route
              path="/accept-invite"
              element={<AcceptInvitePage loadInvite={async () => PENDING_INVITE} />}
            />
            <Route path="/" element={<div data-testid="home-page">Home</div>} />
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

async function submitSetPasswordForm(password: string): Promise<void> {
  setNativeInputValue(getFieldControl('Password'), password);
  setNativeInputValue(getFieldControl('Confirm password'), password);
  clickButton(findButtonByText('Set password'));
  await flushMicrotasks();
}

// ---------------------------------------------------------------------------
// "Set a password" -- migrated to the login(email, password) contract.
// ---------------------------------------------------------------------------

describe('<AcceptInvitePage /> "Set a password"', () => {
  it('calls login(invite email, password) with the chosen password', async () => {
    const signInWithPassword = vi.fn(async () => buildFakeSession('user-1', PENDING_INVITE.email));
    const authModule = buildControllableAuthModule({ signInWithPassword });

    renderAcceptInvitePage(authModule);
    await flushMicrotasks();
    await submitSetPasswordForm('a-strong-password');

    expect(signInWithPassword).toHaveBeenCalledWith(PENDING_INVITE.email, 'a-strong-password');
  });

  it('navigates to "/" once login() resolves, via the useEffect', async () => {
    const authModule = buildControllableAuthModule({
      signInWithPassword: async () => buildFakeSession('user-2', PENDING_INVITE.email),
    });

    renderAcceptInvitePage(authModule);
    await flushMicrotasks();
    await submitSetPasswordForm('a-strong-password');

    expect(container.querySelector('[data-testid="home-page"]')).toBeTruthy();
  });

  it('shows the real error message when login() rejects (the disclosed, deferred gap -- no real password-setting backend call exists yet)', async () => {
    const authModule = buildControllableAuthModule({
      signInWithPassword: async () => {
        throw new Error('Invalid login credentials');
      },
    });

    renderAcceptInvitePage(authModule);
    await flushMicrotasks();
    await submitSetPasswordForm('a-strong-password');

    expect(container.textContent).toContain('Invalid login credentials');
    expect(container.querySelector('[data-testid="home-page"]')).toBeNull();
  });

  it('validates password fields client-side and does not call login() when invalid', async () => {
    const signInWithPassword = vi.fn(async () => buildFakeSession('user-3', PENDING_INVITE.email));
    const authModule = buildControllableAuthModule({ signInWithPassword });

    renderAcceptInvitePage(authModule);
    await flushMicrotasks();
    clickButton(findButtonByText('Set password'));
    await flushMicrotasks();

    expect(signInWithPassword).not.toHaveBeenCalled();
    expect(container.textContent).toContain("Couldn't set password");
  });
});

// ---------------------------------------------------------------------------
// Google sign-in -- loginWithGoogle(redirectTo) contract + redirect-leg design.
// ---------------------------------------------------------------------------

describe('<AcceptInvitePage /> Google sign-in', () => {
  it('calls loginWithGoogle() with a redirectTo pointing back at this exact page (path + token query)', async () => {
    const signInWithGoogle = vi.fn<(redirectTo: string) => Promise<void>>(async () => {});
    const authModule = buildControllableAuthModule({ signInWithGoogle });

    renderAcceptInvitePage(authModule);
    await flushMicrotasks();
    clickButton(findButtonByText('Continue with Google'));
    await flushMicrotasks();

    expect(signInWithGoogle).toHaveBeenCalledTimes(1);
    const [redirectTo] = signInWithGoogle.mock.calls[0] as [string];
    expect(redirectTo).toContain('/accept-invite');
    expect(redirectTo).toContain('token=fixture-token');
  });

  it('navigates once the OAuth return-leg SIGNED_IN event resolves a real user', async () => {
    const authModule = buildControllableAuthModule({
      signInWithGoogle: async () => {},
    });

    renderAcceptInvitePage(authModule);
    await flushMicrotasks();
    clickButton(findButtonByText('Continue with Google'));
    await flushMicrotasks();

    expect(container.querySelector('[data-testid="home-page"]')).toBeNull();

    const callback = authModule.getSubscriptionCallback();
    await act(async () => {
      callback?.('SIGNED_IN', buildFakeSession('user-4', PENDING_INVITE.email));
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(container.querySelector('[data-testid="home-page"]')).toBeTruthy();
  });

  it('shows the real error message when loginWithGoogle() rejects', async () => {
    const authModule = buildControllableAuthModule({
      signInWithGoogle: async () => {
        throw new Error('OAuth provider unavailable');
      },
    });

    renderAcceptInvitePage(authModule);
    await flushMicrotasks();
    clickButton(findButtonByText('Continue with Google'));
    await flushMicrotasks();

    expect(container.textContent).toContain('OAuth provider unavailable');
  });
});
