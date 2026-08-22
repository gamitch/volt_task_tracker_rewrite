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
 * `FixtureEvent`/`FixtureEventSession`/`Team`/`FixtureAttendanceRecord`
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
 *      membership, T116's own migration doc). `selectSingleParticipationRow`
 *      accepts the metric-view row only when exactly one is returned and
 *      otherwise returns no metric, preserving the database-owned
 *      `participation_pct` unchanged rather than aggregating counters or
 *      recomputing a percentage in TypeScript.
 *
 * -----------------------------------------------------------------------
 * GAM-301 (T407) round 3, BLOCKER 2 fix: `makeResolveCurrentStudentId`/
 * `resolveCurrentStudentId` (Trap #4 above) and their private helpers
 * (`queryStudentIdByProfileId`/`queryFirstLinkedStudentId`,
 * `StudentIdDbRow`/`GuardianLinkStudentIdDbRow`) have MOVED, verbatim, to
 * `../../lib/meetings/resolveCurrentStudentId.ts` -- a pure leaf module with
 * no value-import of `MeetingsList.tsx`/`ScheduleMeetingsDialog.tsx`, unlike
 * this file (see the two value-imports directly below). Re-exported here so
 * every existing caller of this file (this file's own tests,
 * `StudentMeetingView.tsx`, `OutreachList.tsx`, `DashboardPage.test.tsx`'s
 * `vi.mock('.../loaders/meetings', ...)`) is unaffected -- see that new
 * file's own module doc for the full reasoning (measured bundle cost of NOT
 * relocating it: entry chunk +50.47 kB gz, 18 lazy chunks collapsed).
 *
 * -----------------------------------------------------------------------
 * GAM-444 §5 update: the REST of this file's own `lib -> pages` inversion
 * (unlike `resolveCurrentStudentId` above, this one really was a value
 * import, not type-only) is now closed too. `buildCoachMeetingRows`/
 * `buildStudentMeetingsData` and the eight types this file imports below now
 * come from `../../meetings/coachModel`, `../../meetings/studentModel` and
 * `../../meetings/types` -- not `../../../pages/meetings/MeetingsList` --
 * per GAM-444's own packet §5, which measured this exact re-point (entry
 * chunk unchanged, `MeetingsList` still a lazy chunk) before prescribing it.
 * Every reference to `MeetingsList.tsx` elsewhere in this file's own module
 * doc above is a historical record of where this logic was BUILT (T096/T122/
 * T510/T605), not a claim about where it lives today -- left as-is per
 * constitution item 30c rather than rewritten out from under the reasoning
 * it recorded.
 *
 * -----------------------------------------------------------------------
 * GAM-446: a seventh query, `queryEventAttendance`, added to the SAME
 * `Promise.all` batch inside `makeLoadCoachMeetingsData` (one batch, not a
 * second round trip) -- against `v_event_attendance` (GAM-442's view,
 * `supabase/migrations/20260821000000_meetings_event_attendance_view.sql`).
 * `makeLoadCoachMeetingsData` does NOT construct `CoachMeetingRow[]` itself;
 * `buildCoachMeetingRows` (`../../meetings/coachModel.ts`, untouched by this
 * task) still does that, unmodified. This task instead merges the view's
 * five per-event fields onto `buildCoachMeetingRows`' own RETURNED array,
 * here, KEYED BY `eventId` -- never by array position, since the view's row
 * order has no guaranteed relationship to that returned array's order.
 *
 * `held_ct` counts SESSIONS; every other column (`gradedMarksCt`,
 * `excusedCt`, `attendedMarksCt`) counts MARKS -- the view's own catalog
 * comment states this in capitals, and this merge does not conflate them
 * either. `attendancePct` passes through NULL unchanged (never `?? 0`, never
 * widened to a bare `number`) -- constitution item 3 / PRD DATA-01, the same
 * discipline this file's own `mapParticipationDbRow` above already
 * established for `participation_pct`.
 *
 * The real edge case here is NOT a missing view row (the view LEFT joins, so
 * every `events.id` gets one) -- it is the inverse: `coachModel.ts`'s own
 * `if (eventSessions.length === 0) continue` means a zero-session event
 * never becomes a `CoachMeetingRow` at all, and only `type === 'meeting'`
 * events become rows in the first place. Extra `v_event_attendance` rows
 * with no matching `CoachMeetingRow` are simply unused. A row whose event id
 * is somehow absent from the view keeps these five fields `undefined` --
 * never a fabricated `0`.
 *
 * Cut from this ticket (gate findings, `docs/swarm/active/GAM-446-packet.md`
 * revision 2): per-series roster size (no PRD authority, no working
 * `student_teams` writer on `main` yet -- filed as GAM-471) and a second
 * `listGuardianChildren` loader (`makeLoadLinkedStudents`/
 * `loadLinkedStudents`, `loaders/checkin.ts`, already provides this shape --
 * filed as GAM-472 for the pre-existing `lib -> pages` type-only edge it
 * surfaced). Neither is built here.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  createLoader,
  isSupabaseLoaderError,
  runMutation,
  type LoaderQueryResult,
} from '../loader';
import { getSupabaseClient } from '../client';
import type {
  AttendanceStatus,
  CancelMeetingSessionFn,
  CoachMeetingsData,
  EventType,
  LoadCoachMeetingsDataFn,
  LoadStudentMeetingsDataFn,
  SessionStatus,
  StudentMeetingsData,
} from '../../meetings/types';
import { buildCoachMeetingRows } from '../../meetings/coachModel';
import { buildStudentMeetingsData } from '../../meetings/studentModel';
import {
  computeMeetingSeriesReconcilePlan,
  type CreateMeetingsPayload,
  type CreateMeetingsSessionPayload,
  type ExistingMeetingSeriesSession,
  type OnCreateMeetingsFn,
  type OnSaveMeetingSeriesFn,
  type SaveMeetingSeriesPayload,
} from '../../../pages/meetings/ScheduleMeetingsDialog';
// T605 -- `import type` only (fixes m9). `MeetingsList.tsx` <-> this file is
// already a mutual runtime value-import cycle
// (buildCoachMeetingRows/buildStudentMeetingsData imported one way,
// cancelMeetingSession/createMeetings/loadCoachMeetingsData/
// loadStudentMeetingsData/resolveCurrentStudentId/saveMeetingSeries the
// other). `EditMeetingSessionDialog.tsx` must not close a third edge into
// that cycle at the value level -- only its types cross into this file,
// fully erased at compile time.
import type {
  SaveMeetingSessionPayload,
  OnSaveMeetingSessionFn,
} from '../../../pages/meetings/EditMeetingSessionDialog';
// GAM-301 round 3 module doc above -- re-exported for this file's existing
// callers/tests, not used internally by anything else in this file.
export {
  makeResolveCurrentStudentId,
  resolveCurrentStudentId,
} from '../../meetings/resolveCurrentStudentId';

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
  // T510 -- real, already-existing `events.description` column (`not null`),
  // now selected so `CoachMeetingRow.description` (`MeetingsList.tsx`) can
  // prefill `ScheduleMeetingsDialog`'s own edit-mode Description field.
  description: string;
}

