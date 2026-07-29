# Worker Output: T150 — pin T142's `minWidth` window in a test

**Packet SHA pinned:** `400816a5348b133fa0bc6445d2ec4f319df0d29f`
(`git log -1 --format=%H -- docs/swarm/active/T150-worker-packet.md`, confirmed
before writing this doc.)

## Step 0 — merge

`git fetch origin && git merge origin/claude/swarm-plan-zl575z` was a **clean
fast-forward** (`2146255..23d6672`, 155 files changed). No conflicts.

## Baseline measured at this packet's own commit (post-merge)

Ran `npx vitest run` immediately after the merge, before any edit:

```
Test Files  64 passed (64)
     Tests  1477 passed (1477)
```

`npx eslint .` at the same point: **0 errors, 354 warnings**.

This is **not** the packet's own stated baseline (1474 tests / 63 files) —
T146 merged to the integration branch after the packet was authored, adding
one file and three tests, landing at 64 files / 1477 tests / 0 errors / 354
warnings. Per the dispatch corrections, this is the expected and correct
baseline to measure against, not the packet's stale number.

## The five sources — re-verified against the live tree

1. **`SideNav` is 260px.** Confirmed at
   `node_modules/@astryxdesign/core/src/SideNav/SideNav.tsx:65` —
   `width: 260` inside `stylex.create({ root: {...} })`. Matches the packet.
2. **Breakpoint 768px (`'md'`), `AppShell` uses the default.** Confirmed:
   `docs/swarm/astryx-api.md:2621` — `MobileNavConfig.breakpoint` default
   `'md'` = 768px. `src/app/AppShell.tsx:163` —
   `mobileNav={{ content: <MobileNav /> }}`, no `breakpoint` key. Matches the
   packet exactly, including the line number.
3. **`LayoutContent padding={6}` removes 24px per side.** Confirmed:
   `node_modules/@astryxdesign/core/src/Layout/padding.stylex.ts:84-89`
   (`paddingStyles[6]` → `spacingVars['--spacing-6']` on all four sides);
   `node_modules/@astryxdesign/core/src/theme/tokens.stylex.ts:161` —
   `'--spacing-6': '24px'`. Matches the packet.
4. **The pairing `Grid`'s own `gap={4}` is 16px.** Confirmed at
   `tokens.stylex.ts:159` — `'--spacing-4': '16px'`. Matches the packet
   (packet asked me to verify the exact line; it is 159, as cited).
5. **The track-min formula.** Confirmed at
   `node_modules/@astryxdesign/core/src/Grid/Grid.tsx`,
   `buildCappedTemplate` (lines 340-365): `trackMin = min(100%, max(minWidth
   px, perColumn))`, `perColumn = (100% - (maxCols-1) * gap) / maxCols`.
   Matches the packet.

Also independently re-verified:
- `VOLT_UX_Craft_PRD_v3.html:167` — the `<div class="accept">` line under
  UXC-06 reads "...dashboard modules render two-up above 1024px." Matches
  the packet's citation exactly, both content and line number.
- `CoachHome.test.tsx`'s existing `describe('<CoachHome /> T142/UXC-06 --
  Next up + Activity feed pair via a responsive Grid', ...)` block is at
  lines 1370-1429 (pre-edit), matching the packet's ~1370-1429 estimate
  exactly. The `toContain` assertion the packet quotes is at line 1418,
  matching "current line ~1418" exactly.
- The `import { COACH_HOME_PAIRED_MODULE_MIN_WIDTH, ... }` is present at the
  top of the test file (line 34), matching "current line ~34" exactly.

**Arithmetic re-derived independently:**
- Constraint A: `(1024 − 260 − 48 − 16) / 2 = 700 / 2 = 350`
- Constraint B: `(375 − 48 − 16) / 2 = 311 / 2 = 155.5`
- Window: `155.5 < minWidth ≤ 350`. 280 is inside it.

## Drift found — the packet's own margin description, not the code

