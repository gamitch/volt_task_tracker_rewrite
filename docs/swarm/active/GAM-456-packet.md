# Worker Packet: GAM-456 — STANDARD

## Task ID
GAM-456 (coach dashboard: panel the three bare sections, restore header display size)

## Objective
In `src/pages/home/CoachHome.tsx`, wrap the three currently-bare sections
(Hours by team, Goal projection, Top events) in the existing `Card` primitive
to match the three already-panelled sections (Next up, Activity feed,
Leaderboard), and restore the page header's H1 to 46px/800 with an
accent-orange, uppercase, 800-weight eyebrow — matching the approved design
that GAM-438 partially implemented.

## Allowed Files
- `src/pages/home/CoachHome.tsx`
- `src/pages/home/CoachHome.test.tsx`

## Forbidden Files
- `docs/swarm/`
- `.claude/`
- `AGENTS.md`
- any file under `src/theme/` (the fix is page-scoped; do not touch
  `theme.css`/`volt.ts` — see "Why not a theme token" below)
- any other page under `src/pages/`

## Background (verified against `main` @ `14708be`, re-verify before use)

`CoachHome.tsx`'s own module doc (`:612-671`, "16. GAM-438") already
established the pattern this task extends. Read it before editing — it
documents *why* `style` (not `xstyle`) is this app's real customization
surface (`xstyle`/`stylex.create()` throws at runtime here, no babel plugin;
re-confirmed live for this packet by importing the installed
`@stylexjs/stylex` and calling `stylex.create()` under this repo's own
Vitest config).

**1. Three sections are still bare** — each is a plain
`<VStack gap={3}><Heading level={2} id={...}>Title</Heading><div role="group"
aria-labelledby={...}>...</div></VStack>`, unlike the three `<Card>`-wrapped
siblings:
- Hours by team: `CoachHome.tsx:2792-2815`
- Goal projection: `CoachHome.tsx:2823-2859`
- Top events by student hours: `CoachHome.tsx:2864-2887`

Compare the already-panelled Next up section, `CoachHome.tsx:2722-2743`:
`<Card><VStack gap={3}>...</VStack></Card>` — same inner shape, just wrapped.

**Do not touch the `<Divider />` elements** immediately before/after each of
these three `VStack`s (`:2788`, `:2817`, `:2861`, `:2889`). They separate
*stacked* siblings, unlike the one `<Divider />` GAM-438 deliberately removed
between the Next up/Activity feed pair (`:2713-2717`'s comment explains why:
that one sits between two side-by-side Grid columns, not stacked siblings).
The already-panelled Leaderboard `Card` (`:2924`) and the conditional Season
setup `Card` (`:2935`) both still have `<Divider />` immediately before them —
Card-wrapping a stacked section does not remove its surrounding Divider in
this codebase's own established pattern.

**2. Header is undersized** — `CoachHome.tsx:2493-2497`:
```tsx
<VStack gap={1}>
  <Text type="supporting" color="secondary">
    {seasonName}
  </Text>
  <Heading level={1}>Coach dashboard</Heading>
</VStack>
```
Renders 24px/600 (theme.css:134-135, `--text-heading-1-size:
var(--font-size-2xl)` = 1.5rem/24px, `--text-heading-1-weight:
var(--font-weight-semibold)` = 600). The design wants 46px/800 for the H1,
and an accent-orange, uppercase, 800-weight eyebrow (currently plain
`color="secondary"`, no transform, weight 400).

**Why not a theme token.** `--text-heading-1-*` (`theme.css:134-135`) is
consumed by every `Heading level={1}` in the app — ~25 other call sites
(login/access/invite "VOLT" wordmarks, `RosterShell`, `CalendarPage`,
`SettingsPage`, etc.). Changing the token would resize all of them. This is a
one-page treatment; use a scoped `style` override, exactly as `KpiCard`
already does two constants above (`KPI_TILE_GRADIENT_STYLE`/
`KPI_GOAL_ACCENT_STYLE`, `:1947-1961`).

