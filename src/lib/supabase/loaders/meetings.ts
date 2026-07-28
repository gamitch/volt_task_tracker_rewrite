/**
 * T096 (ED-1 Packet P7): real `events`/`event_sessions`/`teams`/`attendance`/
 * `v_student_participation`/`seasons`/`students`/`guardian_links` data-layer
 * wiring for `src/pages/meetings/MeetingsList.tsx` -- the first file in this
 * `loaders/` directory to touch meetings data. Built directly on top of
 * T086's `createLoader`/`runMutation` (`../loader.ts`, read-only import
 * here), same DI (`getClient`) convention every prior `loaders/*.ts` file in
 * this directory already established.
 *
 * -----------------------------------------------------------------------
 * Trap #1 (real load, both views) -- reuse `MeetingsList.tsx`'s own already-
 * tested pure `buildCoachMeetingRows`/`buildStudentMeetingsData` functions,
 * never re-derive their join/filter logic here.
 *
 * `queryEvents`/`querySessions`/`queryTeams`/`queryAttendance*` below fetch
 * real rows and map them (snake_case -> camelCase) into plain objects
 * structurally identical to `MeetingsList.tsx`'s own (unexported)
 * `FixtureEvent`/`FixtureEventSession`/`FixtureTeam`/`FixtureAttendanceRecord`
 * shapes -- then `makeLoadCoachMeetingsData`/`makeLoadStudentMeetingsData`
 * below call that file's own EXPORTED `buildCoachMeetingRows`/
 * `buildStudentMeetingsData` directly. NAV-07's "meeting-type sessions only"
 * filter (`event.type === 'meeting'`) therefore lives in exactly ONE place in
 * this whole codebase (`MeetingsList.tsx`'s own `meetingEventIdsOf`), not
 * duplicated/re-derived here -- this file fetches the FULL `events`/
 * `event_sessions` tables (any type), the same way `loaders/students.ts`
 * fetches full tables and lets its own page's pure functions do the
 * filtering/joining.
 *
 * `events.type` check constraint verified directly against
 * `supabase/migrations/20260717000000_scheduling_attendance.sql` line 36:
 * `type text not null check (type in ('meeting', 'outreach', 'competition'))`
 * -- matches `MeetingsList.tsx`'s own `EventType` union exactly, not assumed.
 * `event_sessions.status` (line 59: `'scheduled' | 'completed' | 'canceled'`)
 * likewise matches that file's own `SessionStatus` union verbatim.
 *
 * Coach view: fetches the full `attendance` table (bounded by that table's
 * own `staff_all` RLS policy for admin/coach -- `supabase/migrations/
 * 20260717000002_rls.sql` lines 226-228 -- so a coach/admin session
 * genuinely sees every row, not an RLS-caused false-empty). Safe to filter
 * client-side per-session afterward (`summarizeAttendance`, unchanged,
 * inside `MeetingsList.tsx`) since `session_id` is that table's own foreign
 * key into `event_sessions.id`, never ambiguous across events.
 *
 * Student/parent view: `queryAttendanceForStudent`/`queryParticipationRowsForStudent`
 * (T122-renamed; see this file's own T122 module doc below) below both
 * filter `.eq('student_id', studentId)` explicitly -- a defense-
 * in-depth filter on top of `attendance`'s own `own_or_linked_read` RLS
 * policy (same migration file, lines 230-232: `student_id in (select
 * my_student_ids())`), which already restricts a student/parent session to
 * their own/linked rows only, whether or not this file adds its own filter.
 *
 * -----------------------------------------------------------------------
 * Trap #4 (`studentId` resolution, `MeetingsList.tsx` module doc #6) --
 * `makeResolveCurrentStudentId` below is the real implementation of the
 * resolution approach documented in full on that file's own module doc #6
 * (not re-derived here): a `student`-role viewer resolves via
 * `students.profile_id = auth.uid()` (one query, `.maybeSingle()` -- safe
 * because `profile_id` has no uniqueness constraint in the schema but the
 * real data model only ever links one student row to one profile); a
 * `parent`-role viewer resolves via their EARLIEST-linked
 * `guardian_links` row (`parent_profile_id = auth.uid()`, ordered by
 * `created_at` ascending, first of possibly-several) -- `MeetingsList`'s own
 * `studentId: string` (singular, not a list) leaves no other real choice
 * within this task's scope; a genuinely multi-student parent only ever sees
 * their first-linked child's meetings on this route, a disclosed limitation
 * (this task's own worker output "Known risks"), not a silent wrong answer.
 *
 * `own_or_linked_read` on `students` (same RLS migration, lines 100-102:
 * `id in (select my_student_ids())`) and on `guardian_links` (lines 114-116:
 * `parent_profile_id = auth.uid() or student_id in (select my_student_ids())`)
 * both already grant a student/parent read access to exactly their own
 * row(s) -- these two queries genuinely resolve for a real, authenticated
 * student/parent session, not an RLS-caused false-empty.
 *
 * -----------------------------------------------------------------------
 * Trap #2 (Cancel, a real mutation) -- `makeCancelMeetingSession` below does
 * exactly one thing: `update event_sessions set status = 'canceled' where id
 * = :sessionId`, via `runMutation`. `MeetingsList.tsx`'s own
 * `handleConfirmCancel` pairs this with its own optimistic local-state flip,
 * rolling that flip back on rejection -- same shape `StudentsTab.tsx`'s own
 * `handleConfirmDeactivate` (T089) already established, per this task's own
 * packet steer.
 *
 * -----------------------------------------------------------------------
 * Trap #3 (wiring `ScheduleMeetingsDialog` for real, create mode only --
 * `MeetingsList.tsx` module doc #7a/#7b) -- `makeCreateMeetings` below is the
 * real default for that dialog's own already-built `onCreateMeetings` seam
 * (`ScheduleMeetingsDialog.tsx`, forbidden/read-only, its own prop/type
 * definitions are only ever IMPORTED here, never modified). Two sequential
 * writes, not a single transaction/RPC (no `supabase.rpc(...)` call anywhere
 * in this file, grep-provable):
 *   1. Resolve the active season (`seasons` where `is_active = true`,
 *      `.maybeSingle()` -- safe, `seasons_single_active_idx` guarantees at
 *      most one such row, same query shape `loaders/seasons.ts`'s own
 *      `queryActiveSeason` already established). `events.season_id` is
 *      `not null` with no default (migration line 35) and
 *      `CreateMeetingsPayload` (that dialog's own payload shape) carries no
 *      season field of its own -- `MeetingsList.tsx` itself deliberately
 *      stays season-UNAWARE in its own type signatures (that file's own
 *      Forbidden Files instruction: do not import `useActiveSeason` there),
 *      so this internal season lookup lives here, in the loader, as a
 *      plain DB query -- not as a React hook/context import into the page
 *      component, and not as a new prop on `MeetingsList`'s own type
 *      signature. If no season is currently active, this function REJECTS
 *      with a real, disclosed error (`ScheduleMeetingsDialog`'s own
 *      `submitError` `Banner` surfaces it) rather than fabricating a
 *      `season_id` -- no `PLACEHOLDER_SEASON_ID`-shaped literal anywhere in
 *      this file (grep-provable).
 *   2. Insert one `events` row (type `'meeting'`, `counts_participation:
 *      true` / `counts_volunteer_hours: false` -- the same true/false split
 *      `MeetingsList.tsx`'s own `FIXTURE_EVENTS` already models for its
 *      meeting-type fixture rows, a disclosed default choice since MTG-02's
 *      own field set never collects either flag), THEN insert one
 *      `event_sessions` row per computed date (`status: 'scheduled'`).
 *      **Disclosed risk:** if the `events` insert succeeds but the
 *      `event_sessions` insert then fails, the database is left with a real
 *      "meeting" event row that has zero sessions -- there is no rollback of
 *      the first write. Same disclosed-risk class `StudentsTab.tsx`'s own
 *      T089 module doc #14 already accepts for its own sequential
 *      students-write-then-send-invite design (this task's own worker output
 *      "Known risks" restates this for checker visibility).
 *
 * -----------------------------------------------------------------------
 * T122 (PRD v2 UXP-04, "meetings half"): row-density rework wiring +
 * dual-member `.limit(1)` fix. Full reasoning lives on `MeetingsList.tsx`'s
 * own module doc #10 (not re-derived here); this file's own share of it:
 *
 *   a. `queryEvents` now also selects `location_name`/`address` (real,
 *      already-existing `not null` columns -- UXP-08's own resolution note,
 *      `mapEventDbRow` below) so the coach view's dense rows can show a real
 *      location (UXD-02 "where"), not a fabricated one.
 *   b. Two NEW real batched queries this task adds -- `queryRsvps` (full
 *      `rsvps` table, same "bounded by that table's own `staff_all` RLS
 *      policy" posture `queryAttendance` above already established) and
 *      `queryStudents` (full `students` table, `id`/`display_name` only --
 *      same shape/posture `loaders/students.ts` already established for a
 *      full-roster read) -- feed `buildCoachMeetingRows`'s two new
 *      parameters (expected-attendee counts from real RSVP rows, attendee
 *      display names from real student rows). Neither re-derives a metric
 *      view formula (constitution item 3): `queryRsvps`' rows are only ever
 *      COUNTED (`status === 'going'`, a plain filter+length, the same class
 *      of computation `PastAttendanceSummary` already does per module doc
 *      #3), never percentaged.
 *   c. `queryParticipationForStudent` -- RENAMED
 *      `queryParticipationRowsForStudent` (it can now genuinely return MORE
 *      THAN ONE row for a dual member, so the old singular name is no longer
 *      accurate) -- drops `.limit(1)` (T116 consumer finding #2's arbitrary-
 *      team-for-dual-members bug) and instead fetches EVERY
 *      `v_student_participation` row for this student (one per team
 *      membership, T116's own migration doc). `aggregateParticipationRows`
 *      (below) sums those rows' own already-computed counters and reapplies
 *      the view's own `participation_pct` expression verbatim -- see that
 *      function's own doc for the full decision record and citation.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { createLoader, runMutation, type LoaderQueryResult } from '../loader';
import { getSupabaseClient } from '../client';
import {
  buildCoachMeetingRows,
  buildStudentMeetingsData,
  type AttendanceStatus,
  type CancelMeetingSessionFn,
  type CoachMeetingsData,
  type CurrentViewerIdentity,
  type EventType,
  type LoadCoachMeetingsDataFn,
  type LoadStudentMeetingsDataFn,
  type ResolveCurrentStudentIdFn,
  type SessionStatus,
  type StudentMeetingsData,
} from '../../../pages/meetings/MeetingsList';
import type {
  CreateMeetingsPayload,
  OnCreateMeetingsFn,
} from '../../../pages/meetings/ScheduleMeetingsDialog';

// ---------------------------------------------------------------------------
// Raw DB row shapes (snake_case, exactly as Postgrest returns them). Cited
// column-for-column against the real migrations in this file's own module
// doc above.
// ---------------------------------------------------------------------------

interface EventDbRow {
  id: string;
  season_id: string;
  type: EventType;
  title: string;
  team_ids: string[] | null;
  counts_participation: boolean;
  // T122 (module doc above, item a) -- real, already-existing columns
  // (`not null` per the schema, UXP-08's own resolution note), now selected
  // for the coach view's dense rows (UXD-02 "where").
  location_name: string;
  address: string;
}

interface EventSessionDbRow {
  id: string;
  event_id: string;
  session_date: string;
  starts_at: string;
  ends_at: string;
  status: SessionStatus;
}

interface TeamDbRow {
  id: string;
  name: string;
}

interface AttendanceDbRow {
  session_id: string;
  student_id: string;
  status: AttendanceStatus;
}

/** T122 (module doc above, item b). Cited column-for-column against
 * `supabase/migrations/20260717000000_scheduling_attendance.sql`'s own
 * `rsvps` table (`session_id`, `student_id`, `status` -- the check
 * constraint's real `'going' | 'maybe' | 'declined'` vocabulary, used
 * verbatim, never an invented value). */
