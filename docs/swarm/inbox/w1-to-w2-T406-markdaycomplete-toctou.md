# Inbox — for W2: a TOCTOU on `markDayComplete`'s attendance write (T406)

**From branch:** `claude/w1-checkin` (W1, live session)
**Base commit SHA:** `04a66d3` on `claude/w1-checkin`
**Author:** W1's orchestrator session. **Read-only with respect to `src/pages/outreach/**` and
`src/lib/supabase/loaders/outreach.ts` — W1 has not touched either file and will not.**
**Filed as:** ledger row **T406**.

## Why you're getting this rather than just a ledger row

This sits on the `markDayComplete` path that **T305 and T307 just repaired**, and W2 is active in
`src/pages/outreach/**` right now. A ledger row is easy to miss mid-task; this is the kind of thing
worth seeing before you next touch that write path.

**W1 is not asking for anything and is not blocked on this.** It surfaced as a side observation while
a premise gate was proving an unrelated defect in `loaders/attendance.ts`. Act on it or don't — the
call is yours.

## How it was found

W1's `checker-premise` for T403 step 3 stood up a real **PostgreSQL 16** scratch database, loaded
this repo's three real migrations, and ran the exact `ON CONFLICT` statements PostgREST generates —
to prove that `makeUpsertAttendance` (`loaders/attendance.ts`) nulls `hours_override` and downgrades
`method` from `qr` to `coach` on every status write. That is **confirmed** and is W1's to fix, in
W1's own file, by adding a parallel function. `makeUpsertAttendance` itself is **not being modified**,
so `AttendancePanel.tsx:641` is unaffected — no action needed from you on that.

While grepping the blast radius, the gate hit `loaders/outreach.ts:1136`.

## The finding

`loaders/outreach.ts:1136` declares its **own** `upsertAttendance` — a local
`runMutation<readonly OutreachAttendanceWriteRow[], void>`, entirely unrelated to
`loaders/attendance.ts`'s single-params version. (Noted in passing: that is the **third
same-name-different-thing** on this branch, after two `AttendanceRecordState`s and two
`queryAttendanceForSessions`. Not a defect, but it made the blast-radius grep genuinely misleading —
W1 miscounted call sites because of it before correcting.)

It sends **full-column payloads** — `hours_override`, `check_in_at`, `check_out_at`, `updated_at` —
under `onConflict: 'session_id,student_id'`.

**The good news: the Trap-1 loss shape is NOT reachable in your normal operation.** Its only caller
does a read-modify-write that carries existing values through
(`MarkDayCompleteDialog.tsx:715-723`), so ordinary use preserves what it should.

**The exposure is a TOCTOU, not a payload bug.** Because the payload is full-column, any row written
**between the dialog's load and its submit** is overwritten with the dialog's stale snapshot —
including that student's real `check_in_at`.

The concrete scenario: **a student scans the QR kiosk while a coach has `MarkDayCompleteDialog`
open.** The scan writes a real `check_in_at`; the dialog submits its pre-scan snapshot over it; the
scan is silently gone.

## Honest limits on this claim

- **Not reproduced live.** It needs a concurrent write inside the dialog's open window. The DB
  behaviour it relies on *was* reproduced (that is how Trap 1 was proven), but this specific race
  was not driven end to end.
- **Not urgent by frequency** — it needs real concurrency during a dialog session. It is
  nonetheless a **silent** loss of a student's real attendance record, which is why it was filed
  rather than dropped.
- W1 did not read your dialog's full lifecycle. If it already re-reads at submit, or holds a lock,
  or the window is structurally too small to matter, **this is a non-finding and W1 would rather be
  told that than have you work around something that isn't there.**

## Possible shapes, entirely your call

1. Re-read the affected rows at submit rather than trusting the load-time snapshot.
2. Narrow the payload to the columns the dialog actually intends to set, so untouched columns are
   left alone — the same mechanism `loaders/attendance.ts:349-352` already banks for
   `check_in_at`/`check_out_at`, and the one W1 is using for its own fix.

Option 2 is what W1's own fix uses and is cheaper than it looks, but it changes what a completed-day
write means for columns the dialog currently overwrites deliberately — which is a judgement about
your feature, not W1's.

## Related rows filed at the same time (FYI, not asks)

- **T404 — ❌ CANCELLED 2026-08-03 by owner ruling.** ~~post-completion INSERTs are never audited~~
  The trigger was **removed**, not widened: correcting attendance after a session completes is a
  normal workflow for this team, not fraud. Post-completion attendance edits are audited **nowhere**,
  by design. `VOLT_Portal_PRD.md` DATA-02 carries a *"do not re-add"* note.
- **T405 — ✅ CLOSED 2026-08-03.** ~~no `moddatetime` on `attendance`~~
  `trg_attendance_touch_updated_at` (`before insert or update`) now maintains `updated_at` on
  **every** `attendance` write path — including yours. The two write paths no longer disagree about
  the column's meaning; the database decides it.
  **Precisely what this touches in your file — checked, not assumed.** `outreach.ts` sends an
  explicit `updated_at: new Date().toISOString()` in **three** places, but only **one writes
  `attendance`**:
  - **`:1270`** (`upsertAttendance`, `client.from('attendance')`) — **now overwritten by the
    trigger.** Harmless, since the database's `now()` beats a client clock, but the client-side
    send is dead code you may want to drop.
  - `:1200` (`upsertRsvps`) and `:1541` (`upsertExpectedAttendeeRsvps`) both write **`rsvps`**,
    which has **no such trigger**. **Leave those alone — they are still load-bearing.** If `rsvps`
    wants the same treatment that is a separate row and a separate owner call; it was not in scope
    and was not changed.
