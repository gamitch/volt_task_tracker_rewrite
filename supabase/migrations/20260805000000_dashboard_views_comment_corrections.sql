-- T801: two wrong comments in `20260723000001_dashboard_views.sql`, corrected
-- WITHOUT editing that applied file. Constitution item 10 makes editing an
-- applied migration a BLOCKER, so the corrections land here instead, in a new
-- additive file -- the same route `20260804000000_volunteer_hours_outreach_
-- only.sql` took for the same constraint, and the same route
-- `20260731000000_leaderboard_students_view.sql:28-31` describes as "this
-- repo's own established convention". No existing migration file is edited.
--
-- **This migration changes no view definition and no data.** It writes catalog
-- comments only (`comment on view` / `comment on column`). Every statement
-- below is metadata; none rewrites a view, touches a row, or alters a policy.
--
-- Of T801's two named closure options, this is (a). Option (b) -- amending
-- item 10 to exempt comment-only edits -- is deliberately NOT taken here: it
-- changes a BLOCKER-class constitution rule, which is the owner's call, not a
-- change an implementation task should smuggle in. (a) needs no rule change.
--
-- **Disclosed limitation, because it is the honest weakness of option (a):**
-- a reader who opens `20260723000001_dashboard_views.sql` still sees the two
-- wrong `--` comments in place. Catalog comments are visible from `\d+` /
-- `obj_description()` / `col_description()`, and this file is visible to
-- anyone reading `supabase/migrations/` in timestamp order -- but neither
-- rewrites the original text, and item 10 is exactly the rule that forbids
-- doing so. Both wrong comments are quoted verbatim below so that a reader
-- who finds only this file still learns what was wrong and where.
--
-- **`comment on` has no prior use in this repo** (grep: zero occurrences
-- before this file). That is a new mechanism, introduced deliberately and
-- named here rather than slipped in.
--
-- ---------------------------------------------------------------------------
-- CORRECTION 1 -- `20260723000001_dashboard_views.sql:49-52`, the RLS claim.
--
-- What it says, verbatim:
--
--   "none of the views below are `security_definer`/`security_barrier`, so
--    each runs under the querying session's own RLS against its base tables"
--
-- **Wrong as written, and wrong in a way that matters.** `security_definer` is
-- a FUNCTION attribute; it is not the knob that governs a view. The view-level
-- knob is `security_invoker` (PG15+), which defaults **OFF**. A view with
-- `security_invoker` off executes as its OWNER, and base-table RLS is applied
-- against the OWNER, not the querying session -- so these views do NOT run
-- under the caller's RLS. The comment's conclusion is the opposite of the
-- behaviour.
--
-- Confirmed against this schema: `security_invoker` appears in
-- `supabase/` only inside comment prose (6 occurrences, all discussion), and
-- as a real `with (security_invoker = ...)` clause **zero times** -- so every
-- view in this schema, including all nine below, executes as its owner.
--
-- MEASURED, not reasoned: `20260731000000_leaderboard_students_view.sql:32-46`
-- records a live PGlite/PostgreSQL run against a non-superuser view owner
-- shaped like Supabase's migration-applying role, in which a student-role
-- session reading a view got every active student's row while the same session
-- reading the base table directly got exactly its own one row -- and a
-- `security_invoker=on` counterfactual collapsed it back to one. That is the
-- mechanism, proven, not assumed.
--
-- **No behaviour change and no security work is implied by this correction.**
-- T185 examined the exposure itself and closed no-change on the owner's
-- proportionality ruling (constitution item 25 rules this class of exposure
-- the intended outcome for the leaderboard; PRD 8.3 separately authorizes the
-- name half). This file corrects the DESCRIPTION only. Anyone reading it as a
-- newly-discovered vulnerability is reading it wrong.
--
-- ---------------------------------------------------------------------------
-- CORRECTION 2 -- `20260723000001_dashboard_views.sql:311-320`, the `team_id`
-- claim on `v_student_goal_projection`.
--
-- What it says, verbatim:
--
--   "used here ONLY for the row's display badge (which team chip to render
--    next to a student's name), never for any rollup math in this view"
--
-- **The rollup-math half is still true** and stays true: this view has no
-- `student_teams` join at all, so it cannot double a row by membership. T187
-- did not change that.
--
-- **The "ONLY" is what misleads.** It names one reader; there are two:
--
--   1. `loaders/dashboard.ts:387` -- the display badge the comment describes.
--   2. `loaders/students.ts:464` (`queryStudentGoalProjectionById`) -- selects
--      the same `team_id` into `StudentScope.teamId`, and **that reader once
--      used it for functional scoping.** That was the T187 defect: a
--      dual-team student was scoped to her PRIMARY team only. T187 fixed the
--      reader (it now resolves ACTIVE `student_teams` memberships), leaving
--      the column display-only in practice today.
--
-- So the comment is accurate about today and silent about the history that
-- makes the column risky. An editor trusting it cannot see that this exact
-- column already caused one scoping bug, and would have no reason to expect
-- that widening its use might cause another. `students.ts:434-443` carries
-- the full record on the TypeScript side; this makes it findable from SQL.
-- ---------------------------------------------------------------------------

