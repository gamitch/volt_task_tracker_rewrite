/**
 * T087 (ED-1 Packet P1): real `invites` data-layer wiring for
 * `src/pages/roster/InvitesTab.tsx` -- first file in this new `loaders/`
 * directory (subsequent ED-1 packets add their own sibling files here; this
 * file owns only the `invites` table). Built directly on top of T086's
 * (ED-1 Packet P0) `createLoader`/`runMutation` (`../loader.ts`, read-only
 * import here).
 *
 * -----------------------------------------------------------------------
 * Trap #1 decision (worker packet Known Context/Traps #1) -- kept
 * `InvitesTab.tsx`'s own local `InviteRow`/`ProfileRole`/`InviteStatus`
 * type declarations AS-IS (option (b) of the two the packet offers),
 * rather than switching that page to import `../types.ts`'s shared
 * `InviteRow`/`Role`/`InviteStatus` directly and dropping its local
 * duplicates. Reasoning: the shared `InviteRow` additionally carries
 * `invitedBy` (`invites.invited_by`, `not null`), a column
 * `InvitesTab.tsx` never displays or otherwise needs; switching the page
 * to the shared type would have forced every existing `InviteRow` fixture
 * literal already in `InvitesTab.test.tsx` (and this file's own fixture
 * data) to grow an always-unused field, for no readability gain. This
 * file's `mapInviteDbRowToInviteRow` below is exactly the "loader maps DB
 * rows into them explicitly" half of that option -- the one place the
 * lossy `invited_by` drop happens, disclosed, not silent.
 * `InviteDisplayStatus`/`InvitesTab.tsx`'s local `InviteStatus` union was
 * independently re-verified here to be value-for-value identical to `../
 * types.ts`'s shared `InviteStatus` (`'pending' | 'accepted' | 'expired' |
 * 'revoked'`, both grepped side-by-side) -- and `ProfileRole` identical to
 * shared `Role` (`'admin' | 'coach' | 'student' | 'parent'`) -- so there is
 * no drift TODAY; this file types the raw DB row against the SHARED
 * `Role`/`InviteStatus` unions (not `InvitesTab.tsx`'s local aliases),
 * since this interface describes the database's wire shape, not the
 * page's display shape, and those two are supposed to be the same
 * authority `../types.ts` already established from the real migration SQL
 * (cited in full there, not re-cited here).
 *
 * -----------------------------------------------------------------------
 * Trap #3 (load) -- `public.invites`' only read RLS policy is `staff_all`
 * (`supabase/migrations/20260717000002_rls.sql`, read-only reference, not
 * imported here). `InvitesTab` only ever renders for admin/coach (gated
 * upstream by `RosterShell`'s `RequireRole`, a forbidden file for this
 * task), so every session reaching `loadInvitesTabData` below is genuinely
 * staff -- a real empty result is "no invites exist yet", not an
 * RLS-caused false-empty. `queryInvites` below is exactly the packet's own
 * literal query: `client.from('invites').select('*').order('created_at',
 * { ascending: false })`. `createLoader` resolves `null` for supabase-js's
 * own "no rows" shape (`data: null, error: null` -- see `../loader.ts`'s
 * own module doc); `InvitesTabLoadResult.invites` is a plain (never-null)
 * `readonly InviteRow[]`, so `null` is bridged to `[]` exactly once, at
 * `loadInvitesTabData`'s own `rows ?? []` below -- the one place this
 * bridge happens.
 *
 * -----------------------------------------------------------------------
 * Trap #4 (revoke) -- `revokeInvite` below does exactly one thing: set
 * `invites.status = 'revoked'` for the targeted row, via `runMutation`.
 * `trg_audit_invite_revocation` (`supabase/migrations/20260717000001_
 * support_audit.sql`, already-applied DB trigger, read-only reference, not
 * imported here) writes the corresponding `audit_log` row automatically
 * once this mutation lands -- this file contains zero `audit_log`
 * references, zero client-side audit writes (grep-provable).
 *
 * -----------------------------------------------------------------------
 * T090 (ED-1 Packet P3) addition -- Trap #5 (resend). `resendInvite` below
 * is appended at the bottom of this file, alongside (not replacing)
 * `loadInvitesTabData`/`revokeInvite` above -- both of those, and every
 * type/function above this note, are byte-for-byte unchanged by this
 * addition. Calls the real `send-invite` Edge Function's new resend branch
 * via `invokeEdgeFunction('send-invite', { invite_id: invite.id })` (T086's
 * calling convention, same one `InviteParentDialog.tsx`'s `defaultOnSendInvite`
 * already uses for the send path). See `resendInvite`'s own doc comment
 * below for why it needs a second, minimal response mapper rather than
 * reusing `mapInviteDbRowToInviteRow` above.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { createLoader, runMutation, type LoaderQueryResult } from '../loader';
import { getSupabaseClient } from '../client';
import { invokeEdgeFunction } from '../functions';
import type { InviteStatus as SharedInviteStatus, Role as SharedRole } from '../types';
import type {
  InviteRow,
  InvitesTabLoadResult,
  LoadInvitesTabDataFn,
  ResendInviteFn,
  RevokeInviteFn,
} from '../../../pages/roster/InvitesTab';

/**
 * Raw `public.invites` row exactly as Postgrest returns it over the wire
 * (snake_case column names) -- `supabase/migrations/
 * 20260717000000_scheduling_attendance.sql` lines 18-27, cited in full
 * already in `../types.ts`'s own `InviteRow` doc comment (not re-cited
 * here). `role`/`status` are typed against the SHARED `Role`/`InviteStatus`
 * unions (see Trap #1 decision above), not `InvitesTab.tsx`'s local
 * aliases.
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

/**
 * Maps one raw DB row to `InvitesTab.tsx`'s own local `InviteRow` display
 * shape (Trap #1 decision above). `invited_by` is deliberately dropped
 * here, not renamed -- the only lossy part of this mapping, and
 * intentional: `InvitesTab.tsx` never displays/uses it.
 */
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

