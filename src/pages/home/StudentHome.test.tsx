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
import { act, Component, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import type { SupabaseClient } from '@supabase/supabase-js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthProvider, type AuthUser } from '../../app/guards';
import { LoginAs } from '../../test-utils/authHarness';
import { SeasonProvider, type LoadActiveSeasonFn } from '../../app/SeasonProvider';
import type { SeasonRow } from '../../lib/supabase/types';
// T183 -- the real, `getSupabaseClient()`-backed production `loadData`
// default (`StudentHome.tsx:1763`'s new value). Imported here ONLY to
// construct the criterion-11 test's own direct-DI proof against a stubbed
// client (see "Proving the wiring for real", T183 worker packet) -- every
// OTHER `it(` in this file keeps using the harness's `defaultLoadStudentHomeData`
// default (`renderAsUser`'s own `mergedProps`, below) unchanged.
import { makeLoadStudentHomeData } from '../../lib/supabase/loaders/students';
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
  resolveStudentIdentity,
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
//
// T176: `StudentHome` now calls `useActiveSeason()` (module doc #8/#9 in
// `StudentHome.tsx`), so every render needs a `<SeasonProvider>` ancestor --
// same T155 shape `CoachHome.test.tsx`'s own harness already established for
// its sibling Home component. `StudentHome` also now resolves real
// `studentId`/`teamId`/`goalHoursOverride` via injectable
// `resolveStudentId`/`resolveStudentScope` props (module doc #8) whenever
// the caller does not supply BOTH `studentId` and `teamId` explicitly --
// `renderAsUser` below defaults both resolvers to distinguishable fixture
// values so every pre-existing `it(` (none of which relied on a specific
// resolved id) keeps passing unmodified; only the new criterion 1-4/6/7/10/11
// tests below override one or both explicitly.
// ---------------------------------------------------------------------------

let container: HTMLDivElement;
let root: Root;

const STUDENT_USER: AuthUser = {
  id: 'user-student',
  email: 'student@example.com',
  role: 'student',
};

const FIXTURE_ACTIVE_SEASON: SeasonRow = {
  id: 'season-fixture-active',
  name: 'Fixture Active Season',
  startsOn: '2026-01-01',
  endsOn: '2026-12-31',
  defaultGoalHours: 100,
  isActive: true,
  createdAt: '2026-01-01T00:00:00.000Z',
};

const HARNESS_DEFAULT_RESOLVED_STUDENT_ID = 'student-fixture-harness-default';
const HARNESS_DEFAULT_RESOLVED_TEAM_ID = 'team-fixture-harness-default';

/**
 * T176: `loadActiveSeason` is a new optional third parameter (default
 * resolves `FIXTURE_ACTIVE_SEASON` quickly, matching every pre-existing
 * `it(`'s implicit expectation) -- every call site that predates this task
 * still calls `renderAsUser(user, props)` with exactly two arguments, so
 * this default applies there unchanged; only the new criterion 6/10 tests
 * below pass a third argument. `resolveStudentId`/`resolveStudentScope`
 * default inside `props` (spread AFTER the harness defaults, so an
 * individual test's own override always wins) to distinguishable fixture
 * resolvers -- neither is the same value as `PLACEHOLDER_CURRENT_STUDENT_ID`/
 * `PLACEHOLDER_CURRENT_TEAM_ID` (criterion 1/3's own "must not be the
 * retired placeholder" discipline, applied to the harness default too).
 */
function renderAsUser(
  user: AuthUser | null,
  props: Parameters<typeof StudentHome>[0] = {},
  loadActiveSeason: LoadActiveSeasonFn = async () => FIXTURE_ACTIVE_SEASON,
): void {
  const mergedProps: Parameters<typeof StudentHome>[0] = {
    resolveStudentId: async () => HARNESS_DEFAULT_RESOLVED_STUDENT_ID,
    resolveStudentScope: async () => ({
      teamId: HARNESS_DEFAULT_RESOLVED_TEAM_ID,
      // T187: single-element array mirroring the single legacy teamId above
      // -- every pre-existing `it(` in this file keeps its exact original
      // (single-team) behavior unchanged.
      teamIds: [HARNESS_DEFAULT_RESOLVED_TEAM_ID],
      goalHours: 100,
      confirmedHours: 0,
      plannedHours: 0,
    }),
    // T183 -- `StudentHome.tsx:1763`'s own production default (`loadData`)
    // is now the real, `getSupabaseClient()`-backed
    // `loadStudentHomeData` (`loaders/students.ts`), which throws
    // `SupabaseNotConfiguredError` in this jsdom test environment. Every
    // pre-existing `it(` in this file that doesn't already inject its own
    // `loadData` implicitly relied on the OLD fixture-fed default -- default
    // this harness to the still-untouched, still-exported
    // `defaultLoadStudentHomeData` so every one of those tests keeps its
    // exact original behavior, zero content changes. An individual test's
    // own `props.loadData` (spread after, below) always wins.
    loadData: defaultLoadStudentHomeData,
    ...props,
  };
  act(() => {
    root.render(
      <SeasonProvider loadActiveSeason={loadActiveSeason}>
        <AuthProvider>
          {user === null ? (
            <StudentHome {...mergedProps} />
          ) : (
            <LoginAs user={user}>
              <StudentHome {...mergedProps} />
            </LoginAs>
          )}
        </AuthProvider>
      </SeasonProvider>,
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

// T176 -- pre-existing "renders the shipped default fixture data end to
// end" / T129 "populated branch" tests both pass `defaultLoadStudentHomeData`
// DIRECTLY (not wrapped) with explicit `studentId`/`teamId` (identity tier
// skipped). `defaultLoadStudentHomeData`'s own `FIXTURE_EVENTS` are
// hardcoded to the (module-private) literal `PLACEHOLDER_SEASON_ID` --
// harmless before this task (the pre-T176 default `seasonId` parameter WAS
// that literal), but now that `seasonId` is genuinely
// `useActiveSeason().season.id` (this harness's own
// `FIXTURE_ACTIVE_SEASON.id`, a real non-placeholder id), the two no longer
// match and `FIXTURE_EVENTS.filter((event) => event.seasonId === seasonId)`
// would silently return `[]`. Mirrors `CoachHome.test.tsx`'s own
// pre-existing (T053-era, predating T155) `fixtureLoadData`/
// `PLACEHOLDER_SEASON_ID_FOR_TESTS` convention exactly, for the identical
// reason -- a `loadData` VALUE change in the two affected tests' own props,
// not an assertion change (T176 worker output discloses this explicitly).
const PLACEHOLDER_SEASON_ID_FOR_TESTS = 'season-placeholder-current';
function fixtureLoadData(studentId: string): Promise<StudentHomeData> {
  return defaultLoadStudentHomeData(studentId, PLACEHOLDER_SEASON_ID_FOR_TESTS);
}

// ---------------------------------------------------------------------------
// Pure functions
// ---------------------------------------------------------------------------

describe('isEventInTeamScope', () => {
  it('treats teamIds === null as "all teams"', () => {
    expect(isEventInTeamScope({ teamIds: null }, ['team-a'])).toBe(true);
  });
  it('excludes a team not present in teamIds', () => {
    expect(isEventInTeamScope({ teamIds: ['team-b'] }, ['team-a'])).toBe(false);
  });
  it('includes a team present in teamIds', () => {
    expect(isEventInTeamScope({ teamIds: ['team-a', 'team-b'] }, ['team-a'])).toBe(true);
  });
  // T187 -- the student's own active-team set is now plural (a dual-team
  // student), not a single id. New coverage, not a shape edit of the three
  // single-id cases above.
  it("includes an event that shares AT LEAST ONE id with a dual-team student's active set", () => {
    expect(isEventInTeamScope({ teamIds: ['team-b'] }, ['team-a', 'team-b'])).toBe(true);
  });
  it("excludes an event whose team is in neither of the student's two active teams", () => {
    expect(isEventInTeamScope({ teamIds: ['team-c'] }, ['team-a', 'team-b'])).toBe(false);
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
    const result = selectLiveMeetingSession(sessions, events, ['team-a'], REF_NOW_MS);
    expect(result?.id).toBe('session-meeting-live');
  });

  it('returns null when nothing is live', () => {
    const result = selectLiveMeetingSession(
      sessions,
      events,
      ['team-a'],
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

    const result = buildNextUp(sessions, events, rsvps, 'student-1', ['team-a'], REF_NOW_MS);
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
    const result = buildNextUp(sessions, events, [], 'student-1', ['team-a'], REF_NOW_MS);
    expect(result).toHaveLength(0);
  });

  // T187 -- a dual-team student's Next up includes BOTH teams' meetings, not
  // just the first.
  it("includes meetings from BOTH of a dual-team student's active teams, excludes a third team", () => {
    const events: HomeEventRow[] = [
      {
        id: 'event-team-a',
        seasonId: 's1',
        type: 'meeting',
        title: 'Team A Meeting',
        teamIds: ['team-dual-a'],
        countsVolunteerHours: false,
      },
      {
        id: 'event-team-b',
        seasonId: 's1',
        type: 'meeting',
        title: 'Team B Meeting',
        teamIds: ['team-dual-b'],
        countsVolunteerHours: false,
      },
      {
        id: 'event-team-c',
        seasonId: 's1',
        type: 'meeting',
        title: 'Team C Meeting (neither active team)',
        teamIds: ['team-dual-c'],
        countsVolunteerHours: false,
      },
    ];
    const sessions: HomeSessionRow[] = [
      {
        id: 's-team-a',
        eventId: 'event-team-a',
        startsAt: '2026-07-21T23:00:00.000Z',
        endsAt: '2026-07-22T01:00:00.000Z',
        status: 'scheduled',
      },
      {
        id: 's-team-b',
        eventId: 'event-team-b',
        startsAt: '2026-07-22T23:00:00.000Z',
        endsAt: '2026-07-23T01:00:00.000Z',
        status: 'scheduled',
      },
      {
        id: 's-team-c',
        eventId: 'event-team-c',
        startsAt: '2026-07-23T23:00:00.000Z',
        endsAt: '2026-07-24T01:00:00.000Z',
        status: 'scheduled',
      },
    ];
    const result = buildNextUp(
      sessions,
      events,
      [],
      'student-1',
      ['team-dual-a', 'team-dual-b'],
      REF_NOW_MS,
    );
    expect(result.map((row) => row.sessionId)).toEqual(['s-team-a', 's-team-b']);
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
      ['team-a'],
      REF_NOW_MS,
    );
    expect(result.map((r) => r.sessionId)).toEqual(['s-b', 's-a']);
  });

  // T187 -- a dual-team student's Sign-up opportunities include BOTH teams'
  // unanswered outreach, excludes a third team.
  it("includes unanswered outreach from BOTH of a dual-team student's active teams, excludes a third team", () => {
    const events: HomeEventRow[] = [
      {
        id: 'event-team-a',
        seasonId: 's1',
        type: 'outreach',
        title: 'Team A Outreach',
        teamIds: ['team-dual-a'],
        countsVolunteerHours: true,
      },
      {
        id: 'event-team-b',
        seasonId: 's1',
        type: 'outreach',
        title: 'Team B Outreach',
        teamIds: ['team-dual-b'],
        countsVolunteerHours: true,
      },
      {
        id: 'event-team-c',
        seasonId: 's1',
        type: 'outreach',
        title: 'Team C Outreach (neither active team)',
        teamIds: ['team-dual-c'],
        countsVolunteerHours: true,
      },
    ];
    const sessions: HomeSessionRow[] = [
      {
        id: 's-team-a',
        eventId: 'event-team-a',
        startsAt: '2026-07-21T23:00:00.000Z',
        endsAt: '2026-07-22T01:00:00.000Z',
        status: 'scheduled',
      },
      {
        id: 's-team-b',
        eventId: 'event-team-b',
        startsAt: '2026-07-22T23:00:00.000Z',
        endsAt: '2026-07-23T01:00:00.000Z',
        status: 'scheduled',
      },
      {
        id: 's-team-c',
        eventId: 'event-team-c',
        startsAt: '2026-07-23T23:00:00.000Z',
        endsAt: '2026-07-24T01:00:00.000Z',
        status: 'scheduled',
      },
    ];
    const result = getUnansweredOutreachOpportunities(
      sessions,
      events,
      [],
      'student-1',
      ['team-dual-a', 'team-dual-b'],
      REF_NOW_MS,
    );
    expect(result.map((r) => r.sessionId)).toEqual(['s-team-a', 's-team-b']);
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

    // T176 round 2: `events`/`sessions`/`rsvps` above (a 3h going-RSVP'd
    // outreach session) are kept for "Next up" section coverage, but no
    // longer drive the confirmed/planned hours legend -- `confirmedHours`/
    // `plannedHours` are now verbatim `resolveStudentScope` passthroughs
    // (`v_student_goal_projection`'s own columns), injected directly below,
    // not derived from `data.studentHours`/`computePlannedHours(...)`
    // anymore (still-fixture, unrelated `loadData` fields).
    const loadData = async (): Promise<StudentHomeData> =>
      buildDataFixture({
        studentHours: { studentId: 'student-1', seasonId: 'season-1', confirmedHours: 999 },
        events: [goingOutreachEvent],
        sessions: [goingOutreachSession],
        rsvps: [goingRsvp],
      });

    renderAsUser(STUDENT_USER, {
      loadData,
      studentId: PLACEHOLDER_CURRENT_STUDENT_ID,
      resolveStudentScope: async () => ({
        teamIds: ['team-fixture-beh02'],
        goalHours: 100,
        confirmedHours: 62,
        plannedHours: 3,
      }),
      nowFn: () => FIXTURE_REFERENCE_NOW,
    });
    await flushMicrotasks();

    // Both real numbers appear...
    expect(container.textContent).toContain('62 h confirmed');
    expect(container.textContent).toContain('3 h planned');
    // ...and the sum (65) never appears anywhere as a combined figure.
    expect(container.textContent).not.toContain('65 h');
    // Never the still-fixture loadData's own (deliberately different,
    // unused) confirmedHours value -- proves this legend genuinely reads
    // from resolveStudentScope, not data.studentHours.
    expect(container.textContent).not.toContain('999');
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

  it('shows a spinner while loading', async () => {
    renderAsUser(STUDENT_USER, { loadData: () => new Promise(() => {}) });
    // T073b2: auth resolution (even via the fake `authModule` this
    // harness's `LoginAs` now uses) is genuinely async -- a flush is needed
    // before the authenticated body (and its own DES-12 loading state)
    // mounts. See `src/test-utils/authHarness.tsx`'s module doc.
    await flushMicrotasks();
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
    // T176 round 2: `teamId` is no longer passed explicitly here -- an
    // explicit `teamId` now takes the `resolveStudentIdentity` bypass path
    // unconditionally (goalHours/confirmedHours/plannedHours default to
    // seasonDefaultGoalHours/0/0, never consulting `resolveStudentScope` at
    // all), which would make "62 h confirmed" structurally unreachable.
    // `resolveStudentScope` is injected directly instead, matching the same
    // fixture values `defaultLoadStudentHomeData`'s own (still-fixture)
    // `studentHours`/`FIXTURE_DEFAULT_GOAL_HOURS` used to supply, and the
    // same `PLACEHOLDER_CURRENT_TEAM_ID` scope so STEM Fair/Library Demo
    // (both team-scoped to that id) keep rendering.
    renderAsUser(STUDENT_USER, {
      loadData: fixtureLoadData,
      studentId: PLACEHOLDER_CURRENT_STUDENT_ID,
      resolveStudentScope: async () => ({
        teamIds: [PLACEHOLDER_CURRENT_TEAM_ID],
        goalHours: 100,
        confirmedHours: 62,
        plannedHours: 3,
      }),
      nowFn: () => FIXTURE_REFERENCE_NOW,
    });
    await flushMicrotasks();

    expect(container.textContent).toContain('Hi Ada Reyes');
    expect(container.textContent).toContain('62 h confirmed');
    expect(container.textContent).toContain('3 h planned');
    expect(container.textContent).toContain('Participation: 87.5%');
    expect(container.textContent).toContain('Weekly Build Meeting');
    expect(container.textContent).toContain('STEM Fair');
    expect(container.textContent).toContain('Library Demo');
  });
});

// ---------------------------------------------------------------------------
// T129/UXC-01: one heading per section. The `List`'s own `header` prop was
// removed from both "Next up" and "Sign-up opportunities" (it used to print
// the section title a second time, per `List.tsx:194-201`); each `Heading`
// now carries a `useId`-generated id, and a `<div role="group">` wrapping
// the List/EmptyState ternary carries `aria-labelledby={headingId}` --
// present in BOTH branches, so the region's accessible name survives even
// when there is no `List` to attach a `header` to.
//
// CHECKER FIX (rework of T129, MAJOR): see `CoachHome.test.tsx`'s own
// comment for the full rationale -- the wrapper was originally an Astryx
// `Section` (full-bleed negative margin + no nameable role); it is now a
// plain `<div role="group">`, and the query below includes `role="group"`
// so a regression back to a role-less wrapper fails the lookup itself.
// ---------------------------------------------------------------------------
describe('<StudentHome /> T129 UXC-01 -- exactly one heading per section, List/EmptyState region takes its accessible name from the Heading', () => {
  function resolveAriaLabelledbyTarget(headingText: string): {
    headingId: string;
    resolvedText: string | null;
  } {
    const heading = Array.from(container.querySelectorAll('h2')).find(
      (h) => h.textContent === headingText,
    );
    expect(heading).toBeTruthy();
    const headingId = heading!.id;
    expect(headingId).toBeTruthy();
    const labelledEl = container.querySelector(`[role="group"][aria-labelledby="${headingId}"]`);
    expect(labelledEl).toBeTruthy();
    expect(labelledEl!.getAttribute('role')).toBe('group');
    const resolvedId = labelledEl!.getAttribute('aria-labelledby')!;
    const resolvedEl = document.getElementById(resolvedId);
    return { headingId, resolvedText: resolvedEl?.textContent ?? null };
  }

  const SECTION_TITLES = ['Next up', 'Sign-up opportunities'] as const;

  it('populated branch: both sections resolve aria-labelledby back to their own Heading, and each title prints exactly once', async () => {
    renderAsUser(STUDENT_USER, {
      loadData: fixtureLoadData,
      studentId: PLACEHOLDER_CURRENT_STUDENT_ID,
      teamId: PLACEHOLDER_CURRENT_TEAM_ID,
      nowFn: () => FIXTURE_REFERENCE_NOW,
    });
    await flushMicrotasks();

    for (const title of SECTION_TITLES) {
      const { resolvedText } = resolveAriaLabelledbyTarget(title);
      expect(resolvedText).toBe(title);
      const leafMatches = Array.from(container.querySelectorAll('*')).filter(
        (el) => el.children.length === 0 && el.textContent === title,
      );
      expect(leafMatches.length).toBe(1);
    }
  });

  it('empty branch: aria-labelledby still resolves to the Heading for both sections, even with no List rendered', async () => {
    const loadData = async (): Promise<StudentHomeData> => buildDataFixture({});
    renderAsUser(STUDENT_USER, { loadData, nowFn: () => FIXTURE_REFERENCE_NOW });
    await flushMicrotasks();

    // Confirm the EmptyState branch is really the one rendered.
    expect(container.textContent).toContain('Nothing scheduled');
    expect(container.textContent).toContain("You're all caught up");

    for (const title of SECTION_TITLES) {
      const { resolvedText } = resolveAriaLabelledbyTarget(title);
      expect(resolvedText).toBe(title);
    }
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

// ---------------------------------------------------------------------------
// T176 -- real studentId/teamId/seasonId resolution. Criteria 1-4/6/7/10/11
// (criterion 5 is proven by the pre-existing "shows a sign-in prompt when
// signed out" test above, rendered synchronously with no flush -- see that
// test and this task's own worker output for the mutation record; criterion
// 5b is structural, not mutation-provable, per the packet's own
// classification -- documented in the worker output, not tested here).
// ---------------------------------------------------------------------------

const FIXTURE_VIEWER = { id: 'user-student', role: 'student' as const };

describe('resolveStudentIdentity (pure-ish, directly testable, same posture buildNextUp/selectHeroState establish)', () => {
  it('skips resolveStudentId entirely when explicitStudentId is given, and resolves scope for it', async () => {
    const resolveStudentId = vi.fn(async () => 'should-never-be-called');
    const resolveStudentScope = vi.fn(async () => ({
      teamIds: ['team-x'],
      goalHours: 5,
      confirmedHours: 2,
      plannedHours: 1,
    }));
    const result = await resolveStudentIdentity(
      FIXTURE_VIEWER,
      'student-explicit',
      undefined,
      resolveStudentId,
      resolveStudentScope,
      100,
    );
    expect(resolveStudentId).not.toHaveBeenCalled();
    expect(resolveStudentScope).toHaveBeenCalledWith('student-explicit');
    expect(result).toEqual({
      kind: 'linked',
      studentId: 'student-explicit',
      teamIds: ['team-x'],
      goalHours: 5,
      confirmedHours: 2,
      plannedHours: 1,
    });
  });

  it('skips resolveStudentScope entirely when explicitTeamId is given -- goalHours falls back to seasonDefaultGoalHours, confirmed/planned default to 0', async () => {
    const resolveStudentId = vi.fn(async () => 'student-resolved');
    const resolveStudentScope = vi.fn(async () => ({
      teamIds: ['should-never-be-used'],
      goalHours: 99,
      confirmedHours: 99,
      plannedHours: 99,
    }));
    const result = await resolveStudentIdentity(
      FIXTURE_VIEWER,
      undefined,
      'team-explicit',
      resolveStudentId,
      resolveStudentScope,
      42,
    );
    expect(resolveStudentScope).not.toHaveBeenCalled();
    expect(resolveStudentId).toHaveBeenCalledWith(FIXTURE_VIEWER);
    expect(result).toEqual({
      kind: 'linked',
      studentId: 'student-resolved',
      // T187: the explicit-teamId bypass has no scope read to draw an
      // active set from -- `[explicitTeamId]` is the production code's own
      // honest single-team equivalent (StudentHome.tsx's own
      // resolveStudentIdentity, explicitTeamId branch).
      teamIds: ['team-explicit'],
      goalHours: 42,
      confirmedHours: 0,
      plannedHours: 0,
    });
  });

  it('resolves nothing explicit -- calls both real seams, verbatim passthrough (no coalesce/arithmetic applied here)', async () => {
    const resolveStudentId = vi.fn(async () => 'student-resolved');
    const resolveStudentScope = vi.fn(async () => ({
      teamIds: ['team-resolved', 'team-resolved-second'],
      goalHours: 3,
      confirmedHours: 1.5,
      plannedHours: 0.5,
    }));
    const result = await resolveStudentIdentity(
      FIXTURE_VIEWER,
      undefined,
      undefined,
      resolveStudentId,
      resolveStudentScope,
      100,
    );
    expect(resolveStudentId).toHaveBeenCalledWith(FIXTURE_VIEWER);
    expect(resolveStudentScope).toHaveBeenCalledWith('student-resolved');
    expect(result).toEqual({
      kind: 'linked',
      studentId: 'student-resolved',
      teamIds: ['team-resolved', 'team-resolved-second'],
      goalHours: 3,
      confirmedHours: 1.5,
      plannedHours: 0.5,
    });
  });

  it('returns {kind: "not-linked"} when resolveStudentId resolves null, without calling resolveStudentScope', async () => {
    const resolveStudentId = vi.fn(async () => null);
    const resolveStudentScope = vi.fn(async () => ({
      teamIds: ['team-x'],
      goalHours: 100,
      confirmedHours: 0,
      plannedHours: 0,
    }));
    const result = await resolveStudentIdentity(
      FIXTURE_VIEWER,
      undefined,
      undefined,
      resolveStudentId,
      resolveStudentScope,
      100,
    );
    expect(result).toStrictEqual({ kind: 'not-linked' });
    expect(resolveStudentScope).not.toHaveBeenCalled();
  });

  // T184: this used to describe (and assert) the exact bug this task
  // removes -- a real, linked studentId whose resolveStudentScope resolves
  // null used to collapse into the SAME `null` (and therefore the SAME
  // "no student linked" copy) as the case above. Renamed to describe the
  // new, distinct `{kind: 'inactive'}` outcome it now asserts.
  it('returns {kind: "inactive"} when resolveStudentScope resolves null for a real, resolved studentId (deactivated student, not "no student linked")', async () => {
    const resolveStudentScope = vi.fn(async () => null);
    const result = await resolveStudentIdentity(
      FIXTURE_VIEWER,
      'student-explicit',
      undefined,
      vi.fn(async () => 'unused'),
      resolveStudentScope,
      100,
    );
    expect(result).toStrictEqual({ kind: 'inactive' });
    expect(resolveStudentScope).toHaveBeenCalledWith('student-explicit');
  });
});

describe('<StudentHome /> T176 -- real studentId reaches loadData (criterion 1)', () => {
  it('loadData is called with exactly the injected resolveStudentId result, never the retired placeholder', async () => {
    const loadDataSpy = vi.fn<(studentId: string, seasonId: string) => Promise<StudentHomeData>>(
      () => new Promise<StudentHomeData>(() => {}),
    );
    renderAsUser(STUDENT_USER, {
      loadData: loadDataSpy,
      resolveStudentId: async () => 'student-fixture-resolved',
    });
    await flushMicrotasks();
    expect(loadDataSpy).toHaveBeenCalledTimes(1);
    expect(loadDataSpy.mock.calls[0]?.[0]).toBe('student-fixture-resolved');
    expect(loadDataSpy.mock.calls[0]?.[0]).not.toBe(PLACEHOLDER_CURRENT_STUDENT_ID);
  });
});

describe('<StudentHome /> T176 -- explicit studentId bypasses resolveStudentId, paired (criterion 2, BLOCKER 2 fix)', () => {
  it('(a) resolveStudentId is never called AND (b) loadData receives the explicit value with distinguishable rendered content across two explicit ids', async () => {
    const resolveStudentIdSpy = vi.fn(async () => 'student-should-never-be-used');
    const loadDataByStudent = async (studentId: string): Promise<StudentHomeData> =>
      buildDataFixture({ displayName: `Student ${studentId}` });

    renderAsUser(STUDENT_USER, {
      loadData: loadDataByStudent,
      studentId: 'student-explicit-alpha',
      resolveStudentId: resolveStudentIdSpy,
      nowFn: () => FIXTURE_REFERENCE_NOW,
    });
    await flushMicrotasks();
    expect(resolveStudentIdSpy).not.toHaveBeenCalled();
    expect(container.textContent).toContain('Hi Student student-explicit-alpha');

    renderAsUser(STUDENT_USER, {
      loadData: loadDataByStudent,
      studentId: 'student-explicit-beta',
      resolveStudentId: resolveStudentIdSpy,
      nowFn: () => FIXTURE_REFERENCE_NOW,
    });
    await flushMicrotasks();
    expect(resolveStudentIdSpy).not.toHaveBeenCalled();
    expect(container.textContent).toContain('Hi Student student-explicit-beta');
    expect(container.textContent).not.toContain('student-explicit-alpha');
  });
});

describe('<StudentHome /> T176 -- real, resolved teamId reaches team-scoped widgets, three distinct non-placeholder strings (criterion 3, BLOCKER 1 fix)', () => {
  it("the in-scope event renders and the differently-teamed excluded event does not -- NOT this file's own shipped Titans fixture", async () => {
    const inScopeEvent: HomeEventRow = {
      id: 'event-in-scope-c3',
      seasonId: 'season-1',
      type: 'meeting',
      title: 'In-Scope Team Meeting C3',
      teamIds: ['team-fixture-alpha'],
      countsVolunteerHours: false,
    };
    const excludedEvent: HomeEventRow = {
      id: 'event-excluded-c3',
      seasonId: 'season-1',
      type: 'meeting',
      title: 'Excluded Team Meeting C3',
      teamIds: ['team-fixture-beta'],
      countsVolunteerHours: false,
    };
    const inScopeSession: HomeSessionRow = {
      id: 'session-in-scope-c3',
      eventId: 'event-in-scope-c3',
      startsAt: '2026-07-21T23:00:00.000Z',
      endsAt: '2026-07-22T01:00:00.000Z',
      status: 'scheduled',
    };
    const excludedSession: HomeSessionRow = {
      id: 'session-excluded-c3',
      eventId: 'event-excluded-c3',
      startsAt: '2026-07-22T23:00:00.000Z',
      endsAt: '2026-07-23T01:00:00.000Z',
      status: 'scheduled',
    };

    const loadData = async (): Promise<StudentHomeData> =>
      buildDataFixture({
        events: [inScopeEvent, excludedEvent],
        sessions: [inScopeSession, excludedSession],
        rsvps: [],
      });

    // All three strings distinct from each other AND from
    // PLACEHOLDER_CURRENT_TEAM_ID (revision-2 fix -- revision 1's version of
    // this criterion reused this file's own shipped Titans fixture, where
    // the in-scope id WAS PLACEHOLDER_CURRENT_TEAM_ID, so the mutation below
    // could never fail).
    expect('team-fixture-alpha').not.toBe(PLACEHOLDER_CURRENT_TEAM_ID);
    expect('team-fixture-beta').not.toBe(PLACEHOLDER_CURRENT_TEAM_ID);
    expect('team-fixture-alpha').not.toBe('team-fixture-beta');

    renderAsUser(STUDENT_USER, {
      loadData,
      resolveStudentScope: async () => ({
        teamIds: ['team-fixture-alpha'],
        goalHours: 100,
        confirmedHours: 0,
        plannedHours: 0,
      }),
      nowFn: () => FIXTURE_REFERENCE_NOW,
    });
    await flushMicrotasks();

    expect(container.textContent).toContain('In-Scope Team Meeting C3');
    expect(container.textContent).not.toContain('Excluded Team Meeting C3');
  });
});

describe("<StudentHome /> T187 -- a two-team student sees BOTH teams' meetings, live check-in, and sign-up opportunities (criterion 1)", () => {
  it('Next up and Sign-up opportunities both include events from EITHER active team, and exclude a third team', async () => {
    const teamAMeeting: HomeEventRow = {
      id: 'event-dual-a-meeting',
      seasonId: 'season-1',
      type: 'meeting',
      title: 'Team A Weekly Build',
      teamIds: ['team-dual-a'],
      countsVolunteerHours: false,
    };
    const teamBMeeting: HomeEventRow = {
      id: 'event-dual-b-meeting',
      seasonId: 'season-1',
      type: 'meeting',
      title: 'Team B Weekly Build',
      teamIds: ['team-dual-b'],
      countsVolunteerHours: false,
    };
    const teamAOutreach: HomeEventRow = {
      id: 'event-dual-a-outreach',
      seasonId: 'season-1',
      type: 'outreach',
      title: 'Team A Canned Food Drive',
      teamIds: ['team-dual-a'],
      countsVolunteerHours: true,
    };
    const teamBOutreach: HomeEventRow = {
      id: 'event-dual-b-outreach',
      seasonId: 'season-1',
      type: 'outreach',
      title: 'Team B STEM Night',
      teamIds: ['team-dual-b'],
      countsVolunteerHours: true,
    };
    const thirdTeamMeeting: HomeEventRow = {
      id: 'event-dual-c-meeting',
      seasonId: 'season-1',
      type: 'meeting',
      title: 'Team C Meeting (neither active team, must never appear)',
      teamIds: ['team-dual-c'],
      countsVolunteerHours: false,
    };
    const teamAMeetingSession: HomeSessionRow = {
      id: 'session-dual-a-meeting',
      eventId: 'event-dual-a-meeting',
      startsAt: '2026-07-21T23:00:00.000Z',
      endsAt: '2026-07-22T01:00:00.000Z',
      status: 'scheduled',
    };
    const teamBMeetingSession: HomeSessionRow = {
      id: 'session-dual-b-meeting',
      eventId: 'event-dual-b-meeting',
      startsAt: '2026-07-22T23:00:00.000Z',
      endsAt: '2026-07-23T01:00:00.000Z',
      status: 'scheduled',
    };
    const teamAOutreachSession: HomeSessionRow = {
      id: 'session-dual-a-outreach',
      eventId: 'event-dual-a-outreach',
      startsAt: '2026-07-25T15:00:00.000Z',
      endsAt: '2026-07-25T18:00:00.000Z',
      status: 'scheduled',
    };
    const teamBOutreachSession: HomeSessionRow = {
      id: 'session-dual-b-outreach',
      eventId: 'event-dual-b-outreach',
      startsAt: '2026-07-26T15:00:00.000Z',
      endsAt: '2026-07-26T18:00:00.000Z',
      status: 'scheduled',
    };
    const thirdTeamSession: HomeSessionRow = {
      id: 'session-dual-c-meeting',
      eventId: 'event-dual-c-meeting',
      startsAt: '2026-07-20T23:00:00.000Z',
      endsAt: '2026-07-21T01:00:00.000Z',
      status: 'scheduled',
    };

    const loadData = async (): Promise<StudentHomeData> =>
      buildDataFixture({
        events: [teamAMeeting, teamBMeeting, teamAOutreach, teamBOutreach, thirdTeamMeeting],
        sessions: [
          teamAMeetingSession,
          teamBMeetingSession,
          teamAOutreachSession,
          teamBOutreachSession,
          thirdTeamSession,
        ],
        rsvps: [],
      });

    renderAsUser(STUDENT_USER, {
      loadData,
      resolveStudentScope: async () => ({
        teamId: 'team-dual-a',
        // The defect this task fixes: a student on TWO teams must see BOTH,
        // not just the first (primary) one.
        teamIds: ['team-dual-a', 'team-dual-b'],
        goalHours: 100,
        confirmedHours: 0,
        plannedHours: 0,
      }),
      nowFn: () => FIXTURE_REFERENCE_NOW,
    });
    await flushMicrotasks();

    // Next up: BOTH teams' meetings.
    expect(container.textContent).toContain('Team A Weekly Build');
    expect(container.textContent).toContain('Team B Weekly Build');
    // Sign-up opportunities: BOTH teams' unanswered outreach.
    expect(container.textContent).toContain('Team A Canned Food Drive');
    expect(container.textContent).toContain('Team B STEM Night');
    // Never a third team the student does not belong to.
    expect(container.textContent).not.toContain('Team C Meeting');
  });

  it('live check-in reaches a currently-live meeting on the SECOND active team, not only the primary one', async () => {
    const primaryTeamMeeting: HomeEventRow = {
      id: 'event-dual-primary-meeting',
      seasonId: 'season-1',
      type: 'meeting',
      title: 'Primary Team Meeting (not live)',
      teamIds: ['team-dual-primary'],
      countsVolunteerHours: false,
    };
    const secondTeamLiveMeeting: HomeEventRow = {
      id: 'event-dual-second-meeting',
      seasonId: 'season-1',
      type: 'meeting',
      title: 'Second Team Meeting (live now)',
      teamIds: ['team-dual-second'],
      countsVolunteerHours: false,
    };
    const primaryTeamSession: HomeSessionRow = {
      id: 'session-dual-primary',
      eventId: 'event-dual-primary-meeting',
      startsAt: '2026-07-25T11:30:00.000Z',
      endsAt: '2026-07-25T13:30:00.000Z',
      status: 'scheduled',
    };
    const secondTeamLiveSession: HomeSessionRow = {
      id: 'session-dual-second-live',
      eventId: 'event-dual-second-meeting',
      startsAt: '2026-07-19T11:30:00.000Z',
      endsAt: '2026-07-19T13:30:00.000Z',
      status: 'scheduled',
    };

    const loadData = async (): Promise<StudentHomeData> =>
      buildDataFixture({
        events: [primaryTeamMeeting, secondTeamLiveMeeting],
        sessions: [primaryTeamSession, secondTeamLiveSession],
        rsvps: [],
      });

    renderAsUser(STUDENT_USER, {
      loadData,
      resolveStudentScope: async () => ({
        teamIds: ['team-dual-primary', 'team-dual-second'],
        goalHours: 100,
        confirmedHours: 0,
        plannedHours: 0,
      }),
      nowFn: () => FIXTURE_REFERENCE_NOW,
    });
    await flushMicrotasks();

    expect(container.textContent).toContain('Meeting live now');
    expect(primaryButtons()).toHaveLength(1);
    expect(primaryButtons()[0]?.textContent).toContain('Check in');
  });
});

describe('<StudentHome /> T176 -- explicit teamId bypasses resolveStudentScope entirely, paired (criterion 4, BLOCKER 2 fix extended)', () => {
  it('(a) resolveStudentScope is never called AND (b) the rendered team-scope outcome reflects the explicit value', async () => {
    const resolveStudentScopeSpy = vi.fn(async () => ({
      teamIds: ['team-should-never-be-used'],
      goalHours: 999,
      confirmedHours: 999,
      plannedHours: 999,
    }));
    const inScopeEvent: HomeEventRow = {
      id: 'event-c4-in',
      seasonId: 'season-1',
      type: 'meeting',
      title: 'C4 In Scope',
      teamIds: ['team-explicit-c4'],
      countsVolunteerHours: false,
    };
    const excludedEvent: HomeEventRow = {
      id: 'event-c4-out',
      seasonId: 'season-1',
      type: 'meeting',
      title: 'C4 Excluded',
      teamIds: ['team-fixture-other-c4'],
      countsVolunteerHours: false,
    };
    const inScopeSession: HomeSessionRow = {
      id: 'session-c4-in',
      eventId: 'event-c4-in',
      startsAt: '2026-07-21T23:00:00.000Z',
      endsAt: '2026-07-22T01:00:00.000Z',
      status: 'scheduled',
    };
    const excludedSession: HomeSessionRow = {
      id: 'session-c4-out',
      eventId: 'event-c4-out',
      startsAt: '2026-07-22T23:00:00.000Z',
      endsAt: '2026-07-23T01:00:00.000Z',
      status: 'scheduled',
    };

    expect('team-explicit-c4').not.toBe(PLACEHOLDER_CURRENT_TEAM_ID);
    expect('team-fixture-other-c4').not.toBe(PLACEHOLDER_CURRENT_TEAM_ID);
    expect('team-explicit-c4').not.toBe('team-fixture-other-c4');

    const loadData = async (): Promise<StudentHomeData> =>
      buildDataFixture({
        events: [inScopeEvent, excludedEvent],
        sessions: [inScopeSession, excludedSession],
        rsvps: [],
      });

    renderAsUser(STUDENT_USER, {
      loadData,
      teamId: 'team-explicit-c4',
      resolveStudentScope: resolveStudentScopeSpy,
      nowFn: () => FIXTURE_REFERENCE_NOW,
    });
    await flushMicrotasks();

    expect(resolveStudentScopeSpy).not.toHaveBeenCalled();
    expect(container.textContent).toContain('C4 In Scope');
    expect(container.textContent).not.toContain('C4 Excluded');
  });
});

class T176ThrowCaughtBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state: { error: Error | null } = { error: null };
  static getDerivedStateFromError(error: Error): { error: Error } {
    return { error };
  }
  render(): ReactNode {
    if (this.state.error) {
      return <div data-testid="t176-boundary-error">{this.state.error.message}</div>;
    }
    return this.props.children;
  }
}

describe('<StudentHome /> T176 -- fail-loud without a <SeasonProvider> ancestor (criterion 6a)', () => {
  it('throws the exact "useActiveSeason() must be called within a <SeasonProvider>." message', () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      act(() => {
        root.render(
          <AuthProvider>
            <LoginAs user={STUDENT_USER}>
              <T176ThrowCaughtBoundary>
                <StudentHome />
              </T176ThrowCaughtBoundary>
            </LoginAs>
          </AuthProvider>,
        );
      });
      expect(container.querySelector('[data-testid="t176-boundary-error"]')?.textContent).toBe(
        'useActiveSeason() must be called within a <SeasonProvider>.',
      );
    } finally {
      consoleErrorSpy.mockRestore();
    }
  });

  it('the companion case: the same probe does NOT throw when a <SeasonProvider> wrapping the fixture-resolving loader is present', async () => {
    act(() => {
      root.render(
        <SeasonProvider loadActiveSeason={async () => FIXTURE_ACTIVE_SEASON}>
          <AuthProvider>
            <LoginAs user={STUDENT_USER}>
              <T176ThrowCaughtBoundary>
                <StudentHome
                  loadData={fixtureLoadData}
                  studentId={PLACEHOLDER_CURRENT_STUDENT_ID}
                  teamId={PLACEHOLDER_CURRENT_TEAM_ID}
                  nowFn={() => FIXTURE_REFERENCE_NOW}
                />
              </T176ThrowCaughtBoundary>
            </LoginAs>
          </AuthProvider>
        </SeasonProvider>,
      );
    });
    await flushMicrotasks();
    expect(container.querySelector('[data-testid="t176-boundary-error"]')).toBeNull();
    expect(container.textContent).toContain('Hi Ada Reyes');
  });
});

describe('<StudentHome /> T176 -- seasonId sourced from useActiveSeason(), asserted in isolation (criterion 6b)', () => {
  it('loadData receives EXACTLY the real active season id as its second argument, never the retired placeholder', async () => {
    const loadDataSpy = vi.fn<(studentId: string, seasonId: string) => Promise<StudentHomeData>>(
      () => new Promise<StudentHomeData>(() => {}),
    );
    renderAsUser(STUDENT_USER, { loadData: loadDataSpy });
    await flushMicrotasks();
    expect(loadDataSpy).toHaveBeenCalledTimes(1);
    expect(loadDataSpy.mock.calls[0]?.[1]).toBe(FIXTURE_ACTIVE_SEASON.id);
    expect(loadDataSpy.mock.calls[0]?.[1]).not.toBe(PLACEHOLDER_SEASON_ID_FOR_TESTS);
  });
});

describe('<StudentHome /> T176 -- identity-resolution tier own DES-12 states, three independent sub-mutations (criterion 7)', () => {
  it('(i) loading: shows the tier\'s own loading text, distinct from "Loading Home…"', async () => {
    renderAsUser(STUDENT_USER, {
      resolveStudentId: () => new Promise(() => {}),
    });
    await flushMicrotasks();
    expect(container.textContent).toContain('Finding your student record');
    expect(container.querySelector('[role="status"]')?.textContent).toBe(
      'Finding your student record…',
    );
    expect(container.textContent).not.toContain('Loading Home');
  });

  it('(ii) error: shows a distinct error banner, distinct from "Couldn\'t load Home", with a working Retry', async () => {
    let callCount = 0;
    const resolveStudentId = vi.fn(async () => {
      callCount += 1;
      if (callCount === 1) throw new Error('boom-identity');
      return HARNESS_DEFAULT_RESOLVED_STUDENT_ID;
    });
    renderAsUser(STUDENT_USER, { resolveStudentId });
    await flushMicrotasks();
    expect(container.textContent).toContain("Couldn't find your student record");
    expect(container.textContent).not.toContain("Couldn't load Home");

    const retryButton = findButtonByText('Retry');
    expect(retryButton).toBeDefined();
    act(() => {
      retryButton!.click();
    });
    await flushMicrotasks();
    expect(callCount).toBe(2);
    expect(container.textContent).not.toContain("Couldn't find your student record");
  });

  it('(iii) null (no linked student): shows a distinct EmptyState, independent of the copy-collision mutation (ii) survives', async () => {
    renderAsUser(STUDENT_USER, { resolveStudentId: async () => null });
    await flushMicrotasks();
    expect(container.textContent).toContain('No student account linked yet');
    expect(container.textContent).not.toContain('Nothing scheduled');
    expect(container.textContent).not.toContain("Couldn't find your student record");
  });

  // T184: fourth isolated state -- a REAL, linked studentId (not
  // 'not-linked') whose resolveStudentScope resolves null (deactivated
  // student). Must render distinct copy from every other state on this
  // page, not a reuse of "No student account linked yet" (the bug this
  // task fixes) or any of the other 7 static titles this file renders
  // elsewhere (re-derived directly against this file, not trusted from any
  // packet/gate figure -- see this task's own worker output for the full
  // enumeration).
  it('(iv) inactive (real, linked student, deactivated): shows a distinct EmptyState, textually non-colliding with all other states on this page', async () => {
    renderAsUser(STUDENT_USER, {
      resolveStudentId: async () => 'student-real-inactive-1',
      resolveStudentScope: async () => null,
    });
    await flushMicrotasks();
    expect(container.textContent).toContain('Your student account is inactive');
    // Not the sibling states' own copy on this same tier.
    expect(container.textContent).not.toContain('No student account linked yet');
    expect(container.textContent).not.toContain('Finding your student record');
    expect(container.textContent).not.toContain("Couldn't find your student record");
    // Not any of the other 6 static titles this file renders elsewhere
    // (content tier, outer season-status wrapper) -- the full, re-derived
    // 8-title enumeration minus the 2 already asserted above.
    expect(container.textContent).not.toContain("Couldn't load Home");
    expect(container.textContent).not.toContain('Nothing scheduled');
    expect(container.textContent).not.toContain("You're all caught up");
    expect(container.textContent).not.toContain('Sign in to view Home');
    expect(container.textContent).not.toContain('No active season yet');
    expect(container.textContent).not.toContain("Couldn't load the active season");
  });
});

describe('<StudentHome /> T176 round 2 -- goal-hours denominator + confirmed/planned hours are ALL verbatim passthroughs from resolveStudentScope (v_student_goal_projection), never recomputed and never read from the still-fixture loadData (criterion 10, §2c corrected)', () => {
  const CRITERION_10_SEASON: SeasonRow = {
    ...FIXTURE_ACTIVE_SEASON,
    id: 'season-fixture-c10',
    // Deliberately DIFFERENT from resolveStudentScope's own goalHours below
    // in both tests -- if the render fell back to (or independently
    // recomputed against) the season default, this number would leak into
    // the assertions and be caught.
    defaultGoalHours: 999,
  };

  it('goalHours/confirmedHours/plannedHours come from resolveStudentScope, never the season default and never data.studentHours (a deliberately different, unused fixture value)', async () => {
    renderAsUser(
      STUDENT_USER,
      {
        // Deliberately a DIFFERENT confirmedHours than resolveStudentScope's
        // own value below -- if the render used this still-fixture value
        // instead of the real view's value, this test would catch it.
        loadData: async () =>
          buildDataFixture({
            studentHours: { studentId: 'student-1', seasonId: 'season-1', confirmedHours: 999 },
          }),
        resolveStudentScope: async () => ({
          teamIds: ['team-fixture-c10'],
          goalHours: 8,
          confirmedHours: 2,
          plannedHours: 1,
        }),
        nowFn: () => FIXTURE_REFERENCE_NOW,
      },
      async () => CRITERION_10_SEASON,
    );
    await flushMicrotasks();

    const progressBar = container.querySelector('[role="progressbar"]');
    expect(progressBar).toBeTruthy();
    expect(progressBar!.getAttribute('aria-valuemax')).toBe('8');
    expect(progressBar!.getAttribute('aria-valuetext')).toBe('2 / 8 h (25%)');
    expect(container.innerHTML).toContain('2 / 8 h (25%)');
    expect(container.innerHTML).toContain('aria-valuemax="8"');
    expect(container.innerHTML).toContain('aria-valuetext="2 / 8 h (25%)"');
    // Never the season default (999) -- proves no independent TS-side
    // coalesce/override happens anymore (the coordinator's own fix).
    expect(progressBar!.getAttribute('aria-valuemax')).not.toBe('999');
    // Confirmed/planned legend -- the REAL view's numbers (2/1), never the
    // still-fixture loadData's own confirmedHours (999) or
    // computePlannedHours's fixture-derived result (this render's own
    // `data.events`/`data.sessions`/`rsvps` are all empty, per
    // `buildDataFixture`'s own default, so computePlannedHours would have
    // returned 0 here even if still called -- the 999 confirmedHours is the
    // genuinely discriminating value).
    expect(container.textContent).toContain('2 h confirmed');
    expect(container.textContent).toContain('1 h planned');
    expect(container.textContent).not.toContain('999');
  });

  it('a different resolveStudentScope result renders different real numbers, proving nothing is hardcoded', async () => {
    renderAsUser(
      STUDENT_USER,
      {
        loadData: async () => buildDataFixture({ studentHours: null }),
        resolveStudentScope: async () => ({
          teamIds: ['team-fixture-c10'],
          goalHours: 40,
          confirmedHours: 10,
          plannedHours: 5,
        }),
        nowFn: () => FIXTURE_REFERENCE_NOW,
      },
      async () => CRITERION_10_SEASON,
    );
    await flushMicrotasks();

    const progressBar = container.querySelector('[role="progressbar"]');
    expect(progressBar).toBeTruthy();
    expect(progressBar!.getAttribute('aria-valuemax')).toBe('40');
    expect(progressBar!.getAttribute('aria-valuetext')).toBe('10 / 40 h (25%)');
    expect(container.innerHTML).toContain('10 / 40 h (25%)');
    expect(container.textContent).toContain('10 h confirmed');
    expect(container.textContent).toContain('5 h planned');
    expect(progressBar!.getAttribute('aria-valuemax')).not.toBe('8');
    expect(progressBar!.getAttribute('aria-valuemax')).not.toBe('999');
  });
});

describe('<StudentHome /> T176/T183 -- render-and-enumerate live over container.innerHTML, real ids + the REAL production loadData (criterion 11)', () => {
  it('confirms or corrects the gate-measured enumeration table (T176-gate-round1-findings.md), now against the real T183 loader', async () => {
    const REAL_SEASON: SeasonRow = {
      id: 'season-real-c11',
      name: 'Real Season C11',
      startsOn: '2026-01-01',
      endsOn: '2026-12-31',
      // Deliberately DIFFERENT from resolveStudentScope's own goalHours
      // below, and deliberately unused (T176 round 2 -- see criterion 10):
      // if this leaked into the render, the assertions below would catch it.
      defaultGoalHours: 999,
      isActive: true,
      createdAt: '2026-01-01T00:00:00.000Z',
    };

    // T183 -- direct DI against a stubbed `students` client, mirroring
    // `students.test.ts`'s own `makeRecordingClient` helper (that file,
    // lines 40-62) but for the real `queryStudentDisplayNameById` query
    // (`.from('students').select('display_name').eq('id', studentId)
    // .maybeSingle()`) instead of `v_student_goal_projection`. This is the
    // one test in this file that documents what the SHIPPED PRODUCTION
    // default (`StudentHome.tsx:1763`'s `loadStudentHomeData`) actually
    // returns, field by field -- so it must exercise the real loader, not
    // the harness's `defaultLoadStudentHomeData` fixture fallback.
    const stubbedStudentsClient = {
      from: (table: string) => {
        if (table !== 'students') throw new Error(`unexpected table: ${table}`);
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({ data: { display_name: 'Priya Chen' }, error: null }),
            }),
          }),
        };
      },
    } as unknown as SupabaseClient;
    const realLoadData = makeLoadStudentHomeData(() => stubbedStudentsClient);

    renderAsUser(
      STUDENT_USER,
      {
        loadData: realLoadData,
        resolveStudentId: async () => 'student-real-c11',
        resolveStudentScope: async () => ({
          teamIds: ['team-real-c11'],
          goalHours: 50,
          confirmedHours: 5,
          plannedHours: 2,
        }),
        nowFn: () => FIXTURE_REFERENCE_NOW,
      },
      async () => REAL_SEASON,
    );
    await flushMicrotasks();

    const html = container.innerHTML;

    // Row 1 -- lead item (§3 decision 2). T183: the shipped production
    // `loadData` now sources `displayName` for real (`loaders/students.ts`'s
    // `queryStudentDisplayNameById`, `.eq('id', studentId)`) -- proven here
    // by injecting a stubbed client that returns a fabricated, non-'Ada
    // Reyes' name (constitution item 6) and asserting BOTH that it renders
    // verbatim AND that the old fabricated name is gone, so a
    // broken-but-differently-fabricated implementation would still fail
    // this assertion.
    expect(html).toContain('Hi Priya Chen');
    expect(html).not.toContain('Hi Ada Reyes');

    // Rows 2-4 -- fixed by criterion 10: the real `resolveStudentScope`
    // value (50), never the fabricated `FIXTURE_DEFAULT_GOAL_HOURS` (100)
    // and never the (deliberately different, unused) season default (999).
    const progressBar = container.querySelector('[role="progressbar"]');
    expect(progressBar!.getAttribute('aria-valuemax')).toBe('50');
    expect(progressBar!.getAttribute('aria-valuetext')).toBe('5 / 50 h (10%)');
    expect(html).toContain('5 / 50 h (10%)');
    expect(progressBar!.getAttribute('aria-valuemax')).not.toBe('100');
    expect(progressBar!.getAttribute('aria-valuemax')).not.toBe('999');

    // Row 5 -- RECLASSIFIED, T176 round 2 (coordinator correction): no
    // longer "honestly empty" via a fixture-null `data.studentHours` --
    // `confirmedHours`/`plannedHours` are now genuinely real
    // `v_student_goal_projection` columns (same single `resolveStudentScope`
    // read as the goal-hours denominator), so this real student's real
    // confirmed/planned numbers (5/2) render here, not a fixture-derived 0.
    expect(html).toContain('5 h confirmed + 2 h planned');
    expect(html).not.toContain('0 h confirmed + 0 h planned');

    // Row 6 -- participation -> null -> em dash, never a fabricated 0%.
    expect(html).toContain('Participation: —');

    // Row 7 -- events filtered to [] (the real season id never matches the
    // fixture's own hardcoded placeholder literal) -> Next up empty.
    expect(html).toContain('Nothing scheduled');

    // Rows 8/9 -- BOTH literally "You're all caught up" (enumeration
    // hazard, §7 criterion 11) -- scoped by the T129 aria-labelledby
    // section group, not a bare substring match.
    const opportunitiesGroup = Array.from(container.querySelectorAll('[role="group"]')).find((el) =>
      el.textContent?.includes("You're all caught up"),
    );
    expect(opportunitiesGroup).toBeTruthy();
    expect(opportunitiesGroup!.textContent).toContain(
      'Outreach events awaiting your response will show up here.',
    );
    // Row 9's own quiet-greeting hero -- a DIFFERENT, longer sentence, a
    // positive-reassurance string rendered where the app in fact knows
    // nothing about this real student (disclosed judgement, not omitted).
    expect(html).toContain("You're all caught up. Nothing needs your attention right now.");
    const caughtUpOccurrences = (container.textContent?.match(/You're all caught up/g) ?? [])
      .length;
    expect(caughtUpOccurrences).toBe(2);

    // Row 10 -- no live check-in card, no unanswered-RSVP hero (both joins
    // miss once `events` is `[]`).
    expect(html).not.toContain('Meeting live now');
    expect(html).not.toContain('events to answer');
  });
});

describe('<StudentHome /> T184 -- deactivated student (real, linked studentId, resolveStudentScope resolves null) gets its own honest copy, not the "no student linked" collapse (criterion 1)', () => {
  it('renders the new "inactive" title for a real, distinct, non-placeholder, non-fixture id, and does NOT contain the "not-linked" title', async () => {
    renderAsUser(STUDENT_USER, {
      resolveStudentId: async () => 'student-real-inactive-1',
      resolveStudentScope: async () => null,
    });
    await flushMicrotasks();
    expect(container.textContent).toContain('Your student account is inactive');
    expect(container.textContent).not.toContain('No student account linked yet');
  });
});

describe('<StudentHome /> T184 -- "sees nothing" is proven with a positive control (criterion 5)', () => {
  it('positive control: a real "linked" render DOES show greeting + goal-bar content markers', async () => {
    renderAsUser(STUDENT_USER, {
      resolveStudentId: async () => 'student-real-linked-c5',
      resolveStudentScope: async () => ({
        teamIds: ['team-real-c5'],
        goalHours: 20,
        confirmedHours: 4,
        plannedHours: 2,
      }),
      nowFn: () => FIXTURE_REFERENCE_NOW,
    });
    await flushMicrotasks();
    expect(container.textContent).toContain('Hi Ada Reyes');
    const progressBar = container.querySelector('[role="progressbar"]');
    expect(progressBar).toBeTruthy();
    expect(progressBar!.getAttribute('aria-valuetext')).toBe('4 / 20 h (20%)');
  });

  it('the inactive render shows NEITHER marker the positive control above proved real', async () => {
    renderAsUser(STUDENT_USER, {
      resolveStudentId: async () => 'student-real-inactive-c5',
      resolveStudentScope: async () => null,
      nowFn: () => FIXTURE_REFERENCE_NOW,
    });
    await flushMicrotasks();
    expect(container.textContent).not.toContain('Hi Ada Reyes');
    expect(container.querySelector('[role="progressbar"]')).toBeNull();
    expect(container.textContent).toContain('Your student account is inactive');
  });
});
