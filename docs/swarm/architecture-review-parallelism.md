# Architecture review: scaling parallel agents

Written 2026-07-29 for George, from evidence in this session. Every claim below is
tied to something that actually happened today, with the incident named, so the
proposals can be argued with rather than taken on faith.

**The headline:** today's ceiling was four concurrent agents. Almost none of that
limit is fundamental — it comes from four self-inflicted couplings and one real one.
Removing the self-inflicted ones plausibly gets to 10–15 without changing the
process's guarantees.

---

## 1. What actually blocked parallelism today

Ranked by how much throughput each cost.

### 1.1 Line-number citations create ordering dependencies between unrelated tasks

**This is the highest-leverage problem and it is entirely self-inflicted.**

T146 and T147 touch *different functions* in `loaders/outreach.ts` — `makeLoadOutreachDetail`
and `makeLoadOutreachData`. Their edits do not overlap by a single line. They still had
to be serialized, because T146's packet cites `outreach.ts:858-860` and `:873`, and
T147 inserts lines *above* those citations. Landing T147 first would shift them and
trip T146's own stop-and-report rule (item 19c).

So two genuinely independent tasks became a chain **purely because packets address
code by line number**.

This pattern recurred all session. Eight of my own errors were stale or wrong line
citations. T132's ledger row records citations "~101 lines stale because they were
copied from the PRD's own pre-T131 positions". Every merge invalidates every
in-flight packet's line numbers.

### 1.2 The orchestrator is a single serialization point — and the main error source

Every merge, verification, dispatch, and bookkeeping write goes through one agent
with one context window. Beyond throughput, the concentration produced the session's
worst defects:

| Error | Consequence |
|---|---|
| Grep count including comment lines (twice) | Two packets shipped inflated figures |
| Line citation asserted without opening the file (twice) | One reached source and had to be reverted by a second task |
| A measurement that could not detect its own bug | Would have shipped a broken mobile dashboard past a green check |
| An acceptance criterion that could not fail | Would have produced a green tautology |
| Misattributing a source edit to the wrong agent | Accused an innocent agent; corrupted a gate's in-flight measurement |

Handing packet authoring to `foreman-planner` measurably helped — its first packet
corrected my diagnosis in three places, including finding that `loaders/meetings.ts`
already fetched the data I had assumed was missing. **The role was too big for one
context, and splitting it improved quality, not just throughput.**

### 1.3 Shared-tree mutation contention

Premise gates run mutation experiments. Until item 23 landed this afternoon, they ran
them against the shared working tree. The consequences in a single afternoon:

- I found the tree dirty mid-experiment and reverted a gate's in-flight mutation,
  corrupting its measurement.
- I misattributed that change to `foreman-planner`, which was operating correctly.
- A stop hook fired on a legitimately-dirty file.

