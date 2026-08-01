# T305 — the mark-complete dialog must seed from, and preserve, recorded attendance

**Packet v4 — GATED, CLEARED FOR DISPATCH.** `checker-premise` round 2 of 2 returned **DISPATCH**
against v3 (`5726d90`) with findings attached; v4 folds every one of them in. v1 (`0525378`) and v2
(`232dacf`) were both REVISE. No further gate round — item 19a's cap is spent, and round 2's own
verdict was that its remaining findings are criterion-quality notes fixable inside the Allowed
Files, not false premises.

**Both gate rounds were run by an agent that BUILT the prescription in its own worktree.** Every
figure below marked "measured" was executed. Round 2 built the complete implementation and all six
gates came back green — `tsc` 0, `vite build` ✓, prettier clean, eslint 361, **73 files / 1757
tests exit 0** (its own scratch criteria file included). The prescription is known to work.

**Branch:** `claude/t305-attendance-over-rsvp` (off `main` = `1aede0c`)
**Worker tier:** sonnet. None of item 18's four triggers fire — no migration, no RLS, no
`security definer`, no metric-view SQL, no auth/role/permission logic. Confirmed by the gate.
**Checker:** `checker-reviewer` (opus) — a write path that can destroy recorded attendance.
**Scope:** the **per-day dialog only**. Two siblings are explicitly out of scope and already filed:
**T306** (the ruling's Signups half) and **T307** (the bulk "Mark event complete" path — see §0.2,
which you must read even though you will not fix it).

> **Everything in this packet marked "measured" was executed by the round-1 gate in an isolated
> worktree, or re-verified by the orchestrator at `232dacf`.** Where a figure is quoted, it was run.
> Do not re-derive them; do challenge them if your own run disagrees.

---

## 0. Why this packet took four revisions

### 0.1 The destructive-write premise is TRUE — confirmed by execution

`MarkDayCompleteDialogProps.onMarkComplete` defaults to `markDayComplete`
(`loaders/outreach.ts:1200`, built by `makeMarkDayComplete` `:1125`). The gate drove the real
loader over a stubbed transport and captured the actual payload at unmodified HEAD:

```
UPSERT PAYLOAD: {"session_id":"session-1","student_id":"student-1","status":"present",
                 "check_in_at":null,"check_out_at":null,"hours_override":null,
                 "method":"coach","recorded_by":"profile-acting-coach","updated_at":"…"}
UPSERT OPTS   : {"onConflict":"session_id,student_id"}
```

`check_in_at`/`check_out_at` **are** in the payload as `null`, and there is **no
`ignoreDuplicates`** (`:1150`), so Postgrest's `ON CONFLICT DO UPDATE SET` nulls them on any
existing row. `buildAttendanceWriteRows` (`MarkDayCompleteDialog.tsx:489-505`) hardcodes
`status: 'present'`, `checkInAt: null`, `checkOutAt: null`, `method: 'coach'`, and reads
`hoursOverride` from a map `resetForm` empties on every open.

**In this dialog** that is currently harmless only because no student with recorded attendance ever
*starts* checked, so no row is emitted for them. Making them start checked — the point of the
owner's ruling — turns an accident-of-safety into the default path. Hence: seed from recorded
attendance **and** carry recorded provenance through the write. Either without the other is worse
than neither.

### 0.2 The bulk path already destroys recorded rows today — NOT your task, but read it

v2 claimed only a *future* caller could inherit the destructive default. **That was wrong, and the
correction matters for how you scope your own change.**

`MarkEventCompleteDialog.buildMarkEventCompletePayload` (`MarkEventCompleteDialog.tsx:176-192`)
seeds from `computeInitialAttendedStudentIds` — i.e. **`going` RSVPs** — and feeds the result
straight into the same destructive `markDayComplete`, with an empty hours map:

```ts
const checkedStudentIds = computeInitialAttendedStudentIds(session.id, roster, rsvps);
attendance: buildAttendanceWriteRows(session.id, checkedStudentIds, {}, recordedBy),
```

So a student who RSVP'd `going` **and** has a real check-in or a coach-typed hours override is
checked *and* overwritten **today**, in production, with no coach action beyond clicking "Mark
event complete". That is the owner's own reported workflow — he types hours into the
`AttendancePanel`.

