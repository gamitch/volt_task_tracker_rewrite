# GAM-479 — task packet (HEAVY, round 2)

Author: orchestrator (Claude dispatch run), 2026-08-22.
Base: `origin/main` @ `0b06c9e7`, merged into `claude/gam-479-attendance-unset-preserve` at `8f6d17c4`.
Tier: **HEAVY** — item 26's "write path or destructive operation" trigger.

**Round 1 verdict was REVISE** (1 BLOCKER, 3 MAJOR, 7 MINOR, 3 NIT). Every
finding is applied below; §8 maps each one to where. Round 2 is the last round
before item 19a escalates to the owner.

> **Gate note.** Attack §7 first (item 19d). Round 1's BLOCKER was a fact that
> changed *during* the gate run — PR #234 merged at 03:12:28Z — so re-measure
> `origin/main` yourself rather than trusting this packet's base SHA.

---

## §0 — What the issue got wrong, measured

GAM-479's core claim holds: the un-mark is an unconditional row `DELETE` and it
takes `check_in_at`, `check_out_at`, `hours_override`, `method` and
`recorded_by` with it, with no audit trail to recover them from
(`supabase/migrations/20260803000000_simplify_attendance_audit.sql:38-39`
dropped the attendance audit trigger deliberately). Five things around that
claim need correcting, and two of them close off remedies the issue proposed.

**0a. The chip is on `main` now, and it is still user-unreachable.**
GAM-448 merged as PR #234 at **03:12:28Z on 2026-08-22** — *after* this run's
own check read `OPEN` at 03:07Z and *during* round 1's gate. `origin/main` is
`0b06c9e7`, and `git ls-tree origin/main src/pages/meetings/coach/` lists
`AttendanceChips.tsx`, `SessionRow.tsx` and the real `SchedulePanel.tsx`. But
`git grep -n SchedulePanel origin/main -- src/` returns **only self-references
and `SessionRow`** — `SchedulePanel` still has no external caller, so no user
can reach the chip. GAM-452 is the ticket that wires it up.

**0b. The destructive path IS live, on a surface the issue does not mention.**
`makeRemoveAttendance` has a second caller: `src/pages/outreach/AttendancePanel.tsx:642`
(default prop, declared optional at `:574`) and `:725` (the uncheck branch of
`handleToggle`). The panel is mounted at `src/pages/outreach/OutreachDetail.tsx:2430`,
inside the `isStaffViewer && user !== null` guard at `:2429`, on the
`/outreach/:eventId` route behind `RequireAuth` (`src/app/router.tsx:279-286`).
That panel *also owns the hours `NumberInput`* (`AttendancePanel.tsx:620-629`,
committed through `onUpsertAttendance` at `:772-810`), so a coach can set
`hours_override` on a row and destroy it with the next click on the same row's
checkbox. The issue's "No user can reach this today" is true of the *chip* and
false of the *defect*.

**0c. "Preserving the row with a null status" is dead, three times over.**

1. `attendance.status` is `text not null check (status in ('present','late',
   'excused','absent'))`
   (`supabase/migrations/20260717000000_scheduling_attendance.sql:86`) — it
   needs a migration.
2. **It corrupts three views and a rollup.** T509/D014 defines *a row exists*
   as *an explicit mark exists*.
   `supabase/migrations/20260806000000_met01_explicit_marks.sql:110` INNER-joins
   `attendance`; `:119` is `count(*) as expected_ct`; `:124`/`:127` make the
   denominator `count(*) - count(*) filter (where status = 'excused')`. A
   null-status row is neither excused nor present/late, so it inflates the
   denominator and depresses `participation_pct`; it also inflates
   `expected_ct`, which RPT-02 renders as "Marked" (column comment, same file
   `:131`); it also flows into `v_team_participation` (`:139-145`); and
   `supabase/migrations/20260821000000_meetings_event_attendance_view.sql:180`
   uses `count(a.id)`, so the phantom mark lands in `graded_marks_ct` too.
   Constitution item 3 makes re-deriving that SQL a BLOCKER.
