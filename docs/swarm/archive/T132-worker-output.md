# Worker Output: T132 — OutreachList consolidation (shared hook + student/parent link parity)

**Status: NOT self-certified. This is the worker's own report; an independent checker decides pass/fail.**

## 0. Premise history (resolved) — read this first

**First pass of this task** was done against this worktree's branch as it
existed at the time, which turned out to be based on commit `2146255` — an
ancestor of `claude/swarm-plan-zl575z`, the branch T131 actually shipped on.
T131 had not landed in this worktree yet: `CoachEventTitleCell` still
rendered a plain `<Text>` title, `CoachEventActions` still carried a
separate "View details" `Link`, and the actions column was still whatever
width T130 shipped (not `pixel(128)`). I disclosed this in full at the time
rather than silently working around it, and did not touch the (at-the-time
unconverted) coach code, per the packet's own Forbidden Files instruction.

**The coordinator confirmed the fault was environmental** (this worktree was
created from the wrong base commit) and asked me to rebase onto
`origin/claude/swarm-plan-zl575z` and re-apply my own work on top. That is
what the rest of this document describes.

## 1. Rebase

```
$ git fetch origin
$ git stash push -u -m "T132 work before rebase onto claude/swarm-plan-zl575z"
$ git merge origin/claude/swarm-plan-zl575z
Updating 2146255..bdc0bae
Fast-forward
 ...
 src/pages/outreach/OutreachList.test.tsx           |   5 +-
 src/pages/outreach/OutreachList.tsx                | 271 +++++++++++------
 ...
 17 files changed, 2107 insertions(+), 91 deletions(-)
$ git stash pop
```

