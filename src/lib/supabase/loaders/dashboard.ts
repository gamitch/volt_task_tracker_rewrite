/**
 * T124 (PRD v2 UXP-06/UXP-10, UXD-07 "Dashboard analytics parity"): real
 * data-layer wiring for `CoachHome.tsx`'s new secondary stat tiles,
 * per-student goal projection, hours-by-team, top-events-by-hours, and the
 * raw rows the activity feed is built from. Built on T086's
 * `createLoader`/`../loader.ts` (read-only import), the same DI
 * (`getClient`) convention every prior loader module in this directory
 * already established (`loaders/reports.ts`, `loaders/attendance.ts`).
 *
 * -----------------------------------------------------------------------
 * 1. Constitution item 3 (BLOCKER) -- strict passthrough only.
 *
 * Every function below is a `.select(...)` query (grep-provable: no
 * `.insert(`/`.update(`/`.delete(`/`.upsert(` anywhere in this file) whose
 * mapper function performs a VERBATIM camelCase rename of the queried
 * columns and nothing else -- zero arithmetic (`+`/`-`/`*`/`/`, no `round(`,
 * no percentage math) touches any numeric column anywhere in this file. The
 * nine real, formula-computing views this file reads
 * (`supabase/migrations/20260723000001_dashboard_views.sql`, this same
 * task's own migration, cited column-by-column in each map function's own
 * doc comment below) already did that arithmetic in SQL; `CoachHome.tsx`'s
 * own pure functions (sort/slice/percent-of-two-already-real-numbers/format,
 * T044's `Leaderboard.tsx`/this file's own sibling `hoursVsGoalPercent`
 * precedent) do the rest. This file also reads `v_team_hours` (T116,
 * `20260722000000_membership_views.sql`, already built, "unconsumed" per the
 * worker packet) unmodified -- no new view for "hours by team".
 *
 * -----------------------------------------------------------------------
 * 2. Activity feed (UXP-10) -- raw rows only, no new view (Trap #3,
 *    migration's own matching disclosure).
 *
 * `loadActivityFeedSource` below queries `events` -> `event_sessions` ->
 * (`rsvps`, `attendance`) for the given season (the same sequential-
 * dependency chain `loaders/reports.ts`'s own `makeLoadEventSessionsData`
 * already established for this exact table set), plus the full `students`
 * roster (`id`/`display_name`/`profile_id`) for name lookup and the
 * self-vs-staff comparison. `CoachHome.tsx`'s own pure
 * `buildActivityFeed`/`isSelfOriginated` functions do the join, the
 * `responded_by`/`recorded_by` vs. `profile_id` comparison (a plain
 * equality check on two already-fetched ids, not metric math -- see this
 * file's own module doc #1), the created_at-vs-updated_at "was this a
 * change" inference, and the sort/slice/format -- this file supplies only
 * the raw rows.
 *
 * Hard-delete limitation (D-7/T119, disclosed again here per Trap #3):
 * `attendance.ts`'s own `makeRemoveAttendance` (read-only reference) and
 * the event-edit checklist's own RSVP-uncheck path both perform a plain,
 * unconditional DELETE with no history left behind. This file does not
 * attempt to recover that history (no tracking table, per the worker
 * packet's explicit instruction) -- a coach-driven removal is therefore
 * honestly invisible to the feed this file's rows produce, while a
 * student/parent's own self-service RSVP change (`RsvpControl.tsx`/OUT-03,
 * a real status UPDATE, not a delete) remains genuinely feed-visible via
 * that row's own `updated_at`.
 *
 * -----------------------------------------------------------------------
 * 3. Season scoping -- every function below takes `seasonId` as an explicit
 *    argument (`loaders/reports.ts`'s own module doc #3 precedent), never
 *    reads it from a hook or global.
 *
 * -----------------------------------------------------------------------
 * 4. Scope decision carried from the migration (disclosed again here): every
 *    query below is SEASON-scoped only, never team-scoped, with the one
 *    named exception (`v_team_hours`, grouped BY team already). See
 *    `20260723000001_dashboard_views.sql`'s own header comment for the full
 *    reasoning (binding reference figure shows these widgets combined
 *    across the whole program, not filtered to `CoachHome.tsx`'s existing
 *    `PLACEHOLDER_CURRENT_TEAM_ID`-scoped primary KPI grid, which this file
 *    does not touch or read).
 *
 * -----------------------------------------------------------------------
 * 5. Empty `.in(...)` guard -- same discipline `loaders/reports.ts`'s own
 *    module doc #6 already established: `eventIds`/`sessionIds` arrays are
 *    checked for `.length > 0` before every `.in(...)` query below.
 *
 * -----------------------------------------------------------------------
 * 6. RLS -- same finding as the migration's own header comment and
 *    `loaders/reports.ts`'s own module doc #7: none of the nine views this
 *    file reads are `security_definer`, so each runs under the querying
 *    session's own RLS against `students`/`student_teams`/`teams`/
 *    `seasons`/`events`/`event_sessions`/`rsvps`/`attendance`
 *    (`20260717000002_rls.sql`, read-only), all of which already grant
 *    `admin`/`coach` full read via `staff_all`. `CoachHome.tsx` is
 *    coach/admin-only, so a real empty result here means "none exist yet",
 *    not an RLS-caused false-empty.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { createLoader, type LoaderQueryResult } from '../loader';
import { getSupabaseClient } from '../client';

// ---------------------------------------------------------------------------
// Season-wide secondary stat tiles.
// ---------------------------------------------------------------------------

/** `v_season_roster_stats` (migration lines under heading 4) -- verbatim
 * camelCase rename, no arithmetic. */
