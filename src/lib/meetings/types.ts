/**
 * @file types.ts
 * @position GAM-444: the frozen `/meetings` redesign type contracts. Five
 *   parallel tickets (GAM-445…452) code against the names in this file, so
 *   they are moved here verbatim from `src/pages/meetings/MeetingsList.tsx`
 *   rather than re-derived -- see that file's own module doc for the
 *   original numbered sections (`#1`, `#2`, `#3` -- ground truth column
 *   shapes, the NAV-07 meeting-type filter and the `v_student_participation`
 *   shape) these types were originally documented under; those sections
 *   moved to `src/lib/meetings/coachModel.ts` alongside the fixture/builder
 *   code they primarily describe (GAM-444 §6b).
 *
 *   `Team` (below) is a 21st moved type, not itself part of the five-ticket
 *   frozen list (GAM-444 packet §4) -- it is `CoachMeetingsData.teams`'
 *   element type and was declared locally, unexported, in `MeetingsList.tsx`;
 *   `CoachMeetingsData` cannot typecheck without it, so it travels here too.
 *
 *   `Role` (imported below, from `../../app/guards`) makes this `src/lib/**`
 *   module depend on `src/app/**`. Accepted deliberately (GAM-444 packet §4):
 *   `guards.tsx`'s `Role` is the app-wide role vocabulary, not a page module,
 *   so importing it is not the `lib -> pages` inversion GAM-444 §5 exists to
 *   remove.
 *
 *   `MeetingsFocusRequest`, `SeriesCardModel` and `OverlapIndex` are ADDED
 *   here, new, empty of behaviour -- GAM-444 packet §4. `SeriesCardModel`'s
 *   field list is copied from `docs/swarm/VOLT_Portal_PRD.md:303-313`
 *   (MTG-01a), not invented; `eventId`/`paletteIndex` are the two fields
 *   MTG-01a does not name, added because the rendering needs them and
 *   MTG-01a does not forbid it. `OverlapIndex` is a TYPE ONLY -- the builder
 *   (`buildOverlapIndex`) and its home (`src/lib/meetings/overlap.ts`) belong
 *   to GAM-450, not this ticket.
 *
 *   `Dow`/`ScheduleRule` are NOT defined here even though the
 *   `meetings-design` skill's table says `buildScheduleChips`' input shape is
 *   "frozen by GAM-444 in `types.ts`" -- GAM-443 already shipped both in
 *   `src/lib/meetings/format.ts:202,204-211`. Re-exporting the existing
 *   definition (below) keeps exactly one definition of each, per
 *   `format.ts:168-169`'s own note that the shape GAM-443 shipped was always
 *   meant to be "published at the frozen address, not replaced."
 *   `ScheduleRule` cannot express a midnight-spanning rule (`format.ts:180-183`);
 *   every one of the five downstream tickets inherits that limitation.
 *
 * @output The 20 frozen names listed in the GAM-444 packet §4, plus `Team`,
 *   plus `MeetingsFocusRequest`/`SeriesCardModel`/`OverlapIndex`, plus a
 *   re-export of `Dow`/`ScheduleRule` from `./format`.
 */
import type { Role } from '../../app/guards';

export type { Dow, ScheduleRule } from './format';

export type EventType = 'meeting' | 'outreach' | 'competition';

export type SessionStatus = 'scheduled' | 'completed' | 'canceled';

export type AttendanceStatus = 'present' | 'late' | 'excused' | 'absent';

export interface Team {
  id: string;
  name: string;
  /** T615/GAM-305 -- `teams.archived boolean not null default false`
   * (`20260716000000_identity_roster.sql`), REQUIRED so `tsc` polices every
   * construction site (`ScheduleTeamOption`'s own required field, which this
   * type is passed into at `ScheduleMeetingsDialog`'s `teams` prop). See
   * `src/lib/teams/archivedTeams.ts`. */
  archived: boolean;
}

/** Plain per-session tally (module doc #3 -- NOT a percentage). */
export interface PastAttendanceSummary {
  presentCt: number;
  lateCt: number;
  excusedCt: number;
  absentCt: number;
}

/** T122 (module doc #10a) -- one of a `CoachMeetingRow`'s own sessions,
 * shown in that row's in-place expander (UXD-03). */
