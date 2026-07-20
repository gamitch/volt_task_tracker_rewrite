/**
 * T100 (ED-1 Packet P9): real `event_sessions`/`attendance`/
 * `v_student_participation`/`guardian_links`/`students` data-layer wiring
 * for `src/pages/meetings/StudentMeetingView.tsx` (the BEH-06 consistency
 * strip widget), plus the real `getAccessToken` seam
 * `src/pages/checkin/CheckinResult.tsx` needs. Built directly on top of
 * T086's `createLoader`/`runMutation` (`../loader.ts`, read-only import
 * here), same DI (`getClient`) convention every prior `loaders/*.ts` file in
 * this directory already established. `checkin.ts` is this whole packet's
 * one new loader file (per this task's own Allowed Files list) even though
 * only its `getAccessToken` export is genuinely about the `/checkin` flow --
 * `StudentMeetingView.tsx`'s two seams live here too because this packet's
 * own scope (worker packet Objective: "real student check-in path
 * (`StudentMeetingView.tsx` + `CheckinResult.tsx`)") ties both files
 * together as one data-layer unit, and neither file's own packet grants a
 * second new `loaders/*.ts` file.
 *
 * -----------------------------------------------------------------------
 * Trap #2 (`StudentMeetingView.tsx` real load, both seams) -- reuse that
 * file's own already-tested pure `buildConsistencyStripData` (its own module
 * doc #4's "last 5 completed meetings" selection logic lives ENTIRELY inside
 * that function's own callee, `selectLastCompletedAttendance` -- never
 * re-derived here), the same "loader fetches + maps raw rows, then calls the
 * page's own exported pure builder" shape `../loaders/meetings.ts` (T096)
 * already established for `MeetingsList.tsx`'s `buildStudentMeetingsData`.
 *
 * `queryEventSessions` deliberately fetches the FULL `event_sessions` table
 * (no `.eq('status', 'completed')` filter), mirroring `loaders/meetings.ts`'s
 * own Trap #1 precedent verbatim: the "only `status === 'completed'` is
 * selectable" rule already lives in exactly one place in this codebase
 * (`StudentMeetingView.tsx`'s own `selectLastCompletedAttendance`, module doc
 * #4) -- re-deriving that filter here (even as a harmless-looking server-side
 * optimization) would duplicate it in a second place, the exact class of
 * mistake `loaders/meetings.ts`'s own module doc flags for its analogous
 * NAV-07 filter.
 *
 * `event_sessions`/`attendance`/`v_student_participation` column shapes are
 * already cited verbatim (migration line numbers included) in
 * `StudentMeetingView.tsx`'s own module doc #1/#2 -- not re-cited here
 * (constitution item 3: cite once, reuse the citation, never re-derive).
 * `EventSessionDbRow`/`AttendanceDbRow`/`ParticipationDbRow` below are the
 * same raw-row shapes `loaders/meetings.ts` already established for the
 * identical three tables (`EventSessionDbRow`/`AttendanceDbRow`/
 * `ParticipationDbRow` there), independently redeclared here rather than
 * imported -- `loaders/meetings.ts` does not export its own versions of
 * these row types (they are file-local, unexported), and this task's
 * Forbidden Files list that file as read-only, so a fresh, page-scoped
 * declaration here (same convention every prior `loaders/*.ts` file uses for
 * its own paired page) is the only option, not a shortcut.
 *
 * `queryAttendanceForStudent` filters `.eq('student_id', studentId)`
 * explicitly -- defense-in-depth on top of `attendance`'s own
 * `own_or_linked_read` RLS policy (`supabase/migrations/
 * 20260717000002_rls.sql` lines 230-232: `student_id in (select
 * my_student_ids())`), same reasoning `loaders/meetings.ts`'s own
 * `queryAttendanceForStudent` already documents in full for the identical
 * query shape.
 *
 * -----------------------------------------------------------------------
 * Trap #2 (`StudentMeetingView.tsx` real load, `variant="linked"` seam) --
 * `LoadLinkedStudentsFn = () => Promise<LinkedStudentSummary[]>` takes NO
 * arguments (that file's own already-established signature, not changed by
 * this task) -- unlike `loaders/meetings.ts`'s `resolveCurrentStudentId`
 * (which receives an explicit `CurrentViewerIdentity` from its caller),
 * `makeLoadLinkedStudents` below must resolve "which parent is this" for
 * itself, from the real Supabase session (`client.auth.getSession()`), the
 * same call `../auth.ts`'s own `getInitialSession` already uses for the
 * identical purpose. `querySessionUserId` below deliberately resolves
 * `null` (never throws) for "no session" (mirrors `createLoader`'s own "no
 * rows resolves null" convention) -- a genuine transport/auth error still
 * rejects via `createLoader`'s normal error path.
 *
 * `queryGuardianLinksForParent`/`queryStudentsByIds` below are two
 * independent flat queries, joined client-side inside
 * `makeLoadLinkedStudents`' own returned function -- the same
 * "no server-side embedded-resource `select` anywhere in this codebase, join
 * client-side instead" convention `loaders/parents.ts` (T094) already
 * established for its own `guardian_links`/`students` pairing (grep-provable:
 * no `.select(` call anywhere in this repo nests a foreign-table selector
 * inside another table's own `.select()` string). Ordered by
 * `guardian_links.created_at` ascending (earliest-linked first), matching
 * `loaders/meetings.ts`'s own `queryFirstLinkedStudentId` ordering choice for
 * the identical table, extended here to return every row instead of just the
 * first (per this task's own packet: "though this one returns the full list,
 * not just the first").
 *
 * -----------------------------------------------------------------------
 * Trap #3 (`CheckinResult.tsx`'s `getAccessToken`, pre-approved async
 * widening) -- `makeGetAccessToken` below is a REAL implementation
 * (`client.auth.getSession()`, the same call `../auth.ts`'s own
 * `getInitialSession` already uses), but deliberately does NOT use
 * `createLoader` the way every other loader in this file does, and
 * deliberately swallows every failure mode (Supabase not configured,
 * `getSession()` itself erroring) into a plain `null` return rather than a
 * rejection. This is a disclosed departure from `createLoader`'s usual
 * "reject on failure" contract, not an oversight:
 *
 *   `CheckinResult.tsx`'s own PRE-EXISTING module doc gap #1 (unchanged by
 *   this task) already establishes that a `null` access token is NOT an
 *   error state for that component -- it means the check-in request is sent
 *   with NO `Authorization` header, and the real deployed `/checkin`
 *   function's own real 401 `UNAUTHENTICATED` path handles that honestly,
 *   through `CheckinResult`'s ordinary (already-built, already-tested)
 *   error-rendering branch. That reasoning was written for the "no session
 *   exists yet anywhere in this repo" case; extending it to also cover "the
 *   session lookup itself failed for some reason" is the SAME honest
 *   degrade-to-null behavior, not a new fake-data risk -- the request still
 *   goes out, still gets a real, honest response, just without a bearer
 *   token this attempt could not obtain. Making `getAccessToken` REJECT
 *   instead (the `createLoader` default) would be strictly worse: it would
 *   stop `CheckinResult`'s `runCheckin` from ever calling `checkin()` at all
 *   whenever Supabase happens to be unconfigured or a transient session
 *   lookup hiccups, hiding the real, already-correct 401 error path behind a
 *   generic client-side "unexpected error" instead.
 *
 *   This also keeps `CheckinResult.test.tsx`'s own pre-existing (this task
 *   does not touch its assertions) "renders the fresh success (Bolt) state"
 *   test green without stubbing `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY`:
 *   that test supplies its own `checkin` mock but relies on the REAL default
 *   `getAccessToken` (no `getAccessToken` prop passed), asserting `checkin`
 *   is called with `null` as the token argument -- exactly what
 *   `makeGetAccessToken`'s default (unconfigured-Supabase) behavior produces.
 *
 * -----------------------------------------------------------------------
 * Trap #4 (T120, T116 checker-verified consumer-risk finding #3):
 * `queryParticipationForStudent`'s dual-member fix.
 *
 * T116/SCH-03 migrated `v_student_participation` onto `student_teams`
 * ACTIVE memberships (`supabase/migrations/20260722000000_membership_views.sql`)
 * -- a dual-member student can now have more than one row in this view, one
 * per team she qualifies for. `queryParticipationForStudent` below used to
 * `.limit(1)`, which previously already picked one ARBITRARY row when a
 * student had rows in more than one season (this file's own pre-existing,
 * disclosed gap, unchanged below); post-T116 it also arbitrarily picks one
 * TEAM's row for a dual member. `StudentMeetingView.tsx`'s own
 * `buildConsistencyStripData` (forbidden/read-only to this task) does a
 * plain `participationMetrics.find((metric) => metric.studentId ===
 * studentId)` over whatever array it is handed, so simply removing
 * `.limit(1)` and passing every row through unchanged would just move the
 * SAME arbitrary-team-picking bug one layer down (whichever row `.find()`
 * happens to land on first).
 *
 * `LoadConsistencyStripDataFn`'s own signature (`(studentId: string) =>
 * Promise<ConsistencyStripData>`, `StudentMeetingView.tsx`, not owned by
 * this task) carries NO `teamId` -- unlike `ParticipationTab.tsx` (this
 * task's other file, which DOES already know which team each of its
 * rendered rows belongs to, and is fixed there with zero TS arithmetic by
 * keying/joining per team instead), there is no "scope to a team" option
 * available at this call site. The honest choice made here instead (worker
 * packet Traps): AGGREGATE this student's rows for a single season by
 * summing the view's own already-computed counters, then recompute
 * `participation_pct` with the EXACT SAME expression the view itself uses
 * -- cited verbatim from `supabase/migrations/20260722000000_membership_views.sql`
 * (the `v_student_participation` `select` list):
 *
 *   round(100.0 * count(*) filter (where a.status in ('present','late'))
 *         / greatest(count(*) - count(*) filter (where a.status = 'excused'), 1), 1)
 *
 * i.e. `round(100.0 * sum(present_ct) / greatest(sum(expected_ct) -
 * sum(excused_ct), 1), 1)`, implemented in `aggregateParticipationForStudent`
 * below by summing `present_ct`/`expected_ct`/`excused_ct` across this
 * student's rows FIRST (each of those three counts is itself a verbatim
 * column the view already computed, never touched individually per-row),
 * then applying the view's own divide-and-round shape exactly ONCE over the
 * summed totals -- not a second, independently-invented formula.
 * `present_ct` already includes `late_ct` (the view's own `status in
 * ('present','late')` filter -- `ParticipationTab.tsx`'s own module doc #1
 * cites this identically), so summing it directly, without also adding
 * `late_ct`, is the correct verbatim-counter sum, not double counting. This
 * student-wide total also matches D-3's own "a student's PERSONAL total
 * counts each hour/session once" posture (PRD v2 SCH-03) for this
 * un-team-scoped, per-student strip widget, rather than mislabeling one
 * arbitrarily-picked team's own number as her overall consistency. When
 * there is only ONE row for the chosen season (the common, non-dual-member
 * case), `aggregateParticipationForStudent` returns that row VERBATIM --
 * `participation_pct` included -- with no recomputation at all, not even a
 * no-op one that happens to match; the sum-then-round path only ever runs
 * when there is genuinely more than one row to combine.
 *
 * The pre-existing multi-season ambiguity (this file's own module doc
 * above, matching `loaders/meetings.ts`'s identical documented gap for its
 * own twin `queryParticipationForStudent` -- that file is OWNED BY SIBLING
 * T122, not touched here) is a SEPARATE problem, deliberately not conflated
 * with this fix: `aggregateParticipationForStudent` groups by `season_id`
 * FIRST (keeping whichever season happens to sort first among this
 * student's rows -- the SAME arbitrary "first" behavior the pre-existing
 * `.limit(1)` already had, just now applied at season granularity instead
 * of row granularity) and only sums the team rows WITHIN that one chosen
 * season. A student with rows in only one season (the common case) is
 * completely unaffected by this grouping step. The returned aggregate row's
 * `team_id` is NOT a real value once summed across teams (kept only to
 * satisfy `ParticipationDbRow`'s existing shape so the existing
 * `mapParticipationDbRow` can be reused unchanged) -- disclosed here
 * because `StudentMeetingView.tsx` never actually reads `.teamId` anywhere
 * in its own render (grep-verified: no `participation.teamId` anywhere in
 * that file), so this is a type-shape necessity, not a rendered fact.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { createLoader, type LoaderQueryResult } from '../loader';
import { getSupabaseClient } from '../client';
import type { GetAccessTokenFn } from '../../../pages/checkin/CheckinResult';
import {
  buildConsistencyStripData,
  type AttendanceStatus,
  type ConsistencyStripData,
  type LinkedStudentSummary,
  type LoadConsistencyStripDataFn,
  type LoadLinkedStudentsFn,
  type SessionStatus,
} from '../../../pages/meetings/StudentMeetingView';

// ---------------------------------------------------------------------------
// Raw DB row shapes (snake_case, exactly as Postgrest returns them). Column
// shapes cited in full in `StudentMeetingView.tsx`'s own module doc #1/#2
// (not re-cited here -- see module doc above).
// ---------------------------------------------------------------------------

interface EventSessionDbRow {
  id: string;
  session_date: string;
  starts_at: string;
  status: SessionStatus;
}

interface AttendanceDbRow {
  session_id: string;
  student_id: string;
  status: AttendanceStatus;
}

interface ParticipationDbRow {
  student_id: string;
  team_id: string;
  season_id: string;
  expected_ct: number;
  present_ct: number;
  late_ct: number;
  excused_ct: number;
  participation_pct: number;
}

interface SessionUserIdDbRow {
  id: string;
}

interface GuardianLinkDbRow {
  student_id: string;
}

interface StudentDisplayDbRow {
  id: string;
  display_name: string;
}

// ---------------------------------------------------------------------------
// Row mappers -- snake_case DB row -> `StudentMeetingView.tsx`'s own
// camelCase types (module doc above, Trap #2).
// ---------------------------------------------------------------------------

function mapEventSessionDbRow(row: EventSessionDbRow) {
  return { id: row.id, sessionDate: row.session_date, startsAt: row.starts_at, status: row.status };
}

function mapAttendanceDbRow(row: AttendanceDbRow) {
  return { sessionId: row.session_id, studentId: row.student_id, status: row.status };
}

function mapParticipationDbRow(row: ParticipationDbRow) {
  return {
    studentId: row.student_id,
    teamId: row.team_id,
    seasonId: row.season_id,
    expectedCt: row.expected_ct,
    presentCt: row.present_ct,
    lateCt: row.late_ct,
    excusedCt: row.excused_ct,
    participationPct: row.participation_pct,
  };
}

// ---------------------------------------------------------------------------
// Query functions -- consistency strip (Trap #2).
// ---------------------------------------------------------------------------

/** Full table, unfiltered -- module doc above (Trap #2, mirrors
 * `loaders/meetings.ts`'s own Trap #1 precedent). */
