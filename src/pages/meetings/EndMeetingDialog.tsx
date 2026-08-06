/**
 * T036: `EndMeetingDialog.tsx` -- MTG-13, the last task in Epic E5. A real
 * "End meeting" action (`Button` + a real `AlertDialog`, DES-11-style
 * confirm) that summarizes the live attendance state for a session and, on
 * confirm, performs the real end-of-meeting `event_sessions`/`attendance`
 * mutations. This is a standalone, injectable-seam component -- it is NOT
 * wired into `LiveConsole.tsx`/any route by this task (both forbidden files
 * here, read-only reference only per this task's packet).
 *
 * -----------------------------------------------------------------------
 * 1. Three real mutations, represented as ONE atomic payload (Known
 *    Context/Traps #1) -- the same `SetActiveSeasonPayload` atomicity-
 *    contract shape `SeasonSettings.tsx`/T029 already established and
 *    passed review for, re-applied here, not reinvented.
 * -----------------------------------------------------------------------
 *
 * Confirming "End meeting" needs to produce, as ONE logical action:
 *   (a) `event_sessions.status` flips `'scheduled' -> 'completed'` for this
 *       session (one row).
 *   (b) T508: EVERY roster member with **zero** `attendance` row for this
 *       session gets a real, new `absent` row (`method: 'coach'`) **only if
 *       the coach explicitly opts in** via the checkbox described in section
 *       1a below. This used to run unconditionally, and that was live data
 *       corruption -- it wrote a false `absent` record for every unmarked
 *       roster member on every meeting close, whether or not that student
 *       was ever actually expected at this specific meeting. See section 1a.
 *   (c) Every existing `attendance` row that is `present`/`late` with
 *       `check_in_at` set but `check_out_at` still null gets `check_out_at`
 *       set to the session's `ends_at`. UNCHANGED and unconditional -- (c)
 *       corrects real check-ins the coach is not choosing anything about.
 *
 * `EndMeetingPayload` below is the single shape naming ALL THREE: the
 * session being ended (`sessionId`, `endsAt` -- the stamp (c) uses), the
 * full set of students to mark absent (`markAbsentStudentIds` -- renamed
 * from `backfillAbsentStudentIds`, T508 section 1a: empty unless the coach
 * opted in), and the full set of students to check out
 * (`checkoutStudentIds`). There is no separate "flip status" call, "mark
 * absences" call, and "close check-ins" call the UI could dispatch
 * independently and leave the DB half-done between them if one leg failed --
 * `handleConfirmEndMeeting` below computes this ONE payload from the current
 * live roster/attendance state (plus the coach's own opt-in choice, section
 * 1a) and awaits ONE `onEndMeeting(payload)` call; local state is only ever
 * updated (via `applyEndMeetingResult`, the sole place mark-absent/checkout
 * are ever simulated locally, mirroring `SeasonSettings.tsx`'s own
 * `withActiveSeason` precedent for "the one place a derived mutation is ever
 * applied to local state") AFTER that call resolves -- if it rejects, local
 * state is never touched (no optimistic half-flip). CORRECTED (T178): a real
 * backend implementation (`src/lib/supabase/loaders/endMeeting.ts`, a
 * separate task's own file, not this one) is THREE sequenced writes, not a
 * single transaction/RPC -- no `supabase.rpc(...)` call, mark-absent (INSERT
 * ... ON CONFLICT DO NOTHING, now GUARDED -- T508 section 1a) then checkout
 * (UPDATE, unconditional) then the `event_sessions` status flip (UPDATE,
 * unconditional), always in that order, always awaited sequentially. No RPC
 * is needed because that ordering already makes every reachable
 * partial-failure state safe on its own (see that file's own module doc for
 * the full property) -- this file cannot prove that safety property itself
 * (no Supabase client is wired in here, section 5 below), but the
 * callback's own single-payload shape is deliberately built so a real
 * implementation CAN satisfy the "one coherent action" contract this way,
 * rather than forcing the caller to dispatch three uncoordinated calls of
 * its own.
 *
 * -----------------------------------------------------------------------
 * 1a. T508 -- the automatic absence write was live data corruption. Now an
 *     explicit coach opt-in. The owner's ruling, and why it is a data-model
 *     fact, not a preference.
 * -----------------------------------------------------------------------
 *
 * `docs/swarm/auto-mode-decisions.md`, 2026-08-05, verbatim: *"i think we
 * should only count 'absent' if i click the pill for absent"*; *"it should
 * just say 5 present unless i explicetly mark some as absent"*; *"the
 * participation % shouldn't assume everyone is supposed to attend a
 * meeting, even if it's scoped to p3. if i have the right tools to indicate
 * absent students then it should use that as the calculation."*
 *
 * **The reason is a data-model fact, not a preference, and it decides the
 * design.** The sub-teams that determine who is expected at a given
 * meeting -- business, build, software -- are deliberately NOT modelled, and
 * `events.team_ids` (P3 / Gear Girls) is one level too coarse to derive them.
 * So the expected-attendee set is not derivable from any data this app
 * holds, and the coach's own markings are the only honest source of truth.
 * That is why (b) above is gated behind `markRemainingAbsent`, a real
 * `useState(false)`-defaulted boolean (never defaults `true` -- that would
 * silently restore the exact defect), surfaced as a `CheckboxInput` beside
 * the "End meeting" trigger (never inside the confirm `AlertDialog` itself --
 * `AlertDialog` takes no children and a required string `description`, so
 * there is nowhere inside it to put a real control), shown only when there
 * is at least one unmarked roster member to ask about.
 *
 * `buildEndMeetingPayload`'s new 4th parameter, `markRemainingAbsent:
 * boolean`, has **no default** on purpose -- `tsc` must force every call
 * site to state the choice explicitly rather than silently inheriting one.
 *
 * The rows already written under the old, unconditional design are left
 * alone -- owner ruling, verbatim: *"leave as is."* This file writes no
 * cleanup migration for them.
 *
 * -----------------------------------------------------------------------
 * 2. Post-completion attendance edits are NOT audit-logged.
 * -----------------------------------------------------------------------
 *
 * HISTORY: this file was originally written against
 * `trg_audit_attendance_post_completion`, an `after update on
 * public.attendance` trigger that wrote an `audit_log` row for any
 * attendance UPDATE whose session already read `'completed'`. That trigger
 * was REMOVED in
 * `supabase/migrations/20260803000000_simplify_attendance_audit.sql`.
 *
 * WHY (owner decision, PRD DATA-02): correcting attendance after a session
 * has completed is a normal, legitimate workflow for this team -- a student
 * was present but never got marked, so a coach or the student fixes it. It
 * is not a fraud signal and is not recorded as one. Attendance
 * record-keeping is `attendance.recorded_by` + `attendance.updated_at` on
 * the row itself (`updated_at` is now maintained by
 * `trg_attendance_touch_updated_at`), which the activity feed already reads
 * to show self-vs-staff attribution.
 *
 * Consequences for this file:
 *
 *   (a) ORDERING within `handleConfirmEndMeeting`: the mark-absent/checkout
 *       mutations in section 1 run before `event_sessions.status` flips to
 *       `'completed'`. That ordering originally existed to stop the trigger
 *       from logging the coach's own routine meeting-close checkout as a
 *       post-completion correction. With the trigger gone, the ordering is
 *       no longer load-bearing for audit reasons -- it is retained because
 *       checkout-then-flip is the natural sequence anyway (see
 *       `../../lib/supabase/loaders/endMeeting.ts`), not because anything
 *       now depends on it.
 *   (b) FUTURE coach edits: any attendance correction made after this
 *       dialog's confirm (e.g. fixing a status from `present` to `late`) is
 *       a plain `attendance` UPDATE through `onEditAttendance` below --
 *       `handleEditAttendance` calls it and nothing else. This file NEVER
 *       inserts into `audit_log` anywhere, and neither does the database
 *       for attendance. `defaultOnEndMeeting` and `defaultOnEditAttendance`
 *       (this file's only two mutation stubs) both only `console.warn` the
 *       payload they would have sent.
 *
 * -----------------------------------------------------------------------
 * 3. Pre-confirm summary design choice (Known Context/Traps #3) -- decided
 *    and disclosed, not silently assumed. UPDATED (T508): counts real
 *    records, not roster membership; the no-record sentence names the
 *    coach's own opt-in choice instead of asserting one outcome.
 * -----------------------------------------------------------------------
 *
 * The `AlertDialog`'s description shows the LIVE tally of currently-recorded
 * `attendance` rows ("N present · N late · N excused · N absent", a plain
 * `.filter`/count via `computeEndMeetingSummaryCounts`, no formula, no view)
 * -- it does NOT fold the about-to-be-marked absences into that tally.
 * T508 CORRECTED (section 1a's ruling 3, owner: *"the participation %
 * shouldn't assume everyone is supposed to attend"*): `computeEndMeetingSummaryCounts`
 * used to iterate the ROSTER and look each member up by id, which silently
 * DROPPED any real attendance row for a student not on that roster (e.g.
 * `loaders/selfCheckoff.ts`'s `makeInsertSelfCheckoff` writes a real
 * `present` row with no roster check anywhere in that file) -- a real,
 * coach-visible mark the tally used to lie about. It now iterates
 * `Object.values(attendanceByStudentId)` directly: every real record
 * counts, whether or not its student is on this roster. Count the records,
 * not the roster.
 *
 * A SEPARATE sentence (`buildEndMeetingConfirmDescription`, now taking
 * `markRemainingAbsent: boolean`) discloses the no-record count, worded by
 * the coach's own opt-in choice -- never the marked-absent claim
 * unconditionally, which was itself the defect in copy form:
 *   - opted in (`true`): "N student(s) with no attendance record will be
 *     marked absent."
 *   - opted out (`false`, the default): "N student(s) have no attendance
 *     record and will be left unmarked."
 * (and, symmetrically, how many open check-ins will be checked out) as its
 * own explicit callout. Reasoning: the tally line's job is to accurately
 * describe CURRENT DB state (a coach scanning it should be able to trust
 * "N present" means N real `present` rows exist right now); silently
 * pre-adding the about-to-be-created absences would make that same line
 * simultaneously describe present-state AND future-state, which is
 * confusing precisely because those two things can differ. The separate
 * callout still fully discloses the consequence (nothing is hidden from the
 * coach before they confirm) without conflating "what is" with "what is
 * about to become." The packet's own text states either choice is
 * defensible -- this is the one made here, stated explicitly.
 *
 * The tally line itself renders UNCONDITIONALLY, including the all-zero "0
 * present · 0 late · 0 excused · 0 absent" case -- owner ruling, 2026-08-05
 * (later): *"one format, always."* A prose fallback for the nothing-marked
 * case was considered and explicitly declined; a meeting where genuinely
 * nobody was marked is a normal outcome under this design, not an error
 * state that needs different copy.
 *
 * -----------------------------------------------------------------------
 * 4. Scope: a trigger + confirm dialog + a minimal post-completion
 *    correction list -- NOT a re-implementation of `LiveConsole.tsx`'s live
 *    roster/check-in UI.
 * -----------------------------------------------------------------------
 *
 * Before the session is ended (`status === 'scheduled'`), this component
 * renders only the "End meeting" `Button` + its `AlertDialog` -- the live
 * roster/check-in table that summary is computed FROM is `LiveConsole.tsx`'s
 * job (a forbidden, read-only file here), not re-built in this file. AFTER
 * confirming (or if `loadSummary` already reports `status === 'completed'`,
 * e.g. re-opening this component for an already-ended session), a compact
 * `List` of per-student `SegmentedControl` rows appears -- this exists
 * specifically to give `onEditAttendance` (section 2b) a real, exercised
 * call site, proving the "plain UPDATE, trigger handles audit
 * automatically" contract end-to-end rather than leaving it as an unused,
 * only-typed seam. It intentionally does not duplicate `LiveConsole.tsx`'s
 * DES-17 keyboard path, QR panel, or Realtime subscription -- those are out
 * of scope for this file (MTG-13 is about ending a meeting and, incident to
 * that, correcting attendance afterward; MTG-05's live console is a
 * different, already-shipped task).
 *
 * -----------------------------------------------------------------------
 * 5. No shared Supabase client wired in (Known Context/Traps #5) -- same
 *    posture as every prior content page in this batch.
 * -----------------------------------------------------------------------
 *
 * `loadSummary`/`onEndMeeting`/`onEditAttendance` are all injectable props,
 * each defaulting to an obviously-fake stub (`defaultLoadEndMeetingSummary`
 * returns fixture data; `defaultOnEndMeeting`/`defaultOnEditAttendance` only
 * `console.warn` the payload they would have sent). No
 * `src/lib/supabase/**` import exists anywhere in this file (that directory
 * is read-only/reference-only per this task's Forbidden Files).
 *
 * -----------------------------------------------------------------------
 * 6. `event_sessions`/`attendance` ground truth (ground-truth section) --
 *    re-derived directly, camelCase renames, NOT imported from
 *    `LiveConsole.tsx` (forbidden file) even though the `AttendanceStatus`/
 *    `AttendanceMethod` unions happen to match its own re-derivation of the
 *    same real check constraints.
 * -----------------------------------------------------------------------
 *
 * `supabase/migrations/20260717000000_scheduling_attendance.sql`:
 *  - `event_sessions` (lines 53-63): `id`, `event_id`, `session_date`,
 *    `starts_at`, `ends_at`, `status` (check `'scheduled' | 'completed' |
 *    'canceled'`), `people_reached`, `notes`. Only `id`, `ends_at`, `status`
 *    (plus a display `title`, not a real column, composed by the caller who
 *    already has the event/session data) are relevant here.
 *  - `attendance` (lines 79-91): `id`, `session_id`, `student_id`, `status`
 *    (check `'present' | 'late' | 'excused' | 'absent'`), `check_in_at`,
 *    `check_out_at`, `hours_override`, `method` (check `'qr' | 'coach' |
 *    'import'`), `recorded_by`, `updated_at`. Unique on
 *    `(session_id, student_id)` -- this is exactly what makes "zero
 *    `attendance` row for this session" (section 1b) a well-defined,
 *    per-student condition instead of an ambiguous multi-row one.
 *
 * -----------------------------------------------------------------------
 * 7. Astryx prop sourcing (constitution item 2) -- every prop below,
 *    grepped live against `docs/swarm/astryx-api.md` for this task (not
 *    copied blindly from `LiveConsole.tsx`/`SeasonSettings.tsx`'s own
 *    citations, even where the same component is reused).
 * -----------------------------------------------------------------------
 *
 *  - `AlertDialog` ("AlertDialog" Props table, `astryx-api.md` lines
 *    2518-2530): `isOpen`, `onOpenChange`, `title`, `description`,
 *    `actionLabel`, `onAction`, `isActionLoading` used (all required except
 *    `isActionLoading`). `actionVariant` is explicitly overridden to
 *    `'primary'` (documented default is `'destructive'`, lines 2527) --
 *    unlike `MeetingsList.tsx`'s own cancel-meeting `AlertDialog` (which
 *    deliberately keeps the destructive default because canceling IS
 *    destructive-shaped, that file's own module doc says so explicitly),
 *    ending a meeting is a normal, expected, one-way workflow completion,
 *    not a data-loss action -- overriding to `'primary'` is the disclosed,
 *    deliberate choice made here, not an oversight or a copy of
 *    `SeasonSettings.tsx`'s own (unoverridden) usage.
 *  - `Button` ("Button" Props table, lines 1807-1827): `label`, `variant`,
 *    `onClick` used. Per that doc's own "Don't: use a button for
 *    navigation" line, this is fine -- "End meeting" is a real action, not
 *    navigation.
 *  - `CheckboxInput` ("CheckboxInput" Props table, `astryx-api.md` lines
 *    943-964, T508 section 1a): `label`, `value`, `onChange`, `description`
 *    used (all required except `description`). `Switch` is ruled out by its
 *    OWN "Best Practices" line -- *"Don't: Use for options that require a
 *    form submission to take effect"* -- the opt-in only takes effect when
 *    "End meeting" is confirmed, not immediately; `CheckboxInput`'s own doc
 *    names "opt-in choices" as its fit.
 *  - `Banner` ("Banner" Props table, lines 2749-2763): `status`, `title`,
 *    `description`, `isDismissable`, `onDismiss` used.
 *  - `List` ("List" Props table, lines 4574-4584): `hasDividers`, `header`
 *    used. `ListItem`'s own "Components > ListItem" subsection (line 4589)
 *    is `undefined` -- the same disclosed doc gap `LiveConsole.tsx`/T033
 *    already hit, resolved identically by reading
 *    `node_modules/@astryxdesign/core/dist/List/ListItem.d.ts` directly (a
 *    real generation-source file): `label` (required), `startContent`,
 *    `endContent` used below.
 *  - `SegmentedControl`/`SegmentedControlItem` ("SegmentedControl" Props
 *    table, lines 5599-5611; `SegmentedControlItem`'s own subsection, line
 *    5617, is `undefined`, re-resolved live via `npm run astryx --
 *    component SegmentedControlItem`, same as `LiveConsole.tsx` already
 *    did): `value`, `onChange`, `label` used on `SegmentedControl`
 *    (`label` is the accessible group name, "Attendance for <name>", never
 *    rendered visibly, per that prop's own doc line); `value`, `label` used
 *    on `SegmentedControlItem`.
 *  - `StatusDot` ("StatusDot" Props table, lines 5871-5879): `variant`
 *    (`'success' | 'warning' | 'neutral' | 'error'`), `label` used -- DES-05's
 *    literal mapping (PRD line 195, the SAME mapping `LiveConsole.tsx`'s own
 *    `ATTENDANCE_STATUS_DOT` and `MeetingsList.tsx`'s own
 *    `ATTENDANCE_STATUS_BADGE` already established: present=success,
 *    late=warning, excused=neutral, absent=error), re-derived locally here
 *    (not imported -- `LiveConsole.tsx`/`MeetingsList.tsx` are both
 *    forbidden files for this task) since it is the real, shared,
 *    already-load-bearing vocabulary, not invented fresh.
 *  - `Spinner` ("Spinner" Props table, lines 5832-5840): `label` used.
 *  - `EmptyState` ("EmptyState" Props table, lines 3991-4001): `title`,
 *    `description` used.
 *  - `VStack` ("Stack" section, `VStack` subsection, lines 374-396): `gap`
 *    used.
 */
