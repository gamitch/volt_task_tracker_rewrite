# Swarm Metrics Log

Per-agent-invocation cost data for the VOLT Team Portal rewrite swarm. This file tracks tokens, tool
uses, and wall-clock duration for every agent dispatch, keyed to the task it served.

**This file is append-only.** Do not rewrite or reorder existing rows. Whoever runs a task's
close-out is responsible for adding that task's invocation rows here before marking the task
Passed/Done in `docs/swarm/task-ledger.md`. Backfilled rows below (T001, T002) were reconstructed
from this session's actual agent usage stats, not estimated.

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

## Running totals

| Scope | Tokens | Invocations |
|---|---:|---:|
| T001 | 324,632 | 9 |
| T002 | 431,631 | 9 |
| **All tasks to date** | **756,263** | **18** |

---

## Observations

1. **foreman-planner packet-authoring/bookkeeping calls are the single largest cost driver so far**,
   comparable to or exceeding the worker's own implementation cost — 40–65K tokens per foreman call,
   with 2–4 foreman calls per task (worker packet, checker packet, any revision/rework prep, and
   close-out).
2. **worker-implementer itself is comparatively cheap** — 28–41K tokens per attempt across both
   tasks, well below several individual foreman calls.
3. This is only 2 data points (T001, T002). Conclusions above should be treated as provisional and
   firmed up once more tasks have run — in particular it's not yet clear whether foreman overhead
   scales with task complexity or is closer to a fixed cost per task.

## Maintenance note

Going forward, append new sections per task in the same format (per-invocation table + subtotal),
update the Running Totals table, and re-derive Observations if the pattern changes materially. Do
not delete or renumber historical rows.
