-- GAM-299 (T806) assertions: `events` / `event_sessions` visibility must
-- follow ACTIVE `student_teams` memberships (`left_on is null`), not only the
-- legacy `students.team_id` column.
--
-- Run by `tests/rls/run.sh` against the fixture data in
-- `tests/rls/gam299_seed.sql`, AFTER `tests/rls/seed.sql` and
-- `tests/rls/assertions.sql` have already been loaded and run -- so nothing
-- here can move a pre-existing case's count or expected value.
--
-- Method is `tests/rls/assertions.sql`'s, unchanged: each scenario runs in its
-- own `begin; set local role authenticated; set local request.jwt.claim.sub =
-- '<uuid>'; ... rollback;` block (per `tests/rls/auth_stub.sql`'s `auth.uid()`
-- implementation), captures counts client-side with `\gset`, and the final
-- PASS/FAIL report compares the captured variables back under the superuser
-- role. `rollback` restores the superuser role for the next scenario and
-- guarantees no scenario can write.
--
-- DIFFERENCE FROM `tests/rls/assertions.sql`, stated rather than left to be
-- noticed: that file asserts on unqualified `select count(*) from <table>`,
-- because its question is "does this session see ANY row". This file's
-- question is "does this session see THIS row", so most scenarios below count
-- a single fixture row by id. RLS is still the only thing that can make the
-- answer 0 -- the row provably exists (the superuser totals captured first
-- include it) -- and the orphan scenario (criterion 4) deliberately keeps the
-- unqualified, WHERE-less form.
--
-- Each case below is tied to one of this task's acceptance criteria and to the
-- mutation that must turn it red; the mutations were run, and their real
-- output is in the completion report:
--
--   C1 dual-team student receives BOTH teams' events   -- red if the new
--      `active_membership_read` policy is dropped.
--   C2 membership-less student is not made worse off   -- red if the shipped
--      `own_or_linked_read` policy on `events` is dropped.
--   C3 a LEFT team stops granting access               -- red if
--      `st.left_on is null` is dropped from the new policy.
--   C4 a profile-less session still sees zero rows,
--      including for `team_ids is null` events         -- red if the
--      `students` table is removed from the new policy entirely (NOT if
--      `s.id in (select my_student_ids())` alone is dropped: `students`' own
--      RLS denies the orphan independently, so that mutation stays green --
--      measured, and recorded here so nobody re-derives it).
--   C5 `events` and `event_sessions` stay in agreement -- red if one policy is
--      changed and not the other.
--   C6 staff visibility is unchanged                   -- red if `staff_all`
--      is scoped by membership.

-- ---------------------------------------------------------------------------
-- Superuser totals, captured BEFORE any impersonation. These are the "every
-- row that exists" figures criterion 6 compares staff against, so that case
-- asserts "staff see everything" rather than "staff see the number 4".
-- ---------------------------------------------------------------------------
select count(*) as all_events_ct from events \gset
select count(*) as all_sessions_ct from event_sessions \gset

-- ---------------------------------------------------------------------------
-- Scenario D (C1, C5) -- the DUAL-TEAM student. `students.team_id` = Alpha,
-- ACTIVE memberships in Alpha AND Bravo. The Bravo event/session is the row
-- this whole issue is about: today's shipped policy filters it out.
-- ---------------------------------------------------------------------------
begin;
set local role authenticated;
set local request.jwt.claim.sub = 'c2990000-0000-0000-0000-000000000001';
select count(*) as dual_ev_alpha from events where id = 'c2990000-0000-0000-0000-0000000000e1' \gset
select count(*) as dual_ev_bravo from events where id = 'c2990000-0000-0000-0000-0000000000e2' \gset
select count(*) as dual_ev_global from events where id = 'c2990000-0000-0000-0000-0000000000e3' \gset
select count(*) as dual_se_alpha from event_sessions where id = 'c2990000-0000-0000-0000-0000000000f1' \gset
select count(*) as dual_se_bravo from event_sessions where id = 'c2990000-0000-0000-0000-0000000000f2' \gset
select count(*) as dual_se_global from event_sessions where id = 'c2990000-0000-0000-0000-0000000000f3' \gset
rollback;

