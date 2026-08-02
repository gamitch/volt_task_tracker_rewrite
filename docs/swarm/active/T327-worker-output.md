# T327 — worker output

**Branch:** `claude/t327-completion-ordering` (pushed from local branch `t327-work-local`, which
tracks `origin/claude/t327-completion-ordering` — the shared checkout at
`/home/user/volt_task_tracker_rewrite` already had that branch name checked out, so per §8 "do not
move the shared checkout's HEAD" this worker used its own worktree with a differently-named local
branch and pushed to the same remote ref. See "Process note" at the bottom.)

**Commit:** `2f6a26a` — `fix(T327): write attendance before flipping event_sessions to completed`

**Allowed files touched (only these two + this doc, per §8):**
- `src/lib/supabase/loaders/outreach.ts`
- `src/lib/supabase/loaders/outreach.test.ts`

No other file was touched. `MarkDayCompleteDialog.tsx`, `MarkEventCompleteDialog.tsx`,
`loaders/attendance.ts`, `endMeeting.test.ts` were read-only.

---

## 1. What changed

In `makeMarkDayComplete` (`outreach.ts`), swapped the order of writes (1) and (2):

- **Before:** `updateSession` (flip to `'completed'`) → `upsertAttendance` (guarded by
  `attendance.length > 0`) → adult-volunteer read-modify-write (guarded by nonzero delta).
- **After:** `upsertAttendance` (same guard) → `updateSession` (same flip) → adult-volunteer
  read-modify-write, **unchanged, still last, still guarded**.

Step (3) — the adult-volunteer `events` read-modify-write — was **not moved**. It is additive and
non-idempotent (§3); moving it would let a retry double-count volunteer hours. An inline comment was
added at its call site restating why it must stay last, and a comment was added above the reordered
writes explaining the idempotence argument for why *they* were safe to reorder.

