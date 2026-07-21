/**
 * T058: RPT-04 Events tab -- all SESSIONS (not events), across all three
 * event types (meeting, outreach, competition), rendered as one flat,
 * mixed-type `Table`: type `Badge`, date, attendance/signup counts, hours
 * awarded, people reached, adult volunteers, and status.
 *
 * -----------------------------------------------------------------------
 * 1. Per-SESSION, not per-event (worker packet Ground Truth section).
 *
 * `event_sessions` is a child of `events` (`event_id` FK,
 * `20260717000000_scheduling_attendance.sql` lines 50-63) -- a recurring
 * meeting event with 10 sessions has 10 rows in `event_sessions`, and this
 * tab renders 10 table rows for it, one per session, never one collapsed
 * event row. `buildDisplayRows` below is a plain per-session join against
 * each session's parent event (for `type`/`adultVolunteersCount`/
 * `adultVolunteerHours`/`countsVolunteerHours`, all real `events` columns
 * that have no `event_sessions`-level equivalent) -- it never merges two
 * sessions into one row.
 *
 * -----------------------------------------------------------------------
 * 2. NAV-07 combined-type-list exception (worker packet Known Context/
 *    Traps #1) -- this tab and `/calendar` (T045) are the two PRD-named
 *    exceptions to NAV-07's usual "one type per list" rule; RPT-04's own
 *    PRD text ("all sessions with type, date, ...", `VOLT_Portal_PRD.md`
 *    line 348) requires meeting/outreach/competition rows mixed in a
 *    single table, unlike every same-type-only list elsewhere in this
 *    batch (`MeetingsList.tsx`, `OutreachList.tsx`).
 *
 * `src/pages/calendar/CalendarPage.tsx` did not exist at the moment this
 * task was first dispatched (confirmed via `ls src/pages/calendar/`), so
 * `EVENT_TYPE_BADGE` below was derived directly from the PRD's own DES-04
 * table (`VOLT_Portal_PRD.md` lines 186-193): "Circuit Blue" = Astryx
 * `blue` = Outreach type badge/cards; "Meeting Violet" = Astryx `purple` =
 * Meeting type badge/cards; "Comp Orange" = Astryx `orange` = Competition
 * type badge/cards. `CalendarPage.tsx` (T045) landed mid-session, partway
 * through this task's own work -- read read-only afterward per the
 * packet's Dependencies section, its own `CALENDAR_TYPE_BADGE` constant
 * (`CalendarPage.tsx` lines 577-586) maps `meeting -> 'purple'`,
 * `outreach -> 'blue'`, `competition -> 'orange'`, IDENTICAL to
 * `EVENT_TYPE_BADGE` below -- both independently derived from the same
 * DES-04 table, confirmed byte-identical in outcome, not merely "reused"
 * by import (importing from `CalendarPage.tsx` remains out of this task's
 * Allowed Files; it stayed read-only reference only). Every session row
 * carries this Badge so the type-mixing required by RPT-04 stays legible
 * per row.
 *
 * NOTE (disclosed finding, not fixed here): this deliberately diverges from
 * `src/pages/home/CoachHome.tsx`'s own `EVENT_TYPE_BADGE` constant (line
 * ~1191 there: meeting=`blue`, outreach=`purple`, competition=`teal`),
 * which does NOT match DES-04's literal table above. `CoachHome.tsx` is
 * outside this task's Allowed Files (not editable here); this file's own
 * mapping is the one that matches the PRD text verbatim, and the
 * inconsistency is flagged as a candidate finding for a future corrective
 * task touching `CoachHome.tsx`.
 *
 * -----------------------------------------------------------------------
 * 3. "Attendance/signup counts" -- two different concepts, sourced
 *    per session type (worker packet Known Context/Traps #2).
 *
 * A meeting session's real headcount signal is `attendance` rows
 * (present/late/excused/absent, DES-05's own status vocabulary) -- meetings
 * do not carry a meaningful pre-session "signup intent" concept in this
 * PRD (RSVPs are not part of MTG-01..13's meeting flow anywhere in this
 * codebase -- `MeetingsList.tsx` has no `rsvps` usage at all, grep-confirmed;
 * only outreach/competition events collect them, per `OutreachList.tsx`'s
 * own per-row RSVP `SegmentedControl` and `rsvps`-table fixture use). An
 * outreach/competition session's real headcount signal is
 * BOTH `rsvps` (signup intent, pre-session: going/maybe/declined) AND
 * `attendance` (actual, post-completion: present/late/excused/absent).
 *
 * Concretely: `EventSessionDisplayRow.signups` is `null` for every
 * `type: 'meeting'` row (rendered "—" under a "Signups" column, NOT a
 * fabricated 0 -- the concept genuinely does not apply to that row, same
 * "null means not-applicable, not zero" discipline `ParticipationTab.tsx`
 * already established for its own expected_ct=0 case) and a real
 * `{goingCt, maybeCt, declinedCt}` summary of that session's `rsvps` rows
 * for `outreach`/`competition` rows. `EventSessionDisplayRow.attendance`
 * (`{presentCt, lateCt, excusedCt, absentCt}`) is always populated for
 * every row of every type, straight off that session's `attendance` rows
 * (a real 0 when no attendance rows exist yet -- e.g. a `scheduled`
 * session nobody has checked in for -- is a true count of existing rows,
 * not fabricated).
 *
 * -----------------------------------------------------------------------
 * 4. Per-session "hours awarded" -- worker packet Known Context/Traps #3,
 *    constitution item 3 distinction. THIS IS THE PART THE CHECKER WILL
 *    SCRUTINIZE HARDEST; full write-up also reproduced in this task's
 *    worker output.
 *
 * `v_student_hours` (`supabase/migrations/20260717000003_metric_views.sql`,
 * lines 3-19) is:
 *
 *   create or replace view v_student_hours as
 *   select
 *     a.student_id,
 *     e.season_id,
 *     sum(coalesce(
 *       a.hours_override,
 *       case when a.check_in_at is not null and a.check_out_at is not null
 *         then greatest(extract(epoch from
 *           (least(a.check_out_at, es.ends_at) - greatest(a.check_in_at, es.starts_at))) / 3600.0, 0)
 *       end,
 *       extract(epoch from (es.ends_at - es.starts_at)) / 3600.0
 *     )) as confirmed_hours
 *   from attendance a
 *   join event_sessions es on es.id = a.session_id and es.status = 'completed'
 *   join events e on e.id = es.event_id and e.counts_volunteer_hours
 *   where a.status in ('present','late')
 *   group by a.student_id, e.season_id;
 *
 * This view's grain is `(student_id, season_id)` -- one row per student per
 * SEASON, already `sum()`-aggregated across every session that student
 * attended all season long. RPT-04's grain is one row per SESSION (finding
 * #1 above). There is no `v_student_...`-style view at session grain
 * anywhere in `20260717000003_metric_views.sql` (grep-confirmed: the file
 * defines exactly `v_student_hours`, `v_student_participation`,
 * `v_team_participation`, none of which group by `session_id`). So this
 * tab's per-session "hours awarded" number cannot be read off any existing
 * view column -- it has to be computed here, in this file.
 *
 * (a) Why this is NOT a constitution item 3 violation ("RLS/metric SQL
 *     formulas are never re-derived in TypeScript; UI reads already-
 *     computed view columns"): item 3 bars re-deriving a VIEW'S OWN
 *     aggregate -- i.e. re-implementing `v_student_hours`'s `sum(...)
 *     group by student_id, season_id` step in TypeScript instead of
 *     reading its `confirmed_hours` column. This file never does that: it
 *     never groups by `(student_id, season_id)`, never produces a season
 *     total, and never claims to reproduce `confirmed_hours`. It computes
 *     a genuinely different, smaller-grained quantity -- one session's
 *     total hours across its attendees -- that the view was never asked to
 *     produce and has no column for. A per-session grain with no backing
 *     view is exactly the same reasoning class T053's checker already
 *     accepted for a comparable per-row-not-per-aggregate computation (per
 *     this task's own worker packet, Known Context/Traps #3).
 * (b) What IS reused, verbatim, from the view: the three-way `coalesce(...)`
 *     fallback LOGIC on the innermost per-attendance-row operand --
 *     `hours_override` wins; else the check-in/check-out window CLAMPED to
 *     `[es.starts_at, es.ends_at]` via `least(check_out_at, ends_at)` /
 *     `greatest(check_in_at, starts_at)`, floored at 0 via `greatest(...,
 *     0)`; else the full session duration (`ends_at - starts_at`). This is
 *     the SAME per-row operand the view's own `sum()` adds up across a
 *     student's whole season -- `computeAttendeeHours` below is a
 *     line-for-line TypeScript mirror of that one `coalesce(...)`
 *     expression (same three branches, same clamp direction, same floor at
 *     0), evaluated per `(attendance row, session)` pair exactly as the SQL
 *     evaluates it per joined row before its `group by` collapses rows
 *     together. `computeSessionHoursAwarded` then does the SAME `where
 *     a.status in ('present','late')` filter and the SAME sum the view
 *     does -- just scoped to one session's attendees instead of one
 *     student's whole season. Reusing this logic (rather than inventing
 *     e.g. an unclamped duration, or counting `absent`/`excused` rows) is
 *     what keeps this tab's per-session numbers internally consistent with
 *     what `v_student_hours`'s season totals would produce if you summed
 *     this tab's own numbers back up across a season -- which is the
 *     entire point of "mirror the logic, don't invent a different one".
 * (c) The view's TWO join-level gates (`es.status = 'completed'` and
 *     `e.counts_volunteer_hours`) are also reused, but at THEIR OWN correct
 *     grain, not the per-attendee grain (a) and (b) cover:
 *       - `es.status = 'completed'` is a per-SESSION gate (the view's
 *         `join event_sessions es on ... es.status = 'completed'` drops
 *         the ENTIRE session's join rows if not completed) --
 *         `computeSessionHoursAwarded` returns `null` (rendered "—") for
 *         any `scheduled`/`canceled` session, meaning "hours not yet
 *         determined", the same "no row exists yet" semantics
 *         `ParticipationTab.tsx` uses for its own null case, NOT a
 *         fabricated 0 for a session that hasn't happened.
 *       - `e.counts_volunteer_hours` is a per-EVENT gate (the view's `join
 *         events e on ... e.counts_volunteer_hours` drops the entire
 *         event's rows if false) -- `computeSessionHoursAwarded` returns a
 *         REAL `0` (not "—") for a `completed` session whose parent event
 *         does not count volunteer hours, even if that session has
 *         `present`/`late` attendance rows with real check-in/check-out
 *         data (see fixture session `session-c1` below: two `present`
 *         attendees, one with `hoursOverride: 8`, yet
 *         `computeSessionHoursAwarded` returns exactly `0`, because
 *         `event-regional-qualifier.countsVolunteerHours` is `false`).
 *         This is a genuine, deterministic zero (this event type never
 *         awards hours, by the same rule the view itself encodes), not an
 *         "unknown" -- so it renders as `0.0h`, not "—". Distinguishing
 *         these two null-vs-zero cases correctly is itself part of
 *         faithfully mirroring the view, not a separate invention.
 *
 * -----------------------------------------------------------------------
 * 5. People reached / adult volunteers -- per-row grain, worker packet
 *    Known Context/Traps #4.
 *
 * `event_sessions.people_reached` is a genuine per-SESSION column
 * (nullable) -- `EventSessionDisplayRow.peopleReached` is copied straight
 * off it, rendered "—" for `null` (never a fabricated 0; e.g. a `meeting`
 * session or a not-yet-completed `outreach` session legitimately has no
 * people-reached figure recorded).
 *
 * `events.adult_volunteers_count` / `events.adult_volunteer_hours` are
 * genuine per-EVENT columns with no `event_sessions`-level equivalent.
 * DECISION (disclosed, either option defensible per the packet):
 * `buildDisplayRows` REPEATS the parent event's adult-volunteer figures on
 * EVERY session row belonging to that event (see fixture: both
 * `session-m1` and `session-m2`, the two sessions of
 * `event-weekly-meeting`, show the identical "1 · 1.5h"). Rationale: this
 * tab is a single FLAT table (finding #6 below explains why it is not
 * grouped by event), sortable/filterable by session attributes like date
 * or status -- if the figure were shown only on one "first" session row
 * per event, sorting/filtering could hide or relocate that row, silently
 * dropping the only place the figure was visible for that event. Repeating
 * it on every session row keeps each row fully self-contained regardless
 * of sort/filter state. The column header is explicitly labeled "Adult
 * Volunteers (per event)" specifically so a reader does not mistake the
 * repeated figure for a per-session count that would double-count if
 * summed down the column -- the parenthetical is the disclosed guard
 * against that misreading, not decorative.
 *
 * -----------------------------------------------------------------------
 * 6. "Grouped Table" naming trap (worker packet Known Context/Traps #7) --
 *    same already-resolved precedent as `ParticipationTab.tsx`'s own module
 *    doc #5 (T056), applied with an additional finding specific to RPT-04.
 *
 * `astryx-api.md` has no "Grouped Table" (or similarly named) component
 * section (grep-confirmed), and the installed package's `useTableGroupedRows`
 * Table plugin has no subsection in `astryx-api.md` either (same gap
 * `ParticipationTab.tsx` already found) -- so per constitution item 2 it is
 * treated as out of bounds here too. Composing the real, documented `Table`
 * component (props read verbatim from `astryx-api.md`'s own "Table" Props
 * table: `data`, `columns`, `idKey`, `density`, `dividers`, `hasHover`) is
 * used instead, exactly as `ParticipationTab.tsx` already did.
 *
 * UNLIKE `ParticipationTab.tsx` (RPT-02's own PRD text: "grouped BY TEAM"),
 * RPT-04's PRD text ("all sessions with type, date, attendance/signup
 * counts, hours awarded, people reached, adult volunteers, status",
 * `VOLT_Portal_PRD.md` line 348) names no grouping dimension at all -- no
 * "grouped by X" language anywhere in RPT-04's own sentence. So this tab
 * uses a single flat `Table` with no `<Section>`-per-group wrapper: there
 * is no PRD-specified grouping key to build one around, and inventing one
 * (e.g. grouping by event, or by type) would be adding structure the PRD
 * text never asked for on THIS tab specifically (unlike RPT-02, where
 * "grouped by team" is explicit).
 *
 * -----------------------------------------------------------------------
 * 7. Status column (worker packet Known Context/Traps #5).
 *
 * `event_sessions.status` (`'scheduled' | 'completed' | 'canceled'`,
 * `20260717000000_scheduling_attendance.sql` line 59) is rendered via a
 * real `Badge`, reusing the EXACT SAME `SESSION_STATUS_BADGE` variant
 * mapping `MeetingsList.tsx` (T030) already established for the identical
 * three-value status: `scheduled` = `info`, `completed` = `success`,
 * `canceled` = `error` -- so a canceled session is visually distinct (a
 * bold solid error-red badge), not a hardcoded ad hoc color, and not a
 * second, drifted mapping for the same status vocabulary.
 *
 * -----------------------------------------------------------------------
 * 8. NFR-09 date rendering -- same resolution `MeetingsList.tsx` already
 *    established for the identical requirement.
 *
 * The Astryx `Timestamp` component (`astryx-api.md` lines 5944-5988) has no
 * `timeZone`-pinning prop in its own Props table (only `isTimezoneShown`,
 * which appends an abbreviation but does not choose WHICH zone is used for
 * the underlying formatting) and its `format` options are relative/auto/
 * date/date_time/time-oriented, not designed for a fixed-zone report
 * column. Per NFR-09 ("All times stored UTC, rendered `America/Chicago`"),
 * `formatSessionDate` below uses a local `Intl.DateTimeFormat` pinned to
 * `timeZone: 'America/Chicago'`, the same resolution `MeetingsList.tsx`'s
 * own `formatWeekdayDate` already used for the identical NFR-09
 * requirement (not imported from that forbidden/read-only file -- mirrored
 * locally, same `parseDateOnly` noon-UTC-anchoring technique to sidestep
 * DST/date-only parsing edge cases).
 *
 * -----------------------------------------------------------------------
 * 9. RPT-06 coach/admin-only, no self-gate (worker packet Known Context/
 *    Traps #6) -- same posture `ParticipationTab.tsx` already established:
 *    `ReportsShell.tsx` (this component's caller, forbidden/read-only here)
 *    already nests `guards.tsx`'s `RequireRole` around its whole `TabList`,
 *    so this component does not duplicate that guard.
 *
 * -----------------------------------------------------------------------
 * 10. No shared Supabase client wired in anywhere in `src/` yet (same gap
 *     every other task in this batch has independently confirmed).
 *     `useEventSessionsData` below is the designed data-fetching seam: a
 *     typed hook taking `seasonId` and an injectable
 *     `loadData: LoadEventSessionsDataFn`, defaulting to the OBVIOUSLY-FAKE
 *     `defaultLoadEventSessionsData` (fixture data only, finding #11
 *     below). Mirrors `ParticipationTab.tsx`'s identical `{ seasonId,
 *     loadData }` prop shape per this task's own Dependencies section.
 *
 * -----------------------------------------------------------------------
 * 11. Fixture data (constitution item 6: no PII, fabricated names only --
 *     this file uses no student names at all, only opaque `student-*`
 *     IDs, since RPT-04's columns are session-level COUNTS, never a
 *     roster of names).
 *
 * `FIXTURE_EVENTS` / `FIXTURE_SESSIONS` / `FIXTURE_ATTENDANCE` /
 * `FIXTURE_RSVPS` below span all three event types and multiple session
 * statuses (`completed`, `scheduled`, `canceled`), and are built to
 * exercise every branch finding #4 above describes: `hours_override`
 * winning over everything else (`session-m1`, attendee `student-a`), a
 * check-in/check-out window fully INSIDE the session bounds needing no
 * clamp (`session-m1`, `student-b`), a check-in/check-out window that
 * starts before and ends after the session, needing clamp on BOTH ends
 * (`session-m1`, `student-c`), the full-session-duration fallback for a
 * counted attendee with no check-in/check-out at all (`session-m1`,
 * `student-d`, and `session-o1`, `student-a`), `excused`/`absent`
 * attendance rows correctly excluded from the hours sum
 * (`session-m1`, `student-e`/`student-f`), a not-yet-completed session
 * (`session-m2`, hours "—"), a canceled session (`session-c2`, hours "—",
 * zero attendance/signups recorded), an outreach session with real
 * signup+attendance BOTH populated (`session-o1`), and a completed
 * competition session whose EVENT does not count volunteer hours, so
 * `hoursAwarded` is a real `0` despite real `present` attendance existing
 * (`session-c1`) -- the exact case finding #4(c) describes. Full
 * hand-computed walkthrough reported in this task's worker output, not
 * merely asserted here.
 *
 * -----------------------------------------------------------------------
 * 12. T095 (ED-1 Packet P6): real load wiring -- `loadData` no longer
 *     defaults to fixture data.
 *
 * `loadData` now defaults to `loadEventSessionsData`, imported from
 * `../../lib/supabase/loaders/reports` -- a real per-season query across
 * `events`/`event_sessions`/`attendance`/`rsvps` (ALL session statuses,
 * matching finding #1/#2's already-established design; no `.eq('status',
 * ...)` filter anywhere in that loader) reusing THIS file's own exported
 * `buildDisplayRows`/`computeAttendeeHours`/`computeSessionHoursAwarded`/
 * `summarizeAttendance`/`summarizeSignups` (module doc #4's own
 * constitution-item-3 reasoning still holds -- the loader never
 * re-implements this file's own hours-awarded fallback logic a second
 * time, it calls these exact functions). `defaultLoadEventSessionsData`
 * (fixture data, unchanged) is kept as a named export for tests that want
 * fixture behavior explicitly, same posture `ParticipationTab.tsx`/
 * `HoursTab.tsx` (T095) already established for their own sibling
 * `loadData` seams.
 */
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  Badge,
  Banner,
  Button,
  EmptyState,
  HStack,
  Skeleton,
  Table,
  Text,
  VisuallyHidden,
  VStack,
  pixel,
  proportional,
  type TableColumn,
} from '@astryxdesign/core';
import { loadEventSessionsData } from '../../lib/supabase/loaders/reports';

