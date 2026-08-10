# PARKED — orchestrator consumption analysis, and the review of it

**Status: PARKED by the owner 2026-08-10. "I think I'll just leave things as is for now. File this
away and analyze it again later."**

**No row number is assigned deliberately.** Row numbers are namespaced per workflow
(`WORKFLOWS.md:322`) and this is cross-cutting. Taking "the next free number" is exactly the move
that produced the T196/T197 collision. **Whoever picks this up assigns a number from their own
block** — most likely W10's, since every row in it is a sweep.

**Nothing is blocked on this.** No open row cites it. Every run it examines produced correct work.
It is an efficiency question, not a correctness one, and it should not jump ahead of correctness or
process-failure rows.

---

## 1. The analysis, as received

*Recorded as written, so a later reader argues with the original rather than a paraphrase of it.*

**Claim:** the largest reducible share of a HEAVY row's consumption (~$37–45 notional) is not model
tiering, the turn cap or gate rounds — it is **the opus orchestrator personally running `npm ci`,
`tsc`, `vitest`, `eslint`, `git` and mutation replays**, while `checker-tests` sits pinned to haiku
with the charter *"runs lint, typecheck, tests, and build"* and is unused by the dispatch path.

**Measured, from the runs' own result objects:**

| Run | Turns | Wall | Bash | Notional | Shape |
|---|---:|---:|---:|---:|---|
| 31357084288 | 64 | 22 min | — | $8.52 | one gate subagent |
| 31385764526 | 54 | 59 min | **238** | **$28.58** | worker + orchestrator re-verification + checker |
| 31391626696 | 65 | 27 min | 91 | $8.61 | **resume, checker only** |

Two further GAM-304 runs are excluded on purpose — 31349834462 ($9.16) and 31358757094 (artifact
lost to the since-fixed cancellation bug) both delivered nothing, so including them would overstate
a steady-state HEAVY row. They are why GAM-304 totals ~$85 rather than ~$46.

**On the figures being notional:** the dispatch workflow authenticates with
`claude_code_oauth_token`, so runs draw on the owner's subscription and `ANTHROPIC_API_KEY` is
empty. `total_cost_usd` prices tokens at API list rates; no invoice follows. They are kept because
**subscription consumption is exposed as a number nowhere else**, and this one is proportional to
tokens weighted by model tier. What they measure is **capacity** — and capacity is what actually
runs out. This project has stalled on usage windows more than once.

**Second half of the claim — duplicated verification.** Item 26 gives STANDARD "orchestrator replays
the mutation, no separate checker" and gives HEAVY a separate checker instead. Run 31385764526 did
**both**: the orchestrator re-ran all six gates and replayed a mutation in its own worktree, then
dispatched `checker-reviewer` (opus) against the same diff. Two opus passes over one diff.

**Where it lives:** `.claude/agents/checker-tests.md` (frontmatter: `model: haiku`);
`docs/swarm/constitution.md:337-340` (STANDARD) and `:342-351` (HEAVY);
`.github/workflows/claude-linear-dispatch.yml:226-275` (the `--model` block).

**The constraint it sets for itself:** *"This must not reduce verification."* Two things must
survive any change — **item 21's existence check stays with the orchestrator** (*"'Clean' and
'committed' are different claims"*; T142 is the recorded case of it being assumed), and **the
orchestrator's independent replay is a control against a lying worker, not decoration.** Proposed
split: orchestrator verifies existence and boundary, `checker-tests` on haiku executes the gates,
`checker-reviewer` on opus does the judgement. Nobody stops running anything.

**Its own stated limit:** *"The causal claim is a correlation across three runs, not an experiment…
It has not been isolated — the expensive run also carried the largest context and two subagents.
Measure before assuming the saving is the full difference."*

---

## 2. Review — Opus 5 orchestrator, 2026-08-10

**Reviewer's standing: I am the thing being measured.** I am the opus orchestrator that ran those
Bash calls, so this is first-hand rather than inferred — and correspondingly not disinterested.

