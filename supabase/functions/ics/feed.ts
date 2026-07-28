// supabase/functions/ics/feed.ts
//
// Pure composition layer: given an already-resolved role + the caller's
// relevant team ids (gathered by index.ts from `students`/`guardian_links`,
// which needs the database) plus already-fetched `events`/`event_sessions`/
// `rsvps` rows (also gathered by index.ts), this module applies the PRD
// 8.3/8.4 scoping decision (role_scope.ts) and the DESCRIPTION/RSVP decision
// (description.ts), then hands the final per-session rows to ics_builder.ts
// to render through `ical-generator`. Extracting this from index.ts makes
// the actual "who sees what, and why" decision testable with `deno test`
// against fixture arrays, independent of any database connection -- the same
// separation-of-I/O-from-logic pattern checkin/index.ts uses for
// liveness.ts/attendance_upsert.ts.
//
// index.ts is responsible for the *date-window* filter (window.ts's 30-days-
// past cutoff) before calling this module -- `sessions` here is assumed to
// already be window-filtered. This module only ever narrows further by
// event/team scope, it never re-applies or second-guesses the date window.
import { buildDescription, type IcsRole } from './description.ts';
import { buildIcsFeed, type IcsSessionRow } from './ics_builder.ts';
import { isEventInScope, resolveRoleScope } from './role_scope.ts';

export interface FeedEventRow {
  address: string;
  id: string;
  location_name: string;
  team_ids: string[] | null;
  title: string;
  type: string;
}

export interface FeedSessionRow {
  ends_at: string;
  event_id: string;
  id: string;
  starts_at: string;
  status: 'canceled' | 'completed' | 'scheduled';
}

export interface BuildFeedInput {
  events: FeedEventRow[];
  // The caller's own team (student role, one element) or the UNION of every
  // linked student's team (parent role, one element per distinct team) --
  // see role_scope.ts's header for the full write-up. Ignored for
  // admin/coach (resolveRoleScope always returns { kind: 'all' } for them).
  relevantTeamIds: string[];
  role: IcsRole;
  // Only meaningfully populated for the student role (see description.ts) --
  // index.ts does not bother querying `rsvps` at all for admin/coach/parent,
  // since buildDescription() ignores this map for every role but 'student'.
  rsvpBySessionId: Map<string, string>;
  // Already date-window-filtered (30-days-past through all future) by
  // index.ts's own `event_sessions` query -- see window.ts.
  sessions: FeedSessionRow[];
}

export function buildFeed(input: BuildFeedInput): string {
  const scope = resolveRoleScope(input.role, input.relevantTeamIds);
  const eventsById = new Map(input.events.map((event) => [event.id, event]));
  const scopedEventIds = new Set(
    input.events.filter((event) => isEventInScope(event.team_ids, scope)).map((event) => event.id),
  );

  const rows: IcsSessionRow[] = input.sessions
    .filter((session) => scopedEventIds.has(session.event_id))
    .map((session) => {
      const event = eventsById.get(session.event_id);
      if (!event) {
        // Defensive: cannot happen given `scopedEventIds` is itself derived
        // from `eventsById`'s own keys, but TypeScript's Map#get is
        // nullable, so this satisfies strict mode rather than a non-null
        // assertion masking a real bug if the invariant is ever broken.
        throw new Error(`ics: session ${session.id} references unknown event ${session.event_id}`);
      }
      const rsvpStatus = input.rsvpBySessionId.get(session.id) ?? null;
      return {
        address: event.address,
        description: buildDescription(input.role, rsvpStatus),
        endsAt: session.ends_at,
        eventTitle: event.title,
        eventType: event.type,
        locationName: event.location_name,
        sessionId: session.id,
        startsAt: session.starts_at,
        status: session.status,
      };
    });

  return buildIcsFeed(rows);
}
