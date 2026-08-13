-- GAM-299 (T806): `events` / `event_sessions` RLS scoped event visibility by
-- the legacy single-team column `students.team_id`, so a student who is an
-- ACTIVE member of two teams never received their SECOND team's events. The
-- page (`StudentHome`, T187) and all four consuming views already moved to
-- ACTIVE `student_teams` memberships (`left_on is null`); RLS was the last
-- unmigrated reader, so an event scoped to a dual-team student's second team
-- passed the page's scope test and was then filtered out by RLS before it
-- reached the browser, with nothing on screen indicating rows were missing.
--
-- MEASURED, not read (the issue's own text records that its claim had never
-- been executed): on a scratch PostgreSQL 16 cluster carrying these
-- migrations, a student with `students.team_id` = A and ACTIVE memberships in
-- A and B saw 0 of the 1 event scoped to `team_ids = {B}`, and 0 of its
-- sessions, while an admin and a coach saw every row.
--
-- ---------------------------------------------------------------------------
-- ADDITIVE ONLY (constitution item 10). This migration creates a SECOND,
-- permissive `select` policy on each of `events` and `event_sessions`. The
-- shipped `own_or_linked_read` policies (`20260717000002_rls.sql:153-161` and
-- `:180-189`) are left byte-for-byte intact, and so is `staff_all` on both
-- tables. Postgres ORs permissive policies together, so this migration can
-- only ever ADD visibility -- no mistake in the policies below can remove a
-- row a student can see today. Same shape, and for the same reason, as
-- `20260804000001_widen_rsvp_read_all_authenticated.sql:7-14`.
--
-- Constitution item 3: nothing here is a re-derivation of PRD 8.4 text. PRD
-- 8.4 contains no `events` policy at all (only the three canonical shapes and
-- the three `security definer` helpers, which are untouched). PRD 8.3's matrix
-- row -- "events/sessions | student: read team-scoped" -- is unchanged in
-- shape: what moves is the definition of "their team", from the legacy column
-- to active memberships. PRD v2 SCH-01
-- (`docs/swarm/VOLT_Portal_PRD_v2.md:160-165`) authorises exactly that move
-- (`team_id` "remains as legacy/primary-team until every reader migrates"),
-- and the owner's ruling D018 (`docs/swarm/auto-mode-decisions.md:4128-4130`,
-- 2026-08-06) is verbatim: "it has to be multi-team."
--
-- Constitution item 16: this migration ships UNAPPLIED. CI applies it to a
-- disposable scratch cluster (`tests/rls/run.sh`); that is not cutover.
--
-- ---------------------------------------------------------------------------
-- TWO COUPLINGS THIS POLICY DEPENDS ON. Both were measured in both
-- directions. Narrowing EITHER of the two read policies named below will
-- silently change event visibility, so they are named here rather than left to
-- be rediscovered.
--
--   1. `student_teams`' `read_all ... using (true)`
--      (`20260721000000_student_teams.sql:86-87`). RLS on `student_teams` IS
--      evaluated inside these policy expressions -- a subquery on another
--      table does not bypass that table's own RLS. Measured, same cluster,
--      only that policy changing:
--
--          who                  | sees_event_b | sees_session_b
--        ----------------------+--------------+----------------
--         dual, read_all=false |            0 |              0   <- collapses
--         dual, read_all=true  |            1 |              1
--
--      The GRANT question resolves the other way and does so loudly rather
--      than silently: `revoke select on student_teams from authenticated`
--      makes `select count(*) from events` raise "permission denied for table
--      student_teams". Production must already carry that grant, because T187
--      reads `student_teams` from the browser as `authenticated`
--      (`src/lib/supabase/loaders/students.ts:486-487`) and `StudentHome`
--      works.
--
--   2. `students`' OWN RLS (`20260717000002_rls.sql:96-102`: `staff_all` +
--      `own_or_linked_read`). The `students` table in the `exists` below is
--      not decoration and is not merely a join to reach `student_teams`: it is
--      what denies a profile-less ("orphan") authenticated session. Measured
--      under such a session on this repo's own fixture, `select count(*) from
--      students` is 0 while `select count(*) from student_teams` returns EVERY
--      row in that table (4 of 4) -- so removing `students`
--      from these policies (even while keeping `s.id in (select
--      my_student_ids())` elsewhere) would hand every orphan session every
--      event whose `team_ids` names any team with an active membership
--      (measured: 0 -> 2 events, 0 -> 2 sessions on the test fixture). Keep
--      both the `students` join AND the `my_student_ids()` test.
--
-- ---------------------------------------------------------------------------
-- WHAT THIS ROUTE GIVES UP -- TWO configurations, stated plainly rather than
-- discovered later. Because the shipped `own_or_linked_read` policies stay
-- live and keep granting by `students.team_id`, this migration does not
-- REMOVE any grant that column produces. Two states therefore keep a grant
-- that a memberships-only policy would deny:
--
--   (a) LEFT TEAM THAT IS ALSO THE LEGACY TEAM. A student whose membership in
--       a team is `left_on`-set AND whose `students.team_id` still names that
--       same team keeps seeing that team's events, via the shipped policy.
--       (Measured: such a student still sees that team's event.)
--
--   (b) RE-TEAMED STUDENT -- AND THE APPLICATION ACTUALLY PRODUCES THIS ONE.
--       READ THIS FIRST: (b) IS NOT SOMETHING THIS ROUTE GIVES UP. It is a
--       consequence of the stale backfill data, and it survives EVERY policy
--       shape available. Measured by `boss-arbiter` (D019 §4) on a real
--       cluster, rows visible to a re-teamed student, events / sessions:
--
--         route                                  former team | current team
--         shipped only (before this migration)      0 / 0    |    1 / 1
--         shipped + additive (THIS migration)       1 / 1    |    1 / 1
--         memberships-only + bridge (rejected)      1 / 1    |    0 / 0
--
--       The rejected alternative grants the former team TOO -- a stale row
--       reads `left_on is null`, and no policy can tell it from a live
--       membership -- and additionally DENIES this student their CURRENT
--       team's events. So the fix exists only at the writer (GAM-340), never
--       in the policy. It is recorded under this heading because that is where
--       a reader will look for it, not because a different policy would help.
--
--       The only write path, `src/lib/supabase/loaders/students.ts`, updates
--       `students.team_id` and never writes `student_teams` (no writer exists
--       anywhere in `src/`, `supabase/functions/`, `scripts/`, or any
--       migration except the one-time backfill at
--       `20260721000000_student_teams.sql:37`; ruling D018 records the drift
--       as already present in real data). So a student moved from team A to
--       team B has `students.team_id` = B while the backfill row for A is
--       still `left_on is null`. The policies below therefore treat A as an
--       ACTIVE membership, and THE STUDENT GAINS READ OF THEIR FORMER TEAM'S
--       EVENTS AND SESSIONS -- visibility that does not exist today (measured:
--       0 -> 1 on both tables).
--
--   Neither is a security finding under constitution item 25 (a former
--   teammate seeing a meeting list on a ~20-student volunteer robotics portal
--   whose dashboard already shows every student's hours to every student), and
--   neither changes any metric: `v_student_participation` already counts that
--   same stale membership (`20260806000000_met01_explicit_marks.sql:109`), so
--   (b) makes RLS agree with the participation numbers the student is already
--   shown.
--
--   BOTH ARE CLOSED BY THE SAME TRIGGER: when a `student_teams` writer ships,
--   it fixes (b) at the source and unblocks dropping the legacy
--   `own_or_linked_read` policies on `events` and `event_sessions`, which
--   fixes (a). Dropping them additionally requires adding `student_teams` rows
--   to `tests/rls/seed.sql`, because the existing fixture students have none
--   (the backfill runs at migration time, before any seed) and would otherwise
--   lose all event visibility. That follow-up is filed as GAM-340, not left in
--   this comment (constitution item 20). GAM-340 also records why it is a new
--   row: GAM-299's text names T705 as "the open row for that missing writer",
--   but T705 is GAM-298 and it reads Done while no writer exists, so the owner
--   may prefer to reopen GAM-298 and close GAM-340 as a duplicate.
--
--   A second, narrower follow-up is GAM-341: removing the `my_student_ids()`
--   test from the policies below currently leaves the assertion suite green,
--   because `students`' own RLS (coupling 2) already does that filtering. That
--   is an equivalent mutation today and a real hole if `students`' read policy
--   is ever widened, which `20260717000002_rls.sql:90-92` anticipates.
--
-- ---------------------------------------------------------------------------
-- PERFORMANCE, disclosed rather than discovered: this route STACKS a subplan
-- on top of the shipped one rather than replacing it -- the plan reads
-- `Filter: (is_staff() OR (SubPlan 2) OR (SubPlan 4))`, and the new subplan
-- runs for every row the shipped one rejects (`SubPlan 4 ... loops=250` at 500
-- events, where the shipped subplan rejects half). This is a REGRESSION and it
-- is accepted at this scale, not waved away. Measured, same cluster, same
-- query, only the policy set changing, `select count(*) from events` as the
-- dual-team student, three runs each:
--   20,004 events  shipped alone ~0.99-1.05 s -> shipped+additive ~1.39-1.46 s
--     500 events   shipped alone ~23-25 ms    -> shipped+additive ~32-35 ms
-- i.e. about +40%, and about +9 ms at the scale this team actually runs at.
-- (The premise gate measured the same experiment as +57% / +22 ms on slower
-- hardware; the direction and the cause reproduce, the absolute numbers are
-- machine-dependent.)
--
-- No `team_ids is null` branch is needed here: the shipped policies already
-- cover global events, including their deliberate deviation that a caller
-- needs at least one linked student for ANY event, documented at
-- `20260717000002_rls.sql:133-145` (events) and `:176-179` (event_sessions).
--
-- Coverage: `tests/rls/gam299_seed.sql` + `tests/rls/gam299_assertions.sql`,
-- run by `tests/rls/run.sh` (already wired into `.github/workflows/ci.yml`'s
-- `sql` job).
-- ---------------------------------------------------------------------------

create policy active_membership_read on events
  for select to authenticated
  using (
    exists (
      select 1 from students s
      join student_teams st on st.student_id = s.id and st.left_on is null
      where s.id in (select my_student_ids())
        and st.team_id = any(events.team_ids)
    )
  );

create policy active_membership_read on event_sessions
  for select to authenticated
  using (
    exists (
      select 1 from events e
      join students s on s.id in (select my_student_ids())
      join student_teams st on st.student_id = s.id and st.left_on is null
      where e.id = event_sessions.event_id
        and st.team_id = any(e.team_ids)
    )
  );
