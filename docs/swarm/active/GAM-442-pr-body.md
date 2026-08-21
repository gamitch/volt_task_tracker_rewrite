Closes GAM-442

## What changed

Adds `v_event_attendance`, one additive migration creating a per-event
attendance aggregate so the coach series card's "Attendance 96.5% across 21
held" figure comes from SQL rather than a division in TypeScript (constitution
item 3 / PRD DATA-01, which makes the TypeScript division a BLOCKER).

## Tier, stated and defended (item 26)

**HEAVY.** The issue proposed STANDARD. That is wrong under item 26, whose
HEAVY trigger list names "a migration or metric-view SQL" — this change is
**both at once**: a new file under `supabase/migrations/` whose entire content
is metric math. Item 26 also directs taking the heavier of two arguable tiers,
and item 1 puts the constitution above issue text. Item 18 independently forces
`model: "opus"` on the worker for the same triggers.

Chain actually run: packet → `checker-premise` ×2 → opus `worker-implementer`
→ `checker-reviewer`.

## This PR is the work of two runs, and the first one died

Run 1 claimed the issue, opened this draft PR at minute 3, wrote the packet and
took it through **two premise-gate rounds** — then died holding its
`worker-implementer`, leaving `supabase/` untouched. Its run log had written the
dispatch line in advance with the sentence *"if this line is the last one in
this file, the run died holding this subagent"*, so run 2 could identify the
failure in one read rather than re-deriving the task. Run 2 resumed from the
gated packet and dispatched the worker that produced the SQL here.

`docs/swarm/active/GAM-442-run-log.md` carries both runs end to end.

## What the premise gate changed before any SQL was written

The gate did not read the packet — it stood up PostgreSQL 16.15, applied the
repo's real migrations, and **wrote four candidate versions of the view**. Two
BLOCKERs came out of that, and neither was visible from reading:

1. **A join fan-out that corrupts `held_ct` while leaving `attendance_pct`
   correct.** In the naive `events → event_sessions → attendance` chain a held
   session carrying *n* marks appears *n* times, so a bare `count(es.id)` counts
   it *n* times: measured `held_ct = 5` for an event with **2** held sessions.
   The percentage divides two counts that fan out by the same factor, so the
   error cancels and the view looks right — but `held_ct` is the user-visible
   "across N held" half of the card's headline. **All four of the packet's
   original acceptance criteria passed against that corrupted view.** Criterion
   (a2) was added as the sole guard, and mutation 3 below proves it is one.
2. **The packet's declared doubt was aimed at the wrong risk** (item 19d's list
   doing its job). See "Known risk" below.

## Verification — every proof run in a real cluster

PostgreSQL 16.15, this repo's real migration set applied unchanged (24 files;
`20260719000000_cron.sql` and `20260720000001_avatar_storage.sql` skipped per
the `run_t509_explicit_marks.sh` precedent). The `scratch-postgres` skill's
`start.sh` cannot run as non-root in this container, so `initdb`/`pg_ctl` were
run directly — see "Two pre-existing defects" below.

**(a) Hand-computed percentage.** Event E1: 2 `completed` sessions, 1
`scheduled`, 1 `canceled`; marks `present`+`late`+`excused` on one held session,
`absent`+`present` on the other, **plus a `present` mark parked on each non-held
session that must count nowhere**. Hand-computed *before* running:
`100 × 3 / (5 − 1) = 75.0`.

```
             event              | held_ct | graded_marks_ct | excused_ct | attended_marks_ct | attendance_pct
--------------------------------+---------+-----------------+------------+-------------------+----------------
 Fixture Meeting Alpha GAM442   |       2 |               5 |          1 |                 3 |           75.0
 Fixture Meeting Bravo GAM442   |       1 |               0 |          0 |                 0 |
 Fixture Meeting Charlie GAM442 |       1 |               2 |          2 |                 0 |
 Fixture Meeting Delta GAM442   |       0 |               0 |          0 |                 0 |
 Fixture Meeting Echo GAM442    |      20 |              40 |          0 |                40 |          100.0
 Fixture Outreach Foxtrot GAM44 |       1 |               1 |          0 |                 1 |          100.0
```

`late` is visibly counted as attended (MET-05) and the `excused` mark is
visibly removed from the denominator. A separate assertion reads the **base
table** to confirm the two marks on non-held sessions actually exist, so 75.0
cannot be right merely because there was nothing to wrongly include.

