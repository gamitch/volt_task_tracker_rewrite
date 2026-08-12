// @vitest-environment jsdom
/**
 * GAM-301 (T407) round 3: hook-level tests for `useOutreachBadgeCount`.
 *
 * No `@testing-library/react` is installed in this repo (confirmed via
 * `package.json`) -- this file uses the same raw `createRoot`/`act`
 * probe-component pattern `useIsNarrowViewport.test.tsx` already established
 * for hook-only testing. Unlike that file, this one is a plain `.ts` file
 * (per this task's own Allowed Files list) rather than `.tsx`, so the probe
 * component below is built with `createElement` calls instead of JSX syntax
 * -- functionally identical, just without JSX sugar.
 *
 * This file covers acceptance criteria states 3/4/5/6/7 (see the GAM-301
 * packet's own "Acceptance criteria" list) directly at the hook level,
 * asserting the returned `number | null`. State 2 (a student viewer with the
 * fixture rendering the literal Outreach badge `2`) is proved at the
 * component level instead, in `SideNav.test.tsx`/`MobileNav.test.tsx`.
 *
 * Fixture (same shape/values as `SideNav.test.tsx`/`MobileNav.test.tsx`'s own
 * copy of this fixture, per the packet's "one named fixture ... reused
 * across" instruction -- no shared fixture module exists in this task's
 * Allowed Files list, so the same literal rows are restated here): 2
 * outreach sessions in team scope, future, unanswered by `studentId =
 * 'student-1'`; 1 outreach session out of team scope; 1 meeting session
 * (never counted); 1 already-answered outreach session; 1 outreach session
 * in the past (excluded by the future cutoff). Expected count: literal `2`.
 */
import { act, createElement, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
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
import { useOutreachBadgeCount, type UseOutreachBadgeCountOptions } from './useOutreachBadgeCount';

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
// Harness -- see module doc above.
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

function Probe({ options }: { options?: UseOutreachBadgeCountOptions }): ReactNode {
  const count = useOutreachBadgeCount(options);
  return createElement('div', { 'data-testid': 'probe' }, count === null ? 'null' : String(count));
}

function probeText(): string | null {
  return container.querySelector('[data-testid="probe"]')?.textContent ?? null;
}

function renderProbe(
  user: AuthUser | null,
  options: UseOutreachBadgeCountOptions | undefined,
  loadActiveSeason: LoadActiveSeasonFn,
): void {
  const tree = createElement(SeasonProvider, {
    loadActiveSeason,
    children: createElement(Probe, { options }),
  });
  act(() => {
    root.render(
      user === null
        ? createElement(AuthProvider, { children: tree })
        : createElement(LoginAs, { user, children: tree }),
    );
  });
}

// ---------------------------------------------------------------------------
// State 3 -- a parent viewer with the fixture renders identically to a
// student viewer (this repo's own disclosed single-linked-student
// simplification, not "linked kids combined").
// ---------------------------------------------------------------------------

describe('useOutreachBadgeCount -- state 3 (parent parity)', () => {
  it('a parent viewer with the fixture resolves the literal count 2, same as a student viewer', async () => {
    renderProbe(
      PARENT_USER,
      {
        loadStudentHomeData: fixtureLoadStudentHomeData,
        resolveStudentScope: fixtureResolveStudentScope,
        resolveStudentId: fixtureResolveStudentId,
        now: FIXED_NOW,
      },
      async () => REAL_SEASON,
    );
    await flushMicrotasks();
    expect(probeText()).toBe('2');
  });
});

// ---------------------------------------------------------------------------
// State 4 -- resolveStudentId resolving null -> a real, computed 0.
// ---------------------------------------------------------------------------

describe('useOutreachBadgeCount -- state 4 (no linked student)', () => {
  it('resolveStudentId resolving null renders the literal number 0, not null', async () => {
    renderProbe(
      STUDENT_USER,
      { resolveStudentId: fixtureResolveStudentIdNull, now: FIXED_NOW },
      async () => REAL_SEASON,
    );
    await flushMicrotasks();
    expect(probeText()).toBe('0');
  });
});

// ---------------------------------------------------------------------------
// State 5 -- null (no badge) for a loading/error season, or a rejected
// loadStudentHomeData/resolveStudentScope.
// ---------------------------------------------------------------------------

describe('useOutreachBadgeCount -- state 5 (null: no badge)', () => {
  it("season 'loading' resolves null", async () => {
    renderProbe(STUDENT_USER, undefined, () => new Promise(() => {}));
    await flushMicrotasks();
    expect(probeText()).toBe('null');
  });

  it("season 'error' resolves null", async () => {
    renderProbe(STUDENT_USER, undefined, async () => {
      throw new Error('fixture: active season load failed');
    });
    await flushMicrotasks();
    expect(probeText()).toBe('null');
  });

  it('a rejected loadStudentHomeData resolves null', async () => {
    renderProbe(
      STUDENT_USER,
      {
        resolveStudentId: fixtureResolveStudentId,
        loadStudentHomeData: async () => {
          throw new Error('fixture: loadStudentHomeData failed');
        },
        resolveStudentScope: fixtureResolveStudentScope,
        now: FIXED_NOW,
      },
      async () => REAL_SEASON,
    );
    await flushMicrotasks();
    expect(probeText()).toBe('null');
  });

  it('a rejected resolveStudentScope resolves null', async () => {
    renderProbe(
      STUDENT_USER,
      {
        resolveStudentId: fixtureResolveStudentId,
        loadStudentHomeData: fixtureLoadStudentHomeData,
        resolveStudentScope: async () => {
          throw new Error('fixture: resolveStudentScope failed');
        },
        now: FIXED_NOW,
      },
      async () => REAL_SEASON,
    );
    await flushMicrotasks();
    expect(probeText()).toBe('null');
  });
});

// ---------------------------------------------------------------------------
// State 6 -- no active season is a real, computed 0.
// ---------------------------------------------------------------------------

describe("useOutreachBadgeCount -- state 6 (season 'none')", () => {
  it("season 'none' renders the literal number 0", async () => {
    renderProbe(STUDENT_USER, undefined, async () => null);
    await flushMicrotasks();
    expect(probeText()).toBe('0');
  });
});

// ---------------------------------------------------------------------------
// State 7 -- BEH-04 defines no coach/admin badge at all, regardless of
// season/data state (proved here with a fully-populated fixture that WOULD
// total 2 for a student/parent, so this proves the role gate, not merely an
// absence of data).
// ---------------------------------------------------------------------------

describe('useOutreachBadgeCount -- state 7 (no staff badge)', () => {
  it('an admin viewer resolves null even with a real ready season and a fixture that would otherwise total 2', async () => {
    renderProbe(
      ADMIN_USER,
      {
        loadStudentHomeData: fixtureLoadStudentHomeData,
        resolveStudentScope: fixtureResolveStudentScope,
        resolveStudentId: fixtureResolveStudentId,
        now: FIXED_NOW,
      },
      async () => REAL_SEASON,
    );
    await flushMicrotasks();
    expect(probeText()).toBe('null');
  });

  it('a coach viewer resolves null even with a real ready season and a fixture that would otherwise total 2', async () => {
    renderProbe(
      COACH_USER,
      {
        loadStudentHomeData: fixtureLoadStudentHomeData,
        resolveStudentScope: fixtureResolveStudentScope,
        resolveStudentId: fixtureResolveStudentId,
        now: FIXED_NOW,
      },
      async () => REAL_SEASON,
    );
    await flushMicrotasks();
    expect(probeText()).toBe('null');
  });
});
