# Worker Packet: T149 — UXC-06's no-full-bleed clause, still open on CoachHome

**Round 2.** Round 1's premise gate returned two BLOCKERs, and this revision
rewrites both parts of the packet in response — not a patch on top of round 1.
Read "What changed and why" at the bottom before starting if you want the short
version of what was wrong and why; the sections below already reflect the fix, not
the original prescription.

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
with centring, and pairing Next up + Activity feed two-up via `Grid`. T142's own
packet explicitly declined the third clause
(`docs/swarm/active/T142-worker-packet.md:60-65`, pre-merge line numbers — verify
everything below against the current tree, not those):

> "No full-bleed bars/controls" is not addressed here. ... Two live sites remain
> after T142: a two-option `SegmentedControl` at `CoachHome.tsx:2421-2428`
> (`All`/`Below goal`) and a module-width `ProgressBar` at `:2165`.

**That "two live sites" count is wrong, and round 1 of this packet inherited it
without checking the page.** The `ProgressBar` T142 named (in the KPI grid) is not
actually a full-bleed bar today — see "The bar count, corrected" below. Filed under
**constitution item 20** — a deliberate deferral needs a ledger row, not just a
comment.

The PRD text (`VOLT_UX_Craft_PRD_v3.html:165`, accept criteria `:167`):

> full-bleed edge-to-edge bars and two-option segmented controls end; bars inside
> rows/cards cap near ~480px or their module's column width.
>
> **Accept:** no bar or non-input control spans the full content region at
> 1440px; dashboard modules render two-up above 1024px.

The coach-dashboard finding (`VOLT_UX_Craft_PRD_v3.html:245`): "Single-column
modules with 1100px bars; reference B pairs them → UXC-06."

**Current line numbers, re-verified directly against the tree:**
- SegmentedControl: `CoachHome.tsx:2488-2495`
- The four `ProgressBar` sites: see below.

## The bar count, corrected — read this before touching Part 1

**Round 1 capped the one `ProgressBar` that was never the defect, and left the
three that are.** Verified directly, not inferred:

