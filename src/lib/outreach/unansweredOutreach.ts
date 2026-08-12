/**
 * GAM-301 (T407) round 3: pure leaf module holding the BEH-04 "unanswered
 * outreach" predicate, relocated out of `src/pages/home/StudentHome.tsx` (a
 * LAZY page module) so `src/components/nav/useOutreachBadgeCount.ts` (EAGER
 * nav chrome, mounted inside `SideNav`/`MobileNav`) can compute the Outreach
 * nav badge without value-importing `StudentHome.tsx` -- which would pull
 * that entire page (and everything else it imports) into the eager entry
 * chunk. Round 2 of this task measured exactly this failure mode against a
 * sibling loader (`meetings.ts`, BLOCKER 2 in the round 3 packet): +50.47 kB
 * gz / 18 lazy chunks collapsed. This relocation exists specifically to
 * avoid repeating it for `StudentHome.tsx`.
 *
 * Pure relocation, verbatim logic (not re-derived): the six names below
 * (`isEventInTeamScope`, `getUnansweredOutreachOpportunities`,
 * `HomeEventRow`, `HomeSessionRow`, `HomeRsvpRow`, `SignupOpportunityRow`)
 * are MOVED from `StudentHome.tsx`, which documents the original BEH-04
 * "unanswered" semantics in full on its own module docs #7 ("oldest
 * unanswered" = earliest-starting eligible session; a future, team-scoped,
 * `outreach`-type session with no `rsvps` row at all for this student --
 * `maybe`/`declined` ARE answers) and #8/#9 (team-scope via
 * `isEventInTeamScope`, honoring `team_ids === null` as "all teams").
 * `StudentHome.tsx` re-exports all six from this file (`export { ... } from`
 * / `export type { ... } from`, both valid under this repo's
 * `isolatedModules: true`) so its own existing imports/tests are unaffected
 * -- `StudentHome.test.tsx` keeps importing these names from `./StudentHome`
 * completely unmodified.
 *
 * `SignupOpportunityRow` (`getUnansweredOutreachOpportunities`'s own return
 * type) is MOVED here rather than left in `StudentHome.tsx` and type-imported
 * back -- the packet's own instruction: the new leaf module must not import
 * anything back from `StudentHome.tsx` at all (not even a type), which would
 * recreate a dependency edge pointing straight back at the page module this
 * relocation exists to route around.
 *
 * For the same reason, `EventType`/`SessionStatus`/`RsvpStatus` (the three
 * union-type aliases `StudentHome.tsx` defines alongside the six relocated
 * names, still used there for its own `NextUpRow`/RSVP-control types that do
 * NOT move) are not imported back either -- `HomeEventRow.type`/
 * `HomeSessionRow.status`/`HomeRsvpRow.status` below use the identical
 * string-literal unions inline instead. This is structurally identical
 * (TypeScript unifies the two by shape, not by name) so nothing observable
 * changes for any caller on either side of the relocation.
 *
 * No React/Astryx import anywhere in this file (grep-provable) -- a plain,
 * framework-free leaf so it is safe to import from eager nav chrome without
 * dragging any UI framework surface beyond what is already eager.
 */

export interface HomeEventRow {
  id: string;
  seasonId: string;
  type: 'meeting' | 'outreach' | 'competition';
  title: string;
  /** `null` = all teams, per `events.team_ids`. */
  teamIds: readonly string[] | null;
  /** Verbatim rename of `events.counts_volunteer_hours`. */
  countsVolunteerHours: boolean;
}

export interface HomeSessionRow {
  id: string;
  eventId: string;
  startsAt: string;
  endsAt: string;
  status: 'scheduled' | 'completed' | 'canceled';
}

export interface HomeRsvpRow {
  id: string;
  sessionId: string;
  studentId: string;
  status: 'going' | 'maybe' | 'declined';
  updatedAt: string;
}

export interface SignupOpportunityRow {
  sessionId: string;
  title: string;
  startsAt: string;
}

/** The ONLY team-scope predicate for this file's own
 * `getUnansweredOutreachOpportunities` -- honors `team_ids === null` as "all
 * teams" per the real `events` schema. An event is in scope when it shares
 * AT LEAST ONE id with the given (possibly multi-team) student team-id set. */
export function isEventInTeamScope(
  event: { teamIds: readonly string[] | null },
  teamIds: readonly string[],
): boolean {
  return event.teamIds === null || event.teamIds.some((id) => teamIds.includes(id));
}

/** BEH-04's "unanswered" definition (`StudentHome.tsx` module doc #7, not
 * re-derived here): a future (`status === 'scheduled'`, not yet started)
 * `outreach`-type session with NO `rsvps` row at all for this student
 * (`maybe`/`declined` ARE answers and are excluded). Sorted earliest-starting
 * first ("oldest unanswered"). */
export function getUnansweredOutreachOpportunities(
  sessions: readonly HomeSessionRow[],
  events: readonly HomeEventRow[],
  rsvps: readonly HomeRsvpRow[],
  studentId: string,
  teamIds: readonly string[],
  nowMs: number,
): SignupOpportunityRow[] {
  const eventById = new Map(
    events
      .filter((event) => event.type === 'outreach' && isEventInTeamScope(event, teamIds))
      .map((event) => [event.id, event] as const),
  );
  return sessions
    .filter((session) => {
      if (session.status !== 'scheduled') return false;
      if (new Date(session.startsAt).getTime() < nowMs) return false;
      const event = eventById.get(session.eventId);
      if (!event) return false;
      return !rsvps.some((rsvp) => rsvp.sessionId === session.id && rsvp.studentId === studentId);
    })
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt))
    .map((session) => ({
      sessionId: session.id,
      title: eventById.get(session.eventId)!.title,
      startsAt: session.startsAt,
    }));
}
