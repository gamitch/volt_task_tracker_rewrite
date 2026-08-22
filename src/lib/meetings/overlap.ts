// GAM-450: the single, pure `buildOverlapIndex` computation behind the three
// badge sites (`SeriesCard`, `SchedulePanel`, `MeetingsRail`) -- see
// `meetings-design` skill, "Overlap badges". `OverlapRef`/`OverlapIndex` are
// frozen by GAM-444 (`types.ts:350-356`) and imported, not restated, here.
import type { OverlapIndex, OverlapRef, SessionStatus } from './types';

/** The one shape this ticket defines. Field names match
 * `CoachMeetingSessionDetail` (`types.ts:78-103`) plus `eventId`, so the
 * assembly call site needs no adapter:
 * `buildOverlapIndex(rows.flatMap((r) => r.sessions.map((s) => ({ ...s, eventId: r.eventId }))))`. */
export interface OverlapSessionInput {
  sessionId: string;
  eventId: string;
  /** Stored Chicago calendar date, `YYYY-MM-DD`. The day bucket. */
  sessionDate: string;
  /** UTC ISO instant. */
  startsAt: string;
  /** UTC ISO instant. */
  endsAt: string;
  status: SessionStatus;
}

/** Which other sessions (different series, same Chicago day, genuinely
 * intersecting times, neither canceled) does each session clash with?
 * Pure and synchronous -- no `Date.now()`, no I/O, no input mutation.
 * Only sessions with at least one clash appear as keys (rule 5); refs follow
 * input order (rule 6). */
export function buildOverlapIndex(sessions: readonly OverlapSessionInput[]): OverlapIndex {
  const index = new Map<string, OverlapRef[]>();

  // Bucket by the stored Chicago calendar date string -- NOT by re-deriving
  // a day from `startsAt`/`endsAt` in any zone. Evening sessions routinely
  // cross into the next UTC date (coachModel.ts:169-174), so a UTC-derived
  // bucket would silently split same-day sessions or merge different-day
  // ones. Canceled sessions are excluded up front (rule 4, both directions).
  const byDay = new Map<string, OverlapSessionInput[]>();
  for (const session of sessions) {
    if (session.status === 'canceled') continue;
    const bucket = byDay.get(session.sessionDate);
    if (bucket) {
      bucket.push(session);
    } else {
      byDay.set(session.sessionDate, [session]);
    }
  }

  for (const bucket of byDay.values()) {
    for (let i = 0; i < bucket.length; i++) {
      const a = bucket[i];
      const aStart = Date.parse(a.startsAt);
      const aEnd = Date.parse(a.endsAt);
      for (let j = i + 1; j < bucket.length; j++) {
        const b = bucket[j];
        if (a.eventId === b.eventId) continue; // rule 1: different series only

        const bStart = Date.parse(b.startsAt);
        const bEnd = Date.parse(b.endsAt);

        // Rule 3: strict on both sides -- touching intervals do not overlap.
        if (aStart < bEnd && bStart < aEnd) {
          addRef(index, a.sessionId, { sessionId: b.sessionId, eventId: b.eventId });
          addRef(index, b.sessionId, { sessionId: a.sessionId, eventId: a.eventId });
        }
      }
    }
  }

  return index;
}

function addRef(index: Map<string, OverlapRef[]>, sessionId: string, ref: OverlapRef): void {
  const existing = index.get(sessionId);
  if (existing) {
    existing.push(ref);
  } else {
    index.set(sessionId, [ref]);
  }
}
