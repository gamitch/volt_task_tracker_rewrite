# T178 — Worker Packet (revision 2 — BUILD HALF ONLY, mount split to T196)

**Branch:** `claude/t178-end-meeting-dialog`, cut from `main` at `a3b9f00`. **Merge
`origin/claude/t178-end-meeting-dialog` into your worktree first** — worktrees are cut
from `main`, not the branch tip (item 24's lesson: T157's worker built ~320 lines
against a superseded packet for want of this check).

**Concurrent session, stay out of it:** `claude/t183-student-home-loader` is active in
`src/pages/home/`. Do not touch `StudentHome.tsx`, `StudentHome.test.tsx`,
`DashboardPage.*`. You have no ledger access — the foreman owns `task-ledger.md`.

**Revision history:** revision 1's `checker-premise` round 1 (general-purpose agent,
Write+Edit, measured at `accc692`) returned **REVISE — 3 BLOCKER, 3 MAJOR, 4 MINOR**.
Full findings, executed not argued: `docs/swarm/active/T178-gate-round1-findings.md`
— **read it, this packet works from it, not from a summary.** The gate built a
reference `endMeeting.ts` + test + `LiveConsole` mount exactly as revision 1
prescribed, got 17 tests green, then ran a mutation battery: 11 of 17 criteria
discriminated as claimed, 6 did not.

**The owner was shown BLOCKER 3 (a real data-loss path the gate's own reference mount
measured, not argued) and ruled: proceed with the loader build, park the mount.** This
revision covers **§5's `endMeeting.ts` + its test file only.** The mount is filed as
its own blocked row, **T196** (`task-ledger.md`), carrying the data-loss reasoning so
it is not casually unblocked. Do not touch `LiveConsole.tsx`/`LiveConsole.test.tsx` in
this task — they are not in your Allowed Files.

**This is revision 2. It dispatches to `worker-implementer` directly — no further
`checker-premise` round runs first**, per the coordinator's ruling. Get this right;
there is no round 3 behind you.

**Baselines — the gate's figures are measured, cite them, not the foreman's own
unmeasured ones from revision 1:** at `accc692`, `tsc` clean, eslint 0 errors. Repo-wide
(per the coordinator, since T169/T177 landed on `main` after revision 1 was drafted):
**69 files / 1654 tests, eslint 0 errors / 358 warnings.** Re-measure yourself at your
actual dispatch SHA after merging the branch in — `tsc`, `eslint`, `vitest`
(`.env.local` absent), `prettier --check`, `vite build` (the gate did not run the last
two — mark them un-measured until you do).

---

## 1. Objective — build half only

