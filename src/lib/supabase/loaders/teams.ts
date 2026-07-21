/**
 * T094 (ED-1 Packet P5): real `teams`/`students` data-layer wiring for
 * `src/pages/roster/TeamsTab.tsx`, plus the mutation seams that file's own
 * UI (Create/Archive/Reactivate/Hard-delete/Reorder) never actually had
 * before this task -- see this task's worker packet's own Objective section
 * for the full disclosure of that pre-existing gap. Built directly on top of
 * T086's `createLoader`/`runMutation` (`../loader.ts`, read-only import
 * here), same DI (`getClient`) convention `loaders/invites.ts`/
 * `loaders/students.ts`/`loaders/seasons.ts` already established.
 *
 * -----------------------------------------------------------------------
 * Trap #1 (load, `hasStudentsOrHistory`) -- investigated, documented finding:
 * `TeamsTab.tsx`'s own already-Passed module doc #3 (T026) already defines
 * the gate concretely: "A team blocks hard-delete if ANY `students.team_id`
 * row references it -- active OR inactive; ... even a deactivated student
 * who was once on the team counts as history." Nothing about `is_active` is
 * part of that definition, and `students.team_id` is never nulled out when a
 * student is deactivated (`students.is_active` is a wholly separate boolean
 * column, `supabase/migrations/20260716000000_identity_roster.sql` line 65 --
 * deactivating a student does not move or clear their `team_id`). There is
 * no other table anywhere in the schema that independently records
 * "was once on this team" (no `attendance`/`audit_log` row carries a
 * `team_id` column at all -- both are scoped to `session_id`/`student_id` or
 * `entity`/`entity_id` respectively, confirmed by grepping
 * `20260717000000_scheduling_attendance.sql` and
 * `20260717000001_support_audit.sql` directly), so `students.team_id = this
 * team`, queried with NO `is_active` filter, is the complete, correct real
 * query for this gate -- not a scoped-down UI-logic stand-in anymore (T026's
 * own module doc explicitly named that scoping-down as temporary: "this is
 * explicitly a UI-logic proof against fixture data ... that's a future
 * wiring task's job" -- this is that task). `queryStudentTeamLinks` below is
 * exactly that: `select('id, team_id')` with no `.eq('is_active', ...)`.
 *
 * -----------------------------------------------------------------------
 * Trap #2 (reorder persistence) -- DECISION: wired for real, persisted
 * immediately per move (not deferred). `makeSetTeamSortOrders` below takes
 * the exact two `{id, sortOrder}` pairs `TeamsTab.tsx`'s own
 * `computeSortOrderSwap` (new pure helper, module doc there) already
 * computes for one up/down click, and issues two independent
 * `runMutation`-built `teams.sort_order` updates via `Promise.all` (not a
 * single combined update, not a `supabase.rpc(...)` -- grep-provable, no rpc
 * call exists anywhere in this file). Reasoning for choosing "wire it" over
 * "defer it": the packet's own wording treats this as a real option
 * ("decide whether to persist immediately per move or treat it as a
 * lower-priority nice-to-have if genuinely out of reach"), and it is NOT
 * genuinely out of reach -- it is the exact same one-column
 * `runMutation`-update shape `loaders/students.ts`'s own `setStudentActive`
 * and `loaders/seasons.ts`'s own `setActiveSeason` (both real, already
 * Passed) already established, applied twice per move instead of once.
 * `TeamsTab.tsx`'s own `handleMove` pairs this with an optimistic local
 * `moveTeamSortOrder` flip plus rollback-on-rejection, the same
 * optimistic-update-plus-rollback shape used everywhere else in this
 * codebase now (module doc there for the full rollback proof).
 * **Disclosed partial-failure risk**, same class `loaders/seasons.ts`'s own
 * two-step `setActiveSeason` already discloses for itself: the two
 * `sort_order` updates are two independent statements, not one transaction.
 * If the first (`current`'s row) succeeds and the second (`neighbor`'s row)
 * then fails/rejects, the two rows' `sort_order` values would be left
 * inconsistent (one swapped, one not) until a retry. Unlike
 * `setActiveSeason`'s risk (which can violate a real partial-unique-index
 * invariant if left half-done), `teams.sort_order` has NO uniqueness
 * constraint at all (confirmed directly:
 * `20260716000000_identity_roster.sql` line 36, `sort_order integer not
 * null default 0`, no `unique`) -- a half-swapped pair is merely a display
 * ordering glitch (e.g. a duplicate `sort_order` value temporarily, or a
 * value that doesn't match either row's local optimistic state), never a
 * constraint violation, and is corrected the next time either row is
 * reordered or the page is reloaded (which re-fetches the real, authoritative
 * `sort_order` values). `TeamsTab.tsx`'s own rollback (reverting the FULL
 * local `rows` array back to its pre-move snapshot on any rejection, not
 * just re-flipping one row) means a user who sees the reorder fail is shown
 * the pre-move order, not a silently-inconsistent one, even though the two
 * writes themselves aren't atomic.
 *
 * -----------------------------------------------------------------------
 * Trap #3 (local vs. shared type) -- DECISION: `TeamsTab.tsx`'s own local
 * `TeamRow`/`StudentTeamLinkRow` types are KEPT AS-IS (not switched to
 * `../types.ts`'s shared `TeamRow`), same category of decision
 * `loaders/invites.ts` (T087)/`loaders/students.ts` (T089)/`loaders/
 * seasons.ts` (T091) each already made for their own paired page's local
 * types. Two reasons:
 *   1. `TeamsTab.tsx`'s local `TeamRow` is used to build `TeamDisplayRow`,
 *      which `extends Record<string, unknown>` (required by `Table`'s own
 *      generic constraint, astryx-api.md "Table" Props table `data: T[]`).
 *      `../types.ts`'s shared `TeamRow` does not extend that, and
 *      `../types.ts` is a forbidden/read-only file for this task, so it
 *      cannot be changed to add it.
 *   2. The shared `TeamRow` additionally carries `createdAt`
 *      (`teams.created_at`), a column `TeamsTab.tsx` never displays or
 *      otherwise needs -- same "always-unused extra field" reasoning T087/
 *      T089/T091 already applied to their own paired shared-type field
 *      (`invitedBy`/`createdAt`/`createdAt` respectively).
 * `mapTeamDbRowToTeamRow` below is the "loader maps DB rows into the local
 * type explicitly" half of that decision -- the one place `created_at` is
 * dropped, disclosed, not silent. `StudentTeamLinkRow` has no shared-type
 * counterpart at all (it was always a page-local minimal FK projection, per
 * T026's own module doc #3) -- there is no decision to make there, only a
 * mapping to write.
 *
 * -----------------------------------------------------------------------
 * `public.teams`' RLS (`supabase/migrations/20260717000002_rls.sql`,
 * read-only reference, not imported here): `staff_all` grants admin/coach
 * full read/write; `read_all` additionally grants every authenticated user
 * read access. `public.students`' RLS: `staff_all` grants admin/coach full
 * read/write (the only policy this file's `queryStudentTeamLinks` below
 * relies on -- `TeamsTab` only ever renders for admin/coach, same
 * `RequireRole`-gated posture `StudentsTab.tsx`/`ParentsTab.tsx` already
 * establish, `RosterShell.tsx` forbidden/read-only reference), so a real
 * empty result for either query is "none exist yet", not an RLS-caused
 * false-empty. Same reasoning every prior `loaders/*.ts` file in this
 * directory already applied.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { createLoader, runMutation, type LoaderQueryResult } from '../loader';
import { getSupabaseClient } from '../client';
import type {
  CreateTeamFn,
  HardDeleteTeamFn,
  LoadTeamsTabDataFn,
  SetTeamArchivedFn,
  SetTeamSortOrdersFn,
  StudentTeamLinkRow,
  TeamFormValues,
  TeamRow,
  TeamsTabLoadResult,
  UpdateTeamFn,
} from '../../../pages/roster/TeamsTab';

/**
 * Raw `public.teams` row exactly as Postgrest returns it (snake_case) --
 * `supabase/migrations/20260716000000_identity_roster.sql` lines 29-38,
 * cited in full already in `../types.ts`'s own `TeamRow` doc comment (not
 * re-cited here).
 */
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

