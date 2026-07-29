# T142 Worker Output — cap the dashboard content, pair Next up + Activity feed

Packet SHA pinned and confirmed: `fb7ba620ebee4015f20b5ce4867f75ca1337278b`
(`git log -1 --format=%H -- docs/swarm/active/T142-worker-packet.md`).

## FIRST — merge result

`git fetch origin` + `git merge origin/claude/swarm-plan-zl575z`: **fast-forward,
no conflicts** (`Updating 2146255..fb7ba62`, 143 files changed). This worktree's
branch started at an older point (before T142's packet, and before T131/T143/
T144/T145 landed); the merge brought it current. `npm install` was then run
(no `node_modules` existed yet in this worktree) — 340 packages, 0 install errors.

## Files changed

- `src/pages/home/CoachHome.tsx` — Part 1 (cap/centre) and Part 2 (pairing Grid).
- `src/pages/home/CoachHome.test.tsx` — two new jsdom tests (criteria 4 and 9).
- `docs/swarm/active/T142-worker-output.md` (this file).

No other file was touched. Two throwaway rig files (`capture.throwaway.html`,
`src/capture.throwaway.tsx`) were created, used, and deleted — confirmed gone,
`git status --short` above shows only the two allowed files modified.

## A citation that looked wrong at first, and how it resolved

The packet's `minWidth` derivation cites `SideNav.tsx:65` for "260px". This
project's own `src/components/nav/SideNav.tsx` (183 lines) has no numeric width
anywhere — `grep -n "260" src/components/nav/SideNav.tsx` returns nothing. This
looked like exactly the kind of citation mismatch I was told to stop and report
rather than guess past.

Resolution: this codebase has an established precedent (T128's own annotation in
`astryx-api.md`'s AppShell section, and T134's rig) of citing the **installed
vendor source directly**, `node_modules/@astryxdesign/core/src/...`, not just our
own wrapper files with the same basename. `node_modules/@astryxdesign/core/src/
SideNav/SideNav.tsx:65` reads `width: 260,` verbatim — the packet's citation is
correct, it just names the vendor file, not our project's `SideNav.tsx` wrapper
(which re-exports/wraps it with no width override). I did not treat this as
resolved on inference alone: I ran `npm install` to get `node_modules` into this
worktree and read the vendor file directly before trusting the number.

**A second thing I found: Part 1's own worked example is wrong, and mine is the
correct, measured figure.** Part 1's illustrative text reads "Measured at
1440px: outer 1152 → inner 1120, 16px each side." Live measurement in this task
(below: outer 1132, 6px each side) does not match it. Reverse-computing
1152 = 1440 − 240 (not 260) − 48 shows Part 1's example was built on the
packet's earlier, incorrect 240px SideNav figure — the figure revision 2's own
errata corrected to 260px for the `minWidth` derivation, but never
back-propagated into Part 1's example. **Confirmed directly by the packet's
author: this is the packet's error, not a deviation on my part.** The packet's
"1152 / 16px" figures are stale and wrong; my measured "1132 / 6px" is the real
number at this (correct, 260px) SideNav width and is what the checker should
treat as ground truth. Part 1's *prescription* itself (the JSX shape) is
unaffected and is what this task actually needed to get right — criterion 2's
real requirement, border-box == content-box, holds regardless of which
SideNav-width assumption produced the illustrative gap number.

## Part 1 — cap and centre

```tsx
<LayoutContent padding={6}>
  <VStack hAlign="center">
    <VStack width="100%" maxWidth={1120} gap={6}>
      {/* ...all existing content, unchanged... */}
    </VStack>
  </VStack>
</LayoutContent>
```

Exactly the prescribed shape: outer `hAlign="center"`, inner capped `VStack`
with **no** `padding` prop. Only documented props used (`hAlign`, `width`,
`maxWidth`, `gap`) — no `style` prop anywhere in the diff.

### Measured at 1440×900 (real Chromium, full `AppShell`/`SideNav`/`theme.css`)