export interface SeasonRosterStats {
  seasonId: string;
  activeStudentCount: number;
  avgHoursPerActiveStudent: number;
  studentsAtGoalCount: number;
}

interface SeasonRosterStatsDbRow {
  season_id: string;
  active_student_count: number;
  avg_hours_per_active_student: number;
  students_at_goal_count: number;
}

function mapRosterStats(row: SeasonRosterStatsDbRow): SeasonRosterStats {
  return {
    seasonId: row.season_id,
    activeStudentCount: row.active_student_count,
    avgHoursPerActiveStudent: row.avg_hours_per_active_student,
    studentsAtGoalCount: row.students_at_goal_count,
  };
}

/** `v_season_attendance_rate` (migration heading 6) -- verbatim rename. */
export interface SeasonAttendanceRate {
  seasonId: string;
  expectedCt: number;
  presentCt: number;
  attendanceRatePct: number;
}

interface SeasonAttendanceRateDbRow {
  season_id: string;
  expected_ct: number;
  present_ct: number;
  attendance_rate_pct: number;
}

function mapAttendanceRate(row: SeasonAttendanceRateDbRow): SeasonAttendanceRate {
  return {
    seasonId: row.season_id,
    expectedCt: row.expected_ct,
    presentCt: row.present_ct,
    attendanceRatePct: row.attendance_rate_pct,
  };
}

/** `v_season_session_days` (migration heading 5) -- verbatim rename. */
export interface SeasonSessionDays {
  seasonId: string;
  sessionDaysLogged: number;
}

interface SeasonSessionDaysDbRow {
  season_id: string;
  session_days_logged: number;
}

function mapSessionDays(row: SeasonSessionDaysDbRow): SeasonSessionDays {
  return { seasonId: row.season_id, sessionDaysLogged: row.session_days_logged };
}

/** `v_season_upcoming_committed_hours` (migration heading 3) -- verbatim
 * rename. */
export interface SeasonUpcomingCommittedHours {
  seasonId: string;
  committedHours30d: number;
}

interface SeasonUpcomingCommittedHoursDbRow {
  season_id: string;
  committed_hours_30d: number;
}

