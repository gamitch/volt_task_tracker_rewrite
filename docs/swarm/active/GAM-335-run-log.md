# GAM-335 run log

Issue: [GAM-335](https://linear.app/gamitch/issue/GAM-335/shadow-mode-computes-its-intended-action-from-the-post-automation) —
"Shadow mode computes its intended action from the post-automation state, so
an ordinary declared merge always scores MISMATCH — the 10-MATCH exit
criterion is unreachable"

Append-only. One line per milestone, committed and pushed immediately.

---

- **claimed** — read `AGENTS.md` § "Where work comes from" and
  `docs/swarm/constitution.md` items 19, 26, 28 first, in that order, per the
  dispatch prompt. No Linear MCP tool in this runtime; used direct GraphQL via
  `scripts/linear/client.mjs` (`LINEAR_API_KEY` present in env). Moved
  GAM-335 `Todo` → `In Progress` (`issueUpdate`), then re-read the issue:
  `state.name = "In Progress"`. Read-back confirms the claim (item 28c).
  Issue already carries `tier/fast`, not `tier/unreviewed`, so item 28d's
  claim-time tiering duty does not apply — tier judgement below is item 26's
  independent check, not a first tiering.
- **premise measured against current `main` (`2d22664`) — HOLDS.**
  `scripts/linear-sync.mjs:619` fetches `issue` live (post-automation, since
  the incumbent `merge -> Done` fires ~2s after merge and the sync run starts
  well after that). `decide()` is called with that live `issue` at line 624.
  `runShadowComparison` (541-583) separately reconstructs the prior state via
  `reconstructAutomationTransition` (565) but uses it **only** to decide
  whether `automationClosed` is true (567) — the reconstructed state is never
  fed back into `decide()`. So `decide()` sees `state.name === 'Done'` for any
  ordinary already-closed-by-automation merge, hits the `stateName === 'Done'`
  branch (251-269) with no `ownClaim` (shadow never posts a claim comment),
  and returns `DUPLICATE_CLOSE_CLAIM` → `action: 'none'` →
  `intendedWouldClose = false`, which mismatches the automation's real
  `automationClosed = true` every time. Matches the issue's cited run
  31600702807 exactly. Confirmed by reading, not re-running (a network probe
  against Linear isn't warranted for a wiring bug already reproduced live).
- **tier judgement (item 26) — FAST confirmed.** Trigger question: *can a
  mistake here corrupt data, or lie to a user about their own data?* No —
  `SYNC_MODE` is hardcoded `shadow`; shadow mode never writes to Linear
  (confirmed: `runShadowComparison` only reads + posts to Slack; the write
  path in `main()` is gated behind `syncMode === 'shadow'` returning early at
  line 643 before any `issueUpdate`/`postComment` call). No schema, RLS,
  migration, or auth/role logic. No signature another module imports changes
  (new export only). Single module (`scripts/linear-sync.mjs` +
  `scripts/linear-sync.test.mjs`). Fix is call-site rearrangement, well under
  20 lines. A named mutation exists (see below) that turns a new test red.
  **FAST**, matching the issue's own tier claim.
- **fix implemented directly (FAST — orchestrator implements, no packet, no
  worker).** `scripts/linear-sync.mjs`: added exported `resolveShadowIssueState
  (issue, historyNodes, mergedAt)` — overrides `issue.state.name` to the
  reconstructed prior state when `reconstructAutomationTransition` finds a
  merge-coincident transition, returns `issue` unchanged otherwise (preserves
  the already-`Done` degenerate-MATCH case) and when `issue` is falsy. `main()`
  calls it before `decide()`, gated on `syncMode === 'shadow' && issue` —
  live mode's `decide()` call is untouched (still receives the unmodified live
  `issue`), satisfying the issue's constraint 1. Constraint 2 (reconstruction
  stays the only source) is satisfied: no new source added, same
  `reconstructAutomationTransition` reused. Diff: +29/-1 lines in
  `scripts/linear-sync.mjs` (new function + 9-line call-site change), well
  under FAST's ≤20-line production-change guideline for the actual logic
  change (docstrings included above that but are not "production change" in
  the item 26 sense). No write path touched — shadow mode still returns before
  any `issueUpdate`/`postComment` call (verified by reading `main()` through
  line 643).
