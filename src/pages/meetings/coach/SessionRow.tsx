/**
 * @file SessionRow.tsx
 * @position GAM-448. One session's own row inside `SchedulePanel.tsx`'s
 *   month-tab list -- the collapsed line (status badge, optional overlap
 *   badge, per-row `Edit` chip, expand toggle) plus the status-appropriate
 *   expander: a confirmed cancel for `scheduled`, tap-to-cycle attendance
 *   chips for `completed`, a plain sentence for `canceled`. See
 *   `SchedulePanel.tsx`'s own module doc for the write-seam correction
 *   (`makeSetAttendanceStatus`/`makeRemoveAttendance`, never the
 *   `endMeeting.ts:489` factory the original issue named -- criterion 14
 *   reads this file literally, so that name is not spelled out here even in
 *   a comment) and the `expectedCt` omission -- both apply here too.
 *
 * -----------------------------------------------------------------------
 * 1. Row line -- verbatim, no re-formatting (criterion 19).
 *
 *    `formatWeekdayDate(session.sessionDate)` ("Thu, Oct 1") joined with
 *    `formatTimeRangeWithDuration(session.startsAt, session.endsAt)`
 *    ("4:00-6:00 PM - 2h") by " - " produces exactly
 *    `"Thu, Oct 1 - 4:00-6:00 PM - 2h"`. Both formatters are imported from
 *    `../../../lib/meetings/format.ts` (GAM-443) and neither is
 *    re-implemented -- the issue's own `"4-6 PM"` worked example is not
 *    producible from these formatters and is not attempted here
 *    (`SchedulePanel.tsx`'s module doc item 6 has the full citation).
 *
 * -----------------------------------------------------------------------
 * 2. Cancel confirmation -- mirrors the shipped, green `cancelTarget` +
 *    `AlertDialog` pair at `CoachMeetingsView.tsx:1634` (props verified at
 *    `:453`) rather than hand-rolling one, per DES-11
 *    (`docs/swarm/VOLT_Portal_PRD.md:219`, destructive/irreversible actions
 *    always confirm via `AlertDialog`) and MTG-01 (`:401`, "no inline form").
 *    Unlike that shared, page-level `cancelTarget` state (one dialog serving
 *    every row), this component owns one small boolean
 *    (`isCancelConfirmOpen`) per row -- `SchedulePanel.tsx` mounts one
 *    `SessionRow` per session, so a page-level shared dialog has no
 *    equivalent to lift TO in this file's own scope, and a row-local dialog
 *    is simpler than threading a shared-target callback through
 *    `SchedulePanel.tsx` for a stub with no caller yet (packet §0a).
 *    **No expected-attendee count renders in this branch** (`SchedulePanel.tsx`
 *    module doc item 3 / packet §0g) -- `session.expectedCt` is never read.
 *
 * -----------------------------------------------------------------------
 * 3. The roster region -- all four DES-12 states
 *    (`docs/swarm/VOLT_Portal_PRD.md:220`), reached purely from what this
 *    component is given (it never fetches anything itself):
 *      - `isRosterLoading` -> `Skeleton` rows.
 *      - `rosterError` -> `Banner status="error"`. No retry action is
 *        rendered: DES-12's usual "with retry" wiring calls back into a
 *        loader this component does not own (nothing in `SchedulePanel.tsx`'s
 *        Allowed-Files scope fetches the roster -- packet §0c, filed as a
 *        follow-up) -- inventing a retry button with nothing behind it would
 *        be the same fabricated-affordance defect class constitution item 26
 *        forbids for data, applied to a control instead.
 *      - `roster` present but empty -> `EmptyState` with ONE action, reusing
 *        the already-real `onEditSession` callback (opening
 *        `EditMeetingSessionDialog`, GAM-452's own wiring target) as the
 *        "what can a coach actually do next" affordance, rather than
 *        inventing a seam this ticket has no authority to add. Omitted
 *        entirely when `onEditSession` is not supplied, rather than
 *        rendering a dead button.
 *      - populated -> one roster row per `SessionRosterEntry`, each pairing
 *        the student's name with an `AttendanceChips` control.
 *
 * -----------------------------------------------------------------------
 * 4. The roving-tabindex roster list + DES-17 digit keys -- mirrors
 *    `LiveConsole.tsx:908,937,940-941,1073,1080-1097,1144-1164`'s shipped
 *    shape (round 2 of this ticket's premise gate settled this against an
 *    earlier "keys live on the chip" draft). Exactly one roster row (the
 *    `focusedRowIndex`'th) has `tabIndex={0}`; the rest have `tabIndex={-1}`.
 *    Each row's own `onKeyDown` (bound on the row `<div>` itself, so it fires
 *    on bubbling from any focused descendant, including the `AttendanceChips`
 *    button inside it -- the same reasoning `LiveConsole.tsx:161-186`
 *    documents for its own `<li>`) handles `ArrowUp`/`ArrowDown` (move the
 *    roving tab stop) and `1`-`4` (`DIGIT_KEY_TO_STATUS`, mirrored locally
 *    from `LiveConsole.tsx:778-783` -- that map is a private, unexported
 *    `const` there, so it is restated here rather than imported). Both the
 *    digit-key path and every `AttendanceChips` cycle tap funnel through the
 *    SAME `handleSetStatus`/`handleUnset` pair below, so the MTG-12
 *    `canSetExcused` guard (criterion 16's defence-in-depth) covers both
 *    without being written twice.
 *
 * -----------------------------------------------------------------------
 * 5. The write -- module doc of `SchedulePanel.tsx` item 1 for the seam
 *    correction; this file is where it is actually called.
 *
 *    `onSetAttendanceStatus` is `SetAttendanceStatusFn`
 *    (`../../../lib/supabase/loaders/attendance.ts:494`) -- called with
 *    EXACTLY `{ sessionId, studentId, status, method: 'coach', recordedBy }`
 *    (criterion 7), never a partial payload. `method` is always the literal
 *    `'coach'` -- `resolveAttendanceWriteMethod` (`attendance.ts:287`) is
 *    deliberately NOT called, per the owner ruling
 *    `LiveConsole.tsx:1080-1093` already implements and documents (a coach
 *    tap is always a coach write; that function exists for a different
 *    caller). `onRemoveAttendance` is `RemoveAttendanceFn`
 *    (`attendance.ts:544`) -- called with exactly `{ sessionId, studentId }`
 *    (criterion 8), never as a disguised status write.
 *
 *    **Optimistic update with rollback, LAST WRITE WINS** (2026-08-02
 *    ruling, `LiveConsole.tsx:1042-1060`'s own citation) -- `statusById`
 *    local state is set BEFORE the write settles; on rejection it is
 *    restored to the pre-write value and `writeErrorMessage` is set so the
 *    failure is visible rather than silently swallowed (constitution item
 *    26). No optimistic-concurrency check, no version column, no conflict
 *    dialog is invented -- whichever write resolves is simply believed.
 *
 *    **`recordedBy` absent -> disabled, no write** (criterion 10). Checked
 *    twice, deliberately: `AttendanceChips` itself renders `isDisabled` (so
 *    a click cannot even fire `onClick`), and `handleSetStatus`/
 *    `handleUnset` below re-check before calling either seam, the same
 *    defence-in-depth posture already used for the `canSetExcused` guard.
 */
