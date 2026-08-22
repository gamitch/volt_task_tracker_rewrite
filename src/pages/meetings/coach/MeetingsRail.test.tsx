// @vitest-environment jsdom
/**
 * Tests for `MeetingsRail.tsx` (GAM-449). No `@testing-library/react` is
 * installed in this repo -- these tests use the same raw `createRoot`/`act`
 * pattern `SeriesCard.test.tsx`/`CalendarPage.test.tsx` already established.
 *
 * Clock discipline (packet §4 preamble): every test pins the clock via
 * `vi.setSystemTime` at a mid-day UTC instant, so UTC-today and
 * Chicago-today agree and the suite cannot flake in the ~5-6h daily window
 * where they differ (precedent: `CalendarPage.test.tsx:19-25,328`). "Today"
 * throughout this file is `2026-08-17` (a Monday).
 *
 * Fixture shape: hand-built `CoachMeetingRow`/`CoachMeetingSessionDetail`
 * literals (the same style `SeriesCard.test.tsx`'s own `baseModel()` uses),
 * not `coachModel.ts`'s `FIXTURE_EVENTS`/`FIXTURE_SESSIONS` -- those are
 * dated July 2026 (in the past relative to this suite's pinned clock) and
 * this suite needs many independent, precisely-dated scenarios (overlap,
 * canceled, two series on one day, out-of-order input, a `focus`-named past
 * session) that are clearer to construct directly than to re-date a shared
 * fixture set around.
 */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  computeNavWindow,
  DEFAULT_AGENDA_DAY_COUNT,
  MeetingsRail,
  paletteIndexForEventId,
  type MeetingsRailProps,
} from './MeetingsRail';
import { formatTimeRangeWithDuration } from '../../../lib/meetings/format';
import type {
  CoachMeetingRow,
  CoachMeetingSessionDetail,
  MeetingsFocusRequest,
  OverlapIndex,
} from '../../../lib/meetings/types';

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
  vi.useRealTimers();
  vi.restoreAllMocks();
});

function renderRail(props: MeetingsRailProps): void {
  act(() => {
    root.render(<MeetingsRail {...props} />);
  });
}

function rerenderRail(props: MeetingsRailProps): void {
  act(() => {
    root.render(<MeetingsRail {...props} />);
  });
}

function click(el: Element): void {
  act(() => {
    el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
}

function buttonByAccessibleName(name: string): HTMLButtonElement | undefined {
  return Array.from(container.querySelectorAll('button')).find(
    (b) => b.getAttribute('aria-label') === name || b.textContent === name,
  );
}

function dayButton(dateIso: string): HTMLButtonElement | null {
  return container.querySelector(`button[data-date="${dateIso}"]`);
}

function agendaItemButtons(): HTMLButtonElement[] {
  return Array.from(container.querySelectorAll('.meetings-rail__agenda-item'));
}

/** Scopes agenda items to a single day heading -- needed because two
 * sessions at the same time-of-day on different dates render the SAME
 * accessible name (`formatTimeRangeWithDuration` formats time only, not
 * date), so a plain aria-label match can collide across days. */
function agendaItemsUnderHeading(headingText: string): HTMLButtonElement[] {
  const heading = Array.from(container.querySelectorAll('h3')).find(
    (h) => h.textContent === headingText,
  );
  expect(heading, `expected an h3 day heading reading "${headingText}"`).toBeTruthy();
  const dayBlock = heading?.parentElement;
  return Array.from(dayBlock?.querySelectorAll('.meetings-rail__agenda-item') ?? []);
}

// ---------------------------------------------------------------------------
// Fixture builders
// ---------------------------------------------------------------------------

/** August 2026 dates used throughout are CDT (UTC-5), matching
 * `coachModel.ts`'s own `FIXTURE_SESSIONS` comment convention
 * (`// 6:00 PM America/Chicago (UTC-5, DST)`). */
function chicagoInstant(dateIso: string, hour24: number, minute = 0): string {
  const [year, month, day] = dateIso.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day, hour24 + 5, minute)).toISOString();
}

