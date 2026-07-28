# Worker Packet: T095

## Task ID
T095 — ED-1 Packet P6: real Reports tabs data (Participation/Hours/Events).

## Objective
`ParticipationTab.tsx`, `HoursTab.tsx`, `EventsTab.tsx` each take `{ seasonId, loadData
}` and currently default `loadData` to obviously-fake fixture generators. Wire all three
to real Supabase queries. This is a **read-only reporting packet — no mutations
anywhere in this task**, which makes it simpler than recent ED-1 packets; do not invent
mutation seams these components don't already have.

## Allowed Files
- `src/lib/supabase/loaders/reports.ts` (new)
- `src/pages/reports/ParticipationTab.tsx`, `ParticipationTab.test.tsx`
- `src/pages/reports/HoursTab.tsx`, `HoursTab.test.tsx`
- `src/pages/reports/EventsTab.tsx`, `EventsTab.test.tsx`

## Forbidden Files
- `src/pages/reports/ReportsShell.tsx` — already correct (T091), threads `seasonId`
  from the real `useActiveSeason()` hook; do not touch it, and do not import
  `useActiveSeason`/`loadActiveSeason` into any file in this packet (all three tabs
  already receive `seasonId` as a prop — that's the correct, existing seam).
- `src/lib/supabase/types.ts`, `loader.ts`, `functions.ts`, `client.ts`, `auth.ts`,
  `index.ts` — read-only, already correct.
- Every other file. `docs/swarm/**`, `.claude/**`.

## Known Context / Traps

**1. `ParticipationTab.tsx`.** `LoadParticipationDataFn = (seasonId: string) =>
Promise<ParticipationDisplayRow[]>`. Source: `v_student_participation`
(constitution-BLOCKER: strict passthrough only, zero arithmetic — the view already
computed `participation_pct`; your loader renames columns, it does not recompute
anything, matching `VStudentParticipationRow`'s existing doc-comment discipline in
`types.ts`). Cross-reference `ParticipationMetricRow`'s exact field list already
declared in `ParticipationTab.tsx` itself against `VStudentParticipationRow` — they're
likely close to 1:1, verify column-by-column yourself before mapping.

**2. `HoursTab.tsx`.** `LoadHoursDataFn = (seasonId: string) => Promise<...>` (read the
file for the exact declared type). Source: `v_student_hours` (`VStudentHoursRow` from
`types.ts` — passthrough only, `confirmed_hours` is already computed in SQL, never
re-derive it). Read the tab's own module doc for what shape it expects the loader to
return (it may combine hours data with roster/team data for its grouped-table display —
check whether a second query, e.g. `students`, is needed to resolve names/teams, the
same way `StudentsTab`'s loader combines three tables).

**3. `EventsTab.tsx`.** `LoadEventSessionsDataFn = (seasonId: string) =>
Promise<EventSessionDisplayRow[]>`. Source: `events`/`event_sessions` — **all session
statuses** (`scheduled`, `completed`, `canceled`), not just completed ones (T058's
already-Passed design explicitly established this — re-verify by reading `EventsTab.tsx`'s
own module doc, don't assume). `events.team_ids` is `uuid[] | null` — `null` means "all
teams." A naive `.contains()` filter silently drops all-team events; if you need to
filter by team at all for this view, use PostgREST's `.or('team_ids.is.null,team_ids.cs.{...}')`
equivalent — but first confirm whether this tab even filters by team at all (it may just
show every session in the season regardless of team, in which case no team filtering
logic is needed here — check before building filtering you don't need).

**4. Season-scoping.** All three loaders take `seasonId` as an explicit function
argument (not from any hook or global) — this is correct and must stay this way; the
season value itself already flows in correctly from `ReportsShell` (T091), you are just
making each `loadData` function real against that value.

**5. Empty/absent-row handling (constitution item 3, BLOCKER if violated).** A student
with zero completed sessions in the season means their row is simply ABSENT from
`v_student_participation`'s result set (already documented in `types.ts`'s own doc
comment) — do not synthesize a zero-value row for them; the UI's own "—" rendering for
absent data is already correct and expects a genuinely missing row, not a fabricated
0%/0h one.

## Acceptance Criteria
- All three tabs' default `loadData` are real Supabase queries, `seasonId`-scoped.
- Zero re-derived metric arithmetic anywhere in `loaders/reports.ts` (grep-provable).
- `EventsTab`'s real loader includes all session statuses, matching T058's established
  design.
- `npm run typecheck`, `npm run lint`, `npm run test`, `npm run build`, `npm run
  format:check` all clean, zero regressions elsewhere.

## Relevant Constitution Excerpts
> Metric formulas live in SQL views only, never re-derived in TypeScript — BLOCKER.

> No worker may mark its own work complete; every PASS requires independent
> checker-inspected evidence.

## Most Recent Failure
None. This is attempt 1 for T095 (attempt count: 0) — first dispatch.

## Required Worker Output
- Full diff of every changed/new file.
- Column-by-column citation for every field read from each view/table.
- Confirmation of whether `HoursTab`/`EventsTab` needed a second combined query and why.
- Full test/typecheck/lint/build/format:check output.
- Known risks; whether a dispute is needed (you flag, you don't resolve).