function mapUpcomingCommittedHours(
  row: SeasonUpcomingCommittedHoursDbRow,
): SeasonUpcomingCommittedHours {
  return { seasonId: row.season_id, committedHours30d: row.committed_hours_30d };
}

/** `v_season_day_of_week_sessions` (migration heading 7) -- verbatim rename.
 * Multiple rows per season (one per day-of-week that has at least one
 * session); `CoachHome.tsx`'s own `pickBusiestDay` sorts/slices this array
 * (T044 precedent) -- no arithmetic here. */
export interface SeasonDayOfWeekSessions {
  seasonId: string;
  /** ISO day-of-week: 1 = Monday .. 7 = Sunday. */
  dayOfWeek: number;
  sessionCount: number;
}

interface SeasonDayOfWeekSessionsDbRow {
  season_id: string;
  day_of_week: number;
  session_count: number;
}

function mapDayOfWeekSessions(row: SeasonDayOfWeekSessionsDbRow): SeasonDayOfWeekSessions {
  return { seasonId: row.season_id, dayOfWeek: row.day_of_week, sessionCount: row.session_count };
}

async function queryRosterStats(
  client: SupabaseClient,
  seasonId: string,
): Promise<LoaderQueryResult<SeasonRosterStatsDbRow>> {
  const result = await client
    .from('v_season_roster_stats')
    .select('season_id, active_student_count, avg_hours_per_active_student, students_at_goal_count')
    .eq('season_id', seasonId)
    .maybeSingle();
  return { data: (result.data as SeasonRosterStatsDbRow | null) ?? null, error: result.error };
}

async function queryAttendanceRate(
  client: SupabaseClient,
  seasonId: string,
): Promise<LoaderQueryResult<SeasonAttendanceRateDbRow>> {
  const result = await client
    .from('v_season_attendance_rate')
    .select('season_id, expected_ct, present_ct, attendance_rate_pct')
    .eq('season_id', seasonId)
    .maybeSingle();
  return { data: (result.data as SeasonAttendanceRateDbRow | null) ?? null, error: result.error };
}

async function querySessionDays(
  client: SupabaseClient,
  seasonId: string,
): Promise<LoaderQueryResult<SeasonSessionDaysDbRow>> {
  const result = await client
    .from('v_season_session_days')
    .select('season_id, session_days_logged')
    .eq('season_id', seasonId)
    .maybeSingle();
  return { data: (result.data as SeasonSessionDaysDbRow | null) ?? null, error: result.error };
}

async function queryUpcomingCommittedHours(
  client: SupabaseClient,
  seasonId: string,
): Promise<LoaderQueryResult<SeasonUpcomingCommittedHoursDbRow>> {
  const result = await client
    .from('v_season_upcoming_committed_hours')
    .select('season_id, committed_hours_30d')
    .eq('season_id', seasonId)
    .maybeSingle();
  return {
    data: (result.data as SeasonUpcomingCommittedHoursDbRow | null) ?? null,
    error: result.error,
  };
}

async function queryDayOfWeekSessions(
  client: SupabaseClient,
  seasonId: string,
): Promise<LoaderQueryResult<SeasonDayOfWeekSessionsDbRow[]>> {
  const result = await client
    .from('v_season_day_of_week_sessions')
    .select('season_id, day_of_week, session_count')
    .eq('season_id', seasonId);
  return {
    data: (result.data as SeasonDayOfWeekSessionsDbRow[] | null) ?? null,
    error: result.error,
  };
}

// ---------------------------------------------------------------------------
// Hours by team -- consumes T116's `v_team_hours` unmodified, joined against
// `teams` for display names.
// ---------------------------------------------------------------------------

export interface TeamHoursEntry {
  teamId: string;
  teamName: string;
  seasonId: string;
  confirmedHours: number;
}

interface TeamHoursDbRow {
  team_id: string;
  season_id: string;
  confirmed_hours: number;
}

interface DashboardTeamDbRow {
  id: string;
  name: string;
}

