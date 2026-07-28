-- T014 NFR-03 assertions against v_student_hours / v_student_participation /
-- v_team_participation, run against the fixture data loaded by
-- supabase/tests/seed.sql. Applied by supabase/tests/run.sh after the five
-- files under supabase/migrations/ and this directory's auth_stub.sql/seed.sql.
--
-- Each case below computes its actual value(s) with a plain SELECT against
-- the already-applied, unmodified views (no metric formula is re-implemented
-- here -- every assertion just compares a view's own output to the expected
-- number worked out by hand in the comment above it) and records a PASS/FAIL
-- row, with the arithmetic shown, into a temp results table. The final block
-- raises an exception (non-zero psql/script exit under -v ON_ERROR_STOP=1) if
-- any case failed, after every case's PASS/FAIL has already been printed via
-- RAISE NOTICE.

create temporary table test_results (
  case_name text primary key,
  result text not null check (result in ('PASS', 'FAIL')),
  detail text not null
);

-- ---------------------------------------------------------------------------
-- Case (a): excused-shrinks-denominator
-- Student Alpha: expected_ct = 2 (1 present session + 1 excused session for a
-- counts_participation event), excused_ct = 1, present_ct = 1.
-- participation_pct = round(100 * present_ct / greatest(expected_ct - excused_ct, 1), 1)
--                    = round(100 * 1 / greatest(2 - 1, 1), 1)
--                    = round(100 * 1 / 1, 1)
--                    = 100.0
-- (Not 50.0, which is what you'd get if the excused row only failed to count
-- as present without also shrinking the denominator from 2 to 1.)
-- ---------------------------------------------------------------------------
do $$
declare
  v_row_ct int;
  v_expected_ct int;
  v_present_ct int;
  v_excused_ct int;
  v_pct numeric;
begin
  select count(*) into v_row_ct
  from v_student_participation
  where student_id = '00000000-0000-0000-0000-00000000c001';

  if v_row_ct <> 1 then
    insert into test_results values ('a-excused-shrinks-denominator', 'FAIL',
      format('expected exactly 1 row from v_student_participation for Student Alpha, got %s', v_row_ct));
  else
    select expected_ct, present_ct, excused_ct, participation_pct
      into v_expected_ct, v_present_ct, v_excused_ct, v_pct
    from v_student_participation
    where student_id = '00000000-0000-0000-0000-00000000c001';

    if v_expected_ct = 2 and v_present_ct = 1 and v_excused_ct = 1 and v_pct = 100.0 then
      insert into test_results values ('a-excused-shrinks-denominator', 'PASS',
        format('expected_ct=%s present_ct=%s excused_ct=%s participation_pct=%s ' ||
               '(arithmetic: round(100*1/greatest(2-1,1),1) = round(100/1,1) = 100.0)',
               v_expected_ct, v_present_ct, v_excused_ct, v_pct));
    else
      insert into test_results values ('a-excused-shrinks-denominator', 'FAIL',
        format('got expected_ct=%s present_ct=%s excused_ct=%s participation_pct=%s, wanted 2/1/1/100.0',
               v_expected_ct, v_present_ct, v_excused_ct, v_pct));
    end if;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Case (b): hours_override wins
-- Student Bravo: check-in/check-out span clamped to the 2-hour session
-- window would compute to X = 2.0h, but attendance.hours_override is
-- explicitly set to Y = 9.25h. confirmed_hours must equal 9.25, not 2.0.
-- ---------------------------------------------------------------------------
do $$
declare
  v_row_ct int;
  v_hours numeric;
begin
  select count(*) into v_row_ct
  from v_student_hours
  where student_id = '00000000-0000-0000-0000-00000000c002';

  if v_row_ct <> 1 then
    insert into test_results values ('b-hours-override-wins', 'FAIL',
      format('expected exactly 1 row from v_student_hours for Student Bravo, got %s', v_row_ct));
  else
    select confirmed_hours into v_hours
    from v_student_hours
    where student_id = '00000000-0000-0000-0000-00000000c002';

    if v_hours = 9.25 then
      insert into test_results values ('b-hours-override-wins', 'PASS',
        format('confirmed_hours=%s (hours_override Y=9.25 was used, not the clamped check-in/check-out span X=2.0)', v_hours));
    else
      insert into test_results values ('b-hours-override-wins', 'FAIL',
        format('confirmed_hours=%s, wanted 9.25 (hours_override)', v_hours));
    end if;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Case (c-i): check-in clamping to the session window (positive case)
