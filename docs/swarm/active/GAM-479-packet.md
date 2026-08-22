# GAM-479 — task packet (HEAVY, round 1)

Author: orchestrator (Claude dispatch run), 2026-08-22.
Base: `main` @ `00a22ac7`. Branch: `claude/gam-479-attendance-unset-preserve`.
Tier: **HEAVY** — item 26's "write path or destructive operation" trigger.

> **Gate note for `checker-premise`.** Attack §7 (Least confident decisions)
> first, per your charter §0 and constitution item 19d. §0 below is the whole
> reason this packet does not do what the issue asked for; if §0 is wrong,
> everything after it is wrong.

---

## §0 — What the issue got wrong, measured

GAM-479's core claim holds: the un-mark is an unconditional row `DELETE` and it
takes `check_in_at`, `check_out_at`, `hours_override`, `method` and
`recorded_by` with it, with no audit trail to recover them from. Four things it
says around that claim need correcting, and two of them close off remedies the
issue itself proposed.

**0a. The meetings chip does not exist on `main`.** `AttendanceChips.tsx` and
`SessionRow.tsx` live only on `origin/claude/gam-448-schedule-panel` — **PR
#234, still open**. On `main`, `src/pages/meetings/coach/SchedulePanel.tsx` is a
38-line stub returning `null`. No change to the chip can land from this branch.

**0b. But the destructive path IS live, on a surface the issue does not
mention.** `makeRemoveAttendance` has a second caller on `main`:
`src/pages/outreach/AttendancePanel.tsx:642` (default prop) and `:725` (the
uncheck branch of `handleToggle`), mounted staff-only by
`src/pages/outreach/OutreachDetail.tsx:290`. That panel *also owns the hours
`NumberInput`* (`:620-629`), so a coach can set `hours_override` there and
destroy it with the next click on the same row. The issue's "No user can reach
this today" is true of the *chip* and false of the *defect*.

**0c. "Preserving the row with a null status" is dead, for three independent
reasons.**

1. `attendance.status` is `text not null check (status in ('present','late',
   'excused','absent'))`
   (`supabase/migrations/20260717000000_scheduling_attendance.sql:86`) — it
   needs a migration.
2. T509/D014 defines *a row exists* as *an explicit mark exists*. The
   participation denominator is "(marks that exist) - (excused marks)"
   (`supabase/migrations/20260806000000_met01_explicit_marks.sql:117-130`,
   restated verbatim in
   `supabase/migrations/20260821000000_meetings_event_attendance_view.sql:193`).
   A null-status row is a row that exists, so it enters that denominator and
   changes every affected student's percentage. Constitution item 3 makes
   re-deriving that SQL a BLOCKER.
3. **It is a re-run of a branch the human owner personally removed.** This is
   the finding that decides the ticket. `attendance.ts`'s module doc #2
   (`:37-65`) records that T117 originally *did* preserve `check_in_at` by
   demoting a `qr`/`import` row to `'absent'` instead of deleting it, and that
   T119 removed it on **D-7, George's direct product-owner override, quoted
   verbatim in the file**: *"As coach I am ultimate authority and should be able
   to overwrite an RSVP or check-ins."* "Keep the row, drop the status" is that
   same rejected design wearing different clothes.

**0d. An undo is not free either, and the reason is the exact column the issue
leads with.** `makeUpsertAttendance` **deliberately never writes**
`check_in_at`/`check_out_at` — `attendance.ts:436-446` states this and gives the
reason (Postgrest's `ON CONFLICT DO UPDATE SET` only touches columns present in
the payload, which is how a coach status edit preserves check-in history). So an
undo assembled from today's seams would restore the status and the hours
override and **silently drop the QR check-in timestamp**. A real undo needs a
new write path.

**What survives.** Confirm dialog: ruled out (DES-11 `VOLT_Portal_PRD.md:219`
does not name an attendance un-mark; the issue rules it out; a confirm inside a
five-stop cycle makes the cycle untestable). Preserve-instead-of-delete: ruled
out by 0c. **Undo — capture the row the coach already holds, and restore it
exactly — is the only remaining option**, and it does not conflict with D-7:
D-7 grants the coach authority to remove a check-in, and an undo is that same
coach's own next action, not a guard placed over them.

