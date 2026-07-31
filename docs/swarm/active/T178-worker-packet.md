# T178 — Worker Packet

**Branch:** `claude/t178-end-meeting-dialog`, cut from `main` at `a3b9f00`. **Merge
`origin/claude/t178-end-meeting-dialog` into your worktree first** — worktrees are cut
from `main`, not the branch tip, and this packet lives only on the branch (item 24's
lesson: T157's worker built ~320 lines against a superseded packet for want of this
check).

**Concurrent session, stay out of it:** another session is active on
`claude/t183-student-home-loader`, working in `src/pages/home/`. Do not touch
`StudentHome.tsx`, `StudentHome.test.tsx`, `DashboardPage.*`. Do not edit
`task-ledger.md` beyond nothing — you have no ledger access at all (Forbidden Files,
below); the foreman owns that file.

**Author:** `foreman-planner`. **Gate recommendation:** full `checker-premise` round
before dispatch (see "Tier and gate" below) — do not skip it. **Worker tier
recommendation:** `worker-implementer` on its pinned default (**sonnet**). **Checker
recommendation:** `checker-reviewer` (**opus**).

Baselines below are orientation, read from `docs/swarm/RESUME-HERE.md`, **not measured
by this packet's author (no Bash tool available to the foreman)**. Re-measure yourself
at your actual dispatch SHA, after merging the branch in: `tsc`, `eslint`, `vitest`
(with `.env.local` **absent**, the mandated gate state), `prettier --check`, `vite
build`. Orientation only: `main`@`94267a0` was tsc 0 / eslint 0 errors, 358 warnings /
69 files, 1654 tests / build clean, one pre-existing unrelated prettier drift on
`src/theme/volt.ts` (not yours to fix).

---

## 1. Objective — corrected framing, not the ledger's

The ledger currently calls this a wiring gap: `EndMeetingDialog.tsx` is finished,
tested (`EndMeetingDialog.test.tsx`, 489 lines / 21 blocks), and mounted nowhere;
`LiveConsole.tsx`'s "End meeting" button shows a dismissible "has not shipped yet"
`Banner` in its place. **That framing is wrong.** Read directly (`EndMeetingDialog.tsx`,
current branch tip):

- `defaultLoadEndMeetingSummary` (module doc section 5) returns hardcoded fixture data
  unconditionally.
- `defaultOnEndMeeting` only `console.warn`s the payload "a real single transaction
  would have applied atomically."
- `defaultOnEditAttendance` only `console.warn`s the UPDATE it would have sent.

