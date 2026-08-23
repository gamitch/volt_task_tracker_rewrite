/**
 * T605: edit ONE meeting session inside a series -- date, start/end time,
 * notes -- plus a "Cancel this meeting" action that reuses the existing
 * per-session Cancel mechanism (T096/T122) rather than inventing a second
 * one. See `docs/swarm/active/T605-worker-packet.md` for the full authority
 * chain; this comment only records the load-bearing design decisions.
 *
 * -----------------------------------------------------------------------
 * 1. Layout precedent -- `src/pages/roster/StudentDialog.tsx`, NOT
 *    `ScheduleMeetingsDialog.tsx`'s fullscreen `EventFormLayout` (packet
 *    §6.4). `ScheduleMeetingsDialog.tsx` carries a series-wide schedule-mode
 *    model (`SegmentedControl` of Single/Weekly/Custom, `DateRangeInput`,
 *    weekday `CheckboxList`, per-mode generators) a single fixed-identity
 *    session edit has no use for -- a second, smaller, single-purpose
 *    component is the correct shape here, matching this codebase's existing
 *    "one dialog per distinct editing shape" pattern. Plain
 *    `Dialog purpose="form"` (no `variant="fullscreen"`),
 *    `Layout`+`LayoutContent`+`FormLayout`, same as `StudentDialog.tsx`.
 *
 * -----------------------------------------------------------------------
 * 2. Reuse, not reinvention -- `isMeetingSessionReconcilable`
 *    (`./ScheduleMeetingsDialog`, exported at that file's own `:668`) is
 *    IMPORTED here (packet §6.2), not reimplemented: the future-forward rule
 *    itself must be shared between the series dialog and this surface so
 *    they can never silently disagree about "already happened." GAM-452
 *    made `CoachMeetingsView.tsx` the real caller that applies this gate
 *    (via `SchedulePanel`'s `canEditSession` prop) to decide whether the
 *    Edit affordance renders at all; this file does not need to call it
 *    again.
 *
 * -----------------------------------------------------------------------
 * 3. Wall-time <-> UTC conversion -- reimplemented locally, a deliberate,
 *    disclosed choice, NOT because of an inapplicable convention (packet
 *    §6.3, MINOR-3 correction). `chicagoWallTimeToUtcIso` IS exported from
 *    `./ScheduleMeetingsDialog` (`:466`) and could be imported -- that would
 *    not be wrong. This file keeps a local copy instead for PAIR-COHESION
 *    with its own reverse direction, `formatChicagoWallTime`
 *    (`ScheduleMeetingsDialog.tsx:694`), which is NOT exported (needed here
 *    to derive this dialog's initial `TimeInput` values from
 *    `session.startsAt`/`endsAt`) and so must be local regardless -- keeping
 *    the conversion pair together in one file, both written the same way, is
 *    the defensible choice. Behavioral parity with
 *    `ScheduleMeetingsDialog.test.tsx`'s own `describe('chicagoWallTimeToUtcIso', ...)`
 *    cases is proven directly in this file's own test file (packet §7 test
 *    10).
 *
 * -----------------------------------------------------------------------
 * 4. Future-forward enforcement -- the ONLY point that catches a coach's own
 *    bad new value (packet §6.3's corrected enforcement-split note, fixing
 *    B1's framing error). `computeMeetingSessionEditPayload` below validates
 *    the CANDIDATE `startsAt`/`endsAt` -- the values about to be WRITTEN --
 *    strictly future and strictly ordered, mirroring
 *    `ScheduleMeetingsDialog.tsx:619-621`'s own `desiredFuture` filter. The
 *    database-level guard in `loaders/meetings.ts` (`makeSaveMeetingSession`)
 *    reads the row's PRE-UPDATE state and cannot see the value being written
 *    in the same statement's `SET` -- it defends against a DIFFERENT hazard
 *    (the session changing state between dialog-open and save), not this
 *    one. Do not weaken this function on the assumption the database will
 *    catch a bad candidate value; it cannot.
 *
 * -----------------------------------------------------------------------
 * 5. Duplicate-date guard -- required, not optional hardening (packet §3.5).
 *    `ScheduleMeetingsDialog.tsx:598-612`'s own module doc names this exact
 *    task and this exact hazard: per-session date edits are where a genuine
 *    same-`session_date` duplicate could first appear in this codebase.
 *    `sessionDateCollidesWithSibling` below closes it at the app level;
 *    Known Risk 2 (this task's own worker output) discloses that no unique
 *    DB constraint backs it up.
 *
 * -----------------------------------------------------------------------
 * 6. Cancel reuse -- this dialog's own "Cancel this meeting" button never
 *    calls a cancel mutation itself. It calls `onRequestCancelSession()`
 *    only; `MeetingsList.tsx`'s own `CoachMeetingsView` wires that callback
 *    to the SAME `cancelTarget` state / `AlertDialog` its existing per-row
 *    Cancel button already drives (packet §3.4) -- no second confirmation,
 *    no second copy of that text, no second call to `onCancelSession`.
 */