function buildSession(
  sessionId: string,
  sessionDate: string,
  startHour: number,
  endHour: number,
  overrides: Partial<CoachMeetingSessionDetail> = {},
): CoachMeetingSessionDetail {
  return {
    sessionId,
    sessionDate,
    startsAt: chicagoInstant(sessionDate, startHour),
    endsAt: chicagoInstant(sessionDate, endHour),
    status: 'scheduled',
    durationHours: endHour - startHour,
    expectedCt: 4,
    attendanceSummary: null,
    attendeeNames: [],
    ...overrides,
  };
}

function buildRow(
  eventId: string,
  title: string,
  sessions: CoachMeetingSessionDetail[],
  overrides: Partial<CoachMeetingRow> = {},
): CoachMeetingRow {
  return {
    eventId,
    title,
    locationName: 'Robotics Lab',
    teamScopeLabel: 'All teams',
    sessions,
    ...overrides,
  };
}

const TODAY_ISO = '2026-08-17'; // Monday
const CLOCK_INSTANT = '2026-08-17T17:00:00.000Z'; // noon Chicago (CDT, UTC-5) -- mid-day UTC

function pinClock(): void {
  vi.setSystemTime(new Date(CLOCK_INSTANT));
}

/** Series A: Mon/Thu, deliberately listed out of chronological order --
 * criterion 3's "fixture supplies sessions deliberately out of order". Five
 * of its own dates land inside the default agenda window when combined with
 * series B/C below: 08-17 (today), 08-18, 08-20, 08-24, 08-27. */
function seriesA(): CoachMeetingRow {
  return buildRow('event-a', 'Weekly Build', [
    buildSession('a-0827', '2026-08-27', 18, 20),
    buildSession('a-0817', TODAY_ISO, 18, 20),
    buildSession('a-0831', '2026-08-31', 18, 20),
    buildSession('a-0820', '2026-08-20', 18, 20), // 6 PM -- later than series C's 5 PM same day
    buildSession('a-0824', '2026-08-24', 18, 20),
  ]);
}

/** Series B: one Tuesday session -- the default window's second day. */
function seriesB(): CoachMeetingRow {
  return buildRow('event-b', 'Ravens Strategy', [
    buildSession('b-0818', '2026-08-18', 17, 18, { expectedCt: 2 }),
  ]);
}

/** Series C: a second series sharing 08-20 with series A, starting earlier
 * (5 PM vs. A's 6 PM) -- criterion 3's "two series on one day" plus the
 * within-day `startsAt` ascending order. */
function seriesC(): CoachMeetingRow {
  return buildRow('event-c', 'Outreach Prep', [buildSession('c-0820', '2026-08-20', 17, 18)]);
}

/** Series D: a canceled session on the already-qualified 08-20 day --
 * criterion 7's Canceled badge, and criterion 5's "no agenda dot is ever
 * unlegended" (D has no scheduled session anywhere, so it is legended only
 * because this canceled session is in the visible agenda). */
function seriesD(): CoachMeetingRow {
  return buildRow('event-d', 'Retired Series', [
    buildSession('d-0820', '2026-08-20', 19, 20, { status: 'canceled' }),
  ]);
}

/** Series E: entirely in the past and entirely completed -- criterion 5's
 * "a fully completed/canceled series does not appear [in the legend]" half,
 * and (via `focus`) criterion 13's "day/month is the one shown". */
function seriesE(): CoachMeetingRow {
  return buildRow('event-e', 'Finished Series', [
    buildSession('e-0810', '2026-08-10', 18, 19, {
      status: 'completed',
      attendanceSummary: { presentCt: 3, lateCt: 0, excusedCt: 0, absentCt: 1 },
    }),
  ]);
}

function defaultRows(): CoachMeetingRow[] {
  return [seriesA(), seriesB(), seriesC(), seriesD(), seriesE()];
}

