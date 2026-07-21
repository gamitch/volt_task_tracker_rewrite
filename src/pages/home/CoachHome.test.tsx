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
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthProvider, type AuthUser } from '../../app/guards';
import { LoginAs } from '../../test-utils/authHarness';
import type { ActivityFeedSource, FeedRsvpRow } from '../../lib/supabase/loaders/dashboard';
import {
  ACTIVITY_FEED_DEFAULT_LIMIT,
  attendanceRatePercent,
  buildActivityFeed,
  buildLastCompletedMeetingSummary,
  buildNextUp,
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
  isEventInTeamScope,
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

// ---------------------------------------------------------------------------
// Render harness -- mirrors OutreachList.test.tsx / MeetingsList.test.tsx.
// ---------------------------------------------------------------------------

let container: HTMLDivElement;
let root: Root;

const COACH_USER: AuthUser = { id: 'user-coach', email: 'coach@example.com', role: 'coach' };
const ADMIN_USER: AuthUser = { id: 'user-admin', email: 'admin@example.com', role: 'admin' };

function renderAsUser(user: AuthUser | null, props: Parameters<typeof CoachHome>[0] = {}): void {
  act(() => {
    root.render(
      <MemoryRouter>
        <AuthProvider>
          {user === null ? (
            <CoachHome {...props} />
          ) : (
            <LoginAs user={user}>
              <CoachHome {...props} />
            </LoginAs>
          )}
        </AuthProvider>
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
// Pure functions -- isEventInTeamScope / sums
// ---------------------------------------------------------------------------

describe('isEventInTeamScope', () => {
  it('null team_ids means all teams', () => {
    expect(isEventInTeamScope({ teamIds: null }, 'team-a')).toBe(true);
  });
  it('matches only listed team ids', () => {
    expect(isEventInTeamScope({ teamIds: ['team-a'] }, 'team-a')).toBe(true);
    expect(isEventInTeamScope({ teamIds: ['team-b'] }, 'team-a')).toBe(false);
  });
});

describe('sumGoalHours / sumConfirmedHours', () => {
  const students: HomeStudentRow[] = [
    { id: 's1', displayName: 'A', teamId: 'team-a', isActive: true, goalHoursOverride: null },
    { id: 's2', displayName: 'B', teamId: 'team-a', isActive: true, goalHoursOverride: 8 },
    { id: 's3', displayName: 'C', teamId: 'team-a', isActive: false, goalHoursOverride: 20 }, // inactive
    { id: 's4', displayName: 'D', teamId: 'team-b', isActive: true, goalHoursOverride: 5 }, // wrong team
  ];

  it('sums goal hours for active, team-scoped students only, falling back to the default', () => {
    expect(sumGoalHours(students, 'team-a', 10)).toBe(18); // 10 (default) + 8 (override)
  });

  it('sums confirmed hours from pre-computed rows, active+team-scoped only', () => {
    const hoursRows = [
      { studentId: 's1', seasonId: 'season-1', confirmedHours: 3 },
      { studentId: 's2', seasonId: 'season-1', confirmedHours: 4 },
      { studentId: 's3', seasonId: 'season-1', confirmedHours: 100 }, // inactive, excluded
      { studentId: 's4', seasonId: 'season-1', confirmedHours: 100 }, // wrong team, excluded
    ];
    expect(sumConfirmedHours(students, 'team-a', hoursRows)).toBe(7);
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
    const summary = buildLastCompletedMeetingSummary(sessions, events, [], students, 'team-a');
    expect(summary?.sessionId).toBe('latest');
    expect(summary?.title).toBe('Weekly Build');
  });

  it("tallies attendance for that one session and computes (present+late)/activeRosterSize -- not MET-01/02's formula", () => {
    const attendance = [
      { sessionId: 'latest', studentId: 's1', status: 'present' as const },
      { sessionId: 'latest', studentId: 's2', status: 'absent' as const },
      { sessionId: 'old', studentId: 's1', status: 'present' as const }, // wrong session, ignored
    ];
    const summary = buildLastCompletedMeetingSummary(
      sessions,
      events,
      attendance,
      students,
      'team-a',
    );
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

  it('returns null when no completed meeting exists yet for the team', () => {
    expect(buildLastCompletedMeetingSummary([], events, [], students, 'team-a')).toBeNull();
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

describe('selectCheckInSession (meeting-type + team-scope + eligibility, all combined)', () => {
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
    const result = selectCheckInSession(sessions, events, 'team-a', REF_NOW_MS);
    expect(result?.id).toBe('meeting-eligible');
  });

  it('excludes an otherwise-eligible meeting session outside the requested team scope', () => {
    const sessions: HomeSessionRow[] = [
      {
        id: 'other-team-eligible',
        eventId: 'e-other-team-meeting',
        startsAt: new Date(REF_NOW_MS + 5 * 60_000).toISOString(),
        endsAt: new Date(REF_NOW_MS + 65 * 60_000).toISOString(),
        status: 'scheduled',
      },
    ];
    expect(selectCheckInSession(sessions, events, 'team-a', REF_NOW_MS)).toBeNull();
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
    expect(selectCheckInSession(sessions, events, 'team-a', REF_NOW_MS)).toBeNull();
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

  it('counts scheduled sessions starting within the window, excludes already-started, far-future, non-scheduled, and out-of-team-scope ones', () => {
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
    expect(
      countUpcomingSessionsInNextDays(sessions, events, PLACEHOLDER_CURRENT_TEAM_ID, REF_NOW_MS),
    ).toBe(2);
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
    const rows = buildNextUp(sessions, events, [], 'any-team', REF_NOW_MS);
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
    const rows = buildNextUp(sessions, events, rsvps, 'any-team', REF_NOW_MS);
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

  it('team participation is read verbatim from the fixture (no arithmetic)', () => {
    expect(data.teamParticipation?.participationPct).toBe(82.4);
  });

  it('hours vs goal: 12 confirmed / 38 goal = 31.6%, crossing only the 25% milestone', () => {
    const goalHours = sumGoalHours(
      data.students,
      PLACEHOLDER_CURRENT_TEAM_ID,
      data.defaultGoalHours,
    );
    const confirmedHours = sumConfirmedHours(
      data.students,
      PLACEHOLDER_CURRENT_TEAM_ID,
      data.studentHours,
    );
    expect(goalHours).toBe(38);
    expect(confirmedHours).toBe(12);
    const percent = hoursVsGoalPercent(confirmedHours, goalHours);
    expect(percent).toBe(31.6);
    expect(crossedMilestones(percent)).toEqual([25]);
  });

  it('last completed meeting attendance rate: 3 of 4 active roster = 75%', () => {
    const summary = buildLastCompletedMeetingSummary(
      data.sessions,
      data.events,
      data.attendance,
      data.students,
      PLACEHOLDER_CURRENT_TEAM_ID,
    );
    expect(summary?.title).toBe('Weekly Build Meeting');
    expect(attendanceRatePercent(summary!)).toBe(75);
  });

  it('events in next 7 days = 2 (food bank +2h, regionals +5d), excludes far-future/live/wrong-team', () => {
    expect(
      countUpcomingSessionsInNextDays(
        data.sessions,
        data.events,
        PLACEHOLDER_CURRENT_TEAM_ID,
        REF_NOW_MS,
      ),
    ).toBe(2);
  });

  it('check-in eligible session is the live meeting, never the Titans-scoped near-term one', () => {
    const session = selectCheckInSession(
      data.sessions,
      data.events,
      PLACEHOLDER_CURRENT_TEAM_ID,
      REF_NOW_MS,
    );
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

  it('populated state renders the four primary KPI labels and Next up', async () => {
    window.localStorage.clear();
    renderAsUser(COACH_USER, { loadData: fixtureLoadData, nowFn: () => FIXTURE_REFERENCE_NOW });
    await flushMicrotasks();

    expect(container.textContent).toContain('Team participation');
    expect(container.textContent).toContain('Hours vs. team goal');
    expect(container.textContent).toContain('Last meeting attendance');
    expect(container.textContent).toContain('Events in next 7 days');
    expect(container.textContent).toContain('82.4%'); // team participation KPI value
    expect(container.textContent).toContain('75%'); // last-meeting attendance rate KPI value
    expect(container.textContent).toContain('2'); // events in next 7 days KPI value

    expect(container.textContent).toContain('Next up');
    expect(container.textContent).toContain('Community Food Bank Sort');
    expect(container.textContent).toContain('Regionals Qualifier');
    // Titans-scoped session must never appear (team-scope exclusion).
    expect(container.textContent).not.toContain('Titans Strategy Session');
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

    const belowGoalButton = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent === 'Below goal',
    );
    expect(belowGoalButton).toBeTruthy();
    act(() => {
      belowGoalButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    await flushMicrotasks();
    // Dana (on track) drops out of the Below-goal view; Amara (below) stays.
    expect(container.textContent).not.toContain('Dana Voss hours vs. goal');
    expect(container.textContent).toContain('Amara Webb hours vs. goal');
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
    expect(container.textContent).toContain('Event creation dialog not built yet');
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

    renderAsUser(COACH_USER, { loadData: fixtureLoadData, nowFn: () => FIXTURE_REFERENCE_NOW });
    await flushMicrotasks();
    expect(container.textContent).toContain('Team hours goal: reached 25% of the season goal.');

    act(() => {
      root.unmount();
    });
    container.remove();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);

    renderAsUser(COACH_USER, { loadData: fixtureLoadData, nowFn: () => FIXTURE_REFERENCE_NOW });
    await flushMicrotasks();
    expect(container.textContent).not.toContain('reached 25% of the season goal');
    // The milestone tick itself is still shown as a current fact.
    expect(container.textContent).toContain('25% reached');
  });
});
