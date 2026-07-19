/**
 * T073b1: shared test-only auth login harness, extracted from local
 * `LoginAs` helper components previously duplicated across ten test files:
 *   - `src/pages/home/CoachHome.test.tsx` (T053)
 *   - `src/pages/home/StudentHome.test.tsx` (T054)
 *   - `src/pages/home/ParentHome.test.tsx` (T055)
 *   - `src/pages/home/DashboardPage.test.tsx` (T075)
 *   - `src/pages/meetings/MeetingsList.test.tsx` (T030)
 *   - `src/pages/outreach/OutreachList.test.tsx` (T038)
 *   - `src/pages/meetings/LiveConsole.test.tsx` (T033)
 *   - `src/pages/roster/ParentsTab.test.tsx` (T025)
 *   - `src/pages/roster/AdminToggles.test.tsx` (T028)
 *   - `src/pages/settings/SeasonSettings.test.tsx` (T029)
 *
 * Pure extract-and-reuse refactor (T073b1) -- zero behavior change. `login()`
 * itself (in `../app/guards`) is untouched by this task; both variants below
 * still call `login(user)` with the exact same `(user: AuthUser) => void`
 * shape they always have. This file exists so a *future*, separate,
 * not-yet-dispatched task (T073b2) that changes `login()`'s signature only
 * has to update the two `login(user)` call sites below, instead of ten call
 * sites spread across ten files.
 *
 * On inspection, the ten files' `LoginAs` helpers were NOT one single
 * "identical" shape -- two distinct, internally-consistent variants exist,
 * both preserved verbatim here:
 *
 * 1. `LoginAs` -- logs in synchronously during render (`if (currentUser ===
 *    null) { login(user); }`). Used by the six files above whose rendered
 *    tree has no `RequireRole`/`<Navigate>`-style guard, so there is no risk
 *    of a guard observing a transient `user === null` render:
 *    `CoachHome.test.tsx`, `StudentHome.test.tsx`, `ParentHome.test.tsx`,
 *    `DashboardPage.test.tsx`, `MeetingsList.test.tsx`,
 *    `OutreachList.test.tsx`.
 *
 * 2. `LoginAsDeferred` -- logs in via a `useEffect` (not a render-phase
 *    call) and withholds rendering `children` (returns `null`) until the
 *    login has actually taken effect. Used by the four files above whose
 *    rendered tree includes `RequireRole`, which synchronously
 *    `<Navigate>`s away on any render where `user` is still `null` -- a
 *    render-phase `login()` call would let `RequireRole` observe one
 *    `user === null` render and permanently navigate away before the
 *    corrected re-render ever has a chance to run. (Reasoning and exact
 *    logic originally established in `LiveConsole.test.tsx`/T033, reused
 *    verbatim by `ParentsTab.test.tsx`/T025, `AdminToggles.test.tsx`/T028,
 *    `SeasonSettings.test.tsx`/T029.)
 *
 * The `<MemoryRouter>`/`<AuthProvider>`/`<Routes>`/`<Route>` wrapping shapes
 * around these two components vary meaningfully across the ten files (some
 * need no router at all, some need a bare `MemoryRouter`, some need
 * `Routes`/`Route` for `useParams()` to resolve, some need a second fallback
 * `Route` for redirect assertions, some pass `initialEntries`). Per this
 * task's own Known Context/Traps #2, that wrapping is each file's own
 * concern and is deliberately NOT force-fitted into one generic render
 * function here -- only the `login(user)` call sites (the actual future
 * blast radius for T073b2) are shared.
 */
import { useEffect, type ReactNode } from 'react';
import { useAuth, type AuthUser } from '../app/guards';

/**
 * Logs in synchronously during render. Safe only when the rendered tree has
 * no `RequireRole`/`<Navigate>`-style guard that would react to an
 * intermediate `user === null` render.
 */
export function LoginAs({ user, children }: { user: AuthUser; children: ReactNode }): ReactNode {
  const { login, user: currentUser } = useAuth();
  if (currentUser === null) {
    login(user);
  }
  return <>{children}</>;
}

/**
 * Logs in via a `useEffect` (not a render-phase call) and withholds
 * rendering `children` until the login has actually taken effect. Required
 * whenever the rendered tree includes a `RequireRole`/`<Navigate>`-style
 * guard, so the guard never observes an intermediate `user === null` render.
 */
export function LoginAsDeferred({
  user,
  children,
}: {
  user: AuthUser;
  children: ReactNode;
}): ReactNode {
  const { login, user: currentUser } = useAuth();
  useEffect(() => {
    if (currentUser === null) {
      login(user);
    }
  }, [currentUser, login, user]);
  if (currentUser === null) {
    return null;
  }
  return <>{children}</>;
}
