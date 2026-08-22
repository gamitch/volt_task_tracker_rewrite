# GAM-449 worker packet — meetings right-rail month calendar + agenda

Tier: **STANDARD** (item 26). Worker model: `worker-implementer` on its pinned
default — none of item 18's four opus triggers is present (no migration, no RLS
or `security definer`, no metric-view SQL, no auth/session/role logic).

Issue: <https://linear.app/gamitch/issue/GAM-449>
Branch: `claude/gam-449-meetings-rail`. Working tree:
`/home/runner/work/volt_task_tracker_rewrite/volt_task_tracker_rewrite`.

## 1. Allowed files

Create/edit ONLY these three:

- `src/pages/meetings/coach/MeetingsRail.tsx` (exists today as a GAM-444 stub)
- `src/pages/meetings/coach/MeetingsRail.css` (new)
- `src/pages/meetings/coach/MeetingsRail.test.tsx` (new)

**Forbidden, explicitly:** `src/pages/calendar/CalendarPage.tsx`,
`src/lib/meetings/**` (`types.ts`, `format.ts`), `src/theme/volt.ts`,
`src/pages/meetings/coach/CoachMeetingsView.tsx`, `SeriesCard.tsx`,
`SchedulePanel.tsx`, `.github/workflows/**`, `docs/swarm/**`, `.claude/**`.
If the task appears to require one of these, STOP and report it — do not widen.

## 2. Required reading before writing a line

1. `.claude/skills/meetings-design/SKILL.md` — mandatory, the frozen contract.
2. `src/pages/meetings/coach/MeetingsRail.tsx` — the frozen props you implement.
3. `src/lib/meetings/types.ts:78-160` (`CoachMeetingSessionDetail`,
   `CoachMeetingRow`) and `:286-356` (`MeetingsFocusRequest`, `OverlapRef`,
   `OverlapIndex`).
4. `src/lib/meetings/format.ts` — import formatters, never re-derive them.
5. `src/pages/meetings/coach/SeriesCard.tsx` module doc items 2, 5(b) and 6 —
   the merged sibling precedent for Astryx prop discipline, `Badge` use, and the
   still-open series palette.
6. `docs/swarm/astryx-api.md` `# Calendar` section (starts ~:2290) — the ONLY
   legal source of `Calendar` props (constitution item 2 / DES-19).

## 3. Findings already measured by the orchestrator — do not re-litigate, but DO
   report if you find any of them false

**3a. `Calendar` has no per-day render slot, and the four documented theming
attributes cannot express "this day has a meeting."** Verified twice: the
`# Calendar` Theming table documents exactly `data-selected`, `data-today`,
`data-disabled`, `data-in-range` on `astryx-calendar-day`, and the installed
`node_modules/@astryxdesign/core/src/Calendar/Calendar.tsx:984-990`
(`themeProps('calendar-day', {...})`) sets those same four and nothing else. The
day button's body is hard-coded `{dayNumber}` (`:1019`). GAM-441's merged ruling
already binds here: **no per-series colored dots on the grid.** The reference
figure `docs/swarm/figures/ux-craft/redesign-meetings-coach-1440.webp` shows
per-series day dots; **the ruling wins where they differ.**

**3b. The one per-day-unique hook is `data-date={day.iso}`
(`Calendar.tsx:972`), and T045 measured it and REJECTED building on it.**
`CalendarPage.tsx`'s module doc item 1(c) records the rejection in full: marking
days by generating `[data-date="…"]` rules into an injected `<style>` tag is "not
a real composition pattern the component's public surface or Theming table
documents", breaks when `hasOutsideDays`/`hasVariableRowCount` change which dates
render, and is "functionally indistinguishable from hand-rolling the exact
`dayContent` prop the packet says not to invent". **That rejection stands for this
ticket too.** Do not inject a stylesheet, and do not reach into the calendar's DOM
with a `ref` + `querySelectorAll` to stamp your own attributes onto vendor-rendered
nodes — that is the same escalation wearing a different hat.

**3c. So has-meeting day marking uses `dateConstraints` + `data-disabled`, which
ARE documented.** `dateConstraints: Array<(date: Date) => boolean>` is in the
Props table, and Astryx's own Best Practices say "Use dateConstraints to disable
specific dates like weekends or holidays, **and explain why they are
unavailable**." Pass one constraint that returns `true` only for Chicago calendar
dates that have at least one non-canceled session among `rows`. The result: days
with meetings are the selectable, full-contrast cells; days without are
`data-disabled` and dimmed. That is generic has-meeting marking through documented
hooks, exactly as GAM-441's ruling permits, with **no per-series color on the
grid**. The "explain why" obligation is satisfied by a short caption under the
grid — see criterion 4.

