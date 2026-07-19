# Worker Packet: T085

## Task ID
T085 — Wire `RosterShell.tsx`/`ReportsShell.tsx` to their real, already-Passed tab
components (currently unreachable placeholder gap). Epic E4/E9 corrective task.

## Objective
Discovered via live manual testing against a real deployed production Supabase project
(not caught by any prior isolated-component check): `RosterShell.tsx` renders four
hardcoded placeholder `EmptyState`s instead of the real `StudentsTab`/`ParentsTab`/
`TeamsTab`/`InvitesTab` components — even though all four were independently built and
checker-Passed (T022/T025/T026/T027). Same bug in `ReportsShell.tsx`: it correctly
renders the real `ParticipationTab` (T056), but `HoursTab`/`EventsTab` are still
hardcoded placeholders with a comment claiming T057/T058 are "currently-Blocked" — they
are not; both are independently checker-Passed. The comment is simply stale. Nobody ever
went back and wired either shell up after the tab tasks landed, because each tab task's
own Allowed Files list explicitly forbade touching the shell file (by design, to keep
each tab task narrowly scoped — see `RosterShell.tsx`'s/`AdminToggles.tsx`'s own module
docs, which flag this exact gap explicitly and by name as future work).

Additionally, `AdminToggles.tsx` (T028, ROS-08: leaderboard-privacy toggle + season
default-goal shortcut, "rendered on Roster for admin only" per PRD line 340) is a
completely standalone component, never imported anywhere outside its own test file —
also part of this same wiring gap.

This is integration work only, not a new design decision: `ReportsShell.tsx`'s existing
`ParticipationTab` wiring (lines 159-161) is the established, already-passed precedent
to replicate for every other placeholder — same shell-level pattern (`activeTab ===
'<value>' && <RealComponent ... />`), same "no real Supabase `loadData` wiring, fixture
defaults are correct and already the accepted posture even for the one tab already
wired" scope boundary. Do not attempt to wire real Supabase data loaders in this task —
`ParticipationTab` in `ReportsShell` today still uses its own fixture-backed default
`loadData`, and that is the correct, already-accepted scope for this task too. Wiring
real backend data is a distinct, separate, larger gap for a future task, not this one.

## Allowed Files
- `src/pages/roster/RosterShell.tsx`
- `src/pages/reports/ReportsShell.tsx`
- New: `src/pages/roster/RosterShell.test.tsx` (does not exist yet)
- New: `src/pages/reports/ReportsShell.test.tsx` (does not exist yet)

## Forbidden Files
- `StudentsTab.tsx`, `ParentsTab.tsx`, `TeamsTab.tsx`, `InvitesTab.tsx`, `AdminToggles.tsx`,
  `HoursTab.tsx`, `EventsTab.tsx`, `ParticipationTab.tsx` — read-only imports, already-Passed,
  do not modify.
- Every other file. `docs/swarm/**`, `.claude/**`, `router.tsx` (out of scope — router-level
  wiring to these two shells is already correct and unrelated to this gap).

## Known Context / Traps

