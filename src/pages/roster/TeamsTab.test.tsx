// @vitest-environment jsdom
/**
 * T026: tests for `TeamsTab.tsx`.
 *
 * Per this task's Allowed Files ("A colocated `TeamsTab.test.tsx` is
 * acceptable per established precedent") this test file is a deliberate,
 * disclosed addition -- the same class of addition `StudentsTab.test.tsx`
 * (T022) and `StudentDialog.test.tsx` (T023) already made in this same
 * directory, existing only to produce the DOM-text proof this task's own
 * packet requires in "Required Worker Output": the Archive-vs-Hard-Delete
 * gate logic (with real block/allow boundary proof), the "no students or
 * history" derivation, the color-chip Selector, and full CRUD.
 *
 * No `@testing-library/react` is installed in this repo (confirmed via
 * `package.json`) -- these tests reuse the exact raw `createRoot`/`act`
 * harness, the `getFieldControl`/`selectOption` Selector-interaction
 * helpers (`StudentDialog.test.tsx`/T023 already established these against
 * the installed package's own `Selector.tsx` source, role="option" +
 * `Field`'s real `<label htmlFor>`), and the `MoreMenu` scoped-menu helpers
 * (`StudentsTab.test.tsx`/T022) already established in this same
 * directory's sibling test files.
 *
 * T094 (ED-1 Packet P5) additions: real load/mutation wiring
 * (`loadTeamsTabData`/`createTeam`/`updateTeam`/`setTeamArchived`/
 * `hardDeleteTeam`/`setTeamSortOrders`, `../../lib/supabase/loaders/teams`)
 * proven against stubbed `SupabaseClient`s (same DI pattern
 * `StudentsTab.test.tsx`/T089 already established); optimistic-update-plus-
 * rollback for Archive/Reorder (mirroring `StudentsTab.tsx`'s own Deactivate/
 * Reactivate); real Create/Edit/Hard-delete mutation proof, including
 * error-surfacing. Every pre-existing describe block below still passes its
 * own explicit `loadData` fixture through the component's props (per T087's
 * own precedent: "the default changes, the fixture literal doesn't"), so
 * none of them depend on which function is the component's implicit
 * default.
 */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import type { SupabaseClient } from '@supabase/supabase-js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  buildDisplayRows,
  canHardDelete,
  computeSortOrderSwap,
  moveTeamSortOrder,
  teamHasStudentsOrHistory,
  TeamsTab,
  toKnownTeamColor,
  validateTeamForm,
  withArchivedOverride,
  withCreatedTeam,
  withEditedTeam,
  withHardDelete,
  type CreateTeamFn,
  type HardDeleteTeamFn,
  type SetTeamArchivedFn,
  type SetTeamSortOrdersFn,
  type StudentTeamLinkRow,
  type TeamDisplayRow,
  type TeamRow,
  type TeamsTabLoadResult,
  type UpdateTeamFn,
} from './TeamsTab';
import {
  makeCreateTeam,
  makeHardDeleteTeam,
  makeLoadTeamsTabData,
  makeSetTeamArchived,
  makeSetTeamSortOrders,
  makeUpdateTeam,
} from '../../lib/supabase/loaders/teams';

// ---------------------------------------------------------------------------
// jsdom gap: `AlertDialog`/`Dialog` render a native `<dialog>` and call
// `HTMLDialogElement.prototype.showModal()`, which this repo's installed
// jsdom does not implement -- same guarded, test-file-local polyfill
// `StudentsTab.test.tsx`/T022 and `StudentDialog.test.tsx`/T023 already
// established.
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

