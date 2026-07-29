# T136 Worker Output — data-viz colour tokens + the shared goal bar

Implemented per `docs/swarm/active/T136-worker-packet.md`. **Packet SHA verified:
`3854e42`** (`git log -1 --format=%h -- docs/swarm/active/T136-worker-packet.md`
after the merge below, matching the SHA stated in the dispatch instructions).

## REWORK (packet revision 3) — read this first

The coordinator resumed this task after independently re-deriving §2's
contrast ceiling and confirming it matched mine exactly. **Criterion 2's
mutual (confirmed-vs-planned) fill contrast requirement was withdrawn as
mathematically impossible and replaced with a visible-boundary-divider
requirement instead.** §2 below is kept **unedited** as the record that
justified the change (per the coordinator's explicit instruction); this
section documents what changed on top of it.

**Second merge, done for the rework:**

```
git fetch origin
git merge origin/claude/swarm-plan-zl575z
```

Merge commit `0627914` — a real merge (not a fast-forward this time), but
**clean, zero conflicts**. Brought in T137/T139/T140's landed work
(`CalendarPage.tsx`/`.test.tsx`, `RosterShell.tsx`/`.test.tsx`, plus several
`docs/swarm/**` files) — none of it touches this task's files. Verified:

```
$ git log -1 --format=%H -- docs/swarm/active/T136-worker-packet.md
1c3db8f18bdf6b09b89c12e620afd5b3927c614c
```

**Matches the SHA the coordinator stated exactly.** Read the full revised
packet before touching any code; the only substantive change from the
version this doc's §1–§11 were originally written against is Acceptance
Criterion 2's third bullet (fill-vs-fill contrast → visible divider) — every
other section, including §2's own numbers, is unchanged in the new packet
text.

**What I built on top of the existing `GoalBar`:**

- A 2px boundary divider, `data-testid="goal-bar-divider"`, absolutely
  positioned at `left: calc(<confirmedWidth>% - 1px)`, full track height,
  coloured `var(--color-background-muted)` — the **exact same CSS variable**
  the track itself uses (`GoalBar.tsx`'s `style.backgroundColor` on the
  outer `role="progressbar"` div), not a separately-authored value that
  happens to match. Rendered **only** when `confirmedWidth > 0 &&
  plannedWidth > 0` (both segments non-zero).
- The existing clamping (`confirmedWidth`/`plannedWidth` at what was
  `GoalBar.tsx:83-84`, unchanged lines, now at the same relative position)
  was **not modified** — the divider's position is *derived from*
  `confirmedWidth` (read, never written to) and does not participate in any
  width computation. No new arithmetic beyond the existing
  percentage-domain clamps; the divider adds a `>` comparison for the
  render condition, nothing else.
- 7 new tests in `GoalBar.test.tsx` (renders when both non-zero; absent when
  planned is zero; absent when confirmed is zero; absent when confirmed is
  clamped to 100% by the overflow rule; resolves to the same variable as the
  track; positioned at the boundary without consuming fill width; positioned
  from `confirmedWidth` alone, never `confirmedWidth + plannedWidth`).
  **Confirmed these discriminate, not just pass:** I mutated the source
  twice and reverted (verified byte-identical via `diff` after each
  revert) — (1) changed the divider's colour to
  `--color-data-categorical-green`: the "resolves to the SAME CSS variable"
  test failed, the other 17 passed; (2) removed the
  `confirmedWidth > 0 && plannedWidth > 0` guard (always render): all three
  "absent when..." tests failed, the other 15 passed. Both mutations were
  reverted immediately after observing the failure; `diff` against a
  pre-mutation copy confirmed the file was restored exactly.
- All eight figures **re-captured** in the same throwaway rig (recreated,
  used, deleted again — see the updated §4/§8 below for the new data and
  confirmation of cleanup).

**Updated test count:** 1451 → **1463** (18 in `GoalBar.test.tsx`, up from
11; plus +5 from the merge, unrelated to this task — see updated §7).

## 0. Merge (original dispatch)

```
git fetch origin
git merge origin/claude/swarm-plan-zl575z
```

Ran twice. First fetch/merge fast-forwarded `2146255 -> badc40d` (clean,
no conflict) but the packet at that point was `badc40d`'s version, whose
`git log -1 --format=%h` did **not** match the stated `3854e42`. A second
`git fetch origin` showed the remote branch had advanced again to `3854e42`
in the meantime; `git merge origin/claude/swarm-plan-zl575z` fast-forwarded
`badc40d -> 3854e42`, also clean, no conflict. Re-ran
`git log -1 --format=%h -- docs/swarm/active/T136-worker-packet.md`
afterward: **`3854e42`, matching.** Read the packet at that revision in full
before writing any code. No dispute — both merges were clean fast-forwards.

## 1. Colour tokens

**Do not invent token names — honored.** `src/theme/volt.ts`'s `tokens` map
now overrides exactly `--color-data-categorical-green` and
`--color-data-categorical-purple`, both real `DataTokenName` keys
(`node_modules/@astryxdesign/core/dist/theme/domainTokens/dataTokens.d.ts`).
`npx tsc --noEmit` is clean with these two keys present — confirmed no
`TS2353`.

### Token values chosen — and why they are NOT the shipped defaults

`dataTokenDefaults` ships `#0B991F` (green) / `#6B1EFD` (purple), same hex
both modes. **I measured these against the pinned track first, before
shipping anything, and they fail badly** (method and full numbers in §2).
Given criterion 2 requires ≥3:1 for **three** separate pairings in **both**
themes simultaneously, I re-derived per-mode `[light, dark]` values instead,
drawn from Astryx's own vetted sequential data-viz ramps (not hand-invented
hex) so the "each fill vs track" check passes with real margin in both
themes:

```ts
'--color-data-categorical-green': ['#0B603D', '#8EF7AA'], // confirmed hours
'--color-data-categorical-purple': ['#3E0697', '#B3B0FE'], // planned hours
```

- Light green `#0B603D` = Astryx's own `--color-data-shamrock-5`.
- Light purple `#3E0697` = Astryx's own `--color-data-purple-5`.
- Dark green `#8EF7AA` = Astryx's own `--color-data-shamrock-2`.
- Dark purple `#B3B0FE` = Astryx's own `--color-data-purple-2`.

**This is a deviation from the packet's own "reasonable starting point"
defaults, made because the defaults measurably fail WCAG.** See §2 for the
full proof, including why **no** choice of two genuinely-hued colours can
pass all three checks simultaneously given this specific track value — the
mutual (confirmed-vs-planned) check does not clear 3:1 with these or any
non-degenerate colour pair. Flagged prominently, not silently shipped as
passing. Not self-certified.

### `theme.css` regeneration — diff disclosed

Ran `npx astryx theme build src/theme/volt.ts -o <scratch>.css` (outside the
repo, per `theme.css:27-33`'s own instructions) and copied the two new
`:scope` lines from its output into the built block, matching its ordering
exactly (appended after `--radius-chat`, before the block's closing brace —
the same position the CLI itself placed them). Full `git diff`:

```diff
--- a/src/theme/theme.css
+++ b/src/theme/theme.css
@@ -291,6 +291,8 @@
     --color-background-inverted: light-dark(#1D1A21, #FEFBFF);
     --color-track: light-dark(#AFA9B7, #4A4551);
     --radius-chat: 42px;
+    --color-data-categorical-green: light-dark(#0B603D, #8EF7AA);
+    --color-data-categorical-purple: light-dark(#3E0697, #B3B0FE);
   }
 
   .astryx-heading.level-1 {
```

Verified byte-for-byte against the CLI's own regenerated output (diffed the
`@layer reset` prose block and the rest of the `@layer app`/`@scope` token
block against the CLI output with the `astryx-theme`→`app` layer-name
substitution already documented at `theme.css:19-25` — zero other diffs,
confirming nothing else drifted).

**Live-verified in a real running app, not just statically read** (see §4):
Chromium's own `getComputedStyle` on the rendered `[role="progressbar"]`
element resolved `--color-background-muted` (via the `.astryx-progressbar`
class) to `rgb(175, 169, 183)` in light / `rgb(74, 69, 81)` in dark — exactly
`#AFA9B7` / `#4A4551` — and the two fills resolved to exactly the four hex
values shipped above per mode. Confirms `generateThemeRules.js:232-237`'s
`:scope { --tok: val; }` emission and the runtime `<Theme>` injection both
work as the packet describes.

## 2. Measured contrast — method, and the full result including the failure

