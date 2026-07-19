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
 */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  buildDisplayRows,
  canHardDelete,
  moveTeamSortOrder,
  teamHasStudentsOrHistory,
  TeamsTab,
  toKnownTeamColor,
  validateTeamForm,
  withArchivedOverride,
  withCreatedTeam,
  withEditedTeam,
  withHardDelete,
  type StudentTeamLinkRow,
  type TeamDisplayRow,
  type TeamRow,
  type TeamsTabLoadResult,
} from './TeamsTab';

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

  it('withCreatedTeam appends a new row at the next sortOrder, not archived, no history', () => {
    const created = withCreatedTeam(
      rows,
      { name: 'Hawks', shortName: 'HAWK', program: 'FTC', color: 'green' },
      'team-new-hawks',
    );
    expect(created).toHaveLength(2);
    const newRow = created.find((r) => r.id === 'team-new-hawks');
    expect(newRow).toMatchObject({
      name: 'Hawks',
      sortOrder: 1,
      archived: false,
      hasStudentsOrHistory: false,
    });
  });

  it('withEditedTeam updates only the targeted row, preserving id/archived/sortOrder/history', () => {
    const edited = withEditedTeam(rows, 't1', {
      name: 'Falcons Renamed',
      shortName: 'FALC2',
      program: 'Other',
      color: 'pink',
    });
    expect(edited[0]).toMatchObject({
      id: 't1',
      name: 'Falcons Renamed',
      shortName: 'FALC2',
      program: 'Other',
      color: 'pink',
      archived: false,
      sortOrder: 0,
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
  it('shows a loading spinner before data resolves', () => {
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

  it('allows "Hard delete" for a team with no students/history, confirms via an unambiguous AlertDialog, and removes the row', async () => {
    renderTab({ loadData: testLoadData });
    await flushMicrotasks();

    const menu = openMoreMenuFor('Allowed Antelopes');
    expect(menuItemTexts(menu)).toContain('Hard delete');
    clickMenuItem(menu, 'Hard delete');

    // Real AlertDialog, unambiguously irreversible copy -- distinct from Archive's.
    const openDialogText = getOpenDialogText();
    expect(openDialogText).toContain('Permanently delete Allowed Antelopes?');
    expect(openDialogText).toContain('cannot be undone');

    clickButtonWithText('Delete permanently');

    expect(container.textContent).not.toContain('Allowed Antelopes');
    expect(container.textContent).toContain('Blocked Bears');
  });
});

describe('<TeamsTab /> Archive / Unarchive (reversible, distinct copy from Hard delete)', () => {
  it('opens a real AlertDialog with reversible-sounding copy, confirms, flips archived, keeps the row visible', async () => {
    renderTab({ loadData: testLoadData });
    await flushMicrotasks();

    const menu = openMoreMenuFor('Blocked Bears');
    clickMenuItem(menu, 'Archive');

    const openDialogText = getOpenDialogText();
    expect(openDialogText).toContain('Archive Blocked Bears?');
    expect(openDialogText).toContain('preserved');
    expect(openDialogText).not.toMatch(/cannot be undone/i);

    clickButtonWithText('Archive');

    expect(container.textContent).toContain('Blocked Bears');
    expect(container.textContent).toContain('Archived');

    const menuAfter = openMoreMenuFor('Blocked Bears');
    expect(menuItemTexts(menuAfter)).toContain('Unarchive');
    expect(menuItemTexts(menuAfter)).not.toContain('Archive');

    // Unarchive flips it back directly -- no AlertDialog for a non-destructive action.
    clickMenuItem(menuAfter, 'Unarchive');
    expect(container.textContent).toContain('Blocked Bears');
    const menuFinal = openMoreMenuFor('Blocked Bears');
    expect(menuItemTexts(menuFinal)).toContain('Archive');
  });
});

// ---------------------------------------------------------------------------
// Full CRUD via the real dialog form.
// ---------------------------------------------------------------------------

describe('<TeamsTab /> Create team', () => {
  it('creates a new team through the form dialog with a closed program selector and color swatch picker', async () => {
    renderTab({ loadData: testLoadData, generateId: () => 'team-new-condors' });
    await flushMicrotasks();

    clickButtonWithText('New team');
    expect(document.body.textContent).toContain('New team');

    fillTextField('Name', 'Condors');
    fillTextField('Short name', 'CNDR');
    selectOption('Program', 'FTC');
    selectOption('Color', 'Purple');

    clickButtonWithText('Save');

    expect(container.textContent).toContain('Condors');
    expect(container.textContent).toContain('CNDR');
    expect(container.textContent).toContain('FTC');
  });

  it('shows a validation error and keeps the dialog open when name is blank', async () => {
    renderTab({ loadData: testLoadData });
    await flushMicrotasks();

    clickButtonWithText('New team');
    fillTextField('Short name', 'X');
    clickButtonWithText('Save');

    expect(document.body.textContent).toContain('Name is required');
    // Dialog is still open (title still present).
    expect(document.body.textContent).toContain('New team');
  });
});

describe('<TeamsTab /> Edit team', () => {
  it('edits an existing team through the same form dialog, pre-filled with its current values', async () => {
    renderTab({ loadData: testLoadData });
    await flushMicrotasks();

    const menu = openMoreMenuFor('Blocked Bears');
    clickMenuItem(menu, 'Edit');

    expect(document.body.textContent).toContain('Edit team');
    const nameInput = getFieldControl('Name') as HTMLInputElement;
    expect(nameInput.value).toBe('Blocked Bears');

    fillTextField('Name', 'Renamed Bears');
    clickButtonWithText('Save');

    expect(container.textContent).toContain('Renamed Bears');
    expect(container.textContent).not.toContain('Blocked Bears');
  });
});

// ---------------------------------------------------------------------------
// Sort order reorder mechanism (module doc #6).
// ---------------------------------------------------------------------------

describe('<TeamsTab /> Sort order up/down', () => {
  it('moves a row up via its IconButton and the new order is reflected in the table', async () => {
    renderTab({ loadData: testLoadData });
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
});
