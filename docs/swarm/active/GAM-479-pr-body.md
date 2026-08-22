Closes GAM-479

**DRAFT — opened at minute ~5 under `AGENTS.md` wall 3 (the PR credential dies
at 04:02:18Z). Body is provisional and will be finalized before the draft flag
is cleared.**

## What changed

Not yet — the branch currently carries only `docs/swarm/active/GAM-479-run-log.md`.
This PR exists early so the work has somewhere to land if the run is killed.

## Tier, stated and defended

**HEAVY.** Item 26's trigger is "a write path or destructive operation", and the
subject of this issue is precisely that: the attendance cycle's fifth stop
issues a row `DELETE` that discards `check_in_at`, `check_out_at`,
`hours_override`, `method` and `recorded_by`. A mistake here corrupts data a
coach cannot recover. Any fix that preserves the row rather than deleting it
plausibly needs a schema change, which is a second HEAVY trigger and an item 18
`model: "opus"` worker trigger.

Linear-Issue: GAM-479