/** Minimal raw projection of `public.students` -- only `id`/`team_id`, per
 * Trap #1's `StudentTeamLinkRow` mapping above. */
interface StudentTeamLinkDbRow {
  id: string;
  team_id: string;
}

/** `created_at` deliberately dropped -- Trap #3 decision above. */
function mapTeamDbRowToTeamRow(row: TeamDbRow): TeamRow {
  return {
    id: row.id,
    name: row.name,
    shortName: row.short_name,
    program: row.program as TeamRow['program'],
    color: row.color,
    archived: row.archived,
    sortOrder: row.sort_order,
  };
}

function mapStudentTeamLinkDbRowToStudentTeamLinkRow(
  row: StudentTeamLinkDbRow,
): StudentTeamLinkRow {
  return { studentId: row.id, teamId: row.team_id };
}

async function queryTeams(client: SupabaseClient): Promise<LoaderQueryResult<TeamDbRow[]>> {
  const result = await client.from('teams').select('*').order('sort_order', { ascending: true });
  return { data: (result.data as TeamDbRow[] | null) ?? null, error: result.error };
}

/** Trap #1's literal query -- no `is_active` filter, every student row
 * (active or inactive) counts as "history" for the team it references. */
async function queryStudentTeamLinks(
  client: SupabaseClient,
): Promise<LoaderQueryResult<StudentTeamLinkDbRow[]>> {
  const result = await client.from('students').select('id, team_id');
  return { data: (result.data as StudentTeamLinkDbRow[] | null) ?? null, error: result.error };
}