import { useEffect, useState, type ReactNode } from 'react';
import {
  Banner,
  Button,
  DateInput,
  Dialog,
  DialogHeader,
  FormLayout,
  HStack,
  Layout,
  LayoutContent,
  LayoutFooter,
  Text,
  TextArea,
  TimeInput,
  createISOTimeString,
  type ISODateString,
  type ISOTimeString,
} from '@astryxdesign/core';
import { isSupabaseLoaderError } from '../../lib/supabase';

// ---------------------------------------------------------------------------
// Types -- this file OWNS `SaveMeetingSessionPayload`/`OnSaveMeetingSessionFn`
// (packet §6.4, fixes m4), mirroring exactly how `ScheduleMeetingsDialog.tsx`
// owns `SaveMeetingSeriesPayload`/`OnSaveMeetingSeriesFn`. `loaders/meetings.ts`
// only ever imports these via `import type`.
// ---------------------------------------------------------------------------

export interface SaveMeetingSessionPayload {
  sessionId: string;
  sessionDate: string; // 'YYYY-MM-DD'
  startsAt: string; // ISO timestamptz
  endsAt: string; // ISO timestamptz
  notes: string; // always a real string -- event_sessions.notes is `not null`, no default
}

export type OnSaveMeetingSessionFn = (payload: SaveMeetingSessionPayload) => Promise<void>;

export const defaultOnSaveMeetingSession: OnSaveMeetingSessionFn = async (payload) => {
  console.warn('[EditMeetingSessionDialog] No Supabase client wired in -- stub only.', payload);
};

export interface EditMeetingSessionInitialData {
  eventId: string;
  eventTitle: string; // read-only context, not editable here
  session: {
    sessionId: string;
    sessionDate: string;
    startsAt: string;
    endsAt: string;
    notes?: string;
  };
  /** Every OTHER session's own `sessionDate` on this same event, any status
   * (packet §6.5's `sessionDateCollidesWithSibling`). */
  otherSessionDates: readonly string[];
}

export interface EditMeetingSessionDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  initialData: EditMeetingSessionInitialData | null;
  onSaveMeetingSession?: OnSaveMeetingSessionFn;
  onRequestCancelSession: () => void;
}

// ---------------------------------------------------------------------------
// Wall-time <-> UTC conversion -- reimplemented locally, module doc #3.
// ---------------------------------------------------------------------------

const CHICAGO_TIME_ZONE = 'America/Chicago';

function getTimeZoneOffsetMinutes(timeZone: string, date: Date): number {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  const parts = formatter.formatToParts(date);
  const map: Record<string, string> = {};
  for (const part of parts) {
    if (part.type !== 'literal') map[part.type] = part.value;
  }
  const asUtc = Date.UTC(
    Number(map.year),
    Number(map.month) - 1,
    Number(map.day),
    Number(map.hour),
    Number(map.minute),
    Number(map.second),
  );
  return (asUtc - date.getTime()) / 60000;
}

/** Converts a `('YYYY-MM-DD', 'HH:MM')` America/Chicago wall-clock pair into
 * the correct UTC ISO timestamp, DST-aware. Local reimplementation, module
 * doc #3 -- exported for this file's own test file (packet §7 test 10). */
export function chicagoWallTimeToUtcIso(dateStr: string, timeStr: string): string {
  const naiveUtc = new Date(`${dateStr}T${timeStr}:00.000Z`);
  const offsetMinutes = getTimeZoneOffsetMinutes(CHICAGO_TIME_ZONE, naiveUtc);
  return new Date(naiveUtc.getTime() - offsetMinutes * 60000).toISOString();
}

const CHICAGO_24H_TIME_FORMATTER = new Intl.DateTimeFormat('en-US', {
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
  timeZone: CHICAGO_TIME_ZONE,
});

