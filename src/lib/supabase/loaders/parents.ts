/**
 * T094 (ED-1 Packet P5): real `profiles`/`guardian_links`/`students`/
 * `invites` data-layer wiring for `src/pages/roster/ParentsTab.tsx`, plus
 * the one real mutation seam that file's own UI (Remove's "unlink" half)
 * never actually had before this task -- see this task's worker packet's
 * own Objective section for the full disclosure of that pre-existing gap.
 * Built directly on top of T086's `createLoader`/`runMutation`
 * (`../loader.ts`, read-only import here), same DI (`getClient`) convention
 * every prior `loaders/*.ts` file in this directory already established.
 * Resend/Revoke are DELIBERATELY NOT reimplemented here -- `ParentsTab.tsx`
 * imports and calls T090's already-correct, already-Passed `resendInvite`/
 * `revokeInvite` (`./invites.ts`) directly (this task's own packet, Trap #3
 * of `ParentsTab.tsx`'s own module doc).
 *
 * -----------------------------------------------------------------------
 * Trap #3 (local vs. shared type) -- DECISION: `ParentsTab.tsx`'s own local
 * `ParentProfileRow`/`GuardianLinkRow`/`StudentRow`/`InviteRow` types are
 * ALL KEPT AS-IS (not switched to `../types.ts`'s shared equivalents), same
 * category of decision `loaders/invites.ts` (T087)/`loaders/students.ts`
 * (T089)/`loaders/seasons.ts` (T091) each already made for their own paired
 * page's local types:
 *   - Shared `ProfileRow` additionally carries `role`/`themeMode`/
 *     `createdAt` -- `ParentProfileRow` only ever needs
 *     `id`/`displayName`/`email`/`avatarUrl` (the `role='parent'` filter is
 *     applied entirely in this file's own `queryParentProfiles` below, never
 *     carried as a display field).
 *   - Shared `GuardianLinkRow` additionally carries `relationship`/
 *     `createdAt` -- `ParentsTab.tsx`'s own module doc #1 already disclosed
 *     `relationship` as "real but unused here."
 *   - Shared `StudentRow` additionally carries `profileId`/`teamId`/
 *     `gradYear`/`isActive`/`goalHoursOverride` -- this page only ever needs
 *     a linked student's `id`/`displayName` (module doc #1: "only
 *     `id`/`display_name` are needed here, to resolve a linked student's
 *     name for its `Avatar`").
 *   - Shared `InviteRow` additionally carries `invitedBy` -- same
 *     already-established "always-unused extra field" reasoning
 *     `loaders/invites.ts`/`loaders/students.ts` already applied to this
 *     exact column.
 * Each `map*DbRowTo*Row` function below is the "loader maps DB rows into the
 * local type explicitly" half of that decision -- the one place each of
 * those unused columns is dropped, disclosed, not silent.
 *
 * -----------------------------------------------------------------------
 * Trap #1 (load) -- four independent `createLoader`s, issued together via
 * `Promise.all`, same shape `loaders/students.ts`'s own `makeLoadStudentsTabData`
 * already established for its own three-table load: no server-side join is
 * needed (the join -- matching a parent to its linked students' names, and
 * grouping invites by email -- already happens client-side, in
 * `ParentsTab.tsx`'s own pure `buildParentDisplayRows`, untouched by this
 * file).
 *
 * `queryParentProfiles` filters `role = 'parent'` server-side
 * (`.eq('role', 'parent')`) -- `ParentsTab.tsx`'s own module doc #1: "A
 * 'parent' with a real account is a `profiles` row with `role = 'parent'`."
 * `public.profiles`' RLS (`supabase/migrations/20260717000002_rls.sql`,
 * read-only reference, not imported here): `profiles_read` grants every
 * authenticated user read access to every profile row (PRD 8.3: "read all"),
 * so this query never returns a false-empty for a genuinely staff-only page
 * -- same "no RLS-caused false-empty" reasoning every prior `loaders/*.ts`
 * file in this directory already applied for its own paired table(s).
 * `public.guardian_links`/`public.students`/`public.invites` each grant
 * admin/coach (`is_staff()`) their own `staff_all` policy; `ParentsTab` only
 * ever renders inside its own `RequireRole(['coach', 'admin'])` gate
 * (`ParentsTab.tsx`'s own module doc #2, `ParentsTabBody` itself is
 * ungated but only ever mounted through that gated wrapper in real use), so
 * every session reaching `loadParentsTabData` below is genuinely staff.
 *
 * -----------------------------------------------------------------------
 * Trap #5 (Remove, profile-backed) -- `unlinkAllStudents` below does exactly
 * one thing: `delete from guardian_links where parent_profile_id = :id`, via
 * `runMutation`. This is the REAL, COMPLETE scope of this file's own
 * contribution to ROS-04's "unlink + deactivate profile" Remove action --
 * see `ParentsTab.tsx`'s own T094 module doc (and this task's worker
 * packet's own Objective section) for the full, explicit disclosure of why
 * "deactivate profile" has no real column to write to and is NOT persisted
 * anywhere by this task. This file contains ZERO writes to `public.profiles`
 * of any kind (grep-provable -- no `.from('profiles')` call anywhere below).
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { createLoader, runMutation, type LoaderQueryResult } from '../loader';
import { getSupabaseClient } from '../client';
import type { InviteStatus as SharedInviteStatus, Role as SharedRole } from '../types';
import type {
  GuardianLinkRow,
  InviteRow,
  LoadParentsTabDataFn,
  ParentProfileRow,
  ParentsTabLoadResult,
  StudentRow,
  UnlinkAllStudentsFn,
} from '../../../pages/roster/ParentsTab';

/**
 * Raw `public.profiles` row exactly as Postgrest returns it (snake_case) --
 * `supabase/migrations/20260716000000_identity_roster.sql` lines 16-24 (plus
 * the `avatar_url` nullability amendment, `20260718000000_invite_trigger.sql`
 * lines 44-45), cited in full already in `../types.ts`'s own `ProfileRow`
 * doc comment (not re-cited here). Only the four fields `ParentProfileRow`
 * actually needs are typed here (Trap #3 decision above) -- `role` is still
 * included so `queryParentProfiles`' own `.eq('role', 'parent')` filter has
 * a real column to reference, even though it is never carried into
 * `ParentProfileRow` itself.
 */
