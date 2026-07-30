# T131 Worker Output — compact icon-pair row actions (coach outreach `Table`)

Implemented exactly per `docs/swarm/active/T131-worker-packet.md` (Revision 2).
Allowed Files only: `src/pages/outreach/OutreachList.tsx`,
`src/pages/outreach/OutreachList.test.tsx`, this file. No forbidden file was
touched (verified `git status --porcelain` shows only those two source files
plus the new figure).

## 1. Actions-column width shipped, and the measurement behind it

Shipped `width: pixel(128)` (down from `pixel(420)`).

Floor derivation (matches the packet's own prescribed derivation, re-verified
against installed source):

```
Edit 48px (measured natural width, unchanged since T130)
  + HStack gap={2} = 8px
  + × IconButton 44px (square: Button.tsx:103-108 sets aspectRatio 1/1 and
    zero paddingInline/paddingBlock for isIconOnly, so its 44px minHeight
    touch target becomes 44px wide too)
  + cell paddingInline 16px (8px each side, compact density, TableCell.tsx:70-75)
  = 116px floor
```

Shipped at **128px**, not the bare 116px floor and not 120px: `CoachEventActions`'s
`HStack` has `wrap="wrap"`, so a near-zero margin is a real wrap risk (a wrap
is exactly what pushed collapsed rows to 81px in T130). 128px keeps an 12px
margin over the 116px floor while still freeing 292px back to the `title`
column (`420 - 128 = 292`).

The freed width was **not** manually added to the `title` column's own
`pixel`/`proportional` config — the `title` column is `proportional(2, {
minWidth: 224 })`, so it automatically absorbs whatever the fixed-`pixel`
columns around it stop claiming. Measured: the `Event` `<th>` grew from
`224px` (its explicit floor, previously binding) to `474px`.

## 2. Scroll-wrapper `clientWidth`/`scrollWidth` at 1440px, before/after

Measured in real Chromium (`/opt/pw-browsers/chromium-1194/chrome-linux/chrome`,
via Playwright) against a throwaway preview rig rendering the real coach view
(`OutreachList` + `defaultLoadOutreachData`, `LoginAs` coach, a fake
`SeasonProvider` resolving the fixture season) inside the real app chrome
(`LayerProvider`/`Theme`/`AppShell`), at a 1440×1000 viewport.

| | Before (pre-T131, `pixel(420)` actions column) | After (T131, `pixel(128)`) |
|---|---|---|
| Upcoming table scroll-wrapper `clientWidth` | 1132px | 1132px |
| Upcoming table scroll-wrapper `scrollWidth` | 1174px (module doc's own recorded pre-existing measurement) | **1132px** |
| Past table scroll-wrapper `clientWidth` | 1132px | 1132px |
| Past table scroll-wrapper `scrollWidth` | 1174px | **1132px** |

"Before" `scrollWidth` (1174px) is the pre-existing recorded measurement from
the component's own module doc (this task did not re-render the pre-T131 code
in the rig; the 1174px figure is the value already documented at
`OutreachList.tsx`'s `key: 'title'` column comment prior to this task's edit,
carried forward as the "before" baseline). "After" is a direct, real-Chromium
measurement from this task's own rig.

