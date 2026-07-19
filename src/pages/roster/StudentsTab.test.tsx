// @vitest-environment jsdom
/**
 * T022: tests for `StudentsTab.tsx`.
 *
 * Per this task's Allowed Files ("A colocated `StudentsTab.test.tsx` is
 * acceptable per established precedent") this test file is a deliberate,
 * disclosed addition -- the same class of addition `MeetingsList.test.tsx`
 * (T030), `OutreachList.test.tsx` (T038), and `CheckinResult.test.tsx`
 * (T035) already made in their own sibling directories, existing only to
 * produce the DOM-text proof this task's own packet requires in "Required
 * Worker Output": the account-status three-state derivation (module doc #3),
 * the "Invite (if email)" judgment call (module doc #2), and the Deactivate
 * `AlertDialog` reversible-flip flow (module doc #5).
 *
 * No `@testing-library/react` is installed in this repo (confirmed via
 * `package.json`) -- these tests use the same raw `createRoot`/`act` pattern
 * every prior content-page test file already established.
 */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  buildDisplayRows,
  deriveAccountStatus,
  hasPendingSelfInvite,
  shouldShowInviteAction,
  StudentsTab,
  withActiveOverride,
  type InviteRow,
  type StudentRow,
  type StudentsTabLoadResult,
  type TeamRow,
} from './StudentsTab';

// ---------------------------------------------------------------------------
// jsdom gap: `AlertDialog` renders a native `<dialog>` and calls
// `HTMLDialogElement.prototype.showModal()`, which this repo's installed
// jsdom does not implement -- same gap `MeetingsList.test.tsx` (T030)
// already documented and polyfilled, scoped locally to this test file only
// (not the shared `src/test-setup.ts`, which is outside this task's Allowed
// Files).
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
// Render harness
// ---------------------------------------------------------------------------

let container: HTMLDivElement;
let root: Root;

function renderTab(props: Parameters<typeof StudentsTab>[0] = {}): void {
  act(() => {
    root.render(<StudentsTab {...props} />);
  });
}

async function flushMicrotasks(): Promise<void> {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });
}

