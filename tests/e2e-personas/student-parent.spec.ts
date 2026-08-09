/**
 * The two non-staff personas: what a student and a linked parent actually see,
 * and which of their controls reach the database.
 */
import { expect, test } from 'playwright/test';
import { PERSONAS, SEED, capture, readRows, readRowsAs, signIn } from './personaHarness';

/** Raw `confirmed_hours` for the student, straight out of the metric view. */
function confirmedHours(): number {
  const rows = readRows<{ confirmed_hours: number }>(
    `select confirmed_hours from v_student_hours
     where student_id = '${SEED.studentPriya}' and season_id = '${SEED.activeSeason}'`,
  );
  return rows[0]?.confirmed_hours ?? 0;
}

test.describe('student home', () => {
  test('greets the student by name and shows their own progress', async ({ page }) => {
    await signIn(page, 'student');
    await expect(page.getByRole('heading', { name: `Hi ${PERSONAS.student.displayName}` })).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByRole('heading', { name: 'Your outreach hours' })).toBeVisible();
    await capture(page, '20-student-home');
  });

  test('FINDING 3: hours are rendered as a raw float instead of a rounded figure', async ({ page }) => {
    // The view computes hours from timestamps, so `confirmed_hours` is a
    // non-terminating float for any realistic data — 3.9999983633333334 here.
    // `StudentHome.tsx` rounds the PERCENTAGE through `round1` but passes the
    // hours straight into the label (lines ~1483 and ~1485), so the student
    // sees the full float. `CoachHome` rounds the same underlying number.
    const raw = confirmedHours();
    expect(String(raw).length).toBeGreaterThan(4); // i.e. genuinely not round

    await signIn(page, 'student');
    const progress = page.getByText(/\/ 100 h \(/).first();
    await expect(progress).toBeVisible({ timeout: 20_000 });

    const label = (await progress.innerText()).trim();
    // Today: "3.9999983633333334 / 100 h (4%)". When the formatting is fixed,
    // this expectation flips to `toMatch(/^\d+(\.\d)? \//)`.
    expect(label).toContain(String(raw));
    expect(label).not.toMatch(/^\d+(\.\d)? \/ 100 h/);
    await capture(page, '21-student-hours-float');
  });

  test('the check-in code field rejects a code that matches no live session', async ({ page }) => {
    await signIn(page, 'student');
    const codeField = page.getByLabel(/check-in code/i);
    await expect(codeField).toBeVisible({ timeout: 20_000 });

    await codeField.fill('ZZZ999');
    await page.getByRole('button', { name: 'Check in' }).click();

    // Whatever copy the app chooses, the outcome that matters is that no
    // attendance row was invented for this student.
    await page.waitForTimeout(2500);
    const rows = readRows(
      `select 1 from attendance where student_id = '${SEED.studentPriya}' and method = 'self'`,
    );
    expect(rows).toHaveLength(0);
    await capture(page, '22-student-checkin-rejected');
  });

  test('FINDING 4: an RSVP made on the student home never reaches the database', async ({ page }) => {
    const before = readRows(
      `select status from rsvps where student_id = '${SEED.studentPriya}'
         and session_id = '5e550000-0000-4000-8000-000000000008'`,
    );
    expect(before).toHaveLength(0);

    await signIn(page, 'student');
    await expect(page.getByRole('heading', { name: 'Sign-up opportunities' })).toBeVisible({ timeout: 20_000 });

    const signUp = page.getByRole('button', { name: 'Sign up' }).first();
    await expect(signUp).toBeVisible();
    await signUp.click();
    await page.waitForTimeout(2500);
    await capture(page, '23-student-rsvp-clicked');

    // `StudentHome.tsx`'s `handleRsvpChange` is documented "local-only. No
    // Supabase write happens here." — the control looks live and is not.
    const after = readRows(
      `select status from rsvps where student_id = '${SEED.studentPriya}'
         and session_id = '5e550000-0000-4000-8000-000000000008'`,
    );
    expect(after).toHaveLength(0);

    // And it does not survive a reload, which is how a user would notice.
    await page.reload();
    await page.waitForTimeout(2000);
    await expect(page.getByRole('heading', { name: 'Sign-up opportunities' })).toBeVisible();
  });
});

test.describe('parent home', () => {
  test('shows the linked child and nothing about anyone else', async ({ page }) => {
    await signIn(page, 'parent');
    await expect(page.getByText(PERSONAS.student.displayName).first()).toBeVisible({ timeout: 20_000 });

    const body = await page.locator('body').innerText();
    // Jordan Okafor is on the same team and in the same sessions, but is not
    // this parent's child — `guardian_links` + `my_student_ids()` decide.
    expect(body).not.toContain('Jordan Okafor');
    expect(body).not.toContain('Sam Whitfield');
    await capture(page, '24-parent-home');
  });

  test('parent-visible rows are limited by RLS, not by the page', async () => {
    const attendance = readRowsAs<{ student_id: string }>(
      'parent',
      'select distinct student_id from attendance',
    );
    expect(attendance).toEqual([{ student_id: SEED.studentPriya }]);

    const links = readRowsAs('parent', 'select student_id from guardian_links');
    expect(links).toEqual([{ student_id: SEED.studentPriya }]);
  });

  test('FINDING 3 also affects the parent view', async ({ page }) => {
    const raw = confirmedHours();
    await signIn(page, 'parent');
    const progress = page.getByText(/\/ 100 h \(/).first();
    await expect(progress).toBeVisible({ timeout: 20_000 });
    expect((await progress.innerText()).trim()).toContain(String(raw));
    await capture(page, '25-parent-hours-float');
  });
});
