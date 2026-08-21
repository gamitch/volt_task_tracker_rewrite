/**
 * @file CoachMeetingsView.tsx
 * @position GAM-444 Stage B: the coach/admin `/meetings` view, moved out of
 *   `src/pages/meetings/MeetingsList.tsx` byte-identical (module doc #7/#8/
 *   #9/#10, T135's own Table-migration record -- all travel with this code,
 *   verbatim, per GAM-444 packet §6b's governing rule: "each numbered
 *   section travels with the code it documents"). `MeetingsList.tsx` itself
 *   is now a shell that renders this component when
 *   `isCoachOrAdminView` is true.
 *
 *   `BadgeVariant`, `LoadState<T>`/`useLoadState` are duplicated here AND in
 *   `../student/StudentMeetingsView.tsx` (both files need them; GAM-444's
 *   Allowed Files list has no shared-hook home in scope for this ticket, the
 *   same "copy it" posture `MIN_TOUCH_TARGET_STYLE`/`sessionDetailAnchorId`
 *   below already used against `OutreachList.tsx`). `formatPastAttendanceSummary`/
 *   `SESSION_STATUS_BADGE` are coach-only and live only here;
 *   `ATTENDANCE_STATUS_BADGE` is student-only and lives only in
 *   `../student/StudentMeetingsView.tsx`.
 */
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react';
import {
  AlertDialog,
  Badge,
  Banner,
  Button,
  EmptyState,
  Heading,
  HStack,
  Link,
  Skeleton,
  Table,
  Text,
  VisuallyHidden,
  VStack,
  pixel,
  proportional,
  type TableColumn,
} from '@astryxdesign/core';
import { Link as RouterLink } from 'react-router-dom';
// T511 -- `routePaths` is IMPORT-ONLY here (the route already exists and needs
// no change). `router.tsx` loads every page via `lazy(() => import(...))`, so a
// page importing this back from it is not a cycle -- the same idiom
// `LiveConsole.tsx` and `Kiosk.tsx` already use.
import { routePaths } from '../../../app/router';
import { isSupabaseLoaderError } from '../../../lib/supabase';
// T135 (UXC-02/03/07, T130's proven pattern) -- the shared three-tier stat
// cell (micro-label / value w/ hasTabularNumbers / secondary) extracted by
// T131's wave precisely so this task inherits it. Import only -- Forbidden
// Files bars editing `StatCell.tsx` itself.
import { StatCell } from '../../../components/StatCell';
// T135 -- `useIsNarrowViewport` (and the query constant/subscription it
// implements) was extracted to this shared hook by T132, specifically so
// this task can import it instead of re-implementing the same
// `window.matchMedia` subscription a second time (see that file's own
// module doc). Import only -- Forbidden Files bars editing `src/hooks/**`.
import { useIsNarrowViewport } from '../../../hooks/useIsNarrowViewport';
import {
  isMeetingSessionReconcilable,
  ScheduleMeetingsDialog,
  type CreateMeetingsPayload,
  type EditMeetingSeriesInitialData,
  type OnCreateMeetingsFn,
  type OnSaveMeetingSeriesFn,
  type SaveMeetingSeriesPayload,
} from '../ScheduleMeetingsDialog';
// T605 -- the per-session edit dialog. This file OWNS the mount/wiring; the
// dialog file owns its own payload/fn types, imported here as VALUES (the
// component itself) and TYPES (its own `SaveMeetingSessionPayload`/
// `OnSaveMeetingSessionFn`), mirroring exactly how `ScheduleMeetingsDialog`/
// its own payload types are imported immediately above.
import {
  EditMeetingSessionDialog,
  type EditMeetingSessionInitialData,
  type OnSaveMeetingSessionFn,
  type SaveMeetingSessionPayload,
} from '../EditMeetingSessionDialog';
import {
  formatHoursLabel,
  formatTimeRangeWithDuration,
  formatWeekdayDate,
} from '../../../lib/meetings/format';
import type {
  CancelMeetingSessionFn,
  CoachMeetingRow,
  CoachMeetingRowSummary,
  CoachMeetingSessionDetail,
  CoachMeetingSessionDetailTableRow,
  CoachMeetingTableRow,
  LoadCoachMeetingsDataFn,
  PastAttendanceSummary,
  SessionStatus,
  Team,
} from '../../../lib/meetings/types';
import {
  buildCoachMeetingTableRows,
  partitionCoachMeetingRows,
} from '../../../lib/meetings/coachModel';

type BadgeVariant =
  | 'neutral'
  | 'info'
  | 'success'
  | 'warning'
  | 'error'
  | 'blue'
  | 'cyan'
  | 'green'
  | 'orange'
  | 'pink'
  | 'purple'
  | 'red'
  | 'teal'
  | 'yellow';

// ---------------------------------------------------------------------------
// Status -> Badge variant mapping (coach view only).
// ---------------------------------------------------------------------------

const SESSION_STATUS_BADGE: Record<SessionStatus, { variant: BadgeVariant; label: string }> = {
  scheduled: { variant: 'info', label: 'Scheduled' },
  completed: { variant: 'success', label: 'Completed' },
  canceled: { variant: 'error', label: 'Canceled' },
};

function formatPastAttendanceSummary(summary: PastAttendanceSummary): string {
  // Mirrors MTG-13's own literal worked example format ("14 present - 2
  // late - 1 excused - 1 absent"), PRD line 287.
  return `${summary.presentCt} present · ${summary.lateCt} late · ${summary.excusedCt} excused · ${summary.absentCt} absent`;
}

// ---------------------------------------------------------------------------
// Generic DES-12 load-state hook -- module doc #8.
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
// Coach view -- module doc #7/#8.
// ---------------------------------------------------------------------------