3. **It is the design the human owner personally removed.** `attendance.ts`'s
   module doc #2 (`:37-65`, with the fuller T117 record at `:71-91`) records
   that T117 originally preserved `check_in_at` by demoting a `qr`/`import` row
   to `'absent'` instead of deleting it, and that T119 removed it on **D-7,
   George's direct product-owner override, quoted verbatim in the file at
   `:41-44`**: *"As coach I am ultimate authority and should be able to
   overwrite an RSVP or check-ins."* The equivalence is not exact — the removed
   branch was conditional on `method ∈ {qr, import}` and wrote a real `'absent'`
   mark, where null-status preservation is unconditional and writes a status
   the constraint forbids — but it defeats the same power D-7 granted. This is
   corroboration, not the deciding reason; `0c.1` and `0c.2` each close the
   option on their own.

**0d. An undo is not free either, and the reason is the exact column the issue
leads with.** `makeUpsertAttendance` **deliberately never writes**
`check_in_at`/`check_out_at` — the doc comment is `attendance.ts:436-446`, the
payload is `:455-462`, and the omission is guarded green today by
`AttendancePanel.test.tsx:486-487`. Module doc #3 states it as a file-wide
absolute at `:134-137`: *"`check_in_at`/`check_out_at` are DELIBERATELY never
included in any upsert payload this file builds."* So an undo assembled from
today's seams would restore the status and the hours override and **silently
drop the QR check-in timestamp**. A real undo needs a new write path.

**0e. The chip cannot supply the values an undo needs, so the seam must hand
them back.** `SessionRow.tsx`'s `handleUnset` (`:267-274`) captures only
`previous = readLocalStatus(statusById, studentId, null)` — a bare status — and
`SessionRosterEntry` (`SchedulePanel.tsx:173-177`) is exactly
`{ studentId; displayName; status }`. Neither the chip nor its parent holds
`checkInAt`, `checkOutAt`, `hoursOverride`, `method` or `recordedBy`. This is
why P1 below returns the deleted row from the DELETE itself rather than asking
callers to have captured it.

**What survives.** Confirm dialog: ruled out (DES-11 at
`docs/swarm/VOLT_Portal_PRD.md:219` names delete event / deactivate student /
revoke calendar feed / cancel session, and no attendance un-mark; the issue
rules it out; a confirm inside a five-stop cycle makes the cycle untestable).
Preserve-instead-of-delete: ruled out by 0c. **Undo — return the row the DELETE
destroyed, and reinstate it exactly — is the only remaining option**, and it
does not conflict with D-7: D-7 grants the coach authority to remove a
check-in, and an undo is that same coach's own next action, not a guard placed
over them. `attendance.ts:65-69` draws the same distinction independently
("D-7 only overrides veto power, not attribution").

---

## §1 — The change

Three parts. No migration, no metric SQL, no reversal of D-7, no confirm dialog.

### P1 — the DELETE returns what it destroyed (`attendance.ts`)

Change `RemoveAttendanceFn` from `Promise<void>` to
`Promise<AttendanceRow | null>`, and the chain at `:549-557` from
`.delete().eq().eq()` to `.delete().eq().eq().select().maybeSingle()`, mapping a
non-null result through `mapAttendanceDbRowToAttendanceRow`. `null` means there
was no row to delete, which is not an error and must not throw.

**Why the seam and not the caller.** `AttendancePanel` happens to hold the row
already (`existing`, `:706`), but the chip does not (§0e), and — more
importantly — a restore must reinstate **what the database actually held**, not
what client state believed it held. The row the DELETE returns is the only
value that is definitionally correct.

**This edits an existing test, and that is authorized here.**
`AttendancePanel.test.tsx:493-508` stubs `.delete().eq().eq()` with the second
`eq` resolving directly, so it cannot survive a `.select()` link. Extend it:
keep all three existing assertions (`from('attendance')`,
`eq('session_id', …)`, `eq('student_id', …)`) verbatim, add the `.select()`/
`.maybeSingle()` links to the stub, and add one new assertion that the mapped
row comes back. **Do not weaken or delete an existing assertion.** No other
existing test may be edited.

### P2 — the restore seam (`attendance.ts`)

Add `RestoreAttendanceParams`, `RestoreAttendanceFn`, `makeRestoreAttendance`
and the module-level `restoreAttendance`, following the `runMutation` +
`getClient` DI + `.select().single()` + `mapAttendanceDbRowToAttendanceRow`
shape the file's other write factories already use (`loader.ts:203-227`).

