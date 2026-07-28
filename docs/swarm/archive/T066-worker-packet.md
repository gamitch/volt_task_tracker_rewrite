# Worker Packet: T066

## Task ID
T066 — Playwright persona smoke tests + login + RLS-denial (NFR-02), Epic E11.

**REWRITTEN 2026-07-19, post router-wiring series.** This packet's original central blocker ("ZERO
pages are wired into real routes") is now FALSE and must not be treated as current — do not act on
anything below this note that still references it as live. All 13 app routes now resolve to real
components (T074/T075, Passed), and `guards.tsx`'s `AuthProvider` is wired to real Supabase auth
(T073b2/T076/T077, Passed). The blocker has narrowed, not disappeared — see the new Known Context
section below before writing any code.

## Objective
Build Playwright smoke tests for the four persona flows named in PRD Section 3 (P-COACH,
P-STUDENT, P-COACH2, P-PARENT), plus login and an RLS-denial assertion (student fetching another
student's attendance gets zero rows), satisfying PRD Section 14's acceptance criteria #1, #3, #4,
#9.

## Dependencies (status)
All real dependencies (T033, T037, T042, T053–T060, T073a, T074, T075, T073b1, T073b2, T076, T077,
T078) are Passed. Every route is wired; real Supabase auth exists in the codebase.

## Allowed Files
- `tests/e2e/**` (new directory)
- `playwright.config.ts` (new, project root)

## Forbidden Files
- Every `src/**` file — read-only reference only. This task does not fix application code; any
  real defect found is a candidate follow-up task, flagged in your output, not fixed here.
- `tests/rls/**` (T020's existing scratch-Postgres RLS harness) — read-only reference only. Per the
  updated Known Context section below, this task now cites this existing coverage for the
  RLS-denial requirement rather than rebuilding a weaker version of it in Playwright — read
  `tests/rls/assertions.sql`'s existing "student fetching another student's attendance gets zero
  rows"-shaped scenario to confirm it genuinely covers NFR-02's semantic target, and cite it by
  name/location in your output.
- `supabase/migrations/**`, `docs/swarm/**`, `.claude/**`.

## KNOWN CONTEXT / THE CURRENT BLOCKER — READ THIS FIRST, BEFORE WRITING ANY TEST

**Routing is now genuinely real. Authentication is not usable end-to-end in this environment.**
Confirm both halves of this yourself before proceeding:

- `router.tsx` now imports and renders every real page component at every route (T074/T075,
  Passed) — a real browser navigating this app hits real components, real guards, real redirects.
  This part of the original blocker is gone; do not treat it as still open.
- `guards.tsx`'s `AuthProvider` genuinely calls Supabase (T073b2, Passed) — but this sandbox
  environment has **no real Supabase backend configured** (confirm: `ls .env*` in the repo root
  shows only `.env.example`, no real `.env`; `src/lib/supabase/client.ts`'s `getSupabaseClient()`
  throws `SupabaseNotConfiguredError` when called without one). This means: **no Playwright test
  running in this environment can establish a genuinely authenticated session against a real
  backend, no matter how it's engineered.** This is an infrastructure fact of this sandbox, not a
  wiring gap in the app — there is no clever workaround (pre-seeding `localStorage` with a fake
  session token would still hit a hard `SupabaseNotConfiguredError` the moment any code calls
  `getSupabaseClient()` to resolve a role or fetch data).
- There is also no dev-only mechanism in this codebase to inject a fake authenticated session into
  a live browser instance for Playwright to drive through protected routes. `T073b2` built an
  injectable `authModule` seam on `AuthProvider`, but it's a React prop consumed by
  Vitest/jsdom-based unit tests (`src/test-utils/authHarness.tsx`) — not something a real browser
  hitting `npm run dev` can supply. Building one is a real option (see #3 below), but it does not
  exist yet.

**Practical consequence**: PRD Section 14 acceptance criteria #1, #3, #4, #9 all require an
authenticated session with real or realistic data. None of them are literally satisfiable end-to-
end in THIS environment today. What genuinely IS testable end-to-end now, for real, in a real
browser: every public route (`/login`, `/accept-invite`), and every protected route's
unauthenticated-redirect behavior (confirming `RequireAuth`/`RequireRole` genuinely gate real
routes in a real browser, not just in jsdom).

You have three honest options; pick one (or a disclosed combination), implement it, and disclose
your reasoning explicitly and prominently in your output:

1. **Build real, passing Playwright coverage for what's genuinely testable without auth**: every
   public route renders correctly (both color modes, both viewport classes per Known Context #4
   below), and every protected route's real, live, unauthenticated-redirect-to-`/login` behavior —
   this exercises real routing/guard code in a real browser, is fully genuine, and is a real,
   valuable regression harness even though it doesn't touch the four persona flows directly.
2. **Cross-reference existing coverage for the four persona flows and RLS-denial instead of
   rebuilding it in Playwright**: every persona flow's actual behavior is already covered by
   extensive Vitest/jsdom component tests written by each page's own task (e.g. `CoachHome.test.tsx`
   for P-COACH, `StudentHome.test.tsx`/`CheckinResult.test.tsx` for P-STUDENT,
   `ParticipationTab.test.tsx`/`HoursTab.test.tsx` for P-COACH2, `ParentHome.test.tsx` for
   P-PARENT), each rendering the real component with real fixture data and asserting real behavior
   — just not through a live browser hitting `router.tsx`. Audit and cite this existing coverage
   (matching the aggregation-audit pattern T067/T069 already used) rather than claiming it doesn't
   exist; this is genuine evidence, just not Playwright-shaped.
3. **Build a dev-only test-auth-injection mechanism** (e.g. a `VITE_`-gated dev-mode override on
   `AuthProvider`, or a Playwright `page.addInitScript` that stubs `window`-level state before
   `AuthProvider` mounts) that lets a real browser reach an authenticated state without a real
   backend — genuinely more work, and arguably a separate task's scope (building test
   infrastructure) rather than this one's (writing tests against it). If you judge this the right
   path, scope it explicitly and disclose that you're recommending — not silently building —
   infrastructure beyond this task's original Allowed Files, since `tests/e2e/**`/
   `playwright.config.ts` alone can't build an `AuthProvider`-level seam (that's `src/app/guards.tsx`,
   forbidden here).

