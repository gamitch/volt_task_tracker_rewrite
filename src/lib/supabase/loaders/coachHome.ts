/**
 * T173: real, Supabase-backed data for `CoachHome.tsx`'s primary KPI grid --
 * closes the three fabricated on-screen surfaces named in the T173 ledger
 * row (`Hours vs. team goal`'s denominator, `Avg hours / active student`'s
 * `Default goal 10h` secondary, and the admin `Season setup` card's
 * permanent false-positive). All three trace to `CoachHomeData`'s
 * `defaultGoalHours`/`seasonSetupStatus` fields staying on fixture data
 * after T155's outer/inner split, plus `teams`/`students` themselves
 * (needed as inputs to the first two surfaces) -- see `CoachHome.tsx`'s own
 * module doc section 15 for the full record of what changed and why.
 *
 * -----------------------------------------------------------------------
 * 1. Round 2 redesign -- `defaultGoalHours` is NOT a query this file
 *    performs.
 *
 * `CoachHome` already calls `useActiveSeason()` and already holds a full,
 * real `SeasonRow` (`activeSeason.season`) once ready -- that object already
 * carries `defaultGoalHours: number`, sourced from `loaders/seasons.ts`'s
 * `queryActiveSeason`, a query that already runs on every `CoachHome`
 * render, unrelated to this task. `defaultGoalHours` is threaded as a
 * separate PROP straight from `activeSeason.season.defaultGoalHours` into
 * `CoachHomeContent`, the identical pattern T176 already shipped for
 * `StudentHome`'s `goalHours`/`confirmedHours`/`plannedHours`
 * (`StudentHome.tsx:1290-1318`, `loaders/students.ts:519-547`). This file's
 * own `CoachHomeData.defaultGoalHours` return value below is therefore an
 * INERT literal `0` -- never read by `CoachHome.tsx`'s render path once this
 * task ships, kept only because `CoachHomeData` still declares the field on
 * its interface (mirrors `loaders/students.ts:538`'s identical
 * `loadStudentHomeData` precedent, which returns the same inert
 * `defaultGoalHours: 0` for the same reason).
 *
 * -----------------------------------------------------------------------
 * 2. Two real queries, verbatim columns (constitution item 3 -- no
 *    re-derived SQL, no invented filter).
 *
 *    `teams.id`/`teams.name` (`supabase/migrations/
 *    20260716000000_identity_roster.sql:29-38`) -- unfiltered, matching
 *    `HomeTeamRow` exactly, and matching `loaders/dashboard.ts`'s own
 *    `queryDashboardTeams` unfiltered-by-archived precedent (`:297-302`) --
 *    no new `archived` filter is invented here.
 *
 *    `students.id`/`display_name`/`team_id`/`is_active`/
 *    `goal_hours_override` (same migration, `:59-68`) -- unfiltered,
 *    matching `HomeStudentRow` exactly.
 *
 * -----------------------------------------------------------------------
 * 3. RLS (constitution item 3, quoted verbatim, not paraphrased) --
 *    `supabase/migrations/20260717000002_rls.sql`:
 *
 *    ```sql
 *    -- teams (lines 62-64)
 *    create policy staff_all on teams
 *      for all to authenticated
 *      using (is_staff()) with check (is_staff());
 *    -- students (lines 96-98)
 *    create policy staff_all on students
 *      for all to authenticated
 *      using (is_staff()) with check (is_staff());
 *    ```
 *
 *    Neither policy (nor any other `staff_all` policy in the file) filters
 *    by team -- both grant unrestricted, program-wide read/write to any
 *    `is_staff()` (admin/coach) session. `CoachHome` is coach/admin-only, so
 *    both queries below resolve unrestricted for every viewer who reaches
 *    this loader; a real empty result means "none exist yet", not an
 *    RLS-caused false-empty.
 *
 * -----------------------------------------------------------------------
 * 4. `seasonSetupStatus.hasGoalsConfigured` resolves to the literal `true`
 *    -- a disclosed, schema-grounded judgment call (T173 worker packet
 *    Scope ruling #2), not a proxy or a hardcoded guess.
 *
 *    `seasons.default_goal_hours` (`identity_roster.sql:47`) is `numeric not
 *    null default 100` -- every season row that exists has a real, non-null
 *    value. `SeasonSettings.tsx` is the only place a season is created:
 *    `DEFAULT_GOAL_HOURS = 100` (`:435`) pre-fills the create form's initial
 *    state (`:742`) and re-seeds it again every time the create form is
 *    opened (`openCreateForm()`, `:754`, which sets `defaultGoalHours:
 *    DEFAULT_GOAL_HOURS` at `:756`) -- the field is pre-filled and
 *    un-blankable: `isSeasonFormValid` (`:471-478`) requires
 *    `defaultGoalHours !== null && defaultGoalHours >= 0`, and
 *    `buildCreateSeasonPayload` (`:481-491`) returns `null` (blocking the
 *    create action) unless that check passes -- the form structurally
 *    cannot submit a null value. `CoachHome`'s outer wrapper already handles
 *    "no season exists yet" as its own distinct `'none'` state before this
 *    loader is ever called, so by construction every season this field is
 *    evaluated against already has a real, non-null `default_goal_hours`.
 *
 *    Disclosed edge case, not a bug: `isSeasonFormValid` accepts
 *    `defaultGoalHours >= 0`, so a season created with `default_goal_hours =
 *    0` is possible and would still correctly report `hasGoalsConfigured:
 *    true` -- zero is still "configured", just configured to zero.
 *
 * -----------------------------------------------------------------------
 * 5. Explicitly out of scope (T173 worker packet Scope ruling #1, and its
 *    "Not in scope, disclosed" section) -- filed as follow-up T198, not
 *    silently dropped:
 *
 *    `teamId`/`PLACEHOLDER_CURRENT_TEAM_ID` is untouched by this task -- no
 *    per-coach "team" concept exists anywhere in the schema/auth layer today
 *    (`AuthUser` carries no team field, no table links a staff profile to a
 *    team, and RLS grants program-wide, not team-scoped, access). Deciding
 *    whether the remaining team-scoped widgets should become season-wide
 *    (like T124's already-shipped ones) or whether a real team-assignment
 *    concept should be built is a product-scope call for the human owner,
 *    not an engineering gap this file resolves.
 *
 *    `events`/`sessions`/`rsvps`/`attendance`/`teamParticipation`/
 *    `studentHours` stay literal honest-empty values below (`[]`/`null`),
 *    not new Supabase queries -- building real per-team queries for these
 *    would risk building the wrong shape twice if the team-scoping question
 *    above resolves toward season-wide instead.
 *
 * -----------------------------------------------------------------------
 * 6. Avoiding a circular import -- this file imports ONLY types (never a
 *    value) from `../../../pages/home/CoachHome` (`CoachHomeData`,
 *    `HomeStudentRow`, `HomeTeamRow`, `LoadCoachHomeDataFn`,
 *    `SeasonSetupStatus`), so there is no runtime cycle with
 *    `CoachHome.tsx` (which already imports a VALUE, `loadDashboardData`,
 *    from this directory's sibling `dashboard.ts`) -- type-only imports are
 *    erased at build time, unlike a value-level import cycle. No
 *    `defaultLoadCoachHomeData` (or any other `FIXTURE_*` symbol) is
 *    referenced anywhere in this file -- mirrors `loaders/students.ts`'s own
 *    `loadStudentHomeData` convention exactly.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { createLoader, type LoaderQueryResult } from '../loader';
import { getSupabaseClient } from '../client';
import type {
  CoachHomeData,
  HomeStudentRow,
  HomeTeamRow,
  LoadCoachHomeDataFn,
  SeasonSetupStatus,
} from '../../../pages/home/CoachHome';

interface CoachHomeTeamDbRow {
  id: string;
  name: string;
}

interface CoachHomeStudentDbRow {
  id: string;
  display_name: string;
  team_id: string;
  is_active: boolean;
  goal_hours_override: number | null;
}

function mapCoachHomeTeam(row: CoachHomeTeamDbRow): HomeTeamRow {
  return { id: row.id, name: row.name };
}

function mapCoachHomeStudent(row: CoachHomeStudentDbRow): HomeStudentRow {
  return {
    id: row.id,
    displayName: row.display_name,
    teamId: row.team_id,
    isActive: row.is_active,
    goalHoursOverride: row.goal_hours_override,
  };
}

async function queryCoachHomeTeams(
  client: SupabaseClient,
): Promise<LoaderQueryResult<CoachHomeTeamDbRow[]>> {
  const result = await client.from('teams').select('id, name');
  return { data: (result.data as CoachHomeTeamDbRow[] | null) ?? null, error: result.error };
}

async function queryCoachHomeStudents(
  client: SupabaseClient,
): Promise<LoaderQueryResult<CoachHomeStudentDbRow[]>> {
  const result = await client
    .from('students')
    .select('id, display_name, team_id, is_active, goal_hours_override');
  return { data: (result.data as CoachHomeStudentDbRow[] | null) ?? null, error: result.error };
}

/**
 * `getClient` is injectable (defaults to the shared singleton), the same
 * convention every prior loader module in this directory already
 * established, so tests can supply a stubbed transport with zero real
 * network calls -- see this task's own new `coachHome.test.ts` coverage.
 */