**No end-meeting loader or mutation exists anywhere under `src/lib/supabase/`** (grep
`src/lib/supabase` for `EndMeetingDialog`/`EndMeetingSummary`/`EndMeetingPayload` —
zero hits outside the component's own file and its test). Mounting the dialog as-is
would give a coach a complete-looking "End meeting" flow that silently does nothing —
strictly worse than today's honest banner, and the same class of defect as
`handleRsvpChange`'s silent RSVP data loss (T169/T193).

**This is two units: build the backend, then mount.** Scope it as a build. The owner
was told this explicitly before authorizing the task; see "Owner authorization" below —
do not shrink this back to a wiring-only task.

**Ledger correction:** the foreman is updating `task-ledger.md`'s T178 row directly
(type + description) in the same action as writing this packet, per the boss's
instruction. You do not need to and must not touch that file.

---

## 2. The design question — settled, do not re-open

`EndMeetingDialog.tsx`'s own module doc (section 1, the sentence beginning "A real
backend implementation ... is expected to implement `onEndMeeting` as a single
transaction (e.g. an RPC running the backfill INSERTs, the checkout UPDATEs, and the
`event_sessions` UPDATE together)") is a **false steer** and is itself part of this
task's Allowed Files specifically so you can correct it (see §7).

**This repo has an established, grep-provable convention: no `supabase.rpc(...)`
call anywhere in `src/lib/supabase/` or `supabase/functions/`.** Read-verified by the
foreman, each file's own module doc states it explicitly: `seasons.ts:37,293`,
`outreach.ts:139`, `meetings.ts:90`, `teams.ts:41,334`. A repo-wide grep for
`supabase.rpc` / `.rpc(` under `src/lib/supabase` returns zero matches.

**The named precedent is `makeSetActiveSeason`** (`seasons.ts`, function
`makeSetActiveSeason`, ~line 295), which `EndMeetingDialog.tsx`'s own module doc
already cites by name for the `SetActiveSeasonPayload` atomicity pattern. Read
directly: it performs **two separate single-column `runMutation` calls — `deactivate`
then `activate` — never a combined update, never an RPC**, sequenced (`if
(payload.deactivateSeasonId !== null) { await deactivate(...); } await
activate(...);`), with the partial-failure risk (deactivate lands, activate rejects →
zero active seasons until retry) **disclosed in its own module doc, Trap #1**, not
engineered around.

**Your design: three sequenced mutations, following that precedent exactly.**
1. Backfill absences — INSERT-shaped write on `attendance` for
   `payload.backfillAbsentStudentIds`.
2. Checkout — UPDATE on `attendance` for `payload.checkoutStudentIds`.
3. Status flip — UPDATE `event_sessions.status = 'completed'`.

No migration. No RPC. No new RLS policy (§5 below — `staff_all` already covers every
write here). If you conclude a migration or RPC is genuinely required, **stop and
report to the foreman rather than building it** — this packet's premise is that none
is needed, verified below; if that premise is wrong, that is exactly the kind of thing
`checker-premise`/you should catch and escalate, not route around.

**Ordering matters, and it is not symmetric.** `EndMeetingDialog.tsx`'s own module doc
section 2 (`trg_audit_attendance_post_completion`, cited there in full from
`supabase/migrations/20260717000001_support_audit.sql` lines 120-156, foreman
read-verified against that file directly, byte-identical) fires on **any** `attendance`
UPDATE whose session is *already* `'completed'` at the moment the UPDATE runs. Backfill
is an INSERT (never fires an `after update` trigger, order-independent relative to the
status flip). **Checkout is an UPDATE and must land BEFORE the status flip** — if the
status flip ran first, the checkout UPDATE would fire the trigger and mislog an
intentional meeting-close as `attendance_edited_post_completion`. Sequence:
**backfill, then checkout, then status flip** — status flip always last.

---

## 3. What was established before designing (the boss's four questions)

### 3a. Identity — does the write need a coach profile id, and is one available?

**`onEndMeeting`/`EndMeetingPayload` needs none.** `EndMeetingDialog.tsx`'s own
`applyEndMeetingResult` (the function that simulates this payload's effect on local
state) sets backfilled rows' `recordedBy: null` unconditionally — matching its own
module doc's reasoning: "the coach ending the meeting is the one implicitly marking
these students absent **by not having recorded anything for them**." Your real
backfill INSERT must write `recorded_by: null` for the identical reason — this keeps
the real DB row and the dialog's own local-state simulation in agreement, and avoids
inventing an attribution semantic the finished, tested component never specified.
Checkout (setting `check_out_at`) touches no attribution column either.

**`onEditAttendance` does need one**, and this is the real finding: it is a coach's
deliberate, individual correction (the post-completion `SegmentedControl` row), and
`loaders/attendance.ts`'s own established convention for this exact table
(`UpsertAttendanceParams.recordedBy`, module doc #2) is that `attendance.recorded_by`
is "always the ACTING coach's own `profiles.id`... always re-attributed to whoever is
editing right now." Your `onEditAttendance` implementation must set
`recorded_by` to the real signed-in coach's id on every edit.

**Is a real one available at the host?** Yes — read directly, `LiveConsole.tsx`'s own
`LiveConsoleBody` already calls `useAuth()` (from `../../app/guards`) and already uses
`user?.id ?? null` as `recordedBy` in its own pre-existing `handleSetStatus` (current
branch tip, inside that function). **This is not the `MarkDayCompleteDialog`/T170
defect shape** — that shape is a component defaulting an identity *prop* to a
placeholder constant with no real value ever threaded in at any call site.
`EndMeetingDialog.tsx`'s `OnEditAttendanceFn` signature carries **no identity
parameter at all** (`(sessionId, studentId, status) => Promise<void>`), so there is no
prop to default-to-placeholder in the first place — the identity must instead be
captured by the **mutation factory's own closure**, built at the mount site
(`LiveConsole.tsx`), over the real `useAuth().user`. Build it the same way
`useLiveConsoleDisplayToken` (same file, already-existing) keeps a `loadRef` current
across renders — a ref, not a prop default, so the closure always reads the latest
signed-in user without needing to reconstruct the mutation function every render.

If the factory is called while `getRecordedBy()` resolves `null` (defensive-only —
`LiveConsolePage`'s `RequireRole` already keeps a signed-out/wrong-role user from
reaching this component in production), **reject before issuing any network call**
with a clear, disclosed error (precedent: `loaders/meetings.ts`'s
`makeCreateMeetings` already rejects with a hand-authored message, "No active season
is set up yet...", for its own pre-condition failure — same shape, same file's own
established idiom). Do not silently write `recorded_by: null` for an edit — that
would misattribute a real coach's correction to nobody, unlike the backfill case where
`null` is the deliberately correct, disclosed value.

### 3b. What `EndMeetingSummaryData` needs, and what already exists to build it

Reuse is real and load-bearing here, not aspirational — verified against the actual
files, not assumed:

- **`attendanceByStudentId`**: `loaders/attendance.ts` already exports
  `makeLoadAttendanceForSessions`/`loadAttendanceForSessions` (`LoadAttendanceForSessionsFn
  = (sessionIds) => Promise<AttendanceRow[]>`), returning exactly the columns
  `EndMeetingDialog`'s own `AttendanceRecordState` needs (`status`, `checkInAt`,
  `checkOutAt`, `method`, `recordedBy`) as a strict superset (also carries `id`,
  `hoursOverride`, `updatedAt`, `createdAt`, which you simply drop when mapping). Call
  it with `[sessionId]` and key the result by `studentId`. **Do not write a second
  `attendance` query — import and call this one.**
- **Roster** (`{studentId, name}[]`, scoped to the session's event's teams): no
  existing exported function returns exactly this, but the *pattern* is fully
  established in `loaders/kiosk.ts` (`makeLoadKioskTally`, read the whole file — none
  of its query helpers are exported, so you re-derive per-page like every other loader
  file in this directory does, you do not import them): resolve
  `event_sessions.event_id` for the session, then `events.team_ids` for that event,
  then filter **active** (`students.is_active = true`) students to those whose
  `team_id` is in `team_ids` (or all active students if `team_ids` is `null` — "open to
  every team", `kiosk.ts`'s own documented semantics, same as
  `supabase/functions/checkin/index.ts`'s `TEAM_SCOPE_MISMATCH` check). Add
  `display_name` to the student select (`kiosk.ts`'s own `queryActiveStudentTeams`
  selects only `id, team_id`; you need `id, team_id, display_name`).
- **`session`** (`id`, `title`, `endsAt`, `status`): `event_sessions` has `id`,
  `ends_at`, `status` directly (no new column needed); `title` is composed from the
  parent event's `events.title`, the same "not a real column on `event_sessions`,
  composed by the caller" posture `EndMeetingDialog.tsx`'s own module doc section 6
  already states.

This means: **no new SQL, no new view, one new loader file** combining an
already-established roster-resolution pattern (`kiosk.ts`) with an already-exported
attendance loader (`attendance.ts`). This is the same shape of reuse that made T181 and
T176 smaller than filed once found — found here too, before dispatch, not left for you
to discover the hard way.

### 3c. Metric views — constitution item 3

**Zero touch.** Nothing in this design reads or recomputes `v_student_hours`,
`v_student_participation`, or `v_student_goal_projection`. This is pure
`attendance`/`event_sessions`/`events`/`students` reads and writes — team-scoping
(`team_ids.includes(team_id)`) and status filtering (`is_active`, `'present'|'late'`)
are plain boolean filters, not formulas. State this plainly in your own module doc
rather than leaving it unsaid — item 3 violations have cost this project a full round
twice (T176) on exactly this kind of unstated claim.

### 3d. The audit trigger — confirmed, and what it means for you

Foreman read `supabase/migrations/20260717000001_support_audit.sql` lines 100-157
directly, byte-for-byte against `EndMeetingDialog.tsx`'s own citation — **matches
exactly**. `trg_audit_attendance_post_completion` (`after update on attendance, for
each row`) looks up `event_sessions.status` live via `NEW.session_id` and, only when
that live status is already `'completed'`, inserts one `audit_log` row. It is
`security definer`, so an ordinary RLS-scoped coach session can trigger it without
needing direct `audit_log` write access. **Confirm, and do not violate:** your
`onEditAttendance` implementation must be a plain `attendance` UPDATE and must never
insert into `audit_log` itself — the trigger does that. Grep your own new file for
`audit_log` before calling this done; it must appear only in a comment, never a real
write, exactly the discipline `EndMeetingDialog.tsx` itself already follows.

One live-DB fact worth carrying forward, not a blocker: the trigger's `actor` column
resolves `coalesce(auth.uid(), ... 'app.actor_id' ...)` and `audit_log.actor` is
`NOT NULL` — an UPDATE from a session with no resolvable `auth.uid()` would abort. This
repo's frontend always uses the real, RLS-authenticated Supabase client (constitution
item 5 — no service-role key ever reaches `src/`), so a signed-in coach's own
`onEditAttendance` call always has a resolvable `auth.uid()`. Not a design change,
just confirm you are not routing this through anything else.

**RLS — confirmed, no migration needed.** `supabase/migrations/20260717000002_rls.sql`:
`staff_all` policy exists on both `event_sessions` (line 172) and `attendance` (line
226), granting admin/coach full read/write already. Foreman read both policy blocks
directly. No new policy, no migration.

---

## 4. Owner authorization

**Owner-approved, cited:** the decision to scope T178 as a real build (not a
wiring-only task) after being told explicitly that no backend exists. This packet's
author was told so directly by the dispatching session; there is no
`auto-mode-decisions.md` entry to cite for it (it predates this packet, delivered
in-conversation) — **do not claim it is recorded there.** Everything else in this
packet — the three-mutation design, the `ignoreDuplicates` choice, the identity-closure
shape, every acceptance criterion — is the **foreman's decision**, not owner-ruled.
Say so if asked; do not promote any of it to owner authority (three prior incidents on
this project did exactly that).

---

## 5. Allowed / Forbidden files

**Allowed:**
- `src/lib/supabase/loaders/endMeeting.ts` — **new file.** The loader implementing
  `LoadEndMeetingSummaryFn`, `OnEndMeetingFn`, and a factory
  `makeOnEditAttendance(getRecordedBy, getClient?)` for `OnEditAttendanceFn` (types
  imported from `EndMeetingDialog.tsx` — import-only from that file, do not redefine
  them locally; this differs from `checkin.ts`'s convention of re-declaring *DB row*
  shapes, which you should still do for your own `*DbRow` interfaces, but the
  page-facing types (`EndMeetingSummaryData`, `EndMeetingPayload`,
  `AttendanceRecordState`, `AttendanceStatus`, `LoadEndMeetingSummaryFn`,
  `OnEndMeetingFn`, `OnEditAttendanceFn`) are exported from `EndMeetingDialog.tsx`
  already — import them).
- `src/lib/supabase/loaders/endMeeting.test.ts` — **new file.** Every loader file that
  writes to the database in this repo ships its own test file
  (`calendarFeed.test.ts`, `parentHome.test.ts`, `outreach.test.ts`,
  `students.test.ts`) — `attendance.ts`, which you are reusing, has **no** test file of
  its own (T167's still-open debt), so your suite is the only proof this reuse path
  behaves correctly end-to-end. Do not skip it.
- `src/pages/meetings/LiveConsole.tsx` — mount `EndMeetingDialog` in place of the
  "End meeting" `Button`/`StubBanner`/`handleEndMeetingClick`/`endMeetingStub` state
  (all four can be deleted — `EndMeetingDialog` renders its own "End meeting" `Button`
  internally). Add three new optional `LiveConsoleBodyProps` fields
  (`loadEndMeetingSummary`, `onEndMeeting`, `onEditAttendance`, typed against
  `EndMeetingDialog.tsx`'s own exported function types), defaulting to real values:
  `loadEndMeetingSummary`/`onEndMeeting` as plain imported singletons from
  `loaders/endMeeting.ts` (same convention `MeetingsList.tsx` already uses for
  `loadCoachMeetingsData`); `onEditAttendance` built inside `LiveConsoleBody` via
  `makeOnEditAttendance` closed over a ref to the real `useAuth().user` (§3a).
- `src/pages/meetings/LiveConsole.test.tsx` — update the existing "shows an
  'End-meeting summary not built yet' disclosure Banner" test (delete it — the
  behavior it proved no longer exists) and add the new mount-level tests in §6. This
  is a foreman-authorized test reversal per Definition-of-Ready item 5 (constitution)
  — the underlying feature that test proved (a stub banner) is being deliberately
  replaced, not silently dropped.
- `src/pages/meetings/EndMeetingDialog.tsx` — **module doc only, above the `import`
  statement (i.e., only the comment block, lines 1-280ish).** No function, type, or
  JSX in this file may change — its own logic is already finished and passed review;
  do not re-open it. Specifically correct module doc section 1's sentence describing
  `onEndMeeting`'s expected real implementation as "a single transaction (e.g. an RPC
  running the backfill INSERTs, the checkout UPDATEs, and the `event_sessions` UPDATE
  together)" — replace with an accurate description: three sequenced `runMutation`
  calls in `loaders/endMeeting.ts`'s `makeOnEndMeeting`, following the
  `makeSetActiveSeason` precedent, **not** a transaction/RPC, with the disclosed
  partial-failure/idempotent-retry behavior from §7 below stated honestly (a real risk,
  not engineered away). Cite `loaders/endMeeting.ts` by file and function name, not by
  line number (item 19c — line numbers drift).

**Forbidden — everything else, explicitly including:**
`docs/swarm/**`, `.claude/**`, `node_modules/`, `supabase/migrations/**` (no migration
is needed — if you conclude one is, stop and report, §2), `src/pages/home/**`,
`DashboardPage.*` (the concurrent T183 session), `EndMeetingDialog.test.tsx` (must stay
green, untouched — it is your regression net for the frozen component logic),
`src/lib/supabase/loaders/attendance.ts` (import `loadAttendanceForSessions`, do not
fork or edit it), `src/lib/supabase/loaders/meetings.ts`, `kiosk.ts`, `checkin.ts`,
`seasons.ts` (read-only precedent — none export the private query helpers you need, so
you re-derive locally per this directory's own convention, you do not import their
internals), `src/app/router.tsx`, `src/app/guards.tsx` (import-only —
`useAuth`/`RequireRole` are already imported in `LiveConsole.tsx`, do not modify
either file), `task-ledger.md`, `verification-log.md`, `dispute-log.md`.

---

## 6. Acceptance criteria — each with a prescribed mutation

Per the boss's standing instruction on this project: no absence-only assertion (pair
every negative with a positive that can genuinely fail), prescribe the mutation, run
it, report the actual failure output. A criterion that cannot fail is worse than none.

