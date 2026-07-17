# Swarm Metrics Log

Per-agent-invocation cost data for the VOLT Team Portal rewrite swarm. This file tracks tokens, tool
uses, and wall-clock duration for every agent dispatch, keyed to the task it served.

**This file is append-only.** Do not rewrite or reorder existing rows. Whoever runs a task's
close-out is responsible for adding that task's invocation rows here before marking the task
Passed/Done in `docs/swarm/task-ledger.md`. Backfilled rows below (T001, T002) were reconstructed
from this session's actual agent usage stats, not estimated.

**2026-07-17 backfill note:** this file went stale after T002 despite the maintenance instruction
below — T003 through T015 were Passed without their invocation rows being appended. All rows from
"Setup" through T015 below were reconstructed on 2026-07-17 by extracting real `<subagent_tokens>`/
`<tool_uses>`/`<duration_ms>` usage data recorded in this session's own transcript
(`~/.claude/projects/.../f07aff68-1e9a-51d1-a45c-ac88b7b5b3ed.jsonl`), the same ground-truth source
T001/T002 were built from — not estimated or guessed. A few individual packet-authoring dispatches
(noted inline below) could not be located as a distinct logged invocation and are left absent rather
than fabricated; those tasks' subtotals are marked partial. **Going forward, do not let this happen
again** — append each task's rows as part of its own close-out, the same turn the ledger flips to
Passed.

---

## Setup — swarm-plan (brief/constitution review + initial task ledger)

| Agent | Model | Tokens | Tool Uses | Duration (ms) | Outcome/Note |
|---|---|---:|---:|---:|---|
| boss-architect (brief/constitution review) | fable | 36254 | 11 | 155993 | 2 minimal edits to project-brief.md |
| foreman-planner (initial task ledger) | sonnet | 99773 | 17 | 505891 | built full 71-row task-ledger.md + state-summary.md |

**Setup subtotal: 136,027 tokens across 2 invocations.**

---

## T001 — Vite + TS(strict) + ESLint/Prettier scaffold

| Agent | Model | Tokens | Tool Uses | Duration (ms) | Outcome/Note |
|---|---|---:|---:|---:|---|
| foreman-planner (worker packet) | sonnet | 42735 | 5 | 31654 | |
| worker-implementer (attempt 1) | sonnet | 41295 | 36 | 249961 | scaffold, passed cleanly |
| foreman-planner (checker packet) | sonnet | 42875 | 14 | 47099 | |
| checker-tests (attempt 1) | haiku | 16824 | 13 | 82136 | FAIL — false BLOCKER, git-bundling evidence error, vacated by D001 |
| boss-arbiter (D001 ruling) | fable | 21263 | 13 | 135616 | vacated the false BLOCKER |
| foreman-planner (checker packet revision) | sonnet | 48409 | 9 | 83349 | corrected evidence method post-D001 |
| foreman-planner (ledger status pre-recheck) | sonnet | 36348 | 3 | 15796 | |
| checker-tests (attempt 2) | haiku | 23419 | 28 | 156215 | PASS |
| foreman-planner (close-out) | sonnet | 51464 | 15 | 128214 | |

**T001 subtotal: 324,632 tokens across 9 invocations.**

---

## T002 — Astryx install + `volt.ts` theme (DES-03 exact spec)

| Agent | Model | Tokens | Tool Uses | Duration (ms) | Outcome/Note |
|---|---|---:|---:|---:|---|
| foreman-planner (worker packet) | sonnet | 44386 | 8 | 43211 | |
| worker-implementer (attempt 1) | sonnet | 39992 | 21 | 116832 | Astryx install + volt.ts, flagged real upstream type gap |
| foreman-planner (checker packet) | sonnet | 67322 | 16 | 104894 | |
| checker-accessibility (attempt 1) | sonnet | 37670 | 18 | 112564 | FAIL — legit, upstream TypographyRole/url type gap, not worker fault |
| foreman-planner (record failure + prep rework) | sonnet | 63771 | 18 | 91211 | |
| worker-implementer (attempt 2) | sonnet | 27519 | 17 | 69560 | added type-augmentation fix |
| foreman-planner (checker packet update) | sonnet | 51256 | 9 | 57636 | |
| checker-accessibility (attempt 2) | sonnet | 39908 | 23 | 110636 | PASS, empirical negative-control test |
| foreman-planner (close-out) | sonnet | 59807 | 21 | 130501 | |

**T002 subtotal: 431,631 tokens across 9 invocations.**

---

## D002 — React 18→19 stack-lock reversal (dispute resolution, not itself a ledger task)

