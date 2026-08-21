-- GAM-442: `v_event_attendance` -- attendance aggregated per EVENT.
--
-- Additive migration only: one NEW view in a NEW file. No existing migration
-- file is edited, no existing view is redefined, no row is touched, no policy
-- is altered. Constitution item 10 makes editing an applied migration a
-- BLOCKER, and this file takes the same additive route
-- `20260804000000_volunteer_hours_outreach_only.sql` and
-- `20260805000000_dashboard_views_comment_corrections.sql` took.
--
-- ---------------------------------------------------------------------------
-- WHAT / WHY.
--
-- The coach series card renders "Attendance 96.5% across 21 held". Both halves
-- of that sentence are computed in TypeScript today, by dividing two numbers
-- the client fetched separately. Constitution item 3 / PRD DATA-01 want metric
-- arithmetic to live in SQL, computed once, so that every surface reading the
-- same figure reads the same number. This view is that single source: one row
-- per `events.id`, carrying the percentage AND the counts it was derived from.
--
-- All three event types are included (`meeting`, `outreach`, `competition`).
-- Restricting to meetings would make the view useless to a later outreach
-- surface and buys nothing -- the consumer filters by event, not by this view.
--
-- ---------------------------------------------------------------------------
-- THE SHAPE THIS TAKES, stated because there are two correct ones and the
-- wrong one is not obviously wrong.
--
-- **Shape 1 was taken**: a single `events -> event_sessions -> attendance`
-- left-join chain, with `count(distinct es.id)` for `held_ct` and `count(a.id)`
-- for every mark count. (Shape 2 -- pre-aggregating held sessions in their own
-- CTE and joining that to a marks aggregate -- produces byte-identical output;
-- it was measured alongside this one and is equally correct.)
--
-- **The fan-out this avoids, MEASURED on a PostgreSQL 16.15 scratch cluster
-- carrying this repo's full migration set, not reasoned about.** In that
-- left-join chain, a held session carrying n marks appears n times. A bare
-- `count(es.id)` therefore counts that session n times. On the acceptance
-- fixture (event E1: 2 completed sessions, 1 scheduled, 1 canceled, 5 marks
-- across the two held sessions), the naive spelling reports:
--
--     held_ct | graded_marks_ct | excused_ct | attended_marks_ct | pct
--           5 |               5 |          1 |                 3 | 75.0
--
-- `held_ct = 5` where the truth is 2. Note that `attendance_pct` is CORRECT in
-- that output: numerator and denominator fan out by the same factor, so the
-- error cancels and the view looks right. `held_ct` does not cancel, and
-- `held_ct` is the user-visible "across 21 held" half of the card's headline.
-- `count(distinct es.id)` is what makes it 2. `supabase/tests/
-- gam442_event_attendance_assertions.sql`'s (a2) block is the standing guard.
--
-- **`count(*)` is never used below, and that is deliberate**, not style. In a
-- left join the null-extended row counts as 1, so `count(*)` reports one
-- phantom mark for an event with no marks at all -- measured: an event with one
-- held session and zero attendance rows reported `graded_marks_ct = 1` and
-- `attendance_pct = 0.0`, fabricating a zero the NULL rule below forbids.
-- `count(a.id)` counts only real marks.
--
-- Structural precedent: `v_event_student_hours`
-- (`20260723000001_dashboard_views.sql:269-291`) is this same join at this same
-- `events.id` grain and already uses `count(distinct ...)` for exactly this
-- reason. Its one divergence is that it uses INNER joins, so a zero-session
-- event vanishes from it. This view uses LEFT joins instead -- see below.
--
-- ---------------------------------------------------------------------------
-- THE DENOMINATOR: T509/D014's EXPLICIT-MARKS convention, reused unchanged.
--
--   (marks that exist) - (excused marks)
--
-- spelled `count(a.id) - count(a.id) filter (where a.status = 'excused')`,
-- exactly as `20260806000000_met01_explicit_marks.sql:117-130` spells it, and
-- for the reason its `:38-61` gives: `attendance.status` has four mutually
-- exclusive values, so `present+late+absent` already excludes excused and
-- subtracting it a second time would double-subtract. MET-05: `late` counts as
-- attended, everywhere.
--
-- NULL, NEVER A FABRICATED 0. When that denominator is 0, `attendance_pct` is
-- NULL. There is no `greatest(..., 1)` floor anywhere below. An event with held
-- sessions and no marks is NULL; an event whose every mark is excused is NULL.
-- The UI already renders a null percentage as an em dash. (This is the T509
-- convention, not `v_season_attendance_rate`'s older `greatest(count(*), 1)`
-- eligibility cross-product -- see the divergence note further down.)
--
-- EVERY EVENT GETS A ROW, including one with zero sessions: `held_ct = 0`,
-- every mark count 0, `attendance_pct` NULL. Hence the LEFT joins. The card
-- must be able to say "0 held" rather than find no row and guess. Measured:
-- row count 1, `held_ct = 0`, `attendance_pct` NULL.
--
-- MARKS ON NON-HELD SESSIONS DO NOT COUNT, anywhere, in any column. The
-- `es.status = 'completed'` predicate sits in the JOIN condition, not in a
-- WHERE clause -- in a left join a WHERE would discard the event's row
-- entirely instead of merely contributing nothing.
--
-- ---------------------------------------------------------------------------
-- WHAT WAS DELIBERATELY NOT DONE.
--
-- 1. **No student-level filtering.** This view does NOT join `students` or
--    `student_teams`, and does NOT filter on `s.is_active`, `st.left_on`, or
--    `e.counts_participation` -- all of which `v_student_participation` does.
--    That is deliberate, and it is the most consequential decision here:
--      (a) Different subject. That view answers "how much of what was expected
--          of THIS STUDENT did they attend". This one answers "how well
--          attended was THIS EVENT". Filtering an event's attendance by who is
--          still active TODAY would make a historical event's percentage change
--          over time as students leave -- the number would silently rewrite
--          itself.
--      (b) `counts_participation` is a student-metric switch, not an
--          attendance-happened switch. An event with it false still had people
--          show up, and a series card reports turnout.
--      (c) Denominator honesty. The T509 convention's whole point is that the
--          denominator is the marks that exist. Filtering which marks are
--          allowed to exist reintroduces an eligibility judgement through the
--          back door.
--    Per-surface divergent ratios are established practice here, not a defect:
--    `CoachHome.tsx:1168-1173` already ships one carrying an in-code comment
--    that says so.
--
-- 2. **`v_season_attendance_rate` is NOT moved to this convention.** Two
--    attendance conventions coexist on `main`: T509 moved
--    `v_student_participation` / `v_team_participation` to explicit marks +
--    NULL, and did not move `v_season_attendance_rate`, which still uses the
--    eligibility cross-product and `greatest(count(*), 1)`
--    (`20260723000001_dashboard_views.sql:197-222`). That divergence is
--    pre-existing and out of scope here. This view follows the T509 side.
--
-- 3. **No dispute-log entry and no `gate/human`.** `boss-arbiter`
--    (`dispute-log.md:1873-1878`) states the operative test: an entry is owed
--    when a PRD 8.3 matrix grant moves (D013) or an 8.4 normative formula moves
--    (D014). PRD 8.2/8.4 define MET-01..MET-05 at student/team/season grain
--    only and contain no per-event attendance metric, so there is no 8.4 text
--    to copy and none is redefined; the 8.3 row `| events / sessions | full |`
--    (`VOLT_Portal_PRD.md:577`) is unchanged and this view is revoked from
--    `anon` rather than widened. Neither trigger fires. Writing an entry where
--    none is owed would, in that same ruling's words, "falsely enlarge item 3".
--
-- ---------------------------------------------------------------------------
-- THE KNOWN RISK, carried forward from D014 rather than invented here.
--
-- This view can honestly report 100% for an event most of the roster skipped.
-- `20260806000000_met01_explicit_marks.sql:24-30` records that T508 made "no
-- attendance row" the NORMAL shape for an unmarked student -- absences are
-- written only when a coach explicitly opts in. An explicit-marks denominator
-- counts only marks that exist, so FORGETTING TO MARK SOMEONE INFLATES THE
-- PERCENTAGE. That file states the consequence verbatim at `:107-112`: "this
-- INVERTS the failure mode ... RPT-02's visible marked/present/late/excused
-- counts are the mitigation. If RPT-02 ever stops showing them, D014 must be
-- revisited."
--
-- MEASURED at this new grain: a 5-student roster across 20 held sessions where
-- only the 2 students who turned up each night were marked reports
-- `held_ct = 20`, `graded_marks_ct = 40`, `attended_marks_ct = 40`,
-- `attendance_pct = 100.0` -- against 100 roster-turns. A coach reads
-- "Attendance 100% across 20 held" for an event 60% of the roster skipped.
--
-- The denominator is NOT changed here to compensate. Changing it would move
-- MET-01's denominator, which D014 owns by owner ruling, and would owe a
-- dispute-log entry under the test in note 3 above. What this migration does
-- instead is DISCHARGE D014's OWN STATED MITIGATION AT THE NEW GRAIN:
-- `graded_marks_ct` and `attended_marks_ct` are exposed as first-class columns
-- precisely so the consuming card can render the counts beside the percentage,
-- and the catalog comment below carries the warning so the next reader meets
-- it. A consumer that renders `attendance_pct` alone reintroduces D014's known
-- regression at a new surface. That cannot be enforced from inside a migration;
-- it is a disclosed, accepted risk owned by the consuming ticket.
-- ---------------------------------------------------------------------------

