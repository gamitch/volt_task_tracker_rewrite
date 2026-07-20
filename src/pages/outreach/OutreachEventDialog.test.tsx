// @vitest-environment jsdom
/**
 * T039: tests for `OutreachEventDialog.tsx`.
 *
 * Per this task's Allowed Files, a colocated test file is an explicitly
 * sanctioned addition (same precedent `ScheduleMeetingsDialog.test.tsx`/T031,
 * `MeetingsList.test.tsx`/T030, `CheckinResult.test.tsx`/T035, and T038's
 * checker all independently established) -- it exists to produce the
 * DOM-text/math proof this task's own packet requires in "Required Worker
 * Output" (CMP-02 flag visibility gating, the BEH-07/disabled-state
 * behavior, and the `notes` nullability precedent).
 *
 * T118 (UXP-02) ADDITION: the "Expected attendees" checklist's own pure
 * functions/UI/submit-payload tests, plus loader-level tests for
 * `makeSaveOutreachEvent`'s new RSVP fan-out (`../../lib/supabase/loaders/
 * outreach.ts`, module doc 7) -- same "import the real loader default
 * directly and drive it with a fake `SupabaseClient`" precedent
 * `MarkDayCompleteDialog.test.tsx`'s own `makeMarkDayComplete` tests already
 * established, reused here since `OutreachList.test.tsx`/
 * `OutreachDetail.test.tsx` (this repo's usual home for `saveOutreachEvent`
 * tests) are both out of this task's own Allowed Files.
 *
 * No `@testing-library/react` is installed in this repo (confirmed via
 * `package.json`) -- these tests use the same raw `createRoot`/`act` pattern
 * `ScheduleMeetingsDialog.test.tsx` established, plus its `getFieldControl`
 * helper (Astryx `Field`/`FieldLabel` renders a real `<label htmlFor={id}>`
 * for every labeled input, verified directly against
 * `node_modules/@astryxdesign/core/src/Field/FieldLabel.tsx`).
 *
 * jsdom gap note: `Selector`'s popover (`node_modules/@astryxdesign/core/src/
 * Layer/useLayer.tsx`, `show()`) already gracefully degrades when
 * `HTMLElement.prototype.showPopover` is missing (falls back to
 * `popover.style.display = 'block'`, the same "Firefox <125 / Safari <17"
 * guard the library ships for real unsupported browsers) -- confirmed by
 * reading that file directly. No jsdom Popover-API polyfill is needed for
 * this file's `Selector` interactions, unlike `Dialog`'s native
 * `showModal()` gap below (which `ScheduleMeetingsDialog.test.tsx` already
 * established a polyfill for and is reused verbatim here).
 */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import type { SupabaseClient } from '@supabase/supabase-js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  buildOutreachSessionsPayload,
  chicagoWallTimeToUtcIso,
  computeConfirmLabel,
  computeOutreachScheduleSessionDates,
  generateCustomSessionDates,
  generateMultiDaySessionDates,
  generateRecurringSessionDates,
  generateSingleSessionDates,
  groupActiveRosterByTeam,
  OutreachEventDialog,
  PLACEHOLDER_CURRENT_COACH_PROFILE_ID,
  resolveEventTypeFlags,
  resolveExpectedAttendeeIds,
  resolveTeamScope,
  syncSessionDetails,
  type ExistingOutreachEvent,
  type OutreachRosterStudent,
  type SaveOutreachEventPayload,
} from './OutreachEventDialog';
import {
  computeExpectedAttendeeRsvpPlan,
  makeLoadOutreachEventRoster,
  makeSaveOutreachEvent,
} from '../../lib/supabase/loaders/outreach';
import type { ISOTimeString } from '@astryxdesign/core';

/** Test-only cast for the branded `ISOTimeString` type -- every literal used
 * below is already a valid `'HH:MM'` string, so this is a plain type
 * assertion (not `createISOTimeString`'s runtime validation path), matching
 * the same brand this file's own `syncSessionDetails`/
 * `buildOutreachSessionsPayload` pure-function signatures require. */
function t(value: string): ISOTimeString {
  return value as ISOTimeString;
}

// ---------------------------------------------------------------------------
// jsdom gap: `Dialog` renders a native `<dialog>` and calls
// `HTMLDialogElement.prototype.showModal()`, which this repo's installed
// jsdom (29.x) does not implement. `ScheduleMeetingsDialog.test.tsx` (T031)
// already established this exact guarded, test-file-local polyfill -- reused
// verbatim here.
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

/** Locates a labeled input via Astryx `Field`/`FieldLabel`'s real
 * `<label htmlFor>`. */
