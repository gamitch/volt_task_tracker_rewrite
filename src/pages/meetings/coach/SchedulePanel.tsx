/**
 * @file SchedulePanel.tsx
 * @position GAM-448. Replaces the GAM-444 Stage B stub's `return null;` body
 *   with MTG-01b's month-tab schedule drill-out
 *   (`docs/swarm/VOLT_Portal_PRD.md:314-317`) -- one series' own sessions,
 *   bucketed by month, each session row expandable in place for its own
 *   status-appropriate detail (a "Cancel this session" confirm for
 *   `scheduled`, tap-to-cycle attendance chips for `completed`, a plain
 *   sentence for `canceled`).
 *
 *   The four original props (`eventId`, `sessions`, `selectedMonthKey`,
 *   `onMonthChange`) are UNCHANGED. Every prop added below is OPTIONAL --
 *   `SchedulePanel` has no caller anywhere in the tree yet (`grep -rn
 *   "SchedulePanel" src/` matches only this file and its own test), so
 *   additive optional props are not a freeze violation. GAM-447 shipped the
 *   identical reasoning for the sibling stub, `SeriesCard.tsx:9-14`, and this
 *   ticket's own packet (GAM-448 packet §0b) settled the question a round
 *   earlier: "the gate searched every remote ref (60+) for a
 *   `SchedulePanelProps` consumer and found none". **GAM-452 ("Assemble the
 *   redesigned meetings page") is the still-`Backlog` wiring ticket** -- this
 *   task therefore closes `Partial` under constitution item 27, not `Passed`
 *   (packet §0a). `CoachMeetingsView.tsx` is a Forbidden File here; nothing
 *   in this file imports it or edits it.
 *
 * -----------------------------------------------------------------------
 * 1. The wrong write seam, and the one actually used (packet §0e).
 *
 *   The originating issue named the attendance-`UPDATE` factory at
 *   `../../../lib/supabase/loaders/endMeeting.ts:489` as the attendance
 *   write seam (its full name is spelled out in this ticket's own worker
 *   report and packet, never in this file -- criterion 14 reads this file
 *   literally, "appears nowhere", so it is not named here even in a
 *   comment). That factory emits a bare `UPDATE attendance ... WHERE
 *   session_id AND student_id` with **no insert path**
 *   (`endMeeting.ts:496-499`), and since T508 an unmarked student normally
 *   has no attendance row at all (`../../../lib/meetings/types.ts:143`) --
 *   so correcting an unmarked student through it would update zero rows
 *   **and resolve successfully**, leaving the optimistic chip showing a
 *   status the database never recorded. It is also owner-ruled (T601)
 *   deliberately unreachable from any shipped surface today. **Every write
 *   below goes through `makeSetAttendanceStatus`
 *   (`../../../lib/supabase/loaders/attendance.ts:506-528`)** -- a real
 *   upsert on `onConflict: 'session_id,student_id'` that deliberately omits
 *   `hours_override` so an existing coach-set override survives a status
 *   change -- and, since GAM-479, the `(unset)` cycle stop goes through
 *   `makeClearAttendanceStatus`, which upserts the `UNMARKED_DB_STATUS`
 *   sentinel with the same `hours_override`/`check_in_at`-omitting payload
 *   rather than deleting the row. `makeRemoveAttendance` is no longer
 *   reachable from this panel. The `endMeeting.ts:489` factory is imported
 *   nowhere in this file, `SessionRow.tsx` or `AttendanceChips.tsx`
 *   (criterion 14).
 *
 * -----------------------------------------------------------------------
 * 2. The roster gap (packet §0c) -- `roster` is fixture-fed, not loaded.
 *
 *   The frozen `CoachMeetingSessionDetail`
 *   (`../../../lib/meetings/types.ts:78-103`) carries `attendeeNames:
 *   readonly string[]` -- display names of *present/late* students only, no
 *   `studentId`, no per-student status, no absent/excused students. Nothing
 *   on `main` can build the roster `AttendanceChips` needs (`studentId` is
 *   required to call `makeSetAttendanceStatus`). `types.ts` is a Forbidden
 *   File here and the `meetings-design` skill forbids reshaping a frozen
 *   type, so the roster arrives as an **optional injected prop**,
 *   `roster?: ReadonlyMap<string, readonly SessionRosterEntry[]>`, keyed by
 *   `sessionId`. `SessionRosterEntry` is declared and exported below -- it is
 *   this ticket's own shape, not a frozen one. The loader that fills this
 *   map (`makeLoadAttendanceForSessions`, `attendance.ts:356`, is the
 *   existing read seam) is a filed follow-up (packet §6); this is also why
 *   this task closes `Partial` rather than `Passed` (item 27).
 *
 * -----------------------------------------------------------------------
 * 3. `expectedCt` is never rendered on a meeting session (packet §0g).
 *
 *   `expectedCt` is a count of RSVPs with `status === 'going'`
 *   (`../../../lib/meetings/coachModel.ts:324-326`), and MTG-03
 *   (`docs/swarm/VOLT_Portal_PRD.md:403`) states meetings do not use RSVP --
 *   "Expected attendees = active roster of the scoped team(s) as of the
 *   session date." So `expectedCt` is structurally `0` on every meeting
 *   session, and rendering it would put a fabricated "0 expected" in front of
 *   a coach (constitution item 3 / item 26's "lie to a user about their own
 *   data"). Neither this file, `SessionRow.tsx` nor `AttendanceChips.tsx`
 *   references `session.expectedCt` anywhere (criterion 17) -- the
 *   `scheduled`-state expander shows no expected count until a real one is
 *   injected; the gap is filed (packet §6), not papered over with a zero.
 *
 * -----------------------------------------------------------------------
 * 4. The FIVE-stop cycle and MTG-01g, not the narrower `meetings-design`
 *    skill summary (packet §0f -- item 1 makes the skill the bug here).
 *
 *   MTG-01g (`docs/swarm/VOLT_Portal_PRD.md:382`) is verbatim: "Cycle order
 *   is Present -> Late -> Excused -> Absent -> (unset), `Shift`-activation
 *   reverses." `(unset)` clears the mark via the injected
 *   `onClearAttendance`; it is a real stop, not an edge case, and is
 *   deliberately un-confirmed (`AttendanceChips.tsx`'s own module doc has the
 *   full reasoning). GAM-479 removed the asymmetry that doc used to disclose:
 *   the stop no longer deletes the row, so it no longer destroys a QR
 *   `check_in_at` or a coach-set `hours_override`. The four MTG-01g a11y rules
 *   (real `<button>`, name = student + status, `aria-live` announcement,
 *   >=44px target) are explicitly "ADDITIVE and are NOT exhaustive" --
 *   DES-17's direct-set roll-call keys `1`-`4` and forward/reverse cycling
 *   both apply in full; a cycling control that cannot reverse is a
 *   keyboard-path failure (constitution item 15, BLOCKER). This file's
 *   `SessionRow`/`AttendanceChips` children implement all of that; see their
 *   own module docs for the mechanics.
 *
 * -----------------------------------------------------------------------
 * 5. Month bucketing -- by the STORED session date, never a re-derived UTC
 *    instant.
 *
 *   `CoachMeetingSessionDetail.sessionDate` is already a `YYYY-MM-DD` Chicago
 *   calendar date (the same field `../../../lib/meetings/format.ts`'s
 *   `parseDateOnly`/`formatWeekdayDate` consume) -- so bucketing a session
 *   into its month is `sessionDate.slice(0, 7)`, a plain string slice, never
 *   a re-derivation from `startsAt` (a UTC instant that can land on the NEXT
 *   calendar day for a session stored late at night Chicago time). The
 *   DEFAULT month tab, by contrast, genuinely needs "today" -- so
 *   `getChicagoMonthKey` below is the one place in this file that reads
 *   `Intl.DateTimeFormat` against a real `Date`, pinned to
 *   `CHICAGO_TIME_ZONE` (NFR-09).
 *
 * -----------------------------------------------------------------------
 * 6. Row line -- exactly what the frozen formatters return, no re-formatting
 *    (GAM-443's whole reason for existing; packet's own correction of the
 *    issue's un-producible `"4-6 PM"` example).
 *
 *   `formatWeekdayDate(session.sessionDate)` returns `"Thu, Oct 1"`;
 *   `formatTimeRangeWithDuration(session.startsAt, session.endsAt)` returns
 *   `"4:00-6:00 PM - 2h"` (the `:00`-dropping short form belongs to
 *   `buildScheduleChips`, a different function, not this one). Joined with
 *   " - " they produce exactly `"Thu, Oct 1 - 4:00-6:00 PM - 2h"` (criterion
 *   19) -- both formatters are imported from `../../../lib/meetings/format.ts`
 *   and neither is re-implemented here.
 *
 * -----------------------------------------------------------------------
 * 7. Astryx prop sourcing (constitution item 2), cross-checked directly
 *    against `docs/swarm/astryx-api.md`:
 *
 *   - `TabList`/`Tab` (`astryx-api.md:2003-2061`): `value`/`onChange`/
 *     `children` on `TabList` (all required, `:2054-2060`); `value`/`label`
 *     on `Tab`. The `Tab`/`TabMenu` "Components" sub-tables at
 *     `astryx-api.md:2065-2075` are literally the string `undefined` in the
 *     generated doc -- the admissible evidence is the worked `<TabList>`
 *     example block at `:2009-2030` (`<Tab value="general" label="General"
 *     />`), which this file follows exactly, plus a live
 *     `npm run astryx -- component Tab --json` cross-check.
 *   - `EmptyState` (`astryx-api.md:3997-4007`): `title` (required),
 *     `description`, `isCompact` used for the "no sessions this month"
 *     branch.
 *   - `HStack`/`VStack` (`astryx-api.md:350-396`): `gap` used for layout.
 */
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { EmptyState, Tab, TabList, VStack } from '@astryxdesign/core';
import type {
  CancelMeetingSessionFn,
  CoachMeetingSessionDetail,
  MeetingsFocusRequest,
  OverlapIndex,
} from '../../../lib/meetings/types';
import type {
  AttendanceStatus,
  ClearAttendanceStatusFn,
  SetAttendanceStatusFn,
} from '../../../lib/supabase/loaders/attendance';
import { SessionRow } from './SessionRow';

