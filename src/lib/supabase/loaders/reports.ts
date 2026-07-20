/**
 * T095 (ED-1 Packet P6): real Reports data-layer wiring for the three
 * `/reports` tabs (`ParticipationTab.tsx`/T056, `HoursTab.tsx`/T057,
 * `EventsTab.tsx`/T058 -- all forbidden/read-only files here, per the
 * worker packet). This is a READ-ONLY reporting packet -- no mutations
 * exist anywhere in this file (grep-provable: no `.insert(`/`.update(`/
 * `.delete(`/`.upsert(` call anywhere below), only `.select(...)` queries
 * via `createLoader` (T086, `../loader.ts`, read-only import). Same DI
 * (`getClient`) convention `loaders/students.ts`/`loaders/seasons.ts`
 * already established for this `loaders/` directory.
 *
 * -----------------------------------------------------------------------
 * 1. Constitution item 3 (BLOCKER) -- strict passthrough only, zero
 *    re-derived metric arithmetic anywhere in this file.
 *
 * `v_student_participation` and `v_student_hours` (both
 * `supabase/migrations/20260717000003_metric_views.sql`, already cited
 * column-by-column in `../types.ts`'s own `VStudentParticipationRow`/
 * `VStudentHoursRow` doc comments, not re-cited here) are read via a plain
 * `select('*')`-equivalent explicit column list and mapped snake_case ->
 * camelCase 1:1, with NO arithmetic performed on any of their columns
 * anywhere in this file -- grep-provable: no `100.0 *`, no `/ greatest(`,
 * no `round(`, no `+`/`-`/`*`/`/` operator touches `expectedCt`/`presentCt`/
 * `lateCt`/`excusedCt`/`participationPct`/`confirmedHours` anywhere below.
 * `mapParticipationMetricDbRowToMetricRow`/`mapStudentHoursDbRowToMetricRow`
 * are the ONLY two functions that touch these columns, and both are pure
 * renames (see each one's own body). The team-level/season-level
 * aggregation, planned-hours computation, hours-vs-goal percent, and
 * per-session hours-awarded arithmetic (`HoursTab.tsx`'s own
 * `buildStudentRows`/`buildTeamGroups`/`hoursVsGoalPercent`,
 * `EventsTab.tsx`'s own `computeAttendeeHours`/`computeSessionHoursAwarded`)
 * all already live in those two forbidden/read-only page files' own pure
 * functions (already checker-approved in T057/T058) -- this loader supplies
 * only the raw, already-computed-by-SQL-where-a-view-exists rows those
 * functions consume, never re-implementing any of that logic itself.
 *
 * -----------------------------------------------------------------------
 * 2. Reused pure join functions -- `buildDisplayRows` from BOTH
 *    `ParticipationTab.tsx` and `EventsTab.tsx` (aliased on import to avoid
 *    a name collision between the two, since both pages independently
 *    export a function with that exact name) are imported and reused
 *    directly here, rather than re-implementing an equivalent join in this
 *    file. Both are already-checker-approved, already-exported, already-
 *    pure (no side effects, no arithmetic beyond what each function's own
 *    doc comment already discloses) functions built specifically to LEFT
 *    JOIN a raw roster/session list against a raw metric-row list -- this
 *    loader's own job is only to fetch the raw rows and hand them to the
 *    SAME function each page already renders with (so a real network
 *    response and this loader's own unit tests below exercise the exact
 *    same join logic the page itself uses for its fixture default).
 *    `HoursTab.tsx` has no equivalent single join function to reuse (its
 *    own `buildStudentRows`/`buildTeamGroups`/`buildSeasonTotals` are all
 *    called directly by the component from the raw `HoursLoadResult` this
 *    loader returns) -- this loader's own `makeLoadHoursData` therefore
 *    only shapes raw rows into that same `HoursLoadResult` contract,
 *    performing no join of its own either.
 *
 * -----------------------------------------------------------------------
 * 3. Season scoping -- every loader below takes `seasonId` as an explicit
 *    function argument (worker packet Known Context/Traps #4), never reads
 *    it from a hook or global. `ReportsShell.tsx` (T091, forbidden/read-only)
 *    already resolves the real active season and threads it down as a
 *    prop to all three tabs; this file is not imported by (and does not
 *    import) `useActiveSeason`/`loadActiveSeason` anywhere (grep-provable),
 *    per the worker packet's explicit instruction.
 *
 * -----------------------------------------------------------------------
 * 4. `events.team_ids` -- investigated per worker packet Known Context/
 *    Traps #3, decision: NONE of the three loaders below filter by team at
 *    all.
 *
 * Re-reading each page's own module doc (all three forbidden/read-only
 * files here) before writing any query: `ParticipationTab.tsx`'s own
 * `v_student_participation` already performs the per-student
 * team/`team_ids` reconciliation INSIDE the SQL view itself (the view's own
 * `join events e on ... (e.team_ids is null or s.team_id = any(e.team_ids))`
 * clause, cited in that file's own module doc #1) -- this loader only reads
 * the view's already-computed output, so it never needs to re-apply that
 * join. `HoursTab.tsx`'s own module doc #2 states `HoursEventRow.teamIds`
 * is explicitly "not used for filtering in this file (RPT-03 is a
 * season-wide report, not team-scoped per event)". `EventsTab.tsx`'s own
 * module doc #6 states RPT-04's PRD text names no grouping/filtering
 * dimension at all and the tab renders one flat table of every session.
 * So no `.contains()`/`.or('team_ids.is.null,team_ids.cs.{...}')`-style
 * filter is used anywhere in this file -- each loader queries every
 * `events`/`event_sessions` row for the given season, unfiltered by team,
 * matching each page's own already-established, already-checker-approved
 * scope.
 *
 * -----------------------------------------------------------------------
 * 5. Active-roster scoping (disclosed judgment call, consistent across all
 *    three loaders).
 *
 * `v_student_participation`'s own "expected" CTE requires `s.is_active`
 * (`ParticipationTab.tsx`'s own module doc #1, `where s.is_active` cited
 * verbatim from the migration) -- an inactive student can NEVER have a row
 * in that view. `queryParticipationStudents`/`queryHoursStudents` below
 * both therefore query `students` with `.eq('is_active', true)`: including
 * an inactive student in the roster list would produce a row with every
 * metric field null/0 that LOOKS like "no completed sessions yet" (a
 * legitimate, meaningful state for an active student) but is actually just
 * "this student is deactivated and was never eligible for this view's
 * domain in the first place" -- a materially different, misleading
 * situation the packet's own null-vs-absent discipline (Known Context/
 * Traps #5) is meant to guard against. `HoursTab.tsx`'s own
 * `v_student_hours` view has no equivalent `is_active` gate in its own SQL,
 * but this loader applies the same `is_active` roster filter to it anyway
 * for consistency with `ParticipationTab`'s real view-domain boundary and
 * with this exact report screen's own purpose (a CURRENT-roster hours
 * report) -- flagged here as a disclosed, defensible-but-not-forced choice,
 * not an SQL-mandated one, in case a future task's own investigation
 * decides differently. `EventsTab.tsx`'s own rows are per-SESSION, not
 * per-student, so no analogous roster filter applies there at all.
 *
 * -----------------------------------------------------------------------
 * 6. Empty `.in(...)` guard -- `event_ids`/`session_ids` arrays are checked
 *    for `.length > 0` before every `.in('event_id'|'session_id', ids)`
 *    query below (never calling `.in(...)` with an empty array) -- a season
 *    with zero events, or zero event sessions, short-circuits straight to
 *    an empty raw-row array without an extra network round-trip, and avoids
 *    relying on Postgrest's own (unspecified-by-this-task) behavior for an
 *    empty `IN ()` list.
 *
 * -----------------------------------------------------------------------
 * 7. RLS (read-only finding, consistent with `ParticipationTab.tsx`'s own
 *    module doc #2, not re-derived independently here).
 *
 * `students`/`teams`/`seasons`/`events`/`event_sessions`/`attendance`/
 * `rsvps` (`supabase/migrations/20260717000002_rls.sql`, read-only
 * reference) each carry a `staff_all` policy granting `admin`/`coach` full
 * read access; `v_student_participation`/`v_student_hours` are plain views
 * over `students`/`attendance`/`event_sessions`/`events` with no
 * `security_definer`/`security_barrier` clause, so they run with the
 * querying user's own RLS-scoped permissions against those base tables
 * (same finding `ParticipationTab.tsx`'s own module doc #2 already made in
 * full). `ReportsShell.tsx` (forbidden/read-only) already restricts
 * `/reports` to `coach`/`admin` via `RequireRole`, so every session reaching
 * any loader below is genuinely staff -- a real empty result from any query
 * here is "none exist yet for this season", not an RLS-caused false-empty.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { createLoader, type LoaderQueryResult } from '../loader';
import { getSupabaseClient } from '../client';
import type {
  AttendanceStatus as SharedAttendanceStatus,
  EventSessionStatus as SharedEventSessionStatus,
  EventType as SharedEventType,
  RsvpStatus as SharedRsvpStatus,
} from '../types';
import {
  buildDisplayRows as buildParticipationDisplayRows,
  type LoadParticipationDataFn,
  type ParticipationDisplayRow,
  type ParticipationMetricRow,
} from '../../../pages/reports/ParticipationTab';
import type {
  HoursEventRow,
  HoursLoadResult,
  HoursMetricRow,
  HoursRsvpRow,
  HoursSessionRow,
  HoursStudentFixture,
  HoursTeamFixture,
  LoadHoursDataFn,
} from '../../../pages/reports/HoursTab';
import {
  buildDisplayRows as buildEventSessionDisplayRows,
  type EventSessionDisplayRow,
  type FixtureAttendanceRow,
  type FixtureEvent,
  type FixtureRsvpRow,
  type FixtureSession,
  type LoadEventSessionsDataFn,
} from '../../../pages/reports/EventsTab';

// ---------------------------------------------------------------------------
// Participation (RPT-02) -- module doc #1/#2.
// ---------------------------------------------------------------------------

/** Raw `public.students` row, minimal columns (`id`/`display_name`/
 * `team_id`) -- see `../types.ts`'s own `StudentRow` doc comment for the
 * full column citation, not re-cited here. */