import { useEffect, useState, type ReactNode } from 'react';
import {
  AlertDialog,
  Banner,
  Button,
  CheckboxInput,
  EmptyState,
  List,
  ListItem,
  SegmentedControl,
  SegmentedControlItem,
  Spinner,
  StatusDot,
  VStack,
} from '@astryxdesign/core';

// ---------------------------------------------------------------------------
// Ground truth -- module doc section 6. Re-derived locally, not imported
// from `LiveConsole.tsx` (forbidden file, read-only reference only).
// ---------------------------------------------------------------------------

/** `attendance.status` check constraint (migration lines 79-91). */
export type AttendanceStatus = 'present' | 'late' | 'excused' | 'absent';
/** `attendance.method` check constraint (same migration). */
export type AttendanceMethod = 'qr' | 'coach' | 'import' | 'self';
/** `event_sessions.status` check constraint (migration lines 53-63). */
export type SessionStatus = 'scheduled' | 'completed' | 'canceled';

/** The subset of an `attendance` row this dialog cares about, per student. */
export interface AttendanceRecordState {
  status: AttendanceStatus;
  checkInAt: string | null;
  checkOutAt: string | null;
  method: AttendanceMethod;
  recordedBy: string | null;
}

export interface EndMeetingRosterEntry {
  studentId: string;
  name: string;
}

