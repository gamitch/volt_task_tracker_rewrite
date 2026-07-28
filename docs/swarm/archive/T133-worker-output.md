# T133 Worker Output — Calendar page craft pass (UXC-04 / UXC-01 / UXC-06)

## Files changed

- `src/pages/calendar/CalendarPage.tsx` — the three fixes.
- `src/pages/calendar/CalendarPage.test.tsx` — exactly one existing `it`
  block amended (`:479-490` region, see "Exact test lines amended" below).
- `docs/swarm/figures/ux-craft/T133-calendar-1440-light.webp` (new)
- `docs/swarm/figures/ux-craft/T133-calendar-1440-dark.webp` (new)
- `docs/swarm/figures/ux-craft/T133-calendar-375-light.webp` (new)
- `docs/swarm/figures/ux-craft/T133-calendar-375-dark.webp` (new)
- `docs/swarm/active/T133-worker-output.md` (this file)

No other files were touched. `List` was left alone (only its `header` prop
was removed, per remedy (b) — the `List`/`ListItem` component usage itself is
unchanged). No `src/pages/outreach/**` or `src/pages/meetings/**` files were
edited (read-only reference only). `docs/swarm/astryx-api.md` was not edited.

**Mid-task correction applied:** the coordinator instructed, after the
initial implementation, to accept the lost truncation as-is: do not propose
`labelLines={1}`, do not ship a TypeScript cast. This output reports the
measured truncation behavior as accepted-and-decided, not as an open
proposal — see criterion 3 below.

## 1. UXC-04 — the title becomes the link

`CalendarSessionRowItem` now renders:

```tsx
return (
  <ListItem
    label={
      <Link
        as={RouterLink}
        href={detailHrefFor(event, session)}
        isStandalone
        weight="semibold"
        maxLines={1}
        color="primary"
      >
        {event.title}
      </Link>
    }
    description={description}
    endContent={endContent}
  />
);
```

where `endContent` is now just `<Badge variant={typeBadge.variant} label={typeBadge.label} />`
(the `HStack` wrapper that previously held the Badge + the "View details –"
`Link` was removed since only the Badge remains — a single child no longer
needs the `HStack`). `detailHrefFor` is unchanged, byte-for-byte.

No `<Text>` is nested inside the `Link` (shipped exactly the prescribed
shape). No `aria-label`/`tooltip` on the link.

### Measured title-link typography and row height, before/after

Measured via a throwaway Playwright rig (Chromium
`/opt/pw-browsers/chromium-1194/chrome-linux/chrome`) rendering the real
`CalendarPage` inside `AppShell`/`AuthProvider`/`SeasonProvider`/`Theme`, at
1440px, light theme, first row = "Weekly Build Meeting"
(`/meetings/session-build-past`).

**Before** (git-stashed the `.tsx` change, re-measured, then restored):

| | value |
|---|---|
| Row link text | `View details – Weekly Build Meeting` |
| Label span tag | `SPAN` |
| Label `font-weight` | `400` |
| Label `font-size` | `14px` |
| Label `color` | `rgb(29, 26, 33)` |
| Row heights (4 rows) | `57, 57, 57, 57` px |

**After:**

| | value |
|---|---|
| Row link text | `Weekly Build Meeting` |
| Outer `<a>` `display` | `inline-flex` |
| Outer `<a>` `font-weight` | `400` |
| Inner `Text` span `font-weight` | `600` (from `weight="semibold"`) |
| Inner `Text` span `font-size` | `14px` (unchanged) |
| Inner `Text` span `color` | `rgb(29, 26, 33)` |
| Row heights (4 rows) | `57, 57, 57, 57` px |

Row height is **identical** (57px, all four rows, both before and after) —
well within the 2px tolerance the packet allows. The title now renders
semibold (600 vs the previous plain 400) as the link's own inner `Text`
weight; the rendered color is unchanged (`color="primary"` resolves to the
same `--color-text-primary` token the plain label text used, per
`Link.tsx`'s own `primary` variant mapping — confirmed by reading
`node_modules/@astryxdesign/core/src/Link/Link.tsx`'s color-variant table
directly: `primary: { color: { default: colorVars['--color-text-primary'] } }`,
vs `accent: { color: { default: colorVars['--color-text-accent'] } }`, which
is why the packet requires `color="primary"` rather than the `Link` default
`accent` — an accent-colored title would have been a visible color change
from the pre-existing plain-text title).

