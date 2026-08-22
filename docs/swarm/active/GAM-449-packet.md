# GAM-449 worker packet — meetings right-rail month calendar + agenda

**Round 2.** Round 1 was gated by `checker-premise` and came back **REVISE**
(2 BLOCKER, 6 MAJOR, 6 MINOR, 4 NIT). Every finding is applied below; the ones
that changed the design are marked **[was wrong in round 1]** so you can see what
not to reinvent.

Tier: **STANDARD** (item 26). Worker model: `worker-implementer` on its pinned
default — none of item 18's four opus triggers is present (no migration, no RLS
or `security definer`, no metric-view SQL, no auth/session/role logic).

Issue: <https://linear.app/gamitch/issue/GAM-449>
Branch: `claude/gam-449-meetings-rail`. Working tree:
`/home/runner/work/volt_task_tracker_rewrite/volt_task_tracker_rewrite`
(`node_modules` installed).

## 1. Allowed files

Create/edit ONLY these three:

- `src/pages/meetings/coach/MeetingsRail.tsx` (exists today as a GAM-444 stub)
- `src/pages/meetings/coach/MeetingsRail.css` (new)
- `src/pages/meetings/coach/MeetingsRail.test.tsx` (new)

**Forbidden, explicitly:** `src/pages/calendar/CalendarPage.tsx`,
`src/lib/meetings/**`, `src/theme/volt.ts`, `src/app/SeasonProvider.tsx`,
`CoachMeetingsView.tsx`, `SeriesCard.tsx`, `SchedulePanel.tsx`,
`.github/workflows/**`, `docs/swarm/**`, `.claude/**`.
Forbidden means **uneditable, not unreadable** — read any of them freely.
If the task appears to require *editing* one, STOP and report it. Do not widen.

## 2. Required reading before writing a line

1. `.claude/skills/meetings-design/SKILL.md` — mandatory, the frozen contract.
2. `src/pages/meetings/coach/MeetingsRail.tsx` — the frozen props you implement.
3. `src/lib/meetings/types.ts:78-155` (`CoachMeetingSessionDetail`,
   `CoachMeetingRow`) and `:286-356` (`MeetingsFocusRequest`, `OverlapRef`,
   `OverlapIndex`).
4. `src/lib/meetings/format.ts` — import formatters, never re-derive them.
   `CHICAGO_TIME_ZONE` is exported at `:47`; use it, don't re-literal the string.
5. `src/lib/meetings/coachModel.ts` — `FIXTURE_EVENTS` (`:130`),
   `FIXTURE_SESSIONS` (`:167`), `FIXTURE_ATTENDANCE` (`:219`) and
   `buildCoachMeetingRows` (`:303`) build real `CoachMeetingRow[]`. Prefer them over hand-rolled literals,
   **re-dated relative to your pinned clock** — the shipped fixtures are July
   2026, which is in the past.
6. `src/pages/meetings/coach/SeriesCard.tsx` module doc items 2, 5(b), 6 and
   **8** — the merged sibling precedent for Astryx prop discipline, `Badge` use,
   the still-open series palette, and additive optional props.
7. `src/pages/meetings/coach/SeriesCard.test.tsx:1-35` — **the test harness you
   must copy.** There is no `@testing-library/react` in `package.json`; use the
   raw `createRoot`/`act` pattern with `// @vitest-environment jsdom`.
8. `docs/swarm/astryx-api.md` `# Calendar` (~:2292) — the ONLY legal source of
   `Calendar` props (constitution item 2 / DES-19).
9. Skills to invoke: **`meetings-design` (mandatory)**, `gate-run`,
   `mutation-replay`. The issue also mandates `layout-measurement`; it is
   **inapplicable here and deliberately skipped** — `MeetingsRail` is mounted on
   no route (§9), so there is no URL for a browser to load. GAM-452 already
   carries `layout-measurement` as mandatory and is the ticket that will have
   one. §6 records the same reasoning for the 336px number.

## 3. Findings measured and gated — do not re-litigate, but DO report any you
   find false

**3a. `Calendar` has no per-day render slot.** The Theming table documents
exactly `data-selected`, `data-today`, `data-disabled`, `data-in-range` on
`astryx-calendar-day` (`astryx-api.md:2357`), and the installed
`node_modules/@astryxdesign/core/src/Calendar/Calendar.tsx:984-990` sets those
same four and nothing else. The day button's body is hard-coded `{dayNumber}`
(`:1018-1019`). GAM-441's merged ruling binds: **no per-series colored dots on
the grid.** The reference figure
`docs/swarm/figures/ux-craft/redesign-meetings-coach-1440.webp` shows per-series
day dots; **the ruling wins where they differ.**

