/**
 * T103 (ED-1 Packet P8): real data-layer wiring for
 * `src/pages/meetings/Kiosk.tsx`'s three seams -- GAP #2's live tally +
 * session-title reads (`event_sessions`/`events`/`students`/`attendance`,
 * ordinary RLS-scoped table queries, no Edge Function needed) and GAP #1's
 * live QR token/short code (`checkin-token`, a new Edge Function --
 * `Kiosk.tsx`'s own pre-T103 module doc documents in full why this could
 * NOT be a plain table query: the `CHECKIN_HMAC_SECRET` that derives a
 * valid token must never reach the browser, constitution item 5). Built on
 * top of T086's `createLoader`/`invokeEdgeFunction` (`../loader.ts`/
 * `../functions.ts`, both read-only imports here), same DI (`getClient`)
 * convention every prior `loaders/*.ts` file in this directory already
 * established.
 *
 * -----------------------------------------------------------------------
 * GAP #2 (tally + session title) -- Trap #1 of this task's own worker
 * packet.
 * -----------------------------------------------------------------------
 * `event_sessions.event_id -> events.id` is resolved as two flat queries
 * (`querySessionEventId` then `queryEventContext`), never a nested/embedded
 * `select` string -- the same "no embedded-resource selector anywhere in
 * this codebase's frontend loaders, join client-side instead" convention
 * `loaders/parents.ts`/`loaders/meetings.ts` already established (grep-
 * provable: no `.select(` call in any `src/lib/supabase/loaders/*.ts` file
 * nests a foreign-table selector inside another table's own `.select()`
 * string -- unlike the *Edge-Function-side* `checkin`/`checkin-token`
 * functions, which DO use PostgREST's embedded-relation syntax, a
 * deliberately different convention scoped to that Deno/service-role
 * context, not this one).
 *
 * `queryEventContext` returns both `title` (session-title seam) and
 * `team_ids` (tally seam's roster-scoping) from the SAME `events` row in
 * ONE query -- both `makeLoadKioskTally` and `makeLoadKioskSessionTitle`
 * share the identical `loadSessionEventId`/`loadEventContext` pair
 * (constructed once per `make*` call, not duplicated query logic).
 *
 * Tally ("checked-in" count): `attendance` rows for the session whose
 * `status` is `'present'` or `'late'` -- the SAME `CHECKED_IN_STATUSES`
 * definition `LiveConsole.tsx`'s own `computeAttendanceTally` already
 * establishes for the coach console's identical "N/M in" tally (that file
 * is not imported from here -- it is not in this task's Allowed Files --
 * but the constant is small, disclosed, and intentionally kept in lockstep
 * with that file's own definition, not re-derived from first principles).
 *
 * Tally ("expected" count): active (`students.is_active = true`) students
 * whose `team_id` is in scope for the session's parent event's `team_ids`
 * (`team_ids === null` means open to every team, `team_ids` non-null means
 * scoped to exactly those teams) -- the SAME open-vs-scoped semantics
 * `supabase/functions/checkin/index.ts`'s own `TEAM_SCOPE_MISMATCH` check
 * already uses for a single student (`teamIds !== null &&
 * !teamIds.includes(student.team_id)`), applied here across the whole
 * active roster instead of one student. `is_active` is the same "who counts
 * as currently on the team" flag `supabase/migrations/
 * 20260717000003_metric_views.sql`'s own header comment documents as this
 * schema's chosen `MET-01` "while active" interpretation (deactivated
 * students drop out of the metric views); reused here for the identical
 * reason -- a deactivated student was never going to check in tonight.
 *
 * `attendance`'s RLS (`staff_all`) and `events`/`event_sessions`/`students`'
 * own `staff_all` policies (`supabase/migrations/20260717000002_rls.sql`)
 * already grant a coach/admin session (this route's own guard,
 * `router.tsx`'s `/kiosk/:sessionId` -- read-only reference, confirmed by
 * `Kiosk.tsx`'s own pre-T103 module doc) full read access to every query
 * below -- there is no RLS gap on this route, matching that same pre-T103
 * module doc's own "not an access-control gap, only a missing client"
 * framing for GAP #2.
 *
 * `null` (not a thrown/rejected loader) for "the session/event itself
 * cannot be found" -- `Kiosk.tsx`'s own DES-12 Empty-state handling already
 * folds a `null` tally/session-title resolve into an honest "not available"
 * render, the same as any other empty/error case on this page (see that
 * file's own module doc "DES-12 four-state mapping" section) -- there is no
 * separate "session id was garbage" UI state to build here.
 *
 * -----------------------------------------------------------------------
 * GAP #1 (live QR token/short code) -- Trap #2/#3 of this task's own worker
 * packet.
 * -----------------------------------------------------------------------
 * `makeLoadKioskDisplayToken` calls the new `checkin-token` Edge Function
 * via `invokeEdgeFunction` (`../functions.ts`, T086's shared, typed calling
 * convention for every deployed Edge Function in this repo -- already used
 * by `loaders/invites.ts`'s own `makeResendInvite` for an identical
 * "authenticated staff caller invokes a named Edge Function" shape, the
 * precedent this function's own test coverage mirrors). `invokeEdgeFunction`
 * automatically attaches `Authorization: Bearer <current session access
 * token>` (that file's own module doc, citing `@supabase/functions-js`'s own
 * doc comment) -- exactly the bearer-token-authenticated call shape
 * `checkin-token/index.ts`'s own `callerClient` expects, and the same
 * general "authenticated fetch to a deployed Edge Function" precedent
 * `CheckinResult.tsx`/T100's own `callCheckin` already established for the
 * (unauthenticated-capable) `checkin` function, per this task's own worker
 * packet Known Context/Traps #3 -- `invokeEdgeFunction` is used here rather
 * than a second hand-rolled `fetch()` call because this endpoint's caller
 * (a signed-in coach/admin) always has a real Supabase session already, so
 * `invokeEdgeFunction`'s own "no active session -> reject before any network
 * call" behavior is strictly correct here (unlike `CheckinResult.tsx`'s own
 * disclosed `getAccessToken` seam, which must tolerate a `null` token for an
 * unauthenticated student scanning a public QR code -- not this route's
 * situation, since `/kiosk/:sessionId` is itself `RequireAuth` +
 * `RequireRole(['coach', 'admin'])`-gated, per `Kiosk.tsx`'s own pre-T103
 * module doc "Router reachability" section), and because this loader lives
 * in the same `loaders/*.ts` directory as every other Edge-Function-calling
 * loader in this codebase (`loaders/invites.ts`), which all already use
 * `invokeEdgeFunction` rather than a duplicate raw-`fetch` implementation --
 * this task's own Allowed/Forbidden Files list explicitly names `functions.ts`
 * as a read-only import available here for exactly this purpose.
 *
 * `buildCheckinUrl` (imported from `Kiosk.tsx`, exported there specifically
 * for this reuse -- see that file's own module doc) is the ONLY place the
 * QR payload's URL shape (`https://portal.voltfrc.org/checkin?s=&t=`, PRD
 * MTG-06) is constructed anywhere in this codebase; this loader calls it
 * rather than re-deriving that URL shape a second time.
 *
 * `bucketExpiresAt` (the Edge Function's own response field, an ISO
 * timestamp for when the CURRENT bucket ends -- see
 * `checkin-token/index.ts`'s own `computeBucketExpiresAt`) is intentionally
 * NOT used to compute `refreshesInSeconds` below: this task's own worker
 * packet Known Context/Traps #3 explicitly says the existing ~45s
 * `usePolling` cadence stays UNCHANGED ("do not touch the polling interval
 * itself, only the loader it calls") -- `refreshesInSeconds` is a fixed,
 * already-correct DISPLAY constant (`KIOSK_REFRESH_INTERVAL_SECONDS`,
 * imported from `Kiosk.tsx`) describing that unchanged client refresh
 * cadence, not a live countdown to the server-side bucket boundary. This is
 * a disclosed, deliberate choice, not an oversight: `bucketExpiresAt` is
 * still typed and received (a real, correctly-shaped Edge Function
 * response field this loader reads), simply not threaded into the return
 * value this task's own packet did not ask this loader to change.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { createLoader, type LoaderQueryResult } from '../loader';
import { getSupabaseClient } from '../client';
import { invokeEdgeFunction } from '../functions';
import {
  buildCheckinUrl,
  KIOSK_REFRESH_INTERVAL_SECONDS,
  type KioskDisplayToken,
  type KioskDisplayTokenLoader,
  type KioskSessionTitle,
  type KioskSessionTitleLoader,
  type KioskTallyLoader,
  type KioskTallyState,
} from '../../../pages/meetings/Kiosk';

// ---------------------------------------------------------------------------
// Raw DB row shapes (snake_case, exactly as Postgrest returns them). Column
// shapes cited in full against the real migrations in `Kiosk.tsx`'s own
// pre-T103 module doc / `loaders/meetings.ts`'s own module doc for these
// same tables (not re-cited here -- constitution item 3: cite once, reuse
// the citation).
// ---------------------------------------------------------------------------

interface EventSessionEventIdDbRow {
  id: string;
  event_id: string;
}

interface EventContextDbRow {
  id: string;
  title: string;
  team_ids: string[] | null;
}

interface StudentTeamDbRow {
  id: string;
  team_id: string;
}

type AttendanceStatus = 'present' | 'late' | 'excused' | 'absent';

interface AttendanceStatusDbRow {
  status: AttendanceStatus;
}

/** Same set `LiveConsole.tsx`'s own `CHECKED_IN_STATUSES` already defines
 * for the identical "checked in" concept (module doc above) -- kept in
 * lockstep with that file's definition by disclosure, not by import (that
 * file is not in this task's Allowed Files). */