/**
 * `getClient` is injectable (defaults to the shared singleton), same
 * convention every prior `loaders/*.ts` file in this directory already
 * established, so tests can supply a stubbed transport with zero real
 * network calls.
 */
export function makeLoadTeamsTabData(
  getClient: () => SupabaseClient = getSupabaseClient,
): LoadTeamsTabDataFn {
  const loadTeamRows = createLoader<void, TeamDbRow[]>(queryTeams, getClient);
  const loadLinkRows = createLoader<void, StudentTeamLinkDbRow[]>(queryStudentTeamLinks, getClient);
  return async (): Promise<TeamsTabLoadResult> => {
    const [teamRows, linkRows] = await Promise.all([loadTeamRows(), loadLinkRows()]);
    return {
      teams: (teamRows ?? []).map(mapTeamDbRowToTeamRow),
      studentTeamLinks: (linkRows ?? []).map(mapStudentTeamLinkDbRowToStudentTeamLinkRow),
    };
  };
}

/** Default `loadData` for `TeamsTab.tsx` -- real query against both tables. */
export const loadTeamsTabData: LoadTeamsTabDataFn = makeLoadTeamsTabData();

/**
 * `TeamsTab.tsx`'s own default `onCreateTeam`. Never writes `id` (DB-
 * generated) or `archived` (a brand-new team is never created already
 * archived -- archiving is a separate, explicit `onSetTeamArchived` action,
 * same "never create already in the destructive/reversible-flip state"
 * posture `loaders/seasons.ts`'s own `createSeason` already established for
 * `is_active`). `sortOrder` IS written on create (unlike `id`/`archived`) --
 * `TeamsTab.tsx`'s own `handleSave` computes the next `sortOrder`
 * client-side (same `Math.max(...) + 1` logic the pre-T094 `withCreatedTeam`
 * already used locally) and passes it through explicitly, since there is no
 * DB default that means "after every existing row." Resolves the full,
 * freshly-written row (`.select().single()`) so `TeamsTab.tsx` can merge the
 * real DB-assigned `id` into local state without a full reload -- same
 * discipline `loaders/students.ts`'s `createStudent`/`loaders/seasons.ts`'s
 * `createSeason` already establish.
 */
export function makeCreateTeam(getClient: () => SupabaseClient = getSupabaseClient): CreateTeamFn {
  const mutate = runMutation<{ payload: TeamFormValues; sortOrder: number }, TeamDbRow>(
    (client, args) =>
      client
        .from('teams')
        .insert({
          name: args.payload.name,
          short_name: args.payload.shortName,
          program: args.payload.program,
          color: args.payload.color,
          sort_order: args.sortOrder,
        })
        .select()
        .single(),
    getClient,
  );
  return async (payload, sortOrder) => mapTeamDbRowToTeamRow(await mutate({ payload, sortOrder }));
}

/** Default `onCreateTeam` for `TeamsTab.tsx`. */
export const createTeam: CreateTeamFn = makeCreateTeam();

/**
 * `TeamsTab.tsx`'s own default `onUpdateTeam`. Never touches
 * `archived`/`sort_order`/`id` -- only `onSetTeamArchived`/
 * `onSetTeamSortOrders` are ever allowed to change those (mirrors
 * `loaders/seasons.ts`'s own `updateSeason` "deliberately never touches
 * `is_active`" rule).
 */
