Closes GAM-438

## What changed

Restructures `CoachHome.tsx` (and `KpiStrip.tsx`'s goal card) from the current
hairline-bordered, plain-list layout to the production tracker's layout:
eyebrow + large title + action row header, gradient/accent-bordered KPI cards,
a regrouped primary KPI section (full-width "hours vs. goal" panel plus an
eight-tile secondary row), and panel-wrapped, individually-bordered
Next-up/activity rows. Presentation only — no schema, loader, or metric
arithmetic changes. *(Filled in further as work lands.)*

## Tier, stated and defended

**STANDARD**, per constitution item 26 and the issue's own tiering: no write
path, no schema/RLS/migration/auth change, presentation-only restructure of
two files. The issue itself argues file/line count is not a tier trigger, and
that argument holds — nothing here creates or mutates data. Dispatched as one
worker packet; orchestrator independently inspects the diff and replays the
BEH-01 milestone-tick and admin-gate criteria rather than trusting the
worker's summary.

## Verification

*(Pending — gate-run evidence block and mutation table land before this PR
leaves draft.)*

## Scope: what this does and does not close

*(Pending.)*

## Known gaps, disclosed

*(Pending.)*

Linear-Issue: GAM-438
