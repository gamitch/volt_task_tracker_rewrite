// @vitest-environment jsdom
/**
 * T123: tests for `KpiStrip.tsx` (PRD v2 UXD-01/UXP-05).
 *
 * No `@testing-library/react` installed in this repo (confirmed via
 * `package.json`) -- same raw `createRoot`/`act` pattern
 * `SeasonProvider.test.tsx`/`CoachHome.test.tsx` already establish,
 * including `SeasonProvider`'s own injectable `loadActiveSeason` prop and
 * `../../test-utils/authHarness`'s `LoginAs` role-login harness.
 *
 * Covers: staff-only gating (module doc #1), all four `useActiveSeason()`
 * states scaled for this strip (module doc #3), the inner KPI-fetch load
 * state (loading/error+retry/success), the "no arithmetic, only
 * presentation formatting" display functions, and the "one fetch per
 * seasonId, not per render" contract (module doc #4).
 */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthProvider, type AuthUser } from '../../app/guards';
import { LoginAs } from '../../test-utils/authHarness';
import { SeasonProvider, type LoadActiveSeasonFn } from '../../app/SeasonProvider';
import type { SeasonRow } from '../../lib/supabase/types';
import type { KpiStripData, LoadKpiStripDataFn } from '../../lib/supabase/loaders/kpi';
import { KpiStrip } from './KpiStrip';

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
  vi.restoreAllMocks();
});

async function flushMicrotasks(): Promise<void> {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });
}

const COACH_USER: AuthUser = { id: 'user-coach', email: 'coach@example.com', role: 'coach' };
const ADMIN_USER: AuthUser = { id: 'user-admin', email: 'admin@example.com', role: 'admin' };
const STUDENT_USER: AuthUser = {
  id: 'user-student',
  email: 'student@example.com',
  role: 'student',
};
const PARENT_USER: AuthUser = { id: 'user-parent', email: 'parent@example.com', role: 'parent' };

const FIXTURE_SEASON: SeasonRow = {
  id: 'season-active-1',
  name: 'Fixture Active Season',
  startsOn: '2026-01-01',
  endsOn: '2026-12-31',
  defaultGoalHours: 100,
  isActive: true,
  createdAt: '2026-01-01T00:00:00.000Z',
};

const FIXTURE_KPI_DATA: KpiStripData = {
  seasonId: 'season-active-1',
  totalHours: 20.5,
  meetingHours: 0,
  outreachHours: 10.5,
  competitionHours: 10,
  eventsLoggedCount: 3,
  mostRecentEventTitle: 'Fixture Off-Season Competition',
  mostRecentEventDate: '2026-07-18',
  activeStudentsCount: 4,
  goalTargetHours: 350,
  goalPct: 6,
  teamBreakdown: [
    { teamId: 'team-a', teamName: 'Fixture Team A', activeStudentsCount: 2 },
    { teamId: 'team-b', teamName: 'Fixture Team B', activeStudentsCount: 2 },
  ],
};

function renderStrip({
  user,
  loadActiveSeason,
  loadKpiStripData,
}: {
  user: AuthUser | null;
  loadActiveSeason: LoadActiveSeasonFn;
  loadKpiStripData: LoadKpiStripDataFn;
}): void {
  const strip = <KpiStrip loadKpiStripData={loadKpiStripData} />;
  act(() => {
    root.render(
      <SeasonProvider loadActiveSeason={loadActiveSeason}>
        <AuthProvider>
          {user === null ? strip : <LoginAs user={user}>{strip}</LoginAs>}
        </AuthProvider>
      </SeasonProvider>,
    );
  });
}

function textContent(): string {
  return container.textContent ?? '';
}

const NEVER_RESOLVING_KPI: LoadKpiStripDataFn = () => new Promise(() => {});