/**
 * T135 (VOLT UX Craft PRD v3.1, UXC-02/03/07) -- REWORK of T122's `ListItem`
 * coach row (module doc #10 above, kept for the row-shape/mutation history;
 * this task changes only the rendering primitive, not the underlying data or
 * mutations) onto Astryx `Table`, per PRD v3.1 F-1's finding that `ListItem`
 * wraps `Item`, a three-slot flex whose end slots are `flex: 0 0 auto`
 * (`Item.tsx:268,272`) and therefore cannot align stat/action columns across
 * sibling rows -- exactly the defect T130 already fixed on the coach
 * outreach rows (`OutreachList.tsx`'s `buildCoachOutreachColumns` and the
 * components around it). This migration copies that proven mechanism
 * (`useTableGroupedRows`/`useTableRowExpansion` remain forbidden -- zero
 * occurrences in `astryx-api.md`, constitution item 2 -- so expansion is a
 * flat `data` array with `kind: 'sessionDetail'` rows spliced in beneath
 * their parent, exactly as `buildCoachOutreachTableRows` does).
 *
 * ONE genuine deviation from the outreach pattern (packet Trap 1/2): T130
 * puts its expansion `useState` INSIDE each `CoachOutreachSection` instance
 * (Upcoming, Past expand independently). That placement is wrong here.
 * `handleConfirmCancel` (below) optimistically flips a canceled session's
 * status, `partitionCoachMeetingRows` (module doc #10c) recomputes on the
 * next render, and a row whose only scheduled session was just canceled
 * moves from the Upcoming bucket to the Past bucket -- a DIFFERENT
 * `CoachMeetingsSection` instance, with its own (in the per-section design)
 * EMPTY expansion set, silently collapsing the row at the exact moment the
 * user most wants to see the cancellation take effect. So expansion state
 * here is lifted ONE level up, into `CoachMeetingsView`, and passed down to
 * BOTH section instances -- it survives the bucket move because it is the
 * same `Set`, not two independent ones.
 *
 * Row-level actions (packet §2): the "Edit"-only `MoreMenu` this row used to
 * carry is replaced with a short `Edit` `Button` chip -- one item behind a
 * menu is a menu that should not exist, same reasoning T131 already shipped
 * on the outreach rows. AUTHORIZED (2026-07-28, George,
 * `VOLT_Portal_PRD.md` beside MTG-01): this is a disclosed PRD deviation
 * from MTG-01's literal "per-row MoreMenu (Edit, Cancel session)" text --
 * Cancel already left the row-level menu for T122's per-session buttons
 * (module doc #10d), leaving exactly one menu item. Per-session Cancel stays
 * exactly where it already was (module doc #10d), inside the expander.
 */

/** UXC-13, T130's mechanism (`MIN_TOUCH_TARGET_STYLE`, `OutreachList.tsx`) --
 * a non-exported local in a Forbidden file, so re-declared here rather than
 * imported (packet's explicit instruction: this is the one place "copy it"
 * is correct). `style` is a real, installed-source-verified prop deviation
 * on `Button` (D004, constitution item 2), not a documented one -- see
 * `OutreachList.tsx`'s own `MIN_TOUCH_TARGET_STYLE` doc comment for the full
 * `mergeProps`/StyleX citation this task inherits without re-deriving. */
const MIN_TOUCH_TARGET_STYLE: CSSProperties = { minHeight: '44px' };

/** T130's mechanism (`sessionDetailAnchorId`, `OutreachList.tsx:2099`) -- a
 * non-exported local in a Forbidden file, re-declared here (same reasoning
 * as `MIN_TOUCH_TARGET_STYLE` above). Gives each spliced-in session-detail
 * row's first `Text` a real id for the expander's `aria-controls` to
 * reference, only once that row genuinely exists in the DOM (rows are
 * spliced OUT, not hidden, when collapsed -- an `aria-controls` IDREF to a
 * nonexistent id would be invalid). */
function sessionDetailAnchorId(eventId: string, sessionId: string): string {
  return `meeting-session-detail-${eventId}-${sessionId}`;
}

/** T130's mechanism -- the expander column/mobile-card control. Visible
 * children stay the pre-existing `Session details (N)` wording (Trap 3b:
 * "keep the wording" branch -- no test churn, `:595`/`:596` stay green
 * untouched), while `label` (the accessible name) carries the per-row
 * show/hide verb + title, matching `CoachExpanderButton`'s own
 * `label`-vs-children split so the row title never leaks into the ONLY
 * visible text on a menu-free action row. */
function CoachMeetingExpanderButton({
  row,
  isExpanded,
  onToggleExpand,
}: {
  row: CoachMeetingRow;
  isExpanded: boolean;
  onToggleExpand: (eventId: string) => void;
}): ReactNode {
  const controlsIds = row.sessions
    .map((session) => sessionDetailAnchorId(row.eventId, session.sessionId))
    .join(' ');
  return (
    <Button
      label={
        isExpanded ? `Hide session details – ${row.title}` : `Show session details – ${row.title}`
      }
      size="sm"
      variant="ghost"
      aria-expanded={isExpanded}
      // Only a real disclosure target while expanded -- the referenced ids
      // do not exist in the DOM until then (row splicing, not CSS-hide).
      aria-controls={isExpanded ? controlsIds : undefined}
      style={MIN_TOUCH_TARGET_STYLE}
      onClick={() => onToggleExpand(row.eventId)}
    >
      {`Session details (${row.sessions.length})`}
    </Button>
  );
}

/** T131's compact reference-app action-cluster shape, reduced to the one
 * action this row actually has (packet §2): a short `Edit` chip, verbatim
 * `label`/visible text matching T131's own Edit button. No destructive `×`
 * here -- Cancel targets one SESSION, not a whole row, and stays inside the
 * expander (module doc #10d), so this row-level cluster is Edit alone. */
function CoachMeetingRowActions({
  row,
  onEdit,
}: {
  row: CoachMeetingRow;
  onEdit: (row: CoachMeetingRow) => void;
}): ReactNode {
  return (
    <Button
      label={`Edit – ${row.title}`}
      size="sm"
      variant="secondary"
      style={MIN_TOUCH_TARGET_STYLE}
      onClick={() => onEdit(row)}
    >
      Edit
    </Button>
  );
}

