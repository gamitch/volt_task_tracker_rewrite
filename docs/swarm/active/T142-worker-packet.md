# Worker Packet: T142 — UXC-06 on the dashboard: cap the content, pair two modules two-up

Revision 2. Revision 1 was gated and came back REVISE with three MAJORs; the
corrections are folded in below and the errors are named at the end so you can see
what this packet got wrong before you trusted it.

Medium. One page, two changes, both layout. The risk is not difficulty — it is
shipping something that looks right at 1440px and is broken at 375px, past a check
that reports success either way.

**Packet SHA: pin this.** Before writing your output doc, run
`git log -1 --format=%H -- docs/swarm/active/T142-worker-packet.md` and confirm it
matches the SHA in your dispatch prompt.

## FIRST — merge the working branch

```
git fetch origin
git merge origin/claude/swarm-plan-zl575z
```

Report the result. **If it conflicts, stop and report.**

## Why this exists

UXC-06 (`docs/swarm/VOLT_UX_Craft_PRD_v3.md:81`, severity MINOR) reads:

> Content max-width ~1120px (forms stay 720); no full-bleed bars/controls;
> dashboard modules pair two-up via `Grid`. **Excludes `/reports` + `/settings`.**
> *Basis: PRD v1 §4.2 two-column Coach Home.*

That is **three** clauses. T133 applied the first to `/calendar`. The dashboard the
requirement is named after has none of them: `CoachHome.tsx` has no `maxWidth`
anywhere (grep returns zero matches; repo-wide, `1120` appears only at
`CalendarPage.tsx:803,812`).

The cited basis is the desktop wireframe at `docs/swarm/VOLT_Portal_PRD.md:107-122`.
Its Coach Home shows a KPI row, then two modules side by side (`:119-120`):

```
│ ○ Reports │  ┌ Next up ─────────────┐ ┌ Recent signups ────┐ │
│ ○ Settings│  │ list of sessions     │ │ activity feed      │ │
```

The wireframe's right-hand module is today's **Activity feed**. That mapping does not
rest on a comment — T124 (`git show 13f67f5`) removes
`<Heading level={2}>Recent signups</Heading>` and adds
`<Heading level={2}>Activity feed</Heading>` in the same structural slot; the
wireframe's own inner text at `:120` already reads "activity feed";
`CoachHome.test.tsx:1140` asserts the page no longer contains "Recent signups"; and
ledger T124 (`task-ledger.md:145`) records the feed as superseding it. It is a
supersede, not a rename.

## Scope — read this before you start

**In scope: `CoachHome.tsx` only, and only two of UXC-06's three clauses.**

### The clause this task does NOT close

"No full-bleed bars/controls" is **not** addressed here. The HTML PRD expands it —
two-option segmented controls end; bars cap near ~480px or their module's column
width — and the coach-dashboard finding at `VOLT_UX_Craft_PRD_v3.html:245` names
"Single-column modules with **1100px bars**" as the defect. Two live sites remain
after T142: a two-option `SegmentedControl` at `CoachHome.tsx:2421-2428`
(`All` / `Below goal`) and a module-width `ProgressBar` at `:2165`.

**Do not fix them, and do not let anyone read T142 as closing UXC-06 on this page.**
Say so in your output doc.

### The interpretation this task is making

`CoachHome.tsx` has **five** level-2 module sections: Next up (`:2323`), Activity
feed (`:2349`), Hours by team (`:2390`), Goal projection (`:2418`), Top events
(`:2459`). The HTML PRD phrases the rule generally — "Dashboard modules pair into two
columns via Astryx `Grid`" (`VOLT_UX_Craft_PRD_v3.html:167`).

**Pairing two of five and leaving three stacked is an interpretation.** It is
justified by the wireframe naming that specific pair and no other, but it is a
choice, and revision 1 wrongly claimed no interpretation was involved. Implement the
wireframe's pair. If you think the other three should also pair, say so in your
output doc as a finding — do not act on it.

### Pages excluded

