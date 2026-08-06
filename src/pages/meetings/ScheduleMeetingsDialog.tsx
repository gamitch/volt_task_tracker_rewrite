/**
 * T031: "Schedule meetings" dialog (MTG-02), PRD line 273:
 *
 * "**MTG-02** **Schedule meetings** `Dialog purpose="form"`: title (default
 * "Team meeting"), team scope (`MultiSelector` of teams, default all),
 * location, schedule mode (`SegmentedControl`: Single | Weekly recurring |
 * Custom dates -- parity with the current app), date/time pickers
 * (`DateInput`/`TimeInput`, `DateRangeInput` for recurring range, weekday
 * `CheckboxList` for recurring), notes. Creates one `events` row (type
 * `meeting`) + one `event_sessions` row per date. Nothing is created until
 * **Create meetings** is clicked; the button is disabled until title + at
 * least one valid date exist."
 *
 * PRD line 385 (constitution item 13): "Dialog forms render fields **in the
 * exact order listed** in MTG-02 ... and OUT-02." The field order below is
 * therefore literal, not a suggestion: title -> team scope -> location ->
 * schedule mode -> date/time pickers -> notes.
 *
 * This is a standalone dialog component with its own injectable
 * `onCreateMeetings` prop and its own fixture team list (Known Context/
 * Traps #4 / this task's Allowed Files) -- `MeetingsList.tsx` (T030) is a
 * forbidden/read-only file here and is NOT wired to this dialog by this
 * task; a future wiring task connects `MeetingsList.tsx`'s already-built
 * "Schedule meetings" button/stub `Banner` to this component.
 *
 * -----------------------------------------------------------------------
 * 1. THE `event_sessions.notes` NULLABILITY QUESTION (Known Context/Traps
 *    #1) -- resolved as option (a): **always supply a value**, never a
 *    migration.
 *
 * `supabase/migrations/20260717000000_scheduling_attendance.sql` line 61
 * defines `event_sessions.notes text not null` with no default. Checked
 * `git log --oneline -- supabase/migrations/` before writing anything below
 * (result: only T009/T010/T011/T012/T013/T019 migrations exist -- no T039
 * migration has landed, so this question has not been resolved by a
 * concurrent task yet). `buildEventSessionsPayload` below always includes
 * `notes: notes` where the caller-supplied `notes` state defaults to `''`
 * (never `undefined`/`null`), so every `event_sessions` row this dialog
 * would ever produce already satisfies the `not null` constraint as
 * written. No new migration is shipped by this task, and
 * `20260717000000_scheduling_attendance.sql` itself is untouched (read-only
 * per Forbidden Files / constitution item 10). The exact same
 * always-supply-a-value treatment is additionally applied, for the same
 * reason, to the *other* `not null`-with-no-default `events` text columns
 * this dialog's field set (title, team scope, location, schedule mode,
 * date/time pickers, notes) does NOT collect -- `events.description` and
 * `events.address` (migration lines 38/40) -- both default to `''` in the
 * payload below rather than blocking the button on fields MTG-02 never
 * asked for. This is a disclosed stand-in, not a schema change.
 *
 * -----------------------------------------------------------------------
 * 2. BEH-07 computed-outcome confirm button (PRD line 236) -- checker-
 *    enforced, not cosmetic.
 *
 * `computeConfirmLabel` below is the ONLY place the "Create meetings"
 * button's label is produced, for every schedule mode, including the
 * disabled (zero valid dates) case -- never a bare "Create"/"Submit"/"OK".
 * "Create 1 meeting" (singular) / "Create 14 meetings" (plural) / "Create 0
 * meetings" (nothing valid picked yet, button disabled) are all genuinely
 * computed from `sessionDates.length`, never hardcoded copy.
 *
 * -----------------------------------------------------------------------
 * 3. Session-generation math (Known Context/Traps #3) -- the core logic,
 *    proven by `ScheduleMeetingsDialog.test.tsx`.
 *
 * Three pure, independently exported, independently testable generators,
 * one per schedule mode -- `computeScheduleSessionDates` below is the only
 * function that branches on `mode`, dispatching to exactly one of:
 *   - `generateSingleSessionDates(date)` -- `[date]` or `[]`.
 *   - `generateRecurringSessionDates(range, weekdays)` -- walks every
 *     calendar day from `range.start` to `range.end` INCLUSIVE (both
 *     boundary dates count if their weekday matches -- the off-by-one class
 *     of bug this task's packet explicitly warns about), keeping only the
 *     days whose weekday is in the selected set.
 *   - `generateCustomSessionDates(dates)` -- de-duplicates + sorts an
 *     explicit list of picked dates.
 * All three operate on plain ISO date strings (`'YYYY-MM-DD'`) using the
 * same noon-UTC parsing trick `MeetingsList.tsx`'s `parseDateOnly`
 * established (avoids local-timezone day-shift when walking dates) --
 * necessarily reimplemented here (not imported) since `MeetingsList.tsx` is
 * a forbidden/read-only file for this task.
 *
 * -----------------------------------------------------------------------
 * 4. No shared Supabase client wired in (Known Context/Traps #4) -- the
 *    real `events`/`event_sessions` INSERT is an injectable
 *    `onCreateMeetings: (payload) => Promise<void>` prop, defaulting to
 *    `defaultOnCreateMeetings`, an obviously-fake stub that only
 *    `console.warn`s the payload it would have inserted. Same posture as
 *    every prior content page (`MeetingsList.tsx`'s `loadCoachData`/
 *    `loadStudentData`, `OutreachList.tsx`, `ParticipationTab.tsx`, etc.).
 *
 * -----------------------------------------------------------------------
 * 5. "Disabled until title + >=1 valid date" (Known Context/Traps #5) --
 *    genuinely non-interactive, not just styled.
 *
 * The "Create meetings" `Button` below is given `isDisabled` with NO
 * `tooltip` prop -- per the Button doc's own Props table ("isDisabled ...
 * When a tooltip is present, uses aria-disabled instead of native disabled
 * so the button stays focusable"), the absence of `tooltip` means a real
 * native HTML `disabled` attribute is rendered, which the browser (and
 * React's synthetic event system) refuses to dispatch click events through
 * at all -- not a CSS-only look. `isValid` (title trimmed non-empty AND
 * >=1 fully-formed session -- see module doc #6) is the only thing gating
 * it, proven independently for all three modes in the test file.
 *
 * -----------------------------------------------------------------------
 * 6. Why "valid date" here means date + time, not date alone.
 *
 * A bare calendar date cannot produce a valid `event_sessions` row --
 * `starts_at`/`ends_at` are both `timestamptz not null` (migration lines
 * 57-58). `buildEventSessionsPayload` returns `[]` (zero valid sessions) if
 * either `startTime`/`endTime` is `undefined`, so the confirm button stays
 * disabled in that case too. In practice this rarely surfaces: both time
 * fields carry a smart BEH-07 default (6:00-8:00 PM, `DEFAULT_START_TIME`/
 * `DEFAULT_END_TIME` below, a disclosed stand-in for "the creator's
 * last-used time" per BEH-07's own text, since no persisted per-creator
 * history exists yet) and neither renders a clear button (`hasClear`
 * defaults to `false`, left unset below), so a user has to deliberately
 * type over them to reach the invalid state.
 *
 * -----------------------------------------------------------------------
 * 7. America/Chicago wall-clock -> UTC conversion (NFR-09) -- the reverse
 *    of `MeetingsList.tsx`'s stored-UTC -> displayed-Chicago direction.
 *
 * `chicagoWallTimeToUtcIso` uses the standard `Intl.DateTimeFormat`
 * round-trip trick (format a naive-UTC instant back through the target
 * time zone, diff the two to get that instant's real UTC offset, then
 * re-apply it) to convert a user-picked Chicago wall-clock time into the
 * correct UTC `timestamptz` string, correctly varying between CDT (-5, the
 * "6:00 PM Chicago -> 23:00 UTC" case `MeetingsList.tsx`'s own July
 * fixture sessions already exercise) and CST (-6, exercised by this file's
 * own January test case) depending on the session's calendar date.
 *
 * -----------------------------------------------------------------------
 * 8. Astryx prop sourcing (constitution item 2) -- every prop below,
 *    cross-checked directly against `docs/swarm/astryx-api.md` (grepped
 *    live for this task, not assumed):
 *
 *  - `Dialog`: "Dialog" Props table. `isOpen`, `onOpenChange`, `children`,
 *    `purpose` ("form", per MTG-02's own literal text) used.
 *  - `DialogHeader`: doc's own "Components > DialogHeader" subsection is
 *    `undefined` (same disclosed gap `RosterShell.tsx`/`Kiosk.tsx`/
 *    `MeetingsList.tsx` already hit for sibling `undefined` Components
 *    subsections) -- its props are instead taken directly from the
 *    "Dialog" section's own worked `## Example` code block (`title`,
 *    `onOpenChange`), which is non-hallucinated doc content, not invented.
 *  - `Layout`/`LayoutContent`/`LayoutFooter`: "Layout" Props table +
 *    `node_modules/@astryxdesign/core/dist/Layout/LayoutContent.d.ts` /
 *    `LayoutFooter.d.ts` (confirmed directly, since the doc's own
 *    Components subsections for both are `undefined`). `header`, `content`,
 *    `footer` (Layout); `children` (LayoutContent); `children`,
 *    `hasDivider` (LayoutFooter) used.
 *  - `FormLayout`: "FormLayout" Props table. `children` used (default
 *    `direction="vertical"`, matching the doc's own "Do: stack fields
 *    vertically for most forms" guidance).
 *  - `TextInput`: "TextInput" Props table. `label`, `value`, `onChange`,
 *    `isRequired` (title only, per BEH-07's own required-field
 *    convention), `placeholder` used.
 *  - `MultiSelector`: "MultiSelector" Props table. `label`, `options`,
 *    `value`, `onChange`, `hasSelectAll`, `triggerDisplay="labels"` used.
 *  - `SegmentedControl`/`SegmentedControlItem`: "SegmentedControl" Props
 *    table + `node_modules/@astryxdesign/core/dist/SegmentedControl/
 *    SegmentedControlItem.d.ts` (doc's own Components subsection is
 *    `undefined`). `value`, `onChange`, `label`, `children`
 *    (SegmentedControl); `value`, `label` (SegmentedControlItem) used.
 *  - `DateInput`: "DateInput" Props table. `label`, `value`, `onChange`,
 *    `isRequired` used.
 *  - `TimeInput`: "TimeInput" Props table. `label`, `value`, `onChange`,
 *    `isRequired` used.
 *  - `DateRangeInput`: "DateRangeInput" Props table. `label`, `value`,
 *    `onChange`, `presets` used (a real "Next 6 weeks" quick-pick, also
 *    doubles as this file's own DOM-testable path into weekly mode's
 *    enabled-button state -- see test file).
 *  - `CheckboxList`/`CheckboxListItem`: "CheckboxList" Props table +
 *    `node_modules/@astryxdesign/core/dist/CheckboxList/
 *    CheckboxListItem.d.ts` (doc's own Components subsection is
 *    `undefined`). `label`, `value`, `onChange`, `hasDividers`
 *    (CheckboxList); `label`, `value` (CheckboxListItem) used.
 *  - `TextArea`: "TextArea" Props table. `label`, `value`, `onChange`,
 *    `isOptional`, `rows` used.
 *  - `List`/`ListItem`: "List" Props table + doc's own `undefined`
 *    Components subsection for `ListItem`, so
 *    `node_modules/@astryxdesign/core/dist/List/ListItem.d.ts` confirmed
 *    directly (same posture `MeetingsList.tsx` already established).
 *    `hasDividers`, `header`, `children` (List); `label`, `endContent`
 *    (ListItem) used.
 *  - `Button`: "Button" Props table. `label`, `variant`, `size`,
 *    `isDisabled`, `onClick`, `clickAction` used (module doc #5 --
 *    deliberately no `tooltip` on the disabled confirm button, so it stays
 *    natively `disabled`).
 *  - `Banner`: "Banner" Props table. `status`, `title`, `description`
 *    used (submit-error state only).
 *  - `HStack`/`VStack`: "Stack" section, `HStack`/`VStack` subsections.
 *    `gap`, `hAlign`, `vAlign`, `wrap` used.
 *  - `Text`: "Text" Props table. `type="supporting"` used.
 *
 * -----------------------------------------------------------------------
 * 9. T125 (UXP-09, PRD UXD-06 "Form layout standard") -- full-height
 *    sectioned re-layout. PURE LAYOUT change: zero handler/state/payload
 *    logic touched below (every function above this component is
 *    byte-identical to the pre-T125 version; only the returned JSX tree
 *    changed).
 *
 * The single flat `<FormLayout>` this dialog used to render every field
 * into is replaced by `<EventFormLayout>` + `<EventFormSection>`
 * (`../../components/forms/EventFormLayout.tsx`, shared with
 * `OutreachEventDialog.tsx`/T125's other half -- that file's own module doc
 * has the full Astryx-sourcing writeup for `Section`/`Heading`) inside a
 * `<Dialog variant="fullscreen">` (that file's module doc #1 -- a real,
 * non-hallucinated "full-height panel" Astryx `Dialog` variant, cross-
 * checked against `docs/swarm/astryx-api.md`'s own "# Dialog" Props table
 * and `node_modules/@astryxdesign/core/dist/Dialog/Dialog.d.ts`). Sections,
 * in DOM/tab order (constitution item 13's MTG-02 field order is
 * UNCHANGED -- every field below still appears in the exact same relative
 * sequence it always did; sections only add heading wrappers around
 * contiguous runs of that same order, never reorder anything):
 *   - "Basics": title, team scope. This dialog has no `type`/status-badge
 *     field (module doc, top of file: MTG-02 always creates `type
 *     'meeting'` events) -- unlike `OutreachEventDialog.tsx`'s "Basics"
 *     section, so it is a thinner section here, by design (this task's own
 *     packet: "adapt to each dialog's real fields").
 *   - "Location": the single `Location` field. Kept as its own section
 *     (unlike `OutreachEventDialog.tsx`, which folds its 2-field location
 *     group into "Basics" for field-order reasons -- see that file's own
 *     module doc 12) since it sits alone between "Basics" and "Schedule" in
 *     MTG-02's literal order and needs no adjacent field to share a
 *     section with.
 *   - "Schedule": schedule mode `SegmentedControl`, its per-mode inputs,
 *     and the shared start/end `TimeInput`s.
 *   - "Notes" (`hasDivider={false}`, the last section): the `notes`
 *     `TextArea`.
 * This dialog has no UXP-01/02 attendance-roster or hours/goal fields (it
 * only ever creates `type 'meeting'` events -- module doc, top of file), so
 * neither a "Teams & attendees" roster-checklist section nor an "Hours &
 * goal" section applies here; this task's own packet explicitly scopes
 * those two named sections to "adapt to each dialog's real fields."
 * The submit-error `Banner` renders after all sections, inside
 * `EventFormLayout`'s own centered column, exactly where it rendered inside
 * the old flat `FormLayout` (last child).
 */
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  AlertDialog,
  Banner,
  Button,
  CheckboxList,
  CheckboxListItem,
  DateInput,
  DateRangeInput,
  Dialog,
  DialogHeader,
  HStack,
  Layout,
  LayoutContent,
  LayoutFooter,
  List,
  ListItem,
  MultiSelector,
  SegmentedControl,
  SegmentedControlItem,
  Text,
  TextArea,
  TextInput,
  TimeInput,
  VStack,
  createISOTimeString,
  type DateRange,
  type ISODateString,
  type ISOTimeString,
} from '@astryxdesign/core';
// T125 (UXP-09 / UXD-06) module doc 9 -- shared full-height sectioned-form
// primitives, consumed by both this file and `OutreachEventDialog.tsx`.
import { EventFormLayout, EventFormSection } from '../../components/forms/EventFormLayout';

