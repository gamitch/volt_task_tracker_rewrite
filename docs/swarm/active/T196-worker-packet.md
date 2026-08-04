# T196 — worker packet **v3**: mount `EndMeetingDialog` on `LiveConsole`

> ## ✅ UNPARKED 2026-08-04 — both MAJORs closed by owner ruling. DISPATCH.
>
> Gate rounds 1 and 2 are spent (item 19a); **round 2 found NO BLOCKER**. Both its MAJORs were
> owner decisions, and both are now made:
> - **MAJOR-A** — test approval extended to `LiveConsole.test.tsx:868`, scoped to the two `it`
>   blocks `:839-855` and `:857-869`.
> - **MAJOR-B** — **C4 is DROPPED.** See §7.
>
> **v3 also folds in the six MINOR findings** round 2 raised that were never addressed because the
> row parked. **Every corrected citation below was re-verified by the orchestrator against the file,
> not copied from the gate's report.**
>
> **⚠️ A verified-green reference implementation exists at
> `docs/swarm/active/T196-reference-implementation.diff`** — the round-2 gate built this whole
> prescription and measured it at `tsc` 0 · eslint 0 · prettier clean · **78 files / 1952 tests,
> exit 0**. **Read it before writing code.** You are not starting from scratch.

**Branch `claude/t196-endmeeting-mount`. HEAVY tier.** Base measured: `tsc` **0** · vitest
**78 files / 1950 tests, exit 0**.

**Gate round 1 returned REVISE — 3 BLOCKER, 3 MAJOR, 3 MINOR, 2 NIT. This is the revision.** Round 2
is the last (item 19a). The gate **built v1's prescription and ran it**; every finding below is
measured, not argued.

