/**
 * @file format.ts
 * @input Uses `Intl.DateTimeFormat` only (for the moved formatters) -- no
 *   other repo modules. `buildScheduleChips` uses neither `Date` nor `Intl`
 *   at all (see its own doc, below).
 * @output Exports `CHICAGO_TIME_ZONE`, `parseDateOnly`, `formatWeekdayDate`,
 *   `sessionDurationHours`, `formatDuration`, `formatHoursLabel`,
 *   `buildRecurrenceChips`, `buildDateRangeLabel`,
 *   `formatTimeRangeWithDuration`, `Dow`, `ScheduleRule`,
 *   `buildScheduleChips`. `computeDurationMinutes`, `splitMeridiem` and the
 *   three `Intl.DateTimeFormat` instances stay private to this module.
 * @position GAM-443: one shared home for the meeting date/time formatters
 *   that were previously duplicated between `MeetingsList.tsx` and
 *   `CalendarPage.tsx` (and, before this task, `OutreachList.tsx`'s own
 *   third copy of some of them -- out of this packet's scope, see the
 *   packet's correction 3). Moved here byte-identical from
 *   `MeetingsList.tsx:1278-1393` (code motion, not a rewrite); both
 *   `MeetingsList.tsx` and `CalendarPage.tsx` now import from here and
 *   re-export the names their own existing tests import by page-module path.
 *
 *   This is a **different** module from `src/lib/format/dates.ts`, on
 *   purpose, not by oversight -- that file's own module doc states the same
 *   "duplicated `Intl.DateTimeFormat` call sites" problem this one does, and
 *   `formatFriendlyDate` there is output-identical to `formatWeekdayDate`
 *   here for every day tested (0 divergences over 800 consecutive days). The
 *   identical output today is **not** a shared contract. It is a coincidence
 *   of each module pairing its anchor with a formatter timezone in which
 *   that anchor cannot cross a day boundary -- `dates.ts` anchors at UTC
 *   midnight (`dates.ts:42`, `new Date(dateOnly)`) and formats in UTC
 *   (`dates.ts:41`, zero offset, no shift possible); this file anchors at
 *   noon UTC (`parseDateOnly`, below) and formats in Chicago (UTC-5/-6,
 *   still the same calendar day). Change either half of either pair and they
 *   diverge. They stay separate modules because they serve two different
 *   timezone regimes: `dates.ts` pins `timeZone: 'UTC'` deliberately for a
 *   bare SQL `date` that must not shift; this file pins `America/Chicago`
 *   per NFR-09 and composes duration and meridiem logic over real instants.
 *   Merging them would put two contradictory timezone defaults in one file.
 *
 * SYNC: no other files require updating when this one changes -- it has no
 * generated/mirrored artifacts. `MeetingsList.tsx` and `CalendarPage.tsx`
 * each re-export a subset of these names for their own existing tests/
 * importers; a signature change here is a signature change for both.
 */

/** BEH-08 / NFR-09: every timestamp in this module displays in
 * America/Chicago, never the viewer's local browser timezone. */
export const CHICAGO_TIME_ZONE = 'America/Chicago';

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

/** UXD-02's own "MON (18) · THU (18)" worked example needs a bare weekday
 * abbreviation, upper-cased below (moved from `MeetingsList.tsx`'s T122
 * module doc #10b -- this file's own @position note above records that
 * history; this file has no module-doc numbering of its own). */
const WEEKDAY_ABBR_FORMATTER = new Intl.DateTimeFormat('en-US', {
  weekday: 'short',
  timeZone: CHICAGO_TIME_ZONE,
});

/** `session_date` ('YYYY-MM-DD') -> a real calendar date, parsed without a
 * local-timezone day-shift (BEH-08 needs the literal stored date). */
export function parseDateOnly(isoDate: string): Date {
  const [year, month, day] = isoDate.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day, 12)); // noon UTC avoids DST edge cases
}

/** e.g. "Sat, Jul 25" (BEH-08). */
export function formatWeekdayDate(sessionDate: string): string {
  return WEEKDAY_DATE_FORMATTER.format(parseDateOnly(sessionDate));
}

/** The compact day number used by the student meeting hero's date square. */
export function formatDateSquare(sessionDate: string): { month: string; day: string } {
  const parts = new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    timeZone: CHICAGO_TIME_ZONE,
  }).formatToParts(parseDateOnly(sessionDate));
  return {
    month: parts.find((part) => part.type === 'month')?.value ?? '',
    day: parts.find((part) => part.type === 'day')?.value ?? '',
  };
}