const CHECKED_IN_STATUSES: ReadonlySet<AttendanceStatus> = new Set(['present', 'late']);

// ---------------------------------------------------------------------------
// Query functions.
// ---------------------------------------------------------------------------

async function querySessionEventId(
  client: SupabaseClient,
  sessionId: string,
): Promise<LoaderQueryResult<EventSessionEventIdDbRow>> {
  const result = await client
    .from('event_sessions')
    .select('id, event_id')
    .eq('id', sessionId)
    .maybeSingle();
  return { data: (result.data as EventSessionEventIdDbRow | null) ?? null, error: result.error };
}

async function queryEventContext(
  client: SupabaseClient,
  eventId: string,
): Promise<LoaderQueryResult<EventContextDbRow>> {
  const result = await client
    .from('events')
    .select('id, title, team_ids')
    .eq('id', eventId)
    .maybeSingle();
  return { data: (result.data as EventContextDbRow | null) ?? null, error: result.error };
}

/** Full active roster -- filtered to the event's `team_ids` scope client-side
 * below (module doc above), the same "fetch the full table, let the
 * caller's own logic filter/join" convention `loaders/meetings.ts` already
 * established for `queryEvents`/`querySessions`. */
async function queryActiveStudentTeams(
  client: SupabaseClient,
): Promise<LoaderQueryResult<StudentTeamDbRow[]>> {
  const result = await client.from('students').select('id, team_id').eq('is_active', true);
  return { data: (result.data as StudentTeamDbRow[] | null) ?? null, error: result.error };
}

