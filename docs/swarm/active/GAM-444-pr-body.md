Closes GAM-444

**DRAFT — opened at minute ~4 of the run, before the work exists.** `AGENTS.md`
wall 3: the `ghs_` credential that opens a PR expires 3600s after job start
(`exp 2026-08-21T20:17:16Z`, decoded from the live token). Every PR
`claude[bot]` has ever opened in a dispatch run went up at or before minute 53.
This body is finalized and the draft flag cleared before the run ends; the
sections below fill in as the work lands.

## What changed

A mechanical, behavior-preserving split of `src/pages/meetings/MeetingsList.tsx`
(2997 lines) into a thin shell plus `coach/`, `student/` and `src/lib/meetings/`
modules, and the addition of the frozen type contracts the five parallel Wave-2
meetings-redesign tickets code against. No features, no rendering changes.

## What the issue got wrong

_Pending the premise gate._

## Tier, stated and defended

**HEAVY** (packet + `checker-premise` + worker + `checker-reviewer`), judged
before the `In Progress` move per item 28d.

The trigger is item 26's **"an export another session builds against"**. This
ticket's whole purpose is to freeze contracts — `SeriesCardModel`,
`MeetingsFocusRequest`, `OverlapIndex`, and eight stub props interfaces — that
five separate tickets will build on in parallel. A wrong contract here is not a
local defect that its own PR catches; it is a wrong foundation under five
tickets, and correcting it costs all five.

Secondary trigger: the student view being moved renders participation %, so a
mis-wired builder lies to a student about their own attendance — item 26's other
named question.

The losing argument was STANDARD, on the grounds that "git mv + re-point
imports" is mechanical and the 121-test suite is a machine check on
behavior-preservation. That argument is real but incomplete: the test suite
constrains the *moved* code and says nothing at all about the *new* type
contracts, which are the part five other tickets depend on and the part no
existing test can see.

## Verification

_Pending — `gate-run` evidence block pasted verbatim, plus the mutation table._

## Scope

_Pending._

## Follow-ups filed

_Pending._

## Known gaps, disclosed

_Pending._

Linear-Issue: GAM-444