export interface CoachMeetingSessionDetail {
  sessionId: string;
  sessionDate: string;
  startsAt: string;
  endsAt: string;
  status: SessionStatus;
  /** Plain scheduled-duration arithmetic (module doc #10b) -- never a
   * metric-view formula. */
  durationHours: number;
  /** Real RSVP `status === 'going'` COUNT for this session (module doc
   * #10a) -- a plain filter+length, not a percentage. */
  expectedCt: number;
  /** Populated for `status === 'completed'` sessions only; `null` otherwise
   * (module doc #3, unchanged). */
  attendanceSummary: PastAttendanceSummary | null;
  /** Real `students.display_name` values for this session's present/late
   * attendance rows (module doc #10a) -- empty for a non-completed session
   * (no attendance exists yet to name). */
  attendeeNames: readonly string[];
  /** T605 -- optional, same reasoning as `FixtureEventSession.notes` above.
   * `buildCoachMeetingRows` below always sets this to a real string
   * (`session.notes ?? ''`), never leaves it `undefined` on a built row --
   * optional only so the type itself stays additive over every pre-existing
   * literal `CoachMeetingSessionDetail` in this file's own test file. */
  notes?: string;
}

/** T122 (module doc #10a) -- now one row per meeting EVENT (recurring
 * series), not per session; `sessions` (below) carries the per-session
 * facts the expander (UXD-03) renders. */
export interface CoachMeetingRow {
  eventId: string;
  title: string;
  locationName: string;
  teamScopeLabel: string;
  /** Sorted ascending by `startsAt`. */
  sessions: CoachMeetingSessionDetail[];
  /** T510 -- optional (the 3 existing hand-built `CoachMeetingRow` literals in
   * `MeetingsList.test.tsx` need no edit). The event's real `team_ids` (`null`
   * = all teams) -- threaded through so `ScheduleMeetingsDialog`'s edit mode
   * can prefill team scope; `teamScopeLabel` above stays the display-only
   * derived string, unchanged. */
  teamIds?: readonly string[] | null;
  /** T510 -- optional, same reasoning as `teamIds` above. */
  description?: string;
  /**
   * GAM-446 -- `v_event_attendance.attendance_pct` (GAM-442), merged onto
   * this row by `loaders/meetings.ts`'s `makeLoadCoachMeetingsData`, keyed by
   * `eventId`. `number | null`, never widened to a bare `number`: NULL is
   * "—", NEVER a fabricated `0` (constitution item 3 / PRD DATA-01 -- same
   * discipline `SeriesCardModel.attendancePct` above already documents).
   * Optional only because it is additive over every pre-existing
   * `CoachMeetingRow` literal in this file's own test file; a row this
   * loader actually merges onto always sets it (to a real number or `null`,
   * never leaves it `undefined`).
   */
  attendancePct?: number | null;
  /** GAM-446 -- `v_event_attendance.held_ct`. Counts SESSIONS held, not
   * marks -- do not read this as a mark count (see `gradedMarksCt` below). */
  heldCt?: number;
  /**
   * GAM-446 -- `v_event_attendance.graded_marks_ct`. **Mandatory whenever
   * `attendancePct` is rendered, not optional value-wise**: the view's own
   * catalog comment states in capitals that "A CONSUMER THAT RENDERS
   * attendance_pct WITHOUT ALSO RENDERING graded_marks_ct REINTRODUCES
   * D014's KNOWN REGRESSION" -- since T508 an unmarked student normally has
   * no attendance row, so forgetting to mark someone INFLATES the
   * percentage (measured 100% for an event 60% of the roster skipped). This
   * field is the mitigation; a card rendering `attendancePct` must render
   * this too.
   */
  gradedMarksCt?: number;
  /** GAM-446 -- `v_event_attendance.attended_marks_ct` (MET-05: `late`
   * counts as attended). */
  attendedMarksCt?: number;
  /** GAM-446 -- `v_event_attendance.excused_ct`. */
  excusedCt?: number;
}

export interface CoachMeetingsData {
  rows: CoachMeetingRow[];
  /** T147 -- `loaders/meetings.ts`'s `makeLoadCoachMeetingsData` already
   * fetches this (`loadTeamRows`, for `buildCoachMeetingRows`'s own per-row
   * team-scope label) -- threaded through here too so it can reach
   * `<ScheduleMeetingsDialog>`'s own `teams` prop, replacing that dialog's
   * fixture `DEFAULT_TEAMS`. */
  teams: readonly Team[];
}

export type LoadCoachMeetingsDataFn = () => Promise<CoachMeetingsData>;

