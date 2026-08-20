# GAM-196 run log

**Issue:** [GAM-196 — T188 — two different "confirmed hours" numbers exist in the app and can legitimately disagree](https://linear.app/gamitch/issue/GAM-196/t188-two-different-confirmed-hours-numbers-exist-in-the-app-and-can)
**Branch:** `claude/gam-196-confirmed-hours-divergence`
**Runtime:** Claude (dispatch run). Route: no `executor/*` label → item 28b migration-only default, legacy Claude-only. No `gate/human`.

Append-only. One line per milestone, pushed immediately. If the last line of this
file is a subagent dispatch with no matching verdict line, **the run died holding
that subagent** — that is the signature of the failure described in AGENTS.md
wall 2, not a run that is "still thinking".

---

## Tier judgment (item 26 / item 28d) — made BEFORE the `In Progress` move

**Verdict: HEAVY.**

- Item 26's deciding question is *"can a mistake here corrupt data, or lie to a
  user about their own data?"* This row **is** that question in its pure form:
  its entire subject is a student's own confirmed volunteer-hours total showing
  two different values on two screens. A wrong fix here does not merely look
  wrong — it tells a minor volunteer the wrong number of hours they have earned.
- The candidate fixes land on metric semantics. Route (b) in the issue would
  make `/outreach` read the attendance-backed number, i.e. `v_student_hours` —
  **metric-view SQL is an explicit HEAVY trigger** in item 26 and PRD 8.4
  territory under constitution item 3.
- The row is **contested and multi-part by its own admission**: it names four
  divergences, states that divergence (4) was *inferred* at the render layer
  rather than observed, and explicitly asks for an owner ruling between two
  fixes that point in opposite directions. Item 19's premise gate is the exact
  instrument for a plan resting on claims of that shape, and the claims are
  15 days old (diagnosed 2026-08-05, filed 2026-08-09, today 2026-08-20).
- FAST is excluded on its face: it requires *all* of no write path, ≤20 lines,
  and a named red-turning mutation — the scope here is not yet bounded enough to
  assert any of the three. STANDARD is excluded because the divergence-(4)
  measurement is the load-bearing claim and a worker must not be the one to
  confirm it.
- Item 26: *"If two tiers are arguable, take the heavier one."*

**Consequence:** packet → `checker-premise` (DISPATCH required, item 19) →
worker → `checker-reviewer`. Two-round gate cap (19a), three-attempt worker cap.

---

## Milestones

- `2026-08-20` **CLAIMED.** Fetched GAM-196 live from Linear. Tiered
  `tier/unreviewed` → `tier/heavy` FIRST (item 28d), then moved `Todo` →
  `In Progress`, then **read back**: `state = In Progress`,
  `labels = [tier/heavy]`. Read-back confirms the claim is held, not hoped for.
- `2026-08-20` Branch `claude/gam-196-confirmed-hours-divergence` created off
  `main` @ `b9396c9`. Run log is the first file write on it.
