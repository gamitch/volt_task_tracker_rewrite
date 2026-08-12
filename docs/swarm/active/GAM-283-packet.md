# GAM-283 (T607) — worker packet, revision 2

**Tier: HEAVY** (constitution item 26). Gate status: **revised after
`checker-premise` round 1 returned REVISE** (2 BLOCKER, 3 MAJOR, 4 MINOR).
Round 2 is the last available round — a third REVISE escalates to the human
owner (item 19a). Round 1's findings and my dispositions are in
`GAM-283-run-log.md`; every one was accepted.

**Baseline at `28f7394`: 95 test files / 2437 tests green.** Measured by the
gate, not quoted from `vite.config.ts` (whose comment still says a stale
"1414 / 61").

## The defect, in one paragraph

When ending a meeting fails, the coach is told nothing useful — and, as round 1
measured, is in practice told *nothing at all*. Ending a meeting is three
sequenced writes, so a failure can leave several partial states behind. The
database handles them safely; the coach learns none of it, and will either
re-enter attendance that already saved or walk away from attendance that did
not.

## What round 1 changed, and why it matters more than the original filing

Two findings invalidate parts of revision 1. Both were produced by *running* the
code, not reading it.

### The claim I was going to put on screen is false in a reachable state

Revision 1 required telling the coach **"the meeting is still open and a retry
is safe."** Its only source was `endMeeting.ts:86-87` — the file describing
itself. That claim is true *about ordering* and does not cover the **ambiguous
write**. If step 3's request commits server-side but the response is lost
(network drop, proxy timeout, laptop sleep), `runMutation`'s `catch`
(`loader.ts:214-216`) rejects with `code: 'UNKNOWN'` **while
`event_sessions.status` is already `'completed'`.** The gate asserted it:

```
await expect(fn(PAYLOAD)).rejects.toMatchObject({ code: 'UNKNOWN' });
expect(db.sessionStatus).toBe('completed');   // "still open" is FALSE
```

**"The meeting is still open" is struck from this packet.** Do not write it, do
not imply it. The retry-safety half *survives and was verified*: all six failure
modes converge on the clean-run state after an identical retry (`ignoreDuplicates:
true` → ON CONFLICT DO NOTHING; `.is('check_out_at', null)`; the flip re-sets the
same terminal value; `unique (session_id, student_id)` at
`20260717000000_scheduling_attendance.sql:94`).

### The banner the fix writes into is invisible

`setIsConfirmOpen(false)` (`EndMeetingDialog.tsx:826`) sits **inside the `try`**,
so it is reached only on success. On failure the confirm `AlertDialog` stays
open; Astryx's `Dialog` calls `showModal()`, putting it in the top layer with the
document inert behind a `::backdrop` at `#00000080` / `blur(2px)`. The error
`Banner` (`:901-907`) renders **outside** that layer. The coach sees a still-open
modal reading *"This meeting will be marked completed."* and no error at all.

Every criterion in revision 1 would have passed while the coach saw nothing,
because `document.body.textContent` cannot distinguish *rendered* from *rendered
behind an inert layer*. **Better copy in an unreachable banner is not a fix.**

## Premise corrections — read these before the filing

Re-read against `main` at `28f7394`, then independently re-measured by the gate.

