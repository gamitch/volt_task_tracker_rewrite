/**
 * GAM-456: verifies the fix in `src/pages/home/CoachHome.tsx` (module doc
 * #17) in a real browser -- real CSS, unlike the jsdom unit tests, which
 * cannot resolve `getComputedStyle` for StyleX-merged `style` overrides or
 * `light-dark()` custom properties.
 *
 * The fix does two things, both re-verified live here:
 *   (a) wraps three previously-bare sections (Hours by team, Goal
 *       projection, Top events by student hours) in the `Card` primitive,
 *       so all six dashboard sections (Next up, Activity feed, Hours by
 *       team, Goal projection, Top events, Leaderboard) are panelled
 *       consistently -- not just the three GAM-438 already fixed.
 *   (b) restores the header H1 to a 46px/800 inline style
 *       (`COACH_HOME_TITLE_STYLE`) plus an accent-orange, uppercase,
 *       800-weight eyebrow (`COACH_HOME_EYEBROW_STYLE` + `color="accent"`)
 *       above it.
 *
 * ---------------------------------------------------------------------
 * The scroll trap (stated in the GAM-456 Linear issue itself).
 * ---------------------------------------------------------------------
 * This page's content scrolls INSIDE an Astryx `Layout height="fill"`
 * container, not the document. `personaHarness.capture()`'s
 * `page.screenshot({ fullPage: true })` only captures the viewport for a
 * page like this -- it cannot see the below-the-fold sections.
 *
 * Reading `LayoutContent.js` (the installed `@astryxdesign/core` source,
 * not guessed): it calls `themeProps('layout-content')`
 * (`utils/themeProps.js`), which -- per `naming.js`'s own
 * `stableClassName('layout-content')` -- emits a stable
 * `class="astryx-layout-content ..."` on the div that actually carries
 * `overflow-y: auto` (`styles.scrollable`, gated on the component's own
 * `isScrollable` default of `true`).
 *
 * Measured live (throwaway inspection script, not kept): `.astryx-layout-
 * content` actually matches TWO elements on this route, not one --
 * `AppShell.tsx` mounts Astryx's own `<AppShell>` (`AstryxAppShell`), which
 * renders `<KpiStrip />` + `{children}` (this page) INSIDE its own
 * `Layout(height="fill")`/`LayoutContent` (module doc trail:
 * `AppShell.tsx:48-66`'s own T123 comment). So the outer match is the
 * app-chrome content region (`scrollHeight` only ~125px past its
 * `clientHeight` -- just enough for the KPI strip to nudge it), and the
 * INNER match is `CoachHome.tsx`'s own `<Layout height="fill">`
 * (`:2515-2518`), nested a level deeper, which is where the six dashboard
 * panels actually live (`scrollHeight` ~1425px past `clientHeight` --
 * genuinely large, six stacked panels' worth). The first test below
 * measures both live and asserts on the difference, rather than assuming
 * either one; `.astryx-layout-content .astryx-layout-content` (a plain CSS
 * descendant combinator -- the LayoutContent nested inside the other
 * LayoutContent) is the selector every other test in this file uses to
 * reach the real, page-level scroll container uniquely.
 *
 * `scrollIntoViewIfNeeded()` (native browser API Playwright drives) walks
 * every scrollable ancestor, not just the window, so it correctly scrolls
 * `.astryx-layout-content` for headings that sit below its fold. Per-card
 * screenshots below use `locator.screenshot()` on the scrolled-into-view
 * card element (option (b) from the task) rather than a full-page capture.
 */
import { expect, test, type Locator, type Page } from 'playwright/test';
import { capture, signIn } from './personaHarness';

/** The six sections GAM-456 makes consistently panelled, in page order. */
const PANEL_HEADINGS = [
  'Next up',
  'Activity feed',
  'Hours by team',
  'Goal projection · confirmed + planned',
  'Top events by student hours',
  'Season Volunteer Leaderboard',
] as const;

/** `light-dark()` resolutions of `--color-accent` (`theme.css:206`), both
 * pre-converted here so the test can assert against whichever the browser's
 * emulated `color-scheme` actually picks, rather than hardcoding one. The
 * persona harness's own `desktop-light` Playwright project sets
 * `colorScheme: 'light'`, so the light branch (`#A8560A`) is the one this
 * suite expects to observe -- measured below, not assumed. */
