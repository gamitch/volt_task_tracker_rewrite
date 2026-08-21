# GAM-443 — task packet (HEAVY)

Issue: <https://linear.app/gamitch/issue/GAM-443/meeting-datetime-formatters-are-duplicated-between-meetingslist-and>
Branch: `claude/gam-443-meetings-format-extract`
Tier: **HEAVY** — item 26 trigger *"an export another session builds against"*.
Author: orchestrator (Claude). Every citation below was re-read against this
branch's `main`-equal tree, not taken from the issue (item 19c).

**Revision 2**, after `checker-premise` round 1 returned REVISE (1 BLOCKER,
2 MAJOR, 5 MINOR, 1 NIT). Every finding is incorporated below; the changes are
marked **[R2]**. The gate confirmed every citation in the Verified state table
as exact except the `parseDateOnly` count, and it built the whole prescribed
move in its own worktree and measured it green — so the prescription below is
known-feasible, not merely believed to be.

**Revision 3**, after `checker-premise` round 2 returned REVISE (2 MAJOR,
8 MINOR, 1 NIT, **no BLOCKER**). Changes are marked **[R3]**. Round 2 also
built every prescription and measured it green (`tsc --noEmit` exit 0, 141/141
scoped with **both test files untouched**, 0 eslint errors), and it executed
both prescribed mutations against the **real post-move `format.ts`** rather
than against the pre-move tree — which is how it caught MAJOR-1.

**Both of round 2's MAJORs were defects in how a criterion was *worded*, not in
what this packet asks for, and the gate supplied measured replacement text for
all eleven findings; revision 3 transcribes it.** Item 19a's two gate rounds
are now spent, so this revision is **not** re-submitted for a round 3 — see
`GAM-443-run-log.md`, 11:38Z, for the decision and the four reasons behind it.
Worker: the two mutation counts below are re-measured by you under
`mutation-replay`, and a separate `checker-reviewer` grades this packet's
criteria against your actual output — so if a transcription here is wrong, it
surfaces as a failed criterion. **Report what you measure. Do not bend a
measurement to match a number written here** — that is the exact failure round
1 classified as a BLOCKER.

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
   and is hereby narrowed.** **[R2 — corrected count.]** Measured:
   `parseDateOnly` has **16** definitions under `src/` (**14** of them under
   `src/pages/`), and `splitMeridiem` has a **third** copy. My round-1 number
   was the `src/pages/` count mislabelled as the `src/` count.

   - The **14 out-of-scope `parseDateOnly` sites**: `EventsTab.tsx:894`,
     `ParentHome.tsx:1118`, `ScheduleMeetingsDialog.tsx:348` (Forbidden),
     `StudentMeetingView.tsx:632`, `OutreachList.tsx:1579`, `ParentRsvp.tsx:403`,
     `AttendancePanel.tsx:503`, `OutreachDetail.tsx:1427`,
     `SelfCheckoffDialog.tsx:264`, `OutreachEventDialog.tsx:695`,
     `RsvpControl.tsx:369`, `MarkDayCompleteDialog.tsx:864` — plus the two that
     are **not** under `src/pages/` and were therefore never inside the
     original criterion's scope at all: `src/emails/templates/weekly-digest.tsx:287`
     and `src/components/kpi/KpiStrip.tsx:449`.
   - The **one out-of-scope `splitMeridiem` site**: `LiveConsole.tsx:746`
     (Forbidden). It has **no** `parseDateOnly` — it is a different formatter
     and is listed separately for that reason.

   **Narrowed criterion: no duplicate body of the six named formatters remains
   in `MeetingsList.tsx` or `CalendarPage.tsx`.** The wider sprawl becomes an
   item-20 follow-up filed by the orchestrator before this PR opens.

   **[R3] The follow-up's scope also names `OutreachList.tsx:1642`
   `buildWeekdayChips`** — a **fourth** copy of the recurrence-chip logic (an
   object-returning variant of `buildRecurrenceChips`, with its own
   `WEEKDAY_ABBREVIATIONS` at `:1633`), found by round 2. Out of scope for this
   packet; the follow-up previously covered only the `parseDateOnly` /
   `splitMeridiem` sprawl and would have missed it.

