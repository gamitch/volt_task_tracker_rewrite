# Worker Packet: T130 (rev. 2 — after premise check)

## Task ID
T130 — Wave 5 / W5-P2: migrate `OutreachList` **coach** rows to Astryx `Table`
(UXC-02, 03, 04, 07, 13, 14). **Wave 5's proving ground — T131's rollout
inherits your pattern.**

> **rev. 2** removed four blockers found by the premise check: a prescription
> that silently reversed T112 and broke 5 green tests, two Table plugins that
> constitution item 2 forbids, an icon-only expander that breaks a green test,
> and an impossible `textOverflow` instruction. Read the marked sections.

## Objective
Read `docs/swarm/VOLT_UX_Craft_PRD_v3.md` §2.0 (F-1/F-2/F-3) and §2
(UXC-02/03/04/07/13/14). **Open both binding figures with the Read tool** — it
renders images:
- `docs/swarm/figures/ux-craft/old-events-tab.webp` — the craft standard
- `docs/swarm/figures/ux-craft/new-outreach-expanded.webp` — what ships today

Rework the **coach** view of `src/pages/outreach/OutreachList.tsx` from
`List`/`ListItem` onto Astryx `Table`, so stat and action columns start at the
same x on every row. Today they drift because `Item`'s end slots are
`flex: 0 0 auto` — intrinsically sized by content
(`node_modules/@astryxdesign/core/src/Item/Item.tsx:268,272`). No prop reaches
that layout; `Grid` is equal-width-only; `StackItem` is `'static'|'fill'`.
`Table` resolves widths once and applies them to every row.

**Do NOT write custom CSS or `xstyle`** — StyleX is compile-time, this app has
no StyleX plugin, and `stylex.create()` throws at runtime (F-2, verified).

### Structure — Section + one Table per group (NOT the Table plugins)
`useTableGroupedRows` and `useTableRowExpansion` are real in installed source
but have **zero occurrences in `docs/swarm/astryx-api.md`**. Constitution item 2
is in force: *"A prop absent from that file is presumed hallucinated → MAJOR."*
**Two passed tasks already adjudicated this exact question and ruled them out of
bounds** — `ParticipationTab.tsx:130-137` and `EventsTab.tsx:217-226`. A packet
cannot override the constitution, so:

Use the precedent those two tasks established: **one `Section` per group
(Upcoming / Past), each containing a real `Heading level={2}` and one
independent `<Table>`.** See `ParticipationTab.tsx:137-147` for the exact shape.

- This also resolves the heading question: **you own the coach section headings
  now** (T129 was descoped from `CoachOutreachSection`). Each Section keeps one
  real `Heading` — a `Table` has no `header` prop, and its scroll wrapper
  hardcodes `role="group" aria-label="Table"`, so deleting the heading would
  leave the section unnamed.
- **Caveat:** two `Table`s resolve widths independently. Share one
  `buildColumns()` factory and use explicit `pixel()`/`proportional()` widths so
  both groups resolve identically. Otherwise Upcoming and Past will not align
  with each other.

### Row expansion — plain `useState`, no plugin
Compute the rendered row list yourself: when a row is expanded, splice its
session-detail rows into the `data` array beneath it (same row type, discriminated
by a `kind` field your `renderCell`s switch on). This needs no plugin and no
`colSpan`. The free-text "Going: Priya, Devon" line (`OutreachList.tsx:2033`)
renders as the child row's **title-column** content.

### Columns
`[expander] [date + weekday chips] [title + location] [planned/logged]
[expected/attended] [actions]`. Stats `align="end"`; title column
`proportional()`; expander and actions `pixel()`.

**Truncation:** use `<Text maxLines={1}>` (or 2) **inside** the title column's
`renderCell`. Do **not** use `textOverflow="truncate"` — it is a **Table-level**
prop (`Table.tsx:98`) and `types.ts:573-574` states verbatim: *"Only affects
cells using the default renderer (no `renderCell`)."* Your title column uses
`renderCell`, so it would be a guaranteed no-op. `Text.maxLines` also gives a
free hover tooltip when truncated (`Text.tsx:239-251`) and is documented in
`astryx-api.md`; in-repo precedent at `KpiStrip.tsx:328`.

### UXC-03 — extract the stat cell, don't build one
The three-tier shape already exists three times. **Extract and reuse**, so
T131 and W5-P4 inherit exactly what is already on screen:
- `OutreachList.tsx:1789-1795` — `Text type="label" color="secondary"` /
  `Text type="body" weight="semibold" hasTabularNumbers`
- `OutreachList.tsx:1959-1968` — same plus the optional third line
  (`Text type="supporting"` "Reached {n}")
- `KpiStrip.tsx:313-330`, `CoachHome.tsx:1786-1791` — label / value / secondary

Put the extracted component under `src/components/` and name it for reuse.

### UXC-04 — ONLY the expander violates
**Corrected scope.** `Edit` (`OutreachList.tsx:1980-1986`) and `Cancel`
(`:1988-1996`) **already comply**: visible text is "Edit"/"Cancel", the title is
already in `label`. **Leave them alone**, and preserve their `aria-label`
strings **byte-for-byte including the en dash `–`** —
`OutreachList.test.tsx:1212` and `:1254` pin `'Edit – Community Food Bank Sort'`
and `'Cancel – Riverside Park Cleanup'` exactly.

**`View details – {title}` stays verbatim** (`:1997-1999`). Do **not** shorten
it to "Details" or move the title into `aria-label`. That would reverse T112
(Passed), break `OutreachList.test.tsx:1592-1595` and `:1625`, and violate
`astryx-api.md`'s Link Best Practices, which state that setting `label` on a
text link *"prevents assistive technology from reading the actual link
content"* and that generic text like "read more" is forbidden.

