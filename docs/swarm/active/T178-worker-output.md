# T178 — Worker Output (revision 2 — BUILD HALF ONLY)

**Packet pin verified:** `git log -1 --format=%H -- docs/swarm/active/T178-worker-packet.md`
printed `c36f50244aa105f33b3269108bf196f87a1e4f64`, matching the required pin.

**Merge result:** `git fetch origin && git merge origin/claude/t178-end-meeting-dialog`
fast-forwarded cleanly (`a3b9f00..c36f502`), no conflicts. `npm ci` completed
(340 packages, 9 pre-existing vulnerabilities unrelated to this task, not
addressed).

**Commit SHA (this task's work):** `64eeb83179295dabb36967f0790d8c2730cbe641`.
`git log -1` after commit confirms HEAD moved there; `git status` reports a
clean working tree.

---

## Files changed

- `src/lib/supabase/loaders/endMeeting.ts` — **new**, 473 lines.
  `makeLoadEndMeetingSummary`/`loadEndMeetingSummary`,
  `makeOnEndMeeting`/`onEndMeeting`, `makeOnEditAttendance`.
- `src/lib/supabase/loaders/endMeeting.test.ts` — **new**, 643 lines, 14
  tests covering all 13 acceptance criteria (criterion 13 is grep-only,
  reported below, not a runtime test; criteria 1 and 2 each have a paired
  base + mutation test).
- `src/pages/meetings/EndMeetingDialog.tsx` — **modified, module doc only**
  (above the `import` line). Diff confirmed confined to two comment blocks
  (lines ~38-54, ~111-128); zero function/type/JSX changes (`git diff`
  reviewed in full, pasted below).

**Zero-diff confirmation on every other Forbidden file:** `git status
--porcelain` after the commit shows exactly these three files and nothing
else — `LiveConsole.tsx`/`LiveConsole.test.tsx`,
`src/pages/home/**`/`DashboardPage.*`, `EndMeetingDialog.test.tsx`,
`src/lib/supabase/loaders/attendance.ts`/`meetings.ts`/`kiosk.ts`/
`checkin.ts`/`seasons.ts`, `src/app/router.tsx`/`guards.tsx`,
`supabase/migrations/**`, and every `docs/swarm/**` file other than this new
output doc are untouched.

`git diff src/pages/meetings/EndMeetingDialog.tsx`:

```diff
diff --git a/src/pages/meetings/EndMeetingDialog.tsx b/src/pages/meetings/EndMeetingDialog.tsx
index c187d28..24eaec1 100644
--- a/src/pages/meetings/EndMeetingDialog.tsx
+++ b/src/pages/meetings/EndMeetingDialog.tsx
@@ -38,16 +38,20 @@
  * checkout are ever simulated locally, mirroring `SeasonSettings.tsx`'s own
  * `withActiveSeason` precedent for "the one place a derived mutation is ever
  * applied to local state") AFTER that call resolves -- if it rejects, local
- * state is never touched (no optimistic half-flip). A real backend
- * implementation (a future wiring task, not this one) is expected to
- * implement `onEndMeeting` as a single transaction (e.g. an RPC running the
- * backfill INSERTs, the checkout UPDATEs, and the `event_sessions` UPDATE
- * together) so a real DB never observes a transiently-inconsistent state
- * either -- this file cannot prove that transactional detail (no Supabase
- * client is wired in here, section 5 below), but the callback's own single-
- * payload shape is deliberately built so a real implementation CAN satisfy
- * it atomically, rather than forcing three uncoordinated calls on the
- * caller.
+ * state is never touched (no optimistic half-flip). CORRECTED (T178): a real
+ * backend implementation (`src/lib/supabase/loaders/endMeeting.ts`, a
+ * separate task's own file, not this one) is THREE sequenced writes, not a
+ * single transaction/RPC -- no `supabase.rpc(...)` call, backfill (INSERT
+ * ... ON CONFLICT DO NOTHING) then checkout (UPDATE) then the
+ * `event_sessions` status flip (UPDATE), always in that order, always
+ * awaited sequentially. No RPC is needed because that ordering already
+ * makes every reachable partial-failure state safe on its own (see that
+ * file's own module doc for the full property) -- this file cannot prove
+ * that safety property itself (no Supabase client is wired in here, section
+ * 5 below), but the callback's own single-payload shape is deliberately
+ * built so a real implementation CAN satisfy the "one coherent action"
+ * contract this way, rather than forcing the caller to dispatch three
+ * uncoordinated calls of its own.
  *
  * -----------------------------------------------------------------------
  * 2. `trg_audit_attendance_post_completion` -- THE single most important
@@ -107,21 +111,21 @@
  *
  *   (a) ORDERING within `handleConfirmEndMeeting` (Known Context/Traps
  *       #1c/#2a): the backfill/checkout mutations described in section 1
- *       above must happen BEFORE (or, in one transaction, logically prior
- *       to) `event_sessions.status` flipping to `'completed'`. Backfill is
- *       an INSERT (never fires an `after update` trigger regardless of
- *       ordering), but checkout IS an `attendance` UPDATE
- *       (`check_out_at = ends_at` on an existing row) -- if that UPDATE ran
- *       AFTER the session row already read `'completed'`, the trigger would
- *       fire and log it as `attendance_edited_post_completion`, which is
- *       WRONG: closing out an open check-in as part of ending the meeting
- *       is the intentional, expected completion action itself, not a
- *       later correction a coach makes to an already-closed meeting. A real
- *       single-transaction implementation of `onEndMeeting` (section 1)
- *       naturally satisfies this by running the checkout UPDATEs and the
- *       `event_sessions` UPDATE as ordered statements in the same
- *       transaction (checkout first, status flip last) -- disclosed here as
- *       the specific reason that ordering matters, not just asserted.
+ *       above must happen BEFORE `event_sessions.status` flips to
+ *       `'completed'`. Backfill is an INSERT (never fires an `after update`
+ *       trigger regardless of ordering), but checkout IS an `attendance`
+ *       UPDATE (`check_out_at = ends_at` on an existing row) -- if that
+ *       UPDATE ran AFTER the session row already read `'completed'`, the
+ *       trigger would fire and log it as `attendance_edited_post_completion`,
+ *       which is WRONG: closing out an open check-in as part of ending the
+ *       meeting is the intentional, expected completion action itself, not a
+ *       later correction a coach makes to an already-closed meeting.
+ *       CORRECTED (T178): a real implementation of `onEndMeeting` (section 1)
+ *       is three sequenced writes, not one transaction -- it naturally
+ *       satisfies this by awaiting the checkout UPDATE before issuing the
+ *       `event_sessions` UPDATE (checkout second, status flip always last)
+ *       -- disclosed here as the specific reason that ordering matters, not
+ *       just asserted.
  *   (b) FUTURE coach edits (Known Context/Traps #2b): any attendance
  *       correction made AFTER this dialog's confirm (e.g. a coach later
  *       fixing a student's status from `present` to `late`) is a plain
```

---

## Design summary (not re-derived — cited from the packet/gate as instructed)

`loadEndMeetingSummary`: session (`event_sessions`) → event (`events`, for
`title`/`team_ids`) → active students (`students`, server-side
`.eq('is_active', true)`) → client-side team-scope filter → roster;
`attendanceByStudentId` populated exclusively via
`makeLoadAttendanceForSessions` (`./attendance`, the DI factory), never a
second, independent `attendance` query in this function.

`onEndMeeting`: three sequenced `runMutation` calls, always
backfill → checkout → flip, never `Promise.all`. Ordering reason and the
partial-failure safety property are stated in `endMeeting.ts`'s own module
doc #1, cited from the migration/gate findings, not re-derived.

`onEditAttendance`: `makeOnEditAttendance(getRecordedBy, getClient?)` reads
`getRecordedBy()` fresh on every call of the returned function; rejects
before any network call if it resolves `null`.

---

## Per-criterion mutation evidence

All commands run from the worktree root. Every mutation below was applied
directly to `src/lib/supabase/loaders/endMeeting.ts`, the specific test
re-run in isolation (`-t "criterion N"`), the actual failure captured, then
reverted, then the full `endMeeting.test.ts` suite re-run green before
moving to the next criterion. No mutation was reasoned about without being
run.

### Criterion 1 — real injected DB state + positive control

Test: `criterion 1: returns real, injected DB state, not the dialog's own
fixture` (asserts `result.session.title === 'Robotics Shop Night'`, an
injected value). Paired positive control: `criterion 1 (positive control):
the same title assertion FAILS against defaultLoadEndMeetingSummary` —
asserts the fixture's own title is NOT `'Robotics Shop Night'` (it is
`'Tuesday Build Meeting'`), proving the first assertion is not vacuously
satisfiable by the fixture. Both pass; no separate mutation prescribed for
criterion 1 beyond the positive control itself.