Whichever you choose, the worst outcome is a suite that reports green without actually exercising
real behavior — that would be a constitution item 1 ("no worker self-certifies... every PASS
requires independent... evidence") violation in spirit. **Recommended default, absent a strong
reason to do otherwise: combine #1 and #2** — real Playwright coverage for the genuinely-testable
routing/guard surface, plus an honest audit citing the existing Vitest coverage for the persona
flows themselves, with #3 named as a candidate follow-up task rather than attempted here.

## Known Context / Traps (assuming you proceed with some real test-writing, per above)

**1. The four persona flows, cited from PRD Section 3 verbatim:**
- P-COACH: "From Home, a coach can start tonight's meeting check-in in ≤ 2 taps and see live
  status for every roster member on one screen."
- P-STUDENT: "A student scanning the shop QR goes from camera to 'You're checked in' in ≤ 10
  seconds with no typing (when already signed in)."
- P-COACH2: "A second coach can open Reports and answer 'which students are below 70%
  participation this season?' without exporting anything."
- P-PARENT: "A parent opening the app sees, above the fold on a phone, each linked kid's next
  event and current hours/participation."

**2. Section 14 acceptance criteria this task must satisfy, cited verbatim:**
- #1: "All four persona smoke tests (Section 3) pass on production build, mobile and desktop,
  light and dark."
- #3: "A QR check-in with an expired token fails with the DES-16 message; a valid one lands within
  the grace rule (MTG-08)."
- #4: "Coach override survives a subsequent QR write (MTG-11)."
- #9: "An uninvited Google sign-in reaches no data (AUTH-04 + RLS test)."

**3. RLS-denial assertion — semantic target, cited from NFR-02**: "student fetching another
student's attendance gets zero rows." This cannot be genuinely tested end-to-end without a real
backend (Known Context section above). `tests/rls/**` (T020's existing scratch-Postgres RLS
harness, read-only reference) already covers this exact scenario for real, against a real Postgres
instance with the real RLS policies applied — cite that existing, genuine coverage rather than
building a second, weaker (mocked) version of the same assertion in Playwright. Do not claim you
tested against real Supabase RLS policies via Playwright if you did not.

**4. Both color modes, both mobile and desktop viewports** — Playwright's `colorScheme`/`viewport`
context options, cited from `docs/swarm/astryx-api.md`'s theming conventions if relevant, or
Playwright's own real API (this is standard Playwright config, not an Astryx concern).

**5. Coach-override-survives-QR-write (MTG-11)** — read `LiveConsole.tsx` (already Passed, T033)
for the real client-side logic this criterion maps to. `LiveConsole.test.tsx` already has extensive
MTG-11-specific coverage (confirmed by T033's own checker and re-confirmed by T067's later audit) —
per Option #2 above, cite that existing coverage rather than rebuilding a live-backend round-trip
this environment can't run anyway.

## Acceptance Criteria
- A clear, prominently-disclosed resolution of the current blocker (Known Context section above) —
  this is the single most important thing this task's checker will scrutinize.
- Real, passing Playwright coverage for every public route and every protected route's
  unauthenticated-redirect behavior, in both color modes and both viewport classes.
- Whatever suite IS built passes for real, with zero fake-green assertions.
- The four persona flows and RLS-denial requirement addressed via honest citation of existing
  Vitest/RLS-harness coverage (Option #2), not a fabricated or weaker Playwright re-implementation.
- No box-drawing/bracket characters (constitution item 13).

## Relevant Constitution Excerpts
> No task is ever marked complete on worker self-report — every PASS requires independent
> checker-inspected evidence, not trust of worker claims. *(Cited because this task is at genuine
> risk of a worker producing a suite that "passes" only because it asserts nothing meaningful — the
> checker will scrutinize this specifically.)*

## Most Recent Failure
None. This is attempt 1 for T066 (attempt count: 0) — not yet dispatched.

## Required Worker Output
- Full contents of every file under `tests/e2e/**` and `playwright.config.ts`.
- Explicit, prominent write-up of which of the three options (or combination) you chose, and why.
- Explicit mapping of each Section 14 acceptance criterion (#1, #3, #4, #9) to the specific
  test(s) addressing it, or to the specific existing Vitest/RLS-harness coverage you're citing
  instead, with exact file/test names.
- Real run output (not just "should pass" — actual `npx playwright test` output).
- If you recommend Option #3 (a dev-only auth-injection mechanism) as a follow-up rather than
  building it yourself, describe its shape concretely enough for a future task to be scoped from
  your description.
- Known risks; whether a dispute is needed (you flag, you don't resolve).
