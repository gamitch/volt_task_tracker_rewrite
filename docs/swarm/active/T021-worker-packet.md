# Worker Packet: T021

## Task ID
T021

## Objective
Build the `/roster` shell (ROS-01): a `TabList` with four tabs — **Students | Parents | Teams |
Invites** — restricted to `coach`/`admin` roles. This is a shell task only: it establishes the tab
scaffold and role guard; the real tab *content* (tables, dialogs, row actions) is built by
T022–T028 in later tasks. This is the first real content-page task in the entire ledger — E1–E3's
patterns (T016/T018's page structure, T005/T006's guard mechanism) are your best precedent, but
this is genuinely new territory (first `TabList` usage, first non-auth page).

## Dependencies (status)
- T007 (SideNav) — Passed. `SideNav.tsx` already has a "Roster" nav item gated to the correct
  roles (read it read-only for the established role-gating convention, do not import from it).
- T019 (invite-acceptance trigger) — Passed. Confirms `profiles.role` is the real AUTH-05 role
  vocabulary (`admin | coach | student | parent`) once a user has a profile — relevant because this
  page's role guard must reason in terms of the roles PRD ROS-01 actually names (coach/admin), not
  `guards.tsx`'s stale placeholder `Role` union (see Known Context/Traps #1 below).

## Allowed Files
- `src/pages/roster/RosterShell.tsx` (new file — confirm with `Glob`, expect nothing there yet).

## Forbidden Files
- `src/app/router.tsx` — **read-only**. The current `/roster` route wraps its inline `RosterPage()`
  placeholder in `RequireAuth` only — **no role restriction at all** (confirmed by reading the file
  directly: lines 195–202). Building `RosterShell.tsx` will not by itself make `/roster` role-
  restricted or reachable as your real component; router.tsx's own guard is also weaker than
  ROS-01 requires (any authenticated user, not just coach/admin, currently reaches the placeholder).
  Do not edit `router.tsx`. See Known Context/Traps #1 for how to still satisfy this task's own
  acceptance criterion ("route guard restricts to admin/coach") entirely within your Allowed Files.
- `src/app/guards.tsx` — **read-only** (import `useAuth`, `RequireRole`, `Role` from here; do not
  edit).
- `src/components/nav/**`, `src/app/AppShell.tsx` — not this task; this page renders inside the
  existing AppShell/nav chrome, you don't need to touch or reason about them beyond knowing they
  exist.
- `supabase/**` — this task is frontend-only; no data is fetched yet (each tab's real data-loading
  lands in T022+).
- `docs/swarm/**`, `.claude/**`.

## Known Context / Traps

**1. `router.tsx` doesn't restrict `/roster` to coach/admin — how does this task's own acceptance
criterion still hold?** Since you cannot edit `router.tsx`, `RosterShell` must enforce its own role
restriction internally, the same way `router.tsx` already does for `/kiosk/:sessionId` and
`/settings` at the route level — just moved one level down into your component. `guards.tsx`
exports `RequireRole` as a plain, reusable component (it doesn't have to be used only inside a
`<Route element={...}>` — nesting it inside your own component's render tree produces the identical
guard behavior: redirect to `/` + fire the exact NAV-06 access-denied toast for anyone whose role
isn't in the allowed list). The recommended shape:
```tsx
export function RosterShell(): ReactNode {
  return (
    <RequireRole allowedRoles={['coach', 'admin']}>
      {/* TabList + tab panels here */}
    </RequireRole>
  );
}
```
This is a legitimate reuse of a documented, exported guard component from a read-only import — not
a workaround. Confirm this actually produces the ROS-01/NAV-06-required behavior (redirect + toast)
for a `student`/`parent`/other role, and document your reasoning explicitly rather than asserting
it works.

**2. `guards.tsx`'s `Role` type is `'admin' | 'staff' | 'volunteer' | 'coach'` — a stale T005
placeholder, not AUTH-05's real vocabulary (`admin | coach | student | parent`).** `'coach'` and
`'admin'` happen to overlap between the two vocabularies, so `RequireRole(['coach', 'admin'])`
reads correctly either way *for this specific task* — but do not treat this as evidence the
mismatch is resolved; state explicitly that you used the two role names that happen to exist in
both vocabularies, and that this task does not attempt to reconcile the mismatch (same posture
T018 was told to take on this exact recurring issue).

**3. `router.tsx` wiring gap (recurring pattern).** Same class of gap as T016/T018:
`RosterShell.tsx` will not be reachable at `/roster` in the running app (the placeholder there
stays as-is). Flag this explicitly. Per T018's checker's independent finding (see
`docs/swarm/verification-log.md`'s `## T018` entry / `docs/swarm/state-summary.md`'s Current
Risks): this is not a one-off gap, every not-yet-built page has the same placeholder problem.
Reference that finding rather than re-deriving it; you don't need to propose a new solution, just
confirm the pattern applies here too.

**4. No real data anywhere yet.** The four tabs' actual content (student table, parent table, team
management, invites table) are T022–T028's jobs, not yours. For this shell task, each tab panel
should render something honest about that — do not fabricate placeholder roster data that could be
mistaken for real content later. An `EmptyState` per tab (or an equivalently honest placeholder)
stating that tab's content is not yet built is preferable to silence or fake data — decide and
document your choice.

