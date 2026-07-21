/**
 * T126 (PRD v2 UXP-03): "retroactive student/parent check-off" `Dialog`. A
 * signed-in student (or parent for a linked student) picks which of an
 * outreach event's already-COMPLETED days they attended; each picked day
 * gets an `attendance` row labeled `method: 'self'` with default hours
 * (`hours_override: null` -- `v_student_hours`'s own tier-3 session-length
 * fallback is the "default hours" mechanism, module doc #2 below). A coach
 * can amend/remove any of these rows later via the existing UXP-01
 * `AttendancePanel.tsx` (Trap #2, module doc #3 below -- FREE, no edit to
 * that file). Constitution item 17: every string below is a neutral status/
 * action label -- no "you forgot to check in", no streak/urgency framing,
 * no re-engagement copy.
 *
 * -----------------------------------------------------------------------
 * 1. Ground truth / RLS -- `../../lib/supabase/loaders/selfCheckoff.ts`'s
 *    own module doc has the full `attendance` column + `self_insert`/
 *    `self_delete` policy writeup (both scratch-Postgres verified,
 *    positive AND negative matrix, in this task's own new migration file,
 *    `supabase/migrations/20260724000000_self_checkoff.sql`). This
 *    component is pure frontend wiring against that already-verified
 *    surface; it performs no RLS/SQL of its own.
 *
 * -----------------------------------------------------------------------
 * 2. THE MET-03 FORMULA-OWNERSHIP TRAP (constitution item 3, BLOCKER-class
 *    if gotten wrong) -- same discipline `MarkDayCompleteDialog.tsx`'s own
 *    module doc #2 already established for this identical table.
 *    `computeSessionDurationHours` below is `v_student_hours`'s own tier-3
 *    fallback expression, computed here ONLY to show a small "(counts as
 *    about Xh)" disclosure next to each pickable day -- never written to
 *    `hours_override` (this dialog's own `insertSelfCheckoff` call always
 *    passes `hours_override: null`, `check_in_at`/`check_out_at: null` --
 *    `../../lib/supabase/loaders/selfCheckoff.ts`'s own `makeInsertSelfCheckoff`
 *    hard-codes this, not a value this component could override even if it
 *    tried), so `v_student_hours`'s real coalesce chain necessarily falls
 *    through to that same tier-3 branch for every row this dialog creates --
 *    a structural guarantee, not a hopeful coincidence, same proof shape
 *    that dialog's own module doc #2(c) already spelled out for this table.
 *
 * -----------------------------------------------------------------------
 * 3. Trap #2 (packet) -- coach amend/remove is FREE, verified by
 *    inspection, not re-implemented here:
 *      - `AttendancePanel.tsx` (UXP-01, unmodified, Forbidden File) renders
 *        ANY `attendance.method` value identically (its own `AttendanceRow`
 *        type doesn't even branch on `method` for rendering -- module doc
 *        #4/#8 there) and, per PRD v2 D-7, a coach's uncheck is an
 *        unconditional DELETE for every method including `'self'` -- so a
 *        coach already sees and can remove a `'self'` row with zero code
 *        change on that side.
 *      - `CoachHome.tsx`'s activity feed (T124, UXP-10, unmodified,
 *        Forbidden File) derives its "Self" origin badge from
 *        `isSelfOriginated(record.recordedBy, student?.profileId)` -- a
 *        plain equality check with no allowlist of specific `method`
 *        values, so a `'self'`-method row this dialog creates (with
 *        `recorded_by` equal to the checking-off student's OWN
 *        `profile_id`) is picked up automatically. A row a PARENT
 *        self-checks off on behalf of their linked student has
 *        `recorded_by` equal to the PARENT's `profiles.id`, not the
 *        student's own -- `isSelfOriginated` correctly reads that as
 *        staff/other-originated (not "Self"), which is the honest, correct
 *        reading: the record-keeper and the record-subject are different
 *        people in that case, exactly as they are for a coach's own
 *        `'coach'`-method row.
 *
 * -----------------------------------------------------------------------
 * 4. UI mirrors RLS, does not replace it (packet Trap #3). A day with an
 *    EXISTING `attendance` row whose `method !== 'self'` (real `'qr'`/
 *    `'coach'`/`'import'` provenance) renders as an already-checked,
 *    `isDisabled` `CheckboxListItem` (`computeLockedSessionIds` below) --
 *    it can never be toggled off from this dialog, matching
 *    `self_delete`'s own real server-side scope (`method = 'self'` only).
 *    A day with an existing `method === 'self'` row starts checked and
 *    CAN be unchecked (a real DELETE, module doc #1). A day with no row at
 *    all starts unchecked and can be checked (a real INSERT). Only
 *    COMPLETED sessions (`filterEligibleSelfCheckoffSessions`) are ever
 *    offered at all -- a still-`scheduled` day hasn't happened yet, and a
 *    `canceled` day never did.
 *
 * -----------------------------------------------------------------------
 * 5. Astryx prop sourcing (constitution item 2) -- every prop below
 *    cross-checked directly against `docs/swarm/astryx-api.md`, same
 *    already-verified subset `MarkDayCompleteDialog.tsx`'s own module doc
 *    #8 already cites for the identical components:
 *  - `Dialog` ("Dialog" section): `isOpen`, `onOpenChange`, `children`,
 *    `purpose` (`"form"`) used.
 *  - `DialogHeader`: `title`, `subtitle`, `onOpenChange` used (doc's own
 *    Components subsection is `undefined`; taken from the "Dialog" section's
 *    own worked example, same citation `MarkDayCompleteDialog.tsx` used).
 *  - `Layout`/`LayoutContent`/`LayoutFooter`: `header`/`content`/`footer`
 *    (Layout); `children` (LayoutContent); `children`, `hasDivider`
 *    (LayoutFooter) used.
 *  - `FormLayout`: `children` used.
 *  - `CheckboxList`/`CheckboxListItem` ("CheckboxList" section props table +
 *    installed `node_modules/@astryxdesign/core/dist/CheckboxList/
 *    CheckboxListItem.d.ts`, doc's own Components subsection is
 *    `undefined`, confirmed directly against the installed source):
 *    `label`, `value`, `onChange`, `hasDividers` (CheckboxList); `label`,
 *    `value`, `description`, `isDisabled` (CheckboxListItem) used.
 *  - `Banner` ("Banner" section): `status`, `title`, `description`,
 *    `endContent` used.
 *  - `EmptyState` ("EmptyState" section): `headingLevel`, `title`,
 *    `description` used.
 *  - `Skeleton`/`VisuallyHidden`: same already-verified subset
 *    `AttendancePanel.tsx` uses (`width`, `height`, `index` / `as`, `role`).
 *  - `Button` ("Button" section): `label`, `variant`, `isDisabled`,
 *    `isLoading`, `clickAction`, `onClick` used.
 *  - `Text` ("Text" section): `type` (`'supporting'`), `color` used.
 */
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  Banner,
  Button,
  CheckboxList,
  CheckboxListItem,
  Dialog,
  DialogHeader,
  EmptyState,
  FormLayout,
  HStack,
  Layout,
  LayoutContent,
  LayoutFooter,
  Skeleton,
  Text,
  VisuallyHidden,
  VStack,
} from '@astryxdesign/core';
import {
  loadSelfCheckoffAttendance,
  insertSelfCheckoff,
  removeSelfCheckoff,
  type InsertSelfCheckoffFn,
  type LoadSelfCheckoffAttendanceFn,
  type RemoveSelfCheckoffFn,
  type SelfCheckoffAttendanceRow,
} from '../../lib/supabase/loaders/selfCheckoff';

