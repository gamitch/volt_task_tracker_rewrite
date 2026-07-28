/**
 * T126 (PRD v2 UXP-03): real `attendance` data-layer wiring for the new
 * student/parent retroactive self check-off surface
 * (`src/pages/outreach/SelfCheckoffDialog.tsx`). Built on T086's
 * `createLoader`/`runMutation` (`../loader.ts`, read-only import here), same
 * DI (`getClient`) convention every prior loader module in this directory
 * already established (e.g. `loaders/attendance.ts`, a Forbidden File for
 * this task -- this is a deliberately SEPARATE, standalone module, not an
 * edit to that file).
 *
 * -----------------------------------------------------------------------
 * 1. Ground truth -- `attendance` column shapes, cited directly from
 *    `supabase/migrations/20260717000000_scheduling_attendance.sql` lines
 *    82-95 (read-only, unmodified by this task), PLUS this task's own new,
 *    additive migration `supabase/migrations/20260724000000_self_checkoff.sql`
 *    (widens the `method` check constraint to include `'self'`; adds
 *    `self_insert`/`self_delete` RLS policies -- see that file for the full
 *    scratch-Postgres-verified writeup):
 *
 *      id uuid pk, session_id uuid not null fk event_sessions (restrict),
 *      student_id uuid not null fk students (restrict), status text check
 *      ('present'|'late'|'excused'|'absent'), check_in_at timestamptz null,
 *      check_out_at timestamptz null, hours_override numeric null, method
 *      text check ('qr'|'coach'|'import'|'self'), recorded_by uuid fk
 *      profiles (nullable, restrict), updated_at, created_at, unique
 *      (session_id, student_id).
 *
 *    `self_insert` (`with check (student_id in (select my_student_ids())
 *    and method = 'self' and recorded_by = auth.uid())`) and `self_delete`
 *    (`using (student_id in (select my_student_ids()) and method =
 *    'self')`) are the two policies this file's `insertSelfCheckoff`/
 *    `removeSelfCheckoff` rely on -- both real Postgres RLS enforcement,
 *    scratch-verified (positive AND negative matrix) in the migration file's
 *    own comment block, not re-derived or assumed here.
 *
 * -----------------------------------------------------------------------
 * 2. Why this is a SEPARATE loader module from `loaders/attendance.ts`
 *    (Forbidden File): that file's own `AttendanceMethod` type is `'qr' |
 *    'coach' | 'import'` (T117, predates this task's migration) and its own
 *    `AttendanceRow`/mappers do not carry `method` through to
 *    `AttendancePanel.tsx`'s own narrower consuming shape in a way this
 *    task could safely extend without editing that file. This module
 *    independently re-implements the small subset of `attendance` read/
 *    write it needs -- same "independently reimplemented, not imported"
 *    precedent `MarkDayCompleteDialog.tsx`/`AttendancePanel.tsx` already
 *    established relative to each other and to `OutreachDetail.tsx`.
 *
 *    Trap #1 (constitution item 3) -- zero hours math here. `insertSelfCheckoff`
 *    always writes `hours_override: null` and never reads/writes
 *    `check_in_at`/`check_out_at` -- this module contains no coalesce/case
 *    chain over those columns anywhere (grep-provable). `v_student_hours`
 *    (`20260717000003_metric_views.sql`, read-only, unmodified) already
 *    coalesces exactly that null-override/null-check-in shape to its own
 *    tier-3 session-length fallback for ANY qualifying `attendance` row
 *    regardless of `method` -- that is the real "default hours" mechanism
 *    (verified directly against a live scratch-Postgres instance in the
 *    migration file's own comment block), not anything this loader computes.
 *
 * -----------------------------------------------------------------------
 * 3. Load -- `loadSelfCheckoffAttendance(sessionIds, studentId)` fetches
 *    `session_id, student_id, status, method` for exactly one student across
 *    a set of sessions (an event's own eligible days), scoped narrowly so
 *    `SelfCheckoffDialog.tsx` can distinguish "already recorded by someone
 *    else" (`method !== 'self'`, locked -- never insertable/removable by
 *    this surface) from "self-recorded, removable" (`method === 'self'`)
 *    from "not recorded yet" (no row) for each day it renders. RLS's own
 *    `own_or_linked_read` policy (already shipped, unmodified) already
 *    scopes this to rows the caller's `my_student_ids()` covers -- the
 *    explicit `.eq('student_id', studentId)` here is a belt-and-suspenders
 *    narrowing to exactly the ONE student this dialog is open for, not a
 *    substitute for that RLS floor.
 *
 * -----------------------------------------------------------------------
 * 4. Write -- plain INSERT, never upsert (module doc on the migration file:
 *    "no update policy... delete + re-insert"). `insertSelfCheckoff` always
 *    writes `status: 'present'`, `method: 'self'`, `hours_override: null`,
 *    `check_in_at`/`check_out_at: null`. `removeSelfCheckoff` issues a plain
 *    DELETE additionally filtered by `.eq('method', 'self')` client-side
 *    (mirrors, does not substitute for, `self_delete`'s own server-side
 *    `method = 'self'` scope) -- this file never attempts to delete a
 *    non-self row; the RLS policy is the real enforcement regardless.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { createLoader, runMutation, type LoaderQueryResult } from '../loader';
import { getSupabaseClient } from '../client';

// ---------------------------------------------------------------------------
// Types -- verbatim camelCase renames of the real `attendance` column subset
// this feature needs (module doc #1).
// ---------------------------------------------------------------------------

export type SelfCheckoffAttendanceStatus = 'present' | 'late' | 'excused' | 'absent';
export type SelfCheckoffAttendanceMethod = 'qr' | 'coach' | 'import' | 'self';

export interface SelfCheckoffAttendanceRow {
  sessionId: string;
  studentId: string;
  status: SelfCheckoffAttendanceStatus;
  method: SelfCheckoffAttendanceMethod;
}

interface SelfCheckoffAttendanceDbRow {
  session_id: string;
  student_id: string;
  status: SelfCheckoffAttendanceStatus;
  method: SelfCheckoffAttendanceMethod;
}

function mapDbRowToSelfCheckoffAttendanceRow(
  row: SelfCheckoffAttendanceDbRow,
): SelfCheckoffAttendanceRow {
  return {
    sessionId: row.session_id,
    studentId: row.student_id,
    status: row.status,
    method: row.method,
  };
}

// ---------------------------------------------------------------------------
// Load -- module doc #3.
// ---------------------------------------------------------------------------

export type LoadSelfCheckoffAttendanceFn = (
  sessionIds: readonly string[],
  studentId: string,
) => Promise<SelfCheckoffAttendanceRow[]>;

async function querySelfCheckoffAttendance(
  client: SupabaseClient,
  args: { sessionIds: readonly string[]; studentId: string },
): Promise<LoaderQueryResult<SelfCheckoffAttendanceDbRow[]>> {
  const result = await client
    .from('attendance')
    .select('session_id, student_id, status, method')
    .in('session_id', [...args.sessionIds])
    .eq('student_id', args.studentId);
  return {
    data: (result.data as SelfCheckoffAttendanceDbRow[] | null) ?? null,
    error: result.error,
  };
}

export function makeLoadSelfCheckoffAttendance(
  getClient: () => SupabaseClient = getSupabaseClient,
): LoadSelfCheckoffAttendanceFn {
  const loadRows = createLoader<
    { sessionIds: readonly string[]; studentId: string },
    SelfCheckoffAttendanceDbRow[]
  >(querySelfCheckoffAttendance, getClient);
  return async (sessionIds, studentId) => {
    if (sessionIds.length === 0) return [];
    const rows = await loadRows({ sessionIds, studentId });
    return (rows ?? []).map(mapDbRowToSelfCheckoffAttendanceRow);
  };
}

/** Default `loadAttendance` for `SelfCheckoffDialog.tsx` -- real query. */
export const loadSelfCheckoffAttendance: LoadSelfCheckoffAttendanceFn =
  makeLoadSelfCheckoffAttendance();