/** Reverse direction of `chicagoWallTimeToUtcIso`, needed only to derive this
 * dialog's initial `TimeInput` values from `session.startsAt`/`endsAt` --
 * module doc #3 explains why this stays local (and unexported) rather than
 * importing `ScheduleMeetingsDialog.tsx`'s own non-exported twin. */
function formatChicagoWallTime(isoDateTime: string): string {
  const parts = CHICAGO_24H_TIME_FORMATTER.formatToParts(new Date(isoDateTime));
  const hour = parts.find((part) => part.type === 'hour')?.value ?? '00';
  const minute = parts.find((part) => part.type === 'minute')?.value ?? '00';
  return `${hour}:${minute}`;
}

const WEEKDAY_DATE_FORMATTER = new Intl.DateTimeFormat('en-US', {
  weekday: 'short',
  month: 'short',
  day: 'numeric',
  timeZone: CHICAGO_TIME_ZONE,
});

/** Read-only context heading -- "which one" of a recurring series' own
 * sessions this dialog is editing. Local reimplementation of the same
 * weekday-date shape `MeetingsList.tsx`/`ScheduleMeetingsDialog.tsx` each
 * already reimplement independently for their own files (this codebase's
 * established cross-file convention for small date-format helpers). */
function formatSessionDateHeading(sessionDate: string): string {
  // Noon UTC avoids a local-timezone day-shift when parsing a bare
  // 'YYYY-MM-DD' string -- same trick `ScheduleMeetingsDialog.tsx`'s own
  // `parseDateOnly` uses.
  const [year, month, day] = sessionDate.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day, 12));
  return WEEKDAY_DATE_FORMATTER.format(date);
}

// ---------------------------------------------------------------------------
// Pure, separately testable validate/build functions (packet §6.5) -- no
// React and no fake `SupabaseClient` needed, same shape
// `resolveAttendanceWriteMethod` (`loaders/attendance.ts:287-291`) and
// `computeMeetingSeriesReconcilePlan` already established.
// ---------------------------------------------------------------------------

/** Mirrors `buildEventSessionsPayload`'s "incomplete inputs -> no payload"
 * shape, singular, PLUS two required validations that function does not need
 * (a single session has no per-mode date generator to gate this at, unlike
 * the series dialog):
 *  - B1 fix: the CANDIDATE `startsAt` must be strictly future, mirroring
 *    `ScheduleMeetingsDialog.tsx:619-621`'s own `desiredFuture` filter -- this
 *    is the ONLY enforcement point for a coach's own bad new value (see
 *    `loaders/meetings.ts`'s corrected enforcement-split note, packet §6.3).
 *    The DB guard reads the OLD row and cannot see this.
 *  - m6 fix: `endsAt` must be strictly after `startsAt` -- nothing else in
 *    this codebase validates this for `event_sessions`
 *    (`buildEventSessionsPayload`/the create path do not either), and a
 *    negative interval would surface as negative hours in
 *    `v_planned_rsvp_hours`.
 *
 * Disclosure, not a defect to fix (packet MINOR-5): because `endsAt` is
 * derived from the SAME `date` as `startsAt`, a session genuinely crossing
 * local midnight (e.g. 11 PM start, 1 AM end) can never satisfy
 * `endsAt > startsAt` here, and Save stays permanently disabled behind a
 * message that reads like a mistake rather than an unsupported case. This is
 * not a regression this task introduces -- `buildEventSessionsPayload`
 * (`ScheduleMeetingsDialog.tsx:475-488`) has the identical same-date-for-both
 * shape in the create path today, silently producing the same inverted
 * interval with no validation at all. This task's new inline error is simply
 * the first place in the app that surfaces the limitation instead of storing
 * a nonsensical row unnoticed. Not fixed here -- a pre-existing, wider
 * limitation than T605's own scope. */
export function computeMeetingSessionEditPayload(
  sessionId: string,
  date: string | undefined,
  startTime: string | undefined,
  endTime: string | undefined,
  notes: string,
  now: Date,
): SaveMeetingSessionPayload | null {
  if (date === undefined || startTime === undefined || endTime === undefined) return null;
  const startsAt = chicagoWallTimeToUtcIso(date, startTime); // local reimplementation, module doc #3
  const endsAt = chicagoWallTimeToUtcIso(date, endTime);
  if (new Date(startsAt).getTime() <= now.getTime()) return null;
  if (new Date(endsAt).getTime() <= new Date(startsAt).getTime()) return null;
  return { sessionId, sessionDate: date, startsAt, endsAt, notes };
}