### Criterion 2 — roster team-scoping + mutation

Base test passes (`['student-in-scope']` only). Mutation (`team_ids: null`)
is its own dedicated test, `criterion 2 mutation: team_ids: null makes both
... appear`, and passes (`['student-in-scope', 'student-out-of-scope']`).
Both are permanent tests in the committed suite, not an ad hoc source edit —
the "mutation" here is a payload variation, not a source-code defect
injection, per the criterion's own wording.

### Criterion 3 (CORRECTED) — `.eq('is_active', true)` argument-provable

`recordedByTable.students.eqArgs` is asserted to contain `['is_active',
true]` — never asserted against returned data (a stub client would pass
regardless of the real filter on returned-data assertions, per the gate's
own MAJOR-1 finding). Test passes.

### Criterion 4 — real `attendance.ts` mapper reuse

Test asserts `result.attendanceByStudentId['student-real-4']` equals the
exact camelCase shape only `attendance.ts`'s own
`mapAttendanceDbRowToAttendanceRow` produces. Passes.

Grep proof (no second, independent `attendance` query inside
`makeLoadEndMeetingSummary`):

```
$ grep -n "^export function makeLoadEndMeetingSummary\|^export const loadEndMeetingSummary\|^export function makeOnEndMeeting\|^export const onEndMeeting\|^export function makeOnEditAttendance" src/lib/supabase/loaders/endMeeting.ts
287:export function makeLoadEndMeetingSummary(
349:export const loadEndMeetingSummary: LoadEndMeetingSummaryFn = makeLoadEndMeetingSummary();
372:export function makeOnEndMeeting(getClient: () => SupabaseClient = getSupabaseClient): OnEndMeetingFn {
423:export const onEndMeeting: OnEndMeetingFn = makeOnEndMeeting();
444:export function makeOnEditAttendance(

$ grep -n "\.from('attendance')" src/lib/supabase/loaders/endMeeting.ts
375:      client.from('attendance').upsert(
391:        .from('attendance')
451:        .from('attendance')
```