// ---------------------------------------------------------------------------
// Types -- verbatim camelCase shapes of the real `events`/`event_sessions`
// columns this dialog's field set actually collects (module doc #1).
// ---------------------------------------------------------------------------

export type ScheduleMode = 'single' | 'weekly' | 'custom';

export interface ScheduleTeamOption {
  id: string;
  name: string;
}

export interface CreateMeetingsEventPayload {
  title: string;
  /** `null` = all teams (matches `events.team_ids` NULL semantics). */
  teamIds: string[] | null;
  locationName: string;
  /** Module doc #1 -- not an MTG-02 field, defaulted, never left `null`/`undefined`. */
  description: string;
  /** Module doc #1 -- not an MTG-02 field, defaulted, never left `null`/`undefined`. */
  address: string;
}

export interface CreateMeetingsSessionPayload {
  sessionDate: string;
  startsAt: string;
  endsAt: string;
  /** Module doc #1 -- Trap #1 resolution: always a string, never `null`/`undefined`. */
  notes: string;
}

export interface CreateMeetingsPayload {
  event: CreateMeetingsEventPayload;
  sessions: CreateMeetingsSessionPayload[];
}

export type OnCreateMeetingsFn = (payload: CreateMeetingsPayload) => Promise<void>;

const DEFAULT_TITLE = 'Team meeting';
// Module doc #6 -- BEH-07 smart default stand-in for "creator's last-used time".
const DEFAULT_START_TIME: ISOTimeString | undefined = createISOTimeString('18:00') ?? undefined;
const DEFAULT_END_TIME: ISOTimeString | undefined = createISOTimeString('20:00') ?? undefined;