With three gates now running concurrently this would have been unworkable. Item 23
(mutations in the agent's own worktree) is what made today's four-way parallelism
safe at all — but it was written *after* the incident, and it is a convention, not a
mechanism.

### 1.4 Stale bases produce false findings

Every worktree drifts behind `origin`. Diffing against `origin` then shows the
integration branch's newer commits as *deletions*.

- T145's diff appeared to delete `dispute-log.md` — a checker specifically noted that
  a less careful reviewer would have failed the task on it.
- T143's diff appeared to be 18 files and 1,433 deletions; true scope was 6 files,
  +530/−9.
- T142's worker found its own packet missing and had to `git show` it by SHA.

Every one of those cost review time and none was a real defect. The mitigation
(merge up before review) is a manual instruction I have to remember to give.

### 1.5 Baselines drift under in-flight work

Packets pin exact figures — "0 errors, 354 warnings, 63 files, 1474 tests". Every
merge invalidates them. T142's packet cited 1474 after T143 merged, and its gate
flagged that a checker comparing against the stale number could raise a false
regression. With more parallel merges this gets worse quadratically.

### 1.6 Bookkeeping is a single mutable file

`task-ledger.md` is one 692-line table and is a Forbidden File for workers precisely
because concurrent edits would conflict. Consequence: **nine rows went missing**
(T142–T150), and item 20's "a deferral must file a task" obligation cannot be
satisfied by the worker that has the knowledge — it has to route through me.

---

## 2. What is genuinely serial and should stay that way

Not everything should be parallelized, and it is worth being explicit:

- **Merge + post-merge verification.** This is where correctness is established. One
  integrator, one queue.
- **Tasks with real semantic dependency.** T145 genuinely depended on T138's shared
  module existing. That is a true dependency, not an artifact.
- **The two-round gate cap (item 19a).** Its economics are measured: round 1 cost
  ~130K tokens and caught 4 BLOCKERs; round 2 ~105K and caught 2 MAJORs. Parallelism
  does not change that a third round is net negative.

---

## 3. Proposed changes, ranked by leverage

### 3.1 Address code by symbol, not by line number — **highest leverage**

Replace `outreach.ts:858-860` with `outreach.ts :: makeLoadOutreachDetail`. Packets
cite function names, exported symbols, or unique quoted strings. A worker locates by
search, not by offset.

Removes at a stroke: the T146/T147 ordering dependency, the entire class of stale-line
errors (eight of mine today), and most of the cost of merging under in-flight work.

Keep line numbers only as a *hint* alongside the symbol, explicitly marked as
non-authoritative.

### 3.2 Automated conflict detection before wave dispatch

Every packet already declares Allowed Files. Before dispatching a wave, compute the
pairwise intersection automatically and refuse to dispatch overlapping packets
concurrently. Today I did this by reading packets and reasoning — which works at four
agents and will not work at fifteen.

This turns "which tasks can run together" from judgement into a computed property.

### 3.3 Split the orchestrator role

Today's split (foreman owns authoring) should go further:

- **Foreman** — packet authoring, ledger writes, wave composition
- **Integrator** — merge queue, post-merge verification, worktree lifecycle
- **Orchestrator** — investigation, dispatch, human interface, arbitration

Each keeps a smaller context and a narrower failure surface. The integrator role in
particular is mechanical enough to be nearly rule-driven, and it owns exactly the
checks I did ad hoc today (verify HEAD moved, verify scope against merge base, verify
baselines).

### 3.4 One file per ledger entry

`docs/swarm/ledger/T147.md` instead of a row in a shared table. Removes the write
conflict, lets workers file their own item-20 deferrals directly, and makes the
history reviewable per task. Generate the summary table on demand.

### 3.5 Baselines by reference, not by value

Packets say "match the merge base" and the worker computes it, rather than pinning
"1474 tests". Kills an entire class of false regressions and lets packets survive
merges happening underneath them.

### 3.6 Automatic rebase-on-dispatch

Worktrees start from current `origin` automatically, not from whatever the base was
when the agent spawned. Removes §1.4 entirely.

---

## 4. What more parallelism will cost

Honest accounting, because this is not free:

- **Provenance gets harder.** My worst error today — accusing the wrong agent — was a
  direct consequence of four agents running with no way to attribute a change. At
  fifteen, "which agent touched this" must be *mechanically* answerable, not inferred.
  Per-agent worktrees (item 23) give this for free if enforced.
- **Merge conflicts become real.** Today: zero, because scopes were disjoint by
  construction. At higher concurrency, semantic conflicts (two tasks changing the same
  function's contract) will appear, and no file-level check catches those.
- **Gate cost scales linearly and is the dominant spend.** Two gate rounds cost ~235K
  tokens on one packet set. Fifteen parallel tasks means fifteen gates. §3.1 and §3.2
  reduce *how often* a gate finds a defect, which is the real saving.
- **The human review budget does not scale.** Today produced three constitution
  amendments, two dispute-log entries and four decisions needing George. At four times
  the throughput, that becomes the bottleneck. Worth deciding in advance which
  decisions can be defaulted.

---

## 5. Recommendation

If only one change is made: **§3.1, symbol-based citation.** It is the cheapest, it
removes the specific dependency that serialized T146 and T147, and it eliminates the
error class that produced eight of my mistakes in one session.

The next two, in order: **§3.2 automated conflict detection** (turns wave composition
from judgement into computation) and **§3.3 the integrator split** (removes the
merge bottleneck and the role concentration that caused the worst errors).

§3.4–3.6 are individually small and mostly mechanical. They matter more at fifteen
agents than at four.

**Not recommended:** relaxing the premise gate to buy throughput. It caught a BLOCKER,
two measurement designs that could not detect their own bugs, and an acceptance
criterion that was mathematically incapable of failing — all in one day, all mine. The
gate is what makes parallelism safe rather than merely fast.


---

## Appendix — measured facts about the isolation mechanisms (2026-07-30)

Added because the naming invites a wrong assumption, and this was tested rather than
reasoned about.

### `isolation: "remote"` is available, and does NOT isolate the filesystem

Probed with a read-only agent. It reported the **same hostname (`vm`), same path
(`/home/user/volt_task_tracker_rewrite`), same branch, and same commit** as the
dispatching session. Those four are consistent with either a shared tree or a separate
clone conventionally placed at the same path, so they do not discriminate.

The discriminator was `git worktree list`. This checkout carries a fingerprint nothing
else has — T144's deliberately-preserved unmerged worktree at
`.claude/worktrees/agent-a640406e50762373c`. **The remote agent sees it.** Same
filesystem, same working tree.

**Consequence:** a "remote" agent that writes files writes into the live checkout on the
live branch. For read-only work — auditing, measuring, probing — that is fine and it is
genuinely another machine's compute. For anything that edits, it is the opposite of
isolation and more hazardous than a local agent, because the name implies otherwise.

### What actually isolates

| Mechanism | Isolates filesystem? | Notes |
|---|---|---|
| `isolation: "worktree"` | **Yes** | Real separate path under `.claude/worktrees/agent-<id>`. Used by every worker and checker in this project. |
| Manual `git worktree add` | **Yes** | What a second *session* should use. Plain git, provable, no gating. |
| `isolation: "remote"` | **No** | Shares this tree, measured above. Read-only use only. |
| `create_trigger` with `create_new_session_on_fire` | Presumably | A genuinely fresh session per firing, but schedule-driven rather than on-demand. Untested. |

### For a second session working in parallel

Manual `git worktree add` off the working branch, on its own branch, is the correct
approach and needs nothing from the remote machinery.

**One guaranteed conflict to plan for.** `task-ledger.md` and `constitution.md` are both
**append-at-the-end** files. Two sessions each adding rows or items conflict at the same
line, every time — this is certain, not probable. Constitution numbering collides too
(items 20-24 were added in one day).

Cheapest mitigation, and it is §3.4 arriving early: the second session writes to
`docs/swarm/inbox/<branch>.md` and never touches either shared file. The integrating
session folds it in. That converts a guaranteed conflict into a clean file add.