const EMPTY_OVERLAP_INDEX: OverlapIndex = new Map();

function noop(_request: MeetingsFocusRequest | null): void {
  void _request;
}

// ---------------------------------------------------------------------------
// 1. Focus emission, exact payload
// ---------------------------------------------------------------------------

describe('agenda item click -- focus emission (criterion 1)', () => {
  it('calls onFocusChange exactly once with { eventId, sessionId, monthKey } deep-equal, and only that', () => {
    pinClock();
    const onFocusChange = vi.fn();
    renderRail({
      rows: defaultRows(),
      overlapIndex: EMPTY_OVERLAP_INDEX,
      focus: null,
      onFocusChange,
    });

    const items = agendaItemButtons();
    expect(items.length).toBeGreaterThan(0);
    const todayItem = items.find((btn) =>
      btn.getAttribute('aria-label')?.startsWith('Weekly Build'),
    );
    expect(todayItem, 'expected the Weekly Build agenda item for today').toBeTruthy();

    click(todayItem!);

    expect(onFocusChange).toHaveBeenCalledTimes(1);
    expect(onFocusChange).toHaveBeenCalledWith({
      eventId: 'event-a',
      sessionId: 'a-0817',
      monthKey: '2026-08',
    });
  });
});

// ---------------------------------------------------------------------------
// 2. Season-bounded nav
// ---------------------------------------------------------------------------

describe('computeNavWindow (criterion 2)', () => {
  it('uses seasonStartsOn/seasonEndsOn when supplied, bounding whole months', () => {
    const window = computeNavWindow(defaultRows(), '2026-08-05', '2026-09-12');
    expect(window.min).toBe('2026-08-01');
    expect(window.max).toBe('2026-09-30');
  });

  it('falls back to the earliest/latest sessionDate across rows when absent', () => {
    const rows: CoachMeetingRow[] = [
      buildRow('event-x', 'X', [buildSession('x-1', '2026-08-05', 18, 19)]),
      buildRow('event-y', 'Y', [buildSession('y-1', '2026-10-22', 18, 19)]),
    ];
    const window = computeNavWindow(rows, undefined, undefined);
    expect(window.min).toBe('2026-08-01');
    expect(window.max).toBe('2026-10-31');
  });
});

