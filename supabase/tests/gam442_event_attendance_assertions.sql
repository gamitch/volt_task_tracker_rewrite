-- GAM-442 SQL proof: `public.v_event_attendance`
-- (`supabase/migrations/20260821000000_meetings_event_attendance_view.sql`).
--
-- Follows the T509/T322/T205 precedent: assertion `DO` blocks collecting
-- PASS/FAIL into a temp table, raised once at the end, so a run reports every
-- result rather than aborting on the first.
--
-- **The fixture is NOT in this file.** It is loaded by
-- `run_gam442_event_attendance.sh` BEFORE the migration under test is applied,
-- because criterion (f) needs a real before/after snapshot of four unrelated
-- views and a fixture loaded afterwards would leave both sides empty. Run this
-- file through that script; on its own it will fail every assertion, loudly,
-- via the non-vacuity block A0.
--
-- All fixture names are fabricated (constitution item 6). No PII.
--
-- ---------------------------------------------------------------------------
-- THE FIXTURE THESE ASSERTIONS READ, restated so the numbers below can be
-- hand-checked without opening the runner:
--
--   E1 "Fixture Meeting Alpha"   2 completed sessions, 1 scheduled, 1 canceled
--        held S1: c1 present, c2 late, c3 excused
--        held S2: c1 absent,  c2 present
--        scheduled S3: c1 present    <- must count NOWHERE
--        canceled  S4: c2 present    <- must count NOWHERE
--        => held_ct 2, graded 5, excused 1, attended 3, 100*3/(5-1) = 75.0
--   E2 "Fixture Meeting Bravo"   1 completed session, ZERO marks
--        => held_ct 1, graded 0, excused 0, attended 0, pct NULL (not 0.0)
--   E3 "Fixture Meeting Charlie" 1 completed session, 2 marks, BOTH excused
--        => held_ct 1, graded 2, excused 2, attended 0, pct NULL (not 0.0)
--   E4 "Fixture Meeting Delta"   NO sessions at all
--        => exactly 1 row, held_ct 0, graded 0, pct NULL
--   E5 "Fixture Meeting Echo"    20 completed sessions, 2 of a 5-student roster
--        marked present each night, counts_participation FALSE
--        => held_ct 20, graded 40, excused 0, attended 40, pct 100.0
--   E6 "Fixture Outreach Foxtrot" outreach, counts_volunteer_hours, 1 completed
--        session with 1 present mark (exists to give `v_student_hours` a row
--        for criterion (f); irrelevant to the assertions here beyond A0's count)
-- ---------------------------------------------------------------------------

create temp table gam442_results (assertion text, status text);

-- ---------------------------------------------------------------------------
-- A0 -- NON-VACUITY. Every assertion below would pass against an empty view if
-- it were written carelessly, and several would pass against a fixture that
-- silently failed to load. Pin the fixture's visibility first.
-- ---------------------------------------------------------------------------
do $$
declare view_rows int; event_rows int; nonheld_marks int;
begin
  select count(*) into view_rows from public.v_event_attendance
  where event_id in (
    select id from public.events where season_id = '44200000-0000-0000-0000-000000000001');
  select count(*) into event_rows from public.events
  where season_id = '44200000-0000-0000-0000-000000000001';

  -- The two marks parked on E1's scheduled and canceled sessions. If these are
  -- absent from the BASE TABLE, criterion (a)'s "non-held marks count nowhere"
  -- half is vacuous -- the view would report 75.0 simply because there was
  -- nothing to wrongly include.
  select count(*) into nonheld_marks
  from public.attendance a
  join public.event_sessions es on es.id = a.session_id
  where es.event_id = '44200000-0000-0000-0000-0000000000e1'
    and es.status <> 'completed';

  insert into gam442_results values (
    'A0: fixture is loaded and visible -- 6 events, 6 view rows, 2 marks parked on non-held sessions',
    case when (view_rows, event_rows, nonheld_marks) is not distinct from (6, 6, 2)
         then 'PASS'
         else format('FAIL -- view_rows=%s event_rows=%s nonheld_marks=%s (expected 6/6/2); every assertion below may be vacuous',
                     view_rows, event_rows, nonheld_marks) end);
end $$;

-- ---------------------------------------------------------------------------
-- (a) HAND-COMPUTED PERCENTAGE, with `late` visibly attended (MET-05) and the
--     excused mark visibly removed from the denominator, and with two marks on
--     non-held sessions that must contribute to nothing.
--
--     Hand-computed BEFORE running: held S1 gives present+late+excused, held S2
--     gives absent+present. graded = 5. excused = 1. attended = present(c1,S1)
--     + late(c2,S1) + present(c2,S2) = 3. denominator = 5 - 1 = 4.
--     100 * 3 / 4 = 75.0.
-- ---------------------------------------------------------------------------
do $$
declare h bigint; g bigint; x bigint; att bigint; pct numeric;
begin
  select held_ct, graded_marks_ct, excused_ct, attended_marks_ct, attendance_pct
    into h, g, x, att, pct
  from public.v_event_attendance where event_id = '44200000-0000-0000-0000-0000000000e1';
  insert into gam442_results values (
    '(a) E1 = hand-computed (2 held, 5 marks, 1 excused, 3 attended, 100*3/(5-1) = 75.0)',
    case when (h, g, x, att, pct) is not distinct from (2::bigint, 5::bigint, 1::bigint, 3::bigint, 75.0::numeric)
         then 'PASS'
         else format('FAIL -- got held=%s graded=%s excused=%s attended=%s pct=%s', h, g, x, att, pct) end);
end $$;

-- (a-late) MET-05 spelled out on its own: the `late` mark is inside
-- attended_marks_ct. Without it E1 would be 100*2/4 = 50.0.
do $$
declare att bigint; late_marks int;
begin
  select attended_marks_ct into att from public.v_event_attendance
  where event_id = '44200000-0000-0000-0000-0000000000e1';
  select count(*) into late_marks
  from public.attendance a
  join public.event_sessions es on es.id = a.session_id and es.status = 'completed'
  where es.event_id = '44200000-0000-0000-0000-0000000000e1' and a.status = 'late';
  insert into gam442_results values (
    '(a) MET-05: the 1 `late` mark is counted as attended (attended_marks_ct 3, not 2)',
    case when late_marks = 1 and att = 3 then 'PASS'
         else format('FAIL -- late marks in fixture=%s, attended_marks_ct=%s (expected 1 and 3)', late_marks, att) end);
end $$;

-- (a-excused) the excused mark is in graded_marks_ct AND in excused_ct, i.e.
-- it is removed from the denominator rather than from the count of marks.
do $$
declare g bigint; x bigint;
begin
  select graded_marks_ct, excused_ct into g, x from public.v_event_attendance
  where event_id = '44200000-0000-0000-0000-0000000000e1';
  insert into gam442_results values (
    '(a) the excused mark is INSIDE graded_marks_ct (5) and removed via excused_ct (1) -> denominator 4',
    case when g = 5 and x = 1 and (g - x) = 4 then 'PASS'
         else format('FAIL -- graded=%s excused=%s denominator=%s (expected 5/1/4)', g, x, g - x) end);
end $$;

-- ---------------------------------------------------------------------------
-- (a2) `held_ct` COUNTS SESSIONS, NOT MARKS. This is the criterion that guards
--      the join fan-out described in the migration header. The naive
--      `count(es.id)` over the left-joined row set reports 5 here -- one per
--      mark -- while `attendance_pct` stays a correct 75.0, so every OTHER
--      assertion in this file passes against the corrupted view. Measured.
-- ---------------------------------------------------------------------------
do $$
declare h bigint; g bigint; real_sessions int;
begin
  select held_ct, graded_marks_ct into h, g from public.v_event_attendance
  where event_id = '44200000-0000-0000-0000-0000000000e1';
  select count(*) into real_sessions from public.event_sessions
  where event_id = '44200000-0000-0000-0000-0000000000e1' and status = 'completed';
  insert into gam442_results values (
    '(a2) E1: held_ct = 2 completed SESSIONS while graded_marks_ct = 5 MARKS (fan-out would report held_ct 5)',
    case when h = 2 and g = 5 and h = real_sessions then 'PASS'
         else format('FAIL -- held_ct=%s graded_marks_ct=%s, base table has %s completed sessions (expected 2/5/2)',
                     h, g, real_sessions) end);
end $$;

-- (a2b) The second half: ONE held session carrying TWO marks is still
-- held_ct = 1. This is the smallest possible fan-out and the one a `distinct`
-- typo would reopen.
do $$
declare h bigint; g bigint; real_sessions int;
begin
  select held_ct, graded_marks_ct into h, g from public.v_event_attendance
  where event_id = '44200000-0000-0000-0000-0000000000e3';
  select count(*) into real_sessions from public.event_sessions
  where event_id = '44200000-0000-0000-0000-0000000000e3' and status = 'completed';
  insert into gam442_results values (
    '(a2) E3: ONE held session carrying TWO marks is held_ct = 1, not 2',
    case when h = 1 and g = 2 and real_sessions = 1 then 'PASS'
         else format('FAIL -- held_ct=%s graded_marks_ct=%s, base table has %s completed session(s) (expected 1/2/1)',
                     h, g, real_sessions) end);
end $$;

-- (a2c) The same guard on the large event, where a fan-out is unmissable:
-- 20 held sessions carrying 40 marks must be held_ct 20, not 40.
do $$
declare h bigint; g bigint;
begin
  select held_ct, graded_marks_ct into h, g from public.v_event_attendance
  where event_id = '44200000-0000-0000-0000-0000000000e5';
  insert into gam442_results values (
    '(a2) E5: 20 held sessions carrying 40 marks is held_ct = 20, not 40',
    case when h = 20 and g = 40 then 'PASS'
         else format('FAIL -- held_ct=%s graded_marks_ct=%s (expected 20/40)', h, g) end);
end $$;

-- ---------------------------------------------------------------------------
-- (b) NULL, NEVER A FABRICATED 0 -- twice. `IS NULL` is asserted directly; a
--     `= NULL` or a string comparison would be satisfied by anything.
-- ---------------------------------------------------------------------------

-- (b1) held sessions, ZERO marks.
do $$
declare h bigint; g bigint; att bigint; pct numeric;
begin
  select held_ct, graded_marks_ct, attended_marks_ct, attendance_pct
    into h, g, att, pct
  from public.v_event_attendance where event_id = '44200000-0000-0000-0000-0000000000e2';
  insert into gam442_results values (
    '(b1) E2: 1 held session with ZERO marks -> graded_marks_ct 0 and attendance_pct IS NULL (never 0.0)',
    case when h = 1 and g = 0 and att = 0 and pct is null then 'PASS'
         else format('FAIL -- held=%s graded=%s attended=%s pct=%s (pct must be NULL; a count(*) spelling fabricates graded=1, pct=0.0)',
                     h, g, att, pct) end);
end $$;

-- (b2) every mark excused.
do $$
declare g bigint; x bigint; att bigint; pct numeric;
begin
  select graded_marks_ct, excused_ct, attended_marks_ct, attendance_pct
    into g, x, att, pct
  from public.v_event_attendance where event_id = '44200000-0000-0000-0000-0000000000e3';
  insert into gam442_results values (
    '(b2) E3: EVERY mark excused -> denominator 0 -> attendance_pct IS NULL (never 0.0)',
    case when g = 2 and x = 2 and att = 0 and pct is null then 'PASS'
         else format('FAIL -- graded=%s excused=%s attended=%s pct=%s (pct must be NULL; a greatest(...,1) floor fabricates 0.0)',
                     g, x, att, pct) end);
end $$;

-- (b-guard) The two NULL cases restated as a direct refutation of the two
-- spellings that would fabricate a zero, so a reader can see WHAT is excluded.
do $$
declare bad int;
begin
  select count(*) into bad from public.v_event_attendance
  where event_id in ('44200000-0000-0000-0000-0000000000e2',
                     '44200000-0000-0000-0000-0000000000e3')
    and attendance_pct = 0.0;
  insert into gam442_results values (
    '(b) neither NULL case reports 0.0 (no greatest(...,1) floor, no count(*) phantom mark)',
    case when bad = 0 then 'PASS'
         else format('FAIL -- %s of the 2 NULL cases reported a fabricated 0.0', bad) end);
end $$;

-- ---------------------------------------------------------------------------
-- (b3) THE KNOWN RISK, pinned as an exact number rather than proved safe.
--
--      This is NOT a defect in the SQL and must not be "fixed". It is D014's
--      inverted failure mode (`20260806000000_met01_explicit_marks.sql:95-100`)
--      arriving at event grain: since T508 an unmarked student normally has no
--      attendance row, so forgetting to mark someone INFLATES the percentage.
--      E5 is a 5-student roster across 20 held sessions where only the 2 who
--      turned up were marked: 100 roster-turns, 40 marks, 100.0%.
--
--      The assertion exists so the number and its mitigation stay on the
--      record together. `graded_marks_ct` (40) is the mitigation; a consumer
--      that renders `attendance_pct` (100.0) without it reintroduces D014's
--      known regression.
-- ---------------------------------------------------------------------------
do $$
declare h bigint; g bigint; att bigint; pct numeric; roster int; roster_turns int;
begin
  select held_ct, graded_marks_ct, attended_marks_ct, attendance_pct
    into h, g, att, pct
  from public.v_event_attendance where event_id = '44200000-0000-0000-0000-0000000000e5';
  select count(*) into roster from public.student_teams
  where team_id = '44200000-0000-0000-0000-0000000000a1' and left_on is null;
  roster_turns := roster * h;
  insert into gam442_results values (
    format('(b3) KNOWN RISK, not a pass: E5 reports held_ct 20 / graded_marks_ct 40 / attendance_pct 100.0 against %s roster-turns', roster_turns),
    case when (h, g, att, pct) is not distinct from (20::bigint, 40::bigint, 40::bigint, 100.0::numeric)
              and roster = 5 and roster_turns = 100
         then 'PASS (the risk is present and measured, exactly as disclosed)'
         else format('FAIL -- held=%s graded=%s attended=%s pct=%s roster=%s turns=%s (expected 20/40/40/100.0/5/100)',
                     h, g, att, pct, roster, roster_turns) end);
end $$;

-- (b3b) E5 carries counts_participation = FALSE and still appears with its
-- full turnout. That is deliberate (see the migration header, "what was
-- deliberately not done" #1): counts_participation is a student-metric switch,
-- not an attendance-happened switch.
do $$
declare cp boolean; h bigint;
begin
  select counts_participation into cp from public.events
  where id = '44200000-0000-0000-0000-0000000000e5';
  select held_ct into h from public.v_event_attendance
  where event_id = '44200000-0000-0000-0000-0000000000e5';
  insert into gam442_results values (
    '(b3) a counts_participation = false event is NOT filtered out (no student-level filtering anywhere)',
    case when cp = false and h = 20 then 'PASS'
         else format('FAIL -- counts_participation=%s held_ct=%s (expected false/20)', cp, h) end);
end $$;

-- ---------------------------------------------------------------------------
-- (c) ZERO-SESSION EVENT. The row COUNT is asserted, not just the values -- a
--     plain `select` that returned nothing would satisfy a careless check, and
--     an inner join (the `v_event_student_hours` precedent's one divergence)
--     is exactly what would make it return nothing.
-- ---------------------------------------------------------------------------
do $$
declare row_ct int; h bigint; g bigint; x bigint; att bigint; pct numeric; sessions int;
begin
  select count(*) into row_ct from public.v_event_attendance
  where event_id = '44200000-0000-0000-0000-0000000000e4';
  select count(*) into sessions from public.event_sessions
  where event_id = '44200000-0000-0000-0000-0000000000e4';
  select held_ct, graded_marks_ct, excused_ct, attended_marks_ct, attendance_pct
    into h, g, x, att, pct
  from public.v_event_attendance where event_id = '44200000-0000-0000-0000-0000000000e4';
  insert into gam442_results values (
    '(c) E4 has NO sessions and still gets EXACTLY 1 row: held_ct 0, all mark counts 0, pct NULL',
    case when row_ct = 1 and sessions = 0
              and (h, g, x, att) is not distinct from (0::bigint, 0::bigint, 0::bigint, 0::bigint)
              and pct is null
         then 'PASS'
         else format('FAIL -- rows=%s base_sessions=%s held=%s graded=%s excused=%s attended=%s pct=%s (expected 1/0/0/0/0/0/NULL)',
                     row_ct, sessions, h, g, x, att, pct) end);
end $$;

-- (c2) The grain rule in general: one row per events.id, always, for every
-- event in the database -- not merely for the fixture's zero-session one.
do $$
declare view_rows int; event_rows int;
begin
  select count(*) into view_rows from public.v_event_attendance;
  select count(*) into event_rows from public.events;
  insert into gam442_results values (
    '(c) GRAIN: v_event_attendance has exactly one row per events.id, org-wide',
    case when view_rows = event_rows and event_rows > 0 then 'PASS'
         else format('FAIL -- view rows=%s, events rows=%s', view_rows, event_rows) end);
end $$;

-- ---------------------------------------------------------------------------
-- (contract) Column types and updatability, both asserted from the catalog.
-- The `*_ct` columns are bigint because that is what count() returns; the
-- migration deliberately does not cast them narrower. `is_updatable = 'NO'` is
-- the fact the migration's revoke comment cites when it declines to repeat
-- T205's DELETE-path argument.
-- ---------------------------------------------------------------------------
do $$
declare bad text;
begin
  select string_agg(format('%s=%s', column_name, data_type), ', ' order by ordinal_position)
    into bad
  from information_schema.columns
  where table_schema = 'public' and table_name = 'v_event_attendance'
    and not (
      (column_name in ('held_ct','graded_marks_ct','excused_ct','attended_marks_ct') and data_type = 'bigint')
      or (column_name = 'attendance_pct' and data_type = 'numeric')
      or (column_name = 'event_id' and data_type = 'uuid')
    );
  insert into gam442_results values (
    '(contract) column types: event_id uuid, four *_ct bigint, attendance_pct numeric',
    case when bad is null then 'PASS' else format('FAIL -- unexpected: %s', bad) end);
end $$;

do $$
declare upd text; cols int;
begin
  select is_updatable into upd from information_schema.views
  where table_schema = 'public' and table_name = 'v_event_attendance';
  select count(*) into cols from information_schema.columns
  where table_schema = 'public' and table_name = 'v_event_attendance';
  insert into gam442_results values (
    '(contract) the view is an aggregate, so information_schema.views.is_updatable = NO, and it has exactly 6 columns',
    case when upd = 'NO' and cols = 6 then 'PASS'
         else format('FAIL -- is_updatable=%s columns=%s (expected NO/6)', upd, cols) end);
end $$;

-- ---------------------------------------------------------------------------
-- Report.
-- ---------------------------------------------------------------------------
do $$
declare r record; failures int;
begin
  for r in select * from gam442_results order by assertion loop
    raise notice '%: %', r.assertion, r.status;
  end loop;
  select count(*) into failures from gam442_results where status not like 'PASS%';
  if failures > 0 then
    raise exception 'GAM-442: % of % assertion(s) FAILED (see notices above)',
      failures, (select count(*) from gam442_results);
  end if;
  raise notice 'GAM-442: all % assertions passed.', (select count(*) from gam442_results);
end $$;