**Why not `Heading`'s own `type="display-1"` prop.** `Heading` does expose a
real `type?: 'display-1' | 'display-2' | 'display-3'` prop (confirmed in the
installed `@astryxdesign/core` source,
`node_modules/@astryxdesign/core/dist/Heading/Heading.d.ts:23-50`) that looks
like the natural "component prop" rung of the DES-21 ladder. **Verify before
using it** — `theme.css:166-168` defines `--text-display-1-size:
var(--font-size-5xl)` (2.625rem = 42px, not 46px) with
`--text-display-1-weight: var(--font-weight-normal)` (400 — *lighter* than
current, the opposite of what the design wants, since normal < the current
semibold). `type="display-1"` would move the H1 in the wrong direction on
weight. Confirm this against `theme.css` yourself before writing any code —
do not take this packet's numbers on faith (item 19c).

**No weight token above `bold` (700) exists anywhere in the theme** — the
full scale is `normal:400 / medium:500 / semibold:600 / bold:700`
(`node_modules/@astryxdesign/core/dist/astryx.css:53`). 800 is not
expressible as any token; it must be a literal numeric `fontWeight: 800` in a
`style` object, same as this file's existing precedent of literal values in
`CSSProperties` constants for anything the token scale can't express.

**3. `Heading`/`Text` genuinely accept `style`** — both destructure
`style` and merge it in via `mergeProps(...)` *after* their own StyleX
classes (confirmed in the installed source,
`node_modules/@astryxdesign/core/dist/Heading/Heading.js:79,136-139` and
`.../Text/Text.js` same shape), so it reliably wins with no `!important` —
the same mechanism this file already uses for `Card`'s `style` prop.

## Acceptance Criteria

1. **Hours by team**, **Goal projection**, and **Top events by student
   hours** (`:2792-2815`, `:2823-2859`, `:2864-2887`) are each wrapped in a
   plain `<Card>` around their existing `<VStack gap={3}>...</VStack>`, same
   shape as the Next up section at `:2722-2743`. No other change to their
   contents, ids, or the `role="group"`/`aria-labelledby` wiring. The four
   surrounding `<Divider />` elements (`:2788`, `:2817`, `:2861`, `:2889`)
   are unchanged (still present, still in the same position relative to the
   `VStack`/`Card`).
2. A new module-level `CSSProperties` constant (e.g.
   `COACH_HOME_TITLE_STYLE`) sets `fontSize: '2.875rem'` (46px) and
   `fontWeight: 800`, applied via `style={COACH_HOME_TITLE_STYLE}` on the
   `<Heading level={1}>Coach dashboard</Heading>` at `:2497`. Do not change
   `level` (stays `1`, for correct document outline/semantics) and do not
   use the `type` prop (see "Why not `type=\"display-1\"`" above).
3. A new module-level `CSSProperties` constant (e.g.
   `COACH_HOME_EYEBROW_STYLE`) sets `textTransform: 'uppercase'` and
   `fontWeight: 800`. The eyebrow `<Text type="supporting" color="secondary">`
   at `:2494-2496` changes to `color="accent"` (real prop, resolves to
   `theme.css:206`'s `--color-accent` — do not hand-roll a hex color) plus
   `style={COACH_HOME_EYEBROW_STYLE}`.
4. Both new constants are placed near the top of the component (module-level,
   not per-render) and carry a one-line comment stating the literal
   size/weight has no matching theme token (mirroring the existing
   `KPI_TILE_GRADIENT_STYLE` comment style at `:1942-1946`).
5. Update the module doc block (`:612-671`) with a new numbered entry
   (`17. GAM-456 — ...`) following the existing `16.` entry's structure:
   what changed, the file/line citations, and the "why not a theme token /
   why not `type`" reasoning condensed to 3-5 sentences (the full reasoning
   already lives in this packet and the run log; don't duplicate it at
   length in-source).
