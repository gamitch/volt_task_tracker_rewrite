# Worker Packet: T106

## Task ID
T106 — HOTFIX: `OutreachList.tsx` throws a real Postgrest error on every real
render because it never resolves a real active season id.

## Objective
This is a live regression, confirmed by George while testing `/outreach` in the
dev server: the page shows "Couldn't load outreach events." `OutreachList.tsx`
(`src/pages/outreach/OutreachList.tsx`) defaults its `seasonId` prop to a hardcoded
placeholder string, `PLACEHOLDER_SEASON_ID = 'season-placeholder-current'`. This
was harmless while `loadData` defaulted to fixture data (T038-era), but T101
(already-Passed, already committed) swapped the real default in
(`loadData = loadOutreachData`), which passes `seasonId` straight into a real
Postgrest `.eq('season_id', seasonId)` query against a `uuid`-typed column —
`'season-placeholder-current'` is not a valid UUID, so Postgres rejects the query
outright before any RLS/filtering logic even runs, and the page's existing error
boundary correctly (if unhelpfully) surfaces this as "Couldn't load outreach
events." T101's own worker packet explicitly scoped `seasonId` resolution as
out-of-scope and disclosed it as a known risk, but its written assumption ("a
caller passing a real season id gets real filtering, otherwise the real loader
legitimately returns empty data rather than fabricating anything") turns out to be
factually wrong once verified against real behavior — it's a hard error, not an
empty-data degrade. Fix that gap now: resolve a real active season id before ever
calling the real loader, using the exact established pattern
`ReportsShell.tsx` (T095/T098, already-Passed) already uses for this same class of
problem.

## Allowed Files
- `src/pages/outreach/OutreachList.tsx`, `OutreachList.test.tsx`

## Forbidden Files
- `src/app/SeasonProvider.tsx` — already correct (T091), read-only import
  (`useActiveSeason`).
- `src/lib/supabase/loaders/outreach.ts` — already correct (T101, checker-verified
  PASS, already committed), read-only. Do not touch `loadOutreachData`'s own
  signature or query logic; this is purely a caller-side fix.
- `src/pages/outreach/OutreachDetail.tsx` — NOT affected by this bug (confirmed:
  its `PLACEHOLDER_SEASON_ID` only appears inside unused fixture-literal
  definitions, never on the real `eventId`-keyed `loadOutreachDetail` path) — do
  not touch it, out of scope for this hotfix.
- Every other file. `router.tsx`, `guards.tsx`, `docs/swarm/**`, `.claude/**`.

## Known Context / Traps

**1. Read `ReportsShell.tsx` in full first — this is the established, already-
Passed pattern to mirror, not a new design.** Its own module doc (lines ~41-105)
explains the exact shape: accept an optional `seasonId` prop (for tests/explicit
callers), call `useActiveSeason()` unconditionally (React's rules-of-hooks, even
when a prop is supplied), resolve
`resolvedSeasonId = seasonIdProp ?? (activeSeason.status === 'ready' ?
activeSeason.season.id : null)`, and render a dedicated "no season resolved yet"
state block (loading / error / no-active-season) for every case where
`resolvedSeasonId` is `null` — **never call the real loader with a null or
placeholder id**. Port this same shape into `OutreachList.tsx`: replace the
`seasonId = PLACEHOLDER_SEASON_ID` default and the unconditional
`useLoadState(() => loadData(seasonId), ...)` call with the same
prop-or-active-season resolution, gating the real `loadData` call behind
`resolvedSeasonId !== null`.

**2. `PLACEHOLDER_SEASON_ID` itself.** Once real resolution is wired in, decide
whether the constant is still needed at all (e.g. as a documented fixture-only
value for `defaultLoadOutreachData`'s own fixture data, which is unaffected by
this fix and should keep working for tests that still inject the fixture loader
explicitly) or whether it's now fully dead code — investigate, don't assume either
way, and document your finding.

**3. `viewerStudentId = PLACEHOLDER_CURRENT_STUDENT_ID` is a SEPARATE,
already-disclosed gap (different constant, different concern — resolving which
student a parent/student viewer is scoped to, not which season). Out of scope for
this hotfix — do not touch it, do not conflate it with the season-resolution fix.

**4. `reloadOutreachData()` (module doc #11, T101's own coach-create-event reload
path) also calls `loadData(seasonId)` — make sure it uses the SAME resolved
season id as the initial load, not the raw prop/placeholder, so a coach creating
an event doesn't silently break the reload path this fix is meant to close.

**5. Test files.** `OutreachList.test.tsx`'s existing tests very likely need
updating to inject a resolved `seasonId` (or wrap with a `SeasonProvider` stub /
inject `useActiveSeason`'s own established test-mocking pattern — check how
`ReportsShell.test.tsx` mocks `useActiveSeason` for the precedent) rather than
relying on the placeholder silently working. This mirrors the exact
`RosterShell.test.tsx`/`ReportsShell.test.tsx` fallout-fix pattern already used
four times this session (T088, T092, T097, T098) — read one of those for the
"sibling `vi.mock`/prop-injection" shape if useful, though this is a same-file fix
(not a sibling-shell fallout), so it may be simpler: just update `OutreachList`'s
own tests directly.

## Acceptance Criteria
- `OutreachList.tsx` resolves a real active season id via `useActiveSeason()`
  before ever calling the real `loadOutreachData`, mirroring `ReportsShell.tsx`'s
  established pattern exactly.
- The live bug is actually fixed: manually verify (describe how you verified it,
  e.g. rendering the component with a stubbed `useActiveSeason` resolving a real
  season id and confirming `loadData` is called with that id, not the placeholder)
  since a live dev-server click-through isn't available to you in this sandbox.
- `npm run typecheck`, `npm run lint`, `npm run test`, `npm run build`, `npm run
  format:check` all clean, zero regressions elsewhere.

## Relevant Constitution Excerpts
> No worker may mark its own work complete; every PASS requires independent
> checker-inspected evidence.

## Most Recent Failure
None. This is attempt 1 for T106 (attempt count: 0) — first dispatch. This is a
hotfix for a live bug George found while testing, not a new ED-1 packet — treat it
as HIGH PRIORITY.

## Required Worker Output
- Full diff of every changed file.
- Confirmation, with evidence, that `resolvedSeasonId` is genuinely a real UUID
  (or the gated null-state) at the point `loadData` is called — never the old
  placeholder string.
- Full test/typecheck/lint/build/format:check output.
- Known risks; whether a dispute is needed (you flag, you don't resolve).
