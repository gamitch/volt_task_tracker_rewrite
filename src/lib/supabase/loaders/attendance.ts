/**
 * T117 (PRD v2 UXP-01): real `attendance` data-layer wiring for
 * `src/pages/outreach/AttendancePanel.tsx` -- the coach-managed,
 * per-session-day attendance + per-student hours panel on `OutreachDetail`.
 * Built on T086's `createLoader`/`runMutation` (`../loader.ts`, read-only
 * import here), same DI (`getClient`) convention every prior loader module
 * (`loaders/students.ts`, `loaders/invites.ts`) already established.
 *
 * -----------------------------------------------------------------------
 * 1. Ground truth -- `attendance` column shapes, cited directly from
 *    `supabase/migrations/20260717000000_scheduling_attendance.sql` lines
 *    82-95 (read-only, unmodified by this task -- SCH-04/T114 already
 *    proved the RLS this file relies on, `supabase/**` is Forbidden Files
 *    here regardless):
 *
 *      id uuid pk, session_id uuid not null fk event_sessions (restrict),
 *      student_id uuid not null fk students (restrict), status text check
 *      ('present'|'late'|'excused'|'absent'), check_in_at timestamptz null,
 *      check_out_at timestamptz null, hours_override numeric null, method
 *      text check ('qr'|'coach'|'import'), recorded_by uuid fk profiles
 *      (nullable, restrict), updated_at, created_at, unique (session_id,
 *      student_id).
 *
 *    SCH-04 (PRD v2 section 3, resolved 2026-07-20 by T114): `staff_all`
 *    (`for all ... using (is_staff()) with check (is_staff())`) has existed
 *    on `attendance` since v1 -- staff (admin/coach) may write any student's
 *    rows already, no new migration needed. This file is therefore pure
 *    frontend wiring against an already-permitted write surface.
 *
 * -----------------------------------------------------------------------
 * 2. TRAP #2 -- un-mark semantics (worker packet Known Context/Traps #2),
 *    THE central design decision of this file.
 *
 *    AMENDED 2026-07-20 (T119, PRD v2 section 0 decision D-7 -- George's
 *    direct product-owner override, verbatim: "As coach I am ultimate
 *    authority and should be able to overwrite an RSVP or check-ins."): the
 *    "setAbsent" branch this doc entry originally described below (demoting
 *    a real `'qr'`/`'import'` row to `status: 'absent'` instead of deleting
 *    it, to preserve `check_in_at` as history) is REMOVED. `resolveUnmark
 *    Action`/`UnmarkAction` (T117's pure decision function/type for that
 *    branch) no longer exist in this file -- un-marking a student now
 *    performs a plain DELETE for every `method` (`'coach'`, `'qr'`,
 *    `'import'`) alike; the caller (`AttendancePanel.tsx`'s `handleToggle`)
 *    calls `onRemoveAttendance` unconditionally on uncheck, no branch. The
 *    paragraphs immediately below are KEPT AS THE ORIGINAL T117 RECORD of
 *    what this reasoning was (repo convention, see `TeamsTab.tsx`/
 *    `ParentsTab.tsx`'s own "SUPERSEDED BY" notes for precedent) -- they no
 *    longer describe this file's actual behavior; a coach's attendance
 *    correction MAY now remove a QR-originated check-in row outright,
 *    per D-7.
 *
 *    `resolveAttendanceWriteMethod` below is the ONE place the CHECKED-row
 *    write-method decision is made -- pure, exported, directly tested
 *    without a fake `SupabaseClient` (same "pure decision logic, separately
 *    testable from the DB-driving wrapper" shape
 *    `supabase/functions/checkin/attendance_upsert.ts` (read-only,
 *    T032/MTG-09/MTG-11) already established for this exact table). This
 *    part is UNCHANGED by D-7 (module doc's own "3. Keep what D-7 keeps" in
 *    the T119 worker packet): it is provenance LABELING on a row a coach is
 *    actively editing while it stays checked (e.g. adjusting hours on an
 *    already-checked-in student), not a veto over deleting/overwriting
 *    anything -- D-7 only overrides veto power, not attribution.
 *
 *    ORIGINAL T117 RECORD (superseded un-mark reasoning, kept for history):
 *    unchecking an attended student DELETED the row when its existing
 *    `method` was `'coach'` (or no row existed at all -- a defensive
 *    no-op) -- this matched the reference app's plain checkbox model
 *    (packet's own wording) and was verified safe against both metric
 *    views below. When the existing row's `method` was `'qr'` or
 *    `'import'` (i.e. it carried real external provenance -- someone
 *    actually scanned in, or a row was imported), unchecking instead
 *    UPSERTED `status: 'absent'`, cleared `hours_override` to `null`, and
 *    re-attributed `recorded_by` to the acting coach, while the upsert
 *    payload never included `check_in_at`/`check_out_at` at all -- so
 *    Postgrest's `ON CONFLICT DO UPDATE SET (...)` (built only from the
 *    keys actually present in the payload) left those two columns
 *    untouched, preserving the real check-in timestamp as honest history
 *    (packet's own explicit example: "keep check_in_at, update
 *    hours_override/status, set recorded_by to the coach"). `method` itself
 *    was likewise preserved verbatim on this path (never rewritten to
 *    `'coach'`) -- the packet's own example list never said to touch
 *    `method`, and provenance ("how did this student's presence first get
 *    captured") was treated as a fact about the past that a later coach
 *    edit to status/hours did not change.
 *
 *    Verified against both metric views this table feeds
 *    (`supabase/migrations/20260717000003_metric_views.sql`, read-only) --
 *    this metrics-safety analysis remains true of the NEW plain-DELETE rule
 *    too, since DELETE was already one of the two branches proven safe here:
 *      - `v_student_hours` sums `... where a.status in ('present','late')`.
 *        A DELETED row and a `status = 'absent'` row are BOTH simply absent
 *        from that sum -- mathematically identical outcomes.
 *      - `v_student_participation` LEFT JOINs `attendance` onto the expected
 *        roster; a genuinely missing row (`a.status` is SQL `NULL` after
 *        the join) and an explicit `'absent'` row are BOTH excluded from
 *        `present_ct`/`late_ct`/`excused_ct` while both still count toward
 *        `expected_ct` -- again mathematically identical for this view's
 *        math. DELETE is therefore metrics-safe in every case this file
 *        now chooses it for.
 *
 *    `checkin` Edge Function interaction (disclosed, not a blocker,
 *    STRENGTHENED by D-7): that function's own `applyUpsertIgnoreDuplicates`
 *    (`supabase/functions/checkin/attendance_upsert.ts`, read-only) treats
 *    "no existing row for (session_id, student_id)" as "this student has
 *    never checked in" -- so if a coach DELETES ANY row for this session/
 *    student (now including a real `'qr'`/`'import'` row, per D-7) and that
 *    same student later scans a QR code for the same session, the scan is
 *    honestly treated as their first-ever check-in for that session. Under
 *    D-7 this is the correct, intended outcome for every `method`: the
 *    coach is the ultimate authority and a deletion means "this record
 *    should not stand", full stop -- there is no longer a distinction
 *    between "this coach-entered record was a mistake" and "this student's
 *    real physical check-in history should be forgotten" for the purposes
 *    of who may delete it.
 *
 * -----------------------------------------------------------------------
 * 3. Upsert key -- the packet's own banked DDL fact, applied literally.
 *
 *    Every write in this file that can hit the real `unique (session_id,
 *    student_id)` constraint uses `.upsert(..., { onConflict:
 *    'session_id,student_id' })` (no `ignoreDuplicates` -- unlike the
 *    `checkin` Edge Function's own insert-only QR path, a COACH's write is
 *    always meant to take effect, even against an existing row -- this is
 *    the intentional difference: `checkin`'s upsert models "first write
 *    wins" for a self-service kiosk flow; this file's upsert models
 *    "the acting coach's write is authoritative" for a staff-driven
 *    correction flow. Real column names only (`session_id`, `student_id`,
 *    `status`, `hours_override`, `method`, `recorded_by`) -- `check_in_at`/
 *    `check_out_at` are DELIBERATELY never included in any upsert payload
 *    this file builds (module doc #2's history-preservation mechanism).
 *
 * -----------------------------------------------------------------------
 * 4. No metric-formula re-derivation (constitution item 3). This file is a
 *    pure read/write data layer over `attendance` -- it never computes a
 *    student's confirmed-hours total, participation rate, or any other
 *    `v_student_hours`/`v_student_participation` output. `AttendancePanel.tsx`'s
 *    own module doc has the parallel disclosure for the small, honest,
 *    non-authoritative "hours recorded this event" display sum it computes
 *    locally over rows THIS panel itself just wrote (the same category of
 *    legitimate local aggregation `MarkDayCompleteDialog.tsx`'s own module
 *    doc #2(b) already established for this exact table).
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { createLoader, runMutation, type LoaderQueryResult } from '../loader';
import { getSupabaseClient } from '../client';

// ---------------------------------------------------------------------------
// Types -- verbatim camelCase renames of the real `attendance` column subset
// (module doc #1).
// ---------------------------------------------------------------------------

export type AttendanceStatus = 'present' | 'late' | 'excused' | 'absent';
export type AttendanceMethod = 'qr' | 'coach' | 'import';

export interface AttendanceRow {
  id: string;
  sessionId: string;
  studentId: string;
  status: AttendanceStatus;
  checkInAt: string | null;
  checkOutAt: string | null;
  hoursOverride: number | null;
  method: AttendanceMethod;
  recordedBy: string | null;
  updatedAt: string;
  createdAt: string;
}

/** Raw `public.attendance` row exactly as Postgrest returns it (snake_case)
 * -- module doc #1. */
