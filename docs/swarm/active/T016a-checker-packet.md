# Checker Packet: T016a

## Task ID
T016a

## Objective
Independently verify that `src/app/router.tsx`'s `/login` route now renders the real, previously-verified `LoginPage` component from `src/pages/login` (not a placeholder), that no other route or file was affected, and that the wiring genuinely works live in a browser — not just that it typechecks/builds. Do not trust the worker's summary or Playwright output as-is; reproduce the key checks yourself.

## What Changed (per worker report — verify, don't assume)
Worker-implementer removed the inline placeholder `LoginPage()` function (previously defined directly in `router.tsx`, along with its `signInAs`/`continueWithGoogle` helpers) and replaced the `/login` route's element with the real component via `import { LoginPage } from '../pages/login';`. Worker reports: typecheck/lint/build/format:check/test all exit 0; live Playwright verification of (a) real component rendering at `/login`, (b) full sign-in round trip redirecting to `/`, (c) NAV-08 intended-URL preservation (unauthenticated deep link to `/roster` → `/login` → sign in → back to `/roster`), (d) `/kiosk/:sessionId` unauthenticated spot-check still redirects to `/login`; `src/pages/login/**` confirmed untouched via SHA-256 checksum. Commit 6c1e372.

## Acceptance Criteria (from the ledger's T016a detail block)
1. `npm run typecheck`, `npm run lint`, `npm run build`, `npm run format:check`, `npm run test` all exit 0 — re-run yourself, do not trust worker-reported exit codes.
2. `router.tsx` no longer defines its own `LoginPage` function anywhere; `/login`'s route element resolves to the real imported component.
3. No unused imports left in `router.tsx` (the old placeholder used `useAuth`, `useNavigate`, `Role`, `consumeIntendedUrl` from `./guards` — confirm each was actually removed if no longer used, and that nothing still-needed was accidentally stripped).
4. Live verification, reproduced independently (build your own throwaway Playwright script(s), real Chromium at `/opt/pw-browsers`, against a real `npm run dev` server — do not just read the worker's script and assume it ran as described):
   - `/login` renders the real component: VOLT wordmark, email field, password field, "Forgot password" link, "Sign in" button, "Continue with Google" button present. Confirm the OLD placeholder's "Login (placeholder)" heading and "Sign in as staff/admin" buttons are gone.
   - A full sign-in submission round trip (valid-looking email/password) redirects to `/`.
   - NAV-08 intended-URL preservation: fresh unauthenticated browser context → navigate directly to `/roster` → redirected to `/login` (the real component) → submit sign-in → lands back on `/roster`, not just `/`.
   - `/kiosk/:sessionId` unauthenticated → still redirects to `/login` correctly (regression check only, guard logic itself is out of scope for this task).
5. Full diff of `router.tsx` against its pre-T016a state shows ONLY: removal of the placeholder function + its two helper closures, the new `LoginPage` import, any necessarily-related import cleanup, and the module doc comment update. No other `<Route>` entry, placeholder component, or `routePaths` export changed.
6. `src/pages/login/**` (LoginPage.tsx, index.ts) byte-identical to before T016a — verify via checksum, not eyeballing.

## Forbidden Modification Check (run first, D001 method — compare Allowed Files list against current file tree state directly, do NOT use git history/commit authorship as evidence)
Allowed for this task: `src/app/router.tsx` only.
Verify untouched: `src/pages/login/**`, `src/app/guards.tsx`, `src/app/AppShell.tsx`, everything else outside `src/app/router.tsx`. Also confirm no writes under `docs/swarm/**`/`.claude/**` by the worker (background swarm-process artifacts like this checker/worker packet file and the hook-appended verification-log.md line are expected and NOT findings — see the standing calibration note from T004's close-out).

If any forbidden file was modified beyond `src/app/router.tsx`, return:
FAIL - BLOCKER - unauthorized modification.

## Relevant Constitution Excerpts
> Non-Negotiables: "No worker may mark its own work complete." / "Every checker must inspect the actual artifact, not just the worker's summary." — this applies directly here: re-run the commands and the live browser checks yourself rather than accepting the worker's reported output.

> Item 15: Accessibility per PRD DES-17/NFR-07 is a shipping requirement; keyboard path failures on core flows → BLOCKER. (Not the focus of this task — T016's checker-accessibility already cleared the component itself — but if your live verification surfaces something newly broken as a result of the wiring change itself, e.g. focus not landing correctly on route transition, treat it as in-scope.)

## Most Recent Failure
None — this is T016a's first checker run (worker attempt 1).

## Required Checker Output
- PASS or FAIL
- severity: BLOCKER, MAJOR, MINOR, or NIT (highest finding)
- evidence inspected (files read, exact commands run, your own Playwright script(s) and their real output)
- commands run
- exact findings
- required rework if failed
- follow-up tasks if passed with minor issues (note explicitly: this task does NOT cover wiring `AcceptInvitePage` for T018, or building real Supabase auth in `guards.tsx` — both remain separately tracked, do not fold them into this verdict)