interface ParticipationStudentDbRow {
  id: string;
  display_name: string;
  team_id: string;
}

/** Raw `public.teams` row, minimal columns (`id`/`name`). */
interface ReportsTeamDbRow {
  id: string;
  name: string;
}

/** Raw `v_student_participation` row -- verbatim column set, already cited
 * in full in `../types.ts`'s own `VStudentParticipationRow` doc comment. */
interface VStudentParticipationDbRow {
  student_id: string;
  team_id: string;
  season_id: string;
  expected_ct: number;
  present_ct: number;
  late_ct: number;
  excused_ct: number;
  participation_pct: number;
}

/** Module doc #5: only the currently-active roster, matching
 * `v_student_participation`'s own `where s.is_active` domain. */
async function queryParticipationStudents(
  client: SupabaseClient,
): Promise<LoaderQueryResult<ParticipationStudentDbRow[]>> {
  const result = await client
    .from('students')
    .select('id, display_name, team_id')
    .eq('is_active', true)
    .order('display_name', { ascending: true });
  return { data: (result.data as ParticipationStudentDbRow[] | null) ?? null, error: result.error };
}

async function queryReportsTeams(
  client: SupabaseClient,
): Promise<LoaderQueryResult<ReportsTeamDbRow[]>> {
  const result = await client.from('teams').select('id, name').order('name', { ascending: true });
  return { data: (result.data as ReportsTeamDbRow[] | null) ?? null, error: result.error };
}

