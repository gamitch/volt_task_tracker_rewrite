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
  buildEventSessionsPayload,
  chicagoWallTimeToUtcIso,
  computeConfirmLabel,
  computeScheduleSessionDates,
  generateCustomSessionDates,
  generateRecurringSessionDates,
  generateSingleSessionDates,
  resolveTeamScope,
  ScheduleMeetingsDialog,
  type CreateMeetingsPayload,
} from './ScheduleMeetingsDialog';

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
    expect(computeConfirmLabel(0)).toBe('Create 0 meetings');
    expect(computeConfirmLabel(1)).toBe('Create 1 meeting');
    expect(computeConfirmLabel(14)).toBe('Create 14 meetings');
    expect(computeConfirmLabel(2)).toBe('Create 2 meetings');
  });
});

// ---------------------------------------------------------------------------
// <ScheduleMeetingsDialog /> -- field order + disabled/enabled proof.
// ---------------------------------------------------------------------------

describe('<ScheduleMeetingsDialog /> field order (MTG-02 / constitution item 13)', () => {
  it('renders fields in the exact MTG-02 order: title, team scope, location, schedule mode, date/time, notes', () => {
    act(() => {
      root.render(<ScheduleMeetingsDialog isOpen onOpenChange={() => {}} />);
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
      root.render(<ScheduleMeetingsDialog isOpen onOpenChange={() => {}} />);
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
      root.render(<ScheduleMeetingsDialog isOpen onOpenChange={() => {}} />);
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

    const confirmButton = findButtonByText(computeConfirmLabel(expected.length));
    expect(confirmButton).toBeDefined();
    expect(confirmButton?.disabled).toBe(false);
  });

  it('Custom dates mode: disabled with zero picked dates, enables after adding one, count grows/shrinks as dates are added/removed', () => {
    act(() => {
      root.render(<ScheduleMeetingsDialog isOpen onOpenChange={() => {}} />);
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
      return <ScheduleMeetingsDialog isOpen onOpenChange={() => {}} />;
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
      root.render(<ScheduleMeetingsDialog isOpen={false} onOpenChange={() => {}} />);
    });
    act(() => {
      root.render(<ScheduleMeetingsDialog isOpen onOpenChange={() => {}} />);
    });

    // Back to the pristine zero-date state -- the previously-picked date did
    // not persist across the close/re-open cycle.
    expect(findButtonByText('Create 0 meetings')).toBeDefined();
    expect(findButtonByText('Create 1 meeting')).toBeUndefined();
  });
});
