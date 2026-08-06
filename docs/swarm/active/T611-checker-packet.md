# T611 checker packet — round 1 (post-worker)

Render a PASS / FAIL / REVISE verdict with full evidence. **Do not merge, do not touch
`docs/swarm/task-ledger.md` / `verification-log.md` / `dispute-log.md` / `constitution.md`, and do not
treat T611 as closed.** The orchestrator acts on your verdict.

**Assigned checker: `checker-reviewer`.**

## 0. Why this row inverts the usual risk

T611 is preventive. Every meeting in a series shares one wall time today, so the defect this row
closes **cannot fire yet** — T605 (blocked behind this row) is what makes per-meeting times
reachable. That means the danger here is not a live regression slipping through; it is **a fix that
silently does nothing, undetectably**, because nothing today can prove the bug is gone by using the
app normally. This packet already went through two `checker-premise` REVISE rounds and a
`boss-arbiter` ruling (D017) specifically because two of its acceptance criteria were proven
**vacuous** — satisfiable with the underlying behavior broken. **Your job is to prove the new tests
can fail, not just that they pass.** Treat every "confirmed" in the worker's own output as a claim to
re-derive, not a fact to relay.

## 1. Dispatch context

- **Task:** T611 — stop a series edit from silently rewriting per-session meeting times.
- **Worker packet:** `docs/swarm/active/T611-worker-packet.md` (v4, final, DISPATCH — read §0 for the
  full REVISE/D017 history if you need it, but do not re-litigate anything it marks settled).
- **Worker output:** `docs/swarm/active/T611-worker-output.md`.
- **Artifact location: the shared branch itself, not a worktree.** `claude/w3-meeting-workflow-0bl669`,
  **committed at `5884488`, parent `1e2f2b6`.** Confirm this commit exists and that its parent is
  `1e2f2b6` before relying on anything below (`git log --oneline -3 5884488`).
- **Anchor every diff and every scope claim to `git diff 1e2f2b6 5884488`.** A bare `git diff` against
  the working tree will be empty (the tree is clean at `5884488`) and would pass every scope criterion
  vacuously. **This project has been bitten by exactly this before — say explicitly in your output that
  you diffed against the commit range, not the working tree.**
- **Attempt count:** 1. No prior checker verdict exists for this commit.
- **Most recent verification failure:** none on this artifact.
- **Worker:** `worker-implementer`, sonnet (packet §0.4 — HEAVY tier, sonnet worker; confirmed, not
  reopened).
- **You are:** `checker-reviewer`. Tier HEAVY per packet §0.4 — this is a write-path defect
  (`event_sessions.starts_at/ends_at`, `loaders/meetings.ts:698-708`), "invisible to reading the
  code," and this exact packet already needed two premise-gate rounds plus an arbiter ruling to close
  two vacuous criteria. Do not go light.

## 2. Objective (what you are verifying)

Worker packet §3: a series edit must not silently overwrite a session's own `starts_at`/`ends_at`
unless the coach actually touched the shared Start/End time fields this edit session. New pure
function `buildEditDesiredFutureSessions`; new `timeFieldsTouched` interaction flag; new §3.3 inline
disclosure when reconcilable sessions' times genuinely diverge; new optional second parameter on
`buildEditConfirmationDescription` disclosing an impending overwrite at the real confirmation
`AlertDialog`. Full design: worker packet §3. Full required tests: §5. **Do not treat the worker's
self-report (§3 below) as established — it is reproduced only so you know what to check.**

## 3. Worker's self-report — unverified

- Files touched: `ScheduleMeetingsDialog.tsx`, `ScheduleMeetingsDialog.test.tsx`,
  `docs/swarm/active/T611-worker-output.md`. Claims zero diff on
  `computeMeetingSeriesReconcilePlan`, `loaders/meetings.ts`, `MeetingsList.tsx`, `PendingEditSave`'s
  interface, `RECONCILABLE_SESSION_A`/`_B`.