> ### What v1 got wrong. Stated so it is not re-derived.
>
> 1. **v1 said this row's "a project, not a ticket" framing was stale and "this is wiring."**
>    **Wrong.** The mount breaks two green tests, needs an interface change, and produced a
>    data-integrity defect. **The row was right.**
> 2. **C4's mutation was vacuous.** "Freeze `getRecordedBy` at construction" is a **no-op** for a
>    factory called inline in JSX — construction time *is* every render. The gate applied it
>    verbatim and C4 stayed **green**.
> 3. **§3's "omit the memo" advice was a performance defect.** Measured: `loadCalls after mount: 4 |
>    after 5 keystrokes: 9` — one **4-query** reload per parent re-render, and the panel drops to a
>    spinner on every keystroke.
> 4. **v1 claimed the dialog's button renders unconditionally.** It renders **only** for
>    `loadState === 'success' && session.status === 'scheduled'`.

## 1. Ownership — grant, now extended

`LiveConsole.tsx` is W1's; **owner ruling 2026-08-04 grants it to W3 for this mount only.**
**Extended by ruling 3 (same date) to:**

- **`LiveConsole.test.tsx`** — **`:845` and `:864` ONLY.** Both assert the stub this row deletes.
  **This is the explicit test-update approval** non-negotiable #2 and DoR #5 require. **No other test
  in that file may be touched.**
- **`LiveConsoleBodyProps`** — to add the injectable seams §5 needs. It is an exported interface;
  the grant names it deliberately.
- **`EndMeetingDialog.tsx`** — W3's own file, always in scope.

**Still NOT yours** — touching any of these means you have left the grant, so **stop and report**:
the roster query, the QR/short-code panel, `makeDefaultSetAttendanceStatus` or any attendance-write
internal, `AttendanceRecordState`, `Kiosk.tsx`, or any other test in `LiveConsole.test.tsx`.

**T400 is not in this wave.** Do not build a session picker.

## 2. Ground truth — re-verified, with v1's errors corrected

| Fact | Status |
|---|---|
| `EndMeetingDialogProps` = `{ sessionId, loadSummary?, onEndMeeting?, onEditAttendance? }` | ✅ `EndMeetingDialog.tsx:642-659` *(v1 said `:642-660`)* |
| `makeLoadEndMeetingSummary:288` · `makeOnEndMeeting:373` · `makeOnEditAttendance:448` | ✅ |
| `makeOnEditAttendance(getRecordedBy: () => string \| null, getClient?)` | ✅ `:448-451` |
| **The dialog's "End meeting" `<Button>` is `:778` (label `:779`) and renders ONLY inside `loadState.status === 'success' && data.session.status === 'scheduled'`** (`:753`, `:776`) | ⚠️ **v1 read this as unconditional. It is not.** |
| `LiveConsole` has `useAuth()` | ✅ `:464`, `:974` |
| `LiveConsole:1065` `const recordedBy = user?.id ?? null;` — inside `handleSetStatus`, a genuine call-time precedent | ✅ |
| `attendance.recorded_by` → **`public.profiles(id)`** (`20260717000000_scheduling_attendance.sql:91`), and `profiles.id` → `auth.users(id)` (`20260716000000_identity_roster.sql:17`). **Both links matter**; v1 omitted the first | ✅ corrected |
| Stub: `:1152-1158` handler, `:1181` Button, `:1184-1186` banner, `:989` state | ✅ |
| `getRecordedBy` is read inside the returned function (`endMeeting.ts:472-476`), quoted at `:112-116` *(v1 said `:106-114`)* | ✅ |
| `EndMeetingDialog` mounted nowhere today | ✅ |

## 3. ⚠️ THE DESIGN — owner-ruled after seeing it rendered. Read before writing code.

**The mount was built and screenshotted. In the completed state, `Ada Q.` appeared TWICE with
contradictory statuses** — `Absent` in the dialog's correction list, `Present` in the console's
roster, from two unsynchronised write paths.

**Owner ruling 1: post-completion, ONLY the console's own roster and check-in panel render.** The QR
panel stays useful after the meeting ends — a student leaving who forgot to scan can still check in.

**Owner ruling 2: keep the "This meeting has ended" banner, with corrected copy.**

### What to build

**In `EndMeetingDialog.tsx` (W3's own file):** add an optional prop, default **`true`** so every
existing dialog test passes unchanged, that suppresses **the whole
`roster.length === 0 ? EmptyState : List` ternary (`:821-839`)** in the `status === 'completed'`
branch — **not just the `List`.** **The banner at `:805-809` still renders.**

**Why the whole ternary:** the gate measured that suppressing only the `List` leaves the dialog's
`EmptyState` rendering for an empty completed roster — so *"No students on this roster"* appears
**twice** on one screen (dialog `:822-825` plus console `:1234-1240`), under a banner promising
*"Attendance stays editable below"* with nothing editable below.

**Name the prop `hasAttendanceCorrections`, default `true` (= shown).** The console passes `false`.
Defaulting `true` is what keeps all 21 existing `EndMeetingDialog` tests passing unchanged — the
gate verified that.

**Fix that banner's copy — it is FALSE.** It currently reads *"Attendance stays editable below;
corrections are recorded automatically."* **The second clause describes
`trg_audit_attendance_post_completion`, removed 2026-08-03 by owner ruling.** Corrections are
recorded nowhere, deliberately. Keep *"Attendance stays editable below"* — true both when the
dialog renders its own list and when the console's roster is what sits below. **Drop the false
clause.** This is a real correctness fix, not copy polish, and it applies to the dialog's standalone
use too.

**In `LiveConsole.tsx`:** pass the prop so the correction list never renders there.

**Do NOT** gate the mount on session status from the console side. `LiveConsoleSessionInfo`
(`:553-558`) has **no `status` field**; adding one means changing W1's loader, outside your grant.

## 4. ⚠️ THE IDENTITY TRAP — and the memo rule, which v1 got backwards

`makeOnEditAttendance` calls `getRecordedBy` **fresh on every invocation** (`endMeeting.ts:472-476`).

**The defect:** `useMemo(() => makeOnEditAttendance(() => user?.id ?? null), [])` bakes the first
render's `user`. Measured by the gate: **`recordedBy: null` on both edits.** Dominant case is a
rejected write (auth resolves async, so first render's `user` is `null`); the rarer stale-but-non-null
re-auth case writes a **wrong** `recorded_by`.

**The memo rule, corrected — v1's blanket "omit the memo" was wrong:**

| Prop | Rule | Why |
|---|---|---|
| `loadSummary` | **`useMemo(..., [])`** | `useLoadState` re-runs on `[loadSummary, sessionId, retryToken]` (`EndMeetingDialog.tsx:576-599`). A new instance per render = **one 4-query reload per parent re-render**, and the panel drops to a spinner mid-render. Measured: 4 calls on mount, 9 after five keystrokes. |
| `onEndMeeting` | **`useMemo(..., [])`** | closes over nothing |
| `onEditAttendance` | **must stay fresh** | see below |

**Recommended for the identity — mirrors this file's own shipped precedent at `:1065`:**

```tsx
const getRecordedBy = useCallback(() => user?.id ?? null, [user]);
```

No ref, no escalation. A ref-backed `useMemo(..., [])` is also acceptable. **What is NOT acceptable
is a `useMemo` closing over `user` with an empty dep array.**

## 5. Seams, and why they are in the grant

`LiveConsoleBodyProps` (`:959-964`) has no `loadSummary` seam. Without one, the real loader always
rejects in test, the dialog renders *"Couldn't load this meeting"*, and **its button never exists —
so C1, C3, C4 and C5 cannot be measured at all.** Add the three seams; default them to the real
factories so production behaviour is unchanged.

## 6. Cleanup that `tsc` will force

Deleting `:1181`/`:1184-1186`/`:989` leaves `StubBanner` (`:834`) and `StubNotice` (`:839`)
**unused** — `tsc` fails `TS6133: 'StubBanner' is declared but its value is never read`. **Delete the
declarations, not just the usages.** `:313`'s module doc references `StubBanner` and goes stale too.

**Nothing shares `endMeetingStub`.** `:994`'s "one slot" comment describes `attendanceWriteError`
(`:995`), a *separate* `useState`. v1 told you to grep before deleting; the grep is done — **delete
it.**

## 7. Acceptance criteria

**Already covered — do NOT re-test, cite instead:** `endMeeting.test.ts:626` (*"reads getRecordedBy
FRESH on every call… not baked at construction"*) and `:640` (*"null identity rejects before any
network call"*). **v1's C4 and C5 duplicated these.** Yours are **console-level** criteria.

| # | Criterion | Mutation → must go RED at exit 1 |
|---|---|---|
| C1 | The dialog is mounted; the stub is gone | assert the stub copy absent **and** the dialog's button present (needs the `loadSummary` seam) |
| C2 | The console passes the **real** `loadSummary`, not the fixture default | omit the prop → falls back to `defaultLoadEndMeetingSummary` |
| C3 | The console passes the real `onEndMeeting` | omit the prop |
| ~~C4~~ | ~~identity resolved at call time~~ — **DROPPED by owner ruling; see below** | — |
| C5 | **Post-completion, the console renders NO attendance-correction list** — owner ruling 1 | pass the suppression prop as `true`/omit it → the list returns and a student appears twice |
| C6 | The "meeting has ended" banner **still renders**, and its copy no longer claims corrections are recorded | delete the banner; separately, restore the old copy |
| C7 | Suite green, **including the two updated tests** | — |

### ⚠️ C4 IS DROPPED — and the reason matters more than the criterion

**Owner ruling 2026-08-04.** C4 asked for a test proving the acting-coach identity is read at click
time rather than baked at page load. **That test cannot be written on this surface, and the cause is
ruling 1 itself.**

`AttendanceCorrectionRow` (`EndMeetingDialog.tsx:829-836`) is the **only** caller of
`handleEditAttendance`, which is the only caller of `onEditAttendance`. **Ruling 1 suppresses the
correction list — so nothing left in the console can invoke that path at all.** Measured by the
gate: post-completion the console renders exactly one "Ada Q.", whose control writes through
`onSetAttendanceStatus`, not `onEditAttendance`. Any C4 test would have to reach in through
`vi.mock` and would prove only that a wire is attached to a switch nobody can flip.

**Nothing gets less safe.** `endMeeting.test.ts:626` already proves the fresh-read contract
(*"reads getRecordedBy FRESH on every call of the SAME returned function, not baked at
construction"*), and the console's own live-identity path at `LiveConsole.tsx:1065` is covered by
passing tests.

**Still build the identity wiring correctly** — `useCallback(() => user?.id ?? null, [user])`. It is
cheap, correct, and the moment anything re-exposes `onEditAttendance` it is already right. **You just
do not write a test for it.**

**C5 is now the criterion that matters.** It is the owner-ruled defect. A test that only counts
controls is not enough — **assert a student name appears exactly once**.

**Item 23: mutate in your own worktree, never the shared tree. Commit before mutating.** Record each
mutation's exact failing assertion and exit code, restore, verify `git diff --quiet`. **A green suite
at exit 0 after a mutation means that criterion is not covered — say so.**

## 8. Required output

- C1–C7 with **real** mutation output (failing assertion + exit code)
- Gates: `tsc`, `eslint`, `prettier`, `vitest`. **Base: `tsc` 0 · 78 files / 1950 tests, exit 0.**
- A `git diff` of `LiveConsole.tsx` showing only the stub removal, the mount, and the seams
- Confirmation that **only** `:845` and `:864` changed in `LiveConsole.test.tsx`
- Anything found and not fixed, **filed**. Block: **T600–T699**.

---

## 9. v3 addenda — the round-2 MINORs, and the trap in v2's own §5

**These were raised by gate round 2 and never fixed, because the row parked before they could be.
Every citation below was re-verified by the orchestrator against the file.**

### ⚠️ 9a. v2's §5, read literally, RE-CREATES the defect §4 warns about

**Do not write `loadSummary = makeLoadEndMeetingSummary()` as a default parameter.** A
default-parameter expression **re-evaluates on every render**, so the prop identity changes every
time — and `useLoadState` re-runs on `[loadSummary, sessionId, retryToken]`. Measured by the gate:
**`mount=4, after5keys=9`** — one 4-query reload per parent re-render, with the panel dropping to a
spinner mid-keystroke.

**Use a module-level `const`, which this file already ships at `LiveConsole.tsx:616`**
(`export const defaultSetAttendanceStatus = makeDefaultSetAttendanceStatus()`). Measured: **`1` and
`1`, with zero hooks.** That is cheaper than the `useMemo(..., [])` v2 prescribed and removes the
trap entirely.

**`onEditAttendance` is the exception — it cannot be a module-level const**, because it must close
over `user`. Use `injectedOnEditAttendance ?? useMemo(() => makeOnEditAttendance(getRecordedBy),
[getRecordedBy])` with `getRecordedBy = useCallback(() => user?.id ?? null, [user])`.

### 9b. C6 is half pre-covered — cite, don't re-test

`EndMeetingDialog.test.tsx:377` and `:429` **already** go red if the banner is deleted (gate
measured 2 failed | 19 passed). **Your new C6 test asserts the COPY only** — that the text no longer
claims corrections are recorded. The "banner still renders" half is already proven; cite it.

### 9c. Where the new tests live, and one harness prerequisite

§1 authorizes only two `it` blocks in `LiveConsole.test.tsx`, so the new console-level tests have no
authorized home there. **Create `src/pages/meetings/LiveConsole.endMeeting.test.tsx`.**

**C3 needs a polyfill.** Driving the confirm `AlertDialog` in jsdom fails with
`TypeError: dialog.showModal is not a function`. `LiveConsole.test.tsx` has none; precedent to copy
is `EndMeetingDialog.test.tsx:60-68` (also `MeetingsList.test.tsx:147-155`,
`ScheduleMeetingsDialog.test.tsx:63-71`). With it, C3 measures 1 payload / 0 mutated.

### 9d. Corrected citations — v2 had six wrong (item 19c)

| v2 said | Actually | Verified |
|---|---|---|
| `:753` success gate | **`:764`** | ✅ `{loadState.status === 'success' && data !== null` |
| `LiveConsoleSessionInfo :553-558` | **`:541-546`** (`:553` is `LiveConsoleData`) | ✅ |
| `StubBanner :834` / `StubNotice :839` | **swapped** — `:834` is `interface StubNotice`, `:839` is `function StubBanner` | ✅ |
| `endMeeting.ts:472-476` fresh read | **`:468`** (`:472` is the `await`) | ✅ |
| correction block `:822-840` | **`:821-839`** | ✅ |
| base **1950** tests | **1952** at the merge point — **measure your own** | ✅ |

### 9e. File, do not fix (item 20) — block T600–T699

- **`endMeeting.ts:8`, `:12-19`, `:114-118`, `:443-446`** still say T196 is unwired and
  `EndMeetingDialog.tsx` is frozen. Stale once this lands; that file is **outside this grant**.
- **`makeOnEditAttendance` will have NO reachable caller in the product** once ruling 1 lands (see
  §7). File it as a ledger row so it is a decision rather than drift.