async function queryEventSessions(
  client: SupabaseClient,
): Promise<LoaderQueryResult<EventSessionDbRow[]>> {
  const result = await client
    .from('event_sessions')
    .select('id, session_date, starts_at, status')
    .order('starts_at', { ascending: true });
  return { data: (result.data as EventSessionDbRow[] | null) ?? null, error: result.error };
}

/** Defense-in-depth `student_id` filter on top of `attendance`'s own
 * `own_or_linked_read` RLS policy (module doc above). */
async function queryAttendanceForStudent(
  client: SupabaseClient,
  studentId: string,
): Promise<LoaderQueryResult<AttendanceDbRow[]>> {
  const result = await client
    .from('attendance')
    .select('session_id, student_id, status')
    .eq('student_id', studentId);
  return { data: (result.data as AttendanceDbRow[] | null) ?? null, error: result.error };
}

/** T120 (Trap #4 above): no `.limit(1)` -- fetches EVERY matching row (a
 * dual member can now have more than one, T116/SCH-03) so
 * `aggregateParticipationForStudent` below has the full set to work with.
 * Still not season-scoped (Trap #4 above, pre-existing, disclosed,
 * unchanged). */
async function queryParticipationForStudent(
  client: SupabaseClient,
  studentId: string,
): Promise<LoaderQueryResult<ParticipationDbRow[]>> {
  const result = await client
    .from('v_student_participation')
    .select(
      'student_id, team_id, season_id, expected_ct, present_ct, late_ct, excused_ct, participation_pct',
    )
    .eq('student_id', studentId);
  return { data: (result.data as ParticipationDbRow[] | null) ?? null, error: result.error };
}

