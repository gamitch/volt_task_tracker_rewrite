/**
 * T089 (ED-1 Packet P2): real `students`/`teams`/`invites` data-layer wiring
 * for `src/pages/roster/StudentsTab.tsx` -- second file in the `loaders/`
 * directory (T087's `loaders/invites.ts` was the first). Built directly on
 * top of T086's `createLoader`/`runMutation` (`../loader.ts`, read-only
 * import here), same DI (`getClient`) convention `loaders/invites.ts`
 * already established.
 *
 * -----------------------------------------------------------------------
 * Trap #1 decision (worker packet Known Context/Traps #1) -- three
 * independent `createLoader`s (one per table), issued together via
 * `Promise.all` inside a single exported `LoadStudentsTabDataFn`.
 * `students`/`teams`/`invites` need no server-side join for this screen --
 * the join (matching a student to its team name and to any pending
 * self-invite) already happens client-side, in `StudentsTab.tsx`'s own pure
 * `buildDisplayRows`, untouched by this file. Three independent flat
 * `select('*')`s are simpler to test (one small fake `SupabaseClient` chain
 * per table, mirroring `loaders/invites.ts`'s own `makeFakeSelectClient`
 * test-file pattern) than one hand-rolled multi-table Postgrest embed
 * (`.select('*, teams(*), invites(*)')`), which this file deliberately does
 * not attempt.
 *
 * `StudentsTab.tsx`'s own page-local `StudentRow`/`TeamRow`/`InviteRow`
 * types are kept AS-IS here (not switched to `../types.ts`'s shared
 * exports) -- same Trap #1 decision `loaders/invites.ts` already made for
 * `InvitesTab.tsx`, for the identical reason: the shared `TeamRow`
 * additionally carries `shortName`/`program`/`color`/`sortOrder`/
 * `createdAt`, and the shared `StudentRow`/`InviteRow` each carry
 * `createdAt` (`InviteRow` also carries `invitedBy`/`expiresAt`) -- fields
 * this screen never displays or otherwise needs. `StudentsTab.tsx`'s local
 * `TeamRow` DOES gain one new field in this task, `archived`
 * (`teams.archived`, real column, `not null default false`) -- needed for
 * real Known Context/Traps #4 wiring (`StudentDialog`'s `teams` prop must be
 * able to exclude archived teams, which requires knowing which ones are
 * archived); this is a disclosed, minimal, needed extension of that local
 * type, not a switch to the shared one.
 *
 * -----------------------------------------------------------------------
 * Known Context/Traps #1 (load) -- `staff_all` RLS
 * (`supabase/migrations/20260717000002_rls.sql`, read-only reference, not
 * imported here) grants staff (`is_staff()`, i.e. `admin`/`coach`) full
 * read/write on both `students` and `teams`; `invites` has its own
 * `staff_all` policy (already cited in `loaders/invites.ts`'s own module
 * doc). `StudentsTab` only ever renders for admin/coach (`RosterShell.tsx`'s
 * `RequireRole allowedRoles={['coach', 'admin']}`, a forbidden file here,
 * read-only reference), so every session reaching `loadStudentsTabData`
 * below is genuinely staff -- a real empty result for any of the three
 * tables is "none exist yet", not an RLS-caused false-empty. Same reasoning
 * `loaders/invites.ts` already applied.
 *
 * -----------------------------------------------------------------------
 * Known Context/Traps #2 (deactivate/reactivate) -- `setStudentActive`
 * below does exactly one thing: `update students set is_active = :isActive
 * where id = :id`, via `runMutation`. `StudentsTab.tsx`'s own
 * `withActiveOverride` remains the ONLY place the OPTIMISTIC local-state
 * flip happens (unchanged, still pure); this file's `setStudentActive` is
 * the real mutation `StudentsTab.tsx` now pairs it with, rolling the
 * optimistic flip back on rejection (see that file's own module doc for the
 * full optimistic-update-plus-rollback shape, mirrored from
 * `RsvpControl.tsx`'s own `handleChange`).
 *
 * -----------------------------------------------------------------------
 * Known Context/Traps #6 (create/edit) -- `createStudent`/`updateStudent`
 * below insert/update exactly the real, editable `students` columns
 * (`display_name`/`team_id`/`grad_year`/`is_active`/`goal_hours_override`)
 * -- never `profile_id` (only ever set by the accept-invite trigger,
 * `20260718000000_invite_trigger.sql`, forbidden/read-only) and never `id`
 * (DB-generated on create, immutable on update). Both resolve the full,
 * freshly-written row (`.select().single()`) so `StudentsTab.tsx` can merge
 * the real DB-assigned `id`/unchanged fields back into local state without a
 * full reload -- same "resolve the written row, merge into local state, no
 * forced full-page reload" discipline `SeasonSettings.tsx`'s own
 * create/update flow already establishes for this codebase (`loaders/
 * invites.ts`'s own mutation, revoke, has no return payload, so it didn't
 * need this).
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { createLoader, runMutation, type LoaderQueryResult } from '../loader';
import { getSupabaseClient } from '../client';
import type { InviteStatus as SharedInviteStatus, Role as SharedRole } from '../types';
import type {
  CreateStudentFn,
  InviteRow,
  LoadStudentsTabDataFn,
  SetStudentActiveFn,
  StudentRow,
  StudentsTabLoadResult,
  StudentWritePayload,
  TeamRow,
  UpdateStudentFn,
} from '../../../pages/roster/StudentsTab';
// T176 -- additive only (this task's own Allowed Files instruction). New
// own-row `students` resolution for `StudentHome.tsx`'s real
// `teamId`/`goalHoursOverride` scoping. `ResolveStudentScopeFn`/
// `StudentScope` are OWNED by `StudentHome.tsx` (mirrors the existing
// `CurrentViewerIdentity`/`ResolveCurrentStudentIdFn` cross-file shape
// `loaders/meetings.ts` already established for that file's own T096
// resolution) -- imported here as types only.
import type {
  LoadStudentHomeDataFn,
  ResolveStudentScopeFn,
  StudentHomeData,
} from '../../../pages/home/StudentHome';

/**
 * Raw `public.students` row exactly as Postgrest returns it (snake_case) --
 * `supabase/migrations/20260716000000_identity_roster.sql` lines 59-68,
 * cited in full already in `../types.ts`'s own `StudentRow` doc comment (not
 * re-cited here).
 */
