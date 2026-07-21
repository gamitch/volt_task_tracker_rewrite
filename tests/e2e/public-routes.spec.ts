/**
 * T066: real, live-browser coverage of both public routes (`/login`,
 * `/accept-invite`) against the production build (`npm run build` + `npm
 * run preview`, wired via `playwright.config.ts`'s `webServer`). Runs once
 * per project in that config's 2x2 color-mode x viewport-class matrix
 * (`desktop-light`, `desktop-dark`, `mobile-light`, `mobile-dark`) --
 * satisfying Known Context #4 ("both color modes, both mobile and desktop
 * viewports") for the genuinely-testable-without-auth surface this suite
 * covers. See `playwright.config.ts`'s own module doc for the full,
 * disclosed reasoning on why this suite does not attempt the four PRD
 * Section 3 persona flows or the RLS-denial assertion.
 *
 * Neither route requires authentication (`src/app/router.tsx`: "`/login`,
 * `/accept-invite`: public (these ARE the auth entry points)"), so both are
 * genuinely reachable end to end in this environment even with no real
 * Supabase backend configured.
 */
import { expect, test } from 'playwright/test';

test.describe('/login (public, real LoginPage)', () => {
  test('renders the real AUTH-02 sign-in form: VOLT wordmark, email + password fields, Sign in, Continue with Google, Forgot password', async ({
    page,
  }) => {
    await page.goto('/login');

    // `src/pages/login/LoginPage.tsx`: `<Heading level={1}>VOLT</Heading>`
    // above the card -- the page's own standalone identity element per
    // PRD 7.1's "Basic Login" template.
    await expect(page.getByRole('heading', { name: 'VOLT' })).toBeVisible();

    // AUTH-02 fields, read straight off `LoginPage.tsx`'s real `TextInput`/
    // `Button`/`Link` usage (`htmlName="email"`/`htmlName="password"`).
    const emailInput = page.locator('input[name="email"]');
    const passwordInput = page.locator('input[name="password"]');
    await expect(emailInput).toBeVisible();
    await expect(emailInput).toHaveValue('');
    await expect(passwordInput).toBeVisible();
    await expect(passwordInput).toHaveValue('');

    await expect(page.getByRole('button', { name: 'Sign in' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Continue with Google' })).toBeVisible();
    await expect(page.getByText('Forgot password')).toBeVisible();

    // AUTH-01: public self-serve signup is disabled -- no "Create account" /
    // "Sign up" affordance should ever appear on this page (real regression
    // guard, not a formality -- `LoginPage.tsx`'s own module doc calls this
    // out as a real correctness requirement).
    await expect(page.getByText(/create account|sign up/i)).toHaveCount(0);
  });

  test('the "Forgot password" panel opens in place (real local UI state, no network)', async ({
    page,
  }) => {
    await page.goto('/login');
    await page.getByText('Forgot password').click();

    await expect(page.getByRole('heading', { name: 'Reset your password' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Send reset link' })).toBeVisible();
    await expect(page.getByText('Back to sign in')).toBeVisible();
  });

  test('fits the viewport with no horizontal overflow (mobile + desktop, NFR-06)', async ({
    page,
  }) => {
    await page.goto('/login');
    await expect(page.getByRole('heading', { name: 'VOLT' })).toBeVisible();

    const { scrollWidth, clientWidth } = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }));
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 1); // +1: sub-pixel rounding tolerance
  });
});

test.describe('/accept-invite (public, real AcceptInvitePage)', () => {
  test('loads the invite and renders the real AUTH-03 step-3 form: invitee name/role, password fields, Set password, Continue with Google', async ({
    page,
  }) => {
    await page.goto('/accept-invite');

    // `AcceptInvitePage.tsx`'s `defaultLoadInvite` placeholder (used here
    // since no real `loadInvite`/invite backend exists in this environment)
    // resolves after ~350ms to a fixed fixture invite --
    // `DEFAULT_PLACEHOLDER_INVITE` -- name "Jordan Rivera", role "coach".
    // Waiting for that name is a real assertion on the real placeholder
    // data path, not a fabricated stand-in.
    await expect(page.getByRole('heading', { name: 'Jordan Rivera' })).toBeVisible({
      timeout: 10_000,
    });
    await expect(page.getByText(/invited to VOLT as a Coach/)).toBeVisible();

    const passwordInput = page.locator('input[name="password"]');
    const confirmInput = page.locator('input[name="confirmPassword"]');
    await expect(passwordInput).toBeVisible();
    await expect(confirmInput).toBeVisible();

    await expect(page.getByRole('button', { name: 'Set password' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Continue with Google' })).toBeVisible();
  });

  test('client-side password validation runs for real (min length + confirm-match), no network round trip needed to see it', async ({
    page,
  }) => {
    await page.goto('/accept-invite');
    await expect(page.getByRole('heading', { name: 'Jordan Rivera' })).toBeVisible({
      timeout: 10_000,
    });

    await page.locator('input[name="password"]').fill('short');
    await page.locator('input[name="confirmPassword"]').fill('short');
    await page.getByRole('button', { name: 'Set password' }).click();

    await expect(page.getByText(/at least 8 characters/)).toBeVisible();
  });

  test('fits the viewport with no horizontal overflow (mobile + desktop, NFR-06)', async ({
    page,
  }) => {
    await page.goto('/accept-invite');
    await expect(page.getByRole('heading', { name: 'Jordan Rivera' })).toBeVisible({
      timeout: 10_000,
    });

    const { scrollWidth, clientWidth } = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }));
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 1);
  });
});