/** T120 (Trap #4 above): dual-member aggregation, honest sum-then-round of
 * the view's own counters -- see Trap #4 for the full citation/reasoning.
 * `null` for a student with zero rows at all (the real "no completed
 * sessions" absence case -- unchanged: `buildConsistencyStripData`'s own
 * `.find()` over an empty array already returns `null` for this case, same
 * as before this task). A single-row (non-dual-member, the common case) is
 * returned VERBATIM, `participation_pct` included -- no recomputation at
 * all, not even a no-op one, when there is nothing to aggregate across. */
export function aggregateParticipationForStudent(
  rows: readonly ParticipationDbRow[],
): ParticipationDbRow | null {
  if (rows.length === 0) {
    return null;
  }
  // Season ambiguity is pre-existing/out of scope (Trap #4) -- pick
  // whichever season this student's first-returned row belongs to, then
  // only aggregate the (possibly multiple, per-team) rows within THAT one
  // season, never across seasons.
  const chosenSeasonId = rows[0].season_id;
  const seasonRows = rows.filter((row) => row.season_id === chosenSeasonId);

  if (seasonRows.length === 1) {
    return seasonRows[0];
  }

  const expectedCt = seasonRows.reduce((sum, row) => sum + row.expected_ct, 0);
  const presentCt = seasonRows.reduce((sum, row) => sum + row.present_ct, 0);
  const lateCt = seasonRows.reduce((sum, row) => sum + row.late_ct, 0);
  const excusedCt = seasonRows.reduce((sum, row) => sum + row.excused_ct, 0);

  // Verbatim reapplication of the view's own expression over the summed
  // totals (Trap #4's citation) -- never a second, independently-invented
  // formula.
  const denominator = Math.max(expectedCt - excusedCt, 1);
  const participationPct = Math.round(((100 * presentCt) / denominator) * 10) / 10;

  return {
    student_id: seasonRows[0].student_id,
    team_id: seasonRows[0].team_id,
    season_id: chosenSeasonId,
    expected_ct: expectedCt,
    present_ct: presentCt,
    late_ct: lateCt,
    excused_ct: excusedCt,
    participation_pct: participationPct,
  };
}

