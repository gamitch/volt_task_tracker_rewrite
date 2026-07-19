# Checker Packet: T036 (End meeting flow) — Check Attempt 1

## Task ID
T036 — End meeting flow (MTG-13), Epic E5 (last task in this epic).

## Checker Agent
checker-reviewer (per task-ledger.md T036 row).

## Objective
Verify an "End meeting" `AlertDialog` flow that atomically flips `event_sessions.status='completed'`,
backfills `absent` for no-record roster members, and closes open check-ins — with post-completion
attendance edits relying entirely on the real, already-applied `trg_audit_attendance_post_completion`
trigger, never a duplicate client-side `audit_log` write.

## Allowed Files (worker's literal permitted edit)
- `src/pages/meetings/EndMeetingDialog.tsx` (new)

**Scope flag**: worker also created `EndMeetingDialog.test.tsx`, outside the literal Allowed Files
line — same disclosed pattern already ruled in-scope by every prior checker in this batch. Re-derive
the judgment yourself.

## Forbidden Modification Check (run first, D001 method)
Compare Allowed Files above against the actual file tree / this task's commit (`a301853`) — do NOT
infer authorship from commit messages. Confirm `LiveConsole.tsx`, `MeetingsList.tsx`,
`ScheduleMeetingsDialog.tsx`, `StudentMeetingView.tsx`, `router.tsx`, `guards.tsx` (import-only)
untouched, and no migration file added/edited. Note: the working tree may show other concurrently-
running tasks' untracked files (`RsvpControl.tsx`, `CalendarPage.tsx`, `EventsTab.tsx`,
`HoursTab.tsx`) — not this task's concern.

## Worker's Claimed Changes (do not trust — verify independently)
1. **`trg_audit_attendance_post_completion` citation and non-duplication — the central safety
   property.** Claims the real, applied trigger (cited `supabase/migrations/20260717000001_support_audit.sql`
   lines 120-156) fires `after update on attendance`, checking `event_sessions.status` LIVE via
   `NEW.session_id`. Claims a grep confirms every `audit_log` mention in the file is inside a
   comment or a `console.warn` string — zero real writes. `defaultOnEndMeeting`/
   `defaultOnEditAttendance` claimed to only `console.warn` their payloads (no DB call anywhere in
   the file — only imports are `react` and `@astryxdesign/core`).
2. **Atomicity contract** — `EndMeetingPayload { sessionId, endsAt, backfillAbsentStudentIds,
   checkoutStudentIds }` claimed to name all three legs (status flip, absence backfill, checkout)
   as one shape passed to a single `onEndMeeting(payload)` call, mirroring T029's
   `SetActiveSeasonPayload`. Local state only mutated post-resolution; rejection leaves state
   untouched. Claims explicit disclosure that checkout UPDATEs must run BEFORE the status flip
   within the real (future) transaction, else the trigger would spuriously log the meeting-ending
   checkout itself as a "post-completion edit."
3. **Pre-confirm-summary design (Trap #3)** — claims it chose "current DB state only" (Option B):
   the `AlertDialog` description shows the live tally of currently-recorded rows in the literal
   `"N present · N late · N excused · N absent"` format, PLUS a separate disclosed sentence for the
   about-to-be-backfilled "no record" count and the about-to-be-checked-out count — never blending
   current and future state into one number.
4. **Scope addition beyond the literal packet ask (disclosed, flagged for checker review)**: a
   post-completion `onEditAttendance` correction seam/UI, added specifically to prove the "plain
   UPDATE, trigger handles audit automatically" contract with a real, exercised call site.
5. **`AlertDialog actionVariant="primary"`** — claims a deliberate override of the documented
   `'destructive'` default, reasoning that ending a meeting is normal workflow completion, not data
   loss (unlike `MeetingsList.tsx`'s cancel-meeting dialog, which keeps `'destructive'`).
6. Claims 21 new tests pass; 657/657 repo-wide. typecheck/lint/build clean; discloses whole-repo
   `format:check` fails only on other concurrent workers' files, confirmed via `git status`/`git diff`
   that `Kiosk.tsx` itself is genuinely untouched.

## Required Verification Steps
1. **Read `EndMeetingDialog.tsx` and `EndMeetingDialog.test.tsx` in full** — do not rely on the
   worker's module doc or this packet's paraphrasing.
2. **`trg_audit_attendance_post_completion` citation — re-verify directly, this is the central
   safety property.** Open the migration yourself and confirm the trigger genuinely exists and fires
   as claimed. Reproduce the `audit_log`/DB-call grep yourself (including checking for any Supabase
   import at all) and confirm zero real writes.
3. **Atomicity contract — confirm by source read.** Verify `EndMeetingPayload` genuinely names all
   three legs as one shape, and that local state mutation only happens post-resolution (test the
   rejection path: does state genuinely stay unflipped on a rejected call?).
4. **Pre-confirm-summary design choice — form your own explicit verdict** on whether "current DB
   state only, plus a separate future-change disclosure sentence" is the right choice versus
   folding the about-to-be-backfilled counts directly into the main tally (both defensible, but
   should be judged, not just accepted).
5. **The disclosed scope addition (post-completion `onEditAttendance` seam) — judge whether this is
   in-scope or an overstep.** The packet's own Objective sentence says "attendance remains
   coach-editable post-completion" — decide whether building a real, exercised UI for this (not
   just documenting the contract) is a reasonable interpretation or exceeds the task's literal ask.
6. **`actionVariant="primary"` override — confirm by source read** and render an explicit verdict on
   whether the reasoning (workflow completion, not data loss) is sound given `AlertDialog`'s real
   documented default.
7. **Astryx prop citations** — spot-check `AlertDialog`, `Button`, `Banner`, `List`/`ListItem`,
   `SegmentedControl`/`SegmentedControlItem`, `StatusDot`, `Spinner`, `EmptyState`, `VStack` against
   `astryx-api.md`.
8. **Test-file scope question** — render an explicit verdict, independently re-derived.
9. **Re-run typecheck/lint/build/test yourself** — don't accept the worker's claimed counts without
   your own run. Independently confirm `Kiosk.tsx` is genuinely byte-unchanged (`git diff` empty).
10. **No box-drawing/bracket characters** (constitution item 13) — grep sweep yourself.

## Relevant Constitution Excerpts
- Item 10 (BLOCKER-class): database changes are additive migrations via the Supabase CLI; editing
  an applied migration file is a BLOCKER. *(Cited because this task correctly relies on the existing
  trigger rather than adding a redundant/conflicting one.)*
- Item 2: Astryx component usage must stay within the documented API surface.

## Required Checker Output
- PASS or FAIL
- severity: BLOCKER, MAJOR, MINOR, or NIT
- evidence inspected (paste actual grep/read/test output, not paraphrase)
- commands run
- exact findings
- explicit verdict on the audit-log non-duplication safety property
- explicit verdict on the atomicity-contract design
- explicit verdict on the pre-confirm-summary design choice
- explicit verdict on whether the disclosed post-completion editing-seam scope addition is in-scope
- explicit verdict on the test-file scope question
- required rework if failed
- follow-up tasks if passed with minor issues