interface StudentDbRow {
  id: string;
  profile_id: string | null;
  display_name: string;
  team_id: string;
  grad_year: number | null;
  is_active: boolean;
  goal_hours_override: number | null;
  created_at: string;
}

/** Raw `public.teams` row -- same migration file, lines 29-38. */
interface TeamDbRow {
  id: string;
  name: string;
  short_name: string;
  program: string | null;
  color: string;
  archived: boolean;
  sort_order: number;
  created_at: string;
}

/**
 * Raw `public.invites` row -- `supabase/migrations/
 * 20260717000000_scheduling_attendance.sql` lines 18-27. `role`/`status`
 * typed against the SHARED `Role`/`InviteStatus` unions, same convention
 * `loaders/invites.ts`'s own `InviteDbRow` already established.
 */
interface InviteDbRow {
  id: string;
  email: string;
  role: SharedRole;
  student_id: string | null;
  invited_by: string;
  status: SharedInviteStatus;
  expires_at: string;
  created_at: string;
}

function mapStudentDbRowToStudentRow(row: StudentDbRow): StudentRow {
  return {
    id: row.id,
    profileId: row.profile_id,
    displayName: row.display_name,
    teamId: row.team_id,
    gradYear: row.grad_year,
    isActive: row.is_active,
    goalHoursOverride: row.goal_hours_override,
  };
}

/**
 * `short_name`/`program`/`color`/`sort_order`/`created_at` are deliberately
 * dropped -- `StudentsTab.tsx`'s local `TeamRow` never displays them (Trap #1
 * decision above).
 */
function mapTeamDbRowToTeamRow(row: TeamDbRow): TeamRow {
  return { id: row.id, name: row.name, archived: row.archived };
}

/**
 * `invited_by`/`expires_at`/`created_at` are deliberately dropped -- same
 * lossy-but-disclosed mapping `loaders/invites.ts` already established for
 * `invited_by` alone; `StudentsTab.tsx`'s local `InviteRow` never displayed
 * any of these three even before this task.
 */
function mapInviteDbRowToInviteRow(row: InviteDbRow): InviteRow {
  return {
    id: row.id,
    email: row.email,
    role: row.role,
    studentId: row.student_id,
    status: row.status,
  };
}

