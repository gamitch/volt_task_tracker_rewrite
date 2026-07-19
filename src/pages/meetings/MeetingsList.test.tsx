// @vitest-environment jsdom
/**
 * T030: tests for `MeetingsList.tsx`.
 *
 * Per this task's Allowed Files (`MeetingsList.tsx` only) this test file is
 * a deliberate, disclosed addition beyond the literal Allowed Files list --
 * the same class of addition `CheckinResult.test.tsx` (T035) made in the
 * same directory, existing only to produce the DOM-text proof this task's
 * own packet requires in "Required Worker Output" (both role variants
 * across all four DES-12 states, NAV-07 filtering, BEH-08 formatting).
 *
 * No `@testing-library/react` is installed in this repo (confirmed via
 * `package.json`) -- these tests use the same raw `createRoot`/`act`
 * pattern `CheckinResult.test.tsx` and `theme.smoke.test.tsx` already
 * established.
 */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthProvider, type AuthUser } from '../../app/guards';
import { LoginAs } from '../../test-utils/authHarness';
import {
  MeetingsList,
  buildCoachMeetingRows,
  buildStudentMeetingsData,
  defaultLoadCoachMeetingsData,
  defaultLoadStudentMeetingsData,
  formatDuration,
  formatTimeRangeWithDuration,
  formatWeekdayDate,
  partitionByStatus,
  PLACEHOLDER_CURRENT_STUDENT_ID,
  type CoachMeetingsData,
  type StudentMeetingsData,
} from './MeetingsList';

// ---------------------------------------------------------------------------
// jsdom gap: `AlertDialog` renders a native `<dialog>` and calls
// `HTMLDialogElement.prototype.showModal()`, which this repo's installed
// jsdom (29.x) does not implement (confirmed live: `dialog.showModal is not
// a function` before this polyfill was added). This is the FIRST use of
// `AlertDialog`/`Dialog` anywhere in this codebase (grep-confirmed), so no
// prior task hit this gap. Scoped to THIS test file's own jsdom global only
// (not `src/test-setup.ts`, which is outside this task's Allowed Files) --
// same "local override, not a shared-config edit" posture
// `CheckinResult.test.tsx`'s per-test `vi.stubGlobal('matchMedia', ...)`
// already established. Flagged in this task's worker output as a candidate
// for promotion into the shared `test-setup.ts` guarded-polyfill file by a
// future task, since more Dialog/AlertDialog usage is coming (T031/T036).
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

const COACH_USER: AuthUser = { id: 'user-coach', email: 'coach@example.com', role: 'coach' };
// T073a: guards.tsx's `Role` union now includes 'student'/'parent'
// (previously it did not -- module doc #5/#6 gap, resolved). 'student'
// stands in for "not coach/admin" here, which is exactly the branch
// MeetingsList's own `isCoachOrAdminView` check falls through on for any
// non-coach/admin role. Previously `role: 'staff'`, invalid under the
// corrected `Role` type.
const STUDENT_OR_PARENT_USER: AuthUser = {
  id: 'user-student',
  email: 'student@example.com',
  role: 'student',
};