- `ParentHome.tsx` — zero `Heading level={2}` (uses 1/3/4). Nothing to pair.
- `StudentHome.tsx` — **four** level-2 headings in JSX (`:995, :1277, :1294, :1317`).
  The wireframe specifies it as "STUDENT HOME (mobile, 375px)"
  (`VOLT_Portal_PRD.md:140`), and UXC-06's basis clause names Coach Home.

`/reports` and `/settings` are excluded by UXC-06 itself.

---

## Part 1 — cap and centre the dashboard content

`CoachHome.tsx:2103-2107` currently returns:

```jsx
<Layout
  height="fill"
  content={
    <LayoutContent padding={6}>
      <VStack gap={6}>
```

T133 solved capping on `/calendar`, and the solution is not the obvious one. From
`CalendarPage.tsx:803-812`:

```jsx
// `maxWidth` alone does not centre (no auto-margin anywhere in Stack/Center) --
// the outer `VStack hAlign="center"` centers the inner, capped `VStack` ...
<VStack hAlign="center">
  <VStack width="100%" maxWidth={1120} gap={6} padding={6}>
```

T133 needed three premise rounds to get there (`task-ledger.md:155`). Do not
simplify it back to a bare `maxWidth`.

### How it must differ here — this is settled, not open

Revision 1 told you to measure whether this transplants into `LayoutContent`. It was
gated and the answer was determined from source, so you do not need to discover it:

1. **`hAlign="center"` works here.** `LayoutContent` renders a plain block `<div>`
   with no `display` set, so the `VStack` fills its content box and `Stack`'s
   `hAlign` → `align-items` centring applies. Measured at 1440px: outer 1152 → inner
   1120, 16px each side.
2. **A verbatim transplant double-pads.** `LayoutContent padding={6}` is 24px and
   T133's inner `VStack padding={6}` adds another 24px — measured 64px inset per
   side, leaving **1072px** of readable content inside a 1120px cap.

**Prescription:** keep `<LayoutContent padding={6}>`, wrap in the outer
`VStack hAlign="center"`, and use an inner `VStack width="100%" maxWidth={1120}
gap={6}` **with no `padding` prop**.

Do not instead set `LayoutContent padding={0}` and keep the inner padding: that also
zeroes the `--container-padding-*` bleed variables, which this page's `Divider`s
read. Confirm the measurement matches; do not re-derive the design.

---

## Part 2 — pair Next up and Activity feed two-up

Current structure, `CoachHome.tsx:2322-2383`. Both modules share one shape:

```jsx
<VStack gap={3}>
  <Heading level={2} id={nextUpHeadingId}>Next up</Heading>
  <div role="group" aria-labelledby={nextUpHeadingId}>...</div>
</VStack>

<Divider />          // line 2343 — between the two modules

<VStack gap={3}>
  <Heading level={2} id={activityFeedHeadingId}>Activity feed</Heading>
  <div role="group" aria-labelledby={activityFeedHeadingId}>
```

Wrap those two `VStack`s in one `Grid`, and **delete the `<Divider />` at 2343** — a
horizontal rule between side-by-side columns is meaningless. The Dividers at
**2320** and **2385** stay; they separate stacked siblings.

### The trap that decides this task

`Grid`'s `columns` prop takes two forms that behave completely differently:

- `columns={2}` — **fixed**. `Grid.js:347` emits `repeat(2, 1fr)`: two columns at
  every width, 375px included. This ships a broken mobile dashboard.
- `columns={{ minWidth: N, max: 2 }}` — **responsive**. `Grid.js:275-285` builds
  `repeat(auto-fill, minmax(min(100%, max(Npx, perColumn)), 1fr))`. The
  `min(100%, …)` is what lets a lone column shrink to the container.

**Use the object form.** All eight existing `Grid` call sites do —
`KpiStrip.tsx:284,342`, `CoachHome.tsx:2016,2153,2222,2240`, `HoursTab.tsx:1050,1105`.
`max` is documented at `astryx-api.md:135`.

