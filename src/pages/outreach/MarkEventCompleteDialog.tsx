/**
 * T127 (PRD v2 UXP-07): "Mark event complete" -- a single, staff-only action
 * on `OutreachDetail.tsx` that completes every REMAINING session of an
 * event in one confirmation, PRD line 134-137 verbatim:
 *
 * "One action completes every remaining session of an event (each getting
 * the same treatment as the existing per-day Mark Day Complete, including
 * people-reached entry where applicable), with a clear per-day summary in
 * the confirmation."
 *
 * -----------------------------------------------------------------------
 * 1. REUSE, DON'T RE-DERIVE (this task's own packet Trap #1 -- the single
 *    most important discipline in this file). The exact shared code path
 *    this dialog drives, per remaining session, is `markDayComplete`
 *    (`../../lib/supabase/loaders/outreach.ts`) -- the SAME real mutation
 *    `MarkDayCompleteDialog.tsx`'s own `onMarkComplete` prop already
 *    defaults to for the single-day flow (imported here from the identical
 *    loader module, not re-derived). `buildMarkEventCompletePayload` below
 *    is the ONE place a per-session `MarkDayCompletePayload` is constructed
 *    for bulk mode, and it does so by calling
 *    `MarkDayCompleteDialog.tsx`'s own exported pure functions --
 *    **T307 UPDATE:** `computeInitialFormSeed` (that file's own module doc
 *    #9 -- recorded attendance first, falling back to a `going` RSVP
 *    per-student only when no recorded row exists) is now the checklist
 *    derivation this bulk path uses, replacing the RSVP-only
 *    `computeInitialAttendedStudentIds` this file used pre-T307 (see (2)(a)
 *    below) -- and `buildAttendanceWriteRows` (the attendance-row
 *    constructor, now fed REAL loaded rows instead of an empty map, see
 *    §3/§4 below) -- imported directly from that file, never reimplemented.
 *    There is no second, parallel field list anywhere in this file: every
 *    field on the `MarkDayCompletePayload` this file builds is produced by
 *    that same dialog's own already-tested functions, or is a plain
 *    pass-through (`sessionId`, `recordedBy`) of a value this file already
 *    has. Zero metric math happens here (constitution item 3) -- this file
 *    never sums hours, never touches `v_student_hours`, and the "per-day
 *    summary" required below is a plain count of done/failed/skipped
 *    outcomes, not a computed metric.
 *
 * -----------------------------------------------------------------------
 * 2. DISCLOSED SCOPE NARROWING vs. the per-day dialog -- two fields the
 *    per-day `MarkDayCompleteDialog` UI collects are deliberately NOT
 *    exposed as bulk-mode inputs, a judgment call flagged here rather than
 *    silently applied:
 *
 *    (a) Attendee checklist -- this task's own packet Objective describes
 *        the bulk confirmation surface as listing "date/time and, where the
 *        existing per-day flow collects people-reached, a per-day
 *        people-reached input" -- no per-session editable checklist is
 *        named, so bulk mode still has NO manual per-session
 *        check/uncheck surface. **T307 UPDATE (this task; both T305-era
 *        clauses below are now corrected a second time):** what changed is
 *        NOT the absence of a checklist UI -- that remains true -- but
 *        WHERE the (still non-editable) checklist's membership comes from
 *        and, critically, what gets WRITTEN for a student already on it.
 *        Before this task, `buildMarkEventCompletePayload` seeded
 *        membership from `computeInitialAttendedStudentIds` (`going` RSVPs
 *        only) and wrote every checked student with a hardcoded
 *        `hoursOverride: null`, `checkInAt`/`checkOutAt: null`,
 *        `method: 'coach'` -- so a student who RSVP'd `going` **and** had
 *        real recorded attendance (a QR check-in, a coach-typed hours
 *        override, or both) had that record **destroyed** the moment a
 *        coach clicked "Mark event complete", with no checklist and no
 *        review step to catch it. That was a live, reachable data-loss bug
 *        (filed as **T307**, this task). It is now fixed on two fronts:
 *        §4's seeding decision (membership now ALSO includes a student with
 *        a recorded attending row and no RSVP, via `computeInitialFormSeed`
 *        -- the same rule T305 gave the per-day dialog) and §5's
 *        write-preservation (a checked student's real `status`/
 *        `checkInAt`/`checkOutAt`/`hoursOverride`/`method` are now carried
 *        through instead of overwritten, via `buildAttendanceWriteRows`'
 *        now-populated fifth parameter). `MarkEventCompleteDialog.test.tsx`'s
 *        old byte-for-byte pin at `:206-216` (a `going`-RSVP student with NO
 *        recorded row, written as `present`/`coach`/`null`/`null`) is
 *        EXTENDED, not dropped -- that exact case is still correct today,
 *        it is simply no longer the ONLY case this file's write path
 *        produces correctly.
 *    (b) Adult volunteers count/hours (this-session deltas) -- also absent
 *        from the packet's named bulk fields. `buildMarkEventCompletePayload`
 *        always passes `0`/`0` for these, and `markDayComplete`'s own module
 *        doc #4(c) already SKIPS that additive `events` read-modify-write
 *        entirely when both deltas are `0` -- so bulk-completing a day never
 *        touches `events.adult_volunteers_count`/`adult_volunteer_hours` at
 *        all, a strictly safer no-op rather than a fabricated `0`
 *        overwrite.
 *    Both narrowings mean the ONLY per-session bulk-mode INPUT is
 *    people-reached (per the packet's own literal wording), while the
 *    WRITE still goes through the exact same three-part `markDayComplete`
 *    mutation the per-day dialog uses -- "same treatment", not a smaller
 *    parallel mutation.
 *
 * -----------------------------------------------------------------------
 * 3. PARTIAL-FAILURE HONESTY (Trap #2). `remaining` sessions are processed
 *    SEQUENTIALLY (an ordinary `for...of` with `await`, never
 *    `Promise.all`), and EVERY session is attempted regardless of an
 *    earlier one's outcome -- one session's rejection never aborts the
 *    batch. `outcomeBySessionId` is updated via `setState` immediately
 *    after EACH session's write settles (success or failure), so the
 *    per-day summary painted on screen is a live, incremental reflection of
 *    real writes landing one at a time -- never a single optimistic
 *    "all done" banner rendered before every write has actually resolved.
 *    The summary `Banner` (status `success`/`error`) and the
 *    `computeCompletionSummaryText` counts are only rendered once
 *    `hasSubmitted` is true, i.e. after the full sequential batch has been
 *    attempted. `onFinished` (optional prop) fires exactly once, after the
 *    batch completes (success or partial failure) -- `OutreachDetail.tsx`
 *    wires this to its own `reloadDetail()`, so the page's session
 *    statuses/`peopleReached` values are refetched from the real database
 *    rather than left as a client-only optimistic guess. The dialog also
 *    refuses to close (`handleClose` no-ops) while a batch is mid-flight, so
 *    a coach can't lose track of which sessions were actually attempted.
 *
 * -----------------------------------------------------------------------
 * 4. SKIPPED SESSIONS NEVER REPROCESSED (packet Objective, literal text:
 *    "Already-completed and canceled sessions are listed as skipped in the
 *    summary (read-only), never re-processed"). `partitionEventSessions`
 *    is the ONE place `sessions` is split into `remaining` (status
 *    `'scheduled'`) and `skipped` (`'completed'`/`'canceled'`) -- the write
 *    loop in `handleConfirm` only ever iterates `remaining`, grep-provable:
 *    `skipped` is read only for its own read-only render branch, never
 *    passed to `buildMarkEventCompletePayload`/`onMarkSessionComplete`.
 *
 * -----------------------------------------------------------------------
 * 5. Astryx prop sourcing (constitution item 2) -- every prop used below is
 *    the SAME set `MarkDayCompleteDialog.tsx`'s own module doc #8 already
 *    cross-checked against `docs/swarm/astryx-api.md` (Dialog, DialogHeader,
 *    Layout/LayoutContent/LayoutFooter, FormLayout, NumberInput, Button,
 *    Banner, HStack/VStack, Text) -- re-verified live for this task, no new
 *    component/prop introduced.
 *
 * -----------------------------------------------------------------------
 * 6. T307 -- the load seam, and why its failure rule is the OPPOSITE of
 *    T305's, on purpose.
 *
 *    This dialog now loads `attendance` for every `remaining` session
 *    (`loadAttendance`, defaulting to the real `loadAttendanceForSessions`,
 *    `../../lib/supabase/loaders/attendance.ts`) -- ONE call, keyed on
 *    `remaining`'s ids, never `skipped`'s and never one call per session.
 *    The load fires on the `isOpen` transition (this component's existing
 *    `sessionsKey`-keyed effect pattern, reused rather than a new key), NOT
 *    on mount -- this component is mounted whenever `user !== null`
 *    (`OutreachDetail.tsx`), so an ungated load would fire on every staff
 *    page load regardless of whether this dialog is ever opened.
 *
 *    `attendanceState` is a three-state union (`'loading' | 'error' |
 *    'success'`), the same shape `AttendancePanel.tsx`'s own
 *    `useAttendanceLoadState` (`:523-554`) already established as "a
 *    second, smaller DES-12 seam" nested inside an already-loaded page
 *    (that file's own comment at `:515-521` is the precedent this dialog
 *    cites rather than re-deriving the justification).
 *
 *    **THE FAILURE RULE IS DELIBERATELY THE OPPOSITE OF
 *    `MarkDayCompleteDialog.tsx`'s (T305, module doc #9).** That per-day
 *    dialog MAY fall back to RSVP-only seeding when its load fails or is
 *    still in flight, because it shows the coach an editable checklist he
 *    reviews and can correct before confirming -- a degraded *display*, not
 *    a silent write. THIS dialog shows no checklist and no review step at
 *    all, so the same fallback here would mean writing an RSVP-only payload
 *    over a student's real recorded attendance with nobody able to catch
 *    it -- reintroducing the exact bug this task exists to fix, on the one
 *    path where it is unrecoverable. So here: **a load that is in flight or
 *    has failed BLOCKS the write.** `handleConfirm` refuses to run
 *    (guarded twice -- once by the disabled confirm button, once
 *    defensively inside `handleConfirm` itself, since jsdom's `disabled`
 *    attribute alone already suppresses a dispatched click and this second
 *    guard is therefore untestable, defence-in-depth only) unless
 *    `attendanceState.status === 'success'`. A future reader must NOT
 *    "harmonise" these two dialogs' failure rules -- they differ because
 *    what the coach can see and correct before the write differs, not
 *    because of an oversight in either file.
 *
 *    **Seeding (module doc #2(a) above) also changed, and it is an
 *    ORCHESTRATOR decision, not one the human product owner has ruled on.**
 *    His T305 ruling on recorded-attendance-over-RSVP is written in display
 *    terms ("where a screen currently shows RSVP intent... show what was
 *    actually recorded") and this dialog shows no checklist, so the ruling
 *    does not cleanly reach here. This file nonetheless seeds and writes
 *    using T305's exact rule (`computeInitialFormSeed`) so the per-day and
 *    bulk paths never disagree about who attended the same session (the
 *    T188/T303 two-numbers-for-one-fact family) -- cheap for him to
 *    overrule if he disagrees, since it is one seeding call, not scattered
 *    logic. **One real, disclosed cost:** once a session's rows are
 *    loaded, a student with an existing recorded row is written back
 *    exactly as they already are, EXCEPT `attendance.recorded_by` (and
 *    `updated_at`), which `makeMarkDayComplete`'s upsert also names
 *    (`loaders/outreach.ts:1139-1149`) -- so this write re-attributes that
 *    row to whoever clicked "Mark event complete" today, on a row this path
 *    never displayed and the coach never actively edited. This is
 *    consistent with `UpsertAttendanceParams.recordedBy`'s own documented
 *    convention ("always re-attributed to whoever is editing right now")
 *    and with T305's own W5, but every prior instance of that convention
 *    involved a coach actively editing that specific student's row, which
 *    this path does not. Reassuring corollary: this path can never
 *    FABRICATE a row for a student who had none -- qualifying for
 *    inclusion via the recorded-attendance branch requires already having
 *    a recorded row (`isAttendingStatus(existing.status)`); nothing is
 *    invented, only re-attributed.
 */