**This is filed as T307 and is deliberately NOT in this task.** Fixing it needs its own load seam
across N sessions and a different failure rule (the bulk path has no display, so a failed load must
**abort the write**, not fall back — falling back there means destroying). Your only contact with
that file is the two-line change in §5.1. **Do not fix T307 here. Do not widen toward it.**

---

## 1. The defect the owner reported

On a session that already has recorded attendance and hours, "Mark day complete" opens with **every
student unchecked** and its confirm button reads **"Mark complete — 0 attended · 0 h"**. The owner's
screenshot shows `George-Student` with a ticked attendance row and 3 h in the panel directly below,
while the dialog above says nobody attended.

Cause: `computeInitialAttendedStudentIds` (`MarkDayCompleteDialog.tsx:442-453`) seeds from **`rsvps`
with `status === 'going'` only**. It never reads `attendance`.

---

## 2. Owner ruling

**"show attendance for T305"** — 2026-07-31, recorded in `docs/swarm/auto-mode-decisions.md`,
section **"2026-08-01 — George's ruling on T305: show attendance (recorded late; see the process
note)"** (`:1387-1426`). That section is the record; this packet is not.

**Explicitly NOT authorized: writing `rsvps` rows from attendance.** `OutreachList.tsx:1685-1687`
carries the T121 checker's reason, verbatim: *"RSVP is intent, not a real attendance record."*
**Attendance and RSVP stay separate records; only the display changes.**

---

## 3. The load seam

`OutreachDetail.tsx` holds no attendance state (`grep -n "loadAttendanceForSessions\|AttendanceRow"`
returns nothing there — verified). `AttendancePanel` loads its own via
`AttendancePanelProps.loadAttendance?: LoadAttendanceForSessionsFn` defaulting to the real
`loadAttendanceForSessions` (`AttendancePanel.tsx:560`, `:570`, `:640`). **Do not lift that state
into `OutreachDetail`; do not add a competing load there.**

Give `MarkDayCompleteDialog` the same seam:

- `MarkDayCompleteDialogProps` gains `loadAttendance?: LoadAttendanceForSessionsFn`, defaulting to
  the real `loadAttendanceForSessions` (`loaders/attendance.ts:228`, `:266`). This is the
  established real-default-injectable convention (`onMarkComplete = markDayComplete` in this same
  interface). **It is not the placeholder-default family T151/T179 closed** and must not be made
  required — that would force a production change to `OutreachDetail.tsx`, which is Forbidden.
- Load **this session only**: `loadAttendance([session.id])`.
- **Shape to mirror:** `useAttendanceLoadState` (`AttendancePanel.tsx:528-554`) — `let isMounted`,
  `.then`/`.catch`, cleanup sets `isMounted = false`. You do not need its `retryToken` or its
  three-state union.
- **Dependency array: `[isOpen, session.id, loadAttendance]`**, with the file's existing
  `exhaustive-deps` disable comment. This is prescribed, not left to you: `roster` and `rsvps` are
  unmemoized page-level arrays at the live call site (`OutreachDetail.tsx:2183-2190`), so including
  them re-fires the load on every parent render. The gate ran this exact array successfully.
- **Use `.catch(...)`, never `void`.** T179 measured `void reloadDetail()` leaving 86 tests green at
  suite **exit 1** — `void` discards a promise's *value*, not its *rejection*.

**On failure or while in flight, fall back to the current RSVP-only seeding.** No error banner, no
blocked confirm, no spinner over the checklist. Disclose the choice in the module doc.

**Why falling back is safe here and NOT in the bulk path (§0.2):** this dialog *displays* the seed
to a coach who then confirms deliberately. A degraded display is recoverable; a silent bulk write
under a failed load is not.

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

- `recordedRows === null` (**not loaded yet, or the load failed**) → `checkedStudentIds` is exactly
  `computeInitialAttendedStudentIds(sessionId, roster, rsvps)`; hours map `{}`.
