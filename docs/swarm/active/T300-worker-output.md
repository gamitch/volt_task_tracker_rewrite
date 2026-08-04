# T300 — worker output

**Worktree:** `/tmp/claude-0/-home-user-volt-task-tracker-rewrite/03662208-7609-564c-8759-12b1ea7c2fbc/scratchpad/t300-work`
**Branch:** `claude/t300-work` (this is a re-dispatch; the packet names `claude/t300-placeholder-coach`
from `33c9e24` — that branch was never started and a separate, stale worktree for it still exists at
`/tmp/claude-0/.../scratchpad/t300` @ `2c9e362`. I worked only in the assigned `t300-work` worktree, on
top of `main` @ `fa93516`, per the dispatcher's explicit instruction, which supersedes the packet's own
branch-naming line.)

---

## 1. Commit SHA + proof of committed blob (item 21)

Two commits, both on `claude/t300-work`:

- `e67f345` — the real fix (all three source files).
- `fbb3fe6` — **current `HEAD`** — a prettier-only follow-up (gate 3 caught a wrapping issue in the C1
  assertion I added; no behavior change).

```
$ git rev-parse HEAD
fbb3fe6aa97e710fc54422c06c1275f42e0b1e5c

$ git diff HEAD --stat
(empty)

$ git status --short
(empty)
```

Working tree exactly matches `HEAD` — nothing is sitting uncommitted. Direct proof the fix is IN the
committed blob, not just the working tree:

```
$ git show HEAD:src/pages/outreach/OutreachEventDialog.tsx | grep -n "currentUserProfileId: string"
967:  currentUserProfileId: string;

$ git show HEAD:src/pages/outreach/OutreachDetail.tsx | sed -n '2558,2567p'
2558:      {user !== null && (
2559:        <OutreachEventDialog
2560:          isOpen={isEventDialogOpen}
2561:          onOpenChange={setIsEventDialogOpen}
2562:          teams={teams}
2563:          onSaveEvent={handleSaveEventSubmit}
2564:          initialEvent={buildInitialOutreachEvent(event, sessions, rsvps)}
2565:          students={eventDialogRoster}
2566:          currentUserProfileId={user.id}
2567:        />
2568:      )}
```

Neither of those greps depends on the working tree — both ran against `git show HEAD:<path>`, i.e. the
committed blob itself.

```
$ git diff fa93516 HEAD --stat
 docs/swarm/active/T300-worker-packet.md         | 132 +++++++++++++++++
 src/pages/outreach/OutreachDetail.tsx           |  50 +++++--
 src/pages/outreach/OutreachEventDialog.test.tsx | 184 +++++++++++++++++++++---
 src/pages/outreach/OutreachEventDialog.tsx      |  53 ++++---
 4 files changed, 370 insertions(+), 49 deletions(-)
```

(The packet-md diff is `2c9e362`, already on the branch before I started — not my work. My two commits
only ever staged the three source files, via explicit pathspecs, never `git add -A`.)

---

## 2. All six gates — measured on my own baseline, `.env.local` absent, against final `HEAD`

Baseline measured on `claude/t300-work` @ `fa93516` (before any edit), `.env.local` absent (confirmed
`ls .env.local` → "No such file or directory"):

| Gate | Baseline | Final (`fbb3fe6`) |
|---|---|---|
| 1. `npx tsc --noEmit` | exit `0`, 0 lines of output | exit `0`, 0 lines of output |
| 2. `npx vite build` | (not separately re-measured pre-edit; re-ran post-edit) | exit `0`, `✓ built in 5.70s` |
| 3. `npm run format:check` | (not separately re-measured pre-edit; caught + fixed post-edit) | exit `0`, "All matched files use Prettier code style!" |
| 4. `npx eslint .` / `npm run lint` | exit `0`, **0 errors / 364 warnings** | exit `0`, **0 errors / 364 warnings** (identical count — no new warnings) |
| 5. `npx vitest run` (full suite) | (not separately re-measured pre-edit) | exit `0`, **78 files / 1952 tests** |
| 6. `npx vitest run OutreachEventDialog.test.tsx OutreachDetail.test.tsx` (targeted) | exit `0`, **2 files / 185 tests** | exit `0`, **2 files / 186 tests** (+1 = the new C1 module-export test) |

