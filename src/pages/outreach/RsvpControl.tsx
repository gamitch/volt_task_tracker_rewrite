/**
 * T040: standalone, reusable RSVP `SegmentedControl` (OUT-03), PRD line 294:
 *
 * "**OUT-03 Signups (RSVP):** students see future outreach sessions with
 * `SegmentedControl` [Sign up | Maybe | Can't go] -> `rsvps.status` in
 * `going | maybe | declined`, `responded_by = student`. Changing is allowed
 * until session start."
 *
 * This is the "real, validated, server-persisted" RSVP control
 * `OutreachList.tsx` (T038)'s own module doc explicitly deferred to this
 * task (see that file's module doc #8b: "The fuller, validated,
 * server-persisted RSVP flow ... belongs to `RsvpControl.tsx`
 * (T040/T042 ...), neither of which is built or imported here."). This
 * component is the STUDENT's own RSVP control specifically -- the
 * parent-facing, multi-student version is `ParentRsvp.tsx` (T043, separate,
 * not-yet-built, Forbidden Files here).
 *
 * -----------------------------------------------------------------------
 * 1. Ground truth -- `rsvps` column shapes, cited directly from
 *    `supabase/migrations/20260717000000_scheduling_attendance.sql` lines
 *    67-76 (read-only), NOT redefined/renamed with invented fields:
 *
 *    `rsvps`: id, session_id fk `event_sessions` (restrict), student_id fk
 *    `students` (restrict), status text check(`'going'|'maybe'|'declined'`),
 *    responded_by uuid references `public.profiles (id)` (nullable, restrict
 *    on delete), updated_at, created_at, unique (session_id, student_id).
 *
 *    `event_sessions` (lines 53-63, same migration): id, event_id, session_date
 *    (date), starts_at (timestamptz), ends_at (timestamptz), status (check:
 *    'scheduled' | 'completed' | 'canceled'), people_reached, notes,
 *    created_at.
 *
 *    `RsvpRow`/`RsvpControlSession` below are camelCase renames of the subset
 *    of these columns this component needs, matching `OutreachList.tsx`'s
 *    (T038, Forbidden Files, read-only reference per this task's own
 *    Dependencies) own `RsvpRow`/`OutreachSessionRow` field names/casing
 *    exactly (id, sessionId, studentId, status, respondedBy, updatedAt,
 *    createdAt / id, eventId, sessionDate, startsAt, endsAt, status,
 *    peopleReached) -- NOT independently invented -- so a future wiring task
 *    that swaps `OutreachList.tsx`'s inline per-row stub for this real
 *    component can pass its existing objects straight through with no
 *    reshaping. `OutreachList.tsx` is a forbidden/read-only file for this
 *    task, so these shapes are reimplemented here (not imported), same
 *    posture `OutreachEventDialog.tsx` (T039) already established for its
 *    own independently-reimplemented date/time helpers relative to
 *    `OutreachList.tsx`/`ScheduleMeetingsDialog.tsx`.
 *
 * -----------------------------------------------------------------------
 * 2. THE LABEL-VS-STORED-VALUE MAPPING (Ground Truth, packet's own explicit
 *    instruction to disclose this) -- and the packet's OUT-03-literal label
 *    correction (Known Context/Traps, this task's packet): the three
 *    `SegmentedControlItem`s below use OUT-03's own literal labels ("Sign
 *    up" / "Maybe" / "Can't go" -- quoted verbatim above from PRD line 294),
 *    NOT "Going" (the value string, or `OutreachList.tsx`'s own row-preview
 *    label choice, which is a disclosed, non-literal simplification on that
 *    file's part -- not re-derived here). `RSVP_ITEMS` below is the ONE
 *    place these three label/value pairs are defined:
 *
 *      label "Sign up"   -> stored `rsvps.status` value `'going'`
 *      label "Maybe"     -> stored `rsvps.status` value `'maybe'`
 *      label "Can't go"  -> stored `rsvps.status` value `'declined'`
 *
 *    The third pair is the subtle one: the real `rsvps.status` check
 *    constraint (migration line 71, quoted in module doc #1) only accepts
 *    the literal enum value `'declined'` -- there is no `"can't go"`/
 *    `"cant_go"`/etc. value anywhere in that check. "Can't go" is ONLY ever
 *    the user-facing `SegmentedControlItem` `label` text; every write this
 *    component ever performs (`handleChange` below) sends the mapped
 *    `RsvpStatus` value (`'going'|'maybe'|'declined'`), never the label
 *    string itself.
 *
 * -----------------------------------------------------------------------
 * 3. `responded_by` -- a real `profiles` foreign key, never a literal role
 *    string (Ground Truth / Known Context/Traps #3).
 *
 * `rsvps.responded_by` (migration line 72) is `uuid references
 * public.profiles (id)`, nullable -- there is no `'student'`/`'parent'` text
 * value anywhere in this column (confirmed by reading the migration file
 * directly, not guessed). Critically, `profiles.id` is a DIFFERENT id space
 * than `students.id`: `public.students` (`20260716000000_identity_roster.sql`
 * line 61) has its own `id` primary key plus a separate `profile_id uuid
 * references public.profiles (id)` column -- so "the student's own profile
 * id" is not the same value as `rsvps.student_id`, it is that student row's
 * OWN `profile_id`. This component therefore takes `studentId` (the
 * `rsvps.student_id` this RSVP is for -- always the signed-in student's own
 * row here, since this is specifically the student's own control, never
 * another student's, per the packet's OUT-03/T043 split) and
 * `currentUserProfileId` (a real `profiles.id`, attributed to
 * `responded_by`) as TWO SEPARATE props, never conflated into one id, and
 * never a hardcoded `'student'` literal anywhere in this file (grep-provable).
 *
 * No shared Supabase client/auth context is wired into this batch yet (same
 * disclosed gap every sibling content page in this batch has hit -- e.g.
 * `OutreachList.tsx`'s `PLACEHOLDER_CURRENT_STUDENT_ID`,
 * `OutreachEventDialog.tsx`'s injectable `onSaveEvent`). This component's own
 * stand-in for that gap is `currentUserProfileId`, an OPTIONAL prop
 * defaulting to `PLACEHOLDER_CURRENT_USER_PROFILE_ID` (a disclosed,
 * obviously-fake placeholder profile id, module-level constant below) --
 * the same "injectable seam with an obviously-fake default" pattern this
 * task's own Forbidden Files section mandates for the persistence seam,
 * applied identically to the auth seam per Known Context/Traps #3's explicit
 * instruction. A future task that wires a real Supabase-backed auth context
 * passes the real signed-in student's own `profiles.id` here instead.
 *
 * -----------------------------------------------------------------------
 * 4. "Editable until session start" -- a real, testable time boundary (Known
 *    Context/Traps #1), not just documentation.
 *
 * `isSessionTimeEditable` below is the ONE pure function that answers "is
 * `now` still before `starts_at`" -- proven directly in the test file with a
 * session starting in 1 minute (editable) and one that started 1 minute ago
 * (locked), per the packet's own literal instruction. `isRsvpEditable`
 * additionally requires `session.status === 'scheduled'` (a `'canceled'`/
 * `'completed'` session is never RSVP-editable regardless of `starts_at`,
 * which the bare time check alone would not catch) -- this is a disclosed
 * ADDITION beyond the packet's literal time-boundary wording, not a
 * substitute for it; `isSessionTimeEditable` remains independently exported
 * and independently tested for the literal boundary proof.
 *
 * The lock is enforced at TWO levels, both real, neither cosmetic:
 *   (a) `SegmentedControl`'s own `isDisabled` prop (astryx-api.md line 5575
 *       section Props table) is a real, installed-source-verified guard --
 *       `SegmentedControlItem`'s `handleClick`
 *       (`node_modules/@astryxdesign/core/src/SegmentedControl/
 *       SegmentedControlItem.tsx`) checks `!isItemDisabled` BEFORE ever
 *       calling `ctx.onChange`, so a locked control's segments are
 *       genuinely inert (not merely styled) -- clicking one does not fire
 *       `onRsvpChange` at all, proven in the test file by dispatching a real
 *       click on a locked control's button and asserting the callback was
 *       never called.
 *   (b) A live re-lock while the component stays mounted across the exact
 *       boundary: `useSessionRsvpLock` below schedules a single
 *       `window.setTimeout` for the remaining `starts_at - now` milliseconds
 *       (only when currently editable) that flips `isEditable` to `false`
 *       the moment the session starts, with no remount/re-render trigger
 *       required from the caller -- also proven in the test file with fake
 *       timers.
 *
 * `disabledMessage` (SegmentedControl's own doc-cited prop, module doc #6)
 * supplies a hover/keyboard-focus tooltip reason per the Astryx doc's own
 * "Don't wrap a disabled SegmentedControl in Tooltip" guidance -- but since a
 * hover-only tooltip alone would not satisfy "clear locked messaging" for a
 * sighted, non-hovering user, this component ALSO renders a persistent,
 * always-visible `Text` line stating the same lock reason plus the
 * currently-recorded response (or "No response recorded" -- module doc #7)
 * whenever locked, not gated behind hover.
 *
 * -----------------------------------------------------------------------
 * 5. BEH-09 helper text -- a literal, specific copy pattern (Known Context/
 *    Traps #2), not a paraphrase.
 *
 * While editable, this component renders the literal sentence "You can
 * change this until the event starts." (verbatim, per the packet's own
 * instruction) as its own standalone `Text`, followed by a SEPARATE,
 * session-specific interpolated line ("Session starts {formatted date/time}.")
 * -- a disclosed CHOICE to interpolate as an additional line rather than
 * splicing the date into the literal sentence itself, so the verbatim BEH-09
 * sentence stays grep-provably exact and untouched by string interpolation.
 *
 * BEH-09's own "confirmation states the next system event" half (packet's
 * own wording, e.g. "we'll remind you 2 days before") fires once per
 * successful save, in a dismissable `Banner status="success"`
 * (`buildRsvpConfirmationCopy` below is the ONE place this text is
 * produced). This project's reminder system (T051) does not exist yet
 * (confirmed by grep: zero hits for `T051`/`reminder` as an implemented
 * feature anywhere under `src/`) -- the confirmation copy is therefore a
 * disclosed, STATIC, honest description of the intended future behavior
 * ("once VOLT's reminder system is live") that explicitly says no reminder
 * is actually scheduled yet, never a claim that a real reminder job was
 * just created (nothing in this file schedules, persists, or calls any
 * reminder-related API -- grep-provable).
 *
 * -----------------------------------------------------------------------
 * 6. No shared Supabase client wired in (Forbidden Files: `src/lib/supabase/**`
 *    read-only reference only) -- deliberate scope, not a gap for this task
 *    to solve.
 *
 * The real `rsvps` upsert is an injectable `onRsvpChange: (params) =>
 * Promise<void>` prop, defaulting to `defaultOnRsvpChange`, an
 * obviously-fake stub that only `console.warn`s the params it would have
 * persisted -- same posture as every prior content page's injectable
 * persistence seam (`OutreachList.tsx`'s `loadData`,
 * `OutreachEventDialog.tsx`'s `onSaveEvent`).
 *
 * -----------------------------------------------------------------------
 * 7. Optimistic local selection + rollback on failure.
 *
 * Selecting a segment updates this component's own `displayedStatus` state
 * immediately (so the control feels instant, matching `OutreachList.tsx`'s
 * own row-preview UX), then calls `onRsvpChange`. On rejection, the
 * selection is rolled back to whatever it was before the attempted change
 * and a `Banner status="error"` explains the failure -- never silently left
 * showing a value that was not actually persisted. `displayedStatus`
 * resyncs from the `currentRsvp` prop whenever it changes (e.g. a future
 * caller re-fetching from Supabase after a successful write elsewhere), the
 * same `useEffect`-resync pattern `OutreachList.tsx`'s
 * `StudentParentOutreachView` already established for its own `initialRsvps`
 * prop.
 *
 * -----------------------------------------------------------------------
 * 8. Astryx prop sourcing (constitution item 2) -- every prop used below,
 *    cross-checked directly against `docs/swarm/astryx-api.md` (grepped live
 *    for this task):
 *
 *  - `SegmentedControl` (line 5575 section, Props table): `value` (required),
 *    `onChange` (required), `label` (required), `isDisabled`,
 *    `disabledMessage` used.
 *  - `SegmentedControlItem`: doc's own "Components > SegmentedControlItem"
 *    subsection (line 5615-5617) is `undefined` (same disclosed CLI-cross-
 *    checked gap `OutreachList.tsx`/`OutreachEventDialog.tsx` already hit);
 *    `npm run astryx -- component SegmentedControlItem` resolves `value`
 *    (required) + `label` (required) -- only those two used (no per-item
 *    `isDisabled`; this file only ever disables the whole group).
 *  - `Text` (line 829 section, Props table): `type` (`'supporting'`),
 *    `color` used.
 *  - `Banner` (line 2694 section, Props table): `status` (required),
 *    `title` (required), `description`, `isDismissable`, `onDismiss` used.
 *  - `VStack` ("Stack" section, `VStack` subsection): `gap` used.
 */
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Banner, SegmentedControl, SegmentedControlItem, Text, VStack } from '@astryxdesign/core';

