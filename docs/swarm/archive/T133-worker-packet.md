# Worker Packet: T133 — Calendar page craft pass (UXC-04 / UXC-01 / UXC-06)

Wave 5, packet W5-P3b. Runs in parallel with T132 and T134 in a separate
worktree; their files are forbidden here and yours are forbidden there.

## Objective

Three narrow fixes on `src/pages/calendar/CalendarPage.tsx`. **This is not a
`Table` migration** — the PRD scopes this screen to "UXC-04/01/06 only"
(`VOLT_UX_Craft_PRD_v3.md`, per-screen findings). Leave the `List` alone.

### 1. UXC-04 — the title becomes the link

`CalendarSessionRowItem` (`:614-640`) renders `<ListItem label={event.title}>`
with a separate `View details – {event.title}` `Link` in `endContent`
(`:633-635`). T131 replaced exactly this shape on the coach outreach rows.
Apply the same resolution: delete the `Link` from `endContent`, and pass the
title as a link through `ListItem`'s `label`.

```tsx
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
```

Keep `detailHrefFor` (`:599-608`) exactly as it is — this page's rows point at
two different routes (`/meetings/:sessionId` for meetings,
`routePaths.outreachEvent(event.id)` for outreach), and that per-row branch is
load-bearing. The type `Badge` stays in `endContent`.

**Ship exactly that shape.** Do **not** nest a `<Text>` inside the `Link`:
`Link` already wraps its children in its own `Text`
(`node_modules/@astryxdesign/core/src/Link/Link.tsx:323-331`) and forwards
`type`/`size`/`weight`/`color`/`display`/`maxLines` (`:227-257`). Nesting puts a
`display:block; overflow:hidden` child inside an `inline-flex` `<a>` and
truncation silently stops. `color="primary"` is required — `LinkProps.color`
defaults to `'accent'` (`Link.tsx:297`).

No `label`/`aria-label`/`tooltip` on the link; its accessible name must be the
title text (`astryx-api.md:1952`; the no-`aria-label`-on-text-links rule is
`:1955`, and `:1954` is the separate no-generic-text rule).

**Pre-authorized deviations (do not dispute):** `ListItem.label` accepts
`ReactNode` (`src/List/ListItem.tsx:50`, `dist/List/ListItem.d.ts:29`) —
`astryx-api.md:4590` documents ListItem's props as literally `undefined`, so
every ListItem prop in this file is already an installed-source deviation.
`Link`'s `weight`/`maxLines`/`color` are absent from the `# Link` props table
(`astryx-api.md:1963-1977`) but verified real at the lines above. D004
precedent; T131 shipped both and Passed.

### 2. UXC-01 — label the section the way T129 already proved

**Revision 2 replaces this section entirely.** Revision 1 told you to drop the
`List`'s `header` and keep the `Heading`. That is wrong, and it is wrong in a
way this project has already paid for once.

`VOLT_UX_Craft_PRD_v3.md:76` authorizes exactly three fixes for UXC-01:
**(a)** keep `List header`, drop the outer `Heading`; **(b)** wrap in a labelled
region; **(c)** migrate to `Table`. "Drop `header`, keep `Heading`" is the
reverse of (a) and is none of the three. Constitution item 1: PRD requirement
IDs outrank packet text.

Why it fails mechanically: `List.tsx:169` sets
`aria-labelledby={header != null ? headerId : undefined}` on the
`<ul role="list">`. The `header` prop is the list's **only** programmatic
accessible name. And you cannot re-label it — `List`'s signature
(`List.tsx:143-155`) destructures a closed prop set with no rest spread, so
`aria-label`/`aria-labelledby` passed to `List` are silently discarded.
`astryx-api.md:4568` says the opposite of revision 1: "**Do:** Provide a header
to label the list."

`task-ledger.md:150` records **T129 failing attempt 1 on exactly this** —
"removing the `List header` *lost* the accessible name rather than relocating
it". Attempt 2 shipped `<div role="group">` at all 11 sites.

**Ship remedy (b), copying T129's pattern:**

