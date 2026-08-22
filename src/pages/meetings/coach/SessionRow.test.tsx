// @vitest-environment jsdom
/**
 * Tests for `SessionRow.tsx` (GAM-448). No `@testing-library/react` is
 * installed in this repo -- these tests use the same raw `createRoot`/`act`
 * pattern `SeriesCard.test.tsx`/`CoachMeetingsView.test.tsx` already
 * established. `AlertDialog` is asserted the same way
 * `CoachMeetingsView.test.tsx`'s own Cancel tests already do: its action
 * button is found via `document.querySelectorAll('button')` (it renders
 * outside this test's own `container`), not `container.querySelector`.
 */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SessionRow, type SessionRowProps } from './SessionRow';
import sessionRowSource from './SessionRow.tsx?raw';
import type { SessionRosterEntry } from './SchedulePanel';
import type { CoachMeetingSessionDetail } from '../../../lib/meetings/types';
import { formatTimeRangeWithDuration, formatWeekdayDate } from '../../../lib/meetings/format';

// ---------------------------------------------------------------------------
// jsdom gap: `AlertDialog` renders a native `<dialog>` and calls
// `HTMLDialogElement.prototype.showModal()`, which this repo's installed
// jsdom does not implement. Scoped to THIS test file's own jsdom global only
// -- exact precedent: `CoachMeetingsView.test.tsx:31-47`.
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

function renderRow(props: SessionRowProps): void {
  act(() => {
    root.render(<SessionRow {...props} />);
  });
}

async function flushMicrotasks(): Promise<void> {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });
}

function findButtonByText(text: string): HTMLButtonElement | undefined {
  return Array.from(document.querySelectorAll('button')).find(
    (button) => button.textContent?.trim() === text,
  );
}

