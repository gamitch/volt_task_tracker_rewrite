// @vitest-environment jsdom
/**
 * T123: tests for `AppShell.tsx` -- specifically this task's own edit (the
 * new `<KpiStrip />` mount point) PLUS a regression proof that the
 * pre-existing chromeless-branch / `SeasonProvider`-mounting structure
 * (T115-verified) is left completely intact.
 *
 * No dedicated test file existed for `AppShell.tsx` before this task
 * (confirmed: no `AppShell.test.tsx` anywhere in `src/app/` prior to this
 * change) -- this file is new, not a rewrite of an existing suite. Same raw
 * `createRoot`/`act` + `MemoryRouter` + `AuthProvider`/`LoginAs` harness
 * `CoachHome.test.tsx`/`SeasonProvider.test.tsx` already establish.
 *
 * `AppShell.tsx` has no injectable seam of its own for `loadActiveSeason`/
 * `loadKpiStripData` (it always mounts the real `<SeasonProvider>` and the
 * real-default `<KpiStrip />`) -- in this jsdom test environment with no
 * `.env` configured, `getSupabaseClient()` throws `SupabaseNotConfiguredError`
 * (`../lib/supabase/client.ts`), which every loader in this codebase
 * normalizes into a rejected `SupabaseLoaderError` rather than a raw crash
 * (same disclosed, already-established test-environment behavior
 * `../test-utils/authHarness.tsx`'s own module doc describes for its outer
 * bare `<AuthProvider>`). This is used deliberately below: rendering the
 * normal (non-chromeless) branch as a logged-in coach and asserting the
 * resulting `useActiveSeason()` `'error'` Banner appears INSIDE the shell's
 * `role="main"` content region proves `<KpiStrip />` is genuinely mounted,
 * executing, and rendering real content in the shell's own main-content
 * region -- not merely present in source but silently inert. Note: the
 * installed `@astryxdesign/core@0.1.6` `AppShell` renders its main-content
 * region as a `<div role="main" id="astryx-app-shell-main">`
 * (`node_modules/@astryxdesign/core/src/AppShell/AppShell.tsx` ->
 * `LayoutContent`, verified directly against the shipped source), NOT a
 * literal HTML `<main>` element despite `astryx-api.md`'s own "AppShell"
 * Props table prose ("Main content area, rendered inside a <main>
 * element") -- this file queries `[role="main"]`, not `main`, for that
 * reason (a `container.querySelector('main')` would always return `null`
 * against the real installed component).
 */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthProvider, type AuthUser } from './guards';
import { LoginAs } from '../test-utils/authHarness';
import { routePaths } from './router';
import { AppShell, type AppShellProps } from './AppShell';
import type { SeasonRow } from '../lib/supabase/types';
import type { KpiStripData } from '../lib/supabase/loaders/kpi';

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

const PAGE_MARKER_TEXT = 'T123 AppShell test page marker';

/**
 * T140: fixtures for the new pass-through-props tests below. Distinctive
 * values (not present anywhere else in this file's fixtures, and never
 * produced by the real default loaders in this unconfigured jsdom test
 * environment -- module doc above) so an assertion on them is proof the
 * INJECTED loader is what rendered, not merely that something rendered.
 * Mirrors `KpiStrip.test.tsx`'s own `FIXTURE_SEASON`/`FIXTURE_KPI_DATA`
 * shape (reusing the mounting pattern that file establishes at `:91-105`,
 * not its assertions -- see the new tests below for why).
 */
const T140_FIXTURE_SEASON: SeasonRow = {
  id: 'season-t140-fixture',
  name: 'T140 Fixture Season',
  startsOn: '2026-01-01',
  endsOn: '2026-12-31',
  defaultGoalHours: 100,
  isActive: true,
  createdAt: '2026-01-01T00:00:00.000Z',
};

