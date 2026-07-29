# Worker Packet: T142 — UXC-06 on the dashboard: cap the content, pair two modules two-up

Medium. One page, two changes, both layout. The risk here is not difficulty — it is
shipping something that looks right at 1440px and breaks at 375px.

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

T133 applied the cap-and-centre half to `/calendar`. **The dashboard the requirement
is actually named after never got either half.** `CoachHome.tsx` has no width cap,
and its modules stack one per row.

The cited basis is the desktop wireframe at `docs/swarm/VOLT_Portal_PRD.md:107-122`.
Its Coach Home shows a KPI row, then two modules side by side:

```
│ ○ Reports │  ┌ Next up ─────────────┐ ┌ Recent signups ────┐ │
│ ○ Settings│  │ list of sessions     │ │ activity feed      │ │
```

Those two modules exist today, stacked. `CoachHome.tsx:2345-2347` records that
T124 renamed "Recent signups" to the activity feed, so the wireframe's right-hand
module is today's **Activity feed**. The pairing the PRD asks for is
**Next up + Activity feed**, and no interpretation is required to identify it.

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

No `maxWidth` anywhere in the file — I grepped it, there are zero matches. On a wide
monitor the dashboard runs full-bleed, which is the first clause of UXC-06 unmet.

T133 solved this on `/calendar` and the solution is **not** the obvious one. From
`CalendarPage.tsx:803-812`, comment retained verbatim because it is load-bearing:

```jsx
// UXC-06: cap the page content at ~1120px and centre it. `maxWidth`
// alone does not centre (no auto-margin anywhere in Stack/Center) --
// the outer `VStack hAlign="center"` centers the inner, capped `VStack`
// on the cross axis; `width="100%"` on the inner `VStack` is
// load-bearing so it fills up to the cap instead of shrinking to
// fit-content under `align-items: center` ...
<VStack hAlign="center">
  <VStack width="100%" maxWidth={1120} gap={6} padding={6}>
```

T133 needed **three** premise rounds to arrive at that shape; the ledger
(`task-ledger.md:155`) records that `maxWidth` alone caps without centring, because
nothing in `Stack`/`Center` sets an auto margin. Do not simplify it back to a single
`maxWidth`. Reuse the two-layer shape.

**What I have NOT verified, and you must not assume.** `CalendarPage.tsx` applies
that pattern inside a plain page body. `CoachHome.tsx` sits inside
`<LayoutContent padding={6}>`, which is a different container and already carries
the padding. I do not know whether the pattern transplants unchanged, whether the
padding doubles, or whether `LayoutContent` imposes its own width behaviour that
makes the outer `hAlign="center"` a no-op. **Measure it. Do not reason about it.**
If the shape needs adjusting for this container, adjust it and say exactly what you
changed and what you measured — that is a finding, not a deviation.

---

## Part 2 — pair Next up and Activity feed two-up

Current structure, `CoachHome.tsx:2322-2383`. Both modules share one shape:

```jsx
<VStack gap={3}>
  <Heading level={2} id={nextUpHeadingId}>Next up</Heading>
  <div role="group" aria-labelledby={nextUpHeadingId}>
    ...
  </div>
</VStack>

<Divider />          // line 2343 — between the two modules

<VStack gap={3}>
  <Heading level={2} id={activityFeedHeadingId}>Activity feed</Heading>
  <div role="group" aria-labelledby={activityFeedHeadingId}>
```

Wrap those two `VStack`s in a single `Grid` so they sit side by side, and **delete
the `<Divider />` at line 2343 that currently separates them** — a horizontal rule
between two side-by-side columns is meaningless. The `Divider`s *before* Next up
(line 2320) and *after* Activity feed (2385) stay: those still separate stacked
siblings.

### The trap that matters most

`Grid` accepts two forms of `columns`, and they behave completely differently:

- `columns={2}` — **fixed**. `Grid.js:347` emits `repeat(2, 1fr)`. Two columns at
  every width, including 375px. This would ship a broken mobile dashboard.
- `columns={{ minWidth: N, max: 2 }}` — **responsive**. `Grid.js:275-285` builds
  `repeat(fill, minmax(min(100%, max(Npx, perColumn)), 1fr))`. The `min(100%, …)`
  is what lets a lone column shrink to the container on mobile.

**Use the object form.** Every existing `Grid` in this codebase already does —
`KpiStrip.tsx:284,342`, `CoachHome.tsx:2016,2153,2222,2240`, `HoursTab.tsx:1050,1105`
— so the object form is also the house pattern, not just the correct one.

Choose `minWidth` so the pair is genuinely two-up within the 1120px cap and genuinely
one-up at 375px, and **state the arithmetic in your output doc**. Do not copy a number
from another call site because it looks similar; those grids hold KPI cards, not
list modules.

### Do not disturb the accessibility structure

The `role="group"` + `aria-labelledby={…HeadingId}` wrappers are deliberate — they
come from earlier UXC-01 work, and T133's ledger row records that region labelling on
these pages has already been broken once and repaired. Your change is layout only.
Each module must keep its `Heading`, its generated id, and its labelled `group`,
with the heading still labelling the same content. If your restructuring changes
which element carries a name, you have broken something.

