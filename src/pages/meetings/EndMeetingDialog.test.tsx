// @vitest-environment jsdom
/**
 * T036: tests for `EndMeetingDialog.tsx`.
 *
 * Per this task's Allowed Files ("A colocated `EndMeetingDialog.test.tsx` is
 * acceptable per established precedent") this is a deliberate, disclosed
 * addition, the same class of addition `SeasonSettings.test.tsx`/T029,
 * `InvitesTab.test.tsx`/T027, and `LiveConsole.test.tsx`/T033 already made in
 * this same project -- existing specifically to produce the packet's own
 * "Required Worker Output" proof requirements:
 *
 *   1. Real proof of the confirm flow: the real `AlertDialog` opens with the
 *      live tally + backfill/checkout callouts, `onEndMeeting` is not called
 *      until the dialog's own action button is clicked, and confirming calls
 *      it exactly once with the single atomic `EndMeetingPayload` (module doc
 *      section 1) -- naming the correct backfill and checkout student id
 *      lists derived from the fixture data.
 *   2. Real proof of the summary-count accuracy (module doc section 3): the
 *      pre-confirm tally reflects only currently-recorded rows, and a
 *      separate sentence discloses the about-to-be-backfilled count.
 *   3. Real proof of the post-completion correction path (module doc section
 *      2b): after the meeting ends, editing a row's status calls
 *      `onEditAttendance` with a plain `(sessionId, studentId, status)` --
 *      never touching `audit_log` anywhere, matching the file's own
 *      grep-provable non-duplication property.
 *   4. Pure-function proof for every helper the confirm/summary/edit paths
 *      are built from.
 *
 * No `@testing-library/react` is installed in this repo (confirmed via
 * `package.json`) -- these tests use the same raw `createRoot`/`act` pattern
 * every prior content-page test file in this project already established.
 */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  applyEndMeetingResult,
  buildEndMeetingConfirmDescription,
  buildEndMeetingPayload,
  computeBackfillAbsentStudentIds,
  computeCheckoutStudentIds,
  computeEndMeetingSummaryCounts,
  computeNoRecordCount,
  EndMeetingDialog,
  formatEndMeetingSummaryLine,
  type AttendanceRecordState,
  type EndMeetingRosterEntry,
  type EndMeetingSessionInfo,
  type EndMeetingSummaryData,
} from './EndMeetingDialog';

// ---------------------------------------------------------------------------
// jsdom gap: `AlertDialog` renders a native `<dialog>` and calls
// `HTMLDialogElement.prototype.showModal()`, which this repo's installed
// jsdom does not implement -- same guarded, test-file-local polyfill
// `SeasonSettings.test.tsx`/`MeetingsList.test.tsx`/`LiveConsole.test.tsx`
// already established.
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
// Render harness.
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
});