4. **[R2] `src/lib/format/dates.ts` already exists, and this packet must say
   why it is not the home for this code.** Its module doc (`:5–12`) states the
   same problem GAM-443 states — *"~15 near-duplicate `Intl.DateTimeFormat`
   call sites existed across page modules… This file consolidates the ONE
   correct pattern"* — and the gate measured `formatFriendlyDate`
   (**[R3]** declared at `:36`, not `:37`, which is its `return`) as
   **output-identical to `formatWeekdayDate`: 0 divergences over 800
   consecutive days** (independently re-measured 0/800 in round 2). A de-duplication packet may not silently create a second
   shared home for date formatting; that is how the 16-copy sprawl started.

   **Decision, to be recorded in `format.ts`'s own `@position` block:** they
   stay separate modules, because they serve two different timezone regimes.
   `dates.ts` pins `timeZone: 'UTC'` deliberately (`:41`, with `:17–27`
   explaining that a bare SQL `date` must not shift), and reads a bare date.
   `format.ts` pins `America/Chicago` per NFR-09 and composes duration and
   meridiem logic over real instants. Merging them would put two contradictory
   timezone defaults in one file.

   **[R3] The sentence to write is corrected — round 1's version misdescribed
   `dates.ts`, and this text is *prescribed* for `format.ts`'s `@position`
   block, so writing it unchanged would order a worker to commit a comment that
   lies about another module.** `dates.ts:42` does `new Date(dateOnly)`, which
   anchors at **UTC midnight — the day boundary exactly**; its safety comes
   from formatting in the *same* zone (`:41`), not from anchoring away from the
   boundary. Write this instead:

   > The identical output today is **not** a shared contract. It is a
   > coincidence of each module pairing its anchor with a formatter timezone in
   > which that anchor cannot cross a day boundary — `dates.ts` anchors at UTC
   > midnight (`dates.ts:42`, `new Date(dateOnly)`) and formats in UTC (`:41`,
   > zero offset, no shift possible); `format.ts` anchors at noon UTC and
   > formats in Chicago (UTC−5/−6, still the same calendar day). Change either
   > half of either pair and they diverge.

## Allowed Files

- `src/lib/meetings/format.ts` (new)
- `src/lib/meetings/format.test.ts` (new)
- `src/pages/meetings/MeetingsList.tsx` (delete the moved block; re-export)
- `src/pages/calendar/CalendarPage.tsx` (delete duplicates; import)
- `src/pages/calendar/CalendarPage.test.tsx` — **[R2] should need no edit at
  all.** The gate ran the full move with this file untouched: 141/141 green,
  because prescription 3's re-export keeps `:48–49` resolving. Listed only so
  you are not blocked if something surprises you; if you touch it, say why.

### [R2] Explicit export list for `format.ts`

"Byte-identical" motion and "`CalendarPage` must import `parseDateOnly`" were
in tension, because `parseDateOnly`, `CHICAGO_TIME_ZONE` and
`sessionDurationHours` are currently **not** exported. **Adding an `export`
keyword is the one permitted deviation from byte-identical.** The list, as
built and verified green by the premise gate:

- **Exported:** `CHICAGO_TIME_ZONE`, `parseDateOnly`, `formatWeekdayDate`,
  `formatDuration`, `sessionDurationHours`, `formatHoursLabel`,
  `buildRecurrenceChips`, `buildDateRangeLabel`, `formatTimeRangeWithDuration`,
  `buildScheduleChips`, `ScheduleRule`, **[R3]** `Dow` (the code block in
  prescription 4 declares `export type Dow` and `ScheduleRule.dow` depends on
  it; round 1's list omitted it).
- **Private:** `computeDurationMinutes`, `splitMeridiem`, and all three
  `Intl.DateTimeFormat` instances.

`CHICAGO_TIME_ZONE` **is** still needed by `CalendarPage.tsx` — `:409` and
`:431` use it for `CHICAGO_DATE_ONLY_FORMATTER` and `MONTH_YEAR_FORMATTER`,
which stay. Import it; do not redeclare it.

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
   Re-export shims are established practice here — `src/pages/no-access/index.ts:9`,
   `src/pages/accept-invite/index.ts:10`, `src/lib/supabase/index.ts:40`.

   **[R2] Its module doc now lies about its own code in four places, and all
   four must be fixed** — this is the same defect prescription 3 catches in
   `CalendarPage.tsx`, and round 1's packet applied the standard to only one of
   the two files:
   - **[R3]** `:96–**104**` (not `:96–102`, which truncates the quoted sentence
     mid-clause) — "`formatWeekdayDate` … and `formatTimeRangeWithDuration` …
     are the ONLY date-formatting functions **in this file**… Both
     `Intl.DateTimeFormat` instances are pinned to…". **[R3] While you are
     here, that doc also says "Both" where the file actually holds *three*
     `Intl.DateTimeFormat` instances (`:1280`, `:1287`, `:1295`) — fix the
     count too, since you are rewriting the sentence anyway.**
   - `:390–392` — "factored into one shared `computeDurationMinutes` helper so
     there is exactly one duration formula **in this file**, not two"
   - `:407–409` — "`buildDateRangeLabel` reuses `formatWeekdayDate` verbatim
     (… still the ONLY weekday-date formatter **in this file**)"
   - `:1273–1276` — the section banner, "module doc #4. The ONLY date-formatting
     functions in this file."

   **[R2] Also rewrite the moved doc comments for their new home.** Several say
   "in this file" or cite "T122 (module doc #10a/#10b)" — `format.ts` has no
   module doc #10. Keep the *content* (it explains real constraints); repoint
   the *references*.

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

   **[R2] The round-1 spec was underspecified in five places and is replaced
   wholesale.** The gate confirmed the meridiem rule was correct and
   self-consistent, but found that two workers would still produce different
   output at midnight, noon, and every malformed input. This is the shape
   GAM-441 freezes into `types.ts`, so it is specified to the point of having
   exactly one legal implementation.

   ```ts
   /** 0 = Sunday … 6 = Saturday, matching `Date.prototype.getDay()`. */
   export type Dow = 0 | 1 | 2 | 3 | 4 | 5 | 6;

   export interface ScheduleRule {
     dow: Dow;
     /** Minutes from America/Chicago midnight. Integer, 0–1439. */
     startMinutes: number;
     /** Minutes from America/Chicago midnight. Integer, 1–1440;
      *  1440 means "midnight ending this day". Must be > startMinutes. */
     endMinutes: number;
   }
   export function buildScheduleChips(rules: readonly ScheduleRule[]): string[];
   ```

   Output: one chip per rule, in input order.

   - **Weekday**: three-letter title-case abbreviation (`Tue`, `Sun`) — **not**
     `buildRecurrenceChips`'s upper-case `TUE`. These are different chips with
     independent PRD backing, so this is settled rather than a judgement call:
     the schedule form is title-case in the wireframes at
     `docs/swarm/VOLT_Portal_PRD.md:153`, `:420`, `:514` (`Tue · Build Mtg  6–8 PM`);
     the recurrence form is upper-case at `docs/swarm/VOLT_Portal_PRD_v2.md:58–59`
     (`"MON (18) · THU (18)"`).
   - **Hour conversion is `((h + 11) % 12) + 1`**, so `0 → 12 AM` and
     `720 → 12 PM`. A worker using `h % 12` would write `12–3 AM` as
     `0–3 AM`; that is wrong. Midnight and noon are the only two points where
     the two formulas diverge, which is why both are named tests below.
   - **[R3 — MAJOR-2, replaced. The round-2 text contradicted itself here and
     was therefore satisfiable by two different implementations.]**
     **Meridiem** is `AM` for `minutes < 720` and `PM` for
     `720 <= minutes < 1440`. **`1440` is a special case: it is the midnight
     that *ends* the day, and renders as `12 AM`** — it must **not** fall
     through to the `>= 720` branch, which would print the false `12 PM`. Hour
     text for `1440` is `12` via `((24 + 11) % 12) + 1`; its minutes are `0`
     and are therefore dropped.

     Why this is a MAJOR and not a wording nit: round 1's rule said `PM` for
     `minutes >= 720` and then, in the very next sentence, that `1440` renders
     `12 AM`. `1440 >= 720`, so a 10 PM–midnight rule
     (`{dow:1, startMinutes:1320, endMinutes:1440}`) renders **`Mon 10–12 PM`**
     under the general rule and **`Mon 10 PM–12 AM`** under the special case.
     The first is exactly the "silent lie on screen" this prescription's own
     `RangeError` rationale exists to prevent — and `1440` is *explicitly legal
     input*. `{dow:6, startMinutes:0, endMinutes:1440}` diverges the same way
     (`Sat 12 AM–12 PM` vs `Sat 12–12 AM`). Criterion 5 now covers it.
   - `:00` minutes are dropped (`6–8 PM`, never `6:00–8:00 PM`); non-zero
     minutes are kept zero-padded to two digits (`3:30`).
   - A meridiem shared by both ends is written **once, at the end** — the same
     collapse `formatTimeRangeWithDuration` performs. When the ends straddle
     noon or midnight, both appear: `11–1 PM` is wrong, `11 AM–1 PM` is right.
   - En dash `–` between the times, matching the existing formatter.
   - Empty input → `[]`.

   **Malformed input — decided, not left open.** `buildScheduleChips` is a pure
   presentation helper, and a chip reading `Tue 8–6 PM` or `undefined 6–8 PM`
   is a silent lie on screen. So it **throws a `RangeError`** naming the
   offending field for: `dow` not an integer in `0..6`; `startMinutes` not an
   integer in `0..1439`; `endMinutes` not an integer in `1..1440`; or
   `endMinutes <= startMinutes`. **A rule spanning midnight is therefore not
   representable and is out of scope** — say so in the module doc, because
   GAM-441 needs to know the shape cannot express it.

   **[R2] The function must contain no `Date` and no `Intl` at all** — pure
   integer arithmetic plus a frozen `['Sun','Mon',…]` array. **[R3] That shape
   is already shipped in this repo — copy it rather than inventing one:**
   `src/pages/outreach/OutreachList.tsx:1633` declares
   `const WEEKDAY_ABBREVIATIONS = ['SUN','MON','TUE','WED','THU','FRI','SAT'] as const;`
   and indexes it at `:1645`. Note it is **upper-case** there and must be
   **title-case** here (`Tue`, not `TUE`) — the two chip forms have independent
   PRD backing, cited above, so make the divergence a deliberate, commented
   contrast rather than an accident a later reader "fixes". This is stronger
   than round 1's "no `Intl` for the weekday", and the reason is NFR-09: CI
   runs with `Intl.DateTimeFormat().resolvedOptions().timeZone === 'UTC'` and
   nothing pins `TZ`, so an implementation using a `Date` plus a formatter with
   no `timeZone` option would render in the viewer's local zone, pass green in
   CI, and be wrong for a Chicago viewer on a DST-transition day. A rule is
   recurring data, not an instant; it needs no timezone, so it must not touch
   one.

   **Document the input-shape choice in the module doc**, naming it as the
   shape GAM-441 will freeze into `types.ts`, and saying why minutes-from-
   midnight rather than ISO instants: a recurring rule has no date to convert
   against, and the repo already localises wall-clock↔instant conversion in
   `ScheduleMeetingsDialog.tsx`'s `chicagoWallTimeToUtcIso`.

## Acceptance criteria

1. `src/lib/meetings/format.ts` exists and is the **only** definition of the
   six named formatters plus `parseDateOnly`/`splitMeridiem`/
   `computeDurationMinutes` in `MeetingsList.tsx` and `CalendarPage.tsx`
   (narrowed criterion, correction 3).
2. `MeetingsList.test.tsx` passes **unedited**.
3. `CalendarPage.test.tsx:297–303` still passes.
4. Every `Intl.DateTimeFormat` in `format.ts` resolves to
   `timeZone: 'America/Chicago'` (NFR-09).

   **[R3 — both greps replaced; round 2 measured the first one as
   *unsatisfiable on a correct implementation*.]**
   `grep -n "timeZone: 'America/Chicago'" src/lib/meetings/format.ts` returns
   **exit 1 and zero hits** even when the move is perfect, because a
   byte-identical move keeps the instances reading
   `timeZone: CHICAGO_TIME_ZONE`. A worker following it literally would report
   a failure that is not one. Instead:

   - Run `grep -n 'timeZone' src/lib/meetings/format.ts` — expect **three**
     hits, all `timeZone: CHICAGO_TIME_ZONE` — plus the
     `CHICAGO_TIME_ZONE = 'America/Chicago'` declaration. **Paste both.**
   - **[R3]** "Grep `buildScheduleChips`'s body" is not something grep can
     scope, and a naive `grep 'Date\|Intl' format.ts` hits the eleven moved
     formatters and reads as a failure. Instead: **paste `buildScheduleChips`'s
     full body** and show it contains no `Date` and no `Intl` token.
5. **[R2]** `buildScheduleChips` is unit-tested, with the literal inputs given
   here so there is nothing to reverse-engineer:
   - `[{dow:2,startMinutes:1080,endMinutes:1200},{dow:0,startMinutes:930,endMinutes:1110}]`
     → `["Tue 6–8 PM", "Sun 3:30–6:30 PM"]` (the issue's own example)
   - `[{dow:2,startMinutes:1080,endMinutes:1200}]` → `["Tue 6–8 PM"]` (single-day)
   - `[]` → `[]`
   - meridiem-straddling: `[{dow:3,startMinutes:660,endMinutes:780}]`
     → `["Wed 11 AM–1 PM"]`
   - **midnight**: `[{dow:4,startMinutes:0,endMinutes:180}]` → `["Thu 12–3 AM"]`
     (catches `h % 12`)
   - **noon**: `[{dow:5,startMinutes:690,endMinutes:750}]`
     → `["Fri 11:30 AM–12:30 PM"]`
   - **[R3] end-of-day midnight**:
     `[{dow:1,startMinutes:1320,endMinutes:1440}]` → `["Mon 10 PM–12 AM"]`.
     This is the MAJOR-2 case: it catches the `>= 720` fall-through, which
     would print `Mon 10–12 PM`. **`1440` is legal input and round 1's
     criterion list had no case for it — the one legal input where the spec
     was ambiguous was the one input nothing measured.**
   - each `RangeError` case: `dow: 7`, `endMinutes <= startMinutes`,
     `startMinutes: 1440`.

   **[R3] Two things about those `RangeError` cases the worker must not have to
   guess at:**

   - `dow: 7` is a **compile error** against `dow: Dow`, so that test needs
     `as unknown as ScheduleRule`. **This is authorized** — it is a deliberate
     out-of-contract probe, and `tseslint.configs.recommended` does not flag it
     (no `no-explicit-any` trigger). Round 1 left this as an apparent
     contradiction between criterion 5 and prescription 4's type.
   - `startMinutes: 1440` necessarily violates **two** rules at once
     (out of `0..1439`, *and* `endMinutes <= startMinutes`, since no legal
     `endMinutes` exists above `1440`), so which message it carries depends on
     check order. **Assert `toThrow(RangeError)` only, not the message text**,
     unless you also fix the validation order — in which case document it as
     `dow`, then `startMinutes` range, then `endMinutes` range, then
     `endMinutes > startMinutes`.
6. `formatPastAttendanceSummary` is still in `MeetingsList.tsx`.
7. Six gates green via the `gate-run` skill. **[R2] Named baseline, measured on
   this branch pre-change by the premise gate: full suite 2598 tests / 102
   files; scoped (`MeetingsList.test.tsx` + `CalendarPage.test.tsx`) 141.**
   Total must be **≥ 2598**, and the scoped run must be **≥ 141**. Use
   `gate-run` with `--scope` on those two files plus the new
   `src/lib/meetings/format.test.ts`.
8. **`mutation-replay`**: prove at least two moved formatters are still
   guarded. Named mutations:
   **[R3 — MAJOR-1: both counts below are corrected. Round 1 measured them on
   the PRE-move tree, where only `MeetingsList.tsx`'s private copy is mutated.
   These criteria tell you to mutate the POST-move shared `format.ts`, which
   `CalendarPage.tsx` also resolves through, so both counts are higher. Round 2
   re-measured them against a real built `format.ts`.]**

   - **(a)** in `format.ts`, change `formatTimeRangeWithDuration`'s meridiem
     collapse so `startText` is always `startFormatted`. Expect **exactly 2
     tests red**, both asserting the collapsed `'6:00–8:00 PM · 2h'`:
     `MeetingsList.test.tsx:369` *"renders a full time range + duration string,
     America/Chicago (NFR-09)"* **and `CalendarPage.test.tsx:301`**
     *"formatTimeRangeWithDuration matches PRD line 237's own worked example
     shape"*. Full suite: **2 failed / 2596 passed**. (Measured post-move by
     the premise gate, round 2. Pre-move it is 1 — reporting 1 means you
     mutated the wrong copy.)
   - **(b) [R2 — replaced; the round-1 mutation was impossible.]** In
     `format.ts`, change `parseDateOnly`'s noon anchor from
     `Date.UTC(year, month - 1, day, 12)` to `Date.UTC(year, month - 1, day)`.
     Expect **exactly 10 tests red**: nine in `MeetingsList.test.tsx`
     (`formatWeekdayDate` :350; both `buildRecurrenceChips /
     buildDateRangeLabel` cases; both `summarizeCoachMeetingRow` cases; the
     UXD-02 dense-row render; both Cancel cases; T511 C4) **plus one in
     `CalendarPage.test.tsx:297`** *"formatWeekdayDate renders a weekday
     name"*. Full suite: **10 failed / 2588 passed**. (Measured post-move by
     the premise gate, round 2. Pre-move it is 9.)

   **Both counts are higher than the pre-move figures precisely because the
   shared module is now guarded by both test files — that increase *is the
   de-duplication working*, and it is the single most direct piece of evidence
   that this refactor did what it claims.** Report what you actually measure.

   **Do not attempt the round-1 mutation (b)** — setting
   `WEEKDAY_DATE_FORMATTER`'s `timeZone` to `'UTC'` leaves the suite
   **2598/2598 green**, measured. That is not a coverage gap to fix: because
   `parseDateOnly` anchors to noon UTC, that formatter's timezone is genuinely
   **unobservable**, with 0 divergences over 800 consecutive days. Record it as
   a fact about the code; do not manufacture a test for it and do not report a
   red run that did not happen.

   Commit before mutating, revert, re-verify green (item 26's fast-tier working
   rule, which applies to any mutation). Mutate only in **your own worktree**
   (item 23) — never the shared tree.