---

## §1 — The change

Two parts. Neither adds a migration, neither touches metric SQL, neither
reverses D-7.

### P1 — new restore seam (`src/lib/supabase/loaders/attendance.ts`)

Add `RestoreAttendanceParams`, `RestoreAttendanceFn`, `makeRestoreAttendance`
and the module-level `restoreAttendance`, following the exact shape of the three
write factories already in the file (`runMutation` + `getClient` DI +
`.select().single()` + `mapAttendanceDbRowToAttendanceRow`).

It is the **one** write path in this file that writes `check_in_at` and
`check_out_at`, and its doc comment must say why that is not a violation of
module doc #3's omission rule: #3 governs a *coach edit*, where silence
preserves history; a restore is an *exact reinstatement of a row this app just
deleted*, where silence would lose the very history #3 protects.

Payload — every column the delete destroyed:

```
session_id, student_id, status, check_in_at, check_out_at,
hours_override, method, recorded_by
```

Written as an `.upsert(..., { onConflict: 'session_id,student_id' })`, matching
the two existing write factories, so the seam is not a fourth shape.

Do **not** change `makeRemoveAttendance`. It stays `Promise<void>`. The caller
already holds the row it is deleting (P2 below), so returning it would create a
second source of truth for the same value — see §7.2 for why this is the packet's
second least-confident call.

### P2 — undo on the live surface (`src/pages/outreach/AttendancePanel.tsx`)

In `handleToggle`'s uncheck branch (`:721-732`), `existing` at `:706` is already
the full committed `AttendanceRow` (`loadAttendanceForSessions` selects `*`).
After the delete succeeds, keep it in a new `undoableByKey` state map and render
an inline undo action in that row. Activating it calls `onRestoreAttendance`
with the captured row, puts the restored row back into `attendanceByKey`, and
clears the undo entry.

Constraints on the affordance, all binding:

- **No countdown, no timer, no auto-dismiss.** Constitution item 17 prohibits
  countdowns and urgency framing outright. The affordance persists until the
  coach uses it, re-checks the row, or the panel reloads. A silently-expiring
  undo is also a worse failure than a persistent one.
- **Copy follows DES-14…16** — sentence case, a named action. Use
  `Undo un-mark`, not `Undo`.
- **Item 12's four states are not weakened.** A failed restore surfaces through
  the row's existing `rowErrorByKey` path, and the undo entry survives the
  failure so the coach can retry.
- **Item 15 / DES-17.** The affordance is a real focusable control with an
  accessible name that names the student, in the same idiom the row already
  uses.

---

## §2 — Allowed Files

- `src/lib/supabase/loaders/attendance.ts`
- `src/lib/supabase/loaders/attendance.test.ts`
- `src/pages/outreach/AttendancePanel.tsx`
- `src/pages/outreach/AttendancePanel.test.tsx`

**Forbidden**, and each for its own reason:

- `supabase/**` — no migration is needed and none is authorized (§0c).
- `src/pages/meetings/**` — the target files are not on `main` (§0a); PR #234
  owns them, and two branches editing one file is what `WORKFLOWS.md`'s
  collision rule exists to prevent.
- `.github/workflows/**` — AGENTS.md wall 1; a dispatch run cannot push these.
- `docs/swarm/**`, `.claude/**`, `AGENTS.md` — orchestrator-owned.

## §3 — Acceptance criteria

Every criterion names the real source it is measured against (item 27).

1. `makeRestoreAttendance` writes **all eight** columns listed in §1 P1.
   Measured by asserting the captured upsert payload in
   `attendance.test.ts`, in the same stub idiom the file's existing
   `makeSetAttendanceStatus` block uses (`attendance.test.ts:308-400`).
2. `makeRestoreAttendance` uses `onConflict: 'session_id,student_id'` and
   resolves the written row through `mapAttendanceDbRowToAttendanceRow` —
   asserted on the returned object, not on the payload.
