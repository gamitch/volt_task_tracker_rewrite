# Worker Packet: T098

## Task ID
T098 — Fix `ReportsShell.test.tsx` regression from T095's real Reports-tab data wiring.
Same class as T088/T092/T097, applied to `ReportsShell.test.tsx` for the first time
(no existing mock blocks in this file yet — use `RosterShell.test.tsx`'s established
pattern as your cross-file template, not an in-file one).

## Objective
T095 changed `ParticipationTab.tsx`/`HoursTab.tsx`/`EventsTab.tsx`'s default `loadData`
from fixture stubs to real Supabase queries. Three tests in `ReportsShell.test.tsx`
(owned by the already-Passed T091) now fail:
- `renders the real ParticipationTab (already-wired T056 precedent) on the default tab`
- `renders the real HoursTab when the Hours tab is selected`
- `renders the real EventsTab when the Events tab is selected`

**Do not change `ReportsShell.tsx` itself.**

## Allowed Files
- `src/pages/reports/ReportsShell.test.tsx`

## Forbidden Files
- `src/pages/reports/ReportsShell.tsx`, `ParticipationTab.tsx`, `HoursTab.tsx`,
  `EventsTab.tsx`, `src/lib/supabase/loaders/reports.ts` — all correct, read-only.
- Every other file. `docs/swarm/**`, `.claude/**`.

## Known Context / Traps

**1. Read `src/pages/roster/RosterShell.test.tsx`'s existing `vi.mock` blocks in full
first** (it now has three: `loaders/invites`, `loaders/students`, `loaders/teams`/
`loaders/parents` — all added by prior follow-up tasks T088/T092/T097). Replicate the
exact same pattern in `ReportsShell.test.tsx`, but this file has none yet, so you're
adding the pattern fresh, not extending an existing block.

**2. Add three `vi.mock` blocks**, one each for `'../../lib/supabase/loaders/reports'`'s
three exports: `loadParticipationData`, `loadHoursData`, `loadEventSessionsData`. Since
all three live in the same module file, decide whether one `vi.mock` block mocking all
three functions (re-exporting nothing else via `importOriginal` since there's nothing
else to preserve) is cleaner than three separate blocks — either is fine, pick one and
be consistent.

**3. Fixture data.** Read each failing test's exact assertion to know what fixture
content each mock needs to produce (e.g. a specific name/value the test's
`toContain(...)` checks for) — read `ParticipationTab.tsx`/`HoursTab.tsx`/
`EventsTab.tsx` for their own real row-type shapes to build well-formed local fixtures.

**4. Wire into the shared `beforeEach`** if one already exists in this file (check —
`RosterShell.test.tsx` has one; confirm whether `ReportsShell.test.tsx` follows the same
structure before assuming it does).

**5. Preserve every original assertion exactly** — don't loosen any of the three.

## Acceptance Criteria
- All three previously-failing tests pass again, still proving real tab content renders
  inside `ReportsShell`, now via explicit mocks.
- No change to `ReportsShell.tsx` or any of the three tab files or the loaders file.
- `npm run typecheck`, `npm run lint`, `npm run test`, `npm run build`, `npm run
  format:check` all clean.

## Relevant Constitution Excerpts
> No worker may mark its own work complete; every PASS requires independent
> checker-inspected evidence.

## Most Recent Failure
This IS the fix for a failure disclosed by T095's own worker output — attempt 1 for
T098 (attempt count: 0).

## Required Worker Output
- Full diff of `ReportsShell.test.tsx`.
- Confirmation all three named tests pass, with actual output.
- Full test/typecheck/lint/build/format:check output.
- Known risks; whether a dispute is needed (you flag, you don't resolve).
