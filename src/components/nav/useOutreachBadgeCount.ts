/**
 * GAM-301 (T407) round 3: BEH-04 ("a neutral count Badge of unanswered
 * FUTURE outreach sessions -- student: own; parent: linked kids combined")
 * for the Outreach nav item, exercised for real by `SideNav.tsx`/
 * `MobileNav.tsx` at the same render position `KpiStrip.tsx:150-151`
 * already occupies for the identical `useAuth()`/`useActiveSeason()` pair.
 *
 * -----------------------------------------------------------------------
 * Seam decision (round 3, final; see GAM-301 packet for the full record).
 *
 * Round 2 put this fetch in `AppShell.tsx`'s own body. That cannot work:
 * `AppShell.tsx` renders `<SeasonProvider>` and mounts both navs INSIDE it --
 * a hook calling `useActiveSeason()` from `AppShell`'s own body sits OUTSIDE
 * the provider it renders, and throws (`useActiveSeason() must be called
 * within a <SeasonProvider>`, measured: `AppShell.test.tsx` 25/25 failed).
 * `SideNav`/`MobileNav` are mounted mutually exclusively by Astryx's own
 * `isMobile` shell state (not two simultaneously-live subtrees over a CSS
 * breakpoint), so there is no shared-fetch requirement either -- each nav
 * component calls this hook itself, and `AppShell.tsx` is not touched at
 * all.
 *
 * -----------------------------------------------------------------------
 * Bundle-size seam (the other half of round 2's two BLOCKERs).
 *
 * This is EAGER nav chrome (mounted unconditionally inside `AppShell`, not
 * behind a `React.lazy()` route boundary like every `src/pages/**` module).
 * Its two data dependencies -- the BEH-04 "unanswered outreach" predicate
 * and the real `studentId` resolver -- both used to live inside lazy page
 * modules (`StudentHome.tsx`, and `loaders/meetings.ts`'s own value-imports
 * of `MeetingsList.tsx`/`ScheduleMeetingsDialog.tsx`). Importing either
 * directly would have pulled that lazy page code into the eager entry chunk
 * (measured against `loaders/meetings.ts` specifically: entry chunk
 * 199.02 -> 249.49 kB gz, 18 lazy chunks collapsed). Both were relocated to
 * pure leaf modules with no page dependency
 * (`../../lib/outreach/unansweredOutreach.ts`,
 * `../../lib/meetings/resolveCurrentStudentId.ts`) specifically so this hook
 * could import them without that cost -- see each leaf module's own doc for
 * the full record. `loadStudentHomeData`/`resolveStudentScope`
 * (`../../lib/supabase/loaders/students.ts`) are safe to value-import
 * directly: that loader file itself only ever `import type`s from any page
 * module (verified directly against its own import list), never a value
 * import, so it carries no lazy-page bundle edge of its own.
 * `LoadStudentHomeDataFn`/`ResolveStudentScopeFn`/`StudentScope` and
 * `CurrentViewerIdentity`/`ResolveCurrentStudentIdFn` below are `import
 * type` only from their owning page modules (`StudentHome.tsx`/
 * `MeetingsList.tsx`) -- erased at compile time, so they create no bundle
 * edge either, the same precedent `loaders/students.ts` already established
 * for its own identical type-only cross references.
 *
 * -----------------------------------------------------------------------
 * Behavior.
 *
 * 1. `useAuth()`/`useActiveSeason()` are called unconditionally, before any
 *    conditional return -- Rules of Hooks, same precedent `KpiStrip.tsx`
 *    already sets for this exact pair.
 * 2. `user === null`, or a staff role (`isStaffRole` -- the same
 *    `admin`/`coach` check already at `SideNav.tsx`) -> `null` (no badge).
 *    BEH-04 defines no coach/admin badge at all.
 * 3. `useActiveSeason()` `'loading'`/`'error'` -> `null` (never fabricate a
 *    number). `'none'` -> `0` (a real computed zero -- no active season
 *    genuinely means zero outreach sessions to answer).
 * 4. `'ready'`: resolve the real `studentId` via `resolveStudentId`.
 *    - Resolves `null` (no linked student) -> `0`, matching
 *      `resolveCurrentStudentId`'s own documented `null` case.
 *    - Resolves a `studentId` -> load `loadStudentHomeData`/
 *      `resolveStudentScope` in parallel, then
 *      `getUnansweredOutreachOpportunities(...).length`.
 *      - `resolveStudentScope` resolving `null` mirrors `StudentHome.tsx`'s
 *        own `resolveStudentIdentity` `'inactive'` outcome -- a REAL, linked
 *        student row with `is_active = false`, so there is no real
 *        `teamIds` set to compute a badge against. Not the same case as "no
 *        linked student" (which IS a genuine, computed `0`), so it is not
 *        collapsed into that `0` -- it settles to `null` (no badge), the
 *        same "don't fabricate a number" bucket as loading/error.
 *      - Either loader rejecting -> `null`.
 * 5. Parent = the same single-student resolution as student (this repo
 *    resolves exactly one linked student per parent today, a disclosed
 *    existing simplification `resolveCurrentStudentId`/`OutreachList.tsx`'s
 *    `StudentParentOutreachView` already carry -- not "linked kids
 *    combined" despite BEH-04's literal wording; see GAM-301 packet "Least
 *    confident decisions" #3).
 * 6. One effect, re-running only on the exact dependency list the GAM-301
 *    packet specifies (see the `useEffect` call below) -- `now` is
 *    deliberately NOT in that list (it defaults to `Date.now`, a stable
 *    function reference across renders; a test-injected `now` is expected to
 *    be referentially stable across the render(s) it drives too, the same
 *    "injected-function-in-deps" convention every other loader seam in this
 *    codebase already uses).
 */
