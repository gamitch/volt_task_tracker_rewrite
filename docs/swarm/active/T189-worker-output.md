# T189 Worker Output — honest copy for a deactivated student, packet v2

Packet: `docs/swarm/active/T189-worker-packet.md` (v2, folding in
`T189-gate-round1-findings.md`). Base commit: `96e2fc9` on
`claude/t189-inactive-copy`. Worked in an isolated worktree per constitution
item 23 (`git worktree add -b t189-work <path> 96e2fc9`, then pushed the
resulting commit to `origin/claude/t189-inactive-copy`) — the shared checkout
already had that branch checked out, so a same-named worktree branch was not
possible; `git worktree add -b t189-work` off the same commit avoided moving
the shared checkout's HEAD. `node_modules` in the worktree is a symlink to the
shared checkout's real directory, gitignored, never staged (confirmed below).

## Files changed (all within Allowed Files, §9)

- `src/lib/supabase/loaders/students.ts` — new `queryStudentIsActiveById`,
  `ResolveStudentIsActiveFn`, `makeResolveStudentIsActive`,
  `resolveStudentIsActive` (real singleton). Additive only — no existing
  export's name, signature, or behavior changed.
- `src/lib/supabase/loaders/students.test.ts` — new `describe('makeResolveStudentIsActive
  (T189)')` block (6 tests): scoping (`.eq('id', studentId)`, `select('is_active')`),
  `true`/`false`/`null` outcomes, defense-in-depth id filtering, and the
  eq-drop filter-guard mutation test (same technique the file's two existing
  describe blocks already use).
- `src/pages/meetings/MeetingsList.tsx` — the inactive branch (§5), threaded
  prop (§4), and the explicit-studentId NOOP seam (§4/C5). Diff summary below.
- `src/pages/meetings/MeetingsList.test.tsx` — `fakeResolveStudentIsActive`
  helper (§7), injected at the five named call sites, plus a new
  `describe('T189 -- honest copy for a deactivated student')` block (C1-C6, §6).

No file outside this list was touched. `git status --short` before commit
shows exactly these four paths.

## `MeetingsList.tsx` — what changed and why

1. **New import** (aliased): `resolveStudentIsActive as defaultResolveStudentIsActive`,
   `type ResolveStudentIsActiveFn`, from `../../lib/supabase/loaders/students`.
   Aliased because the prop name and the singleton's exported name are both
   `resolveStudentIsActive`, unlike `resolveStudentId`/`resolveCurrentStudentId`,
   which already differ.
2. **`StudentMeetingsViewProps`** gains `resolveStudentIsActive: ResolveStudentIsActiveFn`
   (required — both call sites always supply one, real or NOOP).
3. **`StudentMeetingsView`** now issues `Promise.all([loadData(studentId),
   resolveStudentIsActive(studentId)])` inside the SAME `useLoadState` call
   that already drove `loadData` — no second DES-12 state machine; a failure
   to read `is_active` surfaces through the same "Couldn't load your meeting
   history" error Banner `loadData` failures already use. The packet did not
   name a distinct error/loading state for this seam, so I did not invent one.
