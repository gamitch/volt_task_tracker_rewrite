Closes GAM-456

## What changed

**Draft, opened early per constitution wall 3 (PR credential ~60 min
lifetime) — no source change yet, only the run log and worker packet.**
This body will be updated as the worker's diff lands. Intent: wrap the three
bare `CoachHome.tsx` sections (Hours by team, Goal projection, Top events)
in the existing `Card` primitive to match the three already-panelled
sections (Next up, Activity feed, Leaderboard), and restore the page
header's H1 to 46px/800 with an accent-orange, uppercase, 800-weight
eyebrow, matching the design GAM-438 partially implemented.

## What the issue got wrong

Nothing found yet — pending the worker's implementation pass and this run's
own re-verification of the packet's premises.

## Tier, stated and defended

**STANDARD.** Per constitution item 26: presentation-only change to one page
component, reusing existing `Card`/`style`-prop patterns this same file
already ships three times over. No write path, no schema/RLS/migration, no
auth/role logic, no signature another module imports. The issue's own "Size
and tier" section independently reaches STANDARD for the same reason.

Premise gate (item 19) was **skipped**, per item 19b: this rolls out an
already-verified pattern (`Card`-wrapping a bare section, present 3x already
in this exact file) to three more instances, plus a scoped `style`-prop
override that is this file's own established mechanism
(`KPI_TILE_GRADIENT_STYLE`/`KPI_GOAL_ACCENT_STYLE`) for a value with no
matching theme token. No novel pattern, no migration/RLS/metric-SQL risk.
Reasoning recorded in full in `docs/swarm/active/GAM-456-run-log.md`.

## Verification

Pending — worker dispatch not yet run. Will be pasted verbatim (six-gate
`gate-run` evidence block plus the mutation-replay table) before this draft
is marked ready for review.

## Scope: what this does and does not close

This closes the structural-panelling and header-sizing delta only. The
issue's own "smaller divergences, same capture" list (stat-tile label size,
goal-panel right-aligned layout, milestone pills, next-up sub-line,
activity-row status dot, Hours-by-team/Leaderboard side-by-side pairing) is
explicitly out of scope for this row unless the worker packet finds one
trivially bundled in — see the claim comment on GAM-456 for the same
boundary stated up front.

## Follow-ups filed

None yet. GAM-439 (inline season-goal editor) already exists and is not
this row's concern.

## Known gaps, disclosed

Pending worker output.

Linear-Issue: GAM-456
