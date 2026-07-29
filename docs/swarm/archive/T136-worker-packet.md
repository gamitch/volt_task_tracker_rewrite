# Worker Packet: T136 — data-viz colour tokens + the shared goal bar (UXC-05 foundation, UXC-08)

Wave 5, packet **W5-P4a**. Runs after T135.

**Revision 3 (2026-07-29).** Revision 2's contrast demand — ≥3:1 between the two
fills — was **withdrawn as geometrically impossible** after the worker proved it
and I re-derived it independently. See criterion 2, which now requires a visible
boundary satisfied by a track-coloured divider. Anything below still labelled
"revision 2" refers to that withdrawn demand, not to the divider.

**Revision 2 (2026-07-28).** Revision 1 was returned REVISE with **1 BLOCKER and
7 MAJORs**, all author errors — including a token prescription that does not
compile, a trap quoting the wrong file, and a contrast threshold from the wrong
WCAG rule. Every citation below has been verified against the real files.

## FIRST — merge the working branch

```
git fetch origin
git merge origin/claude/swarm-plan-zl575z
```

Report the result. **If it conflicts, stop and report** rather than resolving.

## Scope

The PRD bundles UXC-05, UXC-06 and UXC-08 into P4. This packet builds and proves
the primitives; **T138** rolls them out. (T137 is the calendar dead-link fix,
D009.)

**In scope:** the two data-viz colour tokens, one shared bar component, and
UXC-08's goal strip.

**Deferred — do not do these:** per-team hues, type-badge hue variants,
UXC-06 dashboard pairing, leaderboard bars, student/parent *home* colour.
(P5 remains "page frames on non-frozen routes" and is untouched by this packet.)

## 1. Colour tokens — use the ones that exist

**Do not invent token names.** `defineTheme`'s `tokens` is
`Partial<Record<TokenName, TokenValue>>` where `TokenName` is a **closed union
type alias** (`dist/theme/defineTheme.d.ts`). A type alias cannot be augmented,
so `src/theme/astryx-augment.d.ts`'s interface-merging trick does not apply, and
a custom name fails the build:

```
error TS2353: Object literal may only specify known properties, and
'--color-confirmed' does not exist in type 'Partial<Record<TokenName, TokenValue>>'.
```

Revision 1 prescribed exactly that, which made criterion 1 and the `tsc` gate
mutually unsatisfiable.

**Ship this instead** — override the two data-viz tokens that already exist and
already typecheck, in `volt.ts`'s existing `tokens` block as `[light, dark]`
pairs:

- **`--color-data-categorical-green`** → confirmed hours
- **`--color-data-categorical-purple`** → planned hours

These are real `TokenName` keys (`dist/theme/domainTokens/dataTokens.d.ts`),
documented as "one accent per category… for distinct series", and ship defaults
(`#0B991F`, `#6B1EFD`) that are a reasonable starting point. They are **not**
currently emitted in `theme.css`, so setting them here is what makes them exist.
This also hands the deferred per-team-hue work eight more categorical hues with
no further token design.

**Regenerate the built stylesheet.** `theme.css:28-33` documents
`npx astryx theme build src/theme/volt.ts`; the built token block mirrors
`volt.ts`. Adding a token to `volt.ts` alone leaves the static stylesheet out of
sync. Run it and disclose the diff. Note `package.json:13` deliberately excludes
`volt.ts` from `format:check`.

**How a component reads them.** They become real CSS custom properties —
`generateThemeRules.js:232-237` emits `:scope { --tok: val; }` inside
`@scope([data-astryx-theme="volt"])`, injected at runtime by `<Theme>`
(`Theme.js:105-147`). A plain div reads them with `var(--tok)`. For a
measurement rig, `useTheme().token(name)` returns the mode-resolved raw value.
`xstyle` remains unusable (F-2).

## 2. The shared bar component

**F-3 pre-authorizes exactly this** (`VOLT_UX_Craft_PRD_v3.md:74-79`): one small
custom bar — track, one or two fills, optional ticks — under DES-21's final rung,
for UXC-05 and UXC-08 only. Presentation only, one shared module, contrast
verified in both themes.