## Least confident decisions (item 19d)

Round 1's list is kept below with the gate's ruling on each, because deleting a
resolved doubt would delete the evidence that it was checked. **Items 3 and 5
are closed** — the gate found the citations that settle them. Item 4's
*reasoning* held but its supporting number was wrong (now corrected).

1. **`sessionDurationHours` moves with the block** (correction 2). Wrong if
   `format.ts` should stay purely presentational — it returns a number, not a
   string. **Gate: SOUND, keep as written.** `computeDurationMinutes` has
   exactly two callers, both inside the moved block, so splitting them would
   export it to serve one consumer. And `formatHoursLabel` already takes a
   `number`, so the "purely presentational" objection fails on its own terms.
2. **`buildScheduleChips` takes `{dow, startMinutes, endMinutes}` rather than a
   session-derived shape.** **Gate: reasoning SOUND, but the doubt was aimed at
   the wrong half.** `buildScheduleChips` appears nowhere in `src/` or `docs/`
   and `types.ts` does not exist yet, so the shape cannot be checked against a
   caller — but the *semantics*, not the shape, were what GAM-441 would freeze,
   and they were underspecified in five places. Now specified. **This remains
   the packet's genuine open risk**: if the redesign's real call sites hold
   `{startsAt, endsAt}` instants, callers must convert first.
