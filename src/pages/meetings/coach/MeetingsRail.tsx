/**
 * @file MeetingsRail.tsx
 * @position GAM-449. Renders the `meetings-design` skill's "Rail is a month
 *   `Calendar` + per-day agenda" (`.claude/skills/meetings-design/SKILL.md`,
 *   "The rest of the page, in one place"). GAM-444 (Stage B) created this
 *   file as a stub and froze `MeetingsRailProps`/`rows`/`overlapIndex`/
 *   `focus`/`onFocusChange`; this ticket is the downstream rendering
 *   deliverable the old stub doc pointed at. `MeetingsRail` has no callers
 *   anywhere in the tree yet (GAM-452, the integration ticket, is `Backlog`),
 *   which is why the four additive optional props below (item 3 below) are
 *   safe to add without a freeze violation -- the same GAM-447/`SeriesCard`
 *   precedent this ticket's own packet cites.
 *
 *   **This ticket closes Partial, not Passed (constitution item 27).**
 *   `MeetingsRail` is mounted on no route -- there is no URL a user or a
 *   browser can reach it through today. GAM-452 is the integration ticket.
 *
 * -----------------------------------------------------------------------
 * 1. No has-meeting marking on the grid -- disclosed deviation (packet §3c).
 *
 *   The issue asks for "a month calendar marking which days have meetings".
 *   `Calendar`'s only per-day render slot is a hard-coded `{dayNumber}`
 *   (`node_modules/@astryxdesign/core/src/Calendar/Calendar.tsx:1018-1019`)
 *   and its Theming table exposes exactly four boolean data attributes on
 *   `astryx-calendar-day` -- `data-selected`, `data-today`, `data-disabled`,
 *   `data-in-range` (`astryx-api.md:2357`) -- none keyed to caller data. T045
 *   (`CalendarPage.tsx` module doc item 1) already investigated and rejected
 *   both a generated per-date `<style>` tag and a `ref` + `querySelectorAll`
 *   DOM-poke as ways around this; that rejection stands here too. Round 1 of
 *   this ticket's own packet prescribed `dateConstraints` to disable
 *   non-meeting days so `data-disabled` would mark them by contrast; the
 *   round-2 gate measured that for one Mon/Thu series in a single month, 33
 *   of 42 rendered day cells go `data-disabled` (a genuine `disabled`
 *   button, `tabIndex="-1"`), which also makes an empty day unclickable (the
 *   issue never asks for that) and trips `astryx-api.md:2317`'s own "Don't:
 *   Disable large blocks of dates without context". That prescription is
 *   withdrawn. **This component passes no `dateConstraints` at all** and
 *   ships T045's already-shipped resolution: `Calendar` is used for its two
 *   real documented jobs -- month navigation (`focusDate`/
 *   `onFocusDateChange`/`min`/`max`) and day selection (`mode="single"`,
 *   `onChange`) -- and every bit of has-meeting information lives outside
 *   the grid, in the legend (item 5 below) and the agenda.
 *
 * -----------------------------------------------------------------------
 * 2. The one part of "marking" that IS achievable, and is not dropped
 *    (packet §5).
 *
 *   Styling the grid through its own documented `data-today`/`data-selected`
 *   hooks on `astryx-calendar-day` (`MeetingsRail.css`) is the documented use
 *   of the documented surface -- it recovers the visible half of the issue's
 *   "The one constraint" without inventing a rejected extension point.
 *
 * -----------------------------------------------------------------------
 * 3. Additive optional props (packet §3e, §4 criterion 9) -- the merged
 *    GAM-447 precedent (`SeriesCard.tsx:317-323`, that file's module doc item
 *    8): `isLoading?`/`errorMessage?` reach the DES-12 loading/error
 *    branches; `seasonStartsOn?`/`seasonEndsOn?` (both `YYYY-MM-DD`) bound
 *    `Calendar`'s `min`/`max` (see `computeNavWindow` below) and, when
 *    absent, the window silently falls back to the rows' own session span --
 *    a real fallback, not an error, but a fallback nonetheless (packet §8d).
 *    `useActiveSeason()` (`src/app/SeasonProvider.tsx:214`) is deliberately
 *    NOT consumed here: it throws outside a `<SeasonProvider>` and fetches
 *    from Supabase, so reaching for it here would make this leaf
 *    presentation component context-coupled and force this file's own unit
 *    test to stand up a fetching provider. GAM-452 (the integration ticket)
 *    is the seam that resolves the real season and passes it through these
 *    two props -- **but GAM-452's own live description names no season
 *    window and does not list this file in its file table, so unless that
 *    ticket is updated, it will not pass them, and "season-bounded" will
 *    quietly become "session-span-bounded"** (packet §8d, flagged for the
 *    orchestrator to record on GAM-452 while it is still `Backlog`).
 *    **No existing prop is changed and nothing in `src/lib/meetings/types.ts`
 *    is touched or reshaped** -- these four props are additive on
 *    `MeetingsRailProps` only.
 *
 * -----------------------------------------------------------------------
 * 4. Local helper copies, not imports, and why (packet §3g/§3h; follow-ups
 *    filed).
 *
 *   - `todayIsoChicago()` (below) is a **local copy**, not an import of
 *     `CalendarPage.tsx`'s own exported `todayIsoChicago`. It is exported
 *     there, so "forbidden to edit" is not the reason -- the reason is that
 *     importing a *page* module here would drag its Supabase-loader import
 *     graph into this leaf component and its unit test. **Follow-up filed:
 *     GAM-477.**
 *   - `paletteIndexForEventId` (below) hashes `eventId` locally because
 *     `SeriesCardModel.paletteIndex` (`types.ts:337`) is declared but
 *     nothing in `src/` actually builds a `SeriesCardModel` yet -- there is
 *     no shared derivation to import. `SeriesCard.tsx:388` already consumes
 *     a `paletteIndex` its own future caller will produce with a hash of its
 *     own; divergence between that hash and this one is a certainty, not a
 *     risk, until they are unified. **Follow-up filed: GAM-476.** Hashes
 *     `eventId`, per the `meetings-design` skill's "Series identity color" --
 *     **never array position**, which would change when a series is added or
 *     a filter is applied.
 *   - `computeNavWindow` (below) is the other "one exported function" the
 *     packet asks for (§4 criterion 2), so both extraction seams exist for a
 *     future shared module to pull from.
 *
 * -----------------------------------------------------------------------
 * 5. `Calendar`'s day selection cannot be cleared through `value` -- use
 *    T045's `key` remount (packet §3j, BLOCKER).
 *
 *   `effectiveValue = value !== undefined ? value : internalValue`
 *   (`Calendar.tsx:250`), so this component never passes `value` to
 *   `Calendar` at all (the same choice `CalendarPage.tsx:723-730` already
 *   made) -- day clicks are read from `onChange` into this component's own
 *   `selectedDayIso` state, and `Calendar`'s OWN internal highlight is left
 *   alone to track clicks naturally. Clearing that highlight (the "Clear"
 *   control, item 8 below, and the "Today" control, item 9) is done the only
 *   way that actually works: bumping `calendarResetKey` to remount
 *   `Calendar` with a fresh `key`, exactly as `CalendarPage.tsx:724`/`:603`/
 *   `:609` (`handleToday`/`handleShowWholeMonth`) already do.
 *
 * -----------------------------------------------------------------------
 * 6. `min`/`max`/`focusDate` are `ISODateString`, a template-literal type,
 *    not `string` (packet §3k) -- every value threaded into them here is a
 *    plain `string` internally and is cast with `as ISODateString` at the
 *    point it reaches `Calendar`, the same in-repo answer
 *    `CalendarPage.tsx:727` already uses.
 *
 * -----------------------------------------------------------------------
 * 7. `Calendar`'s own `data-today` is browser-zone (packet §3i) --
 *    `plainDateToday()` calls `new Date()`
 *    (`node_modules/@astryxdesign/core/src/utils/plainDate.ts:58`) and is not
 *    overridable by any prop, so it can disagree with Chicago-today by one
 *    day near the UTC/Chicago boundary. This component's own notion of
 *    "today" -- the agenda window, the "Today N" heading, the `min`/`max`
 *    fallback anchor -- comes only from the local `todayIsoChicago()` above,
 *    never from `Calendar`'s own `data-today`, and this file's test never
 *    cross-asserts the two.
 *
 * -----------------------------------------------------------------------
 * 8. The "Clear" control (packet §4 criterion 6). Visible whenever the
 *    agenda is narrowed to one day (`effectiveDayIso !== null`, whether that
 *    narrowing came from a grid click or from an externally supplied
 *    `focus.sessionId`, item 10 below -- "day selection and focus are the
 *    same in-memory concern" per that criterion). Clearing resets the local
 *    day-selection state, bumps `calendarResetKey` (item 5), and emits
 *    `onFocusChange(null)` so a real caller's own `focus` state is released
 *    too.
 *
 * -----------------------------------------------------------------------
 * 9. The "Today" control (packet §4 criterion 14). The issue asks for
 *    "prev/next + 'Today' controls"; `Calendar` renders only the two arrows
 *    (`Calendar.tsx:431-462`, "Previous month"/"Next month"), so this
 *    component ships its own "Today" `Button`, matching
 *    `CalendarPage.tsx:603`'s `handleToday`: it returns the visible month to
 *    Chicago-today and clears any local day selection, remounting the grid
 *    (item 5) so no stale `data-selected` survives.
 *
 * -----------------------------------------------------------------------
 * 10. The frozen `focus` prop (packet §4 criterion 13). When
 *     `focus.sessionId` names a real session in `rows`, that agenda item is
 *     marked `aria-current`, and the agenda/`Calendar` both switch to show
 *     that session's own day/month -- computed directly from the prop on
 *     every render (no `useEffect` sync into local state), so it can never
 *     go stale relative to a prop the parent changed. When `focus` is
 *     `null`, or names no known session, nothing is marked and the view
 *     falls back to local `selectedDayIso` state, then to the default
 *     five-day agenda. This component **emits only** (packet §4 criterion
 *     1) -- clicking an agenda item calls `onFocusChange` with
 *     `{ eventId, sessionId, monthKey }` and nothing else; it never mutates
 *     `rows`/`overlapIndex` and holds no data-loading state of its own.
 *
 * -----------------------------------------------------------------------
 * 11. Series color is an open owner decision -- every swatch/dot ships
 *     neutral (packet §3f, §8b). `--color-series-1…8` does not exist in
 *     `src/theme/volt.ts` (zero hits) and that file is outside this ticket's
 *     Allowed Files. This component does not invent hex values and does not
 *     borrow an unrelated existing token. Instead, `paletteIndexForEventId`'s
 *     result is carried onto both the legend swatch and the agenda item's
 *     dot as `data-series-palette-index`, and `MeetingsRail.css` renders
 *     both in their neutral default form (`var(--color-border-emphasized)`,
 *     an existing neutral token, not a series hue) so a single future CSS
 *     rule keyed on `[data-series-palette-index="N"]` can light them up once
 *     GAM-466 lands the eight hues. **No element inside the `Calendar` grid
 *     itself ever carries this attribute** -- GAM-441's ruling (item 1
 *     above) is pinned as a test (packet §4 criterion 4).
 */
