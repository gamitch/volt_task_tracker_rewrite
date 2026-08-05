-- T509 (D014): MET-01's denominator becomes EXPLICIT MARKS, not eligibility.
--
-- Additive migration -- `create or replace view` in a NEW file, per
-- constitution item 10, same route `20260804000000_volunteer_hours_outreach_
-- only.sql` and `20260805000000_dashboard_views_comment_corrections.sql` took.
-- No existing migration file is edited.
--
-- ---------------------------------------------------------------------------
-- WHY. `v_student_participation`'s `expected` CTE was a cross product of
-- eligible students x completed sessions, LEFT JOINed to `attendance`. So the
-- denominator counted ELIGIBILITY: a student with no attendance row still
-- contributed 1 to it. The sub-teams that actually decide who is expected
-- (business/build/software) sit BELOW `teams` and are deliberately unmodelled,
-- so expected-attendance is not derivable from any data this app holds --
-- D014's reasoning, unchanged here.
--
-- MEASURED before writing this, on PostgreSQL 16.13 with a two-student
-- fixture (one marked present + absent, one never marked at all):
--
--   BEFORE   Fixture Marked    expected_ct=2  present_ct=1  ->  50.0%
--            Fixture Unmarked  expected_ct=2  present_ct=0  ->   0.0%   <-- LIE
--
-- The second student had ZERO attendance rows. Nobody ever marked them, and
-- the app reported they attended 0% of sessions. **T508 made that the DEFAULT
-- case, not an edge case**: absences are now only written when a coach
-- explicitly opts in, so "no row" is what an unmarked student normally looks
-- like. That is the concrete user-facing defect this migration closes.
--
--   AFTER    Fixture Marked    expected_ct=2  present_ct=1  ->  50.0%  (same, now counting MARKS)
--            Fixture Unmarked  <no row at all>              ->  '—'
--
-- `ParticipationTab.tsx`'s `buildDisplayRows` already synthesises an
-- all-`null` display row for any active student missing from this view, and
-- the table already renders `participationPct === null` as `—` (`:830-831`).
-- So "no marks" reaches the screen as `—` through machinery that already
-- exists; nothing in the UI needed a new empty state.
--
-- ---------------------------------------------------------------------------
-- THE DENOMINATOR, stated exactly, because the T509 row's phrasing is
-- ambiguous and would double-subtract if taken literally.
--
-- The row reads: "`present+late` / (`present+late+absent` - `excused`)".
-- `attendance.status` is `check (status in ('present','late','excused',
-- 'absent'))` -- four MUTUALLY EXCLUSIVE values. So `present+late+absent`
-- already excludes excused, and subtracting `excused` again would remove it
-- twice.
--
-- The denominator implemented below is: **rows that exist, minus excused**
--   = (present + late + excused + absent) - excused
--   = present + late + absent
-- which is what the row's expansion evidently meant. Written as
-- `count(*) - count(*) filter (where status = 'excused')` so it reads as the
-- rule ("every mark except an excused one") rather than an enumeration that
-- would silently drift if a fifth status were ever added.
--
-- ---------------------------------------------------------------------------
-- NULL, NOT A FLOOR. The old views divided by `greatest(..., 1)`, which turned
-- "no qualifying marks" into 0% -- a fabricated number. Both views below now
-- return NULL in that case, which the UI already renders as `—`. This also
-- covers the all-excused student: every mark excused means no denominator, so
-- `—`, not 0%.
--
-- ---------------------------------------------------------------------------
-- THE COLUMN KEEPS ITS NAME, and that was a REVERSED DECISION worth recording.
--
-- `expected_ct` now counts explicit marks, so the name is a poor fit, and the
-- first draft of this migration renamed it to `marked_ct` (which works: PG
-- refuses a rename inside CREATE OR REPLACE, but `ALTER VIEW ... RENAME
-- COLUMN` succeeds, and the dependent `v_team_participation` auto-follows it
-- by attribute number -- both verified on 16.13).
--
-- **It was reverted after measuring the blast radius, which was larger than
-- estimated.** `expected_ct` is selected FROM THIS VIEW BY NAME in three
-- separate loaders -- `loaders/reports.ts:253`, `loaders/checkin.ts:336`,
-- `loaders/meetings.ts:425`, each listing it in an explicit `.select(...)`.
-- Renaming the column would break all three AT RUNTIME (a PostgREST error on
-- an unknown column), not merely churn their types. That is a production
-- break in three surfaces for a naming improvement, and T509 does not
-- authorise it.
--
-- Two adjacent things that look like the same field and are NOT, recorded so
-- the next person does not "finish the rename":
--   * `v_season_attendance_rate` has its OWN `expected_ct`
--     (`loaders/dashboard.ts:233`) -- a different view, untouched here.
--   * `MeetingsList.tsx`'s `expectedCt` is an RSVP `status = 'going'` count
--     (`:371`) -- unrelated to this view entirely.
--
-- So the column name stays and the catalog comment below carries the meaning.
-- The USER-VISIBLE label is what actually gets corrected: RPT-02's column
-- header changes from "Expected" to "Marked", because D014's stated
-- mitigation for the inverted failure direction is that RPT-02 SHOWS these
-- counts -- a mitigation that only works if the on-screen label is true.

