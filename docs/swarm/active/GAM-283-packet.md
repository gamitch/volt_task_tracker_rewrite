# GAM-283 (T607) — worker packet

**Tier: HEAVY** (constitution item 26). Gate status: **awaiting `checker-premise`.**
No worker sees this until the gate returns DISPATCH (item 19).

## The defect, in one paragraph

When ending a meeting fails, the coach sees a fixed string — *"Couldn't end this
meeting. Something went wrong ending this meeting."* — that tells them neither
what failed nor whether the attendance they just recorded was saved. Ending a
meeting is three sequenced writes, so a failure can leave three different
partial states behind. The database handles all three safely; the coach is told
none of it, and will either re-enter attendance that already saved or walk away
from attendance that did not.

## Premise corrections — read these before the filing

I re-read all four cited sources against `main` at `28f7394`. The filing's core
claim holds. **Four corrections**, three of which change what the worker must do.

| # | The filing says | Measured | Consequence |
| -- | -- | -- | -- |
| 1 | Both catch blocks have "the identical defect" | **False for `:863-865`.** `makeOnEditAttendance` (`endMeeting.ts:509-512`) throws a real `new Error('No signed-in coach identity is available…')` *before* any network call. On the edit path the `instanceof Error` branch is **reachable and live**. Only `:829` is genuinely dead — `makeOnEndMeeting` rejects solely through `runMutation`. | Criterion 6 is not "apply the same fix twice". The two paths differ in fact and must be reasoned about separately. |
| 2 | (not mentioned) | **An existing test encodes the current behaviour.** `EndMeetingDialog.test.tsx:594-617` injects `new Error('write failed')` and asserts `document.body.textContent` contains `'write failed'`. Criterion 1's mutation (remove the `instanceof Error` gate) **necessarily reddens it.** | This test must be **re-derived, never deleted**, with a comment saying what changed and why — the precedent this very file already set for T508. Flagged to the gate as a Definition-of-Done question (non-negotiable: "existing tests must pass unless the boss explicitly approves a test update"). |
| 3 | `:903` is "the fixed `AlertDialog` title" | It is a **`Banner`** title (`:901-907`), not an `AlertDialog`. The `AlertDialog` is at `:930`. | Cosmetic, but the worker will look in the wrong place. The rendered string is `Banner title` + `description={endError}`. |
| 4 | (not mentioned) | **The edit path is unreachable in product today.** `LiveConsole.tsx:1192` passes `hasAttendanceCorrections={false}`, and `EndMeetingDialog.tsx:969` gates the only caller of `onEditAttendance` on that prop. T601 is the owner ruling that keeps it. | This is the strongest input to criterion 6's "covered or consciously excluded" judgement. |

Correction 1 also means the issue title's framing — "never the real error" — is
doubly misleading: on the edit path the real error *is* shown today.

## Constraints (these are the guardrails, not suggestions)

1. **The raw error must never reach the screen.** `loader.ts:74-76`: `cause`
   "is never itself DES-16-compliant copy and must never be rendered to a user
   directly." Postgrest/network text is not the goal — hand-authored DES-16
   copy is (PRD line 230: *errors say what happened and what to do; no
   apologies, no "Oops"*).
2. **Do not edit `loader.ts`.** Rewording `DEFAULT_LOADER_ERROR_MESSAGE`
   re-words every read failure in the app. GAM-319 faced this exact choice two
   days ago and deliberately fixed at the call site (`5081b1e`). Follow it.
3. **Do not change `endMeeting.ts`'s write behaviour.** Ordering, the opt-in
   absence guard, and retry idempotency are load-bearing and independently
   justified at `endMeeting.ts:76-96`.
4. **Never tell the coach "nothing was saved."** It is false: if step 1 landed
   and step 2 rejected, absences *are* recorded. The true, safe statement is
   that the **meeting is still open and retrying is safe** — which
   `endMeeting.ts:76-89` guarantees for every reachable partial state. Getting
   this wrong is the whole reason this row is HEAVY.
5. **The retry-safety sentence belongs to the end-meeting path only.** The edit
   path renders only when `session.status === 'completed'` (`:910` vs `:969`),
   so "the meeting is still open" is **false** there. That path *does* roll the
   optimistic update back (`:859-861`), so "your change was not saved" is true
   there and false on the end path. Do not share one sentence between them.
6. **`endMeeting.ts:113` cites T607 by number** — do not renumber it. If its
   module doc `:98-115` becomes stale because this row lands, say so in the
   completion report; do not edit that file to fix it (out of Allowed Files).

## Prescribed shape

Add to `EndMeetingDialog.tsx` two **exported pure helpers** — exported so they
are unit-testable without rendering, matching GAM-319's `extractRsvpErrorMessage`:

```
export function describeEndMeetingFailure(error: unknown): string
export function describeAttendanceEditFailure(error: unknown): string
```

