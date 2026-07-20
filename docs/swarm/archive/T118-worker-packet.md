# Worker Packet: T118

## Task ID
T118 — PRD v2 UXP-02: expected attendees at event creation (coach pre-marks
planned RSVPs from a roster checklist).

## Objective
`OutreachEventDialog` gains an "Expected attendees" roster checklist (grouped
by team chips, All/Clear shortcuts — reference: capability map "New event
form" figure), and saving the event writes planned RSVPs for the checked
students across the event's sessions. Matches the reference app's rule quoted
in the capability map: checked students are planned/RSVP'd; planned hours
never count as confirmed until attendance lands.

## Allowed Files
- `src/pages/outreach/OutreachEventDialog.tsx`, `OutreachEventDialog.test.tsx`
- `src/lib/supabase/loaders/outreach.ts` (extend `saveOutreachEvent`), its
  tests live in the page test files per this repo's convention — update where
  they exist.

## Forbidden Files
- `src/pages/outreach/OutreachDetail.tsx`, `AttendancePanel.tsx`,
  `loaders/attendance.ts` — sibling task T117 is editing/creating these
  concurrently; expect mid-flight noise, attribute honestly, never touch.
- `supabase/**` (T116 concurrent). Everything else.

## Known Context / Traps
**1. RSVP DDL — read it, don't assume.** Check `rsvps`' real columns/
constraints (status vocabulary, `responded_by`, unique key on
`(session_id, student_id)`) in the shipped migrations before writing. Staff
writes are permitted by the existing `staff_all` policy (T114-verified).
Planned RSVP = status `'going'` (verify the real enum/check values),
`responded_by` = the acting coach — which UXP-10's future feed will read as
staff-entered (vs. a student's own id = self).
**2. Per-session fan-out.** RSVPs key on SESSIONS, not events. A checked
student gets one RSVP per created session (the reference app's "8 expected ·
128h planned" arithmetic). For T101's edit-path session reconciliation
(update-in-place/insert-new/never-delete), decide and document: on EDIT,
newly-checked students fan out to all sessions; unchecking removes only
staff-entered (`responded_by`≠student) planned RSVPs, never a student's own
RSVP — that distinction is load-bearing, get it right and test it.
**3. Non-atomicity disclosure.** Event+sessions+RSVP writes are sequential
Postgrest calls — same disclosed partial-failure class T101 already
documented for `saveOutreachEvent`; extend that disclosure, don't invent a
transaction that doesn't exist.
**4. Roster source.** Active students grouped by team chips scoped to the
dialog's selected teams; reuse exportable pieces of `loaders/students.ts`
(read-only) rather than duplicating mapping logic. All/Clear shortcuts.
**5. Dialog space (UXD-06).** The dialog is already dense; if adding the
checklist makes it genuinely cramped, prefer a clearly-sectioned scrollable
layout now and note that UXP-09 (the form re-layout packet) is the designated
full fix — do not attempt the full re-layout here.
**6. Tests.** Assert the exact per-session RSVP upsert payloads (incl.
`responded_by`, conflict target), the edit-path fan-out/removal rules from
Trap #2, All/Clear behavior, and that unchecking never deletes a
student-originated RSVP. Astryx props verified per constitution item 2.

## Acceptance Criteria
Create/edit flows persist planned RSVPs per Trap #2's rules; student-owned
RSVPs never destroyed by staff edits; disclosure per Trap #3; all five gates
clean, sibling noise attributed honestly.

## Most Recent Failure
None. Attempt 1.

## Required Worker Output
Full diff; RSVP DDL findings; Trap #2 rules as implemented; full gate output;
risks/dispute flag.
