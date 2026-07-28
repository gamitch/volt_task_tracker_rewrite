# Worker Packet: T075

## Task ID
T075 — Build and wire the `/` dashboard role dispatcher, Epic E3. Final task of the router-wiring
series' route-swap phase (T073b, real Supabase auth wiring, is separate and comes after).

## Objective
`/` is the only route left in `src/app/router.tsx` still rendering an inline placeholder
(`DashboardPage()` → `<div>Dashboard (placeholder)</div>`). Unlike every route T074 already wired,
there is no single existing component for this route — the PRD (`docs/swarm/VOLT_Portal_PRD.md`,
route table line ~365: `| / | all | Analytics Dashboard (coach) / custom stacks | ... | HOME-01…04
|`) and Section 6.2 (HOME-01 through HOME-04) specify three genuinely different dashboards by role:
- **HOME-01 Coach/Admin Home** → `src/pages/home/CoachHome.tsx`'s `CoachHome` component.
- **HOME-02 Student Home** → `src/pages/home/StudentHome.tsx`'s `StudentHome` component.
- **HOME-03 Parent Home** → `src/pages/home/ParentHome.tsx`'s `ParentHome` component.
- **HOME-04** ("Admin Home = Coach Home + a Season setup shortcut card") is already handled
  entirely INSIDE `CoachHome.tsx` itself (confirmed by reading the file — it already branches on
  `user.role === 'admin'` internally to show/hide the "Season setup" card). The dispatcher does NOT
  need separate admin-specific logic — `admin` and `coach` both route to the same `CoachHome`
  component.

This task builds a small new dispatcher component (`DashboardPage`) that reads the signed-in user's
role (via `useAuth()`, now correctly typed as of T073a — Passed) and renders the matching Home
component. All three Home components already take zero required props (every prop is optional with
a fixture default, confirmed by reading each file's own `= {}` default) — the dispatcher's ONLY job
is role-based component selection, no prop plumbing.

## Allowed Files
- `src/pages/home/DashboardPage.tsx` (new file)
- `src/pages/home/DashboardPage.test.tsx` (new file)
- `src/app/router.tsx` (wire the new component into the `/` route, same mechanical pattern as every
  route T074 already wired)

## Forbidden Files
- `src/pages/home/CoachHome.tsx`, `StudentHome.tsx`, `ParentHome.tsx`, `StudentHomeSlot.tsx` — read-
  only reference, already built and Passed. Do not touch or reinterpret.
- `src/app/guards.tsx` — already correct (T073a, Passed). Do not touch.
- `src/app/AppShell.tsx`.
- Every other route in `router.tsx` besides `/` — do not touch `/login`, `/accept-invite`,
  `/meetings`, `/meetings/live/:sessionId`, `/kiosk/:sessionId`, `/checkin`, `/outreach`,
  `/outreach/:eventId`, `/calendar`, `/roster`, `/reports`, `/settings` (all already correctly
  wired by T074 — Passed).
- `docs/swarm/**`, `.claude/**`.

## Known Context / Traps

**1. This route sits inside `RequireAuth` only (matches the current placeholder's wrapper exactly —
do not add a `RequireRole`).** Every one of the four real roles (`admin`, `coach`, `student`,
`parent`) gets a valid dashboard — there is no "wrong role" case to exclude, unlike `/roster` or
`/kiosk`. `DashboardPage` itself should not import or use `RequireRole` at all.

**2. `user` is guaranteed non-null by `RequireAuth` by the time this component renders, but
TypeScript's `AuthContextValue.user` type is still `AuthUser | null` — handle this the same
defensive-in-depth way `LiveConsole.tsx` does for its own post-gate content** (grep that file for
`user !== null` around its main content section for the exact style precedent): read `user` from
`useAuth()`, and if it's somehow `null` (should be unreachable in practice, but the type doesn't
guarantee it), return `null` (matching `RequireAuth`'s own `isLoading`-returns-`null` convention)
rather than crashing or rendering a broken UI.

**3. Role dispatch must be a genuinely exhaustive switch/if-chain, not a fallback-to-default
guess.** `Role` is now a closed union of exactly 4 values (`'admin' | 'coach' | 'student' |
'parent'`, fixed by T073a — Passed). Write the dispatch so that adding a 5th role to that union in
the future would cause a TypeScript compile error here (e.g. a `switch` with an
`const _exhaustive: never = user.role` default case, or equivalent) — this is a real safety net,
not decoration, since a silently-wrong fallback (e.g. defaulting an unrecognized role to
`CoachHome`) would be a genuine, hard-to-notice bug.

**4. Component naming**: name the new component's function `DashboardPage` (matching the removed
placeholder's name and `router.tsx`'s existing `routePaths.dashboard` naming) — a named export, not
default, matching the convention every other page component in this codebase uses (confirmed: zero
default exports among the components T074 wired, except `LiveConsole.tsx`'s `LiveConsolePage`,
which is a documented exception, not the norm).

