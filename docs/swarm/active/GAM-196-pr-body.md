Closes GAM-196

**DRAFT — opened at minute ~3 of the run, before the work exists.** AGENTS.md
wall 3: the `ghs_` credential that opens a PR expires 3600s after job start
(this run: `iat 2026-08-20T02:57:39Z`, `exp 2026-08-20T03:57:39Z`, decoded from
the live token), and 21 of 21 PRs `claude[bot]` has ever opened inside a
dispatch run were opened at or before minute 53. This body is finalized before
the draft flag clears.

## What changed

_To be written._ At draft time the branch carries only
`docs/swarm/active/GAM-196-run-log.md`.

## Tier, stated and defended (item 26)

**HEAVY.** Item 26's deciding question — *"can a mistake here corrupt data, or
lie to a user about their own data?"* — is this row's literal subject: a
student's own confirmed volunteer-hours total rendering two different values on
two screens. Route (b) of the two fixes the issue names would put `/outreach` on
the attendance-backed `v_student_hours`, and **metric-view SQL is an explicit
HEAVY trigger** (item 26; PRD 8.4 under constitution item 3).

The losing argument was STANDARD: the surface is read-only display code in one
component, no write path, no RLS, no migration. It loses because the row's
load-bearing claim — divergence (4), that `computeStudentHours` counts
non-outreach events — was explicitly recorded as *inferred at the render layer,
not observed*, and a worker must not be the agent that confirms the premise it
is being paid to implement against. Item 26 also settles the tie directly:
*"If two tiers are arguable, take the heavier one."*

## Verification

_To be written — `gate-run` evidence block pasted verbatim._

## Scope (item 27)

_To be written._

## Follow-ups filed (item 20)

_To be written._

## Known gaps, disclosed

_To be written._

Linear-Issue: GAM-196 (T188)
