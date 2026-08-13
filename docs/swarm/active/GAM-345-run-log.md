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
