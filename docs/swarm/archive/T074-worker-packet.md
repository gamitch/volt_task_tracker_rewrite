# Worker Packet: T074

## Task ID
T074 — Wire 11 already-built, already-Passed page components into `router.tsx`'s remaining
placeholder routes, Epic E3.

## Objective
`src/app/router.tsx` only has `/login` wired to a real component (T016a). Every other route
renders an inline placeholder `<div>`. This task wires **11 of the remaining 12 routes** — every
one that is a mechanical import swap (real component exists, needs no new dispatcher code). The
12th route, `/` (the dashboard), genuinely needs a small new role-dispatch component and is
**explicitly out of scope for this task** — it will be a separate task (T075) once this one is
Passed.

This task follows the exact precedent set by `docs/swarm/archive/T016a-worker-packet.md` (the
`/login` wiring task) for each individual route: remove the inline placeholder, import the real
component, keep the `<Route>` registration's guard nesting exactly as specified per route below,
clean up now-unused imports, live-Playwright-verify a representative sample (not all 11 — see
Acceptance Criteria).

This packet was scoped by directly reading every target component's actual export, props, and
internal role-gating (not guessed) — the per-route table below is ground truth, verified against
the real source files and cross-checked against the PRD's actual Section 7 route-role table
(`docs/swarm/VOLT_Portal_PRD.md`, table at ~line 360-374).

## Allowed Files
- `src/app/router.tsx` — only this file.

## Forbidden Files
- Every page component file this task imports from — read-only reference, already built and
  Passed. Do not touch or reinterpret anything in `src/pages/**`.
- `src/app/guards.tsx` — already correct as of T073a (Passed). Do not touch.
- `src/app/AppShell.tsx`.
- `docs/swarm/**`, `.claude/**`.
- Everything else not listed under Allowed Files.

## Per-route wiring table (verified against real source — follow exactly)

