# Checker Packet: T045 (`/calendar` month grid + filters + detail links) — Check Attempt 1

## Task ID
T045 — `/calendar` month grid + filters + detail links (CAL-01/02), Epic E7.

## Checker Agent
checker-accessibility (per task-ledger.md T045 row).

## Objective
Verify an Astryx `Calendar` month grid used only within its genuinely documented Props surface (no
invented day-content/dots-render prop), a chronological session list carrying DES-04-colored type
`Badge`s satisfying both the "dots per DES-04" requirement and NAV-07's combined-list exception, a
four-option filter, and correct click-through links.

## Allowed Files (worker's literal permitted edit)
- `src/pages/calendar/CalendarPage.tsx` (new)

**Scope flag**: worker also created `CalendarPage.test.tsx`, outside the literal Allowed Files line
— same disclosed pattern already ruled in-scope by every prior checker in this batch. Re-derive the
judgment yourself.

## Forbidden Modification Check (run first, D001 method)
Compare Allowed Files above against the actual file tree / this task's commit (`af6ec2a`) — do NOT
infer authorship from commit messages. Confirm `MeetingsList.tsx`, `OutreachList.tsx`, `router.tsx`
(import-only, `routePaths` import permitted), `guards.tsx` untouched. Note: the working tree may
show other concurrently-running tasks' untracked/committed files (`EndMeetingDialog.tsx`,
`RsvpControl.tsx`, `HoursTab.tsx`, `EventsTab.tsx`) — not this task's concern.

## Worker's Claimed Changes (do not trust — verify independently)
1. **THE CENTRAL TRAP — claims a two-part investigation proving no day-content/dots-render prop
   exists anywhere.** (a) `astryx-api.md`'s real `Calendar` Props table (13 props) has no
   `dayContent`/`renderDay`/per-day slot — `dateConstraints` is only a disabling predicate array.
   (b) Claims it read the INSTALLED vendor source directly
   (`node_modules/@astryxdesign/core/src/Calendar/Calendar.tsx`, ~1023 lines) and found the private
   `DayCell` sub-component (not exported) has a hard-coded JSX body
   (`<button>{dayNumber}</button>`) with no children/render/content slot of any kind — ruling out
   not just "no documented prop" but "no prop could exist without editing vendor source." Claims it
   considered and explicitly rejected a `data-date`-keyed global `<style>` synthesis approach as not
   a genuine composition pattern.
2. **Resolution shipped**: `Calendar` used only for month-nav (`focusDate`/`onFocusDateChange`) and
   date selection (`mode="single"`, `onChange`) — its real, documented job. "Dots colored per
   DES-04" satisfied entirely by the chronological list: every row carries a real `Badge`
   (`variant='purple'|'blue'|'orange'` for meeting/outreach/competition) as `endContent` — claimed
   to simultaneously satisfy NAV-07's "every row carries a type Badge" requirement with the same
   element. A three-Badge legend sits between the grid and filter.
3. **Filter and click-through**: four-option `SegmentedControl` (All/Meetings/Outreach/
   Competitions) claimed to filter both the list and month nav re-scoping; `Link` `href`s point at
   `/meetings/:sessionId` and `/outreach/:eventId` for both outreach and competition types (NAV-08).
4. **Disclosed gap**: `router.tsx` has no `/meetings/:sessionId` route registered yet (only
   `/meetings/live/:sessionId`) — explicitly permitted since `router.tsx` is import-only here.
5. Claims 28/28 new tests pass; 735/735 repo-wide. typecheck/lint/build clean for its own files;
   discloses whole-repo `format:check` fails only on `Kiosk.tsx` (a different, untouched file).

## Required Verification Steps
1. **Read `CalendarPage.tsx` and `CalendarPage.test.tsx` in full** — do not rely on the worker's
   module doc or this packet's paraphrasing.
2. **Trap #1 — reproduce the investigation yourself, this is the single most important check in
   this packet.** Grep `astryx-api.md`'s real `Calendar` Props table yourself. Read the installed
   `Calendar.tsx`/`DayCell` source yourself and confirm the hard-coded JSX body claim — this is a
   strong, falsifiable claim (an exported children slot would immediately disprove it), verify it
   directly rather than trusting the citation.
3. **Resolution — judge whether it's a genuinely defensible interpretation** of "sessions render as
   dots/labels colored per DES-04," or whether it under-delivers on the PRD's literal wireframe
   intent (PRD line 487's ASCII mockup shows dots inside the grid itself). Render an explicit,
   reasoned verdict — this is exactly the kind of judgment call a checker should scrutinize, not
   rubber-stamp.
4. **DES-04 color mapping — confirm by source read** (`Badge variant` values genuinely match
   meeting=purple/outreach=blue/competition=orange, cite the PRD table yourself).
5. **NAV-07 — confirm the same `Badge` element genuinely satisfies both requirements** (not two
   separate implementations that could drift).
6. **Filter and click-through — reproduce or independently verify** the four-option filter
   correctly re-scopes the list, and that `Link` `href`s point at the claimed paths.
7. **Astryx prop citations** — spot-check `Calendar`, `Badge`, `SegmentedControl`/
   `SegmentedControlItem`, `Link`, `List`/`ListItem` against `astryx-api.md`.
8. **Test-file scope question** — render an explicit verdict, independently re-derived.
9. **Re-run typecheck/lint/build/test yourself** — don't accept the worker's claimed counts without
   your own run. Confirm the `format:check` failure is genuinely isolated to `Kiosk.tsx` and not
   this task's files.
10. **Accessibility read of the actual UI** (this task's checker is checker-accessibility): keyboard
    navigation through the Calendar grid, filter control, and list; visible focus; no hardcoded hex
    colors breaking dark mode; semantic heading structure.
11. **No box-drawing/bracket characters** (constitution item 13) — grep sweep yourself.

## Relevant Constitution Excerpts
- Item 2: Astryx component usage must stay within the documented API surface. *(Cited because Trap
  #1 is exactly this rule in action — verify it wasn't secretly worked around with an undocumented
  prop or a fragile CSS hack.)*
- Item 13: no box-drawing/bracket-character fake structure.

## Required Checker Output
- PASS or FAIL
- severity: BLOCKER, MAJOR, MINOR, or NIT
- evidence inspected (paste actual grep/read/test output, not paraphrase)
- commands run
- exact findings
- explicit verdict on the Trap #1 investigation's genuineness and the resolution's defensibility
- explicit verdict on the DES-04/NAV-07 dual-purpose Badge design
- explicit verdict on the test-file scope question
- required rework if failed
- follow-up tasks if passed with minor issues