/** Module doc #3: `seasonId`-scoped. Module doc #1: no arithmetic touches
 * this query's own result -- see `mapParticipationMetricDbRowToMetricRow`. */
async function queryParticipationMetrics(
  client: SupabaseClient,
  seasonId: string,
): Promise<LoaderQueryResult<VStudentParticipationDbRow[]>> {
  const result = await client
    .from('v_student_participation')
    .select(
      'student_id, team_id, season_id, expected_ct, present_ct, late_ct, excused_ct, participation_pct',
    )
    .eq('season_id', seasonId);
  return {
    data: (result.data as VStudentParticipationDbRow[] | null) ?? null,
    error: result.error,
  };
}

/** Verbatim rename only -- module doc #1. `buildParticipationDisplayRows`'s
 * own `FixtureStudent` parameter type (`ParticipationTab.tsx`, not exported
 * by name) is satisfied structurally by this return shape. */
function mapParticipationStudentDbRowToFixture(row: ParticipationStudentDbRow): {
  id: string;
  name: string;
  teamId: string;
} {
  return { id: row.id, name: row.display_name, teamId: row.team_id };
}

function mapReportsTeamDbRowToFixture(row: ReportsTeamDbRow): { id: string; name: string } {
  return { id: row.id, name: row.name };
}

