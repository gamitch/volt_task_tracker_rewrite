-- T509/D014 SQL proof: MET-01's denominator is EXPLICIT MARKS, not eligibility
-- (`20260806000000_met01_explicit_marks.sql`).
--
-- Follows the T322/T205 precedent: fixture INSERTs plus assertion `DO` blocks
-- in one file, PASS/FAIL collected and raised once at the end so a run reports
-- every result rather than aborting on the first.
--
-- ---------------------------------------------------------------------------
-- WHY THIS FILE EXISTS, and why re-deriving T014's suite was NOT the answer.
--
-- The T509 row instructed: "re-derive T014's MET-01 fixture tests by hand
-- (they encode the old denominator)". **Measured, and that is not what they
-- do.** `supabase/tests/run.sh` passes IDENTICALLY with this migration applied
-- and with it withheld -- all 5 cases green either way.
--
-- The reason is the fixture, not the assertions: `seed.sql` gives every
-- student an explicit attendance row for every completed session, so
-- eligibility and explicit marks select the SAME set there. Its assertions are
-- still CORRECT; they are simply blind to this change. Re-deriving them would
-- have produced identical numbers and proved nothing -- the same
-- fixture-cannot-tell-the-difference shape T703 was filed for.
--
-- So the fix is a fixture that DIVERGES, which is what this file supplies. It
-- deliberately does not re-test what T014 already covers.
--
-- All names below are fabricated (constitution item 6).
-- ---------------------------------------------------------------------------

create temp table t509_results (assertion text, status text);

-- Three students on one team, one event, two completed sessions:
--   MARKED     -- present at one, absent at the other  -> a real 50%
--   UNMARKED   -- NO attendance rows at all            -> must vanish entirely
--   ALLEXCUSED -- excused at both                      -> denominator 0 -> NULL
--
-- UNMARKED is the case the whole task turns on. Before T509 they scored 0%;
-- after T508 made absence-marking an explicit coach opt-in, "no row" is the
-- ORDINARY state of a student nobody got to, not an edge case.
insert into seasons (id, name, starts_on, ends_on, is_active, default_goal_hours) values
  ('59000000-0000-0000-0000-000000000001', 'Fixture Season T509', '2026-01-01', '2026-12-31', false, 100);
insert into teams (id, name, short_name, program, color, archived, sort_order) values
  ('59000000-0000-0000-0000-0000000000a1', 'Fixture Team T509', 'FT509', 'FRC', '#123456', false, 99);
insert into students (id, profile_id, display_name, team_id, grad_year, is_active, goal_hours_override) values
  ('59000000-0000-0000-0000-0000000000c1', null, 'Fixture Marked T509',     '59000000-0000-0000-0000-0000000000a1', 2027, true, null),
  ('59000000-0000-0000-0000-0000000000c2', null, 'Fixture Unmarked T509',   '59000000-0000-0000-0000-0000000000a1', 2027, true, null),
  ('59000000-0000-0000-0000-0000000000c3', null, 'Fixture AllExcused T509', '59000000-0000-0000-0000-0000000000a1', 2027, true, null);
insert into student_teams (student_id, team_id, joined_on, left_on) values
  ('59000000-0000-0000-0000-0000000000c1', '59000000-0000-0000-0000-0000000000a1', '2026-01-01', null),
  ('59000000-0000-0000-0000-0000000000c2', '59000000-0000-0000-0000-0000000000a1', '2026-01-01', null),
  ('59000000-0000-0000-0000-0000000000c3', '59000000-0000-0000-0000-0000000000a1', '2026-01-01', null);
insert into events (id, season_id, type, title, description, location_name, address, team_ids, counts_participation, counts_volunteer_hours) values
  ('59000000-0000-0000-0000-0000000000e1', '59000000-0000-0000-0000-000000000001', 'meeting', 'Fixture Meeting T509', '', 'Fixture Hall', '1 Fixture Way', null, true, false);
insert into event_sessions (id, event_id, session_date, starts_at, ends_at, status, people_reached, notes) values
  ('59000000-0000-0000-0000-000000000051', '59000000-0000-0000-0000-0000000000e1', '2026-03-01', '2026-03-01T00:00:00Z', '2026-03-01T02:00:00Z', 'completed', null, ''),
  ('59000000-0000-0000-0000-000000000052', '59000000-0000-0000-0000-0000000000e1', '2026-03-08', '2026-03-08T00:00:00Z', '2026-03-08T02:00:00Z', 'completed', null, '');