`CoachHome.tsx:1166-1169`'s existing comment says 280 has "124px of margin
above the 155.5 floor, 70px below the 350 ceiling" — i.e. `280 − 155.5 =
124.5` above the floor, `350 − 280 = 70` below the ceiling. That is correct.

**This packet's own line 82-83 states the opposite**: "124px of margin below
the ceiling and 70px above the floor" — margins swapped relative to which
bound they're measured from. Per the dispatch corrections, this is the
packet's error, not the code's, and my new test's comment matches the code
(and the corrected arithmetic), not the packet's inverted phrasing. No other
drift found between the packet, the code comment, and the five live sources.

## The new test

Added inside the existing `describe('<CoachHome /> T142/UXC-06 -- Next up +
Activity feed pair via a responsive Grid', ...)` block, after the two
existing `it(...)`s, as the only change to `CoachHome.test.tsx`:

```ts
// T150: pin `COACH_HOME_PAIRED_MODULE_MIN_WIDTH` inside its derived window
// so a future edit to the constant can't silently break two-up pairing.
// Unlike the `toContain` assertion above -- which builds its own expected
// string from the constant and so passes for ANY value -- this is a bound
// check against independently-derived numbers, re-verified against the
// five live sources (not copied from the code comment or the packet
// without checking):
//   1. `SideNav` is 260px (`node_modules/@astryxdesign/core/src/SideNav/
//      SideNav.tsx:65`, `width: 260`).
//   2. `AppShell` passes no `breakpoint` to `mobileNav`
//      (`src/app/AppShell.tsx:163`), so the documented default applies
//      (`docs/swarm/astryx-api.md:2621`, `MobileNavConfig.breakpoint`
//      default `'md'` = 768px). Below 768px, `MobileNav` replaces
//      `SideNav` and contributes 0px.
//   3. `LayoutContent padding={6}` removes 24px per side
//      (`node_modules/@astryxdesign/core/src/Layout/padding.stylex.ts:84-89`,
//      `paddingStyles[6]` -> `spacingVars['--spacing-6']`;
//      `node_modules/@astryxdesign/core/src/theme/tokens.stylex.ts:161`,
//      `'--spacing-6': '24px'`).
//   4. The pairing `Grid`'s own `gap={4}` is 16px (same tokens file,
//      `:159`, `'--spacing-4': '16px'`).
//   5. The track-min formula (`node_modules/@astryxdesign/core/src/Grid/
//      Grid.tsx`, `buildCappedTemplate`, ~:340-365): for
//      `columns={{ minWidth, max: 2 }}`, track min is
//      `min(100%, max(minWidth px, perColumn))` where
//      `perColumn = (100% - (max-1) * gap) / max`.
//
// Constraint A -- two columns must fit at 1024px (UXC-06's own accept
// clause, `docs/swarm/VOLT_UX_Craft_PRD_v3.html:167`, requires two-up
// above 1024px):
//   minWidth <= (1024 - 260 - 48 - 16) / 2 = 700 / 2 = 350
//
// Constraint B -- one column must be forced at 375px (no SideNav below
// 768px):
//   minWidth > (375 - 48 - 16) / 2 = 311 / 2 = 155.5
//
// Window: 155.5 < minWidth <= 350. The current value (280) sits inside it
// with 124.5px of margin above the 155.5 floor and 70px below the 350
// ceiling (280 - 155.5 = 124.5; 350 - 280 = 70 -- matches the code comment
// at CoachHome.tsx:1166-1169, not this task's own packet, whose prose
// description of the same two numbers is inverted).
it('T150: COACH_HOME_PAIRED_MODULE_MIN_WIDTH stays inside its derived 155.5-350 window', () => {
  expect(COACH_HOME_PAIRED_MODULE_MIN_WIDTH).toBeGreaterThan(155.5);
  expect(COACH_HOME_PAIRED_MODULE_MIN_WIDTH).toBeLessThanOrEqual(350);
});
```

The two pre-existing tests in that `describe` block are byte-identical
(diff shows only this addition; `git diff --stat` on the file shows
`46 insertions(+)`, 0 deletions).

## Mutation proof — both directions, in this worktree (item 23)

All mutations run on `src/pages/home/CoachHome.tsx` in this agent's own
worktree, each followed by an explicit restore, per constitution item 23.

### 1. Unmodified file (280)

`npx vitest run src/pages/home/CoachHome.test.tsx -t "T150"` → 1 passed.

### 2. Mutate to 450 (too-high, above the 350 ceiling)

`COACH_HOME_PAIRED_MODULE_MIN_WIDTH = 450` in `CoachHome.tsx`. Ran only the
new test:

```
FAIL  src/pages/home/CoachHome.test.tsx > <CoachHome /> T142/UXC-06 -- Next up + Activity feed pair via a responsive Grid > T150: COACH_HOME_PAIRED_MODULE_MIN_WIDTH stays inside its derived 155.5-350 window
AssertionError: expected 450 to be less than or equal to 350
 ❯ src/pages/home/CoachHome.test.tsx:1473:48
    1471|   it('T150: COACH_HOME_PAIRED_MODULE_MIN_WIDTH stays inside its derive…
    1472|     expect(COACH_HOME_PAIRED_MODULE_MIN_WIDTH).toBeGreaterThan(155.5);
    1473|     expect(COACH_HOME_PAIRED_MODULE_MIN_WIDTH).toBeLessThanOrEqual(350…
       |                                                ^
```

Fails, as required, on the `toBeLessThanOrEqual(350)` line.

### 3. Existing `toContain` test at the same mutated value (450)

`npx vitest run src/pages/home/CoachHome.test.tsx -t "regression: the two
headings share exactly one Grid ancestor..."` →

```
✓ src/pages/home/CoachHome.test.tsx (88 tests | 87 skipped) 204ms
Test Files  1 passed (1)
     Tests  1 passed | 87 skipped (88)
```

Confirms the existing `toContain(`${COACH_HOME_PAIRED_MODULE_MIN_WIDTH}px`)`
test **still passes** at 450 — it builds its expected string from the same
bad constant, so it can never catch a bad value. This is the concrete
demonstration of why this task exists.

### 3a. Full suite at the mutated value (450) — the stronger proof

Per the dispatch corrections, ran the **entire** suite (not just this file)
at 450, since the gate's own run of the full 1476-test baseline suite found
zero failures anywhere in the repo with the constant mutated:

```
Test Files  1 failed | 63 passed (64)
     Tests  1 failed | 1477 passed (1478)
```

The single failure is my new test. **Every other test in the repository —
1477 of them, across all 64 files, including the existing tautological
`toContain` assertion — passes with the constant at 450.** No other test
anywhere in the repository catches this bad value. This is the same result
the gate found on the unmodified 1476-test baseline (before my test
existed): zero failures repo-wide. My new test is now the only thing in the
suite that would catch this regression.

### 4. Restore 450 → 280

`git diff --stat -- src/pages/home/CoachHome.tsx` → **empty output** (no
changes reported), confirming byte-identical restoration.
`npx vitest run src/pages/home/CoachHome.test.tsx -t "T142/UXC-06"` →

```
✓ src/pages/home/CoachHome.test.tsx (88 tests | 85 skipped) 238ms
Test Files  1 passed (1)
     Tests  3 passed | 85 skipped (88)
```

All three tests in the block (the two pre-existing plus the new one) pass.

### 5. Mutate to 100 (too-low, below the 155.5 floor)

`COACH_HOME_PAIRED_MODULE_MIN_WIDTH = 100` in `CoachHome.tsx`. Ran only the
new test:

```
FAIL  src/pages/home/CoachHome.test.tsx > <CoachHome /> T142/UXC-06 -- Next up + Activity feed pair via a responsive Grid > T150: COACH_HOME_PAIRED_MODULE_MIN_WIDTH stays inside its derived 155.5-350 window
AssertionError: expected 100 to be greater than 155.5
 ❯ src/pages/home/CoachHome.test.tsx:1472:48
    1470|   // description of the same two numbers is inverted).
    1471|   it('T150: COACH_HOME_PAIRED_MODULE_MIN_WIDTH stays inside its derive…
    1472|     expect(COACH_HOME_PAIRED_MODULE_MIN_WIDTH).toBeGreaterThan(155.5);
       |                                                ^
```

Fails on the `toBeGreaterThan(155.5)` line (1472) — a different line/
assertion than step 2's failure (line 1473, `toBeLessThanOrEqual`),
confirming the low-bound failure is clearly attributable to the
`toBeGreaterThan` check and not the `toBeLessThanOrEqual` one.

### 6. Restore 100 → 280, final confirmation

`COACH_HOME_PAIRED_MODULE_MIN_WIDTH` set back to `280`. Confirmed via
`git diff -- src/pages/home/CoachHome.tsx` (empty) and `git status
--porcelain` (only `CoachHome.test.tsx` shows as modified) that
`CoachHome.tsx` is byte-identical to its pre-task state after every
mutation/restore cycle.

## Full gate — all five, at the final (restored) state

- `npx tsc --noEmit` → no output, clean.
- `npx vite build` → succeeded (`✓ built in 5.96s`); pre-existing
  chunk-size advisory for `index-*.js` (673 kB) is unrelated to this change
  and predates it.
- `npm run format:check` → "All matched files use Prettier code style!"
- `npx eslint .` → `0 errors, 354 warnings` (matches the corrected baseline
  exactly).
- `npx vitest run` (full suite) →

```
Test Files  64 passed (64)
     Tests  1478 passed (1478)
```

Delta from the corrected 1477-test/64-file baseline: **exactly +1 test**,
0 file-count change, 0 new failures, 0 new warnings.

## Scope confirmation

`git diff --name-only` shows exactly one file changed:
`src/pages/home/CoachHome.test.tsx`. `git diff --stat` on it shows
`46 insertions(+), 0 deletions(-)` — a pure addition, no lines removed or
altered, and the diff hunk is entirely inside the T142/UXC-06 describe
block (verified by reading the diff directly: the added lines sit between
the second existing `it(...)`'s closing brace and the block's own closing
`});`). Neither the `<CoachHome /> DES-12 states` nor the `<CoachHome />
T124 goal projection` describe blocks (T149's landing zone) were touched.
`CoachHome.tsx` shows an empty diff (byte-identical) after all mutation
steps.

## Anything not verified

Nothing was left unverified. Every citation in the packet (five sources,
two PRD/comment line numbers, the describe-block location, the import line,
the existing test's line number) was checked directly against the live
tree and matched, except the two corrections the dispatch prompt itself
supplied in advance (the packet's inverted margin description at its own
lines 82-83, and the stale 1474/63 baseline superseded by T146's merge) —
both of which are documented above with what was actually measured.

Do not mark this task complete. A checker verifies it.