/**
 * A static, render-time Chicago calendar label. It intentionally has no
 * clock/timer dependency: this is wayfinding, not a countdown.
 */
export function formatRelativeChicagoDay(sessionDate: string, now: Date): string | null {
  const chicagoCalendarParts = new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone: CHICAGO_TIME_ZONE,
  }).formatToParts(now);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    Number(chicagoCalendarParts.find((item) => item.type === type)?.value);
  const currentMidnight = Date.UTC(part('year'), part('month') - 1, part('day'));
  const [year, month, day] = sessionDate.split('-').map(Number);
  const session = Date.UTC(year, month - 1, day);
  const days = Math.round((session - currentMidnight) / 86_400_000);
  if (days < 0) return null;
  if (days === 0) return 'Today';
  if (days === 1) return 'Tomorrow';
  if (days <= 6) return `in ${days} days`;
  return formatWeekdayDate(sessionDate);
}

/** The ONE shared duration-in-minutes computation `formatDuration`
 * (unchanged worked output) and `sessionDurationHours` both build on, so
 * there is exactly one duration formula in this module, not two (moved from
 * `MeetingsList.tsx`'s T122 module doc #10a/#10b). */
function computeDurationMinutes(startsAt: string, endsAt: string): number {
  return Math.round((new Date(endsAt).getTime() - new Date(startsAt).getTime()) / 60000);
}

/** e.g. "2h", "1h 30m", "45m" (BEH-08's computed-duration requirement). */
export function formatDuration(startsAt: string, endsAt: string): string {
  const totalMinutes = computeDurationMinutes(startsAt, endsAt);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) return `${minutes}m`;
  if (minutes === 0) return `${hours}h`;
  return `${hours}h ${minutes}m`;
}

/** A session's scheduled duration as a plain number of hours
 * (`CoachMeetingSessionDetail.durationHours`), built on the SAME
 * `computeDurationMinutes` `formatDuration` uses above -- never a second
 * duration formula (moved from `MeetingsList.tsx`'s T122 module doc #10a). */
export function sessionDurationHours(startsAt: string, endsAt: string): number {
  return computeDurationMinutes(startsAt, endsAt) / 60;
}

/** e.g. "2h", "1.5h", "0h" -- plain number formatting, not a metric. */
export function formatHoursLabel(hours: number): string {
  const rounded = Math.round(hours * 10) / 10;
  return Number.isInteger(rounded) ? `${rounded}h` : `${rounded.toFixed(1)}h`;
}

/** UXD-02's own worked example: `["MON (18)", "THU (18)"]`, grouped by
 * weekday in first-seen order, from this event's real `session_date` values
 * (plain counting, not a metric-view formula). Empty for a single-session
 * event -- `buildDateRangeLabel` below covers that case alone; a one-entry
 * chip ("SAT (1)") would add nothing. (Moved from `MeetingsList.tsx`'s T122
 * module doc #10b.) */
export function buildRecurrenceChips(sessions: readonly { sessionDate: string }[]): string[] {
  if (sessions.length <= 1) return [];
  const countByWeekday = new Map<string, number>();
  const order: string[] = [];
  for (const session of sessions) {
    const weekday = WEEKDAY_ABBR_FORMATTER.format(parseDateOnly(session.sessionDate)).toUpperCase();
    if (!countByWeekday.has(weekday)) order.push(weekday);
    countByWeekday.set(weekday, (countByWeekday.get(weekday) ?? 0) + 1);
  }
  return order.map((weekday) => `${weekday} (${countByWeekday.get(weekday)})`);
}

/** e.g. "Sat, Jul 25" (single session) or "Sat, Jul 25 – Thu, Aug 13"
 * (multi-session), reusing `formatWeekdayDate` verbatim (BEH-08 -- still the
 * ONLY weekday-date formatter in this module). (Moved from
 * `MeetingsList.tsx`'s T122 module doc #10b.) */
export function buildDateRangeLabel(sessions: readonly { sessionDate: string }[]): string {
  if (sessions.length === 0) return '';
  const sorted = sessions.slice().sort((a, b) => a.sessionDate.localeCompare(b.sessionDate));
  const first = formatWeekdayDate(sorted[0].sessionDate);
  if (sorted.length === 1) return first;
  const last = formatWeekdayDate(sorted[sorted.length - 1].sessionDate);
  return `${first} – ${last}`;
}

