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
  HomeEventRow,
  HomeRsvpRow,
  HomeSessionRow,
  LoadStudentHomeDataFn,
  ResolveStudentScopeFn,
  StudentHomeData,
  StudentParticipationMetric,
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

/* ==========================================================================
 * GAM-340 (Part 1) -- the `student_teams` writer.
 *
 * Until this change the roster had NO writer for `student_teams` at all: the
 * only application access to that table anywhere in `src/` was the read at
 * `queryActiveTeamIdsByStudentId` above. Every student created or re-teamed
 * through the roster since 2026-07-21 therefore drifted away from
 * `20260721000000_student_teams.sql`'s one-time backfill, and since
 * 2026-08-06 that drift is user-visible: `v_student_participation`
 * INNER-joins `student_teams`
 * (`20260806000000_met01_explicit_marks.sql:109`, `join student_teams st on
 * st.student_id = s.id and st.left_on is null`) and uses `st.team_id` again
 * at `:114` in the `e.team_ids` predicate, so a membership-less student
 * produces zero participation rows rather than a 0%.
 *
 * Application code only -- no migration, no schema change, no RLS change.
 *
 * -------------------------------------------------------------------------
 * (a) UPSERT, never INSERT. `student_teams`' primary key is `(student_id,
 * team_id)` (`20260721000000_student_teams.sql:19-26`), and that migration
 * states the intended semantics verbatim: "re-joining a team after leaving is
 * a future UPDATE of `left_on` back to null, not a new row." A student who
 * leaves team A, joins B, then returns to A must therefore REACTIVATE the
 * existing `(student, A)` row; a plain `insert` raises
 * `duplicate key value violates unique constraint "student_teams_pkey"`
 * (SQLSTATE 23505 -- measured on a real cluster during this issue's premise
 * gate) and the roster edit fails outright.
 *
 * (b) THE UPSERT PAYLOAD DELIBERATELY OMITS `joined_on`. Measured through a
 * real `postgrest/postgrest` container against a row seeded `joined_on =
 * 2026-01-05, left_on = 2026-06-30`, the payload below generates:
 *
 *   ON CONFLICT("student_id","team_id") DO UPDATE SET
 *     "left_on" = EXCLUDED."left_on",
 *     "student_id" = EXCLUDED."student_id",
 *     "team_id" = EXCLUDED."team_id"
 *
 * leaving `joined_on` at 2026-01-05 and setting `left_on` to null. The
 * counterfactual -- the same request WITH `joined_on` in the payload -- adds
 * `"joined_on" = EXCLUDED."joined_on"` to that `DO UPDATE SET` list and
 * resets the date. Omitting the column is what preserves an existing row's
 * join date, while a brand-new row still takes the column's own
 * `default current_date`. Do not "complete" this payload.
 *
 * (c) CLOSE ONLY THE PREVIOUS PRIMARY TEAM -- never every non-matching
 * membership. The schema is deliberately multi-team (`students.team_id` is
 * the LEGACY primary column only; `StudentHome.tsx:274` and `parentHome.ts`
 * both exercise dual ACTIVE memberships, and `tests/rls/gam299_seed.sql`
 * fixtures one). The roster edit form carries exactly ONE `teamId`, so a
 * writer that closed every active membership whose `team_id` differs from
 * the new one would silently delete a dual-team student's legitimate second
 * team -- turning a participation-gap fix into a participation-LOSS bug in
 * precisely the population the junction table exists for. Hence the close
 * below filters POSITIVELY on `team_id = previousTeamId`. Never `.neq()`.
 *
 * (d) THE UNCONDITIONAL UPSERT ON AN UNCHANGED TEAM IS INTENTIONAL, AND SO
 * IS ITS ONE ODD CONSEQUENCE. `makeUpdateStudent` upserts `payload.teamId`
 * even when the team did not change, so that an edit to any field reconciles
 * a membership-less student. That also re-opens a membership somebody
 * deliberately closed while `students.team_id` still names that same team --
 * configuration (a) of `20260812000000_events_rls_active_membership_read.sql
 * :85-89`. This is accepted, not a bug to guard: a row saying "left team X"
 * while the roster says "is on team X" is contradictory data, and the roster
 * is the source of truth for a student's current team. Note the claim is
 * positive only -- "is on X", never "and only X" -- which is why it does not
 * contradict (c): it authorises OPENING X, never closing anything else. A
 * guard of the form "upsert only if no ACTIVE row exists" was evaluated and
 * rejected because it does not prevent this case at all (in configuration
 * (a) there IS no active row for the pair, so the guarded upsert fires
 * anyway) -- it would add a read and change nothing.
 *
 * (e) THESE WRITES ARE NOT ATOMIC, AND THAT IS A KNOWN RISK RATHER THAN A
 * DEFECT SOLVED HERE. They are separate PostgREST statements issued from a
 * browser; there is no transaction. So the ORDER is load-bearing -- the
 * `students` write goes first, so the roster surface never shows a student
 * whose base row failed to save -- and a membership failure is allowed to
 * THROW through `runMutation`'s existing `toLoaderError` path. It is never
 * swallowed: a silent catch here would recreate the exact invisible-drift
 * defect this change exists to fix. A trigger or an RPC would be atomic and
 * is the better long-term answer; it is excluded here because it is a
 * migration, which constitution item 16 reserves for the owner, and the
 * whole value of Part 1 is that it needs no migration applied.
 *
 * One measured caveat on "let it throw": an RLS-filtered `UPDATE` does not
 * raise, it returns `UPDATE 0` silently, so the close cannot be relied on to
 * throw for an actor without staff rights. That is unreachable in production
 * and needs no defensive code -- `/roster` is gated by
 * `RequireRole allowedRoles={['coach','admin']}` (`RosterShell.tsx:236`) and
 * `is_staff()` is true for a `coach` profile.
 *
 * (f) THIS WRITER DOES NOT REPAIR EITHER ALREADY-BROKEN POPULATION, and
 * cannot: a code change does not retroactively fix existing rows. Students
 * with NO membership row gain a correct one the next time they are edited.
 * Students carrying a STALE ACTIVE row for a team they already left keep it
 * -- the close below targets the previous `students.team_id`, for which such
 * a student has no row at all, and from the application their stale row is
 * indistinguishable from a legitimate second team. They gain a correct row
 * and keep an incorrect one, which is an improvement, not a repair. Both
 * backfills are owner calls filed as their own issues.
 * ==========================================================================
 */

