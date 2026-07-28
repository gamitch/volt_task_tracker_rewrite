# Worker Packet: T107

## Task ID
T107 — Fix `RosterShell.test.tsx` regression from T104's real-data wiring
(CI-confirmed failure on `main`'s CI run for commit `a8ace3c`).

## Objective
Same recurring class of fallout already fixed three times in this project's
history (T088 for `loaders/invites`, T092 for `loaders/students`, T097 for
`loaders/teams`/`loaders/parents`): `RosterShell.tsx` renders `AdminToggles` with
zero props, relying on its own real default seam. T104 swapped `AdminToggles`'s
`loadPrivacySetting`/`togglePrivacy` defaults from fixture stand-ins to a real
`loaders/leaderboard_privacy.ts` call. `RosterShell.test.tsx`'s own
`AdminToggles gating (T028, ROS-08)` describe block renders `RosterShell` bare (no
Supabase env config in the test environment), so the real `loadPrivacySetting`
call now fails/hangs and both tests in that block time out. CI is currently
failing on this. Fix it the exact same way the three prior instances were fixed.

## Allowed Files
- `src/pages/roster/RosterShell.test.tsx`

## Forbidden Files
- `src/pages/roster/RosterShell.tsx` — do not touch; the established pattern for
  this exact class of fallout fixes it entirely from the test file's own mocks,
  never by adding props/wiring to the shell itself.
- `src/pages/roster/AdminToggles.tsx`, `src/lib/supabase/loaders/leaderboard_privacy.ts`
  — already correct (T104, checker-verified PASS), read-only.
- Every other file. `router.tsx`, `guards.tsx`, `docs/swarm/**`, `.claude/**`.

## Known Context / Traps

**1. Read the existing pattern in this exact file first.** `RosterShell.test.tsx`
already has four sibling `vi.mock('../../lib/supabase/loaders/<module>',
async (importOriginal) => {...})` blocks (for `invites`, `students`, `teams`,
`parents` — lines ~93, ~124, ~167, ~201), each re-exporting everything from the
real module via `importOriginal` except the one function it stubs a resolved
fixture value for, then asserting via `vi.mocked(...)`. Add a fifth, identically-
shaped block for `../../lib/supabase/loaders/leaderboard_privacy`, stubbing
`loadPrivacySetting` (and `togglePrivacy` if `AdminToggles.tsx`'s test-relevant
paths call it) to resolve immediately with a fixture value (e.g. `true`, matching
SEC-04's default-ON), so the two `AdminToggles gating` tests
(`RosterShell.test.tsx:463`/`471`, currently timing out at 5000ms) no longer hit a
real, unconfigured Supabase call.

**2. Confirm the exact export names.** Read
`src/lib/supabase/loaders/leaderboard_privacy.ts`'s actual exports (`T104`,
already-Passed) before writing the mock — do not guess the function names.

**3. Do not touch the two failing tests' own assertions/structure**, only add the
mock block that lets them reach their real assertions without timing out — same
minimal-diff discipline T088/T092/T097 each used.

**4. Verify the actual CI failure is what you're fixing.** The two failing tests
are: `shows the real admin-only settings widget to an admin on the default
(Students) tab` and `keeps showing AdminToggles to an admin regardless of which
tab is active` — both under the `<RosterShell /> AdminToggles gating (T028,
ROS-08)` describe block.

## Acceptance Criteria
- Both previously-timing-out `AdminToggles gating` tests pass.
- Every other test in `RosterShell.test.tsx` continues passing unchanged.
- `npm run typecheck`, `npm run lint`, `npm run test`, `npm run build`, `npm run
  format:check` all clean, zero regressions elsewhere.

## Relevant Constitution Excerpts
> No worker may mark its own work complete; every PASS requires independent
> checker-inspected evidence.

## Most Recent Failure
None as a task — this is itself the fix for a real CI failure on `main`
(commit `a8ace3c`, GitHub Actions run 29740414286/29740416951), a known,
precedented pattern already disclosed by T104's checker. This is attempt 1 for
T107 (attempt count: 0) — first dispatch. HIGH PRIORITY: CI is currently red on
the PR.

## Required Worker Output
- Full diff of the one changed file.
- Confirmation that both previously-failing tests now pass, with the actual test
  output.
- Full test/typecheck/lint/build/format:check output.
- Known risks; whether a dispute is needed (you flag, you don't resolve).
