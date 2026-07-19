// @vitest-environment jsdom
/**
 * T024: tests for `InviteParentDialog.tsx`.
 *
 * Per this task's Allowed Files, a colocated test file is an explicitly
 * sanctioned addition (same precedent `ScheduleMeetingsDialog.test.tsx`/T031,
 * `StudentsTab.test.tsx`/T022, etc. already established) -- it exists to
 * produce the "Required Worker Output" proof this task's own packet demands:
 * the required-relationship-label validation (disabled submit until filled),
 * the BEH-07 confirm button copy, and the DES-14 toast copy.
 *
 * No `@testing-library/react` is installed in this repo (confirmed via
 * `package.json`) -- these tests use the same raw `createRoot`/`act` pattern
 * plus `getFieldControl` helper `ScheduleMeetingsDialog.test.tsx` already
 * established (Astryx `Field` renders a real `<label htmlFor={id}>` for every
 * labeled input).
 *
 * MultiSelector's own real interaction relies on the native Popover API
 * (`showPopover`/`hidePopover`), which this repo's jsdom does not implement
 * (confirmed directly against
 * `node_modules/@astryxdesign/core/src/MultiSelector/MultiSelector.tsx` and
 * its own test file's `beforeEach` polyfill, which additionally depends on
 * `@testing-library/react`/`user-event`, neither installed here). Following
 * `ScheduleMeetingsDialog.test.tsx`'s own precedent (which exercises its
 * `MultiSelector` team-scope field purely through `resolveTeamScope`/props,
 * never through a simulated dropdown click), the "additional linked
 * students" MultiSelector's actual selection-changing effect is proven here
 * through its pure logic (`buildInviteParentSubmission`,
 * `computeSendInviteLabel`) rather than a simulated popover click -- a
 * disclosed, precedented scope boundary, not a skipped requirement.
 */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  buildInviteParentSubmission,
  computeSendInviteLabel,
  InviteParentDialog,
  isInviteParentFormValid,
  isValidInviteEmail,
  type InviteParentSubmission,
} from './InviteParentDialog';

// ---------------------------------------------------------------------------
// jsdom gap: `Dialog` renders a native `<dialog>` and calls
// `HTMLDialogElement.prototype.showModal()`, which this repo's installed
// jsdom does not implement. Same guarded, test-file-local polyfill
// `ScheduleMeetingsDialog.test.tsx`/T031 already established.
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