**1. Match each tab component's real prop shape exactly (do not guess/invent props) —
verified this session, current signatures:**
- `StudentsTab({ loadData? })` — no required props, renders fine with zero props passed.
- `ParentsTab(props)` — note: `ParentsTab` (the real, gated default export) not
  `ParentsTabBody` (the internal ungated split used only for that file's own tests).
- `TeamsTab({ loadData?, generateId? })` — no required props.
- `InvitesTab({ loadData?, onResend?, onRevoke? })` — no required props.
- `AdminToggles(...)` — self-gates internally via `useAuth()` directly (per its own
  module doc, deliberately bypasses `RequireRole` to avoid double-gating inside
  `RosterShell`'s own outer `RequireRole` wrap) — safe to render unconditionally; it
  renders nothing/null for a non-admin coach. Check its actual exported prop shape
  yourself before wiring (do not assume it takes zero props — read the file).
- `HoursTab({ seasonId, loadData? })` — `seasonId` is REQUIRED (unlike the roster tabs).
- `EventsTab({ seasonId, loadData? })` — `seasonId` is REQUIRED.

**2. `AdminToggles` placement in `RosterShell.tsx`.** PRD line 340 only says "rendered on
Roster for admin only" — it does not name a specific tab, and it isn't conceptually tied
to any one of Students/Parents/Teams/Invites. The natural reading is a page-level
placement, not nested inside a specific tab's panel — e.g. rendered once, above or below
the `TabList`, visible regardless of which tab is active (matching that it's genuinely a
page-wide admin settings widget, not roster-data content). Use your own judgment on exact
placement (above the TabList vs. below it, in its own `Section`, etc.) but do not nest it
inside one specific tab's conditional render — state your reasoning in your output.

**3. `ReportsShell.tsx`'s `seasonId`/`PLACEHOLDER_CURRENT_SEASON_ID` threading.** The shell
already has a `seasonId` prop (defaulting to `PLACEHOLDER_CURRENT_SEASON_ID`, imported from
`ParticipationTab.tsx`) threaded to `ParticipationTab`. Thread that exact same `seasonId`
value to both `HoursTab` and `EventsTab` too (all three tabs should share one season
selection — do not invent a second, different placeholder).

**4. Update each shell's own module-doc header comment.** Both currently contain stale
claims (`RosterShell.tsx`'s four `EmptyState` copy strings citing "T022-T028" as future
work; `ReportsShell.tsx`'s comment calling T057/T058 "currently-Blocked"). Rewrite these
to reflect the real, current wired state — do not leave stale claims that will mislead the
next reader the way this exact staleness caused this whole gap to go unnoticed.

**5. Preserve existing guard/keyboard/tab behavior exactly.** Do not touch the
`RequireRole` wrapping, the `TabList`/`Tab` keyboard navigation, or the role-gating logic
in either shell — this task is additive (swap placeholder panels for real ones), not a
rewrite of the shell scaffolding T021/T056 already built and passed.

**6. New test files.** Since neither shell has ever had its own test file, write real
tests (React Testing Library + your existing project harness patterns — see
`ParticipationTab.test.tsx` or any other already-Passed tab test for the auth-harness
pattern used project-wide) proving: (a) each tab, when clicked, renders that tab's real
content (not the old placeholder text — assert the placeholder strings are GONE); (b) a
coach does NOT see `AdminToggles`' admin-only content, an admin DOES; (c) the existing
role-gate/keyboard-nav behavior from T021/T056 is unchanged (a quick regression check, not
a full re-verification of already-Passed behavior).

## Acceptance Criteria
- `RosterShell.tsx`: all four tabs (Students/Parents/Teams/Invites) render their real,
  already-Passed components when selected — zero remaining "not built yet" placeholder
  text anywhere in the file. `AdminToggles` rendered somewhere sensible, admin-only
  content confirmed actually gated (not just present in the DOM).
- `ReportsShell.tsx`: Hours/Events tabs render their real components with the shared
  `seasonId` threaded through — zero remaining placeholder `EmptyState`s for those two
  tabs.
- Both shells' stale module-doc comments updated to reflect the real wired state.
- New `RosterShell.test.tsx`/`ReportsShell.test.tsx` covering the acceptance criteria
  above.
- `npm run typecheck`, `npm run lint`, `npm run test`, `npm run build`, `npm run
  format:check` all clean, zero regressions on the full suite.
- No `loadData`/Supabase real-backend wiring attempted — out of scope, fixture defaults
  are correct here, matching `ParticipationTab`'s already-accepted precedent.

## Relevant Constitution Excerpts
> No worker may mark its own work complete; every PASS requires independent
> checker-inspected evidence.

> Zero fabricated data/box-drawing characters (project-wide, all prior tasks).

## Most Recent Failure
None. This is attempt 1 for T085 (attempt count: 0) — first dispatch.

## Required Worker Output
- Full diff of every changed/new file.
- Confirmation (via actual `npm run test` output, not claimed) that all new tests pass
  and the full repo-wide suite is still green.
- A brief note on your `AdminToggles` placement decision and reasoning (Trap #2).
- Full typecheck/lint/build/format:check output.
- Known risks; whether a dispute is needed (you flag, you don't resolve).
