# GAM-345 run log

**Issue:** [GAM-345](https://linear.app/gamitch/issue/GAM-345/e2e-w4-hours-and-goal-accounting-the-same-students-numbers-agree-on)
— E2E — W4 Hours and goal accounting: the same student's numbers agree on every screen
**Branch:** `claude/gam-345-e2e-w4-hours-accounting`
**Run:** GitHub Actions, dispatched from Linear on the `Todo` transition.

Append-only. One line per milestone, pushed the moment it is written. If this
file ends at a dispatch line with no verdict beneath it, the run died holding
that subagent — see the dispatch line's own wording.

---

- **Claimed.** `GAM-345` moved `Todo → In Progress` and read back: state
  `In Progress`, labels `other`, `w4`, `tier/heavy`. The read-back is the claim
  (item 28c); without it there was only a hope.
- **Tier judged HEAVY** before the move, as item 28d requires. Reasoning
  recorded below under "Tier judgement".

## Tier judgement (item 26, stated and defended per item 28d)

Not FAST: FAST caps at roughly 20 lines of production change with no write
path. This is one or two new spec files plus deliberate fixture seeding of a
student's attendance, and the seeding is a write path in its own right — a
wrong seed makes every acceptance criterion vacuous rather than red.

Not STANDARD: STANDARD is a single module with no write path and no separate
checker round. The deliverable spans the e2e harness, three reports tabs, the
leaderboard, the KPI strip and a student home page, and its central claim is
about **metric-view semantics** — whether an all-excused student reads as
no-rate rather than a fabricated zero (T509). Item 26 names metric-view SQL as
a HEAVY trigger, and item 19b calls for a *full* premise check for anything
touching migrations, RLS or metric SQL. This test does not change that SQL, but
every assertion it makes is a claim about it: get the semantics wrong and the
run either manufactures a finding against a correct view or blesses a screen
that is lying about a student's own hours. Item 26's one question — *can a
mistake here lie to a user about their own data?* — is answered by the issue's
own premise, which is that two screens already disagree.

The issue's factual claims are also unmeasured and load-bearing: that no spec
touches `pages/reports/**`, that `readRowsAs`/`execAs`/`capture()` exist in the
harness, and that GAM-300's `greatest(x, 1)` floor is still live. Item 19 exists
for exactly these. HEAVY it is; and where two tiers are arguable item 26 says
take the heavier one.

---
- **Packet written** — `docs/swarm/active/GAM-345-packet.md`. HEAVY shape:
  verified context, Allowed Files (spec + screenshots + findings JSON only,
  `src/**`, `supabase/**` and `tests/e2e-harness/**` all forbidden), nine
  acceptance criteria, evidence requirements, and the item 19d **Least
  confident decisions** list (five entries).
  Premise work done by the orchestrator before writing it (item 19c — verify
  your own citations), all measured at `93c89d0`:
  - Harness API confirmed by reading `tests/e2e-personas/personaHarness.ts` —
    `readRowsAs`/`execAs`/`capture`/`SEED`/`PERSONAS` all exist as the issue says.
  - The issue's "Nothing exists" is **true for e2e only**. `src/pages/reports/`
    carries four colocated vitest files (`ParticipationTab.test.tsx` and
    siblings); no *persona* spec touches those pages. Recorded so the worker
    does not treat the unit tests as absent.
  - **GAM-300 confirmed live**: `loaders/checkin.ts:375` and
    `loaders/meetings.ts:527` both still hold `Math.max(expectedCt - excusedCt, 1)`.
    `loaders/reports.ts` does not.
  - T509's SQL read at `20260806000000_met01_explicit_marks.sql:102-148`. Three
    states, not two: real `0.0`; all-excused → row exists, `participation_pct`
    NULL; **no marks → no row at all** (the `marked` CTE inner-joins attendance).
  - **The seed contains neither case the issue's one constraint is about** —
    no all-excused student, no genuine-zero student. Both must be built
    deliberately. Written into the packet as verified context.
  - Wiring checked per item 27: Leaderboard is real only via `CoachHome.tsx:2817`
    → `loaders/leaderboard.ts:175`; `defaultLoadLeaderboardData` is a fixture and
    is **not** the user's path. KpiStrip is real via `AppShell.tsx:165`.
- **Dispatching `checker-premise` (opus) on the packet** — item 19, full check,
  because item 19b requires one for anything touching metric SQL. *If this line
  is the last one in this file, the run died holding this subagent.*
- **Premise gate round 1 VERDICT: REVISE (BLOCKER).** The subagent returned; it
  is not in flight. It ran the real cluster and a real browser in its own
  worktree (item 23), then stopped the cluster and removed the worktree — shared
  tree confirmed clean. 14 findings; the ones that change the work:
  1. **BLOCKER — AC5 is written against a control that does not exist.**
     `buildRosterCsv`/`buildEventsCsv`/`buildAttendanceCsv`
     (`csvExport.ts:305,372,437`) are called from **nowhere** in `src/`.
     Measured in-browser: no export control on any of the three tabs. The
     issue's own AC5 is therefore unsatisfiable as written. **This is the
     premise failure the gate exists to catch**, and it is worth more as a
     finding than as a criterion.
  2. **BLOCKER — my GAM-300 mechanism claim was FALSE.** `checkin.ts:362-365`
     and `meetings.ts:517` both return the single view row verbatim before ever
     reaching the `Math.max(x, 1)` at `:375`/`:527`. The floor is unreachable
     for a single-team student. I asserted the opposite in the packet.
  3. **MAJOR — the real live defect is `Participation: null%`, not `0%`.**
     Watched in the browser on `/meetings` as the student persona:
     `meetings.ts:302` types the column `number` while the view returns SQL
     NULL, and `StudentMeetingView.tsx:757` interpolates it straight into a
     label. StudentHome and the Participation tab both correctly show `—`.
     So a **new** finding cross-referencing GAM-300, not a filing under it.
  4. **MAJOR — AC2's hours cross-screen check could not have failed.**
     `reports.ts:424-428` and `leaderboard.ts:137-142` issue the byte-identical
     `v_student_hours` query; StudentHome reads the same view through
     `v_student_goal_projection`. One read, three renderers. What *does* vary is
     formatting: `4.0` vs `4 hrs`.
  5. **MAJOR — the KPI strip carries no per-student figure at all** (four tiles,
     season/team only). My LCD 5 doubt was correct.
  6. **MAJOR — AC2/3/4 demand loader mutations that my own Allowed Files
     forbade "without exception".** Needed an explicit worktree clause.
  7. **MAJOR — a bare `students` insert produces ZERO view rows**; a
     `student_teams` row with `left_on is null` is required. This is exactly the
     silent mis-test LCD 3 feared, measured.
  Plus MINORs: `confirmed_hours` is really `3.999999112222222` (the GAM-303
  shape) so AC6 needs a tolerance; the reports tabs are `role=button` inside
  `<nav aria-label="Tabs">`, **not** `role=tab`, and filter/sort exist only on
  the Participation tab; two citation slips of my own.
  **Four of the five doubts I declared under item 19d were load-bearing, and
  two of them were wrong in the direction I feared.** Item 19d earned its cost
  here.
- **Packet revision 2 written**, applying all ten of the gate's required
  revisions verbatim — the corrections are the gate's own measurements, not the
  author's second guess. Substantive changes: AC5 (CSV) **struck and replaced**
  by AC5′, a finding obligation; the GAM-300 mechanism paragraph rewritten
  around the single-row early returns; AC3 retargeted at the watched
  `Participation: null%` defect on `/meetings` with a **new** row cross-
  referencing GAM-300; AC2/AC6 rebuilt around `readRows` as the only
  independent witness plus a formatting-divergence check and a float tolerance;
  KpiStrip removed from the per-student comparison; a worktree-mutation clause
  added to Allowed Files and repeated on AC3/AC4; the full seeding recipe
  (`students` **+ `student_teams`**, plus `auth.users`/`profiles` for the login
  legs) lifted into Verified context; the `role=button`-not-`role=tab` and
  filter/sort-only-on-Participation traps added; both citation slips fixed; the
  dead harness-extension contingency deleted. New "Where this packet departs
  from the issue" section states plainly which three of the issue's own
  statements did not survive measurement.
- **LCD 5 resolved before dispatch, not deferred.** Queried Linear and grepped
  `docs/swarm/linear-export.md` for an existing CSV row: the only one is
  **GAM-69 / T059 — "CSV exports (RPT-05/06)", state `Done`**. Nothing open
  covers the gap. That sharpens AC5′ considerably: this is not a missing button,
  it is **constitution item 27's exact shape — a task recorded Passed whose
  user-visible surface no user can reach.**
- **Dispatching `checker-premise` round 2 (opus), LIGHT scope per item 19b** —
  read-only verification that the ten prescribed revisions landed faithfully and
  that revision 2 introduced no new unverified claim. No cluster run: round 1
  already executed the environment, and item 19a caps this gate at two rounds.
  *If this line is the last one in this file, the run died holding this subagent.*
- **Premise gate round 2 VERDICT: DISPATCH** (nine MINOR/NIT corrections, no
  BLOCKER, no MAJOR). The subagent returned; it is not in flight. Read-only, as
  scoped. All ten prescribed revisions landed; **two landed only in their first
  half**, which is exactly what a round-2 check is for. Worth recording:
  - **My LCD 2 doubt was unfounded in the direction I feared, and real in
    another.** `ParticipationTab.tsx:571,573-587` shows an all-excused student
    takes the *metric-driven* branch, so the tab's `—` is a genuine database
    NULL, not a synthesised row. But `students.ts:831-840` feeds **StudentHome
    only**, so my one prescribed mutation could not have turned the other two of
    AC3's three assertions red. Per-leg targets now named.
  - **The seeding recipe named the wrong column** — `v_student_participation`
    never reads `students.team_id`; it compares **`student_teams.team_id`**
    (`met01:109,114`). Setting one and not the other yields zero view rows,
    which is the precise silent mis-test the packet warns about two paragraphs
    earlier. Corrected.
  - Two more citation slips of mine (`meetings.ts:517`→`:519`, SQL quote
    `:119-125`→`:123-128`), and `reports.ts:221` carries the **identical**
    `participation_pct: number` type lie as `meetings.ts:302` — the tab escapes
    the symptom only via a runtime null check. Added to AC3's finding.
  Gate closed at two rounds (item 19a); no escalation needed.
- **All nine round-2 corrections folded into the packet** (per-leg mutation
  targets for AC3; `student_teams.team_id` + `is_active` seeding correction;
  `:123-128`, `meetings.ts:519`, `checkin.ts:363-365` citation fixes;
  `StudentHome.tsx:1649` and the stale `:1471` comment noted; the KPI
  season-rollup-vs-sum check promoted out of Traps into AC2; the
  `admin-roster.spec.ts:99` screenshot precedent restored; `HoursTab.tsx:1017` /
  `Leaderboard.tsx:527` formatting lines handed over; "no non-test file" and the
  `grep -c` exit-1 trap). Packet is now DISPATCH-clean at revision 2.
- **Dispatching `worker-implementer` (opus, item 18 override)** on packet
  revision 2. Opus rather than the pinned sonnet because the deliverable's whole
  value is arithmetic about students' own data across metric views, and a silent
  error here is exactly the "lies to a user about their own data" case item 18
  and item 26 exist for. *If this line is the last one in this file, the run
  died holding this subagent.*
