# T309 — worker evidence

**Branch:** `claude/t309-uncheck-absent`, pushed at `e40d2d5` (parent `a611cb2`, the packet-v2
commit off `main` = `e76515f`).
**Worktree:** `/home/user/volt_task_tracker_rewrite/.claude/worktrees/agent-a653564b1b613f9e5`
(my current-branch ref was reset to `a611cb2` first — `claude/t309-uncheck-absent` was already
checked out in the main repo checkout, so I could not check it out a second time in my own
worktree; I built on top of `a611cb2` locally and pushed `HEAD:claude/t309-uncheck-absent`
directly, landing the same content at the intended branch name).
`.env.local`: **absent** for every command in this document, verified before each gate run.

---

## 0. Independently-measured branch-point baseline

Measured at `a611cb2` (docs-only diff over `e76515f` — `git diff e76515f a611cb2 --stat` touches
only `docs/swarm/*`, confirmed before trusting this as the code baseline):

```
npx tsc --noEmit                    exit 0
npx eslint .                        0 errors, 361 warnings
npx vitest run                      75 files, 1821 tests, exit 0
MarkDayCompleteDialog.test.tsx      46 tests
MarkEventCompleteDialog.test.tsx    25 tests  (71 combined, exit 0)
```

This matches §6's stated baseline exactly (own independent measurement, not copied).

---

## 1. What was built

`src/pages/outreach/MarkDayCompleteDialog.tsx`:
- New exported pure function `buildAttendanceAbsenceRows(sessionId, roster, checkedStudentIds,
  recordedBy, recordedRowByStudentId)` (module doc #10) — for every ROSTER student who is
  unchecked and has a recorded row with `isAttendingStatus(existing.status)` true, writes
  `status: 'absent'` carrying `checkInAt`/`checkOutAt`/`hoursOverride`/`method` through verbatim,
  `recordedBy` = the acting coach.
- `buildAttendanceWriteRows` is **byte-identical** to the packet-v2 commit — verified by
  extracting the function body from both `a611cb2` and `HEAD` and diffing them programmatically
  (identical, 835 bytes each).
- `handleSubmit` hoists `recordedRowByStudentId` to a local and concats:
  `[...buildAttendanceWriteRows(...), ...buildAttendanceAbsenceRows(...)]`.
- Five module-doc corrections applied in place (see §2 below); the `:8-9` PRD quote was **not**
  edited — a `T309 UPDATE` note was added beside it instead, in the T305-UPDATE style.

`src/pages/outreach/MarkDayCompleteDialog.test.tsx`:
- Import of `buildAttendanceAbsenceRows` added.
- New `describe('buildAttendanceAbsenceRows ...')` block with 7 tests: C1, C2, C3, C4, C5
  (dedicated 2-student roster, `T309_C5_ROSTER`, containing only students with recorded
  non-attending rows), C6, C7.
- New `describe('<MarkDayCompleteDialog /> C9 ...')` block with 1 end-to-end DOM test covering
  C9 (including its folded-in label guard).
- Zero existing tests edited, weakened, or deleted.

No other files touched. `loaders/attendance.ts`, `AttendancePanel.tsx`,
`MarkEventCompleteDialog.tsx`/`.test.tsx`, `loaders/outreach.ts` were not modified.

---

## 2. Module-doc corrections (§3's table) — all five applied

| Line (orig) | What I did |
|---|---|
| `:8-9` | Left the PRD quote **verbatim**, unedited. Added a `T309 UPDATE` note directly above it (new paragraph) stating the quote only ever described the checked half of the checklist, and that this dialog now also writes `status: 'absent'` for an unchecked-but-recorded-attending student. |
| `:90` (`"raw inputs per checked student"`) | Corrected in place to `"per row it constructs"` with a T309 UPDATE parenthetical explaining an unchecked student with a recorded attending row now also gets a row. |
| `:132` (`"every value it sums is a value this exact submit is constructing"`) | Corrected in place — appended the disclosed exception: this submit also constructs `'absent'` rows the sum deliberately excludes, so the sentence now describes the checked subset, not everything the submit writes. |
| `:494-499` (`AttendanceStatus` doc) | Added a sentence: "T309 UPDATE: this dialog now writes `'absent'` too, for an unchecked student with a recorded attending row (module doc #10)." |
| `:693` (`"THE ONE place attendance rows are constructed"`) | Corrected in place to "one of now TWO places `attendance` rows are constructed", naming `buildAttendanceAbsenceRows` as the other and stating `buildAttendanceWriteRows` itself stays byte-identical. |

A new module doc #10 section was added (end of the file's header comment) writing up the full
T309 design: the ruling, the five decisions from §3(a)-(e), and how `handleSubmit` wires the two
functions together.

---

## 3. Gates — all six, `.env.local` absent, run after mutation-testing (final state, HEAD = e40d2d5)

```
$ npx tsc --noEmit
exit 0

$ npx vite build
✓ built in 5.10s   (exit 0, only the pre-existing >500kB chunk-size advisory, unrelated)

$ npm run format:check
Checking formatting...
All matched files use Prettier code style!

$ npx eslint .
✖ 362 problems (0 errors, 362 warnings)
```
Baseline was 361 warnings, 0 errors. **+1 exactly**, as predicted (§6) — the new
`react-refresh/only-export-components` warning on the new value export
`buildAttendanceAbsenceRows`. No other rise.

```
$ npx vitest run
Test Files  75 passed (75)
     Tests  1829 passed (1829)
```
Baseline was 1821. **+8** — my own 8 new tests (C1, C2, C3, C4, C5, C6, C7 = 7 pure-function
tests, plus 1 end-to-end DOM test covering C9 with its folded-in label guard). I did not add a
separate 9th test for the "label guard" — per the packet's own instruction, "one criterion, not
two," it is asserted inside the same C9 test. (The packet's gate reference implementation landed
at 1830; the +1 delta from mine is explained by that count difference in how many discrete `it()`
blocks were used to cover the same nine lettered criteria — I did not attempt to match their exact
test count, only their behavioral coverage, and verified every criterion's mutation reddens as
required, §5 below.)