/** Verbatim camelCase rename of the view's own seven columns -- module doc
 * #1. No arithmetic anywhere in this function. */
function mapParticipationMetricDbRowToMetricRow(
  row: VStudentParticipationDbRow,
): ParticipationMetricRow {
  return {
    studentId: row.student_id,
    teamId: row.team_id,
    seasonId: row.season_id,
    expectedCt: row.expected_ct,
    presentCt: row.present_ct,
    lateCt: row.late_ct,
    excusedCt: row.excused_ct,
    participationPct: row.participation_pct,
  };
}

/**
 * `getClient` is injectable (defaults to the shared singleton), same
 * convention every other file in this directory already established, so
 * tests can supply a stubbed transport with zero real network calls.
 */
export function makeLoadParticipationData(
  getClient: () => SupabaseClient = getSupabaseClient,
): LoadParticipationDataFn {
  const loadStudents = createLoader<void, ParticipationStudentDbRow[]>(
    queryParticipationStudents,
    getClient,
  );
  const loadTeams = createLoader<void, ReportsTeamDbRow[]>(queryReportsTeams, getClient);
  const loadMetrics = createLoader<string, VStudentParticipationDbRow[]>(
    queryParticipationMetrics,
    getClient,
  );
  return async (seasonId: string): Promise<ParticipationDisplayRow[]> => {
    const [studentRows, teamRows, metricRows] = await Promise.all([
      loadStudents(),
      loadTeams(),
      loadMetrics(seasonId),
    ]);
    const students = (studentRows ?? []).map(mapParticipationStudentDbRowToFixture);
    const teams = (teamRows ?? []).map(mapReportsTeamDbRowToFixture);
    const metrics = (metricRows ?? []).map(mapParticipationMetricDbRowToMetricRow);
    return buildParticipationDisplayRows(students, teams, metrics);
  };
}

/** `ParticipationTab.tsx`'s real default `loadData`. */
export const loadParticipationData: LoadParticipationDataFn = makeLoadParticipationData();

// ---------------------------------------------------------------------------
// Hours (RPT-03) -- module doc #1/#2.
// ---------------------------------------------------------------------------

/** Raw `public.seasons` row, minimal columns. */
interface HoursSeasonDbRow {
  default_goal_hours: number;
}

/** Raw `public.students` row, minimal columns. */
interface HoursStudentDbRow {
  id: string;
  display_name: string;
  team_id: string;
  goal_hours_override: number | null;
}