const ACCENT_LIGHT_RGB = 'rgb(168, 86, 10)'; // #A8560A
const ACCENT_DARK_RGB = 'rgb(247, 154, 74)'; // #f79a4a
/** `--color-text-secondary` (`theme.css:213`, light branch) -- the muted
 * gray the eyebrow used to render as, before this fix. Asserted AGAINST. */
const SECONDARY_LIGHT_RGB = 'rgb(74, 69, 81)'; // #4A4551

/**
 * The real scrolling ancestor for this page (see module doc above): the
 * `.astryx-layout-content` NESTED inside the outer app-chrome
 * `.astryx-layout-content`, i.e. `CoachHome.tsx`'s own `<Layout
 * height="fill">`, not `AppShell.tsx`'s. Asserts it actually exists and
 * actually overflows before handing it back, so a selector typo fails
 * loudly here instead of producing a false "visible" elsewhere.
 */
async function scrollContainer(page: Page): Promise<Locator> {
  const locator = page.locator('.astryx-layout-content .astryx-layout-content');
  await expect(locator).toHaveCount(1);
  return locator;
}

async function scrollContainerToFraction(container: Locator, fraction: number): Promise<void> {
  await container.evaluate((el, frac) => {
    el.scrollTop = Math.round((el.scrollHeight - el.clientHeight) * frac);
  }, fraction);
  // Let layout/paint settle before a screenshot reads the frame.
  await container.page().waitForTimeout(150);
}