**Loader (`endMeeting.ts`/`endMeeting.test.ts`):**

1. **`loadEndMeetingSummary` returns real, injected DB state, not
   `EndMeetingDialog.tsx`'s own fixture.** Stub a recording Supabase client (pattern:
   `parentHome.test.ts`'s `makeRecordingClient`/`makeRecordingChain`) returning a
   distinct session/roster/attendance fixture (fabricated names per constitution item
   6, distinct from `EndMeetingDialog.tsx`'s own `FIXTURE_ROSTER` names "Ada Q."/"Bea
   R."/etc. — reusing those exact strings would make a fixture-collision the same class
   T176 lost a criterion to). Assert the resolved data matches your injected fixture.
   **Positive control, mutation-prescribed:** temporarily call
   `defaultLoadEndMeetingSummary` (the dialog's own fixture stub) instead of your real
   loader inside the same test and confirm the assertion *fails* (proves the assertion
   can discriminate real-vs-fixture, not just "some data came back").
2. **Roster team-scoping is load-bearing.** Fixture: two active students, one on a
   team inside `event.team_ids`, one outside it. Assert only the in-scope student
   appears. **Mutation:** set `team_ids: null` on the injected event row (the
   documented "open to every team" case) and assert the roster now includes *both*
   students — proving the filter genuinely gates on the value, not vacuously true or
   false regardless of input.
3. **`is_active` scoping.** Fixture: one active, one inactive student, both on an
   in-scope team. Assert only the active student appears. **Mutation:** flip the
   inactive student's fixture row to `is_active: true` and assert they now appear —
   proving the filter discriminates.
4. **`attendanceByStudentId` reuse is real.** Assert your loader's resolved
   `attendanceByStudentId` for a known student matches a value only obtainable through
   `loaders/attendance.ts`'s real column mapping (e.g. assert on `method`/`recordedBy`
   fields that only exist because you called the real `AttendanceRow` mapper, not a
   hand-rolled shape). Grep your own file for a second, independent `attendance` query
   — there must be none; you call `attendance.ts`'s export.
