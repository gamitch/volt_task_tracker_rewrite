# T302 — worker output

## Task

`MeetingsList.tsx:2359` computes `isEmpty = history.length === 0 && participation
=== null`. T180's checker measured that deleting the `participation === null`
conjunct leaves the whole suite green (1696 passing at T180's head, 68/68 at
base `dc0929f`) — a pre-existing coverage gap, not a T180 regression, but one
that matters more now because T180 deleted the host's own `Participation`
`ProgressBar`, leaving this clause `participation`'s only remaining
render-path consumer.

Scope: add one real, paired-assertion test to `MeetingsList.test.tsx` proving
a student with `history: []` and a non-null `participation` metric does NOT
render the "No meeting history yet" empty state. No production file changes
authorized except a temporary, reverted mutation proof against
`MeetingsList.tsx` in this worktree only (constitution item 23).

## Files changed

- `src/pages/meetings/MeetingsList.test.tsx` — added one test (both allowed
  files touched; no other file in the diff).
- `docs/swarm/active/T302-worker-output.md` — this file (new).

`src/pages/meetings/MeetingsList.tsx` was mutated temporarily for the proof
below and reverted; confirmed byte-identical to `79e159d` (see "Mutation
proof").

## The new test

Inserted immediately after the pre-existing `'empty state (no history, no
participation row)'` test, in the `<MeetingsList /> student/parent view`
`describe` block:

```ts
it('a student with zero history rows but a real participation row does not render the empty state', async () => {
  renderAsUser(STUDENT_OR_PARENT_USER, {
    resolveStudentId: fakeResolveStudentId('student-fixture'),
    loadStudentData: () =>
      Promise.resolve({
        history: [],
        participation: {
          studentId: 'student-fixture',
          teamId: 'team-ravens',
          seasonId: 'season-placeholder-current',
          expectedCt: 5,
          presentCt: 4,
          lateCt: 0,
          excusedCt: 0,
          participationPct: 80,
        },
      }),
  });
  await flushMicrotasks();
  await flushMicrotasks();
  expect(container.textContent).not.toContain('No meeting history yet');
  expect(headingOutline()).toContain('H2:Recent attendance');
});
```

Both assertions use `container.textContent` / `headingOutline()` (which itself
reads `.textContent` off queried heading elements) — never `innerHTML`, per
the task's instruction (Astryx-generated class names in `innerHTML` produce
false-positive string matches on short strings).

### Why this is a paired assertion, not absence-only

The task named a documented failure mode in this codebase: seven-plus
absence-only assertions have passed for the wrong reason, including two in
T180's own first draft (one satisfied by a coach-side "no student linked"
empty state rendering first, another by the wrong DOM element's own em-dash).
To avoid that shape here:

- `not.toContain('No meeting history yet')` — the defect's actual visible
  symptom, negated.