/** T605's own required guard -- see module doc #5. `otherDates` is every
 * OTHER session's own `sessionDate` on this same event, any status (mirrors
 * `computeMeetingSeriesReconcilePlan`'s `allExistingDates` -- ANY status, not
 * just scheduled). */
export function sessionDateCollidesWithSibling(
  candidateDate: string,
  otherDates: readonly string[],
): boolean {
  return otherDates.includes(candidateDate);
}

// ---------------------------------------------------------------------------
// Field-level error messages (UI-only) -- which of the two validations above
// failed, so the coach sees WHY Save is disabled, not just that it is
// (packet §6.5: "Surface which validation failed as an inline message near
// the relevant field(s)"). This does not duplicate the enforcement decision
// itself -- `isValid` below is derived solely from
// `computeMeetingSessionEditPayload`/`sessionDateCollidesWithSibling`, the
// same two functions this helper re-checks only to decide which field's
// message to show.
// ---------------------------------------------------------------------------

interface EditSessionFieldErrors {
  date?: string;
  startTime?: string;
  endTime?: string;
}

function computeFieldErrors(
  date: string | undefined,
  startTime: string | undefined,
  endTime: string | undefined,
  otherSessionDates: readonly string[],
  now: Date,
): EditSessionFieldErrors {
  const errors: EditSessionFieldErrors = {};
  if (date !== undefined && sessionDateCollidesWithSibling(date, otherSessionDates)) {
    errors.date = 'Another session in this series is already scheduled on this date.';
  }
  if (date !== undefined && startTime !== undefined) {
    const startsAt = chicagoWallTimeToUtcIso(date, startTime);
    if (new Date(startsAt).getTime() <= now.getTime()) {
      errors.startTime = 'This start time has already passed. Choose a time in the future.';
    }
    if (endTime !== undefined) {
      const endsAt = chicagoWallTimeToUtcIso(date, endTime);
      if (new Date(endsAt).getTime() <= new Date(startsAt).getTime()) {
        errors.endTime = 'End time must be after the start time.';
      }
    }
  }
  return errors;
}

// ---------------------------------------------------------------------------
// Form state.
// ---------------------------------------------------------------------------

interface EditSessionFormState {
  date: ISODateString | undefined;
  startTime: ISOTimeString | undefined;
  endTime: ISOTimeString | undefined;
  notes: string;
}

function buildInitialFormState(
  initialData: EditMeetingSessionInitialData | null,
): EditSessionFormState {
  if (initialData === null) {
    return { date: undefined, startTime: undefined, endTime: undefined, notes: '' };
  }
  const { session } = initialData;
  return {
    // `session.sessionDate` is always a real 'YYYY-MM-DD' string read from
    // `event_sessions.session_date` (never user-typed here) -- not statically
    // known to match `ISODateString`'s template-literal pattern, same
    // disclosed cast `ScheduleMeetingsDialog.tsx`'s own
    // `RECURRING_RANGE_PRESETS` uses for an equally well-formed computed
    // string.
    date: session.sessionDate as ISODateString,
    startTime: createISOTimeString(formatChicagoWallTime(session.startsAt)) ?? undefined,
    endTime: createISOTimeString(formatChicagoWallTime(session.endsAt)) ?? undefined,
    notes: session.notes ?? '',
  };
}

// ---------------------------------------------------------------------------
// Component.
// ---------------------------------------------------------------------------