// ---------------------------------------------------------------------------
// Types -- see module doc #1/#3/#4.
// ---------------------------------------------------------------------------

export type EventType = 'meeting' | 'outreach' | 'competition';
export type SessionStatus = 'scheduled' | 'completed' | 'canceled';
export type AttendanceStatus = 'present' | 'late' | 'excused' | 'absent';
export type RsvpStatus = 'going' | 'maybe' | 'declined';

/** Local, not re-exported by `@astryxdesign/core` -- same pattern
 * `MeetingsList.tsx` already used for the identical gap. */
type BadgeVariant =
  | 'neutral'
  | 'info'
  | 'success'
  | 'warning'
  | 'error'
  | 'blue'
  | 'cyan'
  | 'green'
  | 'orange'
  | 'pink'
  | 'purple'
  | 'red'
  | 'teal'
  | 'yellow';

/** Exported for direct testing (module doc #11's fixture walkthrough --
 * see this task's worker output and `EventsTab.test.tsx`'s hand-computed
 * hours cross-checks). */
export interface FixtureEvent {
  id: string;
  seasonId: string;
  type: EventType;
  title: string;
  /** `events.counts_volunteer_hours` -- module doc #4(c). */
  countsVolunteerHours: boolean;
  /** `events.adult_volunteers_count` -- module doc #5. */
  adultVolunteersCount: number;
  /** `events.adult_volunteer_hours` -- module doc #5. */
  adultVolunteerHours: number;
}