## Acceptance Criteria
1. `TabList` (ROS-01) with exactly four tabs in the specified order: Students, Parents, Teams,
   Invites. Tab switching keyboard-navigable per `astryx-api.md`'s documented `TabList`/`Tab`
   behavior (arrow keys move focus per `orientation`, confirm which orientation applies here).
2. Route restricted to `coach`/`admin` per Known Context/Traps #1 — confirmed via your own test
   that a non-coach/non-admin role redirects to `/` with the exact NAV-06 toast message
   (`ACCESS_DENIED_TOAST_MESSAGE` from `guards.tsx` — do not hardcode a different string).
3. Every Astryx component prop used is cited against `docs/swarm/astryx-api.md` directly (line
   reference) — a prop not present there is presumed hallucinated (constitution item 2, MAJOR).
4. Full keyboard path (Tab into the tab strip, arrow-key navigation between tabs, activation),
   visible focus, both light and dark mode (DES-17/NFR-07, constitution item 15 — BLOCKER if
   broken).
5. No box-drawing/bracket characters, no fabricated roster data rendered as if real, in the DOM
   (constitution item 13).
6. Both gaps (router.tsx wiring; `guards.tsx` `Role` vocabulary mismatch) explicitly flagged in
   your Required Worker Output — not silently worked around.
7. `npm run build` / `npm run typecheck` / `npm run lint` all exit 0.
8. Any temporary render-harness file used to produce evidence is deleted before handoff, and you
   say so explicitly.

## Relevant Constitution Excerpts
> 2. Astryx component props come **only** from `docs/swarm/astryx-api.md` (PRD DES-19). A prop
> absent from that file is presumed hallucinated → MAJOR.

> 12. Every async screen ships all four states — loading, empty, error, populated (PRD DES-12).
> Happy-path-only → MAJOR. (This shell task has no async data yet; document why/how this applies
> or doesn't, per each tab's honest placeholder — don't skip the reasoning.)

> 15. Accessibility per PRD DES-17 / NFR-07 is a shipping requirement; keyboard path failures on
> core flows → BLOCKER.

Non-Negotiable: "No worker may mark its own work complete." Every checker inspects the actual
artifact, not your summary.

## PRD Ground Truth (verbatim)
> **ROS-01** `/roster` with `TabList`: **Students | Parents | Teams | Invites**.

> Route table (Section 7): `/roster | coach/admin | Grouped Table | Table, PowerSearch, TabList |
> ROS-01…09`

> **NAV-06** Route guards: unauthenticated → `/login`; authenticated but role lacks route →
> redirect to `/` with `Toast` "You don't have access to that page."

## Most Recent Failure
None. This is attempt 1 for T021 (attempt count: 0).

## Required Worker Output
- File created at `src/pages/roster/RosterShell.tsx` — full contents.
- Prop-by-prop cross-check against `astryx-api.md` (line references) for every Astryx component
  used (`TabList`, `Tab`, and whatever you use for each tab's placeholder content).
- Explicit confirmation of the role-guard mechanism (Known Context/Traps #1) and a real test
  showing the redirect + exact toast message for a disallowed role.
- Explicit dispute-candidate flags for the router.tsx wiring gap and the `Role` vocabulary
  mismatch.
- Explicit statement on your DES-12 reasoning for the (currently dataless) tab panels.
- Screenshots (both modes) of all four tabs; keyboard walkthrough notes (tab-strip navigation,
  role-guard redirect).
- Confirmation any temporary render-harness file was deleted.
- `npm run build`/`typecheck`/`lint` output.
- Known risks; whether a dispute is needed.