- Otherwise, per roster student, resolve the row for `(sessionId, studentId)`:
  1. **A row exists** → checked iff `isAttendingStatus(row.status)`. **Independently of that**, if
     `row.hoursOverride !== null`, the map carries that value.
  2. **No row** → checked iff a `going` RSVP exists for this session (today's rule).

**The hours map is seeded for every recorded row with a non-null override, checked or not — this is
load-bearing, not tidiness.** Gate round 2 measured the alternative: seeding only *checked* students
means an `absent`-recorded student with `hoursOverride: 3`, whom the coach then deliberately checks,
shows **7 h** in the input and counts **7 h** in the confirm label while §5's write emits **3**:

```
LABEL: Mark complete — 1 attended · 7 h  |  WRITTEN hoursOverride: 3
```

Extra map entries are inert — `computeTotalHoursForCheckedStudents`, `buildAttendanceWriteRows` and
the per-student `NumberInput`s all read the map only for *checked* students — so seeding
unconditionally costs nothing and removes the divergence. **Criterion W6 pins it.**
- **Filter by `sessionId` inside the function.** Do not trust the caller.

A recorded `absent` row starts **unchecked** even when the student RSVP'd `going`.

**These are two distinct RSVP fallbacks** — the `recordedRows === null` branch and the per-student
no-row branch. §8's criteria name which one they mutate; keep them distinguishable in your code.

**`computeInitialAttendedStudentIds` stays exported and behaviourally unchanged** — it is the
fallback branch, it is directly tested, and `MarkEventCompleteDialog` imports it (`:122`).

**`isAttendingStatus` is imported from `./AttendancePanel` (`:308`), not re-derived.** The gate
verified no cycle **by adding the import and building** — `tsc` 0, `vite build` ✓, both target test
files exit 0. AttendancePanel's only three imports are at `:213`, `:214-227`, `:228-237`.

**Types:** `recordedRows` carries `AttendanceRow` from `loaders/attendance.ts:155`. Note this file
declares its **own** `AttendanceStatus`/`AttendanceMethod` at `:362`/`:364`, shadowing
`loaders/attendance.ts:152-153`. Assigning across them compiles only because the unions are
textually identical. **Do not unify or delete either declaration** — that is scope growth. Just be
aware you are crossing two same-shaped types and say so in a comment.

### Applying the seed without clobbering the coach

- **Hours map:** merge with the coach's edits winning —
  `setHoursOverrideByStudentId(prev => ({ ...recordedOverrides, ...prev }))`. At open `prev` is
  `{}`, so recorded values win; anything typed is in `prev` and survives. **This merge is
  unconditional — it is NOT gated by the touched-ref below.** Gating it would reopen the
  label-vs-write divergence for the late-arrival case.
- **Checklist:** needs an explicit guard, because "unchecked everyone" and "did nothing" are both
  just an array. One `useRef(false)`, set true by the `CheckboxList`'s `onChange` and by
  `setStudentHoursOverride`, cleared in `resetForm`. Apply the recorded `checkedStudentIds` **only**
  if still open, still the same session, and the ref is false.

The gate confirmed this race is reachable and testable with today's harness (raw
`createRoot`/`act` plus a manually-resolved deferred promise) — no new tooling.

**The guard governs the checklist only.** Loaded rows still drive §5's write preservation whether
or not the seed was applied.

---

## 5. The write rule

`buildAttendanceWriteRows` gains a **required** fifth parameter carrying the loaded rows
(`Readonly<Record<string, AttendanceRow>>` keyed by student id, or the array plus an internal
lookup — your call). **Required, not optional:** T151/T179's mechanism. A call site that forgets the
recorded rows is the bug this task exists to prevent, and it must not compile.

Per checked student, `existing` = that student's loaded row (may be absent):

| field | rule |
|---|---|
| `status` | `existing !== undefined && isAttendingStatus(existing.status) ? existing.status : 'present'` — a recorded `'late'` stays `'late'`; a recorded `'absent'` the coach deliberately checked becomes `'present'` |
| `checkInAt` | `existing?.checkInAt ?? null` |
| `checkOutAt` | `existing?.checkOutAt ?? null` |
| `hoursOverride` | `hoursOverrideByStudentId[studentId] ?? existing?.hoursOverride ?? null` |
| `method` | `resolveAttendanceWriteMethod(existing?.method ?? null)` (`loaders/attendance.ts:218-222`) — **never** a hardcoded `'coach'` |
| `recordedBy` | `currentUserProfileId`, **unchanged** |

**`recordedBy` staying the acting coach is deliberate.** `UpsertAttendanceParams.recordedBy`'s doc
states it is *"always the ACTING coach's own `profiles.id` … even when `method` itself is preserved
as `'qr'`"*, and `AttendancePanel` does exactly that on both write paths (`:718`, `:791`). W5 pins
it so a later reader does not "fix" it.

