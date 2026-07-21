/**
 * T071/T086: public barrel for the shared Supabase client module. Re-exports
 * everything a consumer needs from `client.ts` / `auth.ts` / `loader.ts` /
 * `functions.ts` / `types.ts` -- see each file's own module doc for the full
 * design rationale. Importing this barrel alone must never throw (same
 * guarantee `client.ts` documents for itself); only calling
 * `getSupabaseClient()` while unconfigured throws.
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
  runMutation,
  type LoaderQueryFn,
  type LoaderQueryResult,
  type MutationFn,
  type SupabaseLoaderError,
} from './loader';

export { invokeEdgeFunction } from './functions';

export type {
  AttendanceMethod,
  AttendanceRow,
  AttendanceStatus,
  AuditLogRow,
  CalendarFeedRow,
  EmailLogRow,
  EventRow,
  EventSessionRow,
  EventSessionStatus,
  EventType,
  GuardianLinkRow,
  InviteRow,
  InviteStatus,
  NotificationPrefsRow,
  ProfileRow,
  Role,
  RsvpRow,
  RsvpStatus,
  SeasonRow,
  StudentRow,
  TeamProgram,
  TeamRow,
  VStudentHoursRow,
  VStudentParticipationRow,
  VTeamParticipationRow,
} from './types';
