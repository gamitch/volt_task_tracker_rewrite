// @vitest-environment jsdom
/**
 * T038: tests for `OutreachList.tsx`.
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
 */
import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthProvider, useAuth, type AuthUser } from '../../app/guards';
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
// guards.tsx's `Role` union has no 'student'/'parent' literal yet (module
// doc #6 gap) -- 'staff' stands in for "not coach/admin" here, exactly the
// branch OutreachList's own `isCoachOrAdminView` check falls through on for
// any non-coach/admin role.
const STUDENT_OR_PARENT_USER: AuthUser = {
  id: 'user-student',
  email: 'student@example.com',
  role: 'staff',
};

function LoginAs({ user, children }: { user: AuthUser; children: ReactNode }): ReactNode {
  const { login, user: currentUser } = useAuth();
  if (currentUser === null) {
    login(user);
  }
  return <>{children}</>;
}

function renderAsUser(user: AuthUser | null, props: Parameters<typeof OutreachList>[0] = {}): void {
  act(() => {
    root.render(
      <AuthProvider>
        {user === null ? (
          <OutreachList {...props} />
        ) : (
          <LoginAs user={user}>
            <OutreachList {...props} />
          </LoginAs>
        )}
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
  it('loading state', () => {
    renderAsUser(COACH_USER, { loadData: () => new Promise<OutreachLoadResult>(() => {}) });
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

  it('"New outreach event" shows the disclosed stub notice, not silent/fake behavior', async () => {
    renderAsUser(COACH_USER, { loadData: defaultLoadOutreachData });
    await flushMicrotasks();

    const newEventButtons = Array.from(container.querySelectorAll('button')).filter((btn) =>
      btn.textContent?.includes('New outreach event'),
    );
    expect(newEventButtons.length).toBeGreaterThan(0);
    act(() => {
      newEventButtons[0].dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(container.textContent).toContain('Event creation dialog not built yet');
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
  it('loading state', () => {
    renderAsUser(STUDENT_OR_PARENT_USER, {
      loadData: () => new Promise<OutreachLoadResult>(() => {}),
    });
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
    expect(container.textContent).toContain('No outreach events yet');
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