// ---------------------------------------------------------------------------
// Query functions -- linked students (Trap #2, `variant="linked"`).
// ---------------------------------------------------------------------------

/** `null` for "no session" (never throws) -- module doc above. A genuine
 * transport/auth error still rejects via `createLoader`'s normal path. */
async function querySessionUserId(
  client: SupabaseClient,
): Promise<LoaderQueryResult<SessionUserIdDbRow>> {
  const { data, error } = await client.auth.getSession();
  return {
    data: data.session ? { id: data.session.user.id } : null,
    error: error ? { message: error.message } : null,
  };
}

/** Earliest-linked-first (module doc above). */
async function queryGuardianLinksForParent(
  client: SupabaseClient,
  parentProfileId: string,
): Promise<LoaderQueryResult<GuardianLinkDbRow[]>> {
  const result = await client
    .from('guardian_links')
    .select('student_id')
    .eq('parent_profile_id', parentProfileId)
    .order('created_at', { ascending: true });
  return { data: (result.data as GuardianLinkDbRow[] | null) ?? null, error: result.error };
}

async function queryStudentsByIds(
  client: SupabaseClient,
  studentIds: string[],
): Promise<LoaderQueryResult<StudentDisplayDbRow[]>> {
  const result = await client.from('students').select('id, display_name').in('id', studentIds);
  return { data: (result.data as StudentDisplayDbRow[] | null) ?? null, error: result.error };
}

