// @vitest-environment jsdom
/**
 * T085: tests for `ReportsShell.tsx`. T091 (ED-1 Packet P4) UPDATE: adds
 * coverage for the shell's own new `useActiveSeason()` wiring (module doc #2
 * in `ReportsShell.tsx`) -- every render below now also wraps in a scoped
 * fake `<SeasonProvider>` (module doc below), since `ReportsShell` calls
 * `useActiveSeason()` unconditionally now, even when an explicit `seasonId`
 * prop is also supplied.
 *
 * `ReportsShell.tsx` never had its own test file before T085 (T056's
 * original shell + `ParticipationTab` wiring shipped with no colocated test,
 * and `HoursTab`/`EventsTab` -- T057/T058 -- were each built afterward as
 * their own standalone components with their own test files, never touching
 * this shell). This file proves each task's own acceptance criteria directly
 * against the real, composed page:
 *
 *   (a) Hours and Events, when selected, render their REAL components with
 *       the shared `seasonId` threaded through -- and the shell's old
 *       "currently-Blocked" placeholder `EmptyState` copy is gone.
 *       Participation (already wired by T056, unchanged by this task) is
 *       included too, as the established precedent this task followed.
 *   (b) the pre-existing `RequireRole` guard and `TabList` tab-switching
 *       mechanism (both untouched by this task) still work.
 *   (c) T091: the shell's default `seasonId` genuinely comes from
 *       `useActiveSeason()` now (all four states rendered correctly, `'none'`
 *       as an honest empty state never a crash/fallback), and an explicit
 *       `seasonId` prop still overrides the hook's value outright.
 *
 * Uses the same raw `createRoot`/`act` pattern (no `@testing-library/react`
 * installed in this repo) and the same `AuthProvider` + `LoginAsDeferred`
 * role-login harness every other gated content page's test file in this
 * project already established.
 *
 * T091: `src/test-utils/**` is a forbidden/read-only directory for this
 * task, so (same posture `SeasonSettings.test.tsx`'s own module doc already
 * takes) the fake `<SeasonProvider>` wiring below is defined locally in this
 * file rather than extracted to a shared harness. `DEFAULT_READY_SEASON_ID`
 * intentionally reuses `ParticipationTab.tsx`'s own exported
 * `PLACEHOLDER_CURRENT_SEASON_ID` LITERAL VALUE (imported directly, not
 * guessed/retyped) as the harness's default resolved active season id --
 * `ParticipationTab`/`HoursTab`/`EventsTab` each independently key their own
 * fixture-backed default `loadData` to that exact literal (each file's own
 * module doc, unchanged by this task), so reusing it here means every
 * pre-existing "renders the real fixture row" assertion below keeps working
 * unchanged when no test overrides the resolved season id explicitly.
 */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthProvider, type AuthUser } from '../../app/guards';
import { SeasonProvider, type LoadActiveSeasonFn } from '../../app/SeasonProvider';
import type { SeasonRow } from '../../lib/supabase/types';
import { LoginAsDeferred as LoginAs } from '../../test-utils/authHarness';
import { PLACEHOLDER_CURRENT_SEASON_ID, type ParticipationDisplayRow } from './ParticipationTab';
import type { HoursLoadResult } from './HoursTab';
import type { EventSessionDisplayRow } from './EventsTab';
import {
  loadEventSessionsData,
  loadHoursData,
  loadParticipationData,
} from '../../lib/supabase/loaders/reports';
import { ReportsShell } from './ReportsShell';

