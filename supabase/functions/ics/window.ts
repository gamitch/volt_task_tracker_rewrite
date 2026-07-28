// supabase/functions/ics/window.ts
//
// CAL-04: "Includes sessions from 30 days past to all future" (relative to
// request time). This module computes only the lower bound -- there is
// deliberately no upper bound function, since "all future" means index.ts's
// `event_sessions` query has no upper `starts_at` filter at all.

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

export function computeWindowStart(now: Date): Date {
  return new Date(now.getTime() - THIRTY_DAYS_MS);
}
