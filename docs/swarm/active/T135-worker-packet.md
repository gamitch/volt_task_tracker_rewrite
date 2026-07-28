# Worker Packet: T135 — MeetingsList coach rows → Astryx `Table` (UXC-02/03/07)

Wave 5, packet W5-P4. The largest remaining wave-5 task.
**Revision 3 (2026-07-28)** — cleared for dispatch. Revision 2 refreshed the
packet after Wave A landed; the premise gate then returned **2 BLOCKERs and 2
MAJORs**, all author errors, and revision 3 resolves them. Citations below have
been verified twice against the real file. Carries a human authorization for a
PRD deviation (§2).

## FIRST — merge the working branch

Your worktree is created from `main`, not from the branch this work lives on.
Before anything else:

```
git fetch origin
git merge origin/claude/swarm-plan-zl575z
```

Report the result. **If it conflicts, stop and report** rather than resolving.
A sibling task lost a full cycle to a stale worktree base — it was handed a tree
where a dependency had never shipped, and only caught it because it checked.

## Objective

Coach meeting rows are `ListItem`s whose `description` stacks **four**
`Text type="supporting"` lines plus a chip row and a `Collapsible`. Nothing aligns between rows —
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
`CoachMeetingsSection` (`:1455-1512`) already renders
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
hold many sessions with different statuses (the conditional opens at `:1372`, Button `:1373-1380`, rendering Cancel only
for `status === 'scheduled'`).

So:
- **Row-level actions column: the `Edit` chip only.** Replace the `MoreMenu`
  with a short `Button` (`size="sm"`, `variant="secondary"`, visible text
  `Edit`, `label={`Edit – ${row.title}`}`). One item behind a menu is a menu
  that should not exist.

  > **AUTHORIZED (2026-07-28, George).** `VOLT_Portal_PRD.md:280` (MTG-01)
  > specifies a "per-row `MoreMenu` (Edit, Cancel session — `AlertDialog`)".
  > Removing it is a PRD deviation, and constitution item 1 puts PRD requirement
  > IDs above packet text — so it needed a ruling, which it now has, recorded
  > alongside MTG-01 in the PRD itself. Rationale: T122 already moved Cancel out
  > to per-session buttons (disclosed, certified), leaving the menu holding
  > exactly one item. Same resolution T131 shipped on the outreach rows under
  > commit `b959b90`.
  >
  > **You must amend `it('Edit shows an honest stub…')` at `:791`.** It looks up
  > `aria-label^="Actions for Weekly Build Meeting"` (`:795-797`). Once the
  > `MoreMenu` is gone that returns `undefined`, the optional-chained dispatch at
  > `:799` swallows it silently, and the generic `Edit`-text search at `:801-803`
  > finds your new chip — so **the test would pass while asserting an affordance
  > that no longer exists.** Rewrite it to find the Edit chip directly. A dead
  > test is worse than a failing one. This is a **tenth** authorized assertion
  > change, on top of Trap 1's nine.

- **Cancel stays inside the expanded session rows**, exactly where it is today
  (`CoachMeetingSessionRow`, `:1328-1385`), with its existing verbatim label
  `` `Cancel ${formatWeekdayDate(session.sessionDate)} session` `` — three
  tests depend on that string.

