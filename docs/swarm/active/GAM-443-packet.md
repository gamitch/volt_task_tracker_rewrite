# GAM-443 — task packet (HEAVY)

Issue: <https://linear.app/gamitch/issue/GAM-443/meeting-datetime-formatters-are-duplicated-between-meetingslist-and>
Branch: `claude/gam-443-meetings-format-extract`
Tier: **HEAVY** — item 26 trigger *"an export another session builds against"*.
Author: orchestrator (Claude). Every citation below was re-read against this
branch's `main`-equal tree, not taken from the issue (item 19c).

## Goal

One shared home for the meeting date/time formatters, so the five parallel
`meetings-redesign` components import instead of copying a third time — plus
one new pure function, `buildScheduleChips`, whose signature GAM-441 will
freeze into `types.ts`.

## Verified state (orchestrator re-read, 2026-08-21)

| Claim | Verdict |
| -- | -- |
| Formatter block in `MeetingsList.tsx` | **Confirmed** at lines **1278–1393**, not 1278–1399 |
| `CalendarPage.tsx` re-implements the formatters | **Confirmed** — `parseDateOnly` :336, `formatWeekdayDate` :442, `formatDuration` :447, `splitMeridiem` :462, `formatTimeRangeWithDuration` :469, plus its own `CHICAGO_TIME_ZONE`/`WEEKDAY_DATE_FORMATTER`/`CLOCK_TIME_FORMATTER` at :406–:426 |
| Both copies pinned to `America/Chicago` | **Confirmed** (NFR-09) |
| Existing tests pin the behaviour | **Confirmed** — `MeetingsList.test.tsx` :350/:356/:377/:389; `CalendarPage.test.tsx` :297/:301, importing from the page modules |
| `src/lib/meetings/` exists | **Confirmed** — holds `resolveCurrentStudentId.ts` only |

### Three corrections to the issue — act on these, do not inherit them

1. **The issue's range 1278–1399 over-reaches by six lines.**
   `formatPastAttendanceSummary` (:1395–1399) is an attendance-summary string
   builder, **not** a date/time formatter. It must **stay** in
   `MeetingsList.tsx`. Moving it is a defect, not a bonus.

2. **The issue's move list omits `sessionDurationHours` (:1334)**, a private
   helper that sits inside the block and calls `computeDurationMinutes`. Its
   sole caller is `MeetingsList.tsx:1075`. **Decision: move it with the block**
   and export it from `format.ts`, so `computeDurationMinutes` stays private to
   one module and there remains exactly one duration formula (which is what the
   :1312–1315 comment exists to protect). Splitting them would leave
   `computeDurationMinutes` exported purely to serve one caller.

3. **The acceptance criterion "no duplicate formatter bodies remain anywhere
   under `src/pages/`" is NOT achievable inside this packet's Allowed Files,
   and is hereby narrowed.** Measured: `parseDateOnly` has **14** definitions
   under `src/`, and `splitMeridiem` has a **third** copy in
   `src/pages/meetings/LiveConsole.tsx:746`. Full list of the out-of-scope
   copies: `weekly-digest.tsx:287`, `EventsTab.tsx:894`, `ParentHome.tsx:1118`,
   `ScheduleMeetingsDialog.tsx:348` (explicitly Forbidden by the issue),
   `StudentMeetingView.tsx:632`, `LiveConsole.tsx:746`, `OutreachList.tsx:1579`,
   `ParentRsvp.tsx:403`, `AttendancePanel.tsx:503`, `OutreachDetail.tsx:1427`,
   `SelfCheckoffDialog.tsx:264`, `OutreachEventDialog.tsx:695`,
   `RsvpControl.tsx:369`, `MarkDayCompleteDialog.tsx:864`, `KpiStrip.tsx:449`.
   **Narrowed criterion: no duplicate body of the six named formatters remains
   in `MeetingsList.tsx` or `CalendarPage.tsx`.** The wider sprawl becomes an
   item-20 follow-up filed by the orchestrator before this PR opens.

