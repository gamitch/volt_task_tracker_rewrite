# Worker Packet: T013

## Task ID
T013

## Objective
Add one new additive Supabase migration file that creates the three PRD 8.4 metric views (`v_student_hours`, `v_student_participation`, `v_team_participation`) as a **byte-verbatim copy** of the SQL block below. Do not re-derive, paraphrase, reformat, or "improve" the SQL in any way.

## Dependencies (status)
T010 — Passed. T012 — Passed.

## Allowed Files
- Exactly one new file: `supabase/migrations/<timestamp>_metric_views.sql`
  - Before naming the file, run `ls supabase/migrations/` yourself to find the actual latest existing migration filename (expected to be `20260717000002_rls.sql` as of packet-writing time, but verify — do not assume). Your new file's timestamp prefix must sort after it (e.g. `20260717000003_metric_views.sql`).

## Forbidden Files
- Any existing file under `supabase/migrations/` (T009, T010, T011, T012's migration files) — editing an applied migration file is a constitution item 10 BLOCKER.
- `docs/swarm/**`, `.claude/**`
- Any file under `src/` (see BLOCKER note below on formula duplication)

## Ground Truth SQL — copy this verbatim, do not modify

```sql
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
```

## Implementation note — include this verbatim as a SQL comment above the views in your migration file
"Implementation note (accepted deviation from MET-01's 'while active' phrasing): activity is the current is_active boolean — deactivated students drop out of the views (ROS-09 history remains in base tables). NFR-03 fixtures test: excused-shrinks-denominator, hours_override-wins, check-in clamping to the session window, and the no-completed-sessions '—' case (expected_ct = 0 rows simply absent; UI renders '—')."

## Context you should know but must not act on directly
T012's checker deliberately deferred a gap (Trap 1): `students` RLS policies only cover `staff_all` + `own_or_linked_read`, so teammate name/team visibility for a future leaderboard was left unresolved, with the explicit expectation that T013's views would close it. **These three views as specified above do not themselves add student name/team visibility** — they are aggregate numeric views keyed by `student_id`/`team_id`, not name-joining views. Do not invent a fourth view or modify the three views' shape to add name/team columns not present in the verbatim block — that would violate the verbatim-copy requirement (constitution item 3, BLOCKER). If you believe the Trap 1 gap genuinely cannot be closed by these three views as specified, say so explicitly in your worker output as a flagged risk/note rather than improvising a workaround. This is a known open question for the checker and foreman to resolve, not something to solve unilaterally.

## Acceptance Criteria
- New migration file contains a byte-verbatim copy of the three `create or replace view` statements above (constitution item 3 — BLOCKER if re-derived, reformatted, or reworded).
- No metric formula (hours computation, participation percentage, clamping logic) is duplicated anywhere in TypeScript/`src/` (constitution item 3 / PRD DATA-01 — BLOCKER if found). Run `grep -rn "participation_pct\|confirmed_hours\|hours_override" src/` yourself and confirm zero hits, or report exactly what you found.
- No existing migration file changed (constitution item 10 — verify via `git status`/diff against the four existing migration files, confirm zero diff).
- Validate against a real scratch Postgres instance if one is available in this sandbox (same precedent as T009–T012): apply migrations in order T009 → T010 → T011 → T012 → your new T013 file, then seed minimal fixture data (fabricated names only — constitution item 6, no real student names/emails) covering all four NFR-03 cases named in the implementation note:
  1. excused-shrinks-denominator (an excused attendance row reduces the participation denominator, not just the numerator)
  2. hours_override-wins (when `attendance.hours_override` is set, it wins over the computed check-in/check-out duration)
  3. check-in clamping to the session window (check-in before session start or check-out after session end gets clamped to `es.starts_at`/`es.ends_at`, never negative, never over-counted)
  4. no-completed-sessions "—" case (a student/team with zero completed sessions simply produces zero rows from the view — confirm this, don't assume)
- If no scratch Postgres is available, say so explicitly and explain what you did instead (e.g. static SQL review) — do not claim verification you didn't perform.

## Relevant Constitution Excerpts
- Item 3: "RLS policies and metric SQL come only from PRD Section 8.4, copied verbatim. Re-deriving either, or duplicating a metric formula in TypeScript (PRD DATA-01) → BLOCKER."
- Item 6: "No PII (student names, emails) in logs, URLs, analytics, commit messages, or test fixtures — fixtures use fabricated names."
- Item 10: "Database changes are additive migrations via the Supabase CLI; editing an applied migration file → BLOCKER."
- Non-Negotiable: "No worker may mark its own work complete."

## Most Recent Failure
None. This is the first attempt (attempt count: 0).

## Required Worker Output
- files changed (exact new filename)
- full contents of the new migration file
- diff/checksum evidence that the SQL block is unmodified vs. the ground truth above
- grep output confirming no TS formula duplication
- scratch-Postgres validation commands and output (or explicit statement that no scratch instance was available and what was done instead)
- explicit note on the Trap 1 context section above — confirm you did not modify view shape to address it, and flag it as an open question if relevant
- known risks
- whether a dispute is needed
