/**
 * @file CoachMeetingsView.tsx
 * @position GAM-444 Stage B moved this file's original contents out of
 *   `src/pages/meetings/MeetingsList.tsx` byte-identical. **GAM-452
 *   (this ticket) is the assembly ticket** that replaces the T122/T135
 *   Table-based Upcoming/Past row UI this file used to render with the
 *   redesigned coach series-card page (PRD's dated deviation blockquote
 *   above MTG-01, `docs/swarm/VOLT_Portal_PRD.md:294-320`, MTG-01a/b) --
 *   composing four already-merged sibling components
 *   (`SeriesCard.tsx` GAM-447, `MeetingsRail.tsx` GAM-449, `SchedulePanel.tsx`
 *   GAM-448 wrapping `SessionRow.tsx`, `overlap.ts` GAM-450) against this
 *   file's own pre-existing load/mutation/dialog wiring, which is UNCHANGED
 *   in kind (same seams, same optimistic-update-with-rollback shape) even
 *   though almost every render below it is new.
 *
 *   `BadgeVariant`/`LoadState<T>`/`useLoadState` are duplicated here AND in
 *   `../student/StudentMeetingsView.tsx` (no shared-hook home is in either
 *   ticket's Allowed Files -- same "copy it" posture this file's own
 *   `MIN_TOUCH_TARGET_STYLE`-class constants already used).
 *
 * -----------------------------------------------------------------------
 * 1. Ground truth -- `event_sessions`/`events`/`attendance` column shapes
 *    (unchanged by this ticket), cited directly from
 *    `supabase/migrations/20260717000000_scheduling_attendance.sql`:
 *
 *    `events` (lines 33-48): id, season_id, type (check: 'meeting' |
 *    'outreach' | 'competition'), title, description, location_name,
 *    address, team_ids uuid[] NULL (null = all teams), counts_participation,
 *    counts_volunteer_hours, adult_volunteers_count, adult_volunteer_hours,
 *    created_by, created_at.
 *
 *    `event_sessions` (lines 53-63): id, event_id, session_date (date),
 *    starts_at (timestamptz), ends_at (timestamptz), status (check:
 *    'scheduled' | 'completed' | 'canceled'), people_reached, notes,
 *    created_at.
 *
 *    `attendance` (lines 82-95): id, session_id, student_id, status (check:
 *    'present' | 'late' | 'excused' | 'absent'), check_in_at, check_out_at,
 *    hours_override, method, recorded_by, updated_at, created_at.
 *
 * -----------------------------------------------------------------------
 * 2. NAV-07 -- this route shows ONLY meeting-type events, never outreach.
 *    `coachModel.ts`'s `meetingEventIdsOf`/`buildCoachMeetingRows` remain the
 *    ONLY type predicate gating what reaches `rows` below; this file applies
 *    no filtering of its own.
 *
 * -----------------------------------------------------------------------
 * 3. §0d/§9a (D014, GAM-460) -- `attendancePct` is a passthrough, rendered by
 *    `SeriesCard.tsx` from `coachModel.ts`'s `buildSeriesCardModels`
 *    (`row.attendancePct ?? null`, never `?? 0`, never arithmetic). See that
 *    builder's own doc comment for the full disclosed-risk record (D014's
 *    inversion, GAM-460's still-`Backlog` mitigation). This file performs no
 *    percentage arithmetic anywhere.
 *
 * -----------------------------------------------------------------------
 * 4. BEH-08/NFR-09 -- every date/time rendered by the composed children
 *    below (`SeriesCard`, `MeetingsRail`, `SchedulePanel`/`SessionRow`)
 *    already goes through `src/lib/meetings/format.ts`'s Chicago-pinned
 *    formatters; this file's own subtitle (§6 below) and the Go-live link
 *    copy (§8) reuse `formatWeekdayDate` rather than a new formatter.
 *
 * -----------------------------------------------------------------------
 * 5. Composition (packet §3). PRD MTG-01a: *"start from the installed
 *    Astryx `Card Grid` template ... and adapt it -- do not hand-build the
 *    grid."* Verified installed and generatable this task (`npx astryx
 *    template library` emits real, importable JSX using
 *    `@astryxdesign/core/Grid`'s `Grid`/`GridSpan`) -- adapted here as a
 *    responsive `Grid columns={{minWidth}}` of `<SeriesCard>`s, one per
 *    `CoachMeetingRow`, NEVER a hand-rolled CSS grid (`astryx-api.md:98-151`
 *    Don'ts). §9b (dispatch addendum) withdrew the `Grouped Table` template
 *    directive -- it does not exist as an installed/generatable template
 *    (round 2's own four-site proof) -- so the rail/card split below is a
 *    second `Grid` (two-up, responsive `{minWidth, max: 2}`, the same shape
 *    `CoachHome.tsx:3021` already ships for its own Next-up/Activity-feed
 *    pairing), and the per-card drill-out is a `<GridSpan columns="full">`
 *    row inserted immediately after the selected card -- `astryx-api.md`'s
 *    own Grid doc example (`<GridSpan columns={2}>Wide item</GridSpan>`)
 *    is the documented precedent for exactly this "one item spans the whole
 *    row" shape.
 *
 *    Focus wiring (packet §3b): `focus: MeetingsFocusRequest | null` is
 *    lifted to this component (frozen shape, never reshaped). A rail agenda
 *    click or a card's own "View full schedule" button both call
 *    `handleFocusChange`, which (a) sets `focus`, (b) switches the
 *    Active/Finished tab to whichever bucket actually contains that
 *    `eventId` (so a rail click on a Finished series' session still reveals
 *    its card), and (c) the owning card's `<SchedulePanel
 *    focusRequest={focus}>` already opens the right month tab and expands
 *    the right session (`SchedulePanel.tsx:363-378`) -- only the scroll+
 *    focus below is new work. `panelRefs` (a plain `Map`, not React state --
 *    it never needs to trigger a re-render) holds one `tabIndex={-1}`
 *    wrapper `<div>` ref per rendered card/panel pair; the effect below
 *    pairs `scrollIntoView` with REAL programmatic `.focus()` on that div
 *    (`StudentHome.tsx:1608-1615`'s own precedent and reasoning:
 *    `scrollIntoView` alone never moves keyboard/screen-reader focus). jsdom
 *    has no `Element.prototype.scrollIntoView` -- stubbed locally in this
 *    file's own test, not `src/test-setup.ts` (Forbidden).
 *
 * -----------------------------------------------------------------------
 * 6. Active/Finished (packet §2) reuses `partitionCoachMeetingRows`
 *    (`coachModel.ts:415-427`) verbatim, renamed at this call site only --
 *    `upcoming` -> Active, `past` -> Finished. The header subtitle
 *    (`buildMeetingsSubtitle` below) is plain counts -- active series count,
 *    non-canceled sessions falling in the Chicago `[today, today+6]` window
 *    across every row -- computed fresh on every render from
 *    `todayIsoChicago()` (a local copy, same "no shared home yet" posture
 *    `MeetingsRail.tsx`'s own identically-named private function already
 *    uses; GAM-477 is the follow-up that would unify these). No timer, no
 *    interval, no unit finer than a day: item 17's own five-point compliance
 *    test (`meetings-design` skill).
 *
 * -----------------------------------------------------------------------
 * 7. §9d -- the roster ships empty this ticket (packet §3d), but the write
 *    seams are real, not stubs: `onSetAttendanceStatus`/`onClearAttendance`
 *    default to the real `setAttendanceStatus`/`clearAttendanceStatus`
 *    (`../../../lib/supabase/loaders/attendance.ts:588`/`:653`), and
 *    `recordedBy` is this coach's own real `useAuth().user.id`. With
 *    `roster` undefined, `SessionRow.tsx:368-375` renders its own "No roster
 *    recorded" empty state INSTEAD of roster rows, so `AttendanceChips`
 *    never mounts at all this ticket (not "inert chips" -- there is no
 *    control to be inert). The roster-loader ticket (still unfiled/Backlog)
 *    needs no edit here once it ships -- this file already threads every
 *    other seam `SchedulePanel` declares.
 *
 * -----------------------------------------------------------------------
 * 8. T511 (packet §4/§9c) -- the Go-live link. `SessionRow.tsx` (frozen,
 *    Forbidden) renders no such link, so it is rendered from THIS file,
 *    beside each selected card's drill-out panel, one per still-`scheduled`
 *    session in that row (not month-filtered -- independent of
 *    `SchedulePanel`'s own uncontrolled month-tab state, which this file
 *    does not lift, so this stays correct regardless of which month tab is
 *    open). This was the least-file-boundary-intrusive of three options the
 *    round-2 gate offered (packet §8.2) -- the alternative (rendering it
 *    from `SessionRow.tsx`) would require widening a Forbidden file.
 *
 * -----------------------------------------------------------------------
 * 9. §3d/§0c -- overlap badges. `buildOverlapIndex` (GAM-450,
 *    `overlap.ts:7-10`'s own literal call site) is built ONCE from `rows`
 *    and passed to all three sites it can reach from here (`MeetingsRail`,
 *    `SchedulePanel`); the series-card's own count badge sums that same
 *    index across its own row's sessions. No page-level overlap banner
 *    (owner ruling, `meetings-design` skill "Overlap badges" -- two series
 *    at the same time is intentional on this team).
 *
 * -----------------------------------------------------------------------
 * 10. Series color (`--color-series-1…8`) does not exist in `src/theme/
 *    volt.ts` (GAM-466 unmerged, zero grep hits) -- `paletteIndexForEventId`
 *    (`MeetingsRail.tsx:279`, injected into `coachModel.ts`'s
 *    `buildSeriesCardModels` at this call site, never imported into that
 *    pure model module directly -- packet §1's own "inject, do not import"
 *    instruction) is the only palette computation in this file; every
 *    swatch renders neutral until GAM-466 lands real hues.
 *
 * -----------------------------------------------------------------------
 * 11. DES-12 four states (packet §5), all reached from `useLoadState`
 *    (§13 below): loading (`Skeleton` preview) / error (`Banner` + Retry) /
 *    empty (`hasAnyMeetings === false`, DES-15's exact copy, unchanged from
 *    before this ticket) / populated (the composition above). A populated
 *    page whose Active AND Finished buckets are both empty cannot occur --
 *    `partitionCoachMeetingRows` places every row in exactly one bucket --
 *    so no third "populated but both tabs empty" state needs inventing.
 *
 * -----------------------------------------------------------------------
 * 12. Astryx prop sourcing (constitution item 2), this file's own JSX only
 *    (composed children cite their own props in their own files):
 *  - `Grid`/`GridSpan` (astryx-api.md:98-151): `columns`, `gap` on `Grid`;
 *    `columns="full"` on `GridSpan`.
 *  - `TabList`/`Tab` (astryx-api.md:2003-2023 Props): `value`, `onChange`
 *    on `TabList`; `value`, `label` on `Tab`.
 *  - `Heading`/`Text`/`HStack`/`VStack`: unchanged usage from before this
 *    ticket (see prior module doc, still accurate for these primitives).
 *  - `Link` (astryx-api.md Link section, unchanged from T511's own original
 *    citation): `as={RouterLink}`, `href`, `isStandalone`, visible text as
 *    the accessible name (no `label` on a text link).
 *  - `Skeleton`/`Banner`/`EmptyState`/`Button`/`AlertDialog`: unchanged
 *    usage from before this ticket.
 *  - `VisuallyHidden`: unchanged (`role="status"` pass-through, same
 *    precedent this file already established pre-ticket).
 *
 * -----------------------------------------------------------------------
 * 13. `guards.tsx` `Role` vocabulary / `useAuth()` -- unchanged from before
 *    this ticket (`isCoachOrAdminView` gating happens one level up in
 *    `MeetingsList.tsx`); `useAuth()` is called directly in THIS file now,
 *    new to this ticket, solely to resolve `recordedBy` (§7 above) --
 *    `CoachMeetingsView` only ever renders inside the coach/admin branch, so
 *    `canSetExcused` (MTG-12) is unconditionally `true` here (mirrors
 *    `LiveConsole.tsx:987`'s own `user.role === 'coach' || 'admin'`
 *    resolution, simplified since that disjunction is this component's own
 *    mount precondition, not something it re-derives).
 */
