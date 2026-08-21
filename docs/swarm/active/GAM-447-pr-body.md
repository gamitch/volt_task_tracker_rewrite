Closes GAM-447

**DRAFT — opened at minute ~5 of the run, per `AGENTS.md` wall 3.** The body
below is finalized before the draft flag is cleared; if this PR is still a draft
and the run log's last line is a dispatch with no verdict, the run died and this
branch is the salvage.

## What changed

Builds the coach view's fixed-size `SeriesCard` (plus its inline
`SeriesEditPanel`, CSS and tests) under `src/pages/meetings/coach/`, against the
frozen props from the decomposition ticket and the formatters in
`src/lib/meetings/format.ts`. Fixture-driven; real data arrives via the
integration ticket.

## Tier, stated and defended

**STANDARD** (item 26). No write path — the Edit action calls the *existing*
`onSaveMeetingSeries` seam rather than implementing one; no schema, RLS,
migration or metric SQL; no auth or role logic; no export another session builds
against (the props interface is frozen *by* the decomposition ticket, so this
component consumes it). Too large for FAST — a new component, an edit panel, CSS
and tests are well over FAST's ~20 production lines. The arguable heavier read
is "a sibling ticket builds against this file"; it loses because the shared
contract lives in the frozen types, not in this component.

## Verification

_To be filled from the `gate-run` evidence block before the draft flag clears._

## Scope (item 27)

_To be stated before the draft flag clears._

## Follow-ups filed (item 20)

_To be stated before the draft flag clears._

Linear-Issue: GAM-447
