# T197 — worker packet: assert `onEditAttendance`'s row scoping

**Workflow W3-A (unattended hygiene wave). Branch `claude/w3a-meetings-hygiene`. STANDARD tier.**
Base commit `33c9e24`.

**Premise gate: SKIPPED under constitution item 19b, by orchestrator decision — logged in
`auto-mode-decisions.md` under "W3-A auto-mode window", D1.** 19b permits a light check or skip for
a packet applying an already-verified pattern rather than a novel one. The premise here is not
inherited from the ledger — **the orchestrator re-ran the mutation itself** (§1) and it is reproduced
below with its real output. The residual risk in this task is a *vacuous test*, which is a worker
risk caught by the checker, not a premise risk.

## 1. The premise, measured — not quoted from the ledger

`src/lib/supabase/loaders/endMeeting.ts:450-456` (verified at base commit, read directly):

```ts
const editAttendance = runMutation<EditAttendanceArgs, void>(
  (client, args) =>
    client
      .from('attendance')
      .update({ status: args.status, recorded_by: args.recordedBy })
      .eq('session_id', args.sessionId)
      .eq('student_id', args.studentId),
  getClient,
);
```

**Mutation run by the orchestrator at base commit** — both `.eq()` calls deleted, leaving
`.update({...}),`:

```
Test Files  1 passed (1)
     Tests  14 passed (14)
vitest exit: 0
```

**Confirmed: the suite does not notice.** That mutation converts a coach's single-student status
edit into a **table-wide `attendance` UPDATE** — every attendance row in the database gets that
student's status and the coach's `recorded_by`.

**THE SHIPPED CODE IS CORRECT.** Both `.eq()`s are present. Nothing is broken and there is no bug to
fix. **You are adding the missing assertion, nothing else.** If you find yourself editing
`editAttendance`'s implementation, stop — you have misread the task.

## 2. Why this is being done now, ahead of T196

The ledger row says it was filed separately *"because T196 is blocked indefinitely"* — so the path
is unreachable and the exposure latent. **T196 is no longer blocked** (T403 landed 2026-08-03).
That does not make this a fold-in; it inverts the urgency. **T196 is the row that mounts this path
in production.** The guard must exist before the path goes live, not alongside it.

## 3. Allowed files

- `src/lib/supabase/loaders/endMeeting.test.ts` — **the assertion. This is the task.**
- `src/lib/supabase/loaders/endMeeting.ts` — **comments only, and only the block named in §5.**
  Do not touch a single line of executable code in this file.

Nothing else. Not `EndMeetingDialog.tsx`, not `LiveConsole.tsx` (W1's), not any migration.

## 4. The actual work — and the trap that decides whether it is worth anything

**A call-shape assertion is worthless here.** Asserting `expect(eq).toHaveBeenCalledWith('session_id', …)`
proves the call was made; it does not prove the *scoping worked*. This repo has shipped
**7+ assertions that passed for the wrong reason**, and T401 added a newer shape — a test that goes
**vacuous rather than red** when the code under it is broken.

**Copy T402's C2 pattern instead** (`verification-log.md`, T402 entry — read it). That test builds a
fake whose *physical row behaviour* makes the defect observable: dropping the ordering duplicated 37
ids and lost 37 others, failing as `expected 1463 to be 1500` — an outcome, not a spy call.

**For this task that means:** build a fake `attendance` table holding **several rows across at least
two sessions and at least two students**, have the fake's `.update()` apply to whatever subset the
chained `.eq()` filters actually select, and assert on **which rows changed**. With both `.eq()`s
present exactly one row changes. With either deleted, more rows change — and the assertion fails on
a row count or on a specific untouched row now being wrong.

**Self-check before you finish:** delete `.eq('student_id', …)` alone. If your test still passes, it
is not testing student scoping — fix the test, not the code. Then delete `.eq('session_id', …)`
alone. Same bar. Then restore.

## 5. Secondary, explicitly bounded: one stale comment block

`endMeeting.ts:12-19` still reads:

> NOT wired into `EndMeetingDialog.tsx`/`LiveConsole.tsx`/any route by this task. The mount is filed
> as its own row, **T196, blocked** — because `LiveConsole.tsx`'s own attendance marking is an
> **intentional no-op** (`:510-511`) and its roster loader is a **fixture** …

**Every factual claim in that sentence is now false.** T403 (2026-08-03) made `LiveConsole`'s roster
and attendance writes real and deleted the fixtures; T196 is unblocked.

Rewrite that block to say: this factory is still **not mounted** (true — that is T196's job, and
T196 is not this task), the mount is **unblocked as of T403**, and the original blocking reason no
longer holds. **Keep it to that block. Do not rewrite the rest of the module doc.**

## 6. Acceptance criteria — each must be provable by a mutation

| # | Criterion | Mutation that must turn it RED at exit 1 |
|---|---|---|
| C1 | The test proves **session** scoping | delete `.eq('session_id', args.sessionId)` |
| C2 | The test proves **student** scoping | delete `.eq('student_id', args.studentId)` |
| C3 | The test proves **both together** | delete both |
| C4 | The existing 14 tests still pass unchanged | — (regression: no existing assertion may be weakened or deleted) |

**Item 23: commit your work BEFORE mutating.** For each of C1–C3, apply the mutation, run the suite,
record the **exact failing assertion text and the exit code**, then restore. A green suite at exit 0
after a mutation means that criterion is not covered — report it, do not paper over it.

## 7. Required output

- The four criteria, each with its mutation's real output (failing assertion + exit code)
- Baseline gates re-run on your final tree: `tsc`, `eslint`, `prettier`, `vitest`
  (**orchestrator's measured base: `tsc` 0 · prettier clean · vitest 78 files / 1944 tests, exit 0**
  — if your numbers differ, say so rather than restating these)
- Confirmation that `endMeeting.ts`'s executable code is byte-identical to base, e.g.
  `git diff base -- src/lib/supabase/loaders/endMeeting.ts` showing comment lines only
- Anything you found and did **not** fix, filed rather than silently dropped
