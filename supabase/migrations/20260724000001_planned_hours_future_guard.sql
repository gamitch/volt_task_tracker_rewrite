-- T128 (T124 NIT follow-up): planned-hours future guard.
--
-- `v_planned_rsvp_hours` (`20260723000001_dashboard_views.sql`, NEVER edited
-- by this file -- constitution item 10, "editing an applied migration file
-- -> BLOCKER") already carries a header comment describing itself as "one
-- row per qualifying ('going', future, hours-counting) RSVP" -- but the
-- shipped `where` clause never actually filters on `starts_at`, so a
-- 'scheduled' session whose `starts_at` has already passed (the coach never
-- marked the session 'completed'/'canceled') still counts as "planned" in
-- every downstream consumer. T124's own checker logged this exact gap as a
-- carried NIT ("`v_planned_rsvp_hours` counts scheduled-but-past sessions as
-- 'planned' -- tighten the header comment or add a `starts_at >= now()`
-- guard in a future cleanup", `docs/swarm/verification-log.md` T124 entry).
--
-- Rationale: a scheduled-but-past session is no longer a plannable
-- commitment -- it already happened (or should have); its hours belong in
-- "confirmed" once attendance is recorded, not in "planned" forever. This
-- migration closes that gap with the one predicate the NIT proposed:
-- `es.starts_at >= now()`.
--
-- ADDITIVE re-creation of the SAME view name in a NEW file (this repo's own
-- established pattern -- see `20260717000003_metric_views.sql`'s and
-- `20260722000000_membership_views.sql`'s own header notes, and this exact
-- migration's own precedent, `20260723000001_dashboard_views.sql` itself,
-- which re-created `v_team_hours` verbatim rather than editing
-- `20260722000000_membership_views.sql`). `create or replace view` requires
-- an IDENTICAL column list to the view being replaced -- the body below is
-- byte-for-byte the shipped `20260723000001_dashboard_views.sql` SELECT,
-- with exactly ONE added predicate (`es.starts_at >= now()`) in the `where`
-- clause and nothing else changed (constitution item 3: no other formula
-- token may drift).
--
-- Dependents (grep-verified against `20260723000001_dashboard_views.sql` --
-- these are the only two views that `select ... from v_planned_rsvp_hours`
-- directly; neither is re-created here since Postgres re-resolves an
-- existing view's dependency at query time, not at `create or replace`
-- time, so no cascading re-create is needed for either to pick up the new
-- predicate):
--   * `v_student_planned_hours` (personal per-student/season planned-hours
--     total, `sum(planned_hours) group by student_id, season_id`) -- a past
--     scheduled session's hours now correctly drop out of a student's
--     planned total.
--   * `v_season_upcoming_committed_hours` (season-wide 30-day window,
--     `where starts_at >= now() and starts_at < now() + interval '30 days'
--     group by season_id`) -- this view's OWN window predicate already
--     excludes anything before `now()`, so its output is unchanged by this
--     migration (a past session was never inside a future-only 30-day
--     window to begin with) -- scratch-verified below, not assumed.
--
-- One further, transitive (second-hop) consumer worth naming explicitly
-- since the worker packet calls it out by name: `v_student_goal_projection`
-- does NOT select from `v_planned_rsvp_hours` directly -- it selects from
-- `v_student_planned_hours` (`left join v_student_planned_hours sp on
-- sp.student_id = s.id and sp.season_id = se.id`), so it inherits this fix
-- transitively through that first-hop view, one join away. Scratch-verified
-- below along with the two direct dependents.
--
-- `loaders/dashboard.ts` / `CoachHome.tsx` consume
-- `v_season_upcoming_committed_hours` and `v_student_goal_projection` via
-- plain `.select('col, col, ...')` passthrough (explicit column lists, no
-- `select('*')`) -- since the column list of every view involved is
-- unchanged, no TypeScript type or query changes are needed here.

create or replace view v_planned_rsvp_hours as
select
  r.student_id,
  e.season_id,
  es.starts_at,
  extract(epoch from (es.ends_at - es.starts_at)) / 3600.0 as planned_hours
from rsvps r
join event_sessions es on es.id = r.session_id and es.status = 'scheduled'
join events e on e.id = es.event_id and e.counts_volunteer_hours
where r.status = 'going'
  and es.starts_at >= now();