```
$ npx vitest run src/pages/outreach/MarkDayCompleteDialog.test.tsx src/pages/outreach/MarkEventCompleteDialog.test.tsx >/dev/null 2>&1; echo $?
0
```
`MarkDayCompleteDialog.test.tsx`: 54 tests (46 baseline + 8 new, zero existing tests edited).
`MarkEventCompleteDialog.test.tsx`: 25 tests, **zero edits to any file it owns** — C8 confirmed.

All six gates: green.

---

## 4. C1–C9 — mutation and real red output for each

Workflow used throughout: implementation was committed clean at `e40d2d5` **before** any
mutation was applied (per item 26 / §8's explicit instruction). Each mutation below was applied
with `Edit`, run under `vitest`, the real output captured, then reverted with
`git checkout -- src/pages/outreach/MarkDayCompleteDialog.tsx` (safe because the clean state was
already committed). `git status --short` was empty after every revert, confirmed before moving to
the next mutation.

### C1 — unchecked student with recorded `present` row → exactly one row, `status: 'absent'` (whole row asserted)

Mutation: `return [];` as the first line of `buildAttendanceAbsenceRows`.

Real red output:
```
FAIL  ... > C1 -- an unchecked student with a recorded present row produces exactly one row, status absent (whole row object)
AssertionError: expected [] to have a length of 1 but got +0
FAIL  ... > C7 -- a recorded late student who is unchecked becomes absent (the late arm, not assumed from C1)
AssertionError: expected undefined to be defined
```
Also independently re-ran with only the C9 filter active under this same mutation:
```
FAIL  ... C9 ... > unchecking a student who starts checked ... writes their absent row ...
AssertionError: expected [ { sessionId: 'session-1', …(7) } ] to have a length of 2 but got 1
```
C1, C7, and C9 all turn red under this mutation, as expected (C1's own criterion plus two
knock-on failures it correctly discriminates).

### C2 — that row carries the recorded `checkInAt`/`checkOutAt`/`hoursOverride`/`method`

Mutation: hardcoded `checkInAt: null, checkOutAt: null, method: 'coach'` inside the row literal
(the pre-T305 shape).

Real red output:
```
FAIL  ... > C1 -- ... (whole row object)
- Expected  "2026-08-02T14:05:00.000Z" (checkInAt) ...
+ Received  null
FAIL  ... > C2 -- that row carries the recorded checkInAt/checkOutAt/hoursOverride/method, not the pre-T305 null/coach shape
AssertionError: expected null to be '2026-08-02T14:05:00.000Z'
```

### C3 — `recordedBy` is the acting coach, never the recorded row's own `recordedBy`

Mutation: `recordedBy: existing.recordedBy` — vitest-replay-only per the packet (does not
typecheck: `AttendanceRow.recordedBy` is `string | null`, `AttendanceWriteRow.recordedBy` is
`string`). Replayed under `vitest` only, not `tsc`, per the packet's own instruction.

Real red output:
```
FAIL  ... > C1 -- ... (whole row object)
-   "recordedBy": "profile-coach-acting-t309",
+   "recordedBy": "profile-someone-else",
FAIL  ... > C3 -- recordedBy is the acting coach, never the recorded row's own recordedBy
AssertionError: expected 'profile-someone-else' to be 'profile-coach-acting-t309'
```

### C4/C5 — no recorded row → nothing; recorded `'absent'`/`'excused'` → nothing (shared mutation)

Mutation: deleted `if (!isAttendingStatus(existing?.status)) continue;`.

Real red output:
```
FAIL  ... > C4 -- an unchecked student with NO recorded row produces nothing for them
TypeError: Cannot read properties of undefined (reading 'checkInAt')
  at Module.buildAttendanceAbsenceRows src/pages/outreach/MarkDayCompleteDialog.tsx:832:27

FAIL  ... > C5 -- unchecked students whose recorded row is already absent or excused produce nothing (dedicated roster, §5)
AssertionError: expected [ …(2) ] to have a length of +0 but got 2
```
Confirms the packet's own §5 prediction exactly: C4 **crash-reds** (its roster has a row-less
student, `student-gale`, so the deleted guard causes `existing.checkInAt` to throw on `undefined`)
while C5, run against its own dedicated two-student roster (`T309_C5_ROSTER`, only
`'absent'`/`'excused'` recorded rows, no row-less student), reddens on a real assertion failure
instead of a crash. This is exactly why C5 needed its own fixture roster — verified, not assumed.