function renderTab(props: Parameters<typeof TeamsTab>[0] = {}): void {
  act(() => {
    root.render(<TeamsTab {...props} />);
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

/** Astryx `Field`-backed inputs render a real `<label htmlFor>` (verified
 * against `node_modules/@astryxdesign/core/src/Field/FieldLabel.tsx`), same
 * helper `StudentDialog.test.tsx`/T023 already established. */
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

function setNativeInputValue(input: HTMLInputElement, value: string): void {
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
  setter?.call(input, value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

function fillTextField(labelText: string, value: string): void {
  const input = getFieldControl(labelText) as HTMLInputElement;
  act(() => {
    setNativeInputValue(input, value);
  });
}

/** Opens a `Selector` via its trigger and clicks the option with the given
 * visible text (Astryx `Selector` renders options with `role="option"`,
 * same helper `StudentDialog.test.tsx`/T023 already established against
 * `node_modules/@astryxdesign/core/src/Selector/Selector.tsx`). */
function selectOption(triggerLabel: string, optionText: string): void {
  const trigger = getFieldControl(triggerLabel) as HTMLButtonElement;
  act(() => {
    trigger.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
  const option = Array.from(document.querySelectorAll('[role="option"]')).find(
    (el) => el.textContent?.trim() === optionText,
  );
  expect(option, `expected a Selector option "${optionText}"`).toBeTruthy();
  act(() => {
    option?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
}

/** Scoped `MoreMenu` helper -- same jsdom finding `StudentsTab.test.tsx`/T022
 * already documented: every row's menu items render unconditionally into
 * the DOM (native popover semantics), scoped only via the trigger's
 * `aria-controls`. */
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

function menuItemElement(menu: HTMLElement, text: string): Element | undefined {
  return Array.from(menu.querySelectorAll('[role="menuitem"]')).find(
    (el) => el.textContent?.trim() === text,
  );
}

function clickMenuItem(menu: HTMLElement, text: string): void {
  const item = menuItemElement(menu, text);
  expect(item, `expected a menu item "${text}" within the scoped menu`).toBeTruthy();
  act(() => {
    item?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
}

/**
 * jsdom finding: Astryx `Dialog` (and `AlertDialog`, which wraps it) always
 * renders its native `<dialog>` element and content into the DOM tree --
 * visibility is toggled by calling `showModal()`/`close()` (this file's own
 * polyfill sets/removes the `open` attribute for those), NOT by conditional
 * mounting. With two `AlertDialog`s in this component (Archive and Hard
 * delete), `document.body.textContent` always contains BOTH dialogs' copy
 * regardless of which (if either) is actually open, so "not to contain"
 * assertions against `document.body.textContent` are unreliable here.
 * `getOpenDialogText` scopes to the one `<dialog open>` element instead.
 */
function getOpenDialogText(): string | null {
  const openDialog = document.querySelector('dialog[open]');
  return openDialog ? (openDialog.textContent ?? '') : null;
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
// Pure functions -- module docs #2/#3/#5/#6.
// ---------------------------------------------------------------------------

describe('teamHasStudentsOrHistory (module doc #3)', () => {
  const links: StudentTeamLinkRow[] = [
    { studentId: 's1', teamId: 'team-a' },
    { studentId: 's2', teamId: 'team-a' },
  ];

  it('is true when any link references the team (module doc #3)', () => {
    expect(teamHasStudentsOrHistory('team-a', links)).toBe(true);
  });

  it('is false when no link references the team', () => {
    expect(teamHasStudentsOrHistory('team-b', links)).toBe(false);
  });

  it('is false for an empty links array', () => {
    expect(teamHasStudentsOrHistory('team-a', [])).toBe(false);
  });
});

describe('canHardDelete (module doc #2 -- the hard-delete gate)', () => {
  it('is true exactly when hasStudentsOrHistory is false, the real block/allow boundary', () => {
    expect(canHardDelete({ hasStudentsOrHistory: false })).toBe(true);
    expect(canHardDelete({ hasStudentsOrHistory: true })).toBe(false);
  });
});

describe('toKnownTeamColor (module doc #5)', () => {
  it('passes through every one of the eleven known Token colors unchanged', () => {
    for (const color of [
      'default',
      'red',
      'orange',
      'yellow',
      'green',
      'teal',
      'cyan',
      'blue',
      'purple',
      'pink',
      'gray',
    ]) {
      expect(toKnownTeamColor(color)).toBe(color);
    }
  });

  it('falls back to "default" for a legacy free-text value outside the known set', () => {
    expect(toKnownTeamColor('crimson-legacy')).toBe('default');
    expect(toKnownTeamColor('')).toBe('default');
  });
});

describe('buildDisplayRows', () => {
  const teams: TeamRow[] = [
    {
      id: 't1',
      name: 'Falcons',
      shortName: 'FALC',
      program: 'FRC',
      color: 'blue',
      archived: false,
      sortOrder: 1,
    },
    {
      id: 't2',
      name: 'Hawks',
      shortName: 'HAWK',
      program: null,
      color: 'red',
      archived: true,
      sortOrder: 0,
    },
  ];

  it('joins the hasStudentsOrHistory gate per row and sorts by sortOrder', () => {
    const links: StudentTeamLinkRow[] = [{ studentId: 's1', teamId: 't1' }];
    const rows = buildDisplayRows(teams, links);
    expect(rows.map((row) => row.id)).toEqual(['t2', 't1']); // sortOrder 0 before 1
    expect(rows.find((row) => row.id === 't1')?.hasStudentsOrHistory).toBe(true);
    expect(rows.find((row) => row.id === 't2')?.hasStudentsOrHistory).toBe(false);
  });
});

describe('withArchivedOverride (module doc #2 -- reversible flip, never a delete)', () => {
  it('flips only the targeted row in either direction and keeps every row present', () => {
    const rows = buildDisplayRows(
      [
        {
          id: 't1',
          name: 'Row One',
          shortName: 'R1',
          program: 'FRC',
          color: 'blue',
          archived: false,
          sortOrder: 0,
        },
        {
          id: 't2',
          name: 'Row Two',
          shortName: 'R2',
          program: 'FTC',
          color: 'red',
          archived: false,
          sortOrder: 1,
        },
      ],
      [],
    );
    const archived = withArchivedOverride(rows, 't1', true);
    expect(archived).toHaveLength(2);
    expect(archived.find((r) => r.id === 't1')?.archived).toBe(true);
    expect(archived.find((r) => r.id === 't2')?.archived).toBe(false);

    const unarchived = withArchivedOverride(archived, 't1', false);
    expect(unarchived.find((r) => r.id === 't1')?.archived).toBe(false);
  });
});

describe('withHardDelete (module doc #2 -- the ONLY place a row is removed)', () => {
  it('removes exactly the targeted row', () => {
    const rows: TeamDisplayRow[] = [
      {
        id: 't1',
        name: 'Row One',
        shortName: 'R1',
        program: 'FRC',
        color: 'blue',
        archived: false,
        sortOrder: 0,
        hasStudentsOrHistory: false,
      },
      {
        id: 't2',
        name: 'Row Two',
        shortName: 'R2',
        program: 'FTC',
        color: 'red',
        archived: false,
        sortOrder: 1,
        hasStudentsOrHistory: false,
      },
    ];
    const result = withHardDelete(rows, 't1');
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('t2');
  });
});

describe('moveTeamSortOrder (module doc #6)', () => {
  const rows: TeamDisplayRow[] = [
    {
      id: 't1',
      name: 'First',
      shortName: 'F',
      program: null,
      color: 'blue',
      archived: false,
      sortOrder: 0,
      hasStudentsOrHistory: false,
    },
    {
      id: 't2',
      name: 'Second',
      shortName: 'S',
      program: null,
      color: 'red',
      archived: false,
      sortOrder: 1,
      hasStudentsOrHistory: false,
    },
    {
      id: 't3',
      name: 'Third',
      shortName: 'T',
      program: null,
      color: 'green',
      archived: false,
      sortOrder: 2,
      hasStudentsOrHistory: false,
    },
  ];

  it('swaps sortOrder VALUES with the neighbor and re-sorts', () => {
    const moved = moveTeamSortOrder(rows, 't2', 'up');
    expect(moved.map((r) => r.id)).toEqual(['t2', 't1', 't3']);
    expect(moved.find((r) => r.id === 't2')?.sortOrder).toBe(0);
    expect(moved.find((r) => r.id === 't1')?.sortOrder).toBe(1);
  });

  it('is a no-op at the top boundary (moving the first row up)', () => {
    const moved = moveTeamSortOrder(rows, 't1', 'up');
    expect(moved.map((r) => r.id)).toEqual(['t1', 't2', 't3']);
  });

  it('is a no-op at the bottom boundary (moving the last row down)', () => {
    const moved = moveTeamSortOrder(rows, 't3', 'down');
    expect(moved.map((r) => r.id)).toEqual(['t1', 't2', 't3']);
  });
});

describe('computeSortOrderSwap (T094, Trap #2 -- the real persistence pair)', () => {
  const rows: TeamDisplayRow[] = [
    {
      id: 't1',
      name: 'First',
      shortName: 'F',
      program: null,
      color: 'blue',
      archived: false,
      sortOrder: 0,
      hasStudentsOrHistory: false,
    },
    {
      id: 't2',
      name: 'Second',
      shortName: 'S',
      program: null,
      color: 'red',
      archived: false,
      sortOrder: 1,
      hasStudentsOrHistory: false,
    },
  ];

  it('returns the exact two {id, sortOrder} pairs a move would swap', () => {
    expect(computeSortOrderSwap(rows, 't2', 'up')).toEqual([
      { id: 't2', sortOrder: 0 },
      { id: 't1', sortOrder: 1 },
    ]);
  });

  it('returns null at either boundary -- never a partial/one-sided result', () => {
    expect(computeSortOrderSwap(rows, 't1', 'up')).toBeNull();
    expect(computeSortOrderSwap(rows, 't2', 'down')).toBeNull();
  });
});

describe('withCreatedTeam / withEditedTeam / validateTeamForm (full CRUD)', () => {
  const rows: TeamDisplayRow[] = [
    {
      id: 't1',
      name: 'Falcons',
      shortName: 'FALC',
      program: 'FRC',
      color: 'blue',
      archived: false,
      sortOrder: 0,
      hasStudentsOrHistory: false,
    },
  ];

  it('withCreatedTeam appends the real, freshly-inserted row (T094), not archived, no history', () => {
    const created = withCreatedTeam(rows, {
      id: 'team-new-hawks',
      name: 'Hawks',
      shortName: 'HAWK',
      program: 'FTC',
      color: 'green',
      archived: false,
      sortOrder: 1,
    });
    expect(created).toHaveLength(2);
    const newRow = created.find((r) => r.id === 'team-new-hawks');
    expect(newRow).toMatchObject({
      name: 'Hawks',
      sortOrder: 1,
      archived: false,
      hasStudentsOrHistory: false,
    });
  });

  it('withEditedTeam (T094) merges the real, freshly-updated row, preserving hasStudentsOrHistory', () => {
    const edited = withEditedTeam(rows, {
      id: 't1',
      name: 'Falcons Renamed',
      shortName: 'FALC2',
      program: 'Other',
      color: 'pink',
      archived: false,
      sortOrder: 0,
    });
    expect(edited[0]).toMatchObject({
      id: 't1',
      name: 'Falcons Renamed',
      shortName: 'FALC2',
      program: 'Other',
      color: 'pink',
      archived: false,
      sortOrder: 0,
      hasStudentsOrHistory: false,
    });
  });

  it('validateTeamForm requires name/shortName/color', () => {
    const errors = validateTeamForm(
      { name: '  ', shortName: '', program: null, color: '' },
      rows,
      null,
    );
    expect(errors.name).toBeTruthy();
    expect(errors.shortName).toBeTruthy();
    expect(errors.color).toBeTruthy();
  });

  it('validateTeamForm rejects a duplicate name (case-insensitive), but not against itself when editing', () => {
    const dupe = validateTeamForm(
      { name: 'falcons', shortName: 'X', program: null, color: 'blue' },
      rows,
      null,
    );
    expect(dupe.name).toBeTruthy();

    const editingSelf = validateTeamForm(
      { name: 'Falcons', shortName: 'FALC', program: 'FRC', color: 'blue' },
      rows,
      't1',
    );
    expect(editingSelf.name).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Fixture data for render tests -- deliberately covers the full
// block/allow hard-delete boundary (module doc #3 in TeamsTab.tsx).
// ---------------------------------------------------------------------------

const TEST_TEAMS: TeamRow[] = [
  {
    id: 'team-blocked',
    name: 'Blocked Bears',
    shortName: 'BEAR',
    program: 'FRC',
    color: 'blue',
    archived: false,
    sortOrder: 0,
  },
  {
    id: 'team-allowed',
    name: 'Allowed Antelopes',
    shortName: 'ANTE',
    program: null,
    color: 'crimson-legacy',
    archived: false,
    sortOrder: 1,
  },
];

const TEST_LINKS: StudentTeamLinkRow[] = [{ studentId: 'student-1', teamId: 'team-blocked' }];

function testLoadData(): Promise<TeamsTabLoadResult> {
  return Promise.resolve({ teams: TEST_TEAMS, studentTeamLinks: TEST_LINKS });
}

// ---------------------------------------------------------------------------
// DES-12 four states + populated render proof.
// ---------------------------------------------------------------------------

describe('<TeamsTab /> DES-12 states', () => {
  it('shows a loading Skeleton (T081: table has predictable dimensions) before data resolves', () => {
    renderTab({ loadData: () => new Promise(() => {}) });
    expect(container.textContent).toContain('Loading teams');
  });

  it('shows an error banner when loadData rejects', async () => {
    renderTab({ loadData: () => Promise.reject(new Error('boom')) });
    await flushMicrotasks();
    expect(container.textContent).toContain("Couldn't load teams");
  });

  it('shows an empty state when there are no teams at all', async () => {
    renderTab({ loadData: () => Promise.resolve({ teams: [], studentTeamLinks: [] }) });
    await flushMicrotasks();
    expect(container.textContent).toContain('No teams yet');
  });

  it('renders team rows with program badge, unrecognized-color fallback, and history status', async () => {
    renderTab({ loadData: testLoadData });
    await flushMicrotasks();

    expect(container.textContent).toContain('Blocked Bears');
    expect(container.textContent).toContain('Allowed Antelopes');
    expect(container.textContent).toContain('FRC');
    expect(container.textContent).toContain('No program set');
    // The unrecognized "crimson-legacy" color falls back to the "Default (gray)" swatch label.
    expect(container.textContent).toContain('Default (gray)');
    expect(container.textContent).toContain('Has students or history');
    expect(container.textContent).toContain('None');
  });
});

// ---------------------------------------------------------------------------
// Archive vs. Hard delete -- the core proof this task's packet requires.
// ---------------------------------------------------------------------------

describe('<TeamsTab /> Hard delete gate (module docs #2/#3 -- the real block/allow boundary)', () => {
  it('disables "Hard delete" for a team with students/history, and it does not open a confirm dialog', async () => {
    renderTab({ loadData: testLoadData });
    await flushMicrotasks();

    const menu = openMoreMenuFor('Blocked Bears');
    const texts = menuItemTexts(menu);
    expect(texts.some((t) => t.startsWith('Hard delete'))).toBe(true);
    expect(texts).not.toContain('Hard delete');

    const item = menuItemElement(menu, texts.find((t) => t.startsWith('Hard delete')) ?? '');
    expect(item?.getAttribute('aria-disabled')).toBe('true');

    act(() => {
      item?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    // No AlertDialog opened, and the row is still present -- disabled items
    // never fire their onClick (verified against the installed package's
    // own DropdownMenuItem implementation).
    expect(getOpenDialogText()).toBeNull();
    expect(container.textContent).toContain('Blocked Bears');
  });

  it('allows "Hard delete" for a team with no students/history, calls the real mutation, confirms via an unambiguous AlertDialog, and removes the row', async () => {
    const onHardDeleteTeam = vi.fn<HardDeleteTeamFn>().mockResolvedValue(undefined);
    renderTab({ loadData: testLoadData, onHardDeleteTeam });
    await flushMicrotasks();

    const menu = openMoreMenuFor('Allowed Antelopes');
    expect(menuItemTexts(menu)).toContain('Hard delete');
    clickMenuItem(menu, 'Hard delete');

    // Real AlertDialog, unambiguously irreversible copy -- distinct from Archive's.
    const openDialogText = getOpenDialogText();
    expect(openDialogText).toContain('Permanently delete Allowed Antelopes?');
    expect(openDialogText).toContain('cannot be undone');

    clickButtonWithText('Delete permanently');
    await flushMicrotasks();

    expect(onHardDeleteTeam).toHaveBeenCalledWith('team-allowed');
    // The success Banner legitimately mentions the deleted team's name
    // ("Allowed Antelopes was permanently deleted."), so the row-removal
    // proof is scoped to the Table's own cells, not the whole page's text.
    const cells = Array.from(container.querySelectorAll('td, [role="cell"]'))
      .map((el) => el.textContent ?? '')
      .join('|');
    expect(cells).not.toContain('Allowed Antelopes');
    expect(cells).toContain('Blocked Bears');
    expect(container.textContent).toContain('Team deleted');
  });

  it('T094: keeps the row visible and shows an error banner when the real hard-delete mutation rejects', async () => {
    const onHardDeleteTeam = vi
      .fn<HardDeleteTeamFn>()
      .mockRejectedValue({ code: '23503', message: 'Still referenced.', cause: null });
    renderTab({ loadData: testLoadData, onHardDeleteTeam });
    await flushMicrotasks();

    clickMenuItem(openMoreMenuFor('Allowed Antelopes'), 'Hard delete');
    clickButtonWithText('Delete permanently');
    await flushMicrotasks();

    expect(onHardDeleteTeam).toHaveBeenCalledWith('team-allowed');
    // NOT removed -- no optimistic removal for hard delete (T094 module doc).
    expect(container.textContent).toContain('Allowed Antelopes');
    expect(container.textContent).toContain("Couldn't delete team");
    expect(container.textContent).toContain('Still referenced.');
  });
});

describe('<TeamsTab /> Archive / Unarchive (reversible, distinct copy from Hard delete)', () => {
  it('opens a real AlertDialog with reversible-sounding copy, confirms, calls the real mutation, flips archived, keeps the row visible', async () => {
    const onSetTeamArchived = vi.fn<SetTeamArchivedFn>().mockResolvedValue(undefined);
    renderTab({ loadData: testLoadData, onSetTeamArchived });
    await flushMicrotasks();

    const menu = openMoreMenuFor('Blocked Bears');
    clickMenuItem(menu, 'Archive');

    const openDialogText = getOpenDialogText();
    expect(openDialogText).toContain('Archive Blocked Bears?');
    expect(openDialogText).toContain('preserved');
    expect(openDialogText).not.toMatch(/cannot be undone/i);

    clickButtonWithText('Archive');
    await flushMicrotasks();

    expect(onSetTeamArchived).toHaveBeenCalledWith('team-blocked', true);
    expect(container.textContent).toContain('Blocked Bears');
    expect(container.textContent).toContain('Archived');
    expect(container.textContent).toContain('Team archived');

    const menuAfter = openMoreMenuFor('Blocked Bears');
    expect(menuItemTexts(menuAfter)).toContain('Unarchive');
    expect(menuItemTexts(menuAfter)).not.toContain('Archive');

    // Unarchive flips it back directly -- no AlertDialog for a non-destructive action.
    clickMenuItem(menuAfter, 'Unarchive');
    await flushMicrotasks();
    expect(onSetTeamArchived).toHaveBeenCalledWith('team-blocked', false);
    expect(container.textContent).toContain('Blocked Bears');
    const menuFinal = openMoreMenuFor('Blocked Bears');
    expect(menuItemTexts(menuFinal)).toContain('Archive');
  });

  it('T094: rolls back the optimistic archive flip and shows an error banner when the real mutation rejects', async () => {
    const onSetTeamArchived = vi
      .fn<SetTeamArchivedFn>()
      .mockRejectedValue({ code: '42501', message: 'Permission denied.', cause: null });
    renderTab({ loadData: testLoadData, onSetTeamArchived });
    await flushMicrotasks();

    clickMenuItem(openMoreMenuFor('Blocked Bears'), 'Archive');
    clickButtonWithText('Archive');
    await flushMicrotasks();

    expect(onSetTeamArchived).toHaveBeenCalledWith('team-blocked', true);
    // Rolled back -- not shown as archived.
    expect(container.textContent).not.toContain('Archived');
    expect(container.textContent).toContain("Couldn't archive team");
    expect(container.textContent).toContain('Permission denied.');
  });
});

// ---------------------------------------------------------------------------
// Full CRUD via the real dialog form.
// ---------------------------------------------------------------------------

describe('<TeamsTab /> Create team', () => {
  it('creates a new team through the form dialog, calls the real onCreateTeam with the next sortOrder, and shows the real DB-returned row', async () => {
    const createdRow: TeamRow = {
      id: 'team-new-condors',
      name: 'Condors',
      shortName: 'CNDR',
      program: 'FTC',
      color: 'purple',
      archived: false,
      sortOrder: 2,
    };
    const onCreateTeam = vi.fn<CreateTeamFn>().mockResolvedValue(createdRow);
    renderTab({ loadData: testLoadData, onCreateTeam });
    await flushMicrotasks();

    clickButtonWithText('New team');
    expect(document.body.textContent).toContain('New team');

    fillTextField('Name', 'Condors');
    fillTextField('Short name', 'CNDR');
    selectOption('Program', 'FTC');
    selectOption('Color', 'Purple');

    clickButtonWithText('Save');
    await flushMicrotasks();

    expect(onCreateTeam).toHaveBeenCalledTimes(1);
    expect(onCreateTeam).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Condors',
        shortName: 'CNDR',
        program: 'FTC',
        color: 'purple',
      }),
      2, // next sortOrder after the two TEST_TEAMS rows (sortOrder 0/1).
    );
    expect(container.textContent).toContain('Condors');
    expect(container.textContent).toContain('CNDR');
    expect(container.textContent).toContain('FTC');
    expect(container.textContent).toContain('Team created');
  });

  it('shows a validation error and keeps the dialog open when name is blank, without calling onCreateTeam', async () => {
    const onCreateTeam = vi.fn<CreateTeamFn>();
    renderTab({ loadData: testLoadData, onCreateTeam });
    await flushMicrotasks();

    clickButtonWithText('New team');
    fillTextField('Short name', 'X');
    clickButtonWithText('Save');
    await flushMicrotasks();

    expect(document.body.textContent).toContain('Name is required');
    // Dialog is still open (title still present).
    expect(document.body.textContent).toContain('New team');
    expect(onCreateTeam).not.toHaveBeenCalled();
  });

  it('T094: keeps the dialog open and shows an error banner when the real onCreateTeam mutation rejects', async () => {
    const onCreateTeam = vi.fn<CreateTeamFn>().mockRejectedValue({
      code: '23505',
      message: 'A team with this name already exists.',
      cause: null,
    });
    renderTab({ loadData: testLoadData, onCreateTeam });
    await flushMicrotasks();

    clickButtonWithText('New team');
    fillTextField('Name', 'Condors');
    fillTextField('Short name', 'CNDR');
    clickButtonWithText('Save');
    await flushMicrotasks();

    expect(document.body.textContent).toContain('New team'); // dialog still open.
    expect(container.textContent).toContain("Couldn't create team");
    expect(container.textContent).toContain('A team with this name already exists.');
  });
});

describe('<TeamsTab /> Edit team', () => {
  it('edits an existing team through the same form dialog, pre-filled with its current values, calls the real onUpdateTeam', async () => {
    const updatedRow: TeamRow = {
      id: 'team-blocked',
      name: 'Renamed Bears',
      shortName: 'BEAR',
      program: 'FRC',
      color: 'blue',
      archived: false,
      sortOrder: 0,
    };
    const onUpdateTeam = vi.fn<UpdateTeamFn>().mockResolvedValue(updatedRow);
    renderTab({ loadData: testLoadData, onUpdateTeam });
    await flushMicrotasks();

    const menu = openMoreMenuFor('Blocked Bears');
    clickMenuItem(menu, 'Edit');

    expect(document.body.textContent).toContain('Edit team');
    const nameInput = getFieldControl('Name') as HTMLInputElement;
    expect(nameInput.value).toBe('Blocked Bears');

    fillTextField('Name', 'Renamed Bears');
    clickButtonWithText('Save');
    await flushMicrotasks();

    expect(onUpdateTeam).toHaveBeenCalledWith(
      'team-blocked',
      expect.objectContaining({ name: 'Renamed Bears' }),
    );
    expect(container.textContent).toContain('Renamed Bears');
    expect(container.textContent).not.toContain('Blocked Bears');
    // The row that had students/history still shows it after the edit
    // (hasStudentsOrHistory is preserved locally, not recomputed).
    expect(container.textContent).toContain('Has students or history');
  });
});

// ---------------------------------------------------------------------------
// Sort order reorder mechanism (module doc #6).
// ---------------------------------------------------------------------------

describe('<TeamsTab /> Sort order up/down (T094: real, persisted reorder, Trap #2)', () => {
  it('moves a row up via its IconButton, calls the real onSetTeamSortOrders with the swapped pair, and reflects the new order in the table', async () => {
    const onSetTeamSortOrders = vi.fn<SetTeamSortOrdersFn>().mockResolvedValue(undefined);
    renderTab({ loadData: testLoadData, onSetTeamSortOrders });
    await flushMicrotasks();

    const moveUpButtons = Array.from(
      document.querySelectorAll('button[aria-label^="Move"][aria-label$="up"]'),
    );
    const antelopesUp = moveUpButtons.find((btn) =>
      btn.getAttribute('aria-label')?.includes('Allowed Antelopes'),
    );
    expect(antelopesUp).toBeTruthy();
    expect(antelopesUp?.hasAttribute('disabled')).toBe(false);

    act(() => {
      antelopesUp?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    await flushMicrotasks();

    // The real mutation is called with exactly the swapped {id, sortOrder} pair.
    expect(onSetTeamSortOrders).toHaveBeenCalledWith([
      { id: 'team-allowed', sortOrder: 0 },
      { id: 'team-blocked', sortOrder: 1 },
    ]);

    // Row order in the table body now has Allowed Antelopes before Blocked Bears.
    const cells = Array.from(container.querySelectorAll('td, [role="cell"]'))
      .map((el) => el.textContent ?? '')
      .join('|');
    const antelopesIndex = cells.indexOf('Allowed Antelopes');
    const bearsIndex = cells.indexOf('Blocked Bears');
    expect(antelopesIndex).toBeGreaterThanOrEqual(0);
    expect(bearsIndex).toBeGreaterThanOrEqual(0);
    expect(antelopesIndex).toBeLessThan(bearsIndex);
  });

  it('rolls back the optimistic reorder and shows an error banner when the real mutation rejects', async () => {
    const onSetTeamSortOrders = vi
      .fn<SetTeamSortOrdersFn>()
      .mockRejectedValue({ code: '42501', message: 'Permission denied.', cause: null });
    renderTab({ loadData: testLoadData, onSetTeamSortOrders });
    await flushMicrotasks();

    const antelopesUp = Array.from(
      document.querySelectorAll('button[aria-label^="Move"][aria-label$="up"]'),
    ).find((btn) => btn.getAttribute('aria-label')?.includes('Allowed Antelopes'));
    act(() => {
      antelopesUp?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    await flushMicrotasks();

    // Rolled back -- original order restored (Blocked Bears still first).
    const cells = Array.from(container.querySelectorAll('td, [role="cell"]'))
      .map((el) => el.textContent ?? '')
      .join('|');
    expect(cells.indexOf('Blocked Bears')).toBeLessThan(cells.indexOf('Allowed Antelopes'));
    expect(container.textContent).toContain("Couldn't reorder teams");
    expect(container.textContent).toContain('Permission denied.');
  });

  it('is a no-op (never calls the real mutation) at the top boundary', async () => {
    const onSetTeamSortOrders = vi.fn<SetTeamSortOrdersFn>();
    renderTab({ loadData: testLoadData, onSetTeamSortOrders });
    await flushMicrotasks();

    const bearsUp = Array.from(
      document.querySelectorAll('button[aria-label^="Move"][aria-label$="up"]'),
    ).find((btn) => btn.getAttribute('aria-label')?.includes('Blocked Bears'));
    expect(bearsUp?.hasAttribute('disabled')).toBe(true);
    expect(onSetTeamSortOrders).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// T094: real `loaders/teams.ts` seams -- `makeLoadTeamsTabData`,
// `makeCreateTeam`, `makeUpdateTeam`, `makeSetTeamArchived`,
// `makeHardDeleteTeam`, `makeSetTeamSortOrders`. Stubbed `SupabaseClient`
// only, same DI pattern as `StudentsTab.test.tsx`/T089 -- zero real network
// calls.
// ---------------------------------------------------------------------------

describe('loadTeamsTabData (T094 real load)', () => {
  it('queries teams/students and maps snake_case DB rows to camelCase rows, with no is_active filter on students (Trap #1)', async () => {
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
    const studentsSelectSpy = vi.fn().mockResolvedValue({
      data: [{ id: 'student-db-1', team_id: 'team-db-1' }],
      error: null,
    });

    const fromSpy = vi.fn((table: string) => {
      if (table === 'teams') {
        return { select: vi.fn(() => ({ order: teamsOrderSpy })) };
      }
      return { select: studentsSelectSpy };
    });
    const client = { from: fromSpy } as unknown as SupabaseClient;

    const load = makeLoadTeamsTabData(() => client);
    const result = await load();

    expect(fromSpy).toHaveBeenCalledWith('teams');
    expect(fromSpy).toHaveBeenCalledWith('students');
    // Trap #1: no `.eq('is_active', ...)` anywhere in the students query --
    // `studentsSelectSpy` is called with a plain column-list string, never
    // chained through an `.eq(...)` before resolving.
    expect(studentsSelectSpy).toHaveBeenCalledWith('id, team_id');

    expect(result).toEqual<TeamsTabLoadResult>({
      teams: [
        {
          id: 'team-db-1',
          name: 'DB Team',
          shortName: 'DBT',
          program: 'FRC',
          color: '#000000',
          archived: false,
          sortOrder: 0,
        },
      ],
      studentTeamLinks: [{ studentId: 'student-db-1', teamId: 'team-db-1' }],
    });
  });

  it('bridges the "no rows" case for both tables to empty arrays, not a crash', async () => {
    const nullResult = { data: null, error: null };
    // `teams` query chains `.select().order(...)`; `students` query is a bare
    // `.select(...)` (real implementations, `queryTeams`/`queryStudentTeamLinks`
    // above) -- the stub below serves both shapes.
    const client = {
      from: vi.fn((table: string) => {
        if (table === 'teams') {
          return { select: vi.fn(() => ({ order: vi.fn().mockResolvedValue(nullResult) })) };
        }
        return { select: vi.fn().mockResolvedValue(nullResult) };
      }),
    } as unknown as SupabaseClient;

    const load = makeLoadTeamsTabData(() => client);
    const result = await load();

    expect(result).toEqual({ teams: [], studentTeamLinks: [] });
  });

  it('rejects with the real SupabaseLoaderError when either query fails', async () => {
    const failResult = { data: null, error: { message: 'permission denied', code: '42501' } };
    const client = {
      from: vi.fn((table: string) => {
        if (table === 'teams') {
          return { select: vi.fn(() => ({ order: vi.fn().mockResolvedValue(failResult) })) };
        }
        return { select: vi.fn().mockResolvedValue({ data: [], error: null }) };
      }),
    } as unknown as SupabaseClient;

    const load = makeLoadTeamsTabData(() => client);
    await expect(load()).rejects.toMatchObject({ code: '42501', message: expect.any(String) });
  });
});

describe('createTeam / updateTeam (T094 real mutation)', () => {
  it('createTeam inserts exactly the editable columns plus sortOrder and resolves the mapped freshly-written row', async () => {
    const singleSpy = vi.fn().mockResolvedValue({
      data: {
        id: 'team-new',
        name: 'Condors',
        short_name: 'CNDR',
        program: 'FTC',
        color: 'purple',
        archived: false,
        sort_order: 2,
        created_at: '2026-01-01T00:00:00.000Z',
      },
      error: null,
    });
    const selectSpy = vi.fn(() => ({ single: singleSpy }));
    const insertSpy = vi.fn(() => ({ select: selectSpy }));
    const fromSpy = vi.fn(() => ({ insert: insertSpy }));
    const client = { from: fromSpy } as unknown as SupabaseClient;

    const create = makeCreateTeam(() => client);
    const result = await create(
      { name: 'Condors', shortName: 'CNDR', program: 'FTC', color: 'purple' },
      2,
    );

    expect(fromSpy).toHaveBeenCalledWith('teams');
    expect(insertSpy).toHaveBeenCalledWith({
      name: 'Condors',
      short_name: 'CNDR',
      program: 'FTC',
      color: 'purple',
      sort_order: 2,
    });
    expect(result).toEqual<TeamRow>({
      id: 'team-new',
      name: 'Condors',
      shortName: 'CNDR',
      program: 'FTC',
      color: 'purple',
      archived: false,
      sortOrder: 2,
    });
  });

  it('updateTeam updates by id (never archived/sort_order/id) and resolves the mapped freshly-written row', async () => {
    const singleSpy = vi.fn().mockResolvedValue({
      data: {
        id: 'team-1',
        name: 'Renamed',
        short_name: 'REN',
        program: null,
        color: 'gray',
        archived: false,
        sort_order: 0,
        created_at: '2026-01-01T00:00:00.000Z',
      },
      error: null,
    });
    const selectSpy = vi.fn(() => ({ single: singleSpy }));
    const eqSpy = vi.fn(() => ({ select: selectSpy }));
    const updateSpy = vi.fn(() => ({ eq: eqSpy }));
    const fromSpy = vi.fn(() => ({ update: updateSpy }));
    const client = { from: fromSpy } as unknown as SupabaseClient;

    const update = makeUpdateTeam(() => client);
    const result = await update('team-1', {
      name: 'Renamed',
      shortName: 'REN',
      program: null,
      color: 'gray',
    });

    expect(fromSpy).toHaveBeenCalledWith('teams');
    expect(updateSpy).toHaveBeenCalledWith({
      name: 'Renamed',
      short_name: 'REN',
      program: null,
      color: 'gray',
    });
    expect(eqSpy).toHaveBeenCalledWith('id', 'team-1');
    expect(result.name).toBe('Renamed');
  });
});

describe('setTeamArchived (T094 real mutation)', () => {
  it('calls teams.update({ archived }).eq("id", id) with exactly the targeted id', async () => {
    const eqSpy = vi.fn().mockResolvedValue({ data: null, error: null });
    const updateSpy = vi.fn(() => ({ eq: eqSpy }));
    const fromSpy = vi.fn(() => ({ update: updateSpy }));
    const client = { from: fromSpy } as unknown as SupabaseClient;

    const setArchived = makeSetTeamArchived(() => client);
    await setArchived('team-1', true);

    expect(fromSpy).toHaveBeenCalledWith('teams');
    expect(updateSpy).toHaveBeenCalledWith({ archived: true });
    expect(eqSpy).toHaveBeenCalledWith('id', 'team-1');
  });

  it('rejects with the real SupabaseLoaderError on a genuine mutation error', async () => {
    const eqSpy = vi
      .fn()
      .mockResolvedValue({ data: null, error: { message: 'nope', code: '42501' } });
    const client = {
      from: vi.fn(() => ({ update: vi.fn(() => ({ eq: eqSpy })) })),
    } as unknown as SupabaseClient;

    const setArchived = makeSetTeamArchived(() => client);
    await expect(setArchived('team-1', true)).rejects.toMatchObject({ code: '42501' });
  });
});

describe('hardDeleteTeam (T094 real mutation)', () => {
  it('calls teams.delete().eq("id", id) with exactly the targeted id', async () => {
    const eqSpy = vi.fn().mockResolvedValue({ data: null, error: null });
    const deleteSpy = vi.fn(() => ({ eq: eqSpy }));
    const fromSpy = vi.fn(() => ({ delete: deleteSpy }));
    const client = { from: fromSpy } as unknown as SupabaseClient;

    const hardDelete = makeHardDeleteTeam(() => client);
    await hardDelete('team-1');

    expect(fromSpy).toHaveBeenCalledWith('teams');
    expect(eqSpy).toHaveBeenCalledWith('id', 'team-1');
  });

  it('rejects with the real SupabaseLoaderError when the FK restrict genuinely rejects the delete', async () => {
    const eqSpy = vi
      .fn()
      .mockResolvedValue({ data: null, error: { message: 'FK violation', code: '23503' } });
    const client = {
      from: vi.fn(() => ({ delete: vi.fn(() => ({ eq: eqSpy })) })),
    } as unknown as SupabaseClient;

    const hardDelete = makeHardDeleteTeam(() => client);
    await expect(hardDelete('team-1')).rejects.toMatchObject({ code: '23503' });
  });
});

describe('setTeamSortOrders (T094 real mutation, Trap #2)', () => {
  it('issues one teams.update({ sort_order }).eq("id", id) call per pair, via Promise.all', async () => {
    const eqSpy = vi.fn().mockResolvedValue({ data: null, error: null });
    const updateSpy = vi.fn(() => ({ eq: eqSpy }));
    const fromSpy = vi.fn(() => ({ update: updateSpy }));
    const client = { from: fromSpy } as unknown as SupabaseClient;

    const setSortOrders = makeSetTeamSortOrders(() => client);
    await setSortOrders([
      { id: 't1', sortOrder: 1 },
      { id: 't2', sortOrder: 0 },
    ]);

    expect(updateSpy).toHaveBeenCalledWith({ sort_order: 1 });
    expect(updateSpy).toHaveBeenCalledWith({ sort_order: 0 });
    expect(eqSpy).toHaveBeenCalledWith('id', 't1');
    expect(eqSpy).toHaveBeenCalledWith('id', 't2');
  });

  it('rejects with the real SupabaseLoaderError when one of the two updates fails', async () => {
    let callCount = 0;
    const eqSpy = vi.fn(() => {
      callCount += 1;
      return Promise.resolve(
        callCount === 1
          ? { data: null, error: null }
          : { data: null, error: { message: 'nope', code: '42501' } },
      );
    });
    const client = {
      from: vi.fn(() => ({ update: vi.fn(() => ({ eq: eqSpy })) })),
    } as unknown as SupabaseClient;

    const setSortOrders = makeSetTeamSortOrders(() => client);
    await expect(
      setSortOrders([
        { id: 't1', sortOrder: 1 },
        { id: 't2', sortOrder: 0 },
      ]),
    ).rejects.toMatchObject({ code: '42501' });
  });
});
