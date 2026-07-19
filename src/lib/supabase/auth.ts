/**
 * T071: thin, typed auth/session wrappers shaped to slot into
 * `src/app/guards.tsx`'s existing `AuthContextValue` contract
 * (`user` / `isLoading` / `login` / `loginWithGoogle` / `logout`, that
 * file's lines 51-70) WITHOUT editing `guards.tsx` in this task (forbidden
 * file, read-only per the worker packet). A future wiring task swaps
 * `guards.tsx`'s in-memory placeholder `AuthProvider` internals for calls
 * into this module's exports; nothing here is imported by `guards.tsx` yet.
 *
 * `guards.tsx`'s `loginWithGoogle` TODO comment (lines 61-63 of that file)
 * anticipates exactly this call shape:
 *   `supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo } })`
 * `signInWithGoogle` below is a direct, typed wrapper around exactly that
 * call -- provider is hardcoded to `'google'`, `redirectTo` is
 * caller-supplied (never invented/hardcoded here).
 *
 * Mapping to `AuthContextValue`, for the future wiring task:
 *   - `getInitialSession` -> the initial `user`/`isLoading` resolution.
 *   - `subscribeToAuthStateChange` -> keeps `user` in sync afterward
 *     (returns an unsubscribe function, same shape `guards.tsx`'s own
 *     `subscribeToast` already uses).
 *   - `signInWithPassword` -> `login`.
 *   - `signInWithGoogle` -> `loginWithGoogle`.
 *   - `signOut` -> `logout`.
 *   - `resolveRole` -> not in `AuthContextValue` today, but required to
 *     build the `AuthUser.role` field a real session resolution needs
 *     (`guards.tsx`'s `AuthUser.role: Role` field, line 48) -- see the
 *     mismatch note below for why this can't be wired 1:1 yet.
 *
 * Role vocabulary mismatch (documented, NOT resolved here -- see the worker
 * packet's Ground Truth section): `guards.tsx`'s own `Role` type (that
 * file's line 43) is `'admin' | 'staff' | 'volunteer' | 'coach'`, a stale
 * T005 placeholder -- that file's own doc comment (lines 28-41) says so
 * explicitly. The REAL AUTH-05 role vocabulary, matching `role_enum`
 * verbatim (`supabase/migrations/20260716000000_identity_roster.sql`,
 * line 12: `create type role_enum as enum ('admin', 'coach', 'student', 'parent');`),
 * is exported here as `types.ts`'s `Role` -- deliberately NOT the same
 * name/union as `guards.tsx`'s stale placeholder, and never coerced into
 * it. `src/pages/accept-invite/types.ts` (T018) already established this
 * exact posture for its own `InviteRole`; this module follows the same
 * precedent. Reconciling the two `Role` unions (and wiring `guards.tsx`'s
 * `AuthProvider` to call this module) is left to a follow-up task
 * authorized to edit `guards.tsx`.
 *
 * Error propagation: unlike `loader.ts`'s `createLoader` (whose rejections
 * are always the DES-16-compatible `SupabaseLoaderError` shape, per the
 * worker packet's Loader acceptance criterion), the six functions below
 * that call `client.auth.*` directly (`getInitialSession`,
 * `subscribeToAuthStateChange`, `signInWithPassword`, `signInWithGoogle`,
 * `signOut`) let the raw `AuthError` from `@supabase/supabase-js` propagate
 * unwrapped. This is a deliberate, disclosed choice, not an oversight: the
 * worker packet's DES-16 requirement is scoped explicitly to "the Loader
 * helper" acceptance criterion, and `AuthError` already carries its own
 * `.message`/`.status`; wrapping it a second time would risk losing
 * auth-specific fields a future login-page error UI may need (e.g.
 * distinguishing "invalid credentials" from "network failure"). `resolveRole`
 * below is the one exception: it reads `profiles` via `loader.ts`'s
 * `createLoader`, so ITS rejections are the DES-16-compatible
 * `SupabaseLoaderError` shape.
 */
import type {
  AuthChangeEvent,
  AuthError,
  AuthSession,
  AuthUser,
  SupabaseClient,
} from '@supabase/supabase-js';
import { getSupabaseClient } from './client';
import { createLoader } from './loader';
import type { Role } from './types';

export type { AuthChangeEvent, AuthError, AuthSession, AuthUser };
export type { Role };

/**
 * Resolves the current session, if any (`null` when signed out). Maps to
 * `guards.tsx`'s `AuthContextValue.user`/`isLoading` (see module doc) -- a
 * future wiring task would call this once on mount, then set `isLoading`
 * false and derive `user` from the resolved session (or `null`).
 */