4. **The render branch** (§5): `isActive === false ? (...) : isEmpty ? (...) : (...)`,
   in that order — the inactive check sits ABOVE the `isEmpty` ternary. The
   inactive branch renders `Heading level=1 "Meetings"`, both
   `StudentHistorySection`s (Upcoming, Past, with their real rows), and one
   `EmptyState` with title `"Your student account is inactive"` and
   description `"Your student account has been deactivated. If you think
   this is a mistake, contact your coach or team admin. Participation isn't
   tracked while your account is inactive."` (T184's copy, `StudentHome.tsx:1690-1694`,
   extended per §5's instruction to also name participation). It does NOT
   render the "Recent attendance" heading or `<StudentMeetingView variant="own">`.
   `true`/`null` both fall through to the pre-existing `isEmpty`/populated
   branches, unchanged.
5. **`ResolvedStudentMeetingsView`** gains `resolveStudentIsActive` and passes
   it straight through to `StudentMeetingsView` — this is the real,
   production-invoked path.
6. **`NOOP_RESOLVE_STUDENT_IS_ACTIVE`** — a module-level constant
   (`() => Promise.resolve(null)`) that `StudentMeetingsViewContainer`'s
   explicit-`studentId` branch passes to `StudentMeetingsView` INSTEAD OF the
   caller-supplied `resolveStudentIsActive` prop. This is what makes C5 real:
   a test's spy on `resolveStudentIsActive` is provably never invoked when an
   explicit `studentId` is supplied, because that branch never references the
   spy at all (not merely "returns a value nobody checks").
7. **`MeetingsListProps`** gains `resolveStudentIsActive?: ResolveStudentIsActiveFn`,
   defaulted to `defaultResolveStudentIsActive` (the real singleton) — same
   convention as `resolveStudentId`/`loadCoachData`/etc. Threaded into the
   `<StudentMeetingsViewContainer>` call site.

## §7 — pinning `MeetingsList.test.tsx` back to 76 before adding tests

Confirmed the packet's disclosed break first: with the prop wired but before
any test-file injection, `npx vitest run src/pages/meetings/MeetingsList.test.tsx`
showed **73 passed | 3 failed** in my implementation (not exactly the gate's
76/71/5 split — see note below), all three failing student/parent-view tests
that reach the real, unconfigured `resolveStudentIsActive` default and land
in the error state instead of their expected text:

```
× loading state — expected 'Couldn't load your meeting history…' to contain 'Loading your meetings'
× empty state (no history, no participation row) — expected 'Couldn't load your meeting history…' to contain 'No meeting history yet'
× a student with zero history rows but a real participation row does not render the empty state — expected [] to include 'H2:Recent attendance'
```

**Note on the 3-vs-5 count:** my `StudentMeetingsView` combines `loadData`
and `resolveStudentIsActive` via a single `Promise.all` inside one
`useLoadState`. Two of the five named tests didn't go red under that specific
implementation: `'error state'` already expects the same error Banner
regardless of which promise rejects first, and `'resolveStudentId resolving a
real id...'` only asserts `loadStudentDataSpy` was called with the right id
(which happens synchronously as `Promise.all`'s array is built, independent
of the overall promise's eventual fate) — it never checks rendered text. This
is implementation-detail variance, not a disagreement with the packet's
diagnosis (real defaulted loader, `.env.local` absent, rejects) — a
sequential-await implementation would very plausibly break exactly the five
named. Per §7's explicit authorization, I injected
`resolveStudentIsActive: fakeResolveStudentIsActive(true)` at **all five**
named call sites regardless (`:1163`/`:1179`/`:1189`/`:1216`/`:1276` in the
packet's pre-edit numbering — the five `renderAsUser(STUDENT_OR_PARENT_USER, {...})`
blocks for `'loading state'`, `'error state'`, `'empty state (no history, no
participation row)'`, the T302 test, and the T096 `'resolveStudentId
resolving a real id...'` test), touching nothing each asserts. Confirmed:

```
npx vitest run src/pages/meetings/MeetingsList.test.tsx
 ✓ src/pages/meetings/MeetingsList.test.tsx (76 tests) 2306ms
 Test Files  1 passed (1)
      Tests  76 passed (76)
```

76/76 restored (`tsc --noEmit` also exit 0 at that point), matching the
packet's own gate-verified remedy claim, before any new C1-C6 test was added.

## §6 — acceptance criteria and mutation evidence

All six added as `it` blocks under `describe('T189 -- honest copy for a
deactivated student')` in `MeetingsList.test.tsx`, using
`container.textContent` (never `innerHTML`), paired presence/absence where
both are meaningful (C4/C5 are absence-only by nature, per the packet).

For every criterion I applied the packet-named production-code mutation
directly to `MeetingsList.tsx` **in this worktree** (constitution item 23),
ran `-t "T189"` to see the real output, then reverted via a byte-for-byte
diff check (`diff` against a pre-mutation copy showed zero differences after
each revert) before moving to the next mutation. All six tests are back in
their original, unmutated state in the committed diff.

**C1** — inactive (`false`): honest copy renders; the strip's own "no
completed meetings recorded yet" copy absent. *Mutation: `isActive === false`
→ `false` (branch made unreachable).* Real red output:

```
FAIL  ... > C1: inactive renders the honest copy; the strip's own "no completed meetings" copy is absent
AssertionError: expected 'MeetingsUpcomingNo upcoming meetingsY…' to contain 'Your student account is inactive'
```
(C6 also went red under this mutation, as expected — it depends on the same branch.)

**C2** — Upcoming/Past keep their real rows while inactive. *Mutation:
dropped both `StudentHistorySection`s from the inactive branch.* Real red output:

```
FAIL  ... > C2: inactive -- Upcoming and Past still render their real rows
AssertionError: expected 'MeetingsYour student account is inact…' to contain 'Upcoming Robotics Session'
```

**C3** — active (`true`): renders as today, honest copy absent. *Mutation:
`isActive === false` → `isActive !== false`.* Real red output (C1, C3, C4,
C5, C6 all failed under this inversion — expected, since it is a severe
mutation that swaps which population sees which branch; only C2, which
doesn't depend on the branch's polarity, stayed green):

```
FAIL  ... > C3: active renders as today; honest copy is absent
FAIL  ... > C1 / C4 / C5 / C6 (also red under this mutation)
```

**C4** — active with zero completed sessions (`participation === null`,
`isActive === true`): honest copy absent — the exact trap §3 names.
*Mutation: `isActive === false` → `participation === null`.* Real red output:

```
FAIL  ... > C4: active with zero completed sessions (participation null) does not trigger the honest copy
AssertionError: expected 'MeetingsUpcomingNo upcoming meetingsY…' not to contain 'Your student account is inactive'
```
(C1 also went red under this mutation, since it no longer discriminates on
the real `isActive` value at all.)

**C5** — `resolveStudentIsActive` never called when an explicit `studentId`
is supplied. *Mutation: explicit branch now passes the real
`resolveStudentIsActive` prop instead of `NOOP_RESOLVE_STUDENT_IS_ACTIVE`.*
Real red output (only C5 failed — the mutation is otherwise behavior-neutral
since the NOOP and the real fake both resolve values that don't change the
render for that test's other assertions):

```
FAIL  ... > C5: resolveStudentIsActive is never called when an explicit studentId prop is supplied
AssertionError: expected "spy" to not be called at all, but actually been called 1 times
```

**C6** — inactive AND zero history AND null participation: honest copy
renders, "No meeting history yet" absent (MAJOR 3, gate round 1). *Mutation:
swapped ternary order so `isEmpty` is checked before `isActive === false`.*
Real red output (only C6 failed — this is the exact MAJOR-3 shape):

```
FAIL  ... > C6: inactive AND zero history rows AND null participation -- honest copy renders, "No meeting history yet" is absent
AssertionError: expected 'MeetingsNo meeting history yetYour me…' to contain 'Your student account is inactive'
```

**Only C1 discriminates against today's defect** (the packet's own framing,
confirmed): C1's mutation is "delete the fix entirely," and it alone,
undiluted by any other assertion, proves the honest copy exists at all. C2-C6
are regression guards (owner-ruling half-drop, inversion, the participation
trap, the seam-scope guard, and the branch-order MAJOR) — each verified red
under its own named mutation, none silently green.

## §8 — all six gates, `.env.local` absent

`.env.local` confirmed absent in the worktree throughout (`ls .env.local` →
"No such file or directory").

1. `npx tsc --noEmit` — **exit 0**, no output.
2. `npx vite build` — **exit 0**, `✓ built in 5.30s`. One pre-existing
   informational warning (`index-*.js` > 500kB, "Consider dynamic import()")
   unrelated to this task's files.
3. `npm run format:check` — **exit 1 on first run** (`students.test.ts` had
   one Prettier issue, caught explicitly by re-checking the real exit code
   rather than trusting the piped/truncated view — the packet's own §8
   warning about a green pass count masking a nonzero exit applied here
   almost immediately). Fixed with `npx prettier --write
   src/lib/supabase/loaders/students.test.ts` (import-list wrapping only, no
   semantic change — reran the test file after to confirm, still 18/18).
   Re-run: **exit 0**, "All matched files use Prettier code style!"
4. `npx eslint .` — **exit 0, 0 errors, 360 warnings.** Diffed byte-for-byte
   against a baseline run on the same commit (`96e2fc9`) in the shared
   checkout with no changes: **identical 360-warning, 0-error total.** The
   only diff lines were absolute-path prefixes (worktree path vs. shared
   checkout path) and line-number shifts inside `MeetingsList.tsx` for the
   same warning type (`react-refresh/only-export-components`) at the same
   relative positions — no new warning class, no new warning count. **No rise.**
5. `npx vitest run` — **exit 0. 72 files / 1744 tests passed** (base was 72
   files / 1732 tests, gate-measured). Delta is exactly +12: +6 in
   `MeetingsList.test.tsx` (C1-C6) and +6 in `students.test.ts`
   (`makeResolveStudentIsActive`'s new describe block). No file count change
   (both additions landed in already-existing test files).
6. `npx vitest run src/pages/meetings/MeetingsList.test.tsx >/dev/null 2>&1; echo $?`
   — **printed `0`.**

All six gates reported, all six pass. Re-ran tsc/build/eslint/format once
more after the Prettier fix to confirm the final committed state is clean
(all four again: exit 0).

## Forbidden-file / scope check

- `loaders/meetings.ts`, `loaders/checkin.ts` — untouched (forbidden per §4).
- `ConsistencyStrip`/`StudentMeetingView.tsx` — untouched; the inactive
  branch simply never mounts it, no export or prop signature changed.
- `ResolveCurrentStudentIdFn` (`:738`) — untouched, not widened.
- `v_student_participation`, `v_student_goal_projection` — untouched, no
  migration.
- `resolveStudentScope` (`StudentHome.tsx`'s inference) — not reused; this
  task reads `students.is_active` directly per §3's ruling.
- No `.env*` touched, no secret introduced, no PII in fixtures (all fixture
  names in this task's new tests are fabricated: "Weekly Build Session" style
  session titles, no student names beyond pre-existing fixture ids like
  `student-t189-inactive`).

## Commands run (chronological, condensed)

```
git worktree add -b t189-work <worktree-path> 96e2fc9
ln -s <shared>/node_modules node_modules   # gitignored, unstaged
npx tsc --noEmit
npx vitest run src/pages/meetings/MeetingsList.test.tsx   # baseline check
# ... edits to students.ts, MeetingsList.tsx, MeetingsList.test.tsx, students.test.ts ...
npx tsc --noEmit
npx vitest run src/pages/meetings/MeetingsList.test.tsx src/lib/supabase/loaders/students.test.ts
# six mutation experiments, each: edit -> vitest -t "T189" -> diff-verified revert
npx vite build
npm run format:check   # caught real exit 1, fixed with prettier --write, reran (exit 0)
npx eslint .           # diffed against shared-checkout baseline on 96e2fc9
npx vitest run
npx vitest run src/pages/meetings/MeetingsList.test.tsx >/dev/null 2>&1; echo $?
git add src/lib/supabase/loaders/students.ts src/lib/supabase/loaders/students.test.ts \
  src/pages/meetings/MeetingsList.tsx src/pages/meetings/MeetingsList.test.tsx \
  docs/swarm/active/T189-worker-output.md
git commit -m "..."
git push origin t189-work:claude/t189-inactive-copy
```

## Deferred — for the ledger (constitution item 20)

Nothing found in-scope that this task declined to fix. Two items worth a
follow-up task, both pre-existing and out of this task's Allowed Files, not
introduced or worsened here:

1. **`resolveStudentIsActive`'s failure mode is folded into `loadData`'s
   generic error Banner**, not a distinct DES-12 state. This mirrors the
   packet's own silence on the point (§4/§5 never name a separate error copy
   for this seam) and is a reasonable simplicity choice, but if a future task
   wants is-active failures to say something more specific than "Couldn't
   load your meeting history," that is new scope, not a gap in this one.
2. **Unrelated to this task's files**, but observed while establishing the
   eslint baseline: 360 pre-existing `react-refresh/only-export-components`
   warnings exist project-wide, none introduced by this task. Not something
   this task's Allowed Files could touch; flagged here only so it isn't
   mistaken for a T189 regression by a future gate.

Neither rises to a ledger-worthy follow-up on its own judgment, but both are
recorded per item 20's instruction to file rather than silently note in a
comment — the checker/foreman should decide whether either is worth a row.

## Dispute

None filed. I found the packet's five-call-site count (§7) did not reproduce
exactly against my particular implementation (3 of 5 failed pre-injection,
not 5 of 5) — documented above under §7, not disputed, since the packet's own
underlying diagnosis (real defaulted loader + `.env.local` absent → reject)
is correct and the authorized remedy (inject at all five named sites)
resolved it identically to the packet's own claim: 76/76 restored, `tsc`
clean.