| | value |
|---|---|
| Capped element **border-box** width | **1120px** |
| Capped element **content-box** width | **1120px** |
| `box-sizing` | `border-box` (confirms `theme.css`'s universal reset was loaded — a rig that omits it would read `content-box` here and the content-box number would be wrong) |
| Space left of capped content | 6px |
| Space right of capped content | 6px |

**Border-box and content-box are equal (both 1120px)** — this is the
criterion-2 discriminator; no double-padding occurred. (Outer width and
side-gap here are 1132px / 6px, not the packet's Part 1 example of 1152px /
16px — that example is confirmed wrong, built on a stale 240px SideNav
assumption; see "A citation that looked wrong at first" above. Treat 1132/6px,
not 1152/16px, as the correct figure at this SideNav width. The equality that
actually matters for criterion 2, border-box == content-box == 1120, holds
either way.)

### Measured at 1024×800 and 375×812 (cap not in effect — content narrower than 1120)

| viewport | capped border-box | capped content-box |
|---|---|---|
| 1024 | 716px | 716px |
| 375 | 327px | 327px |

Equal at every width tested, as expected (the cap only constrains width once
available space exceeds 1120px; below that the `VStack` just fills its
container, and border-box == content-box trivially since there's no `maxWidth`
clamping happening).

## Part 2 — pair Next up + Activity feed

```tsx
<Grid columns={{ minWidth: COACH_HOME_PAIRED_MODULE_MIN_WIDTH, max: 2 }} gap={4}>
  <VStack gap={3}>{/* Next up: unchanged Heading + role="group" content */}</VStack>
  <VStack gap={3}>{/* Activity feed: unchanged Heading + role="group" content */}</VStack>
</Grid>
```

The `<Divider />` that used to sit between the two stacked `VStack`s (old
`:2343`, now inside the removed block) is deleted. The `Divider`s immediately
above and below the `Grid` are unchanged and confirmed still present (see the
regression test below).

### `minWidth` — derivation

```
export const COACH_HOME_PAIRED_MODULE_MIN_WIDTH = 280;
```

Inputs (all read from source, not assumed):
- SideNav = 260px (`node_modules/@astryxdesign/core/src/SideNav/SideNav.tsx:65`,
  `width: 260`), present ≥768px (`AppShell.tsx`'s `mobileNav={{ content: ... }}`
  passes no `breakpoint`, so `MobileNavConfig`'s documented default `'md'` =
  768px applies — `astryx-api.md`'s own `breakpoint` row).
- `LayoutContent padding={6}` = 24px/side = 48px total.
- Grid's own `gap={4}` = 16px (`--spacing-4`, `node_modules/@astryxdesign/core/
  src/theme/tokens.stylex.ts:159`).

**Constraint A** (two columns must fit at 1024, UXC-06's accept clause):
`minWidth ≤ (1024 − 260 − 48 − 16) / 2 = 700 / 2 = 350`

**Constraint B** (one column forced at 375, no SideNav):
`minWidth > (375 − 48 − 16) / 2 = 311 / 2 = 155.5`

**Window: 155.5 < minWidth ≤ 350.** Chose **280** — 124px of margin above the
floor, 70px below the ceiling, so small drift in any input doesn't flip either
boundary. (Full arithmetic is also inline as a doc comment on the constant
itself, `CoachHome.tsx:1141-1173`, so it survives independent of this doc.)

### Measured — all three widths, real Chromium, full `AppShell`

Rig: `capture.throwaway.html` + `src/capture.throwaway.tsx` (both deleted
before finishing), mounting the real `App`-equivalent provider stack —
`MemoryRouter` → `LoginAs(coach)` (`test-utils/authHarness.tsx`) →
`LayerProvider` → `Theme(voltTheme)` → the real `AppShell` (real `SideNav`,
real `KpiStrip`/`SeasonProvider` failing safe to anonymous/no-season with no
`.env`, exactly as documented elsewhere in this repo) → `CoachHome`. `theme.css`
is imported by the entry file, same as production `main.tsx`. Served via
`npx vite --port 4174` (dev server, not build/preview — the throwaway HTML
entry isn't part of the production `index.html`). Driven by real Chromium
(`/opt/pw-browsers/chromium-1194/chrome-linux/chrome`) via the sandbox's
globally-installed `playwright` package.

**1440×900:**

| | value |
|---|---|
| `data-columns` on the pairing `Grid` | **absent** (confirmed via `getAttribute`, returns `null`) |
| `className` | `astryx-grid gap-4 xrvj5dj xqketvx x18g69wz` (no `columns-2` token) |
| computed `grid-template-columns` | `552px 552px` |
| `--x-gridTemplateColumns` inline value | `repeat(auto-fill, minmax(min(100%, max(280px, calc((100% - 1 * var(--spacing-4)) / 2))), 1fr))` |
| Next up `top`/`left` | 603 / 290 |
| Activity feed `top`/`left` | 603 / 858 |
| Side by side (same top, Activity left of Next-up's left edge) | **yes** |

**1024×800:**

| | value |
|---|---|
| computed `grid-template-columns` | `350px 350px` |
| Next up `top`/`left` | 691 / 284 |
| Activity feed `top`/`left` | 691 / 650 |
| Side by side | **yes** — this is the criterion that catches an over-large `minWidth`; 280 ≤ the 350 ceiling with room to spare |

**375×812:**

| | value |
|---|---|
| computed `grid-template-columns` | `327px` (one track) |
| Next up `top`/`left` | 1059 / 24 |
| Activity feed `top`/`left` | 1172 / 24 |
| Stacked (Activity's top ≥ Next-up's bottom) | **yes** |
| `document.documentElement.scrollWidth` vs `innerWidth` | 375 / 375 (equal — **not** used as proof, per the packet's own warning; reported only as a secondary data point) |
| `LayoutContent`'s own `scrollWidth`/`clientWidth` | 375 / 375 (equal — no internal overflow either) |

All three widths match the intended behavior: two-up at 1440 and 1024, stacked
at 375.

### Extra proof — actually triggering the `columns={2}` trap in the same live rig

Not required by the acceptance criteria, but since criterion 5 warns at length
about a broken state that can look fine on the wrong check, I reproduced it
directly: temporarily changed the shipped `columns={{minWidth: ..., max: 2}}`
to the literal `columns={2}`, re-measured at 375×812 in the same rig, then
reverted.

**With `columns={2}` (broken, at 375×812):**

| | value |
|---|---|
| `data-columns` | `"2"` |
| `className` | `astryx-grid columns-2 gap-4 ...` |
| computed `grid-template-columns` | `217.078px 106.594px` (two tracks — NOT the packet's illustrative `151.5/151.5`, because `repeat(2, 1fr)`'s implicit `minmax(auto, 1fr)` lets the two tracks size unevenly to each module's own min-content; the exact split depends on this page's specific content, but it is unambiguously two tracks) |
| `--x-gridTemplateColumns` | `repeat(2, 1fr)` |
| Next up / Activity feed `top` | 1059 / 1059 (same row) |
| Side by side at 375px | **yes — broken** |
| `LayoutContent` `scrollWidth`/`clientWidth` | 375 / 375 (**no overflow** in this specific case — the columns compress instead of overflowing; this differs from the packet's "470 vs 375" illustrative number, but demonstrates the same underlying point even more directly: the overflow-based check is not reliable evidence either way, since here the broken state produces *no* overflow at all, yet is still visibly wrong via `getBoundingClientRect`) |

Reverted to `columns={{ minWidth: COACH_HOME_PAIRED_MODULE_MIN_WIDTH, max: 2 }}`
and re-ran the full three-width measurement above to confirm the restore —
results shown above are post-restore. `git status --short` after the browser
session showed no diff beyond the two allowed files (the revert-and-restore
was done via matched `Edit` calls, never left mid-flight).

## Criterion 4 — `data-columns` discriminator (jsdom, primary proof)

`src/pages/home/CoachHome.test.tsx`, new test
`'the Grid pairing the two modules carries no data-columns attribute (the
columns={2} discriminator)'`: renders the real component, finds the `Grid`
ancestor (`.astryx-grid`) of both headings, asserts it's the *same* element for
both, asserts `hasAttribute('data-columns')` is `false`, and asserts the
`columns-2` class token (the "bonus discriminator" the round-2 premise gate
found) is also absent. Passes.

## Criterion 8 — accessible names survived

`CoachHome.test.tsx`'s existing, unmodified `describe('<CoachHome /> T129
UXC-01 ...')` block (originally packet-cited `:1247-1300`; in the current tree
it's `:1247-1343`, shifted by the merge but the same tests, unedited by this
task) queries each section's `h2` text, resolves `[role="group"][aria-
labelledby="<id>"]`, and asserts the resolved element's `textContent` equals
the heading text — for **all five** sections, including Next up and Activity
feed, in both the populated and empty branches. This passed unchanged both
before and after my edit (`npx vitest run src/pages/home/CoachHome.test.tsx`:
85/85 before my two new tests were added, 87/87 after). The `role="group"` +
`aria-labelledby` wrappers are byte-for-byte unmoved by this task — they are
now nested one level deeper (inside the `Grid` instead of directly inside the
outer `VStack`), which does not affect `aria-labelledby` resolution (it
resolves by `id`, not by DOM proximity) and does not affect the `[role="group"]`
selector (ancestor depth is irrelevant to `querySelector`).

## Criterion 9 — regression test, with discrimination proof

New test `'regression: the two headings share exactly one Grid ancestor, whose
track template is the responsive form, not a bare two-column fixed grid'`:
asserts both headings resolve to the *same* `.astryx-grid` ancestor, that its
`--x-gridTemplateColumns` inline custom property contains `repeat(auto-fill`
and the literal `280px`, and is not the bare string `repeat(2, 1fr)`; also
asserts the immediately-flanking siblings are both `role="separator"`
(Astryx's `Divider` renders `<div role="separator">`, not an `<hr>` — checked
against the vendor source, `node_modules/@astryxdesign/core/dist/Divider/
Divider.js:116-118`, before writing this assertion).

