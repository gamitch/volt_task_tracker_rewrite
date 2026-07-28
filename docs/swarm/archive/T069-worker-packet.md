# Worker Packet: T069

## Task ID
T069 — Empty/error state copy audit (DES-12/15/16), Epic E11.

**Status note**: real ledger dependency is `T053–T060` — as of this packet being written, T060 is
still In Progress. Do NOT dispatch against this packet until the full range shows Passed. Pre-built
now per the swarm's "write ahead, dispatch when unblocked" practice.

## Objective
Verify every async list screen implements all four DES-12 states (loading/empty/error/populated),
and that empty/error copy matches DES-15/16's verbatim defaults where the PRD specifies exact text.
Audit task — produces no new page code.

## Allowed Files
None. This task's deliverable is its own structured audit report (see Required Worker Output),
returned in your response — not a file. If you find a real defect, do NOT fix it yourself; name it
precisely (file, exact copy found, exact copy expected) as a candidate follow-up task instead.

## Forbidden Files
Every file in the repository is read-only reference for this task — you are auditing, not editing.

## Known Context / Traps

**1. DES-12's exact four-state requirement, cited verbatim**: "Every async list screen has all
four states specified: loading (`Skeleton`), empty (`EmptyState` with one action), error
(`Banner status="error"` with retry), populated. Workers must implement all four; checkers verify."
Note the specific component-to-state mapping — a screen using the WRONG component for a state
(e.g. a `Spinner` where a `Skeleton` is specified, or an `EmptyState` with no action button) is a
real, citable finding, not just "does it have four visually-distinct states."

**2. This audit inherits real, ALREADY-DISCLOSED exceptions — don't flag them as fresh findings.**
At least two screens in this project have explicitly documented, checker-approved reasons for
having FEWER than four DES-12 states: `NoAccessPage.tsx` (T020, its own module doc explains why
Empty/Loading/Error are all N/A for that specific screen's structure) and `RosterShell.tsx`
(T021)'s dataless placeholder tabs (only "empty" is reachable, since no data source exists for
those sub-tabs yet). Read `verification-log.md` for the full list of any other such
already-approved exceptions before treating a missing state as a fresh violation — cite the
existing reasoning if you find it, don't re-litigate it from scratch.

**3. DES-15's literal verbatim empty-state examples — these are not paraphrase targets, they are
exact-text requirements where they apply:**
- Meetings, coach: *"No meetings scheduled. Set up your weekly build meetings once and check-in
  takes care of itself."* → `[Schedule meetings]`
- Outreach, student: *"No upcoming outreach yet. When your coach posts an event, you can sign up
  here."*
- Reports: *"No completed sessions this season yet. Stats appear after the first meeting or
  outreach day is marked complete."*

Grep the real page files (`MeetingsList.tsx`, `OutreachList.tsx`, `ParticipationTab.tsx`/
`HoursTab.tsx`/`EventsTab.tsx`) for their actual empty-state copy and diff it character-for-
character against these three examples. A screen that paraphrases instead of using the verbatim
text is a real, citable MINOR-or-higher finding — DES-15 says "use these verbatim as defaults," not
"convey the same idea."

**4. DES-16's requirement, cited verbatim**: "Errors say what happened and what to do... No
apologies, no 'Oops'." Grep every error/`Banner status="error"` copy string across the whole
codebase for "sorry"/"oops"/"something went wrong" (a common lazy-default error phrase that says
neither what happened nor what to do) — any hit is a real, citable finding.

**5. "Happy-path-only screens flagged MAJOR"** — the literal severity bar for a screen missing
error/empty handling ENTIRELY (not just imperfect copy, but no state modeling at all). This is a
structurally different, higher-severity finding than a copy mismatch — distinguish the two
categories clearly in your report.

**6. Reachability note** — same as the sibling T067/T068 audits: most screens aren't reachable via
a live route yet. Render each page component directly (reuse each screen's own established
`*.test.tsx` harness pattern) and force each of its four states via its injectable `loadData` seam
to actually see the rendered copy, rather than just reading the source strings — this catches
cases where the SOURCE has the right string but a conditional bug means it never actually renders
in the relevant state.

## Acceptance Criteria (of the audit itself)
- Full per-screen checklist of which DES-12 states are implemented, with already-approved
  exceptions correctly distinguished from fresh gaps.
- Character-for-character comparison of every DES-15-covered screen's actual empty-state copy
  against the three verbatim examples.
- A clean grep sweep for DES-16-violating apology language, with any hits cited exactly.
- Any happy-path-only screen (zero error/empty modeling) flagged at MAJOR severity, distinguished
  from lower-severity copy-wording findings.

## Relevant Constitution Excerpts
> DES-15: "use these verbatim as defaults" — a paraphrase is a real, citable finding, not
> equivalent compliance.

> DES-16: no apologies, no "Oops" — errors must say what happened and what to do.

## Most Recent Failure
None. This is attempt 1 for T069 (attempt count: 0) — not yet dispatched.

## Required Worker Output
- Full per-screen DES-12-state checklist, with already-approved exceptions cited by task ID.
- Character-for-character DES-15 verbatim-copy comparison table for every screen it applies to.
- DES-16 apology-language grep sweep results.
- Any happy-path-only screens named explicitly at MAJOR severity.
- Your rendering methodology (Trap #6) stated explicitly.
- Known risks; whether a dispute is needed (you flag, you don't resolve).
