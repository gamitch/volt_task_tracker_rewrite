// T032: MTG-04 session liveness window.
//
// FLAGGED SCHEMA GAP (see worker packet + worker output): PRD MTG-04 also
// says "Coach can also manually Start check-in early/late from the session
// row." `event_sessions` (supabase/migrations/20260717000000_scheduling_
// attendance.sql) has only `status` / `session_date` / `starts_at` /
// `ends_at` / `people_reached` / `notes` -- there is no column recording a
// manual "started early/late" override, and this task's Allowed Files
// exclude `supabase/migrations/**` (schema is frozen). This module
// therefore implements ONLY the time-window half of MTG-04: a session is
// live from `LIVE_WINDOW_BEFORE_START_MIN` minutes before `starts_at`
// through `ends_at`, provided `status = 'scheduled'`. The manual early/late
// override clause is NOT implemented here; it has no backing schema field
// in the current frozen migrations and is left as an explicit gap for a
// future task (most likely T033's Live Console, which may need a new
// `event_sessions` column such as `checkin_opened_at` to represent a
// coach-triggered manual open/close, requiring its own migration).

export const LIVE_WINDOW_BEFORE_START_MIN = 15;

export type LivenessReason = 'not_scheduled' | 'not_yet_open' | 'closed';

export type LivenessResult = { live: true } | { live: false; reason: LivenessReason };

/**
 * `status` must be exactly `'scheduled'` (a `'canceled'` or `'completed'`
 * session is never live, regardless of time window). Otherwise live from
 * `starts_at - 15min` through `ends_at`, inclusive on both ends.
 */
export function checkSessionLiveness(status: string, startsAt: Date, endsAt: Date, now: Date): LivenessResult {
  if (status !== 'scheduled') {
    return { live: false, reason: 'not_scheduled' };
  }
  const opensAtMs = startsAt.getTime() - LIVE_WINDOW_BEFORE_START_MIN * 60_000;
  if (now.getTime() < opensAtMs) {
    return { live: false, reason: 'not_yet_open' };
  }
  if (now.getTime() > endsAt.getTime()) {
    return { live: false, reason: 'closed' };
  }
  return { live: true };
}
