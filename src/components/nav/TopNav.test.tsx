// @vitest-environment jsdom
/**
 * T115 (PRD v2 SCH-02): tests for `TopNav.tsx`'s `ActiveSeasonDisplay`
 * (`useActiveSeason()` wiring, replacing the old `PLACEHOLDER_SEASON_OPTIONS`
 * fixture `Selector`). No `TopNav.test.tsx` existed before this task (grep-
 * confirmed against the repo before writing this file).
 *
 * Follows `ReportsShell.test.tsx`'s own established `useActiveSeason()`
 * harness pattern (module doc there): a real `<SeasonProvider
 * loadActiveSeason={...}>` wrapping the render, with an injectable
 * `loadActiveSeason` per test to drive each of the four states. No
 * `@testing-library/react` is installed in this repo (confirmed via
 * `package.json`, same posture every other test file in this codebase
 * already established) -- this file uses the same raw `createRoot`/`act`
 * pattern, and `../../test-utils/authHarness`'s `LoginAs` for role login
 * (`TopNav` reads `useAuth()` directly, not `RequireRole`, so either harness
 * variant works; `LoginAs` is used here since no nested guard needs the
 * "deferred" timing fix `LoginAsDeferred` exists for).
 *
 * Coverage:
 *   - role gating (Trap #3): admin/coach see the season display; a
 *     parent/student, or no signed-in user at all, never see it (and never
 *     see the user menu either -- unchanged existing behavior, a quick
 *     regression check).
 *   - the real active season's name renders for the `'ready'` state, and the
 *     old placeholder literal ("2025-2026 Season (placeholder active
 *     season)") is asserted absent across every state.
 *   - `'loading'`/`'none'`/`'error'` each render their own honest,
 *     non-crashing copy; `'error'`'s Retry button calls `refresh()`
 *     (proved via a `loadActiveSeason` call-count assertion across two
 *     resolutions, the same "prove refresh() reruns the fetch" style
 *     `SeasonProvider.test.tsx` already uses).
 */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthProvider, type AuthUser } from '../../app/guards';
import { SeasonProvider, type LoadActiveSeasonFn } from '../../app/SeasonProvider';
import type { SeasonRow } from '../../lib/supabase/types';
import { LoginAs } from '../../test-utils/authHarness';
import { TopNav } from './TopNav';

const ADMIN_USER: AuthUser = { id: 'user-admin', email: 'admin@example.com', role: 'admin' };
const COACH_USER: AuthUser = { id: 'user-coach', email: 'coach@example.com', role: 'coach' };
const PARENT_USER: AuthUser = { id: 'user-parent', email: 'parent@example.com', role: 'parent' };
const STUDENT_USER: AuthUser = {
  id: 'user-student',
  email: 'student@example.com',
  role: 'student',
};

const REAL_ACTIVE_SEASON: SeasonRow = {
  id: 'season-2026-27',
  name: '2026-27',
  startsOn: '2026-08-01',
  endsOn: '2027-06-30',
  defaultGoalHours: 100,
  isActive: true,
  createdAt: '2026-08-01T00:00:00.000Z',
};

const OLD_PLACEHOLDER_STRING = '2025-2026 Season (placeholder active season)';

let container: HTMLDivElement;
let root: Root;

