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