const T140_FIXTURE_KPI_DATA: KpiStripData = {
  seasonId: 'season-t140-fixture',
  totalHours: 42.5,
  meetingHours: 10,
  outreachHours: 12.5,
  competitionHours: 20,
  eventsLoggedCount: 7,
  mostRecentEventTitle: 'T140 Fixture Regatta',
  mostRecentEventDate: '2026-07-18',
  activeStudentsCount: 9,
  goalTargetHours: 400,
  goalPct: 11,
  teamBreakdown: [],
};

/**
 * T140: `appShellProps` is an added optional third parameter (default `{}`,
 * a safe no-op) so the pass-through-props tests below can reach the new
 * `seasonProviderProps`/`kpiStripProps` seams through this one shared
 * harness without touching any pre-existing `it(` body -- every pre-T140
 * call site below still calls `renderAt(path, user)` with exactly two
 * arguments, so `appShellProps` is `{}` there and
 * `<AppShell {...appShellProps}>` renders identically to the old literal
 * `<AppShell>`.
 */
function renderAt(
  path: string,
  user: AuthUser | null,
  appShellProps: Omit<AppShellProps, 'children'> = {},
): void {
  const page = <div data-testid="page-marker">{PAGE_MARKER_TEXT}</div>;
  act(() => {
    root.render(
      <MemoryRouter initialEntries={[path]}>
        <AuthProvider>
          {user === null ? (
            <AppShell {...appShellProps}>{page}</AppShell>
          ) : (
            <LoginAs user={user}>
              <AppShell {...appShellProps}>{page}</AppShell>
            </LoginAs>
          )}
        </AuthProvider>
      </MemoryRouter>,
    );
  });
}