export interface EndMeetingSessionInfo {
  id: string;
  title: string;
  /** `event_sessions.ends_at`, ISO timestamp -- the checkout stamp (section 1c). */
  endsAt: string;
  status: SessionStatus;
}

export interface EndMeetingSummaryData {
  session: EndMeetingSessionInfo;
  roster: EndMeetingRosterEntry[];
  /** Keyed by `studentId`; a student with no entry has no `attendance` row yet. */
  attendanceByStudentId: Record<string, AttendanceRecordState>;
}

export type LoadEndMeetingSummaryFn = (sessionId: string) => Promise<EndMeetingSummaryData>;

/**
 * Module doc section 1 -- the atomicity contract. Naming BOTH id lists in
 * one payload (rather than exposing three separate callback props) is what
 * makes "one coherent action" a property of the TYPE, not just of how this
 * file happens to call things today.
 */
export interface EndMeetingPayload {
  sessionId: string;
  /** `event_sessions.ends_at` -- the value every checkout stamp uses. */
  endsAt: string;
  /**
   * T508 (renamed from `backfillAbsentStudentIds`, section 1a): the students
   * the coach EXPLICITLY chose to mark absent; empty unless opted in via the
   * `markRemainingAbsent` checkbox. Never populated automatically.
   */
  markAbsentStudentIds: string[];
  /** `present`/`late` rows with `check_in_at` set, `check_out_at` still null (section 1c). */
  checkoutStudentIds: string[];
}

