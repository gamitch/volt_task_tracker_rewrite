/**
 * @file dates.ts
 * @input Uses `Intl.DateTimeFormat` only -- no other repo modules.
 * @output Exports `formatFriendlyDate`/`formatFriendlyDateRange`, plain-
 *   language replacements for raw ISO `YYYY-MM-DD` strings (UXC-11).
 * @position Shared `src/lib/` utility. New in T129 (rev. 2 packet, Item 3) --
 *   this repo previously had no shared date formatter; ~15 near-duplicate
 *   `Intl.DateTimeFormat` call sites existed across page modules instead
 *   (grep-confirmed at packet-authoring time). This file consolidates the
 *   ONE correct pattern so future call sites can import it instead of
 *   re-deriving the timezone handling below.
 *
 * SYNC: no other files require updating when this one changes -- it has no
 * generated/mirrored artifacts.
 */

/**
 * `event_sessions.session_date` (and every other plain SQL `date` column
 * this repo formats for display) has NO time-of-day component. Seeded
 * verbatim from `CoachHome.tsx`'s own `formatSessionDateLabel` (module doc:
 * "a `date`-only string parsed by `Date` is UTC-midnight; formatting in a
 * negative-UTC-offset local zone would otherwise silently roll it back a
 * day") -- the explicit `timeZone: 'UTC'` below is REQUIRED, not
 * decorative: without it, a viewer in any UTC-negative zone (all of the
 * Americas) would see a date one calendar day earlier than what was
 * actually stored.
 *
 * @param dateOnly A plain `YYYY-MM-DD` string (a SQL `date` column value,
 *   or any date-only string in that shape). NOT a full ISO timestamp --
 *   passing a `timestamptz` string here is still safe (it only reads the
 *   calendar-date portion once pinned to UTC), but that isn't this
 *   function's intended input.
 * @returns A short, friendly label, e.g. `"Wed, Jul 22"`. Never a raw ISO
 *   string.
 */
export function formatFriendlyDate(dateOnly: string): string {
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(dateOnly));
}

/**
 * A friendly label for a (possibly single-day) date range, e.g. an outreach
 * event's first/last session date. Collapses to a single
 * `formatFriendlyDate` call when both ends are the same calendar day
 * (matches this repo's existing `entry.startsOn === entry.endsOn` single-day
 * convention), otherwise joins both friendly dates with an en dash.
 *
 * @param startDateOnly A plain `YYYY-MM-DD` string, the range's first day.
 * @param endDateOnly A plain `YYYY-MM-DD` string, the range's last day.
 * @returns e.g. `"Jun 1 – Jun 3"` (multi-day) or `"Jun 1"` (single-day).
 */
export function formatFriendlyDateRange(startDateOnly: string, endDateOnly: string): string {
  return startDateOnly === endDateOnly
    ? formatFriendlyDate(startDateOnly)
    : `${formatFriendlyDate(startDateOnly)} – ${formatFriendlyDate(endDateOnly)}`;
}
