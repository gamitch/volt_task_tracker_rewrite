# T305 — the mark-complete dialog must seed from recorded attendance, not RSVP intent

**Branch:** `claude/t305-attendance-over-rsvp` (off `main` = `e28bf93`)
**Tier:** small build — one injectable seam, one seeding rule, tests.
**Scope note:** this packet is the **dialog half only**. The Signups-display half of the owner's
ruling is filed separately as **T306** and is explicitly out of scope here. Do not touch
`OutreachDetail.tsx`'s Signups section.

---

## 1. The defect (found by the owner running the app against real data)

On a session that **already has recorded attendance and hours**, the "Mark day complete" dialog
opens with **every student unchecked** and its confirm button reads **"Mark complete — 0 attended ·
0 h"**. The owner's screenshot shows exactly this: `George-Student` has a ticked attendance row with
3h in the panel below, and the dialog above it says nobody attended.

Cause — `computeInitialAttendedStudentIds` (`MarkDayCompleteDialog.tsx:442-453`) seeds the checklist
from **`rsvps` with `status === 'going'` only**. It never reads the `attendance` table. A coach who
recorded attendance directly in the panel, without anyone RSVPing, gets a dialog that misdescribes
the session it is about to complete.

**This is NOT data loss, and the packet says so because a worker will otherwise assume it is.**
Verified before filing: the absence backfill is
`.upsert(..., { onConflict: 'session_id,student_id', ignoreDuplicates: true })`
(`loaders/endMeeting.ts:377-386`), so a student who already has an `attendance` row keeps it and is
never overwritten with `absent`. The dialog **understates** what will happen. Fixing it is about
telling the coach the truth, not about preventing corruption.

---

## 2. Owner ruling

**"show attendance"** (2026-07-31, recorded in `docs/swarm/auto-mode-decisions.md`).

Applied here: the checklist must reflect **what was actually recorded**, falling back to RSVP intent
only where nothing was recorded.

**Explicitly NOT authorized:** writing RSVP rows from attendance. `OutreachList.tsx:1685-1687`
records the reason, from a checker's rework of T121: *"RSVP is intent, not a real attendance
record."* Synthesising a `going` RSVP would claim a student said yes in advance when they never
responded. **Attendance and RSVP stay separate records.**

---

## 3. The seeding rule

Replace RSVP-only seeding with, per roster student, in this order:

1. **An `attendance` row exists for (session, student)** → checked iff that row's status is an
   attending status. Use `isAttendingStatus` (`AttendancePanel.tsx:308`) — do **not** re-derive
   which statuses count as attending; that predicate is already the one place that decides it.
2. **No `attendance` row** → fall back to the current rule: checked iff a `going` RSVP exists for
   this session.

A recorded `absent` row must therefore start **unchecked**, even if the student RSVP'd `going`.
Recorded truth beats stated intent — that is the whole point of the ruling.

Keep `computeInitialAttendedStudentIds` exported and keep its existing behaviour reachable; extend
it (or add a sibling) so the RSVP-only path is still directly testable. Do not delete a tested
exported function to replace it wholesale.

---

## 4. Where the attendance rows come from

`OutreachDetail.tsx` does **not** have attendance rows — `AttendancePanel` loads its own
(`AttendancePanelProps.loadAttendance?: LoadAttendanceForSessionsFn`, defaulting to the real
`loadAttendanceForSessions`; `AttendancePanel.tsx:569-570`). **Do not lift that state into
`OutreachDetail`** and do not add a second competing load there.

Instead give `MarkDayCompleteDialog` **the same injectable seam**, mirroring the panel's own
convention:

- `MarkDayCompleteDialogProps` gains `loadAttendance?: LoadAttendanceForSessionsFn`, defaulting to
  the real `loadAttendanceForSessions`.
- The dialog loads attendance for **its one session only** (`[session.id]`), when it opens.
- While that load is in flight or if it fails, **fall back to the current RSVP-only seeding** rather
  than blocking the dialog or showing an error. A coach must never be prevented from closing a day
  because a convenience read failed. Disclose this choice in the module doc.

