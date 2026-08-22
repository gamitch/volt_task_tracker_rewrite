// @vitest-environment jsdom
/**
 * Tests for `AttendanceChips.tsx` (GAM-448). No `@testing-library/react` is
 * installed in this repo -- these tests use the same raw `createRoot`/`act`
 * pattern `SeriesCard.test.tsx`/`CoachMeetingsView.test.tsx` already
 * established: `container.querySelector`, a real `MouseEvent`/`KeyboardEvent`
 * dispatched at the DOM node, and `button.tagName === 'BUTTON'` as the
 * keyboard-reachability guarantee (a native `<button>` is unconditionally
 * Enter/Space-activatable per the HTML spec; jsdom does not itself simulate
 * that native activation, so it is not re-simulated here either).
 *
 * `AttendanceChips` is a CONTROLLED component -- it owns no status state of
 * its own (its own module doc: "purely presentational"). So "walking the
 * cycle" in these tests means: click, read which callback fired and with
 * what value, re-render with that value as the new `status` prop (exactly
 * what `SessionRow.tsx` does for real), and repeat -- the same pattern this
 * file's own sibling `SessionRow.test.tsx` exercises end-to-end through the
 * real write seams.
 */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AttendanceChips, type AttendanceChipsProps } from './AttendanceChips';
import attendanceChipsSource from './AttendanceChips.tsx?raw';
import type { AttendanceStatus } from '../../../lib/supabase/loaders/attendance';

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

function renderChip(props: AttendanceChipsProps): void {
  act(() => {
    root.render(<AttendanceChips {...props} />);
  });
}

function chipButton(): HTMLButtonElement {
  const el = container.querySelector('button');
  expect(el, 'expected a rendered <button>').toBeTruthy();
  return el as HTMLButtonElement;
}

function clickChip(options: { shiftKey?: boolean } = {}): void {
  act(() => {
    chipButton().dispatchEvent(
      new MouseEvent('click', { bubbles: true, shiftKey: options.shiftKey ?? false }),
    );
  });
}

