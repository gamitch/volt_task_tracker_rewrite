// @vitest-environment jsdom
/**
 * T075: tests for `DashboardPage.tsx`.
 *
 * Per this task's Allowed Files this test file is the same class of
 * disclosed addition `CoachHome.test.tsx`/T053, `StudentHome.test.tsx`/T054,
 * and `ParentHome.test.tsx`/T055 already made in this same directory --
 * producing the DOM-text proof this task's own packet's "Required Worker
 * Output" section requires (role-based dispatch to the correct Home
 * component for all four `Role` values).
 *
 * No `@testing-library/react` is installed in this repo (confirmed via
 * `package.json`) -- these tests reuse the exact `createRoot`/`act` +
 * `AuthProvider`/`LoginAs` role-login harness `CoachHome.test.tsx` already
 * established (same file, same directory, most directly-relevant
 * precedent, itself mirroring `MeetingsList.test.tsx`/`OutreachList.test.tsx`).
 * `MemoryRouter` is included in the harness (matching `CoachHome.test.tsx`)
 * because `DashboardPage` dispatches `coach`/`admin` renders to the real
 * `CoachHome`, which itself calls `useNavigate()` internally and throws
 * outside a router context.
 */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthProvider, type AuthUser } from '../../app/guards';
import { LoginAs } from '../../test-utils/authHarness';
import { SeasonProvider, type LoadActiveSeasonFn } from '../../app/SeasonProvider';
import type { SeasonRow } from '../../lib/supabase/types';
import { DashboardPage } from './DashboardPage';

// T176 -- `StudentHome` (which this dispatcher routes `student` users to)
// now also calls a real identity-resolution seam (`resolveCurrentStudentId`/
// `resolveStudentScope`, module doc #8 in `StudentHome.tsx`), the same way
// `CoachHome` already required `useActiveSeason()` mocking (T155, above).
// `DashboardPage` renders `<StudentHome />` with zero props (module doc #1
// in `DashboardPage.tsx`, unchanged by this task -- that file is Forbidden
// here), so all three real exports below hit their real, unconfigured-in-
// jsdom defaults unless mocked at the module level -- measured (T176 gate
// round 1, MAJOR 6): mocking `resolveCurrentStudentId` alone still leaves
// `resolveStudentScope` hitting the real `getSupabaseClient()`, which
// `createLoader` normalizes into a rejection (`loader.ts:168-173`).
// T183 -- `StudentHome.tsx:1763`'s own production `loadData` default is now
// also real (`loaders/students.ts`'s `loadStudentHomeData`), a THIRD seam
// this dispatcher's zero-props render reaches -- so this file's own
// "renders StudentHome for role \"student\"" test now mocks all three
// exports (`resolveCurrentStudentId` below, `resolveStudentScope` and
// `loadStudentHomeData` in the second `vi.mock` block right after this one)
// rather than the two T176 originally required; leaving any one unmocked
// would surface as this test's "Couldn't load Home" DES-12 error state
// instead of the `'Hi Jordan Blake'` marker text this file now asserts.
vi.mock('../../lib/supabase/loaders/meetings', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../lib/supabase/loaders/meetings')>();
  return {
    ...actual,
    resolveCurrentStudentId: async () => 'student-fixture-dashboardpage',
  };
});
vi.mock('../../lib/supabase/loaders/students', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../lib/supabase/loaders/students')>();
  return {
    ...actual,
    resolveStudentScope: async () => ({
      teamId: 'team-fixture-dashboardpage',
      goalHours: 100,
      confirmedHours: 0,
      plannedHours: 0,
    }),
    // T183 -- the new production `loadData` export. A distinct, fabricated
    // name from the `StudentHome.test.tsx` DI'd proof ('Priya Chen') so a
    // reader can tell at a glance which test is proving which thing, and so
    // a bug that returns the wrong constant couldn't accidentally satisfy
    // both (constitution item 6 -- fixtures use fabricated names).
    loadStudentHomeData: async (_studentId: string, seasonId: string) => ({
      seasonId,
      displayName: 'Jordan Blake',
      defaultGoalHours: 0,
      goalHoursOverride: null,
      events: [],
      sessions: [],
      rsvps: [],
      studentHours: null,
      participation: null,
    }),
  };
});

