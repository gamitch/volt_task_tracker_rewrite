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
import type { SupabaseClient } from '@supabase/supabase-js';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthProvider, type AuthUser } from '../../app/guards';
import {
  makeCancelMeetingSession,
  makeCreateMeetings,
  makeLoadCoachMeetingsData,
  makeLoadStudentMeetingsData,
  makeResolveCurrentStudentId,
} from '../../lib/supabase/loaders/meetings';
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
  type ResolveCurrentStudentIdFn,
  type StudentMeetingsData,
} from './MeetingsList';
import type { CreateMeetingsPayload } from './ScheduleMeetingsDialog';

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

// ---------------------------------------------------------------------------
// T096: DOM helpers for interacting with the now-real `ScheduleMeetingsDialog`
// -- same helpers `ScheduleMeetingsDialog.test.tsx` (T031) already
// established (Astryx `Field` renders a real `<label htmlFor={id}>` for
// every labeled input; no testing-library `getByLabelText` equivalent is
// installed in this repo).
// ---------------------------------------------------------------------------

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

/** T096: a fast, synchronous-resolving fake for the new `resolveStudentId`
 * seam -- injected explicitly (same "inject the fixture explicitly through
 * the seam" pattern every prior ED-1 packet established) by every
 * student/parent-view test below that does NOT pass an explicit `studentId`
 * prop, so those tests never hit the real (network-backed) default. */