`makeLoadEndMeetingSummary` spans lines 287-348; all three `.from('attendance')`
occurrences (375, 391, 451) fall inside `makeOnEndMeeting`/`makeOnEditAttendance`,
strictly after 372. Zero occurrences inside the summary-load function —
confirmed.

### Criterion 5 (CORRECTED, BLOCKER 2) — true sequencing via deferred promises

Test drives `onEndMeeting(payload)` and asserts, before resolving anything,
only the backfill call was issued; resolves it, flushes microtasks, asserts
only checkout is now issued; resolves it, flushes, asserts the flip is now
issued. Passes.

**Proof step — old concurrent mutation vs. the new test:** applied
`M5b-concurrent-promise-all` directly to `makeOnEndMeeting`'s return
statement (`await Promise.all([backfillAbsences(...), checkoutStudents(...),
flipSessionStatus(...)])` instead of three sequential `await`s), ran:

```
$ npx vitest run src/lib/supabase/loaders/endMeeting.test.ts -t "criterion 5"
 × makeOnEndMeeting > criterion 5 ... 11ms
   → expected [ Array(1) ] to have a length of +0 but got 1
AssertionError: expected [ Array(1) ] to have a length of +0 but got 1
- Expected: 0
+ Received: 1
 ❯ src/lib/supabase/loaders/endMeeting.test.ts:458:44
    458|     expect(setup.checkoutCalls.updateArgs).toHaveLength(0);
```