/** UXC-02: date range + recurrence chips + the canceled `Badge` -- module
 * doc above (Table migration) and packet §3: the canceled `Badge` used to
 * float in the row's own `endContent`, which the PRD itself calls a defect
 * (`VOLT_UX_Craft_PRD_v3.md:98-99`, "floating canceled badge"). It now has a
 * real column home, the date column, matching where T130 put its own type
 * `Badge`. */
function CoachMeetingDateCell({ summary }: { summary: CoachMeetingRowSummary }): ReactNode {
  return (
    <VStack gap={0.5}>
      <Text type="supporting">{summary.dateRangeLabel}</Text>
      {(summary.recurrenceChips.length > 0 || summary.canceledCt > 0) && (
        <HStack gap={1} wrap="wrap" vAlign="center">
          {summary.recurrenceChips.map((chip) => (
            <Badge key={chip} variant="neutral" label={chip} />
          ))}
          {summary.canceledCt > 0 && (
            <Badge variant="error" label={`${summary.canceledCt} canceled`} />
          )}
        </HStack>
      )}
    </VStack>
  );
}

/** UXC-04 standing ruling (packet "Standing rulings" section): NOT a link.
 * PRD NAV-08's `/meetings/:sessionId` detail route does not exist
 * (`router.tsx` has 14 routes, none of them this, and no catch-all), and no
 * meeting-detail component exists either -- linking would point at a blank
 * page. D008: a linked title is canonically `weight` 600/14px/
 * `--color-text-primary`; this plain title matches that weight (the
 * pre-Table `ListItem` label was already semibold) without the link. */
function CoachMeetingTitleCell({ row }: { row: CoachMeetingRow }): ReactNode {
  return (
    <VStack gap={0.5}>
      <Text weight="semibold" maxLines={1}>
        {row.title}
      </Text>
      <Text type="supporting" maxLines={1}>
        {`${row.locationName.trim().length > 0 ? row.locationName : 'No location set'} · ${row.teamScopeLabel}`}
      </Text>
    </VStack>
  );
}

/** T122 (module doc #10d) -- one of a `CoachMeetingRow`'s own sessions,
 * rendered inside that row's expander (UXD-03) -- T135 relocates this from a
 * `Collapsible` child into a spliced-in `Table` row's `title`-column cell
 * content (same text/shape, byte-identical, only the mounting mechanism
 * changes). Carries the ONLY per-session Cancel action left in this file
 * (module doc #10d -- moved here from the old row-level `MoreMenu`, same
 * underlying mutation/optimistic-update pattern, unchanged). `anchorId`
 * lands on the first `Text` so the expander's `aria-controls` (above) has
 * something real to reference once this row exists in the DOM. */
function CoachMeetingSessionRow({
  eventId,
  eventTitle,
  session,
  onCancelRequest,
  onEditRequest,
  anchorId,
}: {
  eventId: string;
  eventTitle: string;
  session: CoachMeetingSessionDetail;
  onCancelRequest: (
    eventId: string,
    eventTitle: string,
    session: CoachMeetingSessionDetail,
  ) => void;
  // T605 -- same signature shape as `onCancelRequest` above, threaded
  // alongside it at every one of this component's own five call sites (§6.2).
  onEditRequest: (eventId: string, eventTitle: string, session: CoachMeetingSessionDetail) => void;
  anchorId?: string;
}): ReactNode {
  const statusBadge = SESSION_STATUS_BADGE[session.status];

  return (
    <HStack gap={3} vAlign="start" wrap="wrap" padding={2}>
      <VStack gap={0.5}>
        <Text id={anchorId} type="supporting">
          {`${formatWeekdayDate(session.sessionDate)} · ${formatTimeRangeWithDuration(session.startsAt, session.endsAt)}`}
        </Text>
        {session.status === 'scheduled' && (
          <Text type="supporting" hasTabularNumbers>
            {`Expected ${session.expectedCt}`}
          </Text>
        )}
        {session.attendanceSummary !== null && (
          <Text type="supporting">{formatPastAttendanceSummary(session.attendanceSummary)}</Text>
        )}
        {session.status === 'completed' && (
          <Text type="supporting">
            {session.attendeeNames.length > 0
              ? `Attended: ${session.attendeeNames.join(', ')}`
              : 'No attendees recorded.'}
          </Text>
        )}
        {session.status === 'canceled' && (
          <Text type="supporting">Canceled &mdash; no attendance recorded.</Text>
        )}
      </VStack>
      <HStack gap={2} vAlign="center">
        <Badge variant={statusBadge.variant} label={statusBadge.label} />
        {session.status === 'scheduled' && (
          <>
            {/* T511 -- the live console's ONLY entry point in the app.
                `routePaths.meetingLiveSession` had zero call sites, so
                `/meetings/live/:sessionId` was reachable only by typing the
                URL. A `Link`, not a `Button`: this navigates, and
                `astryx-api.md`'s Link Best Practices reserve Button for
                actions that do NOT navigate -- so a real anchor is what gives
                middle-click, ctrl-click and the correct screen-reader
                announcement. Same shape as `LiveConsole.tsx`'s own outbound
                "Open kiosk view" link. It sits beside a `Button` and will not
                look identical to it; that is the disclosed cost of being a
                real link.

                No time window, deliberately: gating this to "starting soon"
                would make the console unreachable again outside that window --
                including the case that matters most, a meeting that started an
                hour ago and is still running. See `docs/swarm/active/
                T511-scope.md` §3.

                No role check here either. `CoachMeetingSessionRow` renders only
                under `CoachMeetingsView`, which is already gated on
                `isCoachOrAdminView`; adding a second gate gives two that can
                drift apart. Asserted rather than duplicated (§4). */}
            <Link
              as={RouterLink}
              href={routePaths.meetingLiveSession(session.sessionId)}
              isStandalone
            >
              {/* The date is REQUIRED, not decorative: `astryx-api.md` forbids
                  `label` on a text link, so this visible text IS the accessible
                  name -- and a multi-session row would otherwise render several
                  links all named "Go live". The Cancel button beside it solves
                  the identical problem the same way. */}
              {`Go live — ${formatWeekdayDate(session.sessionDate)}`}
            </Link>
            {/* T605 -- gated on `isMeetingSessionReconcilable` (imported from
                `./ScheduleMeetingsDialog`, not reimplemented -- §6.2), which is
                STRICTER than the surrounding `status === 'scheduled'` block: a
                scheduled-but-already-started/expired session still gets
                Cancel (immediately above/below) but not Edit -- it is "not
                stranded," per the decisions log's own narration of this
                trade-off (`auto-mode-decisions.md:3770`, inside the section
                recording George's rulings, though this specific sentence is
                the log's own writing, not a quote from him): "it is not
                stranded, though -- it is still cancellable individually
                through the existing per-session Cancel." */}
            {isMeetingSessionReconcilable(session, new Date()) && (
              <Button
                variant="ghost"
                size="sm"
                style={MIN_TOUCH_TARGET_STYLE}
                label={`Edit ${formatWeekdayDate(session.sessionDate)} session`}
                onClick={() => onEditRequest(eventId, eventTitle, session)}
              />
            )}
            <Button
              variant="ghost"
              size="sm"
              style={MIN_TOUCH_TARGET_STYLE}
              // Includes the session's own date so a multi-session row's
              // several Cancel buttons are each unambiguous (both visually
              // and to assistive tech), unlike a bare "Cancel session".
              label={`Cancel ${formatWeekdayDate(session.sessionDate)} session`}
              onClick={() => onCancelRequest(eventId, eventTitle, session)}
            />
          </>
        )}
      </HStack>
    </HStack>
  );
}

