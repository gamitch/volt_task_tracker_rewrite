# Worker Packet: T073b2

## Task ID
T073b2 — Real Supabase `AuthProvider` wiring, Epic E3. Final task of the router-wiring series.

**Do not dispatch this task until T073b1 (shared auth test harness extraction) has Passed.** This
packet assumes `src/test-utils/authHarness.tsx` already exists.

## Objective
`src/app/guards.tsx`'s `AuthProvider` is still a pure in-memory placeholder — `login(user)` just
calls `setUser(user)` synchronously, with no real session, no persistence, no backend. T071 (Passed)
already built the real, typed Supabase auth module (`src/lib/supabase/auth.ts`) specifically shaped
to slot into this contract, and explicitly left the wiring itself to a future task "authorized to
edit `guards.tsx`" — that task is this one.

This is architecturally the most significant task in the router-wiring series. Read this whole
packet before writing any code — several of the requirements below interact with each other (the
async resolution design, the contract signature change, and the OAuth redirect fix all touch the
same handful of functions).

## Allowed Files
- `src/app/guards.tsx`
- `src/app/guards.test.tsx` (new file, if one doesn't already exist — check first)
- `src/pages/login/LoginPage.tsx`
- `src/pages/login/LoginPage.test.tsx`
- `src/pages/accept-invite/AcceptInvitePage.tsx`
- `src/pages/accept-invite/AcceptInvitePage.test.tsx`
- `src/test-utils/authHarness.tsx` (built by T073b1 — needs updating for the new contract)
- The 10 test files T073b1 already migrated onto the shared harness (only if the harness's own
  interface changes in a way that requires call-site updates — check first, most changes should be
  absorbable inside `authHarness.tsx` alone): `src/pages/home/CoachHome.test.tsx`,
  `StudentHome.test.tsx`, `ParentHome.test.tsx`, `DashboardPage.test.tsx`,
  `src/pages/meetings/MeetingsList.test.tsx`, `LiveConsole.test.tsx`,
  `src/pages/outreach/OutreachList.test.tsx`, `src/pages/roster/ParentsTab.test.tsx`,
  `AdminToggles.test.tsx`, `src/pages/settings/SeasonSettings.test.tsx`
- `src/pages/settings/SettingsPage.test.tsx` (uses `AuthProvider`/`useAuth()` directly for its
  `logout()` test — `logout`'s signature changes in this task, that one test needs review)

## Forbidden Files
- `src/lib/supabase/**` — already correct (T071, Passed). Read-only reference; do not touch.
- Every page component's non-test file besides `LoginPage.tsx`/`AcceptInvitePage.tsx` (both listed
  above specifically because their sign-in handlers call the changing `login`/`loginWithGoogle`
  contract directly — everything else that merely calls `useAuth()` for `user`/`logout` needs no
  change, since `AuthContextValue.user`'s shape and `logout()`'s call-site usage stay compatible).
- `src/app/router.tsx` — no route changes in this task.
- `src/pages/no-access/NoAccessPage.tsx` — already built (T020, Passed), read-only reference. You
  will import and render it, not modify it.
- `docs/swarm/**`, `.claude/**`.

## Known Context / Traps

**1. The async two-step resolution — the core design of this task.** Real auth resolution is TWO
sequential async steps, not one: `session = await getInitialSession()`, then (if a session exists)
`role = await resolveRole(session.user.id)`. **`isLoading` must stay `true` across BOTH steps.**
`RequireAuth`'s existing `if (isLoading) return null` guard is correct as long as `isLoading` spans
the whole resolution — if you flip it to `false` after step 1 but before step 2 resolves,
`RequireAuth` will see `user === null` for a user who is actually authenticated-but-role-pending and
wrongly bounce them to `/login`. This is the single most important correctness property in this
task — write a test that specifically proves it (e.g. a resolved session with a slow/delayed
`resolveRole` still keeps `isLoading: true` throughout).

**2. AUTH-04's "no-profile" case is a third auth state, not "no user."** A signed-in Supabase auth
user with no matching `profiles` row (`resolveRole` returns `{ status: 'no-profile' }`, per T071's
already-built `RoleResolution` type) is authenticated but has nowhere to go — redirecting them to
`/login` would loop (sign in → still no profile → redirect → …). Add a field to
`AuthContextValue` distinguishing this from plain "anonymous" (e.g. `status: 'anonymous' |
'authenticated' | 'no-profile'`, or a `noProfile: boolean` alongside `user: null` — your call, state
your choice and why). `RequireAuth` must then render `<NoAccessPage />` in place (no navigation) for
this case, not redirect. `NoAccessPage.tsx` (T020, Passed, never yet mounted anywhere in the app) is
already built exactly for this: it signs the user out on mount and shows a "contact your coach/
admin" message with a real `loadData` seam — read it before using it, don't reinvent its behavior.

**3. `RequireRole`'s current behavior (`Navigate to="/"` + toast) should also change to render
`<NoAccessPage />` in place.** Now that `/` is a real role dispatcher (T075, Passed), redirecting a
role-denied user there re-enters role-dispatch logic and risks a confusing bounce (or, if the denial
reason is transient, a loop). Rendering `NoAccessPage` in place — matching the AUTH-04 case's
treatment — is simpler and more consistent. This is a real, disclosed behavior change: write a test
proving a role-denied user sees `NoAccessPage`, not a redirect.

**4. Contract signature changes — every call site must migrate.**
- `login: (user: AuthUser) => void` → `login: (email: string, password: string) => Promise<void>`.
  Internally: `await signInWithPassword(email, password)` (from `src/lib/supabase/auth.ts` — lets
  the real `AuthError` propagate unwrapped, per that module's own documented error-propagation
  choice; do not wrap it), then resolve session→role the same way the mount-time flow does (see Trap
  #6 on sharing this logic) BEFORE `login()` itself resolves — so that by the time a caller's
  `await login(...)` returns, `user`/`status` are already fully updated. This matters: `LoginPage`'s
  submit handler calls `navigate(consumeIntendedUrl())` right after `login()` resolves, and that
  navigation needs a fully-resolved `user` already in place for `RequireAuth` to let it through
  without bouncing back to `/login`.
- `loginWithGoogle: () => Promise<AuthUser>` → `loginWithGoogle: (redirectTo: string) =>
  Promise<void>` (no longer returns a user — see Trap #5, the real OAuth flow redirects the browser
  away, so nothing meaningful can be returned synchronously).
- `logout: () => void` → `logout: () => Promise<void>` (calls the real `signOut()`).

**5. The real OAuth redirect-leg bug — read this carefully, it's the subtlest part of this task.**
Both `LoginPage.tsx` and `AcceptInvitePage.tsx` currently do `await loginWithGoogle();
navigate(consumeIntendedUrl())`. With REAL OAuth, `signInWithOAuth` redirects the browser away —
the current page unloads, and that `.then()`/next line never runs. The intended-URL consumption
must happen on the RETURN leg, after the browser comes back. Recommended design (verify and adjust
as needed, don't blindly copy if you find a better approach, but explain your reasoning either way):
configure `redirectTo` to point back at the current page (e.g. `/login` or `/accept-invite`
themselves), so after the OAuth round trip completes, the browser lands back on that same page with
Supabase's client-side session now established (the `@supabase/supabase-js` client parses the auth
callback automatically). Add a `useEffect` in `LoginPage.tsx` (and `AcceptInvitePage.tsx`) that
watches `useAuth()`'s resolved `user`/`isLoading`/`status`, and once a user is genuinely resolved
(not loading, not anonymous, not no-profile), calls `navigate(consumeIntendedUrl())` — this single
effect naturally handles BOTH the email/password path and the OAuth return-leg path, since both
ultimately just need "once I have a real resolved user, go to the intended URL." You may keep or
remove the explicit inline `navigate()` after the email/password `login()` call, as long as the
effect-based path doesn't double-navigate — think through the interaction and disclose your choice.

**6. Share the two-step resolution logic — do not duplicate it three times (mount, `login()`,
subscription callback).** Write one internal helper (e.g. `resolveSessionToAuthState(session)`)
that both the initial-mount effect, the `subscribeToAuthStateChange` listener (for token refresh /
the OAuth-callback `SIGNED_IN` event / cross-tab sign-out), and `login()`'s own explicit resolution
(Trap #4) all call — this is both less error-prone and easier for a checker to verify has one
source of truth.

**7. Remove `SIMULATED_AUTH_LATENCY_MS` from `LoginPage.tsx`** — it exists purely to simulate the
placeholder's fake async delay; real Supabase calls have their own real latency, the artificial
delay is no longer needed or honest.

**8. `src/test-utils/authHarness.tsx` (built by T073b1) needs updating for the new contract.** Its
current shape calls `login(user)` directly (the OLD synchronous-with-a-full-user signature). Under
the new contract, tests can't call `login(email, password)` and expect a real backend round trip —
instead, `AuthProvider` needs an **injectable auth-module seam**: an optional prop (e.g.
`authModule`) accepting the same function shapes as `src/lib/supabase/auth.ts`'s exports
(`getInitialSession`, `subscribeToAuthStateChange`, `signInWithPassword`, `signInWithGoogle`,
`signOut`, `resolveRole`), defaulting to the real module when not supplied. Update
`authHarness.tsx`'s shared helper to build a fake `authModule` whose `getInitialSession`/
`resolveRole` resolve to whatever `AuthUser` the test wants, and pass it into `AuthProvider` — this
lets all 10 already-migrated test files (T073b1) keep testing "render as role X" without needing a
real backend, and is also what makes deterministic testing of this task's own new logic possible.

**9. Realistic verification bar — this environment has no real Supabase backend (no `.env`, only
`.env.example`).** Do NOT attempt a live Playwright round-trip through real
`signInWithPassword`/Google OAuth — it's not reproducible here and any packet requiring it would
deadlock. Instead:
- **Deterministic tests** (the primary verification mechanism) against the injected fake
  `authModule`, covering: session→role→user (happy path); no-session→anonymous→`RequireAuth`
  redirects to `/login`; **no-profile→`RequireAuth` renders `NoAccessPage`** (AUTH-04); role-denied→
  `RequireRole` renders `NoAccessPage`, not a redirect; subscription-driven updates (a
  `SIGNED_IN`/`SIGNED_OUT` event fired through the fake's subscription callback updates `user`
  correctly); **`isLoading` stays `true` across both resolution steps** (Trap #1's core property —
  test this explicitly, e.g. with a fake `resolveRole` that resolves on a later tick); `login`/
  `loginWithGoogle`/`logout` call the right underlying module functions with the right arguments.
- **Limited live Playwright** (secondary, for what's actually real in this environment): (a) confirm
  the unconfigured-Supabase path (`SupabaseNotConfiguredError`, per `client.ts`) surfaces as a
  visible error state rather than a white screen/crash; (b) if your injected-module seam supports it
  cleanly, a seeded-fake-session render reaching a protected route. Do not attempt more than this.

## Acceptance Criteria
- Two-step async resolution correctly implemented, `isLoading` spans both steps (Trap #1),
  independently tested.
- AUTH-04 no-profile case renders `NoAccessPage` in place, never redirects to `/login` (Trap #2).
- `RequireRole` denial renders `NoAccessPage` in place, no longer navigates to `/` (Trap #3).
- `login`/`loginWithGoogle`/`logout` all migrated to the new async contract; every call site
  (`LoginPage.tsx`, `AcceptInvitePage.tsx`) updated accordingly.
- OAuth intended-URL consumption genuinely works on the return leg, not just the (now-impossible)
  inline pattern (Trap #5) — your chosen design stated explicitly with reasoning.
- Resolution logic has one source of truth, not duplicated (Trap #6).
- `SIMULATED_AUTH_LATENCY_MS` removed from `LoginPage.tsx`.
- `authHarness.tsx` updated with an injectable-`authModule` seam; all 10 already-migrated test files
  still pass.
- `npm run typecheck`, `npm run lint`, `npm run test`, `npm run build`, `npm run format:check` all
  clean.

## Relevant Constitution Excerpts
> Constitution item 5 (BLOCKER-class): no secrets/service-role keys in the frontend bundle. Not
> directly at risk here (T071 already handles this correctly, you're only wiring calls into it), but
> re-confirm nothing in your diff introduces a hardcoded credential or bypasses `getSupabaseClient()`.

> No worker may mark its own work complete; every PASS requires independent checker-inspected
> evidence.

## Most Recent Failure
None. This is attempt 1 for T073b2 (attempt count: 0) — not yet dispatched, blocked on T073b1.

## Context Note
This design was scoped via a boss-architect consultation earlier in the router-wiring series (see
`docs/swarm/archive/T073a-worker-packet.md`'s Context Note and the series' `verification-log.md`
entries for `T073a`/`T074`/`T075` for the full history). The consultation specifically flagged: no
real Supabase backend exists in this environment (verification bar adjusted accordingly, Trap #9);
the `login()` contract itself must change signature, not just internals (Trap #4); and `RequireRole`
should move to an in-place `NoAccessPage` render rather than a redirect now that `/` is a real
dispatcher (Trap #3).

## Required Worker Output
- Full diff of every changed file.
- Your chosen shape for the new `no-profile` distinction on `AuthContextValue` and why.
- Your chosen OAuth-redirect-leg design (Trap #5) and why, including how you avoided a
  double-navigate race with the email/password path.
- Confirmation the resolution logic has one source of truth (Trap #6), cited by function name/line.
- Full description of `authHarness.tsx`'s new injectable-`authModule` seam shape.
- Full test/typecheck/lint/build/format:check output.
- Your limited live-Playwright evidence (Trap #9's second bullet).
- Known risks; whether a dispute is needed (you flag, you don't resolve) — in particular, flag
  immediately if anything about the async resolution design turns out to conflict with an existing
  Passed test's expectations in a way that would require touching a forbidden file.
