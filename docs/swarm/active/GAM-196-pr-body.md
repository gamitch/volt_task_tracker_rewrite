Closes GAM-196

**DRAFT — opened early and deliberately.** The credential that can open a PR in a
dispatch run expires 3600 s after job start (AGENTS.md wall 3); this run's decodes
to `exp 2026-08-20T12:17:01Z`. The PR is opened while the branch carries only
records, and the work is pushed into it. Do not merge while the draft flag is set.

## The owner answered the product question, and that is why this row is workable

GAM-196 sat for 15 days as a decision, not a task. Two dispatch runs claimed it
and correctly refused: run 1's premise gate proved there was no machine-shippable
slice left, and run 2 refused at the claim because the row carried `gate/human`.

On **2026-08-20T11:16:18Z** the owner commented on the issue and chose **route
(a)**:

> We should use option A, if i understand i correctly. 1 set of hours for intent
> to attend (RSVP) and 2nd is the actual attendance hours `v_student_hours. is
> seems that way now, but if it's not that is how it should be.`

Fifteen seconds later, at `11:16:33Z`, the owner removed `gate/human`. At
`11:17:58Z` the owner added a second instruction — *"When executing, try to
dispatch as many agents in parallel to perform the work quickly, but with high
quality"* — and the row was re-dispatched.

**That sequence is the authorization this row was missing**, and it is recorded
here rather than paraphrased because the whole reason two runs refused is that
nobody had made the call.

## What route (a) means, in this repository's terms

`/outreach` keeps its RSVP-derived number and stops calling it *confirmed*. The
attendance-backed `v_student_hours` remains the one "actual hours" figure
everywhere else. Nothing about the arithmetic changes; what changes is that the
screen says which question each number answers.

## Status

Work in progress on this branch. This section is rewritten before the draft flag
is cleared.

## Tier and its defence (item 26)

Stated here so a wrong call is visible rather than silent — see the run log for
the full argument.

## Records

- `docs/swarm/active/GAM-196-run-log.md` — append-only, pushed at every milestone.
- `docs/swarm/active/GAM-196-packet.md` — run 1's HEAVY packet (superseded).
- `docs/swarm/active/GAM-196-premise-gate-round1.md` — run 1's gate report.
- `docs/swarm/active/GAM-196-pr-body-run2-closed.md` — the body of closed PR #210.

Linear-Issue: GAM-196 (T188)
