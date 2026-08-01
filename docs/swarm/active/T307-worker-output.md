# T307 — worker output

**Worker:** worker-implementer (sonnet), own git worktree, branch
`claude/t307-bulk-complete-preserve` cut from `7f076b0`
(`claude/t305-attendance-over-rsvp`, which already carries `e583e89` and the T307 packet v2 doc).

**Commit:** see the commit created immediately after this file (this file is part of that same
commit; `git log` / `git show --stat` on the branch will show the SHA). HEAD moved from `7f076b0`
to that commit inside this worktree, and the change is in the committed blob — verified by
`git show <SHA>:src/pages/outreach/MarkEventCompleteDialog.tsx` containing the new module doc #6
and `buildMarkEventCompletePayload`'s sixth parameter (checked before writing this report).

## Files changed

- `src/pages/outreach/MarkEventCompleteDialog.tsx` — the load seam, the block-on-failure rule,
  §4's seeding decision threaded through `buildMarkEventCompletePayload`'s new required
  `recordedRows` parameter, and module-doc corrections (§7).
- `src/pages/outreach/MarkEventCompleteDialog.test.tsx` — extended the existing P2 pin with the
  new argument (not duplicated); added P1/P3/P4 (pure-function) and F1/F2/F3/L1 (DOM) criteria;
  injected a resolved `loadAttendance` + one `await flushMicrotasks()` before each of the four
  write-path clicks named in §5/§8 (authorized change, nothing else).
- `src/pages/outreach/OutreachDetail.test.tsx` — one `await flushMicrotasks()` added before each
  of the two `confirmButton` lookups named in §8. Pure addition; `git diff | grep '^-' | grep -E
  'expect|toBe|toEqual|toHave'` on both test files returns nothing — no assertion removed,
  weakened, or retargeted.
- `docs/swarm/active/T307-worker-output.md` (this file, new).

No other files touched. `git status --short` shows exactly these four paths.

## Summary of the change

