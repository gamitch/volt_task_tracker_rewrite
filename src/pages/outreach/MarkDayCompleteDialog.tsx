/**
 * T042: "Mark day complete" `Dialog` (OUT-05, coach-only), PRD line 296:
 *
 * "**OUT-05 Mark day complete (coach):** on/after a session date, **Mark day
 * complete** opens a `Dialog`: attendee checklist pre-checked from `going`
 * RSVPs (coach adjusts), actual **people reached** (`NumberInput`), optional
 * per-student hours override (`NumberInput`, defaults to session duration,
 * for partial attendance). Confirm -> session `completed`; checked students
 * get `attendance` rows (`method='coach'`, status `present`); hours computed
 * per MET-03. Not reversible without edit (audit-logged)."
 *
 * The PRD's own wireframe (line 469-481) additionally shows an "Adult
 * volunteers [4] count · [12] hours" row inside this same dialog (between
 * "People reached" and "Hours per student") -- this task's own packet
 * (Known Context/Traps #6) requires that field be built here too, WITH its
 * real event-vs-session granularity mismatch explicitly resolved (module doc
 * #3 below), not silently papered over.
 *
 * This is a standalone dialog component with its own injectable
 * `onMarkComplete` prop and its own fixture roster/session (Known Context/
 * Traps #7 / this task's Forbidden Files) -- `OutreachDetail.tsx` (T041) is a
 * forbidden/read-only file here and is NOT wired to this dialog by this task;
 * a future wiring task connects that page's own (currently-stubbed)
 * "Mark day complete" action to this component with its real fetched
 * session/roster/rsvps data.
 *
 * -----------------------------------------------------------------------
 * 1. Ground truth -- `attendance`/`event_sessions`/`events` column shapes,
 *    cited directly from
 *    `supabase/migrations/20260717000000_scheduling_attendance.sql`
 *    (read-only), NOT redefined/renamed with invented fields:
 *
 *    `attendance` (lines 82-95): id, session_id fk `event_sessions`
 *    (restrict), student_id fk `students` (restrict), status text
 *    check(`'present'|'late'|'excused'|'absent'`), check_in_at timestamptz
 *    null, check_out_at timestamptz null, hours_override numeric null,
 *    method text check(`'qr'|'coach'|'import'`), recorded_by uuid references
 *    `profiles (id)` nullable, updated_at, created_at, unique(session_id,
 *    student_id).
 *
 *    `event_sessions` (lines 53-63): id, event_id, session_date (date),
 *    starts_at (timestamptz), ends_at (timestamptz), status (check:
 *    'scheduled' | 'completed' | 'canceled'), people_reached (int, null),
 *    notes, created_at.
 *
 *    `events` (lines 33-48): ..., adult_volunteers_count (int, not null
 *    default 0), adult_volunteer_hours (numeric, not null default 0), ...
 *    -- these two columns live on `events`, NOT `event_sessions` (module doc
 *    #3, the granularity mismatch).
 *
 *    `RosterStudent`/`RsvpRow`/`MarkDayCompleteSession` below are camelCase
 *    renames of the subset of these columns (plus `rsvps`, migration lines
 *    67-76) this dialog needs, matching `OutreachDetail.tsx`'s (T041,
 *    Forbidden Files, read-only reference per this task's own Dependencies)
 *    own field names/casing exactly (id, sessionId/eventId, studentId,
 *    status, respondedBy, updatedAt, createdAt / id, eventId, sessionDate,
 *    startsAt, endsAt, status, peopleReached, notes) so a future wiring task
 *    can pass its already-fetched objects straight through with no
 *    reshaping -- independently reimplemented here (not imported), since
 *    `OutreachDetail.tsx`/`RsvpControl.tsx` are both Forbidden Files for this
 *    task.
 *
 * -----------------------------------------------------------------------
 * 2. THE MET-03 FORMULA-OWNERSHIP TRAP (Known Context/Traps #1 -- the single
 *    most important distinction in this task, constitution item 3,
 *    BLOCKER-class if gotten wrong). Read `v_student_hours`
 *    (`supabase/migrations/20260717000003_metric_views.sql` lines 3-19,
 *    read-only, cited here for context only) BEFORE reading this section:
 *
 *      sum(coalesce(
 *        a.hours_override,
 *        case when check_in_at/check_out_at both present
 *          then clamp(check_out - check_in, session window)
 *        end,
 *        extract(epoch from (es.ends_at - es.starts_at)) / 3600.0
 *      ))
 *
 *    This dialog is a WRITE path, not a read path -- it does not compute a
 *    student's real confirmed-hours total, ever. It writes (up to) THREE of
 *    that coalesce chain's raw inputs per checked student -- `hours_override`
 *    (tier 1), `check_in_at`/`check_out_at` (tier 2, both always `null` here,
 *    see below), and implicitly relies on `starts_at`/`ends_at` (tier 3,
 *    already stored on `event_sessions`, never rewritten by this dialog) --
 *    and NEVER reproduces the SQL `coalesce`/`case`/`greatest`/`extract`
 *    chain itself in TypeScript. Two, and only two, genuinely legitimate
 *    computations happen client-side, both exported and independently
 *    tested, neither a re-derivation of the view:
 *
 *    (a) `computeSessionDurationHours(session)` -- a single, plain
 *        subtraction, `(ends_at - starts_at) / 3600000`. This IS, verbatim,
 *        MET-03's own tier-3 fallback expression -- but it is computed here
 *        ONLY to seed the per-student `NumberInput`'s displayed starting
 *        value (a sensible default the coach can override for partial
 *        attendance, matching OUT-05's own literal "defaults to session
 *        duration" wording), never presented as a claim about a student's
 *        real confirmed-hours total, and never combined with a coalesce/case
 *        chain over `hours_override`/`check_in_at`/`check_out_at` the way
 *        the view's tier-3 branch actually is. Computing one arithmetic tier
 *        of a three-tier formula, in isolation, for a UI-default purpose, is
 *        not "duplicating a metric formula" in the sense constitution item 3
 *        forbids -- duplicating the formula would mean re-implementing the
 *        `coalesce`/conditional structure that decides WHICH tier wins for a
 *        given row, which this file does not do anywhere (grep-provable: no
 *        `??`/ternary chain here ever inspects `checkInAt`/`checkOutAt` to
 *        decide a fallback -- this dialog never collects check-in/check-out
 *        timestamps at all, see (c) below).
 *
 *    (b) `computeTotalHoursForCheckedStudents(checkedStudentIds,
 *        hoursByStudentId)` -- the BEH-07 confirm button's live "N attended
 *        · M h" total (module doc #4) is a plain `Array.reduce` SUM over the
 *        exact per-student hours values this dialog is ABOUT TO WRITE (each
 *        one either an explicit coach-entered override, or, when untouched,
 *        the same tier-3 default from (a)) -- a local aggregation of this
 *        dialog's OWN pending writes, never a query against
 *        `v_student_hours`, never a sum across other sessions/seasons, never
 *        anything resembling the view's `group by student_id, season_id`
 *        cross-session aggregation. It is legitimate specifically BECAUSE
 *        every value it sums is a value this exact submit is constructing.
 *
 *    (c) The reason (a)+(b) can never silently drift from the real SQL
 *        result for THESE particular rows: `buildAttendanceWriteRows` below
 *        always writes `checkInAt: null, checkOutAt: null` (module doc #6 --
 *        this dialog collects no check-in/check-out timestamps, that is
 *        `CheckinResult.tsx`/`LiveConsole.tsx`'s (T033-adjacent) territory,
 *        not this task's). With `check_in_at`/`check_out_at` both `null` for
 *        every row this dialog creates, `v_student_hours`'s own tier-2 CASE
 *        branch necessarily evaluates to SQL `NULL` for these rows (its
 *        `when` clause literally requires both to be non-null) and
 *        `coalesce` falls through to tier 3 -- so the REAL SQL result for
 *        each of these rows is provably `hours_override ?? tier-3-duration`,
 *        which is EXACTLY the two-tier expression `hoursOverrideByStudentId[id]
 *        ?? defaultDurationHours` this file computes locally. This isn't
 *        "our guess happens to usually match" -- it is a structural
 *        guarantee for rows shaped the way this dialog shapes them, stated
 *        explicitly rather than left as an unexamined coincidence.
 *
 *    Per Ground Truth/module doc #1: `hoursOverrideByStudentId` only ever
 *    holds an entry for a student the coach has EXPLICITLY edited the
 *    per-row `NumberInput` for -- an untouched student's write gets
 *    `hoursOverride: null` (module doc #1's "or leaves it unset to fall back
 *    to session duration" -- a real, provable `null`, not the numeric
 *    default silently written in its place), so the real
 *    `attendance.hours_override` column stays honestly `NULL` for anyone the
 *    coach didn't deliberately override, letting a future season-duration
 *    change (if `event_sessions.starts_at`/`ends_at` were ever corrected)
 *    still flow through `v_student_hours` correctly for that row -- writing
 *    the numeric default unconditionally would have frozen a stale duration
 *    into every row forever, a strictly worse, silent behavior this dialog
 *    deliberately avoids.
 *
 * -----------------------------------------------------------------------
 * 3. THE ADULT-VOLUNTEERS EVENT-VS-SESSION GRANULARITY MISMATCH (Known
 *    Context/Traps #6 -- explicit disclosure required, not silently papered
 *    over).
 *
 * `events.adult_volunteers_count`/`adult_volunteer_hours` (module doc #1)
 * are EVENT-level columns. PRD line 293 (OUT-02, already built by T039, a
 * Forbidden File here) also lists an "adult volunteers (NumberInput x2:
 * count and hours -- persisted on events for grant reporting)" field on the
 * event CREATE/EDIT dialog -- meaning the schema's real intent is a single
 * event-wide total, normally set once. But OUT-05's own wireframe (PRD line
 * 478, quoted at the top of this file) ALSO shows the identical two fields
 * inside THIS dialog, which completes exactly ONE `event_sessions` row at a
 * time. A multi-day outreach event (the same scenario `OutreachDetail.tsx`'s
 * own module doc #4 already flagged for per-session RSVP grouping) would
 * have this dialog opened once PER DAY -- so naively treating these fields
 * as "the event's total, coach edits it live" risks a second day's coach
 * overwriting a first day's already-recorded contribution if they don't
 * realize the field is shared across sessions (the packet's own option (b)
 * risk).
 *
 * RESOLUTION -- option (a) from this task's packet, chosen deliberately:
 * these fields are THIS SESSION'S OWN CONTRIBUTION, not the event's running
 * total. `MarkDayCompletePayload.adultVolunteersCountThisSession`/
 * `adultVolunteerHoursThisSession` (module doc #5) are DELTAS to be ADDED to
 * `events.adult_volunteers_count`/`adult_volunteer_hours`'s current value by
 * whoever performs the real persistence (an additive `UPDATE ... SET
 * adult_volunteers_count = adult_volunteers_count + $delta`, never a raw
 * overwrite) -- not the absolute values to `SET` those columns to. This
 * dialog therefore deliberately never reads/displays the event's current
 * cumulative total at all (no `eventAdultVolunteersCount` prop exists on
 * this component, grep-provable) -- it only ever asks "how many adult
 * volunteers helped, and how many hours did they contribute, TODAY", which
 * is genuinely session-scoped information a coach standing at this specific
 * session can answer accurately regardless of what any other day's coach
 * already recorded, and is honestly re-labeled in the rendered UI ("Adult
 * volunteers (this session)" / "Adult volunteer hours (this session)", not
 * OUT-02's bare "Adult volunteers" label) plus a standalone disclosure
 * `Text` line so a coach isn't misled into thinking they're viewing/editing
 * the event's already-recorded grand total. Both fields default to `0`
 * (module doc #7 -- no live volunteer headcount data source exists yet
 * either), never fetched from `events` (there is nothing to fetch under this
 * resolution). This is a disclosed, defensible judgment call per the
 * packet's own instruction, not a silent assumption -- option (b) (treat the
 * value as the event's live running total, letting the coach see/edit the
 * shared cumulative number directly) was considered and rejected specifically
 * because of the cross-session-overwrite risk described above, which a
 * per-session delta structurally cannot cause.
 *
 * -----------------------------------------------------------------------
 * 4. BEH-07 confirm button states the computed outcome (Known Context/Traps
 *    #2) -- never a bare "Confirm"/"Submit"/"OK" (DES-14, PRD line 210 also
 *    quotes this same discipline generally).
 *
 * `computeMarkCompleteConfirmLabel(attendedCount, totalHours)` is the ONE
 * place this label is produced: `"Mark complete — N attended · M h"`
 * (em dash + middle dot, matching the packet's own literal example text
 * verbatim). Both numbers are recomputed live from the checklist/hours-state
 * on every render (`checkedStudentIds.length` and
 * `computeTotalHoursForCheckedStudents`, module doc #2(b)) -- proven in the
 * test file by toggling a checklist row and asserting the button's own text
 * content changes accordingly, with no page reload/re-open required.
 *
 * -----------------------------------------------------------------------
 * 5. "Not reversible without an audit-logged edit" (Known Context/Traps #3).
 *
 * This dialog performs one one-way action per submit: `onMarkComplete`
 * (module doc #7) is called once, the caller is expected to flip
 * `event_sessions.status` to `'completed'` and insert the `attendance` rows
 * this file constructs -- this task does not build the separate
 * "audit-logged edit" flow itself (presumably `LiveConsole.tsx`/a future
 * task's post-completion-edit path, already noted elsewhere in this project
 * as "attendance remains coach-editable post-completion"). Two concrete,
 * disclosed guardrails this file DOES own:
 *   (i) The footer's only action button, when eligible, is labeled with the
 *       live outcome (module doc #4) -- never "Confirm"/"Undo"/anything
 *       implying reversibility.
 *   (ii) `isSessionEligible = session.status === 'scheduled'` (module doc
 *        #6): if this dialog is ever opened against a session that is
 *        already `'completed'` or `'canceled'`, it renders NO checklist, NO
 *        hours inputs, and NO "Mark complete" action at all -- only an
 *        informational `Banner` explaining the session isn't eligible to be
 *        (re-)completed from this dialog, plus a plain "Close" button. This
 *        prevents this dialog itself from ever being the surface a coach
 *        casually re-runs the one-way action from -- proven in the test file
 *        by rendering with a `'completed'`-status session fixture and
 *        asserting neither the checklist nor the confirm button exists in
 *        the DOM.
 *
 * -----------------------------------------------------------------------
 * 6. Attendee checklist pre-checked from `going` RSVPs, coach adjusts (Known
 *    Context/Traps #4).
 *
 * `computeInitialAttendedStudentIds(sessionId, roster, rsvps)` is the ONE
 * place the checklist's starting state is derived: a roster student with a
 * `rsvps` row `status === 'going'` for this session starts checked; a
 * student with `'maybe'`/`'declined'`/no `rsvps` row at all starts unchecked
 * -- proven directly in the test file with a four-student fixture spanning
 * all four cases. `CheckboxList`'s own `value`/`onChange` (module doc #8)
 * then lets the coach freely re-check/uncheck ANY row afterward regardless
 * of its starting state, proven by toggling both a pre-checked and a
 * not-pre-checked row.
 *
 * -----------------------------------------------------------------------
 * 7. No shared Supabase client wired in (Forbidden Files:
 *    `src/lib/supabase/**` read-only reference only) -- deliberate scope,
 *    same posture as every prior content page/dialog in this batch.
 *
 * The real `event_sessions` status flip + `attendance` inserts + `events`
 * additive adult-volunteer update (module doc #3) are represented as a
 * single injectable `onMarkComplete: (payload) => Promise<void>` prop,
 * defaulting to `defaultOnMarkComplete`, an obviously-fake stub that only
 * `console.warn`s the payload it would have persisted -- same posture as
 * `RsvpControl.tsx`'s `onRsvpChange`/`ScheduleMeetingsDialog.tsx`'s
 * `onCreateMeetings`. `currentUserProfileId` (attributed to
 * `attendance.recorded_by`, a real `profiles.id`, module doc #1) is a
 * SEPARATE injectable prop defaulting to a disclosed, obviously-fake
 * placeholder (`PLACEHOLDER_CURRENT_COACH_PROFILE_ID`) -- the same
 * auth-seam pattern `RsvpControl.tsx`'s own `currentUserProfileId`/
 * `PLACEHOLDER_CURRENT_USER_PROFILE_ID` already established, deliberately
 * given a different literal placeholder string here (this dialog's
 * `recorded_by` is always a COACH's own profile id, never a student's own
 * `responded_by`, a different real-world attribution even though both
 * ultimately resolve to the same `profiles.id` column) so the two files'
 * placeholders are never accidentally interchangeable.
 *
 * -----------------------------------------------------------------------
 * 8. Astryx prop sourcing (constitution item 2) -- every prop used below,
 *    cross-checked directly against `docs/swarm/astryx-api.md` (grepped live
 *    for this task):
 *
 *  - `Dialog` ("Dialog" section, Props table): `isOpen`, `onOpenChange`,
 *    `children`, `purpose` (`"form"`, matching `ScheduleMeetingsDialog.tsx`'s
 *    own citation for an input-collecting dialog) used.
 *  - `DialogHeader`: doc's own "Components > DialogHeader" subsection is
 *    `undefined` (same disclosed gap `ScheduleMeetingsDialog.tsx` already
 *    hit) -- props taken from the "Dialog" section's own worked `## Example`
 *    code block (`title`, `onOpenChange`) plus `subtitle`, independently
 *    confirmed directly against the installed source
 *    (`node_modules/@astryxdesign/core/dist/Dialog/DialogHeader.d.ts`):
 *    `title` (required), `subtitle`, `onOpenChange` used.
 *  - `Layout`/`LayoutContent`/`LayoutFooter`: "Layout" Props table +
 *    `node_modules/@astryxdesign/core/dist/Layout/LayoutContent.d.ts` /
 *    `LayoutFooter.d.ts` (doc's own Components subsections for both are
 *    `undefined`, confirmed directly). `header`, `content`, `footer`
 *    (Layout); `children` (LayoutContent); `children`, `hasDivider`
 *    (LayoutFooter) used.
 *  - `FormLayout` ("FormLayout" section, Props table): `children` used
 *    (default vertical direction, matching the doc's own "stack fields
 *    vertically for most forms" guidance).
 *  - `CheckboxList`/`CheckboxListItem` ("CheckboxList" section, Props table +
 *    `node_modules/@astryxdesign/core/dist/CheckboxList/CheckboxListItem.d.ts`,
 *    doc's own Components subsection is `undefined`, confirmed directly,
 *    same posture `ScheduleMeetingsDialog.tsx` already established for its
 *    own weekday `CheckboxList`). `label`, `value`, `onChange`, `hasDividers`
 *    (CheckboxList); `label`, `value` (CheckboxListItem) used.
 *  - `NumberInput` ("NumberInput" section, Props table): `label`, `value`,
 *    `onChange`, `min`, `step`, `units`, `isIntegerOnly`, `hasClear`,
 *    `isOptional` used.
 *  - `Button` ("Button" section, Props table): `label`, `variant`,
 *    `isDisabled`, `isLoading`, `clickAction`, `onClick` used.
 *  - `Banner` ("Banner" section, Props table): `status`, `title`,
 *    `description` used.
 *  - `HStack`/`VStack` ("Stack" section, `HStack`/`VStack` subsections):
 *    `gap`, `hAlign`, `wrap` used.
 *  - `Text` ("Text" section, Props table): `type` (`'supporting'`), `color`
 *    used.
 */
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  Banner,
  Button,
  CheckboxList,
  CheckboxListItem,
  Dialog,
  DialogHeader,
  FormLayout,
  HStack,
  Layout,
  LayoutContent,
  LayoutFooter,
  NumberInput,
  Text,
  VStack,
} from '@astryxdesign/core';