// ---------------------------------------------------------------------------
// `getClient` is injectable (defaults to the shared singleton), same
// convention every prior `loaders/*.ts` file in this directory already
// established, so tests can supply a stubbed transport with zero real
// network calls.
// ---------------------------------------------------------------------------

/** `StudentMeetingView.tsx`'s own real `loadStripData` (Trap #2). T120
 * (Trap #4): `participationRows` is run through
 * `aggregateParticipationForStudent` before being handed to
 * `buildConsistencyStripData` -- that function's own `.find()` then sees at
 * most one (already-honestly-aggregated) row, never an arbitrary pick among
 * several team rows. */
export function makeLoadConsistencyStripData(
  getClient: () => SupabaseClient = getSupabaseClient,
): LoadConsistencyStripDataFn {
  const loadSessionRows = createLoader<void, EventSessionDbRow[]>(queryEventSessions, getClient);
  const loadAttendanceRows = createLoader<string, AttendanceDbRow[]>(
    queryAttendanceForStudent,
    getClient,
  );
  const loadParticipationRows = createLoader<string, ParticipationDbRow[]>(
    queryParticipationForStudent,
    getClient,
  );
  return async (studentId: string): Promise<ConsistencyStripData> => {
    const [sessionRows, attendanceRows, participationRows] = await Promise.all([
      loadSessionRows(),
      loadAttendanceRows(studentId),
      loadParticipationRows(studentId),
    ]);
    const aggregatedParticipation = aggregateParticipationForStudent(participationRows ?? []);
    return buildConsistencyStripData(
      studentId,
      (sessionRows ?? []).map(mapEventSessionDbRow),
      (attendanceRows ?? []).map(mapAttendanceDbRow),
      aggregatedParticipation ? [mapParticipationDbRow(aggregatedParticipation)] : [],
    );
  };
}

