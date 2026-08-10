# Lessons from GAM-304 — running a HEAVY row through Linear dispatch

**GAM-304 changed four files. It took six dispatch runs, roughly twelve hours of
wall clock, and about $90 notional to get there.** Almost none of that went on
the change itself. It went on discovering that the dispatch path could not run
the process it was dispatched to run, and on four distinct ways a run can end
without delivering.

Every figure here is quoted from a run's own `result` object, from Linear's
state history, or from a transcript tool-count. Nothing is estimated except
where it says so.

**On the `$` figures:** this workflow authenticates with
`claude_code_oauth_token`, so runs draw on the owner's subscription and
`ANTHROPIC_API_KEY` is empty. `total_cost_usd` prices each run's tokens at API
list rates; **no invoice follows**. They are kept because they are the only
quantitative signal — subscription consumption is exposed as a number nowhere —
and they measure *capacity*, which is what actually runs out.

---

## The six runs

| Run | Ended | Turns | Wall | Bash | Notional | Delivered |
| -- | -- | -- | -- | -- | -- | -- |
| 31349834462 | `error_max_turns` | 81 | 24m | — | $9.16 | nothing |
| 31354278407 | success | 44 | 32m | — | $11.36 | packet + gate round 1 |
| 31357084288 | success | 64 | 22m | — | $8.52 | gate round 2 + escalation |
| 31358757094 | cancelled (60m wall) | ? | 60m | — | *lost* | nothing |
| 31385764526 | success | 54 | 59m | **238** | $28.58 | worker + verification |
| 31391626696 | success | 65 | 27m | **91** | $8.61 | resume → checker → PR |

**~$66 measured across five runs**, plus one unmeasured 60-minute run whose
artifact was destroyed by the bug in lesson 5 — so roughly **$90-95 total**, of
which **~$36 bought nothing at all**.

---

## 1. Automation mode silently removes what interactive sessions give free

The original failure was not a bug in anyone's code. `--allowedTools` is an
**allowlist that replaces the default tool set**, and the hand-written list
omitted the subagent tool. Delegation vanished with no error and no warning.

Consequences, none of which announced themselves:

* every model pin in `.claude/agents/` became dead config — the `opus` premise
  checker, the `opus` reviewer, the `fable` boss and the `sonnet` worker;
* one `sonnet` session played all five roles;
* constitution items 18, 19 and 26 became **unsatisfiable** rather than merely
  skipped — item 18's override rides "on the dispatch call", and there was no
  dispatch call.

The owner's question was the one that cracked it: *why did every previous
session pick models correctly?* Because in an interactive session nobody
chooses — the frontmatter pins apply themselves on every spawn. The mechanism
was invisible precisely because it always worked.

**Rule: when you build an automation path, enumerate what the interactive path
gives you for free, and verify each one is still there.** The workflow's own
note 3 already warned that an under-specified `claude_args` produces "a run that
starts, thinks, and accomplishes nothing." It was right, and it was still
missing a tool nobody thought to list.

## 2. Parameters sized without data are guesses, and they fail one at a time

Three hand-written constraints exist in dispatch that do not exist
interactively. All three were set the day the loop was built, before any real
run existed to size them against. All three failed:

| Constraint | Set by | Killed |
| -- | -- | -- |
| `--allowedTools` | Claude CLI | delegation, permanently and silently |
| `--max-turns 80` | Claude CLI | run 1, at turn 81 |
| `timeout-minutes: 60` | GitHub Actions | run 4, at 60:14 |

"An hour is generous" was written before anyone had watched a HEAVY chain —
worker, separate checker, a mutation replayed per acceptance criterion — run.
It is not generous; it is roughly the length of the worker phase alone.

**Expect the first few runs of any new automation to be measurement, not
delivery.** Budget for that rather than being surprised by it.

## 3. Durability is the highest-leverage change, and git is the only store

The single best change of the day was the owner's suggestion: **have the agent
commit a run log to git as it goes.**

`docs/swarm/active/<ISSUE>-run-log.md`, written as the first file action after
claiming, appended and pushed at every milestone — claimed, packet read, each
subagent dispatched, each verdict, gates, PR — *even when nothing else is ready
to push*.

The difference it made, measured on the same bug occurring twice:

