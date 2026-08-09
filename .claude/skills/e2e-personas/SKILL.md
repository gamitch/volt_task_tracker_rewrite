---
name: e2e-personas
description: Drive this app end-to-end in a real browser as admin, coach, student or parent — against a real PostgreSQL cluster carrying this repo's real migrations and RLS — and verify every write by reading the rows back. Use whenever a task asks to test, exercise, screenshot or demo a user-facing workflow as a persona, to check that a UI control actually saves anything, or to establish what a role can and cannot see. Also use before believing a source-read claim about what a screen does, and before reporting a UI bug you have not watched happen.
---

# Persona end-to-end testing

The harness already exists. Adding a workflow means writing one spec file, not
rebuilding anything.

```bash
bash tests/e2e-harness/start.sh                                          # ~40s
npx playwright test -c tests/e2e-harness/playwright.personas.config.ts
bash tests/e2e-harness/stop.sh                                           # always
```

Read `tests/e2e-harness/README.md` once before your first change to it. Read
`tests/e2e-personas/personaHarness.ts` before writing any spec — it is short and
it is the whole API you need.

## Do not re-derive the environment

There is no Supabase project and no Docker daemon here, and `supabase start`
does not work. `playwright.config.ts` (repo root) documents the resulting
ceiling for `tests/e2e/**` and concludes no Playwright test can reach an
authenticated state. That conclusion is about a missing backend, not the app —
`tests/e2e-harness/` supplies one. Do not spend a turn rediscovering this, and
do not "fix" the root config: that suite deliberately tests the unconfigured
path, which is why this harness keeps to `.env.e2e`, `dist-e2e/` and port 4174.

Personas, all with password `VoltTest!2026`:
`admin@volt.test` (Marcus Webb) · `coach@volt.test` (Dana Reyes) ·
`student@volt.test` (Priya Raman) · `parent@volt.test` (Alex Raman, Priya's
guardian). Fixed UUIDs live in `PERSONAS` and `SEED`.

## Two tiers — check which one your workflow is on, first

**Tier 1: goes through PostgREST.** Reuse as-is, no harness change. This is
almost the whole app — anything whose loader calls `client.from('…')`. Verified
examples: creating meetings, recording attendance from the live console, adding
a student to the roster, roster/reports/settings/calendar/outreach.

**Tier 2: goes through an Edge Function.** `supabase/functions/**` runs on Deno
in production and cannot execute here. `server.mjs` carries deliberately shallow
stand-ins for `checkin` and `send-invite` that honour the callers' request and
response *shape* only. A spec that goes through one is testing the app's
handling of a contract, **not** the deployed function — say so, or build the
stand-in out first.

The trap worth naming: "student checks in" is two different features.
`SelfCheckoffDialog` writes `attendance` with `method='self'` straight through
PostgREST and is Tier 1. QR / short-code check-in goes through the `checkin`
Edge Function — HMAC token validation, rate limiting, session liveness, team
scope — and is Tier 2. The kiosk currently shows "QR not available yet" because
the stand-in does not implement redemption.

## Writing a new flow

One file per workflow in `tests/e2e-personas/`, named for the persona and the
flow (`coach-checkin.spec.ts`). `coach-checkin.spec.ts` is the shortest complete
example — copy its shape.

```ts
import { expect, test } from 'playwright/test';
import { PERSONAS, SEED, capture, execAdmin, readRows, signIn } from './personaHarness';

test.beforeEach(() => {
  execAdmin(`delete from attendance where session_id = '${SEED.liveSession}'`);
});

test('marking a student present writes a coach-attributed row', async ({ page }) => {
  expect(readRows(`select 1 from attendance where …`)).toHaveLength(0);  // before
  await signIn(page, 'coach');
  await page.goto(`/meetings/live/${SEED.liveSession}`);
  await page.getByRole('radiogroup', { name: 'Attendance for Priya Raman' })
            .getByRole('radio', { name: 'Present' }).click();
  await expect.poll(() => readRows(`…`).length, { timeout: 20_000 }).toBe(1);   // after
  await capture(page, '40-coach-live-console');
});
```

Four rules, in priority order:

1. **Assert post-write row state, not the request.** A test that checks which
   SQL was generated proves nothing about what the database did with it. Read
   the row back and compare values.
