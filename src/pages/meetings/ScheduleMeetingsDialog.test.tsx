// @vitest-environment jsdom
/**
 * T031: tests for `ScheduleMeetingsDialog.tsx`.
 *
 * Per this task's Allowed Files, a colocated test file is an explicitly
 * sanctioned addition (same precedent `MeetingsList.test.tsx`/T030,
 * `CheckinResult.test.tsx`/T035, and T038's checker all independently
 * established for this class of task) -- it exists only to produce the
 * DOM-text/math proof this task's own packet requires in "Required Worker
 * Output" (session-generation math for all three modes including the
 * recurring boundary case, and a genuine disabled/enabled button-state
 * transition proof).
 *
 * No `@testing-library/react` is installed in this repo (confirmed via
 * `package.json`) -- these tests use the same raw `createRoot`/`act`
 * pattern `MeetingsList.test.tsx` and `CheckinResult.test.tsx` already
 * established, plus a small `getFieldControl` helper (Astryx `Field`
 * renders a real `<label htmlFor={id}>` for every labeled input -- verified
 * directly against `node_modules/@astryxdesign/core/src/Field/Field.tsx`)
 * to locate inputs by their visible label text without a testing-library
 * `getByLabelText` equivalent.
 */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  buildEditConfirmationDescription,
  buildEditDesiredFutureSessions,
  buildEventSessionsPayload,
  chicagoWallTimeToUtcIso,
  computeConfirmLabel,
  computeMeetingSeriesReconcilePlan,
  computeScheduleSessionDates,
  generateCustomSessionDates,
  generateRecurringSessionDates,
  generateSingleSessionDates,
  isMeetingSessionReconcilable,
  resolveTeamScope,
  ScheduleMeetingsDialog,
  type CreateMeetingsPayload,
  type CreateMeetingsSessionPayload,
  type EditMeetingSeriesInitialData,
  type ExistingMeetingSeriesSession,
  type SaveMeetingSeriesPayload,
  type ScheduleTeamOption,
} from './ScheduleMeetingsDialog';

// ---------------------------------------------------------------------------
// D017 ruling 5 (docs/swarm/dispute-log.md) -- the "T510 edit mode" describe
// below builds fixtures (RECONCILABLE_SESSION_A/_B) whose startsAt are fixed
// 2026 ISO literals, reconciled by this dialog's own production code against
// an unseeded `new Date()`. Left alone, RECONCILABLE_SESSION_A.startsAt
// ('2026-08-10T23:00:00.000Z') silently flips three currently-green tests
// red the moment real wall-clock time crosses it. Pinning ONLY `Date` (never
// other timers -- this file relies on real setTimeout/microtask scheduling
// via `act`/`flushMicrotasks`/genuine promise resolution, and faking those
// too would likely hang it) removes the fuse with zero fixture or assertion
// edits. `2026-08-06T12:00:00.000Z` is not a new value -- it is the same
// literal already used as the local NOW constant in the
// isMeetingSessionReconcilable/computeMeetingSeriesReconcilePlan describes
// below. Boss approval for this existing-test-file modification: D017
// ruling 5 (Non-Negotiable override mechanism, D003 precedent). This is a
// ONE-TIME module-level pin, deliberately NOT inside beforeEach -- there
// must be no `vi.useRealTimers()` call anywhere in this file, or the clock
// silently un-pins after the first test.
// ---------------------------------------------------------------------------
vi.useFakeTimers({ toFake: ['Date'], now: new Date('2026-08-06T12:00:00.000Z') });

// ---------------------------------------------------------------------------
// T151: `teams` is now a required prop (the deleted `DEFAULT_TEAMS` module
// fixture no longer exists) -- one shared local fixture for this file,
// referenced at every render site below, not per-site inline arrays
// (porting the deleted fixture's exact contents; this file has no
// `students`/roster id-coupling constraint, so any fabricated ids would do,
// but reusing the same ones avoids inventing new names for no reason).
// ---------------------------------------------------------------------------
const TEST_TEAMS: readonly ScheduleTeamOption[] = [
  { id: 'team-ravens', name: 'Ravens' },
  { id: 'team-titans', name: 'Titans' },
];

// ---------------------------------------------------------------------------
// jsdom gap: `Dialog` renders a native `<dialog>` and calls
// `HTMLDialogElement.prototype.showModal()`, which this repo's installed
// jsdom (29.x) does not implement. `MeetingsList.test.tsx` (T030) already
// established this exact guarded, test-file-local polyfill (flagged there
// as a candidate for promotion to `test-setup.ts`, which is outside both
// tasks' Allowed Files) -- reused verbatim here, the second consumer that
// file's own comment predicted.
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

async function flushMicrotasks(): Promise<void> {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });
}

/** Locates a labeled input via Astryx `Field`'s real `<label htmlFor>`. */
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

/** T611 (worker packet §5, round 1's BLOCKER-1) -- `TimeInput` fires
 * `onChange(undefined)` ONLY from its own `handleBlur`
 * (`node_modules/@astryxdesign/core/dist/TimeInput/TimeInput.js:215-227`);
 * emptying the input's text via `setNativeInputValue` alone runs
 * `handleInputChange` (`:187-201`), which parses `''` to `null` and never
 * calls `fireChange`. React delegates `onBlur` via the bubbling native
 * `focusout` event, not the non-bubbling `blur` event -- same bubbling-event
 * dispatch precedent as `clickButton` above, applied to blur instead of
 * click. */
function blurInput(input: HTMLInputElement): void {
  act(() => {
    input.dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
  });
}

// ---------------------------------------------------------------------------
// Pure session-generation math (Known Context/Traps #3) -- one describe
// block per schedule mode, plus the recurring boundary case.
// ---------------------------------------------------------------------------

describe('generateSingleSessionDates ("Single" mode)', () => {
  it('returns exactly one date when a date is picked', () => {
    expect(generateSingleSessionDates('2026-07-22')).toEqual(['2026-07-22']);
  });

  it('returns zero dates when nothing is picked yet', () => {
    expect(generateSingleSessionDates(undefined)).toEqual([]);
  });
});

describe('generateRecurringSessionDates ("Weekly recurring" mode)', () => {
  it('generates exactly 18 sessions for a 6-week Mon/Wed/Fri range (boundary case)', () => {
    // 2026-07-06 is a Monday; 2026-08-16 (41 days later) is a Sunday --
    // exactly 6 full calendar weeks, BOTH boundaries inclusive.
    const dates = generateRecurringSessionDates({ start: '2026-07-06', end: '2026-08-16' }, [
      'mon',
      'wed',
      'fri',
    ]);
    expect(dates).toHaveLength(18);
    // Every returned date is genuinely Mon/Wed/Fri, not merely 18 dates of
    // any kind (guards against a generator that padded/truncated to hit 18).
    for (const date of dates) {
      const weekday = new Date(`${date}T12:00:00.000Z`).getUTCDay();
      expect([1, 3, 5]).toContain(weekday);
    }
    // First/last generated dates are the range's own boundary Mondays,
    // proving both ends are inclusive, not off-by-one in either direction.
    expect(dates[0]).toBe('2026-07-06');
    expect(dates[dates.length - 1]).toBe('2026-08-14'); // last Friday <= 2026-08-16
  });

  it('produces exactly 17 (not 18) when the range end is shortened by one day (off-by-one proof)', () => {
    // Same range as above minus the final day (2026-08-15, a Saturday --
    // matches no selected weekday) -- the boundary-inclusive Friday
    // (2026-08-14) is still in range, so this should NOT drop a Friday; the
    // count only drops if the generator is either double-counting the
    // original end date or otherwise off by one.
    const fullRange = generateRecurringSessionDates({ start: '2026-07-06', end: '2026-08-16' }, [
      'mon',
      'wed',
      'fri',
    ]);
    const shortenedByOneDay = generateRecurringSessionDates(
      { start: '2026-07-06', end: '2026-08-15' },
      ['mon', 'wed', 'fri'],
    );
    // 2026-08-16 (Sunday) matches no selected weekday, so removing it from
    // the range must NOT change the count -- proves the original 18 wasn't
    // accidentally counting a non-matching boundary day.
    expect(shortenedByOneDay).toHaveLength(fullRange.length);

    // Shortening past the last matching Friday DOES drop exactly one.
    const shortenedPastLastFriday = generateRecurringSessionDates(
      { start: '2026-07-06', end: '2026-08-13' },
      ['mon', 'wed', 'fri'],
    );
    expect(shortenedPastLastFriday).toHaveLength(fullRange.length - 1);
  });

  it('returns zero dates when no weekday is selected', () => {
    expect(generateRecurringSessionDates({ start: '2026-07-06', end: '2026-08-16' }, [])).toEqual(
      [],
    );
  });

  it('returns zero dates when no range is selected', () => {
    expect(generateRecurringSessionDates(null, ['mon'])).toEqual([]);
  });

  it('returns zero dates when the range is inverted (end before start)', () => {
    expect(
      generateRecurringSessionDates({ start: '2026-08-16', end: '2026-07-06' }, ['mon']),
    ).toEqual([]);
  });

  it('generates a single matching day for a single-day range', () => {
    // 2026-07-22 is a Wednesday.
    expect(
      generateRecurringSessionDates({ start: '2026-07-22', end: '2026-07-22' }, ['wed']),
    ).toEqual(['2026-07-22']);
    expect(
      generateRecurringSessionDates({ start: '2026-07-22', end: '2026-07-22' }, ['thu']),
    ).toEqual([]);
  });
});

