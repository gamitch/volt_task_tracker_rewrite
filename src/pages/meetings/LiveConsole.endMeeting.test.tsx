// @vitest-environment jsdom
/**
 * T196: console-level mount tests for the real `EndMeetingDialog` (T036) now
 * mounted on `LiveConsole.tsx` in place of its deleted stub.
 *
 * Per T196 worker packet section 9c, this is a NEW, colocated file --
 * `LiveConsole.test.tsx`'s own test-update grant is scoped to exactly two
 * `it` blocks (the ones that used to assert the stub), so no console-level
 * mount proof has an authorized home there. This file exists specifically
 * to produce criteria C1, C2, C3, C5, C6 from the packet's acceptance table
 * (section 7) -- C4 is dropped by owner ruling (see that section), and
 * `endMeeting.test.ts:626`/`:640` already cover the identity-freshness and
 * null-identity-rejects contracts at the loader level, so they are cited,
 * not re-tested, here (packet section 7's "already covered" note).
 *
 * Render harness: the same raw `createRoot`/`act` + `AuthProvider`/`LoginAs`/
 * `MemoryRouter` pattern `LiveConsole.test.tsx`/`EndMeetingDialog.test.tsx`
 * already established. No `@testing-library/react` is installed in this repo.
 */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthProvider, type AuthUser } from '../../app/guards';
import { LoginAsDeferred as LoginAs } from '../../test-utils/authHarness';
import { LiveConsoleBody, type LiveConsoleData } from './LiveConsole';
import {
  buildEndMeetingConfirmDescription,
  type AttendanceRecordState as EndMeetingAttendanceRecordState,
  type EndMeetingSummaryData,
} from './EndMeetingDialog';

// ---------------------------------------------------------------------------
// jsdom gap: `AlertDialog` (rendered inside the mounted `EndMeetingDialog`,
// C3's confirm flow) calls the real `HTMLDialogElement.prototype.showModal`,
// which this repo's installed jsdom does not implement. Same guarded,
// test-file-local polyfill `EndMeetingDialog.test.tsx:59-69` already
// established (packet section 9c).
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

const TEST_SESSION_ID = 'session-t196-endmeeting';
const TEST_PATH = `/meetings/live/${TEST_SESSION_ID}`;
const COACH_USER: AuthUser = { id: 'user-coach', email: 'coach@example.com', role: 'coach' };

async function stubLoadDisplayToken(): Promise<null> {
  // The QR panel is not under test here; resolving null keeps it in its
  // honest "not available" branch without a real network call.
  return null;
}

