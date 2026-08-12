// @vitest-environment jsdom
/**
 * GAM-301 (T407) round 3: tests for `MobileNav.tsx`'s real BEH-04 Outreach
 * badge (`useOutreachBadgeCount`, `./useOutreachBadgeCount.ts`). No
 * `MobileNav.test.tsx` existed before this task (per this task's own
 * Allowed Files list).
 *
 * No `@testing-library/react` is installed in this repo (confirmed via
 * `package.json`) -- this file uses the same raw `createRoot`/`act` +
 * `MemoryRouter` + `AuthProvider`/`LoginAs` + `SeasonProvider` harness
 * `SideNav.test.tsx` (this task's own sibling file) and `TopNav.test.tsx`
 * already established, extended with the new `outreachBadgeCountOptions`
 * injection seam this task adds to `MobileNav`.
 *
 * Fixture (same literal rows as `SideNav.test.tsx`'s own copy and
 * `useOutreachBadgeCount.test.ts`'s own copy, per the GAM-301 packet's "one
 * named fixture ... reused across" instruction -- no shared fixture module
 * exists in this task's Allowed Files list, so the same values are restated
 * here): 2 outreach sessions in team scope, future, unanswered by
 * `studentId = 'student-1'`; 1 outreach session out of team scope; 1 meeting
 * session (never counted); 1 already-answered outreach session; 1 outreach
 * session in the past (excluded by the future cutoff). Expected badge count:
 * literal `2`.
 */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { AuthProvider, type AuthUser } from '../../app/guards';
import { SeasonProvider, type LoadActiveSeasonFn } from '../../app/SeasonProvider';
import type { SeasonRow } from '../../lib/supabase/types';
import { LoginAs } from '../../test-utils/authHarness';
import type {
  HomeEventRow,
  HomeRsvpRow,
  HomeSessionRow,
} from '../../lib/outreach/unansweredOutreach';
import type {
  LoadStudentHomeDataFn,
  ResolveStudentScopeFn,
  StudentHomeData,
  StudentScope,
} from '../../pages/home/StudentHome';
import type { ResolveCurrentStudentIdFn } from '../../pages/meetings/MeetingsList';
import type { UseOutreachBadgeCountOptions } from './useOutreachBadgeCount';
import { MobileNav } from './MobileNav';

// ---------------------------------------------------------------------------
// Fixture -- see module doc above.
// ---------------------------------------------------------------------------

const STUDENT_ID = 'student-1';
const TEAM_ID = 'team-1';
const OTHER_TEAM_ID = 'team-2';
const SEASON_ID = 'season-fixture-1';

const NOW_MS = new Date('2026-08-01T12:00:00.000Z').getTime();
const FIXED_NOW = (): number => NOW_MS;

const FIXTURE_EVENTS: readonly HomeEventRow[] = [
  {
    id: 'event-outreach-1',
    seasonId: SEASON_ID,
    type: 'outreach',
    title: 'Park Cleanup',
    teamIds: [TEAM_ID],
    countsVolunteerHours: true,
  },
  {
    id: 'event-outreach-2',
    seasonId: SEASON_ID,
    type: 'outreach',
    title: 'Library Demo',
    teamIds: [TEAM_ID],
    countsVolunteerHours: true,
  },
  {
    id: 'event-outreach-other-team',
    seasonId: SEASON_ID,
    type: 'outreach',
    title: 'Titans Bake Sale',
    teamIds: [OTHER_TEAM_ID],
    countsVolunteerHours: true,
  },
  {
    id: 'event-meeting',
    seasonId: SEASON_ID,
    type: 'meeting',
    title: 'Weekly Build Meeting',
    teamIds: [TEAM_ID],
    countsVolunteerHours: false,
  },
  {
    id: 'event-outreach-answered',
    seasonId: SEASON_ID,
    type: 'outreach',
    title: 'STEM Fair',
    teamIds: [TEAM_ID],
    countsVolunteerHours: true,
  },
  {
    id: 'event-outreach-past',
    seasonId: SEASON_ID,
    type: 'outreach',
    title: 'Past Fundraiser',
    teamIds: [TEAM_ID],
    countsVolunteerHours: true,
  },
];