Branch order, both helpers (GAM-319's shape, `instanceof Error` **removed**):

1. `isSupabaseLoaderError(error) && error.cause instanceof SupabaseNotConfiguredError`
   → return `error.message` verbatim. `toLoaderError` always sets `cause` to the
   pre-wrap raw error, so this is exactly the passthrough condition, and that
   message is already hand-authored DES-16 copy (`loader.ts:106-121`).
2. `isSupabaseLoaderError(error)` → copy selected from `error.code`, a stable
   machine-readable string (`loader.ts:96-104`; Postgrest's code, else
   `'UNKNOWN'`). **At least two distinct codes must map to distinct copy** or
   criterion 2 has no mutation that reddens it.
3. otherwise → a hand-authored fallback.

Then `:828-830` and `:862-866` call their respective helper.

Copy is the worker's to author within DES-16 and the constraints above.
`functions.ts:76,86` is the house style (*"Couldn't reach the server. Check your
connection and try again."*). The end-meeting copy must carry the
retry-safety fact (constraint 4); the edit copy must not (constraint 5).

## Allowed Files

| Path | Why |
| -- | -- |
| `src/pages/meetings/EndMeetingDialog.tsx` | the two catch blocks and the new helpers |
| `src/pages/meetings/EndMeetingDialog.test.tsx` | new coverage + the re-derivation in correction 2 |

**Forbidden, explicitly:** `src/lib/supabase/loader.ts` (constraint 2),
`src/lib/supabase/loaders/endMeeting.ts` (constraint 3),
`src/pages/meetings/LiveConsole.tsx`, `docs/swarm/**`, `.claude/**`,
`.github/workflows/**`.

*Workflow-file check performed at packet time per `AGENTS.md` § "Two walls":
this row needs no `.github/workflows/**` change, so the push wall is not on
this path.*

## Acceptance criteria

Numbering follows the issue. Each names the mutation that reddens it — a
criterion with no such mutation is not a criterion.

1. **A failed end-meeting no longer produces the fixed fallback.** A rejection
   carrying the real `SupabaseLoaderError` shape surfaces something else.
   *Mutation: restore the `instanceof Error` gate → red.*
2. **Different failures produce different messages.** Two rejections with
   different `code`s render different copy. *Mutation: collapse the code map to
   one string → red.*
3. **The coach is told the meeting is still open and a retry is safe.**
   *Mutation: delete that sentence → red.*
4. **Raw underlying error text never renders.** *Mutation: pass `cause` through
   into the surfaced string → red.* Assert on the DOM, not on the helper's
   return value alone.
5. **The copy is write-flavoured.** A failed save never tells the coach to check
   whether their data *loaded*. *Mutation: forward `error.message` verbatim from
   a generic loader rejection → red* (that message is
   `DEFAULT_LOADER_ERROR_MESSAGE`, "Couldn't load this data…").
6. **The attendance-edit catch is covered or consciously excluded** — and the
   decision cites correction 1 and correction 4, not the filing's false premise
   that the two blocks are identical.
7. **`endMeeting.ts`'s write behaviour is unchanged.** *Mutation: move the
   status flip earlier → red in the existing `endMeeting` tests.* Since
   `endMeeting.ts` is forbidden here, this is satisfied by the file being
   untouched in the diff plus the existing suite staying green.
8. **The re-derived test from correction 2 keeps real coverage.** It must still
   prove the banner appears and the session is not flipped — only the assertion
   on the raw injected string may change, and the comment must say why.

## Evidence required from the worker

- Real red output (command + exit code) for each mutation above, run per item 26
  after committing the fix (*commit before mutating*), in the worker's **own
  worktree** (item 23) — never the shared tree.
- All six gates via the `gate-run` skill.
- The commit SHA the work landed in (item 21). "Clean" is not "committed".
- The diff's file list, proving no forbidden file moved.

## Least confident decisions (item 19d — attack these first)

1. **Dropping the `instanceof Error` passthrough on the *edit* path.** My
   prescription removes it from both helpers for uniformity and for criterion
   4's absolute guarantee. That is a real specificity regression: the identity
   precondition error (`endMeeting.ts:511`) is hand-authored copy that surfaces
   verbatim today and would become generic. **What would make it wrong:** if the
   gate judges that losing a live, accurate message is worse than the
   uniformity — in which case the edit helper should keep a narrow passthrough.
   I lean toward removing it because correction 4 shows the path is unreachable
   in product, but I hold this loosely.
2. **That the re-derivation in correction 2 is a legitimate test update rather
   than a boss-approval gate.** The non-negotiable says existing tests must pass
   unless the boss approves a change. I read T508's precedent in this same file
   as authorizing deliberate, commented re-derivation when a row's own accepted
   criteria require it. **What would make it wrong:** if that precedent is
   narrower than I think, this needs boss-architect sign-off before the worker
   starts, not after.
3. **Which `code` values are actually reachable**, and therefore whether
   criterion 2's differentiation is real rather than theatre. I have not
   enumerated the Postgrest codes these three writes can produce; a plausible
   set is `42501` (RLS denial), `PGRST301` (expired JWT) and `UNKNOWN`
   (network — `TypeError` carries no `code`). **What would make it wrong:** if
   in practice essentially every failure here resolves to `UNKNOWN`, then a code
   map is dead code wearing the costume of a feature, and criterion 2 should be
   satisfied differently (or dropped with the reason recorded).
4. **That criterion 3's sentence is true for *every* reachable failure**, which
   is the claim that made this HEAVY. I read `endMeeting.ts:76-89` as
   guaranteeing it. **What would make it wrong:** any reachable path where the
   status flip lands but a later step does not, or where a retry is not
   idempotent. The module doc asserts no such path exists ("There is NO ordering
   under this design in which the flip lands and the checkout doesn't") — but
   that is the file describing itself, and this criterion puts that self-
   description on screen in front of a coach. **Gate: verify it against the
   code, not the comment.**
5. **Tier HEAVY over STANDARD.** Defended in the run log. **What would make it
   wrong:** if decision 4 is verified cheaply and holds, the remainder is
   call-site copy on a single module with a worked precedent — which is
   STANDARD's description. I took the heavier tier under item 26's
   "if two tiers are arguable, take the heavier one."