const WEEKDAY_OPTIONS: ReadonlyArray<{ value: string; label: string; dayIndex: number }> = [
  { value: 'mon', label: 'Mon', dayIndex: 1 },
  { value: 'tue', label: 'Tue', dayIndex: 2 },
  { value: 'wed', label: 'Wed', dayIndex: 3 },
  { value: 'thu', label: 'Thu', dayIndex: 4 },
  { value: 'fri', label: 'Fri', dayIndex: 5 },
  { value: 'sat', label: 'Sat', dayIndex: 6 },
  { value: 'sun', label: 'Sun', dayIndex: 0 },
];

// ---------------------------------------------------------------------------
// Date helpers -- module doc #3. Necessarily reimplemented (not imported)
// since `MeetingsList.tsx` (which established the same noon-UTC trick for
// `parseDateOnly`) is a forbidden/read-only file for this task.
// ---------------------------------------------------------------------------

/** `'YYYY-MM-DD'` -> a real calendar date, parsed without a local-timezone
 * day-shift (noon UTC avoids DST edge cases when walking day-by-day). */
function parseDateOnly(isoDate: string): Date {
  const [year, month, day] = isoDate.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day, 12));
}

function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

/** DateRangeInput's own documented `presets` prop (module doc #8) -- a
 * genuinely useful "Next 6 weeks" quick-pick for a weekly recurring
 * schedule, computed fresh from today's date every time the popover opens
 * (never a fabricated/frozen range). */
const RECURRING_RANGE_PRESETS: ReadonlyArray<{ label: string; getRange: () => DateRange }> = [
  {
    label: 'Next 6 weeks',
    getRange: () => {
      const start = toIsoDate(parseDateOnly(new Date().toISOString().slice(0, 10)));
      const end = toIsoDate(addDays(parseDateOnly(start), 41)); // 6 full weeks inclusive.
      // Dynamically computed, so not statically known to match the
      // `ISODateString` template pattern -- both are always well-formed
      // 'YYYY-MM-DD' strings produced by `toIsoDate` above.
      return { start, end } as DateRange;
    },
  },
];

// ---------------------------------------------------------------------------
// Pure session-date generators -- module doc #3. One per schedule mode,
// each independently exported/testable.
// ---------------------------------------------------------------------------

/** "Single" mode -- exactly one date, or none. */
export function generateSingleSessionDates(date: string | undefined): string[] {
  return date === undefined ? [] : [date];
}

/** "Weekly recurring" mode -- every date in `[range.start, range.end]`
 * (BOTH boundaries inclusive) whose weekday is in `weekdayValues`. */
export function generateRecurringSessionDates(
  range: { start: string; end: string } | null,
  weekdayValues: readonly string[],
): string[] {
  if (range === null || weekdayValues.length === 0) return [];
  const dayIndices = new Set(
    weekdayValues
      .map((value) => WEEKDAY_OPTIONS.find((option) => option.value === value)?.dayIndex)
      .filter((dayIndex): dayIndex is number => dayIndex !== undefined),
  );
  const start = parseDateOnly(range.start);
  const end = parseDateOnly(range.end);
  if (start.getTime() > end.getTime()) return [];

  const dates: string[] = [];
  for (let cursor = start; cursor.getTime() <= end.getTime(); cursor = addDays(cursor, 1)) {
    if (dayIndices.has(cursor.getUTCDay())) {
      dates.push(toIsoDate(cursor));
    }
  }
  return dates;
}

/** "Custom dates" mode -- de-duplicated, sorted list of explicitly picked dates. */
export function generateCustomSessionDates(dates: readonly string[]): string[] {
  return Array.from(new Set(dates)).sort();
}

export interface ScheduleDatesInput {
  mode: ScheduleMode;
  singleDate: string | undefined;
  recurringRange: { start: string; end: string } | null;
  recurringWeekdays: readonly string[];
  customDates: readonly string[];
}

/** The only function in this file that branches on `mode` (module doc #3). */
export function computeScheduleSessionDates(input: ScheduleDatesInput): string[] {
  switch (input.mode) {
    case 'single':
      return generateSingleSessionDates(input.singleDate);
    case 'weekly':
      return generateRecurringSessionDates(input.recurringRange, input.recurringWeekdays);
    case 'custom':
      return generateCustomSessionDates(input.customDates);
    default: {
      const exhaustive: never = input.mode;
      return exhaustive;
    }
  }
}