**Forbidden:** changing `onMarkComplete`/`MarkDayCompletePayload`'s shape, touching
`loaders/endMeeting.ts`, touching any migration, or changing `AttendancePanel`'s props.

---

## 5. Acceptance criteria — each with the production-code mutation that must turn it red

State the mutation you ran and paste the real red output. **A criterion whose mutation leaves the
suite green is not evidence — report that instead of shipping it.**

- **C1** Session with a recorded **attending** row for a student who has **no RSVP**: that student
  starts **checked**, and the confirm button does **not** read `0 attended`.
  *Mutation: revert seeding to RSVP-only.* (This is the owner's exact screenshot.)
- **C2** Session with a recorded **`absent`** row for a student who **RSVP'd `going`**: that student
  starts **unchecked**. *Mutation: make the attendance branch fall through to the RSVP rule.*
- **C3** Session with **no attendance rows at all**: behaviour is exactly as today — `going`
  RSVPs start checked. *Mutation: ignore RSVPs entirely in the fallback.*
- **C4** `loadAttendance` **rejects**: the dialog still opens and still seeds from RSVPs; no error
  surface, no blocked confirm. *Mutation: let the rejection propagate.*
- **C5** No RSVP row **and** no attendance row → unchecked. *Mutation: default to checked.*
- **C6** `loadAttendance` is called with **exactly this session's id** and nothing else. Assert on
  the spy's argument. *Mutation: pass every session id the dialog can see.*

`container.textContent`, never `innerHTML`. Pair presence with absence where both are meaningful.

---

## 6. The harness trap — read this before touching the test file

This project has now hit the same seam three times: **`DashboardPage.test.tsx:39-42` and
`OutreachList.test.tsx:158-165` both document, verbatim, that adding a defaulted loader prop makes
existing tests reach the real Supabase client**, which rejects with `.env.local` absent and lands
the component in an error state.

**Adding `loadAttendance` to this dialog will do the same thing to every existing test that renders
it** — in `MarkDayCompleteDialog.test.tsx` **and** in `OutreachDetail.test.tsx`, which mounts the
real dialog since T179.

Before you write anything: run both files, record the passing counts, and **pin them back to those
counts** by injecting a fake `loadAttendance` at every affected call site. Report the before/after
counts explicitly. Do not weaken or delete an existing assertion to make a count match — if you find
yourself editing what a test asserts, stop and file a dispute.

---

## 7. Gates — all six, `.env.local` ABSENT, report every one

```
npx tsc --noEmit                 (expect exit 0)
npx vite build                   (expect success)
npm run format:check             (expect clean)
npx eslint .                     (0 errors; report the warning count, explain any rise)
npx vitest run                   (base 72 files / 1744 tests; report new totals)
npx vitest run src/pages/outreach/MarkDayCompleteDialog.test.tsx >/dev/null 2>&1; echo $?
npx vitest run src/pages/outreach/OutreachDetail.test.tsx >/dev/null 2>&1; echo $?
```

Both targeted exits must be `0`. A gate omitted from your report is treated as not run. **A green
pass count with a nonzero exit code is a real failure on this project and has bitten a task here
before.**

---

## 8. Allowed files

- `src/pages/outreach/MarkDayCompleteDialog.tsx`
- `src/pages/outreach/MarkDayCompleteDialog.test.tsx`
- `src/pages/outreach/OutreachDetail.test.tsx` (fake injection only — no production change)
- `docs/swarm/active/T305-worker-output.md` (create — evidence doc)

Everything else Forbidden, including `OutreachDetail.tsx` itself, `AttendancePanel.tsx`,
`loaders/endMeeting.ts` and all migrations. If you conclude `OutreachDetail.tsx` must change, file a
dispute rather than changing it.

Work in your own git worktree (item 23); do not move the shared checkout's HEAD. **Do not commit a
`node_modules` symlink** — one reached `main` tonight exactly that way and needed a revert PR. Stage
with explicit pathspecs, never `git add -A`.

Commit to `claude/t305-attendance-over-rsvp`, push, report the SHA, and include a
"Deferred — for the ledger" section (item 20). You do not self-certify.