import { Fragment, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  AlertDialog,
  Banner,
  Button,
  EmptyState,
  Grid,
  GridSpan,
  Heading,
  HStack,
  Link,
  Skeleton,
  Tab,
  TabList,
  Text,
  VisuallyHidden,
  VStack,
} from '@astryxdesign/core';
import { Link as RouterLink } from 'react-router-dom';
// T511 -- `routePaths` is IMPORT-ONLY here (the route already exists and needs
// no change). `router.tsx` loads every page via `lazy(() => import(...))`, so a
// page importing this back from it is not a cycle -- the same idiom
// `LiveConsole.tsx` and `Kiosk.tsx` already use.
import { routePaths } from '../../../app/router';
import { useAuth } from '../../../app/guards';
import { useActiveSeason } from '../../../app/SeasonProvider';
import { isSupabaseLoaderError } from '../../../lib/supabase';
import {
  clearAttendanceStatus,
  setAttendanceStatus,
} from '../../../lib/supabase/loaders/attendance';
import {
  ScheduleMeetingsDialog,
  type CreateMeetingsPayload,
  type EditMeetingSeriesInitialData,
  type OnCreateMeetingsFn,
  type OnSaveMeetingSeriesFn,
  type SaveMeetingSeriesPayload,
} from '../ScheduleMeetingsDialog';
// T605 -- the per-session edit dialog. This file OWNS the mount/wiring; the
// dialog file owns its own payload/fn types.
import {
  EditMeetingSessionDialog,
  type EditMeetingSessionInitialData,
  type OnSaveMeetingSessionFn,
  type SaveMeetingSessionPayload,
} from '../EditMeetingSessionDialog';
import { CHICAGO_TIME_ZONE, formatWeekdayDate } from '../../../lib/meetings/format';
import type {
  CancelMeetingSessionFn,
  CoachMeetingRow,
  CoachMeetingSessionDetail,
  LoadCoachMeetingsDataFn,
  MeetingsFocusRequest,
  Team,
} from '../../../lib/meetings/types';
import { buildSeriesCardModels, partitionCoachMeetingRows } from '../../../lib/meetings/coachModel';
import { buildOverlapIndex } from '../../../lib/meetings/overlap';
import { SeriesCard } from './SeriesCard';
import { MeetingsRail, paletteIndexForEventId } from './MeetingsRail';
import { SchedulePanel } from './SchedulePanel';