**3d. Season-bounded nav needs no custom prev/next.** `Calendar` already computes
`canNavigatePrevious`/`canNavigateNext` from `min`/`max`
(`Calendar.tsx:311-330`) and passes `isDisabled` to its own header arrows
(`:443`, `:460`). Passing `min`/`max` is the whole implementation. **Do not build
a second pair of arrows** — that would be two nav controls for one calendar.

**3e. There is no season-window prop, and you may not add one.**
`MeetingsRailProps` is frozen at four fields. Derive the window from `rows`
themselves: `min` = first day of the month of the earliest `sessionDate` across
all rows, `max` = last day of the month of the latest. Both as `YYYY-MM-DD`.

**3f. The series palette is still an open owner decision.** `--color-series-1…8`
does **not** exist in `src/theme/volt.ts` — grepped, zero hits — and `volt.ts` is
forbidden here. **Do not invent hex values and do not borrow an unrelated token.**
Follow the merged `SeriesCard.tsx` precedent (its module doc item 6): carry the
stable palette index onto the element as `data-series-palette-index={n}` and
render the swatch/dot in its neutral default form, so one CSS rule keyed on
`[data-series-palette-index="N"]` lights everything up once the owner settles the
hues. Say so in a module-doc note.

**3g. No shared palette-index derivation exists yet.** `SeriesCardModel.paletteIndex`
is a declared field but **nothing in `src/` builds a `SeriesCardModel`** (grepped).
So this component must hash `eventId` itself. Per the skill: hash the event id,
**never array position**. Keep the hash in one small exported function at the top
of `MeetingsRail.tsx`, documented as "must be extracted to `src/lib/meetings/` and
shared with the `SeriesCardModel` builder when that lands (follow-up filed)". Two
independent hashes that disagree would give one series two colors on one page.

**3h. `todayIsoChicago` exists only on a forbidden file**
(`CalendarPage.tsx:432`). Define a local one in `MeetingsRail.tsx` using
`Intl.DateTimeFormat('en-CA', { timeZone: 'America/Chicago' })` (the `en-CA`
locale yields `YYYY-MM-DD`), with a doc note that it duplicates that helper and a
follow-up is filed to consolidate into `src/lib/meetings/format.ts`. **Never use
the browser zone**, and never re-derive a Chicago date from a UTC instant — bucket
sessions by the stored `sessionDate` string, as the skill requires.

## 4. Acceptance criteria — each must be a real assertion in
   `MeetingsRail.test.tsx`

1. **Focus emission, exact payload.** Clicking an agenda item calls
   `onFocusChange` exactly once with an object deep-equal to
   `{ eventId, sessionId, monthKey }` for that session, where `monthKey` is the
   session's Chicago `YYYY-MM` . Assert the whole object, not individual fields.
   The component **emits only** — it must not mutate any card, and it must not
   depend on the parent doing anything.
2. **Season-bounded nav.** Assert `min`/`max` are the first/last day of the
   season's first/last session month, and that with `focusDate` on the first
   month the rendered "Previous month" control is disabled, and on the last month
   "Next month" is disabled. (Astryx computes this; the test pins that we passed
   `min`/`max` correctly.)
3. **Agenda ordering.** Days ascending from Chicago-today; within a day, items
   ascending by `startsAt`. Assert with sessions deliberately supplied out of
   order in the fixture, and with two series on one day.
4. **Has-meeting marking is generic and explained.** Assert the day with a
   session is not disabled and a day without one is; assert the caption text
   explaining that only days with meetings are selectable is present. Assert **no
   element inside the calendar grid carries a series color or
   `data-series-palette-index`** — the GAM-441 ruling, pinned as a test.
5. **Legend excludes finished series.** A series whose sessions are all
   completed/canceled (none `scheduled` remaining) does not appear in the legend;
   one with a scheduled session does. Each legend row: swatch carrying
   `data-series-palette-index` + the series title.
6. **Day selection filters, and clears.** Clicking a calendar day narrows the
   agenda to that day; a visible Clear control restores the next-few-days view.
   Assert both directions.
7. **Overlap and canceled badges.** An agenda item whose `sessionId` is a key in
   `overlapIndex` with a non-empty array renders an overlap badge; one absent
   from the index does not. A `status === 'canceled'` session renders a Canceled
   badge. Neutral `Badge`, never `variant="error"` for overlap.
8. **Item content.** Each agenda item shows the time range (from
   `formatTimeRangeWithDuration`, imported — not re-derived), the series dot +
   title, and `"{locationName} · {expectedCt} expected"`, or
   `"attendance recorded"` when the session has an `attendanceSummary`.
