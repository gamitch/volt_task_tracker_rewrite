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
- `2026-08-20 02:59Z` **Credential deadline read, not guessed** (AGENTS.md wall 3):
  `ghs_` token `iat 2026-08-20T02:57:39Z` / `exp 2026-08-20T03:57:39Z` — 58 min
  of PR credential at the time of reading.
- `2026-08-20` **DRAFT PR OPENED EARLY:** [#210](https://github.com/gamitch/volt_task_tracker_rewrite/pull/210),
  at roughly minute 4, carrying only the run log and the PR-body artifact.
  Body artifact `docs/swarm/active/GAM-196-pr-body.md` written and validated
  (`check.mjs` → `OK declaration closes GAM-196`) BEFORE the API call, per the
  `pr-body` skill.
- `2026-08-20` **PACKET WRITTEN:** `docs/swarm/active/GAM-196-packet.md`
  (HEAVY, round 1). Orchestrator verified every citation against this branch
  first (item 19c). Headline: **3 of the row's 4 divergences survive; divergence
  (4) is FALSIFIED as written** — the render path already filters
  `type === 'outreach'` at `OutreachList.tsx:4254-4258` before sessions reach
  `computeStudentHours`, so a meeting cannot reach it on the live page. A
  different, unnamed divergence (4′) sits behind it: `v_student_hours` joins on
  `e.counts_volunteer_hours` while `/outreach` filters on `type`, so an outreach
  event with the flag false diverges. That slice needs no owner ruling and is the
  packet's work; (1)(2)(3) need the owner's (a)/(b) ruling and are escalated.
- `2026-08-20` **DISPATCHING `checker-premise`** (item 19, round 1 of max 2),
  `run_in_background: false`, blocking. **If this line is the last one in this
  file, the run died holding this subagent** — that is AGENTS.md wall 2, not a
  run still thinking.
- `2026-08-20` **`checker-premise` VERDICT: REVISE** (round 1/2). Returned, not
  lost — 62 tool calls, ~10 min, 115.6K tokens. It ran rather than read: scratch
  Postgres with the migrations applied, `pg_get_viewdef`, its own worktree,
  `tsc --noEmit`, 108 real tests, a behaviour probe. Findings that change the
  outcome:
  - **BLOCKER** — my divergence (4′) is **UI-unreachable**.
    `OutreachEventDialog.tsx` forces `countsVolunteerHours: true` for every
    outreach event (`OUTREACH_FIXED_FLAGS`); `meetings.ts` hard-codes `false`
    for meetings; `scripts/migrate/transform.ts` maps outreach → `true`. No DB
    constraint couples them, but **no writer can produce the combination**. The
    packet's shipped work would change no reachable number.
  - **MAJOR** — I cited a **superseded** migration. The live `v_student_hours`
    is `20260804000000_volunteer_hours_outreach_only.sql:44-60`, joining
    `counts_volunteer_hours AND type = 'outreach'` — so the predicate delta is
    `(type AND flag)` vs `(type)`, not "flag vs type" as I wrote.
  - **MAJOR** — the *reachable* member of this divergence family is elsewhere:
    a **competition** event with the admin volunteer-hours Switch on yields
    planned hours on `StudentHome`/`HoursTab` that can never become confirmed
    hours in the post-T322 view. Outside this packet's Allowed Files.
  - **MAJOR** — acceptance criterion 3 was unsatisfiable as written (measured
    `TS2554` at the three frozen call sites); a cheaper seam exists that needs
    zero test edits.
  - Divergence (4) dissolved: **UPHELD** (all four call sites traced).
  Verdict recorded here per item 19. Gate report to follow as an artifact.
- `2026-08-20` **NO ROUND 2, and the reason is not the clock.** A second gate
  round is for a packet whose *wording* is wrong (item 19a). This packet's
  *premise* is wrong: the slice it proposed is unreachable, and the slice the
  row proposed as separable is already implemented. A rewrite cannot manufacture
  work that does not exist.
- `2026-08-20` **FOLLOW-UP FILED (item 20): GAM-428** — *Planned volunteer hours
  count competitions that can never become confirmed hours*
  (`StudentHome.tsx:872`, `HoursTab.tsx:481`, no `type` test; reachable via the
  admin Switch at `OutreachEventDialog.tsx:1432-1437`). Filed to `Backlog` with
  `unreviewed` + `provenance/premise-gate`, per GAM-382. Written through the
  `linear-task-writing` skill (item 30); every line number re-opened first.
- `2026-08-20` **GAM-196 RELEASED to `Todo` with `gate/human`.** Read back:
  `state = Todo`, `labels = [tier/heavy, gate/human]`, original description
  preserved verbatim in a `<details>` block (item 30d, verified by string
  containment, not by eye). `gate/human` is what stops the `Todo` move from
  re-dispatching another machine into the same wall — `linear-assert-released.mjs`
  treats `Todo` as a PASS calling it "a correct refusal to proceed", and its own
  header (`:46-50`) names the self-re-dispatch incentive this label closes.
- `2026-08-20` **PR #210 finalized and CLOSED UNMERGED.** Four Markdown files,
  zero source changes. Merging would have driven GAM-196 to `Done` via the
  branch-name link and the `PR merge → Done` automation (item 28f: omitting a
  magic word protects nothing), and GAM-196 is not done. The branch stays pushed
  so the packet, the gate report and this log survive; both Linear rows link to it.
- `2026-08-20` **RUN COMPLETE.** No source changed, by decision and not by
  timeout. No subagent was ever left in flight: one `checker-premise` dispatched
  with `run_in_background: false`, waited on, and its verdict recorded above.
- `2026-08-20` **Refusal recorded on the issue itself**, not only in this file:
  comment posted to GAM-196 with the measurement, the two refutations, the
  recommendation (route (a)), and the disclosed limits. Final read-back —
  GAM-196: `Todo`, `[tier/heavy, gate/human]`, 1 comment.
  GAM-428: `Backlog`, `[unreviewed, provenance/premise-gate]`.