// ---------------------------------------------------------------------------
// Types -- verbatim camelCase renames of real column subsets, matching
// `OutreachList.tsx`'s own field names/casing (module doc #1).
// ---------------------------------------------------------------------------

export type RsvpStatus = 'going' | 'maybe' | 'declined';
export type SessionStatus = 'scheduled' | 'completed' | 'canceled';

export interface RsvpRow {
  id: string;
  sessionId: string;
  studentId: string;
  status: RsvpStatus;
  respondedBy: string | null;
  updatedAt: string;
  createdAt: string;
}

export interface RsvpControlSession {
  id: string;
  eventId: string;
  sessionDate: string;
  startsAt: string;
  endsAt: string;
  status: SessionStatus;
  peopleReached: number | null;
}

export interface RsvpChangeParams {
  sessionId: string;
  studentId: string;
  status: RsvpStatus;
  /** Module doc #3 -- a real `profiles.id`, never a literal role string. */
  respondedBy: string;
}

export type OnRsvpChangeFn = (params: RsvpChangeParams) => Promise<void>;

// ---------------------------------------------------------------------------
// Placeholder identifiers -- module doc #3.
// ---------------------------------------------------------------------------

/**
 * Disclosed, obviously-fake stand-in for "the signed-in student's own
 * `profiles.id`" until a real Supabase-backed auth context is wired into
 * this batch. Deliberately a DIFFERENT literal shape/prefix than
 * `OutreachList.tsx`'s `PLACEHOLDER_CURRENT_STUDENT_ID` (`students.id`
 * space) -- `profiles.id` and `students.id` are different id spaces (module
 * doc #3), so this placeholder is never accidentally interchangeable with
 * that one.
 */
