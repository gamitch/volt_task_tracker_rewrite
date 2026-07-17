/**
 * T005: self-contained route table stub covering every route in PRD
 * Section 7, wired up to the NAV-06 guards and NAV-08 intended-URL
 * mechanism from `./guards`.
 *
 * This module deliberately exports the `<Routes>` tree only (`AppRoutes`),
 * not a `<BrowserRouter>`. Wiring `AppRoutes` (and `AuthProvider` from
 * `./guards`) into `main.tsx` / `App.tsx` is T006's job (AppShell + TopNav).
 * Every page component below is a placeholder -- real page implementations
 * land in their own future tasks.
 *
 * Route protection matrix (NAV-06):
 *   - `/login`, `/accept-invite`: public (these ARE the auth entry points).
 *   - `/kiosk/:sessionId`: public/unauthenticated by design -- kiosk mode is
 *     a walk-up, session-scoped check-in surface where the `:sessionId`
 *     itself is the access token, not a logged-in user. This is an
 *     ASSUMPTION (the PRD excerpt available to this task packet does not
 *     spell out kiosk auth requirements); flagged for confirmation.
 *   - Everything else: requires authentication (`RequireAuth`).
 *   - `/settings` additionally requires the `admin` role (`RequireRole`) as
 *     an illustrative placeholder of the NAV-06 role-guard mechanism -- the
 *     full role-per-route matrix was not in the excerpts available to this
 *     task and should be reconciled against the full PRD RBAC section
 *     before this is treated as final.
 */
import type { ReactNode } from 'react';
import { Route, Routes, useNavigate, useParams } from 'react-router-dom';
import { RequireAuth, RequireRole, consumeIntendedUrl, useAuth, type Role } from './guards';

// ---------------------------------------------------------------------------
// Placeholder page components (one per PRD Section 7 route)
// ---------------------------------------------------------------------------

function LoginPage(): ReactNode {
  const { login, loginWithGoogle } = useAuth();
  const navigate = useNavigate();

  const signInAs = (role: Role) => {
    login({ id: `placeholder-${role}`, email: `placeholder.${role}@example.com`, role });
    navigate(consumeIntendedUrl('/'), { replace: true });
  };

  const continueWithGoogle = () => {
    // NAV-08 Google OAuth round-trip placeholder -- see the TODO on
    // `AuthContextValue.loginWithGoogle` in ./guards.tsx.
    void loginWithGoogle().then(() => {
      navigate(consumeIntendedUrl('/'), { replace: true });
    });
  };

  return (
    <div>
      <h1>Login (placeholder)</h1>
      <p>
        NAV-08: after a successful sign-in you are returned to the page you originally requested, if
        any.
      </p>
      <button type="button" onClick={() => signInAs('staff')}>
        Sign in as staff (placeholder)
      </button>
      <button type="button" onClick={() => signInAs('admin')}>
        Sign in as admin (placeholder)
      </button>
      <button type="button" onClick={continueWithGoogle}>
        Continue with Google (placeholder round trip)
      </button>
    </div>
  );
}

function AcceptInvitePage(): ReactNode {
  return <div>Accept Invite (placeholder)</div>;
}

function DashboardPage(): ReactNode {
  return <div>Dashboard (placeholder)</div>;
}

function MeetingsPage(): ReactNode {
  return <div>Meetings (placeholder)</div>;
}

function MeetingLiveSessionPage(): ReactNode {
  const { sessionId } = useParams<{ sessionId: string }>();
  return <div>Live Meeting Session (placeholder) - sessionId: {sessionId}</div>;
}

function KioskSessionPage(): ReactNode {
  const { sessionId } = useParams<{ sessionId: string }>();
  return <div>Kiosk (placeholder) - sessionId: {sessionId}</div>;
}

function CheckInPage(): ReactNode {
  return <div>Check-in (placeholder)</div>;
}

function OutreachPage(): ReactNode {
  return <div>Outreach (placeholder)</div>;
}

function OutreachEventPage(): ReactNode {
  const { eventId } = useParams<{ eventId: string }>();
  return <div>Outreach Event (placeholder) - eventId: {eventId}</div>;
}

function CalendarPage(): ReactNode {
  return <div>Calendar (placeholder)</div>;
}

function RosterPage(): ReactNode {
  return <div>Roster (placeholder)</div>;
}

function ReportsPage(): ReactNode {
  return <div>Reports (placeholder)</div>;
}

function SettingsPage(): ReactNode {
  return <div>Settings (placeholder)</div>;
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

      {/* Public by design -- see route protection matrix in the module doc. */}
      <Route path="/kiosk/:sessionId" element={<KioskSessionPage />} />

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
            <MeetingsPage />
          </RequireAuth>
        }
      />
      <Route
        path="/meetings/live/:sessionId"
        element={
          <RequireAuth>
            <MeetingLiveSessionPage />
          </RequireAuth>
        }
      />
      <Route
        path="/checkin"
        element={
          <RequireAuth>
            <CheckInPage />
          </RequireAuth>
        }
      />
      <Route
        path="/outreach"
        element={
          <RequireAuth>
            <OutreachPage />
          </RequireAuth>
        }
      />
      <Route
        path="/outreach/:eventId"
        element={
          <RequireAuth>
            <OutreachEventPage />
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
            <RosterPage />
          </RequireAuth>
        }
      />
      <Route
        path="/reports"
        element={
          <RequireAuth>
            <ReportsPage />
          </RequireAuth>
        }
      />

      {/* Protected + role-guarded (illustrative placeholder -- see module doc). */}
      <Route
        path="/settings"
        element={
          <RequireAuth>
            <RequireRole allowedRoles={['admin']}>
              <SettingsPage />
            </RequireRole>
          </RequireAuth>
        }
      />
    </Routes>
  );
}
