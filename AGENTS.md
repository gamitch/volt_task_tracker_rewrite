# Codex instructions for the VOLT portal

This repository has an established swarm process under `.claude/` and
`docs/swarm/`. Codex uses the same process and project records. Do not create a
second ledger, constitution, severity scale, or set of role definitions.

## Where work comes from

**The live queue is the `Todo` column of the `Gamitch` Linear team, not the
ledger.** `docs/swarm/task-ledger.md` is **FROZEN** (item 29) — read it for the
provenance of anything filed before 2026-08-09, but never add a row or edit a
Status there. New work is `GAM-nnn` and carries no `Tnnn`; the number blocks are
retired because Linear allocates atomically.

Offline or without Linear access, read `docs/swarm/linear-export.md` — a
generated mirror, never hand-edited, refreshed by `scripts/linear-export.mjs`.

Constitution **item 28** is binding and its order matters:

1. Take only from `Todo`. `Backlog` means filed, not dispatchable.
2. Ours are the issues carrying a `tier/*` label. Linear's own onboarding
   issues sit in `Todo` too and carry no labels. Migrated rows also begin
   `Tnnn — `, but a finding filed by a skill has no `Tnnn` and is still ours.
3. **Claim first.** Move the issue `Todo → In Progress` before opening a single
   file, then re-read it to confirm you hold it. Linear has no compare-and-set,
   so without that read-back two agents can both claim the same row.
4. A `tier/unreviewed` row may **not** enter `In Progress` until you have tiered
   it (item 26). Judging the tier is part of claiming, not of finishing.
5. On completion move it to `In Review` and add the trailer
   `Linear-Issue: GAM-nnn (Tnnn)`.

Labels carry what custom fields used to: `tier/*` (item 26 process tier),
`area/w1`…`w10` (workflow surface), `gate/human` (no machine may close it),
`gate/unverified` (premise measured as false or partial — re-measure first).

## Natural-language entry point

The owner normally starts work by saying some variation of:

> Read `docs/swarm/RESUME-HERE.md` and `docs/swarm/constitution.md`, then tackle
> Txxx (or workflow Wx).

That is the normal Codex swarm entry point. The owner does not need to invoke
`/swarm-plan`, `/swarm-run`, or `/swarm-check`.

When the owner asks only for a review, explanation, or status report, remain
read-only. When the owner asks to tackle, implement, fix, or complete a task,
follow the execution rules below. Do not begin implementation merely because
the owner asked you to read the state documents.

## Orientation order

Before planning or changing a task:

1. Inspect `git status` and preserve every pre-existing change. Never use
   `git stash` in this repository.
2. Read `docs/swarm/RESUME-HERE.md` from the top. Its newest UPDATE sections
   supersede older material lower in the file.
3. Read `docs/swarm/constitution.md` completely. Item 26 selects FAST,
   STANDARD, or HEAVY process; items 20-24 govern deferrals, commits, staging,
   worktrees, and integration records.
4. Claim the Linear issue before anything else (item 28), then locate the same
   row in `docs/swarm/task-ledger.md` for its provenance. Read the relevant
   section of `docs/swarm/WORKFLOWS.md` and any referenced audit ruling, active
   packet, PRD section, or dispute ruling.
5. Re-check every operative claim and citation against the current repository.
   A packet's recorded SHA and line numbers are historical evidence, not proof
   of current state.

Do not read `verification-log.md`, `dispute-log.md`, or the full ledger from
start to finish for orientation. Search for the relevant task ID or ruling.
`state-summary.md` and older status snapshots are known to be stale; use them
only when a current document points to a specific entry.

## Codex role mapping

The primary Codex agent is the orchestrator, foreman, and integrator. The role
bodies in `.claude/agents/*.md` are portable instructions; their YAML `model`
and `tools` fields are Claude-specific and must be ignored.

- Premise checker: `.claude/agents/checker-premise.md`
- Worker: `.claude/agents/worker-implementer.md`
- Code/acceptance checker: `.claude/agents/checker-reviewer.md`
- Deterministic test checker: `.claude/agents/checker-tests.md`
- Accessibility checker: `.claude/agents/checker-accessibility.md`
- Content checker: `.claude/agents/checker-content.md`
- Architecture and arbitration: `.claude/agents/boss-architect.md` and
  `.claude/agents/boss-arbiter.md`

For a subagent, provide only its role body, the compact task/checker packet,
the relevant constitution excerpt, the exact repository or worktree path, and
the latest failure if any. Prefer a context-free or minimally forked subagent;
do not expose the full ledger or logs to a worker.

## Model selection

Treat the Claude model names in role frontmatter as legacy capability signals,
not literal dispatch values. Codex uses two capability tiers:

- Balanced: `gpt-5.6-terra`, for bounded implementation and deterministic or
  domain-focused checking.
- Frontier: `gpt-5.6-sol`, for adversarial premise review, high-risk code,
  architecture, and arbitration.

Use this mapping unless the currently available Codex models change:

