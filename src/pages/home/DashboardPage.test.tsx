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
import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthProvider, useAuth, type AuthUser } from '../../app/guards';
import { DashboardPage } from './DashboardPage';

// ---------------------------------------------------------------------------
// Render harness -- mirrors CoachHome.test.tsx.
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

function LoginAs({ user, children }: { user: AuthUser; children: ReactNode }): ReactNode {
  const { login, user: currentUser } = useAuth();
  if (currentUser === null) {
    login(user);
  }
  return <>{children}</>;
}

function renderAsUser(user: AuthUser | null): void {
  act(() => {
    root.render(
      <MemoryRouter>
        <AuthProvider>
          {user === null ? (
            <DashboardPage />
          ) : (
            <LoginAs user={user}>
              <DashboardPage />
            </LoginAs>
          )}
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
    expect(container.textContent).toContain('Team participation');
    // CoachHome's HOME-04 admin-only "Season setup" card must NOT show for a
    // plain coach (CoachHome.tsx's own internal role gate), proving this
    // really is CoachHome branching internally, not a coincidence.
    expect(container.textContent).not.toContain('Season setup');
    // Never the other two Home components' distinguishing content.
    expect(container.textContent).not.toContain('Hi Ada Reyes');
    expect(container.textContent).not.toContain('Ada R.');
  });

  it('renders CoachHome for role "admin" (HOME-04 handled internally by CoachHome, not duplicated here)', async () => {
    renderAsUser(ADMIN_USER);
    await flushMicrotasks();
    expect(container.textContent).toContain('Team participation');
    // Fixture season-setup status is incomplete (CoachHome.tsx's own
    // `FIXTURE_SEASON_SETUP_STATUS`), so an admin viewer sees the
    // admin-only "Season setup" card -- proof this is the real CoachHome,
    // with its real internal admin gate, not a separate admin component.
    expect(container.textContent).toContain('Season setup');
    expect(container.textContent).not.toContain('Hi Ada Reyes');
    expect(container.textContent).not.toContain('Ada R.');
  });

  it('renders StudentHome for role "student"', async () => {
    renderAsUser(STUDENT_USER);
    await flushMicrotasks();
    // StudentHome-only hero heading (StudentHome.tsx's own fixture display name).
    expect(container.textContent).toContain('Hi Ada Reyes');
    expect(container.textContent).not.toContain('Team participation');
    expect(container.textContent).not.toContain('Ada R.');
  });

  it('renders ParentHome for role "parent"', async () => {
    renderAsUser(PARENT_USER);
    await flushMicrotasks();
    // ParentHome-only per-linked-student cards (ParentHome.tsx's own fixture
    // linked students).
    expect(container.textContent).toContain('Ada R.');
    expect(container.textContent).toContain('Bea R.');
    expect(container.textContent).toContain('Cleo R.');
    expect(container.textContent).not.toContain('Team participation');
    expect(container.textContent).not.toContain('Hi Ada Reyes');
  });

  it('renders nothing when user is null (defense in depth -- unreachable in practice under RequireAuth)', () => {
    renderAsUser(null);
    expect(container.textContent).toBe('');
  });
});
