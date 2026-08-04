# T196 — worker packet: mount `EndMeetingDialog` on `LiveConsole`

**Branch `claude/t196-endmeeting-mount`. Base `aabc7f1`. HEAVY tier.**
Baseline measured by the orchestrator at base: `tsc` **0** · vitest **78 files / 1950 tests, exit 0**.

**Scope note that changes what this row is.** The ledger calls T196 *"a project, not a ticket."* That
was written when the mount required building a real console first. **T403 did that.** Measured today:
`EndMeetingDialog` is built and tested, all three backends in `endMeeting.ts` are built and tested,
and the three props line up **one-to-one** with the three factories. **This is wiring.** If you find
yourself designing something, stop and raise it — you have left the row.

## 1. Ownership — read before touching anything

`LiveConsole.tsx` is **W1's file**. **Owner ruling 2026-08-04 grants W3 this file FOR THIS MOUNT
ONLY** (`auto-mode-decisions.md`). You may:

- replace `handleEndMeetingClick` (`:1152-1158`) and its `StubBanner` render (`:1184-1186`)
- render `EndMeetingDialog` wired to the three real backends

**You may NOT touch**, and changing any of them means you have left the grant — **stop and report**:
the roster query, the QR/short-code panel, `makeDefaultSetAttendanceStatus` or any attendance-write
internal, `AttendanceRecordState`, or `Kiosk.tsx`.

**T400 is NOT in this wave** (same ruling, un-sequenced). Do not build a session picker.

## 2. Ground truth — every line verified at base, not inherited

| Fact | Verified |
|---|---|
| `EndMeetingDialogProps` = `{ sessionId, loadSummary?, onEndMeeting?, onEditAttendance? }` | ✅ `EndMeetingDialog.tsx:642-660` |
| Three factories exist | ✅ `endMeeting.ts:288` `makeLoadEndMeetingSummary`, `:373` `makeOnEndMeeting`, `:448` `makeOnEditAttendance` |
| `makeOnEditAttendance(getRecordedBy: () => string \| null, getClient?)` | ✅ `endMeeting.ts:448-451` |
| The dialog renders its **own** "End meeting" button | ✅ `EndMeetingDialog.tsx:779` |
| `LiveConsole` has `useAuth()` | ✅ `:464` import, `:974` `const { user } = useAuth()` |
| `LiveConsole` already derives the same identity | ✅ `:1065` `const recordedBy = user?.id ?? null;` |
| `profiles.id` **references** `auth.users(id)` — so `user.id` IS a valid `recorded_by` | ✅ `20260716000000_identity_roster.sql:17` |
| The stub to replace | ✅ `:1152-1158` `handleEndMeetingClick`, `:1181` the Button, `:1184-1186` the banner |

**`EndMeetingDialog` is currently mounted nowhere** — grep-verified, only `endMeeting.ts:202` and its
test import from it.

## 3. ⚠️ THE TRAP — a stale identity closure

`makeOnEditAttendance` takes `getRecordedBy` and **calls it fresh on every invocation**.
`endMeeting.ts:106-114` says so explicitly and names this task:

> `getRecordedBy` is called FRESH on every invocation of the returned function, never read once at
> factory-construction time, so it stays correct behind a `useRef`-backed accessor that changes
> across renders **once T196 wires this factory to a real `useAuth()` ref**.

**The defect this invites:** memoising the factory —

```tsx
const onEditAttendance = useMemo(() => makeOnEditAttendance(() => user?.id ?? null), []); // ❌ WRONG
```

— bakes the `user` from first render. After a re-auth or a slow profile resolve, every subsequent
edit is attributed to a **stale or null** identity. `recorded_by` is who the app says changed a
student's attendance, so this writes a **wrong name onto a real record**.

**Either** omit the memo so a fresh closure is built each render, **or** memoise with a ref whose
`.current` is updated on every render. **Do not memoise a closure over `user` with an empty dep
array.** Whichever you choose, **C4 must prove it.**

## 4. The wiring

Replace the stub. The dialog brings its own button, so the existing `<Button label="End meeting" …>`
at `:1181` **goes away** — do not wrap the dialog in it or you will get two buttons.

```tsx
<EndMeetingDialog
  sessionId={/* the session this console is showing */}
  loadSummary={makeLoadEndMeetingSummary()}
  onEndMeeting={makeOnEndMeeting()}
  onEditAttendance={makeOnEditAttendance(getRecordedBy)}
/>
```

`getRecordedBy` must resolve `user?.id ?? null` **at call time** — mirroring `:1065`, which is the
shipped precedent in this same file.

**Null identity is already handled downstream** — `makeOnEditAttendance` rejects before any network
call, with the same message `makeDefaultSetAttendanceStatus` uses (`:608-610`). **Do not add a second
guard in the console**; let the existing one fire.

**Delete `endMeetingStub` state and `StubBanner` usage only if nothing else uses them.** `:994` says
the "one slot" convention is shared — **grep before deleting**, and if another stub uses it, leave
the state and remove only the end-meeting path.

## 5. Acceptance criteria

| # | Criterion | Mutation → must go RED at exit 1 |
|---|---|---|
| C1 | The dialog is really mounted and the stub is gone | render the console; assert the stub's copy (*"End-meeting summary not built yet"*) is **absent** and the dialog's own affordance present |
| C2 | `loadSummary` is wired to the real factory, not the fixture default | pass no `loadSummary` (fall back to `defaultLoadEndMeetingSummary`) |
| C3 | `onEndMeeting` is wired to the real factory | pass no `onEndMeeting` |
| C4 | **`getRecordedBy` resolves at CALL time, not construction time** | freeze it at construction (`const id = user?.id; () => id ?? null`), then change the auth identity between renders and invoke an edit |
| C5 | A null identity still rejects before any network call | make `getRecordedBy` return a non-null constant |
| C6 | Suite green | — |

**C4 is the criterion that matters.** A test that only checks "some id was passed" cannot catch a
stale closure. It must **change the identity between renders** and assert the *second* edit carries
the *second* identity. If your C4 passes with the frozen-at-construction mutation applied, it is not
testing what it claims — say so rather than adjusting it.

**Item 23: mutate in your own worktree, never the shared tree. Commit before mutating.** Record each
mutation's exact failing assertion and exit code, then restore and verify `git diff --quiet`.

## 6. Required output

- C1–C6, each with its mutation's **real** output (failing assertion + exit code)
- Final gates: `tsc`, `eslint`, `prettier`, `vitest`. **Base: `tsc` 0 · vitest 78 files / 1950
  tests, exit 0.** If yours differ, say so plainly rather than restating these.
- Confirmation that nothing outside the grant in §1 was modified — a `git diff` of `LiveConsole.tsx`
  showing only the stub replacement and the mount
- Anything found and not fixed, **filed** rather than dropped. Block: **T600–T699**.
