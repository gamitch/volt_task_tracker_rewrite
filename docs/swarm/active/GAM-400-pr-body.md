Closes GAM-400 — the declared row; two sibling rows close through the title channel, see "How the other two rows close" below.

## What changed

Three Phase 0/1 slices of the durable-execution plan, one commit each: the item-28 atomic-claim amendment draft for owner approval (`docs/swarm/active/item-28-atomic-claim-amendment-draft.md`, constitution untouched), the machine-readable required-check manifest with its drift validator (`.github/required-checks.json`, `scripts/required-checks-validate.mjs` + tests), and measured `timeout-minutes` bounds on `ci.yml`'s four jobs. The branch also carries the canonical plan document itself and the 2026-08-18 owner-session record.

## How the other two rows close

This PR is the work of three rows. Line 1 may declare only one, so GAM-400 is the declaration and the PR **title deliberately carries GAM-401 and GAM-402** — a title identifier links by itself and the *PR merged → Done* automation applies to a title-linked issue (item 28f, first row of the table, measured on #141). Do not tidy the identifiers out of the title; removing them would strand both rows in In Review.

## What the issues got wrong

GAM-402's constraint section predicted the workflow credential wall (GAM-328) would force a patch-plus-owner-application delivery. Measured instead: the interactive session's credential pushed `.github/workflows/ci.yml` directly — the wall belongs to dispatched-run credentials, not to this session type. The direct edit shipped and no patch artifact was committed, exactly the fallback branch the issue named. Recorded as a standing consequence in `docs/swarm/2026-08-18-owner-session-record.md`. GAM-400's and GAM-401's premises held as filed.

## Tier, stated and defended

Three rows, tiered at filing and defended in each body: **GAM-400 FAST** (one markdown file, no code, no write path — STANDARD's argument, that governance text is load-bearing, loses because the draft activates nothing until two explicit gates pass), **GAM-401 STANDARD** (new script other automation will trust; the losing FAST argument was "no product write path", which underweights the steward later treating this validator as ground truth — mutation replay was run, see below), **GAM-402 FAST** (four YAML lines; the change's blast radius is a CI job dying at 10 minutes instead of 360).

Process deviation, declared: all three were executed in the owner's interactive session under an explicit per-session exception (Backlog → In Progress without Todo promotion or dispatch), quoted verbatim in a comment on each row. No worker/checker separation was used; none of the three tiers requires it.

## Verification

```
GATE RUN — 8d34bb4 on claude/multi-agent-workflow-plan-xa75rj — tree clean

  1 tsc                                               exit 0  PASS
  2 vite build                                        exit 0  PASS
  3 format:check                                      exit 0  PASS
  4 eslint                                            exit 0  PASS       0 errors, 379 warnings
  5 vitest (full)                                     exit 0  PASS       96 files / 2466 tests  (no baseline given — regression not checked)
  6 vitest scripts/required-checks-validate.test.mjs  exit 0  PASS       1 files / 8 tests  (no baseline given — regression not checked)

VERDICT: PASS — all six gates exit 0
```

Mutations (GAM-401's validator, via `replay.py`, each reverted clean):

| Mutation | Result |
| -- | -- |
| remove the rename-drift guard (`const hits = jobNames.filter(…)` → `const hits = 1;`) | **red** — 1 failed / 7 passed, the "fails on a renamed job" assertion |
| loosen the job-level indent pinning (`/^ {4}name: /` → `/^\s*name: /`) | **red** — 3 assertions failed, including the live-repo drift guard (`problems` no longer `[]`) |

CI on this branch's head (run #2317, the first run under the new timeout bounds) completed green after the push.

## Scope: what this does and does not close

- **GAM-400 closes with the draft existing and reviewable — not with the amendment active.** Activation is double-gated on GAM-399 decision 3 and the Phase 2 spike; `constitution.md` is unchanged by this PR.
- **GAM-401 closes with the contract machine-readable and internally validated.** The manifest stays `status: "provisional"` until the owner diffs it against the live branch-protection required set (GAM-399 decision 4), which no agent session can read. The validator is not yet wired into CI.
- **GAM-402 closes fully**: the bounds are live on any branch containing this merge.

## Follow-ups filed

Filed to Backlog before this PR opened, each with tier stated and defended in its body rather than `unreviewed`: **GAM-399** (the four remaining Phase 0 owner decisions, `gate/human`), **GAM-403** (credential preflight, heavy), **GAM-404** (terminal-failure notification, standard), **GAM-405** (per-edit lint hook removal, fast — its baseline, 8.7s per edit, was measured this session and recorded on the row), **GAM-406** (run/phase event telemetry, heavy). Each is separate because each is its own plan slice with its own blast radius.

## Known gaps, disclosed

- One PR carries three rows — a declared deviation from one-issue-per-PR, taken because the slices were executed in one authorized session on one branch; each has its own commit for independent revert.
- The manifest's claim about which checks are *required* is unverifiable from any agent session; until GAM-399 decision 4 it is a well-evidenced guess with a status field saying so.
- Gate 5 ran without a baseline (2466 tests; the pre-change count was not recorded at the merge base). The suite grew by this PR's 8 new tests and nothing was removed.

Linear-Issue: GAM-400
Linear-Issue: GAM-401
Linear-Issue: GAM-402

🤖 Generated with [Claude Code](https://claude.com/claude-code)

https://claude.ai/code/session_01N599a2yubiWdexMSfXSDiG
