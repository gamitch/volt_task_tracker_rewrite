# Worker Packet: T005

## Task ID
T005

## Objective
Build a self-contained React Router route table stub covering every route in PRD Section 7 (as placeholders), plus NAV-06 auth/role guards and the NAV-08 store-intended-URL-and-redirect-after-login mechanism (including a Google OAuth round-trip placeholder). This task does NOT wire the router into the running app — that integration happens in T006 (AppShell + TopNav).

## Allowed Files
- `src/app/router.tsx`
- `src/app/guards.tsx`
- `package.json` / `package-lock.json` (install `react-router-dom` only — already on the constitution's dependency allowlist, item 9; no additional approval needed)

Unchanged from attempt 1 — both files touched by the required rework (`router.tsx`, `guards.tsx`)
were already in scope. No `package.json`/`package-lock.json` change is expected for this rework
attempt (no new dependency needed to add `'coach'` to a union type or guard an existing route).

## Forbidden Files
- `docs/swarm/**`
- `.claude/**`
- `src/main.tsx` — do not wire the router in yet; that is T006's job.
- `src/App.tsx` — do not wire the router in yet; that is T006's job.
- `src/theme/**` — out of scope for this task.
- Anything outside the Allowed Files above.

## Acceptance Criteria
- Route table stub exists for every route in PRD Section 7, even as placeholders: `/login`, `/accept-invite`, `/`, `/meetings`, `/meetings/live/:sessionId`, `/kiosk/:sessionId`, `/checkin`, `/outreach`, `/outreach/:eventId`, `/calendar`, `/roster`, `/reports`, `/settings`.
- NAV-06 auth/role guards implemented: unauthenticated access to a protected route redirects to `/login`; wrong-role access redirects to `/` with a Toast reading "You don't have access to that page."
- NAV-08 mechanism implemented: intended URL is stored before redirecting to `/login`, and the user is returned to that URL after a successful login round-trip (including a placeholder for the Google OAuth round-trip case).
- Router table and guard logic must be self-contained, independently testable modules — no dependency on `main.tsx`/`App.tsx` wiring to be exercised/tested.
- Only `react-router-dom` may be installed; do not add any other new dependency without flagging it explicitly in your output.

## Relevant Constitution Excerpt
Item 9 (Dependency allowlist): "`@astryxdesign/*`, `@supabase/supabase-js`, `@tanstack/react-query`, `react-router-dom`, `qrcode.react`, `ical-generator` (Edge Function), plus dev tooling ... Anything else requires boss-architect approval recorded in the ledger." — `react-router-dom` is pre-approved; install it directly, no need to pause for approval.

Item 8 (Stack locks): React 19 is current — react-dom 19.2.7 is installed; no `--legacy-peer-deps` should be needed for a React 19-compatible package like `react-router-dom`. If it is needed anyway, report that explicitly rather than silently using it.

Item 1 (Precedence): PRD requirement IDs (NAV-06, NAV-08, Section 7 route list) outrank this packet's paraphrase — flag any apparent conflict in your output rather than improvising around it.

Definition of Done: no worker may mark its own work complete; the checker inspects the actual artifact, not your summary.

## Most Recent Failure
Attempt 1 FAILED (MAJOR/BLOCKER-class): `/kiosk/:sessionId` was left as a fully public, unguarded
route with a doc comment incorrectly claiming the PRD is silent on kiosk auth — PRD Section 7
assigns that route to coach/admin and SEC-04 requires no public pages. Full detail, exact PRD
quotes, and required fix: see `docs/swarm/active/T005-latest-failure.md`.

**This attempt (attempt 2) is a targeted fix only, not a redo of the task.** Everything else
about T005 was independently verified correct by the checker (all 13 routes, guard logic, NAV-08
round-trip, build/typecheck/lint, dependency hygiene) and must not be touched or reworked. Scope
for this attempt is exactly:
1. Guard `/kiosk/:sessionId` with `RequireAuth` + `RequireRole(['coach','admin'])` and fix the
   incorrect doc comment (K1).
2. Add `'coach'` to `guards.tsx`'s `Role` union so K1's fix compiles (K2, minimal — do not
   reconcile the full role vocabulary unless trivial).
Do not touch the toast-during-render pattern in `RequireRole` (K3) — explicitly deferred to T006,
out of scope here.

## Required Worker Output
- files changed (`src/app/router.tsx`, `src/app/guards.tsx`, `package.json`/`package-lock.json` diff)
- full list of routes implemented, cross-checked against the Section 7 list above
- manual walkthrough notes for each guard case: unauthenticated → `/login`; wrong-role → `/` + toast copy; deep link survives login round-trip
- confirmation `react-router-dom` was the only new dependency installed (or explicit note if peer-dep resolution forced anything else)
- confirmation `main.tsx`/`App.tsx` were not touched
- known risks
- whether a dispute is needed
