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
