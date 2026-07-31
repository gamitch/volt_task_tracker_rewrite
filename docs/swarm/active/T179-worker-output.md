# T179 — worker output (worker: sonnet)

Implemented against **revision 2** of the worker packet, in an isolated git worktree
(`/tmp/claude-0/-home-user-volt-task-tracker-rewrite/f07aff68-1e9a-51d1-a45c-ac88b7b5b3ed/scratchpad/t179-worktree`,
branch `t179-work`, based on `8873370`), per constitution item 23. The shared checkout
(`/home/user/volt_task_tracker_rewrite`) was never modified; its HEAD never moved.

## Files changed

- `src/pages/outreach/MarkDayCompleteDialog.tsx`
- `src/pages/outreach/MarkDayCompleteDialog.test.tsx`
- `src/pages/outreach/MarkEventCompleteDialog.tsx`
- `src/pages/outreach/MarkEventCompleteDialog.test.tsx`
- `src/pages/outreach/OutreachDetail.tsx`
- `src/pages/outreach/OutreachDetail.test.tsx`

`git diff --stat` against `8873370`:

```
 src/pages/outreach/MarkDayCompleteDialog.test.tsx  |  33 +-
 src/pages/outreach/MarkDayCompleteDialog.tsx       | 154 +++-----
 .../outreach/MarkEventCompleteDialog.test.tsx      |  12 +
 src/pages/outreach/MarkEventCompleteDialog.tsx     |  13 +-
 src/pages/outreach/OutreachDetail.test.tsx         | 394 +++++++++++++++++++++
 src/pages/outreach/OutreachDetail.tsx              | 327 ++++++++++++++++-
 6 files changed, 805 insertions(+), 128 deletions(-)
```

No file outside the six Allowed files was touched. `OutreachEventDialog.tsx` (T300) and the
three "LOAD-BEARING" comments (T301) were left byte-identical.

## Summary of changes