export function makeUpdateTeam(getClient: () => SupabaseClient = getSupabaseClient): UpdateTeamFn {
  const mutate = runMutation<{ id: string; payload: TeamFormValues }, TeamDbRow>(
    (client, args) =>
      client
        .from('teams')
        .update({
          name: args.payload.name,
          short_name: args.payload.shortName,
          program: args.payload.program,
          color: args.payload.color,
        })
        .eq('id', args.id)
        .select()
        .single(),
    getClient,
  );
  return async (id, payload) => mapTeamDbRowToTeamRow(await mutate({ id, payload }));
}

/** Default `onUpdateTeam` for `TeamsTab.tsx`. */
export const updateTeam: UpdateTeamFn = makeUpdateTeam();

/**
 * `TeamsTab.tsx`'s own default `onSetTeamArchived` -- the ONLY place this
 * module ever writes `teams.archived`. Used for BOTH archive (`true`) and
 * unarchive (`false`), same single-mutation-both-directions shape
 * `loaders/students.ts`'s own `setStudentActive` already established for
 * `students.is_active`.
 */
export function makeSetTeamArchived(
  getClient: () => SupabaseClient = getSupabaseClient,
): SetTeamArchivedFn {
  const mutate = runMutation<{ id: string; archived: boolean }, void>(
    (client, args) => client.from('teams').update({ archived: args.archived }).eq('id', args.id),
    getClient,
  );
  return async (id, archived) => {
    await mutate({ id, archived });
  };
}

/** Default `onSetTeamArchived` for `TeamsTab.tsx`. */
export const setTeamArchived: SetTeamArchivedFn = makeSetTeamArchived();

/**
 * `TeamsTab.tsx`'s own default `onHardDeleteTeam` -- a genuine
 * `delete().eq('id', id)`, the ONLY place this module ever removes a
 * `teams` row. `TeamsTab.tsx`'s own `canHardDelete`/`hasStudentsOrHistory`
 * gate is already enforced client-side before this is ever called (module
 * doc #2 of that file); this mutation itself adds no additional guard --
 * `students.team_id references public.teams (id) on delete restrict`
 * (`20260716000000_identity_roster.sql` line 63) means the DATABASE ITSELF
 * would reject a delete for a team that genuinely still has student rows
 * (a real FK `restrict`, not just this UI's own gate), surfacing as an
 * ordinary rejected `SupabaseLoaderError` if a race ever lets a stale,
 * already-invalid client-side gate through -- `TeamsTab.tsx`'s own
 * `handleConfirmHardDelete` catches and surfaces that like any other
 * mutation failure, never silently swallowed.
 */
export function makeHardDeleteTeam(
  getClient: () => SupabaseClient = getSupabaseClient,
): HardDeleteTeamFn {
  const mutate = runMutation<string, void>(
    (client, id) => client.from('teams').delete().eq('id', id),
    getClient,
  );
  return async (id) => {
    await mutate(id);
  };
}

/** Default `onHardDeleteTeam` for `TeamsTab.tsx`. */
export const hardDeleteTeam: HardDeleteTeamFn = makeHardDeleteTeam();

/**
 * `TeamsTab.tsx`'s own default `onSetTeamSortOrders` -- Trap #2's real
 * reorder persistence. Takes the exact two `{id, sortOrder}` pairs
 * `computeSortOrderSwap` (`TeamsTab.tsx`) already computed for one up/down
 * click, and issues that many independent single-column `teams.sort_order`
 * updates via `Promise.all` (never a single combined update, never a
 * `supabase.rpc(...)`) -- see Trap #2's module doc above for the disclosed
 * non-atomic-pair partial-failure risk.
 */
export function makeSetTeamSortOrders(
  getClient: () => SupabaseClient = getSupabaseClient,
): SetTeamSortOrdersFn {
  const mutate = runMutation<{ id: string; sortOrder: number }, void>(
    (client, args) => client.from('teams').update({ sort_order: args.sortOrder }).eq('id', args.id),
    getClient,
  );
  return async (updates) => {
    await Promise.all(updates.map((update) => mutate(update)));
  };
}

/** Default `onSetTeamSortOrders` for `TeamsTab.tsx`. */
export const setTeamSortOrders: SetTeamSortOrdersFn = makeSetTeamSortOrders();
