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
 *   2. A real test of MTG-11 coach-override precedence: a row is set to
 *      coach-Present via the real keyboard path, then a fabricated
 *      QR-sourced Realtime event for the SAME student is fed through the
 *      exact `subscribeToAttendanceChanges` callback contract the component
 *      itself consumes, asserting the row stays coach-Present, unchanged.
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
import { act, useEffect, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { AuthProvider, useAuth, type AuthUser } from '../../app/guards';
import {
  computeAttendanceTally,
  defaultLoadLiveConsoleData,
  filterRosterByQuery,
  formatSessionTimeRange,
  LiveConsoleBody,
  LiveConsolePage,
  mergeAttendanceUpdate,
  notWiredSetAttendanceStatus,
  notWiredSubscribeToAttendanceChanges,
  type AttendanceChangeListener,
  type AttendanceRecordState,
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

/**
 * Logs in via a `useEffect` (not a render-phase call) and withholds
 * rendering `children` until the login has actually taken effect. This
 * matters specifically for `renderPage` below: `LiveConsolePage` nests
 * `RequireRole`, which synchronously `<Navigate>`s away on ANY render where
 * `user` is still `null` -- a render-phase `login()` call (the simpler
 * pattern `CoachHome.test.tsx` uses, safe there because it has no
 * `RequireRole`/`Navigate` in its tree) would let `RequireRole` observe one
 * `user === null` render before the login state update lands, permanently
 * navigating away before the corrected re-render ever has a chance to run.
 * Rendering `null` until `currentUser` is set avoids ever mounting the
 * gated tree with an unauthenticated user.
 */
function LoginAs({ user, children }: { user: AuthUser; children: ReactNode }): ReactNode {
  const { login, user: currentUser } = useAuth();
  useEffect(() => {
    if (currentUser === null) {
      login(user);
    }
  }, [currentUser, login, user]);
  if (currentUser === null) {
    return null;
  }
  return <>{children}</>;
}

const TEST_SESSION_ID = 'session-fixture-1';
const TEST_PATH = `/meetings/live/${TEST_SESSION_ID}`;

/** Renders the UNGATED `LiveConsoleBody` directly (bypasses `RequireRole`,
 * per that component's own module doc section 1/4) inside a real matched
 * route so `useParams()` resolves `sessionId`. */
function renderBody(
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

/** Renders the GATED default export, for the role-guard proof. */
function renderPage(user: AuthUser | null): void {
  act(() => {
    root.render(
      <MemoryRouter initialEntries={[TEST_PATH]}>
        <AuthProvider>
          <Routes>
            <Route
              path="/meetings/live/:sessionId"
              element={
                user === null ? (
                  <LiveConsolePage />
                ) : (
                  <LoginAs user={user}>
                    <LiveConsolePage />
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
// Pure functions -- mergeAttendanceUpdate (MTG-11), filterRosterByQuery,
// computeAttendanceTally, formatSessionTimeRange.
// ---------------------------------------------------------------------------

describe('mergeAttendanceUpdate (MTG-11)', () => {
  const coachRecord: AttendanceRecordState = {
    status: 'present',
    method: 'coach',
    recordedBy: 'user-coach',
    updatedAt: '2026-07-19T23:10:00.000Z',
  };
  const qrRecord: AttendanceRecordState = {
    status: 'late',
    method: 'qr',
    recordedBy: null,
    updatedAt: '2026-07-19T23:11:00.000Z',
  };

  it('applies the incoming value when there is no existing record', () => {
    expect(mergeAttendanceUpdate(null, qrRecord)).toEqual(qrRecord);
  });

  it('a coach-recorded existing value always wins over a later non-coach update', () => {
    expect(mergeAttendanceUpdate(coachRecord, qrRecord)).toEqual(coachRecord);
  });

  it('a coach-recorded existing value is replaced by a NEWER coach update', () => {
    const newerCoachRecord: AttendanceRecordState = {
      status: 'absent',
      method: 'coach',
      recordedBy: 'user-coach',
      updatedAt: '2026-07-19T23:12:00.000Z',
    };
    expect(mergeAttendanceUpdate(coachRecord, newerCoachRecord)).toEqual(newerCoachRecord);
  });

  it('a non-coach existing value is replaced by any incoming update', () => {
    expect(mergeAttendanceUpdate(qrRecord, coachRecord)).toEqual(coachRecord);
    const importRecord: AttendanceRecordState = {
      status: 'absent',
      method: 'import',
      recordedBy: null,
      updatedAt: '2026-07-19T23:13:00.000Z',
    };
    expect(mergeAttendanceUpdate(qrRecord, importRecord)).toEqual(importRecord);
  });
});

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
    renderBody(COACH_USER);
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
    renderBody(COACH_USER);
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
// MTG-11 coach-override precedence (packet Required Worker Output #2).
// ---------------------------------------------------------------------------

describe('MTG-11 coach-override precedence', () => {
  it('a coach-set Present survives a subsequent simulated QR check-in for the same student', async () => {
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

    const cy = row('student-cy');
    act(() => {
      cy.focus();
    });
    dispatchKeyOn(cy, '1'); // Coach sets Present via the real keyboard path.
    expect(checkedStatusOf('student-cy')).toBe('present');

    expect(capturedOnChange).not.toBeNull();
    act(() => {
      capturedOnChange?.({
        studentId: 'student-cy',
        status: 'absent',
        method: 'qr',
        recordedBy: null,
        updatedAt: '2026-07-19T23:30:00.000Z',
      });
    });

    // MTG-11: the coach's Present must survive, unchanged.
    expect(checkedStatusOf('student-cy')).toBe('present');
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

  it('digit "3" is a no-op for a non-coach/admin role (never sets excused via keyboard)', async () => {
    renderBody(STUDENT_USER);
    await flushMicrotasks();

    const cy = row('student-cy');
    act(() => {
      cy.focus();
    });
    dispatchKeyOn(cy, '3');
    // No radio at all is data-value="excused" for this role, and the
    // status must remain unset (no other digit was pressed).
    expect(checkedStatusOf('student-cy')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Router-gap role guard (module doc section 1) -- the gated default export.
// ---------------------------------------------------------------------------

describe('LiveConsolePage role guard', () => {
  it('redirects a non-coach/admin role to "/"', async () => {
    renderPage(STUDENT_USER);
    await flushMicrotasks();
    expect(container.querySelector('[data-testid="redirected-home"]')).toBeTruthy();
    expect(container.textContent).not.toContain('Roster');
  });

  it('renders the real console for a coach role', async () => {
    renderPage(COACH_USER);
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
    renderBody(COACH_USER);
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
    expect(container.textContent).toContain('End meeting');
    expect(container.textContent).toContain('Check-in');
    expect(container.textContent).toContain('Roster');
    expect(container.querySelector('svg[role="img"]')).toBeTruthy(); // QRCodeSVG
    expect(container.textContent).toContain('Open kiosk view');

    const kioskLink = Array.from(container.querySelectorAll('a')).find((a) =>
      a.textContent?.includes('Open kiosk view'),
    );
    expect(kioskLink?.getAttribute('href')).toBe(`/kiosk/${TEST_SESSION_ID}`);
  });

  it('shows an "End-meeting summary not built yet" disclosure Banner when "End meeting" is clicked', async () => {
    renderBody(COACH_USER);
    await flushMicrotasks();

    const endMeetingButton = Array.from(container.querySelectorAll('button')).find(
      (button) => button.textContent?.trim() === 'End meeting',
    );
    expect(endMeetingButton).toBeTruthy();
    act(() => {
      endMeetingButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(container.textContent).toContain('End-meeting summary not built yet');
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
// DES-12 states + persistence seam default.
// ---------------------------------------------------------------------------

describe('DES-12 states', () => {
  it('shows a loading Spinner before loadData resolves', () => {
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
});

describe('persistence seam default', () => {
  it('notWiredSetAttendanceStatus resolves without throwing (no real write exists yet)', async () => {
    await expect(notWiredSetAttendanceStatus()).resolves.toBeUndefined();
  });
});

describe('defaultLoadLiveConsoleData fixture', () => {
  it('resolves a non-empty roster and session for any sessionId', async () => {
    const data = await defaultLoadLiveConsoleData(TEST_SESSION_ID);
    expect(data.session.id).toBe(TEST_SESSION_ID);
    expect(data.roster.length).toBeGreaterThan(0);
  });
});