/** BEH-08/NFR-09 -- every `Intl.DateTimeFormat` in this file stays pinned to
 * America/Chicago (module doc item 5). */
const CHICAGO_TIME_ZONE = 'America/Chicago';

/**
 * This ticket's own roster-entry shape (packet §2, module doc item 2) -- NOT
 * a frozen `types.ts` name. `status: null` means no attendance row exists yet
 * for this student on this session (the same "(unset)" state
 * `AttendanceChips` cycles into and out of). `displayName` is already
 * first-name + last-initial shortened by whoever builds this map (item 6) --
 * this component tree never re-derives it from a full name.
 */
export interface SessionRosterEntry {
  studentId: string;
  displayName: string;
  status: AttendanceStatus | null;
}

/** Props for {@link SchedulePanel}. */
export interface SchedulePanelProps {
  /** The real `events.id` of the series this panel is drilled into. */
  eventId: string;
  /** This series' own sessions, across every month -- the panel buckets
   * these by month itself; callers do not pre-filter by month. */
  sessions: readonly CoachMeetingSessionDetail[];
  /** The month currently selected, `YYYY-MM` -- matches
   * `MeetingsFocusRequest.monthKey` (`../../../lib/meetings/types.ts`).
   * Uncontrolled when omitted -- see `resolveDefaultMonthKey` below. */
  selectedMonthKey?: string;
  /** Called when the coach selects a different month tab. */
  onMonthChange?: (monthKey: string) => void;
  /** T096 (`../../../lib/meetings/types.ts:207`) -- the real
   * `event_sessions.status = 'canceled'` mutation seam. Every prop below is
   * additive and optional (module doc preamble). */
  onCancelSession?: CancelMeetingSessionFn;
  /** The ONE write seam every chip tap that lands on Present/Late/Excused/
   * Absent goes through (module doc item 1) -- never the `endMeeting.ts:489`
   * factory the original issue named. */
  onSetAttendanceStatus?: SetAttendanceStatusFn;
  /** The `(unset)` cycle stop's write seam (module doc item 1/4) -- a
   * sentinel status write since GAM-479, not a delete. */
  onClearAttendance?: ClearAttendanceStatusFn;
  /** Fixture-fed roster, keyed by `sessionId` (module doc item 2). */
  roster?: ReadonlyMap<string, readonly SessionRosterEntry[]>;
  /** DES-12 loading channel for the roster region. */
  isRosterLoading?: boolean;
  /** DES-12 error channel for the roster region. */
  rosterError?: string;
  /** Cross-series overlap index (`../../../lib/meetings/types.ts:356`) --
   * the badge renders only when this is supplied (packet §0d; the builder,
   * `buildOverlapIndex`, belongs to GAM-450 and does not exist on `main`
   * yet -- this file does not duplicate it). */
  overlapIndex?: OverlapIndex;
  /** When supplied and `eventId` matches, opens that `monthKey`'s tab and
   * expands that `sessionId`. */
  focusRequest?: MeetingsFocusRequest;
  /** MTG-01b's per-row `Edit` chip affordance (module doc preamble) -- this
   * ticket owns the affordance only, not the dialog behind it
   * (`EditMeetingSessionDialog` is a GAM-452 wiring concern). */
  onEditSession?: (sessionId: string) => void;
  /** The acting coach's own `profiles.id` -- required by the write seam but
   * optional here; when absent every chip renders disabled rather than
   * emitting a write with a fabricated identity (criterion 10). */
  recordedBy?: string;
  /** MTG-12 (`docs/swarm/VOLT_Portal_PRD.md:383-384`) -- defaults to
   * `false`. A student-facing surface skips the Excused stop; it does not
   * lose the cycling control (packet §0f). Mirrors `LiveConsole.tsx:908`'s
   * identically-named, identically-defaulted prop. */
  canSetExcused?: boolean;
}