Apply `MIN_TOUCH_TARGET_STYLE` (44px, T130's mechanism) to every button:
Edit, the expander, and the per-session Cancel.

## 3. Expansion — row splicing, with state lifted to `MeetingsList`

Today the description embeds `<Collapsible trigger={`Session details (N)`}>`.
Astryx's `Collapsible` **keeps its content mounted when collapsed** — verified,
`Collapsible.tsx:102-104` applies `contentHidden: {display:'none'}` to an
always-rendered `<div>`; children are never conditionally rendered. Several
tests depend on that. Row splicing removes those rows entirely.

Replace it with T130's pattern: a flat `data` array where expanding an event
**splices `kind: 'sessionDetail'` rows in** beneath it, with the expander button
carrying `aria-expanded` and `aria-controls` (the latter only while expanded —
the ids do not exist when collapsed, so a collapsed `aria-controls` would be a
stale IDREF).

**But do NOT copy T130's state placement.** `OutreachList.tsx:2677` holds
expansion state in a `useState` **inside each section component**. Copying that
here inherits a bug that does not exist on the outreach screen:

`handleConfirmCancel` (`:1595-1608`) optimistically flips the canceled session's
status, and `partitionCoachMeetingRows` is recomputed by `useMemo` on `rows`
(`:1567`). A row is Upcoming only while it has **any** scheduled session —
pinned by tests at `:457`/`:464`. `event-weekly-build`'s only scheduled session
is the one being canceled, so **on confirm the row moves from the Upcoming
section to the Past section.** With per-section state, the Past instance's set
is empty, the row re-renders collapsed, and the user silently loses their
expansion at the exact moment they most want to see the result of their action.

**Ship one `useState<ReadonlySet<string>>` keyed by `eventId` in
`CoachMeetingsView` (`:1544`)** — the component that already owns `rows`
(`:1545`), runs the partition `useMemo` (`:1567`), holds `handleConfirmCancel`
(`:1592`) and renders **both** sections (`:1745`, `:1754`), so it cannot remount
across the re-partition. Pass the set and its toggle down to both. Do **not**
park it in `MeetingsList` (`:2081`) — that is the role dispatcher, and a
coach-only set would have to be drilled through two components and sit next to
the student branch. Expansion then survives the
bucket change. This is simpler than the per-section version, not more complex,
and it is what makes Trap 1's `:842` assertion satisfiable at all.

**Do not use `useTableGroupedRows` or `useTableRowExpansion`.** They exist in
installed source but have **zero occurrences in `docs/swarm/astryx-api.md`**
(grep-verified), which constitution item 2 makes a MAJOR. `ParticipationTab.tsx:128-140`
and `EventsTab.tsx:218` both record the ruling on exactly this ground.

**The canceled `Badge`** (`{summary.canceledCt > 0 && <Badge variant="error" …>}`,
`:1447`) currently floats in `endContent`. Give it a column home — the date
column, matching where T130 put its type badge. The PRD calls its current
placement a defect (`VOLT_UX_Craft_PRD_v3.md:98-99`, "floating canceled badge").

**Two helpers you must re-declare, not import.** `MIN_TOUCH_TARGET_STYLE`
(`OutreachList.tsx:2299`) and `sessionDetailAnchorId` (`:2099`) are
**non-exported locals in a Forbidden file**. Copy their definitions locally —
`const MIN_TOUCH_TARGET_STYLE: CSSProperties = { minHeight: '44px' }` — rather
than exporting them from `OutreachList.tsx`. This is the one place "copy it" is
correct; `StatCell` and `useIsNarrowViewport` are real modules and must be
imported.

## 4. Narrow viewport

Import `useIsNarrowViewport` from `src/hooks/useIsNarrowViewport.ts`. **T132
has landed, so this file genuinely exists** — along with `NARROW_VIEWPORT_QUERY`
and `getIsNarrowViewport`. Import it; **do not copy it**. Below 768px, collapse every column into one stacked card
column, exactly as `buildCoachOutreachColumns`'s `isNarrow` branch does. The
fixed columns sum to well over 375px, so without this the page scrolls
horizontally, which UXC-13 forbids.

## Standing rulings that apply here — do not re-litigate

**Do NOT make the meeting title a link.** The other three row surfaces
(coach outreach, student/parent outreach, calendar) now carry linked titles
under UXC-04, so a checker may flag this screen as inconsistent. It is
deliberate: PRD NAV-08 specifies `/meetings/:sessionId` as a "meeting detail
page", **that route does not exist** (`router.tsx` has 14 routes, none of them
this, and no catch-all), and no meeting-detail component exists. Linking the
title here would point at a blank page. The title cell renders plain text.

**D-1 (2026-07-28, George):** absent text truncation on a linked title is
accepted behaviour project-wide, not a defect. This should not arise here —
`Table` cells are not `ListItem` label slots — but if it does, measure, report,
and move on. Do not propose a `labelLines` cast.