// ---------------------------------------------------------------------------
// Types -- independently reimplemented, structurally compatible with
// `OutreachList.tsx`'s own `OutreachSessionRow` (module doc #1's "not
// imported" convention every sibling file in this directory already uses,
// avoiding a circular import since `OutreachList.tsx` imports THIS file).
// ---------------------------------------------------------------------------

export type SelfCheckoffSessionStatus = 'scheduled' | 'completed' | 'canceled';

export interface SelfCheckoffSession {
  id: string;
  sessionDate: string;
  startsAt: string;
  endsAt: string;
  status: SelfCheckoffSessionStatus;
}

// ---------------------------------------------------------------------------
// Pure functions -- exported for direct testing. Module docs #2/#4.
// ---------------------------------------------------------------------------

/** Module doc #4 -- only a day that has already happened can be
 * self-checked-off: still-`scheduled` hasn't happened yet, `canceled` never
 * did. Sorted ascending by `startsAt` (earliest day first). */
export function filterEligibleSelfCheckoffSessions(
  sessions: readonly SelfCheckoffSession[],
): SelfCheckoffSession[] {
  return sessions
    .filter((session) => session.status === 'completed')
    .slice()
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
}

/** Module doc #2 -- `v_student_hours`'s own tier-3 fallback expression,
 * computed here ONLY to seed a small disclosure string, never written
 * anywhere (this file never constructs an `hours_override` value). */
