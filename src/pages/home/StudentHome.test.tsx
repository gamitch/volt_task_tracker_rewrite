// @vitest-environment jsdom
/**
 * T054: tests for `StudentHome.tsx`.
 *
 * Per this task's Allowed Files ("A colocated `StudentHome.test.tsx` is
 * acceptable per established precedent -- disclose it") this test file is
 * the same class of addition `CoachHome.test.tsx`/T053,
 * `OutreachList.test.tsx`/T038, and `MeetingsList.test.tsx`/T030 already
 * made in their own sibling directories -- producing the DOM-text and
 * boundary-condition proof this task's own packet's "Required Worker
 * Output" section requires:
 *   - BEH-03: exactly one primary CTA in the hero, across all three states,
 *     proven via a real DOM count of `[data-variant="primary"]` (see
 *     `StudentHome.tsx`'s own module doc #2 for why that attribute is a
 *     real, stable Astryx-rendered DOM attribute, not an inference).
 *   - BEH-02: confirmed/planned hours rendered as two distinct numbers,
 *     never summed into one.
 *
 * No `@testing-library/react` is installed in this repo (confirmed via
 * `package.json`) -- these tests use the same raw `createRoot`/`act`
 * pattern `CoachHome.test.tsx`/`OutreachList.test.tsx` already established,
 * including their `AuthProvider` + `LoginAs` role-login harness.
 */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthProvider, type AuthUser } from '../../app/guards';
import { LoginAs } from '../../test-utils/authHarness';
import {
  buildNextUp,
  computePlannedHours,
  defaultLoadStudentHomeData,
  FIXTURE_REFERENCE_NOW,
  getUnansweredOutreachOpportunities,
  hoursVsGoalPercent,
  isEventInTeamScope,
  isSessionLive,
  PLACEHOLDER_CURRENT_STUDENT_ID,
  PLACEHOLDER_CURRENT_TEAM_ID,
  resolveGoalHours,
  selectHeroState,
  selectLiveMeetingSession,
  sessionHours,
  StudentHome,
  withLocalRsvpOverride,
  type CheckinSubmitResult,
  type HomeEventRow,
  type HomeRsvpRow,
  type HomeSessionRow,
  type StudentHomeData,
} from './StudentHome';

// ---------------------------------------------------------------------------
// Render harness -- mirrors CoachHome.test.tsx / OutreachList.test.tsx.
// ---------------------------------------------------------------------------

let container: HTMLDivElement;
let root: Root;

const STUDENT_USER: AuthUser = {
  id: 'user-student',
  email: 'student@example.com',
  role: 'student',
};