describe('generateCustomSessionDates ("Custom dates" mode)', () => {
  it('de-duplicates and sorts an explicit list of picked dates', () => {
    expect(
      generateCustomSessionDates(['2026-08-01', '2026-07-15', '2026-07-15', '2026-07-20']),
    ).toEqual(['2026-07-15', '2026-07-20', '2026-08-01']);
  });

  it('returns zero dates for an empty list', () => {
    expect(generateCustomSessionDates([])).toEqual([]);
  });
});

describe('computeScheduleSessionDates (mode dispatch)', () => {
  it('dispatches to generateSingleSessionDates for "single"', () => {
    expect(
      computeScheduleSessionDates({
        mode: 'single',
        singleDate: '2026-07-22',
        recurringRange: null,
        recurringWeekdays: [],
        customDates: [],
      }),
    ).toEqual(['2026-07-22']);
  });

  it('dispatches to generateRecurringSessionDates for "weekly"', () => {
    expect(
      computeScheduleSessionDates({
        mode: 'weekly',
        singleDate: undefined,
        recurringRange: { start: '2026-07-06', end: '2026-08-16' },
        recurringWeekdays: ['mon', 'wed', 'fri'],
        customDates: [],
      }),
    ).toHaveLength(18);
  });

  it('dispatches to generateCustomSessionDates for "custom"', () => {
    expect(
      computeScheduleSessionDates({
        mode: 'custom',
        singleDate: undefined,
        recurringRange: null,
        recurringWeekdays: [],
        customDates: ['2026-08-01', '2026-07-15'],
      }),
    ).toEqual(['2026-07-15', '2026-08-01']);
  });
});

// ---------------------------------------------------------------------------
// America/Chicago wall-clock -> UTC conversion (NFR-09).
// ---------------------------------------------------------------------------

describe('chicagoWallTimeToUtcIso', () => {
  it('converts a summer (CDT, UTC-5) wall-clock time correctly', () => {
    // Matches MeetingsList.tsx's own known-good fixture: 6:00 PM Chicago in
    // July -> 23:00 UTC.
    expect(chicagoWallTimeToUtcIso('2026-07-22', '18:00')).toBe('2026-07-22T23:00:00.000Z');
  });

  it('converts a winter (CST, UTC-6) wall-clock time correctly', () => {
    expect(chicagoWallTimeToUtcIso('2026-01-15', '18:00')).toBe('2026-01-16T00:00:00.000Z');
  });
});

// ---------------------------------------------------------------------------
// event_sessions payload building -- module doc #1 Trap #1 resolution proof.
// ---------------------------------------------------------------------------

describe('buildEventSessionsPayload (Known Context/Traps #1)', () => {
  it('always supplies a `notes` string, even an empty one -- never null/undefined', () => {
    const sessions = buildEventSessionsPayload(['2026-07-22'], '18:00', '20:00', '');
    expect(sessions).toHaveLength(1);
    expect(sessions[0].notes).toBe('');
    expect(typeof sessions[0].notes).toBe('string');
  });

  it('carries a non-empty notes value through verbatim', () => {
    const sessions = buildEventSessionsPayload(['2026-07-22'], '18:00', '20:00', 'Bring laptops');
    expect(sessions[0].notes).toBe('Bring laptops');
  });

  it('returns zero sessions (not sessions with garbage times) when start/end time is unset', () => {
    expect(buildEventSessionsPayload(['2026-07-22'], undefined, '20:00', '')).toEqual([]);
    expect(buildEventSessionsPayload(['2026-07-22'], '18:00', undefined, '')).toEqual([]);
  });

  it('produces correctly-computed starts_at/ends_at per date', () => {
    const sessions = buildEventSessionsPayload(['2026-07-22', '2026-07-24'], '18:00', '20:00', '');
    expect(sessions).toEqual([
      {
        sessionDate: '2026-07-22',
        startsAt: '2026-07-22T23:00:00.000Z',
        endsAt: '2026-07-23T01:00:00.000Z',
        notes: '',
      },
      {
        sessionDate: '2026-07-24',
        startsAt: '2026-07-24T23:00:00.000Z',
        endsAt: '2026-07-25T01:00:00.000Z',
        notes: '',
      },
    ]);
  });
});

describe('resolveTeamScope', () => {
  it('returns null (all teams) when every known team is selected', () => {
    expect(resolveTeamScope(['a', 'b'], ['a', 'b'])).toBeNull();
    expect(resolveTeamScope(['b', 'a'], ['a', 'b'])).toBeNull(); // order-independent
  });

  it('returns the explicit list when only a subset is selected', () => {
    expect(resolveTeamScope(['a'], ['a', 'b'])).toEqual(['a']);
  });

  it('returns an empty array (not null) when nothing is selected', () => {
    expect(resolveTeamScope([], ['a', 'b'])).toEqual([]);
  });
});

describe('computeConfirmLabel (BEH-07)', () => {
  it('never renders a bare "Create"/"Submit"/"OK" -- always states the computed count', () => {
    // T510 -- `computeConfirmLabel` gains a leading required `isEditMode`
    // parameter (packet §4a/AC1, boss ruling Grant B,
    // `auto-mode-decisions.md` "2026-08-06 -- Boss ruling (constitution item
    // 10)"). Every call site here is CREATE mode (`false`) -- zero asserted
    // strings change.
    expect(computeConfirmLabel(false, 0)).toBe('Create 0 meetings');
    expect(computeConfirmLabel(false, 1)).toBe('Create 1 meeting');
    expect(computeConfirmLabel(false, 14)).toBe('Create 14 meetings');
    expect(computeConfirmLabel(false, 2)).toBe('Create 2 meetings');
  });

  // T510 -- new call sites (additions, not modifications to the five
  // pre-existing ones above/at `:480`, Grant B). Edit-mode output is the
  // literal string 'Save changes', regardless of count.
  it('T510: edit mode always renders "Save changes", regardless of count', () => {
    expect(computeConfirmLabel(true, 0)).toBe('Save changes');
    expect(computeConfirmLabel(true, 1)).toBe('Save changes');
    expect(computeConfirmLabel(true, 14)).toBe('Save changes');
  });
});

// ---------------------------------------------------------------------------
// T510 -- series edit for scheduled meetings. Pure-function proofs for the
// worker packet's Acceptance Criteria (§8): AC2-AC7, AC-B2b, AC-B3a/b/c,
// AC-Bdup, AC11/AC12.
// ---------------------------------------------------------------------------

