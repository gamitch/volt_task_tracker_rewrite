// @vitest-environment jsdom
/**
 * T028: tests for `AdminToggles.tsx`.
 *
 * Per this task's Allowed Files ("A colocated `AdminToggles.test.tsx` is
 * acceptable per established precedent") this is a deliberate, disclosed
 * addition, the same class of addition `StudentsTab.test.tsx`/T022 and
 * `LiveConsole.test.tsx`/T033 already made in this same directory tree --
 * existing specifically to produce the packet's own "Required Worker Output"
 * proof requirements:
 *
 *   1. Real proof of the SEC-04 default-ON state (module doc #4 in
 *      `AdminToggles.tsx`) -- the `Switch` genuinely renders checked on
 *      first load from the fixture, then genuinely flips (both the on-screen
 *      state and the injected `onTogglePrivacy` persistence seam) when
 *      clicked.
 *   2. Real proof of the admin-only gate (module doc #5) -- a `coach` (who
 *      legitimately reaches the surrounding /roster page per
 *      `RosterShell.tsx`) sees NOTHING from this component, an unauthenticated
 *      user sees nothing, and only an `admin` sees the widget.
 *   3. Real proof the season default-goal shortcut `Link` resolves to
 *      `/settings/season` (module doc #6) -- a real `<a href>`, not a stub.
 *   4. Real proof the schema-gap disclosure `Banner` (module docs #1/#2) is
 *      visible and dismissable.
 *
 * No `@testing-library/react` is installed in this repo (confirmed via
 * `package.json`) -- these tests use the same raw `createRoot`/`act` pattern
 * every prior content-page test file in this batch already established,
 * including `LiveConsole.test.tsx`'s `AuthProvider` + `LoginAs` role-login
 * harness (needed here too, since `AdminToggles` reads `useAuth()` directly)
 * and a bare `MemoryRouter` wrapper (no `Routes`/`useParams` needed here,
 * unlike `LiveConsole.test.tsx` -- `AdminToggles` never reads route params,
 * it only needs `MemoryRouter` present so `Link as={RouterLink}` has a
 * router context to render a real `<a href>` into, matching
 * `CheckinResult.test.tsx`'s bare-`MemoryRouter` precedent).
 */
import { act, useEffect, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { AuthProvider, useAuth, type AuthUser } from '../../app/guards';
import { AdminToggles, defaultLoadPrivacySetting, defaultOnTogglePrivacy } from './AdminToggles';

// ---------------------------------------------------------------------------
// Render harness -- mirrors LiveConsole.test.tsx's LoginAs pattern.
// ---------------------------------------------------------------------------

let container: HTMLDivElement;
let root: Root;

const ADMIN_USER: AuthUser = { id: 'user-admin', email: 'admin@example.com', role: 'admin' };
const COACH_USER: AuthUser = { id: 'user-coach', email: 'coach@example.com', role: 'coach' };

function LoginAs({ user, children }: { user: AuthUser; children: ReactNode }): ReactNode {
  const { login, user: currentUser } = useAuth();
  useEffect(() => {
    if (currentUser === null) {
      login(user);
    }
  }, [currentUser, login, user]);
  if (currentUser === null) {
    return null;
  }
  return <>{children}</>;
}

function renderToggles(
  user: AuthUser | null,
  props: Parameters<typeof AdminToggles>[0] = {},
): void {
  act(() => {
    root.render(
      <MemoryRouter initialEntries={['/roster']}>
        <AuthProvider>
          {user === null ? (
            <AdminToggles {...props} />
          ) : (
            <LoginAs user={user}>
              <AdminToggles {...props} />
            </LoginAs>
          )}
        </AuthProvider>
      </MemoryRouter>,
    );
  });
}

async function flushMicrotasks(): Promise<void> {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });
}

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
});

// ---------------------------------------------------------------------------
// Fixture defaults -- direct unit proof, independent of any render.
// ---------------------------------------------------------------------------

describe('defaultLoadPrivacySetting (SEC-04 default)', () => {
  it('resolves true -- ON -- by default', async () => {
    await expect(defaultLoadPrivacySetting()).resolves.toBe(true);
  });
});

