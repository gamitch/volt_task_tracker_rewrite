Closes GAM-446

**DRAFT — opened at minute ~7 of the run under `AGENTS.md` wall 3, before the
work exists.** The `ghs_` credential that opens a PR in a dispatched run was
decoded at job start: `iat 2026-08-21T22:40:39Z`, `exp 2026-08-21T23:40:39Z`.
This body is finalized, and the draft flag cleared, only after the gates run.

## What changed

Read-side only. Extends `makeLoadCoachMeetingsData` to also read per-event
attendance from `v_event_attendance` and per-series roster counts, and adds
`listGuardianChildren(viewer)` beside `resolveCurrentStudentId` so a parent
with more than one linked child can switch between them.

## Tier, stated and defended

**HEAVY**, overriding the issue's own "STANDARD".

The issue arrived `tier/unreviewed`, so tiering it was part of claiming
(item 28d) rather than a later step. Item 26's deciding question is *can a
mistake here corrupt data, or lie to a user about their own data?* — and a
wrong join against `v_event_attendance` shows a student a false attendance
percentage, which is exactly that. Independently, item 26 lists **"an export
another session builds against"** as a HEAVY trigger, and this ticket's row
model is the frozen contract the parallel Wave-2 UI tickets and the integration
ticket code against; the issue says so itself.

The losing argument is the issue's own: one loader module plus one lib module
plus tests is a STANDARD-sized change, and nothing here writes. That is true
about *size* and item 26 says explicitly that tier does not follow ticket size.
It also says that when two tiers are arguable, take the heavier one.

FAST was never available: the change alters a signature other modules import
and is well over ~20 lines.

## Verification

Pending — the `gate-run` evidence block and the mutation table are pasted here
verbatim before the draft flag is cleared.

Linear-Issue: GAM-446