async function queryStudents(client: SupabaseClient): Promise<LoaderQueryResult<StudentDbRow[]>> {
  const result = await client
    .from('students')
    .select('*')
    .order('display_name', { ascending: true });
  return { data: (result.data as StudentDbRow[] | null) ?? null, error: result.error };
}

async function queryTeams(client: SupabaseClient): Promise<LoaderQueryResult<TeamDbRow[]>> {
  const result = await client.from('teams').select('*').order('sort_order', { ascending: true });
  return { data: (result.data as TeamDbRow[] | null) ?? null, error: result.error };
}

async function queryInvites(client: SupabaseClient): Promise<LoaderQueryResult<InviteDbRow[]>> {
  const result = await client.from('invites').select('*').order('created_at', { ascending: false });
  return { data: (result.data as InviteDbRow[] | null) ?? null, error: result.error };
}

/**
 * `getClient` is injectable (defaults to the shared singleton), same
 * convention `loaders/invites.ts` already established, so tests can supply a
 * stubbed transport with zero real network calls -- used directly by
 * `StudentsTab.test.tsx`'s loader-level tests (this module has no dedicated
 * test file of its own; the worker packet's Allowed Files list only names
 * `StudentsTab.test.tsx`/`StudentDialog.test.tsx`, not a new file here).
 *
 * Trap #1: three independent `createLoader`s, issued together via
 * `Promise.all` -- documented choice, see module doc above.
 */
export function makeLoadStudentsTabData(
  getClient: () => SupabaseClient = getSupabaseClient,
): LoadStudentsTabDataFn {
  const loadStudentRows = createLoader<void, StudentDbRow[]>(queryStudents, getClient);
  const loadTeamRows = createLoader<void, TeamDbRow[]>(queryTeams, getClient);
  const loadInviteRows = createLoader<void, InviteDbRow[]>(queryInvites, getClient);
  return async (): Promise<StudentsTabLoadResult> => {
    const [studentRows, teamRows, inviteRows] = await Promise.all([
      loadStudentRows(),
      loadTeamRows(),
      loadInviteRows(),
    ]);
    // Known Context/Traps #1's null -> [] bridge -- the one place it
    // happens, applied independently per table.
    return {
      students: (studentRows ?? []).map(mapStudentDbRowToStudentRow),
      teams: (teamRows ?? []).map(mapTeamDbRowToTeamRow),
      invites: (inviteRows ?? []).map(mapInviteDbRowToInviteRow),
    };
  };
}

/** Default `loadData` for `StudentsTab.tsx` -- real query against all three tables. */
export const loadStudentsTabData: LoadStudentsTabDataFn = makeLoadStudentsTabData();

/**
 * Known Context/Traps #2 -- the ONLY place `students.is_active` is ever
 * written from this module. `StudentsTab.tsx` pairs this with its own
 * optimistic `withActiveOverride` local-state flip, rolling that flip back
 * on rejection. Same injectable-`getClient` convention as
 * `makeLoadStudentsTabData` above, for the same testability reason.
 */
export function makeSetStudentActive(
  getClient: () => SupabaseClient = getSupabaseClient,
): SetStudentActiveFn {
  const mutate = runMutation<{ id: string; isActive: boolean }, void>(
    (client, args) =>
      client.from('students').update({ is_active: args.isActive }).eq('id', args.id),
    getClient,
  );
  return async (id, isActive) => {
    await mutate({ id, isActive });
  };
}

/** Default `onSetStudentActive` for `StudentsTab.tsx`. */
export const setStudentActive: SetStudentActiveFn = makeSetStudentActive();

/**
 * Known Context/Traps #6 -- real `students` insert. Never writes
 * `profile_id`/`id` (see module doc above). Resolves the freshly-written row
 * so the caller can merge it into local state without a full reload.
 */
export function makeCreateStudent(
  getClient: () => SupabaseClient = getSupabaseClient,
): CreateStudentFn {
  const mutate = runMutation<StudentWritePayload, StudentDbRow>(
    (client, payload) =>
      client
        .from('students')
        .insert({
          display_name: payload.displayName,
          team_id: payload.teamId,
          grad_year: payload.gradYear,
          is_active: payload.isActive,
          goal_hours_override: payload.goalHoursOverride,
        })
        .select()
        .single(),
    getClient,
  );
  return async (payload) => mapStudentDbRowToStudentRow(await mutate(payload));
}

/** Default `onCreateStudent` for `StudentsTab.tsx`. */
export const createStudent: CreateStudentFn = makeCreateStudent();

