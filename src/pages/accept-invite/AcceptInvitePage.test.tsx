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
 *
 * T102 (ED-1 Packet P13) addition: the `loadInvite (T102 real load, Trap
 * #1/#2)` describe block at the bottom of this file tests
 * `../../lib/supabase/loaders/accept.ts`'s `makeLoadInvite` directly against
 * a stubbed `SupabaseClient` (never a real backend), same DI pattern
 * `InvitesTab.test.tsx`'s `loadInvitesTabData` suite and
 * `src/lib/supabase/loader.test.ts` already establish. Every test ABOVE that
 * block is unchanged by T102 -- they all already inject their own
 * `loadInvite` prop explicitly (see `renderAcceptInvitePage`'s default
 * above), so swapping this page's own implicit `loadInvite` default
 * (`defaultLoadInvite` -> the real `loadInvite`, see `AcceptInvitePage.tsx`'s
 * module doc) does not affect them.
 */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import type { SupabaseClient } from '@supabase/supabase-js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthProvider, type AuthModule } from '../../app/guards';
import type { AuthChangeEvent, AuthSession, AuthUser } from '../../lib/supabase/auth';
import { makeLoadInvite } from '../../lib/supabase/loaders/accept';
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
// T079: surviving a GENUINE browser hard redirect via sessionStorage -- the
// disclosed MINOR gap T077's own checker found (a plain in-memory
// `googleSignInStarted` `useState` does not survive a real `window.location`
// round trip, which fully unmounts and remounts this component). These tests
// simulate that by genuinely unmounting the whole React tree (not just
// swapping a prop/route) and mounting a BRAND NEW tree in a fresh container,
// with `sessionStorage` (a real browser API, not React state) left standing
// in between -- proving the completion signal survives past a real remount,
// not merely within one render tree's lifetime.
// ---------------------------------------------------------------------------