export type OnEndMeetingFn = (payload: EndMeetingPayload) => Promise<void>;

/**
 * Module doc section 2b -- a plain `attendance` UPDATE. Never inserts into
 * `audit_log`, and neither does the database: post-completion attendance
 * corrections are deliberately not audit-logged (module doc section 2).
 * `recorded_by`/`updated_at` on the row carry the attribution.
 */
export type OnEditAttendanceFn = (
  sessionId: string,
  studentId: string,
  status: AttendanceStatus,
) => Promise<void>;

// ---------------------------------------------------------------------------
// Pure helpers -- exported for direct testing.
// ---------------------------------------------------------------------------

/** Section 1b: roster members with NO `attendance` row at all for this
 * session -- "unmarked," in the sense that the coach has recorded nothing
 * for them. Renamed from `computeBackfillAbsentStudentIds` (T508 section
 * 1a): behaviour is UNCHANGED -- computing this set is not acting on it;
 * whether it is used to mark anyone absent is the coach's own opt-in choice
 * (`markRemainingAbsent`), applied in `buildEndMeetingPayload`. */
export function computeUnmarkedStudentIds(
  roster: readonly EndMeetingRosterEntry[],
  attendanceByStudentId: Readonly<Record<string, AttendanceRecordState>>,
): string[] {
  return roster
    .filter((entry) => attendanceByStudentId[entry.studentId] === undefined)
    .map((entry) => entry.studentId);
}

