-- ===========================================================================
-- GAM-479 -- the attendance un-mark stops being a row DELETE.
--
-- The chip cycle's `(unset)` stop used to call `makeRemoveAttendance`, an
-- unconditional `delete from attendance`. The deleted row carried
-- `check_in_at`, `check_out_at`, `hours_override`, `method` and `recorded_by`,
-- so one tap past `Absent` destroyed a QR check-in timestamp and a coach-set
-- hours override with nothing to recover them from -- the attendance audit
-- trigger was dropped by
-- `20260803000000_simplify_attendance_audit.sql:38-39`.
--
-- `20260822000000_attendance_unmarked_sentinel.sql` replaces the delete with a
-- fifth `attendance.status` value, `'unmarked'`. This file proves the two
-- things that has to be true for that to be safe:
--
--   1. the cleared row KEEPS the columns the delete destroyed (A4), and
--   2. both views that read `attendance` directly report a cleared row
--      EXACTLY as they reported a missing one (A5) -- i.e. the change is
--      invisible to T509/D014's explicit-marks denominator.
--
-- A6 runs the counterfactual in the other direction: it rebuilds both views
-- WITHOUT the `<> 'unmarked'` predicate and shows the numbers move. Without
-- A6, A5 would not establish that the migration's view edits do anything.
--
-- Every assertion is a post-write ROW/VIEW READ. Nothing here asserts the
-- shape of a statement.
-- ===========================================================================
\set ON_ERROR_STOP on
\pset pager off

-- (A1) The CHECK widening applied, and still names exactly five values.
select 'A1 check constraint text' as assertion,
       pg_get_constraintdef(oid) as actual
from pg_constraint where conname = 'attendance_status_check';

-- ---------------------------------------------------------------------------
-- Fixture. One team, two students, one participation-counting event with one
-- COMPLETED session. Student A is a plain `present` control that must never
-- move. Student B carries a real QR `check_in_at` AND a coach-set
-- `hours_override` -- the two values the old DELETE took with it.
--
-- Deletes first so the file is re-runnable against a live cluster.
-- ---------------------------------------------------------------------------
delete from attendance where session_id = '66666666-6666-6666-6666-666666666666';
delete from event_sessions where id = '66666666-6666-6666-6666-666666666666';
delete from events where id = '55555555-5555-5555-5555-555555555555';
delete from student_teams where team_id = '22222222-2222-2222-2222-222222222222';
delete from students where team_id = '22222222-2222-2222-2222-222222222222';
delete from teams where id = '22222222-2222-2222-2222-222222222222';
delete from seasons where id = '11111111-1111-1111-1111-111111111111';

insert into seasons (id, name, starts_on, ends_on, is_active)
  values ('11111111-1111-1111-1111-111111111111','GAM-479','2026-01-01','2026-12-31',true);
insert into teams (id, name, short_name, color)
  values ('22222222-2222-2222-2222-222222222222','T479','T479','#fff');
insert into students (id, display_name, team_id, is_active) values
  ('33333333-3333-3333-3333-333333333333','Stu A','22222222-2222-2222-2222-222222222222',true),
  ('44444444-4444-4444-4444-444444444444','Stu B','22222222-2222-2222-2222-222222222222',true);
insert into student_teams (student_id, team_id, joined_on) values
  ('33333333-3333-3333-3333-333333333333','22222222-2222-2222-2222-222222222222','2026-01-01'),
  ('44444444-4444-4444-4444-444444444444','22222222-2222-2222-2222-222222222222','2026-01-01');
insert into events (id, season_id, type, title, description, location_name, address,
                    counts_participation, counts_volunteer_hours)
  values ('55555555-5555-5555-5555-555555555555','11111111-1111-1111-1111-111111111111',
          'meeting','E479','','','',true,true);
insert into event_sessions (id, event_id, session_date, starts_at, ends_at, status, notes)
  values ('66666666-6666-6666-6666-666666666666','55555555-5555-5555-5555-555555555555',
          '2026-06-01','2026-06-01T18:00:00Z','2026-06-01T20:00:00Z','completed','');