interface AttendanceDbRow {
  id: string;
  session_id: string;
  student_id: string;
  status: AttendanceStatus;
  check_in_at: string | null;
  check_out_at: string | null;
  hours_override: number | null;
  method: AttendanceMethod;
  recorded_by: string | null;
  updated_at: string;
  created_at: string;
}

function mapAttendanceDbRowToAttendanceRow(row: AttendanceDbRow): AttendanceRow {
  return {
    id: row.id,
    sessionId: row.session_id,
    studentId: row.student_id,
    status: row.status,
    checkInAt: row.check_in_at,
    checkOutAt: row.check_out_at,
    hoursOverride: row.hours_override,
    method: row.method,
    recordedBy: row.recorded_by,
    updatedAt: row.updated_at,
    createdAt: row.created_at,
  };
}

// ---------------------------------------------------------------------------
// Trap #2 -- pure decision function. Module doc #2.
//
// T119 (PRD v2 D-7): `resolveUnmarkAction`/`UnmarkAction` (T117's un-mark
// branch decision) are REMOVED from this file -- un-marking is no longer a
// decision at all, it is an unconditional DELETE (`makeRemoveAttendance`
// below) for every `method`. Only `resolveAttendanceWriteMethod` (the
// CHECKED-row write-method LABEL, unchanged by D-7 per module doc #2)
// remains here.
// ---------------------------------------------------------------------------