function renderDialog(props: Parameters<typeof EndMeetingDialog>[0]): void {
  act(() => {
    root.render(<EndMeetingDialog {...props} />);
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

function clickButton(button: HTMLButtonElement): void {
  act(() => {
    button.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
}

function clickButtonWithText(text: string): void {
  const button = findButtonByText(text);
  expect(button, `expected a <button> with text "${text}"`).toBeTruthy();
  clickButton(button as HTMLButtonElement);
}

/** Finds a specific student's radio group by its `label` ("Attendance for
 * <name>"), used as the real `aria-label` on the `SegmentedControl`'s own
 * `role="radiogroup"` root (`SegmentedControl.js` line 199). */
function findAttendanceRadioGroup(name: string): HTMLElement {
  const group = document.querySelector(`[role="radiogroup"][aria-label="Attendance for ${name}"]`);
  expect(group, `expected a radiogroup for "Attendance for ${name}"`).toBeTruthy();
  return group as HTMLElement;
}

/** `SegmentedControlItem.js`: each option is a real `<button role="radio"
 * data-value="...">`. */
function clickAttendanceOption(name: string, value: string): void {
  const group = findAttendanceRadioGroup(name);
  const option = group.querySelector(`[data-value="${value}"]`);
  expect(option, `expected a radio option "${value}" for "${name}"`).toBeTruthy();
  clickButton(option as HTMLButtonElement);
}

// ---------------------------------------------------------------------------
// Fixture builders -- distinct, obviously-fabricated data from the shipped
// default fixture (constitution item 6), so tests exercise real injected
// data rather than only the shipped default.
// ---------------------------------------------------------------------------

const TEST_SESSION: EndMeetingSessionInfo = {
  id: 'session-test-001',
  title: 'Thursday Scrimmage Prep',
  endsAt: '2026-07-23T02:00:00.000Z',
  status: 'scheduled',
};

const TEST_ROSTER: EndMeetingRosterEntry[] = [
  { studentId: 'student-fox', name: 'Fox K.' },
  { studentId: 'student-gwen', name: 'Gwen L.' },
  { studentId: 'student-hal', name: 'Hal S.' },
  { studentId: 'student-ivy', name: 'Ivy P.' },
];

const TEST_ATTENDANCE: Record<string, AttendanceRecordState> = {
  'student-fox': {
    status: 'present',
    checkInAt: '2026-07-23T01:05:00.000Z',
    checkOutAt: null, // open check-in -- should be checked out on confirm.
    method: 'qr',
    recordedBy: null,
  },
  'student-gwen': {
    status: 'excused',
    checkInAt: null,
    checkOutAt: null,
    method: 'coach',
    recordedBy: 'fixture-coach',
  },
  // student-hal: deliberately no attendance row -- should be backfilled absent.
  'student-ivy': {
    status: 'late',
    checkInAt: '2026-07-23T01:30:00.000Z',
    checkOutAt: '2026-07-23T02:00:00.000Z', // already checked out.
    method: 'coach',
    recordedBy: 'fixture-coach',
  },
};

function testSummary(overrides: Partial<EndMeetingSummaryData> = {}): EndMeetingSummaryData {
  return {
    session: TEST_SESSION,
    roster: TEST_ROSTER,
    attendanceByStudentId: TEST_ATTENDANCE,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Pure-function tests.
// ---------------------------------------------------------------------------

describe('computeBackfillAbsentStudentIds (module doc section 1b)', () => {
  it('returns only roster members with zero attendance row', () => {
    expect(computeBackfillAbsentStudentIds(TEST_ROSTER, TEST_ATTENDANCE)).toEqual(['student-hal']);
  });

  it('returns an empty array when every roster member has a record', () => {
    const complete = { ...TEST_ATTENDANCE, 'student-hal': TEST_ATTENDANCE['student-fox'] };
    expect(computeBackfillAbsentStudentIds(TEST_ROSTER, complete)).toEqual([]);
  });
});

describe('computeCheckoutStudentIds (module doc section 1c)', () => {
  it('returns only present/late rows with check_in_at set and check_out_at still null', () => {
    expect(computeCheckoutStudentIds(TEST_ATTENDANCE)).toEqual(['student-fox']);
  });

  it('excludes excused rows (no check_in_at) and already-checked-out rows', () => {
    expect(computeCheckoutStudentIds(TEST_ATTENDANCE)).not.toContain('student-gwen');
    expect(computeCheckoutStudentIds(TEST_ATTENDANCE)).not.toContain('student-ivy');
  });
});

describe('buildEndMeetingPayload (module doc section 1 -- the atomicity contract)', () => {
  it('names the session, endsAt, and both id lists in ONE payload', () => {
    expect(buildEndMeetingPayload(TEST_SESSION, TEST_ROSTER, TEST_ATTENDANCE)).toEqual({
      sessionId: 'session-test-001',
      endsAt: '2026-07-23T02:00:00.000Z',
      backfillAbsentStudentIds: ['student-hal'],
      checkoutStudentIds: ['student-fox'],
    });
  });
});

describe('applyEndMeetingResult (module doc section 1 -- local-state mirror)', () => {
  it('backfills absent rows and stamps check_out_at, leaving unrelated rows untouched', () => {
    const payload = buildEndMeetingPayload(TEST_SESSION, TEST_ROSTER, TEST_ATTENDANCE);
    const next = applyEndMeetingResult(TEST_ATTENDANCE, payload);

    expect(next['student-hal']).toEqual({
      status: 'absent',
      checkInAt: null,
      checkOutAt: null,
      method: 'coach',
      recordedBy: null,
    });
    expect(next['student-fox'].checkOutAt).toBe('2026-07-23T02:00:00.000Z');
    expect(next['student-fox'].status).toBe('present'); // status itself is untouched by checkout.
    expect(next['student-gwen']).toEqual(TEST_ATTENDANCE['student-gwen']); // untouched.
    expect(next['student-ivy']).toEqual(TEST_ATTENDANCE['student-ivy']); // untouched.
  });
});

describe('computeEndMeetingSummaryCounts / formatEndMeetingSummaryLine (module doc section 3)', () => {
  it('tallies only currently-recorded rows, grouped by status', () => {
    expect(computeEndMeetingSummaryCounts(TEST_ROSTER, TEST_ATTENDANCE)).toEqual({
      present: 1,
      late: 1,
      excused: 1,
      absent: 0,
    });
  });

  it("formats the packet's own literal tally shape", () => {
    expect(formatEndMeetingSummaryLine({ present: 14, late: 2, excused: 1, absent: 1 })).toBe(
      '14 present · 2 late · 1 excused · 1 absent',
    );
  });

  it('does NOT fold the about-to-be-backfilled student into the tally', () => {
    const counts = computeEndMeetingSummaryCounts(TEST_ROSTER, TEST_ATTENDANCE);
    expect(counts.present + counts.late + counts.excused + counts.absent).toBe(3); // not 4 -- student-hal excluded.
  });
});

describe('computeNoRecordCount / buildEndMeetingConfirmDescription (module doc section 3)', () => {
  it('counts the roster members with no record separately from the tally', () => {
    expect(computeNoRecordCount(TEST_ROSTER, TEST_ATTENDANCE)).toBe(1);
  });

  it('includes the live tally, the no-record callout, and the checkout callout', () => {
    const description = buildEndMeetingConfirmDescription(TEST_ROSTER, TEST_ATTENDANCE);
    expect(description).toContain('1 present · 1 late · 1 excused · 0 absent');
    expect(description).toContain('1 student has no attendance record yet');
    expect(description).toContain('will be marked absent');
    expect(description).toContain('1 open check-in will be checked out');
  });

  it('omits the no-record/checkout sentences entirely when there is nothing to disclose', () => {
    const complete: Record<string, AttendanceRecordState> = {
      'student-fox': { ...TEST_ATTENDANCE['student-fox'], checkOutAt: '2026-07-23T02:00:00.000Z' },
      'student-gwen': TEST_ATTENDANCE['student-gwen'],
      'student-hal': TEST_ATTENDANCE['student-ivy'],
      'student-ivy': TEST_ATTENDANCE['student-ivy'],
    };
    const description = buildEndMeetingConfirmDescription(TEST_ROSTER, complete);
    expect(description).not.toContain('no attendance record yet');
    expect(description).not.toContain('checked out at');
  });
});

// ---------------------------------------------------------------------------
// Render tests -- DES-12 states.
// ---------------------------------------------------------------------------

describe('<EndMeetingDialog /> DES-12 states', () => {
  it('shows a loading spinner before data resolves', () => {
    renderDialog({ sessionId: 'session-test-001', loadSummary: () => new Promise(() => {}) });
    expect(document.body.textContent).toContain('Loading meeting summary');
  });

  it('shows an error banner when loadSummary rejects', async () => {
    renderDialog({
      sessionId: 'session-test-001',
      loadSummary: () => Promise.reject(new Error('network down')),
    });
    await flushMicrotasks();
    expect(document.body.textContent).toContain("Couldn't load this meeting");
  });
});

// ---------------------------------------------------------------------------
// Render tests -- the confirm flow (module docs sections 1/2a/3).
// ---------------------------------------------------------------------------

describe('<EndMeetingDialog /> End meeting confirm flow', () => {
  it('opens a real AlertDialog with the live tally and disclosure sentences, and does not call onEndMeeting before confirm', async () => {
    const onEndMeeting = vi.fn().mockResolvedValue(undefined);
    renderDialog({
      sessionId: 'session-test-001',
      loadSummary: () => Promise.resolve(testSummary()),
      onEndMeeting,
    });
    await flushMicrotasks();

    clickButtonWithText('End meeting');

    expect(document.body.textContent).toContain('End this meeting?');
    expect(document.body.textContent).toContain('1 present · 1 late · 1 excused · 0 absent');
    expect(document.body.textContent).toContain('1 student has no attendance record yet');
    expect(document.body.textContent).toContain('1 open check-in will be checked out');
    expect(onEndMeeting).not.toHaveBeenCalled();
  });

  it('confirming calls onEndMeeting exactly once with the single atomic payload, then flips to completed', async () => {
    const onEndMeeting = vi.fn().mockResolvedValue(undefined);
    renderDialog({
      sessionId: 'session-test-001',
      loadSummary: () => Promise.resolve(testSummary()),
      onEndMeeting,
    });
    await flushMicrotasks();

    clickButtonWithText('End meeting'); // opens the AlertDialog.
    // The AlertDialog's own action button shares the same visible label
    // ("End meeting") -- `clickButtonWithText` matches the LAST such button
    // in document order, which is the AlertDialog's action button (rendered
    // after the trigger). Disambiguate explicitly via the dialog root to
    // avoid relying on that ordering.
    const dialogEl = document.querySelector('dialog[open]') as HTMLElement;
    expect(dialogEl).toBeTruthy();
    const actionButton = Array.from(dialogEl.querySelectorAll('button')).find(
      (button) => button.textContent?.trim() === 'End meeting',
    );
    expect(actionButton).toBeTruthy();
    clickButton(actionButton as HTMLButtonElement);
    await flushMicrotasks();

    expect(onEndMeeting).toHaveBeenCalledTimes(1);
    expect(onEndMeeting).toHaveBeenCalledWith({
      sessionId: 'session-test-001',
      endsAt: '2026-07-23T02:00:00.000Z',
      backfillAbsentStudentIds: ['student-hal'],
      checkoutStudentIds: ['student-fox'],
    });

    // The dialog is gone (session flipped to completed) and the trigger
    // button no longer renders.
    expect(findButtonByText('End meeting')).toBeUndefined();
    expect(document.body.textContent).toContain('This meeting has ended');

    // Backfilled + checked-out state is reflected in the post-completion list.
    expect(document.body.textContent).toContain('Hal S.'); // the backfilled student is listed.
    const halGroup = findAttendanceRadioGroup('Hal S.');
    const absentOption = halGroup.querySelector('[data-value="absent"]');
    expect(absentOption?.getAttribute('aria-checked')).toBe('true');
  });

  it('shows an error banner and leaves the session unflipped when onEndMeeting rejects', async () => {
    const onEndMeeting = vi.fn().mockRejectedValue(new Error('write failed'));
    renderDialog({
      sessionId: 'session-test-001',
      loadSummary: () => Promise.resolve(testSummary()),
      onEndMeeting,
    });
    await flushMicrotasks();

    clickButtonWithText('End meeting');
    const dialogEl = document.querySelector('dialog[open]') as HTMLElement;
    const actionButton = Array.from(dialogEl.querySelectorAll('button')).find(
      (button) => button.textContent?.trim() === 'End meeting',
    );
    clickButton(actionButton as HTMLButtonElement);
    await flushMicrotasks();

    expect(document.body.textContent).toContain("Couldn't end this meeting");
    expect(document.body.textContent).toContain('write failed');
    // Session was never flipped -- the trigger button (not the completed
    // banner) is still present.
    expect(findButtonByText('End meeting')).toBeTruthy();
    expect(document.body.textContent).not.toContain('This meeting has ended');
  });
});

// ---------------------------------------------------------------------------
// Render tests -- post-completion attendance correction (module doc section
// 2b -- the trigger-reliance path, no client-side audit_log write).
// ---------------------------------------------------------------------------

describe('<EndMeetingDialog /> post-completion attendance correction', () => {
  const COMPLETED_SESSION: EndMeetingSessionInfo = { ...TEST_SESSION, status: 'completed' };

  it('renders an editable list and calls onEditAttendance with a plain (sessionId, studentId, status) tuple on change', async () => {
    const onEditAttendance = vi.fn().mockResolvedValue(undefined);
    renderDialog({
      sessionId: 'session-test-001',
      loadSummary: () => Promise.resolve(testSummary({ session: COMPLETED_SESSION })),
      onEditAttendance,
    });
    await flushMicrotasks();

    expect(document.body.textContent).toContain('This meeting has ended');
    clickAttendanceOption('Fox K.', 'late');
    await flushMicrotasks();

    expect(onEditAttendance).toHaveBeenCalledTimes(1);
    expect(onEditAttendance).toHaveBeenCalledWith('session-test-001', 'student-fox', 'late');

    // Optimistic local update reflected immediately.
    const foxGroup = findAttendanceRadioGroup('Fox K.');
    expect(foxGroup.querySelector('[data-value="late"]')?.getAttribute('aria-checked')).toBe(
      'true',
    );
  });

  it('reverts the optimistic update and shows an error banner when onEditAttendance rejects', async () => {
    const onEditAttendance = vi.fn().mockRejectedValue(new Error('update rejected'));
    renderDialog({
      sessionId: 'session-test-001',
      loadSummary: () => Promise.resolve(testSummary({ session: COMPLETED_SESSION })),
      onEditAttendance,
    });
    await flushMicrotasks();

    clickAttendanceOption('Gwen L.', 'present');
    await flushMicrotasks();

    expect(document.body.textContent).toContain("Couldn't save attendance change");
    const gwenGroup = findAttendanceRadioGroup('Gwen L.');
    // Reverted back to the original 'excused' status.
    expect(gwenGroup.querySelector('[data-value="excused"]')?.getAttribute('aria-checked')).toBe(
      'true',
    );
    expect(gwenGroup.querySelector('[data-value="present"]')?.getAttribute('aria-checked')).toBe(
      'false',
    );
  });

  it('never renders the "End meeting" trigger for an already-completed session', async () => {
    renderDialog({
      sessionId: 'session-test-001',
      loadSummary: () => Promise.resolve(testSummary({ session: COMPLETED_SESSION })),
    });
    await flushMicrotasks();
    expect(findButtonByText('End meeting')).toBeUndefined();
  });
});

describe('<EndMeetingDialog /> canceled session', () => {
  it('shows an info banner and no attendance actions', async () => {
    renderDialog({
      sessionId: 'session-test-001',
      loadSummary: () =>
        Promise.resolve(testSummary({ session: { ...TEST_SESSION, status: 'canceled' } })),
    });
    await flushMicrotasks();

    expect(document.body.textContent).toContain('This meeting was canceled');
    expect(findButtonByText('End meeting')).toBeUndefined();
    expect(document.querySelector('[role="radiogroup"]')).toBeNull();
  });
});