---

## Scope — and one judgement call to flag

**In scope: `CoachHome.tsx` only.**

I am excluding the other two home pages deliberately, and you should not extend to
them:

- `ParentHome.tsx` — has **zero** `Heading level={2}` modules (grep-confirmed). There
  is nothing to pair.
- `StudentHome.tsx` — has five, but the PRD wireframe specifies it as
  **"STUDENT HOME (mobile, 375px)"** (`VOLT_Portal_PRD.md:135`). Two-up is not its
  design intent, and UXC-06's own basis clause names Coach Home specifically.

**Flagged for the orchestrator, not for you to resolve:** UXC-06's cap clause
(Part 1) is arguably a separate concern from its pairing clause (Part 2), and this
task's ledger title names only the pairing. I have scoped both into T142 because
they are one requirement, on one page, and the pairing's column widths are meaningless
without the cap. If that call is wrong it is mine, not yours — implement both.

`/reports` and `/settings` are explicitly excluded by UXC-06 itself. Do not touch them.

---

## Allowed Files

- `src/pages/home/CoachHome.tsx`
- `src/pages/home/CoachHome.test.tsx`
- `docs/swarm/active/T142-worker-output.md` (create)

## Forbidden Files

- `docs/swarm/constitution.md`, `task-ledger.md`, `verification-log.md`, `dispute-log.md`
- Any other `docs/swarm/**` file, including other packets
- `.claude/**`
- `src/pages/reports/**`, `src/pages/settings/**` (UXC-06 excludes them)
- `src/pages/home/StudentHome.tsx`, `src/pages/home/ParentHome.tsx` (see Scope)
- `src/pages/calendar/CalendarPage.tsx` — read it for the T133 pattern, do not edit it
- Anything under `node_modules/`

## Acceptance Criteria

1. `CoachHome.tsx` caps its content at 1120px **and centres it**, using T133's
   verified two-layer shape or a documented adaptation of it for `LayoutContent`.
2. **Measured, not asserted:** at a 1440px viewport, the capped content measures
   ~1120px with roughly equal space either side. Report the actual numbers.
3. Next up and Activity feed render side by side at 1440px, in that order,
   left to right.
4. **Measured, not asserted:** at 375px they stack in one column, and
   `document.documentElement.scrollWidth === window.innerWidth` — no horizontal
   scroll. This is the criterion that catches `columns={2}`; report both numbers.
5. The `<Divider />` formerly at line 2343 (between the two paired modules) is gone;
   the Dividers bounding the pair remain.
6. Both modules keep `Heading level={2}` with their generated ids, and both keep
   `role="group"` with `aria-labelledby` pointing at the matching heading. State how
   you confirmed the accessible names survived.
7. A regression test in `CoachHome.test.tsx` that fails if the pairing is undone.
   **Prove it discriminates:** revert the Grid to a plain stack, confirm the test
   fails, restore, confirm it passes. Report what you saw. A test that passes both
   ways is worth less than no test, and has already cost this task set two rounds
   this session.
8. `npx tsc --noEmit`, `npx vite build`, `npm run format:check`, `npx eslint .` and
   `npx vitest run` all clean. Current baseline on the integration branch: **0 errors,
   352 warnings**, 63 test files, 1469 tests. Report your numbers and explain any
   difference.

## Measurement

Criteria 2 and 4 need a real browser. Chromium is preinstalled and Playwright is
configured to find it — `PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers`. **Do not run
`playwright install`.**

T133's checker learned this the hard way and the ledger records it: its first
measurement run omitted `theme.css` and would have produced a false MAJOR. **Load the
app's real stylesheets in your measurement rig**, or your numbers describe a page that
does not exist.

## Relevant Constitution Excerpt

- Item 8 — Astryx is the only permitted UI vocabulary. Use `Grid`; no CSS grid by
  hand, no new dependency, no hand-rolled media queries.
- Item 2/13 — no hardcoded hex colours.
- Item 15 — accessibility is not optional; see criterion 6.
- Item 19c — verify a citation before asserting it. If anything in this packet does
  not match the tree, **stop and report the mismatch rather than guessing at intent**.
  A packet in this session asserted a line citation was wrong without opening the
  commit, a worker wrote it into source, and it took a checker to catch it (D012).
  You are explicitly invited to find me wrong.

## Required Worker Output

Create `docs/swarm/active/T142-worker-output.md` covering: files changed; the
`minWidth` you chose and the arithmetic behind it; whether T133's pattern transplanted
into `LayoutContent` unchanged and what you measured either way; the four measured
numbers (1440px content width and side margins; 375px column count and
scrollWidth/innerWidth); how you confirmed the accessible names survived; the
discrimination proof for criterion 7; full command output; and anything you could not
verify, stated plainly as unverified rather than omitted.

Do not mark this task complete. A checker verifies it.
