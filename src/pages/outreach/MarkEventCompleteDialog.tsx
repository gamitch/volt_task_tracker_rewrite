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
 *    `computeInitialAttendedStudentIds` (the checklist-seeding derivation)
 *    and `buildAttendanceWriteRows` (the attendance-row constructor) --
 *    imported directly from that file, never reimplemented. There is no
 *    second, parallel field list anywhere in this file: every field on the
 *    `MarkDayCompletePayload` this file builds is produced by that same
 *    dialog's own already-tested functions, or is a plain pass-through
 *    (`sessionId`, `recordedBy`) of a value this file already has. Zero
 *    metric math happens here (constitution item 3) -- this file never sums
 *    hours, never touches `v_student_hours`, and the "per-day summary"
 *    required below is a plain count of done/failed/skipped outcomes, not a
 *    computed metric.
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
 *        named. `buildMarkEventCompletePayload` therefore always uses the
 *        SAME derivation the per-day dialog seeds its own checklist from
 *        (`computeInitialAttendedStudentIds` -- roster students with a
 *        `going` RSVP for that session), with no manual per-session
 *        adjustment surface in bulk mode. This does not invent attendance
 *        (Trap #3): it writes exactly the RSVP-derived default the per-day
 *        flow itself would show pre-checked before a coach makes any manual
 *        edit.
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
  computeInitialAttendedStudentIds,
  formatSessionDateTime,
  PLACEHOLDER_CURRENT_COACH_PROFILE_ID,
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

/** Module doc #1/#2 -- THE ONE place a bulk-mode per-session
 * `MarkDayCompletePayload` is built. Reuses `computeInitialAttendedStudentIds`
 * + `buildAttendanceWriteRows` (`MarkDayCompleteDialog.tsx`'s own pure
 * functions, unchanged) for the attendance rows; `hoursOverrideByStudentId`
 * is always `{}` (module doc #2(a) -- no bulk-mode per-student override
 * surface, so every row's `hoursOverride` is genuinely `null`, falling back
 * to the same MET-03 tier-3 session-duration default an untouched per-day
 * row already falls back to); adult-volunteer deltas are always `0`/`0`
 * (module doc #2(b)). */
export function buildMarkEventCompletePayload(
  session: MarkDayCompleteSession,
  peopleReached: number | null,
  roster: readonly RosterStudent[],
  rsvps: readonly RsvpRow[],
  recordedBy: string,
): MarkDayCompletePayload {
  const checkedStudentIds = computeInitialAttendedStudentIds(session.id, roster, rsvps);
  return {
    sessionId: session.id,
    peopleReached,
    attendance: buildAttendanceWriteRows(session.id, checkedStudentIds, {}, recordedBy),
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
  /** Injectable auth seam -- same disclosed placeholder
   * `MarkDayCompleteDialog.tsx` already established. */
  currentUserProfileId?: string;
  /** Injectable persistence seam, called once per remaining session (module
   * doc #1/#3). Defaults to the real `markDayComplete` mutation -- the SAME
   * shared code path `MarkDayCompleteDialog.tsx`'s own `onMarkComplete`
   * default already drives. */
  onMarkSessionComplete?: OnMarkDayCompleteFn;
  /** Module doc #3 -- called once after the whole sequential batch has been
   * attempted (success or partial failure), so the caller can refetch its
   * own data. */
  onFinished?: () => void;
}

export function MarkEventCompleteDialog({
  isOpen,
  onOpenChange,
  eventTitle = DEFAULT_EVENT_TITLE,
  sessions,
  roster,
  rsvps,
  currentUserProfileId = PLACEHOLDER_CURRENT_COACH_PROFILE_ID,
  onMarkSessionComplete = markDayComplete,
  onFinished,
}: MarkEventCompleteDialogProps): ReactNode {
  const { remaining, skipped } = partitionEventSessions(sessions);

  const [peopleReachedBySessionId, setPeopleReachedBySessionId] = useState<
    Record<string, number | null>
  >({});
  const [outcomeBySessionId, setOutcomeBySessionId] = useState<Record<string, SessionOutcome>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasSubmitted, setHasSubmitted] = useState(false);

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
                    isDisabled={isSubmitting}
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
