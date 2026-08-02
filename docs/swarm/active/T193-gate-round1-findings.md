# T193 — premise gate, round 1: REVISE (2 MAJOR, 4 MINOR, 1 NIT, no BLOCKER)

Run on **fable**, at `main` = `e422123`. **The gate BUILT the prescription in its own worktree**
(item 23) rather than reviewing it, which is what produced both MAJORs. Packet v2 folds all of it in.

## MAJOR 1 — the packet's harness warning was FALSE, and it hid the real hazard

v1 asserted that adding a defaulted loader prop would make every existing test reach the real
`submitRsvpChange` and fail — reasoning by analogy from `DashboardPage.test.tsx:39-42` and
`OutreachList.test.tsx:158-165`. **Measured, implementing §3 with zero pinning:**

```
OutreachList.test.tsx  before: 92 passed, exit 0
OutreachList.test.tsx  after : 92 passed, exit 0
full suite             after : 1817 passed (75 files), exit 0 · tsc exit 0
```

**Why the analogy fails:** those two files document a **mount-time loader** trap. `submitRsvpChange`
is a **click-time mutation** — it fires only on interaction, and exactly **one** of 92 tests clicks
an RSVP segment.

**The hazard the false warning obscured is worse than a failure.** The one test that does click —
*"selecting a real RSVP segment updates the goal bar and the unanswered-RSVP badge live (module doc
#8b)"* — stays green **only by racing the rejection**. The gate added a single
`await flushMicrotasks()` after the click: **1 failed | 91 passed**, because the rollback reverts
the state it asserts. v1's own procedure ("record the count, pin every affected site") would have
measured 92→92, concluded no pinning was needed, and shipped a green-by-race test.

**Lesson worth more than the fix: count-delta pinning is not evidence of safety.** It answers "did
anything break", not "is anything now passing for the wrong reason".

## MAJOR 2 — "mirror RsvpControl exactly" is impossible in this component

v1 prescribed capturing a scalar `previousStatus` and restoring it, mirroring
`RsvpControl.tsx:482-506`. That component rolls back a `displayedStatus` that may be `null`.

**Here the state is the shared `rsvps` array**, and `withRsvpOverride`
(`OutreachList.tsx:1390-1412`, whose signature v1 itself froze) takes a **concrete `RsvpStatus`**
and, when no row exists, **appends** one. It cannot remove a row, so it cannot express "back to
unanswered" — and a captured `previousStatus` is `undefined` in exactly the dominant case, a student
answering for the first time.

A worker following v1 literally would ship a **stuck phantom RSVP** on a failed write: the precise
failure v1's own §3 called "worse than today's bug".

**Verified fix, built and run by the gate:** snapshot the previous `rsvps` **array** and restore it
in `catch`. No signature change needed. `tsc` 0, 92/92, 1817/1817, and the flush experiment confirms
it restores the unanswered state correctly.

## MINOR — citations and criteria

- **`loader.ts:168-175` is the wrong function.** That is `createLoader`, the **read** path.
  `submitRsvpChange` rejects via `runMutation`, `loader.ts:203-227`.
- **C4 cannot be an in-suite assertion** — no test can assert its own suite's exit code. It is a
  gate-level check via `npx vitest run …; echo $?` with the mutation applied.
- **C5 does not discriminate.** It passes against current code too, because the coach branch has no
  RSVP handler at all, and its mutation has no natural site. Kept as an explicitly-labelled
  regression guard with the mutation site named.
- **"11 pending RSVPs"** is a live-DB observation, not repo-verifiable. Marked as such.

## Confirmed sound

Every other citation exact. **The id-space assignment is provably correct, not backwards** —
`viewerProfileId = user.id`, `profiles.id` **is** `auth.users.id` (`identity_roster.sql:17`),
`rsvps.responded_by references profiles(id)` (`scheduling_attendance.sql:72`), and RLS requires
`responded_by = auth.uid()` (`rls.sql:207,212`), so passing a `students.id` would be RLS-rejected.
`viewerStudentId` is never a placeholder in production — `StudentParentOutreachView` renders only
behind `ViewerStudentIdGate`'s null check. Scope containable to the two allowed files, verified by
grepping every consumer. No cheaper path exists.

## Note on the model

This was the first gate run on **fable**. It produced the same *kind* of result the opus gates
produced on T305 and T189 — and for the same reason: **it executed the prescription instead of
reading it.** That remains the variable that predicts whether a gate finds anything.