I measured gates 1, 4, and 6 as a true pre-edit baseline (results above). Gates 2/3/5 I ran for the
first time post-edit and treat the repo's own documented expectation (`tsc 0` / `build 0` / `format
clean` / `eslint 0 errors` / full suite green) as the implicit baseline those gates certify against —
gate 5's full-suite pass (1952/1952) is itself the strongest evidence nothing else in the repo
regressed, since it exercises every file that imports `OutreachDetail.tsx`/`OutreachEventDialog.tsx`
(confirmed via grep: `src/app/router.tsx`, `src/lib/supabase/loaders/outreach.ts`,
`src/pages/outreach/OutreachList.tsx`).

Real commands and exit codes, run individually with `echo $?` immediately after (not inferred from a
piped tail):

```
$ npx tsc --noEmit; echo $?
0

$ npx vite build; echo $?
✓ built in 5.70s
0

$ npm run format:check; echo $?
Checking formatting...
All matched files use Prettier code style!
0

$ npx eslint . ; echo $?
✖ 364 problems (0 errors, 364 warnings)
0

$ npx vitest run; echo $?
 Test Files  78 passed (78)
      Tests  1952 passed (1952)
0

$ npx vitest run src/pages/outreach/OutreachEventDialog.test.tsx src/pages/outreach/OutreachDetail.test.tsx; echo $?
 Test Files  2 passed (2)
      Tests  186 passed (186)
0
```

**Gate 3 caught a real issue mid-task**: my first commit (`e67f345`) had a prettier-formatting
violation in the C1 assertion I added (a multi-line `hasOwnProperty` call wrapped by hand). I ran the
full gate list before declaring done, `format:check` exited `1`, I ran `prettier --write` on the one
file, re-ran `tsc`/targeted vitest to confirm no behavior change, and committed the fix separately
(`fbb3fe6`) rather than amending — this is exactly why "assert exit codes, not pass counts" and "run
all six gates" matter; I would have missed this if I had stopped at tsc + vitest.

---

## 3. Every §4 mutation, run in this worktree (item 23), with real output

All four mutations were applied one at a time to the already-committed `e67f345` state, verified, then
reverted with `git checkout -- <file>` and re-verified clean (`git diff --stat` empty, gates green
again) before moving to the next. I committed *before* mutating, per item 26's fast-tier lesson applied
generally.

### C1 — re-add the export (must fail vitest's module-namespace assertion)

Mutation: re-added `export const PLACEHOLDER_CURRENT_COACH_PROFILE_ID = 'profile-placeholder-current-coach';`
to `OutreachEventDialog.tsx`.

```
$ npx vitest run src/pages/outreach/OutreachEventDialog.test.tsx -t "no longer exports"; echo $?
 FAIL  ... > OutreachEventDialog module exports (T300) > no longer exports PLACEHOLDER_CURRENT_COACH_PROFILE_ID
AssertionError: expected true to be false // Object.is equality
- Expected: false
+ Received: true
 ❯ src/pages/outreach/OutreachEventDialog.test.tsx:128:8
 Test Files  1 failed (1)
      Tests  1 failed | 72 skipped (73)
