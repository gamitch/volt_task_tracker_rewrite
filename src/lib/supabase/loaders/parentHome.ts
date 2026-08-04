/**
 * T181: real backend for `src/pages/home/ParentHome.tsx` (HOME-03). Prior to
 * this task `ParentHome`'s two injectable seams
 * (`loadLinkedStudents`/`loadStudentData`) defaulted to obviously-fake
 * fixture generators with no Supabase wiring at all -- every parent's
 * Dashboard was entirely fabricated. This file supplies the two real
 * defaults `ParentHome.tsx`'s own prop defaults now point at.
 *
 * -----------------------------------------------------------------------
 * The central trap -- two `loadLinkedStudents` contracts, same name.
 *
 * `checkin.ts:489` already exports `loadLinkedStudents: LoadLinkedStudentsFn
 * = makeLoadLinkedStudents()` for `StudentMeetingView.tsx`'s
 * `variant="linked"` list -- but THAT `LoadLinkedStudentsFn` is `() =>
 * Promise<LinkedStudentSummary[]>` (`studentId`/`displayName` only, no team,
 * no `isActive`), a genuinely different, narrower contract than
 * `ParentHome.tsx`'s own file-local `LoadLinkedStudentsFn` (`() =>
 * Promise<LinkedStudentsResult>` = `{ students: LinkedStudentRow[]; teams:
 * HomeTeamRow[] }`). Same exported name, same file-local type name,
 * incompatible shapes -- attempting to substitute one for the other is a
 * real `TS2322` (this task's own worker output records the exact compiler
 * text). `checkin.ts:405-411`'s `queryStudentsByIds` (`id, display_name`
 * only) cannot be widened either: its one production consumer,
 * `StudentMeetingView.tsx:1054`, wants neither `team_id` nor `is_active`.
 *
 * Resolution: a second, independent set of query functions/loader below,
 * named `loadLinkedStudentsForParentHome`/`makeLoadLinkedStudentsForParentHome`
 * so the exported name never collides with `checkin.ts`'s own. Nothing in
 * `checkin.ts` is imported here except the one function this file genuinely
 * reuses, `makeLoadConsistencyStripData` (below) -- `loadLinkedStudents`/
 * `makeLoadLinkedStudents`/`LinkedStudentSummary` are never imported.
 *
 * -----------------------------------------------------------------------
 * Reuse -- import the FACTORIES, never the singletons.
 *
 * `checkin.ts`'s own `loadConsistencyStripData` (`:455`) and `students.ts`'s
 * own `resolveStudentScope` (`:440`) are each pre-bound to the real
 * `getSupabaseClient` at module load time -- an injected test `getClient`
 * can never reach either singleton (it would still call the real,
 * unconfigured client and throw `SupabaseNotConfiguredError`). This file
 * imports the FACTORIES instead -- `makeLoadConsistencyStripData`
 * (`checkin.ts:426`) and `makeResolveStudentScope` (`students.ts:418`) --
 * and binds each to this file's own injected `getClient`, exactly once,
 * inside `makeLoadStudentHomeCardDataForParentHome` below. Both wire with
 * `tsc --noEmit` clean and no adapter: `ConsistencyStripData.entries`/
 * `.participation` assign directly to `StudentHomeCardData
 * .consistencyEntries`/`.participation` (only the field name `entries` ->
 * `consistencyEntries` is renamed on assembly, the type itself is
 * identical); `StudentScope.goalHours`/`.confirmedHours` assign directly to
 * `StudentHomeCardData.goalHours`/`.confirmedHours`, verbatim, no TS-side
 * coalesce anywhere in this file (constitution item 3 -- `goal_hours` is
 * already the coalesced `goal_hours_override ?? season default_goal_hours`
 * value, computed once in SQL by `v_student_goal_projection`,
 * `dashboard_views.sql:322-334`; `resolveStudentScope`'s own module doc in
 * `students.ts` records the required "verbatim passthrough" posture this
 * file relies on rather than re-derives).
 *
 * -----------------------------------------------------------------------
 * Genuinely new queries (no existing reusable export touches these):
 * `events` (`id, season_id, type, title, team_ids`), a fuller
 * `event_sessions` than `checkin.ts`'s own private `queryEventSessions`
 * (which lacks `event_id`/`ends_at`, both required by `HomeSessionRow`/
 * `buildNextEventsForStudent`), `rsvps` scoped by student, `students` wider
 * than every existing version (`id, display_name, team_id, is_active` --
 * NOT `goal_hours_override`, no longer needed once `resolveStudentScope`
 * supplies `goalHours` verbatim), and `teams` (`id, name`). `teams`/`events`/
 * `event_sessions` are fetched unfiltered (full table, RLS-scoped), the same
 * "no server-side `.eq` narrowing beyond what RLS already enforces, filter
 * client-side" idiom `checkin.ts`'s own `queryEventSessions` already
 * established for the identical table.
 *
 * -----------------------------------------------------------------------
 * The outer seam -- `makeLoadLinkedStudentsForParentHome`.
 *
 * Zero-arg signature (`ParentHome.tsx`'s own already-declared
 * `LoadLinkedStudentsFn`, unchanged by this task), self-resolving the
 * signed-in parent's session via `querySessionUserId` (independently
 * reimplemented, mirroring `checkin.ts:382-390`'s identical shape for the
 * identical `client.auth.getSession()` call) rather than taking an explicit
 * caller-supplied identity. This is a deliberate, argued-on-its-merits
 * choice, not the false "reorder the hook or self-resolve" dichotomy an
 * earlier round of this design used: passing `user.id` directly from
 * `ParentHome`'s own `useAuth()` would need either an unsafe `user!.id`
 * cast (a real `TS18047` otherwise, `user` is `AuthUser | null`) or
 * reordering the null check ahead of `useLoadState`, which trips a hard
 * `react-hooks/rules-of-hooks` eslint error (a conditionally-called hook) --
 * a real hazard, but NOT the only alternative: a null-guarded closure or an
 * inner "authed" component are both safe and need no reorder. Self-resolving
 * (mirroring `checkin.ts`'s own already-shipped pattern) was kept anyway as
 * the lowest-risk option available on this task's own final round --
 * `ParentHome.tsx`'s existing zero-arg `LoadLinkedStudentsFn` signature, its
 * existing call sites, and its existing fixture default all stay untouched.
 * A caller-supplied-identity redesign is a legitimate, arguably more
 * efficient alternative for a future task; declined here specifically
 * because this is the final round, not because it is unsafe.
 *
 * **Unresolved-session decision (this task's own, not the owner's):** when
 * `querySessionUserId()` resolves `null` (no session -- `checkin.ts`'s own
 * identical query never throws for this case, it is a genuine "no session"
 * outcome, not a transport error), this function THROWS instead of
 * resolving `{students: [], teams: []}`. `ParentHome`'s outer `loadState`
 * then reaches its own already-existing, already-honest
 * `status === 'error'` branch ("Couldn't load Home / Something went wrong
 * loading your linked students. Try refreshing the page.") -- a generic,
 * true statement about a load failure, rather than the specific, FALSE
 * "No linked students yet" claim a genuinely signed-in parent (the only way
 * to reach `ParentHome` at all, per `RequireAuth`) would otherwise see about
 * their own account when their Supabase-side session lookup happens to
 * disagree with the app's own `useAuth()` state -- the same class of harm
 * T184's own record names, even though the mechanism differs (a loader
 * design choice here, not a blocked sign-in there). This changes ONLY the
 * `sessionUser === null` branch: a resolved session with genuinely zero
 * `guardian_links` rows is UNCHANGED and still resolves
 * `{students: [], teams: []}` -> "No linked students yet", because that
 * claim is true in that case. `checkin.ts`'s own identical `return []` for
 * the null-session case is fine there specifically because it feeds a
 * sub-list inside `StudentMeetingView`, never a terminal per-page claim --
 * this file's per-page seam has no equivalent safety net, hence the
 * different choice here.
 *
 * -----------------------------------------------------------------------
 * The per-card seam -- `makeLoadStudentHomeCardDataForParentHome`.
 *
 * Binds `makeLoadConsistencyStripData`/`makeResolveStudentScope` to this
 * file's own injected `getClient` once, then composes them with the new
 * `events`/`event_sessions`/`rsvps` queries via `Promise.all`.
 * `buildNextEventsForStudent` (`ParentHome.tsx`, untouched, its own pure
 * function/tests unaffected) needs a clock (`nowMs`) -- `nowFn` is threaded
 * through as this factory's own second parameter, defaulting to
 * `() => new Date()`, mirroring `StudentHome.tsx`'s own injectable `nowFn`
 * convention (`ResolvedStudentHomeViewProps.nowFn`) so callers (and this
 * task's own C5 test) can supply a fixed instant for deterministic
 * assertions.
 *
 * `resolveStudentScope`'s own view (`v_student_goal_projection`) filters
 * `where s.is_active` (`dashboard_views.sql`) -- a deactivated student's
 * scope resolves `null` even though `studentId` is genuinely real and
 * linked (same fact `StudentHome.tsx`'s own T184 three-way union exists to
 * name -- NOT reused here; that union is about a deactivated student
 * signing in AS HERSELF, a blocked-actor situation this page's own
 * `isActive` marker on `ParentHome.tsx` does not share -- a parent viewing
 * their deactivated child's card is an unaffected observer, not a blocked
 * actor, per this task's own design record). When `loadScope` returns
 * `null`, this function falls back to an honest, disclosed zero/absent
 * `goalHours`/`confirmedHours` (mirrors `StudentHome.tsx`'s own disclosed
 * `seasonDefaultGoalHours`/`0` fallback for its explicit-bypass path) --
 * NEVER a rejection, and never a TS-side re-derivation of the
 * `goal_hours_override ?? default` coalesce (grep-provable: no `??` in this
 * file sits near `goal_hours_override`/`goalHoursOverride`).
 *
 * -----------------------------------------------------------------------
 * Disclosed query fan-out (NOT fixed here -- a worse trade for this task's
 * final round than abandoning the clean, checker-verified-elsewhere reuse
 * this file is built on). Per card: `event_sessions`, `attendance`,
 * `v_student_participation` (all three already inside the reused
 * `makeLoadConsistencyStripData`), `v_student_goal_projection`, `events`,
 * `event_sessions` (again -- the fuller query above, a genuine second scan
 * of the same table this file cannot avoid without forking the reused strip
 * loader's own internals), `rsvps` -- 7 round trips per card. A parent with
 * 3 linked students: 21 per-card queries plus ~4 outer-seam queries
 * (session, guardian_links, students, teams).
 *
 * -----------------------------------------------------------------------
 * RLS -- reasoned, not measured (no live Supabase in this environment, same
 * disclosed gap every loader in this codebase carries). `my_student_ids()`
 * (`rls.sql:20-26`) unions a student's own row (`profile_id = auth.uid()`)
 * with every `guardian_links`-linked student for the calling parent
 * (`parent_profile_id = auth.uid()`), with NO `is_active` filter of its
 * own. `students` (`rls.sql:100-102`), `events` (`rls.sql:153-163`),
 * `event_sessions` (`rls.sql:180-190`), `rsvps` (`rls.sql:201-203`), and
 * `attendance`/`v_student_participation` (read inside the reused strip
 * loader) each carry `own_or_linked_read` keyed off this same function;
 * `teams` carries `read_all` (`rls.sql:66`). A signed-in parent's queries
 * against all of these resolve for every one of their linked students,
 * INCLUDING a deactivated one (only `v_student_goal_projection` itself
 * filters `is_active`, at the view level, not via RLS) -- consistent with
 * this file's own honest-zero-fallback design above, not an RLS-caused
 * false-empty for the rest of a deactivated student's card.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { createLoader, type LoaderQueryResult } from '../loader';
import { getSupabaseClient } from '../client';
import { makeLoadConsistencyStripData } from './checkin';
import { makeResolveStudentScope } from './students';
import {
  buildNextEventsForStudent,
  type EventType,
  type HomeEventRow,
  type HomeRsvpRow,
  type HomeSessionRow,
  type HomeTeamRow,
  type LinkedStudentRow,
  type LinkedStudentsResult,
  type LoadLinkedStudentsFn,
  type LoadStudentHomeCardDataFn,
  type RsvpStatus,
  type SessionStatus,
  type StudentHomeCardData,
} from '../../../pages/home/ParentHome';

// ---------------------------------------------------------------------------
// Raw DB row shapes (snake_case, exactly as Postgrest returns them).
// ---------------------------------------------------------------------------

interface SessionUserIdDbRow {
  id: string;
}

interface GuardianLinkDbRow {
  student_id: string;
}

/** Wider than `checkin.ts`'s own `StudentDisplayDbRow` (module doc above --
 * the two `students` reads are genuinely different queries for different
 * consumers). */