/**
 * Known Context/Traps #6 -- real `students` update by id. Never writes
 * `profile_id`/`id`.
 */
export function makeUpdateStudent(
  getClient: () => SupabaseClient = getSupabaseClient,
): UpdateStudentFn {
  const mutate = runMutation<{ id: string; payload: StudentWritePayload }, StudentDbRow>(
    (client, args) =>
      client
        .from('students')
        .update({
          display_name: args.payload.displayName,
          team_id: args.payload.teamId,
          grad_year: args.payload.gradYear,
          is_active: args.payload.isActive,
          goal_hours_override: args.payload.goalHoursOverride,
        })
        .eq('id', args.id)
        .select()
        .single(),
    getClient,
  );
  return async (id, payload) => mapStudentDbRowToStudentRow(await mutate({ id, payload }));
}

/** Default `onUpdateStudent` for `StudentsTab.tsx`. */
export const updateStudent: UpdateStudentFn = makeUpdateStudent();

/**
 * T176 -- additive only, appended after every pre-existing export (this
 * task's own Allowed Files instruction: no existing export's name,
 * signature, or behavior changes).
 *
 * **Coordinator correction (post-checker, T176 round 2):** the original
 * shape of this read selected the raw `students.team_id`/
 * `students.goal_hours_override` columns and let `StudentHome.tsx`
 * coalesce the goal-hours override against the season default in
 * TypeScript. That is a constitution-item-3 violation with a working
 * in-repo counterexample: `v_student_goal_projection`
 * (`supabase/migrations/20260723000001_dashboard_views.sql:322-334`)
 * already computes exactly this coalesce in SQL --
 * `coalesce(s.goal_hours_override, se.default_goal_hours) as goal_hours`
 * -- scoped to the currently-active season (`join seasons se on
 * se.is_active`), and already has a working in-repo reader
 * (`src/lib/supabase/loaders/dashboard.ts`'s own `queryGoalProjection`,
 * `.select('student_id, season_id, team_id, goal_hours, confirmed_hours,
 * planned_hours')`) whose own consumer (`CoachHome.tsx`'s module doc,
 * "(g) Goal source") records the required posture verbatim:
 * "`StudentGoalProjectionEntry.goalHours` is a verbatim passthrough, never
 * recomputed here." This read now does the same thing for one student
 * instead of a whole season.
 *
 * The same single read also returns `confirmed_hours`/`planned_hours`
 * (the view's own `v_student_hours`/`v_student_planned_hours` LEFT JOINs,
 * both already-real, already-SQL-computed columns) -- threaded through so
 * `StudentHome.tsx`'s content tier no longer needs its own separate,
 * fixture-fed `data.studentHours`/`computePlannedHours(...)` call for
 * these two numbers either (same single read, strictly more honest data,
 * not a second query).
 *
 * Scoped by `.eq('student_id', studentId)` only -- no explicit
 * `.eq('season_id', ...)` filter is added, because the view's own `join
 * seasons se on se.is_active` already restricts every row to the single
 * currently-active season (`seasons_single_active_idx` guarantees at most
 * one such row, same guarantee `loaders/seasons.ts`'s own
 * `queryActiveSeason` already relies on) -- adding a second, redundant
 * season filter here would require widening `ResolveStudentScopeFn`'s own
 * signature to take a `seasonId` argument for no additional real scoping
 * benefit, a disclosed, deliberate simplicity choice.
 *
 * RLS -- **reasoned, not measured (no live Supabase in this environment,
 * same disclosed gap every task in this codebase carries).** The
 * migration's own header (`dashboard_views.sql:49-52`) states none of its
 * views are `security_definer`/`security_barrier`, so
 * `v_student_goal_projection` runs under the CALLING session's own RLS
 * against its base tables. For a `student`-role caller reading their own
 * `student_id`: `students` carries `own_or_linked_read`
 * (`rls.sql:100-102`, `id in (select my_student_ids())`); `seasons`
 * carries `read_all` (`rls.sql:78-79`, any authenticated caller); the
 * view's own `v_student_hours` LEFT JOIN reads `attendance`
 * (`own_or_linked_read`, `rls.sql:230-232`) via `event_sessions`
 * (`own_or_linked_read`, `rls.sql:180`) and `events`
 * (`own_or_linked_read`, `rls.sql:153`); `v_student_planned_hours` reads
 * `v_planned_rsvp_hours`, itself over `rsvps` (`own_or_linked_read`,
 * `rls.sql:201`) via the same `event_sessions`/`events`. Every base table
 * this view touches already grants a student read access to exactly their
 * own row(s) -- composed together, a real signed-in student's own query
 * genuinely resolves, not an RLS-caused false-empty. This exact
 * composition (a multi-table view whose every base table is
 * `own_or_linked_read`-covered, read by a student for their own id) has no
 * DIRECT precedent elsewhere in this codebase to point to as a live-tested
 * example -- flagged for the checker to independently confirm rather than
 * accepted on my own reasoning alone.
 *
 * A brand-new interface (`StudentGoalProjectionDbRow`), not a reuse of the
 * existing module-private `StudentDbRow` above -- this task's own packet
 * forbids touching that interface's shape, and this query reads a
 * different table (a view, not `students` directly) with a disjoint
 * column set.
 */
