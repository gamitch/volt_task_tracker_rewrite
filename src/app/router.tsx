/**
 * T005: self-contained route table stub covering every route in PRD
 * Section 7, wired up to the NAV-06 guards and NAV-08 intended-URL
 * mechanism from `./guards`.
 *
 * This module deliberately exports the `<Routes>` tree only (`AppRoutes`),
 * not a `<BrowserRouter>`. Wiring `AppRoutes` (and `AuthProvider` from
 * `./guards`) into `main.tsx` / `App.tsx` is T006's job (AppShell + TopNav).
 *
 * T074 wired 11 of the 12 remaining routes below to their real,
 * already-Passed page components (every route's own module doc documents
 * why it needs the guard nesting it gets here -- see each import's
 * originating file for that reasoning; not re-derived in this file). T075
 * wired the last one, `/` (the dashboard), to `DashboardPage`
 * (`../pages/home/DashboardPage`) -- a small role-dispatch component that
 * renders `CoachHome` for `coach`/`admin`, `StudentHome` for `student`, and
 * `ParentHome` for `parent` (see that file's own module doc for the full
 * reasoning). `/` keeps its pre-existing `RequireAuth`-only wrap (no
 * `RequireRole`) -- every real role gets a valid dashboard, so there is no
 * "wrong role" case to exclude here.
 *
 * T093 (this task, URGENT CI-failure fix): every page import below was
 * converted from a static (eager) import to `React.lazy(() => import(...))`.
 * `router.tsx` previously statically imported all 13 page components into
 * one eager entry chunk; cumulative feature growth (the ED-1 data-wiring
 * epic wiring real Supabase usage into most pages) pushed that chunk over
 * the NFR-04 300 KB gzip budget by ~3.8 KB (live CI failure, PR #1 commit
 * `b98c84e`). This is the exact `React.lazy` + `Suspense` pattern T085
 * already used (and had checker-accessibility-verified) for one component,
 * `AdminToggles.tsx` in `RosterShell.tsx` -- see that file's module doc #6
 * for the precedent this follows.
 *
 * Export-shape check (not guessed -- every page file was read directly):
 * every page component below has BOTH a named export and a `export default`
 * (the `/login`/`/accept-invite` barrel `index.ts` files each re-export
 * `default` from their real page file too), so a plain
 * `lazy(() => import('...'))` resolves correctly for all of them -- EXCEPT
 * `SettingsPage.tsx`, which has no `export default` at all (named export
 * only), so its `lazy()` call uses the
 * `.then((m) => ({ default: m.SettingsPage }))` adapter to satisfy
 * `React.lazy`'s "module must have a `default` export" contract.
 *
 * `Suspense` boundary: ONE boundary wraps the entire `<Routes>` tree below
 * (not one per `<Route>`). Reasoning: `<Routes>` only ever renders a single
 * matched route's element at a time, so a single shared boundary already
 * covers every possible route transition with no loss of granularity versus
 * per-route boundaries -- it just avoids repeating the same
 * `<Suspense fallback={...}>` wrapper 13 times for identical behavior.
 * `RequireAuth`/`RequireRole` wrapping is unchanged from before this task
 * (still nested exactly as it was per-route, still wraps the guard logic
 * around what component renders) -- the lazy `<Suspense>` boundary sits
 * OUTSIDE `<Routes>` itself, so guard evaluation (which does not depend on
 * the lazy chunk having loaded) is unaffected by the loading state below.
 *
 * Fallback content: unlike T085's `AdminToggles` precedent (`fallback={null}`
 * -- defensible there only because that was a small below-fold widget where
 * nothing was ever in that slot before, so a brief empty window is
 * invisible), a top-level ROUTE transition is user-visible navigation -- a
 * `null` fallback here would read as a jarring blank-screen flash, and a
 * screen-reader user gets no signal at all that navigation is in progress.
 * `RouteLoadingFallback` below renders a real Astryx `Spinner` with a visible
 * `label` (`Spinner` is the project's established DES-12 loading primitive
 * per every other screen in `src/pages/**`, see `docs/swarm/astryx-api.md`
 * "Spinner" section). `Spinner`'s own implementation
 * (`node_modules/@astryxdesign/core/src/Spinner/Spinner.tsx`) already
 * renders `role="status"` plus a resolved `aria-label` (falling back to
 * "Loading" if unset) on its root element whenever a `label` is given, so no
 * extra `aria-busy`/`VisuallyHidden` wrapper is needed here -- the
 * accessible loading signal is built into the primitive itself.
 *
 * Route protection matrix (NAV-06):
 *   - `/login`, `/accept-invite`: public (these ARE the auth entry points).
 *   - `/kiosk/:sessionId`: protected, restricted to `coach`/`admin`. PRD
 *     Section 7's route table explicitly assigns this route the role
 *     `coach/admin` (row: `| /kiosk/:sessionId | coach/admin | fullscreen |
 *     QR, tally | MTG-07 |`), and SEC-04 ("All students are minors: no
 *     public pages...") rules out leaving it unauthenticated. `KioskPage`
 *     does not self-gate (per its own module doc), so this route keeps the
 *     external `RequireAuth` + `RequireRole(['coach', 'admin'])` wrap.
 *   - `/meetings/live/:sessionId`, `/roster`, `/reports`, `/settings/season`:
 *     protected by `RequireAuth` only at this router level -- `LiveConsolePage`,
 *     `RosterShell`, `ReportsShell`, and (T108) `SeasonSettings` each already
 *     nest `guards.tsx`'s `RequireRole` internally (per their own module
 *     docs; `SeasonSettings`'s own module doc #6 wraps `RequireRole(['admin'])`
 *     around every one of its return branches), so no external `RequireRole`
 *     is added here (would double-gate).
 *   - Everything else: requires authentication (`RequireAuth`) only.
 *   - `/settings`: `RequireAuth` only (T074 bug fix -- PRD Section 7 lists
 *     this route's role as `all`, and the real `SettingsPage` has no
 *     internal role-gating; the previous `RequireRole(['admin'])` wrap here
 *     was incorrect and has been removed).
 *
 * T108 (this task, HIGH PRIORITY bootstrap fix): added the missing
 * `/settings/season` route -- `SeasonSettings.tsx` (T029 UI, T091 real data
 * wiring) was fully built and already-Passed but never wired into this
 * table, so the "No active season yet" empty states on Reports/Outreach/
 * Meetings (and `AdminToggles.tsx`'s own `/settings/season` link, T028) all
 * pointed at a dead route. `SeasonSettings.tsx` has both a named export
 * (`SeasonSettings`) and a `export default SeasonSettings`, so its `lazy()`
 * call below needs no `SettingsPage`-style adapter. Role gating: see the
 * route protection matrix bullet above -- `SeasonSettings` self-gates via an
 * internal `RequireRole(['admin'])` (its own module doc #6 explains why it
 * follows `RosterShell.tsx`'s whole-page precedent rather than
 * `AdminToggles.tsx`'s embedded-widget one), so this route matches the
 * established "don't double-gate a self-gating page" convention already set
 * by `/meetings/live/:sessionId`, `/roster`, and `/reports` above, NOT the
 * `/settings` bug-fix precedent (that one applies only because the real
 * `SettingsPage` has no internal role-gating at all).
 */
