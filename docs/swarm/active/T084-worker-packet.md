# Worker Packet: T084

## Task ID
T084 — Fix CI: exclude `tests/e2e/**` from Vitest discovery (fallout from T066), Epic E11.

## Objective
T066 (Passed) added `tests/e2e/**` (Playwright specs, using `import { test } from 'playwright/test'`)
without a companion fix to `vite.config.ts`'s Vitest `test.exclude` array — `vite.config.ts` was
forbidden to T066's own Allowed Files. This broke CI: Vitest's default discovery picks up
`tests/e2e/*.spec.ts` as if they were Vitest tests, and fails importing `playwright/test` (which is
not a real `package.json` dependency — T066 relied on a local, gitignored `node_modules/playwright`
symlink that only exists on the machine that created it, not in a fresh CI checkout). Confirmed via
the actual failing CI job logs (`Cannot find package 'playwright/test'`, `ERR_MODULE_NOT_FOUND`).

This is a one-line fix: add `tests/e2e/**` to the existing `exclude` array, matching the exact same
pattern already used for `supabase/functions/**` (Deno-runtime tests, excluded for an analogous
reason — a different test runner with its own file convention).

## Allowed Files
- `vite.config.ts`

## Forbidden Files
- Everything else, including `tests/e2e/**` itself (already correct, T066, Passed — read-only
  reference) and `playwright.config.ts`. `docs/swarm/**`, `.claude/**`.

## Known Context / Traps

**1. This is a single-line addition to an existing array**, not a new config section:
```ts
exclude: ['**/node_modules/**', '**/dist/**', 'supabase/functions/**'],
```
becomes
```ts
exclude: ['**/node_modules/**', '**/dist/**', 'supabase/functions/**', 'tests/e2e/**'],
```
Do not restructure, reformat, or otherwise touch anything else in this file.

**2. Verify the fix actually resolves the real CI failure, not just locally.** Run `npm run test`
(Vitest) and confirm `tests/e2e/**` is no longer picked up at all (should show the same test-file
count as before `tests/e2e/**` existed, i.e. the full suite passes with zero mention of
`public-routes.spec.ts`/`protected-route-redirects.spec.ts`). This is the literal reproduction of
what CI runs.

**3. Do not attempt to make Vitest able to run the Playwright specs correctly instead of excluding
them** — that's not what's needed; Playwright specs are meant to run via `npx playwright test`
(a separate command/runner), never via Vitest. Exclusion is the correct fix, not a workaround.

## Acceptance Criteria
- `vite.config.ts`'s `test.exclude` array includes `tests/e2e/**`.
- `npm run test` (Vitest) no longer attempts to parse or run anything under `tests/e2e/`.
- `npm run typecheck`, `npm run lint`, `npm run build`, `npm run format:check` all clean.
- No other change to `vite.config.ts`.

## Relevant Constitution Excerpts
> No worker may mark its own work complete; every PASS requires independent checker-inspected
> evidence.

## Most Recent Failure
None. This is attempt 1 for T084 (attempt count: 0) — first dispatch, urgent (currently breaking
CI on the live PR).

## Required Worker Output
- Full diff of `vite.config.ts` (should be exactly one line changed).
- `npm run test` output confirming `tests/e2e/**` is no longer discovered by Vitest.
- Full typecheck/lint/build/format:check output.
- Known risks; whether a dispute is needed (you flag, you don't resolve — should not be needed for
  a fix this narrow).