interface StudentGoalProjectionDbRow {
  team_id: string;
  goal_hours: number;
  confirmed_hours: number;
  planned_hours: number;
}

async function queryStudentGoalProjectionById(
  client: SupabaseClient,
  studentId: string,
): Promise<LoaderQueryResult<StudentGoalProjectionDbRow>> {
  const result = await client
    .from('v_student_goal_projection')
    .select('team_id, goal_hours, confirmed_hours, planned_hours')
    .eq('student_id', studentId)
    .maybeSingle();
  return { data: (result.data as StudentGoalProjectionDbRow | null) ?? null, error: result.error };
}

/** T187: a student's ACTIVE `student_teams` membership team ids -- the
 * ACTIVE predicate is `left_on is null`, matching the already-migrated
 * readers (`membership_views.sql:63`/`:92`, `dashboard_views.sql:205-206`). */
interface StudentTeamMembershipDbRow {
  team_id: string;
}

async function queryActiveStudentTeamIds(
  client: SupabaseClient,
  studentId: string,
): Promise<LoaderQueryResult<StudentTeamMembershipDbRow[]>> {
  const result = await client
    .from('student_teams')
    .select('team_id')
    .eq('student_id', studentId)
    .is('left_on', null);
  return {
    data: (result.data as StudentTeamMembershipDbRow[] | null) ?? null,
    error: result.error,
  };
}

/** T187: the shared ACTIVE-membership read (same injectable-`getClient` +
 * `createLoader` convention every export in this file already uses). */
export function makeResolveActiveStudentTeamIds(
  getClient: () => SupabaseClient = getSupabaseClient,
): (studentId: string) => Promise<readonly string[]> {
  const load = createLoader<string, StudentTeamMembershipDbRow[]>(
    queryActiveStudentTeamIds,
    getClient,
  );
  return async (studentId: string) => ((await load(studentId)) ?? []).map((row) => row.team_id);
}

/**
 * `getClient` is injectable (defaults to the shared singleton), same
 * convention every export above already established, so tests can supply a
 * stubbed transport with zero real network calls -- see this task's own new
 * `students.test.ts` (scoped to this one function only -- NOT a full
 * coverage sweep of this file, which no ledger row currently claims, per
 * this task's own packet disclosure).
 */
export function makeResolveStudentScope(
  getClient: () => SupabaseClient = getSupabaseClient,
): ResolveStudentScopeFn {
  const loadScope = createLoader<string, StudentGoalProjectionDbRow>(
    queryStudentGoalProjectionById,
    getClient,
  );
  const loadTeamIds = makeResolveActiveStudentTeamIds(getClient);
  return async (studentId: string) => {
    const [row, teamIds] = await Promise.all([loadScope(studentId), loadTeamIds(studentId)]);
    if (row === null) return null;
    // Verbatim passthrough (constitution item 3) -- `goal_hours` is already
    // the coalesced value; no coalesce/override arithmetic happens here.
    return {
      teamId: row.team_id,
      teamIds,
      goalHours: row.goal_hours,
      confirmedHours: row.confirmed_hours,
      plannedHours: row.planned_hours,
    };
  };
}

/** `StudentHome.tsx`'s own default `resolveStudentScope`. */
export const resolveStudentScope: ResolveStudentScopeFn = makeResolveStudentScope();