`CoachHome.tsx:2198` opens `<Grid columns={{ minWidth: 240, repeat: 'fit' }}
gap={4}>` containing exactly **four** `KpiCard`s (`:2199`, `:2211`, `:2233`,
`:2251`), closing at `:2260`. The second card, "Hours vs. team goal" (`:2211`),
contains the `ProgressBar` at `:2212-2219` — the one round 1 capped. At the page's
own 1120px content width (T142's cap) with a 16px gap, four 240px-minimum columns
fit exactly: `(1120 − 3×16) / 4 = 268px` per column, above the 240px floor, so the
grid renders all four cards side by side and this bar is already 268px wide at
1440px — **the exact width UXC-06's own accept clause measures.** A 480px cap on a
268px-wide bar is inert: it only ever binds in the narrow band where the grid's
`repeat: 'fit'` would otherwise let this specific card grow past 480px, which does
not happen at any width where this card is one of four. Round 1's own prescribed
comment for this bar even concedes the 268px figure and caps it anyway.

**Three other `ProgressBar`s genuinely span the full content region**, and none of
them were touched by round 1. All three sit inside a single-column `<List
hasDividers>` with no `Grid`/column constraint of any kind, inside the same
1120px-capped page body T142 established — verified by reading each render site
and its enclosing `<List>` directly, not assumed from the pattern:

- `TeamHoursRowItem` — `ProgressBar` at `:1873-1878`, inside a `ListItem`
  `description`, rendered from a bare `<List hasDividers>` at `:2464` (no `Grid`).
- `TopEventRowItem` — `ProgressBar` at `:1902-1907`, same shape, `<List
  hasDividers>` at `:2537`.
- `GoalProjectionRowItem` — `ProgressBar` at `:1929-1934`, same shape, `<List
  hasDividers>` at `:2513`.

These three are literally what the PRD's coach-dashboard finding calls
"single-column modules with 1100px bars" — not the KPI grid bar. **Part 1 below
targets all four sites with one shared constant, not just the KPI one** — applying
it to the already-narrow KPI bar too is harmless (268px stays under a 480px cap
regardless) and is less work than writing a bespoke justification for excluding
it, which is what round 1 did instead.

## Colour is settled — do not reopen it

**Dispute-log D011 and its addendum already settled the adjacent question.** No
Astryx `ProgressBar` variant reaches 3:1 against its track **in both themes**
(`dispute-log.md:1048-1056` — "Not one variant passes in both themes."), and all
ten `<ProgressBar>` sites in this codebase — including all four touched here —
already carry their value as text, so WCAG 1.4.11's redundant-visualisation
carve-out applies and there is no colour-conformance defect to fix
(`dispute-log.md:1103-1135`, the addendum). **Capping these bars' WIDTH is a layout
change only.** Do not touch `variant` on any of the four, do not add
`hasValueLabel` where a value label already exists (the KPI card's does,
`formatValueLabel={(value, max) => \`${value} / ${max} hrs\`}` at `:2218`; the
other three render their totals as separate `Text`/`endContent` next to the bar,
which is unaffected either way), and do not convert any of them to `GoalBar`
(option (b) in D011 is explicitly the human owner's call, not this task's). If you
find yourself wanting to "improve" the colour while you're in here, stop — that is
scope creep into a settled dispute, and Test 1 below is specifically designed to
catch it.

---

## Part 1 — cap all four `ProgressBar`s with one shared style constant

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

Define **one** named, module-scoped constant (matching this file's own convention
— `COACH_HOME_PAIRED_MODULE_MIN_WIDTH` at `:1174` is the precedent for a
documented constant rather than an inline magic number), applied to all four sites:

```ts
// UXC-06/T149: cap every ProgressBar on this page near ~480px
// (VOLT_UX_Craft_PRD_v3.html:165's own number). Three sites (TeamHoursRowItem,
// TopEventRowItem, GoalProjectionRowItem) sit in single-column `<List>` modules
// with no column constraint and would otherwise span the full ~1120px content
// width -- the actual UXC-06 defect. The fourth (the KPI grid's "Hours vs. team
// goal" bar) is already narrower than this cap at every width where it renders
// as one of the KPI Grid's four columns, so applying the same constant there
// changes nothing -- one shared constant for all four is simpler than special-
// casing the one site the cap doesn't need to bind at.
const COACH_HOME_PROGRESS_BAR_MAX_WIDTH_STYLE: CSSProperties = {
  maxWidth: '480px',
};
```

(Write the comment in your own words if you can make it more precise, but keep the
reasoning. Verify the 240/1120/268 numbers yourself before restating them — don't
just copy them from this packet.)

Apply `style={COACH_HOME_PROGRESS_BAR_MAX_WIDTH_STYLE}` to all four:

1. The KPI card's bar, `:2212-2219`.
2. `TeamHoursRowItem`'s bar, `:1873-1878`.
3. `TopEventRowItem`'s bar, `:1902-1907`.
4. `GoalProjectionRowItem`'s bar, `:1929-1934`.

At each site, do not touch `value`, `max`, `label`, `isLabelHidden`,
`hasValueLabel`, or `formatValueLabel`. Do not add `variant` anywhere.

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
is-not-filtered state, not a 3+-way mode switch. This codebase already has a
structurally identical precedent, **shipped** (not yet independently tested for
this specific behaviour — verify that yourself rather than assuming otherwise):
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
transient list filter — `astryx-api.md:1500`'s own "Do: use for settings that
apply immediately" and `astryx-api.md:6128`'s own "Don't use a ToggleButton for
on/off settings that persist across sessions; use a Switch instead" both draw that
line from opposite sides).

### `ToggleButton` renders its label twice in the DOM — this changes how you must test it, not what you build

**Verified directly against the installed component, not assumed.**
`ToggleButton.tsx:298-307` renders `label` **twice** when `children` is omitted:
once visibly (`:300`) and once more in an `aria-hidden="true"` width-reservation
span (`:301-306`, present so the button doesn't resize when the pressed
font-weight changes). `textContent` does not respect `aria-hidden` — it concatenates
both, so a rendered `<ToggleButton label="Below goal" .../>`'s `textContent` is
`"Below goalBelow goal"`, not `"Below goal"`. **`aria-pressed` (`ToggleButton.tsx:319`)
is unaffected by this and is absent on `SegmentedControlItem`** — use it as your
discriminator everywhere you'd otherwise reach for an exact text match on this
control.

**This means `CoachHome.test.tsx:1194-1196`'s existing button-finder will break
against a correct `ToggleButton` implementation, and that is expected — amend it,
do not work around it.** The three lines today:

```ts
const belowGoalButton = Array.from(container.querySelectorAll('button')).find(
  (b) => b.textContent === 'Below goal',
);
```