interface RsvpDbRow {
  session_id: string;
  student_id: string;
  status: 'going' | 'maybe' | 'declined';
}

/** T122 (module doc above, item b). Only the two columns this task's rows
 * need -- `students.id`/`display_name`, same "select only what this screen
 * renders" discipline every other row shape in this file already follows. */
interface StudentDbRow {
  id: string;
  display_name: string;
}

/** `v_student_participation`'s seven real columns -- see
 * `../types.ts`'s own `VStudentParticipationRow` doc comment for the full
 * view SQL citation (not re-cited here). Deliberately NOT switched to that
 * shared type, same "page-local type stays as-is" decision every prior
 * `loaders/*.ts` file in this directory already made -- `MeetingsList.tsx`'s
 * own `StudentParticipationMetric` is the exact same seven-field shape. */
interface ParticipationDbRow {
  student_id: string;
  team_id: string;
  season_id: string;
  expected_ct: number;
  present_ct: number;
  late_ct: number;
  excused_ct: number;
  participation_pct: number;
}

interface StudentIdDbRow {
  id: string;
}

interface GuardianLinkStudentIdDbRow {
  student_id: string;
}

interface SeasonIdDbRow {
  id: string;
}

interface CreatedEventDbRow {
  id: string;
}

// ---------------------------------------------------------------------------
// Row mappers -- snake_case DB row -> the camelCase shape
// `buildCoachMeetingRows`/`buildStudentMeetingsData` (`MeetingsList.tsx`)
// already expect (Trap #1 above).
// ---------------------------------------------------------------------------

