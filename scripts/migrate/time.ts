// T062 (MIG-03): parse old-project `date` (proper SQL date) + `start_time` /
// `end_time` (free text) into a new-project `timestamptz`, interpreted as
// wall-clock time in America/Chicago, per docs/migration/mapping.md:
// "parse in America/Chicago; unparseable strings fall back to 00:00 and are
// flagged in the migration report." Known Context/Traps #3: this exact
// fallback (00:00, not skip/throw) must be implemented, and the flagged
// report must list which rows fell back, not just a count.

const TIME_TZ = 'America/Chicago';

interface WallClockTime {
  hour: number;
  minute: number;
  second: number;
}

/**
 * Accepts a handful of realistic old-app free-text time formats:
 *   "14:30", "14:30:00", "2:30 PM", "2:30pm", "02:30 AM"
 * Returns null (unparseable) for anything else -- including empty/null
 * input, out-of-range values, and garbage strings.
 */
export function parseTimeText(raw: string | null | undefined): WallClockTime | null {
  if (raw == null) {
    return null;
  }
  const trimmed = raw.trim();
  if (trimmed.length === 0) {
    return null;
  }

  const twentyFourHour = /^([0-9]{1,2}):([0-9]{2})(?::([0-9]{2}))?$/.exec(trimmed);
  const twelveHour = /^([0-9]{1,2}):([0-9]{2})\s*([AaPp][Mm])$/.exec(trimmed);

  let hour: number;
  let minute: number;
  let second = 0;

  if (twelveHour) {
    hour = Number(twelveHour[1]);
    minute = Number(twelveHour[2]);
    const meridiem = (twelveHour[3] as string).toLowerCase();
    if (hour < 1 || hour > 12) {
      return null;
    }
    if (meridiem === 'am') {
      hour = hour === 12 ? 0 : hour;
    } else {
      hour = hour === 12 ? 12 : hour + 12;
    }
  } else if (twentyFourHour) {
    hour = Number(twentyFourHour[1]);
    minute = Number(twentyFourHour[2]);
    second = twentyFourHour[3] ? Number(twentyFourHour[3]) : 0;
  } else {
    return null;
  }

  if (
    !Number.isInteger(hour) ||
    !Number.isInteger(minute) ||
    !Number.isInteger(second) ||
    hour < 0 ||
    hour > 23 ||
    minute < 0 ||
    minute > 59 ||
    second < 0 ||
    second > 59
  ) {
    return null;
  }

  return { hour, minute, second };
}

interface DateComponents {
  year: number;
  month: number; // 1-indexed
  day: number;
}

function parseDateOnly(dateStr: string): DateComponents | null {
  const match = /^([0-9]{4})-([0-9]{2})-([0-9]{2})/.exec(dateStr.trim());
  if (!match) {
    return null;
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) {
    return null;
  }
  return { year, month, day };
}

/**
 * Returns the UTC offset (in minutes, UTC minus local -- e.g. +300 for
 * CDT/UTC-5, +360 for CST/UTC-6) that `timeZone` observes at the instant
 * represented by treating (date, time) as if they were already UTC. This is
 * the standard "guess, format, correct" technique for converting a
 * zoned wall-clock time to a real UTC instant using only Intl (no new
 * dependency required).
 */
function resolveOffsetMinutes(utcGuessMs: number, timeZone: string): number {
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
  const parts = formatter.formatToParts(new Date(utcGuessMs));
  const get = (type: string): number => Number(parts.find((p) => p.type === type)?.value ?? '0');
  const tzWallAsUtcMs = Date.UTC(
    get('year'),
    get('month') - 1,
    get('day'),
    get('hour') === 24 ? 0 : get('hour'),
    get('minute'),
    get('second'),
  );
  return (utcGuessMs - tzWallAsUtcMs) / 60000;
}

/**
 * Convert a wall-clock (date, time) pair -- interpreted in `timeZone` -- to
 * a real UTC ISO-8601 timestamp string.
 */
function zonedWallClockToUtcIso(
  date: DateComponents,
  time: WallClockTime,
  timeZone: string,
): string {
  const utcGuessMs = Date.UTC(
    date.year,
    date.month - 1,
    date.day,
    time.hour,
    time.minute,
    time.second,
  );
  const offsetMinutes = resolveOffsetMinutes(utcGuessMs, timeZone);
  const realUtcMs = utcGuessMs + offsetMinutes * 60000;
  return new Date(realUtcMs).toISOString();
}

export interface ParsedSessionTimeField {
  iso: string;
  fellBack: boolean;
}

/**
 * Parse one old event_sessions text time field (`start_time` or
 * `end_time`) against its session `date`, in America/Chicago. On any parse
 * failure (of either the date or the time text), falls back to 00:00 on
 * that date, per mapping.md -- and reports the fallback via `fellBack`.
 */
export function parseSessionTimeField(
  dateStr: string,
  rawTime: string | null | undefined,
  timeZone: string = TIME_TZ,
): ParsedSessionTimeField {
  const date = parseDateOnly(dateStr);
  const time = parseTimeText(rawTime);

  if (date && time) {
    return { iso: zonedWallClockToUtcIso(date, time, timeZone), fellBack: false };
  }

  // Fallback: 00:00 on the session date (per mapping.md, exactly this
  // fallback -- never skip the row, never throw). If even the date itself
  // is unparseable, fall back to the UTC epoch-adjacent date computed from
  // whatever we can salvage; in practice `date` always parses because it is
  // a proper SQL `date` column, not free text (see types.ts OldEventSession
  // doc comment), so this nested fallback is a defensive belt-and-braces
  // path, not the primary one described by mapping.md.
  const safeDate = date ?? { year: 1970, month: 1, day: 1 };
  return {
    iso: zonedWallClockToUtcIso(safeDate, { hour: 0, minute: 0, second: 0 }, timeZone),
    fellBack: true,
  };
}

export const DEFAULT_MIGRATION_TIME_ZONE = TIME_TZ;