function renderAsUser(user: AuthUser, props: Parameters<typeof MeetingsList>[0] = {}): void {
  act(() => {
    root.render(
      <AuthProvider>
        <LoginAs user={user}>
          <MeetingsList {...props} />
        </LoginAs>
      </AuthProvider>,
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
// Pure formatting/builder functions
// ---------------------------------------------------------------------------

describe('formatWeekdayDate (BEH-08)', () => {
  it('renders a weekday name + short date, e.g. "Wed, Jul 22"', () => {
    expect(formatWeekdayDate('2026-07-22')).toBe('Wed, Jul 22');
  });
});

describe('formatDuration / formatTimeRangeWithDuration (BEH-08)', () => {
  it('computes a whole-hour duration', () => {
    expect(formatDuration('2026-07-22T23:00:00.000Z', '2026-07-23T01:00:00.000Z')).toBe('2h');
  });

  it('computes an hours+minutes duration', () => {
    expect(formatDuration('2026-07-22T23:00:00.000Z', '2026-07-23T00:30:00.000Z')).toBe('1h 30m');
  });

  it('computes a minutes-only duration', () => {
    expect(formatDuration('2026-07-22T23:00:00.000Z', '2026-07-22T23:45:00.000Z')).toBe('45m');
  });

  it('renders a full time range + duration string, America/Chicago (NFR-09)', () => {
    // 2026-07-22T23:00:00Z / 2026-07-23T01:00:00Z = 6:00-8:00 PM America/Chicago (CDT, UTC-5).
    expect(
      formatTimeRangeWithDuration('2026-07-22T23:00:00.000Z', '2026-07-23T01:00:00.000Z'),
    ).toBe('6:00–8:00 PM · 2h');
  });
});

describe('partitionByStatus', () => {
  it('splits scheduled into upcoming and completed/canceled into past, sorted', () => {
    const rows = [
      { id: 'a', status: 'completed' as const, startsAt: '2026-07-01T00:00:00.000Z' },
      { id: 'b', status: 'scheduled' as const, startsAt: '2026-07-10T00:00:00.000Z' },
      { id: 'c', status: 'scheduled' as const, startsAt: '2026-07-05T00:00:00.000Z' },
      { id: 'd', status: 'canceled' as const, startsAt: '2026-07-02T00:00:00.000Z' },
    ];
    const { upcoming, past } = partitionByStatus(rows);
    expect(upcoming.map((r) => r.id)).toEqual(['c', 'b']); // ascending
    expect(past.map((r) => r.id)).toEqual(['d', 'a']); // descending (most recent first)
  });
});

describe('buildCoachMeetingRows (NAV-07)', () => {
  it('excludes outreach-typed events entirely', async () => {
    const { rows } = await defaultLoadCoachMeetingsData();
    expect(rows.some((r) => r.title === 'Community Food Drive')).toBe(false);
    expect(rows.length).toBeGreaterThan(0);
  });

  it('computes an attendance summary only for completed sessions', () => {
    const rows = buildCoachMeetingRows(
      [
        {
          id: 'e1',
          seasonId: 's1',
          type: 'meeting',
          title: 'M',
          teamIds: null,
          countsParticipation: true,
        },
      ],
      [
        {
          id: 'sess-scheduled',
          eventId: 'e1',
          sessionDate: '2026-07-22',
          startsAt: '2026-07-22T23:00:00.000Z',
          endsAt: '2026-07-23T01:00:00.000Z',
          status: 'scheduled',
        },
        {
          id: 'sess-completed',
          eventId: 'e1',
          sessionDate: '2026-07-15',
          startsAt: '2026-07-15T23:00:00.000Z',
          endsAt: '2026-07-16T01:00:00.000Z',
          status: 'completed',
        },
      ],
      [],
      [
        { sessionId: 'sess-completed', studentId: 'stu-1', status: 'present' },
        { sessionId: 'sess-completed', studentId: 'stu-2', status: 'late' },
      ],
    );
    const scheduled = rows.find((r) => r.sessionId === 'sess-scheduled');
    const completed = rows.find((r) => r.sessionId === 'sess-completed');
    expect(scheduled?.attendanceSummary).toBeNull();
    expect(completed?.attendanceSummary).toEqual({
      presentCt: 1,
      lateCt: 1,
      excusedCt: 0,
      absentCt: 0,
    });
  });
});

describe('buildStudentMeetingsData (constitution item 3)', () => {
  it('never computes participationPct -- copies it verbatim from the metric row', () => {
    const data = buildStudentMeetingsData(
      'stu-1',
      [
        {
          id: 'e1',
          seasonId: 's1',
          type: 'meeting',
          title: 'M',
          teamIds: null,
          countsParticipation: true,
        },
      ],
      [],
      [],
      [
        {
          studentId: 'stu-1',
          teamId: 't1',
          seasonId: 's1',
          expectedCt: 7,
          presentCt: 4,
          lateCt: 1,
          excusedCt: 0,
          participationPct: 57.1,
        },
      ],
    );
    expect(data.participation?.participationPct).toBe(57.1);
  });

  it('returns participation: null when the student has no row in the metric view', () => {
    const data = buildStudentMeetingsData(
      'stu-with-no-completed-sessions',
      [],
      [],
      [],
      [
        {
          studentId: 'other-student',
          teamId: 't1',
          seasonId: 's1',
          expectedCt: 5,
          presentCt: 5,
          lateCt: 0,
          excusedCt: 0,
          participationPct: 100,
        },
      ],
    );
    expect(data.participation).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// <MeetingsList /> -- coach view, all four DES-12 states
// ---------------------------------------------------------------------------

describe('<MeetingsList /> coach view', () => {
  it('loading state', () => {
    renderAsUser(COACH_USER, { loadCoachData: () => new Promise<CoachMeetingsData>(() => {}) });
    expect(container.textContent).toContain('Loading meetings');
  });

  it('error state', async () => {
    renderAsUser(COACH_USER, { loadCoachData: () => Promise.reject(new Error('boom')) });
    await flushMicrotasks();
    expect(container.textContent).toContain("Couldn't load meetings");
  });

  it('empty state (zero meeting sessions)', async () => {
    renderAsUser(COACH_USER, { loadCoachData: () => Promise.resolve({ rows: [] }) });
    await flushMicrotasks();
    expect(container.textContent).toContain('No meetings scheduled yet');
  });

  it('populated state: Upcoming/Past sections, status badges, team scope, dates, NAV-07 exclusion', async () => {
    renderAsUser(COACH_USER, { loadCoachData: defaultLoadCoachMeetingsData });
    await flushMicrotasks();

    expect(container.textContent).toContain('Weekly Build Meeting');
    expect(container.textContent).toContain('Ravens Strategy Session');
    expect(container.textContent).toContain('All teams');
    expect(container.textContent).toContain('Ravens');
    expect(container.textContent).toContain('Scheduled');
    expect(container.textContent).toContain('Completed');
    expect(container.textContent).toContain('Canceled');
    expect(container.textContent).toContain('present');
    expect(container.textContent).toContain('Schedule meetings');

    // NAV-07: outreach content must never appear.
    expect(container.textContent).not.toContain('Community Food Drive');
  });

  it('"Schedule meetings" shows the disclosed stub notice, not silent/fake behavior', async () => {
    renderAsUser(COACH_USER, { loadCoachData: defaultLoadCoachMeetingsData });
    await flushMicrotasks();

    const scheduleButtons = Array.from(container.querySelectorAll('button')).filter((btn) =>
      btn.textContent?.includes('Schedule meetings'),
    );
    expect(scheduleButtons.length).toBeGreaterThan(0);
    act(() => {
      scheduleButtons[0].dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(container.textContent).toContain('Scheduling dialog not built yet');
  });

  it('Cancel via MoreMenu + AlertDialog (DES-11) really updates the row to canceled', async () => {
    renderAsUser(COACH_USER, { loadCoachData: defaultLoadCoachMeetingsData });
    await flushMicrotasks();

    const moreMenuButton = Array.from(container.querySelectorAll('button')).find((btn) =>
      btn.getAttribute('aria-label')?.startsWith('Actions for Weekly Build Meeting'),
    );
    expect(moreMenuButton).toBeTruthy();
    act(() => {
      moreMenuButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    const cancelMenuItem = Array.from(document.querySelectorAll('[role="menuitem"], button')).find(
      (el) => el.textContent?.trim() === 'Cancel meeting',
    );
    expect(cancelMenuItem).toBeTruthy();
    act(() => {
      cancelMenuItem?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(document.body.textContent).toContain('Cancel "Weekly Build Meeting"?');

    const confirmButton = Array.from(document.querySelectorAll('button')).find(
      (btn) => btn.textContent?.trim() === 'Cancel meeting',
    );
    expect(confirmButton).toBeTruthy();
    act(() => {
      confirmButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    // The formerly-Upcoming session now shows a Canceled badge in Past.
    expect(container.textContent).toContain('Canceled — no attendance recorded.');
  });
});

// ---------------------------------------------------------------------------
// <MeetingsList /> -- student/parent view, all four DES-12 states
// ---------------------------------------------------------------------------

describe('<MeetingsList /> student/parent view', () => {
  it('loading state', () => {
    renderAsUser(STUDENT_OR_PARENT_USER, {
      loadStudentData: () => new Promise<StudentMeetingsData>(() => {}),
    });
    expect(container.textContent).toContain('Loading your meetings');
  });

  it('error state', async () => {
    renderAsUser(STUDENT_OR_PARENT_USER, {
      loadStudentData: () => Promise.reject(new Error('boom')),
    });
    await flushMicrotasks();
    expect(container.textContent).toContain("Couldn't load your meeting history");
  });

  it('empty state (no history, no participation row)', async () => {
    renderAsUser(STUDENT_OR_PARENT_USER, {
      loadStudentData: () => Promise.resolve({ history: [], participation: null }),
    });
    await flushMicrotasks();
    expect(container.textContent).toContain('No meeting history yet');
  });

  it('populated state: own history + participation % sourced from the fixture row verbatim', async () => {
    renderAsUser(STUDENT_OR_PARENT_USER, {
      studentId: PLACEHOLDER_CURRENT_STUDENT_ID,
      loadStudentData: defaultLoadStudentMeetingsData,
    });
    await flushMicrotasks();

    expect(container.textContent).toContain('57.1%');
    expect(container.textContent).toContain('Weekly Build Meeting');
    expect(container.textContent).toContain('Ravens Strategy Session');
    expect(container.textContent).toContain('Present');
    expect(container.textContent).toContain('Late');
    expect(container.textContent).toContain('Not yet held');

    // No row actions in the read-only student/parent view (MTG-14).
    expect(container.querySelector('[aria-label^="Actions for"]')).toBeNull();
    expect(container.textContent).not.toContain('Schedule meetings');

    // Consistency-strip placeholder disclosure (module doc #7d) -- no
    // StatusDot usage, clearly labeled as a future T037 deliverable.
    expect(container.textContent).toContain('T037');
    expect(container.textContent).toContain('consistency strip');

    // NAV-07: outreach content must never appear here either.
    expect(container.textContent).not.toContain('Community Food Drive');
  });

  it("participation renders '—' (never a fabricated %) when the student has no metric row", async () => {
    renderAsUser(STUDENT_OR_PARENT_USER, {
      studentId: 'student-with-zero-expected-sessions',
      loadStudentData: (studentId) => defaultLoadStudentMeetingsData(studentId),
    });
    await flushMicrotasks();
    expect(container.textContent).toContain('—');
    expect(container.textContent).not.toMatch(/\d+%/);
  });
});