interface ProfileDbRow {
  id: string;
  display_name: string;
  email: string;
  avatar_url: string | null;
}

/** Raw `public.guardian_links` row -- same migration file, lines 72-79. Only
 * the three fields `GuardianLinkRow` needs (Trap #3 decision above). */
interface GuardianLinkDbRow {
  id: string;
  parent_profile_id: string;
  student_id: string;
}

/** Minimal raw projection of `public.students` -- only `id`/`display_name`,
 * per Trap #3's `StudentRow` mapping above. */
interface StudentDbRow {
  id: string;
  display_name: string;
}

/**
 * Raw `public.invites` row -- `supabase/migrations/
 * 20260717000000_scheduling_attendance.sql` lines 18-27. `role`/`status`
 * typed against the SHARED `Role`/`InviteStatus` unions, same convention
 * every prior `loaders/*.ts` file in this directory already established.
 */
interface InviteDbRow {
  id: string;
  email: string;
  role: SharedRole;
  student_id: string | null;
  status: SharedInviteStatus;
  expires_at: string;
  created_at: string;
}

function mapProfileDbRowToParentProfileRow(row: ProfileDbRow): ParentProfileRow {
  return {
    id: row.id,
    displayName: row.display_name,
    email: row.email,
    avatarUrl: row.avatar_url,
  };
}

function mapGuardianLinkDbRowToGuardianLinkRow(row: GuardianLinkDbRow): GuardianLinkRow {
  return { id: row.id, parentProfileId: row.parent_profile_id, studentId: row.student_id };
}

function mapStudentDbRowToStudentRow(row: StudentDbRow): StudentRow {
  return { id: row.id, displayName: row.display_name };
}

/** `invited_by` is deliberately dropped -- Trap #3 decision above (same
 * lossy-but-disclosed mapping every prior `loaders/*.ts` file already
 * established for this exact column). */
