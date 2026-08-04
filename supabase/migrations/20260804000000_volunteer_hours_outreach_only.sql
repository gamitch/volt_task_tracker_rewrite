-- T322: volunteer hours = `type = 'outreach'` ONLY. Additive migration,
-- create-or-replace of two already-applied views (constitution item 10 --
-- editing an applied migration file is a BLOCKER, so both fixes land here
-- instead of touching `20260717000003_metric_views.sql` /
-- `20260723000000_kpi_views.sql` directly).
--
-- Three owner rulings, all in `docs/swarm/auto-mode-decisions.md`:
--   1. 2026-08-02 -- "meeting hours should not count toward volunteer
--      hours". `type = 'meeting'` is excluded; `type = 'outreach'` counts
--      IN FULL, including `GG FLL Team Meetings` / `P3 FLL Team Meetings`
--      (72 of 117 migrated sessions, 62% of the data) -- those two events
--      are `type = 'outreach'` despite the word "Meetings" in their
--      titles, because the team's own students are student coaches running
--      them for younger FLL teams in the community. THE RULE IS BY EVENT
--      `type`, NEVER BY EVENT NAME -- this has confused three people
--      (two reviewers, the orchestrator once) and is the single most
--      important fact in this file.
--   2. 2026-08-03 (part 2) -- "Volunteer hours = `type = 'outreach'` ONLY."
--      Extends the rule to the third enum value: `type = 'competition'`
--      also does NOT count toward the volunteer-hours total or goal
--      percentage, though it stays tracked and displayed as its own
--      breakdown figure.
--   3. 2026-08-04 -- "fix both": the fix extends to `v_student_hours`
--      (every student's own confirmed hours + goal progress), not just the
--      staff KPI card's `v_season_kpis`.
--
-- The real defect (corrected from the ledger row, which is misleading):
-- both views already join `events e ... and e.counts_volunteer_hours`, an
-- EDITABLE per-event boolean, fixed `true` for `outreach` and fixed
-- `false` for `meeting`, but ADMIN-EDITABLE (defaults `false`) for
-- `competition`. Meeting hours were already excluded today via that flag;
-- competition hours are one admin toggle away from entering the total.
-- The fix below governs volunteer hours by `type` instead, closing that
-- gap permanently regardless of how the flag is ever set.
--
-- NOT AUTHORIZED by any of the three rulings: retyping any event, or
-- touching the FLL events, or filtering on event NAME/title anywhere.

-- 1. `v_student_hours` (originally `20260717000003_metric_views.sql:3-19`).
-- Adds `and e.type = 'outreach'` to the existing join. The pre-existing
-- `e.counts_volunteer_hours` condition is kept unmodified -- it is a
-- separate, pre-existing mechanism; removing it here would be a wider
-- behavioural change than the rulings authorize.
create or replace view v_student_hours as
select
  a.student_id,
  e.season_id,
  sum(coalesce(
    a.hours_override,
    case when a.check_in_at is not null and a.check_out_at is not null
      then greatest(extract(epoch from
        (least(a.check_out_at, es.ends_at) - greatest(a.check_in_at, es.starts_at))) / 3600.0, 0)
    end,
    extract(epoch from (es.ends_at - es.starts_at)) / 3600.0
  )) as confirmed_hours
from attendance a
join event_sessions es on es.id = a.session_id and es.status = 'completed'
join events e on e.id = es.event_id and e.counts_volunteer_hours and e.type = 'outreach'
where a.status in ('present','late')
group by a.student_id, e.season_id;

-- 2. `v_season_kpis` (originally `20260723000000_kpi_views.sql`). The
-- `hours_by_type` CTE is intentionally left UNFILTERED by type -- filtering
-- it would zero out `meeting_hours`/`competition_hours`, and the
-- 2026-08-03 ruling requires those to survive as their own tracked
-- figures. Only `season_hours.total_hours` changes, from an all-type sum
-- to the outreach-only one; `meeting_hours`/`outreach_hours`/
-- `competition_hours` and every other column are unchanged.
create or replace view v_season_kpis as
with hours_by_type as (
  -- Verbatim copy of `v_student_hours`'s own MET-03 formula
  -- (`20260717000003_metric_views.sql` lines 7-14) -- ONLY the GROUP BY key
  -- differs (season+type instead of student+season), per the original
  -- file's own header note #1. NOT filtered by type -- see note above.
  select
    e.season_id,
    e.type,
    sum(coalesce(
      a.hours_override,
      case when a.check_in_at is not null and a.check_out_at is not null
        then greatest(extract(epoch from
          (least(a.check_out_at, es.ends_at) - greatest(a.check_in_at, es.starts_at))) / 3600.0, 0)
      end,
      extract(epoch from (es.ends_at - es.starts_at)) / 3600.0
    )) as type_hours
  from attendance a
  join event_sessions es on es.id = a.session_id and es.status = 'completed'
  join events e on e.id = es.event_id and e.counts_volunteer_hours
  where a.status in ('present', 'late')
  group by e.season_id, e.type
),
season_hours as (
  select
    season_id,
    -- T322: was `sum(type_hours)` across ALL types. Volunteer hours =
    -- `type = 'outreach'` ONLY (2026-08-03 ruling, part 2). The three
    -- breakdown columns below are untouched.
    sum(type_hours) filter (where type = 'outreach') as total_hours,
    sum(type_hours) filter (where type = 'meeting') as meeting_hours,
    sum(type_hours) filter (where type = 'outreach') as outreach_hours,
    sum(type_hours) filter (where type = 'competition') as competition_hours
  from hours_by_type
  group by season_id
),
events_logged as (
  -- Header note #1: every completed session's event counts, regardless of
  -- `counts_volunteer_hours` -- a logged meeting counts as a logged event.
  select e.season_id, count(distinct e.id) as events_logged_count
  from events e
  join event_sessions es on es.event_id = e.id and es.status = 'completed'
  group by e.season_id
),
most_recent_session as (
  select distinct on (e.season_id)
    e.season_id,
    e.title as most_recent_event_title,
    es.session_date as most_recent_event_date
  from events e
  join event_sessions es on es.event_id = e.id and es.status = 'completed'
  order by e.season_id, es.session_date desc, es.starts_at desc
),
active_roster as (
  -- Header note #1: season-INDEPENDENT current active headcount, denormalized
  -- onto every season row below via `cross join` (always exactly one row).
  select count(*) as active_students_count from students where is_active
),
goal_target as (
  -- Header note #1: MET-04's own per-student denominator
  -- (`goal_hours_override ?? season default_goal_hours`), summed across the
  -- active roster, per season (`se.default_goal_hours` varies by season, so
  -- this cannot be computed once and reused across rows).
  select
    se.id as season_id,
    coalesce(sum(coalesce(s.goal_hours_override, se.default_goal_hours)), 0) as goal_target_hours
  from seasons se
  join students s on s.is_active
  group by se.id
)
select
  se.id as season_id,
  coalesce(sh.total_hours, 0) as total_hours,
  coalesce(sh.meeting_hours, 0) as meeting_hours,
  coalesce(sh.outreach_hours, 0) as outreach_hours,
  coalesce(sh.competition_hours, 0) as competition_hours,
  coalesce(el.events_logged_count, 0) as events_logged_count,
  mr.most_recent_event_title,
  mr.most_recent_event_date,
  ar.active_students_count,
  coalesce(gt.goal_target_hours, 0) as goal_target_hours,
  -- Denominator floor 1, same pattern PRD 8.4's own `v_student_participation`/
  -- `v_team_participation` already use for a percentage that could otherwise
  -- divide by zero. Rounded to 0 decimals in SQL (never in TypeScript) to
  -- match the capability map's own "19%" whole-percent display.
  -- `goal_pct` derives from `total_hours` (this same CTE column) so the
  -- outreach-only fix above already reaches it -- no separate change needed
  -- here (measured by the T322 premise gate against real Postgres).
  round(
    100.0 * coalesce(sh.total_hours, 0) / greatest(coalesce(gt.goal_target_hours, 0), 1),
    0
  ) as goal_pct
from seasons se
left join season_hours sh on sh.season_id = se.id
left join events_logged el on el.season_id = se.id
left join most_recent_session mr on mr.season_id = se.id
left join goal_target gt on gt.season_id = se.id
cross join active_roster ar;