find nothing once "Below goal" only ever exists as the substring
`"Below goalBelow goal"`, and `expect(belowGoalButton).toBeTruthy()` on the next
line fails with `expected undefined to be truthy`. **This is an authorized test
amendment, not an unrelated break to route around** — the constitution's own
non-negotiable ("existing tests must pass unless the boss explicitly approves a
test update") is satisfied here: the human owner reviewed this exact failure and
approved amending these three lines, recorded in
`docs/swarm/auto-mode-decisions.md`. Replace the finder with:

```ts
const belowGoalButton = container.querySelector('button[aria-pressed]');
```

This is a **stronger** assertion than the one it replaces, not a weaker one: it
proves a real toggle-shaped control exists (an element carrying `aria-pressed`,
which only `ToggleButton` renders here — `SegmentedControlItem` never does), not
merely that some button somewhere has matching text. The rest of the test
(`:1197-1204`) is unchanged — `belowGoalButton` is still a real `<button>` element
reference, so the click/filter-narrows-the-list assertions that follow work
identically.

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

`GoalProjectionFilter` (`:1364`) and `filterGoalProjectionRows` (`:1369` onward) are
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

**A test that passes whether or not the fix is present is worth less than no test.**
For each test below: write it, confirm it passes against your fix, then temporarily
revert *only* the relevant change (per constitution item 23 — you're already in
your own worktree, so this is the sanctioned place to do it), confirm the test
fails for the stated reason, then restore byte-identically and confirm green again.
Report the exact failure output for both.

### Test 1 — a genuinely full-bleed bar is width-capped, and its colour is untouched

**Anchor this on one of the three list-item bars, not the KPI grid bar.** jsdom has
no real layout engine, so no assertion here can measure an actual rendered pixel
width either way — but the KPI bar's width is inert regardless of whether the fix
is present (it's 268px either way, per "The bar count, corrected" above), so an
assertion anchored there would prove the `style` prop was typed without
corresponding to any real behavioural difference. Anchor on a bar where the cap
genuinely changes what a real browser renders: `GoalProjectionRowItem`'s bar (or
either of the other two — your choice, pick one and be consistent) is a reasonable
default since Part 2 already touches that section's filter control, so both tests
can share test-setup context if convenient.

In `CoachHome.test.tsx`, add a new `describe` block immediately after the existing
`<CoachHome /> DES-12 states` block (ends `:1066`) and before `<CoachHome /> T124
dashboard-analytics section DES-12 states` (starts `:1078`) — re-locate these by
searching for the `describe(` text, not the line numbers, since T150 is landing
concurrently in a different part of this same file and may shift lines around it.

Find your chosen bar via its accessible label, not a fragile DOM path — e.g. for
`GoalProjectionRowItem`, the fixture row's own `{name} hours vs. goal` label
(already used as an assertion target elsewhere in this file, `:1189`, so it is
known-fixture-stable) — locate `[role="progressbar"]` whose `aria-labelledby`
target has matching `textContent`, then `.closest('.astryx-progressbar')` for the
styled root (the class name comes from `themeProps('progressbar', {variant})`,
`ProgressBar.tsx:293-294`; verify it's really `.astryx-progressbar` against the
installed source before relying on it).

Assert:
1. `root.style.maxWidth === '480px'` (reading the inline style attribute directly —
   deterministic in jsdom, no browser needed).
2. `root.getAttribute('data-variant') === 'accent'` — the pre-existing, untouched
   default. This is the guard against "helpfully" changing the variant while
   capping the width; mutate `variant="neutral"` (or any other) locally and confirm
   this specific assertion is what catches it, not the maxWidth one.

**Discrimination proof:** remove the `style` prop (or set it to `{}`) at your
chosen site only, confirm assertion 1 fails; separately set `variant="neutral"` at
that same site, confirm assertion 2 fails with the fix's `style` still in place
(i.e. the two assertions are independent, not one accidentally subsuming the
other). Restore both, confirm green.

**Also confirm, without a dedicated new assertion if it's simpler to fold in**, that
the KPI grid's own bar (`:2212-2219`) still carries the same `style` constant post-fix
— criterion 1 covers this; you do not need a second discrimination proof for a site
where the cap is inert, just confirm the prop is present.

### Test 2 — the two-option control is gone, and "Below goal" filtering still works

Extend the existing `<CoachHome /> T124 goal projection` describe block
(`CoachHome.test.tsx:1176-1206` today) rather than replacing its test. **Amend the
button-finder at `:1194-1196`** per "The prescription" above (this is the
authorized test update — cite this packet in your commit/output doc, not just the
constitution clause). The rest of that test's assertions (`:1184-1193`,
`:1197-1204`) are unchanged and should keep passing against your `ToggleButton`.