**Part A.** `MarkDayCompleteDialog`'s `eventTitle`/`session`/`roster`/`rsvps`/
`currentUserProfileId` are now required props; the four `DEFAULT_*` fixture consts and the
exported `PLACEHOLDER_CURRENT_COACH_PROFILE_ID` (plus its `:271` prose mention) are deleted.
`MarkEventCompleteDialog`'s `currentUserProfileId` is now required too (its own
`DEFAULT_EVENT_TITLE = 'This event'` is unchanged — out of scope per the packet, a generic
label not fabricated data). Both test files got the required props added at every render site
(10 + 8, matching the packet's measured blast radius exactly), and
`MarkDayCompleteDialog.test.tsx`'s `:476`-area assertion (A4) now checks the exact
`recordedBy` value the test itself passes (`profile-coach-quill-7f3a`), not the deleted
placeholder export.

**Part B.** `OutreachDetail.tsx` gained:
- `isSessionMarkDayCompleteEligible(session, now)` — exported, gates on `session.status ===
  'scheduled' && formatChicagoDateOnly(now) >= session.sessionDate` (OUT-05's "on/after a
  session date" wording, PRD line 318 — not `startsAt`). `formatChicagoDateOnly` itself is
  **not** exported (kept module-private; exporting it too would have cost a second eslint
  warning the packet doesn't budget for).
- A staff-only, per-session "Mark day complete" trigger inside the existing
  `orderedSessions.map(...)` loop, using Astryx `Button`'s `label`/`children` split so N
  sessions get N distinct accessible names (`aria-label`) while sharing one visible-text
  literal.
- `markDayCompleteSessionId: string | null` state + `markDayCompleteSession` (resolved by id
  at render) driving a single, whole-element-gated `<MarkDayCompleteDialog>` instance, fed the
  page's real `roster`/`rsvps` unfiltered (no reshaping — the dialog's own
  `computeInitialAttendedStudentIds` filters by session) and the real signed-in coach's
  `user.id`.
- The `onMarkComplete` composition `await markDayComplete(payload); reloadDetail().catch(() =>
  {})` — `await` on the write so a real failure still surfaces in the dialog's own banner,
  `.catch()` (not `void`) on the reload so a refetch failure cannot masquerade as a write
  failure and cannot leave an unhandled rejection.
- Part C: the pre-existing `MarkEventCompleteDialog` mount's `onFinished={() => { void
  reloadDetail(); }}` changed to `.catch(() => {})` (same one-line fix, no new test — B6
  already proves the mechanism). Its `currentUserProfileId={user?.id}` (now a `TS2322` under
  Part A) fixed with an explicit `user !== null` gate (Trap 1), written as defensive and
  matching the file's own convention, **not** because the compiler requires it — the pre-existing
  "LOAD-BEARING…not a type predicate" comments at this file's other three role gates are false
  (measured below) and are deliberately left alone (T301, out of scope).
- A new module doc section #15 documenting all of the above, including an explicit correction
  of the false compiler-narrowing claim rather than repeating it.

17 new tests in `OutreachDetail.test.tsx` cover B1–B7 (a direct `describe` block for
`isSessionMarkDayCompleteEligible` plus DOM-level integration tests for the trigger/dialog
wiring, using a roster fixture — "Priya Shah"/"Devon Osei" — deliberately disjoint from
`FIXTURE_STUDENTS`, per Trap 11).

## Commands run and gate results (`.env.local` absent throughout)

```
$ ls -la .env*
.env.example
.env.local.example
```

**1. `npx tsc --noEmit`** — exit 0.

**2. `npx vite build`** — succeeded (`✓ built in ~5s`; pre-existing >500kB chunk warning,
unrelated to this task).

**3. `npm run format:check`** — "All matched files use Prettier code style!"

**4. `npx eslint .`** — `0 errors, 359 warnings` (base 358). Per-file delta, independently
verified by diffing against the base commit's copies of the three touched source files:
`OutreachDetail.tsx` 17 → 18 (`+1`, exporting `isSessionMarkDayCompleteEligible`),
`MarkDayCompleteDialog.tsx` 8 → 8 (unchanged — deleting the placeholder export recovers
nothing), `MarkEventCompleteDialog.tsx` 4 → 4 (unchanged). Total warnings 358 → 359, exactly
the packet's expected delta. (An earlier draft exported `formatChicagoDateOnly` too, which
cost a spurious second warning — caught by this per-file check and fixed by making that
helper module-private.)

**5. `npx vitest run`** — `70 files / 1685 tests`, base `70 files / 1668 tests` (measured at
`c7098e0`, confirmed unchanged at this task's own base `8873370`). Delta: **+17 tests, all in
`OutreachDetail.test.tsx`** (73 → 90); `MarkDayCompleteDialog.test.tsx` and
`MarkEventCompleteDialog.test.tsx` test *counts* are unchanged (only props added at existing
render sites, plus one rewritten assertion). The 17 new tests: 4 for
`isSessionMarkDayCompleteEligible` (direct describe block), 5 for B1 (coach/admin/parent/
student/signed-out), 3 for B2 (DOM-level, tomorrow/on-the-date/completed), 1 for B3, 1 for B4,
1 for B5, 2 for B6. **`npx vitest run src/pages/outreach/OutreachDetail.test.tsx >/dev/null;
echo $?` → `0`** (the B6(b) exit-code gate — see below).

All five gates are reported here; none was omitted.

## Acceptance criteria — mutation proofs

Every criterion below was: (1) test written, (2) exact mutation applied, (3) real command run
and real output captured, (4) mutation reverted and green re-confirmed. Output pasted verbatim,
not paraphrased.

### A1 — props required

Mutation: `session,` → `session = DEFAULT_SESSION,` in `MarkDayCompleteDialog.tsx`.

```
$ npx tsc --noEmit
src/pages/outreach/MarkDayCompleteDialog.tsx(587,13): error TS2304: Cannot find name 'DEFAULT_SESSION'.
```

Reverted: `npx tsc --noEmit` → exit 0.

### A2 — the compiler catches the omission (mechanism proof)

Mutation: deleted `currentUserProfileId={COACH_PROFILE_ID}` from one
`MarkDayCompleteDialog.test.tsx` render site.

```
$ npx tsc --noEmit
src/pages/outreach/MarkDayCompleteDialog.test.tsx(301,10): error TS2741: Property 'currentUserProfileId' is missing in type '{ isOpen: true; onOpenChange: () => void; eventTitle: string; session: MarkDayCompleteSession; roster: readonly RosterStudent[]; rsvps: readonly RsvpRow[]; }' but required in type 'MarkDayCompleteDialogProps'.
```

Reverted: `npx tsc --noEmit` → exit 0.

### A3 — fixtures gone

```
$ git grep -n "DEFAULT_SESSION\|DEFAULT_ROSTER\|DEFAULT_RSVPS\|DEFAULT_EVENT_TITLE" -- src/pages/outreach/MarkDayCompleteDialog.tsx
(no output, exit 1)

