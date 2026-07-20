# Worker Packet: T097

## Task ID
T097 — Fix `RosterShell.test.tsx` regression from T094's real Teams/Parents data
wiring. Small immediate follow-up, exact same class as T088/T092.

## Objective
T094 (its own scope correct and complete, pending its own checker) changed
`TeamsTab.tsx`/`ParentsTab.tsx`'s default `loadData` from fixture stubs to real
Supabase queries. Two tests in `RosterShell.test.tsx` (owned by the already-Passed
T085, previously extended twice already by T088 for Invites and T092 for Students) now
fail:
- `renders the real ParentsTab when the Parents tab is selected` — expected
  `'Renata Alvarez'`, got the real (unconfigured-in-tests) error state instead.
- `renders the real TeamsTab when the Teams tab is selected` — expected `'Embercore'`.

Same fix, third time: add two more `vi.mock` blocks mirroring the two already in the
file (for `loaders/invites` and `loaders/students`), one for `loaders/teams` and one for
`loaders/parents`.

**Do not change `RosterShell.tsx` itself** — zero-props-per-tab rendering is correct and
must not change.

## Allowed Files
- `src/pages/roster/RosterShell.test.tsx`

## Forbidden Files
- `src/pages/roster/RosterShell.tsx`, `TeamsTab.tsx`, `ParentsTab.tsx`,
  `src/lib/supabase/loaders/teams.ts`, `src/lib/supabase/loaders/parents.ts` — all
  correct, read-only.
- Every other file. `docs/swarm/**`, `.claude/**`.

## Known Context / Traps

**1. The two failing tests** are named above — read them directly to confirm current
exact wording before editing.

**2. Add two more `vi.mock` blocks, siblings to the two already in the file.** Mock
`'../../lib/supabase/loaders/teams'` (specifically `loadTeamsTabData`) and
`'../../lib/supabase/loaders/parents'` (specifically `loadParentsTabData`), each
re-exporting every other function via `importOriginal` exactly like the existing
`loaders/invites`/`loaders/students` mocks do. Add small local fixtures containing a
team row with `name: 'Embercore'` and a parent-profile row with `displayName: 'Renata
Alvarez'` — read `TeamsTab.tsx`/`ParentsTab.tsx` for their exact local row-type shapes
(both use locally-declared types, not the shared `types.ts` ones — confirmed by T094;
match whichever local shape each file actually expects).

**3. Wire both new mocks into the shared `beforeEach`**, alongside the two already
there, same reasoning as before (other tests in the file may visit these tabs too).

**4. Preserve both exact assertions** — don't loosen them.

## Acceptance Criteria
- Both previously-failing tests pass again, still proving the same thing (real
  `TeamsTab`/`ParentsTab` content renders inside `RosterShell`), now via explicit mocks.
- No change to `RosterShell.tsx`, `TeamsTab.tsx`, `ParentsTab.tsx`, or either loaders
  file.
- `npm run typecheck`, `npm run lint`, `npm run test`, `npm run build`, `npm run
  format:check` all clean, full repo-wide suite green once T094/T095/T096 have all
  landed (this task alone should at minimum make `RosterShell.test.tsx` itself fully
  green).

## Relevant Constitution Excerpts
> No worker may mark its own work complete; every PASS requires independent
> checker-inspected evidence.

## Most Recent Failure
This IS the fix for a failure disclosed by T094's own worker output — attempt 1 for
T097 (attempt count: 0).

## Required Worker Output
- Full diff of `RosterShell.test.tsx`.
- Confirmation both named tests pass, with actual output.
- Full test/typecheck/lint/build/format:check output.
- Known risks; whether a dispute is needed (you flag, you don't resolve).
