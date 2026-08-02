# T193 — worker output (evidence)

**Branch:** `claude/swarm-plan-zl575z` **Worked at:** own worktree, branched from `266a937`
**Commits landed:** `ac6fb51` (implementation), `e6c2d21` (prettier fix)
**Worker tier:** sonnet (as specified)

---

## 1. Summary of changes

`src/pages/outreach/OutreachList.tsx`:

- Added `onRsvpChange?: SubmitRsvpChangeFn` to `OutreachListProps`, defaulting to the real
  `submitRsvpChange` (`../../lib/supabase/loaders/outreach.ts`) — the SAME `rsvps` upsert
  `RsvpControl.tsx`/`ParentRsvp.tsx` already use. No second upsert was built.
- Threaded the prop through `OutreachList` → `OutreachListLoaded` → `ViewerStudentIdGate` →
  `StudentParentOutreachView`. **Never threaded into `CoachOutreachView`** — that view has no RSVP
  handler of its own (confirmed by C5 below).
- Rewrote `StudentParentOutreachView`'s `handleRsvpChange` from a synchronous local-only stub to an
  `async` function that:
  1. guards on a new single component-wide `isRsvpSubmitting` flag (ignores clicks while a write is
     outstanding — also makes the rollback concurrency-safe),
  2. **snapshots the whole `rsvps` ARRAY** (`const previousRsvps = rsvps`), not a scalar status,
  3. applies the existing `withRsvpOverride` optimistic update,
  4. `await`s the injected `onRsvpChange({ sessionId, studentId: viewerStudentId, status,
     respondedBy: viewerProfileId })`,
  5. on rejection, **restores the snapshot array** (`setRsvps(previousRsvps)`) and sets a visible
     error message,
  6. clears `isRsvpSubmitting` in `finally`.
- Added a dismissable error `Banner` ("Couldn't save your RSVP") next to the page heading, shown
  only when a write has failed — same copy/shape as `RsvpControl.tsx`'s own error `Banner`.
- Updated the module's own doc comments (module doc #8b, `withRsvpOverride`'s docstring, and a new
  module doc #16) to stop describing the RSVP control as local-only, since that premise is now false
  for this task's own reason.

`src/pages/outreach/OutreachList.test.tsx`:

- **Adapted the one pre-existing racing test** (packet §6): *"selecting a real RSVP segment updates
  the goal bar and the unanswered-RSVP badge live (module doc #8b)"*. It used to pass only because it
  asserted immediately after a synchronous `act()` with no flush, racing ahead of the real default
  writer's rejection (no Supabase config in the test harness). Now injects a resolving
  `vi.fn().mockResolvedValue(undefined)` as `onRsvpChange`, adds `await flushMicrotasks()` after the
  click, and adds one assertion that the fake was called exactly once. The live-update assertions
  themselves are unchanged.
- Added a new `describe('<OutreachList /> T193: real RSVP writer wiring (packet §5)')` block with
  four tests covering C1/C2 (combined — one call, right shape, right id in `respondedBy`), C3
  (rollback + visible error), C5 (coach never triggers the writer), and C6 (optimistic-before-await).

No other files were touched. `RsvpControl.tsx`, `ParentRsvp.tsx`, and `loaders/outreach.ts` are
untouched, as forbidden.

---

## 2. Acceptance criteria — mutations run, real red output

All six mutations were run in this order: commit clean → apply mutation → run
`npx vitest run src/pages/outreach/OutreachList.test.tsx` → capture real output → revert → confirm
`git diff --stat` is empty before the next mutation. Every mutation below was reverted cleanly; the
final `git diff` against the `ac6fb51`/`e6c2d21` commits is empty.

### C1 — revert `handleRsvpChange` to local-only

Mutation: replaced the whole function body with just `setRsvps((prev) =>
withRsvpOverride(prev, viewerStudentId, sessionId, status));`, no writer call.

```
FAIL  ... > selecting a real RSVP segment ... (module doc #8b)
AssertionError: expected "spy" to be called 1 times, but got 0 times

FAIL  ... > C1/C2: changing an RSVP calls the injected writer exactly once, ...
AssertionError: expected "spy" to be called 1 times, but got 0 times

FAIL  ... > C3: a rejected write restores the previous (unanswered) status ...
AssertionError: expected 'true' to be 'false'

Test Files  1 failed (1)
     Tests  3 failed | 93 passed (96)
```

### C2 — pass `viewerStudentId` as `respondedBy`

Mutation: `respondedBy: viewerStudentId` instead of `viewerProfileId`.

```
FAIL  ... > C1/C2: changing an RSVP calls the injected writer exactly once, ...
AssertionError: expected "spy" to be called with arguments: [ { …(4) } ]
  1st spy call:
  [
    {
-     "respondedBy": "user-student",
+     "respondedBy": "student-placeholder-current-viewer",
      "sessionId": "session-food-bank-upcoming",
      "status": "going",
      "studentId": "student-placeholder-current-viewer",
    },
  ]

Test Files  1 failed (1)
     Tests  1 failed | 95 passed (96)
```

### C3 — delete the rollback line in the `catch`

Mutation: removed `setRsvps(previousRsvps);` from the `catch` block.

```
FAIL  ... > C3: a rejected write restores the previous (unanswered) status ...
AssertionError: expected 'true' to be 'false' // Object.is equality
Expected: "false"
Received: "true"
  at src/pages/outreach/OutreachList.test.tsx:1865:9   (aria-checked on the phantom "going" segment)

Test Files  1 failed (1)
     Tests  1 failed | 95 passed (96)
```

### C4 — replace `await`/`try` with `void` (T179 precedent)

This is a **gate-level check, not an in-suite assertion** (no test can assert its own suite's exit
code) — verified by applying the mutation and running `npx vitest run
src/pages/outreach/OutreachList.test.tsx`, then checking `$?` directly.

Mutation: removed the `try`/`catch`/`finally` and the `await`, calling `void onRsvpChange({...})`
instead (kept the optimistic update and the in-flight flag, which is what T179's own precedent
described — the discarded piece is specifically the rejection handling).

```
$ npx vitest run src/pages/outreach/OutreachList.test.tsx; echo $?
FAIL  ... > C3: a rejected write restores the previous (unanswered) status ...
AssertionError: expected 'true' to be 'false'
Test Files  1 failed (1)
     Tests  1 failed | 95 passed (96)
1
```

Real exit code **1**. In this repo's actual harness (unlike T179's own precedent, where the suite
stayed all-green under `exit 1`), the mutation is caught doubly: by the suite's real exit code going
non-zero, and — because this task's own C3 test explicitly asserts the rollback the mutation also
strips — by an in-suite assertion failure too. Separately, re-running the same mutation against the
**full file** (not filtered to this one test) surfaced a genuine
`⎯⎯⎯⎯ Unhandled Rejection ⎯⎯⎯⎯⎯` block from Vitest itself (a real default-`submitRsvpChange` call
rejecting with `SupabaseNotConfiguredError`, uncaught) while investigating C5 below — confirming the
exact failure class T179 named exists and is reachable in this file's own harness, not just
asserted by the new C3 test.