insert into attendance (session_id, student_id, status, method, recorded_by) values
  ('59000000-0000-0000-0000-000000000051', '59000000-0000-0000-0000-0000000000c1', 'present', 'coach', null),
  ('59000000-0000-0000-0000-000000000052', '59000000-0000-0000-0000-0000000000c1', 'absent',  'coach', null),
  ('59000000-0000-0000-0000-000000000051', '59000000-0000-0000-0000-0000000000c3', 'excused', 'coach', null),
  ('59000000-0000-0000-0000-000000000052', '59000000-0000-0000-0000-0000000000c3', 'excused', 'coach', null);

-- A1: THE HEADLINE. A student with no marks has NO ROW. Before T509 this
-- student had a row reporting 0.0%, which is the user-facing lie the task
-- closes. `ParticipationTab.buildDisplayRows` turns "no row" into an
-- all-null display row, which the table renders as an em dash.
do $$
declare row_ct int;
begin
  select count(*) into row_ct from v_student_participation
  where student_id = '59000000-0000-0000-0000-0000000000c2';
  insert into t509_results values (
    'A1: an UNMARKED student has no row at all (renders as an em dash, never 0%)',
    case when row_ct = 0 then 'PASS'
         else format('FAIL -- expected 0 rows, got %s (the pre-T509 0%% lie is back)', row_ct) end);
end $$;

-- A2: a marked student's arithmetic is unchanged -- present+late over
-- marks-minus-excused. Pinned so the fix cannot be mistaken for "drop rows
-- until the numbers look nice".
do $$
declare ct int; pres int; exc int; pct numeric;
begin
  select expected_ct, present_ct, excused_ct, participation_pct
    into ct, pres, exc, pct
  from v_student_participation where student_id = '59000000-0000-0000-0000-0000000000c1';
  insert into t509_results values (
    'A2: a MARKED student scores present/(marks - excused) = 1/2 = 50.0',
    case when (ct, pres, exc, pct) is not distinct from (2, 1, 0, 50.0)
         then 'PASS'
         else format('FAIL -- got marks=%s present=%s excused=%s pct=%s', ct, pres, exc, pct) end);
end $$;

-- A3: every mark excused means NO denominator -- NULL, not 0%. The old view
-- divided by `greatest(..., 1)`, which fabricated a 0% here.
do $$
declare ct int; exc int; pct numeric;
begin
  select expected_ct, excused_ct, participation_pct into ct, exc, pct
  from v_student_participation where student_id = '59000000-0000-0000-0000-0000000000c3';
  insert into t509_results values (
    'A3: an ALL-EXCUSED student yields NULL, not a fabricated 0%',
    case when ct = 2 and exc = 2 and pct is null then 'PASS'
         else format('FAIL -- got marks=%s excused=%s pct=%s', ct, exc, pct) end);
end $$;

-- A4: the team rollup follows the same rule, so student and team never
-- disagree. sum(present)=1 over sum(marks)-sum(excused) = 4-2 = 2 -> 50.0.
do $$
declare pct numeric;
begin
  select participation_pct into pct from v_team_participation
  where team_id = '59000000-0000-0000-0000-0000000000a1'
    and season_id = '59000000-0000-0000-0000-000000000001';
  insert into t509_results values (
    'A4: the team rollup uses the same marks denominator (1/(4-2) = 50.0)',
    case when pct = 50.0 then 'PASS'
         else format('FAIL -- got %s', pct) end);
end $$;

-- A5: NON-VACUITY. A1-A4 would all still pass if this fixture had silently
-- failed to load, or if the event stopped counting toward participation --
-- every assertion would read an empty view and see what it expected. This
-- pins that the fixture is actually visible to the view.
do $$
declare visible int;
begin
  select count(*) into visible from v_student_participation
  where season_id = '59000000-0000-0000-0000-000000000001';
  insert into t509_results values (
    'A5: the fixture is actually visible to the view (2 of 3 students have rows)',
    case when visible = 2 then 'PASS'
         else format('FAIL -- expected 2 rows for this season, got %s; A1-A4 may be vacuous', visible) end);
end $$;

do $$
declare r record; failures int;
begin
  for r in select * from t509_results order by assertion loop
    raise notice '%: %', r.assertion, r.status;
  end loop;
  select count(*) into failures from t509_results where status <> 'PASS';
  if failures > 0 then
    raise exception 'T509: % of % assertion(s) FAILED (see notices above)',
      failures, (select count(*) from t509_results);
  end if;
  raise notice 'T509: all % assertions passed.', (select count(*) from t509_results);
end $$;