// ---------------------------------------------------------------------------
// Types -- verbatim camelCase renames of real column subsets. Module doc #1.
// ---------------------------------------------------------------------------

export type SessionStatus = 'scheduled' | 'completed' | 'canceled';
export type RsvpStatus = 'going' | 'maybe' | 'declined';
/** `attendance.status` -- this dialog only ever writes `'present'` (module
 * doc #5/OUT-05's own literal text), the other three values are real but not
 * produced by this file. */
export type AttendanceStatus = 'present' | 'late' | 'excused' | 'absent';
/** `attendance.method` -- this dialog only ever writes `'coach'`. */
export type AttendanceMethod = 'qr' | 'coach' | 'import';

export interface RosterStudent {
  id: string;
  name: string;
  teamId: string;
}

export interface RsvpRow {
  id: string;
  sessionId: string;
  studentId: string;
  status: RsvpStatus;
  respondedBy: string | null;
  updatedAt: string;
  createdAt: string;
}

export interface MarkDayCompleteSession {
  id: string;
  eventId: string;
  sessionDate: string;
  startsAt: string;
  endsAt: string;
  status: SessionStatus;
  peopleReached: number | null;
  notes: string;
}

/** One real `attendance` row this dialog is about to write. Module doc #2. */
export interface AttendanceWriteRow {
  sessionId: string;
  studentId: string;
  status: AttendanceStatus;
  /** Always `null` here (module doc #2(c)) -- this dialog collects no
   * check-in/check-out timestamps. */
  checkInAt: string | null;
  checkOutAt: string | null;
  /** `null` = the coach never touched this student's row -- MET-03's SQL
   * falls back to the real session-duration tier itself (module doc #2),
   * never silently written here as a frozen numeric default. */
  hoursOverride: number | null;
  method: AttendanceMethod;
  recordedBy: string;
}