const FIXTURE_SESSIONS: readonly HomeSessionRow[] = [
  // In team scope, future, unanswered -- COUNTED (1 of 2).
  {
    id: 'session-outreach-1',
    eventId: 'event-outreach-1',
    startsAt: '2026-08-05T15:00:00.000Z',
    endsAt: '2026-08-05T17:00:00.000Z',
    status: 'scheduled',
  },
  // In team scope, future, unanswered -- COUNTED (2 of 2).
  {
    id: 'session-outreach-2',
    eventId: 'event-outreach-2',
    startsAt: '2026-08-10T15:00:00.000Z',
    endsAt: '2026-08-10T17:00:00.000Z',
    status: 'scheduled',
  },
  // Out of team scope -- NOT counted.
  {
    id: 'session-outreach-other-team',
    eventId: 'event-outreach-other-team',
    startsAt: '2026-08-12T15:00:00.000Z',
    endsAt: '2026-08-12T17:00:00.000Z',
    status: 'scheduled',
  },
  // A meeting session -- never counted (only `outreach`-type is eligible).
  {
    id: 'session-meeting',
    eventId: 'event-meeting',
    startsAt: '2026-08-14T15:00:00.000Z',
    endsAt: '2026-08-14T17:00:00.000Z',
    status: 'scheduled',
  },
  // Already answered (has an rsvp row below) -- NOT counted.
  {
    id: 'session-outreach-answered',
    eventId: 'event-outreach-answered',
    startsAt: '2026-08-16T15:00:00.000Z',
    endsAt: '2026-08-16T17:00:00.000Z',
    status: 'scheduled',
  },
  // In the past relative to FIXED_NOW -- excluded by the future cutoff, NOT
  // counted (the BEH-04 clause `getUnansweredRsvpCount` lacked).
  {
    id: 'session-outreach-past',
    eventId: 'event-outreach-past',
    startsAt: '2026-07-01T15:00:00.000Z',
    endsAt: '2026-07-01T17:00:00.000Z',
    status: 'scheduled',
  },
];

const FIXTURE_RSVPS: readonly HomeRsvpRow[] = [
  {
    id: 'rsvp-answered',
    sessionId: 'session-outreach-answered',
    studentId: STUDENT_ID,
    status: 'going',
    updatedAt: '2026-07-20T00:00:00.000Z',
  },
];

const FIXTURE_STUDENT_HOME_DATA: StudentHomeData = {
  seasonId: SEASON_ID,
  displayName: 'Fixture Student',
  defaultGoalHours: 100,
  goalHoursOverride: null,
  events: FIXTURE_EVENTS,
  sessions: FIXTURE_SESSIONS,
  rsvps: FIXTURE_RSVPS,
  studentHours: null,
  participation: null,
};

const FIXTURE_STUDENT_SCOPE: StudentScope = {
  teamIds: [TEAM_ID],
  goalHours: 100,
  confirmedHours: 0,
  plannedHours: 0,
};

const fixtureLoadStudentHomeData: LoadStudentHomeDataFn = async () => FIXTURE_STUDENT_HOME_DATA;
const fixtureResolveStudentScope: ResolveStudentScopeFn = async () => FIXTURE_STUDENT_SCOPE;
const fixtureResolveStudentId: ResolveCurrentStudentIdFn = async () => STUDENT_ID;
const fixtureResolveStudentIdNull: ResolveCurrentStudentIdFn = async () => null;

const FIXTURE_OPTIONS: UseOutreachBadgeCountOptions = {
  loadStudentHomeData: fixtureLoadStudentHomeData,
  resolveStudentScope: fixtureResolveStudentScope,
  resolveStudentId: fixtureResolveStudentId,
  now: FIXED_NOW,
};

const REAL_SEASON: SeasonRow = {
  id: SEASON_ID,
  name: 'Fixture Season',
  startsOn: '2026-08-01',
  endsOn: '2027-06-30',
  defaultGoalHours: 100,
  isActive: true,
  createdAt: '2026-08-01T00:00:00.000Z',
};

const STUDENT_USER: AuthUser = {
  id: 'user-student',
  email: 'student@example.com',
  role: 'student',
};
const PARENT_USER: AuthUser = { id: 'user-parent', email: 'parent@example.com', role: 'parent' };
const ADMIN_USER: AuthUser = { id: 'user-admin', email: 'admin@example.com', role: 'admin' };
const COACH_USER: AuthUser = { id: 'user-coach', email: 'coach@example.com', role: 'coach' };

// ---------------------------------------------------------------------------
// Harness.
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
});

async function flushMicrotasks(): Promise<void> {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });
}

