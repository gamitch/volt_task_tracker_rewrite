-- Implementation note (accepted deviation from MET-01's 'while active' phrasing): activity is the current is_active boolean — deactivated students drop out of the views (ROS-09 history remains in base tables). NFR-03 fixtures test: excused-shrinks-denominator, hours_override-wins, check-in clamping to the session window, and the no-completed-sessions '—' case (expected_ct = 0 rows simply absent; UI renders '—').

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
join events e on e.id = es.event_id and e.counts_volunteer_hours
where a.status in ('present','late')
group by a.student_id, e.season_id;

create or replace view v_student_participation as
with expected as (
  select s.id as student_id, s.team_id, es.id as session_id, e.season_id
  from students s
  join events e on e.counts_participation
    and (e.team_ids is null or s.team_id = any(e.team_ids))
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

create or replace view v_team_participation as
select team_id, season_id,
  round(100.0 * sum(present_ct) / greatest(sum(expected_ct) - sum(excused_ct), 1), 1)
    as participation_pct
from v_student_participation
group by team_id, season_id;