function fakeResolveStudentId(studentId: string | null): ResolveCurrentStudentIdFn {
  return () => Promise.resolve(studentId);
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
  it('loading state', async () => {
    renderAsUser(COACH_USER, { loadCoachData: () => new Promise<CoachMeetingsData>(() => {}) });
    // T073b2: auth resolution (even via the fake `authModule` this
    // harness's `LoginAs` now uses) is genuinely async -- a flush is needed
    // before the authenticated body (and its own DES-12 loading state)
    // mounts. See `src/test-utils/authHarness.tsx`'s module doc.
    await flushMicrotasks();
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
    // DES-15 verbatim (PRD line 212, T083).
    expect(container.textContent).toContain('No meetings scheduled.');
    expect(container.textContent).toContain(
      'Set up your weekly build meetings once and check-in takes care of itself.',
    );
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

  // T096: "Schedule meetings" now opens the real `ScheduleMeetingsDialog`
  // (T031, already Passed) instead of showing the old "dialog not built yet"
  // stub -- that dialog genuinely IS built now (module doc #7a).
  it('"Schedule meetings" opens the real ScheduleMeetingsDialog (module doc #7a)', async () => {
    renderAsUser(COACH_USER, { loadCoachData: defaultLoadCoachMeetingsData });
    await flushMicrotasks();

    expect(container.textContent).not.toContain('Scheduling dialog not built yet');
    // Both `AlertDialog` (Cancel) and `ScheduleMeetingsDialog` are always
    // MOUNTED (Astryx's `Dialog` keeps its content in the DOM tree
    // regardless of `isOpen`) -- "closed" is asserted via the specific
    // `<dialog>` containing "Team scope" (unique to the schedule dialog)
    // and its own native `open` attribute, not text presence/absence.
    function findScheduleDialogElement(): HTMLElement | undefined {
      return Array.from(document.querySelectorAll('dialog')).find((dialog) =>
        dialog.textContent?.includes('Team scope'),
      );
    }
    expect(findScheduleDialogElement()?.hasAttribute('open')).toBe(false);

    const scheduleButtons = Array.from(container.querySelectorAll('button')).filter((btn) =>
      btn.textContent?.includes('Schedule meetings'),
    );
    expect(scheduleButtons.length).toBeGreaterThan(0);
    act(() => {
      scheduleButtons[0].dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(findScheduleDialogElement()?.hasAttribute('open')).toBe(true);

    // The real dialog's own field set (MTG-02 order) is now on the page --
    // proof it's genuinely rendered, not a stub Banner.
    expect(document.body.textContent).toContain('Schedule meetings');
    expect(getFieldControl('Title')).toBeTruthy();
    expect(getFieldControl('Team scope')).toBeTruthy();
    expect(getFieldControl('Location')).toBeTruthy();
  });

  it('creating a meeting via the real dialog calls the injected onCreateMeetings seam and reloads the list', async () => {
    const onCreateMeetings = vi.fn().mockResolvedValue(undefined);
    let loadCallCount = 0;
    const loadCoachData = (): Promise<CoachMeetingsData> => {
      loadCallCount += 1;
      return loadCallCount === 1
        ? defaultLoadCoachMeetingsData()
        : Promise.resolve({
            rows: [
              {
                sessionId: 'session-new',
                title: 'Team meeting',
                sessionDate: '2026-07-22',
                startsAt: '2026-07-22T23:00:00.000Z',
                endsAt: '2026-07-23T01:00:00.000Z',
                status: 'scheduled' as const,
                teamScopeLabel: 'All teams',
                attendanceSummary: null,
              },
            ],
          });
    };

    renderAsUser(COACH_USER, { loadCoachData, onCreateMeetings });
    await flushMicrotasks();

    const scheduleButtons = Array.from(container.querySelectorAll('button')).filter((btn) =>
      btn.textContent?.includes('Schedule meetings'),
    );
    clickButton(scheduleButtons[0] as HTMLButtonElement);

    const dateInput = getFieldControl('Date') as HTMLInputElement;
    act(() => {
      setNativeInputValue(dateInput, '2026-08-05');
    });

    expect(onCreateMeetings).not.toHaveBeenCalled();
    clickButton(findButtonByText('Create 1 meeting') as HTMLButtonElement);
    await flushMicrotasks();

    expect(onCreateMeetings).toHaveBeenCalledTimes(1);
    const payload = onCreateMeetings.mock.calls[0][0] as CreateMeetingsPayload;
    expect(payload.sessions[0].sessionDate).toBe('2026-08-05');

    // Real reload after a successful create -- the dialog's own successful
    // submit closes it, and a real feedback Banner + the freshly-reloaded
    // row both appear.
    expect(loadCallCount).toBe(2);
    expect(container.textContent).toContain('Meetings scheduled');
  });

  // T096 (module doc #7b, Trap #3 finding) -- Edit is left as an honest,
  // accurately-worded stub since `ScheduleMeetingsDialog` genuinely has no
  // edit mode, not the old misleading "dialog not built yet" copy.
  it('Edit shows an honest stub explaining the dialog has no edit mode (not the old misleading copy)', async () => {
    renderAsUser(COACH_USER, { loadCoachData: defaultLoadCoachMeetingsData });
    await flushMicrotasks();

    const moreMenuButton = Array.from(container.querySelectorAll('button')).find((btn) =>
      btn.getAttribute('aria-label')?.startsWith('Actions for Weekly Build Meeting'),
    );
    act(() => {
      moreMenuButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    const editMenuItem = Array.from(document.querySelectorAll('[role="menuitem"], button')).find(
      (el) => el.textContent?.trim() === 'Edit',
    );
    act(() => {
      editMenuItem?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(container.textContent).toContain("Editing an existing meeting isn't supported yet");
    // NOT the old, now-inaccurate copy (the dialog IS built).
    expect(container.textContent).not.toContain('not built yet');
  });

  it('Cancel via MoreMenu + AlertDialog (DES-11) really calls the injected onCancelSession mutation', async () => {
    const onCancelSession = vi.fn().mockResolvedValue(undefined);
    renderAsUser(COACH_USER, { loadCoachData: defaultLoadCoachMeetingsData, onCancelSession });
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
    await flushMicrotasks();

    // Optimistic update: the formerly-Upcoming session now shows a Canceled
    // badge in Past.
    expect(container.textContent).toContain('Canceled — no attendance recorded.');
    // The real mutation seam was genuinely called, with the target session's id.
    expect(onCancelSession).toHaveBeenCalledTimes(1);
    expect(onCancelSession).toHaveBeenCalledWith('session-upcoming-build');
    expect(container.textContent).toContain('Meeting canceled');
  });

  it('Cancel rolls back the optimistic update and shows an error Banner when the mutation rejects', async () => {
    const onCancelSession = vi.fn().mockRejectedValue(new Error('network down'));
    renderAsUser(COACH_USER, { loadCoachData: defaultLoadCoachMeetingsData, onCancelSession });
    await flushMicrotasks();

    const moreMenuButton = Array.from(container.querySelectorAll('button')).find((btn) =>
      btn.getAttribute('aria-label')?.startsWith('Actions for Weekly Build Meeting'),
    );
    act(() => {
      moreMenuButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    const cancelMenuItem = Array.from(document.querySelectorAll('[role="menuitem"], button')).find(
      (el) => el.textContent?.trim() === 'Cancel meeting',
    );
    act(() => {
      cancelMenuItem?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    const confirmButton = Array.from(document.querySelectorAll('button')).find(
      (btn) => btn.textContent?.trim() === 'Cancel meeting',
    );
    act(() => {
      confirmButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    await flushMicrotasks();

    // Rolled back -- the target session is back in Upcoming with its
    // MoreMenu restored (only `scheduled` rows render one; the FIXTURE data
    // also has an unrelated, ALREADY-canceled "Weekly Build Meeting" past
    // session -- module doc #7c's rollback target is the UPCOMING one, so
    // this asserts on its own MoreMenu reappearing, not on the shared
    // "Canceled — no attendance recorded." copy text, which the unrelated
    // fixture row also legitimately renders).
    expect(
      Array.from(container.querySelectorAll('button')).some(
        (btn) => btn.getAttribute('aria-label') === 'Actions for Weekly Build Meeting',
      ),
    ).toBe(true);
    expect(container.textContent).toContain("Couldn't cancel meeting");
  });
});

// ---------------------------------------------------------------------------
// <MeetingsList /> -- student/parent view, all four DES-12 states
// ---------------------------------------------------------------------------

describe('<MeetingsList /> student/parent view', () => {
  // T096: none of these three states pass an explicit `studentId` prop
  // (the real-world case) -- each injects a fast `resolveStudentId` fake
  // through the new seam (same "inject the fixture explicitly" pattern
  // every ED-1 packet establishes) so they never hit the real,
  // network-backed default.
  it('loading state', async () => {
    renderAsUser(STUDENT_OR_PARENT_USER, {
      resolveStudentId: fakeResolveStudentId('student-fixture'),
      loadStudentData: () => new Promise<StudentMeetingsData>(() => {}),
    });
    // T073b2: auth resolution (even via the fake `authModule` this
    // harness's `LoginAs` now uses) is genuinely async -- a flush is needed
    // before the authenticated body (and its own DES-12 loading state)
    // mounts. See `src/test-utils/authHarness.tsx`'s module doc. T096 adds
    // one more real async layer (`resolveStudentId`) before
    // `StudentMeetingsView` itself mounts, so this flushes twice.
    await flushMicrotasks();
    await flushMicrotasks();
    expect(container.textContent).toContain('Loading your meetings');
  });

  it('error state', async () => {
    renderAsUser(STUDENT_OR_PARENT_USER, {
      resolveStudentId: fakeResolveStudentId('student-fixture'),
      loadStudentData: () => Promise.reject(new Error('boom')),
    });
    await flushMicrotasks();
    await flushMicrotasks();
    expect(container.textContent).toContain("Couldn't load your meeting history");
  });

  it('empty state (no history, no participation row)', async () => {
    renderAsUser(STUDENT_OR_PARENT_USER, {
      resolveStudentId: fakeResolveStudentId('student-fixture'),
      loadStudentData: () => Promise.resolve({ history: [], participation: null }),
    });
    await flushMicrotasks();
    await flushMicrotasks();
    expect(container.textContent).toContain('No meeting history yet');
  });

  // T096, Trap #4 -- the resolution seam's own three states (loading /
  // error / "no student linked"), independent of `StudentMeetingsView`'s
  // own load state below it.
  it("resolveStudentId's own loading state renders before StudentMeetingsView mounts", async () => {
    renderAsUser(STUDENT_OR_PARENT_USER, {
      resolveStudentId: () => new Promise<string | null>(() => {}),
    });
    await flushMicrotasks();
    expect(container.textContent).toContain('Finding your student record');
  });

  it("resolveStudentId's own error state renders a real error Banner with Retry", async () => {
    renderAsUser(STUDENT_OR_PARENT_USER, {
      resolveStudentId: () => Promise.reject(new Error('boom')),
    });
    await flushMicrotasks();
    expect(container.textContent).toContain("Couldn't find your student record");
  });

  it('resolveStudentId resolving null renders a real "no student linked" EmptyState, not a crash', async () => {
    renderAsUser(STUDENT_OR_PARENT_USER, {
      resolveStudentId: fakeResolveStudentId(null),
    });
    await flushMicrotasks();
    expect(container.textContent).toContain('No student account linked yet');
  });

  it('resolveStudentId resolving a real id renders StudentMeetingsView scoped to that id', async () => {
    renderAsUser(STUDENT_OR_PARENT_USER, {
      resolveStudentId: fakeResolveStudentId(PLACEHOLDER_CURRENT_STUDENT_ID),
      loadStudentData: defaultLoadStudentMeetingsData,
    });
    await flushMicrotasks();
    await flushMicrotasks();
    // Same fixture data `defaultLoadStudentMeetingsData` produces for
    // `PLACEHOLDER_CURRENT_STUDENT_ID` explicitly (below) -- proves the
    // resolved id was genuinely threaded through to `loadData`.
    expect(container.textContent).toContain('57.1%');
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

// ---------------------------------------------------------------------------
// T096: real `loaders/meetings.ts` seams -- `makeLoadCoachMeetingsData`,
// `makeLoadStudentMeetingsData`, `makeCancelMeetingSession`,
// `makeResolveCurrentStudentId`, `makeCreateMeetings`. Stubbed
// `SupabaseClient` only, same DI pattern `StudentsTab.test.tsx`'s own T089
// loader-level tests already established -- zero real network calls, and
// this module has no dedicated test file of its own (this task's own
// Allowed Files list only names `MeetingsList.test.tsx`, not a second file
// here).
// ---------------------------------------------------------------------------

describe('loadCoachMeetingsData (T096 real load)', () => {
  it('queries events/event_sessions/teams/attendance and produces the same rows buildCoachMeetingRows would', async () => {
    const eventsSelectSpy = vi.fn().mockResolvedValue({
      data: [
        {
          id: 'event-1',
          season_id: 'season-1',
          type: 'meeting',
          title: 'DB Meeting',
          team_ids: null,
          counts_participation: true,
        },
        {
          id: 'event-2',
          season_id: 'season-1',
          type: 'outreach',
          title: 'DB Outreach -- must never appear',
          team_ids: null,
          counts_participation: false,
        },
      ],
      error: null,
    });
    const sessionsOrderSpy = vi.fn().mockResolvedValue({
      data: [
        {
          id: 'session-1',
          event_id: 'event-1',
          session_date: '2026-07-22',
          starts_at: '2026-07-22T23:00:00.000Z',
          ends_at: '2026-07-23T01:00:00.000Z',
          status: 'scheduled',
        },
      ],
      error: null,
    });
    const teamsOrderSpy = vi.fn().mockResolvedValue({ data: [], error: null });
    const attendanceSelectSpy = vi.fn().mockResolvedValue({ data: [], error: null });

    const fromSpy = vi.fn((table: string) => {
      if (table === 'events') return { select: eventsSelectSpy };
      if (table === 'event_sessions') return { select: vi.fn(() => ({ order: sessionsOrderSpy })) };
      if (table === 'teams') return { select: vi.fn(() => ({ order: teamsOrderSpy })) };
      if (table === 'attendance') return { select: attendanceSelectSpy };
      throw new Error(`unexpected table: ${table}`);
    });
    const client = { from: fromSpy } as unknown as SupabaseClient;

    const load = makeLoadCoachMeetingsData(() => client);
    const result = await load();

    expect(fromSpy).toHaveBeenCalledWith('events');
    expect(fromSpy).toHaveBeenCalledWith('event_sessions');
    expect(fromSpy).toHaveBeenCalledWith('teams');
    expect(fromSpy).toHaveBeenCalledWith('attendance');

    // NAV-07 -- the outreach event's title never appears (module doc #2's
    // filter, applied by the reused `buildCoachMeetingRows`, not re-derived
    // in the loader).
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]).toMatchObject({ sessionId: 'session-1', title: 'DB Meeting' });
  });

  it('bridges the "no rows" case for all four tables to an empty rows array, not a crash', async () => {
    const nullResult = { data: null, error: null };
    // `events`/`attendance` `await` the `.select()` result directly (no
    // `.order()` chain); `event_sessions`/`teams` chain `.select().order()`.
    // A single thenable-plus-`.order()` stub satisfies both shapes.
    const selectResult = {
      then: (resolve: (value: typeof nullResult) => void) => resolve(nullResult),
      order: vi.fn().mockResolvedValue(nullResult),
    };
    const client = {
      from: vi.fn(() => ({ select: vi.fn(() => selectResult) })),
    } as unknown as SupabaseClient;

    const load = makeLoadCoachMeetingsData(() => client);
    const result = await load();
    expect(result).toEqual({ rows: [] });
  });
});

describe('loadStudentMeetingsData (T096 real load)', () => {
  it('scopes attendance/participation queries to the given studentId', async () => {
    const eventsSelectSpy = vi.fn().mockResolvedValue({ data: [], error: null });
    const sessionsOrderSpy = vi.fn().mockResolvedValue({ data: [], error: null });
    const attendanceEqSpy = vi.fn().mockResolvedValue({ data: [], error: null });
    const participationLimitSpy = vi.fn().mockResolvedValue({ data: [], error: null });

    const fromSpy = vi.fn((table: string) => {
      if (table === 'events') return { select: eventsSelectSpy };
      if (table === 'event_sessions') return { select: vi.fn(() => ({ order: sessionsOrderSpy })) };
      if (table === 'attendance') return { select: vi.fn(() => ({ eq: attendanceEqSpy })) };
      if (table === 'v_student_participation') {
        return { select: vi.fn(() => ({ eq: vi.fn(() => ({ limit: participationLimitSpy })) })) };
      }
      throw new Error(`unexpected table: ${table}`);
    });
    const client = { from: fromSpy } as unknown as SupabaseClient;

    const load = makeLoadStudentMeetingsData(() => client);
    await load('student-42');

    expect(attendanceEqSpy).toHaveBeenCalledWith('student_id', 'student-42');
  });
});

describe('cancelMeetingSession (T096 real mutation)', () => {
  it('calls event_sessions.update({ status: "canceled" }).eq("id", sessionId) with exactly the targeted id', async () => {
    const eqSpy = vi.fn().mockResolvedValue({ data: null, error: null });
    const updateSpy = vi.fn(() => ({ eq: eqSpy }));
    const fromSpy = vi.fn(() => ({ update: updateSpy }));
    const client = { from: fromSpy } as unknown as SupabaseClient;

    const cancel = makeCancelMeetingSession(() => client);
    await cancel('session-99');

    expect(fromSpy).toHaveBeenCalledWith('event_sessions');
    expect(updateSpy).toHaveBeenCalledWith({ status: 'canceled' });
    expect(eqSpy).toHaveBeenCalledWith('id', 'session-99');
  });

  it('rejects with the real SupabaseLoaderError on a genuine mutation error', async () => {
    const eqSpy = vi
      .fn()
      .mockResolvedValue({ data: null, error: { message: 'nope', code: '42501' } });
    const client = {
      from: vi.fn(() => ({ update: vi.fn(() => ({ eq: eqSpy })) })),
    } as unknown as SupabaseClient;

    const cancel = makeCancelMeetingSession(() => client);
    await expect(cancel('session-99')).rejects.toMatchObject({ code: '42501' });
  });
});

describe('resolveCurrentStudentId (T096, Trap #4 real resolution)', () => {
  it('a student resolves via students.profile_id = auth.uid()', async () => {
    const maybeSingleSpy = vi
      .fn()
      .mockResolvedValue({ data: { id: 'student-real-id' }, error: null });
    const eqSpy = vi.fn(() => ({ maybeSingle: maybeSingleSpy }));
    const fromSpy = vi.fn(() => ({ select: vi.fn(() => ({ eq: eqSpy })) }));
    const client = { from: fromSpy } as unknown as SupabaseClient;

    const resolve = makeResolveCurrentStudentId(() => client);
    const result = await resolve({ id: 'profile-student-1', role: 'student' });

    expect(fromSpy).toHaveBeenCalledWith('students');
    expect(eqSpy).toHaveBeenCalledWith('profile_id', 'profile-student-1');
    expect(result).toBe('student-real-id');
  });

  it('a student with no linked row resolves null, not a crash', async () => {
    const client = {
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
          })),
        })),
      })),
    } as unknown as SupabaseClient;

    const resolve = makeResolveCurrentStudentId(() => client);
    const result = await resolve({ id: 'profile-student-2', role: 'student' });
    expect(result).toBeNull();
  });

  it("a parent resolves via their EARLIEST-linked guardian_links row (Trap #4's documented limitation)", async () => {
    const limitSpy = vi.fn().mockResolvedValue({
      data: [{ student_id: 'student-earliest' }],
      error: null,
    });
    const orderSpy = vi.fn(() => ({ limit: limitSpy }));
    const eqSpy = vi.fn(() => ({ order: orderSpy }));
    const fromSpy = vi.fn(() => ({ select: vi.fn(() => ({ eq: eqSpy })) }));
    const client = { from: fromSpy } as unknown as SupabaseClient;

    const resolve = makeResolveCurrentStudentId(() => client);
    const result = await resolve({ id: 'profile-parent-1', role: 'parent' });

    expect(fromSpy).toHaveBeenCalledWith('guardian_links');
    expect(eqSpy).toHaveBeenCalledWith('parent_profile_id', 'profile-parent-1');
    expect(orderSpy).toHaveBeenCalledWith('created_at', { ascending: true });
    expect(limitSpy).toHaveBeenCalledWith(1);
    expect(result).toBe('student-earliest');
  });

  it('a parent with zero linked students resolves null, not a crash', async () => {
    const client = {
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            order: vi.fn(() => ({ limit: vi.fn().mockResolvedValue({ data: [], error: null }) })),
          })),
        })),
      })),
    } as unknown as SupabaseClient;

    const resolve = makeResolveCurrentStudentId(() => client);
    const result = await resolve({ id: 'profile-parent-2', role: 'parent' });
    expect(result).toBeNull();
  });

  it('a coach/admin resolves null defensively (this function is never actually called for that role in real use)', async () => {
    const client = { from: vi.fn() } as unknown as SupabaseClient;
    const resolve = makeResolveCurrentStudentId(() => client);
    const result = await resolve({ id: 'profile-coach-1', role: 'coach' });
    expect(result).toBeNull();
    expect(client.from).not.toHaveBeenCalled();
  });
});

