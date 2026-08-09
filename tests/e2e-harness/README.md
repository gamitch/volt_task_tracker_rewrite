# Persona end-to-end harness

Runs the real production bundle, in a real browser, as each of the four
personas, against a real PostgreSQL database carrying this repo's real
migrations — with no Supabase project, no Docker, and no new npm dependency.

```bash
bash tests/e2e-harness/start.sh
npx playwright test -c tests/e2e-harness/playwright.personas.config.ts
bash tests/e2e-harness/stop.sh
```

Screenshots land in `tests/e2e-personas/screenshots/`; the HTML report lands in
`playwright-report/personas/`.

## Why it exists

`playwright.config.ts` (repo root) documents a hard ceiling for the
`tests/e2e/**` suite: with no `.env` and no backend, `getSupabaseClient()`
throws `SupabaseNotConfiguredError`, `AuthProvider` fails safe to anonymous, and
every `RequireAuth` route deterministically redirects to `/login`. That suite is
therefore limited to public routes and redirect behaviour, and the four PRD
Section 3 persona flows were covered by jsdom unit tests instead.

This harness removes the ceiling by supplying the missing backend.

## What it is

| Piece | File | What it does |
| --- | --- | --- |
| Database | `.claude/skills/scratch-postgres` | Disposable PG16 cluster, `supabase/migrations/*.sql` applied in order |
| Platform grants | `start.sh` + `tests/rls/grants.sql` | The schema/table grants hosted Supabase applies by default |
| Fixtures | `seed.sql` | Four personas, two active teams plus one archived, seasons, events, sessions, attendance, RSVPs |
| API | `server.mjs` | GoTrue + PostgREST + storage + Edge Function subsets, over the same cluster |
| Config | `playwright.personas.config.ts` | Builds and previews the production bundle, one desktop project, serial |
| Specs | `../e2e-personas/*.spec.ts` | The persona flows |

`server.mjs` runs every request inside

```sql
begin;
set local role authenticated;
set local request.jwt.claim.sub = '<persona uuid>';
...
commit;
```

so `auth.uid()`, `is_staff()` and `my_student_ids()` resolve for real and the
migrations' own RLS policies decide what each persona can read and write. The
harness connects as the superuser; without that `set local role`, RLS would be
silently inert and the whole exercise would prove nothing.

## Why it does not disturb the other suites

`npm test` and the root `playwright.config.ts` suite both deliberately assert
the app's behaviour when Supabase is **not** configured. So this harness keeps
its configuration out of their way three times over:

- `start.sh` writes `.env.e2e`, not `.env`. Vite only reads it for
  `--mode e2e`, which only this config's build uses.
- The build goes to `dist-e2e/` and previews on **4174**. The root suite builds
  `dist/` and previews on 4173, and both configs set `reuseExistingServer` — one
  shared port or output directory would let a suite silently serve the other's
  bundle.
- `vite.config.ts` pins `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` blank for
  Vitest, so the unit suite no longer depends on a developer happening not to
  have a `.env` — which `.env.example` tells them to create.

Known unrelated baseline: three `/accept-invite` tests in
`tests/e2e/public-routes.spec.ts` (12 across the 2x2 project matrix) fail on a
clean checkout with no `.env` at all. They predate this harness.

## What is real, and what is not

**Real.** The schema, constraints, triggers, metric views and RLS policies. The
React bundle under test is the real `npm run build` output — nothing in `src/`
is stubbed, patched, or aware this harness exists. Sign-in goes through the real
`LoginPage`, the real `signInWithPassword`, and the real two-step
session → role resolution in `src/app/guards.tsx`.

**Not real, and load-bearing to know:**

- `server.mjs` is not GoTrue and not PostgREST. Passwords are compared as
  SHA-256 rather than bcrypt, tokens are HS256 JWTs minted locally, and the
  query translation covers the subset `src/lib/supabase/loaders/**` actually
  uses. It throws `UnsupportedQueryError` (HTTP 400, code `HARNESS_UNSUPPORTED`)
  rather than guessing at anything outside that subset — a shim that silently
  mistranslated would manufacture green tests against a database that never saw
  the query.
- The subset is tractable only because no `.select(...)` in this repo nests a
  foreign-table selector. If one is added, `parseSelect` will reject it loudly.
- Edge Functions (`supabase/functions/**`) run on Deno in production and cannot
  execute here. `checkin` and `send-invite` have stand-ins that honour the
  callers' request/response contract. Anything asserted through one of those is
  asserting the app's handling of the contract, not the deployed function body.
- `pg_cron` is unavailable locally, so `20260719000000_cron.sql` is **not**
  applied. Nothing depending on scheduled jobs is represented in this cluster.
- Storage objects live in memory in the server process, not in Supabase Storage.

## Personas

All four share the password `VoltTest!2026`. Every name is fabricated
(constitution item 6).

| Login | Name | Role |
| --- | --- | --- |
| `admin@volt.test` | Marcus Webb | admin |
| `coach@volt.test` | Dana Reyes | coach |
| `student@volt.test` | Priya Raman | student (on Volt Robotics 9911) |
| `parent@volt.test` | Alex Raman | parent (guardian of Priya) |

## Conventions for specs

- **Assert post-write row state, not the request.** `readRows` in
  `../e2e-personas/personaHarness.ts` reads Postgres directly, so a UI
  assertion and a database assertion are independent witnesses.
- **Read back as a persona where visibility is the point.** `readRowsAs` sets
  the role and JWT claim the way a real request does; a superuser read bypasses
  RLS and can never show a policy denying anything.
- **A blocked INSERT raises, a blocked UPDATE does not.** RLS rejects a
  cross-user INSERT with `42501`; a cross-user UPDATE simply reports `UPDATE 0`.
  Use `execAs` and assert the SQLSTATE for the first, and re-read the row for
  the second.
- Specs that pin current *buggy* behaviour say so in a comment and name what to
  change when it is fixed. They record behaviour; they do not bless it.
