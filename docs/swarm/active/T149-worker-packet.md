# Worker Packet: T149 — UXC-06's no-full-bleed clause, still open on CoachHome

Small. Two independent fixes on one page, plus regression tests that must be proven
to fail without the fix. Read the whole packet before touching anything — one half
has a judgement call already resolved for you from in-repo precedent, and the other
has a runtime trap (F-2) that will silently break your build if you reach for the
prop that looks most obvious.

**Packet SHA: pin this.** Before writing your output doc, run
`git log -1 --format=%H -- docs/swarm/active/T149-worker-packet.md` and confirm it
matches the SHA in your dispatch prompt.

## FIRST — merge the working branch

```
git fetch origin
git merge origin/claude/swarm-plan-zl575z
```

Report the result. **If it conflicts, stop and report.**

## Why this exists

UXC-06 (`docs/swarm/VOLT_UX_Craft_PRD_v3.md:81`, MINOR) has three clauses. T142
(merged `35b5dd1`, `task-ledger.md` row T142) closed two: the ~1120px content cap
with centring, and pairing Next up + Activity feed two-up via `Grid`. **T142's own
packet explicitly declined the third clause and named exactly two open sites**
(`docs/swarm/active/T142-worker-packet.md:63-68`, pre-merge line numbers — verify
everything below against the current tree, not those):

> "No full-bleed bars/controls" is not addressed here. ... Two live sites remain
> after T142: a two-option `SegmentedControl` at `CoachHome.tsx:2421-2428`
> (`All`/`Below goal`) and a module-width `ProgressBar` at `:2165`.

This is filed under **constitution item 20** — a deliberate deferral needs a ledger
row, not just a comment, and T142's checker is the reason this row exists at all
rather than a comment nobody triages.

The PRD text (`VOLT_UX_Craft_PRD_v3.html:165`, accept criteria `:167`, both
re-verified against the current file — the boss's citation for these two was
correct, unlike some line numbers below which have shifted):

> full-bleed edge-to-edge bars and two-option segmented controls end; bars inside
> rows/cards cap near ~480px or their module's column width.
>
> **Accept:** no bar or non-input control spans the full content region at
> 1440px; dashboard modules render two-up above 1024px.

The coach-dashboard finding (`VOLT_UX_Craft_PRD_v3.html:245`): "Single-column
modules with 1100px bars; reference B pairs them → UXC-06."

**Re-verified current line numbers (post-`35b5dd1`), do not trust the packet's
2421/2165 above:**
- SegmentedControl: `CoachHome.tsx:2488-2495`
- ProgressBar: `CoachHome.tsx:2211-2219`, inside the `KpiCard label="Hours vs. team
  goal"` at `:2211`, itself the second card in the 4-up KPI `Grid` at
  `:2198` (`columns={{ minWidth: 240, repeat: 'fit' }}`).

## Colour is settled — do not reopen it

**Dispute-log D011 and its addendum already settled the adjacent question.** No
Astryx `ProgressBar` variant reaches 3:1 against its track in either theme
(`dispute-log.md:1048-1055`), and all ten `<ProgressBar>` sites in this codebase —
including this one — already carry their value as text, so WCAG 1.4.11's
redundant-visualisation carve-out applies and there is no colour-conformance defect
to fix (`dispute-log.md:1103-1135`, the addendum). **Capping this bar's WIDTH is a
layout change only.** Do not touch `variant`, do not add `hasValueLabel` (it
already has one — `formatValueLabel={(value, max) => \`${value} / ${max} hrs\`}` at
`:2218`), and do not convert it to `GoalBar` (option (b) in D011 is explicitly the
human owner's call, not this task's). If you find yourself wanting to "improve" the
colour while you're in here, stop — that is scope creep into a settled dispute, and
the regression test below is specifically designed to catch it.

---

## Part 1 — cap the "Hours vs. team goal" `ProgressBar`