/** Raw `v_student_hours` row -- verbatim column set, already cited in full
 * in `../types.ts`'s own `VStudentHoursRow` doc comment. */
interface VStudentHoursDbRow {
  student_id: string;
  season_id: string;
  confirmed_hours: number;
}

/** Raw `public.events` row, minimal columns for the Hours tab. */
interface HoursEventDbRow {
  id: string;
  season_id: string;
  type: SharedEventType;
  team_ids: string[] | null;
  counts_volunteer_hours: boolean;
  adult_volunteers_count: number;
  adult_volunteer_hours: number;
}

/** Raw `public.event_sessions` row, minimal columns for the Hours tab. */
interface HoursSessionDbRow {
  id: string;
  event_id: string;
  starts_at: string;
  ends_at: string;
  status: SharedEventSessionStatus;
  people_reached: number | null;
}

/** Raw `public.rsvps` row, minimal columns for the Hours tab. */
interface HoursRsvpDbRow {
  id: string;
  session_id: string;
  student_id: string;
  status: SharedRsvpStatus;
}

async function queryHoursSeasonGoal(
  client: SupabaseClient,
  seasonId: string,
): Promise<LoaderQueryResult<HoursSeasonDbRow>> {
  const result = await client
    .from('seasons')
    .select('default_goal_hours')
    .eq('id', seasonId)
    .maybeSingle();
  return { data: (result.data as HoursSeasonDbRow | null) ?? null, error: result.error };
}

/** Module doc #5: only the currently-active roster (disclosed consistency
 * choice, not an SQL-mandated one for this particular view). */
async function queryHoursStudents(
  client: SupabaseClient,
): Promise<LoaderQueryResult<HoursStudentDbRow[]>> {
  const result = await client
    .from('students')
    .select('id, display_name, team_id, goal_hours_override')
    .eq('is_active', true)
    .order('display_name', { ascending: true });
  return { data: (result.data as HoursStudentDbRow[] | null) ?? null, error: result.error };
}

async function queryHoursStudentHours(
  client: SupabaseClient,
  seasonId: string,
): Promise<LoaderQueryResult<VStudentHoursDbRow[]>> {
  const result = await client
    .from('v_student_hours')
    .select('student_id, season_id, confirmed_hours')
    .eq('season_id', seasonId);
  return { data: (result.data as VStudentHoursDbRow[] | null) ?? null, error: result.error };
}

async function queryHoursEvents(
  client: SupabaseClient,
  seasonId: string,
): Promise<LoaderQueryResult<HoursEventDbRow[]>> {
  const result = await client
    .from('events')
    .select(
      'id, season_id, type, team_ids, counts_volunteer_hours, adult_volunteers_count, adult_volunteer_hours',
    )
    .eq('season_id', seasonId);
  return { data: (result.data as HoursEventDbRow[] | null) ?? null, error: result.error };
}

/** Module doc #6: only ever called with a non-empty `eventIds`. */
async function queryHoursSessions(
  client: SupabaseClient,
  eventIds: readonly string[],
): Promise<LoaderQueryResult<HoursSessionDbRow[]>> {
  const result = await client
    .from('event_sessions')
    .select('id, event_id, starts_at, ends_at, status, people_reached')
    .in('event_id', eventIds as string[]);
  return { data: (result.data as HoursSessionDbRow[] | null) ?? null, error: result.error };
}

/** Module doc #6: only ever called with a non-empty `sessionIds`. */
async function queryHoursRsvps(
  client: SupabaseClient,
  sessionIds: readonly string[],
): Promise<LoaderQueryResult<HoursRsvpDbRow[]>> {
  const result = await client
    .from('rsvps')
    .select('id, session_id, student_id, status')
    .in('session_id', sessionIds as string[]);
  return { data: (result.data as HoursRsvpDbRow[] | null) ?? null, error: result.error };
}

