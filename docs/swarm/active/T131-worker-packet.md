# Worker Packet: T131 — compact icon-pair row actions (coach outreach Table)

**Revision 2** (2026-07-28), after `checker-premise` returned REVISE on
revision 1 with 1 BLOCKER and 5 MAJORs. Every line citation below was
re-verified against the files; revision 1's were wrong in eight places.
Round 1 of the 2 permitted by constitution item 19a.

## Task ID

T131 (wave 5, packet W5-P2b). Follows T130 (Passed, attempt 2). Blocks T132.

## Objective

Resolve the MINOR that T130 carried forward: the coach outreach `Table`'s
actions column is `pixel(420)`, and the code says exactly why
(`src/pages/outreach/OutreachList.tsx:2549-2563`) — the widest real fixture
needs **378px of content, of which 262px is the text of one link**
("View details – Community Food Bank Sort"). That column forces the fixed
columns to 950px which, with the title column's 224px minimum, sums to 1174px
against the `Table`'s real measured available width of **1132px** at 1440px
(recorded at `:2481-2483` and `:2498`). The result is ~42px of table-internal
horizontal scroll with text clipped mid-word.

Replace the row's action cluster with the reference app's compact pattern and
give the reclaimed width back to the title column.

**Read `docs/swarm/figures/ux-craft/old-events-tab.webp` before you start.**
Each row there ends with a small `EDIT` text chip and a destructive `×`,
roughly 100px total, and has no "View details" affordance.

*Disclosed departure from the figure:* in the reference app the title is plain
text and there is **no** row→detail keyboard path at all. We are not copying
that. The title becomes a link (see §1). The figure governs the **action
cluster's** shape only.

## The change

### 1. The link moves onto the title — it is not deleted

You may **not** simply delete the "View details" link. It is the only keyboard
path from the coach list to `/outreach/:eventId` (`routePaths.outreachEvent`
appears in JSX exactly twice in this file: `:2329` coach, `:3185`
student/parent), and removing it re-opens the dead-end-rows regression T112 was
written to fix.

`CoachEventTitleCell` (`OutreachList.tsx:2185-2197`) renders the title as a real
`Link`. **Ship exactly this shape** — the arrangement is decided here, not left
to you:

```tsx
<Link
  as={RouterLink}
  href={routePaths.outreachEvent(event.id)}
  isStandalone
  weight="semibold"
  maxLines={1}
  color="primary"
>
  {event.title}
</Link>
```

**Do not nest a `<Text>` inside the `Link`.** `Link` already wraps its children
in its own `Text` and forwards typography props to it — installed source
`node_modules/@astryxdesign/core/src/Link/Link.tsx:319-329` renders
`<Text type size weight color display maxLines>{children}</Text>`, with those
props declared on `LinkProps` at `:227-258`. A nested `Text maxLines={1}`
resolves to `display:'block'` + `overflow:hidden` inside Link's `inline` Text
inside an `inline-flex` `<a>` with no `min-width:0` on children
(`Link.tsx:53-55`), which silently stops truncating and overflows the cell.

`color="primary"` is deliberate: `LinkProps.color` **defaults to `'accent'`**
(`Link.tsx:297`), which would turn every event title purple — a visual change
nobody asked for, and one the reference figure contradicts. `primary` keeps the
title rendering identical to today. The link still has a non-color affordance:
`Link.tsx:60-62` sets `textDecoration: { default: 'none', ':hover': … }`, so it
underlines on hover. Verify the focus ring is visible.

**Pre-authorized deviation (do not dispute, do not "fix"):** `weight`,
`maxLines`, and `color` are **absent** from the `# Link` props table
(`astryx-api.md:1958-1977`), which lists only `as`/`label`/`href`/
`hasUnderline`/`isDisabled`/`isExternalLink`/`newTabLabel`/`target`/`rel`/
`onClick`/`tooltip`/`isStandalone`/`children`. Constitution item 2 would
normally make an undocumented prop a MAJOR. They are verified real in installed
source at the two line ranges above, and this is the D004 situation exactly —
installed source governs where `astryx-api.md` is silent or wrong. Authorized
for T131 on that basis. Follow-up banked to annotate the api doc.

**No `label`, `aria-label`, or `tooltip` on the title link.** Its accessible
name must be the title text itself:

