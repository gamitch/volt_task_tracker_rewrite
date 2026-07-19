# Worker Packet: T045

## Task ID
T045 — `/calendar` month grid + filters + detail links (CAL-01/02), Epic E7 (first task in this
epic — currently 100% Blocked, this unblocks T046 and T047).

## Objective
Build `src/pages/calendar/CalendarPage.tsx`: an Astryx `Calendar` month grid
(`weekStartsOn="sun"`) plus a chronological session list below it, a filter `SegmentedControl`
(All | Meetings | Outreach | Competitions), month prev/next/today controls, and click-through to
per-session detail routes. Sessions render as dots/labels colored per DES-04's named palette.

## Dependencies (status)
- T030 (`/meetings` list) — Passed. Read `src/pages/meetings/MeetingsList.tsx` for the established
  meeting-session fixture shape and any existing session-formatting helpers (date/time rendering
  per BEH-08) — reuse the same conventions rather than inventing new ones.
- T038 (`/outreach` list) — Passed. Read `src/pages/outreach/OutreachList.tsx` for the established
  outreach/competition session fixture shape and its `type` `Badge` variant mapping (Outreach=
  `blue`/Circuit Blue, Competition=`orange`/Comp Orange per DES-04).

## Allowed Files
- `src/pages/calendar/CalendarPage.tsx` (new — confirm via `Glob` that `src/pages/calendar/`
  doesn't exist yet)
- A colocated `CalendarPage.test.tsx` is acceptable per established precedent — disclose it.

## Forbidden Files
- `src/pages/meetings/**`, `src/pages/outreach/**` — read-only reference only.
- `src/pages/calendar/SubscribePopover.tsx` — does not exist yet (a separate, currently-Blocked
  task, T046). Do not build the ICS-subscribe popover here.
- `src/app/router.tsx`, `src/app/guards.tsx` (import-only) — read-only. Not wired into any route
  by this task. "Click-through to session detail routes" means real `<Link>`/navigation elements
  pointing at the literal route paths (e.g. `/meetings/:sessionId`, `/outreach/:eventId`) — you are
  not required to prove those destination routes render anything (several are still placeholders
  or Blocked tasks), only that this page links to the correct path.
- `src/lib/supabase/**` — read-only reference only, do not import directly. Build against an
  injectable `loadSessions`-style seam with obviously-fake fixture defaults spanning all three
  session types.
- `supabase/migrations/**` — read-only.
- `docs/swarm/**`, `.claude/**`, `src/theme/**`.

## Known Context / Traps

**1. THE CENTRAL TRAP — the real Astryx `Calendar` component has NO custom day-content/dots-render
prop. Read its Props table yourself before assuming otherwise.** `docs/swarm/astryx-api.md`'s
`# Calendar` section (grep it) documents: `mode`, `value`/`defaultValue`, `onChange`,
`numberOfMonths`, `min`/`max`, `dateConstraints` (an array of `(date: Date) => boolean` predicates
— for DISABLING dates, not custom rendering), `focusDate`/`onFocusDateChange`, `handleRef`,
`hasOutsideDays`, `hasWeekNumbers`, `hasVariableRowCount`, `weekStartsOn`. There is no `dayContent`,
`renderDay`, `dotsForDate`, or any other custom-per-day-rendering slot documented anywhere — this is
the same class of trap as T026's nonexistent `ColorPicker` and T038's "Grouped Table" naming
mismatch. **Do not invent a prop.** You must find a real, defensible way to satisfy "sessions render
as dots/labels colored per DES-04" using only genuinely documented `Calendar` props plus your own
composition around it. A plausible, disclosed-judgment-call resolution: use `Calendar` purely for
month navigation/date selection (its real, documented job), and put the actual per-day dot/label
visualization in the chronological session list below it (which is not constrained by `Calendar`'s
prop surface at all, since you own that markup entirely) — but investigate the real component
source (`node_modules/@astryxdesign/core/src/Calendar/**`) yourself before committing to this, in
case there is a legitimate composition pattern (e.g. an unstyled day-cell you can visually augment
via CSS/data-attributes rather than a prop) that the doc's Theming section hints at
(`astryx-calendar-day` class, `data-selected`/`data-today`/`data-disabled`/`data-in-range`
attributes — none of these are event/dot-related, confirm this yourself). Whatever you land on,
disclose the investigation and the reasoning explicitly — this is the single most important thing
this packet asks you to get right.

**2. DES-04's exact color mapping** (PRD line ~186-192, cite verbatim): Outreach = Astryx `blue`
variant ("Circuit Blue"), Meeting = Astryx `purple` variant ("Meeting Violet"), Competition =
Astryx `orange` variant ("Comp Orange"). These map onto real `Badge`/`Token`/`StatusDot` `variant`
props (whichever documented component you use for the dots/labels) — never a hand-rolled hex color
(constitution item 2/13 concern: hardcoded hex would also break dark-mode theming, the same class
of defect D005 already fixed once at the token level).

**3. NAV-07 — this route is explicitly one of the two permitted combined-type list surfaces.**
Unlike most other list pages in this batch (which correctly keep meeting/outreach/competition rows
separate per NAV-07's general rule), `/calendar` is an explicit, PRD-named exception — mixing all
three types in one chronological list here is REQUIRED, not a violation. Every row must still carry
a type `Badge` so the mixing is visually legible (same requirement T058/Events tab will also have
for the same reason).

**4. Filter `SegmentedControl` — four options, "All" first.** `All | Meetings | Outreach |
Competitions`, filtering both the month-grid dots (if your Trap #1 resolution puts dots there) and
the chronological list by the selected type. Reuse the real event `type` vocabulary
(`'meeting' | 'outreach' | 'competition'`, confirmed at
`supabase/migrations/20260717000000_scheduling_attendance.sql` line 36) — "Competitions" in the UI
maps to `type='competition'` events (which T039 already established are created via the outreach
event dialog's type Selector, not a separate table).

**5. BEH-08 date/duration rendering** — reuse whatever helper `MeetingsList.tsx`/`OutreachList.tsx`
already established (weekday names, computed durations) rather than reinventing the formatting
logic; cite which one you reused or why you didn't.

**6. No shared Supabase client wired in — deliberate scope, not a gap for you to solve.** Same
posture as every prior content page. Your injectable `loadSessions` fixture should include at least
one session of each of the three types so the filter/color-mapping logic is actually exercised.

## Acceptance Criteria
- Real `Calendar` (`weekStartsOn="sun"`) used only within its genuinely documented Props surface —
  no invented day-render prop.
- Chronological session list below the grid, filterable by the four-option `SegmentedControl`.
- Every row/dot carries the correct DES-04 color mapping via a real documented `variant` prop, never
  a hardcoded hex.
- BEH-08 date/duration rendering consistent with sibling list pages.
- Click-through elements point at correct-looking destination route paths (not required to render
  anything at the destination).
- No box-drawing/bracket characters rendered (constitution item 13).
- `npm run build`/`typecheck`/`lint`/`format:check`/`test` all exit 0.

## Relevant Constitution Excerpts
> 2. Astryx component props come **only** from `docs/swarm/astryx-api.md`. A prop absent from that
> file is presumed hallucinated → MAJOR. *(Cited directly because of Trap #1 above — this is the
> highest-risk finding a checker will look for on this task.)*

## Most Recent Failure
None. This is attempt 1 for T045 (attempt count: 0).

## Required Worker Output
- Full contents of `CalendarPage.tsx`.
- Explicit, detailed write-up of your Trap #1 investigation and resolution — what you found in the
  real `Calendar` source/docs, and exactly how you satisfied "dots colored per DES-04" within real
  props.
- Astryx prop citations for every component used — grep `astryx-api.md` yourself, don't guess.
- Real test proof of the filter behavior and the color-mapping correctness (per type).
- `npm run build`/`typecheck`/`lint`/`format:check`/`test` output.
- Known risks; whether a dispute is needed (you flag, you don't resolve).