export async function getInitialSession(
  client: SupabaseClient = getSupabaseClient(),
): Promise<AuthSession | null> {
  const { data, error } = await client.auth.getSession();
  if (error) {
    throw error;
  }
  return data.session;
}

/**
 * Subscribes to auth state changes (sign-in, sign-out, token refresh, etc.)
 * and returns an unsubscribe function -- the same pub/sub shape
 * `guards.tsx`'s own `subscribeToast` (that file, lines 175-180) already
 * uses elsewhere in this codebase.
 */
export function subscribeToAuthStateChange(
  callback: (event: AuthChangeEvent, session: AuthSession | null) => void,
  client: SupabaseClient = getSupabaseClient(),
): () => void {
  const {
    data: { subscription },
  } = client.auth.onAuthStateChange(callback);
  return () => subscription.unsubscribe();
}

/** Maps to a future `guards.tsx` `login()` call once real credential-based
 * sign-in is wired up (that file's `login(user: AuthUser)` today just sets
 * local state -- see line 57). */
export async function signInWithPassword(
  email: string,
  password: string,
  client: SupabaseClient = getSupabaseClient(),
): Promise<AuthSession> {
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error) {
    throw error;
  }
  if (!data.session) {
    // Should not happen for a successful password sign-in, but the SDK's
    // own return type allows it (e.g. an email-confirmation-pending edge
    // case) -- fail loud rather than returning an invalid session as if it
    // were valid.
    throw new Error('Sign-in succeeded but no session was returned.');
  }
  return data.session;
}

/**
 * `guards.tsx`'s `loginWithGoogle` TODO (lines 61-63 of that file), made
 * real: the exact `signInWithOAuth({ provider: 'google', options:
 * { redirectTo } })` shape that comment anticipates. This call redirects
 * the browser away (OAuth round trip) rather than returning a session
 * synchronously -- the caller's `subscribeToAuthStateChange` listener is
 * expected to observe the eventual `SIGNED_IN` event after the redirect
 * back, same as `@supabase/supabase-js`'s own documented OAuth pattern.
 */
export async function signInWithGoogle(
  redirectTo: string,
  client: SupabaseClient = getSupabaseClient(),
): Promise<void> {
  const { error } = await client.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo },
  });
  if (error) {
    throw error;
  }
}

/** Maps to `guards.tsx`'s `AuthContextValue.logout`. */
export async function signOut(client: SupabaseClient = getSupabaseClient()): Promise<void> {
  const { error } = await client.auth.signOut();
  if (error) {
    throw error;
  }
}

/** The row shape this helper needs off `profiles` -- see `types.ts`'s
 * `ProfileRow` for the full row and its column-by-column citations. Only
 * `role` is needed here. */
interface ProfileRoleRow {
  role: Role;
}

/**
 * AUTH-04's no-access case, made a distinct typed result rather than an
 * exception swallowed into "no role": a signed-in auth user with no
 * matching `profiles` row (T019's trigger guarantees a row for any
 * legitimately-invited user, so a missing row here means "not on the
 * roster", never "the query hasn't run yet"). Genuine transport/query
 * errors still reject (via `loader.ts`'s `createLoader`, used below) --
 * they are NEVER folded into `{ status: 'no-profile' }`.
 */
export type RoleResolution = { status: 'found'; role: Role } | { status: 'no-profile' };

/**
 * Reads the signed-in user's `profiles.role` (AUTH-05, enforced by RLS --
 * this helper does not re-derive or duplicate any RLS policy; it only reads
 * whatever row RLS already lets the caller see for the given `userId`).
 *
 * Uses `.maybeSingle()` (not `.single()`) precisely so "no matching row"
 * resolves `{ data: null, error: null }` from Postgrest -- `createLoader`
 * then resolves that as `null`, which this function maps to the distinct
 * `{ status: 'no-profile' }` result (never thrown, never coerced into a
 * fake role). A genuine transport/query error instead rejects with
 * `loader.ts`'s `SupabaseLoaderError` and propagates unmodified.
 *
 * `client` is injectable (defaults to the shared singleton) so tests can
 * stub the transport with zero real network calls.
 */
export function resolveRole(
  userId: string,
  client: SupabaseClient = getSupabaseClient(),
): Promise<RoleResolution> {
  const loadProfileRole = createLoader<string, ProfileRoleRow>(
    (c, id) =>
      c
        .from('profiles')
        .select('role')
        .eq('id', id)
        .maybeSingle()
        .overrideTypes<ProfileRoleRow, { merge: false }>(),
    () => client,
  );

  return loadProfileRole(userId).then((row): RoleResolution =>
    row ? { status: 'found', role: row.role } : { status: 'no-profile' },
  );
}