### Why `xstyle` is not the answer

`ProgressBar`'s only documented layout-customization prop is `xstyle`
(`astryx-api.md:5458`). **Do not use it.** `VOLT_UX_Craft_PRD_v3.md:55-60`
(finding **F-2**, binding, verified against installed source):

> `xstyle` does not work here. StyleX is compile-time and the app has no StyleX
> plugin (`vite.config.ts` = `[react()]`); `stylex.create()` throws at runtime.
> Effective DES-21 ladder is component → theme token → custom CSS. `className`/
> `style` are merged (`src/utils/mergeProps.ts:62-107`).

Independently re-verified for this task, not taken on trust: `ProgressBar.tsx`'s
`ProgressBarProps` extends `BaseProps<HTMLDivElement>`
(`node_modules/@astryxdesign/core/src/ProgressBar/ProgressBar.tsx:63`), and
`BaseProps` (`node_modules/@astryxdesign/core/src/BaseProps.ts:23-90`) extends
`React.HTMLAttributes` with `style`/`className` **not** in its omit list — they are
real, working props, just absent from `astryx-api.md`'s curated table. The
component's root `<div>` spreads `{...mergeProps(themeProps(...), stylex.props(...,
xstyle), className, style)}` (`ProgressBar.tsx:290-298`), so a plain `style` object
reaches the DOM node with no StyleX involved.

**In-repo precedent for exactly this pattern**, already shipped and passing:
`OutreachList.tsx:2346` — `const MIN_TOUCH_TARGET_STYLE: CSSProperties = {
minHeight: '44px' };` — applied to an Astryx `Button` at `OutreachList.tsx:2378`
via `style={MIN_TOUCH_TARGET_STYLE}`. `CSSProperties` is imported at
`OutreachList.tsx:609` (`import { ..., type CSSProperties } from 'react';`). Follow
the same shape here.

### The prescription

`CoachHome.tsx` currently imports `useEffect, useId, useState, type ReactNode` from
`'react'` at `:503`. Add `type CSSProperties` to that import.

Define a named, documented constant (matching this file's own convention —
`COACH_HOME_PAIRED_MODULE_MIN_WIDTH` at `:1174` is the precedent for a derived,
commented constant rather than an inline magic number) near the other
`CoachHome`-scoped constants, e.g.:

```ts
// UXC-06/T149: cap near ~480px (VOLT_UX_Craft_PRD_v3.html:165's own number) rather
// than "the module's column width" — unlike the Next-up/Activity `Grid`
// (`max: 2`, a well-defined 552px/350px column measured by T142), this bar sits in
// a 4-up `columns={{ minWidth: 240, repeat: 'fit' }}` KPI Grid with no `max`, so
// "the module's column width" is not one fixed number: it is already ~268px at
// 1120px content width (4 columns fit), but can grow toward the full content
// width if the KPI grid ever collapses toward a single column (e.g. a narrow
// viewport between the 768px SideNav breakpoint and the point the grid's own
// 2-column threshold clears — CoachHome.tsx:1143-1174 derives the analogous
// window for the OTHER grid; this constant sidesteps needing an equivalent
// derivation for this one by using the flat cap the PRD offers as the alternative).
const COACH_HOME_KPI_PROGRESS_BAR_MAX_WIDTH_STYLE: CSSProperties = {
  maxWidth: '480px',
};
```

(Write the comment in your own words if you can make it more precise, but keep the
reasoning: *why 480 flat rather than "module's column width" for THIS bar
specifically*. Verify the 240/1120/268 numbers yourself before restating them —
don't just copy them from this packet.)

Apply it to the `ProgressBar` at `:2212-2219`:

```tsx
<ProgressBar
  label="Hours vs. team goal"
  isLabelHidden
  value={confirmedHours}
  max={goalHours > 0 ? goalHours : 1}
  hasValueLabel
  formatValueLabel={(value, max) => `${value} / ${max} hrs`}
  style={COACH_HOME_KPI_PROGRESS_BAR_MAX_WIDTH_STYLE}
