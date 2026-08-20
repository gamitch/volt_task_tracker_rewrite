Closes GAM-404

## What changed

Adds `scripts/linear-terminal-failure-notify.mjs` (plus tests), which notifies
Slack on terminal CI failures the existing `linear-escalation-notify.mjs` does
not cover — a run that times out, crashes, or is cancelled without ever
leaving a `**Escalating` comment. It imports `detectEscalation`/
`fetchIssueForEscalation` from the sibling escalation script and
`classifyState`/`isIssueNotFoundError` from `linear-assert-released.mjs`,
read-only — neither sibling is edited (verified byte-identical to `main`).

The corresponding workflow half — `id: assert` on the existing "Assert the run
released its claim" step, plus a new step wired to `needs.work.result` and
`steps.assert.outcome` — cannot be committed from this dispatched run:
`.github/workflows/**` is unpushable (credential wall, `AGENTS.md` "Two walls"
#1, confirmed on GAM-314). Both edits are preserved as
`docs/swarm/active/GAM-404-workflow-terminal-failure-notify.patch`, verified
with `git apply --check` against `main` and structurally parsed with
`js-yaml`, and were never committed to this branch's reachable history
(`git log --stat main...HEAD` shows no `.github/workflows/**` entry). An owner
or a scoped session applies it as a normal PR, per the GAM-314 precedent.

## What the issue got wrong

Nothing in the issue's own premise — its citations held throughout. The
premise gate did catch two false claims **inside the packet's own fix while it
was being written**, which is worth recording because it is the same defect
class the issue exists to close, reproduced one layer deeper: revisions 1 and
2 both asserted the new notify step's `NO_FAILURE` classification was
"unreachable," and both were wrong — the Assert step this notifier watches
goes red for three reasons (`In Progress`, `NOT FOUND`, either `UNDETERMINED`
shape), not one, so a second read that happens to look clean can fall through
to silence on a genuinely red job. Round 2 of `checker-premise` measured this;
revision 3 closes it with a fourth classification, `ASSERT_FAILED`, gated on
`steps.assert.outcome` threaded through the workflow. See the run log for both
rounds' full verdicts.

## Tier, stated and defended

**STANDARD**, matching the issue's own `tier/standard` label and the packet's
sizing: no write path or destructive operation, no schema/RLS/migration/auth
logic, an external Slack write only. Process actually followed: full HEAVY-style
premise gating (two `checker-premise` rounds, capped and escalated per item
19a — round 1 found 1 BLOCKER/3 MAJOR, round 2 found 1 MAJOR/7 MINOR/3 NIT, no
BLOCKER) even though the tier is STANDARD, because the issue's own filing
called for it and the design touches the exact "who notifies on failure"
surface where a silent gap is expensive to discover later. One
`worker-implementer` dispatch, no separate `checker-reviewer` round — the
orchestrator independently reviewed the diff, replayed the packet's named
mutation, and reran all six gates directly rather than delegating that to a
second checker agent. Full trail in `docs/swarm/active/GAM-404-run-log.md`.

## Verification

```
GATE RUN — ee81b70 on claude/gam-404-terminal-failure-notify — tree clean

  1 tsc              exit 0  PASS
  2 vite build       exit 0  PASS
  3 format:check     exit 0  PASS
  4 eslint           exit 0  PASS       0 errors, 380 warnings
  5 vitest (full)    exit 0  PASS       101 files / 2578 tests  baseline 2566 (+12)
  6 vitest scripts/  exit 0  PASS       15 files / 352 tests  baseline 340 (+12)

VERDICT: PASS — all six gates exit 0
```

Baselines (2566 full / 340 scoped) are this run's own post-merge, pre-worker
measurement — the packet's cited branch-point baseline (13 files/299 tests)
had gone stale under 68 unrelated commits of `main` history and was
re-measured before dispatch rather than reused.

| Mutation | Result |
| -- | -- |
| Deleted `if (assertOutcome === 'failure') return { shape: 'ASSERT_FAILED', notify: true };` in `classifyTerminalFailure` (packet's own named mutation for criterion 5) | 2 tests red (`ASSERT_FAILED` classify case + its Slack-post case), 10 stayed green. Restored, byte-diff confirmed, re-ran 12/12 green. |

Independently replayed by the orchestrator, not taken from the worker's
self-report — the worker's own run of the same mutation reported the same
result, and both are recorded in the run log.

## Scope: what this does and does not close

This closes "notify on every terminal failure *reachable from inside the
`assert-released` job*" — timeout, crash, cancellation of the `work` job, and
an Assert step that itself goes red for a since-cleared reason. It does not
close, and cannot structurally close from inside this workflow, a run whose
GitHub Actions workflow never schedules any job at all (webhook never
arrives, platform incident, whole-run cancellation before job dispatch) — see
Follow-ups below.

## Follow-ups filed

- **GAM-426** (`Backlog`, `tier/unreviewed`) — the whole-run-scheduling-loss
  gap named above. Needs infrastructure external to this workflow (the plan's
  run-store/controller, `docs/swarm/2026-08-15-durable-multi-agent-execution-plan.md`
  §5.7), not a script edit, so it is out of scope here rather than deferred
  quietly.

## Known gaps, disclosed

- Cross-run/redelivery dedup is deliberately out of scope (packet §6.1) — the
  concrete reachable duplicate sources are an operator re-running the failed
  job, or the `Todo` self-re-dispatch loop tracked as GAM-326, not GitHub
  webhook redelivery.
- `WORK_JOB_FAILURE`/`WORK_JOB_CANCELLED`/`ASSERT_FAILED` can fire for a
  reason unrelated to the dispatched agent's own work (e.g. a post-processing
  step failing on infra grounds after the agent succeeded) — accepted as a
  false-positive-over-silence tradeoff, consistent with
  `linear-assert-released.mjs`'s own "denylist of one, not an allowlist."
- The new script reads Linear a second time rather than threading the Assert
  step's result through `GITHUB_OUTPUT` — believed negligible against the
  measured 2500/hour rolling rate limit, but it is why `ASSERT_FAILED` had to
  exist at all (the two reads can disagree).
- `js-yaml`, used to structurally verify the preserved patch, is a transitive
  dependency (via `eslint > @eslint/eslintrc`) and not declared — a future
  `npm prune` or major eslint bump could silently drop it.

Linear-Issue: GAM-404
