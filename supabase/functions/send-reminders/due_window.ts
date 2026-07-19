// supabase/functions/send-reminders/due_window.ts
//
// T051 -- EML-03 "due session" window math (worker packet Known Context/
// Traps #2). Pure, dependency-free date-math helpers, unit-testable without
// a live Supabase project -- the same "pure logic separate from I/O" posture
// already established by checkin/liveness.ts, checkin/grace.ts,
// send-invite/validation.ts.
//
// DUE-WINDOW DEFINITION for the three PER-SESSION templates (cited verbatim
// from the worker packet, not invented): a session becomes "due" for a given
// template exactly once, when `starts_at` falls within
// `[offsetHours, offsetHours + windowMinutes)` FROM NOW -- i.e.
// `(starts_at - now)`, in minutes, lies in
// `[offsetHours * 60, offsetHours * 60 + windowMinutes)`. `windowMinutes`
// defaults to 15, matching the cron's own 15-minute cadence (the packet's
// own "natural window granularity" -- the dedupe check in `email_log_store.ts`
// is the second line of defense if the cron overlaps/retries within that
// same window).
//   - event-reminder-48h:   offsetHours = 48
//   - event-reminder-3h:    offsetHours = 3
//   - meeting-reminder-3h:  offsetHours = 3 (same shape; the meeting-type
//     event filter itself lives in index.ts's query, not here -- this
//     module has no database access and no event-type concept)
//
// This module exposes BOTH:
//   1. `isDueForOffset` -- a pure per-row predicate (startsAt, now) ->
//      boolean, used directly by this file's own tests to pin down exact
//      boundary behavior (inclusive lower bound, exclusive upper bound).
//   2. `computeDueWindowBounds` -- the equivalent range expressed as
//      `starts_at` bounds (an ISO `[start, end)` pair), used by index.ts to
//      push the filter down into the actual Postgres query
//      (`.gte('starts_at', bounds.start).lt('starts_at', bounds.end)`)
//      rather than fetching every scheduled session and filtering in
//      memory. `due_window.test.ts`'s "bounds agree with the predicate"
//      case proves these two are equivalent.
//
// WEEKLY-DIGEST SCOPE DISCLOSURE (worker packet Known Context/Traps #2,
// required to be explicit): weekly-digest is NOT a per-session reminder --
// EML-02 documents it as "Sundays 5pm CT", a whole-batch job across ALL of a
// parent's linked students, not tied to any one `event_sessions.starts_at`
// value. The offset/window math above (keyed on a session's own `starts_at`)
// does not apply to it at all. Per the packet's own suggested fallback,
// `isWeeklyDigestDue`/`computeWeeklyDigestSentAtWindow` below implement the
// simpler, separate check instead: "is it currently within 15 minutes after
// Sunday 5pm CT" -- fires once per profile per week. This is implemented
// (not deferred as a dispute/follow-up), but see index.ts's own header
// comment and this task's worker-output "weekly-digest scope disclosure"
// section for the dedupe-key consequence of session_id always being null
// for this template (email_log has no "which week" column of its own).

export const DEFAULT_WINDOW_MINUTES = 15;

/** `(startsAt - now)`, expressed in minutes (fractional). Positive means
 * `startsAt` is in the future relative to `now`. */
export function computeMinutesUntil(startsAt: Date, now: Date): number {
  return (startsAt.getTime() - now.getTime()) / 60000;
}

/**
 * True iff `startsAt` falls within `[offsetHours, offsetHours + windowMinutes)`
 * hours/minutes from `now` -- inclusive lower bound, exclusive upper bound
 * (see file header). Pure -- no Date.now(), no I/O.
 */
export function isDueForOffset(
  startsAt: Date,
  now: Date,
  offsetHours: number,
  windowMinutes: number = DEFAULT_WINDOW_MINUTES,
): boolean {
  const minutesUntil = computeMinutesUntil(startsAt, now);
  const lowerBoundMinutes = offsetHours * 60;
  const upperBoundMinutes = lowerBoundMinutes + windowMinutes;
  return minutesUntil >= lowerBoundMinutes && minutesUntil < upperBoundMinutes;
}

export interface DueWindowBounds {
  /** Inclusive lower bound for `starts_at`, ISO 8601 UTC. */
  start: string;
  /** Exclusive upper bound for `starts_at`, ISO 8601 UTC. */
  end: string;
}

