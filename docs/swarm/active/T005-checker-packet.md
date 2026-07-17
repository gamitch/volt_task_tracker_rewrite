# Checker Packet: T005

## Task ID
T005 — Router skeleton + route guards + deep-link redirect

## Checker Agent
checker-reviewer

## Attempt
Check attempt 1 of 3 (max 3 before mandatory boss-arbiter escalation per constitution "Loop Limit").

## Objective Being Checked
A self-contained React Router route table stub covering every route in PRD Section 7 (as placeholders), plus NAV-06 auth/role guards and the NAV-08 store-intended-URL-and-redirect-after-login mechanism (including a Google OAuth round-trip). The router/guards must NOT be wired into `main.tsx`/`App.tsx` — that integration is deliberately deferred to T006.

## IMPORTANT: No worker self-report exists for this task — read this first
T005's worker-implementer session died mid-run (hit a session usage-limit failure) while deleting a self-declared temporary test file, `src/app/_scratch.guards.manualcheck.test.tsx`. That file's own header comment stated it was "NOT part of the final artifact, deleted before the worker packet is handed back" — i.e. the worker had already decided to delete it before being cut off, this was not a judgment call made on the worker's behalf. The orchestrating session finished that already-declared deletion directly (confirmed: `src/app/` now contains only `guards.tsx` and `router.tsx`, no scratch file) and confirmed `npm run build`/`npm run typecheck` exit 0, with lint showing only pre-existing non-blocking `react-refresh/only-export-components` warnings.

**No "Required Worker Output" report was ever produced for T005.** Do not look for one, do not treat its absence as a violation, and do not ask the worker anything. Derive every finding below directly from the artifacts on disk (`src/app/router.tsx`, `src/app/guards.tsx`, `package.json`, `package-lock.json`) and from your own independent testing. Treat this task the way you would treat a claim-free artifact: verify everything from scratch, cross-checked only against the ground truth below (PRD Section 7 route list, NAV-06, NAV-08), never against worker narration.

## Allowed Files (only these should differ from the pre-T005 tree)
- `src/app/router.tsx`
- `src/app/guards.tsx`
- `package.json` (react-router-dom dependency addition only)
- `package-lock.json` (lockfile update for the same addition)

## Forbidden Files (BLOCKER if touched)
- `docs/swarm/**`, `.claude/**`
- `src/main.tsx` — must remain unwired to the router; T006's job, not T005's.
- `src/App.tsx` — must remain unwired to the router; T006's job, not T005's.
- `src/theme/**` — out of scope for this task.
- Anything outside the four Allowed Files above.

**Standing rule (D001, do not re-litigate):** never use git commit history/diffs as evidence of which agent touched a file — git identity here mixes orchestrator/worker/hook commits and does not reliably distinguish authorship. Instead, compare the task's Allowed Files list directly against the current file tree state (`src/app/` should contain only `router.tsx` and `guards.tsx`; `src/main.tsx`/`src/App.tsx` content should show no router-related changes) to check for forbidden-file violations.

## Ground-Truth Requirement Text (verbatim/paraphrase, outranks any packet prose)
- **PRD Section 7 route inventory** (the full list this task must stub, one `<Route>` each): `/login`, `/accept-invite`, `/`, `/meetings`, `/meetings/live/:sessionId`, `/kiosk/:sessionId`, `/checkin`, `/outreach`, `/outreach/:eventId`, `/calendar`, `/roster`, `/reports`, `/settings`.
- **NAV-06**: unauthenticated access to a protected route redirects to `/login`; wrong-role access redirects to `/` with a Toast reading exactly "You don't have access to that page."
- **NAV-08**: the intended URL is stored before redirecting to `/login`, and the user is returned to that URL after a successful login round-trip, including the Google OAuth round-trip case.
- Constitution item 1 (precedence): PRD requirement IDs outrank constitution/ledger/packet paraphrase — if this packet conflicts with actual PRD text, follow the PRD (re-read PRD Section 7 / NAV-06 / NAV-08 directly, don't take this packet's paraphrase as final).
- Constitution item 8 (stack lock, BLOCKER class): Vite + React 19 + TS strict + Supabase; no Tailwind/shadcn/alternate libs.
- Constitution item 9 (dependency allowlist): `react-router-dom` is pre-approved — its addition alone is not a violation, but it must be the *only* new dependency, and any peer-dep-forced side effects must be checked (see step 5 below).
- Constitution item 15: accessibility per DES-17/NFR-07 is a shipping requirement — keyboard path failures on core flows are BLOCKER. This task doesn't ship interactive UI beyond placeholder buttons, but confirm the placeholder `<button>` elements used for the guard demo are real, keyboard-operable native elements, not divs with click handlers.
- Definition of Done: no task may be marked complete on a self-report, worker or otherwise — you must inspect the actual artifact and, since none exists here, generate your own independent evidence.