function renderBody(props: Parameters<typeof LiveConsoleBody>[0] = {}): void {
  act(() => {
    root.render(
      <MemoryRouter initialEntries={[TEST_PATH]}>
        <AuthProvider>
          <Routes>
            <Route
              path="/meetings/live/:sessionId"
              element={
                <LoginAs user={COACH_USER}>
                  <LiveConsoleBody loadDisplayToken={stubLoadDisplayToken} {...props} />
                </LoginAs>
              }
            />
          </Routes>
        </AuthProvider>
      </MemoryRouter>,
    );
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
  return Array.from(container.querySelectorAll('button')).find(
    (button) => button.textContent?.trim() === text,
  );
}

function clickButton(button: HTMLButtonElement): void {
  act(() => {
    button.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
}

/** Counts non-overlapping occurrences of `needle` in `haystack` -- used by
 * C5 to prove a student's name renders exactly once, not duplicated across
 * the console's own roster row and the dialog's (should-be-suppressed)
 * correction row. */
function countOccurrences(haystack: string, needle: string): number {
  return haystack.split(needle).length - 1;
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
});

// ---------------------------------------------------------------------------
// Fixtures -- distinct, obviously-fabricated data (constitution item 6),
// deliberately different from both `LiveConsole.test.tsx`'s own fixtures and
// `EndMeetingDialog.tsx`'s shipped `defaultLoadEndMeetingSummary` fixture, so
// a test that only passes because it happened to match a default's shape is
// impossible.
// ---------------------------------------------------------------------------

async function stubLoadConsoleData(): Promise<LiveConsoleData> {
  return {
    session: {
      id: TEST_SESSION_ID,
      title: 'Wednesday Sprint Review',
      startsAt: '2026-08-04T00:00:00.000Z',
      endsAt: '2026-08-04T02:00:00.000Z',
    },
    roster: [{ studentId: 'student-uma', name: 'Uma X.' }],
    attendance: {
      'student-uma': {
        status: 'present',
        method: 'qr',
        recordedBy: null,
        updatedAt: '2026-08-04T00:05:00.000Z',
      },
    },
  };
}

/** A scheduled-session `EndMeetingSummaryData`, distinct in every count from
 * `EndMeetingDialog.tsx`'s own `defaultLoadEndMeetingSummary` fixture (2
 * present · 1 late · 1 excused · 0 absent, 1 no-record, 2 checkouts) -- so a
 * test asserting on this fixture's derived tally cannot pass against that
 * default by coincidence. */
const SCHEDULED_SUMMARY: EndMeetingSummaryData = {
  session: {
    id: TEST_SESSION_ID,
    title: 'Wednesday Sprint Review',
    endsAt: '2026-08-04T02:00:00.000Z',
    status: 'scheduled',
  },
  roster: [
    { studentId: 'student-uma', name: 'Uma X.' },
    { studentId: 'student-vik', name: 'Vik Y.' },
  ],
  attendanceByStudentId: {
    'student-uma': {
      status: 'present',
      checkInAt: '2026-08-04T00:05:00.000Z',
      checkOutAt: null, // open check-in -- a checkout candidate.
      method: 'qr',
      recordedBy: null,
    },
    // student-vik: deliberately no record -- a backfill candidate.
  },
};

const EXPECTED_END_MEETING_PAYLOAD = {
  sessionId: TEST_SESSION_ID,
  endsAt: '2026-08-04T02:00:00.000Z',
  backfillAbsentStudentIds: ['student-vik'],
  checkoutStudentIds: ['student-uma'],
};

/** A completed-session summary sharing ONE student ("Nia F.") with the
 * console's OWN roster fixture below, with a CONTRADICTORY status -- the
 * exact "Ada Q. twice, Absent vs Present" defect owner ruling 1 (packet
 * section 3) was written to prevent. */
const COMPLETED_STUDENT: EndMeetingAttendanceRecordState = {
  status: 'absent',
  checkInAt: null,
  checkOutAt: null,
  method: 'coach',
  recordedBy: null,
};
const COMPLETED_SUMMARY: EndMeetingSummaryData = {
  session: {
    id: TEST_SESSION_ID,
    title: 'Wednesday Sprint Review',
    endsAt: '2026-08-04T02:00:00.000Z',
    status: 'completed',
  },
  roster: [{ studentId: 'student-nia', name: 'Nia F.' }],
  attendanceByStudentId: { 'student-nia': COMPLETED_STUDENT },
};

async function stubLoadConsoleDataWithNia(): Promise<LiveConsoleData> {
  return {
    session: {
      id: TEST_SESSION_ID,
      title: 'Wednesday Sprint Review',
      startsAt: '2026-08-04T00:00:00.000Z',
      endsAt: '2026-08-04T02:00:00.000Z',
    },
    roster: [{ studentId: 'student-nia', name: 'Nia F.' }],
    attendance: {
      'student-nia': {
        status: 'present', // contradicts COMPLETED_SUMMARY's 'absent' above.
        method: 'qr',
        recordedBy: null,
        updatedAt: '2026-08-04T00:05:00.000Z',
      },
    },
  };
}

// ---------------------------------------------------------------------------
// C1 -- the dialog is mounted; the stub is gone.
// ---------------------------------------------------------------------------

describe('T196 C1 -- the real EndMeetingDialog is mounted, the stub is gone', () => {
  it('renders the dialog\'s own "End meeting" trigger, and the stub copy never appears', async () => {
    renderBody({
      loadData: stubLoadConsoleData,
      loadEndMeetingSummary: () => Promise.resolve(SCHEDULED_SUMMARY),
    });
    await flushMicrotasks();

    expect(container.textContent).not.toContain('End-meeting summary not built yet');
    const trigger = findButtonByText('End meeting');
    expect(trigger).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// C2 -- the console passes the REAL loadSummary through, not the dialog's
// own fixture default.
// ---------------------------------------------------------------------------

describe('T196 C2 -- the console forwards its OWN loadEndMeetingSummary seam to the dialog', () => {
  it("shows the confirm description built from the INJECTED summary, not the dialog's shipped fixture default", async () => {
    renderBody({
      loadData: stubLoadConsoleData,
      loadEndMeetingSummary: () => Promise.resolve(SCHEDULED_SUMMARY),
    });
    await flushMicrotasks();

    const trigger = findButtonByText('End meeting');
    expect(trigger).toBeTruthy();
    clickButton(trigger as HTMLButtonElement);

    const expectedDescription = buildEndMeetingConfirmDescription(
      SCHEDULED_SUMMARY.roster,
      SCHEDULED_SUMMARY.attendanceByStudentId,
    );
    expect(container.textContent).toContain(expectedDescription);
  });
});

// ---------------------------------------------------------------------------
// C3 -- the console passes the REAL onEndMeeting through.
// ---------------------------------------------------------------------------

describe('T196 C3 -- the console forwards its OWN onEndMeeting seam to the dialog', () => {
  it('calls the injected onEndMeeting exactly once with the single atomic payload on confirm', async () => {
    const onEndMeeting = vi.fn().mockResolvedValue(undefined);
    renderBody({
      loadData: stubLoadConsoleData,
      loadEndMeetingSummary: () => Promise.resolve(SCHEDULED_SUMMARY),
      onEndMeeting,
    });
    await flushMicrotasks();

    const trigger = findButtonByText('End meeting');
    expect(trigger).toBeTruthy();
    clickButton(trigger as HTMLButtonElement); // opens the real AlertDialog.

    const dialogEl = document.querySelector('dialog[open]') as HTMLElement | null;
    expect(dialogEl).toBeTruthy();
    const actionButton = Array.from((dialogEl as HTMLElement).querySelectorAll('button')).find(
      (button) => button.textContent?.trim() === 'End meeting',
    );
    expect(actionButton).toBeTruthy();
    clickButton(actionButton as HTMLButtonElement);
    await flushMicrotasks();

    expect(onEndMeeting).toHaveBeenCalledTimes(1);
    expect(onEndMeeting).toHaveBeenCalledWith(EXPECTED_END_MEETING_PAYLOAD);
  });
});

// ---------------------------------------------------------------------------
// C5 -- owner ruling 1 (packet section 3): post-completion, the console
// renders NO attendance-correction list. A test that only counts controls
// is not enough (packet section 7) -- assert a student name appears
// EXACTLY ONCE, not the "Ada Q. twice" defect the ruling exists to prevent.
// ---------------------------------------------------------------------------

describe('T196 C5 -- post-completion, no duplicate/contradictory student row', () => {
  it('renders "Nia F." exactly once, from the console\'s own roster -- not a second time from the dialog\'s correction list', async () => {
    renderBody({
      loadData: stubLoadConsoleDataWithNia,
      loadEndMeetingSummary: () => Promise.resolve(COMPLETED_SUMMARY),
    });
    await flushMicrotasks();

    // Sanity: the dialog's own "meeting has ended" banner still renders
    // (owner ruling 2) -- the deletion-half of C6 is already covered by
    // `EndMeetingDialog.test.tsx:377`/`:429` (packet section 9b); this is
    // just confirming the mounted instance reached the same branch.
    expect(container.textContent).toContain('This meeting has ended');

    expect(countOccurrences(container.textContent ?? '', 'Nia F.')).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// C6 -- the banner's copy no longer claims corrections are recorded
// automatically (the audit trigger it described was removed 2026-08-03).
// The "banner still renders" half is pre-covered (packet section 9b, cited
// above in C5) -- this test asserts the COPY only.
// ---------------------------------------------------------------------------

describe('T196 C6 -- the "meeting has ended" banner copy no longer claims automatic recording', () => {
  it('says "Attendance stays editable below." and never claims corrections are recorded automatically', async () => {
    renderBody({
      loadData: stubLoadConsoleDataWithNia,
      loadEndMeetingSummary: () => Promise.resolve(COMPLETED_SUMMARY),
    });
    await flushMicrotasks();

    expect(container.textContent).toContain('Attendance stays editable below.');
    expect(container.textContent).not.toContain('corrections are recorded automatically');
  });
});
