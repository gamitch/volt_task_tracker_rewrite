# T305 — the mark-complete dialog must seed from, and preserve, recorded attendance

**Packet v2.** v1 (commit `0525378`) was stopped by the premise gate and is superseded in full.
Read §0 before anything else: v2 exists because v1's fix, applied as written, would have destroyed
the very rows it was meant to respect.

**Branch:** `claude/t305-attendance-over-rsvp` (off `main` = `1aede0c`)
**Worker tier:** sonnet. None of constitution item 18's four triggers fire — no migration, no RLS,
no `security definer`, no metric-view SQL, no auth/role/permission logic. The complexity here is a
write-preservation matrix and one async seam, both fully covered by criteria below.
**Checker:** `checker-reviewer` (opus) — this is a write path that can destroy recorded attendance.
**Scope note:** this packet is the **dialog half only**. The Signups-display half of the owner's
ruling is **T306** and is explicitly out of scope. Do not touch `OutreachDetail.tsx`'s Signups
section.

---

## 0. Why there is a v2 — read this first

v1 said: seed the checklist from `attendance` instead of RSVPs, and it called the change safe. Both
halves of that were wrong in a way that matters.

**v1's safety claim cited the wrong loader.** It quoted
`.upsert(..., { onConflict: 'session_id,student_id', ignoreDuplicates: true })` from
`loaders/endMeeting.ts` (`makeOnEndMeeting`'s `backfillAbsences`, `:377-386` — that citation is
accurate) and concluded no existing row can be overwritten. But `endMeeting.ts` is T178's
**meetings** backend. It is not this dialog's write path and never has been.

**This dialog's actual write path destroys data.** `MarkDayCompleteDialogProps.onMarkComplete`
defaults to `markDayComplete` (`loaders/outreach.ts:1200`), built by `makeMarkDayComplete`
(`:1125`). Its `upsertAttendance` names `check_in_at`, `check_out_at`, `hours_override`, `method`
and `recorded_by` in the payload and passes **`{ onConflict: 'session_id,student_id' }` with no
`ignoreDuplicates`** (`:1150`) — a full-column overwrite of any existing row. Feeding it
`buildAttendanceWriteRows`' output (`MarkDayCompleteDialog.tsx:489-505`), which hardcodes
`status: 'present'`, `checkInAt: null`, `checkOutAt: null`, `method: 'coach'` and takes
`hoursOverride` from a map `resetForm` empties on every open, overwrites a real recorded row with
nulls and `'coach'`.

**Today that is harmless only by accident** — no student with recorded attendance ever *starts*
checked, so no row is ever emitted for them. **Making them start checked, which is the entire point
of the owner's ruling, converts an accident-of-safety into the default path.** The gate measured it:
a student recorded `present` / 3 h / `qr` displayed **7 h**, totalled **14 h** against a true 10 h,
and confirming wrote `{hoursOverride: null, checkInAt: null, checkOutAt: null, method: 'coach'}`.

So this task is two changes, not one: **seed from recorded attendance, and carry recorded
provenance through the write.** Doing the first without the second is worse than shipping neither.

---

## 1. The defect the owner reported

On a session that already has recorded attendance and hours, "Mark day complete" opens with **every
student unchecked** and its confirm button reads **"Mark complete — 0 attended · 0 h"**. The owner's
screenshot shows `George-Student` with a ticked attendance row and 3 h in the panel directly below,
while the dialog above it says nobody attended.

Cause: `computeInitialAttendedStudentIds` (`MarkDayCompleteDialog.tsx:442-453`) seeds the checklist
from **`rsvps` with `status === 'going'` only**. It never reads `attendance`. A coach who recorded
attendance directly in the panel, without anyone RSVPing, gets a dialog that misdescribes the
session it is about to complete.

---

## 2. Owner ruling

**"show attendance for T305"** — given 2026-07-31, recorded (late, with the process failure
attached) in `docs/swarm/auto-mode-decisions.md`, section **"2026-08-01 — George's ruling on T305:
show attendance (recorded late; see the process note)"**. That section is the record; this packet is
not. If you need the exact scope of what was authorized, read it there.