## What's on disk (context, verify independently — do not just trust this description)
- `src/app/router.tsx` exports `AppRoutes()` (a bare `<Routes>` tree, no `<BrowserRouter>`) and a `routePaths` constant map. All 13 Section-7 routes appear present as stub `<Route>` elements with placeholder page components.
- `src/app/guards.tsx` exports `AuthProvider`/`useAuth` (in-memory placeholder auth, explicitly not wired to Supabase yet — that's a future task), `RequireAuth`, `RequireRole`, and the NAV-08 helpers `setIntendedUrl`/`getIntendedUrl`/`clearIntendedUrl`/`consumeIntendedUrl`, plus a toast pub/sub (`pushToast`/`subscribeToast`) and the exact string constant `ACCESS_DENIED_TOAST_MESSAGE = "You don't have access to that page."`.
- `/kiosk/:sessionId` is stubbed as a public (unauthenticated) route — the router's own header comment flags this as an assumption made because the PRD excerpt available to the worker didn't spell out kiosk auth requirements. Check whether PRD Section 7 / kiosk-related requirement text (MTG-07 area) actually confirms or contradicts this; if the PRD is silent or supports "public," this is fine as a documented assumption, not a defect — but confirm it yourself rather than accepting the comment at face value.
- `/settings` is guarded with `RequireRole allowedRoles={['admin']}` — router's comment flags this as an illustrative placeholder since the full role-per-route matrix wasn't in the worker's excerpt. This is expected/acceptable for a route-table *stub* task; do not fail the task for an incomplete RBAC matrix, but do confirm the mechanism itself (nesting `RequireRole` inside `RequireAuth`) is sound and reusable for other routes later.
- `package.json`: `react-router-dom` added at `^7.18.1`. `package-lock.json` shows `react-router-dom@7.18.1` with `peerDependencies: { "react": ">=18", "react-dom": ">=18" }` — compatible with the installed React `19.2.7` without needing `--legacy-peer-deps`.

## Required Verification Steps
1. **Route inventory.** Read `src/app/router.tsx` and check off each of the 13 PRD Section 7 routes listed above against an actual `<Route path="...">` entry. Flag any missing route as BLOCKER (task objective explicitly requires "every route in Section 7"); flag any extra/invented route as at least a NIT unless it's clearly harmless scaffolding.
2. **Independent guard test.** No worker report exists to cross-check against, so write and run your own throwaway test exercising `RequireAuth` and `RequireRole` in a real React tree (e.g. `createRoot` + `MemoryRouter` + `AuthProvider`, or an equivalent vitest+jsdom render). At minimum assert: (a) `RequireAuth` renders children when `user` is set and redirects to `/login` when `user` is null; (b) `RequireRole` redirects to `/` and calls `pushToast` with exactly `"You don't have access to that page."` when the user's role is not in `allowedRoles`, and renders children when it is. Delete this throwaway test file before finishing your check — same discipline prior checkers in this project have followed (do not leave scratch test files in the tree).
3. **NAV-08 round-trip.** Confirm `setIntendedUrl` is called with the full `pathname+search+hash` inside `RequireAuth` before the `<Navigate to="/login">`, and that `consumeIntendedUrl` both reads and clears the stored value. Simulate the full round-trip in your test: mount a protected route unauthenticated → confirm intended URL stored → call `login()` (or `loginWithGoogle()`) → call `consumeIntendedUrl()` → assert it returns the originally-blocked path, and that a second call returns the fallback (proving it was cleared, not left stale). Cover both the plain `login()` path and the `loginWithGoogle()` placeholder path in `router.tsx`'s `LoginPage`.
4. **Integration-deferral check.** Read `src/main.tsx` and `src/App.tsx` in full. Confirm neither imports from `src/app/router.tsx` or `src/app/guards.tsx`, and neither renders `<AppRoutes>`/`<AuthProvider>`/`<BrowserRouter>`. Any such wiring is a forbidden-file violation (T006's job) — BLOCKER if found.
5. **Dependency check.** Diff `package.json`/`package-lock.json` against the pre-T005 baseline (T003/T002a state). Confirm `react-router-dom` is the *only* new top-level dependency. Confirm its resolved `peerDependencies` (`react`/`react-dom` `>=18`) are satisfied by the installed `react@19.2.7`/`react-dom@19.2.7` without `--legacy-peer-deps` — grep `package-lock.json` for the react-router-dom entry and quote the peer range directly.
6. **Build/typecheck/lint.** Independently run `npm run build`, `npm run typecheck`, `npm run lint`. Quote real output (exit codes + relevant lines). Confirm zero errors. Lint warnings about `react-refresh/only-export-components` in `guards.tsx` (from exporting both components and hooks/constants from the same file) are expected and non-blocking — this is a common pattern for a guards module; do not fail the task on this basis, but confirm there are no *other* lint errors hiding among the warnings.
7. **Forbidden-file check.** Compare the Allowed Files list above against the current file tree state directly (never git-commit-bundling — D001 standing rule). Confirm `src/app/` contains only `router.tsx` and `guards.tsx` (i.e. the scratch test file `_scratch.guards.manualcheck.test.tsx` is genuinely gone, not just renamed/hidden). Confirm no changes under `src/theme/**`, `docs/swarm/**`, `.claude/**`.

## Known Context / Non-Issues (do not re-flag as new findings)
- The absence of a worker self-report is expected for this task (see banner above) — do not fail the task or flag it as a process violation. It is a known, explained gap, not something to escalate.
- `react-refresh/only-export-components` lint warnings in `guards.tsx` are expected and non-blocking (see step 6).
- The kiosk-public-route and `/settings`-admin-only assumptions are explicitly self-flagged in the code comments as provisional; treat them as MINOR/NIT follow-up notes (not blockers) unless your own PRD reading finds them to actively contradict a requirement ID.

## Most Recent Failure
None — this is T005's first check attempt.

## Required Checker Output (per constitution Evidence Requirements)
- files inspected
- exact commands run + real quoted output (not summarized/paraphrased)
- your own throwaway test's code and output (before you delete it)
- pass/fail per verification step above
- overall pass/fail result
- exact failure reason(s), if any, with severity classification (BLOCKER/MAJOR/MINOR/NIT per constitution's Failure Severity table)
- recommended next action

Do not mark this task complete based on any worker narration — none exists for T005. Inspect the actual files and generate your own evidence via independent testing and command runs.
