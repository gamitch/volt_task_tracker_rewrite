/**
 * T073b1: shared test-only auth login harness, extracted from local
 * `LoginAs` helper components previously duplicated across ten test files:
 *   - `src/pages/home/CoachHome.test.tsx` (T053)
 *   - `src/pages/home/StudentHome.test.tsx` (T054)
 *   - `src/pages/home/ParentHome.test.tsx` (T055)
 *   - `src/pages/home/DashboardPage.test.tsx` (T075)
 *   - `src/pages/meetings/MeetingsList.test.tsx` (T030)
 *   - `src/pages/outreach/OutreachList.test.tsx` (T038)
 *   - `src/pages/meetings/LiveConsole.test.tsx` (T033)
 *   - `src/pages/roster/ParentsTab.test.tsx` (T025)
 *   - `src/pages/roster/AdminToggles.test.tsx` (T028)
 *   - `src/pages/settings/SeasonSettings.test.tsx` (T029)
 *
 * T073b2 update: `guards.tsx`'s `AuthProvider` is now wired to the real,
 * async, two-step Supabase auth flow (`session -> resolveRole -> user`,
 * `AuthProvider`'s own module doc) instead of T005's synchronous in-memory
 * placeholder. The OLD `login(user: AuthUser) => void` signature these two
 * helpers used to call directly no longer exists -- `login` is now
 * `(email: string, password: string) => Promise<void>` and performs (or
 * would perform, against a real backend) a genuine credential check, which
 * a test has no way to satisfy deterministically.
 *
 * Instead, both helpers below now render their OWN scoped `<AuthProvider
 * authModule={...}>` around `children`, using `guards.tsx`'s T073b2
 * injectable-`authModule` seam (`AuthModule`, same six function shapes
 * `../lib/supabase/auth.ts` exports) with a fake module whose
 * `getInitialSession`/`resolveRole` resolve immediately to the given
 * `user`'s fake session/role -- no real backend call, fully deterministic.
 * Because this scoped `<AuthProvider>` is the NEAREST ancestor provider to
 * `children`, React context resolution means every `useAuth()` call inside
 * `children` (including inside `RequireAuth`/`RequireRole`) sees this fake
 * module's resolved state, regardless of what (if anything) an outer,
 * caller-supplied bare `<AuthProvider>` above it resolves to -- callers do
 * not need to change how they wrap `<AuthProvider>` around these helpers;
 * the ten call sites listed above are unchanged. (An outer bare
 * `<AuthProvider>` with no `authModule` prop still mounts and tries the
 * real default module -- in this test environment, with no `.env`, that
 * fails with `SupabaseNotConfiguredError` and resolves harmlessly to an
 * unused "anonymous" state, per that provider's own disclosed
 * fail-safe-not-crash behavior; nothing here depends on or reads that
 * outer instance.)
 *
 * `LoginAs` and `LoginAsDeferred` were previously two behaviorally distinct
 * variants (one logged in synchronously during render, the other deferred
 * to a `useEffect` and withheld `children` until login had visibly taken
 * effect) because the OLD synchronous `login()` could let a nested
 * `RequireRole` observe one intermediate `user === null` render and
 * permanently `<Navigate>` away before a corrected re-render ever ran. That
 * risk no longer exists: `RequireRole`/`RequireAuth` (T073b2) both now wait
 * out `isLoading` before making any redirect/render decision, and this
 * harness's own scoped `<AuthProvider>` genuinely starts `isLoading: true`
 * and only flips it `false` once the fake module's session->role resolution
 * has actually completed -- so `RequireRole`/`RequireAuth` never observe a
 * premature "no user yet" render as if it were a real denial, no matter
 * which of the two helpers below a test uses. Both are kept as separate,
 * identically-implemented exports (rather than collapsed into one) purely
 * for source-compatibility with the ten already-migrated call sites, which
 * import one name or the other by design (see each file's own module doc
 * for why it originally picked the variant it did) -- changing either
 * import would be an unrequested call-site edit this task's packet
 * discourages where avoidable.
 */
import type { ReactNode } from 'react';
import { AuthProvider, type AuthModule, type AuthUser } from '../app/guards';
import type { AuthSession, RoleResolution } from '../lib/supabase/auth';

/**
 * Builds a fake session shaped closely enough to `@supabase/supabase-js`'s
 * real `Session`/`User` types for `guards.tsx`'s own
 * `resolveSessionToAuthState` helper to read (`session.user.id`,
 * `session.user.email`) -- the handful of other required `Session`/`User`
 * fields are filled with obviously-fake placeholder values never asserted
 * on by any test.
 */
function buildFakeSession(user: AuthUser): AuthSession {
  return {
    access_token: `fake-access-token-for-${user.id}`,
    refresh_token: `fake-refresh-token-for-${user.id}`,
    expires_in: 3600,
    token_type: 'bearer',
    user: {
      id: user.id,
      email: user.email,
      app_metadata: {},
      user_metadata: {},
      aud: 'authenticated',
      created_at: new Date(0).toISOString(),
    },
  } as AuthSession;
}

/**
 * Builds a fake `AuthModule` (`guards.tsx`'s injectable seam) whose
 * `getInitialSession`/`resolveRole` resolve deterministically to `user`'s
 * fake session/role. Every other function is a safe stub: neither helper
 * below ever triggers `signInWithPassword`/`signInWithGoogle`/`signOut`, and
 * `subscribeToAuthStateChange` has nothing to emit (no test-driven
 * subscription events are needed for "log in as role X and render" tests --
 * see `guards.test.tsx` for tests that exercise the subscription path
 * directly with their own purpose-built fake module).
 */
function buildFakeAuthModule(user: AuthUser): AuthModule {
  const fakeSession = buildFakeSession(user);

  return {
    getInitialSession: async () => fakeSession,
    subscribeToAuthStateChange: () => () => {},
    signInWithPassword: async () => {
      throw new Error(
        'authHarness: signInWithPassword is not implemented by LoginAs/LoginAsDeferred.',
      );
    },
    signInWithGoogle: async () => {
      throw new Error(
        'authHarness: signInWithGoogle is not implemented by LoginAs/LoginAsDeferred.',
      );
    },
    signOut: async () => {},
    resolveRole: async (): Promise<RoleResolution> => ({ status: 'found', role: user.role }),
  };
}

/**
 * Renders a scoped `<AuthProvider>` (fake `authModule`, resolves to `user`)
 * around `children`. See module doc above for why this single
 * implementation is safe for both this task's original "no guard in the
 * tree" callers and `LoginAsDeferred`'s original "`RequireRole` in the
 * tree" callers.
 */
export function LoginAs({ user, children }: { user: AuthUser; children: ReactNode }): ReactNode {
  return <AuthProvider authModule={buildFakeAuthModule(user)}>{children}</AuthProvider>;
}

/**
 * Identical implementation to `LoginAs` -- kept as a separate export for
 * source-compatibility with the four call sites that originally imported
 * this name specifically because their rendered tree includes
 * `RequireRole`. See module doc above for why the two no longer need to
 * differ.
 */
export function LoginAsDeferred({
  user,
  children,
}: {
  user: AuthUser;
  children: ReactNode;
}): ReactNode {
  return <AuthProvider authModule={buildFakeAuthModule(user)}>{children}</AuthProvider>;
}