| Agent | Model | Tokens | Tool Uses | Duration (ms) | Outcome/Note |
|---|---|---:|---:|---:|---|
| boss-architect (D002 ruling) | fable | 25912 | 10 | 125591 | amended constitution item 8 React18→19, authorized T002a corrective task |

**D002 subtotal: 25,912 tokens across 1 invocation.** (Constitution-amendment cost — kept separate from T002a's own worker/checker loop below.)

---

## T002a — React 18→19 upgrade (D002 corrective task)

| Agent | Model | Tokens | Tool Uses | Duration (ms) | Outcome/Note |
|---|---|---:|---:|---:|---|
| foreman-planner (T002a + T009 worker packets, shared dispatch) | sonnet | 58204 | 16 | 129894 | single call produced both T002a's and T009's worker packets — full cost counted here, not duplicated in T009 |
| worker-implementer (attempt 1) | sonnet | 59894 | 48 | 304046 | React 19 upgrade itself sound; format:check gap found |
| foreman-planner (checker packet) | sonnet | 66682 | 22 | 153095 | |
| checker-tests (attempt 1) | haiku | 26230 | 34 | 202002 | FAIL — legit but narrow pre-existing format:check gap, not worker fault |
| worker-implementer (attempt 2, format:check fix) | sonnet | 20553 | 18 | 65514 | |
| checker-tests (attempt 2) | haiku | 23041 | 36 | 150634 | PASS |
| foreman-planner (close-out) | sonnet | 79021 | 27 | 206334 | |

**T002a subtotal: 333,625 tokens across 7 invocations.**

---

## T009 — Migration: identity/roster tables

| Agent | Model | Tokens | Tool Uses | Duration (ms) | Outcome/Note |
|---|---|---:|---:|---:|---|
| foreman-planner (worker packet) | sonnet | — | — | — | shared dispatch with T002a's worker packet — see T002a row above, not double-counted |
| worker-implementer (attempt 1) | sonnet | 46346 | 26 | 304452 | |
| foreman-planner (checker packet) | sonnet | 25267 | 9 | 72246 | |
| checker-tests (attempt 1) | haiku | 22406 | 9 | 155146 | PASS, MINOR finding (`avatar_url` default gap, routed to T019) |
| foreman-planner (close-out) | sonnet | 66802 | 22 | 151398 | |

**T009 subtotal: 160,821 tokens across 4 logged invocations** (packet-authoring cost captured once under T002a).

---

## T003 — CSS cascade layers + `theme.css` build pattern

| Agent | Model | Tokens | Tool Uses | Duration (ms) | Outcome/Note |
|---|---|---:|---:|---:|---|
| foreman-planner (worker packet) | sonnet | — | — | — | not found as a distinct logged invocation — likely bundled into an adjacent multi-task dispatch; not fabricated here |
| worker-implementer (attempt 1) | sonnet | 119325 | 56 | 462356 | |
| checker-tests (attempt 1) | haiku | 60731 | 36 | 199529 | PASS, clean |
| foreman-planner (close-out) | sonnet | 69830 | 20 | 162403 | |

**T003 subtotal: 249,886 tokens across 3 logged invocations (partial — worker-packet dispatch not captured).**

---

## T004 — CI pipeline (typecheck/lint/unit/build + bundle budget)

| Agent | Model | Tokens | Tool Uses | Duration (ms) | Outcome/Note |
|---|---|---:|---:|---:|---|
| foreman-planner (worker packet) | sonnet | 61879 | 13 | 161600 | |
| worker-implementer (attempt 1) | sonnet | 54952 | 65 | 390954 | |
| foreman-planner (checker packet) | sonnet | 34469 | 11 | 79970 | |
| checker-tests (attempt 1) | haiku | 48617 | 51 | 423263 | PASS, clean |
| foreman-planner (close-out) | sonnet | 90430 | 20 | 203817 | |

**T004 subtotal: 290,347 tokens across 5 invocations.**

---

## T005 — Router skeleton + route guards + deep-link redirect

| Agent | Model | Tokens | Tool Uses | Duration (ms) | Outcome/Note |
|---|---|---:|---:|---:|---|
| foreman-planner (worker packet) | sonnet | — | — | — | not found as a distinct logged invocation (likely lost in the session-limit interruption window — see state-summary.md) |
| worker-implementer (attempt 1) | sonnet | — | — | — | cut off by session limit mid-run; orchestrating session finished the already-declared cleanup step directly (see state-summary.md "Session-limit interruption") — no clean completion notification logged |
| foreman-planner (T005 checker packet + T011 worker packet, shared dispatch) | sonnet | 80879 | 27 | 175490 | single call produced T005's checker packet and T011's worker packet — full cost counted here, not duplicated in T011 |
| checker-reviewer (attempt 1) | opus | 43791 | 23 | 343264 | FAIL — legit BLOCKER, `/kiosk/:sessionId` left fully public against PRD/SEC-04 |
| foreman-planner (record failure + prep rework) | sonnet | 65697 | 18 | 104764 | |
| worker-implementer (attempt 2, kiosk guard fix) | sonnet | 29220 | 15 | 80005 | |
| foreman-planner (checker packet update) | sonnet | 56831 | 13 | 57161 | |
| checker-reviewer (attempt 2) | opus | 27928 | 14 | 175891 | PASS on the merits |
| foreman-planner (close-out) | sonnet | 95985 | 28 | 191716 | |

**T005 subtotal: 400,331 tokens across 7 logged invocations (partial — worker-packet dispatch and attempt-1 worker run not captured; note this is the most expensive task to date, driven by 2 full attempts plus a real BLOCKER-class checker-reviewer finding).**

---

## T011 — Migration: support tables + audit triggers (DATA-02)

| Agent | Model | Tokens | Tool Uses | Duration (ms) | Outcome/Note |
|---|---|---:|---:|---:|---|
| foreman-planner (worker packet) | sonnet | — | — | — | shared dispatch with T005's checker packet — see T005 row above, not double-counted |
| worker-implementer (attempt 1) | sonnet | 45554 | 23 | 242490 | |
| foreman-planner (checker packet) | sonnet | 40975 | 15 | 101781 | |
| checker-tests (attempt 1) | haiku | 65084 | 63 | 580749 | PASS, MINOR finding (`notification_prefs` defaults) — real scratch-Postgres trigger tests, all 12 sub-tests |
| foreman-planner (close-out) | sonnet | 95488 | 25 | 294084 | |

**T011 subtotal: 247,101 tokens across 4 logged invocations** (packet-authoring cost captured once under T005; checker run here is the most tool-use-intensive single invocation logged so far — 63 tool calls, real Postgres trigger validation).

---

## T010 — Migration: scheduling/attendance tables

| Agent | Model | Tokens | Tool Uses | Duration (ms) | Outcome/Note |
|---|---|---:|---:|---:|---|
| foreman-planner (worker packet) | sonnet | — | — | — | not found as a distinct logged invocation |
| worker-implementer (attempt 1) | sonnet | 24332 | 12 | 106163 | |
| foreman-planner (checker packet) | sonnet | 58745 | 9 | 68359 | |
| checker-tests (attempt 1) | haiku | 37830 | 31 | 234338 | PASS, MINOR finding (`event_sessions.notes` default gap) |
| foreman-planner (close-out) | sonnet | — | — | — | close-out dispatch failed on session limit before writing anything; orchestrating session performed the close-out directly instead (see state-summary.md) — no agent invocation to log |

**T010 subtotal: 120,907 tokens across 3 logged invocations (partial — worker-packet dispatch not captured; close-out was done directly by the orchestrating session, not a billed agent invocation).**

---

## T012 — RLS helper functions + policies (verbatim PRD 8.4)

| Agent | Model | Tokens | Tool Uses | Duration (ms) | Outcome/Note |
|---|---|---:|---:|---:|---|
| foreman-planner (worker packet) | sonnet | 78163 | 13 | 221051 | |
| worker-implementer (attempt 1) | sonnet | 77967 | 39 | 436986 | |
| foreman-planner (checker packet) | sonnet | 51414 | 12 | 168502 | |
| checker-tests (attempt 1) | haiku | 69529 | 55 | 417840 | PASS, clean — highest-stakes task to date (constitution items 3+4 BLOCKER-class), real scratch-Postgres validation across 5 session types |
| foreman-planner (close-out) | sonnet | 107432 | 21 | 269598 | |

**T012 subtotal: 384,505 tokens across 5 invocations** (most expensive single-attempt task to date — highest-stakes RLS/security work, matches its BLOCKER-class constitution status).

---

## T013 — Metric views (verbatim PRD 8.4)

| Agent | Model | Tokens | Tool Uses | Duration (ms) | Outcome/Note |
|---|---|---:|---:|---:|---|
| foreman-planner (T013 + T015 worker packets, shared dispatch) | sonnet | — | — | — | not found as a distinct logged invocation |
| worker-implementer (attempt 1) | sonnet | 51585 | 38 | 306154 | ran in parallel with T015's worker |
| foreman-planner (checker packet) | sonnet | 55702 | 15 | 119244 | |
| checker-tests (attempt 1) | haiku | 70466 | 15 | 250290 | PASS, clean — 4 NFR-03 fixture cases independently re-validated on scratch Postgres |
| foreman-planner (close-out) | sonnet | — | — | — | performed directly by orchestrating session (mechanical ledger/state-summary/verification-log bookkeeping), not a separate agent dispatch |

**T013 subtotal: 177,753 tokens across 3 logged invocations (partial — worker-packet dispatch not captured; close-out done directly by orchestrating session).**

---

## T015 — Supabase Auth provider config

| Agent | Model | Tokens | Tool Uses | Duration (ms) | Outcome/Note |
|---|---|---:|---:|---:|---|
| foreman-planner (worker packet) | sonnet | — | — | — | shared dispatch with T013's worker packet — see T013 row above, not double-counted |
| worker-implementer (attempt 1) | sonnet | 69659 | 41 | 369114 | ran in parallel with T013's worker |
| foreman-planner (checker packet) | sonnet | 36977 | 12 | 82997 | |
| checker-tests (attempt 1) | haiku | 28190 | 20 | 111407 | PASS, NIT only (`minimum_password_length=8` hardening ruled acceptable) |
| foreman-planner (close-out) | sonnet | — | — | — | performed directly by orchestrating session, not a separate agent dispatch |

**T015 subtotal: 134,826 tokens across 3 logged invocations (partial — worker-packet dispatch not captured; close-out done directly by orchestrating session).**

---

## Running totals

| Scope | Tokens | Invocations |
|---|---:|---:|
| Setup (swarm-plan) | 136,027 | 2 |
| T001 | 324,632 | 9 |
| T002 | 431,631 | 9 |
| D002 (dispute ruling) | 25,912 | 1 |
| T002a | 333,625 | 7 |
| T009 | 160,821 | 4 |
| T003 | 249,886 | 3 |
| T004 | 290,347 | 5 |
| T005 | 400,331 | 7 |
| T011 | 247,101 | 4 |
| T010 | 120,907 | 3 |
| T012 | 384,505 | 5 |
| T013 | 177,753 | 3 |
| T015 | 134,826 | 3 |
| **All tasks to date** | **3,418,304** | **65** |

Average per fully-tracked task (T001, T002, T002a, T004, T009, T011, T012 — the 7 tasks with a
complete invocation chain logged, no gaps): **~317,000 tokens** and **~5.6 invocations** per task.
Tasks with real rework loops (2 attempts: T002, T002a, T005) or high-stakes real-Postgres validation
(T005 checker-reviewer BLOCKER, T011/T012 live trigger/RLS tests) run well above that average; clean
single-attempt tasks with lighter checker work (T003, T009, T010) run below it.

---

## Observations

1. **foreman-planner packet-authoring/bookkeeping calls remain the single largest recurring cost
   driver** — typically 40–110K tokens per call, 2–5 foreman calls per task (worker packet, checker
   packet, any revision/rework prep, and close-out), now confirmed across 13 tasks, not just the
   original 2.
2. **worker-implementer cost scales with real implementation complexity, not just task size on
   paper** — as low as 24K tokens (T010, a small additive migration) up to 119K (T003) and 78K (T012,
   the RLS/security task). Checker-tests cost scales similarly with how much real infrastructure
   validation it does — T011's checker alone hit 65K tokens/63 tool calls running live Postgres
   trigger tests; T013's checker hit 70K tokens re-deriving its own NFR-03 fixtures from scratch
   rather than trusting the worker's.
3. **Rework loops roughly double a task's total cost.** T002, T002a, and T005 each needed a 2nd
   attempt; each landed at 330K–400K tokens total vs. ~250K–290K for comparable clean single-attempt
   tasks. T005 in particular (a real BLOCKER-class security finding, not a false alarm) is the most
   expensive task logged to date.
4. **Parallel dispatch (T003+T010's foreman-planner concurrent prep, T005+T011's shared checker/worker
   packet call, T002a+T009's shared worker-packet call, T013+T015's fully parallel worker/checker
   runs) genuinely reduces foreman-planner overhead** by combining what would otherwise be 2 separate
   packet-authoring calls into 1 — visible directly in the shared-dispatch rows above.
5. **Coverage gap, disclosed rather than backfilled with guesses:** a handful of packet-authoring
   dispatches (T003's and T005's worker packets, T010's and T013's worker packets) could not be
   located as a distinct logged invocation in the session transcript — most plausibly because they
   were combined into an adjacent multi-task dispatch whose notification summary named a different
   task, or were lost during the two session-limit interruptions on 2026-07-17. Those tasks'
   subtotals above are marked partial rather than padded with an estimated number.

## Maintenance note

Going forward, append new sections per task in the same format (per-invocation table + subtotal),
update the Running Totals table, and re-derive Observations if the pattern changes materially. Do
not delete or renumber historical rows. **This file went stale for T003–T015 despite this
instruction — whoever runs a task's close-out must add that task's rows in the same turn the ledger
flips to Passed, not defer it.**