export function computeSessionDurationHours(session: { startsAt: string; endsAt: string }): number {
  const ms = new Date(session.endsAt).getTime() - new Date(session.startsAt).getTime();
  return Math.max(ms, 0) / (1000 * 60 * 60);
}

/** Rounds to one decimal place, trims a trailing ".0". */
export function formatHours(hours: number): string {
  const rounded = Math.round(hours * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

/** Module doc #4 -- sessions with an EXISTING `method === 'self'` row for
 * this student: start checked, CAN be unchecked (a real DELETE). */
export function computeInitialSelfCheckedSessionIds(
  attendanceRows: readonly SelfCheckoffAttendanceRow[],
): string[] {
  return attendanceRows.filter((row) => row.method === 'self').map((row) => row.sessionId);
}

/** Module doc #4 -- sessions with an EXISTING row whose `method !== 'self'`
 * (real `'qr'`/`'coach'`/`'import'` provenance): start checked, LOCKED --
 * mirrors `self_delete`'s own real server-side scope, never removable from
 * this dialog. */
export function computeLockedSessionIds(
  attendanceRows: readonly SelfCheckoffAttendanceRow[],
): string[] {
  return attendanceRows.filter((row) => row.method !== 'self').map((row) => row.sessionId);
}

export interface SelfCheckoffPlan {
  toInsert: string[];
  toRemove: string[];
}

/**
 * THE one place the submit plan is computed -- independent of how the
 * checklist's `value` array was initialized (locked ids may or may not be
 * present in `checkedSessionIds`, this function does not assume either):
 * a session id is a genuine INSERT candidate only if it is checked AND was
 * neither already self-recorded NOR locked; a session id is a genuine
 * REMOVE candidate only if it WAS self-recorded and is no longer checked.
 */
export function computeSelfCheckoffPlan(
  initialSelfSessionIds: readonly string[],
  lockedSessionIds: readonly string[],
  checkedSessionIds: readonly string[],
): SelfCheckoffPlan {
  const initialSelfSet = new Set(initialSelfSessionIds);
  const lockedSet = new Set(lockedSessionIds);
  const checkedSet = new Set(checkedSessionIds);

  const toInsert = checkedSessionIds.filter((id) => !initialSelfSet.has(id) && !lockedSet.has(id));
  const toRemove = initialSelfSessionIds.filter((id) => !checkedSet.has(id));
  return { toInsert, toRemove };
}

/** DES-14 named-outcome label (never a bare "Save"/"Confirm"/"OK") --
 * states what pressing the button will actually do. Constitution item 17:
 * purely descriptive of the pending change, no urgency/guilt framing. */
export function computeSelfCheckoffConfirmLabel(
  toInsertCount: number,
  toRemoveCount: number,
): string {
  if (toInsertCount === 0 && toRemoveCount === 0) return 'Save';
  const parts: string[] = [];
  if (toInsertCount > 0) parts.push(`${toInsertCount} day${toInsertCount === 1 ? '' : 's'} added`);
  if (toRemoveCount > 0) parts.push(`${toRemoveCount} removed`);
  return `Save — ${parts.join(', ')}`;
}

// ---------------------------------------------------------------------------
// NFR-09 date/time formatting -- timestamps stored UTC, displayed
// America/Chicago. Independently reimplemented (module doc's own "not
// imported" convention -- see Types section above).
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

export function formatSessionDateTime(session: SelfCheckoffSession): string {
  const dateText = WEEKDAY_DATE_FORMATTER.format(parseDateOnly(session.sessionDate));
  const startText = CLOCK_TIME_FORMATTER.format(new Date(session.startsAt));
  const endText = CLOCK_TIME_FORMATTER.format(new Date(session.endsAt));
  return `${dateText} · ${startText}–${endText}`;
}

// ---------------------------------------------------------------------------
// Fixture data (constitution item 6: fabricated names only) -- standalone-
// render defaults, same posture every sibling dialog in this directory
// already established.
// ---------------------------------------------------------------------------

const DEFAULT_EVENT_TITLE = 'Community Food Bank Sort';

const DEFAULT_STUDENT_ID = 'student-placeholder-current-viewer';

const DEFAULT_SESSIONS: readonly SelfCheckoffSession[] = [
  {
    id: 'session-food-bank-past',
    sessionDate: '2026-06-14',
    startsAt: '2026-06-14T14:00:00.000Z',
    endsAt: '2026-06-14T17:00:00.000Z', // 3h
    status: 'completed',
  },
];

/** Disclosed, obviously-fake stand-in for "the signed-in viewer's own
 * `profiles.id`" -- same class of placeholder every sibling dialog in this
 * codebase already uses for its own standalone-render default. */
export const PLACEHOLDER_CURRENT_VIEWER_PROFILE_ID = 'profile-placeholder-current-viewer';

// ---------------------------------------------------------------------------
// Load state -- DES-12, scoped to this dialog's own attendance fetch.
// ---------------------------------------------------------------------------

type LoadState =
  | { status: 'loading' }
  | { status: 'error'; retry: () => void }
  | { status: 'success'; rows: SelfCheckoffAttendanceRow[] };

// ---------------------------------------------------------------------------
// Component.
// ---------------------------------------------------------------------------

export interface SelfCheckoffDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  /** Display context only, e.g. `events.title`. */
  eventTitle?: string;
  /** The `students.id` this check-off is for -- the viewer's own linked
   * student (self, or a parent's linked student). */
  studentId?: string;
  /** Every session for this event; only `'completed'` ones are ever offered
   * (module doc #4). */
  sessions?: readonly SelfCheckoffSession[];
  /** Injectable auth seam. `attendance.recorded_by` for every row this
   * dialog writes -- the ACTING viewer's own `profiles.id` (module doc #3:
   * a student checking off themselves, or a parent checking off a linked
   * student). */
  currentUserProfileId?: string;
  /** Injectable load seam. Defaults to the real query. */
  loadAttendance?: LoadSelfCheckoffAttendanceFn;
  /** Injectable persistence seams. Default to the real mutations. */
  onInsert?: InsertSelfCheckoffFn;
  onRemove?: RemoveSelfCheckoffFn;
}

export function SelfCheckoffDialog({
  isOpen,
  onOpenChange,
  eventTitle = DEFAULT_EVENT_TITLE,
  studentId = DEFAULT_STUDENT_ID,
  sessions = DEFAULT_SESSIONS,
  currentUserProfileId = PLACEHOLDER_CURRENT_VIEWER_PROFILE_ID,
  loadAttendance = loadSelfCheckoffAttendance,
  onInsert = insertSelfCheckoff,
  onRemove = removeSelfCheckoff,
}: SelfCheckoffDialogProps): ReactNode {
  const eligibleSessions = useMemo(() => filterEligibleSelfCheckoffSessions(sessions), [sessions]);
  const eligibleSessionIdsKey = useMemo(
    () => eligibleSessions.map((session) => session.id).join('|'),
    [eligibleSessions],
  );

  const [loadState, setLoadState] = useState<LoadState>({ status: 'loading' });
  const [retryToken, setRetryToken] = useState(0);
  const [checkedSessionIds, setCheckedSessionIds] = useState<string[]>([]);
  const [initialSelfSessionIds, setInitialSelfSessionIds] = useState<string[]>([]);
  const [lockedSessionIds, setLockedSessionIds] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Fresh fetch every time the dialog opens (module doc: no stale state
  // carried across opens, same "reset-on-open-transition" precedent
  // `MarkDayCompleteDialog.tsx` already established).
  useEffect(() => {
    if (!isOpen) return;
    let isMounted = true;
    setLoadState({ status: 'loading' });
    setSubmitError(null);
    const ids = eligibleSessionIdsKey === '' ? [] : eligibleSessionIdsKey.split('|');
    loadAttendance(ids, studentId)
      .then((rows) => {
        if (!isMounted) return;
        setLoadState({ status: 'success', rows });
        const initialSelf = computeInitialSelfCheckedSessionIds(rows);
        const locked = computeLockedSessionIds(rows);
        setInitialSelfSessionIds(initialSelf);
        setLockedSessionIds(locked);
        setCheckedSessionIds([...initialSelf, ...locked]);
      })
      .catch(() => {
        if (isMounted) {
          setLoadState({ status: 'error', retry: () => setRetryToken((token) => token + 1) });
        }
      });
    return () => {
      isMounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset only on the isOpen transition (+ explicit retry/session-set changes).
  }, [isOpen, studentId, eligibleSessionIdsKey, retryToken]);

  const plan = useMemo(
    () => computeSelfCheckoffPlan(initialSelfSessionIds, lockedSessionIds, checkedSessionIds),
    [initialSelfSessionIds, lockedSessionIds, checkedSessionIds],
  );
  const confirmLabel = computeSelfCheckoffConfirmLabel(plan.toInsert.length, plan.toRemove.length);
  const hasChanges = plan.toInsert.length > 0 || plan.toRemove.length > 0;

  function handleClose(): void {
    setSubmitError(null);
    onOpenChange(false);
  }

  async function handleSubmit(): Promise<void> {
    if (!hasChanges || isSubmitting) return;
    setIsSubmitting(true);
    setSubmitError(null);
    try {
      await Promise.all([
        ...plan.toInsert.map((sessionId) =>
          onInsert({ sessionId, studentId, recordedBy: currentUserProfileId }),
        ),
        ...plan.toRemove.map((sessionId) => onRemove({ sessionId, studentId })),
      ]);
      onOpenChange(false);
    } catch (error) {
      setSubmitError(
        error instanceof Error ? error.message : "Couldn't save this event's attendance.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Dialog isOpen={isOpen} onOpenChange={onOpenChange} purpose="form">
      <Layout
        header={
          <DialogHeader title="Mark attendance" subtitle={eventTitle} onOpenChange={onOpenChange} />
        }
        content={
          <LayoutContent>
            {loadState.status === 'loading' && (
              <VStack gap={3} aria-busy="true">
                <VisuallyHidden as="div" role="status">
                  Loading this event&rsquo;s days…
                </VisuallyHidden>
                <Skeleton width="100%" height={40} index={0} />
                <Skeleton width="100%" height={40} index={1} />
              </VStack>
            )}

            {loadState.status === 'error' && (
              <Banner
                status="error"
                title="Couldn't load this event's days"
                description="Something went wrong loading attendance for this event. Try again."
                endContent={<Button variant="ghost" label="Retry" onClick={loadState.retry} />}
              />
            )}

            {loadState.status === 'success' && eligibleSessions.length === 0 && (
              <EmptyState
                headingLevel={3}
                title="No completed days yet"
                description="Once a day for this event has passed, it will show up here to mark."
              />
            )}

            {loadState.status === 'success' && eligibleSessions.length > 0 && (
              <FormLayout>
                <Text type="supporting" color="secondary">
                  Select the days you attended. Days already on file can&rsquo;t be changed here.
                </Text>
                <CheckboxList
                  label="Days"
                  value={checkedSessionIds}
                  onChange={setCheckedSessionIds}
                  hasDividers
                >
                  {eligibleSessions.map((session) => {
                    const isLocked = lockedSessionIds.includes(session.id);
                    const durationHours = computeSessionDurationHours(session);
                    return (
                      <CheckboxListItem
                        key={session.id}
                        value={session.id}
                        label={formatSessionDateTime(session)}
                        description={
                          isLocked
                            ? 'Already recorded'
                            : `Counts as about ${formatHours(durationHours)}h`
                        }
                        isDisabled={isLocked}
                      />
                    );
                  })}
                </CheckboxList>

                {submitError !== null && (
                  <Banner
                    status="error"
                    title="Couldn't save attendance"
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
              <Button label="Cancel" variant="secondary" onClick={handleClose} />
              <Button
                label={confirmLabel}
                variant="primary"
                isDisabled={!hasChanges || isSubmitting || loadState.status !== 'success'}
                isLoading={isSubmitting}
                clickAction={handleSubmit}
              />
            </HStack>
          </LayoutFooter>
        }
      />
    </Dialog>
  );
}

export default SelfCheckoffDialog;