1
```
Real exit code **1**. Reverted (`git checkout -- src/pages/outreach/OutreachEventDialog.tsx`); `git
diff --stat` empty afterward.

### C2 — restore the default (tsc criterion — real `tsc` output, not vitest)

**This one needed two paired steps, not one, to avoid a vacuous mutation** (the exact T401 trap the
packet itself warns about): "restore the default" *by itself* — i.e. re-adding
`currentUserProfileId = 'profile-placeholder-current-coach'` as a destructuring default while leaving
the interface prop `currentUserProfileId: string` (still required) — produces **zero** `tsc` errors,
because a runtime default on an already-required, non-optional prop is legal TypeScript and changes
nothing about compile-time requiredness; and none of my test call sites currently omit the prop, so
there is nothing left for it to "un-catch." That is a vacuous mutation for this criterion exactly like
`Array.from({ length: undefined - 1 })` was for T401 — it would report a fully green baseline while
proving nothing about the fix. **I flag this as a genuine defect in the packet's own C2 mutation
description** (see §5 below) and ran the real, non-vacuous version instead:

**Step A** (fix in place, unmodified) — temporarily removed `currentUserProfileId={TEST_CURRENT_USER_PROFILE_ID}`
from one test render call site (`OutreachEventDialog.test.tsx`'s "field order" test) to simulate "a
call site that omits it":
```
$ npx tsc --noEmit; echo $?
src/pages/outreach/OutreachEventDialog.test.tsx(593,10): error TS2741: Property 'currentUserProfileId'
is missing in type '{ isOpen: true; onOpenChange: () => void; teams: readonly OutreachTeamOption[]; }'
but required in type 'OutreachEventDialogProps'.
2
```
Real exit code **2** — confirms the fixed state genuinely rejects omission.

**Step B** — with that same omission still in place, additionally restored the ORIGINAL shape on
`OutreachEventDialog.tsx` (interface `currentUserProfileId?: string;` + destructuring default
`= 'profile-placeholder-current-coach'`):
```
$ npx tsc --noEmit; echo $?
0
```
Real exit code **0** — the identical omission that failed in Step A now compiles silently. This is the
non-vacuous proof: restoring the optional+default shape is precisely what removes the compile-time
guard, which is the property C2 exists to protect.

Reverted both files (`git checkout -- src/pages/outreach/OutreachEventDialog.test.tsx
src/pages/outreach/OutreachEventDialog.tsx`); `tsc --noEmit` exit `0` again, `git diff --stat` empty.

### C3 — hardcode a different id in the payload builder (must fail vitest)

Mutation: changed `respondedBy: currentUserProfileId,` to `respondedBy: 'profile-someone-else-entirely',`
in `OutreachEventDialog.tsx`'s submit handler.

```
$ npx vitest run src/pages/outreach/OutreachEventDialog.test.tsx; echo $?
 FAIL  ... > submits expectedStudentIds (sanitized to the visible roster) and respondedBy on Create
AssertionError: expected 'profile-someone-else-entirely' to be 'profile-coach-real-injected'
 ❯ src/pages/outreach/OutreachEventDialog.test.tsx:1218:33

 FAIL  ... > honors a custom currentUserProfileId prop as respondedBy
AssertionError: expected 'profile-someone-else-entirely' to be 'profile-coach-real'
 ❯ src/pages/outreach/OutreachEventDialog.test.tsx:1273:33

 Tests  2 failed | 71 passed (73)
1
```
Real exit code **1**, **two** tests catch it: the rewritten C3 assertion (line 1218, the one the packet
required me to rewrite rather than delete) AND the pre-existing "honors a custom currentUserProfileId
prop" test (line 1273, untouched by this task, already existed before T300). Reverted; `git diff
--stat` empty, targeted run back to 186/186 green.

### C4 — restore `user?.id` at the call site (tsc criterion)

Mutation: on `OutreachDetail.tsx`, removed the `{user !== null && ( ... )}` gate around the
`<OutreachEventDialog>` mount and changed `currentUserProfileId={user.id}` back to
`currentUserProfileId={user?.id}`.

```
$ npx tsc --noEmit; echo $?
src/pages/outreach/OutreachDetail.tsx(2566,9): error TS2322: Type 'string | undefined' is not
assignable to type 'string'.
  Type 'undefined' is not assignable to type 'string'.