// ---------------------------------------------------------------------------
// Insert -- module doc #4. The ONE place a `'self'` row is ever created.
// ---------------------------------------------------------------------------

export interface InsertSelfCheckoffParams {
  sessionId: string;
  studentId: string;
  /** `attendance.recorded_by` -- the ACTING viewer's own `profiles.id`
   * (a student self-checking off, or a parent checking off their linked
   * student) -- `self_insert`'s own `with check` requires this to equal
   * `auth.uid()`. */
  recordedBy: string;
}

export type InsertSelfCheckoffFn = (
  params: InsertSelfCheckoffParams,
) => Promise<SelfCheckoffAttendanceRow>;

export function makeInsertSelfCheckoff(
  getClient: () => SupabaseClient = getSupabaseClient,
): InsertSelfCheckoffFn {
  const mutate = runMutation<InsertSelfCheckoffParams, SelfCheckoffAttendanceDbRow>(
    (client, params) =>
      client
        .from('attendance')
        .insert({
          session_id: params.sessionId,
          student_id: params.studentId,
          status: 'present',
          check_in_at: null,
          check_out_at: null,
          hours_override: null,
          method: 'self',
          recorded_by: params.recordedBy,
        })
        .select('session_id, student_id, status, method')
        .single(),
    getClient,
  );
  return async (params) => mapDbRowToSelfCheckoffAttendanceRow(await mutate(params));
}

/** Default `onInsert` for `SelfCheckoffDialog.tsx` -- real insert. */
export const insertSelfCheckoff: InsertSelfCheckoffFn = makeInsertSelfCheckoff();

// ---------------------------------------------------------------------------
// Delete -- module doc #4. The ONE place a `'self'` row is ever removed.
// ---------------------------------------------------------------------------

export interface RemoveSelfCheckoffParams {
  sessionId: string;
  studentId: string;
}

export type RemoveSelfCheckoffFn = (params: RemoveSelfCheckoffParams) => Promise<void>;

export function makeRemoveSelfCheckoff(
  getClient: () => SupabaseClient = getSupabaseClient,
): RemoveSelfCheckoffFn {
  const mutate = runMutation<RemoveSelfCheckoffParams, void>(
    (client, params) =>
      client
        .from('attendance')
        .delete()
        .eq('session_id', params.sessionId)
        .eq('student_id', params.studentId)
        // Client-side mirror of `self_delete`'s own server-side `method =
        // 'self'` scope (module doc #4) -- never a substitute for it.
        .eq('method', 'self'),
    getClient,
  );
  return async (params) => {
    await mutate(params);
  };
}

/** Default `onRemove` for `SelfCheckoffDialog.tsx` -- real delete. */
export const removeSelfCheckoff: RemoveSelfCheckoffFn = makeRemoveSelfCheckoff();