import { useEffect, useState, type ReactNode } from 'react';
import {
  Banner,
  Button,
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
import {
  buildAttendanceWriteRows,
  computeInitialFormSeed,
  formatSessionDateTime,
  type MarkDayCompletePayload,
  type MarkDayCompleteSession,
  type OnMarkDayCompleteFn,
  type RosterStudent,
  type RsvpRow,
} from './MarkDayCompleteDialog';
// Module doc #1 -- the exact shared mutation `MarkDayCompleteDialog.tsx`'s
// own `onMarkComplete` prop already defaults to, imported from the SAME
// loader module (not re-derived, not reimplemented).
import { markDayComplete } from '../../lib/supabase/loaders/outreach';
// Module doc #6 (T307) -- the load seam, mirroring `AttendancePanel.tsx`'s
// own `loadAttendance` injection convention. `AttendanceRow` is the loaded
// row shape `buildAttendanceWriteRows`' required fifth parameter is keyed
// against.
import {
  loadAttendanceForSessions,
  type AttendanceRow,
  type LoadAttendanceForSessionsFn,
} from '../../lib/supabase/loaders/attendance';

// ---------------------------------------------------------------------------
// Pure functions -- exported for direct testing. Module docs #1/#3/#4.
// ---------------------------------------------------------------------------

export interface PartitionedEventSessions {
  /** `status === 'scheduled'` -- the only sessions this dialog ever writes
   * to (module doc #4). Chronologically sorted. */
  remaining: MarkDayCompleteSession[];
  /** `status !== 'scheduled'` -- read-only, never passed to
   * `buildMarkEventCompletePayload`/`onMarkSessionComplete`. */
  skipped: MarkDayCompleteSession[];
}

/** Module doc #4 -- THE ONE place `sessions` is split into "will be
 * processed" vs. "already handled, listed read-only". */
export function partitionEventSessions(
  sessions: readonly MarkDayCompleteSession[],
): PartitionedEventSessions {
  const sorted = [...sessions].sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  return {
    remaining: sorted.filter((session) => session.status === 'scheduled'),
    skipped: sorted.filter((session) => session.status !== 'scheduled'),
  };
}

/** BEH-07-style named action label (constitution item 14 -- never a bare
 * "Confirm"/"Submit"). */
export function computeMarkEventCompleteConfirmLabel(remainingCount: number): string {
  const noun = remainingCount === 1 ? 'session' : 'sessions';
  return `Mark ${remainingCount} ${noun} complete`;
}

/** T307, module doc #9 (`MarkDayCompleteDialog.tsx`)'s own
 * `buildRecordedRowsByStudentId` filters/keys loaded rows for exactly this
 * purpose but is deliberately NOT exported, and that file is a Forbidden
 * File for this task (packet §9) -- so this is an AUTHORIZED local
 * re-derivation of that same four-line filter-and-key, not a new design.
 * This is in mild, disclosed tension with this file's own module doc #1
 * ("REUSE, DON'T RE-DERIVE... the single most important discipline in this
 * file") -- the packet names the tension explicitly and authorizes it
 * rather than widening a Forbidden file's exports. */
function buildRecordedRowsByStudentIdForSession(
  sessionId: string,
  recordedRows: readonly AttendanceRow[],
): Record<string, AttendanceRow> {
  const rowsByStudentId: Record<string, AttendanceRow> = {};
  for (const row of recordedRows) {
    if (row.sessionId === sessionId) rowsByStudentId[row.studentId] = row;
  }
  return rowsByStudentId;
}

/** Module doc #1/#2/#6 -- THE ONE place a bulk-mode per-session
 * `MarkDayCompletePayload` is built. Reuses `computeInitialFormSeed` +
 * `buildAttendanceWriteRows` (`MarkDayCompleteDialog.tsx`'s own pure
 * functions) for the attendance rows. **T307 UPDATE:** `recordedRows` is a
 * REQUIRED sixth parameter -- this session's loaded `attendance` rows (any
 * session, this function filters by `session.id` itself) -- so a call site
 * that forgets to load/pass them does not compile (the T151/T179
 * mechanism, same discipline `buildAttendanceWriteRows`' own required
 * fifth parameter already applies). The only production call site
 * (`handleConfirm` below) only ever calls this once `attendanceState.status
 * === 'success'` (module doc #6's block-on-failure rule), so `recordedRows`
 * is always the real loaded array there, never a stand-in for "not loaded
 * yet". `computeInitialFormSeed` implements module doc #6's seeding rule
 * (recorded attending row -> included; no row -> included iff a `going`
 * RSVP exists) -- its returned `hoursOverrideByStudentId` is intentionally
 * DISCARDED here, not threaded through: module doc #2(a) still holds, this
 * bulk path has no per-student hours-override input, and
 * `buildAttendanceWriteRows`' own fallback
 * (`hoursOverrideByStudentId[studentId] ?? existing?.hoursOverride ?? null`)
 * already recovers a recorded student's real override from `recordedRows`
 * directly when the coach map is `{}` -- computing it twice would be the
 * exact re-derivation module doc #1 forbids. Adult-volunteer deltas are
 * always `0`/`0` (module doc #2(b)). */
export function buildMarkEventCompletePayload(
  session: MarkDayCompleteSession,
  peopleReached: number | null,
  roster: readonly RosterStudent[],
  rsvps: readonly RsvpRow[],
  recordedBy: string,
  recordedRows: readonly AttendanceRow[],
): MarkDayCompletePayload {
  const { checkedStudentIds } = computeInitialFormSeed(session.id, roster, rsvps, recordedRows);
  const recordedRowByStudentId = buildRecordedRowsByStudentIdForSession(session.id, recordedRows);
  return {
    sessionId: session.id,
    peopleReached,
    // T307: real recorded rows, keyed by student id for exactly this
    // session -- replaces the empty map T305 left here (that file's own
    // module doc #5.1) with the preserving write module doc #6 describes.
    attendance: buildAttendanceWriteRows(
      session.id,
      checkedStudentIds,
      {},
      recordedBy,
      recordedRowByStudentId,
    ),
    adultVolunteersCountThisSession: 0,
    adultVolunteerHoursThisSession: 0,
    recordedBy,
  };
}

export type SessionOutcomeStatus = 'pending' | 'done' | 'failed';

export interface SessionOutcome {
  status: SessionOutcomeStatus;
  /** Only set for `status === 'failed'`. */
  message?: string;
}

/** Module doc #1/#3 -- a plain integer count-and-join, never a metric
 * formula/re-derivation of anything SQL-owned. */
export function computeCompletionSummaryText(
  doneCount: number,
  failedCount: number,
  skippedCount: number,
): string {
  const parts = [`${doneCount} completed`];
  if (failedCount > 0) parts.push(`${failedCount} failed`);
  if (skippedCount > 0) parts.push(`${skippedCount} skipped`);
  return parts.join(' · ');
}

// ---------------------------------------------------------------------------
// Presentational subcomponent.
// ---------------------------------------------------------------------------

function SessionResultText({ outcome }: { outcome: SessionOutcome | undefined }): ReactNode {
  if (outcome === undefined || outcome.status === 'pending') {
    return (
      <Text type="supporting" color="secondary">
        Pending…
      </Text>
    );
  }
  if (outcome.status === 'done') {
    return (
      <Text type="supporting" color="secondary">
        Done — marked complete
      </Text>
    );
  }
  return (
    <Text type="supporting" weight="semibold">
      Failed — {outcome.message}
    </Text>
  );
}

// ---------------------------------------------------------------------------
// Component. Module docs #1-#4.
// ---------------------------------------------------------------------------

const DEFAULT_EVENT_TITLE = 'This event';

export interface MarkEventCompleteDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  /** Display context only, e.g. `events.title`. */
  eventTitle?: string;
  /** Every session for the event -- both the ones this dialog will process
   * (`status === 'scheduled'`) and the ones it will list read-only as
   * skipped (module doc #4). */
  sessions: readonly MarkDayCompleteSession[];
  /** The event's resolvable roster -- same shape/derivation contract
   * `MarkDayCompleteDialog.tsx`'s own `roster` prop already documents. */
  roster: readonly RosterStudent[];
  /** Every `rsvps` row for the event's sessions. */
  rsvps: readonly RsvpRow[];
  /** Injectable auth seam. T179: required -- `MarkDayCompleteDialog.tsx`'s
   * own matching prop lost its disclosed placeholder default in the same
   * task (that file's module doc #7's "T179 UPDATE" paragraph has the full
   * writeup, including deletion of the now-unused exported placeholder
   * constant this prop used to default to -- deliberately not named here by
   * its old identifier, since this task's own A3 criterion requires zero
   * occurrences of that identifier anywhere in either file, prose included);
   * this prop is required for the identical reason -- an omitted value must
   * fail `tsc`, not silently write a fake `profiles.id` into
   * `attendance.recorded_by`. */
  currentUserProfileId: string;
  /** Injectable persistence seam, called once per remaining session (module
   * doc #1/#3). Defaults to the real `markDayComplete` mutation -- the SAME
   * shared code path `MarkDayCompleteDialog.tsx`'s own `onMarkComplete`
   * default already drives. */
  onMarkSessionComplete?: OnMarkDayCompleteFn;
  /** Module doc #3 -- called once after the whole sequential batch has been
   * attempted (success or partial failure), so the caller can refetch its
   * own data. */
  onFinished?: () => void;
  /** T307, module doc #6 -- injectable load seam for this event's recorded
   * `attendance` (loaded once for every `remaining` session id). Defaults
   * to the real `loadAttendanceForSessions` -- the SAME query
   * `AttendancePanel.tsx`'s own matching prop already defaults to. */
  loadAttendance?: LoadAttendanceForSessionsFn;
}

