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
import { MemoryRouter } from 'react-router-dom';
import type { SupabaseClient } from '@supabase/supabase-js';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthProvider, type AuthUser } from '../../app/guards';
import * as meetingsLoadersNs from '../../lib/supabase/loaders/meetings';
import {
  aggregateParticipationRows,
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
  buildDateRangeLabel,
  buildRecurrenceChips,
  buildStudentMeetingsData,
  defaultLoadCoachMeetingsData,
  defaultLoadStudentMeetingsData,
  formatDuration,
  formatHoursLabel,
  formatTimeRangeWithDuration,
  formatWeekdayDate,
  partitionByStatus,
  partitionCoachMeetingRows,
  PLACEHOLDER_CURRENT_STUDENT_ID,
  summarizeCoachMeetingRow,
  type CoachMeetingsData,
  type ResolveCurrentStudentIdFn,
  type StudentMeetingHistoryRow,
  type StudentMeetingsData,
  type StudentParticipationMetric,
} from './MeetingsList';
import { defaultLoadConsistencyStripData, type ConsistencyStripData } from './StudentMeetingView';
import type { CreateMeetingsPayload } from './ScheduleMeetingsDialog';
import type { ResolveStudentIsActiveFn } from '../../lib/supabase/loaders/students';

// ---------------------------------------------------------------------------
// T180 §3a (BLOCKER 1, gate round 1) -- the mount this task adds uses
// `StudentMeetingView`'s own default `loadStripData` seam
// (`loadConsistencyStripData`, `../../lib/supabase/loaders/checkin.ts`), a
// REAL Supabase query. With `.env.local` absent that query rejects in every
// student/parent test below, landing the strip in its own DES-12 error
// branch and breaking three pre-existing assertions (measured, gate round 1
// BLOCKER 1). Same module-level-mock shape `DashboardPage.test.tsx`
// (T176 gate) and `OutreachList.test.tsx` (`loadSelfCheckoffAttendance`,
// T170) already established for this exact failure shape.
//
// Lazy-holder shape, not a factory-level `await import('./StudentMeetingView')`
// -- the gate measured that shape dying on the circular module graph
// (`TypeError: loadData is not a function`, and separately
// `ReferenceError: Cannot access '__vi_import_6__' before initialization`).
// `beforeEach` below points `stripSeam.load` at the real
// `defaultLoadConsistencyStripData` fixture builder (imported directly, not
// through the mocked module) so every pre-existing test that reaches the
// mount gets a real, resolving (if fixture-empty for most ids -- Trap #3's
// disjoint id-spaces) strip instead of the network error branch; individual
// criteria below override `stripSeam.load` per test.
// ---------------------------------------------------------------------------
const stripSeam = vi.hoisted(() => ({
  load: null as null | ((studentId: string) => Promise<ConsistencyStripData>),
}));
vi.mock('../../lib/supabase/loaders/checkin', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../lib/supabase/loaders/checkin')>();
  return {
    ...actual,
    loadConsistencyStripData: (studentId: string) => stripSeam.load!(studentId),
  };
});

// ---------------------------------------------------------------------------
// C4 -- module-level spy target for `resolveCurrentStudentId`
// (`../../lib/supabase/loaders/meetings.ts`), the seam
// `StudentMeetingView.tsx`'s own `OwnStudentConsistencyStrip` falls back to
// when the mount does NOT receive an explicit `studentId` (module doc #9 of
// that file). C4 itself does `vi.spyOn(meetingsLoadersNs, 'resolveCurrentStudentId')`
// locally rather than a file-level `vi.mock('../../lib/supabase/loaders/meetings', ...)`.
//
// T180 follow-up (checker PASS-with-MINOR item 2): stating only what was
// measured. Three facts, confirmed directly:
//   1. A `vi.mock('../../lib/supabase/loaders/meetings', ...)` factory here
//      reads 0 calls on `spy` under BOTH correct code and the C4 mutation --
//      it never discriminates, so it cannot back this criterion.
//   2. That same mocked module DOES intercept a direct call made from this
//      test file itself.
//   3. `vi.spyOn(meetingsLoadersNs, 'resolveCurrentStudentId')` reads 1 under
//      the C4 mutation and 0 under correct code -- it discriminates, which is
//      why C4 uses it.
// A HYPOTHESIS, not established by measurement, for why (1) happens: this
// module sits one hop into the `checkin.ts` <-> `StudentMeetingView.tsx`
// circular import this file also routes around for the strip's own load
// seam, and the `resolveStudentId` default-parameter reference
// `StudentMeetingView.tsx` receives may bind to the real function instead of
// the `vi.mock`'d one as a result. The probe built to isolate this --
// removing `checkin`'s own mock to see whether the resolver is even reached
// -- was confounded: with that mock gone, the real `checkin` loader rejects,
// so "the resolver was never reached" could not be told apart from "the mock
// was never installed." Do not restate the circular-import mechanism as the
// established cause; only (1)-(3) above are measured. `vi.spyOn` on the
// shared namespace object works regardless of the mechanism -- it patches the
// property in place on the one module object every consumer already holds a
// live binding to, and does not go through a second `vi.mock`/
// `importOriginal` registration at all. Every other test in this file reaches
// the student/parent view via an explicit `studentId` prop or the host's own
// `resolveStudentId` prop (never the real default), so nothing else in this
// file exercises this seam; C4 is this spy's only consumer, and restores it
// with `spy.mockRestore()`. `makeResolveCurrentStudentId` (used directly,
// unmocked, by the `resolveCurrentStudentId (T096, Trap #4 real resolution)`
// describe block below) is a different export, untouched by this.
// ---------------------------------------------------------------------------

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

/** T511 -- `MemoryRouter` is required, not decorative: the coach session row now
 * renders a real `Link as={RouterLink}` to the live console, and `RouterLink`
 * throws `Cannot destructure property 'basename'` outside a router context.
 * Same wrapper `LiveConsole.test.tsx` and `CheckinResult.test.tsx` already use
 * for the same reason. It is additive -- every pre-existing assertion in this
 * file is unaffected by having a router in the tree. */