-- ---------------------------------------------------------------------------
-- Scenario N (C2, C5) -- the MEMBERSHIP-LESS student. `students.team_id` =
-- Alpha and no `student_teams` row at all. Everything they can see today comes
-- from the shipped `own_or_linked_read` policy, and the additive route must
-- leave every one of those grants exactly where it was.
-- ---------------------------------------------------------------------------
begin;
set local role authenticated;
set local request.jwt.claim.sub = 'c2990000-0000-0000-0000-000000000002';
select count(*) as nomem_ev_alpha from events where id = 'c2990000-0000-0000-0000-0000000000e1' \gset
select count(*) as nomem_ev_bravo from events where id = 'c2990000-0000-0000-0000-0000000000e2' \gset
select count(*) as nomem_ev_global from events where id = 'c2990000-0000-0000-0000-0000000000e3' \gset
select count(*) as nomem_se_alpha from event_sessions where id = 'c2990000-0000-0000-0000-0000000000f1' \gset
select count(*) as nomem_se_bravo from event_sessions where id = 'c2990000-0000-0000-0000-0000000000f2' \gset
select count(*) as nomem_se_global from event_sessions where id = 'c2990000-0000-0000-0000-0000000000f3' \gset
rollback;

-- ---------------------------------------------------------------------------
-- Scenario L (C3, C5) -- the LEFT-TEAM student. `students.team_id` = Alpha,
-- ACTIVE membership in Alpha, membership in Bravo with `left_on` SET. Bravo's
-- event and session must stay invisible; Alpha's must not.
-- ---------------------------------------------------------------------------
begin;
set local role authenticated;
set local request.jwt.claim.sub = 'c2990000-0000-0000-0000-000000000003';
select count(*) as leftteam_ev_alpha from events where id = 'c2990000-0000-0000-0000-0000000000e1' \gset
select count(*) as leftteam_ev_bravo from events where id = 'c2990000-0000-0000-0000-0000000000e2' \gset
select count(*) as leftteam_se_alpha from event_sessions where id = 'c2990000-0000-0000-0000-0000000000f1' \gset
select count(*) as leftteam_se_bravo from event_sessions where id = 'c2990000-0000-0000-0000-0000000000f2' \gset
rollback;

-- ---------------------------------------------------------------------------
-- Scenario O (C4, C5) -- the profile-less ORPHAN session, reused from
-- `tests/rls/seed.sql` (a real `auth.users` row with no `profiles` row
-- anywhere). Unqualified counts, so this asserts zero rows across EVERY event
-- and session in the database -- which now includes a `team_ids is null`
-- (global) event and its session, the half of criterion 4 that no mutation of
-- the NEW policy can redden because the shipped policy carries it.
-- ---------------------------------------------------------------------------
begin;
set local role authenticated;
set local request.jwt.claim.sub = '30000000-0000-0000-0000-000000000099';
select count(*) as orphan_ev_total from events \gset
select count(*) as orphan_se_total from event_sessions \gset
rollback;

-- ---------------------------------------------------------------------------
-- Scenario S (C6) -- ADMIN and COACH. `staff_all` is untouched by this
-- migration and both must still see every row that exists.
-- ---------------------------------------------------------------------------
begin;
set local role authenticated;
set local request.jwt.claim.sub = 'c2990000-0000-0000-0000-000000000004';
select count(*) as admin_ev_total from events \gset
select count(*) as admin_se_total from event_sessions \gset
rollback;

begin;
set local role authenticated;
set local request.jwt.claim.sub = 'c2990000-0000-0000-0000-000000000005';
select count(*) as coach_ev_total from events \gset
select count(*) as coach_se_total from event_sessions \gset
rollback;