**A student with no recorded row must be written exactly as today.** That is what keeps the
preservation branches provable rather than vacuous.

**Precedent:** `AttendancePanel.handleToggle`'s check path (`:712-718`) and `commitHoursOverride`
(`:785-791`) already delegate the method decision to `resolveAttendanceWriteMethod`. You are
applying an in-repo pattern to a third call site.

### 5.1 The fifth call site — `MarkEventCompleteDialog.tsx:187`

**This is production code in a file v2 forbade, and it is why v2 could not be implemented.** After
the signature change, `tsc` fails there:

```
src/pages/outreach/MarkEventCompleteDialog.tsx(187,17): error TS2554: Expected 5 arguments, but got 4.
```

**Authorized change, and the only one permitted in that file:** pass an **empty** recorded-rows
argument, preserving today's behaviour exactly, with a comment naming **T307** as the row that owns
the real fix. Do **not** add a load seam there. Do **not** change
`buildMarkEventCompletePayload`'s own signature — its test calls it with five arguments
(`MarkEventCompleteDialog.test.tsx:208`) and must not need editing.

Also correct **three** stale doc claims in that file — one clause each, do not rewrite the
paragraphs:

- `:168-170` — *"Reuses `computeInitialAttendedStudentIds` + `buildAttendanceWriteRows` …
  **unchanged**"*. After this task it passes a new argument.
- `:22` — *"`computeInitialAttendedStudentIds` (**the** checklist-seeding derivation)"*. It becomes
  the per-day dialog's RSVP *fallback*, not its seeding derivation.
- `:44-51` — module doc #2(a): *"always uses the SAME derivation the per-day dialog seeds its own
  checklist from"* and *"it writes exactly the RSVP-derived default the per-day flow itself would
  show pre-checked."* **Both false after this task**, and the second is specifically the "this does
  not invent attendance" argument a future T307 implementer will read and rely on. Found by gate
  round 2.

**The bulk payload needs no new criterion.** An existing test already pins it byte-for-byte —
`MarkEventCompleteDialog.test.tsx:206-216` asserts the emitted row is
`present` / `coach` / `hoursOverride: null` for a `going`-RSVP student. Gate round 2 measured that
passing real recorded rows at `:187` turns that test red (`1 failed | 14 passed`). It is in the
1746-test baseline, it is in a Forbidden file, and it costs you nothing — **leave it green and cite
it in your output as the pin.**

**Forbidden:** changing `MarkDayCompletePayload`'s or `AttendanceWriteRow`'s field shape; touching
`loaders/outreach.ts`, `loaders/attendance.ts`, `loaders/endMeeting.ts`, `AttendancePanel.tsx`,
`OutreachDetail.tsx`, or any migration.

---

## 6. Module-doc claims this change makes false

Nothing gates module docs, and this project has paid three times for a false one propagating.
**Every row below must be corrected in the same commit. Leaving one is a MAJOR.** The round-1 gate
verified each citation resolves to the construct named, and found four that v2 had missed.

| Location | The claim, and what it becomes |
|---|---|
| `:4-10` | The OUT-05 quotation (*"pre-checked from `going` RSVPs"*). **Leave the PRD text verbatim** — constitution non-negotiable. Add an annotation *below* it recording that the owner's T305 ruling supersedes the RSVP-only reading, citing `auto-mode-decisions.md`. Do not edit the quote. |
| `:82` | `check_in_at`/`check_out_at` *"both always `null` here"*. |
| `:104-107` | *"this dialog never collects check-in/check-out timestamps at all"* — it still never **collects** them; it now **carries** them. Say which. |
| `:121-136` | Module doc #2(c) — the whole constitution-item-3 argument that the local sum cannot diverge from MET-03 rests on always writing null timestamps. **Genuinely weaker now — see §7(a).** Rewrite honestly; do not delete. |
| `:138-150` | **A separate paragraph v2 missed.** *"`hoursOverrideByStudentId` only ever holds an entry for a student the coach has EXPLICITLY edited … an untouched student's write gets `hoursOverride: null`"* — false once §4 seeds recorded overrides into that map. |
| `:242-253` | Module doc #6 — *"`computeInitialAttendedStudentIds` … is the ONE place the checklist's starting state is derived"*. It becomes the RSVP fallback branch; name the new entry point. |
| `:359-361` | **Missed by v2.** `AttendanceStatus` doc — *"this dialog only ever writes `'present'` … the other three values are real but not produced by this file."* It will now write `'late'`. |
| `:363` | **Missed by v2.** `AttendanceMethod` doc — *"this dialog only ever writes `'coach'`."* It will now write `'qr'`/`'import'`. |
| `:398-400` | `AttendanceWriteRow.checkInAt`'s *"Always `null` here"*. |
| `:402-404` | **Missed by v2.** `AttendanceWriteRow.hoursOverride` — *"`null` = the coach never touched this student's row"*. A preserved override is now non-null with the coach untouched. |
| `:439-441` | `computeInitialAttendedStudentIds`' own doc comment. |
| `:484-487` | `buildAttendanceWriteRows`' *"Always `status: 'present'`, `method: 'coach'`, `checkInAt`/`checkOutAt: null"*. |
| `:621-624` | **Missed by v2.** The `useEffect` comment — *"every fresh open re-derives the checklist from the current `going` RSVPs"*. |
| `MarkEventCompleteDialog.tsx:168-170` | The *"unchanged"* clause — see §5.1. |

