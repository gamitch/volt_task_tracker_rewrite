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

/** Not season-scoped -- same `.limit(1)` (not `.maybeSingle()`) reasoning
 * `loaders/meetings.ts`'s own `queryParticipationForStudent` already
 * documents for this identical view/shape. */
async function queryParticipationForStudent(
  client: SupabaseClient,
  studentId: string,
): Promise<LoaderQueryResult<ParticipationDbRow[]>> {
  const result = await client
    .from('v_student_participation')
    .select(
      'student_id, team_id, season_id, expected_ct, present_ct, late_ct, excused_ct, participation_pct',
    )
    .eq('student_id', studentId)
    .limit(1);
  return { data: (result.data as ParticipationDbRow[] | null) ?? null, error: result.error };
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

/** `StudentMeetingView.tsx`'s own real `loadStripData` (Trap #2). */
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
    return buildConsistencyStripData(
      studentId,
      (sessionRows ?? []).map(mapEventSessionDbRow),
      (attendanceRows ?? []).map(mapAttendanceDbRow),
      (participationRows ?? []).map(mapParticipationDbRow),
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