/**
 * `left_on` for a close -- a UTC-derived `YYYY-MM-DD` date string.
 *
 * NOT `current_date`: PostgREST accepts only JSON values, not SQL
 * expressions. UTC is chosen over America/Chicago deliberately, matching the
 * two existing in-repo derivations of "today" for a `date` column
 * (`ScheduleMeetingsDialog.tsx:369`, `OutreachEventDialog.tsx:699,710`);
 * introducing a second, Chicago-derived date convention for one column would
 * be the larger inconsistency.
 *
 * The drift is stated rather than hidden: a close stamped between 19:00 and
 * midnight Chicago time records the FOLLOWING day. That is inert today --
 * every consumer of `left_on` in this repo tests `left_on is null` and none
 * performs date arithmetic on the value. If a consumer ever reads the value
 * itself, revisit this.
 */
function membershipCloseDate(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Opens -- or re-opens -- exactly one `(student_id, team_id)` membership.
 * See (a), (b) and (d) of the GAM-340 block above for why this is an upsert,
 * why `joined_on` is absent, and why it is unconditional.
 */
function makeOpenStudentTeamMembership(getClient: () => SupabaseClient) {
  return runMutation<{ studentId: string; teamId: string }>(
    (client, args) =>
      client
        .from('student_teams')
        .upsert(
          { student_id: args.studentId, team_id: args.teamId, left_on: null },
          { onConflict: 'student_id,team_id' },
        ),
    getClient,
  );
}

/**
 * Closes exactly ONE membership: the student's ACTIVE row for the team they
 * are leaving. Filtered positively on `team_id` -- see (c) above. `.neq()` is
 * never used here, and the `.is('left_on', null)` predicate is the same
 * ACTIVE test every already-migrated reader uses.
 */
function makeCloseStudentTeamMembership(getClient: () => SupabaseClient) {
  return runMutation<{ studentId: string; teamId: string }>(
    (client, args) =>
      client
        .from('student_teams')
        .update({ left_on: membershipCloseDate() })
        .eq('student_id', args.studentId)
        .eq('team_id', args.teamId)
        .is('left_on', null),
    getClient,
  );
}

/**
 * GAM-340 -- the previous-team read-back for `makeUpdateStudent`.
 * `UpdateStudentFn`'s signature is `(id, payload)` and carries no previous
 * team, so the writer resolves it rather than having it threaded in from
 * `StudentsTab.tsx`'s call site. That is a deliberate choice, measured:
 * threading `editTarget.teamId` from an already-stale browser snapshot does
 * not close the wrong team, it fails to close ANY team, and in one of the two
 * concurrent-edit scenarios it leaves a team ACTIVE with nobody on it -- i.e.
 * it re-creates the very drift population this change exists to eliminate.
 * The read-back produces the roster-consistent state in both scenarios, for
 * one extra round trip.
 */
interface StudentTeamIdDbRow {
  team_id: string;
}

async function queryStudentTeamIdById(
  client: SupabaseClient,
  studentId: string,
): Promise<LoaderQueryResult<StudentTeamIdDbRow>> {
  const result = await client.from('students').select('team_id').eq('id', studentId).single();
  return { data: (result.data as StudentTeamIdDbRow | null) ?? null, error: result.error };
}

/**
 * Known Context/Traps #6 -- real `students` insert. Never writes
 * `profile_id`/`id` (see module doc above). Resolves the freshly-written row
 * so the caller can merge it into local state without a full reload.
 *
 * GAM-340: also opens the new student's `student_teams` membership for
 * `payload.teamId`, AFTER the `students` insert resolves (that insert already
 * does `.select().single()`, so the DB-assigned id is in hand). The return
 * value is unchanged -- still the mapped `StudentRow` from the `students`
 * insert -- and so is `CreateStudentFn`'s signature.
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
  const openMembership = makeOpenStudentTeamMembership(getClient);
  return async (payload) => {
    const row = await mutate(payload);
    // Deliberately NOT wrapped in a try/catch -- see (e) above.
    await openMembership({ studentId: row.id, teamId: payload.teamId });
    return mapStudentDbRowToStudentRow(row);
  };
}

/** Default `onCreateStudent` for `StudentsTab.tsx`. */
export const createStudent: CreateStudentFn = makeCreateStudent();

/**
 * Known Context/Traps #6 -- real `students` update by id. Never writes
 * `profile_id`/`id`.
 *
 * GAM-340: also moves the student's `student_teams` membership. Ordered
 * read-back -> `students` update -> close (only when the team actually
 * changed, and only for the previous team) -> open. See the GAM-340 block
 * above for every decision in that sentence.
 */
export function makeUpdateStudent(
  getClient: () => SupabaseClient = getSupabaseClient,
): UpdateStudentFn {
  const loadPreviousTeamId = createLoader<string, StudentTeamIdDbRow>(
    queryStudentTeamIdById,
    getClient,
  );
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
  const closeMembership = makeCloseStudentTeamMembership(getClient);
  const openMembership = makeOpenStudentTeamMembership(getClient);
  return async (id, payload) => {
    // Read BEFORE the update -- afterwards `students.team_id` is already the
    // new team and the previous one is unrecoverable.
    const previous = await loadPreviousTeamId(id);
    const row = await mutate({ id, payload });
    const previousTeamId = previous?.team_id ?? null;
    if (previousTeamId !== null && previousTeamId !== payload.teamId) {
      await closeMembership({ studentId: id, teamId: previousTeamId });
    }
    // Unconditional -- fires on an unchanged team too, see (d) above.
    await openMembership({ studentId: id, teamId: payload.teamId });
    return mapStudentDbRowToStudentRow(row);
  };
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
 * RLS -- **T186 CORRECTION. The premise this paragraph was originally
 * written on is wrong, and the correction makes the conclusion stronger,
 * not weaker.** The migration's own header (`dashboard_views.sql:49-52`)
 * states none of its views are `security_definer`/`security_barrier`, "so
 * each runs under the querying session's own RLS against its base tables".
 * That sentence is wrong as written, and this comment repeated it.
 * `security_definer` is a **function** attribute; the view-level knob is
 * `security_invoker` (PG15+), which defaults **OFF** and appears zero times
 * in `supabase/`. So `v_student_goal_projection` executes as its OWNER and
 * does NOT apply the calling session's RLS to its base tables at all.
 *
 * This is **measured, not reasoned** -- unusually for this codebase, the
 * mechanism has a live experiment behind it:
 * `20260731000000_leaderboard_students_view.sql:32-46` records a scratch
 * PGlite/PostgreSQL run with a non-superuser view owner shaped like
 * Supabase's migration-applying role, in which a student-role session
 * reading a view got every active student's row while the same session
 * reading the base table directly got exactly its own one row, and a
 * `security_invoker=on` counterfactual collapsed both back to one row.
 *
 * **Nothing here changes behaviour, and the exposure is owner-ruled
 * intended** (T185, closed no-change on the owner's 2026-07-30
 * proportionality ruling; constitution item 4 is about TABLES, and every
 * table has policies). The per-base-table composition below is KEPT
 * because it is what makes the read safe under `security_invoker=on` too,
 * i.e. it is the argument that survives if this schema ever adopts the
 * invoker semantics -- but note it is currently belt-and-braces, not the
 * operative mechanism. For a `student`-role caller reading their own
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
 * genuinely resolves, not an RLS-caused false-empty -- and under the
 * owner-execution semantics actually in force, it resolves regardless.
 *
 * (T186 also retires this paragraph's original closing caveat, which said
 * the composition "has no DIRECT precedent elsewhere in this codebase to
 * point to as a live-tested example" and asked a checker to confirm it.
 * That is now stale in the half that matters: the view-owner RLS-bypass
 * MECHANISM is live-tested, at the leaderboard migration cited above. What
 * remains untested is only the `security_invoker=on` counterfactual
 * composition, which no code path currently depends on.)
 *
 * A brand-new interface (`StudentGoalProjectionDbRow`), not a reuse of the
 * existing module-private `StudentDbRow` above -- this task's own packet
 * forbids touching that interface's shape, and this query reads a
 * different table (a view, not `students` directly) with a disjoint
 * column set.
 */
interface StudentGoalProjectionDbRow {
  /* T802 -- `team_id` is NO LONGER SELECTED from this view here, and the
   * field is gone from this row type.
   *
   * The chain it fed was dead end-to-end: `v_student_goal_projection.team_id`
   * -> `StudentScope.teamId` -> `ResolvedStudentIdentity.teamId` -> nothing.
   * T176 wired it through and `StudentHome.tsx` used it for FUNCTIONAL team
   * scoping, which was a real defect for dual-team students; T187 fixed that
   * by moving every scope predicate onto `teamIds` (ACTIVE `student_teams`
   * memberships) and kept `teamId` only for shape stability.
   *
   * Removing the whole chain rather than just its last link is deliberate:
   * dropping only `ResolvedStudentIdentity.teamId` would have left
   * `StudentScope.teamId` written-and-unread, relocating the same hazard one
   * layer down instead of removing it. The hazard was never the field's
   * existence -- it was a plainly-named, already-populated value that a
   * future reader would reasonably mistake for the right answer.
   *
   * This view is now read here for hours only. `loaders/dashboard.ts:387`
   * remains a real reader of `team_id` for its display badge -- that one is
   * untouched and still correct.
   */
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
    .select('goal_hours, confirmed_hours, planned_hours')
    .eq('student_id', studentId)
    .maybeSingle();
  return { data: (result.data as StudentGoalProjectionDbRow | null) ?? null, error: result.error };
}

/**
 * T187 -- the student's ACTIVE `student_teams` memberships (`StudentScope`'s
 * new `teamIds` field, `StudentHome.tsx`'s own module doc for the full
 * record). `left_on is null` is the ACTIVE predicate every already-migrated
 * reader uses (`membership_views.sql:63`/`:92`, `dashboard_views.sql:205-206`);
 * `.is('left_on', null)` has in-repo precedent (`calendarFeed.ts:103`,
 * `endMeeting.ts:398`). RLS -- `student_teams` carries `read_all for select
 * to authenticated using (true)` (`20260721000000_student_teams.sql:86`), so
 * a signed-in student's own query for their own `studentId` resolves
 * unconditionally; the explicit `.eq('student_id', studentId)` filter below
 * is still supplied (defense in depth, same convention every other query in
 * this file already follows), not relied on RLS alone.
 */
interface StudentActiveTeamIdDbRow {
  team_id: string;
}

async function queryActiveTeamIdsByStudentId(
  client: SupabaseClient,
  studentId: string,
): Promise<LoaderQueryResult<StudentActiveTeamIdDbRow[]>> {
  const result = await client
    .from('student_teams')
    .select('team_id')
    .eq('student_id', studentId)
    .is('left_on', null);
  return { data: (result.data as StudentActiveTeamIdDbRow[] | null) ?? null, error: result.error };
}

/**
 * `getClient` is injectable (defaults to the shared singleton), same
 * convention every export above already established, so tests can supply a
 * stubbed transport with zero real network calls -- see this task's own new
 * `students.test.ts` (scoped to this one function only -- NOT a full
 * coverage sweep of this file, which no ledger row currently claims, per
 * this task's own packet disclosure).
 *
 * T187 -- the `student_teams` read (`loadActiveTeamIds`) is deliberately
 * SEQUENTIAL, after `loadScope`, not parallel via `Promise.all`: when
 * `loadScope` resolves `null` (no `v_student_goal_projection` row -- an
 * inactive student or no active season), this function already returns
 * `null` overall and the active-team-ids read would be discarded unused --
 * skipping it here is a genuine, disclosed efficiency win (one fewer real
 * network round trip for that case), not a workaround shaped around any
 * test.
 */
export function makeResolveStudentScope(
  getClient: () => SupabaseClient = getSupabaseClient,
): ResolveStudentScopeFn {
  const loadScope = createLoader<string, StudentGoalProjectionDbRow>(
    queryStudentGoalProjectionById,
    getClient,
  );
  const loadActiveTeamIds = createLoader<string, StudentActiveTeamIdDbRow[]>(
    queryActiveTeamIdsByStudentId,
    getClient,
  );
  return async (studentId: string) => {
    const row = await loadScope(studentId);
    if (row === null) return null;
    const activeTeamRows = await loadActiveTeamIds(studentId);
    // Verbatim passthrough (constitution item 3) -- `goal_hours` is already
    // the coalesced value; no coalesce/override arithmetic happens here.
    return {
      teamIds: (activeTeamRows ?? []).map((teamRow) => teamRow.team_id),
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
 * untouched, still exported for tests). Per that task's own scope ruling,
 * every OTHER `StudentHomeData` field was left an honest literal empty value
 * (`[]`/`null`/`0`) -- no new queries for events/sessions/rsvps/hours/
 * participation -- and the real implementation of that rest-of-the-seam was
 * filed as its own separate follow-up.
 *
 * **T199 IS THAT FOLLOW-UP, and it has landed** -- `events`/`sessions`/
 * `rsvps`/`participation` are real queries now; see the T199 doc block below
 * `queryStudentDisplayNameById`. Three fields DO remain literals
 * (`defaultGoalHours`/`goalHoursOverride`/`studentHours`), for a different
 * and narrower reason than T183's: the render path provably does not read
 * them (T176 round 2 moved those three numbers onto props). The sentence
 * above is kept in past tense rather than deleted, so T183's own narrowing
 * decision stays legible.
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

/* ==========================================================================
 * T199 -- the rest of `StudentHome`'s seam. Real `events`/`sessions`/`rsvps`/
 * `participation` reads, replacing the four honest-empty literals T183
 * deliberately left behind (its own narrowing is quoted in the doc block
 * above; this is the follow-up that block's last paragraph points at).
 *
 * -------------------------------------------------------------------------
 * (1) WHAT WAS ACTUALLY BROKEN. Not a crash -- the page rendered fine and
 * every section was simply, permanently empty. Traced through the render
 * path, the four literals cost exactly five on-screen surfaces
 * (`StudentHome.tsx`):
 *
 *   `data.events`/`sessions`/`rsvps` feed `selectLiveMeetingSession`
 *   (`:1403`), `buildNextUp` (`:1404`) and
 *   `getUnansweredOutreachOpportunities` (`:1405`). With all three inputs
 *   `[]`:
 *     - "Next up" always rendered its "Nothing scheduled" `EmptyState`,
 *     - "Sign-up opportunities" always rendered "You're all caught up",
 *     - `liveSession` was always `null`, so the live check-in hero could
 *       never appear -- a student physically at a meeting had no way to
 *       check in from Home,
 *     - `selectHeroState(false, 0)` therefore always returned
 *       `'quiet-greeting'`, so the hero was permanently the "You're all
 *       caught up. Nothing needs your attention right now." line.
 *   `data.participation` feeds `:1471`, which rendered `Participation: —`
 *   for every student in every state.
 *
 * -------------------------------------------------------------------------
 * (2) NO SIGNATURE CHANGE, and team scope deliberately stays CLIENT-side.
 *
 * `LoadStudentHomeDataFn` is `(studentId, seasonId)` -- no team parameter.
 * That is kept, and the `events` read below is SEASON-scoped rather than
 * team-scoped, because `StudentHome.tsx` already owns the team predicate:
 * `isEventInTeamScope` (`:686`, its own comment: *"The ONLY team-scope
 * predicate in this file"*) is applied inside all three consumers listed
 * above, against the `teamIds` the page resolves separately via
 * `resolveStudentScope`. Filtering server-side too would mean a SECOND
 * implementation of "in scope" -- in PostgREST array syntax, against a
 * different team source -- that could drift from the page's. One predicate,
 * in one place, is the smaller and safer shape, and it needs no change to
 * the shared function type (so no `StudentHome.test.tsx`/
 * `DashboardPage.test.tsx` stub churn either).
 *
 * -------------------------------------------------------------------------
 * (3) DISCLOSED LIMIT -- RLS scopes these rows by the LEGACY
 * `students.team_id`, while the page scopes by ACTIVE `student_teams`.
 *
 * `supabase/migrations/20260717000002_rls.sql:153-161`, quoted verbatim:
 * ```sql
 * create policy own_or_linked_read on events
 *   for select to authenticated
 *   using (
 *     exists (
 *       select 1 from students s
 *       where s.id in (select my_student_ids())
 *         and (events.team_ids is null or s.team_id = any(events.team_ids))
 *     )
 *   );
 * ```
 * `event_sessions`'s own policy (`:180-188`) inherits the same test through
 * `event_id`. Both read `s.team_id` -- the single legacy primary-team
 * column. T187 moved this PAGE onto `student_teams` (`StudentScope.teamIds`,
 * `makeResolveStudentScope` above), and the two sources disagree for a
 * DUAL-TEAM student: an event scoped to `team_ids = {their SECOND team}`
 * passes the page's `isEventInTeamScope` but is filtered out by RLS before
 * it ever arrives, so that student silently misses their second team's
 * meetings and outreach.
 *
 * This is pre-existing (T187 created the divergence; the policies predate
 * it) and it is NOT fixable here -- it needs a migration, which per
 * constitution item 16 the owner applies. **T199 makes it observable for
 * the first time**: until now the page had no rows at all, so nothing could
 * be missing from them. Filed as its own row rather than worked around with
 * a client-side compensation that would hide a policy bug behind a loader.
 * Single-team students -- every student in the system today -- are
 * unaffected, since for them the two sources name the same team.
 *
 * Read from the policy text, which is unambiguous on this point; not
 * measured against a live database.
 *
 * -------------------------------------------------------------------------
 * (4) `studentHours`/`defaultGoalHours`/`goalHoursOverride` stay inert, ON
 * PURPOSE -- and this is not the same call as leaving `events` empty was.
 *
 * Those three fields are not on T199's scope list, and they are provably
 * unread: T176 round 2 moved the page onto `confirmedHours`/`plannedHours`/
 * `goalHours` PROPS sourced from `v_student_goal_projection` via
 * `resolveStudentScope`, and `StudentHome.tsx:1415-1424` states so in its
 * own comment. Querying `v_student_hours` here would add a round trip whose
 * result no pixel depends on -- the same trade T198 weighed on `CoachHome`
 * and resolved the same way. They are inert literals, not empty data.
 * ==========================================================================
 */

/** `events` -- `supabase/migrations/20260717000000_scheduling_attendance.sql:
 * 33-48`. Five columns, exactly `HomeEventRow`'s shape; `counts_volunteer_
 * hours` is included because that interface declares it
 * (`StudentHome.tsx:436`) and `computePlannedHours` reads it. */
interface StudentHomeEventDbRow {
  id: string;
  season_id: string;
  type: HomeEventRow['type'];
  title: string;
  team_ids: string[] | null;
  counts_volunteer_hours: boolean;
}

/** `event_sessions` -- same migration, `:53-63`. */
interface StudentHomeSessionDbRow {
  id: string;
  event_id: string;
  starts_at: string;
  ends_at: string;
  status: HomeSessionRow['status'];
}

/** `rsvps` -- same migration. */
interface StudentHomeRsvpDbRow {
  id: string;
  session_id: string;
  student_id: string;
  status: HomeRsvpRow['status'];
  updated_at: string;
}

/**
 * `v_student_participation`'s seven real columns.
 *
 * `participation_pct` is typed `number | null`, and that is NOT cosmetic --
 * T509 (`20260806000000_met01_explicit_marks.sql`) replaced the view's old
 * `greatest(expected_ct - excused_ct, 1)` floor with an explicit `case ...
 * then null`, so a student whose every mark is `excused` now yields SQL
 * NULL rather than a fabricated `0.0`. The three other loaders that read
 * this view still type this column as non-nullable `number`; that mismatch
 * is T509 fallout, filed as its own row and deliberately not patched from
 * here.
 */
interface StudentHomeParticipationDbRow {
  student_id: string;
  team_id: string;
  season_id: string;
  expected_ct: number;
  present_ct: number;
  late_ct: number;
  excused_ct: number;
  participation_pct: number | null;
}

function mapStudentHomeEvent(row: StudentHomeEventDbRow): HomeEventRow {
  return {
    id: row.id,
    seasonId: row.season_id,
    type: row.type,
    title: row.title,
    // `null` stays `null` -- the real `events.team_ids` "all teams" sentinel
    // (`HomeEventRow`'s own doc), never coerced to `[]`. `isEventInTeamScope`
    // depends on that distinction: `[]` would mean "no team matches".
    teamIds: row.team_ids,
    countsVolunteerHours: row.counts_volunteer_hours,
  };
}

function mapStudentHomeSession(row: StudentHomeSessionDbRow): HomeSessionRow {
  return {
    id: row.id,
    eventId: row.event_id,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    status: row.status,
  };
}

function mapStudentHomeRsvp(row: StudentHomeRsvpDbRow): HomeRsvpRow {
  return {
    id: row.id,
    sessionId: row.session_id,
    studentId: row.student_id,
    status: row.status,
    updatedAt: row.updated_at,
  };
}

/**
 * Collapses a student's `v_student_participation` rows into the single
 * metric `StudentHomeData.participation` declares.
 *
 * WHY THERE CAN BE MORE THAN ONE. The view groups by `(student_id, team_id,
 * season_id)` (`20260806000000_met01_explicit_marks.sql`), so a DUAL-TEAM
 * student has one row per active membership even within a single season.
 * Taking an arbitrary one is a known, already-made mistake: `loaders/
 * meetings.ts:437-446` records `.limit(1)` doing exactly that and being
 * removed for it. So this sums.
 *
 * THE ARITHMETIC IS NOT INVENTED (constitution item 3). It is
 * `v_team_participation`'s own expression, which performs this identical
 * sum-then-recompute over the identical view, quoted verbatim from the same
 * migration:
 * ```sql
 * case
 *   when sum(expected_ct) - sum(excused_ct) = 0 then null
 *   else round(100.0 * sum(present_ct) / (sum(expected_ct) - sum(excused_ct)), 1)
 * end
 * ```
 * Note what that is NOT: `loaders/meetings.ts:504`'s `aggregateParticipation
 * Rows` does the same job with `Math.max(expectedCt - excusedCt, 1)` -- the
 * PRE-T509 floor, which fabricates `0%` in precisely the case the view now
 * returns NULL for. That function is stale, not a model to copy; it is
 * covered by the same T509-fallout row cited on the row type above.
 *
 * NULL ARRIVES AS `null` FOR THE WHOLE FIELD. `StudentParticipationMetric.
 * participationPct` is `number`, and widening it reaches four other files
 * that share the shape (`MeetingsList`, `StudentMeetingView`, `ParentHome`,
 * and their tests) -- T509 fallout again, out of scope here. The screen is
 * unharmed by the narrower choice: `StudentHome.tsx:1471` renders `—` for a
 * `null` participation, which is exactly what "no denominator" should show,
 * and the counts this drops are not rendered anywhere on the page. A future
 * caller that wants the counts needs that widening first.
 */
export function aggregateStudentHomeParticipation(
  rows: readonly StudentHomeParticipationDbRow[],
): StudentParticipationMetric | null {
  if (rows.length === 0) return null;
  const expectedCt = rows.reduce((sum, row) => sum + row.expected_ct, 0);
  const presentCt = rows.reduce((sum, row) => sum + row.present_ct, 0);
  const lateCt = rows.reduce((sum, row) => sum + row.late_ct, 0);
  const excusedCt = rows.reduce((sum, row) => sum + row.excused_ct, 0);
  const denominator = expectedCt - excusedCt;
  if (denominator === 0) return null;
  return {
    studentId: rows[0].student_id,
    // Carries no "the team" meaning for a summed row -- disclosed the same
    // way `aggregateParticipationRows` disclosed it, and unrendered here.
    teamId: rows[0].team_id,
    seasonId: rows[0].season_id,
    expectedCt,
    presentCt,
    lateCt,
    excusedCt,
    // `round(x, 1)` -> `Math.round(x * 10) / 10`; non-negative here, so this
    // matches Postgres `round`'s round-half-away-from-zero behavior.
    participationPct: Math.round(((100.0 * presentCt) / denominator) * 10) / 10,
  };
}

async function queryStudentHomeEvents(
  client: SupabaseClient,
  seasonId: string,
): Promise<LoaderQueryResult<StudentHomeEventDbRow[]>> {
  const result = await client
    .from('events')
    .select('id, season_id, type, title, team_ids, counts_volunteer_hours')
    .eq('season_id', seasonId);
  return { data: (result.data as StudentHomeEventDbRow[] | null) ?? null, error: result.error };
}

async function queryStudentHomeSessions(
  client: SupabaseClient,
  eventIds: readonly string[],
): Promise<LoaderQueryResult<StudentHomeSessionDbRow[]>> {
  const result = await client
    .from('event_sessions')
    .select('id, event_id, starts_at, ends_at, status')
    .in('event_id', eventIds as string[]);
  return { data: (result.data as StudentHomeSessionDbRow[] | null) ?? null, error: result.error };
}

/**
 * Filtered on BOTH `session_id` and `student_id`. The student filter is not
 * redundant with the `own_or_linked_read` RLS policy (`student_id in (select
 * my_student_ids())`): that function unions in `guardian_links`, so a parent
 * profile's session legitimately sees several children's RSVPs. Every
 * consumer on this page already narrows by `rsvp.studentId === studentId`
 * (`buildNextUp`, `getUnansweredOutreachOpportunities`), so an unfiltered
 * read would fetch rows only to discard them -- and would put another
 * student's RSVPs into `StudentHomeData`, where `withLocalRsvpOverride`
 * mutates the array on a "Can't go" click.
 */
async function queryStudentHomeRsvps(
  client: SupabaseClient,
  args: { sessionIds: readonly string[]; studentId: string },
): Promise<LoaderQueryResult<StudentHomeRsvpDbRow[]>> {
  const result = await client
    .from('rsvps')
    .select('id, session_id, student_id, status, updated_at')
    .in('session_id', args.sessionIds as string[])
    .eq('student_id', args.studentId);
  return { data: (result.data as StudentHomeRsvpDbRow[] | null) ?? null, error: result.error };
}

/**
 * SEASON-scoped, unlike `loaders/meetings.ts`'s `queryParticipationRowsFor
 * Student` -- that one is deliberately season-unaware because
 * `LoadStudentMeetingsDataFn` has no season parameter and it sums across
 * seasons as a disclosed fallback (`meetings.ts:448-455`). This signature
 * DOES carry `seasonId`, so the narrower, correct filter is available and is
 * used; multi-season summing never happens here.
 */
async function queryStudentHomeParticipation(
  client: SupabaseClient,
  args: { studentId: string; seasonId: string },
): Promise<LoaderQueryResult<StudentHomeParticipationDbRow[]>> {
  const result = await client
    .from('v_student_participation')
    .select(
      'student_id, team_id, season_id, expected_ct, present_ct, late_ct, excused_ct, participation_pct',
    )
    .eq('student_id', args.studentId)
    .eq('season_id', args.seasonId);
  return {
    data: (result.data as StudentHomeParticipationDbRow[] | null) ?? null,
    error: result.error,
  };
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
  const loadEvents = createLoader<string, StudentHomeEventDbRow[]>(
    queryStudentHomeEvents,
    getClient,
  );
  const loadSessions = createLoader<readonly string[], StudentHomeSessionDbRow[]>(
    queryStudentHomeSessions,
    getClient,
  );
  const loadRsvps = createLoader<
    { sessionIds: readonly string[]; studentId: string },
    StudentHomeRsvpDbRow[]
  >(queryStudentHomeRsvps, getClient);
  const loadParticipation = createLoader<
    { studentId: string; seasonId: string },
    StudentHomeParticipationDbRow[]
  >(queryStudentHomeParticipation, getClient);

  return async (studentId: string, seasonId: string): Promise<StudentHomeData> => {
    // Three independent reads issued together; the events -> sessions ->
    // rsvps chain below is sequential because each stage needs the previous
    // stage's ids (the shape `loaders/coachHome.ts` and `loaders/dashboard.ts`
    // module doc #2 already establish).
    const [row, eventRows, participationRows] = await Promise.all([
      loadRow(studentId),
      loadEvents(seasonId),
      loadParticipation({ studentId, seasonId }),
    ]);

    // Fail loud, never bridged to fixture data -- see module doc above.
    if (row === null) {
      throw new Error('No student record was found for your account.');
    }

    const events = (eventRows ?? []).map(mapStudentHomeEvent);
    const eventIds = events.map((event) => event.id);

    // Empty-`.in(...)` guard (`dashboard.ts` module doc #5) -- a season with
    // no events issues no session query at all, rather than `.in('event_id',
    // [])`, and likewise no sessions issues no rsvp query.
    const sessionRows = eventIds.length > 0 ? await loadSessions(eventIds) : null;
    const sessions = (sessionRows ?? []).map(mapStudentHomeSession);
    const sessionIds = sessions.map((session) => session.id);

    const rsvpRows = sessionIds.length > 0 ? await loadRsvps({ sessionIds, studentId }) : null;

    return {
      seasonId,
      displayName: row.display_name,
      // Inert literals, NOT empty data -- provably unread by the render
      // path (section (4) of this task's doc block above).
      defaultGoalHours: 0,
      goalHoursOverride: null,
      studentHours: null,
      events,
      sessions,
      rsvps: (rsvpRows ?? []).map(mapStudentHomeRsvp),
      participation: aggregateStudentHomeParticipation(participationRows ?? []),
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