**One more lives outside your Allowed Files:** `loaders/outreach.ts:125-128` says
*"`checkInAt`/`checkOutAt` pass through as `null` verbatim"*. **Do not edit it.** Report it in your
"Deferred — for the ledger" section; it belongs to T307.

---

## 7. Two consequences to disclose, and NOT to solve here

**(a) The confirm label can now legitimately disagree with `v_student_hours`.** Verified against
`20260717000003_metric_views.sql:7-14`: the view is `coalesce(hours_override, «clamped
check_out − check_in when both non-null», «session duration»)`. Preserving real timestamps lets
tier 2 fire for rows this dialog writes, while `computeTotalHoursForCheckedStudents`
(`MarkDayCompleteDialog.tsx:459-468`) computes only `hoursOverride ?? sessionDuration`. So for a
QR-checked-in student with **no** override, the button's total can differ from what SQL computes.

Strictly better than today, where the number agrees *because the write destroys the timestamps* —
the label is honest only about a value it corrupted. **Do not close the gap by computing the clamped
span in TypeScript**: selecting between MET-03's tiers in TS is the re-derivation item 3 makes a
BLOCKER, and module doc #2(a) already says this file does not do it. The gate independently
confirmed both the SQL reading and that this should not block. Filed as **T308**.

**(b) The bulk path (§0.2).** Filed as **T307**. Report it; do not fix it.

Both are already known and filed. Note them in your output and move on — do not re-diagnose.

---

## 8. Acceptance criteria

Each names the production mutation that must turn it **red**. State the mutation you ran and paste
the real red output. **A criterion whose mutation leaves the suite green is not evidence — report
that instead of shipping it.** Use `container.textContent`, never `innerHTML`.

> **Mock-hardening requirement (read before writing any of these).** Because §3's fallback is
> *graceful*, a mock that never intercepts and a load that returns no rows are **indistinguishable**
> for any DOM-level criterion that asserts *fallback* behaviour. Gate round 2 measured this directly,
> by breaking the mock and re-running every criterion:
>
> - **Must assert `expect(mockedLoad).toHaveBeenCalledWith([session.id])`** — otherwise they pass
>   against a broken mock: **S4, S5, S8's late-arrival arm, S8b**, and **S3, W3, W4 whenever written
>   at DOM level**.
> - **Need no hardening, measured red on their own:** **S6, W1, I1**.
> - **Cannot be hardened, and do not need it: any criterion written as a direct pure-function call**
>   — **S3b and W2** never invoke the loader at all, so a broken mock cannot reach them.
>
> (v2 inverted this list; v3 fixed the inversion but kept v2's numbering, so it named "W2" — which
> v3 had renamed W4 — and omitted both new criteria. This is the corrected list.)

### Seeding and display