-- ---------------------------------------------------------------------------
-- Final PASS/FAIL report (back under the superuser role -- this only reads the
-- psql variables captured above).
--
-- The C5 rows compare a measured `events` figure against the measured
-- `event_sessions` figure for the same persona and the same event: they assert
-- AGREEMENT, and go red exactly when one policy is changed and the other is
-- not. The absolute-value rows above them are what catch a change that moves
-- both tables together.
-- ---------------------------------------------------------------------------
select
  case_name,
  expected,
  actual,
  case when expected = actual then 'PASS' else 'FAIL' end as result
from (
  values
    -- C1 -- the defect itself
    ('C1-dual-sees-team-b-event',              '1', :'dual_ev_bravo'),
    ('C1-dual-sees-team-b-session',            '1', :'dual_se_bravo'),
    ('C1-dual-sees-team-a-event',              '1', :'dual_ev_alpha'),
    ('C1-dual-sees-team-a-session',            '1', :'dual_se_alpha'),
    ('C1-dual-sees-global-event',              '1', :'dual_ev_global'),
    ('C1-dual-sees-global-session',            '1', :'dual_se_global'),
    -- C2 -- membership-less student not made worse off
    ('C2-nomembership-sees-legacy-team-event',   '1', :'nomem_ev_alpha'),
    ('C2-nomembership-sees-legacy-team-session', '1', :'nomem_se_alpha'),
    ('C2-nomembership-sees-global-event',        '1', :'nomem_ev_global'),
    ('C2-nomembership-sees-global-session',      '1', :'nomem_se_global'),
    ('C2-nomembership-denied-team-b-event',      '0', :'nomem_ev_bravo'),
    ('C2-nomembership-denied-team-b-session',    '0', :'nomem_se_bravo'),
    -- C3 -- a left team stops granting access
    ('C3-leftteam-denied-team-b-event',        '0', :'leftteam_ev_bravo'),
    ('C3-leftteam-denied-team-b-session',      '0', :'leftteam_se_bravo'),
    ('C3-leftteam-keeps-active-team-event',    '1', :'leftteam_ev_alpha'),
    ('C3-leftteam-keeps-active-team-session',  '1', :'leftteam_se_alpha'),
    -- C4 -- profile-less session still sees nothing, global events included
    ('C4-orphan-events-zero-rows',             '0', :'orphan_ev_total'),
    ('C4-orphan-sessions-zero-rows',           '0', :'orphan_se_total'),
    -- C5 -- events and event_sessions agree, persona by persona
    ('C5-agree-dual-team-a',        :'dual_ev_alpha',     :'dual_se_alpha'),
    ('C5-agree-dual-team-b',        :'dual_ev_bravo',     :'dual_se_bravo'),
    ('C5-agree-dual-global',        :'dual_ev_global',    :'dual_se_global'),
    ('C5-agree-nomembership-team-a', :'nomem_ev_alpha',   :'nomem_se_alpha'),
    ('C5-agree-nomembership-team-b', :'nomem_ev_bravo',   :'nomem_se_bravo'),
    ('C5-agree-nomembership-global', :'nomem_ev_global',  :'nomem_se_global'),
    ('C5-agree-leftteam-team-a',    :'leftteam_ev_alpha', :'leftteam_se_alpha'),
    ('C5-agree-leftteam-team-b',    :'leftteam_ev_bravo', :'leftteam_se_bravo'),
    ('C5-agree-orphan-totals',      :'orphan_ev_total',   :'orphan_se_total'),
    -- C6 -- staff visibility unchanged (compared against what actually exists)
    ('C6-admin-sees-all-events',    :'all_events_ct',     :'admin_ev_total'),
    ('C6-admin-sees-all-sessions',  :'all_sessions_ct',   :'admin_se_total'),
    ('C6-coach-sees-all-events',    :'all_events_ct',     :'coach_ev_total'),
    ('C6-coach-sees-all-sessions',  :'all_sessions_ct',   :'coach_se_total')
) as t(case_name, expected, actual)
order by case_name;
