# T307 — "Mark event complete" must stop destroying recorded attendance

**Packet v2 — GATED, CLEARED FOR DISPATCH.** `checker-premise` (light round, item 19b) returned
**DISPATCH** against v1 with findings; v2 folds all seven in. The gate **built the complete
prescription** — the load seam, the block-on-failure rule, §4's seeding, the new parameter — in its
own worktree and ran all six gates green. **The prescription is known to work before you start.**

**Branch:** `claude/t307-bulk-complete-preserve`, cut from `claude/t305-attendance-over-rsvp`
at **`e583e89`** or later. **T305 has landed** — its precondition (§1) is satisfied, verified:
`buildAttendanceWriteRows` takes five parameters (`MarkDayCompleteDialog.tsx:706`) and the empty
recorded-rows map with the comment naming this row is at `MarkEventCompleteDialog.tsx:210`.

**All line citations below were re-verified at `e583e89`.** v1's were written pre-T305-merge and
were stale by roughly +23 lines; the gate caught it (item 19c).
**Worker tier:** sonnet. Item 18's four triggers do not fire — no migration, no RLS, no
`security definer`, no metric SQL, no auth/role logic.
**Checker:** `checker-reviewer` (opus) — a write path that destroys real data today.
**Gate:** **light, one round** (item 19b). This packet rolls out a pattern T305's two full gate
rounds already verified by execution — the load seam, the preservation matrix, and
`resolveAttendanceWriteMethod` delegation are all settled. The gate should check §3's **failure
rule** and §4's **seeding decision**, which are genuinely new, and not re-audit T305's mechanics.

---

## 1. Hard dependency on T305 — read before planning anything

**SATISFIED — T305 merged at `ee2ea5e` + close-out `e583e89`.** It added the required fifth
parameter to `buildAttendanceWriteRows` (`MarkDayCompleteDialog.tsx:706`) and already edits
`MarkEventCompleteDialog.tsx:210` to pass an **empty** map with a comment naming this row.

**Your job is, in essence, to replace that empty map with real rows** — plus the load seam and
failure rule needed to obtain them honestly. If `buildAttendanceWriteRows` takes four parameters
where you are working, you branched from the wrong base.

---

## 2. The defect — live today, one click, no coach intent

`buildMarkEventCompletePayload` (`MarkEventCompleteDialog.tsx:193-215`) seeds its attendance rows
from `computeInitialAttendedStudentIds` — **`going` RSVPs** — and passes them to
`buildAttendanceWriteRows` with an empty hours map (`:210`). Each payload goes to `markDayComplete`,
whose upsert (`loaders/outreach.ts:1136-1152`) names `check_in_at`, `check_out_at`,
`hours_override`, `method` and `recorded_by` and passes `{onConflict: 'session_id,student_id'}`
with **no `ignoreDuplicates`** (`:1150`) — a full-column overwrite.

Payload captured from the real loader over a stubbed transport, by T305's gate:

```
{status:'present', check_in_at:null, check_out_at:null, hours_override:null, method:'coach'}
```

So a student who RSVP'd `going` **and** then checked in by QR — or had hours typed into the
`AttendancePanel` — has their check-in/check-out, hours override and QR provenance destroyed the
moment a coach clicks "Mark event complete".

**Why this is a bug and T305's version was latent.** In the per-day dialog nobody with recorded
attendance ever *started* checked, so no row was emitted for them. The bulk path checks everyone
with a `going` RSVP and writes immediately, with no checklist and no review step. **This is the
owner's own workflow** — T305 was filed off a screenshot of him typing 3 h into that panel.

**Sibling precedent, in-repo:** `makeUpsertAttendance` (`loaders/attendance.ts:293-327`) omits
`check_in_at`/`check_out_at` from its payload *on purpose* — its own doc names this as the
history-preservation mechanism, since Postgrest's `ON CONFLICT DO UPDATE SET` only touches columns
present in the payload. `makeMarkDayComplete` includes them. **You are not fixing that asymmetry in
the loader** (see §6); you are supplying real values so it stops mattering.

---

## 3. The load seam, and the failure rule that is NOT T305's

