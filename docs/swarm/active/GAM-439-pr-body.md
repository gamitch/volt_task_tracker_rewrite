Closes GAM-439

**DRAFT — work in progress.** This body is opened early and deliberately: the
`ghs_` PR credential this run holds expires at `2026-08-21T06:00:41Z`, 60
minutes after job start (AGENTS.md wall 3). The body is finalized before the
draft flag is cleared.

## What changed

_To be written when the worker's diff lands._

## Tier, stated and defended

**HEAVY** (item 26). Trigger: **write path**. The change puts an editable
control on the coach dashboard that writes the `seasons` row — the row every
hours-vs-goal figure in the app divides by. `updateSeason` is a full-row
`.update({ name, starts_on, ends_on, default_goal_hours })`, so a stale copy of
the season silently reverts the name and the dates. The losing argument was
STANDARD on size ("one input, one existing loader"): item 26 says explicitly
that tier follows risk, not the size of the control, and this is the T305 shape
— a small-looking write whose payload corrupts a column nobody was editing.

## Verification

_gate-run block to be pasted verbatim._

## Linear-Issue: GAM-439

Linear-Issue: GAM-439
