# Worker Packet: T150 — pin T142's `minWidth` window in a test

Small, test-only, no source change. The derivation is precise and has already been
independently verified twice (T142's checker, and again for this packet) — your job
is to encode it as a bound check that a future edit to the constant cannot silently
break, and to prove that check actually catches a bad value rather than just
restating the current one.

**Packet SHA: pin this.** Before writing your output doc, run
`git log -1 --format=%H -- docs/swarm/active/T150-worker-packet.md` and confirm it
matches the SHA in your dispatch prompt.

## FIRST — merge the working branch

```
git fetch origin
git merge origin/claude/swarm-plan-zl575z
```

Report the result. **If it conflicts, stop and report.**

## Why this exists

T142 (merged `35b5dd1`) introduced `COACH_HOME_PAIRED_MODULE_MIN_WIDTH = 280`
(`CoachHome.tsx:1174`) to drive the Next-up/Activity-feed pairing `Grid`'s
responsive `minWidth`. `CoachHome.test.tsx` (current line ~1418, re-verify) asserts:

```ts
expect(trackTemplate).toContain(`${COACH_HOME_PAIRED_MODULE_MIN_WIDTH}px`);
```

**Because the expectation is built from the constant itself, this test cannot catch
a bad constant.** Change `280` to `450` in `CoachHome.tsx` and this assertion still
passes — while two-up pairing silently breaks across the entire 1024–1280px
viewport band (the exact failure mode T142's own packet was gated twice to prevent
and had no runtime guard against). This is a MINOR carried from T142's PASS
(`task-ledger.md` row T142, and its own row T150) — the one place that task's
correctness rests on a one-time measurement rather than something CI re-checks.

## The derivation — re-derive it yourself, do not copy it blind

`CoachHome.tsx:1143-1174` already carries this exact derivation as a code comment,
written by T142's worker and independently re-checked by its checker. **Do not just
transcribe that comment into your test.** Open the four real sources it cites and
confirm each number yourself — if the comment has drifted from the sources since
T142 merged, your test should encode what the sources say, not what the comment
says, and you should report the discrepancy.

1. **`SideNav` is 260px.**
   `node_modules/@astryxdesign/core/src/SideNav/SideNav.tsx:65` — `width: 260` in
   the `stylex.create({ root: {...} })` block.
2. **The SideNav/MobileNav breakpoint is 768px ('md'), and `AppShell` uses the
   default.** `astryx-api.md:2621` — `MobileNavConfig.breakpoint`, default `'md'` =
   768px. `src/app/AppShell.tsx:163` passes `mobileNav={{ content: <MobileNav /> }}`
   with no `breakpoint` key, so the default applies. Below 768px, `MobileNav`
   replaces `SideNav` and contributes 0px.
3. **`LayoutContent padding={6}` removes 24px per side.**
   `node_modules/@astryxdesign/core/src/Layout/padding.stylex.ts:17-29,84-89` —
   `spacingStepToToken[6] = 'spacing6'`, and `paddingStyles[6]` sets
   `paddingInlineStart`/`paddingInlineEnd` both to `spacingVars['--spacing-6']`.
   `node_modules/@astryxdesign/core/src/theme/tokens.stylex.ts:161` —
   `'--spacing-6': '24px'`.
4. **The pairing `Grid`'s own `gap={4}` is 16px.**
   Same tokens file, `:159` (verify the exact line) — `'--spacing-4': '16px'`.
5. **The track-min formula.**
   `node_modules/@astryxdesign/core/src/Grid/Grid.tsx`, function
   `buildCappedTemplate` (~`:340-365`): for `columns={{ minWidth, max: 2 }}`, the
   track min is `min(100%, max(minWidth px, perColumn))` where
   `perColumn = (100% - (max-1) * gap) / max`. For `max: 2`, that's
   `(100% - 1*16px) / 2`.

From these, two inequalities (re-derive the arithmetic yourself; these are the
values to check your work against, not to copy without checking):

- **Constraint A** — two columns must fit at 1024px (UXC-06's own accept clause,
  `VOLT_UX_Craft_PRD_v3.html:167`, requires two-up above 1024px — verify this line
  number too):
  `minWidth ≤ (1024 − 260 − 48 − 16) / 2 = 700 / 2 = 350`
- **Constraint B** — one column must be forced at 375px (no SideNav below 768):
  `minWidth > (375 − 48 − 16) / 2 = 311 / 2 = 155.5`

**Window: `155.5 < minWidth ≤ 350`.** `280` (the current value) sits inside it with
124px of margin below the ceiling and 70px above the floor.

## What to build

In `CoachHome.test.tsx`, inside the existing `describe('<CoachHome /> T142/UXC-06
-- Next up + Activity feed pair via a responsive Grid', ...)` block (current lines
~1370-1429, re-locate by the describe text — T149 is landing concurrently in a
different, non-overlapping part of this same file), add a new `it(...)` — do not
modify the two existing tests in this block.

The new test does **not** need to render the component or touch the DOM — it is a
pure bound check on the imported constant, already available via the `import {
COACH_HOME_PAIRED_MODULE_MIN_WIDTH, ... }` at the top of the file (current line
~34, re-verify). Structure:

1. A comment block citing the five sources and the two inequalities above (your own
   re-verified numbers, not copy-pasted from this packet or from
   `CoachHome.tsx:1143-1174` without checking).
2. `expect(COACH_HOME_PAIRED_MODULE_MIN_WIDTH).toBeGreaterThan(155.5);`
3. `expect(COACH_HOME_PAIRED_MODULE_MIN_WIDTH).toBeLessThanOrEqual(350);`

## Prove it discriminates — both directions, by mutation

A test that only restates the current value's own bounds proves nothing about
whether the bounds are correct. You are in your own worktree (constitution item
23 — this is exactly the sanctioned case for a revert-measure-restore mutation), so
prove it directly:

1. Run the new test against the unmodified file. Confirm it passes.
2. Temporarily change `COACH_HOME_PAIRED_MODULE_MIN_WIDTH` to `450` in
   `CoachHome.tsx` (the exact value named in this packet's own rationale, and in
   `task-ledger.md`'s T150 row, as the one that silently breaks 1024-1280 while
   passing the existing tautological test). Run **only the new test**. Confirm it
   **fails**, and report the exact assertion and message.
3. Also run the **existing** `toContain(`${COACH_HOME_PAIRED_MODULE_MIN_WIDTH}px`)`
   test at the same mutated value. Confirm it still **passes** — this is the
   concrete demonstration of why that test alone was insufficient, and why this
   task exists.
4. Restore `450` → `280`. Confirm both tests pass again.
5. Repeat steps 2-4 with a too-small value (e.g. `100`, below the 155.5 floor).
   Confirm the new test fails for the low-bound reason this time (a different
   assertion than step 2's), and that it's clearly attributable to the
   `toBeGreaterThan` check, not the `toBeLessThanOrEqual` one.
6. Confirm the file is byte-identical to its pre-mutation state after every
   restore (`git diff` empty on `CoachHome.tsx`).

Report all of this in your output doc, including the exact failure output at each
mutated value — not just "it failed as expected."

## Allowed Files

- `src/pages/home/CoachHome.test.tsx` — **scoped to the single `it(...)` you add
  inside the `<CoachHome /> T142/UXC-06 -- Next up + Activity feed pair via a
  responsive Grid` describe block.** Do not modify the two existing tests in that
  block. Do not touch the `<CoachHome /> DES-12 states` or `<CoachHome /> T124 goal
  projection` describe blocks — T149 is landing concurrently in those, in a
  separate worktree. If your diff touches anything outside the one new `it(...)`
  you're adding, stop and report before proceeding.
- `src/pages/home/CoachHome.tsx` — **read-only except for the explicitly authorized
  mutation.** Temporarily changing `COACH_HOME_PAIRED_MODULE_MIN_WIDTH`'s value for
  steps 2-6 of the discrimination proof and restoring it byte-identically is
  required by the criteria and is **not** an Allowed Files violation; a checker
  should not read it as one. No other edit to this file is in scope for this task.
- `docs/swarm/active/T150-worker-output.md` (create)

## Forbidden Files

- `docs/swarm/constitution.md`, `task-ledger.md`, `verification-log.md`,
  `dispute-log.md`
- Any other `docs/swarm/**` file, including other packets
- `.claude/**`
- Anything under `node_modules/`
- Every other file under `src/`

## Acceptance Criteria

1. A new `it(...)` exists inside the T142/UXC-06 Grid-pairing `describe` block,
   asserting `155.5 < COACH_HOME_PAIRED_MODULE_MIN_WIDTH <= 350` via two separate
   `expect` calls (not one combined boolean), with a comment citing the five
   sources and reproducing the two inequalities in your own re-verified numbers.
2. The two existing tests in that `describe` block are unmodified (diff shows only
   an addition).
3. **Discrimination proved by mutation in both directions** (too-high and
   too-low), per the six steps above, with exact failure output reported for each,
   and explicit confirmation that the existing `toContain` test does **not** catch
   the too-high mutation (demonstrating why this task exists) while the new test
   does.
4. `CoachHome.tsx` is confirmed byte-identical to its pre-task state after all
   mutation steps (`git diff` empty).
5. No other file under `src/` is modified.
6. `npx tsc --noEmit`, `npx vite build`, `npm run format:check`, `npx eslint .` and
   `npx vitest run` all clean. State the baseline test/file counts you measured at
   this packet's own commit before your change (T142 merged at 1474 tests/63
   files/354 warnings — confirm this is still what you see, since T146/T149 may
   have landed by the time you start; report what you actually measured) and the
   delta (your change adds exactly one test).

## Relevant Constitution Excerpt

- **Item 19c** — verify your own citations before submitting. This packet's numbers
  were re-derived against the current tree by its author, but re-verify every one
  yourself before writing the test; if anything doesn't match, stop and report
  rather than guessing at intent.
- **Item 23** — mutation experiments run in your own worktree (which you already
  have) and must be reverted and reported, not left in place.
- **Item 2** — not expected to bind here; this task adds no new component usage.

## Required Worker Output

Create `docs/swarm/active/T150-worker-output.md` covering: the five sources you
re-verified and any drift from what T142's own code comment or this packet
claimed; the exact new test code; full mutation evidence for both the too-high and
too-low cases, including exact assertion failure messages and confirmation the
existing `toContain` test does not catch the too-high case; confirmation
`CoachHome.tsx` is byte-identical after all mutations; full command output for all
five gates; confirmation you touched only the one new `it(...)`; and anything you
could not verify, stated plainly as unverified rather than omitted.

Do not mark this task complete. A checker verifies it.
