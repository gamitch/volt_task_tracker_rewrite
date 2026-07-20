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
 * Student/parent view: `queryAttendanceForStudent`/`queryParticipationForStudent`
 * below both filter `.eq('student_id', studentId)` explicitly -- a defense-
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
    .select('id, season_id, type, title, team_ids, counts_participation');
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
 * Not season-scoped, matching `MeetingsList.tsx`'s own deliberately
 * season-unaware `studentId`-only `LoadStudentMeetingsDataFn` signature
 * (that file's own Forbidden Files instruction). If more than one
 * `v_student_participation` row exists for this student across multiple
 * seasons, this resolves whichever row Postgrest returns first (no explicit
 * `order` -- there is no timestamp column on this view to order by) --
 * `.maybeSingle()` is deliberately NOT used here (it would reject with a
 * "multiple rows" Postgrest error in that multi-season case); `.limit(1)`
 * instead. A real fix would need `MeetingsList` to accept a season scope,
 * which is out of this task's scope (disclosed in this task's own worker
 * output "Known risks").
 */
async function queryParticipationForStudent(
  client: SupabaseClient,
  studentId: string,
): Promise<LoaderQueryResult<ParticipationDbRow[]>> {
  const result = await client
    .from('v_student_participation')
    .select(
      'student_id, team_id, season_id, expected_ct, present_ct, late_ct, excused_ct, participation_pct',
    )
    .eq('student_id', studentId)
    .limit(1);
  return { data: (result.data as ParticipationDbRow[] | null) ?? null, error: result.error };
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

/** Coach view real load (Trap #1). */
export function makeLoadCoachMeetingsData(
  getClient: () => SupabaseClient = getSupabaseClient,
): LoadCoachMeetingsDataFn {
  const loadEventRows = createLoader<void, EventDbRow[]>(queryEvents, getClient);
  const loadSessionRows = createLoader<void, EventSessionDbRow[]>(querySessions, getClient);
  const loadTeamRows = createLoader<void, TeamDbRow[]>(queryTeams, getClient);
  const loadAttendanceRows = createLoader<void, AttendanceDbRow[]>(queryAttendance, getClient);
  return async (): Promise<CoachMeetingsData> => {
    const [eventRows, sessionRows, teamRows, attendanceRows] = await Promise.all([
      loadEventRows(),
      loadSessionRows(),
      loadTeamRows(),
      loadAttendanceRows(),
    ]);
    return {
      rows: buildCoachMeetingRows(
        (eventRows ?? []).map(mapEventDbRow),
        (sessionRows ?? []).map(mapSessionDbRow),
        (teamRows ?? []).map(mapTeamDbRow),
        (attendanceRows ?? []).map(mapAttendanceDbRow),
      ),
    };
  };
}

/** `MeetingsList.tsx`'s own default `loadCoachData` -- real query. */
export const loadCoachMeetingsData: LoadCoachMeetingsDataFn = makeLoadCoachMeetingsData();

/** Student/parent view real load (Trap #1). */
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
    queryParticipationForStudent,
    getClient,
  );
  return async (studentId: string): Promise<StudentMeetingsData> => {
    const [eventRows, sessionRows, attendanceRows, participationRows] = await Promise.all([
      loadEventRows(),
      loadSessionRows(),
      loadAttendanceRows(studentId),
      loadParticipationRows(studentId),
    ]);
    return buildStudentMeetingsData(
      studentId,
      (eventRows ?? []).map(mapEventDbRow),
      (sessionRows ?? []).map(mapSessionDbRow),
      (attendanceRows ?? []).map(mapAttendanceDbRow),
      (participationRows ?? []).map(mapParticipationDbRow),
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