interface StudentDbRow {
  id: string;
  display_name: string;
  team_id: string;
  is_active: boolean;
}

interface TeamDbRow {
  id: string;
  name: string;
}

interface EventDbRow {
  id: string;
  season_id: string;
  type: EventType;
  title: string;
  team_ids: readonly string[] | null;
}

/** Fuller than `checkin.ts`'s own private `EventSessionDbRow` (module doc
 * above -- `event_id`/`ends_at` are required here, absent there). */
interface FullEventSessionDbRow {
  id: string;
  event_id: string;
  session_date: string;
  starts_at: string;
  ends_at: string;
  status: SessionStatus;
}

interface RsvpDbRow {
  id: string;
  session_id: string;
  student_id: string;
  status: RsvpStatus;
  responded_by: string | null;
  updated_at: string;
}

// ---------------------------------------------------------------------------
// Row mappers -- snake_case DB row -> `ParentHome.tsx`'s own camelCase types.
// ---------------------------------------------------------------------------

function mapStudentDbRow(row: StudentDbRow): LinkedStudentRow {
  return {
    studentId: row.id,
    displayName: row.display_name,
    teamId: row.team_id,
    isActive: row.is_active,
  };
}

function mapTeamDbRow(row: TeamDbRow): HomeTeamRow {
  return { id: row.id, name: row.name };
}

