# Checker Packet: T042 (Mark day complete dialog) — Check Attempt 1

## Task ID
T042 — Mark day complete dialog (OUT-05), Epic E6 (last piece of this epic).

## Checker Agent
checker-reviewer (per task-ledger.md T042 row).

## Objective
Verify an OUT-05 `Dialog` with attendee checklist (pre-checked from `going` RSVPs), people-reached
and adult-volunteers fields, per-student hours-override, and a BEH-07-compliant confirm button —
with MET-03's real formula never reproduced in TypeScript, and the event-vs-session
adult-volunteers granularity mismatch honestly resolved.

## Allowed Files (worker's literal permitted edit)
- `src/pages/outreach/MarkDayCompleteDialog.tsx` (new)

**Scope flag**: worker also created `MarkDayCompleteDialog.test.tsx`, outside the literal Allowed
Files line — same disclosed pattern already ruled in-scope by every prior checker in this batch.
Re-derive the judgment yourself.

## Forbidden Modification Check (run first, D001 method)
Compare Allowed Files above against the actual file tree / this task's commit — do NOT infer
authorship from commit messages. Confirm `OutreachList.tsx`, `OutreachEventDialog.tsx`,
`RsvpControl.tsx`, `OutreachDetail.tsx`, `router.tsx`, `guards.tsx` untouched. Note: the working
tree may show other concurrently-running tasks' files (`SettingsPage.tsx`) — not this task's
concern.

## Worker's Claimed Changes (do not trust — verify independently)
1. **MET-03 formula-ownership — the central safety property (constitution item 3, BLOCKER-class).**
   Claims `computeSessionDurationHours` is a plain `(ends_at − starts_at)` subtraction used ONLY to
   seed the per-student `NumberInput`'s default value — never combined with a coalesce/case chain.
   Claims `computeTotalHoursForCheckedStudents` sums only the per-student values THIS dialog is
   about to write (a local aggregation of its own pending writes), never queries `v_student_hours`.
   Claims `buildAttendanceWriteRows` always writes `checkInAt: null, checkOutAt: null` (this dialog
   collects no timestamps), which claims to structurally guarantee `v_student_hours`'s real SQL
   tier-2 CASE branch evaluates to `NULL` for every row this dialog creates — meaning the real
   coalesce chain provably degenerates to exactly the client-computed 2-tier expression, not a
   frozen/duplicated formula. Claims `hoursOverride` is written as genuine `null` (not back-filled
   with the numeric default) for any untouched student, so the real SQL formula — not a TypeScript
   snapshot — governs going forward once real persistence lands.
2. **Adult-volunteers event-vs-session granularity (disclosed judgment call)** — claims it chose
   the additive/delta model: `MarkDayCompletePayload.adultVolunteersCountThisSession`/
   `adultVolunteerHoursThisSession` represent THIS SESSION's contribution only, meant to be
   additively applied (`events.x = events.x + delta`) by a future wiring task, never a raw `SET`.
   Claims the dialog never reads/displays the event's current cumulative total at all (no such prop
   exists), sidestepping the cross-session-overwrite risk. Claims both fields are UI-labeled
   "(this session)" plus a standalone disclosure line.
3. **Attendee checklist** — claims `computeInitialAttendedStudentIds` proves going→checked,
   maybe/declined/no-response→unchecked via a 4-student fixture; any row togglable regardless of
   starting state.
4. **BEH-07 live-computed confirm button** — claims the literal button text recomputes across
   initial state, checking a second student, entering an override, and unchecking to zero.
5. **Ineligibility handling** — claims a session with `status !== 'scheduled'` renders only an
   explanatory `Banner` + Close, zero checklist/inputs/confirm action.
6. Claims 24/24 own tests pass in isolation; 864/864 repo-wide on a final stabilized run (discloses
   a transient concurrent-worker-caused repo-wide failure mid-session that self-resolved, confirmed
   via `git diff --stat` showing zero touches to any Forbidden File). typecheck/lint/build clean.

## Required Verification Steps
1. **Read `MarkDayCompleteDialog.tsx` and `MarkDayCompleteDialog.test.tsx` in full** — do not rely
   on the worker's module doc or this packet's paraphrasing.
2. **MET-03 formula-ownership — the single most important check in this packet.** Read
   `v_student_hours`'s real SQL yourself (`20260717000003_metric_views.sql` lines 3-19) and
   independently verify the worker's structural claim: with `check_in_at`/`check_out_at` both
   always `null` for rows this dialog creates, does the CASE branch genuinely evaluate to SQL
   `NULL`, making the coalesce chain degenerate to exactly `hours_override ?? duration`? Confirm
   this by tracing through the actual SQL, not by trusting the worker's prose explanation. Grep the
   file for any accidental reproduction of the full 3-tier formula (a `check_in`/`check_out`
   reference outside a comment would be a real violation).
3. **Adult-volunteers granularity — render your own explicit verdict.** Is the additive/delta model
   the correct, safer choice given the real schema (event-level columns, session-level dialog), or
   should it have been implemented differently? Confirm the dialog genuinely has no prop/UI
   suggesting it shows or edits the event's cumulative total (which would contradict the delta
   framing).
4. **Attendee checklist and BEH-07 button — reproduce the tests yourself.**
5. **Ineligibility handling — confirm by source read** that a non-`'scheduled'` session genuinely
   blocks all actionable UI, not just visually de-emphasizes it.
6. **Astryx prop citations** — spot-check `Dialog`, `DialogHeader`, `Layout`/`LayoutContent`/
   `LayoutFooter`, `FormLayout`, `CheckboxList`/`CheckboxListItem`, `NumberInput`, `Button`,
   `Banner`, `HStack`/`VStack`, `Text` against `astryx-api.md`.
7. **Test-file scope question** — render an explicit verdict, independently re-derived.
8. **Re-run typecheck/lint/build/test yourself** — don't accept the worker's claimed counts without
   your own run.
9. **No box-drawing/bracket characters** (constitution item 13) — grep sweep yourself.

## Relevant Constitution Excerpts
- Item 3 (BLOCKER-class): RLS/metric SQL formulas are never re-derived in TypeScript. *(Cited
  directly — this is the highest-stakes finding a checker should hunt for on this task, given the
  worker's own claim rests on a subtle structural argument that deserves independent verification,
  not acceptance at face value.)*
- Item 2: Astryx component usage must stay within the documented API surface.

## Required Checker Output
- PASS or FAIL
- severity: BLOCKER, MAJOR, MINOR, or NIT
- evidence inspected (paste actual grep/read/test output, not paraphrase)
- commands run
- exact findings
- explicit verdict on the MET-03 formula-ownership structural argument (does check-in/out always
  being null genuinely force the coalesce chain to degenerate as claimed?)
- explicit verdict on the adult-volunteers additive/delta design choice
- explicit verdict on the test-file scope question
- required rework if failed
- follow-up tasks if passed with minor issues
