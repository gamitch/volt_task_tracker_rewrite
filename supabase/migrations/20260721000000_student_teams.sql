-- T113: PRD v2 SCH-01 -- multi-team membership junction (the B2 schema
-- foundation: a student may belong to more than one team, e.g. a P3/Gear
-- Girls student who is also counted on a VOLT team -- org ground truth in
-- docs/backlog.html Sec.1).
--
-- Additive migration only. Creates one new table, `student_teams`, and
-- backfills it in the same migration from the existing
-- `public.students.team_id` column (20260716000000_identity_roster.sql).
-- `students.team_id` itself is NOT touched -- no drop, no nullability
-- change, no comment edit on that shipped migration. It remains the
-- legacy/primary-team read path until a later SCH-03+ packet migrates
-- readers over to this junction (PRD v2 Sec.3 SCH-01).
--
-- Shape follows the worker packet's recommended default verbatim: a plain
-- membership row keyed on (student_id, team_id), no history ledger. Per PRD
-- v2 Sec.8's simplicity principle, re-joining a team after leaving is a
-- future UPDATE of `left_on` back to null, not a new row -- "we are not
-- building an audit trail nobody asked for."
create table public.student_teams (
  student_id uuid not null references public.students (id) on delete cascade,
  team_id uuid not null references public.teams (id) on delete restrict,
  joined_on date not null default current_date,
  left_on date,
  created_at timestamptz not null default now(),
  primary key (student_id, team_id)
);

-- Backfill: every existing student's current primary team becomes their
-- first (and, pre-this-migration, only) membership row. `students.team_id`
-- is `not null` (verified directly against 20260716000000_identity_roster.sql),
-- so no null-handling is required here. This migration file runs at most
-- once per database (Supabase's migration-history bookkeeping), so an
-- `on conflict` guard is deliberately omitted -- a second run against the
-- same database is not a scenario this backfill needs to tolerate, and
-- adding one would silently mask a real double-apply bug instead of
-- surfacing it.
insert into public.student_teams (student_id, team_id)
select id, team_id from public.students;

-- ---------------------------------------------------------------------------
-- RLS -- investigated against the two closest precedents already in this
-- schema (20260717000002_rls.sql) before choosing:
--
--   * `teams`: reference/roster-shaped data, no PII beyond names/colors --
--     `read_all` (any authenticated session) + `staff_all` (is_staff()) for
--     writes.
--   * `students`: PII-bearing (real display names of minors), so it is
--     deliberately NOT `read_all` -- only `staff_all` + `own_or_linked_read`
--     (via `my_student_ids()`) directly on the table. That migration's own
--     comments state broader teammate visibility (e.g. for the leaderboard)
--     is intentionally left to be closed by metric/leaderboard VIEWS, not by
--     widening the base table's own SELECT policy -- explicitly to avoid a
--     self-referential-subquery recursion hazard on `students` itself.
--
-- `student_teams` holds only two foreign-key ids and two dates -- no name, no
-- other PII; the pairing of "this student id plays for this team id" is not
-- sensitive in the way a display name is, and is exactly the kind of
-- non-sensitive reference/roster fact `teams` itself already exposes via
-- `read_all`. It is also the join target every future SCH-03 metric view
-- (`v_student_hours`, `v_student_participation`, etc.) will need to traverse,
-- for every authenticated role (student, parent, coach, admin), to compute
-- D-3's per-team, dual-member-inclusive rollups. NOTE ON MECHANISM, stated
-- honestly rather than guessed: whether those views run under the invoking
-- session's own RLS or the view-owning role's is a Postgres/Supabase
-- platform detail this migration does not need to resolve to make this
-- table's own policy choice correct -- if the view owner bypasses RLS
-- (typical for a role applying migrations), this table's policy choice is
-- moot for the views themselves either way; if the views instead run as
-- security-invoker (querying-session RLS applies), a `staff_all`-only SELECT
-- policy here would silently zero out every non-staff row in any such join,
-- breaking every non-staff role's own rollup. `read_all` is therefore the
-- decision that is correct under either mechanism, not just one. Decision:
-- mirror `teams` exactly -- `staff_all` (is_staff()) for all writes,
-- `read_all` (any authenticated session) for select. No self-referential
-- subquery on `student_teams` is introduced by this choice (both policies
-- below only ever call `is_staff()`, a SECURITY DEFINER helper against
-- `profiles`, or `true`), so this carries none of the recursion hazard the
-- `students` table's comments warn about.
-- ---------------------------------------------------------------------------
alter table public.student_teams enable row level security;

create policy staff_all on student_teams
  for all to authenticated
  using (is_staff()) with check (is_staff());

create policy read_all on student_teams
  for select to authenticated using (true);