function mapHoursStudentDbRowToFixture(row: HoursStudentDbRow): HoursStudentFixture {
  return {
    id: row.id,
    name: row.display_name,
    teamId: row.team_id,
    goalHoursOverride: row.goal_hours_override,
  };
}

function mapHoursTeamDbRowToFixture(row: ReportsTeamDbRow): HoursTeamFixture {
  return { id: row.id, name: row.name };
}

/** Verbatim rename of `v_student_hours`'s three real columns -- module doc
 * #1. No arithmetic anywhere in this function. */
function mapStudentHoursDbRowToMetricRow(row: VStudentHoursDbRow): HoursMetricRow {
  return {
    studentId: row.student_id,
    seasonId: row.season_id,
    confirmedHours: row.confirmed_hours,
  };
}

function mapHoursEventDbRowToEventRow(row: HoursEventDbRow): HoursEventRow {
  return {
    id: row.id,
    seasonId: row.season_id,
    type: row.type,
    teamIds: row.team_ids,
    countsVolunteerHours: row.counts_volunteer_hours,
    adultVolunteersCount: row.adult_volunteers_count,
    adultVolunteerHours: row.adult_volunteer_hours,
  };
}

function mapHoursSessionDbRowToSessionRow(row: HoursSessionDbRow): HoursSessionRow {
  return {
    id: row.id,
    eventId: row.event_id,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    status: row.status,
    peopleReached: row.people_reached,
  };
}

function mapHoursRsvpDbRowToRsvpRow(row: HoursRsvpDbRow): HoursRsvpRow {
  return { id: row.id, sessionId: row.session_id, studentId: row.student_id, status: row.status };
}

/**
 * `getClient` is injectable, same convention as every other loader in this
 * directory. Sequential dependency (module doc #2): `events` must resolve
 * before `event_sessions` (needs `eventIds`), which must resolve before
 * `rsvps` (needs `sessionIds`) -- the other four queries (`seasons`,
 * `students`, `teams`, `v_student_hours`) have no such dependency and are
 * issued together via `Promise.all`.
 */
export function makeLoadHoursData(
  getClient: () => SupabaseClient = getSupabaseClient,
): LoadHoursDataFn {
  const loadSeasonGoal = createLoader<string, HoursSeasonDbRow>(queryHoursSeasonGoal, getClient);
  const loadStudents = createLoader<void, HoursStudentDbRow[]>(queryHoursStudents, getClient);
  const loadTeams = createLoader<void, ReportsTeamDbRow[]>(queryReportsTeams, getClient);
  const loadStudentHours = createLoader<string, VStudentHoursDbRow[]>(
    queryHoursStudentHours,
    getClient,
  );
  const loadEvents = createLoader<string, HoursEventDbRow[]>(queryHoursEvents, getClient);
  const loadSessions = createLoader<readonly string[], HoursSessionDbRow[]>(
    queryHoursSessions,
    getClient,
  );
  const loadRsvps = createLoader<readonly string[], HoursRsvpDbRow[]>(queryHoursRsvps, getClient);

  return async (seasonId: string): Promise<HoursLoadResult> => {
    const [seasonGoalRow, studentRows, teamRows, studentHoursRows, eventRows] = await Promise.all([
      loadSeasonGoal(seasonId),
      loadStudents(),
      loadTeams(),
      loadStudentHours(seasonId),
      loadEvents(seasonId),
    ]);

    const events = (eventRows ?? []).map(mapHoursEventDbRowToEventRow);
    const eventIds = events.map((event) => event.id);
    const sessionRows = eventIds.length > 0 ? await loadSessions(eventIds) : null;
    const sessions = (sessionRows ?? []).map(mapHoursSessionDbRowToSessionRow);
    const sessionIds = sessions.map((session) => session.id);
    const rsvpRows = sessionIds.length > 0 ? await loadRsvps(sessionIds) : null;
    const rsvps = (rsvpRows ?? []).map(mapHoursRsvpDbRowToRsvpRow);

    return {
      seasonId,
      // Module doc #1/constitution item 3: `defaultGoalHours` is a
      // verbatim `seasons.default_goal_hours` copy, never re-derived. A
      // missing season row (should not happen -- `ReportsShell.tsx` only
      // ever supplies a real active season id) falls back to `0` rather
      // than throwing, so a stale/unknown `seasonId` degrades to an
      // honest zero-goal report instead of crashing the whole tab.
      defaultGoalHours: seasonGoalRow?.default_goal_hours ?? 0,
      students: (studentRows ?? []).map(mapHoursStudentDbRowToFixture),
      teams: (teamRows ?? []).map(mapHoursTeamDbRowToFixture),
      studentHours: (studentHoursRows ?? []).map(mapStudentHoursDbRowToMetricRow),
      events,
      sessions,
      rsvps,
    };
  };
}