/** Trap #3's literal query, exactly as the worker packet specifies it. */
async function queryInvites(client: SupabaseClient): Promise<LoaderQueryResult<InviteDbRow[]>> {
  const result = await client.from('invites').select('*').order('created_at', { ascending: false });
  return { data: (result.data as InviteDbRow[] | null) ?? null, error: result.error };
}

/**
 * `getClient` is injectable (defaults to the shared singleton), same
 * convention `../loader.ts`/`../functions.ts` already established, so
 * tests can supply a stubbed transport with zero real network calls --
 * used directly by `InvitesTab.test.tsx`'s loader-level tests (this
 * module has no dedicated test file of its own; the worker packet's
 * Allowed Files list only names `InvitesTab.test.tsx`/
 * `InviteParentDialog.test.tsx`, not a new file here).
 */
export function makeLoadInvitesTabData(
  getClient: () => SupabaseClient = getSupabaseClient,
): LoadInvitesTabDataFn {
  const loadRows = createLoader<void, InviteDbRow[]>(queryInvites, getClient);
  return async (): Promise<InvitesTabLoadResult> => {
    const rows = await loadRows();
    // Trap #3's null -> { invites: [] } bridge -- the one place it happens.
    return { invites: (rows ?? []).map(mapInviteDbRowToInviteRow) };
  };
}

/** Default `loadData` for `InvitesTab.tsx` -- real query against `invites`. */
export const loadInvitesTabData: LoadInvitesTabDataFn = makeLoadInvitesTabData();

/**
 * Same injectable-`getClient` convention as `makeLoadInvitesTabData` above,
 * for the same testability reason.
 */
export function makeRevokeInvite(
  getClient: () => SupabaseClient = getSupabaseClient,
): RevokeInviteFn {
  return runMutation<InviteRow, void>(
    (client, invite) => client.from('invites').update({ status: 'revoked' }).eq('id', invite.id),
    getClient,
  );
}

/**
 * Default `onRevoke` for `InvitesTab.tsx` (Trap #4) -- sets
 * `invites.status = 'revoked'` only. No `audit_log` write anywhere in this
 * file; `trg_audit_invite_revocation` handles that automatically at the
 * database level.
 */
export const revokeInvite: RevokeInviteFn = makeRevokeInvite();

/**
 * -----------------------------------------------------------------------
 * T090 (ED-1 Packet P3) -- real `onResend`. `send-invite`'s Edge Function
 * now supports a genuine resend branch (a request body with `invite_id`
 * instead of `email`/`role`/`student_id` -- `supabase/functions/send-invite/
 * index.ts`'s `handleResendInvite`, read-only reference, not imported here
 * -- that file is a Deno Edge Function, not something this Vite bundle can
 * import), so `onResend` no longer needs to stay fixture-backed (T087's own
 * "deliberately NOT wired" note in `InvitesTab.tsx` is superseded by this
 * task -- see that file's own updated module doc).
 *
 * `invokeEdgeFunction<ResendInviteEdgeResponse>('send-invite', { invite_id:
 * invite.id }, getClient)` is exactly T087's own `send` call's calling
 * convention (`InviteParentDialog.tsx`'s `defaultOnSendInvite`), reused
 * here for the resend request shape.
 *
 * `mapResendResponseToInviteRow` below is a SECOND, deliberately minimal
 * mapper, not a reuse of `mapInviteDbRowToInviteRow` above: the resend
 * response's own wire shape (`ResendInviteResponseRow`) is the identical
 * field list minus `invited_by` (`index.ts`'s resend success response never
 * includes it -- only this file's own `queryInvites` full-table `select('*')`
 * happens to carry that column). Calling `mapInviteDbRowToInviteRow`
 * directly with a response object missing a required `InviteDbRow` field
 * would not type-check, and fabricating a placeholder `invited_by` value
 * just to reuse that function would be worse (silently inventing data that
 * was never actually returned). Both mappers select the exact same target
 * fields in the exact same order, so there is no actual logic duplication,
 * only the unavoidable type-shape difference.
 */
interface ResendInviteResponseRow {
  id: string;
  email: string;
  role: SharedRole;
  student_id: string | null;
  status: SharedInviteStatus;
  expires_at: string;
  created_at: string;
}

interface ResendInviteEdgeResponse {
  invite: ResendInviteResponseRow;
}

function mapResendResponseToInviteRow(row: ResendInviteResponseRow): InviteRow {
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

/**
 * Same injectable-`getClient` convention as `makeLoadInvitesTabData`/
 * `makeRevokeInvite` above, for the same testability reason.
 */
export function makeResendInvite(
  getClient: () => SupabaseClient = getSupabaseClient,
): ResendInviteFn {
  return async (invite: InviteRow): Promise<InviteRow> => {
    const response = await invokeEdgeFunction<ResendInviteEdgeResponse>(
      'send-invite',
      { invite_id: invite.id },
      getClient,
    );
    return mapResendResponseToInviteRow(response.invite);
  };
}

/** Default `onResend` for `InvitesTab.tsx` (T090) -- real `send-invite`
 * resend call. Replaces T087's fixture-backed `defaultOnResendInvite`
 * as the component's implicit default (that fixture function itself is
 * untouched and still exported from `InvitesTab.tsx` for tests/future
 * callers that want it explicitly). */
export const resendInvite: ResendInviteFn = makeResendInvite();