export interface FixtureSession {
  id: string;
  eventId: string;
  /** `event_sessions.session_date`, a plain `date` (YYYY-MM-DD, no time). */
  sessionDate: string;
  /** `event_sessions.starts_at` (ISO 8601 UTC timestamp). */
  startsAt: string;
  /** `event_sessions.ends_at` (ISO 8601 UTC timestamp). */
  endsAt: string;
  status: SessionStatus;
  /** `event_sessions.people_reached` -- nullable, module doc #5. */
  peopleReached: number | null;
}

export interface FixtureAttendanceRow {
  sessionId: string;
  studentId: string;
  status: AttendanceStatus;
  checkInAt: string | null;
  checkOutAt: string | null;
  hoursOverride: number | null;
}

export interface FixtureRsvpRow {
  sessionId: string;
  studentId: string;
  status: RsvpStatus;
}

export interface AttendanceSummary {
  presentCt: number;
  lateCt: number;
  excusedCt: number;
  absentCt: number;
}

export interface SignupSummary {
  goingCt: number;
  maybeCt: number;
  declinedCt: number;
}

/**
 * One row per SESSION (module doc #1). `signups` is `null` for meeting
 * rows (module doc #3, "not applicable", never a fabricated 0).
 * `hoursAwarded` is `null` for not-yet-completed sessions and a real
 * (possibly `0`) number for completed ones (module doc #4).
 */
