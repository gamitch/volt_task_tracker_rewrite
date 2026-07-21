// supabase/functions/ics/role_scope.ts
//
// PRD 8.3/8.4 role-scoping matrix, re-derived here EXPLICITLY because this
// function runs under the service-role client (bypasses RLS entirely, same
// architecture as checkin/index.ts) -- unlike an authenticated client query,
// nothing enforces the "events / sessions" row of the 8.3 matrix for us here.
// This module is the single place that decision is made, so it can be
// exercised with `deno test` independent of any database.
//
// PRD 8.3 matrix row (verbatim), cited in the T047 worker packet:
//   "events / sessions | full | read team-scoped | read linked students' scope"
// PRD 8.4's own `my_student_ids()` reference SQL (the RLS-side equivalent of
// this module, quoted verbatim so the parallel is explicit):
//   select id from students where profile_id = auth.uid()
//   union
//   select student_id from guardian_links where parent_profile_id = auth.uid()
// -- i.e. a parent's scope is the UNION of every linked student's own scope,
// not just the first/primary one. This module's `resolveRoleScope` takes the
// caller's full resolved list of relevant team ids (their own team, for a
// student; the union of every linked student's team, for a parent) and does
// not re-derive that union itself -- index.ts is responsible for gathering
// that list from `students`/`guardian_links` (see its own comments for the
// exact queries), because that step needs the database. This module then
// applies the actual events-table membership rule, and is what's meant by
// "explicitly in this function's own query logic" in the worker packet:
// `events.team_ids` is nullable (null = all teams, per the T010 migration's
// own column comment), so an event with `team_ids = null` is in scope for
// every student/parent regardless of team, in addition to the exact
// team-id-set overlap check for non-null values.
//
// Per-role resolution actually performed by index.ts before calling this
// module (documented here so the write-up lives next to the logic it
// describes):
//   - admin | coach -> resolveRoleScope(role, []) -> always { kind: 'all' },
//     the `[]` is unused. Matches "full" in the matrix.
//   - student -> the caller's own single `students.team_id` (via
//     `students.profile_id = <resolved profile id>`), passed as a
//     one-element array. If a student-role profile somehow has no `students`
//     row (should not happen given the schema, but not guaranteed by a
//     database constraint), index.ts passes an EMPTY array here rather than
//     failing the whole request -- that resolves to `{ kind: 'teams',
//     teamIds: [] }`, which (correctly) matches zero events, i.e. a
//     structurally valid but empty calendar feed. This is NOT the same as an
//     invalid-token response (Trap #3): the token itself is genuinely valid,
//     there is just nothing in scope for this particular profile. Disclosed
//     as a known edge case, not silently glossed over.
//   - parent -> the UNION of `students.team_id` for every row in
//     `guardian_links` where `parent_profile_id` = the resolved profile id
//     (a parent with children on different teams sees both teams' events --
//     the literal "linked students' events" / "a parent with children on
//     different teams should see both" requirement from the worker packet).
//     Duplicate team ids across multiple linked students are deduped by this
//     module (see the `Set` below), not by the caller.

export type RoleScope = { kind: 'all' } | { kind: 'teams'; teamIds: string[] };

export type IcsRole = 'admin' | 'coach' | 'student' | 'parent';

export function resolveRoleScope(role: IcsRole, relevantTeamIds: string[]): RoleScope {
  if (role === 'admin' || role === 'coach') {
    return { kind: 'all' };
  }
  return { kind: 'teams', teamIds: Array.from(new Set(relevantTeamIds)) };
}

// events.team_ids is `uuid[] | null`; `null` means "all teams" (T010
// migration's own column comment: "team_ids uuid[] null (null = all
// teams)"). A non-null array is in scope when it overlaps the caller's
// resolved team-id set at all (this is the "team_id = any(team_ids)" rule
// from the worker packet, generalized to a set of team ids rather than a
// single one, to also cover the parent multi-student-union case with the
// same function).
export function isEventInScope(eventTeamIds: string[] | null, scope: RoleScope): boolean {
  if (scope.kind === 'all') return true;
  if (eventTeamIds === null) return true;
  return eventTeamIds.some((teamId) => scope.teamIds.includes(teamId));
}
