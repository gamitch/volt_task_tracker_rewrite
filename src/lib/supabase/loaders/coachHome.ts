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
 * 5. **T198 RESOLVED what T173 deferred here.** This section previously
 *    recorded `events`/`sessions`/`rsvps`/`attendance`/`teamParticipation`/
 *    `studentHours` as literal honest-empty values, deferred because
 *    building per-team queries risked building the wrong shape twice.
 *
 *    **Owner ruled 2026-08-03: season-wide, option (b)** -- verbatim *"yes,
 *    season-wide is fine option b"* (`auto-mode-decisions.md`). No per-coach
 *    team concept is built; none exists in the schema or auth layer
 *    (`AuthUser` carries no team field, no table links a staff profile to a
 *    team, and every `staff_all` RLS policy grants program-wide access).
 *
 *    All six are now real, SEASON-scoped queries above. Two consequences of
 *    the ruling that this file does not hide:
 *
 *    (a) `teamParticipation` is GONE, replaced by `seasonParticipation` --
 *        `v_team_participation` is per-team with no season-grain rollup, so
 *        a season-wide figure comes from `v_season_attendance_rate`
 *        instead. See `CoachHomeSeasonParticipationDbRow`'s own doc for the
 *        two disclosed consequences (a slightly different denominator, and
 *        a duplicate of a figure already rendered elsewhere on the page --
 *        filed as T803).
 *
 *    (b) `PLACEHOLDER_CURRENT_TEAM_ID` no longer filters anything on this
 *        page. `CoachHome.tsx`'s own team-scope predicate and the six
 *        helpers that took a `teamId` are retired by this task -- see that
 *        file's module doc. Wiring these queries WITHOUT that change would
 *        have added real network cost for zero visible effect, since the
 *        placeholder matches no real id.
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
  HomeAttendanceRow,
  HomeEventRow,
  HomeRsvpRow,
  HomeSessionRow,
  HomeStudentRow,
  HomeTeamRow,
  LoadCoachHomeDataFn,
  SeasonParticipationMetric,
  SeasonSetupStatus,
  StudentHoursMetric,
} from '../../../pages/home/CoachHome';

interface CoachHomeTeamDbRow {
  id: string;
  name: string;
}

/**
 * T198 -- the six fields T173 left as honest-empty literals are now real
 * queries. Owner ruled 2026-08-03 (`auto-mode-decisions.md`): *"yes,
 * season-wide is fine option b"* -- no per-coach team concept is built, so
 * every query below is SEASON-scoped and none is team-scoped, matching the
 * five T124 widgets on this same page (`CoachHome.tsx` module doc #13(a))
 * and `loaders/dashboard.ts`'s own module doc #4.
 *
 * Column sets are verbatim against the real schema, not re-derived:
 * `events` (`20260717000000_scheduling_attendance.sql:38-50`),
 * `event_sessions` (`:53-63`), `rsvps` (`:67+`), `attendance`, and the two
 * views `v_student_hours` / `v_season_attendance_rate`.
 *
 * The `events` -> `event_sessions` -> (`rsvps`, `attendance`) chain is the
 * same sequential-dependency shape `dashboard.ts`'s `loadActivityFeedSource`
 * and `reports.ts`'s `makeLoadEventSessionsData` already established, with
 * the same empty-`.in(...)` guard (`dashboard.ts` module doc #5): an id list
 * that came back empty short-circuits instead of issuing `.in('...', [])`.
 */
interface CoachHomeEventDbRow {
  id: string;
  season_id: string;
  type: HomeEventRow['type'];
  title: string;
  team_ids: string[] | null;
}

interface CoachHomeSessionDbRow {
  id: string;
  event_id: string;
  starts_at: string;
  ends_at: string;
  status: HomeSessionRow['status'];
}

interface CoachHomeRsvpDbRow {
  id: string;
  session_id: string;
  student_id: string;
  status: HomeRsvpRow['status'];
  updated_at: string;
}

interface CoachHomeAttendanceDbRow {
  session_id: string;
  student_id: string;
  status: HomeAttendanceRow['status'];
}

/** `v_student_hours` -- already-summed confirmed hours per student per
 * season (`20260717000003_metric_views.sql`). Never recomputed here; the
 * page only sums these across a roster (`CoachHome.tsx` module doc #4). */
interface CoachHomeStudentHoursDbRow {
  student_id: string;
  season_id: string;
  confirmed_hours: number;
}

