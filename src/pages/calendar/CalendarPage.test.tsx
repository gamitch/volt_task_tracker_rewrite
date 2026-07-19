// @vitest-environment jsdom
/**
 * T045: tests for `CalendarPage.tsx`.
 *
 * Per this task's Allowed Files (`CalendarPage.tsx` + a colocated test file
 * "acceptable per established precedent") this test file is a deliberate,
 * disclosed addition -- the same class of addition `MeetingsList.test.tsx`
 * (T030) and `OutreachList.test.tsx` (T038) already made in their own
 * sibling directories, existing to produce the real DOM-text/attribute proof
 * this task's own packet requires in "Required Worker Output": filter
 * behavior, DES-04 color-mapping correctness per type, NAV-07's mixed-list
 * exception, month navigation genuinely re-scoping the list (Trap #1's
 * resolution), and NAV-08 click-through hrefs.
 *
 * No `@testing-library/react` is installed in this repo (confirmed via
 * `package.json`) -- these tests use the same raw `createRoot`/`act` pattern
 * `MeetingsList.test.tsx`/`OutreachList.test.tsx` already established.
 *
 * The real system clock in this environment happens to read 2026-07-19 (this
 * task's own "today"), which matches this file's fixture era -- but relying
 * on wall-clock time for a "today"-seeded default would make these tests
 * silently go stale the moment real time moves past July 2026. Every test
 * that exercises the default (unseeded) "today" behavior therefore pins the
 * clock explicitly via `vi.setSystemTime` rather than depending on whatever
 * the host's real clock happens to read.
 */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  buildEnrichedSessions,
  CALENDAR_FILTER_ITEMS,
  CalendarPage,
  defaultLoadCalendarSessions,
  filterByType,
  formatTimeRangeWithDuration,
  formatWeekdayDate,
  sessionsInMonth,
  sessionsOnDay,
  todayIsoChicago,
  type CalendarEventRow,
  type CalendarSessionRow,
} from './CalendarPage';

// ---------------------------------------------------------------------------
// Render harness -- mirrors MeetingsList.test.tsx's/OutreachList.test.tsx's
// own harness (no AuthProvider needed here -- this page has no role variant).
// ---------------------------------------------------------------------------

let container: HTMLDivElement;
let root: Root;