3. `makeRemoveAttendance`'s signature and behaviour are **unchanged**. The
   existing `makeRemoveAttendance` test block
   (`AttendancePanel.test.tsx:493-520`) passes untouched.
4. Unchecking a student in `AttendancePanel` still performs the unconditional
   DELETE, with no confirm and no branch on `method` (T119/D-7 intact).
   Existing tests for this must not be edited.
5. After that delete, an `Undo un-mark` control naming the student is present
   in that row, and it is a real focusable control.
6. Activating it calls the injected restore seam **once**, with `checkInAt`,
   `checkOutAt`, `hoursOverride`, `method` and `recordedBy` equal to the values
   the deleted row carried — asserted field by field, with a non-null
   `checkInAt` and a non-null `hoursOverride` in the fixture, because those two
   are the whole point of the ticket.
7. After a successful restore the row reads as checked again, the hours input
   shows the restored `hoursOverride`, and the undo control is gone.
8. A failing restore leaves the undo control in place and surfaces the error
   through the row's existing error path.
9. No countdown, timer, `setTimeout` auto-dismiss, or urgency copy anywhere in
   the affordance (item 17).
10. Fixtures use fabricated names, first name + last initial only (item 6).

## §4 — Mutations the worker must run and report red output for

Item 26: a passing test is not evidence until you have watched it fail. Commit
the fix first, mutate, capture the red, revert, re-verify green.

- **M1** — delete `check_in_at` from `makeRestoreAttendance`'s payload.
  Criterion 1 and criterion 6 must go red. This is the mutation that proves the
  suite guards §0d's finding rather than restating it.
- **M2** — make the undo control call the restore seam with `hoursOverride:
  null`. Criterion 6 must go red.
- **M3** — remove the undo control from the row. Criteria 5, 6 and 7 must go
  red.

## §5 — Verification

All six gates via the `gate-run` skill, exit codes reported verbatim. No piping
into `tail`/`grep`/`wc`.

## §6 — Follow-ups the orchestrator files (item 20), not the worker

- The meetings chip's own undo, blocked on PR #234 / GAM-452 — the chip cannot
  be edited from this branch (§0a), and the seam P1 adds is what it will use.
- Whether `makeRemoveAttendance` should return the row it deleted, if the chip
  turns out not to hold it (§7.2).

## §7 — Least confident decisions (item 19d)

1. **Including the outreach undo (P2) in GAM-479 at all.** The issue's subject
   is the meetings chip; I am delivering on a different surface because that is
   where the defect is reachable (§0b). *Wrong if* the owner scopes GAM-479 to
   the chip only — then P2 is its own row and this ticket ships P1 plus the
   decision record, which is a seam with no caller and a thin close.
2. **Not returning the deleted row from `makeRemoveAttendance`.** I am relying
   on the caller already holding it. *Wrong if* `SessionRow.tsx` on PR #234 does
   not hold the full row at un-mark time — then the chip's follow-up needs that
   capture, and this run should have added it while the file was open. I have
   not read `SessionRow.tsx` closely enough to rule this out; the gate should.
3. **`makeRestoreAttendance` as an upsert rather than a plain insert.** Upsert
   matches the file's other two write factories. *Wrong if* a concurrent write
   re-created the row between the delete and the undo: the upsert would then
   overwrite a **newer** mark with the stale captured one. A plain insert would
   fail loudly instead, which may be the safer failure for a restore
   specifically.
4. **A persistent undo rather than a bounded one.** Item 17 forbids countdowns,
   and I read a silently-expiring affordance as worse than a persistent one.
   *Wrong if* a stale `Undo un-mark` restoring a row much later is more
   confusing than the data loss it prevents.
5. **Reading D-7 as not foreclosing an undo.** I read *"As coach I am ultimate
   authority and should be able to overwrite an RSVP or check-ins"* as granting
   the coach power, so an affordance the same coach operates does not contradict
   it. *Wrong if* the owner meant the un-mark to be final and unsoftened — in
   which case GAM-479's correct close is **no change**, with §0's measurements
   recorded on the issue, and that is a legitimate outcome this run must be
   willing to take.