- `astryx-api.md:1952` — "Only set `label` when the link content is not
  descriptive text… For text links, the visible text is already the accessible
  name; adding `label` overrides it for screen readers, which is harmful."
- `astryx-api.md:1954` — "Don't use generic text like 'click here' or
  'read more'; describe the destination."

The event title is descriptive and per-row distinguishing, so it satisfies both.
A bare "Details" link would violate the second — that is why the superseded
exemption pinned the long text.

`CoachEventTitleCell` has exactly two call sites, `:2398` (narrow card column)
and `:2504` (desktop title column), so one edit covers both viewports.

### 2. Actions become `Edit` + `×`

Rewrite `CoachEventActions` — JSDoc `:2293-2296`, function `:2297-2334`. **The
JSDoc is itself stale and must be rewritten, not preserved.**

- **Edit** — unchanged: `Button`, `size="sm"`, `variant="secondary"`, visible
  text `Edit`, `label={`Edit – ${row.event.title}`}`.
- **Cancel** — becomes an `IconButton`, `icon={<Icon icon="close" size="sm" />}`,
  `variant="destructive"`, `size="sm"`, and **`label={`Cancel – ${row.event.title}`}`
  verbatim** (see Trap 3 — three green tests depend on that exact string).
  Add a `tooltip`. Keep the existing `canCancel` gate exactly as-is.
- **Delete** the `<Link …>View details – {row.event.title}</Link>`.

