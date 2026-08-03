# T330 — worker output

**Branch:** `claude/t330-work`, created from `claude/t330-orphan-events` (commit `ab02dd6`) in worktree
`.../scratchpad/t330-work` (git worktree, per the packet's setup instructions — the shared checkout at
`/home/user/volt_task_tracker_rewrite` was never touched).

**Commit SHA:** `12c3df59002ad8c2a8f37726562293284feb1340`

**Allowed files touched (exactly these two, per §2):**
- `src/pages/outreach/OutreachList.tsx`
- `src/pages/outreach/OutreachList.test.tsx`

No other file was touched or staged. `pages/reports/**`, `loaders/reports.ts`, `loaders/attendance.ts`
were never opened for write.

---

## 1. Commit proof — committed blob, not just working tree

Two commits landed the work (both new commits, never an amend):

```
12c3df5 test(T330): add single-orphan buildEventGroups case for C2's own fixture warning
08618f0 feat(T330): a dateless outreach event is visible, dashed, and fixable
ab02dd6 docs(T330): fold gate round-2 errata; packet is DISPATCH-ready   <- branch point
```

`git status --porcelain` at the final state is empty (clean tree). The diff is measured **against the
commit**, not the tree:

```
$ git diff ab02dd6 HEAD --stat
 src/pages/outreach/OutreachList.test.tsx | 309 ++++++++++++++++++++++++++++++-
 src/pages/outreach/OutreachList.tsx      | 107 +++++++++--
 2 files changed, 399 insertions(+), 17 deletions(-)
```

Non-empty, two files, both allowed. This is `git diff <branch-point-commit> <HEAD-commit>`, not a
working-tree diff — the second commit (`12c3df5`) exists specifically because I found a gap (§6/C2
below) *after* the first commit and wanted the fix landed as history, not lost to an uncommitted edit
(the same T142 failure mode the packet warns about).

---

## 2. All six gates — `.env.local` ABSENT, real output, against baseline (0 errors/360 warnings, 76
files/1850 tests)

`ls .env.local` → `No such file or directory`, confirmed before every gate run below.

### Gate 1 — `npx tsc --noEmit`
```
(no output)
```
**Exit 0.**

### Gate 2 — `npx vite build`
```
dist/assets/index-DvF643JY.js                 675.05 kB │ gzip: 198.96 kB
(!) Some chunks are larger than 500 kB after minification. ...
✓ built in 5.97s
```
**Exit 0.** The 500kB-chunk advisory is pre-existing (unrelated to `OutreachList.tsx`, present at the
branch point too — same bundle entry, same warning, not new).

### Gate 3 — `npx prettier --check "src/**/*.{ts,tsx}" "!src/theme/volt.ts" "*.{ts,js,json,html}"`
```
Checking formatting...
All matched files use Prettier code style!
```
**Exit 0.**

### Gate 4 — `npx eslint .`
```
✖ 360 problems (0 errors, 360 warnings)
  0 errors and 1 warning potentially fixable with the `--fix` option.
```
**Exit 0. 0 errors, 360 warnings — identical to baseline, no rise.** The two new `CoachEventDateCell`
and `StudentOutreachEventRow` edits added no new export shapes, so no new
`react-refresh/only-export-components` warnings were introduced; the 26 pre-existing warnings in
`OutreachList.tsx` (all that class, all pre-existing at unrelated exported pure functions) are
unchanged in count.

### Gate 5 — `npx vitest run` (full suite)
```
 Test Files  76 passed (76)
      Tests  1859 passed (1859)
```
**Exit 0 (confirmed separately: `npx vitest run > /dev/null 2>&1; echo $?` → `0`).**

Baseline was 76 files / 1850 tests. Delta is **+9 tests, +0 files** (all new tests landed inside the
already-existing `OutreachList.test.tsx`):
- 4 new pure-function tests: C2's single-orphan fixture, C4 (two-dateless-plus-dated, no throw), C5
  (`past` with ≥2 entries), C9 (`formatEventDateRangeLabel([])`).
- 5 new DOM tests: C11 × 2 (coach view, student/parent view), C6/C7/C8/C10 combined (desktop), C12
  (Edit path), C6/C7 narrow (in the T130 responsive describe block).