describe('isMeetingSessionReconcilable (T510 rule 1, AC2)', () => {
  const NOW = new Date('2026-08-06T12:00:00.000Z');

  it('a scheduled session with startsAt exactly equal to now is NOT reconcilable (strict `>` on this function; the protection boundary it produces is non-strict/inclusive)', () => {
    expect(
      isMeetingSessionReconcilable({ status: 'scheduled', startsAt: NOW.toISOString() }, NOW),
    ).toBe(false);
  });

  it('one millisecond in the future IS reconcilable', () => {
    const oneMsLater = new Date(NOW.getTime() + 1).toISOString();
    expect(isMeetingSessionReconcilable({ status: 'scheduled', startsAt: oneMsLater }, NOW)).toBe(
      true,
    );
  });

  it("`canceled` with a future startsAt is NOT reconcilable (this packet's own design decision)", () => {
    const future = new Date(NOW.getTime() + 86400000).toISOString();
    expect(isMeetingSessionReconcilable({ status: 'canceled', startsAt: future }, NOW)).toBe(false);
  });

  it('`completed` with a future startsAt is NOT reconcilable', () => {
    const future = new Date(NOW.getTime() + 86400000).toISOString();
    expect(isMeetingSessionReconcilable({ status: 'completed', startsAt: future }, NOW)).toBe(
      false,
    );
  });
});

describe('computeMeetingSeriesReconcilePlan (T510 rules 1/5, AC3-AC7, AC-B2b, AC-B3a/b/c)', () => {
  const NOW = new Date('2026-08-06T12:00:00.000Z');
  const PAST_DATE = '2026-07-01';
  const PAST_STARTS_AT = '2026-07-01T23:00:00.000Z';
  const PAST_ENDS_AT = '2026-07-02T01:00:00.000Z';
  const FUTURE_DATE_1 = '2026-08-10';
  const FUTURE_STARTS_AT_1 = '2026-08-10T23:00:00.000Z';
  const FUTURE_ENDS_AT_1 = '2026-08-11T01:00:00.000Z';
  const FUTURE_DATE_2 = '2026-08-17';
  const FUTURE_STARTS_AT_2 = '2026-08-17T23:00:00.000Z';
  const FUTURE_ENDS_AT_2 = '2026-08-18T01:00:00.000Z';

  function existingSession(
    overrides: Partial<ExistingMeetingSeriesSession> = {},
  ): ExistingMeetingSeriesSession {
    return {
      sessionId: 'session-1',
      sessionDate: FUTURE_DATE_1,
      startsAt: FUTURE_STARTS_AT_1,
      endsAt: FUTURE_ENDS_AT_1,
      status: 'scheduled',
      ...overrides,
    };
  }

  function desiredSession(
    overrides: Partial<CreateMeetingsSessionPayload> = {},
  ): CreateMeetingsSessionPayload {
    return {
      sessionDate: FUTURE_DATE_1,
      startsAt: FUTURE_STARTS_AT_1,
      endsAt: FUTURE_ENDS_AT_1,
      notes: '',
      ...overrides,
    };
  }

  it('AC3: a reconcilable session whose date persists in the desired schedule appears in toUpdate', () => {
    const existing = [existingSession({ sessionId: 's1' })];
    const desired = [desiredSession()];
    const plan = computeMeetingSeriesReconcilePlan(existing, desired, NOW);
    expect(plan.toUpdate).toEqual([{ sessionId: 's1', session: desired[0] }]);
    expect(plan.toInsert).toEqual([]);
    expect(plan.toRemove).toEqual([]);
  });

  it('AC4: a reconcilable session whose date is dropped from the desired schedule appears in toRemove', () => {
    const existing = [existingSession({ sessionId: 's1' })];
    const plan = computeMeetingSeriesReconcilePlan(existing, [], NOW);
    expect(plan.toRemove).toEqual([{ sessionId: 's1', sessionDate: FUTURE_DATE_1 }]);
    expect(plan.toUpdate).toEqual([]);
    expect(plan.toInsert).toEqual([]);
  });

  it('AC5: a desired date with no existing match of any status appears in toInsert', () => {
    const desired = [
      desiredSession({
        sessionDate: FUTURE_DATE_2,
        startsAt: FUTURE_STARTS_AT_2,
        endsAt: FUTURE_ENDS_AT_2,
      }),
    ];
    const plan = computeMeetingSeriesReconcilePlan([], desired, NOW);
    expect(plan.toInsert).toEqual(desired);
    expect(plan.toUpdate).toEqual([]);
    expect(plan.toRemove).toEqual([]);
  });

  it('AC6: a past session is excluded from every list -- NEVER removed (rule 1: future-forward only)', () => {
    const existing = [
      existingSession({
        sessionId: 's-past',
        sessionDate: PAST_DATE,
        startsAt: PAST_STARTS_AT,
        endsAt: PAST_ENDS_AT,
      }),
    ];
    const plan = computeMeetingSeriesReconcilePlan(existing, [], NOW);
    expect(plan.toUpdate).toEqual([]);
    expect(plan.toInsert).toEqual([]);
    expect(plan.toRemove).toEqual([]);
  });

  it('AC7: an already-canceled future session is excluded from every list (this packet\'s own design decision, NOT the owner\'s "regardless of status" wording)', () => {
    const existing = [existingSession({ sessionId: 's-canceled', status: 'canceled' })];
    const plan = computeMeetingSeriesReconcilePlan(existing, [], NOW);
    expect(plan.toUpdate).toEqual([]);
    expect(plan.toInsert).toEqual([]);
    expect(plan.toRemove).toEqual([]);
  });

  it('AC-B2b: narrowing to zero desired sessions moves EVERY reconcilable session to toRemove', () => {
    const existing = [
      existingSession({
        sessionId: 's1',
        sessionDate: FUTURE_DATE_1,
        startsAt: FUTURE_STARTS_AT_1,
      }),
      existingSession({
        sessionId: 's2',
        sessionDate: FUTURE_DATE_2,
        startsAt: FUTURE_STARTS_AT_2,
      }),
    ];
    const plan = computeMeetingSeriesReconcilePlan(existing, [], NOW);
    expect(plan.toRemove.map((r) => r.sessionId).sort()).toEqual(['s1', 's2']);
    expect(plan.toInsert).toEqual([]);
    expect(plan.toUpdate).toEqual([]);
  });

  it('AC-B3a: a desired date matching an existing PAST session is absorbed, not inserted', () => {
    const existing = [
      existingSession({
        sessionId: 's-past',
        sessionDate: PAST_DATE,
        startsAt: PAST_STARTS_AT,
        endsAt: PAST_ENDS_AT,
      }),
    ];
    // The desired entry's OWN startsAt is future (constructed directly, since
    // this is a pure-function test) -- no existing UI path can produce this
    // collision, per this function's own disclosed-limitation doc.
    const desired = [
      desiredSession({
        sessionDate: PAST_DATE,
        startsAt: FUTURE_STARTS_AT_1,
        endsAt: FUTURE_ENDS_AT_1,
      }),
    ];
    const plan = computeMeetingSeriesReconcilePlan(existing, desired, NOW);
    expect(plan.toInsert).toEqual([]); // absorbed -- not inserted
    expect(plan.toUpdate).toEqual([]); // not reconcilable -- protected
    expect(plan.toRemove).toEqual([]);
  });

  it('AC-B3b: a desired date matching an existing CANCELED future session is absorbed, not inserted', () => {
    const existing = [existingSession({ sessionId: 's-canceled', status: 'canceled' })];
    const desired = [desiredSession()];
    const plan = computeMeetingSeriesReconcilePlan(existing, desired, NOW);
    expect(plan.toInsert).toEqual([]);
    expect(plan.toUpdate).toEqual([]);
    expect(plan.toRemove).toEqual([]);
  });

  it('AC-B3c: a desired session whose own startsAt is not strictly future is dropped before any matching happens', () => {
    // `sessionDate` says "future," but `startsAt` (what this function
    // actually checks) is exactly `now` -- non-strict `>`, dropped.
    const desired = [desiredSession({ startsAt: NOW.toISOString() })];
    const plan = computeMeetingSeriesReconcilePlan([], desired, NOW);
    expect(plan.toInsert).toEqual([]);
    expect(plan.toUpdate).toEqual([]);
    expect(plan.toRemove).toEqual([]);
  });
});

