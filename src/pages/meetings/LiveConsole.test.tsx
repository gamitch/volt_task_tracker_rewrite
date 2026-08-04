// @vitest-environment jsdom
/**
 * T033: tests for `LiveConsole.tsx`.
 *
 * Per this task's Allowed Files ("A colocated `LiveConsole.test.tsx` is
 * acceptable per established precedent -- disclose it, don't ask
 * permission") this is a deliberate, disclosed addition, the same class of
 * addition `MeetingsList.test.tsx`/`CheckinResult.test.tsx`/
 * `ScheduleMeetingsDialog.test.tsx` already made in this same directory
 * tree -- existing specifically to produce the packet's own "Required
 * Worker Output" proof requirements:
 *
 *   1. A real, DRIVEN keyboard-event test of the full DES-17 path (arrow-key
 *      row navigation + 1-4 status shortcuts), with focus asserted to be on
 *      the roster ROW itself at the moment each key is dispatched -- never
 *      on the row's `SegmentedControl` -- proving the BLOCKER-class "without
 *      tabbing into the SegmentedControl" requirement, not just documenting
 *      it.
 *   2. A real test of the attendance-precedence rule: a row is set via the
 *      real keyboard path, then a fabricated QR-sourced Realtime event for
 *      the SAME student is fed through the exact `subscribeToAttendanceChanges`
 *      callback contract the component itself consumes. **The assertion was
 *      INVERTED on 2026-08-02**: MTG-11's coach precedence is superseded by
 *      the owner's LAST WRITE WINS ruling, so the incoming scan now wins
 *      rather than being discarded.
 *   3. A real test of the Realtime-consumption logic in isolation (no
 *      pre-existing coach value to defend against), proving an incoming
 *      change updates the affected row.
 *   4. A real test of MTG-12's defense-in-depth excused-gating, rendered
 *      against the UNGATED `LiveConsoleBody` export directly (bypassing
 *      `RequireRole`) with a non-coach/admin role, per that component's own
 *      module doc section 1/4.
 *
 * No `@testing-library/react` is installed in this repo (confirmed via
 * `package.json`) -- these tests use the same raw `createRoot`/`act`
 * pattern `MeetingsList.test.tsx`/`CoachHome.test.tsx` already established,
 * including their `AuthProvider` + `LoginAs` role-login harness, plus a
 * `MemoryRouter`/`Routes`/`Route` wrapper (needed here, unlike
 * `CheckinResult.test.tsx`'s bare `MemoryRouter`, because this component
 * reads `useParams()`, which only resolves against an actually-matched
 * route) and `ScheduleMeetingsDialog.test.tsx`'s own `setNativeInputValue`
 * helper for driving the search box.
 */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { AuthProvider, type AuthUser } from '../../app/guards';
import { LoginAsDeferred as LoginAs } from '../../test-utils/authHarness';
import {
  computeAttendanceTally,
  defaultSetAttendanceStatus,
  filterRosterByQuery,
  formatSessionTimeRange,
  LiveConsoleBody,
  LiveConsolePage,
  makeDefaultSetAttendanceStatus,
  notWiredSubscribeToAttendanceChanges,
  type AttendanceChangeListener,
  type AttendanceMethod,
  type AttendanceRecordState,
  type AttendanceStatus,
  type LiveConsoleData,
  type LiveConsoleRosterEntry,
} from './LiveConsole';

// ---------------------------------------------------------------------------
// Render harness -- mirrors CoachHome.test.tsx / ScheduleMeetingsDialog.test.tsx.
// ---------------------------------------------------------------------------

let container: HTMLDivElement;
let root: Root;

const COACH_USER: AuthUser = { id: 'user-coach', email: 'coach@example.com', role: 'coach' };
// T073a: renamed from `STAFF_USER`/`role: 'staff'` (invalid under the
// corrected `Role` type) to `STUDENT_USER`/`role: 'student'`. This fixture
// stands in generically for "a signed-in user who is NOT coach/admin" in
// the tests below -- `'student'` preserves that intent (any non-coach/admin
// role exercises the same "no Excused segment" / "redirect away" branches).
const STUDENT_USER: AuthUser = {
  id: 'user-student',
  email: 'student@example.com',
  role: 'student',
};

// `LoginAsDeferred` (imported above, aliased to `LoginAs`) logs in via a
// `useEffect` (not a render-phase call) and withholds rendering `children`
// until the login has actually taken effect -- T073b1 extracted this
// verbatim from this file's own original local `LoginAs` into
// `src/test-utils/authHarness.tsx` (see that file's module doc for the full
// rationale this file originally documented here: `LiveConsolePage` nests
// `RequireRole`, which synchronously `<Navigate>`s away on ANY render where
// `user` is still `null`, so login must not be a render-phase call here).

const TEST_SESSION_ID = 'session-fixture-1';
const TEST_PATH = `/meetings/live/${TEST_SESSION_ID}`;

/** Renders the UNGATED `LiveConsoleBody` directly (bypasses `RequireRole`,
 * per that component's own module doc section 1/4) inside a real matched
 * route so `useParams()` resolves `sessionId`. */
/**
 * T403 step 1: `loadDisplayToken` now defaults to the REAL
 * `loadKioskDisplayToken`, which calls the deployed `checkin-token` Edge
 * Function. With no Supabase configured (the mandated gate state) that
 * resolves nothing, and the panel honestly renders "QR not available yet"
 * instead of a QR code.
 *
 * That is the correct production behaviour, so tests that want a QR on screen
 * must now say so by injecting through the seam — the same "inject the fixture
 * explicitly, never inherit one by default" discipline T151 established. These
 * values are test-local and deliberately not exported from the component:
 * before this change the component shipped its own fixture and every call site
 * inherited it silently, which is how a fixture reaches a live route.
 */
const TEST_DISPLAY_TOKEN = {
  qrUrl: `https://portal.voltfrc.org/checkin?s=${TEST_SESSION_ID}&t=abc123`,
  shortCode: 'ABC234',
};

async function stubLoadDisplayToken(): Promise<typeof TEST_DISPLAY_TOKEN | null> {
  return TEST_DISPLAY_TOKEN;
}

/**
 * T403 step 2: the roster/attendance fixtures the COMPONENT used to ship
 * (`FIXTURE_ROSTER`/`FIXTURE_ATTENDANCE`/`defaultLoadLiveConsoleData`) now live
 * here, test-local and deliberately not exported from the component — the same
 * move step 1 made for the display token, for the same reason: a default the
 * component ships is inherited silently by every call site, which is how a
 * fixture reaches a live route.
 *
 * Names are the PRD 4.2 wireframe's own already-fabricated placeholders
 * ("Ada Q.", "Bea R.", "Cy T."), not new PII (constitution item 6).
 */
const TEST_ROSTER: LiveConsoleRosterEntry[] = [
  { studentId: 'student-ada', name: 'Ada Q.' },
  { studentId: 'student-bea', name: 'Bea R.' },
  { studentId: 'student-cy', name: 'Cy T.' },
  { studentId: 'student-dee', name: 'Dee W.' },
  { studentId: 'student-eli', name: 'Eli M.' },
  { studentId: 'student-fay', name: 'Fay N.' },
  { studentId: 'student-gia', name: 'Gia P.' },
];

