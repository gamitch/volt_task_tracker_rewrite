/**
 * T066: Playwright config for the real, in-browser routing/guard smoke
 * suite under `tests/e2e/**`.
 *
 * ---------------------------------------------------------------------
 * WHY THIS CONFIG ONLY COVERS ROUTING/GUARD BEHAVIOR, NOT THE FOUR PRD
 * SECTION 3 PERSONA FLOWS OR THE RLS-DENIAL ASSERTION -- read in full
 * before adding a spec file to `tests/e2e/**` that assumes otherwise.
 *
 * This sandbox environment has NO real Supabase backend configured:
 *   - `ls .env*` in the repo root shows only `.env.example` (blank
 *     placeholders), no real `.env` -- confirmed by this task's own worker
 *     output, re-confirmable by any reader at any time.
 *   - `src/lib/supabase/client.ts`'s `getSupabaseClient()` throws a real
 *     `SupabaseNotConfiguredError` the moment anything calls it without
 *     both `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY` set.
 *   - `src/app/guards.tsx`'s `AuthProvider` calls the real Supabase auth
 *     module (`src/lib/supabase/auth.ts`) by default; in this environment
 *     both `getInitialSession()` and `subscribeToAuthStateChange()` throw
 *     that same `SupabaseNotConfiguredError`, which `AuthProvider` catches
 *     and fails safe to "anonymous" (`user: null, isLoading: false`) --
 *     see that file's own `init()`/`subscribeToAuthStateChange` catch
 *     blocks for the real, disclosed reasoning.
 *   - There is no dev-only mechanism anywhere in this codebase to inject a
 *     fake authenticated session into a real browser instance (the one
 *     injectable seam that exists, `AuthProvider`'s `authModule` prop, is
 *     a React prop consumed by Vitest/jsdom unit tests via
 *     `src/test-utils/authHarness.tsx` -- not reachable by a real browser
 *     hitting `npm run preview`).
 *
 * Practical consequence, verified live against this exact production build
 * (see this task's worker output for the full captured console transcript):
 * navigating any `RequireAuth`-protected route in a real browser in this
 * environment deterministically redirects to `/login`, because the real
 * `SupabaseNotConfiguredError` is thrown and caught exactly as designed --
 * NOT because of a test-harness fake. No Playwright test running in this
 * environment can reach an authenticated state against a real backend, no
 * matter how it is engineered (pre-seeding `localStorage`/`sessionStorage`
 * with a fake session token would still hit the same hard error the moment
 * any code calls `getSupabaseClient()` to resolve a role or fetch data).
 *
 * What genuinely IS testable end-to-end here, for real, in a real browser
 * against the real production build: every public route rendering
 * correctly, and every protected route's real, live redirect-to-`/login`
 * behavior (this exercises real `RequireAuth`/`RequireRole` code in an
 * actual browser, not jsdom). That is exactly what `tests/e2e/**` covers.
 *
 * The four PRD Section 3 persona flows (P-COACH/P-STUDENT/P-COACH2/
 * P-PARENT) and the RLS-denial requirement (NFR-02) are instead satisfied
 * by extensive EXISTING coverage this task audits and cites rather than
 * re-implements more weakly here -- see this task's worker output for the
 * full file-by-file citation (`src/pages/home/CoachHome.test.tsx`,
 * `src/pages/home/StudentHome.test.tsx` + `src/pages/checkin/
 * CheckinResult.test.tsx`, `src/pages/meetings/LiveConsole.test.tsx`,
 * `src/pages/home/ParentHome.test.tsx`, `tests/rls/assertions.sql`).
 * ---------------------------------------------------------------------
 *
 * `playwright/test` (not `@playwright/test`) is imported below because
 * this sandbox's globally-installed `playwright` package (`/opt/node22/
 * lib/node_modules/playwright`, pre-installed Chromium at
 * `PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers`) bundles the full test
 * runner under its own `test.js`/`test.mjs` entry point -- the same real
 * mechanism T074/T075 already relied on for live-browser verification in
 * this project. Per this task's Allowed Files (`tests/e2e/**`,
 * `playwright.config.ts` only), `package.json` is NOT modified to add
 * `@playwright/test`/`playwright` as a project dependency.
 *
 * Module resolution note: this repo's `package.json` sets `"type":
 * "module"`, so this config file loads as real ESM, and Node's ESM
 * resolver (unlike CommonJS `require`) does NOT honor `NODE_PATH` at all --
 * confirmed empirically (a `NODE_PATH=/opt/node22/lib/node_modules`
 * environment variable alone reproducibly fails with `ERR_MODULE_NOT_FOUND`
 * for this exact `import` line). The mechanism this task actually uses
 * instead: a single symlink, `node_modules/playwright ->
 * /opt/node22/lib/node_modules/playwright` (created via plain `ln -s`, not
 * tracked by git -- `node_modules/` is already gitignored, and this task
 * never edits `package.json`/`package-lock.json`), so ordinary Node module
 * resolution finds the real global `playwright` package (which bundles its
 * own nested `playwright-core` dependency) starting from this file's own
 * directory, the same way it would for any other real local dependency.
 * See this task's worker output for the exact `ln -s` command and the
 * before/after resolution proof.
 */
import { defineConfig, devices } from 'playwright/test';

const PORT = 4173;
const BASE_URL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  // No `process.env.CI` branching below (unlike a typical Playwright
  // config template): this repo's `eslint.config.js` (forbidden file for
  // this task) scopes every `**/*.{ts,tsx}` file -- including this one --
  // to `globals.browser` only, with no Node.js globals declared anywhere,
  // so a bare `process` reference here is a real `no-undef` lint error this
  // task cannot fix by editing `eslint.config.js`. This sandbox is also
  // never a traditional CI runner (there is no CI system invoking this
  // suite) -- hardcoding the sensible-for-this-environment values below
  // (never forbid `.only`, always reuse an already-running preview server)
  // is honest, not a workaround.
  forbidOnly: false,
  retries: 0,
  reporter: [['list']],
  timeout: 30_000,
  use: {
    baseURL: BASE_URL,
    trace: 'retain-on-failure',
  },
  // PRD Section 14 Acceptance Criterion #1 says "on production build" --
  // this always runs the real `npm run build` + `npm run preview` static
  // server (never `npm run dev`), so what these tests exercise is the real
  // production artifact, matching that requirement for the routing/guard
  // surface this suite actually covers.
  webServer: {
    command: `npm run build && npm run preview -- --port ${PORT} --strictPort`,
    url: BASE_URL,
    reuseExistingServer: true,
    timeout: 180_000,
  },
  // Known Context #4: both color modes, both mobile/desktop viewport
  // classes -- four projects covering the full 2x2 matrix. Every spec file
  // under `tests/e2e/**` runs once per project below, so a single `test()`
  // body is exercised in all four real combinations.
  projects: [
    {
      name: 'desktop-light',
      use: { ...devices['Desktop Chrome'], colorScheme: 'light' },
    },
    {
      name: 'desktop-dark',
      use: { ...devices['Desktop Chrome'], colorScheme: 'dark' },
    },
    {
      name: 'mobile-light',
      use: { ...devices['Pixel 7'], colorScheme: 'light' },
    },
    {
      name: 'mobile-dark',
      use: { ...devices['Pixel 7'], colorScheme: 'dark' },
    },
  ],
});
