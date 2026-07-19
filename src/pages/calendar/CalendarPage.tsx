/**
 * T045: `/calendar` month grid + filters + detail links (CAL-01/CAL-02),
 * Epic E7's first task. An Astryx `Calendar` month grid (`weekStartsOn="sun"`)
 * for month navigation/date selection, a four-option filter `SegmentedControl`
 * (All | Meetings | Outreach | Competitions), a "Today" control, and a
 * chronological session list below the grid whose rows link out to their
 * NAV-08 detail routes.
 *
 * -----------------------------------------------------------------------
 * 1. THE CENTRAL TRAP -- investigation and resolution, in full.
 *
 * The packet's own text (and `docs/swarm/astryx-api.md`'s `# Calendar`
 * section, grepped directly -- line 2286 as of this task's read) claims the
 * real `Calendar` has no custom day-content/dots-render prop. This was
 * verified two ways, not just taken on faith:
 *
 * a. The DOC's own Props table (astryx-api.md lines 2316-2332) lists exactly
 *    thirteen props: `mode`, `value`, `defaultValue`, `onChange`,
 *    `numberOfMonths`, `min`, `max`, `dateConstraints`
 *    (`Array<(date: Date) => boolean>` -- for DISABLING dates via `min`/`max`/
 *    custom predicates, never for injecting per-day markup), `focusDate`,
 *    `onFocusDateChange`, `handleRef`, `hasOutsideDays`, `hasWeekNumbers`,
 *    `hasVariableRowCount`, `weekStartsOn`. No `dayContent`, `renderDay`,
 *    `dotsForDate`, `children`-per-day, or any other custom-rendering slot
 *    anywhere in that table.
 *
 * b. The INSTALLED SOURCE was read directly, not just the doc, per the
 *    packet's own instruction (`node_modules/@astryxdesign/core/src/Calendar/
 *    Calendar.tsx`, all ~1023 lines). `CalendarProps`/`CalendarBaseProps`
 *    (lines 97-185) confirm the doc's prop list is complete and accurate --
 *    no undocumented prop exists either. More importantly, the private
 *    `DayCell` component (lines 881-1022) that actually renders each day is
 *    NOT exported (absent from `Calendar/index.ts`), takes no `children`/
 *    `render`/`content` prop of its own, and its JSX body is HARD-CODED:
 *    `<button ...>{dayNumber}</button>` (line 1018) is the ENTIRE visible
 *    content of every day cell -- literally just the numeral, nothing else,
 *    with no slot of any kind (not even an internal one `Calendar`'s own
 *    props could thread through) for a dot, badge, icon, or any other
 *    per-day marker. This rules out not just "no documented prop" but "no
 *    prop could exist without editing installed vendor source" -- there is
 *    no hidden extension point the doc simply forgot to write down.
 *
 * c. The Theming table (astryx-api.md lines 2334-2339 / confirmed against
 *    `DayCell`'s own `themeProps('calendar-day', {...})` call at
 *    `Calendar.tsx` lines 984-990) exposes exactly four data attributes on
 *    `astryx-calendar-day`: `data-selected`, `data-today`, `data-disabled`,
 *    `data-in-range`. All four are boolean UI-state flags a CSS theme could
 *    style (selected/today/disabled/in-range look), and NONE of them is
 *    keyed to arbitrary caller data like "this date has a session" -- there
 *    is no `data-has-event`/`data-event-type`/`data-event-count` attribute,
 *    confirmed by reading the same `mergeProps(themeProps(...), ...)` call
 *    directly. So the doc's own Theming section, which the packet flagged as
 *    a possible legitimate escape hatch ("an unstyled day-cell you can
 *    visually augment via CSS/data-attributes"), does NOT hint at any
 *    event/dot-related hook either -- confirmed, not assumed. The only way
 *    to attach dots via that surface would be to synthesize a global
 *    stylesheet keyed to each session's literal ISO date (e.g. a generated
 *    `[data-date="2026-07-22"]::after` rule, since `data-date` -- the day
 *    button's OWN identity attribute, line 972 -- is the only per-day-unique
 *    hook that exists at all) and inject it as a `<style>` tag. This was
 *    considered and REJECTED: it is not a real composition pattern the
 *    component's public surface or Theming table documents, it would break
 *    the moment `hasVariableRowCount`/`hasOutsideDays` change which dates
 *    are even rendered, it can't represent "two sessions of different types
 *    on the same day" without inventing a second synthetic pseudo-element
 *    convention, and it is functionally indistinguishable from hand-rolling
 *    the exact `dayContent` prop the packet says not to invent -- it would
 *    just be doing so via a `<style>` tag instead of a React prop. Rejected
 *    as over-engineered self-dealing around the constraint, not a genuine
 *    escape hatch.
 *
 * RESOLUTION SHIPPED: `Calendar` here is used ONLY for its real, documented
 * job -- month navigation (`focusDate`/`onFocusDateChange`, driving which
 * month's sessions the list below shows) and date selection
 * (`mode="single"`, `onChange`, narrowing the list to one day) -- see
 * `CalendarPage`'s `handleFocusDateChange`/`handleToday`/`onChange` below.
 * "Sessions render as dots/labels colored per DES-04" is satisfied entirely
 * OUTSIDE `Calendar`'s own render tree, in the chronological session list
 * this file owns and controls completely:
 *   - Every row carries a real `Badge` (`variant='purple'|'blue'|'orange'`,
 *     module doc #2) as its `endContent` -- a `Badge` IS a colored *label*
 *     (the doc's own words: "Label -- Yes -- The text or number shown inside
 *     the badge", astryx-api.md line 511), so this alone satisfies the
 *     "labels colored per DES-04" half of CAL-01's wording, and simultaneously
 *     satisfies NAV-07's separate "every row carries a type Badge" mixing
 *     requirement (module doc #3) with the SAME element -- not a second,
 *     redundant badge.
 *   - A small legend (three real `Badge`s, one per type, same variants) sits
 *     directly between the grid and the filter control, so the DES-04 color
 *     key is visible immediately below the calendar, not just scrolled past
 *     it -- reinforcing (without literally rendering inside `DayCell`) that
 *     the grid above and the colored rows below are the same dataset.
 * This is the exact "plausible, disclosed-judgment-call resolution" the
 * packet itself outlines, confirmed correct (not just assumed) by reading
 * `DayCell`'s hard-coded JSX directly.
 *
 * -----------------------------------------------------------------------
 * 2. DES-04's exact named palette (PRD lines 186-193, cited verbatim):
 *
 * | Name | Hex (light / dark) | Use |
 * |---|---|---|
 * | Volt Violet | #5B2EE5 / #9B7BFF | Accent: primary buttons, active nav, ... |
 * | Circuit Blue | Astryx `blue` variant | Outreach type badge/cards |
 * | Meeting Violet | Astryx `purple` variant | Meeting type badge/cards |
 * | Comp Orange | Astryx `orange` variant | Competition type badge/cards |
 *
 * `CALENDAR_TYPE_BADGE` below maps `meeting -> 'purple'`,
 * `outreach -> 'blue'`, `competition -> 'orange'` -- Astryx `Badge`'s own
 * `variant` prop (astryx-api.md line 530's Props table includes `blue`,
 * `purple`, `orange` in its literal union), never a hand-rolled hex
 * (constitution item 2/13 concern -- a hex would also break dark-mode
 * theming, the same class of defect D005 already fixed once at the token
 * level, per the dispute-log entry astryx-api.md's own D005 annotation on
 * the `Button` Props table cites).
 *
 * -----------------------------------------------------------------------
 * 3. NAV-07's explicit exception (PRD line 90, cited verbatim): "No screen
 *    may render a combined meetings+outreach list except Calendar
 *    (`/calendar`) and per-student history in Reports, where every row
 *    carries a type `Badge`." Unlike `MeetingsList.tsx`/`OutreachList.tsx`
 *    (which each filter to exactly one `event.type`), `buildEnrichedSessions`
 *    below deliberately keeps all three types joined together, and every row
 *    (`CalendarSessionRowItem`) unconditionally renders a type `Badge` (module
 *    doc #1) -- never a Badge-less row, so the mixing stays visually legible
 *    per NAV-07's own condition for the exception.
 *
 * -----------------------------------------------------------------------
 * 4. Filter `SegmentedControl` -- four options, "All" first (CAL-01's own
 *    text, verbatim: "All | Meetings | Outreach | Competitions").
 *    `CALENDAR_FILTER_ITEMS` below is exactly that list in that order;
 *    "Competitions" maps to the real `type='competition'` value (confirmed
 *    at `supabase/migrations/20260717000000_scheduling_attendance.sql` line
 *    36's check constraint, `type in ('meeting', 'outreach', 'competition')`
 *    -- the same line the packet itself cites), never an invented
 *    "competitions" table/type -- T039 already established competition-type
 *    events are created via the outreach event dialog's own type Selector,
 *    not a separate table (confirmed by reading `event.type`'s check
 *    constraint directly; no separate `competitions` table exists anywhere
 *    in that migration).
 *
 * -----------------------------------------------------------------------
 * 5. BEH-08 date/duration rendering -- reused convention, not reinvented,
 *    but REIMPLEMENTED rather than imported.
 *
 * `formatWeekdayDate`/`formatTimeRangeWithDuration` below are a verbatim
 * reproduction of `MeetingsList.tsx`'s own same-named helpers (weekday name
 * + computed duration, "6:00-8:00 PM - 2h" per PRD line 237's worked
 * example, en-dash/middle-dot separators, meridiem-dedup via
 * `splitMeridiem`) -- NOT imported, because `src/pages/meetings/**` and
 * `src/pages/outreach/**` are both this task's Forbidden Files (read-only
 * reference only), the same posture `OutreachList.tsx`'s own module doc #NFR
 * section already took for the identical reason ("Independently
 * reimplemented here (not imported) -- `MeetingsList.tsx` is not in this
 * task's Allowed Files"). Both `Intl.DateTimeFormat` instances stay pinned
 * to `timeZone: 'America/Chicago'` per NFR-09, matching both sibling files.
 * `todayIsoChicago`/`CHICAGO_DATE_ONLY_FORMATTER` (the `en-CA`-locale
 * `YYYY-MM-DD` trick) mirrors the identical technique
 * `src/emails/templates/weekly-digest.tsx`'s `formatDateOnlyInChicago`
 * already established for computing an ISO date string from "now", in the
 * correct timezone, without manual date-part reassembly.
 *
 * -----------------------------------------------------------------------
 * 6. No shared Supabase client wired in -- deliberate scope, not a gap for
 *    this task to solve (same posture as every other content page in this
 *    batch). `loadSessions` (an injectable `LoadCalendarSessionsFn` seam,
 *    per the packet's own "obviously-fake fixture defaults" instruction)
 *    defaults to `defaultLoadCalendarSessions`, whose fixture data spans all
 *    three event types (one `meeting`, one `outreach`, one `competition`
 *    event, five sessions total across July and August 2026 so month
 *    navigation is genuinely exercised -- see `FIXTURE_EVENTS`/
 *    `FIXTURE_SESSIONS` below) -- Known Context/Traps #6's literal
 *    requirement.
 *
 * -----------------------------------------------------------------------
 * 7. NAV-08 click-through routes (CAL-02) -- real navigation elements,
 *    correct-looking destination paths, not required to render real content
 *    at the destination (this task's own Forbidden Files clause).
 *
 * NAV-08 (PRD line 89, cited verbatim): "every event/session detail is
 * URL-addressable -- `/outreach/:eventId` (outreach + competitions) and
 * `/meetings/:sessionId` (meeting detail page replacing the dialog in
 * CAL-02)." `CalendarSessionRowItem` below routes outreach/competition rows
 * through the already-real `routePaths.outreachEvent(event.id)` helper
 * (imported, read-only, from `../../app/router`, which this task's Forbidden
 * Files list explicitly allows import-only) -- that exact route IS already
 * wired in `router.tsx` (to a placeholder component, per that file's own
 * `OutreachEventPage`). Meeting rows route to the literal
 * `` `/meetings/${session.id}` `` path: `router.tsx`'s own `routePaths` object
 * has NO helper for this NAV-08 path (only `routePaths.meetings` -- the
 * plain list route -- and `routePaths.meetingLiveSession`, a DIFFERENT path,
 * `/meetings/live/:sessionId`, for the in-progress live console, confirmed
 * by reading that read-only file directly) and `router.tsx`'s own `<Routes>`
 * table has no `/meetings/:sessionId` route registered at all yet -- a real,
 * disclosed gap (this task cannot fix it: `router.tsx` is Forbidden/
 * import-only), not silently worked around. Per this task's own Forbidden
 * Files clause ("you are not required to prove those destination routes
 * render anything ... only that this page links to the correct path"), the
 * literal string is constructed directly against NAV-08's own quoted path
 * shape rather than left unbuilt or invented as some other shape.
 *
 * -----------------------------------------------------------------------
 * 8. Astryx prop sourcing (constitution item 2) -- every prop below,
 *    cross-checked against `docs/swarm/astryx-api.md` directly:
 *
 *  - `Calendar` (line 2286 section, Props table): `mode`, `weekStartsOn`,
 *    `focusDate`, `onFocusDateChange`, `onChange` used (module doc #1's
 *    resolution -- no invented prop).
 *  - `Badge` (line 493 section, Props table): `variant`
 *    (`'purple'|'blue'|'orange'`, module doc #2), `label` used.
 *  - `SegmentedControl` (line 5575 section, Props table): `value`
 *    (required), `onChange` (required), `label` (required) used.
 *    `SegmentedControlItem`'s own subsection is `undefined` (same disclosed
 *    CLI-cross-checked gap `OutreachList.tsx`/T038 already hit);
 *    `npm run astryx -- component SegmentedControlItem` (re-run live for
 *    this task) resolves `value` (required) + `label` (required) -- only
 *    those two used.
 *  - `Link` (line 1910 section, Props table): `as` (`RouterLink`, matching
 *    `LiveConsole.tsx`/T034's and `AdminToggles.tsx`/T021's own established
 *    `<Link as={RouterLink} href={...}>` SPA-navigation idiom), `href`,
 *    `isStandalone` used ("Do: Set isStandalone when the link appears
 *    outside of inline text", which this one does -- it lives in a
 *    `ListItem`'s `endContent`, not inline body text).
 *  - `List`/`ListItem`: `List`'s Props table (line 4536 section) --
 *    `children`, `hasDividers`, `header` used directly. `ListItem`'s own
 *    doc subsection is `undefined` (same disclosed gap `MeetingsList.tsx`/
 *    `OutreachList.tsx` already hit); `npm run astryx -- component ListItem`
 *    (re-run live for this task) resolves `label` (required), `description`,
 *    `endContent` -- only those three used (no `onClick`/`href` on the
 *    `ListItem` itself, so the row stays non-interactive and the doc's own
 *    "Don't place interactive elements inside an interactive list item"
 *    warning is never triggered -- the one real interactive element, the
 *    `Link`, lives in `endContent` of a non-interactive row).
 *  - `Heading`: doc's own "Components > Heading" subsection is `undefined`
 *    (same disclosed gap `RosterShell.tsx`/T021, `MeetingsList.tsx`/T030,
 *    `OutreachList.tsx`/T038 already hit); `npm run astryx -- component
 *    Heading` (re-run live) resolves `level` (1-6, required) + `children`
 *    (required) -- only those two used.
 *  - `Text` (line 829 section, Props table): `type` (`'supporting'`) used.
 *  - `Button` (line 1768 section, Props table): `label`, `variant`,
 *    `onClick` used.
 *  - `Banner` (line 2694 section, Props table): `status`, `title`,
 *    `description` used.
 *  - `EmptyState` (line 3954 section, Props table): `title` (required),
 *    `description`, `headingLevel` used.
 *  - `Skeleton` (T081, "Skeleton" section, lines 621-655): `width`,
 *    `height`, `index` used to preview this screen's predictable
 *    calendar-grid + chronological-list shape, replacing `Spinner`'s prior
 *    use here per Astryx's own guidance (known-dimension content).
 *    `VisuallyHidden` + the wrapping `VStack`'s `aria-busy` carry the
 *    "Loading calendar…" announcement `Spinner`'s `label` used to provide.
 *  - `VStack`/`HStack` ("Stack" section, line 319, `VStack`/`HStack`
 *    subsections): `gap`, `padding`, `hAlign`, `vAlign`, `wrap` used.
 *
 * -----------------------------------------------------------------------
 * 9. Constitution item 13 -- no box-drawing/bracket characters rendered.
 *    This file uses only the middle dot (`·`) and en dash (`–`) as visual
 *    separators, the SAME two Unicode punctuation characters
 *    `MeetingsList.tsx`/`OutreachList.tsx` already ship in passed tasks
 *    (e.g. `formatTimeRangeWithDuration`'s "6:00-8:00 PM - 2h" pattern) --
 *    neither is a box-drawing character (`┌─┐│└┘` etc.) or a literal
 *    bracket (`[`/`]`), the two things constitution item 13 actually bars.
 *
 * -----------------------------------------------------------------------
 * 10. DES-12 four states -- loading (`Spinner` while `loadSessions()` is
 *     pending) / error (`loadSessions()` rejects -- `Banner status="error"`)
 *     / empty (`loadSessions()` resolves zero sessions across all three
 *     types -- page-level `EmptyState`) / populated (`Calendar` + legend +
 *     filter + chronological list, with an independent smaller `EmptyState`
 *     when the current month/filter/day-selection combination has zero
 *     matching sessions even though sessions exist elsewhere).
 */