// ---------------------------------------------------------------------------
// America/Chicago wall-clock -> UTC conversion (module doc #7 / NFR-09).
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
 * the correct UTC ISO timestamp, DST-aware (module doc #7). */
export function chicagoWallTimeToUtcIso(dateStr: string, timeStr: string): string {
  const naiveUtc = new Date(`${dateStr}T${timeStr}:00.000Z`);
  const offsetMinutes = getTimeZoneOffsetMinutes(CHICAGO_TIME_ZONE, naiveUtc);
  return new Date(naiveUtc.getTime() - offsetMinutes * 60000).toISOString();
}

/** Module doc #1/#6 -- builds the real `event_sessions` row payload. Returns
 * `[]` (no valid sessions) when either time is unset, since a date alone
 * cannot satisfy `starts_at`/`ends_at not null`. */
export function buildEventSessionsPayload(
  dates: readonly string[],
  startTime: string | undefined,
  endTime: string | undefined,
  notes: string,
): CreateMeetingsSessionPayload[] {
  if (startTime === undefined || endTime === undefined) return [];
  return dates.map((date) => ({
    sessionDate: date,
    startsAt: chicagoWallTimeToUtcIso(date, startTime),
    endsAt: chicagoWallTimeToUtcIso(date, endTime),
    notes,
  }));
}

/** `null` when every known team is selected (matches `events.team_ids`
 * NULL = "all teams" semantics), otherwise the explicit selected list. */
export function resolveTeamScope(
  selectedTeamIds: readonly string[],
  allTeamIds: readonly string[],
): string[] | null {
  const allSelected =
    allTeamIds.length > 0 &&
    selectedTeamIds.length === allTeamIds.length &&
    allTeamIds.every((id) => selectedTeamIds.includes(id));
  return allSelected ? null : [...selectedTeamIds];
}

/** BEH-07 (module doc #2) -- the ONLY place the confirm button's label is
 * produced. Never a bare "Create"/"Submit"/"OK".
 *
 * T510 -- gains a leading required `isEditMode` parameter (packet §4a/AC1).
 * Create-mode output is pixel-identical to before this task
 * (`computeConfirmLabel(false, 0) === 'Create 0 meetings'`, etc). Edit-mode
 * output is the literal string `'Save changes'`, regardless of count --
 * precedent `StudentDialog.tsx:299`'s own `computeConfirmLabel('edit') ===
 * 'Save changes'`. */
export function computeConfirmLabel(isEditMode: boolean, sessionCount: number): string {
  if (isEditMode) return 'Save changes';
  return `Create ${sessionCount} meeting${sessionCount === 1 ? '' : 's'}`;
}

// ---------------------------------------------------------------------------
// Default injectable persistence seam (module doc #4).
// ---------------------------------------------------------------------------

export const defaultOnCreateMeetings: OnCreateMeetingsFn = async (payload) => {
  console.warn(
    '[ScheduleMeetingsDialog] No Supabase client wired in yet (Known Context/Traps #4) -- ' +
      'this stub only logs the events/event_sessions payload that would have been inserted.',
    payload,
  );
};

// ---------------------------------------------------------------------------
// T510 -- series edit for scheduled meetings (worker packet §4a). Additive
// only: nothing above this point (the CREATE-only types/functions) changes.
// ---------------------------------------------------------------------------

export interface ExistingMeetingSeriesSession {
  sessionId: string;
  sessionDate: string; // 'YYYY-MM-DD'
  startsAt: string; // ISO timestamptz
  endsAt: string; // ISO timestamptz
  status: 'scheduled' | 'completed' | 'canceled';
}

/**
 * Rule 1: a session is eligible for a series edit's reconciliation only
 * while it is still `'scheduled'` AND its `startsAt` is STRICTLY after
 * `now` (a strict `>`, not `>=`, on THIS function's own condition). The
 * consequence, restated because it is the more useful way to read it: a
 * session is "already happened" (protected -- this function returns
 * `false`) when `now >= startsAt`, a NON-STRICT/inclusive boundary on the
 * protection side -- so a session whose `startsAt` exactly equals `now` is
 * already protected, matching the owner's stricter ruling that "already
 * happened" is a start time that has passed, checked inclusively.
 *
 * The status half of this check (excluding `'canceled'`/`'completed'`
 * sessions even when still future-dated) is THIS PACKET'S OWN design
 * decision, not the owner's "regardless of status" wording -- that wording
 * governs only the time boundary above. Precedent for the shape (a status
 * check layered on top of a bare time check): `RsvpControl.tsx:324-326`'s
 * own doc comment, "a disclosed addition beyond the bare time check."
 * Reimplemented locally (not imported) per this file's own established
 * cross-page practice.
 */
export function isMeetingSessionReconcilable(
  session: Pick<ExistingMeetingSeriesSession, 'status' | 'startsAt'>,
  now: Date,
): boolean {
  return session.status === 'scheduled' && new Date(session.startsAt).getTime() > now.getTime();
}

export interface MeetingSeriesReconcilePlan {
  toUpdate: Array<{ sessionId: string; session: CreateMeetingsSessionPayload }>;
  toInsert: CreateMeetingsSessionPayload[];
  toRemove: Array<{ sessionId: string; sessionDate: string }>;
}

/**
 * Pure, exported, directly testable without a fake `SupabaseClient` -- same
 * shape `resolveAttendanceWriteMethod` (`loaders/attendance.ts:287-291`)
 * already established.
 *
 * TWO invariants are enforced BY THIS FUNCTION ITSELF, not by the caller or
 * by a variable's name:
 *
 * 1. **A desired session whose own computed `startsAt` is not strictly
 *    after `now` is dropped before any matching happens** -- regardless of
 *    what mode/range/weekday/date inputs produced it. (This is an
 *    application-level, in-memory filter -- it is NOT the database-level
 *    guard; see `loaders/meetings.ts` for why a second, independent,
 *    database-evaluated guard also exists for the destructive path.)
 * 2. **`toInsert` never creates a same-calendar-date duplicate of ANY
 *    existing session**, not only a reconcilable one. A desired date that
 *    coincides with an existing PAST session's date, or an existing
 *    already-`'canceled'`/`'completed'` future session's date, is silently
 *    absorbed: excluded from `toUpdate` (not reconcilable -- protected) AND
 *    excluded from `toInsert` (a same-date row already exists), so no
 *    action is taken for that date at all. Disclosed, accepted
 *    simplification -- no existing UI path can produce this collision.
 *
 * **Duplicate `session_date` among reconcilable sessions** -- not possible
 * via any existing create-mode path today (`generateCustomSessionDates`
 * dedupes; `single`/`weekly` modes cannot repeat a date within one event),
 * so this is a disclosed limitation for whoever builds T605 next (per-
 * session date edits are where a genuine duplicate could first appear):
 *   - If the shared date IS still desired: `toUpdate`'s `Map`-keyed lookup
 *     (`reconcilableByDate`) silently picks ONE of the duplicates (last
 *     one inserted into the `Map` wins); the other is excluded from every
 *     list -- neither updated nor removed, silently orphaned as a stale
 *     `'scheduled'` row.
 *   - If the shared date is NOT desired: `toRemove` is built by filtering
 *     the raw `reconcilable` ARRAY (never the date-keyed `Map`), so **both**
 *     duplicates independently satisfy the filter and **both** are removed.
 *   T605 must revisit this the moment per-session date edits make
 *   duplicates reachable.
 */
export function computeMeetingSeriesReconcilePlan(
  existingSessions: readonly ExistingMeetingSeriesSession[],
  desiredFutureSessions: readonly CreateMeetingsSessionPayload[],
  now: Date,
): MeetingSeriesReconcilePlan {
  const desiredFuture = desiredFutureSessions.filter(
    (s) => new Date(s.startsAt).getTime() > now.getTime(),
  );

  const reconcilable = existingSessions.filter((s) => isMeetingSessionReconcilable(s, now));
  const reconcilableByDate = new Map(reconcilable.map((s) => [s.sessionDate, s] as const));
  const allExistingDates = new Set(existingSessions.map((s) => s.sessionDate));
  const desiredByDate = new Map(desiredFuture.map((s) => [s.sessionDate, s] as const));

  const toUpdate = desiredFuture
    .filter((s) => reconcilableByDate.has(s.sessionDate))
    .map((s) => ({
      sessionId: (reconcilableByDate.get(s.sessionDate) as ExistingMeetingSeriesSession).sessionId,
      session: s,
    }));
  const toInsert = desiredFuture.filter((s) => !allExistingDates.has(s.sessionDate));
  const toRemove = reconcilable
    .filter((s) => !desiredByDate.has(s.sessionDate))
    .map((s) => ({ sessionId: s.sessionId, sessionDate: s.sessionDate }));

  return { toUpdate, toInsert, toRemove };
}

export interface EditMeetingSeriesInitialData {
  eventId: string;
  title: string;
  /** `readonly`, matching `FixtureEvent.teamIds`/`CoachMeetingRow.teamIds`'s own type
   * (`MeetingsList.tsx`) -- a plain `string[]` here produces a real `TS2322` at that
   * file's own call site. */
  teamIds: readonly string[] | null;
  locationName: string;
  description: string;
  /** The FULL session list (past + future + canceled) -- this dialog itself filters to
   * `isMeetingSessionReconcilable` for pre-filling "Custom dates" AND for deriving `startTime`/
   * `endTime` (below); it does not trust a caller-side pre-filter, and `MeetingsList.tsx` supplies
   * none of the time derivation (`startTime`/`endTime` are NOT fields on this interface; deriving
   * them requires calling this file's own unexported `formatChicagoWallTime`, which cannot cross a
   * file boundary). */
  sessions: readonly ExistingMeetingSeriesSession[];
}

export interface SaveMeetingSeriesPayload {
  eventId: string;
  /** Reuses `CreateMeetingsEventPayload`'s shape. `address` is ALWAYS IGNORED by the update mutation
   * (`loaders/meetings.ts`) -- construct with `address: ''`, matching the create path's own existing
   * default. */
  event: CreateMeetingsEventPayload;
  /** The coach's full desired FUTURE schedule, post schedule-mode computation. The loader does not
   * trust this to already be future-only (`computeMeetingSeriesReconcilePlan` re-derives it, and the
   * loader's own destructive path re-derives it AGAIN at the database boundary). */
  desiredFutureSessions: CreateMeetingsSessionPayload[];
}

export type OnSaveMeetingSeriesFn = (payload: SaveMeetingSeriesPayload) => Promise<void>;

export const defaultOnSaveMeetingSeries: OnSaveMeetingSeriesFn = async (payload) => {
  console.warn(
    '[ScheduleMeetingsDialog] No Supabase client wired in yet -- this stub only logs the ' +
      'events/event_sessions reconciliation that would have been applied.',
    payload,
  );
};

/** Reimplemented locally from `OutreachList.tsx:1660-1665`/`OutreachDetail.tsx:1449` (both named
 * `formatChicagoWallTime`), per this file's own cross-page-reimplementation convention.
 * DELIBERATELY NOT EXPORTED: it is called only from this file's own `resetForm()`, never from
 * `MeetingsList.tsx` -- `EditMeetingSeriesInitialData` carries raw `startsAt`/`endsAt` timestamps,
 * and the wall-time derivation happens entirely inside this file. */
const CHICAGO_24H_TIME_FORMATTER = new Intl.DateTimeFormat('en-US', {
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
  timeZone: CHICAGO_TIME_ZONE,
});

function formatChicagoWallTime(isoDateTime: string): string {
  const parts = CHICAGO_24H_TIME_FORMATTER.formatToParts(new Date(isoDateTime));
  const hour = parts.find((part) => part.type === 'hour')?.value ?? '00';
  const minute = parts.find((part) => part.type === 'minute')?.value ?? '00';
  return `${hour}:${minute}`;
}

/** Reimplement this file's own local copy of `MeetingsList.tsx:1198-1228`'s
 * `Intl.DateTimeFormat('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone:
 * 'America/Chicago' })`, for `buildEditConfirmationDescription` below. */
const WEEKDAY_DATE_FORMATTER = new Intl.DateTimeFormat('en-US', {
  weekday: 'short',
  month: 'short',
  day: 'numeric',
  timeZone: CHICAGO_TIME_ZONE,
});

/** `AlertDialogProps.description` is a plain string with no `children` slot
 * (`node_modules/@astryxdesign/core/dist/AlertDialog/AlertDialog.d.ts`) -- builds ONE joined string
 * satisfying rule 6: counts always; the actual removed dates listed, comma-joined, ONLY when
 * `plan.toRemove.length > 0`. Reuses this file's own existing `parseDateOnly` (`:335`) directly --
 * not reimplemented.
 *
 * T611 -- `timesWillBeOverwritten` is an ADDITIVE, optional second parameter (worker packet
 * §3.6): its absence (or `false`) must reproduce the pre-T611 one-argument output byte for
 * byte -- both existing call sites of this function (`AC11`/`AC12` in the test file) pass only
 * `plan` and must keep passing unmodified. When `true` (this dialog's own `timeFieldsTouched`
 * state was set before the coach submitted -- see the `AlertDialog` `description` call site),
 * an extra sentence is appended disclosing that every upcoming session's time is about to be
 * overwritten with the newly entered value -- the single-shared-time defect this task exists to
 * stop from happening silently (worker packet §1). */
export function buildEditConfirmationDescription(
  plan: MeetingSeriesReconcilePlan,
  timesWillBeOverwritten: boolean = false,
): string {
  const base = `${plan.toInsert.length} session(s) added · ${plan.toRemove.length} session(s) removed · ${plan.toUpdate.length} session(s) kept.`;
  let description = base;
  if (plan.toRemove.length > 0) {
    const removedDates = plan.toRemove
      .map((item) => WEEKDAY_DATE_FORMATTER.format(parseDateOnly(item.sessionDate)))
      .join(', ');
    description = `${base} Removed: ${removedDates}.`;
  }
  if (timesWillBeOverwritten) {
    description = `${description} Every upcoming session's time will be overwritten with the new start/end time you entered.`;
  }
  return description;
}

/** Deliberately NOT built: the confirmation copy above does not distinguish "removed and deleted"
 * from "removed and canceled because attendance exists" -- both mean "no longer appears as upcoming"
 * to the coach, and the distinction is accurate either way. Surfacing it would need a new field
 * threaded onto an existing, widely-fixture-literal'd exported type for a UI nuance the owner never
 * asked for. Do not build this speculatively. */

/** T611 -- for a series edit, resolves each desired date's own starts_at/ends_at. When
 * `timeFieldsTouched` is `false`, a date matching an existing RECONCILABLE session's own
 * `sessionDate` reuses THAT session's own `starts_at`/`ends_at` verbatim (no re-derivation, no
 * Chicago-wall-time round trip) -- preserving whatever value it already has, including a value
 * that diverges from every other session's. A date with no such match (newly added), or every
 * date once `timeFieldsTouched` is `true`, uses the currently displayed `startTime`/`endTime`
 * via the same `chicagoWallTimeToUtcIso` conversion `buildEventSessionsPayload` (above) already
 * performs. Pure, exported, independently testable without a DOM -- same convention
 * `computeMeetingSeriesReconcilePlan` documents for itself (worker packet §3.5).
 *
 * Precondition, documented rather than defended with a fallback: by the time `handleSubmit`
 * calls this, the edit-mode `isValid` guarantee (worker packet §3.4) ensures that whenever
 * `timeFieldsTouched` is `true`, `startTime`/`endTime` are both defined. This function does not
 * silently fabricate a value if that guarantee is ever violated -- it mirrors
 * `buildEventSessionsPayload`'s OWN posture above (`if (startTime === undefined || endTime ===
 * undefined) return [];`, "skip rather than fabricate"), not `handleSubmit`'s unrelated `:925`
 * guard (a redundant belt-and-suspenders check before the handler runs at all, per worker packet
 * §3.5): a date that would need a currently-undefined `startTime`/`endTime` is dropped from the
 * result instead of being given a made-up value. */
export function buildEditDesiredFutureSessions(
  dates: readonly string[],
  startTime: string | undefined,
  endTime: string | undefined,
  timeFieldsTouched: boolean,
  originalTimesByDate: ReadonlyMap<string, { startsAt: string; endsAt: string }>,
): CreateMeetingsSessionPayload[] {
  const result: CreateMeetingsSessionPayload[] = [];
  for (const date of dates) {
    const original = timeFieldsTouched ? undefined : originalTimesByDate.get(date);
    if (original !== undefined) {
      result.push({
        sessionDate: date,
        startsAt: original.startsAt,
        endsAt: original.endsAt,
        notes: '',
      });
      continue;
    }
    if (startTime === undefined || endTime === undefined) continue; // skip rather than fabricate
    result.push({
      sessionDate: date,
      startsAt: chicagoWallTimeToUtcIso(date, startTime),
      endsAt: chicagoWallTimeToUtcIso(date, endTime),
      notes: '',
    });
  }
  return result;
}

// ---------------------------------------------------------------------------
// Component.
// ---------------------------------------------------------------------------

export interface ScheduleMeetingsDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  teams: readonly ScheduleTeamOption[];
  /** Defaults to `defaultOnCreateMeetings` (module doc #4). */
  onCreateMeetings?: OnCreateMeetingsFn;
  /** T510 -- present => "edit" mode, pre-filled from this existing series + its
   * sessions. Absent => "create" mode (byte-identical to before this task). */
  initialData?: EditMeetingSeriesInitialData;
  /** T510 -- defaults to `defaultOnSaveMeetingSeries`. Only ever invoked in edit mode. */
  onSaveMeetingSeries?: OnSaveMeetingSeriesFn;
}