/** Module doc #3 -- `adultVolunteersCountThisSession`/
 * `adultVolunteerHoursThisSession` are DELTAS to be ADDED to
 * `events.adult_volunteers_count`/`adult_volunteer_hours`'s current value,
 * never absolute values to overwrite those columns with. */
export interface MarkDayCompletePayload {
  sessionId: string;
  peopleReached: number | null;
  attendance: readonly AttendanceWriteRow[];
  adultVolunteersCountThisSession: number;
  adultVolunteerHoursThisSession: number;
  /** `attendance.recorded_by` for every row above -- a real `profiles.id`. */
  recordedBy: string;
}

export type OnMarkDayCompleteFn = (payload: MarkDayCompletePayload) => Promise<void>;

// ---------------------------------------------------------------------------
// Placeholder identifiers -- module doc #7.
// ---------------------------------------------------------------------------

/** Disclosed, obviously-fake stand-in for "the signed-in coach's own
 * `profiles.id`" until a real Supabase-backed auth context is wired into
 * this batch. Deliberately a different literal string than
 * `RsvpControl.tsx`'s `PLACEHOLDER_CURRENT_USER_PROFILE_ID` (module doc #7)
 * -- distinct real-world attribution (coach `recorded_by` vs. student
 * `responded_by`), even though both are `profiles.id` values. */
