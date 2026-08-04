# T165 — worker output: cover the untested exports of `loaders/outreach.ts`

## 1. Commit SHA and proof it is the committed blob (item 21)

**Commit `df56567970ab17427b36bf46f6b818b29f50d7ea`**, branch `claude/t165-work`, on top of
`b9742b8` (current `main` at packet-authoring time).

Proof this is the committed blob, not merely the working tree (item 21's exact distinction):

```
$ git status --porcelain
(empty)
$ git diff HEAD --stat
(empty)
$ git cat-file -p HEAD:src/lib/supabase/loaders/outreach.test.ts | wc -l
1857
$ git cat-file -p HEAD:src/lib/supabase/loaders/outreach.test.ts | grep -c "describe("
12
```

The working tree is clean (`git status --porcelain` empty) and `git diff HEAD` is empty, so
nothing exists only in the working tree — everything is in the commit. `git cat-file -p HEAD:...`
reads directly from the Git object store (bypassing the working tree entirely) and shows the full
1857-line file with all 12 `describe` blocks (5 pre-existing + 7 new), proving the additions are
genuinely inside the commit object, not just present on disk.

`docs/swarm/active/T165-worker-output.md` (this file) is committed in the same or a follow-up
commit on this branch — see the final commit list below.

## 2. Six gates, against my own measured baseline (`.env.local` absent)

**Baseline, measured before any edit (`b9742b8`, my own measurement, not assumed from the
packet):**

| Gate | Baseline |
|---|---|
| `npx tsc --noEmit` | exit 0, no output |
| `npm run build` | ✓ built in 5.18s |
| `npm run format:check` | all files match Prettier style |
| `npm run lint` | 0 errors / 364 warnings |
| `npx vitest run` (full suite) | **78 files / 1956 tests**, exit 0 |
| `npx vitest run src/lib/supabase/loaders/outreach.test.ts` (targeted) | **19 tests**, exit 0 |

The packet's own orientation numbers (19 targeted, 78/1956 full) matched my independent
measurement exactly.

**After this task's changes:**

| Gate | Result |
|---|---|
| `npx tsc --noEmit` | exit 0, no output |
| `npm run build` | ✓ built in 4.94s |
| `npm run format:check` | all files match Prettier style |
| `npm run lint` | 0 errors / 364 warnings — **no rise** |
| `npx vitest run` (full suite) | **78 files / 1975 tests**, exit 0 (+19) |
| `npx vitest run src/lib/supabase/loaders/outreach.test.ts` (targeted) | **38 tests**, exit 0 (+19), targeted run's own exit code asserted: **0** |

## 3. C1 — `loaders/outreach.ts` is unmodified

```
$ git diff --stat -- src/lib/supabase/loaders/outreach.ts
(empty)
$ git diff --stat b9742b8 -- src/lib/supabase/loaders/outreach.ts
(empty)
```

Both the working-tree diff and the diff against the packet's own stated base (`b9742b8`) are
empty — the production file is byte-identical to the pre-task base. Every mutation described in
§4 below was applied with `Edit`, run, and reverted with `Edit` inside this same worktree before
being reported (constitution item 23: mutation experiments in the worker's own worktree). This is
the **final**, post-revert state — C1 holds at the end of the task, which is the criterion.

## 4. C3 — the five existing blocks in §3 of the packet are byte-intact

Packet's own command, run against the packet's own stated base:

```
$ git diff b9742b8 -- src/lib/supabase/loaders/outreach.test.ts | grep '^-'
--- a/src/lib/supabase/loaders/outreach.test.ts
```

The only line matching `^-` is the diff header itself (`--- a/...`, which every unified diff
emits) — **zero actual deletions** anywhere in the file. `git diff --stat` confirms this is a
pure addition:

```
$ git diff --stat b9742b8 -- src/lib/supabase/loaders/outreach.test.ts
 src/lib/supabase/loaders/outreach.test.ts | 764 ++++++++++++++++++++++++++++++
 1 file changed, 764 insertions(+)
```

The five blocks' line numbers all shifted by **exactly +9** (the size of the new import
statements added at the top of the file) and are otherwise untouched:

| Block | Packet's line | New line | Shift |
|---|---|---|---|
| T146 select-string guard | `:43` | `:52` | +9 |
| T157 nested (`students`/`profile_id`) comment | `:127` | `:136` | +9 |
| T157 `guardian_links` select-string + filter guard | `:228` | `:237` | +9 |
| T327 `makeMarkDayComplete` write ordering | `:466` | `:475` | +9 |
| T406 `makeMarkDayComplete` stateful-fake block | `:643` | `:652` | +9 |
| T402 `queryAttendanceForSessions` pagination | `:951` | `:960` | +9 |

A uniform +9 shift across every block, with zero deletions anywhere in the file, is exactly what
"prepend 9 lines of new imports, append new content at the end" produces — consistent with
byte-intactness, not a refactor.

## 5. Which of the five targets I reached

**All five.** In the packet's own priority order:

1. `computeExpectedAttendeeRsvpPlan` (`:1418`) — 6 tests
2. `makeSubmitRsvpChange` (`:1219`) — 3 tests
3. `makeSaveOutreachEvent` (`:1454`) — 6 tests (2 CREATE, 2 EDIT, 2 RSVP-reconciliation)
4. `makeCancelOutreachEvent` (`:1657`) — 2 tests
5. `makeLoadOutreachEventRoster` (`:1698`) — 2 tests

19 new tests total, extending the existing `outreach.test.ts` only (no second file forked).

## 6. C2/C4/C5 — every test, its mutation, and the real red output

**Mutation-to-test ratio: 19/19 — every test added has exactly one named mutation, run, with real
red output pasted below.** No test in this task's additions asserts only that a symbol is defined,
only a singleton binding exists, or (with one deliberate, disclosed exception explained under
`makeSaveOutreachEvent` C2 below) only a call shape.

Every mutation below was applied to `src/lib/supabase/loaders/outreach.ts` with `Edit`, run with
`npx vitest run src/lib/supabase/loaders/outreach.test.ts -t "<anchor text>"`, confirmed to show
**exactly the intended test failing** (never a silent 0-tests-matched `-t` miss — every run below
shows the target test failed and the rest skipped, proving the anchor matched and the count
moved), then reverted with `Edit` before moving to the next mutation. Full production-file byte
match (`git diff --stat`) was re-verified empty after every revert and again at the very end
(§3 above).

### 6.1 `computeExpectedAttendeeRsvpPlan` (C4: every documented branch broken independently)

**T165-M1 — fans out one upsert row per (checked student × session) pair.**
Mutation: `break` out of the inner loop after the first checked student per session.
```
AssertionError: expected [ …(2) ] to have a length of 4 but got 2
- 4
+ 2
```

**T165-M2 — deduplicates a repeated id in `expectedStudentIds`.**
Mutation: iterate the raw `expectedStudentIds` array directly instead of the deduped `checkedSet`.
```
- [ {sessionId: 'session-a', studentId: 'student-x'} ]
+ [ {...}, {...} ]  (duplicate row)
```

**T165-M3 — T119 removed T118's self-authored delete protection.**
Mutation: reinstate `&& row.responded_by !== row.student_id` on the delete filter.
```
AssertionError: expected [] to deeply equal [ 'rsvp-self' ]
- [ "rsvp-self" ]
+ []
```

**T165-M4 — a non-'going' row is never a delete candidate.**
Mutation: drop the `row.status === 'going'` condition from the delete filter.
```
AssertionError: expected [ 'rsvp-maybe', 'rsvp-declined' ] to deeply equal []
- []
+ [ "rsvp-maybe", "rsvp-declined" ]
```

**T165-M5 — T119 removed the old selfAuthoredKeys skip on the upsert side.**
Mutation: reinstate a selfAuthoredKeys-based skip in the upsert loop.
```
AssertionError: expected [] to deeply equal [ { sessionId: 'session-1', … } ]
- [ {...} ]
+ []
```

**T165-M6 — unchecking everyone is not a "nothing to do" shortcut.**
Mutation: `if (checkedSet.size === 0) return { idsToDelete: [], rowsToUpsert: [] };`
```
AssertionError: expected [] to deeply equal [ 'rsvp-a', 'rsvp-b' ]
- [ "rsvp-a", "rsvp-b" ]
+ []
```

### 6.2 `makeSubmitRsvpChange`

**T165-M7 — onConflict is really `session_id,student_id`, not just `student_id`.**
Mutation: change `{ onConflict: 'session_id,student_id' }` to `{ onConflict: 'student_id' }`.
Outcome-based (a stateful fake keyed by whatever `onConflict` actually names, per the packet's
own C5 rule against shape-only assertions):
```
AssertionError: expected 1 to be 2 // Object.is equality
- 2
+ 1
```
(two different sessions for the same student collapsed into one row).

**T165-M8 — `respondedBy` is written verbatim, never re-derived from `studentId`.**
Mutation: change `responded_by: params.respondedBy` to `responded_by: params.studentId`.
```
AssertionError: expected 'student-1' to be 'parent-99'
```

**T165-M9 — a rejected upsert is not swallowed.**
Mutation: wrap `await mutate(params)` in a try/catch that swallows the error.
```
AssertionError: promise resolved "undefined" instead of rejecting
```

### 6.3 `makeSaveOutreachEvent`

**T165-M10 — CREATE rejects with the disclosed no-active-season message, no insert attempted.**
Mutation: remove the `if (activeSeason === null) throw` guard (fabricate a fallback seasonId
instead).
```
AssertionError: promise resolved "undefined" instead of rejecting
```

**T165-M11 — a failed session insert propagates, is not swallowed (T330 orphan-event context).**
Mutation: wrap `await insertSessions(...)` in a try/catch that swallows the error.
```
AssertionError: promise resolved "undefined" instead of rejecting
```

**T165-M12a — EDIT: existing dates UPDATE in place, new dates INSERT, never the reverse.**
Mutation: swap the `toUpdate`/`toInsert` filter predicates.
```
AssertionError: expected [ { id: undefined, patch: {…new-date-fields…} } ]
                 to deeply equal [ { id: 'sess-old-1', patch: {…updated-date-fields…} } ]
```

**T165-M12b — EDIT: a removed date is never deleted.**
Mutation: add a compensating `event_sessions` delete for dates absent from the payload (a
plausible "finish the job" mutation the production module doc itself explicitly warns against).
```
AssertionError: expected true to be false
- false
+ true
```

**T165-M13 — the RSVP-reconciliation back-compat guard actually gates on both fields.**
Mutation: drop the `!== undefined` guard so reconciliation always runs.
```
AssertionError: expected true to be false
- false
+ true
```
(an unexpected `rsvps` table call appeared).

**T165-M14 — delete runs before upsert in the reconciliation phase.**
Mutation: swap the order of the delete/upsert `if` blocks.
```
AssertionError: expected [ 'select', 'upsert', 'delete' ] to deeply equal [ 'select', 'delete', 'upsert' ]
```

*Note on assertion style for this describe block:* the ordering assertion above records
table+method sequence (the same pattern T327's own `makeMarkDayCompleteRecordingClient` already
established in this file) rather than reading final state, because the object under test here is
sequencing itself, not a value — the packet's C5 rule targets shape-only assertions substituting
for an *outcome* check; here the order **is** the outcome. The `rsvpDeleteIds`/`rsvpUpsertArgs[0]`
assertions in the same test additionally check the actual row content, not just that `.delete()`/
`.upsert()` were called.

### 6.4 `makeCancelOutreachEvent`

**T165-M15 — only currently-scheduled sessions for the event flip; completed sessions and other
events' sessions do not.**
Mutation: drop the `.eq('status', 'scheduled')` filter (replaced the second `.eq()` call with a
redundant `event_id` filter, functionally removing the status guard). Outcome-based, via a
stateful fake keyed on the actual filtered rows:
```
AssertionError: expected 'canceled' to be 'completed'
```
(a session that was already `'completed'` got incorrectly flipped to `'canceled'`).

**T165-M16 — a rejected update is not swallowed.**
Mutation: wrap `await mutate(eventId)` in a try/catch that swallows the error.
```
AssertionError: promise resolved "undefined" instead of rejecting
```

### 6.5 `makeLoadOutreachEventRoster`

**T165-M17 — filters to `isActive` students only.**
Mutation: replace `.filter((student) => student.isActive)` with `.filter(() => true)`.
```
AssertionError: expected [ Array(2) ] to deeply equal [ { id: 'student-active', … } ]
```
(the inactive student leaked through).

**T165-M18 — a load rejection propagates, is not swallowed into an empty roster.**
Mutation: wrap `await loadStudentsTab()` in a try/catch that resolves an empty
`{students: [], teams: [], invites: []}` instead.
```
AssertionError: promise resolved "[]" instead of rejecting
```

**C5 self-audit:** every test above is backed by one of the mutations listed. None of the 19
tests assert only that a function is defined, only that a singleton binding exists, or (as its
*sole* content) only a call shape — the three tests that record call shape as part of their
assertion (`makeSubmitRsvpChange`'s onConflict test, `makeCancelOutreachEvent`'s scheduled-only
test, the reconciliation-order test) all pair it with an outcome/state check (a stateful fake's
post-write store, or the actual argument content, not merely "was this called").

## 7. A major finding: four of the five "untested" targets already had test coverage —
##    just not inside `outreach.test.ts`

This is the most important thing in this report, and it directly answers §8 item 5 of the packet
("Assume it carries its own errors. Finding one is a success.").

The packet's §1 measured "already exercised" by looking only at what `outreach.test.ts` itself
imports. **That measurement is too narrow.** `git grep` across the whole repo shows every one of
the five "real remaining surface" targets *already has a describe block exercising it, in a
sibling page-level test file*, predating this task:

| Target | Where | Tests | Assertion style |
|---|---|---|---|
| `computeExpectedAttendeeRsvpPlan` | `OutreachEventDialog.test.tsx:1310` | 7 | value-based (state) |
| `makeSubmitRsvpChange` | `RsvpControl.test.tsx:477` | 2 | 1 shape-only (`toHaveBeenCalledWith`), 1 rejection |
| `makeSaveOutreachEvent` (CREATE/EDIT core) | `OutreachList.test.tsx:3053` | 3 | shape-only |
| `makeSaveOutreachEvent` (RSVP fan-out phase) | `OutreachEventDialog.test.tsx:1454` | 3 | shape-only |
| `makeCancelOutreachEvent` | `OutreachDetail.test.tsx:1438` | 1 | shape-only |
| `makeLoadOutreachEventRoster` | `OutreachEventDialog.test.tsx:1724` | 1 | value-based (state) |

That is **17 pre-existing tests**, spread across **four different page-level test files**, for
symbols the packet's §1 called "the real remaining surface... 21/23 exports untested" (and, after
its own correction, still lists as five fully-untested targets). The packet's own module doc
comment inside `outreach.ts` itself (which I read before writing anything, per the packet's own
instruction) even says this outright for the first target: *"`computeExpectedAttendeeRsvpPlan`
below is the ONE place this reconciliation is computed -- a pure function... exercised directly by
this file's own colocated tests (`OutreachEventDialog.test.tsx`...)"* — the packet's own §5.1
("cheapest real coverage in the file... start here") does not mention this, even though it is
stated in the very file the packet's own author would have needed to read to write §1's export
inventory.