function clickButton(button: HTMLButtonElement | undefined): void {
  expect(button, 'expected to find the button').toBeTruthy();
  act(() => {
    (button as HTMLButtonElement).dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
}

function baseSession(
  overrides: Partial<CoachMeetingSessionDetail> = {},
): CoachMeetingSessionDetail {
  return {
    sessionId: 'session-1',
    sessionDate: '2026-10-01',
    startsAt: '2026-10-01T21:00:00.000Z', // 4:00 PM Chicago (CDT, UTC-5)
    endsAt: '2026-10-01T23:00:00.000Z', // 6:00 PM Chicago
    status: 'scheduled',
    durationHours: 2,
    expectedCt: 7,
    attendanceSummary: null,
    attendeeNames: [],
    ...overrides,
  };
}

function baseProps(overrides: Partial<SessionRowProps> = {}): SessionRowProps {
  return {
    eventId: 'event-1',
    session: baseSession(),
    isExpanded: false,
    onToggleExpand: vi.fn(),
    ...overrides,
  };
}

function rosterEntry(overrides: Partial<SessionRosterEntry> = {}): SessionRosterEntry {
  return {
    studentId: 'student-1',
    displayName: 'Ada L.',
    status: null,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Criterion 19 -- row line renders exactly what the frozen formatters return.
// ---------------------------------------------------------------------------

describe('row line (criterion 19)', () => {
  it('renders exactly formatWeekdayDate + " · " + formatTimeRangeWithDuration, no re-formatting', () => {
    const session = baseSession();
    renderRow(baseProps({ session }));
    const expected = `${formatWeekdayDate(session.sessionDate)} · ${formatTimeRangeWithDuration(session.startsAt, session.endsAt)}`;
    expect(expected).toBe('Thu, Oct 1 · 4:00–6:00 PM · 2h');
    expect(container.textContent).toContain(expected);
  });
});

// ---------------------------------------------------------------------------
// Status badge + overlap badge.
// ---------------------------------------------------------------------------

describe('status badge', () => {
  it.each([
    ['scheduled', 'info'],
    ['completed', 'success'],
    ['canceled', 'error'],
  ] as const)('%s maps to Badge variant=%s', (status, variant) => {
    renderRow(baseProps({ session: baseSession({ status }) }));
    const badges = Array.from(container.querySelectorAll('.astryx-badge'));
    const statusBadge = badges.find((b) => b.getAttribute('data-variant') === variant);
    expect(statusBadge, `expected a ${variant} badge for ${status}`).toBeTruthy();
  });

  it('renders an overlap badge only when hasOverlap is true', () => {
    renderRow(baseProps({ hasOverlap: false }));
    expect(container.textContent).not.toContain('Overlap');

    renderRow(baseProps({ hasOverlap: true }));
    expect(container.textContent).toContain('Overlap');
  });
});

// ---------------------------------------------------------------------------
// Criterion 20 -- per-row Edit chip.
// ---------------------------------------------------------------------------

describe('per-row Edit chip (criterion 20)', () => {
  it('calls the injected onEditSession exactly once with the sessionId', () => {
    const onEditSession = vi.fn();
    renderRow(baseProps({ session: baseSession({ sessionId: 'session-xyz' }), onEditSession }));
    clickButton(findButtonByText('Edit'));
    expect(onEditSession).toHaveBeenCalledTimes(1);
    expect(onEditSession).toHaveBeenCalledWith('session-xyz');
  });

  it('is absent when onEditSession is not supplied', () => {
    renderRow(baseProps());
    expect(findButtonByText('Edit')).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Criterion 11 -- Cancel confirmation via AlertDialog.
// ---------------------------------------------------------------------------

describe('scheduled session -- Cancel via AlertDialog (criterion 11)', () => {
  it('does not call onCancelSession until the AlertDialog is confirmed, then calls it exactly once with the sessionId', () => {
    const onCancelSession = vi.fn().mockResolvedValue(undefined);
    renderRow(
      baseProps({
        session: baseSession({ sessionId: 'session-abc', status: 'scheduled' }),
        isExpanded: true,
        onCancelSession,
      }),
    );

    clickButton(findButtonByText('Cancel this session'));
    expect(onCancelSession).not.toHaveBeenCalled();

    const confirmButton = findButtonByText('Cancel session');
    expect(confirmButton, 'expected the AlertDialog action button').toBeTruthy();
    clickButton(confirmButton);

    expect(onCancelSession).toHaveBeenCalledTimes(1);
    expect(onCancelSession).toHaveBeenCalledWith('session-abc');
  });

  it('renders no expected-attendee count anywhere in the scheduled expander (§0g)', () => {
    // A distinctive, non-plausible-copy number -- if `session.expectedCt`
    // were ever rendered, this exact digit string would appear somewhere in
    // the text (the AlertDialog's own real copy legitimately uses the word
    // "expected" in a sentence, so the count itself, not that word, is what
    // this test pins).
    renderRow(
      baseProps({
        session: baseSession({ status: 'scheduled', expectedCt: 918273 }),
        isExpanded: true,
      }),
    );
    expect(container.textContent).not.toContain('918273');
  });
});

// ---------------------------------------------------------------------------
// Criterion 12 -- canceled session.
// ---------------------------------------------------------------------------

describe('canceled session (criterion 12)', () => {
  it('renders exactly "Canceled — no attendance recorded." and no chips', () => {
    renderRow(baseProps({ session: baseSession({ status: 'canceled' }), isExpanded: true }));
    expect(container.textContent).toContain('Canceled — no attendance recorded.');
    expect(container.querySelectorAll('.astryx-badge').length).toBeGreaterThan(0); // status badge only
    expect(container.querySelector('[data-testid^="roster-row-"]')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Criterion 15 -- DES-12 four states for the roster region.
// ---------------------------------------------------------------------------

describe('completed session -- DES-12 four states (criterion 15)', () => {
  it('isRosterLoading renders Skeleton', () => {
    renderRow(
      baseProps({
        session: baseSession({ status: 'completed' }),
        isExpanded: true,
        isRosterLoading: true,
      }),
    );
    expect(container.querySelectorAll('.astryx-skeleton').length).toBeGreaterThan(0);
  });

  it('rosterError renders a Banner status="error"', () => {
    renderRow(
      baseProps({
        session: baseSession({ status: 'completed' }),
        isExpanded: true,
        rosterError: 'Could not load attendance.',
      }),
    );
    const banner = container.querySelector('.astryx-banner[data-status="error"]');
    expect(banner).toBeTruthy();
    expect(container.textContent).toContain('Could not load attendance.');
  });

  it('an empty roster array renders an EmptyState with one action', () => {
    const onEditSession = vi.fn();
    renderRow(
      baseProps({
        session: baseSession({ status: 'completed' }),
        isExpanded: true,
        roster: [],
        onEditSession,
      }),
    );
    expect(container.querySelector('.astryx-empty-state')).toBeTruthy();
    expect(findButtonByText('Edit session')).toBeTruthy();
  });

  it('a populated roster renders one chip per entry (criterion 21 -- from the injected roster prop)', () => {
    renderRow(
      baseProps({
        session: baseSession({ status: 'completed' }),
        isExpanded: true,
        roster: [
          rosterEntry({ studentId: 's1', displayName: 'Ada L.', status: 'present' }),
          rosterEntry({ studentId: 's2', displayName: 'Ben K.', status: null }),
        ],
      }),
    );
    expect(container.querySelector('[data-testid="roster-row-s1"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="roster-row-s2"]')).toBeTruthy();
    expect(container.textContent).toContain('Ada L.');
    expect(container.textContent).toContain('Ben K.');
  });
});

// ---------------------------------------------------------------------------
// Criterion 7 -- the five-field write.
// ---------------------------------------------------------------------------

describe('attendance write (criterion 7)', () => {
  it('calls onSetAttendanceStatus exactly once with exactly the five fields', () => {
    const onSetAttendanceStatus = vi.fn().mockResolvedValue({});
    renderRow(
      baseProps({
        session: baseSession({ status: 'completed', sessionId: 'session-9' }),
        isExpanded: true,
        roster: [rosterEntry({ studentId: 'student-9', displayName: 'Ada L.', status: null })],
        onSetAttendanceStatus,
        recordedBy: 'coach-1',
        canSetExcused: true,
      }),
    );
    const chipButton = container.querySelector('[data-testid="roster-row-student-9"] button');
    expect(chipButton).toBeTruthy();
    act(() => {
      (chipButton as HTMLButtonElement).dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(onSetAttendanceStatus).toHaveBeenCalledTimes(1);
    expect(onSetAttendanceStatus).toHaveBeenCalledWith({
      sessionId: 'session-9',
      studentId: 'student-9',
      status: 'present',
      method: 'coach',
      recordedBy: 'coach-1',
    });
  });
});

// ---------------------------------------------------------------------------
// Criterion 8 -- reaching (unset) calls onRemoveAttendance, not a status write.
// ---------------------------------------------------------------------------

describe('the (unset) stop (criterion 8)', () => {
  it('calls onRemoveAttendance exactly once with { sessionId, studentId }, never onSetAttendanceStatus', () => {
    const onSetAttendanceStatus = vi.fn().mockResolvedValue({});
    const onRemoveAttendance = vi.fn().mockResolvedValue(undefined);
    renderRow(
      baseProps({
        session: baseSession({ status: 'completed', sessionId: 'session-9' }),
        isExpanded: true,
        roster: [rosterEntry({ studentId: 'student-9', displayName: 'Ada L.', status: 'absent' })],
        onSetAttendanceStatus,
        onRemoveAttendance,
        recordedBy: 'coach-1',
        canSetExcused: true,
      }),
    );
    const chipButton = container.querySelector(
      '[data-testid="roster-row-student-9"] button',
    ) as HTMLButtonElement;
    act(() => {
      chipButton.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(onRemoveAttendance).toHaveBeenCalledTimes(1);
    expect(onRemoveAttendance).toHaveBeenCalledWith({
      sessionId: 'session-9',
      studentId: 'student-9',
    });
    expect(onSetAttendanceStatus).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Criterion 9 -- optimistic rollback.
// ---------------------------------------------------------------------------

describe('optimistic rollback (criterion 9)', () => {
  it('a rejecting onSetAttendanceStatus restores the previous status in the DOM', async () => {
    const onSetAttendanceStatus = vi.fn().mockRejectedValue(new Error('network down'));
    renderRow(
      baseProps({
        session: baseSession({ status: 'completed' }),
        isExpanded: true,
        roster: [rosterEntry({ studentId: 'student-9', displayName: 'Ada L.', status: null })],
        onSetAttendanceStatus,
        recordedBy: 'coach-1',
      }),
    );
    const chipButton = () =>
      container.querySelector('[data-testid="roster-row-student-9"] button') as HTMLButtonElement;

    expect(chipButton().getAttribute('aria-label')).toBe('Ada L., not recorded');
    act(() => {
      chipButton().dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    // Optimistic: the chip already reads "present" before the write settles.
    expect(chipButton().getAttribute('aria-label')).toBe('Ada L., present');

    await flushMicrotasks();

    // Rolled back to the pre-write value after rejection.
    expect(chipButton().getAttribute('aria-label')).toBe('Ada L., not recorded');
    expect(container.textContent).toContain("couldn't be saved");
  });
});

// ---------------------------------------------------------------------------
// Rework defect 1 -- `statusById[id] ?? entry.status` silently discarded a
// local `null` (unset) override and fell back to the stale server value.
// This walks the FULL five-stop loop starting from a NON-NULL roster status
// on the real assembled `SessionRow` (not `AttendanceChips` in isolation --
// criterion 3's own test hand-feeds a status prop, which is exactly why it
// could not catch this), asserting the DOM accessible name after the unset
// tap and after the following tap.
// ---------------------------------------------------------------------------

describe('local unset is not overwritten by the stale server status (rework defect 1)', () => {
  it('reads "…, not recorded" after the unset tap, then "…, present" after the next tap', () => {
    const onSetAttendanceStatus = vi.fn().mockResolvedValue({});
    const onRemoveAttendance = vi.fn().mockResolvedValue(undefined);
    renderRow(
      baseProps({
        session: baseSession({ status: 'completed', sessionId: 'session-9' }),
        isExpanded: true,
        roster: [rosterEntry({ studentId: 'student-9', displayName: 'Ada L.', status: 'absent' })],
        onSetAttendanceStatus,
        onRemoveAttendance,
        recordedBy: 'coach-1',
      }),
    );
    const chipButton = () =>
      container.querySelector('[data-testid="roster-row-student-9"] button') as HTMLButtonElement;

    // BEFORE -- server-supplied 'absent'.
    expect(chipButton().getAttribute('aria-label')).toBe('Ada L., absent');

    // tap 1: absent -> (unset). Calls onRemoveAttendance, and the local
    // `null` override must stick, not fall back to the server's 'absent'.
    act(() => {
      chipButton().dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(onRemoveAttendance).toHaveBeenCalledTimes(1);
    expect(chipButton().getAttribute('aria-label')).toBe('Ada L., not recorded');

    // tap 2: (unset) -> present. The cycle must have actually closed and
    // advanced, not silently repeated the same "absent" server value.
    act(() => {
      chipButton().dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(onSetAttendanceStatus).toHaveBeenCalledTimes(1);
    expect(onSetAttendanceStatus.mock.calls[0][0]).toMatchObject({ status: 'present' });
    expect(chipButton().getAttribute('aria-label')).toBe('Ada L., present');
    expect(onRemoveAttendance).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// Criterion 10 -- recordedBy absent -> disabled, no write.
// ---------------------------------------------------------------------------

describe('recordedBy absent (criterion 10)', () => {
  it('renders the chip disabled and emits no write on click', () => {
    const onSetAttendanceStatus = vi.fn();
    renderRow(
      baseProps({
        session: baseSession({ status: 'completed' }),
        isExpanded: true,
        roster: [rosterEntry({ studentId: 'student-9', displayName: 'Ada L.', status: null })],
        onSetAttendanceStatus,
        recordedBy: undefined,
      }),
    );
    const chipButton = container.querySelector(
      '[data-testid="roster-row-student-9"] button',
    ) as HTMLButtonElement;
    expect(chipButton.disabled).toBe(true);
    act(() => {
      chipButton.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(onSetAttendanceStatus).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Criterion 5 -- DES-17 direct-set keys 1-4, and roving tabindex.
// ---------------------------------------------------------------------------

describe('DES-17 roving tabindex + digit keys (criterion 5)', () => {
  function renderTwoStudentRoster(overrides: Partial<SessionRowProps> = {}): {
    onSetAttendanceStatus: ReturnType<typeof vi.fn>;
  } {
    const onSetAttendanceStatus = vi.fn().mockResolvedValue({});
    renderRow(
      baseProps({
        session: baseSession({ status: 'completed', sessionId: 'session-9' }),
        isExpanded: true,
        roster: [
          rosterEntry({ studentId: 'student-a', displayName: 'Ada L.', status: null }),
          rosterEntry({ studentId: 'student-b', displayName: 'Ben K.', status: null }),
        ],
        onSetAttendanceStatus,
        recordedBy: 'coach-1',
        canSetExcused: true,
        ...overrides,
      }),
    );
    return { onSetAttendanceStatus };
  }

  it('exactly one roster row has tabIndex=0 at a time; ArrowDown moves it', () => {
    renderTwoStudentRoster();
    const rowA = container.querySelector('[data-testid="roster-row-student-a"]') as HTMLElement;
    const rowB = container.querySelector('[data-testid="roster-row-student-b"]') as HTMLElement;
    expect(rowA.tabIndex).toBe(0);
    expect(rowB.tabIndex).toBe(-1);

    act(() => {
      rowA.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true }),
      );
    });
    expect(rowA.tabIndex).toBe(-1);
    expect(rowB.tabIndex).toBe(0);
  });

  it.each([
    ['1', 'present'],
    ['2', 'late'],
    ['3', 'excused'],
    ['4', 'absent'],
  ] as const)('key %s sets %s directly on the focused row, without cycling', (key, status) => {
    const { onSetAttendanceStatus } = renderTwoStudentRoster();
    const rowA = container.querySelector('[data-testid="roster-row-student-a"]') as HTMLElement;

    act(() => {
      rowA.dispatchEvent(
        new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }),
      );
    });
    expect(onSetAttendanceStatus).toHaveBeenCalledTimes(1);
    expect(onSetAttendanceStatus.mock.calls[0][0]).toMatchObject({
      studentId: 'student-a',
      status,
    });
  });

  it('ArrowUp moves the roving tab stop backward', () => {
    renderTwoStudentRoster();
    const rowA = container.querySelector('[data-testid="roster-row-student-a"]') as HTMLElement;
    const rowB = container.querySelector('[data-testid="roster-row-student-b"]') as HTMLElement;

    // Move forward to row B first, then back up to row A.
    act(() => {
      rowA.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true }),
      );
    });
    expect(rowB.tabIndex).toBe(0);

    act(() => {
      rowB.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true, cancelable: true }),
      );
    });
    expect(rowA.tabIndex).toBe(0);
    expect(rowB.tabIndex).toBe(-1);
  });

  it('a digit key fired while focus is on the descendant chip still lands (bubbling)', () => {
    const { onSetAttendanceStatus } = renderTwoStudentRoster();
    const chipButton = container.querySelector(
      '[data-testid="roster-row-student-a"] button',
    ) as HTMLButtonElement;

    act(() => {
      chipButton.dispatchEvent(
        new KeyboardEvent('keydown', { key: '1', bubbles: true, cancelable: true }),
      );
    });
    expect(onSetAttendanceStatus).toHaveBeenCalledTimes(1);
    expect(onSetAttendanceStatus.mock.calls[0][0]).toMatchObject({
      studentId: 'student-a',
      status: 'present',
    });
  });
});

// ---------------------------------------------------------------------------
// Criterion 16 -- canSetExcused: false (default) skips Excused; defence in
// depth blocks a direct handler call too.
// ---------------------------------------------------------------------------

describe('canSetExcused default false (criterion 16)', () => {
  it('key 3 (Excused) emits no write when canSetExcused is false (the default)', () => {
    const onSetAttendanceStatus = vi.fn();
    renderRow(
      baseProps({
        session: baseSession({ status: 'completed' }),
        isExpanded: true,
        roster: [rosterEntry({ studentId: 'student-a', displayName: 'Ada L.', status: null })],
        onSetAttendanceStatus,
        recordedBy: 'coach-1',
        // canSetExcused omitted -- defaults to false.
      }),
    );
    const rowA = container.querySelector('[data-testid="roster-row-student-a"]') as HTMLElement;
    act(() => {
      rowA.dispatchEvent(
        new KeyboardEvent('keydown', { key: '3', bubbles: true, cancelable: true }),
      );
    });
    expect(onSetAttendanceStatus).not.toHaveBeenCalled();
  });

  it("the cycle's forward stops skip Excused entirely: Late -> Absent directly", () => {
    const onSetAttendanceStatus = vi.fn().mockResolvedValue({});
    renderRow(
      baseProps({
        session: baseSession({ status: 'completed' }),
        isExpanded: true,
        roster: [rosterEntry({ studentId: 'student-a', displayName: 'Ada L.', status: 'late' })],
        onSetAttendanceStatus,
        recordedBy: 'coach-1',
      }),
    );
    const chipButton = container.querySelector(
      '[data-testid="roster-row-student-a"] button',
    ) as HTMLButtonElement;
    act(() => {
      chipButton.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(onSetAttendanceStatus).toHaveBeenCalledTimes(1);
    expect(onSetAttendanceStatus.mock.calls[0][0]).toMatchObject({ status: 'absent' });
  });
});

// ---------------------------------------------------------------------------
// Criterion 17 -- no expectedCt rendered anywhere.
// ---------------------------------------------------------------------------

describe('expectedCt is never rendered (criterion 17, §0g)', () => {
  it('a large, distinctive expectedCt value never appears in the rendered text, in any session status', () => {
    for (const status of ['scheduled', 'completed', 'canceled'] as const) {
      renderRow(
        baseProps({
          session: baseSession({ status, expectedCt: 987654 }),
          isExpanded: true,
          roster: [],
        }),
      );
      expect(container.textContent).not.toContain('987654');
    }
  });
});

// ---------------------------------------------------------------------------
// Criteria 13/14 -- grep-provable: no mutation code, no wrong write seam.
// ---------------------------------------------------------------------------

describe('no direct mutation code', () => {
  it('never names the wrong write seam (§0e) and never calls a Supabase mutation directly', () => {
    const source = sessionRowSource;
    expect(source).not.toContain('makeOnEditAttendance');
    expect(source).not.toContain('.from(');
    expect(source).not.toContain('.upsert(');
    expect(source).not.toContain('.update(');
    expect(source).not.toContain('.insert(');
    expect(source).not.toContain('.delete(');
    expect(source).not.toContain('getSupabaseClient');
  });
});