insert into attendance (session_id, student_id, status, method, check_in_at, hours_override) values
  ('66666666-6666-6666-6666-666666666666','33333333-3333-3333-3333-333333333333','present','coach',null,null),
  ('66666666-6666-6666-6666-666666666666','44444444-4444-4444-4444-444444444444','absent','qr',
   '2026-06-01T18:03:00Z', 2.5);

-- (A2) The sentinel is accepted by the widened CHECK.
update attendance set status = 'unmarked'
 where student_id = '44444444-4444-4444-4444-444444444444';
select 'A2 sentinel accepted' as assertion, status as actual
from attendance where student_id = '44444444-4444-4444-4444-444444444444';

-- (A3) ...and the CHECK is still a real constraint: a sixth value is rejected.
--      Asserted by catching `check_violation` specifically -- an UPDATE blocked
--      by RLS would report `UPDATE 0` and raise nothing, so a bare
--      exception-catching test would prove the wrong thing here.
do $$
begin
  update attendance set status = 'bogus'
   where student_id = '44444444-4444-4444-4444-444444444444';
  raise exception 'A3 FAILED: a status outside the five was accepted';
exception when check_violation then
  raise notice 'A3 PASS: status outside the five rejected (check_violation)';
end $$;

-- (A4) THE CENTRAL CLAIM. The cleared row is still there, and still carries
--      the QR check-in timestamp and the coach-set hours override.
select 'A4 cleared row keeps its data' as assertion,
       status, check_in_at is not null as has_check_in, hours_override
from attendance where student_id = '44444444-4444-4444-4444-444444444444';

-- ---------------------------------------------------------------------------
-- (A5) A cleared row must be arithmetically INDISTINGUISHABLE from a missing
--      one. Snapshot both views with the sentinel present, DELETE that same
--      row, snapshot again, and require the two snapshots to be equal.
-- ---------------------------------------------------------------------------
create temp table snap_sentinel as
  select 'sp' as v, student_id::text as k, expected_ct as c1, present_ct as c2,
         excused_ct as c3, participation_pct as pct from v_student_participation
  union all
  select 'ea', event_id::text, held_ct, graded_marks_ct, excused_ct, attendance_pct
  from v_event_attendance where event_id = '55555555-5555-5555-5555-555555555555';

delete from attendance where student_id = '44444444-4444-4444-4444-444444444444';

create temp table snap_deleted as
  select 'sp' as v, student_id::text as k, expected_ct as c1, present_ct as c2,
         excused_ct as c3, participation_pct as pct from v_student_participation
  union all
  select 'ea', event_id::text, held_ct, graded_marks_ct, excused_ct, attendance_pct
  from v_event_attendance where event_id = '55555555-5555-5555-5555-555555555555';

do $$
begin
  if exists (
    (table snap_sentinel except all table snap_deleted)
    union all
    (table snap_deleted except all table snap_sentinel)
  ) then
    raise exception 'A5 FAILED: a cleared row reads differently from a missing row';
  end if;
  raise notice 'A5 PASS: cleared row and missing row are identical in both views';
end $$;

select 'A5 detail' as assertion, * from snap_sentinel order by v, k;

-- ---------------------------------------------------------------------------
-- (A6) The counterfactual. Restore the sentinel row, rebuild both views with
--      their PRE-GAM-479 bodies (no `<> 'unmarked'` predicate), and require
--      the numbers to MOVE. If they did not, the migration's view edits would
--      be decorative and A5 would prove nothing.
--
--      The whole block runs inside a transaction that is ROLLED BACK. DDL is
--      transactional in PostgreSQL, so the rollback restores the migration's
--      real view bodies. Without that this file leaves the cluster carrying
--      the broken views and a second run of A5 fails against its own
--      leftovers -- which is exactly what happened the first time it was
--      written.
-- ---------------------------------------------------------------------------
insert into attendance (session_id, student_id, status, method, check_in_at, hours_override)
  values ('66666666-6666-6666-6666-666666666666','44444444-4444-4444-4444-444444444444',
          'unmarked','qr','2026-06-01T18:03:00Z',2.5);

