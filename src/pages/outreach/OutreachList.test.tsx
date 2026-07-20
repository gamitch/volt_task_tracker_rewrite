// @vitest-environment jsdom
/**
 * T038: tests for `OutreachList.tsx`. T101 (ED-1 Packet P10) extends this
 * file with real-load/real-create-dialog coverage (module doc #11 of the
 * component file). T106 (HOTFIX) extends it again with `useActiveSeason()`
 * wiring coverage (module doc #12 of the component file).
 *
 * Per this task's Allowed Files (`OutreachList.tsx` only) this test file is
 * a deliberate, disclosed addition beyond the literal Allowed Files list --
 * the same class of addition `CheckinResult.test.tsx` (T035) and
 * `MeetingsList.test.tsx` (T030) already made in their own sibling
 * directories, existing only to produce the DOM-text proof this task's own
 * packet requires in "Required Worker Output" (both role variants across
 * all four DES-12 states, NAV-07 filtering, BEH-01 milestone-toast dedupe,
 * BEH-02 confirmed/planned never-summed, the exported unanswered-RSVP
 * count).
 *
 * No `@testing-library/react` is installed in this repo (confirmed via
 * `package.json`) -- these tests use the same raw `createRoot`/`act`
 * pattern `CheckinResult.test.tsx`/`MeetingsList.test.tsx` already
 * established, including `MeetingsList.test.tsx`'s `AuthProvider` +
 * `LoginAs` role-login harness.
 *
 * T106 UPDATE: `OutreachList` now calls `useActiveSeason()` unconditionally
 * (component module doc #12), so every render below must be wrapped in a
 * real `<SeasonProvider>` -- the same fake-`<SeasonProvider>`-wrapping
 * harness update `ReportsShell.test.tsx` already made for its own identical
 * T091 wiring (`src/test-utils/**` is a forbidden/read-only directory for
 * this hotfix too, so this wiring is defined locally here, same posture).
 * `DEFAULT_READY_SEASON`'s `id` intentionally reuses the exact
 * `'season-placeholder-current'` literal `defaultLoadOutreachData`'s own
 * fixture data (`FIXTURE_EVENTS`/`FIXTURE_GOAL_CONFIG`) is keyed to, so every
 * pre-existing assertion below that renders fixture data keeps passing
 * unchanged when no test overrides the resolved season id explicitly.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthProvider, type AuthUser } from '../../app/guards';
import { SeasonProvider, type LoadActiveSeasonFn } from '../../app/SeasonProvider';
import type { SeasonRow } from '../../lib/supabase/types';
import { makeLoadOutreachData, makeSaveOutreachEvent } from '../../lib/supabase/loaders/outreach';
import { LoginAs } from '../../test-utils/authHarness';

// ---------------------------------------------------------------------------
// jsdom gap: `Dialog` renders a native `<dialog>` and calls
// `HTMLDialogElement.prototype.showModal()`, which this repo's installed
// jsdom does not implement -- same gap `MeetingsList.test.tsx` (T096)
// already hit and locally polyfilled; this is the first time THIS file
// renders a real `Dialog` (`OutreachEventDialog`, T101), so the same local
// override is needed here too.
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
import {
  OutreachList,
  buildUpcomingPast,
  computeGroupHours,
  computeStudentHours,
  confirmedPercent,
  crossedMilestones,
  defaultLoadOutreachData,
  filterOutreachEvents,
  formatSessionDateOnly,
  formatSessionDateTime,
  getUnansweredRsvpCount,
  hasMilestoneToastFired,
  markMilestoneToastFired,
  PLACEHOLDER_CURRENT_STUDENT_ID,
  sessionHours,
  sumIndividualGoals,
  withRsvpOverride,
  type OutreachEventRow,
  type OutreachGoalConfig,
  type OutreachLoadResult,
  type OutreachSessionRow,
  type RsvpRow,
} from './OutreachList';

// ---------------------------------------------------------------------------
// Render harness -- mirrors MeetingsList.test.tsx's own harness exactly.
// ---------------------------------------------------------------------------

let container: HTMLDivElement;
let root: Root;

const COACH_USER: AuthUser = { id: 'user-coach', email: 'coach@example.com', role: 'coach' };
// T073a: guards.tsx's `Role` union now includes 'student'/'parent'
// (previously it did not -- module doc #6 gap, resolved). 'student' stands
// in for "not coach/admin" here, exactly the branch OutreachList's own
// `isCoachOrAdminView` check falls through on for any non-coach/admin role.
// Previously `role: 'staff'`, invalid under the corrected `Role` type.
const STUDENT_OR_PARENT_USER: AuthUser = {
  id: 'user-student',
  email: 'student@example.com',
  role: 'student',
};

// T106 (component module doc #12): `OutreachList` now calls
// `useActiveSeason()` unconditionally, so every render needs a real
// `<SeasonProvider>` ancestor. `id` reuses `defaultLoadOutreachData`'s own
// fixture `seasonId` literal (module doc above) so existing fixture-data
// assertions keep passing unchanged by default.
const DEFAULT_READY_SEASON: SeasonRow = {
  id: 'season-placeholder-current',
  name: 'Fixture Season',
  startsOn: '2025-08-01',
  endsOn: '2026-06-30',
  defaultGoalHours: 100,
  isActive: true,
  createdAt: '2025-08-01T00:00:00.000Z',
};

const DEFAULT_LOAD_ACTIVE_SEASON: LoadActiveSeasonFn = async () => DEFAULT_READY_SEASON;

function renderAsUser(
  user: AuthUser | null,
  props: Parameters<typeof OutreachList>[0] = {},
  loadActiveSeason: LoadActiveSeasonFn = DEFAULT_LOAD_ACTIVE_SEASON,
): void {
  act(() => {
    root.render(
      <AuthProvider>
        <SeasonProvider loadActiveSeason={loadActiveSeason}>
          {user === null ? (
            <OutreachList {...props} />
          ) : (
            <LoginAs user={user}>
              <OutreachList {...props} />
            </LoginAs>
          )}
        </SeasonProvider>
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

function freshContainer(): void {
  act(() => {
    root.unmount();
  });
  container.remove();
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
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
// Pure functions
// ---------------------------------------------------------------------------

describe('filterOutreachEvents (NAV-07)', () => {
  it('excludes non-outreach event types', () => {
    const events: OutreachEventRow[] = [
      { id: 'e1', seasonId: 's1', type: 'outreach', title: 'Food Bank', locationName: 'X' },
      {
        id: 'e2',
        seasonId: 's1',
        type: 'meeting',
        title: 'Weekly Team Meeting',
        locationName: 'Y',
      },
      { id: 'e3', seasonId: 's1', type: 'competition', title: 'Regionals', locationName: 'Z' },
    ];
    expect(filterOutreachEvents(events).map((e) => e.id)).toEqual(['e1']);
  });

  it('the shipped fixture loader excludes "Weekly Team Meeting" from its outreach-filtered events', async () => {
    const data = await defaultLoadOutreachData('season-placeholder-current');
    const outreach = filterOutreachEvents(data.events);
    expect(outreach.some((e) => e.title === 'Weekly Team Meeting')).toBe(false);
    expect(outreach.length).toBeGreaterThan(0);
  });
});

describe('sessionHours', () => {
  it('computes ends_at - starts_at in hours', () => {
    const session: OutreachSessionRow = {
      id: 's1',
      eventId: 'e1',
      sessionDate: '2026-07-01',
      startsAt: '2026-07-01T14:00:00.000Z',
      endsAt: '2026-07-01T17:00:00.000Z',
      status: 'completed',
      peopleReached: null,
    };
    expect(sessionHours(session)).toBe(3);
  });
});

describe('computeStudentHours / computeGroupHours (BEH-02: never summed)', () => {
  const sessions: OutreachSessionRow[] = [
    {
      id: 'past-going',
      eventId: 'e1',
      sessionDate: '2026-06-01',
      startsAt: '2026-06-01T14:00:00.000Z',
      endsAt: '2026-06-01T17:00:00.000Z', // 3h
      status: 'completed',
      peopleReached: null,
    },
    {
      id: 'upcoming-going',
      eventId: 'e1',
      sessionDate: '2026-08-01',
      startsAt: '2026-08-01T14:00:00.000Z',
      endsAt: '2026-08-01T16:00:00.000Z', // 2h
      status: 'scheduled',
      peopleReached: null,
    },
    {
      id: 'upcoming-declined',
      eventId: 'e1',
      sessionDate: '2026-08-05',
      startsAt: '2026-08-05T14:00:00.000Z',
      endsAt: '2026-08-05T15:00:00.000Z', // 1h, but declined -- must not count
      status: 'scheduled',
      peopleReached: null,
    },
    {
      id: 'canceled-going',
      eventId: 'e1',
      sessionDate: '2026-06-10',
      startsAt: '2026-06-10T14:00:00.000Z',
      endsAt: '2026-06-10T16:00:00.000Z', // 2h, but canceled -- must not count
      status: 'canceled',
      peopleReached: null,
    },
  ];
  const rsvps: RsvpRow[] = [
    {
      id: 'r1',
      sessionId: 'past-going',
      studentId: 'stu-1',
      status: 'going',
      respondedBy: 'stu-1',
      updatedAt: '',
      createdAt: '',
    },
    {
      id: 'r2',
      sessionId: 'upcoming-going',
      studentId: 'stu-1',
      status: 'going',
      respondedBy: 'stu-1',
      updatedAt: '',
      createdAt: '',
    },
    {
      id: 'r3',
      sessionId: 'upcoming-declined',
      studentId: 'stu-1',
      status: 'declined',
      respondedBy: 'stu-1',
      updatedAt: '',
      createdAt: '',
    },
    {
      id: 'r4',
      sessionId: 'canceled-going',
      studentId: 'stu-1',
      status: 'going',
      respondedBy: 'stu-1',
      updatedAt: '',
      createdAt: '',
    },
  ];

  it('confirmed = going + completed; planned = going + scheduled; declined/canceled contribute to neither', () => {
    const breakdown = computeStudentHours('stu-1', sessions, rsvps);
    expect(breakdown).toEqual({ confirmedHours: 3, plannedHours: 2 });
  });

  it('a student with no rsvps at all gets zero for both, independently', () => {
    expect(computeStudentHours('stu-nobody', sessions, rsvps)).toEqual({
      confirmedHours: 0,
      plannedHours: 0,
    });
  });

  it('computeGroupHours sums confirmed and planned SEPARATELY across students', () => {
    const rsvpsTwoStudents: RsvpRow[] = [
      ...rsvps,
      {
        id: 'r5',
        sessionId: 'past-going',
        studentId: 'stu-2',
        status: 'going',
        respondedBy: 'stu-2',
        updatedAt: '',
        createdAt: '',
      },
    ];
    const group = computeGroupHours(['stu-1', 'stu-2'], sessions, rsvpsTwoStudents);
    // stu-1: confirmed 3, planned 2. stu-2: confirmed 3, planned 0.
    // Total confirmed 6, total planned 2 -- NEVER 8 (a summed figure).
    expect(group).toEqual({ confirmedHours: 6, plannedHours: 2 });
  });
});

describe('sumIndividualGoals', () => {
  it('sums only the requested student ids', () => {
    const goalConfig: OutreachGoalConfig = {
      seasonId: 's1',
      individualGoalHoursByStudentId: { a: 10, b: 8, c: 12 },
    };
    expect(sumIndividualGoals(['a', 'b'], goalConfig)).toBe(18);
    expect(sumIndividualGoals(['a', 'b', 'c'], goalConfig)).toBe(30);
  });

  it('treats a missing goal as 0, not an error', () => {
    const goalConfig: OutreachGoalConfig = {
      seasonId: 's1',
      individualGoalHoursByStudentId: { a: 10 },
    };
    expect(sumIndividualGoals(['a', 'nobody'], goalConfig)).toBe(10);
  });
});

describe('buildUpcomingPast', () => {
  it('splits scheduled into upcoming and completed/canceled into past, sorted, joined through events', () => {
    const events: OutreachEventRow[] = [
      { id: 'e1', seasonId: 's1', type: 'outreach', title: 'E1', locationName: 'L' },
    ];
    const sessions: OutreachSessionRow[] = [
      {
        id: 'a',
        eventId: 'e1',
        sessionDate: '2026-07-01',
        startsAt: '2026-07-01T00:00:00.000Z',
        endsAt: '2026-07-01T01:00:00.000Z',
        status: 'completed',
        peopleReached: null,
      },
      {
        id: 'b',
        eventId: 'e1',
        sessionDate: '2026-07-10',
        startsAt: '2026-07-10T00:00:00.000Z',
        endsAt: '2026-07-10T01:00:00.000Z',
        status: 'scheduled',
        peopleReached: null,
      },
      {
        id: 'c',
        eventId: 'e1',
        sessionDate: '2026-07-05',
        startsAt: '2026-07-05T00:00:00.000Z',
        endsAt: '2026-07-05T01:00:00.000Z',
        status: 'scheduled',
        peopleReached: null,
      },
      {
        id: 'd',
        eventId: 'e1',
        sessionDate: '2026-07-02',
        startsAt: '2026-07-02T00:00:00.000Z',
        endsAt: '2026-07-02T01:00:00.000Z',
        status: 'canceled',
        peopleReached: null,
      },
      // No matching event -- must be dropped entirely, not crash.
      {
        id: 'orphan',
        eventId: 'no-such-event',
        sessionDate: '2026-07-03',
        startsAt: '2026-07-03T00:00:00.000Z',
        endsAt: '2026-07-03T01:00:00.000Z',
        status: 'scheduled',
        peopleReached: null,
      },
    ];
    const { upcoming, past } = buildUpcomingPast(sessions, events);
    expect(upcoming.map((entry) => entry.session.id)).toEqual(['c', 'b']); // ascending
    expect(past.map((entry) => entry.session.id)).toEqual(['d', 'a']); // descending
  });
});

describe('confirmedPercent / crossedMilestones (BEH-01)', () => {
  it('computes percent from confirmed hours only, capped at 100', () => {
    expect(confirmedPercent(3, 12)).toBe(25);
    expect(confirmedPercent(20, 10)).toBe(100);
    expect(confirmedPercent(5, 0)).toBe(0);
  });

  it('returns every milestone at or below the current percent', () => {
    expect(crossedMilestones(0)).toEqual([]);
    expect(crossedMilestones(25)).toEqual([25]);
    expect(crossedMilestones(60)).toEqual([25, 50]);
    expect(crossedMilestones(100)).toEqual([25, 50, 75, 100]);
  });
});

describe('getUnansweredRsvpCount (BEH-04 / Known Context/Traps #3)', () => {
  const sessions: OutreachSessionRow[] = [
    {
      id: 'upcoming-1',
      eventId: 'e1',
      sessionDate: '2026-08-01',
      startsAt: '2026-08-01T00:00:00.000Z',
      endsAt: '2026-08-01T01:00:00.000Z',
      status: 'scheduled',
      peopleReached: null,
    },
    {
      id: 'past-1',
      eventId: 'e1',
      sessionDate: '2026-06-01',
      startsAt: '2026-06-01T00:00:00.000Z',
      endsAt: '2026-06-01T01:00:00.000Z',
      status: 'completed',
      peopleReached: null,
    },
  ];
  const rsvps: RsvpRow[] = [
    {
      id: 'r1',
      sessionId: 'upcoming-1',
      studentId: 'stu-answered',
      status: 'declined',
      respondedBy: 'stu-answered',
      updatedAt: '',
      createdAt: '',
    },
  ];

  it('counts an upcoming session with no rsvp row at all', () => {
    expect(getUnansweredRsvpCount(sessions, rsvps, ['stu-unanswered'])).toBe(1);
  });

  it('never counts a declined/maybe RSVP as unanswered -- those ARE answers', () => {
    expect(getUnansweredRsvpCount(sessions, rsvps, ['stu-answered'])).toBe(0);
  });

  it('never counts a past (non-scheduled) session, answered or not', () => {
    expect(getUnansweredRsvpCount(sessions, [], ['stu-x'])).toBe(1); // only upcoming-1 counts, not past-1
  });

  it('is generic over multiple student ids (flattened count)', () => {
    expect(getUnansweredRsvpCount(sessions, rsvps, ['stu-answered', 'stu-unanswered'])).toBe(1);
  });

  it('the shipped fixture data produces the documented counts for both roles', async () => {
    const data: OutreachLoadResult = await defaultLoadOutreachData('season-placeholder-current');
    const outreachEvents = filterOutreachEvents(data.events);
    const outreachEventIds = new Set(outreachEvents.map((e) => e.id));
    const outreachSessions = data.sessions.filter((s) => outreachEventIds.has(s.eventId));
    const allStudentIds = data.students.map((s) => s.id);

    // Coach (whole roster): 2 unanswered on session-food-bank-upcoming
    // (Priya, viewer) + 2 unanswered on session-park-cleanup-upcoming
    // (Amara, Cole) = 4.
    expect(getUnansweredRsvpCount(outreachSessions, data.rsvps, allStudentIds)).toBe(4);

    // Viewer alone: unanswered only on session-food-bank-upcoming (they
    // already answered "maybe" on the park cleanup session) = 1.
    expect(
      getUnansweredRsvpCount(outreachSessions, data.rsvps, [PLACEHOLDER_CURRENT_STUDENT_ID]),
    ).toBe(1);
  });
});

describe('withRsvpOverride', () => {
  it('synthesizes a new row when none existed (the "unanswered" case being answered)', () => {
    const result = withRsvpOverride([], 'stu-1', 'sess-1', 'going');
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ studentId: 'stu-1', sessionId: 'sess-1', status: 'going' });
  });

  it('updates an existing row in place, leaving other rows untouched', () => {
    const existing: RsvpRow[] = [
      {
        id: 'r1',
        sessionId: 'sess-1',
        studentId: 'stu-1',
        status: 'maybe',
        respondedBy: 'stu-1',
        updatedAt: 'old',
        createdAt: 'old',
      },
      {
        id: 'r2',
        sessionId: 'sess-2',
        studentId: 'stu-1',
        status: 'going',
        respondedBy: 'stu-1',
        updatedAt: 'old',
        createdAt: 'old',
      },
    ];
    const result = withRsvpOverride(existing, 'stu-1', 'sess-1', 'declined');
    expect(result.find((r) => r.sessionId === 'sess-1')?.status).toBe('declined');
    expect(result.find((r) => r.sessionId === 'sess-2')?.status).toBe('going');
  });
});

describe('formatSessionDateOnly / formatSessionDateTime (NFR-09: America/Chicago)', () => {
  it('renders a weekday + short date', () => {
    const session: OutreachSessionRow = {
      id: 's1',
      eventId: 'e1',
      sessionDate: '2026-07-26',
      startsAt: '2026-07-26T15:00:00.000Z',
      endsAt: '2026-07-26T17:00:00.000Z',
      status: 'scheduled',
      peopleReached: null,
    };
    expect(formatSessionDateOnly(session)).toBe('Sun, Jul 26');
  });

  it('renders date + Chicago-local time range (CDT, UTC-5)', () => {
    const session: OutreachSessionRow = {
      id: 's1',
      eventId: 'e1',
      sessionDate: '2026-07-26',
      startsAt: '2026-07-26T15:00:00.000Z', // 10:00 AM Chicago
      endsAt: '2026-07-26T17:00:00.000Z', // 12:00 PM Chicago
      status: 'scheduled',
      peopleReached: null,
    };
    expect(formatSessionDateTime(session)).toBe('Sun, Jul 26 · 10:00 AM–12:00 PM');
  });
});

describe('BEH-01 milestone-toast dedupe primitives (localStorage)', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('has not fired until explicitly marked, then reports fired for that exact season+goalBar+milestone', () => {
    expect(hasMilestoneToastFired('season-x', 'team', 25)).toBe(false);
    markMilestoneToastFired('season-x', 'team', 25);
    expect(hasMilestoneToastFired('season-x', 'team', 25)).toBe(true);
  });

  it('is scoped per season -- a different season is unaffected', () => {
    markMilestoneToastFired('season-x', 'team', 25);
    expect(hasMilestoneToastFired('season-y', 'team', 25)).toBe(false);
  });

  it('is scoped per goal bar -- a different goal bar (e.g. a different student) is unaffected', () => {
    markMilestoneToastFired('season-x', 'team', 25);
    expect(hasMilestoneToastFired('season-x', 'student-someone-else', 25)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// <OutreachList /> -- signed-out fallback
// ---------------------------------------------------------------------------

describe('<OutreachList /> signed out', () => {
  it('shows a sign-in prompt, never the coach or student view', () => {
    renderAsUser(null);
    expect(container.textContent).toContain('Sign in to view outreach');
  });
});

// ---------------------------------------------------------------------------
// <OutreachList /> coach view -- all four DES-12 states
// ---------------------------------------------------------------------------

describe('<OutreachList /> coach view', () => {
  it('loading state', async () => {
    renderAsUser(COACH_USER, { loadData: () => new Promise<OutreachLoadResult>(() => {}) });
    // T073b2: auth resolution (even via the fake `authModule` this
    // harness's `LoginAs` now uses) is genuinely async -- a flush is needed
    // before the authenticated body (and its own DES-12 loading state)
    // mounts. See `src/test-utils/authHarness.tsx`'s module doc.
    await flushMicrotasks();
    expect(container.textContent).toContain('Loading outreach events');
  });

  it('error state', async () => {
    renderAsUser(COACH_USER, { loadData: () => Promise.reject(new Error('boom')) });
    await flushMicrotasks();
    expect(container.textContent).toContain("Couldn't load outreach events");
  });

  it('empty state (zero outreach sessions) offers a "New outreach event" action', async () => {
    renderAsUser(COACH_USER, {
      loadData: () =>
        Promise.resolve({
          events: [],
          sessions: [],
          rsvps: [],
          students: [],
          goalConfig: { seasonId: 's1', individualGoalHoursByStudentId: {} },
        }),
    });
    await flushMicrotasks();
    expect(container.textContent).toContain('No outreach events yet');
    expect(container.textContent).toContain('New outreach event');
  });

  it('populated state: Upcoming/Past sections, going counts, unanswered badge, NAV-07 exclusion', async () => {
    renderAsUser(COACH_USER, { loadData: defaultLoadOutreachData });
    await flushMicrotasks();

    expect(container.textContent).toContain('Community Food Bank Sort');
    expect(container.textContent).toContain('Riverside Park Cleanup');
    expect(container.textContent).toContain('After-School Tutoring Drive');
    expect(container.textContent).toContain('Team season goal');
    expect(container.textContent).toContain('4 pending RSVPs');
    // session-food-bank-upcoming: only Amara is 'going'.
    expect(container.textContent).toContain('1 going');
    // session-park-cleanup-upcoming: Priya and Devon are 'going'.
    expect(container.textContent).toContain('2 going');
    expect(container.textContent).toContain('120 people reached');
    expect(container.textContent).toContain('Canceled — no attendance recorded.');

    // NAV-07: meeting content must never appear.
    expect(container.textContent).not.toContain('Weekly Team Meeting');
    expect(container.textContent).not.toContain('Clubhouse');
  });

  it('T101: "New outreach event" opens the real OutreachEventDialog (module doc #11), not a stub', async () => {
    renderAsUser(COACH_USER, { loadData: defaultLoadOutreachData });
    await flushMicrotasks();

    const newEventButtons = Array.from(container.querySelectorAll('button')).filter((btn) =>
      btn.textContent?.includes('New outreach event'),
    );
    expect(newEventButtons.length).toBeGreaterThan(0);
    act(() => {
      newEventButtons[0].dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    // The real dialog's own DialogHeader title, in CREATE mode.
    expect(document.body.textContent).toContain('New outreach event');
    // The old stub copy must never appear anywhere anymore (grep-provable
    // proof this is genuinely wired, not still a disclosure Banner).
    expect(container.textContent).not.toContain('Event creation dialog not built yet');
  });

  it('T101: creating an outreach event via the real dialog calls the injected onSaveEvent and reloads the list', async () => {
    const onSaveEvent = vi.fn().mockResolvedValue(undefined);
    let loadCount = 0;
    async function countingLoadData(seasonId: string): Promise<OutreachLoadResult> {
      loadCount += 1;
      return defaultLoadOutreachData(seasonId);
    }

    renderAsUser(COACH_USER, { loadData: countingLoadData, onSaveEvent });
    await flushMicrotasks();
    expect(loadCount).toBe(1);

    const newEventButtons = Array.from(container.querySelectorAll('button')).filter((btn) =>
      btn.textContent?.includes('New outreach event'),
    );
    act(() => {
      newEventButtons[0].dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    const labels = Array.from(document.querySelectorAll('label'));
    const titleLabel = labels.find((el) => el.textContent?.trim().startsWith('Title'));
    const titleInput = document.getElementById(
      titleLabel?.getAttribute('for') ?? '',
    ) as HTMLInputElement;
    const dateLabel = labels.find((el) => el.textContent?.trim().startsWith('Date'));
    const dateInput = document.getElementById(
      dateLabel?.getAttribute('for') ?? '',
    ) as HTMLInputElement;

    function setNativeInputValue(input: HTMLInputElement, value: string): void {
      const setter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype,
        'value',
      )?.set;
      setter?.call(input, value);
      input.dispatchEvent(new Event('input', { bubbles: true }));
    }

    act(() => {
      setNativeInputValue(titleInput, 'Winter Coat Drive');
      setNativeInputValue(dateInput, '2026-08-15');
    });

    const createButton = Array.from(document.querySelectorAll('button')).find(
      (btn) => btn.textContent?.trim() === 'Create event — 1 session',
    );
    expect(createButton).toBeTruthy();
    await act(async () => {
      createButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await Promise.resolve();
      await Promise.resolve();
    });
    await flushMicrotasks();

    expect(onSaveEvent).toHaveBeenCalledTimes(1);
    expect(onSaveEvent.mock.calls[0][0]).toMatchObject({
      event: { title: 'Winter Coat Drive' },
    });
    // The list reloaded (module doc #11) -- a second real `loadData` call,
    // not a client-side merge.
    expect(loadCount).toBe(2);
    expect(container.textContent).toContain('Outreach event created');
  });

  it('BEH-01: the team goal bar fires milestone toasts once confirmed hours cross them (first render only)', async () => {
    window.localStorage.clear();
    // Shrinks each individual goal to 3h so the fixture's real 9h team
    // confirmed total (unchanged from defaultLoadOutreachData) crosses both
    // 25% and 50% of a 15h team goal.
    async function loadWithSmallTeamGoal(seasonId: string): Promise<OutreachLoadResult> {
      const base = await defaultLoadOutreachData(seasonId);
      const smallGoals: Record<string, number> = {};
      for (const student of base.students) smallGoals[student.id] = 3;
      return { ...base, goalConfig: { seasonId, individualGoalHoursByStudentId: smallGoals } };
    }

    renderAsUser(COACH_USER, { loadData: loadWithSmallTeamGoal });
    await flushMicrotasks();

    expect(container.textContent).toContain(
      'Team season goal: reached 25% of the season goal (confirmed hours).',
    );
    expect(container.textContent).toContain(
      'Team season goal: reached 50% of the season goal (confirmed hours).',
    );
    // 9 confirmed / 15 goal = 60% -- 75% and 100% must NOT show as reached.
    expect(container.textContent).not.toContain('75% reached');
    expect(container.textContent).not.toContain('100% reached');
  });
});

// ---------------------------------------------------------------------------
// <OutreachList /> student/parent view -- all four DES-12 states
// ---------------------------------------------------------------------------

describe('<OutreachList /> student/parent view', () => {
  it('loading state', async () => {
    renderAsUser(STUDENT_OR_PARENT_USER, {
      loadData: () => new Promise<OutreachLoadResult>(() => {}),
    });
    // T073b2: auth resolution (even via the fake `authModule` this
    // harness's `LoginAs` now uses) is genuinely async -- a flush is needed
    // before the authenticated body (and its own DES-12 loading state)
    // mounts. See `src/test-utils/authHarness.tsx`'s module doc.
    await flushMicrotasks();
    expect(container.textContent).toContain('Loading outreach events');
  });

  it('error state', async () => {
    renderAsUser(STUDENT_OR_PARENT_USER, { loadData: () => Promise.reject(new Error('boom')) });
    await flushMicrotasks();
    expect(container.textContent).toContain("Couldn't load outreach events");
  });

  it('empty state (zero outreach sessions)', async () => {
    renderAsUser(STUDENT_OR_PARENT_USER, {
      loadData: () =>
        Promise.resolve({
          events: [],
          sessions: [],
          rsvps: [],
          students: [],
          goalConfig: { seasonId: 's1', individualGoalHoursByStudentId: {} },
        }),
    });
    await flushMicrotasks();
    // DES-15 verbatim (PRD line 213, T083).
    expect(container.textContent).toContain('No upcoming outreach yet.');
    expect(container.textContent).toContain(
      'When your coach posts an event, you can sign up here.',
    );
  });

  it('populated state: own goal bar (confirmed/planned never summed), unanswered badge, RSVP controls, NAV-07 exclusion', async () => {
    window.localStorage.clear();
    renderAsUser(STUDENT_OR_PARENT_USER, { loadData: defaultLoadOutreachData });
    await flushMicrotasks();

    expect(container.textContent).toContain('Your season goal');
    expect(container.textContent).toContain('3 hrs confirmed');
    expect(container.textContent).toContain('0 hrs planned');
    expect(container.textContent).toContain('1 awaiting your RSVP');
    expect(container.textContent).toContain("You RSVP'd: Going"); // past session-food-bank-past

    // NAV-07: meeting content must never appear.
    expect(container.textContent).not.toContain('Weekly Team Meeting');

    // Riverside Park Cleanup: viewer already answered "maybe" -- the
    // SegmentedControl must reflect that as the checked segment.
    const radiogroups = Array.from(container.querySelectorAll('[role="radiogroup"]'));
    const parkGroup = radiogroups.find((el) =>
      el.getAttribute('aria-label')?.startsWith('Your RSVP for Riverside Park Cleanup'),
    );
    expect(parkGroup).toBeTruthy();
    expect(
      parkGroup?.querySelector('button[data-value="maybe"]')?.getAttribute('aria-checked'),
    ).toBe('true');

    // Community Food Bank Sort (upcoming): viewer has NOT answered yet --
    // no segment should show as checked (the UNANSWERED_RSVP_SEGMENT_VALUE
    // sentinel matches none of the real items).
    const foodBankGroup = radiogroups.find((el) =>
      el.getAttribute('aria-label')?.startsWith('Your RSVP for Community Food Bank Sort'),
    );
    expect(foodBankGroup).toBeTruthy();
    for (const value of ['going', 'maybe', 'declined']) {
      expect(
        foodBankGroup?.querySelector(`button[data-value="${value}"]`)?.getAttribute('aria-checked'),
      ).toBe('false');
    }
  });

  it('selecting a real RSVP segment updates the goal bar and the unanswered-RSVP badge live (module doc #8b)', async () => {
    window.localStorage.clear();
    renderAsUser(STUDENT_OR_PARENT_USER, { loadData: defaultLoadOutreachData });
    await flushMicrotasks();

    const foodBankGroup = Array.from(container.querySelectorAll('[role="radiogroup"]')).find((el) =>
      el.getAttribute('aria-label')?.startsWith('Your RSVP for Community Food Bank Sort'),
    );
    const goingButton = foodBankGroup?.querySelector('button[data-value="going"]');
    expect(goingButton).toBeTruthy();

    act(() => {
      goingButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    // session-food-bank-upcoming is `scheduled` (3h) -- a fresh "going" RSVP
    // on it adds to PLANNED hours only, never to confirmed (BEH-02).
    expect(container.textContent).toContain('3 hrs confirmed'); // unchanged
    expect(container.textContent).toContain('3 hrs planned'); // was 0, now 3
    expect(container.textContent).toContain('0 awaiting your RSVP'); // was 1, now answered
  });

  it('BEH-01: milestone toast fires once per season+goal-bar, deduped via localStorage across remounts', async () => {
    window.localStorage.clear();

    renderAsUser(STUDENT_OR_PARENT_USER, { loadData: defaultLoadOutreachData });
    await flushMicrotasks();
    // Viewer: 3 confirmed / 12 goal = exactly 25%.
    expect(container.textContent).toContain(
      'Your season goal: reached 25% of the season goal (confirmed hours).',
    );

    freshContainer();

    renderAsUser(STUDENT_OR_PARENT_USER, { loadData: defaultLoadOutreachData });
    await flushMicrotasks();
    // Same season, same goal bar (the viewer's own id) -- already fired, so
    // crossing the SAME milestone again must NOT re-fire the toast.
    expect(container.textContent).not.toContain('reached 25% of the season goal');
    // The milestone tick itself is still shown as reached (a real, current
    // fact), independent of whether the one-time toast fires again.
    expect(container.textContent).toContain('25% reached');
  });
});

// ---------------------------------------------------------------------------
// T106 HOTFIX: `useActiveSeason()` wiring -- component module doc #12's four
// states, the explicit-`seasonId`-prop override precedence, and (Required
// Worker Output) direct proof that `loadData` is only ever called with a
// real UUID-shaped season id resolved from `useActiveSeason()`, never with
// the old `PLACEHOLDER_SEASON_ID` literal.
// ---------------------------------------------------------------------------

describe('<OutreachList /> useActiveSeason() wiring (T106 hotfix)', () => {
  it('renders a loading state for the active season itself (not the outreach-data loading state) while useActiveSeason() is still `loading`, and never calls loadData', async () => {
    const loadData = vi.fn(() => new Promise<OutreachLoadResult>(() => {}));
    renderAsUser(COACH_USER, { loadData }, () => new Promise(() => {}));
    await flushMicrotasks();
    expect(container.textContent).toContain('Loading the active season');
    expect(container.textContent).not.toContain('Loading outreach events');
    expect(loadData).not.toHaveBeenCalled();
  });

  it('renders an honest "No active season yet" state for the real `\'none\'` case -- zero seasons in the database -- and never calls loadData', async () => {
    const loadData = vi.fn(() =>
      Promise.resolve(defaultLoadOutreachData('season-placeholder-current')),
    );
    renderAsUser(COACH_USER, { loadData }, async () => null);
    await flushMicrotasks();
    expect(container.textContent).toContain('No active season yet');
    expect(loadData).not.toHaveBeenCalled();
  });

  it("renders the real SupabaseLoaderError message for the `'error'` case, and never calls loadData", async () => {
    const loadData = vi.fn(() =>
      Promise.resolve(defaultLoadOutreachData('season-placeholder-current')),
    );
    renderAsUser(COACH_USER, { loadData }, async () => {
      throw { code: '42501', message: 'Permission denied.', cause: null };
    });
    await flushMicrotasks();
    expect(container.textContent).toContain("Couldn't load the active season");
    expect(container.textContent).toContain('Permission denied.');
    expect(loadData).not.toHaveBeenCalled();
  });

  it("calls loadData with the real, resolved UUID-shaped active season id (never the old placeholder string) once useActiveSeason() is `'ready'`, with no explicit seasonId prop", async () => {
    const REAL_UUID_SEASON_ID = '3fa2c1c4-9b3a-4a0a-8b3e-5a2b7a6c9d10';
    let seasonIdSeenByLoadData: string | null = null;
    const loadData = vi.fn(async (id: string) => {
      seasonIdSeenByLoadData = id;
      return defaultLoadOutreachData(id);
    });
    renderAsUser(COACH_USER, { loadData }, async () => ({
      ...DEFAULT_READY_SEASON,
      id: REAL_UUID_SEASON_ID,
    }));
    await flushMicrotasks();

    expect(loadData).toHaveBeenCalledTimes(1);
    expect(loadData).toHaveBeenCalledWith(REAL_UUID_SEASON_ID);
    expect(seasonIdSeenByLoadData).toBe(REAL_UUID_SEASON_ID);
    // The old hardcoded placeholder must never be the id passed to loadData.
    expect(seasonIdSeenByLoadData).not.toBe('season-placeholder-current');
  });

  it("an explicit seasonId prop overrides useActiveSeason() outright, even when the hook is not `'ready'`, and loadData is called with the prop value", async () => {
    let seasonIdSeenByLoadData: string | null = null;
    const loadData = vi.fn(async (id: string) => {
      seasonIdSeenByLoadData = id;
      return defaultLoadOutreachData(id);
    });
    renderAsUser(
      COACH_USER,
      { loadData, seasonId: 'season-explicit-override' },
      // The hook itself never resolves `'ready'` here (stays `'none'`) --
      // the explicit prop must still win and render real data.
      async () => null,
    );
    await flushMicrotasks();

    expect(container.textContent).not.toContain('No active season yet');
    expect(loadData).toHaveBeenCalledWith('season-explicit-override');
    expect(seasonIdSeenByLoadData).toBe('season-explicit-override');
  });
});

// ---------------------------------------------------------------------------
// T101 (ED-1 Packet P10): real loader-level tests for
// `../../lib/supabase/loaders/outreach.ts`'s `makeLoadOutreachData`/
// `makeSaveOutreachEvent` -- same "inject a fake SupabaseClient chain"
// pattern `loaders/meetings.ts`'s own tests (`MeetingsList.test.tsx`)
// already established.
// ---------------------------------------------------------------------------

describe('loadOutreachData (T101 real load)', () => {
  it('filters events by season_id server-side, joins sessions/rsvps by id, and resolves a real per-student goal from students.goal_hours_override / seasons.default_goal_hours', async () => {
    const eventsEqSpy = vi.fn().mockResolvedValue({
      data: [
        {
          id: 'event-1',
          season_id: 'season-1',
          type: 'outreach',
          title: 'Food Bank',
          description: '',
          location_name: 'X',
          address: '',
          team_ids: null,
          counts_participation: false,
          counts_volunteer_hours: true,
          adult_volunteers_count: 0,
          adult_volunteer_hours: 0,
          created_by: null,
        },
      ],
      error: null,
    });
    const sessionsInSpy = vi.fn().mockResolvedValue({
      data: [
        {
          id: 'session-1',
          event_id: 'event-1',
          session_date: '2026-08-01',
          starts_at: '2026-08-01T14:00:00.000Z',
          ends_at: '2026-08-01T16:00:00.000Z',
          status: 'scheduled',
          people_reached: null,
          notes: '',
        },
      ],
      error: null,
    });
    const rsvpsInSpy = vi.fn().mockResolvedValue({ data: [], error: null });
    const studentsOrderSpy = vi.fn().mockResolvedValue({
      data: [
        { id: 'student-1', display_name: 'Amara', team_id: 'team-ravens', goal_hours_override: 5 },
      ],
      error: null,
    });
    const seasonMaybeSingleSpy = vi
      .fn()
      .mockResolvedValue({ data: { id: 'season-1', default_goal_hours: 100 }, error: null });

    const fromSpy = vi.fn((table: string) => {
      if (table === 'events') return { select: vi.fn(() => ({ eq: eventsEqSpy })) };
      if (table === 'event_sessions') return { select: vi.fn(() => ({ in: sessionsInSpy })) };
      if (table === 'rsvps') return { select: vi.fn(() => ({ in: rsvpsInSpy })) };
      if (table === 'students') return { select: vi.fn(() => ({ order: studentsOrderSpy })) };
      if (table === 'seasons') {
        return {
          select: vi.fn(() => ({ eq: vi.fn(() => ({ maybeSingle: seasonMaybeSingleSpy })) })),
        };
      }
      throw new Error(`unexpected table: ${table}`);
    });
    const client = { from: fromSpy } as unknown as SupabaseClient;

    const load = makeLoadOutreachData(() => client);
    const result = await load('season-1');

    expect(eventsEqSpy).toHaveBeenCalledWith('season_id', 'season-1');
    expect(sessionsInSpy).toHaveBeenCalledWith('event_id', ['event-1']);
    expect(rsvpsInSpy).toHaveBeenCalledWith('session_id', ['session-1']);
    expect(result.events).toHaveLength(1);
    expect(result.sessions).toHaveLength(1);
    // The student's own explicit override (5) wins over the season default
    // (100) -- both real columns, module doc #2 of the loader file.
    expect(result.goalConfig.individualGoalHoursByStudentId['student-1']).toBe(5);
  });

  it('falls back to the season default_goal_hours when a student has no goal_hours_override', async () => {
    const nullEmpty = { data: [], error: null };
    const fromSpy = vi.fn((table: string) => {
      if (table === 'events')
        return { select: vi.fn(() => ({ eq: vi.fn().mockResolvedValue(nullEmpty) })) };
      if (table === 'students') {
        return {
          select: vi.fn(() => ({
            order: vi.fn().mockResolvedValue({
              data: [
                { id: 'student-1', display_name: 'Amara', team_id: 't', goal_hours_override: null },
              ],
              error: null,
            }),
          })),
        };
      }
      if (table === 'seasons') {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: vi.fn().mockResolvedValue({
                data: { id: 'season-1', default_goal_hours: 42 },
                error: null,
              }),
            })),
          })),
        };
      }
      throw new Error(`unexpected table: ${table}`);
    });
    const client = { from: fromSpy } as unknown as SupabaseClient;

    const load = makeLoadOutreachData(() => client);
    const result = await load('season-1');
    expect(result.goalConfig.individualGoalHoursByStudentId['student-1']).toBe(42);
  });
});

describe('saveOutreachEvent (T101, Trap #5 real onSaveEvent default)', () => {
  it('CREATE: resolves the active season, then inserts one events row + one event_sessions row per session', async () => {
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
    });

    expect(eventInsertSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        season_id: 'season-active-1',
        type: 'outreach',
        title: 'Food Bank Sort',
      }),
    );
    expect(sessionsInsertSpy).toHaveBeenCalledWith([
      expect.objectContaining({ event_id: 'event-created-1', session_date: '2026-08-01' }),
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

    const save = makeSaveOutreachEvent(() => client);
    await expect(
      save({
        event: {
          title: 'X',
          description: '',
          locationName: '',
          address: '',
          type: 'outreach',
          countsParticipation: false,
          countsVolunteerHours: true,
          teamIds: null,
          adultVolunteersCount: 0,
          adultVolunteerHours: 0,
          shareToCalendarFeed: true,
        },
        sessions: [],
      }),
    ).rejects.toThrow(/no active season/i);
  });

  it('EDIT: updates the events row, updates sessions matching an existing session_date in place, and inserts brand-new dates -- never deletes', async () => {
    const eventUpdateEqSpy = vi.fn().mockResolvedValue({ data: null, error: null });
    const eventUpdateSpy = vi.fn(() => ({ eq: eventUpdateEqSpy }));
    const existingSessionsEqSpy = vi.fn().mockResolvedValue({
      data: [{ id: 'session-existing-1', session_date: '2026-08-01' }],
      error: null,
    });
    const sessionUpdateEqSpy = vi.fn().mockResolvedValue({ data: null, error: null });
    const sessionUpdateSpy = vi.fn(() => ({ eq: sessionUpdateEqSpy }));
    const sessionsInsertSpy = vi.fn().mockResolvedValue({ data: null, error: null });

    let sessionsSelectCall = 0;
    const fromSpy = vi.fn((table: string) => {
      if (table === 'events') return { update: eventUpdateSpy };
      if (table === 'event_sessions') {
        sessionsSelectCall += 1;
        return {
          select: vi.fn(() => ({ eq: existingSessionsEqSpy })),
          update: sessionUpdateSpy,
          insert: sessionsInsertSpy,
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
        // Matches the existing session_date -- updated in place (its real
        // id is preserved, never deleted/recreated).
        {
          sessionDate: '2026-08-01',
          startsAt: '2026-08-01T15:00:00.000Z',
          endsAt: '2026-08-01T17:00:00.000Z',
          notes: '',
          peopleReached: 50,
        },
        // A brand-new date -- inserted.
        {
          sessionDate: '2026-08-08',
          startsAt: '2026-08-08T14:00:00.000Z',
          endsAt: '2026-08-08T16:00:00.000Z',
          notes: '',
          peopleReached: null,
        },
      ],
    });

    expect(eventUpdateSpy).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Food Bank Sort (updated)' }),
    );
    expect(eventUpdateEqSpy).toHaveBeenCalledWith('id', 'event-existing-1');
    expect(sessionUpdateSpy).toHaveBeenCalledWith(
      expect.objectContaining({ starts_at: '2026-08-01T15:00:00.000Z', people_reached: 50 }),
    );
    expect(sessionUpdateEqSpy).toHaveBeenCalledWith('id', 'session-existing-1');
    expect(sessionsInsertSpy).toHaveBeenCalledWith([
      expect.objectContaining({ event_id: 'event-existing-1', session_date: '2026-08-08' }),
    ]);
    // Never a delete call anywhere in this reconciliation (module doc #5's
    // own genuine FK-restrict finding).
    expect(sessionsSelectCall).toBeGreaterThan(0);
  });
});