`IconButton`'s `label` is **required** and becomes the `aria-label`
(`astryx-api.md:4267`); `astryx-api.md:4261` requires a `tooltip` ("label only
reaches screen readers, sighted users need the hover hint"). Astryx's
no-`label` rule governs **text links**, not icon buttons — do not remove it.
`icon="close"` is a documented semantic name (`astryx-api.md:585`, list at
`:610`).

Precedent for `IconButton` + `Icon` inside a `Table` `renderCell`:
`src/pages/roster/TeamsTab.tsx:950-966`. **Note its limits:** it uses
`variant="ghost"` and carries neither `tooltip` nor `style`, so it does not
license the two things you most need here — those are authorized separately
(tooltip by the api doc above, `style` by Trap 4).

### 3. Re-budget the column widths

Shrink the actions column from `pixel(420)`. Derivation of the floor:

```
Edit 48 (measured, :2556) + HStack gap 8 (gap={2}, :2307)
  + IconButton 44 (square: Button.tsx:101-106 sets aspectRatio 1/1 and zero
    paddingInline/Block for iconOnly, so the 44px minHeight becomes 44px wide)
  + cell paddingInline 16 (8 per side, compact: TableCell.tsx:70-75)
  = 116px
```

**Use `pixel(128)` or more, not `pixel(120)`.** `CoachEventActions`'s `HStack`
has `wrap="wrap"` (`:2307`), so a 4px margin is a wrap risk, and a wrap is what
pushed rows to 81px in T130. The slack is enormous — 1132 − 660 − 224 = 248px —
so there is no reason to shave it. Measure and report your final number.

Give the reclaimed width to the title column; leave expander (`pixel(120)`,
`:2443`), date (`pixel(150)`, `:2458`), hours (`pixel(102)`, `:2513`), and count
(`pixel(158)`, `:2529`) alone — those were measured in T130 and are not the
problem.

### 4. Rewrite every stale comment

A comment asserting behavior the code no longer has is part of the artifact and
fails the task. All of these are in the allowed file and all reference the
removed link or the superseded exemption:

| Lines | What is stale |
|---|---|
| `:251-254` | module doc #8c/d — "every row … carries a real 'View details' `Link`" |
| `:462-473` | module doc #13 — "same 'View details – <title>' text shape" |
| `:1946-1948` | "'View details – {title}' and Edit/Cancel are UNCHANGED" |
| `:2245-2252` | cites "`astryx-api.md`'s **FormField** Props table" for `style` — there is no `FormField` section; see Trap 4 |
| `:2293-2296` | `CoachEventActions` JSDoc — "UXC-04 (unchanged): Edit/Cancel/'View details'" |
| `:2463-2498` | title-column comment — the whole 1132/1174/42px trade-off narrative |
| `:2549-2563` | actions-column comment, incl. "the full, **UXC-04-exempt** 'View details – {title}' text" at `:2551` |

Where a comment records a *measurement* (the 220→224 `minWidth` derivation at
`:2463-2469`, the 1132px available width), keep the measurement and update the
conclusion. Do not delete the evidence trail.

## Allowed Files

- `src/pages/outreach/OutreachList.tsx`
- `src/pages/outreach/OutreachList.test.tsx`
- `docs/swarm/active/T131-worker-output.md` (your output; create it)

## Forbidden Files

- `src/pages/calendar/CalendarPage.tsx` (`:634` mirrors the same link text) and
  its test. **Deliberately out of scope** — T132 migrates the calendar session
  list to `Table` and changes both together. One task of inconsistency is
  expected, not a defect.
- The student/parent renderer in this same file: `endContent` `:3165-3189`,
  link `:3185-3187`, `return <ListItem …>` `:3191`. It uses `ListItem`, not the
  `Table`, and keeps its `View details – {event.title}` link this task.
- `docs/swarm/constitution.md`, `task-ledger.md`, `verification-log.md`,
  `dispute-log.md`, `.claude/**` (constitution: Authority Boundaries).
- Any `supabase/migrations/**`.

## Traps

1. **Exactly ONE assertion changes.** `OutreachList.test.tsx:1726`
   (`expect(foodBankLink!.textContent).toContain('View details')`) is in the
   **coach** test opened at `:1692`. That is the only one you amend — replace it
   with an assertion on the title. `:1759` is the identical-looking line in the
   **student/parent** test opened at `:1738`, on a surface you are not touching;
   it must keep passing unchanged. If you are editing `:1759`, you have changed
   the wrong component.
2. **Keep every other T112 assertion structurally intact.** Still a real
   `<a href="/outreach/:eventId">`, still exactly one per event
   (`foodBankLinks.length === 1`), still per-row distinguishable, and
   `event-team-meeting` still has no link. The three existing
   `toContain('<event title>')` assertions in the coach test already pass under
   the new design — do not touch them.
3. **`label={`Cancel – ${row.event.title}`}` verbatim.** Three currently-green
   tests depend on that exact string and will break on any rewording:
   - `:1302-1304` — `getAttribute('aria-label') === 'Cancel – Riverside Park Cleanup'`
     (**exact equality**), then dispatches a click on the result.
   - `:2179-2181` — filters buttons by `aria-label?.startsWith('Cancel – ')`.
   - `:2187-2189` — `expect(btn.style.minHeight).toBe('44px')` over the
     expander, Edit, and Cancel buttons.
   All three must keep passing unchanged. `:2187-2189` in particular means the
   `IconButton` must render an **inline** `min-height: 44px` on a real
   `<button>` element.
4. **`style` on Button/IconButton is an authorized undocumented deviation, not
   a documented prop.** Revision 1 of this packet claimed `astryx-api.md:1116`
   documents it — that line is the **Field** props table. `style` appears in
   exactly 7 props tables in that file (Field, Carousel, CodeBlock, Kbd,
   Markdown, Overlay, Thumbnail) and in **none** of `# Button`, `# IconButton`,
   `# Link`. It is verified to work in installed source: `Button.tsx:545`
   destructures `style`, `:652-657` merges it via `mergeProps`, which spreads
   the consumer `style` **after** the StyleX props (`mergeProps.ts:84-89`), and
   `IconButton.tsx:51` spreads `...props` into `Button`. T130 shipped it and
   Passed. Authorized for T131 on that basis (D004 precedent). Do not present it
   as documented; do not dispute it.
5. **44px touch targets** (UXC-13) on the expander, Edit, and the `×` —
   `MIN_TOUCH_TARGET_STYLE` (`:2253`) applies to the `IconButton` too. T130's
   attempt 1 failed for shipping 28px controls.
6. **≤72px collapsed rows** (UXC-07). The 420px column exists *because* a
   wrapped link pushed rows to 81px. Measure, don't assume.
7. `xstyle` does not work in this app (PRD v3.1 F-2, `VOLT_UX_Craft_PRD_v3.md:55`).
   The ladder is component → theme token → custom CSS.
8. Do not certify your own work. Report measurements; a checker decides.

## Acceptance Criteria

Checked against the running artifact, not your summary.

1. `old-events-tab.webp` was opened and the shipped action cluster matches its
   shape (short Edit chip + destructive `×`). **A 1440px screenshot of the
   shipped cluster is a required artifact** (see Required Worker Output).
2. The coach row's event title is a real `<a>` with `href` `/outreach/:eventId`,
   carrying **no** `aria-label`, accessible name equal to the event title.
3. The title's rendered **weight, size, color, and single-line truncation are
   unchanged from today** — colour included, since Link's default would have
   changed it. Prove each.
4. `View details – ` no longer appears anywhere in the coach `Table` surface. It
   still appears on the untouched student/parent rows.
5. The `×` has `aria-label` exactly `Cancel – {title}` and a tooltip.
6. **Measured in real Chromium at 1440px: the `Table`'s scroll wrapper has
   `scrollWidth <= clientWidth`.** Report both numbers, before and after. This
   is the whole point of the task; an unmeasured claim fails it.
7. **Measured: every collapsed coach row ≤72px**, both buckets.
8. **Measured: the expander, Edit, and the `×` are each ≥44px in their smaller
   dimension**, desktop and narrow. **The title text link is explicitly exempt**
   — it is a text link, not a button (WCAG 2.2 SC 2.5.8), and forcing a 44px
   line box on it would breach criterion 7. Do not enlarge it; do not report it
   as a failure.
9. At 375px: no page-level horizontal scroll
   (`document.documentElement.scrollWidth === innerWidth`); the narrow card
   column still renders the title link and the icon pair.
10. Upcoming and Past tables keep **byte-identical** column widths, and the
    existing `<th>` width assertion passes unchanged.
11. Every comment in the §4 table describes what the code actually ships.
12. `npx tsc --noEmit`, `npx eslint .`, `npx vite build`,
    `npm run format:check` all clean.
13. `npx vitest run` green. Baseline is **1414 passing across 61 files**
    (re-confirmed 2026-07-28). The only permitted delta is the **single**
    amended assertion at `:1726`. Any other test that changes count or content
    is a regression — report it, don't silence it.

## Relevant Constitution Excerpt

- Item 2 — Astryx props come only from `astryx-api.md`; an absent prop is
  presumed hallucinated → MAJOR. **Two named exceptions are pre-authorized
  above** (Link typography props, §1; `style` on Button/IconButton, Trap 4),
  both under D004's installed-source precedent. No others.
- Item 11 — DES-21 styling escalation; ejecting component source needs boss
  approval.
- Item 15 — accessibility is a shipping requirement; keyboard-path failures on
  core flows → BLOCKER. The title link *is* the keyboard path here.
- Non-Negotiables — existing tests must pass unless explicitly approved; no
  worker marks its own work complete.

## Authorization for the reversal

This reverses part of T112 (Passed) and supersedes the UXC-04 exemption.
**George authorized it on 2026-07-28**, recorded in the UXC-04 row of
`docs/swarm/VOLT_UX_Craft_PRD_v3.md` and the UXC-04 card of the `.html`,
committed in `b959b90` **before** this packet was dispatched. Cite that commit
if challenged. No other part of T112 is authorized to change.

*(Audit note: the superseded exemption carried the date 2026-07-28 in its own
text — it was added during the wave-5 planning pass, not on 2026-07-21 as
revision 1 of this packet stated.)*

## Required Worker Output

Write `docs/swarm/active/T131-worker-output.md` containing:

- The actions-column width you shipped and the measurement behind it.
- Scroll-wrapper `clientWidth` and `scrollWidth` at 1440px, before and after.
- Collapsed row heights, both buckets, before and after.
- Touch-target measurements for Edit, `×`, and the expander, desktop and narrow.
- Evidence the title's weight, size, **color**, and truncation are unchanged.
- A **1440px screenshot** of the shipped action cluster, saved under
  `docs/swarm/figures/ux-craft/`.
- The exact test line amended, with before/after text.
- Full output of the commands in criteria 12–13.
- Anything you could not verify, stated plainly as unverified.

Use a throwaway preview rig for the measurements (the pattern T129 and T130 both
used: `src/preview.throwaway.tsx` + `preview.throwaway.html`, `LoginAs` from
`src/test-utils/authHarness.tsx:131`, Chromium at
`/opt/pw-browsers/chromium-1194/chrome-linux/chrome`). `*.throwaway.*` is
gitignored. **Delete the rig before you finish** — the screenshot is the
artifact that survives, not the rig.