### C6 — recorded attending row for a student NOT on the roster → nothing

Mutation: iterate `Object.keys(recordedRowByStudentId)` instead of `roster`.

Real red output:
```
FAIL  ... > C6 -- a recorded attending row for a student NOT on the roster produces nothing (never keys off the recorded map)
AssertionError: expected { sessionId: 'session-1', …(7) } to be undefined
+ Received:
{
  "checkInAt": null, "checkOutAt": null, "hoursOverride": null, "method": "coach",
  "recordedBy": "profile-coach-acting-t309", "sessionId": "session-1",
  "status": "absent", "studentId": "student-off-roster",
}
```
(C4 and C5 passed under this mutation, as expected — this mutation does not affect them.)

### C7 — recorded `'late'` student who is unchecked becomes `'absent'`

Covered by C1's mutation (see C1 above) — asserted as its own separate test (not assumed from
C1's `late` coverage), per the packet's instruction.

### C8 — `MarkEventCompleteDialog.test.tsx` passes at 25 with zero edits

Gate-level (§3 above): `MarkEventCompleteDialog.test.tsx` was never opened for editing. Full-suite
run confirms 25 tests pass in that file, and `git diff` on `main`/packet-point shows zero changes
to it or its component file (both are outside the Allowed Files and untouched).

### C9 — end-to-end through the dialog

