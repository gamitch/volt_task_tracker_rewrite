# Worker Packet: T108

## Task ID
T108 — CRITICAL BOOTSTRAP FIX: route `/settings/season` so an admin can actually
create and activate the first season.

## Objective
George live-tested the app and found it unusable: Reports, Outreach, and Meetings
all correctly show "No active season yet — an admin needs to create and activate a
season in Season settings," but **Season settings is unreachable** — the fully
built, already-Passed `SeasonSettings.tsx` (T029 UI, T091 real data wiring) was
never given a route in `router.tsx`. `AdminToggles.tsx` even links to
`/settings/season` already. Add the route.

## Allowed Files
- `src/app/router.tsx`
- `src/app/router.test.tsx` (if it exists; check — update route-table tests if
  present)

## Forbidden Files
- `src/pages/settings/SeasonSettings.tsx` — already correct, read-only import.
- `src/app/guards.tsx` — read-only import (`RequireAuth`/`RequireRole`).
- Every other file. `docs/swarm/**`, `.claude/**`.

## Known Context / Traps

**1. Read `router.tsx`'s existing conventions first.** Every route uses
`React.lazy` + a `<RequireAuth>` wrapper; `SettingsPage` needed a
`.then((m) => ({ default: m.SettingsPage }))` adapter because it has no default
export — check whether `SeasonSettings.tsx` has a default export or named-only,
and mirror the adapter pattern if needed.

**2. Role gating — investigate, don't guess.** `SeasonSettings` is an admin
surface (SET-02: only admins manage seasons). Check how other admin-only routes in
this router handle gating: the module doc at the top of `router.tsx` mentions
T074 removed `RequireRole(['admin'])` from `/settings` with documented reasoning —
read that reasoning and decide whether `/settings/season` should use
`RequireRole(['admin'])` or follow the same posture `/settings` landed on. Match
the router's established, documented convention; document your decision either
way. Also read `SeasonSettings.tsx`'s own module doc for any statement about its
own expected gating.

**3. Route path.** `AdminToggles.tsx` already links to `/settings/season` — use
exactly that path so the existing link starts working.

**4. Tests.** If a router test file exists, add the new route to it following its
existing per-route test pattern. If none exists, note that and move on — do not
create a new test file (out of scope).

## Acceptance Criteria
- `/settings/season` renders `SeasonSettings` for an authorized user, following
  the router's established lazy/guard conventions.
- `AdminToggles`'s existing `/settings/season` link now resolves.
- `npm run typecheck`, `npm run lint`, `npm run test`, `npm run build`, `npm run
  format:check` all clean, zero regressions.

## Relevant Constitution Excerpts
> No worker may mark its own work complete; every PASS requires independent
> checker-inspected evidence.

## Most Recent Failure
None. Attempt 1 (attempt count: 0). HIGH PRIORITY — this is the root blocker
making the whole app unusable for George right now.

## Required Worker Output
- Full diff.
- Your role-gating decision (Trap #2) with the router-convention evidence.
- Full test/typecheck/lint/build/format:check output.
- Known risks; dispute flag if needed.