### C5 — fire the writer on coach-view mount (no natural site exists)

**Honest framing, exactly as the packet requires: this does NOT discriminate against current code.**
Before this task, `CoachOutreachView` had no RSVP handler and no `onRsvpChange` prop at all — there
is no line to delete or invert. To produce red output at all, the mutation had to *add* a temporary
wiring (`onRsvpChange` threaded into `CoachOutreachViewProps`, a `useEffect` firing it on mount with
dummy args) that does not exist in shipped code, run it, then remove all of it.

```
FAIL  ... > C5 (regression guard, not a defect discriminator ...): a coach/admin viewer never
            triggers the writer
  × a coach/admin viewer never triggers the writer  164ms

⎯⎯⎯⎯ Unhandled Rejection ⎯⎯⎯⎯⎯
Unknown Error: Supabase isn't configured yet. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY ...
 ❯ getSupabaseClient src/lib/supabase/client.ts:102:11
 ❯ src/lib/supabase/loader.ts:212:22
 ❯ src/lib/supabase/loaders/outreach.ts:1086:11
 ❯ src/pages/outreach/OutreachList.tsx:3091:10   (the mutation's own useEffect)
 ... (23 unhandled-rejection errors total, one per coach-view test that mounts CoachOutreachView)

Test Files  1 failed (1)
     Tests  1 failed | 95 passed (96)
     Errors  23 errors
```

C5's own assertion (`expect(spy).not.toHaveBeenCalled()`) fails directly, plus every other
coach-view test that mounts `CoachOutreachView` now trips an unhandled rejection from the real
default writer. **Kept in the test suite as a regression guard with its mutation site named, not
dressed up as a defect-discriminating proof** — per packet §5's own instruction.

### C6 — move the state set after the `await`

Mutation: moved `setRsvps((prev) => withRsvpOverride(...))` from before `await onRsvpChange(...)` to
immediately after it, inside the `try`.

```
FAIL  ... > C6: the optimistic update is applied before the writer promise settles
AssertionError: expected 'Outreach1 awaiting your RSVPYour seas…' to contain '0 awaiting your RSVP'
  at src/pages/outreach/OutreachList.test.tsx:1900:35

Test Files  1 failed (1)
     Tests  1 failed | 95 passed (96)
```

(The write in this test never resolves — the point of C6 — so the optimistic update, if it existed,
would be the only visible change; with it moved after the `await` there is none, and the badge stays
at "1 awaiting" instead of dropping to "0".)

