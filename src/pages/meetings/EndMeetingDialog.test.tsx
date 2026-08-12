// @vitest-environment jsdom
/**
 * T036: tests for `EndMeetingDialog.tsx`. T508 UPDATED: three tests here
 * encoded the OLD unconditional-absence-write behaviour and were re-derived
 * deliberately (never deleted) -- see each one's own "T508 RE-DERIVED"
 * comment for what changed and why. C3-C9 coverage for the new opt-in
 * checkbox / renamed payload / roster-independent tally is added per this
 * task's Allowed Files table.
 *
 * Per this task's Allowed Files ("A colocated `EndMeetingDialog.test.tsx` is
 * acceptable per established precedent") this is a deliberate, disclosed
 * addition, the same class of addition `SeasonSettings.test.tsx`/T029,
 * `InvitesTab.test.tsx`/T027, and `LiveConsole.test.tsx`/T033 already made in
 * this same project -- existing specifically to produce the packet's own
 * "Required Worker Output" proof requirements:
 *
 *   1. Real proof of the confirm flow: the real `AlertDialog` opens with the
 *      live tally + mark-absent/checkout callouts, `onEndMeeting` is not
 *      called until the dialog's own action button is clicked, and
 *      confirming calls it exactly once with the single atomic
 *      `EndMeetingPayload` (module doc section 1) -- naming the correct
 *      `markAbsentStudentIds`/`checkoutStudentIds` lists derived from the
 *      fixture data AND the coach's own opt-in choice (section 1a).
 *   2. Real proof of the summary-count accuracy (module doc section 3): the
 *      pre-confirm tally reflects every real record directly (not just
 *      roster members, T508), and a separate sentence discloses the
 *      no-record count worded by the coach's own opt-in choice -- never the
 *      marked-absent claim unconditionally.
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
import { SupabaseNotConfiguredError } from '../../lib/supabase/client';
import {
  applyEndMeetingResult,
  buildEndMeetingConfirmDescription,
  buildEndMeetingPayload,
  buildMarkRemainingAbsentLabel,
  computeCheckoutStudentIds,
  computeEndMeetingSummaryCounts,
  computeNoRecordCount,
  computeUnmarkedStudentIds,
  describeEndMeetingFailure,
  END_MEETING_FAILURE_MESSAGE,
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

/** Section 1a: `CheckboxInput` renders a real `<input type="checkbox">`
 * (same resolution pattern `AdminToggles.test.tsx`/`SettingsPage.test.tsx`
 * already use for Astryx checkbox-shaped controls in this repo). */
function findMarkRemainingAbsentCheckbox(): HTMLInputElement {
  const input = document.querySelector('input[type="checkbox"]');
  expect(input, 'expected the opt-in CheckboxInput to render').toBeTruthy();
  return input as HTMLInputElement;
}

