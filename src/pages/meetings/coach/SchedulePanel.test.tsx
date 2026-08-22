// @vitest-environment jsdom
/**
 * Tests for `SchedulePanel.tsx` (GAM-448). No `@testing-library/react` is
 * installed in this repo -- these tests use the same raw `createRoot`/`act`
 * pattern `SeriesCard.test.tsx`/`CoachMeetingsView.test.tsx` already
 * established, plus `vi.useFakeTimers({ toFake: ['Date'] })` for the
 * Chicago-default-month tests, the same idiom
 * `CoachMeetingsView.test.tsx:733-741` already uses.
 */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SchedulePanel, type SchedulePanelProps, type SessionRosterEntry } from './SchedulePanel';
import schedulePanelSource from './SchedulePanel.tsx?raw';
import type { CoachMeetingSessionDetail } from '../../../lib/meetings/types';

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
  vi.useRealTimers();
});

function renderPanel(props: SchedulePanelProps): void {
  act(() => {
    root.render(<SchedulePanel {...props} />);
  });
}

function rerenderPanel(props: SchedulePanelProps): void {
  renderPanel(props);
}

function session(overrides: Partial<CoachMeetingSessionDetail> = {}): CoachMeetingSessionDetail {
  return {
    sessionId: `session-${Math.random().toString(36).slice(2)}`,
    sessionDate: '2026-10-01',
    startsAt: '2026-10-01T21:00:00.000Z',
    endsAt: '2026-10-01T23:00:00.000Z',
    status: 'scheduled',
    durationHours: 2,
    expectedCt: 0,
    attendanceSummary: null,
    attendeeNames: [],
    ...overrides,
  };
}

function activeTabValue(): string | null {
  const activeTab = container.querySelector('[data-tab-value][aria-current="page"]');
  return activeTab?.getAttribute('data-tab-value') ?? null;
}