export function makeLoadCoachHomeData(
  getClient: () => SupabaseClient = getSupabaseClient,
): LoadCoachHomeDataFn {
  const loadTeams = createLoader<void, CoachHomeTeamDbRow[]>(queryCoachHomeTeams, getClient);
  const loadStudents = createLoader<void, CoachHomeStudentDbRow[]>(
    queryCoachHomeStudents,
    getClient,
  );

  return async (seasonId: string): Promise<CoachHomeData> => {
    const [teamRows, studentRows] = await Promise.all([loadTeams(), loadStudents()]);

    // Return shape: real teams/students, verbatim seasonId passthrough,
    // every other field an honest literal (module doc above) -- no
    // `FIXTURE_*` symbol referenced anywhere in this file.
    const seasonSetupStatus: SeasonSetupStatus = { hasGoalsConfigured: true };
    return {
      seasonId,
      defaultGoalHours: 0,
      teams: (teamRows ?? []).map(mapCoachHomeTeam),
      students: (studentRows ?? []).map(mapCoachHomeStudent),
      events: [],
      sessions: [],
      rsvps: [],
      attendance: [],
      teamParticipation: null,
      studentHours: [],
      seasonSetupStatus,
    };
  };
}

/** `CoachHome.tsx`'s real, production default `loadData`. */
export const loadCoachHomeData: LoadCoachHomeDataFn = makeLoadCoachHomeData();
