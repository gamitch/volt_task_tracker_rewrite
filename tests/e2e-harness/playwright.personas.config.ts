/**
 * Playwright config for the persona suite under `tests/e2e-personas/**`.
 *
 * This is a SEPARATE config from the repo root `playwright.config.ts` on
 * purpose. That one covers the routing/guard surface reachable with no
 * backend at all, across a 2x2 colour-mode x viewport matrix. This one needs
 * the backing services from `tests/e2e-harness/start.sh` and runs a single
 * desktop project — the personas write to a shared database, so multiplying
 * the matrix would multiply the writes rather than the coverage.
 *
 * Run it with:
 *   bash tests/e2e-harness/start.sh
 *   npx playwright test -c tests/e2e-harness/playwright.personas.config.ts
 *
 * `playwright/test` (not `@playwright/test`) is imported for the same reason
 * the root config documents: `./test` is a declared export of the
 * `playwright` package, which bundles the runner. What changed under GAM-350
 * is the second half of that reason — `playwright` is now a real, exactly
 * pinned devDependency, so this import resolves from a clean `npm ci` with
 * nothing installed globally. It previously did not, and the suite ran only
 * on hosts that happened to carry the package.
 */
import { defineConfig, devices } from 'playwright/test';

// Deliberately NOT 4173, which the root `playwright.config.ts` uses. Both
// configs set `reuseExistingServer`, so sharing a port would let one suite
// silently reuse the other's bundle — and the two bundles differ: this one is
// built with Supabase configured, that one without.
const PORT = 4174;
const BASE_URL = `http://127.0.0.1:${PORT}`;

export default defineConfig({
  testDir: '../e2e-personas',
  // The personas share one database, and several specs assert on rows another
  // spec could be writing. Serial execution is the honest choice here.
  fullyParallel: false,
  workers: 1,
  forbidOnly: false,
  retries: 0,
  // The HTML report must live outside `test-results/`: Playwright clears the
  // report folder before writing it, which would delete the traces and
  // failure screenshots sitting alongside it.
  reporter: [['list'], ['html', { outputFolder: '../../playwright-report/personas', open: 'never' }]],
  timeout: 90_000,
  expect: { timeout: 15_000 },
  use: {
    baseURL: BASE_URL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'off',
  },
  // The real production artifact, never `npm run dev` — same posture as the
  // root config. `--mode e2e` is what makes Vite read the `.env.e2e` that
  // `start.sh` writes; a default-mode build stays unconfigured, which is what
  // the root suite needs. The database and the Supabase-compatible API are
  // started separately by `start.sh`; `globalSetup` fails loudly if they are
  // not up.
  globalSetup: './globalSetup.mjs',
  webServer: {
    // `--outDir dist-e2e` keeps this bundle out of `dist/`, which the root
    // suite builds and previews. Sharing one output directory would let a root
    // build overwrite the bundle a running persona preview is still serving.
    command:
      `npm run build -- --mode e2e --outDir dist-e2e && ` +
      `npm run preview -- --outDir dist-e2e --port ${PORT} --strictPort`,
    url: BASE_URL,
    reuseExistingServer: true,
    timeout: 180_000,
  },
  projects: [
    {
      name: 'desktop-light',
      use: { ...devices['Desktop Chrome'], colorScheme: 'light', viewport: { width: 1440, height: 1000 } },
    },
  ],
});