function clickTab(monthKey: string): void {
  const tab = container.querySelector(`[data-tab-value="${monthKey}"]`) as HTMLButtonElement | null;
  expect(tab, `expected a tab for ${monthKey}`).toBeTruthy();
  act(() => {
    tab?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
}

// ---------------------------------------------------------------------------
// Criterion 1 -- default month is the current Chicago month.
// ---------------------------------------------------------------------------

describe('default month tab (criterion 1)', () => {
  it('selects the Chicago month even when a fake UTC clock reads the PREVIOUS day in Chicago', () => {
    // 2026-10-01T02:00:00Z is 2026-09-30 21:00 in Chicago (CDT, UTC-5) --
    // the UTC date is the 1st, the Chicago date is the 30th, a different
    // month only at a month boundary. Use a date where the UTC day is the
    // 1st of a month and the Chicago day is the last day of the PREVIOUS
    // month, so a UTC-month default would visibly disagree with a
    // Chicago-month default.
    vi.useFakeTimers({ toFake: ['Date'], now: new Date('2026-10-01T02:00:00.000Z') });
    renderPanel({
      eventId: 'event-1',
      sessions: [
        session({ sessionId: 's-sep', sessionDate: '2026-09-15' }),
        session({ sessionId: 's-oct', sessionDate: '2026-10-15' }),
      ],
    });
    // The real wall-clock instant is UTC Oct 1, but Chicago's own calendar
    // date at that instant is still September -- so the Chicago-correct
    // default tab is 2026-09, not 2026-10.
    expect(activeTabValue()).toBe('2026-09');
  });

  it('falls back to the nearest month that has sessions when the current Chicago month has none', () => {
    vi.useFakeTimers({ toFake: ['Date'], now: new Date('2026-06-15T12:00:00.000Z') }); // June -- no session
    renderPanel({
      eventId: 'event-1',
      sessions: [
        session({ sessionId: 's-mar', sessionDate: '2026-03-01' }),
        session({ sessionId: 's-aug', sessionDate: '2026-08-01' }),
      ],
    });
    // June is 3 months from March and 2 months from August -- August is nearer.
    expect(activeTabValue()).toBe('2026-08');
  });
});

// ---------------------------------------------------------------------------
// Criterion 2 -- bucketed by the stored session date, never the UTC instant.
// ---------------------------------------------------------------------------

describe('month bucketing (criterion 2)', () => {
  it('a session stored at 11 PM Chicago buckets into its Chicago month, not the UTC one', () => {
    // 11 PM Chicago on 2026-01-31 (CST, UTC-6) is 2026-02-01T05:00:00Z --
    // the NEXT day in UTC, and (critically) the next MONTH.
    const lateSession = session({
      sessionId: 's-late',
      sessionDate: '2026-01-31',
      startsAt: '2026-02-01T05:00:00.000Z',
      endsAt: '2026-02-01T06:00:00.000Z',
    });
    renderPanel({
      eventId: 'event-1',
      sessions: [lateSession],
      selectedMonthKey: '2026-01',
    });
    expect(container.textContent).toContain('Sat, Jan 31');

    // Selecting February (the UTC-instant month) shows nothing -- the
    // session lives in January's bucket.
    rerenderPanel({
      eventId: 'event-1',
      sessions: [lateSession],
      selectedMonthKey: '2026-02',
    });
    expect(container.textContent).not.toContain('Sat, Jan 31');
    expect(container.querySelector('.astryx-empty-state')).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// Month tabs -- one per month, switching, onMonthChange.
// ---------------------------------------------------------------------------

describe('month tabs', () => {
  it('renders one tab per distinct month in the series own window', () => {
    renderPanel({
      eventId: 'event-1',
      sessions: [
        session({ sessionId: 's1', sessionDate: '2026-03-05' }),
        session({ sessionId: 's2', sessionDate: '2026-03-19' }),
        session({ sessionId: 's3', sessionDate: '2026-04-02' }),
      ],
      selectedMonthKey: '2026-03',
    });
    const tabs = Array.from(container.querySelectorAll('[data-tab-value]'));
    expect(tabs.map((t) => t.getAttribute('data-tab-value'))).toEqual(['2026-03', '2026-04']);
  });

  it('clicking a different month tab calls onMonthChange with that key', () => {
    const onMonthChange = vi.fn();
    renderPanel({
      eventId: 'event-1',
      sessions: [
        session({ sessionId: 's1', sessionDate: '2026-03-05' }),
        session({ sessionId: 's2', sessionDate: '2026-04-02' }),
      ],
      selectedMonthKey: '2026-03',
      onMonthChange,
    });
    clickTab('2026-04');
    expect(onMonthChange).toHaveBeenCalledTimes(1);
    expect(onMonthChange).toHaveBeenCalledWith('2026-04');
  });

  it('renders an EmptyState with no sessions at all', () => {
    renderPanel({ eventId: 'event-1', sessions: [] });
    expect(container.querySelector('.astryx-empty-state')).toBeTruthy();
    expect(container.querySelector('[data-tab-value]')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// focusRequest -- opens the requested tab and expands the requested session.
// ---------------------------------------------------------------------------

describe('focusRequest', () => {
  it('opens the requested monthKey tab and expands the requested sessionId when eventId matches', () => {
    // Uncontrolled (no `selectedMonthKey`) -- a fully controlled panel with
    // no `onMonthChange` listener has nowhere for the request to land, which
    // this describe block's own second test covers as a documented
    // no-caller-yet limitation, not a bug (packet §0a).
    renderPanel({
      eventId: 'event-1',
      sessions: [
        session({ sessionId: 's-march', sessionDate: '2026-03-05', status: 'canceled' }),
        session({ sessionId: 's-april', sessionDate: '2026-04-02', status: 'canceled' }),
      ],
      focusRequest: { eventId: 'event-1', monthKey: '2026-04', sessionId: 's-april' },
    });
    expect(activeTabValue()).toBe('2026-04');
    expect(container.textContent).toContain('Canceled — no attendance recorded.');
  });

  it('does nothing when focusRequest targets a different eventId', () => {
    renderPanel({
      eventId: 'event-1',
      sessions: [session({ sessionId: 's-march', sessionDate: '2026-03-05', status: 'canceled' })],
      selectedMonthKey: '2026-03',
      focusRequest: { eventId: 'event-OTHER', monthKey: '2026-03', sessionId: 's-march' },
    });
    expect(container.textContent).not.toContain('Canceled — no attendance recorded.');
  });
});

// ---------------------------------------------------------------------------
// Criterion 21 -- roster rows render from the injected roster prop.
// ---------------------------------------------------------------------------

describe('roster prop wiring (criterion 21, item 27 source criterion)', () => {
  it('renders roster rows sourced from the injected roster Map, keyed by sessionId', () => {
    const roster = new Map<string, readonly SessionRosterEntry[]>([
      [
        's-completed',
        [
          { studentId: 'stu-1', displayName: 'Ada L.', status: 'present' },
          { studentId: 'stu-2', displayName: 'Ben K.', status: null },
        ],
      ],
    ]);
    renderPanel({
      eventId: 'event-1',
      sessions: [
        session({ sessionId: 's-completed', sessionDate: '2026-03-05', status: 'completed' }),
      ],
      selectedMonthKey: '2026-03',
      roster,
    });
    // Expand the row to reach the roster region.
    const expandButton = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === 'Expand',
    );
    expect(expandButton).toBeTruthy();
    act(() => {
      expandButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(container.querySelector('[data-testid="roster-row-stu-1"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="roster-row-stu-2"]')).toBeTruthy();
    expect(container.textContent).toContain('Ada L.');
    expect(container.textContent).toContain('Ben K.');
  });

  it('a session with no entry in the roster Map gets no roster (undefined, not a crash)', () => {
    renderPanel({
      eventId: 'event-1',
      sessions: [
        session({ sessionId: 's-completed', sessionDate: '2026-03-05', status: 'completed' }),
      ],
      selectedMonthKey: '2026-03',
      roster: new Map(),
    });
    expect(() => {
      const expandButton = Array.from(container.querySelectorAll('button')).find(
        (b) => b.textContent?.trim() === 'Expand',
      );
      act(() => {
        expandButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      });
    }).not.toThrow();
    expect(container.querySelector('.astryx-empty-state')).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// Criteria 13/14 -- grep-provable: no mutation code, no wrong write seam.
// ---------------------------------------------------------------------------

describe('no direct mutation code', () => {
  it('never names the wrong write seam (§0e) and never calls a Supabase mutation directly', () => {
    const source = schedulePanelSource;
    expect(source).not.toContain('makeOnEditAttendance');
    expect(source).not.toContain('.from(');
    expect(source).not.toContain('.upsert(');
    expect(source).not.toContain('.update(');
    expect(source).not.toContain('.insert(');
    expect(source).not.toContain('.delete(');
    expect(source).not.toContain('getSupabaseClient');
  });
});