### What holds up

The measurement discipline is unusually good: figures quoted from result objects rather than
estimated, two runs excluded with the reason given, notional-vs-spend distinguished, and the causal
claim labelled as correlation by the author. The capacity framing is correct. The constraint it
protects — item 26's *"what is removed is coordination, not evidence"* — is the right one.

### Where the mechanism is probably wrong

**Bash calls are cheap in the way that matters.** The orchestrator pipes nearly everything through
`grep`/`tail`/`wc` precisely to keep output out of context — `npx vitest run 2>&1 | grep -E "Test
Files|Tests "` returns **two lines**. 238 such calls is on the order of 10–15k tokens, which is not
$20 of opus.

**The expensive operations are reading and authoring**, not executing. A HEAVY row involves reading
files in the thousands of lines (`OutreachList.tsx` is 4,164) and writing 200+ line packets, often
across two revisions. That is where the tokens are.

**So Bash count is plausibly a proxy for "how many phases ran", not a cause.** The expensive run had
worker + re-verification + checker; the cheap one had checker only. More phases means more Bash
*and* more reading *and* more subagent dispatches. The three cannot be separated in this sample, and
the author says so.

**Delegating gates to haiku may cost more than it saves.** Each subagent dispatch loads its own
context from cold — reads the packet, reads the files, reasons, reports back — routinely 100k+
tokens. Replacing a few thousand tokens of inline shell with a fresh context plus a round trip could
be net negative. Testable, but not obviously a win.

### The finding the analysis walked past

**Its own control run is the most interesting number in the table, and it draws the wrong lesson
from it.** Run 31391626696: **65 turns — more than the expensive run — and $8.61.** A *resume*.

The distinguishing variable is not shell work. **A resume starts warm.** It does not re-read the
constitution, re-derive ledger state, or re-establish what the file does. Every fresh subagent pays
that cost from zero — so a HEAVY row pays for **three cold contexts over the same code** (premise
gate, worker, checker), each re-reading the same files.

**That is the duplication worth attacking**, on this evidence, rather than the orchestrator's
`git log` calls.

### On the duplicated-verification half — keep both

The orchestrator's replay and the checker's review answer **different questions**: *"is the worker's
report true?"* versus *"is the work correct?"*. On T309 the worker reported 8 tests where the gate's
reference implementation had 9; that only surfaced because the orchestrator re-ran the mutations
itself. It is also the control against a worker quietly working around a criterion, which has
happened. The analysis nearly argues itself into this position already.

---

## 3. When this is picked up again — do this first

**Attribute the tokens before changing anything.** The runs expose per-turn input/output tokens.
Bucket them into: **file reads · packet authoring · subagent dispatch · shell output.** That
converts an n=3 correlation into an answer, and it is the prerequisite for every other decision
here.

Expect one of two outcomes:

- **Shell output is a large bucket** → the original proposal is right; move gate execution to
  `checker-tests` on haiku, keeping item 21's existence check and the orchestrator's own replay.
