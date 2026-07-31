/**
 * T158: real, Supabase-backed data for `Leaderboard.tsx`'s
 * `LoadLeaderboardDataFn` (`Leaderboard.tsx:218`) -- the type has existed
 * since T044 with no implementation anywhere under `loaders/` (only the
 * sibling privacy toggle, `leaderboard_privacy.ts`, was ever real). This
 * module supplies the two queries that type needs and nothing else.
 *
 * -----------------------------------------------------------------------
 * 1. Two real queries, verbatim columns (constitution item 3 -- no
 *    re-derived SQL, no invented filter).
 *
 *    `v_student_hours.student_id`/`season_id`/`confirmed_hours`
 *    (`supabase/migrations/20260717000003_metric_views.sql:3-19`,
 *    read-only) -- filtered by `season_id` only, matching
 *    `LeaderboardHoursRow` exactly. No per-student filter and no ranking
 *    happen here (see #4 below).
 *
 *    `v_leaderboard_students.id`/`display_name` -- this task's own new
 *    migration, `supabase/migrations/
 *    20260731000000_leaderboard_students_view.sql`, whose header comment
 *    carries the full reasoning for why a VIEW (not a widened table policy)
 *    is the sanctioned mechanism here. Unfiltered: the view itself already
 *    applies the one filter (`where is_active`), so no TS-layer filter is
 *    duplicated on top of it.
 *
 * -----------------------------------------------------------------------
 * 2. RLS -- why this loader does not read the `students` table directly,
 *    even though `loaders/coachHome.ts` (this file's structural template)
 *    does exactly that.
 *
 *    `students` deliberately carries NO `read_all` policy
 *    (`20260717000002_rls.sql:94-102`, read-only): only `staff_all`
 *    (`is_staff()`) and `own_or_linked_read` (`id in (select
 *    my_student_ids())`). `coachHome.ts`'s plain `.from('students')` read is
 *    safe only because `CoachHome` is staff-gated (`DashboardPage.tsx`'s
 *    role switch renders it for `coach`/`admin` only); the same is true of
 *    the other precedent, `loaders/reports.ts:379-388`, gated by
 *    `ReportsShell.tsx:173`'s `<RequireRole allowedRoles={['coach','admin']}>`.
 *    `Leaderboard.tsx` has no role gate anywhere in the file (its own module
 *    doc #6, OUT-08: identical content for every viewer), so a direct
 *    `students` read from here would silently return at most the caller's
 *    own row for a `student`/`parent` session and the full roster for staff
 *    -- a role-dependent, silent breakage. `rls.sql:90-92` and
 *    `student_teams.sql:47-53` both independently state that broader
 *    teammate visibility "for the leaderboard" is meant to be closed by a
 *    metric/leaderboard VIEW rather than by widening the base table's SELECT
 *    policy; `v_leaderboard_students` is exactly that view.
 *
 *    MEASURED, not reasoned (this task's own live scratch-PGlite/PostgreSQL
 *    run, plus two independent prior runs by the premise gate): with a
 *    non-superuser view owner shaped like Supabase's real
 *    migration-applying role (`relforcerowsecurity = false`), a
 *    `student`-role session reading `v_leaderboard_students` gets every
 *    ACTIVE student's name while the same session reading `students`
 *    directly still gets exactly its own 1 row, and the same session's
 *    unfiltered `v_student_hours` read below likewise returns every
 *    student's hours rows. Setting `security_invoker = on` on either view
 *    collapses both back to 1 row -- so the mechanism is the view owner's
 *    RLS bypass, not an accident of the harness. Both halves of this
 *    loader's exposure (names + hours) therefore rest on ONE proven
 *    mechanism, not two assumptions. Constitution item 25 rules this class
 *    of exposure the intended product for the leaderboard specifically
 *    ("a leaderboard shows everyone's hours... is the feature"); PRD 8.3
 *    (`rls.sql:82-83`) authorizes the name half. This module does NOT
 *    restate `dashboard_views.sql:49-52`'s "each runs under the querying
 *    session's own RLS" claim -- that sentence is the one item 25 and this
 *    task's own measurement both found false.
 *
 * -----------------------------------------------------------------------
 * 3. Avoiding a circular import -- this file imports ONLY types (never a
 *    value) from `../../../pages/outreach/Leaderboard`
 *    (`LeaderboardHoursRow`, `LeaderboardLoadResult`,
 *    `LeaderboardStudentFixture`, `LoadLeaderboardDataFn`), so there is no
 *    runtime cycle: type-only imports are erased at build time, and
 *    `Leaderboard.tsx` imports nothing from this file today. Identical
 *    reasoning to `loaders/coachHome.ts`'s own module doc #6. No
 *    `defaultLoadLeaderboardData` (or any other fixture symbol) is
 *    referenced anywhere in this file.
 *
 * -----------------------------------------------------------------------
 * 4. Deliberately NOT implemented here: any top-10 ranking/slicing, any
 *    name formatting, and any privacy-toggle read. `Leaderboard.tsx`'s own
 *    already-shipped, already-tested `topStudentsByHours` joins these two
 *    result sets client-side and takes the top 10 (rows whose `studentId`
 *    has no matching roster entry are skipped -- which is what makes the
 *    view's `is_active` filter sufficient for excluding a deactivated
 *    student's historical `v_student_hours` row), `formatDisplayName` owns
 *    the render-time privacy boundary, and `leaderboard_privacy.ts` owns
 *    the toggle. Re-implementing any of those here would duplicate shipped,
 *    tested logic.
 *
 * -----------------------------------------------------------------------
 * 5. Not wired into any page by this task. `Leaderboard.tsx` is never
 *    mounted anywhere today; embedding it in `CoachHome.tsx` (with the real
 *    `seasonId` and the `loadLeaderboardData` export below) is filed as
 *    follow-up T203, deliberately not done here -- `Leaderboard.tsx`,
 *    `CoachHome.tsx` and `DashboardPage.tsx` are all read-only for this
 *    task.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { createLoader, type LoaderQueryResult } from '../loader';
import { getSupabaseClient } from '../client';
import type {
  LeaderboardHoursRow,
  LeaderboardLoadResult,
  LeaderboardStudentFixture,
  LoadLeaderboardDataFn,
} from '../../../pages/outreach/Leaderboard';

interface LeaderboardHoursDbRow {
  student_id: string;
  season_id: string;
  confirmed_hours: number;
}

interface LeaderboardStudentDbRow {
  id: string;
  display_name: string;
}

function mapHoursRow(row: LeaderboardHoursDbRow): LeaderboardHoursRow {
  return {
    studentId: row.student_id,
    seasonId: row.season_id,
    confirmedHours: row.confirmed_hours,
  };
}

function mapStudentRow(row: LeaderboardStudentDbRow): LeaderboardStudentFixture {
  return { id: row.id, displayName: row.display_name };
}

async function queryLeaderboardHours(
  client: SupabaseClient,
  seasonId: string,
): Promise<LoaderQueryResult<LeaderboardHoursDbRow[]>> {
  const result = await client
    .from('v_student_hours')
    .select('student_id, season_id, confirmed_hours')
    .eq('season_id', seasonId);
  return { data: (result.data as LeaderboardHoursDbRow[] | null) ?? null, error: result.error };
}

async function queryLeaderboardRoster(
  client: SupabaseClient,
): Promise<LoaderQueryResult<LeaderboardStudentDbRow[]>> {
  const result = await client.from('v_leaderboard_students').select('id, display_name');
  return { data: (result.data as LeaderboardStudentDbRow[] | null) ?? null, error: result.error };
}

/**
 * `getClient` is injectable (defaults to the shared singleton), the same
 * convention every prior loader module in this directory already
 * established, so tests can supply a stubbed transport with zero real
 * network calls -- see this task's own new `leaderboard.test.ts` coverage.
 */
export function makeLoadLeaderboardData(
  getClient: () => SupabaseClient = getSupabaseClient,
): LoadLeaderboardDataFn {
  const loadHours = createLoader<string, LeaderboardHoursDbRow[]>(queryLeaderboardHours, getClient);
  const loadRoster = createLoader<void, LeaderboardStudentDbRow[]>(
    queryLeaderboardRoster,
    getClient,
  );
  return async (seasonId: string): Promise<LeaderboardLoadResult> => {
    const [hoursRows, studentRows] = await Promise.all([loadHours(seasonId), loadRoster()]);
    return {
      hours: (hoursRows ?? []).map(mapHoursRow),
      students: (studentRows ?? []).map(mapStudentRow),
    };
  };
}

/** `Leaderboard.tsx`'s future real `loadData` default (wired by T203, not this task). */
export const loadLeaderboardData: LoadLeaderboardDataFn = makeLoadLeaderboardData();
