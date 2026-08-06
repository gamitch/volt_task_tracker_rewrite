-- T700 SQL guard: no `public` view may be BOTH auto-updatable AND write-granted
-- to `anon`/`authenticated`.
--
-- This is a STANDING GUARD, not a bug fix. T205 already closed the single
-- instance that existed (`v_leaderboard_students`). This file exists so a
-- future single-table view cannot silently reintroduce the class.
--
-- ---------------------------------------------------------------------------
-- The mechanism, recorded because it is genuinely non-obvious:
--
--   1. A view with no `security_invoker` (PG15+, defaults OFF) executes as its
--      OWNER. On Supabase that owner is a `BYPASSRLS` role, so RLS on the base
--      table does not constrain what the view can do.
--   2. If the view is also SIMPLE -- one table, no aggregate, no join,
--      no DISTINCT/GROUP BY -- Postgres makes it AUTO-UPDATABLE
--      (`information_schema.views.is_updatable = YES`).
--   3. Supabase's stock `alter default privileges ... grant all on tables to
--      anon, authenticated, service_role` then hands every role
--      INSERT/UPDATE/DELETE *through* that view.
--
-- All three together mean an unauthenticated caller can write to a table it
-- cannot even read. Measured on PostgreSQL 16.13 while scoping T205: as
-- `anon`, `delete from public.v_leaderboard_students` returned `DELETE 2` and
-- emptied `students`, while the base table correctly denied the same session.
--
-- Aggregating or joining a view removes the hazard by construction -- that is
-- why 15 of the 16 views surveyed were never at risk. This guard therefore
-- fires ONLY on the narrow combination that is actually dangerous, rather than
-- banning simple views outright.
-- ---------------------------------------------------------------------------
--
-- **What this guard does NOT prove:** that RLS is correct anywhere, or that a
-- read-only view is safe to expose. It proves one specific write-path hole is
-- absent. `tests/rls/assertions.sql` covers read denial; this covers writes
-- through auto-updatable views. Neither substitutes for the other.

create temp table t700_results (assertion text, status text);

-- Assertion 1: the guard itself. Any public view that is auto-updatable AND
-- carries INSERT/UPDATE/DELETE for anon or authenticated is a finding.
do $$
declare
  offenders text[];
begin
  select coalesce(array_agg(distinct v.table_name::text order by v.table_name::text), array[]::text[])
  into offenders
  from information_schema.views v
  join information_schema.role_table_grants g
    on g.table_schema = v.table_schema
   and g.table_name   = v.table_name
  where v.table_schema = 'public'
    and v.is_updatable = 'YES'
    and g.privilege_type in ('INSERT', 'UPDATE', 'DELETE')
    and g.grantee in ('anon', 'authenticated');

  insert into t700_results values (
    'A1: no public view is both auto-updatable and write-granted to anon/authenticated',
    case when cardinality(offenders) = 0
         then 'PASS'
         else 'FAIL -- ' || array_to_string(offenders, ', ')
    end);
end $$;

-- Assertion 2: the guard is not vacuous.
--
-- A1 would also pass on a database with no views at all, or one where every
-- view happened to be ungranted -- so it would keep passing if a future
-- refactor quietly stopped creating views, and would be silently useless.
-- This pins that the survey actually surveyed something: public views exist,
-- and at least one is write-granted (i.e. the grant half of the hazard is
-- live and only the auto-updatable half is absent).
do $$
declare
  view_ct int;
  granted_ct int;
begin
  select count(*) into view_ct
  from information_schema.views where table_schema = 'public';

  select count(distinct v.table_name) into granted_ct
  from information_schema.views v
  join information_schema.role_table_grants g
    on g.table_schema = v.table_schema and g.table_name = v.table_name
  where v.table_schema = 'public'
    and g.privilege_type in ('INSERT', 'UPDATE', 'DELETE')
    and g.grantee in ('anon', 'authenticated');

  insert into t700_results values (
    'A2: the survey is non-vacuous (public views exist and some are write-granted)',
    case when view_ct > 0 and granted_ct > 0
         then 'PASS'
         else format('FAIL -- views=%s write_granted=%s; A1 would pass vacuously', view_ct, granted_ct)
    end);
end $$;

-- Assertion 3: `v_leaderboard_students` carries no write grant.
--
-- This assertion was WRONG on its first draft and the correction is worth
-- keeping visible. It originally asserted `is_updatable = NO` -- but T205 did
-- not change the view's shape, and never claimed to. The view is still
-- `select id, display_name from students where is_active`: simple, and
-- therefore still auto-updatable by construction. T205 fixed the hazard by
-- REVOKING the grants (`revoke all ... from anon`, `revoke insert, update,
-- delete ... from authenticated`).
--
-- So auto-updatability is not the property to pin here -- the absent write
-- grant is. Asserting `is_updatable = NO` would have failed against a
-- correctly-fixed database, which is exactly what it did when first run.
do $$
declare
  view_exists boolean;
  write_grants text[];
begin
  select exists (
    select 1 from information_schema.views
    where table_schema = 'public' and table_name = 'v_leaderboard_students'
  ) into view_exists;

  select coalesce(array_agg(distinct g.grantee::text || ':' || g.privilege_type::text
                            order by g.grantee::text || ':' || g.privilege_type::text),
                  array[]::text[])
  into write_grants
  from information_schema.role_table_grants g
  where g.table_schema = 'public'
    and g.table_name = 'v_leaderboard_students'
    and g.privilege_type in ('INSERT', 'UPDATE', 'DELETE')
    and g.grantee in ('anon', 'authenticated');

  insert into t700_results values (
    'A3: v_leaderboard_students carries no anon/authenticated write grant (T205 stays fixed)',
    case when not view_exists then 'PASS -- view absent, nothing to guard'
         when cardinality(write_grants) = 0 then 'PASS'
         else 'FAIL -- ' || array_to_string(write_grants, ', ')
    end);
end $$;

-- Report once, with every result, then fail if any assertion failed.
do $$
declare
  r record;
  failures int;
begin
  for r in select * from t700_results order by assertion loop
    raise notice '%: %', r.assertion, r.status;
  end loop;

  select count(*) into failures from t700_results where status not like 'PASS%';
  if failures > 0 then
    raise exception 'T700: % of % assertion(s) FAILED (see notices above)',
      failures, (select count(*) from t700_results);
  end if;
  raise notice 'T700: all % assertions passed.', (select count(*) from t700_results);
end $$;