function mapEventDbRow(row: EventDbRow) {
  return {
    id: row.id,
    seasonId: row.season_id,
    type: row.type,
    title: row.title,
    teamIds: row.team_ids,
    countsParticipation: row.counts_participation,
    locationName: row.location_name,
    address: row.address,
  };
}

function mapSessionDbRow(row: EventSessionDbRow) {
  return {
    id: row.id,
    eventId: row.event_id,
    sessionDate: row.session_date,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    status: row.status,
  };
}

function mapTeamDbRow(row: TeamDbRow) {
  return { id: row.id, name: row.name };
}

function mapAttendanceDbRow(row: AttendanceDbRow) {
  return { sessionId: row.session_id, studentId: row.student_id, status: row.status };
}

/** T122 (module doc above, item b). */
function mapRsvpDbRow(row: RsvpDbRow) {
  return { sessionId: row.session_id, studentId: row.student_id, status: row.status };
}

/** T122 (module doc above, item b). */
function mapStudentDbRow(row: StudentDbRow) {
  return { id: row.id, displayName: row.display_name };
}

function mapParticipationDbRow(row: ParticipationDbRow) {
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

// ---------------------------------------------------------------------------
// Query functions (Trap #1).
// ---------------------------------------------------------------------------

async function queryEvents(client: SupabaseClient): Promise<LoaderQueryResult<EventDbRow[]>> {
  const result = await client
    .from('events')
    // T122 (module doc above, item a) -- `location_name`/`address` added.
    .select('id, season_id, type, title, team_ids, counts_participation, location_name, address');
  return { data: (result.data as EventDbRow[] | null) ?? null, error: result.error };
}

async function querySessions(
  client: SupabaseClient,
): Promise<LoaderQueryResult<EventSessionDbRow[]>> {
  const result = await client
    .from('event_sessions')
    .select('id, event_id, session_date, starts_at, ends_at, status')
    .order('starts_at', { ascending: true });
  return { data: (result.data as EventSessionDbRow[] | null) ?? null, error: result.error };
}

async function queryTeams(client: SupabaseClient): Promise<LoaderQueryResult<TeamDbRow[]>> {
  const result = await client.from('teams').select('id, name').order('sort_order', {
    ascending: true,
  });
  return { data: (result.data as TeamDbRow[] | null) ?? null, error: result.error };
}

/** Coach view -- full table, bounded by `attendance`'s own `staff_all` RLS
 * policy (module doc above). */
async function queryAttendance(
  client: SupabaseClient,
): Promise<LoaderQueryResult<AttendanceDbRow[]>> {
  const result = await client.from('attendance').select('session_id, student_id, status');
  return { data: (result.data as AttendanceDbRow[] | null) ?? null, error: result.error };
}

/** T122 (module doc above, item b) -- coach view, full table, same
 * `staff_all`-RLS-bounded posture `queryAttendance` above already
 * established (`supabase/migrations/20260717000002_rls.sql` lines 197-199). */
async function queryRsvps(client: SupabaseClient): Promise<LoaderQueryResult<RsvpDbRow[]>> {
  const result = await client.from('rsvps').select('session_id, student_id, status');
  return { data: (result.data as RsvpDbRow[] | null) ?? null, error: result.error };
}

/** T122 (module doc above, item b) -- coach view, full roster (`id`,
 * `display_name` only), same `staff_all`-RLS-bounded posture. */
async function queryStudents(client: SupabaseClient): Promise<LoaderQueryResult<StudentDbRow[]>> {
  const result = await client.from('students').select('id, display_name');
  return { data: (result.data as StudentDbRow[] | null) ?? null, error: result.error };
}

/** Student/parent view -- explicit `student_id` filter, defense-in-depth on
 * top of `attendance`'s own `own_or_linked_read` RLS policy (module doc
 * above). */
async function queryAttendanceForStudent(
  client: SupabaseClient,
  studentId: string,
): Promise<LoaderQueryResult<AttendanceDbRow[]>> {
  const result = await client
    .from('attendance')
    .select('session_id, student_id, status')
    .eq('student_id', studentId);
  return { data: (result.data as AttendanceDbRow[] | null) ?? null, error: result.error };
}

/**
 * T122 fix (T116 consumer finding #2, this task's own ".limit(1)" fix
 * decision -- full record in this task's own worker output): RENAMED from
 * the old `queryParticipationForStudent` (plural "Rows" -- it can now
 * genuinely return more than one row) and `.limit(1)` is REMOVED. The old
 * `.limit(1)` picked an ARBITRARY one of a dual member's per-team
 * `v_student_participation` rows (T116's migration doc,
 * `20260722000000_membership_views.sql`: one row per (student, membership-
 * team)) -- silently showing e.g. only her FRC team's participation and
 * dropping her FTC team's entirely, or vice versa, depending on whatever
 * order Postgrest happened to return rows in.
 *
 * Still not season-scoped, matching `MeetingsList.tsx`'s own deliberately
 * season-unaware `studentId`-only `LoadStudentMeetingsDataFn` signature
 * (that file's own Forbidden Files instruction) -- if a student has
 * multiple seasons' worth of rows too, they are summed together the same as
 * multiple teams' rows are (disclosed in this task's own worker output
 * "Known risks", same pre-existing limitation the old `.limit(1)` code's own
 * comment already disclosed, now inherited by the aggregate instead of
 * silently dropped).
 */
async function queryParticipationRowsForStudent(
  client: SupabaseClient,
  studentId: string,
): Promise<LoaderQueryResult<ParticipationDbRow[]>> {
  const result = await client
    .from('v_student_participation')
    .select(
      'student_id, team_id, season_id, expected_ct, present_ct, late_ct, excused_ct, participation_pct',
    )
    .eq('student_id', studentId);
  return { data: (result.data as ParticipationDbRow[] | null) ?? null, error: result.error };
}

/**
 * T122's `.limit(1)` fix decision (this task's own worker output has the
 * full record): `MeetingsList`'s student/parent view has NO team parameter
 * anywhere in its own type signatures (`LoadStudentMeetingsDataFn =
 * (studentId: string) => ...`; that file's own Forbidden Files instruction
 * keeps this route deliberately season/team-UNAWARE, same reason
 * `makeCreateMeetings`'s own season lookup lives in THIS loader rather than
 * as a page-level hook) -- so T120's twin decision's "team-scope if the call
 * site has a team" branch genuinely does not apply here (there is no team in
 * context to scope to). This is the documented fallback: aggregate.
 *
 * Sums the view's own already-computed counters (`expected_ct`,
 * `present_ct`, `late_ct`, `excused_ct`) across every row this student has,
 * then recomputes `participation_pct` using the SAME expression the view
 * itself uses, byte-for-byte -- cited directly from
 * `supabase/migrations/20260722000000_membership_views.sql`:
 *   round(100.0 * present_ct / greatest(expected_ct - excused_ct, 1), 1)
 * This is NOT a new/invented formula (constitution item 3 forbids that) --
 * it is the view's own arithmetic, applied to summed inputs instead of one
 * row's inputs. `v_team_participation` (same migration file) already
 * establishes this exact pattern for the analogous student-rollup-into-team
 * direction: it SUMs `v_student_participation`'s own counters across
 * students and reapplies this identical expression, never re-deriving a new
 * one. This function does the identical operation across a dual member's
 * OWN rows instead of across students -- same class of aggregate, same
 * source expression, cited the same way.
 *
 * `team_id` on the returned row is populated from the FIRST row purely to
 * satisfy `ParticipationDbRow`'s existing shape -- `MeetingsList.tsx` never
 * renders `StudentParticipationMetric.teamId` anywhere (grep-provable: only
 * `participationPct` is read from that shape, in `StudentMeetingsView`), so
 * this field carries no real "the" team meaning for an aggregate row and is
 * disclosed as such here rather than silently implying one.
 */
export function aggregateParticipationRows(
  rows: readonly ParticipationDbRow[],
): ParticipationDbRow | null {
  if (rows.length === 0) return null;
  if (rows.length === 1) return rows[0];
  const expectedCt = rows.reduce((sum, row) => sum + row.expected_ct, 0);
  const presentCt = rows.reduce((sum, row) => sum + row.present_ct, 0);
  const lateCt = rows.reduce((sum, row) => sum + row.late_ct, 0);
  const excusedCt = rows.reduce((sum, row) => sum + row.excused_ct, 0);
  // View's own expression, cited above -- `greatest(x, 1)` -> `Math.max(x, 1)`,
  // `round(x, 1)` -> `Math.round(x * 10) / 10` (both non-negative here, so
  // this matches Postgres `round`'s round-half-away-from-zero behavior).
  const denominator = Math.max(expectedCt - excusedCt, 1);
  const participationPct = Math.round(((100.0 * presentCt) / denominator) * 10) / 10;
  return {
    student_id: rows[0].student_id,
    team_id: rows[0].team_id,
    season_id: rows[0].season_id,
    expected_ct: expectedCt,
    present_ct: presentCt,
    late_ct: lateCt,
    excused_ct: excusedCt,
    participation_pct: participationPct,
  };
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

/** Trap #4 -- EARLIEST-linked child only (module doc above). */
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

async function queryActiveSeasonId(
  client: SupabaseClient,
): Promise<LoaderQueryResult<SeasonIdDbRow>> {
  const result = await client.from('seasons').select('id').eq('is_active', true).maybeSingle();
  return { data: (result.data as SeasonIdDbRow | null) ?? null, error: result.error };
}

// ---------------------------------------------------------------------------
// `getClient` is injectable (defaults to the shared singleton), same
// convention every prior `loaders/*.ts` file in this directory already
// established, so tests can supply a stubbed transport with zero real
// network calls.
// ---------------------------------------------------------------------------

/** Coach view real load (Trap #1; T122 module doc above item b adds
 * `rsvps`/`students`). */
export function makeLoadCoachMeetingsData(
  getClient: () => SupabaseClient = getSupabaseClient,
): LoadCoachMeetingsDataFn {
  const loadEventRows = createLoader<void, EventDbRow[]>(queryEvents, getClient);
  const loadSessionRows = createLoader<void, EventSessionDbRow[]>(querySessions, getClient);
  const loadTeamRows = createLoader<void, TeamDbRow[]>(queryTeams, getClient);
  const loadAttendanceRows = createLoader<void, AttendanceDbRow[]>(queryAttendance, getClient);
  const loadRsvpRows = createLoader<void, RsvpDbRow[]>(queryRsvps, getClient);
  const loadStudentRows = createLoader<void, StudentDbRow[]>(queryStudents, getClient);
  return async (): Promise<CoachMeetingsData> => {
    const [eventRows, sessionRows, teamRows, attendanceRows, rsvpRows, studentRows] =
      await Promise.all([
        loadEventRows(),
        loadSessionRows(),
        loadTeamRows(),
        loadAttendanceRows(),
        loadRsvpRows(),
        loadStudentRows(),
      ]);
    return {
      rows: buildCoachMeetingRows(
        (eventRows ?? []).map(mapEventDbRow),
        (sessionRows ?? []).map(mapSessionDbRow),
        (teamRows ?? []).map(mapTeamDbRow),
        (attendanceRows ?? []).map(mapAttendanceDbRow),
        (rsvpRows ?? []).map(mapRsvpDbRow),
        (studentRows ?? []).map(mapStudentDbRow),
      ),
    };
  };
}

/** `MeetingsList.tsx`'s own default `loadCoachData` -- real query. */
export const loadCoachMeetingsData: LoadCoachMeetingsDataFn = makeLoadCoachMeetingsData();

/** Student/parent view real load (Trap #1; T122 module doc above item c --
 * dual-member aggregation replaces the old `.limit(1)` arbitrary pick). */
export function makeLoadStudentMeetingsData(
  getClient: () => SupabaseClient = getSupabaseClient,
): LoadStudentMeetingsDataFn {
  const loadEventRows = createLoader<void, EventDbRow[]>(queryEvents, getClient);
  const loadSessionRows = createLoader<void, EventSessionDbRow[]>(querySessions, getClient);
  const loadAttendanceRows = createLoader<string, AttendanceDbRow[]>(
    queryAttendanceForStudent,
    getClient,
  );
  const loadParticipationRows = createLoader<string, ParticipationDbRow[]>(
    queryParticipationRowsForStudent,
    getClient,
  );
  return async (studentId: string): Promise<StudentMeetingsData> => {
    const [eventRows, sessionRows, attendanceRows, participationRows] = await Promise.all([
      loadEventRows(),
      loadSessionRows(),
      loadAttendanceRows(studentId),
      loadParticipationRows(studentId),
    ]);
    const aggregatedParticipation = aggregateParticipationRows(participationRows ?? []);
    return buildStudentMeetingsData(
      studentId,
      (eventRows ?? []).map(mapEventDbRow),
      (sessionRows ?? []).map(mapSessionDbRow),
      (attendanceRows ?? []).map(mapAttendanceDbRow),
      aggregatedParticipation === null ? [] : [mapParticipationDbRow(aggregatedParticipation)],
    );
  };
}

/** `MeetingsList.tsx`'s own default `loadStudentData` -- real query. */
export const loadStudentMeetingsData: LoadStudentMeetingsDataFn = makeLoadStudentMeetingsData();

/** Trap #2 -- the ONLY place `event_sessions.status` is ever written from
 * this module. `MeetingsList.tsx` pairs this with its own optimistic
 * local-state flip, rolling that flip back on rejection. */
export function makeCancelMeetingSession(
  getClient: () => SupabaseClient = getSupabaseClient,
): CancelMeetingSessionFn {
  const mutate = runMutation<string, void>(
    (client, sessionId) =>
      client.from('event_sessions').update({ status: 'canceled' }).eq('id', sessionId),
    getClient,
  );
  return async (sessionId) => {
    await mutate(sessionId);
  };
}

/** `MeetingsList.tsx`'s own default `onCancelSession`. */
export const cancelMeetingSession: CancelMeetingSessionFn = makeCancelMeetingSession();

/** Trap #4 -- real `studentId` resolution (module doc above; full reasoning
 * also documented directly on `MeetingsList.tsx`'s own module doc #6). */
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

/** `MeetingsList.tsx`'s own default `resolveStudentId`. */
export const resolveCurrentStudentId: ResolveCurrentStudentIdFn = makeResolveCurrentStudentId();

/** Trap #3 -- real `onCreateMeetings` default for `ScheduleMeetingsDialog`
 * (module doc above). Two sequential writes (events, then event_sessions),
 * preceded by an active-season lookup neither `MeetingsList.tsx` nor
 * `ScheduleMeetingsDialog.tsx` carries in its own type signature. */
export function makeCreateMeetings(
  getClient: () => SupabaseClient = getSupabaseClient,
): OnCreateMeetingsFn {
  const loadActiveSeasonId = createLoader<void, SeasonIdDbRow>(queryActiveSeasonId, getClient);
  const insertEvent = runMutation<
    { payload: CreateMeetingsPayload; seasonId: string },
    CreatedEventDbRow
  >(
    (client, args) =>
      client
        .from('events')
        .insert({
          season_id: args.seasonId,
          type: 'meeting',
          title: args.payload.event.title,
          description: args.payload.event.description,
          location_name: args.payload.event.locationName,
          address: args.payload.event.address,
          team_ids: args.payload.event.teamIds,
          counts_participation: true,
          counts_volunteer_hours: false,
        })
        .select('id')
        .single(),
    getClient,
  );
  const insertSessions = runMutation<{ eventId: string; payload: CreateMeetingsPayload }, void>(
    (client, args) =>
      client.from('event_sessions').insert(
        args.payload.sessions.map((session) => ({
          event_id: args.eventId,
          session_date: session.sessionDate,
          starts_at: session.startsAt,
          ends_at: session.endsAt,
          status: 'scheduled',
          notes: session.notes,
        })),
      ),
    getClient,
  );

  return async (payload: CreateMeetingsPayload): Promise<void> => {
    const activeSeason = await loadActiveSeasonId();
    if (activeSeason === null) {
      throw new Error(
        'No active season is set up yet. Ask an admin to set an active season in Season Settings before scheduling meetings.',
      );
    }
    const createdEvent = await insertEvent({ payload, seasonId: activeSeason.id });
    // Disclosed risk -- module doc above.
    await insertSessions({ eventId: createdEvent.id, payload });
  };
}

/** `MeetingsList.tsx`'s own default `onCreateMeetings`, passed straight
 * through to `<ScheduleMeetingsDialog onCreateMeetings={...} />`. */
export const createMeetings: OnCreateMeetingsFn = makeCreateMeetings();
