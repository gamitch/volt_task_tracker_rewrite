# Checker Packet: T000 (EXAMPLE — DELETE BEFORE USE)

## Task ID
T000

## Objective
(Verify: one clear sentence about what was supposed to be produced.)

## Acceptance Criteria
- (Criterion 1)
- (Criterion 2)
- (Criterion 3)

## Files to Inspect
- src/
- components/
- app/
- tests/

## Forbidden Modification Check (run first)
Verify that the worker did not modify:
- docs/swarm/
- .claude/
- constitution.md
- task-ledger.md
- verification-log.md
- dispute-log.md
- agent prompts
- workflow skills
- settings files (unless authorized)

If any forbidden file was modified by a worker, return:
FAIL - BLOCKER - unauthorized modification.

## Relevant Constitution Excerpt
Workers may implement tasks, but they may not redefine success.

## Required Checker Output
- PASS or FAIL
- severity: BLOCKER, MAJOR, MINOR, or NIT
- evidence inspected
- commands run
- exact findings
- required rework if failed
- follow-up tasks if passed with minor issues