### Choosing `minWidth` — there is a window, and both ends are live

UXC-06's own accept clause (`VOLT_UX_Craft_PRD_v3.html:169`) requires modules to
render two-up **above 1024px**. So:

- Too small, and it never collapses at 375px.
- **Too large, and it silently fails across the whole 1024–1280 band** while looking
  perfect at 1440px. A value like 450 would pass a check that only measures 1440 and
  375.

The gate measured the usable width as roughly 688px at a 1024px viewport (240px
sidenav plus padding), putting the window at approximately **175–330**. Treat that as
a starting point, not gospel — **verify it by measuring at all three widths** and
state your arithmetic. Do not copy a `minWidth` from another call site; those grids
hold KPI cards, not list modules.

### Do not disturb the accessibility structure

The `role="group"` + `aria-labelledby` wrappers are deliberate. T129
(`task-ledger.md:150`) records that region labelling on **this page** was broken and
repaired once already — `aria-labelledby` on a role-less div is name-prohibited, and
removing a `List header` lost the accessible name. `CoachHome.test.tsx:1247-1300`
pins the current structure and must keep passing. Your change is layout only.

---

## Allowed Files

- `src/pages/home/CoachHome.tsx`
- `src/pages/home/CoachHome.test.tsx`
- `docs/swarm/active/T142-worker-output.md` (create)

## Forbidden Files

- `docs/swarm/constitution.md`, `task-ledger.md`, `verification-log.md`, `dispute-log.md`
- Any other `docs/swarm/**` file, including other packets
- `.claude/**`
- `src/pages/reports/**`, `src/pages/settings/**`
- `src/pages/home/StudentHome.tsx`, `src/pages/home/ParentHome.tsx`
- `src/pages/calendar/CalendarPage.tsx` — read for the T133 pattern, do not edit
- Anything under `node_modules/`

## Acceptance Criteria

1. `CoachHome.tsx` caps content at 1120px and centres it, using the prescription in
   Part 1 (outer `hAlign="center"`, inner capped `VStack` with no `padding` prop).
2. **Measured at 1440px:** report the inner element's **border-box** width (expect
   ~1120) **and** its content-box width, plus the space either side. Naming both is
   required — a verbatim T133 transplant yields 1120 border-box but only 1072
   content-box, and that difference is how you prove you did not double-pad.
3. Next up and Activity feed render side by side at 1440px, in that order left to
   right. Verify by `getBoundingClientRect`, not by eye.
4. **The `columns={2}` discriminator — assert this in jsdom, it is deterministic.**
   `Grid` reflects visual props as data attributes, and passes the numeric form
   through as its variant (`Grid.js:372-376`, `themeProps.js:67-104`):
   - `columns={2}` renders `data-columns="2"`
   - `columns={{minWidth, max: 2}}` renders **no** `data-columns` attribute

   Assert the Grid wrapping the two modules has no `data-columns`. **This is the
   primary proof**, and it needs no browser.
5. **Measured at 375px:** the two modules occupy one column — report the computed
   `grid-template-columns` and the two elements' `getBoundingClientRect().top` values
   showing they are stacked.

   **Do not use `document.documentElement.scrollWidth === window.innerWidth` as your
   proof.** The gate ran this in Chromium: with `repeat(2, 1fr)` at 375px, columns
   compute to `151.5px 151.5px` in one row — the exact broken state — and that
   assertion still **passes**, because `Layout height="fill"` scrolls internally
   (`Layout.tsx:38`) and `LayoutContent` sets `overflow: auto`
   (`LayoutContent.tsx:84-86`), absorbing the overflow before it reaches the
   document. It worked on `/calendar` only because `CalendarPage.tsx` never mounts
   `Layout` at all. If you want an overflow number, measure the **`LayoutContent`
   element's own** `scrollWidth` vs `clientWidth` (broken state reads 470 vs 375).
6. **Measured at 1024px:** both modules still render two-up, per UXC-06's accept
   clause. This is the criterion that catches an over-large `minWidth`.
