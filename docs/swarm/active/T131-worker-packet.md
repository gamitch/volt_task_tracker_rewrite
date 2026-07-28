# Worker Packet: T131 — compact icon-pair row actions (coach outreach Table)

## Task ID

T131 (wave 5, packet W5-P2b). Follows T130 (Passed, attempt 2). Blocks T132.

## Objective

Resolve the MINOR that T130 carried forward: the coach outreach `Table`'s
actions column is `pixel(420)`, and the code says exactly why
(`src/pages/outreach/OutreachList.tsx:2549-2566`) — the widest real fixture
needs **378px of content, of which 262px is the text of one link**
("View details – Community Food Bank Sort"). That column forces the fixed
columns to 950px which, with the title column's 224px minimum, sums to 1174px
against the `Table`'s real measured available width of **1132px** at 1440px.
The result is ~42px of table-internal horizontal scroll with text clipped
mid-word.

Replace the row's action cluster with the reference app's compact pattern and
give the reclaimed width back to the title column.

**Read `docs/swarm/figures/ux-craft/old-events-tab.webp` before you start.**
It is the binding craft standard. Each row there ends with a small `EDIT` text
chip and a destructive `×`, roughly 100px total. The reference app has no
"View details" affordance at all.

## The change

### 1. The link moves onto the title — it is not deleted

You may **not** simply delete the "View details" link. It is the only keyboard
path from the list to `/outreach/:eventId`, and removing it re-opens the
dead-end-rows regression that T112 was written to fix.

Instead, `CoachEventTitleCell` (`OutreachList.tsx:2185-2198`) renders the event
title as a real `Link` to `routePaths.outreachEvent(event.id)`.

This is the *only* arrangement that satisfies both Astryx Link constraints
simultaneously, which is why the earlier exemption existed:

- `astryx-api.md:1953` — "Only set `label` when the link content is not
  descriptive text… For text links, the visible text is already the accessible
  name; adding `label` overrides it for screen readers, which is harmful."
- `astryx-api.md:1955` — "Don't use generic text like 'click here' or
  'read more'; describe the destination."

The event title is descriptive and per-row distinguishing, so it needs **no**
`label` and must not be given one. A bare "Details" link would violate the
second rule; that is why the 2026-07-21 exemption pinned the long text.

`CoachEventTitleCell` is shared by the desktop title column (`:2504`) and the
narrow (<768px) card column (`:2398`), so one change covers both viewports.

### 2. Actions become `Edit` + `×`

Rewrite `CoachEventActions` (`OutreachList.tsx:2296-2335`):

- **Edit** — keep the existing short `Button` (`size="sm"`,
  `variant="secondary"`, visible text `Edit`, `label={`Edit – ${title}`}`).
  Unchanged.
- **Cancel** — becomes an `IconButton` with `icon={<Icon icon="close" size="sm" />}`,
  `variant="destructive"`, `size="sm"`. Keep the existing `canCancel` gate
  exactly as-is.
- **Delete** the `<Link …>View details – {row.event.title}</Link>` from this
  component.