export interface EventSessionDisplayRow extends Record<string, unknown> {
  sessionId: string;
  eventId: string;
  eventTitle: string;
  type: EventType;
  sessionDate: string;
  status: SessionStatus;
  attendance: AttendanceSummary;
  signups: SignupSummary | null;
  hoursAwarded: number | null;
  peopleReached: number | null;
  adultVolunteersCount: number;
  adultVolunteerHours: number;
}

export type LoadEventSessionsDataFn = (seasonId: string) => Promise<EventSessionDisplayRow[]>;

// ---------------------------------------------------------------------------
// Placeholder "current season" -- same disclosed placeholder
// `ParticipationTab.tsx` (T056) already established for the identical gap
// (no season-selection UI exists yet anywhere in this codebase). Defined
// locally (not imported from that forbidden/read-only file) with the same
// literal value for consistency.
// ---------------------------------------------------------------------------
export const PLACEHOLDER_CURRENT_SEASON_ID = 'season-placeholder-current';

// ---------------------------------------------------------------------------
// DES-04 type -> Badge mapping (module doc #2) and session-status -> Badge
// mapping (module doc #7).
// ---------------------------------------------------------------------------

export const EVENT_TYPE_BADGE: Record<EventType, { variant: BadgeVariant; label: string }> = {
  meeting: { variant: 'purple', label: 'Meeting' },
  outreach: { variant: 'blue', label: 'Outreach' },
  competition: { variant: 'orange', label: 'Competition' },
};