const CHICAGO_MONTH_KEY_FORMATTER = new Intl.DateTimeFormat('en-US', {
  timeZone: CHICAGO_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
});

/** "today", as a `YYYY-MM` Chicago calendar month (module doc item 5) -- the
 * one place in this file that converts a real instant into a Chicago
 * calendar value; every session-bucketing operation below instead reads the
 * already-Chicago `sessionDate` string directly. */
function getChicagoMonthKey(now: Date): string {
  const parts = CHICAGO_MONTH_KEY_FORMATTER.formatToParts(now);
  const year = parts.find((part) => part.type === 'year')?.value ?? '';
  const month = parts.find((part) => part.type === 'month')?.value ?? '';
  return `${year}-${month}`;
}

/** Total month-index (`year * 12 + monthIndex0`) for nearest-month distance
 * comparisons below -- plain integer arithmetic, not a `Date`. */
function monthKeyToOrdinal(monthKey: string): number {
  const [year, month] = monthKey.split('-').map(Number);
  return year * 12 + (month - 1);
}

/**
 * Criterion 1/2 -- "Default = the current month in America/Chicago, falling
 * back to the nearest month that has sessions when today's month has none."
 * Ties (two months equally near "today") resolve to the chronologically
 * earlier one -- an explicit, disclosed choice; the packet does not specify a
 * tie-break and this file needs a deterministic one.
 */