/**
 * T183 -- additive only (this task's own Allowed Files instruction: no
 * existing export's name, signature, or behavior changes). Real
 * `StudentHome.tsx:1763` production `loadData` default, narrowed to the ONE
 * user-facing defect that row's own citations name -- the fabricated
 * `'Ada Reyes'` greeting (`defaultLoadStudentHomeData`, `StudentHome.tsx:1023`,
 * untouched, still exported for tests). Per this task's own scope ruling,
 * every OTHER `StudentHomeData` field is left an honest literal empty value
 * (`[]`/`null`/`0`) -- no new queries for events/sessions/rsvps/hours/
 * participation; those are already correctly empty today (T176), not
 * fabricated, and a real implementation of that rest-of-the-seam is its own
 * separate follow-up (see `StudentHome.tsx`'s own module doc #9, lines
 * 277-279).
 *
 * Same shape as `queryStudentGoalProjectionById`/`makeResolveStudentScope`
 * above: a single-row query via `createLoader`, injectable `getClient`,
 * `.eq('id', studentId).maybeSingle()`, camelCase mapping in the returned
 * closure. Selects only `display_name` -- same "select only what this
 * screen needs" discipline as that sibling export -- not a full-row read of
 * the already-documented `StudentDbRow` above.
 *
 * Column: `id`, not `student_id` -- the raw `students` table's own primary
 * key (`StudentDbRow` above), unlike `v_student_goal_projection`'s view-only
 * `student_id` column name. `studentId` here is genuinely `students.id`
 * (`loaders/meetings.ts:57`'s own `resolveCurrentStudentId` documents its
 * query as `students.profile_id = auth.uid()` resolving `students.id`, and
 * `StudentHome.tsx:1566`'s `resolveStudentIdentity` threads that same value
 * through unchanged to what `StudentHomeContent` eventually passes to
 * `loadData`).
 *
 * RLS -- `supabase/migrations/20260717000002_rls.sql:100-102`:
 * ```sql
 * create policy own_or_linked_read on students
 *   for select to authenticated
 *   using (id in (select my_student_ids()));
 * ```
 * A signed-in student reading their own row by `id` resolves fine -- a
 * simpler case than `queryStudentGoalProjectionById`'s own reasoning above
 * (no multi-table view, no LEFT JOINs to trace): `id in (select
 * my_student_ids())` is satisfied directly by the student's own linked row.
 *
 * Row-not-found -- by the time `StudentHomeContent` calls `loadData`,
 * `resolveStudentId`/`resolveStudentScope` have already both resolved
 * non-null for this `studentId` (`StudentHome.tsx:1558-1579`,
 * `resolveStudentIdentity`), so a null `display_name` row here is a genuine
 * anomaly, not an expected empty state. Fail loud (never bridged to fixture
 * data), same precedent `loaders/calendarFeed.ts`'s `makeLoadCalendarFeed`
 * already established (T177) -- this surfaces as `StudentHomeContent`'s
 * existing "Couldn't load Home" error banner (`StudentHome.tsx:1342-1353`),
 * no new DES-12 state needed.
 */
interface StudentDisplayNameDbRow {
  display_name: string;
}

async function queryStudentDisplayNameById(
  client: SupabaseClient,
  studentId: string,
): Promise<LoaderQueryResult<StudentDisplayNameDbRow>> {
  const result = await client
    .from('students')
    .select('display_name')
    .eq('id', studentId)
    .maybeSingle();
  return { data: (result.data as StudentDisplayNameDbRow | null) ?? null, error: result.error };
}

/**
 * `getClient` is injectable (defaults to the shared singleton), same
 * convention every export above already established, so tests can supply a
 * stubbed transport with zero real network calls -- see this task's own new
 * `students.test.ts` coverage.
 */
export function makeLoadStudentHomeData(
  getClient: () => SupabaseClient = getSupabaseClient,
): LoadStudentHomeDataFn {
  const loadRow = createLoader<string, StudentDisplayNameDbRow>(
    queryStudentDisplayNameById,
    getClient,
  );
  return async (studentId: string, seasonId: string): Promise<StudentHomeData> => {
    const row = await loadRow(studentId);
    // Fail loud, never bridged to fixture data -- see module doc above.
    if (row === null) {
      throw new Error('No student record was found for your account.');
    }
    // Return shape: real displayName, verbatim seasonId passthrough, every
    // other field an honest literal empty value (this task's own scope
    // ruling above) -- no `FIXTURE_*` symbol referenced anywhere here.
    return {
      seasonId,
      displayName: row.display_name,
      defaultGoalHours: 0,
      goalHoursOverride: null,
      events: [],
      sessions: [],
      rsvps: [],
      studentHours: null,
      participation: null,
    };
  };
}

