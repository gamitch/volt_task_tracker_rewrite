/**
 * T123: UXD-01/UXP-05 -- real data-layer wiring for `KpiStrip.tsx`, the
 * persistent staff KPI strip. Reads ONLY the two new additive views this
 * task's own migration creates
 * (`supabase/migrations/20260723000000_kpi_views.sql`):
 * `v_season_kpis` (one row per season -- hours+breakdown, events
 * logged+most recent, goal target+percent, roster-wide active headcount)
 * and `v_season_kpi_team_counts` (one row per non-archived team -- D-3
 * membership-based double-count active-student headcount). See that
 * migration file's own extensive header comment for the full formula
 * investigation/decision trail (goal-target semantics, the
 * meetings/outreach/competition breakdown formula, the D-3 team-count
 * double-count reasoning) -- not repeated here.
 *
 * -----------------------------------------------------------------------
 * Constitution item 3 -- strict passthrough only, same discipline
 * `loaders/reports.ts`/`loaders/seasons.ts` already established for this
 * `loaders/` directory: every function below that touches a raw DB row is a
 * verbatim snake_case -> camelCase rename, with NO arithmetic performed on
 * any of `total_hours`/`meeting_hours`/`outreach_hours`/`competition_hours`/
 * `events_logged_count`/`active_students_count`/`goal_target_hours`/
 * `goal_pct` anywhere in this file (grep-provable: no `+`/`-`/`*`/`/`
 * operator touches any of those fields, no `Math.round`/`toFixed`-driven
 * re-derivation of a metric value -- `KpiStrip.tsx`'s own `.toFixed(...)`
 * calls are DISPLAY formatting of an already-final SQL number, the same
 * "presentation, not metric math" distinction `loaders/reports.ts`'s own
 * module doc already drew for `HoursTab.tsx`'s table cells).
 *
 * -----------------------------------------------------------------------
 * Season scoping -- `loadKpiStripData(seasonId)` takes `seasonId` as an
 * explicit function argument (same convention every loader in this
 * directory already uses), never reads it from a hook/global itself.
 * `KpiStrip.tsx` is the one caller, and threads down the real
 * `useActiveSeason()`-resolved id -- this file does not import
 * `useActiveSeason`/`SeasonProvider` at all (grep-provable), matching
 * `loaders/reports.ts`'s own explicit "not season-hook-aware" posture.
 *
 * -----------------------------------------------------------------------
 * Missing-season-row fallback (disclosed, same posture `loaders/
 * reports.ts`'s own `makeLoadHoursData` already established for
 * `seasons.default_goal_hours`): `v_season_kpis` is built as a `left join`
 * chain rooted at `seasons` (this file's own migration), so a real,
 * existing `seasonId` ALWAYS has exactly one row -- but if a stale/deleted
 * season id is ever passed in anyway (should not happen; `KpiStrip.tsx`
 * only ever supplies `useActiveSeason()`'s own real, `'ready'`-state
 * season id), `queryKpisRow` resolves `null` via `.maybeSingle()`, and
 * `makeLoadKpiStripData` degrades to an honest all-zero/all-null
 * `KpiStripData` for that `seasonId` rather than throwing -- the same
 * "degrade to zero instead of crashing the whole strip" choice
 * `makeLoadHoursData` already made for an analogous edge case.
 *
 * -----------------------------------------------------------------------
 * `v_season_kpi_team_counts` is NOT season-scoped (the view's own header
 * comment discloses why: team membership is a current-roster fact under
 * D-2's one-combined-season model, not a per-season one) -- `queryTeam
 * Counts` below therefore takes no `seasonId` argument and simply reads
 * every row, ordered by `team_sort_order` (matching `teams.sort_order`'s
 * own established roster-ordering convention elsewhere in this codebase,
 * e.g. `loaders/reports.ts`'s `queryReportsTeams` orders by `name`, but
 * `teams.sort_order` is the more specific column that exists exactly for
 * this purpose -- `20260716000000_identity_roster.sql`).
 *
 * -----------------------------------------------------------------------
 * RLS (read-only finding, same posture `loaders/reports.ts`'s own module
 * doc #7 already established) -- `v_season_kpis`/`v_season_kpi_team_counts`
 * are plain views with no `security definer`/`security barrier` clause
 * (this task's own migration), so both run under the querying session's own
 * RLS against `seasons`/`attendance`/`event_sessions`/`events`/`students`/
 * `teams`/`student_teams`, every one of which carries a `staff_all`
 * (`is_staff()`) SELECT policy. `KpiStrip.tsx` only ever calls this loader
 * for a session `useAuth()` has already confirmed is `admin`/`coach`
 * (UXD-01's own "staff-only" requirement, enforced in the UI component, not
 * this file) -- so a real empty/zero result from either query here is
 * "genuinely nothing logged yet for this season", not an RLS-caused
 * false-empty.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { createLoader, type LoaderQueryResult } from '../loader';
import { getSupabaseClient } from '../client';

// ---------------------------------------------------------------------------
// Public shapes
// ---------------------------------------------------------------------------

export interface KpiTeamBreakdownRow {
  teamId: string;
  teamName: string;
  activeStudentsCount: number;
}

export interface KpiStripData {
  seasonId: string;
  totalHours: number;
  meetingHours: number;
  outreachHours: number;
  competitionHours: number;
  eventsLoggedCount: number;
  /** `null` when zero completed sessions exist for this season yet
   * (`v_season_kpis.most_recent_event_title` is a plain, nullable `left
   * join` column -- never coalesced to a fabricated placeholder here). */
  mostRecentEventTitle: string | null;
  /** Plain `date` (`YYYY-MM-DD`), or `null` alongside
   * `mostRecentEventTitle`. */
  mostRecentEventDate: string | null;
  /** Season-independent, roster-wide active headcount -- see this file's
   * own module doc above and the migration's header comment for why this
   * one field is not really "season math" despite living on this
   * per-season row. */
  activeStudentsCount: number;
  goalTargetHours: number;
  /** Already rounded to a whole percent by the view (`round(..., 0)`) --
   * never re-rounded here. */
  goalPct: number;
  /** One row per non-archived team, ordered by `teams.sort_order` --
   * D-3's membership-based double-count (a dual-member student appears in
   * every team she currently belongs to). */
  teamBreakdown: KpiTeamBreakdownRow[];
}