function renderTopNav(
  user: AuthUser | null,
  loadActiveSeason: LoadActiveSeasonFn = async () => REAL_ACTIVE_SEASON,
): void {
  const tree = (
    <MemoryRouter initialEntries={['/']}>
      <SeasonProvider loadActiveSeason={loadActiveSeason}>
        <TopNav />
      </SeasonProvider>
    </MemoryRouter>
  );

  // `TopNav` calls `useAuth()` unconditionally (null-safe reads, module doc),
  // so it always needs SOME `<AuthProvider>` ancestor -- a bare one for the
  // "no signed-in user" case (fails safe to an anonymous `user: null` state
  // per `AuthProvider`'s own disclosed unconfigured-backend behavior,
  // `guards.tsx`), `LoginAs`'s own scoped fake-`authModule` one otherwise.
  act(() => {
    root.render(
      user === null ? <AuthProvider>{tree}</AuthProvider> : <LoginAs user={user}>{tree}</LoginAs>,
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
});

describe('<TopNav /> ActiveSeasonDisplay role gating (Trap #3, unchanged)', () => {
  it('shows the season display for an admin', async () => {
    renderTopNav(ADMIN_USER);
    await flushMicrotasks();
    expect(container.textContent).toContain('2026-27');
  });

  it('shows the season display for a coach', async () => {
    renderTopNav(COACH_USER);
    await flushMicrotasks();
    expect(container.textContent).toContain('2026-27');
  });

  it('hides the season display for a parent', async () => {
    renderTopNav(PARENT_USER);
    await flushMicrotasks();
    expect(container.textContent).not.toContain('2026-27');
  });

  it('hides the season display for a student', async () => {
    renderTopNav(STUDENT_USER);
    await flushMicrotasks();
    expect(container.textContent).not.toContain('2026-27');
  });

  it('renders nothing in endContent when there is no signed-in user', async () => {
    renderTopNav(null);
    await flushMicrotasks();
    expect(container.textContent).not.toContain('2026-27');
    expect(container.querySelector('[aria-label^="Account menu for"]')).toBeNull();
  });
});

describe('<TopNav /> ActiveSeasonDisplay states (T115)', () => {
  it("'ready': shows the real active season name, never the old placeholder literal", async () => {
    renderTopNav(ADMIN_USER, async () => REAL_ACTIVE_SEASON);
    await flushMicrotasks();
    expect(container.textContent).toContain('2026-27');
    expect(container.textContent).not.toContain(OLD_PLACEHOLDER_STRING);
  });

  it("'loading': shows an honest loading announcement, never the placeholder or a fabricated year", async () => {
    renderTopNav(ADMIN_USER, () => new Promise(() => {}));
    await flushMicrotasks();
    expect(container.textContent).toContain('Loading the active season');
    expect(container.textContent).not.toContain(OLD_PLACEHOLDER_STRING);
    expect(container.textContent).not.toContain('2026-27');
  });

  it("'none': shows a muted 'No active season' label, never a fabricated year", async () => {
    renderTopNav(ADMIN_USER, async () => null);
    await flushMicrotasks();
    expect(container.textContent).toContain('No active season');
    expect(container.textContent).not.toContain(OLD_PLACEHOLDER_STRING);
    expect(container.textContent).not.toContain('2026-27');
  });

  it("'error': shows a compact error indicator and Retry re-runs the load", async () => {
    const loadActiveSeason = vi
      .fn<LoadActiveSeasonFn>()
      .mockRejectedValueOnce({ code: '42501', message: 'Permission denied.', cause: null })
      .mockResolvedValueOnce(REAL_ACTIVE_SEASON);

    renderTopNav(ADMIN_USER, loadActiveSeason);
    await flushMicrotasks();

    expect(container.textContent).toContain('Season unavailable');
    expect(container.textContent).not.toContain(OLD_PLACEHOLDER_STRING);
    expect(loadActiveSeason).toHaveBeenCalledTimes(1);

    const retryButton = Array.from(container.querySelectorAll('button')).find((button) =>
      button.textContent?.includes('Retry'),
    );
    expect(retryButton, 'expected a Retry button in the error state').toBeTruthy();

    act(() => {
      retryButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    await flushMicrotasks();

    expect(loadActiveSeason).toHaveBeenCalledTimes(2);
    expect(container.textContent).toContain('2026-27');
    expect(container.textContent).not.toContain('Season unavailable');
  });
});

// The old `PLACEHOLDER_SEASON_OPTIONS`/`PLACEHOLDER_ACTIVE_SEASON` constants
// (this task's worker packet, "Grep the repo for any other consumer... before
// deleting them") are no longer exported or defined anywhere in `TopNav.tsx`
// -- confirmed via a repo-wide grep before this task's edits: the only other
// reference was a prose doc-comment mention in `SideNav.tsx` ("same spirit as
// TopNav's `PLACEHOLDER_SEASON_OPTIONS`"), never a real import, so no other
// file needed updating when these constants were removed.