/** `HoursTab.tsx`'s real default `loadData`. */
export const loadHoursData: LoadHoursDataFn = makeLoadHoursData();

// ---------------------------------------------------------------------------
// Events (RPT-04) -- module doc #1/#2.
// ---------------------------------------------------------------------------

/** Raw `public.events` row, minimal columns for the Events tab. */
interface EventsEventDbRow {
  id: string;
  season_id: string;
  type: SharedEventType;
  title: string;
  counts_volunteer_hours: boolean;
  adult_volunteers_count: number;
  adult_volunteer_hours: number;
}

/** Raw `public.event_sessions` row, minimal columns for the Events tab --
 * ALL statuses (no `.eq('status', ...)` filter anywhere below), matching
 * T058's already-Passed "all session statuses" design (worker packet
 * acceptance criteria). */
interface EventsSessionDbRow {
  id: string;
  event_id: string;
  session_date: string;
  starts_at: string;
  ends_at: string;
  status: SharedEventSessionStatus;
  people_reached: number | null;
}

/** Raw `public.attendance` row, minimal columns for the Events tab. */
interface EventsAttendanceDbRow {
  session_id: string;
  student_id: string;
  status: SharedAttendanceStatus;
  check_in_at: string | null;
  check_out_at: string | null;
  hours_override: number | null;
}

/** Raw `public.rsvps` row, minimal columns for the Events tab. */
interface EventsRsvpDbRow {
  session_id: string;
  student_id: string;
  status: SharedRsvpStatus;
}

async function queryEventsEvents(
  client: SupabaseClient,
  seasonId: string,
): Promise<LoaderQueryResult<EventsEventDbRow[]>> {
  const result = await client
    .from('events')
    .select(
      'id, season_id, type, title, counts_volunteer_hours, adult_volunteers_count, adult_volunteer_hours',
    )
    .eq('season_id', seasonId);
  return { data: (result.data as EventsEventDbRow[] | null) ?? null, error: result.error };
}

/** Module doc #6: only ever called with a non-empty `eventIds`. All
 * statuses returned -- no `.eq('status', ...)` filter (module doc above). */
async function queryEventsSessions(
  client: SupabaseClient,
  eventIds: readonly string[],
): Promise<LoaderQueryResult<EventsSessionDbRow[]>> {
  const result = await client
    .from('event_sessions')
    .select('id, event_id, session_date, starts_at, ends_at, status, people_reached')
    .in('event_id', eventIds as string[]);
  return { data: (result.data as EventsSessionDbRow[] | null) ?? null, error: result.error };
}

/** Module doc #6: only ever called with a non-empty `sessionIds`. */
async function queryEventsAttendance(
  client: SupabaseClient,
  sessionIds: readonly string[],
): Promise<LoaderQueryResult<EventsAttendanceDbRow[]>> {
  const result = await client
    .from('attendance')
    .select('session_id, student_id, status, check_in_at, check_out_at, hours_override')
    .in('session_id', sessionIds as string[]);
  return { data: (result.data as EventsAttendanceDbRow[] | null) ?? null, error: result.error };
}

