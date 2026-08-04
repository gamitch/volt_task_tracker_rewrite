# T196 — worker packet **v2**: mount `EndMeetingDialog` on `LiveConsole`

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
existing dialog test passes unchanged, that suppresses **only the attendance-correction `List`**
(`:822-840`) in the `status === 'completed'` branch. **The banner at `:805-809` still renders.**

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
| C4 | **The identity is resolved at CALL time** | `useMemo(() => makeOnEditAttendance(() => user?.id ?? null), [])` — **this is the mutation that bites; "freeze at construction" is a no-op and must not be used** |
| C5 | **Post-completion, the console renders NO attendance-correction list** — owner ruling 1 | pass the suppression prop as `true`/omit it → the list returns and a student appears twice |
| C6 | The "meeting has ended" banner **still renders**, and its copy no longer claims corrections are recorded | delete the banner; separately, restore the old copy |
| C7 | Suite green, **including the two updated tests** | — |

**C4 and C5 are the two that matter.** C4 must **change identity between renders** and assert the
*second* edit carries the *second* identity — the gate confirmed `LoginAs`
(`test-utils/authHarness.tsx:131`) supports this with **no new infrastructure**. C5 is the
owner-ruled defect; a test that only counts controls is not enough — assert a **student name appears
once**.

**Item 23: mutate in your own worktree, never the shared tree. Commit before mutating.** Record each
mutation's exact failing assertion and exit code, restore, verify `git diff --quiet`. **A green suite
at exit 0 after a mutation means that criterion is not covered — say so.**

## 8. Required output

- C1–C7 with **real** mutation output (failing assertion + exit code)
- Gates: `tsc`, `eslint`, `prettier`, `vitest`. **Base: `tsc` 0 · 78 files / 1950 tests, exit 0.**
- A `git diff` of `LiveConsole.tsx` showing only the stub removal, the mount, and the seams
- Confirmation that **only** `:845` and `:864` changed in `LiveConsole.test.tsx`
- Anything found and not fixed, **filed**. Block: **T600–T699**.
