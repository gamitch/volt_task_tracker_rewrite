-- T124: PRD v2 UXP-06/UXP-10 (UXD-07 "Dashboard analytics parity") -- the
-- coach/admin dashboard's secondary stat tiles, per-student goal projection,
-- top-events-by-hours, and the SQL half of the activity feed's self/staff
-- attribution. Additive migration only -- `create or replace view` in a NEW
-- file (this repo's own established pattern, see
-- `20260717000003_metric_views.sql`'s and `20260722000000_membership_views.sql`'s
-- own header notes). No shipped migration file is edited.
--
-- Sibling-migration note (four PRD v2 UX-parity tasks -- T120-T123 -- run
-- concurrently on disjoint files this same wave): this file's own timestamp,
-- `20260723000001`, is deliberately distinct from T123's
-- `20260723000000_kpi_views.sql` (a different worker packet's own migration,
-- never read or touched here).
--
-- Constitution item 3 (BLOCKER-class) -- every view below is real formula
-- territory (percentages, sums, averages, day-of-week bucketing, clamped
-- hours) written ONCE here in SQL; `src/lib/supabase/loaders/dashboard.ts`
-- and `CoachHome.tsx` only sort/slice/format the already-computed columns
-- these views hand back (T044's `Leaderboard.tsx` precedent for that
-- TS-side discipline, cited in the worker packet).
--
-- ---------------------------------------------------------------------------
-- SCOPE DECISION (disclosed, not assumed): every view below is SEASON-scoped
-- only, never team-scoped, with ONE deliberate exception (`v_team_hours`,
-- already built by T116/20260722000000_membership_views.sql, consumed
-- unmodified here -- no new view for "hours by team", per the worker
-- packet's own instruction).
--
-- Why season-only for everything else: the binding reference figure (the
-- capability map's "Dashboard" section, `docs/swarm/current-app-capability-map.html`
-- line 75's screenshot) shows the secondary stat tiles, the per-student goal
-- projection list (student rows carry EITHER a "P3" or "Gear Girls" team
-- badge in the SAME list, never two separately-scoped lists), and "top
-- events by student hours" as ONE combined-program view, not filtered to a
-- single team -- consistent with D-2's own framing ("P3 + GG = VOLT... one
-- season for all and reporting will handle the team metrics") and D-3's
-- "personal numbers count once" half (a dual-member student's own
-- confirmed/planned/goal projection row must NOT double-count across her
-- memberships -- only TEAM-level rollups like `v_team_hours` intentionally
-- double-count, per D-3's other half). `CoachHome.tsx`'s EXISTING
-- `PLACEHOLDER_CURRENT_TEAM_ID`-scoped primary KPI grid / Next-up / Recent
-- signups / check-in / season-setup card are UNCHANGED by this migration or
-- by this task's own component edits (Required Output's own "Keep the
-- existing next-up/check-in/season-setup cards" instruction) -- this is a
-- disclosed, pre-existing team-scoping convention from an earlier task
-- (T053) that this task does not reconcile or remove, only leaves alone.
--
-- ---------------------------------------------------------------------------
-- RLS (read-only finding, same reasoning `20260721000000_student_teams.sql`'s
-- own comments and `loaders/reports.ts`'s own module doc #7 already
-- established for the identical mechanism question): none of the views below
-- are `security_definer`/`security_barrier`, so each runs under the
-- querying session's own RLS against its base tables
-- (`students`/`student_teams`/`teams`/`seasons`/`events`/`event_sessions`/
-- `rsvps`/`attendance`, all `20260717000002_rls.sql`, read-only). Every one
-- of those tables already carries a `staff_all` policy granting `admin`/
-- `coach` full read access; `CoachHome.tsx` is coach/admin-only (its own
-- `user.role === 'admin'` gate plus the app's `RequireRole` routing), so a
-- real empty result from any query below means "none exist yet this
-- season", not an RLS-caused false-empty.

-- ---------------------------------------------------------------------------
-- 1. Base unaggregated view: one row per qualifying ("going", future,
--    hours-counting) RSVP, with the session's own duration already computed.
--    DRY foundation for the next two views (Trap #4's "planned = future
--    'going' RSVP hours" investigation) -- the `extract(epoch from ...)`
--    duration formula is written exactly ONCE, here, and reused by both
--    aggregations below rather than copy-pasted with two different date
--    filters.
-- ---------------------------------------------------------------------------
create or replace view v_planned_rsvp_hours as
select
  r.student_id,
  e.season_id,
  es.starts_at,
  extract(epoch from (es.ends_at - es.starts_at)) / 3600.0 as planned_hours
from rsvps r
join event_sessions es on es.id = r.session_id and es.status = 'scheduled'
join events e on e.id = es.event_id and e.counts_volunteer_hours
where r.status = 'going';

-- ---------------------------------------------------------------------------
-- 2. Personal (never team-scoped) planned-hours total per student/season --
--    same shape as the existing `v_student_hours` (student_id, season_id,
--    one hours column), feeding the goal-projection view below. Unlike
--    T116's `v_student_participation`/`v_team_hours` (which deliberately
--    double-count a dual-member student's ALREADY-CONFIRMED numbers across
--    her team memberships, per D-3), this view never joins through
--    `student_teams` at all -- a future session she's RSVP'd "going" to is
--    the SAME physical commitment regardless of how many of her teams it
--    happens to apply to, so it must count once per student, matching
--    `v_student_hours`'s own personal, single-counted convention (D-3:
--    "personal numbers count once").
-- ---------------------------------------------------------------------------
create or replace view v_student_planned_hours as
select student_id, season_id, sum(planned_hours) as planned_hours
from v_planned_rsvp_hours
group by student_id, season_id;

-- ---------------------------------------------------------------------------
-- 3. Season-wide "upcoming 30-day committed hours" secondary stat tile.
--    Total person-hours across every 'going' RSVP for a session starting in
--    the next 30 days (inclusive of now, exclusive of the 30-day boundary) --
--    reads as "if everyone who's RSVP'd shows up for their full session,
--    this many hours will be logged in the next month". `now()` is
--    evaluated at QUERY time (a plain view, not materialized), so this
--    window always reflects the moment the dashboard is loaded, same as
--    every other `now()`-relative view already in this schema would if one
--    existed (no prior precedent for this specific pattern in this repo,
--    disclosed as new but unremarkable standard SQL).
-- ---------------------------------------------------------------------------
create or replace view v_season_upcoming_committed_hours as
select season_id, sum(planned_hours) as committed_hours_30d
from v_planned_rsvp_hours
where starts_at >= now() and starts_at < now() + interval '30 days'
group by season_id;

-- ---------------------------------------------------------------------------
-- 4. Season-wide roster stats: active student count, avg confirmed hours
--    per active student, and count of active students already at/over goal.
--    Deliberately NOT built by summing `v_team_hours`/`v_student_participation`
--    (both intentionally double-count dual members per D-3) -- this view
--    reads `students`/`seasons` directly with a LEFT JOIN onto
--    `v_student_hours`, so a student with zero completed hours this season
--    still contributes a real `0` to the average/goal-count (the correct
--    denominator behavior for "average PER ACTIVE STUDENT" -- unlike
--    `v_student_hours` itself, which legitimately omits a student entirely
--    when she has no qualifying attendance yet, per that view's own
--    "absence, not a fabricated 0" convention already established in
--    `CoachHome.tsx`'s module doc #4).
-- ---------------------------------------------------------------------------
create or replace view v_season_roster_stats as
with roster as (
  select s.id as student_id, s.goal_hours_override
  from students s
  where s.is_active
),
roster_hours as (
  select
    r.student_id,
    se.id as season_id,
    coalesce(r.goal_hours_override, se.default_goal_hours) as goal_hours,
    coalesce(sh.confirmed_hours, 0) as confirmed_hours
  from roster r
  join seasons se on se.is_active
  left join v_student_hours sh on sh.student_id = r.student_id and sh.season_id = se.id
)
select
  season_id,
  count(*) as active_student_count,
  round(avg(confirmed_hours), 1) as avg_hours_per_active_student,
  count(*) filter (where confirmed_hours >= goal_hours) as students_at_goal_count
from roster_hours
group by season_id;

-- ---------------------------------------------------------------------------
-- 5. Season-wide "distinct completed session days" secondary stat tile
--    ("Session days logged... completed only", capability-map figure's own
--    label). A distinct-DATE count, not a session-ROW count -- two sessions
--    completed on the same calendar date count as one "session day".
-- ---------------------------------------------------------------------------
create or replace view v_season_session_days as
select
  e.season_id,
  count(distinct es.session_date) as session_days_logged
from events e
join event_sessions es on es.event_id = e.id and es.status = 'completed'
group by e.season_id;

-- ---------------------------------------------------------------------------
-- 6. Season-wide attendance-rate secondary stat tile.
--
--    A NEW, deliberately DISTINCT ratio from MET-01/02
--    (`v_student_participation`/`v_team_participation`,
--    `20260717000003_metric_views.sql`) -- same disclosed-distinct-grain
--    reasoning `CoachHome.tsx`'s own existing "Last meeting attendance" KPI
--    card already established for this exact file (module doc #4 there:
--    "deliberately NOT MET-01/02's excused-exclusion formula ... a distinct,
--    simpler, disclosed ratio"), applied here at SEASON grain instead of
--    that card's single-session grain: `(present+late) / expected`, where
--    `expected` counts every (active student, completed session) pair for
--    sessions the student is eligible for by ANY of her team memberships,
--    WITHOUT subtracting excused attendance from the denominator. This
--    deliberately produces a DIFFERENT number from `v_team_participation`
--    (which excludes excused) so the two never silently duplicate each
--    other's display value once both are shown on the same page.
--
--    D-3 "personal numbers count once": `select distinct s.id, es.id,
--    e.season_id` below guarantees each (student, session) expected pair is
--    counted EXACTLY ONCE org-wide even when a dual-member student is
--    eligible via more than one of her team memberships for the same
--    session -- unlike T116's own `v_student_participation` "expected" CTE,
--    which deliberately produces one row PER qualifying team membership
--    (correct for THAT view's team-level rollups, wrong for an org-wide,
--    single-counted season stat).
-- ---------------------------------------------------------------------------
create or replace view v_season_attendance_rate as
with expected as (
  select distinct s.id as student_id, es.id as session_id, e.season_id
  from students s
  join events e on e.counts_participation
    and (
      e.team_ids is null
      or exists (
        select 1 from student_teams st
        where st.student_id = s.id and st.left_on is null and st.team_id = any(e.team_ids)
      )
    )
  join event_sessions es on es.event_id = e.id and es.status = 'completed'
  where s.is_active
)
select
  x.season_id,
  count(*) as expected_ct,
  count(*) filter (where a.status in ('present', 'late')) as present_ct,
  round(
    100.0 * count(*) filter (where a.status in ('present', 'late'))
      / greatest(count(*), 1),
    1
  ) as attendance_rate_pct
from expected x
left join attendance a on a.session_id = x.session_id and a.student_id = x.student_id
group by x.season_id;

-- ---------------------------------------------------------------------------
-- 7. "Busiest day" secondary stat tile -- session counts bucketed by
--    ISO day-of-week (1=Monday .. 7=Sunday) off `event_sessions.session_date`
--    (the authoritative calendar-day column -- NOT `starts_at`, which is a
--    `timestamptz` that could shift calendar day across a timezone
--    boundary). Every scheduled/completed/canceled session counts (no
--    `status` filter) -- this answers "which day of the week does this
--    program typically OFFER sessions", a scheduling-pattern question
--    distinct from "which sessions actually happened" (module doc's own
--    disclosed reading of the figure's ambiguous "by offered ..." caption
--    text, not independently guessed). `CoachHome.tsx`/`dashboard.ts` picks
--    the max-count row via a plain sort+slice over this view's already-
--    computed counts (T044 precedent, no arithmetic performed downstream)
--    and maps the integer day-of-week to a display label ("Mon".."Sun") --
--    a pure format transform, not a re-derivation of the count itself.
-- ---------------------------------------------------------------------------
create or replace view v_season_day_of_week_sessions as
select
  e.season_id,
  extract(isodow from es.session_date)::int as day_of_week,
  count(*) as session_count
from event_sessions es
join events e on e.id = es.event_id
group by e.season_id, extract(isodow from es.session_date);

-- ---------------------------------------------------------------------------
-- 8. "Top events by student hours" widget. Per-EVENT hours total -- no
--    existing view aggregates at this grain (`v_student_hours` is per
--    student/season; `v_team_hours` is per team/season). The per-row hours
--    formula (the `coalesce(...)` chain below) is a byte-for-byte copy of
--    `v_student_hours`'s own formula
--    (`20260717000003_metric_views.sql` lines 7-13) -- same "reuse the
--    identical formula at a different aggregation grain, never invent a
--    second one" discipline `EventsTab.tsx`'s own
--    `computeAttendeeHours`/`computeSessionHoursAwarded` already established
--    (that file's own module doc #4(b), read read-only for this task) --
--    the difference there was TS mirroring a view for a per-row display
--    number; here it is a second SQL view sharing the same source formula
--    for a different `group by`, which is the SQL-side analogue of that
--    exact discipline (write the formula once per grain that genuinely
--    needs it, never re-derive an already-existing grain's number).
--    `student_count` is `count(distinct a.student_id)` — the figure's own
--    "N students" caption.
-- ---------------------------------------------------------------------------
create or replace view v_event_student_hours as
select
  e.id as event_id,
  e.season_id,
  e.title,
  min(es.session_date) as starts_on,
  max(es.session_date) as ends_on,
  count(distinct a.student_id) as student_count,
  sum(
    coalesce(
      a.hours_override,
      case when a.check_in_at is not null and a.check_out_at is not null
        then greatest(extract(epoch from
          (least(a.check_out_at, es.ends_at) - greatest(a.check_in_at, es.starts_at))) / 3600.0, 0)
      end,
      extract(epoch from (es.ends_at - es.starts_at)) / 3600.0
    )
  ) as total_hours
from events e
join event_sessions es on es.event_id = e.id and es.status = 'completed'
join attendance a on a.session_id = es.id and a.status in ('present', 'late')
where e.counts_volunteer_hours
group by e.id, e.season_id, e.title;

-- ---------------------------------------------------------------------------
-- 9. Per-student goal-projection inputs (confirmed + planned vs. goal).
--    Trap #4's "goal source: `seasons.default_goal_hours` +
--    `students.goal_hours_override` (both real)" -- `goal_hours` below is a
--    plain `coalesce`, not a re-derivation of anything already computed
--    elsewhere (no existing view exposes this specific coalesce; the ONLY
--    place it previously existed was `CoachHome.tsx`'s own pre-existing
--    `sumGoalHours` TS helper, which sums it in TS for its OWN unrelated
--    team-hours-goal bar and is left untouched by this migration). Percent-
--    of-goal / "N h short" text is deliberately NOT computed here -- that is
--    a plain two-number division/subtraction over these already-real,
--    already-SQL-sourced facts, the exact same "UI-side percent math, no
--    metric-view equivalent to duplicate" idiom `CoachHome.tsx`'s own
--    existing, already-shipped `hoursVsGoalPercent` already established in
--    this very file (module doc #4 there) -- `buildGoalProjectionRows` in
--    `dashboard.ts`/`CoachHome.tsx` follows the identical idiom for the new
--    per-student rows, not a second SQL view for a trivial division.
--
--    `team_id` here is `students.team_id`, the legacy/primary-team column
--    SCH-01's own migration (`20260721000000_student_teams.sql`) explicitly
--    leaves in place "as legacy/primary-team until every reader migrates" --
--    used here ONLY for the row's display badge (which team chip to render
--    next to a student's name), never for any rollup math in this view. A
--    dual-member student's projection row shows her PRIMARY team only; her
--    confirmed/planned/goal numbers are the same single-counted personal
--    values regardless (D-3 "personal numbers count once" — this view has
--    no `student_teams` join at all, so it cannot double a row by
--    membership even incidentally).
-- ---------------------------------------------------------------------------
create or replace view v_student_goal_projection as
select
  s.id as student_id,
  se.id as season_id,
  s.team_id,
  coalesce(s.goal_hours_override, se.default_goal_hours) as goal_hours,
  coalesce(sh.confirmed_hours, 0) as confirmed_hours,
  coalesce(sp.planned_hours, 0) as planned_hours
from students s
join seasons se on se.is_active
left join v_student_hours sh on sh.student_id = s.id and sh.season_id = se.id
left join v_student_planned_hours sp on sp.student_id = s.id and sp.season_id = se.id
where s.is_active;

-- ---------------------------------------------------------------------------
-- Activity feed (UXP-10) -- deliberately NO new view here, disclosed.
--
-- Trap #3's derivation ("`rsvps`/`attendance` rows + timestamps +
-- `responded_by`/`recorded_by` vs student profile -> self/staff labels") is
-- a plain equality comparison between two already-fetched foreign-key ids
-- (`rsvps.responded_by`/`attendance.recorded_by` vs. that student's own
-- `students.profile_id`), not arithmetic/aggregation -- the same category of
-- plain join/compare `CoachHome.tsx`'s own EXISTING `isEventInTeamScope`
-- (module doc #3/#8 there) already performs on raw table rows in
-- TypeScript, not a re-derivation of any metric-view formula.
-- `src/lib/supabase/loaders/dashboard.ts` queries `rsvps`/`attendance`/
-- `students`/`event_sessions`/`events` directly (same raw-row-join posture
-- `loaders/reports.ts`'s own `EventsTab`/`HoursTab` loaders already
-- established for this exact table set) and hands the raw rows to
-- `CoachHome.tsx`'s pure feed-building functions.
--
-- Hard-delete limitation (Trap #3, D-7): T119
-- (`src/lib/supabase/loaders/attendance.ts`, read-only reference) already
-- confirmed the coach checklist's un-mark path is a plain, unconditional
-- DELETE for both `rsvps` and `attendance` (D-7 "the checklist wins" rule) --
-- a row a coach un-checks leaves NO trace afterward. This migration does NOT
-- add a status-transition column or a tracking table to recover that history
-- (the packet's own explicit instruction: "do NOT add tracking tables") --
-- the feed is built from CURRENT rows only, so a coach-driven removal is
-- honestly invisible to the feed (never fabricated as a "dropped" entry),
-- while a student/parent's OWN self-service RSVP change
-- (`RsvpControl.tsx`/OUT-03, read-only reference) is a real status UPDATE
-- (`'going' -> 'declined'`/`'maybe'`), not a delete, so THAT kind of "drop"
-- remains genuinely feed-visible via the row's own `updated_at`. This
-- distinction and its honest limitation are disclosed again in
-- `dashboard.ts`'s own module doc, not silently assumed.