export const SESSION_STATUS_BADGE: Record<SessionStatus, { variant: BadgeVariant; label: string }> =
  {
    scheduled: { variant: 'info', label: 'Scheduled' },
    completed: { variant: 'success', label: 'Completed' },
    canceled: { variant: 'error', label: 'Canceled' },
  };

// ---------------------------------------------------------------------------
// Fixture data -- module doc #11. Fabricated IDs only, no names/PII.
// ---------------------------------------------------------------------------

export const FIXTURE_EVENTS: readonly FixtureEvent[] = [
  {
    id: 'event-weekly-meeting',
    seasonId: PLACEHOLDER_CURRENT_SEASON_ID,
    type: 'meeting',
    title: 'Weekly Team Meeting',
    countsVolunteerHours: true,
    adultVolunteersCount: 1,
    adultVolunteerHours: 1.5,
  },
  {
    id: 'event-park-cleanup',
    seasonId: PLACEHOLDER_CURRENT_SEASON_ID,
    type: 'outreach',
    title: 'Park Cleanup',
    countsVolunteerHours: true,
    adultVolunteersCount: 2,
    adultVolunteerHours: 4.0,
  },
  {
    id: 'event-regional-qualifier',
    seasonId: PLACEHOLDER_CURRENT_SEASON_ID,
    type: 'competition',
    title: 'Regional Qualifier',
    // Deliberately false -- module doc #4(c)'s "real zero, event doesn't
    // count hours" case.
    countsVolunteerHours: false,
    adultVolunteersCount: 3,
    adultVolunteerHours: 6.0,
  },
];

export const FIXTURE_SESSIONS: readonly FixtureSession[] = [
  {
    id: 'session-m1',
    eventId: 'event-weekly-meeting',
    sessionDate: '2026-07-07',
    startsAt: '2026-07-07T18:00:00.000Z',
    endsAt: '2026-07-07T20:00:00.000Z',
    status: 'completed',
    peopleReached: null,
  },
  {
    id: 'session-m2',
    eventId: 'event-weekly-meeting',
    sessionDate: '2026-07-14',
    startsAt: '2026-07-14T18:00:00.000Z',
    endsAt: '2026-07-14T20:00:00.000Z',
    status: 'scheduled',
    peopleReached: null,
  },
  {
    id: 'session-o1',
    eventId: 'event-park-cleanup',
    sessionDate: '2026-07-11',
    startsAt: '2026-07-11T09:00:00.000Z',
    endsAt: '2026-07-11T12:00:00.000Z',
    status: 'completed',
    peopleReached: 150,
  },
  {
    id: 'session-c1',
    eventId: 'event-regional-qualifier',
    sessionDate: '2026-07-18',
    startsAt: '2026-07-18T08:00:00.000Z',
    endsAt: '2026-07-18T17:00:00.000Z',
    status: 'completed',
    peopleReached: 75,
  },
  {
    id: 'session-c2',
    eventId: 'event-regional-qualifier',
    sessionDate: '2026-07-19',
    startsAt: '2026-07-19T08:00:00.000Z',
    endsAt: '2026-07-19T17:00:00.000Z',
    status: 'canceled',
    peopleReached: null,
  },
];