- **tests added** — `scripts/linear-sync.test.mjs`: 4 new cases under
  `resolveShadowIssueState`, reusing the existing `GAM_303_HISTORY_PROBE`
  fixture and `issue()`/`pr()` helpers already in the file. The 4th case is the
  integration proof: feeds the same post-automation `issue` (state `Done`)
  into `decide()` both without and with the fix, asserting
  `DUPLICATE_CLOSE_CLAIM`/`none` unfixed vs `CLOSE`/`close` fixed — this is the
  exact defect from the issue's cited run 31600702807, reproduced as a unit
  test.
- **committed before mutating** (item 26 fast-tier working rule) —
  `06aae1e`. `npx vitest run scripts/linear-sync.test.mjs`: 60/60 green,
  including the 4 new tests.
- **named mutation run — RED, as predicted.** Edited
  `resolveShadowIssueState` in place to `return issue;` unconditionally
  (reproducing the original bug verbatim — the reconstructed state never
  reaches `decide()`). Re-ran the same test file: **2 failed / 58 passed**,
  and the 2 failures are exactly the 2 tests that assert the fix's effect —
  `expected 'Done' to be 'In Progress'` and
  `expected 'DUPLICATE_CLOSE_CLAIM' to be 'CLOSE'`. No other test moved.
  `git checkout -- scripts/linear-sync.mjs` restored the real fix; re-ran:
  60/60 green again. Real red output captured above, not summarized.
- **gates run** — `gate-run --require-clean`, baseline measured fresh at merge
  base `2d22664` (== `origin/main`) via a dedicated worktree (`npm ci` +
  `npx vitest run` there): full suite 2359, `scripts/` scoped 235.

  ```
  GATE RUN — 3d79876 on claude/gam-335-shadow-mode-prior-state — tree clean
    1 tsc              exit 0  PASS
    2 vite build       exit 0  PASS
    3 format:check     exit 0  PASS
    4 eslint           exit 0  PASS       0 errors, 377 warnings
    5 vitest (full)    exit 0  PASS       89 files / 2363 tests  baseline 2359 (+4)
    6 vitest scripts/  exit 0  PASS       9 files / 239 tests   baseline 235 (+4)
  VERDICT: PASS — all six gates exit 0
  ```

  **All six, not five** — `--scope scripts/` gave gate 6 a real scope, since
  the diff is entirely under `scripts/`. Both counts are +4, matching the 4
  new tests exactly; no other test moved.
- **PR opened — #167** — https://github.com/gamitch/volt_task_tracker_rewrite/pull/167.
  `Closes GAM-335` first body line (item 28f); branch
  `claude/gam-335-shadow-mode-prior-state` carries the identifier and this PR
  *is* GAM-335's own work, so that's correct per item 28g, not the "mentions
  only" case. `Linear-Issue: GAM-335` trailer present in this commit for the
  git-side record (no `Tnnn` — this issue has no legacy number, matching this
  repo's existing convention for `GAM-nnn`-only rows, e.g. GAM-332's commits).
  No workflow file touched, so the item 28 two-PR wall does not apply.
- **moved `In Progress` → `In Review`** (item 28e — never `Done`; the merge
  automation closes it, not this run). Read back: `state.name = "In Review"`,
  `attachments = [".../pull/167"]`. Work is finished and awaiting human
  acceptance.

## Outcome

**FAST tier, complete.** Fix implemented directly by the orchestrator, no
worker/checker dispatched (item 26 does not require one at this tier, and none
was used — no subagent was in flight at any point this run, so the
run_in_background hazard this dispatch warns about never applied). Premise
measured and held; named mutation run red then green; all six gates pass; PR
#167 open; GAM-335 `In Review`. Nothing left in flight.
