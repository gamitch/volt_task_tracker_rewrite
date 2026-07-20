/**
 * T117 (PRD v2 UXP-01): coach-managed attendance with per-student hours --
 * the "edit-dialog-parity core" (packet's own words). A spacious,
 * page-level section (UXD-06 -- NOT a cramped modal) rendered on
 * `OutreachDetail.tsx`, one card per session day, each with a roster
 * checklist (grouped by team chips per Known Context/Traps #3), a
 * per-student hours override field for attending students, and running
 * per-day + event-total hours indicators (reference: capability map's
 * "Edit event dialog" figure, its own "48h total" badge + per-day
 * "Attendance (N)" + per-student hours field, `docs/swarm/
 * current-app-capability-map.html`).
 *
 * -----------------------------------------------------------------------
 * 1. Ground truth / SCH-04 -- `attendance` write policy already exists
 *    (PRD v2 section 3, T114-verified, restated in full in
 *    `../../lib/supabase/loaders/attendance.ts`'s own module doc #1, not
 *    re-cited here). This component is pure frontend wiring against that
 *    already-permitted surface; `loaders/attendance.ts` owns every real
 *    `attendance` read/write this file performs (module doc #6).
 *
 * -----------------------------------------------------------------------
 * 2. Reference-figure-verified layout (binding UX requirement, PRD v2 UXD).
 *    The capability map's "Edit event dialog" figure was rendered and
 *    inspected pixel-for-pixel for this task (not just read as prose): each
 *    session day is its own bordered container ("Days & attendance") with
 *    an "Attendance (N)" sub-heading, and EVERY roster row shows [checkbox]
 *    [name] [team chip badge] -- an hours `NumberInput` appears ONLY on
 *    rows that are CHECKED (confirmed directly from the figure: an
 *    unchecked "Eleanor" row has no hours field at all; checked "Gabby"/
 *    "Lilly" rows each show a "16" hours field beside their team chip).
 *    This component reproduces that exact conditional-hours-field pattern
 *    (`AttendanceRowView` below), not a design guess.
 *
 *    UXD-06 (form/edit layouts over ~6 fields are page-like, not cramped
 *    modals): this is a full-width `VStack` section on the already-routed
 *    `/outreach/:eventId` detail page, not a `Dialog`/`AlertDialog` -- one
 *    `Card` per session day gives each day a clear interaction boundary
 *    (Astryx's own Card guidance: "discrete, self-contained items ... could
 *    reorder, remove, or interact with independently" -- a session day is
 *    exactly that), while the page itself supplies the room the reference
 *    figure's dialog chrome does not need to fight for.
 *
 * -----------------------------------------------------------------------
 * 3. Roster grouped by team chips (Known Context/Traps #3).
 *
 * `sortRosterByTeam` below sorts the ALREADY-team-scoped roster (the caller
 * -- `OutreachDetail.tsx` -- passes in `resolveEventRoster`'s own output,
 * that page's existing `events.team_ids` NULL/array resolution, unchanged;
 * this file re-derives nothing about which students are in scope) so
 * same-team students cluster together, and every row additionally carries
 * its own team `Badge` chip (module doc #2's figure-verified per-row
 * pattern) -- the combination is "grouped by team chips" without inventing
 * a second, nested per-team sub-list the reference figure does not show.
 * `pickTeamBadgeVariant` deterministically maps a `teamId` to one of
 * Astryx's own non-semantic categorization variants (`astryx-api.md`
 * Badge Props table + Best Practices: "Use color variants ... for category
 * tags that group or classify items: team names") so multiple teams on one
 * event are visually distinguishable, not just textually.
 *
 * -----------------------------------------------------------------------
 * 4. TRAP #2 -- un-mark / QR-edit semantics are OWNED by
 *    `../../lib/supabase/loaders/attendance.ts` (`resolveAttendanceWriteMethod`/
 *    `resolveUnmarkAction`, that file's own module doc #2 has the full
 *    decision writeup + metric-view safety proof) -- this component only
 *    CALLS those pure decisions (`handleToggle` below) with the currently
 *    loaded row's `method`, it does not re-derive the policy itself.
 *
 * -----------------------------------------------------------------------
 * 5. Persistence model: save on toggle / save on hours blur (packet's own
 *    explicitly-permitted option, Known Context/Traps #4), optimistic with
 *    rollback (same precedent `RsvpControl.tsx`'s own T101 `handleChange`
 *    already established for this exact "instant local flip, roll back on
 *    rejection" shape).
 *
 * Checkbox toggle: `handleToggle` immediately optimistically flips the
 * checked DISPLAY (`optimisticCheckedByKey`, overlaying -- never replacing
 * -- the last-committed truth in `attendanceByKey`) and marks the row
 * pending (`CheckboxInput`'s own `isLoading`), then calls the real mutation
 * (`onUpsertAttendance`/`onRemoveAttendance`, both defaulting to
 * `loaders/attendance.ts`'s real implementations). On success the real
 * written/deleted row replaces the optimistic overlay entirely (the
 * overlay is cleared, committed truth now drives the checked state -- this
 * is what lets a subsequent edit correctly see the real persisted
 * `method`, module doc #4). On rejection the optimistic overlay is cleared
 * WITHOUT ever having touched committed truth (an honest rollback, no
 * silent data loss per DES-12) and the row's `CheckboxInput` gets a real
 * `status="error"` inline message (Astryx's own installed-source-verified
 * prop, not a fabricated one -- module doc #8) -- never a Banner the coach
 * has to visually hunt for across a multi-day, multi-student panel.
 *
 * Hours input: the `NumberInput`'s own `onChange` (fires per valid
 * keystroke, Astryx's own documented behavior) updates a LOCAL, UNCOMMITTED
 * draft (`hoursDraftByKey`) only -- nothing is written to the database
 * while the coach is still typing. `onBlur` (also `onEnter`, for a
 * keyboard-only "commit now" path) is the ONE place a real
 * `hours_override` write fires (`commitHoursOverride`), and ONLY when the
 * draft actually differs from the last-committed override -- an untouched
 * default (the session-duration fallback, module doc #7) is never
 * back-filled as an explicit override, the same discipline
 * `MarkDayCompleteDialog.tsx`'s own module doc #2 already established for
 * this exact column, for the exact same reason (freezing a stale duration
 * into the row forever would be strictly worse than leaving it `NULL` and
 * letting `v_student_hours`'s own coalesce keep tracking a corrected
 * session duration). On a hours-save REJECTION, the coach's typed value is
 * deliberately left showing (the draft is NOT reverted) with an inline
 * `status="error"` -- reverting a value the coach can still see they typed
 * would be exactly the "silent data loss" DES-12 forbids; leaving it
 * visible with a retriable error lets them just blur/Enter again.
 *
 * -----------------------------------------------------------------------
 * 6. Injectable persistence/load seams (module doc #1) -- `loadAttendance`/
 *    `onUpsertAttendance`/`onRemoveAttendance` default to
 *    `../../lib/supabase/loaders/attendance.ts`'s real
 *    `loadAttendanceForSessions`/`upsertAttendance`/`removeAttendance`,
 *    same "real default, injectable for tests" convention every wired page
 *    in this codebase already uses (`RsvpControl.tsx`'s `onRsvpChange`,
 *    `MarkDayCompleteDialog.tsx`'s `onMarkComplete`, etc.).
 *
 * -----------------------------------------------------------------------
 * 7. No metric-formula re-derivation (constitution item 3). The per-day/
 *    event-total hours indicators (`computeSessionAttendanceTotalHours`,
 *    the "N h recorded" text) are a PLAIN LOCAL SUM over the exact
 *    per-student effective-hours values THIS PANEL is currently
 *    displaying/about to write for CURRENTLY ATTENDING students on THIS
 *    event's OWN sessions -- never a query against `v_student_hours`,
 *    never a cross-session/cross-season aggregation, never presented with
 *    copy that could be confused for that view's own "confirmed hours"
 *    output (labeled "recorded for this event", not "season hours"/
 *    "confirmed hours"). This is the same legitimate category of
 *    aggregation `MarkDayCompleteDialog.tsx`'s own module doc #2(b) already
 *    established for this identical table -- summing values this exact
 *    screen is itself constructing, for a UI-total purpose, is not
 *    "duplicating a metric formula" in the sense constitution item 3
 *    forbids (which is about re-implementing the view's own coalesce/
 *    cross-row logic and presenting the result as authoritative).
 *    `computeSessionDurationHours` (the per-student hours field's default
 *    seed) is, verbatim, `v_student_hours`'s own tier-3 fallback
 *    expression -- computed here ONLY to seed a UI default, independently
 *    reimplemented (not imported -- no shared home for it exists yet, and
 *    `MarkDayCompleteDialog.tsx` is not an Allowed File here), same
 *    disclosed posture that file's own module doc #2(a) already
 *    established for the identical formula. This panel, like that dialog,
 *    never reads/writes `check_in_at`/`check_out_at` beyond preserving
 *    whatever already exists (module doc #4) -- so for every row this
 *    panel itself creates or edits, the real SQL tier-2 branch is
 *    necessarily `NULL` and the coalesce falls to `hours_override ??
 *    tier-3-duration`, exactly the two-tier local expression this file
 *    computes (`effectiveHours` below) -- a structural guarantee for these
 *    rows, not an unexamined coincidence, same proof shape that dialog's
 *    own module doc #2(c) already spelled out.
 *
 * -----------------------------------------------------------------------
 * 8. Astryx prop sourcing (constitution item 2) -- every prop used below,
 *    cross-checked directly against `docs/swarm/astryx-api.md` PLUS the
 *    installed source (`node_modules/@astryxdesign/core/dist/**\/*.d.ts`),
 *    same double-check discipline every sibling file in this batch used:
 *
 *  - `Card` (astryx-api.md "Card" section, Props table + installed
 *    `Card/Card.d.ts`): `children`, `padding` used.
 *  - `CheckboxInput` (astryx-api.md "CheckboxInput" section + installed
 *    `CheckboxInput/CheckboxInput.d.ts`): `label`, `value`, `onChange`,
 *    `isLoading`, `status` used.
 *  - `NumberInput` (astryx-api.md "NumberInput" section + installed
 *    `NumberInput/NumberInput.d.ts`): `label`, `value`, `onChange`, `min`,
 *    `step`, `units`, `onBlur`, `onEnter`, `status` used.
 *  - `Badge` (astryx-api.md "Badge" section + installed `Badge/Badge.d.ts`):
 *    `variant`, `label` used.
 *  - `Banner` (already installed-source-verified by `OutreachDetail.tsx`'s
 *    own module doc #9, re-used here): `status`, `title`, `description`,
 *    endContent (Retry) used.
 *  - `Skeleton` (already verified by `OutreachDetail.tsx`): `width`,
 *    `height`, `index` used.
 *  - `Heading`/`Text`/`HStack`/`VStack`/`VisuallyHidden`/`Button`: same
 *    already-verified prop subset `OutreachDetail.tsx`'s own module doc #9
 *    established, reused identically here.
 */
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  Badge,
  Banner,
  Button,
  Card,
  CheckboxInput,
  Heading,
  HStack,
  NumberInput,
  Skeleton,
  Text,
  VisuallyHidden,
  VStack,
} from '@astryxdesign/core';
import {
  loadAttendanceForSessions,
  removeAttendance,
  resolveAttendanceWriteMethod,
  resolveUnmarkAction,
  upsertAttendance,
  type AttendanceMethod,
  type AttendanceRow,
  type LoadAttendanceForSessionsFn,
  type RemoveAttendanceFn,
  type UpsertAttendanceFn,
} from '../../lib/supabase/loaders/attendance';

