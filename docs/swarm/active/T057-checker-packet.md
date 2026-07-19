# Checker Packet: T057 (Hours tab) — Check Attempt 1

## Task ID
T057 — Hours tab (RPT-03), Epic E9.

## Checker Agent
checker-reviewer (per task-ledger.md T057 row).

## Objective
Verify per-student/per-team confirmed hours sourced from `v_student_hours` only (never
recomputed), planned hours computed via the already-established `OutreachList.tsx` definition,
goal/percent-to-goal via the established `resolveGoalHours`/`hoursVsGoalPercent` pattern, correct
team subtotals, and season totals for people reached / adult volunteers.

## Allowed Files (worker's literal permitted edit)
- `src/pages/reports/HoursTab.tsx` (new)

**Scope flag**: worker also created `HoursTab.test.tsx`, outside the literal Allowed Files line —
same disclosed pattern already ruled in-scope by every prior checker in this batch. Re-derive the
judgment yourself.

## Forbidden Modification Check (run first, D001 method)
Compare Allowed Files above against the actual file tree / this task's commit (`08ce998`) — do NOT
infer authorship from commit messages. Confirm `ReportsShell.tsx`, `ParticipationTab.tsx`,
`OutreachList.tsx`, `StudentHome.tsx`/`ParentHome.tsx`/`CoachHome.tsx`, `router.tsx`, `guards.tsx`
untouched. Note: the working tree may show other concurrently-running tasks' files
(`CalendarPage.tsx`, `EventsTab.tsx`, `EndMeetingDialog.tsx`, `RsvpControl.tsx`) — not this task's
concern.

## Worker's Claimed Changes (do not trust — verify independently)
1. **Confirmed hours — `v_student_hours` only, the central safety property.** Claims a grep for
   `attendance`/`hours_override`/`check_in`/`check_out` shows every hit inside a comment; zero hits
   in executable code. Claims the only `.reduce`/sum touching `confirmedHours` (`buildTeamGroups`)
   sums already-computed per-student values into a team subtotal, never touching raw attendance.
2. **Planned hours** — claims reused from `OutreachList.tsx`'s `computeStudentHours`/`sessionHours`
   (going RSVP + still-`scheduled` session), extended with the `events.countsVolunteerHours` guard
   claimed reused from `StudentHome.tsx`'s own (non-outreach-scoped) `computePlannedHours`
   precedent, since RPT-03 covers all event types, not just outreach. Independently authored, not
   imported (both source files are Forbidden).
3. **Goal hours** — claims reuses `StudentHome.tsx`'s exact `resolveGoalHours`/`hoursVsGoalPercent`
   shape.
4. **Null `people_reached` season-total handling (disclosed judgment call)**: claims
   `buildSeasonTotals` sums only non-null values and separately counts nulls, surfaced as "N of M
   sessions have no recorded headcount yet" — nulls excluded, not treated as 0. Claims no
   `event.type` filter applied to season totals (per the packet's own ground-truth text), proven via
   a `meeting`-type fixture event contributing.
5. **BEH-02** — claims a test asserts a hypothetical confirmed+planned sum string never appears in
   the DOM.
6. **DISCLOSED, FLAGGED JUDGMENT CALL — BEH-01 milestone Toast scoped per-TEAM, not per-student
   row.** Claims firing one Toast per student per crossed milestone on a dense report table would be
   an unreasonable notification flood, not the "personal celebratory moment" context BEH-01 was
   written for. Every row's `ProgressBar` still shows a real confirmed-hours-driven percent; only
   the tick badges + dedup Toast are team-level. **Worker explicitly flags this as a dispute
   candidate if the checker reads BEH-01 as requiring literal per-row treatment.**
7. Claims 26 new tests pass; 683/683 repo-wide at the time of its run. typecheck/lint/build clean;
   discloses `format:check` flags only pre-existing unrelated files.

## Required Verification Steps
1. **Read `HoursTab.tsx` and `HoursTab.test.tsx` in full** — do not rely on the worker's module doc
   or this packet's paraphrasing.
2. **Confirmed-hours claim — reproduce the grep yourself, this is the central safety property.**
   Confirm zero executable-code references to raw attendance/check-in/check-out/hours_override.
3. **Planned-hours definition — confirm it genuinely matches `OutreachList.tsx`'s established,
   already-checker-approved logic** (read that file yourself for comparison), correctly extended
   with the `countsVolunteerHours` guard.
4. **Goal-hours pattern — confirm byte-for-byte logical match** with `StudentHome.tsx`'s (or
   another home-dashboard file's) established shape.
5. **BEH-01 milestone-scoping judgment call — render your own explicit verdict.** Read BEH-01's PRD
   text directly. Decide whether per-team Toast scoping (with per-row visual progress still shown)
   is a reasonable interpretation for a dense report table, or whether it should be escalated as a
   dispute per the worker's own flag. This is the single most important judgment call in this
   packet — do not simply accept the worker's reasoning without independently weighing it.
6. **Team subtotals and season totals — reproduce the boundary cases.** Confirm team sums are never
   cross-summed (one team's confirmed with another's planned), and confirm the null-`people_reached`
   handling behaves as claimed.
7. **"Grouped Table" naming trap** — confirm the real, documented `Table` component is used, no
   invented `GroupedTable`.
8. **Astryx prop citations** — spot-check `Table`, `Section`, `Card`, `Grid`, `ProgressBar`,
   `Badge`, `Toast`, `EmptyState`, `Spinner`, `Banner` against `astryx-api.md`.
9. **Test-file scope question** and **RPT-06 gating posture (no self-gate, matching
   `ParticipationTab.tsx`)** — render explicit verdicts, independently re-derived.
10. **Re-run typecheck/lint/build/test yourself** — don't accept the worker's claimed counts without
    your own run.
11. **No box-drawing/bracket characters** (constitution item 13) — grep sweep yourself.

## Relevant Constitution Excerpts
- Item 3 (BLOCKER-class): RLS/metric SQL formulas are never re-derived in TypeScript. *(Cited for
  confirmed hours specifically — planned hours has no view and is a legitimately new computation.)*
- Item 2: Astryx component usage must stay within the documented API surface.

## Required Checker Output
- PASS or FAIL
- severity: BLOCKER, MAJOR, MINOR, or NIT
- evidence inspected (paste actual grep/read/test output, not paraphrase)
- commands run
- exact findings
- explicit verdict on the confirmed-hours non-recomputation safety property
- explicit verdict on the BEH-01 per-team-vs-per-row milestone scoping judgment call (dispute
  candidate — state clearly whether you concur or would escalate to boss-arbiter)
- explicit verdict on the test-file scope question
- required rework if failed
- follow-up tasks if passed with minor issues