export const PLACEHOLDER_CURRENT_COACH_PROFILE_ID = 'profile-placeholder-current-coach';

// ---------------------------------------------------------------------------
// Fixture data (constitution item 6: fabricated names only). Module doc #7 /
// standalone-render defaults, same posture `ScheduleMeetingsDialog.tsx`'s
// `DEFAULT_TEAMS` already established.
// ---------------------------------------------------------------------------

const DEFAULT_EVENT_TITLE = 'Community Food Bank Sort';

const DEFAULT_SESSION: MarkDayCompleteSession = {
  id: 'session-food-bank-day1',
  eventId: 'event-food-bank-sort',
  sessionDate: '2026-08-02',
  startsAt: '2026-08-02T14:00:00.000Z', // 9:00 AM America/Chicago (CDT)
  endsAt: '2026-08-02T21:00:00.000Z', // 4:00 PM America/Chicago -- 7h duration.
  status: 'scheduled',
  peopleReached: null,
  notes: '',
};

const DEFAULT_ROSTER: readonly RosterStudent[] = [
  { id: 'student-amara-chen', name: 'Amara Chen', teamId: 'team-ravens' },
  { id: 'student-marcus-bello', name: 'Marcus Bello', teamId: 'team-ravens' },
  { id: 'student-nina-ortiz', name: 'Nina Ortiz', teamId: 'team-ravens' },
  { id: 'student-sofia-delgado', name: 'Sofia Delgado', teamId: 'team-titans' },
];

