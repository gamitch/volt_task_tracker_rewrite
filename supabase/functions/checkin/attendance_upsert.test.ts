// T032: unit tests for attendance_upsert.ts -- MTG-09 (idempotent duplicate
// check-in) and MTG-11 (a coach's method='coach' row always wins over a QR
// write). These exercise the exact guard logic index.ts drives against a
// real Postgres `upsert(..., { ignoreDuplicates: true })` call, using an
// in-memory fake table since no live Supabase project is available in this
// environment (see the worker packet's "External Blocker" section) -- this
// proves the DECISION LOGIC is correct; it does not exercise the real SQL/
// supabase-js wiring end-to-end.
import assert from 'node:assert/strict';
import { applyUpsertIgnoreDuplicates, resolveResponse, type AttendanceRow, type CheckinWriteAttempt } from './attendance_upsert.ts';

let idCounter = 0;
function newId(): string {
  idCounter += 1;
  return `fake-id-${idCounter}`;
}

const SESSION_ID = 'session-1';
const STUDENT_ID = 'student-1';

Deno.test('fresh check-in: no prior row -> inserts a new method=qr row, already_checked_in=false', () => {
  const table = new Map<string, AttendanceRow>();
  const attempt: CheckinWriteAttempt = {
    session_id: SESSION_ID,
    student_id: STUDENT_ID,
    status: 'present',
    check_in_at: '2026-07-18T18:05:00.000Z',
    recorded_by: 'caller-1',
  };
  const row = applyUpsertIgnoreDuplicates(table, attempt, newId, () => '2026-07-18T18:05:00.000Z');
  assert.equal(row.method, 'qr');
  assert.equal(row.status, 'present');
  assert.equal(row.check_in_at, attempt.check_in_at);
  assert.equal(table.size, 1);

  const payload = resolveResponse(attempt, row);
  assert.equal(payload.already_checked_in, false);
  assert.equal(payload.attendance.status, 'present');
  assert.equal(payload.attendance.check_in_at, attempt.check_in_at);
  assert.equal(payload.attendance.method, 'qr');
});

Deno.test(
  'MTG-11: a pre-existing method=coach row is NEVER overwritten by a subsequent QR check-in attempt for the same student/session',
  () => {
    const table = new Map<string, AttendanceRow>();
    const coachRow: AttendanceRow = {
      id: 'coach-row-1',
      session_id: SESSION_ID,
      student_id: STUDENT_ID,
      status: 'present',
      check_in_at: null, // coach entries can have no recorded time
      check_out_at: null,
      hours_override: null,
      method: 'coach',
      recorded_by: 'coach-profile-1',
      updated_at: '2026-07-18T17:00:00.000Z',
      created_at: '2026-07-18T17:00:00.000Z',
    };
    table.set(`${SESSION_ID}:${STUDENT_ID}`, coachRow);
    // Snapshot the coach row's fields before the QR attempt, to assert
    // byte-for-byte that nothing changed (not just that method stayed
    // 'coach' -- every field, including updated_at, must be untouched).
    const beforeSnapshot = { ...coachRow };

    const qrAttempt: CheckinWriteAttempt = {
      session_id: SESSION_ID,
      student_id: STUDENT_ID,
      status: 'late',
      check_in_at: '2026-07-18T18:30:00.000Z',
      recorded_by: 'student-caller-1',
    };
    const row = applyUpsertIgnoreDuplicates(table, qrAttempt, newId, () => '2026-07-18T18:30:00.000Z');

    // The row returned/stored is the ORIGINAL coach row, completely
    // unmodified -- this is the real assertion MTG-11 requires.
    assert.deepEqual(row, beforeSnapshot, 'coach row must be returned completely unchanged');
    assert.equal(row.method, 'coach');
    assert.equal(row.check_in_at, null);
    assert.equal(table.size, 1, 'no second row was created for this (session_id, student_id) pair');
    assert.deepEqual(table.get(`${SESSION_ID}:${STUDENT_ID}`), beforeSnapshot, 'table state itself is unchanged');

    // MTG-09: still responds success-shaped (idempotent), not an error, but
    // using the coach-recorded state, and check_in_at is null (the
    // null-check_in_at edge case flagged in the worker packet/output --
    // response payload carries `check_in_at: null` for a future
    // renderer to handle, this module does not invent UI copy for it).
    const payload = resolveResponse(qrAttempt, row);
    assert.equal(payload.already_checked_in, true);
    assert.equal(payload.attendance.method, 'coach');
    assert.equal(payload.attendance.check_in_at, null);
    assert.equal(payload.attendance.status, 'present', 'reports the coach-recorded status, not the QR attempt’s computed status');
  },
);