`IconButton` is icon-only, so per `astryx-api.md:4267` its `label` is
**required** and becomes the `aria-label`. Astryx's no-`label` rule governs
**text links**, not icon buttons — do not "fix" this by removing the label.
`astryx-api.md:4260` also requires a `tooltip` on icon buttons ("label only
reaches screen readers, sighted users need the hover hint"); set it.

In-repo precedent for `IconButton` + `Icon` inside a `Table` `renderCell`:
`src/pages/roster/TeamsTab.tsx:950-966`. `icon="close"` is the documented
semantic name (`astryx-api.md:585`).

### 3. Re-budget the column widths

Shrink the actions column from `pixel(420)` to the smallest value that fits
`Edit` + `×` + gap + real cell padding at a 44px touch target — expected around
`pixel(120)`. **Measure it; do not copy that number on faith.**

Give the reclaimed width to the title column. Target budget:

| | before | after (expected) |
|---|---|---|
| actions | 420 | ~120 |
| fixed total (expander 120 · date 150 · hours 102 · count 158 · actions) | 950 | ~650 |
| + title `minWidth` 224 | 1174 | ~874 |
| vs measured 1132 available @1440 | **~42px overflow** | comfortably inside |

Leave the expander, date, hours, and count columns alone — their widths were
measured in T130 and are not the problem.

Then **rewrite the two long comment blocks that justify the old numbers**
(`:2470-2500` on the title column, `:2549-2566` on the actions column). They
currently document a trade-off that no longer exists. A stale comment asserting
a 42px scroll that the code no longer produces is a MAJOR — the comment is part
of the artifact.

## Allowed Files

- `src/pages/outreach/OutreachList.tsx`
- `src/pages/outreach/OutreachList.test.tsx`
- `docs/swarm/active/T131-worker-output.md` (your output; create it)

## Forbidden Files

- `src/pages/calendar/CalendarPage.tsx` and its test — `:634` mirrors the same
  link text. **Deliberately out of scope.** T132 migrates the calendar session
  list to `Table` and changes both together. Leaving the calendar inconsistent
  for one task is expected, not a defect.
- The student/parent renderer in this same file (`OutreachList.tsx:3160-3190`).
  It uses `ListItem`, not the `Table`, and keeps its
  `View details – {event.title}` link this task. Do not touch it. See "Traps".
- `docs/swarm/constitution.md`, `task-ledger.md`, `verification-log.md`,
  `dispute-log.md`, `.claude/**` (constitution: Authority Boundaries).
- Any `supabase/migrations/**`.

## Traps

1. **Only ONE of the two T112 assertions changes.** `OutreachList.test.tsx:1726`
   is inside the **coach** test and asserts the link text contains
   `'View details'` — that one is amended. `:1759` is inside the
   **student/parent** test, whose surface you are not touching — it must keep
   passing unchanged. If you find yourself editing `:1759`, you have changed the
   wrong component.
2. **Keep every other T112 assertion.** The link must still be a real
   `<a href="/outreach/:eventId">`, still exactly one per event
   (`foodBankLinks.length === 1`), still per-row distinguishable, and the
   filtered-out `event-team-meeting` must still have no link at all. Amend the
   two `toContain('View details')` lines in the coach test to assert the title
   instead; leave the structure of the test intact.
3. **44px touch targets are non-negotiable** (UXC-13). `MIN_TOUCH_TARGET_STYLE`
   (`:2253`) must apply to the `IconButton` too. T130's attempt 1 failed for
   shipping 28px controls — do not repeat it.
4. **≤72px collapsed rows** (UXC-07). The 420px column exists *because* a
   wrapped link pushed rows to 81px. Shrinking the column could re-wrap
   something. Measure, don't assume.
5. **`Text` inside `Link`.** `Link`'s `children` is `ReactNode`
   (`astryx-api.md:1977`), so wrapping the existing
   `<Text type="body" weight="semibold" maxLines={1}>` is permitted by the API —
   but `Link` applies its own typography, and the two may fight. Either
   arrangement is acceptable as long as you **prove by measurement** that the
   title's rendered weight, size, and single-line truncation are unchanged from
   today. If they are not, say so and pick the other arrangement. Set
   `isStandalone` (`astryx-api.md:1951` — the link is not inside inline text).
6. **No `label`/`aria-label`/`tooltip` on the title link.** Its accessible name
   must be the title text itself. This is the opposite of the rule for the `×`.
7. `xstyle` does not work in this app (PRD v3.1 F-2). The escalation ladder is
   component → theme token → custom CSS. `style` is a documented Astryx prop
   (`astryx-api.md:1116`) and is how T130 achieved 44px.
8. Do not certify your own work (constitution: Non-Negotiables). Report
   measurements; a checker decides.

## Acceptance Criteria

Every one of these is checked against the running artifact, not your summary.

1. `docs/swarm/figures/ux-craft/old-events-tab.webp` was opened and the shipped
   action cluster matches its shape (short Edit chip + destructive `×`).
2. The coach row's event title is a real `<a>` whose `href` is
   `/outreach/:eventId`, carrying **no** `aria-label`, with its accessible name
   equal to the event title.
3. `View details – ` no longer appears anywhere in the coach `Table` surface.
   It still appears on the untouched student/parent rows.
4. The `×` control has an accessible name containing the event title, and a
   tooltip.
5. **Measured in real Chromium at 1440px: the `Table`'s scroll wrapper has
   `scrollWidth <= clientWidth`** — the internal scroll is gone. Report both
   numbers. This is the whole point of the task; an unmeasured claim fails it.
6. **Measured: every collapsed coach row ≤72px**, both buckets.
7. **Measured: every interactive control in the row ≥44px** in its smaller
   dimension, desktop and narrow.
8. At 375px: no page-level horizontal scroll
   (`document.documentElement.scrollWidth === innerWidth`); the narrow card
   column still renders the title link and the icon pair.
9. Upcoming and Past tables keep **byte-identical** column widths, and the
   existing `<th>` width assertion still passes unchanged.
10. The comment blocks at `:2470-2500` and `:2549-2566` describe the widths the
    code actually ships now.
11. `npx tsc --noEmit`, `npx eslint .`, `npx vite build`,
    `npm run format:check` all clean.
12. `npx vitest run` green. Baseline is **1414 passing**; the only permitted
    delta is the two amended assertions inside the coach T112 test. Any other
    test that changes count or content is a regression — report it, don't
    silence it.

## Relevant Constitution Excerpt

- Item 2 — Astryx props come only from `docs/swarm/astryx-api.md`. A prop absent
  from that file is presumed hallucinated → MAJOR.
- Item 11 — DES-21 styling escalation; ejecting component source needs boss
  approval.
- Item 15 — accessibility is a shipping requirement; keyboard-path failures on
  core flows → BLOCKER. The title link *is* the keyboard path here.
- Non-Negotiables — existing tests must pass unless explicitly approved; no
  worker marks its own work complete.

## Authorization for the reversal

This task reverses part of T112 (Passed) and supersedes the UXC-04 exemption
dated 2026-07-21. **George authorized it on 2026-07-28**, recorded in
`docs/swarm/VOLT_UX_Craft_PRD_v3.md` (UXC-04 row) and
`VOLT_UX_Craft_PRD_v3.html` (UXC-04 card), committed in `b959b90` **before**
this packet was dispatched. Cite that commit if a checker challenges the
reversal. No other part of T112 is authorized to change.

## Required Worker Output

Write `docs/swarm/active/T131-worker-output.md` containing:

- The measured actions-column width you chose and how you arrived at it.
- Scroll-wrapper `clientWidth` and `scrollWidth` at 1440px, before and after.
- Collapsed row heights, both buckets, before and after.
- Touch-target measurements for Edit, `×`, and the expander, desktop and narrow.
- Which `Text`-in-`Link` arrangement you shipped and the evidence the title's
  rendering is unchanged.
- The exact test lines amended, with before/after text.
- Full output of the five commands in criteria 11–12.
- Anything you could not verify, stated plainly as unverified.

Use a throwaway preview rig for the measurements (the pattern T129 and T130 both
used: `src/preview.throwaway.tsx` + `preview.throwaway.html`, `LoginAs` from
`src/test-utils/authHarness.tsx:131`, Chromium at
`/opt/pw-browsers/chromium-1194/chrome-linux/chrome`). `*.throwaway.*` is
gitignored. **Delete the rig before you finish.**