import { useRef, useState, type CSSProperties, type KeyboardEvent, type ReactNode } from 'react';
import {
  AlertDialog,
  Badge,
  Banner,
  Button,
  EmptyState,
  HStack,
  Skeleton,
  Text,
  VStack,
} from '@astryxdesign/core';
import type {
  CancelMeetingSessionFn,
  CoachMeetingSessionDetail,
} from '../../../lib/meetings/types';
import { formatTimeRangeWithDuration, formatWeekdayDate } from '../../../lib/meetings/format';
import type {
  AttendanceStatus,
  RemoveAttendanceFn,
  SetAttendanceStatusFn,
} from '../../../lib/supabase/loaders/attendance';
import { AttendanceChips } from './AttendanceChips';
import type { SessionRosterEntry } from './SchedulePanel';

/** `../../../lib/meetings/types.ts:53` `SessionStatus` mapped onto Astryx
 * `Badge` semantic variants -- verbatim precedent, `CoachMeetingsView.tsx:636-640`
 * (`SESSION_STATUS_BADGE`), restated here since that file is Forbidden to
 * import a non-exported local `const` from. */
const SESSION_STATUS_BADGE: Record<
  CoachMeetingSessionDetail['status'],
  { variant: 'info' | 'success' | 'error'; label: string }
> = {
  scheduled: { variant: 'info', label: 'Scheduled' },
  completed: { variant: 'success', label: 'Completed' },
  canceled: { variant: 'error', label: 'Canceled' },
};

/** MTG-01g's only student-facing exact string for a canceled session
 * (criterion 12). */
const CANCELED_COPY = 'Canceled — no attendance recorded.';