`2146255` (this worktree's old base) was confirmed an ancestor of
`origin/claude/swarm-plan-zl575z` (`git merge-base --is-ancestor` — clean),
so the merge itself fast-forwarded with no conflicts. The subsequent
`git stash pop` (needed because my own uncommitted edits touched the same
files T131 rewrote) auto-merged `src/pages/outreach/OutreachList.tsx` and
`src/pages/outreach/OutreachList.test.tsx` **cleanly, with no conflict
markers** — git's own three-way merge correctly interleaved T131's coach
`Table` rewrite with my disjoint student/parent hunks. One real conflict
occurred, in `docs/swarm/verification-log.md` (an append-only log; both
sides had appended a line at the same location — the incoming T131
verification entry, and my own stash's automated "[...] Worker finished"
hook line). Resolved by keeping **both** appended lines, in order — not a
substantive edit, a concatenation, since deleting either would lose real
log content. I did not touch anything else in that file, which stayed a
Forbidden File otherwise.

**I verified the merge produced the clean split the coordinator described**
(not just trusted the absence of conflict markers):
- `CoachEventTitleCell` (read directly, `OutreachList.tsx`): renders a real
  `<Link as={RouterLink} ... weight="semibold" maxLines={1} color="primary">`
  around the title — T131's shape, present and untouched by me.
- `CoachEventActions`: no longer contains any `<Link>` — T131 removed the
  standalone "View details" text entirely from the coach side.
- The actions column: `width: pixel(128)` (verified via `grep`).
- `StudentOutreachEventRow`: my title-as-link `<Link>` inside `ListItem`'s
  `label`, both my comment corrections, and my "known gap" disclosure
  comment are all present, exactly as I wrote them, with no duplication.
- `src/hooks/useIsNarrowViewport.ts`/`.test.tsx` and the
  `docs/swarm/astryx-api.md` annotation merged in untouched (as expected —
  disjoint from anything T131 touched).

Two of my own comments became **stale relative to the new, T131-present
state** and needed a second correction pass (not because the merge did
anything wrong, but because they were written against the pre-rebase branch
where T131 hadn't landed):
- `OutreachList.test.tsx`'s new assertion comment used to say "the coach
  view's own test above still asserts `toContain('View details')`" — false
  now; the coach test (line 1729) asserts `toBe('Community Food Bank Sort')`
  (T131's own version). Corrected to say the two now match.
- `OutreachList.tsx`'s `endContent`-comment used to say "the coach `Table`
  row still carries its own separate 'View details' `Link`... the two
  halves of this page do not yet agree" — false now; corrected to say they
  now agree, since T131's own coach-side change removed that Link too.

## 2. Files changed (final)

- `src/hooks/useIsNarrowViewport.ts` (new) — the extracted hook, unaffected
  by the rebase.
- `src/hooks/useIsNarrowViewport.test.tsx` (new) — the hook's own 6 tests,
  unaffected by the rebase.
- `src/pages/outreach/OutreachList.tsx` — hook import swap; student/parent
  title-as-link; two comment corrections (re-verified accurate post-rebase);
  one disclosure comment about the truncation gap (updated post-rebase to
  the "accepted, decided" framing — see §4).
- `src/pages/outreach/OutreachList.test.tsx` — one assertion amended, one
  assertion added (both in the pre-existing student/parent `it` block, its
  comment corrected post-rebase), **plus two new regression tests** (§3).
- `docs/swarm/astryx-api.md` — six new rows in the `# Link` props table,
  unaffected by the rebase.
- `docs/swarm/verification-log.md` — one merge-conflict resolution (both
  sides' appended lines kept, concatenated; no other edit).
- `docs/swarm/active/T132-worker-output.md` (this file).

No changes to any Forbidden File beyond the one disclosed, non-substantive
`verification-log.md` conflict resolution above.

## 3. The two coach regression tests (now added)

Now that T131 is genuinely present, both are straightforward and pass:

```tsx
describe('<OutreachList /> coach view -- T132 regression: coach title link accessible name', () => {
  it('the coach event title `<a>` carries no `aria-label` -- its accessible name is the title text itself', async () => {
    // ...
    expect(foodBankLink!.hasAttribute('aria-label')).toBe(false);
    expect(foodBankLink!.textContent).toBe('Community Food Bank Sort');
  });
});

describe('<OutreachList /> coach view -- T132 regression: actions column width', () => {
  it('the actions column (last <th>, header: "") carries the real post-T131 pixel(128) width', async () => {
    // located positionally: buildCoachOutreachColumns is not exported
    // (verified), and `key: 'actions'` is the last of the 6 columns it
    // returns (verified by reading the function).
    const actionsTh = ths[ths.length - 1];
    expect(actionsTh.getAttribute('style')).toMatch(/width:\s*128px/);
  });
});
```

(`src/pages/outreach/OutreachList.test.tsx`, new `describe` blocks right
after the "T130 Table column-alignment proof" block, lines 2394-2437.)

**Proof they genuinely discriminate**, per the coordinator's instruction —
ran them against the real pre-T131 file:

```
$ git show c8275c7:src/pages/outreach/OutreachList.tsx > .../OutreachList.tsx  # temporary swap
$ npx vitest run src/pages/outreach/OutreachList.test.tsx -t "T132 regression"

 FAIL  ... coach title link accessible name
 AssertionError: expected 'View details – Community Food Bank Sort' to be 'Community Food Bank Sort'

 FAIL  ... actions column width
 AssertionError: expected 'width: 420px; min-width: 420px;' to match /width:\s*128px/

 Tests  2 failed | 78 skipped (80)
```

Both fail against the pre-T131 file exactly as expected (title was a plain
`Text` reached only via the old "View details" link on that `href`; column
was `pixel(420)`, matching the packet's own citation). File swapped back
immediately afterward; confirmed both tests pass again on the real current
file (`2 passed | 78 skipped`).

## 4. Truncation — accepted, decided (not a follow-up)

Per the coordinator's explicit relay of a human-owner decision: **the lost
truncation is accepted project-wide, not a defect to fix, and I did not
propose or ship `labelLines={1}` or any `ListItemProps`-widening cast.**

Mechanism (unchanged from before the rebase, re-verified against
`Item.tsx:350-360` after the rebase too — vendored dependency, doesn't move
between branches):

```
350:  const isStringLabel = typeof label === 'string';
...
353:  const labelTruncateStyle =
354:    labelLines != null
355:      ? labelLines === 1
356:        ? styles.labelSingleTruncate
357:        : styles.labelMultiTruncate
358:      : isStringLabel
359:        ? styles.labelSingleTruncate
360:        : null;
```

`Item` only applies its own single-line-truncate style when `label` is a
plain string; a `ReactNode` label (my `<Link>`) gets none of it, so nothing
bounds the anchor's width and `maxLines={1}` on the inner `Text` can't
truncate on its own. `labelLines` itself is real on `Item` but absent from
`ListItemProps` (reachable only through `ListItem`'s own untyped
`...restProps` spread, `ListItem.tsx:211,255`) — a cast to reach it, in
exchange for a `clip` rather than a real ellipsis, is exactly the trade the
human owner ruled isn't worth it. I recorded this as an **ACCEPTED, DECIDED**
comment directly in the code (immediately above the `return` in
`StudentOutreachEventRow`), not a pending follow-up, citing the mechanism
and the ruling.

**`document.documentElement.scrollWidth === window.innerWidth` — measured
on the real, rebased page (real Chromium, throwaway rig, deleted before
finishing):**

| viewport | scrollWidth | innerWidth | holds? |
|---|---|---|---|
| 1440px | 1440 | 1440 | **yes** |
| 375px | 554 | 375 | **no** |

I want to be precise rather than round this up: **it holds at 1440px. It
does not hold at 375px.** I traced the 375px gap to a specific element (DOM
inspection, real Chromium): the `right`-edge-overflowing element is a
`Button` with text `"Mark attendance – Canned Food Drive"` inside
`endContent` — a `Button` this task did not touch (labels/children verbatim
per Trap 3). This is not the title `<Link>` — the title link itself measures
well within the row (169.97px in the real page at both widths, confirmed).

I also re-measured the SAME page as it existed right after the T131 rebase
but before my own student/parent change (`git show HEAD:...` at that point,
a second throwaway copy), to isolate what my own change did to this number:
before my change, `scrollWidth` at 375px was **760** (every row's own former
"View details – {title}" `Link` also overflowed the viewport, confirmed by
DOM inspection: right edges up to 759.7px across four rows). My change
brings that down to **554** — every one of those per-row overflows is gone;
the sole remaining offender is the one pre-existing, unrelated `Button`.
So: my own change measurably **improves** this number, and does not
introduce or worsen the 375px gap that's left — but I can't in good
conscience report "confirmed, holds at 375px" when my own measurement says
otherwise. Filing it here precisely instead.

**Weight/size/colour — student/parent title link's inner `Text` vs the
coach row's title `Text` (both on the real, rebased page):**

| | fontWeight | fontSize | color |
|---|---|---|---|
| Coach `CoachEventTitleCell` title span | `600` | `14px` | `rgb(10, 19, 23)` |
| Student/parent title link's inner span | `600` | `14px` | `rgb(10, 19, 23)` |

Identical — unaffected by the rebase (same numbers as my pre-rebase
measurement).

**Row height, before (post-T131/pre-T132) vs after (this task), same real
page, same fixture row:**

| viewport | food-bank row height, BEFORE | food-bank row height, AFTER |
|---|---|---|
| 1440px | `189` | `189` |
| 375px | `845` | `845` |

0px difference — well within the 2px tolerance. (One *other*,
untouched row's 375px height showed `495` in one run and `455` in another
across my two measurement passes; the food-bank row this task actually
changes was identical both times. I did not fully chase the other row's
number — flagged as an unverified loose end rather than dropped silently.)

**Accessible name / no `aria-label`, student/parent (real page,
"Community Food Bank Sort" row):** `<a href="/outreach/event-food-bank-sort">`,
`hasAttribute('aria-label')` → `false`, `textContent` → exactly
`"Community Food Bank Sort"`. Matches criterion 3.

## 5. Exact test lines amended/added (final, post-rebase)

`src/pages/outreach/OutreachList.test.tsx`:
- **Amended** (line 1767): `expect(foodBankLinks[0].textContent).toBe('Community Food Bank Sort');`
  — was `toContain('View details')` before this task; the comment above it
  now correctly says this matches T131's own coach-side assertion at line
  1729 (`toBe('Community Food Bank Sort')`), since both are now really true.
- **Added** (line 1774, same pre-existing `it` block): `expect(foodBankLinks[0].hasAttribute('aria-label')).toBe(false);`
- **Added** (new `describe` blocks, lines 2394-2437): the two coach
  regression tests from §3.

`src/hooks/useIsNarrowViewport.test.tsx` (new file): 6 tests.

## 6. Commands (criteria 10-11), post-rebase

```
$ npx tsc --noEmit
(clean, no output)

$ npx eslint .
✖ 352 problems (0 errors, 352 warnings)
0 errors and 1 warning potentially fixable with the `--fix` option.
```
(Note: the merge itself changed `eslint.config.js`/`vite.config.ts` to add
a `.claude` ignore, a `*.throwaway.*` vitest exclude, and other
pre-existing fixes from sibling tasks that landed on the branch in the
meantime — none of that is mine; I did not touch either config file. 352/0
matches what I measured both before and after applying my own changes on
top of the rebased base.)

```
$ npx vite build
✓ built in ~6-8s
(one informational "chunks larger than 500kB" notice, pre-existing, unrelated)

$ npm run format:check
Checking formatting...
All matched files use Prettier code style!

$ npx vitest run
Test Files  62 passed (62)
     Tests  1422 passed (1422)
```

**Baseline, on the rebased branch:** the coordinator stated `1414/61`. I
verified this myself — my own diff against the merge base (`git diff HEAD
--stat`, i.e. everything I added on top of the freshly-merged tree) totals
exactly `+6` tests / `+1` file from `useIsNarrowViewport.test.tsx`, plus
`+2` tests (no new file) from the two coach regression tests, plus the one
amended/one added assertion in the pre-existing student/parent test (no
count change from those two, since neither adds a new `it`). `1414 + 6 + 2 =
1422`, `61 + 1 = 62` — matches my measured final count exactly, so the
coordinator's stated baseline is internally consistent with what I
independently observe. No anomaly to report.

## 7. Known risks / unverified items (final)

- **375px `scrollWidth`/`innerWidth` mismatch persists** (§4) — confirmed
  unrelated to this task's own change (traced to a pre-existing,
  unmodified `Button`), and confirmed this task's change reduces the total
  overflow there (`760` → `554`), but I'm not asserting it's fully
  "resolved" since it factually isn't at 375px. This is the one place where
  my measurement doesn't match the literal wording of the "confirm ...
  holds ... at 1440px and 375px" instruction, and I'm surfacing that
  precisely rather than rounding it up.
- **The `495`-vs-`455` discrepancy** on one untouched, non-food-bank row's
  375px height between two measurement runs (§4) — not chased further; the
  row this task actually changes was identical (0px diff) across both runs.
- Disclosed residual gap from the packet itself, unchanged: the "Mark
  attendance – {title}" `Button`'s visible text still repeats the row
  title, not fixed here, per explicit packet instruction (this is the same
  `Button` responsible for the 375px overflow above, incidentally).
- Truncation loss is now recorded as **accepted, decided** (§4), per
  explicit relayed instruction from the human owner — not something I'm
  flagging as still-open.
