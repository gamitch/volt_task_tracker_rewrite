# Worker Packet: T058

## Task ID
T058 — Events tab (RPT-04), Epic E9.

## Objective
Build `src/pages/reports/EventsTab.tsx`: all sessions (meetings, outreach, competitions) with
type, date, attendance/signup counts, hours awarded, people reached, adult volunteers, and status.

## Dependencies (status)
- T056 (`/reports` shell + Participation tab) — Passed. Same shape/gating precedent as T057's
  packet describes — read `ParticipationTab.tsx`/`ReportsShell.tsx` (both read-only, forbidden to
  edit) and match `{ seasonId, loadData }`-style props, no self-gate (the shell already gates
  `/reports`).
- T045 (`/calendar` month grid) — Ready/dispatched in parallel this round, not a hard dependency,
  but if it has landed by the time you're dispatched, read `CalendarPage.tsx` (read-only) for its
  own resolution of NAV-07's combined-type-list exception and its DES-04 type-`Badge` color mapping
  — reuse the same color/variant mapping rather than reinventing it, since this tab is the OTHER
  PRD-named exception to NAV-07's usual same-type-only list rule (see Known Context/Traps #1).

## Allowed Files
- `src/pages/reports/EventsTab.tsx` (new)
- A colocated `EventsTab.test.tsx` is acceptable per established precedent — disclose it.

## Forbidden Files
- `src/pages/reports/ReportsShell.tsx`, `ParticipationTab.tsx` — read-only reference only.
- `src/pages/reports/HoursTab.tsx` — does not exist yet (a separate, parallel task, T057).
- `src/pages/calendar/CalendarPage.tsx` — read-only reference only if present (see Dependencies).
- `src/pages/meetings/**`, `src/pages/outreach/**` — read-only reference only.
- `src/app/router.tsx`, `src/app/guards.tsx` (import-only) — read-only.
- `src/lib/supabase/**` — read-only reference only, do not import directly.
- `supabase/migrations/**` — read-only.
- `docs/swarm/**`, `.claude/**`, `src/theme/**`.

## Ground Truth — real schema (read the actual file yourself, do not guess column names)
- `events`: `id`, `season_id`, `type` (check: `'meeting'|'outreach'|'competition'`), `title`,
  `location_name`, `team_ids` (nullable uuid array), `counts_participation`,
  `counts_volunteer_hours`, `adult_volunteers_count`, `adult_volunteer_hours` —
  `20260717000000_scheduling_attendance.sql` lines 29-46.
- `event_sessions`: `id`, `event_id`, `session_date`, `starts_at`, `ends_at`, `status`
  (check: `'scheduled'|'completed'|'canceled'`), `people_reached` (nullable int) — same migration,
  lines 51-63. **This tab is per-SESSION, not per-event** (RPT-04 says "all sessions") — a
  recurring meeting event with 10 sessions should show 10 rows, one per session, not one collapsed
  event row.
- `rsvps`: `status` (`'going'|'maybe'|'declined'`) — for "signup counts".
- `attendance`: `status` (`'present'|'late'|'excused'|'absent'`) — for "attendance counts" and
  "hours awarded" (see Known Context/Traps #3).

## Known Context / Traps

**1. NAV-07 combined-type-list exception — this IS one of the two PRD-named exceptions (the other
is `/calendar`, T045).** Unlike most list pages in this batch, mixing meeting/outreach/competition
rows in one table here is REQUIRED. Every row must carry a type `Badge` using DES-04's real color
mapping (Meeting = Astryx `purple`, Outreach = Astryx `blue`, Competition = Astryx `orange`) so the
mixing stays legible — reuse `CalendarPage.tsx`'s mapping if it exists by the time you check,
otherwise derive it fresh from the PRD's own DES-04 table (cite it directly, don't guess).

**2. "Attendance/signup counts" — two different concepts depending on session type, don't conflate
them.** A meeting session's real headcount signal is `attendance` rows (present/late/excused/
absent counts). An outreach/competition session's real headcount signal is BOTH `rsvps` (signup
intent, pre-session) AND `attendance` (actual, post-completion) — decide and disclose which one(s)
you show per session type, and under what column label, rather than picking one silently and
letting the UI imply it's the same concept everywhere.