function clickButtonWithText(text: string): void {
  const button = Array.from(document.querySelectorAll('button')).find(
    (btn) => btn.textContent?.trim() === text,
  );
  expect(button, `expected a <button> with text "${text}"`).toBeTruthy();
  act(() => {
    button?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
}

/**
 * jsdom finding: `MoreMenu`/`DropdownMenu` (via `usePopover`/`useLayer`)
 * renders its item list UNCONDITIONALLY into the DOM every render (native
 * `popover="auto"` semantics -- visibility is toggled by the browser's own
 * Popover API via CSS, not by conditionally mounting/unmounting React
 * children). Confirmed live: with a `Table` of multiple rows, EVERY row's
 * `MoreMenu` items are simultaneously present in the DOM at all times,
 * scoped only by the trigger button's own `aria-controls` id pointing at
 * that row's `role="menu"` container -- there is no global
 * "only the open menu's items exist" invariant to rely on the way there was
 * for `MeetingsList.test.tsx`'s single-row-at-a-time `AlertDialog` case.
 * `openMoreMenuFor` therefore returns the SCOPED `role="menu"` element for
 * one specific row (via its trigger's `aria-controls`), and every
 * item-presence/click assertion below queries within that scoped element,
 * never `document`/`document.body` globally, so a different row's
 * identically-labeled item (e.g. every row has its own "Edit") can never be
 * mistaken for this row's.
 */
function openMoreMenuFor(name: string): HTMLElement {
  const trigger = document.querySelector(`button[aria-label="Actions for ${name}"]`);
  expect(trigger, `expected a MoreMenu trigger for "${name}"`).toBeTruthy();
  act(() => {
    trigger?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
  const menuId = trigger?.getAttribute('aria-controls') ?? null;
  const menu = menuId ? document.getElementById(menuId) : null;
  expect(menu, `expected a scoped menu element for "${name}"`).toBeTruthy();
  return menu as HTMLElement;
}

function menuItemTexts(menu: HTMLElement): string[] {
  return Array.from(menu.querySelectorAll('[role="menuitem"]')).map(
    (el) => el.textContent?.trim() ?? '',
  );
}

function clickMenuItem(menu: HTMLElement, text: string): void {
  const item = Array.from(menu.querySelectorAll('[role="menuitem"]')).find(
    (el) => el.textContent?.trim() === text,
  );
  expect(item, `expected a menu item "${text}" within the scoped menu`).toBeTruthy();
  act(() => {
    item?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
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
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// Pure functions -- module docs #2/#3/#5.
// ---------------------------------------------------------------------------

describe('hasPendingSelfInvite (module doc #3)', () => {
  it('is true only for a role=student, status=pending invite targeting this student', () => {
    const invites: InviteRow[] = [
      { id: 'i1', email: 'a@example.com', role: 'student', studentId: 's1', status: 'pending' },
    ];
    expect(hasPendingSelfInvite('s1', invites)).toBe(true);
  });

  it('is false for a role=parent invite targeting the same student (decoy)', () => {
    const invites: InviteRow[] = [
      { id: 'i1', email: 'parent@example.com', role: 'parent', studentId: 's1', status: 'pending' },
    ];
    expect(hasPendingSelfInvite('s1', invites)).toBe(false);
  });

  it('is false for a role=student invite that is not pending (expired/accepted/revoked)', () => {
    const invites: InviteRow[] = [
      { id: 'i1', email: 'a@example.com', role: 'student', studentId: 's1', status: 'expired' },
      { id: 'i2', email: 'b@example.com', role: 'student', studentId: 's1', status: 'accepted' },
      { id: 'i3', email: 'c@example.com', role: 'student', studentId: 's1', status: 'revoked' },
    ];
    expect(hasPendingSelfInvite('s1', invites)).toBe(false);
  });

  it('is false when no invite targets this student at all', () => {
    expect(hasPendingSelfInvite('s1', [])).toBe(false);
  });
});

describe('deriveAccountStatus (module doc #3)', () => {
  it('returns "active" whenever profileId is set, regardless of invites', () => {
    expect(deriveAccountStatus('profile-1', true)).toBe('active');
    expect(deriveAccountStatus('profile-1', false)).toBe('active');
  });

  it('returns "invited" when no profileId but a pending self-invite exists', () => {
    expect(deriveAccountStatus(null, true)).toBe('invited');
  });

  it('returns "no_account" when neither a profileId nor a pending self-invite exists', () => {
    expect(deriveAccountStatus(null, false)).toBe('no_account');
  });
});

describe('shouldShowInviteAction (module doc #2 judgment call)', () => {
  it('is true only for "no_account" -- the "Invite (if email)" condition', () => {
    expect(shouldShowInviteAction('no_account')).toBe(true);
    expect(shouldShowInviteAction('active')).toBe(false);
    expect(shouldShowInviteAction('invited')).toBe(false);
  });
});

describe('buildDisplayRows', () => {
  const teams: TeamRow[] = [{ id: 'team-1', name: 'Falcons' }];

  it('joins team name and derives account status per row, never mutating isActive', () => {
    const students: StudentRow[] = [
      {
        id: 's1',
        profileId: 'p1',
        displayName: 'Ada Lovelace',
        teamId: 'team-1',
        gradYear: 2027,
        isActive: false,
        goalHoursOverride: null,
      },
    ];
    const rows = buildDisplayRows(students, teams, []);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      id: 's1',
      name: 'Ada Lovelace',
      teamName: 'Falcons',
      accountStatus: 'active',
      isActive: false,
    });
  });
});

describe('withActiveOverride (module doc #5 -- reversible flip, never a delete)', () => {
  it('flips only the targeted row and keeps every row present', () => {
    const rows = buildDisplayRows(
      [
        {
          id: 's1',
          profileId: null,
          displayName: 'Row One',
          teamId: 'team-1',
          gradYear: null,
          isActive: true,
          goalHoursOverride: null,
        },
        {
          id: 's2',
          profileId: null,
          displayName: 'Row Two',
          teamId: 'team-1',
          gradYear: null,
          isActive: true,
          goalHoursOverride: null,
        },
      ],
      [{ id: 'team-1', name: 'Falcons' }],
      [],
    );
    const deactivated = withActiveOverride(rows, 's1', false);
    expect(deactivated).toHaveLength(2);
    expect(deactivated.find((r) => r.id === 's1')?.isActive).toBe(false);
    expect(deactivated.find((r) => r.id === 's2')?.isActive).toBe(true);

    const reactivated = withActiveOverride(deactivated, 's1', true);
    expect(reactivated.find((r) => r.id === 's1')?.isActive).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Fixture data for render tests -- deliberately covers all three account
// statuses plus the two decoy cases (module doc #7 in StudentsTab.tsx).
// ---------------------------------------------------------------------------

const TEST_TEAMS: TeamRow[] = [{ id: 'team-1', name: 'Falcons' }];

const TEST_STUDENTS: StudentRow[] = [
  {
    id: 's-active',
    profileId: 'profile-active',
    displayName: 'Ava Sterling',
    teamId: 'team-1',
    gradYear: 2027,
    isActive: true,
    goalHoursOverride: null,
  },
  {
    id: 's-invited',
    profileId: null,
    displayName: 'Ben Coulter',
    teamId: 'team-1',
    gradYear: 2026,
    isActive: true,
    goalHoursOverride: null,
  },
  {
    id: 's-no-account',
    profileId: null,
    displayName: 'Cora Vance',
    teamId: 'team-1',
    gradYear: 2028,
    isActive: true,
    goalHoursOverride: 12,
  },
];

const TEST_INVITES: InviteRow[] = [
  {
    id: 'invite-1',
    email: 'ben.invite@example.com',
    role: 'student',
    studentId: 's-invited',
    status: 'pending',
  },
];

function testLoadData(): Promise<StudentsTabLoadResult> {
  return Promise.resolve({ students: TEST_STUDENTS, teams: TEST_TEAMS, invites: TEST_INVITES });
}

// ---------------------------------------------------------------------------
// DES-12 four states + StatusDot three-state render proof.
// ---------------------------------------------------------------------------

describe('<StudentsTab /> DES-12 states', () => {
  it('shows a loading Skeleton (T081: table has predictable dimensions) before data resolves', () => {
    renderTab({ loadData: () => new Promise(() => {}) });
    expect(container.textContent).toContain('Loading students');
  });

  it('shows an error banner when loadData rejects', async () => {
    renderTab({ loadData: () => Promise.reject(new Error('boom')) });
    await flushMicrotasks();
    expect(container.textContent).toContain("Couldn't load students");
  });

  it('shows an empty state when there are no students at all', async () => {
    renderTab({ loadData: () => Promise.resolve({ students: [], teams: [], invites: [] }) });
    await flushMicrotasks();
    expect(container.textContent).toContain('No students on the roster yet');
  });

  it('renders all three account statuses correctly (module doc #3)', async () => {
    renderTab({ loadData: testLoadData });
    await flushMicrotasks();

    expect(container.textContent).toContain('Ava Sterling');
    expect(container.textContent).toContain('Ben Coulter');
    expect(container.textContent).toContain('Cora Vance');

    expect(container.textContent).toContain('Active');
    expect(container.textContent).toContain('Invited');
    expect(container.textContent).toContain('No account');

    // Goal override column: explicit value vs. "—" placeholder.
    expect(container.textContent).toContain('12 hrs');
  });
});

// ---------------------------------------------------------------------------
// "Invite (if email)" judgment-call render proof (module doc #2).
// ---------------------------------------------------------------------------

describe('<StudentsTab /> row MoreMenu -- "Invite (if email)" condition', () => {
  it('shows "Invite" only for the No account row, never for Active/Invited rows', async () => {
    renderTab({ loadData: testLoadData });
    await flushMicrotasks();

    expect(menuItemTexts(openMoreMenuFor('Ava Sterling'))).not.toContain('Invite'); // Active
    expect(menuItemTexts(openMoreMenuFor('Ben Coulter'))).not.toContain('Invite'); // Invited

    const coraMenu = openMoreMenuFor('Cora Vance'); // No account
    expect(menuItemTexts(coraMenu)).toContain('Invite');

    clickMenuItem(coraMenu, 'Invite');
    expect(container.textContent).toContain('Invite flow not built yet');
    expect(container.textContent).toContain('Cora Vance');
  });
});

// ---------------------------------------------------------------------------
// Deactivate AlertDialog reversible-flip proof (module doc #5).
// ---------------------------------------------------------------------------

describe('<StudentsTab /> Deactivate / Reactivate (ROS-09, module doc #5)', () => {
  it('opens a real AlertDialog, confirms, flips is_active, and keeps the row visible', async () => {
    renderTab({ loadData: testLoadData });
    await flushMicrotasks();

    const avaMenu = openMoreMenuFor('Ava Sterling');
    clickMenuItem(avaMenu, 'Deactivate');

    // AlertDialog is open with reversible-flip framing -- never "delete".
    expect(document.body.textContent).toContain('Deactivate Ava Sterling?');
    expect(document.body.textContent).toContain('preserved');
    expect(document.body.textContent).not.toMatch(/delete/i);

    // Confirm (the AlertDialog's own action <button>, not a menuitem <div>).
    clickButtonWithText('Deactivate');

    // Row stays visible (not removed) with an updated "Deactivated" badge.
    expect(container.textContent).toContain('Ava Sterling');
    expect(container.textContent).toContain('Deactivated');

    // MoreMenu now offers "Reactivate" instead of "Deactivate".
    const avaMenuAfter = openMoreMenuFor('Ava Sterling');
    expect(menuItemTexts(avaMenuAfter)).toContain('Reactivate');
    expect(menuItemTexts(avaMenuAfter)).not.toContain('Deactivate');

    // Reactivate flips it back directly (no AlertDialog for a non-destructive action).
    clickMenuItem(avaMenuAfter, 'Reactivate');
    expect(container.textContent).not.toContain('Deactivated');
  });
});

// ---------------------------------------------------------------------------
// Edit / Invite parent / View history stubs (module doc #8).
// ---------------------------------------------------------------------------

describe('<StudentsTab /> Edit / Invite parent / View history stubs', () => {
  it('Edit shows a disclosure banner naming T023, not a real form', async () => {
    renderTab({ loadData: testLoadData });
    await flushMicrotasks();
    clickMenuItem(openMoreMenuFor('Ava Sterling'), 'Edit');
    expect(container.textContent).toContain('Edit dialog not built yet');
    expect(container.textContent).toContain('T023');
  });

  it('Invite parent shows a disclosure banner naming T024, not a real form', async () => {
    renderTab({ loadData: testLoadData });
    await flushMicrotasks();
    clickMenuItem(openMoreMenuFor('Ava Sterling'), 'Invite parent');
    expect(container.textContent).toContain('Invite parent dialog not built yet');
    expect(container.textContent).toContain('T024');
  });

  it('View history shows a disclosure banner naming the missing route', async () => {
    renderTab({ loadData: testLoadData });
    await flushMicrotasks();
    clickMenuItem(openMoreMenuFor('Ava Sterling'), 'View history');
    expect(container.textContent).toContain('Student history page not built yet');
  });
});
