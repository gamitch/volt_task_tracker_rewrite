#!/usr/bin/env bash

# GAM-442: applies every migration to a scratch database and proves
# `public.v_event_attendance`
# (`supabase/migrations/20260821000000_meetings_event_attendance_view.sql`).
#
# Modelled on `run_t509_explicit_marks.sh` (scratch-DB lifecycle, platform
# stub, "apply every migration unchanged" loop) and on
# `run_t503_widen_rsvp_read.sh:50-61` (the migration loop is SPLIT, so a real
# BEFORE snapshot exists -- applying everything at once cannot show what this
# migration changed).
#
# ---------------------------------------------------------------------------
# THREE HARNESS FACTS, each of which was measured rather than assumed, and each
# of which silently invalidates a proof if skipped.
#
# 1. `.claude/skills/scratch-postgres/scripts/start.sh` cannot run here: it
#    `chown`s its data directory to `postgres`, which a non-root uid may not
#    do. Point this script at any cluster you own -- e.g.
#      initdb -D /tmp/pg -U postgres --auth=trust
#      pg_ctl -D /tmp/pg -o "-p 55442 -k /tmp/sock -c listen_addresses=''" start
#      PGHOST=/tmp/sock PGPORT=55442 PGUSER=postgres supabase/tests/run_gam442_event_attendance.sh
#    `initdb` refuses only ROOT, so running it as yourself is fine.
#
# 2. The `alter default privileges` line MUST run before the migration loop.
#    Without it `relacl` is `<NULL: owner-only default>` on every view,
#    `has_table_privilege('anon', ...)` is already false before any revoke, and
#    `authenticated` is denied on EVERY view in the schema including the
#    shipped ones -- so the anon proof passes vacuously and the coach-read
#    proof cannot pass at all. T205/T503 precedent.
#
# 3. `calendar_feed_platform_stub.sql` creates `anon` and `authenticated` but
#    NOT `service_role`, which that same line names. Created below, exactly as
#    `run_t503_widen_rsvp_read.sh:27-39` does, without touching the shared stub.
#
# ---------------------------------------------------------------------------
# The fixture and the two snapshots are INLINE here rather than split into
# their own files (the T503 precedent uses six files for this shape). GAM-442's
# Allowed Files is three, and this keeps it there.
#
# All fixture names are fabricated (constitution item 6). No PII.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
MIGRATIONS_DIR="$REPO_ROOT/supabase/migrations"
NEW_MIGRATION="20260821000000_meetings_event_attendance_view.sql"
SKIPPED_MIGRATIONS=(
  "20260719000000_cron.sql"
  "20260720000001_avatar_storage.sql"
)
DBNAME="volt_gam442_event_attendance_$$_$(date +%s)"
WORK_DIR="$(mktemp -d)"

PSQL=(psql -X -v ON_ERROR_STOP=1)

cleanup() {
  "${PSQL[@]}" -d postgres -c "DROP DATABASE IF EXISTS \"$DBNAME\" WITH (FORCE);" >/dev/null 2>&1 || true
  rm -rf "$WORK_DIR"
}
trap cleanup EXIT

# The fixture ids, referenced by name here and by literal in the assertions.
SEASON=44200000-0000-0000-0000-000000000001
TEAM=44200000-0000-0000-0000-0000000000a1
COACH=44200000-0000-0000-0000-0000000000f1

echo "==> creating scratch database $DBNAME"
"${PSQL[@]}" -d postgres -c "CREATE DATABASE \"$DBNAME\";"

echo "==> applying task-specific Supabase platform stub (T195 precedent, reused per T205/T322/T503)"
"${PSQL[@]}" -d "$DBNAME" -f "$SCRIPT_DIR/calendar_feed_platform_stub.sql"

echo "==> creating service_role if missing (harness fact 3 -- the shared stub does"
echo "    not create it and the default-privileges line below names it)"
"${PSQL[@]}" -d "$DBNAME" -c "
do \$\$
begin
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    create role service_role nologin;
  end if;