| # | The filing says | Measured | Consequence |
| -- | -- | -- | -- |
| 1 | Both catch blocks have "the identical defect" | **Both qualified.** `:829` is dead *for product wiring* (`makeOnEndMeeting` rejects only through `runMutation`, never an `Error`) but **alive for the injected test seam** — which is exactly why `EndMeetingDialog.test.tsx:613` exists. `:863-865` is reachable *in type/test terms* via `makeOnEditAttendance`'s identity throw (`endMeeting.ts:509-512`) but **unreachable in product** — see correction 4. Revision 1 said "reachable and live" and contradicted its own correction 4. | Neither block is simply "dead". Do not reason from the filing's symmetry claim. |
| 2 | (not mentioned) | **Exactly one existing assertion breaks, and it is measured:** `EndMeetingDialog.test.tsx:613` (`expect(document.body.textContent).toContain('write failed')`) — **1 of 30 in that file, 1 of 2437 suite-wide.** `LiveConsole.endMeeting.test.tsx` is unaffected. | Re-derive it, never delete it, with a comment saying what changed and why. Authorized by the T508 §3g precedent in this same file (`T508-worker-packet.md:175-190`), **which conditions the authorization on naming measured tests one by one** — that is why the number above is stated. Gate ruled: **no boss-architect escalation required.** |
| 3 | `:903` is "the fixed `AlertDialog` title" | It is a **`Banner`** title (`:901-907`). The `AlertDialog` is at `:930`. | The worker would otherwise look in the wrong place. |
| 4 | (not mentioned) | **The edit path is unreachable in product.** `LiveConsole.tsx:1192` passes `hasAttendanceCorrections={false}`; `EndMeetingDialog.tsx:969` gates `onEditAttendance`'s only caller on it; that is the sole mount (`grep -rn hasAttendanceCorrections src/`). T601 is the owner ruling that keeps the factory. | Decides criterion 6, and means nothing of user value is lost by not authoring separate edit-path copy. |

The issue title's framing — *"never the real error"* — is misleading in both
directions, and `loader.ts:74-76` forbids the fix it appears to ask for.

## Constraints

1. **The raw error must never reach the screen.** `loader.ts:74-76`: `cause`
   "is never itself DES-16-compliant copy and must never be rendered to a user
   directly." The goal is hand-authored DES-16 copy (PRD line 230: *say what
   happened and what to do; no apologies, no "Oops"*).
2. **Do not edit `loader.ts`.** Rewording `DEFAULT_LOADER_ERROR_MESSAGE`
   re-words every read failure in the app. GAM-319 (`5081b1e`) faced this exact
   choice and fixed at the call site.
3. **Do not change `endMeeting.ts`'s write behaviour.** Ordering, the opt-in
   absence guard and retry idempotency are load-bearing (`endMeeting.ts:76-96`).
4. **Never claim the meeting is still open, and never claim nothing was saved.**
   The first is false in the ambiguous-write state above. The second is false
   whenever step 1 landed and a later step rejected — the absences *are*
   recorded. Getting either wrong is the T189 failure this row's tier exists to
   prevent.
5. **What you may assert, because it was verified:** that **retrying is safe and
   will not double-record anything**, and that **anything already recorded was
   kept**. Nothing stronger.
6. **Two disclosed divergences — do not overclaim past them.** (a) If the coach
   *unticks* the opt-in checkbox before retrying, absences that already landed
   are **not** undone. (b) A student who checks in *between* attempts is not in
   the stale `checkoutStudentIds`, so the retry can complete the session leaving
   that student without a `check_out_at`. Neither corrupts data; both mean
   "retrying is safe" must be worded as *safe to repeat*, not as *guaranteed to
   produce a perfect result*.
7. **`endMeeting.ts:113` cites T607 by number** — do not renumber it. Its module
   doc `:98-115` will go partly stale when this lands; report that, do not edit
   it (outside Allowed Files).

## Prescribed shape

### Part A — make the failure reachable (BLOCKER-2)

Move `setIsConfirmOpen(false)` out of the `try` so the confirm modal closes on
failure as well as success, making the existing `Banner` at `:901-907` reachable.
The `finally` block at `:831-833` is the natural home.

*Rejected alternative, recorded so it is not re-litigated:* putting the error in
the `AlertDialog`'s own `description` (`:936`). `AlertDialogProps` accepts **no
children** (`AlertDialog.d.ts:17-60`) so only the plain `string` `description` is
available, and overwriting it would destroy the confirm copy the coach needs
while deciding — and would leave a second, invisible error surface in the
`Banner`. One error surface, the one that already exists.

**Measure the suite impact of this change before assuming it is free.** Round 1
only measured Part B. If it reddens further assertions, re-derive them under the
same correction-2 discipline and report the count.