// ---------------------------------------------------------------------------
// T098: `ParticipationTab.tsx`/`HoursTab.tsx`/`EventsTab.tsx`'s default
// `loadData` was switched (T095) from a fixture stub to the real
// Supabase-backed loaders (`loadParticipationData`/`loadHoursData`/
// `loadEventSessionsData`, all three from
// `../../lib/supabase/loaders/reports`), which correctly reject in this test
// environment (Supabase unconfigured). This file renders `<ReportsShell />`
// with no `loadParticipationData`/`loadHoursData`/`loadEventsData` props on
// its three "real tab wiring" tests (matching `ReportsShell.tsx`'s own
// correct zero-explicit-loadData-by-default design, a forbidden file here),
// so it cannot inject a fixture through props there. Instead it mocks all
// three loaders at the single shared module boundary (they all live in one
// file), mirroring the intent `RosterShell.test.tsx` already established
// one-mock-per-loader-module for `InvitesTab`/`StudentsTab`/`TeamsTab`/
// `ParentsTab` -- here all three needed functions happen to share one module
// file, so one `vi.mock` block covers all three rather than three separate
// blocks.
//
// UNLIKE the `RosterShell.test.tsx` precedent (Known Context/Traps #1), this
// mock factory deliberately does NOT call `importOriginal()`/spread `...
// actual`. `../../lib/supabase/loaders/reports.ts` (forbidden/read-only)
// itself imports the real, RUNTIME `buildDisplayRows` function from BOTH
// `ParticipationTab.tsx` and `EventsTab.tsx` (its own module doc #2) to reuse
// their join logic -- a genuine circular import (reports.ts -> {Participation
// Tab,EventsTab}.tsx -> reports.ts) that none of the roster loaders have
// (`loaders/invites.ts`/`students.ts`/`teams.ts`/`parents.ts` only import
// *types* from their own tab files, never runtime values, per direct
// inspection -- no equivalent cycle there). Empirically (this task's own
// worker output; a `vi.fn()`'s `.mock.calls` count directly proved this),
// calling `importOriginal()` here forces Vitest to walk that real, circular
// module graph mid-mock-resolution, and depending on unpredictable import-
// order timing `ParticipationTab.tsx`'s/`EventsTab.tsx`'s own top-level
// `import { loadParticipationData }`/`import { loadEventSessionsData } from
// '../../lib/supabase/loaders/reports'` can end up bound to the REAL
// (network-calling, `SupabaseNotConfiguredError`-rejecting) function instead
// of this file's mock, even though the identical-looking `HoursTab.tsx` case
// (no circular import, `../loaders/reports.ts` has no equivalent
// `buildDisplayRows`-style reuse from `HoursTab.tsx` -- its own module doc
// #2) was never affected. Since no test in this file needs any OTHER export
// from `loaders/reports.ts` (only these three functions are ever imported
// from it anywhere in this app -- grep-provable), the mock factory below
// returns a fully synthetic module object instead, sidestepping the real
// module graph (and its circular reentrancy hazard) entirely.
// ---------------------------------------------------------------------------
vi.mock('../../lib/supabase/loaders/reports', () => {
  return {
    loadParticipationData: vi.fn(),
    loadHoursData: vi.fn(),
    loadEventSessionsData: vi.fn(),
  };
});

const mockedLoadParticipationData = vi.mocked(loadParticipationData);
const mockedLoadHoursData = vi.mocked(loadHoursData);
const mockedLoadEventSessionsData = vi.mocked(loadEventSessionsData);

// Small, deterministic fixture (same row shape as `ParticipationTab.tsx`'s
// own `FIXTURE_STUDENTS`/`FIXTURE_TEAMS`/`FIXTURE_METRICS`, not imported
// since those constants aren't exported) -- covers exactly what the affected
// test asserts: an "Ava Thompson" student row.
const MOCK_PARTICIPATION_ROWS: ParticipationDisplayRow[] = [
  {
    studentId: 'student-ava-thompson',
    studentName: 'Ava Thompson',
    teamId: 'team-falcons',
    teamName: 'Falcons',
    seasonId: PLACEHOLDER_CURRENT_SEASON_ID,
    expectedCt: 10,
    presentCt: 9,
    lateCt: 0,
    excusedCt: 0,
    participationPct: 90.0,
  },
];

// Small, deterministic fixture (same row shape as `HoursTab.tsx`'s own
// `FIXTURE_STUDENTS`/`FIXTURE_TEAMS`, not imported since those constants
// aren't exported) -- covers exactly what the affected test asserts: a
// "Jordan Blake" student row alongside the always-rendered "Season totals"
// heading. `events`/`sessions`/`rsvps`/`studentHours` are deliberately empty
// -- `buildStudentRows`/`buildSeasonTotals` (`HoursTab.tsx`, forbidden/
// read-only) both tolerate empty arrays, producing an honest `0`-hours row
// rather than a crash.
const MOCK_HOURS_RESULT: HoursLoadResult = {
  seasonId: PLACEHOLDER_CURRENT_SEASON_ID,
  defaultGoalHours: 100,
  students: [
    {
      id: 'student-jordan-blake',
      name: 'Jordan Blake',
      teamId: 'team-hawks',
      goalHoursOverride: null,
    },
  ],
  teams: [{ id: 'team-hawks', name: 'Hawks' }],
  studentHours: [],
  events: [],
  sessions: [],
  rsvps: [],
};