const OPEN_CHECKIN_STATUSES: readonly AttendanceStatus[] = ['present', 'late'];

/** Section 1c: `present`/`late` rows with `check_in_at` set, `check_out_at` still null. */
export function computeCheckoutStudentIds(
  attendanceByStudentId: Readonly<Record<string, AttendanceRecordState>>,
): string[] {
  return Object.entries(attendanceByStudentId)
    .filter(
      ([, record]) =>
        OPEN_CHECKIN_STATUSES.includes(record.status) &&
        record.checkInAt !== null &&
        record.checkOutAt === null,
    )
    .map(([studentId]) => studentId);
}

/** Section 1 / 1a: the ONE payload representing all three legs of "end
 * meeting". `markRemainingAbsent` has NO default -- deliberately (section
 * 1a): `tsc` must force every call site to state the coach's opt-in choice
 * rather than silently inheriting one. */
export function buildEndMeetingPayload(
  session: EndMeetingSessionInfo,
  roster: readonly EndMeetingRosterEntry[],
  attendanceByStudentId: Readonly<Record<string, AttendanceRecordState>>,
  markRemainingAbsent: boolean,
): EndMeetingPayload {
  return {
    sessionId: session.id,
    endsAt: session.endsAt,
    markAbsentStudentIds: markRemainingAbsent
      ? computeUnmarkedStudentIds(roster, attendanceByStudentId)
      : [],
    checkoutStudentIds: computeCheckoutStudentIds(attendanceByStudentId),
  };
}

const MARK_ABSENT_METHOD: AttendanceMethod = 'coach';

/**
 * Section 1: the ONLY place mark-absent/checkout are ever simulated in
 * local state, and ONLY called after a real `onEndMeeting` call has already
 * resolved (mirrors `SeasonSettings.tsx`'s own `withActiveSeason` -- "the
 * one place a derived mutation is ever applied to local state" pattern).
 * `payload.markAbsentStudentIds` is empty unless the coach opted in (section
 * 1a) -- this loop is a no-op in the ordinary case.
 */
export function applyEndMeetingResult(
  attendanceByStudentId: Readonly<Record<string, AttendanceRecordState>>,
  payload: EndMeetingPayload,
): Record<string, AttendanceRecordState> {
  const next: Record<string, AttendanceRecordState> = { ...attendanceByStudentId };
  for (const studentId of payload.markAbsentStudentIds) {
    next[studentId] = {
      status: 'absent',
      checkInAt: null,
      checkOutAt: null,
      method: MARK_ABSENT_METHOD,
      recordedBy: null,
    };
  }
  for (const studentId of payload.checkoutStudentIds) {
    const existing = next[studentId];
    if (existing !== undefined) {
      next[studentId] = { ...existing, checkOutAt: payload.endsAt };
    }
  }
  return next;
}

export interface EndMeetingSummaryCounts {
  present: number;
  late: number;
  excused: number;
  absent: number;
}

/** Section 3 (T508 CORRECTED): a plain tally of CURRENTLY-recorded
 * `attendance` rows, grouped by `status` -- counts every real record
 * directly, no roster join. Previously iterated the roster and looked each
 * member up by id, which silently dropped a real record for a student not
 * on that roster (e.g. a self-check-off into a session they are not
 * rostered for, `loaders/selfCheckoff.ts`) -- count the records, not the
 * roster. No formula, no view, just a `.filter`/count. */
export function computeEndMeetingSummaryCounts(
  attendanceByStudentId: Readonly<Record<string, AttendanceRecordState>>,
): EndMeetingSummaryCounts {
  const counts: EndMeetingSummaryCounts = { present: 0, late: 0, excused: 0, absent: 0 };
  for (const record of Object.values(attendanceByStudentId)) {
    counts[record.status] += 1;
  }
  return counts;
}

/** The packet's own literal tally format: "14 present · 2 late · 1 excused · 1 absent". */
export function formatEndMeetingSummaryLine(counts: EndMeetingSummaryCounts): string {
  return `${counts.present} present · ${counts.late} late · ${counts.excused} excused · ${counts.absent} absent`;
}

/** Section 1a/3: the count behind the checkbox label and the no-record
 * disclosure sentence (worded by the coach's own opt-in choice, never
 * unconditionally "will be marked absent" -- section 1a). */
export function computeNoRecordCount(
  roster: readonly EndMeetingRosterEntry[],
  attendanceByStudentId: Readonly<Record<string, AttendanceRecordState>>,
): number {
  return computeUnmarkedStudentIds(roster, attendanceByStudentId).length;
}

/**
 * Section 3 / 1a: the full `AlertDialog` description -- the live tally
 * (current DB state, counted from real records directly -- section 3) PLUS
 * separate, explicit callouts for what confirming will change, never folded
 * into the tally itself. `markRemainingAbsent` selects which no-record
 * sentence is honest -- never the marked-absent claim when the coach opted
 * out; that sentence IS the defect in copy form (section 1a).
 */