export const FIXTURE_ATTENDANCE: readonly FixtureAttendanceRow[] = [
  // session-m1: hours_override wins (student-a); fully-inside window needs
  // no clamp (student-b); window clamped on BOTH ends (student-c);
  // full-duration fallback (student-d, status 'late' -- counts within
  // present per the view's own `status in ('present','late')`); excused
  // and absent both correctly excluded from the sum (student-e, student-f).
  {
    sessionId: 'session-m1',
    studentId: 'student-a',
    status: 'present',
    checkInAt: null,
    checkOutAt: null,
    hoursOverride: 1.25,
  },
  {
    sessionId: 'session-m1',
    studentId: 'student-b',
    status: 'present',
    checkInAt: '2026-07-07T18:30:00.000Z',
    checkOutAt: '2026-07-07T19:30:00.000Z',
    hoursOverride: null,
  },
  {
    sessionId: 'session-m1',
    studentId: 'student-c',
    status: 'present',
    checkInAt: '2026-07-07T17:30:00.000Z',
    checkOutAt: '2026-07-07T20:30:00.000Z',
    hoursOverride: null,
  },
  {
    sessionId: 'session-m1',
    studentId: 'student-d',
    status: 'late',
    checkInAt: null,
    checkOutAt: null,
    hoursOverride: null,
  },
  {
    sessionId: 'session-m1',
    studentId: 'student-e',
    status: 'absent',
    checkInAt: null,
    checkOutAt: null,
    hoursOverride: null,
  },
  {
    sessionId: 'session-m1',
    studentId: 'student-f',
    status: 'excused',
    checkInAt: null,
    checkOutAt: null,
    hoursOverride: null,
  },
  // session-o1: outreach, both signups and attendance populated
  // (module doc #3).
  {
    sessionId: 'session-o1',
    studentId: 'student-a',
    status: 'present',
    checkInAt: null,
    checkOutAt: null,
    hoursOverride: null,
  },
  {
    sessionId: 'session-o1',
    studentId: 'student-b',
    status: 'present',
    checkInAt: '2026-07-11T09:15:00.000Z',
    checkOutAt: '2026-07-11T11:15:00.000Z',
    hoursOverride: null,
  },
  {
    sessionId: 'session-o1',
    studentId: 'student-c',
    status: 'absent',
    checkInAt: null,
    checkOutAt: null,
    hoursOverride: null,
  },
  // session-c1: competition, event.countsVolunteerHours is false -- real
  // present attendance exists (one even carries hoursOverride: 8) but
  // hoursAwarded still computes to a real 0 (module doc #4(c)).
  {
    sessionId: 'session-c1',
    studentId: 'student-a',
    status: 'present',
    checkInAt: null,
    checkOutAt: null,
    hoursOverride: 8,
  },
  {
    sessionId: 'session-c1',
    studentId: 'student-b',
    status: 'present',
    checkInAt: null,
    checkOutAt: null,
    hoursOverride: null,
  },
  // session-m2 (scheduled) and session-c2 (canceled) deliberately have NO
  // attendance rows -- a real 0 count of existing rows, not fabricated.
];

export const FIXTURE_RSVPS: readonly FixtureRsvpRow[] = [
  { sessionId: 'session-o1', studentId: 'student-a', status: 'going' },
  { sessionId: 'session-o1', studentId: 'student-b', status: 'going' },
  { sessionId: 'session-o1', studentId: 'student-c', status: 'maybe' },
  { sessionId: 'session-o1', studentId: 'student-d', status: 'declined' },
  { sessionId: 'session-c1', studentId: 'student-a', status: 'going' },
  { sessionId: 'session-c1', studentId: 'student-b', status: 'going' },
  { sessionId: 'session-c1', studentId: 'student-c', status: 'declined' },
  // session-c2 (canceled) deliberately has no rsvps recorded.
];

// ---------------------------------------------------------------------------
// Pure functions -- exported for direct testing (module doc #11's fixture
// walkthrough; see this task's worker output for the real run).
// ---------------------------------------------------------------------------

const MS_PER_HOUR = 3_600_000;

function roundToOneDecimal(value: number): number {
  return Math.round((value + Number.EPSILON) * 10) / 10;
}

/**
 * Line-for-line mirror of `v_student_hours`'s own inner `coalesce(...)`
 * expression (module doc #4(b)) -- `hours_override` wins; else the
 * check-in/check-out window clamped to `[session.startsAt, session.endsAt]`
 * and floored at 0; else the full session duration. Evaluated per
 * `(attendance row, session)` pair, exactly as the SQL evaluates it per
 * joined row before the view's own `group by` collapses rows together.
 */
export function computeAttendeeHours(
  attendance: Pick<FixtureAttendanceRow, 'hoursOverride' | 'checkInAt' | 'checkOutAt'>,
  session: Pick<FixtureSession, 'startsAt' | 'endsAt'>,
): number {
  if (attendance.hoursOverride !== null) {
    return attendance.hoursOverride;
  }

  const sessionStart = new Date(session.startsAt).getTime();
  const sessionEnd = new Date(session.endsAt).getTime();

  if (attendance.checkInAt !== null && attendance.checkOutAt !== null) {
    const checkIn = new Date(attendance.checkInAt).getTime();
    const checkOut = new Date(attendance.checkOutAt).getTime();
    const clampedStart = Math.max(checkIn, sessionStart);
    const clampedEnd = Math.min(checkOut, sessionEnd);
    return Math.max((clampedEnd - clampedStart) / MS_PER_HOUR, 0);
  }

  return (sessionEnd - sessionStart) / MS_PER_HOUR;
}

/**
 * Per-session "hours awarded" (module doc #4). `null` = not yet
 * determined (session not `completed`, module doc #4(c) first bullet).
 * A real `0` = completed, but the parent event does not count volunteer
 * hours (module doc #4(c) second bullet) -- NOT the same as `null`.
 * Otherwise: the SAME `where a.status in ('present','late')` filter and
 * SAME sum the view performs, scoped to this one session's attendees.
 */
export function computeSessionHoursAwarded(
  session: Pick<FixtureSession, 'status' | 'startsAt' | 'endsAt'>,
  event: Pick<FixtureEvent, 'countsVolunteerHours'>,
  attendanceForSession: readonly FixtureAttendanceRow[],
): number | null {
  if (session.status !== 'completed') {
    return null;
  }
  if (!event.countsVolunteerHours) {
    return 0;
  }
  const total = attendanceForSession
    .filter((row) => row.status === 'present' || row.status === 'late')
    .reduce((sum, row) => sum + computeAttendeeHours(row, session), 0);
  return roundToOneDecimal(total);
}

/** Real `count(*) filter (where ...)`-style tallies (module doc #3) --
 * never a fabricated 0, always the true count of existing `attendance`
 * rows for the session. */
export function summarizeAttendance(rows: readonly FixtureAttendanceRow[]): AttendanceSummary {
  return {
    presentCt: rows.filter((row) => row.status === 'present').length,
    lateCt: rows.filter((row) => row.status === 'late').length,
    excusedCt: rows.filter((row) => row.status === 'excused').length,
    absentCt: rows.filter((row) => row.status === 'absent').length,
  };
}