begin;

create or replace view v_student_participation as
with marked as (
  select s.id as student_id, st.team_id, e.season_id, a.status
  from students s
  join student_teams st on st.student_id = s.id and st.left_on is null
  join attendance a on a.student_id = s.id                      -- NO sentinel filter
  join event_sessions es on es.id = a.session_id and es.status = 'completed'
  join events e on e.id = es.event_id
    and e.counts_participation
    and (e.team_ids is null or st.team_id = any(e.team_ids))
  where s.is_active
)
select student_id, team_id, season_id,
  count(*) as expected_ct,
  count(*) filter (where status in ('present', 'late')) as present_ct,
  count(*) filter (where status = 'late')    as late_ct,
  count(*) filter (where status = 'excused') as excused_ct,
  case when count(*) - count(*) filter (where status = 'excused') = 0 then null
       else round(100.0 * count(*) filter (where status in ('present', 'late'))
            / (count(*) - count(*) filter (where status = 'excused')), 1) end as participation_pct
from marked group by student_id, team_id, season_id;

create or replace view public.v_event_attendance as
select e.id as event_id,
  count(distinct es.id) as held_ct,
  count(a.id) as graded_marks_ct,
  count(a.id) filter (where a.status = 'excused') as excused_ct,
  count(a.id) filter (where a.status in ('present', 'late')) as attended_marks_ct,
  case when count(a.id) - count(a.id) filter (where a.status = 'excused') = 0 then null
       else round(100.0 * count(a.id) filter (where a.status in ('present', 'late'))
            / (count(a.id) - count(a.id) filter (where a.status = 'excused')), 1) end as attendance_pct
from public.events e
left join public.event_sessions es on es.event_id = e.id and es.status = 'completed'
left join public.attendance a on a.session_id = es.id          -- NO sentinel filter
group by e.id;

create temp table snap_unfixed as
  select 'sp' as v, student_id::text as k, expected_ct as c1, present_ct as c2,
         excused_ct as c3, participation_pct as pct from v_student_participation
  union all
  select 'ea', event_id::text, held_ct, graded_marks_ct, excused_ct, attendance_pct
  from v_event_attendance where event_id = '55555555-5555-5555-5555-555555555555';

do $$
begin
  if not exists (
    (table snap_unfixed except all table snap_deleted)
    union all
    (table snap_deleted except all table snap_unfixed)
  ) then
    raise exception 'A6 FAILED: dropping the predicate changed nothing -- the view edits are decorative';
  end if;
  raise notice 'A6 PASS: the <> ''unmarked'' predicate is load-bearing in both views';
end $$;

-- Measured on PostgreSQL 16.13 against the full migration set, 2026-08-22:
--   v_event_attendance  attendance_pct  100.0 -> 50.0, graded_marks_ct 1 -> 2
--   v_student_participation           gains a phantom 0.0% row for student B
select 'A6 detail (unfixed views)' as assertion, * from snap_unfixed order by v, k;

-- Restores the migration's real view bodies and drops `snap_unfixed`.
rollback;

-- (A7) The rollback did what it claims: A5's equality holds again, against
--      the views the migration actually ships. This is what makes the file
--      re-runnable, and it re-proves A5 after A6 deliberately broke things.
delete from attendance where student_id = '44444444-4444-4444-4444-444444444444';

create temp table snap_restored as
  select 'sp' as v, student_id::text as k, expected_ct as c1, present_ct as c2,
         excused_ct as c3, participation_pct as pct from v_student_participation
  union all
  select 'ea', event_id::text, held_ct, graded_marks_ct, excused_ct, attendance_pct
  from v_event_attendance where event_id = '55555555-5555-5555-5555-555555555555';

do $$
begin
  if exists (
    (table snap_restored except all table snap_deleted)
    union all
    (table snap_deleted except all table snap_restored)
  ) then
    raise exception 'A7 FAILED: the rollback did not restore the shipped view bodies';
  end if;
  raise notice 'A7 PASS: shipped view bodies restored -- this file is re-runnable';
end $$;