- The 2 packet-authorized test **amendments** (§6) are not counted as additions — same test count,
  changed assertions.

### Gate 6 — targeted run, exit code asserted directly
```
$ npx vitest run src/pages/outreach/OutreachList.test.tsx > gate6-targeted.log 2>&1; echo $?
0
...
 Test Files  1 passed (1)
      Tests  105 passed (105)
```
**Exit 0.** 105 = the file's own pre-existing count (96) + 9 new tests.

---

## 3. Every mutation from §8, run, with real red output

Process for every mutation below: mutate → run `npx vitest run
src/pages/outreach/OutreachList.test.tsx` → paste the real failure → `git checkout --
src/pages/outreach/OutreachList.tsx` (safe: work was committed first, per the packet's "commit before
mutating" rule) → confirm `git diff --stat` is empty before the next mutation.

### C1 — restore `if (eventSessions.length === 0) continue;`
```
 FAIL  ... > groups by EVENT ... pinned dateless entries first
 FAIL  ... > routes a zero-real-session event into upcoming, pinned first -- and still never into past
 FAIL  ... > two dateless events plus one dated event sort without throwing ...
 FAIL  ... > below 768px, a dateless row renders em-dash hours/count on the narrow stacked-card column ...
 FAIL  ... > C11 (coach view): an orphan-only season ... renders the row, not the EmptyState
 FAIL  ... > C11 (student/parent view): an orphan-only season renders the row, not the EmptyState
 FAIL  ... > C6/C7/C8/C10 (coach view, desktop): a dateless row renders em-dash hours/count + "Needs dates" badge ...
 FAIL  ... > C12: the inline "Edit" action opens the dialog on a dateless row ...
      Tests  8 failed | 96 passed (104)
```
(This run was before the C2 single-orphan test was added, hence 104 not 105 total — that test was
added immediately afterward, in response to C2's own result below.)

### C2 — route zero-session entries to `past`
```
 FAIL  ... > routes a zero-real-session event into upcoming, pinned first -- and still never into past
 TypeError: Cannot read properties of undefined (reading 'startsAt')
  ❯ OutreachList.tsx:1774:47   return bLast.startsAt.localeCompare(aLast.startsAt);
  ❯ Module.buildEventGroups OutreachList.tsx:1771:8
  ❯ OutreachList.test.tsx:648:32

 FAIL  ... > a single dateless event, with no other past-bucket entry to crash the comparator, still resolves to upcoming and never past
AssertionError: expected false to be true
  ❯ OutreachList.test.tsx:667:65   expect(upcoming.some((entry) => entry.event.id === 'solo')).toBe(true);

 FAIL  ... > two dateless events plus one dated event sort without throwing ...
AssertionError: expected [Function] to not throw an error but 'TypeError: Cannot read properties of …' was thrown
      Tests  6 failed | 99 passed (105)
```
**Note on this one:** the packet's own §8 warning for C2 predicted exactly what happened on my first
draft — the shared 3-event fixture (`e1`/`e2`/`e3`, where `e2` already occupies `past`) reddens via an
**uncaught `TypeError`** (2 entries in `past` invoke the crashing comparator), not via the
`past.some(...)` assertion itself. I added the dedicated single-orphan test (`solo`, no other
past-bucket entry) specifically so the assertion arm fires on its own terms too — visible above as the
second failure, a real `AssertionError`, not a crash. That addition is `12c3df5`.

### C3 — dateless entries compare equal to everything (`return 0`)
```
 FAIL  ... > groups by EVENT ... pinned dateless entries first
AssertionError: expected [ 'e1', 'e3' ] to deeply equal [ 'e3', 'e1' ]

 FAIL  ... > routes a zero-real-session event into upcoming, pinned first -- and still never into past
AssertionError: expected 'e1' to be 'e3'
  ❯ OutreachList.test.tsx:650:34   expect(upcoming[0].event.id).toBe('e3');
      Tests  2 failed | 103 passed (105)
```
Matches the gate's own recorded output (`expected 'e1' to be 'e3'`) exactly. Fails the assertion, does
**not** throw — matching the packet's own correction (v1's literal mutation stayed green; this reworded
one reddens correctly).

### C4 — remove the dateless guard from `upcoming`'s comparator
```
 FAIL  ... > groups by EVENT ... pinned dateless entries first
TypeError: Cannot read properties of undefined (reading 'startsAt')
  ❯ OutreachList.tsx:1757:18   return aNext.startsAt.localeCompare(bNext.startsAt);

 FAIL  ... > two dateless events plus one dated event sort without throwing ...
AssertionError: expected [Function] to not throw an error but 'TypeError: Cannot read properties of …' was thrown

 FAIL  ... > below 768px, a dateless row renders em-dash hours/count on the narrow stacked-card column ...
 FAIL  ... > C6/C7/C8/C10 (coach view, desktop) ...
 FAIL  ... > C12: the inline "Edit" action opens the dialog on a dateless row ...
TypeError: Cannot read properties of undefined (reading 'startsAt')
  ❯ OutreachList.tsx:1748:12 (inside useMemo, via CoachOutreachView render)
      Tests  6 failed | 99 passed (105)
```
A real `TypeError`, as the criterion requires. My dedicated 2-dateless-plus-1-dated pure-function test
needed exactly 2 entries in `upcoming` to invoke the comparator at all (stated in the test's own
fixture design).

### C5 — reverse the `bLast`/`aLast` operands
```
 FAIL  ... > past with >=2 entries still sorts most-recent-last-session-first (descending)
AssertionError: expected [ 'e7', 'e8' ] to deeply equal [ 'e8', 'e7' ]
      Tests  1 failed | 104 passed (105)
```
Isolated to exactly the intended new test — no baseline test had ≥2 `past` entries, so nothing else
could have caught this before.

### C6 (hours cell), desktop and narrow run SEPARATELY

**Desktop only** (narrow branch left untouched):
```
 FAIL  ... > C6/C7/C8/C10 (coach view, desktop): a dateless row renders em-dash hours/count + "Needs dates" badge ...
AssertionError: expected '...' to contain 'Planned—'
      Tests  1 failed | 104 passed (105)
```
The narrow test (`below 768px, a dateless row renders em-dash hours/count on the narrow stacked-card
column ...`) **stayed green** in this same run — proof the two branches are independently covered, not
that one assertion happens to catch both.

**Narrow only** (desktop branch reverted first):
```
 FAIL  ... > below 768px, a dateless row renders em-dash hours/count on the narrow stacked-card column, not "0h"/"0 students"
AssertionError: expected '...' to contain 'Planned—'
      Tests  1 failed | 104 passed (105)
```
The desktop test stayed green here. This is the exact "blind spot" the packet's own §8 note describes
— dashing only one branch leaves the other invisible to the suite, and I've now shown both directions
independently.

### C7 (count cell), desktop and narrow run SEPARATELY

**Desktop only:**
```
 FAIL  ... > C6/C7/C8/C10 (coach view, desktop) ...
AssertionError: expected '...' to contain 'Expected—'
      Tests  1 failed | 104 passed (105)
```

**Narrow only:**
```
 FAIL  ... > below 768px, a dateless row renders em-dash hours/count on the narrow stacked-card column ...
AssertionError: expected '...' to contain 'Expected—'
      Tests  1 failed | 104 passed (105)
```
Both isolated to exactly one test each, confirming the desktop/narrow separation for the count cell too.

### C8 — drop the "Needs dates" badge, coach and student run SEPARATELY

**Coach side** (`CoachEventDateCell`'s badge line removed — shared by both the desktop `date` column
and the narrow card, so this one edit covers both coach render paths):
```
 FAIL  ... > C11 (coach view): an orphan-only season ... renders the row, not the EmptyState
AssertionError: expected '...' to contain 'Needs dates'

 FAIL  ... > C6/C7/C8/C10 (coach view, desktop) ...
AssertionError: expected +0 to be 1   (needsDatesMatches.length)
      Tests  2 failed | 103 passed (105)
```
The student/parent `C11` test **stayed green** — proof the coach and student badge render paths are
independent code, not the same line doing double duty.

**Student side** (student view's own badge line removed):
```
 FAIL  ... > C11 (student/parent view): an orphan-only season renders the row, not the EmptyState
AssertionError: expected '...' to contain 'Needs dates'
      Tests  1 failed | 104 passed (105)
```
The coach `C11` test stayed green here — the reverse proof.

### C9 — `formatEventDateRangeLabel` returns `''` for `[]`
```
 FAIL  ... > an empty session array renders the honest "no sessions" copy, not a blank/undefined date
AssertionError: expected '' to be 'No sessions scheduled yet.'

 FAIL  ... > C11 (coach view) ...
 FAIL  ... > C11 (student/parent view) ...
 FAIL  ... > C6/C7/C8/C10 (coach view, desktop) ...
AssertionError: expected '...' to contain 'No sessions scheduled yet.'
      Tests  4 failed | 101 passed (105)
```
Reddens the direct pure-function pin **and** every DOM test that asserts the honest empty-session copy
in the page itself.

### C10 — apply dateless formatting unconditionally (all four cells + both badges forced `true`)
```
 FAIL  ... > populated state: dense per-event Upcoming/Past rows (UXD-02) ...
AssertionError: expected '...' to contain 'Planned3h'

 FAIL  ... > below 768px, every coach table collapses to a single stacked column ...
AssertionError: expected '...' to contain 'Planned3h'

 FAIL  ... > below 768px, a dateless row renders em-dash hours/count on the narrow stacked-card column ...
AssertionError: expected '...' to contain 'Planned2h'

 FAIL  ... > C6/C7/C8/C10 (coach view, desktop) ...
AssertionError: expected '...' to contain 'Planned2h'
      Tests  4 failed | 101 passed (105)
```
This mutation is broader than a single cell (I forced `isDateless`/the badge condition to `true`
everywhere at once, matching the criterion's own literal wording "apply dateless formatting
unconditionally"), so it reddens both my own new regression-guard assertions **and** the two
pre-existing populated-state/narrow tests that pin real dated-row numbers — those pre-existing tests
are themselves acting as regression guards here, which is exactly the point of C10.

### C11 — revert `hasAnyOutreach` to `sessions.length > 0`, coach and student run SEPARATELY

**Coach only:**
```
 FAIL  ... > C11 (coach view): an orphan-only season (real events, zero sessions) renders the row, not the EmptyState
AssertionError: expected '...' not to contain 'No outreach events yet'
      Tests  1 failed | 104 passed (105)
```
Student `C11` stayed green.

**Student only:**
```
 FAIL  ... > C11 (student/parent view): an orphan-only season renders the row, not the EmptyState
AssertionError: expected '...' not to contain 'No upcoming outreach yet.'
      Tests  1 failed | 104 passed (105)
```
Coach `C11` stayed green. **This is the headline-scenario criterion (§8's own framing) — verified
independently on both views, each with its own reddening test, neither riding on the other.**

### C12 — `buildInitialOutreachEventFromRow` non-total over `[]` (`sessions[0].sessionDate` dereference)
```
 FAIL  ... > C12: the inline "Edit" action opens the dialog on a dateless row, pre-filled, without crashing
AssertionError: expected [Function] to not throw an error but 'TypeError: Cannot read properties of undefined (reading 'sessionDate')' was thrown
      Tests  1 failed | 104 passed (105)
```
Isolated to exactly C12, matching the shape of the gate's own recorded `1 failed | 103 passed` (my
total is 105 not 104 because my final suite carries one more test than the gate's build did).

**After every mutation above, `git checkout -- src/pages/outreach/OutreachList.tsx` was run and `git
diff --stat` confirmed empty before the next mutation.** Final tree, after all twelve (plus sub-arm)
mutations: `git status --porcelain` empty, `git log --oneline -3` shows only the two real commits on
top of the branch point — no mutation was ever committed.

---

## 4. §5(c) — `past`'s comparator: what I did and why

**Left it completely unchanged**, per the packet's own instruction. I added a comment (not a runtime
guard) directly above it recording that its safety is **entirely derivative** of (a): after (a), a
zero-session event is routed into `upcoming` unconditionally, before `hasScheduled` is even evaluated,
so it can never reach `past` at all. The comment explicitly states this is *not* an independent guard
and must never be described as load-bearing on its own — naming T301's own recorded defect (an
unreachable guard documented as though it does real work) as the failure mode being avoided. I did
**not** add an `if (sessions.length === 0) return ...` defensive check inside the comparator itself;
that would be exactly the unreachable-guard anti-pattern the packet warns against, since after (a) that
branch can never execute. C5's mutation (reversing the operands) still reddens cleanly, proving the
comparator's real logic is exercised and correct, not merely untested.

---

## 5. §5(d) — `Reached` reasoning: agree

I agree with the packet's reasoning and did not build a dashed `Reached` value. `Reached` is gated on
`bucket === 'past'` at both render sites (`row.stats.reached !== null` inside a `bucket === 'past' &&
...` check, both the narrow card and the desktop `count` column). After (a), a zero-session event is
pinned into `upcoming` and can **never** be in the `past` bucket, so the `Reached` secondary line is
categorically unreachable for a dateless row regardless of any other change — independent of the second
fact the packet cites (`sumPeopleReached` returns `null` for an empty session list anyway, via
`completedSessions.length === 0`). I re-verified both gates by reading the current code (not just the
packet's citations) before relying on this: `bucket === 'past' && row.stats.reached !== null` appears
identically in both the narrow-card `StatCell` and the desktop `count` column's `StatCell`, and
`computeEventRowStats` always computes `reached: sumPeopleReached(completedSessions)`, where
`completedSessions = sessions.filter(...)` is `[]` for a dateless row. Building a dashed version would
be dead code with no test able to reach it honestly (a mutation that removed a dash on unreachable code
would never redden anything). The owner's "all three" numeric cells (hours, expected/attended count,
people reached) is satisfied by hours + count for a dateless row, matching the packet's own conclusion.

---

## 6. §5(g) — the orphan-only-season probe, before and after, both views

**Before (mutation: `hasAnyOutreach = sessions.length > 0`, the pre-T330 gate)** — captured live in
section 3 above (C11 coach/student mutation runs):

- **Coach view:** `container.textContent` contains `'No outreach events yet'` (the EmptyState) and does
  **not** contain `'Orphaned Coat Drive'` (the row) — confirmed by the reddened assertion
  `expected '...' not to contain 'No outreach events yet'` actually matching, i.e. the EmptyState WAS
  rendered.
- **Student/parent view:** same shape — `'No upcoming outreach yet.'` (the EmptyState) renders instead
  of the row.

**After (current code, `hasAnyOutreach = events.length > 0 || sessions.length > 0`)** — the two `C11`
tests, both green in the final suite:

- **Coach view:** `container.textContent` does **not** contain `'No outreach events yet'`, **does**
  contain `'Orphaned Coat Drive'`, `'No sessions scheduled yet.'` (the honest date-cell copy), and
  `'Needs dates'` (the badge) — the row rendered, fully formed, not a bare stub.
- **Student/parent view:** same four assertions, same result — `'No upcoming outreach yet.'` absent,
  the row and its badge present.

This is the headline-scenario fix: a season whose *only* event has zero sessions (the exact "failed
first create" case named in §1) now renders a real, actionable row on both surfaces instead of an
EmptyState that gives the coach nothing to click.

---

## 7. §6 — the two amended tests, before/after, plus the diff-grep

### Test 1 — `groups by EVENT (one entry per event, not per session) -- "upcoming" = any scheduled session`

**Before (v1, at `ab02dd6`):**
```ts
it('groups by EVENT (one entry per event, not per session) -- "upcoming" = any scheduled session', () => {
  const { upcoming, past } = buildEventGroups(events, sessions);
  expect(upcoming.map((entry) => entry.event.id)).toEqual(['e1']);
  expect(upcoming[0].sessions.map((session) => session.id)).toEqual(['e1-past', 'e1-future']); // ascending
  expect(past.map((entry) => entry.event.id)).toEqual(['e2']);
});
```

**After (renamed to add "pinned dateless entries first"):**
```ts
it('groups by EVENT (one entry per event, not per session) -- "upcoming" = any scheduled session, pinned dateless entries first', () => {
  const { upcoming, past } = buildEventGroups(events, sessions);
  expect(upcoming.map((entry) => entry.event.id)).toEqual(['e3', 'e1']);
  expect(upcoming[1].sessions.map((session) => session.id)).toEqual(['e1-past', 'e1-future']); // ascending
  expect(past.map((entry) => entry.event.id)).toEqual(['e2']);
});
```
`e3` now shares `upcoming` with `e1`, pinned first; the per-session assertion moved from index `[0]` to
`[1]`; `past` is byte-identical (`['e2']`), unchanged — the guard against §4's crash.

### Test 2 — `omits an event with zero real sessions from both buckets`

**Before:**
```ts
it('omits an event with zero real sessions from both buckets', () => {
  const { upcoming, past } = buildEventGroups(events, sessions);
  expect(upcoming.some((entry) => entry.event.id === 'e3')).toBe(false);
  expect(past.some((entry) => entry.event.id === 'e3')).toBe(false);
});
```

**After (renamed — "omits" asserting inclusion would be worse than no test at all):**
```ts
it('routes a zero-real-session event into upcoming, pinned first -- and still never into past', () => {
  const { upcoming, past } = buildEventGroups(events, sessions);
  expect(upcoming.some((entry) => entry.event.id === 'e3')).toBe(true);
  expect(upcoming[0].event.id).toBe('e3');
  expect(upcoming[0].sessions).toEqual([]);
  expect(past.some((entry) => entry.event.id === 'e3')).toBe(false);
});
```
The `upcoming.some(...)` polarity flipped from `false` to `true` (that's the reversal §6 authorizes);
two new assertions were **added** (pinned-first, empty `sessions`) — additions are not reversals and
were not counted as removed lines; the `past.some(...) === false` line is kept **byte-identical**, the
crash guard the packet named explicitly as "keep."

### Diff-grep, exactly as required

```
$ git diff ab02dd6 HEAD -- src/pages/outreach/OutreachList.test.tsx | grep '^-' | grep -E 'expect|toBe|toEqual|toHave'
-    expect(upcoming.map((entry) => entry.event.id)).toEqual(['e1']);
-    expect(upcoming[0].sessions.map((session) => session.id)).toEqual(['e1-past', 'e1-future']); // ascending
-    expect(upcoming.some((entry) => entry.event.id === 'e3')).toBe(false);
```
**Exactly 3 removed assertion lines, all from these two tests, nothing else.** No other test in the
file had an assertion removed, weakened, or skipped — every other change in the diff is a pure
addition (new `it()` blocks, new comments, new fixture helpers).

---

## 8. Anything in the packet that is wrong

One real gap, not a citation error: **§8's own C2 note undersold what "include a single-orphan fixture
variant" required.** The packet correctly predicted that C2's mutation reddens the *existing* 3-event
fixture test via an uncaught `TypeError` before the `past.some` assertion runs (confirmed exactly, see
section 3 above), and it said to "include a single-orphan fixture variant so the assertion arm itself
fires." What it did not spell out is that this has to be a **separate, dedicated test with its own
minimal fixture** (one event, zero sessions, nothing else in `past`) — my first pass at the two
authorized-amendment tests plus the shared 3-event fixture's C4 test did not produce this on their own,
because every fixture I had already built for other criteria happened to have ≥2 entries eligible for
`past` under this specific mutation (either the pre-existing `e2`, or my own C4 fixture's two dateless
events landing there together). I added a fourth, deliberately single-entry pure-function test
(`a single dateless event, with no other past-bucket entry to crash the comparator, still resolves to
upcoming and never past`) specifically to close this — captured as a separate commit (`12c3df5`) after
the first commit, once mutation-testing C2 surfaced the gap. This is a real, if narrow, finding: the
packet flagged the *symptom* (crash-before-assertion) correctly but did not flag that the fix requires
a fixture shape genuinely absent from every other criterion's own test, which cost me one extra
commit cycle to catch via the mutation matrix rather than up front. Everything else in the packet
(citations, line numbers, the ten inherited v1 criteria's mutations, the four StatCells' locations, the
`astryx-api.md` Badge variant citation, the DES-12 empty-state non-regression, the `Reached`
unreachability argument) verified exactly as written against the live code in this worktree.

---

## 9. Out of scope, restated

Per packet §9, T330's other half — an orphan event's adult-volunteer figures double-counting in season
totals (`reports.ts:401-411`'s session-less `events` query, `HoursTab.tsx:593-596`'s unfiltered sum) —
was **not** touched. `pages/reports/**` and `loaders/reports.ts` are W4-owned and outside this task's
Allowed Files. Making the orphan row visible and Edit-able (this task) gives the coach the ability to
fix or delete the duplicate; it does not correct the totals themselves. That remains open, filed as its
own row per the packet's own instruction.