interface EventSessionDbRow {
  id: string;
  event_id: string;
  session_date: string;
  starts_at: string;
  ends_at: string;
  status: SessionStatus;
  // T605 -- real, already-existing `event_sessions.notes` column (`not null`,
  // no default -- §3.1 of this task's own packet), now selected so
  // `CoachMeetingSessionDetail.notes` (`MeetingsList.tsx`) can thread it into
  // the new per-session edit dialog's own initial form state. REQUIRED here
  // (unlike `MeetingsList.tsx`'s own optional `FixtureEventSession.notes`)
  // because a real row always has a real string value.
  notes: string;
}

interface TeamDbRow {
  id: string;
  name: string;
  archived: boolean;
}

interface AttendanceDbRow {
  session_id: string;
  student_id: string;
  status: AttendanceStatus;
}

interface StudentTeamDbRow {
  team_id: string;
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
  participation_pct: number | null;
}

interface SeasonIdDbRow {
  id: string;
}

/** GAM-446 -- `v_event_attendance`'s (GAM-442) six real columns, one row per
 * `events.id` (the view LEFT-joins, so a zero-session event still gets a
 * row: `held_ct` 0, every mark count 0, `attendance_pct` NULL). Cited
 * column-for-column against `supabase/migrations/
 * 20260821000000_meetings_event_attendance_view.sql`'s own `create view`.
 * `held_ct` counts SESSIONS; `graded_marks_ct`/`excused_ct`/
 * `attended_marks_ct` count MARKS -- do not read one as implying the other
 * (the view's own catalog comment, verbatim, in capitals). */
interface EventAttendanceDbRow {
  event_id: string;
  held_ct: number;
  graded_marks_ct: number;
  excused_ct: number;
  attended_marks_ct: number;
  /** NULL, never a fabricated 0, when the T509/D014 explicit-marks
   * denominator is 0 (held sessions with no marks, or every mark excused). */
  attendance_pct: number | null;
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
    description: row.description,
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
    notes: row.notes, // T605 -- §6.1.
  };
}

