-- T123: PRD v2 UXD-01/UXP-05 -- the persistent staff KPI strip's SQL source
-- of truth. Constitution item 3 ("RLS policies and metric SQL come ONLY
-- from PRD Section 8.4, copied verbatim ... duplicating a metric formula in
-- TypeScript -> BLOCKER") plus PRD v2 Sec.4 ("New/updated SQL views (sole
-- source of metric math) ... dashboard aggregates for UXD-07 ... Traps
-- carried forward: never edit a shipped migration") together require this
-- to be an ADDITIVE, NEW migration -- no shipped file is touched.
--
-- Two new views, no new tables, no RLS/policy changes (reasoning below).
--
-- ---------------------------------------------------------------------------
-- 1. `v_season_kpis` -- one row per `seasons.id`, the four top-strip cards'
--    season-scoped numbers (hours+breakdown, events logged+most recent,
--    goal target+percent). The worker packet's own Trap #1 offers two
--    routes: reuse `v_student_hours`/`v_team_hours` with only
--    presentation-level TS counting, OR write a new view "if in ANY doubt".
--    Investigated first: `v_student_hours`
--    (`20260717000003_metric_views.sql`) has no `type` column at all (it
--    joins `events` only to filter `counts_volunteer_hours`, then drops the
--    join before the `group by`), so a meetings/outreach/competition
--    breakdown cannot be built from its output without re-deriving the
--    hours formula in TypeScript -- exactly the re-derivation constitution
--    item 3 forbids. `events_logged_count` / `most_recent_event_*` /
--    `goal_target_hours` have no existing view at all to reuse. Every
--    number on every card is therefore built here, in SQL, with ZERO
--    arithmetic left for the TypeScript loader
--    (`src/lib/supabase/loaders/kpi.ts`) to perform beyond a verbatim
--    snake_case -> camelCase rename (mirrors `loaders/reports.ts`'s own
--    already-checker-approved "verbatim rename only" functions).
--
--    The hours formula in the `hours_by_type` CTE below is copied
--    VERBATIM, character-for-character, from `v_student_hours`
--    (`20260717000003_metric_views.sql` lines 7-14, PRD 8.4's own MET-03
--    text) -- the only change is the GROUP BY key (`e.season_id, e.type`
--    instead of `a.student_id, e.season_id`) needed to produce a
--    per-category breakdown a per-student view cannot expose. This is NOT
--    "re-deriving" the formula (the arithmetic itself is an unmodified
--    copy); it is composing the same normative formula at a different,
--    additive grouping, exactly the class of new view PRD v2 Sec.4 itself
--    anticipates ("dashboard aggregates for UXD-07 ... new views").
--
--    `events_logged_count` / `most_recent_event_*`: counts/picks the
--    latest COMPLETED session across ALL event types (no
--    `counts_volunteer_hours` filter) -- a coach's "events logged" strip
--    number should include logged meetings too, not only volunteer-hour
--    events; disclosed judgment call, not SQL-mandated, flagged here in
--    case a future task's own investigation decides differently (same
--    "disclosed, defensible-but-not-forced choice" posture
--    `loaders/reports.ts`'s own module doc #5 already established for this
--    codebase). The old-app "day N" recurrence-position annotation on the
--    "most recent" line (capability map's own dashboard KPI-card text,
--    "Sep 6 · STEMFest After Dark: City Museum Takeover · day 2") is
--    deliberately NOT reproduced -- UXD-01's own packet objective asks only
--    for "+ most recent title", and computing a session's ordinal position
--    within its parent multi-day event is unrelated new aggregation this
--    view does not need to invent to satisfy that requirement.
--
--    `goal_target_hours` -- the worker packet's own central open question
--    ("sum of members' goal hours (default + overrides) or
--    `seasons.default_goal_hours × active students` -- investigate which
--    matches the reference app's '337.75 / 1800h target' semantics").
--    INVESTIGATED against the capability map's own Dashboard figure
--    (`docs/swarm/current-app-capability-map.html`, "Coach dashboard"
--    section): the "% toward season goal" card there reads "337.75 /
--    1800h target", and the adjacent gear-opened "Default season goal"
--    panel's own caption states verbatim "Applies to every student unless
--    overridden in Roster. No custom goals set." -- i.e. the captured
--    fixture has ZERO per-student overrides, so 20 active students x 90h
--    default = 1800h and Sum(goal_hours_override ?? default_goal_hours)
--    over those same 20 students are NUMERICALLY IDENTICAL in that
--    specific screenshot -- the figure alone cannot disambiguate the two
--    candidate formulas. Decision: `Sum(coalesce(goal_hours_override,
--    default_goal_hours))` over active students (the `goal_target` CTE
--    below), NOT `active_students_count * default_goal_hours`. Reasoning:
--    this is exactly PRD 8.4's own MET-04 formula ("Hours vs goal = Σ
--    MET-03 ÷ (`goal_hours_override` ?? season `default_goal_hours`)"),
--    applied per student and summed across the roster -- the season-level
--    aggregate a per-student normative formula implies. The
--    students-times-default alternative is only correct in the zero-override
--    special case the screenshot happens to show; it would silently ignore
--    every future `goal_hours_override` PRD v2's own capability matrix
--    confirms this schema already supports ("Season goal default +
--    per-student override ... seasons.default_goal_hours + roster goal
--    override column"), producing a WRONG target the moment a real coach
--    sets one. Copying MET-04's own per-student formula verbatim (summed,
--    not re-derived) is therefore both the constitution-item-3-safe choice
--    and the one that stays correct as the real roster gains overrides.
--    Scratch-verified below (transcript in the worker's Required Output)
--    with a dual-member student carrying a real `goal_hours_override` that
--    DIFFERS from `default_goal_hours`, proving the two candidate formulas
--    diverge and confirming this view's number is the summed-override one.
--
--    `active_students_count` -- the season-INDEPENDENT current active
--    roster headcount (`count(*) from students where is_active`, no
--    `student_teams`/season join at all). Disclosed as intentionally not
--    season-scoped: D-2 ("ONE single combined season for all teams") means
--    roster membership is a current-roster fact, not a per-season one in
--    this schema (`students.is_active` carries no season dimension) --
--    denormalizing this single count onto every `seasons` row here is a
--    convenience for a ONE-QUERY `.eq('season_id', activeSeasonId).
--    maybeSingle()` strip fetch (trap #3's "one fetch per page load"), not
--    a claim that this number is itself season-scoped math.
--
-- ---------------------------------------------------------------------------
-- 2. `v_season_kpi_team_counts` -- the "Active students" card's per-team
--    split (D-3 double-count by membership). Mirrors `v_team_hours`'s own
--    already-checker-approved pattern (`20260722000000_membership_views.sql`):
--    joins through `student_teams` ACTIVE memberships (`left_on is null`)
--    per team, so a dual-member student is counted in FULL in EVERY team
--    she currently belongs to (D-3, George's words: "the hours a student
--    spends on outreach on FTC WILL ALSO count for FRC because they are on
--    both. P3 + GG = VOLT") -- here applied to headcount rather than hours,
--    the same membership-based double-count semantics, just a COUNT
--    aggregate instead of a SUM one. `count(distinct ...)` and `filter
--    (where ...)` are genuine SQL aggregation (constitution item 3: any
--    doubt -> write the view), so this is its own view rather than a
--    grouped count computed in `src/lib/supabase/loaders/kpi.ts`.
--
--    LEFT JOIN (not INNER), unlike `v_team_hours`'s own INNER-via-`v_
--    student_hours` shape, so a team with genuinely ZERO currently-active
--    members still gets a real `0` row instead of being silently absent --
--    the same "honest zero vs. absent row" distinction PRD 8.4's own
--    Implementation Note already establishes for `v_student_participation`
--    ("expected_ct = 0 rows simply absent; UI renders '—'"; the analogous
--    choice HERE is the inverse: a team card should show "0" not vanish,
--    since `teams` itself is a small, always-enumerable roster list, not a
--    per-student per-session expectation set).
--
--    `where t.archived = false` -- archived teams are excluded from the
--    roster-split card, same reasoning `teams.archived`
--    (`20260716000000_identity_roster.sql`) exists for at all: an archived
--    team is not part of "how the program currently runs" (PRD v2's own
--    framing), so it should not appear in a persistent, always-visible
--    strip meant to reflect the CURRENT season's active reality.
--
-- ---------------------------------------------------------------------------
-- 3. RLS -- no new table, no new policy. Both views are plain (non-
--    `security definer`/`security barrier`) views over `seasons`,
--    `attendance`, `event_sessions`, `events`, `students`, `teams`, and
--    `student_teams` -- every one of which already carries a `staff_all`
--    (`is_staff()`) SELECT policy (`20260717000002_rls.sql`,
--    `20260721000000_student_teams.sql`), so both views already run under
--    the querying session's own RLS against those base tables (same finding
--    `loaders/reports.ts`'s own module doc #7 already made, independently
--    re-confirmed here for this migration's own two views, not assumed).
--    `seasons` in particular has ONLY a `staff_all` read policy (no
--    `read_all`/`own_or_linked_read` equivalent), so a non-staff session
--    querying `v_season_kpis` gets RLS-filtered to zero rows regardless of
--    any UI-level role gate -- defense in depth for UXD-01's "never
--    rendered for student/parent" requirement, not the ONLY enforcement of
--    it (the UI-level gate in `KpiStrip.tsx` is still the primary one, so a
--    non-staff session never even issues this query).

create or replace view v_season_kpis as
with hours_by_type as (
  -- Verbatim copy of `v_student_hours`'s own MET-03 formula
  -- (`20260717000003_metric_views.sql` lines 7-14) -- ONLY the GROUP BY key
  -- differs (season+type instead of student+season), per this file's own
  -- header note #1.
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
    sum(type_hours) as total_hours,
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

create or replace view v_season_kpi_team_counts as
select
  t.id as team_id,
  t.name as team_name,
  t.sort_order as team_sort_order,
  count(distinct st.student_id) filter (
    where s.is_active and st.left_on is null
  ) as active_students_count
from teams t
left join student_teams st on st.team_id = t.id
left join students s on s.id = st.student_id
where t.archived = false
group by t.id, t.name, t.sort_order;
