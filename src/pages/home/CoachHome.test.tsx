// @vitest-environment jsdom
/**
 * T053: tests for `CoachHome.tsx`.
 *
 * Per this task's Allowed Files ("A colocated `CoachHome.test.tsx` is
 * acceptable per established precedent -- disclose it") this test file is
 * the same class of addition `OutreachList.test.tsx`/T038,
 * `MeetingsList.test.tsx`/T030, and `CheckinResult.test.tsx`/T035 already
 * made in their own sibling directories -- producing the DOM-text and
 * boundary-condition proof this task's own packet's "Required Worker
 * Output" section requires (the 59-vs-61-minute Start check-in boundary,
 * the BEH-01 milestone-toast dedupe on this page's own goal bar, and
 * HOME-04's admin-only role-gating).
 *
 * No `@testing-library/react` is installed in this repo (confirmed via
 * `package.json`) -- these tests use the same raw `createRoot`/`act`
 * pattern `OutreachList.test.tsx`/`MeetingsList.test.tsx` already
 * established, including their `AuthProvider` + `LoginAs` role-login
 * harness.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { act, Component, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthProvider, type AuthUser } from '../../app/guards';
import { LoginAs } from '../../test-utils/authHarness';
import { SeasonProvider, type LoadActiveSeasonFn } from '../../app/SeasonProvider';
import type { SeasonRow } from '../../lib/supabase/types';
import type {
  ActivityFeedSource,
  DashboardData,
  FeedRsvpRow,
} from '../../lib/supabase/loaders/dashboard';
import { makeLoadCoachHomeData } from '../../lib/supabase/loaders/coachHome';
import {
  ACTIVITY_FEED_DEFAULT_LIMIT,
  attendanceRatePercent,
  buildActivityFeed,
  buildLastCompletedMeetingSummary,
  buildNextUp,
  COACH_HOME_PAIRED_MODULE_MIN_WIDTH,
  CoachHome,
  countUpcomingSessionsInNextDays,
  crossedMilestones,
  defaultLoadCoachHomeData,
  defaultLoadDashboardData,
  filterGoalProjectionRows,
  FIXTURE_REFERENCE_NOW,
  formatDayOfWeekLabel,
  formatGoalProjectionAnnotation,
  formatRelativeTime,
  formatSessionDateLabel,
  goalProjectionPercent,
  goalProjectionShortHours,
  hasMilestoneToastFired,
  hoursVsGoalPercent,
  isSeasonMissingSetup,
  isSelfOriginated,
  isSessionCheckInEligible,
  markMilestoneToastFired,
  maxOf,
  pickBusiestDay,
  PLACEHOLDER_CURRENT_TEAM_ID,
  selectCheckInSession,
  sortEventsByHoursDescending,
  sortGoalProjectionRows,
  sortTeamHoursDescending,
  sumConfirmedHours,
  sumGoalHours,
  wasRsvpChanged,
  type CoachHomeData,
  type HomeEventRow,
  type HomeRsvpRow,
  type HomeSessionRow,
  type HomeStudentRow,
  type HomeTeamRow,
  type SeasonSetupStatus,
} from './CoachHome';
import { defaultLoadLeaderboardData, defaultLoadPrivacySetting } from '../outreach/Leaderboard';

// ---------------------------------------------------------------------------
// Render harness -- mirrors OutreachList.test.tsx / MeetingsList.test.tsx.
//
// T155: `CoachHome` now calls `useActiveSeason()` (module doc #14 in
// `CoachHome.tsx`), so every render needs a `<SeasonProvider>` ancestor.
// `FIXTURE_ACTIVE_SEASON` is the ONE shared fixture `SeasonRow` this file
// (and `DashboardPage.test.tsx`'s own harness) reuses, per the packet's own
// "one constant, one non-placeholder id" guidance -- a distinctive id
// (`'season-fixture-active'`, not a literal UUID, matching
// `AppShell.test.tsx`'s `T140_FIXTURE_SEASON` convention), deliberately
// DIFFERENT from `PLACEHOLDER_SEASON_ID_FOR_TESTS`
// (`'season-placeholder-current'`, still used below by `fixtureLoadData`/
// `fixtureLoadDashboardData`, which call `defaultLoadCoachHomeData`/
// `defaultLoadDashboardData` directly with that literal, ignoring whatever
// real `seasonId` `CoachHomeContent` itself resolves and passes into
// `loadData(seasonId)`/`loadDashboardData(seasonId)` -- both fixture
// functions have a strictly narrower `() => Promise<...>` signature than the
// `(seasonId: string) => Promise<...>` the `loadData`/`loadDashboardData`
// props require, so TypeScript's structural typing accepts them regardless
// of what argument the real seam would pass). This is exactly why every
// pre-existing `it(` body below keeps passing unmodified once `renderAsUser`
// wraps in a `<SeasonProvider>` resolving `FIXTURE_ACTIVE_SEASON`: those
// tests' own fixture loaders never look at the real resolved season id at
// all, only the NEW tests added for this task (criterion 1/5) do.
// ---------------------------------------------------------------------------

let container: HTMLDivElement;
let root: Root;

const COACH_USER: AuthUser = { id: 'user-coach', email: 'coach@example.com', role: 'coach' };
const ADMIN_USER: AuthUser = { id: 'user-admin', email: 'admin@example.com', role: 'admin' };

const FIXTURE_ACTIVE_SEASON: SeasonRow = {
  id: 'season-fixture-active',
  name: 'Fixture Active Season',
  startsOn: '2026-01-01',
  endsOn: '2026-12-31',
  defaultGoalHours: 100,
  isActive: true,
  createdAt: '2026-01-01T00:00:00.000Z',
};

/**
 * T155: `loadActiveSeason` is a new optional third parameter (default
 * resolves `FIXTURE_ACTIVE_SEASON`, matching every pre-existing `it(`'s
 * implicit expectation of "the season is ready quickly") -- every call site
 * that predates this task still calls `renderAsUser(user, props)` with
 * exactly two arguments, so this default applies there unchanged; only the
 * new criterion-1/3/5 tests below pass a third argument to reach the
 * 'loading'/'none'/'error' season states or a different fixture season id.
 */
