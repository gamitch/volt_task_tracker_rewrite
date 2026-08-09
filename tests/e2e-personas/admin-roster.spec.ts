/**
 * The staff surfaces: roster, reports and the admin-only season settings.
 *
 * "Staff" is `is_staff()` — `admin` or `coach`. Where the two differ is the
 * admin-only season settings page, which is checked in both directions here.
 */
import { expect, test } from 'playwright/test';
import { SEED, capture, execAdmin, readRows, signIn } from './personaHarness';

interface StudentRow {
  id: string;
  display_name: string;
  team_id: string;
  grad_year: number | null;
  is_active: boolean;
  goal_hours_override: string | number | null;
  profile_id: string | null;
}

function studentsNamed(name: string): StudentRow[] {
  return readRows<StudentRow>(
    `select id, display_name, team_id, grad_year, is_active, goal_hours_override, profile_id
     from students where display_name = '${name}'`,
  );
}

test.describe('staff roster', () => {
  const NEW_STUDENT = 'E2E Rowan Adeyemi';

  test.beforeEach(() => {
    // `students` is referenced by attendance/rsvps/invites with ON DELETE
    // RESTRICT, but a freshly added student has none of those rows.
    execAdmin(`delete from student_teams where student_id in (select id from students where display_name like 'E2E %')`);
    execAdmin(`delete from students where display_name like 'E2E %'`);
  });

  test('admin sees every roster tab and the whole student list', async ({ page }) => {
    await signIn(page, 'admin');
    await page.goto('/roster');

    for (const tab of ['Students', 'Parents', 'Teams', 'Invites']) {
      await expect(page.getByRole('button', { name: tab, exact: true })).toBeVisible({ timeout: 20_000 });
    }
    // Six seeded students, including the inactive one — staff see all of them.
    for (const name of ['Priya Raman', 'Jordan Okafor', 'Sam Whitfield', 'Casey Lindqvist']) {
      await expect(page.getByText(name).first()).toBeVisible();
    }
    await capture(page, '30-admin-roster');
  });

  test('Add student writes the row the form described', async ({ page }) => {
    expect(studentsNamed(NEW_STUDENT)).toHaveLength(0);

    await signIn(page, 'admin');
    await page.goto('/roster');
    await expect(page.getByText('Priya Raman').first()).toBeVisible({ timeout: 20_000 });
    await page.getByRole('button', { name: 'Add student' }).click();

    const dialog = page.getByRole('dialog').filter({ hasText: 'Add student' }).first();
    await dialog.waitFor();
    await dialog.locator('input[placeholder="e.g. Amara Voss"]').fill(NEW_STUDENT);

    // Team is required, so the submit stays disabled until one is chosen.
    const submit = dialog.getByRole('button', { name: 'Add student' });
    await expect(submit).toBeDisabled();

    const teamPicker = dialog.getByRole('combobox');
    await teamPicker.click();
    const teamOptions = (await page.getByRole('option').allInnerTexts()).map((t) => t.trim());
    // This picker EXCLUDES the archived team, which is the behaviour you want
    // and the other half of FINDING 1: the Schedule-meetings team scope offers
    // the same archived team and pre-selects it. Two pickers over one `teams`
    // table disagree about what `archived = true` means.
    expect(teamOptions).toEqual(['Volt Robotics 9911', 'Volt Junior 4402']);
    await page.getByRole('option', { name: 'Volt Junior 4402' }).click();

    await capture(page, '31-admin-add-student');
    await expect(submit).toBeEnabled();
    await submit.click();

    await expect.poll(() => studentsNamed(NEW_STUDENT).length, { timeout: 20_000 }).toBe(1);
    const [student] = studentsNamed(NEW_STUDENT);
    expect(student.team_id).toBe(SEED.teamFtc);
    expect(student.is_active).toBe(true);
    // Email was left blank, so no invite and no linked account.
    expect(student.profile_id).toBeNull();
    expect(readRows(`select 1 from invites where student_id = '${student.id}'`)).toHaveLength(0);

    // And the new row is on screen without a manual reload.
    await expect(page.getByText(NEW_STUDENT).first()).toBeVisible({ timeout: 20_000 });
    await capture(page, '32-admin-roster-after-add');
  });

  test('a coach reaches reports; the season settings stay admin-only', async ({ page }) => {
    await signIn(page, 'coach');

    await page.goto('/reports');
    await expect(page.getByText("This page isn't part of your role")).toHaveCount(0);
    await capture(page, '33-coach-reports');

    // SET-04 is admin-only, and `SeasonSettings` nests its own RequireRole.
    await page.goto('/settings/season');
    await expect(page.getByText("This page isn't part of your role")).toBeVisible({ timeout: 20_000 });
    await capture(page, '34-coach-denied-season-settings');
  });

  test('an admin does reach the season settings', async ({ page }) => {
    await signIn(page, 'admin');
    await page.goto('/settings/season');
    await expect(page.getByText("This page isn't part of your role")).toHaveCount(0);
    await capture(page, '35-admin-season-settings');
  });
});
