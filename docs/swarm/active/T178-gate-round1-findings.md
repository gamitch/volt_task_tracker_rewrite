# T178 — premise gate round 1 (actionable findings, verbatim where it matters)

**Gate:** general-purpose agent with Write+Edit, 2026-07-31, measured at `accc692`.
**Verdict:** REVISE — 3 BLOCKER, 3 MAJOR, 4 MINOR. **Round 2 of 2 remains available** (item 19a).

It built a reference `endMeeting.ts` + test + LiveConsole mount exactly as §2/§5 prescribe
(17 tests green, `tsc` clean, eslint 0 errors), then ran a mutation battery. **11 of 17
criteria discriminate as claimed.** Recorded here so revision 2 is not written from a summary.

## OWNER DECISION — the task is split

The owner was shown BLOCKER 3 and ruled: **proceed with the loader build, park the mount.**
Revision 2 covers the build half only. The mount is filed as its own blocked row.

## BLOCKER 3 — mounting on a fixture-backed console is a data-loss path (→ the split)

Every link verified in-file:

- `LiveConsole.tsx:510-511` — `notWiredSetAttendanceStatus` is an **intentional no-op**; the
  console's attendance marking never reaches the database. Its module doc (`:130-132`) says so.
- `defaultLoadLiveConsoleData` (`:592`) is a fixture; the QR panel carries a permanent Banner
  saying the code "isn't live yet".
- **So for a meeting actually run through `LiveConsole`, zero real `attendance` rows exist.**

A real End Meeting dialog on top of that loads the **real** roster, marks every member with no
row `absent`, and flips the session to `completed`. First real use: a coach marks 14 students
present, clicks End meeting, and the app writes **14 real `absent` rows**. Every subsequent
correction then trips `trg_audit_attendance_post_completion`, filling `audit_log` with rows
recording the coach fixing the app's own data loss.

Measured artifact of the split brain: one render carried the header's fixture title
*"Tuesday Build Meeting"* beside the dialog's real-loaded *"Robotics Shop Night"* — two
different meetings on one screen.

**This exceeds the packet's own standard** (*"a complete-looking flow that silently does
nothing is strictly worse than an honest banner"*): this is a complete-looking flow that does
something **wrong**. Item 25 excludes security from over-weighting, not data integrity.

## BLOCKER 1 — criterion 11 is vacuous against the exact defect it names

Mutation `M11` — hoist the identity read to factory-construction time:

```ts
const bakedOnce = getRecordedBy();          // was: inside the returned closure
return async (sessionId, studentId, status) => {
  const recordedBy = bakedOnce;             // was: getRecordedBy()
```

Criterion 11 as prescribed — two **separate factory instances** with two fixed stubs —
**passes under this mutation.** Measured side by side:

```
PROBE B1 (criterion 11 as prescribed: two factories)   ✓ passes under M11
PROBE B2 (one factory, identity changes between calls) × fails under M11
```

§3a specifies a **ref** so the closure "always reads the latest signed-in user" — i.e. the
value must change *within one instance*. Criterion 11 never tests that. **Fix: one factory,
`getRecordedBy` returning different values on successive calls.**

## BLOCKER 2 — criterion 5 cannot distinguish sequenced writes from concurrent ones

Mutation `M5b` — replace the three sequential `await`s with `Promise.all([...])`:

```
MUTATION: M5b-concurrent-promise-all
 ✓ src/lib/supabase/loaders/endMeeting.test.ts (17 tests) 17ms
      Tests  17 passed (17)
```

`runMutation` builds its PostgREST chain synchronously before its first `await`, so a recording
spy sees the same call order either way. Concurrent dispatch destroys the **only** guarantee the
design has — the flip can commit before the checkout UPDATE lands, the trigger fires, and every
checked-out student gets a spurious `attendance_edited_post_completion` row. Criterion 5 is the
packet's sole proof of the ordering constraint and it does not prove it.

**Fix: assert on *await* sequencing** — gate each stubbed table's resolution on a deferred
promise and assert call *N+1* has not been issued until call *N* resolves.

## MAJOR 1 — criterion 3 is unsatisfiable as written, and its mutation is vacuous

`is_active` is filtered **server-side** (`.eq('is_active', true)`, per the mandated `kiosk.ts`
precedent). A stubbed client returns whatever `data` you hand it, so no client-side filtering
happens. Written literally as prescribed:

```
× A1 (packet base assertion): only the active student appears
  AssertionError: expected [ 'stu-nia', 'stu-pia' ] to deeply equal [ 'stu-nia' ]
✓ A2 (packet mutation): flipping is_active:true makes them appear
```

The base assertion **fails against a correct implementation**; the mutation passes both before
and after. A worker following it literally will chase a phantom bug or add a redundant
client-side filter diverging from the mandated precedent. Contrast criterion 2: team-scoping
*is* client-side and genuinely discriminates.

**Fix: assert the `.eq('is_active', true)` argument was issued**, and state plainly that
server-side filters are argument-provable only.

## MAJOR 3 — criterion 9's "surfacing the injected error" is false

`runMutation` normalizes every rejection through `toLoaderError`. Measured:

```
REJECTION: {"code":"UNKNOWN","message":"Couldn't load this data. Check your connection and
try again.","cause":{"message":"flip exploded"}}  isError: false
```

The injected message survives only in `.cause`. A literal `rejects.toThrow('flip exploded')`
fails. Criterion 9's (a)/(b)/reject-ness are reachable — the *surfacing* claim is not.

## MINOR — the doc correction greps the wrong term

`grep RPC EndMeetingDialog.tsx` → **1 hit** (line 43). `grep -i transaction` → **7 hits**.
Lines 110/120/123 (module doc §2a, *"A real single-transaction implementation … in the same
transaction"*) are correctable but unnamed by §5 and invisible to an `"RPC"` grep. Lines
584/593 sit **inside a function**, which §5 explicitly forbids touching — so that false steer
**cannot be corrected under this packet at all**. Grep for `transaction`, and either widen §5's
allowance or disclose the residual.

## What held up — do not re-litigate

- **The ordering constraint is correct AND the stated reason is the true reason**, read from
  `20260717000001_support_audit.sql:120-157`: `after update on public.attendance`, with a live
  lookup of the session's status. Checkout is an UPDATE and must precede the flip or it
  self-mislogs. Backfill is `INSERT … ON CONFLICT DO NOTHING` — no UPDATE fires, order-independent.
  `grep "create trigger"` confirms this is the **only** trigger on `attendance` and there is
  none on `event_sessions`. **backfill → checkout → flip is right.**
- **A strength the packet undersells:** because the flip is last, every reachable partial state
  fails in the **safe** direction — write-2 failure leaves absences written and the session still
  `'scheduled'`, so no audit pollution and retry is a clean no-op. There is no ordering in which
  the flip lands and the checkout doesn't. **This is the actual justification for not needing an
  RPC** and should be stated as such.
- **All three reuse premises are true and sufficient — measured by wiring, not reading.**
  `makeLoadAttendanceForSessions(getClient)` (the DI sibling; the singleton has no client seam)
  returned exactly `{status, checkInAt, checkOutAt, method, recordedBy}` through
  `mapAttendanceDbRowToAttendanceRow`. The `kiosk.ts` roster pattern ported directly.
- **No migration is required.** `staff_all` on both `event_sessions` and `attendance` grants a
  coach full write; `attendance.recorded_by` is nullable and `unique (session_id, student_id)`
  exists, so the backfill shape and `onConflict` target are both legal. **The MIG-gate risk does
  not materialize.**
- Criterion 13 (no client-side `audit_log` write) — confirmed, zero occurrences. Criterion 10
  (idempotent retry) — passes; a second identical call re-issued all three writes unchanged.

## Partial-failure honesty — half true

Criterion 9's state is reachable, but what the coach actually reads is:

```
"Couldn't end this meetingSomething went wrong ending this meeting.Dismiss…"
```

Not the Postgres error, and **nothing about the partial state** — `runMutation` rejects with a
plain object so `error instanceof Error` is false and the generic fallback wins, and
`EndMeetingDialog.tsx` is frozen so the copy cannot be improved. §7 is accurate about the
database and silent about the disclosure. Given retry-safety and item 25 this is a MINOR, but
**say it in the module doc rather than implying the coach is told.**

## Not measured

Real Postgres behaviour under concurrent writes (no live DB — the ordering claim rests on the
SQL read, as the packet itself states). Whether the `checkin` Edge Function is deployed such
that real QR attendance rows could exist. `vite build` and `prettier --check` were not run.
