# Checker Packet: T050 (Weekly digest template) — Check Attempt 1

## Task ID
T050 — Weekly digest template (EML-02 row 6), Epic E8.

## Checker Agent
checker-content (per task-ledger.md T050 row).

## Objective
Verify a parent-facing weekly digest template — per linked student: last week's attendance, hours
vs. goal, next week's schedule — with the BLOCKER-class EML-05 cross-family-leakage guarantee
genuinely holding, hours sourced correctly, and DES-14/BEH-01/BEH-02 copy rules respected.

## Allowed Files (worker's literal permitted edit)
- `src/emails/templates/weekly-digest.tsx` (new)

**Scope flag**: worker also created `weekly-digest.test.tsx`, outside the literal Allowed Files
line — same disclosed pattern already ruled in-scope by every prior checker in this batch. Re-derive
the judgment yourself.

## Forbidden Modification Check (run first, D001 method)
Compare Allowed Files above against the actual file tree / this task's commit (`23305f5`) — do NOT
infer authorship from commit messages. Confirm `src/emails/layout/**` (T048, already Passed)
untouched. Note: the working tree may show other concurrently-landing sibling tasks' files
(`src/emails/templates/{invite,signup-confirm,event-reminder-48h,event-reminder-3h,
meeting-reminder-3h}.tsx`, T049; `src/pages/calendar/**`, T045; `EndMeetingDialog.tsx`, T036;
`RsvpControl.tsx`, T040; `EventsTab.tsx`, T058) — none of these are this task's concern, do not
review or flag them.

## Worker's Claimed Changes (do not trust — verify independently)
1. **EML-05 (BLOCKER-class) — the central safety property.** Claims `WeeklyDigestParams.students`
   is a plain, required, caller-supplied array with no default value and no fallback roster-loading
   seam anywhere in the file — the render functions iterate only over `params.students`. Claims a
   real test (`weekly-digest.test.tsx`, `describe('EML-05...')`, 6 tests) using two distinct
   fabricated families (Alvarado: parent Jordan, students Mika + Reese, team "Thunder Bots";
   Whitcombe: parent Sasha, student Tavi, team "Circuit Sirens") renders each family's digest
   independently and asserts, in BOTH directions, that the other family's names/team/event/student
   IDs never appear anywhere in the output — at both the `buildWeeklyDigestBodyHtml` level and the
   full `renderWeeklyDigestEmail` layout-wrapped level. Claims an additional test proves an empty
   `students` array renders zero per-student sections (no roster-wide fallback).
2. **Hours vs. goal** — claims `confirmedHours` is a plain prop, never summed from
   `lastWeekAttendance`/`nextWeekSchedule` arrays (claims a test pads those arrays with extra rows
   and asserts the rendered `confirmedHours` is unchanged). Claims it independently reimplemented
   `ParentHome.tsx`'s established `studentGoalHours`/`hoursVsGoalPercent` idiom
   (`goalHours = goalHoursOverride ?? defaultGoalHours`, percent clamped to 100, `goalHours<=0`
   guarded to 0) rather than inventing a new one. Milestone framing reuses `OutreachList.tsx`'s
   `[25,50,75,100]` idiom, computed from confirmed hours only (never blended with any planned/other
   figure).
3. **`.tsx`-extension decision** — claims it independently decided (before T049 had landed) to
   write plain TypeScript with zero JSX, matching T048's Deno-import-compatible posture, then
   re-checked after T049 landed mid-task and confirmed its choice matches T049's own templates
   exactly.
4. **Week-boundary interpretation, disclosed**: Sun-Sat calendar week aligned to the Sunday 5pm CT
   send time (not a trailing 7-days-from-send window) — `computeWeeklyDigestWeekBoundaries` claimed
   to derive `nextWeekStart` from the send instant's own America/Chicago calendar date.
5. Claims 28/28 own tests pass. Claims the wider repo's `typecheck`/`build`/`lint`/`test` currently
   show failures, but all isolated to concurrently-landing sibling tasks' files
   (`RsvpControl.test.tsx`, `CalendarPage.tsx`, `invite.test.tsx` — the last claimed to be a
   pre-existing bug in T049's own test, unrelated to this file) — worker recommends the checker
   verify this isolation claim itself rather than trust it.

## Required Verification Steps
1. **Read `weekly-digest.tsx` and `weekly-digest.test.tsx` in full** — do not rely on the worker's
   module doc or this packet's paraphrasing.
2. **EML-05 — reproduce the cross-family-leakage proof yourself, this is the single most important
   check in this packet.** Confirm by source read that there is genuinely no fallback/"all students"
   data path (grep for any module-level roster constant or default parameter). Re-run the worker's
   own two-family test and, if you have capacity, write one additional adversarial case yourself
   (e.g. a family whose student/team name is a substring of the other family's, to rule out a
   false-negative from a loose string-matching test assertion).
3. **Hours-vs-goal sourcing — confirm by source read** that `confirmedHours` is never summed/
   recomputed from the per-entry attendance/schedule arrays, and that the goal-hours/percent
   computation matches `ParentHome.tsx`'s real, already-checker-approved shape (read that file
   yourself for comparison, don't trust the citation).
4. **`.tsx`-extension consistency with T049** — confirm both this file and T049's five templates
   (if present in the working tree at check time) use the same plain-TS-no-JSX posture. If T049 has
   not been checked/Passed yet, note this as an informational cross-task consistency observation,
   not a blocker for this task's own verdict.
5. **Week-boundary correctness** — reproduce or independently verify the Sun-Sat boundary
   computation with a hand-derived example (e.g. a send instant of a specific Sunday 5pm CT,
   confirm `lastWeekStart`/`lastWeekEnd`/`nextWeekStart` land where expected).
6. **BEH-01/BEH-02** — confirm no confirmed+planned (or equivalent) blending anywhere in any
   progress display, and that milestone framing matches the established `[25,50,75,100]` pattern.
7. **DES-14 copy voice** — spot-check rendered copy for sentence case, plain verbs, no "Submit"/"OK".
8. **Escaping** — confirm dynamic values (names, dates) are HTML-escaped before interpolation,
   consistent with `renderEmailLayout.ts`'s own `escapeHtml` pattern.
9. **Isolation claim — reproduce yourself.** Run `npx vitest run src/emails/templates/weekly-digest.test.tsx`
   directly and confirm 28/28 (or current count) passes in isolation, independent of whatever state
   the rest of the repo is in from concurrently-landing sibling tasks.
10. **No box-drawing/bracket characters, no fabricated real-looking PII** (fabricated names are fine
    and expected for test fixtures) — grep sweep yourself.

## Relevant Constitution Excerpts
- Item 6: no PII; test fixtures use fabricated names only. *(Cited because the EML-05 proof test's
  two families must be clearly fabricated, not incidentally resembling anyone real.)*
- Item 3: RLS/metric SQL formulas are never re-derived in TypeScript. *(Cited because `confirmedHours`
  must remain a passthrough prop, not a recomputed sum.)*

## Required Checker Output
- PASS or FAIL
- severity: BLOCKER, MAJOR, MINOR, or NIT
- evidence inspected (paste actual grep/read/test output, not paraphrase)
- commands run
- exact findings
- explicit verdict on the EML-05 cross-family-leakage safety property (this is the BLOCKER-class
  finding to scrutinize hardest)
- explicit verdict on the hours-vs-goal sourcing and pattern-reuse
- explicit verdict on the week-boundary interpretation
- explicit verdict on the test-file scope question
- required rework if failed
- follow-up tasks if passed with minor issues