Rewrote the two stale module-doc claims named in §6's table:
- `:117` (module doc #4's *"performs, in order"* list) — now lists attendance-then-flip, with a
  parenthetical noting the T327 reorder and pointing at the new asymmetry note.
- `:1143-1145` (originally `:1122-1124` before the doc grew; `makeMarkDayComplete`'s own one-line doc
  comment) — now states the new order and flags that the third write must not move.

Added a new paragraph to module doc #4 (end of the section, before the "Trap #5" divider) stating
§3's asymmetry explicitly: *idempotent writes may be reordered to protect a retry; non-idempotent
ones may not* — so the next reader does not "finish the job" by moving step (3) too.

---

## 2. Independently measured baselines (branch point `0016780` == `main`, `.env.local` absent)

Measured in a throwaway worktree at commit `0016780`, not in the shared checkout (removed after
measurement):

```
tsc --noEmit                        exit 0
eslint .                            0 errors, 361 warnings
vitest run                          76 files, 1837 tests, exit 0
loaders/outreach.test.ts            5 tests
MarkDayCompleteDialog.test.tsx      54 tests
MarkEventCompleteDialog.test.tsx    25 tests
vite build                          exit 0, "built in 5.16s"
format:check                        "All matched files use Prettier code style!"
```

These match the packet's §6 table exactly. No discrepancy to report.

---

## 3. Gates — all six, `.env.local` ABSENT, real output

### Gate 1 — `npx tsc --noEmit`
```
(no output)
exit 0
```

### Gate 2 — `npx vite build`
```
✓ built in 4.97s
```
(one re-run after the final commit: `✓ built in 5.24s`). No errors, only the pre-existing
"chunks are larger than 500 kB" advisory (unrelated to this change, present at baseline too).

### Gate 3 — `npm run format:check`
```
Checking formatting...
All matched files use Prettier code style!
```
(One intermediate run flagged `outreach.test.ts` before I ran `prettier --write` on it — see
"What did not go as predicted" below.)

### Gate 4 — `npx eslint .`
```
✖ 361 problems (0 errors, 361 warnings)
  0 errors and 1 warning potentially fixable with the `--fix` option.
```
0 errors, 361 warnings — identical count to the independently-measured baseline. No rise.

### Gate 5 — `npx vitest run` (full suite)
```
Test Files  76 passed (76)
     Tests  1842 passed (1842)
```
1842 = 1837 baseline + 5 new tests (C1–C5). All 76 files still pass.

### Gate 6 — targeted run
```
npx vitest run src/lib/supabase/loaders/outreach.test.ts src/pages/outreach/MarkDayCompleteDialog.test.tsx src/pages/outreach/MarkEventCompleteDialog.test.tsx
```
```
✓ src/lib/supabase/loaders/outreach.test.ts (10 tests)
✓ src/pages/outreach/MarkEventCompleteDialog.test.tsx (25 tests)
✓ src/pages/outreach/MarkDayCompleteDialog.test.tsx (54 tests)

 Test Files  3 passed (3)
      Tests  89 passed (89)
EXITCODE=0
```
10 + 54 + 25 = 89. Both dialog files pass **with zero edits** (confirmed by `git status`/`git diff`
showing neither file touched). 10 = the original 5 `outreach.test.ts` tests + the 5 new C1–C5 tests.

---

## 4. C1–C5 — mutation applied and the real red output

**Discipline followed:** commit before mutating (`2f6a26a`), mutate, run
`npx vitest run src/lib/supabase/loaders/outreach.test.ts`, capture the red output, then
`git checkout -- src/lib/supabase/loaders/outreach.ts` to revert (verified clean via `git status`/
`git diff` after every revert — never `git checkout --` while anything else was uncommitted, since
the test file was also committed).

### C1 — attendance before flip; order recorder
**Assertion:** `expect(setup.order).toEqual([...])` — the full ordered sequence of
`{table, method}` entries recorded by the fake client, with nonzero adult-volunteer deltas so the
recorder must distinguish `event_sessions.update` (the flip) from `event_sessions.select` (step 3's
read).

**Mutation:** restored the original order (flip first, then the guarded attendance upsert).

**Real red output:**
```
FAIL  outreach.test.ts > ... > C1: writes attendance BEFORE flipping event_sessions to completed ...
AssertionError: expected [ …(5) ] to deeply equal [ { table: 'attendance', …(1) }, …(4) ]
- Expected
+ Received
@@ -1,13 +1,13 @@
  [
    {
-     "method": "upsert",
-     "table": "attendance",
-   },
-   {
      "method": "update",
      "table": "event_sessions",
+   },
+   {
+     "method": "upsert",
+     "table": "attendance",
    },
    {
      "method": "select",
      "table": "event_sessions",
    },
```
Reverted; suite green again (10/10).

### C2 — attendance rejects ⇒ no flip; presence+absence paired
**Assertion:** attendance upsert was attempted (`attendanceUpsertArgs` length 1 — presence) AND no
`event_sessions.update` was ever issued (`eventSessionsUpdateArgs` length 0 — absence), with the
attendance write configured to reject (`error: {message:'boom', code:'ATTENDANCE_FAIL'}`), and
`markDayComplete(...)` asserted to reject via `.rejects.toBeTruthy()`.

**Mutation:** same as C1 — swap back to flip-first.

**Real red output:**
```
FAIL  outreach.test.ts > ... > C2: when the attendance write rejects, event_sessions is never flipped ...
AssertionError: expected [ { status: 'completed', …(1) } ] to have a length of +0 but got 1
- Expected
+ Received
- 0
+ 1
 ❯ outreach.test.ts:492:43
    490|     expect(setup.attendanceUpsertArgs).toHaveLength(1);
    491|     // Absence: no update carrying status:'completed' was ever issued.
    492|     expect(setup.eventSessionsUpdateArgs).toHaveLength(0);
```
With flip-first restored, the old code calls `updateSession` (which resolves fine — the mutation only
makes attendance reject) BEFORE the attendance upsert rejects, so `eventSessionsUpdateArgs` already
has one entry by the time the assertion runs — turning the absence half of the paired assertion red,
exactly as the reachability argument in §1 predicts. Reverted; suite green again.

### C3 — empty attendance still flips; `length > 0` guard preserved
**Assertion:** with `attendance: []`, `attendanceUpsertArgs` stays empty (guard held) and
`eventSessionsUpdateArgs` still records the one flip with `{status:'completed', people_reached:12}`.

**Mutation:** dropped the `length > 0` guard — attendance upsert is now called unconditionally (even
with a zero-length array).

**Real red output:**
```
FAIL  outreach.test.ts > ... > C3: with no attendance rows, the session still flips to completed ...
AssertionError: expected [ [ [], …(1) ] ] to have a length of +0 but got 1
- Expected
+ Received
- 0
+ 1
 ❯ outreach.test.ts:507:40
    507|     expect(setup.attendanceUpsertArgs).toHaveLength(0);
```
The fake client's `attendance.upsert` was called with an empty array — proving the guard's removal is
what the test catches, not some unrelated crash. Reverted; suite green again.

### C4 — adult-volunteer update stays last; happy path resolves
**Assertion:** same ordered-sequence check as C1 (attendance → session-update → session-select →
events-select → events-update), **plus** `.resolves.toBeUndefined()` on the happy path.

**Mutation:** moved the whole step-(3) block (guard + read + read + update) to run *before* the
`updateSession` flip — the exact trap §3 warns against.

**Real red output:**
```
FAIL  outreach.test.ts > ... > C4: the adult-volunteer update still runs LAST ...
AssertionError: expected [ …(5) ] to deeply equal [ { table: 'attendance', …(1) }, …(4) ]
- Expected
+ Received
  ...
    {
      "method": "select",
      "table": "event_sessions",
    },
    {
      "method": "select",
      "table": "events",
    },
    {
      "method": "update",
      "table": "events",
+   },
+   {
+     "method": "update",
+     "table": "event_sessions",
    },
  ]
```
The recorded order shows `event_sessions.update` (the flip) now happening AFTER `events.update` —
step (3) ran before the flip, as the mutation forced. This is C4's job as "the guard for §3": it goes
red the moment step (3) moves. (C1 also went red under this same mutation, since it shares the order
assertion — the packet does not forbid two criteria catching the same mutation, and this is the
"resolves normally" half that is C4's unique contribution per v2's note about the folded C6.)
Reverted; suite green again.

### C5 — adult-volunteer update skipped when both deltas are 0
**Assertion:** with both deltas `0`, no `events`-table call is ever recorded
(`setup.order.some(call => call.table === 'events')` is `false`), and `eventsUpdateArgs` stays empty.

**Mutation:** removed the `if (delta > 0 || delta > 0)` guard entirely — the step-(3) block now
always runs.

**Real red output:**
```
FAIL  outreach.test.ts > ... > C5: the adult-volunteer update is skipped entirely when both deltas are 0
AssertionError: expected true to be false // Object.is equality
- Expected
+ Received
- false
+ true
 ❯ outreach.test.ts:537:65
    537|     expect(setup.order.some((call) => call.table === 'events')).toBe(f...
```
With the guard gone, `loadSessionEventId`/`loadEventVolunteerTotals`/`updateEventVolunteerTotals`
all ran even with zero deltas, hitting the `events` table and turning the test red. Reverted; suite
green again.

**All five criteria's named mutations reddened exactly the test(s) they were supposed to. None left
the suite green.**

---

## 5. What did not go entirely as predicted

- **`prettier` formatting**: after writing the new C1–C5 tests, `npm run format:check` flagged
  `outreach.test.ts` (not `outreach.ts`). Ran `npx prettier --write
  src/lib/supabase/loaders/outreach.test.ts` (an Allowed File) to fix it before committing;
  `format:check` then passed clean. This is a normal "write code, run formatter" step, not a packet
  error, but flagging it per "report anything that did not work as predicted."
- Everything else (harness caveat, the two module-doc line numbers — actual final line numbers
  shifted slightly from `:117`/`:1122-1124` to `:117`/`:1143-1145` after the doc grew by a few lines
  for the asymmetry note, but the *claims* being fixed are the same two the packet named — the
  mutation-discrimination behavior of C1–C5, the module doc's own claim about the write order, the
  three exact test counts, the `endMeeting.test.ts:353`/`:613` patterns) matched the packet exactly.
  No other discrepancy to report.

---

## 6. Non-negotiables checklist

1. Allowed files only: `outreach.ts`, `outreach.test.ts`, this doc. Confirmed via
   `git diff --stat` on the commit — exactly those two source files changed, this doc created
   separately (untracked in the mutation-testing commit, added now).
2. Step (3) was **not** moved in the shipped diff — only in the C4 mutation, which was reverted.
   `git diff` against the commit shows step (3) still last.
3. All five mutations run, real red output pasted above; none left the suite green.
4. Committed (`2f6a26a`) before any mutation was applied.
5. All six §7 gates reported above, `.env.local` absent for every run (verified `ls -la .env.local`
   → "No such file or directory" before starting).
6. No existing assertion was weakened or deleted. `git diff` on `outreach.test.ts` is purely
   additive (new import members, new describe block) — confirmed by re-reading the diff before
   committing. Both dialog test files needed zero edits, as predicted.
7. No `node_modules` symlink staged — staged with explicit pathspecs
   (`git add src/lib/supabase/loaders/outreach.ts src/lib/supabase/loaders/outreach.test.ts`), never
   `git add -A`.

---

## 7. Deferred — for the ledger

1. **Atomic adult-volunteer increment RPC (from §3).** Step (3) of `makeMarkDayComplete` remains a
   disclosed, non-atomic, additive read-modify-write on `events.adult_volunteers_count` /
   `adult_volunteer_hours` — `.select()` the current totals, add this session's delta in TypeScript,
   `.update()` the computed sum. Postgrest's REST interface has no `SET column = column + $delta`
   expression support, so a genuinely atomic increment needs a Postgres function exposed as an RPC:
   ```sql
   -- sketch, not shipped here — a real migration + RPC definition is out of this task's scope
   create or replace function increment_event_volunteer_totals(
     p_event_id uuid,
     p_count_delta integer,
     p_hours_delta numeric
   ) returns void as $$
     update events
     set adult_volunteers_count = adult_volunteers_count + p_count_delta,
         adult_volunteer_hours = adult_volunteer_hours + p_hours_delta
     where id = p_event_id;
   $$ language sql;
   ```
   called via `client.rpc('increment_event_volunteer_totals', {...})` instead of the current
   select-then-update pair. This removes both of step (3)'s residual risks in one move: the
   TOCTOU race between two coaches completing different days of the same event concurrently, and
   the reason step (3) can never be safely reordered earlier in `makeMarkDayComplete` (its own
   non-idempotence). Requires a new migration and a new deploy surface — a different tier from this
   task, per §2/§3. Not fixed here.
2. **T330 stays open, needs its own packet.** Not touched by this task — see the packet's §9 for the
   full corrected analysis (the v1 no-change closure proposal was wrong; `buildEventGroups` drops a
   zero-session event from the coach's list entirely, so the recovery path v1 cited is dead code on
   the surface that matters). No T330 work was performed here; restating it only because the packet
   asked this section to carry the §3 RPC row, and T330 is the other open item the packet surfaces.

---

## 8. Process note

The shared checkout at `/home/user/volt_task_tracker_rewrite` already had
`claude/t327-completion-ordering` checked out at the packet commit (`cd5fed8`) when this worker
started — that's how the packet was read (via `git show origin/... :path`, not by moving that
checkout's HEAD). Git does not allow the same local branch to be checked out in two worktrees
simultaneously, so this worktree used a local branch named `t327-work-local`, created from
`origin/claude/t327-completion-ordering` and configured to track it. All work was committed to
`t327-work-local` and pushed with `git push`, which — because of the tracking configuration —
updates `origin/claude/t327-completion-ordering` directly. The shared checkout's own local branch
ref was never touched; its HEAD was not moved, per §8's instruction. `git worktree list` will show
`t327-work-local` as a separate branch name in this worktree, but the remote branch named in the
packet received the commit.