/** Module doc #6: only ever called with a non-empty `sessionIds`. */
async function queryEventsRsvps(
  client: SupabaseClient,
  sessionIds: readonly string[],
): Promise<LoaderQueryResult<EventsRsvpDbRow[]>> {
  const result = await client
    .from('rsvps')
    .select('session_id, student_id, status')
    .in('session_id', sessionIds as string[]);
  return { data: (result.data as EventsRsvpDbRow[] | null) ?? null, error: result.error };
}

function mapEventsEventDbRowToFixture(row: EventsEventDbRow): FixtureEvent {
  return {
    id: row.id,
    seasonId: row.season_id,
    type: row.type,
    title: row.title,
    countsVolunteerHours: row.counts_volunteer_hours,
    adultVolunteersCount: row.adult_volunteers_count,
    adultVolunteerHours: row.adult_volunteer_hours,
  };
}

function mapEventsSessionDbRowToFixture(row: EventsSessionDbRow): FixtureSession {
  return {
    id: row.id,
    eventId: row.event_id,
    sessionDate: row.session_date,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    status: row.status,
    peopleReached: row.people_reached,
  };
}

function mapEventsAttendanceDbRowToFixture(row: EventsAttendanceDbRow): FixtureAttendanceRow {
  return {
    sessionId: row.session_id,
    studentId: row.student_id,
    status: row.status,
    checkInAt: row.check_in_at,
    checkOutAt: row.check_out_at,
    hoursOverride: row.hours_override,
  };
}

function mapEventsRsvpDbRowToFixture(row: EventsRsvpDbRow): FixtureRsvpRow {
  return { sessionId: row.session_id, studentId: row.student_id, status: row.status };
}

/**
 * `getClient` is injectable, same convention as every other loader in this
 * directory. Sequential dependency (module doc #2, same shape as
 * `makeLoadHoursData` above): `events` must resolve before `event_sessions`
 * (needs `eventIds`), which must resolve before `attendance`/`rsvps` (need
 * `sessionIds`, fetched together via `Promise.all` once known).
 */
export function makeLoadEventSessionsData(
  getClient: () => SupabaseClient = getSupabaseClient,
): LoadEventSessionsDataFn {
  const loadEvents = createLoader<string, EventsEventDbRow[]>(queryEventsEvents, getClient);
  const loadSessions = createLoader<readonly string[], EventsSessionDbRow[]>(
    queryEventsSessions,
    getClient,
  );
  const loadAttendance = createLoader<readonly string[], EventsAttendanceDbRow[]>(
    queryEventsAttendance,
    getClient,
  );
  const loadRsvps = createLoader<readonly string[], EventsRsvpDbRow[]>(queryEventsRsvps, getClient);

  return async (seasonId: string): Promise<EventSessionDisplayRow[]> => {
    const eventRows = await loadEvents(seasonId);
    const events = (eventRows ?? []).map(mapEventsEventDbRowToFixture);
    const eventIds = events.map((event) => event.id);

    const sessionRows = eventIds.length > 0 ? await loadSessions(eventIds) : null;
    const sessions = (sessionRows ?? []).map(mapEventsSessionDbRowToFixture);
    const sessionIds = sessions.map((session) => session.id);

    const [attendanceRows, rsvpRows] =
      sessionIds.length > 0
        ? await Promise.all([loadAttendance(sessionIds), loadRsvps(sessionIds)])
        : [null, null];
    const attendance = (attendanceRows ?? []).map(mapEventsAttendanceDbRowToFixture);
    const rsvps = (rsvpRows ?? []).map(mapEventsRsvpDbRowToFixture);

    return buildEventSessionDisplayRows(events, sessions, attendance, rsvps);
  };
}

/** `EventsTab.tsx`'s real default `loadData`. */
export const loadEventSessionsData: LoadEventSessionsDataFn = makeLoadEventSessionsData();