const DEFAULT_RSVPS: readonly RsvpRow[] = [
  // Amara -- going, starts checked (module doc #6).
  {
    id: 'rsvp-1',
    sessionId: 'session-food-bank-day1',
    studentId: 'student-amara-chen',
    status: 'going',
    respondedBy: 'student-amara-chen',
    updatedAt: '2026-07-20T09:00:00.000Z',
    createdAt: '2026-07-20T09:00:00.000Z',
  },
  // Marcus -- maybe, starts unchecked.
  {
    id: 'rsvp-2',
    sessionId: 'session-food-bank-day1',
    studentId: 'student-marcus-bello',
    status: 'maybe',
    respondedBy: 'student-marcus-bello',
    updatedAt: '2026-07-20T09:05:00.000Z',
    createdAt: '2026-07-20T09:05:00.000Z',
  },
  // Nina -- declined, starts unchecked.
  {
    id: 'rsvp-3',
    sessionId: 'session-food-bank-day1',
    studentId: 'student-nina-ortiz',
    status: 'declined',
    respondedBy: 'student-nina-ortiz',
    updatedAt: '2026-07-20T09:10:00.000Z',
    createdAt: '2026-07-20T09:10:00.000Z',
  },
  // Sofia -- deliberately no rsvp row at all for this session -- "no
  // response", also starts unchecked (module doc #6).
];