**5. No index barrel exists in `src/pages/home/`** (confirmed — only `CoachHome.tsx`,
`ParentHome.tsx`, `StudentHome.tsx`, `StudentHomeSlot.tsx`, no `index.ts`). Import each Home
component directly by file path from your new `DashboardPage.tsx`, and import `DashboardPage`
directly by file path from `router.tsx` (`../pages/home/DashboardPage`) — do not create a barrel
file, that's out of this task's narrow scope.

**6. Do not touch any Home component's internals.** If you notice something that looks like it
could be improved in `CoachHome.tsx`/`StudentHome.tsx`/`ParentHome.tsx` while reading them for this
task, do not fix it — flag it as a follow-up in your output instead. This task is purely a
dispatcher.

## Acceptance Criteria
1. `npm run typecheck`, `npm run lint`, `npm run build`, `npm run format:check`, `npm run test` all
   exit 0.
2. `DashboardPage` renders `CoachHome` for `coach` and `admin`, `StudentHome` for `student`,
   `ParentHome` for `parent` — verified by real unit tests (render the component with each of the 4
   roles via a test-injected `AuthProvider`/`useAuth()` seam, following the same test pattern
   already established by other role-aware components' own test files, e.g. `MeetingsList.test.tsx`
   or `LiveConsole.test.tsx` — confirm which pattern they use and reuse it, don't invent a new one).
3. The exhaustiveness guard (Trap #3) is present and would genuinely fail to compile if `Role`
   gained a 5th member — demonstrate this isn't just decorative (e.g. describe what error TypeScript
   would produce, or temporarily add a fake 5th role locally to confirm the compile error appears,
   then revert — your choice of how to prove it, but prove it, don't just assert it).
4. `/` in `router.tsx` resolves to the real `DashboardPage`; the old inline placeholder function is
   removed.
5. **Live verification required.** Using Playwright (pre-installed Chromium at `/opt/pw-browsers`),
   run `npm run dev` and verify, for each of the 4 roles: deep-link to `/` while unauthenticated
   (confirm redirect to `/login` — guard unregressed), then sign in and confirm the correct Home
   component renders (a distinguishing piece of real content per role — e.g. CoachHome's KPI cards,
   StudentHome's mobile hero card, ParentHome's per-linked-student cards). Since the current
   placeholder-auth `LoginPage`/`AcceptInvitePage` sign-in flow only produces a `'coach'`-role user
   (per T073a's `PLACEHOLDER_SIGN_IN_ROLE`), you will need to use `useAuth()`'s `login()` function
   directly (e.g. via a small temporary test harness or by exercising it through your own test
   suite's injection seam) to produce `student`/`parent`/`admin` sessions for the other 3 checks —
   do NOT modify `LoginPage.tsx`/`AcceptInvitePage.tsx`/`guards.tsx` to do this (all forbidden).
   Produce concrete evidence (script/output/screenshots) for all 4 role checks.
6. Every other route in `router.tsx` — all 11 wired by T074, plus `/login` — byte-identical to
   before. Diff the full file and confirm only the `/` route's region changed.
7. `CoachHome.tsx`/`StudentHome.tsx`/`ParentHome.tsx`/`StudentHomeSlot.tsx`/`guards.tsx` confirmed
   untouched (diff/checksum, not eyeballed).

## Relevant Constitution Excerpts
> HOME-04: Admin Home = Coach Home + a "Season setup" shortcut card when the active season is
> missing goals or teams. (Already implemented inside `CoachHome.tsx` — not this task's job to
> rebuild.)

> Non-Negotiables: "No worker may mark its own work complete." / "Every checker must inspect the
> actual artifact, not just the worker's summary." Your output below is evidence for the checker,
> not a self-certification.

## Most Recent Failure
None. This is attempt 1 for T075 (attempt count: 0) — first dispatch.

## Context Note
This is the final route-swap task in the router-wiring series. Once T075 Passes, all 13 routes in
`router.tsx` resolve to real components. The one remaining task in the series, T073b (real Supabase
`AuthProvider` wiring — not yet created, a separate and larger task per boss-architect consultation),
is independent of this task and does not block or get blocked by it.

## Required Worker Output
- Full diff/new-file listing: `DashboardPage.tsx`, `DashboardPage.test.tsx`, and the `router.tsx`
  diff.
- Your test pattern choice (which existing test file's role-injection approach you reused) and why.
- Proof the exhaustiveness guard genuinely works (Trap #3 / Acceptance Criteria #3).
- Playwright script(s)/output/screenshots for all 4 role checks (Acceptance Criteria #5).
- Full test/typecheck/lint/build/format:check output.
- Confirmation all forbidden files are untouched (diff/checksum).
- Known risks; whether a dispute is needed (you flag, you don't resolve).