/** Module doc item 4 -- mirrored, not imported, from `LiveConsole.tsx:778-783`
 * (a private, unexported `const` there). */
const DIGIT_KEY_TO_STATUS: Record<string, AttendanceStatus> = {
  '1': 'present',
  '2': 'late',
  '3': 'excused',
  '4': 'absent',
};

/** `OutreachList.tsx`'s own `MIN_TOUCH_TARGET_STYLE` precedent (D004,
 * `style`-on-`Button` deviation) -- for the row's own `Edit`/expand/cancel
 * buttons, independent of `AttendanceChips.tsx`'s identical constant for the
 * roster chips. */
const MIN_TOUCH_TARGET_STYLE: CSSProperties = { minHeight: '44px' };

function buildInitialStatusMap(
  roster: readonly SessionRosterEntry[] | undefined,
): Record<string, AttendanceStatus | null> {
  const map: Record<string, AttendanceStatus | null> = {};
  for (const entry of roster ?? []) {
    map[entry.studentId] = entry.status;
  }
  return map;
}

/** Props for {@link SessionRow}. */
export interface SessionRowProps {
  eventId: string;
  session: CoachMeetingSessionDetail;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onCancelSession?: CancelMeetingSessionFn;
  onSetAttendanceStatus?: SetAttendanceStatusFn;
  onRemoveAttendance?: RemoveAttendanceFn;
  roster?: readonly SessionRosterEntry[];
  isRosterLoading?: boolean;
  rosterError?: string;
  hasOverlap?: boolean;
  onEditSession?: (sessionId: string) => void;
  recordedBy?: string;
  canSetExcused?: boolean;
}

