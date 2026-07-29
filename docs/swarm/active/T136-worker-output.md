# T136 Worker Output — data-viz colour tokens + the shared goal bar

Implemented per `docs/swarm/active/T136-worker-packet.md`. **Packet SHA verified:
`3854e42`** (`git log -1 --format=%h -- docs/swarm/active/T136-worker-packet.md`
after the merge below, matching the SHA stated in the dispatch instructions).

## 0. Merge

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
`*.throwaway.*` entries (confirmed above, both files removed via `rm`, dev
server killed).

### Coach view (`Team season goal`)

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

### Student/parent view (`Your season goal`)

| | Light | Dark |
|---|---|---|
| `[role="progressbar"]` count | **1** | **1** |
| `aria-valuenow` / `min` / `max` | `25` / `0` / `100` | `25` / `0` / `100` |
| `aria-valuetext` | `"3 of 12 hours confirmed; 0 more planned"` | same |
| `aria-labelledby` resolves to | `"Your season goal"` | `"Your season goal"` |
| `tabindex` attribute present | no | no |

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
  "fillWidths": ["679.188px", "452.797px"]
}
```

`679.188 + 452.797 = 1131.985px ≈ 1132px` (floating-point rounding only) —
fills do not exceed the track combined. `progressbar` count: **1**. Page
text confirmed to still contain `"9 hrs confirmed"`, `"7 hrs planned"`,
`"15 hrs"` (the Goal tile, unchanged).

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

**Baseline after merge (confirmed by running `npx vitest run` before any
edits): 1440 tests across 62 files** — matches the packet's stated
baseline exactly.

**End state: 1451 tests across 63 files.**

Delta: **+11 tests, +1 file** — all from the new `GoalBar.test.tsx` (11
`it(...)` blocks, one new file). Zero change to any other file's test
count. The only existing test whose assertion changed is the one
documented in §6 (same test, same count — a `toBe(0)`→`toBe(1)` edit, not
an added/removed test). Zero `.skip`/`.only`/`.todo` anywhere (grepped both
touched test files — no matches).

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

## 9. Full command output (criteria 10–11)

```
$ npx tsc --noEmit
(no output — clean)

$ npx vite build
✓ built in 4.94s
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
     Tests  1451 passed (1451)
```

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

## 11. Unverified / not self-certified

- **Criterion 2 is not fully met.** "Each fill vs track" passes both themes
  with margin; "confirmed vs planned" (mutual) does not, in either theme,
  and I have proven mathematically that it cannot be made to pass while
  keeping both fills genuinely two-hued given the pinned track value. This
  is the single largest open item in this submission — see §2 in full.
- The rig's coach-view error banners ("Couldn't load the active season" /
  "student roster") are asserted here to be a pre-existing rig artifact
  (same category T131 disclosed), not re-derived from first principles
  beyond noting the code path (`AppShell`'s own chrome, not
  `OutreachList`'s injected `loadData`) — plausible but not exhaustively
  traced line-by-line.
- Visual spot-check of the eight figures was **not** exhaustive (2 of 8
  actually opened and read); the other six were validated only via the
  Playwright rendered-DOM measurement script (§4/§8), not visually
  re-opened by me.
- I did not attempt to resolve the §2 tension by unilaterally reinterpreting
  "the track" as something other than the packet's own pinned
  `--color-border-emphasized` value — flagged for checker/architect
  judgment rather than assumed.

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

**Not filed as a formal dispute** — the task was implementable and I shipped
a complete, working, tested `GoalBar` + token override + reversed test
guard. But §2's contrast finding is significant enough that I am
explicitly **not** marking criterion 2 as met, and recommend the checker/
architect decide whether: (a) the track binding should be reconsidered,
(b) the mutual-contrast requirement needs a non-fill-colour mechanism (e.g.
a divider — not implemented here, since it wouldn't change the measured
number), or (c) this specific tension is accepted as a known, disclosed
limitation the way D005 was for a different token pairing.