$ git grep -n PLACEHOLDER_CURRENT_COACH_PROFILE_ID -- src/pages/outreach/MarkDayCompleteDialog.tsx src/pages/outreach/MarkEventCompleteDialog.tsx
(no output, exit 1)
```

Both include prose, not just code (module doc corrected to avoid using the identifiers as
literal text, since a first draft accidentally reintroduced them in prose and was caught by
re-running this exact grep — see "what I found and fixed on myself" below).

Paired positive: `MarkDayCompleteDialog.test.tsx`'s existing checklist-pre-check tests already
render all four `ROSTER` names (`Gwen Going`/`Mateo Maybe`/`Dana Declined`/`Noor NoResponse`)
explicitly passed — unchanged by this task, still green (26/26 in that file).

### A4 — `recordedBy` carries the real id

Mutation: `recordedBy: currentUserProfileId,` → `recordedBy: 'profile-someone-else',` inside
`handleSubmit` (top-level payload field, not `buildAttendanceWriteRows`).

```
 × <MarkDayCompleteDialog /> submit payload + irreversibility guard (module docs #3/#5/#7) > calls onMarkComplete with the real checked-student attendance rows, deltas, and recordedBy
AssertionError: expected 'profile-someone-else' to be 'profile-coach-quill-7f3a'
```

Reverted: `npx vitest run src/pages/outreach/MarkDayCompleteDialog.test.tsx` → `26 passed (26)`.

### B1 — staff-only trigger, distinct accessible names

Mutation: `{isStaffViewer && isSessionMarkDayCompleteEligible(session, nowFn()) && (` →
`{isSessionMarkDayCompleteEligible(session, nowFn()) && (`.

```
 FAIL  …B1) > is absent for a signed-in parent
AssertionError: expected [ … ] to have a length of +0 but got 3
 FAIL  …B1) > is absent for a signed-in student
AssertionError: expected [ … ] to have a length of +0 but got 3
 FAIL  …B1) > is absent for a signed-out visitor
AssertionError: expected [ … ] to have a length of +0 but got 3
 Tests  3 failed | 2 passed
```

Reverted: `-t "Mark day complete.*per-session trigger"` → `5 passed`.

### B2 — eligibility, both halves proven separately

Mutation (a) — drop the status half: `session.status === 'scheduled' &&
formatChicagoDateOnly(now) >= session.sessionDate` → `formatChicagoDateOnly(now) >=
session.sessionDate`.

```
 FAIL  …B2) > a COMPLETED session shows NO trigger regardless of the clock
AssertionError: expected [ …(1) ] to have a length of +0 but got 1
 Tests  1 failed | 2 passed
```

Reverted, re-confirmed green (`3 passed`). Mutation (b) — drop the date half: → `return
session.status === 'scheduled';`.

```
 FAIL  …B2) > a scheduled session whose date is TOMORROW (relative to nowFn) shows NO trigger
AssertionError: expected [ …(1) ] to have a length of +0 but got 1
 Tests  1 failed | 2 passed
```

Reverted: `-t "eligibility gates the trigger"` → `3 passed`; full-file `tsc` exit 0.

Each mutation reddens exactly one of the three B2 tests and leaves the other two green, as the
packet requires.

### B3 — right session reaches the dialog

Mutation: `orderedSessions.find((session) => session.id === markDayCompleteSessionId) ?? null`
→ `orderedSessions[0] ?? null`.

```
 FAIL  …B3) > activating the SECOND of three triggers opens the dialog for the SECOND session