async function queryTeamHours(
  client: SupabaseClient,
  seasonId: string,
): Promise<LoaderQueryResult<TeamHoursDbRow[]>> {
  const result = await client
    .from('v_team_hours')
    .select('team_id, season_id, confirmed_hours')
    .eq('season_id', seasonId);
  return { data: (result.data as TeamHoursDbRow[] | null) ?? null, error: result.error };
}

async function queryDashboardTeams(
  client: SupabaseClient,
): Promise<LoaderQueryResult<DashboardTeamDbRow[]>> {
  const result = await client.from('teams').select('id, name');
  return { data: (result.data as DashboardTeamDbRow[] | null) ?? null, error: result.error };
}

// ---------------------------------------------------------------------------
// Top events by student hours -- `v_event_student_hours` (migration heading
// 8).
// ---------------------------------------------------------------------------

export interface EventStudentHoursEntry {
  eventId: string;
  seasonId: string;
  title: string;
  startsOn: string;
  endsOn: string;
  studentCount: number;
  totalHours: number;
}

interface EventStudentHoursDbRow {
  event_id: string;
  season_id: string;
  title: string;
  starts_on: string;
  ends_on: string;
  student_count: number;
  total_hours: number;
}

function mapEventStudentHours(row: EventStudentHoursDbRow): EventStudentHoursEntry {
  return {
    eventId: row.event_id,
    seasonId: row.season_id,
    title: row.title,
    startsOn: row.starts_on,
    endsOn: row.ends_on,
    studentCount: row.student_count,
    totalHours: row.total_hours,
  };
}

async function queryTopEvents(
  client: SupabaseClient,
  seasonId: string,
): Promise<LoaderQueryResult<EventStudentHoursDbRow[]>> {
  const result = await client
    .from('v_event_student_hours')
    .select('event_id, season_id, title, starts_on, ends_on, student_count, total_hours')
    .eq('season_id', seasonId);
  return { data: (result.data as EventStudentHoursDbRow[] | null) ?? null, error: result.error };
}

// ---------------------------------------------------------------------------
// Per-student goal projection -- `v_student_goal_projection` (migration
// heading 9), joined against `students`/`teams` for display name/team name.
// ---------------------------------------------------------------------------

export interface StudentGoalProjectionEntry {
  studentId: string;
  seasonId: string;
  displayName: string;
  teamId: string;
  teamName: string;
  goalHours: number;
  confirmedHours: number;
  plannedHours: number;
}

interface StudentGoalProjectionDbRow {
  student_id: string;
  season_id: string;
  team_id: string;
  goal_hours: number;
  confirmed_hours: number;
  planned_hours: number;
}

interface DashboardStudentDbRow {
  id: string;
  display_name: string;
}

async function queryGoalProjection(
  client: SupabaseClient,
  seasonId: string,
): Promise<LoaderQueryResult<StudentGoalProjectionDbRow[]>> {
  const result = await client
    .from('v_student_goal_projection')
    .select('student_id, season_id, team_id, goal_hours, confirmed_hours, planned_hours')
    .eq('season_id', seasonId);
  return {
    data: (result.data as StudentGoalProjectionDbRow[] | null) ?? null,
    error: result.error,
  };
}

async function queryDashboardStudents(
  client: SupabaseClient,
): Promise<LoaderQueryResult<DashboardStudentDbRow[]>> {
  const result = await client.from('students').select('id, display_name');
  return { data: (result.data as DashboardStudentDbRow[] | null) ?? null, error: result.error };
}

// ---------------------------------------------------------------------------
// Activity feed raw source rows -- module doc #2. Raw table rows only, no
// new view; `CoachHome.tsx`'s own pure functions build the feed.
// ---------------------------------------------------------------------------

export type FeedRsvpStatus = 'going' | 'maybe' | 'declined';
export type FeedAttendanceStatus = 'present' | 'late' | 'excused' | 'absent';

export interface FeedRsvpRow {
  id: string;
  sessionId: string;
  studentId: string;
  status: FeedRsvpStatus;
  respondedBy: string | null;
  updatedAt: string;
  createdAt: string;
}