describe('computeMeetingSeriesReconcilePlan -- duplicate session_date among reconcilable sessions (D015 disposition MINOR 3, AC-Bdup)', () => {
  const NOW = new Date('2026-08-06T12:00:00.000Z');
  const SHARED_DATE = '2026-08-10';
  const STARTS_AT_A = '2026-08-10T23:00:00.000Z';
  const ENDS_AT_A = '2026-08-11T01:00:00.000Z';
  const STARTS_AT_B = '2026-08-10T22:00:00.000Z'; // a different instant, same calendar date
  const ENDS_AT_B = '2026-08-11T00:00:00.000Z';

  function dupeSession(id: string, startsAt: string, endsAt: string): ExistingMeetingSeriesSession {
    return { sessionId: id, sessionDate: SHARED_DATE, startsAt, endsAt, status: 'scheduled' };
  }

  it('when the shared date IS still desired: exactly one duplicate appears in toUpdate, the other in neither list', () => {
    const existing = [
      dupeSession('dup-a', STARTS_AT_A, ENDS_AT_A),
      dupeSession('dup-b', STARTS_AT_B, ENDS_AT_B),
    ];
    const desired: CreateMeetingsSessionPayload[] = [
      { sessionDate: SHARED_DATE, startsAt: STARTS_AT_A, endsAt: ENDS_AT_A, notes: '' },
    ];
    const plan = computeMeetingSeriesReconcilePlan(existing, desired, NOW);
    expect(plan.toUpdate).toHaveLength(1);
    expect(['dup-a', 'dup-b']).toContain(plan.toUpdate[0].sessionId);
    expect(plan.toRemove).toEqual([]);
    expect(plan.toInsert).toEqual([]);
  });

  it('when the shared date is NOT desired: BOTH duplicates appear in toRemove', () => {
    const existing = [
      dupeSession('dup-a', STARTS_AT_A, ENDS_AT_A),
      dupeSession('dup-b', STARTS_AT_B, ENDS_AT_B),
    ];
    const plan = computeMeetingSeriesReconcilePlan(existing, [], NOW);
    expect(plan.toRemove.map((r) => r.sessionId).sort()).toEqual(['dup-a', 'dup-b']);
    expect(plan.toUpdate).toEqual([]);
    expect(plan.toInsert).toEqual([]);
  });
});

describe('buildEditConfirmationDescription (rule 6, AC11/AC12)', () => {
  it('AC11: no "Removed:" segment when toRemove.length === 0', () => {
    const description = buildEditConfirmationDescription({
      toInsert: [{ sessionDate: '2026-08-10', startsAt: '', endsAt: '', notes: '' }],
      toUpdate: [],
      toRemove: [],
    });
    expect(description).toBe('1 session(s) added · 0 session(s) removed · 0 session(s) kept.');
    expect(description).not.toContain('Removed:');
  });

  it('AC12: "Removed:" followed by each removed date, human-readable', () => {
    const description = buildEditConfirmationDescription({
      toInsert: [],
      toUpdate: [],
      toRemove: [
        { sessionId: 's1', sessionDate: '2026-08-10' },
        { sessionId: 's2', sessionDate: '2026-08-17' },
      ],
    });
    expect(description).toBe(
      '0 session(s) added · 2 session(s) removed · 0 session(s) kept. Removed: Mon, Aug 10, Mon, Aug 17.',
    );
  });
});

// ---------------------------------------------------------------------------
// T611 -- `buildEditConfirmationDescription`'s additive, optional second
// parameter (worker packet §3.3 item 2/§3.6; D017 ruling 4(b)/MAJOR-B
// criterion (ii)). AC11/AC12 above are NOT edited -- this is additive
// coverage of the two-argument form, not a replacement for them.
// ---------------------------------------------------------------------------

describe('buildEditConfirmationDescription (T611 overwrite suffix, D017 ruling 4(b)/MAJOR-B criterion ii)', () => {
  it('the untouched path (second argument false) reproduces the one-argument output byte-for-byte', () => {
    const plan = {
      toInsert: [{ sessionDate: '2026-08-10', startsAt: '', endsAt: '', notes: '' }],
      toUpdate: [],
      toRemove: [{ sessionId: 's1', sessionDate: '2026-08-17' }],
    };
    expect(buildEditConfirmationDescription(plan, false)).toBe(
      buildEditConfirmationDescription(plan),
    );
  });

  it('the omitted-argument path also reproduces the one-argument output (default false)', () => {
    const plan = {
      toInsert: [],
      toUpdate: [
        {
          sessionId: 's1',
          session: { sessionDate: '2026-08-10', startsAt: '', endsAt: '', notes: '' },
        },
      ],
      toRemove: [],
    };
    // Calling with explicit `undefined` exercises the parameter's own
    // default value, the same as a genuinely one-argument call.
    expect(buildEditConfirmationDescription(plan, undefined)).toBe(
      buildEditConfirmationDescription(plan),
    );
  });

  it('the touched path (second argument true) appends wording stating session times will be overwritten', () => {
    const plan = {
      toInsert: [],
      toUpdate: [
        {
          sessionId: 's1',
          session: { sessionDate: '2026-08-10', startsAt: '', endsAt: '', notes: '' },
        },
      ],
      toRemove: [],
    };
    const untouched = buildEditConfirmationDescription(plan, false);
    const touched = buildEditConfirmationDescription(plan, true);
    expect(touched).not.toBe(untouched);
    expect(touched.startsWith(untouched)).toBe(true);
    expect(touched.toLowerCase()).toContain('overwritten');
  });
});

// ---------------------------------------------------------------------------
// T611 -- `buildEditDesiredFutureSessions` (worker packet §3.5): pure,
// exported, independently testable without a DOM. Fixture times are the
// same two genuinely-divergent, safely-dated values worker packet §4
// specifies (16:00-17:30 CDT on 2026-09-14; 18:00-20:00 CDT on 2026-09-21).
// ---------------------------------------------------------------------------

describe('buildEditDesiredFutureSessions (T611 per-session time preservation)', () => {
  const ORIGINAL_SEP_14 = {
    startsAt: '2026-09-14T21:00:00.000Z', // 16:00 CDT
    endsAt: '2026-09-14T22:30:00.000Z', // 17:30 CDT
  };
  const ORIGINAL_SEP_21 = {
    startsAt: '2026-09-21T23:00:00.000Z', // 18:00 CDT
    endsAt: '2026-09-22T01:00:00.000Z', // 20:00 CDT
  };
  const originalTimesByDate = new Map<string, { startsAt: string; endsAt: string }>([
    ['2026-09-14', ORIGINAL_SEP_14],
    ['2026-09-21', ORIGINAL_SEP_21],
  ]);

  it("preserves each matching date's own original starts_at/ends_at when timeFieldsTouched is false, even though the two originals genuinely diverge", () => {
    const result = buildEditDesiredFutureSessions(
      ['2026-09-14', '2026-09-21'],
      '18:00',
      '20:00',
      false,
      originalTimesByDate,
    );
    expect(result).toHaveLength(2);
    const sep14 = result.find((s) => s.sessionDate === '2026-09-14');
    const sep21 = result.find((s) => s.sessionDate === '2026-09-21');
    expect(sep14?.startsAt).toBe(ORIGINAL_SEP_14.startsAt);
    expect(sep14?.endsAt).toBe(ORIGINAL_SEP_14.endsAt);
    expect(sep21?.startsAt).toBe(ORIGINAL_SEP_21.startsAt);
    expect(sep21?.endsAt).toBe(ORIGINAL_SEP_21.endsAt);
    // The two preserved results genuinely diverge from each other -- proves
    // this isn't accidentally re-deriving one shared value for both dates.
    expect(sep14?.startsAt).not.toBe(sep21?.startsAt);
  });

  it('applies the new shared startTime/endTime to every date when timeFieldsTouched is true, overriding any prior divergence', () => {
    const result = buildEditDesiredFutureSessions(
      ['2026-09-14', '2026-09-21'],
      '18:00',
      '20:00',
      true,
      originalTimesByDate,
    );
    expect(result).toHaveLength(2);
    for (const date of ['2026-09-14', '2026-09-21']) {
      const session = result.find((s) => s.sessionDate === date);
      expect(session?.startsAt).toBe(chicagoWallTimeToUtcIso(date, '18:00'));
      expect(session?.endsAt).toBe(chicagoWallTimeToUtcIso(date, '20:00'));
    }
    const sep14 = result.find((s) => s.sessionDate === '2026-09-14');
    expect(sep14?.startsAt).not.toBe(ORIGINAL_SEP_14.startsAt);
  });

  it('uses the currently displayed startTime/endTime for a date with no entry in originalTimesByDate (a newly added date), regardless of timeFieldsTouched', () => {
    const newDate = '2026-09-28';
    for (const timeFieldsTouched of [false, true]) {
      const result = buildEditDesiredFutureSessions(
        [newDate],
        '18:00',
        '20:00',
        timeFieldsTouched,
        originalTimesByDate,
      );
      expect(result).toHaveLength(1);
      expect(result[0].startsAt).toBe(chicagoWallTimeToUtcIso(newDate, '18:00'));
      expect(result[0].endsAt).toBe(chicagoWallTimeToUtcIso(newDate, '20:00'));
    }
  });
});