**3b. The one per-day-unique hook is `data-date={day.iso}` (`:972`), and T045
measured it and REJECTED building on it.** `CalendarPage.tsx`'s module doc item
1(c) records the rejection in full. That rejection stands here. Do not inject a
generated `<style>` tag, and do not reach into the calendar's DOM with a `ref` +
`querySelectorAll` to stamp attributes onto vendor-rendered nodes.

**3c. [was wrong in round 1] There is NO has-meeting marking on the grid.**
Round 1 prescribed `dateConstraints` to disable non-meeting days so
`data-disabled` would mark them by contrast. **The gate measured that and it is
withdrawn.** For one Mon/Thu series in a single month, **33 of 42 rendered day
cells** go `data-disabled` — each a genuine `disabled` button with
`tabIndex="-1"`. It also makes an empty day unclickable, which the issue never asks for, and it trips
`astryx-api.md:2317`'s own "**Don't:** Disable large blocks of dates without
context".

So this ticket ships **T045's already-shipped resolution**: `Calendar` is used
for its two real documented jobs — month navigation (`focusDate` /
`onFocusDateChange` / `min` / `max`) and day selection (`mode="single"`,
`onChange`) — and **all** has-meeting information lives outside the grid, in the
legend and the agenda. **Pass no `dateConstraints` at all.** This is a disclosed
deviation from the issue's "a month calendar marking which days have meetings":
the marking is not achievable through the documented surface, and §8 requires you
to report it so the orchestrator records it on the PR.

**3d. Season-bounded nav needs no custom prev/next.** `Calendar` derives
`canNavigatePrevious` (`:312-322`) and `canNavigateNext` (`:324-336`) from
`min`/`max` and passes `isDisabled` to its own header arrows (`:443`, `:460`),
which are named "Previous month" and "Next month". Passing `min`/`max` is the
whole implementation. **Do not build a second pair of arrows.** Note the nav
buttons carry the native `disabled` property and `aria-disabled` is `null` on
them — assert the property, not the attribute.

**3e. [corrected in round 1] The season window: two additive optional props,
with a documented fallback.** Round 1 claimed deriving the window from `rows` was
"the only option without widening a frozen type". That was false —
`useActiveSeason()` (`src/app/SeasonProvider.tsx:214`) carries the real
`SeasonRow.startsOn`/`endsOn` (`src/lib/supabase/types.ts:131-132`) and is what
the very precedent the issue cites uses (`CalendarPage.tsx:570`).