import { lazy, Suspense, type ReactNode } from 'react';
import { Route, Routes } from 'react-router-dom';
import { Spinner, VStack } from '@astryxdesign/core';
import { RequireAuth, RequireRole } from './guards';

// ---------------------------------------------------------------------------
// Lazy page imports (T093) -- see module doc above for the export-shape
// check and the `SettingsPage` adapter's reasoning.
// ---------------------------------------------------------------------------

const LoginPage = lazy(() => import('../pages/login'));
const AcceptInvitePage = lazy(() => import('../pages/accept-invite'));
const DashboardPage = lazy(() => import('../pages/home/DashboardPage'));
const MeetingsList = lazy(() => import('../pages/meetings/MeetingsList'));
const LiveConsolePage = lazy(() => import('../pages/meetings/LiveConsole'));
const KioskPage = lazy(() => import('../pages/meetings/Kiosk'));
const CheckinResult = lazy(() => import('../pages/checkin/CheckinResult'));
const OutreachList = lazy(() => import('../pages/outreach/OutreachList'));
const OutreachDetail = lazy(() => import('../pages/outreach/OutreachDetail'));
const CalendarPage = lazy(() => import('../pages/calendar/CalendarPage'));
const RosterShell = lazy(() => import('../pages/roster/RosterShell'));
const ReportsShell = lazy(() => import('../pages/reports/ReportsShell'));
const SeasonSettings = lazy(() => import('../pages/settings/SeasonSettings'));
// `SettingsPage.tsx` has no `export default` (named export only) -- adapt it
// to the shape `React.lazy` requires instead of guessing it matches the
// other 12 pages' default-export shape.
const SettingsPage = lazy(() =>
  import('../pages/settings/SettingsPage').then((module) => ({
    default: module.SettingsPage,
  })),
);

