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
 * originating file for that reasoning; not re-derived in this file). Only
 * `/` (the dashboard) is still a placeholder -- it needs a small new
 * role-dispatch component, which is T075's job, not T074's.
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
 *   - `/meetings/live/:sessionId`, `/roster`, `/reports`: protected by
 *     `RequireAuth` only at this router level -- `LiveConsolePage`,
 *     `RosterShell`, and `ReportsShell` each already nest `guards.tsx`'s
 *     `RequireRole(['coach', 'admin'])` internally (per their own module
 *     docs), so no external `RequireRole` is added here (would double-gate).
 *   - Everything else: requires authentication (`RequireAuth`) only.
 *   - `/settings`: `RequireAuth` only (T074 bug fix -- PRD Section 7 lists
 *     this route's role as `all`, and the real `SettingsPage` has no
 *     internal role-gating; the previous `RequireRole(['admin'])` wrap here
 *     was incorrect and has been removed).
 */
import type { ReactNode } from 'react';
import { Route, Routes } from 'react-router-dom';
import { RequireAuth, RequireRole } from './guards';
import { LoginPage } from '../pages/login';
import { AcceptInvitePage } from '../pages/accept-invite';
import { MeetingsList } from '../pages/meetings/MeetingsList';
import LiveConsolePage from '../pages/meetings/LiveConsole';
import { KioskPage } from '../pages/meetings/Kiosk';
import { CheckinResult } from '../pages/checkin/CheckinResult';
import { OutreachList } from '../pages/outreach/OutreachList';
import { OutreachDetail } from '../pages/outreach/OutreachDetail';
import { CalendarPage } from '../pages/calendar/CalendarPage';
import { RosterShell } from '../pages/roster/RosterShell';
import { ReportsShell } from '../pages/reports/ReportsShell';
import { SettingsPage } from '../pages/settings/SettingsPage';

// ---------------------------------------------------------------------------
// Placeholder page components (routes not yet wired to a real component)
// ---------------------------------------------------------------------------

function DashboardPage(): ReactNode {
  return <div>Dashboard (placeholder)</div>;
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
    </Routes>
  );
}