5. **`onEndMeeting` write ordering.** Recording-client spy asserting call order:
   `attendance` upsert (backfill) → `attendance` update (checkout) →
   `event_sessions` update (status flip), in that order, for a payload with non-empty
   `backfillAbsentStudentIds` and `checkoutStudentIds`. **Mutation:** swap the checkout
   and status-flip calls in your implementation and confirm this ordering test fails.
   State plainly in your test file (and worker output) that this repo's test harness
   is a stubbed-client unit test with no real Postgres — it can prove call *order*, not
   that the trigger genuinely doesn't fire; the trigger's actual behavior is the
   foreman's read-verified citation in §3d, not something this suite executes.
6. **Backfill write shape.** Assert the upsert payload for each backfilled student is
   exactly `{session_id, student_id, status: 'absent', method: 'coach', recorded_by:
   null}` and that the call passes `{onConflict: 'session_id,student_id',
   ignoreDuplicates: true}`. **Mutation:** remove `ignoreDuplicates: true` and confirm
   a dedicated test asserting its presence fails — this flag is the mechanism that
   makes a retried `onEndMeeting` call safe (§7); losing it silently is a real
   regression, not a style nit.
7. **Checkout write shape.** Assert the update sets `check_out_at: <payload.endsAt>`,
   scoped to `session_id` + `.in('student_id', checkoutStudentIds)`, guarded with
   `.is('check_out_at', null)`. **Mutation:** drop the `.is('check_out_at', null)`
   guard and confirm a test asserting its presence (via the recorded call args) fails.
