# Worker Packet: T116

## Task ID
T116 — PRD v2 SCH-03: metric views migrate to membership-based (D-3
double-count) semantics via `student_teams`.

## Objective
One new additive migration re-creating the metric views so team-scoped numbers
flow through T113's `student_teams` junction instead of the legacy
`students.team_id` single FK, implementing George's D-3 decision (PRD v2 §0):
a student's hours/participation credit to EVERY team they belong to; personal
totals count each hour once.

## Allowed Files
- `supabase/migrations/20260722000000_membership_views.sql` (new, exactly this
  name)

## Forbidden Files
- Everything else. All shipped migrations read-only (`create or replace view`
  in a NEW file is the established additive pattern). All of `src/**` — if
  your analysis finds a frontend consumer that would break, FLAG it in your
  report as a follow-up; do not fix it here.

## Known Context / Traps
**1. Read `20260717000003_metric_views.sql` first.** Current facts:
`v_student_hours` (per student × season, `hours_override`-wins coalesce, only
`completed` sessions, `counts_volunteer_hours` events, `present`/`late`) is
already D-3-correct for PERSONAL totals — do not change its formula; at most
re-create it untouched if dependency order demands. `v_student_participation`'s
`expected` CTE uses `s.team_id` + `s.team_id = any(e.team_ids)` — THIS is what
migrates: expectation derives from ACTIVE memberships (`student_teams` where
`left_on is null`), so a dual-member student is expected at (and credited for)
both teams' sessions, emitting one row per (student, membership-team, season).
`v_team_participation` derives from it and should then be correct unchanged —
verify, don't assume.
**2. New team-hours rollup.** Add `v_team_hours` (team_id, season_id,
confirmed_hours): sum of members' `v_student_hours` joined through ACTIVE
memberships — the D-3 double-count rollup (dual member's 10h appears in both
teams' totals) that UXP-06's "Hours by team" will consume. Formula math stays
in SQL views only (constitution item 3) — this view may only SUM
`v_student_hours.confirmed_hours`, never re-derive the hours formula.
**3. Row-multiplicity risk — investigate and report, don't fix.** After the
change, `v_student_participation` can emit multiple rows per student (one per
team). Grep `src/` consumers (`VStudentParticipationRow`,
`loaders/reports.ts`, `loaders/meetings.ts` consistency strip,
`loaders/checkin.ts`) and report precisely which, if any, assume one row per
student and would mis-render for dual members. Frontend fixes are follow-up
tasks, not yours.
**4. Scratch-Postgres verification with the D-3 fixture (checker will
reproduce).** Full chain apply; fixtures with a dual-member student (via
`student_teams`) earning 10h at one team's completed session: assert 10h in
BOTH teams' `v_team_hours` rows, 10h (not 20) in her `v_student_hours` row;
participation expectation rows exist for both teams; a `left_on`-dated
(inactive) membership drops out. Also re-run the spirit of the original
fixtures (excused-shrinks-denominator, hours_override-wins) to prove no
formula regression.
**5. Gates.** SQL-only: all five frontend gates clean.

## Acceptance Criteria
Views re-created additively with D-3 semantics; new `v_team_hours`; D-3
fixture assertions pass in scratch Postgres; consumer-risk report delivered;
gates clean.

## Most Recent Failure
None. Attempt 1.

## Required Worker Output
Full SQL; consumer-risk report (Trap #3); scratch transcript; gate output;
risks/dispute flag.