// ---------------------------------------------------------------------------
// Types -- independently reimplemented, structurally compatible with
// `OutreachDetail.tsx`'s own `OutreachDetailSession`/`RosterStudent`/
// `TeamOption` (module doc #1/#3) so that page can pass its already-fetched
// objects straight through with no reshaping. NOT imported from
// `OutreachDetail.tsx` -- that file imports THIS component, so importing
// its types back here would be a circular module dependency; the same
// "independently reimplemented, not imported, structurally matched"
// precedent every sibling file in this codebase already uses for an
// analogous reason (`RsvpControl.tsx`/`MarkDayCompleteDialog.tsx` vs.
// `OutreachDetail.tsx`/`OutreachList.tsx`).
// ---------------------------------------------------------------------------

export type AttendanceSessionStatus = 'scheduled' | 'completed' | 'canceled';

export interface AttendancePanelSession {
  id: string;
  sessionDate: string;
  startsAt: string;
  endsAt: string;
  status: AttendanceSessionStatus;
}

export interface AttendancePanelStudent {
  id: string;
  name: string;
  teamId: string;
}

export interface AttendancePanelTeam {
  id: string;
  name: string;
}

// ---------------------------------------------------------------------------
// Pure functions -- exported for direct testing. Module docs #2/#3/#7.
// ---------------------------------------------------------------------------