/** `StudentMeetingView.tsx`'s own default `loadStripData` -- real query. */
export const loadConsistencyStripData: LoadConsistencyStripDataFn = makeLoadConsistencyStripData();

/** `StudentMeetingView.tsx`'s own real `loadLinkedStudents` (Trap #2,
 * `variant="linked"`). */
export function makeLoadLinkedStudents(
  getClient: () => SupabaseClient = getSupabaseClient,
): LoadLinkedStudentsFn {
  const loadSessionUserId = createLoader<void, SessionUserIdDbRow>(querySessionUserId, getClient);
  const loadGuardianLinks = createLoader<string, GuardianLinkDbRow[]>(
    queryGuardianLinksForParent,
    getClient,
  );
  const loadStudents = createLoader<string[], StudentDisplayDbRow[]>(queryStudentsByIds, getClient);

  return async (): Promise<LinkedStudentSummary[]> => {
    const sessionUser = await loadSessionUserId();
    if (sessionUser === null) {
      return [];
    }
    const linkRows = (await loadGuardianLinks(sessionUser.id)) ?? [];
    if (linkRows.length === 0) {
      return [];
    }
    const studentIds = linkRows.map((row) => row.student_id);
    const studentRows = (await loadStudents(studentIds)) ?? [];
    const displayNameById = new Map(studentRows.map((row) => [row.id, row.display_name] as const));
    return linkRows.map((row) => ({
      studentId: row.student_id,
      displayName: displayNameById.get(row.student_id) ?? '',
    }));
  };
}

/** `StudentMeetingView.tsx`'s own default `loadLinkedStudents` -- real query. */
export const loadLinkedStudents: LoadLinkedStudentsFn = makeLoadLinkedStudents();

// ---------------------------------------------------------------------------
// `CheckinResult.tsx`'s real `getAccessToken` (Trap #3). Deliberately NOT
// built on `createLoader` -- see module doc above for the full disclosed
// reasoning (every failure mode degrades to `null`, never a rejection).
// ---------------------------------------------------------------------------

export function makeGetAccessToken(
  getClient: () => SupabaseClient = getSupabaseClient,
): GetAccessTokenFn {
  return async (): Promise<string | null> => {
    let client: SupabaseClient;
    try {
      client = getClient();
    } catch {
      // `SupabaseNotConfiguredError` (`../client.ts`) -- module doc above.
      return null;
    }
    try {
      const { data, error } = await client.auth.getSession();
      if (error) {
        return null;
      }
      return data.session?.access_token ?? null;
    } catch {
      return null;
    }
  };
}

/** `CheckinResult.tsx`'s own default `getAccessToken` -- real session lookup. */
export const getAccessToken: GetAccessTokenFn = makeGetAccessToken();