Confirms the mutation now fails against the revised test (it passed 17/17
against the original criterion 5 in the gate's own reference). Reverted;
`endMeeting.test.ts` re-ran 14/14 green.

### Criterion 6 — backfill upsert shape + mutation

Base test asserts the exact row shape (`session_id`, `student_id`, `status:
'absent'`, `method: 'coach'`, `recorded_by: null`) plus `{onConflict:
'session_id,student_id', ignoreDuplicates: true}`. Passes.

**Mutation — drop `ignoreDuplicates`:**

```
$ npx vitest run src/lib/supabase/loaders/endMeeting.test.ts -t "criterion 6"
 × makeOnEndMeeting > criterion 6 ... 26ms
AssertionError: expected { onConflict: 'session_id,student_id' } to deeply equal { …(2) }
- "ignoreDuplicates": true,
  "onConflict": "session_id,student_id",
```

Confirmed fail. Reverted; suite re-ran green.

### Criterion 7 — checkout write shape + mutation

Base test asserts `check_out_at: payload.endsAt`, `.eq('session_id', ...)`,
`.in('student_id', [...])`, `.is('check_out_at', null)`. Passes.

**Mutation — drop the `.is('check_out_at', null)` guard:**

```
$ npx vitest run src/lib/supabase/loaders/endMeeting.test.ts -t "criterion 7"
 × makeOnEndMeeting > criterion 7 ... 11ms
AssertionError: expected [] to deep equally contain [ 'check_out_at', null ]
- [ "check_out_at", null ]
+ []
```

Confirmed fail on the intended assertion (not a `TypeError`/crash — the
chain's own `.then()` still resolves via the last call actually made,
matching real supabase-js's own thenable-at-every-step behavior). Reverted;
suite re-ran green.

### Criterion 8 — status-flip write shape + mutation

Base test asserts `{status: 'completed'}` scoped `.eq('id', sessionId)`.
Passes.

**Mutation — change the written status to `'canceled'`:**

```
$ npx vitest run src/lib/supabase/loaders/endMeeting.test.ts -t "criterion 8"
 × makeOnEndMeeting > criterion 8 ... 11ms
AssertionError: expected { status: 'canceled' } to deeply equal { status: 'completed' }
- "status": "completed",
+ "status": "canceled",
```

Confirmed fail. Reverted; suite re-ran green.

### Criterion 9 (CORRECTED, MAJOR 3) — `isSupabaseLoaderError` + `.cause`

Test injects `{data: null, error: {message: 'flip exploded', code:
'FLIP_FAIL'}}` on the flip step (after backfill and checkout both resolved
successfully), catches the rejection, and asserts `isSupabaseLoaderError(caught)
=== true` and `caught.cause` deep-equals `{message: 'flip exploded', code:
'FLIP_FAIL'}` — never asserts on the top-level `.message` (which would be
the fixed DES-16 copy, not the injected string). Also asserts (a) the
backfill call was issued and (b) the checkout call was issued before the
rejection (both call-count assertions pass). Test passes; no separate
mutation prescribed for criterion 9 beyond the correction itself (it is
already the corrected criterion).

### Criterion 10 — retry after success is safe

Test calls `onEndMeeting(payload)` twice against the same already-resolved
client and asserts each of the three write call-counts is 2 (i.e. the
second call re-issues all three writes, no throw). Passes.

### Criterion 11 (CORRECTED, BLOCKER 1) — identity read fresh per call, proof step

Test builds ONE `makeOnEditAttendance` instance with ONE `getRecordedBy`
returning `'coach-real-id-1'` then `'coach-real-id-2'` on successive calls,
calls the SAME returned function twice, asserts the two writes' `recorded_by`
differ correctly. Passes.

**Proof step — construction-time-baked variant vs. the new test:** replaced
the returned closure's `getRecordedBy()` call with a `const bakedOnce =
getRecordedBy();` hoisted above the returned function (exactly the mutation
named in the packet/gate), ran:

```
$ npx vitest run src/lib/supabase/loaders/endMeeting.test.ts -t "criterion 11"
 × makeOnEditAttendance > criterion 11 ... 14ms
AssertionError: expected { status: 'late', …(1) } to match object { recorded_by: 'coach-real-id-2' }
- "recorded_by": "coach-real-id-2",
+ "recorded_by": "coach-real-id-1",
```

Confirms the baked variant now fails against the revised test (it passed
against the original two-factory-instance criterion 11 in the gate's own
reference). Reverted; suite re-ran green.

### Criterion 12 — null identity rejects before any network call + mutation

Base test: `getRecordedBy` returns `null`; asserts the promise rejects and
`fromSpy` was never called. Passes.

**Mutation — delete the guard** (removed the `if (recordedBy === null) throw
...` block, cast `recordedBy as string` to bypass the type error and call
`editAttendance` unconditionally):

```
$ npx vitest run src/lib/supabase/loaders/endMeeting.test.ts -t "criterion 12"
 × makeOnEditAttendance > criterion 12 ... 9ms
AssertionError: promise resolved "undefined" instead of rejecting
- Expected: Error { "message": "rejected promise" }
+ Received: undefined
```

Confirmed the test starts observing a real (non-rejecting) call once the
guard is deleted. Reverted; suite re-ran green.

### Criterion 13 — no `audit_log` write, grep-provable, static

```
$ grep -n "audit_log" src/lib/supabase/loaders/endMeeting.ts
164: * 4. `audit_log` -- never written here, anywhere.
168: * place a real `audit_log` row for a post-completion `attendance` edit is
172: * inserts into `audit_log` anywhere -- grep-provable, zero occurrences.
```

All three hits are inside the module-doc comment; zero occurrences of
`audit_log` as an actual table/identifier reference anywhere else in the
file. Not a runtime test, per the packet's own instruction.

---

## Doc correction — `grep -i transaction` before/after

Before (baseline, at merge-base tree, matches the gate's own count exactly):

```
$ git show a3b9f00:src/pages/meetings/EndMeetingDialog.tsx | grep -in transaction
43: * implement `onEndMeeting` as a single transaction (e.g. an RPC running the
46: * either -- this file cannot prove that transactional detail (no Supabase
110: *       above must happen BEFORE (or, in one transaction, logically prior
120: *       single-transaction implementation of `onEndMeeting` (section 1)
123: *       transaction (checkout first, status flip last) -- disclosed here as
584: * Module doc section 5. Represents "the real single transaction that flips
593:      'a real single transaction would have applied atomically (module doc section 1).',
```

7 hits, matching the packet/gate's own count.

After (this task's commit):

```
$ grep -in transaction src/pages/meetings/EndMeetingDialog.tsx
44: * single transaction/RPC -- no `supabase.rpc(...)` call, backfill (INSERT
124: *       is three sequenced writes, not one transaction -- it naturally
588: * Module doc section 5. Represents "the real single transaction that flips
597:      'a real single transaction would have applied atomically (module doc section 1).',
```

4 hits. The two module-doc clusters (originally lines 43/46 and 110/120/123)
are corrected — both now accurately describe three sequenced writes, not a
transaction/RPC (the word "transaction" still appears in the corrected text
at lines 44/124 only because it is being used to correctly say what the
design is NOT, not as a false steer).

**Disclosed, uncorrected residual (as required, not touched):** lines 588
and 597 sit inside `defaultOnEndMeeting`'s function body (a `console.warn`
string literal) and below the `import` statement — function content,
forbidden under this packet's Allowed Files (module-doc-only, above the
import line). Both are a dev-console-only string, never rendered to a user
— low stakes, but left uncorrected and disclosed here as required.

---

## Five gates, re-measured at this task's own merge base

`.env.local` absent throughout (confirmed via `ls -la .env.local` →
"No such file or directory").

1. **`tsc --noEmit`** — clean, zero errors, before and after every mutation
   proof step and after the final revert.
2. **`vite build`** (`npm run build`) — succeeds, `✓ built in 5.21s`/`5.05s`
   across two runs. One pre-existing, unrelated chunk-size warning (`index-*.js`
   > 500kB) — not from this task's files, not addressed (out of scope).
3. **`prettier --check`** (`npm run format:check`) — initially flagged both
   new files (`endMeeting.ts`, `endMeeting.test.ts`); ran `npx prettier
   --write` on exactly those two files, re-ran `format:check`: **"All
   matched files use Prettier code style!"** Confirmed the packet's own
   cited pre-existing residual separately: `npx prettier --check
   src/theme/volt.ts` → `[warn] src/theme/volt.ts` (fails on its own, but is
   excluded from `format:check`'s own glob — `"!src/theme/volt.ts"` — so it
   does not fail the gate; not touched by this task, matches the packet's
   claim exactly).
4. **`eslint`** (`npm run lint`) — **`✖ 358 problems (0 errors, 358
   warnings)`**, matching the packet's own cited baseline (69 files / 0
   errors / 358 warnings) exactly — confirms this task's two new files
   introduce zero new lint issues. The only warnings attributed to
   `EndMeetingDialog.tsx` in the output (`react-refresh/only-export-components`
   at lines 378/390/404/425/457) are pre-existing, on export statements this
   task never touched (module-doc-only edit).
5. **`vitest run`** (full suite) — **`Test Files 70 passed (70)` / `Tests
   1668 passed (1668)`**, up from the cited baseline of 69 files / 1654
   tests by exactly this task's own addition (+1 file, +14 tests) — zero
   regressions anywhere else in the suite. `EndMeetingDialog.test.tsx`
   itself re-ran green in isolation too: `21 tests | 21 passed` (the
   "environment not configured to support act(...)" stderr lines are
   pre-existing jsdom noise from that file, not failures, not caused by this
   task).

---

## Things I could not verify, or found and corrected in my own execution

- **The duplicated-comment self-correction:** while reverting criterion 12's
  mutation, my first revert edit accidentally duplicated the
  "Module doc #2 -- read FRESH..." inline comment block above `const
  recordedBy = getRecordedBy();` in `makeOnEditAttendance`. Caught on a
  post-hoc `Read`, fixed with a follow-up `Edit` before running any gate,
  and reconfirmed via `grep -n "MUTATION\|do not leave this in"` (zero
  matches) that no other mutation-proof leftovers remained in the committed
  file. Disclosed here per item 19c even though it never reached a commit.
- **Real Postgres behavior under concurrent writes** is not verified by this
  task either (no live DB, same posture the gate itself disclosed) — the
  ordering claim rests on reading `20260717000001_support_audit.sql`
  directly, cited, not independently re-verified against a running
  database.
- Everything else in the packet (the owner-authorization citation by date
  rather than `auto-mode-decisions.md`, the reuse premises, the RLS/no-
  migration claim) was taken as the packet instructs — cited, not
  re-derived — and nothing in it was found to conflict with what is actually
  in the tree.

---

## Owner authorization

Per the packet: the build/mount split is cited from the coordinator's
2026-07-31 message reporting the owner's ruling, **not** from
`docs/swarm/auto-mode-decisions.md` (not yet recorded there as of this
packet revision, per the packet's own text). No other owner-approval claim
is made in this output.

---

## Disposition

This task is **not** marked complete by me. A checker verifies it, per
standing instructions.
