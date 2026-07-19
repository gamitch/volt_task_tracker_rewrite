// @vitest-environment jsdom
/**
 * T023: tests for `StudentDialog.tsx`.
 *
 * Per this task's Allowed Files ("A colocated `StudentDialog.test.tsx` is
 * acceptable per established precedent") this test file is a deliberate,
 * disclosed addition -- the same class of addition `ScheduleMeetingsDialog.test.tsx`
 * (T031), `StudentsTab.test.tsx` (T022), `MeetingsList.test.tsx` (T030) already
 * made in their own sibling directories, existing only to produce the DOM-text
 * proof this task's own packet requires in "Required Worker Output": the
 * BEH-07 confirm-button copy in both modes, the blank-goal-override-submits-
 * null proof, the field-order proof, and the email-field disable/description
 * judgment call (module doc #1).
 *
 * No `@testing-library/react` is installed in this repo (confirmed via
 * `package.json`) -- these tests use the same raw `createRoot`/`act` pattern
 * plus the `getFieldControl` helper `ScheduleMeetingsDialog.test.tsx`/T031
 * already established (Astryx `Field`/`FieldLabel`-backed components all
 * render a real `<label htmlFor={id}>`, verified directly against
 * `node_modules/@astryxdesign/core/src/Field/FieldLabel.tsx`).
 */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  buildStudentFormPayload,
  computeConfirmLabel,
  computeDialogTitle,
  computeEmailFieldDisabled,
  computeGoalOverrideHelperText,
  computeStudentDialogMode,
  filterSelectableTeams,
  isStudentFormValid,
  StudentDialog,
  type StudentDialogInitialData,
  type StudentDialogTeamOption,
  type StudentFormPayload,
} from './StudentDialog';

// ---------------------------------------------------------------------------
// jsdom gap: `Dialog` renders a native `<dialog>` and calls
// `HTMLDialogElement.prototype.showModal()`, which this repo's installed
// jsdom does not implement -- same guarded, test-file-local polyfill
// `MeetingsList.test.tsx`/T030, `ScheduleMeetingsDialog.test.tsx`/T031, and
// `StudentsTab.test.tsx`/T022 already established.
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

/** Locates a labeled input via Astryx `Field`'s real `<label htmlFor>`. */
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

/** Opens a `Selector` via its trigger and clicks the option with the given
 * visible text (Astryx `Selector` renders options with `role="option"`,
 * verified directly against `node_modules/@astryxdesign/core/src/Selector/Selector.tsx`). */
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

const TEST_TEAMS: readonly StudentDialogTeamOption[] = [
  { id: 'team-ironclad', name: 'Ironclad', archived: false },
  { id: 'team-voltage', name: 'Voltage', archived: false },
  { id: 'team-legacy-forge', name: 'Legacy Forge', archived: true },
];

const TEST_INITIAL_DATA: StudentDialogInitialData = {
  id: 'student-priya-anand',
  displayName: 'Priya Anand',
  teamId: 'team-voltage',
  gradYear: 2028,
  isActive: true,
  goalHoursOverride: 15,
  hasAccount: false,
};

// ---------------------------------------------------------------------------
// Pure functions.
// ---------------------------------------------------------------------------

describe('computeStudentDialogMode', () => {
  it('is "create" when no initialData is supplied, "edit" otherwise', () => {
    expect(computeStudentDialogMode(undefined)).toBe('create');
    expect(computeStudentDialogMode(TEST_INITIAL_DATA)).toBe('edit');
  });
});

describe('computeConfirmLabel (BEH-07)', () => {
  it('never renders a bare "Submit"/"OK" -- "Add student" (create) / "Save changes" (edit)', () => {
    expect(computeConfirmLabel('create')).toBe('Add student');
    expect(computeConfirmLabel('edit')).toBe('Save changes');
  });
});

describe('computeDialogTitle', () => {
  it('"Add student" (create) / "Edit student" (edit)', () => {
    expect(computeDialogTitle('create')).toBe('Add student');
    expect(computeDialogTitle('edit')).toBe('Edit student');
  });
});

describe('computeEmailFieldDisabled (module doc #1 -- the edit-mode-with-account wrinkle)', () => {
  it('is only disabled when editing a student who already has an account', () => {
    expect(computeEmailFieldDisabled('create', false)).toBe(false);
    expect(computeEmailFieldDisabled('create', true)).toBe(false);
    expect(computeEmailFieldDisabled('edit', false)).toBe(false);
    expect(computeEmailFieldDisabled('edit', true)).toBe(true);
  });
});

