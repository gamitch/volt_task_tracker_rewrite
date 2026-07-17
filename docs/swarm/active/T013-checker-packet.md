# Checker Packet: T013

## Task ID
T013 — Metric views (PRD Section 8.4 verbatim: `v_student_hours`, `v_student_participation`, `v_team_participation`)

## Checker Agent
checker-tests

## Attempt
Check attempt 1 of 3 (max 3 before mandatory boss-arbiter escalation per constitution "Loop Limit").

## Objective Being Checked
One new additive migration, `supabase/migrations/20260717000003_metric_views.sql`, containing a byte-verbatim copy of PRD 8.4's three metric views plus the prescribed implementation-note comment. No TypeScript formula duplication. No existing migration file touched.

Treat every worker claim below as a hypothesis to independently verify, not as evidence. This task is not as high-stakes as T012 (no RLS/security surface), but constitution item 3 ("RLS policies and metric SQL come only from PRD Section 8.4, copied verbatim... duplicating a metric formula in TypeScript → BLOCKER") is still explicitly BLOCKER-class here, and these views are the sole source of truth several downstream E5/E6/E8/E9 tasks (T014, T037, T044, T050, T056, T057) will build on. A wrong denominator or a silently-reformatted view ships an incorrect number to students/parents.

**Note on evidence availability:** the worker's output (including its claimed scratch-Postgres transcript and its self-caught fixture-bug narrative) was reported conversationally and was not persisted to disk anywhere in this repo — there is no `T013-latest-result.md` or equivalent artifact for you to read. Do not treat any of the worker's claims below, including the "fixture bug" narrative, as verified just because it sounds plausible or specific. Generate your own evidence from scratch, per the Definition of Done ("no task may be marked complete on a worker self-report").

## Allowed Files (yours to inspect only — you do not modify repo files)
- `supabase/migrations/20260717000003_metric_views.sql` (T013, read-only inspection)
- `supabase/migrations/20260716000000_identity_roster.sql` (T009 — read-only, zero-diff baseline)
- `supabase/migrations/20260717000000_scheduling_attendance.sql` (T010 — read-only, zero-diff baseline)
- `supabase/migrations/20260717000001_support_audit.sql` (T011 — read-only, zero-diff baseline)
- `supabase/migrations/20260717000002_rls.sql` (T012 — read-only, zero-diff baseline)
- `src/**` (read-only, for the TS formula-duplication grep)

If you need to stand up a scratch Postgres instance and write setup/seed SQL or shell scripts to do so, write those files to your own scratchpad/temp working area — never into this repository.

## Forbidden Files (BLOCKER if the worker touched any of these — verify by file-tree/content inspection, not git history)
- `supabase/migrations/20260716000000_identity_roster.sql` (T009)
- `supabase/migrations/20260717000000_scheduling_attendance.sql` (T010)
- `supabase/migrations/20260717000001_support_audit.sql` (T011)
- `supabase/migrations/20260717000002_rls.sql` (T012)
- Anything under `src/`
- `docs/swarm/**`, `.claude/**`
- Anything outside the single new migration file

## Ground Truth 1 — PRD Section 8.4 metric views (byte-verbatim required)

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

## Ground Truth 2 — required implementation-note comment (verbatim, placed above the views)

```
Implementation note (accepted deviation from MET-01's 'while active' phrasing): activity is the current is_active boolean — deactivated students drop out of the views (ROS-09 history remains in base tables). NFR-03 fixtures test: excused-shrinks-denominator, hours_override-wins, check-in clamping to the session window, and the no-completed-sessions '—' case (expected_ct = 0 rows simply absent; UI renders '—').
```

This is packet-prescribed text (not itself PRD 8.4 SQL), so it doesn't need to be byte-verbatim against a PRD source — but confirm it is present, substantively unchanged, and rendered as a SQL comment (`--`), not dropped or paraphrased into something that changes its meaning (e.g. don't accept a rewording that silently drops the "deactivated students drop out" clause).

## Ground Truth 3 — Trap 1 context (why the views correctly do NOT add name/email columns)