**The authority for a two-segment bar is `VOLT_Portal_PRD.md:239` (BEH-02)**:
the hours bar renders confirmed hours plus planned hours as "a **visually
lighter second segment**… never summed into one number." Cite it; it is what
makes this legitimate rather than a stacked-bar violation of F-3.

Create `src/components/GoalBar.tsx` + `GoalBar.test.tsx`, alongside the shared
`StatCell.tsx`.

**Layout — offset, never sum.** `OutreachList.tsx:55-58` records a
grep-provable invariant that **no `confirmedHours + plannedHours` expression
exists in that file**, and BEH-02 forbids summing them into one number. The
natural implementation of "planned continues where confirmed ends" is exactly
that forbidden sum. **Ship offset-based layout instead:** the planned segment is
positioned at `left: confirmedPercent%` with `width: plannedPercent%`, each
percentage computed independently against the goal. The component never adds the
two.

**Reuse `confirmedPercent` (`OutreachList.tsx:1207`)** — exported, already clamps
to 100, already handles `goal <= 0`, already covered by tests. It is a generic
`(a/b)*100` clamp, so **`confirmedPercent(plannedHours, goalHours)` is the
correct source for the planned percentage too.** Call both from **inside
`GoalProgressBar` (`:1803-1879`)** — Allowed Files restrict this file to
`:1777-1879`, `:3` and `:1763`, so you may not add a `plannedPercent` helper
beside `:1207` or rename that function.

**The prop contract, pinned so worker and checker target the same thing:**
`GoalBar` takes `confirmedPct` and `plannedPct` as numbers, plus a
**pre-formatted `valueText` string** built in `GoalProgressBar` (which is where
the hour figures live). `aria-valuenow` carries the **confirmed percentage**,
with `aria-valuemin={0}` and `aria-valuemax={100}`.

**What "no arithmetic" means, precisely.** The prohibition is on **hours**
arithmetic — specifically `confirmedHours + plannedHours`, the expression
`:55-58` makes grep-provably absent and BEH-02 forbids. **Percentage-domain
clamping is expected and required**, e.g.
`width: min(plannedPct, 100 - confirmedPct)`. Trap 1 says "hours arithmetic" for
this reason; §2 and Trap 1 agree.

**Overflow is real and you must specify it.** Coach BEH-01's fixture
(`OutreachList.test.tsx:1354-1358`) shrinks goals so confirmed is **9** and
planned **7** against a goal of **15** — the segments exceed the track. Clamp
the rendered widths so the fills never exceed 100% combined, and ensure
`aria-valuenow` never exceeds `aria-valuemax`. Assert the overflow case in
`GoalBar.test.tsx`.

**ARIA — complete shape, not just the role:**
- `role="progressbar"` with `aria-valuenow`, `aria-valuemin`, `aria-valuemax`.
- **`aria-valuenow` carries the confirmed value only.** This is not taste — the
  app already made the same ruling for itself at `OutreachList.tsx:96-99`:
  milestone crossing is computed from confirmed hours only, because "planned
  hours are provisional, so they never contribute to 'reaching' a milestone".
  Same honesty rule, and constitution item 17.
- **An accessible name is required.** Point `aria-labelledby` at the existing
  `<Heading level={2}>{label}</Heading>` (`OutreachList.tsx:1832`) via `useId`.
  This mirrors Astryx's own bar (`ProgressBar.js:213`), and **the identical
  pattern already ships twice in this very file** — copy the JSX at
  `OutreachList.tsx:2766` and `:3405` (`<Heading level={2} id={headingId}>` +
  `aria-labelledby={headingId}`), proven live by T129's test at
  `OutreachList.test.tsx:1520-1543`. `Heading` spreads `...props` onto the
  element (`Heading.js:142`), so `id` reaches the DOM. Do **not** add a second
  labelling element — that risks the one-heading assertion at `:1340`.
- **`aria-valuetext` must name the planned segment explicitly** — e.g. "9 of 52
  hours confirmed; 7 more planned". When present it is announced *instead of*
  the numeric value, so a large planned segment that is visible but unannounced
  would be the real accessibility defect.
- Not focusable. It is a status indicator, not a control — no `tabIndex`.