- FAST task: primary agent directly; no subagent model selection.
- STANDARD worker: Balanced at medium or high reasoning.
- HEAVY premise checker: Frontier at high or xhigh reasoning.
- HEAVY worker matching constitution item 18 (migrations, RLS or security
  definers, metric-view SQL, auth/session/permission logic): Frontier at high
  reasoning.
- Other HEAVY worker: Balanced at high reasoning, followed by Frontier review.
- HEAVY code/acceptance checker: Frontier at high or xhigh reasoning.
- Test checker: Balanced at low or medium reasoning.
- Accessibility or content checker: Balanced at high reasoning.
- Boss architect or arbiter: Frontier at xhigh reasoning.

Model strength follows the constitution's concrete risk triggers, not ticket
size or a topic merely sounding important. If a named model is unavailable,
select the closest available model at the same capability tier and record the
substitution in the task evidence.

When an explicit subagent model or reasoning override is needed, use a
context-free or minimally forked dispatch rather than a full-history fork.
Supply all required context in the compact packet. This both preserves worker
context isolation and permits an explicit runtime model choice.

## When Codex should delegate

Codex is authorized to use its subagents for implementation tasks in this
repository without asking for a second confirmation, subject to the user's
requested scope and the available concurrency limit.

- FAST: the primary agent implements and verifies directly. Do not manufacture
  agent ceremony that item 26 explicitly removed.
- STANDARD: dispatch one worker subagent with a compact packet. The primary
  agent independently inspects the diff and replays the named mutation and
  verification. A separate checker is optional unless the task or evidence
  makes one useful.
- HEAVY: use a premise-checker subagent before dispatch, a separate worker, and
  a separate checker. The primary agent integrates only independently verified
  work. Respect the two-round premise-gate cap and three-attempt worker cap.

Parallelize only independent work. `docs/swarm/WORKFLOWS.md` owns the file
collision analysis. Never run two editing agents against the same working tree
or against overlapping files. Leave capacity for the primary orchestrator;
available Codex agent slots may be fewer than the workflow document assumes.

## Worktrees and mutation tests

Codex subagents share the repository filesystem by default; spawning an agent
does not create isolation. Before any parallel edit or mutation experiment,
the orchestrator must create a dedicated Git worktree and branch and give the
agent that exact path. Use the `codex/` branch prefix. A subagent must run every
command with its assigned worktree as the working directory.

Read-only audits may inspect the live shared tree. Never run a mutation in the
owner's shared tree. Commit the candidate fix before a mutation, mutate only in
the isolated worktree, capture the red result and exit code, restore the
mutation, and re-run the green check.

Before treating subagent work as existing, verify its worktree status, HEAD
SHA, changed paths, and committed blob. A clean worktree is not proof that the
work was committed. Do not remove a worktree until this verification is done.

## Ownership and protected files

Workers may edit only packet Allowed Files. Workers and checkers must not edit
`.claude/**`, `docs/swarm/**`, this `AGENTS.md`, workflow files, or project
governance records. The primary orchestrator owns those records.

Stage explicit paths only. Never use `git add .` or `git add -A`. Never revert,
delete, overwrite, or stage a pre-existing user change. In particular, an
untracked file is not disposable just because it is unrelated to the task.

Do not push, open a pull request, merge, deploy, send email, or cross a human
gate unless the owner explicitly authorizes that external action. If work is
implemented but integration is not authorized, do not mark the ledger row
Passed. Item 24's ledger and verification updates happen with integration, not
as an optimistic pre-commit claim.

## Verification and close-out

Use the packet's exact evidence requirements. At minimum, select from the
repository's real commands and report exit codes:

- targeted Vitest tests for changed behavior
- `npm run typecheck`
- `npm run test`
- `npm run build`
- `npm run lint`
- `npm run format:check`

Do not infer success from a pass count if the process exited nonzero. Check the
actual diff and forbidden-file boundary before accepting work. A worker cannot
self-certify.

Every deliberate deferral becomes a ledger follow-up under constitution item
20; a code comment alone is not triage. At integration, update the task-ledger
row and verification-log entry in the same commit as the source change, as
required by item 24. Preserve the workflow's reserved task-number block.

Any Linear issue you write — a new filing, an item 20 deferral, a finding a
skill produced — follows `.claude/skills/linear-task-writing` under item 30.
Invoke the skill rather than reproducing its structure from memory. Lead with
the defect and not the provenance, state a priority and defend it, verify every
line number against current `main` before writing, and keep the original text in
a `<details>` block when rewriting. `GAM-303` is the reference rewrite.

Under item 27, a task shipping a user-visible surface that still reads from a
fixture, stub, or hardcoded value closes as `Partial`, not `Passed`, with the
wiring task's id on the row. Follow the data to its real source before
accepting the work — a green criterion measured against a stub was measured
against the stub. Internal seams and work with no user-visible surface are
unaffected, and a loading, empty, or error state backed by the real loader
satisfies the check.

Under item 19d, a HEAVY packet ends with a numbered **Least confident
decisions** list — three to five entries, each naming a decision and what
would make it wrong. The premise checker attacks that list first. Declaring a
doubt is not held against the author; concealing one costs a gate round.