T012's checker deliberately deferred a gap ("Trap 1"): `students` RLS policies only cover `staff_all` + `own_or_linked_read`, so teammate name/team visibility for a future leaderboard was left unresolved, with T013 flagged as the place that *might* close it. T013's worker packet (see `docs/swarm/active/T013-worker-packet.md`, "Context you should know but must not act on directly") explicitly told the worker **not** to invent a fourth view or reshape the three views to add name/team columns, since that would violate the verbatim-copy requirement — and instructed the worker to flag Trap 1 forward as a still-open question if it couldn't be closed within the verbatim SQL, rather than improvise. The worker claims it left the views exactly as specified (aggregate-only, keyed by `student_id`/`team_id`, no name/email columns) and flagged Trap 1 forward rather than treating it as a T013 defect — matching the same pattern T012's own checker used when it deferred the gap in the first place.

## Required Verification Steps

1. **Byte-verbatim view diff.** Read `20260717000003_metric_views.sql` directly yourself. Extract the three `create or replace view` statements and diff them byte-for-byte (use `diff`/checksum, e.g. write Ground Truth 1 to a scratch file and `diff -u` or `sha256sum` both sides — not eyeballing) against Ground Truth 1 above. Report the actual command and output. Any difference, including whitespace/blank-line differences, → BLOCKER per constitution item 3. Do not accept "looks the same on read" as sufficient — this is exactly the claim the worker made and you are checking, not re-asserting.

2. **Implementation-note comment check.** Confirm the comment block above the views matches Ground Truth 2 in substance (present, correctly worded, not dropped/reworded to change meaning) and is a real SQL comment, not executable SQL.

3. **TS formula-duplication grep — independent.** Run your own `grep -rn "participation_pct\|confirmed_hours\|hours_override" src/` (do not reuse the worker's reported output as your evidence — run it yourself) and confirm zero hits. Any hit → BLOCKER per constitution item 3 / PRD DATA-01.

4. **T009/T010/T011/T012 zero-diff.** Read all four prior migration files directly and confirm byte-identical content to their known-good state (cross-reference `docs/swarm/archive/T009-checker-packet.md` / `T010-checker-packet.md` / `T011-checker-packet.md` / `T012-checker-packet.md` if useful, but the primary evidence must be your own direct read of the current file contents). Use direct file-content comparison, never git commit/authorship history, per the D001 standing rule.

5. **Forbidden-file / scope check (D001 standing rule).** Compare the actual file tree against the Allowed Files list directly (file-tree/content state, never git-log/commit-bundling as evidence). Confirm exactly one new file exists under `supabase/migrations/` beyond the T009–T012 baseline, nothing under `src/` changed, and nothing else in the repository changed. (Do not flag the existence of this checker packet itself, `docs/swarm/active/*.md` worker/checker packets in general, or hook-appended `verification-log.md` lines as findings — those are normal swarm-operation byproducts, not artifacts the worker produced; see the standing calibration note in `docs/swarm/state-summary.md`.)

6. **Independent scratch-Postgres NFR-03 validation — build your own fixtures, do not reuse the worker's.** Stand up your own scratch Postgres instance (same precedent as T009→T012: minimal `auth.uid()`/`auth.users` scaffolding — see any of the T009–T012 archived checker packets for the established pattern). Apply migrations in strict order T009 → T010 → T011 → T012 → T013 (this new file). Design and seed your **own** fixture data (fabricated names only, per constitution item 6 — no real student names/emails) covering all four NFR-03 cases from the implementation note. This is not redundant with the worker's own validation: the worker itself found and fixed a bug in its own fixture design mid-validation (see step 7), which is direct evidence that fixture construction for these views is error-prone enough that independent fixtures are real additional verification, not busywork. At minimum, produce your own real command + real result-row evidence for:
   a. **excused-shrinks-denominator** — a student with an excused attendance row and a present attendance row against `expected_ct = 2` must show the excused row reducing the denominator (`expected_ct - excused_ct`), not just failing to count in the numerator. Confirm the exact `participation_pct` value your fixture produces and show the arithmetic.
   b. **hours_override-wins** — a student with a full check-in/check-out span that would otherwise compute to some duration, but with `attendance.hours_override` set to a different explicit value, must show `confirmed_hours` equal to the override, not the computed duration.
   c. **check-in clamping** — (i) a check-in before session start and/or check-out after session end must clamp to `es.starts_at`/`es.ends_at`, not credit the extra time; (ii) a check-in/check-out pair that falls entirely outside the session window (e.g. both after `es.ends_at`) must clamp to zero, never go negative.
   d. **no-completed-sessions "—" case** — a student/team whose only session(s) never reach `status = 'completed'` must produce zero rows from `v_student_participation`/`v_team_participation` for that team, not a row with `expected_ct = 0`. Confirm this by querying and showing an actual empty result set, not by inference.

7. **Fixture-bug narrative — verify the underlying claim independently, don't just accept the story.** The worker claims it briefly had a fixture bug where an event with `team_ids = null` pulled in a student who shouldn't have been in scope, and that on investigation this was correctly attributed to the view's own join semantics (`e.team_ids is null or s.team_id = any(e.team_ids)` — Ground Truth 1, `v_student_participation`'s `expected` CTE) treating a null `team_ids` as "applies to all teams," which is intentional per the verbatim spec, not a bug in the SQL. You have no persisted artifact of the worker's actual fixture data or reasoning to re-read (see the note under Objective above), so you cannot confirm this by reading the worker's evidence — instead, confirm the *underlying claim* directly: build your own fixture with an event where `team_ids is null` and confirm every active student on every team is pulled into `expected` for that event's completed sessions (i.e. the null-means-all-teams semantics is real and matches the verbatim SQL, not a defect). If that's what you observe, the worker's self-correction narrative is consistent with real view behavior even though you can't verify the narrative itself happened as described — say so explicitly rather than either blindly trusting or unfairly dismissing the claim.