import { useEffect, useState, type ReactNode } from 'react';
import {
  Badge,
  Banner,
  Button,
  Calendar,
  EmptyState,
  Heading,
  HStack,
  Link,
  List,
  ListItem,
  SegmentedControl,
  SegmentedControlItem,
  Skeleton,
  Text,
  VisuallyHidden,
  VStack,
  type ISODateString,
} from '@astryxdesign/core';
import { Link as RouterLink } from 'react-router-dom';
import { routePaths } from '../../app/router';

// ---------------------------------------------------------------------------
// Types -- verbatim camelCase renames of the real `events`/`event_sessions`
// column subsets this screen renders. Ground truth cited directly from
// `supabase/migrations/20260717000000_scheduling_attendance.sql` lines 33-63
// (read-only), same convention `MeetingsList.tsx`/`OutreachList.tsx`
// established (module doc #1's citation, not redefined here).
// ---------------------------------------------------------------------------

export type CalendarEventType = 'meeting' | 'outreach' | 'competition';
export type CalendarSessionStatus = 'scheduled' | 'completed' | 'canceled';

export interface CalendarEventRow {
  id: string;
  seasonId: string;
  type: CalendarEventType;
  title: string;
  locationName: string;
}

export interface CalendarSessionRow {
  id: string;
  eventId: string;
  /** `event_sessions.session_date`, 'YYYY-MM-DD'. */
  sessionDate: string;
  startsAt: string;
  endsAt: string;
  status: CalendarSessionStatus;
}

