// @vitest-environment jsdom
/**
 * T085: tests for `RosterShell.tsx`.
 *
 * `RosterShell.tsx` never had its own test file before this task (T021's
 * original shell shipped with no colocated test, and every real tab
 * component built afterward -- T022/T025/T026/T027/T028 -- was deliberately
 * a STANDALONE component with its own test file, never touching this shell).
 * This file proves this task's own acceptance criteria directly, against the
 * real, running composed page (not against any one tab's isolated test):
 *
 *   (a) each of the four tabs, when selected, renders that tab's REAL
 *       content -- and the shell's old placeholder copy ("not built yet")
 *       is gone everywhere, not just on the initially-active tab.
 *   (b) `AdminToggles`' admin-only content is genuinely gated: a coach who
 *       legitimately reaches this coach/admin page does not see it; an
 *       admin does, regardless of which roster tab is currently active.
 *   (c) the pre-existing `RequireRole` guard and `TabList` tab-switching
 *       mechanism (both untouched by this task -- see this task's own
 *       diff) still work: a non-coach/admin role is denied, and clicking
 *       through all four tabs actually switches the rendered panel.
 *
 * Uses the same raw `createRoot`/`act` pattern (no `@testing-library/react`
 * installed in this repo) and the same `AuthProvider` + `LoginAsDeferred`
 * role-login harness every other gated content page's test file in this
 * project already established (see e.g. `ParentsTab.test.tsx`,
 * `AdminToggles.test.tsx`).
 */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthProvider, type AuthUser } from '../../app/guards';
import { LoginAsDeferred as LoginAs } from '../../test-utils/authHarness';
import { RosterShell } from './RosterShell';

// ---------------------------------------------------------------------------
// jsdom gap: `AlertDialog`/`Dialog` render a native `<dialog>` and call
// `HTMLDialogElement.prototype.showModal()`, which this repo's installed
// jsdom does not implement -- same gap `ParentsTab.test.tsx`/`StudentsTab
// .test.tsx`/`TeamsTab.test.tsx` already document and polyfill, scoped
// locally to this test file only.
// ---------------------------------------------------------------------------
if (
  typeof HTMLDialogElement !== 'undefined' &&
  typeof HTMLDialogElement.prototype.showModal !== 'function'
) {
  HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement): void {
    this.setAttribute('open', '');
  };
  HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement): void {
    this.removeAttribute('open');
  };
}

// ---------------------------------------------------------------------------
// Render harness -- mirrors `ParentsTab.test.tsx`'s own `renderGatedPage`.
// ---------------------------------------------------------------------------

let container: HTMLDivElement;
let root: Root;

const ADMIN_USER: AuthUser = { id: 'user-admin', email: 'admin@example.com', role: 'admin' };
const COACH_USER: AuthUser = { id: 'user-coach', email: 'coach@example.com', role: 'coach' };
const STUDENT_USER: AuthUser = {
  id: 'user-student',
  email: 'student@example.com',
  role: 'student',
};