/>
```

Do not touch `value`, `max`, `hasValueLabel`, or `formatValueLabel`. Do not add
`variant`.

---

## Part 2 — replace the two-option `SegmentedControl` with `ToggleButton`

### The judgement call, resolved from precedent — do not re-decide it

The PRD says two-option segmented controls should end but does not say what
replaces them. This is not a guess: `astryx-api.md`'s own `SegmentedControl`
section says, verbatim, under **Don't** (`astryx-api.md:5602`):

> Use for simple on/off states; use `ToggleButton` instead. `ToggleButton` can be
> toggled on or off independently, while `SegmentedControl` enforces a single
> selection from a group.

`CoachHome.tsx`'s control is exactly this shape — `goalProjectionFilter:
GoalProjectionFilter` (`:1364`, `'all' | 'belowGoal'`) is a binary is-filtered/
is-not-filtered state, not a 3+-way mode switch. **This codebase already has a
structurally identical precedent, shipped and tested**:
`ParticipationTab.tsx:939-943`:

```tsx
<ToggleButton
  label="Below 70%"
  isPressed={isBelowSeventyActive}
  onPressedChange={setIsBelowSeventyActive}
/>
```

— a standalone `ToggleButton` (no group) driving a single boolean quick-filter,
with the module doc directly above it (`ParticipationTab.tsx:181-189`) recording
the same reasoning: `ToggleButton`'s own description ("switches between selected
and unselected states ... standalone for binary actions") is the closest
documented match for a single on/off filter. Reuse this pattern; do not invent a
different one and do not use `Switch` (that's for persisted settings, not a
transient list filter — `astryx-api.md:1523/6128` both draw that line).

### The prescription

`CoachHome.tsx:2483-2520` currently renders (imports at `:520-521`):

```tsx
<SegmentedControl
  label="Goal projection filter"
  value={goalProjectionFilter}
  onChange={(value) => setGoalProjectionFilter(value as GoalProjectionFilter)}
>
  <SegmentedControlItem value="all" label="All" />
  <SegmentedControlItem value="belowGoal" label="Below goal" />
</SegmentedControl>
```

Replace with:

```tsx
<ToggleButton
  label="Below goal"
  isPressed={goalProjectionFilter === 'belowGoal'}
  onPressedChange={(pressed) => setGoalProjectionFilter(pressed ? 'belowGoal' : 'all')}
/>
```

`GoalProjectionFilter` (`:1364`) and `filterGoalProjectionRows` (`:1371` onward) are
unaffected — they already model this as a two-value type; no type change needed.

**Imports.** `SegmentedControl`/`SegmentedControlItem` are used at exactly this one
site in the file — verify this yourself (search the whole file) before deleting the
import; if you find a second use, stop and report rather than silently keeping the
import. Remove `SegmentedControl,` and `SegmentedControlItem,` from the
`@astryxdesign/core` import block (`:505-527`) and add `ToggleButton,` in the
existing alphabetical position (between `Toast,` and `VisuallyHidden,`).

Do not add a `ToggleButtonGroup` — this is a single standalone control, matching
the `ParticipationTab.tsx` precedent.

---

## Regression tests — both must be proven to discriminate

**A test that passes whether or not the fix is present is worth less than no test,
and has cost this task set two rounds already this session on other tasks.** For
each test below: write it, confirm it passes against your fix, then temporarily
revert *only* the relevant change (per constitution item 23 — you're already in
your own worktree, so this is the sanctioned place to do it), confirm the test
fails for the stated reason, then restore byte-identically and confirm green again.
Report the exact failure output for both.

### Test 1 — the KPI bar is width-capped, and its colour is untouched

In `CoachHome.test.tsx`, add a new `describe` block immediately after the existing
`<CoachHome /> DES-12 states` block (ends `:1066`) and before `<CoachHome /> T124
dashboard-analytics section DES-12 states` (starts `:1078`) — re-locate these by
searching for the `describe(` text, not the line numbers, since T150 is landing
concurrently in a different part of this same file and may shift lines around it.

Find the bar via its accessible label, not a fragile DOM path: locate
`[role="progressbar"]` whose `aria-labelledby` target has `textContent === 'Hours
vs. team goal'`, then `.closest('.astryx-progressbar')` for the styled root (the
class name comes from `themeProps('progressbar', {variant})`,
`ProgressBar.tsx:293-294`; verify it's really `.astryx-progressbar` against the
installed source before relying on it).

