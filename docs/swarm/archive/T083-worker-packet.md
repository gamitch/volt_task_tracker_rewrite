# Worker Packet: T083

## Task ID
T083 — DES-15 verbatim empty-state copy fix, 5 screens (MINOR follow-up from T069), Epic E11.

## Objective
T069's copy audit (Passed) found all 5 DES-15-named screens paraphrase their empty-state copy
instead of using the PRD's literal verbatim text. DES-15 says "use these verbatim as defaults" — a
paraphrase is a real, citable finding, not equivalent compliance. Fix the two clean cases exactly;
use judgment on the three Reports-tab cases, which don't all share identical semantics with the
PRD's one "Reports" example (see Trap #2 — this is not a blind copy-paste task for those three).

## Allowed Files
- `src/pages/meetings/MeetingsList.tsx`, `MeetingsList.test.tsx`
- `src/pages/outreach/OutreachList.tsx`, `OutreachList.test.tsx`
- `src/pages/reports/ParticipationTab.tsx`
- `src/pages/reports/HoursTab.tsx`, `HoursTab.test.tsx`
- `src/pages/reports/EventsTab.tsx`, `EventsTab.test.tsx`

## Forbidden Files
- Every other file. `docs/swarm/**`, `.claude/**`.

## Known Context / Traps

**1. Two clean, direct verbatim swaps — verify current copy first (may have drifted), then match
exactly:**
- `MeetingsList.tsx` (coach, top-level empty state): change title/description to the PRD's literal
  text: *"No meetings scheduled. Set up your weekly build meetings once and check-in takes care of
  itself."* The action button ("Schedule meetings") already matches verbatim per the audit — verify
  it still does, don't touch it if so.
- `OutreachList.tsx` (student/parent view, top-level empty state): change to: *"No upcoming outreach
  yet. When your coach posts an event, you can sign up here."*

**2. The three Reports tabs need judgment, not a blind copy-paste — read this carefully before
touching them.** The PRD's one verbatim "Reports" example is: *"No completed sessions this season
yet. Stats appear after the first meeting or outreach day is marked complete."* This genuinely fits
`ParticipationTab.tsx` (which specifically reports completed-session participation) — apply it
there directly. It fits `HoursTab.tsx` and `EventsTab.tsx` less cleanly:
- `EventsTab.tsx` lists ALL sessions for the season (scheduled, completed, canceled — not just
  completed ones, confirmed by T058's own already-Passed design). Forcing the literal "No completed
  sessions" framing onto a tab that shows non-completed sessions too would itself be a new
  inaccuracy, not a fix. Read the tab's actual empty-state trigger condition (when does it show
  empty — zero sessions of ANY status, or something narrower?) and write a genuinely accurate
  adaptation that keeps DES-15's spirit (specific, warm, tells the user what will make it populate)
  without literally misdescribing what the tab shows.
- `HoursTab.tsx`'s current empty state is framed around a MISSING ROSTER ("Add students to the
  roster..."), not missing completed sessions — read the tab's actual empty-state trigger condition
  the same way before deciding whether the PRD's literal text applies, needs adaptation, or whether
  the current roster-focused framing is actually the more accurate message for what genuinely
  causes this tab to be empty.
- For both, if you judge that adapting rather than literally copying the verbatim text is more
  accurate, do that and state your reasoning explicitly — DES-15's own intent ("use these verbatim
  as defaults") is about not inventing weaker throwaway copy, not about forcing literally identical
  text onto tabs with genuinely different empty-state semantics. A dispute is not needed for this
  judgment call, but your reasoning must be clearly documented in your output either way.

**3. Update each screen's own test file if it asserts the old copy string.**

## Acceptance Criteria
- `MeetingsList.tsx`/`OutreachList.tsx` use the PRD's literal verbatim text exactly.
- `ParticipationTab.tsx`, `HoursTab.tsx`, `EventsTab.tsx` each have accurate, DES-15-spirited copy —
  either the literal verbatim text (where it genuinely fits) or a reasoned, documented adaptation
  (where it doesn't).
- `npm run typecheck`, `npm run lint`, `npm run test`, `npm run build`, `npm run format:check` all
  clean, zero regressions.

## Relevant Constitution Excerpts
> DES-15: "use these verbatim as defaults" — a paraphrase is a real, citable finding, not
> equivalent compliance.

## Most Recent Failure
None. This is attempt 1 for T083 (attempt count: 0) — first dispatch.

## Required Worker Output
- Full diff of every changed file.
- Exact before/after copy for all 5 screens.
- Your reasoning for `HoursTab.tsx`/`EventsTab.tsx`'s specific chosen approach (Trap #2).
- Full test/typecheck/lint/build output.
- Known risks; whether a dispute is needed (you flag, you don't resolve).