-- Student Charlie: session window is 09:00-11:00 (2h). check_in_at=08:00
-- (before starts_at), check_out_at=12:30 (after ends_at); actual span would
-- be 4.5h. confirmed_hours must clamp to the 2-hour window length, i.e. 2.0,
-- not 4.5.
-- ---------------------------------------------------------------------------
do $$
declare
  v_row_ct int;
  v_hours numeric;
begin
  select count(*) into v_row_ct
  from v_student_hours
  where student_id = '00000000-0000-0000-0000-00000000c003';

  if v_row_ct <> 1 then
    insert into test_results values ('c1-checkin-clamp-positive', 'FAIL',
      format('expected exactly 1 row from v_student_hours for Student Charlie, got %s', v_row_ct));
  else
    select confirmed_hours into v_hours
    from v_student_hours
    where student_id = '00000000-0000-0000-0000-00000000c003';

    if v_hours = 2.0 then
      insert into test_results values ('c1-checkin-clamp-positive', 'PASS',
        format('confirmed_hours=%s (clamped to the 2h session window, not the wider 4.5h actual check-in/check-out span)', v_hours));
    else
      insert into test_results values ('c1-checkin-clamp-positive', 'FAIL',
        format('confirmed_hours=%s, wanted 2.0 (session window length, clamped)', v_hours));
    end if;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Case (c-ii): check-in clamping to the session window (zero-floor case)
-- Student Delta: session window is 09:00-11:00 (2h). check_in_at=12:00 and
-- check_out_at=13:00, both entirely after ends_at. The naive (unclamped)
-- subtraction would be negative (ends_at 11:00 - check_in_at 12:00 = -1h);
-- greatest(...,0) must floor this at exactly 0, never a negative number.
-- ---------------------------------------------------------------------------
do $$
declare
  v_row_ct int;
  v_hours numeric;
begin
  select count(*) into v_row_ct
  from v_student_hours
  where student_id = '00000000-0000-0000-0000-00000000c004';

  if v_row_ct <> 1 then
    insert into test_results values ('c2-checkin-clamp-zero-floor', 'FAIL',
      format('expected exactly 1 row from v_student_hours for Student Delta, got %s', v_row_ct));
  else
    select confirmed_hours into v_hours
    from v_student_hours
    where student_id = '00000000-0000-0000-0000-00000000c004';

    if v_hours = 0 then
      insert into test_results values ('c2-checkin-clamp-zero-floor', 'PASS',
        format('confirmed_hours=%s (floored at 0 by greatest(...,0); naive subtraction would have been -1h)', v_hours));
    else
      insert into test_results values ('c2-checkin-clamp-zero-floor', 'FAIL',
        format('confirmed_hours=%s, wanted 0 (must never go negative)', v_hours));
    end if;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Case (d): no-completed-sessions "-" case
-- Student Echo / Team Echo's only session is status='scheduled', never
-- 'completed'. Both v_student_participation and v_team_participation must
-- return zero rows for this student/team -- not a row with expected_ct = 0.
-- Asserted directly as a row-count = 0, not by inference from any field.
-- ---------------------------------------------------------------------------
do $$
declare
  v_student_row_ct int;
  v_team_row_ct int;
begin
  select count(*) into v_student_row_ct
  from v_student_participation
  where student_id = '00000000-0000-0000-0000-00000000c005';

  select count(*) into v_team_row_ct
  from v_team_participation
  where team_id = '00000000-0000-0000-0000-00000000a005';

  if v_student_row_ct = 0 and v_team_row_ct = 0 then
    insert into test_results values ('d-no-completed-sessions', 'PASS',
      format('v_student_participation row count=%s, v_team_participation row count=%s (both correctly 0, not a row with expected_ct=0)',
             v_student_row_ct, v_team_row_ct));
  else
    insert into test_results values ('d-no-completed-sessions', 'FAIL',
      format('v_student_participation row count=%s, v_team_participation row count=%s, wanted 0/0',
             v_student_row_ct, v_team_row_ct));
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Report every case's outcome, then fail the whole run (non-zero exit under
-- psql -v ON_ERROR_STOP=1) if any case did not PASS.
-- ---------------------------------------------------------------------------
do $$
declare
  r record;
  v_fail_ct int;
begin
  for r in select case_name, result, detail from test_results order by case_name loop
    raise notice '% % -- %', r.result, r.case_name, r.detail;
  end loop;

  select count(*) into v_fail_ct from test_results where result = 'FAIL';

  if v_fail_ct > 0 then
    raise exception 'NFR-03 metric-view fixture tests: % of % cases FAILED', v_fail_ct, (select count(*) from test_results);
  else
    raise notice 'NFR-03 metric-view fixture tests: all % cases PASSED', (select count(*) from test_results);
  end if;
end $$;