describe('computeGoalOverrideHelperText (MET-04, module doc #3)', () => {
  it('cites the real season default value, not a hardcoded guess', () => {
    expect(computeGoalOverrideHelperText(100)).toBe(
      'Uses the season default (100 h) if left blank',
    );
    expect(computeGoalOverrideHelperText(80)).toBe('Uses the season default (80 h) if left blank');
  });
});

describe('filterSelectableTeams (module doc #4)', () => {
  it('excludes archived teams', () => {
    const result = filterSelectableTeams(TEST_TEAMS);
    expect(result.map((t) => t.id)).toEqual(['team-ironclad', 'team-voltage']);
    expect(result.some((t) => t.id === 'team-legacy-forge')).toBe(false);
  });
});

describe('isStudentFormValid', () => {
  it('requires a non-blank name and a selected team', () => {
    expect(
      isStudentFormValid({
        displayName: '',
        inviteEmail: '',
        teamId: '',
        gradYear: null,
        isActive: true,
        goalHoursOverride: null,
      }),
    ).toBe(false);
    expect(
      isStudentFormValid({
        displayName: 'Amara Voss',
        inviteEmail: '',
        teamId: '',
        gradYear: null,
        isActive: true,
        goalHoursOverride: null,
      }),
    ).toBe(false);
    expect(
      isStudentFormValid({
        displayName: '  ',
        inviteEmail: '',
        teamId: 'team-ironclad',
        gradYear: null,
        isActive: true,
        goalHoursOverride: null,
      }),
    ).toBe(false);
    expect(
      isStudentFormValid({
        displayName: 'Amara Voss',
        inviteEmail: '',
        teamId: 'team-ironclad',
        gradYear: null,
        isActive: true,
        goalHoursOverride: null,
      }),
    ).toBe(true);
  });
});

describe('buildStudentFormPayload (module doc #1/#3 -- blank goal override / blank email submit null)', () => {
  it('submits null (not 0, not undefined) for a blank goal override', () => {
    const payload = buildStudentFormPayload({
      displayName: 'Amara Voss',
      inviteEmail: '',
      teamId: 'team-ironclad',
      gradYear: null,
      isActive: true,
      goalHoursOverride: null,
    });
    expect(payload.goalHoursOverride).toBeNull();
    expect(payload.goalHoursOverride).not.toBe(0);
  });

  it('submits null (not an empty string) for a blank email', () => {
    const payload = buildStudentFormPayload({
      displayName: 'Amara Voss',
      inviteEmail: '   ',
      teamId: 'team-ironclad',
      gradYear: null,
      isActive: true,
      goalHoursOverride: null,
    });
    expect(payload.inviteEmail).toBeNull();
  });

  it('trims name and email, preserves a real goal override number', () => {
    const payload = buildStudentFormPayload({
      displayName: '  Amara Voss  ',
      inviteEmail: '  amara.voss.invite@example.com  ',
      teamId: 'team-ironclad',
      gradYear: 2027,
      isActive: false,
      goalHoursOverride: 15,
    });
    expect(payload.displayName).toBe('Amara Voss');
    expect(payload.inviteEmail).toBe('amara.voss.invite@example.com');
    expect(payload.gradYear).toBe(2027);
    expect(payload.isActive).toBe(false);
    expect(payload.goalHoursOverride).toBe(15);
  });
});

// ---------------------------------------------------------------------------
// <StudentDialog /> -- field order (ROS-03 / constitution item 13).
// ---------------------------------------------------------------------------

describe('<StudentDialog /> field order (ROS-03 / constitution item 13)', () => {
  it('renders fields in the exact ROS-03 order: name, email, team, grad year, active, goal override', () => {
    act(() => {
      root.render(<StudentDialog isOpen onOpenChange={() => {}} teams={TEST_TEAMS} />);
    });
    const labelTexts = Array.from(container.querySelectorAll('label'))
      .map((el) => el.textContent?.trim() ?? '')
      .filter((text) => text !== '');
    expect(labelTexts).toEqual([
      'Name ∙ Required',
      'Email ∙ Optional',
      'Team ∙ Required',
      'Grad year ∙ Optional',
      'Active',
      'Individual goal override ∙ Optional',
    ]);
  });
});