`EndMeetingDialog.tsx`'s three seams (`loadSummary`/`onEndMeeting`/`onEditAttendance`)
are `console.warn`/fixture stubs; no backend exists anywhere under
`src/lib/supabase/`. **This task builds that backend — `loaders/endMeeting.ts` and its
test file — and nothing else.** Mounting is out of scope, blocked, tracked as T196.
Do not add a `LiveConsole.tsx` mount "since you're already in there" — that is
precisely the defect T196 exists to prevent (see its ledger row for the measured
data-loss mechanism, or the gate findings' BLOCKER 3).

---

## 2. The design — unchanged from revision 1, confirmed correct by the gate's own execution

Three sequenced mutations, no RPC, no migration, no new RLS — this premise held under
the gate's own execution, not just its reading:

1. Backfill absences — upsert-shaped write on `attendance` for
   `payload.backfillAbsentStudentIds`, `onConflict: 'session_id,student_id'`,
   `ignoreDuplicates: true`.
2. Checkout — update on `attendance` for `payload.checkoutStudentIds`, setting
   `check_out_at`, guarded `.is('check_out_at', null)`.
3. Status flip — update `event_sessions.status = 'completed'`, always last.

**Ordering — confirmed correct, and for the true reason, by the gate reading
`supabase/migrations/20260717000001_support_audit.sql` directly:**
`trg_audit_attendance_post_completion` is `after update on public.attendance`, with a
live lookup of the session's status at UPDATE time. Checkout is an UPDATE and must
precede the flip or it self-mislogs as a post-completion correction. Backfill is an
INSERT — `on conflict do nothing`, no UPDATE fires, order-independent relative to the
other two. The gate also confirmed this is the **only** trigger on `attendance` and
there is none on `event_sessions` (`grep "create trigger"`). **backfill → checkout →
flip is right — do not re-derive this, cite it.**

**State the safety property explicitly in your own module doc — revision 1 undersold
it, and the gate named this directly.** Because the flip is always last, *every*
reachable partial-failure state fails in the safe direction: if the checkout UPDATE
(step 2) fails, the backfill has already landed but the session is still
`'scheduled'` — no audit pollution, and a retry is a clean no-op (idempotent via
`ignoreDuplicates`/the `.is('check_out_at', null)` guard, both unchanged from
revision 1, both gate-confirmed correct). **There is no ordering under this design in
which the flip lands and the checkout doesn't.** This — not "no way to prove a real
transaction" — is the actual, positive justification for three sequenced
`runMutation` calls instead of an RPC: the design doesn't need transactional
atomicity, because its own ordering already makes every partial-failure state safe.
Say this plainly, not as a fallback explanation.

**Be honest about what the coach actually sees on partial failure — the gate measured
this too, and revision 1's §7 implied more than is true.** `runMutation` normalizes
every rejection through `toLoaderError` (`../loader.ts`) into a plain object
(`{code, message, cause}`, not an `Error` instance). `EndMeetingDialog.tsx`'s own
`handleConfirmEndMeeting` catch block does `error instanceof Error ? error.message :
'Something went wrong ending this meeting.'` — since your rejection is never an
`Error` instance, the coach always sees the frozen generic fallback, concatenated with
the `AlertDialog`'s own fixed title: literally *"Couldn't end this meeting… Something
went wrong ending this meeting."* **Never the real Postgres error, and nothing about
which partial state was reached.** `EndMeetingDialog.tsx` is frozen (§5) so this
cannot be improved inside this packet. State this honestly in your module doc — the
database-level story is safe, the human-facing story is silent, and both facts belong
in writing, not just the first one.

---

## 3. What was established — carried from revision 1, corrected where the gate found gaps

### 3a. Identity

`onEndMeeting`/`EndMeetingPayload` needs none (backfilled rows are `recorded_by: null`
by the finished component's own design — `applyEndMeetingResult` in
`EndMeetingDialog.tsx`). `onEditAttendance` needs the real acting coach's id in
`recorded_by`, per `loaders/attendance.ts`'s own established convention for this
table. Since `OnEditAttendanceFn`'s signature carries no identity parameter, identity
must be captured by the mutation **factory's own closure** — build
`makeOnEditAttendance(getRecordedBy, getClient?)` where `getRecordedBy: () => string |
null` is called **fresh on every invocation of the returned function**, not read once
at factory-construction time.

**This packet has no mount in scope, so nothing you build calls this factory against a
real `useAuth()` ref** — that wiring is T196's job. Your job is to build and test the
factory itself so it is correct and ready when T196 unblocks. If `getRecordedBy()`
resolves `null` at call time, reject before any network call (precedent:
`loaders/meetings.ts`'s `makeCreateMeetings` rejects the same way for its own
pre-condition failure).

### 3b. Reuse — confirmed genuine by the gate's own wiring, not just reading

`makeLoadAttendanceForSessions(getClient)` (the DI-factory constructor — **the
top-level `loadAttendanceForSessions` singleton has no client seam to inject a stub
through; use the factory**) returned exactly `{status, checkInAt, checkOutAt, method,
recordedBy}` through `mapAttendanceDbRowToAttendanceRow` when the gate actually wired
it. The `loaders/kiosk.ts` roster-resolution pattern (session → event → `team_ids` →
active-student filter) ported directly. Both premises hold — build on them as
revision 1 specified.

### 3c. Metric views — zero touch, unchanged, confirmed correct.

### 3d. Audit trigger and RLS

Confirmed correct by the gate independently reading the same migration files.
`staff_all` on both `event_sessions` and `attendance` already grants a coach full
write access — **no migration is required; this premise held.** Never write to
`audit_log` from this file — grep-provable, the gate confirmed zero occurrences in the
reference implementation.

---

## 4. Owner authorization

**The split (build now, mount parked) is owner-ruled**, per the coordinator's
2026-07-31 message reporting the ruling — **not yet recorded in
`docs/swarm/auto-mode-decisions.md` as of this packet revision.** Cite the actual
ledger entry once it exists; until then, cite the coordinator's message by date, not
`auto-mode-decisions.md`, and say the same if asked. Everything else — the
three-mutation design, `ignoreDuplicates`, the identity-closure shape, every
acceptance criterion — remains the foreman's judgment, not owner-ruled.

---

## 5. Allowed / Forbidden files

**Allowed:**
- `src/lib/supabase/loaders/endMeeting.ts` — **new file.** `LoadEndMeetingSummaryFn`,
  `OnEndMeetingFn`, and `makeOnEditAttendance(getRecordedBy, getClient?)` for
  `OnEditAttendanceFn`. Import the page-facing types from `EndMeetingDialog.tsx`
  (`EndMeetingSummaryData`, `EndMeetingPayload`, `AttendanceRecordState`,
  `AttendanceStatus`, `LoadEndMeetingSummaryFn`, `OnEndMeetingFn`,
  `OnEditAttendanceFn`) — do not redefine them. Redeclare your own `*DbRow` shapes
  locally, this directory's own convention.
- `src/lib/supabase/loaders/endMeeting.test.ts` — **new file.** `attendance.ts` (which
  you reuse) has no test file of its own — yours is the only proof this reuse path
  behaves correctly.
- `src/pages/meetings/EndMeetingDialog.tsx` — **module doc only, above the `import`
  statement.** No function, type, or JSX may change. Correct the false
  RPC/single-transaction steer — **grep for `transaction`, not just `"RPC"`.**
  `"RPC"` finds one hit; `-i transaction` finds seven. The ones inside the module-doc
  comment block (above the import line — this includes the section describing
  `onEndMeeting`'s expected real implementation, and the ordering discussion
  referencing "the same transaction") are all correctable under this packet's Allowed
  Files; fix every one of them, not just the first. **Two of the seven sit inside
  `defaultOnEndMeeting`'s function body** (a `console.warn` string literal) — that is
  function content, forbidden by this same restriction. **Do not widen this packet's
  scope to touch it.** Instead: leave it, and state explicitly in your worker output
  that these two occurrences are a known, disclosed, uncorrected residual, out of
  reach under this packet's Allowed Files (a dev-console-only string, never rendered
  to a user — low stakes, but say so, don't let it pass silently).

**Forbidden — everything else, explicitly including:**
`docs/swarm/**`, `.claude/**`, `node_modules/`, `supabase/migrations/**` (no migration
is needed — if you conclude one is, stop and report), **`src/pages/meetings/LiveConsole.tsx`
and `LiveConsole.test.tsx` — out of scope for this revision, filed as T196, blocked**,
`src/pages/home/**`, `DashboardPage.*` (concurrent T183 session),
`EndMeetingDialog.test.tsx` (must stay green, untouched — your regression net for the
frozen component logic), `src/lib/supabase/loaders/attendance.ts` (import
`loadAttendanceForSessions`, don't fork it), `meetings.ts`, `kiosk.ts`, `checkin.ts`,
`seasons.ts` (read-only precedent — none export the private helpers you need;
re-derive locally), `src/app/router.tsx`, `src/app/guards.tsx`, `task-ledger.md`,
`verification-log.md`, `dispute-log.md`.

---

## 6. Acceptance criteria — revised

Criteria 14-16 (the mount, from revision 1) are **deleted, not renumbered** — do not
fill the numbering gap with new mount work; they are preserved unmodified in this
file's git history for whoever picks up T196. 1-13 remain, four corrected below per
the gate's measured findings. Per the standing instruction on this project: no
absence-only assertion, prescribe the mutation, run it, report the actual failure
output — a criterion that cannot fail is worse than none.

**Unchanged from revision 1 (the gate confirmed these hold as written) — 1, 2, 4, 6, 7,
8, 10, 12, 13:**

1. `loadEndMeetingSummary` returns real, injected DB state, not the dialog's own
   fixture, paired with a positive control (calling the dialog's own
   `defaultLoadEndMeetingSummary` instead must make the assertion fail).
2. Roster team-scoping (client-side, genuinely discriminates): inject one in-scope and
   one out-of-scope active student; assert only the in-scope one appears; mutation —
   set `team_ids: null` and assert both now appear.
4. `attendanceByStudentId` reuse is real — assert on fields only obtainable through
   `attendance.ts`'s real mapper; grep your own file for a second, independent
   `attendance` query (there must be none).
6. Backfill write shape — exact upsert payload plus `{onConflict:
   'session_id,student_id', ignoreDuplicates: true}`; mutation — remove
   `ignoreDuplicates` and confirm a dedicated test fails.
7. Checkout write shape — `check_out_at: payload.endsAt`, scoped by `session_id` +
   `.in('student_id', ...)`, guarded `.is('check_out_at', null)`; mutation — drop the
   guard, confirm a dedicated test fails.
8. Status-flip write shape — `{status: 'completed'}` scoped `.eq('id', sessionId)`;
   mutation — change the written status, confirm a dedicated test fails.
10. Retry after partial failure is safe — call `onEndMeeting` twice with the identical
    payload against a client that succeeds both times; assert the second call
    re-issues the same three writes without throwing.
12. Null identity rejects before any network call — `getRecordedBy` returns `null`;
    assert the promise rejects and the spy's `.from(...)` was never called; mutation —
    delete the guard, confirm the test starts observing a real call.
13. No `audit_log` write anywhere in this file — grep-provable, static, not a runtime
    test.

**3 — CORRECTED (MAJOR 1).** `is_active` is filtered server-side — a stubbed client
does not enforce it, so revision 1's base assertion ("only the active student
appears," against an injected client returning both) fails against a *correct*
implementation, and its mutation (flipping `is_active` on the fixture) passes both
before and after — unsatisfiable as written. **Revised: assert the query builder's
recorded call included `.eq('is_active', true)` as an argument** (inspect the spy's
captured call args for the `students` query, not the returned data). State plainly in
your test file: server-side filters are argument-provable only in this harness, not
outcome-provable — a stub client cannot demonstrate server-side filtering by its
return value. Do not apply this same fix to criterion 2 — team-scoping genuinely runs
client-side and criterion 2's original outcome-based assertion already discriminates
correctly; these are two different mechanisms.

**5 — CORRECTED (BLOCKER 2).** The original ordering criterion (assert `.from(...)`
call order on a plain recording spy) passes identically whether the three writes are
truly sequenced or dispatched concurrently via `Promise.all` — `runMutation` builds
its Postgrest chain synchronously before its first `await`, so a spy recording only
call order can't see the difference. **Revised: gate each of the three stubbed calls
(backfill upsert, checkout update, status-flip update) on its own independently
resolvable ("deferred") promise** — a promise whose `resolve` you hold outside the
call itself, not one that resolves automatically. Drive `onEndMeeting(payload)` and,
before resolving anything, assert only the backfill call has been issued (checkout's
and the flip's underlying `client.from(...)` calls have **not** happened yet — assert
on call counts, not eventual order). Resolve the backfill's deferred, flush
microtasks, assert the checkout call is now issued but the flip's is not. Resolve
checkout's deferred, flush, assert the flip is now issued. **Prove the fix itself, not
just the feature:** run the original `Promise.all`-concurrent mutation against this
new version of the test and confirm it now fails (it passed, 17/17, against the
original criterion 5; it must not pass against this one).

**9 — CORRECTED (MAJOR 3).** Revision 1 claimed the rejection "surfaces the injected
error" — false, measured: `runMutation` routes every rejection through
`toLoaderError` (`../loader.ts`), whose top-level `.message` is always the fixed
DES-16 copy; the injected detail survives only in `.cause`. A literal
`rejects.toThrow('<injected message>')` fails, since `.toThrow` matches
`.message`. **Revised: assert the rejection satisfies `isSupabaseLoaderError`
(exported from `../loader`) and that its `.cause` contains/matches the injected
rejection detail — never assert the top-level `.message` equals your injected
string.** Keep the rest as specified: (a) the backfill call was issued, (b) the
checkout call was issued, before the (now correctly asserted) rejection.

**11 — CORRECTED (BLOCKER 1), this project's now-eighth instance of the
vacuous-identity-assertion shape, this time inside a criterion written specifically to
prevent it.** Revision 1 built **two separate factory instances**, each with a fixed
stub, and asserted each instance's single call carried that instance's id — passes
even if the factory bakes `getRecordedBy()`'s result once at construction time instead
of reading it fresh per call, because each instance only ever gets one call, so "baked
at construction" and "read fresh per call" are indistinguishable under that shape.
§3a's whole point is that identity must be read fresh on **every call within one
instance**, matching a `useRef`-backed accessor that changes across renders — revision
1's own criterion never tested that. **Revised: build ONE `makeOnEditAttendance`
instance with ONE `getRecordedBy` that returns a different value on successive
invocations** (e.g. a closure over an index into `['coach-real-id-1',
'coach-real-id-2']`, incrementing each call). Call the **same** returned
`onEditAttendance` function twice. Assert the first call's captured `recorded_by` is
`'coach-real-id-1'` and the second call's is `'coach-real-id-2'`. **Prove the fix
itself:** run a construction-time-baked variant (`const bakedOnce = getRecordedBy();
return async (...) => { const recordedBy = bakedOnce; ... }`) against this revised
test and confirm it now fails (it passed against the original criterion 11's shape; it
must not pass against this one).

---

## 7. Design record you must carry into your own module doc (`endMeeting.ts`)

State honestly, mirroring `seasons.ts`'s own Trap #1 disclosure for
`makeSetActiveSeason` — do not write a rosier version of any of this, and do not
repeat revision 1's two understatements (both gate-caught):

- Three sequential `runMutation` calls, not a transaction. If the second or third call
  rejects after an earlier one succeeded, the database is left in the corresponding
  partial state (backfill landed, checkout/flip did not; or backfill+checkout landed,
  flip did not) until the coach retries.
- **State the safety property as the actual justification, not as a disclaimer:**
  because the flip is always last, every reachable partial-failure state fails in the
  safe direction — a checkout failure leaves absences written and the session still
  `'scheduled'`, no audit pollution, retry is a clean no-op. There is no ordering under
  this design in which the flip lands and the checkout doesn't. This is *why* three
  sequenced calls are sufficient and an RPC is not needed — say it as a positive
  property of the design, not as "we can't prove otherwise."
- Retry is safe by construction: backfill uses `.upsert(rows,
  {onConflict:'session_id,student_id', ignoreDuplicates:true})` (precedent:
  `supabase/functions/checkin/attendance_upsert.ts`'s own
  `applyUpsertIgnoreDuplicates` — "first write wins, never clobber a real row," reused
  here so a benign race, e.g. a real QR check-in landing between `loadSummary` and
  confirm, is silently skipped rather than destructively overwritten or fatally
  rejected); checkout re-sets the same `endsAt` value idempotently, guarded by
  `.is('check_out_at', null)` so it never clobbers a real checkout stamp set some other
  way; the status flip re-sets the same terminal value.
- **Disclose the human side honestly, not just the database side.** `runMutation`
  rejects with a plain object, not an `Error` instance, so `EndMeetingDialog.tsx`'s
  frozen `error instanceof Error` check always falls through to its generic fallback
  copy — a coach who hits a partial failure sees only *"Couldn't end this
  meeting… Something went wrong ending this meeting"*, never the real error and
  nothing about which partial state was reached. This cannot be improved inside this
  packet (`EndMeetingDialog.tsx` is frozen); say so rather than letting the database
  safety property imply the coach is informed too.
- **Known residual, not this packet's to fix:** `LiveConsole.tsx`'s own roster/attendance
  panel remains fixture-backed — this is why the mount is blocked as T196, not a
  separate new disclosure.

---

## 8. Tier and gate — unchanged recommendation, now moot for the gate half

**Worker tier: sonnet (no override)** — unchanged reasoning from revision 1: no
migration, no RLS/security-definer change, no metric-SQL view, no auth/session logic
change. **Checker: `checker-reviewer` at opus** for the post-implementation check,
matching T170/T181's own treatment. **No further `checker-premise` round runs before
dispatch** — the coordinator's ruling, not the foreman's call; round 1 already did the
work a round 2 would have (built a reference implementation and mutation-tested it),
and item 19a's cap plus the owner's direct involvement in the BLOCKER-3 decision are
why this goes straight to a worker now.

---

## 9. Required worker output

- Commit SHA (item 21 — existence verified, not assumed).
- Every criterion in §6, with the actual mutation applied, actual failure output
  pasted (test name + before/after pass counts), not summarized — including the two
  "run the old/broken variant against the new test and confirm it now fails" steps in
  criteria 5 and 11, which prove the fix itself, not just the feature.
- The gates re-measured on your own worktree at your own dispatch SHA: `tsc`, `eslint`,
  `vitest` (`.env.local` absent), `prettier --check`, `vite build` (the last two were
  not run by the gate — you are the first to measure them for this task).
- Zero-diff confirmation on every Forbidden file in §5, **especially
  `LiveConsole.tsx`/`LiveConsole.test.tsx`** — this revision must not touch either,
  even incidentally.
- The `grep -i transaction EndMeetingDialog.tsx` before/after count, with the two
  remaining (function-body, disclosed-residual) hits named explicitly.
- Explicit disclosure of anything in this packet you could not verify, or found wrong
  — including in the gate's own findings, if you find something there wrong; the gate
  is a strong prior, not infallible.