| | Run 31354278407 | Run 31385764526 |
| -- | -- | -- |
| Same failure (success mid-chain) | yes | yes |
| Work pushed | none | worker commit, 4 files, +715/−44 |
| Record | none | 8 run-log commits |
| Recovery | hand-salvaged from an artifact | already in git |

It also turns `git fetch` into live monitoring, which nothing else provides —
the job log shows almost nothing, because `show_full_output` is deliberately off
(the agent holds a write-capable key and unrestricted Bash).

**Two honest caveats.** It is a *prompt*, not a mechanism: an agent can ignore
it, and a hook would be stronger. And its timestamps are self-reported and drift
— entries were observed up to 23 minutes ahead of real time. **Trust the
content and the ordering; use git commit timestamps for any timeline.**

## 4. A green run is not a completed run

Two runs reported `subtype: "success"` while a required chain step never
happened, because the agent ended its turn with a subagent still in flight:

> Round 2 is running in the background.

> Worker complete and independently verified on the critical path. **The checker
> is still running.**

Neither cap was close to binding — 44 turns of 200, then 54 of 300 with half the
clock unused. This is strictly more dangerous than `error_max_turns`, which at
least fails loudly.

**Never accept a run's conclusion as evidence.** Verify from things that
persist: was a branch pushed, does a PR exist, did the issue leave `In
Progress`? The honest post-run assertion is the narrow one — an issue still in
`In Progress` when the run ends means the agent dropped a claim it never
released. Filed as `GAM-314`.

## 5. Evidence has a fuse, and the guard protecting it can be the thing that burns it

Retention, in increasing order of trust:

* **run artifacts — 30 days** (`claude-run-<ISSUE>-<run_id>`);
* **job logs** — the repo's retention setting, and the only thing that survives
  a cancellation;
* **git** — permanent, and the only place worth keeping anything.

The trap was subtler than retention. The artifact step read:

```yaml
if: always() && steps.claude.outputs.execution_file != ''
```

The `!= ''` test existed to stop `upload-artifact` failing on an empty path — a
real hazard, documented in the file. But **a cancelled step never sets its
outputs**, so on the 60-minute timeout the guard read false, the step skipped,
and the run produced `total_count: 0` artifacts. *The guard that protected
against a confusing error guaranteed no evidence in the one case that most
needed it.*

**When you write a guard, ask which failure mode it goes blind on.**

## 6. The chain has redundancy, and it works — but only because it executes

The premise gate returned **REVISE twice**, hit item 19a's two-round cap, and
escalated. The owner authorized dispatch on the **never-gated** revision 3 as an
accepted risk.

That risk was real, and the chain caught it anyway. The worker found by
execution that `SupabaseLoaderError` is **not an `Error` instance**, so the
packet's prescribed `instanceof Error` catch — copied verbatim from T193 — would
have shown the generic fallback for exactly the error criterion 1 exists to
prove reaches the banner. It compiles. A reviewer reading the diff would likely
pass it.

Every finding that changed an outcome came from an agent that **ran** something:

* gate round 1 stood up PostgreSQL 16.14, proved six RLS paths, and measured a
  discarded `going` holding planned hours at `0 h` instead of `2.0 h`;
* gate round 2 executed the `clickAction` prescription and proved React 19
  Action semantics leave the concurrency guard **inert** — two concurrent
  writes, not one swallowed click;
* the orchestrator replayed criterion 2's mutation in its own worktree, proving
  the test pins the inequality rather than checking truthiness;
* the worker probed the real rejection object.

Item 26 already says it: *"A gate that only reads is worth much less than one
that runs."* Four independent confirmations in one row.

**Corollary worth keeping:** the worker also refused to write a test for
something structurally unreachable (criterion 7's clicked-row spinner — React
batching tears the row out of the tree in the same commit that sets the
in-flight flag). It asserted the observable half and documented the rest. A
fabricated assertion would have passed CI and meant nothing.

## 7. A machine that can escalate but cannot be un-escalated will stall

When the gate hit its cap, the agent did the right thing: labelled the row
`gate/human`, left it `In Progress`, and wrote a decision-ready comment with
three options.

Nothing could then act on the answer. The escalated state is non-dispatchable
**twice over** — `filter.ts` requires the new state to be `Todo`, and
`gate/human` returns `HUMAN_GATED` even from `Todo`. Comments cannot trigger
anything by design (`type !== 'Issue'` is dropped). And the owner was never
notified, because the dispatch key is their own personal key, so the agent's
comment is authored *by them* and Linear does not notify you about your own
comments.