- `toContain('H2:Recent attendance')` — a positive assertion that **only**
  renders on the `isEmpty === false` branch (`MeetingsList.tsx:2394`, inside
  the same `else` as the empty-state check's alternative), and which can only
  be reached once `StudentMeetingsView`'s own `loadState` has resolved past
  both its `loading` and `error` states. This rules out the test passing
  because the page failed to load, errored, or hit an unrelated empty state
  (e.g. the "no student linked" `resolveStudentId` branch) — every one of
  those alternate paths renders neither string, so the negative assertion
  alone can't discriminate them from a real pass, but the positive assertion
  can only be satisfied by a fully-resolved, non-empty render.

`stripSeam.load` is left at its `beforeEach` default
(`defaultLoadConsistencyStripData`, the real fixture builder T180 already
wired module-wide) — this test does not need to control the strip's own
content, only the host's `isEmpty` branch, so it follows the file's existing
convention of overriding `stripSeam.load` only when a test's assertions
depend on strip content.

## Mutation proof

**Mutation applied** (in this worktree only, per constitution item 23 — the
shared tree was never touched):

`src/pages/meetings/MeetingsList.tsx:2359`, changed from

```ts
const isEmpty = history.length === 0 && participation === null;
```

to

```ts
const isEmpty = history.length === 0;
```

**Command:** `npx vitest run src/pages/meetings/MeetingsList.test.tsx`

**Result: RED**, exactly and only the new test, with all 75 other tests in
the file still green (76 total, 1 failing):

```
 ✓ <MeetingsList /> student/parent view > empty state (no history, no participation row) 6ms
 × <MeetingsList /> student/parent view > a student with zero history rows but a real participation row does not render the empty state 23ms
   → expected 'MeetingsNo meeting history yetYour me…' not to contain 'No meeting history yet'
 ...
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/pages/meetings/MeetingsList.test.tsx > <MeetingsList /> student/parent view > a student with zero history rows but a real participation row does not render the empty state
AssertionError: expected 'MeetingsNo meeting history yetYour me…' not to contain 'No meeting history yet'

Expected: "No meeting history yet"
Received: "MeetingsNo meeting history yetYour meeting attendance and participation will show up here once meetings for your team have been scheduled and recorded."

 ❯ src/pages/meetings/MeetingsList.test.tsx:1234:39
    1232|     await flushMicrotasks();
    1233|     await flushMicrotasks();
    1234|     expect(container.textContent).not.toContain('No meeting history ye…
       |                                       ^
    1235|     expect(headingOutline()).toContain('H2:Recent attendance');
    1236|   });

 Test Files  1 failed (1)
      Tests  1 failed | 75 passed (76)
```

The test goes red for the exact reason expected: under the mutation, a
student with `history: []` collapses into the empty state regardless of
`participation`, and the new test's first (negative) assertion catches it.

**Revert:** `MeetingsList.tsx:2359` restored to
`const isEmpty = history.length === 0 && participation === null;`.

**Confirmed byte-identical to base:**

```
$ git diff --stat 79e159d -- src/pages/meetings/MeetingsList.tsx
$ (no output — empty diff)
```

`git diff 79e159d -- src/pages/meetings/MeetingsList.tsx` also produced no
output. `git status --short` at the end of the session shows only
`M src/pages/meetings/MeetingsList.test.tsx`.

## Gates (`.env.local` absent, verified via `ls .env.local` -> "No such file or directory")

| Gate | Command | Expected | Result |
|---|---|---|---|
| Typecheck | `npx tsc --noEmit` | exit 0 | **exit 0** |
| Build | `npx vite build` | success | **`✓ built in 7.93s`, exit 0** |
| Format | `npm run format:check` | clean | **`All matched files use Prettier code style!`** |
| Lint | `npx eslint .` | 0 errors / 359 warnings, unchanged | **`✖ 359 problems (0 errors, 359 warnings)`** |
| Full suite | `npx vitest run` | 70 files / 1697 tests (base 1696 + 1) | **`Test Files 70 passed (70)` / `Tests 1697 passed (1697)`** |
| File-scoped, exit code | `npx vitest run src/pages/meetings/MeetingsList.test.tsx >/dev/null 2>&1; echo $?` | 0 | **`0`** |

All six green. The full-suite run (1697/1697, exit implied by "70 passed
(70)" / "1697 passed (1697)" with no failures section) and the file-scoped
exit-code check were both run as a separate, distinct command per the task's
explicit warning that a green pass count with a nonzero exit code is a real
failure that has bitten this project before.

## Commands run (full session, in order)

```
git status
git branch -a | grep t302
git worktree list
npx vitest run src/pages/meetings/MeetingsList.test.tsx      # pre-mutation, baseline: 76 passed
git diff --stat 79e159d -- src/pages/meetings/MeetingsList.tsx   # after mutation+revert: empty
ls -la .env.local                                              # confirmed absent
npx tsc --noEmit
npx vite build
npm run format:check
npx eslint .
npx vitest run                                                  # full suite
npx vitest run src/pages/meetings/MeetingsList.test.tsx >/dev/null 2>&1; echo $?
```

(Mutation-proof run of `npx vitest run src/pages/meetings/MeetingsList.test.tsx`
against the mutated file is captured verbatim above, between the baseline run
and the revert.)

## Known risks

- None identified for this change. The added test only reads existing,
  already-exported types (`StudentMeetingsData`) and existing fixture
  conventions (`stripSeam`, `fakeResolveStudentId`, `headingOutline`); it adds
  no new mocks or module-level state.
- The positive assertion (`H2:Recent attendance`) is coupled to that literal
  heading text at `MeetingsList.tsx:2394`. If a future task renames that
  heading, this test will need updating alongside it — same coupling every
  other test using `headingOutline()`/exact heading text in this file
  already has.

## Deferred — for the ledger

Nothing new found. This task closes the exact gap T180's checker filed T302
for; no further out-of-scope defect was discovered while working it. (Per
constitution item 20, a deliberate deferral needs a ledger row, not a
comment — there is no deliberate deferral to record here.)

## Dispute

None. The task was fully specified, self-contained, and completed as
written.