interface FeedRsvpDbRow {
  id: string;
  session_id: string;
  student_id: string;
  status: FeedRsvpStatus;
  responded_by: string | null;
  updated_at: string;
  created_at: string;
}

export interface FeedAttendanceRow {
  id: string;
  sessionId: string;
  studentId: string;
  status: FeedAttendanceStatus;
  recordedBy: string | null;
  updatedAt: string;
  createdAt: string;
}

interface FeedAttendanceDbRow {
  id: string;
  session_id: string;
  student_id: string;
  status: FeedAttendanceStatus;
  recorded_by: string | null;
  updated_at: string;
  created_at: string;
}

export interface FeedSessionRow {
  id: string;
  eventId: string;
  sessionDate: string;
  startsAt: string;
}

interface FeedSessionDbRow {
  id: string;
  event_id: string;
  session_date: string;
  starts_at: string;
}

export type FeedEventType = 'meeting' | 'outreach' | 'competition';

export interface FeedEventRow {
  id: string;
  seasonId: string;
  title: string;
  type: FeedEventType;
}

interface FeedEventDbRow {
  id: string;
  season_id: string;
  title: string;
  type: FeedEventType;
}

export interface FeedProfileStudentRow {
  id: string;
  displayName: string;
  profileId: string | null;
}

interface FeedProfileStudentDbRow {
  id: string;
  display_name: string;
  profile_id: string | null;
}

export interface ActivityFeedSource {
  events: readonly FeedEventRow[];
  sessions: readonly FeedSessionRow[];
  rsvps: readonly FeedRsvpRow[];
  attendance: readonly FeedAttendanceRow[];
  students: readonly FeedProfileStudentRow[];
}

async function queryFeedEvents(
  client: SupabaseClient,
  seasonId: string,
): Promise<LoaderQueryResult<FeedEventDbRow[]>> {
  const result = await client
    .from('events')
    .select('id, season_id, title, type')
    .eq('season_id', seasonId);
  return { data: (result.data as FeedEventDbRow[] | null) ?? null, error: result.error };
}

async function queryFeedSessions(
  client: SupabaseClient,
  eventIds: readonly string[],
): Promise<LoaderQueryResult<FeedSessionDbRow[]>> {
  const result = await client
    .from('event_sessions')
    .select('id, event_id, session_date, starts_at')
    .in('event_id', eventIds as string[]);
  return { data: (result.data as FeedSessionDbRow[] | null) ?? null, error: result.error };
}

async function queryFeedRsvps(
  client: SupabaseClient,
  sessionIds: readonly string[],
): Promise<LoaderQueryResult<FeedRsvpDbRow[]>> {
  const result = await client
    .from('rsvps')
    .select('id, session_id, student_id, status, responded_by, updated_at, created_at')
    .in('session_id', sessionIds as string[]);
  return { data: (result.data as FeedRsvpDbRow[] | null) ?? null, error: result.error };
}

async function queryFeedAttendance(
  client: SupabaseClient,
  sessionIds: readonly string[],
): Promise<LoaderQueryResult<FeedAttendanceDbRow[]>> {
  const result = await client
    .from('attendance')
    .select('id, session_id, student_id, status, recorded_by, updated_at, created_at')
    .in('session_id', sessionIds as string[]);
  return { data: (result.data as FeedAttendanceDbRow[] | null) ?? null, error: result.error };
}

async function queryFeedStudents(
  client: SupabaseClient,
): Promise<LoaderQueryResult<FeedProfileStudentDbRow[]>> {
  const result = await client.from('students').select('id, display_name, profile_id');
  return { data: (result.data as FeedProfileStudentDbRow[] | null) ?? null, error: result.error };
}

function mapFeedEvent(row: FeedEventDbRow): FeedEventRow {
  return { id: row.id, seasonId: row.season_id, title: row.title, type: row.type };
}