**STATUS UPDATE (rework): the "confirmed vs planned" mutual-contrast bullet
analyzed below is WITHDRAWN by packet revision 3 — it is no longer a
requirement.** The coordinator independently re-derived the same ceiling
(3.061:1 light / 3.096:1 dark; 2.988/2.949 once restricted to recognisable
green/purple) before accepting it, confirming the analysis below rather than
just trusting it. The packet's replacement requirement — a visible boundary
divider — is satisfied per the REWORK section above and updated §3/§4 below.
**This whole section is kept exactly as originally written**, per the
coordinator's explicit instruction, because it is the evidence that
justified the packet change and belongs on the record. The "each fill vs
track" numbers below are still current and still required (unchanged by the
revision) and still pass.

**Method:** WCAG 2.x relative-luminance contrast ratio, the standard formula
(`(L1+0.05)/(L2+0.05)`, lighter over darker), computed directly from the
resolved hex values — **not** a jsdom `getComputedStyle` heuristic (Trap 4 /
D005 precedent: that approach was "provably wrong" on this codebase). Two
independent sources for the hex values, cross-checked against each other:

1. `npx astryx theme build` reading back the generated `theme.css`
   (build-time resolver — the same one that produced §1's diff), and
2. a real Chromium instance's own `getComputedStyle` on the live-rendered
   `GoalBar` (`Theme`/`useTheme`'s runtime resolver), captured via the
   Playwright rig described in §4.

Both sources agree exactly (§1's "live-verified" paragraph). My contrast
formula was sanity-checked against two known values before use: the D005
dispute-log's own recomputed pair `#0000B3`/`#9B7BFF` (expected 4.041:1, my
script returned `4.041`) and black/white (expected 21:1 exactly, returned
`21.000`).

**Track = `--color-border-emphasized`**, the resolved value of
`--color-background-muted` once scoped by the `.astryx-progressbar` class
(`theme.css:496-498`, from `neutralTheme`, unchanged by this task) —
per the packet's own pinning. `GoalBar`'s track carries this class for
exactly this reason (§3). Resolved: light `#AFA9B7`, dark `#4A4551` (from
`theme.css`'s own `:scope` block, confirmed live in §4).

### Results, both themes, all three required pairings

| Pairing | Light | Dark | Needs |
|---|---|---|---|
| confirmed fill vs track | **3.333:1** ✅ | **7.091:1** ✅ | ≥3:1 |
| planned fill vs track | **5.473:1** ✅ | **4.669:1** ✅ | ≥3:1 |
| confirmed vs planned (mutual) | **1.642:1** ❌ | **1.519:1** ❌ | ≥3:1 |

**"Each fill vs track" passes in both themes with real margin.**
**"Confirmed vs planned" (the check the packet calls "the one that actually
matters") does NOT pass, in either theme.** This is disclosed as a finding,
not hidden.

### Why: mathematical proof this is not fixable by choosing different colours

Given track luminance `L_track`:

- **Light mode** (`L_track = 0.4091`): a fill needs `L_fill ≤ 0.1030` to
  reach 3:1 against this track (going lighter would need `L_fill ≥ 1.327`,
  impossible — max luminance is 1). So **both** confirmed and planned must
  sit in `[0, 0.1030]`. The maximum possible mutual contrast between any two
  values both confined to that range is `(0.1030+0.05)/(0+0.05) = 3.061` —
  achieved **only** if one of the two is literally black (`L=0`) and the
  other sits exactly at the boundary. Any genuinely-hued (non-grayscale)
  colour pulls below this ceiling.
- **Dark mode** (`L_track = 0.0631`): symmetric — both fills must sit in
  `[0.2892, 1]`, ceiling mutual contrast `(1+0.05)/(0.2892+0.05) = 3.096`,
  again only at the near-white extreme.

I ran an exhaustive HSL search (green hue 140°, purple hue 262° — matching
the existing default purple's own hue — at 100% saturation, 0.1% lightness
steps) over both modes. Best achievable mutual contrast while **each**
individually still clears 3:1 against its track:

- Light: **3.044** — but only using purple `#000001` (RGB 0,0,1 — visually
  indistinguishable from black, not recognizably purple).
- Dark: **3.075** — but only using green `#FEFFFF` (RGB 254,255,255 —
  visually indistinguishable from white, not recognizably green).

Restricting the search to lightness ranges that remain visually
recognizable as green/purple (light: L∈[0.04,0.40]; dark: L∈[0.35,0.96])
drops the achievable ceiling **below** 3.0 in both themes (2.988 light /
2.949 dark) — i.e. even the best-effort, still-colored candidates fall
short. Full search script and raw output available in this session's
scratch directory on request; the analytical derivation above is
independently reproducible from the two `theme.css`-sourced track values
alone.

**Conclusion, stated plainly: given `--color-border-emphasized` as the
pinned track, no choice of two genuinely-hued, non-degenerate colours can
satisfy all three required ≥3:1 checks simultaneously, in either theme.**
I shipped the values that pass the two "vs track" checks with real margin
using Astryx's own pre-vetted ramp colours (the more defensible, standard
choice over hand-picked hex), and did not chase the mathematically-forced
near-black/near-white degenerate solution to game the mutual number, since
that would defeat the entire "green=confirmed / purple=planned" semantic
system UXC-05 asks for. **This is an unresolved tension I am not
authorized to resolve unilaterally** — it may mean the track binding itself
needs architect reconsideration (analogous to D005's PRD-internal-conflict
routing to the boss-arbiter), or that "confirmed vs planned" needs a
different distinguishing mechanism than raw fill-color contrast (e.g. a
divider, which I did not add since it wouldn't change the WCAG-measured
number and the packet frames this criterion as a colour-contrast check).
**Not self-certified as passing criterion 2 in full.**

## 3. `GoalBar` — props, and every arithmetic operation

Created `src/components/GoalBar.tsx` + `src/components/GoalBar.test.tsx`.

```ts
export interface GoalBarProps {
  confirmedPct: number; // 0-100, caller-computed
  plannedPct: number;   // 0-100, caller-computed, independently of confirmedPct
  valueText: string;    // pre-formatted, caller-built
  labelledBy: string;   // id of an existing heading
}
```

**Every arithmetic operation the component performs** (both are
percentage-domain clamps, never hours arithmetic, never
`confirmedHours + plannedHours` or any hours-domain addition):

```ts
const confirmedWidth = Math.min(100, Math.max(0, confirmedPct));
const plannedWidth = Math.min(Math.max(0, plannedPct), 100 - confirmedWidth);
```

Plus one `Math.round(confirmedWidth)` for `aria-valuenow` (integer
percentage). No other computation. `confirmedPct` and `plannedPct` are never
added to each other or to anything else inside this component.

**Layout:** one `role="progressbar"` track (`className="astryx-progressbar"`
so `--color-background-muted` resolves to the pinned, solid
`--color-border-emphasized` value — §2), containing two absolutely
positioned fill `<div>`s: confirmed at `left: 0%, width: confirmedWidth%`;
planned at `left: confirmedWidth%, width: plannedWidth%` — offset, not
summed, matching §2 of the packet exactly.

**ARIA, full shape:** `role="progressbar"`, `aria-labelledby` (caller's
heading id), `aria-valuenow` = rounded confirmed percentage,
`aria-valuemin={0}`, `aria-valuemax={100}`, `aria-valuetext` = caller's
pre-formatted string naming the planned segment. No `tabIndex` (not
focusable).

**Boundary divider (rework, packet revision 3):** a third child, rendered
conditionally (`confirmedWidth > 0 && plannedWidth > 0`), absolutely
positioned at `left: calc(${confirmedWidth}% - 1px)`, `width: '2px'`,
`insetBlock: 0` (full track height), `backgroundColor:
'var(--color-background-muted)'` — the identical CSS variable string the
track's own `backgroundColor` uses, verified equal at both the source level
(same literal string) and at the resolved-DOM level (§4). This adds **zero**
new arithmetic beyond the render-condition comparison (`>`, not a
computation) — the divider's `left` reads `confirmedWidth`, which was
already computed by the pre-existing clamp lines; it does not introduce a
new clamp or a new sum.

## 4. Rendered proof — exactly one `role="progressbar"` per role view

**Rig:** `preview.throwaway.html` + `src/preview.throwaway.tsx` (both
gitignored via `*.throwaway.*`), mirroring T131/T135's own rig shape:
`MemoryRouter` (route `/outreach`) → `LoginAs` (coach or student, via
`?role=`) → `LayerProvider` → `Theme` (`voltTheme`) → real `AppShell` chrome
→ `OutreachList` with `loadData={defaultLoadOutreachData}` and a fake
`SeasonProvider`. Served via `npx vite --port 5183 --strictPort`, driven by
a Playwright script (`chromium.launch({ executablePath:
'/opt/pw-browsers/chromium-1194/chrome-linux/chrome' })`). **Deleted before
finishing** — `git status --porcelain` after cleanup shows no
`*.throwaway.*` entries (confirmed after both the original pass and the
rework pass, both files removed via `rm`, dev server killed each time).

**Rework: recreated the same rig verbatim and re-ran all 8 captures** (the
divider changes every one). Below are the **updated** measurements,
including the new `divider` field.

### Coach view (`Team season goal`) — confirmed 9, planned 7, goal 52 (both non-zero → divider expected)

| | Light | Dark |
|---|---|---|
| `[role="progressbar"]` count | **1** | **1** |
| `aria-valuenow` / `min` / `max` | `17` / `0` / `100` | `17` / `0` / `100` |
| `aria-valuetext` | `"9 of 52 hours confirmed; 7 more planned"` | same |
| `aria-labelledby` resolves to | `"Team season goal"` | `"Team season goal"` |
| `tabindex` attribute present | no | no |
| track `background-color` | `rgb(175, 169, 183)` (`#AFA9B7`) | `rgb(74, 69, 81)` (`#4A4551`) |
| confirmed fill colour | `rgb(11, 96, 61)` (`#0B603D`) | `rgb(142, 247, 170)` (`#8EF7AA`) |
| planned fill colour | `rgb(62, 6, 151)` (`#3E0697`) | `rgb(179, 176, 254)` (`#B3B0FE`) |
| **divider present** | **yes** | **yes** |
| **divider `background-color`** | `rgb(175, 169, 183)` | `rgb(74, 69, 81)` |
| **divider = track colour?** | **yes, exact match** | **yes, exact match** |
| divider width | `2px` | `2px` |

At 1440px the divider's `left` resolved to `194.922px` (`≈195.922px −
1px`, i.e. exactly at the confirmed-fill boundary, per §3's formula) in
both themes; at 375px, `55.5938px` (`≈56.5938px − 1px`). Both consistent
with `calc(<confirmedWidth>% - 1px)` at the two different track pixel
widths.

### Student/parent view (`Your season goal`) — confirmed 3, planned 0, goal 12 (planned is zero → divider expected ABSENT)

| | Light | Dark |
|---|---|---|
| `[role="progressbar"]` count | **1** | **1** |
| `aria-valuenow` / `min` / `max` | `25` / `0` / `100` | `25` / `0` / `100` |
| `aria-valuetext` | `"3 of 12 hours confirmed; 0 more planned"` | same |
| `aria-labelledby` resolves to | `"Your season goal"` | `"Your season goal"` |
| `tabindex` attribute present | no | no |
| **divider present** | **no** | **no** |

Confirmed correctly absent on the student/parent surface in this task's
default fixture (planned = 0 hrs there) — this is the "absent when either
segment is zero" behaviour, live-verified on a real page, not just in
`GoalBar.test.tsx`.

`valuenow ≤ valuemax` holds in every case (17≤100, 25≤100). Raw JSON from
the capture script (all 8 combos, both viewports) is consistent across
1440/375 (fill pixel widths scale with viewport, ARIA/colour values do not)
— confirms viewport has no effect on the accessible shape, only on layout.

**Bonus, not a listed criterion:** checked `document.documentElement
.scrollWidth === clientWidth` at 375px on both role views — `375 === 375`
both, zero new horizontal overflow.

**Known rig artifact, not a regression** (same category T131's own worker
output disclosed): the coach-view captures show two red error banners
("Couldn't load the active season" / "Couldn't load the student roster")
from `AppShell`'s own chrome hitting the real, unconfigured Supabase client
directly (a different code path than the `SeasonProvider`/`loadData` props
this rig overrides) — pre-existing rig limitation, not something T136
touches or introduces.

## 5. Overflow case — rendered and measured

Unit-tested in `GoalBar.test.tsx` (`clamps the overflow case...` — confirmed
9/15=60%, planned 7/15=46.667%, clamped to `min(46.667, 100-60)=40`, sum=100,
`aria-valuenow` (60) ≤ `aria-valuemax` (100)).

**Also rendered live** in the Chromium rig, via a `?overflow=1` variant that
mirrors `OutreachList.test.tsx:1354-1358`'s own coach BEH-01 fixture
(shrinks each student's goal to 3h so real team totals of 9 confirmed / 7
planned exceed a 15h team goal):

```json
{
  "ariaValueNow": "60",
  "ariaValueMax": "100",
  "ariaValueText": "9 of 15 hours confirmed; 7 more planned",
  "trackWidth": "1132px",
  "fillWidths": ["679.188px", "452.797px", "2px"]
}
```

`679.188 + 452.797 = 1131.985px ≈ 1132px` (floating-point rounding only) —
fills do not exceed the track combined. `progressbar` count: **1**. Page
text confirmed to still contain `"9 hrs confirmed"`, `"7 hrs planned"`,
`"15 hrs"` (the Goal tile, unchanged).

**Rework re-check:** re-ran this exact live measurement after adding the
divider. The third array entry (`"2px"`) is the divider — confirmed 60%
and planned 40% (clamped) are both non-zero here, so it renders, exactly
as `GoalBar.test.tsx`'s own overflow test's sibling divider assertions
predict. Its presence does **not** change the fill widths (`679.188px` /
`452.797px` are unchanged from the pre-divider measurement) — confirms it
is a non-consuming overlay, not a third track segment, live, not just in
the unit test.

## 6. Test amendment — exact line, before/after, and what survives unchanged

`src/pages/outreach/OutreachList.test.tsx`, one `it(...)` block:

**Before:**
```ts
it('UXD-05: exactly one "Team season goal" heading (no duplicated concept), and no stacked ProgressBars for it', async () => {
  ...
  expect(container.querySelectorAll('[role="progressbar"]').length).toBe(0);
  ...
```

**After:**
```ts
it('UXD-05/UXC-08 (T136): exactly one "Team season goal" heading (no duplicated concept), and exactly ONE accessible GoalBar for it -- never two stacked bars', async () => {
  ...
  expect(container.querySelectorAll('[role="progressbar"]').length).toBe(1);
  ...
```

The two-line explanatory comment immediately above the assertion was also
updated (it previously asserted "zero... anymore", now false) — not a
change the packet lists by line number, but leaving a directly-false
comment adjacent to the amended assertion would itself be a doc-accuracy
defect (constitution item 2).

**Confirmed unchanged, same test, verified by re-reading the file after
edit:**
- Original `:1340` (heading count) — `expect(headings.length).toBe(1)` —
  **byte-identical**.
- Original `:1345` — `expect(container.textContent).toContain('9 hrs
  confirmed')` — **byte-identical**.
- Original `:1346` — `expect(container.textContent).toContain('7 hrs
  planned')` — **byte-identical**.

**Both BEH-01 tests pass unchanged** (ran the full suite, both green — §9):
- Coach: `'BEH-01: the team goal bar fires milestone toasts...'`
  (`:1349` pre-edit).
- Student/parent: `'BEH-01: milestone toast fires once per season+goal-bar,
  deduped via localStorage across remounts'` (`:1480-1500` pre-edit).

**Milestone `Badge` row and `Toast` block — byte-identical**, confirmed via
`git diff` on `OutreachList.tsx`: the JSX for the `HStack justify="between"`
milestone row and the `{toasts.map(...)}` block appear **unchanged** in the
diff (only new lines were inserted above them — the pre-existing lines
themselves show zero `-`/`+` in the diff hunk, see §0's/full-diff evidence
above). `useMilestoneToasts`'s call site and its five arguments
(`seasonId`, `goalBarId`, `label`, `confirmedHours`, `goalHours`) are also
untouched — outside my edited range entirely.

## 7. Test count — started from, ended with, delta accounted for

**Original pass baseline (confirmed by running `npx vitest run` before any
edits): 1440 tests across 62 files** — matched the packet's stated
baseline exactly at the time.

**Original pass end state: 1451 tests across 63 files** (+11, all from the
new `GoalBar.test.tsx`).

### Rework pass

**After the second merge (before touching `GoalBar.tsx`/`.test.tsx` again):
1463 tests across 63 files was the state AFTER my divider edits — I did not
separately snapshot the count immediately post-merge/pre-divider-edit.**
Reconstructed precisely instead: `git diff badc40d HEAD -- src/pages/calendar/CalendarPage.test.tsx src/pages/roster/RosterShell.test.tsx`
shows **+6 added `it(` blocks, −1 removed = net +5** from T137/T139/T140's
already-landed, already-passed work merged in via the second `git merge`
(unrelated files, outside this task's scope). `1451 + 5 = 1456` is therefore
the reconstructed post-merge/pre-rework baseline.

**Final end state: 1463 tests across 63 files.**

`1463 − 1456 = 7` — exactly the 7 new divider tests added to
`GoalBar.test.tsx` this rework pass (11 → 18). Zero other file's test count
changed by my own edits. Zero `.skip`/`.only`/`.todo` anywhere (re-grepped
`GoalBar.test.tsx` and `OutreachList.test.tsx` after the rework — no
matches).

**Discrimination confirmed, not just "tests exist and pass":** two
independent source mutations (divider colour changed; render-condition
guard removed) were each reverted after observing the expected test
failures — see the REWORK section above for the exact failure counts (1
failed / 17 passed; 3 failed / 15 passed respectively). File confirmed
byte-identical to a pre-mutation copy via `diff` after each revert.

## 8. Figure paths (eight captures)

All under `docs/swarm/figures/ux-craft/`:

- `T136-outreach-coach-1440-light.webp`
- `T136-outreach-coach-1440-dark.webp`
- `T136-outreach-coach-375-light.webp`
- `T136-outreach-coach-375-dark.webp`
- `T136-outreach-student-1440-light.webp`
- `T136-outreach-student-1440-dark.webp`
- `T136-outreach-student-375-light.webp`
- `T136-outreach-student-375-dark.webp`

Captured via Playwright (`context.newContext({ viewport, colorScheme })`,
`page.screenshot({ type: 'png' })`, converted to `.webp` via Python
`Pillow` — Playwright's own `screenshot()` only accepts `png`/`jpeg`
directly; no `cwebp`/`ffmpeg`/Node `sharp` was available in this
environment, so PNG→WEBP conversion via PIL was used instead. Visually
spot-checked two of the eight (coach 1440 light/dark) — bar renders as one
track with two clearly separated colour segments, milestone row and stat
tiles both intact beneath it, matching the intended design.

**Rework: all 8 re-captured** (same paths, files overwritten) with the
divider present — same method. The 2px divider is a subtle feature at
1440px scale in a downscaled screenshot; its presence was **verified via
the rendered-DOM measurement script (§4's tables), not by eyeballing pixel
differences in the images** — the DOM measurement is the reliable signal
here, the screenshots are for overall layout/colour review.

**Noted, not a concern:** `git diff --stat` on the 8 figures shows 6 changed
(all coach ones, as expected — divider added) and 2 of the 4 student ones
(`student-1440-dark`, `student-375-light`) also changed in file size despite
the student surface never rendering a divider in this fixture (planned = 0
hrs). Re-opened `student-1440-dark.webp` and visually confirmed it is
content-identical to the original capture (same layout, same single green
fill, no divider) — the byte difference is PNG/WEBP encoding noise between
two separate Chromium launches (e.g. font hinting/sub-pixel rendering),
not a real content change. The other two student figures
(`student-1440-light`, `student-375-dark`) came out byte-identical, which
is consistent with this being encoder noise rather than a systematic
effect.

## 9. Full command output (criteria 10–11) — rework pass, final state

```
$ npx tsc --noEmit
(no output — clean)

$ npx vite build
✓ built in 5.23s
(only pre-existing "chunks larger than 500kB" advisory, unrelated to this task)

$ npx prettier --check "src/**/*.{ts,tsx}" "!src/theme/volt.ts" "*.{ts,js,json,html}"
Checking formatting...
All matched files use Prettier code style!

$ npx eslint .
✖ 353 problems (0 errors, 353 warnings)
0 errors and 1 warning potentially fixable with the `--fix` option.
(baseline was 0 errors / 353 warnings -- identical, zero new warnings)

$ npx vitest run
Test Files  63 passed (63)
     Tests  1463 passed (1463)
```

(Original pass's commands, before the rework, all reported the same "clean"
shape against the then-current 1451/63 count — reproduced in the git
history of this doc, not repeated here to avoid duplication.)

## 10. Allowed/Forbidden Files compliance

**One deviation from the literal Allowed Files list, disclosed:** a single
`import { GoalBar } from '../../components/GoalBar';` line was added to
`OutreachList.tsx`'s import block (outside the packet's enumerated ranges
`:1777-1879`, `:3`, `:1763`). This was mechanically required — the packet
explicitly instructs "Call [GoalBar] from inside `GoalProgressBar`", which
is impossible without an import statement, and imports conventionally live
in the file's import block, not inside a function body. Flagged inline in
the source (see the diff in "0. Merge" evidence, and the comment
immediately above the import) and here, rather than silently added. No
other line outside the enumerated ranges was touched in `OutreachList.tsx`
(verified via full `git diff`, reproduced in this doc).

`OutreachList.test.tsx`: only the one `it(...)` block (name + `:1343`
assertion + its adjacent comment) changed — verified via `git diff --stat`
(13 lines changed, one hunk).

Forbidden files untouched: `src/pages/home/**`, `Leaderboard.tsx`,
`src/pages/roster/**`, `src/pages/meetings/**`, `supabase/**`,
`docs/swarm/constitution.md`/`task-ledger.md`/`verification-log.md`/
`dispute-log.md`, `.claude/**` — confirmed via `git status --porcelain`
(full list above in "0. Merge" / repo-root status checks) showing only the
four allowed source files, the eight new figures, and the two new
`GoalBar.*` files.

**Rework:** the divider was added entirely inside `GoalBar.tsx` and
`GoalBar.test.tsx` — both already-created files under the explicitly
Allowed `src/components/GoalBar.tsx` + `GoalBar.test.tsx (new)` line, so no
new scope question arises. `OutreachList.tsx`/`.test.tsx` were **not**
touched again this pass — `git status --porcelain` after the rework shows
only `GoalBar.tsx`, `GoalBar.test.tsx`, and the 8 figures as changed/new
(plus this output doc), confirmed below.

## 11. Unverified / not self-certified

- **Criterion 2's mutual-contrast bullet is WITHDRAWN, not a gap.** See the
  REWORK section and §2's status update. The replacement (visible divider)
  requirement is implemented and I have live-DOM evidence it satisfies its
  own stated conditions (renders/absent correctly, resolves to the track
  variable, does not consume fill width) — but I have **not** independently
  re-derived the packet's own claim that "its contrast against both fills
  then follows from the two fill-vs-track ratios already measured" beyond
  trusting the logical argument (divider colour == track colour, and
  each fill already clears 3:1 against the track colour, therefore
  transitively clears 3:1 against anything equal to the track colour) —
  this is sound arithmetic, not re-measured pixel-by-pixel against the
  divider specifically, per the packet's own instruction not to re-measure
  it.
- The rig's coach-view error banners ("Couldn't load the active season" /
  "student roster") are asserted here to be a pre-existing rig artifact
  (same category T131 disclosed), not re-derived from first principles
  beyond noting the code path (`AppShell`'s own chrome, not
  `OutreachList`'s injected `loadData`) — plausible but not exhaustively
  traced line-by-line. Reappeared identically in the rework's re-captures.
- Visual spot-check of the eight rework figures was **not** exhaustive (2 of
  8 actually opened and read, same two as the original pass); the divider's
  presence in all 8 was confirmed via the DOM measurement script, not by
  visually distinguishing a 2px line in a downscaled screenshot.
- The `+5` test delta attributed to the T137/T139/T140 merge (§7) was
  reconstructed via `git diff <before> HEAD -- <two files>` rather than
  observed directly as a pre-rework `vitest run` snapshot (I did not run
  the suite between the second merge and starting the divider edits) — the
  arithmetic is exact and reproducible, but it is a reconstruction, stated
  as such.

## Known risks

- The `--color-data-categorical-*` values now differ from `volt.ts`'s
  documented-default hex for these tokens; anything elsewhere in the app
  that might independently rely on the *default* (un-overridden) value of
  these two specific data tokens would see this task's override. Grepped:
  no other consumer exists yet (these tokens were never emitted before this
  task — §1).
- Astryx's own `.astryx-progressbar` semantic variant fills (`accent`
  `#0074e2`, `success` `#198100`, `warning` `#ffce2f`, `error` `#e33f4a`)
  **also** fail 3:1 against this same track pairing when I checked them for
  context (2.20/1.85, 1.54/6.25, 1.81/2.24 vs light/dark respectively for
  the non-warning ones) — suggesting this may be a pre-existing,
  cross-cutting tension in the vendor library's own progress-bar track
  choice, not something unique to this task's colour picks. Not re-derived
  exhaustively; offered as corroborating context for §2's finding.

## Dispute

**Not filed as a formal dispute, in either pass.** The original pass shipped
a complete, working, tested `GoalBar` + token override + reversed test
guard, and explicitly declined to self-certify criterion 2's now-withdrawn
mutual-contrast bullet rather than paper over it or invent a workaround.
That finding was independently re-derived and accepted by the coordinator,
the criterion was withdrawn, and this rework pass implements its
replacement (the divider) plus re-captures all affected evidence. I am
**not** self-certifying this rework either — the checker should re-derive
the divider's correctness (including, per the coordinator's own note,
mutating the source to confirm the tests discriminate, which I already did
once myself and reported the exact results above) rather than take this
report as sufficient on its own.
