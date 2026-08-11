# GAM-314 run log

Issue: [GAM-314](https://linear.app/gamitch/issue/GAM-314/a-dispatched-run-reports-success-while-its-work-is-still-running-in)
Branch: `claude/gam-314-assert-run-released-claim`
Base: `ccf77b1`

Append-only. One line per milestone, committed and pushed as it happens.

- 19:27Z — issue fetched live from Linear; state `Todo`, labels `other` + `unreviewed`.
- 19:27Z — **tiered STANDARD.** Reasoning: item 26's FAST bar requires a named
  mutation that turns a test red; nothing today executes a workflow YAML, so no
  such mutation exists (the issue says so itself, and `GAM-312` owns that gap).
  HEAVY's triggers are enumerated — write path or destructive operation,
  RLS/auth/role logic, migration or metric-view SQL, an export another session
  builds against — and none is touched: the change is one post-run CI step plus
  a read-only Linear query. A mistake here fails dispatch runs loudly; it cannot
  corrupt data or lie to a user about their own data, which is item 26's
  selecting question. STANDARD: worker implements, orchestrator replays.
- 19:27Z — **claimed.** `Todo → In Progress` via `issueUpdate`, labels set to
  `other` + `standard`; read-back confirms `In Progress` at 19:27:39Z.
- 19:28Z — branch created, run log opened (first file write).
- 19:32Z — **premise measured against `ccf77b1`: HOLDS.**
  `.github/workflows/claude-linear-dispatch.yml` is 412 lines; after the
  `Work the issue` step (`:102-359`) there are exactly two steps —
  `Keep the execution log` (`:387-396`) and `Record the session id`
  (`:402-411`) — and both are `if: always()` bookkeeping. **No step reads the
  issue's final state, and nothing asserts anything about it.** Item 28e is at
  `docs/swarm/constitution.md:451-456`, exactly as the issue cites. The issue's
  line numbers for the workflow (88-280, 174-198) have drifted and are recorded
  here as corrected; the substance is unchanged.
  Also measured: `tsconfig.json` includes only `src` and `vite.config.ts`, so a
  `scripts/**.mjs` file is not typechecked; `eslint.config.js` has a
  `scripts/**/*.mjs` Node-globals block, so it *is* linted; `format:check`
  covers `src/**` and root files only, so it is not format-checked; and
  `scripts/migrate/*.test.ts` proves a script under `scripts/` is a normal
  vitest target in this repo.
- 19:32Z — this contradicts the issue's "no named mutation can turn a workflow
  YAML red" only in part: the YAML stays untestable, but the **decision** it
  calls can live in a tested pure function. That is what makes STANDARD's
  "orchestrator replays the mutation" satisfiable here.
- 19:38Z — **packet written**: `docs/swarm/active/GAM-314-packet.md`. Three
  allowed files (script, its test, one workflow step), 7 acceptance criteria
  including a named mutation, and a 5-entry least-confident list for the gate.
- 19:40Z — **premise gate round 1 dispatched** (`checker-premise`, its pinned
  opus). Dispatched with `run_in_background: false` — the orchestrator blocks on
  the verdict rather than ending its turn with the subagent in flight, which is
  this very issue's failure mode. If this line is the last one in this file, the
  run died holding the gate and instance 5 has been recorded.
- 19:50Z — **premise gate round 1 verdict: REVISE.** 1 BLOCKER, 3 MAJOR, 4
  MINOR, 2 NIT. Tier judgement STANDARD upheld with reasoning. The BLOCKER is
  the one that matters: the workflow's own prompt (`:197-199`, shipped in PR
  #141) tells an agent near the wall clock to stop and push, which ends green
  with the issue **legitimately** `In Progress` — a run shape the packet's rule
  table did not enumerate. Also measured by the gate and not by me: **0 of 83
  issues in this workspace are in `In Review` or `Todo`**, so acceptance
  criterion 2 was unverifiable as written; and `filter.ts` rules 4-5 dispatch on
  **any** transition into `Todo`, not just `Backlog → Todo` (GAM-304 went
  `In Progress → Todo` at 13:11:21Z and run 31391626696 was created 13:11:25Z,
  four seconds later) — so `Todo` is a re-dispatch trigger, not a resting state.
  Full verdict text kept in the transcript; findings actioned below.
- 20:00Z — **packet revised for round 1's findings.** BLOCKER 1 decided as
  *still FAIL*, with the message and the workflow comment required to name the
  benign deliberate-stop case so nobody deletes the check. MAJOR 4 accepted: the
  assertion becomes a **separate `needs: work` job with its own checkout and
  `contents: read`**, not a step in the job whose tree it is judging. MAJOR 2:
  criterion 2 rebuilt on states that exist (GAM-304 is `Done` → exit 0), with
  the live `In Review` leg assigned to the orchestrator after the item-28e move.
  MAJOR 3, MINOR 5-8, NIT 10 all actioned. Baseline measured here, not
  borrowed: **83 files / 2162 tests at `ccf77b1`**. Verified the gate's own
  citations independently — GAM-312's real title, the 0/0 `In Review`/`Todo`
  census, and `filter.ts:273`'s rule-4 match on the *new* state alone.