/** T510 -- captured at submit time (edit mode only), so the confirmation
 * `AlertDialog`'s eventual `onAction` does not need to re-read `initialData`/
 * re-derive the plan a second time. */
interface PendingEditSave {
  eventId: string;
  plan: MeetingSeriesReconcilePlan;
  desiredFutureSessions: CreateMeetingsSessionPayload[];
}

export function ScheduleMeetingsDialog({
  isOpen,
  onOpenChange,
  teams,
  onCreateMeetings = defaultOnCreateMeetings,
  initialData,
  onSaveMeetingSeries = defaultOnSaveMeetingSeries,
}: ScheduleMeetingsDialogProps): ReactNode {
  const allTeamIds = useMemo(() => teams.map((team) => team.id), [teams]);
  // T510 -- present => edit mode (mirrors `OutreachEventDialog.tsx`'s own
  // `isEditMode = initialEvent !== undefined`).
  const isEditMode = initialData !== undefined;

  const [title, setTitle] = useState(DEFAULT_TITLE);
  const [selectedTeamIds, setSelectedTeamIds] = useState<string[]>(allTeamIds);
  const [location, setLocation] = useState('');
  // T510 -- edit-mode-only field (rendered only when `isEditMode`).
  const [description, setDescription] = useState('');
  const [mode, setMode] = useState<ScheduleMode>('single');

  const [singleDate, setSingleDate] = useState<ISODateString | undefined>(undefined);
  const [recurringRange, setRecurringRange] = useState<DateRange | null>(null);
  const [recurringWeekdays, setRecurringWeekdays] = useState<string[]>([]);
  const [customDates, setCustomDates] = useState<string[]>([]);
  const [customDatePicker, setCustomDatePicker] = useState<ISODateString | undefined>(undefined);

  const [startTime, setStartTime] = useState<ISOTimeString | undefined>(DEFAULT_START_TIME);
  const [endTime, setEndTime] = useState<ISOTimeString | undefined>(DEFAULT_END_TIME);
  const [notes, setNotes] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  // T510 -- set by `handleSubmit`'s edit-mode branch; drives the confirmation
  // `AlertDialog` below. `onSaveMeetingSeries` is NOT called until the coach
  // confirms (rule 6: confirmation before saving).
  const [pendingEditSave, setPendingEditSave] = useState<PendingEditSave | null>(null);
  // T611 -- an INTERACTION flag, not a value comparison (worker packet §3.4):
  // set `true` the moment either time `TimeInput`'s own `onChange` fires this
  // edit session (wrapped below, `handleStartTimeChange`/`handleEndTimeChange`),
  // reset `false` only inside `resetForm()`'s single shared reset point. One
  // shared flag covers BOTH fields (packet §3.4, "why one shared flag, not
  // two") -- `updateSessionTime` always persists `starts_at`/`ends_at`
  // together, so splitting this in two could produce a session whose start
  // comes from "touched" and whose end comes from "untouched, preserved," a
  // hybrid neither the original schedule nor the coach's own screen shows.
  const [timeFieldsTouched, setTimeFieldsTouched] = useState(false);

  function resetForm(): void {
    if (initialData !== undefined) {
      // T510 edit mode (packet §4a) -- mirrors `OutreachEventDialog.tsx:1016-1079`'s
      // own `initialEvent !== undefined` branch shape.
      setTitle(initialData.title);
      setSelectedTeamIds(initialData.teamIds !== null ? [...initialData.teamIds] : allTeamIds);
      setLocation(initialData.locationName);
      setDescription(initialData.description);
      setMode('custom');
      setSingleDate(undefined);
      setRecurringRange(null);
      setRecurringWeekdays([]);
      const reconcilableSessions = initialData.sessions.filter((s) =>
        isMeetingSessionReconcilable(s, new Date()),
      );
      setCustomDates(generateCustomSessionDates(reconcilableSessions.map((s) => s.sessionDate)));
      setCustomDatePicker(undefined);
      // `startTime`/`endTime` are DERIVED here, not read off `initialData` (that
      // interface deliberately carries no `startTime`/`endTime` fields -- see its
      // own doc comment): the earliest-`startsAt` reconcilable session's own wall
      // time, or this file's existing `DEFAULT_START_TIME`/`DEFAULT_END_TIME` for
      // a fully-past series (none reconcilable).
      const earliest = reconcilableSessions
        .slice()
        .sort((a, b) => a.startsAt.localeCompare(b.startsAt))[0];
      if (earliest !== undefined) {
        setStartTime(
          createISOTimeString(formatChicagoWallTime(earliest.startsAt)) ?? DEFAULT_START_TIME,
        );
        setEndTime(createISOTimeString(formatChicagoWallTime(earliest.endsAt)) ?? DEFAULT_END_TIME);
      } else {
        setStartTime(DEFAULT_START_TIME);
        setEndTime(DEFAULT_END_TIME);
      }
      setNotes('');
    } else {
      setTitle(DEFAULT_TITLE);
      setSelectedTeamIds(allTeamIds);
      setLocation('');
      setDescription('');
      setMode('single');
      setSingleDate(undefined);
      setRecurringRange(null);
      setRecurringWeekdays([]);
      setCustomDates([]);
      setCustomDatePicker(undefined);
      setStartTime(DEFAULT_START_TIME);
      setEndTime(DEFAULT_END_TIME);
      setNotes('');
    }
    setSubmitError(null);
    setPendingEditSave(null);
    // T611 -- single shared reset point (worker packet §3.4); NOT duplicated
    // inside either branch above.
    setTimeFieldsTouched(false);
  }

  // Nothing persists across opens (module doc "Nothing persists" acceptance
  // criterion) -- every fresh open starts from either the same pristine
  // defaults (create mode) or `initialData`'s own values (T510 edit mode).
  useEffect(() => {
    if (isOpen) resetForm();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset only on the isOpen transition.
  }, [isOpen]);

  const sessionDates = useMemo(
    () =>
      computeScheduleSessionDates({
        mode,
        singleDate,
        recurringRange,
        recurringWeekdays,
        customDates,
      }),
    [mode, singleDate, recurringRange, recurringWeekdays, customDates],
  );

  const sessionsPayload = useMemo(
    () => buildEventSessionsPayload(sessionDates, startTime, endTime, notes),
    [sessionDates, startTime, endTime, notes],
  );

  // T611 -- computed together, over `initialData`, the same way `resetForm()`
  // already computes (and currently discards) the reconcilable filter
  // (worker packet §0.1's adopted guidance). `originalTimesByDate` feeds
  // `buildEditDesiredFutureSessions` (§3.5) at submit time so an untouched
  // date reuses its OWN session's stored time verbatim, never re-derived.
  // `timesDivergeAcrossSessions` drives the §3.3 inline disclosure: `true`
  // only when two or more reconcilable sessions' own Chicago wall times
  // (start AND end) genuinely differ from each other -- a single reconcilable
  // session, or several that all share one wall time, is NOT divergent.
  const { originalTimesByDate, timesDivergeAcrossSessions } = useMemo(() => {
    const map = new Map<string, { startsAt: string; endsAt: string }>();
    if (initialData === undefined) {
      return { originalTimesByDate: map, timesDivergeAcrossSessions: false };
    }
    const reconcilableSessions = initialData.sessions.filter((s) =>
      isMeetingSessionReconcilable(s, new Date()),
    );
    for (const session of reconcilableSessions) {
      map.set(session.sessionDate, { startsAt: session.startsAt, endsAt: session.endsAt });
    }
    const distinctWallTimes = new Set(
      reconcilableSessions.map(
        (s) => `${formatChicagoWallTime(s.startsAt)}-${formatChicagoWallTime(s.endsAt)}`,
      ),
    );
    return { originalTimesByDate: map, timesDivergeAcrossSessions: distinctWallTimes.size > 1 };
  }, [initialData]);

  // T510 -- rule 2 ("title/location/description always editable") would be
  // impossible for a fully-past series (zero reconcilable sessions) under the
  // create-mode rule below; in edit mode, `isValid` drops the session-count
  // requirement entirely. This also permits narrowing a series to zero future
  // sessions in one save (every remaining future session moves to `toRemove`)
  // -- a coherent action, not a bug to guard against.
  //
  // T611 -- edit mode ALSO requires, per worker packet §3.4's "Consequence
  // for `isValid`": if the coach has touched either time field this session
  // (`timeFieldsTouched`), both `startTime`/`endTime` must resolve to real
  // values before the button enables -- untouched fields never gate validity
  // on a value, since untouched sessions reuse their own stored time
  // regardless of what the shared fields currently display.
  const isValid = isEditMode
    ? title.trim() !== '' &&
      (!timeFieldsTouched || (startTime !== undefined && endTime !== undefined))
    : title.trim() !== '' && sessionsPayload.length > 0;
  const confirmLabel = computeConfirmLabel(isEditMode, sessionsPayload.length);

  // T510 -- "already happened" disclosure (packet §4a component-changes list).
  const nonReconcilableSessionCount =
    initialData === undefined
      ? 0
      : initialData.sessions.filter((s) => !isMeetingSessionReconcilable(s, new Date())).length;

  function handleCancel(): void {
    resetForm();
    onOpenChange(false);
  }

  // T611 -- wrap `setStartTime`/`setEndTime` rather than calling them
  // directly from JSX (worker packet §3.4), so every `onChange` the coach's
  // OWN interaction fires also latches `timeFieldsTouched`. `TimeInput`
  // itself already guards against a same-value retype re-firing `onChange`
  // (its own `handleInputChange`, `parsed !== value`), so this dialog never
  // needs its own value-comparison to avoid a no-op retype latching the flag.
  function handleStartTimeChange(value: ISOTimeString | undefined): void {
    setTimeFieldsTouched(true);
    setStartTime(value);
  }

  function handleEndTimeChange(value: ISOTimeString | undefined): void {
    setTimeFieldsTouched(true);
    setEndTime(value);
  }

  async function handleConfirmEditSave(): Promise<void> {
    if (pendingEditSave === null) return;
    const { eventId, desiredFutureSessions } = pendingEditSave;
    setPendingEditSave(null);
    setIsSubmitting(true);
    setSubmitError(null);
    try {
      await onSaveMeetingSeries({
        eventId,
        event: {
          title: title.trim(),
          teamIds: resolveTeamScope(selectedTeamIds, allTeamIds),
          locationName: location,
          description,
          address: '', // T510 -- always ignored by the update mutation; matches the create default.
        },
        desiredFutureSessions,
      });
      resetForm();
      onOpenChange(false);
    } catch (error) {
      setSubmitError(
        error instanceof Error ? error.message : 'Something went wrong saving these changes.',
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleSubmit(): Promise<void> {
    if (!isValid) return; // extra guard; the button is already natively disabled.
    if (initialData !== undefined) {
      // T510 edit mode -- do NOT call `onSaveMeetingSeries` yet (rule 6:
      // confirmation before saving). `notes` is fixed to `''` here regardless
      // of this dialog's own `notes` state -- per-session notes are T605's
      // scope, and the loader itself never trusts this to already be
      // future-only (it re-derives the plan again at the database boundary).
      //
      // T611 -- time resolution changed from a direct `buildEventSessionsPayload`
      // call (which always applies the ONE shared `startTime`/`endTime` to every
      // date) to `buildEditDesiredFutureSessions` (worker packet §3.5): a series
      // edit must not silently rewrite every session's own time just because the
      // coach only meant to change the title. An untouched date reuses its own
      // session's stored time verbatim; only a date the coach actually touched
      // (or a newly added date) picks up the currently displayed shared time.
      const desiredFutureSessions = buildEditDesiredFutureSessions(
        sessionDates,
        startTime,
        endTime,
        timeFieldsTouched,
        originalTimesByDate,
      );
      const plan = computeMeetingSeriesReconcilePlan(
        initialData.sessions,
        desiredFutureSessions,
        new Date(),
      );
      setPendingEditSave({ eventId: initialData.eventId, plan, desiredFutureSessions });
      return;
    }
    setIsSubmitting(true);
    setSubmitError(null);
    const payload: CreateMeetingsPayload = {
      event: {
        title: title.trim(),
        teamIds: resolveTeamScope(selectedTeamIds, allTeamIds),
        locationName: location,
        description: '', // module doc #1 -- not an MTG-02 field, defaulted.
        address: '', // module doc #1 -- not an MTG-02 field, defaulted.
      },
      sessions: sessionsPayload,
    };
    try {
      await onCreateMeetings(payload);
      resetForm();
      onOpenChange(false);
    } catch (error) {
      setSubmitError(
        error instanceof Error ? error.message : 'Something went wrong creating these meetings.',
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  function addCustomDate(): void {
    if (customDatePicker === undefined) return;
    setCustomDates((prev) => generateCustomSessionDates([...prev, customDatePicker]));
    setCustomDatePicker(undefined);
  }

  function removeCustomDate(date: string): void {
    setCustomDates((prev) => prev.filter((d) => d !== date));
  }

  return (
    // T125 module doc 9 -- `variant="fullscreen"` is the real, non-
    // hallucinated Astryx "full-height panel" (`EventFormLayout.tsx`'s own
    // module doc #1 has the full sourcing writeup).
    <Dialog isOpen={isOpen} onOpenChange={onOpenChange} purpose="form" variant="fullscreen">
      <Layout
        header={
          <DialogHeader
            title={isEditMode ? 'Edit meeting series' : 'Schedule meetings'}
            onOpenChange={onOpenChange}
          />
        }
        content={
          <LayoutContent>
            {/* T125 module doc 9 -- field order per MTG-02 / constitution
                item 13 (module doc, top of file) is UNCHANGED: title, team
                scope, location, schedule mode, date/time pickers, notes --
                exact, not a suggestion. Sections below only add labeled
                headings around contiguous runs of that same order (see
                module doc 9 for the disclosed grouping). T510's own
                "Description" field is additive-only, rendered ONLY in edit
                mode (`isEditMode`) -- create mode's Basics section stays
                byte-identical to today, so the MTG-02 field-order tripwire
                (`ScheduleMeetingsDialog.test.tsx`'s own
                `describe('<ScheduleMeetingsDialog /> field order ...')`)
                stays green unedited. */}
            <EventFormLayout>
              <EventFormSection title="Basics" description="What this meeting is and who it's for.">
                <TextInput
                  label="Title"
                  value={title}
                  onChange={setTitle}
                  isRequired
                  placeholder="Team meeting"
                />

                <MultiSelector
                  label="Team scope"
                  options={teams.map((team) => ({ value: team.id, label: team.name }))}
                  value={selectedTeamIds}
                  onChange={setSelectedTeamIds}
                  hasSelectAll
                  triggerDisplay="labels"
                />

                {isEditMode && (
                  <TextArea
                    label="Description"
                    value={description}
                    onChange={setDescription}
                    isOptional
                    rows={3}
                  />
                )}
              </EventFormSection>

              <EventFormSection title="Location" description="Where the meeting happens.">
                <TextInput
                  label="Location"
                  value={location}
                  onChange={setLocation}
                  placeholder="e.g. Robotics Lab"
                />
              </EventFormSection>

              <EventFormSection
                title="Schedule"
                description="Pick when this meeting happens, and its start/end times."
              >
                {/* T510 -- "already happened" disclosure (rule 1: future-forward
                    only). Present only in edit mode, and only when at least one
                    of this series' own sessions is no longer reconcilable. */}
                {isEditMode && nonReconcilableSessionCount > 0 && (
                  <Text type="supporting">
                    {`${nonReconcilableSessionCount} session(s) have already happened and are not affected by this edit.`}
                  </Text>
                )}

                <SegmentedControl
                  value={mode}
                  onChange={(value) => setMode(value as ScheduleMode)}
                  label="Schedule mode"
                >
                  <SegmentedControlItem value="single" label="Single" />
                  <SegmentedControlItem value="weekly" label="Weekly recurring" />
                  <SegmentedControlItem value="custom" label="Custom dates" />
                </SegmentedControl>

                {mode === 'single' && (
                  <DateInput label="Date" value={singleDate} onChange={setSingleDate} isRequired />
                )}

                {mode === 'weekly' && (
                  <>
                    <DateRangeInput
                      label="Date range"
                      value={recurringRange}
                      onChange={setRecurringRange}
                      presets={RECURRING_RANGE_PRESETS}
                    />
                    <CheckboxList
                      label="Repeat on"
                      value={recurringWeekdays}
                      onChange={setRecurringWeekdays}
                      hasDividers
                    >
                      {WEEKDAY_OPTIONS.map((option) => (
                        <CheckboxListItem
                          key={option.value}
                          label={option.label}
                          value={option.value}
                        />
                      ))}
                    </CheckboxList>
                  </>
                )}

                {mode === 'custom' && (
                  <VStack gap={2}>
                    <HStack gap={2} vAlign="end" wrap="wrap">
                      <DateInput
                        label="Add a date"
                        value={customDatePicker}
                        onChange={setCustomDatePicker}
                      />
                      <Button
                        label="Add date"
                        variant="secondary"
                        onClick={addCustomDate}
                        isDisabled={customDatePicker === undefined}
                      />
                    </HStack>
                    {customDates.length === 0 ? (
                      <Text type="supporting">No custom dates added yet.</Text>
                    ) : (
                      <List hasDividers header="Picked dates">
                        {customDates.map((date) => (
                          <ListItem
                            key={date}
                            label={date}
                            endContent={
                              <Button
                                label={`Remove ${date}`}
                                variant="ghost"
                                size="sm"
                                onClick={() => removeCustomDate(date)}
                              />
                            }
                          />
                        ))}
                      </List>
                    )}
                  </VStack>
                )}

                {/* T611 -- §3.3 disclosure: edit mode only, shown only while this
                    series' own reconcilable sessions genuinely disagree on wall
                    time AND the coach has not yet touched either time field this
                    edit session. Disappears the moment either field is touched
                    (whether or not the new value actually differs), because at
                    that point the confirmation `AlertDialog`'s own suffix (§3.6)
                    takes over disclosing the overwrite. */}
                {isEditMode && timesDivergeAcrossSessions && !timeFieldsTouched && (
                  <Text type="supporting">
                    {'Sessions in this series currently have different times. Leave these ' +
                      'fields unchanged to keep each session’s own time, or enter a new ' +
                      'time to apply it to every upcoming session.'}
                  </Text>
                )}

                <HStack gap={2} wrap="wrap">
                  <TimeInput
                    label="Start time"
                    value={startTime}
                    onChange={handleStartTimeChange}
                    isRequired
                  />
                  <TimeInput
                    label="End time"
                    value={endTime}
                    onChange={handleEndTimeChange}
                    isRequired
                  />
                </HStack>
              </EventFormSection>

              {/* T609 -- create-mode-only field (mirrors Description's own
                  `isEditMode &&` gate above, inverted): edit mode never
                  persists this dialog's `notes` state (see `handleSubmit`'s
                  own `:927-931` comment), so showing an editable Notes box in
                  edit mode silently discarded whatever a coach typed into it.
                  Per `auto-mode-decisions.md`'s "2026-07-30 -- George's ruling
                  on T169 (owner input, verbatim)" finding 1, a control that
                  accepts input, shows it applied, and silently discards it is
                  worse than no control at all -- hide it instead. */}
              {!isEditMode && (
                <EventFormSection title="Notes" hasDivider={false}>
                  <TextArea label="Notes" value={notes} onChange={setNotes} isOptional rows={3} />
                </EventFormSection>
              )}

              {submitError !== null && (
                <Banner
                  status="error"
                  title={
                    isEditMode ? "Couldn't save these changes" : "Couldn't create these meetings"
                  }
                  description={submitError}
                />
              )}
            </EventFormLayout>
          </LayoutContent>
        }
        footer={
          <LayoutFooter hasDivider>
            <HStack hAlign="end" gap={2}>
              <Button label="Cancel" variant="secondary" onClick={handleCancel} />
              <Button
                label={confirmLabel}
                variant="primary"
                isDisabled={!isValid || isSubmitting}
                isLoading={isSubmitting}
                clickAction={handleSubmit}
              />
            </HStack>
          </LayoutFooter>
        }
      />

      {/* T510 -- rule 6: confirmation before saving. Only ever opened by
          `handleSubmit`'s edit-mode branch (`pendingEditSave !== null`);
          `AlertDialog` does NOT auto-close (its own doc comment) -- confirming
          or declining both explicitly drive `pendingEditSave` back to `null`. */}
      <AlertDialog
        isOpen={pendingEditSave !== null}
        onOpenChange={(isOpen) => {
          if (!isOpen) setPendingEditSave(null);
        }}
        title="Save changes to this meeting series?"
        description={
          pendingEditSave !== null
            ? // T611 -- `timeFieldsTouched` (§3.4) is not reset between `handleSubmit`
              // setting `pendingEditSave` and the coach confirming here (only
              // `resetForm()` resets it), so it can be read directly at this call
              // site instead of threading a new field through `PendingEditSave`
              // itself (worker packet §3.6 -- the cheaper, required path).
              buildEditConfirmationDescription(pendingEditSave.plan, timeFieldsTouched)
            : ''
        }
        actionLabel="Save changes"
        onAction={() => {
          void handleConfirmEditSave();
        }}
      />
    </Dialog>
  );
}

export default ScheduleMeetingsDialog;