Criterion 2 ("`View details – ` no longer appears anywhere in
`CalendarPage.tsx`") — confirmed by grep:

```
$ grep -n "View details" src/pages/calendar/CalendarPage.tsx
(no matches)
```

### Criterion 3 — truncation (measured, accepted-and-decided per coordinator directive)

Per the packet's own trap #3 and the coordinator's mid-task correction,
`labelLines={1}` was **not** proposed and no TypeScript cast was shipped.
Measured directly, with a synthetic long title
("An Extremely Long Synthetic Event Title Deliberately Constructed To
Exceed The Row Width At Both 1440px And 375px Viewports For T133 Truncation
Measurement") substituted for one event via the throwaway rig's own
`loadSessions` override:

| viewport | link `boundingClientRect().width` | row (`<li>`) width | link right edge vs row right edge | inner `Text` computed `overflow`/`white-space`/`text-overflow` |
|---|---|---|---|---|
| 1440px | 1098.08px | 1072px | link right = 1420.08, row right = 1386 → **overflows by ~34px** | `hidden` / `nowrap` / `ellipsis` |
| 375px | 1098.08px (unconstrained) | 327px | link right = 1130.08, row right = 351 → **overflows by ~779px** | `hidden` / `nowrap` / `ellipsis` |

Even though `Link`'s own `maxLines={1}` prop sets `overflow:hidden;
white-space:nowrap; text-overflow:ellipsis` on its inner `Text` (confirmed
by reading `Link.tsx`'s own prop-forwarding, and independently confirmed by
computed style above), the outer `<a>` is `inline-flex` with no
width/max-width constraint of its own, so the anchor (and its inner `Text`)
simply grows to full content width instead of being clipped at the row's
own width — no visual ellipsis is produced, matching the packet's own
already-measured finding ("the inline-flex anchor runs past the row ... with
no ellipsis"). This is now recorded as **accepted, decided project-wide
behavior**, not an open follow-up: absent truncation on a linked `ListItem`
title is accepted, and `labelLines={1}` (which would only produce a *clip*,
not an ellipsis, and requires a TS escape hatch not authorized) will not be
proposed or shipped.

Page-level scroll safety, confirmed with the same synthetic long title in
place:

```
1440px: { scrollWidth: 1440, innerWidth: 1440 }
375px:  { scrollWidth: 375,  innerWidth: 375 }
```

`document.documentElement.scrollWidth === innerWidth` holds at both widths
even with the overflowing row link present — the row-level overflow does
**not** produce page-level horizontal scroll (the anchor overflows its own
row box but is clipped/absorbed by ancestor layout, never the viewport).

## 2. UXC-01 — label the section (remedy (b), copying `OutreachList.tsx`)

```tsx
const headingId = useId();
...
<Heading level={2} id={headingId}>
  {selectedDayIso !== null
    ? `Sessions on ${formatWeekdayDate(selectedDayIso)}`
    : `Sessions in ${monthLabel(focusYear, focusMonth)}`}
</Heading>
...
<div role="group" aria-labelledby={headingId}>
  {visibleSessions.length === 0 ? (
    <EmptyState headingLevel={3} title="No sessions match this view" ... />
  ) : (
    <List hasDividers>
      {visibleSessions.map(...)}
    </List>
  )}
</div>
```

`List`'s `header` prop was removed. `Section` was not used (a plain
`<div role="group">`, matching `OutreachList.tsx`'s shipped
`StudentOutreachSection`/`CoachOutreachSection` pattern exactly).

### DOM evidence — accessible name in both reachable branches, mechanism used

Mechanism: a throwaway Playwright rig rendered the real `CalendarPage`
(inside the real `AppShell`) with three different injected `loadSessions`
implementations selecting each DES-12 branch, then read
`document.querySelector('[role="group"][aria-labelledby="<headingId>"]')`
and resolved `document.getElementById(<that id>).textContent`, the same
scoped-by-id technique `OutreachList.test.tsx:1520-1587`'s
`resolveAriaLabelledbyTarget` uses (needed because a full `AppShell` DOM
also contains `SideNav`'s own unrelated `role="group"`, labelled "Main" —
confirmed present in every capture below, and excluded by scoping on the
heading's own id rather than querying `[role="group"]` alone).

**Populated branch** (`visibleSessions.length > 0`):
```json
{
  "h1": "Calendar",
  "h2s": ["Sessions in July 2026"],
  "h3s": [],
  "groups": [
    { "ariaLabelledby": "_r_2_-title", "resolvedText": "Main" },
    { "ariaLabelledby": "_r_e_", "resolvedText": "Sessions in July 2026" }
  ]
}
```
`role="group"` scoped to the `Heading`'s own id resolves to the exact
visible heading text. `List` no longer carries `header`
(`ul[role="list"]`'s own `aria-labelledby` attribute is `null`, confirmed
directly).

**Inner no-match empty branch** (`hasAnySessions === true`,
`visibleSessions.length === 0`) — reached by injecting fixture sessions all
dated outside the current wall-clock month, so the outer branch still
renders (sessions exist) but the current month's own filtered list is
empty:
```json
{
  "h1": "Calendar",
  "h2s": ["Sessions in July 2026"],
  "h3s": ["No sessions match this view"],
  "groups": [
    { "ariaLabelledby": "_r_2_-title", "resolvedText": "Main" },
    { "ariaLabelledby": "_r_e_", "resolvedText": "Sessions in July 2026" }
  ]
}
```
The `role="group"` + `aria-labelledby` pair is present in the DOM in
**both** branches of the inner ternary (the wrapping `<div>` sits outside
the `visibleSessions.length === 0 ? <EmptyState/> : <List/>` conditional),
and resolves to the same live heading text in both.

**Outer zero-session branch** (`hasAnySessions === false`, the whole
Calendar/legend/filter/heading/list block is replaced):
```json
{
  "h1": "Calendar",
  "h2s": ["No sessions scheduled yet"],
  "h3s": [],
  "groups": [
    { "ariaLabelledby": "_r_2_-title", "resolvedText": "Main" }
  ]
}
```
No second `role="group"` exists here (only SideNav's own) — confirmed no
group is asserted/present in this branch, per the packet's own instruction.
`h1` "Calendar" and `h2` "No sessions scheduled yet" are both present, no
`h3`, matching the pre-existing (unchanged) `CalendarPage.test.tsx:504-515`
assertion, which still passes unmodified (see full suite run below).

## 3. UXC-06 — stop the full-bleed stretch

```tsx
return (
  <VStack hAlign="center">
    <VStack width="100%" maxWidth={1120} gap={6} padding={6}>
      ...
      <HStack hAlign="start">
        <SegmentedControl ...>...</SegmentedControl>
      </HStack>
      ...
    </VStack>
  </VStack>
);
```

Only documented props used (`hAlign`, `width`, `maxWidth`, `gap`,
`padding`) — no `style` prop anywhere in the diff.

### Measured content width at 1440px, before/after; SegmentedControl width

Same before/after methodology as criterion 1 (git-stashed the `.tsx` change
for the "before" measurement, then restored it).

**Before:**

| | value |
|---|---|
| Content column width (ancestor `<div>` of `<h1>Calendar</h1>`) | `1132px` (full available width inside `AppShell`'s content region — no cap) |
| `SegmentedControl` (`[role="radiogroup"]`) width | `1132px` (full-bleed, stretched to match its `VStack` parent) |
| `SegmentedControl` parent width | `1180px` |

**After:**

| | value |
|---|---|
| Capped ancestor `<div>` (inner `VStack`) computed `max-width` | `1120px` |
| Capped ancestor rendered width | `1120px` |
| Outer wrapper (`VStack hAlign="center"`) `display`/`align-items`/`flex-direction` | `flex` / `center` / `column` |
| Outer wrapper width | `1180px` |
| Left gap (outer wrapper left edge → capped content left edge) | `30px` |
| Right gap (capped content right edge → outer wrapper right edge) | `30px` |
| `SegmentedControl` width | `320px` (hugs its four options) |
| `SegmentedControl` parent (`HStack hAlign="start"`) width | `1072px` |

The equal 30px left/right gap confirms genuine centering (not just a
left-aligned cap), and the `SegmentedControl` no longer spans the full
content width. Visual confirmation in the 1440px captures below.

## 4. Legend (already-done, confirmed unchanged)

Confirmed present with the correct three `Badge`s (`variant="purple"`
label "Meeting", `variant="blue"` label "Outreach", `variant="orange"`
label "Competition") in both the populated and inner-empty branches (see
the `legendBadges` arrays in the DOM-evidence JSON above — 3 legend badges
present in both; the populated branch additionally shows 4 more row-level
type badges, for 7 total). Absent (correctly) in the outer zero-session
branch, since that whole block is replaced. No source lines in the legend
itself were touched.

## `document.documentElement.scrollWidth` vs `innerWidth` at 375px

Confirmed `scrollWidth === innerWidth` (no page-level horizontal scroll) at
375px across all three DES-12 branches reachable in this task's scope, and
also at 1440px:

```
populated    1440 { scrollWidth: 1440, innerWidth: 1440 }
populated     375 { scrollWidth: 375,  innerWidth: 375  }
inner-empty  1440 { scrollWidth: 1440, innerWidth: 1440 }
inner-empty   375 { scrollWidth: 375,  innerWidth: 375  }
outer-empty  1440 { scrollWidth: 1440, innerWidth: 1440 }
outer-empty   375 { scrollWidth: 375,  innerWidth: 375  }
```

Also confirmed with the synthetic long-title row present (criterion 3
above) — still holds at both widths.

## Exact test lines amended (before/after)

File: `src/pages/calendar/CalendarPage.test.tsx`, the second `it` block in
the `describe('row Link text is distinguishable per session ...')` block
(originally `:479-490`).

**Before:**
```tsx
it('every rendered row link still communicates "View details" alongside its distinguishing title', async () => {
  renderPage();
  await flushMicrotasks();

  const links = Array.from(container.querySelectorAll('a')).filter((a) =>
    (a.getAttribute('href') ?? '').match(/^\/(meetings|outreach)\//),
  );
  expect(links.length).toBeGreaterThanOrEqual(4);
  for (const link of links) {
    expect(link.textContent).toContain('View details');
  }
});
```

**After:**
```tsx
it('every rendered row link IS the event title itself (T133/UXC-04: the title became the link), never a separate "View details" label', async () => {
  renderPage();
  await flushMicrotasks();

  const { events, sessions } = await defaultLoadCalendarSessions();
  const eventById = new Map(events.map((event) => [event.id, event] as const));

  const links = Array.from(container.querySelectorAll('a')).filter((a) =>
    (a.getAttribute('href') ?? '').match(/^\/(meetings|outreach)\//),
  );
  expect(links.length).toBeGreaterThanOrEqual(4);
  for (const link of links) {
    const href = link.getAttribute('href') ?? '';
    const expectedTitle = href.startsWith('/meetings/')
      ? eventById.get(
          sessions.find((s) => s.id === href.replace('/meetings/', ''))?.eventId ?? '',
        )?.title
      : eventById.get(href.replace('/outreach/', ''))?.title;
    expect(expectedTitle).toBeTruthy();
    expect(link.textContent).toBe(expectedTitle);
    expect(link.textContent).not.toContain('View details');
  }
});
```

The href/count assertions (`links.length >= 4`, the `/^\/(meetings|outreach)\//`
filter) are unchanged. The neighboring `it` block at (now) `:454-477`
(`not.toBe('View details')` assertions) was **not** touched.

No other test in the file was added, removed, or modified.

## Paths of the four captures

- `docs/swarm/figures/ux-craft/T133-calendar-1440-light.webp`
- `docs/swarm/figures/ux-craft/T133-calendar-1440-dark.webp`
- `docs/swarm/figures/ux-craft/T133-calendar-375-light.webp`
- `docs/swarm/figures/ux-craft/T133-calendar-375-dark.webp`

All four are of the populated branch (the branch that exercises all three
fixes at once: linked titles, labelled group, capped/centered content with
a hugging `SegmentedControl`). Captured via Playwright/Chromium as PNG
(`page.screenshot({ type: 'png', fullPage: true })` — Playwright does not
support a `webp` screenshot type directly) then converted to `.webp` with
Pillow (`Image.save(..., 'WEBP', quality=90)`), matching every other figure
in that directory being `.webp`.

## Full output of the commands in criteria 9-10

### `npx tsc --noEmit`
No output (clean, exit 0).

### `npx eslint .`
```
✖ 352 problems (0 errors, 352 warnings)
  0 errors and 1 warning potentially fixable with the `--fix` option.
```
All 352 are pre-existing `react-refresh/only-export-components` warnings in
files unrelated to this task (confirmed by re-running
`npx eslint src/pages/calendar/CalendarPage.tsx src/pages/calendar/CalendarPage.test.tsx`
directly: 8 warnings, same rule, same pre-existing pattern this file
already had before this task — every named-export-alongside-component
warning at the module's own pure-function exports, none introduced by this
diff). Zero errors.

### `npx vite build`
```
✓ built in 5.48s
```
(One pre-existing "chunk larger than 500kB" advisory on the app's main
bundle, unrelated to this task and present before this task's changes.)

### `npm run format:check`
```
Checking formatting...
All matched files use Prettier code style!
```

### `npx vitest run`
```
 Test Files  61 passed (61)
      Tests  1414 passed (1414)
```
Matches the packet's stated baseline exactly (1414 tests / 61 files). The
only delta from the pre-task suite is the amended assertion body inside the
one `it` block documented above — no test was added or removed, so the
count is identical to baseline.

## Anything unverified, stated plainly as unverified

- The `Link`'s hover `color-mix` tint reaching (or not reaching) the glyphs
  was **not independently re-verified** — the packet marks this a known,
  disclosed, out-of-scope vendor limitation (trap #4), and per that same
  trap this was not investigated further or reported as a defect.
- No visual regression testing was done against the *legend*, *filter*, or
  *calendar grid* pixel-for-pixel beyond the four full-page captures and the
  before/after numeric measurements above — a human/checker review of the
  four `.webp` captures is the intended verification path for anything not
  captured by a specific number in this document.
- The `EmptyState` inside the inner no-match branch was reached via an
  injected `loadSessions` override (sessions present, but all dated far
  outside the current wall-clock month) rather than via simulated user
  interaction (e.g., clicking a filter with zero matches) — this is a valid
  way to reach that branch (`visibleSessions.length === 0` with
  `hasAnySessions === true`) but was not additionally cross-checked via a
  click-driven path in the throwaway rig. The existing, unmodified test
  suite (`CalendarPage.test.tsx`) already covers click-driven paths (filter
  clicks, day selection) for the populated branch and passes unchanged.
- Row-height parity (57px, before and after) was measured only for the
  July-2026 fixture's four visible rows at 1440px; row height at 375px was
  not separately numerically compared before/after (the 375px "after"
  capture shows rows wrapping to a taller height for two-line descriptions,
  which is pre-existing description-wrapping behavior unrelated to this
  task's `label` change — not separately re-measured against a "before"
  375px baseline).

## Commands run (chronological summary)

```
git fetch origin
git merge origin/claude/swarm-plan-zl575z
npx tsc --noEmit
npx eslint .
npx vitest run src/pages/calendar/CalendarPage.test.tsx
npx vitest run
npx vite build
npx prettier --write src/pages/calendar/CalendarPage.tsx src/pages/calendar/CalendarPage.test.tsx
npm run format:check
# throwaway measurement rig (created, used, then deleted):
#   preview.throwaway.html, src/preview.throwaway.tsx
#   node <scratchpad>/t133_measure.mjs
#   node <scratchpad>/t133_measure_before.mjs   (git stash / git stash pop around this one)
#   node <scratchpad>/t133_measure_empty_states.mjs
#   node <scratchpad>/t133_measure_extra.mjs
#   node <scratchpad>/t133_measure_truncation.mjs
#   node <scratchpad>/t133_capture.mjs  (PNG capture, converted to .webp via Pillow)
rm preview.throwaway.html src/preview.throwaway.tsx
# final re-verification after rig deletion:
npx tsc --noEmit
npx eslint .
npx vite build
npm run format:check
npx vitest run
```

## Known risks

- `HStack` is still imported and used elsewhere in the file (legend,
  top-bar, loading skeleton); its import was not removed and no unused-import
  lint error was produced (confirmed via the clean `eslint`/`tsc` runs
  above).
- The `<div role="group">` wrapper adds one extra DOM node around the
  `List`/`EmptyState` pair; this is the same shape already shipped and
  passing in `OutreachList.tsx`, so no new layout regression is expected,
  but it was only visually spot-checked via the four captures, not exhaustively
  diffed pixel-by-pixel against the pre-change layout.
- The truncation gap documented in criterion 3 (long titles are not
  visually truncated, though page-level scroll remains safe) is now
  explicitly accepted-and-decided per the coordinator's mid-task
  instruction, not something this task attempted to fix.

## Dispute

Not filing a dispute. The packet's citations and prescribed JSX were
verified against the installed source/live measurements as described above
and matched the packet's own claims (with the one clarification noted in
criterion 3, where the specific computed-style values differed slightly
from the packet's own description but the net behavioral conclusion —
no visual truncation, page-level scroll unaffected — matched exactly).
