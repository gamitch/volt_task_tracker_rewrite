Closes GAM-452

**DRAFT — opened at minute ~4 of the run under AGENTS.md wall 3.** The PR
credential this run holds expires `2026-08-23T02:21:09Z` (decoded from the live
JWT, not guessed), so the PR is opened before the work exists and pushed into.
This body is rewritten in full before the draft flag is cleared.

## What changed

_Pending._ Composes the redesigned `/meetings` page from the seven merged
component tickets (GAM-445…GAM-451), wires the real loaders, deletes the
superseded coach table view, and ships the responsive + UXC-13 evidence.

## Tier, stated and defended

**HEAVY**, judged at claim time under item 28d. The composed page wires the
SchedulePanel's in-place attendance editing and the schedule/cancel mutation
seams — a write path — and renders attendance percentages, so an error here can
corrupt data *and* lie to a user about their own attendance. It also deletes a
shipped surface. Two of item 26's HEAVY triggers fire independently. The losing
argument was STANDARD-on-the-grounds-that-it-is-only-composition: rejected,
because "only composition" is exactly the claim item 27 exists to disbelieve.

## Verification

_Pending — the six-gate `gate-run` block goes here verbatim._

## Scope

_Pending._

Linear-Issue: GAM-452
