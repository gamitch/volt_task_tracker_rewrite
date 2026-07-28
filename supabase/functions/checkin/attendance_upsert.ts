// T032: pure decision logic for MTG-09 (idempotent duplicate check-in) +
// MTG-11 (a coach's `method='coach'` row always wins over a QR write). This
// module contains no Supabase/network calls, so it is exercised by an
// in-memory fake "table" in attendance_upsert.test.ts without a live DB.
//
// index.ts drives the REAL equivalent against Postgres via:
//   adminClient.from('attendance').upsert(
//     { session_id, student_id, status, check_in_at, method: 'qr', recorded_by },
//     { onConflict: 'session_id,student_id', ignoreDuplicates: true },
//   )
// which supabase-js compiles to `INSERT ... ON CONFLICT (session_id,
// student_id) DO NOTHING`, then re-selects the row. `applyUpsertIgnoreDuplicates`
// below models exactly that DO-NOTHING-on-conflict semantic against a plain
// Map, and `resolveResponse` models the re-select + response-shaping step.
//
// DESIGN DECISION (flagged explicitly, not a silent deviation from the
// packet's illustrative SQL): the packet's worked example was `ON CONFLICT
// ... DO UPDATE SET ... WHERE attendance.method <> 'coach'` (update unless
// the existing row is coach-recorded). This module instead uses
// unconditional DO NOTHING on ANY existing row, for both of these reasons:
//   1. MTG-11 only requires that a `method='coach'` row is never
//      overwritten -- DO NOTHING is a strict superset of that guarantee
//      (it also never overwrites an existing 'qr' or 'import' row).
//   2. MTG-09's own worked example ("show 'Already checked in at 6:04 PM'")
//      implies the ORIGINAL check-in time is preserved on a repeat scan,
//      not replaced by the repeat scan's time. A DO UPDATE (even guarded to
//      `method <> 'coach'`) would silently overwrite check_in_at/status on
//      a second legitimate QR scan of the same student for the same
//      session, which would contradict that example. DO NOTHING avoids
//      this ambiguity entirely: first write for a given (session_id,
//      student_id) always wins, regardless of method.
// The packet's own wording explicitly allows this ("... guard (or
// equivalent)").

export interface AttendanceRow {
  id: string;
  session_id: string;
  student_id: string;
  status: 'present' | 'late' | 'excused' | 'absent';
  check_in_at: string | null;
  check_out_at: string | null;
  hours_override: number | null;
  method: 'qr' | 'coach' | 'import';
  recorded_by: string | null;
  updated_at: string;
  created_at: string;
}

export interface CheckinWriteAttempt {
  session_id: string;
  student_id: string;
  status: 'present' | 'late';
  /** ISO timestamp this specific call attempted to write. */
  check_in_at: string;
  recorded_by: string;
}

function tableKey(sessionId: string, studentId: string): string {
  return `${sessionId}:${studentId}`;
}

/**
 * Models `upsert(..., { onConflict: 'session_id,student_id', ignoreDuplicates: true })`
 * against a fake table. If a row already exists for (session_id,
 * student_id) -- of ANY method, including 'coach' -- it is returned
 * completely untouched (this is what makes MTG-11 true). Otherwise a new
 * `method: 'qr'` row is inserted and returned.
 */
export function applyUpsertIgnoreDuplicates(
  table: Map<string, AttendanceRow>,
  attempt: CheckinWriteAttempt,
  newId: () => string,
  nowIso: () => string,
): AttendanceRow {
  const key = tableKey(attempt.session_id, attempt.student_id);
  const existing = table.get(key);
  if (existing) {
    return existing;
  }
  const row: AttendanceRow = {
    id: newId(),
    session_id: attempt.session_id,
    student_id: attempt.student_id,
    status: attempt.status,
    check_in_at: attempt.check_in_at,
    check_out_at: null,
    hours_override: null,
    method: 'qr',
    recorded_by: attempt.recorded_by,
    updated_at: nowIso(),
    created_at: nowIso(),
  };
  table.set(key, row);
  return row;
}

export interface CheckinResponsePayload {
  already_checked_in: boolean;
  attendance: {
    status: AttendanceRow['status'];
    check_in_at: string | null;
    method: AttendanceRow['method'];
  };
}

/**
 * Builds the response payload from the post-upsert row by comparing it
 * against what THIS call attempted to write.
 *
 * `already_checked_in = false` only when the row is exactly what this call
 * itself just wrote (method='qr', same recorded_by, same check_in_at) --
 * i.e. this call was the first-ever write for this (session_id,
 * student_id). Any other case (pre-existing 'coach'/'import'/'qr' row, or a
 * concurrent request that won a race to insert first) reports
 * `already_checked_in = true` and returns the row's ACTUAL persisted state
 * (not this call's intended values) -- this is what carries MTG-09's
 * "already checked in at <original time>" information to the caller.
 *
 * KNOWN EDGE CASE (flagged, not silently glossed over): if two requests
 * from the same user for the same session somehow generate the exact same
 * millisecond-resolution `check_in_at` (e.g. a genuine double-tap producing
 * two near-simultaneous requests), the loser of the race could be
 * misreported as `already_checked_in: false` even though it did not
 * actually perform the write. This is a cosmetic response-shape risk only
 * -- the underlying `attendance` row is still written exactly once either
 * way, since the DB-level unique constraint + DO NOTHING is what actually
 * enforces data integrity, not this comparison.
 */
export function resolveResponse(attempt: CheckinWriteAttempt, row: AttendanceRow): CheckinResponsePayload {
  const wasThisCallsWrite =
    row.method === 'qr' && row.recorded_by === attempt.recorded_by && row.check_in_at === attempt.check_in_at;
  return {
    already_checked_in: !wasThisCallsWrite,
    attendance: {
      status: row.status,
      check_in_at: row.check_in_at,
      method: row.method,
    },
  };
}