- **S1** — Recorded **attending** row for a student with **no RSVP**: starts **checked**, and the
  confirm button does **not** read `0 attended`. *(The owner's exact screenshot.)*
  **Mutation:** revert seeding to RSVP-only.
- **S2** — Recorded **`absent`** row for a student who RSVP'd **`going`**: starts **unchecked**.
  **Mutation:** make the attendance branch fall through to the RSVP rule.
- **S3** — Loader resolves **`[]`**: behaviour is exactly as today — `going` RSVPs start checked.
  **Mutation:** remove the RSVP check from the **per-student no-row branch** specifically.
  *(v2 said "the fallback"; there are two, and mutating the null branch leaves S3 green — measured.)*
- **S3b** — The **`recordedRows === null`** branch (load in flight, or failed) returns exactly
  `computeInitialAttendedStudentIds`' result. **Write this as a direct pure-function call** —
  `computeInitialFormSeed(sessionId, roster, rsvps, null)` — **not through the DOM.**
  **Mutation:** make that branch return `[]`.
  *Measured by gate round 2: asserted through the DOM this criterion is **vacuous**. Under §4's
  prescribed imperative shape the component only ever calls `computeInitialFormSeed` from inside
  `.then()`, always with a non-null array — the in-flight seed comes from the pre-existing
  `resetForm()`, so the null branch is dead in the DOM path and the mutation leaves all 11 criteria
  green. A pure call is unambiguous and does not constrain your implementation shape.*
- **S4** — Loader **rejects**: the dialog still opens, still seeds from RSVPs, shows **no** error
  surface, confirm **not** disabled. **Mutation:** drop the `.catch`. **Assert the suite's exit
  code, not just the pass count** — measured: all criteria stay green at **exit 1**. This is the
  T179 shape, and the exit code is the only thing that catches it.
  *Assert "no error surface" by the `Banner`'s copy, not by `[role="alert"]` — Astryx `NumberInput`
  renders empty `role="alert"` live regions unconditionally (four measured in a healthy dialog), so
  a node-presence assertion goes falsely red on correct code.*
- **S5** — No RSVP **and** no recorded row → **unchecked**. **Mutation:** default to checked.
- **S6** — `loadAttendance` is called with **exactly `[session.id]`**, **exactly once**.
  **Mutation:** pass `rsvps.map(r => r.sessionId)`. Requires a fixture whose `rsvps` span ≥2 session
  ids — realistic, since the live call site passes the page's unfiltered array. *`toHaveBeenCalledTimes(1)`
  is required: without it the criterion misses a repeated-load regression.*
- **S7** — A row for a **different session** in the returned array does not seed this dialog. Test
  the pure function directly with a mixed array. **Mutation:** drop the `sessionId` filter.
- **S8** — Rows arriving **after** the coach changed the checklist do **not** clobber the coach's
  edits; rows arriving **before** do apply. Both arms. **Mutation:** delete the touched-ref guard.
- **S8b** — A load still in flight when the dialog **reopens for a different session** does not seed
  the new session. **Mutation:** drop the same-session check from the guard. *(The one branch of §4's
  guard v2 left uncovered.)*
- **S9** — Recorded attending row with `hoursOverride: 3` on a **7 h** session: that student's hours
  input shows **3** and the confirm total counts **3**, not 7. **Mutation:** seed the hours map as
  `{}`.

### Write preservation

- **W1 (DOM)** — Payload for a student recorded `late` / `qr` / both timestamps set, confirmed
  untouched, carries `status: 'late'`, `method: 'qr'`, and the exact `checkInAt`/`checkOutAt`
  strings. **Four mutations, one per field**, each reported: hardcode `'present'`; hardcode
  `'coach'`; `checkInAt: null`; `checkOutAt: null`.
- **W2 (pure, empty hours map)** — `buildAttendanceWriteRows(sessionId, [studentId], **{}**,
  coachId, { [studentId]: recordedRowWithOverride3 })` returns `hoursOverride: 3`.
  **Mutation:** `hoursOverride: hoursOverrideByStudentId[studentId] ?? null`.
  **This must be a direct pure-function call with an explicitly empty coach hours map.** Measured:
  asserting it through the DOM leaves the mutation **green**, because §4's seeding has already put
  `3` into the map, so correct and mutated values coincide. v2 claimed W1 and W3 together made this
  non-vacuous; they do not.
- **W3** — Coach types **5** over a recorded **3** → payload carries **5**. **Mutation:** prefer the
  recorded value over the coach's.
- **W4** — A checked student with **no** recorded row is written exactly as today: `status:
  'present'`, `checkInAt`/`checkOutAt` `null`, `method: 'coach'`, `hoursOverride` from the map or
  `null`. **Mutation:** `method: resolveAttendanceWriteMethod(existing?.method ?? 'qr')`.
  *(v2 named "drop the `existing !== undefined` guard on `status`" — measured impossible:
  `isAttendingStatus`'s parameter is `AttendanceRow['status'] | undefined` and returns `false` for
  `undefined`, so that guard is dead code and the mutation compiles with 0 tests red. Every other
  row already collapses correctly via optional chaining, so no single-token mutation of the §5
  matrix can leak preservation into the no-row case.)*
- **W5** — A recorded `absent` row the coach deliberately checks is written `status: 'present'`, and
  `recordedBy` is the **acting coach's** `currentUserProfileId` even though `method` is preserved as
  `'qr'`. **Mutation:** `recordedBy: existing?.recordedBy ?? currentUserProfileId`.
- **W6** — **The confirm label never disagrees with what the write emits.** Fixture: a student
  recorded `absent` with `hoursOverride: 3` and `method: 'qr'` on a **7 h** session, whom the coach
  **deliberately checks**. The confirm button must read `1 attended · 3 h` — not 7 — and the payload
  must carry `hoursOverride: 3`, `status: 'present'`, `method: 'qr'`.
  **Mutation:** seed the hours map only for students who *start* checked (v3's rule).
  *This is the divergence gate round 2 measured: label `7 h`, written `3`. §4's unconditional
  seeding is what closes it, and this criterion is the only thing holding that open. It also keeps
  module doc #2(b) (`:109-119`, `:455-458`) — "a SUM over the exact values this dialog is ABOUT TO
  WRITE", the constitution-item-3 legitimacy argument for `computeTotalHoursForCheckedStudents`
  existing at all — **true**. If your implementation cannot satisfy W6, that doc claim becomes false
  and you must correct it and say so rather than shipping past it.*
  *(§5.1's deliberate non-fix of the bulk path needs no criterion — `MarkEventCompleteDialog.test.tsx:206-216`
  already pins it. See §5.1.)*

### Integration

- **I1** — Through the real `OutreachDetail` mount: with `mockedLoadAttendanceForSessions` resolving
  one recorded attending row, opening "Mark day complete" shows that student checked, and
  `expect(mockedLoadAttendanceForSessions).toHaveBeenCalledWith([session.id])` passes.
  **Mutation:** revert the dialog's seeding to RSVP-only. *The only proof the seam is reached in
  production wiring. Measured working: 94 → 95 tests, exit 0; red under its mutation.*

---

## 9. The harness

**Measured at `232dacf`, `.env.local` absent:** `MarkDayCompleteDialog.test.tsx` **26 tests**,
`OutreachDetail.test.tsx` **94 tests**. Pin both back to those counts plus what you add, and report
before/after.

**`OutreachDetail.test.tsx` is already immune.** It partial-mocks the attendance loader at
`:110-118` with `loadAttendanceForSessions: vi.fn(async () => [])`, exposed as
`mockedLoadAttendanceForSessions` (`:120`). Measured: with the production change applied and no test
edits, **94/94 pass**. Make **no** production change to `OutreachDetail.tsx`.

**`MarkDayCompleteDialog.test.tsx` has no `vi.mock` at all** and renders the dialog at **10** sites
(`grep -c "root.render("`). **Add a partial-mock factory** mirroring `OutreachDetail.test.tsx:110-118`;
override per-test with `mockResolvedValueOnce` / `mockRejectedValueOnce`.

**Why the mock is required — v2 got the reason wrong.** v2 said the un-mocked file would leak a
post-teardown async setState. Measured: it does not. With the prescription applied and no mock,
`26 passed, exit 0`, no unhandled rejection, no new stderr beyond the pre-existing `act(...)`
notices — `getSupabaseClient()` throws inside an `async` function, so it surfaces as a rejection
`.catch()` swallows, and the `isMounted` guard prevents any late `setState`. **The mock is required
because S1/S2/S9/W1/W3/W5 need to control the resolved value** — without it those six are simply
unwritable. A worker who goes looking for the leak, finds none, and treats the mock as optional will
stall.

**`vi.mock` does intercept a default-parameter module reference.** Proven twice: structurally by
`OutreachDetail.test.tsx:144-151` mocking `markDayComplete`, which `:1184-1185` asserts is reached
via a dialog's own default prop — *note that describe block is `MarkEventCompleteDialog`'s
`onMarkSessionComplete` (`MarkEventCompleteDialog.tsx:291`), not `MarkDayCompleteDialog`'s
`onMarkComplete`; v2 named the wrong component, though the precedent holds* — and directly, by the
gate proving `vi.mock` intercepts `loadAttendanceForSessions` for I1. Use `vi.mock`, not T180's
`vi.spyOn`-on-namespace workaround, which addressed a different (module-level, non-prop) reference.

### Existing tests you are authorized to change — and only these

Four tests in `describe('buildAttendanceWriteRows …')` call it with four arguments and must gain the
fifth (`:255`, `:270`, `:276`, `:281`). With an empty recorded-rows argument all four keep passing —
**add the argument, do not touch the assertions.**

Two of their **titles** become over-broad and must be narrowed to name the no-recorded-row case:

- `:255` *"writes status 'present' and method 'coach' for every checked student, never anything else"*
- `:270` *"never writes check_in_at/check_out_at (module doc #2(c) …)"*

Plus, in `MarkEventCompleteDialog.tsx` only, the `:187` call site and the `:168-170` doc clause
(§5.1). **`MarkEventCompleteDialog.test.tsx` needs no change** —
`buildMarkEventCompletePayload`'s signature is unchanged (verified: its test at `:208` passes five
arguments already).

**That is the complete list.** Constitution: existing tests pass unless a test update is explicitly
approved — this is that approval, scoped to exactly these lines. If you find yourself weakening,
deleting, or retargeting any **other** existing assertion, **stop and file a dispute.**

---

## 10. Gates — all six, `.env.local` ABSENT, report every one

Baseline measured independently by the orchestrator and the gate at `232dacf`: `tsc` **exit 0** ·
`vite build` **✓** · `format:check` **clean** · eslint **0 errors / 360 warnings** · vitest
**72 files / 1746 tests, exit 0**.

```
npx tsc --noEmit                 (expect exit 0)
npx vite build                   (expect success)
npm run format:check             (expect clean)
npx eslint .                     (0 errors; report the warning count and explain any rise)
npx vitest run                   (report new totals against 72 / 1746)
npx vitest run src/pages/outreach/MarkDayCompleteDialog.test.tsx >/dev/null 2>&1; echo $?
npx vitest run src/pages/outreach/OutreachDetail.test.tsx >/dev/null 2>&1; echo $?
```

Both targeted exits must be `0`. A gate omitted from your report is treated as not run. **A green
pass count with a nonzero exit code is a real failure on this project** — S4's own mutation produces
exactly that.

**Expected eslint delta: +1 `react-refresh/only-export-components` per new *value* export**, from a
base of **360**. Gate round 2's implementation needed exactly one new export
(`computeInitialFormSeed`) and measured **361**; a second helper export would make it 362. Report
your count and name the exports; anything beyond one-per-export must be explained. Zero errors
either way.

---

## 11. Allowed files

- `src/pages/outreach/MarkDayCompleteDialog.tsx`
- `src/pages/outreach/MarkDayCompleteDialog.test.tsx`
- `src/pages/outreach/MarkEventCompleteDialog.tsx` — **§5.1 only**: the `:187` call site and the
  `:168-170` doc clause. Nothing else in this file.
- `src/pages/outreach/OutreachDetail.test.tsx` (test-only — I1 and any needed mock setup)
- `docs/swarm/active/T305-worker-output.md` (create — evidence doc)

Everything else is Forbidden, including `OutreachDetail.tsx`, `AttendancePanel.tsx`,
`MarkEventCompleteDialog.test.tsx`, `loaders/outreach.ts`, `loaders/attendance.ts`,
`loaders/endMeeting.ts` and all migrations. If you conclude one must change, **file a dispute rather
than changing it.**

Work in your own git worktree (item 23); do not move the shared checkout's HEAD. **Do not commit a
`node_modules` symlink** — one reached `main` this week exactly that way and needed a revert PR.
Stage with explicit pathspecs, never `git add -A` (item 22).

Commit to `claude/t305-attendance-over-rsvp`, push, **report the commit SHA** (item 21 — "clean" and
"committed" are different claims), and include a **"Deferred — for the ledger"** section (item 20)
carrying at minimum §7(a), §7(b) and the `loaders/outreach.ts:125-128` doc claim. You do not
self-certify.
