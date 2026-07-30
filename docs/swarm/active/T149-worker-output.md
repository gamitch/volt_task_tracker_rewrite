# T149 Worker Output — UXC-06's third clause on CoachHome (ProgressBar caps + ToggleButton)

**Packet SHA pinned:** `8491d073d8e841eb1dc324c4c715d938d5ab6e58` (round 3). Confirmed by
`git fetch origin && git merge origin/claude/swarm-plan-zl575z`, which fast-forwarded my
worktree's HEAD to exactly that SHA (merge was a clean fast-forward, no conflicts to
report). `git log -1 --format=%H HEAD` and `git log -1 --format=%H -- docs/swarm/active/T149-worker-packet.md`
both resolved to `8491d073d8e841eb1dc324c4c715d938d5ab6e58` after the merge.

This closes **UXC-06's third clause** ("no full-bleed bars/controls") on CoachHome,
across all four `ProgressBar` sites and the one control. It does **not** claim UXC-06 is
closed "fully" or "all three clauses" — clause 1 (content cap/centring) and clause 2
(two-up module pairing) belong to T142 (`35b5dd1`) and T150 (`fdc7fd9`) respectively, and
neither is re-verified here; this task's own Allowed Files/fixtures have no way to check
either stayed closed, only that its own clause now is. Reading applied to "no bar or
non-input control spans the full content region": `Toast`, `Banner`, and `EmptyState`
still render full-width by design on this page and are not read as violations here — they
are not bars and not value-scale controls.

## Baseline measured before any edit (post branch-merge)

`npx vitest run` on the merged tree, before touching `CoachHome.tsx`/`CoachHome.test.tsx`:
**64 files / 1478 tests / 0 errors**, matching the packet's stated target exactly.

## Current line numbers found (compare against packet's citations)

All five sites matched the packet's citations exactly, pre-edit:

- KPI bar: `CoachHome.tsx:2212-2219` ✓ (packet's citation, verified)
- `TeamHoursRowItem` bar: `CoachHome.tsx:1873-1878` ✓
- `TopEventRowItem` bar: `CoachHome.tsx:1902-1907` ✓
- `GoalProjectionRowItem` bar: `CoachHome.tsx:1929-1934` ✓
- `SegmentedControl`/`SegmentedControlItem`: `CoachHome.tsx:2488-2495` ✓ — single use
  site in the file, confirmed by grepping the whole file for `SegmentedControl` before
  removing the import (only the import line and this one JSX block matched).

Post-edit (for reference, these will drift again with any future edit above them):
KPI bar `:2212-2219` → now `:2232-2239`; `TeamHoursRowItem` `:1873-1878` → `:1890-1896`;
`TopEventRowItem` `:1902-1907` → `:1920-1926`; `GoalProjectionRowItem` `:1929-1934` →
`:1948-1954`; the control site (now `ToggleButton`) `:2488-2495` → `:2509-2515`. The
shared constant is defined at `:1841-1858`.

## The shared `style` constant

```ts
// UXC-06/T149: cap every ProgressBar on this page near ~480px (the PRD's own
// number, VOLT_UX_Craft_PRD_v3.html:165). Three of the four sites this is
// applied to -- TeamHoursRowItem, TopEventRowItem, GoalProjectionRowItem --
// render inside a single-column `<List hasDividers>` with no `Grid`/column
// constraint, so their bars would otherwise stretch to the page's full
// ~1120px content width (T142's cap) -- that is the actual UXC-06 defect.
// The fourth site (the KPI grid's "Hours vs. team goal" bar) never reaches
// this cap: it lives in one of four `Grid columns={{ minWidth: 240, repeat:
// 'fit' }}` columns, which at a 1120px content width and a 16px gap works out
// to (1120 - 3*16) / 4 = 268px per column before the `KpiCard`'s own `Card`
// padding is subtracted, and to ~495px at the widest this `auto-fit` grid can
// resolve to at any content width -- so a 480px cap on it is inert
// everywhere, not just at 1440px. Applying the same shared constant there
// anyway is simpler than special-casing the one site the cap doesn't bind at.
const COACH_HOME_PROGRESS_BAR_MAX_WIDTH_STYLE: CSSProperties = {
  maxWidth: '480px',
};
```

Applied via `style={COACH_HOME_PROGRESS_BAR_MAX_WIDTH_STYLE}` at all four `ProgressBar`
sites. `value`, `max`, `label`, `isLabelHidden`, `hasValueLabel`, `formatValueLabel` were
not touched at any site. No `variant` prop was added anywhere (confirmed by
`git diff src/pages/home/CoachHome.tsx | grep variant` — no match in the diff).
`CSSProperties` was added to the existing `react` import at `:503` (precedent:
`OutreachList.tsx:2346`'s `MIN_TOUCH_TARGET_STYLE`, imported at `OutreachList.tsx:609`).

## Part 2 — `ToggleButton` replacement

`SegmentedControl`/`SegmentedControlItem` removed from the `@astryxdesign/core` import;
`ToggleButton` added in the existing alphabetical position (between `Toast,` and
`VisuallyHidden,`). Replacement JSX:

```tsx
<ToggleButton
  label="Below goal"
  isPressed={goalProjectionFilter === 'belowGoal'}
  onPressedChange={(pressed) =>
    setGoalProjectionFilter(pressed ? 'belowGoal' : 'all')
  }
/>
```

`GoalProjectionFilter` and `filterGoalProjectionRows` were not touched — no type change
needed. No `ToggleButtonGroup` added; this is a single standalone control, matching the
`ParticipationTab.tsx:939-943` precedent (`isBelowSeventyActive`), which I re-read
directly and confirmed matches this shape.

## Test amendment — authorized, cited

`CoachHome.test.tsx:1194-1196`'s exact-text button finder was amended to
`container.querySelector('button[aria-pressed]')`. This is the packet's authorized
amendment (`docs/swarm/auto-mode-decisions.md`'s "T149: authorizing the `:1194-1196` test
amendment (orchestrator, not George)" entry), not a silent workaround, and is called out
in an inline comment in the test itself citing that record. Independently verified against
installed source, not assumed: `ToggleButton.tsx:298-307` (relative offset in the
`node_modules/@astryxdesign/core/src/ToggleButton/ToggleButton.tsx` file resolved via
Node's normal module walk-up from this worktree, since the worktree's own `node_modules`
is empty except a `.vite` cache dir) renders `label` twice — once visibly at line 300,
once more inside an `aria-hidden="true"` width-reservation span at lines 301-306 —
confirming `textContent` for a rendered `<ToggleButton label="Below goal" .../>` really is
`"Below goalBelow goal"`. `aria-pressed={isPressed}` is set on the underlying `Button` at
`ToggleButton.tsx:319` and is absent from `SegmentedControlItem` (confirmed by grep — no
`aria-pressed` anywhere in `SegmentedControl.tsx`/`SegmentedControlItem.tsx`).

## Regression tests added, both proven to discriminate

Both live in the `<CoachHome /> T124 goal projection` describe block
(`CoachHome.test.tsx:1176` onward pre-edit / `:1176` still, post-edit, since nothing above
it in the file shifted) — the same block the amended Test 2 assertion lives in, per the
packet's scoping. I did not touch the `<CoachHome /> T142/UXC-06 -- Next up + Activity
feed pair via a responsive Grid` describe block (now at `:1456`) or any T150 content
inside it (`COACH_HOME_PAIRED_MODULE_MIN_WIDTH` window test) — confirmed by `git diff`
showing only the `T124 goal projection` block changed in the test file.

### Test 1 — `TeamHoursRowItem`'s bar is width-capped, colour untouched

Anchored on `TeamHoursRowItem`'s bar (fixture team name **"Ravens"**, already asserted
elsewhere in the file's own "T124 hours by team" block — `entry.teamName` becomes the
bar's accessible label `"Ravens hours"`), not `GoalProjectionRowItem`'s or the KPI bar, per
the packet's three reasons (KPI bar's cap is inert regardless of the fix;
`GoalProjectionRowItem` entangles with Part 2's filter and is a D011-addendum `GoalBar`
conversion candidate along with the other two list bars).

Resolution technique: `container.querySelectorAll('[role="progressbar"]')`, then for each
candidate read `aria-labelledby` and resolve via `document.getElementById(id)` (**not**
`CSS.escape` or a bare `querySelector('#'+id)` — both throw in this vitest/jsdom setup,
confirmed by trying `CSS.escape` in a throwaway node REPL check against this project's
jsdom global, which is `undefined` here, and by React 19's `useId` emitting guillemet
characters (`«r0»`-shaped) that are invalid inside a bare CSS selector string). This is
the same technique `CoachHome.test.tsx:1266`'s (T129/UXC-01 block, `resolveAriaLabelledbyTarget`)
already uses.

Assertions:
1. `root.style.maxWidth === '480px'` where `root = bar.closest('.astryx-progressbar')`.
2. `root.getAttribute('data-variant') === 'accent'`.
3. (Folded in per the packet's "no dedicated new assertion" allowance) confirms the KPI
   bar's own `aria-labelledby`-resolved-to-`"Hours vs. team goal"` bar also still carries
   `style.maxWidth === '480px'`.

**Discrimination proof 1 (maxWidth):** removed `style={COACH_HOME_PROGRESS_BAR_MAX_WIDTH_STYLE}`
from `TeamHoursRowItem`'s `ProgressBar` only, ran
`npx vitest run src/pages/home/CoachHome.test.tsx -t "width-capped"`. Failure:

```
AssertionError: expected '' to be '480px' // Object.is equality
- Expected: 480px
+ Received:
 ❯ src/pages/home/CoachHome.test.tsx:1272:50
```

Restored `style={COACH_HOME_PROGRESS_BAR_MAX_WIDTH_STYLE}`.

**Discrimination proof 2 (variant, independent of proof 1):** with `style` restored, added
`variant="neutral"` at the same site only, re-ran the same test. Failure — assertion 1
(maxWidth) passed, assertion 2 (variant) failed:

```
AssertionError: expected 'neutral' to be 'accent' // Object.is equality
Expected: "accent"
Received: "neutral"
 ❯ src/pages/home/CoachHome.test.tsx:1278:48
```

This proves the two assertions are independent — neither subsumes the other. Removed
`variant="neutral"`, restored the site byte-identically to
`style={COACH_HOME_PROGRESS_BAR_MAX_WIDTH_STYLE}` only, re-ran: 90/90 pass, 1 test
targeted (`-t "width-capped"`), confirmed green.

### Test 2 — the two-option control is gone, ToggleButton works

Extends the existing test (amended `:1194-1196` finder, per above) plus a new `it(` in the
same block asserting:
1. `container.querySelector('[role="radiogroup"]')` is `null` — `SegmentedControl` renders
   `role="radiogroup"` at `SegmentedControl.tsx:263` (confirmed by grep — only that one
   `role="radiogroup"` in the whole `SegmentedControl` source tree), so this is the exact
   discriminator.
2. `container.querySelector('button[aria-pressed]')` is truthy — stated explicitly (per the
   packet) as covered by the same lookup as the amended `:1194-1196` finder; not a second,
   separate implementation, but asserted directly here too since this test is
   self-contained and re-renders independently.
3. No button anywhere has `textContent === 'All'`.

**Discrimination proof:** temporarily restored the old `SegmentedControl`/`SegmentedControlItem`
JSX and re-added their imports (removing `ToggleButton`'s JSX use only — its import was
left in place alongside the temporarily-restored `SegmentedControl` imports to avoid an
unrelated `ReferenceError` from other code paths), ran
`npx vitest run src/pages/home/CoachHome.test.tsx -t "T124 goal projection"`. Two failures,
both in the T124 goal projection block, both for the stated reason:

```
FAIL <CoachHome /> T124 goal projection > renders the fact-stating annotation and the Below-goal filter narrows the list
AssertionError: expected null to be truthy
 ❯ src/pages/home/CoachHome.test.tsx:1204:29   (the amended :1194-1196 finder -- aria-pressed
   does not exist on SegmentedControlItem)

FAIL <CoachHome /> T124 goal projection > T149/UXC-06: the two-option SegmentedControl is gone, replaced by a standalone ToggleButton
AssertionError: expected <div role="radiogroup" …(4)>…(3)</div> to be null
 ❯ src/pages/home/CoachHome.test.tsx:1225:60
```

Restored the `ToggleButton` JSX and pruned the temporarily-restored
`SegmentedControl`/`SegmentedControlItem` imports back out, byte-identical to the
post-Part-2 state. Re-ran `npx vitest run src/pages/home/CoachHome.test.tsx`: 90/90 pass.
`git diff src/pages/home/CoachHome.tsx` after restoration shows only the intended
Part 1/Part 2 changes — no residual mutation artifacts.

## Confirmation: pre-existing assertions and unrelated blocks still pass

- `CoachHome.test.tsx`'s `T124 goal projection` block's pre-existing assertions
  (everything in the first `it(` except the amended finder) — pass unmodified against the
  `ToggleButton` implementation (verified in every full-suite and full-file run above).
- `T129/UXC-01` region-labelling tests (now at `:1334` onward) — pass unmodified; not in
  the diff.
- `T142/UXC-06` Grid-pairing describe block and its nested T150 window test (now at
  `:1456` onward) — pass unmodified; not in the diff. I did not edit inside this block.
- BEH-01 milestone-toast test — the packet cited `:1544`; in the pre-edit tree (post
  branch-merge, before my test-file edits) it was actually at `:1590`, and after my +92
  lines added to the `T124 goal projection` block it is now at `:1676`. This is line drift
  from prior merges (T146/T150 landing), not a defect in this packet — flagging it since
  the instructions asked me to report citations that don't match rather than silently
  correct them. The test itself was not touched and passes (confirmed in every full-suite
  run above, including the final one below).

## Final gate results (measured on the tree with edits committed, no mutations pending)

- `npx tsc --noEmit` — clean, no output, exit 0.
- `npx vite build` — succeeded (`✓ built in 10.50s`), same large-chunk advisory as
  baseline (`index-*.js` 673.24 kB), no new errors.
- `npm run format:check` — "All matched files use Prettier code style!"
- `npx eslint .` — **0 errors, 354 warnings** (same warning count/class as the packet's
  stated baseline — all `react-refresh/only-export-components`, none in files this task
  touched).
- `npx vitest run` — **64 files / 1480 tests / 0 failures**. 1480 = the 1478-test baseline
  plus the 2 new `it(` blocks this task added (Test 1's width/colour test and Test 2's
  explicit "control is gone" test); the amended `:1194-1196` finder is inside an existing
  `it(`, not a new one, so it doesn't add to the count.

## Explicit confirmations

- Did not touch `variant` on any `ProgressBar`, and did not add `hasValueLabel` anywhere
  it wasn't already present (confirmed by the diff above — only `style` was added at each
  site).
- Did not convert any bar to `GoalBar`.
- Did not add any `xstyle`/`stylex.create()` call (confirmed by grep on the diff).
- Did not edit inside the `T142/UXC-06` Grid-pairing describe block or any T150 content.
- `SegmentedControl`/`SegmentedControlItem` had no other use site in `CoachHome.tsx`
  before removal (confirmed by grep of the whole file pre-edit).

## Unverified / not independently re-derived

- I did not independently re-measure the packet's Chromium pixel figures (1076/1017/1076
  uncapped, 480 capped, 244 KPI) in a real browser myself — jsdom cannot reproduce layout,
  and no browser-automation tool was available in this environment for this task. I relied
  on the packet's stated gate-measured figures for the narrative comment and design
  rationale, but the actual regression tests assert the deterministic, jsdom-provable facts
  instead (the inline `style.maxWidth` attribute value and `data-variant`), not the
  computed rendered width, which is exactly what the packet's own Test 1 design already
  accounts for.

## Files changed

- `src/pages/home/CoachHome.tsx`
- `src/pages/home/CoachHome.test.tsx`
- `docs/swarm/active/T149-worker-output.md` (this file)

Not marking this task complete. A checker verifies it.