function renderMeetingSessionDetailCell(
  row: CoachMeetingSessionDetailTableRow,
  onCancelRequest: (
    eventId: string,
    eventTitle: string,
    session: CoachMeetingSessionDetail,
  ) => void,
  // T605 -- threaded alongside `onCancelRequest` (§6.2 item 2).
  onEditRequest: (eventId: string, eventTitle: string, session: CoachMeetingSessionDetail) => void,
): ReactNode {
  return (
    <CoachMeetingSessionRow
      eventId={row.eventId}
      eventTitle={row.eventTitle}
      session={row.session}
      onCancelRequest={onCancelRequest}
      onEditRequest={onEditRequest}
      anchorId={sessionDetailAnchorId(row.eventId, row.session.sessionId)}
    />
  );
}

interface BuildCoachMeetingColumnsArgs {
  expandedEventIds: ReadonlySet<string>;
  onToggleExpand: (eventId: string) => void;
  onEdit: (row: CoachMeetingRow) => void;
  onCancelRequest: (
    eventId: string,
    eventTitle: string,
    session: CoachMeetingSessionDetail,
  ) => void;
  // T605 -- threaded alongside `onCancelRequest` (§6.2 item 3).
  onEditRequest: (eventId: string, eventTitle: string, session: CoachMeetingSessionDetail) => void;
  isNarrow: boolean;
}

/**
 * UXC-02/03/07/13 -- the ONE shared column factory both `CoachMeetingsSection`
 * instances (Upcoming, Past) call, so `resolveColumnWidths` (pure over the
 * column defs) produces byte-identical `<th>` widths for both `Table`s
 * (criterion 9) -- unlike `buildCoachOutreachColumns`, this row's content
 * mapping (§1 of the packet) is IDENTICAL for both buckets (no
 * "Planned"/"Logged" split -- "Scheduled"/"held" and "Expected"/"Attended"
 * both apply the same way to an Upcoming or a Past row), so this factory
 * takes no `bucket` parameter at all.
 *
 * Width budget (measured against this route's real available width at
 * 1440px -- see this task's own worker output for the exact
 * `clientWidth`/`scrollWidth` numbers): `expander` carries the unchanged
 * `Session details (N)` wording (Trap 3b "keep the wording" branch), wider
 * than T130's `Sessions (N)`; `date` carries recurrence chips (up to
 * `MON (18)` plus siblings) and the canceled `Badge`, so it needs more room
 * than T130's 150px; `actions` carries only the `Edit` chip, so it needs far
 * less than T130's 128px.
 */
function buildCoachMeetingColumns({
  expandedEventIds,
  onToggleExpand,
  onEdit,
  onCancelRequest,
  onEditRequest,
  isNarrow,
}: BuildCoachMeetingColumnsArgs): TableColumn<CoachMeetingTableRow>[] {
  if (isNarrow) {
    // UXC-13 (<768px): every desktop column collapses into one stacked card
    // column, exactly as `buildCoachOutreachColumns`'s `isNarrow` branch
    // does -- the fixed desktop columns sum to well over 375px, so without
    // this the page scrolls horizontally (forbidden).
    return [
      {
        key: 'card',
        header: '',
        width: proportional(1),
        renderCell: (row) => {
          if (row.kind === 'sessionDetail') {
            return renderMeetingSessionDetailCell(row, onCancelRequest, onEditRequest);
          }
          const isExpanded = expandedEventIds.has(row.row.eventId);
          return (
            <VStack gap={2}>
              <CoachMeetingTitleCell row={row.row} />
              <CoachMeetingDateCell summary={row.summary} />
              <HStack gap={4} wrap="wrap">
                <StatCell
                  label="Scheduled"
                  value={formatHoursLabel(row.summary.plannedHours)}
                  secondary={`${formatHoursLabel(row.summary.loggedHours)} held`}
                />
                <StatCell
                  label="Expected"
                  value={`${row.summary.expectedCt}`}
                  secondary={`Attended ${row.summary.attendedCt}`}
                />
              </HStack>
              <HStack gap={2} wrap="wrap" vAlign="center">
                <CoachMeetingExpanderButton
                  row={row.row}
                  isExpanded={isExpanded}
                  onToggleExpand={onToggleExpand}
                />
              </HStack>
              <CoachMeetingRowActions row={row.row} onEdit={onEdit} />
            </VStack>
          );
        },
      },
    ];
  }

  return [
    {
      key: 'expander',
      header: '',
      width: pixel(170),
      renderCell: (row) => {
        if (row.kind !== 'event') return null;
        const isExpanded = expandedEventIds.has(row.row.eventId);
        return (
          <CoachMeetingExpanderButton
            row={row.row}
            isExpanded={isExpanded}
            onToggleExpand={onToggleExpand}
          />
        );
      },
    },
    {
      key: 'date',
      header: 'Date',
      width: pixel(200),
      renderCell: (row) =>
        row.kind === 'event' ? <CoachMeetingDateCell summary={row.summary} /> : null,
    },
    {
      key: 'title',
      header: 'Meeting',
      width: proportional(2, { minWidth: 224 }),
      renderCell: (row) =>
        row.kind === 'event' ? (
          <CoachMeetingTitleCell row={row.row} />
        ) : (
          renderMeetingSessionDetailCell(row, onCancelRequest, onEditRequest)
        ),
    },
    {
      key: 'hours',
      header: '',
      width: pixel(130),
      align: 'end',
      renderCell: (row) => {
        if (row.kind !== 'event') return null;
        return (
          <StatCell
            label="Scheduled"
            value={formatHoursLabel(row.summary.plannedHours)}
            secondary={`${formatHoursLabel(row.summary.loggedHours)} held`}
          />
        );
      },
    },
    {
      key: 'count',
      header: '',
      width: pixel(158),
      align: 'end',
      renderCell: (row) => {
        if (row.kind !== 'event') return null;
        return (
          <StatCell
            label="Expected"
            value={`${row.summary.expectedCt}`}
            secondary={`Attended ${row.summary.attendedCt}`}
          />
        );
      },
    },
    {
      key: 'actions',
      header: '',
      width: pixel(80),
      renderCell: (row) =>
        row.kind === 'event' ? <CoachMeetingRowActions row={row.row} onEdit={onEdit} /> : null,
    },
  ];
}