## 3. UXC-08 — the goal strip, and what it reverses

**Read this whole section before writing code.**

`GoalProgressBar` (doc `:1777-1802`, function `:1803`, body `:1820-1879`)
renders **zero** bars today. The T121 note at `:67-82` records why: George
**live-reported** two stacked bars whose own visible `label` captions formed a
third and fourth "Team season goal" repetition — "exactly UXD-05's own named
anti-example". T121 removed them and shipped tiles (`task-ledger.md:142`,
"exactly one heading, zero progressbars — asserted").

The pin is `OutreachList.test.tsx:1343`:

```js
expect(container.querySelectorAll('[role="progressbar"]').length).toBe(0);
```

**Verified: this is the only progressbar guard in the repository.** So you
cannot add an accessible bar without amending it — and omitting the role to dodge
it would trade a failing test for an inaccessible control, which constitution
item 15 forbids.

**Authorized:** amend `:1343` from `toBe(0)` to `toBe(1)` and rename the test to
describe what it now guards. **Everything else in that test survives unchanged:**
- `:1340` — exactly **one** `Team season goal` heading element.
- `:1345` — `'9 hrs confirmed'`.
- `:1346` — `'7 hrs planned'`.

**Exactly one bar. Two fills inside one track.** Not one bar per metric. The
original defect was two stacked bars; shipping two again reproduces precisely
what the human owner reported.

**The Goal tile stays.** `:1850-1856` renders "Goal / {goalHours} hrs" — T121
shipped it and it is a displayed metric. Do not remove it in favour of the bar.

### Frozen — byte-identical, do not touch

**The milestone `Badge` row (`:1867-1877`)**, which renders `"{milestone}% reached"`.
UXC-08's wording ("Goal/**milestone** strip") invites moving these onto the bar
as ticks. **Do not.** They are asserted by:
- `OutreachList.test.tsx:1499` — `toContain('25% reached')` (student BEH-01)
- `:1371-1372` — `not.toContain('75% reached')` / `not.toContain('100% reached')`
  (coach BEH-01)

A "goal tick" on the bar, if you render one, is **decorative only** and must not
replace or relocate this row.

**The `Toast` block (`:1822-1831`) and the props feeding
`useMilestoneToasts` (`:1694-1724`)** — `seasonId`, `goalBarId`, `label`,
`confirmedHours`, `goalHours`. That hook recomputes `confirmedPercent` from the
same props the bar renders (`:1704`) and dedupes on a localStorage key
`volt.outreach.milestoneToast.<seasonId>.<goalBarId>.<milestone>`
(`:1663-1668`). Three ways a "bar-only" change silently alters toast behaviour:

1. **Changing `goalBarId`** (e.g. to key a new bar instance) changes the
   localStorage key → already-fired toasts re-fire → `:1496` fails.
2. **Changing `label`** changes the toast body verbatim → `:1365`, `:1368`,
   `:1487` fail.
3. **Normalising or clamping `goalHours` before passing it down** changes the
   percentage → changes which milestones cross.

This is motivation-ethics territory (constitution item 17). If you find yourself
touching any of it, stop and report.

### The second render path — this ships to two surfaces

`OutreachList.tsx:1763` says outright: "Goal bar — **shared by both role
variants**." Call sites: **`:3058`** (coach, "Team season goal") and **`:3512`**
(student/parent, "Your season goal").

**So the student/parent outreach view also gains a bar. That is intended.** The
student path has live tests at `:1419`, `:1458`, `:1480-1500` and **no**
progressbar-count guard. Criterion 4 below therefore names both surfaces
explicitly. Note the Forbidden list mentions T132's student/parent *rows* — that
means the `ListItem` row rendering, not this shared goal bar.

*(Citation note: `VOLT_UX_Craft_PRD_v3.md` cites this test as
`OutreachList.test.tsx:1279-1298`. That is **stale** — that range is now T121's
edit-dialog test. The real range is `:1328-1347`.)*

## Allowed Files

- `src/theme/volt.ts`
- `src/theme/theme.css` — the regenerated built token block only
- `src/components/GoalBar.tsx` + `GoalBar.test.tsx` (new)
- `src/pages/outreach/OutreachList.tsx` — **`GoalProgressBar` and its own doc
  comment (`:1777-1879`)**, plus the two stale references your change creates:
  the file header at **`:3`** ("team season-goal `ProgressBar` pair") and the
  section header at **`:1763`**. Nothing else.
