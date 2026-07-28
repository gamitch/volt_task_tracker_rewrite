# Checker Packet: T040 (RSVP control) — Check Attempt 1

## Task ID
T040 — RSVP control (OUT-03), Epic E6.

## Checker Agent
checker-reviewer (per task-ledger.md T040 row).

## Objective
Verify a real, standalone student RSVP control using OUT-03's literal `[Sign up | Maybe | Can't
go]` labels correctly mapped to the real `rsvps.status` enum, a real `responded_by` profile-id
attribution (not a hardcoded role string), a genuinely enforced session-start lock boundary, and
BEH-09 helper/confirmation copy that is honest about T051 (reminders) not existing yet.

## Allowed Files (worker's literal permitted edit)
- `src/pages/outreach/RsvpControl.tsx` (new)

**Scope flag**: worker also created `RsvpControl.test.tsx`, outside the literal Allowed Files line
— same disclosed pattern already ruled in-scope by every prior checker in this batch. Re-derive the
judgment yourself.

## Forbidden Modification Check (run first, D001 method)
Compare Allowed Files above against the actual file tree / this task's commit (`ae099bf`) — do NOT
infer authorship from commit messages. Confirm `OutreachList.tsx`, `OutreachEventDialog.tsx`,
`router.tsx`, `guards.tsx` (import-only) untouched. Note: the working tree may show other
concurrently-running tasks' untracked files (`CalendarPage.tsx`, `EventsTab.tsx`, `HoursTab.tsx`) —
not this task's concern.

## Worker's Claimed Changes (do not trust — verify independently)
1. **Label-vs-stored-value mapping** — claims `RSVP_ITEMS` is the sole place this is defined:
   label "Sign up" → `'going'`, "Maybe" → `'maybe'`, "Can't go" → `'declined'` (the real schema
   check constraint only accepts `'declined'`, no `"can't go"` value exists). Claims OUT-03's
   literal PRD labels are used, not `OutreachList.tsx`'s own "Going" preview simplification.
2. **`responded_by` — a real profile-id attribution, not a hardcoded string.** Claims two separate
   props: `studentId` (`rsvps.student_id`, the signed-in student's own row) and
   `currentUserProfileId` (a real `profiles.id`, attributed to `responded_by`), defaulting to a
   disclosed placeholder constant given no shared auth context is wired in yet. Claims a test
   asserts `respondedBy !== 'student'` and `respondedBy !== studentId`.
3. **Session-start lock boundary — enforced at two levels, both claimed real.** (a) A pure
   `isSessionTimeEditable(startsAt, now)` boundary function, tested at ±1 minute around the
   boundary. (b) `SegmentedControl isDisabled` verified against the installed
   `SegmentedControlItem.tsx` source (its `handleClick` guards on `isItemDisabled` before calling
   `onChange` — claims a test dispatches a real click on a locked control and asserts the callback
   never fires). (c) An ADDITIONAL, disclosed-as-beyond-the-packet's-literal-ask live re-lock
   `useSessionRsvpLock` hook using a `setTimeout` to flip to locked exactly at `starts_at`, claimed
   tested with fake timers crossing the boundary without remounting.
4. **BEH-09 copy** — claims verbatim "You can change this until the event starts." rendered while
   editable, plus a confirmation line stating "We'll remind you 2 days before this event once
   VOLT's reminder system is live" with an EXPLICIT disclosure that no real reminder is scheduled
   (T051 not built) — not a claim that a real system will actually fire.
5. Claims a disclosed `isRsvpEditable` addition beyond the pure time-boundary function: also
   requires `session.status === 'scheduled'`, with `isSessionTimeEditable` kept independently
   exported/tested for the pure-boundary claim alone.
6. Claims optimistic UI with rollback-on-failure as an own, disclosed design choice.
7. Claims 14 new tests; 657/657 repo-wide (32 files). typecheck/lint/build clean for its own files;
   discloses that whole-repo `format:check` currently fails on OTHER concurrent workers' untracked
   files, not its own two files (which individually pass `prettier --check`).

## Required Verification Steps
1. **Read `RsvpControl.tsx` and `RsvpControl.test.tsx` in full** — do not rely on the worker's
   module doc or this packet's paraphrasing.
2. **Label-vs-value mapping — confirm by source read.** Verify the real `rsvps.status` check
   constraint (`supabase/migrations/20260717000000_scheduling_attendance.sql` line ~71) and confirm
   `"Can't go"` never leaks into a write as anything other than `'declined'`.
3. **`responded_by` — the central correctness check.** Confirm by source read that `responded_by`
   is genuinely populated from a real profile-id prop, never a literal `'student'` string anywhere
   in the file (grep). Judge whether the placeholder-constant default is an honest, disclosed stand-
   in (same posture every prior page task in this batch has used for its own missing-auth-context
   gap) rather than something silently masquerading as real.
4. **Session-start lock — reproduce the boundary tests yourself.** Confirm `isSessionTimeEditable`'s
   ±1-minute boundary case, and independently verify (via the installed `SegmentedControlItem.tsx`
   source, read it yourself) that a disabled item's `onChange` genuinely cannot fire — don't just
   trust the worker's citation. Render your own explicit verdict on whether the ADDITIONAL live
   re-lock `setTimeout` hook is a reasonable, correctly-implemented enhancement or introduces any
   risk (e.g. a stale closure, a leak if the component unmounts before the timer fires — check for
   cleanup).
5. **BEH-09 copy — confirm verbatim text and the T051-honesty disclosure.** The confirmation copy
   must not claim a reminder is actually scheduled.
6. **Astryx prop citations** — spot-check `SegmentedControl`, `SegmentedControlItem`, `Text`,
   `Banner`, `VStack` against `astryx-api.md`.
7. **Test-file scope question** — render an explicit verdict, independently re-derived.
8. **Re-run typecheck/lint/build/test yourself**, scoped to this task's own two files given the
   disclosed concurrent-worker noise on whole-repo `format:check` — don't accept the worker's
   claimed counts without your own run.
9. **No box-drawing/bracket characters** (constitution item 13) — grep sweep yourself.

## Relevant Constitution Excerpts
- Item 2: Astryx component usage must stay within the documented API surface.
- Item 13: no box-drawing/bracket-character fake structure.

## Required Checker Output
- PASS or FAIL
- severity: BLOCKER, MAJOR, MINOR, or NIT
- evidence inspected (paste actual grep/read/test output, not paraphrase)
- commands run
- exact findings
- explicit verdict on the `responded_by` real-profile-id attribution
- explicit verdict on the session-start lock boundary (both the pure function and the live re-lock
  addition)
- explicit verdict on the BEH-09 copy honesty
- explicit verdict on the test-file scope question
- required rework if failed
- follow-up tasks if passed with minor issues