Deno.test('MTG-09: a duplicate QR check-in is idempotent -- original check_in_at/status preserved, no error, no second row', () => {
  const table = new Map<string, AttendanceRow>();
  const firstAttempt: CheckinWriteAttempt = {
    session_id: SESSION_ID,
    student_id: STUDENT_ID,
    status: 'present',
    check_in_at: '2026-07-18T18:04:00.000Z',
    recorded_by: 'student-caller-1',
  };
  const firstRow = applyUpsertIgnoreDuplicates(table, firstAttempt, newId, () => '2026-07-18T18:04:00.000Z');
  const firstPayload = resolveResponse(firstAttempt, firstRow);
  assert.equal(firstPayload.already_checked_in, false);

  // Second scan, minutes later -- would compute a DIFFERENT status/time if
  // it were allowed to overwrite.
  const secondAttempt: CheckinWriteAttempt = {
    session_id: SESSION_ID,
    student_id: STUDENT_ID,
    status: 'late', // hypothetically, if this were computed at the 2nd scan
    check_in_at: '2026-07-18T18:20:00.000Z',
    recorded_by: 'student-caller-1',
  };
  const secondRow = applyUpsertIgnoreDuplicates(table, secondAttempt, newId, () => '2026-07-18T18:20:00.000Z');
  const secondPayload = resolveResponse(secondAttempt, secondRow);

  assert.equal(table.size, 1, 'still exactly one attendance row');
  assert.equal(secondRow.check_in_at, firstAttempt.check_in_at, 'original check_in_at (6:04) is preserved, not overwritten');
  assert.equal(secondRow.status, 'present', 'original status is preserved');
  assert.equal(secondPayload.already_checked_in, true);
  assert.equal(secondPayload.attendance.check_in_at, '2026-07-18T18:04:00.000Z');
  assert.equal(secondPayload.attendance.status, 'present');
});

Deno.test('an existing method=import row is also never overwritten by a QR check-in', () => {
  const table = new Map<string, AttendanceRow>();
  const importRow: AttendanceRow = {
    id: 'import-row-1',
    session_id: SESSION_ID,
    student_id: STUDENT_ID,
    status: 'excused',
    check_in_at: null,
    check_out_at: null,
    hours_override: 2,
    method: 'import',
    recorded_by: null,
    updated_at: '2026-07-01T00:00:00.000Z',
    created_at: '2026-07-01T00:00:00.000Z',
  };
  table.set(`${SESSION_ID}:${STUDENT_ID}`, importRow);

  const qrAttempt: CheckinWriteAttempt = {
    session_id: SESSION_ID,
    student_id: STUDENT_ID,
    status: 'present',
    check_in_at: '2026-07-18T18:00:00.000Z',
    recorded_by: 'student-caller-1',
  };
  const row = applyUpsertIgnoreDuplicates(table, qrAttempt, newId, () => '2026-07-18T18:00:00.000Z');
  assert.deepEqual(row, importRow);
});

Deno.test('different students in the same session each get their own row (no cross-student clobbering)', () => {
  const table = new Map<string, AttendanceRow>();
  const attemptA: CheckinWriteAttempt = {
    session_id: SESSION_ID,
    student_id: 'student-a',
    status: 'present',
    check_in_at: '2026-07-18T18:00:00.000Z',
    recorded_by: 'caller-a',
  };
  const attemptB: CheckinWriteAttempt = {
    session_id: SESSION_ID,
    student_id: 'student-b',
    status: 'late',
    check_in_at: '2026-07-18T18:20:00.000Z',
    recorded_by: 'caller-b',
  };
  const rowA = applyUpsertIgnoreDuplicates(table, attemptA, newId, () => 'now');
  const rowB = applyUpsertIgnoreDuplicates(table, attemptB, newId, () => 'now');
  assert.equal(table.size, 2);
  assert.notEqual(rowA.id, rowB.id);
  assert.equal(resolveResponse(attemptA, rowA).already_checked_in, false);
  assert.equal(resolveResponse(attemptB, rowB).already_checked_in, false);
});