function renderRosterShell(user: AuthUser | null): void {
  act(() => {
    root.render(
      <MemoryRouter initialEntries={['/roster']}>
        <AuthProvider>
          <Routes>
            <Route
              path="/roster"
              element={
                user === null ? (
                  <RosterShell />
                ) : (
                  <LoginAs user={user}>
                    <RosterShell />
                  </LoginAs>
                )
              }
            />
            <Route path="/" element={<div data-testid="redirected-home" />} />
          </Routes>
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

/**
 * `AdminToggles` is loaded via `React.lazy`/dynamic `import()`
 * (`RosterShell.tsx` module doc #6 -- a real fix for a real router.tsx
 * import cycle, not a stylistic choice). How many ticks the dynamic
 * import's first resolution takes varies with how much else Vitest/Node is
 * doing concurrently (observed directly: a fixed small loop of
 * microtask/macrotask flushes was reliably enough running this file alone,
 * but NOT reliably enough running the full `npm run test` suite, where
 * other work is contending for the event loop) -- so this polls the real
 * DOM with `vi.waitFor` (real timers, real retries up to a generous
 * timeout) instead of assuming a fixed number of ticks is always enough.
 */
async function waitForAdminTogglesReady(): Promise<void> {
  await vi.waitFor(
    () => {
      if (!container.textContent?.includes('Admin settings')) {
        throw new Error('AdminToggles lazy chunk has not resolved yet');
      }
    },
    { timeout: 5000, interval: 25 },
  );
}

function clickTab(value: 'students' | 'parents' | 'teams' | 'invites'): void {
  const tab = document.querySelector(`button[data-tab-value="${value}"]`);
  expect(tab, `expected a Tab button for "${value}"`).toBeTruthy();
  act(() => {
    tab?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
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
// (c) RequireRole guard -- unchanged from T021, quick regression check.
// ---------------------------------------------------------------------------

describe('<RosterShell /> RequireRole guard (unchanged from T021)', () => {
  it('denies a non-coach/admin role with AccessDeniedPage, not the roster content', async () => {
    renderRosterShell(STUDENT_USER);
    await flushMicrotasks();
    expect(container.querySelector('[data-testid="redirected-home"]')).toBeNull();
    expect(container.textContent).toContain("This page isn't part of your role");
    expect(container.textContent).not.toContain('Roster');
  });

  it('admits a coach', async () => {
    renderRosterShell(COACH_USER);
    await flushMicrotasks();
    expect(container.textContent).toContain('Roster');
  });

  it('admits an admin', async () => {
    renderRosterShell(ADMIN_USER);
    await flushMicrotasks();
    expect(container.textContent).toContain('Roster');
  });
});

// ---------------------------------------------------------------------------
// (a) Real tab wiring -- the central acceptance criterion for this task.
// ---------------------------------------------------------------------------

const OLD_PLACEHOLDER_STRINGS = [
  'Student roster not built yet',
  'Parent roster not built yet',
  'Team management not built yet',
  'Invite tracking not built yet',
  'not built yet',
  'T022-T028',
];

describe('<RosterShell /> real tab wiring (T085 acceptance criteria)', () => {
  it('renders the real StudentsTab (fixture data) on the initially-active Students tab', async () => {
    renderRosterShell(COACH_USER);
    await flushMicrotasks();
    // Real StudentsTab fixture row, not any placeholder copy.
    expect(container.textContent).toContain('Amara Voss');
    for (const placeholder of OLD_PLACEHOLDER_STRINGS) {
      expect(container.textContent).not.toContain(placeholder);
    }
  });

  it('renders the real ParentsTab when the Parents tab is selected', async () => {
    renderRosterShell(COACH_USER);
    await flushMicrotasks();
    clickTab('parents');
    await flushMicrotasks();
    // Real ParentsTab fixture row (ParentsTab.tsx's own FIXTURE_PARENT_PROFILES).
    expect(container.textContent).toContain('Renata Alvarez');
    expect(container.textContent).not.toContain('Parent roster not built yet');
  });

  it('renders the real TeamsTab when the Teams tab is selected', async () => {
    renderRosterShell(COACH_USER);
    await flushMicrotasks();
    clickTab('teams');
    await flushMicrotasks();
    // Real TeamsTab fixture row + its own "New team" create action, which no
    // placeholder EmptyState ever rendered.
    expect(container.textContent).toContain('Embercore');
    expect(container.textContent).toContain('New team');
    expect(container.textContent).not.toContain('Team management not built yet');
  });

  it('renders the real InvitesTab when the Invites tab is selected', async () => {
    renderRosterShell(COACH_USER);
    await flushMicrotasks();
    clickTab('invites');
    await flushMicrotasks();
    // Real InvitesTab fixture row (InvitesTab.tsx's own FIXTURE_INVITES).
    expect(container.textContent).toContain('briar.holloway.invite@example.com');
    expect(container.textContent).not.toContain('Invite tracking not built yet');
  });

  it('never shows any old placeholder copy across the full tab tour', async () => {
    renderRosterShell(ADMIN_USER);
    await flushMicrotasks();
    for (const value of ['students', 'parents', 'teams', 'invites'] as const) {
      clickTab(value);
      await flushMicrotasks();
      for (const placeholder of OLD_PLACEHOLDER_STRINGS) {
        expect(container.textContent).not.toContain(placeholder);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// (b) AdminToggles gating -- Known Context/Traps #2 placement + real gate.
// ---------------------------------------------------------------------------

describe('<RosterShell /> AdminToggles gating (T028, ROS-08)', () => {
  it('does not show admin-only settings content to a coach', async () => {
    renderRosterShell(COACH_USER);
    await flushMicrotasks();
    expect(container.textContent).not.toContain('Show first name + last initial publicly');
    expect(container.textContent).not.toContain('Admin settings');
  });

  it('shows the real admin-only settings widget to an admin on the default (Students) tab', async () => {
    renderRosterShell(ADMIN_USER);
    await flushMicrotasks();
    await waitForAdminTogglesReady();
    expect(container.textContent).toContain('Admin settings');
    expect(container.textContent).toContain('Show first name + last initial publicly');
  });

  it('keeps showing AdminToggles to an admin regardless of which tab is active', async () => {
    renderRosterShell(ADMIN_USER);
    await flushMicrotasks();
    await waitForAdminTogglesReady();
    clickTab('invites');
    await flushMicrotasks();
    expect(container.textContent).toContain('Show first name + last initial publicly');
    // And the real Invites content is also present -- AdminToggles isn't
    // hiding/replacing tab content, both coexist.
    expect(container.textContent).toContain('briar.holloway.invite@example.com');
  });
});

// ---------------------------------------------------------------------------
// (c) TabList tab-switching + keyboard-nav scaffold -- unchanged from T021,
// quick regression check only (not a full re-verification of the underlying
// Astryx TabList/Tab components, which this task never touches).
// ---------------------------------------------------------------------------

describe('<RosterShell /> tab scaffold regression check (unchanged from T021)', () => {
  it('renders all four tabs in ROS-01 literal order: Students | Parents | Teams | Invites', async () => {
    renderRosterShell(COACH_USER);
    await flushMicrotasks();
    const tabs = Array.from(document.querySelectorAll('button[data-tab-value]')).map((el) =>
      el.getAttribute('data-tab-value'),
    );
    expect(tabs).toEqual(['students', 'parents', 'teams', 'invites']);
  });

  it('switches the active/selected tab (aria-current) when a different tab is clicked', async () => {
    renderRosterShell(COACH_USER);
    await flushMicrotasks();

    const studentsTabButton = document.querySelector('button[data-tab-value="students"]');
    expect(studentsTabButton?.getAttribute('aria-current')).toBe('page');

    clickTab('teams');
    await flushMicrotasks();

    const teamsTabButton = document.querySelector('button[data-tab-value="teams"]');
    expect(teamsTabButton?.getAttribute('aria-current')).toBe('page');
    expect(studentsTabButton?.getAttribute('aria-current')).toBeNull();
  });

  it('still supports roving-tabindex ArrowRight keyboard navigation across the tab strip', async () => {
    renderRosterShell(COACH_USER);
    await flushMicrotasks();

    const studentsTabButton = document.querySelector(
      'button[data-tab-value="students"]',
    ) as HTMLButtonElement;
    const parentsTabButton = document.querySelector(
      'button[data-tab-value="parents"]',
    ) as HTMLButtonElement;

    act(() => {
      studentsTabButton.focus();
    });
    expect(document.activeElement).toBe(studentsTabButton);

    act(() => {
      studentsTabButton.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }),
      );
    });

    expect(document.activeElement).toBe(parentsTabButton);
  });
});