/**
 * The `starts_at` range equivalent to `isDueForOffset(startsAt, now,
 * offsetHours, windowMinutes)` -- for pushing the filter into a real
 * Postgres query (`.gte('starts_at', bounds.start).lt('starts_at',
 * bounds.end)`) instead of scanning every scheduled session in memory.
 */
export function computeDueWindowBounds(
  now: Date,
  offsetHours: number,
  windowMinutes: number = DEFAULT_WINDOW_MINUTES,
): DueWindowBounds {
  const start = new Date(now.getTime() + offsetHours * 60 * 60 * 1000);
  const end = new Date(start.getTime() + windowMinutes * 60 * 1000);
  return { start: start.toISOString(), end: end.toISOString() };
}

// ---------------------------------------------------------------------------
// weekly-digest -- separate, simpler check (see file header disclosure).
// ---------------------------------------------------------------------------

const CHICAGO_TIME_ZONE = 'America/Chicago';

// `hourCycle: 'h23'` avoids the "24" vs "0" midnight ambiguity some locales
// otherwise introduce for hour 0; not load-bearing at 17:00 but kept for
// correctness/consistency with the rest of this codebase's Chicago
// formatters (event-reminder-48h.tsx etc. use `en-US` + explicit numeric
// options the same way).
const CHICAGO_WALL_CLOCK_FORMATTER = new Intl.DateTimeFormat('en-US', {
  timeZone: CHICAGO_TIME_ZONE,
  weekday: 'short',
  hour: 'numeric',
  minute: 'numeric',
  hourCycle: 'h23',
});

interface ChicagoWallClock {
  weekday: string;
  hour: number;
  minute: number;
}

/** Uses `Intl.DateTimeFormat` to read `instant`'s real America/Chicago wall
 * clock -- correct across DST transitions automatically (no manual
 * fixed-UTC-offset arithmetic, which would silently be wrong for half the
 * year). Same technique this repo's own template files already use for
 * BEH-08 date rendering (e.g. `event-reminder-48h.tsx`'s
 * `CLOCK_TIME_FORMATTER`). */
function readChicagoWallClock(instant: Date): ChicagoWallClock {
  const parts = CHICAGO_WALL_CLOCK_FORMATTER.formatToParts(instant);
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? '';
  return {
    weekday: get('weekday'),
    hour: Number(get('hour')),
    minute: Number(get('minute')),
  };
}

/**
 * EML-02's weekly-digest schedule: "Sundays 5pm CT". Per the worker packet's
 * own suggested fallback (see file header): "is it currently within 15
 * minutes after Sunday 5pm CT" -- fires once per profile per week. The
 * actual once-per-week DEDUPE guarantee is enforced separately by
 * `email_log_store.ts`'s `sentAtWindow` criterion for this template (see
 * that file's header for why session_id cannot be the key here) -- this
 * function only answers "is *a* send window open right now for
 * weekly-digest".
 */
export function isWeeklyDigestDue(now: Date, windowMinutes: number = DEFAULT_WINDOW_MINUTES): boolean {
  const wallClock = readChicagoWallClock(now);
  if (wallClock.weekday !== 'Sun') return false;
  if (wallClock.hour !== 17) return false;
  return wallClock.minute < windowMinutes;
}

/**
 * The current weekly-digest send window as `[start, end)` real UTC instants,
 * anchored to the top of the current Chicago 17:00 hour (only meaningful
 * when `isWeeklyDigestDue(now)` is already true; callers gate on that first
 * -- this function does not itself re-check the weekday/hour). Used as the
 * `email_log.sent_at` dedupe bucket for weekly-digest (see index.ts /
 * `email_log_store.ts`). `getUTCSeconds()`/`getUTCMilliseconds()` (not the
 * host's local-timezone equivalents) are used so this has no dependency on
 * the server process's own configured timezone -- seconds/milliseconds
 * within a minute are identical in every timezone with a whole-minute UTC
 * offset (true for America/Chicago in every era relevant here), so this
 * remains correct regardless of what timezone the Deno runtime itself is
 * configured with.
 */
export function computeWeeklyDigestSentAtWindow(
  now: Date,
  windowMinutes: number = DEFAULT_WINDOW_MINUTES,
): DueWindowBounds {
  const wallClock = readChicagoWallClock(now);
  const start = new Date(
    now.getTime() - wallClock.minute * 60 * 1000 - now.getUTCSeconds() * 1000 - now.getUTCMilliseconds(),
  );
  const end = new Date(start.getTime() + windowMinutes * 60 * 1000);
  return { start: start.toISOString(), end: end.toISOString() };
}