8. **Trap 1 gap confirmation.** Confirm by direct read of the shipped SQL that none of the three views adds a `name`, `email`, or other PII/identity column beyond `student_id`/`team_id`/`season_id` and the numeric aggregates in Ground Truth 1, and that `v_student_participation`'s `expected` CTE does not reintroduce a self-referential `students`-subquerying-`students` pattern (it should only join `students`→`events`→`event_sessions`, never `students` against itself). Confirm your understanding matches Ground Truth 3: this is correctly an intentional gap flagged forward (a genuine open question for whichever future task — most likely T044, the leaderboard — closes it, e.g. via a dedicated read-only join view or an RLS-scoped API layer), not a T013 defect, and confirm the worker's packet correctly forbade improvising a fourth view or reshaping these three to close it.

## Relevant Constitution Excerpts

> 3. RLS policies and metric SQL come **only** from PRD Section 8.4, copied verbatim. Re-deriving either, or duplicating a metric formula in TypeScript (PRD DATA-01) → BLOCKER.
>
> 6. No PII (student names, emails) in logs, URLs, analytics, commit messages, or test fixtures — fixtures use fabricated names.
>
> 10. Database changes are additive migrations via the Supabase CLI; editing an applied migration file → BLOCKER.
>
> Non-Negotiable: "No worker may mark its own work complete." / "Every checker must inspect the actual artifact, not just the worker's summary."

## Known Context / Non-Issues (do not re-flag as new findings, but do verify each is actually true — none of these are pre-approved without your own check)
- The Trap 1 gap (Ground Truth 3) is expected to be an intentional, correctly-flagged-forward gap, not a T013 defect — but you must still confirm no PII/identity columns snuck in and no self-referential subquery was reintroduced.
- The worker's fixture-bug narrative (step 7) is a claim about the worker's own process, not something you can verify happened as described — verify the underlying view-semantics claim instead, and say explicitly that you could not independently confirm the narrative itself for lack of a persisted artifact.

## Most Recent Failure
None — this is T013's first check attempt.

## Required Checker Output (per constitution Evidence Requirements)
- files inspected
- exact commands run + real quoted output (not summarized/paraphrased) — including whether a scratch Postgres was reachable, and if so, the real SQL/psql commands and real result rows for all four NFR-03 cases (step 6) using your own fixtures
- byte-diff/checksum result for the three views (step 1)
- implementation-note comment confirmation (step 2)
- independent grep output for TS formula duplication (step 3)
- T009/T010/T011/T012 zero-diff confirmation (step 4)
- forbidden-file / scope check result (step 5)
- your own NFR-03 fixture design and results, one paragraph each for cases a–d (step 6)
- null-`team_ids` semantics verification and explicit statement on the fixture-bug narrative's verifiability (step 7)
- Trap 1 gap confirmation, including explicit confirmation no name/email/PII column exists in any of the three views and no self-referential `students` subquery exists (step 8)
- overall pass/fail result
- exact failure reason(s), if any, with severity classification (BLOCKER/MAJOR/MINOR/NIT)
- recommended next action

Do not mark this task complete based on the worker's self-report or on the inline comments left in the migration file. Those comments explain the worker's reasoning — they are not evidence. Generate your own evidence: live-DB test strongly preferred given downstream tasks' reliance on these exact numbers; rigorous static trace only as a documented fallback if Postgres is genuinely unreachable, with that fact stated explicitly rather than silently substituted.