describe('<AcceptInvitePage /> Google sign-in survives a hard-redirect remount (T079)', () => {
  /** Mounts a fresh `<AcceptInvitePage />` tree in a brand-new container/root
   * (never reusing the outer `container`/`root`), simulating arriving at
   * `/accept-invite` on a genuinely new page load -- e.g. the browser
   * returning from a real Google OAuth redirect. Caller is responsible for
   * unmounting the returned root. */
  function mountFreshAcceptInvitePage(authModule: AuthModule): { root: Root; el: HTMLDivElement } {
    const el = document.createElement('div');
    document.body.appendChild(el);
    const freshRoot = createRoot(el);
    act(() => {
      freshRoot.render(
        <MemoryRouter initialEntries={['/accept-invite?token=fixture-token']}>
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
    return { root: freshRoot, el };
  }

  it(
    'navigates on a brand-new mount after a simulated hard redirect, when the visitor ' +
      'genuinely clicked "Continue with Google" before the (simulated) redirect',
    async () => {
      // Step 1: the visitor is on the page and clicks "Continue with
      // Google" -- this is what a real `signInWithGoogle` call would do
      // right before navigating the browser away.
      const outboundAuthModule = buildControllableAuthModule({
        signInWithGoogle: async () => {},
      });
      renderAcceptInvitePage(outboundAuthModule);
      await flushMicrotasks();
      clickButton(findButtonByText('Continue with Google'));
      await flushMicrotasks();
      expect(container.querySelector('[data-testid="home-page"]')).toBeNull();

      // Step 2: simulate the REAL hard redirect -- fully unmount this
      // component (destroying every in-memory `useState`, including the old
      // `googleSignInStarted`), exactly like a real page unload would.
      act(() => {
        root.unmount();
      });

      // Step 3: the browser "returns" -- a brand-new tree mounts fresh in a
      // brand-new container (nothing shared with Step 1/2's tree except
      // `sessionStorage`, a real browser API). Its `AuthProvider` resolves
      // an already-valid session immediately on mount, exactly like the real
      // OAuth callback URL auto-parse this file's module doc describes.
      const returnAuthModule = buildControllableAuthModule({
        getInitialSession: async () => buildFakeSession('user-oauth-return', PENDING_INVITE.email),
        resolveRole: async () => ({ status: 'found', role: 'coach' }),
      });
      const { root: returnRoot, el: returnEl } = mountFreshAcceptInvitePage(returnAuthModule);
      await flushMicrotasks();

      // The fix: despite this being a totally fresh mount with no in-memory
      // state carried over, the persisted sessionStorage flag lets this page
      // correctly recognize "this resolved user is the result of a Google
      // sign-in the visitor genuinely started" and navigate away -- instead
      // of showing the "Set a password" form again.
      expect(returnEl.querySelector('[data-testid="home-page"]')).toBeTruthy();

      act(() => {
        returnRoot.unmount();
      });
      returnEl.remove();
    },
  );

  it(
    'the persisted flag is read-and-cleared: a THIRD, unrelated mount with an ' +
      'already-resolved session does NOT navigate away (no lingering flag)',
    async () => {
      // Step 1 + 2 exactly as above: click "Continue with Google", then
      // simulate the hard redirect via a full unmount.
      const outboundAuthModule = buildControllableAuthModule({
        signInWithGoogle: async () => {},
      });
      renderAcceptInvitePage(outboundAuthModule);
      await flushMicrotasks();
      clickButton(findButtonByText('Continue with Google'));
      await flushMicrotasks();

      act(() => {
        root.unmount();
      });

      // Step 3: the genuine OAuth return-leg mount -- consumes (reads AND
      // clears) the persisted flag, and correctly navigates (proven by the
      // test above).
      const returnAuthModule = buildControllableAuthModule({
        getInitialSession: async () =>
          buildFakeSession('user-oauth-return-2', PENDING_INVITE.email),
        resolveRole: async () => ({ status: 'found', role: 'coach' }),
      });
      const { root: returnRoot, el: returnEl } = mountFreshAcceptInvitePage(returnAuthModule);
      await flushMicrotasks();
      expect(returnEl.querySelector('[data-testid="home-page"]')).toBeTruthy();

      act(() => {
        returnRoot.unmount();
      });
      returnEl.remove();

      // Step 4: a THIRD, completely unrelated mount (e.g. the visitor later
      // re-opens the same invite link in the same tab, whose own session is
      // already active -- the exact T077 Ground Truth scenario). If the T079
      // flag were left lingering instead of being cleared in Step 3, this
      // mount would wrongly inherit it and navigate away immediately,
      // reproducing T077's original premature-navigation bug. It must NOT.
      const thirdAuthModule = buildControllableAuthModule({
        getInitialSession: async () => buildFakeSession('invite-user-3', PENDING_INVITE.email),
        resolveRole: async () => ({ status: 'found', role: 'coach' }),
      });
      const { root: thirdRoot, el: thirdEl } = mountFreshAcceptInvitePage(thirdAuthModule);
      await flushMicrotasks();

      expect(thirdEl.querySelector('[data-testid="home-page"]')).toBeNull();
      expect(
        Array.from(thirdEl.querySelectorAll('button')).find(
          (button) => button.textContent?.trim() === 'Set password',
        ),
      ).toBeTruthy();

      act(() => {
        thirdRoot.unmount();
      });
      thirdEl.remove();
    },
  );
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

// ---------------------------------------------------------------------------
// T102 (ED-1 Packet P13): `loadInvite` real load -- `../../lib/supabase/
// loaders/accept.ts`'s `makeLoadInvite`, against a stubbed `SupabaseClient`
// only (never a real backend). See that module's own doc comment for the
// full Trap #1/#2 investigation this suite proves: `invites` is NEVER
// queried (grep this file's `fromSpy` assertions below -- only `'profiles'`
// is ever passed to `.from(...)`), and `status` only ever resolves
// `'pending'` on success.
// ---------------------------------------------------------------------------

/** Real-shaped fake session whose `user.user_metadata` is caller-supplied --
 * unlike this file's own `buildFakeSession` above (always empty metadata),
 * these tests need to control `role`/`full_name`/`name` directly. */
function buildFakeSessionWithMetadata(
  id: string,
  email: string | undefined,
  userMetadata: Record<string, unknown>,
): AuthSession {
  return {
    access_token: `fake-access-token-${id}`,
    refresh_token: `fake-refresh-token-${id}`,
    expires_in: 3600,
    token_type: 'bearer',
    user: {
      id,
      email,
      app_metadata: {},
      user_metadata: userMetadata,
      aud: 'authenticated',
      created_at: new Date(0).toISOString(),
    },
  } as AuthSession;
}

/** Stubs exactly the two chains `makeLoadInvite` uses:
 * `client.auth.getSession()` (via `../../lib/supabase/auth.ts`'s
 * `getInitialSession`) and `client.from('profiles').select('display_name')
 * .eq('id', ...).maybeSingle().overrideTypes(...)` (same stub shape
 * `auth.test.ts`'s own `buildFakeProfilesClient` already establishes for the
 * identical chain). Nothing else on the client is ever touched -- in
 * particular, `.from('invites')` is never called (Trap #1), asserted
 * directly in the tests below via `fromSpy`. */
function buildFakeAcceptClient(options: {
  session: AuthSession | null;
  profileRow?: { display_name: string } | null;
  profileError?: { message: string; code?: string } | null;
}): { client: SupabaseClient; fromSpy: ReturnType<typeof vi.fn> } {
  const { session, profileRow = null, profileError = null } = options;
  const getSession = vi.fn().mockResolvedValue({ data: { session }, error: null });
  const overrideTypes = vi.fn().mockResolvedValue({ data: profileRow, error: profileError });
  const maybeSingle = vi.fn().mockReturnValue({ overrideTypes });
  const eq = vi.fn().mockReturnValue({ maybeSingle });
  const select = vi.fn().mockReturnValue({ eq });
  const fromSpy = vi.fn().mockReturnValue({ select });
  const client = { auth: { getSession }, from: fromSpy } as unknown as SupabaseClient;
  return { client, fromSpy };
}

describe('loadInvite (T102 real load, Trap #1/#2)', () => {
  it('resolves { name, email, role, status: "pending" } from session.user_metadata + profiles.display_name -- never queries invites', async () => {
    const session = buildFakeSessionWithMetadata('invite-user-real', 'riley.nguyen@example.com', {
      role: 'student',
      student_id: 'student-1',
      invite_id: 'invite-1',
    });
    const { client, fromSpy } = buildFakeAcceptClient({
      session,
      profileRow: { display_name: 'Riley Nguyen' },
    });
    const load = makeLoadInvite(() => client);

    const result = await load('some-token');

    expect(result).toEqual({
      name: 'Riley Nguyen',
      email: 'riley.nguyen@example.com',
      role: 'student',
      status: 'pending',
    });
    expect(fromSpy).toHaveBeenCalledWith('profiles');
    expect(fromSpy).not.toHaveBeenCalledWith('invites');
  });

  it('derives a fallback name from user_metadata.full_name when no profiles row exists yet', async () => {
    const session = buildFakeSessionWithMetadata('invite-user-2', 'jordan.rivera@example.com', {
      role: 'coach',
      full_name: 'Jordan Rivera',
    });
    const { client } = buildFakeAcceptClient({ session, profileRow: null });
    const load = makeLoadInvite(() => client);

    const result = await load(null);

    expect(result).toEqual({
      name: 'Jordan Rivera',
      email: 'jordan.rivera@example.com',
      role: 'coach',
      status: 'pending',
    });
  });

  it("falls back to the local part of the email when no profiles row and no full_name/name metadata exist (mirrors the DB trigger's own formula)", async () => {
    const session = buildFakeSessionWithMetadata('invite-user-3', 'taylor.morgan@example.com', {
      role: 'parent',
    });
    const { client } = buildFakeAcceptClient({ session, profileRow: null });
    const load = makeLoadInvite(() => client);

    const result = await load(null);

    expect(result.name).toBe('taylor.morgan');
  });

  it("rejects when no session is resolved (Supabase's own auth layer already rejected an invalid/expired/used link)", async () => {
    const { client } = buildFakeAcceptClient({ session: null });
    const load = makeLoadInvite(() => client);

    await expect(load('bad-token')).rejects.toThrow();
  });

  it('rejects when the session has no recognizable role in user_metadata', async () => {
    const session = buildFakeSessionWithMetadata('invite-user-4', 'no.role@example.com', {});
    const { client } = buildFakeAcceptClient({ session });
    const load = makeLoadInvite(() => client);

    await expect(load(null)).rejects.toThrow();
  });

  it('rejects when the session has no email', async () => {
    const session = buildFakeSessionWithMetadata('invite-user-5', undefined, { role: 'admin' });
    const { client } = buildFakeAcceptClient({ session });
    const load = makeLoadInvite(() => client);

    await expect(load(null)).rejects.toThrow();
  });

  it('propagates a genuine profiles query error (not silently swallowed into a fallback name)', async () => {
    const session = buildFakeSessionWithMetadata('invite-user-6', 'sam.lee@example.com', {
      role: 'student',
    });
    const { client } = buildFakeAcceptClient({
      session,
      profileError: { message: 'permission denied for table profiles', code: '42501' },
    });
    const load = makeLoadInvite(() => client);

    await expect(load(null)).rejects.toMatchObject({ code: '42501' });
  });
});