export interface CalendarLoadResult {
  events: readonly CalendarEventRow[];
  sessions: readonly CalendarSessionRow[];
}

/** Injectable data-loading seam (Known Context/Traps #1/#6). Defaults to
 * `defaultLoadCalendarSessions`'s fixture data below. */
export type LoadCalendarSessionsFn = () => Promise<CalendarLoadResult>;

export interface EnrichedCalendarSession {
  session: CalendarSessionRow;
  event: CalendarEventRow;
}

// ---------------------------------------------------------------------------
// Placeholder identifiers -- same class of gap `MeetingsList.tsx`/
// `OutreachList.tsx` already disclosed (`PLACEHOLDER_CURRENT_SEASON_ID`).
// ---------------------------------------------------------------------------

const PLACEHOLDER_SEASON_ID = 'season-placeholder-current';

// ---------------------------------------------------------------------------
// Fixture data (constitution item 6: fabricated names only). Spans all three
// event types, across two different months, so month navigation AND the
// type filter are both genuinely exercised (Known Context/Traps #6).
// ---------------------------------------------------------------------------

const FIXTURE_EVENTS: readonly CalendarEventRow[] = [
  {
    id: 'event-weekly-build',
    seasonId: PLACEHOLDER_SEASON_ID,
    type: 'meeting',
    title: 'Weekly Build Meeting',
    locationName: 'Clubhouse',
  },
  {
    id: 'event-food-bank-sort',
    seasonId: PLACEHOLDER_SEASON_ID,
    type: 'outreach',
    title: 'Community Food Bank Sort',
    locationName: 'Riverside Food Bank',
  },
  {
    id: 'event-regional-qualifier',
    seasonId: PLACEHOLDER_SEASON_ID,
    type: 'competition',
    title: 'Regional Qualifier',
    locationName: 'Midtown Arena',
  },
];