// ---------------------------------------------------------------------------
// <ScheduleMeetingsDialog /> -- field order + disabled/enabled proof.
// ---------------------------------------------------------------------------

describe('<ScheduleMeetingsDialog /> field order (MTG-02 / constitution item 13)', () => {
  it('renders fields in the exact MTG-02 order: title, team scope, location, schedule mode, date/time, notes', () => {
    act(() => {
      root.render(<ScheduleMeetingsDialog isOpen onOpenChange={() => {}} teams={TEST_TEAMS} />);
    });
    const labelTexts = Array.from(container.querySelectorAll('label'))
      .map((el) => el.textContent?.trim() ?? '')
      .filter((text) => text !== '');
    // Single mode's default fields (title/team scope/location/schedule
    // mode's own labeled inputs come after it in this order; the
    // SegmentedControl group label itself is aria-label-only, not a
    // rendered <label>, so "Date"/"Start time"/"End time" immediately
    // follow "Location" here).
    expect(labelTexts).toEqual([
      'Title ∙ Required',
      'Team scope',
      'Location',
      'Date ∙ Required',
      'Start time ∙ Required',
      'End time ∙ Required',
      'Notes ∙ Optional',
    ]);
  });
});

describe('<ScheduleMeetingsDialog /> disabled/enabled confirm button (Known Context/Traps #2/#5)', () => {
  it('Single mode: disabled with no date, genuinely non-interactive, then enables on a valid date', async () => {
    const onCreateMeetings = vi.fn().mockResolvedValue(undefined);
    act(() => {
      root.render(
        <ScheduleMeetingsDialog
          isOpen
          onOpenChange={() => {}}
          onCreateMeetings={onCreateMeetings}
          teams={TEST_TEAMS}
        />,
      );
    });

    let confirmButton = findButtonByText('Create 0 meetings');
    expect(confirmButton).toBeDefined();
    expect(confirmButton?.disabled).toBe(true);

    // Genuinely non-interactive: dispatching a click on a natively-disabled
    // button must not invoke the handler.
    clickButton(confirmButton as HTMLButtonElement);
    await flushMicrotasks();
    expect(onCreateMeetings).not.toHaveBeenCalled();

    const dateInput = getFieldControl('Date') as HTMLInputElement;
    act(() => {
      setNativeInputValue(dateInput, '2026-07-22');
    });

    confirmButton = findButtonByText('Create 1 meeting');
    expect(confirmButton).toBeDefined();
    expect(confirmButton?.disabled).toBe(false);

    // Nothing persists until the button is actually clicked (module doc /
    // acceptance criterion) -- picking the date alone must not have called
    // the callback.
    expect(onCreateMeetings).not.toHaveBeenCalled();
  });

  it('Single mode: clicking title empty re-disables the button even with a valid date', () => {
    act(() => {
      root.render(<ScheduleMeetingsDialog isOpen onOpenChange={() => {}} teams={TEST_TEAMS} />);
    });
    const dateInput = getFieldControl('Date') as HTMLInputElement;
    act(() => {
      setNativeInputValue(dateInput, '2026-07-22');
    });
    expect(findButtonByText('Create 1 meeting')?.disabled).toBe(false);

    const titleInput = getFieldControl('Title') as HTMLInputElement;
    act(() => {
      setNativeInputValue(titleInput, '');
    });

    const confirmButton = findButtonByText('Create 1 meeting');
    expect(confirmButton).toBeDefined();
    expect(confirmButton?.disabled).toBe(true);
  });

  it('Weekly recurring mode: disabled with no range/weekday, enables once both are set (via the real DateRangeInput popover + preset)', () => {
    act(() => {
      root.render(<ScheduleMeetingsDialog isOpen onOpenChange={() => {}} teams={TEST_TEAMS} />);
    });

    clickButton(findButtonByText('Weekly recurring') as HTMLButtonElement);
    expect(findButtonByText('Create 0 meetings')?.disabled).toBe(true);

    // Open the real DateRangeInput popover and use its documented `presets`
    // quick-pick ("Next 6 weeks", this component's own preset) -- the same
    // interaction a real user performs, not a state-injection shortcut.
    const rangeTrigger = getFieldControl('Date range') as HTMLButtonElement;
    clickButton(rangeTrigger);
    const presetButton = findButtonByText('Next 6 weeks');
    expect(presetButton).toBeDefined();
    clickButton(presetButton as HTMLButtonElement);

    // Range alone (no weekday) still leaves it disabled.
    expect(findButtonByText('Create 0 meetings')?.disabled).toBe(true);

    const mondayCheckbox = getFieldControl('Mon') as HTMLInputElement;
    clickButton(mondayCheckbox as unknown as HTMLButtonElement);

    // Independently compute the expected count the same way the pure
    // generator would for "today through +41 days, Mondays only" -- proves
    // the DOM-driven count matches the math, not a hardcoded UI number.
    const today = new Date().toISOString().slice(0, 10);
    const sixWeeksOut = new Date(new Date(`${today}T12:00:00.000Z`).getTime() + 41 * 86400000)
      .toISOString()
      .slice(0, 10);
    const expected = generateRecurringSessionDates({ start: today, end: sixWeeksOut }, ['mon']);

    const confirmButton = findButtonByText(computeConfirmLabel(false, expected.length));
    expect(confirmButton).toBeDefined();
    expect(confirmButton?.disabled).toBe(false);
  });

  it('Custom dates mode: disabled with zero picked dates, enables after adding one, count grows/shrinks as dates are added/removed', () => {
    act(() => {
      root.render(<ScheduleMeetingsDialog isOpen onOpenChange={() => {}} teams={TEST_TEAMS} />);
    });
    clickButton(findButtonByText('Custom dates') as HTMLButtonElement);
    expect(findButtonByText('Create 0 meetings')?.disabled).toBe(true);

    const addDateInput = getFieldControl('Add a date') as HTMLInputElement;
    act(() => {
      setNativeInputValue(addDateInput, '2026-07-22');
    });
    clickButton(findButtonByText('Add date') as HTMLButtonElement);

    let confirmButton = findButtonByText('Create 1 meeting');
    expect(confirmButton).toBeDefined();
    expect(confirmButton?.disabled).toBe(false);

    act(() => {
      setNativeInputValue(addDateInput, '2026-07-29');
    });
    clickButton(findButtonByText('Add date') as HTMLButtonElement);

    confirmButton = findButtonByText('Create 2 meetings');
    expect(confirmButton).toBeDefined();
    expect(confirmButton?.disabled).toBe(false);

    // Adding the SAME date again must not double-count it (dedupe proof).
    act(() => {
      setNativeInputValue(addDateInput, '2026-07-29');
    });
    clickButton(findButtonByText('Add date') as HTMLButtonElement);
    expect(findButtonByText('Create 2 meetings')).toBeDefined();

    clickButton(findButtonByText('Remove 2026-07-22') as HTMLButtonElement);
    confirmButton = findButtonByText('Create 1 meeting');
    expect(confirmButton).toBeDefined();
    expect(confirmButton?.disabled).toBe(false);

    clickButton(findButtonByText('Remove 2026-07-29') as HTMLButtonElement);
    expect(findButtonByText('Create 0 meetings')?.disabled).toBe(true);
  });
});