describe('<KpiStrip /> (T123 UXD-01/UXP-05)', () => {
  // -------------------------------------------------------------------
  // Module doc #1: staff-only gating.
  // -------------------------------------------------------------------
  it('renders nothing for a student session, even once the season and KPI data are ready', async () => {
    renderStrip({
      user: STUDENT_USER,
      loadActiveSeason: async () => FIXTURE_SEASON,
      loadKpiStripData: async () => FIXTURE_KPI_DATA,
    });
    await flushMicrotasks();
    expect(container.innerHTML).toBe('');
  });

  it('renders nothing for a parent session', async () => {
    renderStrip({
      user: PARENT_USER,
      loadActiveSeason: async () => FIXTURE_SEASON,
      loadKpiStripData: async () => FIXTURE_KPI_DATA,
    });
    await flushMicrotasks();
    expect(container.innerHTML).toBe('');
  });

  it('renders nothing while no session has resolved yet (user === null)', () => {
    renderStrip({
      user: null,
      loadActiveSeason: async () => FIXTURE_SEASON,
      loadKpiStripData: async () => FIXTURE_KPI_DATA,
    });
    expect(container.innerHTML).toBe('');
  });

  it('renders for a coach session', async () => {
    renderStrip({
      user: COACH_USER,
      loadActiveSeason: async () => FIXTURE_SEASON,
      loadKpiStripData: async () => FIXTURE_KPI_DATA,
    });
    await flushMicrotasks();
    expect(textContent()).toContain('Season hours');
  });

  it('renders for an admin session', async () => {
    renderStrip({
      user: ADMIN_USER,
      loadActiveSeason: async () => FIXTURE_SEASON,
      loadKpiStripData: async () => FIXTURE_KPI_DATA,
    });
    await flushMicrotasks();
    expect(textContent()).toContain('Season hours');
  });

  // -------------------------------------------------------------------
  // Module doc #3: useActiveSeason() states, scaled for this strip.
  // -------------------------------------------------------------------
  it('shows a skeleton (never a blank band) while the active season is loading, with an accessible status announcement', async () => {
    renderStrip({
      user: COACH_USER,
      loadActiveSeason: () => new Promise(() => {}),
      loadKpiStripData: NEVER_RESOLVING_KPI,
    });
    // `LoginAs`'s own scoped `AuthProvider` resolves the fake coach session
    // asynchronously (one microtask) -- flushing here only lets THAT resolve;
    // the never-resolving `loadActiveSeason` above still leaves
    // `useActiveSeason()` in `'loading'` afterward.
    await flushMicrotasks();
    const busyRegion = container.querySelector('[aria-busy="true"]');
    expect(busyRegion).not.toBeNull();
    expect(container.querySelector('[role="status"]')?.textContent).toBe('Loading season KPIs…');
    expect(container.innerHTML).not.toBe('');
  });

  it("shows a compact info message for the real 'no active season yet' state, never fabricating a season", async () => {
    renderStrip({
      user: COACH_USER,
      loadActiveSeason: async () => null,
      loadKpiStripData: NEVER_RESOLVING_KPI,
    });
    await flushMicrotasks();
    expect(textContent()).toContain('No active season yet');
  });

  it("shows an error banner with a Retry button that calls the season provider's own refresh() on a season-load failure", async () => {
    let callCount = 0;
    const loadActiveSeason: LoadActiveSeasonFn = async () => {
      callCount += 1;
      if (callCount === 1) {
        throw { code: '500', message: 'Season load failed.', cause: null };
      }
      return FIXTURE_SEASON;
    };
    renderStrip({
      user: COACH_USER,
      loadActiveSeason,
      loadKpiStripData: async () => FIXTURE_KPI_DATA,
    });
    await flushMicrotasks();
    expect(textContent()).toContain("Couldn't load the active season");
    expect(textContent()).toContain('Season load failed.');

    const retryButton = Array.from(container.querySelectorAll('button')).find(
      (button) => button.textContent === 'Retry',
    );
    expect(retryButton).toBeDefined();
    act(() => {
      retryButton!.click();
    });
    await flushMicrotasks();
    expect(callCount).toBe(2);
    expect(textContent()).toContain('Season hours');
  });

  // -------------------------------------------------------------------
  // Inner KPI-fetch load state (independent of the season-level one).
  // -------------------------------------------------------------------
  it('shows the skeleton while the KPI data itself is still loading for an already-ready season', async () => {
    renderStrip({
      user: COACH_USER,
      loadActiveSeason: async () => FIXTURE_SEASON,
      loadKpiStripData: NEVER_RESOLVING_KPI,
    });
    await flushMicrotasks();
    expect(container.querySelector('[aria-busy="true"]')).not.toBeNull();
  });

  it('shows an error banner with its OWN Retry (distinct from the season-level one) when the KPI query itself fails, and recovers on retry', async () => {
    let callCount = 0;
    const loadKpiStripData: LoadKpiStripDataFn = async () => {
      callCount += 1;
      if (callCount === 1) {
        throw { code: '42501', message: 'Permission denied.', cause: null };
      }
      return FIXTURE_KPI_DATA;
    };
    renderStrip({
      user: COACH_USER,
      loadActiveSeason: async () => FIXTURE_SEASON,
      loadKpiStripData,
    });
    await flushMicrotasks();
    expect(textContent()).toContain("Couldn't load season KPIs");
    expect(textContent()).toContain('Permission denied.');

    const retryButton = Array.from(container.querySelectorAll('button')).find(
      (button) => button.textContent === 'Retry',
    );
    act(() => {
      retryButton!.click();
    });
    await flushMicrotasks();
    expect(callCount).toBe(2);
    expect(textContent()).toContain('Season hours');
  });

  it('normalizes a non-SupabaseLoaderError KPI-fetch rejection into a displayable error state', async () => {
    renderStrip({
      user: COACH_USER,
      loadActiveSeason: async () => FIXTURE_SEASON,
      loadKpiStripData: async () => {
        throw new Error('boom');
      },
    });
    await flushMicrotasks();
    expect(textContent()).toContain('boom');
  });

  // -------------------------------------------------------------------
  // Populated content -- the four cards' display formatting (presentation
  // only, no arithmetic -- constitution item 3).
  // -------------------------------------------------------------------
  it('renders all four KPI cards with the SQL-final numbers, formatted for display only', async () => {
    renderStrip({
      user: COACH_USER,
      loadActiveSeason: async () => FIXTURE_SEASON,
      loadKpiStripData: async () => FIXTURE_KPI_DATA,
    });
    await flushMicrotasks();
    const text = textContent();

    // Card 1: season hours + category breakdown.
    expect(text).toContain('Season hours');
    expect(text).toContain('20.5');
    expect(text).toContain('Meetings 0.0h · Outreach 10.5h · Competitions 10.0h');

    // Card 2: active students + per-team split (D-3 double-count values
    // passed straight through, never re-summed here).
    expect(text).toContain('Active students');
    expect(text).toContain('4');
    expect(text).toContain('Fixture Team A 2 · Fixture Team B 2');

    // Card 3: events logged + most recent title, NFR-09 short date.
    expect(text).toContain('Events logged');
    expect(text).toContain('3');
    expect(text).toContain('Jul 18 · Fixture Off-Season Competition');

    // Card 4: % toward season goal + confirmed/target line.
    expect(text).toContain('% toward season goal');
    expect(text).toContain('6%');
    expect(text).toContain('20.5 / 350h target');
  });

  it('renders the honest empty sub-lines when zero events/teams exist yet, never a fabricated placeholder', async () => {
    const emptyData: KpiStripData = {
      ...FIXTURE_KPI_DATA,
      eventsLoggedCount: 0,
      mostRecentEventTitle: null,
      mostRecentEventDate: null,
      teamBreakdown: [],
    };
    renderStrip({
      user: COACH_USER,
      loadActiveSeason: async () => FIXTURE_SEASON,
      loadKpiStripData: async () => emptyData,
    });
    await flushMicrotasks();
    const text = textContent();
    expect(text).toContain('No events logged yet');
    expect(text).toContain('No teams yet');
  });

  // -------------------------------------------------------------------
  // Module doc #4: one fetch per seasonId, not a refetch storm.
  // -------------------------------------------------------------------
  it('fetches KPI data exactly once for a given ready season id (no duplicate fetch on the same render)', async () => {
    const loadKpiStripData = vi.fn(async () => FIXTURE_KPI_DATA);
    renderStrip({
      user: COACH_USER,
      loadActiveSeason: async () => FIXTURE_SEASON,
      loadKpiStripData,
    });
    await flushMicrotasks();
    await flushMicrotasks();
    expect(loadKpiStripData).toHaveBeenCalledTimes(1);
    expect(loadKpiStripData).toHaveBeenCalledWith('season-active-1');
  });
});