7. The `<Divider />` formerly at 2343 is gone; those at 2320 and 2385 remain.
8. Both modules keep `Heading level={2}` with their ids and `role="group"` with
   `aria-labelledby` pointing at the matching heading. `CoachHome.test.tsx:1247-1300`
   still passes. State how you confirmed the accessible names survived.
9. A regression test in `CoachHome.test.tsx` that fails if the pairing is undone.
   Assert both that the two headings share a `Grid` ancestor and that the ancestor
   carries the expected track template — `Grid` exposes it as the inline custom
   property `--x-gridTemplateColumns` (`Grid.js:57-62`), readable in jsdom.
   **Prove it discriminates:** revert the Grid to a plain stack, confirm failure,
   restore, confirm pass. Report what you saw. A test that passes both ways is worth
   less than none, and has already cost this task set two rounds this session.
10. `npx tsc --noEmit`, `npx vite build`, `npm run format:check`, `npx eslint .` and
    `npx vitest run` all clean. Verified baselines: **0 errors, 352 warnings**,
    63 test files, 1469 tests. Report yours and explain any difference.

## Measurement

Criteria 2, 3, 5 and 6 need a real browser. Chromium is preinstalled and Playwright
is configured — `PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers`. **Do not run
`playwright install`.**

T133's checker's first run omitted `theme.css` and would have produced a false MAJOR
(`task-ledger.md:155`). **Load the app's real stylesheets**, or your numbers describe
a page that does not exist.

Criteria 4 and 9 are jsdom and need no rig at all.

## Relevant Constitution Excerpt

- **Item 11** — UI is built from Astryx components; styling escalation order is
  component → theme token → xstyle → custom CSS. Use `Grid`; no hand-rolled CSS grid,
  no media queries, no new dependency.
- **Item 2** — component props come only from `docs/swarm/astryx-api.md`. A prop not
  in that file is presumed hallucinated. `columns`, `max`, `minWidth`, `gap`,
  `maxWidth`, `hAlign`, `width` are all documented.
- **Item 19c** — verify a citation before asserting it. If anything here does not
  match the tree, **stop and report the mismatch rather than guessing at intent.**

## What revision 1 of this packet got wrong

Read this as calibration on how much to trust the rest.

- It designated `documentElement.scrollWidth === innerWidth` as the check that catches
  `columns={2}`. **It cannot** — it reads identically on a correct and a broken page,
  because this page scrolls internally. Revision 1 warned you not to transplant
  T133's *layout* pattern across a container boundary, then transplanted T133's
  *measurement* technique across that same boundary.
- It had no 1024px criterion, so a `minWidth` of 450 would have passed every check
  while violating the requirement across the entire 1024–1280 band.
- It told you to measure the `LayoutContent` question that was answerable from source,
  costing a round for nothing.
- Four citations were wrong: the StudentHome wireframe line (`:135`, actually `:140`);
  StudentHome's heading count (five, actually four — the fifth grep hit was inside a
  comment); the ledger row for the region-labelling break (T133's, actually T129's at
  `:150`); and two constitution items (item 8 is the stack lock, not the Astryx-only
  rule which is item 11; and neither item 2 nor 13 says anything about hex colours).
- It escalated a scope question by citing "this task's ledger title" — **there is no
  T142 ledger row.** The judgement was fine; the premise was invented.
- It claimed identifying the pair required no interpretation, without disclosing that
  three of five modules stay stacked.
- It called UXC-06 two clauses. It is three.

## Required Worker Output

Create `docs/swarm/active/T142-worker-output.md` covering: files changed; the
`minWidth` chosen and its arithmetic; confirmation the cap measurement matches the
prescription (border-box and content-box both); all measured numbers at 1440, 1024
and 375; the `data-columns` assertion; how you confirmed accessible names survived;
the discrimination proof for criterion 9; explicit restatement that UXC-06's
full-bleed clause remains open with its two sites; full command output; and anything
you could not verify, stated plainly as unverified rather than omitted.

Do not mark this task complete. A checker verifies it.