export function buildEndMeetingConfirmDescription(
  roster: readonly EndMeetingRosterEntry[],
  attendanceByStudentId: Readonly<Record<string, AttendanceRecordState>>,
  markRemainingAbsent: boolean,
): string {
  const counts = computeEndMeetingSummaryCounts(attendanceByStudentId);
  const noRecord = computeNoRecordCount(roster, attendanceByStudentId);
  const checkoutCount = computeCheckoutStudentIds(attendanceByStudentId).length;

  const sentences = [`Current attendance: ${formatEndMeetingSummaryLine(counts)}.`];
  if (noRecord > 0) {
    sentences.push(
      markRemainingAbsent
        ? `${noRecord} ${noRecord === 1 ? 'student' : 'students'} with no attendance record will be marked absent.`
        : `${noRecord} ${noRecord === 1 ? 'student has' : 'students have'} no attendance record and will be left unmarked.`,
    );
  }
  if (checkoutCount > 0) {
    sentences.push(
      `${checkoutCount} open check-in${checkoutCount === 1 ? '' : 's'} will be checked out at the session's end time.`,
    );
  }
  sentences.push('This meeting will be marked completed. Attendance stays editable afterward.');
  return sentences.join(' ');
}

/** Section 1a: the checkbox's own label, naming the count directly so the
 * count-naming requirement is testable without relying on JSX. */
export function buildMarkRemainingAbsentLabel(count: number): string {
  return `Mark ${count} ${count === 1 ? 'student' : 'students'} with no attendance record absent`;
}

/** DES-05's literal mapping (PRD line 195) -- module doc section 7. */
const ATTENDANCE_STATUS_DOT: Record<
  AttendanceStatus,
  { variant: 'success' | 'warning' | 'neutral' | 'error'; label: string }
> = {
  present: { variant: 'success', label: 'Present' },
  late: { variant: 'warning', label: 'Late' },
  excused: { variant: 'neutral', label: 'Excused' },
  absent: { variant: 'error', label: 'Absent' },
};
const NOT_RECORDED_DOT = { variant: 'neutral' as const, label: 'Not recorded' };

// ---------------------------------------------------------------------------
// Fixture data (constitution item 6: fabricated names only, no PII). Exists
// ONLY as the default argument to `defaultLoadEndMeetingSummary`, the same
// posture every prior content page's fixture default takes.
// ---------------------------------------------------------------------------

const FIXTURE_SESSION_ID_FALLBACK = 'session-fixture-end-meeting';

const FIXTURE_ROSTER: readonly EndMeetingRosterEntry[] = [
  { studentId: 'student-ada', name: 'Ada Q.' },
  { studentId: 'student-bea', name: 'Bea R.' },
  { studentId: 'student-cy', name: 'Cy T.' },
  { studentId: 'student-dee', name: 'Dee W.' },
  { studentId: 'student-eli', name: 'Eli M.' },
];

const FIXTURE_ATTENDANCE: Readonly<Record<string, AttendanceRecordState>> = {
  'student-ada': {
    status: 'present',
    checkInAt: '2026-07-21T23:05:00.000Z',
    checkOutAt: null,
    method: 'qr',
    recordedBy: null,
  },
  'student-bea': {
    status: 'late',
    checkInAt: '2026-07-21T23:20:00.000Z',
    checkOutAt: null,
    method: 'coach',
    recordedBy: 'fixture-coach',
  },
  'student-cy': {
    status: 'excused',
    checkInAt: null,
    checkOutAt: null,
    method: 'coach',
    recordedBy: 'fixture-coach',
  },
  // student-dee: deliberately no entry -- "no attendance row at all," the
  // exact condition `computeUnmarkedStudentIds` (section 1b) targets.
  'student-eli': {
    status: 'present',
    checkInAt: '2026-07-21T23:02:00.000Z',
    checkOutAt: '2026-07-22T01:00:00.000Z', // already checked out -- not an open check-in.
    method: 'qr',
    recordedBy: null,
  },
};

export async function defaultLoadEndMeetingSummary(
  sessionId: string,
): Promise<EndMeetingSummaryData> {
  return {
    session: {
      id: sessionId || FIXTURE_SESSION_ID_FALLBACK,
      title: 'Tuesday Build Meeting',
      endsAt: '2026-07-22T01:00:00.000Z', // 8:00 PM America/Chicago
      status: 'scheduled',
    },
    roster: [...FIXTURE_ROSTER],
    attendanceByStudentId: { ...FIXTURE_ATTENDANCE },
  };
}

/**
 * Module doc section 5. Represents "the real single transaction that flips
 * `event_sessions.status`, marks absences the coach opted into (section 1a),
 * and closes out check-ins happened" -- nothing else. No `audit_log` write,
 * no `audit_log` reference, anywhere in this function (module doc section 2).
 */
export const defaultOnEndMeeting: OnEndMeetingFn = async (payload) => {
  console.warn(
    '[EndMeetingDialog] No Supabase client wired in yet (module doc section 5) -- this ' +
      'stub only logs the end-meeting payload (status flip + opt-in absence marking + ' +
      'checkout) a real single transaction would have applied atomically (module doc ' +
      'section 1).',
    payload,
  );
};

/**
 * Module doc sections 2b/5. Represents "a plain `attendance` UPDATE
 * happened" -- nothing else. No `audit_log` write, no `audit_log`
 * reference, anywhere in this function; post-completion attendance
 * corrections are deliberately not audit-logged at any layer (module doc
 * section 2).
 */
