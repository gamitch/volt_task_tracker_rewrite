# Worker Output: T141 — a chromeless-branch guard that can actually detect a provider wrap

## Packet SHA verified

`b5c49337689cee92464cf7db02ff504c622e758b` — confirmed via
`git log -1 --format=%H -- docs/swarm/active/T141-worker-packet.md`, matches
the SHA given in the dispatch prompt.

## Merge step

```
git fetch origin
git merge origin/claude/swarm-plan-zl575z
```

Fast-forwarded cleanly (`Updating 2146255..b5c4933`), no conflicts. This
worktree's `main`-based tip was strictly behind the working branch, so the
merge was a fast-forward, not a real merge commit.

## The new tests

Added to `src/app/AppShell.test.tsx`, inside a new
`describe('T141 provider-mount guard (probe that can detect a SeasonProvider
wrap regression)')` block at the end of the top-level `describe`:

1. **`useActiveSeason() throws the exact "must be called within a
   <SeasonProvider>" message when rendered as a child of the chromeless
   /login branch`** — mounts `<AppShell>` on `routePaths.login` (chromeless)
   with children `<ThrowCaughtBoundary><SeasonProbe /></ThrowCaughtBoundary>`,
   where `SeasonProbe` calls `useActiveSeason()` and (if it doesn't throw)
   renders a `data-testid="t141-probe-ok"` marker, and
   `ThrowCaughtBoundary` is a class-based error boundary (same shape as
   `SeasonProvider.test.tsx`'s own `CaughtErrorBoundary`) that renders the
   caught error's `.message` into `data-testid="t141-boundary-error"`.
   Asserts the boundary text is **exactly**
   `'useActiveSeason() must be called within a <SeasonProvider>.'` (message
   equality, not merely "something threw"), and that `t141-probe-ok` is
   absent (the throw prevented the probe's own render from committing).
   `console.error` is spied/suppressed for this one test only (React logs
   the caught render error loudly even though the boundary handles it) —
   restored in a `finally` block, not a global mock, per the packet's "Note
   on error-throwing tests".

   This proves: `AppShell` does **not** mount `SeasonProvider` on the
   chromeless branch today, and — critically for the guard's purpose — if a
   future edit wraps that branch in `<SeasonProvider>`, this same
   `useActiveSeason()` call would stop throwing and this assertion would
   fail. See the mutation evidence below.

2. **`the same probe does NOT throw on an ordinary chrome-bearing route
   (SeasonProvider IS mounted there) -- proves criterion 1 cannot pass
   because the probe is simply broken`** — same `SeasonProbe` +
   `ThrowCaughtBoundary`, same `renderProbeAt` harness, but on
   `routePaths.dashboard` (chrome-bearing) as `COACH_USER`. Asserts
   `t141-probe-ok` **is** present and `t141-boundary-error` is absent.

   This is the companion required by the packet: without it, test 1 would
   still pass if `SeasonProbe`/`ThrowCaughtBoundary` were simply broken (e.g.
   if the probe threw for an unrelated reason, or the boundary always
   rendered its fallback). This test proves the probe only throws when
   `SeasonProvider` is genuinely absent, not unconditionally.

Both tests use a `renderProbeAt(path, user)` helper mirroring the existing
`renderAt` harness's two-branch (`user === null` vs `<LoginAs>`) render
shape, but with the probe+boundary as `AppShell`'s children instead of the
plain page-marker `<div>`.

## Criterion 3 — mutation evidence

**Before hash:**
```
$ sha256sum src/app/AppShell.tsx
87921527cebeaf758eb3d971bfd6ec2699a33547a2dca323a2425f097a9e3622  src/app/AppShell.tsx
```

**Mutation applied** (the exact regression described in the packet — wrapped
the chromeless branch in `<SeasonProvider>`):

```diff
-  if (isChromeless) {
-    return <>{children}</>;
-  }
+  if (isChromeless) {
+    return <SeasonProvider {...seasonProviderProps}>{children}</SeasonProvider>;
+  }
```

**Test run under the mutation** (`npx vitest run src/app/AppShell.test.tsx`):

```
 × <AppShell /> (T006 chrome wrapper; T123 KpiStrip mount point) > T141 provider-mount guard (probe that can detect a SeasonProvider wrap regression) > useActiveSeason() throws the exact "must be called within a <SeasonProvider>" message when rendered as a child of the chromeless /login branch 10ms
   → expected undefined to be 'useActiveSeason() must be called with…' // Object.is equality
 ✓ <AppShell /> (T006 chrome wrapper; T123 KpiStrip mount point) > T141 provider-mount guard (probe that can detect a SeasonProvider wrap regression) > the same probe does NOT throw on an ordinary chrome-bearing route (SeasonProvider IS mounted there) -- proves criterion 1 cannot pass because the probe is simply broken 23ms

⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/app/AppShell.test.tsx > <AppShell /> (T006 chrome wrapper; T123 KpiStrip mount point) > T141 provider-mount guard (probe that can detect a SeasonProvider wrap regression) > useActiveSeason() throws the exact "must be called within a <SeasonProvider>" message when rendered as a child of the chromeless /login branch
AssertionError: expected undefined to be 'useActiveSeason() must be called with…' // Object.is equality

- Expected:
"useActiveSeason() must be called within a <SeasonProvider>."

+ Received:
undefined

 Test Files  1 failed (1)
      Tests  1 failed | 24 passed (25)
```

The new test (test 1 above) failed as expected — under the mutation, the
probe no longer throws (because `SeasonProvider` is now mounted), so the
boundary never catches anything and `t141-boundary-error` is never rendered,
so `container.querySelector(...)?.textContent` is `undefined`, not the
expected message. The companion test (test 2) continued to pass unaffected,
since it exercises the already-wrapped ordinary route, which the mutation
didn't touch. All 23 pre-existing tests also continued to pass (24 passed
total besides the 1 expected failure).

**Reverted the mutation**, then re-ran:

```
$ sha256sum src/app/AppShell.tsx
87921527cebeaf758eb3d971bfd6ec2699a33547a2dca323a2425f097a9e3622  src/app/AppShell.tsx
```

Hash is identical before and after — `AppShell.tsx` is byte-identical.
`git diff --stat -- src/app/AppShell.tsx` against the merge-base commit shows
no output (empty diff), confirming the same thing independently of the hash
tool.

```
$ npx vitest run src/app/AppShell.test.tsx
 ✓ src/app/AppShell.test.tsx (25 tests) 639ms
 Test Files  1 passed (1)
      Tests  25 passed (25)
```

All 25 tests (23 pre-existing + 2 new) pass again after the revert.

## Comment fix (criterion 4)

`AppShell.test.tsx`'s pass-through-props test `'the chromeless branch stays
unwrapped even when both pass-through props are supplied...'` carried a
comment (added by T140's checker) explaining what that test does *not*
prove, and forward-referencing T141 as future banked work ("is banked as
T141... the guard against that regression is the diff, not this test").

Replaced it with a comment that:
- still explains the same limitation (nothing assertable via `container` can
  detect a `SeasonProvider` wrap, because the provider is DOM-transparent and
  no chromeless page consumes `useActiveSeason()`),
- but now points at the actual guard that exists in this same file (the new
  "T141 provider-mount guard" `describe` block below it) instead of
  forward-referencing an unbuilt future task.

No `expect(...)` assertions in that `it(` body were touched — only the
comment text between the `renderAt(...)` call and the `expect(...)`
statements was replaced. This is the one place where an existing `it(`
body's *text* changed (a comment only, no logic/assertions), done because
the packet's own "Also fix" section explicitly required correcting this
specific comment. Test logic/assertions and outcome for that test are
unchanged (still passes, unmodified behavior) — see criterion 5 note below.

## Test count

- **Started from:** 1467 tests across 63 files (confirmed via
  `npx vitest run` before making any edits).
- **Ended with:** 1469 tests across 63 files (confirmed via `npx vitest run`
  after all edits, mutation-and-revert cycle complete).
- Delta: +2, matching the two new tests added. No new test files.
- `AppShell.test.tsx` alone: 23 → 25 tests, all passing.

## Criteria 6–7 command output

**`npx tsc --noEmit`:**
```
(no output — clean)
```

**`npx vite build`:**
```
✓ built in 4.89s
```
(Only the pre-existing "chunks are larger than 500 kB" advisory, unrelated
to this change and present before it — not a build error.)

**`npm run format:check`:**
```
> volt-team-portal@0.0.0 format:check
> prettier --check "src/**/*.{ts,tsx}" "!src/theme/volt.ts" "*.{ts,js,json,html}"

Checking formatting...
All matched files use Prettier code style!
```

**`npx eslint .`:**
```
✖ 353 problems (0 errors, 353 warnings)
```
Matches the stated baseline exactly: 0 errors, 353 warnings (no new
warnings).

**`npx vitest run`:**
```
 Test Files  63 passed (63)
      Tests  1469 passed (1469)
```
Baseline was 1467 across 63 files; ended at 1469 across 63 files (+2, the two
new tests), as expected.

## Anything unverified

- I did not independently verify `docs/swarm/UNATTENDED-SESSION-LOG.md` or
  any other worker's prior packets/output — out of scope for this task and
  not read.
- I did not run the checker's own verification process; per instructions I
  am not certifying this work. Everything above is what I directly measured
  in this worktree, with exact command output pasted, not summarized.
- The one comment-text change inside an existing `it(` body (see "Comment
  fix" above) is a literal deviation from a strict reading of criterion 5's
  "no `it(` body changed" if that phrase is read as "zero bytes of `it(`
  body text changed." I judged it required by the packet's own explicit
  "Also fix" instruction, which points at a comment living inside that exact
  `it(` block, and limited the change to comment text only (no assertions,
  no logic, same pass/fail outcome). Flagging this plainly rather than
  asserting it's obviously fine — the checker should confirm this reading is
  acceptable.