function renderMobileNav(
  user: AuthUser | null,
  loadActiveSeason: LoadActiveSeasonFn,
  outreachBadgeCountOptions?: UseOutreachBadgeCountOptions,
): void {
  const tree = (
    <MemoryRouter initialEntries={['/']}>
      <SeasonProvider loadActiveSeason={loadActiveSeason}>
        <MobileNav outreachBadgeCountOptions={outreachBadgeCountOptions} />
      </SeasonProvider>
    </MemoryRouter>
  );
  act(() => {
    root.render(
      user === null ? <AuthProvider>{tree}</AuthProvider> : <LoginAs user={user}>{tree}</LoginAs>,
    );
  });
}

function outreachBadge(): Element | null {
  return container.querySelector('[data-testid="outreach-nav-badge"]');
}

describe('<MobileNav /> Outreach badge (GAM-301, BEH-04)', () => {
  it('criterion 2: a student viewer with the fixture renders the literal badge 2', async () => {
    renderMobileNav(STUDENT_USER, async () => REAL_SEASON, FIXTURE_OPTIONS);
    await flushMicrotasks();
    expect(outreachBadge()?.textContent).toBe('2');
  });

  it('criterion 3: a parent viewer with the fixture renders identically (literal badge 2)', async () => {
    renderMobileNav(PARENT_USER, async () => REAL_SEASON, FIXTURE_OPTIONS);
    await flushMicrotasks();
    expect(outreachBadge()?.textContent).toBe('2');
  });

  it('criterion 4: resolveStudentId resolving null renders the literal badge 0, not absent', async () => {
    renderMobileNav(STUDENT_USER, async () => REAL_SEASON, {
      resolveStudentId: fixtureResolveStudentIdNull,
      now: FIXED_NOW,
    });
    await flushMicrotasks();
    expect(outreachBadge()?.textContent).toBe('0');
  });

  it("criterion 5: season 'loading' renders no Outreach badge (absent, not 0)", async () => {
    renderMobileNav(STUDENT_USER, () => new Promise(() => {}), FIXTURE_OPTIONS);
    await flushMicrotasks();
    expect(outreachBadge()).toBeNull();
  });

  it("criterion 5: season 'error' renders no Outreach badge", async () => {
    renderMobileNav(
      STUDENT_USER,
      async () => {
        throw new Error('fixture: active season load failed');
      },
      FIXTURE_OPTIONS,
    );
    await flushMicrotasks();
    expect(outreachBadge()).toBeNull();
  });

  it('criterion 5: a rejected loadStudentHomeData renders no Outreach badge', async () => {
    renderMobileNav(STUDENT_USER, async () => REAL_SEASON, {
      resolveStudentId: fixtureResolveStudentId,
      loadStudentHomeData: async () => {
        throw new Error('fixture: loadStudentHomeData failed');
      },
      resolveStudentScope: fixtureResolveStudentScope,
      now: FIXED_NOW,
    });
    await flushMicrotasks();
    expect(outreachBadge()).toBeNull();
  });

  it('criterion 5: a rejected resolveStudentScope renders no Outreach badge', async () => {
    renderMobileNav(STUDENT_USER, async () => REAL_SEASON, {
      resolveStudentId: fixtureResolveStudentId,
      loadStudentHomeData: fixtureLoadStudentHomeData,
      resolveStudentScope: async () => {
        throw new Error('fixture: resolveStudentScope failed');
      },
      now: FIXED_NOW,
    });
    await flushMicrotasks();
    expect(outreachBadge()).toBeNull();
  });

  it("criterion 6: season 'none' renders the literal badge 0", async () => {
    renderMobileNav(STUDENT_USER, async () => null, FIXTURE_OPTIONS);
    await flushMicrotasks();
    expect(outreachBadge()?.textContent).toBe('0');
  });

  it('criterion 7: an admin viewer never sees an Outreach badge, regardless of season/data state', async () => {
    renderMobileNav(ADMIN_USER, async () => REAL_SEASON, FIXTURE_OPTIONS);
    await flushMicrotasks();
    expect(outreachBadge()).toBeNull();
  });

  it('criterion 7: a coach viewer never sees an Outreach badge, regardless of season/data state', async () => {
    renderMobileNav(COACH_USER, async () => REAL_SEASON, FIXTURE_OPTIONS);
    await flushMicrotasks();
    expect(outreachBadge()).toBeNull();
  });
});
