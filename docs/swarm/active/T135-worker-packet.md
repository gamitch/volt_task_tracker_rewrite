# Worker Packet: T135 — MeetingsList coach rows → Astryx `Table` (UXC-02/03/07)

Wave 5, packet W5-P4. The largest remaining wave-5 task. Depends on **T132**
(the extracted `useIsNarrowViewport` hook). Runs after Wave A lands.

## Objective

Coach meeting rows are `ListItem`s whose `description` stacks **five**
`Text type="supporting"` lines plus a chip row. Nothing aligns between rows —
`ListItem` wraps `Item`, a three-slot flex, so sibling rows *cannot* share
column positions (PRD v3.1 F-1). Migrate them to `Table`, the only primitive
that can align columns, exactly as T130 did for the coach outreach rows.

**Read these first, in this order:**
1. `docs/swarm/figures/ux-craft/old-events-tab.webp` — the binding craft
   standard. Note the row shape: expander / date+chips / title / two stat
   columns / a compact action cluster.
2. `src/pages/outreach/OutreachList.tsx`'s coach `Table`
   (`buildCoachOutreachColumns` and the components it renders) — the proven
   in-repo implementation of everything below. **Copy its mechanisms; do not
   re-derive them.**

## Scope correction — UXC-01 is already done here

The PRD lists UXC-01 for this screen. **It has already shipped.**
`CoachMeetingsSection` (`:1455-1511`) already renders
`<Heading level={2} id={headingId}>` + `<div role="group" aria-labelledby={headingId}>`
wrapping the `List`/`EmptyState` ternary, and already omits `List header` —
T129 did this. Its tests are green at `MeetingsList.test.tsx:637` and `:651`.

**Keep that wrapper and both tests passing.** Put the `Table` inside the same
`<div role="group">`. Do not touch the heading, the id, or the wrapper.

## 1. The columns

Replace `CoachMeetingRowItem` (`:1393-1453`) and the `List` at `:1498` with a
`Table`, following `buildCoachOutreachColumns`'s structure.

Content mapping from today's `description`/`endContent`:

| Column | Content today | Notes |
|---|---|---|
| expander | — (a `Collapsible` inside the description) | `Sessions (N)` button, T130's shape |
| date | `summary.recurrenceChips` + `summary.dateRangeLabel` + the canceled `Badge` | T130 put its type `Badge` in the date column for the same reason — see §3 |
| title | `row.title` + `locationName · teamScopeLabel` | `proportional(2, { minWidth: 224 })` |
| hours | `${plannedHours} scheduled · ${loggedHours} held` | one `StatCell`: label `Scheduled`, value `Nh`, secondary `Nh held` |
| count | `Expected N · Attended N` | one `StatCell`: label `Expected`, value `N`, secondary `Attended N` |
| actions | the `MoreMenu` | Edit chip only — see §2 |

Use the **shared** `StatCell` (`src/components/StatCell.tsx`), extracted by
T131's wave precisely so this task inherits it. Do not write a local variant.

**Width budget — a starting point, not a result.** T130's measured set was
expander 120 / date 150 / title `proportional(2, {minWidth:224})` / hours 102 /
count 158 / actions 128, against a real available width of **1132px** at
1440px. This screen's date column carries recurrence chips (up to `MON (18)`
plus several siblings) and a canceled badge, so it needs more than 150; the
actions column carries only an Edit chip, so it needs far less than 128.

Start from expander 120 / date 200 / hours 130 / count 158 / actions 80 =
**688** fixed, + 224 title minimum = 912, comfortably inside 1132. **Measure
and report your final numbers.** If the sum plus the title minimum exceeds the
measured `clientWidth`, you have the same internal-scroll defect T131 was
created to fix — do not ship it.

## 2. Actions — Edit at row level, Cancel stays per session

T131 established the compact pair (short `Edit` chip + destructive `×`). **It
does not map cleanly here, and you must not force it.**

`onEdit` takes a whole row (`onEdit(row)`), but `onCancelRequest` targets **one
session** — `onCancelRequest(eventId, eventTitle, session)` — and each row can
hold many sessions with different statuses (`:1370-1384` renders a Cancel
button only for `status === 'scheduled'`).

So:
- **Row-level actions column: the `Edit` chip only.** Replace the `MoreMenu`
  with a short `Button` (`size="sm"`, `variant="secondary"`, visible text
  `Edit`, `label={`Edit – ${row.title}`}`). One item behind a menu is a menu
  that should not exist.