AssertionError: expected 'Mark day completeRiverside Trail Buil…' to contain 'Tue, Aug 4'
Received: "Mark day completeRiverside Trail Build · Mon, Aug 3 · 9:00 AM–12:00 PM…"
```

Reverted: `-t "resolves to the SESSION"` → `1 passed`.

### B4 — real page data reaches the dialog

Mutation: `roster={roster}` → `roster={eventDialogRoster ?? []}` at the
`<MarkDayCompleteDialog>` call site (this compiles cleanly — `OutreachRosterStudent` is
structurally assignable to the dialog's own minimal `RosterStudent`, confirming Trap 8's "no
reshaping" claim even under this mutation).

```
 FAIL  …B4) > the attendee checklist shows this event's own real roster names
AssertionError: expected 'Mark day completeRiverside Trail Buil…' to contain 'Priya Shah'
Received: "…Attendee checklistPeople reached ∙ Optional…" (empty checklist)
```

Reverted: `-t "receives THIS page"` → `1 passed`.

### B5 — real coach id threaded

Mutation: `currentUserProfileId={user.id}` → `currentUserProfileId="profile-placeholder-current-coach"`.

```
 FAIL  …B5) > confirming calls the real markDayComplete mutation with recordedBy = the signed-in coach's own id
AssertionError: expected 'profile-placeholder-current-coach' to be 'profile-coach-1'
```

Reverted: `-t "threads the real signed-in coach"` → `1 passed`.

### B6 — two tests, one per half

**(a)** Mutation: `await markDayComplete(payload);` → `void markDayComplete(payload);`.

```
 FAIL  …B6) > (a) a REJECTING write surfaces the dialog's own error banner
AssertionError: expected '' to contain 'Couldn\'t mark this day complete'
```

Reverted: `-t "write/reload composition"` → `2 passed`.

**(b)** Mutation: `reloadDetail().catch(() => {});` → `void reloadDetail();`. Full file run,
not filtered (this is the exit-code proof):

```
$ npx vitest run src/pages/outreach/OutreachDetail.test.tsx
 ✓ src/pages/outreach/OutreachDetail.test.tsx (90 tests) 7637ms
⎯⎯⎯⎯⎯⎯ Unhandled Errors ⎯⎯⎯⎯⎯⎯
Vitest caught 1 unhandled error during the test run.
⎯⎯⎯⎯ Unhandled Rejection ⎯⎯⎯⎯⎯
Error: refetch exploded
 ❯ rejectingReloadLoadData src/pages/outreach/OutreachDetail.test.tsx:2901:13
 ❯ reloadDetail src/pages/outreach/OutreachDetail.tsx:1710:25
 ❯ onMarkComplete src/pages/outreach/OutreachDetail.tsx:2208:18
 ❯ handleSubmit src/pages/outreach/MarkDayCompleteDialog.tsx:676:7

 Test Files  1 passed (1)
      Tests  90 passed (90)
     Errors  1 error

$ npx vitest run src/pages/outreach/OutreachDetail.test.tsx >/dev/null 2>&1; echo $?
1
```

**Green tests (90 passed), exit code 1.** This is the exact BLOCKER shape the premise gate
found — every assertion passes, but the run itself fails. Reverted:

```
$ npx vitest run src/pages/outreach/OutreachDetail.test.tsx >/dev/null 2>&1; echo $?
0
 Tests  90 passed (90)