**D008 (2026-07-28):** a linked row title is canonically `weight` 600 / 14px /
`--color-text-primary`. Relevant only if you restyle the title cell; the
existing `ListItem` label was already semibold, so match it.

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

1. **`Collapsible` keeps content mounted; row splicing does not — and this
   breaks NINE assertions across THREE tests, not three in one.** The premise
   gate enumerated them by rendering the real coach view and re-measuring
   `textContent` with every collapsed region removed. All nine are **authorized
   to be amended**:

   **Test `:550`** (`populated state: Upcoming/Past sections…`) — the packet's
   revision 1 never mentioned this test at all:
   - `:558` `toContain('Scheduled')` — the only source is
     `SESSION_STATUS_BADGE.scheduled` (`:1244`), used at `:1343` inside the
     expander. **It survives only by accident**, because §1 prescribes an hours
     `StatCell` whose label is literally the word `Scheduled`. **Pin that label**
     if you want it to keep passing; do not rename it casually.
   - `:560` `toContain('Canceled')` — capital-C exists only inside the expander
     (`:1246`, `:1367`). The row-level badge is lowercase `${n} canceled`
     (`:1447`), so it does not satisfy this.
   - `:561` `toContain('present')` — only from `formatPastAttendanceSummary`
     (`:1233-1237`), rendered at `:1357` inside the expander.
   - (`:559` `'Completed'` survives via the Past `EmptyState` description, by
     luck rather than design. Do not rely on it.)

   **Test `:820`** (`Cancel (inline, per-session) … really calls the mutation`):
   - `:827` `findButtonByText('Cancel Wed, Jul 22 session')` — needs an expand.
   - `:842` `toContain('Canceled — no attendance recorded.')` — **see Trap 2.**
   - `:851` `findButtonByText('Cancel Sat, Jul 25 session')` — this is the
     **Ravens** row, a different row from `:827`. It needs **its own** expand.

   **Test `:854`** (`Cancel rolls back … when the mutation rejects`) — also
   unmentioned in revision 1, and it will throw rather than fail cleanly:
   - `:859` `findButtonByText('Cancel Wed, Jul 22 session')` with no prior
     expand returns `undefined`, and `clickButton(undefined)` throws.
   - `:868` the same string re-asserted after rollback.

   The test comment at `:592-594` ("Collapsible content is always in the DOM …
   so no click needed") becomes false and must be rewritten, not left.

   **Add one `expandRow(title)` helper** beside `findButtonByText`
   (`:142-146`). Nine call sites, one line each, test count unchanged.

2. **`:842` is not fixed by an expand step — the row changes section
   mid-test.** This is the subtlest thing in the task. Confirming the cancel
   re-partitions `event-weekly-build` from Upcoming to Past (§3). An expand
   performed before the mutation applied to the **Upcoming** copy; the Past copy
   is a different render. If you ship per-section expansion state, `:842` fails
   no matter how many expands you add. **Lifting the state to `MeetingsList`
   (§3) is what makes this assertion satisfiable.** If you find yourself adding
   a second post-mutation expand to force it green, stop — you have shipped the
   wrong state placement.

3. **`StatCell` splits strings the tests assert as one run.** These four break
   and are **authorized**, because the concatenated form is exactly the
   undifferentiated density UXC-03 exists to fix:
   - `:581` `'4h scheduled · 2h held'`
   - `:584` `'Expected 5 · Attended 4'`
   - `:589` `'3h scheduled · 1.5h held'`
   - `:590` `'Expected 2 · Attended 3'`
   Amend them to assert the same **numbers** in their new per-cell homes. Note
   `StatCell` renders label and value with **no separator** (`StatCell.tsx:56-61`;
   its own test pins `"Planned3h"`), so do not assume a space. Do not weaken
   these to substring-of-anything checks.

3b. **`'Session details (N)'` (`:595-596`) is the `Collapsible` trigger text.**
   Two options, and the width budget depends on which you pick:
   - **Keep the wording** — no test churn, but budget the expander column at
     **~170px**, not 120px. `Session details (3)` is ~50-60px wider than T130's
     `Sessions (N)` (~102px natural, `OutreachList.tsx:2499-2508`) and will wrap
     at 120px against a 44px target height — the exact mechanism that pushed
     T130's rows past the 72px ceiling.
   - **Adopt `Sessions (N)`** — 120px works, but both assertions change.
   State which you chose and why.

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
   is called twice), so byte-identical widths are structural, not something to
   prove by luck. See criterion 9 — the shipped fixture renders only one
   `Table`, so an assertion that "both tables match" would pass vacuously.
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
   at 1440px.** Report both numbers.

   **Fixture reality — read this before writing any "both sections" check.**
   `defaultLoadCoachMeetingsData` produces **2 Upcoming rows and 0 Past rows**
   (both fixture events have a scheduled session, `:726-741`), so the Past
   section renders an `EmptyState`, **not a second `Table`**. T130's analogous
   test worked only because the outreach fixture is 2 Upcoming + 2 Past. To
   measure anything "across both sections" you must **inject a two-bucket
   fixture into your throwaway rig** — say so in your output. Do not assert
   against a Past table that does not render.