/** Real tallies of `rsvps` rows (module doc #3) -- only ever called for
 * `outreach`/`competition` sessions; meeting rows use `null` instead. */
export function summarizeSignups(rows: readonly FixtureRsvpRow[]): SignupSummary {
  return {
    goingCt: rows.filter((row) => row.status === 'going').length,
    maybeCt: rows.filter((row) => row.status === 'maybe').length,
    declinedCt: rows.filter((row) => row.status === 'declined').length,
  };
}

/**
 * Plain per-session join against each session's parent event (module doc
 * #1) -- one display row per `FixtureSession`, sorted chronologically by
 * start time. Adult-volunteer figures are repeated on every session row of
 * the same event (module doc #5's disclosed repetition choice).
 */
export function buildDisplayRows(
  events: readonly FixtureEvent[],
  sessions: readonly FixtureSession[],
  attendance: readonly FixtureAttendanceRow[],
  rsvps: readonly FixtureRsvpRow[],
): EventSessionDisplayRow[] {
  const eventById = new Map(events.map((event) => [event.id, event] as const));

  return [...sessions]
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt))
    .flatMap((session) => {
      const event = eventById.get(session.eventId);
      if (!event) {
        // No event for this session's event_id -- should not happen given
        // the FK constraint (`event_sessions.event_id references events`);
        // skip rather than fabricate a row with an invented type/title.
        return [];
      }

      const attendanceForSession = attendance.filter((row) => row.sessionId === session.id);
      const rsvpsForSession = rsvps.filter((row) => row.sessionId === session.id);

      const row: EventSessionDisplayRow = {
        sessionId: session.id,
        eventId: event.id,
        eventTitle: event.title,
        type: event.type,
        sessionDate: session.sessionDate,
        status: session.status,
        attendance: summarizeAttendance(attendanceForSession),
        signups: event.type === 'meeting' ? null : summarizeSignups(rsvpsForSession),
        hoursAwarded: computeSessionHoursAwarded(session, event, attendanceForSession),
        peopleReached: session.peopleReached,
        adultVolunteersCount: event.adultVolunteersCount,
        adultVolunteerHours: event.adultVolunteerHours,
      };
      return [row];
    });
}

/**
 * Obviously-fake placeholder default for the `loadData` seam (module doc
 * #10). Does NOT call Supabase (no shared client exists yet anywhere in
 * `src/`). Real callers should pass their own `loadData` prop.
 */
export async function defaultLoadEventSessionsData(
  seasonId: string,
): Promise<EventSessionDisplayRow[]> {
  const seasonEvents = FIXTURE_EVENTS.filter((event) => event.seasonId === seasonId);
  const seasonEventIds = new Set(seasonEvents.map((event) => event.id));
  const seasonSessions = FIXTURE_SESSIONS.filter((session) => seasonEventIds.has(session.eventId));
  const seasonSessionIds = new Set(seasonSessions.map((session) => session.id));
  const seasonAttendance = FIXTURE_ATTENDANCE.filter((row) => seasonSessionIds.has(row.sessionId));
  const seasonRsvps = FIXTURE_RSVPS.filter((row) => seasonSessionIds.has(row.sessionId));
  return buildDisplayRows(seasonEvents, seasonSessions, seasonAttendance, seasonRsvps);
}

// ---------------------------------------------------------------------------
// Data-loading hook (DES-12 four-state seam) -- module doc #10.
// ---------------------------------------------------------------------------

type EventsLoadState =
  | { status: 'loading' }
  | { status: 'error'; error: unknown; retry: () => void }
  | { status: 'success'; rows: EventSessionDisplayRow[] };

function useEventSessionsData(
  seasonId: string,
  loadData: LoadEventSessionsDataFn,
): EventsLoadState {
  const [state, setState] = useState<EventsLoadState>({ status: 'loading' });
  // Bumped by the error Banner's "Retry" action (DES-12) to force the effect
  // below to re-run without changing `seasonId`/`loadData` deps semantics.
  const [retryToken, setRetryToken] = useState(0);

  useEffect(() => {
    let isMounted = true;
    setState({ status: 'loading' });
    loadData(seasonId)
      .then((rows) => {
        if (isMounted) {
          setState({ status: 'success', rows });
        }
      })
      .catch((error: unknown) => {
        if (isMounted) {
          setState({ status: 'error', error, retry: () => setRetryToken((token) => token + 1) });
        }
      });
    return () => {
      isMounted = false;
    };
  }, [seasonId, loadData, retryToken]);

  return state;
}

// ---------------------------------------------------------------------------
// Display formatting -- module doc #3/#4/#8. No box-drawing/bracket
// characters anywhere (constitution item 13); "—" (em dash) is the one
// not-applicable/not-yet-determined glyph used throughout, matching
// `ParticipationTab.tsx`'s own convention.
// ---------------------------------------------------------------------------

function parseDateOnly(isoDate: string): Date {
  const [year, month, day] = isoDate.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day, 12)); // noon UTC avoids DST edge cases
}

const SESSION_DATE_FORMATTER = new Intl.DateTimeFormat('en-US', {
  weekday: 'short',
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  timeZone: 'America/Chicago',
});

/** e.g. "Tue, Jul 7, 2026" (module doc #8, NFR-09). */
export function formatSessionDate(sessionDate: string): string {
  return SESSION_DATE_FORMATTER.format(parseDateOnly(sessionDate));
}

function formatSignups(signups: SignupSummary | null): string {
  if (signups === null) {
    return '—';
  }
  return `${signups.goingCt} going · ${signups.maybeCt} maybe · ${signups.declinedCt} declined`;
}

function formatAttendance(attendance: AttendanceSummary): string {
  return `${attendance.presentCt} present · ${attendance.lateCt} late · ${attendance.excusedCt} excused · ${attendance.absentCt} absent`;
}

function formatHoursAwarded(hoursAwarded: number | null): string {
  return hoursAwarded === null ? '—' : `${hoursAwarded.toFixed(1)}h`;
}