3. ~~**Re-exporting from `MeetingsList.tsx` rather than repointing its test.**~~
   **CLOSED.** The gate built the shim and measured it: 106/106 unedited,
   `tsc` exit 0, 0 eslint errors, no `verbatimModuleSyntax`, no circular
   import, and three existing precedents in this repo.
4. **The narrowed criterion in correction 3.** Wrong if the owner intended
   GAM-443 to absorb the whole `parseDateOnly` sprawl. **Gate: narrowing is the
   right instrument; the count was wrong** (16 under `src/`, not 14) — fixed.
5. ~~**Title-case `Tue` vs upper-case `TUE`.**~~ **CLOSED.** The two examples do
   not disagree; they are different chips with independent PRD backing —
   `VOLT_Portal_PRD.md:153/420/514` for the schedule form,
   `VOLT_Portal_PRD_v2.md:58–59` for the recurrence form. Both now cited in
   prescription 4.

### [R2] New, after revision

6. **`buildScheduleChips` throws a `RangeError` on malformed input** rather
   than clamping or rendering a best effort. Wrong if a redesign caller will
   feed it partially-built rules from a form-in-progress. I chose throwing
   because a silent `Tue 8–6 PM` is a lie on screen and item 27's spirit is
   that a surface must not misreport; a caller that needs tolerance can filter
   before calling.

   **[R3] Gate round 2: the decision may stand, but two of its supporting
   claims were wrong and are corrected here — the reasoning must stop claiming
   the repo agrees with it when the repo does not.**
   - *"a throw would blank a whole panel"* is **understated**: a render throw
     blanks the **entire route**. `src/app/RouteErrorBoundary.tsx:3–8` catches
     at routed-page-content level, not per-panel.
   - This repo's presentation helpers are **uniformly tolerant, not throwing** —
     `MeetingsList.tsx:1379–1382` (`splitMeridiem` returns `{meridiem: null}`
     rather than throwing), `CalendarPage.tsx:341–342` ("drops any session
     whose event id doesn't resolve (defensive…)"), `OutreachList.tsx:1673–1675`
     (`?? '00'` fallbacks). Throwing is a **deliberate divergence** from
     in-repo precedent, not an application of it, and `format.ts`'s module doc
     must say so — otherwise the next author "fixes" the throw for consistency.
   - The falsifying condition remains **untestable today**:
     `buildScheduleChips` appears nowhere outside GAM-443's own docs and no
     design doc shows a live schedule editor. This stays open, and GAM-441
     inherits it.
7. **`endMinutes: 1440` is legal and midnight-spanning rules are not
   representable.** Wrong if VOLT ever schedules a meeting crossing midnight —
   then GAM-441 freezes a shape that cannot express a real meeting. I judged
   this acceptable for a high-school robotics team's build meetings, but it is
   an assumption about the domain and not a measurement.

   **[R3] Gate round 2 split this in two, and only half of it was the doubt I
   thought I was declaring.** The *domain* judgement above is unmeasurable and
   stands. But the **`1440` rendering rule was outright defective** — legal
   input with two contradictory renderings and no test covering it (MAJOR-2,
   fixed in prescription 4 and criterion 5). Recording the split because it is
   the useful lesson: I declared a doubt about whether the *shape* was right,
   and the actual defect was that the *spec for a value I had already declared
   legal* did not have one answer. **Declaring a doubt about A is not cover for
   an unchecked contradiction in B.**