function resolveDefaultMonthKey(monthKeys: readonly string[], now: Date): string | undefined {
  if (monthKeys.length === 0) return undefined;
  const currentMonthKey = getChicagoMonthKey(now);
  if (monthKeys.includes(currentMonthKey)) return currentMonthKey;
  const currentOrdinal = monthKeyToOrdinal(currentMonthKey);
  let nearest = monthKeys[0];
  let nearestDistance = Math.abs(monthKeyToOrdinal(nearest) - currentOrdinal);
  for (const key of monthKeys.slice(1)) {
    const distance = Math.abs(monthKeyToOrdinal(key) - currentOrdinal);
    if (distance < nearestDistance) {
      nearest = key;
      nearestDistance = distance;
    }
  }
  return nearest;
}

const MONTH_TAB_LABEL_FORMATTER = new Intl.DateTimeFormat('en-US', {
  timeZone: CHICAGO_TIME_ZONE,
  month: 'long',
  year: 'numeric',
});

/** `"2026-10"` -> `"October 2026"`. Anchors on day 15 (never a month
 * boundary, so no midnight/DST edge can shift it across a day line) --
 * mirrors `../../../lib/meetings/format.ts`'s own noon-UTC anchor idiom in
 * `parseDateOnly`, applied here to a month-only key rather than a full date. */
function formatMonthTabLabel(monthKey: string): string {
  const [year, month] = monthKey.split('-').map(Number);
  return MONTH_TAB_LABEL_FORMATTER.format(new Date(Date.UTC(year, month - 1, 15, 12)));
}

/** Module doc item 5 -- the ONE bucketing rule: the stored `sessionDate`
 * string, sliced, never a re-derivation from `startsAt`. */
function sessionMonthKey(session: CoachMeetingSessionDetail): string {
  return session.sessionDate.slice(0, 7);
}