function baseProps(overrides: Partial<AttendanceChipsProps> = {}): AttendanceChipsProps {
  return {
    studentName: 'Ada L.',
    status: null,
    onSetStatus: vi.fn(),
    onUnset: vi.fn(),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Criterion 6 -- real <button>, accessible name, aria-live announcement.
// ---------------------------------------------------------------------------

describe('the four MTG-01g a11y rules', () => {
  it('is a real, focusable <button> -- not a div with a click handler', () => {
    renderChip(baseProps({ status: 'present' }));
    const button = chipButton();
    expect(button.tagName).toBe('BUTTON');
    button.focus();
    expect(document.activeElement).toBe(button);
  });

  it('accessible name contains the student name AND the current status', () => {
    renderChip(baseProps({ studentName: 'Ada L.', status: 'present' }));
    expect(chipButton().getAttribute('aria-label')).toBe('Ada L., present');
  });

  it('accessible name reads "not recorded" for a null (unset) status', () => {
    renderChip(baseProps({ studentName: 'Ada L.', status: null }));
    expect(chipButton().getAttribute('aria-label')).toBe('Ada L., not recorded');
  });

  it('announces each change via a role="status" live region whose text tracks the status prop', () => {
    renderChip(baseProps({ studentName: 'Ada L.', status: 'present' }));
    const live = container.querySelector('[role="status"]');
    expect(live, 'expected a role="status" live region').toBeTruthy();
    expect(live?.textContent).toBe('Ada L., present');

    renderChip(baseProps({ studentName: 'Ada L.', status: 'late' }));
    expect(container.querySelector('[role="status"]')?.textContent).toBe('Ada L., late');
  });

  it('target is >=44px in both dimensions', () => {
    renderChip(baseProps({ status: 'present' }));
    const style = chipButton().style;
    expect(style.minHeight).toBe('44px');
    expect(style.minWidth).toBe('44px');
  });
});

// ---------------------------------------------------------------------------
// Criterion 3 -- exactly five stops, walked back to the start.
// ---------------------------------------------------------------------------

describe('cycle order (canSetExcused: true)', () => {
  it('is exactly Present -> Late -> Excused -> Absent -> (unset) -> Present', () => {
    const onSetStatus = vi.fn();
    const onUnset = vi.fn();
    let status: AttendanceStatus | null = null;
    renderChip(baseProps({ status, canSetExcused: true, onSetStatus, onUnset }));

    function tapAndAdvance(): void {
      const setStatusCallsBefore = onSetStatus.mock.calls.length;
      const unsetCallsBefore = onUnset.mock.calls.length;
      clickChip();
      if (onUnset.mock.calls.length > unsetCallsBefore) {
        status = null;
      } else {
        expect(onSetStatus.mock.calls.length).toBe(setStatusCallsBefore + 1);
        status = onSetStatus.mock.calls[onSetStatus.mock.calls.length - 1][0];
      }
      renderChip(baseProps({ status, canSetExcused: true, onSetStatus, onUnset }));
    }

    tapAndAdvance(); // (unset) -> Present
    expect(status).toBe('present');
    tapAndAdvance(); // Present -> Late
    expect(status).toBe('late');
    tapAndAdvance(); // Late -> Excused
    expect(status).toBe('excused');
    tapAndAdvance(); // Excused -> Absent
    expect(status).toBe('absent');
    tapAndAdvance(); // Absent -> (unset)
    expect(onUnset).toHaveBeenCalledTimes(1);
    expect(status).toBe(null);
    tapAndAdvance(); // (unset) -> Present again -- the loop closes.
    expect(status).toBe('present');
    expect(onSetStatus.mock.calls.map((call) => call[0])).toEqual([
      'present',
      'late',
      'excused',
      'absent',
      'present',
    ]);
  });
});

// ---------------------------------------------------------------------------
// Criterion 4 -- Shift-activation reverses, across a wrap boundary.
// ---------------------------------------------------------------------------

describe('Shift-activation reverses the cycle', () => {
  it('Shift-taps Absent -> Excused (an ordinary reverse step)', () => {
    const onSetStatus = vi.fn();
    renderChip(baseProps({ status: 'absent', canSetExcused: true, onSetStatus }));
    clickChip({ shiftKey: true });
    expect(onSetStatus).toHaveBeenCalledTimes(1);
    expect(onSetStatus).toHaveBeenCalledWith('excused');
  });

  it('Shift-taps Present -> (unset), the reverse wrap boundary', () => {
    const onUnset = vi.fn();
    const onSetStatus = vi.fn();
    renderChip(baseProps({ status: 'present', canSetExcused: true, onSetStatus, onUnset }));
    clickChip({ shiftKey: true });
    expect(onUnset).toHaveBeenCalledTimes(1);
    expect(onSetStatus).not.toHaveBeenCalled();
  });

  it('Shift-taps (unset) -> Absent, the forward wrap boundary in reverse', () => {
    const onSetStatus = vi.fn();
    renderChip(baseProps({ status: null, canSetExcused: true, onSetStatus }));
    clickChip({ shiftKey: true });
    expect(onSetStatus).toHaveBeenCalledTimes(1);
    expect(onSetStatus).toHaveBeenCalledWith('absent');
  });
});

// ---------------------------------------------------------------------------
// Criterion 16 (AttendanceChips' own layer) -- canSetExcused: false skips the
// Excused stop in the cycle itself, without losing the control.
// ---------------------------------------------------------------------------

describe('canSetExcused: false (MTG-12 default)', () => {
  it('the forward cycle never lands on Excused: Late -> Absent directly', () => {
    const onSetStatus = vi.fn();
    renderChip(baseProps({ status: 'late', canSetExcused: false, onSetStatus }));
    clickChip();
    expect(onSetStatus).toHaveBeenCalledTimes(1);
    expect(onSetStatus).toHaveBeenCalledWith('absent');
  });

  it('the control itself is not removed -- Present/Late/Absent/(unset) remain reachable', () => {
    const onSetStatus = vi.fn();
    const onUnset = vi.fn();
    let status: AttendanceStatus | null = null;
    renderChip(baseProps({ status, canSetExcused: false, onSetStatus, onUnset }));

    function tapAndAdvance(): void {
      const setStatusCallsBefore = onSetStatus.mock.calls.length;
      const unsetCallsBefore = onUnset.mock.calls.length;
      clickChip();
      if (onUnset.mock.calls.length > unsetCallsBefore) {
        status = null;
      } else {
        expect(onSetStatus.mock.calls.length).toBe(setStatusCallsBefore + 1);
        status = onSetStatus.mock.calls[onSetStatus.mock.calls.length - 1][0];
      }
      renderChip(baseProps({ status, canSetExcused: false, onSetStatus, onUnset }));
    }

    tapAndAdvance();
    expect(status).toBe('present');
    tapAndAdvance();
    expect(status).toBe('late');
    tapAndAdvance();
    expect(status).toBe('absent');
    tapAndAdvance();
    expect(onUnset).toHaveBeenCalledTimes(1);
    expect(onSetStatus.mock.calls.map((call) => call[0])).toEqual(['present', 'late', 'absent']);
  });
});

// ---------------------------------------------------------------------------
// Criterion 10 -- disabled + no write.
// ---------------------------------------------------------------------------

describe('isDisabled', () => {
  it('renders a genuinely disabled <button> (native .disabled, not aria-disabled-only) with an explanatory title', () => {
    renderChip(
      baseProps({
        status: 'present',
        isDisabled: true,
        disabledTitle: 'Sign in again to record attendance.',
      }),
    );
    const button = chipButton();
    expect(button.disabled).toBe(true);
    expect(button.title).toBe('Sign in again to record attendance.');
  });

  it('a click on a disabled chip calls neither onSetStatus nor onUnset', () => {
    const onSetStatus = vi.fn();
    const onUnset = vi.fn();
    renderChip(baseProps({ status: 'present', isDisabled: true, onSetStatus, onUnset }));
    clickChip();
    expect(onSetStatus).not.toHaveBeenCalled();
    expect(onUnset).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// DES-05 colors -- Astryx semantic Badge variants only.
// ---------------------------------------------------------------------------

describe('DES-05 status colors', () => {
  it.each([
    ['present', 'success'],
    ['late', 'warning'],
    ['excused', 'neutral'],
    ['absent', 'error'],
  ] as const)('%s renders a Badge with variant=%s', (status, variant) => {
    renderChip(baseProps({ status }));
    const badge = container.querySelector('.astryx-badge');
    expect(badge?.getAttribute('data-variant')).toBe(variant);
  });

  it('a null (unset) status renders a neutral Badge, never error/red', () => {
    renderChip(baseProps({ status: null }));
    const badge = container.querySelector('.astryx-badge');
    expect(badge?.getAttribute('data-variant')).toBe('neutral');
  });
});

// ---------------------------------------------------------------------------
// Criterion 13 -- no mutation code, no makeOnEditAttendance (criterion 14).
// ---------------------------------------------------------------------------

describe('no direct mutation code', () => {
  it('never names the wrong write seam (§0e) and never calls a Supabase mutation directly', () => {
    const source = attendanceChipsSource;
    expect(source).not.toContain('makeOnEditAttendance');
    expect(source).not.toContain('.from(');
    expect(source).not.toContain('.upsert(');
    expect(source).not.toContain('.update(');
    expect(source).not.toContain('.insert(');
    expect(source).not.toContain('.delete(');
    expect(source).not.toContain('getSupabaseClient');
    expect(source).not.toContain('expectedCt');
  });
});