-- ---------------------------------------------------------------------------
-- THE KNOWN COST, recorded in D014 and repeated here because it is a real
-- regression in one direction: this INVERTS the failure mode. Forgetting to
-- mark a student now INFLATES participation (their unmarked sessions simply
-- do not count) where it previously deflated it (they counted as absent).
-- RPT-02's visible marked/present/late/excused counts are the mitigation.
-- **If RPT-02 ever stops showing them, D014 must be revisited.**

create or replace view v_student_participation as
with marked as (
  -- INNER join to `attendance`: only sessions the student actually has a mark
  -- for. This single change is the whole of MET-01's new denominator -- the
  -- old definition LEFT JOINed here, which is what let eligibility count.
  select s.id as student_id, st.team_id, e.season_id, a.status
  from students s
  join student_teams st on st.student_id = s.id and st.left_on is null
  join attendance a on a.student_id = s.id
  join event_sessions es on es.id = a.session_id and es.status = 'completed'
  join events e on e.id = es.event_id
    and e.counts_participation
    and (e.team_ids is null or st.team_id = any(e.team_ids))
  where s.is_active
)
select
  student_id, team_id, season_id,
  count(*) as expected_ct,
  count(*) filter (where status in ('present', 'late')) as present_ct,
  count(*) filter (where status = 'late')    as late_ct,
  count(*) filter (where status = 'excused') as excused_ct,
  case
    when count(*) - count(*) filter (where status = 'excused') = 0 then null
    else round(
      100.0 * count(*) filter (where status in ('present', 'late'))
      / (count(*) - count(*) filter (where status = 'excused')), 1)
  end as participation_pct
from marked
group by student_id, team_id, season_id;

comment on column v_student_participation.expected_ct is
  'T509/D014 -- READ THIS BEFORE TRUSTING THE NAME. Since T509 this counts the completed, participation-counting sessions the student has an EXPLICIT attendance mark for. It does NOT count sessions they were eligible for, which is what the name suggests and what it meant before T509. The name is retained deliberately: loaders/reports.ts, loaders/checkin.ts and loaders/meetings.ts each select this column BY NAME, so renaming it would break three surfaces at runtime. RPT-02 displays it under the header "Marked", which is the accurate label. A student with no marks has NO ROW in this view at all -- the UI renders that as an em dash, never 0%.';

-- The team rollup must move with it, or the two disagree: it aggregates this
-- view's own counts, so leaving its `greatest(..., 1)` floor in place would
-- report 0% for a team whose students have no marks while every one of those
-- students correctly showed an em dash.
create or replace view v_team_participation as
select team_id, season_id,
  case
    when sum(expected_ct) - sum(excused_ct) = 0 then null
    else round(100.0 * sum(present_ct) / (sum(expected_ct) - sum(excused_ct)), 1)
  end as participation_pct
from v_student_participation
group by team_id, season_id;