- Claims both §6 mutations run in an isolated worktree, both reddened for real, both restored to
  green — but **did not use `replay.py`** (cites `T612`'s known false-negative) and instead ran
  `vitest run` directly.
- Claims gates: typecheck/format/lint/test all exit 0; lint 370→371 (**not** the packet's own
  reference 370→372), attributed to exactly one new non-component export
  (`buildEditDesiredFutureSessions`); tests 2088→2101 (+13), confirmed two independent ways
  (`vitest`'s own summary and a `grep -c` of `it(`/`test(` in the test file).
- Claims zero existing tests required modification, and that none of the three D017-pre-authorized
  calendar-fuse tests (§9 of the worker packet) were ever observed red during this task.
- Working-tree diffstat self-reported in §1 of the worker output: `ScheduleMeetingsDialog.tsx`
  **197 insertions(+)/12 deletions(-)**, `ScheduleMeetingsDialog.test.tsx` **379 insertions(+)**. This
  does **not** match the dispatcher's own stated committed diffstat, **185+/12-** for the `.tsx` file
  — a 12-line discrepancy. Resolve which is right against the actual commit (§5 below); do not silently
  pick one.

## 4. Priority 1 — replay both mutations independently (do this first)

Do not accept "confirmed RED, restored" from the worker's own worktree run. Re-run both, in your own
worktree (item 23), against commit `5884488`.

**If you invoke `.claude/skills/mutation-replay/scripts/replay.py` for either of these, do not trust an
`UNTRUSTWORTHY: the mutated run executed no tests` verdict either way** — `T612` is a filed, confirmed
defect in that script's summary parser for focused `-t` runs. Read the actual test-runner transcript
yourself and judge red/green from that, exactly as the worker claims to have done.

**Mutation 1 (regression proof, worker packet §6 steps 1-4).** In `ScheduleMeetingsDialog.tsx`'s
`handleSubmit`, revert the edit branch's call from `buildEditDesiredFutureSessions(...)` back to
`buildEventSessionsPayload(sessionDates, startTime, endTime, '')` (currently the call site immediately
after the `// T611 -- time resolution changed...` comment, inside the `initialData !== undefined`
branch — locate by content, not a line number, since this file has moved before). Run:
```
npx vitest run src/pages/meetings/ScheduleMeetingsDialog.test.tsx -t "T611 regression proof"
```
Expect a real `getTime()` mismatch (`AssertionError: expected <divergent-1's instant> to be
<divergent-2's instant>`, or similar — the worker's own reported failure was
`expected 1790024400000 to be 1790031600000`). Restore, re-run the full file, confirm 70/70 green.

**Mutation 2 (confirmation-suffix proof, worker packet §6 steps 5-8).** Revert the `AlertDialog`'s
`description` prop call site (`buildEditConfirmationDescription(pendingEditSave.plan,
timeFieldsTouched)`) back to the one-argument form,
`buildEditConfirmationDescription(pendingEditSave.plan)`. Run:
```
npx vitest run src/pages/meetings/ScheduleMeetingsDialog.test.tsx -t "T611 confirmation suffix"
```
Expect the rendered `AlertDialog`'s own `textContent` to no longer contain "overwritten" (a real DOM
assertion failure, not a hang). Restore, re-run the full file, confirm 70/70 green.

## 5. Priority 2 — the two criteria that previously could not fail

These are the actual point of this check. Both were proven vacuous by `boss-arbiter` (D017) before a
worker ever touched this row; your job is to prove the **implemented** fix closes both gaps, not to
re-read the test source and assume it does.

### 5a. MAJOR-A — the three-assertion divergence-disclosure test

`ScheduleMeetingsDialog.test.tsx` has a `describe('T611 §3.3 divergence disclosure ...')` block with
three `it`s, all asserting against one shared `DIVERGENCE_DISCLOSURE_TEXT` constant:
1. `'1. present -- the divergent fixtures, zero time-field interaction'`
2. `'2. absent after touch -- the divergent fixtures, a time field edited'`
3. `'3. absent on a non-divergent series -- EDIT_INITIAL_DATA ..., zero interaction'`

D017's own finding was that a premise-gate round proved 1+2 alone are satisfiable even with the
divergence check **deleted entirely** (the warning rendering on every edit, divergent or not) — all
tests green. Assertion 3 is what closes that gap. **You must reproduce the exact mutation and confirm
assertion 3 alone reddens:**

In `ScheduleMeetingsDialog.tsx`, find the disclosure's render condition —
`{isEditMode && timesDivergeAcrossSessions && !timeFieldsTouched && (` immediately above the new §3.3
`Text` element. Mutate it to `{isEditMode && !timeFieldsTouched && (` (delete
`timesDivergeAcrossSessions &&` only). Run:
```
npx vitest run src/pages/meetings/ScheduleMeetingsDialog.test.tsx -t "T611 §3.3 divergence disclosure"
```
**Required outcome: assertion 3 fails, assertions 1 and 2 both still pass.** If all three pass, or if
1/2 also fail (meaning your mutation is not the one D017 describes), you have not reproduced the
premise-gate finding — do not report PASS on this criterion until you get the exact 3-fails/1-2-pass
shape. Restore and confirm 3/3 green again.

### 5b. MAJOR-B — the confirmation-suffix positive case must be at the real element

D017's finding was that v2 verified only that `buildEditConfirmationDescription`'s new parameter was
**inert** (compiles, never asserted). Confirm the fix closes this by checking **where** each of the two
required criteria is asserted, not just that they exist:
- **Criterion (i), the positive case, must be asserted at the real `AlertDialog` DOM element** — the
  test named `"T611 confirmation suffix (D017 ruling 4(b)/MAJOR-B criterion i): ..."` must call
  `findAlertDialogElement()` (or equivalent — a real `document.querySelector` against the rendered
  `dialog[role="alertdialog"]`) and check its `textContent`, **not** call
  `buildEditConfirmationDescription(...)` directly. If this criterion is asserted only via a direct
  function call, it is the exact vacuity D017 found and this is a FAIL on this criterion regardless of
  what Priority 1's mutation 2 showed (a mutation redddening a badly-anchored assertion is still a
  weak proof — confirm the anchor, don't just trust the red/green result).
- **Criterion (ii), the untouched-path byte-for-byte reproduction, may legitimately be unit-level** —
  the packet explicitly permits `buildEditConfirmationDescription(plan, false)` compared against the
  one-argument call. Confirm this exists and that the pre-existing `AC11`/`AC12` tests (in the
  `describe('buildEditConfirmationDescription (rule 6, AC11/AC12)', ...)` block) are byte-for-byte
  unmodified — diff-confirm, not by re-reading.

## 6. Priority 3 — frozen scope, verified by diff, not by eye

Run, against the real commit range:
```
git diff 1e2f2b6 5884488 --stat
```
**Must show exactly three paths**: `src/pages/meetings/ScheduleMeetingsDialog.tsx`,
`src/pages/meetings/ScheduleMeetingsDialog.test.tsx`, `docs/swarm/active/T611-worker-output.md`.
Reconcile the `.tsx` file's actual insertion/deletion counts against **both** the dispatcher's stated
185+/12- and the worker's self-reported 197+/12- (§3 above) — report the real number and note which
of the two prior figures was correct, or that neither was.

Then, specifically:
```
git diff 1e2f2b6 5884488 -- src/lib/supabase/loaders/meetings.ts
git diff 1e2f2b6 5884488 -- src/pages/meetings/MeetingsList.tsx src/pages/meetings/MeetingsList.test.tsx
```
Both must be **empty**. These matter more than most Forbidden-file checks in this project: they are
`T613`'s and `T605`'s territory, and this packet's own scope claims depend on them being untouched.

```
git diff 1e2f2b6 5884488 -- src/pages/meetings/ScheduleMeetingsDialog.tsx | grep -n '^@@'
```
Confirm no hunk's line range overlaps `computeMeetingSeriesReconcilePlan`'s definition (currently
`:614-640`), the `:598-612` doc comment ("Duplicate `session_date`..."), `buildEventSessionsPayload`'s
own body (`:475-488`), or the `interface PendingEditSave { ... }` block (currently `:818-822` — confirm
it still has exactly the three fields `eventId`, `plan`, `desiredFutureSessions`, no new field added).
Locate all four by content if line numbers have drifted, per this project's own citation discipline.

```
git diff 1e2f2b6 5884488 -- src/pages/meetings/ScheduleMeetingsDialog.test.tsx | grep -c '^-'
```
Expect exactly **1** (the `--- a/...` diff header line only) — i.e., **zero actual deletions**. Then
confirm the `RECONCILABLE_SESSION_A`/`_B`/`PAST_SESSION`/`EDIT_INITIAL_DATA` fixture block is untouched
(no hunk touching that region) — these are `T613`'s territory and this packet's own MAJOR-A assertion 3
depends on `EDIT_INITIAL_DATA` being exactly what it already was.

## 7. Priority 4 — independent gates, `$?` on the bare command, never piped

Do not reuse the worker's reported numbers. Stand up your own worktree at `1e2f2b6` and derive a fresh
baseline, then compare to `5884488`:
```
git worktree add <path> 1e2f2b6
# (symlink node_modules, do not npm install fresh, matching this project's own convention)
npm run typecheck; echo "EXIT:$?"
npm run format:check; echo "EXIT:$?"
npm run lint > lint_baseline.txt 2>&1; echo "EXIT:$?"
npm test > test_baseline.txt 2>&1; echo "EXIT:$?"
```
Repeat at `5884488`. Confirm typecheck/format/lint/test all exit 0 at the final commit, and:
- **Lint: verify the +1 by rule and file, not by count alone.** Grep both lint outputs for
  `ScheduleMeetingsDialog.tsx` and confirm the delta is exactly one additional
  `react-refresh/only-export-components` warning, on the new `export function
  buildEditDesiredFutureSessions` line specifically (not some other file, not a different rule). The
  worker's own explanation (one new non-component export vs. the packet's own reference build's two) is
  plausible but must be confirmed against the actual lint output, not accepted as narrative.
- **Tests: derive your own before/after counts independently**, both by `vitest`'s own summary and by
  `grep -cE "^\s*it\(|^\s*test\(" src/pages/meetings/ScheduleMeetingsDialog.test.tsx` at both commits.
  Confirm both shapes agree with each other and with the claimed 2088→2101 (+13) full-suite delta.

## 8. Priority 5 — sabotage / scope, against `1e2f2b6`

Beyond §6's targeted checks, confirm via the same `git diff 1e2f2b6 5884488 --stat` that **nothing**
touches: `.claude/**`, `docs/swarm/task-ledger.md`, `docs/swarm/verification-log.md`,
`docs/swarm/dispute-log.md`, `docs/swarm/constitution.md`, any `supabase/migrations/**` file, or any
`src/` file other than `ScheduleMeetingsDialog.tsx`/`.test.tsx`. If anything else appears in the stat
output, that is a BLOCKER regardless of how small.

## 9. Context — do not misreport intended design as a defect

Three consequences are **disclosed and deliberate** in the worker packet (§3.4), not new defects
introduced by this diff:
1. Change-then-change-back still latches `timeFieldsTouched` and rewrites on save, even though nothing
   looks different on screen.
2. Touching only the Start field rewrites **both** Start and End for every future session (one shared
   flag, by design — packet §3.4's own rationale).
3. Touching only Start can persist an inverted span (End before Start). **Pre-existing, filed as
   `T614`, explicitly out of scope for this row.** Do not report this as a T611 regression.

**Exactly three named tests are pre-authorized to go red for calendar reasons under D017, and only
these three** — if any of them are observed red at `5884488`, that is not a stop condition, confirm the
cause (a Date-only fake clock set before 2026-08-10 in your own worktree per item 23) rather than
filing a finding against it:
1. `"opens prefilled from initialData, edit-mode title, and the 'already happened' disclosure (AC10, prefill)"`
2. `"AC10 (other direction): no disclosure line when every session is still reconcilable"`
3. `"AC-B1: saving with no schedule change preserves every toUpdate session's starts_at/ends_at as the SAME instant (heterogeneous-time no-op proof)"`

**Any other existing test going red is a full stop** — MAJOR-or-worse, not covered by the D017
exception.

**Both new user-facing strings are the worker's own wording, within packet-granted latitude.** The
§3.3 disclosure copy and the confirmation-suffix sentence ("Every upcoming session's time will be
overwritten...") were never dictated verbatim by the packet — judge them for DES-14 sentence case and
for clearly stating both halves (what happens if the coach does nothing vs. if they enter a new time),
not for matching a phrase that was never specified.

## 10. Constitution excerpts relevant to this check

- **Non-Negotiables:** "Existing tests must pass unless the boss explicitly approves a test update."
  "Every checker must inspect the actual artifact, not just the worker's summary." "No worker may mark
  its own work complete."
- **Item 19c:** verify your own citations before submitting — cite by symbol/test name, confirmed
  against the live file, not by a line number carried over from the worker packet or this document.
- **Item 20:** a deliberate deferral must be a filed ledger row, not a comment. `T614` (inverted span)
  is the test case here — confirm it is filed (it is; do not re-file it), and confirm the worker's own
  output states the deferral plainly rather than only in a source comment.
- **Item 21:** the worker's completion report must name a commit SHA whose existence you verify —
  confirmed here as `5884488`, parent `1e2f2b6`; check it, don't assume it.
- **Item 22:** explicit pathspecs only. If you inspect how the commit was staged, confirm no
  `git add -A`/`git add .`.
- **Item 23:** your own mutation experiments (§4, §5a) run in your own worktree, never the shared tree.
- **Item 26 (HEAVY definition):** "can a mistake here corrupt data, or lie to a user about their own
  data?" — yes on both halves (packet §0.4); this is why the full chain applies and a light check does
  not.

## 11. Failure severity — apply directly

- **BLOCKER:** any Forbidden-file/scope violation (§6, §8); either §4 mutation fails to redden for
  real; the §5a mutation fails to reproduce the exact 3-fails/1-2-pass shape; criterion (i) of MAJOR-B
  turns out to be asserted only via a direct function call rather than the real `AlertDialog` element;
  any of the three named D017 tests' *absence-handling* logic is broken (as opposed to the tests
  themselves going red for the pre-authorized calendar reason); any other existing test regressed;
  broken build/typecheck/lint-errors.
- **MAJOR:** a criterion claimed satisfied that is actually vacuous or weakly anchored in any other way
  not already listed as BLOCKER; an undisclosed deviation from packet §3's design; the unresolved
  185+/12- vs. 197+/12- diffstat discrepancy, if it turns out to hide an actual scope difference rather
  than a measurement error.
- **MINOR:** a real but low-consequence gap not already covered by the `T614`/consequence-1/consequence-2
  disclosures.
- **NIT:** cosmetic only (e.g., wording quibbles within the packet's own granted latitude — do not
  raise these above NIT).

## 12. Required checker output

Per the constitution's Evidence Requirements:
- files inspected
- commands run, including the full `git diff 1e2f2b6 5884488` invocations and every mutation applied
  and reverted
- relevant output — paste the real RED/GREEN transcripts for §4 and §5a's mutations verbatim, not a
  paraphrase
- pass/fail per criterion (both priority-2 criteria explicitly separated from the rest)
- exact failure reason, if any
- severity classification per finding (§11)
- recommended next action

**Restated: PASS/FAIL/REVISE verdict only. No merge, no ledger update, no verification-log entry, no
treating T611 as closed.**