export function EditMeetingSessionDialog({
  isOpen,
  onOpenChange,
  initialData,
  onSaveMeetingSession = defaultOnSaveMeetingSession,
  onRequestCancelSession,
}: EditMeetingSessionDialogProps): ReactNode {
  const [formState, setFormState] = useState<EditSessionFormState>(() =>
    buildInitialFormState(initialData),
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Nothing persists across opens -- every fresh open starts from the
  // clicked session's own current values, same reset-on-open pattern
  // `StudentDialog.tsx`/`ScheduleMeetingsDialog.tsx` both already establish.
  useEffect(() => {
    if (isOpen) {
      setFormState(buildInitialFormState(initialData));
      setSubmitError(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset only on the isOpen transition.
  }, [isOpen]);

  const now = new Date();
  const candidatePayload =
    initialData === null
      ? null
      : computeMeetingSessionEditPayload(
          initialData.session.sessionId,
          formState.date,
          formState.startTime,
          formState.endTime,
          formState.notes,
          now,
        );
  const hasDateCollision =
    initialData !== null &&
    formState.date !== undefined &&
    sessionDateCollidesWithSibling(formState.date, initialData.otherSessionDates);
  const isValid = candidatePayload !== null && !hasDateCollision;
  const fieldErrors = computeFieldErrors(
    formState.date,
    formState.startTime,
    formState.endTime,
    initialData?.otherSessionDates ?? [],
    now,
  );

  function handleClose(): void {
    setFormState(buildInitialFormState(initialData));
    setSubmitError(null);
    onOpenChange(false);
  }

  async function handleSubmit(): Promise<void> {
    if (!isValid || candidatePayload === null) return; // extra guard; the button is already natively disabled.
    setIsSubmitting(true);
    setSubmitError(null);
    try {
      await onSaveMeetingSession(candidatePayload);
      onOpenChange(false);
    } catch (error) {
      setSubmitError(
        isSupabaseLoaderError(error)
          ? error.message
          : error instanceof Error
            ? error.message
            : 'Something went wrong saving these changes.',
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Dialog isOpen={isOpen} onOpenChange={onOpenChange} purpose="form">
      <Layout
        header={<DialogHeader title="Edit session" onOpenChange={onOpenChange} />}
        content={
          <LayoutContent>
            <FormLayout>
              {initialData !== null && (
                <Text type="supporting">
                  {`${initialData.eventTitle} · ${formatSessionDateHeading(initialData.session.sessionDate)}`}
                </Text>
              )}

              {/* Field labels are prefixed "Session ..." (not the bare "Date"/
                  "Start time"/"End time"/"Notes" `ScheduleMeetingsDialog.tsx`
                  uses for its own always-mounted fields -- that dialog and
                  this one are BOTH mounted simultaneously inside
                  `CoachMeetingsView` regardless of which is open, `Dialog`'s
                  own children rendering unconditionally on `isOpen`, only its
                  native modal-open state gated on that prop. Bare labels
                  would make this file's own `getFieldControl`-style lookups
                  genuinely ambiguous, not merely a test-authoring
                  inconvenience -- a real accessibility win too, since a
                  coach navigating by label now sees which fields describe
                  THIS session specifically. */}
              <DateInput
                label="Session date"
                value={formState.date}
                onChange={(value) => setFormState((prev) => ({ ...prev, date: value }))}
                isRequired
                status={
                  fieldErrors.date !== undefined
                    ? { type: 'error', message: fieldErrors.date }
                    : undefined
                }
              />

              <HStack gap={2} wrap="wrap">
                <TimeInput
                  label="Session start time"
                  value={formState.startTime}
                  onChange={(value) => setFormState((prev) => ({ ...prev, startTime: value }))}
                  isRequired
                  status={
                    fieldErrors.startTime !== undefined
                      ? { type: 'error', message: fieldErrors.startTime }
                      : undefined
                  }
                />
                <TimeInput
                  label="Session end time"
                  value={formState.endTime}
                  onChange={(value) => setFormState((prev) => ({ ...prev, endTime: value }))}
                  isRequired
                  status={
                    fieldErrors.endTime !== undefined
                      ? { type: 'error', message: fieldErrors.endTime }
                      : undefined
                  }
                />
              </HStack>

              <TextArea
                label="Session notes"
                value={formState.notes}
                onChange={(value) => setFormState((prev) => ({ ...prev, notes: value }))}
                isOptional
                rows={3}
              />

              {submitError !== null && (
                <Banner
                  status="error"
                  title="Couldn't save these changes"
                  description={submitError}
                />
              )}
            </FormLayout>
          </LayoutContent>
        }
        footer={
          <LayoutFooter hasDivider>
            <HStack gap={2} hAlign="between" vAlign="center" wrap="wrap">
              {/* Destructive -- never the bare word "Cancel" (mirrors
                  `MeetingsList.tsx:1683-1686`'s own reasoning about ambiguous
                  Cancel labels when several could be on screen). Calls
                  `onRequestCancelSession()` ONLY -- this dialog does not own
                  the cancel mutation (module doc #6/packet §3.4). */}
              <Button
                label="Cancel this meeting"
                variant="destructive"
                onClick={onRequestCancelSession}
              />
              <HStack gap={2} hAlign="end">
                <Button label="Close" variant="secondary" onClick={handleClose} />
                <Button
                  label="Save changes"
                  variant="primary"
                  isDisabled={!isValid || isSubmitting}
                  isLoading={isSubmitting}
                  clickAction={handleSubmit}
                />
              </HStack>
            </HStack>
          </LayoutFooter>
        }
      />
    </Dialog>
  );
}

export default EditMeetingSessionDialog;