**3. "Hours awarded" per session — where does this number come from?** There is no `v_student_hours`-
style per-SESSION hours view (that view is per-`(student_id, season_id)`, already summed across a
season — not what a single session row needs). Per-session hours awarded is a real, disclosed
computation from `attendance` rows for that session (`hours_override` if set, else the clamped
check-in/check-out window, else full session duration — the EXACT same three-way fallback
`v_student_hours`'s own SQL already encodes, just evaluated per-session instead of summed
per-season). State explicitly: (a) this is NOT a case of re-deriving `v_student_hours`'s SUM
formula (constitution item 3 concerns the view's own aggregate, not a legitimately different
per-session granularity with no view of its own — same reasoning class T053's checker already
accepted for a comparable case), but (b) you must still reuse the SAME three-way fallback LOGIC the
view encodes (`hours_override` wins → else clamped window → else full duration) rather than
inventing a different one, so this tab's per-session numbers are internally consistent with what
`v_student_hours`'s season totals would produce if summed. Read
`supabase/migrations/20260717000003_metric_views.sql` lines 3-18 directly and mirror its logic
faithfully, then sum across attendees for that session's row.

**4. People reached / adult volunteers — per-row, not season totals here (that's T057's job).**
`event_sessions.people_reached` is per-session (nullable — render "—" for null, don't fabricate a
0). `adult_volunteers_count`/`adult_volunteer_hours` are per-EVENT (not per-session) — decide and
disclose whether you repeat the event-level figure on every one of that event's session rows, or
show it only once (e.g. on the first session row per event) — either is defensible, state your
choice.

**5. Status column** — `event_sessions.status` (`scheduled`/`completed`/`canceled`) rendered via a
real `Badge`/`StatusDot`, not a hardcoded color — canceled sessions should be visually distinct
(same DES-05-adjacent semantic-variant discipline every prior status column in this batch has used).

**6. Coach/admin-only (RPT-06), no self-gate** — same posture as T057, matching
`ParticipationTab.tsx`'s already-established reasoning (the shell already gates `/reports`).

**7. "Grouped Table" naming trap** — same already-resolved precedent as T056/T057: compose the
real, documented `Table` component, no invented `GroupedTable`.

**8. No shared Supabase client wired in — deliberate scope.** Injectable `loadData` seam,
obviously-fake fixture spanning all three event types and multiple session statuses.

## Acceptance Criteria
- All sessions (not just events) rendered, one row per session, correct type `Badge` per row
  (NAV-07 exception).
- Attendance/signup count semantics per session type explicitly disclosed and correctly sourced.
- Hours-awarded computation faithfully mirrors `v_student_hours`'s three-way fallback logic at
  per-session granularity (explicitly NOT a re-derivation of the view's own SUM, disclosed as such).
- People-reached/adult-volunteer figures correctly attributed at their real per-session/per-event
  granularity, with your repetition choice disclosed.
- Status rendered via a real semantic-variant component.
- No box-drawing/bracket characters (constitution item 13).
- `npm run build`/`typecheck`/`lint`/`format:check`/`test` all exit 0.

## Relevant Constitution Excerpts
> 3. RLS/metric SQL formulas are never re-derived in TypeScript; UI reads already-computed view
> columns. → BLOCKER if violated. *(Cited because Trap #3 is exactly the kind of finding a checker
> will scrutinize hardest on this task — get the "mirrors the view's logic at a different
> granularity, doesn't re-derive the view's own aggregate" distinction right and disclose it
> clearly.)*

## Most Recent Failure
None. This is attempt 1 for T058 (attempt count: 0).

## Required Worker Output
- Full contents of `EventsTab.tsx`.
- Explicit write-up of the per-session hours-awarded computation and why it's not a constitution
  item 3 violation (Trap #3).
- Explicit write-up of the attendance-vs-signup-count disclosure (Trap #2) and the people-reached/
  adult-volunteer repetition choice (Trap #4).
- Real test proof: per-session hours cross-checked against a hand-computed expectation using the
  same fallback logic, row-count cross-check vs. the fixture session count.
- Astryx prop citations for every component used — grep `astryx-api.md` yourself, don't guess.
- `npm run build`/`typecheck`/`lint`/`format:check`/`test` output.
- Known risks; whether a dispute is needed (you flag, you don't resolve).