**Verb: `.insert(...)`, NOT `.upsert(...)`.** This is a correctness
requirement, not a style call. The race is documented inside the file being
edited: `attendance.ts:108-121` records that `checkin`'s
`applyUpsertIgnoreDuplicates` reads "no row for (session_id, student_id)" as
"never checked in". So after the coach's DELETE a student QR scan creates a
**fresh row with a real `check_in_at`** — and an upsert on
`onConflict: 'session_id,student_id'` would then overwrite that newer row with
the stale capture, destroying a genuine check-in. That is the defect GAM-479
exists to fix, reintroduced by the fix. `.insert()` fails loudly instead with
Postgres `23505`, which `runMutation` already normalizes through `toLoaderError`
(`loader.ts:217-218`) and the panel already surfaces inline
(`AttendancePanel.tsx:801-806`).

Payload — every column the DELETE destroyed:

```
session_id, student_id, status, check_in_at, check_out_at,
hours_override, method, recorded_by
```

Type notes that will not compile if ignored:

- `RestoreAttendanceParams.recordedBy` is **`string | null`**, unlike all three
  existing factories which type it `string` (`:431`, `:491`). The column is
  nullable (migration `:91`) and `AttendanceRow.recordedBy` is `string | null`
  (`:233`).
- The doc comment must state that a restore writes the **captured**
  `recordedBy` and `method`, which is a deliberate exception to the
  "always re-attributed to whoever is editing right now" contract at `:428-431`
  and `:487-491`. A reinstatement is not an edit.
- "Restore it exactly" is inexact and the doc must say so: the reinstated row
  gets a **new `id` and `created_at`**. Only the five carried columns plus
  `status` are restored.

### P3 — module doc corrections (`attendance.ts`)

1. Module doc #3's absolute at `:134-137` becomes **false** once P2 lands. Amend
   its wording to carve out the restore path explicitly — do not leave a
   sentence in the file that the file contradicts.
2. Module doc #2 gains the GAM-479 decision record: the asymmetry, why a
   confirm is not the answer, why null-status preservation is not the answer
   (all three reasons from §0c), and why an undo does not contradict D-7.

### P4 — the undo affordance (`AttendancePanel.tsx`)

In `handleToggle`'s uncheck branch (`:721-732`), keep the row that
`onRemoveAttendance` now returns in a new `pendingUndoByKey` state map (skip if
it returns `null`). Render the undo, and on activation call
`onRestoreAttendance` with the captured values, put the restored row into
`attendanceByKey`, and clear the entry.