export const defaultOnEditAttendance: OnEditAttendanceFn = async (sessionId, studentId, status) => {
  console.warn(
    '[EndMeetingDialog] No Supabase client wired in yet (module doc section 5) -- this ' +
      'stub only logs the attendance UPDATE payload that would have been sent. ' +
      'Post-completion attendance corrections are deliberately not audit-logged (module ' +
      'doc section 2) -- no client-side audit_log write belongs here or anywhere in this file.',
    { sessionId, studentId, status },
  );
};

// ---------------------------------------------------------------------------
// Generic DES-12 load-state hook -- same shape every prior content page in
// this batch already established, necessarily reimplemented locally (not
// imported; no sibling file is in this task's Allowed Files).
// ---------------------------------------------------------------------------

type LoadState<T> =
  | { status: 'loading' }
  | { status: 'error'; error: unknown; retry: () => void }
  | { status: 'success'; data: T };

function useLoadState<T>(load: () => Promise<T>, deps: readonly unknown[]): LoadState<T> {
  const [state, setState] = useState<LoadState<T>>({ status: 'loading' });
  // Bumped by the error Banner's "Retry" action (DES-12) to force the effect
  // below to re-run without changing the caller-supplied `deps` semantics.
  const [retryToken, setRetryToken] = useState(0);

  useEffect(() => {
    let isMounted = true;
    setState({ status: 'loading' });
    load()
      .then((data) => {
        if (isMounted) setState({ status: 'success', data });
      })
      .catch((error: unknown) => {
        if (isMounted) {
          setState({ status: 'error', error, retry: () => setRetryToken((token) => token + 1) });
        }
      });
    return () => {
      isMounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `deps` is the caller-supplied dependency list; `retryToken` is an additional internal trigger.
  }, [...deps, retryToken]);

  return state;
}

// ---------------------------------------------------------------------------
// Subcomponent -- module doc section 4's post-completion correction row.
// ---------------------------------------------------------------------------

function AttendanceCorrectionRow({
  entry,
  record,
  onSetStatus,
}: {
  entry: EndMeetingRosterEntry;
  record: AttendanceRecordState | undefined;
  onSetStatus: (studentId: string, status: AttendanceStatus) => void;
}): ReactNode {
  const dot = record === undefined ? NOT_RECORDED_DOT : ATTENDANCE_STATUS_DOT[record.status];

  return (
    <ListItem
      label={entry.name}
      startContent={<StatusDot variant={dot.variant} label={dot.label} />}
      endContent={
        <SegmentedControl
          value={record?.status ?? ''}
          onChange={(value) => onSetStatus(entry.studentId, value as AttendanceStatus)}
          label={`Attendance for ${entry.name}`}
        >
          <SegmentedControlItem value="present" label="Present" />
          <SegmentedControlItem value="late" label="Late" />
          <SegmentedControlItem value="excused" label="Excused" />
          <SegmentedControlItem value="absent" label="Absent" />
        </SegmentedControl>
      }
    />
  );
}

// ---------------------------------------------------------------------------
// Main component.
// ---------------------------------------------------------------------------

export interface EndMeetingDialogProps {
  sessionId: string;
  /** Injectable data-loading seam (module doc section 5). Defaults to fixture data. */
  loadSummary?: LoadEndMeetingSummaryFn;
  /**
   * Injectable atomic end-meeting seam (module doc section 1). Defaults to a
   * `console.warn` stub. See `EndMeetingPayload` for the single-payload
   * status-flip + mark-absent + checkout contract.
   */
  onEndMeeting?: OnEndMeetingFn;
  /**
   * Injectable post-completion attendance-correction seam (module doc
   * section 2b). Defaults to a `console.warn` stub. A plain `attendance`
   * UPDATE -- these corrections are a normal workflow and are not
   * audit-logged (module doc section 2).
   */
  onEditAttendance?: OnEditAttendanceFn;
  /**
   * Owner ruling 2026-08-04: when this dialog is mounted inside a surface
   * that already renders its own editable roster (`LiveConsole`), the
   * post-completion correction `List` below would duplicate every student.
   * Defaults to `true` (standalone use is unchanged); `LiveConsole` passes
   * `false`.
   */
  hasAttendanceCorrections?: boolean;
}

export function EndMeetingDialog({
  sessionId,
  loadSummary = defaultLoadEndMeetingSummary,
  onEndMeeting = defaultOnEndMeeting,
  onEditAttendance = defaultOnEditAttendance,
  hasAttendanceCorrections = true,
}: EndMeetingDialogProps): ReactNode {
  const loadState = useLoadState(() => loadSummary(sessionId), [loadSummary, sessionId]);
  const [data, setData] = useState<EndMeetingSummaryData | null>(null);

  useEffect(() => {
    if (loadState.status === 'success') setData(loadState.data);
  }, [loadState]);

  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [isEnding, setIsEnding] = useState(false);
  const [endError, setEndError] = useState<string | null>(null);
  const [editError, setEditError] = useState<string | null>(null);
  // Section 1a -- MUST default `false`. Defaulting `true` silently restores
  // the exact defect (an automatic, unconditional absence write) this row
  // exists to remove.
  const [markRemainingAbsent, setMarkRemainingAbsent] = useState(false);

  async function handleConfirmEndMeeting(): Promise<void> {
    if (data === null) return;
    // Section 1 / 1a: ONE payload naming all three legs, computed from live
    // state plus the coach's own opt-in choice.
    const payload = buildEndMeetingPayload(
      data.session,
      data.roster,
      data.attendanceByStudentId,
      markRemainingAbsent,
    );
    setIsEnding(true);
    setEndError(null);
    try {
      // Section 1: ONE call. Local state is only ever touched below, after
      // this awaited call has already resolved -- no optimistic half-flip.
      await onEndMeeting(payload);
      setData((prev) =>
        prev === null
          ? prev
          : {
              ...prev,
              session: { ...prev.session, status: 'completed' },
              attendanceByStudentId: applyEndMeetingResult(prev.attendanceByStudentId, payload),
            },
      );
      setIsConfirmOpen(false);
    } catch (error) {
      setEndError(
        error instanceof Error ? error.message : 'Something went wrong ending this meeting.',
      );
    } finally {
      setIsEnding(false);
    }
  }

  async function handleEditAttendance(studentId: string, status: AttendanceStatus): Promise<void> {
    if (data === null) return;
    const previousAttendance = data.attendanceByStudentId;
    const existing = previousAttendance[studentId];
    const optimistic: AttendanceRecordState =
      existing === undefined
        ? { status, checkInAt: null, checkOutAt: null, method: 'coach', recordedBy: null }
        : { ...existing, status, method: 'coach' };

    setData((prev) =>
      prev === null
        ? prev
        : {
            ...prev,
            attendanceByStudentId: { ...prev.attendanceByStudentId, [studentId]: optimistic },
          },
    );
    setEditError(null);
    try {
      // Section 2b: a plain UPDATE. Not audit-logged at any layer (module
      // doc section 2) -- nothing else happens here.
      await onEditAttendance(data.session.id, studentId, status);
    } catch (error) {
      setData((prev) =>
        prev === null ? prev : { ...prev, attendanceByStudentId: previousAttendance },
      );
      setEditError(
        error instanceof Error
          ? error.message
          : 'Something went wrong saving this attendance change.',
      );
    }
  }

  // Section 1a: how many roster members have no record at all -- gates
  // whether the opt-in checkbox renders (only when there is something to
  // ask about) and names its own label/disclosure sentence count.
  const unmarkedCount =
    data !== null ? computeNoRecordCount(data.roster, data.attendanceByStudentId) : 0;

  return (
    <VStack gap={4}>
      {/* T081 (DES-12 loading-state sweep) judgment call: kept as `Spinner`,
          NOT switched to `Skeleton` -- this dialog's eventual shape depends
          entirely on `data.session.status`, which is unknown until this
          load resolves: 'scheduled' renders an "End meeting" Button +
          AlertDialog, 'completed' renders an attendance-correction List,
          'canceled' renders a plain info Banner -- three structurally
          different, dialog-sized renders, matching Astryx's own "a dialog
          whose eventual content varies widely" case for keeping Spinner,
          not a single table/list/card-grid shape to preview. */}
      {loadState.status === 'loading' && <Spinner label="Loading meeting summary..." />}

      {loadState.status === 'error' && (
        <Banner
          status="error"
          title="Couldn't load this meeting"
          description="Something went wrong loading this session's attendance. Try refreshing the page."
          endContent={<Button variant="ghost" label="Retry" onClick={loadState.retry} />}
        />
      )}

      {loadState.status === 'success' && data !== null && (
        <>
          {endError !== null && (
            <Banner
              status="error"
              title="Couldn't end this meeting"
              description={endError}
              isDismissable
              onDismiss={() => setEndError(null)}
            />
          )}

          {data.session.status === 'scheduled' && (
            <>
              {/* Section 1a: the opt-in control -- beside the trigger, NOT
                  inside the confirm AlertDialog (it takes no children and a
                  required string `description`, so there is nowhere inside
                  it to put a real control). Only rendered when there is at
                  least one unmarked roster member to ask about. */}
              {unmarkedCount > 0 && (
                <CheckboxInput
                  label={buildMarkRemainingAbsentLabel(unmarkedCount)}
                  value={markRemainingAbsent}
                  onChange={setMarkRemainingAbsent}
                  description="Leave this unticked to end the meeting without recording anything for them."
                />
              )}
              <Button
                label="End meeting"
                variant="primary"
                onClick={() => setIsConfirmOpen(true)}
              />
              <AlertDialog
                isOpen={isConfirmOpen}
                onOpenChange={(open) => {
                  if (!open) setIsConfirmOpen(false);
                }}
                title="End this meeting?"
                description={buildEndMeetingConfirmDescription(
                  data.roster,
                  data.attendanceByStudentId,
                  markRemainingAbsent,
                )}
                actionLabel="End meeting"
                actionVariant="primary"
                onAction={() => {
                  void handleConfirmEndMeeting();
                }}
                isActionLoading={isEnding}
              />
            </>
          )}

          {data.session.status === 'completed' && (
            <>
              <Banner
                status="success"
                title="This meeting has ended"
                description="Attendance stays editable below."
              />

              {editError !== null && (
                <Banner
                  status="error"
                  title="Couldn't save attendance change"
                  description={editError}
                  isDismissable
                  onDismiss={() => setEditError(null)}
                />
              )}

              {hasAttendanceCorrections &&
                (data.roster.length === 0 ? (
                  <EmptyState
                    title="No students on this roster"
                    description="This session had no expected students."
                  />
                ) : (
                  <List hasDividers header="Attendance">
                    {data.roster.map((entry) => (
                      <AttendanceCorrectionRow
                        key={entry.studentId}
                        entry={entry}
                        record={data.attendanceByStudentId[entry.studentId]}
                        onSetStatus={(studentId, status) => {
                          void handleEditAttendance(studentId, status);
                        }}
                      />
                    ))}
                  </List>
                ))}
            </>
          )}

          {data.session.status === 'canceled' && (
            <Banner
              status="info"
              title="This meeting was canceled"
              description="No attendance actions are available for a canceled meeting."
            />
          )}
        </>
      )}
    </VStack>
  );
}

export default EndMeetingDialog;