// ---------------------------------------------------------------------------
// Pure functions -- exported for direct testing. Module docs #2/#4/#6.
// ---------------------------------------------------------------------------

/** Module doc #2(a) -- MET-03's own tier-3 fallback expression, computed
 * here ONLY as a UI default-value seed, never combined with a coalesce/case
 * chain over `hoursOverride`/`checkInAt`/`checkOutAt` the way the real SQL
 * view's tier-3 branch actually is. */
export function computeSessionDurationHours(session: { startsAt: string; endsAt: string }): number {
  const ms = new Date(session.endsAt).getTime() - new Date(session.startsAt).getTime();
  return Math.max(ms, 0) / (1000 * 60 * 60);
}

/** Module doc #6 -- THE ONE place the checklist's starting state is
 * derived: a roster student with a `'going'` `rsvps` row for this session
 * starts checked; `'maybe'`/`'declined'`/no row at all starts unchecked. */
export function computeInitialAttendedStudentIds(
  sessionId: string,
  roster: readonly RosterStudent[],
  rsvps: readonly RsvpRow[],
): string[] {
  const goingStudentIds = new Set(
    rsvps
      .filter((rsvp) => rsvp.sessionId === sessionId && rsvp.status === 'going')
      .map((rsvp) => rsvp.studentId),
  );
  return roster.filter((student) => goingStudentIds.has(student.id)).map((student) => student.id);
}

/** Module doc #2(b) -- a plain local SUM over the exact per-student hours
 * values this dialog is about to write (each one either an explicit
 * override, or the tier-3 default), never a query against
 * `v_student_hours`, never a cross-session aggregation. */
export function computeTotalHoursForCheckedStudents(
  checkedStudentIds: readonly string[],
  hoursOverrideByStudentId: Readonly<Record<string, number>>,
  defaultDurationHours: number,
): number {
  return checkedStudentIds.reduce(
    (sum, studentId) => sum + (hoursOverrideByStudentId[studentId] ?? defaultDurationHours),
    0,
  );
}

/** Rounds to one decimal place and trims a trailing ".0" -- "7 h" reads
 * better than "7.0 h" for the common whole-hour case, while a genuine
 * partial value (e.g. a 3.5h override) still renders precisely. */
export function formatHours(hours: number): string {
  const rounded = Math.round(hours * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

/** Module doc #4 -- THE ONE place the BEH-07 confirm button's label is
 * produced. Never a bare "Confirm"/"Submit"/"OK". */
export function computeMarkCompleteConfirmLabel(attendedCount: number, totalHours: number): string {
  return `Mark complete — ${attendedCount} attended · ${formatHours(totalHours)} h`;
}

/** Module doc #2/#5 -- THE ONE place `attendance` rows are constructed.
 * Always `status: 'present'`, `method: 'coach'`, `checkInAt`/`checkOutAt:
 * null` (module doc #2(c)); `hoursOverride` is the raw, honest per-student
 * override map value (possibly genuinely absent -> `null`), never
 * back-filled with the computed default duration. */
export function buildAttendanceWriteRows(
  sessionId: string,
  checkedStudentIds: readonly string[],
  hoursOverrideByStudentId: Readonly<Record<string, number>>,
  recordedBy: string,
): AttendanceWriteRow[] {
  return checkedStudentIds.map((studentId) => ({
    sessionId,
    studentId,
    status: 'present',
    checkInAt: null,
    checkOutAt: null,
    hoursOverride: hoursOverrideByStudentId[studentId] ?? null,
    method: 'coach',
    recordedBy,
  }));
}

// ---------------------------------------------------------------------------
// NFR-09 date/time formatting -- timestamps stored UTC, displayed
// America/Chicago. Independently reimplemented here (not imported) --
// `OutreachDetail.tsx`/`RsvpControl.tsx` are not in this task's Allowed
// Files (module doc #1).
// ---------------------------------------------------------------------------

const CHICAGO_TIME_ZONE = 'America/Chicago';

const WEEKDAY_DATE_FORMATTER = new Intl.DateTimeFormat('en-US', {
  weekday: 'short',
  month: 'short',
  day: 'numeric',
  timeZone: CHICAGO_TIME_ZONE,
});

const CLOCK_TIME_FORMATTER = new Intl.DateTimeFormat('en-US', {
  hour: 'numeric',
  minute: '2-digit',
  timeZone: CHICAGO_TIME_ZONE,
});

function parseDateOnly(isoDate: string): Date {
  const [year, month, day] = isoDate.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day, 12)); // noon UTC avoids DST edge cases
}

