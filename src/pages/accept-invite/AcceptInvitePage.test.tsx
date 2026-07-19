// @vitest-environment jsdom
/**
 * T073b2 (original) / T077 (this task): tests for `AcceptInvitePage.tsx`'s
 * real-auth wiring -- the `updateUserPassword(password)`/
 * `loginWithGoogle(redirectTo)` contract and the two explicit-completion
 * `useEffect`s (mirrors `../login/LoginPage.test.tsx`'s Google-path tests
 * where applicable; see that file's and this page's own module docs for the
 * full reasoning). Exercises the real `AuthProvider` (`../../app/guards`)
 * against an injected fake `authModule` (`AuthModule`, T073b2's seam) --
 * never a real Supabase backend, per this task's worker packet Trap #9 (no
 * `.env` in this environment).
 *
 * T077: `handleSetPassword` no longer calls `login(email, password)` --  it
 * calls the page's own injected `updateUserPassword` seam (see
 * `AcceptInvitePage.tsx`'s `AcceptInvitePageProps.updateUserPassword`),
 * since a session already exists from the invite link by the time this page
 * renders. Every "Set a password" test below supplies a fake
 * `updateUserPassword` prop instead of stubbing `authModule.
 * signInWithPassword`.
 *
 * T077's central addition is the `describe('<AcceptInvitePage /> premature
 * navigation (T077)')` block below: it exercises exactly the race condition
 * this task fixes -- `authModule.getInitialSession`/`resolveRole` resolving
 * to an ALREADY-VALID user before the visitor has done anything (simulating
 * "arrived via the invite link, whose own session is already active on
 * mount"). This test is written to genuinely fail against the pre-T077 code
 * (verified by temporarily reverting the navigate-effect fix locally and
 * re-running -- see this task's worker output for the full description of
 * that verification).
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
import type { AuthChangeEvent, AuthSession, AuthUser } from '../../lib/supabase/auth';
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

function buildFakeAuthUser(id: string, email: string): AuthUser {
  return buildFakeSession(id, email).user;
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
  options: {
    updateUserPassword?: (password: string) => Promise<AuthUser>;
    initialEntries?: string[];
  } = {},
): void {
  const {
    updateUserPassword = async () => buildFakeAuthUser('user-default', PENDING_INVITE.email),
    initialEntries = ['/accept-invite?token=fixture-token'],
  } = options;

  act(() => {
    root.render(
      <MemoryRouter initialEntries={initialEntries}>
        <AuthProvider authModule={authModule}>
          <Routes>
            <Route
              path="/accept-invite"
              element={
                <AcceptInvitePage
                  loadInvite={async () => PENDING_INVITE}
                  updateUserPassword={updateUserPassword}
                />
              }
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
// "Set a password" -- T077's updateUserPassword(password) contract.
// ---------------------------------------------------------------------------

describe('<AcceptInvitePage /> "Set a password"', () => {
  it('calls updateUserPassword(password) with the chosen password -- NOT login()', async () => {
    const updateUserPassword = vi.fn(async () => buildFakeAuthUser('user-1', PENDING_INVITE.email));
    const signInWithPassword = vi.fn(async () => buildFakeSession('user-1', PENDING_INVITE.email));
    const authModule = buildControllableAuthModule({ signInWithPassword });

    renderAcceptInvitePage(authModule, { updateUserPassword });
    await flushMicrotasks();
    await submitSetPasswordForm('a-strong-password');

    expect(updateUserPassword).toHaveBeenCalledWith('a-strong-password');
    // The central bug T077 fixes: setting a password must never attempt a
    // real sign-in against a password that was never set anywhere.
    expect(signInWithPassword).not.toHaveBeenCalled();
  });

  it('navigates to "/" once updateUserPassword() resolves, via the explicit hasCompletedSetup signal', async () => {
    const authModule = buildControllableAuthModule();

    renderAcceptInvitePage(authModule, {
      updateUserPassword: async () => buildFakeAuthUser('user-2', PENDING_INVITE.email),
    });
    await flushMicrotasks();
    await submitSetPasswordForm('a-strong-password');

    expect(container.querySelector('[data-testid="home-page"]')).toBeTruthy();
  });

  it('shows the real error message when updateUserPassword() rejects and does not navigate', async () => {
    const authModule = buildControllableAuthModule();

    renderAcceptInvitePage(authModule, {
      updateUserPassword: async () => {
        throw new Error('Password should be at least 6 characters.');
      },
    });
    await flushMicrotasks();
    await submitSetPasswordForm('a-strong-password');

    expect(container.textContent).toContain('Password should be at least 6 characters.');
    expect(container.querySelector('[data-testid="home-page"]')).toBeNull();
  });

  it('validates password fields client-side and does not call updateUserPassword() when invalid', async () => {
    const updateUserPassword = vi.fn(async () => buildFakeAuthUser('user-3', PENDING_INVITE.email));
    const authModule = buildControllableAuthModule();

    renderAcceptInvitePage(authModule, { updateUserPassword });
    await flushMicrotasks();
    clickButton(findButtonByText('Set password'));
    await flushMicrotasks();

    expect(updateUserPassword).not.toHaveBeenCalled();
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

// ---------------------------------------------------------------------------
// T077: THE premature-navigation race condition this task fixes.
// ---------------------------------------------------------------------------

describe('<AcceptInvitePage /> premature navigation (T077)', () => {
  it(
    'does NOT navigate away when a session/user is ALREADY resolved on initial mount ' +
      '(simulating arriving via the invite link, which establishes its own session before ' +
      'the visitor has done anything) -- still shows the "Set a password" form',
    async () => {
      // Simulates the Ground Truth scenario exactly: `getInitialSession()`
      // and `resolveRole()` both resolve to an already-valid user the
      // moment the page mounts, with ZERO user action having occurred.
      const authModule = buildControllableAuthModule({
        getInitialSession: async () => buildFakeSession('invite-user', PENDING_INVITE.email),
        resolveRole: async () => ({ status: 'found', role: 'student' }),
      });
      const updateUserPassword = vi.fn(async () =>
        buildFakeAuthUser('invite-user', PENDING_INVITE.email),
      );

      renderAcceptInvitePage(authModule, { updateUserPassword });
      await flushMicrotasks();

      // The bug this task fixes: under the OLD code, reaching a resolved
      // `user` alone (regardless of how it got resolved) triggered an
      // immediate `navigate()` -- bouncing the visitor away before they
      // ever saw the form. Assert that does NOT happen.
      expect(container.querySelector('[data-testid="home-page"]')).toBeNull();
      // The "Set a password" form must still be rendered and usable.
      expect(findButtonByText('Set password')).toBeTruthy();
      expect(updateUserPassword).not.toHaveBeenCalled();

      // Now the visitor actually completes the form -- THIS is genuine
      // completion, and navigation should occur only now.
      await submitSetPasswordForm('a-strong-password');

      expect(updateUserPassword).toHaveBeenCalledWith('a-strong-password');
      expect(container.querySelector('[data-testid="home-page"]')).toBeTruthy();
    },
  );

  it(
    'does NOT navigate away merely because a session resolves on mount, even across ' +
      'several microtask flushes with no user action taken at all',
    async () => {
      const authModule = buildControllableAuthModule({
        getInitialSession: async () => buildFakeSession('invite-user-2', PENDING_INVITE.email),
        resolveRole: async () => ({ status: 'found', role: 'parent' }),
      });

      renderAcceptInvitePage(authModule);
      await flushMicrotasks();
      await flushMicrotasks();
      await flushMicrotasks();

      expect(container.querySelector('[data-testid="home-page"]')).toBeNull();
      expect(findButtonByText('Set password')).toBeTruthy();
    },
  );
});