8. **Status-flip write shape.** Assert `event_sessions` update sets
   `{status: 'completed'}` scoped to `.eq('id', sessionId)` — same shape as
   `meetings.ts`'s own `makeCancelMeetingSession`, different target value. Mutation:
   change the written status to something other than `'completed'` and confirm a
   dedicated test fails.
9. **Partial-failure disclosure, proven not just documented.** Stub a client where the
   `event_sessions` update rejects. Assert: (a) the `attendance` upsert (backfill) call
   was issued, (b) the `attendance` update (checkout) call was issued, (c) the overall
   `onEndMeeting(...)` promise rejects, surfacing the injected error. This is the
   "coach sees an error banner, meeting isn't ended, but the backfill/checkout already
   landed" state the module doc must disclose (§7) — prove the state is reachable, not
   just describe it.
10. **Retry after partial failure is safe.** Call `onEndMeeting` twice with the
    identical payload against a client stub that succeeds both times. Assert the
    second call does not throw and re-issues the same three calls with the same shapes
    as criterion 6-8 — i.e., nothing in your implementation assumes "this student has
    no row yet" beyond what `ignoreDuplicates`/the `.is('check_out_at', null)` guard
    already defend.
11. **`onEditAttendance` threads the real, distinct id.** Build `makeOnEditAttendance`
    with a `getRecordedBy` stub returning `'coach-real-id-1'`; call it; assert the
    update payload's `recorded_by` is exactly that string. **Then, in the same test
    file, build a second instance with `getRecordedBy` returning a genuinely different
    string, `'coach-real-id-2'`,** call it, and assert the captured payload carries
    the *second* id — proving the closure reads live identity per-call rather than a
    value baked in once (the exact discrimination T170's own MAJOR was about: a stub
    that returns the same string every time cannot prove threading is real).
