# Swarm Quick-Start Guide

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

| Agent | Model | Role |
|---|---|---|
| boss-architect | fable | Defines constitution, makes architectural decisions, final acceptance |
| foreman-planner | sonnet | Creates task packets, tracks attempts, compresses state |
| worker-implementer | sonnet | Implements one task at a time, cannot self-certify |
| checker-reviewer | opus | Reviews artifact against acceptance criteria and constitution |
| checker-tests | haiku | Runs lint, typecheck, tests, and build |
| checker-accessibility | sonnet | Checks UI for a11y, contrast, focus, dark mode |
| checker-content | sonnet | Verifies quotes, facts, protected text, and source fidelity |
| boss-arbiter | fable | Resolves worker/checker disputes |

## Skills Reference

| Skill | When to use |
|---|---|
| /swarm-plan | At the start of any project to generate constitution + task ledger |
| /swarm-run | To execute one task (worker + checker loop with escalation) |
| /swarm-check | For milestone acceptance review |

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
- After 3 failed attempts, the foreman escalates to boss-arbiter.
- The foreman keeps `docs/swarm/state-summary.md` short and current.
- Archive large logs to `docs/swarm/archive/` to prevent token bloat.