// T181 (MAJOR 4): `ParentHome` (which this dispatcher routes `parent` users
// to) now also calls a real backend (`loadLinkedStudentsForParentHome`/
// `loadStudentHomeCardDataForParentHome`, `ParentHome.tsx`'s own prop
// defaults), which hits the real, unconfigured-in-jsdom `getSupabaseClient()`
// unless mocked at the module level -- same class of gap T176's own MAJOR 6
// fix (above) closed for `StudentHome`. Both real defaults are mocked here
// with fast, deterministic, DISTINCT, non-fixture data (gate round 1,
// MAJOR 4: `ParentHome.tsx`'s own shipped fixture names -- 'Ada R.'/
// 'Bea R.'/'Cleo R.' -- must never be this file's own discriminator, since
// they never reach the DOM once the real default is wired and unmocked).
vi.mock('../../lib/supabase/loaders/parentHome', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../lib/supabase/loaders/parentHome')>();
  return {
    ...actual,
    loadLinkedStudentsForParentHome: async () => ({
      students: [
        {
          studentId: 'student-fixture-dashboardpage',
          displayName: 'Dashboard Fixture Linked Student',
          teamId: 'team-fixture-dashboardpage-parent',
          isActive: true,
        },
      ],
      teams: [{ id: 'team-fixture-dashboardpage-parent', name: 'Dashboard Fixture Parent Team' }],
    }),
    loadStudentHomeCardDataForParentHome: async () => ({
      goalHours: 100,
      confirmedHours: 0,
      participation: null,
      consistencyEntries: [],
      nextEvents: [],
      rsvps: [],
    }),
  };
});

// T173: `CoachHome` (which this dispatcher routes `coach`/`admin` users to)
// now also calls a real backend for its primary KPI grid
// (`loaders/coachHome.ts`'s `loadCoachHomeData`, `CoachHome.tsx:2168`'s own
// prop default), which hits the real, unconfigured-in-jsdom
// `getSupabaseClient()` unless mocked at the module level -- same class of
// gap the `loaders/parentHome`/`loaders/students` mocks above already close
// for the other two Home components. `teams: []` is deliberate (not
// "distinctly non-empty") -- it keeps the admin test's existing
// `.toContain('Season setup')` assertion's truth value unchanged; see the
// new `'...missing teams.'` assertion below for how that assertion is
// strengthened into a real proof instead of a vacuous one.
vi.mock('../../lib/supabase/loaders/coachHome', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../lib/supabase/loaders/coachHome')>();
  return {
    ...actual,
    loadCoachHomeData: async (seasonId: string) => ({
      seasonId,
      defaultGoalHours: 0, // Inert -- see CoachHome.tsx module doc section 15; never asserted against.
      teams: [],
      students: [],
      seasonSetupStatus: { hasGoalsConfigured: true },
      events: [],
      sessions: [],
      rsvps: [],
      attendance: [],
      studentHours: [],
    }),
  };
});

// T173 (round-1 BLOCKER fix, required): `CoachHome.tsx`'s `Default goal
// {defaultGoalHours}h` text (the `Avg hours / active student` secondary)
// sits inside the `{dashboardData && (...)}` gate, which only opens once
// `loadDashboardDataProp(seasonId)` resolves. Without this mock, the real,
// unconfigured `getSupabaseClient()`-backed `loadDashboardData` default
// rejects in jsdom and this entire grid -- including the `Default goal Xh`
// text -- never renders, so no assertion inside it could ever pass. The
// mock only needs to make the gate open; its field VALUES don't need to be
// realistic (`DashboardData` is fully nullable/array-typed).
vi.mock('../../lib/supabase/loaders/dashboard', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../lib/supabase/loaders/dashboard')>();
  return {
    ...actual,
    loadDashboardData: async (seasonId: string) => ({
      seasonId,
      rosterStats: null,
      attendanceRate: null,
      sessionDays: null,
      upcomingCommittedHours: null,
      dayOfWeekSessions: [],
      teamHours: [],
      topEvents: [],
      goalProjection: [],
      activityFeedSource: { events: [], sessions: [], rsvps: [], attendance: [], students: [] },
    }),
  };
});