function renderPage(props: Parameters<typeof CalendarPage>[0] = {}): void {
  act(() => {
    root.render(
      <MemoryRouter initialEntries={['/calendar']}>
        <CalendarPage {...props} />
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
  vi.useRealTimers();
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// Pure functions
// ---------------------------------------------------------------------------

describe('buildEnrichedSessions / sessionsInMonth / sessionsOnDay', () => {
  const events: CalendarEventRow[] = [
    { id: 'e-meeting', seasonId: 's1', type: 'meeting', title: 'Build Night', locationName: 'HQ' },
    {
      id: 'e-outreach',
      seasonId: 's1',
      type: 'outreach',
      title: 'Food Drive',
      locationName: 'Bank',
    },
  ];
  const sessions: CalendarSessionRow[] = [
    {
      id: 'sess-1',
      eventId: 'e-meeting',
      sessionDate: '2026-07-14',
      startsAt: '2026-07-14T23:00:00.000Z',
      endsAt: '2026-07-15T01:00:00.000Z',
      status: 'scheduled',
    },
    {
      id: 'sess-2',
      eventId: 'e-outreach',
      sessionDate: '2026-08-01',
      startsAt: '2026-08-01T14:00:00.000Z',
      endsAt: '2026-08-01T17:00:00.000Z',
      status: 'scheduled',
    },
    {
      id: 'sess-orphan',
      eventId: 'e-does-not-exist',
      sessionDate: '2026-07-20',
      startsAt: '2026-07-20T14:00:00.000Z',
      endsAt: '2026-07-20T17:00:00.000Z',
      status: 'scheduled',
    },
  ];

  it('drops sessions whose event id does not resolve', () => {
    const enriched = buildEnrichedSessions(events, sessions);
    expect(enriched.map((e) => e.session.id).sort()).toEqual(['sess-1', 'sess-2']);
  });

  it('scopes to the given calendar month only', () => {
    const enriched = buildEnrichedSessions(events, sessions);
    expect(sessionsInMonth(enriched, 2026, 7).map((e) => e.session.id)).toEqual(['sess-1']);
    expect(sessionsInMonth(enriched, 2026, 8).map((e) => e.session.id)).toEqual(['sess-2']);
    expect(sessionsInMonth(enriched, 2026, 9)).toEqual([]);
  });

  it('scopes to a single day', () => {
    const enriched = buildEnrichedSessions(events, sessions);
    expect(sessionsOnDay(enriched, '2026-07-14').map((e) => e.session.id)).toEqual(['sess-1']);
    expect(sessionsOnDay(enriched, '2026-07-15')).toEqual([]);
  });
});

describe('filterByType (CAL-01 filter)', () => {
  const events: CalendarEventRow[] = [
    { id: 'e1', seasonId: 's1', type: 'meeting', title: 'Meeting A', locationName: 'X' },
    { id: 'e2', seasonId: 's1', type: 'outreach', title: 'Outreach A', locationName: 'Y' },
    { id: 'e3', seasonId: 's1', type: 'competition', title: 'Comp A', locationName: 'Z' },
  ];
  const sessions: CalendarSessionRow[] = events.map((event, i) => ({
    id: `sess-${i}`,
    eventId: event.id,
    sessionDate: '2026-07-15',
    startsAt: '2026-07-15T14:00:00.000Z',
    endsAt: '2026-07-15T16:00:00.000Z',
    status: 'scheduled',
  }));
  const enriched = buildEnrichedSessions(events, sessions);

  it('"all" keeps every type', () => {
    expect(filterByType(enriched, 'all')).toHaveLength(3);
  });

  it('narrows to exactly one type per filter value', () => {
    expect(filterByType(enriched, 'meeting').map((e) => e.event.type)).toEqual(['meeting']);
    expect(filterByType(enriched, 'outreach').map((e) => e.event.type)).toEqual(['outreach']);
    expect(filterByType(enriched, 'competition').map((e) => e.event.type)).toEqual(['competition']);
  });

  it('CAL-01: exactly the four options, "All" first', () => {
    expect(CALENDAR_FILTER_ITEMS.map((item) => item.label)).toEqual([
      'All',
      'Meetings',
      'Outreach',
      'Competitions',
    ]);
  });
});

describe('BEH-08 date/duration formatting', () => {
  it('formatWeekdayDate renders a weekday name', () => {
    expect(formatWeekdayDate('2026-07-25')).toBe('Sat, Jul 25');
  });

  it("formatTimeRangeWithDuration matches PRD line 237's own worked example shape", () => {
    expect(
      formatTimeRangeWithDuration('2026-07-22T23:00:00.000Z', '2026-07-23T01:00:00.000Z'),
    ).toBe('6:00–8:00 PM · 2h');
  });
});

describe('todayIsoChicago', () => {
  it('formats a pinned instant as YYYY-MM-DD in America/Chicago', () => {
    vi.setSystemTime(new Date('2026-07-19T04:00:00.000Z')); // 11:00 PM Jul 18 in Chicago (CDT, UTC-5)
    expect(todayIsoChicago()).toBe('2026-07-18');
  });
});

describe('the shipped fixture loader', () => {
  it('spans all three event types (Known Context/Traps #6)', async () => {
    const data = await defaultLoadCalendarSessions();
    const types = new Set(data.events.map((e) => e.type));
    expect(types).toEqual(new Set(['meeting', 'outreach', 'competition']));
  });
});

// ---------------------------------------------------------------------------
// DES-12 states
// ---------------------------------------------------------------------------

describe('DES-12 states', () => {
  beforeEach(() => {
    vi.setSystemTime(new Date('2026-07-19T12:00:00.000Z'));
  });

  it('loading state shows a Spinner', () => {
    renderPage({ loadSessions: () => new Promise(() => {}) });
    expect(container.textContent).toContain('Loading calendar');
  });

  it('error state shows an error Banner', async () => {
    renderPage({ loadSessions: () => Promise.reject(new Error('boom')) });
    await flushMicrotasks();
    expect(container.textContent).toContain("Couldn't load the calendar");
  });

  it('empty state shows EmptyState copy when zero sessions exist', async () => {
    renderPage({ loadSessions: () => Promise.resolve({ events: [], sessions: [] }) });
    await flushMicrotasks();
    expect(container.textContent).toContain('No sessions scheduled yet');
  });

  it('populated state renders the grid, legend, filter, and chronological list', async () => {
    renderPage();
    await flushMicrotasks();
    expect(container.textContent).toContain('Calendar');
    expect(container.querySelector('[role="grid"]')).toBeTruthy();
    expect(container.textContent).toContain('Weekly Build Meeting');
    expect(container.textContent).toContain('Community Food Bank Sort');
    expect(container.textContent).toContain('Regional Qualifier');
  });
});

// ---------------------------------------------------------------------------
// NAV-07 mixed-list exception + DES-04 color mapping
// ---------------------------------------------------------------------------

describe('NAV-07 mixed-list exception + DES-04 Badge color mapping', () => {
  beforeEach(() => {
    vi.setSystemTime(new Date('2026-07-19T12:00:00.000Z'));
  });

  it('default (unfiltered) July view mixes meeting/outreach/competition rows, each with a type Badge', async () => {
    renderPage();
    await flushMicrotasks();

    // July 2026 fixture sessions: 2 meeting, 1 outreach, 1 competition.
    const rows = Array.from(container.querySelectorAll('li'));
    expect(rows.length).toBeGreaterThanOrEqual(4);

    const badges = Array.from(container.querySelectorAll('.astryx-badge'));
    const variants = badges.map((b) => b.getAttribute('data-variant'));
    expect(variants).toContain('purple'); // Meeting Violet
    expect(variants).toContain('blue'); // Circuit Blue
    expect(variants).toContain('orange'); // Comp Orange
  });

  it('the legend renders the three DES-04 category Badges with the correct variants', async () => {
    renderPage();
    await flushMicrotasks();

    const legendBadges = Array.from(container.querySelectorAll('.astryx-badge')).filter((b) =>
      ['Meeting', 'Outreach', 'Competition'].includes(b.textContent ?? ''),
    );
    const byLabel = new Map(
      legendBadges.map((b) => [b.textContent, b.getAttribute('data-variant')]),
    );
    expect(byLabel.get('Meeting')).toBe('purple');
    expect(byLabel.get('Outreach')).toBe('blue');
    expect(byLabel.get('Competition')).toBe('orange');
  });

  it('never renders a hardcoded hex color anywhere in the markup (constitution item 2/13 concern)', async () => {
    renderPage();
    await flushMicrotasks();
    expect(container.innerHTML).not.toMatch(/#[0-9a-fA-F]{3,6}/);
  });
});

// ---------------------------------------------------------------------------
// Filter SegmentedControl behavior
// ---------------------------------------------------------------------------

describe('filter SegmentedControl (CAL-01)', () => {
  beforeEach(() => {
    vi.setSystemTime(new Date('2026-07-19T12:00:00.000Z'));
  });

  function clickSegment(label: string): void {
    const radiogroup = container.querySelector(
      '[role="radiogroup"][aria-label="Filter sessions by type"]',
    );
    expect(radiogroup).toBeTruthy();
    const buttons = Array.from(radiogroup!.querySelectorAll('button'));
    const target = buttons.find((b) => b.textContent === label);
    expect(target).toBeTruthy();
    act(() => {
      target!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
  }

  it('selecting "Meetings" hides Outreach/Competition rows and keeps only Meeting rows', async () => {
    renderPage();
    await flushMicrotasks();

    clickSegment('Meetings');

    expect(container.textContent).toContain('Weekly Build Meeting');
    expect(container.textContent).not.toContain('Community Food Bank Sort');
    expect(container.textContent).not.toContain('Regional Qualifier');
  });

  it('selecting "Outreach" keeps only Outreach rows', async () => {
    renderPage();
    await flushMicrotasks();

    clickSegment('Outreach');

    expect(container.textContent).not.toContain('Weekly Build Meeting');
    expect(container.textContent).toContain('Community Food Bank Sort');
    expect(container.textContent).not.toContain('Regional Qualifier');
  });

  it('selecting "Competitions" keeps only Competition rows', async () => {
    renderPage();
    await flushMicrotasks();

    clickSegment('Competitions');

    expect(container.textContent).not.toContain('Weekly Build Meeting');
    expect(container.textContent).not.toContain('Community Food Bank Sort');
    expect(container.textContent).toContain('Regional Qualifier');
  });
});

// ---------------------------------------------------------------------------
// Trap #1's resolution: Calendar drives month navigation; the list re-scopes.
// ---------------------------------------------------------------------------

describe('Calendar month navigation re-scopes the chronological list (Trap #1 resolution)', () => {
  beforeEach(() => {
    vi.setSystemTime(new Date('2026-07-19T12:00:00.000Z'));
  });

  it('July view shows exactly the four July fixture sessions, not the August-only one', async () => {
    renderPage();
    await flushMicrotasks();

    expect(container.textContent).toContain('Sessions in July 2026');
    expect(container.textContent).toContain('Weekly Build Meeting');
    // The fixture has TWO "Regional Qualifier" sessions (same event, one on
    // 2026-07-30, one on 2026-08-08) -- so checking the title alone can't
    // distinguish them. Assert the exact July row count (4) instead, which
    // only holds if the August-only session is excluded.
    const list = container.querySelector('ul, ol');
    const rows = list?.querySelectorAll('li') ?? [];
    expect(rows.length).toBe(4);
    expect(container.textContent).not.toContain('Sat, Aug 8'); // the August session's own date text
  });

  it('clicking "Next month" moves the grid to August and reveals the August competition session', async () => {
    renderPage();
    await flushMicrotasks();

    const nextButton = Array.from(container.querySelectorAll('button')).find(
      (b) => b.getAttribute('aria-label') === 'Next month',
    );
    expect(nextButton).toBeTruthy();
    act(() => {
      nextButton!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(container.textContent).toContain('Sessions in August 2026');
    expect(container.textContent).toContain('Regional Qualifier');
    expect(container.textContent).not.toContain('Weekly Build Meeting');
  });

  it('"Today" returns to the current month after navigating away', async () => {
    renderPage();
    await flushMicrotasks();

    const nextButton = Array.from(container.querySelectorAll('button')).find(
      (b) => b.getAttribute('aria-label') === 'Next month',
    );
    act(() => {
      nextButton!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(container.textContent).toContain('Sessions in August 2026');

    const todayButton = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent === 'Today',
    );
    expect(todayButton).toBeTruthy();
    act(() => {
      todayButton!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(container.textContent).toContain('Sessions in July 2026');
  });

  it('clicking a day with a session narrows the list to just that day, and "Show whole month" restores the month view', async () => {
    renderPage();
    await flushMicrotasks();

    const dayButton = container.querySelector('button[data-date="2026-07-22"]');
    expect(dayButton).toBeTruthy();
    act(() => {
      dayButton!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(container.textContent).toContain('Sessions on');
    expect(container.textContent).toContain('Weekly Build Meeting');
    expect(container.textContent).not.toContain('Community Food Bank Sort'); // different day

    const showWholeMonthButton = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent === 'Show whole month',
    );
    expect(showWholeMonthButton).toBeTruthy();
    act(() => {
      showWholeMonthButton!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(container.textContent).toContain('Sessions in July 2026');
    expect(container.textContent).toContain('Community Food Bank Sort');
  });
});

// ---------------------------------------------------------------------------
// Checker fix #1 (MAJOR): each row's `Link` visible/accessible text must be
// distinguishable per-row (not a repeated generic "View details" across a
// screen-reader links-list/rotor), per astryx-api.md's Link Best Practices
// ("describe the destination", never generic "click here"/"read more" text).
// ---------------------------------------------------------------------------

describe('row Link text is distinguishable per session (astryx-api.md Link Best Practices)', () => {
  beforeEach(() => {
    vi.setSystemTime(new Date('2026-07-19T12:00:00.000Z'));
  });

  it('two different rows render different link text/accessible names, each including the event title', async () => {
    renderPage();
    await flushMicrotasks();

    const links = Array.from(container.querySelectorAll('a'));

    const meetingLink = links.find(
      (a) => a.getAttribute('href') === '/meetings/session-build-upcoming',
    );
    const outreachLink = links.find(
      (a) => a.getAttribute('href') === '/outreach/event-food-bank-sort',
    );
    expect(meetingLink).toBeTruthy();
    expect(outreachLink).toBeTruthy();

    // Each link's own text distinguishes it by including its row's title.
    expect(meetingLink!.textContent).toContain('Weekly Build Meeting');
    expect(outreachLink!.textContent).toContain('Community Food Bank Sort');

    // No longer identical, undifferentiated "View details" text across rows.
    expect(meetingLink!.textContent).not.toBe(outreachLink!.textContent);
    expect(meetingLink!.textContent).not.toBe('View details');
    expect(outreachLink!.textContent).not.toBe('View details');
  });

  it('every rendered row link still communicates "View details" alongside its distinguishing title', async () => {
    renderPage();
    await flushMicrotasks();

    const links = Array.from(container.querySelectorAll('a')).filter((a) =>
      (a.getAttribute('href') ?? '').match(/^\/(meetings|outreach)\//),
    );
    expect(links.length).toBeGreaterThanOrEqual(4);
    for (const link of links) {
      expect(link.textContent).toContain('View details');
    }
  });
});

// ---------------------------------------------------------------------------
// Checker fix #2 (MINOR): the zero-sessions state's heading outline must not
// skip h2 (h1 "Calendar" -> h2 EmptyState, matching the populated-state
// branch's own h1 -> h2 -> h3 pattern).
// ---------------------------------------------------------------------------

describe('zero-sessions EmptyState heading outline has no skip', () => {
  beforeEach(() => {
    vi.setSystemTime(new Date('2026-07-19T12:00:00.000Z'));
  });

  it('renders h1 "Calendar" followed by an h2 EmptyState heading, never an h3', async () => {
    renderPage({ loadSessions: () => Promise.resolve({ events: [], sessions: [] }) });
    await flushMicrotasks();

    const h1 = container.querySelector('h1');
    expect(h1?.textContent).toBe('Calendar');

    const h2 = container.querySelector('h2');
    expect(h2?.textContent).toBe('No sessions scheduled yet');

    expect(container.querySelector('h3')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// NAV-08 click-through hrefs (CAL-02)
// ---------------------------------------------------------------------------

describe('NAV-08 click-through hrefs (CAL-02)', () => {
  beforeEach(() => {
    vi.setSystemTime(new Date('2026-07-19T12:00:00.000Z'));
  });

  it('a meeting row links to /meetings/:sessionId', async () => {
    renderPage();
    await flushMicrotasks();

    const links = Array.from(container.querySelectorAll('a'));
    const meetingLink = links.find(
      (a) => a.getAttribute('href') === '/meetings/session-build-upcoming',
    );
    expect(meetingLink).toBeTruthy();
  });

  it('an outreach row links to /outreach/:eventId', async () => {
    renderPage();
    await flushMicrotasks();

    const links = Array.from(container.querySelectorAll('a'));
    const outreachLink = links.find(
      (a) => a.getAttribute('href') === '/outreach/event-food-bank-sort',
    );
    expect(outreachLink).toBeTruthy();
  });

  it('a competition row also links through /outreach/:eventId (NAV-08: "outreach + competitions")', async () => {
    renderPage();
    await flushMicrotasks();

    const links = Array.from(container.querySelectorAll('a'));
    const competitionLink = links.find(
      (a) => a.getAttribute('href') === '/outreach/event-regional-qualifier',
    );
    expect(competitionLink).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// Constitution item 13 -- no box-drawing/bracket characters rendered.
// ---------------------------------------------------------------------------

describe('constitution item 13: no box-drawing/bracket characters', () => {
  beforeEach(() => {
    vi.setSystemTime(new Date('2026-07-19T12:00:00.000Z'));
  });

  it('renders no box-drawing characters or literal brackets in text content', async () => {
    renderPage();
    await flushMicrotasks();
    const text = container.textContent ?? '';
    expect(text).not.toMatch(/[┌┐└┘│─┬┴┼├┤━┃╔╗╚╝║═●]/);
    expect(text).not.toMatch(/[[\]]/);
  });
});