export type LoadKpiStripDataFn = (seasonId: string) => Promise<KpiStripData>;

// ---------------------------------------------------------------------------
// Raw DB rows -- verbatim column sets, `v_season_kpis`/
// `v_season_kpi_team_counts` (`supabase/migrations/20260723000000_kpi_views.sql`).
// ---------------------------------------------------------------------------

interface VSeasonKpisDbRow {
  season_id: string;
  total_hours: number;
  meeting_hours: number;
  outreach_hours: number;
  competition_hours: number;
  events_logged_count: number;
  most_recent_event_title: string | null;
  most_recent_event_date: string | null;
  active_students_count: number;
  goal_target_hours: number;
  goal_pct: number;
}

interface VSeasonKpiTeamCountsDbRow {
  team_id: string;
  team_name: string;
  team_sort_order: number;
  active_students_count: number;
}

async function queryKpisRow(
  client: SupabaseClient,
  seasonId: string,
): Promise<LoaderQueryResult<VSeasonKpisDbRow>> {
  const result = await client
    .from('v_season_kpis')
    .select(
      'season_id, total_hours, meeting_hours, outreach_hours, competition_hours, events_logged_count, most_recent_event_title, most_recent_event_date, active_students_count, goal_target_hours, goal_pct',
    )
    .eq('season_id', seasonId)
    .maybeSingle();
  return { data: (result.data as VSeasonKpisDbRow | null) ?? null, error: result.error };
}

