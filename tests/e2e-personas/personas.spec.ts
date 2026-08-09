/**
 * All four personas sign in for real and land on the right dashboard.
 *
 * This is the coverage `playwright.config.ts` documents as impossible for the
 * `tests/e2e/**` suite ("No Playwright test running in this environment can
 * reach an authenticated state"). It is reachable here because
 * `tests/e2e-harness/server.mjs` provides a real backend: real GoTrue-shaped
 * auth, real `profiles` rows, and the real two-step session -> role
 * resolution in `src/app/guards.tsx`.
 */
import { expect, test } from 'playwright/test';
import { PERSONAS, capture, readRowsAs, signIn, visibleNavLinks, type PersonaKey } from './personaHarness';

test.describe('AUTH-02 sign-in and NAV-06 role dispatch', () => {
  test('rejects a wrong password without creating a session', async ({ page }) => {
    await page.goto('/login');
    await page.locator('input[name="email"]').fill(PERSONAS.coach.email);
    await page.locator('input[name="password"]').fill('definitely-not-the-password');
    await page.getByRole('button', { name: 'Sign in' }).click();

    await expect(page.getByText(/invalid login credentials/i)).toBeVisible({ timeout: 15_000 });
    expect(new URL(page.url()).pathname).toBe('/login');
    await capture(page, '00-login-invalid-credentials');
  });

  for (const key of ['admin', 'coach', 'student', 'parent'] as PersonaKey[]) {
    test(`${key} signs in and reaches their own dashboard`, async ({ page }) => {
      await signIn(page, key);
      expect(new URL(page.url()).pathname).toBe('/');

      // The account menu is the app's own echo of who it thinks is signed in.
      await expect(page.getByRole('button', { name: `Account menu for ${PERSONAS[key].email}` })).toBeVisible();
      await capture(page, `01-${key}-dashboard`);
    });
  }

  test('staff see the staff-only nav; student and parent do not', async ({ page }) => {
    await signIn(page, 'coach');
    const coachNav = await visibleNavLinks(page);
    expect(coachNav).toEqual(expect.arrayContaining(['Roster', 'Reports']));

    await page.getByRole('button', { name: `Account menu for ${PERSONAS.coach.email}` }).click();
    await page.getByRole('menuitem', { name: /sign out/i }).click();
    await expect.poll(() => new URL(page.url()).pathname, { timeout: 15_000 }).toBe('/login');

    await signIn(page, 'student');
    const studentNav = await visibleNavLinks(page);
    expect(studentNav).not.toContain('Roster');
    expect(studentNav).not.toContain('Reports');
  });
});

test.describe('NFR-02 RLS is what limits each persona, not the UI', () => {
  test('a coach reads the whole roster; a student reads only themselves', async () => {
    // Read through the REAL policies, as the personas — a superuser read here
    // would bypass RLS and prove nothing.
    const coachSees = readRowsAs('coach', 'select display_name from students order by display_name');
    const studentSees = readRowsAs('student', 'select display_name from students order by display_name');
    const parentSees = readRowsAs('parent', 'select display_name from students order by display_name');

    expect(coachSees.length).toBeGreaterThan(1);
    expect(studentSees).toEqual([{ display_name: PERSONAS.student.displayName }]);
    // The parent sees exactly the child they are linked to via `guardian_links`.
    expect(parentSees).toEqual([{ display_name: PERSONAS.student.displayName }]);
  });

  test('a student is denied the staff-only surfaces in the browser', async ({ page }) => {
    await signIn(page, 'student');

    for (const route of ['/roster', '/reports']) {
      await page.goto(route);
      // `RequireRole` renders `AccessDeniedPage` in place rather than
      // redirecting, so the URL stays put and the copy is the assertion.
      await expect(page.getByText("This page isn't part of your role")).toBeVisible({ timeout: 15_000 });
      expect(new URL(page.url()).pathname).toBe(route);
    }
    await capture(page, '02-student-denied-reports');
  });

  test('an anonymous visitor is bounced off every protected route', async ({ page }) => {
    for (const route of ['/', '/meetings', '/roster', '/reports', '/settings']) {
      await page.goto(route);
      await expect.poll(() => new URL(page.url()).pathname, { timeout: 15_000 }).toBe('/login');
    }
  });
});