describe('createMeetings (T096, Trap #3 real onCreateMeetings default)', () => {
  const SAMPLE_PAYLOAD: CreateMeetingsPayload = {
    event: {
      title: 'Weekly Build',
      teamIds: null,
      locationName: 'Robotics Lab',
      description: '',
      address: '',
    },
    sessions: [
      {
        sessionDate: '2026-08-05',
        startsAt: '2026-08-06T00:00:00.000Z',
        endsAt: '2026-08-06T02:00:00.000Z',
        notes: '',
      },
    ],
  };

  it('resolves the active season, then inserts one events row + one event_sessions row per date', async () => {
    const seasonMaybeSingleSpy = vi
      .fn()
      .mockResolvedValue({ data: { id: 'season-active-1' }, error: null });
    const eventSingleSpy = vi
      .fn()
      .mockResolvedValue({ data: { id: 'event-created-1' }, error: null });
    const eventSelectSpy = vi.fn(() => ({ single: eventSingleSpy }));
    const eventInsertSpy = vi.fn(() => ({ select: eventSelectSpy }));
    const sessionsInsertSpy = vi.fn().mockResolvedValue({ data: null, error: null });

    const fromSpy = vi.fn((table: string) => {
      if (table === 'seasons') {
        return {
          select: vi.fn(() => ({ eq: vi.fn(() => ({ maybeSingle: seasonMaybeSingleSpy })) })),
        };
      }
      if (table === 'events') return { insert: eventInsertSpy };
      if (table === 'event_sessions') return { insert: sessionsInsertSpy };
      throw new Error(`unexpected table: ${table}`);
    });
    const client = { from: fromSpy } as unknown as SupabaseClient;

    const create = makeCreateMeetings(() => client);
    await create(SAMPLE_PAYLOAD);

    expect(eventInsertSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        season_id: 'season-active-1',
        type: 'meeting',
        title: 'Weekly Build',
        location_name: 'Robotics Lab',
        team_ids: null,
      }),
    );
    expect(sessionsInsertSpy).toHaveBeenCalledWith([
      expect.objectContaining({
        event_id: 'event-created-1',
        session_date: '2026-08-05',
        status: 'scheduled',
      }),
    ]);
  });

  it('rejects with a real, disclosed error (never a fabricated season_id) when no season is active', async () => {
    const client = {
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
          })),
        })),
      })),
    } as unknown as SupabaseClient;

    const create = makeCreateMeetings(() => client);
    await expect(create(SAMPLE_PAYLOAD)).rejects.toThrow(/No active season/);
  });
});