4. **Measured: every collapsed row ≤72px.** Both sections if you injected a
   two-bucket rig fixture (criterion 3); otherwise Upcoming only, stated plainly.
5. **Measured: Edit, the expander, and the per-session Cancel each ≥44px** in
   their smaller dimension, at 1440px and 375px.
6. Expansion splices session rows in and removes them on collapse;
   `aria-expanded` present, `aria-controls` set only while expanded.
7. The canceled `Badge` has a column home; nothing floats.
8. At 375px: **measure the baseline first** — `document.documentElement.scrollWidth`
   on `/meetings` **before** your change — then after. The requirement is **no
   new overflow**; exact equality is the goal but a residual traced to elements
   outside your Allowed Files may be disclosed rather than fixed (T132's
   precedent: it found 603px vs 375px on `/outreach`, traced it to Buttons its
   packet forbade touching, and reported the number rather than rounding up).
   The stacked card column must render every field.
9. Upcoming and Past render through the same `CoachMeetingsSection`, so their
   column widths are byte-identical **by construction**. With the shipped
   fixture only one `Table` exists, so this is **not measurable in the suite** —
   assert it in the rig against an injected two-bucket fixture, or state
   explicitly that it is guaranteed structurally and unmeasured. Do not write a
   test that silently passes because it found one table.
10. `useIsNarrowViewport` is **imported** from `src/hooks/`, not redefined.
11. `StatCell` is imported from `src/components/StatCell.tsx`, unmodified.
12. **Captures at 1440px and 375px, light and dark**, as `.webp` (UXC-13/14).
13. `npx tsc --noEmit`, `npx eslint .`, `npx vite build`,
    `npm run format:check` clean.
14. `npx vitest run` green. Baseline after the merge is **1440 across 62
    files** — confirm that is what you start from, and say so if it is not.
    You are amending assertions, not adding tests, so the expected **end** count
    is also **1440 / 62**. The permitted deltas are exactly the **nine**
    assertions enumerated in Trap 1, the **four** in Trap 3, and the **`:791`
    rewrite mandated in §2** (which spans `:795-806`, not one line) — plus the
    two in Trap 3b if you change the expander wording. That is **fourteen or
    sixteen sites across six tests**. Anything beyond that set is a regression. Any other test that changes is a regression — report it, don't
    silence it. Zero `.skip`/`.only`/`.todo`.

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
- Collapsed row heights, before and after — both sections if you injected a
  two-bucket rig fixture, otherwise Upcoming only, stated plainly (criterion 4).
- Touch-target measurements for Edit, expander, and Cancel, at both viewports.
- The expander wording you chose (Trap 3b) and why, with the expander column
  width that follows from it.
- Every test assertion amended, with before/after text and which Trap
  authorized it.
- The test count you started from and ended with.
- Paths of the four captures.
- Full output of the commands in criteria 13–14.
- Anything unverified, stated plainly as unverified.

Use a throwaway rig for measurements (`*.throwaway.*` is gitignored; Chromium
at `/opt/pw-browsers/chromium-1194/chrome-linux/chrome`; `LoginAs` from
`src/test-utils/authHarness.tsx:131`). **Delete it before finishing.**