6. Extend `CoachHome.test.tsx` with jsdom-provable structural proof, not a
   snapshot — follow the existing precedent at `:2242-2251` (`.astryx-card`
   ancestry check for the Leaderboard) and adapt it for the three newly
   wrapped sections: for each of the three new headings, resolve to the
   `role="group"` region the same way `resolveAriaLabelledbyTarget` already
   does (`:1813-1832`, reuse it — it's already scoped over the whole file),
   then assert `.closest('.astryx-card')` is not null. Also assert the H1
   and eyebrow's *inline* style values directly (`element.style.fontSize`,
   `element.style.fontWeight`, `element.style.textTransform`) — inline
   `style` is visible in jsdom even though real CSS/custom-property
   resolution is not (this file's own Leaderboard comment at `:2919-2922`
   already documents that jsdom limitation; inline style sidesteps it
   because it needs no stylesheet).
7. **Named mutation** (report the real red output, not a description): after
   writing the fix, temporarily revert exactly one of the three new `Card`
   wraps (e.g. remove the `<Card>`/`</Card>` around Hours by team only) and
   confirm the new test for that section fails with a real assertion error
   (not a crash). Restore it, re-run, confirm green. Do the same once for
   the H1 style constant (e.g. change `fontWeight: 800` to `fontWeight:
   600`) confirming the new style assertion fails, then restore.
8. All six gates green (use the `gate-run` skill; do not hand-roll separate
   tsc/eslint/vitest invocations): `tsc`, `vite build`, `format:check`,
   `eslint`, full `vitest`, and the scoped `CoachHome.test.tsx` run.
9. No change to `dashboardState`, data loaders, `role="group"`/
   `aria-labelledby` wiring, or any section's text content — this is a pure
   presentation change per the issue's own "Size and tier" framing (no write
   path, no schema, no metric arithmetic).

## Least confident decisions (item 19d — STANDARD doesn't require this
formally, included anyway since two of the calls above are genuinely close)

1. **46px as the literal H1 size.** The issue's measured table says "46px /
   800" for the design; I'm taking that at face value rather than
   re-deriving it from the artboard myself. If the artboard actually renders
   at a different effective px (e.g. due to root font-size differences
   between the artboard tool and this app), 2.875rem could be off. Worker:
   trust the issue's measured number as given; this is not something to
   re-derive from the artboard in this pass.
2. **Using `color="accent"` for the eyebrow rather than a hand-specified
   value.** The issue's table just says "accent orange"; `color="accent"`
   is the idiomatic prop and resolves to the right token
   (`theme.css:206/215`), but if the design artboard's exact orange differs
   from this theme's `--color-accent`, that's a design-token question for
   the owner, not something to solve by hardcoding a new hex in this file.
3. **Whether the module-doc addition (`criterion 5`) is worth the churn.**
   This file's convention is heavily documented, but the doc block is
   already 671 lines into the file; if it turns out awkward to insert
   cleanly, a shorter form (a comment directly above the new constants
   instead of a new numbered top-of-file entry) is an acceptable substitute
   — don't fight the file structure to force a top-of-file entry.

## Relevant Constitution Excerpt
Item 26 (STANDARD): worker implements, orchestrator replays the mutation, no
separate checker round. Item 27: not applicable — no fixture/stub surface
here, this reads no data at all differently than before. Workers may not
edit `docs/swarm/`, `.claude/`, `AGENTS.md`, or files outside Allowed Files.

## Most Recent Failure
None — first attempt.

## Required Worker Output
- Full diff of `CoachHome.tsx` and `CoachHome.test.tsx`.
- The two named-mutation red outputs (real pasted output, not paraphrase),
  and the green re-run after restoring.
- `gate-run` skill's evidence block (all six gates, exit codes).
- Any deviation from this packet, and why.
- Known risks / anything left unresolved.