// ---------------------------------------------------------------------------
// BEH-07 confirm button copy in both modes.
// ---------------------------------------------------------------------------

describe('<StudentDialog /> BEH-07 confirm button + title copy', () => {
  it('create mode: dialog title and confirm button both read "Add student"', () => {
    act(() => {
      root.render(<StudentDialog isOpen onOpenChange={() => {}} teams={TEST_TEAMS} />);
    });
    expect(document.querySelector('h2')?.textContent?.trim()).toBe('Add student');
    expect(findButtonByText('Add student')).toBeDefined();
    expect(findButtonByText('Submit')).toBeUndefined();
    expect(findButtonByText('OK')).toBeUndefined();
  });

  it('edit mode: dialog title reads "Edit student", confirm button reads "Save changes"', () => {
    act(() => {
      root.render(
        <StudentDialog
          isOpen
          onOpenChange={() => {}}
          teams={TEST_TEAMS}
          initialData={TEST_INITIAL_DATA}
        />,
      );
    });
    expect(document.querySelector('h2')?.textContent?.trim()).toBe('Edit student');
    expect(findButtonByText('Save changes')).toBeDefined();
    expect(findButtonByText('Add student')).toBeUndefined();
    expect(findButtonByText('Submit')).toBeUndefined();
    expect(findButtonByText('OK')).toBeUndefined();
  });

  it('edit mode pre-fills the form fields from initialData', () => {
    act(() => {
      root.render(
        <StudentDialog
          isOpen
          onOpenChange={() => {}}
          teams={TEST_TEAMS}
          initialData={TEST_INITIAL_DATA}
        />,
      );
    });
    expect((getFieldControl('Name') as HTMLInputElement).value).toBe('Priya Anand');
    expect((getFieldControl('Grad year') as HTMLInputElement).value).toBe('2028');
    expect((getFieldControl('Individual goal override') as HTMLInputElement).value).toBe('15');
  });
});

// ---------------------------------------------------------------------------
// Module doc #1: the "email (optional)" field's real meaning.
// ---------------------------------------------------------------------------

describe('<StudentDialog /> "email (optional)" field (module doc #1)', () => {
  it('create mode: Email is enabled, with description copy about queuing an invite', () => {
    act(() => {
      root.render(<StudentDialog isOpen onOpenChange={() => {}} teams={TEST_TEAMS} />);
    });
    const emailInput = getFieldControl('Email') as HTMLInputElement;
    expect(emailInput.disabled).toBe(false);
    const bodyText = container.textContent ?? '';
    expect(bodyText).toContain('queues an invite');
  });

  it('edit mode + no account yet: Email stays enabled (student could still be invited)', () => {
    act(() => {
      root.render(
        <StudentDialog
          isOpen
          onOpenChange={() => {}}
          teams={TEST_TEAMS}
          initialData={{ ...TEST_INITIAL_DATA, hasAccount: false }}
        />,
      );
    });
    const emailInput = getFieldControl('Email') as HTMLInputElement;
    expect(emailInput.disabled).toBe(false);
  });

  it('edit mode + already has an account: Email is disabled with an explicit reason', () => {
    act(() => {
      root.render(
        <StudentDialog
          isOpen
          onOpenChange={() => {}}
          teams={TEST_TEAMS}
          initialData={{ ...TEST_INITIAL_DATA, hasAccount: true }}
        />,
      );
    });
    const emailInput = getFieldControl('Email') as HTMLInputElement;
    expect(emailInput.getAttribute('aria-disabled')).toBe('true');
  });
});

// ---------------------------------------------------------------------------
// MET-04 helper copy + archived-team exclusion, rendered.
// ---------------------------------------------------------------------------