**This does not make my work here redundant, but it does mean the packet's framing ("21/23
untested" → corrected to "5 untested") is still an overstatement, in both directions of its own
correction:**

- The packet's "18 value exports, 9 already exercised... 7 already exercised" arithmetic doesn't
  even match its own stated scope: counting only the names actually imported into
  `outreach.test.ts` before this task (`makeLoadGuardianLinksForParent`, `makeLoadOutreachData`,
  `makeLoadOutreachDetail`, `makeMarkDayComplete`, `OUTREACH_ATTENDANCE_PAGE_SIZE`) gives **5**,
  not 7.
- Widening the count to the whole repo (the correct scope for "is this symbol tested," which is
  what "untested" should mean), **all 18 value exports already had at least one test somewhere**
  before this task — the real gap was never "zero coverage," it was "no coverage inside
  `outreach.test.ts` itself, and several of the existing tests are shape-only rather than
  outcome-based."

**What this task's 19 new tests genuinely add, honestly assessed per target:**

- `computeExpectedAttendeeRsvpPlan`: **substantially overlaps** with `OutreachEventDialog.test.tsx`'s
  7 tests (4 of my 6 test near-identical branches: cross-product fan-out, T119 self-authored
  delete, non-'going' rows untouched, upsert-despite-self-authored). **Two of my six are genuinely
  novel** (expectedStudentIds deduplication via `Set`; the "empty checked set is not a no-op
  shortcut" branch) — neither appears in the existing block.
- `makeSubmitRsvpChange`: my onConflict test is **outcome-based** (two sessions stay two rows)
  where the existing `RsvpControl.test.tsx` test is shape-only (`toHaveBeenCalledWith`) — a
  genuine quality improvement, not just a duplicate. My verbatim-`respondedBy` and
  rejection-not-swallowed tests substantially overlap existing coverage.
- `makeSaveOutreachEvent`: my no-active-season and update-in-place/insert-new/never-delete tests
  overlap `OutreachList.test.tsx`'s existing 3. **My T330 orphan-event test (session insert fails,
  event already durably created, rejection propagates) is genuinely novel — nothing existing
  tests this.** My RSVP-reconciliation-skip test substantially overlaps
  `OutreachEventDialog.test.tsx`'s "is entirely skipped..." test. **My delete-before-upsert
  ordering test is genuinely novel** — the existing tests check final call args but never assert
  sequencing.