export function rowKey(sessionId: string, studentId: string): string {
  return `${sessionId}:${studentId}`;
}

/** Module doc #7 -- `v_student_hours`'s own tier-3 fallback expression,
 * computed ONLY to seed the per-student hours field's default value, never
 * combined with a coalesce/case chain over `hoursOverride`/`checkInAt`/
 * `checkOutAt` the way the real view's own tier-3 branch actually is. */
export function computeSessionDurationHours(session: { startsAt: string; endsAt: string }): number {
  const ms = new Date(session.endsAt).getTime() - new Date(session.startsAt).getTime();
  return Math.max(ms, 0) / (1000 * 60 * 60);
}

/** Rounds to one decimal place, trims a trailing ".0" -- same formatting
 * `MarkDayCompleteDialog.tsx`'s own `formatHours` already established,
 * independently reimplemented here (not an Allowed File to import from). */
export function formatHours(hours: number): string {
  const rounded = Math.round(hours * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

export function isAttendingStatus(status: AttendanceRow['status'] | undefined): boolean {
  return status === 'present' || status === 'late';
}

/** Module doc #3 -- sorts the (already team-scoped, per module doc #3) roster
 * so same-team students cluster; does not filter/re-derive team scope
 * itself (the caller's `resolveEventRoster`-equivalent already did that). */
export function sortRosterByTeam(
  roster: readonly AttendancePanelStudent[],
  teams: readonly AttendancePanelTeam[],
): AttendancePanelStudent[] {
  const teamOrder = new Map(teams.map((team, index) => [team.id, index]));
  return [...roster].sort((a, b) => {
    const orderA = teamOrder.get(a.teamId) ?? Number.MAX_SAFE_INTEGER;
    const orderB = teamOrder.get(b.teamId) ?? Number.MAX_SAFE_INTEGER;
    if (orderA !== orderB) return orderA - orderB;
    return a.name.localeCompare(b.name);
  });
}

export function resolveTeamName(teamId: string, teams: readonly AttendancePanelTeam[]): string {
  return teams.find((team) => team.id === teamId)?.name ?? 'No team';
}

/** Module doc #3 -- deterministic, stable per-team color so multiple teams
 * on one event are visually distinguishable by chip color, not just text.
 * Astryx's own non-semantic categorization palette (astryx-api.md Badge
 * Best Practices). */
const TEAM_BADGE_VARIANTS = [
  'blue',
  'purple',
  'teal',
  'cyan',
  'green',
  'orange',
  'pink',
  'yellow',
  'red',
] as const;

export function pickTeamBadgeVariant(teamId: string): (typeof TEAM_BADGE_VARIANTS)[number] {
  let hash = 0;
  for (let i = 0; i < teamId.length; i += 1) {
    hash = (hash * 31 + teamId.charCodeAt(i)) >>> 0;
  }
  return TEAM_BADGE_VARIANTS[hash % TEAM_BADGE_VARIANTS.length];
}

export function sortAttendanceSessions(
  sessions: readonly AttendancePanelSession[],
): AttendancePanelSession[] {
  return [...sessions].sort((a, b) => a.startsAt.localeCompare(b.startsAt));
}

/** Module doc #7 -- a plain local sum over the effective hours (explicit
 * `hoursOverride`, else the session-duration default) of every roster
 * student CURRENTLY ATTENDING (module doc #4's `isAttendingStatus`) this
 * one session, per the committed `attendanceByKey` state. */
export function computeSessionAttendanceTotalHours(
  session: AttendancePanelSession,
  roster: readonly AttendancePanelStudent[],
  attendanceByKey: Readonly<Record<string, AttendanceRow>>,
): number {
  const durationHours = computeSessionDurationHours(session);
  return roster.reduce((sum, student) => {
    const row = attendanceByKey[rowKey(session.id, student.id)];
    if (!isAttendingStatus(row?.status)) return sum;
    return sum + (row?.hoursOverride ?? durationHours);
  }, 0);
}

// ---------------------------------------------------------------------------
// NFR-09 date/time formatting -- timestamps stored UTC, displayed
// America/Chicago. Independently reimplemented (module doc #3's "types"
// note -- same reasoning applies to these helpers, avoiding the circular
// import `OutreachDetail.tsx` would otherwise create).
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

export function formatSessionDateTime(session: AttendancePanelSession): string {
  const dateText = WEEKDAY_DATE_FORMATTER.format(parseDateOnly(session.sessionDate));
  const startText = CLOCK_TIME_FORMATTER.format(new Date(session.startsAt));
  const endText = CLOCK_TIME_FORMATTER.format(new Date(session.endsAt));
  return `${dateText} · ${startText}–${endText}`;
}

// ---------------------------------------------------------------------------
// Load state -- DES-12, scoped to this panel's own attendance fetch
// (`OutreachDetail.tsx`'s own top-level loading/error/notFound states are
// unaffected -- this is a narrower, independent async region nested inside
// an already-successfully-loaded page, same "second, smaller DES-12 seam"
// shape `OutreachList.tsx`'s own sub-sections use).
// ---------------------------------------------------------------------------

type AttendanceLoadState =
  | { status: 'loading' }
  | { status: 'error'; retry: () => void }
  | { status: 'success'; rows: AttendanceRow[] };

function useAttendanceLoadState(
  loadAttendance: LoadAttendanceForSessionsFn,
  sessionIdsKey: string,
): AttendanceLoadState {
  const [state, setState] = useState<AttendanceLoadState>({ status: 'loading' });
  const [retryToken, setRetryToken] = useState(0);

  useEffect(() => {
    let isMounted = true;
    setState({ status: 'loading' });
    const sessionIds = sessionIdsKey === '' ? [] : sessionIdsKey.split('|');
    loadAttendance(sessionIds)
      .then((rows) => {
        if (isMounted) setState({ status: 'success', rows });
      })
      .catch(() => {
        if (isMounted) {
          setState({ status: 'error', retry: () => setRetryToken((token) => token + 1) });
        }
      });
    return () => {
      isMounted = false;
    };
  }, [loadAttendance, sessionIdsKey, retryToken]);

  return state;
}

// ---------------------------------------------------------------------------
// Component.
// ---------------------------------------------------------------------------

export interface AttendancePanelProps {
  sessions: readonly AttendancePanelSession[];
  /** Already team-scoped (module doc #3) -- the caller's own roster
   * resolution, unchanged. */
  roster: readonly AttendancePanelStudent[];
  teams: readonly AttendancePanelTeam[];
  /** `attendance.recorded_by` for every write this panel makes -- the
   * acting coach's own `profiles.id`. */
  currentUserProfileId: string;
  /** Injectable load seam (module doc #6). Defaults to the real query. */
  loadAttendance?: LoadAttendanceForSessionsFn;
  /** Injectable persistence seams (module doc #6). Default to the real
   * mutations. */
  onUpsertAttendance?: UpsertAttendanceFn;
  onRemoveAttendance?: RemoveAttendanceFn;
}

interface AttendanceRowViewProps {
  session: AttendancePanelSession;
  student: AttendancePanelStudent;
  teamName: string;
  teamBadgeVariant: (typeof TEAM_BADGE_VARIANTS)[number];
  committedRow: AttendanceRow | undefined;
  isChecked: boolean;
  isPending: boolean;
  rowError: string | undefined;
  hoursDraft: number | undefined;
  defaultDurationHours: number;
  onToggle: (nextChecked: boolean) => void;
  onHoursChange: (value: number) => void;
  onHoursCommit: () => void;
}

function AttendanceRowView({
  student,
  teamName,
  teamBadgeVariant,
  isChecked,
  isPending,
  rowError,
  hoursDraft,
  committedRow,
  defaultDurationHours,
  onToggle,
  onHoursChange,
  onHoursCommit,
}: AttendanceRowViewProps): ReactNode {
  const hoursValue = hoursDraft ?? committedRow?.hoursOverride ?? defaultDurationHours;

  return (
    <HStack gap={3} vAlign="center" wrap="wrap">
      <CheckboxInput
        label={student.name}
        value={isChecked}
        onChange={onToggle}
        isLoading={isPending}
        status={rowError !== undefined ? { type: 'error', message: rowError } : undefined}
      />
      <Badge variant={teamBadgeVariant} label={teamName} />
      {isChecked && (
        <NumberInput
          label={`${student.name} hours`}
          value={hoursValue}
          onChange={onHoursChange}
          onBlur={onHoursCommit}
          onEnter={onHoursCommit}
          min={0}
          step={0.25}
          units="h"
        />
      )}
    </HStack>
  );
}

export function AttendancePanel({
  sessions,
  roster,
  teams,
  currentUserProfileId,
  loadAttendance = loadAttendanceForSessions,
  onUpsertAttendance = upsertAttendance,
  onRemoveAttendance = removeAttendance,
}: AttendancePanelProps): ReactNode {
  // A session that's already canceled has nothing to record attendance
  // against (module doc, disclosed judgment call: `event_sessions.status`
  // check constraint's own `'canceled'` value means the day never
  // happened).
  const eligibleSessions = useMemo(
    () => sortAttendanceSessions(sessions.filter((session) => session.status !== 'canceled')),
    [sessions],
  );
  const sessionIdsKey = useMemo(
    () => eligibleSessions.map((session) => session.id).join('|'),
    [eligibleSessions],
  );
  const sortedRoster = useMemo(() => sortRosterByTeam(roster, teams), [roster, teams]);

  const loadState = useAttendanceLoadState(loadAttendance, sessionIdsKey);

  const [attendanceByKey, setAttendanceByKey] = useState<Record<string, AttendanceRow>>({});
  const [optimisticCheckedByKey, setOptimisticCheckedByKey] = useState<Record<string, boolean>>({});
  const [hoursDraftByKey, setHoursDraftByKey] = useState<Record<string, number>>({});
  const [pendingKeys, setPendingKeys] = useState<ReadonlySet<string>>(new Set());
  const [rowErrorByKey, setRowErrorByKey] = useState<Record<string, string>>({});

  // Module doc #5 -- resyncs committed truth whenever a fresh load succeeds
  // (initial mount, or a retry after an error).
  useEffect(() => {
    if (loadState.status !== 'success') return;
    const next: Record<string, AttendanceRow> = {};
    for (const row of loadState.rows) {
      next[rowKey(row.sessionId, row.studentId)] = row;
    }
    setAttendanceByKey(next);
  }, [loadState]);

  function setPending(key: string, isPending: boolean): void {
    setPendingKeys((prev) => {
      const next = new Set(prev);
      if (isPending) next.add(key);
      else next.delete(key);
      return next;
    });
  }

  function clearRowError(key: string): void {
    setRowErrorByKey((prev) => {
      if (!(key in prev)) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }

  // Module doc #5/#4 -- checkbox toggle: optimistic flip + real mutation
  // (delegating the un-mark/QR-history decision to `loaders/attendance.ts`'s
  // own pure functions, module doc #4) + rollback-on-failure.
  async function handleToggle(
    session: AttendancePanelSession,
    student: AttendancePanelStudent,
    nextChecked: boolean,
  ): Promise<void> {
    const key = rowKey(session.id, student.id);
    const existing = attendanceByKey[key];
    setOptimisticCheckedByKey((prev) => ({ ...prev, [key]: nextChecked }));
    clearRowError(key);
    setPending(key, true);
    try {
      if (nextChecked) {
        const saved = await onUpsertAttendance({
          sessionId: session.id,
          studentId: student.id,
          status: 'present',
          hoursOverride: null,
          method: resolveAttendanceWriteMethod(existing?.method ?? null),
          recordedBy: currentUserProfileId,
        });
        setAttendanceByKey((prev) => ({ ...prev, [key]: saved }));
      } else {
        const action = resolveUnmarkAction(existing?.method ?? null);
        if (action === 'delete') {
          await onRemoveAttendance({ sessionId: session.id, studentId: student.id });
          setAttendanceByKey((prev) => {
            if (!(key in prev)) return prev;
            const next = { ...prev };
            delete next[key];
            return next;
          });
        } else {
          const preservedMethod: AttendanceMethod = existing?.method ?? 'coach';
          const saved = await onUpsertAttendance({
            sessionId: session.id,
            studentId: student.id,
            status: 'absent',
            hoursOverride: null,
            method: preservedMethod,
            recordedBy: currentUserProfileId,
          });
          setAttendanceByKey((prev) => ({ ...prev, [key]: saved }));
        }
      }
      setHoursDraftByKey((prev) => {
        if (!(key in prev)) return prev;
        const next = { ...prev };
        delete next[key];
        return next;
      });
      setOptimisticCheckedByKey((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    } catch (error) {
      // Rollback (module doc #5) -- committed truth was never touched, only
      // the optimistic overlay is discarded.
      setOptimisticCheckedByKey((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
      setRowErrorByKey((prev) => ({
        ...prev,
        [key]: error instanceof Error ? error.message : "Couldn't save this student's attendance.",
      }));
    } finally {
      setPending(key, false);
    }
  }

  function handleHoursChange(
    session: AttendancePanelSession,
    student: AttendancePanelStudent,
    value: number,
  ): void {
    const key = rowKey(session.id, student.id);
    setHoursDraftByKey((prev) => ({ ...prev, [key]: value }));
  }

  // Module doc #5 -- commits ONLY when the draft genuinely differs from the
  // last-committed override; an untouched default is never written.
  async function commitHoursOverride(
    session: AttendancePanelSession,
    student: AttendancePanelStudent,
  ): Promise<void> {
    const key = rowKey(session.id, student.id);
    const existing = attendanceByKey[key];
    const draft = hoursDraftByKey[key];
    if (draft === undefined || existing === undefined) return;
    const committedOverride = existing.hoursOverride ?? null;
    if (draft === committedOverride) return;
    clearRowError(key);
    setPending(key, true);
    try {
      const saved = await onUpsertAttendance({
        sessionId: session.id,
        studentId: student.id,
        status: existing.status,
        hoursOverride: draft,
        method: resolveAttendanceWriteMethod(existing.method),
        recordedBy: currentUserProfileId,
      });
      setAttendanceByKey((prev) => ({ ...prev, [key]: saved }));
      setHoursDraftByKey((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    } catch (error) {
      // Module doc #5 -- deliberately does NOT revert the draft: the
      // coach's typed value stays visible, with an inline error, so no
      // silent data loss (DES-12).
      setRowErrorByKey((prev) => ({
        ...prev,
        [key]: error instanceof Error ? error.message : "Couldn't save this student's hours.",
      }));
    } finally {
      setPending(key, false);
    }
  }

  const eventTotalHours = useMemo(
    () =>
      eligibleSessions.reduce(
        (sum, session) =>
          sum + computeSessionAttendanceTotalHours(session, roster, attendanceByKey),
        0,
      ),
    [eligibleSessions, roster, attendanceByKey],
  );

  return (
    <VStack gap={5}>
      <HStack hAlign="between" vAlign="center" wrap="wrap" gap={3}>
        <Heading level={2}>Attendance</Heading>
        {loadState.status === 'success' && (
          <Badge variant="neutral" label={`${formatHours(eventTotalHours)}h recorded`} />
        )}
      </HStack>

      {loadState.status === 'loading' && (
        <VStack gap={3} aria-busy="true">
          <VisuallyHidden as="div" role="status">
            Loading attendance…
          </VisuallyHidden>
          <Skeleton width="100%" height={60} index={0} />
          <Skeleton width="100%" height={60} index={1} />
        </VStack>
      )}

      {loadState.status === 'error' && (
        <Banner
          status="error"
          title="Couldn't load attendance"
          description="Something went wrong loading this event's attendance. Try again."
          endContent={<Button variant="ghost" label="Retry" onClick={loadState.retry} />}
        />
      )}

      {loadState.status === 'success' && eligibleSessions.length === 0 && (
        <Text type="supporting" color="secondary">
          No sessions to record attendance for yet.
        </Text>
      )}

      {loadState.status === 'success' &&
        eligibleSessions.length > 0 &&
        sortedRoster.length === 0 && (
          <Text type="supporting" color="secondary">
            No students on this event&rsquo;s roster yet.
          </Text>
        )}

      {loadState.status === 'success' &&
        eligibleSessions.length > 0 &&
        sortedRoster.length > 0 &&
        eligibleSessions.map((session) => {
          const defaultDurationHours = computeSessionDurationHours(session);
          const dayTotalHours = computeSessionAttendanceTotalHours(
            session,
            roster,
            attendanceByKey,
          );
          const attendingCount = sortedRoster.filter((student) => {
            const key = rowKey(session.id, student.id);
            return key in optimisticCheckedByKey
              ? optimisticCheckedByKey[key]
              : isAttendingStatus(attendanceByKey[key]?.status);
          }).length;

          return (
            <Card key={session.id} padding={4}>
              <VStack gap={3}>
                <HStack hAlign="between" vAlign="center" wrap="wrap" gap={2}>
                  <Heading level={3}>{formatSessionDateTime(session)}</Heading>
                  <Text type="supporting" color="secondary">
                    {attendingCount} attending · {formatHours(dayTotalHours)} h
                  </Text>
                </HStack>
                <VStack gap={2}>
                  {sortedRoster.map((student) => {
                    const key = rowKey(session.id, student.id);
                    const committedRow = attendanceByKey[key];
                    const isChecked =
                      key in optimisticCheckedByKey
                        ? optimisticCheckedByKey[key]
                        : isAttendingStatus(committedRow?.status);
                    return (
                      <AttendanceRowView
                        key={student.id}
                        session={session}
                        student={student}
                        teamName={resolveTeamName(student.teamId, teams)}
                        teamBadgeVariant={pickTeamBadgeVariant(student.teamId)}
                        committedRow={committedRow}
                        isChecked={isChecked}
                        isPending={pendingKeys.has(key)}
                        rowError={rowErrorByKey[key]}
                        hoursDraft={hoursDraftByKey[key]}
                        defaultDurationHours={defaultDurationHours}
                        onToggle={(nextChecked) => {
                          void handleToggle(session, student, nextChecked);
                        }}
                        onHoursChange={(value) => handleHoursChange(session, student, value)}
                        onHoursCommit={() => {
                          void commitHoursOverride(session, student);
                        }}
                      />
                    );
                  })}
                </VStack>
              </VStack>
            </Card>
          );
        })}
    </VStack>
  );
}

export default AttendancePanel;