9. **Four states (item 12 / DES-12).** Loading, empty, error, populated. `rows`
   is a plain array with no status field, so: **empty** = `rows` is empty (or no
   session remains) → an Astryx `EmptyState` with prescribed copy. Loading and
   error are not expressible through the frozen props — **do not widen the props
   to add them.** Instead render the empty state honestly and record in the
   module doc that loading/error belong to the parent that owns the query, naming
   that as a disclosed gap. Report this in your completion so the orchestrator
   files it.
10. **Item 17 — no urgency mechanics.** No countdown, no timer, no `setInterval`,
    no unit finer than a day, no "don't miss"/streak/scarcity copy. Day headings
    are plain BEH-08 labels: `Today 15`, `Sunday 18`. Assert no timer is
    installed (e.g. with fake timers, advancing time changes no rendered text).
11. **Accessibility.** Agenda items are real `<button>` elements (not clickable
    `<div>`s), each with an accessible name naming the series and its time. The
    legend is not color-only — every swatch is accompanied by the series title as
    text. Keyboard activation works.
12. **No PRD/skill jargon in user-facing copy** (UXC-10): no `GAM-nnn`, no
    `MeetingsFocusRequest`, no `OverlapIndex` in any rendered string.

## 5. Astryx discipline (constitution item 2 — a prop not in
   `docs/swarm/astryx-api.md` is presumed hallucinated → MAJOR)

Every component prop you use must be verifiable in that file. `Card`,
`Badge`, `Button`, `Heading`, `Text`, `VStack`/`HStack`, `EmptyState`,
`VisuallyHidden` all have Props tables there — read them, don't recall them.
Styling escalation per DES-21: component prop → theme token → `xstyle` → custom
CSS. `MeetingsRail.css` is the last rung and is justified here only for the
`astryx-calendar-day` theming hooks and the palette-index seam; keep it small and
put it in `@layer app`. **Never introduce a hex literal for a series hue** (3f).

## 6. Rail geometry

The rail is ~336px wide in the reference figure. Content must not overflow at
that width, and must stack safely narrower. Do not set a fixed pixel width on the
rail root — the parent owns layout.

## 7. What you must NOT do

- Do not reshape `MeetingsRailProps`, `MeetingsFocusRequest`, `CoachMeetingRow`,
  or any other frozen type to fit your component. If one genuinely does not fit,
  STOP and say so.
- Do not build the overlap index. `buildOverlapIndex`/`src/lib/meetings/overlap.ts`
  is GAM-450's and does not exist yet; you consume the `overlapIndex` prop.
- Do not add a page-level overlap banner (owner ruling, skill).
- Do not self-certify. Report the commit SHA your work lands in (item 21).

## 8. Evidence your completion report must carry

- The commit SHA (item 21 — "clean" is not "committed").
- The exact list of files you changed.
- `npm run typecheck`, `npm run lint`, `npm run format:check`, `npm run build`
  and `npx vitest run src/pages/meetings/coach/MeetingsRail.test.tsx` exit codes,
  each reported as the real exit code (never inferred from a pass count).
- One named mutation per criterion 1 and criterion 4: the exact source edit that
  makes that test go red, and the red output. **Commit before mutating, then
  revert and re-verify green** (item 26's fast-tier working rule; item 23 —
  mutate only in your own worktree, never the shared tree).
- Anything in §3 you found to be false.

## 9. Least confident decisions (item 19d — attack these first)

1. **`dateConstraints`-to-disable as the has-meeting marking mechanism (3c).**
   Wrong if disabling most of a month reads as a broken calendar rather than as
   marking, or if it defeats the coach's ability to navigate to and inspect an
   empty day. Astryx's own "Don't disable large blocks of dates without context"
   is the counter-argument; the caption is the mitigation. The fallback, if this
   is judged wrong, is T045's shipped resolution: **no grid marking at all**, and
   has-meeting information lives entirely in the legend and agenda.
2. **Hashing `eventId` locally inside `MeetingsRail.tsx` (3g).** Wrong if a
   sibling ticket has already frozen a hash somewhere I did not find, in which
   case two hashes will disagree and one series will get two colors on one page.
   The grep found no `SeriesCardModel` builder anywhere in `src/`.
3. **Deriving the season window from `rows` (3e).** Wrong if "the season's month
   window" means the `seasons` row's real start/end rather than the span of
   scheduled sessions — a season could begin a month before its first meeting.
   The frozen props carry no season, so this is the only derivation available
   without widening a frozen type.
4. **Rendering only the empty state for the four-states requirement (criterion
   9).** Wrong if item 12 is read as requiring all four *within this component*,
   which would force a props change the skill forbids.
5. **Duplicating `todayIsoChicago` locally (3h).** Wrong if importing it from
   `CalendarPage.tsx` is acceptable — reading a forbidden file is allowed, only
   editing is forbidden — in which case duplication is the worse choice given
   GAM-443 exists precisely to kill duplicated formatters.