`MarkEventCompleteDialogProps` gains `loadAttendance?: LoadAttendanceForSessionsFn`, defaulting to
the real `loadAttendanceForSessions` (`loaders/attendance.ts:228`, `:266`). Same real-default
injectable convention as `onMarkSessionComplete = markDayComplete` (`:314`) in this same component.

- Load **once for all `remaining` session ids** — `partitionEventSessions(sessions)`'s `remaining`,
  not every session and not one call per session. `skipped` sessions are never written to.
- Load on the open transition. This component already has the right effect and the right key:
  `useEffect(… , [isOpen, sessionsKey])` at `:344-347`, where `sessionsKey` is the deliberately
  stable primitive built at `:342`. **Reuse `sessionsKey`; do not key on the `sessions` array
  reference** — the comment at `:338-341` records why (callers rebuild it every render).
- **Gate the load on `isOpen`, not on mount.** `<MarkEventCompleteDialog>` is mounted whenever
  `user !== null` (`OutreachDetail.tsx:2137`), so an ungated mirror of `useAttendanceLoadState`
  fires on *every coach page load*. The gate measured that gating on `isOpen` keeps
  `OutreachDetail.test.tsx:1063`'s `expect(mockedLoadAttendanceForSessions).not.toHaveBeenCalled()`
  green.
- Mirror `useAttendanceLoadState` (`AttendancePanel.tsx:528-554`) for the `isMounted` guard and the
  `.then`/`.catch` shape. Unlike T305, you **do** want something close to its three-state union.

### The failure rule — the single most important line in this packet

**A load that is in flight or has failed must BLOCK the write. It must never fall back to
RSVP-only seeding.**

T305's per-day dialog is allowed to fall back, and its packet says so. **Do not copy that.** The
reason the two differ is not style:

| | per-day dialog (T305) | bulk dialog (this task) |
|---|---|---|
| shows the coach who will be marked present | yes, an editable checklist | **no** |
| coach can correct a bad seed before writing | yes | **no** |
| falling back on load failure means | a degraded *display* the coach reviews | **silently destroying rows** |

Falling back here would reintroduce the exact bug this task exists to fix, on the exact path where
nobody can catch it. Concretely:

- **Loading:** confirm action disabled, with honest text saying attendance is still loading. Not a
  bare spinner over the whole dialog — the people-reached inputs stay usable.
- **Error:** confirm action disabled, a real `Banner` with `status="error"`, DES-16-style copy
  saying what happened and what to do next, and a **retry** that re-runs the load. The coach must
  not be able to write through this state.
- **Success:** rows available; confirm enabled.
- **`remaining.length === 0`:** the footer renders only "Close" and no confirm button exists —
  correct, since there is nothing to write. Suppress the loading/error region in that case rather
  than stacking it next to "No sessions to mark complete". Cosmetic, but the gate hit it.

This is constitution item 12's four-states requirement applied to a nested async region — the same
"second, smaller DES-12 seam" shape `AttendancePanel`'s own load state uses, and its comment at
`:515-521` is the precedent to cite.

**Disclose the asymmetry in the module doc**, explicitly naming T305's opposite choice and why, so
the next reader does not "harmonise" them.

---

## 4. Seeding — an orchestrator decision, not the owner's

`buildMarkEventCompletePayload` gains a recorded-rows parameter and threads it to
`buildAttendanceWriteRows`. That alone stops the destruction. The open question the ledger flagged is
whether the bulk path should **also seed from recorded attendance** the way T305's dialog now does —
i.e. write a `present` row for a student who has recorded attendance but never RSVP'd.

**Decision: yes, seed from recorded attendance, using T305's rule.** Recorded row → included iff
`isAttendingStatus(row.status)`; no row → included iff a `going` RSVP exists.