function mapInviteDbRowToInviteRow(row: InviteDbRow): InviteRow {
  return {
    id: row.id,
    email: row.email,
    role: row.role,
    studentId: row.student_id,
    status: row.status,
    expiresAt: row.expires_at,
    createdAt: row.created_at,
  };
}

/** Trap #1: server-side `role = 'parent'` filter -- `ParentProfileRow`
 * never carries `role` itself (Trap #3 decision above). */
async function queryParentProfiles(
  client: SupabaseClient,
): Promise<LoaderQueryResult<ProfileDbRow[]>> {
  const result = await client
    .from('profiles')
    .select('id, display_name, email, avatar_url, role')
    .eq('role', 'parent')
    .order('display_name', { ascending: true });
  return { data: (result.data as ProfileDbRow[] | null) ?? null, error: result.error };
}

async function queryGuardianLinks(
  client: SupabaseClient,
): Promise<LoaderQueryResult<GuardianLinkDbRow[]>> {
  const result = await client.from('guardian_links').select('id, parent_profile_id, student_id');
  return { data: (result.data as GuardianLinkDbRow[] | null) ?? null, error: result.error };
}

async function queryStudents(client: SupabaseClient): Promise<LoaderQueryResult<StudentDbRow[]>> {
  const result = await client
    .from('students')
    .select('id, display_name')
    .order('display_name', { ascending: true });
  return { data: (result.data as StudentDbRow[] | null) ?? null, error: result.error };
}

async function queryInvites(client: SupabaseClient): Promise<LoaderQueryResult<InviteDbRow[]>> {
  const result = await client.from('invites').select('*').order('created_at', { ascending: false });
  return { data: (result.data as InviteDbRow[] | null) ?? null, error: result.error };
}

/**
 * `getClient` is injectable (defaults to the shared singleton), same
 * convention every prior `loaders/*.ts` file in this directory already
 * established, so tests can supply a stubbed transport with zero real
 * network calls.
 */
export function makeLoadParentsTabData(
  getClient: () => SupabaseClient = getSupabaseClient,
): LoadParentsTabDataFn {
  const loadProfileRows = createLoader<void, ProfileDbRow[]>(queryParentProfiles, getClient);
  const loadLinkRows = createLoader<void, GuardianLinkDbRow[]>(queryGuardianLinks, getClient);
  const loadStudentRows = createLoader<void, StudentDbRow[]>(queryStudents, getClient);
  const loadInviteRows = createLoader<void, InviteDbRow[]>(queryInvites, getClient);
  return async (): Promise<ParentsTabLoadResult> => {
    const [profileRows, linkRows, studentRows, inviteRows] = await Promise.all([
      loadProfileRows(),
      loadLinkRows(),
      loadStudentRows(),
      loadInviteRows(),
    ]);
    return {
      parentProfiles: (profileRows ?? []).map(mapProfileDbRowToParentProfileRow),
      guardianLinks: (linkRows ?? []).map(mapGuardianLinkDbRowToGuardianLinkRow),
      students: (studentRows ?? []).map(mapStudentDbRowToStudentRow),
      invites: (inviteRows ?? []).map(mapInviteDbRowToInviteRow),
    };
  };
}

/** Default `loadData` for `ParentsTab.tsx` -- real query against all four
 * tables. */
export const loadParentsTabData: LoadParentsTabDataFn = makeLoadParentsTabData();

/**
 * `ParentsTab.tsx`'s own default `onUnlinkAllStudents` (Trap #5) -- the
 * ONLY place this module ever writes `guardian_links`, and the ONLY real
 * effect of "Remove" this task delivers for a profile-backed parent (see
 * this file's own module doc above for the full disclosure of what is
 * deliberately NOT persisted).
 */
export function makeUnlinkAllStudents(
  getClient: () => SupabaseClient = getSupabaseClient,
): UnlinkAllStudentsFn {
  const mutate = runMutation<string, void>(
    (client, parentProfileId) =>
      client.from('guardian_links').delete().eq('parent_profile_id', parentProfileId),
    getClient,
  );
  return async (parentProfileId) => {
    await mutate(parentProfileId);
  };
}

/** Default `onUnlinkAllStudents` for `ParentsTab.tsx`. */
export const unlinkAllStudents: UnlinkAllStudentsFn = makeUnlinkAllStudents();
