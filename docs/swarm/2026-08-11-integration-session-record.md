# 2026-08-11 — the Linear ↔ GitHub integration session, start to finish

**What this is.** One session, roughly 2026-08-11 14:00Z to 2026-08-12 13:00Z, that
went from "evaluate our Linear/GitHub integration" to a built, merged, shadow-mode
replacement for the last semantic automation — plus two dispatch-loop defects found
and fixed on the way. Written because the reasoning lives in a conversation that
will not survive, while the decisions it produced now bind future agents.

The design itself is `2026-08-11-linear-github-integration-proposal.md`. **This
document does not restate it** (item 3). It records what happened, what was
measured, what was decided, and what is still open.

---

## 1. The question, and the answer

The owner's ask, verbatim:

> _"Currently our setup with Linear, Github and Claude 'automates' movment of
> tickets in Linear using semantics. texts in the pr title and other text methods.
> I'd like to propose a better integration that would utilize something more
> durable and predicatble such as webhooks or another event driven integration."_

**The finding: the inbound half was already what was being asked for.** A Linear
webhook → Supabase edge function → `repository_dispatch` → `claude-code-action`
has been live and proven since 2026-08-09. What is text-driven is the *outbound*
half — Linear's native git automations inferring issue state from identifiers in
branch names and PR titles. That is where all thirteen catalogued wrong moves came
from, and that is what the proposal replaces.

The distinction mattered: half the system did not need rebuilding, and saying so
kept the work proportionate.

---

## 2. What actually shipped

| PR | What | Merge |
| -- | -- | -- |
| #155 | The evaluation and proposal | `e3ba128` |
| #156 | Revision answering review round 2 | `b9383a4` |
| #157 | Rounds 3–6 and the owner-scale simplification | `f663fa3` |
| #158 | Phase 0/1 recorded as built | `d907844` |
| #159 | `assert-released` script + 16 tests (GAM-314) | `0f2ff4d` |
| #160 | The `assert-released` workflow job | `be2f16b` |
| #161 | The subagent-blocking rule (GAM-328 part 2) | `7d4dee1` |
| #163 | GAM-325 lanes A/B/C/E — the sync, gate, sweep, notifier | `0c58c9c` |
| #164 | GAM-325 lane D — the three workflows | `4fd399b` |

**Live configuration changes**, all owner-executed, all recorded in constitution
item 28g: two of three team git automations disabled (`On PR open`,
`On PR review request`), the personal *on git branch copy → started* automation
disabled, **auto-close stale issues** disabled, the repository made public, three
secrets created, and a `#tracker` Slack channel wired to both GitHub workflows and
Linear status changes.

---

## 3. The measurements that changed decisions

Recorded because each one overturned something that had been asserted, and the
same reflex will recur.

**The vendor documentation was the cheapest instrument and nobody read it for
three gate rounds.** GAM-315 spent three premise-gate rounds unable to separate the
title channel from the negated-magic-word case. Linear's own docs state both
channels link independently — there was never a disjunction. The owner supplied
the doc anchors mid-session and five claims moved from inferred to vendor-confirmed
in minutes.

**`Todo` is a re-dispatch trigger, not a resting state.** The filter fires on *any*
transition into `Todo`, not only from `Backlog` — measured at four seconds on
GAM-304. It cannot be used as a "needs me" parking column.

**The repository's visibility flipped twice in one day**, and both measurements
were correct when taken. A dispatched run measured `private: true` at 17:00 and
correctly struck a claim in the proposal; the owner made it public at 17:57 in
response; the strike became false and had to be corrected again. §6.4 now records
the sequence with both timestamps and the reproduction command rather than a
sentence that will rot.

**The required trailer contains a closing magic word.** Item 28f mandates
`Linear-Issue: GAM-nnn`, and `linear issue` is on Linear's closing list. The
trailer is inert **only** because the workspace commit-linking toggle is off — one
click from turning dozens of merged commits into closing instructions.

**Three of the four state-writers found were found by accident**, while looking at
something else. The auto-close-stale-issues automation — able to cancel a
`gate/human` row on age alone, with `GAM-80`, `GAM-75` and `GAM-62` exposed — was
spotted in a screenshot taken for a different purpose. **This workspace's writers
are not enumerable from the repository**, which is why item 28g now leads with the
reproduction query rather than the prose list.

---

## 4. The dispatch loop: two defects, one cure, one detector

This consumed more of the session than the integration work and matters more to
everything that follows.

**The defect.** Five dispatched runs (`31354278407`, `31385764526`, `31514339272`,
`31523233268`, `31527801235`) ended their turn with a subagent still in flight. The
process exits, takes the subagent with it, and the SDK returns *normally* — so the
job goes **green** while the work never happened. None was near `--max-turns` or
`timeout-minutes`; four of the five died at the identical boundary, dispatching a
`checker-premise`.

**The cure is one parameter.** `run_in_background: false`, so the orchestrator
blocks. The one run that completed a full chain before the fix did exactly that,
having reasoned its way there because it was dispatched to fix this very bug. PR
#161 wrote the rule into the dispatch prompt with all five run IDs as evidence, and
the next dispatched row (GAM-325 run 4) survived **eight** subagent dispatches.

**The detector is separate and also landed.** GAM-314's `assert-released` job fails
any run that leaves its issue in `In Progress`. It fired for the first time on
dispatch run #15 — `work` green in 7m48s, `claim released` red in 5s — which is
exactly the signal it was built to produce. **The detector does not prevent the
stall; the prompt does.** Both files say so, because conflating them would be the
comfortable mistake.

**Still open:** whether the subagent default can be made synchronous at the
`claude_args` or `settings.json` level, which is the only *structural* fix. That is
GAM-328 part 1 and it is a measurement nobody has taken.