const TEST_ATTENDANCE: Record<string, AttendanceRecordState> = {
  'student-ada': {
    status: 'present',
    method: 'qr',
    recordedBy: null,
    updatedAt: '2026-07-19T23:03:00.000Z',
  },
  'student-bea': {
    status: 'present',
    method: 'qr',
    recordedBy: null,
    updatedAt: '2026-07-19T23:04:00.000Z',
  },
  // student-cy: deliberately no entry -- "not yet checked in" (open circle
  // in the PRD wireframe).
  'student-dee': {
    status: 'late',
    method: 'coach',
    recordedBy: 'fixture-coach',
    updatedAt: '2026-07-19T23:20:00.000Z',
  },
  'student-eli': {
    status: 'excused',
    method: 'coach',
    recordedBy: 'fixture-coach',
    updatedAt: '2026-07-19T23:00:00.000Z',
  },
  'student-fay': {
    status: 'absent',
    method: 'import',
    recordedBy: null,
    updatedAt: '2026-07-19T22:00:00.000Z',
  },
};

const TEST_SESSION_TITLE = 'Tuesday Build Meeting';

async function stubLoadData(sessionId: string): Promise<LiveConsoleData> {
  return {
    session: {
      id: sessionId,
      title: TEST_SESSION_TITLE,
      startsAt: '2026-07-21T23:00:00.000Z', // 6:00 PM America/Chicago
      endsAt: '2026-07-22T01:00:00.000Z', // 8:00 PM America/Chicago
    },
    roster: [...TEST_ROSTER],
    attendance: { ...TEST_ATTENDANCE },
  };
}

/**
 * T403 step 3, packet section 4b -- `onSetAttendanceStatus`'s shipped
 * default (`defaultSetAttendanceStatus`) now makes a genuine write attempt.
 * Every test below that drives a coach action (a `SegmentedControl` change
 * or the DES-17 `1`-`4` keyboard path) injects one of these two seams
 * EXPLICITLY rather than relying on that default -- with no Supabase
 * configured (this suite's gate state), the real default's write would
 * genuinely reject, and the packet's own disclosed hazard is that several of
 * this file's pre-existing coach-action tests happened to pass anyway only
 * because they never `await` between the action and their assertions, so
 * the rejection microtask lands after the last assert.
 */
interface RecordedAttendanceWrite {
  sessionId: string;
  studentId: string;
  status: AttendanceStatus;
  method: AttendanceMethod;
  recordedBy: string | null;
}

/** A resolving seam that records every call it is given, so a test can
 * assert the exact arguments a coach action sent -- sessionId, studentId,
 * status, method (the wire-resolved value, Trap 2), and recordedBy. */
function spyResolvingSetAttendanceStatus(): {
  onSetAttendanceStatus: (
    sessionId: string,
    studentId: string,
    status: AttendanceStatus,
    method: AttendanceMethod,
    recordedBy: string | null,
  ) => Promise<void>;
  calls: RecordedAttendanceWrite[];
} {
  const calls: RecordedAttendanceWrite[] = [];
  return {
    calls,
    onSetAttendanceStatus: async (sessionId, studentId, status, method, recordedBy) => {
      calls.push({ sessionId, studentId, status, method, recordedBy });
    },
  };
}

/** A plain resolving seam for tests that only need the write to succeed
 * without inspecting what was sent. */
async function resolvingSetAttendanceStatus(): Promise<void> {
  // Intentionally resolves -- an explicitly-injected happy-path seam per
  // packet section 4b, not the component's own default.
}

/** An always-rejecting seam, for Trap 3's rollback + error-banner proof. */
async function rejectingSetAttendanceStatus(): Promise<void> {
  throw new Error('simulated persistence failure');
}

/**
 * Renders `LiveConsoleBody` injecting NOTHING automatically, so every seam the
 * caller does not name explicitly runs the component's own default.
 * `renderBody` injects `loadDisplayToken` AND `loadData`; this path injects
 * neither, and is the only way to assert on what the component actually ships.
 *
 * `props` exists so a test can hold ONE seam open while pinning another. T403
 * step 2 made that necessary: with nothing injected the real `loadData` rejects
 * (no Supabase in the gate state) and the page renders its DES-12 error state,
 * so the QR panel never mounts — a test asserting on the component's own
 * `loadDisplayToken` default has to get past the data load first, WITHOUT
 * being handed a display token.
 */
function renderBodyNoInjection(
  user: AuthUser | null,
  props: Parameters<typeof LiveConsoleBody>[0] = {},
): void {
  act(() => {
    root.render(
      <MemoryRouter initialEntries={[TEST_PATH]}>
        <AuthProvider>
          <Routes>
            <Route
              path="/meetings/live/:sessionId"
              element={
                user === null ? (
                  <LiveConsoleBody {...props} />
                ) : (
                  <LoginAs user={user}>
                    <LiveConsoleBody {...props} />
                  </LoginAs>
                )
              }
            />
          </Routes>
        </AuthProvider>
      </MemoryRouter>,
    );
  });
}

function renderBody(
  user: AuthUser | null,
  props: Parameters<typeof LiveConsoleBody>[0] = {},
): void {
  // Injected as DEFAULTS, not overrides — an individual test can still pass its
  // own `loadDisplayToken` (including one that resolves null) or its own
  // `loadData` (including one that rejects) to exercise the other paths.
  //
  // T403 step 2 added `loadData` here. Before it, these tests inherited the
  // component's own fixture roster silently; now the component's default is the
  // real Supabase-backed loader, so a test that wants Ada/Bea/Cy on screen has
  // to say so. `renderBodyNoInjection` remains the only path that exercises
  // what the component actually ships.
  props = { loadDisplayToken: stubLoadDisplayToken, loadData: stubLoadData, ...props };
  act(() => {
    root.render(
      <MemoryRouter initialEntries={[TEST_PATH]}>
        <AuthProvider>
          <Routes>
            <Route
              path="/meetings/live/:sessionId"
              element={
                user === null ? (
                  <LiveConsoleBody {...props} />
                ) : (
                  <LoginAs user={user}>
                    <LiveConsoleBody {...props} />
                  </LoginAs>
                )
              }
            />
          </Routes>
        </AuthProvider>
      </MemoryRouter>,
    );
  });
}

/** Renders the GATED default export, for the role-guard proof. `props` are
 * forwarded to the underlying body — the guard is what is under test here, so
 * a test may inject data seams to get a populated console behind it. */