- **Subagent cold-start is the large bucket** (the reviewer's expectation) → the lever is reducing
  redundant cold context per row, not tier-shifting shell commands. Options worth costing then:
  passing the gate's findings forward so the worker does not re-derive them, narrowing what each
  subagent must read, or preferring resume over fresh dispatch where the work allows.

**One free fix regardless of the outcome:** the orchestrator polls CI check-runs in a loop while
waiting for a docs PR — a dozen tool calls on a single wait was observed on 2026-08-03. Trivial
individually, exactly the "every command looks trivial" pattern the analysis describes, and free to
remove.

**It stops being deferrable** when a usage window interrupts work mid-row — the failure this project
has already hit more than once, and the point at which an efficiency question becomes a scheduling
one.

---

## 4. RESOLVED 2026-08-10 — the run report was measured, and it answers §3's question

**The owner supplied the full Claude Code Report for run GAM-304 (20,890 lines). It carries per-call
token usage, which is exactly the attribution §3 asked for. It was measured rather than estimated,
and it settles the question.**

### The measurement

```
367 calls carrying usage data
input tokens   72,733,221
output tokens       3,035
ratio            ~24,000 : 1
average input   ~198,000 per call
```

**Context growth across the run:**

| Calls | Avg input tokens |
|---|---:|
| 1–20 | 48,050 |
| 21–100 | 121,793 |
| 101–250 | **290,773** |
| 251–367 | 157,375 *(after a compaction)* |

Peak single call **385,150**. **Calls 101–250 are ~40% of the calls and ~60% of the run's input
tokens.**

**Tool distribution:** 238 `Bash` · 56 `Read` · 42 `Edit` · 2 `Write` · 2 `Grep` · 2 `Agent` ·
2 `ToolSearch` = 344 tool calls.

### What it means

**Cost ≈ turns × context size.** Output is negligible (3k tokens across the entire run). Almost the
whole bill is re-sending accumulated context on every turn. Nothing about *which model runs a shell
command* moves that.

**The original proposal targets ~2%.** Moving the six gates to `checker-tests` on haiku removes on
the order of 6 turns from 367. Real, but not the lever.

**The 238 Bash calls were largely GOOD behavior, and the analysis read the signal backwards.**
**52 of them are `grep -n`** — the orchestrator grepping instead of reading whole files. Bash count
was high *because* context discipline was working. High Bash count is a symptom of token frugality
here, not of waste.

**The levers, in measured order:** (1) fewer turns, (2) flatter context growth. Batching chainable
commands into one call, and keeping large file content out of context, both attack the actual term.

### Determinism findings from the same report

1. **`sleep 60`** — one hardcoded wait. Nondeterministic by construction: too short proceeds on
   stale state, too long burns a usage window.
2. **32 `python3 <<EOF` file patches instead of `Edit`.** This run was disciplined (56 `assert`s),
   but that is convention, not enforcement. `Edit` fails loudly on a missing anchor; `str.replace()`
   **silently no-ops**, producing a green run that changed nothing. The single
   `String to replace not found` error in the report is `Edit` working correctly.
3. **Context reached 385k and compacted mid-run.** That is a **correctness** risk as much as a cost
   one — this project has repeatedly been bitten by facts going stale or being summarized away.

### Recommended, if this is ever unparked

**Write `gate-run`.** One invocation runs all six gates, asserts exit codes **directly rather than
through a pipe** (the run's own packet already requires this, so it codifies an existing rule), and
emits one fixed-shape evidence block. Collapses 10–15 turns into one and makes gate evidence
*comparable across runs* instead of ad-hoc per orchestrator. Deterministic where it matters most —
the evidence everyone quotes.

> **Built, 2026-08-10** — `.claude/skills/gate-run/`. Two corrections to the paragraph above,
> both measured while writing it. (1) The multi-agent chain is **not** where the turns go: the
> analysed run made **2** `Agent` dispatches against **342** inline orchestrator calls (238 Bash,
> 56 Read, 42 Edit), and 255 of those 344 sat *between* the worker and checker dispatches. Cutting
> phases would have removed 2 calls out of 344. The target is the orchestrator's own inline loop.
> (2) The turn saving comes from bundling a **script**, not from the prose — a pure-prose skill
> would leave six shell calls in place and add its body to context, a net loss. Payoff remains
> ~5% of a heavy run; the durable value is comparable evidence, not capacity.

**Write `wait-until`.** Bounded poll on a real condition with a timeout and an explicit failure.
Replaces `sleep N` and kills a whole nondeterminism class.

**Add a constitution item, not a skill:** *file patches use `Edit`; a scripted patch must assert its
anchor and fail loudly.*

**Do not build:** anything that moves gate execution to a cheaper tier. Measured at ~2%.

**Skills that already exist and cover their ground** (do not duplicate): `mutation-replay`,
`e2e-personas`, `scratch-postgres`, `layout-measurement`, `shared-doc-merge`, `linear-task-writing`.