- **Cancel stays inside the expanded session rows**, exactly where it is today
  (`CoachMeetingSessionRow`, `:1328-1385`), with its existing verbatim label
  `` `Cancel ${formatWeekdayDate(session.sessionDate)} session` `` — three
  tests depend on that string.

Apply `MIN_TOUCH_TARGET_STYLE` (44px, T130's mechanism) to every button:
Edit, the expander, and the per-session Cancel.

## 3. Expansion — row splicing, not `Collapsible`

Today the description embeds `<Collapsible trigger={`Session details (N)`}>`.
Astryx's `Collapsible` **keeps its content in the DOM when collapsed**, which
several tests rely on (see Traps).

Replace it with T130's proven pattern: a flat `data` array where expanding an
event **splices `kind: 'sessionDetail'` rows in** beneath it, driven by
`useState`, with the expander button carrying `aria-expanded` and
`aria-controls` (the latter only while expanded — the ids do not exist in the
DOM when collapsed, so a collapsed `aria-controls` would be a stale IDREF).

**Do not use `useTableGroupedRows` or `useTableRowExpansion`.** They exist in
installed source but have **zero occurrences in `docs/swarm/astryx-api.md`**,
which constitution item 2 makes a MAJOR. Two passed tasks already ruled them
out on exactly this ground.

**The canceled `Badge`** (`{summary.canceledCt > 0 && <Badge variant="error" …>}`,
`:1449`) currently floats in `endContent`. Give it a column home — the date
column, matching where T130 put its type badge. The PRD calls its current
placement a defect ("floating canceled badge").

## 4. Narrow viewport

Import `useIsNarrowViewport` from `src/hooks/` (T132 extracted it there —
**do not copy it**). Below 768px, collapse every column into one stacked card
column, exactly as `buildCoachOutreachColumns`'s `isNarrow` branch does. The
fixed columns sum to well over 375px, so without this the page scrolls
horizontally, which UXC-13 forbids.

## Allowed Files

- `src/pages/meetings/MeetingsList.tsx`
- `src/pages/meetings/MeetingsList.test.tsx`
- `docs/swarm/active/T135-worker-output.md` (create)
- New `.webp` figures under `docs/swarm/figures/ux-craft/`

## Forbidden Files

- `src/pages/outreach/**` — read `OutreachList.tsx` as your reference, do not
  edit it. `src/components/StatCell.tsx` likewise: **import it, do not modify
  it.** Other screens depend on it.
- `src/pages/meetings/Kiosk.tsx`, `LiveConsole.tsx` — T134's files.
- `src/hooks/**` — T132 owns the hook. Import it; if it is missing or wrong,
  stop and report rather than recreating it.
- `src/app/router.tsx`, `docs/swarm/constitution.md`, `task-ledger.md`,
  `verification-log.md`, `dispute-log.md`, `.claude/**`,
  `supabase/migrations/**`.

## Traps

1. **`Collapsible` keeps content mounted; row splicing does not.** Three
   assertions depend on collapsed content being present without a click:
   - `:597` — `toContain('Attended: Alex Rivera, Bailey Chen, Casey Nguyen')`
   - `:827` — `findButtonByText('Cancel Wed, Jul 22 session')` with no prior
     expand
   - `:842` — `toContain('Canceled — no attendance recorded.')` after the
     mutation
   All three must gain an explicit expand step. The test comment at `:594-596`
   ("Collapsible content is always in the DOM … so no click needed") becomes
   false and must be rewritten, not left.
2. **`StatCell` splits strings the tests assert as one run.** These four will
   break and are **authorized to be amended**, because the concatenated form is
   exactly the undifferentiated density UXC-03 exists to fix:
   - `:581` `'4h scheduled · 2h held'`
   - `:585` `'Expected 5 · Attended 4'`
   - `:589` `'3h scheduled · 1.5h held'`
   - `:590` `'Expected 2 · Attended 3'`
   Amend them to assert the same **numbers** in their new per-cell homes. Do
   not weaken them to substring-of-anything checks — the point is that the
   values still render, in the right column.
3. **`'Session details (N)'` (`:595-596`) is the `Collapsible` trigger text.**
   If you adopt T130's `Sessions (N)` wording, both assertions change. Either
   keep the existing wording (cheaper, and no test churn) or change it and
   amend both — state which you chose and why.
4. **Do not touch the T129 UXC-01 tests** (`:637`, `:651`). They assert the
   `aria-labelledby` round-trip in populated *and* empty branches. Your `Table`
   goes inside the existing `<div role="group">`; both must stay green
   untouched.
5. **Keep every non-rendering test green untouched.** `MeetingsList.test.tsx`
   has ~40 pure-function tests (`buildCoachMeetingRows`,
   `summarizeCoachMeetingRow`, `partitionCoachMeetingRows`, the formatters).
   None should need a single character changed. If one does, you have changed
   logic that was not in scope — stop and report.
6. **Upcoming and Past render through the same component** (`CoachMeetingsSection`
   is called twice). Their column widths must come out **byte-identical**, as
   T130's did. Assert it.
7. **≤72px collapsed rows** (UXC-07) and **44px touch targets** (UXC-13).
   T130 failed attempt 1 on 28px controls, then had to rebalance all six
   columns when 44px broke the row ceiling. Expect that interaction; measure
   both, do not infer them.
8. Do not certify your own work.

## Acceptance Criteria

1. `old-events-tab.webp` opened; the shipped row matches its shape.
2. Coach rows render through `Table` with aligned columns; zero horizontal
   drift between sibling rows at 1440px.
3. **Measured: the `Table`'s scroll wrapper has `scrollWidth <= clientWidth`
   at 1440px**, both Upcoming and Past. Report both numbers.
4. **Measured: every collapsed row ≤72px**, both sections.
5. **Measured: Edit, the expander, and the per-session Cancel each ≥44px** in
   their smaller dimension, at 1440px and 375px.
6. Expansion splices session rows in and removes them on collapse;
   `aria-expanded` present, `aria-controls` set only while expanded.
7. The canceled `Badge` has a column home; nothing floats.
8. At 375px: no page-level horizontal scroll
   (`document.documentElement.scrollWidth === innerWidth`); the stacked card
   column renders every field.
9. Upcoming and Past column widths byte-identical.
10. `useIsNarrowViewport` is **imported** from `src/hooks/`, not redefined.
11. `StatCell` is imported from `src/components/StatCell.tsx`, unmodified.
12. **Captures at 1440px and 375px, light and dark**, as `.webp` (UXC-13/14).
13. `npx tsc --noEmit`, `npx eslint .`, `npx vite build`,
    `npm run format:check` clean.
14. `npx vitest run` green. Baseline is **1414 across 61 files** — plus
    whatever T132 and T134 added, which you inherit; report the number you
    start from before changing anything. The permitted deltas are exactly the
    assertions named in Traps 1–3. Any other test that changes is a
    regression — report it, don't silence it. Zero `.skip`/`.only`/`.todo`.

## Relevant Constitution Excerpt

- Item 2 — Astryx props come only from `astryx-api.md`. `useTableGroupedRows`
  and `useTableRowExpansion` have zero occurrences there → forbidden.
  `style` on Button/IconButton is an authorized installed-source deviation
  (`Button.tsx:545`, `:652-657`; `mergeProps.ts:84-89`), shipped by T130/T131
  under D004 — use it for the 44px targets, but do not call it documented.
- Item 11 — DES-21 escalation: component → theme token → custom CSS. `xstyle`
  does not work in this app (PRD v3.1 F-2).
- Item 12 — all four async states. This screen has them; do not regress any.
- Item 15 — accessibility is a shipping requirement.
- Non-Negotiables — existing tests pass unless explicitly approved; no worker
  self-certifies.

## Required Worker Output

`docs/swarm/active/T135-worker-output.md`:

- Final column widths and the measurement behind each.
- Scroll-wrapper `clientWidth`/`scrollWidth` at 1440px, before and after.
- Collapsed row heights, both sections, before and after.
- Touch-target measurements for Edit, expander, and Cancel, at both viewports.
- The expander wording you chose (Trap 3) and why.
- Every test assertion amended, with before/after text and which Trap
  authorized it.
- The test count you started from and ended with.
- Paths of the four captures.
- Full output of the commands in criteria 13–14.
- Anything unverified, stated plainly as unverified.

Use a throwaway rig for measurements (`*.throwaway.*` is gitignored; Chromium
at `/opt/pw-browsers/chromium-1194/chrome-linux/chrome`; `LoginAs` from
`src/test-utils/authHarness.tsx:131`). **Delete it before finishing.**