function renderAsUser(user: AuthUser | null, props: Parameters<typeof StudentHome>[0] = {}): void {
  act(() => {
    root.render(
      <AuthProvider>
        {user === null ? (
          <StudentHome {...props} />
        ) : (
          <LoginAs user={user}>
            <StudentHome {...props} />
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

function findButtonByText(text: string): HTMLButtonElement | undefined {
  return Array.from(container.querySelectorAll('button')).find(
    (button) => button.textContent?.trim() === text,
  );
}

function primaryButtons(): HTMLElement[] {
  return Array.from(container.querySelectorAll('[data-variant="primary"]'));
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

const REF_NOW_MS = FIXTURE_REFERENCE_NOW.getTime();

// ---------------------------------------------------------------------------
// Pure functions
// ---------------------------------------------------------------------------

describe('isEventInTeamScope', () => {
  it('treats teamIds === null as "all teams"', () => {
    expect(isEventInTeamScope({ teamIds: null }, 'team-a')).toBe(true);
  });
  it('excludes a team not present in teamIds', () => {
    expect(isEventInTeamScope({ teamIds: ['team-b'] }, 'team-a')).toBe(false);
  });
  it('includes a team present in teamIds', () => {
    expect(isEventInTeamScope({ teamIds: ['team-a', 'team-b'] }, 'team-a')).toBe(true);
  });
});

describe('isSessionLive', () => {
  const base = {
    startsAt: '2026-07-19T11:30:00.000Z',
    endsAt: '2026-07-19T13:30:00.000Z',
  } as const;
  it('is live when now is within [startsAt, endsAt] and status is scheduled', () => {
    expect(isSessionLive({ ...base, status: 'scheduled' }, REF_NOW_MS)).toBe(true);
  });
  it('is not live before startsAt', () => {
    expect(
      isSessionLive(
        { ...base, status: 'scheduled' },
        new Date('2026-07-19T11:00:00.000Z').getTime(),
      ),
    ).toBe(false);
  });
  it('is not live after endsAt', () => {
    expect(
      isSessionLive(
        { ...base, status: 'scheduled' },
        new Date('2026-07-19T14:00:00.000Z').getTime(),
      ),
    ).toBe(false);
  });
  it('is never live for a non-scheduled session, even within the time window', () => {
    expect(isSessionLive({ ...base, status: 'completed' }, REF_NOW_MS)).toBe(false);
    expect(isSessionLive({ ...base, status: 'canceled' }, REF_NOW_MS)).toBe(false);
  });
});

describe('selectLiveMeetingSession', () => {
  const events: HomeEventRow[] = [
    {
      id: 'event-meeting',
      seasonId: 's1',
      type: 'meeting',
      title: 'Weekly Build',
      teamIds: ['team-a'],
      countsVolunteerHours: false,
    },
    {
      id: 'event-outreach-live',
      seasonId: 's1',
      type: 'outreach',
      title: 'Live outreach (must be ignored -- not a meeting)',
      teamIds: ['team-a'],
      countsVolunteerHours: true,
    },
    {
      id: 'event-titans-meeting',
      seasonId: 's1',
      type: 'meeting',
      title: 'Titans meeting (wrong team)',
      teamIds: ['team-titans'],
      countsVolunteerHours: false,
    },
  ];
  const sessions: HomeSessionRow[] = [
    {
      id: 'session-meeting-live',
      eventId: 'event-meeting',
      startsAt: '2026-07-19T11:30:00.000Z',
      endsAt: '2026-07-19T13:30:00.000Z',
      status: 'scheduled',
    },
    {
      id: 'session-outreach-live',
      eventId: 'event-outreach-live',
      startsAt: '2026-07-19T11:30:00.000Z',
      endsAt: '2026-07-19T13:30:00.000Z',
      status: 'scheduled',
    },
    {
      id: 'session-titans-live',
      eventId: 'event-titans-meeting',
      startsAt: '2026-07-19T11:30:00.000Z',
      endsAt: '2026-07-19T13:30:00.000Z',
      status: 'scheduled',
    },
  ];

  it('returns the live meeting-type session in team scope, ignoring outreach and other teams', () => {
    const result = selectLiveMeetingSession(sessions, events, 'team-a', REF_NOW_MS);
    expect(result?.id).toBe('session-meeting-live');
  });

  it('returns null when nothing is live', () => {
    const result = selectLiveMeetingSession(
      sessions,
      events,
      'team-a',
      new Date('2026-07-19T20:00:00.000Z').getTime(),
    );
    expect(result).toBeNull();
  });
});

describe('buildNextUp', () => {
  it('includes meetings unconditionally and outreach only with a going RSVP; excludes competitions and wrong-team events', () => {
    const events: HomeEventRow[] = [
      {
        id: 'event-meeting',
        seasonId: 's1',
        type: 'meeting',
        title: 'Weekly Build',
        teamIds: null,
        countsVolunteerHours: false,
      },
      {
        id: 'event-outreach-going',
        seasonId: 's1',
        type: 'outreach',
        title: 'STEM Fair',
        teamIds: ['team-a'],
        countsVolunteerHours: true,
      },
      {
        id: 'event-outreach-unanswered',
        seasonId: 's1',
        type: 'outreach',
        title: 'Library Demo',
        teamIds: ['team-a'],
        countsVolunteerHours: true,
      },
      {
        id: 'event-competition',
        seasonId: 's1',
        type: 'competition',
        title: 'Regionals',
        teamIds: ['team-a'],
        countsVolunteerHours: false,
      },
      {
        id: 'event-wrong-team',
        seasonId: 's1',
        type: 'meeting',
        title: 'Titans meeting',
        teamIds: ['team-titans'],
        countsVolunteerHours: false,
      },
    ];
    const sessions: HomeSessionRow[] = [
      {
        id: 's-meeting',
        eventId: 'event-meeting',
        startsAt: '2026-07-21T23:00:00.000Z',
        endsAt: '2026-07-22T01:00:00.000Z',
        status: 'scheduled',
      },
      {
        id: 's-outreach-going',
        eventId: 'event-outreach-going',
        startsAt: '2026-07-25T15:00:00.000Z',
        endsAt: '2026-07-25T18:00:00.000Z',
        status: 'scheduled',
      },
      {
        id: 's-outreach-unanswered',
        eventId: 'event-outreach-unanswered',
        startsAt: '2026-07-26T15:00:00.000Z',
        endsAt: '2026-07-26T18:00:00.000Z',
        status: 'scheduled',
      },
      {
        id: 's-competition',
        eventId: 'event-competition',
        startsAt: '2026-07-27T15:00:00.000Z',
        endsAt: '2026-07-27T18:00:00.000Z',
        status: 'scheduled',
      },
      {
        id: 's-wrong-team',
        eventId: 'event-wrong-team',
        startsAt: '2026-07-21T23:00:00.000Z',
        endsAt: '2026-07-22T01:00:00.000Z',
        status: 'scheduled',
      },
    ];
    const rsvps: HomeRsvpRow[] = [
      {
        id: 'r1',
        sessionId: 's-outreach-going',
        studentId: 'student-1',
        status: 'going',
        updatedAt: '2026-07-15T00:00:00.000Z',
      },
      // No RSVP on s-outreach-unanswered -- must not appear in Next up.
    ];

    const result = buildNextUp(sessions, events, rsvps, 'student-1', 'team-a', REF_NOW_MS);
    const ids = result.map((row) => row.sessionId);
    expect(ids).toEqual(['s-meeting', 's-outreach-going']);
    expect(result.find((r) => r.sessionId === 's-outreach-going')?.isOutreachGoing).toBe(true);
    expect(result.find((r) => r.sessionId === 's-meeting')?.isOutreachGoing).toBe(false);
  });

  it('excludes sessions that have already ended', () => {
    const events: HomeEventRow[] = [
      {
        id: 'event-meeting',
        seasonId: 's1',
        type: 'meeting',
        title: 'Weekly Build',
        teamIds: null,
        countsVolunteerHours: false,
      },
    ];
    const sessions: HomeSessionRow[] = [
      {
        id: 's-ended',
        eventId: 'event-meeting',
        startsAt: '2026-07-18T23:00:00.000Z',
        endsAt: '2026-07-19T01:00:00.000Z',
        status: 'scheduled',
      },
    ];
    const result = buildNextUp(sessions, events, [], 'student-1', 'team-a', REF_NOW_MS);
    expect(result).toHaveLength(0);
  });
});

describe('getUnansweredOutreachOpportunities', () => {
  it('returns only future, team-scoped, outreach sessions with no RSVP row at all, oldest (earliest-starting) first', () => {
    const events: HomeEventRow[] = [
      {
        id: 'event-a',
        seasonId: 's1',
        type: 'outreach',
        title: 'Later Opportunity',
        teamIds: ['team-a'],
        countsVolunteerHours: true,
      },
      {
        id: 'event-b',
        seasonId: 's1',
        type: 'outreach',
        title: 'Sooner Opportunity',
        teamIds: ['team-a'],
        countsVolunteerHours: true,
      },
      {
        id: 'event-answered',
        seasonId: 's1',
        type: 'outreach',
        title: 'Already answered',
        teamIds: ['team-a'],
        countsVolunteerHours: true,
      },
      {
        id: 'event-meeting',
        seasonId: 's1',
        type: 'meeting',
        title: 'Not outreach -- must never appear',
        teamIds: ['team-a'],
        countsVolunteerHours: false,
      },
      {
        id: 'event-wrong-team',
        seasonId: 's1',
        type: 'outreach',
        title: 'Wrong team -- must never appear',
        teamIds: ['team-titans'],
        countsVolunteerHours: true,
      },
    ];
    const sessions: HomeSessionRow[] = [
      {
        id: 's-a',
        eventId: 'event-a',
        startsAt: '2026-08-01T15:00:00.000Z',
        endsAt: '2026-08-01T18:00:00.000Z',
        status: 'scheduled',
      },
      {
        id: 's-b',
        eventId: 'event-b',
        startsAt: '2026-07-25T15:00:00.000Z',
        endsAt: '2026-07-25T18:00:00.000Z',
        status: 'scheduled',
      },
      {
        id: 's-answered',
        eventId: 'event-answered',
        startsAt: '2026-07-24T15:00:00.000Z',
        endsAt: '2026-07-24T18:00:00.000Z',
        status: 'scheduled',
      },
      {
        id: 's-meeting',
        eventId: 'event-meeting',
        startsAt: '2026-07-24T15:00:00.000Z',
        endsAt: '2026-07-24T18:00:00.000Z',
        status: 'scheduled',
      },
      {
        id: 's-wrong-team',
        eventId: 'event-wrong-team',
        startsAt: '2026-07-24T15:00:00.000Z',
        endsAt: '2026-07-24T18:00:00.000Z',
        status: 'scheduled',
      },
    ];
    const rsvps: HomeRsvpRow[] = [
      {
        id: 'r1',
        sessionId: 's-answered',
        studentId: 'student-1',
        status: 'declined',
        updatedAt: '2026-07-01T00:00:00.000Z',
      },
    ];

    const result = getUnansweredOutreachOpportunities(
      sessions,
      events,
      rsvps,
      'student-1',
      'team-a',
      REF_NOW_MS,
    );
    expect(result.map((r) => r.sessionId)).toEqual(['s-b', 's-a']);
  });
});

describe('computePlannedHours / sessionHours', () => {
  it('sums duration hours only for scheduled, counts_volunteer_hours events with a going RSVP', () => {
    const events: HomeEventRow[] = [
      {
        id: 'event-going',
        seasonId: 's1',
        type: 'outreach',
        title: 'Going',
        teamIds: null,
        countsVolunteerHours: true,
      },
      {
        id: 'event-not-counted',
        seasonId: 's1',
        type: 'outreach',
        title: 'Does not count hours',
        teamIds: null,
        countsVolunteerHours: false,
      },
    ];
    const sessions: HomeSessionRow[] = [
      {
        id: 's-going-3h',
        eventId: 'event-going',
        startsAt: '2026-07-25T15:00:00.000Z',
        endsAt: '2026-07-25T18:00:00.000Z',
        status: 'scheduled',
      },
      {
        id: 's-not-counted',
        eventId: 'event-not-counted',
        startsAt: '2026-07-26T15:00:00.000Z',
        endsAt: '2026-07-26T18:00:00.000Z',
        status: 'scheduled',
      },
    ];
    const rsvps: HomeRsvpRow[] = [
      {
        id: 'r1',
        sessionId: 's-going-3h',
        studentId: 'student-1',
        status: 'going',
        updatedAt: '2026-07-01T00:00:00.000Z',
      },
      {
        id: 'r2',
        sessionId: 's-not-counted',
        studentId: 'student-1',
        status: 'going',
        updatedAt: '2026-07-01T00:00:00.000Z',
      },
    ];
    expect(computePlannedHours(sessions, events, rsvps, 'student-1')).toBe(3);
  });

  it('sessionHours computes ends_at - starts_at in hours', () => {
    expect(
      sessionHours({ startsAt: '2026-07-25T15:00:00.000Z', endsAt: '2026-07-25T18:00:00.000Z' }),
    ).toBe(3);
  });
});

describe('resolveGoalHours / hoursVsGoalPercent', () => {
  it('uses goalHoursOverride when present, otherwise the season default', () => {
    expect(resolveGoalHours(8, 100)).toBe(8);
    expect(resolveGoalHours(null, 100)).toBe(100);
  });
  it('computes a clamped percent, never re-deriving confirmedHours itself', () => {
    expect(hoursVsGoalPercent(62, 100)).toBe(62);
    expect(hoursVsGoalPercent(150, 100)).toBe(100);
    expect(hoursVsGoalPercent(5, 0)).toBe(0);
  });
});

describe('withLocalRsvpOverride', () => {
  it('synthesizes a new row when none existed, and updates an existing row otherwise', () => {
    const created = withLocalRsvpOverride([], 'student-1', 'session-1', 'going');
    expect(created).toHaveLength(1);
    expect(created[0]).toMatchObject({
      studentId: 'student-1',
      sessionId: 'session-1',
      status: 'going',
    });

    const updated = withLocalRsvpOverride(created, 'student-1', 'session-1', 'declined');
    expect(updated).toHaveLength(1);
    expect(updated[0].status).toBe('declined');
  });
});

// ---------------------------------------------------------------------------
// BEH-03 (checker-enforced) -- selectHeroState pure-function priority proof.
// ---------------------------------------------------------------------------

describe('selectHeroState (BEH-03 priority)', () => {
  it('prioritizes live check-in over unanswered RSVPs when both are true', () => {
    expect(selectHeroState(true, 2)).toBe('live-checkin');
  });
  it('falls back to unanswered-rsvp when there is no live session but there are unanswered opportunities', () => {
    expect(selectHeroState(false, 2)).toBe('unanswered-rsvp');
    expect(selectHeroState(false, 1)).toBe('unanswered-rsvp');
  });
  it('falls back to quiet-greeting when neither condition holds', () => {
    expect(selectHeroState(false, 0)).toBe('quiet-greeting');
  });
});

// ---------------------------------------------------------------------------
// BEH-03 (checker-enforced) -- real render proof across all three states:
// exactly one [data-variant="primary"] element, never two, and the correct
// hero content for each state.
// ---------------------------------------------------------------------------

function buildDataFixture(overrides: Partial<StudentHomeData>): StudentHomeData {
  return {
    seasonId: 'season-1',
    displayName: 'Ada Reyes',
    defaultGoalHours: 100,
    goalHoursOverride: null,
    events: [],
    sessions: [],
    rsvps: [],
    studentHours: { studentId: 'student-1', seasonId: 'season-1', confirmedHours: 62 },
    participation: null,
    ...overrides,
  };
}

const LIVE_MEETING_EVENT: HomeEventRow = {
  id: 'event-live-meeting',
  seasonId: 'season-1',
  type: 'meeting',
  title: 'Weekly Build Meeting',
  teamIds: null,
  countsVolunteerHours: false,
};

const LIVE_MEETING_SESSION: HomeSessionRow = {
  id: 'session-live-meeting',
  eventId: 'event-live-meeting',
  startsAt: '2026-07-19T11:30:00.000Z',
  endsAt: '2026-07-19T13:30:00.000Z',
  status: 'scheduled',
};

const UNANSWERED_EVENT: HomeEventRow = {
  id: 'event-unanswered-outreach',
  seasonId: 'season-1',
  type: 'outreach',
  title: 'Library Demo',
  teamIds: null,
  countsVolunteerHours: true,
};

const UNANSWERED_SESSION: HomeSessionRow = {
  id: 'session-unanswered-outreach',
  eventId: 'event-unanswered-outreach',
  startsAt: '2026-07-25T20:00:00.000Z',
  endsAt: '2026-07-25T22:00:00.000Z',
  status: 'scheduled',
};

describe('StudentHome render -- BEH-03 exactly-one-primary-CTA across all three hero states', () => {
  it('state 1: live session AND unanswered RSVPs -- shows ONLY the live check-in card as hero, never both', async () => {
    const loadData = async (): Promise<StudentHomeData> =>
      buildDataFixture({
        events: [LIVE_MEETING_EVENT, UNANSWERED_EVENT],
        sessions: [LIVE_MEETING_SESSION, UNANSWERED_SESSION],
        rsvps: [],
      });

    renderAsUser(STUDENT_USER, { loadData, nowFn: () => FIXTURE_REFERENCE_NOW });
    await flushMicrotasks();

    expect(container.textContent).toContain('Meeting live now');
    expect(container.textContent).not.toContain('events to answer');
    expect(primaryButtons()).toHaveLength(1);
    expect(primaryButtons()[0]?.textContent).toContain('Check in');
  });

  it('state 2: no live session, but unanswered RSVPs exist -- shows ONLY the "events to answer" hero', async () => {
    const loadData = async (): Promise<StudentHomeData> =>
      buildDataFixture({
        events: [UNANSWERED_EVENT],
        sessions: [UNANSWERED_SESSION],
        rsvps: [],
      });

    renderAsUser(STUDENT_USER, { loadData, nowFn: () => FIXTURE_REFERENCE_NOW });
    await flushMicrotasks();

    expect(container.textContent).not.toContain('Meeting live now');
    expect(container.textContent).toContain('You have 1 event to answer');
    expect(primaryButtons()).toHaveLength(1);
    expect(primaryButtons()[0]?.textContent).toContain('Review sign-up opportunities');
  });

  it('state 3: no live session, no unanswered RSVPs -- quiet greeting, zero primary CTAs', async () => {
    const loadData = async (): Promise<StudentHomeData> => buildDataFixture({});

    renderAsUser(STUDENT_USER, { loadData, nowFn: () => FIXTURE_REFERENCE_NOW });
    await flushMicrotasks();

    expect(container.textContent).not.toContain('Meeting live now');
    expect(container.textContent).not.toContain('events to answer');
    expect(container.textContent).toContain("You're all caught up. Nothing needs your attention");
    expect(primaryButtons()).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// BEH-02 -- confirmed/planned hours never summed into one number.
// ---------------------------------------------------------------------------

describe('StudentHome render -- BEH-02 confirmed/planned hours never summed', () => {
  it('renders confirmed and planned hours as two distinct numbers, never their sum', async () => {
    const goingOutreachEvent: HomeEventRow = {
      id: 'event-planned',
      seasonId: 'season-1',
      type: 'outreach',
      title: 'Park Cleanup',
      teamIds: null,
      countsVolunteerHours: true,
    };
    const goingOutreachSession: HomeSessionRow = {
      id: 'session-planned',
      eventId: 'event-planned',
      startsAt: '2026-07-25T15:00:00.000Z',
      endsAt: '2026-07-25T18:00:00.000Z', // 3h
      status: 'scheduled',
    };
    const goingRsvp: HomeRsvpRow = {
      id: 'r-planned',
      sessionId: 'session-planned',
      studentId: PLACEHOLDER_CURRENT_STUDENT_ID,
      status: 'going',
      updatedAt: '2026-07-01T00:00:00.000Z',
    };

    const loadData = async (): Promise<StudentHomeData> =>
      buildDataFixture({
        studentHours: { studentId: 'student-1', seasonId: 'season-1', confirmedHours: 62 },
        events: [goingOutreachEvent],
        sessions: [goingOutreachSession],
        rsvps: [goingRsvp],
      });

    renderAsUser(STUDENT_USER, {
      loadData,
      studentId: PLACEHOLDER_CURRENT_STUDENT_ID,
      nowFn: () => FIXTURE_REFERENCE_NOW,
    });
    await flushMicrotasks();

    // Both real numbers appear...
    expect(container.textContent).toContain('62 h confirmed');
    expect(container.textContent).toContain('3 h planned');
    // ...and the sum (65) never appears anywhere as a combined figure.
    expect(container.textContent).not.toContain('65 h');
  });
});

// ---------------------------------------------------------------------------
// DES-12 states + default fixture render + inline Sign up / Can't go.
// ---------------------------------------------------------------------------

describe('StudentHome DES-12 states', () => {
  it('shows a sign-in prompt when signed out', () => {
    renderAsUser(null);
    expect(container.textContent).toContain('Sign in to view Home');
  });

  it('shows a spinner while loading', () => {
    renderAsUser(STUDENT_USER, { loadData: () => new Promise(() => {}) });
    expect(container.textContent).toContain('Loading Home');
  });

  it('shows an error banner when loadData rejects', async () => {
    renderAsUser(STUDENT_USER, {
      loadData: async () => {
        throw new Error('boom');
      },
    });
    await flushMicrotasks();
    expect(container.textContent).toContain("Couldn't load Home");
  });

  it('renders the shipped default fixture data end to end', async () => {
    renderAsUser(STUDENT_USER, {
      loadData: defaultLoadStudentHomeData,
      studentId: PLACEHOLDER_CURRENT_STUDENT_ID,
      teamId: PLACEHOLDER_CURRENT_TEAM_ID,
      nowFn: () => FIXTURE_REFERENCE_NOW,
    });
    await flushMicrotasks();

    expect(container.textContent).toContain('Hi Ada Reyes');
    expect(container.textContent).toContain('62 h confirmed');
    expect(container.textContent).toContain('Participation: 87.5%');
    expect(container.textContent).toContain('Weekly Build Meeting');
    expect(container.textContent).toContain('STEM Fair');
    expect(container.textContent).toContain('Library Demo');
  });
});

describe("StudentHome inline Sign up / Can't go (real local-state update, not persisted)", () => {
  it('clicking "Sign up" removes the opportunity from Sign-up opportunities', async () => {
    const loadData = async (): Promise<StudentHomeData> =>
      buildDataFixture({
        events: [UNANSWERED_EVENT],
        sessions: [UNANSWERED_SESSION],
        rsvps: [],
      });

    renderAsUser(STUDENT_USER, { loadData, nowFn: () => FIXTURE_REFERENCE_NOW });
    await flushMicrotasks();

    expect(container.textContent).toContain('Library Demo');
    const signUpButton = findButtonByText('Sign up');
    expect(signUpButton).toBeDefined();

    act(() => {
      signUpButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    await flushMicrotasks();

    expect(container.textContent).toContain("You're all caught up");
  });
});

// ---------------------------------------------------------------------------
// Live check-in card -- reuses T032's contract shape (module doc #5).
// ---------------------------------------------------------------------------

describe('LiveCheckInCard check-in flow', () => {
  it('submits {sessionId, code} through the injected submitCheckinCode and shows a success Banner', async () => {
    const submitCheckinCode = vi.fn(async (): Promise<CheckinSubmitResult> => ({
      ok: true,
      alreadyCheckedIn: false,
      attendance: { status: 'present', checkInAt: '2026-07-19T12:05:00.000Z' },
    }));

    const loadData = async (): Promise<StudentHomeData> =>
      buildDataFixture({
        events: [LIVE_MEETING_EVENT],
        sessions: [LIVE_MEETING_SESSION],
        rsvps: [],
      });

    renderAsUser(STUDENT_USER, {
      loadData,
      submitCheckinCode,
      nowFn: () => FIXTURE_REFERENCE_NOW,
    });
    await flushMicrotasks();

    const input = container.querySelector('input') as HTMLInputElement;
    expect(input).toBeTruthy();
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
    act(() => {
      setter?.call(input, 'abc123');
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });

    const checkInButton = findButtonByText('Check in');
    expect(checkInButton?.hasAttribute('disabled')).toBe(false);

    await act(async () => {
      checkInButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(submitCheckinCode).toHaveBeenCalledWith({
      sessionId: 'session-live-meeting',
      code: 'ABC123',
    });
    expect(container.textContent).toContain("You're in");
  });

  it('shows the server-authored error message verbatim on failure', async () => {
    const submitCheckinCode = vi.fn(async (): Promise<CheckinSubmitResult> => ({
      ok: false,
      error: {
        code: 'CHECKIN_EXPIRED',
        message: 'That code has expired. Ask your coach for a new one.',
      },
    }));

    const loadData = async (): Promise<StudentHomeData> =>
      buildDataFixture({
        events: [LIVE_MEETING_EVENT],
        sessions: [LIVE_MEETING_SESSION],
        rsvps: [],
      });

    renderAsUser(STUDENT_USER, {
      loadData,
      submitCheckinCode,
      nowFn: () => FIXTURE_REFERENCE_NOW,
    });
    await flushMicrotasks();

    const input = container.querySelector('input') as HTMLInputElement;
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
    act(() => {
      setter?.call(input, 'XYZ999');
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });

    const checkInButton = findButtonByText('Check in');
    await act(async () => {
      checkInButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(container.textContent).toContain('That code has expired. Ask your coach for a new one.');
  });
});