async function queryAttendanceStatuses(
  client: SupabaseClient,
  sessionId: string,
): Promise<LoaderQueryResult<AttendanceStatusDbRow[]>> {
  const result = await client.from('attendance').select('status').eq('session_id', sessionId);
  return { data: (result.data as AttendanceStatusDbRow[] | null) ?? null, error: result.error };
}

// ---------------------------------------------------------------------------
// `getClient` is injectable (defaults to the shared singleton), same
// convention every prior `loaders/*.ts` file in this directory already
// established, so tests can supply a stubbed transport with zero real
// network calls.
// ---------------------------------------------------------------------------

/** Shared by both `makeLoadKioskTally` and `makeLoadKioskSessionTitle` --
 * resolves the session's parent event's `title`/`team_ids` in two flat
 * queries, or `null` if either the session or its event cannot be found
 * (module doc above -- folded into the page's own DES-12 Empty state, not a
 * thrown error). */
function makeLoadSessionEventContext(
  getClient: () => SupabaseClient,
): (sessionId: string) => Promise<EventContextDbRow | null> {
  const loadSessionEventId = createLoader<string, EventSessionEventIdDbRow>(
    querySessionEventId,
    getClient,
  );
  const loadEventContext = createLoader<string, EventContextDbRow>(queryEventContext, getClient);
  return async (sessionId: string): Promise<EventContextDbRow | null> => {
    const session = await loadSessionEventId(sessionId);
    if (session === null) {
      return null;
    }
    return loadEventContext(session.event_id);
  };
}

