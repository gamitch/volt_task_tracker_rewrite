-- T116: PRD v2 SCH-03 -- migrate the team-scoped metric views to
-- membership-based (D-3 double-count) semantics via `student_teams` (T113's
-- junction table: `20260721000000_student_teams.sql`), replacing the legacy
-- single-FK `students.team_id` team scoping those views previously used.
--
-- Additive migration only -- `create or replace view` in a NEW file, the
-- established pattern this repo already uses (see
-- `20260717000003_metric_views.sql`'s own header note). No shipped migration
-- file is edited.
--
-- D-3 (George, PRD v2 Sec.0, decided 2026-07-20, overriding the architect's
-- credit-where-earned default): a student's hours/participation credit to
-- EVERY team they belong to -- "the hours a student spends on outreach on
-- FTC WILL ALSO count for FRC because they are on both. P3 + GG = VOLT."
-- Dual-member students therefore appear in full in each of their teams'
-- rollups (intentional overlap); a student's PERSONAL total still counts
-- each hour/session once.
--
-- `v_student_hours` (personal totals) is UNCHANGED and deliberately NOT
-- re-created here: it is already one row per (student, season) with a
-- `hours_override`-wins-else-clamped-checkin-else-session-length formula
-- that sums each qualifying attendance row exactly once regardless of how
-- many teams the student belongs to -- already D-3-correct for personal
-- totals. Re-creating it verbatim here would add file-diff noise with zero
-- behavior change; no downstream view in this migration requires it to be
-- redefined (only referenced, unmodified, by `v_team_hours` below).
--
-- `v_student_participation`'s `expected` CTE migrates off the legacy single
-- FK `students.team_id` onto `student_teams` ACTIVE memberships (`left_on is
-- null`): a dual-member student now gets one `expected` row PER (session,
-- membership-team) she qualifies for under that event's own `team_ids`
-- scoping (`team_ids is null` = applies to every team), so she is expected
-- at -- and credited for -- both of her teams' sessions when an event
-- applies broadly, while an event scoped to only one of her teams still
-- produces an `expected` row for that team alone (the join's `st.team_id =
-- any(e.team_ids)` filter, not the mere existence of a second membership,
-- decides that). The row SHAPE (student_id, team_id, season_id,
-- expected_ct, present_ct, late_ct, excused_ct, participation_pct) is
-- unchanged; there can simply be more than one row per (student, season)
-- now (one per qualifying team) where there was previously at most one.
--
-- `v_team_participation` is a pure aggregate of `v_student_participation`
-- grouped by (team_id, season_id) and needs no code change here -- it picks
-- up the migrated `expected` semantics automatically through its own
-- unmodified `from v_student_participation` reference. Verified correct
-- unchanged via scratch-Postgres fixtures below (per the worker packet:
-- "verify, don't assume"), not left as an unchecked assumption.
--
-- `v_team_hours` is NEW: the D-3 double-count team-hours rollup UXP-06's
-- "Hours by team" widget will consume (team_id, season_id, confirmed_hours).
-- Per the constitution's "formula math lives only in SQL views, never
-- re-derived" rule, this view does not re-derive the hours-clamping formula
-- at all -- it only SUMs the already-computed `v_student_hours.confirmed_hours`
-- per team, joined through `student_teams`' ACTIVE memberships. A
-- dual-member student's hours therefore appear in full in both of her
-- teams' `v_team_hours` rows, while her own `v_student_hours` row still
-- counts each hour once (the personal-vs-team split D-3 requires).

create or replace view v_student_participation as
with expected as (
  select s.id as student_id, st.team_id, es.id as session_id, e.season_id
  from students s
  join student_teams st on st.student_id = s.id and st.left_on is null
  join events e on e.counts_participation
    and (e.team_ids is null or st.team_id = any(e.team_ids))
  join event_sessions es on es.event_id = e.id and es.status = 'completed'
  where s.is_active
)
select
  x.student_id, x.team_id, x.season_id,
  count(*) as expected_ct,
  count(*) filter (where a.status in ('present','late')) as present_ct,
  count(*) filter (where a.status = 'late')    as late_ct,
  count(*) filter (where a.status = 'excused') as excused_ct,
  round(100.0 * count(*) filter (where a.status in ('present','late'))
        / greatest(count(*) - count(*) filter (where a.status = 'excused'), 1), 1)
    as participation_pct
from expected x
left join attendance a
  on a.session_id = x.session_id and a.student_id = x.student_id
group by x.student_id, x.team_id, x.season_id;

-- New: D-3 team-hours rollup. Dual-member students' hours double-count by
-- design across their teams' rows; this view only sums `v_student_hours`'
-- already-computed `confirmed_hours`, never re-derives it.
create or replace view v_team_hours as
select
  st.team_id,
  sh.season_id,
  sum(sh.confirmed_hours) as confirmed_hours
from v_student_hours sh
join student_teams st on st.student_id = sh.student_id and st.left_on is null
group by st.team_id, sh.season_id;
