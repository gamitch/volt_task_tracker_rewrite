/**
 * T075: `/` Home role dispatcher (HOME-01..04).
 *
 * `router.tsx`'s `/` route previously resolved to an inline
 * `<div>Dashboard (placeholder)</div>` (T005 placeholder, confirmed by
 * reading that file before this task's edit). The PRD's route table (line
 * ~365: `| / | all | Analytics Dashboard (coach) / custom stacks | ... |
 * HOME-01…04 |`) and Section 6.2 (HOME-01..04) require three genuinely
 * different dashboards depending on the signed-in user's role, not one
 * shared component:
 *
 *   - HOME-01 Coach Home + HOME-04 Admin Home  -> `CoachHome.tsx`'s
 *     `CoachHome`. HOME-04 ("Admin Home = Coach Home + a Season setup
 *     shortcut card") is already implemented ENTIRELY INSIDE `CoachHome.tsx`
 *     itself (it already branches on `user.role === 'admin'` internally to
 *     show/hide its "Season setup" card, confirmed by reading that file --
 *     a forbidden/read-only file for this task). This dispatcher therefore
 *     does not need any separate admin-specific branch of its own: `admin`
 *     and `coach` both route to the exact same `CoachHome` component.
 *   - HOME-02 Student Home  -> `StudentHome.tsx`'s `StudentHome`.
 *   - HOME-03 Parent Home   -> `ParentHome.tsx`'s `ParentHome`.
 *
 * All three Home components already take zero required props (every prop
 * optional with a fixture default, confirmed by reading each file's own
 * `= {}` default parameter) -- this dispatcher's ONLY job is role-based
 * component selection. It deliberately does not plumb any props through to
 * whichever Home component it renders.
 *
 * -----------------------------------------------------------------------
 * 1. `RequireAuth`-only wrapping, no `RequireRole` (router.tsx wiring).
 *
 * `router.tsx`'s `/` route wraps this component in `RequireAuth` only,
 * matching the placeholder's own wrapper exactly (unchanged by this task).
 * Every one of the four real `Role` values (`admin`, `coach`, `student`,
 * `parent`) gets a valid dashboard below -- unlike `/roster` or `/kiosk`,
 * there is no "wrong role" case to exclude, so this component does not
 * import or use `RequireRole` at all.
 *
 * -----------------------------------------------------------------------
 * 2. `user === null` defensive-in-depth (same convention `LiveConsole.tsx`'s
 *    `LiveConsoleBody` already established for its own post-gate content --
 *    `const canSetExcused = user !== null && (...)`, grepped directly).
 *
 * `RequireAuth` (`guards.tsx`) guarantees `user` is non-null by the time
 * this component renders in practice, but `AuthContextValue.user`'s TYPE is
 * still `AuthUser | null` -- the type does not itself guarantee it. Rather
 * than asserting/casting past that or crashing on a theoretically-possible
 * `null`, this component returns `null` when `user === null`, mirroring
 * `RequireAuth`'s own `isLoading`-returns-`null` convention (same file,
 * same "nothing to render yet/here" idiom) instead of rendering a broken
 * UI.
 *
 * -----------------------------------------------------------------------
 * 3. Exhaustive role dispatch, not a fallback-to-default guess.
 *
 * `Role` (`guards.tsx`, re-exported verbatim from `src/lib/supabase/types.ts`
 * as of T073a) is a closed union of exactly four string literals: `'admin'
 * | 'coach' | 'student' | 'parent'`. The `switch` below has one `case` per
 * literal plus a `default` branch that assigns `user.role` to a
 * `const _exhaustive: never = user.role` binding. Because every real case is
 * handled above it, TypeScript narrows `user.role` to the `never` type by
 * the time control reaches `default` -- if a fifth role literal were ever
 * added to the `Role` union (e.g. `'volunteer'`) without a matching `case`
 * being added here, `user.role` at the `default` branch would narrow to
 * `'volunteer'` instead of `never`, and assigning a non-`never` value to a
 * `never`-typed binding is a real TypeScript compile error (TS2322: "Type
 * 'volunteer' is not assignable to type 'never'."). This is a genuine
 * compile-time safety net, not decoration -- see this task's worker output
 * for a live demonstration (an isolated standalone reproduction of this
 * exact switch shape, outside the repo, run through `tsc --strict` with a
 * widened 5-literal role union, capturing the resulting TS2322 error
 * verbatim -- no repo file, including this one, was altered for that
 * proof).
 *
 * -----------------------------------------------------------------------
 * 4. Naming/export convention (Known Context/Traps #4).
 *
 * Named export `DashboardPage` (not `export default`), matching the
 * removed placeholder's own function name and `router.tsx`'s existing
 * `routePaths.dashboard` naming, and matching the convention every other
 * page component T074 wired uses (zero default exports among them, per
 * this task's packet -- `LiveConsole.tsx`'s `LiveConsolePage` default
 * export is a documented exception, not the norm, and is not followed
 * here).
 *
 * -----------------------------------------------------------------------
 * 5. No index barrel in `src/pages/home/` (Known Context/Traps #5,
 *    confirmed by directory listing before this task's edit -- only
 *    `CoachHome.tsx`, `ParentHome.tsx`, `StudentHome.tsx`,
 *    `StudentHomeSlot.tsx`, no `index.ts`). Each Home component is
 *    imported directly by file path below; no barrel file was created.
 *
 * -----------------------------------------------------------------------
 * 6. Home component internals are read-only reference for this task
 *    (Known Context/Traps #6). Nothing inside `CoachHome.tsx`/
 *    `StudentHome.tsx`/`ParentHome.tsx` was modified while building this
 *    dispatcher, even where something looked improvable -- flagged as a
 *    follow-up in this task's worker output instead, per the packet's
 *    explicit instruction not to fix it here.
 */
import type { ReactNode } from 'react';
import { useAuth } from '../../app/guards';
import { CoachHome } from './CoachHome';
import { StudentHome } from './StudentHome';
import { ParentHome } from './ParentHome';

export function DashboardPage(): ReactNode {
  const { user } = useAuth();

  // Module doc #2 -- mirrors `LiveConsole.tsx`'s `user !== null` /
  // `RequireAuth`'s `isLoading`-returns-`null` conventions.
  if (user === null) {
    return null;
  }

  // Module doc #3 -- genuinely exhaustive, not a fallback-to-default guess.
  switch (user.role) {
    case 'admin':
    case 'coach':
      return <CoachHome />;
    case 'student':
      return <StudentHome />;
    case 'parent':
      return <ParentHome />;
    default: {
      const _exhaustive: never = user.role;
      throw new Error(`Unhandled role: ${String(_exhaustive)}`);
    }
  }
}

export default DashboardPage;
