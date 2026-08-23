-- ---------------------------------------------------------------------------
-- GAM-479. The attendance un-mark stops being a row DELETE.
--
-- WHY. `MTG-01g`'s tap-to-cycle chip (`VOLT_Portal_PRD.md:382`) ends its cycle
-- on `(unset)`, and `(unset)` was wired to `makeRemoveAttendance`
-- (`src/lib/supabase/loaders/attendance.ts`) -- an unconditional
-- `delete from attendance`. The deleted row carries `check_in_at`,
-- `check_out_at`, `hours_override`, `method` and `recorded_by`, so one tap
-- past `Absent` silently destroyed a QR check-in timestamp and a coach-set
-- hours override. Nothing recovered them: the attendance audit trigger was
-- deliberately dropped by `20260803000000_simplify_attendance_audit.sql:38-39`.
--
-- THE CHANGE. `attendance.status` gains a FIFTH value, `'unmarked'` -- a
-- sentinel meaning "a coach cleared this mark, and the row's other columns are
-- being kept". The chip's fifth stop now writes that value through the same
-- non-destructive upsert every other stop uses
-- (`makeSetAttendanceStatus`, which omits `hours_override` and `check_in_at`
-- from its payload precisely so a status change cannot clobber them). No
-- delete, so nothing to undo.
--
-- WHAT THIS IS NOT. This does NOT restore the "setAbsent" veto that product
-- decision D-7 struck down (quoted verbatim at `attendance.ts:41-56`: "As
-- coach I am ultimate authority and should be able to overwrite an RSVP or
-- check-ins"). D-7 removed code that REFUSED to clear `qr`/`import` rows,
-- protecting them from the coach. A coach still clears any mark, of any
-- `method`, in one action. Only the storage of the cleared state changes,
-- never who may clear it.
--
-- BOTH un-mark surfaces moved to it: `SessionRow.tsx`'s chip cycle and
-- `AttendancePanel.tsx`'s checkbox. `makeRemoveAttendance` therefore has no
-- callers left and was REMOVED rather than kept exported -- an exported
-- attendance DELETE is how this data-loss path gets re-wired later by
-- someone who does not know why it went. There is no `delete from
-- attendance` anywhere in the application now, and a test asserts that.
--
-- Consequence, stated here rather than discovered later: `attendance` rows
-- are append-and-update only, so a session that ever carried marks stays
-- undeletable (`session_id` is `on delete restrict`) and `meetings.ts`'s
-- session-removal guard routes it to `cancel`. That guard already did
-- exactly this for a session with marks; what changes is that clearing every
-- mark no longer makes the session deletable again.
--
-- THE INVARIANT THIS FILE ESTABLISHES. `'unmarked'` is a STORAGE state, not an
-- application state. Every read in `src/lib/supabase/loaders/**` filters it
-- out through `attendance.ts`'s `excludeUnmarked` helper -- in TypeScript,
-- on the mapped result, NOT as a `.neq(...)` clause on each query: this
-- repo's hand-rolled query-builder fakes are passthrough chains that record
-- arguments instead of filtering, so a `.neq` would be invisible to every
-- fixture and no test could show a cleared row being dropped. So a cleared
-- row is indistinguishable from no row everywhere above the loader boundary,
-- and the four-value `AttendanceStatus` union is unchanged. The two exceptions are deliberate and
-- documented at their call sites:
--   * `meetings.ts`'s `queryAttendanceExistsForSessions` -- the session-delete
--     guard. `attendance.session_id` is `on delete restrict`
--     (`20260717000000_scheduling_attendance.sql:84`), so a sentinel row still
--     blocks a session delete and the guard must see it to choose "cancel"
--     over "delete".
--   * `endMeeting.ts`'s `markAbsences` -- see its own sentinel sweep.
--
-- The two views below query `attendance` DIRECTLY and so cannot rely on that
-- loader-level filter. They are the ONLY two that need it: every other live
-- consumer is already safe, verified against the full migration set --
--   * `v_student_hours`, `v_season_kpis` (`20260804000000:56,86`) already
--     restrict to `a.status in ('present','late')`;
--   * `v_season_dashboard`'s attendance CTE (`20260723000001:222`) counts rows
--     of its own `expected` CTE through a LEFT join, so a sentinel row and no
--     row produce identical output;
--   * `20260723000001:289` joins on `a.status in ('present','late')`;
--   * the `v_student_participation` / `v_team_participation` / `v_season_kpis`
--     bodies in `20260717000003`, `20260722000000` and `20260723000000` are
--     all superseded by later `create or replace` statements and are
--     historical text only.
-- ---------------------------------------------------------------------------

-- 1. Widen the CHECK. `status` stays `not null` -- the sentinel is a real
--    value, not the null-status design GAM-479's own text proposed and which
--    would have required dropping that constraint.
alter table public.attendance
  drop constraint attendance_status_check;

alter table public.attendance
  add constraint attendance_status_check
  check (status in ('present', 'late', 'excused', 'absent', 'unmarked'));

-- 2. `v_student_participation` -- T509/D014's explicit-marks denominator.
--    Verbatim copy of `20260806000000_met01_explicit_marks.sql:102-130`; the
--    ONLY change is `and a.status <> 'unmarked'` on the INNER join. Without
--    it a cleared row counts as an explicit mark, entering `expected_ct` and
--    deflating `participation_pct` -- constitution item 3.
create or replace view v_student_participation as
with marked as (
  -- INNER join to `attendance`: only sessions the student actually has a mark
  -- for. This single change is the whole of MET-01's new denominator -- the
  -- old definition LEFT JOINed here, which is what let eligibility count.
  -- GAM-479: `<> 'unmarked'` keeps a coach-cleared row out of the denominator,
  -- restoring exactly the "no row at all" arithmetic the DELETE used to give.
  select s.id as student_id, st.team_id, e.season_id, a.status
  from students s
  join student_teams st on st.student_id = s.id and st.left_on is null
  join attendance a on a.student_id = s.id and a.status <> 'unmarked'
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

-- `v_team_participation` needs no change: it aggregates the view above and
-- never touches `attendance` itself, so the fix propagates.

-- 3. `v_event_attendance` (GAM-442) -- the coach series card's headline.
--    Verbatim copy of `20260821000000_meetings_event_attendance_view.sql:
--    165-190`; the ONLY change is `and a.status <> 'unmarked'` on the LEFT
--    join. Without it a cleared row is counted by `count(a.id)` into
--    `graded_marks_ct` and into `attendance_pct`'s
--    `count(a.id) - excused` denominator, neither of which filters by status.
create or replace view public.v_event_attendance as
select
  e.id as event_id,
  -- SESSIONS, not marks. `distinct` is load-bearing: see the fan-out note in
  -- this view's original migration.
  count(distinct es.id) as held_ct,
  -- MARKS. `count(a.id)`, never `count(*)` -- the null-extended left-join row
  -- would otherwise be counted as a phantom mark.
  count(a.id) as graded_marks_ct,
  count(a.id) filter (where a.status = 'excused') as excused_ct,
  -- MET-05: `late` is attended.
  count(a.id) filter (where a.status in ('present', 'late')) as attended_marks_ct,
  case
    when count(a.id) - count(a.id) filter (where a.status = 'excused') = 0 then null
    else round(
      100.0 * count(a.id) filter (where a.status in ('present', 'late'))
        / (count(a.id) - count(a.id) filter (where a.status = 'excused')), 1)
  end as attendance_pct
from public.events e
-- LEFT, so a zero-session event still gets a row. `status = 'completed'` lives
-- in the join condition, not a WHERE clause, for the same reason.
left join public.event_sessions es
  on es.event_id = e.id and es.status = 'completed'
-- GAM-479: `<> 'unmarked'` in the join condition (NOT a WHERE clause -- that
-- would collapse the LEFT join and drop zero-mark events entirely).
left join public.attendance a
  on a.session_id = es.id and a.status <> 'unmarked'
group by e.id;
