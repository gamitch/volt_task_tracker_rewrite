# Checker Packet: T028 (Roster admin toggles) — Check Attempt 1

## Task ID
T028 — Roster admin toggles (ROS-08), Epic E4.

## Checker Agent
checker-reviewer (per task-ledger.md T028 row).

## Objective
Verify an admin-only (not coach-or-admin) leaderboard privacy toggle defaulting ON (SEC-04), a
season default-goal shortcut link, and a genuine, well-reasoned disclosure of the missing
privacy-persistence column (a real schema gap, not something this UI-only task should paper over).

## Allowed Files (worker's literal permitted edit)
- `src/pages/roster/AdminToggles.tsx` (new)

**Scope flag**: worker also created `AdminToggles.test.tsx`, outside the literal Allowed Files line
— same disclosed pattern already ruled in-scope by every prior checker in this batch. Re-derive the
judgment yourself.

## Forbidden Modification Check (run first, D001 method)
Compare Allowed Files above against the actual file tree / this task's commit (`cb42eb0`) — do NOT
infer authorship from commit messages. Confirm no migration file was added/edited (the worker claims
it did not write one, despite finding a real gap). Confirm `RosterShell.tsx`, `router.tsx`,
`guards.tsx` (import-only) untouched. Note: the working tree may currently show many other
concurrently-running tasks' untracked files (`Leaderboard.tsx`, `OutreachEventDialog.tsx`,
`InviteParentDialog.tsx`, `ParentsTab.tsx`, `StudentDialog.tsx`, `TeamsTab.tsx`,
`src/pages/settings/**`) — none of those belong to T028; do not flag them.

## Worker's Claimed Changes (do not trust — verify independently)
1. **Schema-gap investigation**: claims a direct grep (`privacy|show_full_name|last_name|
   leaderboard|initial`) across all migrations returns zero column-definition hits, plus claims it
   manually enumerated every column on every table in all six migration files and confirmed none is
   privacy-shaped. Claims a dispute-candidate write-up with a best guess (`seasons.
   leaderboard_show_full_name`, reasoning: `seasons` already carries `default_goal_hours`, the one
   other roster-adjacent per-period value) and an alternative (`teams`), explicitly not decided
   unilaterally. Claims this is surfaced both in the module doc AND live in-UI via a dismissable
   warning `Banner`.
2. **No migration written** — confirmed via the forbidden-file check above; the worker claims this
   was deliberate (out of scope).
3. **Admin-only gate implementation choice**: claims it used `useAuth()` directly and returned
   `null` for non-admins, rather than nesting `guards.tsx`'s `RequireRole` — reasoning claimed: a
   full `RequireRole` would redirect the ENTIRE `/roster` page away for a `coach` (who legitimately
   reaches `/roster` per `RosterShell.tsx`'s own coach/admin gate), which would be a regression, not
   correct sub-widget-level enforcement.
4. **Season shortcut route**: claims `router.tsx`'s `routePaths` has no dedicated `season` constant,
   so it built `` `${routePaths.settings}/season` `` from the existing `routePaths.settings`
   constant, matching `LiveConsole.tsx`'s established `Link as={RouterLink}` idiom.
5. **`Card` deliberately not used**: claims `npm run astryx -- component Card`'s own Best Practices
   output advises against wrapping page sections/settings widgets in `Card` — used `Heading`+
   `VStack`/`HStack` instead.
6. Claims 11/11 new tests pass, covering SEC-04 default-ON, real toggle behavior, the three-way
   admin-only gate (unauthenticated/coach/admin), the season shortcut link, and the schema-gap
   Banner's visibility/dismissability.
7. Discloses repo-wide build/typecheck/lint flakiness observed during its run, attributed to other
   concurrent workers' in-flight files (`InvitesTab.tsx`, `TeamsTab.tsx`, `SeasonSettings.tsx` —
   none in its own Allowed Files) — claims its own two files pass cleanly in every isolated check.

## Required Verification Steps
1. **Read `AdminToggles.tsx` and `AdminToggles.test.tsx` in full** — do not rely on the worker's
   module doc or this packet's paraphrasing.
2. **Schema-gap investigation — reproduce the grep yourself.** Confirm zero privacy-shaped columns
   exist anywhere in the migrations. Independently judge whether the worker's best-guess reasoning
   (`seasons` as the more likely home, citing `default_goal_hours` as precedent) is sound, or whether
   `teams` is actually the more defensible guess — form your own view, don't just accept the
   worker's.
3. **SEC-04 default-ON — confirm by source read**, not just the test claim: the fixture/seam's
   initial state must genuinely resolve to `true` before any user interaction.
4. **Admin-only gate — the central judgment call of this check.** Re-derive independently: read
   `RosterShell.tsx` (read-only) to confirm the worker's claim that a nested `RequireRole` would
   incorrectly hide the entire page for a coach is accurate (i.e., confirm `RosterShell.tsx` really
   does allow coach access to `/roster` at large). Then judge whether using `useAuth()` directly for
   a sub-widget-level admin-only gate (bypassing `RequireRole`) is the correct, precedent-consistent
   choice, or whether it introduces any real risk (e.g., a coach momentarily seeing a flash of
   content before a gate resolves — check for this).
5. **Season shortcut route — confirm the exact route path is genuinely correct** (`/settings/season`,
   matching T029's target route) by reading `router.tsx`'s real `routePaths` object.
6. **`Card`-avoidance claim — reproduce the CLI check yourself** (`npm run astryx -- component
   Card`) and confirm the Best Practices guidance genuinely discourages this usage.
7. **Astryx prop citations** — spot-check `Switch`, `Banner`, `Link`, `Icon`, `Heading`, `Text`
   against `astryx-api.md`.
8. **Test-file scope question** — render an explicit verdict, independently re-derived.
9. **Re-run typecheck/lint/build/test yourself** (scoped to this file where the shared tree is
   flaky due to concurrent workers, exactly as the worker did) — don't accept "11/11" without your
   own run. Confirm the disclosed flakiness is genuinely caused by other in-flight tasks' files, not
   this task's own commit.
10. **No box-drawing/bracket characters, no fabricated real-looking PII** — grep sweep yourself.

## Relevant Constitution Excerpts
- Item 10: database changes are additive migrations via the Supabase CLI. *(Cited because this task
  correctly did NOT attempt its own migration to "solve" the missing column — verify this holds.)*
- Item 2: Astryx component usage must stay within the documented API surface.

## Required Checker Output
- PASS or FAIL
- severity: BLOCKER, MAJOR, MINOR, or NIT
- evidence inspected (paste actual grep/read/test output, not paraphrase)
- commands run
- exact findings
- explicit verdict on the schema-gap disclosure quality (best-guess reasoning sound?)
- explicit verdict on the admin-only gate implementation choice (bypassing `RequireRole`)
- explicit verdict on the test-file scope question
- required rework if failed
- follow-up tasks if passed with minor issues