function setNativeInputValue(input: HTMLInputElement, value: string): void {
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
  setter?.call(input, value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

function clickButton(button: HTMLButtonElement): void {
  act(() => {
    button.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
}

const PRIMARY_STUDENT = { id: 'student-mika-torres', displayName: 'Mika Torres' };

// ---------------------------------------------------------------------------
// Pure functions -- email validation, required-relationship, payload shape.
// ---------------------------------------------------------------------------

describe('isValidInviteEmail', () => {
  it('accepts a well-formed email', () => {
    expect(isValidInviteEmail('parent.of.mika@example.com')).toBe(true);
  });

  it('rejects an obviously malformed email', () => {
    expect(isValidInviteEmail('not-an-email')).toBe(false);
    expect(isValidInviteEmail('missing-domain@')).toBe(false);
    expect(isValidInviteEmail('')).toBe(false);
  });
});

describe('isInviteParentFormValid (Known Context/Traps #4 -- required relationship)', () => {
  it('is false when relationship is empty, even with a valid email', () => {
    expect(isInviteParentFormValid('parent@example.com', '')).toBe(false);
    expect(isInviteParentFormValid('parent@example.com', '   ')).toBe(false);
  });

  it('is false when email is empty or invalid, even with a relationship filled in', () => {
    expect(isInviteParentFormValid('', 'Mother')).toBe(false);
    expect(isInviteParentFormValid('not-an-email', 'Mother')).toBe(false);
  });

  it('is true only once both a valid email AND a non-empty relationship are present', () => {
    expect(isInviteParentFormValid('parent@example.com', 'Mother')).toBe(true);
  });
});

describe('computeSendInviteLabel (BEH-07/DES-14)', () => {
  it('is the literal DES-14 "Send invite" for exactly one student (PRD line 210)', () => {
    expect(computeSendInviteLabel(1)).toBe('Send invite');
  });

  it('computes "Send N invites" (BEH-07, PRD line 236) for multiple linked students', () => {
    expect(computeSendInviteLabel(2)).toBe('Send 2 invites');
    expect(computeSendInviteLabel(3)).toBe('Send 3 invites');
  });

  it('never renders a bare "Submit"/"OK"', () => {
    for (const count of [1, 2, 5]) {
      const label = computeSendInviteLabel(count);
      expect(label).not.toBe('Submit');
      expect(label).not.toBe('OK');
      expect(label.startsWith('Send')).toBe(true);
    }
  });
});

describe('buildInviteParentSubmission (Central Trap -- module doc #1)', () => {
  it('produces exactly one send-invite-shaped request for the primary student when no additional students are picked', () => {
    const submission = buildInviteParentSubmission(
      'parent@example.com',
      'Mother',
      'student-mika-torres',
      [],
    );
    expect(submission.inviteRequests).toEqual([
      { email: 'parent@example.com', role: 'parent', student_id: 'student-mika-torres' },
    ]);
    expect(submission.relationship).toBe('Mother');
  });

  it('produces one request PER linked student (primary + additional), all sharing one email -- the exact shape 20260718000000_invite_trigger.sql already expects', () => {
    const submission: InviteParentSubmission = buildInviteParentSubmission(
      ' parent@example.com ',
      ' Mother ',
      'student-mika-torres',
      ['student-noor-farah', 'student-declan-ashworth'],
    );
    expect(submission.inviteRequests).toEqual([
      { email: 'parent@example.com', role: 'parent', student_id: 'student-mika-torres' },
      { email: 'parent@example.com', role: 'parent', student_id: 'student-noor-farah' },
      { email: 'parent@example.com', role: 'parent', student_id: 'student-declan-ashworth' },
    ]);
    // Trimmed once, not per-request.
    expect(submission.relationship).toBe('Mother');
    // Every request shares the exact same email string.
    const emails = new Set(submission.inviteRequests.map((r) => r.email));
    expect(emails.size).toBe(1);
  });

  it('de-duplicates if the primary student id is accidentally also in the additional list', () => {
    const submission = buildInviteParentSubmission('parent@example.com', 'Guardian', 'student-a', [
      'student-b',
      'student-a',
    ]);
    expect(submission.inviteRequests.map((r) => r.student_id)).toEqual(['student-a', 'student-b']);
  });
});

// ---------------------------------------------------------------------------
// <InviteParentDialog /> -- field order, required-relationship disabled-
// button proof, BEH-07 copy, DES-14 toast copy.
// ---------------------------------------------------------------------------

describe('<InviteParentDialog /> field order (ROS-05 / constitution item 13)', () => {
  it('renders fields in the exact ROS-05 order: email, relationship, additional linked students', () => {
    act(() => {
      root.render(<InviteParentDialog isOpen onOpenChange={() => {}} student={PRIMARY_STUDENT} />);
    });
    const labelTexts = Array.from(container.querySelectorAll('label'))
      .map((el) => el.textContent?.trim() ?? '')
      .filter((text) => text !== '');
    expect(labelTexts).toEqual([
      'Email ∙ Required',
      'Relationship ∙ Required',
      'Additional linked students ∙ Optional',
    ]);
  });
});

describe('<InviteParentDialog /> required-relationship-label validation (Known Context/Traps #4)', () => {
  it('confirm button starts disabled, genuinely non-interactive', () => {
    const onSendInvite = vi.fn().mockResolvedValue(undefined);
    act(() => {
      root.render(
        <InviteParentDialog
          isOpen
          onOpenChange={() => {}}
          student={PRIMARY_STUDENT}
          onSendInvite={onSendInvite}
        />,
      );
    });

    const confirmButton = findButtonByText('Send invite');
    expect(confirmButton).toBeDefined();
    expect(confirmButton?.disabled).toBe(true);

    // Genuinely non-interactive: dispatching a click on a natively-disabled
    // button must not invoke the handler.
    clickButton(confirmButton as HTMLButtonElement);
    expect(onSendInvite).not.toHaveBeenCalled();
  });

  it('stays disabled with a valid email but an empty relationship', () => {
    act(() => {
      root.render(<InviteParentDialog isOpen onOpenChange={() => {}} student={PRIMARY_STUDENT} />);
    });
    const emailInput = getFieldControl('Email') as HTMLInputElement;
    act(() => {
      setNativeInputValue(emailInput, 'parent@example.com');
    });
    expect(findButtonByText('Send invite')?.disabled).toBe(true);
  });

  it('stays disabled with a relationship filled but no/invalid email', () => {
    act(() => {
      root.render(<InviteParentDialog isOpen onOpenChange={() => {}} student={PRIMARY_STUDENT} />);
    });
    const relationshipInput = getFieldControl('Relationship') as HTMLInputElement;
    act(() => {
      setNativeInputValue(relationshipInput, 'Mother');
    });
    expect(findButtonByText('Send invite')?.disabled).toBe(true);

    const emailInput = getFieldControl('Email') as HTMLInputElement;
    act(() => {
      setNativeInputValue(emailInput, 'not-an-email');
    });
    expect(findButtonByText('Send invite')?.disabled).toBe(true);
  });

  it('enables once BOTH a valid email and a non-empty relationship are present, and re-disables if relationship is cleared', () => {
    act(() => {
      root.render(<InviteParentDialog isOpen onOpenChange={() => {}} student={PRIMARY_STUDENT} />);
    });
    const emailInput = getFieldControl('Email') as HTMLInputElement;
    const relationshipInput = getFieldControl('Relationship') as HTMLInputElement;

    act(() => {
      setNativeInputValue(emailInput, 'parent@example.com');
    });
    act(() => {
      setNativeInputValue(relationshipInput, 'Mother');
    });
    expect(findButtonByText('Send invite')?.disabled).toBe(false);

    act(() => {
      setNativeInputValue(relationshipInput, '');
    });
    expect(findButtonByText('Send invite')?.disabled).toBe(true);
  });
});

describe('<InviteParentDialog /> BEH-07/DES-14 submit flow', () => {
  it('calls onSendInvite with the real payload shape, closes, and shows the exact DES-14 toast copy', async () => {
    const onSendInvite = vi.fn().mockResolvedValue(undefined);
    const onOpenChange = vi.fn();
    act(() => {
      root.render(
        <InviteParentDialog
          isOpen
          onOpenChange={onOpenChange}
          student={PRIMARY_STUDENT}
          onSendInvite={onSendInvite}
        />,
      );
    });

    const emailInput = getFieldControl('Email') as HTMLInputElement;
    const relationshipInput = getFieldControl('Relationship') as HTMLInputElement;
    act(() => {
      setNativeInputValue(emailInput, 'parent.of.mika@example.com');
    });
    act(() => {
      setNativeInputValue(relationshipInput, 'Mother');
    });

    const confirmButton = findButtonByText('Send invite') as HTMLButtonElement;
    expect(confirmButton.disabled).toBe(false);
    clickButton(confirmButton);
    await flushMicrotasks();

    expect(onSendInvite).toHaveBeenCalledTimes(1);
    const submission = onSendInvite.mock.calls[0][0] as InviteParentSubmission;
    expect(submission.inviteRequests).toEqual([
      {
        email: 'parent.of.mika@example.com',
        role: 'parent',
        student_id: 'student-mika-torres',
      },
    ]);
    expect(submission.relationship).toBe('Mother');

    // The dialog is told to close on success.
    expect(onOpenChange).toHaveBeenCalledWith(false);

    // DES-14 (PRD line 210): "Send invite" -> toast "Invite sent to ...",
    // with the actual email interpolated -- exact phrasing, not a paraphrase.
    const toastText = container.textContent ?? '';
    expect(toastText).toContain('Invite sent to parent.of.mika@example.com');
  });

  it('shows an inline Banner (not a toast) and stays open on a rejected send', async () => {
    const onSendInvite = vi.fn().mockRejectedValue(new Error('Network error. Try again.'));
    const onOpenChange = vi.fn();
    act(() => {
      root.render(
        <InviteParentDialog
          isOpen
          onOpenChange={onOpenChange}
          student={PRIMARY_STUDENT}
          onSendInvite={onSendInvite}
        />,
      );
    });

    const emailInput = getFieldControl('Email') as HTMLInputElement;
    const relationshipInput = getFieldControl('Relationship') as HTMLInputElement;
    act(() => {
      setNativeInputValue(emailInput, 'parent.of.mika@example.com');
    });
    act(() => {
      setNativeInputValue(relationshipInput, 'Mother');
    });
    clickButton(findButtonByText('Send invite') as HTMLButtonElement);
    await flushMicrotasks();

    expect(onOpenChange).not.toHaveBeenCalledWith(false);
    expect(container.textContent).toContain("Couldn't send this invite");
    expect(container.textContent).toContain('Network error. Try again.');
    expect(container.textContent ?? '').not.toContain('Invite sent to');
  });
});