import { useState, type ReactNode } from 'react';
import {
  Badge,
  Banner,
  Button,
  Calendar,
  EmptyState,
  Heading,
  HStack,
  Skeleton,
  Text,
  VisuallyHidden,
  VStack,
  type ISODateString,
} from '@astryxdesign/core';
import {
  CHICAGO_TIME_ZONE,
  formatTimeRangeWithDuration,
  parseDateOnly,
} from '../../../lib/meetings/format';
import type {
  CoachMeetingRow,
  CoachMeetingSessionDetail,
  MeetingsFocusRequest,
  OverlapIndex,
  OverlapRef,
} from '../../../lib/meetings/types';
import './MeetingsRail.css';

/** Props for {@link MeetingsRail}. */
export interface MeetingsRailProps {
  /** Every coach series row currently in view -- the rail's per-day agenda
   * is built from these rows' own sessions. */
  rows: readonly CoachMeetingRow[];
  /** Cross-series overlap lookup (`meetings-design` skill, "Overlap
   * badges"); the rail's agenda item is one of the three sites that render
   * an overlap badge. */
  overlapIndex: OverlapIndex;
  /** In-memory rail<->card focus state; `null` when nothing is focused. */
  focus: MeetingsFocusRequest | null;
  /** Called when the coach picks a day/session in the rail, or clears
   * focus (`null`). */
  onFocusChange: (request: MeetingsFocusRequest | null) => void;
  /** Additive, optional (module doc item 3) -- renders the DES-12 loading
   * branch instead of the populated rail. */
  isLoading?: boolean;
  /** Additive, optional (module doc item 3) -- renders the DES-12 error
   * branch (a `Banner`) instead of the populated rail. */
  errorMessage?: string;
  /** Additive, optional (module doc item 3), `YYYY-MM-DD`. Bounds
   * `Calendar`'s `min` to the first day of this month. Falls back to the
   * earliest `sessionDate` across `rows` when absent. */
  seasonStartsOn?: string;
  /** Additive, optional (module doc item 3), `YYYY-MM-DD`. Bounds
   * `Calendar`'s `max` to the last day of this month. Falls back to the
   * latest `sessionDate` across `rows` when absent. */
  seasonEndsOn?: string;
}