| Route | Import | Current guard wrapper (keep exactly) | Notes |
|---|---|---|---|
| `/accept-invite` | `import { AcceptInvitePage } from '../pages/accept-invite';` (barrel — confirmed exists, module doc literally states this expected import) | none (public route) | Straightforward swap. |
| `/meetings` | `import { MeetingsList } from '../pages/meetings/MeetingsList';` | `RequireAuth` only | `MeetingsList` self-dispatches coach-vs-everyone-else internally by reading `useAuth().user.role` — its own module doc confirms it deliberately never imports `RequireRole`. Do not add one. |
| `/meetings/live/:sessionId` | `import LiveConsolePage from '../pages/meetings/LiveConsole';` (**default export**, confirmed — `export default LiveConsolePage;`) | `RequireAuth` only | `LiveConsolePage` already wraps itself internally in `RequireRole(['coach','admin'])` (confirmed by reading the file — its own module doc explains this is deliberate so it isn't fighting an external `RequireRole`'s redirect). Do NOT add an external `RequireRole` here — that would double-gate. Pass `sessionId` via the route param exactly as the current placeholder does (`useParams` inside the real component handles this itself — no prop wiring needed from `router.tsx`). |
| `/kiosk/:sessionId` | `import { KioskPage } from '../pages/meetings/Kiosk';` (**named export**, confirmed — file exports `KioskPage`, not `Kiosk`) | `RequireAuth` + `RequireRole(['coach','admin'])` (keep exactly as current) | Unlike `LiveConsolePage`, `KioskPage` does NOT self-gate (confirmed — its own module doc explicitly says it relies on the router's external `RequireAuth`+`RequireRole` wrap). Keep the existing double-wrapper exactly as-is. |
| `/checkin` | `import { CheckinResult } from '../pages/checkin/CheckinResult';` | `RequireAuth` only | `CheckinResult` reads its own credential via `useSearchParams()` internally — no props needed. PRD's route table lists this route as `student`-only, but `CheckinResult.tsx` does not self-gate by role and router.tsx's current placeholder only wraps it in `RequireAuth`. **Read `CheckinResult.tsx`'s own module doc first** to check whether this is a disclosed, deliberate choice (e.g. a coach/parent might legitimately need to view this screen too in some flow) before deciding whether to add `RequireRole(['student'])`. If the module doc doesn't address it, leave the wrapper as plain `RequireAuth` (matching the component's own undocumented-but-consistent scope) and name this as a known risk in your output rather than inventing new role-gating logic the component itself was never built to expect. |
| `/outreach` | `import { OutreachList } from '../pages/outreach/OutreachList';` | `RequireAuth` only | Self-dispatches internally by role, same pattern as `MeetingsList` — do not add `RequireRole`. |
| `/outreach/:eventId` | `import { OutreachDetail } from '../pages/outreach/OutreachDetail';` (**named export**, confirmed) | `RequireAuth` only | Reads `eventId` via its own internal `useParams<{ eventId: string }>()` with an optional prop override for tests — no prop wiring needed from `router.tsx`. |
| `/calendar` | `import { CalendarPage } from '../pages/calendar/CalendarPage';` | `RequireAuth` only | **Name collision**: `router.tsx` currently defines its own local placeholder function also named `CalendarPage`. Remove the local placeholder entirely before adding this import (same class of fix T016a did for `LoginPage`). |
| `/roster` | `import { RosterShell } from '../pages/roster/RosterShell';` | `RequireAuth` only | `RosterShell` self-gates internally to `coach`/`admin` via its own nested `RequireRole` (confirmed by reading the file) — matches PRD's `coach/admin`-only designation for this route without needing an external wrapper. Do not add an external `RequireRole` (would double-gate). Takes zero props. |
| `/reports` | `import { ReportsShell } from '../pages/reports/ReportsShell';` | `RequireAuth` only | Same self-gating pattern as `RosterShell` — confirmed via its own nested `RequireRole(['coach','admin'])`. Do not add an external wrapper. |
| `/settings` | `import { SettingsPage } from '../pages/settings/SettingsPage';` | **`RequireAuth` only — CHANGE FROM CURRENT** | **Real bug fix, not just a swap.** Router.tsx's current placeholder wraps `/settings` in `RequireAuth` + `RequireRole(['admin'])`. This is WRONG: the PRD's own Section 7 route table (line ~375) lists `/settings` as role `all`, and the real `SettingsPage.tsx` has zero `RequireRole` usage anywhere in the file (confirmed by direct grep) — it's built to serve every role differently within the page (per-role Notification sections, etc.), not to be admin-gated at the route level. **Remove the `RequireRole` wrapper entirely for this route**, leaving just `RequireAuth`, matching `/roster`'s plain pattern. Also has a **name collision**: `router.tsx`'s current local placeholder function is also named `SettingsPage` — remove it before adding the import. |

**`/` (dashboard) is explicitly NOT in this task.** Leave its placeholder exactly as-is — it needs a
new dispatcher component, which is T075's job, not this one.

## Known Context / Traps

**1. Two name collisions** (`CalendarPage`, `SettingsPage`) — `router.tsx` currently defines its
own local placeholder functions with these exact names. You must remove both local placeholders
before importing the real components, or you'll get a duplicate-declaration error. This is the
same class of fix T016a did for `LoginPage`.

**2. Two different self-gating patterns exist in this codebase — do not conflate them.** Some
components (`LiveConsolePage`, `RosterShell`, `ReportsShell`) already wrap themselves internally in
`RequireRole` and expect to be mounted with only `RequireAuth` at the router level. Others
(`KioskPage`) deliberately do NOT self-gate and expect the router to provide the full
`RequireAuth`+`RequireRole` wrap externally. The per-route table above tells you which is which for
every route in this task — verify it yourself by reading each component's own module doc/imports
before wiring, don't assume a uniform pattern.

**3. No index barrels for most of these page directories.** Only `accept-invite/` has one
(`index.ts`) among this task's targets — import everything else by direct file path exactly as
shown in the table above.

**4. Clean up now-unused imports in `router.tsx`** after removing 11 placeholder functions —
`useParams` is still needed if any remaining placeholder or route still uses it (verify, don't
assume), but most of the placeholder-only imports (`ReactNode` usage inside removed placeholder
bodies, etc.) should be checked file-wide before you finish, exactly as T016a's packet instructed.

**5. Update the module doc comment at the top of `router.tsx`** if it references any of these 11
placeholders in a way that's now inaccurate (e.g., the route protection matrix notes at the top of
the file) — keep this minimal and factual, matching T016a's precedent, not a rewrite.

**6. Do not touch `/` or `/login`.** `/login` is already correctly wired (T016a); `/` stays a
placeholder for T075.

## Acceptance Criteria
1. `npm run typecheck`, `npm run lint`, `npm run build`, `npm run format:check`, `npm run test` all
   exit 0.
2. All 11 routes listed above resolve to their real imported components; `router.tsx` no longer
   defines any of the 11 corresponding placeholder functions.
3. The `/settings` role-guard bug fix is present (no `RequireRole` wrapper on that route anymore).
4. No unused imports left behind — confirm by reading the final file, not just trusting the linter.
5. **Live verification required, spot-check not exhaustive** (per boss-architect guidance: eleven
   identical live-Playwright passes for mechanically-identical swaps is wasted effort). Using
   Playwright (pre-installed Chromium at `/opt/pw-browsers`), run `npm run dev` and verify these 5
   representative routes cover every distinct pattern in this task:
   - `/accept-invite` (public, no guard) — confirm the real component renders, not the old
     placeholder text.
   - `/meetings` (self-dispatching, all roles) — sign in as a placeholder user, confirm real
     `MeetingsList` content renders.
   - `/kiosk/:sessionId` (double-external-gate) — confirm unauthenticated access still redirects to
     `/login` (guard unregressed), and confirm the real `KioskPage` renders for an authenticated
     coach/admin placeholder user.
   - `/outreach/:eventId` (param-based, self-contained) — confirm the real `OutreachDetail`
     component renders and reads the `:eventId` param correctly (not blank/erroring).
   - `/settings` (the bug-fix route) — confirm a NON-admin authenticated placeholder user (e.g. the
     `'coach'` placeholder role from T073a) can now reach it (proving the incorrect
     `RequireRole(['admin'])` is genuinely gone), and confirm the real `SettingsPage` renders.
   Produce concrete Playwright script/output evidence for all 5, not just a claim.
6. Every other route/behavior in `router.tsx` not touched by this task — `/`, `/login` — byte-
   identical to before. Diff the full file and confirm only the 11 targeted routes' regions changed
   (removed placeholders, new imports, changed route elements, the `/settings` guard fix, and
   necessarily-related import cleanup).
7. Every page component file imported from confirmed untouched (diff/checksum, not eyeballed).

## Relevant Constitution Excerpts
> Non-Negotiables: "No worker may mark its own work complete." / "Every checker must inspect the
> actual artifact, not just the worker's summary." Your output below is evidence for the checker,
> not a self-certification.

## Most Recent Failure
None. This is attempt 1 for T074 (attempt count: 0) — first dispatch.

## Context Note
This task's scope was independently verified against real source (not the original router-wiring
series proposal, which assumed `/meetings/live/:sessionId` needed a role dispatcher — it does not;
`LiveConsolePage` already self-gates and `StudentMeetingView.tsx` turned out to be a reusable widget,
not a page route, per its own module doc). Only `/` genuinely needs a dispatcher, which is T075,
not this task.

## Required Worker Output
- Files changed (must be exactly `src/app/router.tsx`, or fewer): full diff.
- `npm run typecheck` / `npm run lint` / `npm run build` / `npm run format:check` / `npm run test`
  output (exit codes).
- Playwright script(s) and their actual output/logs for all 5 representative-route checks listed in
  Acceptance Criteria #5.
- Full diff of `router.tsx`, annotated to show every changed region maps to one of the 11 routes'
  entry in the table above — nothing extraneous.
- Confirmation every imported page component file is untouched (diff/checksum).
- Known risks — in particular your finding/decision on `/checkin`'s role-gating question (Trap
  under the `/checkin` row above).
- Whether a dispute is needed (should not be — this is a fully-prescribed mechanical task with one
  disclosed bug fix — but flag it if something unexpected turns up rather than improvising a fix to
  a forbidden file yourself).