export const PLACEHOLDER_CURRENT_USER_PROFILE_ID = 'profile-placeholder-current-viewer';

/** Not a real RSVP status -- never matches an actual `SegmentedControlItem`
 * value, so passing it as `value` leaves the control visually unselected,
 * the correct representation of "no `rsvps` row exists yet". Same sentinel
 * pattern `OutreachList.tsx` already established. */
const UNANSWERED_RSVP_SEGMENT_VALUE = 'unanswered';

// ---------------------------------------------------------------------------
// The label-vs-stored-value mapping -- module doc #2, the ONE place these
// pairs are defined. OUT-03's own literal labels (PRD line 294), NOT
// `OutreachList.tsx`'s row-preview "Going" simplification.
// ---------------------------------------------------------------------------

export const RSVP_ITEMS: readonly { value: RsvpStatus; label: string }[] = [
  { value: 'going', label: 'Sign up' },
  { value: 'maybe', label: 'Maybe' },
  // Label-vs-stored-value mismatch (module doc #2): the visible label is
  // "Can't go" but the real `rsvps.status` check constraint only accepts
  // the enum value 'declined' -- there is no "can't go" value in the schema.
  { value: 'declined', label: "Can't go" },
];

export function rsvpStatusLabel(status: RsvpStatus): string {
  return RSVP_ITEMS.find((item) => item.value === status)?.label ?? status;
}