const FIXTURE_SESSIONS: readonly CalendarSessionRow[] = [
  {
    id: 'session-build-past',
    eventId: 'event-weekly-build',
    sessionDate: '2026-07-08',
    startsAt: '2026-07-08T23:00:00.000Z', // 6:00 PM America/Chicago (CDT)
    endsAt: '2026-07-09T01:00:00.000Z', // 8:00 PM America/Chicago
    status: 'completed',
  },
  {
    id: 'session-build-upcoming',
    eventId: 'event-weekly-build',
    sessionDate: '2026-07-22',
    startsAt: '2026-07-22T23:00:00.000Z',
    endsAt: '2026-07-23T01:00:00.000Z',
    status: 'scheduled',
  },
  {
    id: 'session-food-bank',
    eventId: 'event-food-bank-sort',
    sessionDate: '2026-07-26',
    startsAt: '2026-07-26T15:00:00.000Z', // 10:00 AM America/Chicago
    endsAt: '2026-07-26T18:00:00.000Z', // 1:00 PM America/Chicago
    status: 'scheduled',
  },
  {
    id: 'session-regional-july',
    eventId: 'event-regional-qualifier',
    sessionDate: '2026-07-30',
    startsAt: '2026-07-30T13:00:00.000Z', // 8:00 AM America/Chicago
    endsAt: '2026-07-30T21:00:00.000Z', // 4:00 PM America/Chicago
    status: 'scheduled',
  },
  {
    id: 'session-regional-august',
    eventId: 'event-regional-qualifier',
    sessionDate: '2026-08-08',
    startsAt: '2026-08-08T13:00:00.000Z',
    endsAt: '2026-08-08T21:00:00.000Z',
    status: 'scheduled',
  },
];

