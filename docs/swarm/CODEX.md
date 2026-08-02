# Using the existing swarm with Codex

Codex uses the existing constitution, ledger, packets, role prompts, and
verification history. The Claude configuration remains intact; this is an
adapter, not a replacement.

## Normal prompt

No slash command is required. A normal task prompt can be:

> Read `docs/swarm/RESUME-HERE.md` and `docs/swarm/constitution.md`, then tackle
> T321. Use Codex subagents if its process tier calls for them.

For a whole workflow:

> Read `docs/swarm/RESUME-HERE.md`, the constitution, and the W1 section of
> `docs/swarm/WORKFLOWS.md`. Start with the highest-priority unblocked W1 task
> and follow its assigned tier.

For read-only work:

> Read `docs/swarm/RESUME-HERE.md` and the constitution, then review T322's
> current premise and report what remains. Do not implement it.

For deliberate parallel work, say so explicitly and name compatible workflows:

> Use Codex subagents and isolated worktrees to tackle W1 and W4 in parallel.
> Follow the collision and ownership rules in `docs/swarm/WORKFLOWS.md`.

## What Codex translates

Codex does not directly register `.claude/agents`, execute `.claude/settings.json`
hooks, or recognize the Claude slash commands. The root `AGENTS.md` translates
those mechanics:

- the primary Codex agent acts as orchestrator/foreman/integrator;
- Claude role-prompt bodies are supplied to Codex subagents as compact task
  instructions;
- FAST, STANDARD, and HEAVY map to the same constitution item-26 process;
- explicit verification commands replace Claude hooks;
- manual Git worktrees provide isolation because Codex subagents otherwise
  share the filesystem.

Exact Claude model names are not carried over. Codex maps their capability
intent as follows (approved 2026-08-02):

| Swarm role                    | Current Codex model | Reasoning     |
| ----------------------------- | ------------------- | ------------- |
| FAST task                     | Primary agent       | Current level |
| STANDARD worker               | `gpt-5.6-terra`     | Medium-high   |
| HEAVY premise checker         | `gpt-5.6-sol`       | High-xhigh    |
| HEAVY item-18 worker          | `gpt-5.6-sol`       | High          |
| Other HEAVY worker            | `gpt-5.6-terra`     | High          |
| HEAVY acceptance checker      | `gpt-5.6-sol`       | High-xhigh    |
| Deterministic test checker    | `gpt-5.6-terra`     | Low-medium    |
| Accessibility/content checker | `gpt-5.6-terra`     | High          |
| Architect or arbiter          | `gpt-5.6-sol`       | Xhigh         |

`AGENTS.md` expresses these as Balanced and Frontier capability tiers. If the
available model names change, update this table and preserve the tier intent.
An explicit model override uses a compact/context-free subagent dispatch, not
a full-history fork.

## Operational limits

The number of simultaneous Codex agents is environment-dependent. Parallelize
only as far as available slots permit and only where the workflow ownership
table says files do not overlap. A serial premise → worker → checker chain is
often safer and cheaper than keeping every role live at once.

Codex will not push, open a PR, merge, deploy, or cross a human gate merely
because it was asked to implement a task. Name those external actions when you
want them included.