function mapTeamDbRow(row: TeamDbRow) {
  return { id: row.id, name: row.name, archived: row.archived };
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

/** GAM-446 -- passthrough only. `attendancePct` carries `row.attendance_pct`
 * through UNCHANGED -- never `?? 0`, never `Number(x) || 0` -- same
 * discipline `mapParticipationDbRow` above already established for
 * `participation_pct` (constitution item 3 / PRD DATA-01). */
function mapEventAttendanceDbRow(row: EventAttendanceDbRow) {
  return {
    eventId: row.event_id,
    heldCt: row.held_ct,
    gradedMarksCt: row.graded_marks_ct,
    excusedCt: row.excused_ct,
    attendedMarksCt: row.attended_marks_ct,
    attendancePct: row.attendance_pct,
  };
}

// ---------------------------------------------------------------------------
// Query functions (Trap #1).
// ---------------------------------------------------------------------------

async function queryEvents(client: SupabaseClient): Promise<LoaderQueryResult<EventDbRow[]>> {
  const result = await client
    .from('events')
    // T122 (module doc above, item a) -- `location_name`/`address` added.
    // T510 -- `description` added (real, already-existing column).
    .select(
      'id, season_id, type, title, team_ids, counts_participation, location_name, address, description',
    );
  return { data: (result.data as EventDbRow[] | null) ?? null, error: result.error };
}

async function querySessions(
  client: SupabaseClient,
): Promise<LoaderQueryResult<EventSessionDbRow[]>> {
  const result = await client
    .from('event_sessions')
    // T605 -- `notes` added (§6.1).
    .select('id, event_id, session_date, starts_at, ends_at, status, notes')
    .order('starts_at', { ascending: true });
  return { data: (result.data as EventSessionDbRow[] | null) ?? null, error: result.error };
}

async function queryTeams(client: SupabaseClient): Promise<LoaderQueryResult<TeamDbRow[]>> {
  const result = await client.from('teams').select('id, name, archived').order('sort_order', {
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

/** GAM-446 -- coach view, the seventh query in `makeLoadCoachMeetingsData`'s
 * existing batch (module doc above). `v_event_attendance` (GAM-442) has no
 * per-row RLS to speak of beyond the plain `revoke all from anon` that view's
 * own migration sets -- an authenticated coach/admin session reads it same as
 * any other authenticated table/view in this file. */
async function queryEventAttendance(
  client: SupabaseClient,
): Promise<LoaderQueryResult<EventAttendanceDbRow[]>> {
  const result = await client
    .from('v_event_attendance')
    .select('event_id, held_ct, graded_marks_ct, excused_ct, attended_marks_ct, attendance_pct');
  return { data: (result.data as EventAttendanceDbRow[] | null) ?? null, error: result.error };
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

/** Active memberships are the selected student's presentation boundary. */
async function queryActiveStudentTeams(
  client: SupabaseClient,
  studentId: string,
): Promise<LoaderQueryResult<StudentTeamDbRow[]>> {
  const result = await client
    .from('student_teams')
    .select('team_id')
    .eq('student_id', studentId)
    .is('left_on', null);
  return { data: (result.data as StudentTeamDbRow[] | null) ?? null, error: result.error };
}

/**
 * Fetch every visible metric row. The selector below deliberately rejects a
 * zero- or multi-row result: this route has no team/season selector and must
 * not choose a row arbitrarily or recompute a percentage in TypeScript.
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
 * The student view has no honest singular team/season context. A metric-view
 * row is therefore usable only when exactly one row is returned: its
 * `participation_pct` is database-owned and passes through unchanged. Zero
 * rows mean no metric; multiple rows are ambiguous, so returning null avoids
 * inventing a client aggregate or implying that the first row is canonical.
 */
export function selectSingleParticipationRow(
  rows: readonly ParticipationDbRow[],
): ParticipationDbRow | null {
  return rows.length === 1 ? rows[0] : null;
}

async function queryActiveSeasonId(
  client: SupabaseClient,
): Promise<LoaderQueryResult<SeasonIdDbRow>> {
  const result = await client.from('seasons').select('id').eq('is_active', true).maybeSingle();
  return { data: (result.data as SeasonIdDbRow | null) ?? null, error: result.error };
}

// ---------------------------------------------------------------------------
// T510 -- series edit for scheduled meetings (worker packet §4b). Additive
// only: `makeCreateMeetings`/`createMeetings` (below) are untouched.
// ---------------------------------------------------------------------------

interface EditableMeetingSessionDbRow {
  id: string;
  session_date: string;
  starts_at: string;
  ends_at: string;
  status: SessionStatus;
}

/** Routed through the existing `createLoader` seam, matching every other read in this file. */
async function queryEditableSessionsForEvent(
  client: SupabaseClient,
  eventId: string,
): Promise<LoaderQueryResult<EditableMeetingSessionDbRow[]>> {
  const result = await client
    .from('event_sessions')
    .select('id, session_date, starts_at, ends_at, status')
    .eq('event_id', eventId);
  return {
    data: (result.data as EditableMeetingSessionDbRow[] | null) ?? null,
    error: result.error,
  };
}

interface FutureSessionIdDbRow {
  id: string;
}

/**
 * D015 MAJOR fix. The future-forward guard up to this point is
 * `computeMeetingSeriesReconcilePlan`'s own `now`-based filter, an
 * APPLICATION-level check. This query re-enforces the SAME invariant at
 * the DATABASE boundary using Postgres's own `'now'` timestamptz literal
 * (a string Postgres parses as "the current instant, evaluated when this
 * statement runs on the server" -- NOT a client-computed `new Date()
 * .toISOString()`, which is still an app-clock value even though it is
 * accurate). Given a candidate id list, returns only the subset that is
 * STILL, right now (server time), strictly in the future. The result of
 * THIS query -- not `plan.toRemove` directly -- is what reaches the
 * destructive calls below.
 */
async function queryStillFutureSessionIds(
  client: SupabaseClient,
  candidateIds: readonly string[],
): Promise<LoaderQueryResult<FutureSessionIdDbRow[]>> {
  const result = await client
    .from('event_sessions')
    .select('id')
    .in('id', [...candidateIds])
    .gt('starts_at', 'now');
  return { data: (result.data as FutureSessionIdDbRow[] | null) ?? null, error: result.error };
}

interface AttendanceExistsDbRow {
  session_id: string;
}

/** One batched read: given the (already `'now'`-guarded) candidate ids, returns which of them have at
 * least one `attendance` row. */
async function queryAttendanceExistsForSessions(
  client: SupabaseClient,
  sessionIds: readonly string[],
): Promise<LoaderQueryResult<AttendanceExistsDbRow[]>> {
  const result = await client
    .from('attendance')
    .select('session_id')
    .in('session_id', [...sessionIds]);
  return { data: (result.data as AttendanceExistsDbRow[] | null) ?? null, error: result.error };
}

/**
 * `makeSaveMeetingSeries` (D015/D016 -- full record: `docs/swarm/dispute-log.md`). Does, in order:
 *
 * 1. Partial `events` update -- `title`, `team_ids`, `location_name`, `description` ONLY. `address`,
 *    `counts_participation`, `counts_volunteer_hours`, `adult_volunteers_count`,
 *    `adult_volunteer_hours` are never named in the update's column set.
 * 2. Load fresh sessions via `queryEditableSessionsForEvent` (via `createLoader`) -- fresh, not the
 *    page's stale in-memory rows.
 * 3. Map to `ExistingMeetingSeriesSession[]`, call `computeMeetingSeriesReconcilePlan(existing,
 *    payload.desiredFutureSessions, new Date())` -- a FRESH `now`, independent of the dialog's own
 *    confirmation-preview `now` (disclosed race, same non-atomicity class as this file's own existing
 *    "events insert succeeds, sessions insert fails" risk).
 * 4. `plan.toUpdate` -> `Promise.all`-parallelized per-row updates of `starts_at`/`ends_at` ONLY
 *    (matches `outreach.ts:1553-1559`'s own handling of per-row-DISTINCT-value updates -- not
 *    batched, Postgrest cannot batch one statement into per-row-different values without an RPC).
 * 5. `plan.toInsert` -> one batched insert (`status: 'scheduled'`), same shape `makeCreateMeetings`'s
 *    own `insertSessions` (each session's own `notes` is already `''` by the time it reaches here --
 *    the dialog computes `desiredFutureSessions` with `notes` hardcoded to `''`, per-session notes
 *    being T605's scope).
 * 6. `plan.toRemove` -> steps a-e BATCHED, step f PER-ID PAIRED (D015's ruled fix, D016's fixed `f2`),
 *    only if `plan.toRemove.length > 0`:
 *    a. `safeIds = await queryStillFutureSessionIds(plan.toRemove.map(r => r.sessionId))` -- the
 *       D015 MAJOR-fixed guard, `'now'` evaluated server-side.
 *    b. If `safeIds.length === 0`, stop here.
 *    c. `attendanceIds` = the subset of `safeIds` with at least one `attendance` row -- batched, one
 *       query for the whole `safeIds` set.
 *    d. `toCancel = safeIds` with attendance; `toDelete = safeIds` without.
 *    e. If `toCancel.length > 0`: ONE batched `update event_sessions set status = 'canceled' where id
 *       in (:toCancel)` -- RSVPs for these are NOT touched.
 *    f. If `toDelete.length > 0`, PER ID, as an independent pair -- see `removeOneSession` below.
 *
 * An equivalent `starts_at`-guarded delete on `rsvps` is impossible to express over PostgREST
 * (stated so no reader goes hunting for it): `rsvps` has no `starts_at` column of its own, and
 * PostgREST has no mechanism to filter a `DELETE` by a column on a different, embedded/joined table.
 * The protection for `rsvps` comes entirely from `safeIds` already having passed the `'now'`-guarded
 * query in step a before step f ever runs -- and, per D016, from the fact that `cancelSession` (not a
 * second RSVP-side guard) is what absorbs the residual race.
 *
 * The residual, MERGED into one class per D016 §5/Q5 (a limitation, not a deferred defect): if a
 * session's `starts_at` crosses `now`, OR attendance/a fresh RSVP lands, in the window between step
 * c's batched pre-check and that ONE session's own `f2` call, that session ends `'canceled'` with its
 * own RSVPs already deleted by its own `f1`. Both triggers now produce the identical,
 * identically-visible outcome -- there is no longer a silent variant. This is bounded to AT MOST the
 * one raced session -- never the whole `toDelete` batch -- and it satisfies the owner's own fallback
 * ruling verbatim ("the delete must fall back to cancelling rather than failing the coach's save").
 */
export function makeSaveMeetingSeries(
  getClient: () => SupabaseClient = getSupabaseClient,
): OnSaveMeetingSeriesFn {
  const loadEditableSessions = createLoader<string, EditableMeetingSessionDbRow[]>(
    queryEditableSessionsForEvent,
    getClient,
  );
  const loadStillFutureIds = createLoader<readonly string[], FutureSessionIdDbRow[]>(
    queryStillFutureSessionIds,
    getClient,
  );
  const loadAttendanceExists = createLoader<readonly string[], AttendanceExistsDbRow[]>(
    queryAttendanceExistsForSessions,
    getClient,
  );

  const updateEvent = runMutation<
    { eventId: string; event: SaveMeetingSeriesPayload['event'] },
    void
  >(
    (client, args) =>
      client
        .from('events')
        .update({
          title: args.event.title,
          team_ids: args.event.teamIds,
          location_name: args.event.locationName,
          description: args.event.description,
        })
        .eq('id', args.eventId),
    getClient,
  );

  const updateSessionTime = runMutation<
    { sessionId: string; session: CreateMeetingsSessionPayload },
    void
  >(
    (client, args) =>
      client
        .from('event_sessions')
        .update({ starts_at: args.session.startsAt, ends_at: args.session.endsAt })
        .eq('id', args.sessionId),
    getClient,
  );

  const insertSessionsForEvent = runMutation<
    { eventId: string; sessions: CreateMeetingsSessionPayload[] },
    void
  >(
    (client, args) =>
      client.from('event_sessions').insert(
        args.sessions.map((session) => ({
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

  const cancelSessionsBatched = runMutation<readonly string[], void>(
    (client, ids) =>
      client
        .from('event_sessions')
        .update({ status: 'canceled' })
        .in('id', [...ids]),
    getClient,
  );

  // D016 §5/Q3 -- explicit `runMutation` definitions for all three f-step
  // helpers; `deleteSessionIfStillFuture`'s result type is concrete (its
  // return value is load-bearing, not decorative -- see its own doc below).
  const deleteRsvpsForSession = runMutation<string, void>(
    (client, sessionId) => client.from('rsvps').delete().eq('session_id', sessionId),
    getClient,
  );

  interface DeletedSessionIdRow {
    id: string;
  }

  /**
   * D016's fix. Chains the SAME server-side `'now'` guard directly onto the delete (D015's
   * MAJOR) AND selects the deleted row's id back (D016's addition) -- `.select()` after
   * `.delete()` is real in the installed `@supabase/postgrest-js@2.110.7`
   * (`PostgrestTransformBuilder.select`, which the delete builder extends). The return value is
   * LOAD-BEARING: an empty array means the guard fired AFTER `deleteRsvpsForSession` had already
   * run for this same id -- `starts_at` crossed `now` in the three-plus round trips between step
   * a's batched guard and this call -- OR the session was concurrently removed by something else
   * entirely. PostgREST cannot distinguish the two, and D016 rules that distinguishing them is
   * unnecessary: `cancelSession` below is benign either way (a cancel on an already-gone id
   * updates zero rows and resolves).
   */
  const deleteSessionIfStillFuture = runMutation<string, DeletedSessionIdRow[]>(
    (client, sessionId) =>
      client
        .from('event_sessions')
        .delete()
        .eq('id', sessionId)
        .gt('starts_at', 'now')
        .select('id'),
    getClient,
  );

  /**
   * D015's ruled fallback, reused by BOTH the `23503` branch (attendance/fresh-RSVP raced in)
   * and D016's empty-result branch (the time boundary raced instead) -- as of D016 these are
   * ONE residual class with an identical, identically-visible outcome, not two (Known Risks).
   *
   * DELIBERATELY, PERMANENTLY NOT time-guarded (D016 §3 -- load-bearing, do not "harden" this
   * back into the defect): a symmetric `.gt('starts_at', 'now')` here would silently no-op in
   * EXACTLY the raced case this function exists to repair -- by the time this runs, the session
   * has already crossed into the past, and its RSVPs are already gone. This function's entire
   * purpose is to mark that session visibly `canceled` instead of leaving it lying on screen as
   * an ordinary `scheduled` meeting with destroyed RSVP data. Refusing to touch a past session
   * here is not caution; it is the bug D016 exists to close.
   */
  const cancelSession = runMutation<string, void>(
    (client, sessionId) =>
      client.from('event_sessions').update({ status: 'canceled' }).eq('id', sessionId),
    getClient,
  );

  async function removeOneSession(sessionId: string): Promise<void> {
    // f1 -- RSVPs first (the owner's own ordering). ANY error here means this pair's
    // session delete is never attempted, and the error propagates (the save rejects) --
    // never caught, never swallowed.
    await deleteRsvpsForSession(sessionId);
    try {
      const deletedRows = await deleteSessionIfStillFuture(sessionId);
      // D016 -- zero rows means f1 already acted on a session that then turned out to be no
      // longer strictly future (or was concurrently removed). Route to the SAME repair as the
      // 23503 branch below -- deliberately, since both triggers now produce one identical,
      // identically-visible outcome. `?? []` defends the same "empty is `[]` or `undefined`"
      // case D016's own text names (`runMutation` coerces a `null` `data` to `undefined`),
      // even though a successful non-`.single()` select should always resolve `[]` on zero
      // rows. The `?? []` stays -- it is still necessary defensively.
      if ((deletedRows ?? []).length === 0) {
        await cancelSession(sessionId);
      }
    } catch (error) {
      if (isSupabaseLoaderError(error) && error.code === '23503') {
        // Attendance (or a fresh RSVP) raced in between the batched pre-check (c) and THIS
        // id's own delete -- cancel THIS id only. If this cancel itself throws, it
        // propagates (never swallowed).
        await cancelSession(sessionId);
      } else {
        throw error;
      }
    }
  }

  return async (payload: SaveMeetingSeriesPayload): Promise<void> => {
    await updateEvent({ eventId: payload.eventId, event: payload.event });

    const existingRows = await loadEditableSessions(payload.eventId);
    const existing: ExistingMeetingSeriesSession[] = (existingRows ?? []).map((row) => ({
      sessionId: row.id,
      sessionDate: row.session_date,
      startsAt: row.starts_at,
      endsAt: row.ends_at,
      status: row.status,
    }));

    // A fresh `now`, independent of the dialog's own confirmation-preview `now`.
    const plan = computeMeetingSeriesReconcilePlan(
      existing,
      payload.desiredFutureSessions,
      new Date(),
    );

    await Promise.all(plan.toUpdate.map((item) => updateSessionTime(item)));

    if (plan.toInsert.length > 0) {
      await insertSessionsForEvent({ eventId: payload.eventId, sessions: plan.toInsert });
    }

    if (plan.toRemove.length > 0) {
      const stillFutureRows = await loadStillFutureIds(plan.toRemove.map((r) => r.sessionId));
      const safeIds = (stillFutureRows ?? []).map((r) => r.id);
      if (safeIds.length > 0) {
        const attendanceRows = await loadAttendanceExists(safeIds);
        const attendanceIds = new Set((attendanceRows ?? []).map((r) => r.session_id));
        const toCancel = safeIds.filter((id) => attendanceIds.has(id));
        const toDelete = safeIds.filter((id) => !attendanceIds.has(id));

        if (toCancel.length > 0) {
          await cancelSessionsBatched(toCancel);
        }

        // Cross-pair sequencing: PARALLEL. Pairs touch disjoint rows and are independent
        // (D015 §2). Consequence, disclosed: if one pair rejects, `Promise.all` rejects (the
        // save rejects) while sibling pairs already in flight may still complete their own
        // mutations against the database -- the same disclosed non-atomicity class this file
        // already carries for "events insert succeeds, sessions insert fails."
        await Promise.all(toDelete.map((id) => removeOneSession(id)));
      }
    }
  };
}

/** `ScheduleMeetingsDialog.tsx`'s own default `onSaveMeetingSeries`. */
export const saveMeetingSeries: OnSaveMeetingSeriesFn = makeSaveMeetingSeries();

// ---------------------------------------------------------------------------
// `getClient` is injectable (defaults to the shared singleton), same
// convention every prior `loaders/*.ts` file in this directory already
// established, so tests can supply a stubbed transport with zero real
// network calls.
// ---------------------------------------------------------------------------

/** Coach view real load (Trap #1; T122 module doc above item b adds
 * `rsvps`/`students`; GAM-446 module doc above adds `v_event_attendance`). */
export function makeLoadCoachMeetingsData(
  getClient: () => SupabaseClient = getSupabaseClient,
): LoadCoachMeetingsDataFn {
  const loadEventRows = createLoader<void, EventDbRow[]>(queryEvents, getClient);
  const loadSessionRows = createLoader<void, EventSessionDbRow[]>(querySessions, getClient);
  const loadTeamRows = createLoader<void, TeamDbRow[]>(queryTeams, getClient);
  const loadAttendanceRows = createLoader<void, AttendanceDbRow[]>(queryAttendance, getClient);
  const loadRsvpRows = createLoader<void, RsvpDbRow[]>(queryRsvps, getClient);
  const loadStudentRows = createLoader<void, StudentDbRow[]>(queryStudents, getClient);
  // GAM-446 -- the seventh query, same `createLoader` seam, same batch below.
  const loadEventAttendanceRows = createLoader<void, EventAttendanceDbRow[]>(
    queryEventAttendance,
    getClient,
  );
  return async (): Promise<CoachMeetingsData> => {
    const [
      eventRows,
      sessionRows,
      teamRows,
      attendanceRows,
      rsvpRows,
      studentRows,
      eventAttendanceRows,
    ] = await Promise.all([
      loadEventRows(),
      loadSessionRows(),
      loadTeamRows(),
      loadAttendanceRows(),
      loadRsvpRows(),
      loadStudentRows(),
      loadEventAttendanceRows(),
    ]);
    const rows = buildCoachMeetingRows(
      (eventRows ?? []).map(mapEventDbRow),
      (sessionRows ?? []).map(mapSessionDbRow),
      (teamRows ?? []).map(mapTeamDbRow),
      (attendanceRows ?? []).map(mapAttendanceDbRow),
      (rsvpRows ?? []).map(mapRsvpDbRow),
      (studentRows ?? []).map(mapStudentDbRow),
    );
    // GAM-446 (module doc above) -- merge onto `buildCoachMeetingRows`' own
    // RETURNED array, KEYED BY `eventId`, never by array position: the
    // view's row order has no guaranteed relationship to `rows`' own order.
    const eventAttendanceByEventId = new Map(
      (eventAttendanceRows ?? [])
        .map(mapEventAttendanceDbRow)
        .map((eventAttendance) => [eventAttendance.eventId, eventAttendance] as const),
    );
    return {
      rows: rows.map((row) => {
        const eventAttendance = eventAttendanceByEventId.get(row.eventId);
        // No fabricated `0`/`null` for a row whose event id is somehow
        // absent from the view (module doc above) -- these five fields
        // simply stay `undefined` on that row.
        if (eventAttendance === undefined) return row;
        return {
          ...row,
          attendancePct: eventAttendance.attendancePct,
          heldCt: eventAttendance.heldCt,
          gradedMarksCt: eventAttendance.gradedMarksCt,
          attendedMarksCt: eventAttendance.attendedMarksCt,
          excusedCt: eventAttendance.excusedCt,
        };
      }),
      // T147 -- `teamRows` was already fetched (above, in this same
      // `Promise.all` batch) for `buildCoachMeetingRows`'s own per-row
      // team-scope label; it never left this function until now. No new
      // query, no new round trip -- just threading the same already-fetched
      // list through to `CoachMeetingsData` too, so
      // `MeetingsList.tsx`'s `<ScheduleMeetingsDialog>` can be passed real
      // teams instead of its own fixture `DEFAULT_TEAMS`.
      teams: (teamRows ?? []).map(mapTeamDbRow),
    };
  };
}

/** `MeetingsList.tsx`'s own default `loadCoachData` -- real query. */
export const loadCoachMeetingsData: LoadCoachMeetingsDataFn = makeLoadCoachMeetingsData();

/** Student/parent view real load. */
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
  const loadActiveTeamRows = createLoader<string, StudentTeamDbRow[]>(
    queryActiveStudentTeams,
    getClient,
  );
  return async (studentId: string): Promise<StudentMeetingsData> => {
    const [eventRows, sessionRows, attendanceRows, participationRows, activeTeamRows] =
      await Promise.all([
        loadEventRows(),
        loadSessionRows(),
        loadAttendanceRows(studentId),
        loadParticipationRows(studentId),
        loadActiveTeamRows(studentId),
      ]);
    const activeTeamIds = new Set((activeTeamRows ?? []).map((row) => row.team_id));
    const visibleEvents = (eventRows ?? []).filter(
      (event) =>
        event.team_ids === null || event.team_ids.some((teamId) => activeTeamIds.has(teamId)),
    );
    const visibleEventIds = new Set(visibleEvents.map((event) => event.id));
    const participationRow = selectSingleParticipationRow(participationRows ?? []);
    return buildStudentMeetingsData(
      studentId,
      visibleEvents.map(mapEventDbRow),
      (sessionRows ?? [])
        .filter((session) => visibleEventIds.has(session.event_id))
        .map(mapSessionDbRow),
      (attendanceRows ?? []).map(mapAttendanceDbRow),
      participationRow === null ? [] : [mapParticipationDbRow(participationRow)],
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

/**
 * T605 -- a real, guarded, IN-PLACE `event_sessions` UPDATE for editing ONE
 * session inside a series (date, start/end time, notes). NOT a call into
 * `makeSaveMeetingSeries`/`computeMeetingSeriesReconcilePlan`: that
 * function's `toUpdate` path only ever changes `starts_at`/`ends_at` for a
 * session matched BY ITS EXISTING `session_date` -- a date change there is
 * remove-old+insert-new (new `id`, RSVPs deleted per D015). Editing one
 * session in place must preserve its `id` and its existing RSVPs. This is
 * not invented from nothing -- `loaders/outreach.ts:1497-1512`/`:254-262` is
 * the same shape, same rationale (matching by `session_date`, updating in
 * place, preserving `id` so already-attached `rsvps`/`attendance` rows stay
 * correctly attached), with one disclosed difference: outreach's version
 * never rewrites `session_date` itself (it matches an existing row BY that
 * column, so a date change there is handled as a different row entirely);
 * this task's mutation explicitly DOES rewrite `session_date` in place,
 * because moving one session to a different calendar day while preserving
 * its identity/RSVPs is the entire point of an "edit," not a limitation to
 * route around.
 *
 * Enforcement split (fixes B1's framing error in an earlier packet
 * revision) -- this task has TWO distinct hazards, with TWO distinct
 * enforcement points; do not conflate them:
 *   1. "The session changed state between dialog-open and save" (started,
 *      canceled, completed, deleted) -- the DB-level guard below
 *      (`.eq('status','scheduled').gt('starts_at','now').select('id')`) is
 *      real enforcement, because it reads the row's LIVE pre-update state at
 *      write time -- the same defense-in-depth split D015/D016 established
 *      for the series path's own delete guard.
 *   2. "The coach's own new value is nonsensical" (a mistyped date/time that
 *      lands in the past, or an end time before the start time) -- the DB
 *      guard STRUCTURALLY CANNOT catch this, because a `WHERE` clause only
 *      ever evaluates a row's EXISTING column values, never the values being
 *      written in the same statement's `SET`. There is no CHECK constraint
 *      on `event_sessions` for this (adding one is a migration, out of
 *      scope). For hazard 2, the app-level validation in
 *      `computeMeetingSessionEditPayload`
 *      (`../../../pages/meetings/EditMeetingSessionDialog.tsx`) is the ONLY
 *      enforcement point that exists.
 *
 * Do not adopt `postgrest-js`'s `maxAffected()` even though it ships in the
 * installed `@supabase/postgrest-js@2.110.7` -- it depends on a PostgREST
 * server version this repo has not verified against hosted Supabase.
 */
interface UpdatedMeetingSessionIdRow {
  id: string;
}

export function makeSaveMeetingSession(
  getClient: () => SupabaseClient = getSupabaseClient,
): OnSaveMeetingSessionFn {
  const updateSession = runMutation<SaveMeetingSessionPayload, UpdatedMeetingSessionIdRow[]>(
    (client, payload) =>
      client
        .from('event_sessions')
        .update({
          session_date: payload.sessionDate,
          starts_at: payload.startsAt,
          ends_at: payload.endsAt,
          notes: payload.notes,
        })
        .eq('id', payload.sessionId)
        .eq('status', 'scheduled')
        .gt('starts_at', 'now')
        .select('id'),
    getClient,
  );

  return async (payload: SaveMeetingSessionPayload): Promise<void> => {
    const updatedRows = await updateSession(payload);
    if ((updatedRows ?? []).length === 0) {
      // REJECT, never silently succeed (D016's own honesty-bar reasoning,
      // applied to an update instead of a delete). Two real,
      // indistinguishable-over-PostgREST causes collapse into this one
      // branch: (a) the pre-update row no longer matched
      // status='scheduled'/starts_at>now (it started, or changed, between
      // dialog-open and save), or (b) RLS silently filtered the row because
      // the caller lacks permission -- a non-staff UPDATE also returns zero
      // matched rows, not an error (fixes m5: do not assert a single
      // specific cause).
      throw new Error(
        "This meeting session couldn't be updated. It may have already started, your permissions may " +
          'have changed, or your changes may be out of date. Refresh the page and try again.',
      );
    }
  };
}

/** `EditMeetingSessionDialog.tsx`'s own default `onSaveMeetingSession`. */
export const saveMeetingSession: OnSaveMeetingSessionFn = makeSaveMeetingSession();

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