function mapEventDbRow(row: EventDbRow): HomeEventRow {
  return {
    id: row.id,
    seasonId: row.season_id,
    type: row.type,
    title: row.title,
    teamIds: row.team_ids,
  };
}

function mapFullEventSessionDbRow(row: FullEventSessionDbRow): HomeSessionRow {
  return {
    id: row.id,
    eventId: row.event_id,
    sessionDate: row.session_date,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    status: row.status,
  };
}

function mapRsvpDbRow(row: RsvpDbRow): HomeRsvpRow {
  return {
    id: row.id,
    sessionId: row.session_id,
    studentId: row.student_id,
    status: row.status,
    respondedBy: row.responded_by,
    updatedAt: row.updated_at,
  };
}

// ---------------------------------------------------------------------------
// Query functions -- outer seam (linked students).
// ---------------------------------------------------------------------------

/** `null` for "no session" (never throws) -- module doc above, independently
 * reimplemented, mirrors `checkin.ts:382-390`'s identical shape. A genuine
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

/** Earliest-linked-first, same ordering `checkin.ts`'s own
 * `queryGuardianLinksForParent` already established for the identical
 * table. */
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

/** Wider than `checkin.ts`'s own `queryStudentsByIds` (module doc above). */
async function queryStudentsByIds(
  client: SupabaseClient,
  studentIds: string[],
): Promise<LoaderQueryResult<StudentDbRow[]>> {
  const result = await client
    .from('students')
    .select('id, display_name, team_id, is_active')
    .in('id', studentIds);
  return { data: (result.data as StudentDbRow[] | null) ?? null, error: result.error };
}