// ---------------------------------------------------------------------------
// Pure functions -- exported for direct testing. Module doc #4.
// ---------------------------------------------------------------------------

/** The literal "editable until session start" time boundary (Known Context/
 * Traps #1): `true` while `now` is strictly before `session.starts_at`. */
export function isSessionTimeEditable(startsAt: string, now: Date): boolean {
  return now.getTime() < new Date(startsAt).getTime();
}

/** Module doc #4 -- disclosed addition beyond the bare time check: a
 * `'canceled'`/`'completed'` session is never RSVP-editable either, even if
 * `now` still happens to be before its (possibly stale) `starts_at`. */
export function isRsvpEditable(session: RsvpControlSession, now: Date): boolean {
  return session.status === 'scheduled' && isSessionTimeEditable(session.startsAt, now);
}

/** BEH-09 (module doc #5) -- the ONE place the post-save confirmation copy
 * is produced. Static and honest: describes the INTENDED future reminder
 * behavior without claiming a real reminder is actually scheduled (T051,
 * this project's reminder system, is not built yet). */
export function buildRsvpConfirmationCopy(status: RsvpStatus): {
  title: string;
  description: string;
} {
  return {
    title: `RSVP saved: ${rsvpStatusLabel(status)}`,
    description:
      "We'll remind you 2 days before this event once VOLT's reminder system is live " +
      "(that system hasn't been built yet, so no reminder is actually scheduled right now).",
  };
}

