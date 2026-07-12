# Project Constitution

## Mission
<!-- Copy from project-brief.md — one clear statement of what this project is for. -->

## Non-Negotiables

- The app must build successfully.
- Existing tests must pass unless the boss explicitly approves a test update.
- No worker may mark its own work complete.
- Every task must be checked by a separate checker agent.
- Every checker must inspect the actual artifact, not just the worker's summary.
- Protected source text must remain verbatim unless explicitly approved.
- Accessibility, security, data integrity, and usability outrank cosmetic preferences.
- No agent is above verification, including the boss.

## Authority Boundaries

Workers may implement tasks, but they may not redefine success.

Only the following agents may modify this constitution:
- boss-architect
- boss-arbiter

Workers may not edit:
- docs/swarm/constitution.md
- docs/swarm/task-ledger.md
- docs/swarm/verification-log.md
- docs/swarm/dispute-log.md
- .claude/agents/
- .claude/skills/
- .claude/settings.json

If a worker believes the standard is wrong, impossible, contradictory, or harmful, the worker must file a dispute instead of modifying the standard.

## Project-Specific Standards
<!-- Add your project's own quality standards here. Examples:
- The UI must be understandable to non-technical users without training.
- All status transitions must be validated by a state machine.
- No hardcoded credentials or secrets.
-->

## Definition of Done

A task is done only when:

1. The worker produces the requested change.
2. The checker validates the actual artifact.
3. The checker records evidence.
4. The foreman updates the task ledger.
5. The boss or foreman accepts the checked result.

## Evidence Requirements

Each checker response must include:

- files inspected
- commands run
- relevant output
- pass/fail result
- exact failure reason, if any
- severity classification
- recommended next action

## Failure Severity

BLOCKER:
Cannot ship. Violates a core requirement, breaks the build, corrupts data, breaks security, breaks accessibility, or modifies forbidden files.

MAJOR:
Should not ship without boss approval. Important functional, architectural, UX, or correctness issue.

MINOR:
Acceptable for the current task but should become a follow-up task.

NIT:
Cosmetic or preference-level issue. Does not block completion.

Decision rules:
- BLOCKER fails the task.
- MAJOR fails the task unless the boss explicitly approves deferral.
- MINOR passes with a follow-up task.
- NIT passes and is logged only.

## Dispute Rule

If a worker believes the checker is wrong, the worker may file a dispute.

The boss-arbiter decides whether:
- the worker must redo the task,
- the checker was wrong,
- the spec was ambiguous,
- the constitution must be clarified,
- or the human owner must decide.

## Loop Limit

A worker/checker loop may run at most 3 failed attempts.

After the third failure, the task must be escalated to boss-arbiter.
