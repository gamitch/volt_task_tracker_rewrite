-- T801 SQL proof: the catalog comments written by
-- `20260805000000_dashboard_views_comment_corrections.sql` actually landed,
-- on all nine views and on the one column. Follows the T322/T205 precedent
-- (`volunteer_hours_outreach_only_assertions.sql`,
-- `t205_anon_grant_assertions.sql`): assertion `DO` blocks in one file, run
-- once after all migrations have applied.
--
-- **No fixture INSERTs.** Unlike its precedents, this file inserts nothing and
-- reads no application data: T801 is a comment-only correction, so there is no
-- row-level behaviour to construct or measure. Asserting against catalog
-- metadata is the whole of the proof.
--
-- **What this proves, stated narrowly so it is not over-read:** that each
-- comment exists and carries the load-bearing correction. It does NOT prove
-- the underlying RLS mechanism -- that was measured separately and lives at
-- `20260731000000_leaderboard_students_view.sql:32-46`. A comment can be
-- correct and still be a comment; this file only shows the text is in the
-- catalog where a reader will find it.
--
-- Result collection matches the precedent: every assertion records PASS/FAIL
-- into a temp table and the script raises ONCE at the end, so a run reports
-- the complete picture rather than aborting on the first failure. That keeps
-- "red on the right assertion" distinguishable from "red on the wrong one".

create temp table t801_results (assertion text, status text);

-- Assertion 1: all nine views carry the RLS correction, and it says the
-- views do NOT apply the caller's RLS. A comment that merely EXISTS is not
-- enough -- the substring check pins the direction of the claim, so a
-- comment reintroducing the original wrong text would fail here.
do $$
declare
  expected_views text[] := array[
    'v_planned_rsvp_hours',
    'v_student_planned_hours',
    'v_season_upcoming_committed_hours',
    'v_season_roster_stats',
    'v_season_session_days',
    'v_season_attendance_rate',
    'v_season_day_of_week_sessions',
    'v_event_student_hours',
    'v_student_goal_projection'
  ];
  v text;
  body text;
  missing text[] := array[]::text[];
begin
  foreach v in array expected_views loop
    select obj_description(c.oid, 'pg_class') into body
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where c.relname = v and n.nspname = 'public' and c.relkind = 'v';

    if body is null
       or body not like '%does NOT apply the querying session''s RLS%'
       or body not like '%security_invoker%' then
      missing := missing || v;
    end if;
  end loop;

  insert into t801_results values (
    'A1: all 9 dashboard_views views carry the RLS correction',
    case when cardinality(missing) = 0
         then 'PASS'
         else 'FAIL -- missing/wrong on: ' || array_to_string(missing, ', ')
    end);
end $$;

-- Assertion 2: the column comment names the SECOND reader. This is the
-- correction's whole point -- the original comment was wrong by omission, not
-- by stating a falsehood -- so the assertion pins the omitted fact rather than
-- mere presence of a comment.
do $$
declare
  body text;
begin
  select col_description(c.oid, a.attnum) into body
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  join pg_attribute a on a.attrelid = c.oid
  where c.relname = 'v_student_goal_projection'
    and n.nspname = 'public'
    and a.attname = 'team_id';

  insert into t801_results values (
    'A2: v_student_goal_projection.team_id comment names the second reader',
    case when body is not null
              and body like '%queryStudentGoalProjectionById%'
              and body like '%TWO readers%'
         then 'PASS'
         else 'FAIL -- got: ' || coalesce(left(body, 120), '<null>')
    end);
end $$;

-- Assertion 3: the column comment preserves the half of the original that was
-- CORRECT. A correction that quietly discards a true statement is its own
-- kind of inaccuracy, so this pins the rollup-math claim surviving.
do $$
declare
  body text;
begin
  select col_description(c.oid, a.attnum) into body
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  join pg_attribute a on a.attrelid = c.oid
  where c.relname = 'v_student_goal_projection'
    and n.nspname = 'public'
    and a.attname = 'team_id';

  insert into t801_results values (
    'A3: the still-true rollup-math half is preserved, not discarded',
    case when body like '%no student_teams join%'
         then 'PASS'
         else 'FAIL -- rollup-math clause absent'
    end);
end $$;

-- Assertion 4: the premise this whole task rests on -- that no view in this
-- schema sets `security_invoker` -- is still true at run time. If someone
-- later turns it on for any view, the corrections above become wrong and this
-- assertion is what says so, rather than the comments silently rotting the way
-- the ones being corrected did.
do $$
declare
  invoker_views text[];
begin
  select coalesce(array_agg(c.relname order by c.relname), array[]::text[])
  into invoker_views
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relkind = 'v'
    and c.reloptions is not null
    and exists (
      select 1 from unnest(c.reloptions) opt
      where opt like 'security_invoker=%' and opt not like '%=false'
    );

  insert into t801_results values (
    'A4: no public view sets security_invoker (the premise of A1)',
    case when cardinality(invoker_views) = 0
         then 'PASS'
         else 'FAIL -- security_invoker is ON for: ' || array_to_string(invoker_views, ', ')
    end);
end $$;

-- Report once, with every result, then fail if any assertion failed.
do $$
declare
  r record;
  failures int;
begin
  for r in select * from t801_results order by assertion loop
    raise notice '%: %', r.assertion, r.status;
  end loop;

  select count(*) into failures from t801_results where status <> 'PASS';
  if failures > 0 then
    raise exception 'T801: % of % assertion(s) FAILED (see notices above)',
      failures, (select count(*) from t801_results);
  end if;
  raise notice 'T801: all % assertions passed.', (select count(*) from t801_results);
end $$;
