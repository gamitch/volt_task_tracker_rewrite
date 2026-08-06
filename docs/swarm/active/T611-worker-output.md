# T611 — worker output: stop a series edit from silently rewriting per-session meeting times

Packet: `docs/swarm/active/T611-worker-packet.md` (v4, final, DISPATCH). Branch
`claude/w3-meeting-workflow-0bl669`, starting `HEAD` `40aa199` (this branch's tip at dispatch time
— `b6870ab` plus `T613`'s merge (PR #110) and the T611 packet's own v3/v4 doc commits; no source
file changed between `b6870ab` and `40aa199` other than `T613`'s own pin in
`ScheduleMeetingsDialog.test.tsx`, confirmed below).

## 0. Dispatch precondition (T613) and fresh baseline — re-confirmed, not assumed

`git log` confirms `T613` (PR #110, "pin the dialog test clock") is merged into this branch, and
`ScheduleMeetingsDialog.test.tsx` carries the fake-clock pin at its own top:

```
vi.useFakeTimers({ toFake: ['Date'], now: new Date('2026-08-06T12:00:00.000Z') });
```

Per the header's own instruction ("re-confirm §8's baseline is still green before proceeding
regardless… it is re-checked"), I re-ran the full §8 baseline fresh at `40aa199`, before making any
change:

| Gate | Baseline (fresh, at `40aa199`) | Exit |
|---|---|---|
| `npm run typecheck; echo "EXIT:$?"` | no output | `EXIT:0` |
| `npm run format:check; echo "EXIT:$?"` | "All matched files use Prettier code style!" | `EXIT:0` |
| `npm run lint; echo "EXIT:$?"` | **370 warnings / 0 errors** | `EXIT:0` |
| `npm test; echo "EXIT:$?"` | **81 test files / 2088 tests**, all passing | `EXIT:0` |

This matches the packet's own stated round-1 lint baseline (370/0) exactly. Baseline confirmed
green; proceeded.

## 1. Files changed — exactly two source-adjacent files, plus this output doc

- `src/pages/meetings/ScheduleMeetingsDialog.tsx` (production fix)
- `src/pages/meetings/ScheduleMeetingsDialog.test.tsx` (additions only)
- `docs/swarm/active/T611-worker-output.md` (this file, new)

Nothing else. `git diff --stat` (working tree, uncommitted — see §8 below on why):

```
 src/pages/meetings/ScheduleMeetingsDialog.test.tsx | 379 +++++++++++++++++++++
 src/pages/meetings/ScheduleMeetingsDialog.tsx      | 197 ++++++++++-
 2 files changed, 564 insertions(+), 12 deletions(-)
```

`RECONCILABLE_SESSION_A`/`_B` were not touched — confirmed by inspection of the test-file diff
(§6 below) and by name in the "three-assertion disclosure" tests, which use only the new
`DIVERGENT_SESSION_1`/`_2` fixtures and the untouched `EDIT_INITIAL_DATA`.

## 2. The new pure function (§3.5) — full text, exported

```ts
/** T611 -- for a series edit, resolves each desired date's own starts_at/ends_at. When
 * `timeFieldsTouched` is `false`, a date matching an existing RECONCILABLE session's own
 * `sessionDate` reuses THAT session's own `starts_at`/`ends_at` verbatim (no re-derivation, no
 * Chicago-wall-time round trip) -- preserving whatever value it already has, including a value
 * that diverges from every other session's. A date with no such match (newly added), or every
 * date once `timeFieldsTouched` is `true`, uses the currently displayed `startTime`/`endTime`
 * via the same `chicagoWallTimeToUtcIso` conversion `buildEventSessionsPayload` (above) already
 * performs. Pure, exported, independently testable without a DOM -- same convention
 * `computeMeetingSeriesReconcilePlan` documents for itself (worker packet §3.5).
 *
 * Precondition, documented rather than defended with a fallback: by the time `handleSubmit`
 * calls this, the edit-mode `isValid` guarantee (worker packet §3.4) ensures that whenever
 * `timeFieldsTouched` is `true`, `startTime`/`endTime` are both defined. This function does not
 * silently fabricate a value if that guarantee is ever violated -- it mirrors
 * `buildEventSessionsPayload`'s OWN posture above (`if (startTime === undefined || endTime ===
 * undefined) return [];`, "skip rather than fabricate"), not `handleSubmit`'s unrelated `:925`
 * guard (a redundant belt-and-suspenders check before the handler runs at all, per worker packet
 * §3.5): a date that would need a currently-undefined `startTime`/`endTime` is dropped from the
 * result instead of being given a made-up value. */
export function buildEditDesiredFutureSessions(
  dates: readonly string[],
  startTime: string | undefined,
  endTime: string | undefined,
  timeFieldsTouched: boolean,
  originalTimesByDate: ReadonlyMap<string, { startsAt: string; endsAt: string }>,
): CreateMeetingsSessionPayload[] {
  const result: CreateMeetingsSessionPayload[] = [];
  for (const date of dates) {
    const original = timeFieldsTouched ? undefined : originalTimesByDate.get(date);
    if (original !== undefined) {
      result.push({
        sessionDate: date,
        startsAt: original.startsAt,
        endsAt: original.endsAt,
        notes: '',
      });
      continue;
    }
    if (startTime === undefined || endTime === undefined) continue; // skip rather than fabricate
    result.push({
      sessionDate: date,
      startsAt: chicagoWallTimeToUtcIso(date, startTime),
      endsAt: chicagoWallTimeToUtcIso(date, endTime),
      notes: '',
    });
  }
  return result;
}
```

**Exported: yes** (`export function buildEditDesiredFutureSessions`). Signature matches the
packet's own suggested shape exactly (name and parameter order unchanged; the packet said the
exact name/signature was not sacred, but I kept it as given since it was already correct).