**The expander is the one genuine violation** (`:1970-1979`): it is a `Button`
with `label="Show session details – {title}"` and no children, so the label is
also the visible text. Fix it the way Edit/Cancel already do it — keep `label`
byte-identical, add short visible children (e.g. `Sessions (3)`), so the title
survives in the accessible name only.

**Pre-authorized test change:** `OutreachList.test.tsx:1024` asserts
`btn.textContent?.startsWith('Show session details')`. Amend it to assert on the
accessible name (`aria-label`/`label`) instead, in this same change. Name it in
your report.

### UXC-07 — density and separation
Collapsed coach rows **≤72px** at 1440px. Use `Table`'s `density`/`dividers`/
`isStriped`; default to bordered row-cards matching the reference figure. No
expander control may out-weigh a row title in font size or weight.

Note: this page renders **4** coach outreach events (5 fixtures exist;
`event-team-meeting` is excluded by NAV-07).

### UXC-13 / UXC-14 — responsive and dark theme
State and implement small-screen behavior below 768px (which columns drop or
collapse, how a row reads on a phone). No horizontal page scroll at 375px; no
control below a 44px touch target.

**How to capture screenshots** (the route is `RequireAuth`-guarded and there is
no session-injection seam for a real browser — `playwright.config.ts` documents
this): build a **throwaway preview entry** — a `src/preview.throwaway.tsx` +
`preview.throwaway.html` pair that mounts `<OutreachList loadData={defaultLoadOutreachData}
seasonId="season-placeholder-current" />` inside `MemoryRouter` + `LoginAs`
(`src/test-utils/authHarness.tsx`) + `LayerProvider`/`Theme`/`AppShell`, run
`vite` against it, and screenshot with the chromium at
`/opt/pw-browsers/chromium-1194/chrome-linux/chrome`. **Delete both throwaway
files before you finish — they must never be committed.** This exact approach
produced the figures already in `docs/swarm/figures/ux-craft/`.

Capture before/after at 1440px and 375px in both themes; add the new figures to
`docs/swarm/figures/ux-craft/`.

## Allowed Files
- `src/pages/outreach/OutreachList.tsx`, `OutreachList.test.tsx`
- new shared stat-cell component + test under `src/components/`
- `docs/swarm/figures/ux-craft/**` (your new screenshots only)

## Forbidden Files
- The **student/parent** view in `OutreachList.tsx` (T129 owns its heading;
  T131 owns its rows).
- `AttendancePanel.tsx`, `RsvpControl.tsx`, `MarkDayCompleteDialog.tsx`,
  `MarkEventCompleteDialog.tsx`, `ParentRsvp.tsx`, `SelfCheckoffDialog.tsx`,
  `OutreachEventDialog.tsx`, `OutreachDetail.tsx`, all meetings files,
  `CalendarPage.tsx`, all home files, `src/lib/supabase/**`, `supabase/**`,
  `docs/swarm/**` except the figures dir, `.claude/**`.

## Traps
1. **Zero data-layer changes.** Presentation only. No loader edits, no metric
   math in TS (constitution item 3).
2. **Preserve verified behavior in this file** — the checker will diff the
   non-render code paths for each:
   - **T106** `seasonId` resolution (module doc #12; code at 2800/2895/3036)
   - **T101** real load + `onSaveEvent`/`saveOutreachEvent` create/edit path (doc #11)
   - **T112** the per-row "View details" `Link` (doc #13) — see UXC-04
   - **T121** real-attendance Attended column (`distinctAttendedStudentIds`;
     tests at 626/673)
   - **T126** self-checkoff entry point (doc #14; code 2483-2693)
   - **BEH-01** milestone-toast localStorage dedupe keyed by `seasonId` +
     `goalBarId` (docs #4, lines 104-105)
   - **BEH-02** confirmed and planned hours never summed (doc #3)
   - **NAV-07** outreach-only filtering (doc #2; asserted at tests 1033-1035)
   *(T119's D-7 logic is NOT in this file — it lives in `AttendancePanel.tsx`
   and the loaders. Do not go looking for it here.)*
3. **T121's UXD-05 fix must survive**: exactly one "Team season goal" heading,
   and `OutreachList.test.tsx:1294` asserts zero `role="progressbar"` on this
   page. **Leave that alone** — restoring the bar is W5-P4's job (UXC-08).
4. Astryx props from `astryx-api.md`; where it is silent, stop and flag rather
   than assuming installed source wins (see the Structure section — that is
   exactly what took the plugins off the table).
5. Only **two** test assertions are pre-authorized for change: the expander at
   `:1024`. Everything else in that file must stay green. `OutreachList.test.tsx`
   is **67/67 passing** right now — that is your baseline.
6. Sibling T129 edits the **student** section of this file concurrently.
   Attribute noise honestly; never `git stash`.

## Required Output
Full diff; column definitions with width choices and the shared `buildColumns()`
factory; the expansion implementation; proof of column alignment — assert every
`<td>` in a column carries an identical resolved width across all rows (jsdom
returns zeros for geometry, so this structural assertion is the measurable
form); measured collapsed row height from the preview rig; before/after
screenshots at 1440px and 375px in both themes; explicit proof each of Trap 2's
eight behaviors is unchanged; confirmation the throwaway preview files were
deleted; gate output (tsc, eslint 0 errors, full vitest, build, prettier);
risks; disclosed judgment calls.