function mapFeedSession(row: FeedSessionDbRow): FeedSessionRow {
  return {
    id: row.id,
    eventId: row.event_id,
    sessionDate: row.session_date,
    startsAt: row.starts_at,
  };
}

function mapFeedRsvp(row: FeedRsvpDbRow): FeedRsvpRow {
  return {
    id: row.id,
    sessionId: row.session_id,
    studentId: row.student_id,
    status: row.status,
    respondedBy: row.responded_by,
    updatedAt: row.updated_at,
    createdAt: row.created_at,
  };
}

function mapFeedAttendance(row: FeedAttendanceDbRow): FeedAttendanceRow {
  return {
    id: row.id,
    sessionId: row.session_id,
    studentId: row.student_id,
    status: row.status,
    recordedBy: row.recorded_by,
    updatedAt: row.updated_at,
    createdAt: row.created_at,
  };
}

function mapFeedStudent(row: FeedProfileStudentDbRow): FeedProfileStudentRow {
  return { id: row.id, displayName: row.display_name, profileId: row.profile_id };
}

// ---------------------------------------------------------------------------
// Combined result + `makeLoadDashboardData` -- module doc #3, mirrors
// `loaders/reports.ts`'s `makeLoadHoursData` sequential-dependency shape
// (independent queries via `Promise.all`, then the events -> sessions ->
// rsvps/attendance chain).
// ---------------------------------------------------------------------------

export interface DashboardData {
  seasonId: string;
  rosterStats: SeasonRosterStats | null;
  attendanceRate: SeasonAttendanceRate | null;
  sessionDays: SeasonSessionDays | null;
  upcomingCommittedHours: SeasonUpcomingCommittedHours | null;
  dayOfWeekSessions: readonly SeasonDayOfWeekSessions[];
  teamHours: readonly TeamHoursEntry[];
  topEvents: readonly EventStudentHoursEntry[];
  goalProjection: readonly StudentGoalProjectionEntry[];
  activityFeedSource: ActivityFeedSource;
}

export type LoadDashboardDataFn = (seasonId: string) => Promise<DashboardData>;