// Small, deterministic fixture (same row shape as `EventsTab.tsx`'s own
// `FIXTURE_EVENTS`/`FIXTURE_SESSIONS`, not imported since this loader mock
// returns the final `EventSessionDisplayRow[]` shape directly, not the raw
// rows those fixtures model) -- covers exactly what the affected test
// asserts: a "Weekly Team Meeting" session row.
const MOCK_EVENTS_RESULT: EventSessionDisplayRow[] = [
  {
    sessionId: 'session-weekly-team-meeting-1',
    eventId: 'event-weekly-team-meeting',
    eventTitle: 'Weekly Team Meeting',
    type: 'meeting',
    sessionDate: '2026-01-05',
    status: 'completed',
    attendance: { presentCt: 0, lateCt: 0, excusedCt: 0, absentCt: 0 },
    signups: null,
    hoursAwarded: null,
    peopleReached: null,
    adultVolunteersCount: 0,
    adultVolunteerHours: 0,
  },
];

// ---------------------------------------------------------------------------
// Render harness -- mirrors `RosterShell.test.tsx`'s own harness (same
// project-wide `AuthProvider` + `LoginAsDeferred` pattern), extended (T091)
// with a scoped fake `<SeasonProvider>`.
// ---------------------------------------------------------------------------

let container: HTMLDivElement;
let root: Root;

const ADMIN_USER: AuthUser = { id: 'user-admin', email: 'admin@example.com', role: 'admin' };
const COACH_USER: AuthUser = { id: 'user-coach', email: 'coach@example.com', role: 'coach' };
const PARENT_USER: AuthUser = { id: 'user-parent', email: 'parent@example.com', role: 'parent' };

const DEFAULT_READY_SEASON: SeasonRow = {
  id: PLACEHOLDER_CURRENT_SEASON_ID,
  name: 'Fixture Season',
  startsOn: '2025-08-01',
  endsOn: '2026-06-30',
  defaultGoalHours: 100,
  isActive: true,
  createdAt: '2025-08-01T00:00:00.000Z',
};

/** T091 harness default: an immediately-`'ready'` season matching the
 * fixture id every tab's own default `loadData` already keys to (module doc
 * above). Tests that care about a different `useActiveSeason()` state pass
 * their own `loadActiveSeason` override. */
const DEFAULT_LOAD_ACTIVE_SEASON: LoadActiveSeasonFn = async () => DEFAULT_READY_SEASON;