- `src/pages/outreach/OutreachList.test.tsx` — **only** `:1343` and the test's
  name
- `docs/swarm/active/T136-worker-output.md` (create)
- New `.webp` figures under `docs/swarm/figures/ux-craft/`

## Forbidden Files

- `src/pages/home/**`, `src/pages/outreach/Leaderboard.tsx`,
  `src/pages/roster/**` — the deferred rollout surfaces. `CoachHome`'s `KpiCard`
  `ProgressBar` (`CoachHome.tsx:2183`) is correct as-is; F-3's approval does not
  extend to replacing it.
- Everything in `OutreachList.tsx` outside the ranges named above — the coach
  `Table` (T131), the `ListItem` student/parent rows (T132), the shared hook.
- `src/pages/meetings/**` — T135 landed there; out of scope for this task.
- `supabase/**`.
- `docs/swarm/constitution.md`, `task-ledger.md`, `verification-log.md`,
  `dispute-log.md`, `.claude/**`.

## Traps

1. **Never sum confirmed and planned.** See §2. `OutreachList.tsx:55-58` makes
   the absence of that expression a stated invariant; BEH-02 forbids it in
   words. Offset-based layout only. Any hours arithmetic inside `GoalBar` is a
   **BLOCKER** (constitution item 3, PRD DATA-01).
2. **One bar, two fills.** Two `role="progressbar"` elements fail `:1343` even
   after amending it to `toBe(1)` — which is exactly the guard you want.
3. **The milestone Badge row and the Toast block are frozen.** See §3.
4. **Contrast is measured, not asserted.** See criterion 2. Use
   `useTheme().token()` for exact values rather than a computed-style heuristic —
   D005's checker discarded that approach as "provably wrong" on this codebase.
5. **`ProgressBar` is still right elsewhere.** This component is authorized for
   the goal strip only.
6. Do not certify your own work.

## Acceptance Criteria

1. `volt.ts` overrides `--color-data-categorical-green` and
   `--color-data-categorical-purple` as `[light, dark]` pairs. No invented token
   names. `theme.css`'s built block regenerated and the diff disclosed.
2. **Measured contrast, reported with method, in both themes:**
   - each fill against the track: **≥3:1** (WCAG 2.1 SC 1.4.11, non-text
     contrast — *not* 4.5:1, which is the text threshold and was revision 1's
     error). **The track is `--color-background-muted`** — `theme.css:496`
     already remaps it for `.astryx-progressbar`, so worker and checker measure
     the same pair;
   - **the boundary between confirmed and planned must be visible.** Two
     adjacent segments that pass individually against the track can still be
     indistinguishable from each other. That concern is real and is what this
     criterion exists for.

     **Revision 2 demanded ≥3:1 between the two fills. That is impossible and
     the demand is withdrawn.** Chaining it with the two fill-vs-track
     requirements confines both fills to one narrow luminance band on the same
     side of the track: in light mode (track `#AFA9B7`, L=0.4091) both must sit
     in `L ∈ [0, 0.1030]`, whose internal contrast ceiling is **3.061:1** and
     only if one fill is literally black; in dark mode (track `#4A4551`,
     L=0.0631) both must sit in `L ∈ [0.2892, 1]`, ceiling **3.096:1**, only at
     near-white. Restricted to colours still recognisable as green and purple
     the ceiling falls to **2.988 light / 2.949 dark** — under 3:1 before hue is
     even chosen. Derived independently twice; do not re-litigate it.

     **Satisfy it with a divider instead.** Render a 2px separator where the
     confirmed fill ends and the planned fill begins, coloured
     `var(--color-background-muted)` — the track's own colour. Its contrast
     against both fills then *follows from* the two measurements above rather
     than needing its own: each fill already clears 3:1 against the track, so it
     clears 3:1 against a divider made of the track. This is the standard remedy
     for adjacent parts of one graphic, and it is why WCAG 1.4.11 does not
     itself require fill-vs-fill contrast.

     Position it absolutely (`left: calc(<confirmed>% - 1px)`, full track
     height) so it never consumes segment width — the existing clamping at
     `GoalBar.tsx:83-84` must not change, and no width computation may ever add
     the two percentages. Render it **only when both segments are non-zero**;
     there is nothing to divide otherwise.