function CoachMeetingsSection({
  title,
  rows,
  emptyDescription,
  expandedEventIds,
  onToggleExpand,
  onEdit,
  onCancelRequest,
  onEditRequest,
}: {
  title: string;
  rows: CoachMeetingRow[];
  emptyDescription: string;
  expandedEventIds: ReadonlySet<string>;
  onToggleExpand: (eventId: string) => void;
  onEdit: (row: CoachMeetingRow) => void;
  onCancelRequest: (
    eventId: string,
    eventTitle: string,
    session: CoachMeetingSessionDetail,
  ) => void;
  // T605 -- threaded alongside `onCancelRequest` (§6.2 item 5).
  onEditRequest: (eventId: string, eventTitle: string, session: CoachMeetingSessionDetail) => void;
}): ReactNode {
  // T129/UXC-01: stable id for this section's `Heading`, so the alternating
  // Table/EmptyState below gets the heading as its accessible name via
  // `aria-labelledby` on a wrapping `<div role="group">`, instead of relying
  // on `Table`'s own scroll wrapper (which hardcodes a generic
  // `role="group" aria-label="Table"`, `Table.tsx:160-161` -- not
  // bucket-specific). This component renders twice (Upcoming, Past), so
  // each call gets its own id. CHECKER FIX (rework of T129, MAJOR): see
  // `CoachHome.tsx`'s own module doc for why the wrapper is a plain
  // `<div role="group">`, not `Section` (full-bleed margin + no nameable
  // role).
  const headingId = useId();
  const isNarrow = useIsNarrowViewport();

  const tableRows = useMemo(
    () => buildCoachMeetingTableRows(rows, expandedEventIds),
    [rows, expandedEventIds],
  );

  const columns = useMemo(
    () =>
      buildCoachMeetingColumns({
        expandedEventIds,
        onToggleExpand,
        onEdit,
        onCancelRequest,
        onEditRequest,
        isNarrow,
      }),
    [expandedEventIds, onToggleExpand, onEdit, onCancelRequest, onEditRequest, isNarrow],
  );

  return (
    <VStack gap={3}>
      <Heading level={2} id={headingId}>
        {title}
      </Heading>
      <div role="group" aria-labelledby={headingId}>
        {rows.length === 0 ? (
          <EmptyState
            headingLevel={3}
            title={`No ${title.toLowerCase()} meetings`}
            description={emptyDescription}
            // T122 (module doc #10f, UXD-05(b)) -- compact: this is a
            // SUB-section of the page, never the only content on it.
            isCompact
          />
        ) : (
          <Table
            data={tableRows}
            columns={columns}
            idKey="id"
            density="compact"
            dividers="rows"
            hasHover
          />
        )}
      </div>
    </VStack>
  );
}

/** T096 (module doc #7c) -- real success/error messaging for Cancel and
 * Schedule, same "success Banner + error Banner, dismissable, same
 * `feedback` slot" pattern `StudentsTab.tsx`'s own `FeedbackBanner` (T089)
 * already established. */
interface FeedbackBanner {
  status: 'success' | 'error';
  title: string;
  description: string;
}

export interface CoachMeetingsViewProps {
  loadData: LoadCoachMeetingsDataFn;
  /** T096 (module doc #7c). Defaults to a real `event_sessions.status =
   * 'canceled'` mutation (`cancelMeetingSession`,
   * `../../lib/supabase/loaders/meetings.ts`). */
  onCancelSession: CancelMeetingSessionFn;
  /** T096 (module doc #7a). Passed straight through to
   * `<ScheduleMeetingsDialog onCreateMeetings={...} />`; defaults to a real
   * `events`/`event_sessions` insert (`createMeetings`, same loader module). */
  onCreateMeetings: OnCreateMeetingsFn;
  /** T510 (module doc #7b). Passed straight through to
   * `<ScheduleMeetingsDialog onSaveMeetingSeries={...} />`; defaults to a real
   * future-forward `events`/`event_sessions` reconciliation (`saveMeetingSeries`,
   * same loader module). */
  onSaveMeetingSeries: OnSaveMeetingSeriesFn;
  /** T605 (§6.2/§6.3). Passed straight through to
   * `<EditMeetingSessionDialog onSaveMeetingSession={...} />` (via
   * `handleSaveMeetingSessionSubmit` below); defaults to a real guarded,
   * in-place `event_sessions` update (`saveMeetingSession`, same loader
   * module). Mirrors `onSaveMeetingSeries`'s own identical four-point thread
   * exactly (§6.2). */
  onSaveMeetingSession: OnSaveMeetingSessionFn;
}

