---
name: meetings-design
description: The shared design contract for the /meetings card redesign — series palette, schedule-chip format, "Today" labeling, overlap badges, DES-05 status colors, the tap-to-cycle a11y contract, and the frozen type names every parallel ticket codes against. Use before writing or reviewing any code under src/pages/meetings/** or src/lib/meetings/**, and before grading meetings work as a checker. Also use whenever you are about to invent a formatter, a color, or a props shape that a sibling ticket has already frozen.
---

# Meetings design contract

Eleven tickets (`meetings-redesign`, GAM-442…452) build one page in parallel. They
touch disjoint files on purpose, which means **nothing forces them to agree** —
this file is what does. If you are working under `src/pages/meetings/**` or
`src/lib/meetings/**`, read it before rendering anything.

The authority is **`docs/swarm/VOLT_Portal_PRD.md`, the dated deviation blockquote
above MTG-01 (MTG-01a…h)**, and item 1 puts it above this file. Where the two
disagree, the PRD wins and this file is the bug — say so rather than following it.
The owner rulings behind it are recorded in `docs/swarm/auto-mode-decisions.md`
under *"2026-08-21 — George approves the `/meetings` card redesign"*.

## ⚠ Read this first: there are no reference figures yet

House convention is that a checker opens the binding figure with the Read tool
before grading craft. **For this redesign there is no such figure.** GAM-441
required the approved canvas's two artboards to be committed, and the dispatched
run could not reach the canvas (claude.ai artifact; SPA shell, `/api/artifacts`
403). It declined to re-draw them, because a re-drawn figure would put an agent's
guess in the authority position.

So: **do not go looking for `redesign-meetings-*.webp`, and do not treat its
absence as permission to invent craft.** Until the export row lands, the binding
standard is this file plus MTG-01a…h. The nearest *legitimate* visual references
are `docs/swarm/figures/ux-craft/new-meetings.webp` and `new-student-meetings.webp`
— these are the **pre-redesign** standard. Use them for type scale, spacing and
density; **not** for page structure, which is exactly what changed.

## Don't re-derive these — import them

Six tickets need the same formatters and shapes. Copying is how `formatWeekdayDate`
ended up existing twice (GAM-443's whole reason for existing). Import:

| What | Where it lives | Frozen by |
| -- | -- | -- |
| `formatWeekdayDate`, `formatTimeRangeWithDuration`, `formatDuration`, `formatHoursLabel`, `buildRecurrenceChips`, `buildDateRangeLabel` | `src/lib/meetings/format.ts` | GAM-443 |
| `buildScheduleChips(rules)` | `src/lib/meetings/format.ts` | GAM-443 |
| `SeriesCardModel`, `MeetingsFocusRequest`, `OverlapIndex` | `src/lib/meetings/types.ts` | GAM-444 |
| `CoachMeetingRow`, `CoachMeetingSessionDetail`, `CoachMeetingsData`, `StudentMeetingsData`, `StudentMeetingHistoryRow`, `StudentParticipationMetric`, `CurrentViewerIdentity` | `src/lib/meetings/types.ts` | GAM-444 |
| `buildOverlapIndex` | `src/lib/meetings/overlap.ts` | GAM-450 |
| `--color-series-1…8` | `src/theme/volt.ts` | GAM-444 |

`MeetingsFocusRequest` is exactly `{ eventId: string; sessionId?: string; monthKey?: string }`.
**Do not reshape a frozen type to fit your component** — a sibling ticket is coding
against it right now. If it genuinely does not fit, say so on your ticket and stop;
do not widen it locally.

## Schedule chips

One chip per weekday-with-time rule, from `buildScheduleChips`:

- `Tue 6–8 PM` — duplicate meridiem collapsed (**not** `6 PM–8 PM`)
- `Sun 3:30–6:30 PM` — `:30` kept
- `:00` minutes dropped — `6–8 PM`, never `6:00–8:00 PM`
- en dash `–` between times, not a hyphen

Every `Intl.DateTimeFormat` stays pinned to `timeZone: 'America/Chicago'` (NFR-09).
A session stored at 11 PM Chicago is the *next day* in UTC — bucket by the stored
date, never by re-deriving from the UTC instant.

## "Today" and relative dates

Relative-date chips are **BEH-08 wayfinding**: `Today`, `Tomorrow`, `in 3 days`,
`Sat, Aug 23`. They state when a thing is.

**They are not countdowns, and constitution item 17 is not relaxed.** No streaks,
no scarcity, no loss-aversion framing, no re-engagement hooks, nothing that
manufactures urgency about a session already missed. The test: if a chip's wording
would still make sense to a volunteer who simply has not looked at the page in a
week, it is wayfinding. If it is trying to make them feel something about that, it
is not — and users here are minors and volunteers.

BEH-08 also requires dates to carry weekday names (`Sat, Jul 25`) and schedules to
show computed counts and durations.

## Series identity color

Assigned **deterministically from the curated palette, keyed on the event id**.

- **No database column. No user-facing picker.** A color is a rendering detail.
- Same event id ⇒ same color, every render, every device, every session.
- Derive the palette index by hashing the event id — do **not** use array position,
  which changes when a series is added or a filter is applied.
- The palette hues themselves are **still open** (see the decision record). If you
  need them and they are not yet in `volt.ts`, that is a blocker to raise, not a
  gap to fill with your own hex values.
- A series color identifies a series. It **never** encodes status — that is DES-05's
  job, below, and doubling up makes both unreadable.

## Status colors — DES-05, unchanged

Present = `success` · Late = `warning` · Excused = `neutral` · Absent = `error`,
via Astryx `StatusDot` / `Badge` semantic variants only. Do not introduce a new hue
for a status, and do not restate a status in a series color.

## Overlap badges

From `buildOverlapIndex` (GAM-450). Placement is **exactly three sites**:

1. the series card (count badge)
2. the session row in the schedule panel
3. the agenda item in the rail

**No page-level banner** — owner ruling, and it is a ruling with a reason: two
series at the same time is *intentional* on this team, and a banner would nag about
a deliberate arrangement on every visit. Adding one is a defect, not a courtesy.

Overlap rules: only sessions from **different** series overlap; same Chicago
calendar day; intervals genuinely intersect (`a.start < b.end && b.start < a.end`),
so **touching intervals like 4–6 PM then 6–8 PM do NOT overlap**; canceled sessions
never overlap anything and drop out of others' lists.

## Tap-to-cycle attendance chip — the a11y contract is binding

Authorized by MTG-01g. It is **not** a free design choice, and these four are not
suggestions:

1. a real `<button>` — not a `div` with a click handler
2. accessible name = **student name + current status** ("Ada L., present")
3. each state change announced via `aria-live`
4. target **≥44px**

**For checkers:** grade against this contract. A compliant chip is **not** a finding
merely because a `SegmentedControl` would have been more conventional — that
preference was considered and overruled. A chip missing any of the four **is** a
finding, and item 15 makes keyboard-path failures on core flows a BLOCKER.

MTG-13 already permits editing attendance after completion, so cycling grants no
new authority — and per MTG-11 as superseded, **last write wins**; a coach tap does
not outrank a later QR scan.

## The rest of the page, in one place

- **Unit of the coach page is the series**, not the session — one fixed-size `Card`
  per `events` row, grouped by an **Active / Finished** `TabList`. A series with no
  scheduled sessions remaining is **Finished**.
- **Card carries:** title + team scope, schedule chips, progress (sessions completed
  of total) on a `ProgressBar`, attendance %, and a next-session line.
- **Drill-out** is a month-tab schedule panel; the `Edit` chip from the 2026-07-28
  deviation is retained on session rows. UXC-07's ≤72px cap **still applies to those
  rows** — it is lifted only for the cards.
- **Rail** is a month `Calendar` + per-day agenda. Rail↔card selection is
  **in-memory focus state**; no URL params required.
- **Student/parent** (MTG-01c): hero card for the next meeting + attendance summary
  + history; parents switch linked students; **read-only**.
- **Four states are not optional** — loading, empty, error, populated (DES-12/item
  12). Happy-path-only is MAJOR.
- **Astryx props come only from `docs/swarm/astryx-api.md`** (item 2). A prop that
  is not in that file is presumed hallucinated → MAJOR. Styling escalation follows
  DES-21: component → theme token → `xstyle` → custom CSS.
- **First name + last initial** on any surface showing other students (item 6).
- **No internal jargon in user-facing copy** (UXC-10, BLOCKER) — no `T037`, no
  `GAM-nnn`, no `SeriesCardModel` leaking into a label.