Applied here: the checklist reflects **what was actually recorded**, falling back to RSVP intent
only where nothing was recorded.

**Explicitly NOT authorized: writing `rsvps` rows from attendance.**
`OutreachList.tsx:1685-1687` records the reason, from a checker's rework of T121: *"RSVP is intent,
not a real attendance record."* Synthesising a `going` RSVP would claim a student said yes in
advance when they never responded. **Attendance and RSVP stay separate records; only the display
changes.**

---

## 3. Where the recorded rows come from

`OutreachDetail.tsx` does not hold attendance rows — `AttendancePanel` loads its own, via
`AttendancePanelProps.loadAttendance?: LoadAttendanceForSessionsFn` defaulting to the real
`loadAttendanceForSessions` (`AttendancePanel.tsx:560`, `:570`, `:640`). **Do not lift that state
into `OutreachDetail` and do not add a competing load there.**

Give `MarkDayCompleteDialog` the same seam:

- `MarkDayCompleteDialogProps` gains `loadAttendance?: LoadAttendanceForSessionsFn`, defaulting to
  the real `loadAttendanceForSessions` (`loaders/attendance.ts:228`, `:266`). This is the
  established real-default-injectable-for-tests convention (`onMarkComplete = markDayComplete` in
  this same props interface; `AttendancePanel`'s three seams) — **it is not the placeholder-default
  family T151/T179 closed**, and it must not be made a required prop. Making it required forces a
  production change to `OutreachDetail.tsx`, which is Forbidden here.
- The dialog loads **its one session only**: `loadAttendance([session.id])`.
- **Shape to mirror:** `useAttendanceLoadState` (`AttendancePanel.tsx:528-554`) — `let isMounted`
  guard, `.then`/`.catch`, cleanup sets `isMounted = false`. Copy that discipline; you do not need
  its `retryToken` or its three-state union.
- **Use `.catch(...)`, never `void`.** T179 measured `void reloadDetail()` leaving a suite at
  **exit 1 with 86 tests green** — `void` discards a promise's *value*, not its *rejection*.

**On failure or while in flight, fall back to the current RSVP-only seeding.** No error banner, no
blocked confirm, no spinner over the checklist. A coach must never be prevented from closing a day
because a convenience read failed. Disclose the choice in the module doc.

---

## 4. The seeding rule

Add a **new exported pure function** — suggested name `computeInitialFormSeed`; the name is yours,
the properties are not:

```
computeInitialFormSeed(
  sessionId, roster, rsvps,
  recordedRows: readonly AttendanceRow[] | null,
) => { checkedStudentIds: string[]; hoursOverrideByStudentId: Record<string, number> }
```

- `recordedRows === null` (not loaded yet, or the load failed) → `checkedStudentIds` is exactly
  `computeInitialAttendedStudentIds(sessionId, roster, rsvps)` and the hours map is `{}`.
- Otherwise, per roster student, resolve the row for `(sessionId, studentId)`:
  1. **A row exists** → checked iff `isAttendingStatus(row.status)`. If checked and
     `row.hoursOverride !== null`, the map carries that value.
  2. **No row** → checked iff a `going` RSVP exists for this session (today's rule).
- **Filter by `sessionId` inside the function.** Do not trust the caller to have passed only this
  session's rows.

A recorded `absent` row therefore starts **unchecked** even when the student RSVP'd `going`.
Recorded truth beats stated intent — that is the ruling.

**`computeInitialAttendedStudentIds` stays exported and behaviourally unchanged.** It is the
fallback branch and it is directly tested. Do not delete it and do not fold it into the new
function's body in a way that changes its semantics.

**`isAttendingStatus` is imported from `./AttendancePanel` (`AttendancePanel.tsx:308`), not
re-derived.** Which statuses count as attending is a semantic decision with exactly one owner.
Verified for you: `AttendancePanel.tsx` imports only `react`, `@astryxdesign/core` and
`../../lib/supabase/loaders/attendance` (lines 213 / 214-227 / 228-237), so this import creates no
cycle. **Deliberately not chosen:** moving the predicate down into `loaders/attendance.ts` beside
`AttendanceStatus`. It is arguably its better home, but it means editing `AttendancePanel.tsx` and
its test's import surface for zero behavioural gain. If `tsc` or vitest reveals a cycle anyway, file
a dispute — do not copy the predicate.

### Applying the seed without clobbering the coach

The dialog is already open and interactive while the load is in flight, so the coach can act first.

- **Hours map:** merge with the coach's own edits winning —
  `setHoursOverrideByStudentId(prev => ({ ...recordedOverrides, ...prev }))`. At open `prev` is
  `{}`, so recorded values win; anything the coach typed is in `prev` and survives.
- **Checklist:** needs an explicit guard, because "the coach unchecked everyone" and "the coach did
  nothing" are both observable as a plain array. Track a single `useRef(false)`, set true by the
  `CheckboxList`'s `onChange` and by `setStudentHoursOverride`, cleared in `resetForm`. Apply the
  recorded `checkedStudentIds` **only** if the dialog is still open, still on the same session, and
  that ref is false.

**The guard governs the checklist only.** The loaded rows are still used for write preservation in
§5 whether or not the seed was applied — a coach's checkbox decisions are theirs, a recorded row's
provenance is not the coach's to silently erase.

---

## 5. The write rule — the half v1 was missing

`buildAttendanceWriteRows` gains a **required** fifth parameter carrying the loaded rows (a
`Readonly<Record<string, AttendanceRow>>` keyed by student id, or the array plus an internal
lookup — your call). **Required, not optional**: this is T151/T179's mechanism, and a call site that
forgets the recorded rows is precisely the bug this task exists to prevent. It must not compile.

Per checked student, with `existing` = that student's loaded row (may be absent):

| field | rule |
|---|---|
| `status` | `existing !== undefined && isAttendingStatus(existing.status) ? existing.status : 'present'` — a recorded `'late'` stays `'late'`; a recorded `'absent'` the coach deliberately checked becomes `'present'` |
| `checkInAt` | `existing?.checkInAt ?? null` |
| `checkOutAt` | `existing?.checkOutAt ?? null` |
| `hoursOverride` | `hoursOverrideByStudentId[studentId] ?? existing?.hoursOverride ?? null` |
| `method` | `resolveAttendanceWriteMethod(existing?.method ?? null)` (`loaders/attendance.ts:218-222`) — **never** a hardcoded `'coach'` |
| `recordedBy` | `currentUserProfileId`, **unchanged** |

**`recordedBy` staying the acting coach is deliberate, not an oversight.**
`UpsertAttendanceParams.recordedBy`'s own doc (`loaders/attendance.ts`, in the interface above
`makeUpsertAttendance`) states it is *"always the ACTING coach's own `profiles.id` … always
re-attributed to whoever is editing right now, even when `method` itself is preserved as `'qr'`"*,
and `AttendancePanel` does exactly that on both its write paths (`:718`, `:791`). W4 exists to pin
this so a later reader does not "fix" it.

**A student with no recorded row must be written exactly as today.** That is what makes the
preservation branches provable rather than vacuous.

**Precedent for the whole matrix:** `AttendancePanel.handleToggle`'s check path (`:712-718`) and
`commitHoursOverride` (`:785-791`) already delegate the method decision to
`resolveAttendanceWriteMethod` with the loaded row's `method`. You are applying an in-repo pattern
to a third call site, not inventing one.

**Forbidden:** changing `MarkDayCompletePayload`'s or `AttendanceWriteRow`'s field shape, touching
`loaders/outreach.ts`, touching `loaders/endMeeting.ts`, touching `AttendancePanel.tsx`, touching
any migration.

---

## 6. Module-doc claims this change makes false

A false claim in a module doc has the same reach as one in a packet and nothing gates module docs —
this project has paid for that three times. **Every item below must be corrected in the same
commit.** Leaving one is a MAJOR.

| Location | The claim, and what it becomes |
|---|---|
| `:82` (module doc #2) | `check_in_at`/`check_out_at` *"both always `null` here"* — no longer true for a preserved row. |
| `:104-107` (module doc #2(a)) | *"this dialog never collects check-in/check-out timestamps at all"* — it still never **collects** them, but it now **carries** them. Say which. |
| `:121-140` (module doc #2(c)) | The whole constitution-item-3 argument that the local sum cannot diverge from MET-03 rests on this dialog always writing null timestamps. **That guarantee is now genuinely weaker — see §7.** Rewrite it honestly; do not delete it. |
| `:242-253` (module doc #6) | *"`computeInitialAttendedStudentIds` … is the ONE place the checklist's starting state is derived"* — it becomes the RSVP **fallback** branch. Name the new function as the entry point. |
| `:398-400` | `AttendanceWriteRow.checkInAt`'s *"Always `null` here"* field comment. |
| `:439-441` | `computeInitialAttendedStudentIds`' own doc comment. |
| `:484-487` | `buildAttendanceWriteRows`' *"Always `status: 'present'`, `method: 'coach'`, `checkInAt`/`checkOutAt: null`"*. |
| `:4-10` | The OUT-05 quotation (*"pre-checked from `going` RSVPs"*). **Leave the PRD text verbatim** — constitution non-negotiable. Add an annotation below it recording that the owner's 2026-07-31 T305 ruling supersedes the RSVP-only reading, and cite `auto-mode-decisions.md`. Do not edit the quote. |

---

## 7. Two consequences you must disclose, and must NOT try to solve here

**(a) The confirm label can now legitimately disagree with `v_student_hours`.**
`20260717000003_metric_views.sql:7-14` is `coalesce(hours_override, «clamped check_out − check_in
when both non-null», «session duration»)`. Preserving real check-in/check-out timestamps means
tier 2 can now fire for a row this dialog writes, while
`computeTotalHoursForCheckedStudents` still shows `hoursOverride ?? sessionDuration`. So for a
QR-checked-in student with **no** override, the button's total can differ from what SQL will
compute.

This is strictly better than today, where the number agrees *because the write destroys the
timestamps*. **Do not close the gap by computing the clamped span in TypeScript** — selecting
between MET-03's tiers in TS is exactly the re-derivation constitution item 3 makes a BLOCKER, and
module doc #2(a) already says this file does not do it. Disclose it in the rewritten #2(c) and in
your "Deferred — for the ledger" section.

**(b) `makeMarkDayComplete`'s upsert is destructive by construction, and this task only contains
it.** `makeUpsertAttendance` (`loaders/attendance.ts:293-327`) deliberately omits
`check_in_at`/`check_out_at` from its payload — its own doc names this as the history-preservation
mechanism, since Postgrest's `ON CONFLICT DO UPDATE SET` only touches columns present in the
payload. `makeMarkDayComplete` includes them. After this task the dialog always supplies real
values, so the risk is contained — but any future caller of `markDayComplete` inherits the
destructive default. **Out of scope. Report it; do not fix it.** Both (a) and (b) are already known
to the orchestrator and will be filed as ledger rows — note them and move on rather than
re-diagnosing.

---

## 8. Acceptance criteria

Each names the production-code mutation that must turn it **red**. State the mutation you ran and
paste the real red output. **A criterion whose mutation leaves the suite green is not evidence —
report that instead of shipping it.** Use `container.textContent`, never `innerHTML`. Pair presence
with absence wherever both are meaningful.

### Seeding and display

- **S1** — Recorded **attending** row for a student with **no RSVP**: that student starts
  **checked**, and the confirm button does **not** read `0 attended`. *(The owner's exact
  screenshot.)* **Mutation:** revert seeding to RSVP-only.
- **S2** — Recorded **`absent`** row for a student who RSVP'd **`going`**: starts **unchecked**.
  **Mutation:** make the attendance branch fall through to the RSVP rule.
- **S3** — Loader resolves **`[]`**: behaviour is exactly as today — `going` RSVPs start checked.
  **Mutation:** ignore RSVPs entirely in the fallback.
- **S4** — Loader **rejects**: the dialog still opens, still seeds from RSVPs, shows **no** error
  surface, and the confirm button is **not** disabled. **Mutation:** let the rejection propagate
  (drop the `.catch`). Also assert the suite's **exit code**, not just the pass count — an
  unhandled rejection is the T179 failure shape.
- **S5** — No RSVP **and** no recorded row → **unchecked**. **Mutation:** default to checked.
- **S6** — `loadAttendance` is called with **exactly `[session.id]`** — assert on the spy's
  argument. **Mutation:** pass `rsvps.map(r => r.sessionId)` instead. *This requires a fixture whose
  `rsvps` span at least two session ids; the live call site passes the page's unfiltered array, so
  that fixture is realistic, not contrived.*
- **S7** — A row for a **different session** in the returned array does not seed this dialog. Test
  the pure function directly with a mixed array. **Mutation:** drop the `sessionId` filter.
- **S8** — Rows arriving **after** the coach has already changed the checklist do **not** clobber
  the coach's edits; rows arriving before it do apply. **Mutation:** delete the touched-ref guard.
- **S9** — Recorded attending row with `hoursOverride: 3` on a **7 h** session: that student's hours
  input shows **3**, and the confirm total counts **3**, not 7. **Mutation:** seed the hours map as
  `{}`. *(This is the 7 h / 14 h figure the gate measured.)*

### Write preservation

- **W1** — Payload for a student recorded `late` / `qr` / `hoursOverride: 3` / both timestamps set,
  confirmed untouched, carries **all five** through: `status: 'late'`, `method: 'qr'`,
  `hoursOverride: 3`, and the exact `checkInAt`/`checkOutAt` strings. **Five separate mutations**,
  one per field, each reported: hardcode `'present'`; hardcode `'coach'`; `?? null` for the
  override; `checkInAt: null`; `checkOutAt: null`.
- **W2** — A checked student with **no** recorded row is written exactly as today: `status:
  'present'`, `checkInAt`/`checkOutAt` `null`, `method: 'coach'`, `hoursOverride` from the map or
  `null`. **Mutation:** let any preservation branch leak into the no-row case (e.g. drop the
  `existing !== undefined` guard on `status`).
- **W3** — Coach types **5** over a recorded **3** → payload carries **5**. **Mutation:** prefer the
  recorded value over the coach's. *(Pairs with W1's override arm; neither is vacuous alone.)*
- **W4** — A recorded `absent` row the coach deliberately checks is written `status: 'present'`, and
  `recordedBy` is the **acting coach's** `currentUserProfileId` even though `method` is preserved as
  `'qr'`. **Mutation:** `recordedBy: existing?.recordedBy ?? currentUserProfileId`.

### Integration

- **I1** — Through the real `OutreachDetail` mount: with
  `mockedLoadAttendanceForSessions` resolving one recorded attending row, opening "Mark day
  complete" shows that student checked. **Mutation:** revert the dialog's seeding to RSVP-only.
  *This is the only proof the seam is actually reached in production wiring — see the trap in §9.*

---

## 9. The harness — v1 got this backwards, so read it before touching either test file

**Measured at `9c34f6a`, `.env.local` absent:** `MarkDayCompleteDialog.test.tsx` **26 tests**,
`OutreachDetail.test.tsx` **94 tests**. Pin both back to those counts plus whatever you add, and
report before/after explicitly.

**`OutreachDetail.test.tsx` is already immune, and v1 was wrong to say otherwise.** It already
partial-mocks the attendance loader at `:110-118` with
`loadAttendanceForSessions: vi.fn(async () => [])`, exposed as `mockedLoadAttendanceForSessions`
(`:120`). A resolved `[]` means "no recorded rows" → RSVP fallback → existing behaviour. Expect
**zero** new failures there and make **no** production change to `OutreachDetail.tsx`.

**`MarkDayCompleteDialog.test.tsx` is where the trap actually is.** It has **no `vi.mock` at all**
and renders the dialog at ~13 sites without any loader override. Adding a real-defaulted
`loadAttendance` makes every one of them call the real Supabase client, which rejects with
`.env.local` absent. Because §3's fallback is *graceful*, those tests will still **pass** — while
leaking a post-teardown async setState into the next test. **A green count here does not mean you
handled it.** Add a partial-mock factory mirroring `OutreachDetail.test.tsx:110-118`; override
per-test with `mockResolvedValueOnce` / `mockRejectedValueOnce`.

**The trap inside the trap:** a spy or mock that never intercepts, and a load that resolves to no
rows, are **indistinguishable** under a graceful fallback. So S6 and I1 must assert the mock was
**called**, with the right argument — not merely that the dialog still renders. `vi.mock` is proven
to intercept a default-parameter module reference *in this exact file pair*:
`OutreachDetail.test.tsx:144-151` mocks `markDayComplete` and `:1185` asserts the dialog's own
default `onMarkComplete` reached it. Use that, not T180's `vi.spyOn`-on-namespace workaround, which
was for a different (module-level, non-prop) reference.

### Existing tests you are authorized to change — and only these

Four tests in `describe('buildAttendanceWriteRows …')` call it with **four** arguments and must gain
the fifth (`:255`, `:270`, `:276`, `:281`). With an empty recorded-rows argument all four keep
passing unchanged — **add the argument, do not touch the assertions.**

Two of their **titles** become over-broad claims and must be narrowed to name the no-recorded-row
case:

- `:255` *"writes status 'present' and method 'coach' for every checked student, never anything
  else"*
- `:270` *"never writes check_in_at/check_out_at (module doc #2(c) …)"*

**That is the complete list of authorized changes to existing tests** (constitution: existing tests
pass unless a test update is explicitly approved — this is that approval, scoped to these six lines
and nothing else). If you find yourself weakening, deleting, or retargeting any other existing
assertion to make something green, **stop and file a dispute.**

---

## 10. Gates — all six, `.env.local` ABSENT, report every one

Baseline measured at `9c34f6a` in the shared tree: `tsc` **exit 0** · `vite build` **✓** ·
`format:check` **clean** · eslint **0 errors / 360 warnings** · vitest **72 files / 1746 tests**.

```
npx tsc --noEmit                 (expect exit 0)
npx vite build                   (expect success)
npm run format:check             (expect clean)
npx eslint .                     (0 errors; report the warning count and explain any rise)
npx vitest run                   (report new file/test totals against 72 / 1746)
npx vitest run src/pages/outreach/MarkDayCompleteDialog.test.tsx >/dev/null 2>&1; echo $?
npx vitest run src/pages/outreach/OutreachDetail.test.tsx >/dev/null 2>&1; echo $?
```

Both targeted exits must be `0`. A gate omitted from your report is treated as not run. **A green
pass count with a nonzero exit code is a real failure on this project and has bitten a task here
before.**

**Expected eslint delta:** each new *value* export from `MarkDayCompleteDialog.tsx` costs one
`react-refresh/only-export-components` warning — the pattern this file already carries many times
over (T179 measured +1 for one export, T303 the same, 359→360). A rise equal to your new value
exports is expected; anything beyond that must be explained. Zero errors either way.

---

## 11. Allowed files

- `src/pages/outreach/MarkDayCompleteDialog.tsx`
- `src/pages/outreach/MarkDayCompleteDialog.test.tsx`
- `src/pages/outreach/OutreachDetail.test.tsx` (test-only — I1 and any needed mock setup)
- `docs/swarm/active/T305-worker-output.md` (create — evidence doc)

Everything else is Forbidden, including `OutreachDetail.tsx`, `AttendancePanel.tsx`,
`loaders/outreach.ts`, `loaders/attendance.ts`, `loaders/endMeeting.ts` and all migrations. If you
conclude one of them must change, **file a dispute rather than changing it.**

Work in your own git worktree (constitution item 23); do not move the shared checkout's HEAD. **Do
not commit a `node_modules` symlink** — one reached `main` this week exactly that way and needed a
revert PR. Stage with explicit pathspecs, never `git add -A` (item 22).

Commit to `claude/t305-attendance-over-rsvp`, push, **report the commit SHA** (item 21 — "clean" and
"committed" are different claims), and include a **"Deferred — for the ledger"** section (item 20)
carrying at minimum §7(a) and §7(b). You do not self-certify (item: no worker marks its own work
complete).