end;
\$\$;
"

echo "==> simulating Supabase's stock default privileges (harness fact 2 -- must run"
echo "    BEFORE the migrations create the view under test)"
"${PSQL[@]}" -d "$DBNAME" -c \
  "alter default privileges in schema public grant all on tables to anon, authenticated, service_role;"

echo "==> applying every migration EXCEPT $NEW_MIGRATION (loop split, so a real"
echo "    BEFORE snapshot exists -- T503 precedent)"
found_new=false
for migration in "$MIGRATIONS_DIR"/*.sql; do
  basename="$(basename "$migration")"

  skip=false
  for skipped in "${SKIPPED_MIGRATIONS[@]}"; do
    if [[ "$basename" == "$skipped" ]]; then skip=true; break; fi
  done
  if [[ "$skip" == true ]]; then
    echo "==> skipping migration (Supabase-platform dependency): $basename"
    continue
  fi

  if [[ "$basename" == "$NEW_MIGRATION" ]]; then
    found_new=true
    echo "==> holding back migration (applied after the BEFORE snapshot): $basename"
    continue
  fi

  echo "==> applying migration unchanged: $basename"
  "${PSQL[@]}" -d "$DBNAME" -f "$migration"
done

if [[ "$found_new" != true ]]; then
  echo "Missing required migration: $NEW_MIGRATION" >&2
  exit 1
fi

# ---------------------------------------------------------------------------
# Fixture. Loaded ONCE, before the BEFORE snapshot.
#
# It touches only seasons / teams / students / student_teams / events /
# event_sessions / attendance, all of which exist from 20260716000000 and
# 20260717000000, so it loads cleanly with the new migration still held back
# and needs no re-seed afterwards. Loading it twice would violate
# `attendance`'s unique (session_id, student_id).
#
# The `student_teams` rows and the outreach event are load-bearing for
# criterion (f): on a migrations-only cluster all four "nothing else moved"
# views return ZERO rows, and diffing two empty result sets proves nothing.
# `v_student_hours` in particular filters on ALL THREE of
# `es.status = 'completed'`, `e.counts_volunteer_hours and e.type = 'outreach'`,
# and `a.status in ('present','late')`
# (`20260804000000_volunteer_hours_outreach_only.sql:44-59`), so the outreach
# event needs a COMPLETED session carrying a PRESENT mark or that view stays
# empty and the criterion is meaningless.
# ---------------------------------------------------------------------------
echo "==> loading the GAM-442 fixture (6 events; fabricated names)"
"${PSQL[@]}" -d "$DBNAME" <<'FIXTURE'
begin;

insert into seasons (id, name, starts_on, ends_on, is_active, default_goal_hours) values
  ('44200000-0000-0000-0000-000000000001', 'Fixture Season GAM442', '2026-01-01', '2026-12-31', false, 100);

insert into teams (id, name, short_name, program, color, archived, sort_order) values
  ('44200000-0000-0000-0000-0000000000a1', 'Fixture Team GAM442', 'FG442', 'FRC', '#445566', false, 442);

-- A 5-student roster. Criterion (b3) needs the roster to be materially larger
-- than the number of marks on event E5.
insert into students (id, profile_id, display_name, team_id, grad_year, is_active, goal_hours_override) values
  ('44200000-0000-0000-0000-0000000000c1', null, 'Fixture Student One GAM442',   '44200000-0000-0000-0000-0000000000a1', 2027, true, null),
  ('44200000-0000-0000-0000-0000000000c2', null, 'Fixture Student Two GAM442',   '44200000-0000-0000-0000-0000000000a1', 2027, true, null),
  ('44200000-0000-0000-0000-0000000000c3', null, 'Fixture Student Three GAM442', '44200000-0000-0000-0000-0000000000a1', 2028, true, null),
  ('44200000-0000-0000-0000-0000000000c4', null, 'Fixture Student Four GAM442',  '44200000-0000-0000-0000-0000000000a1', 2028, true, null),
  ('44200000-0000-0000-0000-0000000000c5', null, 'Fixture Student Five GAM442',  '44200000-0000-0000-0000-0000000000a1', 2029, true, null);

-- 20260721000000_student_teams.sql's backfill already ran, so these students
-- (inserted afterwards) have no membership rows unless we write them.
-- v_student_participation joins student_teams with left_on is null.
insert into student_teams (student_id, team_id, joined_on, left_on)
select id, '44200000-0000-0000-0000-0000000000a1', date '2026-01-01', null
from students where id in (
  '44200000-0000-0000-0000-0000000000c1','44200000-0000-0000-0000-0000000000c2',
  '44200000-0000-0000-0000-0000000000c3','44200000-0000-0000-0000-0000000000c4',
  '44200000-0000-0000-0000-0000000000c5')
on conflict do nothing;

insert into events (id, season_id, type, title, description, location_name, address, team_ids, counts_participation, counts_volunteer_hours) values
  -- E1 (a)/(a2): 2 completed + 1 scheduled + 1 canceled session.
  ('44200000-0000-0000-0000-0000000000e1', '44200000-0000-0000-0000-000000000001', 'meeting',  'Fixture Meeting Alpha GAM442',    '', 'Fixture Hall', '1 Fixture Way', null, true,  false),
  -- E2 (b1): held session, zero marks.
  ('44200000-0000-0000-0000-0000000000e2', '44200000-0000-0000-0000-000000000001', 'meeting',  'Fixture Meeting Bravo GAM442',    '', 'Fixture Hall', '1 Fixture Way', null, false, false),
  -- E3 (b2)/(a2b): one held session, two marks, both excused.
  ('44200000-0000-0000-0000-0000000000e3', '44200000-0000-0000-0000-000000000001', 'meeting',  'Fixture Meeting Charlie GAM442',  '', 'Fixture Hall', '1 Fixture Way', null, false, false),
  -- E4 (c): no sessions at all.
  ('44200000-0000-0000-0000-0000000000e4', '44200000-0000-0000-0000-000000000001', 'meeting',  'Fixture Meeting Delta GAM442',    '', 'Fixture Hall', '1 Fixture Way', null, false, false),
  -- E5 (b3): the inflation case. counts_participation FALSE on purpose -- this
  -- view deliberately does not filter on it.
  ('44200000-0000-0000-0000-0000000000e5', '44200000-0000-0000-0000-000000000001', 'meeting',  'Fixture Meeting Echo GAM442',     '', 'Fixture Hall', '1 Fixture Way', null, false, false),
  -- E6: exists so v_student_hours has a row for criterion (f).
  ('44200000-0000-0000-0000-0000000000e6', '44200000-0000-0000-0000-000000000001', 'outreach', 'Fixture Outreach Foxtrot GAM442', '', 'Fixture Park', '2 Fixture Way', null, false, true);

insert into event_sessions (id, event_id, session_date, starts_at, ends_at, status, people_reached, notes) values
  ('44200000-0000-0000-0000-000000000511', '44200000-0000-0000-0000-0000000000e1', '2026-03-02', '2026-03-02T00:00:00Z', '2026-03-02T02:00:00Z', 'completed', null, ''),
  ('44200000-0000-0000-0000-000000000512', '44200000-0000-0000-0000-0000000000e1', '2026-03-09', '2026-03-09T00:00:00Z', '2026-03-09T02:00:00Z', 'completed', null, ''),
  ('44200000-0000-0000-0000-000000000513', '44200000-0000-0000-0000-0000000000e1', '2026-03-16', '2026-03-16T00:00:00Z', '2026-03-16T02:00:00Z', 'scheduled', null, ''),
  ('44200000-0000-0000-0000-000000000514', '44200000-0000-0000-0000-0000000000e1', '2026-03-23', '2026-03-23T00:00:00Z', '2026-03-23T02:00:00Z', 'canceled',  null, ''),
  ('44200000-0000-0000-0000-000000000521', '44200000-0000-0000-0000-0000000000e2', '2026-03-03', '2026-03-03T00:00:00Z', '2026-03-03T02:00:00Z', 'completed', null, ''),
  ('44200000-0000-0000-0000-000000000531', '44200000-0000-0000-0000-0000000000e3', '2026-03-04', '2026-03-04T00:00:00Z', '2026-03-04T02:00:00Z', 'completed', null, ''),
  ('44200000-0000-0000-0000-000000000561', '44200000-0000-0000-0000-0000000000e6', '2026-03-05', '2026-03-05T00:00:00Z', '2026-03-05T03:00:00Z', 'completed', null, '');

-- E5: 20 completed sessions.
insert into event_sessions (event_id, session_date, starts_at, ends_at, status, people_reached, notes)
select
  '44200000-0000-0000-0000-0000000000e5',
  date '2026-04-01' + n,
  (date '2026-04-01' + n)::timestamptz,
  (date '2026-04-01' + n)::timestamptz + interval '2 hours',
  'completed', null, ''
from generate_series(0, 19) as n;

insert into attendance (session_id, student_id, status, method, recorded_by) values
  -- E1 held session 1: present + late + excused.
  ('44200000-0000-0000-0000-000000000511', '44200000-0000-0000-0000-0000000000c1', 'present', 'coach', null),
  ('44200000-0000-0000-0000-000000000511', '44200000-0000-0000-0000-0000000000c2', 'late',    'coach', null),
  ('44200000-0000-0000-0000-000000000511', '44200000-0000-0000-0000-0000000000c3', 'excused', 'coach', null),
  -- E1 held session 2: absent + present.
  ('44200000-0000-0000-0000-000000000512', '44200000-0000-0000-0000-0000000000c1', 'absent',  'coach', null),
  ('44200000-0000-0000-0000-000000000512', '44200000-0000-0000-0000-0000000000c2', 'present', 'coach', null),
  -- E1 NON-HELD sessions. These marks must count NOWHERE, in any column.
  ('44200000-0000-0000-0000-000000000513', '44200000-0000-0000-0000-0000000000c1', 'present', 'coach', null),
  ('44200000-0000-0000-0000-000000000514', '44200000-0000-0000-0000-0000000000c2', 'present', 'coach', null),
  -- E3: every mark excused.
  ('44200000-0000-0000-0000-000000000531', '44200000-0000-0000-0000-0000000000c1', 'excused', 'coach', null),
  ('44200000-0000-0000-0000-000000000531', '44200000-0000-0000-0000-0000000000c2', 'excused', 'coach', null),
  -- E6: one present mark on a completed outreach session -> v_student_hours.
  ('44200000-0000-0000-0000-000000000561', '44200000-0000-0000-0000-0000000000c1', 'present', 'coach', null);

-- E5: only the 2 students who turned up each night are marked. The other 3 of
-- the 5-student roster have NO ROW -- which is the normal shape since T508 and
-- the whole point of criterion (b3).
insert into attendance (session_id, student_id, status, method, recorded_by)
select es.id, st.student_id, 'present', 'coach', null
from event_sessions es
cross join (values
  ('44200000-0000-0000-0000-0000000000c1'::uuid),
  ('44200000-0000-0000-0000-0000000000c2'::uuid)) as st(student_id)
where es.event_id = '44200000-0000-0000-0000-0000000000e5';

commit;
FIXTURE

# ---------------------------------------------------------------------------
# Criterion (f), part 1: the BEFORE snapshot, plus a non-vacuity check on it.
# A snapshot where any of the four views returns 0 rows on both sides is not a
# pass -- it is an unseeded fixture.
# ---------------------------------------------------------------------------
cat > "$WORK_DIR/four_views_snapshot.sql" <<'SNAP'
select student_id, season_id, round(confirmed_hours, 6) as confirmed_hours
from v_student_hours order by 1, 2;

select student_id, team_id, season_id, expected_ct, present_ct, late_ct, excused_ct, participation_pct
from v_student_participation order by 1, 2, 3;

select team_id, season_id, participation_pct
from v_team_participation order by 1, 2;

select season_id, expected_ct, present_ct, attendance_rate_pct
from v_season_attendance_rate order by 1;
SNAP

cat > "$WORK_DIR/four_views_counts.sql" <<'CNT'
select 'v_student_hours' as view, count(*) as rows from v_student_hours
union all select 'v_student_participation', count(*) from v_student_participation
union all select 'v_team_participation', count(*) from v_team_participation
union all select 'v_season_attendance_rate', count(*) from v_season_attendance_rate
order by 1;
CNT

echo "==> (f) BEFORE snapshot of v_student_hours / v_student_participation /"
echo "    v_team_participation / v_season_attendance_rate"
"${PSQL[@]}" -d "$DBNAME" -f "$WORK_DIR/four_views_snapshot.sql" > "$WORK_DIR/four_views_before.txt"
"${PSQL[@]}" -d "$DBNAME" -f "$WORK_DIR/four_views_counts.sql" | tee "$WORK_DIR/counts_before.txt"

echo "==> (f) non-vacuity: every one of the four views must return > 0 rows BEFORE"
"${PSQL[@]}" -d "$DBNAME" -v ON_ERROR_STOP=1 -c "
do \$\$
declare a int; b int; c int; d int;
begin
  select count(*) into a from v_student_hours;
  select count(*) into b from v_student_participation;
  select count(*) into c from v_team_participation;
  select count(*) into d from v_season_attendance_rate;
  raise notice '(f) BEFORE row counts: v_student_hours %, v_student_participation %, v_team_participation %, v_season_attendance_rate %', a, b, c, d;
  if a = 0 or b = 0 or c = 0 or d = 0 then
    raise exception '(f) UNSEEDED FIXTURE, not a pass: one of the four views is empty (% / % / % / %). Diffing empty result sets proves nothing.', a, b, c, d;
  end if;
end \$\$;"

# ---------------------------------------------------------------------------
# Criterion (e), stages 1-3. Run BEFORE the shipped migration so the "BEFORE
# revoke" state is the genuine stock-default-privileges one, untouched by any
# hand-written grant.
#
# The view DDL is taken from the migration file itself with only its final
# `revoke` statement removed, so the object under test is the real one.
# ---------------------------------------------------------------------------
awk '/^revoke all on public\.v_event_attendance from anon;/ { exit } { print }' \
  "$MIGRATIONS_DIR/$NEW_MIGRATION" > "$WORK_DIR/view_only.sql"
if grep -q '^revoke' "$WORK_DIR/view_only.sql"; then
  echo "FAIL: could not strip the revoke statement for the (e) BEFORE stage" >&2
  exit 1
fi

cat > "$WORK_DIR/anon_privs.sql" <<'PRIV'
select
  :'stage' as stage,
  coalesce(array_to_string(c.relacl, ' '), '<NULL: owner-only default>') as relacl,
  has_table_privilege('anon', 'public.v_event_attendance', 'select') as anon_select,
  has_table_privilege('anon', 'public.v_event_attendance', 'delete') as anon_delete,
  (select is_updatable from information_schema.views
    where table_schema = 'public' and table_name = 'v_event_attendance') as is_updatable
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relname = 'v_event_attendance';
PRIV

echo "==> (e) stage 1: creating the view WITHOUT the migration's revoke line, so the"
echo "    stock default privileges' effect on it is observable"
"${PSQL[@]}" -d "$DBNAME" -f "$WORK_DIR/view_only.sql" >/dev/null
"${PSQL[@]}" -d "$DBNAME" -v stage='BEFORE revoke (stock default privileges)' \
  -f "$WORK_DIR/anon_privs.sql" | tee "$WORK_DIR/e_before.txt"

echo "==> (e) stage 2: COUNTERFACTUAL -- 'revoke select' only, to show the statement"
echo "    does what it says. (The surviving DELETE below is what T205 was about; it"
echo "    is NOT a live concern here, because this view is is_updatable = 'NO'.)"
"${PSQL[@]}" -d "$DBNAME" -c "revoke select on public.v_event_attendance from anon;"
"${PSQL[@]}" -d "$DBNAME" -v stage='AFTER revoke SELECT only' \
  -f "$WORK_DIR/anon_privs.sql" | tee "$WORK_DIR/e_select_only.txt"

echo "==> (e) stage 3: restoring the stock grant, and checking the restore is faithful"
"${PSQL[@]}" -d "$DBNAME" -c "grant all on public.v_event_attendance to anon;"
"${PSQL[@]}" -d "$DBNAME" -v stage='BEFORE revoke (stock default privileges)' \
  -f "$WORK_DIR/anon_privs.sql" > "$WORK_DIR/e_restored.txt"
if ! diff -u "$WORK_DIR/e_before.txt" "$WORK_DIR/e_restored.txt"; then
  echo "FAIL (e): restoring the grant did not reproduce the stock state" >&2
  exit 1
fi
echo "==> (e) restore is byte-identical to the stock state"

# ---------------------------------------------------------------------------
# The migration, applied UNCHANGED. This is criterion (f)'s boundary and
# criterion (e)'s `revoke all`.
# ---------------------------------------------------------------------------
echo "==> applying migration unchanged: $NEW_MIGRATION"
"${PSQL[@]}" -d "$DBNAME" -f "$MIGRATIONS_DIR/$NEW_MIGRATION"

echo "==> (e) stage 4: the shipped state"
"${PSQL[@]}" -d "$DBNAME" -v stage='AFTER revoke ALL (shipped)' \
  -f "$WORK_DIR/anon_privs.sql" | tee "$WORK_DIR/e_after.txt"

"${PSQL[@]}" -d "$DBNAME" -c "
do \$\$
declare acl text; sel boolean; del boolean;
begin
  select coalesce(array_to_string(c.relacl, ' '), '<NULL>') into acl
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relname = 'v_event_attendance';
  sel := has_table_privilege('anon', 'public.v_event_attendance', 'select');
  del := has_table_privilege('anon', 'public.v_event_attendance', 'delete');
  if sel or del or acl like '%anon=%' then
    raise exception '(e) FAIL: anon retains privileges after revoke all -- select=% delete=% acl=%', sel, del, acl;
  end if;
  raise notice '(e) PASS: anon has no SELECT, no DELETE, and no acl entry at all';
end \$\$;"

# ---------------------------------------------------------------------------
# Criterion (f), part 2: the AFTER snapshot and the diff.
# ---------------------------------------------------------------------------
echo "==> (f) AFTER snapshot"
"${PSQL[@]}" -d "$DBNAME" -f "$WORK_DIR/four_views_snapshot.sql" > "$WORK_DIR/four_views_after.txt"
"${PSQL[@]}" -d "$DBNAME" -f "$WORK_DIR/four_views_counts.sql" | tee "$WORK_DIR/counts_after.txt"

echo "==> (f) diffing the four views BEFORE vs AFTER (must be byte-identical)"
if ! diff -u "$WORK_DIR/four_views_before.txt" "$WORK_DIR/four_views_after.txt"; then
  echo "FAIL (f): one of the four untouched views moved across this migration" >&2
  exit 1
fi
sha256sum "$WORK_DIR/four_views_before.txt" "$WORK_DIR/four_views_after.txt"
echo "==> (f) PASS: nothing else moved"

# `v_student_hours` specifically: meetings contribute ZERO volunteer hours
# (`20260804000000_volunteer_hours_outreach_only.sql`). Byte-identity above is
# guaranteed by construction for a create-view-only migration, so it is a cheap
# confirmation rather than an independent behavioural proof -- this checks the
# property it protects is still true.
echo "==> (f) v_student_hours property check: the 5 meeting events contribute 0 hours"
"${PSQL[@]}" -d "$DBNAME" -c "
do \$\$
declare hrs numeric; outreach_hrs numeric;
begin
  select coalesce(sum(confirmed_hours), 0) into hrs from v_student_hours
  where season_id = '$SEASON';
  select coalesce(sum(extract(epoch from (es.ends_at - es.starts_at)) / 3600.0), 0) into outreach_hrs
  from attendance a
  join event_sessions es on es.id = a.session_id and es.status = 'completed'
  join events e on e.id = es.event_id and e.type = 'outreach' and e.counts_volunteer_hours
  where a.status in ('present','late');
  raise notice '(f) v_student_hours season total = % h; outreach-only expectation = % h', hrs, outreach_hrs;
  if hrs <> outreach_hrs then
    raise exception '(f) FAIL: v_student_hours (%) does not equal the outreach-only total (%) -- meeting hours leaked in', hrs, outreach_hrs;
  end if;
end \$\$;"

# ---------------------------------------------------------------------------
# Criteria (a), (a2), (b), (b3), (c) and the column contract.
# ---------------------------------------------------------------------------
echo "==> the view, in full (event titles joined in for readability)"
"${PSQL[@]}" -d "$DBNAME" -c "
select left(e.title, 30) as event, va.held_ct, va.graded_marks_ct, va.excused_ct,
       va.attended_marks_ct, va.attendance_pct
from v_event_attendance va join events e on e.id = va.event_id
order by e.title;"

echo "==> running GAM-442 event-attendance assertions"
"${PSQL[@]}" -d "$DBNAME" -f "$SCRIPT_DIR/gam442_event_attendance_assertions.sql"

# ---------------------------------------------------------------------------
# Criterion (d): coach read, and the weaker ownership case.
#
# Without the default-privilege simulation above this proof is UNPASSABLE:
# measured, every view in the schema denies `authenticated`, because no
# migration grants it. So a green result here means the grant is real, not that
# the harness was lenient.
# ---------------------------------------------------------------------------
echo "==> (d) seeding a coach profile (fabricated) for the authenticated-session proofs"
"${PSQL[@]}" -d "$DBNAME" -c "
insert into auth.users (id, email) values ('$COACH', 'fixture.coach.gam442@example.invalid');
insert into profiles (id, display_name, email, role, avatar_url)
values ('$COACH', 'Fixture Coach GAM442', 'fixture.coach.gam442@example.invalid', 'coach', '');"

echo "==> (d) part 1: a coach (authenticated) SELECTs the shipped view"
"${PSQL[@]}" -d "$DBNAME" -c "
set request.jwt.claim.sub = '$COACH';
set role authenticated;
select current_user as as_role, count(*) as rows_visible,
       sum(held_ct) as total_held, count(attendance_pct) as non_null_pcts
from public.v_event_attendance;
reset role;"

echo "==> (d) part 2: the weaker ownership case -- same definition, owned by a"
echo "    NOSUPERUSER NOBYPASSRLS role, with base-table SELECT granted first (without"
echo "    that grant the run errors 42501 for a HARNESS reason, not an RLS one)"
"${PSQL[@]}" -d "$DBNAME" -c "
-- Roles are CLUSTER-wide while the scratch database is per-run, so this must be
-- idempotent or the second run of this script dies on 'role already exists'
-- (measured -- the first draft did exactly that). Its grants are per-database
-- and therefore fresh each time.
do \$\$
begin
  if not exists (select 1 from pg_roles where rolname = 'gam442_weak_owner') then
    create role gam442_weak_owner nosuperuser nobypassrls nologin;
  end if;
end;
\$\$;
grant usage, create on schema public to gam442_weak_owner;
grant select on public.events, public.event_sessions, public.attendance to gam442_weak_owner;
set role gam442_weak_owner;
do \$\$
declare def text;
begin
  select pg_get_viewdef('public.v_event_attendance'::regclass, true) into def;
  execute format('create view public.v_ea_weak_owner as %s', def);
end \$\$;
reset role;
grant select on public.v_ea_weak_owner to authenticated;
select relname, pg_get_userbyid(relowner) as owner,
       coalesce((select option_value from pg_options_to_table(reloptions)
                 where option_name = 'security_invoker'), 'off (default)') as security_invoker
from pg_class where relname in ('v_event_attendance', 'v_ea_weak_owner') order by relname;"

echo "==> (d) part 2a: coach reads the WEAK-OWNED view, security_invoker OFF (the"
echo "    shipped default). The OWNER's RLS applies, not the caller's."
"${PSQL[@]}" -d "$DBNAME" -c "
set request.jwt.claim.sub = '$COACH';
set role authenticated;
select 'weak owner, security_invoker OFF' as case, count(*) as rows_visible
from public.v_ea_weak_owner;
reset role;"

echo "==> (d) part 2b: the counterfactual -- the SAME view with security_invoker ON."
echo "    Now the CALLER's RLS applies and the coach's staff_all policy lets her see"
echo "    every event. Two directions, so the cause is localised."
"${PSQL[@]}" -d "$DBNAME" -c "
alter view public.v_ea_weak_owner set (security_invoker = on);
set request.jwt.claim.sub = '$COACH';
set role authenticated;
select 'weak owner, security_invoker ON' as case, count(*) as rows_visible
from public.v_ea_weak_owner;
reset role;"

echo "==> (d) part 2c: back OFF, confirming the flip is what moved the number"
"${PSQL[@]}" -d "$DBNAME" -c "
alter view public.v_ea_weak_owner set (security_invoker = off);
set request.jwt.claim.sub = '$COACH';
set role authenticated;
select 'weak owner, security_invoker OFF again' as case, count(*) as rows_visible
from public.v_ea_weak_owner;
reset role;"

echo "==> (d) machine-checked verdict on the ownership question"
"${PSQL[@]}" -d "$DBNAME" -c "
do \$\$
declare shipped int; weak_off int; weak_on int; events_total int;
begin
  perform set_config('request.jwt.claim.sub', '$COACH', false);
  select count(*) into events_total from public.events;
  set local role authenticated;
  select count(*) into shipped from public.v_event_attendance;
  select count(*) into weak_off from public.v_ea_weak_owner;
  reset role;
  alter view public.v_ea_weak_owner set (security_invoker = on);
  set local role authenticated;
  select count(*) into weak_on from public.v_ea_weak_owner;
  reset role;
  alter view public.v_ea_weak_owner set (security_invoker = off);

  raise notice '(d) coach sees % of % events through the SHIPPED view (superuser owner)', shipped, events_total;
  raise notice '(d) coach sees % through the WEAK-OWNED view with security_invoker OFF', weak_off;
  raise notice '(d) coach sees % through the SAME view with security_invoker ON', weak_on;

  if shipped <> events_total then
    raise exception '(d) FAIL: the coach could not read the shipped view (% of %)', shipped, events_total;
  end if;
  if weak_off <> 0 or weak_on <> events_total then
    raise exception '(d) FAIL: expected 0 rows with security_invoker off and % with it on, got % / %',
      events_total, weak_off, weak_on;
  end if;
  raise notice '(d) PASS: the view executes as its OWNER and does NOT apply the querying session''s RLS to base tables -- flipping security_invoker moved the count from % to %, so the cause is localised. The result therefore holds a fortiori for a NOSUPERUSER NOBYPASSRLS owner as well as for a superuser one.', weak_off, weak_on;
end \$\$;"

echo "==> GAM-442 event-attendance tests: ALL PASS"