/** T122 (module doc #10d) -- Cancel now targets one SESSION within one
 * EVENT row, not a whole flat row. */
interface CancelTarget {
  eventId: string;
  eventTitle: string;
  session: CoachMeetingSessionDetail;
}

/** T605 -- which session (if any) `<EditMeetingSessionDialog>` is currently
 * editing; `null` => closed. Unlike `ScheduleMeetingsDialog`'s shared
 * create/edit instance (`isScheduleDialogOpen` + `editTarget`), this new
 * dialog has exactly one mode, so `editSessionTarget !== null` IS its own
 * `isOpen` -- same shape `cancelTarget`/`AlertDialog` below already use
 * (§6.2). */
interface EditSessionTarget {
  eventId: string;
  eventTitle: string;
  session: CoachMeetingSessionDetail;
  /** Every OTHER session's own `sessionDate` on this same event, any status
   * (§6.5's `sessionDateCollidesWithSibling`/§3.5's duplicate-date guard). */
  otherSessionDates: readonly string[];
}

export function CoachMeetingsView({
  loadData,
  onCancelSession,
  onCreateMeetings,
  onSaveMeetingSeries,
  onSaveMeetingSession,
}: CoachMeetingsViewProps): ReactNode {
  const loadState = useLoadState(loadData, [loadData]);
  const [rows, setRows] = useState<CoachMeetingRow[]>([]);
  // T147 -- real teams, populated the same two places `rows` is (the
  // initial-load effect below and the post-create reload,
  // `handleCreateMeetingsSubmit`), threaded to `<ScheduleMeetingsDialog>`'s
  // own `teams` prop.
  const [teams, setTeams] = useState<readonly Team[]>([]);
  const [cancelTarget, setCancelTarget] = useState<CancelTarget | null>(null);
  // T605 -- drives the one rendered `<EditMeetingSessionDialog>` instance
  // (§6.2).
  const [editSessionTarget, setEditSessionTarget] = useState<EditSessionTarget | null>(null);
  // T096 (module doc #7a) -- drives the one rendered `<ScheduleMeetingsDialog>`
  // instance, shared by both CREATE mode (`editTarget === null`) and T510's
  // real EDIT mode (`editTarget !== null`, module doc #7b).
  const [isScheduleDialogOpen, setIsScheduleDialogOpen] = useState(false);
  // T510 (module doc #7b) -- which row (if any) `<ScheduleMeetingsDialog>` is
  // currently editing; `null` => create mode. Mirrors `OutreachList.tsx`'s own
  // `editingTarget` state.
  const [editTarget, setEditTarget] = useState<CoachMeetingRow | null>(null);
  const [feedback, setFeedback] = useState<FeedbackBanner | null>(null);
  // T135 (Table migration, Trap 1/2) -- ONE expansion-state set for BOTH the
  // Upcoming and Past `CoachMeetingsSection` instances, deliberately NOT one
  // per instance (T130's own `OutreachList.tsx` placement, which does not
  // apply here -- see this file's own Table-migration module doc above).
  // Confirming a cancel can move a row from Upcoming to Past
  // (`handleConfirmCancel` below, `partitionCoachMeetingRows`'s own doc); a
  // per-section `Set` would silently re-collapse the row when it lands in
  // its new section's own, separately-mounted `Table`. Lifting the state
  // here means the SAME `Set` (and the same expanded-id membership) survives
  // the bucket move.
  const [expandedEventIds, setExpandedEventIds] = useState<ReadonlySet<string>>(() => new Set());
  const toggleExpand = useCallback((eventId: string): void => {
    setExpandedEventIds((previous) => {
      const next = new Set(previous);
      if (next.has(eventId)) next.delete(eventId);
      else next.add(eventId);
      return next;
    });
  }, []);

  useEffect(() => {
    if (loadState.status === 'success') {
      setRows(loadState.data.rows);
      setTeams(loadState.data.teams);
    }
  }, [loadState]);

  // T122 (module doc #10c) -- `partitionByStatus` no longer applies to
  // grouped event rows; see `partitionCoachMeetingRows`'s own doc.
  const { upcoming, past } = useMemo(() => partitionCoachMeetingRows(rows), [rows]);

  function openScheduleDialog(): void {
    setEditTarget(null);
    setIsScheduleDialogOpen(true);
  }

  // T510 (module doc #7b) -- `ScheduleMeetingsDialog.tsx` now has a real edit
  // mode; opens the SAME dialog instance already mounted for create, in EDIT
  // mode for this row.
  function openEditDialog(row: CoachMeetingRow): void {
    setEditTarget(row);
    setIsScheduleDialogOpen(true);
  }

  // T605 (§6.2) -- `rows` is already in scope; no new query, no widening of
  // `CoachMeetingSessionDetailTableRow`. `otherSessionDates` is every OTHER
  // session's own `sessionDate` on this same event, any status (mirrors
  // `computeMeetingSeriesReconcilePlan`'s own `allExistingDates` -- ANY
  // status, not just scheduled).
  function handleEditRequest(
    eventId: string,
    eventTitle: string,
    session: CoachMeetingSessionDetail,
  ): void {
    const row = rows.find((r) => r.eventId === eventId);
    const otherSessionDates = (row?.sessions ?? [])
      .filter((s) => s.sessionId !== session.sessionId)
      .map((s) => s.sessionDate);
    setEditSessionTarget({ eventId, eventTitle, session, otherSessionDates });
  }

  // T096 (module doc #7c) -- real mutation, optimistic update + rollback on
  // failure, mirroring `StudentsTab.tsx`'s own `handleConfirmDeactivate`
  // (T089) shape. T122 (module doc #10d) -- the optimistic flip/rollback now
  // targets one SESSION nested inside its EVENT row, not a flat row; the
  // mutation itself (`onCancelSession(sessionId)`) is byte-for-byte
  // unchanged.
  async function handleConfirmCancel(): Promise<void> {
    if (cancelTarget === null) return;
    const target = cancelTarget;
    setRows((prev) =>
      prev.map((row) =>
        row.eventId === target.eventId
          ? {
              ...row,
              sessions: row.sessions.map((session) =>
                session.sessionId === target.session.sessionId
                  ? { ...session, status: 'canceled' }
                  : session,
              ),
            }
          : row,
      ),
    );
    setCancelTarget(null);
    try {
      await onCancelSession(target.session.sessionId);
      setFeedback({
        status: 'success',
        title: 'Meeting session canceled',
        description: `"${target.eventTitle}" on ${formatWeekdayDate(target.session.sessionDate)} is marked canceled. No attendance will be recorded for it.`,
      });
    } catch (error) {
      setRows((prev) =>
        prev.map((row) =>
          row.eventId === target.eventId
            ? {
                ...row,
                sessions: row.sessions.map((session) =>
                  session.sessionId === target.session.sessionId
                    ? { ...session, status: target.session.status }
                    : session,
                ),
              }
            : row,
        ),
      );
      setFeedback({
        status: 'error',
        title: "Couldn't cancel meeting",
        description: isSupabaseLoaderError(error)
          ? error.message
          : `Something went wrong canceling "${target.eventTitle}". Try again in a moment.`,
      });
    }
  }

  // T096 (module doc #7a) -- real `onCreateMeetings` wiring. Reloads `rows`
  // from `loadData()` on success (a full reload, not a client-side merge --
  // see module doc #7a for why).
  async function handleCreateMeetingsSubmit(payload: CreateMeetingsPayload): Promise<void> {
    await onCreateMeetings(payload);
    const sessionCount = payload.sessions.length;
    try {
      const fresh = await loadData();
      setRows(fresh.rows);
      setTeams(fresh.teams);
      setFeedback({
        status: 'success',
        title: 'Meetings scheduled',
        description: `${sessionCount} meeting${sessionCount === 1 ? '' : 's'} scheduled.`,
      });
    } catch {
      // The create itself already succeeded (this catch only guards the
      // follow-up reload) -- disclosed, not fatal: `rows` just won't reflect
      // the new meeting(s) until the next successful load/retry.
      setFeedback({
        status: 'success',
        title: 'Meetings scheduled',
        description: `${sessionCount} meeting${sessionCount === 1 ? '' : 's'} scheduled. Refresh the page to see ${sessionCount === 1 ? 'it' : 'them'} in the list below.`,
      });
    }
  }

  // T510 (module doc #7b) -- real `onSaveMeetingSeries` wiring, mirroring
  // `handleCreateMeetingsSubmit`'s own reload-and-feedback shape.
  async function handleSaveMeetingSeriesSubmit(payload: SaveMeetingSeriesPayload): Promise<void> {
    await onSaveMeetingSeries(payload);
    try {
      const fresh = await loadData();
      setRows(fresh.rows);
      setTeams(fresh.teams);
      setFeedback({
        status: 'success',
        title: 'Meeting series updated',
        description: 'This meeting series was updated.',
      });
    } catch {
      // The save itself already succeeded (this catch only guards the
      // follow-up reload) -- disclosed, not fatal: `rows` just won't reflect
      // the change until the next successful load/retry.
      setFeedback({
        status: 'success',
        title: 'Meeting series updated',
        description: 'This meeting series was updated. Refresh the page to see the change.',
      });
    }
  }

  // T605 (§6.2) -- real `onSaveMeetingSession` wiring, mirroring
  // `handleSaveMeetingSeriesSubmit`'s own identical reload-and-feedback shape
  // immediately above.
  async function handleSaveMeetingSessionSubmit(payload: SaveMeetingSessionPayload): Promise<void> {
    await onSaveMeetingSession(payload);
    try {
      const fresh = await loadData();
      setRows(fresh.rows);
      setTeams(fresh.teams);
      setFeedback({
        status: 'success',
        title: 'Meeting session updated',
        description: 'This meeting session was updated.',
      });
    } catch {
      // The save itself already succeeded (this catch only guards the
      // follow-up reload) -- disclosed, not fatal: `rows` just won't reflect
      // the change until the next successful load/retry.
      setFeedback({
        status: 'success',
        title: 'Meeting session updated',
        description: 'This meeting session was updated. Refresh the page to see the change.',
      });
    }
  }

  if (loadState.status === 'loading') {
    return (
      <VStack gap={6} aria-busy="true">
        <VisuallyHidden as="div" role="status">
          Loading meetings…
        </VisuallyHidden>
        <HStack hAlign="between" vAlign="center" wrap="wrap" gap={3}>
          <Skeleton width={140} height={28} index={0} />
          <Skeleton width={160} height={32} index={1} />
        </HStack>
        <VStack gap={3}>
          <Skeleton width={100} height={20} index={2} />
          <VStack gap={2}>
            {[0, 1, 2].map((row) => (
              <HStack key={row} gap={4} vAlign="center">
                <Skeleton width={220} height={16} index={row * 2 + 3} />
                <Skeleton width={80} height={16} index={row * 2 + 4} />
              </HStack>
            ))}
          </VStack>
        </VStack>
      </VStack>
    );
  }

  if (loadState.status === 'error') {
    return (
      <Banner
        status="error"
        title="Couldn't load meetings"
        description="Something went wrong loading this season's meetings. Try refreshing the page."
        endContent={<Button variant="ghost" label="Retry" onClick={loadState.retry} />}
      />
    );
  }

  const hasAnyMeetings = rows.length > 0;

  return (
    <VStack gap={6}>
      <HStack hAlign="between" vAlign="center" wrap="wrap" gap={3}>
        <Heading level={1}>Meetings</Heading>
        <Button label="Schedule meetings" variant="primary" onClick={openScheduleDialog} />
      </HStack>

      {feedback !== null && (
        <Banner
          status={feedback.status}
          title={feedback.title}
          description={feedback.description}
          isDismissable
          onDismiss={() => setFeedback(null)}
        />
      )}

      {!hasAnyMeetings ? (
        <EmptyState
          headingLevel={2}
          // DES-15 verbatim (PRD line 212): "No meetings scheduled. Set up
          // your weekly build meetings once and check-in takes care of
          // itself." -- title carries the first sentence, description the
          // second; concatenated they reproduce the PRD text exactly.
          title="No meetings scheduled."
          description="Set up your weekly build meetings once and check-in takes care of itself."
          actions={
            <Button label="Schedule meetings" variant="primary" onClick={openScheduleDialog} />
          }
        />
      ) : (
        <>
          <CoachMeetingsSection
            title="Upcoming"
            rows={upcoming}
            emptyDescription="No meetings are currently scheduled."
            expandedEventIds={expandedEventIds}
            onToggleExpand={toggleExpand}
            onEdit={openEditDialog}
            onCancelRequest={(eventId, eventTitle, session) =>
              setCancelTarget({ eventId, eventTitle, session })
            }
            onEditRequest={handleEditRequest}
          />
          <CoachMeetingsSection
            title="Past"
            rows={past}
            emptyDescription="Completed and canceled meetings will show up here."
            expandedEventIds={expandedEventIds}
            onToggleExpand={toggleExpand}
            onEdit={openEditDialog}
            onCancelRequest={(eventId, eventTitle, session) =>
              setCancelTarget({ eventId, eventTitle, session })
            }
            onEditRequest={handleEditRequest}
          />
        </>
      )}

      <AlertDialog
        isOpen={cancelTarget !== null}
        onOpenChange={(isOpen) => {
          if (!isOpen) setCancelTarget(null);
        }}
        title={
          cancelTarget !== null
            ? `Cancel "${cancelTarget.eventTitle}" on ${formatWeekdayDate(cancelTarget.session.sessionDate)}?`
            : ''
        }
        description="This marks the session canceled. Students won't be expected to attend, and no attendance will be recorded for it."
        actionLabel="Cancel session"
        onAction={() => {
          void handleConfirmCancel();
        }}
      />

      {/* T096 (module doc #7a) -- `ScheduleMeetingsDialog.tsx` (T031,
          already Passed, already built) wired into this page for the first
          time. T147: `teams` now real too -- `loaders/meetings.ts`'s
          `makeLoadCoachMeetingsData` already fetched this list for its own
          per-row team-scope label; it is now threaded through
          `CoachMeetingsData`/this view's own `teams` state instead of the
          dialog falling back to its own `DEFAULT_TEAMS` fixture
          (`'team-ravens'`/`'team-titans'`, non-uuid strings that failed the
          real `events.team_ids uuid[]` insert -- the report that blocked
          meeting creation outright). No new query, no new round trip.
          T510 (module doc #7b) -- ONE dialog instance now serves BOTH create
          (`editTarget === null`) and edit (`editTarget !== null`) mode,
          mirroring `OutreachList.tsx`'s own `initialData` ternary shape.
          `onOpenChange` also clears `editTarget` on close, mirroring
          `OutreachList.tsx:3505-3508`, so the next "Schedule meetings" open
          never inherits a stale edit target. */}
      <ScheduleMeetingsDialog
        isOpen={isScheduleDialogOpen}
        onOpenChange={(nextIsOpen) => {
          setIsScheduleDialogOpen(nextIsOpen);
          if (!nextIsOpen) setEditTarget(null);
        }}
        teams={teams}
        onCreateMeetings={handleCreateMeetingsSubmit}
        initialData={
          editTarget !== null
            ? ({
                eventId: editTarget.eventId,
                title: editTarget.title,
                teamIds: editTarget.teamIds ?? null,
                locationName: editTarget.locationName,
                description: editTarget.description ?? '',
                sessions: editTarget.sessions.map((s) => ({
                  sessionId: s.sessionId,
                  sessionDate: s.sessionDate,
                  startsAt: s.startsAt,
                  endsAt: s.endsAt,
                  status: s.status,
                })),
              } satisfies EditMeetingSeriesInitialData)
            : undefined
        }
        onSaveMeetingSeries={handleSaveMeetingSeriesSubmit}
      />

      {/* T605 (§6.2) -- a SEPARATE, single-purpose dialog (not a second mode
          on `ScheduleMeetingsDialog`, which owns a series-wide schedule-mode
          model this fixed-identity single-session edit has no use for -- §6.4).
          `editSessionTarget !== null` IS its own `isOpen`, same shape the
          `cancelTarget`/`AlertDialog` pair above already uses -- this dialog
          has exactly one mode, unlike `ScheduleMeetingsDialog`'s shared
          create/edit instance. "Cancel this meeting" inside this dialog
          triggers the SAME `cancelTarget` state/`AlertDialog` above (§3.4) --
          no second confirmation, no second copy of that text, no second call
          to `onCancelSession`. */}
      <EditMeetingSessionDialog
        isOpen={editSessionTarget !== null}
        onOpenChange={(isOpen) => {
          if (!isOpen) setEditSessionTarget(null);
        }}
        initialData={
          editSessionTarget !== null
            ? ({
                eventId: editSessionTarget.eventId,
                eventTitle: editSessionTarget.eventTitle,
                session: {
                  sessionId: editSessionTarget.session.sessionId,
                  sessionDate: editSessionTarget.session.sessionDate,
                  startsAt: editSessionTarget.session.startsAt,
                  endsAt: editSessionTarget.session.endsAt,
                  notes: editSessionTarget.session.notes,
                },
                otherSessionDates: editSessionTarget.otherSessionDates,
              } satisfies EditMeetingSessionInitialData)
            : null
        }
        onSaveMeetingSession={handleSaveMeetingSessionSubmit}
        onRequestCancelSession={() => {
          if (editSessionTarget === null) return;
          setCancelTarget({
            eventId: editSessionTarget.eventId,
            eventTitle: editSessionTarget.eventTitle,
            session: editSessionTarget.session,
          });
          setEditSessionTarget(null);
        }}
      />
    </VStack>
  );
}