-- Correction 1, applied to all nine views defined in that migration. The text
-- is intentionally identical on each -- it is one fact about one mechanism,
-- and paraphrasing it per view would invite the drift this task exists to fix.
comment on view v_planned_rsvp_hours is
  'Executes as this view''s OWNER and does NOT apply the querying session''s RLS to its base tables: no view in this schema sets security_invoker (PG15+), which defaults off. Corrects 20260723000001_dashboard_views.sql:49-52, which claims the opposite. Mechanism measured, not reasoned -- see 20260731000000_leaderboard_students_view.sql:32-46. Description fix only; no behaviour change, and no security finding is implied (T185 closed no-change on the exposure itself).';

comment on view v_student_planned_hours is
  'Executes as this view''s OWNER and does NOT apply the querying session''s RLS to its base tables: no view in this schema sets security_invoker (PG15+), which defaults off. Corrects 20260723000001_dashboard_views.sql:49-52, which claims the opposite. Mechanism measured, not reasoned -- see 20260731000000_leaderboard_students_view.sql:32-46. Description fix only; no behaviour change, and no security finding is implied (T185 closed no-change on the exposure itself).';

comment on view v_season_upcoming_committed_hours is
  'Executes as this view''s OWNER and does NOT apply the querying session''s RLS to its base tables: no view in this schema sets security_invoker (PG15+), which defaults off. Corrects 20260723000001_dashboard_views.sql:49-52, which claims the opposite. Mechanism measured, not reasoned -- see 20260731000000_leaderboard_students_view.sql:32-46. Description fix only; no behaviour change, and no security finding is implied (T185 closed no-change on the exposure itself).';

comment on view v_season_roster_stats is
  'Executes as this view''s OWNER and does NOT apply the querying session''s RLS to its base tables: no view in this schema sets security_invoker (PG15+), which defaults off. Corrects 20260723000001_dashboard_views.sql:49-52, which claims the opposite. Mechanism measured, not reasoned -- see 20260731000000_leaderboard_students_view.sql:32-46. Description fix only; no behaviour change, and no security finding is implied (T185 closed no-change on the exposure itself).';

comment on view v_season_session_days is
  'Executes as this view''s OWNER and does NOT apply the querying session''s RLS to its base tables: no view in this schema sets security_invoker (PG15+), which defaults off. Corrects 20260723000001_dashboard_views.sql:49-52, which claims the opposite. Mechanism measured, not reasoned -- see 20260731000000_leaderboard_students_view.sql:32-46. Description fix only; no behaviour change, and no security finding is implied (T185 closed no-change on the exposure itself).';

comment on view v_season_attendance_rate is
  'Executes as this view''s OWNER and does NOT apply the querying session''s RLS to its base tables: no view in this schema sets security_invoker (PG15+), which defaults off. Corrects 20260723000001_dashboard_views.sql:49-52, which claims the opposite. Mechanism measured, not reasoned -- see 20260731000000_leaderboard_students_view.sql:32-46. Description fix only; no behaviour change, and no security finding is implied (T185 closed no-change on the exposure itself).';

comment on view v_season_day_of_week_sessions is
  'Executes as this view''s OWNER and does NOT apply the querying session''s RLS to its base tables: no view in this schema sets security_invoker (PG15+), which defaults off. Corrects 20260723000001_dashboard_views.sql:49-52, which claims the opposite. Mechanism measured, not reasoned -- see 20260731000000_leaderboard_students_view.sql:32-46. Description fix only; no behaviour change, and no security finding is implied (T185 closed no-change on the exposure itself).';

comment on view v_event_student_hours is
  'Executes as this view''s OWNER and does NOT apply the querying session''s RLS to its base tables: no view in this schema sets security_invoker (PG15+), which defaults off. Corrects 20260723000001_dashboard_views.sql:49-52, which claims the opposite. Mechanism measured, not reasoned -- see 20260731000000_leaderboard_students_view.sql:32-46. Description fix only; no behaviour change, and no security finding is implied (T185 closed no-change on the exposure itself).';

comment on view v_student_goal_projection is
  'Executes as this view''s OWNER and does NOT apply the querying session''s RLS to its base tables: no view in this schema sets security_invoker (PG15+), which defaults off. Corrects 20260723000001_dashboard_views.sql:49-52, which claims the opposite. Mechanism measured, not reasoned -- see 20260731000000_leaderboard_students_view.sql:32-46. Description fix only; no behaviour change, and no security finding is implied (T185 closed no-change on the exposure itself).';

-- Correction 2, on the column itself, where a reader inspecting the view will
-- actually meet it.
comment on column v_student_goal_projection.team_id is
  'Legacy/primary-team column (students.team_id). TWO readers, not one: loaders/dashboard.ts:387 renders it as a display badge, and loaders/students.ts:464 (queryStudentGoalProjectionById) selects it into StudentScope.teamId. That second reader ONCE USED IT FOR FUNCTIONAL SCOPING, which was the T187 defect -- a dual-team student was scoped to her primary team only. T187 fixed the reader (ACTIVE student_teams memberships); the column is display-only in practice today, but it has already caused one scoping bug. Corrects 20260723000001_dashboard_views.sql:311-320, which says "used here ONLY for the row''s display badge" and names one reader. The rollup-math half of that comment remains true: this view has no student_teams join and cannot double a row by membership.';
