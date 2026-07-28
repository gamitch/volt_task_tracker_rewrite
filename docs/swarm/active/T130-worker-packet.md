# Worker Packet: T130

## Task ID
T130 — Wave 5 / W5-P2: migrate `OutreachList` coach rows to Astryx `Table`
(UXC-02, 03, 04, 07, 13, 14). **This is wave 5's proving ground — T131's
rollout to Meetings/Calendar/student surfaces depends on the pattern you
establish here.**

## Objective
Read `docs/swarm/VOLT_UX_Craft_PRD_v3.md` (v3.1) §2.0 (F-1/F-2/F-3) and §2
(UXC-02/03/04/07/13/14) first. **Open the two binding figures with the Read
tool** — it renders images:
- `docs/swarm/figures/ux-craft/old-events-tab.webp` — the craft standard
- `docs/swarm/figures/ux-craft/new-outreach-expanded.webp` — what ships today

Rework the **coach** view of `src/pages/outreach/OutreachList.tsx` from
`List`/`ListItem` onto Astryx `Table`, so every stat and action column starts at
the same x on every row. Today they drift per-row because the title block sizes
itself ("Planned" at ≈543px on one row, ≈487px on the next).

### Why `Table` and not a CSS grid (F-1 — do not re-litigate)
`ListItem` wraps `Item`, a three-slot flexbox (`start | content(flex:1) | end`)
whose end caps are `flex: 0 0 auto` — intrinsically sized by their contents
(`node_modules/@astryxdesign/core/src/Item/Item.tsx:156-275`). No prop reaches
that layout. `Grid` is equal-width-only; `StackItem` is `'static'|'fill'` only.
`Table` resolves column widths once and applies them to every row.

**Do NOT write custom CSS or `xstyle` for this.** `xstyle` is typed everywhere
but unusable — StyleX is compile-time and this app has no StyleX plugin, so
`stylex.create()` throws (F-2).

### The pattern to follow (in-repo precedent, read both)
- `src/pages/roster/StudentsTab.tsx:998-1049` — `Table` with `pixel()`,
  `proportional()`, `renderCell` returning `Badge`/`Text`/`IconButton`
- `src/pages/reports/ParticipationTab.tsx:305-327` — imports and column types

### Columns
`[expander] [date + weekday chips] [title + location] [planned/logged]
[expected/attended] [actions]`. Stats `align="end"`; title column
`proportional()` and flexing with `textOverflow="truncate"`; expander and
actions `pixel()`.

### Section grouping and expansion
- Upcoming/Past sections via `useTableGroupedRows`.
- Row expander via `useTableRowExpansion`. **Known gap (F-1):** expansion is
  *inherited-columns* mode — child rows reuse the parent's columns; there is no
  `renderExpandedContent`. Per-session detail (date, time, hours, attendance)
  maps to those columns cleanly. The free-text "Going: Priya, Devon" line does
  **not**. Decide: give it its own column, or use children mode with
  `TableCell colSpan` (which forfeits width resolution). **Disclose which you
  chose and why** — this is the one place the primitive may not fit, and T131
  inherits your decision.

### UXC-03 — shared stat cell
Build one shared three-tier `renderCell` helper (micro-label caps/dim, value
semibold with `hasTabularNumbers`, optional secondary line) and use it for every
stat column. T131 and W5-P4 will import it, so put it somewhere reusable and
name it accordingly.

### UXC-04 — compact affordances
Expander: icon-only chevron. Edit: `IconButton` or short chip. Cancel: compact ×
with destructive styling. Details: a short "Details" link. **No visible control
label may contain an event title** — today every row reads "Show session details
— Community Food Bank Sort" and "View details — Community Food Bank Sort". The
title moves into the accessible name (`aria-label="Edit Riverside Park
Cleanup"`), preserving the screen-reader disambiguation the current design was
buying with visible words.

### UXC-07 — density and separation
Collapsed coach rows **≤72px measured** at 1440px. (The old "≥8 rows visible"
criterion was dropped: this page ships 5 event fixtures, so it was
unverifiable.) Use `Table`'s own `density`/`dividers`/`isStriped` props; default
to bordered row-cards matching the reference figure. No expander control may
out-weigh a row title in font size or weight.

### UXC-13 — responsive (MAJOR)
NFR-06 mandates 375→1440 and T068's sweep already passed — column grids are the
likeliest thing to regress it. State and implement small-screen behavior: which
columns drop or collapse below 768px, how a row reads on a phone. **Ship
screenshots at 375px and 1440px.** No horizontal page scroll at 375px; no
control below a 44px touch target.

### UXC-14 — dark theme
Capture your surfaces in **both** themes and add the dark figures to
`docs/swarm/figures/ux-craft/`.

## Allowed Files
- `src/pages/outreach/OutreachList.tsx`, `OutreachList.test.tsx`
- new shared stat-cell component + test (put it under `src/components/`)
- `docs/swarm/figures/ux-craft/**` (your new screenshots only)

## Forbidden Files
- The **student/parent** view in `OutreachList.tsx` — leave its render path
  alone this packet (T131 handles student surfaces).
- `OutreachEventDialog.tsx`, `OutreachDetail.tsx`, `SelfCheckoffDialog.tsx`,
  `MarkEventCompleteDialog.tsx`, all meetings files, `CalendarPage.tsx`, all
  home files, `src/lib/supabase/**`, `supabase/**`, `docs/swarm/**` except the
  figures dir, `.claude/**`.

## Traps
1. **Zero data-layer changes.** This is presentation only. `loadOutreachData`
   and every loader stay untouched; no metric math moves into TS (constitution
   item 3).
2. **Preserve verified behavior.** `OutreachList.tsx` carries T106's `seasonId`
   resolution, T119's D-7 author-agnostic RSVP logic, T121's real-attendance
   Attended column, and T126's self-checkoff entry point. Restructuring rows
   must not alter any of it. The checker will diff the non-render code paths.
3. **T121's UXD-05 fix must survive**: exactly one "Team season goal" heading.
   Its test asserts zero `role="progressbar"` on this page — **leave that alone**;
   restoring the bar is W5-P4's job (UXC-08), not yours.
4. Astryx props verified against installed source (the api doc has been wrong
   twice). Keyboard-accessible expander; both themes; contrast per UXD-09.
5. Sibling T129 is editing headings and copy in this same file concurrently.
   **T129 owns headings/copy; you own row structure.** Attribute noise honestly;
   never `git stash`.

## Required Output
Full diff; the column definitions with their width choices; the row-expansion
decision and its rationale (F-1 gap); before/after screenshots at 1440px **and**
375px in both themes, with the measured collapsed row height and evidence of
zero column x-drift; proof the four verified behaviors in Trap 2 are unchanged;
gate output (tsc, eslint 0 errors, full vitest, build, prettier); risks;
disclosed judgment calls.
