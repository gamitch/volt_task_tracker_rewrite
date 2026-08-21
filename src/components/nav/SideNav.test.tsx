// @vitest-environment jsdom
/**
 * GAM-301 (T407) round 3: tests for `SideNav.tsx`'s real BEH-04 Outreach
 * badge (`useOutreachBadgeCount`, `./useOutreachBadgeCount.ts`). No
 * `SideNav.test.tsx` existed before this task (per this task's own Allowed
 * Files list).
 *
 * No `@testing-library/react` is installed in this repo (confirmed via
 * `package.json`) -- this file uses the same raw `createRoot`/`act` +
 * `MemoryRouter` + `AuthProvider`/`LoginAs` + `SeasonProvider` harness
 * `TopNav.test.tsx` already established for the identical
 * `useAuth()`/`useActiveSeason()` pair, extended with the new
 * `outreachBadgeCountOptions` injection seam this task adds to `SideNav`.
 *
 * Fixture (same literal rows as `MobileNav.test.tsx`'s own copy and
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
import { routePaths } from '../../app/router';
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
import { SideNav } from './SideNav';

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

function renderSideNav(
  user: AuthUser | null,
  loadActiveSeason: LoadActiveSeasonFn,
  outreachBadgeCountOptions?: UseOutreachBadgeCountOptions,
): void {
  const tree = (
    <MemoryRouter initialEntries={['/']}>
      <SeasonProvider loadActiveSeason={loadActiveSeason}>
        <SideNav outreachBadgeCountOptions={outreachBadgeCountOptions} />
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

describe('<SideNav /> Outreach badge (GAM-301, BEH-04)', () => {
  it('criterion 2: a student viewer with the fixture renders the literal badge 2', async () => {
    renderSideNav(STUDENT_USER, async () => REAL_SEASON, FIXTURE_OPTIONS);
    await flushMicrotasks();
    expect(outreachBadge()?.textContent).toBe('2');
  });

  it('criterion 3: a parent viewer with the fixture renders identically (literal badge 2)', async () => {
    renderSideNav(PARENT_USER, async () => REAL_SEASON, FIXTURE_OPTIONS);
    await flushMicrotasks();
    expect(outreachBadge()?.textContent).toBe('2');
  });

  it('criterion 4: resolveStudentId resolving null renders the literal badge 0, not absent', async () => {
    renderSideNav(STUDENT_USER, async () => REAL_SEASON, {
      resolveStudentId: fixtureResolveStudentIdNull,
      now: FIXED_NOW,
    });
    await flushMicrotasks();
    expect(outreachBadge()?.textContent).toBe('0');
  });

  it("criterion 5: season 'loading' renders no Outreach badge (absent, not 0)", async () => {
    renderSideNav(STUDENT_USER, () => new Promise(() => {}), FIXTURE_OPTIONS);
    await flushMicrotasks();
    expect(outreachBadge()).toBeNull();
  });

  it("criterion 5: season 'error' renders no Outreach badge", async () => {
    renderSideNav(
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
    renderSideNav(STUDENT_USER, async () => REAL_SEASON, {
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
    renderSideNav(STUDENT_USER, async () => REAL_SEASON, {
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
    renderSideNav(STUDENT_USER, async () => null, FIXTURE_OPTIONS);
    await flushMicrotasks();
    expect(outreachBadge()?.textContent).toBe('0');
  });

  it('criterion 7: an admin viewer never sees an Outreach badge, regardless of season/data state', async () => {
    renderSideNav(ADMIN_USER, async () => REAL_SEASON, FIXTURE_OPTIONS);
    await flushMicrotasks();
    expect(outreachBadge()).toBeNull();
  });

  it('criterion 7: a coach viewer never sees an Outreach badge, regardless of season/data state', async () => {
    renderSideNav(COACH_USER, async () => REAL_SEASON, FIXTURE_OPTIONS);
    await flushMicrotasks();
    expect(outreachBadge()).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// GAM-437: real icons + 16px label so a collapsed nav stays usable.
// ---------------------------------------------------------------------------

/** `route -> lucide className` for every NAV-03 item, per the packet's table. */
const ICON_CLASS_BY_ROUTE: ReadonlyArray<readonly [string, string]> = [
  [routePaths.dashboard, 'lucide-house'],
  [routePaths.meetings, 'lucide-users'],
  [routePaths.outreach, 'lucide-megaphone'],
  [routePaths.calendar, 'lucide-calendar-days'],
  [routePaths.roster, 'lucide-clipboard-list'],
  [routePaths.reports, 'lucide-chart-column'],
  [routePaths.settings, 'lucide-settings'],
];