// ---------------------------------------------------------------------------
// Pure functions -- exported for direct testing.
// ---------------------------------------------------------------------------

/** `session_date` ('YYYY-MM-DD') -> a real calendar date, parsed without a
 * local-timezone day-shift (BEH-08 needs the literal stored date). Verbatim
 * reproduction of `MeetingsList.tsx`/`OutreachList.tsx`'s own helper --
 * module doc #5. */
function parseDateOnly(isoDate: string): Date {
  const [year, month, day] = isoDate.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day, 12)); // noon UTC avoids DST edge cases
}

/** Joins every session to its parent event; drops any session whose event id
 * doesn't resolve (defensive, mirrors the sibling files' identical join). */
export function buildEnrichedSessions(
  events: readonly CalendarEventRow[],
  sessions: readonly CalendarSessionRow[],
): EnrichedCalendarSession[] {
  const eventById = new Map(events.map((event) => [event.id, event] as const));
  const enriched: EnrichedCalendarSession[] = [];
  for (const session of sessions) {
    const event = eventById.get(session.eventId);
    if (event) enriched.push({ session, event });
  }
  return enriched;
}

/** Sessions whose `sessionDate` falls in the given calendar month
 * (`month` is 1-12), sorted chronologically by start time -- the grid's own
 * real job (month navigation, module doc #1) driving what the list below
 * shows. */