function clickMarkRemainingAbsentCheckbox(): void {
  const input = findMarkRemainingAbsentCheckbox();
  act(() => {
    input.click();
  });
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

// T508: TWO roster members have no attendance row (`student-hal`,
// `student-jet`), not one -- so the opt-in checkbox's plural label/count and
// the "assert against the SECOND unmarked member, not just the first" fixture
// design requirement are both exercisable. `student-jet` sits AFTER
// `student-ivy` (mid/end of the list, not adjacent to `student-hal`) so a
// test that only checked "the first unmarked id" would not accidentally pass.
const TEST_ROSTER: EndMeetingRosterEntry[] = [
  { studentId: 'student-fox', name: 'Fox K.' },
  { studentId: 'student-gwen', name: 'Gwen L.' },
  { studentId: 'student-hal', name: 'Hal S.' },
  { studentId: 'student-ivy', name: 'Ivy P.' },
  { studentId: 'student-jet', name: 'Jet Q.' },
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
  // student-hal: deliberately no attendance row -- unmarked candidate #1.
  'student-ivy': {
    status: 'late',
    checkInAt: '2026-07-23T01:30:00.000Z',
    checkOutAt: '2026-07-23T02:00:00.000Z', // already checked out.
    method: 'coach',
    recordedBy: 'fixture-coach',
  },
  // student-jet: deliberately no attendance row -- unmarked candidate #2,
  // mid/end of the roster, not adjacent to student-hal.
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

describe('computeUnmarkedStudentIds (module doc section 1b, renamed from computeBackfillAbsentStudentIds)', () => {
  it('returns only roster members with zero attendance row -- including the SECOND unmarked member', () => {
    expect(computeUnmarkedStudentIds(TEST_ROSTER, TEST_ATTENDANCE)).toEqual([
      'student-hal',
      'student-jet',
    ]);
  });

  it('returns an empty array when every roster member has a record', () => {
    const complete = {
      ...TEST_ATTENDANCE,
      'student-hal': TEST_ATTENDANCE['student-fox'],
      'student-jet': TEST_ATTENDANCE['student-fox'],
    };
    expect(computeUnmarkedStudentIds(TEST_ROSTER, complete)).toEqual([]);
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

describe('buildEndMeetingPayload (module doc section 1/1a -- the atomicity contract)', () => {
  it('C3: markRemainingAbsent=false yields an EMPTY markAbsentStudentIds even though two roster members are unmarked', () => {
    expect(buildEndMeetingPayload(TEST_SESSION, TEST_ROSTER, TEST_ATTENDANCE, false)).toEqual({
      sessionId: 'session-test-001',
      endsAt: '2026-07-23T02:00:00.000Z',
      markAbsentStudentIds: [],
      checkoutStudentIds: ['student-fox'],
    });
  });

  it('C3: markRemainingAbsent=true yields exactly the unmarked roster members, including the SECOND one', () => {
    expect(buildEndMeetingPayload(TEST_SESSION, TEST_ROSTER, TEST_ATTENDANCE, true)).toEqual({
      sessionId: 'session-test-001',
      endsAt: '2026-07-23T02:00:00.000Z',
      markAbsentStudentIds: ['student-hal', 'student-jet'],
      checkoutStudentIds: ['student-fox'],
    });
  });
});

describe('applyEndMeetingResult (module doc section 1 -- local-state mirror)', () => {
  it('marks absent every opted-in student and stamps check_out_at, leaving unrelated rows untouched', () => {
    const payload = buildEndMeetingPayload(TEST_SESSION, TEST_ROSTER, TEST_ATTENDANCE, true);
    const next = applyEndMeetingResult(TEST_ATTENDANCE, payload);

    expect(next['student-hal']).toEqual({
      status: 'absent',
      checkInAt: null,
      checkOutAt: null,
      method: 'coach',
      recordedBy: null,
    });
    // The SECOND marked student, not just the first -- both must land.
    expect(next['student-jet']).toEqual({
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

  it('marks nobody absent when markRemainingAbsent is false, even though two roster members are unmarked (checkout still applies)', () => {
    const payload = buildEndMeetingPayload(TEST_SESSION, TEST_ROSTER, TEST_ATTENDANCE, false);
    const next = applyEndMeetingResult(TEST_ATTENDANCE, payload);

    expect(next['student-hal']).toBeUndefined();
    expect(next['student-jet']).toBeUndefined();
    expect(next['student-fox'].checkOutAt).toBe('2026-07-23T02:00:00.000Z');
  });
});

describe('computeEndMeetingSummaryCounts / formatEndMeetingSummaryLine (module doc section 3)', () => {
  it('tallies only currently-recorded rows, grouped by status -- no roster parameter (T508)', () => {
    expect(computeEndMeetingSummaryCounts(TEST_ATTENDANCE)).toEqual({
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

  it('C9: invents no absent count for the two unmarked roster members -- absent stays 0', () => {
    const counts = computeEndMeetingSummaryCounts(TEST_ATTENDANCE);
    expect(counts.absent).toBe(0);
    // Sanity: there really are two unmarked roster members -- the C9
    // mutation this guards against seeds `counts.absent` from exactly this
    // number, which would make this assertion fail with `absent: 2`.
    expect(computeNoRecordCount(TEST_ROSTER, TEST_ATTENDANCE)).toBe(2);
  });

  it('T508 (module doc section 3 fix): counts a real record for a student who is NOT on the roster at all', () => {
    const offRosterAttendance: Record<string, AttendanceRecordState> = {
      ...TEST_ATTENDANCE,
      'student-koa': {
        // A real, recorded row for a student absent from TEST_ROSTER
        // entirely -- the `loaders/selfCheckoff.ts` route (module doc
        // section 3): a student can self-check off into a session with no
        // roster/team check anywhere in that file.
        status: 'present',
        checkInAt: '2026-07-23T01:10:00.000Z',
        checkOutAt: '2026-07-23T01:50:00.000Z',
        method: 'qr',
        recordedBy: null,
      },
    };
    expect(computeEndMeetingSummaryCounts(offRosterAttendance)).toEqual({
      present: 2, // student-fox + the off-roster student-koa.
      late: 1,
      excused: 1,
      absent: 0,
    });
  });
});

describe('computeNoRecordCount / buildEndMeetingConfirmDescription (module doc section 3/1a)', () => {
  it('counts the roster members with no record separately from the tally', () => {
    expect(computeNoRecordCount(TEST_ROSTER, TEST_ATTENDANCE)).toBe(2);
  });

  it('C4 / T508 RE-DERIVED (was: "includes ... will be marked absent" unconditionally -- encoded the automatic-write defect): opted OUT (false, the default) states the LEFT-UNMARKED consequence, never "will be marked absent"', () => {
    const description = buildEndMeetingConfirmDescription(TEST_ROSTER, TEST_ATTENDANCE, false);
    expect(description).toContain('1 present · 1 late · 1 excused · 0 absent');
    expect(description).toContain(
      '2 students have no attendance record and will be left unmarked.',
    );
    expect(description).not.toContain('will be marked absent');
    expect(description).toContain('1 open check-in will be checked out');
  });

  it('C5: opted IN (true) states the marked-absent consequence, never the left-unmarked one', () => {
    const description = buildEndMeetingConfirmDescription(TEST_ROSTER, TEST_ATTENDANCE, true);
    expect(description).toContain('2 students with no attendance record will be marked absent.');
    expect(description).not.toContain('left unmarked');
  });

  it('C8: counts a real record for an off-roster student in the live tally -- the roster is still passed in (for the no-record count), but the tally no longer joins through it', () => {
    const offRosterAttendance: Record<string, AttendanceRecordState> = {
      ...TEST_ATTENDANCE,
      'student-koa': {
        status: 'present',
        checkInAt: '2026-07-23T01:10:00.000Z',
        checkOutAt: '2026-07-23T01:50:00.000Z',
        method: 'qr',
        recordedBy: null,
      },
    };
    const description = buildEndMeetingConfirmDescription(TEST_ROSTER, offRosterAttendance, false);
    expect(description).toContain('2 present · 1 late · 1 excused · 0 absent');
  });

  it('omits the no-record/checkout sentences entirely when there is nothing to disclose', () => {
    const complete: Record<string, AttendanceRecordState> = {
      'student-fox': { ...TEST_ATTENDANCE['student-fox'], checkOutAt: '2026-07-23T02:00:00.000Z' },
      'student-gwen': TEST_ATTENDANCE['student-gwen'],
      'student-hal': TEST_ATTENDANCE['student-ivy'],
      'student-ivy': TEST_ATTENDANCE['student-ivy'],
      'student-jet': TEST_ATTENDANCE['student-ivy'],
    };
    const description = buildEndMeetingConfirmDescription(TEST_ROSTER, complete, false);
    expect(description).not.toContain('no attendance record');
    expect(description).not.toContain('checked out at');
  });

  it('C11 (owner ruling, 2026-08-05 later: "one format, always"): the tally sentence renders unconditionally, including the all-zero case', () => {
    const description = buildEndMeetingConfirmDescription(TEST_ROSTER, {}, false);
    expect(description).toContain('0 present · 0 late · 0 excused · 0 absent');
  });
});

describe('buildMarkRemainingAbsentLabel (module doc section 1a -- C7)', () => {
  it('names the count and pluralizes correctly', () => {
    expect(buildMarkRemainingAbsentLabel(1)).toBe(
      'Mark 1 student with no attendance record absent',
    );
    expect(buildMarkRemainingAbsentLabel(2)).toBe(
      'Mark 2 students with no attendance record absent',
    );
  });
});

describe('T607 (GAM-283): describeEndMeetingFailure', () => {
  it('criterion 6: a SupabaseNotConfiguredError-shaped rejection passes through verbatim (the reachable, precedented differentiation)', () => {
    const cause = new SupabaseNotConfiguredError();
    const rejection = { code: 'UNKNOWN', message: cause.message, cause };
    expect(describeEndMeetingFailure(rejection)).toBe(cause.message);
    expect(describeEndMeetingFailure(rejection)).toContain("Supabase isn't configured yet");
  });

  it('criterion 5: a generic SupabaseLoaderError rejection (loader.ts read-flavoured shape, e.g. a Postgrest failure) gets write-flavoured copy, never the read-flavoured DEFAULT_LOADER_ERROR_MESSAGE forwarded verbatim', () => {
    // Same plain, non-`Error` `SupabaseLoaderError` shape `runMutation`
    // (`loader.ts`) actually rejects with for any ordinary Postgrest
    // failure -- NOT the `SupabaseNotConfiguredError` case criterion 6
    // covers. `cause` here is a plain Postgrest error object, not a
    // `SupabaseNotConfiguredError` instance.
    const rejection = {
      code: '23505',
      message: "Couldn't load this data. Check your connection and try again.",
      cause: { message: 'duplicate key value violates unique constraint' },
    };
    expect(describeEndMeetingFailure(rejection)).toBe(END_MEETING_FAILURE_MESSAGE);
    expect(describeEndMeetingFailure(rejection)).not.toContain("Couldn't load this data");
  });

  it('criterion 4: raw underlying error text (an Error instance, and a SupabaseLoaderError whose cause carries raw text) never renders in the returned copy', () => {
    // A plain `Error` -- deliberately NOT special-cased (see the function's
    // own doc comment for why `instanceof Error` is dropped here, diverging
    // from `extractRsvpErrorMessage`'s landed shape).
    const rawError = new Error('duplicate key value violates unique constraint "uq_x"');
    expect(describeEndMeetingFailure(rawError)).toBe(END_MEETING_FAILURE_MESSAGE);
    expect(describeEndMeetingFailure(rawError)).not.toContain('duplicate key value');

    // A SupabaseLoaderError whose `cause` carries raw Postgrest text.
    const wrapped = {
      code: 'PGRST301',
      message: "Couldn't load this data. Check your connection and try again.",
      cause: { message: 'JWT expired at 2026-08-12T00:00:00Z' },
    };
    expect(describeEndMeetingFailure(wrapped)).not.toContain('JWT expired');
  });

  it('criterion 3: the fallback copy states retrying is safe and will not double-record, and that anything already recorded was kept -- never that the meeting is still open', () => {
    expect(END_MEETING_FAILURE_MESSAGE).toContain('already recorded was kept');
    expect(END_MEETING_FAILURE_MESSAGE).toContain('nothing will be recorded twice');
    expect(END_MEETING_FAILURE_MESSAGE.toLowerCase()).not.toContain('still open');
    expect(END_MEETING_FAILURE_MESSAGE.toLowerCase()).not.toContain('nothing was saved');
    expect(END_MEETING_FAILURE_MESSAGE.toLowerCase()).not.toContain('nothing was recorded');
  });

  it('falls back for a plain string/undefined rejection too', () => {
    expect(describeEndMeetingFailure('some string')).toBe(END_MEETING_FAILURE_MESSAGE);
    expect(describeEndMeetingFailure(undefined)).toBe(END_MEETING_FAILURE_MESSAGE);
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
  it('T508 RE-DERIVED (§3g -- was: asserted "1 student has no attendance record yet" + "will be marked absent" unconditionally, which encoded the automatic-write defect this row removes): opens a real AlertDialog with the live tally, the opt-in checkbox unticked by default (C6) naming its count (C7), the LEFT-UNMARKED disclosure (C4), and does not call onEndMeeting before confirm', async () => {
    const onEndMeeting = vi.fn().mockResolvedValue(undefined);
    renderDialog({
      sessionId: 'session-test-001',
      loadSummary: () => Promise.resolve(testSummary()),
      onEndMeeting,
    });
    await flushMicrotasks();

    // C6: the opt-in checkbox is unticked by default.
    const checkbox = findMarkRemainingAbsentCheckbox();
    expect(checkbox.checked).toBe(false);
    // C7: the checkbox label names the count (2 unmarked -- student-hal,
    // student-jet).
    expect(document.body.textContent).toContain('Mark 2 students with no attendance record absent');

    clickButtonWithText('End meeting');

    expect(document.body.textContent).toContain('End this meeting?');
    expect(document.body.textContent).toContain('1 present · 1 late · 1 excused · 0 absent');
    // C4: the checkbox is unticked, so the honest disclosure is the
    // LEFT-UNMARKED sentence, never the marked-absent claim.
    expect(document.body.textContent).toContain(
      '2 students have no attendance record and will be left unmarked.',
    );
    expect(document.body.textContent).not.toContain('will be marked absent');
    expect(document.body.textContent).toContain('1 open check-in will be checked out');
    expect(onEndMeeting).not.toHaveBeenCalled();
  });

  it('T508 RE-DERIVED (§3g -- was: asserted the old backfillAbsentStudentIds payload with student-hal auto-marked absent, the exact live-data-corruption defect this row exists to stop): confirming with the checkbox left unticked (the ordinary case) calls onEndMeeting exactly once with an EMPTY markAbsentStudentIds, then flips to completed with nobody marked absent', async () => {
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
      markAbsentStudentIds: [],
      checkoutStudentIds: ['student-fox'],
    });

    // The dialog is gone (session flipped to completed) and the trigger
    // button no longer renders.
    expect(findButtonByText('End meeting')).toBeUndefined();
    expect(document.body.textContent).toContain('This meeting has ended');

    // Neither unmarked student was written as absent -- their
    // SegmentedControl shows no selected ("checked") option at all.
    const halGroup = findAttendanceRadioGroup('Hal S.');
    expect(halGroup.querySelector('[aria-checked="true"]')).toBeNull();
    const jetGroup = findAttendanceRadioGroup('Jet Q.');
    expect(jetGroup.querySelector('[aria-checked="true"]')).toBeNull();
  });

  it('C3/C5 (opt-in): ticking the checkbox before confirming sends the FULL unmarked set -- including the SECOND student -- and both end up marked absent', async () => {
    const onEndMeeting = vi.fn().mockResolvedValue(undefined);
    renderDialog({
      sessionId: 'session-test-001',
      loadSummary: () => Promise.resolve(testSummary()),
      onEndMeeting,
    });
    await flushMicrotasks();

    clickMarkRemainingAbsentCheckbox();
    expect(findMarkRemainingAbsentCheckbox().checked).toBe(true);

    clickButtonWithText('End meeting');
    expect(document.body.textContent).toContain(
      '2 students with no attendance record will be marked absent.',
    );
    expect(document.body.textContent).not.toContain('left unmarked');

    const dialogEl = document.querySelector('dialog[open]') as HTMLElement;
    const actionButton = Array.from(dialogEl.querySelectorAll('button')).find(
      (button) => button.textContent?.trim() === 'End meeting',
    );
    clickButton(actionButton as HTMLButtonElement);
    await flushMicrotasks();

    expect(onEndMeeting).toHaveBeenCalledTimes(1);
    expect(onEndMeeting).toHaveBeenCalledWith({
      sessionId: 'session-test-001',
      endsAt: '2026-07-23T02:00:00.000Z',
      markAbsentStudentIds: ['student-hal', 'student-jet'],
      checkoutStudentIds: ['student-fox'],
    });

    // Both unmarked students -- including the SECOND one -- now show absent
    // in the post-completion list.
    const halGroup = findAttendanceRadioGroup('Hal S.');
    expect(halGroup.querySelector('[data-value="absent"]')?.getAttribute('aria-checked')).toBe(
      'true',
    );
    const jetGroup = findAttendanceRadioGroup('Jet Q.');
    expect(jetGroup.querySelector('[data-value="absent"]')?.getAttribute('aria-checked')).toBe(
      'true',
    );
  });

  it('C11: the tally sentence renders unconditionally in the real dialog, including the all-zero case, rather than falling back to prose', async () => {
    const emptySummary: EndMeetingSummaryData = {
      session: TEST_SESSION,
      roster: TEST_ROSTER,
      attendanceByStudentId: {},
    };
    renderDialog({
      sessionId: 'session-test-001',
      loadSummary: () => Promise.resolve(emptySummary),
    });
    await flushMicrotasks();

    clickButtonWithText('End meeting');

    expect(document.body.textContent).toContain('0 present · 0 late · 0 excused · 0 absent');
  });

  it("T607 (GAM-283) RE-DERIVED, correction 2 (was: asserted the raw rejected Error's own message, 'write failed', rendered verbatim -- exactly 1 of 30 assertions in this file, 1 of 2437 suite-wide, per the packet's measured scope). That assertion is now IMPOSSIBLE ON PURPOSE: describeEndMeetingFailure drops the old `error instanceof Error ? error.message : ...` passthrough so no raw rejected-error text can ever reach the DOM (criterion 4/1) -- only its OWN raw-string assertion changed; the real coverage (banner appears, session stays unflipped) is unchanged and re-asserted below, plus two facts this test never covered before: the confirm modal actually CLOSES on failure so the banner is reachable, not hidden behind an inert layer (criterion 2, Part A), and the fixed copy carries the retry-safe/kept-recorded facts (criterion 3): shows a reachable error banner (no dialog left open over it) and leaves the session unflipped when onEndMeeting rejects", async () => {
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

    // Criterion 2: the confirm AlertDialog actually closed -- no open
    // <dialog> is left covering the banner (Astryx's `Dialog` puts an open
    // `<dialog>` in an inert top layer; before Part A this assertion would
    // have found one still open here).
    expect(document.querySelector('dialog[open]')).toBeNull();

    // Criterion 1/4: the fixed, hand-authored copy renders; the raw
    // rejected-error text never does.
    expect(document.body.textContent).toContain("Couldn't end this meeting");
    expect(document.body.textContent).toContain(END_MEETING_FAILURE_MESSAGE);
    expect(document.body.textContent).not.toContain('write failed');

    // Criterion 3: retry-safe / kept-recorded facts are on screen, never
    // "still open" or "nothing was saved".
    expect(document.body.textContent).toContain('already recorded was kept');
    expect(document.body.textContent).toContain('nothing will be recorded twice');
    expect(document.body.textContent?.toLowerCase()).not.toContain('still open');

    // Session was never flipped -- the trigger button (not the completed
    // banner) is still present.
    expect(findButtonByText('End meeting')).toBeTruthy();
    expect(document.body.textContent).not.toContain('This meeting has ended');
  });

  it('criterion 6 (real component, not just the pure helper): a SupabaseNotConfiguredError-shaped rejection from onEndMeeting renders its own DES-16 copy verbatim, reachably (no open dialog over it)', async () => {
    const cause = new SupabaseNotConfiguredError();
    const onEndMeeting = vi
      .fn()
      .mockRejectedValue({ code: 'UNKNOWN', message: cause.message, cause });
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

    expect(document.querySelector('dialog[open]')).toBeNull();
    expect(document.body.textContent).toContain("Supabase isn't configured yet");
    expect(document.body.textContent).not.toContain(END_MEETING_FAILURE_MESSAGE);
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