/** Splits a formatted "6:00 PM"-shaped string into its numeric time and
 * trailing meridiem, so `formatTimeRangeWithDuration` below can drop a
 * duplicate meridiem off the start time (PRD line 237's own worked example,
 * "6:00-8:00 PM", never fabricated -- `Intl.DateTimeFormat` alone produces
 * "6:00 PM-8:00 PM", with the meridiem repeated on every instant). */
function splitMeridiem(formatted: string): { time: string; meridiem: string | null } {
  const match = /^(.*?)\s?([AP]M)$/i.exec(formatted);
  return match ? { time: match[1], meridiem: match[2] } : { time: formatted, meridiem: null };
}

/** e.g. "6:00-8:00 PM - 2h" (PRD BEH-08's own worked example, en-dash separators). */
export function formatTimeRangeWithDuration(startsAt: string, endsAt: string): string {
  const startFormatted = CLOCK_TIME_FORMATTER.format(new Date(startsAt));
  const endFormatted = CLOCK_TIME_FORMATTER.format(new Date(endsAt));
  const start = splitMeridiem(startFormatted);
  const end = splitMeridiem(endFormatted);
  const startText =
    start.meridiem !== null && start.meridiem === end.meridiem ? start.time : startFormatted;
  return `${startText}–${endFormatted} · ${formatDuration(startsAt, endsAt)}`;
}

// ---------------------------------------------------------------------------
// buildScheduleChips -- new (GAM-443 prescription 4). The shape GAM-441 will
// freeze into `types.ts`.
//
// Input shape: `{dow, startMinutes, endMinutes}`, minutes-from-Chicago-
// midnight, rather than ISO instants. A recurring rule (e.g. "every Tuesday,
// 6-8 PM") has no date of its own to convert an instant against -- it repeats
// indefinitely, so there is no single day to anchor a `Date` to. This repo
// already localises the wall-clock<->instant conversion that a *scheduled
// session* (a rule applied to one real date) needs, in
// `ScheduleMeetingsDialog.tsx`'s `chicagoWallTimeToUtcIso`; that conversion
// is this function's caller's job, not this function's.
//
// A rule spanning midnight (e.g. "Fri 10 PM - Sat 1 AM") is NOT representable
// by this shape (`endMinutes` is validated against the SAME day as
// `startMinutes`, capped at 1440) and is therefore out of scope for this
// packet. GAM-441 needs to know the shape cannot express it.
//
// Malformed input is a `RangeError`, not a best-effort render or a clamp: a
// chip reading "Tue 8-6 PM" or "undefined 6-8 PM" is a silent lie on screen,
// and a render throw here is caught at the routed-page-content level
// (`src/app/RouteErrorBoundary.tsx:3-8`), not silently swallowed. This is a
// DELIBERATE DIVERGENCE from this repo's usual presentation-helper posture,
// which is uniformly tolerant, not throwing -- `splitMeridiem` above returns
// `{meridiem: null}` rather than throwing on an unparseable string,
// `CalendarPage.tsx`'s `buildEnrichedSessions` silently drops a session whose
// event id doesn't resolve, `OutreachList.tsx`'s `formatChicagoWallTime` uses
// `?? '00'` fallbacks. Do not "fix" this throw for consistency with that
// precedent -- it is intentional here because a malformed schedule rule is a
// caller bug (a hand-built rule, not user-typed freeform text), and a caller
// that needs tolerance for a form-in-progress can filter/validate before
// calling this function.
// ---------------------------------------------------------------------------

/** 0 = Sunday … 6 = Saturday, matching `Date.prototype.getDay()`. */
export type Dow = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export interface ScheduleRule {
  dow: Dow;
  /** Minutes from America/Chicago midnight. Integer, 0–1439. */
  startMinutes: number;
  /** Minutes from America/Chicago midnight. Integer, 1–1440;
   *  1440 means "midnight ending this day". Must be > startMinutes. */
  endMinutes: number;
}

/** Title-case, matching the schedule form's own wireframes
 * (`docs/swarm/VOLT_Portal_PRD.md:153`, `:420`, `:514`,
 * `"Tue · Build Mtg  6–8 PM"`) -- deliberately NOT the upper-case
 * `WEEKDAY_ABBREVIATIONS` `OutreachList.tsx:1633` uses for its own,
 * differently-sourced recurrence chip (`VOLT_Portal_PRD_v2.md:58-59`,
 * `"MON (18) · THU (18)"`). Two chip forms, independent PRD backing; the
 * casing difference is a deliberate, commented contrast, not an accident a
 * later reader should "fix" into agreement. Plain integer indexing, no
 * `Date`/`Intl` -- a recurring rule has no instant to format, so NFR-09
 * simply does not apply to it (and CI runs with
 * `Intl.DateTimeFormat().resolvedOptions().timeZone === 'UTC'`, so a `Date`
 * plus an unpinned formatter here would render in the wrong zone and still
 * pass green). */