2. **Read back as the persona when visibility is the point.** `readRows` runs as
   the superuser and bypasses RLS, so it can never show a policy denying
   anything. `readRowsAs('student', …)` sets the role and JWT claim the way a
   real request does.
3. **Clean up only your own rows, in `beforeEach`.** Fixtures stay. The suite
   must be re-runnable without a reseed.
4. **Screenshot the moment that carries the evidence**, via `capture(page,
   '<nn>-<persona>-<moment>')`. They land in
   `tests/e2e-personas/screenshots/` and are committed.

If a spec pins current *wrong* behaviour so the suite stays green, say so in a
comment and name what to change when it is fixed. Record behaviour; do not
bless it.

## Traps that have already cost time here

Astryx and this app specifically:

- **`Escape` closes the whole `Dialog`, not just a popover inside it.** After
  picking a date range the calendar dismisses itself on the second click — do
  not press Escape to "close the calendar", you will close the form and lose
  the state. Escape is fine after a `MultiSelector`.
- **Lists render an empty-state card carrying a duplicate primary button while
  the query is in flight.** `getByRole('button', { name: 'Schedule meetings' })`
  hits a strict-mode violation. Wait for real data (`await
  expect(page.getByText('Weeknight Build Session').first()).toBeVisible()`).
- **`getByRole('heading', { name })` matches substrings.** `'Meetings'` also
  matches "No past meetings". Pass `exact: true`.
- **Roster rows are `<li>`, not table rows**, and per-row controls are
  `role=radio` inside a `role=radiogroup` named after the person — e.g.
  `Attendance for Priya Raman`. Scope to the radiogroup; an unscoped "Present"
  matches one control per student.
- **`MultiSelector`'s trigger is `button[role=combobox]`**, its choices are
  `role=option`. Weekday chips resolve to *both* a `<label>` and a `<button>`
  by text — use `getByRole('button', { name: 'Tue', exact: true })`.
- **Recurring mode needs a date range before it produces anything.** Weekday
  chips alone leave the submit at "Create 0 meetings".
- The submit label counts what the form would produce ("Create 3 meetings").
  Read it, then assert the database agrees with the number it promised.

Database and RLS:

- **A blocked INSERT raises `42501`. A blocked UPDATE does not** — the row is
  visible but outside the statement's scope, so it reports `UPDATE 0`. An
  exception-catching assertion silently passes for the UPDATE case. Use
  `execAs` and assert the SQLSTATE for the first; re-read the row for the
  second.
- `execAs` (not `readRowsAs`) for writes: a data-modifying statement is only
  legal at the top level of a CTE, not inside a sub-SELECT.
- Timezone bugs hide in scheduling. The app writes Chicago wall time; assert
  the stored UTC (5:30 PM on 15 Dec is `2026-12-15 23:30Z`).

## Extending the harness

Only when Tier 1 is genuinely not enough.

- **A request 400s with `HARNESS_UNSUPPORTED`.** The PostgREST translation met
  something outside its subset. Add the operator in
  `tests/e2e-harness/lib/postgrest.mjs`. It fails loudly by design — never make
  it guess, because a silent mistranslation manufactures a green test against a
  query the database never saw.
- **Need different data.** Edit `tests/e2e-harness/seed.sql` and re-run
  `start.sh`. Keep every name fabricated (constitution item 6).
- **Need an Edge Function.** Implement it in `EDGE_FUNCTIONS` in
  `server.mjs`, against the real function's contract in
  `supabase/functions/<name>/`. State plainly in the spec that it exercises a
  stand-in.
- `pg_cron` is unavailable locally, so `20260719000000_cron.sql` is **not**
  applied. Nothing depending on scheduled jobs is represented — do not
  generalise past that.

## Before reporting green

Run the counterfactual on anything role- or policy-shaped, per
`mutation-replay`. Promoting the student to `coach` must turn the RLS
assertions red, and restoring must turn them green:

```bash
psql -h 127.0.0.1 -p 55432 -U postgres -d scratch \
  -c "update profiles set role='coach' where email='student@volt.test';"
```

Then `bash tests/e2e-harness/stop.sh`, and say in your output that you did — it
deletes the cluster's data directory and the generated `.env.e2e`. A leftover
cluster holds a port and silently breaks the next run.

Known unrelated baseline: three `/accept-invite` tests in
`tests/e2e/public-routes.spec.ts` (twelve across the 2×2 matrix) fail on a clean
checkout with no `.env` at all. Not yours; do not chase them.
