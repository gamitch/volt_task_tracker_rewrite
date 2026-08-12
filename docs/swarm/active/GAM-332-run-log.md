# GAM-332 run log

Title: The reconciliation sweep drops merged PRs whose declaration failed to
parse — the cases most likely to be wrong.
Tier label at dispatch: `tier/fast`.

- 2026-08-12: Claimed via `issueUpdate` (Todo → In Progress), read back and
  confirmed `state.name === "In Progress"`. If this line is the last one in
  this file, the run died holding this claim with no further progress.
- 2026-08-12: Tier confirmed FAST (matches the `tier/fast` label already on
  the issue) -- pure function change to `scripts/linear-reconcile.mjs`, no
  write path (script stays read-only, no `issueUpdate`/`commentCreate`
  added), no schema/RLS/auth/migration, no changed exported signature
  another module imports, ~24 lines of production diff. Orchestrator
  implements directly per item 26; no subagent dispatched for this issue.
- 2026-08-12: Fix implemented in `scripts/linear-reconcile.mjs`:
  `runReconcile` now reports PRs whose declaration parse failed with code
  `AMBIGUOUS_DECLARATION`, `HALF_DECLARATION`, or `PLACEHOLDER` as their own
  drift entries (never querying Linear for them, since the parse failure
  means there is no single issue to attribute the PR to), instead of
  silently dropping them via the old `declaration.ok === true` filter.
  Two new tests added to `scripts/linear-reconcile.test.mjs`.
- 2026-08-12: Named mutation run and confirmed red -- reverted
  `scripts/linear-reconcile.mjs` to its pre-fix HEAD~1 content (tests file
  left at the fix version) and reran `npx vitest run
  scripts/linear-reconcile.test.mjs`: the two new tests failed with
  `expected undefined to be 1` / `expected undefined to be 3` (result had
  no `failedParse` field), all other 20 tests still passed. Restored the
  fix via `git checkout HEAD -- scripts/linear-reconcile.mjs`; full suite
  green again (22/22). Mutation proof: real red output confirmed the new
  tests exercise the fix, not a vacuous assertion.