`buildMarkEventCompletePayload` gained a required sixth parameter, `recordedRows: readonly
AttendanceRow[]` — this event's loaded `attendance` rows. It now seeds the checklist via
`computeInitialFormSeed` (recorded-attending-row-or-`going`-RSVP, T305's rule) instead of
RSVP-only `computeInitialAttendedStudentIds`, and threads a locally-rederived
`recordedRowByStudentId` map into `buildAttendanceWriteRows`' (already-required, T305-added) fifth
parameter instead of an empty object. That stops the destructive overwrite.

The component gained an injectable `loadAttendance` prop (default: the real
`loadAttendanceForSessions`), a three-state `attendanceState` union
(`loading`/`error`/`success`), and an effect that loads once for every `remaining` session id,
gated on `isOpen` (not mount). The confirm button is disabled whenever `attendanceState.status !==
'success'`; the error state renders a real `Banner` with a working retry. `handleConfirm` carries
a second, defence-in-depth guard for the same condition (F1b — no possible criterion, kept anyway).

**This failure rule is the deliberate opposite of `MarkDayCompleteDialog.tsx`'s (T305):** that
dialog may fall back to RSVP-only seeding on load failure because a coach reviews an editable
checklist before confirming; this dialog has no checklist and no review step, so falling back
would silently reintroduce the exact bug this task fixes. Disclosed in the module doc (new §6),
naming T305's opposite choice explicitly so a future reader does not "harmonise" them.

## A rendering issue I found and fixed, not in the packet

While verifying `OutreachDetail.test.tsx`'s full 95-test file (not just the two named tests),
building the loading-state UI regressed an unrelated, pre-existing test:
`T169 empty case (§5g) … sees no self-RSVP control or section anywhere, and the rest of the page
renders undisturbed`, for a **student viewer**. Root cause: `MarkEventCompleteDialog` is mounted
whenever `user !== null` (not staff-gated — the surrounding `OutreachDetail.tsx` comment says this
plainly, and it is Forbidden/read-only here), and its `Dialog`/`Layout` content is present in the
DOM even while `isOpen={false}` (Astryx's `Dialog` hides it visually, not structurally). My
initial loading-state region (`aria-busy="true"` on a `Text`) therefore leaked into every page this
component is mounted on, for every signed-in viewer, at all times — and that unrelated test's
`expect(container.querySelector('[aria-busy="true"]')).toBeNull()` caught it.

**Fix:** gated the loading/error region additionally on `isOpen` (`isOpen && !hasStarted &&
attendanceState.status === '...'`). Disclosed in-source (the block's own comment) and here. This
is a real, previously-undocumented fact about the component (content renders while closed) that the
packet did not know to warn about, since it only discussed `isOpen`-gating the *load effect*, not
the *rendering*. Full suite re-run after the fix: 72 files / 1774 tests, exit 0, including this
exact test.

## Gates (§8), `.env.local` absent

```
$ ls -la .env.local
ls: cannot access '.env.local': No such file or directory

$ npx tsc --noEmit
(no output, exit 0)

$ npx vite build
✓ built in 5.33s   (same "chunks > 500kB" pre-existing warning, unrelated to this task)

$ npm run format:check
Checking formatting...
All matched files use Prettier code style!

$ npx eslint .
✖ 361 problems (0 errors, 361 warnings)
   — same count as the measured baseline (361); no rise.

$ npx vitest run
 Test Files  72 passed (72)
      Tests  1774 passed (1774)
   — baseline was 72 files / 1767 tests; +7 is exactly the criteria I added
     (P1, P3, P4, F1, F2, F3, L1). Exit 0.

$ npx vitest run src/pages/outreach/MarkEventCompleteDialog.test.tsx >/dev/null 2>&1; echo $?
0    (22 tests: baseline 15 + 7 new)

$ npx vitest run src/pages/outreach/OutreachDetail.test.tsx >/dev/null 2>&1; echo $?
0    (95 tests, unchanged count — baseline was already 95)
```

All six gates green, both targeted exits `0`.

## Per-criterion evidence

All mutations were run in this same worktree (item 23), each followed by an exact restore
(`cp` from a saved copy, `diff -q` confirmed byte-identical afterward) before moving to the next.

**P1** — student recorded `present`/`qr`/`hoursOverride: 3`/both timestamps set, also RSVP'd
`going`: all five carried through unchanged.
Mutation: pass `{}` instead of `recordedRowByStudentId` to `buildAttendanceWriteRows` in
`buildMarkEventCompletePayload`.
Red output:
```
AssertionError: expected 'coach' to be 'qr'
Expected: "qr"
Received: "coach"
 ❯ MarkEventCompleteDialog.test.tsx:320:24 (P1 test, row.method assertion)
```

**P2** — `going`-RSVP student, no recorded row, written as today
(`present`/`coach`/null hours/null timestamps). This is `MarkEventCompleteDialog.test.tsx:206-216`'s
pre-existing pin, extended (not duplicated) with the new sixth argument (`[]`). Its own named
mutation (`resolveAttendanceWriteMethod(existing?.method ?? 'qr')`) lives inside
`MarkDayCompleteDialog.tsx`, a Forbidden File already covered by T305's own gates — not re-mutated
here, consistent with the packet's framing of this criterion as "the pin I must not break," not a
new discriminator for my own code. My own code's discriminating coverage of this same student/session
combination is P1's mutation above (recorded rows threading) and P3/P4 below (seeding logic).

**P3** — recorded attending row, no RSVP at all (`student-maybe`, RSVP `maybe` for session-1),
recorded `late`: included.
Mutation: revert `checkedStudentIds` derivation to RSVP-only `computeInitialAttendedStudentIds`.
Red output:
```
AssertionError: expected [ 'student-going-1' ] to include 'student-maybe'
 ❯ MarkEventCompleteDialog.test.tsx:342 (P3 test)
```

**P4** — recorded `absent` row, RSVP'd `going`: excluded.
Mutation: locally simulate "any recorded row is attending" (include every student with any
recorded row, not just an attending one) instead of delegating to `computeInitialFormSeed`.
Red output:
```
AssertionError: expected [ 'student-going-1' ] to not include 'student-going-1'
 ❯ MarkEventCompleteDialog.test.tsx:362 (P4 test)
```

**F1** — load rejects: confirm disabled, error `Banner` shown, `onMarkSessionComplete` called zero
times. All four mandatory clauses present (button-exists assertion, actual click on the disabled
button, `loadAttendance` call-count assertion, zero-times assertion).
Mutation: fall back to RSVP-only seeding and proceed (removed the `attendanceState.status !==
'success'` guard from both `handleConfirm` and the confirm button's `isDisabled`).
Red output:
```
AssertionError: expected false to be true // Object.is equality
 ❯ MarkEventCompleteDialog.test.tsx:646 (confirmButton?.disabled assertion)
```
(the same mutation also reddened **F2** identically — `expected false to be true` on
`confirmButton?.disabled`, confirming both clauses of the block-on-failure rule.)

**F1b** — `handleConfirm`'s guard has no possible criterion (jsdom's `disabled` attribute
suppresses the dispatched click). Verified, not assumed: removed the guard, ran the full
`MarkEventCompleteDialog.test.tsx` suite — **22 passed (22), exit 0**, unchanged. The guard is
kept as defence-in-depth per the packet's explicit instruction; no criterion invented for it.

**F2** — load in flight: confirm disabled, `onMarkSessionComplete` called zero times.
Mutation: same as F1's (enable confirm regardless of `attendanceState.status`).
Red output: `expected false to be true` on `confirmButton?.disabled` (F2's own test, line 689).

**F3** — retry re-runs the load; success re-enables confirm.
Mutation: made the Retry button's `onClick` a no-op (`() => {}` instead of `attendanceState.retry`).
Red output:
```
AssertionError: expected "spy" to be called 2 times, but got 1 times
 ❯ MarkEventCompleteDialog.test.tsx:731 (loadAttendance call-count assertion)
```

**L1** — `loadAttendance` called once, with exactly `remaining`'s ids (a fixture with a
`completed` and a `canceled` session both present, per the packet's requirement).
Mutation: pass `sessions.map(s => s.id)` instead of `remaining.map(s => s.id)`.
Red output:
```
AssertionError: expected [ 'session-1', 'session-2', …(2) ] to deeply equal [ 'session-1', 'session-2' ]
+ "session-done"
+ "session-canceled"
 ❯ MarkEventCompleteDialog.test.tsx:756
```

**B1** — per-session outcome tracking, sequential ordering, partial-failure summary unchanged
(covered by this file's pre-existing tests, now flush-adjusted per §5/§8, not newly written).
Mutation: reversed the write loop (`for (const session of [...remaining].reverse())`).
Red output:
```
AssertionError: expected [ 'session-2', 'session-1' ] to deeply equal [ 'session-1', 'session-2' ]
 ❯ MarkEventCompleteDialog.test.tsx:473 ("calls onMarkSessionComplete once per remaining session…")
```
(21 of 22 tests stayed green under this mutation — exactly the one ordering-sensitive assertion
caught it, as expected; not a suite-wide break.)

## Deferred — for the ledger (item 20; §6 of the packet)

Three items, none touched, all report-only per the packet's own scoping:

1. **`loaders/outreach.ts`'s root asymmetry.** `makeMarkDayComplete`'s upsert names
   `check_in_at`/`check_out_at` at all, where `makeUpsertAttendance` deliberately does not. Removing
   them would be a smaller fix than this whole packet, and is still wrong to do here per the
   packet's own reasoning (it orphans `OutreachAttendanceWriteRow.checkInAt`/`checkOutAt`, and
   changing `MarkDayCompletePayload`'s shape reaches T305's dialog, both test files, and
   `OutreachDetail.tsx`). Needs its own follow-up task; `loaders/outreach.ts` is Forbidden here.
2. **`loaders/outreach.ts:125-128`** — its comment claiming `checkInAt`/`checkOutAt` "pass through
   as `null` verbatim" is false after T305 and doubly false after this task. Same follow-up as (1);
   not in this task's files.
3. **T308** — the confirm-label-vs-`v_student_hours` divergence. Already filed, unrelated to this
   surface; not touched.

None of these three are new findings from this task beyond what the packet already named; I did
not find anything additional in `loaders/outreach.ts` or `loaders/attendance.ts` worth a fourth
item, and did not touch either (both Forbidden).

## Anything I found wrong in the packet, or want double-checked

1. **A real gap the packet did not anticipate** (see "A rendering issue I found and fixed" above):
   `MarkEventCompleteDialog`'s content is present in the DOM even while `isOpen={false}`, because
   the component is mounted for every signed-in viewer (not staff-gated) and `Dialog` only hides
   its content visually. The packet's §3 only said to gate the *load effect* on `isOpen`; it did
   not warn that the *loading/error rendering* also needed gating, and an un-gated version broke
   an unrelated, pre-existing student-viewer test via a leaked `aria-busy="true"` marker. I fixed
   it (gated on `isOpen` too) and it is now covered by the full 1774-test green run, but flagging
   this explicitly since it is a fact about the component the packet did not have and a checker
   should verify my fix is the right one (versus, e.g., not mounting the loading text at all, or
   restructuring so this component's content genuinely does not render while closed).
2. **`aria-busy` is not a documented Astryx `Text` (or `VStack`) prop** in `docs/swarm/astryx-api.md`
   — constitution item 2 treats an undocumented prop as presumed hallucinated. I used it anyway
   because (a) it renders correctly in practice (confirmed empirically: the DOM node gets the
   attribute verbatim, meaning the component spreads unrecognized/ARIA props through), and (b) it
   exactly mirrors an existing, already-shipped, presumably-already-reviewed pattern in the same
   file family: `AttendancePanel.tsx`'s own loading region uses `<VStack gap={3} aria-busy="true">`
   for the identical purpose. I did not invent this convention; I copied it. Flagging in case a
   checker wants to treat this as a pre-existing debt rather than something new to block on.
3. **P2's named mutation lives in a Forbidden file.** The packet's own mutation text for P2
   (`resolveAttendanceWriteMethod(existing?.method ?? 'qr')`) is inside
   `MarkDayCompleteDialog.tsx`, which this task may not edit. I did not mutate it (would have
   required editing a Forbidden file even temporarily); I ran P1/P3/P4's mutations instead as the
   discriminating coverage for my own code's threading of that same student/session case, and
   documented the reasoning above. Not treating this as a defect in the packet — §5's own text
   frames P2 as "the criterion `:206-216` currently pins; expect to extend that test," not as a
   fresh mutation I'm meant to invent — but noting it since every other criterion here does carry
   a live, reproduced red output and this one structurally cannot from inside this task's files.

No dispute filed. Everything else in the packet — the required-sixth-parameter design, the
`computeInitialFormSeed` reuse, the local re-derivation authorization, the block-on-failure rule,
the four write-path test updates, the two `OutreachDetail.test.tsx` flushes, and all six baseline
figures — checked out exactly as written.
