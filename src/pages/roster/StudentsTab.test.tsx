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
 *
 * T089 (ED-1 Packet P2) additions: real load/mutation wiring
 * (`loadStudentsTabData`/`createStudent`/`updateStudent`/`setStudentActive`,
 * `../../lib/supabase/loaders/students`) proven against stubbed
 * `SupabaseClient`s (same DI pattern `InvitesTab.test.tsx` already
 * established, T087); the first-time `StudentDialog`/`InviteParentDialog`
 * UI wiring (Add student / Edit / Invite / Invite parent, module docs
 * #8/#13/#14); optimistic-update-plus-rollback for Deactivate/Reactivate
 * (module doc #11); and the Trap #3 invite-on-submit flow end-to-end
 * (module doc #14), with `invokeEdgeFunction` mocked (module-level
 * `vi.mock`, same pattern `InviteParentDialog.test.tsx` already
 * established) -- zero real network calls anywhere in this file. Every
 * pre-existing describe block below still passes its own explicit
 * `loadData` fixture through the component's props (per T087's own
 * precedent: "the default changes, the fixture literal doesn't"), so none
 * of them depend on which function is the component's implicit default.
 */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import type { SupabaseClient } from '@supabase/supabase-js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  buildDisplayRows,
  deriveAccountStatus,
  hasPendingSelfInvite,
  shouldShowInviteAction,
  StudentsTab,
  toStudentDialogInitialData,
  withActiveOverride,
  withCreatedStudent,
  withEditedStudent,
  withInvitedStatus,
  type CreateStudentFn,
  type InviteRow,
  type SetStudentActiveFn,
  type StudentDisplayRow,
  type StudentRow,
  type StudentsTabLoadResult,
  type TeamRow,
  type UpdateStudentFn,
} from './StudentsTab';
import { invokeEdgeFunction } from '../../lib/supabase';
import {
  makeCreateStudent,
  makeLoadStudentsTabData,
  makeSetStudentActive,
  makeUpdateStudent,
} from '../../lib/supabase/loaders/students';

// ---------------------------------------------------------------------------
// T089: mock `invokeEdgeFunction` only -- every other `../../lib/supabase`
// export (e.g. `isSupabaseLoaderError`, used unmocked by both this
// component and `StudentDialog.tsx`/`InviteParentDialog.tsx`) is
// re-exported from the real module via `importOriginal`, same pattern
// `InviteParentDialog.test.tsx` already established (T087).
// ---------------------------------------------------------------------------
vi.mock('../../lib/supabase', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../lib/supabase')>();
  return { ...actual, invokeEdgeFunction: vi.fn() };
});