function renderReportsShell(
  user: AuthUser | null,
  props: Parameters<typeof ReportsShell>[0] = {},
  loadActiveSeason: LoadActiveSeasonFn = DEFAULT_LOAD_ACTIVE_SEASON,
): void {
  act(() => {
    root.render(
      <MemoryRouter initialEntries={['/reports']}>
        <AuthProvider>
          <SeasonProvider loadActiveSeason={loadActiveSeason}>
            <Routes>
              <Route
                path="/reports"
                element={
                  user === null ? (
                    <ReportsShell {...props} />
                  ) : (
                    <LoginAs user={user}>
                      <ReportsShell {...props} />
                    </LoginAs>
                  )
                }
              />
              <Route path="/" element={<div data-testid="redirected-home" />} />
            </Routes>
          </SeasonProvider>
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

function clickTab(value: 'participation' | 'hours' | 'events'): void {
  const tab = document.querySelector(`button[data-tab-value="${value}"]`);
  expect(tab, `expected a Tab button for "${value}"`).toBeTruthy();
  act(() => {
    tab?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
}

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  mockedLoadParticipationData.mockReset().mockResolvedValue(MOCK_PARTICIPATION_ROWS);
  mockedLoadHoursData.mockReset().mockResolvedValue(MOCK_HOURS_RESULT);
  mockedLoadEventSessionsData.mockReset().mockResolvedValue(MOCK_EVENTS_RESULT);
});

afterEach(() => {
  act(() => {
    root.unmount();
  });
  container.remove();
});

// ---------------------------------------------------------------------------
// (b) RequireRole guard -- unchanged from T056, quick regression check.
// ---------------------------------------------------------------------------

describe('<ReportsShell /> RequireRole guard (unchanged from T056)', () => {
  it('denies a non-coach/admin role (RPT-06) with AccessDeniedPage', async () => {
    renderReportsShell(PARENT_USER);
    await flushMicrotasks();
    expect(container.querySelector('[data-testid="redirected-home"]')).toBeNull();
    expect(container.textContent).toContain("This page isn't part of your role");
    expect(container.textContent).not.toContain('Reports');
  });

  it('admits a coach', async () => {
    renderReportsShell(COACH_USER);
    await flushMicrotasks();
    expect(container.textContent).toContain('Reports');
  });

  it('admits an admin', async () => {
    renderReportsShell(ADMIN_USER);
    await flushMicrotasks();
    expect(container.textContent).toContain('Reports');
  });
});

// ---------------------------------------------------------------------------
// (a) Real tab wiring -- the central acceptance criterion for this task.
// ---------------------------------------------------------------------------

const OLD_PLACEHOLDER_STRINGS = [
  'Hours report not built yet',
  'Events report not built yet',
  'currently-Blocked',
  'T057',
  'T058',
];

describe('<ReportsShell /> real tab wiring (T085 acceptance criteria)', () => {
  it('renders the real ParticipationTab (already-wired T056 precedent) on the default tab', async () => {
    renderReportsShell(COACH_USER);
    await flushMicrotasks();
    // Real ParticipationTab fixture row (ParticipationTab.tsx's own FIXTURE_STUDENTS).
    expect(container.textContent).toContain('Ava Thompson');
  });

  it('renders the real HoursTab when the Hours tab is selected', async () => {
    renderReportsShell(COACH_USER);
    await flushMicrotasks();
    clickTab('hours');
    await flushMicrotasks();
    // Real HoursTab content: its own "Season totals" cards + a real fixture
    // student row (HoursTab.tsx's own FIXTURE_STUDENTS), never present on
    // the old placeholder EmptyState.
    expect(container.textContent).toContain('Season totals');
    expect(container.textContent).toContain('Jordan Blake');
    expect(container.textContent).not.toContain('Hours report not built yet');
  });

  it('renders the real EventsTab when the Events tab is selected', async () => {
    renderReportsShell(COACH_USER);
    await flushMicrotasks();
    clickTab('events');
    await flushMicrotasks();
    // Real EventsTab fixture session row (EventsTab.tsx's own FIXTURE_EVENTS).
    expect(container.textContent).toContain('Weekly Team Meeting');
    expect(container.textContent).not.toContain('Events report not built yet');
  });

  it('never shows any old placeholder copy across the full tab tour', async () => {
    renderReportsShell(ADMIN_USER);
    await flushMicrotasks();
    for (const value of ['participation', 'hours', 'events'] as const) {
      clickTab(value);
      await flushMicrotasks();
      for (const placeholder of OLD_PLACEHOLDER_STRINGS) {
        expect(container.textContent).not.toContain(placeholder);
      }
    }
  });

  it('threads one shared seasonId to all three tabs (module doc #2 -- no second placeholder)', async () => {
    const seasonId = 'season-shared-test-id';
    let participationSeasonIdSeen: string | null = null;
    let hoursSeasonIdSeen: string | null = null;
    let eventsSeasonIdSeen: string | null = null;

    renderReportsShell(COACH_USER, {
      seasonId,
      loadParticipationData: async (id: string) => {
        participationSeasonIdSeen = id;
        return [];
      },
      loadHoursData: async (id: string) => {
        hoursSeasonIdSeen = id;
        return {
          seasonId: id,
          defaultGoalHours: 0,
          students: [],
          teams: [],
          studentHours: [],
          events: [],
          sessions: [],
          rsvps: [],
        };
      },
      loadEventsData: async (id: string) => {
        eventsSeasonIdSeen = id;
        return [];
      },
    });
    await flushMicrotasks();

    clickTab('hours');
    await flushMicrotasks();
    clickTab('events');
    await flushMicrotasks();

    expect(participationSeasonIdSeen).toBe(seasonId);
    expect(hoursSeasonIdSeen).toBe(seasonId);
    expect(eventsSeasonIdSeen).toBe(seasonId);
  });
});

// ---------------------------------------------------------------------------
// (b) TabList tab-switching + keyboard-nav scaffold -- unchanged from T056,
// quick regression check only.
// ---------------------------------------------------------------------------

describe('<ReportsShell /> tab scaffold regression check (unchanged from T056)', () => {
  it('renders all three tabs in RPT-01 literal order: Participation | Hours | Events', async () => {
    renderReportsShell(COACH_USER);
    await flushMicrotasks();
    const tabs = Array.from(document.querySelectorAll('button[data-tab-value]')).map((el) =>
      el.getAttribute('data-tab-value'),
    );
    expect(tabs).toEqual(['participation', 'hours', 'events']);
  });

  it('switches the active/selected tab (aria-current) when a different tab is clicked', async () => {
    renderReportsShell(COACH_USER);
    await flushMicrotasks();

    const participationTabButton = document.querySelector('button[data-tab-value="participation"]');
    expect(participationTabButton?.getAttribute('aria-current')).toBe('page');

    clickTab('events');
    await flushMicrotasks();

    const eventsTabButton = document.querySelector('button[data-tab-value="events"]');
    expect(eventsTabButton?.getAttribute('aria-current')).toBe('page');
    expect(participationTabButton?.getAttribute('aria-current')).toBeNull();
  });

  it('still supports roving-tabindex ArrowRight keyboard navigation across the tab strip', async () => {
    renderReportsShell(COACH_USER);
    await flushMicrotasks();

    const participationTabButton = document.querySelector(
      'button[data-tab-value="participation"]',
    ) as HTMLButtonElement;
    const hoursTabButton = document.querySelector(
      'button[data-tab-value="hours"]',
    ) as HTMLButtonElement;

    act(() => {
      participationTabButton.focus();
    });
    expect(document.activeElement).toBe(participationTabButton);

    act(() => {
      participationTabButton.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }),
      );
    });

    expect(document.activeElement).toBe(hoursTabButton);
  });
});

// ---------------------------------------------------------------------------
// T091 (ED-1 Packet P4): `useActiveSeason()` wiring -- module doc #2's four
// states, and the explicit-`seasonId`-prop override precedence.
// ---------------------------------------------------------------------------

describe('<ReportsShell /> useActiveSeason() wiring (T091)', () => {
  it('renders a loading state (no TabList) while useActiveSeason() is still `loading`', async () => {
    renderReportsShell(COACH_USER, {}, () => new Promise(() => {}));
    await flushMicrotasks();
    expect(container.textContent).toContain('Loading the active season');
    expect(document.querySelector('button[data-tab-value]')).toBeNull();
  });

  it('renders an honest "No active season yet" empty state (no TabList) for the real `\'none\'` case -- zero seasons in the database', async () => {
    renderReportsShell(COACH_USER, {}, async () => null);
    await flushMicrotasks();
    expect(container.textContent).toContain('No active season yet');
    expect(document.querySelector('button[data-tab-value]')).toBeNull();
    // Never a crash, never silently falling back to fixture tab content.
    expect(container.textContent).not.toContain('Ava Thompson');
  });

  it("renders the real SupabaseLoaderError message (no TabList) for the `'error'` case", async () => {
    renderReportsShell(COACH_USER, {}, async () => {
      throw { code: '42501', message: 'Permission denied.', cause: null };
    });
    await flushMicrotasks();
    expect(container.textContent).toContain("Couldn't load the active season");
    expect(container.textContent).toContain('Permission denied.');
    expect(document.querySelector('button[data-tab-value]')).toBeNull();
  });

  it("renders the real tabs, scoped to the real active season id, for the `'ready'` case (no explicit seasonId prop)", async () => {
    let participationSeasonIdSeen: string | null = null;
    renderReportsShell(
      COACH_USER,
      {
        loadParticipationData: async (id: string) => {
          participationSeasonIdSeen = id;
          return [];
        },
      },
      async () => ({ ...DEFAULT_READY_SEASON, id: 'season-real-active-id' }),
    );
    await flushMicrotasks();

    expect(document.querySelector('button[data-tab-value]')).not.toBeNull();
    expect(participationSeasonIdSeen).toBe('season-real-active-id');
  });

  it("an explicit seasonId prop overrides useActiveSeason() outright, even when the hook is not `'ready'`", async () => {
    let participationSeasonIdSeen: string | null = null;
    renderReportsShell(
      COACH_USER,
      {
        seasonId: 'season-explicit-override',
        loadParticipationData: async (id: string) => {
          participationSeasonIdSeen = id;
          return [];
        },
      },
      // The hook itself never resolves `'ready'` here (stays `'none'`) --
      // the explicit prop must still win and render real tab content.
      async () => null,
    );
    await flushMicrotasks();

    expect(document.querySelector('button[data-tab-value]')).not.toBeNull();
    expect(container.textContent).not.toContain('No active season yet');
    expect(participationSeasonIdSeen).toBe('season-explicit-override');
  });
});