export function sessionsInMonth(
  enriched: readonly EnrichedCalendarSession[],
  year: number,
  month: number,
): EnrichedCalendarSession[] {
  return enriched
    .filter(({ session }) => {
      const date = parseDateOnly(session.sessionDate);
      return date.getUTCFullYear() === year && date.getUTCMonth() + 1 === month;
    })
    .sort((a, b) => a.session.startsAt.localeCompare(b.session.startsAt));
}

/** Sessions on one specific day -- the grid's other real job (date
 * selection via `mode="single"`/`onChange`, module doc #1). */
export function sessionsOnDay(
  enriched: readonly EnrichedCalendarSession[],
  dayIso: string,
): EnrichedCalendarSession[] {
  return enriched.filter(({ session }) => session.sessionDate === dayIso);
}

/** CAL-01's four filter options, "All" first (module doc #4). */
export const CALENDAR_FILTER_ITEMS = [
  { value: 'all', label: 'All' },
  { value: 'meeting', label: 'Meetings' },
  { value: 'outreach', label: 'Outreach' },
  { value: 'competition', label: 'Competitions' },
] as const;

export type CalendarFilterValue = (typeof CALENDAR_FILTER_ITEMS)[number]['value'];

export function filterByType(
  enriched: readonly EnrichedCalendarSession[],
  filter: CalendarFilterValue,
): EnrichedCalendarSession[] {
  if (filter === 'all') return [...enriched];
  return enriched.filter(({ event }) => event.type === filter);
}

// ---------------------------------------------------------------------------
// Fixture loader -- obviously-fake default for the injectable `loadSessions`
// seam (Known Context/Traps #1/#6).
// ---------------------------------------------------------------------------

export async function defaultLoadCalendarSessions(): Promise<CalendarLoadResult> {
  return { events: FIXTURE_EVENTS, sessions: FIXTURE_SESSIONS };
}

// ---------------------------------------------------------------------------
// BEH-08 / NFR-09 date + duration formatting -- module doc #5. Verbatim
// reproduction of `MeetingsList.tsx`'s own same-named helpers, NOT imported
// (that file is a Forbidden File for this task).
// ---------------------------------------------------------------------------

const CHICAGO_TIME_ZONE = 'America/Chicago';