// ---------------------------------------------------------------------------
// Generic DES-12 load-state hook -- unchanged from before this ticket.
// ---------------------------------------------------------------------------

type LoadState<T> =
  | { status: 'loading' }
  | { status: 'error'; error: unknown; retry: () => void }
  | { status: 'success'; data: T };

function useLoadState<T>(load: () => Promise<T>, deps: readonly unknown[]): LoadState<T> {
  const [state, setState] = useState<LoadState<T>>({ status: 'loading' });
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
// §6 -- subtitle: plain counts, Chicago calendar days, computed fresh at
// render, no timer/interval, no unit finer than a day (item 17).
// ---------------------------------------------------------------------------

const CHICAGO_DATE_ONLY_FORMATTER = new Intl.DateTimeFormat('en-CA', {
  timeZone: CHICAGO_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/** Local copy, not an import -- `MeetingsRail.tsx`'s own identically-named
 * private function is the same "no shared home yet" situation (GAM-477 is
 * the follow-up that would unify these). */
function todayIsoChicago(): string {
  return CHICAGO_DATE_ONLY_FORMATTER.format(new Date());
}

function addDaysIso(dateIso: string, days: number): string {
  const [year, month, day] = dateIso.split('-').map(Number);
  const next = new Date(Date.UTC(year, month - 1, day));
  next.setUTCDate(next.getUTCDate() + days);
  return next.toISOString().slice(0, 10);
}

/** "N active series · M sessions in the next 7 days" -- plain counts only,
 * no countdown/urgency copy (item 17, BLOCKER). The 7-day window is
 * `[todayIsoChicago(), todayIsoChicago()+6]` inclusive (7 calendar days),
 * counting every non-canceled session across every row regardless of tab. */
function buildMeetingsSubtitle(rows: readonly CoachMeetingRow[], activeCount: number): string {
  const start = todayIsoChicago();
  const end = addDaysIso(start, 6);
  let sessionCount = 0;
  for (const row of rows) {
    for (const session of row.sessions) {
      if (session.status === 'canceled') continue;
      if (session.sessionDate >= start && session.sessionDate <= end) sessionCount += 1;
    }
  }
  const seriesWord = 'active series'; // "series" is invariant singular/plural.
  const sessionWord = sessionCount === 1 ? 'session' : 'sessions';
  return `${activeCount} ${seriesWord} · ${sessionCount} ${sessionWord} in the next 7 days`;
}

// ---------------------------------------------------------------------------
// Coach view.
// ---------------------------------------------------------------------------

/** T096 (module doc #7c, historical). Real success/error messaging for
 * Cancel/Schedule/Save, unchanged shape from before this ticket. */
interface FeedbackBanner {
  status: 'success' | 'error';
  title: string;
  description: string;
}

export interface CoachMeetingsViewProps {
  loadData: LoadCoachMeetingsDataFn;
  onCancelSession: CancelMeetingSessionFn;
  onCreateMeetings: OnCreateMeetingsFn;
  onSaveMeetingSeries: OnSaveMeetingSeriesFn;
  onSaveMeetingSession: OnSaveMeetingSessionFn;
  /** §9d -- additive, optional; defaults to the real
   * `setAttendanceStatus`/`clearAttendanceStatus`
   * (`../../../lib/supabase/loaders/attendance.ts:588`/`:653`). Injectable
   * for tests, same convention every other seam on this component already
   * follows. */
  onSetAttendanceStatus?: typeof setAttendanceStatus;
  onClearAttendance?: typeof clearAttendanceStatus;
}

/** T605 -- which session (if any) `<EditMeetingSessionDialog>` is currently
 * editing; `null` => closed. */
interface EditSessionTarget {
  eventId: string;
  eventTitle: string;
  session: CoachMeetingSessionDetail;
  otherSessionDates: readonly string[];
}

/** Which session (if any) the shared Cancel `AlertDialog` targets. Reused by
 * both a `SessionRow`'s own inline cancel (via `handleCancelSession` below,
 * which this dialog no longer gates -- `SessionRow.tsx` owns its own cancel
 * confirmation internally, module doc §7/packet §9d) and
 * `EditMeetingSessionDialog`'s "Cancel this meeting" affordance (which still
 * needs a confirm step of its own, since it is not `SessionRow`'s inline
 * one). */
interface CancelTarget {
  eventId: string;
  eventTitle: string;
  session: CoachMeetingSessionDetail;
}

type ActiveTab = 'active' | 'finished';

export function CoachMeetingsView({
  loadData,
  onCancelSession,
  onCreateMeetings,
  onSaveMeetingSeries,
  onSaveMeetingSession,
  onSetAttendanceStatus = setAttendanceStatus,
  onClearAttendance = clearAttendanceStatus,
}: CoachMeetingsViewProps): ReactNode {
  const { user } = useAuth();
  const activeSeason = useActiveSeason();
  const loadState = useLoadState(loadData, [loadData]);
  const [rows, setRows] = useState<CoachMeetingRow[]>([]);
  const [teams, setTeams] = useState<readonly Team[]>([]);
  const [cancelTarget, setCancelTarget] = useState<CancelTarget | null>(null);
  const [editSessionTarget, setEditSessionTarget] = useState<EditSessionTarget | null>(null);
  const [isScheduleDialogOpen, setIsScheduleDialogOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<CoachMeetingRow | null>(null);
  const [feedback, setFeedback] = useState<FeedbackBanner | null>(null);
  const [activeTab, setActiveTab] = useState<ActiveTab>('active');
  // §3b -- in-memory rail<->card focus state (frozen `MeetingsFocusRequest`
  // shape, never reshaped). `null` = nothing focused/selected.
  const [focus, setFocus] = useState<MeetingsFocusRequest | null>(null);
  // §5 -- one `tabIndex={-1}` scroll/focus target per rendered card+panel
  // pair, keyed by `eventId`. A plain `Map` (not React state): it only ever
  // needs to be read inside an effect after a render, never to trigger one.
  const panelRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  useEffect(() => {
    if (loadState.status === 'success') {
      setRows(loadState.data.rows);
      setTeams(loadState.data.teams);
    }
  }, [loadState]);

  const { upcoming: active, past: finished } = useMemo(
    () => partitionCoachMeetingRows(rows),
    [rows],
  );

  const cardModels = useMemo(() => buildSeriesCardModels(rows, paletteIndexForEventId), [rows]);
  const cardModelByEventId = useMemo(
    () => new Map(cardModels.map((model) => [model.eventId, model] as const)),
    [cardModels],
  );

  const overlapIndex = useMemo(
    () =>
      buildOverlapIndex(
        rows.flatMap((row) =>
          row.sessions.map((session) => ({ ...session, eventId: row.eventId })),
        ),
      ),
    [rows],
  );

  const seasonStartsOn = activeSeason.status === 'ready' ? activeSeason.season.startsOn : undefined;
  const seasonEndsOn = activeSeason.status === 'ready' ? activeSeason.season.endsOn : undefined;

  // §5 -- scroll + REAL programmatic focus, paired (StudentHome.tsx:1608-1615
  // precedent: scrollIntoView alone never moves keyboard/screen-reader
  // focus). Runs whenever `focus` changes to a real request.
  useEffect(() => {
    if (focus === null) return;
    const target = panelRefs.current.get(focus.eventId);
    if (!target) return;
    target.scrollIntoView({ behavior: 'smooth' });
    target.focus();
  }, [focus]);

  function handleFocusChange(request: MeetingsFocusRequest | null): void {
    setFocus(request);
    if (request !== null) {
      const isFinished = finished.some((row) => row.eventId === request.eventId);
      setActiveTab(isFinished ? 'finished' : 'active');
    }
  }

  function openScheduleDialog(): void {
    setEditTarget(null);
    setIsScheduleDialogOpen(true);
  }

  function openEditSeriesDialog(row: CoachMeetingRow): void {
    setEditTarget(row);
    setIsScheduleDialogOpen(true);
  }

  function handleEditSessionRequest(eventId: string, session: CoachMeetingSessionDetail): void {
    const row = rows.find((r) => r.eventId === eventId);
    const otherSessionDates = (row?.sessions ?? [])
      .filter((s) => s.sessionId !== session.sessionId)
      .map((s) => s.sessionDate);
    setEditSessionTarget({
      eventId,
      eventTitle: row?.title ?? '',
      session,
      otherSessionDates,
    });
  }

  // §9c/§4 -- the ONE cancel mutation, called both by a `SessionRow`'s own
  // inline confirm (`SchedulePanel`'s `onCancelSession`, keyed only by
  // `sessionId` -- `SessionRow.tsx` owns its own `AlertDialog` internally,
  // module doc §7) and by the shared `cancelTarget`/`AlertDialog` below
  // (`EditMeetingSessionDialog`'s "Cancel this meeting" affordance).
  // Optimistic update + rollback-on-failure, same shape this file used
  // before this ticket.
  async function handleCancelSession(sessionId: string): Promise<void> {
    const row = rows.find((r) => r.sessions.some((s) => s.sessionId === sessionId));
    const session = row?.sessions.find((s) => s.sessionId === sessionId);
    if (!row || !session) return;
    const previousStatus = session.status;
    setRows((prev) =>
      prev.map((r) =>
        r.eventId === row.eventId
          ? {
              ...r,
              sessions: r.sessions.map((s) =>
                s.sessionId === sessionId ? { ...s, status: 'canceled' } : s,
              ),
            }
          : r,
      ),
    );
    // Canceling a row's own LAST scheduled session moves it from Active to
    // Finished (`partitionCoachMeetingRows`) -- if that row is the one
    // currently selected/open (it always is, for the inline `SessionRow`
    // cancel path this seam also serves), follow it to its new tab so the
    // coach's own open drill-out panel does not silently vanish out from
    // under them the moment they act on it.
    if (focus !== null && focus.eventId === row.eventId) {
      const stillHasScheduled = row.sessions.some(
        (s) => s.sessionId !== sessionId && s.status === 'scheduled',
      );
      setActiveTab(stillHasScheduled ? 'active' : 'finished');
    }
    try {
      await onCancelSession(sessionId);
      setFeedback({
        status: 'success',
        title: 'Meeting session canceled',
        description: `"${row.title}" on ${formatWeekdayDate(session.sessionDate)} is marked canceled. No attendance will be recorded for it.`,
      });
    } catch (error) {
      setRows((prev) =>
        prev.map((r) =>
          r.eventId === row.eventId
            ? {
                ...r,
                sessions: r.sessions.map((s) =>
                  s.sessionId === sessionId ? { ...s, status: previousStatus } : s,
                ),
              }
            : r,
        ),
      );
      // Symmetric rollback of the tab-follow above -- the row never
      // actually left Active (or wherever it started), so the tab should
      // not stay switched either.
      if (focus !== null && focus.eventId === row.eventId && previousStatus === 'scheduled') {
        setActiveTab('active');
      }
      setFeedback({
        status: 'error',
        title: "Couldn't cancel meeting",
        description: isSupabaseLoaderError(error)
          ? error.message
          : `Something went wrong canceling "${row.title}". Try again in a moment.`,
      });
    }
  }

  async function handleConfirmCancel(): Promise<void> {
    if (cancelTarget === null) return;
    const sessionId = cancelTarget.session.sessionId;
    setCancelTarget(null);
    await handleCancelSession(sessionId);
  }

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
      setFeedback({
        status: 'success',
        title: 'Meetings scheduled',
        description: `${sessionCount} meeting${sessionCount === 1 ? '' : 's'} scheduled. Refresh the page to see ${sessionCount === 1 ? 'it' : 'them'} in the list below.`,
      });
    }
  }

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
      setFeedback({
        status: 'success',
        title: 'Meeting series updated',
        description: 'This meeting series was updated. Refresh the page to see the change.',
      });
    }
  }

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
        <Skeleton width={260} height={16} index={2} />
        <Grid columns={{ minWidth: 300 }} gap={4}>
          {[0, 1, 2].map((card) => (
            <Skeleton key={card} width="100%" height={380} index={card + 3} />
          ))}
        </Grid>
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
  const visibleRows = activeTab === 'active' ? active : finished;

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
          // DES-15 verbatim (PRD line 212): unchanged text from before this
          // ticket.
          title="No meetings scheduled."
          description="Set up your weekly build meetings once and check-in takes care of itself."
          actions={
            <Button label="Schedule meetings" variant="primary" onClick={openScheduleDialog} />
          }
        />
      ) : (
        <>
          {/* §6 -- plain counts, no countdown/urgency copy (item 17). */}
          <Text type="supporting">{buildMeetingsSubtitle(rows, active.length)}</Text>

          {/* §5 -- rail beside the card grid, PRD MTG-01d's own two-region
              layout, via `Grid` (never a hand-rolled CSS grid). */}
          <Grid columns={{ minWidth: 480, max: 2 }} gap={5} align="start">
            <VStack gap={4}>
              <TabList value={activeTab} onChange={(value) => setActiveTab(value as ActiveTab)}>
                <Tab value="active" label={`Active (${active.length})`} />
                <Tab value="finished" label={`Finished (${finished.length})`} />
              </TabList>

              {visibleRows.length === 0 ? (
                <EmptyState
                  headingLevel={3}
                  isCompact
                  title={activeTab === 'active' ? 'No active meetings' : 'No finished meetings'}
                  description={
                    activeTab === 'active'
                      ? 'No meetings are currently scheduled.'
                      : 'Completed and canceled meetings will show up here.'
                  }
                />
              ) : (
                <Grid columns={{ minWidth: 300 }} gap={4}>
                  {visibleRows.map((row) => {
                    const model = cardModelByEventId.get(row.eventId);
                    if (!model) return null;
                    const isSelected = focus !== null && focus.eventId === row.eventId;
                    const overlapCount = row.sessions.reduce(
                      (sum, session) => sum + (overlapIndex.get(session.sessionId)?.length ?? 0),
                      0,
                    );
                    const scheduledSessions = row.sessions.filter((s) => s.status === 'scheduled');

                    return (
                      <Fragment key={row.eventId}>
                        <VStack gap={2}>
                          <SeriesCard
                            model={model}
                            overlapCount={overlapCount}
                            isSelected={isSelected}
                            onSelect={handleFocusChange}
                          />
                          {/* §5 note 2 -- MTG-01b names no card-level Edit
                              affordance and `SeriesCard.tsx` (frozen) ships
                              none; `ScheduleMeetingsDialog`'s real,
                              already-built series-edit mode (T510) still
                              needs a trigger, so this file supplies one as a
                              sibling of the card rather than widening
                              `SeriesCard.tsx`. */}
                          <Button
                            label={`Edit series – ${row.title}`}
                            size="sm"
                            variant="ghost"
                            onClick={() => openEditSeriesDialog(row)}
                          >
                            Edit series
                          </Button>
                        </VStack>

                        {isSelected && (
                          <GridSpan columns="full">
                            <div
                              ref={(el) => {
                                if (el) panelRefs.current.set(row.eventId, el);
                                else panelRefs.current.delete(row.eventId);
                              }}
                              tabIndex={-1}
                            >
                              <VStack gap={4}>
                                <SchedulePanel
                                  eventId={row.eventId}
                                  sessions={row.sessions}
                                  focusRequest={focus ?? undefined}
                                  overlapIndex={overlapIndex}
                                  onCancelSession={handleCancelSession}
                                  onSetAttendanceStatus={onSetAttendanceStatus}
                                  onClearAttendance={onClearAttendance}
                                  recordedBy={user?.id}
                                  onEditSession={(sessionId) => {
                                    const session = row.sessions.find(
                                      (s) => s.sessionId === sessionId,
                                    );
                                    if (session) handleEditSessionRequest(row.eventId, session);
                                  }}
                                  // §13 -- this component only ever renders
                                  // for a coach/admin viewer (MTG-12).
                                  canSetExcused
                                />

                                {scheduledSessions.length > 0 && (
                                  <VStack gap={1}>
                                    <Heading level={3}>Live console</Heading>
                                    {/* T511 -- the live console's ONLY entry
                                        point in the app. Rendered here, not
                                        inside `SessionRow.tsx` (frozen,
                                        renders no such link -- packet §4/§8.2).
                                        A `Link`, not a `Button`: this
                                        navigates, and `astryx-api.md`'s Link
                                        Best Practices reserve `Button` for
                                        actions that do NOT navigate. No time
                                        window, deliberately (`docs/swarm/
                                        active/T511-scope.md` §3) -- a meeting
                                        that started an hour ago and is still
                                        running must stay reachable. No role
                                        check here either: this whole branch
                                        only renders under
                                        `CoachMeetingsView`, itself gated on
                                        `isCoachOrAdminView` one level up. */}
                                    {scheduledSessions.map((session) => (
                                      <Link
                                        key={session.sessionId}
                                        as={RouterLink}
                                        href={routePaths.meetingLiveSession(session.sessionId)}
                                        isStandalone
                                      >
                                        {/* The date is REQUIRED, not
                                            decorative: `astryx-api.md`
                                            forbids `label` on a text link, so
                                            this visible text IS the
                                            accessible name -- a multi-session
                                            row would otherwise render several
                                            links all named "Go live". */}
                                        {`Go live — ${formatWeekdayDate(session.sessionDate)}`}
                                      </Link>
                                    ))}
                                  </VStack>
                                )}
                              </VStack>
                            </div>
                          </GridSpan>
                        )}
                      </Fragment>
                    );
                  })}
                </Grid>
              )}
            </VStack>

            <MeetingsRail
              rows={rows}
              overlapIndex={overlapIndex}
              focus={focus}
              onFocusChange={handleFocusChange}
              seasonStartsOn={seasonStartsOn}
              seasonEndsOn={seasonEndsOn}
            />
          </Grid>
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