create or replace view public.v_event_attendance as
select
  e.id as event_id,
  -- SESSIONS, not marks. `distinct` is load-bearing: see the fan-out note above.
  count(distinct es.id) as held_ct,
  -- MARKS. `count(a.id)`, never `count(*)` -- the null-extended left-join row
  -- would otherwise be counted as a phantom mark.
  count(a.id) as graded_marks_ct,
  count(a.id) filter (where a.status = 'excused') as excused_ct,
  -- MET-05: `late` is attended.
  count(a.id) filter (where a.status in ('present', 'late')) as attended_marks_ct,
  case
    when count(a.id) - count(a.id) filter (where a.status = 'excused') = 0 then null
    else round(
      100.0 * count(a.id) filter (where a.status in ('present', 'late'))
        / (count(a.id) - count(a.id) filter (where a.status = 'excused')), 1)
  end as attendance_pct
from public.events e
-- LEFT, so a zero-session event still gets a row. `status = 'completed'` lives
-- in the join condition, not a WHERE clause, for the same reason.
left join public.event_sessions es
  on es.event_id = e.id and es.status = 'completed'
left join public.attendance a
  on a.session_id = es.id
group by e.id;

comment on view public.v_event_attendance is
  'GAM-442. GRAIN: exactly one row per events.id, for every event of every type, including an event with zero sessions (held_ct 0, all mark counts 0, attendance_pct NULL). held_ct counts SESSIONS (count(distinct es.id) over event_sessions with status = ''completed''); every other count counts MARKS (attendance rows on those held sessions) -- do not read one as implying the other, and see this view''s migration file for the join fan-out that makes held_ct easy to get silently wrong. DENOMINATOR: T509/D014''s explicit-marks rule, (marks that exist) - (excused marks), identical to 20260806000000_met01_explicit_marks.sql:117-130; late counts as attended (MET-05); marks on scheduled or canceled sessions count nowhere. NULL, NEVER ZERO: when that denominator is 0 -- held sessions with no marks, or every mark excused -- attendance_pct is NULL, not 0.0. There is no greatest(...,1) floor. The UI renders NULL as an em dash. KNOWN RISK (D014, inverted failure mode): since T508 an unmarked student normally has NO attendance row, so forgetting to mark someone INFLATES this percentage -- measured 100.0 percent for an event 60 percent of the roster skipped. graded_marks_ct and attended_marks_ct exist as the mitigation: A CONSUMER THAT RENDERS attendance_pct WITHOUT ALSO RENDERING graded_marks_ct REINTRODUCES D014''s KNOWN REGRESSION. SECURITY MODEL: executes as this view''s OWNER and does NOT apply the querying session''s RLS to its base tables -- no view in this schema sets security_invoker (PG15+), which defaults off. Mechanism measured, not reasoned -- see 20260731000000_leaderboard_students_view.sql:32-46 and 20260805000000_dashboard_views_comment_corrections.sql:41-49.';