---

## 5. Three walls a dispatched run hits

Discovered in order, each by a run spending real budget before hitting it.

1. **Cannot push `.github/workflows/**`.** Both credentials refused. Deliberate — it
   is what stops an autonomous run rewriting its own `--allowedTools` and turn
   caps. Owner ruling (GAM-328): **keep the boundary.** Delivery path: the run
   preserves an applyable patch, a scoped session opens it as a normal PR, CI runs,
   the owner merges. Proven by #159→#160 and again by #163→#164.
2. **Cannot open a PR.** Push works; `createPullRequest` returns 403 on both REST
   and GraphQL. Found at the very end of GAM-325's run. Filed as **GAM-333**; the
   run posts the complete PR body as a handover comment so the owner opens it by
   paste rather than reconstruction.
3. **Cannot observe its own workflow runs** — `GET /actions/runs` returned 403 on
   run 1 and **200** on run 3, apparently because the repository became public
   between them. Worth knowing that this wall moves.

Walls 1 and 2 mean **workflow-touching work always arrives as two PRs**, which
produced its own defect — see GAM-334 below.

---

## 6. What the process caught that a person would not have

**The premise gate found the wall before the code was wasted** — round 2 on GAM-325
discovered that lane D's *entire* Allowed Files set was undeliverable. No earlier
draft had noticed.

**The checker reproduced a silent under-close end to end.**
`Closes GAM-325 and GAM-326` passed the gate **green**, the sync then refused it,
and the sweep **dropped it** because it filters `declaration.ok === true`. Declared,
merged, never closed — the precise failure the row exists to remove, reached by a
new road, with the one instrument built to catch it looking the other way. Fixed in
lane C; the sweep half is **GAM-332**.

**A worker's self-report was wrong and the orchestrator caught it.** On GAM-314 the
worker reported its mutation as "exit 0 with 3 tests failed"; the independent
replay returned exit 1. This is why workers do not self-certify.

**The gate caught its own author.** `Linear declaration`'s first live firing failed
PR #164 — the branch carried `GAM-325`, line 1 did not declare it. Red, then green
on the fix. The same run proved the workflow parses, executes, and loads its parser
from `main` rather than from the PR.

---

## 7. Where it stands

**Phases 0, 1 and 2 are done.** The sync, gate, sweep and notifier are merged and
live; `SYNC_MODE` is hardcoded `shadow`, so **nothing writes to Linear**.

**The shadow window is open at 1 of 10.** PR #164's merge produced the first live
verdict, and it is worth quoting because every layer behaved:

```
SYNC_MODE resolved to "shadow" (raw: "shadow").
decide() -> DUPLICATE_CLOSE_CLAIM: GAM-325 already Done,
            but not claimed by PR #164 -- no move, a human decides.
MATCH: shadow intended DUPLICATE_CLOSE_CLAIM vs automation no-op.
```

Cutover needs **ten consecutive `MATCH`es plus three staged control PRs**, with
`On PR merge → Done` staying enabled throughout — disabling it early inverts the
comparison and makes the exit criterion unreachable.

**Phase 3 is ordered and it halts.** Mark the declaration check required and
**verify it blocks**; if it cannot be made blocking, stop — do not disable
`merge → Done`, or the tracker is left with no closer at all.

### Open rows, highest value first

| Row | Why it matters |
| -- | -- |
| **GAM-332** | The sweep is blind to failed-declaration merges — the surviving half of the defect the checker reproduced. `tier/fast`. *In progress at the time of writing.* |
| **GAM-334** | The gate cannot express "second half of a two-PR row", so every workflow-touching row goes red on the PR that completes it. **Hard-blocks at Phase 3**, when a red gate stops the merge |
| **GAM-333** | The third wall, undocumented in `AGENTS.md` |
| **GAM-328** | Part 1 only: can the subagent default be made synchronous? The one structural fix |
| **GAM-329/330/331** | Gate has no checkout; `client.mjs` has no `AbortSignal`; verify `import.meta.main` at next deploy |
| **GAM-327** | Nothing lints the workflow files — and it will hit GAM-334 immediately |

**Closed this session:** GAM-314 (delivered whole via #159/#160), GAM-322
(superseded; its recommendation executed in Phase 0), GAM-325 (built and merged).

### The two owner actions still outstanding

1. Re-point the Slack subscription to filter by workflow **name** rather than
   event — `workflows:{}` clauses are ANDed, so an event or branch filter hides
   `pull_request`-triggered runs, which is the sync and the gate.
2. `workflow_dispatch` `linear-reconcile.yml` and record the run's **conclusion**.
   `state: active` is not evidence — GitHub lists deleted workflows as active.

---

## 8. What this session should be remembered for

**The review process was worth its cost, and the number is specific.** The proposal
went through six review rounds — two external reviewers, one internal verification
pass, twenty-one findings, all accepted. Round 6 was the valuable one because it
*cut*: the trigger reverted to plain `pull_request`, two jobs collapsed to one, and
three pieces of machinery were deleted as over-specified for a repo at ~10
merges/day. **The architecture never moved across all six rounds** — every
revision-1 decision survived — but Phase 2's build had quietly grown to 2–3× its
original size before the drift check caught it.

The owner's question — *"i hope we are not getting into substantial design drift
and over complicating this"* — was the highest-leverage intervention in the
session. It produced a measurement rather than a reassurance, and the measurement
said: no drift, real over-complication, here are the four cuts.

**Every guard chain here terminates in review, not in mechanism**, and the
documents say so where it is true. The gate can be edited by the PR it judges. The
policy checks are repo code. What bounds the regress is that gutting a check is
loud in a diff and a required check that stops reporting blocks rather than passes.
Claiming more than that would be the same overreach this project keeps catching.