const SCHEDULE_WEEKDAY_ABBREVIATIONS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

function validateScheduleRule(rule: ScheduleRule, index: number): void {
  // Order: dow, then startMinutes range, then endMinutes range, then
  // endMinutes > startMinutes. Documented because `startMinutes: 1440`
  // necessarily violates both the startMinutes range check and the
  // endMinutes > startMinutes check at once (no legal endMinutes exists
  // above 1440) -- this order decides, deterministically, which message it
  // carries.
  if (!Number.isInteger(rule.dow) || rule.dow < 0 || rule.dow > 6) {
    throw new RangeError(
      `buildScheduleChips: rules[${index}].dow must be an integer 0-6, got ${String(rule.dow)}`,
    );
  }
  if (!Number.isInteger(rule.startMinutes) || rule.startMinutes < 0 || rule.startMinutes > 1439) {
    throw new RangeError(
      `buildScheduleChips: rules[${index}].startMinutes must be an integer 0-1439, got ${String(rule.startMinutes)}`,
    );
  }
  if (!Number.isInteger(rule.endMinutes) || rule.endMinutes < 1 || rule.endMinutes > 1440) {
    throw new RangeError(
      `buildScheduleChips: rules[${index}].endMinutes must be an integer 1-1440, got ${String(rule.endMinutes)}`,
    );
  }
  if (rule.endMinutes <= rule.startMinutes) {
    throw new RangeError(
      `buildScheduleChips: rules[${index}].endMinutes (${rule.endMinutes}) must be greater than startMinutes (${rule.startMinutes})`,
    );
  }
}

/** Hour conversion is `((h + 11) % 12) + 1`, so `0 -> 12 AM` and
 * `720 -> 12 PM` (NOT `h % 12`, which would render "12-3 AM" as "0-3 AM").
 * Meridiem is `AM` for `minutes < 720` and `PM` for `720 <= minutes < 1440`,
 * with `1440` special-cased to `AM` (the midnight that ENDS the day) so it
 * does not fall through to the `>= 720` branch and print the false `12 PM`.
 * `:00` minutes are dropped; non-zero minutes are kept, zero-padded. */
function formatScheduleClockPart(minutesFromMidnight: number): {
  time: string;
  meridiem: 'AM' | 'PM';
} {
  const hour24 = Math.floor(minutesFromMidnight / 60);
  const hourText = String(((hour24 + 11) % 12) + 1);
  const minutePart = minutesFromMidnight % 60;
  const time = minutePart === 0 ? hourText : `${hourText}:${String(minutePart).padStart(2, '0')}`;
  const meridiem: 'AM' | 'PM' =
    minutesFromMidnight === 1440 ? 'AM' : minutesFromMidnight < 720 ? 'AM' : 'PM';
  return { time, meridiem };
}

/** A meridiem shared by both ends is written once, at the end (the same
 * collapse `formatTimeRangeWithDuration` performs above). When the ends
 * straddle noon or midnight, both appear. En dash between the times,
 * matching the existing formatter. */
function formatScheduleTimeRange(startMinutes: number, endMinutes: number): string {
  const start = formatScheduleClockPart(startMinutes);
  const end = formatScheduleClockPart(endMinutes);
  const startText =
    start.meridiem === end.meridiem ? start.time : `${start.time} ${start.meridiem}`;
  return `${startText}–${end.time} ${end.meridiem}`;
}

/** One chip per rule, in input order, e.g. `"Tue 6–8 PM"`,
 * `"Sun 3:30–6:30 PM"`. Throws `RangeError` on malformed input -- see the
 * block comment above this section for the full decision record. */
export function buildScheduleChips(rules: readonly ScheduleRule[]): string[] {
  return rules.map((rule, index) => {
    validateScheduleRule(rule, index);
    const weekday = SCHEDULE_WEEKDAY_ABBREVIATIONS[rule.dow];
    return `${weekday} ${formatScheduleTimeRange(rule.startMinutes, rule.endMinutes)}`;
  });
}