## Allowed Files

- `src/lib/meetings/format.ts` (new)
- `src/lib/meetings/format.test.ts` (new)
- `src/pages/meetings/MeetingsList.tsx` (delete the moved block; re-export)
- `src/pages/calendar/CalendarPage.tsx` (delete duplicates; import)
- `src/pages/calendar/CalendarPage.test.tsx` (import path only, if needed)

**Forbidden:** `src/pages/meetings/ScheduleMeetingsDialog.*`,
`src/pages/meetings/LiveConsole.tsx`, `src/lib/supabase/**`, `docs/swarm/**`,
`.claude/**`, `.github/workflows/**`, and every other `parseDateOnly` site
listed in correction 3. `MeetingsList.test.tsx` should need **no** edit —
if it does, say so rather than editing around it.

## What to build

1. **Create `src/lib/meetings/format.ts`** and **move** (cut, not copy) from
   `MeetingsList.tsx:1278–1393`: `CHICAGO_TIME_ZONE`, the three
   `Intl.DateTimeFormat` instances, `parseDateOnly`, `formatWeekdayDate`,
   `computeDurationMinutes`, `formatDuration`, `sessionDurationHours`,
   `formatHoursLabel`, `buildRecurrenceChips`, `buildDateRangeLabel`,
   `splitMeridiem`, `formatTimeRangeWithDuration`. Bodies **byte-identical** —
   this is code motion, not a rewrite. Keep the existing doc comments with the
   code they document. Give the file a module doc in this repo's `@file /
   @input / @output / @position` house style (see `src/lib/format/dates.ts`).

2. **`MeetingsList.tsx`**: delete the moved block, import what it uses, and
   **re-export** the six public names so `MeetingsList.test.tsx` and any other
   importer keep working unchanged. `formatPastAttendanceSummary` stays.

3. **`CalendarPage.tsx`**: delete `parseDateOnly`, `formatWeekdayDate`,
   `formatDuration`, `splitMeridiem`, `formatTimeRangeWithDuration` and the now
   unused formatter constants; import from `../../lib/meetings/format`.
   **Keep** `CHICAGO_DATE_ONLY_FORMATTER`, `MONTH_YEAR_FORMATTER`,
   `todayIsoChicago`, `monthLabel` — calendar-specific, out of scope. If
   `CHICAGO_TIME_ZONE` is still needed locally, import it rather than
   redeclaring it. `CalendarPage.tsx` must still **re-export**
   `formatWeekdayDate`/`formatTimeRangeWithDuration`, because
   `CalendarPage.test.tsx:48–49` imports them from it.
   **Update module doc #5** (:143–157): it currently explains that these were
   reimplemented *because `src/pages/meetings/**` was Forbidden in that task*.
   That reason is now gone; the doc must say they are imported, or it becomes a
   comment that lies about the code beneath it.

4. **Add `buildScheduleChips(rules)`** — new, in `format.ts`, with tests.

   ```ts
   export interface ScheduleRule {
     /** 0 = Sunday … 6 = Saturday, matching `Date.prototype.getDay()`. */
     dow: number;
     /** Minutes from local (America/Chicago) midnight. 0–1439. */
     startMinutes: number;
     endMinutes: number;
   }
   export function buildScheduleChips(rules: readonly ScheduleRule[]): string[];
   ```

   Output: one chip per rule, in input order, e.g.
   `["Tue 6–8 PM", "Sun 3:30–6:30 PM"]`.
   - Weekday: three-letter title-case abbreviation (`Tue`, `Sun`) — **not** the
     upper-case form `buildRecurrenceChips` uses; these are different chips.
   - `:00` minutes are dropped (`6–8 PM`, never `6:00–8:00 PM`); non-zero
     minutes are kept zero-padded (`3:30`).
   - A meridiem shared by both ends is written **once, at the end** — the same
     collapse `formatTimeRangeWithDuration` already performs. When the ends
     straddle noon/midnight, both meridiems appear (`11–1 PM` is wrong;
     `11 AM–1 PM` is right).
   - En dash `–` between the times, matching the existing formatter.
   - Empty input → `[]`.
   - **Document the input-shape choice in the module doc**, naming it as the
     shape GAM-441 will freeze into `types.ts`.

   `dow` is deliberately **not** derived from a `Date`, so this function needs
   no timezone at all — the weekday is data, not a computation. Use a plain
   frozen `['Sun','Mon',…]` lookup rather than an `Intl.DateTimeFormat`, and
   say why in a comment.

## Acceptance criteria

1. `src/lib/meetings/format.ts` exists and is the **only** definition of the
   six named formatters plus `parseDateOnly`/`splitMeridiem`/
   `computeDurationMinutes` in `MeetingsList.tsx` and `CalendarPage.tsx`
   (narrowed criterion, correction 3).
2. `MeetingsList.test.tsx` passes **unedited**.
3. `CalendarPage.test.tsx:297–303` still passes.
4. Every `Intl.DateTimeFormat` in `format.ts` carries
   `timeZone: 'America/Chicago'` (NFR-09). Grep it and paste the result.
5. `buildScheduleChips` is unit-tested for: the two-rule split-time case
   (`Tue 6–8 PM` + `Sun 3:30–6:30 PM`), a single-day series, an empty array,
   and a **meridiem-straddling** range (e.g. 11:00–13:00 → `11 AM–1 PM`).
6. `formatPastAttendanceSummary` is still in `MeetingsList.tsx`.
7. Six gates green via the `gate-run` skill; total test count **≥** baseline.
8. **`mutation-replay`**: prove at least two moved formatters are still
   guarded. Named mutations — (a) in `format.ts`, change
   `formatTimeRangeWithDuration`'s meridiem collapse so `startText` is always
   `startFormatted`, and show a `MeetingsList.test.tsx` case going red;
   (b) change `WEEKDAY_DATE_FORMATTER`'s `timeZone` to `'UTC'` and show a test
   going red. Commit before mutating, revert, re-verify green (item 26's
   fast-tier working rule, which applies to any mutation).

## Least confident decisions (item 19d)

1. **`sessionDurationHours` moves with the block** (correction 2). Wrong if
   `format.ts` should stay purely presentational — it returns a number, not a
   string, and a reviewer could reasonably call it domain logic that belongs
   beside its one caller.
2. **`buildScheduleChips` takes `{dow, startMinutes, endMinutes}` rather than a
   session-derived shape.** Wrong if the redesign's real call sites only ever
   hold `{startsAt, endsAt}` ISO instants — then every caller would have to
   convert to Chicago wall-clock minutes first, which is exactly the
   error-prone step this module should own. I chose minutes because the chips
   describe a *recurring rule*, not an instant, and an instant-shaped input
   would force a timezone conversion with no date to convert against.
3. **Re-exporting from `MeetingsList.tsx` rather than repointing its test.**
   Wrong if the repo dislikes re-export shims; the alternative is editing
   `MeetingsList.test.tsx`'s import list, which the issue explicitly permits.
   I preferred the shim because it keeps the diff a pure move and leaves the
   3,490-line test file untouched.
4. **The narrowed criterion in correction 3.** Wrong if the owner intended
   GAM-443 to absorb the whole 14-copy `parseDateOnly` sprawl — that would be a
   much larger ticket touching outreach, reports, home and email templates, and
   it is not what the Allowed Files describe.
5. **Title-case `Tue` for schedule chips vs upper-case `TUE` for recurrence
   chips.** Wrong if the approved design shows one casing for both; I have the
   issue's `["Tue 6–8 PM", …]` example and UXD-02's `"MON (18)"` example, and
   they disagree, so I followed each example for its own function.