describe('season-bounded nav -- DOM behavior (criterion 2)', () => {
  it('disables "Previous month" in the window\'s first month and "Next month" in its last month', () => {
    pinClock(); // today (2026-08-17) is inside a one-month window, so both hold at once
    renderRail({
      rows: defaultRows(),
      overlapIndex: EMPTY_OVERLAP_INDEX,
      focus: null,
      onFocusChange: noop,
      seasonStartsOn: '2026-08-01',
      seasonEndsOn: '2026-08-31',
    });

    const previous = buttonByAccessibleName('Previous month');
    const next = buttonByAccessibleName('Next month');
    expect(previous, 'expected a "Previous month" button').toBeTruthy();
    expect(next, 'expected a "Next month" button').toBeTruthy();
    expect(previous!.disabled).toBe(true);
    expect(next!.disabled).toBe(true);
    // §3d -- assert the native property, not the (null) aria-disabled attribute.
    expect(previous!.getAttribute('aria-disabled')).toBeNull();
    expect(next!.getAttribute('aria-disabled')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// 3. Agenda ordering
// ---------------------------------------------------------------------------

describe('agenda ordering (criterion 3)', () => {
  it('shows exactly DEFAULT_AGENDA_DAY_COUNT days ascending from Chicago-today, sorted by startsAt within a day', () => {
    pinClock();
    renderRail({
      rows: defaultRows(),
      overlapIndex: EMPTY_OVERLAP_INDEX,
      focus: null,
      onFocusChange: noop,
    });

    expect(DEFAULT_AGENDA_DAY_COUNT).toBe(5);
    const headings = Array.from(container.querySelectorAll('h3')).map((h) => h.textContent);
    expect(headings).toEqual(['Today 17', 'Tuesday 18', 'Thursday 20', 'Monday 24', 'Thursday 27']);
    // 2026-08-31 is the 6th meeting day -- excluded by the cap.
    expect(container.textContent).not.toContain('Monday 31');

    // Two series on 08-20 (criterion 3's "two series on one day"), ordered
    // ascending by startsAt: Outreach Prep (5 PM) before Weekly Build (6 PM).
    // Both are also canceled-badge-adjacent (Retired Series, 7 PM) -- three
    // items total under this one day heading.
    const thursdayItems = agendaItemsUnderHeading('Thursday 20');
    expect(thursdayItems).toHaveLength(3);
    const outreachIndex = thursdayItems.findIndex((b) =>
      b.getAttribute('aria-label')?.startsWith('Outreach Prep'),
    );
    const weeklyIndex = thursdayItems.findIndex((b) =>
      b.getAttribute('aria-label')?.startsWith('Weekly Build'),
    );
    expect(outreachIndex).toBeGreaterThanOrEqual(0);
    expect(weeklyIndex).toBeGreaterThan(outreachIndex);
  });
});

// ---------------------------------------------------------------------------
// 4. No grid marking, and no color in the grid
// ---------------------------------------------------------------------------

describe('no has-meeting marking, no color in the grid (criterion 4)', () => {
  it('every in-month day inside min/max is selectable, and no grid element carries a series color', () => {
    pinClock();
    renderRail({
      rows: defaultRows(),
      overlapIndex: EMPTY_OVERLAP_INDEX,
      focus: null,
      onFocusChange: noop,
      seasonStartsOn: '2026-08-01',
      seasonEndsOn: '2026-08-31',
    });

    // 2026-08-19 is a plain in-month Wednesday inside the window with no
    // session of its own -- outside days are unconditionally disabled
    // (`dayCellUtils.ts:58`), so an in-month day is the correct probe.
    const wednesday = dayButton('2026-08-19');
    expect(wednesday, 'expected an in-month day cell').toBeTruthy();
    expect(wednesday!.disabled).toBe(false);

    const grid = container.querySelector('.astryx-calendar');
    expect(grid, 'expected the Calendar grid to render').toBeTruthy();
    expect(grid!.querySelector('[data-series-palette-index]')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// 5. Legend
// ---------------------------------------------------------------------------

describe('legend (criterion 5)', () => {
  function legendTitles(): string[] {
    return Array.from(container.querySelectorAll('.meetings-rail__swatch')).map((swatch) => {
      const row = swatch.parentElement;
      return row?.textContent ?? '';
    });
  }

  it('includes a series with a scheduled session remaining, and excludes a fully finished one not in the visible agenda', () => {
    pinClock();
    renderRail({
      rows: defaultRows(),
      overlapIndex: EMPTY_OVERLAP_INDEX,
      focus: null,
      onFocusChange: noop,
    });

    const titles = legendTitles();
    expect(titles).toContain('Weekly Build');
    expect(titles).toContain('Ravens Strategy');
    expect(titles).toContain('Outreach Prep');
    // event-d ("Retired Series") has only a canceled session, but that
    // session IS in the default visible agenda (08-20) -- it must still be
    // legended (no agenda dot is ever unlegended).
    expect(titles).toContain('Retired Series');
    // event-e ("Finished Series") is entirely completed, entirely in the
    // past, and not in the default agenda window -- excluded.
    expect(titles).not.toContain('Finished Series');
  });

  it('includes a fully finished series once its own session enters the visible agenda via `focus`', () => {
    pinClock();
    renderRail({
      rows: defaultRows(),
      overlapIndex: EMPTY_OVERLAP_INDEX,
      focus: { eventId: 'event-e', sessionId: 'e-0810' },
      onFocusChange: noop,
    });

    expect(legendTitles()).toContain('Finished Series');
  });

  it('every swatch is accompanied by its title as text -- never color-only (criterion 11)', () => {
    pinClock();
    renderRail({
      rows: defaultRows(),
      overlapIndex: EMPTY_OVERLAP_INDEX,
      focus: null,
      onFocusChange: noop,
    });

    const swatches = container.querySelectorAll('.meetings-rail__swatch');
    expect(swatches.length).toBeGreaterThan(0);
    swatches.forEach((swatch) => {
      expect(swatch.getAttribute('aria-hidden')).toBe('true');
      expect((swatch.parentElement?.textContent ?? '').trim().length).toBeGreaterThan(0);
    });
  });
});

// ---------------------------------------------------------------------------
// 6. Day selection filters, and clears
// ---------------------------------------------------------------------------

describe('day selection filters and clears (criterion 6)', () => {
  it('narrows the agenda to the clicked day, and Clear restores the default view / emits onFocusChange(null) / drops data-selected', () => {
    pinClock();
    const onFocusChange = vi.fn();
    renderRail({
      rows: defaultRows(),
      overlapIndex: EMPTY_OVERLAP_INDEX,
      focus: null,
      onFocusChange,
    });

    expect(container.textContent).toContain('Today 17');
    expect(container.textContent).toContain('Thursday 20');

    click(dayButton('2026-08-20')!);

    expect(container.textContent).not.toContain('Today 17');
    expect(container.textContent).toContain('Thursday 20');
    // "Ravens Strategy" still appears in the (unaffected) legend -- scope the
    // negative assertion to agenda items, not the whole rail's text.
    expect(
      agendaItemButtons().some((b) => b.getAttribute('aria-label')?.startsWith('Ravens Strategy')),
    ).toBe(false);

    const clearButton = buttonByAccessibleName('Clear');
    expect(clearButton, 'expected a visible Clear control once a day is selected').toBeTruthy();

    click(clearButton!);

    expect(onFocusChange).toHaveBeenCalledWith(null);
    expect(container.textContent).toContain('Today 17');
    expect(container.textContent).toContain('Tuesday 18');

    const selectedDays = Array.from(container.querySelectorAll('button[data-date]')).filter(
      (b) => b.getAttribute('data-selected') !== null,
    );
    expect(selectedDays).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// 7. Overlap and canceled badges
// ---------------------------------------------------------------------------

describe('overlap and canceled badges (criterion 7)', () => {
  it('renders an overlap badge only for a session with a non-empty overlapIndex entry, and a Canceled badge for a canceled session', () => {
    pinClock();
    const overlapIndex: OverlapIndex = new Map([
      ['a-0820', [{ sessionId: 'c-0820', eventId: 'event-c' }]],
      ['c-0820', [{ sessionId: 'a-0820', eventId: 'event-a' }]],
    ]);
    renderRail({
      rows: defaultRows(),
      overlapIndex,
      focus: null,
      onFocusChange: noop,
    });

    // Today's (non-overlapping) Weekly Build item -- no overlap badge.
    const todayItems = agendaItemsUnderHeading('Today 17');
    const todayItem = todayItems.find((b) =>
      b.getAttribute('aria-label')?.startsWith('Weekly Build'),
    );
    expect(todayItem).toBeTruthy();
    expect(todayItem!.textContent).not.toContain('overlap');

    // Both 08-20 sessions overlap each other.
    const thursdayItems = agendaItemsUnderHeading('Thursday 20');
    const weeklyOn0820 = thursdayItems.find((b) =>
      b.getAttribute('aria-label')?.startsWith('Weekly Build'),
    );
    expect(weeklyOn0820, 'expected the 08-20 Weekly Build item').toBeTruthy();
    expect(weeklyOn0820!.textContent).toContain('1 overlap');

    const badgeEls = Array.from(weeklyOn0820!.querySelectorAll('.astryx-badge'));
    const overlapBadge = badgeEls.find((b) => b.textContent?.includes('overlap'));
    expect(overlapBadge?.getAttribute('data-variant')).toBe('neutral');
    expect(overlapBadge?.getAttribute('data-variant')).not.toBe('error');

    const canceledItem = thursdayItems.find((b) =>
      b.getAttribute('aria-label')?.startsWith('Retired Series'),
    );
    expect(canceledItem, 'expected the canceled Retired Series item on 08-20').toBeTruthy();
    expect(canceledItem!.textContent).toContain('Canceled');
    // The canceled item itself has no overlap entry in overlapIndex.
    expect(canceledItem!.textContent).not.toContain('overlap');
  });
});

// ---------------------------------------------------------------------------
// 8. Item content
// ---------------------------------------------------------------------------

describe('agenda item content (criterion 8)', () => {
  it('renders the formatted time range, the series title, and "{locationName} · {expectedCt} expected"', () => {
    pinClock();
    renderRail({
      rows: defaultRows(),
      overlapIndex: EMPTY_OVERLAP_INDEX,
      focus: null,
      onFocusChange: noop,
    });

    const items = agendaItemButtons();
    const todayItem = items.find((b) => b.getAttribute('aria-label')?.startsWith('Weekly Build'));
    expect(todayItem).toBeTruthy();
    const expectedTime = formatTimeRangeWithDuration(
      chicagoInstant(TODAY_ISO, 18),
      chicagoInstant(TODAY_ISO, 20),
    );
    expect(todayItem!.textContent).toContain(expectedTime);
    expect(todayItem!.textContent).toContain('Weekly Build');
    expect(todayItem!.textContent).toContain('Robotics Lab · 4 expected');
  });

  it('renders "attendance recorded" instead of the location/expected line when attendanceSummary is present', () => {
    pinClock();
    renderRail({
      rows: [seriesE()],
      overlapIndex: EMPTY_OVERLAP_INDEX,
      focus: { eventId: 'event-e', sessionId: 'e-0810' },
      onFocusChange: noop,
    });

    const items = agendaItemButtons();
    const finishedItem = items.find((b) =>
      b.getAttribute('aria-label')?.startsWith('Finished Series'),
    );
    expect(finishedItem).toBeTruthy();
    expect(finishedItem!.textContent).toContain('attendance recorded');
    expect(finishedItem!.textContent).not.toContain('expected');
  });
});

// ---------------------------------------------------------------------------
// 9. All four DES-12 states
// ---------------------------------------------------------------------------

describe('DES-12 four states (criterion 9)', () => {
  it('loading: aria-busy + role=status announcement, no populated content', () => {
    pinClock();
    renderRail({
      rows: [],
      overlapIndex: EMPTY_OVERLAP_INDEX,
      focus: null,
      onFocusChange: noop,
      isLoading: true,
    });

    expect(container.querySelectorAll('.astryx-skeleton').length).toBeGreaterThan(0);
    expect(container.querySelector('[role="status"]')).toBeTruthy();
    expect(container.querySelector('.astryx-calendar')).toBeNull();
    const root = container.firstElementChild;
    expect(root?.getAttribute('aria-busy')).toBe('true');
  });

  it('error: renders a Banner with the given errorMessage', () => {
    pinClock();
    renderRail({
      rows: [],
      overlapIndex: EMPTY_OVERLAP_INDEX,
      focus: null,
      onFocusChange: noop,
      errorMessage: 'Could not load meetings for this season.',
    });

    expect(container.querySelector('.astryx-banner')).toBeTruthy();
    expect(container.textContent).toContain('Could not load meetings for this season.');
    expect(container.querySelector('.astryx-calendar')).toBeNull();
  });

  it('empty: rows === [] renders an Astryx EmptyState, no Calendar, no agenda', () => {
    pinClock();
    renderRail({
      rows: [],
      overlapIndex: EMPTY_OVERLAP_INDEX,
      focus: null,
      onFocusChange: noop,
    });

    expect(container.querySelector('.astryx-empty-state')).toBeTruthy();
    expect(container.querySelector('.astryx-calendar')).toBeNull();
  });

  it('empty: rows present but every row has zero sessions also renders EmptyState', () => {
    pinClock();
    renderRail({
      rows: [buildRow('event-z', 'Zero Sessions', [])],
      overlapIndex: EMPTY_OVERLAP_INDEX,
      focus: null,
      onFocusChange: noop,
    });

    expect(container.querySelector('.astryx-empty-state')).toBeTruthy();
  });

  it('populated: renders the Calendar and the Agenda', () => {
    pinClock();
    renderRail({
      rows: defaultRows(),
      overlapIndex: EMPTY_OVERLAP_INDEX,
      focus: null,
      onFocusChange: noop,
    });

    expect(container.querySelector('.astryx-calendar')).toBeTruthy();
    expect(container.textContent).toContain('Agenda');
    expect(container.querySelector('.astryx-empty-state')).toBeNull();
    expect(container.querySelector('.astryx-banner')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// 10. No urgency mechanics (item 17)
// ---------------------------------------------------------------------------

describe('no urgency mechanics -- item 17 (criterion 10)', () => {
  it('day headings are plain BEH-08 labels, and advancing fake time drives no re-render/timer', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(CLOCK_INSTANT));
    renderRail({
      rows: defaultRows(),
      overlapIndex: EMPTY_OVERLAP_INDEX,
      focus: null,
      onFocusChange: noop,
    });

    expect(container.textContent).toContain('Today 17');
    expect(container.textContent).toContain('Tuesday 18');
    const before = container.textContent;
    expect(vi.getTimerCount()).toBe(0);

    act(() => {
      vi.advanceTimersByTime(10 * 24 * 60 * 60 * 1000);
    });

    expect(container.textContent).toBe(before);
    expect(vi.getTimerCount()).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// 11. Accessibility
// ---------------------------------------------------------------------------

describe('accessibility (criterion 11)', () => {
  it('agenda items are real <button> elements with an accessible name naming the series and its time, reachable and activatable via keyboard', () => {
    pinClock();
    const onFocusChange = vi.fn();
    renderRail({
      rows: defaultRows(),
      overlapIndex: EMPTY_OVERLAP_INDEX,
      focus: null,
      onFocusChange,
    });

    const items = agendaItemButtons();
    const todayItem = items.find((b) => b.getAttribute('aria-label')?.startsWith('Weekly Build'));
    expect(todayItem).toBeTruthy();
    expect(todayItem!.tagName).toBe('BUTTON');
    const expectedTime = formatTimeRangeWithDuration(
      chicagoInstant(TODAY_ISO, 18),
      chicagoInstant(TODAY_ISO, 20),
    );
    expect(todayItem!.getAttribute('aria-label')).toBe(`Weekly Build, ${expectedTime}`);

    act(() => {
      todayItem!.focus();
    });
    expect(document.activeElement).toBe(todayItem);

    act(() => {
      todayItem!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(onFocusChange).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// 12. No jargon in user-facing copy (UXC-10)
// ---------------------------------------------------------------------------

describe('no jargon in user-facing copy -- UXC-10 (criterion 12)', () => {
  const forbidden = ['GAM-', 'MeetingsFocusRequest', 'OverlapIndex', 'SeriesCardModel'];

  it('the populated, loading, error, and empty renders contain none of the forbidden substrings', () => {
    pinClock();

    renderRail({
      rows: defaultRows(),
      overlapIndex: EMPTY_OVERLAP_INDEX,
      focus: null,
      onFocusChange: noop,
    });
    forbidden.forEach((term) => expect(container.textContent).not.toContain(term));

    rerenderRail({
      rows: [],
      overlapIndex: EMPTY_OVERLAP_INDEX,
      focus: null,
      onFocusChange: noop,
      isLoading: true,
    });
    forbidden.forEach((term) => expect(container.textContent).not.toContain(term));

    rerenderRail({
      rows: [],
      overlapIndex: EMPTY_OVERLAP_INDEX,
      focus: null,
      onFocusChange: noop,
      errorMessage: 'Could not load meetings.',
    });
    forbidden.forEach((term) => expect(container.textContent).not.toContain(term));

    rerenderRail({
      rows: [],
      overlapIndex: EMPTY_OVERLAP_INDEX,
      focus: null,
      onFocusChange: noop,
    });
    forbidden.forEach((term) => expect(container.textContent).not.toContain(term));
  });
});

// ---------------------------------------------------------------------------
// 13. The frozen `focus` prop is exercised
// ---------------------------------------------------------------------------

describe('the frozen focus prop (criterion 13)', () => {
  it('marks the named agenda item aria-current and shows its day/month; focus: null marks nothing', () => {
    pinClock();
    renderRail({
      rows: defaultRows(),
      overlapIndex: EMPTY_OVERLAP_INDEX,
      focus: null,
      onFocusChange: noop,
    });

    expect(agendaItemButtons().some((b) => b.getAttribute('aria-current') === 'true')).toBe(false);

    rerenderRail({
      rows: defaultRows(),
      overlapIndex: EMPTY_OVERLAP_INDEX,
      focus: { eventId: 'event-e', sessionId: 'e-0810' },
      onFocusChange: noop,
    });

    const items = agendaItemButtons();
    const current = items.filter((b) => b.getAttribute('aria-current') === 'true');
    expect(current).toHaveLength(1);
    expect(current[0]?.getAttribute('aria-label')).toContain('Finished Series');
    // e-0810's own day (2026-08-10) is the one shown, not the default window.
    expect(container.textContent).toContain('Monday 10');
    expect(container.textContent).not.toContain('Today 17');
  });
});

// ---------------------------------------------------------------------------
// 14. The "Today" control
// ---------------------------------------------------------------------------

describe('the "Today" control (criterion 14)', () => {
  it('returns focusDate to Chicago-today and clears any day selection, dropping grid data-selected', () => {
    pinClock();
    renderRail({
      rows: defaultRows(),
      overlapIndex: EMPTY_OVERLAP_INDEX,
      focus: null,
      onFocusChange: noop,
    });

    click(dayButton('2026-08-20')!);
    expect(container.textContent).not.toContain('Today 17');

    const todayControl = buttonByAccessibleName('Today');
    expect(todayControl, 'expected a "Today" control').toBeTruthy();
    click(todayControl!);

    expect(container.textContent).toContain('Today 17');
    expect(container.textContent).toContain('Tuesday 18');

    const selectedDays = Array.from(container.querySelectorAll('button[data-date]')).filter(
      (b) => b.getAttribute('data-selected') !== null,
    );
    expect(selectedDays).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// paletteIndexForEventId -- hashed, deterministic, never array position
// (packet §3g)
// ---------------------------------------------------------------------------

describe('paletteIndexForEventId', () => {
  it('is deterministic for the same eventId, and stays within the 8-slot palette', () => {
    expect(paletteIndexForEventId('event-a')).toBe(paletteIndexForEventId('event-a'));
    const index = paletteIndexForEventId('event-a');
    expect(index).toBeGreaterThanOrEqual(1);
    expect(index).toBeLessThanOrEqual(8);
  });

  it('reaches the DOM on the legend swatch and the agenda dot, never inside the grid (criterion 4)', () => {
    pinClock();
    renderRail({
      rows: defaultRows(),
      overlapIndex: EMPTY_OVERLAP_INDEX,
      focus: null,
      onFocusChange: noop,
    });

    const swatch = container.querySelector('.meetings-rail__swatch[data-series-palette-index]');
    expect(swatch).toBeTruthy();
    const dot = container.querySelector('.meetings-rail__dot[data-series-palette-index]');
    expect(dot).toBeTruthy();
  });
});
