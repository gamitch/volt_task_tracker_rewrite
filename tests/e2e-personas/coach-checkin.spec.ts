/**
 * MTG: a coach records attendance from the live meeting console, and the
 * `attendance` rows are checked in Postgres afterwards.
 *
 * Written as the reuse test for the harness: nothing in `tests/e2e-harness/**`
 * was touched to make this file work. It goes through PostgREST end to end
 * (`loaders/attendance.ts` upserts `attendance`), which is the tier of the app
 * the harness covers directly.
 */
import { expect, test } from 'playwright/test';
import { PERSONAS, SEED, capture, execAdmin, readRows, signIn } from './personaHarness';

interface AttendanceRow {
  status: string;
  method: string;
  recorded_by: string | null;
  check_in_at: string | null;
}

function attendanceFor(studentId: string): AttendanceRow[] {
  return readRows<AttendanceRow>(
    `select status, method, recorded_by, check_in_at::text
     from attendance where session_id = '${SEED.liveSession}' and student_id = '${studentId}'`,
  );
}

test.describe('coach records attendance in the live console', () => {
  test.beforeEach(() => {
    // The live session starts with no attendance so each run begins level.
    execAdmin(`delete from attendance where session_id = '${SEED.liveSession}'`);
  });

  test('marking a student present writes a coach-attributed attendance row', async ({ page }) => {
    expect(attendanceFor(SEED.studentPriya)).toHaveLength(0);

    await signIn(page, 'coach');
    await page.goto(`/meetings/live/${SEED.liveSession}`);

    // The roster is a list, not a table, and each student's control is a
    // radiogroup named after them — which is the locator to reach for. Do not
    // go hunting for a bare "Present" button: there is one per student and
    // they are `role=radio`, so an unscoped match is both ambiguous and wrong.
    const marks = page.getByRole('radiogroup', {
      name: `Attendance for ${PERSONAS.student.displayName}`,
    });
    await expect(marks).toBeVisible({ timeout: 20_000 });
    await capture(page, '40-coach-live-console');

    const present = marks.getByRole('radio', { name: 'Present' });
    await expect(present).toHaveAttribute('aria-checked', 'false');
    await present.click();
    await expect(present).toHaveAttribute('aria-checked', 'true');

    await expect.poll(() => attendanceFor(SEED.studentPriya).length, { timeout: 20_000 }).toBe(1);
    const [attendance] = attendanceFor(SEED.studentPriya);

    expect(attendance.status).toBe('present');
    // `method` separates who did the recording: a coach marking the roster is
    // 'coach', a student redeeming a QR/short code is 'qr', and the student
    // home's own check-off is 'self'. Getting this wrong would silently
    // reclassify every coach-marked row.
    expect(attendance.method).toBe('coach');
    expect(attendance.recorded_by).toBe(PERSONAS.coach.profileId);

    await capture(page, '41-coach-live-console-after-mark');
  });

  test('changing a mark overwrites the existing row rather than duplicating it', async ({ page }) => {
    // AC 3: Present -> Late must leave exactly one row for
    // (session_id, student_id), with the LATER value.
    //
    // Which assertion actually protects you, precisely: `attendance` carries a
    // live `attendance_session_id_student_id_key UNIQUE (session_id, student_id)`
    // constraint, so a regression from upsert to a plain insert raises 23505
    // and can NEVER produce length 2. The count below is therefore a
    // schema-backed corroboration, not the detector. **`status === 'late'` is
    // the assertion that detects a regression** -- verified by mutation: with
    // the Late click and its aria assertion both removed, this test goes red on
    // `Expected "late" / Received "present"`.
    expect(attendanceFor(SEED.studentPriya)).toHaveLength(0);

    await signIn(page, 'coach');
    await page.goto(`/meetings/live/${SEED.liveSession}`);

    const marks = page.getByRole('radiogroup', {
      name: `Attendance for ${PERSONAS.student.displayName}`,
    });
    await expect(marks).toBeVisible({ timeout: 20_000 });

    const present = marks.getByRole('radio', { name: 'Present' });
    await present.click();
    await expect.poll(() => attendanceFor(SEED.studentPriya).length, { timeout: 20_000 }).toBe(1);
    expect(attendanceFor(SEED.studentPriya)[0].status).toBe('present');

    const late = marks.getByRole('radio', { name: 'Late' });
    await late.click();
    await expect(late).toHaveAttribute('aria-checked', 'true');

    // The database is the witness, not the radio's aria state: exactly one
    // row for this (session, student) pair, and its value is the later mark.
    await expect
      .poll(() => attendanceFor(SEED.studentPriya).length, { timeout: 20_000 })
      .toBe(1);
    const [row] = attendanceFor(SEED.studentPriya);
    expect(row.status).toBe('late');

    await capture(page, '42-coach-live-console-after-overwrite');
  });
});