// T203: `CoachHome` (routed here for coach/admin) now also embeds a real
// leaderboard (`loaders/leaderboard.ts`'s `loadLeaderboardData`,
// `CoachHome.tsx`'s own new prop default), which hits the real,
// unconfigured-in-jsdom `getSupabaseClient()` unless mocked at the module
// level -- same class of gap the five mocks above already close for their
// own real defaults.
vi.mock('../../lib/supabase/loaders/leaderboard', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../lib/supabase/loaders/leaderboard')>();
  return {
    ...actual,
    // Deliberately narrower than `LoadLeaderboardDataFn`'s own
    // `(seasonId: string) => ...` signature (same structural-typing
    // convention this file's sibling `CoachHome.test.tsx` already
    // documents for its own `fixtureLoadData`/`fixtureLoadDashboardData`) --
    // avoids an unused-`seasonId`-param ESLint error the packet's own
    // literal `(_seasonId: string) => ...` prescription would trip (this
    // repo's eslint config has no `argsIgnorePattern` for `no-unused-vars`,
    // and `_seasonId` here is the sole parameter, not one preceding a later
    // used one).
    loadLeaderboardData: async () => ({ hours: [], students: [] }),
  };
});
// T203 (gate round 1, BLOCKER 1 / BLOCKER 2): `Leaderboard`'s own
// `useLeaderboardData` fetches BOTH `loadData` and `loadPrivacySetting` via
// `Promise.all` (`Leaderboard.tsx:434`) -- mocking only `loaders/leaderboard`
// above still leaves the real, unconfigured `loaders/leaderboard_privacy`
// rejecting in jsdom, and `Promise.all` fails if either promise rejects, so
// the embed would stay in its error state and never actually prove
// reachability. Same class of gap the mock immediately above closes for
// `loaders/leaderboard` itself.
vi.mock('../../lib/supabase/loaders/leaderboard_privacy', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('../../lib/supabase/loaders/leaderboard_privacy')>();
  return {
    ...actual,
    loadPrivacySetting: async () => true,
  };
});

// ---------------------------------------------------------------------------
// Render harness -- mirrors CoachHome.test.tsx.
//
// T155: `CoachHome` (which this dispatcher routes `coach`/`admin` users to)
// now calls `useActiveSeason()`, so every render needs a `<SeasonProvider>`
// ancestor. `FIXTURE_ACTIVE_SEASON` is the same shared-fixture-constant
// convention `CoachHome.test.tsx`'s own harness uses (a distinctive,
// non-placeholder id, matching `AppShell.test.tsx`'s `T140_FIXTURE_SEASON`
// pattern) -- criterion 8's own "harness-only, no individual it( body
// changes" requirement: `loadActiveSeason` is a new optional second
// parameter (default resolves this fixture quickly), so every pre-existing
// `it(` below still calls `renderAsUser(user)` with exactly one argument.
// The only two tests this actually affects are the "coach"/"admin" cases
// (`DashboardPage.tsx`'s own role switch routes only those two roles to the
// real `CoachHome`; `student`/`parent`/`null` never reach it at all).
// ---------------------------------------------------------------------------

let container: HTMLDivElement;
let root: Root;

const ADMIN_USER: AuthUser = { id: 'user-admin', email: 'admin@example.com', role: 'admin' };
const COACH_USER: AuthUser = { id: 'user-coach', email: 'coach@example.com', role: 'coach' };
const STUDENT_USER: AuthUser = {
  id: 'user-student',
  email: 'student@example.com',
  role: 'student',
};
const PARENT_USER: AuthUser = { id: 'user-parent', email: 'parent@example.com', role: 'parent' };

const FIXTURE_ACTIVE_SEASON: SeasonRow = {
  id: 'season-fixture-active',
  name: 'Fixture Active Season',
  startsOn: '2026-01-01',
  endsOn: '2026-12-31',
  defaultGoalHours: 100,
  isActive: true,
  createdAt: '2026-01-01T00:00:00.000Z',
};