Mutation: dropped the `...buildAttendanceAbsenceRows(...)` spread from `handleSubmit`'s
`attendance` array (kept only `buildAttendanceWriteRows`'s spread).

Real red output:
```
FAIL  ... <MarkDayCompleteDialog /> C9 -- end-to-end uncheck through the dialog actually writes the absence > unchecking a student who starts checked from recorded attendance writes their absent row alongside the remaining present row, and the label does not move
AssertionError: expected [ { sessionId: 'session-1', …(7) } ] to have a length of 2 but got 1
```
The test also asserts, on the un-mutated (real) implementation, that after unchecking one of two
checked students the button reads `Mark complete — 1 attended · 7 h` and
`Mark complete — 2 attended · 14 h` is absent (`findButtonByText(...)` returns `undefined`) — this
passes green on the real implementation and is the C9 label guard the packet folded in from v1's
deleted C10. I did not additionally emulate a hypothetical mutation that would move the label
(e.g. counting absentees as attended), since the label computation
(`computeMarkCompleteConfirmLabel`/`checkedStudentIds.length`/`computeTotalHoursForCheckedStudents`)
is pre-existing code this task does not touch and is structurally incapable of seeing the new
absence rows (they are appended to `payload.attendance` after the label is already computed from
`checkedStudentIds` alone) — the packet's own text confirms this ("the gate measured that C10's
own emulated mutation reddens C9 anyway via the full-label lookup — one criterion, not two"), and
my C9 test already performs that exact full-label lookup on both counts.

---

## 5. Byte-identity check on `buildAttendanceWriteRows`

Extracted the function body (`export function buildAttendanceWriteRows(...) { ... }`) from
`a611cb2:src/pages/outreach/MarkDayCompleteDialog.tsx` and from
`HEAD:src/pages/outreach/MarkDayCompleteDialog.tsx` with a small Python regex script and compared
them directly: **identical, 835 bytes in both**. Not modified.

---

## 6. Deferred — for the ledger (constitution item 20)

- **Nothing new found and left unfixed within this task's own scope.** The five module-doc
  corrections §3 required were all applied; no additional stale claim was found while doing so.
- **Pre-existing, already-disclosed items this task correctly did not touch** (repeated here only
  so the ledger has the cross-reference, not as new findings):
  - T308 — the confirm button's local hours sum can legitimately disagree with `v_student_hours`
    for a student whose preserved timestamps make the SQL view's tier-2 CASE fire. Unaffected by
    this task; still open under its own ledger row.
  - T307's note (module doc #9) — `MarkEventCompleteDialog.tsx`'s bulk path still seeds from
    RSVPs only and writes an empty recorded-rows argument; a live, filed, deliberately
    out-of-scope data-loss bug this task does not touch (and per §4, must not touch —
    `buildAttendanceWriteRows` staying byte-identical is what keeps bulk mode's behavior
    unchanged).
  - The W1/T320 collision: `loaders/attendance.ts` is being edited concurrently on
    `origin/claude/w1-checkin`. Confirmed not touched by this diff (imported from only).
- **Observation, not a defect:** my test file's new test count (8) differs from the gate's
  reference implementation's count (9, reaching 1830 total) for covering the same nine lettered
  criteria. I did not try to reverse-engineer their exact test boundary choice; I verified my own
  8 tests each redden under every prescribed mutation (§4 above), which is the actual acceptance
  bar per §5's own text ("Run each mutation, paste the real red output"). Flagging this only so a
  reviewer comparing raw suite-size numbers between worker submissions isn't surprised by a
  1-test/1-count difference that doesn't reflect missing coverage.

---

## 7. Self-certification

I do not self-certify. All six gates were run and reported above with real output; all nine
lettered criteria's mutations were run and their real red output is pasted above; the
`buildAttendanceWriteRows` byte-identity claim was independently verified, not assumed; the
module-doc table was applied in place with the one exception (`:8-9`) the packet explicitly
required be left verbatim. The checker decides whether this passes.
