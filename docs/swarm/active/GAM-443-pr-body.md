Closes GAM-443

**DRAFT — opened early on purpose.** The PR credential this run holds expires
at `2026-08-21T06:02:45Z` (decoded from the live `ghs_` JWT, `iat 05:02:45Z`,
3600s). AGENTS.md wall 3: every PR `claude[bot]` has ever opened inside a
dispatch run was opened at or before minute 53. This one opened at minute ~4,
carrying only the run log, and the work is pushed into it.

## What changed

Extracting the meeting date/time formatters duplicated between
`src/pages/meetings/MeetingsList.tsx` and `src/pages/calendar/CalendarPage.tsx`
into a single `src/lib/meetings/format.ts`, and adding `buildScheduleChips` for
the `meetings-redesign` wave. Sections below are filled in as the run proceeds.

## Tier, stated and defended

**HEAVY**, against the issue's own suggestion of STANDARD. The row arrived
`tier/unreviewed`, so the tier is this run's judgement to make and defend
(items 26 and 28d).

Trigger: item 26 lists *"an export another session builds against"* as a HEAVY
trigger, and that is this ticket's entire stated purpose — `format.ts` becomes
the import surface for five parallel `meetings-redesign` components, and
GAM-441's decomposition ticket freezes `buildScheduleChips`'s input shape into
`types.ts`. A wrong signature here is not one rework; it is every Wave-2
ticket's rework.

The losing argument, stated fairly: the code motion itself is behaviour-
preserving and low-risk, which is what makes STANDARD tempting and is what the
filer weighed. That argument covers the move and not the new export. Item 26's
tie-break ("if two tiers are arguable, take the heavier one") points the same
way.

## Verification

Pending — the `gate-run` evidence block and the mutations table are pasted
verbatim here before the draft flag clears.

Linear-Issue: GAM-443