// ---------------------------------------------------------------------------
// NFR-09 date/time formatting -- timestamps stored UTC, displayed
// America/Chicago. Independently reimplemented here (not imported) --
// `OutreachList.tsx`/`OutreachEventDialog.tsx` are not in this task's
// Allowed Files (module doc #1).
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

export function formatSessionDateOnly(session: RsvpControlSession): string {
  return WEEKDAY_DATE_FORMATTER.format(parseDateOnly(session.sessionDate));
}

export function formatSessionStartTime(session: RsvpControlSession): string {
  return CLOCK_TIME_FORMATTER.format(new Date(session.startsAt));
}

// ---------------------------------------------------------------------------
// Default injectable seams -- module docs #3/#6.
// ---------------------------------------------------------------------------

export const defaultOnRsvpChange: OnRsvpChangeFn = async (params) => {
  console.warn(
    '[RsvpControl] No Supabase client wired in yet (module doc #6) -- this stub only logs the ' +
      'rsvps upsert that would have been persisted.',
    params,
  );
};

function defaultNow(): Date {
  return new Date();
}

// ---------------------------------------------------------------------------
// Live session-start lock boundary -- module doc #4b.
// ---------------------------------------------------------------------------

function useSessionRsvpLock(session: RsvpControlSession, getNow: () => Date): boolean {
  const computeIsEditable = useCallback(() => isRsvpEditable(session, getNow()), [session, getNow]);
  const [isEditable, setIsEditable] = useState(computeIsEditable);

  useEffect(() => {
    setIsEditable(computeIsEditable());
    if (!computeIsEditable()) return;
    const msUntilLock = new Date(session.startsAt).getTime() - getNow().getTime();
    // `window.setTimeout`'s delay is a signed 32-bit int (max 2147483647ms,
    // ~24.85 days) -- per spec, any larger delay is silently CLAMPED to 1ms
    // rather than throwing/warning, which would fire this timeout almost
    // immediately and incorrectly lock a session that's actually weeks away.
    // A natural re-render/remount recomputes `isEditable` correctly long
    // before such a distant boundary is ever actually reached, so no timer
    // is scheduled at all beyond this bound (no fallback re-scheduling
    // needed).
    if (msUntilLock <= 0 || msUntilLock > 2147483647) return;
    const timeoutId = window.setTimeout(() => setIsEditable(false), msUntilLock);
    return () => window.clearTimeout(timeoutId);
  }, [computeIsEditable, session.startsAt, getNow]);

  return isEditable;
}

// ---------------------------------------------------------------------------
// Component.
// ---------------------------------------------------------------------------

