/**
 * GAM-301 (T407) round 3, BLOCKER 2 fix: pure leaf module for
 * `resolveCurrentStudentId`, relocated out of
 * `src/lib/supabase/loaders/meetings.ts`. `meetings.ts` itself
 * value-imports from two LAZY page modules -- `buildCoachMeetingRows`/
 * `buildStudentMeetingsData` from `MeetingsList.tsx` and
 * `computeMeetingSeriesReconcilePlan` from `ScheduleMeetingsDialog.tsx` (see
 * that file's own module doc, Trap #1/#3) -- so importing *anything* from
 * `meetings.ts` pulls both pages into whatever chunk does the importing.
 * Measured directly against `src/components/nav/useOutreachBadgeCount.ts`
 * (EAGER nav chrome, mounted inside `SideNav`/`MobileNav`) importing
 * `resolveCurrentStudentId` straight from `meetings.ts`: entry chunk
 * 199.02 -> 249.49 kB gz (+50.47 kB), 18 lazy chunks collapsed -- round 1's
 * BLOCKER at ~70% magnitude, not fixed. This relocation exists to close
 * that gap: `resolveCurrentStudentId` depends only on `createLoader`/
 * `getSupabaseClient` (`../supabase/loader.ts` / `../supabase/client.ts`,
 * both already-eager, page-free modules) and two `import type`-only cross
 * references into `MeetingsList.tsx`, both erased at compile time and
 * therefore invisible to the bundler's module graph.
 *
 * Pure relocation, verbatim: `makeResolveCurrentStudentId`,
 * `resolveCurrentStudentId`, their two query helpers
 * (`queryStudentIdByProfileId`, `queryFirstLinkedStudentId`) and the two DB
 * row types (`StudentIdDbRow`, `GuardianLinkStudentIdDbRow`), moved
 * unchanged from `meetings.ts`. That file's own module doc records the full
 * resolution semantics (Trap #4: a `student`-role viewer resolves via
 * `students.profile_id = auth.uid()`; a `parent`-role viewer resolves via
 * their EARLIEST-linked `guardian_links` row) -- not re-derived here.
 * `meetings.ts` re-exports `makeResolveCurrentStudentId`/
 * `resolveCurrentStudentId` from this file (`export { ... } from`, valid
 * under this repo's `isolatedModules: true`) so its own existing
 * callers/tests (`MeetingsList.test.tsx`'s `resolveCurrentStudentId (T096,
 * Trap #4 real resolution)` suite and its `C4` module-level
 * `vi.spyOn(meetingsLoadersNs, 'resolveCurrentStudentId')` probe;
 * `StudentMeetingView.tsx`; `OutreachList.tsx`; `DashboardPage.test.tsx`'s
 * `vi.mock('.../loaders/meetings', ...)`) are unaffected -- all of them keep
 * importing from `../../lib/supabase/loaders/meetings` exactly as before.
 *
 * GAM-444 §5 update: `CurrentViewerIdentity`/`ResolveCurrentStudentIdFn` now
 * come from `./types` (`src/lib/meetings/types.ts`), not `MeetingsList.tsx`
 * -- this closes the `lib -> pages` inversion the paragraph above used to
 * describe. Still `import type` only, still erased at runtime; the
 * `lib -> lib` edge this creates is not a cycle and carries no page-module
 * bundle weight either way.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { createLoader, type LoaderQueryResult } from '../supabase/loader';
import { getSupabaseClient } from '../supabase/client';
import type { CurrentViewerIdentity, ResolveCurrentStudentIdFn } from './types';

interface StudentIdDbRow {
  id: string;
}

interface GuardianLinkStudentIdDbRow {
  student_id: string;
}

async function queryStudentIdByProfileId(
  client: SupabaseClient,
  profileId: string,
): Promise<LoaderQueryResult<StudentIdDbRow>> {
  const result = await client
    .from('students')
    .select('id')
    .eq('profile_id', profileId)
    .maybeSingle();
  return { data: (result.data as StudentIdDbRow | null) ?? null, error: result.error };
}

/** Trap #4 (`meetings.ts`'s own module doc) -- EARLIEST-linked child only. */
async function queryFirstLinkedStudentId(
  client: SupabaseClient,
  parentProfileId: string,
): Promise<LoaderQueryResult<GuardianLinkStudentIdDbRow[]>> {
  const result = await client
    .from('guardian_links')
    .select('student_id')
    .eq('parent_profile_id', parentProfileId)
    .order('created_at', { ascending: true })
    .limit(1);
  return {
    data: (result.data as GuardianLinkStudentIdDbRow[] | null) ?? null,
    error: result.error,
  };
}

/** Trap #4 -- real `studentId` resolution (full reasoning documented on
 * `meetings.ts`'s own module doc, and on `MeetingsList.tsx`'s module doc #6). */
export function makeResolveCurrentStudentId(
  getClient: () => SupabaseClient = getSupabaseClient,
): ResolveCurrentStudentIdFn {
  const loadStudentByProfile = createLoader<string, StudentIdDbRow>(
    queryStudentIdByProfileId,
    getClient,
  );
  const loadFirstLinkedStudent = createLoader<string, GuardianLinkStudentIdDbRow[]>(
    queryFirstLinkedStudentId,
    getClient,
  );
  return async (viewer: CurrentViewerIdentity): Promise<string | null> => {
    if (viewer.role === 'student') {
      const row = await loadStudentByProfile(viewer.id);
      return row?.id ?? null;
    }
    if (viewer.role === 'parent') {
      const rows = await loadFirstLinkedStudent(viewer.id);
      return rows !== null && rows.length > 0 ? rows[0].student_id : null;
    }
    // Defensive only -- `MeetingsList.tsx`'s own `isCoachOrAdminView` branch
    // never renders the student/parent view (and never calls this function)
    // for a coach/admin viewer.
    return null;
  };
}

/** `MeetingsList.tsx`'s own default `resolveStudentId`, re-exported by
 * `meetings.ts` for its existing callers. */
export const resolveCurrentStudentId: ResolveCurrentStudentIdFn = makeResolveCurrentStudentId();