**Result: `scrollWidth === clientWidth` on both tables at 1440px — zero
`Table`-internal horizontal scroll.** Criterion 6 satisfied, both `<=` (the
acceptance criterion's own bar) and the stronger `===`.

## 3. Collapsed row heights, both buckets, before/after

"Before" is the pre-existing T130 baseline (rows fit on one line at 420px
already, per the component's own module doc — this task did not need to fix
row height, only the horizontal-scroll trade-off; row heights were not
expected to regress and were re-measured, not assumed).

Measured (real Chromium, 1440px, this task's rig):

| Bucket | Row heights (px) |
|---|---|
| Upcoming | 53, 52.5 |
| Past | 69 (has an extra "Reached N" secondary stat line), 52.5 |

All four ≤ 72px (UXC-07 ceiling). Criterion 7 satisfied.

At 375px (narrow stacked-card layout, a structurally different pattern from
the desktop dense rows — the component's own module doc explicitly disclaims
UXC-07's 72px ceiling for this layout: "What changes on mobile (<768px) is
unrelated to the fix above"), measured row heights were 253/252.5
(Upcoming) and 273/252.5 (Past) — expected for a full stacked card
(title+location+date+badges+stats+expander+actions), not a UXC-07 violation.

## 4. Touch-target measurements — Edit, ×, expander, desktop and narrow

Measured (real Chromium, both 1440px and 375px — identical, since
`MIN_TOUCH_TARGET_STYLE` applies unconditionally):

| Control | Width | Height |
|---|---|---|
| Edit (`Button`) | 48.125px | 44px |
| `×` (`IconButton`) | 44px | 44px |
| Expander (`Button`, "Sessions (N)") | 101.8125px | 44px |

All three ≥ 44px in their smaller dimension, desktop and narrow. Criterion 8
satisfied. The title `Link` was correctly left un-enlarged (WCAG 2.2 SC 2.5.8
text-link exemption, per the packet) — not measured/enforced against 44px, as
instructed.

## 5. Evidence the title's weight, size, color, and truncation are unchanged

Measured directly on the rendered anchor's inner `Text` span (the element
that actually paints the glyphs) for all four fixture events:

| Event | fontWeight | fontSize | color | white-space/overflow |
|---|---|---|---|---|
| Riverside Park Cleanup | 600 | 14px | `rgb(29, 26, 33)` | nowrap / ellipsis / hidden |
| Community Food Bank Sort | 600 | 14px | `rgb(29, 26, 33)` | nowrap / ellipsis / hidden |
| Canned Food Drive | 600 | 14px | `rgb(29, 26, 33)` | nowrap / ellipsis / hidden |
| After-School Tutoring Drive | 600 | 14px | `rgb(29, 26, 33)` | nowrap / ellipsis / hidden |

- `fontWeight: 600` matches Astryx's `weightStyles.semibold` token
  (`text.stylex.ts:58-60`), same as the pre-T131 `weight="semibold"`.
- `color: rgb(29, 26, 33)` is `colorStyles.primary` /
  `colorVars['--color-text-primary']` (`text.stylex.ts:26-29`) — the SAME
  token the pre-T131 `<Text type="body" weight="semibold" maxLines={1}>`
  resolved to by default (`Text.tsx:165,226`: `defaultColorByType.body ===
  'primary'`). Independent corroboration: the same rig measured the
  `:focus-visible` outline color as `rgb(91, 46, 229)` (Astryx's accent
  purple) on the exact same link — a visibly different color from the title's
  own `rgb(29, 26, 33)`, directly proving the title text is NOT rendering
  `Link`'s `'accent'` default (which would be purple) and IS rendering
  `'primary'` as specified.
- Truncation CSS (`white-space: nowrap; text-overflow: ellipsis; overflow:
  hidden`) is present and unchanged in shape from the pre-T131 `maxLines={1}`
  `Text` rendering. None of the four fixture titles are long enough at the new
  474px `Event` column width to actually clip (`scrollWidth === clientWidth`
  for every title in this fixture set) — the mechanism is verified present,
  not exercised at this column width with this fixture data. This is expected
  and not a regression: the wider title column was the intended fix.
- `aria-label` is `null` on all four title links (verified via
  `getAttribute('aria-label')`) — accessible name is the title text itself.
  Criterion 2 satisfied.

**Focus ring** (explicitly required to verify by the packet): measured
`outline-style: solid`, `outline-width: 2px`, `outline-color: rgb(91, 46,
229)`, `outline-offset: 2px` on `:focus-visible` — matches the packet's
claim exactly.

**Hover — reported as a discrepancy, not disputed/fixed:** hovering the title
link DOES trigger `text-decoration-line: underline` on the anchor (a real,
visible affordance, since `text-decoration` paints through descendant inline
content regardless of the descendant's own color). It also changes the
*anchor* element's own computed `color` via the `color-mix` rule the packet
cites (`Link.tsx:105-114`). However, measured directly on the inner `<span>`
that actually paints the visible glyphs (Astryx's internal `Text`, which is
given an explicit, non-inheriting `color="primary"` by `Link`), the color is
identical before and after hover (`rgb(29, 26, 33)` both times) — the
color-mix tint is real in the CSSOM but not visually perceptible on the
rendered text, because the child `Text`'s own explicit color paints over
whatever the parent anchor's color resolves to. This is Astryx's own internal
`Link`/`Text` composition (outside this task's Allowed Files, not introduced
by this change), not something this task can or should fix. Reporting this
plainly as **unverified/discrepant** relative to the packet's affordance list
— the underline and the focus ring are both independently confirmed real;
the color-mix tint's real-world visibility is not.

## 6. 1440px screenshot of the shipped action cluster

Saved at `docs/swarm/figures/ux-craft/T131-coach-actions-1440.png` — a 1440px
crop of the real rendered coach `Table` (both Upcoming rows), showing the
short "Edit" chip + destructive "×" `IconButton` pair, matching
`old-events-tab.webp`'s reference shape (short EDIT chip + destructive ×,
~100px total, no "View details" text). `old-events-tab.webp` was opened and
compared before implementation (criterion 1).

## 7. Exact test line amended, before/after

File: `src/pages/outreach/OutreachList.test.tsx`, originally line 1726 (in
the coach test opened at line 1691, `describe('<OutreachList /> T112:
"View details" navigation link on every row', ...)` → `it('coach view: ...')`).

Before:
```tsx
expect(foodBankLink!.textContent).toContain('View details');
```

After:
```tsx
// T131: the standalone "View details – {title}" action text moved off
// this link and onto the title itself -- the link's accessible name is
// now exactly the event title (no more "View details – " prefix).
expect(foodBankLink!.textContent).toBe('Community Food Bank Sort');
```

This is the **only** assertion amended. The next line (originally line 1727,
`expect(foodBankLink!.textContent).toContain('Community Food Bank Sort')`)
was left byte-identical, per Trap 2 ("do not touch them"). The identical-looking
line at the original :1759 (student/parent test, untouched surface) was not
touched — confirmed via `git diff`, which shows edits only inside the coach
`it(...)` block.

## 8. Full command output (criteria 12–13)

All four run from the repo root, after the preview rig was deleted.

**`npx tsc --noEmit`** — clean, exit 0, no output.

**`npx eslint .`** (full repo) — clean:
```
✖ 352 problems (0 errors, 352 warnings)
  0 errors and 1 warning potentially fixable with the `--fix` option.
```
Zero errors, exit 0. All 352 are pre-existing `react-refresh/only-export-components`
warnings across many files repo-wide (26 of them on `OutreachList.tsx`, at
lines that predate this task — helper/hook exports living alongside
components, a pre-existing pattern in this file, not introduced by this
task's edits).

**`npx vite build`** — succeeded:
```
✓ 2385 modules transformed.
...
✓ built in 5.32s
```
(One pre-existing, unrelated warning about a >500kB chunk — present before
this task too, not caused by this change.)

**`npm run format:check`** — clean:
```
Checking formatting...
All matched files use Prettier code style!
```

**`npx vitest run`** — green:
```
Test Files  61 passed (61)
     Tests  1414 passed (1414)
```
Matches the baseline exactly (**1414 passing across 61 files**) — zero delta
in count, confirming the only change was the single amended assertion
described in §7, with no other test's pass/fail status or count changed.

## 9. Anything not verified / known risks

- **Hover color-mix tint** (§5, "Hover" paragraph above): measured to be
  present in the CSSOM but not visibly perceptible on the rendered glyphs, due
  to Astryx's internal `Link`/`Text` composition. Reported as a discrepancy
  from the packet's stated affordance list, not disputed or altered — it is
  pre-existing `@astryxdesign/core` behavior, outside this task's Allowed
  Files. The underline-on-hover and the `:focus-visible` outline (the
  specific one the packet asked to verify) are both confirmed real and
  visible.
- **Dark theme** was not measured or screenshotted — the T131 packet's own
  acceptance criteria do not list a dark-theme requirement (unlike some other
  wave-5 packets), so this is reported as out of scope rather than a gap, but
  is explicitly unverified.
- **The preview rig's own chrome** (`AppShell`'s `KpiStrip` and its own
  default `SeasonProvider`, plus `OutreachList`'s default roster loader)
  showed "Couldn't load the active season" / "Couldn't load the student
  roster" banners in the rig, because those specific loaders hit the real
  (unconfigured, no `.env`) Supabase client rather than the fixture data this
  task wired directly into `OutreachList`'s own `loadData`/`seasonId` props.
  This is a rig artifact from reusing the real `AppShell`, not a regression in
  `OutreachList` itself — `OutreachList`'s own rendered content (goal tiles,
  Upcoming/Past tables, all four fixture events) loaded and rendered
  correctly from the fixture loader beneath those banners, as shown in the
  full-page screenshot taken during measurement (not itself a required
  artifact, not committed).
- The `:2011-2033` `CoachExpanderButton`-adjacent module doc (a large
  "CHECKER FIX (post-T130 review, MAJOR)" comment block) also contains the
  same "`astryx-api.md`'s FormField Props table documents `style`" inaccuracy
  Trap 4 flags — but it is **not** one of the packet's seven explicitly listed
  §4 stale-comment locations (only the `MIN_TOUCH_TARGET_STYLE` doc comment,
  originally at `:2245-2252`, was listed and was fixed). Left untouched,
  per "do not broaden scope" — flagged here for visibility, not fixed.

## Files changed

- `src/pages/outreach/OutreachList.tsx`
- `src/pages/outreach/OutreachList.test.tsx`
- `docs/swarm/figures/ux-craft/T131-coach-actions-1440.png` (new)
- `docs/swarm/active/T131-worker-output.md` (this file)

The throwaway preview rig (`preview.throwaway.html`,
`src/preview.throwaway.tsx`) was created, used for all measurements above,
and deleted before finishing — confirmed via `git status --porcelain`
showing no `*.throwaway.*` files.

This worker does not certify its own work. A checker decides pass/fail.