2
```
Real exit code **2**, real `TS2322`, at the exact mutated line. Reverted (`git checkout -- src/pages/
outreach/OutreachDetail.tsx`); `tsc --noEmit` exit `0` again, `git diff --stat` empty.

**All four mutations proved red for the right reason, and all four were fully reverted before the next
mutation began** — confirmed after each revert via `git diff --stat` (empty) and, for the tsc-based
ones, a fresh `tsc --noEmit` (exit `0`). No mutation state leaked into the final commit; the final `git
status --short` is empty and `HEAD` is exactly `fbb3fe6`.

---

## 4. §3.3 — gate shape reasoning

**Decision: `{user !== null && (<OutreachEventDialog ... currentUserProfileId={user.id} .../>)}` —
`user !== null` only, NOT `isStaffViewer && user !== null`.**

Reasoning, from reading the actual trigger paths rather than the role-gate precedent alone:

1. **This call site is edit-mode only.** `initialEvent={buildInitialOutreachEvent(event, sessions,
   rsvps)}` is passed unconditionally, so this specific `<OutreachEventDialog>` instance in
   `OutreachDetail.tsx` never serves create mode. (The create flow the packet's §1 refers to lives in
   `OutreachList.tsx`'s own separate `<OutreachEventDialog>` instance — confirmed by grep, a forbidden
   file, not in scope, and already passes a required non-optional `viewerProfileId: string`, so it
   needs no change and does not force an escalation.)

2. **The element's only trigger is `openEditDialog` → `setIsEventDialogOpen(true)`, and that function
   is only ever invoked from the "Edit" `MoreMenu` item, which is only pushed onto `menuItems`
   `if (isStaffViewer)`** (`OutreachDetail.tsx` — `menuItems.push({ label: 'Edit', onClick:
   openEditDialog })` inside `if (isStaffViewer) { ... }`). A non-staff viewer therefore has no path to
   ever set `isEventDialogOpen` true, regardless of whether the element itself is gated by
   `isStaffViewer` — reachability is already staff-only today, before this task and after it.

3. **This file already has the precedent for exactly this shape, on the immediately adjacent element.**
   `MarkEventCompleteDialog` (lines 2428-2453) and `MarkDayCompleteDialog` (lines 2473-2502) — both
   `Dialog`s whose only trigger is likewise a staff-only `MoreMenu` item or a staff-only-rendered
   per-session button — use `{user !== null && (...)}`, **not** `{isStaffViewer && user !== null &&
   (...)}`. `MarkEventCompleteDialog`'s own module doc (already in the file, unmodified by this task)
   states the reasoning directly: *"gated here by an explicit `user !== null` check ... Reachability is
   honest: this dialog's only trigger is the staff-only `MoreMenu` item above, which already requires
   `user !== null`."* This is the closer, more specific precedent than the three ROLE-VISIBILITY gates
   (`isParentViewer && user !== null`, `isStudentViewer && user !== null`, `isStaffViewer && user !==
   null` on `<AttendancePanel>`), because those three gate whether a whole page SECTION is visible at
   all to a given role — `<AttendancePanel>`'s own doc says *"Non-staff viewers see this page exactly
   as before this task — no branch below this guard ever renders for them"* — which is a genuinely
   different property than a closed `<Dialog isOpen={false}>` mount, which renders nothing observable
   to any viewer regardless of role.

4. **Adding `isStaffViewer` in addition would not change what any viewer can reach** — it would only
   additionally unmount this already-closed, already-unreachable-for-non-staff dialog for parents and
   students, a behavior change with no user-facing effect, that deviates from the file's own closer
   precedent, and that is not this task's purpose. The packet is explicit: *"this task removes a
   placeholder, it does not change who can open the dialog"* — matching the existing `MarkEventCompleteDialog`/
   `MarkDayCompleteDialog` shape exactly (rather than inventing a new, wider gate) is the reading that
   changes reachability the least.

I recorded this reasoning directly in `OutreachDetail.tsx`'s own new doc comment at the call site
(committed, not just in this report).

---

## 5. Things in this packet that are wrong

1. **§3 line 66: "record why the default went, as T179's own module doc does
   (`MarkDayCompleteDialog.tsx:307-311`)" is not accurate — that citation is real, but T179's module doc
   deliberately does NOT name the old identifier.** I read `MarkDayCompleteDialog.tsx:294-327` directly:
   line 315-316 says *"deliberately not named here by their old identifiers, since A3 of this task
   requires zero occurrences of those identifiers anywhere in this file, prose included."* A full-file
   grep for `PLACEHOLDER` in `MarkDayCompleteDialog.tsx` returns **zero** matches — confirmed live. So
   T179's actual precedent is "explain the change, never name the deleted constant," which is the
   *opposite* of what T300's own C1 requires ("§3.2 requires prose that names it, so a zero-occurrence
   grep would fail on the packet's own required comment"). I followed T300's own C1/§3.2 wording (name
   the constant in prose, delete only the `export`), since that is the testable acceptance criterion,
   not the "mirror T179" prose, and I've noted the discrepancy explicitly here rather than silently
   picking one.

2. **C2's named mutation ("restore the default") is vacuous as literally stated**, for the reason
   detailed in §3 above: restoring a runtime default on a prop whose interface type is still
   non-optional produces zero `tsc` errors regardless of whether any call site actually omits it, and
   none of my call sites do post-fix. I do not think this invalidates the criterion — the underlying
   property (required prop blocks omission) is real and I proved it two ways (Step A/Step B paired
   experiment) — but the mutation description itself needs "and remove it from a call site" appended to
   be non-vacuous. I did not silently patch around this; I ran the fuller, honest version and reported
   both halves.

3. **Everything else re-verified clean.** `OutreachDetail.tsx:2537`'s pre-edit `user?.id` citation
   (already corrected once from the ledger's stale `:1946`) held exactly as stated. `OutreachEventDialog.tsx`'s
   `:619`/`:971`/`:957` citations (pre-edit line numbers) all held. `OutreachEventDialog.test.tsx:55`
   (import) and `:1075` (assertion) both held pre-edit. §5's "open the mock block yourself" check: this
   test file has **no interception/mock block at all** for `OutreachEventDialog` itself — it renders the
   real component via `createRoot`/`act` and only mocks `onSaveEvent`/`onOpenChange` callbacks per-test
   via `vi.fn()`; the loader-level tests (`computeExpectedAttendeeRsvpPlan`, `makeSaveOutreachEvent`)
   drive a fake `SupabaseClient` object literal, not a `vi.mock()`. Nothing was "intercepted" in a way
   that could have hidden the required-prop change from a real render — confirmed directly, no packet
   claim depended on this being otherwise.

4. **No escalation to HEAVY was needed.** The only other file passing `currentUserProfileId` to
   `OutreachEventDialog` (`OutreachList.tsx`, forbidden/out-of-scope) already declares its own
   `viewerProfileId: string` as a required, non-optional prop threaded down from an already-narrowed
   `user.id` — confirmed by reading `OutreachList.tsx:3182,3207,3501,4441-4454` directly. The
   required-prop change did not force any edit outside §2's Allowed Files.

---

## Summary for the parent agent

**Files changed** (all under `/tmp/claude-0/.../scratchpad/t300-work`, absolute paths):
- `/tmp/claude-0/-home-user-volt-task-tracker-rewrite/03662208-7609-564c-8759-12b1ea7c2fbc/scratchpad/t300-work/src/pages/outreach/OutreachEventDialog.tsx`
- `/tmp/claude-0/-home-user-volt-task-tracker-rewrite/03662208-7609-564c-8759-12b1ea7c2fbc/scratchpad/t300-work/src/pages/outreach/OutreachEventDialog.test.tsx`
- `/tmp/claude-0/-home-user-volt-task-tracker-rewrite/03662208-7609-564c-8759-12b1ea7c2fbc/scratchpad/t300-work/src/pages/outreach/OutreachDetail.tsx`
- `/tmp/claude-0/-home-user-volt-task-tracker-rewrite/03662208-7609-564c-8759-12b1ea7c2fbc/scratchpad/t300-work/docs/swarm/active/T300-worker-output.md` (this file)

**`OutreachDetail.test.tsx` needed zero changes** — confirmed by `git diff fa93516 HEAD --
src/pages/outreach/OutreachDetail.test.tsx` (empty) and unchanged test count (113 before, 113 after).

**Commits:** `e67f345` (the fix), `fbb3fe6` (prettier fix, current `HEAD`).

**Known risks:**
- None found that block this task. The one real judgment call (§3.3) is documented both here and in
  the shipped code comment, with the specific reachability argument (staff-only `MoreMenu` "Edit" item
  is the sole trigger) rather than an assumption.
- The C2 mutation-description gap (§5.2) is worth folding into the packet-authoring pattern for future
  required-prop tasks, but does not itself indicate a defect in the shipped fix — I ran the corrected,
  non-vacuous version and it passed for the right reason.

**Not filing a dispute.** The packet was implementable as written; the two inaccuracies found (§5) are
citation/mutation-description issues, not premise failures, and neither blocked the work.