export function formatSessionDateTime(session: MarkDayCompleteSession): string {
  const dateText = WEEKDAY_DATE_FORMATTER.format(parseDateOnly(session.sessionDate));
  const startText = CLOCK_TIME_FORMATTER.format(new Date(session.startsAt));
  const endText = CLOCK_TIME_FORMATTER.format(new Date(session.endsAt));
  return `${dateText} · ${startText}–${endText}`;
}

// ---------------------------------------------------------------------------
// Default injectable seam -- module doc #7.
// ---------------------------------------------------------------------------

export const defaultOnMarkComplete: OnMarkDayCompleteFn = async (payload) => {
  console.warn(
    '[MarkDayCompleteDialog] No Supabase client wired in yet (module doc #7) -- this stub only ' +
      'logs the event_sessions status flip + attendance inserts + events additive adult-volunteer ' +
      'update that would have been persisted.',
    payload,
  );
};

// ---------------------------------------------------------------------------
// Component.
// ---------------------------------------------------------------------------

export interface MarkDayCompleteDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  /** Display context only, e.g. `events.title`. */
  eventTitle?: string;
  session?: MarkDayCompleteSession;
  /** The session's resolvable roster (module doc #1 -- already resolved by
   * the caller the same way `OutreachDetail.tsx`'s own `resolveEventRoster`
   * does; not re-derived here since that logic is a Forbidden File). */
  roster?: readonly RosterStudent[];
  /** Every `rsvps` row for this session (and, harmlessly, any others --
   * `computeInitialAttendedStudentIds` filters by `sessionId` itself). */
  rsvps?: readonly RsvpRow[];
  /** Injectable auth seam (module doc #7). Defaults to a disclosed
   * placeholder `profiles.id`. */
  currentUserProfileId?: string;
  /** Injectable persistence seam (module doc #7). Defaults to a stub that
   * only logs. */
  onMarkComplete?: OnMarkDayCompleteFn;
}