### Part B — one helper, parameterised (MAJOR-1, and the gate's "one helper" path)

Add a single **exported pure helper** to `EndMeetingDialog.tsx` — exported so it
is unit-testable without rendering, matching GAM-319's `extractRsvpErrorMessage`:

```ts
export function describeWriteFailure(error: unknown, writeFlavouredMessage: string): string
```

Branch order:

1. `isSupabaseLoaderError(error) && error.cause instanceof SupabaseNotConfiguredError`
   → `error.message` verbatim. `toLoaderError` always sets `cause` to the pre-wrap
   raw error, so this is exactly the passthrough condition, and that message is
   already hand-authored DES-16 copy (`loader.ts:106-121`).
2. everything else → `writeFlavouredMessage`.

**`instanceof Error` is deliberately absent, and this diverges from the
precedent this packet cites.** The landed GAM-319 (`StudentHome.tsx:963`)
*keeps* `if (error instanceof Error) return error.message;` as its first branch.
We drop it because criterion 4 needs an absolute guarantee that no raw text
reaches the DOM, and because correction 4 shows the one hand-authored `Error`
this dialog could receive is unreachable in product. **Say this in the code
comment** — otherwise a later reader "restores consistency" with GAM-319 and
silently reintroduces the defect.

**No code map.** Round 1 enumerated what revision 1 guessed at: `42501` cannot
arise from steps 2 or 3 (an RLS `using` failure on `UPDATE` matches zero rows and
returns *success* — `rls.sql:226-228`); network failures and
`SupabaseNotConfiguredError` all resolve to `'UNKNOWN'` (`loader.ts:96-103`); the
only broadly reachable non-`UNKNOWN` code is `PGRST301`. Branching on code would
also *conflict* with the retry-safety copy, since "try again" is wrong advice for
an expired JWT. This mirrors GAM-319's landed shape, which has no code branching.

Then `:828-830` calls the helper with end-meeting copy carrying constraint 5's
two facts. `:862-866` — see criterion 6.

