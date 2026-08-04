-- T503 C4 snapshot: the three planned-hours views, read as the SAME
-- non-staff authenticated session (T503 Student One), in a deterministic
-- row order. Run once BEFORE the widening migration and once AFTER it;
-- the caller (run_t503_widen_rsvp_read.sh) diffs the two output files and
-- must find them byte-identical.
-- \o toggling keeps \pset's own confirmation lines, the SET/RESET command
-- tags, and the set_config() call's own return value OUT of the captured
-- file -- only the three views' rows (and the \echo markers) reach
-- stdout, so a before/after diff compares exactly the data the criterion
-- is about.
\o /dev/null
\pset format unaligned
\pset tuples_only on
\pset fieldsep ' | '
set role authenticated;
select set_config('request.jwt.claim.sub', '20000000-0000-4000-8000-200000000011', false);
\o

\echo === v_planned_rsvp_hours ===
select student_id, season_id, starts_at, planned_hours
from v_planned_rsvp_hours
order by student_id, starts_at;

\echo === v_student_planned_hours ===
select student_id, season_id, planned_hours
from v_student_planned_hours
order by student_id, season_id;

\echo === v_season_upcoming_committed_hours ===
select season_id, committed_hours_30d
from v_season_upcoming_committed_hours
order by season_id;

\o /dev/null
reset role;
\o