comment on column public.v_event_attendance.held_ct is
  'COUNTS SESSIONS. count(distinct es.id) over this event''s event_sessions with status = ''completed''. This is the "across N held" half of the coach series card headline. It is the ONE column here that does not count attendance marks, and the distinct is load-bearing: the events -> event_sessions -> attendance left-join chain multiplies each held session by its number of marks, so a bare count(es.id) reported 5 for an event with 2 held sessions and 5 marks (measured, PostgreSQL 16.15, full migration set). attendance_pct survives that fan-out unharmed because numerator and denominator fan out together -- held_ct does not, which is why it needs its own guard. See supabase/tests/gam442_event_attendance_assertions.sql, criterion (a2).';

comment on column public.v_event_attendance.graded_marks_ct is
  'COUNTS MARKS, not sessions -- the column readers most often confuse with held_ct. count(a.id) of the attendance rows on this event''s HELD (completed) sessions, INCLUDING excused ones; excused is then removed from the percentage''s denominator via excused_ct. Spelled count(a.id) rather than count(*) deliberately: in this left join the null-extended row for a session with no marks would make count(*) report a phantom mark of 1 and a fabricated attendance_pct of 0.0 (measured). This column is D014''s mitigation made available at event grain -- a surface that renders attendance_pct without it reintroduces D014''s known regression (see the view comment).';

