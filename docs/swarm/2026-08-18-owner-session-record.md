# Owner session record — 2026-08-18

Interactive Claude Code (remote) session, owner present and directing. Branch:
`claude/multi-agent-workflow-plan-xa75rj`. This session started the
durable-execution plan's implementation program after the owner granted a
per-session exception: work proceeds without a Todo promotion or dispatch,
but every piece of work has a tracked Linear issue first. The exception is
recorded as a comment on each claimed issue and is not a reusable route.

## What this session did

1. **Preserved the canonical plan.** The proposal existed only in the owner's
   local Downloads folder; it is now
   `docs/swarm/2026-08-15-durable-multi-agent-execution-plan.md` (commit
   `8f9d88a`), still marked "proposal pending owner approval".
2. **Re-measured Phase 0.** Done: GAM-374 (branch protection), GAM-397/398
   (executor routing). Not done, all four owner decisions: `Needs Attention`
   state (team has 7 states, none of them it), item-28 amendment
   (`constitution.md:457-462` race text unamended), required-check contract
   (nothing machine-readable existed), state-store spike (unapproved).
3. **Filed eight issues** per `linear-task-writing`: GAM-399 (Phase 0 owner
   decisions, `gate/human`), GAM-400 (item-28 amendment draft), GAM-401
   (required-check manifest), GAM-402 (ci.yml timeouts), GAM-403 (credential
   preflight, Phase 1, heavy), GAM-404 (terminal-failure notification,
   Phase 1, standard), GAM-405 (per-edit lint hook removal, Phase 1, fast),
   GAM-406 (run/phase event telemetry, Phase 1, heavy). GAM-385 was re-read
   and deliberately not duplicated — it remains the consumption-telemetry
   row; GAM-406 is the event-timeline sibling.
4. **Executed GAM-400, GAM-401, GAM-402 in-session** (claimed
   `Backlog → In Progress` under the exception above; completion evidence
   below).

## Evidence

Gate run on the dirty tree before committing (final clean-tree run to be
quoted wherever these commits become a PR):

```
GATE RUN — 8f9d88a on claude/multi-agent-workflow-plan-xa75rj — tree DIRTY
  1 tsc          exit 0  PASS
  2 vite build   exit 0  PASS
  3 format:check exit 0  PASS
  4 eslint       exit 0  PASS   0 errors, 379 warnings
  5 vitest full  exit 0  PASS   96 files / 2466 tests
  6 vitest scripts/required-checks-validate.test.mjs  exit 0  PASS  8 tests
VERDICT: PASS — all six gates exit 0
```

Mutation replays for GAM-401 (STANDARD), both via `replay.py`, both reverted
clean:

- "remove the rename-drift guard" (`const hits = …` → `const hits = 1;`):
  **REDDENED**, 1 failed / 7 passed.
- "loosen the job-level indent pinning" (`/^ {4}name: /` → `/^\s*name: /`):
  **REDDENED**, 3 assertions failed, including the live-repo drift guard.

Incidental baseline for GAM-405, measured here because the hook fired on this
session's own edits: full-repository `npm run lint` = **8.7s wall** per
Edit/Write (warm `node_modules`, 379 standing warnings), plus a hard failure
mode — with `node_modules` absent the hook errors on every edit
(`ERR_MODULE_NOT_FOUND: @eslint/js`), which is the state every fresh remote
container starts in.

## Standing consequence

The dispatch-history measurements in GAM-402 came from the Actions jobs API,
which this environment CAN read through the GitHub MCP tools — earlier rows
(GAM-374, GAM-385) recorded the sandbox 403 as a hard wall. The wall applies
to dispatched-run sandboxes, not to interactive remote sessions; future
filings should not cite it as universal.