/**
 * The write method for a coach-initiated present/hours upsert. A row that
 * already carries real external provenance (`'qr'`/`'import'`) keeps that
 * provenance; a row this coach is originating from scratch (no existing row,
 * or an existing `'coach'` row) is/stays `'coach'`.
 */
export function resolveAttendanceWriteMethod(
  existingMethod: AttendanceMethod | null,
): AttendanceMethod {
  return existingMethod === 'qr' || existingMethod === 'import' ? existingMethod : 'coach';
}

// ---------------------------------------------------------------------------
// Load -- every `attendance` row for a set of `event_sessions` ids.
// ---------------------------------------------------------------------------

export type LoadAttendanceForSessionsFn = (
  sessionIds: readonly string[],
) => Promise<AttendanceRow[]>;

async function queryAttendanceForSessions(
  client: SupabaseClient,
  sessionIds: readonly string[],
): Promise<LoaderQueryResult<AttendanceDbRow[]>> {
  const result = await client
    .from('attendance')
    .select('*')
    .in('session_id', [...sessionIds]);
  return { data: (result.data as AttendanceDbRow[] | null) ?? null, error: result.error };
}

/**
 * Injectable-`getClient` convention every prior loader module in this
 * directory already established, so tests supply a stubbed transport with
 * zero real network calls. Short-circuits to `[]` for an empty
 * `sessionIds` (an event with no sessions yet) without ever issuing a
 * `.in('session_id', [])` query, which some Postgrest configurations treat
 * as "match nothing" but is unnecessary network traffic either way.
 */