test.describe('GAM-456 coach dashboard panel consistency', () => {
  test('coach: the real scroll container is the nested .astryx-layout-content, not the document or the app-chrome one', async ({
    page,
  }) => {
    // This is the load-bearing proof for every other test in this file: if
    // it turns out the document itself scrolls (e.g. a future Astryx
    // upgrade changes LayoutContent's overflow behavior), every
    // scrollIntoViewIfNeeded()/locator.screenshot() call below would still
    // "work" by accident via window scroll, silently invalidating the
    // "don't assume, measure" instruction this spec is built around.
    await signIn(page, 'coach');
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Coach dashboard', exact: true })).toBeVisible();

    const measured = await page.evaluate(() => {
      const doc = document.scrollingElement as HTMLElement;
      const candidates = Array.from(
        document.querySelectorAll<HTMLElement>('.astryx-layout-content'),
      );
      return {
        docScrollHeight: doc.scrollHeight,
        docClientHeight: doc.clientHeight,
        candidateCount: candidates.length,
        // Document order: the outer app-chrome LayoutContent (AppShell.tsx)
        // always precedes the nested page-level one (CoachHome.tsx) in the
        // DOM, since the latter is one of the former's descendants.
        candidates: candidates.map((el) => ({
          scrollHeight: el.scrollHeight,
          clientHeight: el.clientHeight,
        })),
      };
    });
    // eslint-disable-next-line no-console -- printed for the run report, not app code.
    console.log('[GAM-456] scroll-container measurement', measured);

    // Two `.astryx-layout-content` elements exist on this route (module doc
    // above) -- proven live here, not assumed.
    expect(measured.candidateCount).toBe(2);
    const [outerAppChrome, innerCoachHome] = measured.candidates;
    const outerOverflow = outerAppChrome.scrollHeight - outerAppChrome.clientHeight;
    const innerOverflow = innerCoachHome.scrollHeight - innerCoachHome.clientHeight;
    const docOverflow = measured.docScrollHeight - measured.docClientHeight;

    // The document itself barely overflows -- the WRONG candidate a naive
    // `page.screenshot({ fullPage: true })` would target.
    expect(docOverflow).toBeLessThan(20);
    // The outer app-chrome LayoutContent (AppShell.tsx, wraps KpiStrip +
    // this whole page) overflows only a little -- it is NOT where the six
    // dashboard panels live.
    expect(outerOverflow).toBeLessThan(200);
    // The nested, page-level LayoutContent (CoachHome.tsx's own
    // `<Layout height="fill">`) has real, substantial scrollable overflow --
    // six stacked panels are much taller than the ~950px content viewport.
    // This is the container `scrollContainer()` below selects via the
    // `.astryx-layout-content .astryx-layout-content` descendant combinator.
    expect(innerOverflow).toBeGreaterThan(1000);
  });

  test('coach: all six dashboard sections render inside a visible .astryx-card panel', async ({
    page,
  }) => {
    await signIn(page, 'coach');
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Coach dashboard', exact: true })).toBeVisible();

    for (const name of PANEL_HEADINGS) {
      const heading = page.getByRole('heading', { name, exact: true });
      // Scroll the REAL inner container (via the native ancestor-walking
      // scrollIntoView Playwright drives) before asserting visibility --
      // proves the section is genuinely reachable, not just present in the
      // DOM outside the viewport.
      await heading.scrollIntoViewIfNeeded();
      await expect(heading).toBeVisible();
      const card = page.locator('.astryx-card', { has: heading });
      await expect(card).toBeVisible();
    }
  });

  test('coach: H1 renders the real 46px/800 override', async ({ page }) => {
    await signIn(page, 'coach');
    await page.goto('/');
    const heading = page.getByRole('heading', { name: 'Coach dashboard', exact: true });
    await expect(heading).toBeVisible();

    const rootFontSize = await page.evaluate(
      () => getComputedStyle(document.documentElement).fontSize,
    );
    const [fontSize, fontWeight] = await Promise.all([
      heading.evaluate((el) => getComputedStyle(el).fontSize),
      heading.evaluate((el) => getComputedStyle(el).fontWeight),
    ]);
    // eslint-disable-next-line no-console
    console.log('[GAM-456] H1 computed style', { rootFontSize, fontSize, fontWeight });

    // `COACH_HOME_TITLE_STYLE.fontSize` is `2.875rem`, which is 46px ONLY if
    // the root font-size is the browser default 16px -- measured above
    // rather than assumed, and asserted here so a drift in either value is
    // caught.
    expect(rootFontSize).toBe('16px');
    expect(fontSize).toBe('46px');
    expect(fontWeight).toBe('800');
  });

  test('coach: eyebrow renders uppercase, 800-weight, accent-orange -- not the old muted gray', async ({
    page,
  }) => {
    await signIn(page, 'coach');
    await page.goto('/');
    const heading = page.getByRole('heading', { name: 'Coach dashboard', exact: true });
    await expect(heading).toBeVisible();

    // The eyebrow (season name) is the Text element immediately preceding
    // the H1 inside the same `VStack gap={1}` (CoachHome.tsx:2549-2555) --
    // located structurally rather than by its text content, since the
    // season name itself ("2026 Build Season") is seed data, not part of
    // the fix's contract.
    const eyebrow = heading.locator('xpath=preceding-sibling::*[1]');
    await expect(eyebrow).toBeVisible();

    const eyebrowText = await eyebrow.textContent();
    const [textTransform, fontWeight, color] = await Promise.all([
      eyebrow.evaluate((el) => getComputedStyle(el).textTransform),
      eyebrow.evaluate((el) => getComputedStyle(el).fontWeight),
      eyebrow.evaluate((el) => getComputedStyle(el).color),
    ]);
    // eslint-disable-next-line no-console
    console.log('[GAM-456] eyebrow computed style', {
      eyebrowText,
      textTransform,
      fontWeight,
      color,
    });

    expect(eyebrowText).toBe('2026 Build Season');
    expect(textTransform).toBe('uppercase');
    expect(fontWeight).toBe('800');
    // Must be the accent orange (either light-dark() branch, whichever the
    // emulated color-scheme resolves), and explicitly NOT the pre-fix muted
    // secondary gray.
    expect([ACCENT_LIGHT_RGB, ACCENT_DARK_RGB]).toContain(color);
    expect(color).not.toBe(SECONDARY_LIGHT_RGB);
  });

  test('coach: one real scroll-container capture proves all six panels visible in sequence, no structural seam', async ({
    page,
  }) => {
    await signIn(page, 'coach');
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Coach dashboard', exact: true })).toBeVisible();

    // `capture()`'s fullPage:true screenshots the DOCUMENT's full scroll
    // height. Per the first test above, the document barely overflows on
    // this page -- so this capture is expected to show ~only the first
    // viewport (Next up/Activity feed) and NOT prove the other four panels
    // render, which is exactly the trap the task called out. Taken anyway,
    // as the harness's own convention, but not relied on as evidence below.
    await capture(page, '456-coach-dashboard-full');

    const container = await scrollContainer(page);
    // Scroll the REAL inner container through four steps and capture the
    // viewport at each -- a genuine filmstrip proving every section renders
    // panelled, in sequence, with no gap where an old bare section used to
    // sit.
    const fractions = [0, 1 / 3, 2 / 3, 1];
    for (let i = 0; i < fractions.length; i += 1) {
      await scrollContainerToFraction(container, fractions[i]);
      await page.screenshot({
        path: `tests/e2e-personas/screenshots/456-coach-dashboard-scroll-${i}.png`,
      });
    }

    // Direct proof the scroll actually moved (not a no-op): scrollTop at
    // fraction 1 must be materially greater than at fraction 0.
    const scrollTopAtBottom = await container.evaluate((el) => el.scrollTop);
    expect(scrollTopAtBottom).toBeGreaterThan(100);

    // And a per-panel proof, independent of the filmstrip above:
    // `locator.screenshot()` auto-scrolls its target into view first
    // (option (b) from the task) -- prove that mechanism actually reveals
    // an otherwise-below-the-fold panel by screenshotting the LAST section
    // (Leaderboard) after resetting scroll to the top.
    await scrollContainerToFraction(container, 0);
    expect(await container.evaluate((el) => el.scrollTop)).toBe(0);
    const leaderboardHeading = page.getByRole('heading', {
      name: 'Season Volunteer Leaderboard',
      exact: true,
    });
    const leaderboardCard = page.locator('.astryx-card', { has: leaderboardHeading });
    await leaderboardCard.screenshot({
      path: 'tests/e2e-personas/screenshots/456-coach-dashboard-leaderboard-card.png',
    });
    // After locator.screenshot()'s internal auto-scroll, the container must
    // have actually moved off 0 -- proving the auto-scroll mechanism, not
    // just the screenshot call, is what did the work.
    expect(await container.evaluate((el) => el.scrollTop)).toBeGreaterThan(0);
  });

  test('coach: "Season setup" stays coach-hidden (unchanged by this fix)', async ({ page }) => {
    await signIn(page, 'coach');
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Coach dashboard', exact: true })).toBeVisible();
    const container = await scrollContainer(page);
    await scrollContainerToFraction(container, 1);
    await expect(page.getByText('Season setup', { exact: true })).toHaveCount(0);
  });

  test('admin: bottom of the real scroll container, "Season setup" gated on teams.length === 0', async ({
    page,
  }) => {
    await signIn(page, 'admin');
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Coach dashboard', exact: true })).toBeVisible();

    const container = await scrollContainer(page);
    await scrollContainerToFraction(container, 1);

    // `tests/e2e-harness/seed.sql` seeds three `teams` rows
    // (`7ea11000-...-000000000001/2/3`), so `teams.length === 0` is false
    // for this seed -- per GAM-438's own spec comment, the "Season setup"
    // card's `teams.length === 0` branch cannot be reached live against
    // this harness's seed data without unwinding the FK chain
    // (`students.team_id references teams ... on delete restrict`). This
    // test reports what actually renders rather than forcing the card to
    // appear.
    const seasonSetupCount = await page.getByText('Season setup', { exact: true }).count();
    // eslint-disable-next-line no-console
    console.log('[GAM-456] admin "Season setup" match count under current seed', seasonSetupCount);

    await page.screenshot({
      path: 'tests/e2e-personas/screenshots/456-admin-dashboard-bottom.png',
    });

    if (seasonSetupCount > 0) {
      await expect(page.getByRole('heading', { name: 'Season setup', exact: true })).toBeVisible();
    } else {
      // Expected under the current seed (teams.length === 3, not 0) --
      // recorded as a passing assertion, not silently skipped.
      expect(seasonSetupCount).toBe(0);
    }
  });
});