1. Give the `Heading` at `:812-816` a stable `useId`-derived id. Keep its text —
   it carries the meaningful state-dependent copy ("Sessions on Tuesday, July
   14" vs "Sessions in July").
2. Wrap the `List`/`EmptyState` ternary (`:822-834`) in
   `<div role="group" aria-labelledby={headingId}>`.
3. **Then** drop the `List`'s `header` prop.

Use `<div role="group">`, **not** `Section` — `Section` applies an unconditional
full-bleed negative margin and renders a role-less `<div>`, on which
`aria-labelledby` is name-prohibited under ARIA. T129 hit both. The in-repo
pattern and its green tests are `OutreachList.tsx` (student sections) and
`OutreachList.test.tsx:1520-1587`, which includes an empty-branch case. Copy it;
do not re-derive it.

**Correcting a false premise from revision 1.** It claimed the `Heading` at
`:812` "renders unconditionally". It does not — it sits **inside** the
`!hasAnySessions` ternary opened at `:775` and closed at `:837`. When the season
has zero sessions, the whole block (Calendar, legend, filter, heading, list) is
replaced by a *different* `EmptyState` at `:776-780`, which carries its own
`headingLevel={2}` title. So there are **two** empty states on this page, not
one: the outer zero-session branch (`:776`) and the inner no-match branch
(`:823`). Your accessible-name proof must cover both.

Also drop revision 1's "two headings" framing: `List` renders `header` in a
plain `<div id={headerId}>` (`List.tsx:197`), not a heading element. There is
exactly one `<h2>` on the page today. The defect is a *duplicated label*, not a
duplicated heading level.

### 3. UXC-06 — stop the full-bleed stretch

Two things stretch edge-to-edge on a wide viewport: the filter
`SegmentedControl` (`:800-808`) and the month `Calendar`'s day tracks.

Cap the page content at **~1120px** and centre it, per UXC-06. The
`SegmentedControl` should size to its four options rather than filling the row.

**Both are rung-1 component props — no escalation, no `style`.** Revision 1
pre-authorized `style` under D004; that was an unnecessary escalation past a
documented prop, and constitution item 11 forbids it.

- **`maxWidth` caps but does NOT centre.** `Stack.tsx:265-278` emits only
  `width`/`height`/`maxWidth`/`minHeight` — there is no `marginInline: 'auto'`
  anywhere in `Stack/` or `Center/`, and `CalendarPage`'s root `VStack` is a
  block-level child of `LayoutContent`, so a `max-width` box with no auto margin
  stays **left-aligned**. Ship the two-layer shape:

  ```tsx
  <VStack hAlign="center">                          {/* astryx-api.md:389 — cross axis */}
    <VStack width="100%" maxWidth={1120} gap={6} padding={6}>
  ```

  `width="100%"` (`astryx-api.md:385`) is load-bearing: under
  `align-items: center` the child's cross size is content-based, so without it
  the content shrinks to fit-content instead of filling up to the 1120 cap.
  `maxWidth` is documented at `astryx-api.md:363`/`:387` (Stack/VStack) and
  `:83` (Center).
- The `SegmentedControl` is not the thing that is wrong — its own root is
  already `inline-flex`/hug (`SegmentedControl.tsx:89-95`). It is being
  **stretched** by the parent `VStack`'s default `vAlign="stretch"`. Wrap it in
  `<HStack hAlign="start">` (documented) and the stretch stops.

Only if measurement shows these insufficient may you escalate, and then you must
say what you measured. `xstyle` remains unusable (PRD v3.1 F-2 — no StyleX
plugin, `stylex.create()` throws).

## Already done — do NOT redo

The legend for the vendor-blocked day dots **already exists** at `:792-798`
(three real `Badge`s: purple/Meeting, blue/Outreach, orange/Competition), with
the full resolution recorded in module doc #1. The PRD lists "legend/list
workaround" under this screen, but it shipped with the original task. Confirm it
is present and correct; do not rebuild it.

Likewise `Calendar` genuinely has no day-content or dots render prop — module
doc #1 records ~1023 lines of installed source read to establish that. Do not
re-litigate it or try to eject the component.

## Allowed Files

- `src/pages/calendar/CalendarPage.tsx`
- `src/pages/calendar/CalendarPage.test.tsx`
- `docs/swarm/active/T133-worker-output.md` (create)
- New figures under `docs/swarm/figures/ux-craft/` (`.webp`, see criteria)

## Forbidden Files

- `src/pages/outreach/**` and `src/pages/meetings/**` — **T132 and T134 are
  running concurrently.** Touching their files creates a merge conflict.
- `docs/swarm/astryx-api.md` — T132 is editing the `# Link` props table.
- `docs/swarm/constitution.md`, `task-ledger.md`, `verification-log.md`,
  `dispute-log.md`, `.claude/**`, `supabase/migrations/**`.

## Traps

1. **Two test assertions block this, in two different `it` blocks.**
   `CalendarPage.test.tsx:475-476` asserts each link's `textContent` is
   `not.toBe('View details')` — that still passes after your change (the text
   becomes the title) and should be left alone. The `it` block at `:479-490`
   asserts every row link's `textContent` **contains** `'View details'` — that
   is the one that must change, to assert the title instead. Amend it; do not
   delete it, and do not weaken the surrounding href/count assertions.
2. **Two routes, not one.** Rows link to `/meetings/:sessionId` *or*
   `/outreach/:eventId`. The test at `:483-485` filters on that regex. Keep both
   branches working and both asserted.
3. **`ListItem.label` is not a `Table` cell.** T131 wrapped a `Text` inside a
   cell; you are replacing a `label` value. Verify the rendered result — weight,
   size, colour, truncation, row height — rather than assuming parity.
4. **Hover tint is inert on these links.** `Link` hands its inner `Text` a
   non-inheriting colour, so the hover `color-mix` never reaches the glyphs.
   Known, vendor-side, out of scope. The hover underline and focus ring are the
   live affordances. Do not report it as a defect or try to fix it.
5. **`CalendarPage.test.tsx:287-291` forbids any hex literal in `innerHTML`**
   (`expect(container.innerHTML).not.toMatch(/#[0-9a-fA-F]{3,6}/)`). Any hex you
   introduce in the UXC-06 work fails it. Use tokens and documented props.
6. Do not certify your own work.

## Acceptance Criteria

1. Every session row's event title is a real `<a>` pointing at the correct
   per-type route, with **no** `aria-label`, accessible name equal to the title.
2. `View details – ` no longer appears anywhere in `CalendarPage.tsx`.
3. Rendered title weight, size and colour measured and unchanged. **Row height
   within 2px of before** — swapping a bare text node for a baseline-aligned
   `inline-flex` anchor can shift the pitch slightly; report the measurement
   rather than working around it.

   **Truncation: `maxLines={1}` is inert in the `ListItem` label slot.**
   `Item.tsx:353-360` applies its single-line truncate style only when the label
   is a *string*; a `ReactNode` label gets none, and `ListItem` does not expose
   `labelLines`. Measured in real Chromium with a synthetic long title: the label
   span computes `overflow:visible; white-space:normal; text-overflow:clip` and
   the `inline-flex` anchor runs past the row at both 1440px and 375px with no
   ellipsis — a regression against today's string label, which does truncate.
   **Do not attempt to prove an ellipsis.** Report the measured behaviour,
   confirm `document.documentElement.scrollWidth === innerWidth` still holds at
   both widths (measured safe — page-level scroll is what actually matters), and
   record the lost truncation as a carried follow-up.

   You may **propose** `labelLines={1}` — it reaches `Item` via `ListItem`'s
   `restProps` spread (`ListItem.tsx:211,255`) and restores `overflow:hidden;
   nowrap`, bounding the paint inside the row — but it is absent from
   `ListItemProps` (needs a TS escape, not authorized here) and clips rather than
   ellipsizes, since `text-overflow` cannot act on an atomic `inline-flex` box.
   Propose it with measurements; do not ship it unasked.
4. The `<div role="group">`'s `aria-labelledby` resolves to the visible `<h2>`,
   **scoped by the heading id** — a full `AppShell` DOM also contains SideNav's
   own `role="group"`, which a bare `querySelector('[role="group"]')` finds
   first. `OutreachList.test.tsx:1520-1587` already scopes by id; copy that.
   asserted in the **two branches where the group renders**: populated, and the
   inner no-match empty state (`:823`). Mirror
   `OutreachList.test.tsx:1520-1587`. The `List` must no longer carry `header`.

   For the **outer zero-session branch** (`:776`) the group does not exist at
   all — the whole block is replaced. Assert there that the session-list section
   is absent and the page still carries its own `<h2>` ("No sessions scheduled
   yet"), which `CalendarPage.test.tsx:504-515` already pins and which must keep
   passing unchanged. Do not assert a group there; there isn't one.
5. At 1440px: content capped at ~1120px and centred; the `SegmentedControl` no
   longer spans the full width. Report the measured content width.
6. At 375px: no page-level horizontal scroll
   (`document.documentElement.scrollWidth === innerWidth`).
7. The legend at `:792-798` is present and unchanged.
8. **Captures at 1440px and 375px, in both light and dark themes** (UXC-13/14),
   saved as `.webp` under `docs/swarm/figures/ux-craft/` — every other figure
   there is `.webp`.
9. `npx tsc --noEmit`, `npx eslint .`, `npx vite build`,
   `npm run format:check` clean.
10. `npx vitest run` green. Baseline **1414 / 61 files**. The only permitted
    delta is the amended assertion in the `:479-490` block. Anything else is a
    regression — report it, don't silence it.

## Relevant Constitution Excerpt

- Item 2 — Astryx props come only from `astryx-api.md`; absent props are
  presumed hallucinated → MAJOR. **Two exceptions pre-authorized above**
  (ListItem props, Link typography props), both under D004. No others — `style`
  is explicitly NOT authorized here; §3 uses documented props.
- Item 11 — DES-21 styling escalation; ejecting component source needs boss
  approval.
- Item 12 — every async screen ships all four states. Your UXC-01 change touches
  the empty branch's naming; do not regress it.
- Non-Negotiables — existing tests pass; no worker self-certifies.

## Required Worker Output

`docs/swarm/active/T133-worker-output.md`:

- Measured title-link typography and row height, before and after.
- DOM evidence that the section keeps an accessible name in both populated and
  empty states, with the mechanism you used to check.
- Measured content width at 1440px, before and after, and the
  `SegmentedControl`'s width.
- `document.documentElement.scrollWidth` vs `innerWidth` at 375px.
- The exact test lines amended, before/after.
- Paths of the four captures.
- Full output of the commands in criteria 9–10.
- Anything unverified, stated plainly as unverified.

Use a throwaway rig for measurements (`*.throwaway.*` is gitignored; Chromium at
`/opt/pw-browsers/chromium-1194/chrome-linux/chrome`; `LoginAs` from
`src/test-utils/authHarness.tsx:131`). **Delete it before finishing** — the
captures are the artifact that survives, not the rig.