export function makeLoadAttendanceForSessions(
  getClient: () => SupabaseClient = getSupabaseClient,
): LoadAttendanceForSessionsFn {
  const loadRows = createLoader<readonly string[], AttendanceDbRow[]>(
    queryAttendanceForSessions,
    getClient,
  );
  return async (sessionIds) => {
    if (sessionIds.length === 0) return [];
    const rows = await loadRows(sessionIds);
    return (rows ?? []).map(mapAttendanceDbRowToAttendanceRow);
  };
}

/** Default `loadAttendance` for `AttendancePanel.tsx` -- real query. */
export const loadAttendanceForSessions: LoadAttendanceForSessionsFn =
  makeLoadAttendanceForSessions();

// ---------------------------------------------------------------------------
// Upsert -- the ONE place a coach's present/absent/hours write happens.
// Module doc #3.
// ---------------------------------------------------------------------------

export interface UpsertAttendanceParams {
  sessionId: string;
  studentId: string;
  status: AttendanceStatus;
  /** `null` = no explicit override -- `v_student_hours`'s own coalesce falls
   * back to the real session-duration tier itself; never back-filled with a
   * computed default here (same discipline
   * `MarkDayCompleteDialog.tsx`'s own `buildAttendanceWriteRows` already
   * established for this exact column). */
  hoursOverride: number | null;
  method: AttendanceMethod;
  /** `attendance.recorded_by` -- always the ACTING coach's own
   * `profiles.id` (module doc #2 -- always re-attributed to whoever is
   * editing right now, even when `method` itself is preserved as `'qr'`). */
  recordedBy: string;
}

export type UpsertAttendanceFn = (params: UpsertAttendanceParams) => Promise<AttendanceRow>;

/**
 * Module doc #3 -- `onConflict: 'session_id,student_id'`, the packet's own
 * banked DDL fact, applied literally. Deliberately never includes
 * `check_in_at`/`check_out_at` in the payload (module doc #2's history-
 * preservation mechanism: Postgrest's `ON CONFLICT DO UPDATE SET` only ever
 * touches columns present in the payload). Resolves the freshly-written row
 * (`.select().single()`) so the caller can merge the real DB-assigned
 * `id`/`updatedAt`/`createdAt` into local state, same "resolve the written
 * row" discipline `loaders/students.ts`'s own `createStudent`/
 * `updateStudent` already established.
 */
export function makeUpsertAttendance(
  getClient: () => SupabaseClient = getSupabaseClient,
): UpsertAttendanceFn {
  const mutate = runMutation<UpsertAttendanceParams, AttendanceDbRow>(
    (client, params) =>
      client
        .from('attendance')
        .upsert(
          {
            session_id: params.sessionId,
            student_id: params.studentId,
            status: params.status,
            hours_override: params.hoursOverride,
            method: params.method,
            recorded_by: params.recordedBy,
          },
          { onConflict: 'session_id,student_id' },
        )
        .select()
        .single(),
    getClient,
  );
  return async (params) => mapAttendanceDbRowToAttendanceRow(await mutate(params));
}

/** Default `onUpsertAttendance` for `AttendancePanel.tsx` -- real upsert. */
export const upsertAttendance: UpsertAttendanceFn = makeUpsertAttendance();

// ---------------------------------------------------------------------------
// Delete -- the ONE place the `'delete'` un-mark action (module doc #2) is
// executed.
// ---------------------------------------------------------------------------

export interface RemoveAttendanceParams {
  sessionId: string;
  studentId: string;
}

export type RemoveAttendanceFn = (params: RemoveAttendanceParams) => Promise<void>;

export function makeRemoveAttendance(
  getClient: () => SupabaseClient = getSupabaseClient,
): RemoveAttendanceFn {
  const mutate = runMutation<RemoveAttendanceParams, void>(
    (client, params) =>
      client
        .from('attendance')
        .delete()
        .eq('session_id', params.sessionId)
        .eq('student_id', params.studentId),
    getClient,
  );
  return async (params) => {
    await mutate(params);
  };
}

/** Default `onRemoveAttendance` for `AttendancePanel.tsx` -- real delete. */
export const removeAttendance: RemoveAttendanceFn = makeRemoveAttendance();