export interface RsvpControlProps {
  /** `rsvps.student_id` -- always the signed-in student's OWN row here
   * (module doc #3); this is the student's own control, not another
   * student's, and not the parent-facing multi-student version (T043). */
  studentId: string;
  session: RsvpControlSession;
  /** Display context only, e.g. `events.title` -- used in the control's
   * accessible label and lock messaging. */
  eventTitle: string;
  /** The current `rsvps` row for `(session.id, studentId)`, or `null` when
   * none exists yet (the "unanswered" case). */
  currentRsvp: RsvpRow | null;
  /** Injectable auth/session seam (module doc #3). Defaults to a disclosed
   * placeholder `profiles.id`. */
  currentUserProfileId?: string;
  /** Injectable persistence seam (module doc #6). Defaults to a stub that
   * only logs. */
  onRsvpChange?: OnRsvpChangeFn;
  /** Injectable clock seam so the session-start lock boundary is
   * deterministically testable (module doc #4). Defaults to the real
   * system clock. */
  now?: () => Date;
}

export function RsvpControl({
  studentId,
  session,
  eventTitle,
  currentRsvp,
  currentUserProfileId = PLACEHOLDER_CURRENT_USER_PROFILE_ID,
  onRsvpChange = defaultOnRsvpChange,
  now = defaultNow,
}: RsvpControlProps): ReactNode {
  const isEditable = useSessionRsvpLock(session, now);

  const [displayedStatus, setDisplayedStatus] = useState<RsvpStatus | null>(
    currentRsvp?.status ?? null,
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<{ title: string; description: string } | null>(
    null,
  );

  // Module doc #7 -- resync whenever the caller's own `currentRsvp` changes
  // (e.g. a future re-fetch after a successful write elsewhere).
  useEffect(() => {
    setDisplayedStatus(currentRsvp?.status ?? null);
  }, [currentRsvp?.status, session.id, studentId]);

  async function handleChange(value: string): Promise<void> {
    if (!isEditable || isSubmitting) return;
    const nextStatus = value as RsvpStatus;
    const previousStatus = displayedStatus;
    setDisplayedStatus(nextStatus); // optimistic (module doc #7)
    setSubmitError(null);
    setConfirmation(null);
    setIsSubmitting(true);
    try {
      await onRsvpChange({
        sessionId: session.id,
        studentId,
        status: nextStatus,
        respondedBy: currentUserProfileId,
      });
      setConfirmation(buildRsvpConfirmationCopy(nextStatus));
    } catch (error) {
      setDisplayedStatus(previousStatus); // rollback (module doc #7)
      setSubmitError(
        error instanceof Error ? error.message : 'Something went wrong saving your RSVP.',
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  const controlLabel = `Your RSVP for ${eventTitle} on ${formatSessionDateOnly(session)}`;

  return (
    <VStack gap={2}>
      <SegmentedControl
        value={displayedStatus ?? UNANSWERED_RSVP_SEGMENT_VALUE}
        onChange={(value) => {
          void handleChange(value);
        }}
        label={controlLabel}
        isDisabled={!isEditable || isSubmitting}
        disabledMessage={
          isEditable ? undefined : 'This session has already started, so RSVP changes are locked.'
        }
      >
        {RSVP_ITEMS.map((item) => (
          <SegmentedControlItem key={item.value} value={item.value} label={item.label} />
        ))}
      </SegmentedControl>

      {isEditable ? (
        <>
          {/* BEH-09 (module doc #5) -- literal, verbatim helper text. */}
          <Text type="supporting">You can change this until the event starts.</Text>
          <Text type="supporting" color="secondary">
            Session starts {formatSessionDateOnly(session)} · {formatSessionStartTime(session)}.
          </Text>
        </>
      ) : (
        <Text type="supporting" color="secondary">
          RSVP locked — this session already started. Your recorded response:{' '}
          {displayedStatus === null ? 'no response recorded' : rsvpStatusLabel(displayedStatus)}.
        </Text>
      )}

      {confirmation !== null && (
        <Banner
          status="success"
          title={confirmation.title}
          description={confirmation.description}
          isDismissable
          onDismiss={() => setConfirmation(null)}
        />
      )}

      {submitError !== null && (
        <Banner status="error" title="Couldn't save your RSVP" description={submitError} />
      )}
    </VStack>
  );
}

export default RsvpControl;