/** Full table, unfiltered (module doc above) -- `teams` carries `read_all`
 * RLS, and this page needs every team a linked student could belong to. */
async function queryTeams(client: SupabaseClient): Promise<LoaderQueryResult<TeamDbRow[]>> {
  const result = await client.from('teams').select('id, name');
  return { data: (result.data as TeamDbRow[] | null) ?? null, error: result.error };
}

// ---------------------------------------------------------------------------
// Query functions -- per-card seam (events/sessions/rsvps).
// ---------------------------------------------------------------------------

/** Full table, unfiltered (module doc above -- mirrors `checkin.ts`'s own
 * `queryEventSessions` idiom for the sibling table). */
async function queryEvents(client: SupabaseClient): Promise<LoaderQueryResult<EventDbRow[]>> {
  const result = await client.from('events').select('id, season_id, type, title, team_ids');
  return { data: (result.data as EventDbRow[] | null) ?? null, error: result.error };
}

/** Full table, unfiltered, fuller column set than `checkin.ts`'s own private
 * version (module doc above). */
async function queryEventSessionsFull(
  client: SupabaseClient,
): Promise<LoaderQueryResult<FullEventSessionDbRow[]>> {
  const result = await client
    .from('event_sessions')
    .select('id, event_id, session_date, starts_at, ends_at, status');
  return { data: (result.data as FullEventSessionDbRow[] | null) ?? null, error: result.error };
}