**Shape: one `Banner`, not a `Toast` and not an inline row control.** DES-13
(`docs/swarm/VOLT_Portal_PRD.md:221`) splits feedback: *"success/confirmation
via `Toast`; persistent conditions via `Banner`."* A pending undo is a
persistent condition — it must not disappear on a timer, because the whole point
is to protect a value the coach may not notice is gone for several seconds.
`astryx-api.md:2702` describes `Banner` as exactly that ("a persistent message…
until they act on it"), and its Best Practices say *"Don't use Banner for
short-lived messages that disappear on their own; use Toast instead"* — ours is
deliberately not short-lived. `astryx-api.md:2752` further says *"Don't stack
multiple banners with the same status; combine related messages into one
banner,"* so render **one** banner covering every pending undo:

```
status="info"                      (documented, :2763)
title=…                            (documented, :2764 — required)
isDismissable                      (documented, :2767)
onDismiss={…}                      (documented, :2768)
children={…}                       (documented, :2771)
defaultIsExpanded                  (documented, :2772)
```

Every one of those props is in `astryx-api.md`'s Props table, so **no item-2b
annotation is needed and none may be written.** `children` holds one line per
pending un-mark, each with its own real `Button` naming the student.
`endContent` is not used. Do not use `Toast`: its `astryx-api.md` Props table is
stale against installed 0.1.6 (it lists `onHide`/`uniqueID`/
`collisionBehavior`, none of which exist in `ToastProps`, and omits the required
`onDismiss`), so using it would drag an item-2b annotation into this PR for no
benefit.

Binding constraints on the affordance:

- **No timer of any kind.** No `setTimeout`, no auto-dismiss, no countdown, no
  urgency copy. (`grep -n setTimeout src/pages/outreach/AttendancePanel.tsx`
  returns zero hits today and must still return zero after.) The primary
  argument is DES-13 plus the correctness point above; constitution item 17 is
  about motivation mechanics and is **not** the load-bearing reason here.
- **Copy follows DES-14…16** — sentence case, buttons say what happens.
  Use `Undo un-mark for <student name>` as the button label, so the accessible
  name distinguishes rows (item 15 / DES-17).
- **Item 12 is not weakened.** A failed restore surfaces through the row's
  existing `rowErrorByKey` path (`:752-755`) and the pending-undo entry
  **survives** the failure so the coach can retry.
- **Prop shape:** `onRestoreAttendance?: RestoreAttendanceFn`, **optional**,
  defaulting to the module-level `restoreAttendance` — exactly matching
  `onRemoveAttendance` at `:574`/`:642`. This is what keeps
  `OutreachDetail.tsx:2430` out of the diff; that file is Forbidden below.
- `existing` at `:706` may be `undefined` (the hours path already guards this at
  `:779`). With P1 the capture comes from the DELETE's return value, not from
  `existing`, so this is moot — but do not reintroduce a dependency on it.

---

## §2 — Allowed Files

- `src/lib/supabase/loaders/attendance.ts`
- `src/lib/supabase/loaders/attendance.test.ts`
- `src/pages/outreach/AttendancePanel.tsx`
- `src/pages/outreach/AttendancePanel.test.tsx`

**Forbidden**, each for its own reason:

- `src/pages/meetings/**` — the chip files are on `main` now (§0a) and are
  therefore *editable*, but the chip has **no user** (no caller for
  `SchedulePanel`). Constitution item 25's proportionality and item 26's
  "smallest change that removes the defect" say: fix the surface a coach can
  actually reach today, and let the chip's undo be its own row now that P1 has
  made it cheap. That follow-up is filed before this PR opens (§6).
- `supabase/**` — no migration is needed and none is authorized (§0c).
- `docs/swarm/**`, `.claude/**`, `AGENTS.md` — orchestrator-owned. In
  particular **do not annotate `astryx-api.md`**; §1 P4 chose `Banner`
  specifically so that no annotation is required.
- `src/pages/outreach/OutreachDetail.tsx` — kept out by making
  `onRestoreAttendance` optional (§1 P4).
- `.github/workflows/**` — AGENTS.md wall 1; a dispatch run cannot push these.

## §3 — Acceptance criteria

Each names the real source it is measured against (item 27).

1. `makeRemoveAttendance` still deletes by `session_id` + `student_id` and now
   returns the mapped deleted row. The three existing assertions in
   `AttendancePanel.test.tsx:493-508` survive verbatim; one new assertion shows
   the returned `AttendanceRow` carries the deleted row's `checkInAt` and
   `hoursOverride`.
2. `makeRemoveAttendance` returns `null`, and does **not** throw, when the
   underlying result carries `data: null, error: null`.
3. `makeRestoreAttendance` calls `.insert(...)` — **not** `.upsert(...)` — with
   all eight columns of §1 P2, asserted on the captured payload using the
   existing stub idiom (`attendance.test.ts`'s `makeUpsertStubClient` at
   `:270-291`, adapted for `insert`; the `makeSetAttendanceStatus` block at
   `:308-389` is the pattern to copy).
4. `makeRestoreAttendance` resolves the written row through
   `mapAttendanceDbRowToAttendanceRow` — asserted on the returned object, not
   the payload.
5. A restore whose insert rejects (duplicate key) propagates the error; the
   test asserts the rejection, not a swallowed failure.
6. Unchecking a student in `AttendancePanel` still performs the unconditional
   DELETE, with no confirm and no branch on `method` (T119/D-7 intact). The
   existing block at `AttendancePanel.test.tsx:650-746` passes unedited.
7. After a successful uncheck, a `Banner` is present containing a real
   focusable control whose accessible name is `Undo un-mark for Amara Chen`.
8. Activating it calls the injected restore seam **exactly once**, with
   `checkInAt`, `checkOutAt`, `hoursOverride`, `method` and `recordedBy` equal
   to the values the deleted row carried — asserted field by field, from a
   fixture with a **non-null `checkInAt` and a non-null `hoursOverride`**,
   because those two are the whole point of the ticket. `makeRow`
   (`AttendancePanel.test.tsx:168-183`) takes `Partial<AttendanceRow>` and
   supplies this today.
9. After a successful restore the row reads as checked again, the hours input
   shows the restored `hoursOverride`, and the banner entry for that row is
   gone.
10. A rejected restore leaves the banner entry in place and surfaces the error
    through the row's existing inline error path.
11. `grep -n setTimeout src/pages/outreach/AttendancePanel.tsx` returns nothing,
    and no countdown or urgency copy appears anywhere in the affordance.
12. Fixtures use fabricated names (item 6). Reuse the existing `Amara Chen` /
    `Sofia Delgado` fixtures (`AttendancePanel.test.tsx:162-163`) — do not
    introduce new names, and do not rename these.

**Measurement mechanism for 7/9/10:** `AttendancePanel.tsx` has no
`data-testid` today. Add one on the banner container and one per undo button
(`data-testid="attendance-undo-<sessionId>-<studentId>"`). **Do not** make the
undo control resolvable through `getFieldControl`
(`AttendancePanel.test.tsx:83-96`), which matches on `label.textContent`
prefix — a `<label>` starting with a student's name would make
`getFieldControl('Amara Chen')` in the frozen existing tests resolve the wrong
node.

## §4 — Mutations the worker must run and report red output for

Item 26: commit the fix first, mutate, capture the real red output and exit
code, revert, re-verify green. Mutate only in your own worktree (item 23).

- **M1** — drop `check_in_at` from `makeRestoreAttendance`'s **loader payload**.
  Criterion 3 goes red. (It does *not* touch criterion 8 — that asserts what the
  component passes to an injected seam.)
- **M1b** — drop `checkInAt` from the params `AttendancePanel` passes to
  `onRestoreAttendance`. Criterion 8 goes red.
- **M2** — change `makeRestoreAttendance` from `.insert(...)` to
  `.upsert(..., { onConflict: 'session_id,student_id' })`. Criterion 3 goes red.
- **M3** — remove the undo button from the banner. Criteria 7, 8 and 9 go red.

## §5 — Verification

All six gates via the `gate-run` skill, exit codes reported verbatim, nothing
piped into `tail`/`grep`/`wc`.

**Baseline for the regression check**, measured on this branch at `8f6d17c4`
before any source change: `npx vitest run src/pages/outreach/AttendancePanel.test.tsx
src/lib/supabase/loaders/attendance.test.ts` → **2 files, 56 tests, all
passing** (41 in `AttendancePanel.test.tsx`, 15 in `attendance.test.ts`). Report
the post-change counts against these.

## §6 — Follow-ups the orchestrator files (item 20), not the worker

Filed to `Backlog` with `tier/unreviewed`, before this PR leaves draft:

1. **The chip's own undo** — apply P4's pattern to `AttendanceChips`/
   `SessionRow`/`SchedulePanel`. P1 makes this cheap: the chip does not need
   `SessionRosterEntry` widened, because the DELETE now hands the row back at
   `SessionRow.tsx:272`. Not urgent — `SchedulePanel` has no caller; the trigger
   is GAM-452 wiring it up.
2. **`astryx-api.md`'s `Toast` Props table is stale** against installed
   `@astryxdesign/core@0.1.6` (`node_modules/@astryxdesign/core/dist/Toast/Toast.d.ts`):
   it documents `onHide`/`uniqueID`/`collisionBehavior`, which `ToastProps` does
   not have, and omits the required `onDismiss`, which three shipped files
   already pass. Item 2b's annotation route applies; this packet deliberately
   routes around it rather than dragging it into a data-loss fix.

## §7 — Least confident decisions (item 19d)

1. **Scoping GAM-479 to the outreach surface and filing the chip's undo
   separately.** The chip is the issue's own subject and is now editable; I am
   choosing the reachable surface over the titled one. *Wrong if* the owner
   reads GAM-479 as unclosable while the chip still deletes — in which case this
   PR is the seam plus half the fix and GAM-479 should stay open behind §6.1.
   I judge splitting better than doing both badly against this run's clock, but
   the split is the packet's biggest judgement call.
2. **Changing `makeRemoveAttendance`'s return type rather than adding a
   parallel factory.** It forces an edit to a currently-green test. *Wrong if*
   the checker reads that edit as weakening passed work — mitigated by requiring
   all three existing assertions to survive verbatim, but a parallel
   `makeRemoveAttendanceReturning` would have avoided the question entirely at
   the cost of two near-identical seams.
3. **`Banner` over `Toast`.** Round 1's gate pointed at `Toast` + `endContent`,
   which `astryx-api.md:6050` explicitly recommends for undo. I chose `Banner`
   on DES-13's persistent/short-lived split plus the stale-Props-table problem.
   *Wrong if* DES-13's "success/confirmation via Toast" is read as governing the
   *event* (an un-mark just succeeded) rather than the *duration*, in which case
   a non-auto-hiding `Toast` is the prescribed shape and §6.2's annotation
   belongs in this PR after all.
4. **`.insert()` over `.upsert()` for the restore.** It makes a restore fail
   when a QR scan re-created the row — the coach sees an error instead of an
   undo. *Wrong if* the owner would rather the undo always work and accept
   clobbering a scan that happened in the intervening seconds. I read the
   error as strictly better because the failure is visible and the clobber is
   not, but this is a product call I am making on the owner's behalf.
5. **One combined `Banner` rather than one per pending un-mark.** Driven by
   `astryx-api.md:2752`'s "don't stack multiple banners with the same status".
   *Wrong if* a single banner listing several students reads as a summary the
   coach skims past, where a per-row control would be noticed. Nobody has tested
   either shape with a real coach.

## §8 — Round 1 findings → where each is applied

| Finding | Applied |
| -- | -- |
| BLOCKER-1 (§0a false; #234 merged) | §0a rewritten and re-measured; base updated to `0b06c9e7`/`8f6d17c4`; §2 re-justified on user-unreachability, not on an open PR; §6 no longer says "blocked on PR #234" |
| MAJOR-2 (upsert clobbers a newer check-in) | §1 P2 mandates `.insert()`; criteria 3 and 5; mutation M2; §7.4 |
| MAJOR-3 (§7.2's condition obtains; chip holds only a status) | §0e added and measured; P1 reinstated so the DELETE returns the row; §6.1 records the mechanism |
| MAJOR-4 (M1 cannot redden criterion 6) | §4 split into M1 (loader payload → criterion 3) and M1b (component params → criterion 8) |
| MINOR-5 (prop shape) | §1 P4 requires `onRestoreAttendance?` optional with a default; §2 forbids `OutreachDetail.tsx` |
| MINOR-6 (`recordedBy` type; "exactly" is inexact) | §1 P2 type notes: `string \| null`, captured attribution, new `id`/`created_at` |
| MINOR-7 (module doc #3 becomes false) | §1 P3.1 |
| MINOR-8 (DES-13 unaddressed) | §1 P4 names DES-13 and defends `Banner`; §7.3 declares the doubt |
| MINOR-9 (criterion 10 unsatisfiable) | criterion 12 restated as "fabricated names", reusing the frozen fixtures |
| MINOR-10 (three bad citations) | `attendance.test.ts:270-291`/`:308-389` named; `AttendancePanel.test.tsx:493-508`; `OutreachDetail.tsx:2430` guard `:2429` |
| MINOR-11 (how criterion 5 is measured) | §3's "Measurement mechanism" paragraph, including the `getFieldControl` trap |
| NIT-12 (§0c.3 rhetoric) | §0c.3 demoted to corroboration; citation widened to `:37-65` + `:71-91` |
| NIT-13 (no gate baseline) | §5 carries the measured 2 files / 56 tests |
| NIT-14 (item 17 over-cited) | §1 P4 rests on DES-13 and correctness; item 17 explicitly demoted |
| Gate's §0c.2 correction (three views + rollup) | §0c.2 rewritten with all four citations |
| Gate's `getFieldControl` trap | §3 measurement mechanism |
| Gate's `existing` may be `undefined` | §1 P4 final bullet |