/** `Kiosk.tsx`'s real `loadTally` (GAP #2). */
export function makeLoadKioskTally(
  getClient: () => SupabaseClient = getSupabaseClient,
): KioskTallyLoader {
  const loadEventContext = makeLoadSessionEventContext(getClient);
  const loadActiveStudentTeams = createLoader<void, StudentTeamDbRow[]>(
    queryActiveStudentTeams,
    getClient,
  );
  const loadAttendanceStatuses = createLoader<string, AttendanceStatusDbRow[]>(
    queryAttendanceStatuses,
    getClient,
  );

  return async (sessionId: string): Promise<KioskTallyState | null> => {
    const event = await loadEventContext(sessionId);
    if (event === null) {
      return null;
    }
    const [studentRows, attendanceRows] = await Promise.all([
      loadActiveStudentTeams(),
      loadAttendanceStatuses(sessionId),
    ]);
    const teamIds = event.team_ids;
    const expected = (studentRows ?? []).filter(
      (student) => teamIds === null || teamIds.includes(student.team_id),
    ).length;
    const checkedIn = (attendanceRows ?? []).filter((row) =>
      CHECKED_IN_STATUSES.has(row.status),
    ).length;
    return { checkedIn, expected };
  };
}

/** `Kiosk.tsx`'s own default `loadTally` -- real query. */
export const loadKioskTally: KioskTallyLoader = makeLoadKioskTally();

/** `Kiosk.tsx`'s real `loadSessionTitle` (GAP #2). */
export function makeLoadKioskSessionTitle(
  getClient: () => SupabaseClient = getSupabaseClient,
): KioskSessionTitleLoader {
  const loadEventContext = makeLoadSessionEventContext(getClient);
  return async (sessionId: string): Promise<KioskSessionTitle | null> => {
    const event = await loadEventContext(sessionId);
    return event === null ? null : { title: event.title };
  };
}

/** `Kiosk.tsx`'s own default `loadSessionTitle` -- real query. */
export const loadKioskSessionTitle: KioskSessionTitleLoader = makeLoadKioskSessionTitle();

// ---------------------------------------------------------------------------
// GAP #1 -- real `loadDisplayToken`, via the new `checkin-token` Edge
// Function (module doc above).
// ---------------------------------------------------------------------------

/** The exact response shape `checkin-token/index.ts`'s own
 * `CheckinTokenSuccessResponse` returns (module doc above). */
interface CheckinTokenEdgeResponse {
  token: string;
  shortCode: string;
  bucketExpiresAt: string;
}

/** `Kiosk.tsx`'s real `loadDisplayToken` (GAP #1). */
export function makeLoadKioskDisplayToken(
  getClient: () => SupabaseClient = getSupabaseClient,
): KioskDisplayTokenLoader {
  return async (sessionId: string): Promise<KioskDisplayToken | null> => {
    const response = await invokeEdgeFunction<CheckinTokenEdgeResponse>(
      'checkin-token',
      { session_id: sessionId },
      getClient,
    );
    return {
      qrUrl: buildCheckinUrl(sessionId, response.token),
      shortCode: response.shortCode,
      refreshesInSeconds: KIOSK_REFRESH_INTERVAL_SECONDS,
    };
  };
}

/** `Kiosk.tsx`'s own default `loadDisplayToken` -- real Edge Function call. */
export const loadKioskDisplayToken: KioskDisplayTokenLoader = makeLoadKioskDisplayToken();