export function MarkDayCompleteDialog({
  isOpen,
  onOpenChange,
  eventTitle = DEFAULT_EVENT_TITLE,
  session = DEFAULT_SESSION,
  roster = DEFAULT_ROSTER,
  rsvps = DEFAULT_RSVPS,
  currentUserProfileId = PLACEHOLDER_CURRENT_COACH_PROFILE_ID,
  onMarkComplete = defaultOnMarkComplete,
}: MarkDayCompleteDialogProps): ReactNode {
  // Module doc #5(ii) -- only a scheduled session can be (re-)completed from
  // this dialog.
  const isSessionEligible = session.status === 'scheduled';

  const [checkedStudentIds, setCheckedStudentIds] = useState<string[]>([]);
  const [peopleReached, setPeopleReached] = useState<number | null>(null);
  // Module doc #3 -- THIS SESSION'S OWN contribution, not the event's
  // running total; never fetched from `events`.
  const [adultVolunteersCount, setAdultVolunteersCount] = useState<number | null>(0);
  const [adultVolunteerHours, setAdultVolunteerHours] = useState<number | null>(0);
  const [hoursOverrideByStudentId, setHoursOverrideByStudentId] = useState<Record<string, number>>(
    {},
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  function resetForm(): void {
    setCheckedStudentIds(computeInitialAttendedStudentIds(session.id, roster, rsvps));
    setPeopleReached(session.peopleReached ?? null);
    setAdultVolunteersCount(0);
    setAdultVolunteerHours(0);
    setHoursOverrideByStudentId({});
    setSubmitError(null);
  }

  // Nothing persists across opens -- every fresh open re-derives the
  // checklist from the current `going` RSVPs (module doc #6), same
  // "reset-on-open-transition" pattern `ScheduleMeetingsDialog.tsx` already
  // established.
  useEffect(() => {
    if (isOpen) resetForm();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset only on the isOpen transition.
  }, [isOpen, session.id]);

  const defaultDurationHours = useMemo(() => computeSessionDurationHours(session), [session]);

  const totalHours = useMemo(
    () =>
      computeTotalHoursForCheckedStudents(
        checkedStudentIds,
        hoursOverrideByStudentId,
        defaultDurationHours,
      ),
    [checkedStudentIds, hoursOverrideByStudentId, defaultDurationHours],
  );

  const confirmLabel = computeMarkCompleteConfirmLabel(checkedStudentIds.length, totalHours);

  const checkedStudents = useMemo(
    () => roster.filter((student) => checkedStudentIds.includes(student.id)),
    [roster, checkedStudentIds],
  );

  function handleClose(): void {
    resetForm();
    onOpenChange(false);
  }

  function setStudentHoursOverride(studentId: string, value: number): void {
    setHoursOverrideByStudentId((prev) => ({ ...prev, [studentId]: value }));
  }

  async function handleSubmit(): Promise<void> {
    if (!isSessionEligible || isSubmitting) return; // extra guard; button already natively disabled.
    setIsSubmitting(true);
    setSubmitError(null);
    const payload: MarkDayCompletePayload = {
      sessionId: session.id,
      peopleReached,
      attendance: buildAttendanceWriteRows(
        session.id,
        checkedStudentIds,
        hoursOverrideByStudentId,
        currentUserProfileId,
      ),
      adultVolunteersCountThisSession: adultVolunteersCount ?? 0,
      adultVolunteerHoursThisSession: adultVolunteerHours ?? 0,
      recordedBy: currentUserProfileId,
    };
    try {
      await onMarkComplete(payload);
      resetForm();
      onOpenChange(false);
    } catch (error) {
      setSubmitError(
        error instanceof Error ? error.message : 'Something went wrong marking this day complete.',
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Dialog isOpen={isOpen} onOpenChange={onOpenChange} purpose="form">
      <Layout
        header={
          <DialogHeader
            title="Mark day complete"
            subtitle={`${eventTitle} · ${formatSessionDateTime(session)}`}
            onOpenChange={onOpenChange}
          />
        }
        content={
          <LayoutContent>
            {!isSessionEligible ? (
              // Module doc #5(ii) -- reveals nothing else: no checklist, no
              // hours inputs, no confirm action.
              <Banner
                status="info"
                title="This session can't be marked complete from here"
                description={`This session's status is "${session.status}" -- only a scheduled session can be marked complete this way. Once completed, attendance stays coach-editable through a separate audit-logged edit flow, not this dialog.`}
              />
            ) : (
              <FormLayout>
                {/* Field order per OUT-05's own wireframe (module doc, top
                    of file / constitution item 13): attendee checklist ->
                    people reached -> adult volunteers count + hours ->
                    per-student hours override. */}
                <CheckboxList
                  label="Attendee checklist"
                  value={checkedStudentIds}
                  onChange={setCheckedStudentIds}
                  hasDividers
                >
                  {roster.map((student) => (
                    <CheckboxListItem key={student.id} label={student.name} value={student.id} />
                  ))}
                </CheckboxList>

                <NumberInput
                  label="People reached"
                  value={peopleReached}
                  onChange={setPeopleReached}
                  min={0}
                  isIntegerOnly
                  hasClear
                  isOptional
                />

                <VStack gap={1}>
                  <HStack gap={2} wrap="wrap">
                    <NumberInput
                      label="Adult volunteers (this session)"
                      value={adultVolunteersCount}
                      onChange={setAdultVolunteersCount}
                      min={0}
                      isIntegerOnly
                    />
                    <NumberInput
                      label="Adult volunteer hours (this session)"
                      value={adultVolunteerHours}
                      onChange={setAdultVolunteerHours}
                      min={0}
                      step={0.25}
                      units="h"
                    />
                  </HStack>
                  {/* Module doc #3 -- the disclosed event-vs-session
                      resolution, stated to the coach, not just in code
                      comments. */}
                  <Text type="supporting" color="secondary">
                    These are added to the event&rsquo;s running adult-volunteer totals, not the
                    event&rsquo;s total itself -- each session you mark complete contributes its own
                    count and hours.
                  </Text>
                </VStack>

                {checkedStudents.length > 0 && (
                  <VStack gap={2}>
                    <Text type="supporting">
                      Hours per student (default {formatHours(defaultDurationHours)} h, for partial
                      attendance)
                    </Text>
                    {checkedStudents.map((student) => (
                      <NumberInput
                        key={student.id}
                        label={`${student.name} hours`}
                        value={hoursOverrideByStudentId[student.id] ?? defaultDurationHours}
                        onChange={(value) => setStudentHoursOverride(student.id, value)}
                        min={0}
                        step={0.25}
                        units="h"
                      />
                    ))}
                  </VStack>
                )}

                {submitError !== null && (
                  <Banner
                    status="error"
                    title="Couldn't mark this day complete"
                    description={submitError}
                  />
                )}
              </FormLayout>
            )}
          </LayoutContent>
        }
        footer={
          <LayoutFooter hasDivider>
            <HStack hAlign="end" gap={2}>
              {isSessionEligible ? (
                <>
                  <Button label="Cancel" variant="secondary" onClick={handleClose} />
                  <Button
                    label={confirmLabel}
                    variant="primary"
                    isDisabled={isSubmitting}
                    isLoading={isSubmitting}
                    clickAction={handleSubmit}
                  />
                </>
              ) : (
                <Button label="Close" variant="secondary" onClick={handleClose} />
              )}
            </HStack>
          </LayoutFooter>
        }
      />
    </Dialog>
  );
}

export default MarkDayCompleteDialog;