describe('<StudentDialog /> MET-04 goal override helper copy + archived team exclusion', () => {
  it('explains blank = season default, citing the real fixture default (100 h)', () => {
    act(() => {
      root.render(<StudentDialog isOpen onOpenChange={() => {}} teams={TEST_TEAMS} />);
    });
    const bodyText = container.textContent ?? '';
    expect(bodyText).toContain('Uses the season default (100 h) if left blank');
  });

  it('a custom season prop value is reflected verbatim in the helper text', () => {
    act(() => {
      root.render(
        <StudentDialog
          isOpen
          onOpenChange={() => {}}
          teams={TEST_TEAMS}
          season={{ defaultGoalHours: 80 }}
        />,
      );
    });
    expect(container.textContent ?? '').toContain('Uses the season default (80 h) if left blank');
  });

  it('archived team ("Legacy Forge") never appears as a Team option', () => {
    act(() => {
      root.render(<StudentDialog isOpen onOpenChange={() => {}} teams={TEST_TEAMS} />);
    });
    const trigger = getFieldControl('Team') as HTMLButtonElement;
    clickButton(trigger);
    const optionTexts = Array.from(document.querySelectorAll('[role="option"]')).map(
      (el) => el.textContent?.trim() ?? '',
    );
    expect(optionTexts).toContain('Ironclad');
    expect(optionTexts).toContain('Voltage');
    expect(optionTexts).not.toContain('Legacy Forge');
  });
});

// ---------------------------------------------------------------------------
// Validity gating + submit/cancel behavior.
// ---------------------------------------------------------------------------

describe('<StudentDialog /> validity gating + submit', () => {
  it('confirm button is natively disabled until a name and team are both set', () => {
    act(() => {
      root.render(<StudentDialog isOpen onOpenChange={() => {}} teams={TEST_TEAMS} />);
    });
    let confirmButton = findButtonByText('Add student');
    expect(confirmButton?.disabled).toBe(true);

    const nameInput = getFieldControl('Name') as HTMLInputElement;
    act(() => {
      setNativeInputValue(nameInput, 'Kellan Reyes');
    });
    confirmButton = findButtonByText('Add student');
    expect(confirmButton?.disabled).toBe(true); // name alone is not enough -- team still unset.

    selectOption('Team', 'Ironclad');
    confirmButton = findButtonByText('Add student');
    expect(confirmButton?.disabled).toBe(false);
  });

  it('submits the correctly computed payload (including null goal override) only when clicked', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const onOpenChange = vi.fn();
    act(() => {
      root.render(
        <StudentDialog isOpen onOpenChange={onOpenChange} teams={TEST_TEAMS} onSubmit={onSubmit} />,
      );
    });

    const nameInput = getFieldControl('Name') as HTMLInputElement;
    act(() => {
      setNativeInputValue(nameInput, 'Kellan Reyes');
    });
    selectOption('Team', 'Ironclad');

    expect(onSubmit).not.toHaveBeenCalled();

    clickButton(findButtonByText('Add student') as HTMLButtonElement);
    await flushMicrotasks();

    expect(onSubmit).toHaveBeenCalledTimes(1);
    const [payload, mode] = onSubmit.mock.calls[0] as [StudentFormPayload, string];
    expect(payload.displayName).toBe('Kellan Reyes');
    expect(payload.teamId).toBe('team-ironclad');
    expect(payload.goalHoursOverride).toBeNull();
    expect(payload.inviteEmail).toBeNull();
    expect(mode).toBe('create');
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('Cancel discards the form and never invokes onSubmit', () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const onOpenChange = vi.fn();
    act(() => {
      root.render(
        <StudentDialog isOpen onOpenChange={onOpenChange} teams={TEST_TEAMS} onSubmit={onSubmit} />,
      );
    });
    const nameInput = getFieldControl('Name') as HTMLInputElement;
    act(() => {
      setNativeInputValue(nameInput, 'Kellan Reyes');
    });
    clickButton(findButtonByText('Cancel') as HTMLButtonElement);
    expect(onSubmit).not.toHaveBeenCalled();
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('resets to pristine create-mode defaults every time the dialog re-opens', () => {
    act(() => {
      root.render(<StudentDialog isOpen onOpenChange={() => {}} teams={TEST_TEAMS} />);
    });
    const nameInput = getFieldControl('Name') as HTMLInputElement;
    act(() => {
      setNativeInputValue(nameInput, 'Kellan Reyes');
    });
    expect((getFieldControl('Name') as HTMLInputElement).value).toBe('Kellan Reyes');

    act(() => {
      root.render(<StudentDialog isOpen={false} onOpenChange={() => {}} teams={TEST_TEAMS} />);
    });
    act(() => {
      root.render(<StudentDialog isOpen onOpenChange={() => {}} teams={TEST_TEAMS} />);
    });

    expect((getFieldControl('Name') as HTMLInputElement).value).toBe('');
  });
});