async function queryTeamCounts(
  client: SupabaseClient,
): Promise<LoaderQueryResult<VSeasonKpiTeamCountsDbRow[]>> {
  const result = await client
    .from('v_season_kpi_team_counts')
    .select('team_id, team_name, team_sort_order, active_students_count')
    .order('team_sort_order', { ascending: true });
  return { data: (result.data as VSeasonKpiTeamCountsDbRow[] | null) ?? null, error: result.error };
}

function mapTeamCountDbRowToBreakdownRow(row: VSeasonKpiTeamCountsDbRow): KpiTeamBreakdownRow {
  return {
    teamId: row.team_id,
    teamName: row.team_name,
    activeStudentsCount: row.active_students_count,
  };
}

/** Module doc's own "missing-season-row fallback" section above -- an
 * honest all-zero/all-null shape for a `seasonId` that (should not, but
 * theoretically could) have no `v_season_kpis` row. */
function zeroedKpiStripData(seasonId: string, teamBreakdown: KpiTeamBreakdownRow[]): KpiStripData {
  return {
    seasonId,
    totalHours: 0,
    meetingHours: 0,
    outreachHours: 0,
    competitionHours: 0,
    eventsLoggedCount: 0,
    mostRecentEventTitle: null,
    mostRecentEventDate: null,
    activeStudentsCount: 0,
    goalTargetHours: 0,
    goalPct: 0,
    teamBreakdown,
  };
}

/** Verbatim rename of `v_season_kpis`'s columns -- module doc above, no
 * arithmetic anywhere in this function. */
function mapKpisDbRowToKpiStripData(
  row: VSeasonKpisDbRow,
  teamBreakdown: KpiTeamBreakdownRow[],
): KpiStripData {
  return {
    seasonId: row.season_id,
    totalHours: row.total_hours,
    meetingHours: row.meeting_hours,
    outreachHours: row.outreach_hours,
    competitionHours: row.competition_hours,
    eventsLoggedCount: row.events_logged_count,
    mostRecentEventTitle: row.most_recent_event_title,
    mostRecentEventDate: row.most_recent_event_date,
    activeStudentsCount: row.active_students_count,
    goalTargetHours: row.goal_target_hours,
    goalPct: row.goal_pct,
    teamBreakdown,
  };
}

/**
 * `getClient` is injectable (defaults to the shared singleton), same
 * convention every other loader in this directory already established, so
 * tests can supply a stubbed transport with zero real network calls.
 * `v_season_kpis` (season-scoped) and `v_season_kpi_team_counts`
 * (season-independent, module doc above) have no data dependency on each
 * other, so both are fetched together via `Promise.all` -- trap #3's "one
 * fetch per page load" is enforced by `KpiStrip.tsx`'s own effect
 * dependency array (`[seasonId]`, re-running only when the resolved active
 * season id itself changes), not by this loader, which is a plain
 * `(seasonId) => Promise<KpiStripData>` function with no caching of its
 * own -- same shape/division-of-responsibility every other loader in this
 * directory already has relative to its own page's fetch-triggering hook.
 */
export function makeLoadKpiStripData(
  getClient: () => SupabaseClient = getSupabaseClient,
): LoadKpiStripDataFn {
  const loadKpisRow = createLoader<string, VSeasonKpisDbRow>(queryKpisRow, getClient);
  const loadTeamCounts = createLoader<void, VSeasonKpiTeamCountsDbRow[]>(
    queryTeamCounts,
    getClient,
  );

  return async (seasonId: string): Promise<KpiStripData> => {
    const [kpisRow, teamCountRows] = await Promise.all([loadKpisRow(seasonId), loadTeamCounts()]);
    const teamBreakdown = (teamCountRows ?? []).map(mapTeamCountDbRowToBreakdownRow);
    return kpisRow === null
      ? zeroedKpiStripData(seasonId, teamBreakdown)
      : mapKpisDbRowToKpiStripData(kpisRow, teamBreakdown);
  };
}

/** `KpiStrip.tsx`'s own default `loadKpiStripData`. */
export const loadKpiStripData: LoadKpiStripDataFn = makeLoadKpiStripData();