export function SessionRow({
  session,
  isExpanded,
  onToggleExpand,
  onCancelSession,
  onSetAttendanceStatus,
  onRemoveAttendance,
  roster,
  isRosterLoading = false,
  rosterError,
  hasOverlap = false,
  onEditSession,
  recordedBy,
  canSetExcused = false,
}: SessionRowProps): ReactNode {
  const [isCancelConfirmOpen, setCancelConfirmOpen] = useState(false);
  const [statusById, setStatusById] = useState<Record<string, AttendanceStatus | null>>(() =>
    buildInitialStatusMap(roster),
  );
  const [writeErrorMessage, setWriteErrorMessage] = useState<string | null>(null);
  const [focusedRowIndex, setFocusedRowIndex] = useState(0);
  const rowRefs = useRef<Array<HTMLDivElement | null>>([]);

  const statusBadge = SESSION_STATUS_BADGE[session.status];
  const rowLine = `${formatWeekdayDate(session.sessionDate)} · ${formatTimeRangeWithDuration(
    session.startsAt,
    session.endsAt,
  )}`;

  function focusRosterRow(index: number): void {
    const entries = roster ?? [];
    const clamped = Math.max(0, Math.min(index, entries.length - 1));
    setFocusedRowIndex(clamped);
    rowRefs.current[clamped]?.focus();
  }

  /** Module doc item 5 -- the single guarded write path both a chip cycle
   * tap AND a DES-17 digit key funnel through. */
  function handleSetStatus(studentId: string, status: AttendanceStatus): void {
    if (status === 'excused' && !canSetExcused) return; // MTG-12 defence in depth (criterion 16)
    if (recordedBy === undefined) return; // criterion 10 defence in depth
    if (!onSetAttendanceStatus) return;
    const previous = statusById[studentId] ?? null;
    setStatusById((prev) => ({ ...prev, [studentId]: status }));
    onSetAttendanceStatus({
      sessionId: session.sessionId,
      studentId,
      status,
      method: 'coach',
      recordedBy,
    }).catch(() => {
      setStatusById((prev) => ({ ...prev, [studentId]: previous }));
      setWriteErrorMessage("That attendance change couldn't be saved. Please try again.");
    });
  }

  function handleUnset(studentId: string): void {
    if (recordedBy === undefined) return; // criterion 10 defence in depth
    if (!onRemoveAttendance) return;
    const previous = statusById[studentId] ?? null;
    setStatusById((prev) => ({ ...prev, [studentId]: null }));
    onRemoveAttendance({ sessionId: session.sessionId, studentId }).catch(() => {
      setStatusById((prev) => ({ ...prev, [studentId]: previous }));
      setWriteErrorMessage("That attendance change couldn't be saved. Please try again.");
    });
  }

  function handleRosterRowKeyDown(
    event: KeyboardEvent<HTMLDivElement>,
    index: number,
    studentId: string,
  ): void {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      focusRosterRow(index + 1);
      return;
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      focusRosterRow(index - 1);
      return;
    }
    const status = DIGIT_KEY_TO_STATUS[event.key];
    if (status !== undefined) {
      event.preventDefault();
      handleSetStatus(studentId, status);
    }
  }

  function renderExpandedBody(): ReactNode {
    if (session.status === 'canceled') {
      return <Text type="supporting">{CANCELED_COPY}</Text>;
    }

    if (session.status === 'scheduled') {
      return (
        <VStack gap={2} hAlign="start">
          <Button
            label="Cancel this session"
            variant="destructive"
            size="sm"
            style={MIN_TOUCH_TARGET_STYLE}
            onClick={() => setCancelConfirmOpen(true)}
          />
          <AlertDialog
            isOpen={isCancelConfirmOpen}
            onOpenChange={setCancelConfirmOpen}
            title={`Cancel this session on ${formatWeekdayDate(session.sessionDate)}?`}
            description="This marks the session canceled. Students won't be expected to attend, and no attendance will be recorded for it."
            actionLabel="Cancel session"
            onAction={() => {
              setCancelConfirmOpen(false);
              onCancelSession?.(session.sessionId);
            }}
          />
        </VStack>
      );
    }

    // session.status === 'completed' -- the roster region, all four DES-12
    // states (module doc item 3).
    if (isRosterLoading) {
      return (
        <VStack gap={2}>
          <Skeleton width="100%" height={20} index={0} />
          <Skeleton width="100%" height={20} index={1} />
          <Skeleton width="100%" height={20} index={2} />
        </VStack>
      );
    }

    if (rosterError) {
      return <Banner status="error" title="Couldn't load attendance" description={rosterError} />;
    }

    if (!roster || roster.length === 0) {
      return (
        <EmptyState
          title="No roster recorded"
          description="No students are linked to this session yet."
          isCompact
          actions={
            onEditSession ? (
              <Button
                label="Edit session"
                size="sm"
                onClick={() => onEditSession(session.sessionId)}
              />
            ) : undefined
          }
        />
      );
    }

    return (
      <VStack gap={1}>
        {writeErrorMessage && (
          <Banner
            status="error"
            title={writeErrorMessage}
            isDismissable
            onDismiss={() => setWriteErrorMessage(null)}
          />
        )}
        <div role="list">
          {roster.map((entry, index) => (
            <div
              key={entry.studentId}
              ref={(el) => {
                rowRefs.current[index] = el;
              }}
              role="listitem"
              tabIndex={focusedRowIndex === index ? 0 : -1}
              onFocus={() => setFocusedRowIndex(index)}
              onKeyDown={(event) => handleRosterRowKeyDown(event, index, entry.studentId)}
              data-testid={`roster-row-${entry.studentId}`}
            >
              <HStack justify="between" vAlign="center" gap={2} wrap="wrap">
                <Text type="body">{entry.displayName}</Text>
                <AttendanceChips
                  studentName={entry.displayName}
                  status={statusById[entry.studentId] ?? entry.status}
                  canSetExcused={canSetExcused}
                  isDisabled={recordedBy === undefined}
                  disabledTitle="Sign in again to record attendance."
                  onSetStatus={(status) => handleSetStatus(entry.studentId, status)}
                  onUnset={() => handleUnset(entry.studentId)}
                />
              </HStack>
            </div>
          ))}
        </div>
      </VStack>
    );
  }

  return (
    <VStack gap={2}>
      <HStack justify="between" vAlign="center" wrap="wrap" gap={2}>
        <HStack gap={2} vAlign="center" wrap="wrap">
          <Text type="body">{rowLine}</Text>
          <Badge variant={statusBadge.variant} label={statusBadge.label} />
          {hasOverlap && <Badge variant="neutral" label="Overlap" />}
        </HStack>
        <HStack gap={2} vAlign="center">
          {onEditSession && (
            <Button
              label="Edit"
              size="sm"
              variant="secondary"
              style={MIN_TOUCH_TARGET_STYLE}
              onClick={() => onEditSession(session.sessionId)}
            />
          )}
          <Button
            label={isExpanded ? 'Collapse' : 'Expand'}
            size="sm"
            variant="ghost"
            style={MIN_TOUCH_TARGET_STYLE}
            aria-expanded={isExpanded}
            onClick={onToggleExpand}
          />
        </HStack>
      </HStack>
      {isExpanded && renderExpandedBody()}
    </VStack>
  );
}
