/**
 * GAM-437: the collapsed side nav must keep every item's accessible name.
 *
 * `SideNav.test.tsx` (jsdom) already asserts `aria-label` survives the
 * component's own collapse toggle, but the issue this spec verifies
 * explicitly flags that behaviour as "read off the API surface, not
 * something anyone has watched happen" — a real browser's accessibility
 * tree is the thing that actually answers it. No writes here: this is a
 * read-only rendering/accessibility check, not a Tier 1/2 workflow.
 */
import { expect, test } from 'playwright/test';
import { signIn } from './personaHarness';

const ITEMS = ['Home', 'Meetings', 'Outreach', 'Calendar', 'Roster', 'Reports', 'Settings'];

test('collapsed side nav keeps every item accessible by name (admin)', async ({ page }) => {
  await signIn(page, 'admin');
  const nav = page.getByRole('navigation', { name: 'Side navigation' });
  await nav.waitFor();

  for (const label of ITEMS) {
    await expect(nav.getByRole('link', { name: label, exact: true })).toBeVisible();
  }
  await page.screenshot({ path: 'tests/e2e-personas/screenshots/437-expanded.png', fullPage: true });

  const collapseToggle = page.getByRole('button', { name: 'Collapse sidebar' });
  await collapseToggle.waitFor();
  await collapseToggle.click();

  // Give the collapse animation/DOM update a moment, then re-query.
  await page.waitForTimeout(300);
  await page.screenshot({ path: 'tests/e2e-personas/screenshots/437-collapsed.png', fullPage: true });

  for (const label of ITEMS) {
    await expect(nav.getByRole('link', { name: label, exact: true })).toBeVisible();
  }
});