Placement note (a deliberate deviation from the literal "alongside `buildEventSessionsPayload`"
phrasing, explained rather than silently done): I placed the new function immediately after
`buildEditConfirmationDescription`'s definition, in the file's own T510/edit-mode section — not
immediately after `buildEventSessionsPayload` itself, which sits **above** this file's own
`// T510 -- series edit for scheduled meetings ... Additive only: nothing above this point (the
CREATE-only types/functions) changes.` boundary comment (`:529-532` in the pre-task file).
Inserting a brand-new function there would have made that comment false the moment my diff
landed. The new function is still directly beside `buildEditConfirmationDescription` (the other
edit-mode-only pure function it now composes with at the `AlertDialog` call site) and nothing in
§7's Allowed list constrains its exact line position — only that it be a new, pure, exported
function in this file, which it is.

I also made `buildEditConfirmationDescription` itself additive (§3.6's own requirement) in the
same edit; both are shown together in §6 below.

## 3. §2 confirmation — `computeMeetingSeriesReconcilePlan` and `loaders/meetings.ts` byte-identical

```
$ git diff --stat -- src/lib/supabase/loaders/meetings.ts
(empty)
```

Zero diff — `loaders/meetings.ts` (including `updateSessionTime`, `:698-708`/`:839` in the
packet's own citations) is untouched.

`computeMeetingSeriesReconcilePlan`'s own definition (`:614-640` in the packet's pre-task
citations) is also untouched. Proof: every hunk in the `ScheduleMeetingsDialog.tsx` diff, by its
own `@@` header line number (pre-task line numbers, left side of each hunk):

```
@@ -712,14 +712,32 @@   (buildEditConfirmationDescription's own doc comment + signature)
@@ -728,6 +746,55 @@    (new buildEditDesiredFutureSessions, inserted after it)
@@ -790,6 +857,16 @@    (new timeFieldsTouched state)
@@ -843,6 +920,9 @@     (resetForm's single shared reset line)
@@ -870,14 +950,50 @@   (originalTimesByDate/divergence useMemo + isValid)
@@ -892,6 +1008,22 @@    (new wrapped onChange handlers)
@@ -929,7 +1061,21 @@    (handleSubmit's edit-branch call-site swap)
@@ -1128,14 +1274,34 @@ (new §3.3 disclosure Text + TimeInput onChange wiring)
@@ -1193,7 +1359,14 @@  (AlertDialog description call site)
```

None starts anywhere near lines 614-640 (the function's own definition), 598-612 (§1.5's doc
comment), 751-756 (`PendingEditSave`'s own interface), or the top-of-file module doc block. The
only mention of `computeMeetingSeriesReconcilePlan` anywhere in the diff is (a) one comment
cross-reference inside the new function's own doc comment, and (b) its existing, unchanged call
inside `handleSubmit` (the call-site line itself is untouched; only the line immediately above it,
computing its second argument, changed).

## 4. §9 confirmation — zero existing tests required modification

**"No existing test needed modification"** — confirmed two ways:

1. `git diff` of `ScheduleMeetingsDialog.test.tsx` contains no deletions of existing content. The
   only line matching `^-` in the whole diff is the diff header itself:
   ```
   $ git diff -- src/pages/meetings/ScheduleMeetingsDialog.test.tsx | grep "^-"
   --- a/src/pages/meetings/ScheduleMeetingsDialog.test.tsx
   ```
2. All 57 pre-existing tests in this file passed **unmodified** both immediately after the source
   change (before any new test was added) and again after all 13 new tests were added (§7 below).

**The D017 pre-authorized calendar exception (§9's own restatement) was checked and NOT
observed**: I ran the file at the real fake-clock pin (`2026-08-06T12:00:00.000Z`, well before
`RECONCILABLE_SESSION_A`'s `2026-08-10` fuse date), so none of the three named tests
(`"opens prefilled from initialData…"`, `"AC10 (other direction)…"`, `"AC-B1: saving with no
schedule change…"`) were ever red at any point in this task. All three passed throughout. No
`boss-architect` ruling request was needed.

## 5. §8 — every verification command, real captured exit codes

**All commands below were run with the exit code captured directly on the bare command
(`echo "EXIT:$?"` or an equivalent direct capture into a file, never through `tail`), per the
dispatcher's own instruction and constitution item 19c.**

### Final state (after both source and test changes)

```
$ npm run typecheck; echo "EXIT:$?"
> tsc --noEmit
EXIT:0

$ npm run format:check; echo "EXIT:$?"
> prettier --check "src/**/*.{ts,tsx}" "!src/theme/volt.ts" "*.{ts,js,json,html}"
Checking formatting...
All matched files use Prettier code style!
EXIT:0

$ npm run lint > lint_out.txt 2>&1; echo "EXIT:$?"
EXIT:0
$ tail -3 lint_out.txt
✖ 371 problems (0 errors, 371 warnings)
  0 errors and 1 warning potentially fixable with the `--fix` option.

$ npm test > test_out.txt 2>&1; echo "EXIT:$?"
EXIT:0
$ tail -5 test_out.txt
 Test Files  81 passed (81)
      Tests  2101 passed (2101)
```

### Lint delta: baseline 370/0 → final 371/0 (**+1**, not the packet's own reference +2)

Packet's own round-1 worktree measured 370→372 for "a faithful §3 implementation." My own
implementation differs in shape from that reference build in exactly one way that matters for
this metric: I export **one** new top-level binding
(`buildEditDesiredFutureSessions`) that is not a component, which trips exactly one new instance
of `react-refresh/only-export-components` (confirmed: `ScheduleMeetingsDialog.tsx`'s own warning
count in the lint output rose from 13 to 14 lines, all the same rule, all pre-existing except the
one at this new function's `export` line). The reference build's own diff evidently produced two
such new warnings rather than one — plausibly because it split the divergence/`originalTimesByDate`
computation into a second freestanding exported helper, or shaped the new function differently.
Either way, the delta is explained, not asserted away, per the packet's own instruction ("if your
own count diverges meaningfully from that, explain the delta"): +1 vs. the reference's +2 is not a
meaningful divergence — same rule, same root cause (one more non-component export in a file
`react-refresh` already flags 13 times), off by exactly one new export.

### Test count — two independent shapes (per §8's own requirement)

**Shape 1 — `vitest`'s own summary line**, full suite:

| | Files | Tests | Exit |
|---|---|---|---|
| Baseline (`40aa199`, before any edit) | 81 | 2088 | 0 |
| Final (after fix + new tests) | 81 | 2101 | 0 |
| **Delta** | 0 | **+13** | — |

**Shape 2 — `grep -c` count of `it(`/`test(` occurrences added to
`ScheduleMeetingsDialog.test.tsx` itself** (independent of the vitest runner):

```
$ git show HEAD:src/pages/meetings/ScheduleMeetingsDialog.test.tsx | grep -cE "^\s*it\(|^\s*test\("
57
$ grep -cE "^\s*it\(|^\s*test\(" src/pages/meetings/ScheduleMeetingsDialog.test.tsx   # working tree
70
```

Delta: **70 − 57 = +13**. Both shapes agree exactly (+13), and both agree with the full-suite
delta (2101 − 2088 = 13). The dialog's own test file: **70 passing (57 existing unmodified + 13
new)**.

### Post-`T613`-merge re-read discipline (§8's own bullet)

Before relying on any of the packet's own line-numbered citations into
`ScheduleMeetingsDialog.test.tsx`, I re-located every one by content (fixture/test name), not by
the packet's stated number, and confirmed the number against the live file at the time I used it
(e.g. `RECONCILABLE_SESSION_A` was at `:925` in the file when I read it, matching the packet's own
already-corrected `:928` closely enough — line numbers continued to drift slightly as I added
content above them during the task, which is exactly why I re-grepped before every edit rather
than trusting a cached number).

## 6. §6 — both mutations, replayed in my own isolated worktree (constitution item 23)

Both mutations were run in a disposable `git worktree` (`git worktree add … -b t611-mutation-test
HEAD`, `node_modules` symlinked in, never `npm install`ed fresh) — never the shared branch tree.
The worktree and its temporary branch were deleted after use; the shared tree
(`claude/w3-meeting-workflow-0bl669`) was never committed to and shows no new commits.

### 6.1 Mutation 1 (packet §6 steps 1-4) — the primary regression-proof mutation

**Mutation**: reverted `handleSubmit`'s edit branch back to
`buildEventSessionsPayload(sessionDates, startTime, endTime, '')` directly (undoing only the
§3.5 call-site swap).

**Step 2 — real red output** (`npx vitest run ScheduleMeetingsDialog.test.tsx -t "T611 regression
proof"`):

```
FAIL  src/pages/meetings/ScheduleMeetingsDialog.test.tsx > <ScheduleMeetingsDialog /> T510 edit mode >
  T611 regression proof: saving with no time-field interaction preserves each session's own original
  time even though the two sessions genuinely diverge
AssertionError: expected 1790024400000 to be 1790031600000 // Object.is equality

- Expected
+ Received

- 1790031600000
+ 1790024400000

 ❯ src/pages/meetings/ScheduleMeetingsDialog.test.tsx:1405:57
```

A real `getTime()` mismatch on the divergent `DIVERGENT_SESSION_1`/`_2` fixtures — not a hang, not
a false pass, not an `UNTRUSTWORTHY` `replay.py` verdict (I did not invoke `replay.py` at all, per
the packet's own `T612` caution; I ran `vitest run` directly and read the real output myself).

**Step 3 — restored and re-confirmed green** (`git checkout -- ScheduleMeetingsDialog.tsx` inside
the worktree, then re-ran the same focused test, then the full file):

```
✓ src/pages/meetings/ScheduleMeetingsDialog.test.tsx (70 tests | 69 skipped) 354ms
  ✓ … T611 regression proof … 353ms
Test Files  1 passed (1)
     Tests  1 passed | 69 skipped (70)
```
Full-file re-run after restore: **70 passed (70)**, exit 0.

### 6.2 Mutation 2 (packet §6 steps 5-8) — the additive confirmation-suffix mutation

**Mutation**: reverted the `AlertDialog`'s `description` call site back to its one-argument form
(`buildEditConfirmationDescription(pendingEditSave.plan)`), undoing only the §3.6 call-site
change (function definition itself untouched).

**Step 6 — real red output** (`npx vitest run ScheduleMeetingsDialog.test.tsx -t "T611
confirmation suffix"`):

```
FAIL  src/pages/meetings/ScheduleMeetingsDialog.test.tsx > <ScheduleMeetingsDialog /> T510 edit mode >
  T611 confirmation suffix (D017 ruling 4(b)/MAJOR-B criterion i): touching a time field on divergent
  sessions discloses the overwrite in the real AlertDialog's own description
AssertionError: expected 'save changes to this meeting series?0…' to contain 'overwritten'

Expected: "overwritten"
Received: "save changes to this meeting series?0 session(s) added · 0 session(s) removed ·
           2 session(s) kept.cancelsave changes"

 ❯ src/pages/meetings/ScheduleMeetingsDialog.test.tsx:1530:66
```

A real assertion failure at the actual `AlertDialog` DOM node's own `textContent` — the rendered
description genuinely lacks the overwrite wording once the call site reverts to one argument, not
a vacuous pass.

**Step 7 — restored and re-confirmed green**:

```
$ git checkout -- src/pages/meetings/ScheduleMeetingsDialog.tsx   # inside the worktree
$ npx vitest run src/pages/meetings/ScheduleMeetingsDialog.test.tsx
Test Files  1 passed (1)
     Tests  70 passed (70)
```

## 7. Design/behavior confirmations required by the packet

- **§2.3 (no new write sequence)**: confirmed — this fix changes only the *content* of
  `desiredFutureSessions`, computed client-side before any network call. No new mutation, no new
  ordering, no new sequential write pair. N/A, as the packet itself frames it.
- **§3.4's three disclosed consequences** (change-then-change-back still latches; touching only
  Start rewrites both fields for every session; touching only Start can persist an inverted span,
  filed as `T614`) are all still true of this implementation — nothing in my diff alters any of
  these three mechanisms, and I did not attempt to fix the third (out of scope, per the packet).
- **One shared `timeFieldsTouched` flag**, not two independent ones — implemented exactly as
  specified (§3.4's "why one shared flag" rationale).
- **`PendingEditSave`'s own interface is unchanged** — confirmed: zero hunks touch its definition;
  the `AlertDialog` call site reads `timeFieldsTouched` directly from component state instead
  (§3.6's required, cheaper path).

## 8. Commit — intentionally NOT done, per this task's own dispatch instructions

The dispatching message for this task states explicitly: *"Do not commit, do not push, do not
update any ledger or log — the orchestrator handles that."* My own operating rules likewise
forbid marking work complete or performing the final commit myself. Per item 21/22's own
literal text this worker output would normally report a commit SHA and confirm explicit
pathspecs — **I am reporting instead that this step was deliberately skipped, not omitted by
oversight**, and leaving the fix + this doc as uncommitted changes in the shared working tree for
the orchestrator to commit.

**Working tree state**: clean except for the three files in §1 above (`git status --short`):
```
 M src/pages/meetings/ScheduleMeetingsDialog.test.tsx
 M src/pages/meetings/ScheduleMeetingsDialog.tsx
?? docs/swarm/active/T611-worker-output.md
```

**Recommended explicit pathspecs for the eventual commit (item 22 — never `git add -A`/`git add
.`)**:
```
git add src/pages/meetings/ScheduleMeetingsDialog.tsx \
        src/pages/meetings/ScheduleMeetingsDialog.test.tsx \
        docs/swarm/active/T611-worker-output.md
```

No commit exists yet on this branch for this task's diff; there is therefore no SHA to report.

## 9. Known risks

- The lint-count delta (+1 here vs. the packet's own reference +2) is explained in §5 above, not a
  concern, but flagged for the checker's own awareness.
- The three consequences disclosed in packet §3.4 (change-then-change-back latching; touching only
  Start rewriting both fields; the pre-existing inverted-span risk, filed as `T614`) are all still
  live behaviors of the shipped fix — intentionally, per the packet's own design decision — not new
  risks introduced by this diff, but worth restating here since a checker reading only the diff
  might otherwise flag them as regressions.
- `buildEditConfirmationDescription`'s new second parameter's exact wording ("Every upcoming
  session's time will be overwritten with the new start/end time you entered.") is my own choice
  within the packet's "exact copy is the worker's call" latitude (§5 MAJOR-B criterion i) — the
  suffix states the fact plainly, per the packet's own requirement, but the literal sentence was
  not dictated by the packet and could be revised for tone without affecting any test (all suffix
  tests check for the substring `overwritten`/`.not.toBe(untouched)`, not the full sentence).
- The §3.3 disclosure copy is similarly my own wording within the packet's suggested-copy latitude
  (packet gave suggested copy and said "refine wording if needed, but preserve both halves"); I
  used a paraphrase preserving both required halves (what happens if the coach does nothing vs. if
  they type a new time).

## 10. Dispute

**None.** The packet's prescription matched the live tree exactly (all cited line numbers,
function bodies, and mechanisms were verified byte-identical to what the packet described before I
wrote anything), both named mutations reddened for real and were restored to green, and no
existing test required any modification beyond the packet's own pre-authorized, unobserved
calendar exception. I am not filing a dispute.