function navLink(route: string): HTMLAnchorElement | null {
  return container.querySelector(`a[href="${route}"]`);
}

/** Built-in `SideNavCollapseButton` this task's `AstryxSideNav collapsible`
 * (uncontrolled mode) renders automatically -- default label is literally
 * "Collapse sidebar" / "Expand sidebar" (`SideNavCollapseButton.js`). */
function collapseToggleButton(): HTMLButtonElement | undefined {
  return Array.from(container.querySelectorAll('button')).find(
    (button) => button.getAttribute('aria-label') === 'Collapse sidebar',
  );
}

describe('<SideNav /> icons (GAM-437)', () => {
  it('renders every visible item with its mapped lucide icon, decorative (aria-hidden)', async () => {
    renderSideNav(ADMIN_USER, async () => REAL_SEASON, FIXTURE_OPTIONS);
    await flushMicrotasks();
    for (const [route, iconClass] of ICON_CLASS_BY_ROUTE) {
      const link = navLink(route);
      expect(link, `no link found for route ${route}`).not.toBeNull();
      const icon = link!.querySelector(`svg.${iconClass}`);
      expect(icon, `no ${iconClass} icon found for route ${route}`).not.toBeNull();
      expect(icon?.getAttribute('aria-hidden')).toBe('true');
    }
  });

  it('does not render icons for staffOnly items to a non-staff (student) viewer', async () => {
    renderSideNav(STUDENT_USER, async () => REAL_SEASON, FIXTURE_OPTIONS);
    await flushMicrotasks();
    expect(navLink(routePaths.roster)).toBeNull();
    expect(navLink(routePaths.reports)).toBeNull();
    // The 5 items a non-staff viewer does see still get their icon.
    const homeIcon = navLink(routePaths.dashboard)?.querySelector('svg.lucide-house');
    expect(homeIcon).not.toBeNull();
  });

  it(
    'accessible name (query by role/label, not the decorative icon): expanded mode carries ' +
      "the item's visible label text as its accessible name, with no aria-label override needed",
    async () => {
      renderSideNav(ADMIN_USER, async () => REAL_SEASON, FIXTURE_OPTIONS);
      await flushMicrotasks();
      const homeLink = navLink(routePaths.dashboard);
      expect(homeLink?.getAttribute('aria-label')).toBeNull();
      expect(homeLink?.textContent?.trim()).toBe('Home');
      const settingsLink = navLink(routePaths.settings);
      expect(settingsLink?.getAttribute('aria-label')).toBeNull();
      expect(settingsLink?.textContent?.trim()).toBe('Settings');
    },
  );

  it(
    "accessible name survives collapse: toggling the nav's own collapse control still " +
      "renders each item's real `aria-label` (equal to `label`), so the aria-hidden icon " +
      'never leaves the item nameless',
    async () => {
      renderSideNav(ADMIN_USER, async () => REAL_SEASON, FIXTURE_OPTIONS);
      await flushMicrotasks();
      const toggle = collapseToggleButton();
      expect(toggle, 'no built-in collapse toggle button found').toBeDefined();
      act(() => {
        toggle!.click();
      });
      await flushMicrotasks();
      const homeLink = navLink(routePaths.dashboard);
      expect(homeLink?.getAttribute('aria-label')).toBe('Home');
      const rosterLink = navLink(routePaths.roster);
      expect(rosterLink?.getAttribute('aria-label')).toBe('Roster');
      // The icon underneath is still present and still decorative.
      expect(homeLink?.querySelector('svg.lucide-house')?.getAttribute('aria-hidden')).toBe('true');
    },
  );
});
