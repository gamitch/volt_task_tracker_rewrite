// T032: MTG-06 -- "Short-code attempts rate-limited to 5/min per user."
//
// FLAGGED LIMITATION (see worker packet + worker output): no rate-limit
// tracking table exists anywhere in the frozen schema (T009-T012), and this
// task's Allowed Files exclude `supabase/migrations/**`, so no persisted
// store can be added here. This is a purely in-process, in-memory sliding
// window counter, scoped to the current Edge Function isolate's own runtime
// only. Deno Edge Functions can run as multiple isolated instances under
// load (and the counter resets completely on every cold start), so this is
// a best-effort per-isolate limit, NOT a globally-precise 5/min guarantee
// across the whole deployed function. If durable, cross-instance-accurate
// rate limiting is required, a persisted store (e.g. a new
// `checkin_rate_limits` table, or an external store) needs to be authorized
// as a separate, explicitly-scoped follow-up -- this is flagged as an open
// risk for the foreman, not silently worked around.

export const SHORT_CODE_RATE_LIMIT = 5;
export const SHORT_CODE_RATE_WINDOW_MS = 60_000;

export class InMemoryRateLimiter {
  private hits = new Map<string, number[]>();

  constructor(
    private readonly limit: number = SHORT_CODE_RATE_LIMIT,
    private readonly windowMs: number = SHORT_CODE_RATE_WINDOW_MS,
  ) {}

  /**
   * Records one attempt for `key` at `nowMs`. Returns `true` if the attempt
   * is allowed (fewer than `limit` attempts recorded for `key` within the
   * trailing `windowMs`), `false` if it should be rejected. A sliding
   * window (not a fixed-bucket window), so exactly 5 attempts within any
   * rolling 60s span are allowed and the 6th within that same span is
   * denied.
   */
  attempt(key: string, nowMs: number): boolean {
    const cutoff = nowMs - this.windowMs;
    const existing = (this.hits.get(key) ?? []).filter((t) => t > cutoff);
    if (existing.length >= this.limit) {
      this.hits.set(key, existing);
      return false;
    }
    existing.push(nowMs);
    this.hits.set(key, existing);
    return true;
  }

  /** Test/debug helper: current recorded (unfiltered) hit count for `key`. */
  rawCount(key: string): number {
    return this.hits.get(key)?.length ?? 0;
  }
}

// Module-level singleton used by index.ts's HTTP handler -- shared across
// requests handled by the same warm isolate only (see limitation note
// above).
export const shortCodeRateLimiter = new InMemoryRateLimiter();