describe('<AppShell /> (T006 chrome wrapper; T123 KpiStrip mount point)', () => {
  // -------------------------------------------------------------------
  // Regression: chromeless branch (T115-verified structure) unchanged.
  // -------------------------------------------------------------------
  it('renders /login chromeless -- children only, no TopNav/SideNav chrome, no KpiStrip content', () => {
    renderAt(routePaths.login, null);
    expect(container.textContent).toContain(PAGE_MARKER_TEXT);
    // No Astryx AppShell chrome landmark, no VOLT wordmark (TopNav), no
    // `role="main"` wrapper -- this branch returns `children` completely
    // unwrapped.
    expect(container.querySelector('[role="main"]')).toBeNull();
    expect(container.textContent).not.toContain('VOLT');
  });

  it('renders /accept-invite chromeless too', () => {
    renderAt(routePaths.acceptInvite, null);
    expect(container.textContent).toContain(PAGE_MARKER_TEXT);
    expect(container.querySelector('[role="main"]')).toBeNull();
  });

  // -------------------------------------------------------------------
  // Normal branch: TopNav/SideNav chrome present, SeasonProvider mounted,
  // <KpiStrip /> mounted inside the shell's `role="main"` content region,
  // BEFORE the page's own children.
  // -------------------------------------------------------------------
  it('renders normal routes wrapped in the Astryx chrome (TopNav/SideNav), with page content inside the shell\'s role="main" region', async () => {
    renderAt(routePaths.dashboard, COACH_USER);
    await flushMicrotasks();
    expect(container.textContent).toContain('VOLT'); // TopNav wordmark
    const main = container.querySelector('[role="main"]');
    expect(main).not.toBeNull();
    expect(main?.textContent).toContain(PAGE_MARKER_TEXT);
  });

  it('mounts <KpiStrip /> inside the shell\'s role="main" region, positioned BEFORE the page marker (real content, not silently inert)', async () => {
    renderAt(routePaths.dashboard, COACH_USER);
    await flushMicrotasks();
    const main = container.querySelector('[role="main"]');
    expect(main).not.toBeNull();
    // KpiStrip's own useActiveSeason() 'error' Banner (SupabaseNotConfiguredError
    // in this unconfigured test environment -- module doc above) proves the
    // component is genuinely mounted and rendering, not merely present in
    // source. It must appear BEFORE the page marker in DOM order, matching
    // `AppShell.tsx`'s own `<KpiStrip />{children}` JSX order.
    const html = main!.innerHTML;
    const kpiErrorIndex = html.indexOf("Couldn't load the active season");
    const markerIndex = html.indexOf(PAGE_MARKER_TEXT);
    expect(kpiErrorIndex).toBeGreaterThan(-1);
    expect(markerIndex).toBeGreaterThan(-1);
    expect(kpiErrorIndex).toBeLessThan(markerIndex);
  });

  it('never renders KpiStrip content for a non-staff (or not-yet-resolved) session on a normal route', async () => {
    renderAt(routePaths.dashboard, null);
    await flushMicrotasks();
    const main = container.querySelector('[role="main"]');
    expect(main).not.toBeNull();
    expect(main?.textContent).not.toContain("Couldn't load the active season");
    expect(main?.textContent).toContain(PAGE_MARKER_TEXT);
  });

  // -------------------------------------------------------------------
  // T134 (UXC-12): the chromeless check is now a PATTERN match
  // (`matchPath`/`CHROMELESS_PATTERNS`), not exact string equality, so the
  // two parameterised projection routes -- previously unmatchable no matter
  // what the URL was -- now correctly go chromeless too.
  // -------------------------------------------------------------------
  describe('T134 chromeless pattern matching (UXC-12)', () => {
    it('renders /kiosk/:sessionId chromeless -- no TopNav/SideNav, no role="main", no KpiStrip', async () => {
      renderAt(routePaths.kioskSession('session-abc-123'), COACH_USER);
      await flushMicrotasks();
      expect(container.textContent).toContain(PAGE_MARKER_TEXT);
      expect(container.querySelector('[role="main"]')).toBeNull();
      expect(container.textContent).not.toContain('VOLT');
      expect(container.textContent).not.toContain("Couldn't load the active season");
    });

    it('renders /meetings/live/:sessionId chromeless -- no TopNav/SideNav, no role="main", no KpiStrip', async () => {
      renderAt(routePaths.meetingLiveSession('session-xyz-789'), COACH_USER);
      await flushMicrotasks();
      expect(container.textContent).toContain(PAGE_MARKER_TEXT);
      expect(container.querySelector('[role="main"]')).toBeNull();
      expect(container.textContent).not.toContain('VOLT');
      expect(container.textContent).not.toContain("Couldn't load the active season");
    });

    it('/login and /accept-invite remain chromeless (regression, still matched as static patterns)', () => {
      renderAt(routePaths.login, null);
      expect(container.querySelector('[role="main"]')).toBeNull();
      renderAt(routePaths.acceptInvite, null);
      expect(container.querySelector('[role="main"]')).toBeNull();
    });

    // Traps #2/#3: `/meetings` is itself a routed, chrome-bearing page, and
    // is a PREFIX of `/meetings/live/:sessionId` -- a naive `startsWith`
    // would wrongly strip its chrome. `/settings` is a prefix of
    // `/settings/season` -- same trap. `/outreach/:eventId` is the other
    // parameterised route in the app and is exactly what a sloppy pattern
    // list (e.g. one that matches any single extra path segment) would catch
    // by accident -- it must keep its chrome. All ten of these must still
    // render full chrome.
    const ORDINARY_CHROME_BEARING_PATHS: ReadonlyArray<[string, string]> = [
      ['/ (dashboard)', routePaths.dashboard],
      ['/meetings', routePaths.meetings],
      ['/outreach/:eventId', routePaths.outreachEvent('event-42')],
      ['/outreach', routePaths.outreach],
      ['/calendar', routePaths.calendar],
      ['/checkin', routePaths.checkin],
      ['/roster', routePaths.roster],
      ['/reports', routePaths.reports],
      ['/settings', routePaths.settings],
      ['/settings/season', routePaths.settingsSeason],
    ];

    it.each(ORDINARY_CHROME_BEARING_PATHS)(
      'still renders full chrome (TopNav + role="main") on %s',
      async (_label, path) => {
        renderAt(path, COACH_USER);
        await flushMicrotasks();
        expect(container.textContent).toContain('VOLT');
        const main = container.querySelector('[role="main"]');
        expect(main).not.toBeNull();
        expect(main?.textContent).toContain(PAGE_MARKER_TEXT);
      },
    );

    it('matchPath is case-insensitive by default (documented, not a bug): /KIOSK/abc still matches /kiosk/:sessionId', async () => {
      renderAt('/KIOSK/session-abc-123', COACH_USER);
      await flushMicrotasks();
      expect(container.querySelector('[role="main"]')).toBeNull();
    });
  });

  // -------------------------------------------------------------------
  // T140: `seasonProviderProps`/`kpiStripProps` pass-through seams.
  // -------------------------------------------------------------------
  describe('T140 pass-through props (seasonProviderProps / kpiStripProps)', () => {
    it('seasonProviderProps.loadActiveSeason reaches SeasonProvider on its own -- the "none" banner (which the real default loader, an error, never produces) proves the injected loader is what ran', async () => {
      renderAt(routePaths.dashboard, COACH_USER, {
        seasonProviderProps: { loadActiveSeason: async () => null },
      });
      await flushMicrotasks();
      const main = container.querySelector('[role="main"]');
      expect(main).not.toBeNull();
      // The real default loader in this unconfigured jsdom environment always
      // rejects (module doc above) -- it can never itself produce the "none"
      // banner. Only the injected loader resolving `null` can.
      expect(main?.textContent).toContain('No active season yet');
      expect(main?.textContent).not.toContain("Couldn't load the active season");
    });

    it('kpiStripProps.loadKpiStripData reaches KpiStrip -- requires ALSO injecting a seasonProviderProps.loadActiveSeason that resolves a fixture season, since KpiStripContent (which actually receives loadKpiStripData) only mounts once activeSeason.status === "ready" (KpiStrip.tsx case \'ready\':), and the real default loadActiveSeason always rejects in this jsdom environment', async () => {
      renderAt(routePaths.dashboard, COACH_USER, {
        seasonProviderProps: { loadActiveSeason: async () => T140_FIXTURE_SEASON },
        kpiStripProps: { loadKpiStripData: async () => T140_FIXTURE_KPI_DATA },
      });
      await flushMicrotasks();
      const main = container.querySelector('[role="main"]');
      expect(main).not.toBeNull();
      // Distinctive fixture value -- only the injected loader could have
      // produced it (not the real default, which always rejects here; not
      // any other fixture in this file or in KpiStrip.test.tsx).
      expect(main?.textContent).toContain('T140 Fixture Regatta');
      expect(main?.textContent).not.toContain("Couldn't load the active season");
      expect(main?.textContent).not.toContain('No active season yet');
    });

    it('the chromeless branch stays unwrapped even when both pass-through props are supplied -- no SeasonProvider is mounted there, so the injected fixtures never render', () => {
      renderAt(routePaths.login, null, {
        seasonProviderProps: { loadActiveSeason: async () => T140_FIXTURE_SEASON },
        kpiStripProps: { loadKpiStripData: async () => T140_FIXTURE_KPI_DATA },
      });
      // Same assertions as the pre-existing (unmodified) chromeless test
      // above, plus proof the new props don't leak through: if
      // SeasonProvider were mounted here, `useActiveSeason()` would start
      // resolving -- but there is no `[role="main"]` region at all (still a
      // bare `<>{children}</>`), and neither fixture's content appears.
      expect(container.textContent).toContain(PAGE_MARKER_TEXT);
      expect(container.querySelector('[role="main"]')).toBeNull();
      expect(container.textContent).not.toContain('VOLT');
      expect(container.textContent).not.toContain('T140 Fixture Regatta');
      expect(container.textContent).not.toContain('No active season yet');
    });

    it("<AppShell>{children}</AppShell> with no other props (App.tsx's own call shape) still renders the real default loaders -- the pre-existing season-level error banner, not any fixture content", async () => {
      renderAt(routePaths.dashboard, COACH_USER);
      await flushMicrotasks();
      const main = container.querySelector('[role="main"]');
      expect(main).not.toBeNull();
      expect(main?.textContent).toContain("Couldn't load the active season");
      expect(main?.textContent).not.toContain('T140 Fixture Regatta');
      expect(main?.textContent).not.toContain('No active season yet');
    });
  });
});