function renderAsUser(user: AuthUser, props: Parameters<typeof MeetingsList>[0] = {}): void {
  act(() => {
    root.render(
      <MemoryRouter>
        <AuthProvider>
          <LoginAs user={user}>
            <MeetingsList {...props} />
          </LoginAs>
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

/** T135 (Table migration, Trap 1/2 of that task's own worker packet) --
 * expands a coach meeting row's session detail. Astryx's `Collapsible` used
 * to keep its content always mounted in the DOM (only CSS-hidden while
 * collapsed), so no click was ever needed to find session-detail text; row
 * splicing (the `Table` migration's mechanism) genuinely removes those rows
 * from the DOM until expanded, so a real click is now required. Finds the
 * expander by its accessible name (`Show session details – {title}` /
 * `Hide session details – {title}`) rather than its shared visible text
 * (`Session details (N)`, which is NOT unique across rows -- every row's
 * expander carries that same shape). */
function expandRow(eventTitle: string): void {
  const expander = Array.from(document.querySelectorAll('button')).find((button) =>
    button.getAttribute('aria-label')?.startsWith(`Show session details – ${eventTitle}`),
  );
  if (!expander) {
    throw new Error(`No expander button found for "${eventTitle}"`);
  }
  clickButton(expander);
}

/** T096: a fast, synchronous-resolving fake for the new `resolveStudentId`
 * seam -- injected explicitly (same "inject the fixture explicitly through
 * the seam" pattern every prior ED-1 packet established) by every
 * student/parent-view test below that does NOT pass an explicit `studentId`
 * prop, so those tests never hit the real (network-backed) default. */
function fakeResolveStudentId(studentId: string | null): ResolveCurrentStudentIdFn {
  return () => Promise.resolve(studentId);
}

/** T189 (packet v2 §7) -- same "inject the fixture explicitly through the
 * seam" pattern as `fakeResolveStudentId` immediately above, for the new
 * `resolveStudentIsActive` seam. Injected at every resolved-path test below
 * that does NOT pass an explicit `studentId` prop, so those tests never hit
 * the real (network-backed) default -- same trap `fakeResolveStudentId`'s
 * own doc names, now a second, independent seam that reaches the same real
 * loader shape (`createLoader`, `.env.local`-dependent) if left
 * un-injected. Defaults every pre-existing (pre-T189) test back to `true`
 * ("active", i.e. today's behavior, unchanged) rather than leaving them to
 * hit the real default. */
function fakeResolveStudentIsActive(isActive: boolean | null = true): ResolveStudentIsActiveFn {
  return () => Promise.resolve(isActive);
}

/** T180 C3/C7 -- `[role="progressbar"]`'s accessible name resolves through
 * `aria-labelledby`, NOT `aria-label` (Trap #9, measured DOM:
 * `aria-labelledby="_r_9_"`). Never `aria-label`, which Astryx's
 * `ProgressBar` does not set. */
function progressBarNames(): string[] {
  return Array.from(container.querySelectorAll('[role="progressbar"]')).map((el) => {
    const labelledBy = el.getAttribute('aria-labelledby');
    if (!labelledBy) return '';
    return document.getElementById(labelledBy)?.textContent ?? '';
  });
}

/** T180 C1/C5/C7 -- the strip's dots are Astryx `StatusDot`s, rendered
 * `role="img"` PLUS the stable `astryx-statusdot` class. `role="img"` alone
 * is not unique on this page: this page's own `Table` pagination also
 * renders `role="img"` (Astryx `Kbd`, "Left arrow"/"Right arrow" hints) --
 * measured live, `StudentMeetingView.test.tsx`'s own `statusDotVariants`/
 * `statusDotLabels` helpers get away with the bare `role="img"` query only
 * because that file's own container never renders a `Table`/`Kbd` inside
 * it. The class selector is what actually discriminates on this page. */
function stripDotCount(): number {
  return container.querySelectorAll('[role="img"].astryx-statusdot').length;
}

/** T180 C8 -- the rendered heading outline, `H{level}:{text}`. */
function headingOutline(): string[] {
  return Array.from(container.querySelectorAll('h1,h2,h3,h4,h5,h6')).map(
    (el) => `H${el.tagName.slice(1)}:${el.textContent}`,
  );
}

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  // T180 §3a -- default every test to a real, resolving (fixture-driven)
  // strip load instead of the network-backed default, so pre-existing tests
  // that reach the mount (the populated student/parent branch) don't land
  // in the strip's own error branch. Individual criteria override this per
  // test.
  stripSeam.load = (studentId) => defaultLoadConsistencyStripData(studentId);
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

describe('formatHoursLabel (T122 module doc #10b)', () => {
  it('renders a whole-hour value without a decimal', () => {
    expect(formatHoursLabel(2)).toBe('2h');
    expect(formatHoursLabel(0)).toBe('0h');
  });

  it('renders a fractional value rounded to one decimal', () => {
    expect(formatHoursLabel(1.5)).toBe('1.5h');
    expect(formatHoursLabel(1.449)).toBe('1.4h');
  });
});

describe('buildRecurrenceChips / buildDateRangeLabel (T122 module doc #10b)', () => {
  it('groups by weekday in first-seen order for a multi-session set', () => {
    const sessions = [
      { sessionDate: '2026-07-06' }, // Mon
      { sessionDate: '2026-07-09' }, // Thu
      { sessionDate: '2026-07-13' }, // Mon
    ];
    expect(buildRecurrenceChips(sessions)).toEqual(['MON (2)', 'THU (1)']);
  });

  it('returns no chips for a single session', () => {
    expect(buildRecurrenceChips([{ sessionDate: '2026-07-06' }])).toEqual([]);
  });

  it('returns no chips and an empty date range label for zero sessions', () => {
    expect(buildRecurrenceChips([])).toEqual([]);
    expect(buildDateRangeLabel([])).toBe('');
  });

  it('date range label is a single date for one session, a range for multiple', () => {
    expect(buildDateRangeLabel([{ sessionDate: '2026-07-22' }])).toBe('Wed, Jul 22');
    expect(
      buildDateRangeLabel([{ sessionDate: '2026-07-22' }, { sessionDate: '2026-07-08' }]),
    ).toBe('Wed, Jul 8 – Wed, Jul 22'); // sorted ascending regardless of input order
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

// T122 (module doc #10a): a single reusable multi-session fixture event used
// by several tests below -- three sessions on the SAME weekday (one
// scheduled, one completed, one canceled), so `buildRecurrenceChips` has a
// genuine 3-count chip to prove and `summarizeCoachMeetingRow` has all three
// statuses to aggregate across in one event.
const MULTI_SESSION_EVENT = {
  id: 'e1',
  seasonId: 's1',
  type: 'meeting' as const,
  title: 'M',
  teamIds: null,
  countsParticipation: true,
  locationName: 'Robotics Lab',
  address: '123 Main St',
};
const MULTI_SESSION_SESSIONS = [
  {
    id: 'sess-scheduled',
    eventId: 'e1',
    sessionDate: '2026-07-22', // Wed
    startsAt: '2026-07-22T23:00:00.000Z',
    endsAt: '2026-07-23T01:00:00.000Z', // 2h
    status: 'scheduled' as const,
  },
  {
    id: 'sess-completed',
    eventId: 'e1',
    sessionDate: '2026-07-15', // Wed
    startsAt: '2026-07-15T23:00:00.000Z',
    endsAt: '2026-07-16T01:00:00.000Z', // 2h
    status: 'completed' as const,
  },
  {
    id: 'sess-canceled',
    eventId: 'e1',
    sessionDate: '2026-07-08', // Wed
    startsAt: '2026-07-08T23:00:00.000Z',
    endsAt: '2026-07-09T01:00:00.000Z', // 2h
    status: 'canceled' as const,
  },
];

describe('buildCoachMeetingRows (NAV-07, T122 module doc #10a)', () => {
  it('excludes outreach-typed events entirely', async () => {
    const { rows } = await defaultLoadCoachMeetingsData();
    expect(rows.some((r) => r.title === 'Community Food Drive')).toBe(false);
    expect(rows.length).toBeGreaterThan(0);
  });

  it('groups sessions into ONE row per event (not one row per session)', () => {
    const rows = buildCoachMeetingRows([MULTI_SESSION_EVENT], MULTI_SESSION_SESSIONS, [], []);
    expect(rows).toHaveLength(1);
    expect(rows[0].eventId).toBe('e1');
    expect(rows[0].locationName).toBe('Robotics Lab');
    expect(rows[0].sessions.map((s) => s.sessionId)).toEqual([
      'sess-canceled',
      'sess-completed',
      'sess-scheduled',
    ]); // sorted ascending by startsAt
  });

  it('an event with zero sessions produces no row', () => {
    const rows = buildCoachMeetingRows([{ ...MULTI_SESSION_EVENT, id: 'e-empty' }], [], [], []);
    expect(rows).toHaveLength(0);
  });

  it('computes a per-session attendance summary only for completed sessions', () => {
    const rows = buildCoachMeetingRows(
      [MULTI_SESSION_EVENT],
      MULTI_SESSION_SESSIONS,
      [],
      [
        { sessionId: 'sess-completed', studentId: 'stu-1', status: 'present' },
        { sessionId: 'sess-completed', studentId: 'stu-2', status: 'late' },
      ],
    );
    const sessions = rows[0].sessions;
    const scheduled = sessions.find((s) => s.sessionId === 'sess-scheduled');
    const completed = sessions.find((s) => s.sessionId === 'sess-completed');
    expect(scheduled?.attendanceSummary).toBeNull();
    expect(completed?.attendanceSummary).toEqual({
      presentCt: 1,
      lateCt: 1,
      excusedCt: 0,
      absentCt: 0,
    });
  });

  it('computes real per-session expected counts from going RSVPs, and attendee names for completed sessions', () => {
    const rows = buildCoachMeetingRows(
      [MULTI_SESSION_EVENT],
      MULTI_SESSION_SESSIONS,
      [],
      [
        { sessionId: 'sess-completed', studentId: 'stu-1', status: 'present' },
        { sessionId: 'sess-completed', studentId: 'stu-2', status: 'late' },
        { sessionId: 'sess-completed', studentId: 'stu-3', status: 'absent' },
        // Present, but no matching row in `students` below -- proves the
        // honest "Unknown student" fallback, never a silent drop.
        { sessionId: 'sess-completed', studentId: 'stu-unmatched', status: 'present' },
      ],
      [
        { sessionId: 'sess-scheduled', studentId: 'stu-1', status: 'going' },
        { sessionId: 'sess-scheduled', studentId: 'stu-2', status: 'going' },
        { sessionId: 'sess-scheduled', studentId: 'stu-3', status: 'declined' },
      ],
      [
        { id: 'stu-1', displayName: 'Zoe Ann' },
        { id: 'stu-2', displayName: 'Amir Lee' },
      ],
    );
    const sessions = rows[0].sessions;
    const scheduled = sessions.find((s) => s.sessionId === 'sess-scheduled');
    const completed = sessions.find((s) => s.sessionId === 'sess-completed');
    // Only 'going' counted, not 'declined'.
    expect(scheduled?.expectedCt).toBe(2);
    // Attendee names sorted alphabetically; 'absent' is excluded entirely;
    // the unmatched present student falls back to an honest placeholder,
    // never a silent drop.
    expect(completed?.attendeeNames).toEqual(['Amir Lee', 'Unknown student', 'Zoe Ann']);
    // Scheduled sessions have no attendance yet -- no names.
    expect(scheduled?.attendeeNames).toEqual([]);
  });
});

describe('summarizeCoachMeetingRow (T122 module doc #10b)', () => {
  it('sums planned hours across non-canceled sessions and logged hours across completed sessions only', () => {
    const rows = buildCoachMeetingRows([MULTI_SESSION_EVENT], MULTI_SESSION_SESSIONS, [], []);
    const summary = summarizeCoachMeetingRow(rows[0].sessions);
    // planned = scheduled (2h) + completed (2h) = 4h; canceled excluded.
    expect(summary.plannedHours).toBe(4);
    // logged = completed only = 2h.
    expect(summary.loggedHours).toBe(2);
    expect(summary.canceledCt).toBe(1);
  });

  it('builds recurrence chips grouped by weekday, and a date range label', () => {
    const rows = buildCoachMeetingRows([MULTI_SESSION_EVENT], MULTI_SESSION_SESSIONS, [], []);
    const summary = summarizeCoachMeetingRow(rows[0].sessions);
    // All three sessions fall on a Wednesday -- UXD-02's own worked example
    // shape ("MON (18) · THU (18)"), here a single "WED (3)" chip.
    expect(summary.recurrenceChips).toEqual(['WED (3)']);
    expect(summary.dateRangeLabel).toBe('Wed, Jul 8 – Wed, Jul 22');
  });

  it('produces no recurrence chips for a single-session event (the date range line covers it alone)', () => {
    const rows = buildCoachMeetingRows([MULTI_SESSION_EVENT], [MULTI_SESSION_SESSIONS[0]], [], []);
    const summary = summarizeCoachMeetingRow(rows[0].sessions);
    expect(summary.recurrenceChips).toEqual([]);
    expect(summary.dateRangeLabel).toBe('Wed, Jul 22');
  });

  it('sums expected/attended counts across every session (cumulative, not unique headcount)', () => {
    const rows = buildCoachMeetingRows(
      [MULTI_SESSION_EVENT],
      MULTI_SESSION_SESSIONS,
      [],
      [
        { sessionId: 'sess-completed', studentId: 'stu-1', status: 'present' },
        { sessionId: 'sess-completed', studentId: 'stu-2', status: 'late' },
      ],
      [
        { sessionId: 'sess-scheduled', studentId: 'stu-1', status: 'going' },
        { sessionId: 'sess-scheduled', studentId: 'stu-2', status: 'going' },
        { sessionId: 'sess-scheduled', studentId: 'stu-3', status: 'going' },
      ],
      [],
    );
    const summary = summarizeCoachMeetingRow(rows[0].sessions);
    expect(summary.expectedCt).toBe(3); // scheduled session's 'going' RSVPs
    expect(summary.attendedCt).toBe(2); // completed session's present+late
  });

  it('hasUpcomingSession is true when ANY session is still scheduled, sortStartsAt picks the nearest upcoming one', () => {
    const rows = buildCoachMeetingRows([MULTI_SESSION_EVENT], MULTI_SESSION_SESSIONS, [], []);
    const summary = summarizeCoachMeetingRow(rows[0].sessions);
    expect(summary.hasUpcomingSession).toBe(true);
    expect(summary.sortStartsAt).toBe('2026-07-22T23:00:00.000Z');
  });

  it('hasUpcomingSession is false once every session is completed/canceled, sortStartsAt picks the latest one', () => {
    const pastOnly = MULTI_SESSION_SESSIONS.filter((s) => s.status !== 'scheduled');
    const rows = buildCoachMeetingRows([MULTI_SESSION_EVENT], pastOnly, [], []);
    const summary = summarizeCoachMeetingRow(rows[0].sessions);
    expect(summary.hasUpcomingSession).toBe(false);
    expect(summary.sortStartsAt).toBe('2026-07-15T23:00:00.000Z'); // sess-completed, latest of the two
  });
});

describe('partitionCoachMeetingRows (T122 module doc #10c)', () => {
  it('buckets a row into Upcoming when it has ANY scheduled session, even alongside past ones', () => {
    const rows = buildCoachMeetingRows([MULTI_SESSION_EVENT], MULTI_SESSION_SESSIONS, [], []);
    const { upcoming, past } = partitionCoachMeetingRows(rows);
    expect(upcoming.map((r) => r.eventId)).toEqual(['e1']);
    expect(past).toEqual([]);
  });

  it('buckets a row into Past once every one of its sessions is completed/canceled', () => {
    const pastOnly = MULTI_SESSION_SESSIONS.filter((s) => s.status !== 'scheduled');
    const rows = buildCoachMeetingRows([MULTI_SESSION_EVENT], pastOnly, [], []);
    const { upcoming, past } = partitionCoachMeetingRows(rows);
    expect(upcoming).toEqual([]);
    expect(past.map((r) => r.eventId)).toEqual(['e1']);
  });
});

describe('buildStudentMeetingsData (constitution item 3)', () => {
  it('never computes participationPct -- copies it verbatim from the metric row', () => {
    const data = buildStudentMeetingsData(
      'stu-1',
      [{ ...MULTI_SESSION_EVENT }],
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
    renderAsUser(COACH_USER, { loadCoachData: () => Promise.resolve({ rows: [], teams: [] }) });
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
    // T135 (Table migration) Trap 1, authorized: the hours `StatCell`'s own
    // label is literally the word "Scheduled" -- this assertion survives
    // only because §1 of that task's packet pins that label; it is not
    // independent proof of a session-status badge (see the expanded
    // assertions below for that).
    expect(container.textContent).toContain('Scheduled');
    // "Completed" survives via the Past section's own `EmptyState`
    // description ("Completed and canceled meetings will show up here.") --
    // by luck rather than design (T135 packet Trap 1), since this fixture's
    // Past bucket is empty. Not relied upon as proof of a session badge.
    expect(container.textContent).toContain('Completed');

    // T135 (Table migration) Trap 1: row splicing means a session's own
    // status badge ("Canceled") and its attendance summary ("present") only
    // exist in the DOM once this row's expander has been clicked -- unlike
    // the old `Collapsible`, whose content stayed mounted (CSS-hidden, not
    // removed) even while collapsed.
    expandRow('Weekly Build Meeting');
    expect(container.textContent).toContain('Canceled');
    expect(container.textContent).toContain('present');
    expect(container.textContent).toContain('Schedule meetings');

    // NAV-07: outreach content must never appear.
    expect(container.textContent).not.toContain('Community Food Drive');
  });

  // T122 (UXD-02 density standard) -- date/recurrence chips, location,
  // planned/logged hours, expected/attended counts all render on the row.
  it('renders UXD-02 dense-row fields: recurrence chip, date range, location, planned/logged hours, expected/attended', async () => {
    renderAsUser(COACH_USER, { loadCoachData: defaultLoadCoachMeetingsData });
    await flushMicrotasks();

    // "Weekly Build Meeting" has 3 sessions, all on Wednesdays.
    expect(container.textContent).toContain('WED (3)');
    expect(container.textContent).toContain('Wed, Jul 8 – Wed, Jul 22');
    expect(container.textContent).toContain('Robotics Lab');
    // T135 (Table migration) Trap 3, authorized: `StatCell` renders its
    // label and value with NO separator (`StatCell.tsx:56-61`; its own test
    // pins "Planned3h") and its `secondary` tier as its own separate line --
    // the old single-run "4h scheduled · 2h held" string no longer exists as
    // one run of text. Same real numbers (planned = scheduled 2h + completed
    // 2h = 4h, canceled excluded; logged = completed only = 2h), asserted in
    // their new per-cell homes instead of weakened to a substring-of-anything
    // check.
    expect(container.textContent).toContain('Scheduled4h');
    expect(container.textContent).toContain('2h held');
    // expected = session-upcoming-build's 5 'going' RSVPs; attended =
    // session-past-build-completed's 3 present + 1 late. Same split reason.
    expect(container.textContent).toContain('Expected5');
    expect(container.textContent).toContain('Attended 4');

    // "Ravens Strategy Session" has 2 sessions, both on Saturdays.
    expect(container.textContent).toContain('SAT (2)');
    expect(container.textContent).toContain('Ravens Team Room');
    expect(container.textContent).toContain('Scheduled3h');
    expect(container.textContent).toContain('1.5h held');
    expect(container.textContent).toContain('Expected2');
    expect(container.textContent).toContain('Attended 3');

    // UXD-03: expander trigger text is always visible (it is the `Button`'s
    // own children, not conditionally-rendered `Collapsible` content), so no
    // click is needed for these two.
    expect(container.textContent).toContain('Session details (3)');
    expect(container.textContent).toContain('Session details (2)');
    // T135 (Table migration) Trap 1, authorized: unlike the old `Collapsible`
    // (content always mounted, only CSS-hidden while collapsed), row
    // splicing genuinely removes a session-detail row from the DOM until its
    // parent row's expander is clicked -- the attendee-names line lives
    // inside that spliced-in row.
    expandRow('Weekly Build Meeting');
    expect(container.textContent).toContain('Attended: Alex Rivera, Bailey Chen, Casey Nguyen');
  });

  // -------------------------------------------------------------------------
  // T129/UXC-01: one heading per section. `CoachMeetingsSection`'s own
  // `List`'s `header` prop was removed (it used to print "Upcoming
  // meetings"/"Past meetings" a second time, per `List.tsx:194-201`); its
  // `Heading` now carries a `useId`-generated id, and a
  // `<div role="group">` wrapping the List/EmptyState ternary carries
  // `aria-labelledby={headingId}` -- present in BOTH branches, so the
  // region's accessible name survives even when there is no `List` to
  // attach a `header` to.
  //
  // CHECKER FIX (rework of T129, MAJOR): the wrapper was originally an
  // Astryx `Section`, which applies a full-bleed negative-margin band
  // unconditionally and renders a bare, role-less `<div>` that cannot
  // support `aria-labelledby` under ARIA. A plain `<div role="group">`
  // fixes both; the query below includes `role="group"` so a regression
  // back to a role-less wrapper fails the lookup itself, not just a later
  // assertion.
  // -------------------------------------------------------------------------
  describe('T129 UXC-01 -- exactly one heading per Upcoming/Past section', () => {
    function resolveAriaLabelledbyTarget(headingText: string): {
      headingId: string;
      resolvedText: string | null;
    } {
      const heading = Array.from(container.querySelectorAll('h2')).find(
        (h) => h.textContent === headingText,
      );
      expect(heading).toBeTruthy();
      const headingId = heading!.id;
      expect(headingId).toBeTruthy();
      const labelledEl = container.querySelector(`[role="group"][aria-labelledby="${headingId}"]`);
      expect(labelledEl).toBeTruthy();
      expect(labelledEl!.getAttribute('role')).toBe('group');
      const resolvedId = labelledEl!.getAttribute('aria-labelledby')!;
      const resolvedEl = document.getElementById(resolvedId);
      return { headingId, resolvedText: resolvedEl?.textContent ?? null };
    }

    it('populated branch: both "Upcoming" and "Past" resolve aria-labelledby back to their own Heading, printed exactly once', async () => {
      renderAsUser(COACH_USER, { loadCoachData: defaultLoadCoachMeetingsData });
      await flushMicrotasks();

      for (const title of ['Upcoming', 'Past']) {
        const { resolvedText } = resolveAriaLabelledbyTarget(title);
        expect(resolvedText).toBe(title);
        const leafMatches = Array.from(container.querySelectorAll('*')).filter(
          (el) => el.children.length === 0 && el.textContent === title,
        );
        expect(leafMatches.length).toBe(1);
      }
    });

    it('empty branch: "Upcoming" has no scheduled sessions -- its aria-labelledby still resolves to its Heading, even with no List rendered ("Past" stays populated in the same render)', async () => {
      const pastOnlyRow: CoachMeetingsData = {
        rows: [
          {
            eventId: 'event-past-only',
            title: 'Archived Strategy Session',
            locationName: 'Robotics Lab',
            teamScopeLabel: 'All teams',
            sessions: [
              {
                sessionId: 'session-past-only',
                sessionDate: '2026-01-05',
                startsAt: '2026-01-05T18:00:00.000Z',
                endsAt: '2026-01-05T20:00:00.000Z',
                status: 'completed',
                durationHours: 2,
                expectedCt: 0,
                attendanceSummary: { presentCt: 0, lateCt: 0, excusedCt: 0, absentCt: 0 },
                attendeeNames: [],
              },
            ],
          },
        ],
        teams: [],
      };
      renderAsUser(COACH_USER, { loadCoachData: () => Promise.resolve(pastOnlyRow) });
      await flushMicrotasks();

      // Confirm "Upcoming" really is the EmptyState branch (per its own
      // `emptyDescription`), not a load failure.
      expect(container.textContent).toContain('No meetings are currently scheduled.');
      expect(container.textContent).toContain('Archived Strategy Session');

      for (const title of ['Upcoming', 'Past']) {
        const { resolvedText } = resolveAriaLabelledbyTarget(title);
        expect(resolvedText).toBe(title);
      }
    });
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
                eventId: 'event-new',
                title: 'Team meeting',
                locationName: 'Robotics Lab',
                teamScopeLabel: 'All teams',
                sessions: [
                  {
                    sessionId: 'session-new',
                    sessionDate: '2026-07-22',
                    startsAt: '2026-07-22T23:00:00.000Z',
                    endsAt: '2026-07-23T01:00:00.000Z',
                    status: 'scheduled' as const,
                    durationHours: 2,
                    expectedCt: 0,
                    attendanceSummary: null,
                    attendeeNames: [],
                  },
                ],
              },
            ],
            teams: [],
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

  // -------------------------------------------------------------------------
  // T147: the outreach/meetings team picker shows fixture teams to real
  // users -- the meetings half, "the one that actually blocks a core create
  // flow" (packet). `ScheduleMeetingsDialog`'s own `teams` prop now gets the
  // already-fetched `loaders/meetings.ts` teams (threaded through
  // `CoachMeetingsData`) instead of falling back to that dialog's own
  // `DEFAULT_TEAMS` fixture (`'team-ravens'`/`'team-titans'`, non-uuid
  // strings that fail the real `events.team_ids uuid[]` insert -- "Couldn't
  // create these meetings.").
  //
  // Create mode has no `initialData`/edit mode at all (module doc #7b) --
  // `allTeamIds` (derived straight from the `teams` prop) seeds
  // `selectedTeamIds` on open, so this dialog needs no edit-mode fixture
  // trick, unlike `OutreachEventDialog`'s edit-mode sites.
  //
  // Assertion mechanism -- UUID shape on the submitted payload, never a
  // name-based assertion (this file's own `FIXTURE_EVENTS`/`FIXTURE_TEAMS`
  // literally contain the text "Ravens" in unrelated fixture content --
  // `:737`/`:740` -- so a name-based assertion cannot discriminate here).
  // -------------------------------------------------------------------------
  it('T147: deselecting one team submits a teamIds array of real UUIDs from the teams prop, never the fixture strings', async () => {
    const onCreateMeetings = vi.fn().mockResolvedValue(undefined);
    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    // UUID-shaped ids matching what the real `teams` table actually
    // produces (`teams.id uuid primary key`); fabricated names
    // (constitution item 6) -- never asserted on.
    async function loadCoachDataWithRealTeams(): Promise<CoachMeetingsData> {
      const base = await defaultLoadCoachMeetingsData();
      return {
        ...base,
        teams: [
          { id: 'd4444444-4444-4444-8444-444444444444', name: 'Photon Phalanx' },
          { id: 'd5555555-5555-4555-8555-555555555555', name: 'Kinetic Krew' },
        ],
      };
    }

    renderAsUser(COACH_USER, { loadCoachData: loadCoachDataWithRealTeams, onCreateMeetings });
    await flushMicrotasks();

    const scheduleButtons = Array.from(container.querySelectorAll('button')).filter((btn) =>
      btn.textContent?.includes('Schedule meetings'),
    );
    clickButton(scheduleButtons[0] as HTMLButtonElement);

    // Title already defaults to a non-empty value (`DEFAULT_TITLE`,
    // `ScheduleMeetingsDialog.tsx`); only a date is needed for `isValid`.
    const dateInput = getFieldControl('Date') as HTMLInputElement;
    act(() => {
      setNativeInputValue(dateInput, '2026-08-05');
    });

    // Open the "Team scope" MultiSelector and deselect the LAST option in
    // its own listbox -- positional, not by label text (with the fix
    // reverted the injected UUID-fixture labels are absent, so a label
    // lookup would die with a harness-shaped failure instead of the UUID
    // mismatch this test exists to prove). Scoped to the trigger's own
    // `aria-controls` listbox. The last option is never the `hasSelectAll`
    // pseudo-option, which that component places FIRST.
    const trigger = getFieldControl('Team scope');
    clickButton(trigger as HTMLButtonElement);
    const listboxId = trigger.getAttribute('aria-controls');
    expect(listboxId).toBeTruthy();
    const listbox = document.getElementById(listboxId ?? '');
    expect(listbox).toBeTruthy();
    const options = Array.from(listbox?.querySelectorAll('[role="option"]') ?? []);
    expect(options.length).toBeGreaterThan(0);
    act(() => {
      options[options.length - 1].dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(onCreateMeetings).not.toHaveBeenCalled();
    clickButton(findButtonByText('Create 1 meeting') as HTMLButtonElement);
    await flushMicrotasks();

    expect(onCreateMeetings).toHaveBeenCalledTimes(1);
    const payload = onCreateMeetings.mock.calls[0][0] as CreateMeetingsPayload;
    const submittedTeamIds = payload.event.teamIds;
    expect(submittedTeamIds).not.toBeNull();
    expect(submittedTeamIds).not.toEqual([]);
    for (const id of submittedTeamIds ?? []) {
      expect(id).toMatch(UUID_RE);
    }
  });

  // T096 (module doc #7b, Trap #3 finding) -- Edit is left as an honest,
  // accurately-worded stub since `ScheduleMeetingsDialog` genuinely has no
  // edit mode, not the old misleading "dialog not built yet" copy.
  //
  // T135 (Table migration) §2, tenth authorized assertion change (on top of
  // Trap 1's nine): the row-level `MoreMenu` this test used to open no
  // longer exists (Edit is now a standalone chip, since Cancel already left
  // the menu for a per-session button under T122, leaving exactly one item
  // behind a menu). Before this rewrite, `moreMenuButton` resolved to
  // `undefined` (nothing has `aria-label^="Actions for Weekly Build
  // Meeting"` anymore), the optional-chained `?.dispatchEvent(...)` at the
  // old `:850` silently no-opped, and the generic `el.textContent?.trim()
  // === 'Edit'` search at the old `:852-854` still found the new Edit chip
  // directly in the DOM (no menu-open needed) -- so the test would have kept
  // passing while asserting an affordance (open a menu, click a menu item)
  // that no longer exists. Rewritten to find and click the Edit chip
  // directly, by its real accessible name.
  it('Edit shows an honest stub explaining the dialog has no edit mode (not the old misleading copy)', async () => {
    renderAsUser(COACH_USER, { loadCoachData: defaultLoadCoachMeetingsData });
    await flushMicrotasks();

    const editButton = Array.from(container.querySelectorAll('button')).find((btn) =>
      btn.getAttribute('aria-label')?.startsWith('Edit – Weekly Build Meeting'),
    );
    expect(editButton).toBeTruthy();
    clickButton(editButton as HTMLButtonElement);

    expect(container.textContent).toContain("Editing an existing meeting isn't supported yet");
    // NOT the old, now-inaccurate copy (the dialog IS built).
    expect(container.textContent).not.toContain('not built yet');
  });

  // T122 (module doc #10d) -- Cancel moved from the row's own MoreMenu into
  // a plain per-session `Button` inside that row's expander.
  //
  // T135 (Table migration) Trap 1, rewritten (was: "Collapsible content is
  // always in the DOM ... so no click needed" -- now FALSE): row splicing
  // (the `Table` migration's expansion mechanism) genuinely removes a
  // session-detail row from the DOM until its parent row's expander is
  // clicked, unlike `Collapsible`, which only CSS-hid its (always-mounted)
  // content. `expandRow` performs that click first.
  it('Cancel (inline, per-session) + AlertDialog (DES-11) really calls the injected onCancelSession mutation', async () => {
    const onCancelSession = vi.fn().mockResolvedValue(undefined);
    renderAsUser(COACH_USER, { loadCoachData: defaultLoadCoachMeetingsData, onCancelSession });
    await flushMicrotasks();

    // "Weekly Build Meeting" has exactly one still-scheduled session
    // (session-upcoming-build, 2026-07-22, a Wednesday).
    expandRow('Weekly Build Meeting');
    const cancelButton = findButtonByText('Cancel Wed, Jul 22 session');
    expect(cancelButton).toBeTruthy();
    clickButton(cancelButton as HTMLButtonElement);

    expect(document.body.textContent).toContain('Cancel "Weekly Build Meeting" on Wed, Jul 22?');

    const confirmButton = Array.from(document.querySelectorAll('button')).find(
      (btn) => btn.textContent?.trim() === 'Cancel session',
    );
    expect(confirmButton).toBeTruthy();
    clickButton(confirmButton as HTMLButtonElement);
    await flushMicrotasks();

    // T135 (Table migration) Trap 2: confirming the cancel means EVERY one
    // of "Weekly Build Meeting"'s sessions is now completed/canceled (none
    // still `scheduled`), so `partitionCoachMeetingRows` moves this row from
    // the Upcoming `CoachMeetingsSection`'s own `Table` into the Past one's
    // -- a different, separately-mounted `Table` instance. This assertion is
    // only satisfiable because expansion state is lifted to
    // `CoachMeetingsView` (ONE shared `Set`, not one per section, per that
    // task's own module doc) -- the row's expanded-ness survives the bucket
    // move, so its session-detail rows (including this "Canceled" copy) are
    // still spliced into the Past table without a second expand click.
    expect(container.textContent).toContain('Canceled — no attendance recorded.');
    // The real mutation seam was genuinely called, with the target session's id.
    expect(onCancelSession).toHaveBeenCalledTimes(1);
    expect(onCancelSession).toHaveBeenCalledWith('session-upcoming-build');
    expect(container.textContent).toContain('Meeting session canceled');
    // The Cancel button for that now-canceled session is gone (only
    // `scheduled` sessions render one) -- the Ravens session's own Cancel
    // button is untouched, but lives in a DIFFERENT row that has never been
    // expanded, so it needs its own expand click first (T135 Trap 1).
    expect(findButtonByText('Cancel Wed, Jul 22 session')).toBeUndefined();
    expandRow('Ravens Strategy Session');
    expect(findButtonByText('Cancel Sat, Jul 25 session')).toBeTruthy();
  });

  // T135 (Table migration) Trap 1: without an `expandRow` call first,
  // `findButtonByText` returns `undefined` and `clickButton(undefined)`
  // throws -- session-detail rows (including this Cancel button) are
  // spliced out of the DOM until expanded.
  it('Cancel rolls back the optimistic update and shows an error Banner when the mutation rejects', async () => {
    const onCancelSession = vi.fn().mockRejectedValue(new Error('network down'));
    renderAsUser(COACH_USER, { loadCoachData: defaultLoadCoachMeetingsData, onCancelSession });
    await flushMicrotasks();

    expandRow('Weekly Build Meeting');
    const cancelButton = findButtonByText('Cancel Wed, Jul 22 session');
    clickButton(cancelButton as HTMLButtonElement);
    const confirmButton = Array.from(document.querySelectorAll('button')).find(
      (btn) => btn.textContent?.trim() === 'Cancel session',
    );
    clickButton(confirmButton as HTMLButtonElement);
    await flushMicrotasks();

    // Rolled back -- the session's own Cancel button reappears, and (since
    // the mutation rejected) the row never actually left the Upcoming
    // section, so the same expanded `Table` instance still has it.
    expect(findButtonByText('Cancel Wed, Jul 22 session')).toBeTruthy();
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
      resolveStudentIsActive: fakeResolveStudentIsActive(true),
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
      resolveStudentIsActive: fakeResolveStudentIsActive(true),
      loadStudentData: () => Promise.reject(new Error('boom')),
    });
    await flushMicrotasks();
    await flushMicrotasks();
    expect(container.textContent).toContain("Couldn't load your meeting history");
  });

  it('empty state (no history, no participation row)', async () => {
    renderAsUser(STUDENT_OR_PARENT_USER, {
      resolveStudentId: fakeResolveStudentId('student-fixture'),
      resolveStudentIsActive: fakeResolveStudentIsActive(true),
      loadStudentData: () => Promise.resolve({ history: [], participation: null }),
    });
    await flushMicrotasks();
    await flushMicrotasks();
    expect(container.textContent).toContain('No meeting history yet');
  });

  // T302 -- `isEmpty` (`MeetingsList.tsx`'s `history.length === 0 &&
  // participation === null`) was asserted by nothing: deleting the
  // `participation === null` conjunct left the whole suite green, both at
  // T180's head and at base (pre-existing gap, not a T180 regression). It
  // matters more now than it used to -- T180 deleted this file's own
  // `Participation` `ProgressBar`, so this clause is `participation`'s only
  // remaining render-path consumer. A student with zero history rows but a
  // real participation row must NOT collapse into the "No meeting history
  // yet" empty state.
  //
  // Paired, not absence-only (this project has shipped seven-plus
  // absence-only assertions that passed for the wrong reason, including two
  // in T180's own first draft): absence of the empty-state copy, PLUS the
  // "Recent attendance" heading, which the `isEmpty` branch never renders --
  // it only exists past `StudentMeetingsView`'s own loading/error gate, on
  // the same `else` branch as the empty-state check's alternative, so it
  // cannot pass because the page merely failed to load or errored.
  it('a student with zero history rows but a real participation row does not render the empty state', async () => {
    renderAsUser(STUDENT_OR_PARENT_USER, {
      resolveStudentId: fakeResolveStudentId('student-fixture'),
      resolveStudentIsActive: fakeResolveStudentIsActive(true),
      loadStudentData: () =>
        Promise.resolve({
          history: [],
          participation: {
            studentId: 'student-fixture',
            teamId: 'team-ravens',
            seasonId: 'season-placeholder-current',
            expectedCt: 5,
            presentCt: 4,
            lateCt: 0,
            excusedCt: 0,
            participationPct: 80,
          },
        }),
    });
    await flushMicrotasks();
    await flushMicrotasks();
    expect(container.textContent).not.toContain('No meeting history yet');
    expect(headingOutline()).toContain('H2:Recent attendance');
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

  // T180 §3a repair 1 (packet-authorized by name, `MeetingsList.test.tsx:1111`
  // in the packet's own pre-mount line numbering): Part B deletes this
  // file's own `Participation` `ProgressBar`, so `'57.1%'` -- this test's
  // sole prior observable -- no longer renders anywhere on a successful
  // resolution. Replaced, not deleted: a `vi.fn` spy on `loadStudentData`
  // proves the resolved id was genuinely threaded through to `loadData`,
  // keeping T096's own resolution proof alive without depending on the now-
  // deleted participation figure.
  it('resolveStudentId resolving a real id renders StudentMeetingsView scoped to that id', async () => {
    const loadStudentDataSpy = vi.fn(defaultLoadStudentMeetingsData);
    renderAsUser(STUDENT_OR_PARENT_USER, {
      resolveStudentId: fakeResolveStudentId(PLACEHOLDER_CURRENT_STUDENT_ID),
      resolveStudentIsActive: fakeResolveStudentIsActive(true),
      loadStudentData: loadStudentDataSpy,
    });
    await flushMicrotasks();
    await flushMicrotasks();
    expect(loadStudentDataSpy).toHaveBeenCalledWith(PLACEHOLDER_CURRENT_STUDENT_ID);
  });

  // T180 §3a repair 2 (packet-authorized by name, `:1124` in the packet's
  // own pre-mount line numbering): broken twice by Part A + Part B --
  // `'57.1%'` (the host's own deleted `Participation` `ProgressBar`) and the
  // placeholder copy (deleted by Part A) both retarget onto the now-mounted
  // strip.
  it('populated state: own history, and the real BEH-06 strip mounted where the placeholder used to be', async () => {
    stripSeam.load = (studentId) =>
      Promise.resolve({
        entries: [{ sessionId: 'cs-fixture', sessionDate: '2026-06-24', status: 'present' }],
        participation: {
          studentId,
          teamId: 'team-ravens',
          seasonId: 'season-placeholder-current',
          expectedCt: 5,
          presentCt: 4,
          lateCt: 0,
          excusedCt: 0,
          participationPct: 80,
        },
      });
    renderAsUser(STUDENT_OR_PARENT_USER, {
      studentId: PLACEHOLDER_CURRENT_STUDENT_ID,
      loadStudentData: defaultLoadStudentMeetingsData,
    });
    await flushMicrotasks();
    await flushMicrotasks();

    expect(container.textContent).toContain('Weekly Build Meeting');
    expect(container.textContent).toContain('Ravens Strategy Session');
    expect(container.textContent).toContain('Present');
    expect(container.textContent).toContain('Late');
    expect(container.textContent).toContain('Not yet held');

    // No row actions in the read-only student/parent view (MTG-14).
    expect(container.querySelector('[aria-label^="Actions for"]')).toBeNull();
    expect(container.textContent).not.toContain('Schedule meetings');

    // T180: the placeholder copy is gone, and the real strip's own
    // populated participation figure (sourced from its own loader, not the
    // deleted host `ProgressBar`) is what "57.1%" used to prove.
    expect(container.textContent).not.toContain('A visual "last 5 meetings" view isn\'t built yet');
    expect(container.textContent).not.toContain('T037');
    expect(container.textContent).toContain('Participation: 80%');
    expect(stripDotCount()).toBe(1);

    // NAV-07: outreach content must never appear here either.
    expect(container.textContent).not.toContain('Community Food Drive');
  });

  // T180 §3a repair 3 (packet-authorized by name, `:1152` in the packet's
  // own pre-mount line numbering) -- THE DANGEROUS ONE. Left unretargeted,
  // this title ("...when the student has no metric row") would start
  // passing again after the mount for an entirely different reason: the
  // strip's OWN em-dash empty state, sourced from a different loader
  // (`stripSeam`, not `loadStudentData`), with the host's own
  // now-deleted `Participation` section never in the render tree to have
  // rendered anything at all. Retargeted explicitly, by title, to the
  // thing it actually now proves.
  it("the strip's participation renders '—' (never a fabricated %) when its loader returns no metric row", async () => {
    stripSeam.load = () =>
      Promise.resolve({
        entries: [{ sessionId: 'cs-fixture', sessionDate: '2026-06-24', status: 'present' }],
        participation: null,
      });
    renderAsUser(STUDENT_OR_PARENT_USER, {
      studentId: 'student-with-zero-expected-sessions',
      loadStudentData: (studentId) => defaultLoadStudentMeetingsData(studentId),
    });
    await flushMicrotasks();
    await flushMicrotasks();
    // T180 follow-up (checker PASS-with-MINOR item 1): a bare `toContain('—')`
    // is satisfied by the DOT ROW's own em-dash separator
    // (`StudentMeetingView.tsx:735`, `${dot.label} — ${formatShortDate(...)}`),
    // which this test's own fixture entry also renders, NOT by the
    // participation branch this test is titled after
    // (`StudentMeetingView.tsx:751-754`). Measured: retargeting the
    // participation branch's own em-dash to `'N/A'` left this assertion green
    // (see T180-worker-output.md, "Follow-up round" section, for the pasted
    // mutation output). Assert the full participation string instead so the
    // assertion can only be satisfied by the branch the title names.
    expect(container.textContent).toContain('— (no completed meetings recorded yet this season)');
    expect(container.textContent).not.toMatch(/\d+%/);
  });

  // -------------------------------------------------------------------------
  // T129/UXC-01: one heading per section. `StudentHistorySection`'s own
  // `List`'s `header` prop was removed (it used to print "Upcoming
  // meetings"/"Past meetings" a second time, per `List.tsx:194-201`); its
  // `Heading` now carries a `useId`-generated id, and a
  // `<div role="group">` wrapping the List/EmptyState ternary carries
  // `aria-labelledby={headingId}` -- present in BOTH branches, so the
  // region's accessible name survives even when there is no `List` to
  // attach a `header` to. See `CoachMeetingsSection`'s own T129 describe
  // block above (CHECKER FIX, rework of T129, MAJOR) for why the wrapper
  // is a plain `<div role="group">`, not `Section`.
  // -------------------------------------------------------------------------
  describe('T129 UXC-01 -- exactly one heading per Upcoming/Past section', () => {
    function resolveAriaLabelledbyTarget(headingText: string): {
      headingId: string;
      resolvedText: string | null;
    } {
      const heading = Array.from(container.querySelectorAll('h2')).find(
        (h) => h.textContent === headingText,
      );
      expect(heading).toBeTruthy();
      const headingId = heading!.id;
      expect(headingId).toBeTruthy();
      const labelledEl = container.querySelector(`[role="group"][aria-labelledby="${headingId}"]`);
      expect(labelledEl).toBeTruthy();
      expect(labelledEl!.getAttribute('role')).toBe('group');
      const resolvedId = labelledEl!.getAttribute('aria-labelledby')!;
      const resolvedEl = document.getElementById(resolvedId);
      return { headingId, resolvedText: resolvedEl?.textContent ?? null };
    }

    it('populated branch: both "Upcoming" and "Past" resolve aria-labelledby back to their own Heading, printed exactly once', async () => {
      renderAsUser(STUDENT_OR_PARENT_USER, {
        studentId: PLACEHOLDER_CURRENT_STUDENT_ID,
        loadStudentData: defaultLoadStudentMeetingsData,
      });
      await flushMicrotasks();

      for (const title of ['Upcoming', 'Past']) {
        const { resolvedText } = resolveAriaLabelledbyTarget(title);
        expect(resolvedText).toBe(title);
        const leafMatches = Array.from(container.querySelectorAll('*')).filter(
          (el) => el.children.length === 0 && el.textContent === title,
        );
        expect(leafMatches.length).toBe(1);
      }
    });

    it('empty branch: "Upcoming" has no scheduled sessions -- its aria-labelledby still resolves to its Heading, even with no List rendered ("Past" stays populated in the same render)', async () => {
      const pastOnlyData: StudentMeetingsData = {
        history: [
          {
            sessionId: 'session-history-past-only',
            title: 'Archived Weekly Meeting',
            sessionDate: '2026-01-05',
            startsAt: '2026-01-05T18:00:00.000Z',
            endsAt: '2026-01-05T20:00:00.000Z',
            status: 'completed',
            myAttendanceStatus: 'present',
          },
        ],
        participation: {
          studentId: PLACEHOLDER_CURRENT_STUDENT_ID,
          teamId: 'team-placeholder-current-viewer',
          seasonId: 'season-placeholder-current',
          expectedCt: 1,
          presentCt: 1,
          lateCt: 0,
          excusedCt: 0,
          participationPct: 100,
        },
      };
      renderAsUser(STUDENT_OR_PARENT_USER, {
        studentId: PLACEHOLDER_CURRENT_STUDENT_ID,
        loadStudentData: () => Promise.resolve(pastOnlyData),
      });
      await flushMicrotasks();

      // Confirm "Upcoming" really is the EmptyState branch (per its own
      // `emptyDescription`), not a load failure.
      expect(container.textContent).toContain('You have no upcoming meetings scheduled.');
      expect(container.textContent).toContain('Archived Weekly Meeting');

      for (const title of ['Upcoming', 'Past']) {
        const { resolvedText } = resolveAriaLabelledbyTarget(title);
        expect(resolvedText).toBe(title);
      }
    });
  });

  // ---------------------------------------------------------------------------
  // T180 -- Part A (mount the real BEH-06 strip) + Part B (delete the
  // host's own duplicate `Participation` region). Every criterion below
  // names the mutation that must turn it red (worker packet §5); the actual
  // mutation runs + captured failure output for each live in this task's
  // own worker output doc, not restated here.
  // ---------------------------------------------------------------------------
  describe('T180 -- the real BEH-06 consistency strip is mounted, and the host has exactly one participation region', () => {
    it('C1: the consistency strip renders for a student, inside the real student view', async () => {
      stripSeam.load = defaultLoadConsistencyStripData;
      renderAsUser(STUDENT_OR_PARENT_USER, {
        studentId: 'student-jordan-fixture',
        loadStudentData: defaultLoadStudentMeetingsData,
      });
      await flushMicrotasks();
      await flushMicrotasks();

      // Mutation: remove the mount -> `expected +0 to be 5`.
      expect(stripDotCount()).toBe(5);
      expect(container.textContent).toContain('Upcoming');
      expect(container.textContent).toContain('Past');
    });

    it('C2: the placeholder copy is gone and the real strip is there', async () => {
      stripSeam.load = defaultLoadConsistencyStripData;
      renderAsUser(STUDENT_OR_PARENT_USER, {
        studentId: 'student-jordan-fixture',
        loadStudentData: defaultLoadStudentMeetingsData,
      });
      await flushMicrotasks();
      await flushMicrotasks();

      // Mutation: restore the placeholder `Text` alongside the mount ->
      // only this absence half reddens. The absence half ALONE is not
      // evidence -- it also passes against a strip that failed to load
      // (measured, gate round 1 BLOCKER 2c); the paired positive below is
      // what keeps this criterion honest.
      expect(container.textContent).not.toContain("isn't built yet");
      expect(stripDotCount()).toBe(5);
    });

    // C3 (BLOCKER 2, gate round 1): rendered where the mutation is actually
    // visible -- `studentId = PLACEHOLDER_CURRENT_STUDENT_ID` so the HOST's
    // own participation fixture row is non-null (Trap #3: the two loaders'
    // fixture id-spaces are disjoint, so any id that populates the strip
    // leaves the host's own participation null and the mutation invisible).
    // Accessible names resolved through `aria-labelledby`, never
    // `aria-label` (Trap #9 -- Astryx `ProgressBar` does not set the
    // latter).
    it("C3: exactly one participation bar renders, and it is the strip's", async () => {
      stripSeam.load = () =>
        Promise.resolve({
          entries: [],
          participation: {
            studentId: PLACEHOLDER_CURRENT_STUDENT_ID,
            teamId: 'team-ravens',
            seasonId: 'season-placeholder-current',
            expectedCt: 8,
            presentCt: 6,
            lateCt: 2,
            excusedCt: 1,
            participationPct: 85.7,
          },
        });
      renderAsUser(STUDENT_OR_PARENT_USER, {
        studentId: PLACEHOLDER_CURRENT_STUDENT_ID,
        loadStudentData: defaultLoadStudentMeetingsData,
      });
      await flushMicrotasks();
      await flushMicrotasks();

      // Mutation: restore the host's `Participation` `VStack` ->
      // `["Your participation: 57.1%", "Participation: 85.7%"]`, red.
      expect(progressBarNames()).toEqual(['Participation: 85.7%']);
    });

    // C4 (MAJOR 3, gate round 1): module-level spy on the SAME
    // `resolveCurrentStudentId` `StudentMeetingView.tsx`'s own
    // `OwnStudentConsistencyStrip` would fall back to -- not a spy on the
    // host's own `resolveStudentId` prop, which the mount never forwards
    // and which stays at 1 in both trees regardless of this mutation.
    // `toBe(0)`, not "at most once" -- the mutation moves the count from 0
    // to 1, and `toBeLessThanOrEqual(1)` would be satisfied by 1 either way.
    it('C4: mounting the strip with an explicit studentId never triggers a second identity resolution', async () => {
      const spy = vi.spyOn(meetingsLoadersNs, 'resolveCurrentStudentId');
      renderAsUser(STUDENT_OR_PARENT_USER, {
        studentId: PLACEHOLDER_CURRENT_STUDENT_ID,
        loadStudentData: defaultLoadStudentMeetingsData,
      });
      await flushMicrotasks();
      await flushMicrotasks();

      // Paired positive: the page actually finished rendering (not stuck in
      // a resolution-error/loading state).
      expect(container.textContent).toContain('Weekly Build Meeting');
      // Mutation: drop `studentId` from the mount -> `expected 1 to be +0`.
      expect(spy.mock.calls.length).toBe(0);
      // T180 follow-up NIT: restore the spy -- `vite.config.ts` sets no
      // `restoreMocks`, and this is the only test in the file that installs
      // this particular spy.
      spy.mockRestore();
    });

    // C5 (MAJOR 4, gate round 1): the absence half asserts the strip's own
    // shared vocabulary string ("meeting consistency" -- present in its
    // loading, error AND empty branches, `StudentMeetingView.tsx:778-779`/
    // `:802`/`:951`), not its populated dot-row output. A coach viewer never
    // even reaches a rendered strip in this file (the mount only exists in
    // the student/parent branch), so asserting on populated output alone
    // would pass trivially without the mount ever having been hoisted out
    // of that branch -- string coverage of every non-populated state is
    // what actually catches that mutation.
    it('C5: the coach view has no strip -- string coverage of every one of its non-populated states -- and its own content still renders', async () => {
      renderAsUser(COACH_USER, { loadCoachData: defaultLoadCoachMeetingsData });
      await flushMicrotasks();

      // Mutation: hoist the mount out of the student/parent branch -> red.
      expect(container.textContent).not.toContain('meeting consistency');
      expect(stripDotCount()).toBe(0);
      expect(container.textContent).toContain('Weekly Build Meeting');
    });

    // C7 (MINOR 7, gate round 1): the real default `loadLinkedStudents` seam
    // is unstubbed here, so the stated mutation (switching the mount to
    // `variant="linked"`) reddens because that path hits a DIFFERENT,
    // unstubbed seam and renders "Couldn't load linked students" (0 dots),
    // not because it "fans out to more than one strip" -- the fan-out is
    // real but only observable with that seam stubbed (see this task's
    // worker output doc for that measurement); it is not what THIS
    // mutation, run against the default harness, demonstrates.
    it('C7: the parent/student path renders exactly one strip via variant="own", never a fan-out', async () => {
      stripSeam.load = defaultLoadConsistencyStripData;
      renderAsUser(STUDENT_OR_PARENT_USER, {
        studentId: 'student-jordan-fixture',
        loadStudentData: defaultLoadStudentMeetingsData,
      });
      await flushMicrotasks();
      await flushMicrotasks();

      // Mutation: switch the mount to `variant="linked"` -> red (0 dots,
      // via the unstubbed `loadLinkedStudents` error banner, not a fan-out).
      expect(stripDotCount()).toBe(5);
    });

    // C8 (Trap #8): two `<h2>`s are deliberately lost (`Participation`, and
    // the strip's own `variant="own"` branch emits no heading at all) --
    // the host's `Recent attendance` heading is kept so the page still has
    // a navigable heading over the mounted strip.
    it('C8: the student view heading outline is H1 Meetings / H2 Upcoming / H2 Past / H2 Recent attendance', async () => {
      stripSeam.load = defaultLoadConsistencyStripData;
      renderAsUser(STUDENT_OR_PARENT_USER, {
        studentId: 'student-jordan-fixture',
        loadStudentData: defaultLoadStudentMeetingsData,
      });
      await flushMicrotasks();
      await flushMicrotasks();

      // Mutation: drop the `Recent attendance` heading -> red.
      expect(headingOutline()).toEqual([
        'H1:Meetings',
        'H2:Upcoming',
        'H2:Past',
        'H2:Recent attendance',
      ]);
    });
  });

  // ---------------------------------------------------------------------------
  // T189 (packet v2 §6) -- honest "your account is inactive" copy. Only C1
  // discriminates against today's defect (a deactivated student's real
  // history/dots sitting directly beside a "no completed meetings"
  // participation claim); C2-C6 are regression guards, not proofs of the
  // fix, per the packet's own disclosure. Every criterion below still has a
  // named production-code mutation run against it (worker output records
  // the real red output for each).
  // ---------------------------------------------------------------------------
  describe('T189 -- honest copy for a deactivated student', () => {
    const REAL_UPCOMING_ROW: StudentMeetingHistoryRow = {
      sessionId: 'session-t189-upcoming',
      title: 'Upcoming Robotics Session',
      sessionDate: '2026-08-10',
      startsAt: '2026-08-10T18:00:00.000Z',
      endsAt: '2026-08-10T20:00:00.000Z',
      status: 'scheduled',
      myAttendanceStatus: null,
    };
    const REAL_PAST_ROW: StudentMeetingHistoryRow = {
      sessionId: 'session-t189-past',
      title: 'Past Robotics Session',
      sessionDate: '2026-01-12',
      startsAt: '2026-01-12T18:00:00.000Z',
      endsAt: '2026-01-12T20:00:00.000Z',
      status: 'completed',
      myAttendanceStatus: 'present',
    };
    const REAL_PARTICIPATION: StudentParticipationMetric = {
      studentId: 'student-t189-inactive',
      teamId: 'team-ravens',
      seasonId: 'season-placeholder-current',
      expectedCt: 5,
      presentCt: 4,
      lateCt: 0,
      excusedCt: 0,
      participationPct: 80,
    };

    // C1 -- the ONE criterion that discriminates against today's defect.
    // Mutation: delete the `isActive === false` branch.
    it('C1: inactive renders the honest copy; the strip\'s own "no completed meetings" copy is absent', async () => {
      renderAsUser(STUDENT_OR_PARENT_USER, {
        resolveStudentId: fakeResolveStudentId('student-t189-inactive'),
        resolveStudentIsActive: fakeResolveStudentIsActive(false),
        loadStudentData: () =>
          Promise.resolve({ history: [REAL_PAST_ROW], participation: REAL_PARTICIPATION }),
      });
      await flushMicrotasks();
      await flushMicrotasks();
      expect(container.textContent).toContain('Your student account is inactive');
      expect(container.textContent).toContain(
        "Participation isn't tracked while your account is inactive.",
      );
      expect(container.textContent).not.toContain('no completed meetings recorded yet');
    });

    // C2 -- the owner ruling's own most-likely-to-be-silently-dropped half:
    // Upcoming/Past keep their REAL rows even while inactive.
    // Mutation: drop the two `StudentHistorySection`s from the inactive branch.
    it('C2: inactive -- Upcoming and Past still render their real rows', async () => {
      renderAsUser(STUDENT_OR_PARENT_USER, {
        resolveStudentId: fakeResolveStudentId('student-t189-inactive'),
        resolveStudentIsActive: fakeResolveStudentIsActive(false),
        loadStudentData: () =>
          Promise.resolve({
            history: [REAL_UPCOMING_ROW, REAL_PAST_ROW],
            participation: null,
          }),
      });
      await flushMicrotasks();
      await flushMicrotasks();
      expect(container.textContent).toContain('Upcoming Robotics Session');
      expect(container.textContent).toContain('Past Robotics Session');
      expect(headingOutline()).toContain('H2:Upcoming');
      expect(headingOutline()).toContain('H2:Past');
    });

    // C3 -- active with a real scope renders exactly as today; honest copy absent.
    // Mutation: invert the branch to `isActive !== false`.
    it('C3: active renders as today; honest copy is absent', async () => {
      renderAsUser(STUDENT_OR_PARENT_USER, {
        resolveStudentId: fakeResolveStudentId('student-t189-active'),
        resolveStudentIsActive: fakeResolveStudentIsActive(true),
        loadStudentData: () =>
          Promise.resolve({ history: [REAL_PAST_ROW], participation: REAL_PARTICIPATION }),
      });
      await flushMicrotasks();
      await flushMicrotasks();
      expect(container.textContent).not.toContain('Your student account is inactive');
      expect(headingOutline()).toContain('H2:Recent attendance');
    });

    // C4 -- the exact trap packet v2 §3 names: an ACTIVE student with zero
    // completed sessions also has `participation === null`, same as an
    // inactive student. Mutation: use `participation === null` as the
    // detector instead of `isActive === false`.
    it('C4: active with zero completed sessions (participation null) does not trigger the honest copy', async () => {
      renderAsUser(STUDENT_OR_PARENT_USER, {
        resolveStudentId: fakeResolveStudentId('student-t189-active-new'),
        resolveStudentIsActive: fakeResolveStudentIsActive(true),
        loadStudentData: () => Promise.resolve({ history: [], participation: null }),
      });
      await flushMicrotasks();
      await flushMicrotasks();
      expect(container.textContent).not.toContain('Your student account is inactive');
      expect(container.textContent).toContain('No meeting history yet');
    });

    // C5 -- absence-only by nature (v1's blanket pairing rule was wrong,
    // packet v2 §6). Mutation: call it in the explicit-studentId branch too.
    it('C5: resolveStudentIsActive is never called when an explicit studentId prop is supplied', async () => {
      const resolveStudentIsActiveSpy = vi.fn(fakeResolveStudentIsActive(false));
      renderAsUser(STUDENT_OR_PARENT_USER, {
        studentId: PLACEHOLDER_CURRENT_STUDENT_ID,
        resolveStudentIsActive: resolveStudentIsActiveSpy,
        loadStudentData: defaultLoadStudentMeetingsData,
      });
      await flushMicrotasks();
      await flushMicrotasks();
      expect(resolveStudentIsActiveSpy).not.toHaveBeenCalled();
      // Also proves the page did not somehow honor the spy's `false` return
      // despite never calling it -- would indicate a stale/wrong wiring.
      expect(container.textContent).not.toContain('Your student account is inactive');
    });

    // C6 -- MAJOR 3 (gate round 1): fails today if the inactive check sits
    // BELOW the `isEmpty` ternary -- a deactivated student with zero
    // history and null participation would fall into "No meeting history
    // yet" instead, since the branch would be unreachable in that state.
    // Mutation: move the inactive check below the `isEmpty` ternary.
    it('C6: inactive AND zero history rows AND null participation -- honest copy renders, "No meeting history yet" is absent', async () => {
      renderAsUser(STUDENT_OR_PARENT_USER, {
        resolveStudentId: fakeResolveStudentId('student-t189-inactive-empty'),
        resolveStudentIsActive: fakeResolveStudentIsActive(false),
        loadStudentData: () => Promise.resolve({ history: [], participation: null }),
      });
      await flushMicrotasks();
      await flushMicrotasks();
      expect(container.textContent).toContain('Your student account is inactive');
      expect(container.textContent).not.toContain('No meeting history yet');
    });
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
  it('queries events/event_sessions/teams/attendance/rsvps/students and produces the same rows buildCoachMeetingRows would', async () => {
    const eventsSelectSpy = vi.fn().mockResolvedValue({
      data: [
        {
          id: 'event-1',
          season_id: 'season-1',
          type: 'meeting',
          title: 'DB Meeting',
          team_ids: null,
          counts_participation: true,
          location_name: 'DB Location',
          address: '1 DB Way',
        },
        {
          id: 'event-2',
          season_id: 'season-1',
          type: 'outreach',
          title: 'DB Outreach -- must never appear',
          team_ids: null,
          counts_participation: false,
          location_name: '',
          address: '',
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
    // T122 (module doc #10a) -- new rsvps/students queries.
    const rsvpsSelectSpy = vi.fn().mockResolvedValue({
      data: [{ session_id: 'session-1', student_id: 'stu-1', status: 'going' }],
      error: null,
    });
    const studentsSelectSpy = vi.fn().mockResolvedValue({
      data: [{ id: 'stu-1', display_name: 'DB Student' }],
      error: null,
    });

    const fromSpy = vi.fn((table: string) => {
      if (table === 'events') return { select: eventsSelectSpy };
      if (table === 'event_sessions') return { select: vi.fn(() => ({ order: sessionsOrderSpy })) };
      if (table === 'teams') return { select: vi.fn(() => ({ order: teamsOrderSpy })) };
      if (table === 'attendance') return { select: attendanceSelectSpy };
      if (table === 'rsvps') return { select: rsvpsSelectSpy };
      if (table === 'students') return { select: studentsSelectSpy };
      throw new Error(`unexpected table: ${table}`);
    });
    const client = { from: fromSpy } as unknown as SupabaseClient;

    const load = makeLoadCoachMeetingsData(() => client);
    const result = await load();

    expect(fromSpy).toHaveBeenCalledWith('events');
    expect(fromSpy).toHaveBeenCalledWith('event_sessions');
    expect(fromSpy).toHaveBeenCalledWith('teams');
    expect(fromSpy).toHaveBeenCalledWith('attendance');
    expect(fromSpy).toHaveBeenCalledWith('rsvps');
    expect(fromSpy).toHaveBeenCalledWith('students');

    // NAV-07 -- the outreach event's title never appears (module doc #2's
    // filter, applied by the reused `buildCoachMeetingRows`, not re-derived
    // in the loader).
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]).toMatchObject({
      eventId: 'event-1',
      title: 'DB Meeting',
      locationName: 'DB Location',
    });
    expect(result.rows[0].sessions).toHaveLength(1);
    expect(result.rows[0].sessions[0]).toMatchObject({ sessionId: 'session-1', expectedCt: 1 });
  });

  it('bridges the "no rows" case for all six tables to an empty rows array, not a crash', async () => {
    const nullResult = { data: null, error: null };
    // `events`/`attendance`/`rsvps`/`students` `await` the `.select()`
    // result directly (no `.order()` chain); `event_sessions`/`teams` chain
    // `.select().order()`. A single thenable-plus-`.order()` stub satisfies
    // both shapes.
    const selectResult = {
      then: (resolve: (value: typeof nullResult) => void) => resolve(nullResult),
      order: vi.fn().mockResolvedValue(nullResult),
    };
    const client = {
      from: vi.fn(() => ({ select: vi.fn(() => selectResult) })),
    } as unknown as SupabaseClient;

    const load = makeLoadCoachMeetingsData(() => client);
    const result = await load();
    // T147 -- `teams` bridges the "no rows" case the same honest way `rows`
    // always has: a real empty array, never a crash/undefined.
    expect(result).toEqual({ rows: [], teams: [] });
  });
});

describe('loadStudentMeetingsData (T096 real load; T122 .limit(1) fix)', () => {
  it('scopes attendance/participation queries to the given studentId, no .limit() on the participation query anymore', async () => {
    const eventsSelectSpy = vi.fn().mockResolvedValue({ data: [], error: null });
    const sessionsOrderSpy = vi.fn().mockResolvedValue({ data: [], error: null });
    const attendanceEqSpy = vi.fn().mockResolvedValue({ data: [], error: null });
    const participationEqSpy = vi.fn().mockResolvedValue({ data: [], error: null });

    const fromSpy = vi.fn((table: string) => {
      if (table === 'events') return { select: eventsSelectSpy };
      if (table === 'event_sessions') return { select: vi.fn(() => ({ order: sessionsOrderSpy })) };
      if (table === 'attendance') return { select: vi.fn(() => ({ eq: attendanceEqSpy })) };
      if (table === 'v_student_participation') {
        // T122: `.limit(1)` REMOVED -- `.eq(...)` is awaited directly now.
        return { select: vi.fn(() => ({ eq: participationEqSpy })) };
      }
      throw new Error(`unexpected table: ${table}`);
    });
    const client = { from: fromSpy } as unknown as SupabaseClient;

    const load = makeLoadStudentMeetingsData(() => client);
    await load('student-42');

    expect(attendanceEqSpy).toHaveBeenCalledWith('student_id', 'student-42');
    expect(participationEqSpy).toHaveBeenCalledWith('student_id', 'student-42');
  });

  // T122's own ".limit(1)" fix decision, end-to-end: a dual-member student's
  // TWO real `v_student_participation` rows (T116's own migration doc: one
  // per membership-team) are summed, not arbitrarily reduced to one team.
  it('a dual-member student with two v_student_participation rows gets an aggregated participation figure, not an arbitrary single team', async () => {
    const eventsSelectSpy = vi.fn().mockResolvedValue({ data: [], error: null });
    const sessionsOrderSpy = vi.fn().mockResolvedValue({ data: [], error: null });
    const attendanceEqSpy = vi.fn().mockResolvedValue({ data: [], error: null });
    // FRC team: 5 expected, 5 present (100%). FTC team: 5 expected, 0
    // present, 0 excused (0%). T120's own twin decision's "no-arithmetic"
    // option does not apply here (no team in context at this call site --
    // this file's own module doc #10g / `loaders/meetings.ts`'s own module
    // doc), so this is the aggregate path.
    const participationEqSpy = vi.fn().mockResolvedValue({
      data: [
        {
          student_id: 'student-dual',
          team_id: 'team-frc',
          season_id: 'season-1',
          expected_ct: 5,
          present_ct: 5,
          late_ct: 0,
          excused_ct: 0,
          participation_pct: 100,
        },
        {
          student_id: 'student-dual',
          team_id: 'team-ftc',
          season_id: 'season-1',
          expected_ct: 5,
          present_ct: 0,
          late_ct: 0,
          excused_ct: 0,
          participation_pct: 0,
        },
      ],
      error: null,
    });

    const fromSpy = vi.fn((table: string) => {
      if (table === 'events') return { select: eventsSelectSpy };
      if (table === 'event_sessions') return { select: vi.fn(() => ({ order: sessionsOrderSpy })) };
      if (table === 'attendance') return { select: vi.fn(() => ({ eq: attendanceEqSpy })) };
      if (table === 'v_student_participation') {
        return { select: vi.fn(() => ({ eq: participationEqSpy })) };
      }
      throw new Error(`unexpected table: ${table}`);
    });
    const client = { from: fromSpy } as unknown as SupabaseClient;

    const load = makeLoadStudentMeetingsData(() => client);
    const data = await load('student-dual');

    // Summed: expected 10, present 5 -> round(100*5/10, 1) = 50.0 -- NOT
    // 100% (FRC only) or 0% (FTC only), either of which `.limit(1)` could
    // have silently produced depending on row order.
    expect(data.participation).toMatchObject({
      studentId: 'student-dual',
      expectedCt: 10,
      presentCt: 5,
      participationPct: 50,
    });
  });
});

describe('aggregateParticipationRows (T122 .limit(1) fix decision)', () => {
  it('returns null for zero rows', () => {
    expect(aggregateParticipationRows([])).toBeNull();
  });

  it('passes a single row through unchanged (the common, non-dual-member case)', () => {
    const row = {
      student_id: 's1',
      team_id: 't1',
      season_id: 'season-1',
      expected_ct: 7,
      present_ct: 4,
      late_ct: 1,
      excused_ct: 0,
      participation_pct: 57.1,
    };
    // T162: `toBe`, NOT `toEqual`. The function short-circuits on
    // `rows.length === 1` and returns the SAME OBJECT. Deleting that
    // short-circuit makes it recompute -- and the recomputed object is
    // byte-identical here (round(100*4/(7-0),1) === 57.1), so `toEqual`
    // stays GREEN under that mutation and proves nothing. Reference
    // identity is the only assertion that reddens. Measured, not assumed.
    expect(aggregateParticipationRows([row])).toBe(row);
  });

  // T162: the `Math.max(expectedCt - excusedCt, 1)` denominator floor
  // (`loaders/meetings.ts:477`) had NO test -- deleting it left all 1946
  // tests green. Without it, a student whose every expected session was
  // excused divides by zero. Mirrors the same guard's coverage on the twin
  // function at `loaders/checkin.test.ts:86-93`.
  //
  // Fixture is view-possible, deliberately: if every expected session was
  // excused then none can have been attended, so `present_ct` MUST be 0.
  // That is why the mutation yields NaN rather than Infinity.
  it('guards the denominator at 1 when every expected session was excused (no divide-by-zero)', () => {
    const result = aggregateParticipationRows([
      {
        student_id: 's1',
        team_id: 'team-a',
        season_id: 'season-1',
        expected_ct: 3,
        present_ct: 0,
        late_ct: 0,
        excused_ct: 3,
        participation_pct: 0,
      },
      {
        student_id: 's1',
        team_id: 'team-b',
        season_id: 'season-1',
        expected_ct: 2,
        present_ct: 0,
        late_ct: 0,
        excused_ct: 2,
        participation_pct: 0,
      },
    ]);
    // Summed: expected 5, excused 5 -> 5 - 5 = 0 -> greatest(0, 1) = 1.
    // 100 * 0 / 1 = 0. Without the floor: 0 / 0 -> NaN.
    expect(result?.participation_pct).toBe(0);
    expect(Number.isFinite(result?.participation_pct)).toBe(true);
  });

  it("sums counters across every row and recomputes participation_pct using the view's own expression", () => {
    // Dual-member fixture: team A perfect attendance (4 expected, 4
    // present -- `present_ct` already includes late per the view's own
    // `status in ('present','late')` filter, `late_ct` is a breakdown of
    // it, never additive on top), team B one excused absence (denominator
    // shrinks) -- matches `20260717000003_metric_views.sql`'s NFR-03
    // "excused-shrinks-denominator" fixture class, applied across two rows
    // instead of one.
    const result = aggregateParticipationRows([
      {
        student_id: 's1',
        team_id: 'team-a',
        season_id: 'season-1',
        expected_ct: 4,
        present_ct: 4,
        late_ct: 0,
        excused_ct: 0,
        participation_pct: 100,
      },
      {
        student_id: 's1',
        team_id: 'team-b',
        season_id: 'season-1',
        expected_ct: 4,
        present_ct: 2, // includes 1 late (late_ct below)
        late_ct: 1,
        excused_ct: 1,
        participation_pct: 66.7, // round(100*2/(4-1),1) for THIS row alone
      },
    ]);
    // Summed: expected 8, present 6 (4+2), late 1, excused 1.
    // round(100 * 6 / greatest(8 - 1, 1), 1) = round(600/7, 1) = 85.7.
    expect(result).toMatchObject({
      expected_ct: 8,
      present_ct: 6,
      late_ct: 1,
      excused_ct: 1,
      participation_pct: 85.7,
    });
  });

  it("never double-counts: a dual member's 10h-equivalent expected/present sums exactly (D-3 personal-total posture applied to participation)", () => {
    // 10 expected / 10 present split evenly across two teams (5+5 each) --
    // the aggregate must read exactly 10/10 (100%), not 20/20 or 5/5.
    const result = aggregateParticipationRows([
      {
        student_id: 's1',
        team_id: 'team-a',
        season_id: 'season-1',
        expected_ct: 5,
        present_ct: 5,
        late_ct: 0,
        excused_ct: 0,
        participation_pct: 100,
      },
      {
        student_id: 's1',
        team_id: 'team-b',
        season_id: 'season-1',
        expected_ct: 5,
        present_ct: 5,
        late_ct: 0,
        excused_ct: 0,
        participation_pct: 100,
      },
    ]);
    expect(result).toMatchObject({ expected_ct: 10, present_ct: 10, participation_pct: 100 });
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

  // T162: the test above asserts the sort was REQUESTED, not that it WORKED --
  // its `orderSpy` ignores its arguments and the fixture resolves the same row
  // either way, so deleting `.order('created_at', {ascending:true})` from
  // `loaders/meetings.ts:512` leaves it GREEN. That matters here specifically:
  // Trap #4's rule is EARLIEST-linked child, so a parent with two children
  // silently resolves to the wrong one if the ordering is lost.
  //
  // This fake instead SORTS PHYSICALLY, and only when `.order()` is called.
  // The rows are seeded in reverse `created_at` order, so an unsorted read
  // returns the LATER-linked child and the assertion reddens.
  it('a parent with TWO linked students resolves the earliest-linked one -- outcome-provable, not call-shape', async () => {
    const linkRows = [
      { student_id: 'student-later', created_at: '2026-03-01T00:00:00Z' },
      { student_id: 'student-earliest', created_at: '2026-01-01T00:00:00Z' },
    ];

    const makeChain = (rows: readonly { student_id: string; created_at: string }[]) => ({
      order: (column: string, opts?: { ascending?: boolean }) =>
        makeChain(
          [...rows].sort((a, b) => {
            const dir = opts?.ascending === false ? -1 : 1;
            const av = String(a[column as 'created_at']);
            const bv = String(b[column as 'created_at']);
            return av < bv ? -dir : av > bv ? dir : 0;
          }),
        ),
      limit: (n: number) =>
        Promise.resolve({
          data: rows.slice(0, n).map(({ student_id }) => ({ student_id })),
          error: null,
        }),
    });

    const client = {
      from: () => ({ select: () => ({ eq: () => makeChain(linkRows) }) }),
    } as unknown as SupabaseClient;

    const resolve = makeResolveCurrentStudentId(() => client);
    const result = await resolve({ id: 'profile-parent-1', role: 'parent' });

    // Seeded later-first. With `.order(...)` the earliest wins; without it,
    // `.limit(1)` takes `student-later` and this fails on a real value.
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

// ---------------------------------------------------------------------------
// T511 -- the live console's entry point.
//
// `/meetings/live/:sessionId` shipped wired and working, and
// `routePaths.meetingLiveSession` had ZERO call sites: the only way in was
// typing the URL. These four criteria pin the entry point that closes that,
// and each one has a named mutation recorded in
// `docs/swarm/active/T511-scope.md` §6.
//
// Every assertion below targets `sess-live-2`, the SECOND scheduled session,
// never the first. A link built from the wrong session's id, or rendered only
// on the first iteration, passes a first-item assertion and fails these.
// ---------------------------------------------------------------------------

const T511_ROW: CoachMeetingsData = {
  rows: [
    {
      eventId: 'event-t511',
      title: 'Build Night',
      locationName: 'Robotics Lab',
      teamScopeLabel: 'All teams',
      sessions: [
        {
          sessionId: 'sess-live-1',
          sessionDate: '2026-09-02',
          startsAt: '2026-09-02T18:00:00.000Z',
          endsAt: '2026-09-02T20:00:00.000Z',
          status: 'scheduled',
          durationHours: 2,
          expectedCt: 3,
          attendanceSummary: null,
          attendeeNames: [],
        },
        // The one every T511 assertion targets. Distinct id AND distinct date:
        // the id makes "points at THIS session" falsifiable, the date makes the
        // two links' accessible names differ (C4).
        {
          sessionId: 'sess-live-2',
          sessionDate: '2026-09-09',
          startsAt: '2026-09-09T18:00:00.000Z',
          endsAt: '2026-09-09T20:00:00.000Z',
          status: 'scheduled',
          durationHours: 2,
          expectedCt: 4,
          attendanceSummary: null,
          attendeeNames: [],
        },
        {
          sessionId: 'sess-done',
          sessionDate: '2026-08-26',
          startsAt: '2026-08-26T18:00:00.000Z',
          endsAt: '2026-08-26T20:00:00.000Z',
          status: 'completed',
          durationHours: 2,
          expectedCt: 5,
          attendanceSummary: { presentCt: 5, lateCt: 0, excusedCt: 0, absentCt: 0 },
          attendeeNames: ['Ada L.'],
        },
        {
          sessionId: 'sess-scrapped',
          sessionDate: '2026-08-19',
          startsAt: '2026-08-19T18:00:00.000Z',
          endsAt: '2026-08-19T20:00:00.000Z',
          status: 'canceled',
          durationHours: 2,
          expectedCt: 6,
          attendanceSummary: null,
          attendeeNames: [],
        },
      ],
    },
  ],
  teams: [],
};

/** Every "Go live" anchor currently in the DOM, as {href, accessibleName}. */
function goLiveLinks(): { href: string; name: string }[] {
  return Array.from(document.querySelectorAll('a'))
    .filter((a) => (a.textContent ?? '').includes('Go live'))
    .map((a) => ({ href: a.getAttribute('href') ?? '', name: a.textContent ?? '' }));
}

describe('T511 -- live console entry point (coach session row)', () => {
  it('C1: a scheduled session links to /meetings/live/<that session’s own id>', async () => {
    renderAsUser(COACH_USER, { loadCoachData: () => Promise.resolve(T511_ROW) });
    await flushMicrotasks();
    expandRow('Build Night');

    const links = goLiveLinks();
    expect(links).toHaveLength(2);

    // The SECOND scheduled session, asserted against its own id -- not the
    // first, and not merely "some /meetings/live/ href exists".
    const second = links[1];
    expect(second.href).toBe('/meetings/live/sess-live-2');
    // And the first is genuinely a different target, so a single shared or
    // hardcoded href cannot satisfy both.
    expect(links[0].href).toBe('/meetings/live/sess-live-1');
  });

  it('C2: completed and canceled sessions get no Go live link', async () => {
    renderAsUser(COACH_USER, { loadCoachData: () => Promise.resolve(T511_ROW) });
    await flushMicrotasks();
    expandRow('Build Night');

    const hrefs = goLiveLinks().map((l) => l.href);
    // Both non-scheduled sessions are present in this render (proving the
    // absence is a status decision, not an absent fixture) ...
    expect(container.textContent).toContain('Attended: Ada L.');
    expect(container.textContent).toContain('Canceled');
    // ... and neither contributes a live-console link.
    expect(hrefs).not.toContain('/meetings/live/sess-done');
    expect(hrefs).not.toContain('/meetings/live/sess-scrapped');
  });

  it('C3: the student/parent view renders no Go live link at all', async () => {
    renderAsUser(STUDENT_OR_PARENT_USER, {
      resolveStudentId: fakeResolveStudentId('student-fixture'),
      resolveStudentIsActive: fakeResolveStudentIsActive(true),
      loadStudentData: () => Promise.resolve({ history: [], participation: null }),
    });
    await flushMicrotasks();
    await flushMicrotasks();

    // The gate is structural -- `CoachMeetingSessionRow` only renders under
    // `CoachMeetingsView`. This asserts that existing gate rather than adding
    // a second one beside the link that could drift out of step with it.
    expect(goLiveLinks()).toHaveLength(0);
    expect(container.textContent).not.toContain('Go live');
  });

  it('C4: each link’s accessible name is unique within one event', async () => {
    renderAsUser(COACH_USER, { loadCoachData: () => Promise.resolve(T511_ROW) });
    await flushMicrotasks();
    expandRow('Build Night');

    const names = goLiveLinks().map((l) => l.name);
    expect(names).toHaveLength(2);
    // Astryx forbids `label` on a text link, so the visible text IS the
    // accessible name. Two links both reading "Go live" would be two
    // indistinguishable targets to a screen reader.
    expect(new Set(names).size).toBe(2);
    expect(names[1]).toContain('Sep 9');
  });
});
