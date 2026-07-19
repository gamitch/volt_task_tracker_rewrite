/**
 * T071: public barrel for the shared Supabase client module. Re-exports
 * everything a consumer needs from `client.ts` / `auth.ts` / `loader.ts` /
 * `types.ts` -- see each file's own module doc for the full design
 * rationale. Importing this barrel alone must never throw (same guarantee
 * `client.ts` documents for itself); only calling `getSupabaseClient()`
 * while unconfigured throws.
 */
export {
  getSupabaseClient,
  isSupabaseConfigured,
  resetSupabaseClientForTests,
  SupabaseNotConfiguredError,
} from './client';

export {
  getInitialSession,
  resolveRole,
  signInWithGoogle,
  signInWithPassword,
  signOut,
  subscribeToAuthStateChange,
  type AuthChangeEvent,
  type AuthError,
  type AuthSession,
  type AuthUser,
  type RoleResolution,
} from './auth';

export {
  createLoader,
  isSupabaseLoaderError,
  type LoaderQueryFn,
  type LoaderQueryResult,
  type SupabaseLoaderError,
} from './loader';

export type {
  AttendanceMethod,
  AttendanceRow,
  AttendanceStatus,
  EventSessionRow,
  EventSessionStatus,
  InviteRow,
  InviteStatus,
  ProfileRow,
  Role,
  StudentRow,
  TeamProgram,
  TeamRow,
  VStudentParticipationRow,
} from './types';