**(a2) `held_ct` counts sessions, not marks.** Three assertions, each
cross-checked against a direct `count(*)` on `event_sessions` so it cannot pass
by agreeing with itself: `held_ct = 2` where `graded_marks_ct = 5`; `held_ct = 1`
for one held session carrying two marks; `held_ct = 20` where marks are 40.

**(b) NULL, twice — never a fabricated 0.** Held sessions with zero marks →
NULL. Every mark excused → NULL. Asserted `IS NULL`. Note `graded_marks_ct = 0`
for Bravo above, not the phantom `1` a `count(*)` spelling produces.

**(c) Zero-session event** (Delta) still yields **exactly 1 row**, `held_ct = 0`,
`attendance_pct` NULL — the `left join` proof, asserted on row *count* because a
plain `select` returning nothing would satisfy a careless check.

**(d) Coach read, and the security model measured in both directions.** A coach
(`authenticated`) reads all 6 rows. Re-run with the same definition owned by a
`NOSUPERUSER NOBYPASSRLS` role, with base-table access granted first so a
`42501` could not be misread as an RLS result:

```
 weak owner, security_invoker OFF     |  0 rows
 weak owner, security_invoker ON      |  6 rows
 weak owner, security_invoker OFF again | 0 rows
```

The caller is a coach whose policy would show her all 6 events reading base
tables directly, yet the view returned **0** — because RLS applied to the
*owner*. Flipping the flag moved it 0 → 6 → 0, localising the cause. That is a
two-directional confirmation of
`20260805000000_dashboard_views_comment_corrections.sql:41-49` rather than a
restatement of it.

**(e) `anon` grant**, against simulated stock Supabase default privileges
(without which this proof is unpassable — measured, `authenticated` is denied on
*every* view in a bare scratch cluster):

```
 BEFORE revoke (stock)     | sel t | del t | anon=arwdDxt   | is_updatable NO
 AFTER revoke SELECT only  | sel f | del t | anon=awdDxt    | is_updatable NO
 AFTER revoke ALL (shipped)| sel f | del f | (anon absent)  | is_updatable NO
```

The surviving DELETE in the middle row is what T205 was about and is **not a
live concern here** — `is_updatable = 'NO'` throughout, because this is an
aggregate view. The counterfactual shows the statement does what it says; it
does not claim a write path existed. **This is not a security finding** (item
25: *"Item 4 covers tables; do not extend it to views"*), and it does **not**
resolve **GAM-389**, which owns the inconsistent `anon` posture across the other
views.