function renderAsUser(
  user: AuthUser | null,
  loadActiveSeason: LoadActiveSeasonFn = async () => FIXTURE_ACTIVE_SEASON,
): void {
  act(() => {
    root.render(
      <MemoryRouter>
        <SeasonProvider loadActiveSeason={loadActiveSeason}>
          <AuthProvider>
            {user === null ? (
              <DashboardPage />
            ) : (
              <LoginAs user={user}>
                <DashboardPage />
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

// ---------------------------------------------------------------------------
// Role dispatch
// ---------------------------------------------------------------------------

describe('DashboardPage role dispatch', () => {
  it('renders CoachHome for role "coach"', async () => {
    renderAsUser(COACH_USER);
    await flushMicrotasks();
    // CoachHome-only KPI label (CoachHome.tsx's own "Team participation" KPI card).
    expect(container.textContent).toContain('Events in next 7 days');
    // CoachHome's HOME-04 admin-only "Season setup" card must NOT show for a
    // plain coach (CoachHome.tsx's own internal role gate), proving this
    // really is CoachHome branching internally, not a coincidence.
    expect(container.textContent).not.toContain('Season setup');
    // Never the other two Home components' distinguishing content. T181
    // (MAJOR 4, C11): the mocked ParentHome name, NOT the shipped
    // `ParentHome.tsx` fixture names -- those never reach the DOM once the
    // real default is wired, so asserting against them here would be
    // vacuously true for the wrong reason (gate round 1's own finding).
    // T183 (criterion 7c): once the "student" test's own mock below returns
    // 'Hi Jordan Blake' instead of 'Hi Ada Reyes', the old string alone
    // would go vacuously true here for an unrelated reason (coach renders
    // never mount StudentHome at all) -- assert against the name actually
    // in play too, same vacuity class this comment already documents for
    // the ParentHome fixture names.
    expect(container.textContent).not.toContain('Hi Ada Reyes');
    expect(container.textContent).not.toContain('Hi Jordan Blake');
    expect(container.textContent).not.toContain('Dashboard Fixture Linked Student');
    // T173: proves (a) the new `loaders/dashboard` mock actually opened the
    // `{dashboardData && (...)}` gate `Default goal {defaultGoalHours}h`
    // lives inside (round-1 BLOCKER fix), and (b) `CoachHome.tsx`'s render
    // now reads the new `defaultGoalHours` PROP (sourced from
    // `activeSeason.season.defaultGoalHours`, `100` per this file's own
    // `FIXTURE_ACTIVE_SEASON`), not `data.defaultGoalHours` -- if the
    // render-source edit were missing this would show 'Default goal 0h'
    // (the new loader's own inert literal) instead of '100h'.
    expect(container.textContent).toContain('Default goal 100h');
    // T203: the embedded Leaderboard is reachable via the real dispatcher
    // (not just CoachHome.test.tsx's own isolated harness). With both new
    // module-level mocks above wired, the empty `hours: []` fixture plus
    // `true` privacy setting resolves to Leaderboard's own honest
    // empty-state text, not its error text -- the heading alone is not
    // sufficient (see the mutation proof in this task's worker output).
    expect(container.textContent).toContain('Season Volunteer Leaderboard');
    expect(container.textContent).toContain('No volunteer hours recorded yet');
    expect(container.textContent).not.toContain("Couldn't load the leaderboard");
  });

  it('renders CoachHome for role "admin" (HOME-04 handled internally by CoachHome, not duplicated here)', async () => {
    renderAsUser(ADMIN_USER);
    await flushMicrotasks();
    expect(container.textContent).toContain('Events in next 7 days');
    // T173: the mocked `loaders/coachHome` always reports
    // `hasGoalsConfigured: true` -- this card now shows because the mock's
    // `teams: []` makes `isSeasonMissingSetup` true via the teams branch,
    // not the goals branch (there is no more fixture `seasonSetupStatus` in
    // play for this render). The new `'...missing teams.'` assertion below
    // is the real, non-vacuous proof of that -- this assertion alone stays
    // true either way, so it's kept only as the same "is this really
    // CoachHome" proof it always was.
    expect(container.textContent).toContain('Season setup');
    // T173 (real, non-vacuous proof of `loaders/coachHome`'s wiring):
    // pre-fix (or if `loadData` were never swapped), `defaultLoadCoachHomeData`'s
    // in-file `FIXTURE_TEAMS` is non-empty and `FIXTURE_SEASON_SETUP_STATUS.
    // hasGoalsConfigured` is `false`, so this description would read
    // "...missing season goals." instead -- a genuinely different,
    // assertable string.
    expect(container.textContent).toContain('The active season is missing teams.');
    // T173 -- same proof as the "coach" case above.
    expect(container.textContent).toContain('Default goal 100h');
    // T183 (criterion 7c) -- same vacuity guard as the "coach" case above.
    expect(container.textContent).not.toContain('Hi Ada Reyes');
    expect(container.textContent).not.toContain('Hi Jordan Blake');
    expect(container.textContent).not.toContain('Dashboard Fixture Linked Student');
    // T203: same reachability proof as the "coach" case above.
    expect(container.textContent).toContain('Season Volunteer Leaderboard');
    expect(container.textContent).toContain('No volunteer hours recorded yet');
    expect(container.textContent).not.toContain("Couldn't load the leaderboard");
  });

  it('renders StudentHome for role "student"', async () => {
    renderAsUser(STUDENT_USER);
    await flushMicrotasks();
    // StudentHome-only hero heading. T183: `StudentHome.tsx:1763`'s
    // production `loadData` default is now real
    // (`loaders/students.ts`'s `loadStudentHomeData`), mocked above to
    // return 'Jordan Blake' -- this is the ONLY test in the repo that
    // renders `<StudentHome />` zero-props through the real production
    // dispatcher, so it is the only test that closes the vacuity gap on
    // `StudentHome.tsx:1763` actually having been swapped.
    expect(container.textContent).toContain('Hi Jordan Blake');
    // T198/T803 -- the CoachHome-unique marker was 'Team participation', then
    // 'Participation'; that tile is now removed entirely (it duplicated the
    // analytics section's 'Attendance rate'). This label is still unique to
    // CoachHome and still present.
    expect(container.textContent).not.toContain('Events in next 7 days');
    expect(container.textContent).not.toContain('Dashboard Fixture Linked Student');
  });

  it('renders ParentHome for role "parent"', async () => {
    renderAsUser(PARENT_USER);
    await flushMicrotasks();
    // T181 (MAJOR 4, C11): ParentHome-only per-linked-student card, sourced
    // from this file's own module-level mock of the real
    // `loadLinkedStudentsForParentHome` default (above) -- a distinct,
    // non-fixture name/team, matching this file's own
    // `-fixture-dashboardpage` naming convention (mirrors the
    // `resolveStudentScope` mock's own `team-fixture-dashboardpage` above).
    expect(container.textContent).toContain('Dashboard Fixture Linked Student');
    expect(container.textContent).toContain('Dashboard Fixture Parent Team');
    expect(container.textContent).not.toContain('Ada R.');
    expect(container.textContent).not.toContain('Bea R.');
    expect(container.textContent).not.toContain('Cleo R.');
    // T198/T803 -- the CoachHome-unique marker was 'Team participation', then
    // 'Participation'; that tile is now removed entirely (it duplicated the
    // analytics section's 'Attendance rate'). This label is still unique to
    // CoachHome and still present.
    expect(container.textContent).not.toContain('Events in next 7 days');
    // T183 (criterion 7c) -- same vacuity guard as the "coach"/"admin" cases
    // above.
    expect(container.textContent).not.toContain('Hi Ada Reyes');
    expect(container.textContent).not.toContain('Hi Jordan Blake');
  });

  it('renders nothing when user is null (defense in depth -- unreachable in practice under RequireAuth)', () => {
    renderAsUser(null);
    expect(container.textContent).toBe('');
  });
});