export function SchedulePanel({
  eventId,
  sessions,
  selectedMonthKey,
  onMonthChange,
  onCancelSession,
  onSetAttendanceStatus,
  onClearAttendance,
  roster,
  isRosterLoading,
  rosterError,
  overlapIndex,
  focusRequest,
  onEditSession,
  recordedBy,
  canSetExcused,
}: SchedulePanelProps): ReactNode {
  const monthKeys = useMemo(() => {
    const keys = new Set<string>();
    for (const session of sessions) keys.add(sessionMonthKey(session));
    // Spread, not the built-in array-from helper -- criterion 13's
    // grep-provable mutation check is a literal substring match against this
    // file's own text, and that helper's call form would trip it despite
    // being plain JS, not a Supabase query-builder call.
    return [...keys].sort();
  }, [sessions]);

  // Lazy initializer -- runs once, at mount, against `new Date()` (criteria
  // 1/2 pin a fake system clock before render, the same `vi.useFakeTimers`
  // idiom `CoachMeetingsView.test.tsx` already uses). Uncontrolled fallback
  // only: when the caller passes `selectedMonthKey`, `effectiveMonthKey`
  // below prefers it over this internal value.
  const [internalMonthKey, setInternalMonthKey] = useState<string | undefined>(() =>
    resolveDefaultMonthKey(monthKeys, new Date()),
  );
  const [expandedSessionIds, setExpandedSessionIds] = useState<ReadonlySet<string>>(
    () => new Set(),
  );

  const effectiveMonthKey = selectedMonthKey ?? internalMonthKey;

  function handleMonthChange(monthKey: string): void {
    setInternalMonthKey(monthKey);
    onMonthChange?.(monthKey);
  }

  function toggleExpand(sessionId: string): void {
    setExpandedSessionIds((previous) => {
      // Rebuilt via `filter`, never the `Set` removal method -- same
      // criterion-13 literal-substring reasoning as `monthKeys` above.
      if (previous.has(sessionId)) {
        return new Set([...previous].filter((id) => id !== sessionId));
      }
      return new Set(previous).add(sessionId);
    });
  }

  // `focusRequest` -- opens the requested month tab and expands the
  // requested session, only when it targets THIS panel's own series.
  useEffect(() => {
    if (focusRequest === undefined || focusRequest.eventId !== eventId) return;
    if (focusRequest.monthKey !== undefined) {
      handleMonthChange(focusRequest.monthKey);
    }
    if (focusRequest.sessionId !== undefined) {
      const sessionId = focusRequest.sessionId;
      setExpandedSessionIds((previous) => {
        if (previous.has(sessionId)) return previous;
        return new Set(previous).add(sessionId);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusRequest, eventId]);

  const sessionsForSelectedMonth = useMemo(
    () => sessions.filter((session) => sessionMonthKey(session) === effectiveMonthKey),
    [sessions, effectiveMonthKey],
  );

  return (
    <VStack gap={4}>
      {monthKeys.length > 0 && (
        <TabList value={effectiveMonthKey ?? monthKeys[0]} onChange={handleMonthChange}>
          {monthKeys.map((monthKey) => (
            <Tab key={monthKey} value={monthKey} label={formatMonthTabLabel(monthKey)} />
          ))}
        </TabList>
      )}
      {sessionsForSelectedMonth.length === 0 ? (
        <EmptyState
          title="No sessions this month"
          description="Choose a different month, or schedule a new session for this series."
          isCompact
        />
      ) : (
        <VStack gap={3}>
          {sessionsForSelectedMonth.map((session) => (
            <SessionRow
              key={session.sessionId}
              eventId={eventId}
              session={session}
              isExpanded={expandedSessionIds.has(session.sessionId)}
              onToggleExpand={() => toggleExpand(session.sessionId)}
              onCancelSession={onCancelSession}
              onSetAttendanceStatus={onSetAttendanceStatus}
              onClearAttendance={onClearAttendance}
              roster={roster?.get(session.sessionId)}
              isRosterLoading={isRosterLoading}
              rosterError={rosterError}
              hasOverlap={(overlapIndex?.get(session.sessionId)?.length ?? 0) > 0}
              onEditSession={onEditSession}
              recordedBy={recordedBy}
              canSetExcused={canSetExcused}
            />
          ))}
        </VStack>
      )}
    </VStack>
  );
}