/**
 * `v_season_attendance_rate` (`20260723000000_kpi_views.sql`) -- the
 * SEASON-grain participation figure that replaces T173's per-team
 * `v_team_participation` read under the season-wide ruling.
 *
 * **Two disclosed consequences of that swap, neither hidden:**
 *
 * 1. **The number changes meaning slightly.** `v_team_participation`'s
 *    denominator EXCLUDES excused absences (`greatest(sum(expected_ct) -
 *    sum(excused_ct), 1)`); `v_season_attendance_rate`'s does NOT
 *    (`greatest(count(*), 1)`). So the season figure is generally lower than
 *    a team figure over the same data. This is the honest season-wide
 *    metric that already exists, not a new one invented here.
 *
 * 2. **This exact view is already loaded on this page**, by
 *    `dashboard.ts`'s `queryAttendanceRate`, and already rendered in the
 *    T124 analytics section (`CoachHome.tsx:2603-2604`). The primary KPI
 *    tile and that analytics tile therefore now show the SAME metric from
 *    two independent load states. Filed as T803 rather than resolved here:
 *    de-duplicating them is a UI decision, not a data-wiring one.
 */
interface CoachHomeSeasonParticipationDbRow {
  season_id: string;
  attendance_rate_pct: number;
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

function mapCoachHomeEvent(row: CoachHomeEventDbRow): HomeEventRow {
  return {
    id: row.id,
    seasonId: row.season_id,
    type: row.type,
    title: row.title,
    // `null` stays `null` -- the real `events.team_ids` "all teams" sentinel
    // (`CoachHome.tsx`'s `HomeEventRow` doc), never coerced to `[]`.
    teamIds: row.team_ids,
  };
}

function mapCoachHomeSession(row: CoachHomeSessionDbRow): HomeSessionRow {
  return {
    id: row.id,
    eventId: row.event_id,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    status: row.status,
  };
}

function mapCoachHomeRsvp(row: CoachHomeRsvpDbRow): HomeRsvpRow {
  return {
    id: row.id,
    sessionId: row.session_id,
    studentId: row.student_id,
    status: row.status,
    updatedAt: row.updated_at,
  };
}

function mapCoachHomeAttendance(row: CoachHomeAttendanceDbRow): HomeAttendanceRow {
  return { sessionId: row.session_id, studentId: row.student_id, status: row.status };
}

function mapCoachHomeStudentHours(row: CoachHomeStudentHoursDbRow): StudentHoursMetric {
  return {
    studentId: row.student_id,
    seasonId: row.season_id,
    // Verbatim passthrough (constitution item 3) -- already summed in SQL.
    confirmedHours: row.confirmed_hours,
  };
}

function mapCoachHomeSeasonParticipation(
  row: CoachHomeSeasonParticipationDbRow,
): SeasonParticipationMetric {
  return { seasonId: row.season_id, participationPct: row.attendance_rate_pct };
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

async function queryCoachHomeEvents(
  client: SupabaseClient,
  seasonId: string,
): Promise<LoaderQueryResult<CoachHomeEventDbRow[]>> {
  const result = await client
    .from('events')
    .select('id, season_id, type, title, team_ids')
    .eq('season_id', seasonId);
  return { data: (result.data as CoachHomeEventDbRow[] | null) ?? null, error: result.error };
}

async function queryCoachHomeSessions(
  client: SupabaseClient,
  eventIds: readonly string[],
): Promise<LoaderQueryResult<CoachHomeSessionDbRow[]>> {
  const result = await client
    .from('event_sessions')
    .select('id, event_id, starts_at, ends_at, status')
    .in('event_id', eventIds as string[]);
  return { data: (result.data as CoachHomeSessionDbRow[] | null) ?? null, error: result.error };
}

async function queryCoachHomeRsvps(
  client: SupabaseClient,
  sessionIds: readonly string[],
): Promise<LoaderQueryResult<CoachHomeRsvpDbRow[]>> {
  const result = await client
    .from('rsvps')
    .select('id, session_id, student_id, status, updated_at')
    .in('session_id', sessionIds as string[]);
  return { data: (result.data as CoachHomeRsvpDbRow[] | null) ?? null, error: result.error };
}

async function queryCoachHomeAttendance(
  client: SupabaseClient,
  sessionIds: readonly string[],
): Promise<LoaderQueryResult<CoachHomeAttendanceDbRow[]>> {
  const result = await client
    .from('attendance')
    .select('session_id, student_id, status')
    .in('session_id', sessionIds as string[]);
  return { data: (result.data as CoachHomeAttendanceDbRow[] | null) ?? null, error: result.error };
}

async function queryCoachHomeStudentHours(
  client: SupabaseClient,
  seasonId: string,
): Promise<LoaderQueryResult<CoachHomeStudentHoursDbRow[]>> {
  const result = await client
    .from('v_student_hours')
    .select('student_id, season_id, confirmed_hours')
    .eq('season_id', seasonId);
  return { data: (result.data as CoachHomeStudentHoursDbRow[] | null) ?? null, error: result.error };
}

async function queryCoachHomeSeasonParticipation(
  client: SupabaseClient,
  seasonId: string,
): Promise<LoaderQueryResult<CoachHomeSeasonParticipationDbRow>> {
  const result = await client
    .from('v_season_attendance_rate')
    .select('season_id, attendance_rate_pct')
    .eq('season_id', seasonId)
    .maybeSingle();
  return {
    data: (result.data as CoachHomeSeasonParticipationDbRow | null) ?? null,
    error: result.error,
  };
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
  const loadEvents = createLoader<string, CoachHomeEventDbRow[]>(queryCoachHomeEvents, getClient);
  const loadSessions = createLoader<readonly string[], CoachHomeSessionDbRow[]>(
    queryCoachHomeSessions,
    getClient,
  );
  const loadRsvps = createLoader<readonly string[], CoachHomeRsvpDbRow[]>(
    queryCoachHomeRsvps,
    getClient,
  );
  const loadAttendance = createLoader<readonly string[], CoachHomeAttendanceDbRow[]>(
    queryCoachHomeAttendance,
    getClient,
  );
  const loadStudentHours = createLoader<string, CoachHomeStudentHoursDbRow[]>(
    queryCoachHomeStudentHours,
    getClient,
  );
  const loadSeasonParticipation = createLoader<string, CoachHomeSeasonParticipationDbRow>(
    queryCoachHomeSeasonParticipation,
    getClient,
  );

  return async (seasonId: string): Promise<CoachHomeData> => {
    // Independent reads issued together; the events -> sessions -> (rsvps,
    // attendance) chain below is sequential because each stage needs the
    // previous stage's ids (`dashboard.ts` module doc #2's own shape).
    const [teamRows, studentRows, eventRows, studentHoursRows, seasonParticipationRow] =
      await Promise.all([
        loadTeams(),
        loadStudents(),
        loadEvents(seasonId),
        loadStudentHours(seasonId),
        loadSeasonParticipation(seasonId),
      ]);

    const events = (eventRows ?? []).map(mapCoachHomeEvent);
    const eventIds = events.map((event) => event.id);

    // Empty-`.in(...)` guard (`dashboard.ts` module doc #5) -- a season with
    // no events issues no session query at all, rather than `.in('event_id',
    // [])`.
    const sessionRows = eventIds.length > 0 ? await loadSessions(eventIds) : null;
    const sessions = (sessionRows ?? []).map(mapCoachHomeSession);
    const sessionIds = sessions.map((session) => session.id);

    const [rsvpRows, attendanceRows] =
      sessionIds.length > 0
        ? await Promise.all([loadRsvps(sessionIds), loadAttendance(sessionIds)])
        : [null, null];

    // `defaultGoalHours` stays an inert literal `0` -- threaded as its own
    // prop from `activeSeason.season`, never read off this object (module
    // doc #1 above, unchanged by T198).
    const seasonSetupStatus: SeasonSetupStatus = { hasGoalsConfigured: true };
    return {
      seasonId,
      defaultGoalHours: 0,
      teams: (teamRows ?? []).map(mapCoachHomeTeam),
      students: (studentRows ?? []).map(mapCoachHomeStudent),
      events,
      sessions,
      rsvps: (rsvpRows ?? []).map(mapCoachHomeRsvp),
      attendance: (attendanceRows ?? []).map(mapCoachHomeAttendance),
      seasonParticipation:
        seasonParticipationRow === null
          ? null
          : mapCoachHomeSeasonParticipation(seasonParticipationRow),
      studentHours: (studentHoursRows ?? []).map(mapCoachHomeStudentHours),
      seasonSetupStatus,
    };
  };
}

/** `CoachHome.tsx`'s real, production default `loadData`. */
export const loadCoachHomeData: LoadCoachHomeDataFn = makeLoadCoachHomeData();