/** T307, module doc #6 -- a second, smaller DES-12 seam nested inside this
 * already-open dialog, same shape `AttendancePanel.tsx`'s own
 * `AttendanceLoadState` (`:523-527`) already established. Deliberately NOT
 * exported -- private to this component's own load gating. */
type AttendanceLoadState =
  | { status: 'loading' }
  | { status: 'error'; retry: () => void }
  | { status: 'success'; rows: AttendanceRow[] };

export function MarkEventCompleteDialog({
  isOpen,
  onOpenChange,
  eventTitle = DEFAULT_EVENT_TITLE,
  sessions,
  roster,
  rsvps,
  currentUserProfileId,
  onMarkSessionComplete = markDayComplete,
  onFinished,
  loadAttendance = loadAttendanceForSessions,
}: MarkEventCompleteDialogProps): ReactNode {
  const { remaining, skipped } = partitionEventSessions(sessions);

  const [peopleReachedBySessionId, setPeopleReachedBySessionId] = useState<
    Record<string, number | null>
  >({});
  const [outcomeBySessionId, setOutcomeBySessionId] = useState<Record<string, SessionOutcome>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasSubmitted, setHasSubmitted] = useState(false);
  // T307, module doc #6 -- this event's loaded recorded attendance for
  // every `remaining` session, or the in-flight/failed state that BLOCKS
  // the write (the opposite of `MarkDayCompleteDialog.tsx`'s graceful
  // fallback -- see module doc #6 for why).
  const [attendanceState, setAttendanceState] = useState<AttendanceLoadState>({
    status: 'loading',
  });
  const [retryToken, setRetryToken] = useState(0);

  function resetForm(): void {
    const seededPeopleReached: Record<string, number | null> = {};
    const seededOutcomes: Record<string, SessionOutcome> = {};
    for (const session of remaining) {
      seededPeopleReached[session.id] = session.peopleReached ?? null;
      seededOutcomes[session.id] = { status: 'pending' };
    }
    setPeopleReachedBySessionId(seededPeopleReached);
    setOutcomeBySessionId(seededOutcomes);
    setHasSubmitted(false);
  }

  // Stable primitive key (not the `sessions` array reference, which is
  // rebuilt every render by callers like `OutreachDetail.tsx`'s own
  // `sortSessionsByStart`) -- same "reset only on the isOpen transition"
  // pattern `MarkDayCompleteDialog.tsx`'s own effect already established.
  const sessionsKey = sessions.map((session) => `${session.id}:${session.status}`).join(',');

  useEffect(() => {
    if (isOpen) resetForm();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset only on the isOpen transition / session-set change.
  }, [isOpen, sessionsKey]);

  // T307, module doc #6 -- load ONCE for every `remaining` session id
  // (never `skipped`, never one call per session), gated on `isOpen` (not
  // mount -- this component is mounted whenever `user !== null`,
  // `OutreachDetail.tsx`). Shape mirrors `AttendancePanel.tsx`'s own
  // `useAttendanceLoadState` (`let isMounted`, `.then`/`.catch`, cleanup
  // sets `isMounted = false`) -- unlike `MarkDayCompleteDialog.tsx`'s
  // per-session load (which is allowed to fail silently, §3/module doc #6),
  // this one surfaces `'error'` with a retry rather than falling back.
  useEffect(() => {
    if (!isOpen) return undefined;
    let isMounted = true;
    setAttendanceState({ status: 'loading' });
    const remainingSessionIds = remaining.map((session) => session.id);
    loadAttendance(remainingSessionIds)
      .then((rows) => {
        if (!isMounted) return;
        // T401: this used to fail CLOSED here whenever `rows.length >= 1000`
        // (`supabase/config.toml`'s `[api] max_rows`), because
        // `queryAttendanceForSessions` (`loaders/attendance.ts`) issued a
        // bare `.select('*').in(...)` with no `.range()`/`.limit()`, so a
        // capped PostgREST response (200 with a partial `Content-Range`, not
        // an error) resolved a truncated array `createLoader`
        // (`loader.ts:174-176`, which throws only on `result.error`) had no
        // way to distinguish from a complete one -- a student whose row was
        // truncated away looked identical to one who never had a row, so the
        // write would have nulled their real check-in/check-out/hours/method.
        //
        // T320 removed the thing that guard was a proxy for:
        // `makeLoadAttendanceForSessions` (`loaders/attendance.ts:303-375`)
        // now pages with `.order('id', { ascending: true })` and
        // `.range(...)`, looping until a short page returns, so the resolved
        // array is complete regardless of its length. A resolve of 1000+
        // rows is no longer evidence of truncation, so treating it as a
        // failed load would now block a legitimate write on a correct one --
        // the loader is the single place that knows about `max_rows` now.
        setAttendanceState({ status: 'success', rows });
      })
      .catch(() => {
        if (isMounted) {
          setAttendanceState({
            status: 'error',
            retry: () => setRetryToken((token) => token + 1),
          });
        }
      });
    return () => {
      isMounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `remaining` intentionally excluded: it is re-derived from `sessions` every render (rebuilt by callers, same as the effect above), so `sessionsKey` is the correct, stable key; `retryToken` is read only to re-trigger this effect.
  }, [isOpen, sessionsKey, loadAttendance, retryToken]);

  const hasStarted = isSubmitting || hasSubmitted;

  function handleClose(): void {
    // Module doc #3 -- never interrupt an in-flight sequential batch; a
    // coach must let it finish (or it will finish regardless, since each
    // write is already in flight) before losing this dialog's live summary.
    if (isSubmitting) return;
    onOpenChange(false);
  }

  async function handleConfirm(): Promise<void> {
    if (isSubmitting || hasSubmitted || remaining.length === 0) return;
    // T307, module doc #6 (F1b) -- defence in depth. The confirm button is
    // already `isDisabled` whenever `attendanceState.status !== 'success'`.
    // T307's own checker disproved the original claim here that jsdom's
    // `disabled` DOM attribute alone suppresses the dispatched click:
    // Astryx's `Button` guards on the `isDisabled` PROP, not the attribute,
    // so this guard and the button's are independently load-bearing, not
    // redundant -- mutation-proven, removing only the button's `isDisabled`
    // still blocks the write, and removing both lets one through.
    if (attendanceState.status !== 'success') return;
    const recordedRows = attendanceState.rows;
    setIsSubmitting(true);
    // Module doc #3 -- sequential, every session attempted regardless of an
    // earlier one's outcome; state updates land incrementally, per session.
    for (const session of remaining) {
      const payload = buildMarkEventCompletePayload(
        session,
        peopleReachedBySessionId[session.id] ?? null,
        roster,
        rsvps,
        currentUserProfileId,
        recordedRows,
      );
      try {
        await onMarkSessionComplete(payload);
        setOutcomeBySessionId((prev) => ({ ...prev, [session.id]: { status: 'done' } }));
      } catch (error) {
        setOutcomeBySessionId((prev) => ({
          ...prev,
          [session.id]: {
            status: 'failed',
            message:
              error instanceof Error
                ? error.message
                : 'Something went wrong marking this day complete.',
          },
        }));
      }
    }
    setIsSubmitting(false);
    setHasSubmitted(true);
    onFinished?.();
  }

  const outcomes = Object.values(outcomeBySessionId);
  const doneCount = outcomes.filter((outcome) => outcome.status === 'done').length;
  const failedCount = outcomes.filter((outcome) => outcome.status === 'failed').length;
  const summaryText = computeCompletionSummaryText(doneCount, failedCount, skipped.length);

  return (
    <Dialog
      isOpen={isOpen}
      onOpenChange={(open) => {
        if (!open) handleClose();
      }}
      purpose="form"
    >
      <Layout
        header={
          <DialogHeader
            title="Mark event complete"
            subtitle={eventTitle}
            onOpenChange={(open) => {
              if (!open) handleClose();
            }}
          />
        }
        content={
          <LayoutContent>
            <FormLayout>
              {remaining.length === 0 ? (
                <Banner
                  status="info"
                  title="No sessions to mark complete"
                  description="Every session for this event is already completed or canceled."
                />
              ) : (
                <VStack gap={4}>
                  <Text type="supporting">
                    Confirming applies the same treatment as Mark day complete to every session
                    below.
                  </Text>
                  {/* T307, module doc #6 -- suppressed once `remaining.length === 0` by
                      being nested inside this branch (packet §3's cosmetic requirement:
                      never stack this next to "No sessions to mark complete"). Not a
                      bare spinner over the whole dialog -- the people-reached inputs
                      below stay usable while this loads. Also gated on `isOpen`: this
                      dialog's own `Dialog`/`Layout` content is present in the DOM even
                      while closed (this component is mounted whenever `user !== null`,
                      module doc #6 -- Dialog only hides it visually), so an ungated
                      "Loading…" region here would leak an `aria-busy` marker onto every
                      page this dialog is mounted on, for every viewer, at all times. */}
                  {isOpen && !hasStarted && attendanceState.status === 'loading' && (
                    <Text type="supporting" color="secondary" aria-busy="true">
                      Loading recorded attendance…
                    </Text>
                  )}
                  {isOpen && !hasStarted && attendanceState.status === 'error' && (
                    <Banner
                      status="error"
                      title="Couldn't load recorded attendance"
                      description="Something went wrong loading this event's recorded attendance. Marking sessions complete is disabled until this loads, so nothing recorded gets overwritten."
                      endContent={
                        <Button variant="ghost" label="Retry" onClick={attendanceState.retry} />
                      }
                    />
                  )}
                  {remaining.map((session) => (
                    <VStack key={session.id} gap={1}>
                      {hasStarted ? (
                        <VStack gap={1}>
                          <Text type="body">{formatSessionDateTime(session)}</Text>
                          <SessionResultText outcome={outcomeBySessionId[session.id]} />
                        </VStack>
                      ) : (
                        <NumberInput
                          label={`People reached — ${formatSessionDateTime(session)}`}
                          value={peopleReachedBySessionId[session.id] ?? null}
                          onChange={(value) =>
                            setPeopleReachedBySessionId((prev) => ({
                              ...prev,
                              [session.id]: value,
                            }))
                          }
                          min={0}
                          isIntegerOnly
                          hasClear
                          isOptional
                        />
                      )}
                    </VStack>
                  ))}
                </VStack>
              )}

              {skipped.length > 0 && (
                <VStack gap={1}>
                  <Text type="supporting">Already handled (skipped, not re-processed)</Text>
                  {skipped.map((session) => (
                    <Text key={session.id} type="supporting" color="secondary">
                      {formatSessionDateTime(session)} — already {session.status}
                    </Text>
                  ))}
                </VStack>
              )}

              {hasSubmitted && (
                <Banner
                  status={failedCount > 0 ? 'error' : 'success'}
                  title={
                    failedCount > 0
                      ? "Some sessions couldn't be marked complete"
                      : 'Event marked complete'
                  }
                  description={summaryText}
                />
              )}
            </FormLayout>
          </LayoutContent>
        }
        footer={
          <LayoutFooter hasDivider>
            <HStack hAlign="end" gap={2}>
              {hasSubmitted || remaining.length === 0 ? (
                <Button label="Close" variant="secondary" onClick={handleClose} />
              ) : (
                <>
                  <Button
                    label="Cancel"
                    variant="secondary"
                    isDisabled={isSubmitting}
                    onClick={handleClose}
                  />
                  <Button
                    label={computeMarkEventCompleteConfirmLabel(remaining.length)}
                    variant="primary"
                    // T307, module doc #6 -- blocks the write whenever the
                    // recorded-attendance load has not yet succeeded
                    // (loading OR error), the opposite of
                    // `MarkDayCompleteDialog.tsx`'s graceful fallback (§3).
                    isDisabled={isSubmitting || attendanceState.status !== 'success'}
                    isLoading={isSubmitting}
                    clickAction={handleConfirm}
                  />
                </>
              )}
            </HStack>
          </LayoutFooter>
        }
      />
    </Dialog>
  );
}

export default MarkEventCompleteDialog;