const CHICAGO_DATE_ONLY_FORMATTER = new Intl.DateTimeFormat('en-CA', {
  timeZone: CHICAGO_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

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

const MONTH_YEAR_FORMATTER = new Intl.DateTimeFormat('en-US', {
  month: 'long',
  year: 'numeric',
  timeZone: CHICAGO_TIME_ZONE,
});

/** "today", as an ISO date string, per NFR-09's America/Chicago timezone --
 * the `en-CA`-locale `YYYY-MM-DD` trick `weekly-digest.tsx`'s
 * `formatDateOnlyInChicago` already established (module doc #5). */
export function todayIsoChicago(): string {
  return CHICAGO_DATE_ONLY_FORMATTER.format(new Date());
}

/** e.g. "Sat, Jul 25" (BEH-08). */
export function formatWeekdayDate(sessionDate: string): string {
  return WEEKDAY_DATE_FORMATTER.format(parseDateOnly(sessionDate));
}

/** e.g. "2h", "1h 30m", "45m" (BEH-08's computed-duration requirement). */
function formatDuration(startsAt: string, endsAt: string): string {
  const totalMinutes = Math.round(
    (new Date(endsAt).getTime() - new Date(startsAt).getTime()) / 60000,
  );
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) return `${minutes}m`;
  if (minutes === 0) return `${hours}h`;
  return `${hours}h ${minutes}m`;
}

/** Splits a formatted "6:00 PM"-shaped string into its numeric time and
 * trailing meridiem, so `formatTimeRangeWithDuration` below can drop a
 * duplicate meridiem off the start time (PRD line 237's own worked example,
 * "6:00-8:00 PM"). */
function splitMeridiem(formatted: string): { time: string; meridiem: string | null } {
  const match = /^(.*?)\s?([AP]M)$/i.exec(formatted);
  return match ? { time: match[1], meridiem: match[2] } : { time: formatted, meridiem: null };
}

/** e.g. "6:00-8:00 PM · 2h" (PRD BEH-08's own worked example, en-dash
 * separator, middle-dot before the duration -- module doc #9). */
export function formatTimeRangeWithDuration(startsAt: string, endsAt: string): string {
  const startFormatted = CLOCK_TIME_FORMATTER.format(new Date(startsAt));
  const endFormatted = CLOCK_TIME_FORMATTER.format(new Date(endsAt));
  const start = splitMeridiem(startFormatted);
  const end = splitMeridiem(endFormatted);
  const startText =
    start.meridiem !== null && start.meridiem === end.meridiem ? start.time : startFormatted;
  return `${startText}–${endFormatted} · ${formatDuration(startsAt, endsAt)}`;
}

function monthLabel(year: number, month: number): string {
  return MONTH_YEAR_FORMATTER.format(new Date(Date.UTC(year, month - 1, 15, 12)));
}

// ---------------------------------------------------------------------------
// Type -> Badge variant mapping -- DES-04's named palette (module doc #2).
// ---------------------------------------------------------------------------

const CALENDAR_TYPE_BADGE: Record<
  CalendarEventType,
  { variant: 'purple' | 'blue' | 'orange'; label: string }
> = {
  meeting: { variant: 'purple', label: 'Meeting' }, // Meeting Violet
  outreach: { variant: 'blue', label: 'Outreach' }, // Circuit Blue
  competition: { variant: 'orange', label: 'Competition' }, // Comp Orange
};

// ---------------------------------------------------------------------------
// NAV-08 detail routes (module doc #7).
// ---------------------------------------------------------------------------

function detailHrefFor(event: CalendarEventRow, session: CalendarSessionRow): string {
  if (event.type === 'meeting') {
    // NAV-08: "/meetings/:sessionId (meeting detail page ...)". No
    // `routePaths` helper exists for this exact path yet (module doc #7) --
    // constructed directly against NAV-08's own quoted shape.
    return `/meetings/${session.id}`;
  }
  // NAV-08: "/outreach/:eventId (outreach + competitions)".
  return routePaths.outreachEvent(event.id);
}

// ---------------------------------------------------------------------------
// Session row -- module docs #1/#3/#7/#8.
// ---------------------------------------------------------------------------

function CalendarSessionRowItem({
  session,
  event,
}: {
  session: CalendarSessionRow;
  event: CalendarEventRow;
}): ReactNode {
  const typeBadge = CALENDAR_TYPE_BADGE[event.type];

  const description = (
    <Text type="supporting">
      {formatWeekdayDate(session.sessionDate)} ·{' '}
      {formatTimeRangeWithDuration(session.startsAt, session.endsAt)} · {event.locationName}
    </Text>
  );

  const endContent = (
    <HStack gap={2} vAlign="center">
      <Badge variant={typeBadge.variant} label={typeBadge.label} />
      <Link as={RouterLink} href={detailHrefFor(event, session)} isStandalone>
        View details – {event.title}
      </Link>
    </HStack>
  );

  return <ListItem label={event.title} description={description} endContent={endContent} />;
}

// ---------------------------------------------------------------------------
// Generic DES-12 load-state hook -- same shape `MeetingsList.tsx`/
// `OutreachList.tsx` each define locally (no shared hook module exists in
// this repo yet -- disclosed duplication, not a gap unique to this file).
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
// Top-level component -- module docs #1/#10.
// ---------------------------------------------------------------------------

export interface CalendarPageProps {
  /** Injectable data-loading seam (Known Context/Traps #1/#6). Defaults to
   * fixture data. */
  loadSessions?: LoadCalendarSessionsFn;
}

export function CalendarPage({
  loadSessions = defaultLoadCalendarSessions,
}: CalendarPageProps = {}): ReactNode {
  const loadState = useLoadState(loadSessions, [loadSessions]);

  const [focusDateIso, setFocusDateIso] = useState<string>(() => todayIsoChicago());
  const [selectedDayIso, setSelectedDayIso] = useState<string | null>(null);
  // Bumped whenever the visible month/"Today"/"Show whole month" changes, to
  // remount `Calendar` and clear its own uncontrolled day-selection highlight
  // (module doc #1 -- a real React `key` remount, not an Astryx internal).
  const [calendarResetKey, setCalendarResetKey] = useState(0);
  const [filter, setFilter] = useState<CalendarFilterValue>('all');

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

  function handleShowWholeMonth(): void {
    setSelectedDayIso(null);
    setCalendarResetKey((key) => key + 1);
  }

  if (loadState.status === 'loading') {
    return (
      <VStack gap={4} padding={6} aria-busy="true">
        <VisuallyHidden as="div" role="status">
          Loading calendar…
        </VisuallyHidden>
        <HStack hAlign="between" vAlign="center" wrap="wrap" gap={3}>
          <Skeleton width={140} height={28} index={0} />
          <Skeleton width={80} height={32} index={1} />
        </HStack>
        <Skeleton width="100%" height={320} index={2} />
        <VStack gap={2}>
          {[0, 1, 2].map((row) => (
            <HStack key={row} gap={3} vAlign="center">
              <Skeleton width={16} height={16} radius="rounded" index={row + 3} />
              <Skeleton width={220} height={16} index={row + 6} />
            </HStack>
          ))}
        </VStack>
      </VStack>
    );
  }

  if (loadState.status === 'error') {
    return (
      <VStack gap={4} padding={6}>
        <Banner
          status="error"
          title="Couldn't load the calendar"
          description="Something went wrong loading this season's sessions. Try refreshing the page."
          endContent={<Button variant="ghost" label="Retry" onClick={loadState.retry} />}
        />
      </VStack>
    );
  }

  const enriched = buildEnrichedSessions(loadState.data.events, loadState.data.sessions);
  const hasAnySessions = enriched.length > 0;

  const focusDate = parseDateOnly(focusDateIso);
  const focusYear = focusDate.getUTCFullYear();
  const focusMonth = focusDate.getUTCMonth() + 1;

  const monthSessions = sessionsInMonth(enriched, focusYear, focusMonth);
  const typeFiltered = filterByType(monthSessions, filter);
  const visibleSessions =
    selectedDayIso !== null ? sessionsOnDay(typeFiltered, selectedDayIso) : typeFiltered;

  return (
    <VStack gap={6} padding={6}>
      <HStack hAlign="between" vAlign="center" wrap="wrap" gap={3}>
        <Heading level={1}>Calendar</Heading>
        <Button label="Today" variant="secondary" onClick={handleToday} />
      </HStack>

      {!hasAnySessions ? (
        <EmptyState
          headingLevel={2}
          title="No sessions scheduled yet"
          description="Meetings, outreach events, and competitions for this season will show up here once they're scheduled."
        />
      ) : (
        <>
          <Calendar
            key={calendarResetKey}
            mode="single"
            weekStartsOn="sun"
            focusDate={focusDateIso as ISODateString}
            onFocusDateChange={handleFocusDateChange}
            onChange={(iso) => setSelectedDayIso(iso)}
          />

          {/* DES-04 color legend -- module doc #1's resolution: the dots/
              labels live here and in the list below, not inside the grid. */}
          <HStack gap={2} wrap="wrap">
            <Badge variant="purple" label="Meeting" />
            <Badge variant="blue" label="Outreach" />
            <Badge variant="orange" label="Competition" />
          </HStack>

          <SegmentedControl
            value={filter}
            onChange={(value) => setFilter(value as CalendarFilterValue)}
            label="Filter sessions by type"
          >
            {CALENDAR_FILTER_ITEMS.map((item) => (
              <SegmentedControlItem key={item.value} value={item.value} label={item.label} />
            ))}
          </SegmentedControl>

          <VStack gap={3}>
            <HStack hAlign="between" vAlign="center" wrap="wrap" gap={2}>
              <Heading level={2}>
                {selectedDayIso !== null
                  ? `Sessions on ${formatWeekdayDate(selectedDayIso)}`
                  : `Sessions in ${monthLabel(focusYear, focusMonth)}`}
              </Heading>
              {selectedDayIso !== null && (
                <Button label="Show whole month" variant="ghost" onClick={handleShowWholeMonth} />
              )}
            </HStack>

            {visibleSessions.length === 0 ? (
              <EmptyState
                headingLevel={3}
                title="No sessions match this view"
                description="Try a different month, a different type filter, or clear the day selection."
              />
            ) : (
              <List hasDividers header="Chronological session list">
                {visibleSessions.map(({ session, event }) => (
                  <CalendarSessionRowItem key={session.id} session={session} event={event} />
                ))}
              </List>
            )}
          </VStack>
        </>
      )}
    </VStack>
  );
}

export default CalendarPage;