Add a new assertion, in the same test or a new one in this block, that:
1. `container.querySelector('[role="radiogroup"]')` is `null` anywhere on the page
   (`SegmentedControl` renders `role="radiogroup"` —
   `node_modules/@astryxdesign/core/src/SegmentedControl/SegmentedControl.tsx:263`
   — so this is the exact discriminator for "the two-option control is gone", not
   just "a Below-goal button exists somewhere").
2. `container.querySelector('button[aria-pressed]')` is truthy — this doubles as
   the amended finder from "The prescription" above; you do not need a second,
   separate assertion for it if your amended `belowGoalButton` lookup already
   covers it, but state explicitly in your output doc that you're treating it as
   covered rather than silently skipping it.
3. No button anywhere in the container has `textContent === 'All'` (the option
   that no longer exists) — note `.textContent === 'All'` is still a valid exact
   match here since `'All'` never appears as a real button's full text anywhere in
   this file, unlike `'Below goal'` which now collides with its own duplicated
   label.

**Discrimination proof:** temporarily restore the old `SegmentedControl` JSX,
confirm the new assertions fail (report which one fails and how), remove it again,
confirm green.

---

## Allowed Files

- `src/pages/home/CoachHome.tsx`
- `src/pages/home/CoachHome.test.tsx` — **scoped**. You may only add content
  within/immediately after the `<CoachHome /> DES-12 states` describe block, and
  add-to/amend the `<CoachHome /> T124 goal projection` describe block (see
  Test 1/Test 2 above for exact anchors, including the explicitly-authorized
  `:1194-1196` amendment). **Do not touch the `<CoachHome /> T142/UXC-06 -- Next
  up + Activity feed pair via a responsive Grid` describe block** (near the end of
  the file) or anything inside it — T150 is landing there concurrently in a
  separate worktree, touching only that block. If your diff to this file touches
  anything outside these named regions, stop and report before proceeding; that is
  very likely an unintended overlap with T150, not a needed change for this task.
- `docs/swarm/active/T149-worker-output.md` (create)

You may **read** (not edit) `docs/swarm/dispute-log.md` (D011 and its addendum) and
`docs/swarm/active/T142-worker-packet.md` for context — both are cited above.

## Forbidden Files

- `docs/swarm/constitution.md`, `task-ledger.md`, `verification-log.md`,
  `dispute-log.md`, `auto-mode-decisions.md`
- Any other `docs/swarm/**` file, including other packets
- `.claude/**`
- Anything under `node_modules/`
- Every other file under `src/` — this task is four named `ProgressBar` sites plus
  one control, all on one page

## Acceptance Criteria

1. All four `ProgressBar` sites (`CoachHome.tsx:2212-2219`, `:1873-1878`,
   `:1902-1907`, `:1929-1934` — re-verify exact current lines) carry
   `style={COACH_HOME_PROGRESS_BAR_MAX_WIDTH_STYLE}` (or equivalently named single
   shared constant) resolving to `maxWidth: '480px'`. `value`, `max`, `label`,
   `hasValueLabel`, `formatValueLabel` unchanged at every site; no `variant` prop
   added anywhere.
2. The two-option `SegmentedControl`/`SegmentedControlItem` at `CoachHome.tsx:
   2488-2495` (re-verify) is replaced by a single standalone `ToggleButton` per
   the Part 2 prescription. `SegmentedControl`/`SegmentedControlItem` imports
   removed (confirmed unused elsewhere in the file first).
3. `CoachHome.test.tsx:1194-1196`'s button-finder is amended to
   `container.querySelector('button[aria-pressed]')`, explicitly stated in your
   output doc as an authorized test update per this packet, not a silent
   workaround.
4. Test 1 and Test 2 above exist, pass against the fix, and their discrimination
   proofs are reported with the exact failure output seen at each mutation step.
5. `CoachHome.test.tsx:1184-1193` and `:1197-1204`'s pre-existing assertions in the
   T124 goal projection block (everything except the amended `:1194-1196`) still
   pass unmodified against the `ToggleButton` implementation.