- `makeCancelOutreachEvent`: my scheduled-only test is **outcome-based** (a stateful fake proving
  a completed session and another event's session are untouched) where the existing
  `OutreachDetail.test.tsx` test is shape-only (four `toHaveBeenCalledWith` checks, no state
  proof) — this closes a real gap: the existing test could pass even if the status filter were
  dropped entirely, AS LONG AS the two `.eq()` calls still happened with those exact arguments on
  a mocked chain that never simulates filtering (which is exactly what it does). My
  rejection-not-swallowed test is novel.
- `makeLoadOutreachEventRoster`: my active-filter test **near-duplicates**
  `OutreachEventDialog.test.tsx`'s existing test almost exactly. My rejection-not-swallowed test
  is novel.

**Why I did not remove the overlapping tests:** the packet explicitly instructs "extend the
existing [`outreach.test.ts`]... as the ledger row requires" and forbids a second file; the
established pattern in this exact file (T146/T157/T327/T406/T402) is that the canonical loader
guard lives in `outreach.test.ts`, not scattered across whichever page happened to need the
function first. Every test I kept is real (mutation-proven, pasted above) and several close a
concrete, demonstrated weakness (shape-only → outcome-based) in the pre-existing coverage. I am
reporting the overlap explicitly rather than silently claiming five wholly "new" targets, per the
packet's own item 5/6 request.

## 8. Other things the packet got right, verified independently

- **27 export statements, 9 type/interface, 18 value exports**: confirmed by direct `grep -n
  "^export "` count.
- **`makeMarkDayComplete` is not a target**: confirmed — two describe blocks (T327, T406) already
  exist in `outreach.test.ts`, and I did not touch or add to them.
- **`loadOutreachData` (the bare singleton, not the factory) has zero call sites**: confirmed —
  it is never imported anywhere outside `outreach.ts` itself (only `makeLoadOutreachData`,
  the factory, is imported by test/page files).
- **§7's harness facts**: confirmed directly — no `@testing-library/react` in this file, no
  `vi.mock('./outreach')`, every test injects a fake client through each factory's `getClient`
  parameter. T406's and T402's stateful/recording-fake patterns were reused (not reinvented) for
  the new `makeSubmitRsvpChange` and `makeCancelOutreachEvent` stateful fakes, and the
  `makeMarkDayCompleteRecordingClient`-style order recorder was reused for `makeSaveOutreachEvent`.
- **T330's orphan-event risk is disclosed, not a bug to fix here**: confirmed by reading
  `docs/swarm/verification-log.md`'s T330 entry before writing the `makeSaveOutreachEvent` CREATE
  tests; my test for that path asserts the event is created and the rejection propagates
  (matching T330's own framing), and does not assert or require a rollback.

## 9. Known risks

- The `computeExpectedAttendeeRsvpPlan` and `makeLoadOutreachEventRoster` additions carry real but
  modest redundancy with existing page-level tests (§7) — a future consolidation task could delete
  the weaker, shape-only duplicates in `RsvpControl.test.tsx` / `OutreachDetail.test.tsx` /
  `OutreachList.test.tsx` now that stronger, outcome-based equivalents exist in the canonical
  loader file, but that is cross-file and out of this task's single-file Allowed Files — not done
  here, filed as a note rather than a task per item 20 (a full follow-up ledger row is the
  orchestrator's call, not mine to file unilaterally against files I cannot touch).
- `makeSaveOutreachEvent`'s fake client (`makeSaveOutreachEventClient`) is the most complex fake in
  this task; it is close in shape to `makeMarkDayCompleteRecordingClient` (T327) but not identical
  since it must cover four tables instead of three. I did not attempt to unify them, since the
  packet's own §3 forbids refactoring the existing helpers.

## 10. Not a dispute

Every mutation named above was run and reddened as described; no test survives its mutation; C1
and C3 hold at the end of the task. I am not filing a dispute — the packet's targets and Allowed
Files were followable as written, and the one significant packet error found (§7) is reported
as a finding, not a blocker.