**Discrimination proof, exactly as instructed:** temporarily edited
`CoachHome.tsx` to replace the `Grid` wrapper with a plain `<VStack gap={6}>`
(a real revert to "pairing undone," not a toy example), re-ran
`npx vitest run src/pages/home/CoachHome.test.tsx -t "T142"`:

```
× ... carries no data-columns attribute ...
  → expected null to be truthy   (closestAstryxGrid: no .astryx-grid ancestor found)
× ... regression: the two headings share exactly one Grid ancestor ...
  → expected null to be truthy   (same failure)
 Test Files  1 failed (1)
      Tests  2 failed | 85 skipped (87)
```

Both new tests failed, for the expected reason (no `.astryx-grid` ancestor
exists once the `Grid` is replaced by a plain `VStack`). Restored the `Grid`
via a matched `Edit` (not a git checkout, to keep the change surgical), re-ran
`npx tsc --noEmit` (clean) and `npx vitest run src/pages/home/CoachHome.test.tsx`
(87/87 passed, confirming the restore was byte-for-byte). `git status --short`
after the restore shows no leftover `data-throwaway-*` marker or diff artifact
from the probe.

## UXC-06's remaining clause — explicitly still open

**This task does NOT close UXC-06.** The "no full-bleed bars/controls" clause
is untouched. Two live sites remain on this page after T142, exactly as scoped
out by the packet:

- The two-option `SegmentedControl` ("All" / "Below goal") on the Goal
  projection module — full width of its module column.
- The module-width `ProgressBar` inside the "Hours vs. team goal" `KpiCard`.

Neither was modified. Do not read this task as having closed UXC-06 on this
page.

## Full command output

### `npx tsc --noEmit`
No output (clean, exit 0).

### `npx vite build`
```
✓ built in 5.86s
```
(Pre-existing "chunk larger than 500 kB" advisory on the main bundle, unrelated
to this task, present before this task's changes.)

### `npm run format:check`
```
Checking formatting...
All matched files use Prettier code style!
```

### `npx eslint .`
```
✖ 354 problems (0 errors, 354 warnings)
  0 errors and 1 warning potentially fixable with the `--fix` option.
```
Matches this packet's stated post-T143 baseline (354 warnings) exactly. All 354
are the pre-existing `react-refresh/only-export-components` warnings this
codebase already carries at every file that exports a constant alongside a
component (confirmed: `npx eslint src/pages/home/CoachHome.tsx` alone reports
31 such warnings, none at the new `COACH_HOME_PAIRED_MODULE_MIN_WIDTH` export
line — that export apparently doesn't trip the rule the way the others do,
worth noting but not investigated further since it's a pre-existing lint rule
behavior, not something this task changed).

### `npx vitest run`
```
 Test Files  63 passed (63)
      Tests  1476 passed (1476)
```
Baseline was 63 files / 1474 tests (per this packet, post-T143). This task adds
exactly 2 new tests to the existing `CoachHome.test.tsx` file (no new file), so
63 files / 1476 tests is the expected, fully-explained delta — not a surprise
regression.

## Commands run (chronological summary)

```
git fetch origin
git merge origin/claude/swarm-plan-zl575z
git log -1 --format=%H -- docs/swarm/active/T142-worker-packet.md
npm install
npx tsc --noEmit
npx prettier --write src/pages/home/CoachHome.tsx
npx eslint src/pages/home/CoachHome.tsx
npx eslint .
npx vitest run
npx vitest run src/pages/home/CoachHome.test.tsx
# (discrimination proof: temporary Grid -> VStack edit, re-test, restore, re-test)
# throwaway measurement rig (created, used, then deleted):
#   capture.throwaway.html, src/capture.throwaway.tsx
npx vite --port 4174 --strictPort &
node measure.mjs   # Playwright/Chromium script, kept only in the session
                    # scratch directory, never inside the repo
# (extra proof: temporary columns=2 edit, re-measure at 375, restore, re-measure)
rm capture.throwaway.html src/capture.throwaway.tsx
kill the dev server
npx tsc --noEmit
npx vite build
npm run format:check
npx eslint .
npx vitest run
```

## Anything unverified, stated plainly

- **The exact numeric split of `columns={2}`'s two broken tracks at 375px**
  (217px/106px in this rig) is content-dependent (unequal `1fr` min-content
  contributions) and was not independently cross-checked against a second
  fixture data set — the packet's own illustrative number (151.5/151.5) came
  from a different scenario and I did not try to reproduce that exact split;
  what I did independently confirm is that the two tracks render side-by-side
  and share a row, which is the actual defect.
- **KpiStrip's rendered content** in the throwaway rig was not inspected in
  detail — with no `.env`, `SeasonProvider`/`KpiStrip` fail safe to an
  anonymous/no-active-season state (documented elsewhere in this repo,
  `AppShell.tsx`'s own module doc and `test-utils/authHarness.tsx`'s module
  doc) and did not error, but I did not verify KpiStrip renders nothing vs.
  some placeholder — irrelevant to this task's own measurements, which query
  specifically for the `h2` headings and their `Grid` ancestor, not KpiStrip.
- **Screenshots/visual captures** were not produced — the packet does not
  list a figure/capture deliverable for T142 (unlike T133/T134's explicit
  figure requirements), and none of the ten acceptance criteria calls for one;
  all criteria are satisfied by the numeric measurements and jsdom assertions
  above.
- **Dark-mode rendering** was not separately checked — nothing in this task's
  scope (layout/pairing) is color- or theme-mode-dependent, and no acceptance
  criterion mentions color scheme.
- **The Part 1 "outer 1152 / 16px gap" figure is confirmed wrong** (see "A
  citation that looked wrong at first" above) — confirmed directly by the
  packet's author as a packet error (stale 240px SideNav assumption, never
  corrected back into Part 1's example after the derivation elsewhere in the
  same revision was corrected to 260px). This is not left as an open question:
  the checker should treat this task's measured 1132px / 6px as ground truth,
  not the packet's 1152px / 16px, and should not spend a round rediscovering
  or querying the mismatch. I did not edit the packet itself (forbidden) —
  the correction lives only in this output doc and, presumably, in a future
  packet revision if the foreman chooses to make one.

Do not mark this task complete. A checker verifies it.