-- ---------------------------------------------------------------------------
-- `anon` gets nothing. Supabase's stock `alter default privileges in schema
-- public grant all on tables to anon, authenticated, service_role` hands out
-- privileges on every new relation, including this one, so a new view is
-- readable by unauthenticated requests unless a statement like this one says
-- otherwise.
--
-- AUTHORITY: PRD 8.3, which is normative text -- "no `anon` access except the
-- `ics` and `checkin` Edge Functions". This view is neither.
--
-- **T205's rationale does NOT transfer, and is deliberately not repeated
-- here.** `20260803000001_revoke_anon_leaderboard_students.sql:18-35` chose
-- `revoke all` over `revoke select` because `v_leaderboard_students` is a
-- simple single-table view, hence auto-updatable, hence still deletable by
-- `anon` after a bare `revoke select`. `v_event_attendance` is an AGGREGATE
-- view and therefore not auto-updatable -- `information_schema.views.
-- is_updatable = 'NO'`, measured, against `v_leaderboard_students`'s 'YES'. So
-- there is no write path here. `revoke all` stays because it is idempotent, it
-- is the right spelling, and PRD 8.3 is normative -- not because a DELETE path
-- existed.
--
-- **This is not a security finding and must not be read as one.** What is
-- withheld is event ids and integer counts; no PII. Constitution item 25 says
-- verbatim "Item 4 covers tables; do not extend it to views".
--
-- **GAM-389 is not resolved by this line.** The cross-view question -- five
-- existing student-hours views answer unauthenticated requests while the one
-- view T205 revoked does not -- is already filed as GAM-389
-- (`docs/swarm/linear-export.md:95`), and its own title says the correct
-- posture is UNDECIDED. GAM-442 ships this revoke because PRD 8.3 is normative
-- text. It does not resolve GAM-389, which owns the inconsistent posture across
-- the other views, and it is not a precedent for that decision.
-- ---------------------------------------------------------------------------
revoke all on public.v_event_attendance from anon;