describe('defaultOnTogglePrivacy', () => {
  it('resolves without throwing (in-memory placeholder, module doc #1)', async () => {
    await expect(defaultOnTogglePrivacy(false)).resolves.toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Admin-only gate -- module doc #5.
// ---------------------------------------------------------------------------

describe('<AdminToggles /> admin-only gate (module doc #5)', () => {
  it('renders nothing for an unauthenticated user', () => {
    renderToggles(null);
    expect(container.textContent).toBe('');
  });

  it('renders nothing for a coach (stricter than the coach/admin page gate)', async () => {
    renderToggles(COACH_USER);
    await flushMicrotasks();
    expect(container.textContent).toBe('');
  });

  it('renders the widget for an admin', async () => {
    renderToggles(ADMIN_USER);
    await flushMicrotasks();
    expect(container.textContent).toContain('Show first name + last initial publicly');
  });
});

// ---------------------------------------------------------------------------
// SEC-04 default-ON + real toggle proof -- module doc #4.
// ---------------------------------------------------------------------------

describe('<AdminToggles /> leaderboard privacy Switch (SEC-04, module doc #4)', () => {
  it('defaults to ON (checked) using the real fixture seam', async () => {
    renderToggles(ADMIN_USER, { loadPrivacySetting: defaultLoadPrivacySetting });
    await flushMicrotasks();

    const input = container.querySelector('input[type="checkbox"]') as HTMLInputElement | null;
    expect(input, 'expected a Switch checkbox input').toBeTruthy();
    expect(input?.checked).toBe(true);
  });

  it('flips OFF on click, calling the injected onTogglePrivacy seam with false', async () => {
    const persisted: boolean[] = [];
    renderToggles(ADMIN_USER, {
      loadPrivacySetting: defaultLoadPrivacySetting,
      onTogglePrivacy: async (next) => {
        persisted.push(next);
      },
    });
    await flushMicrotasks();

    const input = container.querySelector('input[type="checkbox"]') as HTMLInputElement;
    expect(input.checked).toBe(true);

    act(() => {
      input.click();
    });
    await flushMicrotasks();

    expect(input.checked).toBe(false);
    expect(persisted).toEqual([false]);
  });

  it('starts OFF when the injected loadPrivacySetting resolves false', async () => {
    renderToggles(ADMIN_USER, { loadPrivacySetting: async () => false });
    await flushMicrotasks();

    const input = container.querySelector('input[type="checkbox"]') as HTMLInputElement;
    expect(input.checked).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Season default-goal shortcut -- module doc #6.
// ---------------------------------------------------------------------------

describe('<AdminToggles /> season default-goal shortcut (module doc #6)', () => {
  it('renders a real link to /settings/season', async () => {
    renderToggles(ADMIN_USER);
    await flushMicrotasks();

    const link = Array.from(container.querySelectorAll('a')).find((a) =>
      a.textContent?.includes("Set this season's default goal"),
    );
    expect(link, 'expected the season default-goal shortcut link').toBeTruthy();
    expect(link?.getAttribute('href')).toBe('/settings/season');
  });
});

// ---------------------------------------------------------------------------
// Schema-gap disclosure banner -- module docs #1/#2.
// ---------------------------------------------------------------------------

describe('<AdminToggles /> schema-gap disclosure Banner (module docs #1/#2)', () => {
  it('is visible by default, disclosing the missing persistence column', async () => {
    renderToggles(ADMIN_USER);
    await flushMicrotasks();

    expect(container.textContent).toContain('Leaderboard privacy setting is not saved yet');
    expect(container.textContent).toContain('seasons');
  });

  it('can be dismissed', async () => {
    renderToggles(ADMIN_USER);
    await flushMicrotasks();

    expect(container.textContent).toContain('Leaderboard privacy setting is not saved yet');

    const dismissButton = Array.from(container.querySelectorAll('button')).find((btn) =>
      btn.getAttribute('aria-label')?.toLowerCase().includes('dismiss'),
    );
    expect(dismissButton, 'expected a dismiss button on the Banner').toBeTruthy();
    act(() => {
      dismissButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(container.textContent).not.toContain('Leaderboard privacy setting is not saved yet');
  });
});