describe('<ScheduleMeetingsDialog /> submit + cancel behavior', () => {
  it('invokes onCreateMeetings with the correct computed payload only when "Create meetings" is clicked', async () => {
    const onCreateMeetings = vi.fn().mockResolvedValue(undefined);
    const onOpenChange = vi.fn();
    act(() => {
      root.render(
        <ScheduleMeetingsDialog
          isOpen
          onOpenChange={onOpenChange}
          onCreateMeetings={onCreateMeetings}
          teams={TEST_TEAMS}
        />,
      );
    });

    const dateInput = getFieldControl('Date') as HTMLInputElement;
    act(() => {
      setNativeInputValue(dateInput, '2026-07-22');
    });

    expect(onCreateMeetings).not.toHaveBeenCalled();

    clickButton(findButtonByText('Create 1 meeting') as HTMLButtonElement);
    await flushMicrotasks();

    expect(onCreateMeetings).toHaveBeenCalledTimes(1);
    const payload = onCreateMeetings.mock.calls[0][0] as CreateMeetingsPayload;
    expect(payload.event.title).toBe('Team meeting');
    expect(payload.event.teamIds).toBeNull(); // default team scope = all teams selected.
    expect(payload.sessions).toHaveLength(1);
    expect(payload.sessions[0].sessionDate).toBe('2026-07-22');
    expect(payload.sessions[0].notes).toBe(''); // Trap #1 resolution.

    // Dialog closes on successful submit.
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('Cancel discards the form and never invokes onCreateMeetings', () => {
    const onCreateMeetings = vi.fn().mockResolvedValue(undefined);
    const onOpenChange = vi.fn();
    act(() => {
      root.render(
        <ScheduleMeetingsDialog
          isOpen
          onOpenChange={onOpenChange}
          onCreateMeetings={onCreateMeetings}
          teams={TEST_TEAMS}
        />,
      );
    });

    const dateInput = getFieldControl('Date') as HTMLInputElement;
    act(() => {
      setNativeInputValue(dateInput, '2026-07-22');
    });

    clickButton(findButtonByText('Cancel') as HTMLButtonElement);

    expect(onCreateMeetings).not.toHaveBeenCalled();
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('resets to pristine defaults every time the dialog re-opens (nothing persists across opens)', () => {
    function Harness(): ReturnType<typeof ScheduleMeetingsDialog> {
      return <ScheduleMeetingsDialog isOpen onOpenChange={() => {}} teams={TEST_TEAMS} />;
    }
    act(() => {
      root.render(<Harness />);
    });
    const dateInput = getFieldControl('Date') as HTMLInputElement;
    act(() => {
      setNativeInputValue(dateInput, '2026-07-22');
    });
    expect(findButtonByText('Create 1 meeting')).toBeDefined();

    // Close then re-open (simulating a parent flipping `isOpen`).
    act(() => {
      root.render(
        <ScheduleMeetingsDialog isOpen={false} onOpenChange={() => {}} teams={TEST_TEAMS} />,
      );
    });
    act(() => {
      root.render(<ScheduleMeetingsDialog isOpen onOpenChange={() => {}} teams={TEST_TEAMS} />);
    });

    // Back to the pristine zero-date state -- the previously-picked date did
    // not persist across the close/re-open cycle.
    expect(findButtonByText('Create 0 meetings')).toBeDefined();
    expect(findButtonByText('Create 1 meeting')).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// T510 -- <ScheduleMeetingsDialog /> edit mode (worker packet §4a/§8): prefill,
// AC10's "already happened" disclosure both directions, AC-B2a (fully-past
// series stays editable), AC-B1 (heterogeneous-time no-op proof), rule 6's
// confirm-before-save `AlertDialog` flow (both confirming and declining).
// ---------------------------------------------------------------------------

describe('<ScheduleMeetingsDialog /> T510 edit mode', () => {
  const RECONCILABLE_SESSION_A: ExistingMeetingSeriesSession = {
    sessionId: 'session-a',
    sessionDate: '2026-08-10',
    startsAt: '2026-08-10T23:00:00.000Z',
    endsAt: '2026-08-11T01:00:00.000Z',
    status: 'scheduled',
  };
  const RECONCILABLE_SESSION_B: ExistingMeetingSeriesSession = {
    sessionId: 'session-b',
    sessionDate: '2026-08-17',
    startsAt: '2026-08-17T23:00:00.000Z',
    endsAt: '2026-08-18T01:00:00.000Z',
    status: 'scheduled',
  };
  // Already happened relative to any real clock this repo's own tests run
  // under (well before this task's own 2026 fixture era) -- deliberately
  // NOT `new Date()`-relative, so this fixture never flips reconcilable.
  const PAST_SESSION: ExistingMeetingSeriesSession = {
    sessionId: 'session-past',
    sessionDate: '2026-07-01',
    startsAt: '2026-07-01T23:00:00.000Z',
    endsAt: '2026-07-02T01:00:00.000Z',
    status: 'completed',
  };

  const EDIT_INITIAL_DATA: EditMeetingSeriesInitialData = {
    eventId: 'event-1',
    title: 'Weekly Build Meeting',
    teamIds: null,
    locationName: 'Robotics Lab',
    description: 'Bring your laptops.',
    sessions: [RECONCILABLE_SESSION_A, RECONCILABLE_SESSION_B, PAST_SESSION],
  };

  // ---------------------------------------------------------------------------
  // T611 (worker packet §4) -- two DEDICATED fixture sessions with genuinely
  // divergent Chicago wall times, dated well clear of any near-term expiry
  // (September 2026, same CDT DST regime as RECONCILABLE_SESSION_A/_B).
  // Deliberately NOT reusing RECONCILABLE_SESSION_B for this purpose: that
  // fixture carries its own real calendar fuse (quarantined by this file's
  // own T613 fake-clock pin above, not by this task) -- a self-contained
  // alternative costs nothing extra and carries no inherited expiry risk.
  // ---------------------------------------------------------------------------
  const DIVERGENT_SESSION_1: ExistingMeetingSeriesSession = {
    sessionId: 'session-divergent-1',
    sessionDate: '2026-09-14',
    startsAt: '2026-09-14T21:00:00.000Z', // 16:00 CDT
    endsAt: '2026-09-14T22:30:00.000Z', // 17:30 CDT
    status: 'scheduled',
  };
  const DIVERGENT_SESSION_2: ExistingMeetingSeriesSession = {
    sessionId: 'session-divergent-2',
    sessionDate: '2026-09-21',
    // Same wall time as DEFAULT_START_TIME/DEFAULT_END_TIME and
    // RECONCILABLE_SESSION_A/_B (18:00-20:00 CDT), on a different,
    // safely-future date -- deliberate: proves the fix by DATE, not only by
    // an unusual time value (worker packet §4).
    startsAt: '2026-09-21T23:00:00.000Z', // 18:00 CDT
    endsAt: '2026-09-22T01:00:00.000Z', // 20:00 CDT
    status: 'scheduled',
  };
  const EDIT_INITIAL_DATA_DIVERGENT: EditMeetingSeriesInitialData = {
    ...EDIT_INITIAL_DATA,
    sessions: [DIVERGENT_SESSION_1, DIVERGENT_SESSION_2],
  };
  // Assertion 3 (D017 ruling 4(a)/MAJOR-A) requires querying for the EXACT
  // SAME disclosure string assertion 1 queries for -- one shared constant so
  // that requirement cannot silently drift into two independently-worded
  // checks (worker packet §5).
  const DIVERGENCE_DISCLOSURE_TEXT = 'Sessions in this series currently have different times.';

  /** AlertDialog renders its own native `<dialog role="alertdialog">`
   * (`node_modules/@astryxdesign/core/src/AlertDialog/AlertDialog.tsx`) --
   * an unambiguous scope for its own "Save changes"/"Cancel" buttons, which
   * otherwise share visible text with the MAIN dialog's own footer buttons. */
  function findAlertDialogElement(): HTMLElement | undefined {
    return (
      (document.querySelector('dialog[role="alertdialog"]') as HTMLElement | null) ?? undefined
    );
  }

  function findButtonInAlertDialog(text: string): HTMLButtonElement | undefined {
    return Array.from(findAlertDialogElement()?.querySelectorAll('button') ?? []).find(
      (button) => button.textContent?.trim() === text,
    );
  }

  it('opens prefilled from initialData, edit-mode title, and the "already happened" disclosure (AC10, prefill)', () => {
    act(() => {
      root.render(
        <ScheduleMeetingsDialog
          isOpen
          onOpenChange={() => {}}
          teams={TEST_TEAMS}
          initialData={EDIT_INITIAL_DATA}
        />,
      );
    });

    expect(document.body.textContent).toContain('Edit meeting series');
    expect((getFieldControl('Title') as HTMLInputElement).value).toBe('Weekly Build Meeting');
    expect((getFieldControl('Location') as HTMLInputElement).value).toBe('Robotics Lab');
    expect((getFieldControl('Description') as HTMLTextAreaElement).value).toBe(
      'Bring your laptops.',
    );
    // AC10 -- disclosure present: exactly 1 of the 3 sessions is not reconcilable.
    expect(container.textContent).toContain(
      '1 session(s) have already happened and are not affected by this edit.',
    );
    // Edit mode's confirm label is always 'Save changes', per computeConfirmLabel.
    expect(findButtonByText('Save changes')).toBeDefined();
  });

  it('AC10 (other direction): no disclosure line when every session is still reconcilable', () => {
    act(() => {
      root.render(
        <ScheduleMeetingsDialog
          isOpen
          onOpenChange={() => {}}
          teams={TEST_TEAMS}
          initialData={{
            ...EDIT_INITIAL_DATA,
            sessions: [RECONCILABLE_SESSION_A, RECONCILABLE_SESSION_B],
          }}
        />,
      );
    });
    expect(container.textContent).not.toContain('have already happened');
  });

  it('AC-B2a: a fully-past series (zero reconcilable sessions) stays editable -- the confirm button is enabled', () => {
    act(() => {
      root.render(
        <ScheduleMeetingsDialog
          isOpen
          onOpenChange={() => {}}
          teams={TEST_TEAMS}
          initialData={{ ...EDIT_INITIAL_DATA, sessions: [PAST_SESSION] }}
        />,
      );
    });
    const confirmButton = findButtonByText('Save changes');
    expect(confirmButton).toBeDefined();
    expect(confirmButton?.disabled).toBe(false);
  });

  it("AC-B1: saving with no schedule change preserves every toUpdate session's starts_at/ends_at as the SAME instant (heterogeneous-time no-op proof)", async () => {
    const onSaveMeetingSeries = vi.fn().mockResolvedValue(undefined);
    act(() => {
      root.render(
        <ScheduleMeetingsDialog
          isOpen
          onOpenChange={() => {}}
          teams={TEST_TEAMS}
          initialData={EDIT_INITIAL_DATA}
          onSaveMeetingSeries={onSaveMeetingSeries}
        />,
      );
    });

    clickButton(findButtonByText('Save changes') as HTMLButtonElement);
    await flushMicrotasks();
    // Rule 6 -- does NOT call onSaveMeetingSeries yet; a confirmation opens first.
    expect(onSaveMeetingSeries).not.toHaveBeenCalled();
    expect(findAlertDialogElement()?.hasAttribute('open')).toBe(true);

    const confirmInAlert = findButtonInAlertDialog('Save changes');
    expect(confirmInAlert).toBeTruthy();
    clickButton(confirmInAlert as HTMLButtonElement);
    await flushMicrotasks();

    expect(onSaveMeetingSeries).toHaveBeenCalledTimes(1);
    const payload = onSaveMeetingSeries.mock.calls[0][0] as SaveMeetingSeriesPayload;
    expect(payload.eventId).toBe('event-1');
    expect(payload.desiredFutureSessions).toHaveLength(2);
    for (const original of [RECONCILABLE_SESSION_A, RECONCILABLE_SESSION_B]) {
      const saved = payload.desiredFutureSessions.find(
        (s) => s.sessionDate === original.sessionDate,
      );
      expect(saved).toBeDefined();
      // Compare via getTime() (pins the intent -- the same INSTANT -- not
      // literal string equality, per AC-B1's own scoping note).
      expect(new Date(saved?.startsAt ?? '').getTime()).toBe(new Date(original.startsAt).getTime());
      expect(new Date(saved?.endsAt ?? '').getTime()).toBe(new Date(original.endsAt).getTime());
    }
  });

  it('confirming saves the current field edits (title/location/description) alongside the schedule', async () => {
    const onSaveMeetingSeries = vi.fn().mockResolvedValue(undefined);
    act(() => {
      root.render(
        <ScheduleMeetingsDialog
          isOpen
          onOpenChange={() => {}}
          teams={TEST_TEAMS}
          initialData={EDIT_INITIAL_DATA}
          onSaveMeetingSeries={onSaveMeetingSeries}
        />,
      );
    });

    const titleInput = getFieldControl('Title') as HTMLInputElement;
    act(() => {
      setNativeInputValue(titleInput, 'Renamed Build Meeting');
    });

    clickButton(findButtonByText('Save changes') as HTMLButtonElement);
    await flushMicrotasks();
    clickButton(findButtonInAlertDialog('Save changes') as HTMLButtonElement);
    await flushMicrotasks();

    expect(onSaveMeetingSeries).toHaveBeenCalledTimes(1);
    const payload = onSaveMeetingSeries.mock.calls[0][0] as SaveMeetingSeriesPayload;
    expect(payload.event.title).toBe('Renamed Build Meeting');
    expect(payload.event.locationName).toBe('Robotics Lab');
    expect(payload.event.description).toBe('Bring your laptops.');
  });

  it('declining the confirmation returns to the form with field state intact, and never calls onSaveMeetingSeries', async () => {
    const onSaveMeetingSeries = vi.fn().mockResolvedValue(undefined);
    act(() => {
      root.render(
        <ScheduleMeetingsDialog
          isOpen
          onOpenChange={() => {}}
          teams={TEST_TEAMS}
          initialData={EDIT_INITIAL_DATA}
          onSaveMeetingSeries={onSaveMeetingSeries}
        />,
      );
    });

    const titleInput = getFieldControl('Title') as HTMLInputElement;
    act(() => {
      setNativeInputValue(titleInput, 'Renamed Meeting');
    });

    clickButton(findButtonByText('Save changes') as HTMLButtonElement);
    await flushMicrotasks();
    const cancelInAlert = findButtonInAlertDialog('Cancel');
    expect(cancelInAlert).toBeTruthy();
    clickButton(cancelInAlert as HTMLButtonElement);
    await flushMicrotasks();

    expect(onSaveMeetingSeries).not.toHaveBeenCalled();
    // Field state intact -- the rename survived declining the confirmation.
    expect((getFieldControl('Title') as HTMLInputElement).value).toBe('Renamed Meeting');
    // And the main dialog is still open (declining the confirmation must not
    // also close the whole edit dialog).
    expect(document.body.textContent).toContain('Edit meeting series');
  });

  it('create mode is unaffected: no Description field, no "already happened" disclosure, no AlertDialog opens on submit', async () => {
    const onCreateMeetings = vi.fn().mockResolvedValue(undefined);
    act(() => {
      root.render(
        <ScheduleMeetingsDialog
          isOpen
          onOpenChange={() => {}}
          teams={TEST_TEAMS}
          onCreateMeetings={onCreateMeetings}
        />,
      );
    });
    expect(() => getFieldControl('Description')).toThrow();
    expect(container.textContent).not.toContain('have already happened');

    const dateInput = getFieldControl('Date') as HTMLInputElement;
    act(() => {
      setNativeInputValue(dateInput, '2026-08-10');
    });
    clickButton(findButtonByText('Create 1 meeting') as HTMLButtonElement);
    await flushMicrotasks();

    expect(onCreateMeetings).toHaveBeenCalledTimes(1);
    expect(findAlertDialogElement()?.hasAttribute('open')).toBe(false);
  });

  it('T609: Notes is create-mode only -- absent when editing, present when creating', () => {
    act(() => {
      root.render(
        <ScheduleMeetingsDialog
          isOpen
          onOpenChange={() => {}}
          teams={TEST_TEAMS}
          initialData={EDIT_INITIAL_DATA}
        />,
      );
    });
    expect(() => getFieldControl('Notes')).toThrow();

    act(() => {
      root.render(<ScheduleMeetingsDialog isOpen onOpenChange={() => {}} teams={TEST_TEAMS} />);
    });
    expect(getFieldControl('Notes')).toBeDefined();
  });

  // ---------------------------------------------------------------------------
  // T611 -- stop a series edit from silently rewriting per-session meeting
  // times (worker packet, all of §5). Uses the DIVERGENT_SESSION_1/2 fixtures
  // above (§4) -- never RECONCILABLE_SESSION_A/_B, which are T613's territory.
  // ---------------------------------------------------------------------------

  it("T611 regression proof: saving with no time-field interaction preserves each session's own original time even though the two sessions genuinely diverge", async () => {
    const onSaveMeetingSeries = vi.fn().mockResolvedValue(undefined);
    act(() => {
      root.render(
        <ScheduleMeetingsDialog
          isOpen
          onOpenChange={() => {}}
          teams={TEST_TEAMS}
          initialData={EDIT_INITIAL_DATA_DIVERGENT}
          onSaveMeetingSeries={onSaveMeetingSeries}
        />,
      );
    });

    clickButton(findButtonByText('Save changes') as HTMLButtonElement);
    await flushMicrotasks();
    clickButton(findButtonInAlertDialog('Save changes') as HTMLButtonElement);
    await flushMicrotasks();

    expect(onSaveMeetingSeries).toHaveBeenCalledTimes(1);
    const payload = onSaveMeetingSeries.mock.calls[0][0] as SaveMeetingSeriesPayload;
    expect(payload.desiredFutureSessions).toHaveLength(2);
    for (const original of [DIVERGENT_SESSION_1, DIVERGENT_SESSION_2]) {
      const saved = payload.desiredFutureSessions.find(
        (s) => s.sessionDate === original.sessionDate,
      );
      expect(saved).toBeDefined();
      // Compare via getTime() (pins the intent -- the same INSTANT -- not
      // literal string equality, mirroring AC-B1's own scoping note above).
      expect(new Date(saved?.startsAt ?? '').getTime()).toBe(new Date(original.startsAt).getTime());
      expect(new Date(saved?.endsAt ?? '').getTime()).toBe(new Date(original.endsAt).getTime());
    }
    // The two preserved sessions genuinely diverge from each other -- this is
    // the direct regression proof the §6 mutation must redden.
    const saved1 = payload.desiredFutureSessions.find((s) => s.sessionDate === '2026-09-14');
    const saved2 = payload.desiredFutureSessions.find((s) => s.sessionDate === '2026-09-21');
    expect(new Date(saved1?.startsAt ?? '').getTime()).not.toBe(
      new Date(saved2?.startsAt ?? '').getTime(),
    );
  });

  it('explicitly changing the Start time field applies the new time to every future session, including ones whose original times previously diverged from each other', async () => {
    const onSaveMeetingSeries = vi.fn().mockResolvedValue(undefined);
    act(() => {
      root.render(
        <ScheduleMeetingsDialog
          isOpen
          onOpenChange={() => {}}
          teams={TEST_TEAMS}
          initialData={EDIT_INITIAL_DATA_DIVERGENT}
          onSaveMeetingSeries={onSaveMeetingSeries}
        />,
      );
    });

    // TimeInput renders 12-hour by default (worker packet §4's display-format
    // note) -- "5:00 PM" parses immediately (TimeInput's own
    // `handleInputChange`, no blur required) to the ISO time "17:00".
    const startTimeInput = getFieldControl('Start time') as HTMLInputElement;
    act(() => {
      setNativeInputValue(startTimeInput, '5:00 PM');
    });

    clickButton(findButtonByText('Save changes') as HTMLButtonElement);
    await flushMicrotasks();
    clickButton(findButtonInAlertDialog('Save changes') as HTMLButtonElement);
    await flushMicrotasks();

    expect(onSaveMeetingSeries).toHaveBeenCalledTimes(1);
    const payload = onSaveMeetingSeries.mock.calls[0][0] as SaveMeetingSeriesPayload;
    const saved1 = payload.desiredFutureSessions.find((s) => s.sessionDate === '2026-09-14');
    const saved2 = payload.desiredFutureSessions.find((s) => s.sessionDate === '2026-09-21');
    expect(saved1?.startsAt).toBe(chicagoWallTimeToUtcIso('2026-09-14', '17:00'));
    expect(saved2?.startsAt).toBe(chicagoWallTimeToUtcIso('2026-09-21', '17:00'));
    // Neither preserves its own original, genuinely-divergent starting time.
    expect(saved1?.startsAt).not.toBe(DIVERGENT_SESSION_1.startsAt);
    expect(saved2?.startsAt).not.toBe(DIVERGENT_SESSION_2.startsAt);
  });

  describe('T611 §3.3 divergence disclosure (D017 ruling 4(a)/MAJOR-A -- three assertions, all required, not any two)', () => {
    it('1. present -- the divergent fixtures, zero time-field interaction', () => {
      act(() => {
        root.render(
          <ScheduleMeetingsDialog
            isOpen
            onOpenChange={() => {}}
            teams={TEST_TEAMS}
            initialData={EDIT_INITIAL_DATA_DIVERGENT}
          />,
        );
      });
      expect(container.textContent).toContain(DIVERGENCE_DISCLOSURE_TEXT);
    });

    it('2. absent after touch -- the divergent fixtures, a time field edited', () => {
      act(() => {
        root.render(
          <ScheduleMeetingsDialog
            isOpen
            onOpenChange={() => {}}
            teams={TEST_TEAMS}
            initialData={EDIT_INITIAL_DATA_DIVERGENT}
          />,
        );
      });
      expect(container.textContent).toContain(DIVERGENCE_DISCLOSURE_TEXT);

      const startTimeInput = getFieldControl('Start time') as HTMLInputElement;
      act(() => {
        setNativeInputValue(startTimeInput, '5:00 PM');
      });
      expect(container.textContent).not.toContain(DIVERGENCE_DISCLOSURE_TEXT);
    });

    it('3. absent on a non-divergent series -- EDIT_INITIAL_DATA (its three sessions share one 18:00-20:00 CDT wall time by construction), zero interaction', () => {
      act(() => {
        root.render(
          <ScheduleMeetingsDialog
            isOpen
            onOpenChange={() => {}}
            teams={TEST_TEAMS}
            initialData={EDIT_INITIAL_DATA}
          />,
        );
      });
      // Same query string as assertion 1 above -- not a separately-worded
      // absence check (worker packet §5's own mandate, closing the exact gap
      // round 2's gate proved: deleting the divergence condition entirely
      // left all tests green because nothing asserted this negative case).
      expect(container.textContent).not.toContain(DIVERGENCE_DISCLOSURE_TEXT);
    });
  });

  it("T611 confirmation suffix (D017 ruling 4(b)/MAJOR-B criterion i): touching a time field on divergent sessions discloses the overwrite in the real AlertDialog's own description", async () => {
    act(() => {
      root.render(
        <ScheduleMeetingsDialog
          isOpen
          onOpenChange={() => {}}
          teams={TEST_TEAMS}
          initialData={EDIT_INITIAL_DATA_DIVERGENT}
        />,
      );
    });

    const startTimeInput = getFieldControl('Start time') as HTMLInputElement;
    act(() => {
      setNativeInputValue(startTimeInput, '5:00 PM');
    });

    clickButton(findButtonByText('Save changes') as HTMLButtonElement);
    await flushMicrotasks();

    expect(findAlertDialogElement()?.hasAttribute('open')).toBe(true);
    expect(findAlertDialogElement()?.textContent?.toLowerCase()).toContain('overwritten');
  });

  it('clearing a touched time field disables the Save changes button in edit mode (round 1 BLOCKER-1 mechanism: change-to-empty alone is NOT enough, a real blur is required)', () => {
    act(() => {
      root.render(
        <ScheduleMeetingsDialog
          isOpen
          onOpenChange={() => {}}
          teams={TEST_TEAMS}
          initialData={EDIT_INITIAL_DATA}
        />,
      );
    });
    expect(findButtonByText('Save changes')?.disabled).toBe(false);

    const startTimeInput = getFieldControl('Start time') as HTMLInputElement;
    act(() => {
      setNativeInputValue(startTimeInput, '');
    });
    // Emptying the text alone does NOT disable the button yet -- TimeInput's
    // own `handleInputChange` parses '' to `null` and never calls
    // `fireChange` (round 1's BLOCKER-1); this dialog's `onChange` prop is
    // never invoked, so `timeFieldsTouched` has not latched yet either.
    expect(findButtonByText('Save changes')?.disabled).toBe(false);

    blurInput(startTimeInput);
    // Only after a real blur/focusout does TimeInput's own `handleBlur` call
    // `fireChange(undefined)`, which both latches `timeFieldsTouched` and
    // leaves `startTime` undefined -- the new edit-mode `isValid` condition
    // (worker packet §3.4's "Consequence for isValid") disables the button.
    expect(findButtonByText('Save changes')?.disabled).toBe(true);
  });
});