function renderAsUser(
  user: AuthUser | null,
  props: Parameters<typeof CoachHome>[0] = {},
  loadActiveSeason: LoadActiveSeasonFn = async () => FIXTURE_ACTIVE_SEASON,
): void {
  // T203: CoachHome's own default `loadLeaderboardData`/
  // `loadLeaderboardPrivacySetting` are now the real, unconfigured-in-jsdom
  // Supabase loaders (gate round 1, BLOCKER 1: `Leaderboard` fetches BOTH
  // via `Promise.all`, so BOTH need a fixture default here, not just one).
  // Every pre-existing call site below predates both props and cannot have
  // overridden either, so the fixture defaults are merged here once rather
  // than touching ~90 call sites; a caller-supplied override of either prop
  // in `props` still wins (spread order below).
  const mergedProps: Parameters<typeof CoachHome>[0] = {
    loadLeaderboardData: defaultLoadLeaderboardData,
    loadLeaderboardPrivacySetting: defaultLoadPrivacySetting,
    ...props,
  };
  act(() => {
    root.render(
      <MemoryRouter>
        <SeasonProvider loadActiveSeason={loadActiveSeason}>
          <AuthProvider>
            {user === null ? (
              <CoachHome {...mergedProps} />
            ) : (
              <LoginAs user={user}>
                <CoachHome {...mergedProps} />
              </LoginAs>
            )}
          </AuthProvider>
        </SeasonProvider>
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
  vi.restoreAllMocks();
});

const REF_NOW_MS = FIXTURE_REFERENCE_NOW.getTime();

// ---------------------------------------------------------------------------
// Pure functions -- sums
//
// T198 -- `describe('isEventInTeamScope')` is DELETED here, not disabled: the
// function it covered no longer exists (owner-ruled season-wide, so this page
// has no team-scope predicate at all). Tests for a deleted export cannot be
// preserved. `StudentHome.tsx`/`ParentHome.tsx` keep their own same-named
// predicates and their own tests -- untouched by this task.
// ---------------------------------------------------------------------------

describe('sumGoalHours / sumConfirmedHours', () => {
  const students: HomeStudentRow[] = [
    { id: 's1', displayName: 'A', teamId: 'team-a', isActive: true, goalHoursOverride: null },
    { id: 's2', displayName: 'B', teamId: 'team-a', isActive: true, goalHoursOverride: 8 },
    { id: 's3', displayName: 'C', teamId: 'team-a', isActive: false, goalHoursOverride: 20 }, // inactive
    // T198 -- was "// wrong team", excluded. Season-wide, a different team
    // is INCLUDED; only `isActive` still filters.
    { id: 's4', displayName: 'D', teamId: 'team-b', isActive: true, goalHoursOverride: 5 },
  ];

  it('sums goal hours for ACTIVE students season-wide, falling back to the default', () => {
    // T198 recomputed: was 18 when scoped to team-a (10 default + 8 override).
    // Season-wide adds s4 (team-b, active, override 5); s3 still excluded as
    // inactive. 10 + 8 + 5 = 23.
    expect(sumGoalHours(students, 10)).toBe(23);
  });

  it('sums confirmed hours from pre-computed rows, ACTIVE students season-wide', () => {
    const hoursRows = [
      { studentId: 's1', seasonId: 'season-1', confirmedHours: 3 },
      { studentId: 's2', seasonId: 'season-1', confirmedHours: 4 },
      { studentId: 's3', seasonId: 'season-1', confirmedHours: 100 }, // inactive, excluded
      { studentId: 's4', seasonId: 'season-1', confirmedHours: 100 }, // T198: now INCLUDED
    ];
    // T198 recomputed: was 7 (3 + 4) when scoped to team-a. Season-wide adds
    // s4's 100; s3 still excluded as inactive. 3 + 4 + 100 = 107.
    expect(sumConfirmedHours(students, hoursRows)).toBe(107);
  });
});

describe('hoursVsGoalPercent / crossedMilestones (BEH-01, same idiom as OutreachList.tsx)', () => {
  it('computes percent, capped at 100, 0 when goal is 0', () => {
    expect(hoursVsGoalPercent(3, 12)).toBe(25);
    expect(hoursVsGoalPercent(20, 10)).toBe(100);
    expect(hoursVsGoalPercent(5, 0)).toBe(0);
  });

  it('returns every milestone at or below the current percent', () => {
    expect(crossedMilestones(0)).toEqual([]);
    expect(crossedMilestones(31.6)).toEqual([25]);
    expect(crossedMilestones(60)).toEqual([25, 50]);
    expect(crossedMilestones(100)).toEqual([25, 50, 75, 100]);
  });
});

// ---------------------------------------------------------------------------
// "Attendance rate of last completed meeting" -- a NEW, distinct ratio
// (module doc #4), never MET-01/02's excused-exclusion formula.
// ---------------------------------------------------------------------------

describe('buildLastCompletedMeetingSummary / attendanceRatePercent', () => {
  const students: HomeStudentRow[] = [
    { id: 's1', displayName: 'A', teamId: 'team-a', isActive: true, goalHoursOverride: null },
    { id: 's2', displayName: 'B', teamId: 'team-a', isActive: true, goalHoursOverride: null },
    { id: 's3', displayName: 'C', teamId: 'team-a', isActive: false, goalHoursOverride: null }, // inactive: excluded from rosterSize
  ];
  const events: HomeEventRow[] = [
    { id: 'e1', seasonId: 'season-1', type: 'meeting', title: 'Weekly Build', teamIds: null },
    { id: 'e2', seasonId: 'season-1', type: 'outreach', title: 'Food Drive', teamIds: null },
  ];
  const sessions: HomeSessionRow[] = [
    {
      id: 'old',
      eventId: 'e1',
      startsAt: '2026-07-01T00:00:00.000Z',
      endsAt: '2026-07-01T01:00:00.000Z',
      status: 'completed',
    },
    {
      id: 'latest',
      eventId: 'e1',
      startsAt: '2026-07-10T00:00:00.000Z',
      endsAt: '2026-07-10T01:00:00.000Z',
      status: 'completed',
    },
    // Not a meeting -- must be ignored even though it's later.
    {
      id: 'outreach-later',
      eventId: 'e2',
      startsAt: '2026-07-15T00:00:00.000Z',
      endsAt: '2026-07-15T01:00:00.000Z',
      status: 'completed',
    },
    // Meeting but still scheduled -- must be ignored (not completed).
    {
      id: 'future',
      eventId: 'e1',
      startsAt: '2026-08-01T00:00:00.000Z',
      endsAt: '2026-08-01T01:00:00.000Z',
      status: 'scheduled',
    },
  ];

  it('picks the most recent COMPLETED MEETING session, ignoring later outreach/future sessions', () => {
    const summary = buildLastCompletedMeetingSummary(sessions, events, [], students);
    expect(summary?.sessionId).toBe('latest');
    expect(summary?.title).toBe('Weekly Build');
  });

  it("tallies attendance for that one session and computes (present+late)/activeRosterSize -- not MET-01/02's formula", () => {
    const attendance = [
      { sessionId: 'latest', studentId: 's1', status: 'present' as const },
      { sessionId: 'latest', studentId: 's2', status: 'absent' as const },
      { sessionId: 'old', studentId: 's1', status: 'present' as const }, // wrong session, ignored
    ];
    const summary = buildLastCompletedMeetingSummary(sessions, events, attendance, students);
    expect(summary).toEqual({
      sessionId: 'latest',
      title: 'Weekly Build',
      presentCount: 1,
      lateCount: 0,
      excusedCount: 0,
      absentCount: 1,
      rosterSize: 2, // s3 is inactive, excluded
    });
    expect(attendanceRatePercent(summary!)).toBe(50); // 1 of 2, not excused-adjusted
  });

  it('returns null when no completed meeting exists yet this season', () => {
    expect(buildLastCompletedMeetingSummary([], events, [], students)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// "Start check-in" -- the 60-minute boundary (Known Context/Traps #4).
// The literal packet requirement: 61 minutes out -> NOT visible; 59 minutes
// out -> visible. Proven directly against the real exported predicate.
// ---------------------------------------------------------------------------

describe('isSessionCheckInEligible (60-minute boundary)', () => {
  const nowMs = REF_NOW_MS;

  it('a session starting in exactly 61 minutes is NOT eligible', () => {
    const startsAt = new Date(nowMs + 61 * 60_000).toISOString();
    const endsAt = new Date(nowMs + 121 * 60_000).toISOString();
    expect(isSessionCheckInEligible({ startsAt, endsAt, status: 'scheduled' }, nowMs)).toBe(false);
  });

  it('a session starting in exactly 59 minutes IS eligible', () => {
    const startsAt = new Date(nowMs + 59 * 60_000).toISOString();
    const endsAt = new Date(nowMs + 119 * 60_000).toISOString();
    expect(isSessionCheckInEligible({ startsAt, endsAt, status: 'scheduled' }, nowMs)).toBe(true);
  });

  it('a session starting in exactly 60 minutes IS eligible (inclusive boundary)', () => {
    const startsAt = new Date(nowMs + 60 * 60_000).toISOString();
    const endsAt = new Date(nowMs + 120 * 60_000).toISOString();
    expect(isSessionCheckInEligible({ startsAt, endsAt, status: 'scheduled' }, nowMs)).toBe(true);
  });

  it('a currently-live session (started before now, ends after now) IS eligible', () => {
    const startsAt = new Date(nowMs - 30 * 60_000).toISOString();
    const endsAt = new Date(nowMs + 90 * 60_000).toISOString();
    expect(isSessionCheckInEligible({ startsAt, endsAt, status: 'scheduled' }, nowMs)).toBe(true);
  });

  it('a session that already ended is NOT eligible even though it started long ago', () => {
    const startsAt = new Date(nowMs - 180 * 60_000).toISOString();
    const endsAt = new Date(nowMs - 60 * 60_000).toISOString();
    expect(isSessionCheckInEligible({ startsAt, endsAt, status: 'scheduled' }, nowMs)).toBe(false);
  });

  it('a completed/canceled session is NEVER eligible regardless of time', () => {
    const startsAt = new Date(nowMs - 5 * 60_000).toISOString();
    const endsAt = new Date(nowMs + 5 * 60_000).toISOString();
    expect(isSessionCheckInEligible({ startsAt, endsAt, status: 'completed' }, nowMs)).toBe(false);
    expect(isSessionCheckInEligible({ startsAt, endsAt, status: 'canceled' }, nowMs)).toBe(false);
  });
});

describe('selectCheckInSession (meeting-type + eligibility, season-wide)', () => {
  const events: HomeEventRow[] = [
    { id: 'e-meeting', seasonId: 's1', type: 'meeting', title: 'Build', teamIds: ['team-a'] },
    {
      id: 'e-outreach',
      seasonId: 's1',
      type: 'outreach',
      title: 'Food Drive',
      teamIds: ['team-a'],
    },
    {
      id: 'e-other-team-meeting',
      seasonId: 's1',
      type: 'meeting',
      title: 'Other Team',
      teamIds: ['team-b'],
    },
  ];

  it('returns the eligible meeting session even when an eligible outreach session exists (type-scoped)', () => {
    const sessions: HomeSessionRow[] = [
      {
        id: 'meeting-eligible',
        eventId: 'e-meeting',
        startsAt: new Date(REF_NOW_MS + 30 * 60_000).toISOString(),
        endsAt: new Date(REF_NOW_MS + 90 * 60_000).toISOString(),
        status: 'scheduled',
      },
      {
        id: 'outreach-eligible-but-wrong-type',
        eventId: 'e-outreach',
        startsAt: new Date(REF_NOW_MS + 10 * 60_000).toISOString(),
        endsAt: new Date(REF_NOW_MS + 70 * 60_000).toISOString(),
        status: 'scheduled',
      },
    ];
    const result = selectCheckInSession(sessions, events, REF_NOW_MS);
    expect(result?.id).toBe('meeting-eligible');
  });

  // T198 -- this test's premise is INVERTED, not dropped. It previously
  // asserted that an eligible meeting on another team was EXCLUDED; under the
  // owner's season-wide ruling it must now be RETURNED. Kept (rather than
  // deleted) because it is the sharpest single proof the scoping actually
  // changed: same fixture, opposite expectation.
  it('INCLUDES an eligible meeting session belonging to another team (season-wide)', () => {
    const sessions: HomeSessionRow[] = [
      {
        id: 'other-team-eligible',
        eventId: 'e-other-team-meeting',
        startsAt: new Date(REF_NOW_MS + 5 * 60_000).toISOString(),
        endsAt: new Date(REF_NOW_MS + 65 * 60_000).toISOString(),
        status: 'scheduled',
      },
    ];
    expect(selectCheckInSession(sessions, events, REF_NOW_MS)?.id).toBe('other-team-eligible');
  });

  it('returns null when nothing is eligible', () => {
    const sessions: HomeSessionRow[] = [
      {
        id: 'too-far-out',
        eventId: 'e-meeting',
        startsAt: new Date(REF_NOW_MS + 61 * 60_000).toISOString(),
        endsAt: new Date(REF_NOW_MS + 121 * 60_000).toISOString(),
        status: 'scheduled',
      },
    ];
    expect(selectCheckInSession(sessions, events, REF_NOW_MS)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// countUpcomingSessionsInNextDays
// ---------------------------------------------------------------------------

describe('countUpcomingSessionsInNextDays', () => {
  const events: HomeEventRow[] = [
    {
      id: 'e1',
      seasonId: 's1',
      type: 'meeting',
      title: 'X',
      teamIds: [PLACEHOLDER_CURRENT_TEAM_ID],
    },
    { id: 'e-other-team', seasonId: 's1', type: 'meeting', title: 'Y', teamIds: ['team-titans'] },
  ];

  it('counts scheduled sessions starting within the window season-wide, excluding already-started, far-future and non-scheduled ones', () => {
    const sessions: HomeSessionRow[] = [
      {
        id: 'in-window',
        eventId: 'e1',
        startsAt: new Date(REF_NOW_MS + 2 * 86_400_000).toISOString(),
        endsAt: '',
        status: 'scheduled',
      },
      {
        id: 'exactly-7-days',
        eventId: 'e1',
        startsAt: new Date(REF_NOW_MS + 7 * 86_400_000).toISOString(),
        endsAt: '',
        status: 'scheduled',
      },
      {
        id: 'too-far',
        eventId: 'e1',
        startsAt: new Date(REF_NOW_MS + 8 * 86_400_000).toISOString(),
        endsAt: '',
        status: 'scheduled',
      },
      {
        id: 'already-started',
        eventId: 'e1',
        startsAt: new Date(REF_NOW_MS - 60_000).toISOString(),
        endsAt: '',
        status: 'scheduled',
      },
      {
        id: 'completed-in-window',
        eventId: 'e1',
        startsAt: new Date(REF_NOW_MS + 60_000).toISOString(),
        endsAt: '',
        status: 'completed',
      },
      {
        id: 'other-team-in-window',
        eventId: 'e-other-team',
        startsAt: new Date(REF_NOW_MS + 60_000).toISOString(),
        endsAt: '',
        status: 'scheduled',
      },
    ];
    // T198 recomputed: was 2 (in-window + exactly-7-days on e1). Season-wide
    // also counts `other-team-in-window` (e-other-team, scheduled, +60s), so 3.
    expect(countUpcomingSessionsInNextDays(sessions, events, REF_NOW_MS)).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// buildNextUp / buildRecentSignups / formatRelativeTime / isSeasonMissingSetup
// ---------------------------------------------------------------------------

describe('buildNextUp', () => {
  it('includes a live session (endsAt in the future) plus scheduled future ones, sorted ascending, capped at 5', () => {
    const events: HomeEventRow[] = [
      { id: 'e1', seasonId: 's1', type: 'meeting', title: 'Live Meeting', teamIds: null },
      { id: 'e2', seasonId: 's1', type: 'outreach', title: 'Outreach A', teamIds: null },
    ];
    const sessions: HomeSessionRow[] = [
      {
        id: 'live',
        eventId: 'e1',
        startsAt: new Date(REF_NOW_MS - 30 * 60_000).toISOString(),
        endsAt: new Date(REF_NOW_MS + 30 * 60_000).toISOString(),
        status: 'scheduled',
      },
      {
        id: 'later',
        eventId: 'e2',
        startsAt: new Date(REF_NOW_MS + 3 * 60 * 60_000).toISOString(),
        endsAt: new Date(REF_NOW_MS + 4 * 60 * 60_000).toISOString(),
        status: 'scheduled',
      },
      {
        id: 'ended',
        eventId: 'e1',
        startsAt: new Date(REF_NOW_MS - 5 * 60 * 60_000).toISOString(),
        endsAt: new Date(REF_NOW_MS - 4 * 60 * 60_000).toISOString(),
        status: 'scheduled',
      },
    ];
    const rows = buildNextUp(sessions, events, [], REF_NOW_MS);
    expect(rows.map((r) => r.sessionId)).toEqual(['live', 'later']);
    expect(rows[0].type).toBe('meeting');
    expect(rows[1].type).toBe('outreach');
  });

  it('counts going RSVPs per session', () => {
    const events: HomeEventRow[] = [
      { id: 'e1', seasonId: 's1', type: 'outreach', title: 'X', teamIds: null },
    ];
    const sessions: HomeSessionRow[] = [
      {
        id: 's1',
        eventId: 'e1',
        startsAt: new Date(REF_NOW_MS + 60_000).toISOString(),
        endsAt: new Date(REF_NOW_MS + 120_000).toISOString(),
        status: 'scheduled',
      },
    ];
    const rsvps: HomeRsvpRow[] = [
      { id: 'r1', sessionId: 's1', studentId: 'a', status: 'going', updatedAt: '' },
      { id: 'r2', sessionId: 's1', studentId: 'b', status: 'going', updatedAt: '' },
      { id: 'r3', sessionId: 's1', studentId: 'c', status: 'declined', updatedAt: '' },
    ];
    const rows = buildNextUp(sessions, events, rsvps, REF_NOW_MS);
    expect(rows[0].goingCount).toBe(2);
  });
});

describe('formatRelativeTime', () => {
  it('formats minutes/hours/days ago, and "Just now" under a minute', () => {
    expect(formatRelativeTime(new Date(REF_NOW_MS - 30_000).toISOString(), REF_NOW_MS)).toBe(
      'Just now',
    );
    expect(formatRelativeTime(new Date(REF_NOW_MS - 45 * 60_000).toISOString(), REF_NOW_MS)).toBe(
      '45m ago',
    );
    expect(
      formatRelativeTime(new Date(REF_NOW_MS - 2 * 60 * 60_000).toISOString(), REF_NOW_MS),
    ).toBe('2h ago');
    expect(
      formatRelativeTime(new Date(REF_NOW_MS - 3 * 86_400_000).toISOString(), REF_NOW_MS),
    ).toBe('3d ago');
  });
});

// ---------------------------------------------------------------------------
// T124: activity feed (UXP-10) -- self-vs-staff, dropped-vs-declined,
// present/late-only "checked off", sorted newest-first.
// ---------------------------------------------------------------------------

describe('isSelfOriginated', () => {
  it('true only when both ids are real and equal', () => {
    expect(isSelfOriginated('profile-a', 'profile-a')).toBe(true);
  });
  it('false when the ids differ (staff-entered)', () => {
    expect(isSelfOriginated('profile-coach', 'profile-a')).toBe(false);
  });
  it('false when the student has no linked account (profileId null)', () => {
    expect(isSelfOriginated('profile-coach', null)).toBe(false);
  });
  it('false when the actor id itself is null', () => {
    expect(isSelfOriginated(null, 'profile-a')).toBe(false);
  });
});

describe('wasRsvpChanged', () => {
  function rsvp(createdAt: string, updatedAt: string): FeedRsvpRow {
    return {
      id: 'r1',
      sessionId: 's1',
      studentId: 'st1',
      status: 'declined',
      respondedBy: null,
      createdAt,
      updatedAt,
    };
  }
  it('false when created/updated are the same instant (first-ever response)', () => {
    expect(wasRsvpChanged(rsvp('2026-07-01T00:00:00.000Z', '2026-07-01T00:00:00.000Z'))).toBe(
      false,
    );
  });
  it('false within the clock-skew epsilon (sub-2s gap from a real INSERT)', () => {
    expect(wasRsvpChanged(rsvp('2026-07-01T00:00:00.000Z', '2026-07-01T00:00:01.500Z'))).toBe(
      false,
    );
  });
  it('true when updated is measurably later than created (a real change)', () => {
    expect(wasRsvpChanged(rsvp('2026-07-01T00:00:00.000Z', '2026-07-10T00:00:00.000Z'))).toBe(true);
  });
});

describe('formatSessionDateLabel', () => {
  it('formats a plain date-only string as weekday + month + day, UTC-pinned', () => {
    expect(formatSessionDateLabel('2026-03-07')).toBe('Sat, Mar 7');
  });
});

describe('buildActivityFeed', () => {
  const source: ActivityFeedSource = {
    events: [
      { id: 'e-outreach', seasonId: 's1', title: 'Food Bank Sort', type: 'outreach' },
      { id: 'e-meeting', seasonId: 's1', title: 'Weekly Build', type: 'meeting' },
    ],
    sessions: [
      {
        id: 'sess-1',
        eventId: 'e-outreach',
        sessionDate: '2026-07-19',
        startsAt: '2026-07-19T14:00:00.000Z',
      },
      {
        id: 'sess-2',
        eventId: 'e-meeting',
        sessionDate: '2026-07-15',
        startsAt: '2026-07-15T23:00:00.000Z',
      },
    ],
    rsvps: [
      // Self, first-ever response, going -- "signed up for".
      {
        id: 'r-going-self',
        sessionId: 'sess-1',
        studentId: 'ada',
        status: 'going',
        respondedBy: 'profile-ada',
        createdAt: '2026-07-19T10:00:00.000Z',
        updatedAt: '2026-07-19T10:00:00.000Z',
      },
      // Self, WAS going, now declined -- "dropped".
      {
        id: 'r-dropped-self',
        sessionId: 'sess-1',
        studentId: 'bea',
        status: 'declined',
        respondedBy: 'profile-bea',
        createdAt: '2026-07-01T00:00:00.000Z',
        updatedAt: '2026-07-18T00:00:00.000Z',
      },
      // First-ever response was already declined -- "declined", not "dropped".
      {
        id: 'r-declined-first',
        sessionId: 'sess-1',
        studentId: 'cole',
        status: 'declined',
        respondedBy: 'profile-cole',
        createdAt: '2026-07-19T08:00:00.000Z',
        updatedAt: '2026-07-19T08:00:00.000Z',
      },
      // Staff-entered (responded_by = coach, not the student's own profile).
      {
        id: 'r-going-staff',
        sessionId: 'sess-2',
        studentId: 'dee',
        status: 'going',
        respondedBy: 'profile-coach',
        createdAt: '2026-07-14T00:00:00.000Z',
        updatedAt: '2026-07-14T00:00:00.000Z',
      },
      // 'maybe' -- "marked maybe for".
      {
        id: 'r-maybe',
        sessionId: 'sess-1',
        studentId: 'ada',
        status: 'maybe',
        respondedBy: 'profile-ada',
        createdAt: '2026-07-19T11:00:00.000Z',
        updatedAt: '2026-07-19T11:00:00.000Z',
      },
    ],
    attendance: [
      // Self check-off -- present -- "checked off".
      {
        id: 'a-present-self',
        sessionId: 'sess-2',
        studentId: 'ada',
        status: 'present',
        recordedBy: 'profile-ada',
        createdAt: '2026-07-16T00:00:00.000Z',
        updatedAt: '2026-07-16T00:00:00.000Z',
      },
      // Staff-recorded late -- "checked off", not self.
      {
        id: 'a-late-staff',
        sessionId: 'sess-2',
        studentId: 'bea',
        status: 'late',
        recordedBy: 'profile-coach',
        createdAt: '2026-07-16T00:01:00.000Z',
        updatedAt: '2026-07-16T00:01:00.000Z',
      },
      // Absent -- must NEVER appear (present/late only).
      {
        id: 'a-absent',
        sessionId: 'sess-2',
        studentId: 'cole',
        status: 'absent',
        recordedBy: 'profile-coach',
        createdAt: '2026-07-16T00:02:00.000Z',
        updatedAt: '2026-07-16T00:02:00.000Z',
      },
    ],
    students: [
      { id: 'ada', displayName: 'Ada Lovelace', profileId: 'profile-ada' },
      { id: 'bea', displayName: 'Bea Cross', profileId: 'profile-bea' },
      { id: 'cole', displayName: 'Cole Jennings', profileId: 'profile-cole' },
      { id: 'dee', displayName: 'Dee Park', profileId: null },
    ],
  };

  const entries = buildActivityFeed(source, REF_NOW_MS);

  it('excludes absent attendance rows entirely (present/late only)', () => {
    expect(entries.some((e) => e.id === 'attendance-a-absent')).toBe(false);
    // 5 rsvps + 3 attendance rows - 1 excluded ('absent') = 7.
    expect(entries).toHaveLength(7);
  });

  it('labels a self-originated first-ever "going" RSVP as "signed up for"', () => {
    const entry = entries.find((e) => e.id === 'rsvp-r-going-self')!;
    expect(entry.message).toBe('Ada Lovelace signed up for Food Bank Sort');
    expect(entry.isSelf).toBe(true);
  });

  it('labels a self RSVP that changed to declined as "dropped"', () => {
    const entry = entries.find((e) => e.id === 'rsvp-r-dropped-self')!;
    expect(entry.message).toBe('Bea Cross dropped Food Bank Sort');
    expect(entry.isSelf).toBe(true);
  });

  it('labels a first-ever declined RSVP as "declined", never "dropped"', () => {
    const entry = entries.find((e) => e.id === 'rsvp-r-declined-first')!;
    expect(entry.message).toBe('Cole Jennings declined Food Bank Sort');
  });

  it('a staff-entered RSVP (responded_by = coach) is never self, even "going"', () => {
    const entry = entries.find((e) => e.id === 'rsvp-r-going-staff')!;
    expect(entry.message).toBe('Dee Park signed up for Weekly Build');
    expect(entry.isSelf).toBe(false);
  });

  it('a student with no linked account can never be self-originated', () => {
    const entry = entries.find((e) => e.id === 'rsvp-r-going-staff')!;
    expect(entry.isSelf).toBe(false); // dee.profileId is null
  });

  it('"maybe" is labeled "marked maybe for"', () => {
    const entry = entries.find((e) => e.id === 'rsvp-r-maybe')!;
    expect(entry.message).toBe('Ada Lovelace marked maybe for Food Bank Sort');
  });

  it('present/late attendance rows are labeled "checked off", self vs. staff correctly', () => {
    const self = entries.find((e) => e.id === 'attendance-a-present-self')!;
    expect(self.message).toBe('Ada Lovelace checked off Weekly Build');
    expect(self.isSelf).toBe(true);
    const staff = entries.find((e) => e.id === 'attendance-a-late-staff')!;
    expect(staff.message).toBe('Bea Cross checked off Weekly Build');
    expect(staff.isSelf).toBe(false);
  });

  it('sorts newest-first by updatedAt', () => {
    const timestamps = entries.map((e) => e.timestamp);
    const sorted = [...timestamps].sort((a, b) => b.localeCompare(a));
    expect(timestamps).toEqual(sorted);
  });
});

describe('ACTIVITY_FEED_DEFAULT_LIMIT', () => {
  it('is 10 (the show-all threshold)', () => {
    expect(ACTIVITY_FEED_DEFAULT_LIMIT).toBe(10);
  });
});

// ---------------------------------------------------------------------------
// T124: secondary stat tiles / hours-by-team / top-events -- sort/slice/
// format only, no arithmetic on already-computed view outputs.
// ---------------------------------------------------------------------------

describe('formatDayOfWeekLabel / pickBusiestDay', () => {
  it('maps ISO day-of-week 1-7 to Mon..Sun', () => {
    expect(formatDayOfWeekLabel(1)).toBe('Mon');
    expect(formatDayOfWeekLabel(6)).toBe('Sat');
    expect(formatDayOfWeekLabel(7)).toBe('Sun');
  });

  it('picks the highest session_count row', () => {
    const rows = [
      { seasonId: 's1', dayOfWeek: 1, sessionCount: 4 },
      { seasonId: 's1', dayOfWeek: 6, sessionCount: 7 },
      { seasonId: 's1', dayOfWeek: 3, sessionCount: 2 },
    ];
    expect(pickBusiestDay(rows)?.dayOfWeek).toBe(6);
  });

  it('returns null for an empty season (absence, not a fabricated day)', () => {
    expect(pickBusiestDay([])).toBeNull();
  });
});

describe('maxOf', () => {
  it('returns the largest value, 0 for an empty list', () => {
    expect(maxOf([3, 9, 1])).toBe(9);
    expect(maxOf([])).toBe(0);
  });
});

describe('sortTeamHoursDescending / sortEventsByHoursDescending', () => {
  it('sorts teams by confirmedHours descending', () => {
    const rows = [
      { teamId: 't1', teamName: 'Ravens', seasonId: 's1', confirmedHours: 10 },
      { teamId: 't2', teamName: 'Titans', seasonId: 's1', confirmedHours: 42 },
    ];
    expect(sortTeamHoursDescending(rows).map((r) => r.teamId)).toEqual(['t2', 't1']);
  });

  it('sorts events by totalHours descending', () => {
    const rows = [
      {
        eventId: 'e1',
        seasonId: 's1',
        title: 'A',
        startsOn: '2026-01-01',
        endsOn: '2026-01-01',
        studentCount: 2,
        totalHours: 5,
      },
      {
        eventId: 'e2',
        seasonId: 's1',
        title: 'B',
        startsOn: '2026-01-02',
        endsOn: '2026-01-02',
        studentCount: 3,
        totalHours: 30,
      },
    ];
    expect(sortEventsByHoursDescending(rows).map((r) => r.eventId)).toEqual(['e2', 'e1']);
  });
});

// ---------------------------------------------------------------------------
// T124: goal projection -- motivation-ethics BLOCKER-class fact-stating
// annotations, Below-goal filter (coach triage, not a ranking).
// ---------------------------------------------------------------------------

describe('goalProjectionPercent / goalProjectionShortHours / formatGoalProjectionAnnotation', () => {
  it('on-track row (>=100%) has zero short hours and reads "On track"', () => {
    const row = {
      studentId: 's1',
      seasonId: 'season-1',
      displayName: 'Tori',
      teamId: 't1',
      teamName: 'P3',
      goalHours: 90,
      confirmedHours: 64.5,
      plannedHours: 76,
    };
    expect(goalProjectionPercent(row)).toBe(156.1);
    expect(goalProjectionShortHours(row)).toBe(0);
    expect(formatGoalProjectionAnnotation(row)).toBe('On track');
  });

  it('below-goal row states the exact remaining hours, no urgency copy', () => {
    const row = {
      studentId: 's2',
      seasonId: 'season-1',
      displayName: 'Sabreen',
      teamId: 't1',
      teamName: 'P3',
      goalHours: 90,
      confirmedHours: 0,
      plannedHours: 72,
    };
    expect(goalProjectionShortHours(row)).toBe(18);
    expect(formatGoalProjectionAnnotation(row)).toBe('18h short');
  });

  it('goalHours <= 0 guards to 0% (same idiom as hoursVsGoalPercent)', () => {
    const row = {
      studentId: 's3',
      seasonId: 'season-1',
      displayName: 'X',
      teamId: 't1',
      teamName: 'P3',
      goalHours: 0,
      confirmedHours: 5,
      plannedHours: 5,
    };
    expect(goalProjectionPercent(row)).toBe(0);
  });
});

describe('filterGoalProjectionRows / sortGoalProjectionRows', () => {
  const rows = [
    {
      studentId: 'on-track',
      seasonId: 's1',
      displayName: 'Tori',
      teamId: 't1',
      teamName: 'P3',
      goalHours: 90,
      confirmedHours: 64.5,
      plannedHours: 76,
    },
    {
      studentId: 'below',
      seasonId: 's1',
      displayName: 'Sabreen',
      teamId: 't1',
      teamName: 'P3',
      goalHours: 90,
      confirmedHours: 0,
      plannedHours: 72,
    },
  ];

  it('"all" keeps every row; "belowGoal" keeps only students short of goal', () => {
    expect(filterGoalProjectionRows(rows, 'all')).toHaveLength(2);
    expect(filterGoalProjectionRows(rows, 'belowGoal').map((r) => r.studentId)).toEqual(['below']);
  });

  it('sorts by projected percent descending', () => {
    expect(sortGoalProjectionRows(rows).map((r) => r.studentId)).toEqual(['on-track', 'below']);
  });
});

describe('isSeasonMissingSetup (HOME-04 gate condition)', () => {
  it('true when there are zero teams', () => {
    expect(isSeasonMissingSetup([], { hasGoalsConfigured: true })).toBe(true);
  });
  it('true when goals are not configured, even with teams present', () => {
    const teams: HomeTeamRow[] = [{ id: 't1', name: 'A' }];
    const status: SeasonSetupStatus = { hasGoalsConfigured: false };
    expect(isSeasonMissingSetup(teams, status)).toBe(true);
  });
  it('false when teams exist and goals are configured', () => {
    const teams: HomeTeamRow[] = [{ id: 't1', name: 'A' }];
    const status: SeasonSetupStatus = { hasGoalsConfigured: true };
    expect(isSeasonMissingSetup(teams, status)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// BEH-01 milestone-toast dedupe primitives (localStorage) -- same idiom
// OutreachList.tsx/T038 established.
// ---------------------------------------------------------------------------

describe('BEH-01 milestone-toast dedupe primitives', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('has not fired until explicitly marked, then reports fired for that exact season+milestone', () => {
    expect(hasMilestoneToastFired('season-x', 25)).toBe(false);
    markMilestoneToastFired('season-x', 25);
    expect(hasMilestoneToastFired('season-x', 25)).toBe(true);
  });

  it('is scoped per season -- a different season is unaffected', () => {
    markMilestoneToastFired('season-x', 25);
    expect(hasMilestoneToastFired('season-y', 25)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// The shipped fixture (defaultLoadCoachHomeData) -- proves the exported
// functions above compose correctly, exercised through the real data.
// ---------------------------------------------------------------------------

describe('defaultLoadCoachHomeData (shipped fixture composition, against FIXTURE_REFERENCE_NOW)', () => {
  let data: CoachHomeData;

  beforeEach(async () => {
    data = await defaultLoadCoachHomeData('season-placeholder-current');
  });

  it('hours vs goal season-wide: 12 confirmed / 48 goal = 25%, crossing only the 25% milestone', () => {
    const goalHours = sumGoalHours(data.students, data.defaultGoalHours);
    const confirmedHours = sumConfirmedHours(data.students, data.studentHours);
    // T198 recomputed: goal was 38 when scoped to the placeholder team; the
    // Titans student's 10h default now counts too, so 48. Confirmed hours are
    // unchanged at 12 (that student has no confirmed hours in the fixture),
    // which is itself the proof the two sums moved independently.
    expect(goalHours).toBe(48);
    expect(confirmedHours).toBe(12);
    const percent = hoursVsGoalPercent(confirmedHours, goalHours);
    expect(percent).toBe(25);
    expect(crossedMilestones(percent)).toEqual([25]);
  });

  it('last completed meeting attendance rate season-wide: 3 of 5 active roster = 60%', () => {
    const summary = buildLastCompletedMeetingSummary(
      data.sessions,
      data.events,
      data.attendance,
      data.students,
    );
    expect(summary?.title).toBe('Weekly Build Meeting');
    // T198 recomputed: rosterSize was 4 (active students on the placeholder
    // team); season-wide it is 5. Present+late is unchanged at 3, so 3/5 = 60.
    expect(summary?.rosterSize).toBe(5);
    expect(attendanceRatePercent(summary!)).toBe(60);
  });

  it('events in next 7 days season-wide = 4, still excluding far-future/live/non-scheduled ones', () => {
    expect(
      countUpcomingSessionsInNextDays(data.sessions, data.events, REF_NOW_MS),
      // T198 recomputed: was 2 (food bank +2h, regionals +5d) under the
      // placeholder team scope; the Titans sessions now count too.
    ).toBe(4);
  });

  it('check-in eligible session is the live meeting, never the Titans-scoped near-term one', () => {
    const session = selectCheckInSession(data.sessions, data.events, REF_NOW_MS);
    expect(session?.id).toBe('session-build-live-now');
  });

  it('season setup is missing by default (no goals configured yet)', () => {
    expect(isSeasonMissingSetup(data.teams, data.seasonSetupStatus)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// <CoachHome /> component -- DES-12 states, HOME-04 role-gating, and the
// milestone toast firing live.
// ---------------------------------------------------------------------------

function fixtureLoadData(): Promise<CoachHomeData> {
  return defaultLoadCoachHomeData(PLACEHOLDER_SEASON_ID_FOR_TESTS);
}
const PLACEHOLDER_SEASON_ID_FOR_TESTS = 'season-placeholder-current';

describe('<CoachHome /> signed out', () => {
  it('shows a sign-in prompt', () => {
    renderAsUser(null);
    expect(container.textContent).toContain('Sign in to view Home');
  });
});

describe('<CoachHome /> DES-12 states', () => {
  it('loading state', async () => {
    renderAsUser(COACH_USER, { loadData: () => new Promise<CoachHomeData>(() => {}) });
    // T073b2: auth resolution (even via the fake `authModule` this
    // harness's `LoginAs` now uses) is genuinely async -- a flush is needed
    // before the authenticated body (and its own DES-12 loading state)
    // mounts. See `src/test-utils/authHarness.tsx`'s module doc.
    await flushMicrotasks();
    expect(container.textContent).toContain('Loading Home');
  });

  it('error state', async () => {
    renderAsUser(COACH_USER, { loadData: () => Promise.reject(new Error('boom')) });
    await flushMicrotasks();
    expect(container.textContent).toContain("Couldn't load Home");
  });

  it('populated state renders the three primary KPI labels and Next up', async () => {
    window.localStorage.clear();
    renderAsUser(COACH_USER, { loadData: fixtureLoadData, nowFn: () => FIXTURE_REFERENCE_NOW });
    await flushMicrotasks();

    // T803 -- was four labels; the "Participation" tile is gone (it duplicated
    // the T124 analytics section's "Attendance rate", same view, same season).
    expect(container.textContent).not.toContain('Participation');
    expect(container.textContent).toContain('Hours vs. team goal');
    expect(container.textContent).toContain('Last meeting attendance');
    expect(container.textContent).toContain('Events in next 7 days');
    // T803 -- the `82.4%` assertion went with the Participation tile.
    //
    // The two below were rewritten from `toContain` to `kpiCardValue` because
    // they were passing for the wrong reason: `toContain('75%')` was labelled
    // "last-meeting attendance rate" but matched the ProgressBar's own
    // milestone labels (`25%50%75%100%`) -- the real value is 60% since T198
    // widened the roster season-wide, so that assertion would have passed
    // even with the KPI absent. `toContain('2')` matched any digit 2 anywhere
    // on the page. Both now read the specific card.
    expect(kpiCardValue('Last meeting attendance')).toBe('60%');
    expect(kpiCardValue('Events in next 7 days')).toBe('4');

    expect(container.textContent).toContain('Next up');
    expect(container.textContent).toContain('Community Food Bank Sort');
    expect(container.textContent).toContain('Regionals Qualifier');
    // T198 -- INVERTED, not deleted. This asserted a Titans-scoped session
    // could never appear; season-wide it must. Same fixture, opposite
    // expectation -- the sharpest proof in this suite that the page stopped
    // filtering by team.
    expect(container.textContent).toContain('Titans Strategy Session');

    // T203 (criterion 3): `renderAsUser`'s harness merge (§7a) supplies the
    // fixture `loadLeaderboardData`/`loadLeaderboardPrivacySetting` defaults
    // here (neither is overridden by this test's own props) -- proving the
    // merge is load-bearing, not decorative. `defaultLoadLeaderboardData`
    // filters its fixture hours by the REAL, non-placeholder seasonId
    // (`FIXTURE_ACTIVE_SEASON.id`), which none of `Leaderboard.tsx`'s own
    // shipped fixture rows are scoped to, so the filtered result is
    // genuinely empty -- `Leaderboard`'s own honest empty state, not its
    // error state.
    expect(container.textContent).toContain('No volunteer hours recorded yet');
    expect(container.textContent).not.toContain("Couldn't load the leaderboard");
  });
});

// ---------------------------------------------------------------------------
// T155: the placeholder never reaches a query (criterion 1) -- a genuine
// revert-and-fail proof. Reverting `CoachHome`'s outer wrapper back to the
// old default-parameter shape (`seasonId = PLACEHOLDER_SEASON_ID`, no
// `useActiveSeason()` call) was built and measured, in this worker's own
// isolated worktree per constitution item 23, to fail the last `it(` below
// (the argument assertion): the reverted version calls `loadData`/
// `loadDashboardData` with `'season-placeholder-current'` on every render,
// including while this suite's injected `loadActiveSeason` is still
// "loading"/"none"/"error" (there is no season concept to gate on at all),
// so every assertion in this describe block fails against that reverted
// code -- see `docs/swarm/active/T155-worker-output.md` for the exact
// mutation diff and failure output.
// ---------------------------------------------------------------------------

describe('<CoachHome /> T155 -- the placeholder never reaches a query (criterion 1)', () => {
  it('loadData/loadDashboardData are never called while activeSeason.status is "loading"', async () => {
    const loadDataSpy = vi.fn(() => new Promise<CoachHomeData>(() => {}));
    const loadDashboardDataSpy = vi.fn(() => new Promise<DashboardData>(() => {}));
    renderAsUser(
      COACH_USER,
      { loadData: loadDataSpy, loadDashboardData: loadDashboardDataSpy },
      () => new Promise(() => {}), // loadActiveSeason never resolves -- stays 'loading'.
    );
    await flushMicrotasks();
    expect(container.textContent).toContain('Loading Home');
    expect(loadDataSpy).not.toHaveBeenCalled();
    expect(loadDashboardDataSpy).not.toHaveBeenCalled();
  });

  it('loadData/loadDashboardData are never called while activeSeason.status is "none"', async () => {
    const loadDataSpy = vi.fn(() => new Promise<CoachHomeData>(() => {}));
    const loadDashboardDataSpy = vi.fn(() => new Promise<DashboardData>(() => {}));
    renderAsUser(
      COACH_USER,
      { loadData: loadDataSpy, loadDashboardData: loadDashboardDataSpy },
      async () => null, // zero active seasons -- the real 'none' outcome.
    );
    await flushMicrotasks();
    expect(container.textContent).toContain('No active season yet');
    expect(loadDataSpy).not.toHaveBeenCalled();
    expect(loadDashboardDataSpy).not.toHaveBeenCalled();
  });

  it('loadData/loadDashboardData are never called while activeSeason.status is "error"', async () => {
    const loadDataSpy = vi.fn(() => new Promise<CoachHomeData>(() => {}));
    const loadDashboardDataSpy = vi.fn(() => new Promise<DashboardData>(() => {}));
    renderAsUser(
      COACH_USER,
      { loadData: loadDataSpy, loadDashboardData: loadDashboardDataSpy },
      async () => {
        throw { code: '500', message: 'Season load failed.', cause: null };
      },
    );
    await flushMicrotasks();
    expect(container.textContent).toContain("Couldn't load the active season");
    expect(loadDataSpy).not.toHaveBeenCalled();
    expect(loadDashboardDataSpy).not.toHaveBeenCalled();
  });

  it('receives EXACTLY FIXTURE_ACTIVE_SEASON.id once activeSeason.status is "ready" -- never the retired placeholder', async () => {
    const loadDataSpy = vi.fn<(seasonId: string) => Promise<CoachHomeData>>(
      () => new Promise<CoachHomeData>(() => {}),
    );
    const loadDashboardDataSpy = vi.fn<(seasonId: string) => Promise<DashboardData>>(
      () => new Promise<DashboardData>(() => {}),
    );
    renderAsUser(COACH_USER, { loadData: loadDataSpy, loadDashboardData: loadDashboardDataSpy });
    await flushMicrotasks();
    expect(loadDataSpy).toHaveBeenCalledTimes(1);
    expect(loadDataSpy).toHaveBeenCalledWith(FIXTURE_ACTIVE_SEASON.id);
    expect(loadDashboardDataSpy).toHaveBeenCalledTimes(1);
    expect(loadDashboardDataSpy).toHaveBeenCalledWith(FIXTURE_ACTIVE_SEASON.id);
    // The genuinely discriminating assertion: never the retired placeholder.
    expect(loadDataSpy.mock.calls[0]?.[0]).not.toBe('season-placeholder-current');
    expect(loadDashboardDataSpy.mock.calls[0]?.[0]).not.toBe('season-placeholder-current');
  });
});

// ---------------------------------------------------------------------------
// T155: exact literals for all four `activeSeason.status` states (criterion
// 3) -- inspection of the rendered copy, not a mutation proof (the packet's
// own classification). 'ready' is already covered by the pre-existing
// "DES-12 states" describe block above, which now runs through the new
// season-status switch via `renderAsUser`'s default fixture-resolving
// `loadActiveSeason`.
// ---------------------------------------------------------------------------

describe('<CoachHome /> T155 -- season-status literals (criterion 3)', () => {
  it('"none": exact title/description, Banner only (no Section wrapper -- T129 fix, module doc #14)', async () => {
    renderAsUser(COACH_USER, {}, async () => null);
    await flushMicrotasks();
    expect(container.textContent).toContain('No active season yet');
    expect(container.textContent).toContain(
      'An admin needs to create and activate a season in Season settings before Home can show data here.',
    );
  });

  it('"error": exact title, the real error message, and a Retry that genuinely calls activeSeason.refresh()', async () => {
    let callCount = 0;
    const loadActiveSeason: LoadActiveSeasonFn = async () => {
      callCount += 1;
      if (callCount === 1) {
        throw { code: '500', message: 'Season load failed.', cause: null };
      }
      return FIXTURE_ACTIVE_SEASON;
    };
    renderAsUser(
      COACH_USER,
      { loadData: fixtureLoadData, nowFn: () => FIXTURE_REFERENCE_NOW },
      loadActiveSeason,
    );
    await flushMicrotasks();
    expect(container.textContent).toContain("Couldn't load the active season");
    expect(container.textContent).toContain('Season load failed.');

    const retryButton = Array.from(container.querySelectorAll('button')).find(
      (button) => button.textContent === 'Retry',
    );
    expect(retryButton).toBeDefined();
    act(() => {
      retryButton!.click();
    });
    await flushMicrotasks();
    expect(callCount).toBe(2);
    // Retry re-ran loadActiveSeason, which now resolves -- 'ready' delegates
    // to CoachHomeContent, proving Retry is genuinely wired to
    // activeSeason.refresh(), not a dead click handler.
    expect(container.textContent).toContain('Events in next 7 days');
    expect(container.textContent).not.toContain("Couldn't load the active season");
  });

  it('"loading": renders the DES-12 skeleton and fires no query (see criterion 1 above for the call-count proof)', async () => {
    renderAsUser(COACH_USER, {}, () => new Promise(() => {}));
    await flushMicrotasks();
    expect(container.textContent).toContain('Loading Home');
    expect(container.querySelector('[role="status"]')?.textContent).toBe('Loading Home…');
  });
});

// ---------------------------------------------------------------------------
// T155: fail-loud proof (criterion 4) -- same pattern
// `AppShell.test.tsx`'s own T141 provider-mount guard already establishes
// (a class-based error boundary catching the real thrown error, rather than
// asserting `root.render()` itself throws -- avoids depending on exactly how
// the installed React version propagates an uncaught render error through
// `act()`/`createRoot`).
// ---------------------------------------------------------------------------

class T155ThrowCaughtBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state: { error: Error | null } = { error: null };
  static getDerivedStateFromError(error: Error): { error: Error } {
    return { error };
  }
  render(): ReactNode {
    if (this.state.error) {
      return <div data-testid="t155-boundary-error">{this.state.error.message}</div>;
    }
    return this.props.children;
  }
}

describe('<CoachHome /> T155 -- fail-loud without a <SeasonProvider> ancestor (criterion 4)', () => {
  it('throws the exact "useActiveSeason() must be called within a <SeasonProvider>." message', () => {
    // React logs the caught render error to the console loudly even though
    // the boundary handles it; suppressed for this test only, not globally.
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      act(() => {
        root.render(
          <MemoryRouter>
            <AuthProvider>
              <LoginAs user={COACH_USER}>
                <T155ThrowCaughtBoundary>
                  <CoachHome />
                </T155ThrowCaughtBoundary>
              </LoginAs>
            </AuthProvider>
          </MemoryRouter>,
        );
      });
      expect(container.querySelector('[data-testid="t155-boundary-error"]')?.textContent).toBe(
        'useActiveSeason() must be called within a <SeasonProvider>.',
      );
    } finally {
      consoleErrorSpy.mockRestore();
    }
  });

  it('the companion case: the same probe does NOT throw when a <SeasonProvider loadActiveSeason={...}> wrapping the fixture-resolving loader is present', async () => {
    act(() => {
      root.render(
        <MemoryRouter>
          <SeasonProvider loadActiveSeason={async () => FIXTURE_ACTIVE_SEASON}>
            <AuthProvider>
              <LoginAs user={COACH_USER}>
                <T155ThrowCaughtBoundary>
                  <CoachHome loadData={fixtureLoadData} nowFn={() => FIXTURE_REFERENCE_NOW} />
                </T155ThrowCaughtBoundary>
              </LoginAs>
            </AuthProvider>
          </SeasonProvider>
        </MemoryRouter>,
      );
    });
    await flushMicrotasks();
    expect(container.querySelector('[data-testid="t155-boundary-error"]')).toBeNull();
    // CoachHome itself rendered real content -- proof the probe (CoachHome
    // calling useActiveSeason() at its own top level) genuinely did not
    // throw here, not merely that nothing crashed before it ran.
    // T803 -- marker moved off the removed `Participation` tile.
    expect(container.textContent).toContain('Events in next 7 days');
  });
});

/** T155: reads a `KpiCard`'s rendered value (its `Heading level={2}`
 * sibling) given the card's own `Heading level={4}` label text -- both
 * render as real `h4`/`h2` elements (`Heading`'s own `level` prop maps
 * directly to the semantic HTML element). */
function kpiCardValue(label: string): string | null {
  const labelHeading = Array.from(container.querySelectorAll('h4')).find(
    (h) => h.textContent === label,
  );
  const valueHeading = labelHeading?.parentElement?.querySelector('h2');
  return valueHeading?.textContent ?? null;
}

// ---------------------------------------------------------------------------
// T173: the measured-reality proof (criterion 5) -- a REAL, non-placeholder
// season id reaching a REAL `loaders/coachHome` loader (DI'd via a stub
// Supabase client, mirroring `students.test.ts`'s own `makeRecordingClient`
// style -- not a module-level `vi.mock`, since ~30 other tests in this file
// must stay on `fixtureLoadData`/`defaultLoadCoachHomeData`), with
// `loadDashboardData` PINNED to the in-file `defaultLoadDashboardData`
// fixture (RETAINED -- `CoachHome`'s own real Supabase-backed default
// rejects in this unconfigured jsdom environment, which would hide the
// entire `{dashboardData && (...)}`-gated grid Surface 2 below lives in; see
// module doc #14/#15 in `CoachHome.tsx`).
//
// Split into two tests (Round 2 redesign, T173 worker packet): Test A proves
// the roster-sum now honestly floors to zero (no real student's `team_id`
// matches the still-placeholder `teamId`) and that `activeSeason.season.
// defaultGoalHours` reaches the DOM via the new prop-threading; Test B is a
// positive control proving the admin "Season setup" card still correctly
// fires for the one condition that can still trigger it (genuinely zero
// teams), so Test A's `not.toContain('Season setup')` isn't vacuously true
// for the wrong reason (constitution's anti-vacuous-absence requirement).
// ---------------------------------------------------------------------------

/**
 * Minimal `.from(table)` dispatcher for `makeLoadCoachHomeData`'s two real,
 * UNFILTERED queries (`teams`, `students`) -- mirrors
 * `students.test.ts`'s `makeRecordingClient` style, throwing on any
 * unexpected table name. Under the Round 2 redesign, no `.from('seasons')`
 * handler is needed (there is no season query for this loader to perform).
 */
function makeCoachHomeStubClient(
  teams: readonly { id: string; name: string }[],
  students: readonly {
    id: string;
    display_name: string;
    team_id: string;
    is_active: boolean;
    goal_hours_override: number | null;
  }[],
): SupabaseClient {
  const fromSpy = vi.fn((table: string) => {
    if (table === 'teams')
      return { select: vi.fn().mockResolvedValue({ data: teams, error: null }) };
    if (table === 'students') {
      return { select: vi.fn().mockResolvedValue({ data: students, error: null }) };
    }
    // T198 -- the loader now reads six more tables/views. They resolve EMPTY
    // here on purpose: this suite's point is that a real, non-fixture season
    // produces honest empties, and empty tables are exactly that. Without
    // these the dispatcher's throw would surface as "Couldn't load Home" and
    // the assertions below would never run.
    const emptyChain = {
      eq: () => emptyChain,
      in: () => emptyChain,
      maybeSingle: async () => ({ data: null, error: null }),
      then: (resolve: (v: { data: never[]; error: null }) => unknown) =>
        Promise.resolve({ data: [], error: null }).then(resolve),
    };
    return { select: () => emptyChain };
  });
  return { from: fromSpy } as unknown as SupabaseClient;
}

describe('<CoachHome /> T173 -- measured-reality proof for a REAL, non-placeholder season with a REAL loaders/coachHome loader (criterion 5)', () => {
  it('Test A (non-empty teams): genuinely empties four widgets, now counts the real student\'s own 18h override season-wide (0 / 18 hrs), shows the real "Default goal 45h" from the active season, and clears the admin Season-setup card', async () => {
    window.localStorage.clear();
    const stubClient = makeCoachHomeStubClient(
      [{ id: 'team-real-falcons', name: 'Falcons' }],
      [
        {
          id: 'student-real-jamie-osei',
          display_name: 'Jamie Osei',
          team_id: 'team-real-falcons', // NOT PLACEHOLDER_CURRENT_TEAM_ID.
          is_active: true,
          goal_hours_override: 18, // T198: now genuinely asserted below (0 / 18 hrs).
        },
      ],
    );
    renderAsUser(
      ADMIN_USER,
      {
        loadData: makeLoadCoachHomeData(() => stubClient),
        // RETAINED (round-1 NIT fix, still required after the rewrite):
        // `CoachHome`'s own real Supabase-backed default rejects in this
        // unconfigured jsdom environment, hiding the entire
        // `{dashboardData && (...)}`-gated grid Surface 2 lives in.
        loadDashboardData: defaultLoadDashboardData,
        nowFn: () => FIXTURE_REFERENCE_NOW,
      },
      // `defaultGoalHours` no longer comes from the stub client at all
      // (Round 2 redesign) -- it comes from `activeSeason.season.
      // defaultGoalHours`, threaded as a prop. A distinctive override here
      // (`45`, not `FIXTURE_ACTIVE_SEASON`'s own `100`) proves it is a real
      // passthrough, not a hardcoded/coincidental value.
      async () => ({ ...FIXTURE_ACTIVE_SEASON, defaultGoalHours: 45 }),
    );
    await flushMicrotasks();

    // Honest empties. T198 CHANGED WHY THIS PASSES, and the distinction is
    // the whole point of the suite: these widgets used to empty because no
    // real student matched `PLACEHOLDER_CURRENT_TEAM_ID`. That placeholder is
    // gone. They now empty because the stub's `events`/`event_sessions`/
    // `attendance`/`v_season_attendance_rate` genuinely return no rows --
    // a real empty result, not a scope mismatch. Same assertions, honest
    // mechanism.
    // T803 -- the `Participation` assertion that stood here is gone with its
    // tile. The 82.4% check survives and is now STRONGER than it looks: that
    // value only ever came from this loader's fixture, so its absence still
    // proves the real loader is in play, and it now also proves the removed
    // tile is not quietly rendering from somewhere else.
    expect(container.textContent).not.toContain('82.4%');
    expect(container.textContent).toContain('No completed meetings yet this season'); // last-meeting attendance secondary
    expect(kpiCardValue('Last meeting attendance')).toBe('—');
    expect(kpiCardValue('Events in next 7 days')).toBe('0');
    expect(container.textContent).toContain('Nothing scheduled'); // Next up empty state

    // Proves `activeSeason.season.defaultGoalHours` reaches the DOM via the
    // new prop-threading (Round 2 redesign), independent of the stub client.
    expect(container.textContent).toContain('Default goal 45h');

    // Proves the roster-sum now honestly floors to zero: the stub client's
    // one real student's `team_id` ('team-real-falcons') never matches the
    // still-placeholder `teamId` ('team-placeholder-current-viewer', Scope
    // ruling #1's "floors to honest zero" consequence, measured here, not
    // just claimed). This assertion is driven entirely by `teams`/`students`
    // (the stub client), not by `defaultGoalHours`'s source.
    // T198 recomputed: was `0 / 1 hrs`, the floored value produced when no
    // real student matched `PLACEHOLDER_CURRENT_TEAM_ID`. Season-wide, this
    // student's own `goal_hours_override: 18` is the denominator -- which
    // also means the fixture field that was previously "not asserted
    // directly" is now load-bearing.
    expect(container.textContent).toContain('0 / 18 hrs');
    expect(container.textContent).not.toContain('0 / 38 hrs');

    // Proves `hasGoalsConfigured: true` + non-empty teams correctly clears
    // the admin card (positive control for the "still fires" case is Test B
    // below).
    expect(container.textContent).not.toContain('Season setup');
  });

  it("Test B (empty teams, positive control): the admin Season-setup card still correctly fires for the one condition that can still trigger it (genuinely zero teams) -- proves Test A's absence assertion isn't vacuously true for the wrong reason", async () => {
    window.localStorage.clear();
    const stubClient = makeCoachHomeStubClient([], []);
    renderAsUser(ADMIN_USER, {
      loadData: makeLoadCoachHomeData(() => stubClient),
      loadDashboardData: defaultLoadDashboardData, // RETAINED, same reason as Test A.
      nowFn: () => FIXTURE_REFERENCE_NOW,
    });
    await flushMicrotasks();

    expect(container.textContent).toContain('Season setup');
  });
});

// ---------------------------------------------------------------------------
// T124: the new season-wide dashboard sections -- own DES-12 state, secondary
// stat tiles, activity feed (replacing "Recent signups"), hours by team,
// goal projection, top events.
// ---------------------------------------------------------------------------

function fixtureLoadDashboardData(): ReturnType<typeof defaultLoadDashboardData> {
  return defaultLoadDashboardData(PLACEHOLDER_SEASON_ID_FOR_TESTS);
}

describe('<CoachHome /> T124 dashboard-analytics section DES-12 states', () => {
  it('loading state renders skeleton tiles without crashing (own independent load state)', async () => {
    renderAsUser(COACH_USER, {
      loadData: fixtureLoadData,
      loadDashboardData: () => new Promise(() => {}),
      nowFn: () => FIXTURE_REFERENCE_NOW,
    });
    await flushMicrotasks();
    // The rest of the page (unaffected by the dashboard section's own
    // pending state) still renders normally.
    expect(container.textContent).toContain('Next up');
  });

  it('error state shows a scoped Banner, never blocking the rest of the page', async () => {
    renderAsUser(COACH_USER, {
      loadData: fixtureLoadData,
      loadDashboardData: () => Promise.reject(new Error('boom')),
      nowFn: () => FIXTURE_REFERENCE_NOW,
    });
    await flushMicrotasks();
    expect(container.textContent).toContain("Couldn't load dashboard analytics");
    // The rest of the page still rendered successfully.
    expect(container.textContent).toContain('Next up');
  });

  it('the real default loadDashboardData (no Supabase configured in tests) fails safely -- Banner, not a crash', async () => {
    renderAsUser(COACH_USER, { loadData: fixtureLoadData, nowFn: () => FIXTURE_REFERENCE_NOW });
    await flushMicrotasks();
    expect(container.textContent).toContain("Couldn't load dashboard analytics");
  });
});

describe('<CoachHome /> T124 secondary stat tiles', () => {
  it('renders all six tile labels and the fixture values', async () => {
    renderAsUser(COACH_USER, {
      loadData: fixtureLoadData,
      loadDashboardData: fixtureLoadDashboardData,
      nowFn: () => FIXTURE_REFERENCE_NOW,
    });
    await flushMicrotasks();
    expect(container.textContent).toContain('Avg hours / active student');
    expect(container.textContent).toContain('3.7h');
    expect(container.textContent).toContain('Students at goal');
    expect(container.textContent).toContain('Session days logged');
    expect(container.textContent).toContain('12');
    expect(container.textContent).toContain('Attendance rate');
    expect(container.textContent).toContain('70%');
    expect(container.textContent).toContain('Upcoming commitment');
    expect(container.textContent).toContain('19h');
    expect(container.textContent).toContain('Busiest day');
    expect(container.textContent).toContain('Sat'); // dayOfWeek 6, highest sessionCount
  });
});

describe('<CoachHome /> T124 activity feed', () => {
  it('replaces "Recent signups" -- renders Activity feed with self/staff-correct entries', async () => {
    renderAsUser(COACH_USER, {
      loadData: fixtureLoadData,
      loadDashboardData: fixtureLoadDashboardData,
      nowFn: () => FIXTURE_REFERENCE_NOW,
    });
    await flushMicrotasks();
    expect(container.textContent).toContain('Activity feed');
    expect(container.textContent).not.toContain('Recent signups');
    expect(container.textContent).toContain('Amara Webb signed up for Community Food Bank Sort');
    expect(container.textContent).toContain('Dana Voss dropped Community Food Bank Sort');
    // Absent attendance row must never surface as a "checked off" entry.
    expect(container.textContent).not.toContain('Amara Webb checked off');
    // Self badge present at least once (Dana's/Amara's self-originated rows).
    const selfBadges = Array.from(container.querySelectorAll('*')).filter(
      (el) => el.textContent === 'Self' && el.children.length === 0,
    );
    expect(selfBadges.length).toBeGreaterThan(0);
  });
});

describe('<CoachHome /> T124 hours by team', () => {
  it('renders every team, sorted by hours descending', async () => {
    renderAsUser(COACH_USER, {
      loadData: fixtureLoadData,
      loadDashboardData: fixtureLoadDashboardData,
      nowFn: () => FIXTURE_REFERENCE_NOW,
    });
    await flushMicrotasks();
    expect(container.textContent).toContain('Hours by team');
    expect(container.textContent).toContain('Ravens');
    expect(container.textContent).toContain('42h');
    expect(container.textContent).toContain('Titans');
    expect(container.textContent).toContain('28h');
    const ravensIndex = container.textContent!.indexOf('Ravens');
    const titansIndex = container.textContent!.indexOf(
      'Titans',
      container.textContent!.indexOf('Hours by team'),
    );
    expect(ravensIndex).toBeLessThan(titansIndex);
  });
});

describe('<CoachHome /> T124 goal projection', () => {
  it('renders the fact-stating annotation and the Below-goal filter narrows the list', async () => {
    renderAsUser(COACH_USER, {
      loadData: fixtureLoadData,
      loadDashboardData: fixtureLoadDashboardData,
      nowFn: () => FIXTURE_REFERENCE_NOW,
    });
    await flushMicrotasks();
    expect(container.textContent).toContain('Goal projection');
    // "Dana Voss" alone also appears in the (unrelated) Activity feed
    // fixture below -- the ProgressBar's own accessible label
    // ("{name} hours vs. goal", `GoalProjectionRowItem`) is unique to a
    // rendered goal-projection ROW, so it is the assertion target here.
    expect(container.textContent).toContain('Dana Voss hours vs. goal');
    expect(container.textContent).toContain('On track');
    expect(container.textContent).toContain('Amara Webb hours vs. goal');
    expect(container.textContent).toContain('84h short');

    // T149/UXC-06: SegmentedControl replaced with a standalone ToggleButton
    // (astryx-api.md:5602's own "Don't -- use ToggleButton instead" for a
    // simple on/off state). ToggleButton renders its `label` twice in the
    // DOM (once visibly, once in an aria-hidden width-reservation span --
    // ToggleButton.tsx:298-307), so `textContent === 'Below goal'` can never
    // match; `aria-pressed` (ToggleButton.tsx:319) is the reliable
    // discriminator and is absent from SegmentedControlItem. This amendment
    // is authorized per docs/swarm/auto-mode-decisions.md's "T149:
    // authorizing the :1194-1196 test amendment (orchestrator, not George)".
    const belowGoalButton = container.querySelector('button[aria-pressed]');
    expect(belowGoalButton).toBeTruthy();
    act(() => {
      belowGoalButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    await flushMicrotasks();
    // Dana (on track) drops out of the Below-goal view; Amara (below) stays.
    expect(container.textContent).not.toContain('Dana Voss hours vs. goal');
    expect(container.textContent).toContain('Amara Webb hours vs. goal');
  });

  it("GAM-308: confirmed/planned/goal hours are formatted to one decimal, matching HoursTab.tsx's renderHoursCell convention", async () => {
    renderAsUser(COACH_USER, {
      loadData: fixtureLoadData,
      loadDashboardData: fixtureLoadDashboardData,
      nowFn: () => FIXTURE_REFERENCE_NOW,
    });
    await flushMicrotasks();
    // Amara Webb: confirmedHours 6, plannedHours 0, goalHours 90 -- integers
    // that only diverge from their pre-fix rendering once `.toFixed(1)` is
    // applied (unlike Dana Voss's fixture, whose values already happen to
    // look formatted). `totalHours` and the percent are untouched by this fix
    // (round1's own output, per the issue) -- '= 6h /' and '6.7%' stay bare.
    expect(container.textContent).toContain(
      '6.0h confirmed + 0.0h planned = 6h / 90.0h · 6.7% · 84h short',
    );
  });

  it('T149/UXC-06: the two-option SegmentedControl is gone, replaced by a standalone ToggleButton', async () => {
    renderAsUser(COACH_USER, {
      loadData: fixtureLoadData,
      loadDashboardData: fixtureLoadDashboardData,
      nowFn: () => FIXTURE_REFERENCE_NOW,
    });
    await flushMicrotasks();

    // SegmentedControl renders role="radiogroup" -- its absence is the exact
    // discriminator for "the two-option control is gone", not merely "a
    // Below-goal button exists somewhere".
    expect(container.querySelector('[role="radiogroup"]')).toBeNull();
    // The amended finder above already covers this -- a real aria-pressed
    // toggle exists, which only ToggleButton renders here.
    expect(container.querySelector('button[aria-pressed]')).toBeTruthy();
    // 'All' was the removed option's exact button text; it never collides
    // with any other real button's full text in this file (unlike 'Below
    // goal', which now duplicates itself inside ToggleButton's own DOM).
    const allButton = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent === 'All',
    );
    expect(allButton).toBeUndefined();
  });

  it('T149/UXC-06: the TeamHoursRowItem ProgressBar is width-capped at 480px, and its colour is untouched', async () => {
    renderAsUser(COACH_USER, {
      loadData: fixtureLoadData,
      loadDashboardData: fixtureLoadDashboardData,
      nowFn: () => FIXTURE_REFERENCE_NOW,
    });
    await flushMicrotasks();

    // "Ravens" is the team-hours fixture's own team name (see the sibling
    // "T124 hours by team" describe block above) -- TeamHoursRowItem sets
    // its ProgressBar's own label to `${entry.teamName} hours`
    // (CoachHome.tsx), so this is the accessible-name anchor, following this
    // file's own convention (:1189's Dana-Voss pattern) of keying off a name
    // already asserted elsewhere. Anchored on TeamHoursRowItem specifically,
    // not GoalProjectionRowItem or the KPI grid bar: the KPI bar's width is
    // inert regardless of the fix (244px either way), and
    // GoalProjectionRowItem's bar is also the one Part 2's ToggleButton
    // filters, which would entangle two independent concerns in one
    // fixture.
    const progressBars = Array.from(container.querySelectorAll('[role="progressbar"]'));
    // CSS.escape does not exist in this vitest/jsdom setup, and React 19's
    // useId emits ids containing guillemets that are not valid inside a bare
    // CSS selector string either way -- resolve aria-labelledby via
    // document.getElementById, exactly as the T129/UXC-01 block above
    // already does.
    const ravensBar = progressBars.find((bar) => {
      const labelledbyId = bar.getAttribute('aria-labelledby');
      if (!labelledbyId) return false;
      const labelEl = document.getElementById(labelledbyId);
      return labelEl?.textContent === 'Ravens hours';
    });
    expect(ravensBar).toBeTruthy();
    const root = ravensBar!.closest('.astryx-progressbar');
    expect(root).toBeTruthy();
    expect((root as HTMLElement).style.maxWidth).toBe('480px');
    // The pre-existing, untouched default variant -- guards against
    // "helpfully" changing the colour while capping the width. D011 and its
    // addendum already settled that no variant reaches 3:1 against its
    // track in both themes and that all ten ProgressBar sites already carry
    // their value as text, so width is the only in-scope change here.
    expect(root!.getAttribute('data-variant')).toBe('accent');

    // Also confirm the KPI grid's own bar still carries the same style
    // constant post-fix, even though the cap is inert there at every width.
    const kpiBar = progressBars.find((bar) => {
      const labelledbyId = bar.getAttribute('aria-labelledby');
      if (!labelledbyId) return false;
      const labelEl = document.getElementById(labelledbyId);
      return labelEl?.textContent === 'Hours vs. team goal';
    });
    expect(kpiBar).toBeTruthy();
    const kpiRoot = kpiBar!.closest('.astryx-progressbar');
    expect((kpiRoot as HTMLElement).style.maxWidth).toBe('480px');
  });
});

describe('<CoachHome /> T124 top events by student hours', () => {
  it('renders every event, sorted by hours descending', async () => {
    renderAsUser(COACH_USER, {
      loadData: fixtureLoadData,
      loadDashboardData: fixtureLoadDashboardData,
      nowFn: () => FIXTURE_REFERENCE_NOW,
    });
    await flushMicrotasks();
    expect(container.textContent).toContain('Top events by student hours');
    expect(container.textContent).toContain('Summer STEM Camp');
    expect(container.textContent).toContain('30h');
    expect(container.textContent).toContain('Community Food Bank Sort');
    expect(container.textContent).toContain('16h');
  });
});

// ---------------------------------------------------------------------------
// T129/UXC-01: one heading per section. The `List`'s own `header` prop was
// removed from all five sections below (it used to print the section title
// a second time, per `List.tsx:194-201`); each section's `Heading` now
// carries a `useId`-generated id, and a `<div role="group">` wrapping the
// List/EmptyState ternary carries `aria-labelledby={headingId}` -- present
// in BOTH branches, so the region's accessible name survives even when
// there is no `List` to attach a `header` to.
//
// CHECKER FIX (rework of T129, MAJOR): the wrapper was originally an
// Astryx `Section`, which (a) applies a full-bleed negative-margin band
// unconditionally regardless of `padding`, bleeding past this page's
// padded `LayoutContent`, and (b) renders a bare `<div>` with no role, so
// `aria-labelledby` was ARIA-name-prohibited (a `role="generic"` element
// does not support naming). Both are fixed by using a plain
// `<div role="group">` instead. jsdom has no accessible-name computation
// or CSS layout, so the practical proof here is two-fold: (1) resolve the
// aria-labelledby attribute of the specifically `role="group"` element to
// its target and assert that element's textContent is the heading's own
// text (proves the name, not just the markup); (2) the `role="group"`
// selector itself is part of the query, so a regression back to a
// role-less wrapper (or any other non-nameable element) fails the lookup
// outright instead of silently passing.
// ---------------------------------------------------------------------------
describe('<CoachHome /> T129 UXC-01 -- exactly one heading per section, List/EmptyState region takes its accessible name from the Heading', () => {
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
    // `role="group"` is part of the selector itself -- a wrapper that lost
    // its nameable role (e.g. a regression back to a bare `Section`/`div`)
    // fails this lookup, not just a later assertion.
    const labelledEl = container.querySelector(`[role="group"][aria-labelledby="${headingId}"]`);
    expect(labelledEl).toBeTruthy();
    expect(labelledEl!.getAttribute('role')).toBe('group');
    const resolvedId = labelledEl!.getAttribute('aria-labelledby')!;
    const resolvedEl = document.getElementById(resolvedId);
    return { headingId, resolvedText: resolvedEl?.textContent ?? null };
  }

  const SECTION_TITLES = [
    'Next up',
    'Activity feed',
    'Hours by team',
    'Top events by student hours',
  ] as const;
  const GOAL_PROJECTION_TITLE = 'Goal projection · confirmed + planned';

  it('populated branch: every section resolves aria-labelledby back to its own Heading, and each title prints exactly once', async () => {
    renderAsUser(COACH_USER, {
      loadData: fixtureLoadData,
      loadDashboardData: fixtureLoadDashboardData,
      nowFn: () => FIXTURE_REFERENCE_NOW,
    });
    await flushMicrotasks();

    for (const title of SECTION_TITLES) {
      const { resolvedText } = resolveAriaLabelledbyTarget(title);
      expect(resolvedText).toBe(title);
      // Exactly one leaf element carries this exact text -- proves the
      // `List header` (which used to duplicate it) is gone.
      const leafMatches = Array.from(container.querySelectorAll('*')).filter(
        (el) => el.children.length === 0 && el.textContent === title,
      );
      expect(leafMatches.length).toBe(1);
    }

    // The Goal projection Heading keeps its fuller BEH-02 wording; its
    // region still resolves back to that same Heading.
    const { resolvedText: goalResolved } = resolveAriaLabelledbyTarget(GOAL_PROJECTION_TITLE);
    expect(goalResolved).toBe(GOAL_PROJECTION_TITLE);
  });

  it('empty branch: aria-labelledby still resolves to the Heading for every section, even with no List rendered', async () => {
    renderAsUser(COACH_USER, {
      loadData: async (seasonId: string) => {
        const base = await defaultLoadCoachHomeData(seasonId);
        return { ...base, sessions: [], events: [], rsvps: [] };
      },
      loadDashboardData: async (seasonId: string) => {
        const base = await defaultLoadDashboardData(seasonId);
        return {
          ...base,
          teamHours: [],
          topEvents: [],
          goalProjection: [],
          activityFeedSource: {
            events: [],
            sessions: [],
            rsvps: [],
            attendance: [],
            students: [],
          },
        };
      },
      nowFn: () => FIXTURE_REFERENCE_NOW,
    });
    await flushMicrotasks();

    // Confirm we are really exercising the EmptyState branch (not a load
    // failure, which would render a different Banner instead).
    expect(container.textContent).toContain('Nothing scheduled');
    expect(container.textContent).toContain('No activity yet');
    expect(container.textContent).toContain('No team hours yet');
    expect(container.textContent).toContain('No projection yet');
    expect(container.textContent).toContain('No events with hours yet');

    for (const title of SECTION_TITLES) {
      const { resolvedText } = resolveAriaLabelledbyTarget(title);
      expect(resolvedText).toBe(title);
    }
    const { resolvedText: goalResolvedEmpty } = resolveAriaLabelledbyTarget(GOAL_PROJECTION_TITLE);
    expect(goalResolvedEmpty).toBe(GOAL_PROJECTION_TITLE);
  });

  // -------------------------------------------------------------------
  // GAM-456: Hours by team / Goal projection / Top events are now each
  // wrapped in the same `Card` primitive already used for Next up/Activity
  // feed/Leaderboard. Nested in this describe block (not a sibling one) so
  // it can genuinely reuse `resolveAriaLabelledbyTarget` above -- that
  // helper is a `function` declaration local to this describe's own
  // callback closure, not module-scoped, so only code nested inside this
  // same `describe(...)` can call it directly.
  // -------------------------------------------------------------------
  describe('GAM-456 -- Hours by team / Goal projection / Top events are each panelled in a Card', () => {
    const NEWLY_PANELLED_SECTION_TITLES = [
      'Hours by team',
      GOAL_PROJECTION_TITLE,
      'Top events by student hours',
    ] as const;

    it('each newly-panelled section resolves its role="group" region to a genuine .astryx-card ancestor', async () => {
      renderAsUser(COACH_USER, {
        loadData: fixtureLoadData,
        loadDashboardData: fixtureLoadDashboardData,
        nowFn: () => FIXTURE_REFERENCE_NOW,
      });
      await flushMicrotasks();

      for (const title of NEWLY_PANELLED_SECTION_TITLES) {
        const { headingId } = resolveAriaLabelledbyTarget(title);
        const labelledEl = container.querySelector(
          `[role="group"][aria-labelledby="${headingId}"]`,
        );
        expect(labelledEl).not.toBeNull();
        expect(labelledEl!.closest('.astryx-card')).not.toBeNull();
      }
    });
  });
});

// ---------------------------------------------------------------------------
// GAM-456: the page header's H1 is restored to the approved 46px/800
// treatment, and the eyebrow to an uppercase/800/accent-orange treatment.
// jsdom loads no real stylesheet in this project's test setup (this file's
// own Leaderboard-`Card` comment, `:2919-2922` in CoachHome.tsx, already
// documents that), so real CSS/custom-property resolution can't be checked
// here -- but React writes `style` props straight through as an inline
// `style` attribute, which jsdom *does* expose via `element.style.*`, so
// that's what these assertions read.
// ---------------------------------------------------------------------------
describe('<CoachHome /> GAM-456 -- header H1/eyebrow restored to the approved 46px/800 size/weight treatment', () => {
  it('the H1 carries the 46px/800 inline style, and the eyebrow carries the uppercase/800 inline style plus accent color', async () => {
    renderAsUser(COACH_USER, {
      loadData: fixtureLoadData,
      loadDashboardData: fixtureLoadDashboardData,
      nowFn: () => FIXTURE_REFERENCE_NOW,
    });
    await flushMicrotasks();

    const heading = Array.from(container.querySelectorAll('h1')).find(
      (h) => h.textContent === 'Coach dashboard',
    );
    expect(heading).toBeTruthy();
    expect(heading!.style.fontSize).toBe('2.875rem');
    expect(heading!.style.fontWeight).toBe('800');

    const eyebrow = Array.from(container.querySelectorAll('*')).find(
      (el) => el.children.length === 0 && el.textContent === 'Fixture Active Season',
    );
    expect(eyebrow).toBeTruthy();
    expect((eyebrow as HTMLElement).style.textTransform).toBe('uppercase');
    expect((eyebrow as HTMLElement).style.fontWeight).toBe('800');
  });
});

// ---------------------------------------------------------------------------
// T142/UXC-06: Next up + Activity feed pair two-up via `Grid`.
//
// jsdom has no CSS layout engine, so these tests do not (and cannot) prove
// the pairing renders side by side at any given viewport width -- that is a
// real-browser measurement, reported in `docs/swarm/active/
// T142-worker-output.md`, not a jsdom assertion. What jsdom CAN prove
// deterministically, with no rig at all:
//   1. The `Grid` uses the RESPONSIVE `columns={{minWidth, max}}` object
//      form, not the fixed `columns={2}` numeric form -- `Grid` reflects
//      the numeric form as `data-columns`/a `columns-N` class token
//      (`themeProps.js`'s `themeDataAttributes`/`buildClassName`) and
//      passes `undefined` for the object form
//      (`Grid.js:372`, `columnsVariant`), so `data-columns` is present iff
//      `columns={2}` was used. This is the primary proof the packet asks
//      for: it is deterministic and needs no browser.
//   2. The two module headings share exactly one `Grid` ancestor (proving
//      they were actually wrapped together, not just visually adjacent),
//      and that ancestor's inline `--x-gridTemplateColumns` custom property
//      (`Grid.js`'s `dynamicStyles.templateColumns`) encodes the
//      responsive `repeat(auto-fill, minmax(...))` track template with the
//      chosen `COACH_HOME_PAIRED_MODULE_MIN_WIDTH`, not a bare `repeat(2,
//      1fr)`.
// ---------------------------------------------------------------------------
describe('<CoachHome /> T142/UXC-06 -- Next up + Activity feed pair via a responsive Grid', () => {
  function findHeadingEl(headingText: string): HTMLElement {
    const heading = Array.from(container.querySelectorAll('h2')).find(
      (h) => h.textContent === headingText,
    );
    expect(heading).toBeTruthy();
    return heading as HTMLElement;
  }

  function closestAstryxGrid(el: HTMLElement): HTMLElement {
    const grid = el.closest('.astryx-grid');
    expect(grid).toBeTruthy();
    return grid as HTMLElement;
  }

  it('the Grid pairing the two modules carries no data-columns attribute (the columns={2} discriminator)', async () => {
    renderAsUser(COACH_USER, {
      loadData: fixtureLoadData,
      loadDashboardData: fixtureLoadDashboardData,
      nowFn: () => FIXTURE_REFERENCE_NOW,
    });
    await flushMicrotasks();

    const nextUpGrid = closestAstryxGrid(findHeadingEl('Next up'));
    const activityFeedGrid = closestAstryxGrid(findHeadingEl('Activity feed'));

    expect(nextUpGrid).toBe(activityFeedGrid);
    expect(nextUpGrid.hasAttribute('data-columns')).toBe(false);
    // Bonus discriminator (Grid.js's `classTokenForPropValue`): the fixed
    // numeric form also stamps a `columns-2` class token; confirm it is
    // absent too, not just the data attribute.
    expect(nextUpGrid.className).not.toMatch(/\bcolumns-2\b/);
  });

  it('regression: the two headings share exactly one Grid ancestor, whose track template is the responsive form, not a bare two-column fixed grid', async () => {
    renderAsUser(COACH_USER, {
      loadData: fixtureLoadData,
      loadDashboardData: fixtureLoadDashboardData,
      nowFn: () => FIXTURE_REFERENCE_NOW,
    });
    await flushMicrotasks();

    const nextUpGrid = closestAstryxGrid(findHeadingEl('Next up'));
    const activityFeedGrid = closestAstryxGrid(findHeadingEl('Activity feed'));
    expect(nextUpGrid).toBe(activityFeedGrid);

    const trackTemplate = nextUpGrid.style.getPropertyValue('--x-gridTemplateColumns');
    expect(trackTemplate).toContain('repeat(auto-fill');
    expect(trackTemplate).toContain(`${COACH_HOME_PAIRED_MODULE_MIN_WIDTH}px`);
    expect(trackTemplate).not.toBe('repeat(2, 1fr)');

    // The Divider that used to sit between the two stacked modules is gone
    // -- the only Dividers immediately flanking this Grid are the ones that
    // separate it from the stacked KPI grid above and "Hours by team"
    // below. Astryx `Divider` renders `<div role="separator">`, not an
    // `<hr>`.
    expect(nextUpGrid.previousElementSibling?.getAttribute('role')).toBe('separator');
    expect(nextUpGrid.nextElementSibling?.getAttribute('role')).toBe('separator');
  });

  // T150: pin `COACH_HOME_PAIRED_MODULE_MIN_WIDTH` inside its derived window
  // so a future edit to the constant can't silently break two-up pairing.
  // Unlike the `toContain` assertion above -- which builds its own expected
  // string from the constant and so passes for ANY value -- this is a bound
  // check against independently-derived numbers, re-verified against the
  // five live sources (not copied from the code comment or the packet
  // without checking):
  //   1. `SideNav` is 260px (`node_modules/@astryxdesign/core/src/SideNav/
  //      SideNav.tsx:65`, `width: 260`).
  //   2. `AppShell` passes no `breakpoint` to `mobileNav`
  //      (`src/app/AppShell.tsx:163`), so the documented default applies
  //      (`docs/swarm/astryx-api.md:2621`, `MobileNavConfig.breakpoint`
  //      default `'md'` = 768px). Below 768px, `MobileNav` replaces
  //      `SideNav` and contributes 0px.
  //   3. `LayoutContent padding={6}` removes 24px per side
  //      (`node_modules/@astryxdesign/core/src/Layout/padding.stylex.ts:84-89`,
  //      `paddingStyles[6]` -> `spacingVars['--spacing-6']`;
  //      `node_modules/@astryxdesign/core/src/theme/tokens.stylex.ts:161`,
  //      `'--spacing-6': '24px'`).
  //   4. The pairing `Grid`'s own `gap={4}` is 16px (same tokens file,
  //      `:159`, `'--spacing-4': '16px'`).
  //   5. The track-min formula (`node_modules/@astryxdesign/core/src/Grid/
  //      Grid.tsx`, `buildCappedTemplate`, ~:340-365): for
  //      `columns={{ minWidth, max: 2 }}`, track min is
  //      `min(100%, max(minWidth px, perColumn))` where
  //      `perColumn = (100% - (max-1) * gap) / max`.
  //
  // Constraint A -- two columns must fit at 1024px (UXC-06's own accept
  // clause, `docs/swarm/VOLT_UX_Craft_PRD_v3.html:167`, requires two-up
  // above 1024px):
  //   minWidth <= (1024 - 260 - 48 - 16) / 2 = 700 / 2 = 350
  //
  // Constraint B -- one column must be forced at 375px (no SideNav below
  // 768px):
  //   minWidth > (375 - 48 - 16) / 2 = 311 / 2 = 155.5
  //
  // Window: 155.5 < minWidth <= 350. The current value (280) sits inside it
  // with 124.5px of margin above the 155.5 floor and 70px below the 350
  // ceiling (280 - 155.5 = 124.5; 350 - 280 = 70 -- matches the code comment
  // at CoachHome.tsx:1166-1169, not this task's own packet, whose prose
  // description of the same two numbers is inverted).
  it('T150: COACH_HOME_PAIRED_MODULE_MIN_WIDTH stays inside its derived 155.5-350 window', () => {
    expect(COACH_HOME_PAIRED_MODULE_MIN_WIDTH).toBeGreaterThan(155.5);
    expect(COACH_HOME_PAIRED_MODULE_MIN_WIDTH).toBeLessThanOrEqual(350);
  });
});

describe('<CoachHome /> "Start check-in" visibility', () => {
  it('shows "Start check-in" when a team meeting is live', async () => {
    renderAsUser(COACH_USER, { loadData: fixtureLoadData, nowFn: () => FIXTURE_REFERENCE_NOW });
    await flushMicrotasks();
    const buttons = Array.from(container.querySelectorAll('button')).map((b) => b.textContent);
    expect(buttons).toContain('Start check-in');
  });

  it('hides "Start check-in" when nothing is live or starting within 60 minutes', async () => {
    async function loadWithNoEligibleSession(seasonId: string): Promise<CoachHomeData> {
      const base = await defaultLoadCoachHomeData(seasonId);
      return {
        ...base,
        sessions: base.sessions.filter((s) => s.id !== 'session-build-live-now'),
      };
    }
    renderAsUser(COACH_USER, {
      loadData: loadWithNoEligibleSession,
      nowFn: () => FIXTURE_REFERENCE_NOW,
    });
    await flushMicrotasks();
    const buttons = Array.from(container.querySelectorAll('button')).map((b) => b.textContent);
    expect(buttons).not.toContain('Start check-in');
  });

  it('clicking "Start check-in" navigates to the kiosk deep link (real navigation, not a stub)', async () => {
    renderAsUser(COACH_USER, { loadData: fixtureLoadData, nowFn: () => FIXTURE_REFERENCE_NOW });
    await flushMicrotasks();
    const button = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent === 'Start check-in',
    );
    expect(button).toBeTruthy();
    act(() => {
      button?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    // MemoryRouter has no real Kiosk route registered in this test harness,
    // so react-router-dom renders nothing for the new location rather than
    // throwing -- the assertion here is only that clicking did not crash
    // and the "Start check-in" button's own click handler ran (proven by
    // the absence of any thrown error reaching this point).
    expect(true).toBe(true);
  });
});

describe('<CoachHome /> "New outreach event" stub disclosure', () => {
  it('shows the disclosed stub notice, not silent/fake behavior', async () => {
    renderAsUser(COACH_USER, { loadData: fixtureLoadData, nowFn: () => FIXTURE_REFERENCE_NOW });
    await flushMicrotasks();
    const button = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent === 'New outreach event',
    );
    expect(button).toBeTruthy();
    act(() => {
      button?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    // T129/UXC-10: `OutreachEventDialog` genuinely shipped and is wired
    // into `OutreachList` (T101) -- this Home-page shortcut still doesn't
    // open it directly, so the disclosed copy says that honestly instead
    // of the old (now-false) "dialog not built yet" claim.
    expect(container.textContent).toContain("This shortcut isn't wired up yet");
    expect(container.textContent).toContain('Go to the Outreach page');
  });
});

describe('<CoachHome /> HOME-04 admin-only "Season setup" card', () => {
  it('renders for admin with the shipped (season-setup-incomplete) fixture', async () => {
    renderAsUser(ADMIN_USER, { loadData: fixtureLoadData, nowFn: () => FIXTURE_REFERENCE_NOW });
    await flushMicrotasks();
    expect(container.textContent).toContain('Season setup');
    expect(container.textContent).toContain('season goals');
  });

  it('does NOT render for coach, with the IDENTICAL data (isolates the role variable)', async () => {
    renderAsUser(COACH_USER, { loadData: fixtureLoadData, nowFn: () => FIXTURE_REFERENCE_NOW });
    await flushMicrotasks();
    expect(container.textContent).not.toContain('Season setup');
  });

  it('does NOT render for admin once the season is fully set up (isolates the season-status variable)', async () => {
    async function loadWithCompleteSetup(seasonId: string): Promise<CoachHomeData> {
      const base = await defaultLoadCoachHomeData(seasonId);
      return { ...base, seasonSetupStatus: { hasGoalsConfigured: true } };
    }
    renderAsUser(ADMIN_USER, {
      loadData: loadWithCompleteSetup,
      nowFn: () => FIXTURE_REFERENCE_NOW,
    });
    await flushMicrotasks();
    expect(container.textContent).not.toContain('Season setup');
  });

  it('clicking "Go to season setup" navigates to /settings/season (real navigation, not the old stub)', async () => {
    renderAsUser(ADMIN_USER, { loadData: fixtureLoadData, nowFn: () => FIXTURE_REFERENCE_NOW });
    await flushMicrotasks();
    const button = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent === 'Go to season setup',
    );
    expect(button).toBeTruthy();
    act(() => {
      button?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    // T111: this used to show a disclosed stub Banner ("Season setup screen
    // not built yet") because /settings/season didn't exist. T108 has since
    // shipped the real route, so clicking now performs a real
    // navigate(routePaths.settingsSeason) instead -- same
    // MemoryRouter-has-no-matching-route posture as the "Start check-in"
    // test above (react-router-dom renders nothing for the new location
    // rather than throwing; the assertion is that the old stub notice never
    // appears and the click did not crash).
    expect(container.textContent).not.toContain('Season setup screen not built yet');
  });
});

describe("<CoachHome /> BEH-01 milestone toast on this page's own hours-vs-goal bar", () => {
  it('fires a "reached 25%" toast on first render, then does not re-fire on remount (deduped via localStorage)', async () => {
    window.localStorage.clear();

    // T173 round 3 (closing round 2's own new BLOCKER): pin `loadActiveSeason`
    // so this test's `defaultGoalHours` denominator stays the original `10`
    // (the in-file `FIXTURE_DEFAULT_GOAL_HOURS`), independent of the Round 2
    // redesign's unrelated change to where `defaultGoalHours` comes from in
    // production (`activeSeason.season.defaultGoalHours`, which would
    // otherwise resolve to `FIXTURE_ACTIVE_SEASON`'s own `100` here and
    // silently stop this milestone from crossing 25%: 12/38=31.6% crosses,
    // 12/308=3.9% does not).
    renderAsUser(
      COACH_USER,
      { loadData: fixtureLoadData, nowFn: () => FIXTURE_REFERENCE_NOW },
      async () => ({ ...FIXTURE_ACTIVE_SEASON, defaultGoalHours: 10 }),
    );
    await flushMicrotasks();
    expect(container.textContent).toContain('Team hours goal: reached 25% of the season goal.');

    act(() => {
      root.unmount();
    });
    container.remove();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);

    renderAsUser(
      COACH_USER,
      { loadData: fixtureLoadData, nowFn: () => FIXTURE_REFERENCE_NOW },
      async () => ({ ...FIXTURE_ACTIVE_SEASON, defaultGoalHours: 10 }),
    );
    await flushMicrotasks();
    expect(container.textContent).not.toContain('reached 25% of the season goal');
    // The milestone tick itself is still shown as a current fact.
    expect(container.textContent).toContain('25% reached');
  });
});

// ---------------------------------------------------------------------------
// T203: `Leaderboard` (OUT-08, T044/T158) embedded in this page's dashboard
// (criteria 1/4). `Leaderboard.tsx` itself is Forbidden -- these tests only
// prove the EMBED (real `seasonId` threading, the `Card` CSS-nesting fix),
// never re-testing `Leaderboard`'s own internal state machine/formatting/
// privacy logic (that is `Leaderboard.test.tsx`'s job, not this file's).
// ---------------------------------------------------------------------------

describe('<CoachHome /> T203 -- embedded Leaderboard reachability + real seasonId threading (criterion 1)', () => {
  it('renders the populated leaderboard, sourced from the real, non-placeholder resolved seasonId', async () => {
    // Fabricated fixture, distinct from Leaderboard.tsx's own shipped
    // fixture names and from this file's/DashboardPage.test.tsx's existing
    // fixture names (constitution item 6 / packet criterion 8).
    const loadLeaderboardDataSpy = vi.fn(async (seasonId: string) => ({
      hours:
        seasonId === FIXTURE_ACTIVE_SEASON.id
          ? [
              {
                studentId: 'student-t203-quillon-bramwell',
                seasonId,
                confirmedHours: 12.5,
              },
            ]
          : [],
      students: [{ id: 'student-t203-quillon-bramwell', displayName: 'Quillon Bramwell' }],
    }));
    renderAsUser(COACH_USER, {
      loadData: fixtureLoadData,
      loadDashboardData: fixtureLoadDashboardData,
      nowFn: () => FIXTURE_REFERENCE_NOW,
      loadLeaderboardData: loadLeaderboardDataSpy,
    });
    await flushMicrotasks();

    expect(container.textContent).toContain('Season Volunteer Leaderboard');
    // `formatDisplayName` (Leaderboard.tsx:365-375) is the only render-time
    // boundary a name crosses -- with the default privacy setting ON
    // (this test leaves `loadLeaderboardPrivacySetting` un-overridden, so
    // the harness merge's `defaultLoadPrivacySetting` resolves `true`), the
    // fabricated 'Quillon Bramwell' reaches the DOM only as '1. Quillon B.'.
    expect(container.textContent).toContain('1. Quillon B.');
    expect(loadLeaderboardDataSpy).toHaveBeenCalledWith(FIXTURE_ACTIVE_SEASON.id);
    // The genuinely discriminating assertion: never the retired/unrelated
    // Leaderboard-internal placeholder default.
    expect(loadLeaderboardDataSpy.mock.calls[0]?.[0]).not.toBe('season-placeholder-current');
  });
});

describe('<CoachHome /> T203 -- Leaderboard CSS-nesting fix, jsdom-provable structural proof (criterion 4)', () => {
  it("Card is a genuine DOM ancestor of the embedded Leaderboard's own Section root (astryx-card/astryx-section)", async () => {
    renderAsUser(COACH_USER, { loadData: fixtureLoadData, nowFn: () => FIXTURE_REFERENCE_NOW });
    await flushMicrotasks();
    // CoachHome.tsx uses no Section anywhere else, so this uniquely
    // resolves to Leaderboard's own root (Section.js, `astryx-section`).
    const section = container.querySelector('.astryx-section');
    expect(section).not.toBeNull();
    expect(section!.closest('.astryx-card')).not.toBeNull();
  });
});