12. **Null identity rejects before any network call.** `getRecordedBy` returns `null`;
    call `onEditAttendance(...)`; assert the returned promise rejects and the spy
    client's `.from(...)` was **never called**. **Mutation:** delete the null-guard and
    confirm this test starts observing a real `.from('attendance').update(...)` call
    with `recorded_by: null` — i.e., the test is currently discriminating, not vacuous.
13. **No `audit_log` write anywhere in this file.** Grep-provable — zero literal
    `audit_log` outside a comment. State this as a one-line assertion in your worker
    output, not a runtime test (there is nothing to execute; it's a static property).

**Mount (`LiveConsole.tsx`/`LiveConsole.test.tsx`):**

14. **The stub is gone, proven with a positive that could not come from the stub.**
    Render `LiveConsoleBody` with `COACH_USER` (existing fixture,
    `LiveConsole.test.tsx`), inject a distinct `loadEndMeetingSummary` stub returning
    known roster/attendance fixture data, click "End meeting". Assert
    `container.textContent` contains a string only `buildEndMeetingConfirmDescription`
    (the dialog's own already-tested pure function) can produce for your injected
    fixture — e.g. the literal "Current attendance: N present..." tally computed from
    your specific counts — **and** does not contain "has not shipped yet" /
    "End-meeting summary not built yet". **Mutation, required:** revert the mount (put
    the old `StubBanner`/`handleEndMeetingClick` back) and confirm this new test fails
    — this is the exact "banner is gone" vacuous-absence trap named in the brief;
    passing only on the positive-content assertion, independent of the negative one,
    is what makes this non-vacuous.
15. **The real `onEndMeeting` payload is correct end-to-end from a UI click.** Inject
    a spy `onEndMeeting`; drive the full click path (Button → confirm `AlertDialog` →
    `onAction`); assert the spy was called once with a payload whose
    `backfillAbsentStudentIds`/`checkoutStudentIds` match what your injected fixture's
    roster/attendance state actually implies (computed via the dialog's own exported
    `buildEndMeetingPayload`, not hand-counted, so the assertion can't silently drift
    from the real pure function's contract).
16. **`onEditAttendance` threads the real signed-in coach's id from the mount site,
    not a stub.** Render with `COACH_USER` (id `'user-coach'`, existing fixture);
    reach the post-completion correction List (inject a fixture whose session is
    already `'completed'`); change one student's status via the `SegmentedControl`;
    assert the (spied) real `onEditAttendance` implementation's underlying mutation
    call received `recorded_by: 'user-coach'`. **Mutation:** re-render with a second,
    distinct `AuthUser` fixture (a new id, not `'user-coach'` or any id already used
    elsewhere in this file) and confirm the captured `recorded_by` changes to match —
    same distinct-value discipline as loader criterion 11, now proven through the real
    mount wiring, not just the factory in isolation.
17. **Doc correction is accurate, not just present.** Grep `EndMeetingDialog.tsx` for
    the string `"RPC"` — the only acceptable remaining hits (if any) describe why one
    is *not* used, never that one is expected. State in your worker output the exact
    before/after of the corrected sentence.

---

## 7. Design record you must carry into your own module doc (`endMeeting.ts`)

State honestly, mirroring `seasons.ts`'s own Trap #1 disclosure for
`makeSetActiveSeason` (do not write a rosier version of this):

- Three sequential `runMutation` calls, not a transaction. If the second or third call
  rejects after an earlier one succeeded, the database is left in the corresponding
  partial state (backfill landed, checkout/flip did not; or backfill+checkout landed,
  flip did not) until the coach retries.
- Retry is safe by construction, not by luck: backfill uses
  `.upsert(rows, {onConflict:'session_id,student_id', ignoreDuplicates:true})`
  (precedent: `supabase/functions/checkin/attendance_upsert.ts`'s own
  `applyUpsertIgnoreDuplicates`, the same "first write wins, never clobber a real row"
  semantics reused here specifically so a benign race — e.g. a real QR check-in landing
  between `loadSummary` and confirm — is silently skipped rather than destructively
  overwritten or fatally rejected); checkout re-sets the same `endsAt` value
  idempotently, guarded by `.is('check_out_at', null)` so it never clobbers a real
  checkout stamp set some other way; the status flip re-sets the same terminal value.
  A coach re-clicking "End meeting" after a partial failure (the dialog's own
  `handleConfirmEndMeeting` leaves `isConfirmOpen` open and `data` untouched on
  rejection — read `EndMeetingDialog.tsx` yourself to confirm this before relying on
  it) safely re-issues the same three calls without a duplicate-key rejection.
- **Known residual, disclose it, do not silently fix it or expand scope to fix it:**
  `LiveConsole.tsx`'s own roster/attendance panel (`loadData`/`onSetAttendanceStatus`)
  remains fixture-backed after this task — a separate, pre-existing, already-disclosed
  gap (that file's own module doc section 2). After a coach ends a meeting through the
  now-real `EndMeetingDialog`, the roster panel above it will not reflect the
  just-backfilled absences or checkouts (it never refetches). This is a real,
  user-visible inconsistency between the now-real dialog and the still-fixture roster
  panel on the same screen. Per constitution item 20, **file it as a follow-up task in
  your worker output**, do not fix it here (wiring `LiveConsole`'s own live roster is a
  materially larger task — QR minting, Realtime, the console's own `loadData` — well
  beyond this packet's scope) and do not describe it only in a code comment.

---

## 8. Tier and gate — the foreman's recommendation, not yet ratified

**Worker tier: sonnet (no override).** None of constitution item 18's four explicit
opus triggers fire: no migration file, no RLS policy or `security definer` helper
created or modified (both already exist and are read-only here), no metric-math SQL
view touched, no auth/session/role-resolution/permission logic changed (`useAuth()` is
read, not modified, exactly as `LiveConsole.tsx` already does elsewhere in this same
file). Item 25's second obligation retires tier bumps for "sounds sensitive" reasoning
generalized to "sounds complex" — I am not invoking that.

**But this is not a proven-pattern rollout (item 19b) — it is the first real backend
for this dialog's atomicity contract**, a genuine multi-table sequenced write with a
disclosed data-integrity/partial-failure mode and an identity-threading requirement
this project has gotten wrong before (T170). That is exactly item 19b's "novel
pattern" case, not its "rolling out an already-verified pattern to a new surface" case.
**Recommendation: full `checker-premise` round before dispatch** (not skipped, not
light), and `checker-reviewer` at **opus** for the post-implementation check — matching
T170's and T181's own treatment (sonnet worker, opus checker, full gate; both found
real defects). This is the foreman's judgment call, stated as such, not
owner-authorized and not yet gate-ratified.

---

## 9. Required worker output

- Commit SHA (constitution item 21 — existence verified, not assumed).
- Every criterion in §6, with the actual mutation applied, actual failure output
  pasted (test name + before/after pass counts), not summarized.
- The five gates re-measured on your own worktree at your own dispatch SHA:
  `tsc`, `eslint`, `vitest` (`.env.local` absent), `prettier --check`, `vite build`.
- Zero-diff confirmation on every Forbidden file listed in §5.
- The follow-up task named in §7 (the `LiveConsole` roster/attendance disconnect),
  stated plainly, not just in a code comment (item 20).
- Explicit disclosure of anything in this packet you could not verify, or found wrong.