export interface StudentMeetingHistoryRow {
  sessionId: string;
  title: string;
  /** The event's real, already-loaded location name. */
  locationName: string;
  sessionDate: string;
  startsAt: string;
  endsAt: string;
  status: SessionStatus;
  /** `null` when the session hasn't happened yet (no attendance row exists). */
  myAttendanceStatus: AttendanceStatus | null;
}

/**
 * Verbatim camelCase rename of `v_student_participation`'s seven real
 * columns (module doc #3). A `StudentParticipationMetric | null` value of
 * outer `null` means the student has no row in the view at all (no explicit
 * attendance mark this season). A present row's own `participationPct: null`
 * means every counted mark was `excused` (MET-01, `types.ts`'s
 * `VStudentParticipationRow` doc) -- never a fabricated 0% either way.
 */
export interface StudentParticipationMetric {
  studentId: string;
  teamId: string;
  seasonId: string;
  expectedCt: number;
  presentCt: number;
  lateCt: number;
  excusedCt: number;
  participationPct: number | null;
}

export interface StudentMeetingsData {
  history: StudentMeetingHistoryRow[];
  participation: StudentParticipationMetric | null;
}

export type LoadStudentMeetingsDataFn = (studentId: string) => Promise<StudentMeetingsData>;

/** T096 (module doc #7c) -- the real `event_sessions.status = 'canceled'` mutation seam. */
export type CancelMeetingSessionFn = (sessionId: string) => Promise<void>;

/**
 * T096 (module doc #6, Trap #4) -- the minimal identity shape
 * `resolveCurrentStudentId` needs: `AuthUser.id` (== `auth.uid()` ==
 * `profiles.id`) and `AuthUser.role`, never the full `AuthUser`/`AuthContextValue`
 * (this file has no other use for e.g. `email`).
 */
export interface CurrentViewerIdentity {
  id: string;
  role: Role;
}

/** T096 (module doc #6, Trap #4) -- resolves the real `students.id` this
 * viewer's student/parent view should be scoped to; `null` when none can be
 * resolved (no linked student yet). */
export type ResolveCurrentStudentIdFn = (viewer: CurrentViewerIdentity) => Promise<string | null>;

export interface PartitionedRows<T> {
  upcoming: T[];
  past: T[];
}

/** T122 (module doc #10b) -- everything a `CoachMeetingRow`'s summary line
 * needs, derived purely from its own `sessions`. Exported for direct
 * testing. */
export interface CoachMeetingRowSummary {
  /** UXD-02 recurrence chips, e.g. `["MON (3)", "THU (2)"]`. Empty for a
   * single-session event (the date range line covers that case alone). */
  recurrenceChips: string[];
  /** e.g. "Sat, Jul 25" (single session) or "Sat, Jul 25 – Thu, Aug 13"
   * (multi-session), BEH-08's own weekday-date format. */
  dateRangeLabel: string;
  /** Sum of every non-canceled session's own `durationHours`. */
  plannedHours: number;
  /** Sum of every COMPLETED session's own `durationHours`. */
  loggedHours: number;
  /** Sum of every session's own `expectedCt` (cumulative across the whole
   * series -- module doc #10b). */
  expectedCt: number;
  /** Sum of every completed session's present+late count (cumulative). */
  attendedCt: number;
  /** True when at least one of this row's sessions is still `'scheduled'`. */
  hasUpcomingSession: boolean;
  /** Sort key: nearest-upcoming session's `startsAt` when
   * `hasUpcomingSession`, else the LATEST session's `startsAt`. */
  sortStartsAt: string;
  canceledCt: number;
}

// ---------------------------------------------------------------------------
// T135 -- `Table` row shape. `extends Record<string, unknown>` is required
// by `Table`'s own generic constraint (`astryx-api.md` "Table" Props table,
// `data: T[]`), the same idiom `OutreachList.tsx`'s `CoachEventTableRow`
// already established.
// ---------------------------------------------------------------------------

export interface CoachMeetingEventTableRow extends Record<string, unknown> {
  kind: 'event';
  id: string;
  row: CoachMeetingRow;
  summary: CoachMeetingRowSummary;
}

export interface CoachMeetingSessionDetailTableRow extends Record<string, unknown> {
  kind: 'sessionDetail';
  id: string;
  eventId: string;
  eventTitle: string;
  session: CoachMeetingSessionDetail;
}