Assert:
1. `root.style.maxWidth === '480px'` (reading the inline style attribute directly —
   deterministic in jsdom, no browser needed).
2. `root.getAttribute('data-variant') === 'accent'` — the pre-existing, untouched
   default. This is the guard against "helpfully" changing the variant while
   capping the width; mutate `variant="neutral"` (or any other) locally and confirm
   this specific assertion is what catches it, not the maxWidth one.

**Discrimination proof:** remove the `style` prop (or set it to `{}`), confirm
assertion 1 fails; separately set `variant="neutral"`, confirm assertion 2 fails
with the fix's `style` still in place (i.e. the two assertions are independent, not
one accidentally subsuming the other). Restore both, confirm green.

### Test 2 — the two-option control is gone, and "Below goal" filtering still works

Extend the existing `<CoachHome /> T124 goal projection` describe block
(`CoachHome.test.tsx:1176-1206` today) rather than replacing its test — the
existing filtering assertions (`:1194-1204`) should keep passing unmodified against
your `ToggleButton`, since it renders `label` as visible button text when `children`
is omitted (verified in `ToggleButton.tsx:298-307` — this is not an assumption).

Add a new assertion, in the same test or a new one in this block, that:
1. `container.querySelector('[role="radiogroup"]')` is `null` anywhere on the page
   (`SegmentedControl` renders `role="radiogroup"` —
   `node_modules/@astryxdesign/core/src/SegmentedControl/SegmentedControl.tsx:263`
   — so this is the exact discriminator for "the two-option control is gone", not
   just "a Below-goal button exists somewhere").
2. No button anywhere in the container has `textContent === 'All'` (the option
   that no longer exists).

**Discrimination proof:** temporarily restore the old `SegmentedControl` JSX,
confirm both new assertions fail (report which one fails and how), remove it again,
confirm green.

---

## Allowed Files

- `src/pages/home/CoachHome.tsx`
- `src/pages/home/CoachHome.test.tsx` — **scoped**. You may only add content
  within/immediately after the `<CoachHome /> DES-12 states` describe block and the
  `<CoachHome /> T124 goal projection` describe block (see Test 1/Test 2 above for
  exact anchors). **Do not touch the `<CoachHome /> T142/UXC-06 -- Next up +
  Activity feed pair via a responsive Grid` describe block** (near the end of the
  file) or anything inside it — T150 is landing there concurrently in a separate
  worktree, touching only that block. If your diff to this file touches anything
  outside your two named describe blocks, stop and report before proceeding; that
  is very likely an unintended overlap with T150, not a needed change for this
  task.
- `docs/swarm/active/T149-worker-output.md` (create)

You may **read** (not edit) `docs/swarm/dispute-log.md` (D011 and its addendum) and
`docs/swarm/active/T142-worker-packet.md` for context — both are cited above.

## Forbidden Files

- `docs/swarm/constitution.md`, `task-ledger.md`, `verification-log.md`,
  `dispute-log.md`
- Any other `docs/swarm/**` file, including other packets
- `.claude/**`
- Anything under `node_modules/`
- Every other file under `src/` — this task is two named sites on one page

## Acceptance Criteria