**The decision, on stated grounds:** add `seasonStartsOn?: string` and
`seasonEndsOn?: string` as **additive optional props**, and fall back to the
rows-derived session span when they are absent. Grounds: `useActiveSeason()`
*throws* outside a `<SeasonProvider>` and that provider fetches from Supabase, so
consuming it would make a leaf presentation component context-coupled and force
its unit test to stand up a fetching provider. Optional props keep the component
pure and hand GAM-452 — which already resolves the season — the seam to pass the
true window. Additive optional props on this stub are the **merged, checker-passed
GAM-447 precedent** (`SeriesCard.tsx:317-323`, module doc item 8: "additive,
optional props… since `SeriesCard` has no real callers yet"), and they add no
field to any type in `src/lib/meetings/types.ts`, which is what the skill freezes.

`min` = first day of the month of `seasonStartsOn` (or of the earliest
`sessionDate` across `rows`); `max` = last day of the month of `seasonEndsOn` (or
of the latest). Both `YYYY-MM-DD`.

**3f. The series palette is an open owner decision owned by GAM-466.**
`--color-series-1…8` does **not** exist in `src/theme/volt.ts` (zero hits) and
`volt.ts` is forbidden here. **Do not invent hex values and do not borrow an
unrelated token.** Follow the merged `SeriesCard.tsx` precedent (module doc item
6): carry the slot as `data-series-palette-index={n}` and render swatches/dots in
their neutral default form, so one CSS rule keyed on
`[data-series-palette-index="N"]` lights everything up once GAM-466 lands the
hues. The skill calls a missing palette "a blocker to raise, not a gap to fill" —
it is raised: GAM-466 owns it, and §8 requires you to report that this ticket,
titled "with per-series colors", ships every swatch neutral.

**3g. No shared palette-index derivation exists.** `SeriesCardModel.paletteIndex`
(`types.ts:337`) is declared but **nothing in `src/` builds a `SeriesCardModel`**.
So hash `eventId` here — per the skill, hash the id, **never array position**.
Put it in **one exported function** at the top of `MeetingsRail.tsx` so the
extraction has something to move. Divergence is a certainty, not a risk:
`SeriesCard.tsx:388` already consumes a `paletteIndex` that GAM-452's builder will
produce with its own hash. **Follow-up filed: GAM-476** — cite it in the doc note.

**3h. [rationale corrected] `todayIsoChicago` — define a local copy.** It is
*exported* at `CalendarPage.tsx:432`, so "forbidden" is not the reason not to
import it; the reason is that importing a page module drags its Supabase-loader
import graph into a leaf component and its unit test. Define a local
`todayIsoChicago()` using `Intl.DateTimeFormat('en-CA', { timeZone: CHICAGO_TIME_ZONE })`
(`en-CA` is what yields `YYYY-MM-DD`; import `CHICAGO_TIME_ZONE` from
`format.ts:47`). **Follow-up filed: GAM-477** — cite it in the doc note.
Never use the browser zone, and never re-derive a Chicago date from a UTC
instant — bucket sessions by the stored `sessionDate` string.

**3i. `Calendar`'s own `data-today` is browser-zone and may disagree with
Chicago-today by one day.** `plainDateToday()` → `new Date()`
(`node_modules/@astryxdesign/core/src/utils/plainDate.ts:58`), not overridable by
any prop. Measured: with the clock at
`2026-08-22T01:00Z`, Chicago-today is `2026-08-21` while the grid marks
`2026-08-22`. **No test may cross-assert the grid's `data-today` against the
agenda's "Today" heading**, and the rail's own notion of today comes only from
`todayIsoChicago()`.

**3j. [BLOCKER, measured by the round-2 gate] `Calendar`'s day selection CANNOT
be cleared through `value` — use T045's `key` remount.** `effectiveValue = value
!== undefined ? value : internalValue` (`Calendar.tsx:250`), so a click sets an
internal selection and re-rendering with `value={undefined}` falls straight back
to it: the gate clicked 2026-08-12, re-rendered with `undefined`, and measured
`data-selected` still on that cell. `value={null}` does not typecheck
(`ISODateString` is a template-literal type). **The fix is already shipped in
this repo:** `CalendarPage.tsx:724` renders `<Calendar key={calendarResetKey} …>`
and `handleToday`/`handleShowWholeMonth` (`:603`, `:609`) bump that key to
remount the calendar and drop the vendor's internal selection. Do the same.
Without this, Clear and Today reset the agenda while leaving the grid highlighted
on the wrong day — a defect that ships green unless the criteria assert the grid,
which is why criteria 6 and 14 now do.

**3k. `min`/`max`/`focusDate`/`value` are the template-literal type
`ISODateString`, not `string`.** A plain `string` fails `npm run typecheck`,
which §8 gates on. The in-repo answer is the `as ISODateString` cast at
`CalendarPage.tsx:727`.

## 4. Acceptance criteria — each is a real assertion in `MeetingsRail.test.tsx`

**Clock discipline, applying to every criterion below:** pin the clock with
`vi.setSystemTime` at a **mid-day UTC instant** (so UTC-today and Chicago-today
agree and the suite cannot flake in the ~5-6h daily window where they differ),
and build fixtures relative to that instant. Precedent:
`CalendarPage.test.tsx:19-25,328`.

1. **Focus emission, exact payload.** Clicking an agenda item calls
   `onFocusChange` exactly once with an object deep-equal to
   `{ eventId, sessionId, monthKey }`, where `monthKey` is the session's Chicago
   `YYYY-MM` (in-repo authority: `SchedulePanel.tsx:23`). Assert the whole
   object. The component **emits only**.
2. **Season-bounded nav.** `Calendar` reflects `min`/`max` into no DOM
   attribute, so put the window derivation in **one exported function** (as §3g
   does for the hash) and assert *it* returns the first/last day of the window's
   first/last month — covering both prop-supplied (`seasonStartsOn`/
   `seasonEndsOn`) and rows-derived fallback. Then assert the behavioural half
   through the DOM: with `focusDate` in the first month the "Previous month"
   button's native `disabled` **property** is `true`, and in the last month
   "Next month" is (`aria-disabled` is `null` on these — assert the property).
3. **Agenda ordering.** The default agenda is **the next 5 meeting days** from
   Chicago-today (a meeting day is a Chicago calendar date with at least one
   non-canceled session; 5 covers a fortnight of a two-day-a-week series without
   the rail outgrowing the viewport). Pin the number as a named constant and
   assert it — criterion 5's legend rule reads off exactly this window. Days
   ascending from Chicago-today; within a day, items
   ascending by `startsAt`. Fixture supplies sessions deliberately out of order,
   and two series on one day.
4. **[replaces round 1's marking criterion] No grid marking, and no color in the
   grid.** Assert every in-month day inside `min`/`max` is selectable (not
   `disabled`), and that **no element inside the calendar grid carries a series
   color or `data-series-palette-index`** — the GAM-441 ruling, pinned as a test.
   Note when picking cells that outside-days are unconditionally disabled
   (`dayCellUtils.ts:58`), so choose an in-month day inside the window.
5. **Legend.** Each row is a swatch carrying `data-series-palette-index` plus the
   series title as text. A series with a `scheduled` session remaining appears; a
   fully completed/canceled one does not — **unless** it has an item in the
   currently visible agenda (see criterion 6), in which case it appears, so no
   agenda dot is ever unlegended.
6. **Day selection filters, and clears.** Clicking a calendar day narrows the
   agenda to that day; a visible Clear control restores the default view.
   Assert both directions, and that Clear emits `onFocusChange(null)` (day
   selection and focus are the same in-memory concern). **Also assert that after
   Clear, no `button[data-date]` inside the grid carries `data-selected`** — per
   §3j this only holds if you remount via `key`, and without the assertion the
   defect ships green.
7. **Overlap and canceled badges.** An agenda item whose `sessionId` is a key in
   `overlapIndex` with a non-empty array renders an overlap badge; one absent
   does not. A `status === 'canceled'` session renders a Canceled badge. Neutral
   `Badge`, never `variant="error"` for overlap.
8. **Item content.** Time range from `formatTimeRangeWithDuration`
   (`format.ts:157`) — imported, not re-derived — the series dot + title, and
   `"{locationName} · {expectedCt} expected"`, or `"attendance recorded"` when
   the session has an `attendanceSummary`. Note `locationName` is a **series**
   field (`types.ts:111`), so every session in a series shows the same location;
   that is correct, not a bug.
9. **[revised] All four DES-12 states, as real assertions.** Add
   `isLoading?: boolean` and `errorMessage?: string` as **additive optional
   props**, exactly as the merged GAM-447 precedent did
   (`SeriesCard.tsx:317-323`, module doc item 8). Assert: loading (with
   `aria-busy` and a `role="status"` announcement, per that precedent), error
   (the message rendered), empty (`rows` empty or no session remains → Astryx
   `EmptyState` with prescribed copy), and populated. Round 1's "record it as a
   disclosed gap instead" reversed passed work and is withdrawn.
10. **Item 17 — no urgency mechanics.** No countdown, no timer, no
    `setInterval`, no unit finer than a day, no scarcity/streak/loss copy. Day
    headings are plain BEH-08 labels: `Today 15`, `Sunday 18`. Assert with fake
    timers that advancing time changes no rendered text.
11. **Accessibility.** Agenda items are real `<button>` elements, each with an
    accessible name naming the series and its time. The legend is never
    color-only — every swatch is accompanied by its title as text. For keyboard,
    use `SeriesCard.test.tsx:19-29`'s recorded formulation (assert
    `tagName === 'BUTTON'`, that focus lands on it, and that a dispatched click
    activates it) — jsdom does not simulate native Enter/Space activation.
12. **No jargon in user-facing copy** (UXC-10): no `GAM-nnn`,
    `MeetingsFocusRequest`, `OverlapIndex`, or `SeriesCardModel` in any rendered
    string.
13. **[new] The frozen `focus` prop is exercised.** When `focus` names a
    session, that agenda item is marked current (`aria-current`) and its day/month
    is the one shown; when `focus` is `null`, nothing is marked. Without this a
    worker could `void focus` and pass every other criterion.
14. **[new] The "Today" control.** The issue requires "prev/next + 'Today'
    controls" and `Calendar` renders only the two arrows. Ship a Today control
    that returns `focusDate` to Chicago-today and clears any day selection
    (precedent: `CalendarPage.tsx:603`'s `handleToday`, which bumps the reset
    key). Assert both halves: the agenda returns to the default view, **and no
    `button[data-date]` inside the grid carries `data-selected`** (§3j).

## 5. Astryx discipline (item 2 — a prop not in `docs/swarm/astryx-api.md` is
   presumed hallucinated → MAJOR)

Every prop must be verifiable in that file. Read the Props tables; do not recall
them. Styling escalation per DES-21: component prop → theme token → `xstyle` →
custom CSS. `MeetingsRail.css` is the last rung; keep it small and put it in
`@layer app`. It is justified for exactly three things: the palette-index seam
(3f), rail layout (§6), and **the day-cell theming the issue explicitly asks
for** — `astryx-calendar-day` with `data-today` / `data-selected`. That last part
IS achievable and is not dropped: §3c withdraws only *has-meeting* marking, which
those hooks cannot express. Styling today and the selected day through them is
the documented use of the documented surface, and it recovers the visible half of
the issue's "The one constraint".
**Never introduce a hex literal for a series hue** (3f).

## 6. Rail geometry

The rail is ~336px wide in the reference figure. Content must not overflow at
that width and must stack safely narrower. **Do not set a fixed pixel width on
the rail root** — the parent owns layout. This is a design constraint on how you
write the CSS (wrap long titles, no `min-width` floors on flex children), not a
criterion you can measure in jsdom; do not write a test that pretends to.

## 7. What you must NOT do

- Do not reshape `MeetingsFocusRequest`, `CoachMeetingRow`, `OverlapIndex`, or
  anything else in `src/lib/meetings/types.ts`. The additive optional props in
  §3e and criterion 9 are on `MeetingsRailProps` only, and they are the merged
  GAM-447 pattern — nothing else may be added, and no existing prop may change.
- Do not build the overlap index — `src/lib/meetings/overlap.ts` is GAM-450's and
  does not exist yet. You consume the `overlapIndex` prop.
- Do not add a page-level overlap banner (owner ruling, skill).
- Do not pass `dateConstraints` (3c).
- Do not self-certify. Report the commit SHA your work lands in (item 21).

## 8. Evidence your completion report must carry

- The commit SHA (item 21 — "clean" is not "committed").
- The exact list of files you changed.
- `npm run typecheck`, `npm run lint`, `npm run format:check`, `npm run build`
  and `npx vitest run src/pages/meetings/coach/MeetingsRail.test.tsx` — each as
  the **real exit code**, never inferred from a pass count. Use the `gate-run`
  skill.
- **One named mutation each for criteria 1, 4 and 13**: the exact source edit
  that turns that test red, and the real red output. **Commit before mutating,
  then revert and re-verify green** (item 26's fast-tier working rule; item 23 —
  mutate only in your own worktree, never the shared tree).
- **Three things to report explicitly so the orchestrator can record them on the
  PR**: (a) the grid ships with no has-meeting marking (3c) and why; (b) every
  swatch ships neutral because GAM-466 owns the hues (3f); (c) the local hash and
  `todayIsoChicago` copies, citing GAM-476 and GAM-477; and **(d)** that
  `MeetingsRail` now accepts `seasonStartsOn?`/`seasonEndsOn?` and, without them,
  the window silently falls back to the rows' session span. (d) matters because
  GAM-452's live description names no season window and does not list
  `MeetingsRail.tsx` in its file table — optional props raise no compile error,
  so GAM-452 as written will not pass them and "season-bounded" would quietly
  become "session-span-bounded". The orchestrator records this on GAM-452 before
  GAM-452 is dispatched; it is still `Backlog`, so it costs nothing now and is
  unrecoverable later.
- Anything in §3 you found to be false.

## 9. Closing status — this ticket closes **Partial**, not Passed

Constitution item 27. `MeetingsRail` has **zero importers repo-wide**: it is not
mounted on any route and no user can reach it today. GAM-452 is the integration
ticket and its own description says "Until this merges, every component ticket in
the group is `Partial` by definition." Do not report the rail as a live surface.

## 10. Least confident decisions (item 19d)

1. **Additive optional `seasonStartsOn`/`seasonEndsOn` (3e).** Wrong if GAM-452
   is already written to construct `MeetingsRail` with exactly four props and
   would not know to pass them — in which case every rail silently falls back to
   the session span and "season-bounded" is a fiction. The fallback is honest and
   labelled, but it is a fallback.
2. **Shipping no grid marking at all (3c).** Wrong if the owner reads "a month
   calendar marking which days have meetings" as the ticket's point rather than
   one of its features, in which case the right outcome is to stop and escalate
   rather than ship a calendar that only navigates. The gate measured the
   alternative and it was worse; T045 reached the same conclusion independently.
3. **Legend includes finished series that appear in the visible agenda
   (criterion 5).** Wrong if it makes the legend churn as the coach pages through
   months. The alternative — a legend fixed to active series, with unlegended
   dots on past days — was judged worse.
4. **Hashing `eventId` locally (3g).** Wrong if a sibling has already frozen a
   hash somewhere the grep missed, in which case one series gets two colors.
   GAM-476 is filed against exactly this.