**(f) Nothing else moved.** `v_student_hours`, `v_student_participation`,
`v_team_participation` and `v_season_attendance_rate` snapshotted before and
after, with the migration held back inside the runner
(`run_t503_widen_rsvp_read.sh:50-61`'s pattern) so the diff can mean something:

```
 v_student_hours 1 | v_student_participation 3 | v_team_participation 1 | v_season_attendance_rate 1
 c2fda527...cf3d  four_views_before.txt
 c2fda527...cf3d  four_views_after.txt
```

Row counts `1 | 3 | 1 | 1` — **none is 0**, so this is a seeded fixture and not
four empty result sets compared against each other. The runner fails itself with
`(f) UNSEEDED FIXTURE, not a pass` if any of the four is empty. Meetings still
contribute **zero** volunteer hours: the season total 3.0 h equals the
outreach-only expectation computed independently from base tables.

**(g) Mutation replay** — migration committed *before* mutating (item 26's rule,
which cost T323 its fix), mutations run in an isolated worktree (item 23).
Baseline `exit=0 failed=0 passed=16`.

| Mutation | Result |
| -- | -- |
| NULL branch → `greatest(denominator, 1)` | **exit 3**, 4 failed — (b) reports `0.0`, not NULL |
| drop `es.status = 'completed'` | **exit 3**, 4 failed — (a) reports `83.3`, not `75.0` |
| reintroduce the fan-out (`count(distinct es.id)` → `count(es.id)`) | **exit 3**, 6 failed — all three (a2) assertions red |

Mutant 3 reproduces the gate's measured corruption byte for byte
(`held_ct = 5 … pct 75.0`) and leaves **(b1), (b2) and (c) green** — which is
the direct proof that (a2), and only (a2), guards `held_ct`. Restored, re-run
green at 16/16.

**(h) Gates** — `gate-run`, verbatim:

```
GATE RUN — 8d84b05 on claude/gam-442-event-attendance-view — tree clean

  1 tsc              exit 0  PASS
  2 vite build       exit 0  PASS
  3 format:check     exit 0  PASS
  4 eslint           exit 0  PASS       0 errors, 380 warnings
  5 vitest (full)    exit 0  PASS       102 files / 2598 tests  baseline 2598 (+0)
  6 vitest (scoped)      –  SKIP
                            no scope given and none derivable from the diff -- pass --scope <path> to run it

VERDICT: PASS — 5 of 6 gates. NOT all six: 1 skipped.
```

**Five of six, and this PR says five.** Gate 6 is legitimately skipped: the
change touches no `src/` file, so there is no defensible scope. The 2598-test
baseline was measured at the merge base `e1c49b8` rather than assumed, and
eslint's 380 warnings match the merge base exactly (+0) — that count is the
pre-existing GAM-384/GAM-394 issue, not this change.

## Known risk, disclosed rather than discovered on screen

**This view can honestly report 100% for an event most of the roster skipped,
and no migration can prevent that — only the consuming card can.**

Since T508, "no attendance row" is the *normal* shape for an unmarked student;
absences are written only when a coach opts in. The T509/D014 explicit-marks
denominator counts only marks that exist, so **forgetting to mark someone
inflates the percentage**. Measured at event grain: a 5-student roster across 20
held sessions with only the 2 who turned up marked each night reports
`held_ct = 20`, `graded_marks_ct = 40`, `attendance_pct = 100.0` — against
**100 roster-turns**. A coach would read "Attendance 100% across 20 held" for an
event 60% of the roster skipped.

The denominator is deliberately **not** changed to compensate: that would move
MET-01's denominator, which D014 owns by owner ruling. What this migration does
instead is discharge **D014's own stated mitigation** at the new grain —
`graded_marks_ct` and `attended_marks_ct` ship as first-class columns so the
card can render the counts beside the percentage, and the `comment on view`
carries the warning in required words: *"a consumer that renders
`attendance_pct` without also rendering `graded_marks_ct` reintroduces D014's
known regression."*

`20260806000000_met01_explicit_marks.sql:95-100` says D014 must be revisited if
those counts stop being shown. **The consuming SeriesCard ticket inherits that
obligation.** It is filed under item 20 as **GAM-460**, which names the
constraint that the percentage and the counts must not be separable by a
responsive rule, and should be closed by GAM-447's own acceptance criteria
rather than by separate work.

## Scope note: three files, not the issue's one

The issue said "exactly one new file". This PR ships three: the migration plus
`supabase/tests/gam442_event_attendance_assertions.sql` and its runner. The
issue *also* makes `scratch-postgres` mandatory and requires four proofs in this
body, and every sibling assertion set under `supabase/tests/` has a runner —
`run_t509_explicit_marks.sh`'s own header records that shipping assertions
*without* a runner was T509's defect. Both extra files are new, additive, and
test-only. Stated here rather than done silently.

## Two pre-existing defects on `main`, reproduced and NOT repaired

Both verified on a second **virgin** cluster, since this PR's own runner creates
`service_role` and would otherwise have masked the first:

1. **`supabase/tests/run_t205_anon_grant.sh` is red on `main` today** —
   `ERROR: role "service_role" does not exist`, exit 1.
   `calendar_feed_platform_stub.sql` creates only `anon` and `authenticated`.
   `run_t503_widen_rsvp_read.sh:27-39` already carries the fix locally; T205's
   runner never got it.
2. **`.claude/skills/scratch-postgres/scripts/start.sh` cannot run as non-root
   here** — `chown: … Operation not permitted` at uid 1001.

Neither is in this task's Allowed Files, neither was repaired here, and both are
filed under item 20 — **GAM-458** (the `service_role` guard, which
`run_t503_widen_rsvp_read.sh:27-45` already solves) and **GAM-459** (the
non-root `chown`). On the same
cluster where t205 fails, this PR's runner exits 0 at 16/16 — so neither defect
is evidence about this work.

Linear-Issue: GAM-442