3. `GoalBar` is one shared module; renders one track, up to two fills positioned
   by offset, optional decorative tick; contains **no arithmetic beyond
   percentage-to-width**, and no addition of confirmed and planned.
4. **Exactly one `role="progressbar"` on the coach outreach view, and exactly
   one on the student/parent outreach view** — measured separately. Each carries
   a resolvable accessible name via `aria-labelledby` to its existing heading,
   valid `aria-valuenow`/`min`/`max` with `valuenow ≤ valuemax`, an
   `aria-valuetext` that **names the planned segment explicitly**, and no
   `tabIndex`.
5. The overflow case (confirmed 9 + planned 7 vs goal 15) renders without the
   fills exceeding the track and without invalid ARIA. Asserted in
   `GoalBar.test.tsx`.
6. `OutreachList.test.tsx:1343` amended `toBe(0)` → `toBe(1)`, test renamed.
   `:1340`, `:1345`, `:1346` pass **unchanged**.
7. Both BEH-01 tests pass unchanged — coach at `:1349` onwards **and
   student/parent at `:1480-1500`**. The milestone `Badge` row and the Toast
   block are byte-identical.
8. The Goal tile at `:1850-1856` still renders.
9. **Captures at 1440px and 375px, light and dark, for both role views** —
   eight figures. This is a colour deliverable; dark theme is not optional.
10. `npx tsc --noEmit` clean; `npx vite build` clean; `npm run format:check`
    clean; `npx eslint .` reports **zero errors and no new warnings**
    (baseline: **0 errors / 353 warnings** — do not chase the pre-existing ones).
11. `npx vitest run` green. Baseline after your merge is **1440 across 62
    files** — confirm and say so if it differs. You are **adding**
    `GoalBar.test.tsx`, so state the expected end count explicitly. The only
    permitted change to an existing test is `:1343` plus its name. Any other
    existing test that changes is a regression — report it, don't silence it.
    Zero `.skip`/`.only`/`.todo`.

## Relevant Constitution Excerpt

- Item 3 — metric formulas live only in SQL views; duplicating one in TypeScript
  is a **BLOCKER**. Trap 1 is this rule.
- Item 11 — DES-21 ladder. The custom bar is F-3's pre-approved final-rung
  escalation for this requirement only; `xstyle` does not work here (F-2).
- Item 15 — accessibility is a shipping requirement. This is why the bar carries
  `role="progressbar"` and a real accessible name even though that costs a test
  amendment.
- Item 17 — motivation ethics. Honest progress signals only; no urgency, streak
  or scarcity framing. The frozen toast block is this rule.
- Non-Negotiables — existing tests pass unless explicitly approved; no worker
  self-certifies.

## Required Worker Output

`docs/swarm/active/T136-worker-output.md`:

- Token values chosen, and **measured** ratios for both fills-vs-track **and**
  confirmed-vs-planned, both themes, with the method.
- The `theme.css` regeneration diff.
- `GoalBar`'s props, and an explicit statement of every arithmetic operation it
  performs.
- Rendered proof of exactly one `role="progressbar"` on **each** role view, with
  its full ARIA attribute set and resolved accessible name.
- The overflow case, rendered and measured.
- The exact test line amended, before/after, plus confirmation that `:1340`,
  `:1345`, `:1346`, both BEH-01 tests, the milestone Badge row and the Toast
  block are untouched.
- Test count started from and ended with, delta accounted for.
- Paths of the eight captures.
- Full output of the commands in criteria 10–11.
- Anything unverified, stated plainly as unverified.

Use a throwaway rig (`*.throwaway.*` is gitignored **and** vitest-excluded, so
it cannot affect counts; Chromium at
`/opt/pw-browsers/chromium-1194/chrome-linux/chrome`; `LoginAs` from
`src/test-utils/authHarness.tsx:131`). **Delete it before finishing.**