```

No `Errors` line, exit 0.

### B7 — no reshaping

```
$ git grep -n "as unknown as" -- src/pages/outreach/OutreachDetail.tsx
331: * this call site (grep-provable: no `as unknown as`/manual field-mapping

$ git show 8873370:src/pages/outreach/OutreachDetail.tsx | grep -n "as unknown as"
331: * this call site (grep-provable: no `as unknown as`/manual field-mapping
```

Identical single match (a pre-existing comment) in both trees — nothing new.

## Final gate re-run (post-mutation-cycle, confirming everything is reverted correctly)

```
$ npx tsc --noEmit; echo $?
0
$ npx vite build   → ✓ built in ~5s
$ npm run format:check   → All matched files use Prettier code style!
$ npx eslint .   → ✖ 359 problems (0 errors, 359 warnings)
$ npx vitest run   → Test Files 70 passed (70) / Tests 1685 passed (1685); exit 0
```

## What I found and fixed on myself

While proving A3, I discovered my own first-draft module doc paragraph (in
`MarkDayCompleteDialog.tsx`, describing the T179 change) used the literal identifier names
`DEFAULT_EVENT_TITLE`/`DEFAULT_SESSION`/`DEFAULT_ROSTER`/`DEFAULT_RSVPS`/
`PLACEHOLDER_CURRENT_COACH_PROFILE_ID` in prose — which made A3's own grep fail. Rewrote that
paragraph to describe the old defaults without naming the deleted identifiers, then re-ran A3
and confirmed clean. A second instance of the same slip happened while writing
`MarkEventCompleteDialog.tsx`'s updated prop doc (referencing the deleted export by name) —
caught and fixed the same way before it was ever left in a "final" state. Both are visible in
the diff as already-correct; nothing was shipped with the slip in it.

I also initially exported `formatChicagoDateOnly` alongside `isSessionMarkDayCompleteEligible`,
which cost a second eslint warning (`OutreachDetail.tsx` 17 → 19, not 17 → 18). Caught by
diffing per-file eslint counts against the base commit's copies of the touched files before
declaring the gate green; fixed by making `formatChicagoDateOnly` module-private (it has no
external caller — the new test file's `isSessionMarkDayCompleteEligible` describe block calls
the eligibility predicate directly, not the date formatter).

## Known risks

- `isSessionMarkDayCompleteEligible` reads `now` via the page's own `nowFn` seam, which
  defaults to the real system clock in production — unchanged behavior for every existing
  caller of `OutreachDetail`, since `nowFn` was already threaded through this file for
  `ParentRsvp`/`RsvpControl` (T157/T169).
- The new per-session trigger button sits inside the existing `orderedSessions.map(...)` loop,
  visually between `SessionSignupList` and the `ParentRsvp`/`RsvpControl` block. I did not do a
  live visual/viewport check (no browser tooling was used in this worktree) — only DOM/text
  assertions. A checker with browser access should confirm the button placement reads
  sensibly at narrow widths, though nothing in the Astryx `Button` usage here differs from the
  sibling `MarkEventCompleteDialog`/`ParentRsvp` trigger patterns already shipped on this page.
- `MarkDayCompleteDialog`'s own `isSessionEligible = session.status === 'scheduled'` backstop
  (unchanged, that file's own module doc #5(ii)) is stricter than the page's new
  `isSessionMarkDayCompleteEligible` in one respect: the page's date half means a coach could
  theoretically open the dialog for a session whose date has arrived but whose backstop is
  unaffected (both check `status === 'scheduled'` identically, so this is not actually a gap —
  noted only because two independently-computed booleans partially overlap; they are not
  literally the same function and could drift if one is edited without the other in a future
  task).

## Deferred — for the ledger

Nothing new was found and left unfixed by this task. The two items the packet already named as
out of scope remain filed and untouched:

- **T300** — `OutreachEventDialog.tsx:619`'s own independent
  `PLACEHOLDER_CURRENT_COACH_PROFILE_ID` declaration and its `user?.id` call site. Confirmed
  still compiling standalone (`tsc` exit 0) after this task deleted the other file's export of
  the same name — the gate's claim that these are genuinely independent declarations holds.
- **T301** — the three stale `"LOAD-BEARING"` source comments at `OutreachDetail.tsx`
  (originally `:1812-1818`/`:1850`/`:1858-1861` in the base tree; now shifted further down the
  file by this task's own insertions, still present verbatim) asserting `isParentViewer`/
  `isStudentViewer`/`isStaffViewer` "do not narrow `user`" because they are "plain booleans,
  not type predicates." This task's own new module doc section #15(g) explicitly states, next
  to the two new/touched gates this task added, that this claim is false (TypeScript narrows
  through aliased `const` conditions) and that the explicit `user !== null` checks used here
  are defensive, not compiler-required — without editing the three pre-existing comments
  themselves, per the packet's explicit instruction not to touch them in this task.

## Commit

Committed to `claude/t179-mark-day-complete` (pushed from the isolated worktree's `t179-work`
branch — see final report for the SHA).

## Dispute

None. Revision 2 was implementable as written; the one place I diverged from a literal reading
(not exporting `formatChicagoDateOnly`) is a strict subset of what the packet asked for
(export the eligibility predicate) and produces the exact warning delta the packet specifies.