/** BEH-08: the default agenda is the next N meeting days from
 * Chicago-today -- 5 covers a fortnight of a two-day-a-week series without
 * the rail outgrowing the viewport (packet §4 criterion 3). */
export const DEFAULT_AGENDA_DAY_COUNT = 5;

/** Deterministic palette slot count -- matches the `meetings-design` skill's
 * "curated palette" of eight series hues (still open, GAM-466 -- module doc
 * item 11). */
const SERIES_PALETTE_SIZE = 8;

// ---------------------------------------------------------------------------
// Local `todayIsoChicago` (module doc item 4 / packet §3h) -- never imported
// from `CalendarPage.tsx`.
// ---------------------------------------------------------------------------

const CHICAGO_DATE_ONLY_FORMATTER = new Intl.DateTimeFormat('en-CA', {
  timeZone: CHICAGO_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

function todayIsoChicago(): string {
  return CHICAGO_DATE_ONLY_FORMATTER.format(new Date());
}

// ---------------------------------------------------------------------------
// `paletteIndexForEventId` -- one exported function (packet §3g), so a
// future shared module has a single seam to move. djb2-family string hash;
// hashes `eventId`, never array position.
// ---------------------------------------------------------------------------

/** Deterministic palette slot for a series, hashed from its real `events.id`
 * (`meetings-design` skill, "Series identity color") -- same event id always
 * yields the same slot, on every render, every device. 1-indexed to match
 * the skill's own `--color-series-1…8` naming. **Follow-up filed: GAM-476**
 * (module doc item 4) -- `SeriesCard.tsx:388` will eventually consume a
 * `paletteIndex` its own caller hashes independently; the two are not yet
 * unified. */
export function paletteIndexForEventId(eventId: string): number {
  let hash = 5381;
  for (let index = 0; index < eventId.length; index += 1) {
    hash = (hash * 33 + eventId.charCodeAt(index)) >>> 0;
  }
  return (hash % SERIES_PALETTE_SIZE) + 1;
}

// ---------------------------------------------------------------------------
// `computeNavWindow` -- the other exported function the packet asks for
// (§4 criterion 2). Pure: `min` = first day of the month of `seasonStartsOn`
// (or of the earliest `sessionDate` across `rows`, or of Chicago-today when
// neither exists); `max` = last day of the month of `seasonEndsOn` (or of
// the latest `sessionDate`, or of Chicago-today). Both `YYYY-MM-DD` (packet
// §3e).
// ---------------------------------------------------------------------------

/** `Calendar`'s own `min`/`max`, both bounding whole months. */
export interface MeetingsRailNavWindow {
  min: ISODateString;
  max: ISODateString;
}

function earliestAndLatestSessionDate(
  rows: readonly CoachMeetingRow[],
): { earliest: string; latest: string } | null {
  let earliest: string | null = null;
  let latest: string | null = null;
  for (const row of rows) {
    for (const session of row.sessions) {
      if (earliest === null || session.sessionDate < earliest) earliest = session.sessionDate;
      if (latest === null || session.sessionDate > latest) latest = session.sessionDate;
    }
  }
  return earliest !== null && latest !== null ? { earliest, latest } : null;
}

function firstOfMonthIso(dateIso: string): string {
  return `${dateIso.slice(0, 7)}-01`;
}

function lastOfMonthIso(dateIso: string): string {
  const year = Number(dateIso.slice(0, 4));
  const month = Number(dateIso.slice(5, 7));
  // Day 0 of the (0-based) month numbered `month` is the last day of the
  // (1-based) month `dateIso` names -- the same "day 0 rolls back" trick
  // `format.ts`'s own `parseDateOnly` neighbourhood uses, anchored at noon
  // is unnecessary here since only the day-of-month is read back out.
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return `${dateIso.slice(0, 7)}-${String(lastDay).padStart(2, '0')}`;
}

/** Season-bounded nav window (module doc item 3 / packet §3e). Exported for
 * direct testing, per `format.ts`'s own established "exported pure
 * function" precedent. */
export function computeNavWindow(
  rows: readonly CoachMeetingRow[],
  seasonStartsOn?: string,
  seasonEndsOn?: string,
): MeetingsRailNavWindow {
  const bounds = earliestAndLatestSessionDate(rows);
  const startAnchor = seasonStartsOn ?? bounds?.earliest ?? todayIsoChicago();
  const endAnchor = seasonEndsOn ?? bounds?.latest ?? todayIsoChicago();
  return {
    min: firstOfMonthIso(startAnchor) as ISODateString,
    max: lastOfMonthIso(endAnchor) as ISODateString,
  };
}

// ---------------------------------------------------------------------------
// Agenda day heading -- item 17, no urgency mechanics (packet §4 criterion
// 10). Plain BEH-08 labels: "Today 15", "Sunday 18". Computed once per
// render from a Chicago calendar date string, no unit finer than a day, no
// timer.
// ---------------------------------------------------------------------------

const AGENDA_WEEKDAY_FORMATTER = new Intl.DateTimeFormat('en-US', {
  weekday: 'long',
  timeZone: CHICAGO_TIME_ZONE,
});

const AGENDA_DAY_NUMBER_FORMATTER = new Intl.DateTimeFormat('en-US', {
  day: 'numeric',
  timeZone: CHICAGO_TIME_ZONE,
});

function formatAgendaDayHeading(dateIso: string, todayIso: string): string {
  const dayNumber = AGENDA_DAY_NUMBER_FORMATTER.format(parseDateOnly(dateIso));
  if (dateIso === todayIso) {
    return `Today ${dayNumber}`;
  }
  return `${AGENDA_WEEKDAY_FORMATTER.format(parseDateOnly(dateIso))} ${dayNumber}`;
}

// ---------------------------------------------------------------------------
// Agenda index -- buckets every row's own sessions by Chicago calendar date
// (the stored `sessionDate`, never re-derived from a UTC instant) and by
// `sessionId`, for O(1) lookups from both the default-window builder and the
// `focus` prop (module doc item 10).
// ---------------------------------------------------------------------------

interface AgendaSessionEntry {
  eventId: string;
  eventTitle: string;
  locationName: string;
  paletteIndex: number;
  session: CoachMeetingSessionDetail;
}

interface AgendaIndex {
  byDate: Map<string, AgendaSessionEntry[]>;
  bySessionId: Map<string, AgendaSessionEntry>;
}

function buildAgendaIndex(rows: readonly CoachMeetingRow[]): AgendaIndex {
  const byDate = new Map<string, AgendaSessionEntry[]>();
  const bySessionId = new Map<string, AgendaSessionEntry>();
  for (const row of rows) {
    const paletteIndex = paletteIndexForEventId(row.eventId);
    for (const session of row.sessions) {
      const entry: AgendaSessionEntry = {
        eventId: row.eventId,
        eventTitle: row.title,
        locationName: row.locationName,
        paletteIndex,
        session,
      };
      bySessionId.set(session.sessionId, entry);
      const existing = byDate.get(session.sessionDate);
      if (existing) {
        existing.push(entry);
      } else {
        byDate.set(session.sessionDate, [entry]);
      }
    }
  }
  for (const entries of byDate.values()) {
    entries.sort((a, b) => a.session.startsAt.localeCompare(b.session.startsAt));
  }
  return { byDate, bySessionId };
}

/** A meeting day is a Chicago calendar date with at least one non-canceled
 * session (packet §4 criterion 3). Ascending, from `todayIso` inclusive,
 * capped at `DEFAULT_AGENDA_DAY_COUNT`. */
function defaultAgendaDates(byDate: Map<string, AgendaSessionEntry[]>, todayIso: string): string[] {
  return Array.from(byDate.entries())
    .filter(
      ([date, entries]) =>
        date >= todayIso && entries.some((entry) => entry.session.status !== 'canceled'),
    )
    .map(([date]) => date)
    .sort()
    .slice(0, DEFAULT_AGENDA_DAY_COUNT);
}

// ---------------------------------------------------------------------------
// Agenda item -- a real `<button>` (packet §4 criteria 1/11), built on the
// Astryx `Button`'s documented `children` override (astryx-api.md:1823:
// "Optional override for visible text... label is still required (it
// provides the accessible name)") -- the accessible name is the series
// title + time (criterion 11); the visible content is the richer row
// (criterion 8).
// ---------------------------------------------------------------------------

function AgendaItemButton({
  entry,
  isCurrent,
  overlapRefs,
  onSelect,
}: {
  entry: AgendaSessionEntry;
  isCurrent: boolean;
  overlapRefs: readonly OverlapRef[];
  onSelect: () => void;
}): ReactNode {
  const timeText = formatTimeRangeWithDuration(entry.session.startsAt, entry.session.endsAt);
  // Criterion 8's exact copy: `"{locationName} · {expectedCt} expected"`, or
  // `"attendance recorded"` when the session has an `attendanceSummary`.
  // `locationName` is a SERIES field (`types.ts:111`), so every session in a
  // series shows the same location -- that is correct, not a bug.
  const detailText = entry.session.attendanceSummary
    ? 'attendance recorded'
    : `${entry.locationName} · ${entry.session.expectedCt} expected`;

  return (
    <Button
      className="meetings-rail__agenda-item"
      variant="ghost"
      label={`${entry.eventTitle}, ${timeText}`}
      aria-current={isCurrent ? ('true' as const) : undefined}
      onClick={() => onSelect()}
    >
      <VStack gap={0.5} align="start">
        <HStack gap={1.5} vAlign="center" wrap="wrap">
          <span
            className="meetings-rail__dot"
            data-series-palette-index={entry.paletteIndex}
            aria-hidden="true"
          />
          <Text type="body" weight="semibold">
            {entry.eventTitle}
          </Text>
          {overlapRefs.length > 0 && (
            <Badge variant="neutral" label={`${overlapRefs.length} overlap`} />
          )}
          {entry.session.status === 'canceled' && <Badge variant="neutral" label="Canceled" />}
        </HStack>
        <Text type="supporting">{timeText}</Text>
        <Text type="supporting">{detailText}</Text>
      </VStack>
    </Button>
  );
}

/**
 * Renders GAM-444's frozen `MeetingsRailProps` as a month `Calendar` + a
 * per-day agenda (GAM-449). See the module doc above for the full decision
 * record: the disclosed no-grid-marking deviation, the neutral series
 * palette, the local formatter/hash copies and their follow-up tickets, the
 * `key`-remount fix for `Calendar`'s day-selection clearing, and the
 * `focus`-prop precedence over local day-selection state.
 */
export function MeetingsRail(props: MeetingsRailProps): ReactNode {
  const {
    rows,
    overlapIndex,
    focus,
    onFocusChange,
    isLoading,
    errorMessage,
    seasonStartsOn,
    seasonEndsOn,
  } = props;

  const [selectedDayIso, setSelectedDayIso] = useState<string | null>(null);
  const [focusDateIso, setFocusDateIso] = useState<string>(() => todayIsoChicago());
  // Bumped by the "Today"/"Clear" controls (module doc items 5/8/9) to
  // remount `Calendar` and drop its own uncontrolled day-selection highlight
  // -- a real React `key` remount, not an Astryx internal (packet §3j).
  const [calendarResetKey, setCalendarResetKey] = useState(0);

  function handleFocusDateChange(next: ISODateString): void {
    setFocusDateIso(next);
    setSelectedDayIso(null);
    setCalendarResetKey((key) => key + 1);
  }

  function handleToday(): void {
    setFocusDateIso(todayIsoChicago());
    setSelectedDayIso(null);
    setCalendarResetKey((key) => key + 1);
  }

  function handleClear(): void {
    setSelectedDayIso(null);
    setCalendarResetKey((key) => key + 1);
    onFocusChange(null);
  }

  if (isLoading === true) {
    return (
      <VStack gap={4} className="meetings-rail" aria-busy="true">
        <VisuallyHidden as="div" role="status">
          Loading meetings…
        </VisuallyHidden>
        <Skeleton width="100%" height={260} index={0} />
        <Skeleton width="70%" height={20} index={1} />
        <Skeleton width="90%" height={20} index={2} />
        <Skeleton width="60%" height={20} index={3} />
      </VStack>
    );
  }

  if (errorMessage) {
    return (
      <VStack gap={4} className="meetings-rail">
        <Banner status="error" title="Couldn't load meetings" description={errorMessage} />
      </VStack>
    );
  }

  const hasAnySession = rows.some((row) => row.sessions.length > 0);
  if (!hasAnySession) {
    return (
      <VStack gap={4} className="meetings-rail">
        <EmptyState
          headingLevel={2}
          title="No meetings scheduled"
          description="Meetings for this season will show up here once they're scheduled."
        />
      </VStack>
    );
  }

  const todayIso = todayIsoChicago();
  const agendaIndex = buildAgendaIndex(rows);

  // Module doc item 10 -- `focus` is derived purely on every render, never
  // synced into state, so it can never go stale relative to a prop change.
  const focusedEntry = focus?.sessionId
    ? (agendaIndex.bySessionId.get(focus.sessionId) ?? null)
    : null;
  const effectiveDayIso = focusedEntry ? focusedEntry.session.sessionDate : selectedDayIso;
  const agendaDates =
    effectiveDayIso !== null ? [effectiveDayIso] : defaultAgendaDates(agendaIndex.byDate, todayIso);
  const visibleFocusDate = focusedEntry ? focusedEntry.session.sessionDate : focusDateIso;

  // Criterion 5 -- a series with a `scheduled` session remaining appears; a
  // fully completed/canceled one does not, UNLESS it has an item in the
  // currently visible agenda, so no agenda dot is ever unlegended.
  const visibleAgendaEventIds = new Set(
    agendaDates.flatMap((date) =>
      (agendaIndex.byDate.get(date) ?? []).map((entry) => entry.eventId),
    ),
  );
  const legendRows = rows.filter(
    (row) =>
      row.sessions.some((session) => session.status === 'scheduled') ||
      visibleAgendaEventIds.has(row.eventId),
  );

  const navWindow = computeNavWindow(rows, seasonStartsOn, seasonEndsOn);

  return (
    <VStack gap={5} className="meetings-rail">
      <VStack gap={2}>
        <HStack hAlign="end">
          <Button variant="secondary" size="sm" label="Today" onClick={handleToday} />
        </HStack>
        {/* Module doc items 1/5/6 -- no `dateConstraints`, no `value` (never
            cleared reliably per packet §3j), `min`/`max`/`focusDate` cast to
            `ISODateString` (packet §3k). */}
        <Calendar
          key={calendarResetKey}
          mode="single"
          weekStartsOn="sun"
          min={navWindow.min}
          max={navWindow.max}
          focusDate={visibleFocusDate as ISODateString}
          onFocusDateChange={handleFocusDateChange}
          onChange={(iso) => setSelectedDayIso(iso)}
        />
      </VStack>

      {legendRows.length > 0 && (
        <VStack gap={2}>
          <Heading level={2}>Series</Heading>
          <VStack gap={1.5}>
            {legendRows.map((row) => (
              <HStack key={row.eventId} gap={2} vAlign="center">
                {/* Module doc item 11 -- neutral until GAM-466 lands the
                    palette; never inside the `Calendar` grid. */}
                <span
                  className="meetings-rail__swatch"
                  data-series-palette-index={paletteIndexForEventId(row.eventId)}
                  aria-hidden="true"
                />
                <Text type="supporting">{row.title}</Text>
              </HStack>
            ))}
          </VStack>
        </VStack>
      )}

      <VStack gap={3}>
        <HStack hAlign="between" vAlign="center" wrap="wrap" gap={2}>
          <Heading level={2}>Agenda</Heading>
          {effectiveDayIso !== null && (
            <Button variant="ghost" size="sm" label="Clear" onClick={handleClear} />
          )}
        </HStack>
        {agendaDates.map((date) => {
          const entries = agendaIndex.byDate.get(date) ?? [];
          return (
            <VStack gap={2} key={date}>
              <Heading level={3}>{formatAgendaDayHeading(date, todayIso)}</Heading>
              {entries.length === 0 ? (
                <Text type="supporting">No sessions on this day.</Text>
              ) : (
                <VStack gap={2}>
                  {entries.map((entry) => (
                    <AgendaItemButton
                      key={entry.session.sessionId}
                      entry={entry}
                      isCurrent={focus !== null && focus.sessionId === entry.session.sessionId}
                      overlapRefs={overlapIndex.get(entry.session.sessionId) ?? []}
                      onSelect={() =>
                        onFocusChange({
                          eventId: entry.eventId,
                          sessionId: entry.session.sessionId,
                          monthKey: entry.session.sessionDate.slice(0, 7),
                        })
                      }
                    />
                  ))}
                </VStack>
              )}
            </VStack>
          );
        })}
      </VStack>
    </VStack>
  );
}
