# Worker Packet: T057

## Task ID
T057 — Hours tab (RPT-03), Epic E9.

## Objective
Build `src/pages/reports/HoursTab.tsx`: per-student, per-team confirmed hours, planned hours
(future `going` RSVPs × session duration), goal, % to goal `ProgressBar`, team subtotals, and
season totals for people reached / adult volunteers.

## Dependencies (status)
- T056 (`/reports` shell + Participation tab) — Passed. **Read `src/pages/reports/ParticipationTab.tsx`
  and `ReportsShell.tsx` in full before writing anything.** `ReportsShell.tsx` is forbidden to you
  (see below) — it currently renders a labeled placeholder for the "Hours" tab panel and expects a
  future wiring task to swap in your real component; you are NOT responsible for that wiring, only
  for building `HoursTab.tsx` as a standalone, injectable-data component matching
  `ParticipationTab.tsx`'s established shape (`{ seasonId, loadData }` props, `LoadHoursDataFn`-style
  exported type, `PLACEHOLDER_CURRENT_SEASON_ID`-equivalent constant if you need one). Match its
  RequireRole/self-gating posture too — READ its module doc #2/#3 for why it does NOT self-gate
  (`ReportsShell.tsx` already gates the whole `/reports` page) and follow the same reasoning.
- T013 (metric views) — Passed. **`v_student_hours` is your confirmed-hours ground truth — read
  `supabase/migrations/20260717000003_metric_views.sql` lines 3-18 yourself.** Columns:
  `student_id`, `season_id`, `confirmed_hours`. This is a SUM already computed by the view
  (`hours_override` wins, else clamped check-in/check-out window, else full session duration —
  all inside the view's own SQL) — **never recompute this sum in TypeScript** (constitution item 3,
  BLOCKER if violated). No `team_id` column exists on this view — you must join/derive team
  affiliation from your own student-roster data seam (same pattern `ParticipationTab.tsx` already
  used to get `studentName`/`teamName`, which the view also doesn't carry).

## Allowed Files
- `src/pages/reports/HoursTab.tsx` (new)
- A colocated `HoursTab.test.tsx` is acceptable per established precedent — disclose it.

## Forbidden Files
- `src/pages/reports/ReportsShell.tsx`, `ParticipationTab.tsx` — read-only reference only. Do not
  wire yourself into `ReportsShell.tsx`.
- `src/pages/reports/EventsTab.tsx` — does not exist yet (a separate, parallel task, T058).
- `src/pages/outreach/OutreachList.tsx` — read-only reference only (for the planned-hours
  computation pattern — see Known Context/Traps #2).
- `src/pages/home/**` — read-only reference only (for the goal-hours helper pattern — see Known
  Context/Traps #3).
- `src/app/router.tsx`, `src/app/guards.tsx` (import-only) — read-only.
- `src/lib/supabase/**` — read-only reference only, do not import directly.
- `supabase/migrations/**` — read-only.
- `docs/swarm/**`, `.claude/**`, `src/theme/**`.

## Ground Truth — real schema (read the actual files yourself, do not guess column names)
- `v_student_hours`: `student_id`, `season_id`, `confirmed_hours` — as above.
- `events`: `adult_volunteers_count` (int, default 0), `adult_volunteer_hours` (numeric, default 0)
  — per-EVENT totals, not per-session. `event_sessions`: `people_reached` (nullable int) — per-
  SESSION. Season totals for "people reached / adult volunteers" (RPT-03) means summing these
  across all of a season's events/sessions — a plain arithmetic sum of already-real integer/numeric
  columns is fine (this is not a metric-view formula being re-derived, it's a new aggregate with no
  SQL view of its own — same class of reasoning T053's checker already accepted for a comparable
  "legitimately new, disclosed metric, not a re-derivation" case). `people_reached` being nullable
  means you must decide and disclose how a null session (no headcount recorded yet) contributes to
  the season total (treat as 0, or exclude from the sum and note "N sessions missing a headcount" —
  your call).

## Known Context / Traps

**1. Confirmed hours: `v_student_hours` only, never recomputed (BLOCKER-class).** Grep your own
file before calling this done — there should be no `sum(`/`.reduce(` over raw `attendance` rows
computing a confirmed-hours-equivalent number; every confirmed-hours figure traces back to a
`confirmedHours` field already present on your loaded data.

**2. Planned hours HAS NO SQL VIEW — compute it in TypeScript, matching the already-established,
already-checker-approved pattern in `OutreachList.tsx` (T038), not a new invention.** Read
`OutreachList.tsx`'s `sessionHours`/`computeStudentHours`/`computeGroupHours` functions (its own
module doc #3): planned = sum of `sessionHours(session)` (a session's `ends_at - starts_at`, in
hours) for every session where the student has a `going` RSVP AND the session's own status is still
`'scheduled'` (not yet `'completed'`). Reuse this exact definition and, ideally, an equivalent
computation shape — this is explicitly NOT a "re-derived metric-view formula" violation (there is no
SQL view for planned hours at all — same reasoning T057's own confirmed-hours side does NOT get to
use for its own arithmetic, since a real view exists there and must be used instead).

**3. Goal hours — reuse the established `resolveGoalHours`/`hoursVsGoalPercent` pattern, don't
invent a fourth version.** `goal_hours_override ?? seasons.default_goal_hours`, then a clamped
`(confirmedHours / goalHours) * 100` capped at 100 — this exact shape already exists,
independently checker-verified, in `StudentHome.tsx`, `ParentHome.tsx`, and `CoachHome.tsx`. Read
one of them and match it.

**4. BEH-01/BEH-02 — confirmed and planned hours are NEVER summed into one number anywhere in this
tab**, including the `ProgressBar`'s own displayed value (progress toward goal is driven by
confirmed hours only, per every prior task's established interpretation of BEH-02 — planned hours
are shown as a separate, clearly-labeled figure, never blended in). This is the same BLOCKER-class
rule T038/T053/T054/T055/T057-here have all had to respect.

**5. Team subtotals — sum each team's students' confirmed/planned/goal figures separately** (never
cross-summing confirmed of one team with planned of another), matching `OutreachList.tsx`'s
`computeGroupHours`'s "sums separately" discipline.

**6. "Grouped Table" naming trap — same resolution as T056's already-accepted precedent.** PRD 7.1
uses "Grouped Table" prose but no such Astryx component exists (confirmed by T056's checker). Build
grouping by composing the real, documented `Table` component the same way `ParticipationTab.tsx`
already did — don't search for or invent a `GroupedTable` component.

**7. Coach/admin-only route (RPT-06)** — same posture as `ParticipationTab.tsx`: `ReportsShell.tsx`
already gates the whole `/reports` page, so this component does NOT self-gate (match, don't
diverge from, the sibling tab's already-reasoned choice — this is different from T025's disclosed
divergence in the roster epic; here the shell's gating story is already established and consistent,
follow it).

**8. No shared Supabase client wired in — deliberate scope.** Same posture as `ParticipationTab.tsx`
— injectable `loadData` seam, obviously-fake fixture default.

## Acceptance Criteria
- Student/team confirmed hours sourced from `v_student_hours` only (grep-provable zero recomputation).
- Planned hours computed via the T038-established `going`+`scheduled` definition, never summed with
  confirmed hours anywhere.
- Goal/% to goal uses the established `resolveGoalHours`/`hoursVsGoalPercent` pattern.
- Team subtotals and season totals (people reached / adult volunteers) computed correctly, with the
  null-`people_reached` handling explicitly disclosed.
- Coach/admin gating posture matches `ParticipationTab.tsx` (no redundant self-gate).
- No box-drawing/bracket characters (constitution item 13).
- `npm run build`/`typecheck`/`lint`/`format:check`/`test` all exit 0.

## Relevant Constitution Excerpts
> 3. RLS/metric SQL formulas are never re-derived in TypeScript; UI reads already-computed view
> columns. → BLOCKER if violated. *(Cited for confirmed hours specifically — planned hours has no
> view and is a legitimately new computation, not a violation.)*

## Most Recent Failure
None. This is attempt 1 for T057 (attempt count: 0).

## Required Worker Output
- Full contents of `HoursTab.tsx`.
- Grep proof that confirmed-hours figures are never recomputed.
- Explicit citation of the planned-hours definition reused from `OutreachList.tsx` and the goal-hours
  pattern reused from a home-dashboard file.
- Explicit write-up of the null-`people_reached` season-total handling.
- Real test proof: view-vs-UI number cross-check for confirmed hours, planned-hours boundary case,
  team subtotal correctness.
- Astryx prop citations for every component used — grep `astryx-api.md` yourself, don't guess.
- `npm run build`/`typecheck`/`lint`/`format:check`/`test` output.
- Known risks; whether a dispute is needed (you flag, you don't resolve).