After every mutation above, the file was reverted and `git diff --stat` against the committed state
was confirmed empty before moving to the next one.

---

## 3. Gates — all six, `.env.local` absent

`.env.local` and `.env` both confirmed absent in the worktree before running any gate.

1. **`npx tsc --noEmit`** — exit 0, no output.
2. **`npx vite build`** — exit 0. Succeeds; pre-existing "chunks larger than 500 kB" advisory
   warning only (unrelated to this task, present on the unmodified branch point too).
3. **`npm run format:check`** — exit 0 now. (One prettier deviation was introduced by my own edit to
   `OutreachList.test.tsx` — two long `.find((el) => ...)` call chains that prettier wraps
   differently once the line grows past its print width — fixed with `npx prettier --write` and
   committed separately as `e6c2d21`; re-verified clean after.)
4. **`npx eslint .`** — exit 0, **0 errors, 361 warnings**. Verified against the unmodified branch
   point (`266a937`, via a disposable sibling worktree) — **also 361 warnings, 0 errors, byte-for-byte
   the same count.** No rise.
5. **`npx vitest run`** (full suite) — **baseline verified myself**, not trusted from the packet: at
   `266a937` (disposable sibling worktree), `1817 passed (75 files)`, exit 0 — matches the packet's
   claim. On this branch after the change: **`1821 passed (75 files)`, exit 0** — the delta is
   exactly the 4 new tests added under the T193 describe block (the adapted racing test is a rewrite
   of an existing test, not a new one, so it doesn't add to the count).
6. **`npx vitest run src/pages/outreach/OutreachList.test.tsx >/dev/null 2>&1; echo $?`** — `0`.
   96 tests (92 pre-existing + 4 new), all passing.

---

## 4. Forbidden-files check

Touched only `src/pages/outreach/OutreachList.tsx`, `src/pages/outreach/OutreachList.test.tsx`, and
this evidence doc — the three files §8 allows. `RsvpControl.tsx`, `ParentRsvp.tsx`, and
`loaders/outreach.ts` were read-only references, never edited. No second `rsvps` upsert was built.
`withRsvpOverride`'s signature is unchanged (only its docstring was extended).

---

## 5. Deferred — for the ledger (constitution item 20)

**Both real deferrals here are already-filed ledger rows, not new gaps this task introduces — cited,
not silently left in a comment:**

- **T174** (`Debt (fixture id-space confusion)`) already tracks `withRsvpOverride`'s own
  locally-appended row setting `respondedBy: studentId` (`OutreachList.tsx`, a `students.id` in a
  field that mirrors a `profiles.id` column). This task's packet (§3) explicitly named this as
  disclosed-but-out-of-scope, since it's local-only optimistic display state and
  `withRsvpOverride`'s signature is frozen by §4. Confirmed T174 already exists in the ledger
  (filed from T157's merge) and already names this exact confusion — no new task filed, this task's
  output is cited against it instead.
- **T190** (`Debt (fixture id-space)`) already tracks rekeying `OutreachList.tsx`'s fixtures off
  `PLACEHOLDER_CURRENT_STUDENT_ID`. Untouched by this task (my new C1–C6 tests reuse the existing
  fixture-keyed unanswered session rather than adding new fixtures), but noted here since T190's own
  row already names this exact file.

No new deferral tasks were filed — both known gaps this task's own scope touches are already ledger
rows; item 20 requires a ledger row to exist, not that this worker create a duplicate.

---

## 6. Known risks

- The new error `Banner` is placed once at the top of `StudentParentOutreachView`'s render (next to
  the "Outreach" heading), not per-row. With a single component-wide `isRsvpSubmitting` flag this is
  unambiguous (only one write can be in flight at a time), but it means the error message does not
  visually point at which session's RSVP failed if a student has scrolled away from it. This matches
  the packet's own instruction for a single in-flight flag and was not called out as needing a
  per-row error surface; flagging it here rather than silently deciding it doesn't matter.
- C1/C2 are asserted together in one test (`toHaveBeenCalledWith` checks the whole argument object),
  rather than as two separate tests each named after its own criterion letter. Both mutations were
  run and pasted separately above and both are independently red under their own mutation, so
  coverage is not weakened — this is a naming/grouping choice, not a coverage gap.
- Did not add a dedicated new module-doc-level regression test for "clicking twice while a write is
  in flight is a no-op" (the `isRsvpSubmitting` guard) — the packet did not name it as one of the six
  criteria, and adding untested surface area beyond §5's six felt like scope creep for a HEAVY-tier
  task with an already-large diff. Noting it here rather than silently deciding it isn't worth a
  follow-up: if the checker wants it, it's a small addition.

---

## 7. Dispute

None filed. Packet v2 was followed as written; both premise-gate corrections (rollback the array, not
the harness-safety false alarm) were built exactly as prescribed and independently reproduced the
same passing shapes the gate reported. No new packet defect was found.