6. `CoachHome.test.tsx:1248-1368`'s T129/UXC-01 region-labelling tests and
   `:1544` onward's BEH-01 milestone-toast test (both unrelated to either change
   here but both render sections Part 1 edits) still pass unmodified — confirm and
   report, don't just assume.
7. No `xstyle`/`stylex.create()` call added anywhere. Confirm by grep in your
   output doc.
8. `npx tsc --noEmit`, `npx vite build`, `npm run format:check`, `npx eslint .` and
   `npx vitest run` all clean. Baseline at this packet's own commit `400816a`:
   1476 tests / 63 files / 354 warnings. **T146 has since merged** — expect
   1477 tests / 64 files after the FIRST step's branch merge, warnings unchanged;
   report what you actually measure rather than either number on trust, since
   other tasks may also have landed by the time you start.
9. Your output doc states plainly that this closes UXC-06 fully on CoachHome (all
   three clauses, across all four `ProgressBar` sites and the one control), or
   explains precisely why not, if you find something that contradicts that.

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
- **Non-Negotiables** — "existing tests must pass unless the boss explicitly
  approves a test update." `CoachHome.test.tsx:1194-1196`'s amendment is exactly
  that approved case — see Part 2's own section on it above. Every other existing
  test in this file must still pass unmodified.
- **Item 19c** — verify your own citations before submitting. Round 1 of this
  packet inherited an unverified "two live sites" premise from a ledger row that
  was itself never checked against the page — the exact failure mode this item
  exists to prevent. Several line numbers were re-derived by the author against
  the current tree for this round, but concurrent tasks (T146, T150, others) may
  move them again before you start. If anything here does not match what you
  find, stop and report the mismatch.
- **Item 23** — mutation experiments (your discrimination proofs) run in your own
  worktree, which you already have. Revert-measure-restore, never leave a mutation
  uncommitted or unreported.

## What changed and why (round 1 → round 2)

Round 1 capped only the KPI grid's `ProgressBar` and treated the SegmentedControl
replacement's test impact as zero-risk. The round 1 premise gate found both wrong:

- **BLOCKER — wrong bar capped.** The KPI grid bar is one of four equal columns at
  every width where UXC-06's own accept clause measures (1440px), already 268px
  wide, so a 480px cap on it is inert. The three bars that genuinely span the full
  1120px content region (`TeamHoursRowItem`, `TopEventRowItem`,
  `GoalProjectionRowItem`, all in single-column `<List>` modules with no `Grid`)
  were never touched. This packet now caps all four with one shared constant.
- **BLOCKER — the "existing assertions keep passing unmodified" claim was
  disproved by the source it cited.** `ToggleButton.tsx:298-307` renders `label`
  twice (once visibly, once in an `aria-hidden` width-reservation span);
  `textContent` doesn't respect `aria-hidden`, so an exact-text button finder
  breaks. The human owner authorized amending the three affected lines
  (`CoachHome.test.tsx:1194-1196`) rather than dropping Part 2 — see Part 2's own
  section on this above for the authorized replacement (`aria-pressed`-based,
  stronger than the original).
- Nine citation corrections folded in throughout (T142 quote location, dispute-log
  wording, astryx-api.md line numbers, test block locations, baseline counts,
  `filterGoalProjectionRows`'s declaration line, and the ParticipationTab
  "shipped" vs. "shipped and tested" distinction) — all independently re-verified
  against the tree before being written down here, not copied from the finding
  that named them.

## Required Worker Output

Create `docs/swarm/active/T149-worker-output.md` covering: the exact current line
numbers you found for all five sites (four `ProgressBar`s, one control — compare
against this packet's, note any drift); the shared `style` constant you defined and
its comment; confirmation `SegmentedControl`/`SegmentedControlItem` had no other
use site before removing the import; both discrimination proofs with full failure
output; which bar you anchored Test 1 on and why; confirmation that
`CoachHome.test.tsx:1184-1193`/`:1197-1204` and `:1248-1368`/`:1544` onward (or
wherever they've moved to) still pass, with the amended `:1194-1196` explicitly
called out as the one authorized change; full command output for all five gates;
explicit confirmation you did not touch `variant` or convert any bar to `GoalBar`;
explicit confirmation you did not edit inside T150's Grid-pairing describe block;
and anything you could not verify, stated plainly as unverified rather than
omitted.

Do not mark this task complete. A checker verifies it.