export type CoachMeetingTableRow = CoachMeetingEventTableRow | CoachMeetingSessionDetailTableRow;

// ---------------------------------------------------------------------------
// Added new, empty of behaviour (GAM-444 packet §4). Not moved from anywhere.
// ---------------------------------------------------------------------------

/** Frozen by GAM-444; MeetingsRail and SeriesCard both read it. */
export interface MeetingsFocusRequest {
  eventId: string;
  sessionId?: string;
  monthKey?: string;
}

/**
 * One coach series `Card`'s worth of data (MTG-01a,
 * `docs/swarm/VOLT_Portal_PRD.md:303-313`) -- one per meeting EVENT
 * (recurring series), not per session. Field list copied from MTG-01a, not
 * inferred; `eventId`/`paletteIndex` are the two fields MTG-01a does not
 * name, added because the rendering needs them and MTG-01a does not forbid
 * it (GAM-444 packet §4, "least confident decisions" #3).
 */
export interface SeriesCardModel {
  /** The real `events.id` this card renders -- also the input to the
   * deterministic palette-index hash (`meetings-design` skill, "Series
   * identity color"). */
  eventId: string;
  /** MTG-01a "title". */
  title: string;
  /** MTG-01a "team scope". */
  teamScopeLabel: string;
  /** MTG-01a "schedule chips" -- one per weekday-with-time rule, e.g.
   * `Tue 6–8 PM`. Built by `buildScheduleChips` (`./format`) from this
   * series' own `ScheduleRule[]`. */
  scheduleChips: string[];
  /** MTG-01a "season progress (sessions completed of total)" numerator. */
  sessionsCompleted: number;
  /** MTG-01a "season progress (sessions completed of total)" denominator. */
  sessionsTotal: number;
  /**
   * MTG-01a "attendance % across completed sessions".
   *
   * ⚠ **`number | null`, never widened to a bare `number`.** MTG-01a's last
   * sentence is binding: "The attendance % is **DATA-01 passthrough** from
   * the metric view (null → '—'), never computed in TypeScript." Freezing
   * this as `number` would hand every downstream ticket a type that cannot
   * represent `—` and would force a fabricated `0` -- computing it in
   * TypeScript instead is a **BLOCKER** under constitution item 3.
   */
  attendancePct: number | null;
  /**
   * `v_event_attendance.graded_marks_ct` -- D014's mitigation, mandatory
   * whenever `attendancePct` is rendered. Since T508 an unmarked student has
   * no attendance row, so forgetting to mark someone INFLATES `attendancePct`
   * rather than deflating it (measured 100% for an event 60% of the roster
   * skipped). The view's own catalog comment states in capitals that a
   * consumer rendering `attendance_pct` without also rendering
   * `graded_marks_ct` reintroduces D014's known regression
   * (`20260821000000_meetings_event_attendance_view.sql`, column comment on
   * `graded_marks_ct`). A real SQL `count(...)`, never NULL -- unlike
   * `attendancePct`, this field has no "no data yet" state to represent.
   * GAM-460.
   */
  gradedMarksCt: number;
  /** MTG-01a "a next-session line ('Next: Tue, Aug 26 · 6–8 PM'), or the
   * finished state" -- `null` means finished (no scheduled session
   * remains); the rendering supplies the "finished" copy itself, not this
   * field. */
  nextSessionLabel: string | null;
  /** Deterministic palette slot, hashed from `eventId` (`meetings-design`
   * skill, "Series identity color") -- never array position, which would
   * change when a series is added or a filter is applied. Not itself a
   * color; the hues are still an open owner decision (GAM-444 packet §0b). */
  paletteIndex: number;
}

/**
 * A single session's overlap references -- `meetings-design` skill,
 * "Overlap badges": only sessions from DIFFERENT series overlap; same
 * Chicago calendar day; intervals genuinely intersect
 * (`a.start < b.end && b.start < a.end`, so touching intervals do NOT
 * overlap); a canceled session never overlaps anything.
 *
 * TYPE ONLY -- `buildOverlapIndex` and its home (`src/lib/meetings/overlap.ts`)
 * belong to GAM-450, not this ticket (GAM-444 packet §4).
 */
export interface OverlapRef {
  sessionId: string;
  eventId: string;
}

/** Map from a session id to the sessions (from other series) it overlaps. */
export type OverlapIndex = ReadonlyMap<string, readonly OverlapRef[]>;