**This is the orchestrator's call, recorded as such — the owner has NOT ruled on it.** His T305
ruling (`auto-mode-decisions.md`, 2026-08-01) is written in display terms (*"where a screen currently
shows RSVP intent … show what was actually recorded"*) and this dialog shows no checklist, so the
ruling does not cleanly reach it. Reasoning, so he can overrule cheaply:

1. **Cost is near zero once the rows are loaded** — with one exception you must disclose.
   With preservation in place, a student with a recorded row is written back exactly as they already
   are **except for `recorded_by` and `updated_at`**, which `makeMarkDayComplete`'s upsert also names
   (`loaders/outreach.ts:1139-1149`). So the write **re-stamps `attendance.recorded_by`** from the
   original recorder to whoever clicked "Mark event complete" — on a row this path never touched, for
   a student the coach never saw, in a dialog with no checklist. That is consistent with
   `UpsertAttendanceParams.recordedBy`'s own doc (*"always re-attributed to whoever is editing right
   now"*) and with T305's W5, but **every prior instance of that convention involved a coach actively
   editing that student's row.** Gate-measured, not inferred. **Disclose it in the module doc.**
   *(Reassuring corollary the gate also measured: §4 cannot insert a row for a student who previously
   had none — qualifying requires already having a recorded row. Nothing is fabricated.)*
2. **Not doing it creates a two-paths-two-answers defect,** which is the family that produced T188
   and T303. The per-day and bulk paths would disagree about who attended the same session.
3. **A recorded `absent` must still be excluded**, exactly as in T305 — `isAttendingStatus` is
   `'present' || 'late'` (`AttendancePanel.tsx:308`). Do not re-derive it; import it.

**Still NOT authorized, and for the same in-repo reason as T305:** writing `rsvps` rows from
attendance. `OutreachList.tsx:1685-1687` carries the T121 checker's *"RSVP is intent, not a real
attendance record."*

---

## 5. Acceptance criteria

Each names the mutation that must turn it red. Paste the real red output. **A criterion whose
mutation leaves the suite green is not evidence — report that instead of shipping it.** Four
criteria were caught this way across T305's two gate rounds.

**Mock-hardening (T305's hard-won lesson):** any criterion asserting behaviour that a *failed* load
also produces must additionally assert the loader was called — otherwise a mock that never
intercepts passes it silently. Criteria written as direct pure-function calls need no hardening and
cannot be hardened.

- **P1** — A student recorded `present` / `qr` / `hoursOverride: 3` / both timestamps set, who also
  RSVP'd `going`: the emitted payload carries **all five** through unchanged.
  **Five mutations**, one per field. *(This is the bug. It is the reason the row exists.)*
- **P2** — A `going`-RSVP student with **no** recorded row is written exactly as today:
  `status: 'present'`, `checkInAt`/`checkOutAt` `null`, `method: 'coach'`, `hoursOverride: null`.
  **Mutation:** `method: resolveAttendanceWriteMethod(existing?.method ?? 'qr')`.
  *This is the criterion `MarkEventCompleteDialog.test.tsx:206-216` currently pins; expect to extend
  that test rather than duplicate it.*
- **P3** — A student with a recorded **attending** row and **no RSVP** is included.
  **Mutation:** revert to RSVP-only seeding. *(§4's decision; if the owner overrules, this criterion
  inverts and P4 stands unchanged.)*
- **P4** — A student with a recorded **`absent`** row who RSVP'd `going` is **excluded**.
  **Mutation:** treat any recorded row as attending.
- **F1** — Load **rejects**: the confirm action is **disabled**, an error `Banner` is shown, and
  `onMarkSessionComplete` is called **zero times**. **Mutation:** fall back to RSVP-only seeding and
  proceed.
  **Written naively this criterion is VACUOUS — the gate measured it passing, and staying green
  under its own mutation.** "Zero times" is free when there is nothing to write. All four clauses
  below are mandatory:
  1. a fixture with **at least one `scheduled`** session, plus `expect(confirmButton).toBeDefined()`
     — proving a button exists to be disabled, rather than `remaining` being empty;
  2. an **actual click** on the disabled button before the zero-times assertion;
  3. `expect(loadAttendance).toHaveBeenCalledTimes(1)` — a mock that never intercepts leaves the
     *real* loader rejecting, which produces an identical error state. §5's mock-hardening rule
     applies to F1 too;
  4. then `expect(onMarkSessionComplete).toHaveBeenCalledTimes(0)`.
  *So constructed, the gate verified it goes red under the named mutation. This would have been the
  project's eighth vacuous absence assertion.*
- **F1b — the `handleConfirm` guard has NO criterion, deliberately.** You must still write
  `if (attendanceState.status !== 'success') return;` in `handleConfirm` as defence in depth, but be
  aware that **its mutation is green**: jsdom's `disabled` attribute suppresses the dispatched click,
  so F1 passes with the guard removed. This is stated so you do not discover the green mutation and
  conclude the guard is dead code — the same trap T305's W2 set. Do not delete it; do not invent a
  criterion for it.
- **F2** — Load **in flight**: confirm disabled, `onMarkSessionComplete` called zero times.
  **Mutation:** enable confirm while loading.
- **F3** — Error state's **retry** re-runs the load, and on success the confirm becomes enabled.
  **Mutation:** make retry a no-op.
- **L1** — `loadAttendance` is called **once**, with **exactly the `remaining` session ids** — not
  `skipped` ones, not one call per session. **Mutation:** pass `sessions.map(s => s.id)`. Requires a
  fixture with at least one already-`completed` or `canceled` session.
- **B1** — The per-session outcome tracking, sequential ordering and partial-failure summary are
  unchanged. **Mutation:** any change to the `for (const session of remaining)` loop's ordering.
  *This component's existing tests cover the batch semantics; do not regress them.*

**Expected, authorized, and NOT a regression: four existing tests in
`MarkEventCompleteDialog.test.tsx` require updating.** That file has **no `vi.mock`** of
`loaders/attendance` and passes no `loadAttendance`, and its four write-path tests click confirm
**synchronously** (`:346`, `:403`, `:439`, `:468`). Under §3's rule the load has not settled, so the
button is disabled and the click is a no-op. Gate-measured:

```
Tests  4 failed | 11 passed (15)     # no mock at all — real loader rejects, error state renders
Tests  4 failed | 17 passed (21)     # loadAttendance injected, but still clicking synchronously
Tests 21 passed (21), exit 0         # + one await flushMicrotasks() before each click
```

**This is the exact inverse of T305**, where a graceful fallback kept the un-mocked file green and
the gate had to argue that a green count proved nothing. Here the new contract announces itself.
**Authorized change: inject/mock the loader and add one `await flushMicrotasks()` before each of
those four clicks. Nothing else.** Do not weaken, delete or retarget any assertion — if you find
yourself doing that, stop and file a dispute.

---

## 6. Out of scope — report, do not fix

- **`loaders/outreach.ts`.** The root asymmetry (§2) is that `makeMarkDayComplete`'s upsert names
  `check_in_at`/`check_out_at` at all, where `makeUpsertAttendance` deliberately does not. Removing
  them would be a smaller fix than this whole packet — **and it is still wrong to do here**, because
  it orphans `OutreachAttendanceWriteRow.checkInAt`/`checkOutAt`, and a payload field the loader
  silently ignores is its own lie. Removing them *properly* changes `MarkDayCompletePayload`'s
  shape, which reaches T305's dialog, both test files and `OutreachDetail.tsx`. **File it as a
  follow-up**; do not touch the loader.
- **`loaders/outreach.ts:125-128`** — *"`checkInAt`/`checkOutAt` pass through as `null` verbatim"*,
  false after T305 and doubly so after this. Report it with the row above; it is not in your files.
- **T308** — the confirm-label-vs-`v_student_hours` divergence. Filed, unrelated to this surface.

---

## 7. Module-doc claims to correct

**T305's §5.1 corrections DID land — the gate verified them at `:22`, `:50-64` and `:183-190`.**
Do not redo them. Newly false after *your* change:

- **`:50-64`** (module doc #2(a)) — T305 rewrote this to say the bulk path still uses RSVP-only
  seeding and that its destructive behaviour is filed as T307. **You are the T307 that fixes it**, so
  the whole paragraph needs rewriting again: §4 changes what is written, §3 adds real async states.
- **`:183-190`** — T305's note that this call site "passes an empty recorded-rows argument,
  preserving this bulk path's exact pre-T305 behaviour." No longer true.
- **The load seam and the §3 failure rule need their own module-doc section**, stating the
  asymmetry with T305 explicitly (§3).

---

## 8. Gates — all six, `.env.local` ABSENT

**Post-merge baselines, measured at `e583e89` with `.env.local` absent** — use these, not T305's
packet's pre-merge figures: `tsc` 0 · `vite build` ✓ · prettier clean · eslint **0 errors / 361
warnings** · vitest **72 files / 1767 tests** exit 0 · `MarkEventCompleteDialog.test.tsx` **15** ·
`OutreachDetail.test.tsx` **95**. Re-measure on your own branch point and report both.

```
npx tsc --noEmit                 (expect exit 0)
npx vite build                   (expect success)
npm run format:check             (expect clean)
npx eslint .                     (0 errors; report the count, explain any rise)
npx vitest run                   (report totals against your measured base)
npx vitest run src/pages/outreach/MarkEventCompleteDialog.test.tsx >/dev/null 2>&1; echo $?
npx vitest run src/pages/outreach/OutreachDetail.test.tsx >/dev/null 2>&1; echo $?
```

Both targeted exits must be `0`. **A green pass count with a nonzero exit code is a real failure on
this project** and T305's criterion S4 reproduces it deliberately.

**`OutreachDetail.test.tsx` WILL break, and v1 predicted the wrong reason.** v1 said the resolved-`[]`
mock at `:110-118` keeps it green and warned only about a *rejecting* mock. Both statements are true
and both miss it. Gate-measured, with that mock exactly as it is:

```
AssertionError: expected "spy" to be called 2 times, but got 0 times
  ❯ src/pages/outreach/OutreachDetail.test.tsx:1217
  ❯ src/pages/outreach/OutreachDetail.test.tsx:1255
Tests  2 failed | 93 passed (95)
```

It fails in the **loading** state, not the error state. Both tests open the dialog and click
"Mark 2 sessions complete" synchronously with no flush in between (`:1204-1211`, `:1245-1252`), so
the promise has not settled and §3's rule disables the button. A resolved `[]` does not save you.
**Measured fix: one `await flushMicrotasks()` before each `confirmButton` lookup → `95 passed`,
exit 0.** This is authorized; nothing else in that file may change.

---

## 9. Allowed files

- `src/pages/outreach/MarkEventCompleteDialog.tsx`
- `src/pages/outreach/MarkEventCompleteDialog.test.tsx`
- `src/pages/outreach/OutreachDetail.test.tsx` — **test-only, and now unconditionally required**
  (§8: two tests need a flush before their click)
- `docs/swarm/active/T307-worker-output.md` (create)

**Authorized local re-derivation, so a checker does not flag it.** `buildAttendanceWriteRows`' fifth
parameter wants recorded rows keyed by student id, but T305's `buildRecordedRowsByStudentId`
(`MarkDayCompleteDialog.tsx:608`) is deliberately **not exported**, and that file is Forbidden.
`computeInitialFormSeed` (`:630`) *is* exported and implements §4's rule exactly, but returns only
`checkedStudentIds`/`hoursOverrideByStudentId` — not the map you need. **Write the four-line
filter-and-key locally in `MarkEventCompleteDialog.tsx`.** This is in mild tension with that file's
own module doc #1 (*"REUSE, DON'T RE-DERIVE … the single most important discipline in this file"*),
so say so in a comment naming this authorization. Do not export the helper from
`MarkDayCompleteDialog.tsx` — that widens a Forbidden file.

Everything else Forbidden, including `loaders/outreach.ts`, `loaders/attendance.ts`,
`MarkDayCompleteDialog.tsx`, `AttendancePanel.tsx`, `OutreachDetail.tsx` and all migrations. If you
conclude one must change, **file a dispute rather than changing it.**

Work in your own git worktree (item 23). Stage with explicit pathspecs, never `git add -A` (item 22).
Report the commit SHA and verify HEAD actually moved (item 21). Include a **"Deferred — for the
ledger"** section (item 20) carrying §6's three items. You do not self-certify.