It resolved only because a session happened to be watching. **Left alone it
would have sat in `In Progress` indefinitely, looking exactly like healthy work
in progress.** Filed as `GAM-317`.

Cheapest fix: the escalation comment offered three options and never said how to
enact one. Say the ritual — *remove `gate/human`, move to `Todo`*.

## 8. Cost is capacity, and the driver is not the obvious one

Turn count does not predict consumption. The **resume** run used *more* turns
than the expensive one (65 vs 54) and consumed a third as much:

```
31385764526   54 turns / 59 min / 238 Bash / $28.58
31391626696   65 turns / 27 min /  91 Bash /  $8.61
```

What tracks is **orchestrator Bash calls on opus** — `npm ci`, `tsc`, `vitest`,
`eslint`, git, mutation replays — each result enlarging an opus context.
Meanwhile `checker-tests` sits pinned to **haiku** with the charter *"runs lint,
typecheck, tests, and build."* Filed as `GAM-321`, with the caveat that this is
a three-run correlation and not an isolated experiment.

**The second-order lesson is better news: resuming is cheap.** Because the run
log made the state recoverable, the mid-chain-success bug cost ~$8.61 and 27
minutes instead of a whole run. Durability does not just prevent loss — it
changes the economics of every other failure mode.

## 9. Verify your instruments before you report a finding

Three times a "finding" was an artefact of the measurement:

* twice reported "nothing was pushed" because the check hardcoded a branch name
  the agent had not used — **enumerate with `git ls-remote --heads origin | grep
  -i <issue>` and take the newest, never a fixed name**;
* once "corrected" a finding count from 4 MINOR to 3 by counting `###` headings,
  when the fourth was graded inline. Two independent readers had it right.

Measurement errors look exactly like findings. Item 19c already prices this:
roughly half of a gate round's findings were the author's own unverified claims.

## 10. What worked, and should not be changed while fixing the rest

* **The claim protocol (item 28c).** Claimed in 72-90 seconds on every run,
  read back to confirm, never raced. It is the most reliable thing in the loop.
* **Refusing to self-certify.** The resume run re-dispatched a checker that had
  already run once, because the previous run died before recording its verdict:
  *"no agent may accept its own work."* It cost ~$9 it could have skipped.
* **Filing its own follow-ups.** The three MINOR findings became `GAM-318`,
  `GAM-319` and `GAM-320`, in house style, with priorities — item 20 satisfied
  without anyone asking.
* **Declining out-of-scope decisions.** It flagged the `responded_by`
  team-visibility question as a new row rather than deciding it.
* **Item 24 discipline.** Verification-log entry, `Closes GAM-304` as the PR's
  first body line, `Linear-Issue` trailer, and `In Review` never `Done`.

---

## Checklist for the next HEAVY row

1. **Before dispatching:** confirm the run log requirement is in the prompt, and
   that `--allowedTools` still grants a subagent tool.
2. **Expect ~$37-45 notional and 60-90 minutes** for a clean chain, plus ~$8.5
   per gate round. Two gate rounds is the cap (item 19a).
3. **Watch the branch, not the run.** `git fetch` the run log for live progress;
   the job log shows nothing useful.
4. **On completion, verify from the transcript** — init model, every `Agent`
   spawn and its `subagent_type`, the final result *text* — never from the
   conclusion badge.
5. **If it ends mid-chain, just re-dispatch.** The run log makes resumption
   cheap; do not restart the work.
6. **If it escalates, the ritual is:** remove `gate/human`, then move the issue
   to `Todo`. Nothing else will restart it.
7. **Do not name investigation branches after an issue** unless you intend the
   PR to be linked to it — see `GAM-315`, where six PRs ended up attached to one
   row and the automation behaved inconsistently as a result.

## Open rows this session produced

`GAM-312` ratification of two policies · `GAM-313` stale Claude entry point ·
`GAM-314` success reported mid-chain · `GAM-315` branch-link automation ·
`GAM-316` gate verdicts unrecorded · `GAM-317` escalation has no reply address ·
`GAM-318`/`GAM-319`/`GAM-320` the checker's MINORs · `GAM-321` orchestrator
runs the gates itself.

Ranked by what they cost if ignored: **GAM-317** (escalations stall silently
forever), **GAM-314** (green runs that delivered nothing), then the rest.