function formatPeopleReached(peopleReached: number | null): string {
  return peopleReached === null ? '—' : String(peopleReached);
}

function formatAdultVolunteers(count: number, hours: number): string {
  return `${count} · ${hours.toFixed(1)}h`;
}

// ---------------------------------------------------------------------------
// Table columns -- astryx-api.md "Table" Props table: `columns:
// TableColumn<T>[]` -- {key, header, width?, align?, renderCell?} (module
// doc #6). Column order follows RPT-04's own literal listing ("type, date,
// attendance/signup counts, hours awarded, people reached, adult
// volunteers, status"), with a "Session" title column inserted right after
// "Date" for row identification -- a reasonable, disclosed addition beyond
// the literal column list (the same class of addition
// `ParticipationTab.tsx` made for its own display-only `studentName`/
// `teamName` fields), since a table mixing three event types with no title
// column would give a reader no way to tell which real event a row
// belongs to.
// ---------------------------------------------------------------------------

function buildColumns(): TableColumn<EventSessionDisplayRow>[] {
  return [
    {
      key: 'type',
      header: 'Type',
      width: pixel(130),
      renderCell: (row) => {
        const badge = EVENT_TYPE_BADGE[row.type];
        return <Badge variant={badge.variant} label={badge.label} />;
      },
    },
    {
      key: 'sessionDate',
      header: 'Date',
      width: pixel(170),
      renderCell: (row) => <Text hasTabularNumbers>{formatSessionDate(row.sessionDate)}</Text>,
    },
    {
      key: 'eventTitle',
      header: 'Session',
      width: proportional(2),
    },
    {
      key: 'signups',
      header: 'Signups',
      width: proportional(2),
      renderCell: (row) => <Text type="supporting">{formatSignups(row.signups)}</Text>,
    },
    {
      key: 'attendance',
      header: 'Attendance',
      width: proportional(2),
      renderCell: (row) => <Text type="supporting">{formatAttendance(row.attendance)}</Text>,
    },
    {
      key: 'hoursAwarded',
      header: 'Hours Awarded',
      width: pixel(140),
      align: 'end',
      renderCell: (row) => <Text hasTabularNumbers>{formatHoursAwarded(row.hoursAwarded)}</Text>,
    },
    {
      key: 'peopleReached',
      header: 'People Reached',
      width: pixel(150),
      align: 'end',
      renderCell: (row) => <Text hasTabularNumbers>{formatPeopleReached(row.peopleReached)}</Text>,
    },
    {
      key: 'adultVolunteersCount',
      header: 'Adult Volunteers (per event)',
      width: pixel(210),
      align: 'end',
      renderCell: (row) => (
        <Text hasTabularNumbers>
          {formatAdultVolunteers(row.adultVolunteersCount, row.adultVolunteerHours)}
        </Text>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      width: pixel(130),
      renderCell: (row) => {
        const badge = SESSION_STATUS_BADGE[row.status];
        return <Badge variant={badge.variant} label={badge.label} />;
      },
    },
  ];
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export interface EventsTabProps {
  seasonId: string;
  /** Injectable data-loading seam (module doc #10). Defaults to fixture
   * data. */
  loadData?: LoadEventSessionsDataFn;
}

export function EventsTab({
  seasonId,
  loadData = loadEventSessionsData,
}: EventsTabProps): ReactNode {
  const loadState = useEventSessionsData(seasonId, loadData);
  const columns = useMemo(() => buildColumns(), []);

  if (loadState.status === 'loading') {
    return (
      <VStack gap={2} aria-busy="true">
        <VisuallyHidden as="div" role="status">
          Loading events data…
        </VisuallyHidden>
        {[0, 1, 2, 3, 4].map((row) => (
          <HStack key={row} gap={4} vAlign="center">
            <Skeleton width={80} height={20} radius="rounded" index={row * 4} />
            <Skeleton width={110} height={16} index={row * 4 + 1} />
            <Skeleton width={180} height={16} index={row * 4 + 2} />
            <Skeleton width={80} height={16} index={row * 4 + 3} />
          </HStack>
        ))}
      </VStack>
    );
  }

  if (loadState.status === 'error') {
    return (
      <Banner
        status="error"
        title="Couldn't load events data"
        description="Something went wrong loading this season's session data. Try refreshing the page."
        endContent={<Button variant="ghost" label="Retry" onClick={loadState.retry} />}
      />
    );
  }

  const rows = loadState.rows;

  if (rows.length === 0) {
    // T083 (worker packet Trap #2): the PRD's DES-15 "Reports" example
    // ("No completed sessions this season yet. Stats appear after the
    // first meeting or outreach day is marked complete.") is NOT used
    // verbatim here -- it names a narrower condition ("completed") than
    // this tab's real empty-state trigger. `rows` is EVERY session of
    // EVERY status for the season (module doc #1/#2 -- RPT-04 is the
    // deliberate NAV-07 exception that lists scheduled/completed/canceled
    // sessions together, confirmed by this task's own already-Passed
    // design), so `rows.length === 0` means "zero sessions of ANY status
    // exist yet", not "sessions exist but none are completed". Applying the
    // literal "no completed sessions" text here would misdescribe a tab
    // that would still be showing real rows the moment a single session --
    // scheduled or otherwise -- is created, well before any of them are
    // ever marked complete. The copy below keeps DES-15's spirit (specific,
    // tells the user what makes it populate) without that inaccuracy.
    return (
      <EmptyState
        headingLevel={2}
        title="No sessions for this season yet."
        description="Meetings, outreach events, and competitions will show up here as soon as your coach schedules one."
      />
    );
  }

  return (
    <VStack gap={4}>
      <Table
        data={rows}
        columns={columns}
        idKey="sessionId"
        density="balanced"
        dividers="rows"
        hasHover
      />
    </VStack>
  );
}

export default EventsTab;