import { useEffect, useState } from 'react';
import { useAuth } from '../../app/guards';
import { useActiveSeason } from '../../app/SeasonProvider';
import { getUnansweredOutreachOpportunities } from '../../lib/outreach/unansweredOutreach';
import { resolveCurrentStudentId as defaultResolveStudentId } from '../../lib/meetings/resolveCurrentStudentId';
import {
  loadStudentHomeData as defaultLoadStudentHomeData,
  resolveStudentScope as defaultResolveStudentScope,
} from '../../lib/supabase/loaders/students';
import type { LoadStudentHomeDataFn, ResolveStudentScopeFn } from '../../pages/home/StudentHome';
import type {
  CurrentViewerIdentity,
  ResolveCurrentStudentIdFn,
} from '../../pages/meetings/MeetingsList';

export interface UseOutreachBadgeCountOptions {
  /** Defaults to the real `loadStudentHomeData` (`loaders/students.ts`). */
  loadStudentHomeData?: LoadStudentHomeDataFn;
  /** Defaults to the real `resolveStudentScope` (`loaders/students.ts`). */
  resolveStudentScope?: ResolveStudentScopeFn;
  /** Defaults to the real `resolveCurrentStudentId`
   * (`../../lib/meetings/resolveCurrentStudentId.ts`). */
  resolveStudentId?: ResolveCurrentStudentIdFn;
  /** Defaults to `Date.now`. */
  now?: () => number;
}

/**
 * `number | null`: `null` means "render no badge" (unknown/loading/error/
 * not-applicable-role -- see module doc above for the full state table). A
 * real, computed `0` is a NUMBER, not `null`.
 */
export function useOutreachBadgeCount(options?: UseOutreachBadgeCountOptions): number | null {
  const {
    loadStudentHomeData = defaultLoadStudentHomeData,
    resolveStudentScope = defaultResolveStudentScope,
    resolveStudentId = defaultResolveStudentId,
    now = Date.now,
  } = options ?? {};

  const { user } = useAuth();
  const seasonState = useActiveSeason();

  const [count, setCount] = useState<number | null>(null);

  const isStaffRole = user?.role === 'admin' || user?.role === 'coach';
  const seasonId = seasonState.status === 'ready' ? seasonState.season.id : null;

  useEffect(() => {
    if (user === null || isStaffRole) {
      setCount(null);
      return;
    }

    if (seasonState.status === 'loading' || seasonState.status === 'error') {
      setCount(null);
      return;
    }

    if (seasonState.status === 'none') {
      setCount(0);
      return;
    }

    // 'ready' -- the only remaining case (TS narrows `seasonState` here via
    // the two early returns above, both keyed on the same discriminant).
    let isMounted = true;
    const viewer: CurrentViewerIdentity = { id: user.id, role: user.role };

    resolveStudentId(viewer)
      .then((studentId) => {
        if (!isMounted) return undefined;
        if (studentId === null) {
          setCount(0);
          return undefined;
        }
        return Promise.all([
          loadStudentHomeData(studentId, seasonState.season.id),
          resolveStudentScope(studentId),
        ]).then(([data, scope]) => {
          if (!isMounted) return;
          if (scope === null) {
            // Module doc #4 above -- mirrors `StudentHome.tsx`'s own
            // `'inactive'` outcome, not fabricated as `0`.
            setCount(null);
            return;
          }
          const opportunities = getUnansweredOutreachOpportunities(
            data.sessions,
            data.events,
            data.rsvps,
            studentId,
            scope.teamIds,
            now(),
          );
          setCount(opportunities.length);
        });
      })
      .catch(() => {
        if (isMounted) setCount(null);
      });

    return () => {
      isMounted = false;
    };
    // Exact dependency list per the GAM-301 packet's own seam decision.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    user?.id,
    user?.role,
    seasonState.status,
    seasonId,
    loadStudentHomeData,
    resolveStudentScope,
    resolveStudentId,
  ]);

  return count;
}