function getFieldControl(labelText: string): HTMLElement {
  const labels = Array.from(document.querySelectorAll('label'));
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

function clickButton(button: HTMLElement): void {
  act(() => {
    button.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
}

// ---------------------------------------------------------------------------
// Pure session-generation math -- one describe block per schedule mode.
// ---------------------------------------------------------------------------

describe('generateSingleSessionDates ("Single" mode)', () => {
  it('returns exactly one date when a date is picked', () => {
    expect(generateSingleSessionDates('2026-07-22')).toEqual(['2026-07-22']);
  });

  it('returns zero dates when nothing is picked yet', () => {
    expect(generateSingleSessionDates(undefined)).toEqual([]);
  });
});

describe('generateMultiDaySessionDates ("Multi-day" mode)', () => {
  it('generates every calendar day inclusive, unfiltered by weekday', () => {
    expect(generateMultiDaySessionDates({ start: '2026-07-20', end: '2026-07-22' })).toEqual([
      '2026-07-20',
      '2026-07-21',
      '2026-07-22',
    ]);
  });

  it('generates a single day for a single-day range', () => {
    expect(generateMultiDaySessionDates({ start: '2026-07-20', end: '2026-07-20' })).toEqual([
      '2026-07-20',
    ]);
  });

  it('returns zero dates for a null range', () => {
    expect(generateMultiDaySessionDates(null)).toEqual([]);
  });

  it('returns zero dates when the range is inverted (end before start)', () => {
    expect(generateMultiDaySessionDates({ start: '2026-07-22', end: '2026-07-20' })).toEqual([]);
  });
});

describe('generateRecurringSessionDates ("Recurring" mode)', () => {
  it('generates exactly 18 sessions for a 6-week Mon/Wed/Fri range (boundary case)', () => {
    // 2026-07-06 is a Monday; 2026-08-16 (41 days later) is a Sunday --
    // exactly 6 full calendar weeks, BOTH boundaries inclusive.
    const dates = generateRecurringSessionDates({ start: '2026-07-06', end: '2026-08-16' }, [
      'mon',
      'wed',
      'fri',
    ]);
    expect(dates).toHaveLength(18);
    for (const date of dates) {
      const weekday = new Date(`${date}T12:00:00.000Z`).getUTCDay();
      expect([1, 3, 5]).toContain(weekday);
    }
    expect(dates[0]).toBe('2026-07-06');
    expect(dates[dates.length - 1]).toBe('2026-08-14'); // last Friday <= 2026-08-16
  });

  it('produces exactly 17 (not 18) when the range end is shortened past the last matching Friday', () => {
    const fullRange = generateRecurringSessionDates({ start: '2026-07-06', end: '2026-08-16' }, [
      'mon',
      'wed',
      'fri',
    ]);
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

describe('computeOutreachScheduleSessionDates (mode dispatch)', () => {
  it('dispatches to generateSingleSessionDates for "single"', () => {
    expect(
      computeOutreachScheduleSessionDates({
        mode: 'single',
        singleDate: '2026-07-22',
        multiDayRange: null,
        recurringRange: null,
        recurringWeekdays: [],
        customDates: [],
      }),
    ).toEqual(['2026-07-22']);
  });

  it('dispatches to generateMultiDaySessionDates for "multiDay"', () => {
    expect(
      computeOutreachScheduleSessionDates({
        mode: 'multiDay',
        singleDate: undefined,
        multiDayRange: { start: '2026-07-20', end: '2026-07-22' },
        recurringRange: null,
        recurringWeekdays: [],
        customDates: [],
      }),
    ).toEqual(['2026-07-20', '2026-07-21', '2026-07-22']);
  });

  it('dispatches to generateRecurringSessionDates for "recurring"', () => {
    expect(
      computeOutreachScheduleSessionDates({
        mode: 'recurring',
        singleDate: undefined,
        multiDayRange: null,
        recurringRange: { start: '2026-07-06', end: '2026-08-16' },
        recurringWeekdays: ['mon', 'wed', 'fri'],
        customDates: [],
      }),
    ).toHaveLength(18);
  });

  it('dispatches to generateCustomSessionDates for "custom"', () => {
    expect(
      computeOutreachScheduleSessionDates({
        mode: 'custom',
        singleDate: undefined,
        multiDayRange: null,
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
    expect(chicagoWallTimeToUtcIso('2026-07-22', '09:00')).toBe('2026-07-22T14:00:00.000Z');
  });

  it('converts a winter (CST, UTC-6) wall-clock time correctly', () => {
    expect(chicagoWallTimeToUtcIso('2026-01-15', '09:00')).toBe('2026-01-15T15:00:00.000Z');
  });
});

// ---------------------------------------------------------------------------
// Per-session detail sync + payload building (module doc #6, Trap #3).
// ---------------------------------------------------------------------------

describe('syncSessionDetails', () => {
  it('seeds brand-new dates with the given default times and no expected count', () => {
    const result = syncSessionDetails(['2026-07-22'], {}, t('09:00'), t('12:00'));
    expect(result).toEqual({
      '2026-07-22': { startTime: '09:00', endTime: '12:00', peopleReached: null },
    });
  });

  it('preserves an existing entry for a date that survives the change (does not reset user edits)', () => {
    const prev = {
      '2026-07-22': { startTime: t('10:30'), endTime: t('13:00'), peopleReached: 50 },
    };
    const result = syncSessionDetails(['2026-07-22', '2026-07-23'], prev, t('09:00'), t('12:00'));
    expect(result['2026-07-22']).toEqual({
      startTime: '10:30',
      endTime: '13:00',
      peopleReached: 50,
    });
    expect(result['2026-07-23']).toEqual({
      startTime: '09:00',
      endTime: '12:00',
      peopleReached: null,
    });
  });

  it('drops entries for dates no longer selected', () => {
    const prev = {
      '2026-07-22': { startTime: t('10:30'), endTime: t('13:00'), peopleReached: 50 },
    };
    const result = syncSessionDetails(['2026-07-23'], prev, t('09:00'), t('12:00'));
    expect(result['2026-07-22']).toBeUndefined();
    expect(Object.keys(result)).toEqual(['2026-07-23']);
  });
});

describe('buildOutreachSessionsPayload (Known Context/Traps #3)', () => {
  it('always supplies a `notes` string, even an empty one -- never null/undefined', () => {
    const sessions = buildOutreachSessionsPayload(['2026-07-22'], {
      '2026-07-22': { startTime: t('09:00'), endTime: t('12:00'), peopleReached: null },
    });
    expect(sessions).toHaveLength(1);
    expect(sessions[0].notes).toBe('');
    expect(typeof sessions[0].notes).toBe('string');
  });

  it('carries the expected people-reached count through verbatim, including null', () => {
    const sessions = buildOutreachSessionsPayload(['2026-07-22', '2026-07-23'], {
      '2026-07-22': { startTime: t('09:00'), endTime: t('12:00'), peopleReached: 40 },
      '2026-07-23': { startTime: t('09:00'), endTime: t('12:00'), peopleReached: null },
    });
    expect(sessions[0].peopleReached).toBe(40);
    expect(sessions[1].peopleReached).toBeNull();
  });

  it('skips (does not emit a garbage row for) a date whose start/end time is still unset', () => {
    const sessions = buildOutreachSessionsPayload(['2026-07-22', '2026-07-23'], {
      '2026-07-22': { startTime: undefined, endTime: t('12:00'), peopleReached: null },
      '2026-07-23': { startTime: t('09:00'), endTime: undefined, peopleReached: null },
    });
    expect(sessions).toEqual([]);
  });

  it('produces correctly-computed starts_at/ends_at per date', () => {
    const sessions = buildOutreachSessionsPayload(['2026-07-22'], {
      '2026-07-22': { startTime: t('09:00'), endTime: t('12:00'), peopleReached: null },
    });
    expect(sessions).toEqual([
      {
        sessionDate: '2026-07-22',
        startsAt: '2026-07-22T14:00:00.000Z',
        endsAt: '2026-07-22T17:00:00.000Z',
        notes: '',
        peopleReached: null,
      },
    ]);
  });
});

// ---------------------------------------------------------------------------
// CMP-02 fixed flag resolution (module doc #2).
// ---------------------------------------------------------------------------

describe('resolveEventTypeFlags (CMP-02)', () => {
  it('outreach is always the fixed {false, true} pair, regardless of the competition toggles', () => {
    expect(
      resolveEventTypeFlags('outreach', { countsParticipation: true, countsVolunteerHours: true }),
    ).toEqual({ countsParticipation: false, countsVolunteerHours: true });
    expect(
      resolveEventTypeFlags('outreach', {
        countsParticipation: false,
        countsVolunteerHours: false,
      }),
    ).toEqual({ countsParticipation: false, countsVolunteerHours: true });
  });

  it('competition passes through whatever the (default-false) admin toggles currently hold', () => {
    expect(
      resolveEventTypeFlags('competition', {
        countsParticipation: false,
        countsVolunteerHours: false,
      }),
    ).toEqual({ countsParticipation: false, countsVolunteerHours: false });
    expect(
      resolveEventTypeFlags('competition', {
        countsParticipation: true,
        countsVolunteerHours: false,
      }),
    ).toEqual({ countsParticipation: true, countsVolunteerHours: false });
  });
});

describe('resolveTeamScope', () => {
  it('returns null (all teams) when every known team is selected', () => {
    expect(resolveTeamScope(['a', 'b'], ['a', 'b'])).toBeNull();
    expect(resolveTeamScope(['b', 'a'], ['a', 'b'])).toBeNull();
  });

  it('returns the explicit list when only a subset is selected', () => {
    expect(resolveTeamScope(['a'], ['a', 'b'])).toEqual(['a']);
  });
});

// ---------------------------------------------------------------------------
// T118 (UXP-02) -- "Expected attendees" roster pure functions.
// ---------------------------------------------------------------------------

const TEAM_A = { id: 'team-a', name: 'Alpha' };
const TEAM_B = { id: 'team-b', name: 'Beta' };
const ROSTER: readonly OutreachRosterStudent[] = [
  { id: 'student-1', name: 'Amara', teamId: 'team-a', isActive: true },
  { id: 'student-2', name: 'Beto', teamId: 'team-a', isActive: false }, // inactive -- excluded.
  { id: 'student-3', name: 'Cleo', teamId: 'team-b', isActive: true },
];

describe('groupActiveRosterByTeam (Known Context/Traps #4)', () => {
  it('groups active students by team, scoped to selected teams, in team order', () => {
    const groups = groupActiveRosterByTeam(ROSTER, [TEAM_A, TEAM_B], ['team-a', 'team-b']);
    expect(groups).toEqual([
      { team: TEAM_A, students: [ROSTER[0]] },
      { team: TEAM_B, students: [ROSTER[2]] },
    ]);
  });

  it('excludes inactive students', () => {
    const groups = groupActiveRosterByTeam(ROSTER, [TEAM_A], ['team-a']);
    expect(groups[0].students.map((s) => s.id)).toEqual(['student-1']);
  });

  it('skips a team with zero active students rather than rendering an empty group', () => {
    const rosterWithNoBeta: readonly OutreachRosterStudent[] = [
      { id: 'student-1', name: 'Amara', teamId: 'team-a', isActive: true },
    ];
    const groups = groupActiveRosterByTeam(
      rosterWithNoBeta,
      [TEAM_A, TEAM_B],
      ['team-a', 'team-b'],
    );
    expect(groups).toHaveLength(1);
    expect(groups[0].team).toEqual(TEAM_A);
  });

  it('omits a team entirely when it is not in the selected-teams scope', () => {
    const groups = groupActiveRosterByTeam(ROSTER, [TEAM_A, TEAM_B], ['team-a']);
    expect(groups).toHaveLength(1);
    expect(groups[0].team).toEqual(TEAM_A);
  });
});

describe('resolveExpectedAttendeeIds (Trap #2 sanitization)', () => {
  it('keeps only ids present in the currently-visible roster', () => {
    expect(resolveExpectedAttendeeIds(['student-1', 'student-3'], ['student-1'])).toEqual([
      'student-1',
    ]);
  });

  it('drops a hidden pick (e.g. a team-scope change hid that student)', () => {
    expect(resolveExpectedAttendeeIds(['student-1', 'student-9'], ['student-1'])).toEqual([
      'student-1',
    ]);
  });

  it('returns an empty array when nothing is checked', () => {
    expect(resolveExpectedAttendeeIds([], ['student-1'])).toEqual([]);
  });
});

describe('computeConfirmLabel (BEH-07 / Known Context/Traps #4)', () => {
  it('never renders a bare "Create event"/"Save changes"/"Submit"/"OK" -- always states the computed session count', () => {
    expect(computeConfirmLabel(false, 0)).toBe('Create event — 0 sessions');
    expect(computeConfirmLabel(false, 1)).toBe('Create event — 1 session');
    expect(computeConfirmLabel(false, 3)).toBe('Create event — 3 sessions');
    expect(computeConfirmLabel(true, 1)).toBe('Save changes — 1 session');
    expect(computeConfirmLabel(true, 5)).toBe('Save changes — 5 sessions');
  });
});

// ---------------------------------------------------------------------------
// <OutreachEventDialog /> -- field order (OUT-02 / constitution item 13).
// ---------------------------------------------------------------------------

describe('<OutreachEventDialog /> field order (OUT-02 / constitution item 13)', () => {
  it('renders top-level fields in the exact OUT-02 order for the default (single-mode, no date picked) state', () => {
    act(() => {
      root.render(<OutreachEventDialog isOpen onOpenChange={() => {}} />);
    });
    const labelTexts = Array.from(document.querySelectorAll('label'))
      .map((el) => el.textContent?.trim() ?? '')
      .filter((text) => text !== '');
    // "Schedule mode" (SegmentedControl) and "Repeat on" (CheckboxList, not
    // rendered in single mode anyway) are real group labels, not `<label>`
    // elements (module doc #10 / precedent established in
    // ScheduleMeetingsDialog.test.tsx), so they are correctly absent here.
    // No session-detail rows render yet (no date picked), matching module
    // doc #6. T118 (UXP-02) module doc 11b/11c -- the "Expected attendees"
    // checklist's own TEAM group headers ("Ravens"/"Titans") are real group
    // labels too (same `isGroupLabel` treatment), absent here for the same
    // reason -- but each individual roster row IS a real `<label htmlFor>`
    // (`CheckboxListItem` composes a real, only-visually-hidden
    // `CheckboxInput` label), so the default (all-teams-selected) fixture
    // roster's four student names appear between "Team scope" and "Share to
    // calendar feed".
    expect(labelTexts).toEqual([
      'Title ∙ Required',
      'Description ∙ Optional',
      'Location name',
      'Address',
      'Event type',
      'Date ∙ Required',
      'Adult volunteers',
      'Adult volunteer hours',
      'Team scope',
      'Riley Chen',
      'Jordan Blake',
      'Sam Okafor',
      'Casey Nguyen',
      'Share to calendar feed',
    ]);
  });

  it('inserts per-session Start/End/Expected-people-reached rows between schedule mode and adult volunteers once a date is picked', () => {
    act(() => {
      root.render(<OutreachEventDialog isOpen onOpenChange={() => {}} />);
    });
    const dateInput = getFieldControl('Date') as HTMLInputElement;
    act(() => {
      setNativeInputValue(dateInput, '2026-07-22');
    });

    const labelTexts = Array.from(document.querySelectorAll('label'))
      .map((el) => el.textContent?.trim() ?? '')
      .filter((text) => text !== '');
    const dateIndex = labelTexts.indexOf('Date ∙ Required');
    const adultVolunteersIndex = labelTexts.indexOf('Adult volunteers');
    expect(dateIndex).toBeGreaterThanOrEqual(0);
    expect(adultVolunteersIndex).toBeGreaterThan(dateIndex);
    expect(labelTexts.slice(dateIndex + 1, adultVolunteersIndex)).toEqual([
      'Start time (2026-07-22) ∙ Required',
      'End time (2026-07-22) ∙ Required',
      'Expected people reached (2026-07-22) ∙ Optional',
    ]);
  });
});

// ---------------------------------------------------------------------------
// THE CENTRAL SPEC TENSION + CMP-02 gating (module docs #1/#2).
// ---------------------------------------------------------------------------

describe('<OutreachEventDialog /> type Selector + CMP-02 flag gating (Known Context/Traps #1/#2)', () => {
  it('defaults to "outreach" and never shows the counts_participation/counts_volunteer_hours toggles for it', () => {
    act(() => {
      root.render(<OutreachEventDialog isOpen onOpenChange={() => {}} />);
    });
    expect(document.body.textContent).not.toContain('Counts toward participation %');
    expect(document.body.textContent).not.toContain('Counts toward volunteer hours');
  });

  it('the type Selector offers "Outreach" and "Competition" but never a "Meeting" option (module doc #1 resolution, grep-provable)', () => {
    act(() => {
      root.render(<OutreachEventDialog isOpen onOpenChange={() => {}} />);
    });
    const trigger = getFieldControl('Event type');
    clickButton(trigger);

    const optionTexts = Array.from(document.querySelectorAll('[role="option"]')).map((el) =>
      el.textContent?.trim(),
    );
    expect(optionTexts).toContain('Outreach');
    expect(optionTexts).toContain('Competition');
    expect(optionTexts).not.toContain('Meeting');
    expect(document.body.textContent).not.toContain('Meeting');
  });

  it('switching to "Competition" reveals both flag toggles, defaulting OFF (CMP-02)', () => {
    act(() => {
      root.render(<OutreachEventDialog isOpen onOpenChange={() => {}} />);
    });
    const trigger = getFieldControl('Event type');
    clickButton(trigger);
    const competitionOption = Array.from(document.querySelectorAll('[role="option"]')).find(
      (el) => el.textContent?.trim() === 'Competition',
    ) as HTMLElement;
    expect(competitionOption).toBeDefined();
    clickButton(competitionOption);

    const participationToggle = getFieldControl(
      'Counts toward participation %',
    ) as HTMLInputElement;
    const volunteerHoursToggle = getFieldControl(
      'Counts toward volunteer hours',
    ) as HTMLInputElement;
    expect(participationToggle.checked).toBe(false);
    expect(volunteerHoursToggle.checked).toBe(false);

    // Switching back to "Outreach" hides the toggles again (module doc #2 --
    // never shown as editable controls for the outreach type).
    clickButton(trigger);
    const outreachOption = Array.from(document.querySelectorAll('[role="option"]')).find(
      (el) => el.textContent?.trim() === 'Outreach',
    ) as HTMLElement;
    clickButton(outreachOption);
    expect(document.body.textContent).not.toContain('Counts toward participation %');
  });
});

// ---------------------------------------------------------------------------
// BEH-07 / disabled-enabled confirm button (Known Context/Traps #4/#5).
// ---------------------------------------------------------------------------

describe('<OutreachEventDialog /> disabled/enabled confirm button (Known Context/Traps #4/#5)', () => {
  it('Single mode: disabled with no date, genuinely non-interactive, then enables on a valid date', async () => {
    const onSaveEvent = vi.fn().mockResolvedValue(undefined);
    act(() => {
      root.render(<OutreachEventDialog isOpen onOpenChange={() => {}} onSaveEvent={onSaveEvent} />);
    });

    let confirmButton = findButtonByText('Create event — 0 sessions');
    expect(confirmButton).toBeDefined();
    expect(confirmButton?.disabled).toBe(true);

    // Genuinely non-interactive: dispatching a click on a natively-disabled
    // button must not invoke the handler.
    clickButton(confirmButton as HTMLButtonElement);
    await flushMicrotasks();
    expect(onSaveEvent).not.toHaveBeenCalled();

    const titleInput = getFieldControl('Title') as HTMLInputElement;
    act(() => {
      setNativeInputValue(titleInput, 'Community Food Bank Sort');
    });
    // Title alone (no dated session yet) is still not enough.
    expect(findButtonByText('Create event — 0 sessions')?.disabled).toBe(true);

    const dateInput = getFieldControl('Date') as HTMLInputElement;
    act(() => {
      setNativeInputValue(dateInput, '2026-07-22');
    });

    confirmButton = findButtonByText('Create event — 1 session');
    expect(confirmButton).toBeDefined();
    expect(confirmButton?.disabled).toBe(false);

    // Nothing persists until the button is actually clicked.
    expect(onSaveEvent).not.toHaveBeenCalled();
  });

  it('a picked date with no title stays disabled (title is independently required)', () => {
    act(() => {
      root.render(<OutreachEventDialog isOpen onOpenChange={() => {}} />);
    });
    const dateInput = getFieldControl('Date') as HTMLInputElement;
    act(() => {
      setNativeInputValue(dateInput, '2026-07-22');
    });
    expect(findButtonByText('Create event — 1 session')?.disabled).toBe(true);
  });

  it('Custom dates mode: disabled with zero picked dates, enables after adding one, count grows/shrinks as dates are added/removed', () => {
    act(() => {
      root.render(<OutreachEventDialog isOpen onOpenChange={() => {}} />);
    });
    const titleInput = getFieldControl('Title') as HTMLInputElement;
    act(() => {
      setNativeInputValue(titleInput, 'Riverside Park Cleanup');
    });
    clickButton(findButtonByText('Custom dates') as HTMLButtonElement);
    expect(findButtonByText('Create event — 0 sessions')?.disabled).toBe(true);

    const addDateInput = getFieldControl('Add a date') as HTMLInputElement;
    act(() => {
      setNativeInputValue(addDateInput, '2026-07-22');
    });
    clickButton(findButtonByText('Add date') as HTMLButtonElement);

    let confirmButton = findButtonByText('Create event — 1 session');
    expect(confirmButton).toBeDefined();
    expect(confirmButton?.disabled).toBe(false);

    act(() => {
      setNativeInputValue(addDateInput, '2026-07-29');
    });
    clickButton(findButtonByText('Add date') as HTMLButtonElement);

    confirmButton = findButtonByText('Create event — 2 sessions');
    expect(confirmButton).toBeDefined();
    expect(confirmButton?.disabled).toBe(false);

    clickButton(findButtonByText('Remove 2026-07-22') as HTMLButtonElement);
    confirmButton = findButtonByText('Create event — 1 session');
    expect(confirmButton).toBeDefined();
    expect(confirmButton?.disabled).toBe(false);

    clickButton(findButtonByText('Remove 2026-07-29') as HTMLButtonElement);
    expect(findButtonByText('Create event — 0 sessions')?.disabled).toBe(true);
  });

  it('Multi-day mode: three consecutive days via the real DateRangeInput popover produce 3 sessions', () => {
    act(() => {
      root.render(<OutreachEventDialog isOpen onOpenChange={() => {}} />);
    });
    const titleInput = getFieldControl('Title') as HTMLInputElement;
    act(() => {
      setNativeInputValue(titleInput, 'Weekend Build Session');
    });
    clickButton(findButtonByText('Multi-day') as HTMLButtonElement);
    expect(findButtonByText('Create event — 0 sessions')?.disabled).toBe(true);

    const rangeTrigger = getFieldControl('Date range') as HTMLButtonElement;
    clickButton(rangeTrigger);
    const presetButton = findButtonByText('Next 3 days');
    expect(presetButton).toBeDefined();
    clickButton(presetButton as HTMLButtonElement);

    const confirmButton = findButtonByText('Create event — 3 sessions');
    expect(confirmButton).toBeDefined();
    expect(confirmButton?.disabled).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Submit / cancel / reset behavior.
// ---------------------------------------------------------------------------

describe('<OutreachEventDialog /> submit + cancel behavior', () => {
  it('invokes onSaveEvent with the correct computed payload (new event) only when the confirm button is clicked', async () => {
    const onSaveEvent = vi.fn().mockResolvedValue(undefined);
    const onOpenChange = vi.fn();
    act(() => {
      root.render(
        <OutreachEventDialog isOpen onOpenChange={onOpenChange} onSaveEvent={onSaveEvent} />,
      );
    });

    const titleInput = getFieldControl('Title') as HTMLInputElement;
    act(() => {
      setNativeInputValue(titleInput, 'Community Food Bank Sort');
    });
    const dateInput = getFieldControl('Date') as HTMLInputElement;
    act(() => {
      setNativeInputValue(dateInput, '2026-07-22');
    });

    expect(onSaveEvent).not.toHaveBeenCalled();

    clickButton(findButtonByText('Create event — 1 session') as HTMLButtonElement);
    await flushMicrotasks();

    expect(onSaveEvent).toHaveBeenCalledTimes(1);
    const payload = onSaveEvent.mock.calls[0][0] as SaveOutreachEventPayload;
    expect(payload.event.id).toBeUndefined(); // new event, no id yet.
    expect(payload.event.title).toBe('Community Food Bank Sort');
    expect(payload.event.type).toBe('outreach');
    // CMP-02 fixed defaults for outreach.
    expect(payload.event.countsParticipation).toBe(false);
    expect(payload.event.countsVolunteerHours).toBe(true);
    expect(payload.event.teamIds).toBeNull(); // default team scope = all teams selected.
    expect(payload.event.shareToCalendarFeed).toBe(true); // "on by default" (OUT-02).
    expect(payload.sessions).toHaveLength(1);
    expect(payload.sessions[0].sessionDate).toBe('2026-07-22');
    expect(payload.sessions[0].notes).toBe(''); // Trap #3 resolution.
    expect(payload.sessions[0].startsAt).toBe('2026-07-22T14:00:00.000Z'); // 9:00 AM Chicago (CDT).

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('Cancel discards the form and never invokes onSaveEvent', () => {
    const onSaveEvent = vi.fn().mockResolvedValue(undefined);
    const onOpenChange = vi.fn();
    act(() => {
      root.render(
        <OutreachEventDialog isOpen onOpenChange={onOpenChange} onSaveEvent={onSaveEvent} />,
      );
    });
    const titleInput = getFieldControl('Title') as HTMLInputElement;
    act(() => {
      setNativeInputValue(titleInput, 'Community Food Bank Sort');
    });
    const dateInput = getFieldControl('Date') as HTMLInputElement;
    act(() => {
      setNativeInputValue(dateInput, '2026-07-22');
    });

    clickButton(findButtonByText('Cancel') as HTMLButtonElement);

    expect(onSaveEvent).not.toHaveBeenCalled();
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('resets to pristine defaults every time the dialog re-opens (nothing persists across opens)', () => {
    act(() => {
      root.render(<OutreachEventDialog isOpen onOpenChange={() => {}} />);
    });
    const dateInput = getFieldControl('Date') as HTMLInputElement;
    act(() => {
      setNativeInputValue(dateInput, '2026-07-22');
    });
    expect(findButtonByText('Create event — 1 session')).toBeDefined();

    act(() => {
      root.render(<OutreachEventDialog isOpen={false} onOpenChange={() => {}} />);
    });
    act(() => {
      root.render(<OutreachEventDialog isOpen onOpenChange={() => {}} />);
    });

    expect(findButtonByText('Create event — 0 sessions')).toBeDefined();
    expect(findButtonByText('Create event — 1 session')).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Edit mode (module doc #8 -- the "edit" half of "New/edit outreach event").
// ---------------------------------------------------------------------------

describe('<OutreachEventDialog /> edit mode (module doc #8)', () => {
  const EXISTING_EVENT: ExistingOutreachEvent = {
    id: 'event-food-bank-sort',
    title: 'Community Food Bank Sort',
    description: 'Sorting canned goods for the food bank.',
    locationName: 'Riverside Food Bank',
    address: '100 Riverside Dr',
    type: 'outreach',
    countsParticipation: false,
    countsVolunteerHours: true,
    teamIds: null,
    adultVolunteersCount: 2,
    adultVolunteerHours: 6,
    shareToCalendarFeed: true,
    sessions: [
      { sessionDate: '2026-08-02', startTime: '09:00', endTime: '12:00', peopleReached: 100 },
      { sessionDate: '2026-08-09', startTime: '09:00', endTime: '12:00', peopleReached: null },
    ],
  };

  it('pre-fills every field and shows a computed "Save changes" confirm label', () => {
    act(() => {
      root.render(
        <OutreachEventDialog isOpen onOpenChange={() => {}} initialEvent={EXISTING_EVENT} />,
      );
    });

    const titleInput = getFieldControl('Title') as HTMLInputElement;
    expect(titleInput.value).toBe('Community Food Bank Sort');
    const locationInput = getFieldControl('Location name') as HTMLInputElement;
    expect(locationInput.value).toBe('Riverside Food Bank');

    expect(document.body.textContent).toContain('Edit outreach event');
    expect(findButtonByText('Save changes — 2 sessions')).toBeDefined();
  });

  it('submitting in edit mode calls onSaveEvent with the existing event id and both sessions', async () => {
    const onSaveEvent = vi.fn().mockResolvedValue(undefined);
    act(() => {
      root.render(
        <OutreachEventDialog
          isOpen
          onOpenChange={() => {}}
          initialEvent={EXISTING_EVENT}
          onSaveEvent={onSaveEvent}
        />,
      );
    });

    clickButton(findButtonByText('Save changes — 2 sessions') as HTMLButtonElement);
    await flushMicrotasks();

    expect(onSaveEvent).toHaveBeenCalledTimes(1);
    const payload = onSaveEvent.mock.calls[0][0] as SaveOutreachEventPayload;
    expect(payload.event.id).toBe('event-food-bank-sort');
    expect(payload.sessions).toHaveLength(2);
    expect(payload.sessions.map((s) => s.sessionDate)).toEqual(['2026-08-02', '2026-08-09']);
    expect(payload.sessions[0].peopleReached).toBe(100);
    expect(payload.sessions[1].peopleReached).toBeNull();
  });

  it('T118 (module doc 11f) prefills the checklist from initialEvent.expectedStudentIds', () => {
    act(() => {
      root.render(
        <OutreachEventDialog
          isOpen
          onOpenChange={() => {}}
          initialEvent={{ ...EXISTING_EVENT, expectedStudentIds: ['student-ravens-1'] }}
        />,
      );
    });
    const checkbox = getFieldControl('Riley Chen') as HTMLInputElement;
    expect(checkbox.checked).toBe(true);
    const otherCheckbox = getFieldControl('Jordan Blake') as HTMLInputElement;
    expect(otherCheckbox.checked).toBe(false);
  });

  it('T118 (module doc 11f) prefills an empty checklist when initialEvent.expectedStudentIds is absent', () => {
    act(() => {
      root.render(
        <OutreachEventDialog isOpen onOpenChange={() => {}} initialEvent={EXISTING_EVENT} />,
      );
    });
    const checkbox = getFieldControl('Riley Chen') as HTMLInputElement;
    expect(checkbox.checked).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// T118 (UXP-02) -- "Expected attendees" checklist UI + submit payload.
// ---------------------------------------------------------------------------

describe('<OutreachEventDialog /> "Expected attendees" checklist (UXP-02)', () => {
  it('renders the default fixture roster grouped by team, scoped to the currently-selected teams', () => {
    act(() => {
      root.render(<OutreachEventDialog isOpen onOpenChange={() => {}} />);
    });
    expect(document.body.textContent).toContain('Riley Chen');
    expect(document.body.textContent).toContain('Jordan Blake');
    expect(document.body.textContent).toContain('Sam Okafor');
    expect(document.body.textContent).toContain('Casey Nguyen');
    expect(document.body.textContent).toContain('Expected attendees (0 of 4)');
  });

  it('checking a roster item updates the visible count', () => {
    act(() => {
      root.render(<OutreachEventDialog isOpen onOpenChange={() => {}} />);
    });
    clickButton(getFieldControl('Riley Chen'));
    expect(document.body.textContent).toContain('Expected attendees (1 of 4)');
  });

  it('"All" checks every currently-visible roster student; "Clear" unchecks all of them', () => {
    act(() => {
      root.render(<OutreachEventDialog isOpen onOpenChange={() => {}} />);
    });
    clickButton(findButtonByText('All') as HTMLButtonElement);
    expect(document.body.textContent).toContain('Expected attendees (4 of 4)');
    expect((getFieldControl('Riley Chen') as HTMLInputElement).checked).toBe(true);
    expect((getFieldControl('Casey Nguyen') as HTMLInputElement).checked).toBe(true);

    clickButton(findButtonByText('Clear') as HTMLButtonElement);
    expect(document.body.textContent).toContain('Expected attendees (0 of 4)');
    expect((getFieldControl('Riley Chen') as HTMLInputElement).checked).toBe(false);
  });

  it('submits expectedStudentIds (sanitized to the visible roster) and respondedBy on Create', async () => {
    const onSaveEvent = vi.fn().mockResolvedValue(undefined);
    act(() => {
      root.render(<OutreachEventDialog isOpen onOpenChange={() => {}} onSaveEvent={onSaveEvent} />);
    });
    const titleInput = getFieldControl('Title') as HTMLInputElement;
    act(() => {
      setNativeInputValue(titleInput, 'Community Food Bank Sort');
    });
    const dateInput = getFieldControl('Date') as HTMLInputElement;
    act(() => {
      setNativeInputValue(dateInput, '2026-07-22');
    });
    clickButton(getFieldControl('Riley Chen'));
    clickButton(getFieldControl('Sam Okafor'));

    clickButton(findButtonByText('Create event — 1 session') as HTMLButtonElement);
    await flushMicrotasks();

    const payload = onSaveEvent.mock.calls[0][0] as SaveOutreachEventPayload;
    expect(payload.expectedStudentIds).toEqual(['student-ravens-1', 'student-titans-1']);
    expect(payload.respondedBy).toBe(PLACEHOLDER_CURRENT_COACH_PROFILE_ID);
  });

  it('submits an empty expectedStudentIds array (not undefined) when nothing is checked', async () => {
    const onSaveEvent = vi.fn().mockResolvedValue(undefined);
    act(() => {
      root.render(<OutreachEventDialog isOpen onOpenChange={() => {}} onSaveEvent={onSaveEvent} />);
    });
    const titleInput = getFieldControl('Title') as HTMLInputElement;
    act(() => {
      setNativeInputValue(titleInput, 'Community Food Bank Sort');
    });
    const dateInput = getFieldControl('Date') as HTMLInputElement;
    act(() => {
      setNativeInputValue(dateInput, '2026-07-22');
    });
    clickButton(findButtonByText('Create event — 1 session') as HTMLButtonElement);
    await flushMicrotasks();

    const payload = onSaveEvent.mock.calls[0][0] as SaveOutreachEventPayload;
    expect(payload.expectedStudentIds).toEqual([]);
  });

  it('honors a custom currentUserProfileId prop as respondedBy', async () => {
    const onSaveEvent = vi.fn().mockResolvedValue(undefined);
    act(() => {
      root.render(
        <OutreachEventDialog
          isOpen
          onOpenChange={() => {}}
          onSaveEvent={onSaveEvent}
          currentUserProfileId="profile-coach-real"
        />,
      );
    });
    const titleInput = getFieldControl('Title') as HTMLInputElement;
    act(() => {
      setNativeInputValue(titleInput, 'X');
    });
    const dateInput = getFieldControl('Date') as HTMLInputElement;
    act(() => {
      setNativeInputValue(dateInput, '2026-07-22');
    });
    clickButton(findButtonByText('Create event — 1 session') as HTMLButtonElement);
    await flushMicrotasks();
    const payload = onSaveEvent.mock.calls[0][0] as SaveOutreachEventPayload;
    expect(payload.respondedBy).toBe('profile-coach-real');
  });

  it('scopes the visible roster to the currently-selected teams via the injectable students/teams props', () => {
    const teams = [
      { id: 'team-a', name: 'Alpha' },
      { id: 'team-b', name: 'Beta' },
    ];
    const students: readonly OutreachRosterStudent[] = [
      { id: 'student-a', name: 'Ann', teamId: 'team-a', isActive: true },
      { id: 'student-b', name: 'Bo', teamId: 'team-b', isActive: true },
    ];
    act(() => {
      root.render(
        <OutreachEventDialog isOpen onOpenChange={() => {}} teams={teams} students={students} />,
      );
    });
    // Default team scope = every team selected -- both visible.
    expect(document.body.textContent).toContain('Ann');
    expect(document.body.textContent).toContain('Bo');
  });
});

// ---------------------------------------------------------------------------
// T118 (UXP-02) Trap #2 -- `computeExpectedAttendeeRsvpPlan`
// (`../../lib/supabase/loaders/outreach.ts`), the pure reconciliation-math
// function, exercised directly with no fake Supabase client.
// ---------------------------------------------------------------------------

describe('computeExpectedAttendeeRsvpPlan (Trap #2 load-bearing rule)', () => {
  function rsvpRow(overrides: {
    id: string;
    sessionId: string;
    studentId: string;
    status?: 'going' | 'maybe' | 'declined';
    respondedBy: string | null;
  }) {
    return {
      id: overrides.id,
      session_id: overrides.sessionId,
      student_id: overrides.studentId,
      status: overrides.status ?? 'going',
      responded_by: overrides.respondedBy,
      updated_at: '2026-07-01T00:00:00.000Z',
      created_at: '2026-07-01T00:00:00.000Z',
    };
  }

  it('fans a checked student out to every final session id', () => {
    const plan = computeExpectedAttendeeRsvpPlan([], ['session-1', 'session-2'], ['student-1']);
    expect(plan.idsToDelete).toEqual([]);
    expect(plan.rowsToUpsert).toEqual([
      { sessionId: 'session-1', studentId: 'student-1' },
      { sessionId: 'session-2', studentId: 'student-1' },
    ]);
  });

  it('Trap #2, literal: unchecking a student deletes ONLY a staff-entered planned RSVP', () => {
    const existing = [
      rsvpRow({
        id: 'rsvp-staff',
        sessionId: 'session-1',
        studentId: 'student-staff-checked',
        respondedBy: 'profile-coach-1', // staff-entered (responded_by !== student_id).
      }),
    ];
    // student-staff-checked is no longer in the checked set -- unchecked.
    const plan = computeExpectedAttendeeRsvpPlan(existing, ['session-1'], []);
    expect(plan.idsToDelete).toEqual(['rsvp-staff']);
  });

  it('Trap #2, literal: unchecking a student NEVER deletes their own self-authored RSVP', () => {
    const existing = [
      rsvpRow({
        id: 'rsvp-self',
        sessionId: 'session-1',
        studentId: 'student-self-rsvpd',
        respondedBy: 'student-self-rsvpd', // self-authored: responded_by === student_id.
      }),
    ];
    // student-self-rsvpd is not in the checked set (unchecked/never checked).
    const plan = computeExpectedAttendeeRsvpPlan(existing, ['session-1'], []);
    expect(plan.idsToDelete).toEqual([]);
  });

  it('extended rule: re-checking a student never overwrites their own self-authored row', () => {
    const existing = [
      rsvpRow({
        id: 'rsvp-self',
        sessionId: 'session-1',
        studentId: 'student-self-rsvpd',
        respondedBy: 'student-self-rsvpd',
      }),
    ];
    // student-self-rsvpd IS checked in the UI -- still must not be upserted
    // (would overwrite responded_by from self to the coach).
    const plan = computeExpectedAttendeeRsvpPlan(existing, ['session-1'], ['student-self-rsvpd']);
    expect(plan.rowsToUpsert).toEqual([]);
    expect(plan.idsToDelete).toEqual([]);
  });

  it('does not delete a staff-entered row for a student who is still checked', () => {
    const existing = [
      rsvpRow({
        id: 'rsvp-staff',
        sessionId: 'session-1',
        studentId: 'student-staff-checked',
        respondedBy: 'profile-coach-1',
      }),
    ];
    const plan = computeExpectedAttendeeRsvpPlan(
      existing,
      ['session-1'],
      ['student-staff-checked'],
    );
    expect(plan.idsToDelete).toEqual([]);
    // Still fanned out (idempotent upsert) -- same acting coach or a
    // different one both simply overwrite the staff-entered row.
    expect(plan.rowsToUpsert).toEqual([
      { sessionId: 'session-1', studentId: 'student-staff-checked' },
    ]);
  });

  it('never deletes a non-"going" row (e.g. a declined RSVP) even if staff-entered and unchecked', () => {
    const existing = [
      rsvpRow({
        id: 'rsvp-declined',
        sessionId: 'session-1',
        studentId: 'student-declined',
        status: 'declined',
        respondedBy: 'profile-coach-1',
      }),
    ];
    const plan = computeExpectedAttendeeRsvpPlan(existing, ['session-1'], []);
    expect(plan.idsToDelete).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// T118 (UXP-02) module doc 7 -- loader-level tests for `makeSaveOutreachEvent`'s
// new RSVP fan-out phase. Same "inject a fake SupabaseClient chain" pattern
// `MarkDayCompleteDialog.test.tsx`'s own `makeMarkDayComplete` tests
// established.
// ---------------------------------------------------------------------------

describe('saveOutreachEvent (T118 RSVP fan-out phase)', () => {
  it('is entirely skipped (zero rsvps-table calls) when expectedStudentIds is undefined (back-compat)', async () => {
    const seasonMaybeSingleSpy = vi
      .fn()
      .mockResolvedValue({ data: { id: 'season-active-1' }, error: null });
    const eventSingleSpy = vi
      .fn()
      .mockResolvedValue({ data: { id: 'event-created-1' }, error: null });
    const eventInsertSpy = vi.fn(() => ({ select: vi.fn(() => ({ single: eventSingleSpy })) }));
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

    const save = makeSaveOutreachEvent(() => client);
    await save({
      event: {
        title: 'Food Bank Sort',
        description: '',
        locationName: 'X',
        address: '',
        type: 'outreach',
        countsParticipation: false,
        countsVolunteerHours: true,
        teamIds: null,
        adultVolunteersCount: 0,
        adultVolunteerHours: 0,
        shareToCalendarFeed: true,
      },
      sessions: [
        {
          sessionDate: '2026-08-01',
          startsAt: '2026-08-01T14:00:00.000Z',
          endsAt: '2026-08-01T16:00:00.000Z',
          notes: '',
          peopleReached: null,
        },
      ],
      // expectedStudentIds/respondedBy deliberately omitted.
    });

    expect(fromSpy).not.toHaveBeenCalledWith('rsvps');
  });

  it('CREATE: fans checked students out to every newly-created session as planned (going) RSVPs', async () => {
    const seasonMaybeSingleSpy = vi
      .fn()
      .mockResolvedValue({ data: { id: 'season-active-1' }, error: null });
    const eventSingleSpy = vi
      .fn()
      .mockResolvedValue({ data: { id: 'event-created-1' }, error: null });
    const eventInsertSpy = vi.fn(() => ({ select: vi.fn(() => ({ single: eventSingleSpy })) }));
    const sessionsInsertSpy = vi.fn().mockResolvedValue({ data: null, error: null });
    const existingSessionsEqSpy = vi.fn().mockResolvedValue({
      data: [
        { id: 'session-created-1', session_date: '2026-08-01' },
        { id: 'session-created-2', session_date: '2026-08-08' },
      ],
      error: null,
    });
    const rsvpsInSpy = vi.fn().mockResolvedValue({ data: [], error: null });
    const rsvpsUpsertSpy = vi.fn().mockResolvedValue({ data: null, error: null });

    const fromSpy = vi.fn((table: string) => {
      if (table === 'seasons') {
        return {
          select: vi.fn(() => ({ eq: vi.fn(() => ({ maybeSingle: seasonMaybeSingleSpy })) })),
        };
      }
      if (table === 'events') return { insert: eventInsertSpy };
      if (table === 'event_sessions') {
        return {
          insert: sessionsInsertSpy,
          select: vi.fn(() => ({ eq: existingSessionsEqSpy })),
        };
      }
      if (table === 'rsvps') {
        return { select: vi.fn(() => ({ in: rsvpsInSpy })), upsert: rsvpsUpsertSpy };
      }
      throw new Error(`unexpected table: ${table}`);
    });
    const client = { from: fromSpy } as unknown as SupabaseClient;

    const save = makeSaveOutreachEvent(() => client);
    await save({
      event: {
        title: 'Food Bank Sort',
        description: '',
        locationName: 'X',
        address: '',
        type: 'outreach',
        countsParticipation: false,
        countsVolunteerHours: true,
        teamIds: null,
        adultVolunteersCount: 0,
        adultVolunteerHours: 0,
        shareToCalendarFeed: true,
      },
      sessions: [
        {
          sessionDate: '2026-08-01',
          startsAt: '2026-08-01T14:00:00.000Z',
          endsAt: '2026-08-01T16:00:00.000Z',
          notes: '',
          peopleReached: null,
        },
        {
          sessionDate: '2026-08-08',
          startsAt: '2026-08-08T14:00:00.000Z',
          endsAt: '2026-08-08T16:00:00.000Z',
          notes: '',
          peopleReached: null,
        },
      ],
      expectedStudentIds: ['student-1'],
      respondedBy: 'profile-coach-1',
    });

    expect(rsvpsInSpy).toHaveBeenCalledWith('session_id', [
      'session-created-1',
      'session-created-2',
    ]);
    expect(rsvpsUpsertSpy).toHaveBeenCalledWith(
      [
        expect.objectContaining({
          session_id: 'session-created-1',
          student_id: 'student-1',
          status: 'going',
          responded_by: 'profile-coach-1',
        }),
        expect.objectContaining({
          session_id: 'session-created-2',
          student_id: 'student-1',
          status: 'going',
          responded_by: 'profile-coach-1',
        }),
      ],
      { onConflict: 'session_id,student_id' },
    );
  });

  it('EDIT: unchecking a student deletes only their staff-entered planned RSVP, never a self-authored one', async () => {
    const eventUpdateEqSpy = vi.fn().mockResolvedValue({ data: null, error: null });
    const eventUpdateSpy = vi.fn(() => ({ eq: eventUpdateEqSpy }));
    const existingSessionsEqSpy = vi.fn().mockResolvedValue({
      data: [{ id: 'session-existing-1', session_date: '2026-08-01' }],
      error: null,
    });
    const sessionUpdateEqSpy = vi.fn().mockResolvedValue({ data: null, error: null });
    const sessionUpdateSpy = vi.fn(() => ({ eq: sessionUpdateEqSpy }));
    const sessionsInsertSpy = vi.fn().mockResolvedValue({ data: null, error: null });
    const rsvpsInSpy = vi.fn().mockResolvedValue({
      data: [
        {
          id: 'rsvp-staff-entered',
          session_id: 'session-existing-1',
          student_id: 'student-unchecked-staff',
          status: 'going',
          responded_by: 'profile-coach-old',
          updated_at: '2026-07-01T00:00:00.000Z',
          created_at: '2026-07-01T00:00:00.000Z',
        },
        {
          id: 'rsvp-self-authored',
          session_id: 'session-existing-1',
          student_id: 'student-unchecked-self',
          status: 'going',
          responded_by: 'student-unchecked-self',
          updated_at: '2026-07-01T00:00:00.000Z',
          created_at: '2026-07-01T00:00:00.000Z',
        },
      ],
      error: null,
    });
    const rsvpsDeleteInSpy = vi.fn().mockResolvedValue({ data: null, error: null });
    const rsvpsDeleteSpy = vi.fn(() => ({ in: rsvpsDeleteInSpy }));
    const rsvpsUpsertSpy = vi.fn().mockResolvedValue({ data: null, error: null });

    const fromSpy = vi.fn((table: string) => {
      if (table === 'events') return { update: eventUpdateSpy };
      if (table === 'event_sessions') {
        return {
          select: vi.fn(() => ({ eq: existingSessionsEqSpy })),
          update: sessionUpdateSpy,
          insert: sessionsInsertSpy,
        };
      }
      if (table === 'rsvps') {
        return {
          select: vi.fn(() => ({ in: rsvpsInSpy })),
          delete: rsvpsDeleteSpy,
          upsert: rsvpsUpsertSpy,
        };
      }
      throw new Error(`unexpected table: ${table}`);
    });
    const client = { from: fromSpy } as unknown as SupabaseClient;

    const save = makeSaveOutreachEvent(() => client);
    await save({
      event: {
        id: 'event-existing-1',
        title: 'Food Bank Sort (updated)',
        description: '',
        locationName: 'X',
        address: '',
        type: 'outreach',
        countsParticipation: false,
        countsVolunteerHours: true,
        teamIds: null,
        adultVolunteersCount: 0,
        adultVolunteerHours: 0,
        shareToCalendarFeed: true,
      },
      sessions: [
        {
          sessionDate: '2026-08-01',
          startsAt: '2026-08-01T15:00:00.000Z',
          endsAt: '2026-08-01T17:00:00.000Z',
          notes: '',
          peopleReached: 50,
        },
      ],
      // Neither previously-RSVP'd student is checked anymore.
      expectedStudentIds: [],
      respondedBy: 'profile-coach-new',
    });

    // Only the staff-entered row is deleted -- the self-authored row's id
    // never appears.
    expect(rsvpsDeleteSpy).toHaveBeenCalledTimes(1);
    expect(rsvpsDeleteInSpy).toHaveBeenCalledWith('id', ['rsvp-staff-entered']);
    // Nothing to upsert (nothing checked).
    expect(rsvpsUpsertSpy).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// T118 (UXP-02) Known Context/Traps #4 -- `makeLoadOutreachEventRoster`,
// the ready-but-unwired roster loader that reuses `loaders/students.ts`.
// ---------------------------------------------------------------------------

describe('loadOutreachEventRoster (T118 Trap #4 -- reuses loaders/students.ts)', () => {
  it('filters to isActive students only and reshapes to OutreachRosterStudent', async () => {
    const studentsOrderSpy = vi.fn().mockResolvedValue({
      data: [
        {
          id: 'student-1',
          profile_id: null,
          display_name: 'Amara',
          team_id: 'team-ravens',
          grad_year: null,
          is_active: true,
          goal_hours_override: null,
          created_at: '2026-01-01T00:00:00.000Z',
        },
        {
          id: 'student-2',
          profile_id: null,
          display_name: 'Beto',
          team_id: 'team-ravens',
          grad_year: null,
          is_active: false,
          goal_hours_override: null,
          created_at: '2026-01-01T00:00:00.000Z',
        },
      ],
      error: null,
    });
    const fromSpy = vi.fn((table: string) => {
      if (table === 'students') return { select: vi.fn(() => ({ order: studentsOrderSpy })) };
      if (table === 'teams')
        return {
          select: vi.fn(() => ({ order: vi.fn().mockResolvedValue({ data: [], error: null }) })),
        };
      if (table === 'invites')
        return {
          select: vi.fn(() => ({ order: vi.fn().mockResolvedValue({ data: [], error: null }) })),
        };
      throw new Error(`unexpected table: ${table}`);
    });
    const client = { from: fromSpy } as unknown as SupabaseClient;

    const loadRoster = makeLoadOutreachEventRoster(() => client);
    const roster = await loadRoster();

    expect(roster).toEqual([
      { id: 'student-1', name: 'Amara', teamId: 'team-ravens', isActive: true },
    ]);
  });
});