/**
 * T093: the single `Suspense` fallback covering every route transition (see
 * module doc above for why this differs from T085's `fallback={null}`
 * precedent). A real `Spinner` with a visible label -- `Spinner` already
 * carries `role="status"` + a resolved `aria-label` internally, so this is a
 * fully accessible loading signal on its own, no extra wrapper needed.
 */
function RouteLoadingFallback(): ReactNode {
  return (
    <VStack gap={4} hAlign="center" padding={10}>
      <Spinner label="Loading page…" />
    </VStack>
  );
}

// ---------------------------------------------------------------------------
// Route path constants (for reuse by future nav/link code, e.g. T006)
// ---------------------------------------------------------------------------

export const routePaths = {
  login: '/login',
  acceptInvite: '/accept-invite',
  dashboard: '/',
  meetings: '/meetings',
  meetingLiveSession: (sessionId: string) => `/meetings/live/${sessionId}`,
  kioskSession: (sessionId: string) => `/kiosk/${sessionId}`,
  checkin: '/checkin',
  outreach: '/outreach',
  outreachEvent: (eventId: string) => `/outreach/${eventId}`,
  calendar: '/calendar',
  roster: '/roster',
  reports: '/reports',
  settings: '/settings',
  settingsSeason: '/settings/season',
} as const;

// ---------------------------------------------------------------------------
// Route table
// ---------------------------------------------------------------------------

/**
 * The full PRD Section 7 route table. Not wrapped in a `<BrowserRouter>` --
 * the caller (T006) is responsible for rendering this inside a router and
 * inside `<AuthProvider>` from `./guards`.
 */
export function AppRoutes(): ReactNode {
  return (
    <Suspense fallback={<RouteLoadingFallback />}>
      <Routes>
        {/* Public routes -- these are the auth entry points themselves. */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/accept-invite" element={<AcceptInvitePage />} />

        {/* Protected + role-guarded: coach/admin only (PRD Section 7 + SEC-04). */}
        <Route
          path="/kiosk/:sessionId"
          element={
            <RequireAuth>
              <RequireRole allowedRoles={['coach', 'admin']}>
                <KioskPage />
              </RequireRole>
            </RequireAuth>
          }
        />

        {/* Protected routes -- require authentication. */}
        <Route
          path="/"
          element={
            <RequireAuth>
              <DashboardPage />
            </RequireAuth>
          }
        />
        <Route
          path="/meetings"
          element={
            <RequireAuth>
              <MeetingsList />
            </RequireAuth>
          }
        />
        <Route
          path="/meetings/live/:sessionId"
          element={
            <RequireAuth>
              <LiveConsolePage />
            </RequireAuth>
          }
        />
        <Route
          path="/checkin"
          element={
            <RequireAuth>
              <CheckinResult />
            </RequireAuth>
          }
        />
        <Route
          path="/outreach"
          element={
            <RequireAuth>
              <OutreachList />
            </RequireAuth>
          }
        />
        <Route
          path="/outreach/:eventId"
          element={
            <RequireAuth>
              <OutreachDetail />
            </RequireAuth>
          }
        />
        <Route
          path="/calendar"
          element={
            <RequireAuth>
              <CalendarPage />
            </RequireAuth>
          }
        />
        <Route
          path="/roster"
          element={
            <RequireAuth>
              <RosterShell />
            </RequireAuth>
          }
        />
        <Route
          path="/reports"
          element={
            <RequireAuth>
              <ReportsShell />
            </RequireAuth>
          }
        />

        {/* Protected -- T074: `RequireRole(['admin'])` removed, see module doc. */}
        <Route
          path="/settings"
          element={
            <RequireAuth>
              <SettingsPage />
            </RequireAuth>
          }
        />

        {/* Protected -- T108: `RequireAuth` only at this router level, no
            external `RequireRole`. `SeasonSettings` (SET-04, admin-only)
            already nests `guards.tsx`'s `RequireRole(['admin'])` internally
            around every one of its own return branches (own module doc
            #6), the same "self-gating page component" posture
            `/meetings/live/:sessionId`, `/roster`, and `/reports` already
            established above for `LiveConsolePage`/`RosterShell`/
            `ReportsShell` -- adding a second, external `RequireRole` here
            would double-gate for no benefit. */}
        <Route
          path="/settings/season"
          element={
            <RequireAuth>
              <SeasonSettings />
            </RequireAuth>
          }
        />
      </Routes>
    </Suspense>
  );
}