/** Defense-in-depth `student_id` filter on top of `rsvps`'s own
 * `own_or_linked_read` RLS policy, same idiom `checkin.ts`'s own
 * `queryAttendanceForStudent` already established for a sibling table. */
async function queryRsvpsForStudent(
  client: SupabaseClient,
  studentId: string,
): Promise<LoaderQueryResult<RsvpDbRow[]>> {
  const result = await client
    .from('rsvps')
    .select('id, session_id, student_id, status, responded_by, updated_at')
    .eq('student_id', studentId);
  return { data: (result.data as RsvpDbRow[] | null) ?? null, error: result.error };
}

// ---------------------------------------------------------------------------
// `getClient` is injectable (defaults to the shared singleton), same
// convention every `loaders/*.ts` file in this directory already
// established, so tests can supply a stubbed transport with zero real
// network calls.
// ---------------------------------------------------------------------------

/**
 * `ParentHome.tsx`'s own real outer-seam default (module doc above --
 * central trap, unresolved-session decision).
 */
export function makeLoadLinkedStudentsForParentHome(
  getClient: () => SupabaseClient = getSupabaseClient,
): LoadLinkedStudentsFn {
  const loadSessionUserId = createLoader<void, SessionUserIdDbRow>(querySessionUserId, getClient);
  const loadGuardianLinks = createLoader<string, GuardianLinkDbRow[]>(
    queryGuardianLinksForParent,
    getClient,
  );
  const loadStudents = createLoader<string[], StudentDbRow[]>(queryStudentsByIds, getClient);
  const loadTeams = createLoader<void, TeamDbRow[]>(queryTeams, getClient);

  return async (): Promise<LinkedStudentsResult> => {
    const sessionUser = await loadSessionUserId();
    if (sessionUser === null) {
      // Module doc above: an unresolved session is a page-level error, not
      // a false, specific "No linked students yet" claim about a genuinely
      // signed-in parent's own account.
      throw new Error("Unable to resolve the signed-in parent's session.");
    }
    const linkRows = (await loadGuardianLinks(sessionUser.id)) ?? [];
    if (linkRows.length === 0) {
      return { students: [], teams: [] };
    }
    const studentIds = linkRows.map((row) => row.student_id);
    const [studentRows, teamRows] = await Promise.all([loadStudents(studentIds), loadTeams()]);
    const studentById = new Map((studentRows ?? []).map((row) => [row.id, row] as const));
    // Preserve `guardian_links`' own earliest-linked-first ordering rather
    // than whatever order `.in('id', studentIds)` happens to return; drop
    // any link whose student row didn't come back (defense in depth, should
    // not happen under RLS since both reads are scoped to the same caller).
    const students = linkRows
      .map((row) => studentById.get(row.student_id))
      .filter((row): row is StudentDbRow => row !== undefined)
      .map(mapStudentDbRow);
    const teams = (teamRows ?? []).map(mapTeamDbRow);
    return { students, teams };
  };
}