/** `StudentHome.tsx`'s own real, production default `loadData`. */
export const loadStudentHomeData: LoadStudentHomeDataFn = makeLoadStudentHomeData();

/**
 * T189 -- additive only (this task's own Allowed Files instruction: no
 * existing export's name, signature, or behavior changes). New narrow read
 * for `MeetingsList.tsx`'s student/parent view (packet v2 §3): reads
 * `students.is_active` DIRECTLY for a resolved `studentId`, never inferred
 * from a view or another metric.
 *
 * Packet v2's own reasoning for why this must read the column instead of
 * reusing `resolveStudentScope`'s inference (both are worth carrying here,
 * not just in the packet, since a future caller of this file could
 * otherwise repeat the mistake): `v_student_goal_projection`
 * (`dashboard_views.sql:322-334`) inner-joins `seasons se on se.is_active`
 * (`:331`), so with zero active seasons the view returns no row for ANY
 * student, active or not -- `null` from that view does not mean inactive.
 * `v_student_participation`'s own `expected` CTE inner-joins
 * `event_sessions ... and es.status = 'completed'`
 * (`membership_views.sql:59-81`), so a brand-new ACTIVE student with
 * nothing completed also produces no row -- null does not mean inactive
 * there either. Only the raw column is unambiguous.
 *
 * `null` (this function's own return value) means "no such student row" --
 * genuinely distinct from `false` ("row exists, deactivated"). Callers must
 * not collapse the two; `MeetingsList.tsx`'s own `ResolvedStudentMeetingsView`
 * already has its own separate "no student account linked" state for the
 * "no such student" case, reached via a completely different seam
 * (`resolveStudentId` resolving `null`), so this function only ever needs to
 * disambiguate for a studentId that has ALREADY resolved to a real row.
 *
 * Column -- `students.is_active boolean not null default true`
 * (`identity_roster.sql:65`). RLS -- `own_or_linked_read`
 * (`rls.sql:100-102`, `id in (select my_student_ids())`) already grants a
 * signed-in student read access to exactly their own row; no new policy
 * needed, same reasoning `queryStudentDisplayNameById` above already
 * establishes for this same table/policy pair.
 *
 * Same shape as `queryStudentDisplayNameById`/`makeLoadStudentHomeData`
 * immediately above: a single-row query via `createLoader`, injectable
 * `getClient`, `.eq('id', studentId).maybeSingle()`. Selects only
 * `is_active` -- same "select only what this screen needs" discipline as
 * both siblings above.
 */
interface StudentIsActiveDbRow {
  is_active: boolean;
}

async function queryStudentIsActiveById(
  client: SupabaseClient,
  studentId: string,
): Promise<LoaderQueryResult<StudentIsActiveDbRow>> {
  const result = await client
    .from('students')
    .select('is_active')
    .eq('id', studentId)
    .maybeSingle();
  return { data: (result.data as StudentIsActiveDbRow | null) ?? null, error: result.error };
}

/**
 * `null` = no such student row; `false` = row exists, deactivated; `true` =
 * row exists, active. See module doc immediately above for why these three
 * outcomes must not be collapsed.
 */
export type ResolveStudentIsActiveFn = (studentId: string) => Promise<boolean | null>;

/**
 * `getClient` is injectable (defaults to the shared singleton), same
 * convention every export above already established, so tests can supply a
 * stubbed transport with zero real network calls -- see this task's own
 * `students.test.ts` coverage (scoped to this one function only, same
 * disclosed-narrow-scope posture `makeResolveStudentScope`/
 * `makeLoadStudentHomeData` above already established for their own tests).
 */
export function makeResolveStudentIsActive(
  getClient: () => SupabaseClient = getSupabaseClient,
): ResolveStudentIsActiveFn {
  const loadRow = createLoader<string, StudentIsActiveDbRow>(queryStudentIsActiveById, getClient);
  return async (studentId: string) => {
    const row = await loadRow(studentId);
    if (row === null) return null;
    return row.is_active;
  };
}

/** `MeetingsList.tsx`'s own real, production default `resolveStudentIsActive`. */
export const resolveStudentIsActive: ResolveStudentIsActiveFn = makeResolveStudentIsActive();