export function makeLoadDashboardData(
  getClient: () => SupabaseClient = getSupabaseClient,
): LoadDashboardDataFn {
  const loadRosterStats = createLoader<string, SeasonRosterStatsDbRow>(queryRosterStats, getClient);
  const loadAttendanceRate = createLoader<string, SeasonAttendanceRateDbRow>(
    queryAttendanceRate,
    getClient,
  );
  const loadSessionDays = createLoader<string, SeasonSessionDaysDbRow>(querySessionDays, getClient);
  const loadUpcomingCommittedHours = createLoader<string, SeasonUpcomingCommittedHoursDbRow>(
    queryUpcomingCommittedHours,
    getClient,
  );
  const loadDayOfWeekSessions = createLoader<string, SeasonDayOfWeekSessionsDbRow[]>(
    queryDayOfWeekSessions,
    getClient,
  );
  const loadTeamHours = createLoader<string, TeamHoursDbRow[]>(queryTeamHours, getClient);
  const loadDashboardTeams = createLoader<void, DashboardTeamDbRow[]>(
    queryDashboardTeams,
    getClient,
  );
  const loadTopEvents = createLoader<string, EventStudentHoursDbRow[]>(queryTopEvents, getClient);
  const loadGoalProjection = createLoader<string, StudentGoalProjectionDbRow[]>(
    queryGoalProjection,
    getClient,
  );
  const loadDashboardStudents = createLoader<void, DashboardStudentDbRow[]>(
    queryDashboardStudents,
    getClient,
  );
  const loadFeedEvents = createLoader<string, FeedEventDbRow[]>(queryFeedEvents, getClient);
  const loadFeedSessions = createLoader<readonly string[], FeedSessionDbRow[]>(
    queryFeedSessions,
    getClient,
  );
  const loadFeedRsvps = createLoader<readonly string[], FeedRsvpDbRow[]>(queryFeedRsvps, getClient);
  const loadFeedAttendance = createLoader<readonly string[], FeedAttendanceDbRow[]>(
    queryFeedAttendance,
    getClient,
  );
  const loadFeedStudents = createLoader<void, FeedProfileStudentDbRow[]>(
    queryFeedStudents,
    getClient,
  );

  return async (seasonId: string): Promise<DashboardData> => {
    const [
      rosterStatsRow,
      attendanceRateRow,
      sessionDaysRow,
      upcomingCommittedHoursRow,
      dayOfWeekSessionsRows,
      teamHoursRows,
      teamRows,
      topEventsRows,
      goalProjectionRows,
      studentRows,
      feedEventRows,
      feedStudentRows,
    ] = await Promise.all([
      loadRosterStats(seasonId),
      loadAttendanceRate(seasonId),
      loadSessionDays(seasonId),
      loadUpcomingCommittedHours(seasonId),
      loadDayOfWeekSessions(seasonId),
      loadTeamHours(seasonId),
      loadDashboardTeams(),
      loadTopEvents(seasonId),
      loadGoalProjection(seasonId),
      loadDashboardStudents(),
      loadFeedEvents(seasonId),
      loadFeedStudents(),
    ]);

    const teamNameById = new Map((teamRows ?? []).map((team) => [team.id, team.name] as const));
    const studentNameById = new Map(
      (studentRows ?? []).map((student) => [student.id, student.display_name] as const),
    );

    const feedEvents = (feedEventRows ?? []).map(mapFeedEvent);
    const feedEventIds = feedEvents.map((event) => event.id);
    const feedSessionRows = feedEventIds.length > 0 ? await loadFeedSessions(feedEventIds) : null;
    const feedSessions = (feedSessionRows ?? []).map(mapFeedSession);
    const feedSessionIds = feedSessions.map((session) => session.id);
    const [feedRsvpRows, feedAttendanceRows] =
      feedSessionIds.length > 0
        ? await Promise.all([loadFeedRsvps(feedSessionIds), loadFeedAttendance(feedSessionIds)])
        : [null, null];

    return {
      seasonId,
      rosterStats: rosterStatsRow ? mapRosterStats(rosterStatsRow) : null,
      attendanceRate: attendanceRateRow ? mapAttendanceRate(attendanceRateRow) : null,
      sessionDays: sessionDaysRow ? mapSessionDays(sessionDaysRow) : null,
      upcomingCommittedHours: upcomingCommittedHoursRow
        ? mapUpcomingCommittedHours(upcomingCommittedHoursRow)
        : null,
      dayOfWeekSessions: (dayOfWeekSessionsRows ?? []).map(mapDayOfWeekSessions),
      teamHours: (teamHoursRows ?? []).map((row) => ({
        teamId: row.team_id,
        teamName: teamNameById.get(row.team_id) ?? 'Unknown team',
        seasonId: row.season_id,
        confirmedHours: row.confirmed_hours,
      })),
      topEvents: (topEventsRows ?? []).map(mapEventStudentHours),
      goalProjection: (goalProjectionRows ?? []).map((row) => ({
        studentId: row.student_id,
        seasonId: row.season_id,
        displayName: studentNameById.get(row.student_id) ?? 'Unknown student',
        teamId: row.team_id,
        teamName: teamNameById.get(row.team_id) ?? 'Unknown team',
        goalHours: row.goal_hours,
        confirmedHours: row.confirmed_hours,
        plannedHours: row.planned_hours,
      })),
      activityFeedSource: {
        events: feedEvents,
        sessions: feedSessions,
        rsvps: (feedRsvpRows ?? []).map(mapFeedRsvp),
        attendance: (feedAttendanceRows ?? []).map(mapFeedAttendance),
        students: (feedStudentRows ?? []).map(mapFeedStudent),
      },
    };
  };
}

/** `CoachHome.tsx`'s real default `loadDashboardData`. */
export const loadDashboardData: LoadDashboardDataFn = makeLoadDashboardData();
