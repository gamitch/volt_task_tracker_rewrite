/**
 * The two non-staff personas: what a student and a linked parent actually see,
 * and which of their controls reach the database.
 */
import { expect, test } from 'playwright/test';
import { PERSONAS, SEED, capture, execAdmin, readRows, readRowsAs, signIn } from './personaHarness';

/** Raw `confirmed_hours` for the student, straight out of the metric view. */
function confirmedHours(): number {
  const rows = readRows<{ confirmed_hours: number }>(
    `select confirmed_hours from v_student_hours
     where student_id = '${SEED.studentPriya}' and season_id = '${SEED.activeSeason}'`,
  );
  return rows[0]?.confirmed_hours ?? 0;
}

test.describe('student home', () => {
  // Keep the RSVP test re-runnable without a full reseed: clear only the row
  // it writes, mirroring the in-repo idiom at `coach-meeting.spec.ts:62-64`.
  test.beforeEach(() => {
    execAdmin(`delete from rsvps where student_id = '${SEED.studentPriya}'
                 and session_id = '5e550000-0000-4000-8000-000000000008'`);
  });

  test('greets the student by name and shows their own progress', async ({ page }) => {
    await signIn(page, 'student');
    await expect(page.getByRole('heading', { name: `Hi ${PERSONAS.student.displayName}` })).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByRole('heading', { name: 'Your outreach hours' })).toBeVisible();
    await capture(page, '20-student-home');
  });

  test('GAM-303: hours are rendered as a rounded figure, not a raw float', async ({ page }) => {
    // The view computes hours from timestamps, so `confirmed_hours` is a
    // non-terminating float for any realistic data (it is recomputed from
    // `now()` at every reseed, so it is never pinned to a literal here).
    // Both `StudentHome.tsx:1643-1645` and `ParentHome.tsx:1452-1454` share
    // one format string — `${value.toFixed(1)} / ${max.toFixed(1)} h
    // (${hoursPercent}%)` — so the goal renders as `100.0`, not `100`, and
    // the hours value is rounded to one decimal place rather than shown raw.
    const raw = confirmedHours();
    expect(String(raw).length).toBeGreaterThan(4); // i.e. genuinely not round

    await signIn(page, 'student');
    const progress = page.getByText(/\/ 100\.0 h \(/).first();
    await expect(progress).toBeVisible({ timeout: 20_000 });

    const label = (await progress.innerText()).trim();
    expect(label).toMatch(/^\d+\.\d \/ 100\.0 h \(\d+(\.\d)?%\)$/);
    expect(label).not.toContain(String(raw));
    // The shape and the negative check above are not enough on their own —
    // a formatter that renders a rounded but WRONG number (half of `raw`,
    // say) would still satisfy both. Tie the rendered leading figure to the
    // database value itself.
    expect(label.split(' ')[0]).toBe(raw.toFixed(1));
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

  test('GAM-304: an RSVP made on the student home reaches the database', async ({ page }) => {
    const before = readRows(
      `select status from rsvps where student_id = '${SEED.studentPriya}'
         and session_id = '5e550000-0000-4000-8000-000000000008'`,
    );
    expect(before).toHaveLength(0);

    await signIn(page, 'student');
    await expect(page.getByRole('heading', { name: 'Sign-up opportunities' })).toBeVisible({ timeout: 20_000 });

    // Pin the click to the seeded session (`5e55…0008`, event `Library STEM
    // Night` — `seed.sql:96-97`) rather than an unqualified `.first()`, so a
    // spec that runs before this one and changes which "Sign up" button is
    // first cannot change which session the click targets.
    const opportunities = page.getByRole('group', { name: 'Sign-up opportunities' });
    const row = opportunities.getByRole('listitem').filter({ hasText: 'Library STEM Night' });
    await expect(row).toHaveCount(1);
    await row.getByRole('button', { name: 'Sign up' }).click();
    await page.waitForTimeout(2500);
    await capture(page, '23-student-rsvp-clicked');

    // GAM-304 shipped: the click writes a real `rsvps` row for the session
    // the user actually targeted.
    const after = readRows<{ status: string; responded_by: string }>(
      `select status, responded_by from rsvps where student_id = '${SEED.studentPriya}'
         and session_id = '5e550000-0000-4000-8000-000000000008'`,
    );
    expect(after).toHaveLength(1);
    expect(after[0].status).toBe('going');
    expect(after[0].responded_by).toBe(PERSONAS.student.profileId);

    // And it survives a reload.
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

  test('GAM-303: the rounded hours figure also renders in the parent view', async ({ page }) => {
    const raw = confirmedHours();
    await signIn(page, 'parent');
    const progress = page.getByText(/\/ 100\.0 h \(/).first();
    await expect(progress).toBeVisible({ timeout: 20_000 });
    const label = (await progress.innerText()).trim();
    expect(label).toMatch(/^\d+\.\d \/ 100\.0 h \(\d+(\.\d)?%\)$/);
    expect(label).not.toContain(String(raw));
    // Same positive tie-back as the student-side test: the rendered leading
    // figure must equal the database value, not just look plausible.
    expect(label.split(' ')[0]).toBe(raw.toFixed(1));
    await capture(page, '25-parent-hours-float');
  });
});
