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
title text (`astryx-api.md:1952`, `:1954`).

**Pre-authorized deviations (do not dispute):** `ListItem.label` accepts
`ReactNode` (`src/List/ListItem.tsx:50`, `dist/List/ListItem.d.ts:29`) —
`astryx-api.md:4590` documents ListItem's props as literally `undefined`, so
every ListItem prop in this file is already an installed-source deviation.
`Link`'s `weight`/`maxLines`/`color` are absent from the `# Link` props table
(`astryx-api.md:1961-1977`) but verified real at the lines above. D004
precedent; T131 shipped both and Passed.

### 2. UXC-01 — one heading per section

`:812-817` renders `<Heading level={2}>Sessions in {month}</Heading>`, and
`:829` renders `<List hasDividers header="Chronological session list">`. That
is two headings for one section.

**Drop the `List`'s `header` prop.** Keep the `Heading` — it carries the
meaningful, state-dependent text ("Sessions on Tuesday, July 14" vs "Sessions
in July").

This is safe here, and you must state why in your output, because the general
rule cuts the other way: T129 established that `List header` renders **only in
the non-empty branch**, so dropping it can strip a section's accessible name in
the empty state. On this page the empty branch is a separate `EmptyState` with
its own `title` (`:823-827`) and the `Heading` at `:812` renders
unconditionally either way — so nothing loses its name. Verify that claim in the
DOM rather than trusting this packet.

### 3. UXC-06 — stop the full-bleed stretch

Two things stretch edge-to-edge on a wide viewport: the filter
`SegmentedControl` (`:800-807`) and the month `Calendar`'s day tracks.

Cap the page content at **~1120px** and centre it, per UXC-06. The
`SegmentedControl` should size to its four options rather than filling the row.

Escalation ladder is component → theme token → custom CSS (PRD v3.1 F-2;
`xstyle` does not work in this app — no StyleX plugin, `stylex.create()` throws
at runtime). `style` is not documented on these components but is verified to be
merged in installed source and shipped by T130/T131 — authorized here on the
same D004 basis. Prefer a container-level cap over per-component width props.

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
5. Do not certify your own work.

## Acceptance Criteria

1. Every session row's event title is a real `<a>` pointing at the correct
   per-type route, with **no** `aria-label`, accessible name equal to the title.
2. `View details – ` no longer appears anywhere in `CalendarPage.tsx`.
3. Rendered title weight, size, colour and truncation measured; row height
   unchanged from before.
4. Exactly one `<h2>`-level name for the session-list section. Prove in the DOM
   that the section still has an accessible name in **both** the populated and
   empty states.
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
  presumed hallucinated → MAJOR. **Three exceptions pre-authorized above**
  (ListItem props, Link typography props, `style`), all under D004. No others.
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