function renderPage(
  user: AuthUser | null,
  props: Parameters<typeof LiveConsolePage>[0] = {},
): void {
  act(() => {
    root.render(
      <MemoryRouter initialEntries={[TEST_PATH]}>
        <AuthProvider>
          <Routes>
            <Route
              path="/meetings/live/:sessionId"
              element={
                user === null ? (
                  <LiveConsolePage {...props} />
                ) : (
                  <LoginAs user={user}>
                    <LiveConsolePage {...props} />
                  </LoginAs>
                )
              }
            />
            <Route path="/" element={<div data-testid="redirected-home" />} />
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
// DOM helpers
// ---------------------------------------------------------------------------

function row(studentId: string): HTMLElement {
  const el = container.querySelector(`[data-testid="roster-row-${studentId}"]`);
  expect(el, `expected a roster row for "${studentId}"`).toBeTruthy();
  return el as HTMLElement;
}

/** The currently-checked SegmentedControl value within a given row, or
 * `null` if none is checked (module doc: unmatched `value` falls back to no
 * checked radio, per SegmentedControl.js's own documented behavior). */
function checkedStatusOf(studentId: string): string | null {
  const checked = row(studentId).querySelector('[role="radio"][aria-checked="true"]');
  return checked ? checked.getAttribute('data-value') : null;
}

function dispatchKeyOn(el: Element, key: string): void {
  act(() => {
    el.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
  });
}

function setNativeInputValue(input: HTMLInputElement, value: string): void {
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
  setter?.call(input, value);
  act(() => {
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

// ---------------------------------------------------------------------------
// Pure functions -- filterRosterByQuery,
// computeAttendanceTally, formatSessionTimeRange.
// ---------------------------------------------------------------------------

/**
 * `mergeAttendanceUpdate` and its four tests are DELETED. MTG-11's
 * coach-precedence rule is superseded — **last write wins** (owner ruling
 * 2026-08-02, `auto-mode-decisions.md`, "George's ruling on MTG-11: LAST WRITE
 * WINS"; the struck clause is annotated at `VOLT_Portal_PRD.md:307`).
 *
 * Constitution item 10 requires boss approval to change a passing test; that
 * ruling is the approval, and it is cited rather than paraphrased.
 *
 * The behaviour those tests pinned is now asserted where it actually matters —
 * through the component, in "last write wins (supersedes MTG-11)" below —
 * rather than against a pure function that no longer exists. The old test
 * *"a coach-recorded existing value always wins over a later non-coach update"*
 * asserted precisely the behaviour the owner overturned: it would have kept a
 * student marked `absent` after they turned up late and scanned in.
 */

describe('filterRosterByQuery', () => {
  const roster: LiveConsoleRosterEntry[] = [
    { studentId: 's1', name: 'Ada Q.' },
    { studentId: 's2', name: 'Bea R.' },
    { studentId: 's3', name: 'Cy T.' },
  ];

  it('returns every entry for an empty/whitespace query', () => {
    expect(filterRosterByQuery(roster, '')).toHaveLength(3);
    expect(filterRosterByQuery(roster, '   ')).toHaveLength(3);
  });

  it('filters by case-insensitive name substring', () => {
    expect(filterRosterByQuery(roster, 'bea')).toEqual([{ studentId: 's2', name: 'Bea R.' }]);
    expect(filterRosterByQuery(roster, 'Q.')).toEqual([{ studentId: 's1', name: 'Ada Q.' }]);
  });

  it('returns an empty array when nothing matches', () => {
    expect(filterRosterByQuery(roster, 'zzz')).toEqual([]);
  });
});

describe('computeAttendanceTally', () => {
  const roster: LiveConsoleRosterEntry[] = [
    { studentId: 's1', name: 'A' },
    { studentId: 's2', name: 'B' },
    { studentId: 's3', name: 'C' },
  ];

  it('counts present/late as checked in; excused/absent/unset as not', () => {
    const attendance: Record<string, AttendanceRecordState> = {
      s1: { status: 'present', method: 'coach', recordedBy: null, updatedAt: 'x' },
      s2: { status: 'late', method: 'qr', recordedBy: null, updatedAt: 'x' },
      // s3: unset
    };
    expect(computeAttendanceTally(roster, attendance)).toEqual({ checkedIn: 2, total: 3 });
  });

  it('excludes excused/absent from the checked-in count', () => {
    const attendance: Record<string, AttendanceRecordState> = {
      s1: { status: 'excused', method: 'coach', recordedBy: null, updatedAt: 'x' },
      s2: { status: 'absent', method: 'import', recordedBy: null, updatedAt: 'x' },
    };
    expect(computeAttendanceTally(roster, attendance)).toEqual({ checkedIn: 0, total: 3 });
  });
});

describe('formatSessionTimeRange (NFR-09 America/Chicago)', () => {
  it('dedupes a shared meridiem, matching the PRD 4.2 wireframe wording', () => {
    // 2026-07-21T23:00:00Z / 2026-07-22T01:00:00Z = 6:00 PM - 8:00 PM CDT.
    expect(formatSessionTimeRange('2026-07-21T23:00:00.000Z', '2026-07-22T01:00:00.000Z')).toBe(
      '6:00-8:00 PM',
    );
  });
});

// ---------------------------------------------------------------------------
// DES-17 keyboard path -- BLOCKER-class (packet Required Worker Output #1).
// ---------------------------------------------------------------------------

describe('DES-17 keyboard path', () => {
  it('ArrowDown/ArrowUp move real DOM focus between roster rows', async () => {
    renderBody(COACH_USER);
    await flushMicrotasks();

    const ada = row('student-ada');
    const bea = row('student-bea');
    const cy = row('student-cy');

    act(() => {
      ada.focus();
    });
    expect(document.activeElement).toBe(ada);

    dispatchKeyOn(ada, 'ArrowDown');
    expect(document.activeElement).toBe(bea);

    dispatchKeyOn(bea, 'ArrowDown');
    expect(document.activeElement).toBe(cy);

    dispatchKeyOn(cy, 'ArrowUp');
    expect(document.activeElement).toBe(bea);
  });

  it('ArrowDown does not move past the last row (no wrap-around crash)', async () => {
    renderBody(COACH_USER);
    await flushMicrotasks();

    const last = row('student-gia');
    act(() => {
      last.focus();
    });
    dispatchKeyOn(last, 'ArrowDown');
    expect(document.activeElement).toBe(last);
  });

  it('digit keys 1/2/4 set Present/Late/Absent on the FOCUSED row while focus stays on the row itself (never the SegmentedControl)', async () => {
    // T403 step 3, packet section 4b: explicit resolving seam -- see the
    // comment on `resolvingSetAttendanceStatus` above for why this is
    // required on every coach-action test now that the default is real.
    renderBody(COACH_USER, { onSetAttendanceStatus: resolvingSetAttendanceStatus });
    await flushMicrotasks();

    // student-cy starts with no attendance record at all (module doc: PRD
    // wireframe's open circle).
    expect(checkedStatusOf('student-cy')).toBeNull();

    const cy = row('student-cy');
    act(() => {
      cy.focus();
    });
    expect(document.activeElement).toBe(cy);

    dispatchKeyOn(cy, '2'); // Late
    // The critical BLOCKER-class assertion: focus never left the row to
    // reach the SegmentedControl -- the status change happened purely via
    // the row-level onKeyDown listener, per module doc section 3.
    expect(document.activeElement).toBe(cy);
    expect(checkedStatusOf('student-cy')).toBe('late');

    dispatchKeyOn(cy, '1'); // Present
    expect(document.activeElement).toBe(cy);
    expect(checkedStatusOf('student-cy')).toBe('present');

    dispatchKeyOn(cy, '4'); // Absent
    expect(document.activeElement).toBe(cy);
    expect(checkedStatusOf('student-cy')).toBe('absent');
  });

  it('digit "3" sets Excused for a coach/admin role', async () => {
    renderBody(COACH_USER, { onSetAttendanceStatus: resolvingSetAttendanceStatus });
    await flushMicrotasks();

    const cy = row('student-cy');
    act(() => {
      cy.focus();
    });
    dispatchKeyOn(cy, '3');
    expect(checkedStatusOf('student-cy')).toBe('excused');
  });

  it('arrow navigation is scoped to the currently-visible (search-filtered) rows', async () => {
    renderBody(COACH_USER);
    await flushMicrotasks();

    const search = container.querySelector('input[placeholder="Search students..."]');
    expect(search).toBeTruthy();
    setNativeInputValue(search as HTMLInputElement, 'Bea');
    await flushMicrotasks();

    expect(container.querySelector('[data-testid="roster-row-student-ada"]')).toBeNull();
    const bea = row('student-bea');
    act(() => {
      bea.focus();
    });
    dispatchKeyOn(bea, 'ArrowDown'); // no other visible row -- must not throw/move off
    expect(document.activeElement).toBe(bea);
  });
});

// ---------------------------------------------------------------------------
// Last write wins -- supersedes MTG-11 coach precedence (owner ruling).
// ---------------------------------------------------------------------------

describe('last write wins (supersedes MTG-11 coach precedence)', () => {
  /**
   * INVERTED, not deleted. This test previously asserted that a coach value
   * survived a later QR write — the rule the owner overturned on 2026-08-02
   * (`auto-mode-decisions.md`, "George's ruling on MTG-11: LAST WRITE WINS").
   * Constitution item 10 requires boss approval to change a passing test; that
   * ruling is the approval.
   *
   * The scenario below is the owner's own, in his words: *"If a coach touches
   * absent, but then the student comes late and scans the qr, the student entry
   * should be saved."* Under the old rule the scan was discarded and the
   * student stayed `absent` while standing in the room.
   */
  it("a late student's QR scan OVERWRITES a coach's earlier absent — the owner's case", async () => {
    let capturedOnChange: AttendanceChangeListener | null = null;

    renderBody(COACH_USER, {
      subscribeToAttendanceChanges: (_sessionId, onChange) => {
        capturedOnChange = onChange;
        return () => {
          capturedOnChange = null;
        };
      },
      onSetAttendanceStatus: resolvingSetAttendanceStatus,
    });
    await flushMicrotasks();

    const cy = row('student-cy');
    act(() => {
      cy.focus();
    });
    // Coach marks absent before the student arrives (`4` = Absent).
    dispatchKeyOn(cy, '4');
    expect(checkedStatusOf('student-cy')).toBe('absent');

    expect(capturedOnChange).not.toBeNull();
    // The student turns up late and scans the kiosk.
    act(() => {
      capturedOnChange?.({
        studentId: 'student-cy',
        status: 'present',
        method: 'qr',
        recordedBy: null,
        updatedAt: '2026-07-19T23:30:00.000Z',
      });
    });

    // The scan is the LAST write, so it wins. Under the superseded rule this
    // asserted 'absent' and the student stayed marked absent while present.
    expect(checkedStatusOf('student-cy')).toBe('present');
  });

  it('a later coach edit overwrites an earlier QR value, in the other direction', async () => {
    // The owner's second case: *"If a student said they were present (by
    // mistake or falsely), but the coach then marked them absent the last
    // record should win."* `student-ada` starts as a real `qr` `present` row.
    renderBody(COACH_USER, { onSetAttendanceStatus: resolvingSetAttendanceStatus });
    await flushMicrotasks();

    expect(checkedStatusOf('student-ada')).toBe('present');
    const ada = row('student-ada');
    act(() => {
      ada.focus();
    });
    dispatchKeyOn(ada, '4');
    await flushMicrotasks();

    expect(checkedStatusOf('student-ada')).toBe('absent');
  });
});

// ---------------------------------------------------------------------------
// NFR-05 Realtime-consumption logic (packet Required Worker Output #3).
// ---------------------------------------------------------------------------

describe('Realtime-consumption logic (transport not wired, consumption proven)', () => {
  it('an incoming simulated change updates a row with no prior coach value', async () => {
    let capturedOnChange: AttendanceChangeListener | null = null;

    renderBody(COACH_USER, {
      subscribeToAttendanceChanges: (_sessionId, onChange) => {
        capturedOnChange = onChange;
        return () => {
          capturedOnChange = null;
        };
      },
    });
    await flushMicrotasks();

    // student-gia starts with no attendance record.
    expect(checkedStatusOf('student-gia')).toBeNull();

    act(() => {
      capturedOnChange?.({
        studentId: 'student-gia',
        status: 'present',
        method: 'qr',
        recordedBy: null,
        updatedAt: '2026-07-19T23:31:00.000Z',
      });
    });

    expect(checkedStatusOf('student-gia')).toBe('present');
  });

  it('the shipped default subscribe seam is an honest no-op (never calls onChange)', () => {
    let called = false;
    const unsubscribe = notWiredSubscribeToAttendanceChanges();
    expect(typeof unsubscribe).toBe('function');
    unsubscribe();
    expect(called).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// MTG-12 defense-in-depth excused gating (packet Required Worker Output #4).
// ---------------------------------------------------------------------------

describe('MTG-12 excused gating (defense in depth)', () => {
  it('coach/admin role sees an Excused segment on every row', async () => {
    renderBody(COACH_USER);
    await flushMicrotasks();
    const cy = row('student-cy');
    expect(cy.querySelector('[role="radio"][data-value="excused"]')).toBeTruthy();
  });

  it('a non-coach/admin role never renders an Excused segment, even rendered directly against the ungated body', async () => {
    renderBody(STUDENT_USER);
    await flushMicrotasks();
    const cy = row('student-cy');
    expect(cy.querySelector('[role="radio"][data-value="excused"]')).toBeNull();
  });

  /**
   * STRENGTHENED after the T403 step 3 re-review (NIT-5). The original asserted
   * only `checkedStatusOf(...) === null`, which **passed vacuously**: no
   * `excused` radio is rendered for this role at all, so the assertion held
   * whether or not the gate actually fired. Measured by the re-reviewer —
   * disabling the MTG-12 gate left this test GREEN while other tests caught it.
   *
   * A test that cannot fail when the thing it names is broken is the recurring
   * defect of this workflow (five exit-0 mutations before this one). It now
   * asserts the two things that actually distinguish a working gate: the local
   * row never becomes `excused`, and **no write is attempted at all**.
   */
  it('digit "3" is a no-op for a non-coach/admin role (never sets excused via keyboard)', async () => {
    const spy = spyResolvingSetAttendanceStatus();
    renderBody(STUDENT_USER, { onSetAttendanceStatus: spy.onSetAttendanceStatus });
    await flushMicrotasks();

    const cy = row('student-cy');
    act(() => {
      cy.focus();
    });
    dispatchKeyOn(cy, '3');
    await flushMicrotasks();

    expect(checkedStatusOf('student-cy')).toBeNull();
    // The load-bearing assertion: the gate must stop the WRITE, not merely
    // fail to render a radio. Without this the test cannot detect a leak.
    expect(spy.calls).toEqual([]);

    // And prove the harness itself is live — an allowed digit on the same row
    // DOES reach the seam, so an empty `spy.calls` above means "blocked", not
    // "this test never wires anything up".
    dispatchKeyOn(cy, '1');
    await flushMicrotasks();
    expect(spy.calls.map((call) => call.status)).toEqual(['present']);
  });
});

// ---------------------------------------------------------------------------
// Router-gap role guard (module doc section 1) -- the gated default export.
// ---------------------------------------------------------------------------

describe('LiveConsolePage role guard', () => {
  // T073b2: `RequireRole` (`guards.tsx`) no longer redirects a role-denied
  // viewer to "/" -- it renders a screen in place instead (a real, disclosed
  // behavior change; see that file's own module doc).
  //
  // T078: T076 (Passed) subsequently corrected `RequireRole`'s role-mismatch
  // branch (a resolved `student` account hitting a coach/admin-only page,
  // exactly this test's scenario) to render `AccessDeniedPage`, not
  // `NoAccessPage` -- `NoAccessPage` is for AUTH-04's distinct no-profile
  // case and its "You're not on the roster yet." copy was simply false here
  // (this account IS on the roster; it just lacks this page's role). This
  // test now asserts `AccessDeniedPage`'s own real `EmptyState` title
  // instead of the stale `NoAccessPage` copy it originally targeted.
  it('renders AccessDeniedPage for a non-coach/admin role, not a redirect', async () => {
    renderPage(STUDENT_USER);
    await flushMicrotasks();
    expect(container.querySelector('[data-testid="redirected-home"]')).toBeNull();
    expect(container.textContent).toContain("This page isn't part of your role");
    expect(container.textContent).not.toContain('Roster');
  });

  it('renders the real console for a coach role', async () => {
    // T403 step 2: the roster is injected. Before it, this test inherited the
    // component's fixture roster, so "the guard let a coach through to a
    // working console" was proved by a student who does not exist.
    renderPage(COACH_USER, { loadData: stubLoadData });
    await flushMicrotasks();
    expect(container.querySelector('[data-testid="redirected-home"]')).toBeNull();
    expect(row('student-ada')).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// aria-live tally (DES-17, same Kiosk.tsx-established pattern).
// ---------------------------------------------------------------------------

describe('aria-live tally', () => {
  it('renders an aria-live="polite" region and updates it when a row changes', async () => {
    // T403 step 3, packet section 4b: explicit resolving seam.
    renderBody(COACH_USER, { onSetAttendanceStatus: resolvingSetAttendanceStatus });
    await flushMicrotasks();

    const liveRegion = container.querySelector('[data-testid="attendance-tally"]');
    expect(liveRegion).toBeTruthy();
    expect(liveRegion?.getAttribute('aria-live')).toBe('polite');
    // Fixture: student-ada (present) + student-bea (present) + student-dee
    // (late) = 3 checked in out of 7 total (module doc FIXTURE_ATTENDANCE).
    expect(liveRegion?.textContent).toContain('3/7 in');

    const cy = row('student-cy');
    act(() => {
      cy.focus();
    });
    dispatchKeyOn(cy, '1'); // Present -- now checked in.

    const liveRegionAfter = container.querySelector('[data-testid="attendance-tally"]');
    expect(liveRegionAfter?.textContent).toContain('4/7 in');
  });
});

// ---------------------------------------------------------------------------
// Two-pane layout / QR panel (PRD 4.2 wireframe).
// ---------------------------------------------------------------------------

describe('two-pane layout', () => {
  it('renders the header, QR panel, and roster pane', async () => {
    renderBody(COACH_USER);
    await flushMicrotasks();

    expect(container.textContent).toContain('Tuesday Build Meeting');
    expect(container.textContent).toContain('Back to meetings');
    expect(container.textContent).not.toContain('End-meeting summary not built yet');
    expect(container.textContent).toContain('Check-in');
    expect(container.textContent).toContain('Roster');
    expect(container.querySelector('svg[role="img"]')).toBeTruthy(); // QRCodeSVG
    expect(container.textContent).toContain('Open kiosk view');

    const kioskLink = Array.from(container.querySelectorAll('a')).find((a) =>
      a.textContent?.includes('Open kiosk view'),
    );
    expect(kioskLink?.getAttribute('href')).toBe(`/kiosk/${TEST_SESSION_ID}`);
  });

  // T196: this test used to assert the stub Banner. The stub is gone -- the real
  // `EndMeetingDialog` is mounted in its place -- so the assertion is inverted to
  // prove the stub does NOT come back.
  //
  // It injects `loadEndMeetingSummary` deliberately. Without it the dialog's own
  // loader runs, rejects in this environment, and renders "Couldn't load this
  // meeting" -- under which its button never exists and a `toBeFalsy()` assertion
  // would pass while proving nothing about the mount. Injecting a resolving
  // `scheduled` summary is what makes the button's PRESENCE the real signal.
  it('mounts the real EndMeetingDialog in place of the old stub Banner', async () => {
    renderBody(COACH_USER, {
      loadEndMeetingSummary: async () => ({
        session: {
          id: TEST_SESSION_ID,
          title: 'Tuesday Build Meeting',
          endsAt: '2026-08-04T19:00:00.000Z',
          status: 'scheduled' as const,
        },
        roster: [],
        attendanceByStudentId: {},
      }),
    });
    await flushMicrotasks();

    // The stub is gone for good.
    expect(container.textContent).not.toContain('End-meeting summary not built yet');

    // ...and the real dialog's own affordance is what replaced it. This is the
    // assertion that actually fails if the mount is removed.
    const endMeetingButton = Array.from(container.querySelectorAll('button')).find(
      (button) => button.textContent?.trim() === 'End meeting',
    );
    expect(endMeetingButton).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// T129/UXC-01: one heading per section. The Roster `List`'s own `header`
// prop was removed (it used to print "Roster" a second time, per
// `List.tsx:194-201`); the `Heading` now carries a `useId`-generated id, and
// a `<div role="group">` wrapping the List/EmptyState ternary carries
// `aria-labelledby={headingId}` -- present in BOTH branches, so the
// region's accessible name survives even when there is no `List` to attach
// a `header` to.
//
// CHECKER FIX (rework of T129, MAJOR): see `CoachHome.test.tsx`'s own
// comment for the full rationale -- the wrapper was originally an Astryx
// `Section` (full-bleed negative margin + no nameable role); it is now a
// plain `<div role="group">`, and the query below includes `role="group"`
// so a regression back to a role-less wrapper fails the lookup itself.
// ---------------------------------------------------------------------------
describe('LiveConsole T129 UXC-01 -- exactly one Roster heading, List/EmptyState region takes its accessible name from the Heading', () => {
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

  it('populated branch (real roster): resolves aria-labelledby back to the "Roster" Heading, printed exactly once', async () => {
    renderBody(COACH_USER);
    await flushMicrotasks();

    const { resolvedText } = resolveAriaLabelledbyTarget('Roster');
    expect(resolvedText).toBe('Roster');
    const leafMatches = Array.from(container.querySelectorAll('*')).filter(
      (el) => el.children.length === 0 && el.textContent === 'Roster',
    );
    expect(leafMatches.length).toBe(1);
  });

  it('empty branch (search matches nobody): aria-labelledby still resolves to the "Roster" Heading, even with no List rendered', async () => {
    renderBody(COACH_USER);
    await flushMicrotasks();

    const searchInput = container.querySelector('input[placeholder="Search students..."]');
    expect(searchInput).toBeTruthy();
    setNativeInputValue(searchInput as HTMLInputElement, 'zzz-no-such-student');
    await flushMicrotasks();

    expect(container.textContent).toContain('No students match your search');

    const { resolvedText } = resolveAriaLabelledbyTarget('Roster');
    expect(resolvedText).toBe('Roster');
  });
});

// ---------------------------------------------------------------------------
// NFR-06 QR show/hide toggle (T072 fix -- checker-confirmed BLOCKER, T068).
// ---------------------------------------------------------------------------

describe('NFR-06 QR show/hide toggle (T072)', () => {
  function qrToggleButton(): HTMLElement {
    const el = container.querySelector('[data-testid="qr-toggle-button"]');
    expect(el, 'expected a QR toggle button').toBeTruthy();
    return el as HTMLElement;
  }

  /** The real, driven proof this is DOM removal, not CSS-only hiding: no
   * `svg[role="img"]` (the `QRCodeSVG`, per the "two-pane layout" describe
   * block above) or any node inside it should exist in the tree at all,
   * not merely be styled invisible. */
  function qrSvgInDom(): Element | null {
    return container.querySelector('svg[role="img"]');
  }

  it('QrPanel is present by default (QR-visible), with the toggle labeled "Hide QR code" and aria-expanded="true"', async () => {
    renderBody(COACH_USER);
    await flushMicrotasks();

    expect(qrSvgInDom()).toBeTruthy();
    expect(container.textContent).toContain('Check-in');
    expect(container.textContent).toContain('Or enter code:');

    const button = qrToggleButton();
    expect(button.tagName).toBe('BUTTON');
    expect(button.textContent?.trim()).toBe('Hide QR code');
    expect(button.getAttribute('aria-expanded')).toBe('true');
  });

  it('clicking the toggle genuinely removes QrPanel from the DOM (not CSS-only hiding), and clicking again restores it', async () => {
    renderBody(COACH_USER);
    await flushMicrotasks();

    expect(qrSvgInDom()).toBeTruthy();

    const button = qrToggleButton();
    act(() => {
      button.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    // Genuine DOM removal: no QR SVG node anywhere, and none of QrPanel's
    // other real content (short code, "Or enter code:", "Open kiosk view")
    // remains in the tree either -- proving the whole subtree unmounted,
    // not just the SVG being styled invisible.
    expect(qrSvgInDom()).toBeNull();
    expect(container.textContent).not.toContain('Or enter code:');
    expect(container.textContent).not.toContain('Open kiosk view');
    // The roster pane is unaffected -- this is a QR-only collapse.
    expect(row('student-ada')).toBeTruthy();

    const buttonAfterHide = qrToggleButton();
    expect(buttonAfterHide.textContent?.trim()).toBe('Show QR code');
    expect(buttonAfterHide.getAttribute('aria-expanded')).toBe('false');

    act(() => {
      buttonAfterHide.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(qrSvgInDom()).toBeTruthy();
    expect(container.textContent).toContain('Or enter code:');
    const buttonAfterShow = qrToggleButton();
    expect(buttonAfterShow.textContent?.trim()).toBe('Hide QR code');
    expect(buttonAfterShow.getAttribute('aria-expanded')).toBe('true');
  });

  it('the toggle is reachable and activatable via keyboard (real focus + Enter/Space semantics of a native <button>)', async () => {
    renderBody(COACH_USER);
    await flushMicrotasks();

    const button = qrToggleButton();
    // A real native <button> is keyboard-focusable without an explicit
    // tabIndex and natively activates on Enter/Space -- proven here by
    // actually moving DOM focus onto it (not merely asserting a tabIndex
    // attribute) and then dispatching a real click (jsdom's <button> does
    // not itself simulate the browser's native Enter/Space-to-click
    // behavior, so the click is dispatched directly at the focused
    // element, the same pattern this file already uses to prove keyboard
    // reachability of the "End meeting" button in the "two-pane layout"
    // describe block above).
    act(() => {
      button.focus();
    });
    expect(document.activeElement).toBe(button);
    expect(button.tabIndex).not.toBe(-1);

    act(() => {
      button.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(qrSvgInDom()).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// DES-12 states.
// ---------------------------------------------------------------------------

describe('DES-12 states', () => {
  it('shows a loading Skeleton (T081: roster-list-row shape is predictable) before loadData resolves', () => {
    renderBody(COACH_USER, {
      loadData: () => new Promise(() => {}), // never resolves
    });
    expect(container.textContent).toContain('Loading roster');
  });

  it('shows an error Banner when loadData rejects', async () => {
    renderBody(COACH_USER, {
      loadData: () => Promise.reject(new Error('boom')),
    });
    await flushMicrotasks();
    expect(container.textContent).toContain("Couldn't load this session");
  });

  it('shows an EmptyState when the roster is empty', async () => {
    renderBody(COACH_USER, {
      loadData: async () => ({
        session: {
          id: TEST_SESSION_ID,
          title: 'Empty Session',
          startsAt: '2026-07-19T23:00:00.000Z',
          endsAt: '2026-07-20T01:00:00.000Z',
        },
        roster: [],
        attendance: {},
      }),
    });
    await flushMicrotasks();
    expect(container.textContent).toContain('No students on this roster');
  });

  // -------------------------------------------------------------------
  // T134 (UXC-12): the `<h1>` is now unconditional across all three DES-12
  // states below -- pinning that there is exactly one `<h1>` in each, with
  // the `FALLBACK_SESSION_TITLE` fallback text in the two states where
  // `session` is still `null`.
  // -------------------------------------------------------------------
  it('T134 (UXC-12): renders exactly one <h1>, with fallback text, in the loading state', () => {
    renderBody(COACH_USER, {
      loadData: () => new Promise(() => {}), // never resolves
    });
    const headings = container.querySelectorAll('h1');
    expect(headings).toHaveLength(1);
    expect(headings[0].textContent).toBe('Meeting Check-In');
  });

  it('T134 (UXC-12): renders exactly one <h1>, with fallback text, in the error state', async () => {
    renderBody(COACH_USER, {
      loadData: () => Promise.reject(new Error('boom')),
    });
    await flushMicrotasks();
    const headings = container.querySelectorAll('h1');
    expect(headings).toHaveLength(1);
    expect(headings[0].textContent).toBe('Meeting Check-In');
  });

  it('T134 (UXC-12): renders exactly one <h1>, with the real session title, in the populated state', async () => {
    renderBody(COACH_USER);
    await flushMicrotasks();
    const headings = container.querySelectorAll('h1');
    expect(headings).toHaveLength(1);
    expect(headings[0].textContent).toBe(TEST_SESSION_TITLE);
  });
});

// ---------------------------------------------------------------------------
// T403 step 2: the roster comes from the database, not from this file.
// ---------------------------------------------------------------------------

describe('T403 step 2 — real roster/attendance', () => {
  it("renders NO fabricated students from the COMPONENT'S OWN default", async () => {
    // Through `renderBodyNoInjection`, NOT `renderBody` — `renderBody` now
    // supplies `loadData`, so a test using it can never detect a fixture being
    // reintroduced as the component's default. This is the same trap T403
    // step 1 measured on the display token: with the injecting helper,
    // restoring a fixture default left the block green at exit 0.
    //
    // Here the component falls back to the real `loadLiveConsoleData`, which
    // needs a configured Supabase and has none in the gate state, so it
    // rejects and the honest answer is the DES-12 error state — never a
    // roster of people who do not exist.
    renderBodyNoInjection(COACH_USER);
    await flushMicrotasks();

    expect(container.textContent).toContain("Couldn't load this session");
    for (const entry of TEST_ROSTER) {
      expect(container.textContent).not.toContain(entry.name);
    }
    expect(container.querySelector('[data-testid="roster-row-student-ada"]')).toBeNull();
  });

  it('no longer exports a fixture loader for any call site to inherit', async () => {
    // The DOM assertion above proves the fixture is not reachable through the
    // component's default TODAY. This proves the seam it came through is gone
    // for good: nothing can import `defaultLoadLiveConsoleData` and pass it
    // back in, and no future default can quietly point at it again.
    //
    // Asserted on the module's exports rather than by scanning the source
    // text, because the source legitimately NAMES the deleted symbols in the
    // comment recording why they were deleted.
    const mod = await import('./LiveConsole');
    expect(Object.keys(mod)).not.toContain('defaultLoadLiveConsoleData');
  });
});

// ---------------------------------------------------------------------------
// T403 step 1: the QR panel shows the REAL check-in credential.
// ---------------------------------------------------------------------------

describe('T403 step 1 — real display token', () => {
  it("renders NO fabricated code from the COMPONENT'S OWN default (was 'FXTURE')", async () => {
    // Renders through `renderBodyNoInjection`, NOT `renderBody`. That matters:
    // `renderBody` supplies a token by default, so a test using it never
    // exercises the component's own default and cannot detect a fixture being
    // reintroduced there. Measured — with `renderBody` and an explicit
    // `loadDisplayToken: async () => null`, restoring a fixture default left
    // this whole block green at exit 0.
    //
    // Here the component falls back to its real default
    // (`loadKioskDisplayToken`), which needs a configured Supabase and has
    // none in the gate state, so the honest answer is that there is no code.
    //
    // T403 step 2: `loadData` is injected so the page gets PAST the data load
    // and actually mounts the QR panel — the real `loadData` default would
    // reject here and render the error state instead, and this test would then
    // pass for the wrong reason (no QR panel at all, rather than a QR panel
    // honestly reporting no code). `loadDisplayToken` is still NOT injected:
    // that is the seam under test.
    renderBodyNoInjection(COACH_USER, { loadData: stubLoadData });
    await flushMicrotasks();

    expect(container.textContent).toContain('QR not available yet');
    expect(container.textContent).not.toContain('FXTURE');
    expect(container.textContent).not.toContain('FIXTURE');
    // The placeholder dashes, never six plausible-looking characters.
    expect(container.textContent).toContain('------');
    expect(container.querySelector('svg[role="img"]')).toBeNull();
  });

  it('no longer claims the code "isn\'t live yet" — that Banner would now be false', async () => {
    renderBody(COACH_USER);
    await flushMicrotasks();

    expect(container.textContent).toContain('Check-in');
    expect(container.textContent).not.toContain("aren't live yet");
    expect(container.textContent).not.toContain('A real, working code');
  });

  it('displays the token and short code it is given, verbatim', async () => {
    renderBody(COACH_USER);
    await flushMicrotasks();

    expect(container.textContent).toContain(TEST_DISPLAY_TOKEN.shortCode);
    const qr = container.querySelector('svg[role="img"]');
    expect(qr).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// T403 step 3: a coach action is a real `attendance` write, not a no-op.
// (Acceptance criteria 1/2/3/4/5 — see the worker packet.)
// ---------------------------------------------------------------------------

describe('defaultSetAttendanceStatus (T403 step 3, Trap 5)', () => {
  it('rejects BEFORE any network call when no signed-in coach identity is available', async () => {
    // If this reached the real `setAttendanceStatus` loader instead, the
    // rejection would carry a DIFFERENT message (a `SupabaseLoaderError` from
    // an unconfigured client, this suite's gate state) -- asserting THIS
    // exact, hand-authored message is what proves the precondition check
    // fired first, mirroring `makeOnEditAttendance`'s
    // precondition-check-then-reject shape (`endMeeting.ts:447-473`,
    // read-only reference).
    await expect(
      defaultSetAttendanceStatus('session-1', 'student-1', 'present', 'coach', null),
    ).rejects.toThrow('No signed-in coach identity is available to record this attendance change.');
  });

  /**
   * MAJOR-2. This adapter maps POSITIONAL seam arguments onto the loader's
   * NAMED params, and until the rework it closed over the module-level
   * `setAttendanceStatus` with no injection point — so the mapping was
   * untestable, and a mutation that swapped `sessionId`/`studentId` and
   * hardcoded `status`/`method` passed the FULL 1878-test suite at exit 0.
   *
   * Fifth exit-0 mutation in this project. The recurring shape: **a boundary
   * that cannot be stubbed cannot be tested, and that is exactly where a false
   * green lives.** Both halves either side of this one were individually
   * proven — the loader's payload and the component's coach action — while the
   * join between them was not.
   *
   * Positional order is deliberately all-distinct here so a transposition of
   * ANY two arguments fails, not just the two the original mutation swapped.
   */
  it('maps positional seam arguments onto the loader’s named params, in the right order (MAJOR-2)', async () => {
    const calls: unknown[] = [];
    const write = makeDefaultSetAttendanceStatus(async (params) => {
      calls.push(params);
      return {} as never;
    });

    await write('SESSION-X', 'STUDENT-Y', 'excused', 'import', 'COACH-Z');

    expect(calls).toEqual([
      {
        sessionId: 'SESSION-X',
        studentId: 'STUDENT-Y',
        status: 'excused',
        method: 'import',
        recordedBy: 'COACH-Z',
      },
    ]);
  });

  it('does not call the loader at all when identity is missing (MAJOR-2 + Trap 5)', async () => {
    const calls: unknown[] = [];
    const write = makeDefaultSetAttendanceStatus(async (params) => {
      calls.push(params);
      return {} as never;
    });

    await expect(write('session-1', 'student-1', 'present', 'coach', null)).rejects.toThrow();
    // Not merely "it rejected" -- the loader was never reached.
    expect(calls).toEqual([]);
  });
});

describe('T403 step 3 — real attendance write', () => {
  it('sends the exact payload for a brand-new record: status, method "coach" (Trap 2), and the acting coach id (Trap 5)', async () => {
    const spy = spyResolvingSetAttendanceStatus();
    renderBody(COACH_USER, { onSetAttendanceStatus: spy.onSetAttendanceStatus });
    await flushMicrotasks();

    // student-cy has no attendance entry at all (module doc TEST_ATTENDANCE).
    const cy = row('student-cy');
    act(() => {
      cy.focus();
    });
    dispatchKeyOn(cy, '1'); // Present

    expect(spy.calls).toEqual([
      {
        sessionId: TEST_SESSION_ID,
        studentId: 'student-cy',
        status: 'present',
        method: 'coach',
        recordedBy: COACH_USER.id,
      },
    ]);
  });

  /**
   * REWRITTEN from *"preserves real 'qr' provenance on the WIRE"*. That test
   * asserted the packet's acceptance criterion 3, which **contradicted the
   * PRD**: `VOLT_Portal_PRD.md:307`'s first clause always said a coach tap
   * upserts `method='coach'`. The criterion was taken from
   * `resolveAttendanceWriteMethod`'s docstring and never checked against the
   * requirement. The owner's 2026-08-02 ruling settles it — `method` records
   * WHO SET THE VALUE THAT IS THERE NOW.
   *
   * **This is also the checker's MAJOR-1 test**, which is why it drives THREE
   * sequential edits rather than one. The old single-shot test structurally
   * could not see the defect: the first call was correct and every later call
   * was wrong, so one action proved nothing about a roll-call console whose
   * entire purpose is repeated tapping.
   */
  it('sends "coach" on EVERY write, across repeated edits of a real "qr" row (MAJOR-1)', async () => {
    const spy = spyResolvingSetAttendanceStatus();
    renderBody(COACH_USER, { onSetAttendanceStatus: spy.onSetAttendanceStatus });
    await flushMicrotasks();

    // student-ada: existing method 'qr', status 'present' (TEST_ATTENDANCE).
    expect(checkedStatusOf('student-ada')).toBe('present');
    const ada = row('student-ada');
    act(() => {
      ada.focus();
    });

    dispatchKeyOn(ada, '2'); // Late
    await flushMicrotasks();
    dispatchKeyOn(ada, '4'); // Absent
    await flushMicrotasks();
    dispatchKeyOn(ada, '1'); // Present
    await flushMicrotasks();

    expect(checkedStatusOf('student-ada')).toBe('present');
    // Every call, not just the first. Before the rework this produced
    // ['qr', 'coach', 'coach'] -- wrong on the first call under this ruling,
    // and inconsistent with itself thereafter.
    expect(spy.calls.map((call) => call.method)).toEqual(['coach', 'coach', 'coach']);
    expect(spy.calls.map((call) => call.status)).toEqual(['late', 'absent', 'present']);
    expect(spy.calls.every((call) => call.recordedBy === COACH_USER.id)).toBe(true);
  });

  it('sends "coach" for a real "import" row too — one meaning for the column', async () => {
    const spy = spyResolvingSetAttendanceStatus();
    renderBody(COACH_USER, { onSetAttendanceStatus: spy.onSetAttendanceStatus });
    await flushMicrotasks();

    // student-fay: existing method 'import' (TEST_ATTENDANCE).
    const fay = row('student-fay');
    act(() => {
      fay.focus();
    });
    dispatchKeyOn(fay, '1'); // Present

    // No row may claim `method: 'import'` while naming a coach in
    // `recordedBy` -- the "mismatching on the record" the owner ruled out.
    expect(spy.calls).toEqual([
      {
        sessionId: TEST_SESSION_ID,
        studentId: 'student-fay',
        status: 'present',
        method: 'coach',
        recordedBy: COACH_USER.id,
      },
    ]);
  });

  it('a REJECTED write rolls a row with an existing record back to its previous status, and shows a dismissable error Banner naming the student (Trap 3)', async () => {
    renderBody(COACH_USER, { onSetAttendanceStatus: rejectingSetAttendanceStatus });
    await flushMicrotasks();

    // student-ada starts Present (module doc TEST_ATTENDANCE).
    expect(checkedStatusOf('student-ada')).toBe('present');
    const ada = row('student-ada');
    act(() => {
      ada.focus();
    });
    dispatchKeyOn(ada, '4'); // Absent -- the optimistic update applies immediately.
    expect(checkedStatusOf('student-ada')).toBe('absent');

    await flushMicrotasks(); // let the rejection + rollback settle.

    // Rolled back to the real previous value -- never left showing a status
    // that was never persisted (constitution item 26's HEAVY trigger).
    expect(checkedStatusOf('student-ada')).toBe('present');

    // Asserted by RENDERED TEXT, not `data-testid` (packet section 4b's
    // precision instruction -- `Banner`'s `data-testid` pass-through is
    // unverified), and names the affected student.
    expect(container.textContent).toContain('Attendance not saved');
    expect(container.textContent).toContain('Ada Q.');
  });

  it('a REJECTED write for a student with NO prior record removes the optimistic entry entirely, not a stale status', async () => {
    renderBody(COACH_USER, { onSetAttendanceStatus: rejectingSetAttendanceStatus });
    await flushMicrotasks();

    // student-cy has no attendance entry at all (module doc TEST_ATTENDANCE).
    expect(checkedStatusOf('student-cy')).toBeNull();
    const cy = row('student-cy');
    act(() => {
      cy.focus();
    });
    dispatchKeyOn(cy, '1'); // Present -- optimistic update applies immediately.
    expect(checkedStatusOf('student-cy')).toBe('present');

    await flushMicrotasks();

    expect(checkedStatusOf('student-cy')).toBeNull();
    expect(container.textContent).toContain('Attendance not saved');
    expect(container.textContent).toContain('Cy T.');
  });

  it('the error Banner is dismissable and clears on dismiss', async () => {
    renderBody(COACH_USER, { onSetAttendanceStatus: rejectingSetAttendanceStatus });
    await flushMicrotasks();

    const cy = row('student-cy');
    act(() => {
      cy.focus();
    });
    dispatchKeyOn(cy, '1');
    await flushMicrotasks();
    expect(container.textContent).toContain('Attendance not saved');

    const dismissButton = container.querySelector('button[aria-label="Dismiss"]');
    expect(dismissButton).toBeTruthy();
    act(() => {
      dismissButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(container.textContent).not.toContain('Attendance not saved');
  });

  it('MTG-12 excused-gating still holds: a non-coach/admin role never even attempts a write for "excused"', async () => {
    const spy = spyResolvingSetAttendanceStatus();
    renderBody(STUDENT_USER, { onSetAttendanceStatus: spy.onSetAttendanceStatus });
    await flushMicrotasks();

    const cy = row('student-cy');
    act(() => {
      cy.focus();
    });
    dispatchKeyOn(cy, '3'); // Excused -- no-op for this role (module doc section 4).

    expect(spy.calls).toEqual([]);
    expect(checkedStatusOf('student-cy')).toBeNull();
  });
});
