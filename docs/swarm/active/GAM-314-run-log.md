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