/** `ParentHome.tsx`'s own default `loadLinkedStudents` -- real query. */
export const loadLinkedStudentsForParentHome: LoadLinkedStudentsFn =
  makeLoadLinkedStudentsForParentHome();

/**
 * `ParentHome.tsx`'s own real per-card seam default (module doc above --
 * reuse, clock injection, honest-null fallback).
 */
export function makeLoadStudentHomeCardDataForParentHome(
  getClient: () => SupabaseClient = getSupabaseClient,
  nowFn: () => Date = () => new Date(),
): LoadStudentHomeCardDataFn {
  const loadStripData = makeLoadConsistencyStripData(getClient);
  const loadScope = makeResolveStudentScope(getClient);
  const loadEvents = createLoader<void, EventDbRow[]>(queryEvents, getClient);
  const loadEventSessions = createLoader<void, FullEventSessionDbRow[]>(
    queryEventSessionsFull,
    getClient,
  );
  const loadRsvps = createLoader<string, RsvpDbRow[]>(queryRsvpsForStudent, getClient);

  return async (studentId: string, teamId: string): Promise<StudentHomeCardData> => {
    const [stripData, scope, eventRows, sessionRows, rsvpRows] = await Promise.all([
      loadStripData(studentId),
      loadScope(studentId),
      loadEvents(),
      loadEventSessions(),
      loadRsvps(studentId),
    ]);

    const events = (eventRows ?? []).map(mapEventDbRow);
    const sessions = (sessionRows ?? []).map(mapFullEventSessionDbRow);
    // T187 -- scope by the student's real ACTIVE team ids
    // (`resolveStudentScope`'s new `teamIds`, `students.ts`'s own module
    // doc), not the single threaded `teamId` -- same defect, second surface
    // (`StudentHome.tsx`'s own module doc #8 T187 record). Two edge cases,
    // both disclosed:
    //   - `scope === null` (e.g. a deactivated linked student, module doc
    //     above's own honest zero/absent fallback) -- no active-membership
    //     read to fall back on, so this uses the threaded single `teamId`,
    //     same single-team behavior this function already had.
    //   - `scope` present but a genuinely EMPTY `teamIds` (zero active
    //     memberships) -- scoped to nothing (an honest `[]`), NOT a fallback
    //     to `teamId`; a real student with zero active team rows genuinely
    //     has no team-scoped events to show. This is why every per-card test
    //     fixture that exercises `nextEvents` seeds an ACTIVE `student_teams`
    //     row mirroring the real backfill, not a code-level fallback here.
    const activeTeamIds = scope === null ? [teamId] : scope.teamIds;
    const nextEvents = buildNextEventsForStudent(
      sessions,
      events,
      activeTeamIds,
      nowFn().getTime(),
    );
    const nextEventSessionIds = new Set(nextEvents.map((event) => event.sessionId));

    return {
      // Module doc above: honest zero/absent fallback when `loadScope`
      // returns `null` (e.g. a deactivated linked student) -- never a
      // rejection, never a TS-side re-derivation of the
      // `goal_hours_override ?? default` coalesce.
      goalHours: scope?.goalHours ?? 0,
      confirmedHours: scope?.confirmedHours ?? 0,
      participation: stripData.participation,
      consistencyEntries: stripData.entries,
      nextEvents,
      rsvps: (rsvpRows ?? [])
        .map(mapRsvpDbRow)
        .filter((rsvp) => nextEventSessionIds.has(rsvp.sessionId)),
    };
  };
}

/** `ParentHome.tsx`'s own default `loadStudentData` -- real query. */
export const loadStudentHomeCardDataForParentHome: LoadStudentHomeCardDataFn =
  makeLoadStudentHomeCardDataForParentHome();
