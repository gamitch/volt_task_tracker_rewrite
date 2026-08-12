Closes GAM-283

## What a coach sees now, and did not before

Ending a meeting is three sequenced writes. When one fails, the coach used to see
`Couldn't end this meeting. Something went wrong ending this meeting.` — except
they usually saw nothing at all, because the banner rendered behind an open modal.

They now see, in a `role="alert"` banner with focus on the retry button:

> **Couldn't end this meeting**
> Couldn't finish ending this meeting. Anything already recorded was kept, and it's safe to try again — nothing will be recorded twice.

Two claims, both verified by running the code rather than by reading a comment.

## Tier: HEAVY — stated and defended, per item 26

Not on topic or ticket size. The acceptance criteria required putting a **factual
claim about database state** in front of a coach, and its truth rests on
`endMeeting.ts`'s write ordering and idempotency. Getting that wrong lies to a
user about their own data — item 26's literal trigger, and the shape of the T305
and T189 precedents it cites. FAST was excluded on size; STANDARD was arguable,
and item 26 says take the heavier tier when two are.

Item 18's opus override was deliberately **not** applied to the worker: none of
its four triggers is present, and item 25 forbids bumping tier because a topic
sounds sensitive.

## The premise gate is why this PR is not the PR I set out to write

Round 1 returned REVISE with two BLOCKERs against my own packet, both found by
executing the prescription rather than reviewing it.

**The copy I specified was false.** I required telling the coach "the meeting is
still open and a retry is safe," sourced from `endMeeting.ts:86-87` — the file
describing itself. The gate built the ambiguous-write case: step 3's `UPDATE`
commits server-side, its response is lost, and `runMutation` rejects with
`code: 'UNKNOWN'` while `event_sessions.status` is already `'completed'`.

```
await expect(fn(PAYLOAD)).rejects.toMatchObject({ code: 'UNKNOWN' });
expect(db.sessionStatus).toBe('completed');   // "still open" is FALSE
```

**The fix I specified was invisible.** `setIsConfirmOpen(false)` sat inside the
`try`, so on failure the confirm modal stayed open; `showModal()` puts it in the
top layer and the error banner renders outside it, behind an inert backdrop.
Every criterion I had written would have passed while the coach saw nothing.

Round 2 returned DISPATCH and caught a third: **criterion 1's mutation was
inert**, because re-adding `instanceof Error` inside the helper leaves a
`SupabaseLoaderError` — a plain object, never an `Error` — classified identically.
A criterion whose mutation cannot redden it is not a criterion.

## Four corrections to the filing

| The issue says | Measured |
| -- | -- |
| Both catch blocks have "the identical defect" | Wrong in both directions — `:829` is dead for product wiring but alive for the test seam; the edit path is unreachable in product |
| (not mentioned) | Exactly one existing assertion breaks: 1 of 30 in its file, 1 of 2437 suite-wide |
| `:903` is the `AlertDialog` title | It is a `Banner` title |
| "never the real error" | Invites a fix `loader.ts:74-76` forbids outright |

## Verification

Six gates at `51192fb`, tree clean. Full suite **95 files / 2443 tests** (baseline
2437; +6 fully accounted as `EndMeetingDialog.test.tsx` 30 → 36, no test deleted).

Mutations replayed **three times independently** — worker, orchestrator, checker —
each in its own worktree, shared tree never mutated. My own first attempt at
criterion 2's mutation was malformed and showed a false green; re-run correctly it
reddens. That is recorded in the run log, because a malformed mutation showing
green is exactly how a criterion gets certified against nothing.

The checker ran five mutations distinct from mine and re-derived the copy's truth
from source. It confirmed "nothing will be recorded twice" survives both disclosed
divergences, and checked something nobody had: whether a retry is blocked once the
session is already `completed`. `rls.sql:226-228` has no status predicate, so the
shipped advice holds.

## Deliberate non-goals

- **`endMeeting.ts` is untouched.** Its ordering, opt-in absence guard and retry
  idempotency are load-bearing and out of scope.
- **`loader.ts` is untouched**, following GAM-319's reasoning: rewording its
  constant would reword every read failure in the app.
- **The attendance-edit catch is consciously excluded**, not overlooked — that path
  cannot be reached from any product surface today. The exclusion is recorded in a
  comment naming the reachability premise it rests on.
- **The raw error still never reaches the screen**, which the issue title appears
  to ask for and `loader.ts:74-76` forbids.

## Follow-ups filed before this row moved (item 20)

Ignore GAM-337 · Ignore GAM-338 · Ignore GAM-339

- **GAM-337** — the residue this PR cannot fix: in the ambiguous-write state the
  coach is told the ending did not finish when it did. Needs refetch-and-reconcile.
- **GAM-338** — the on-screen promise that a retry won't double-record is guarded
  by **no test**. Removing `ignoreDuplicates: true` keeps all 2443 green while
  making the shipped sentence false.
- **GAM-339** — three near-identical write-error copy helpers.

Linear-Issue: GAM-283 (T607)

🤖 Generated with [Claude Code](https://claude.com/claude-code)
