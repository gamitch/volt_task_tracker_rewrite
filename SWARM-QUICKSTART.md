# Swarm Quick-Start Guide

> **Currency, 2026-08-10.** The Agents, Model Selection, Automation caveat and
> Skills sections below were re-verified against `.claude/agents/` and
> `.claude/skills/` on this date. **Everything else predates the Linear
> migration** (constitution items 28-30, 2026-08-09) and still describes the
> frozen `task-ledger.md` world: work now comes from the `Todo` column of the
> `Gamitch` Linear team as `GAM-nnn`, not from `/swarm-run T001`.
> `docs/swarm/constitution.md` is binding wherever this file disagrees with it.

## What This Is

A Claude Code multi-agent project template. It sets up a boss/foreman/worker/checker hierarchy where:
- Workers implement tasks
- Checkers verify the actual artifact (not the worker's summary)
- The boss makes architectural decisions and resolves disputes
- The foreman manages compact task packets to control context size

## Setup

1. Copy the contents of this folder into your Claude Code project root.
2. Fill in `docs/swarm/project-brief.md` with your project description.
3. Open Claude Code in your project directory.

## Starting a New Project

Paste this as your first Claude Code prompt:

```
You are running a multi-agent hierarchy for this project.

Use this structure:
- boss-architect defines the constitution and makes final architectural decisions.
- foreman-planner converts the plan into small checkable task packets.
- worker agents implement individual tasks.
- checker agents verify the actual work and ignore worker self-reports.
- boss-arbiter resolves worker/checker disputes.

Important safeguards:
- Workers receive only compact task packets, not the full ledger.
- Workers may not edit .claude/ or docs/swarm/.
- Workers may not edit the constitution, task ledger, verification log, dispute log, agent prompts, skills, or hook settings.
- Checkers must inspect actual files, commands, or outputs.
- Checkers must classify findings as BLOCKER, MAJOR, MINOR, or NIT.
- After 3 failed attempts, escalate to boss-arbiter.
- Never loop indefinitely.

Project:
[PASTE YOUR PROJECT DESCRIPTION HERE]

First:
1. Read docs/swarm/project-brief.md.
2. Create/update docs/swarm/constitution.md.
3. Create docs/swarm/state-summary.md.
4. Create docs/swarm/task-ledger.md with every planned task having a worker, checker, acceptance criteria, allowed files, forbidden files, evidence requirement, and attempt count of 0.
5. Do not implement any code yet.
```

## Running Tasks

After planning is complete:

```
/swarm-run T001
```

Or let the foreman pick the next unblocked task:

```
/swarm-run
```

## Running a Final Check on a Milestone

```
/swarm-check
```

## Manually Invoking Agents

Level 1 (manual) — good for learning the pattern:

```
@boss-architect Create the constitution and task breakdown.
@foreman-planner Create task packets for T001.
@worker-implementer Complete T001 using only the worker packet.
@checker-tests Verify T001.
@checker-reviewer Review T001 against the constitution.
```

## Agents Reference

**`.claude/agents/*.md` frontmatter is the source of truth for this table.** If the
two disagree, the frontmatter wins and this table is the bug.

| Agent | Model | Role |
|---|---|---|
| boss-architect | fable | Defines constitution, makes architectural decisions, final acceptance |
| boss-arbiter | fable | Resolves worker/checker disputes |
| checker-premise | opus | Adversarially fact-checks a plan *before* workers run (constitution item 19) |
| checker-reviewer | opus | Reviews artifact against acceptance criteria and constitution |
| foreman-planner | sonnet | Creates task packets, tracks attempts, compresses state |
| worker-implementer | sonnet | Implements one task at a time, cannot self-certify |
| checker-accessibility | sonnet | Checks UI for a11y, contrast, focus, dark mode |
| checker-content | sonnet | Verifies quotes, facts, protected text, and source fidelity |
| checker-tests | haiku | Runs lint, typecheck, tests, and build |

## Model Selection — how it actually works

**Nobody chooses a model by hand.** The three mechanisms, in the order they apply:

1. **Frontmatter pins (above).** Spawning a subagent reads that agent's `model:`
   field and applies it. This is why model selection has always "just worked" in
   an interactive session — the pins do it, not the orchestrator's judgement.
2. **Item 18's per-dispatch override.** For a task that creates or edits a
   migration, an RLS policy or `security definer` helper, metric-view SQL, or
   auth/session/role logic, the orchestrator passes `model: "opus"` **as a
   parameter on the subagent call**. The constitution is explicit that this rides
   on the call, "not in the agent definition — there is one worker prompt, not
   two." No config file can express it, because the trigger depends on what the
   task turns out to touch.
3. **The orchestrator's own model.** Set by whoever launches the session. In the
   Linear dispatch path it is keyed to the issue's tier; see that workflow.

All three depend on one thing: **the orchestrator must actually be able to spawn
subagents.**

## Automation caveat — the dispatch path can silently lose all of this

**An `--allowedTools` allowlist REPLACES the default tool set; it does not add to
it.** The default includes the subagent tool. A hand-written list that forgets it
removes delegation entirely — and nothing reports this. No error, no warning. The
run starts, thinks, works, and produces a plausible result with one model playing
every role.

When that happens, three constitution items become unsatisfiable rather than
merely skipped: item 19 (no `checker-premise`, so no plan can be gated), item 26
(HEAVY is *packet + premise gate + worker + checker*), and item 18 (its override
rides on a dispatch call that never happens).

**How to tell it is happening**, since it does not announce itself:

- a HEAVY row completes with no premise-gate verdict recorded;
- the run log's init line names one model and no subagent ever appears;
- a row that should have delegated instead exhausts its turn budget.

Measured instance: GAM-304, 2026-08-10. Dispatched `tier/unreviewed`, self-judged
HEAVY on an RLS write path — item 18's exact override trigger — and ran the whole
thing on one `sonnet` primary with no ability to delegate any of it. It died at
turn 81 having spent $9.16 and produced no branch, no commit and no PR. The
workflow's own note 3 already warned about under-specified `claude_args`
producing "a run that starts, thinks, and accomplishes nothing"; the subagent
tool simply was not on the list of tools anyone thought to enumerate.

**This section is not a constitution item.** Authority Boundaries reserve those to
`boss-architect` / `boss-arbiter`. Ratifying it belongs to them; until then this
file is the record.

## Skills Reference

| Skill | When to use |
|---|---|
| /swarm-plan | At the start of any project to generate constitution + task ledger |
| /swarm-run | To execute one task (worker + checker loop with escalation) |
| /swarm-check | For milestone acceptance review |
| e2e-personas | Drive the app in a real browser as admin/coach/student/parent and read writes back |
| scratch-postgres | Stand up a throwaway PostgreSQL with this repo's migrations to prove an RLS/view claim |
| mutation-replay | Prove a test guards what it claims by making it go red |
| layout-measurement | Measure real layout in a real browser instead of reasoning about CSS |
| linear-task-writing | Write or rewrite any Linear issue an agent files (constitution item 30) |
| shared-doc-merge | Resolve conflicts in append-only shared docs under `docs/swarm/` |

The bottom six are the harnesses item 26 means by *"a gate that only reads is
worth much less than one that runs."*

## Severity Rules

| Level | Meaning | Task outcome |
|---|---|---|
| BLOCKER | Build failure, security, data, accessibility, or forbidden file edit | FAIL — must fix |
| MAJOR | Important functional or architectural issue | FAIL — unless boss approves deferral |
| MINOR | Non-blocking improvement | PASS — create follow-up task |
| NIT | Cosmetic preference | PASS — log only |

## Key Rules

- No task is complete because the worker says so — only a checker can pass it.
- Workers receive compact task packets, never the full ledger or log files.
- Workers cannot edit `.claude/`, `docs/swarm/`, or any workflow files.
  **⚠️ This line is broader than the constitution and the two disagree.**
  Authority Boundaries name seven specific paths — `constitution.md`,
  `task-ledger.md`, `verification-log.md`, `dispute-log.md`, `.claude/agents/`,
  `.claude/skills/`, `.claude/settings.json` — and do **not** list
  `.github/workflows/` or `docs/swarm/` as a whole. The constitution is binding
  (item 1's precedence), so treat this line as the stricter habit rather than
  the rule. Flagged rather than edited on purpose: narrowing a stated
  restriction is a `boss-architect` / `boss-arbiter` act, not a documentation
  fix, and the agent who noticed it was one that had just edited a workflow
  file.
- After 3 failed attempts, the foreman escalates to boss-arbiter.
- The foreman keeps `docs/swarm/state-summary.md` short and current.
- Archive large logs to `docs/swarm/archive/` to prevent token bloat.