1. `ProgressBar` at `CoachHome.tsx:2212-2219` (re-verify the exact current line)
   carries `style={COACH_HOME_KPI_PROGRESS_BAR_MAX_WIDTH_STYLE}` (or equivalently
   named constant) resolving to `maxWidth: '480px'`. `value`, `max`,
   `hasValueLabel`, `formatValueLabel` unchanged; no `variant` prop added.
2. The two-option `SegmentedControl`/`SegmentedControlItem` at `CoachHome.tsx:
   2488-2495` (re-verify) is replaced by a single standalone `ToggleButton` per
   the Part 2 prescription. `SegmentedControl`/`SegmentedControlItem` imports
   removed (confirmed unused elsewhere in the file first).
3. Test 1 and Test 2 above exist, pass against the fix, and their discrimination
   proofs are reported with the exact failure output seen at each mutation step.
4. `CoachHome.test.tsx:1194-1204`'s existing filtering assertions (unmodified)
   still pass against the `ToggleButton` implementation.
5. `CoachHome.test.tsx:1247-1300`'s T129/UXC-01 region-labelling tests (unrelated
   to either change here) still pass unmodified — confirm and report, don't just
   assume, since Part 1 and Part 2 both sit inside sections that block covers.
6. No `xstyle`/`stylex.create()` call added anywhere. Confirm by grep in your
   output doc.
7. `npx tsc --noEmit`, `npx vite build`, `npm run format:check`, `npx eslint .` and
   `npx vitest run` all clean. State the baseline test/file counts you measured at
   this packet's own commit before your changes (T142 merged at 1474 tests/63
   files/354 warnings — confirm this is still the baseline you see, since T146/T150
   may have landed by the time you start; report what you actually measured, not
   what this packet assumes) and the delta your changes produce.
8. Your output doc states plainly that this closes UXC-06 fully on CoachHome (all
   three clauses), or explains precisely why not, if you find something that
   contradicts that.

## Relevant Constitution Excerpt

- **Item 2** — Astryx component props come only from `docs/swarm/astryx-api.md`; a
  prop absent from that file is presumed hallucinated → MAJOR. `style`/`className`
  are the disclosed exception here, independently verified against installed
  `BaseProps` source and already precedented in-repo (`OutreachList.tsx`) — state
  this reasoning in your output doc rather than assuming a checker will infer it.
- **Item 11** — styling escalation order is component → theme token → xstyle →
  custom CSS; F-2 (`VOLT_UX_Craft_PRD_v3.md:55-60`) establishes that `xstyle` is
  broken in this app specifically, so the effective ladder skips it straight to
  `style`/`className`. Do not add a StyleX plugin to fix this — that is a stack
  change far outside this task.
- **Item 19c** — verify your own citations before submitting. Several line numbers
  in this packet were re-derived by the author against the current tree, but
  concurrent tasks (T146, T150, others) may move them again before you start. If
  anything here does not match what you find, stop and report the mismatch.
- **Item 23** — mutation experiments (your discrimination proofs) run in your own
  worktree, which you already have. Revert-measure-restore, never leave a mutation
  uncommitted or unreported.

## Required Worker Output

Create `docs/swarm/active/T149-worker-output.md` covering: the exact current line
numbers you found for both sites (compare against this packet's, note any drift);
the `style` constant you defined and its comment; confirmation
`SegmentedControl`/`SegmentedControlItem` had no other use site before removing the
import; both discrimination proofs with full failure output; confirmation that
`CoachHome.test.tsx:1194-1204` and `:1247-1300` (or wherever they've moved to)
still pass unmodified; full command output for all five gates; explicit
confirmation you did not touch `variant` or convert to `GoalBar`; explicit
confirmation you did not edit inside T150's Grid-pairing describe block; and
anything you could not verify, stated plainly as unverified rather than omitted.

Do not mark this task complete. A checker verifies it.