const mockedInvokeEdgeFunction = vi.mocked(invokeEdgeFunction);

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
 * `AlertDialog`/`StudentDialog`/`InviteParentDialog` are ALL mounted
 * simultaneously (module doc, `hasHeadingText` above) -- the page-level "Add
 * student" trigger `Button` and `StudentDialog`'s own confirm `Button` share
 * the exact literal text "Add student" (BEH-07's create-mode copy). This
 * scopes the lookup to a button rendered inside a native `<dialog>` element
 * (every Astryx `Dialog`/`AlertDialog` renders one), which the page-level
 * trigger is not, so the two can never be confused.
 */
function findDialogButtonByText(text: string): HTMLButtonElement | undefined {
  return Array.from(document.querySelectorAll('dialog button')).find(
    (btn) => btn.textContent?.trim() === text,
  ) as HTMLButtonElement | undefined;
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

/** Locates a labeled input via Astryx `Field`'s real `<label htmlFor>` --
 * same helper `StudentDialog.test.tsx`/`InviteParentDialog.test.tsx` already
 * established. Neither `StudentDialog` nor `InviteParentDialog` portal their
 * content elsewhere -- both render as ordinary children of `<StudentsTab>`,
 * so their fields are still inside this file's own `container`. */
function getFieldControl(labelText: string): HTMLElement {
  const labels = Array.from(container.querySelectorAll('label'));
  const label = labels.find((el) => el.textContent?.trim().startsWith(labelText));
  if (!label) {
    throw new Error(
      `No label found for "${labelText}". Labels present: ${labels.map((l) => l.textContent).join(' | ')}`,
    );
  }
  const forId = label.getAttribute('for');
  if (!forId) throw new Error(`Label "${labelText}" has no htmlFor`);
  const control = document.getElementById(forId);
  if (!control) throw new Error(`No control found for id "${forId}"`);
  return control;
}

function findButtonByText(text: string): HTMLButtonElement | undefined {
  return Array.from(document.querySelectorAll('button')).find(
    (button) => button.textContent?.trim() === text,
  );
}

function clickButton(button: HTMLButtonElement): void {
  act(() => {
    button.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
}

function setNativeInputValue(input: HTMLInputElement, value: string): void {
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
  setter?.call(input, value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

/**
 * `AlertDialog`/`StudentDialog`/`InviteParentDialog` are ALL mounted
 * simultaneously by `<StudentsTab>` (only `isOpen` differs) -- so
 * `document.querySelector('h2')` alone is unreliable (it returns whichever
 * `h2` happens to be first in DOM order, e.g. the closed `AlertDialog`'s own
 * "Deactivate ?" title). This checks whether ANY `h2` in the document has
 * exactly this text, scoped enough for this file's purposes (each of the
 * three dialogs uses a distinct title string).
 */
function hasHeadingText(text: string): boolean {
  return Array.from(document.querySelectorAll('h2')).some(
    (heading) => heading.textContent?.trim() === text,
  );
}

/** Opens a `Selector` via its trigger and clicks the option with the given
 * visible text -- same helper `StudentDialog.test.tsx` already established. */
function selectOption(triggerLabel: string, optionText: string): void {
  const trigger = getFieldControl(triggerLabel) as HTMLButtonElement;
  clickButton(trigger);
  const option = Array.from(document.querySelectorAll('[role="option"]')).find(
    (el) => el.textContent?.trim() === optionText,
  );
  expect(option, `expected a Selector option "${optionText}"`).toBeTruthy();
  act(() => {
    option?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
}

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  mockedInvokeEdgeFunction.mockReset();
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
  const teams: TeamRow[] = [{ id: 'team-1', name: 'Falcons', archived: false }];

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
      [{ id: 'team-1', name: 'Falcons', archived: false }],
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

const TEST_TEAMS: TeamRow[] = [{ id: 'team-1', name: 'Falcons', archived: false }];

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
// T089: `toStudentDialogInitialData`/`withCreatedStudent`/`withEditedStudent`/
// `withInvitedStatus` -- pure functions, module docs #13/#14.
// ---------------------------------------------------------------------------

describe('toStudentDialogInitialData (module doc #13)', () => {
  it('derives hasAccount as accountStatus === "active" (NOT "invited")', () => {
    const activeRow: StudentDisplayRow = {
      id: 's1',
      name: 'Ava Sterling',
      teamId: 'team-1',
      teamName: 'Falcons',
      gradYear: 2027,
      accountStatus: 'active',
      goalHoursOverride: null,
      isActive: true,
    };
    expect(toStudentDialogInitialData(activeRow)).toMatchObject({
      id: 's1',
      displayName: 'Ava Sterling',
      teamId: 'team-1',
      hasAccount: true,
    });

    const invitedRow: StudentDisplayRow = { ...activeRow, accountStatus: 'invited' };
    expect(toStudentDialogInitialData(invitedRow).hasAccount).toBe(false);

    const noAccountRow: StudentDisplayRow = { ...activeRow, accountStatus: 'no_account' };
    expect(toStudentDialogInitialData(noAccountRow).hasAccount).toBe(false);
  });
});

describe('withCreatedStudent / withEditedStudent / withInvitedStatus (module doc #14)', () => {
  const rows: StudentDisplayRow[] = [
    {
      id: 's1',
      name: 'Row One',
      teamId: 'team-1',
      teamName: 'Falcons',
      gradYear: null,
      accountStatus: 'no_account',
      goalHoursOverride: null,
      isActive: true,
    },
  ];

  it('withCreatedStudent appends without touching existing rows', () => {
    const created: StudentDisplayRow = { ...rows[0], id: 's2', name: 'Row Two' };
    const result = withCreatedStudent(rows, created);
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual(rows[0]);
    expect(result[1]).toEqual(created);
  });

  it('withEditedStudent replaces exactly the matching row', () => {
    const edited: StudentDisplayRow = { ...rows[0], name: 'Row One Edited' };
    const result = withEditedStudent(rows, edited);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Row One Edited');
  });

  it('withInvitedStatus flips only the targeted row to "invited"', () => {
    const result = withInvitedStatus(rows, 's1');
    expect(result[0].accountStatus).toBe('invited');
  });
});

// ---------------------------------------------------------------------------
// "Invite (if email)" judgment-call render proof (module doc #2), now real
// (Trap #3 decision, module doc #8c): "Invite" opens the same real
// `StudentDialog` edit dialog `handleEdit` does.
// ---------------------------------------------------------------------------

describe('<StudentsTab /> row MoreMenu -- "Invite (if email)" condition', () => {
  it('shows "Invite" only for the No account row, never for Active/Invited rows, and opens the real edit dialog', async () => {
    renderTab({ loadData: testLoadData });
    await flushMicrotasks();

    expect(menuItemTexts(openMoreMenuFor('Ava Sterling'))).not.toContain('Invite'); // Active
    expect(menuItemTexts(openMoreMenuFor('Ben Coulter'))).not.toContain('Invite'); // Invited

    const coraMenu = openMoreMenuFor('Cora Vance'); // No account
    expect(menuItemTexts(coraMenu)).toContain('Invite');

    clickMenuItem(coraMenu, 'Invite');

    // Real StudentDialog, edit mode, prefilled -- not a stub banner.
    expect(container.textContent).toContain('Edit student');
    expect((getFieldControl('Name') as HTMLInputElement).value).toBe('Cora Vance');
    // No account yet -- Email field stays enabled (StudentDialog's own
    // computeEmailFieldDisabled: edit mode + hasAccount === false).
    expect((getFieldControl('Email') as HTMLInputElement).disabled).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Deactivate/Reactivate: real mutation with optimistic flip + rollback on
// failure (module doc #11).
// ---------------------------------------------------------------------------

describe('<StudentsTab /> Deactivate / Reactivate (ROS-09, module doc #5/#11)', () => {
  it('opens a real AlertDialog, confirms, calls the real mutation, and keeps the row visible', async () => {
    const onSetStudentActive = vi.fn<SetStudentActiveFn>().mockResolvedValue(undefined);
    renderTab({ loadData: testLoadData, onSetStudentActive });
    await flushMicrotasks();

    const avaMenu = openMoreMenuFor('Ava Sterling');
    clickMenuItem(avaMenu, 'Deactivate');

    // AlertDialog is open with reversible-flip framing -- never "delete".
    expect(document.body.textContent).toContain('Deactivate Ava Sterling?');
    expect(document.body.textContent).toContain('preserved');
    expect(document.body.textContent).not.toMatch(/delete/i);

    // Confirm (the AlertDialog's own action <button>, not a menuitem <div>).
    clickButtonWithText('Deactivate');
    await flushMicrotasks();

    expect(onSetStudentActive).toHaveBeenCalledWith('s-active', false);

    // Row stays visible (not removed) with an updated "Deactivated" badge.
    expect(container.textContent).toContain('Ava Sterling');
    expect(container.textContent).toContain('Deactivated');
    expect(container.textContent).toContain('Student deactivated');

    // MoreMenu now offers "Reactivate" instead of "Deactivate".
    const avaMenuAfter = openMoreMenuFor('Ava Sterling');
    expect(menuItemTexts(avaMenuAfter)).toContain('Reactivate');
    expect(menuItemTexts(avaMenuAfter)).not.toContain('Deactivate');

    // Reactivate flips it back directly (no AlertDialog for a non-destructive action).
    clickMenuItem(avaMenuAfter, 'Reactivate');
    await flushMicrotasks();
    expect(onSetStudentActive).toHaveBeenCalledWith('s-active', true);
    expect(container.textContent).not.toContain('Deactivated');
    expect(container.textContent).toContain('Student reactivated');
  });

  it('rolls back the optimistic flip and shows an error banner when the real mutation rejects', async () => {
    const onSetStudentActive = vi
      .fn<SetStudentActiveFn>()
      .mockRejectedValue({ code: '42501', message: 'Permission denied.', cause: null });
    renderTab({ loadData: testLoadData, onSetStudentActive });
    await flushMicrotasks();

    clickMenuItem(openMoreMenuFor('Ava Sterling'), 'Deactivate');
    clickButtonWithText('Deactivate');
    await flushMicrotasks();

    expect(onSetStudentActive).toHaveBeenCalledWith('s-active', false);
    // Rolled back -- row is NOT shown as deactivated.
    expect(container.textContent).not.toContain('Deactivated');
    expect(container.textContent).toContain("Couldn't deactivate student");
    expect(container.textContent).toContain('Permission denied.');
  });
});

// ---------------------------------------------------------------------------
// T089: "Add student" trigger + StudentDialog create mode (module doc #13).
// ---------------------------------------------------------------------------

describe('<StudentsTab /> Add student (module doc #13)', () => {
  it('opens StudentDialog in create mode and calls the real onCreateStudent on submit', async () => {
    const createdRow: StudentRow = {
      id: 'student-new',
      profileId: null,
      displayName: 'New Kid',
      teamId: 'team-1',
      gradYear: null,
      isActive: true,
      goalHoursOverride: null,
    };
    const onCreateStudent = vi.fn<CreateStudentFn>().mockResolvedValue(createdRow);
    renderTab({ loadData: testLoadData, onCreateStudent });
    await flushMicrotasks();

    clickButton(findButtonByText('Add student') as HTMLButtonElement);
    expect(container.textContent).toContain('Add student');
    // Confirm button reads "Add student" too (BEH-07) -- distinguish via the
    // dialog's own h2 title.
    expect(hasHeadingText('Add student')).toBe(true);

    const nameInput = getFieldControl('Name') as HTMLInputElement;
    act(() => {
      setNativeInputValue(nameInput, 'New Kid');
    });
    selectOption('Team', 'Falcons');

    clickButton(findDialogButtonByText('Add student') as HTMLButtonElement);
    await flushMicrotasks();

    expect(onCreateStudent).toHaveBeenCalledTimes(1);
    expect(onCreateStudent).toHaveBeenCalledWith(
      expect.objectContaining({ displayName: 'New Kid', teamId: 'team-1' }),
    );
    // New row appears on the roster.
    expect(container.textContent).toContain('New Kid');
  });
});

// ---------------------------------------------------------------------------
// T089: Edit opens StudentDialog in edit mode, prefilled, real onUpdateStudent
// (module docs #8a/#13/#14).
// ---------------------------------------------------------------------------

describe('<StudentsTab /> Edit (module docs #8a/#13/#14)', () => {
  it('opens StudentDialog in edit mode with correct pre-filled data and calls the real onUpdateStudent', async () => {
    const updatedRow: StudentRow = {
      id: 's-active',
      profileId: 'profile-active',
      displayName: 'Ava Sterling Jr.',
      teamId: 'team-1',
      gradYear: 2027,
      isActive: true,
      goalHoursOverride: null,
    };
    const onUpdateStudent = vi.fn<UpdateStudentFn>().mockResolvedValue(updatedRow);
    renderTab({ loadData: testLoadData, onUpdateStudent });
    await flushMicrotasks();

    clickMenuItem(openMoreMenuFor('Ava Sterling'), 'Edit');

    expect(hasHeadingText('Edit student')).toBe(true);
    expect((getFieldControl('Name') as HTMLInputElement).value).toBe('Ava Sterling');
    expect((getFieldControl('Grad year') as HTMLInputElement).value).toBe('2027');
    // Already Active -- Email field is disabled (StudentDialog's own
    // computeEmailFieldDisabled: edit mode + hasAccount === true). Astryx
    // `TextInput`'s `isDisabled` surfaces as `aria-disabled`, not the native
    // `disabled` attribute -- same assertion style `StudentDialog.test.tsx`'s
    // own "already has an account" case already established.
    expect((getFieldControl('Email') as HTMLInputElement).getAttribute('aria-disabled')).toBe(
      'true',
    );

    const nameInput = getFieldControl('Name') as HTMLInputElement;
    act(() => {
      setNativeInputValue(nameInput, 'Ava Sterling Jr.');
    });

    clickButton(findButtonByText('Save changes') as HTMLButtonElement);
    await flushMicrotasks();

    expect(onUpdateStudent).toHaveBeenCalledTimes(1);
    expect(onUpdateStudent).toHaveBeenCalledWith(
      's-active',
      expect.objectContaining({ displayName: 'Ava Sterling Jr.' }),
    );
    expect(container.textContent).toContain('Ava Sterling Jr.');
  });
});

// ---------------------------------------------------------------------------
// T089 Trap #3: invite-student email source is StudentDialog's own
// `inviteEmail` field (module doc #8c/#14) -- proven end-to-end.
// ---------------------------------------------------------------------------

describe('<StudentsTab /> Trap #3 -- invite-student via the edit dialog Email field (module doc #8c/#14)', () => {
  it('submitting the edit form with an Email fires send-invite (role student) after the students write, and flips the badge to Invited', async () => {
    const updatedRow: StudentRow = {
      id: 's-no-account',
      profileId: null,
      displayName: 'Cora Vance',
      teamId: 'team-1',
      gradYear: 2028,
      isActive: true,
      goalHoursOverride: 12,
    };
    const onUpdateStudent = vi.fn<UpdateStudentFn>().mockResolvedValue(updatedRow);
    mockedInvokeEdgeFunction.mockResolvedValue({
      invite: {
        id: 'invite-new',
        email: 'cora.vance@example.com',
        role: 'student',
        student_id: 's-no-account',
        status: 'pending',
        expires_at: '2026-08-01T00:00:00.000Z',
        created_at: '2026-07-18T00:00:00.000Z',
      },
    });
    renderTab({ loadData: testLoadData, onUpdateStudent });
    await flushMicrotasks();

    clickMenuItem(openMoreMenuFor('Cora Vance'), 'Invite');
    expect(hasHeadingText('Edit student')).toBe(true);

    const emailInput = getFieldControl('Email') as HTMLInputElement;
    act(() => {
      setNativeInputValue(emailInput, 'cora.vance@example.com');
    });

    clickButton(findButtonByText('Save changes') as HTMLButtonElement);
    await flushMicrotasks();

    expect(onUpdateStudent).toHaveBeenCalledTimes(1);
    expect(mockedInvokeEdgeFunction).toHaveBeenCalledTimes(1);
    expect(mockedInvokeEdgeFunction).toHaveBeenCalledWith('send-invite', {
      email: 'cora.vance@example.com',
      role: 'student',
      student_id: 's-no-account',
    });

    // Badge now shows "Invited" for this row without a full reload.
    const coraMenu = openMoreMenuFor('Cora Vance');
    expect(menuItemTexts(coraMenu)).not.toContain('Invite'); // no longer "no_account"
    expect(container.textContent).toContain('Invited');
  });

  it('surfaces the real send-invite failure and leaves the dialog open when the invite call rejects', async () => {
    const updatedRow: StudentRow = {
      id: 's-no-account',
      profileId: null,
      displayName: 'Cora Vance',
      teamId: 'team-1',
      gradYear: 2028,
      isActive: true,
      goalHoursOverride: 12,
    };
    const onUpdateStudent = vi.fn<UpdateStudentFn>().mockResolvedValue(updatedRow);
    mockedInvokeEdgeFunction.mockRejectedValue({
      code: 'ALREADY_INVITED',
      message:
        'This person already has an account. They can sign in directly instead of using an invite.',
      cause: null,
    });
    renderTab({ loadData: testLoadData, onUpdateStudent });
    await flushMicrotasks();

    clickMenuItem(openMoreMenuFor('Cora Vance'), 'Invite');
    const emailInput = getFieldControl('Email') as HTMLInputElement;
    act(() => {
      setNativeInputValue(emailInput, 'cora.vance@example.com');
    });
    clickButton(findButtonByText('Save changes') as HTMLButtonElement);
    await flushMicrotasks();

    expect(container.textContent).toContain(
      'This person already has an account. They can sign in directly instead of using an invite.',
    );
    // Dialog is still open (StudentDialog's own onOpenChange(false) never ran).
    expect(hasHeadingText('Edit student')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// T089: Invite parent opens the real InviteParentDialog (module doc #8b/#13).
// ---------------------------------------------------------------------------

describe('<StudentsTab /> Invite parent (module doc #8b/#13)', () => {
  it('opens the real InviteParentDialog for the targeted row, not a stub banner', async () => {
    renderTab({ loadData: testLoadData });
    await flushMicrotasks();

    clickMenuItem(openMoreMenuFor('Ava Sterling'), 'Invite parent');

    expect(hasHeadingText('Invite parent')).toBe(true);
    expect(container.textContent).toContain('Inviting a parent for Ava Sterling.');
    // Real form fields, not the old disclosure banner.
    expect(container.textContent).not.toContain('dialog not built yet');
  });
});

// ---------------------------------------------------------------------------
// View history remains a disclosed stub (module doc #8d) -- correctly out of
// scope, no route exists.
// ---------------------------------------------------------------------------

describe('<StudentsTab /> View history stub (module doc #8d)', () => {
  it('shows a disclosure banner naming the missing route', async () => {
    renderTab({ loadData: testLoadData });
    await flushMicrotasks();
    clickMenuItem(openMoreMenuFor('Ava Sterling'), 'View history');
    expect(container.textContent).toContain('Student history page not built yet');
  });
});

// ---------------------------------------------------------------------------
// T089: real `loaders/students.ts` seams -- `makeLoadStudentsTabData`,
// `makeSetStudentActive`, `makeCreateStudent`, `makeUpdateStudent`. Stubbed
// `SupabaseClient` only, same DI pattern as `InvitesTab.test.tsx`/
// `src/lib/supabase/loader.test.ts` -- zero real network calls.
// ---------------------------------------------------------------------------

describe('loadStudentsTabData (T089 real load)', () => {
  it('queries students/teams/invites and maps snake_case DB rows to camelCase rows', async () => {
    const studentsOrderSpy = vi.fn().mockResolvedValue({
      data: [
        {
          id: 'student-db-1',
          profile_id: null,
          display_name: 'DB Student',
          team_id: 'team-db-1',
          grad_year: 2029,
          is_active: true,
          goal_hours_override: null,
          created_at: '2026-01-01T00:00:00.000Z',
        },
      ],
      error: null,
    });
    const teamsOrderSpy = vi.fn().mockResolvedValue({
      data: [
        {
          id: 'team-db-1',
          name: 'DB Team',
          short_name: 'DBT',
          program: 'FRC',
          color: '#000000',
          archived: false,
          sort_order: 0,
          created_at: '2026-01-01T00:00:00.000Z',
        },
      ],
      error: null,
    });
    const invitesOrderSpy = vi.fn().mockResolvedValue({
      data: [
        {
          id: 'invite-db-1',
          email: 'invite@example.com',
          role: 'student',
          student_id: 'student-db-1',
          invited_by: 'profile-staff-1',
          status: 'pending',
          expires_at: '2026-08-01T00:00:00.000Z',
          created_at: '2026-01-01T00:00:00.000Z',
        },
      ],
      error: null,
    });

    const selectSpies: Record<string, ReturnType<typeof vi.fn>> = {
      students: vi.fn(() => ({ order: studentsOrderSpy })),
      teams: vi.fn(() => ({ order: teamsOrderSpy })),
      invites: vi.fn(() => ({ order: invitesOrderSpy })),
    };
    const fromSpy = vi.fn((table: string) => ({ select: selectSpies[table] }));
    const client = { from: fromSpy } as unknown as SupabaseClient;

    const load = makeLoadStudentsTabData(() => client);
    const result = await load();

    expect(fromSpy).toHaveBeenCalledWith('students');
    expect(fromSpy).toHaveBeenCalledWith('teams');
    expect(fromSpy).toHaveBeenCalledWith('invites');

    expect(result).toEqual<StudentsTabLoadResult>({
      students: [
        {
          id: 'student-db-1',
          profileId: null,
          displayName: 'DB Student',
          teamId: 'team-db-1',
          gradYear: 2029,
          isActive: true,
          goalHoursOverride: null,
        },
      ],
      teams: [{ id: 'team-db-1', name: 'DB Team', archived: false }],
      invites: [
        {
          id: 'invite-db-1',
          email: 'invite@example.com',
          role: 'student',
          studentId: 'student-db-1',
          status: 'pending',
        },
      ],
    });
  });

  it('bridges the "no rows" case for all three tables to empty arrays, not a crash', async () => {
    const nullResult = { data: null, error: null };
    const orderSpy = vi.fn().mockResolvedValue(nullResult);
    const client = {
      from: vi.fn(() => ({ select: vi.fn(() => ({ order: orderSpy })) })),
    } as unknown as SupabaseClient;

    const load = makeLoadStudentsTabData(() => client);
    const result = await load();

    expect(result).toEqual({ students: [], teams: [], invites: [] });
  });

  it('rejects with the real SupabaseLoaderError when any one of the three queries fails', async () => {
    const okResult = { data: [], error: null };
    const failResult = { data: null, error: { message: 'permission denied', code: '42501' } };
    let callCount = 0;
    const orderSpy = vi.fn(() => {
      callCount += 1;
      // Second table (teams) fails; students/invites succeed.
      return Promise.resolve(callCount === 2 ? failResult : okResult);
    });
    const client = {
      from: vi.fn(() => ({ select: vi.fn(() => ({ order: orderSpy })) })),
    } as unknown as SupabaseClient;

    const load = makeLoadStudentsTabData(() => client);

    await expect(load()).rejects.toMatchObject({ code: '42501', message: expect.any(String) });
  });
});

describe('setStudentActive (T089 real mutation, module doc #11)', () => {
  it('calls students.update({ is_active }).eq("id", id) with exactly the targeted id', async () => {
    const eqSpy = vi.fn().mockResolvedValue({ data: null, error: null });
    const updateSpy = vi.fn(() => ({ eq: eqSpy }));
    const fromSpy = vi.fn(() => ({ update: updateSpy }));
    const client = { from: fromSpy } as unknown as SupabaseClient;

    const setActive = makeSetStudentActive(() => client);
    await setActive('student-1', false);

    expect(fromSpy).toHaveBeenCalledWith('students');
    expect(updateSpy).toHaveBeenCalledWith({ is_active: false });
    expect(eqSpy).toHaveBeenCalledWith('id', 'student-1');
  });

  it('rejects with the real SupabaseLoaderError on a genuine mutation error', async () => {
    const eqSpy = vi
      .fn()
      .mockResolvedValue({ data: null, error: { message: 'nope', code: '42501' } });
    const client = {
      from: vi.fn(() => ({ update: vi.fn(() => ({ eq: eqSpy })) })),
    } as unknown as SupabaseClient;

    const setActive = makeSetStudentActive(() => client);
    await expect(setActive('student-1', false)).rejects.toMatchObject({ code: '42501' });
  });
});

describe('createStudent / updateStudent (T089 real mutation, module doc #14)', () => {
  it('createStudent inserts exactly the editable columns and resolves the mapped freshly-written row', async () => {
    const singleSpy = vi.fn().mockResolvedValue({
      data: {
        id: 'student-new',
        profile_id: null,
        display_name: 'New Kid',
        team_id: 'team-1',
        grad_year: null,
        is_active: true,
        goal_hours_override: null,
        created_at: '2026-01-01T00:00:00.000Z',
      },
      error: null,
    });
    const selectSpy = vi.fn(() => ({ single: singleSpy }));
    const insertSpy = vi.fn(() => ({ select: selectSpy }));
    const fromSpy = vi.fn(() => ({ insert: insertSpy }));
    const client = { from: fromSpy } as unknown as SupabaseClient;

    const create = makeCreateStudent(() => client);
    const result = await create({
      displayName: 'New Kid',
      teamId: 'team-1',
      gradYear: null,
      isActive: true,
      goalHoursOverride: null,
    });

    expect(fromSpy).toHaveBeenCalledWith('students');
    expect(insertSpy).toHaveBeenCalledWith({
      display_name: 'New Kid',
      team_id: 'team-1',
      grad_year: null,
      is_active: true,
      goal_hours_override: null,
    });
    expect(result).toEqual<StudentRow>({
      id: 'student-new',
      profileId: null,
      displayName: 'New Kid',
      teamId: 'team-1',
      gradYear: null,
      isActive: true,
      goalHoursOverride: null,
    });
  });

  it('updateStudent updates by id and resolves the mapped freshly-written row', async () => {
    const singleSpy = vi.fn().mockResolvedValue({
      data: {
        id: 'student-1',
        profile_id: 'profile-1',
        display_name: 'Edited Name',
        team_id: 'team-2',
        grad_year: 2030,
        is_active: false,
        goal_hours_override: 5,
        created_at: '2026-01-01T00:00:00.000Z',
      },
      error: null,
    });
    const selectSpy = vi.fn(() => ({ single: singleSpy }));
    const eqSpy = vi.fn(() => ({ select: selectSpy }));
    const updateSpy = vi.fn(() => ({ eq: eqSpy }));
    const fromSpy = vi.fn(() => ({ update: updateSpy }));
    const client = { from: fromSpy } as unknown as SupabaseClient;

    const update = makeUpdateStudent(() => client);
    const result = await update('student-1', {
      displayName: 'Edited Name',
      teamId: 'team-2',
      gradYear: 2030,
      isActive: false,
      goalHoursOverride: 5,
    });

    expect(fromSpy).toHaveBeenCalledWith('students');
    expect(updateSpy).toHaveBeenCalledWith({
      display_name: 'Edited Name',
      team_id: 'team-2',
      grad_year: 2030,
      is_active: false,
      goal_hours_override: 5,
    });
    expect(eqSpy).toHaveBeenCalledWith('id', 'student-1');
    expect(result.displayName).toBe('Edited Name');
    expect(result.isActive).toBe(false);
  });
});
