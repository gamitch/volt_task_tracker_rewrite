Closes GAM-450

> **DRAFT — opened at minute ~4 of the run credential's 60-minute life**
> (`AGENTS.md` wall 3). Sections below are filled in as evidence lands. Do not
> merge while this notice is present.

## What changed

Adds `src/lib/meetings/overlap.ts` — one pure, synchronous function that takes
every session across all loaded series and returns a map from session id to the
refs of the sessions it genuinely clashes with. Three sibling tickets
(SeriesCard, SchedulePanel, MeetingsRail) badge from this single answer instead
of each computing their own.

## Tier, stated and defended

**STANDARD.** The row arrived `tier/unreviewed`; I tiered it as part of claiming
(item 28d), and that judgement is reviewable.

- **The issue proposes FAST. I overrode it upward.** FAST's ceiling is roughly
  20 lines of production change and it exists for "a few line bug fix". An
  index builder carrying day-bucketing, cross-series filtering and cancellation
  semantics exceeds that, and it ships a *new exported module three parallel
  sibling tickets code against* — which is item 26's own HEAVY trigger wording,
  "an export another session builds against".
- **HEAVY was the losing argument, and it lost on measurement, not on feel.**
  No write path, no destructive operation, no RLS/auth/role logic, no
  migration, no metric-view SQL. The export trigger is defused because the
  `OverlapIndex` contract is frozen elsewhere — this module implements a shape
  it does not author. Had that contract been absent from the repo, the trigger
  would have fired and this would have gone HEAVY; that was the premise gate's
  first question.
- Item 19 binds at every tier, so the packet went through `checker-premise`
  before any worker saw it, scoped light per item 19b.

## Verification

_Pending — gate block and mutation table pasted verbatim before the draft flag
clears._

## Scope: what this does and does not close

This ships an internal seam with no user-visible surface: nothing renders from
it in this PR. Item 27's fixture test does not apply — the three badge surfaces
that will consume it are sibling tickets, and their own rows carry the
obligation to read real data.

Linear-Issue: GAM-450