Copy is yours to author within DES-16 and the constraints. `functions.ts:76,86`
is the house style (*"Couldn't reach the server. Check your connection and try
again."*).

## Allowed Files

| Path | Why |
| -- | -- |
| `src/pages/meetings/EndMeetingDialog.tsx` | Parts A and B |
| `src/pages/meetings/EndMeetingDialog.test.tsx` | new coverage + correction 2's re-derivation |

**Forbidden, explicitly:** `src/lib/supabase/loader.ts`,
`src/lib/supabase/loaders/endMeeting.ts`, `src/pages/meetings/LiveConsole.tsx`,
`docs/swarm/**`, `.claude/**`, `.github/workflows/**`.

*Workflow-file check performed at packet time per `AGENTS.md` § "Two walls": this
row needs no `.github/workflows/**` change, so the push wall is not on this path.*

## Acceptance criteria

Each names the mutation that reddens it. Assert on the DOM for anything the coach
is said to see.

1. **A failed end-meeting no longer produces the fixed fallback.** A rejection
   carrying the real `SupabaseLoaderError` shape surfaces something else.
   *Mutation: restore the `instanceof Error` gate → red.*
2. **The error is actually reachable at the moment of failure.** After a rejected
   end-meeting, no open modal covers the message: assert
   `document.querySelector('dialog[open]')` is `null` **and** the banner copy is
   present. *Mutation: move `setIsConfirmOpen(false)` back inside the `try` →
   red.* (Replaces revision 1's code-map criterion.)
3. **The coach is told retrying is safe and that anything already recorded was
   kept.** *Mutation: delete that sentence from the copy → red.* **Do not assert
   "the meeting is still open" — it is false (see above).**
4. **Raw underlying error text never renders.** *Mutation: pass `cause` through
   into the surfaced string → red.*
5. **The copy is write-flavoured.** A failed save never tells the coach to check
   whether their data *loaded*. *Mutation: forward `error.message` verbatim from
   a generic loader rejection → red* (that message is
   `DEFAULT_LOADER_ERROR_MESSAGE`, "Couldn't load this data…").
6. **A `SupabaseNotConfiguredError` still passes through verbatim.** *Mutation:
   collapse branch 1 into branch 2 → red.* This is the reachable, precedented
   differentiation that replaces the code map.
7. **The attendance-edit catch is consciously excluded, and the exclusion is
   recorded in the code.** Correction 4 is the reason: the path cannot be reached
   from any product surface, so authoring separate copy for it is work with no
   user. Leave `:862-866` functionally as-is and add a comment naming GAM-283,
   correction 4 and `LiveConsole.tsx:1192`, so that whoever flips
   `hasAttendanceCorrections` to `true` finds the note. *Mutation: none — this is
   a documentation criterion, and it is stated as such rather than dressed up
   with a fake one.* If you judge that covering it is cheaper than excluding it,
   you may instead call the same helper there with edit-flavoured copy — but then
   constraint 5's facts must **not** be reused, because that path rolls the
   optimistic update back (`:859-861`) and renders only when the session is
   already `completed` (`:951`).
8. **`endMeeting.ts`'s write behaviour is unchanged.** *Mutation: move the status
   flip earlier → red in the existing `endMeeting` tests* (verified by the gate:
   reddens 2). Satisfied here by the file being absent from the diff plus a green
   suite.
9. **The re-derived assertion from correction 2 keeps real coverage.** It must
   still prove the banner appears and the session is not flipped; only the
   assertion on the raw injected string may change, and the comment must say why.

## Evidence required from the worker

- Real red output (command + exit code) for each mutation above, run **after
  committing the fix** (item 26's *commit before mutating*), in your **own
  worktree** (item 23) — never the shared tree.
- All six gates via the `gate-run` skill. **Expected baseline: 95 files / 2437
  tests**, plus your additions, minus nothing. Report the exact count and account
  for every delta.
- The count of assertions your Part A change reddens, if any.
- The commit SHA the work landed in (item 21). "Clean" is not "committed".
- The diff's file list, proving no forbidden file moved.

## Least confident decisions (item 19d)

Revision 1's list is resolved: 1 SOUND (reasoning corrected), 2 SOUND (no boss
gate), 3 settled by the gate's enumeration, **4 WRONG — became BLOCKER-1**, 5
SOUND (HEAVY confirmed; the defect needed running code to find), 6 SOUND with two
divergences now recorded as constraint 6. New list:

1. **That closing the modal on failure is the right correction for BLOCKER-2,
   rather than keeping it open and putting the error inside it.** Closing returns
   the coach to a dialog whose local state still says `scheduled` even in the
   ambiguous-write case, so the screen may disagree with the database until
   reload. **What would make it wrong:** if that stale-screen disagreement is
   judged worse than the invisible-banner defect being fixed — in which case Part
   A needs a reload/refetch, which is a larger change than this row.
2. **That criterion 7's documentation-only form is acceptable.** The issue's own
   criterion 6 permits "covered or consciously excluded", and I chose excluded on
   correction 4. It is the one criterion here with no mutation, which by this
   packet's own standard makes it not a criterion. **What would make it wrong:**
   if the gate holds that every criterion must be mechanically measurable, in
   which case criterion 7 should be dropped entirely rather than kept in a weaker
   form.
3. **That the parameterised single helper is better than two helpers or one
   constant.** It satisfies the gate's "one helper" path while keeping the two
   call sites' copy honestly different. **What would make it wrong:** if the
   second call site never uses it (criterion 7's excluded route), the parameter
   has exactly one caller and should collapse to a plain constant — a simpler
   shape I would then prefer.
4. **That no test can verify criterion 3's truth, only its presence.** Round 1
   said so explicitly. I have written the copy to claim only what was verified,
   but the verification lives in the gate's transcript and this packet, not in
   the suite. **What would make it wrong:** if a cheap regression test could pin
   the retry-idempotency property in `endMeeting.test.ts` — which is a forbidden
   file here, so it would be a follow-up row under item 20 rather than this one.
