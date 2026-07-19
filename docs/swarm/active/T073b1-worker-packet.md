# Worker Packet: T073b1

## Task ID
T073b1 — Extract a shared auth test harness, Epic E3. Preparatory task for T073b2 (real Supabase
`AuthProvider` wiring — not yet dispatched).

## Objective
10 test files independently define an identical local `LoginAs` helper component:
```tsx
function LoginAs({ user, children }: { user: AuthUser; children: ReactNode }): ReactNode {
  const { login } = useAuth();
  useEffect(() => { login(user); }, [user, login]);
  return <>{children}</>;
}
```
(exact shape confirmed in `CoachHome.test.tsx`, `StudentHome.test.tsx`, `ParentHome.test.tsx`,
`DashboardPage.test.tsx`, `MeetingsList.test.tsx`, `LiveConsole.test.tsx`, `OutreachList.test.tsx`,
`ParentsTab.test.tsx`, `AdminToggles.test.tsx`, `SeasonSettings.test.tsx`), each wrapped in the same
`<MemoryRouter><AuthProvider><LoginAs user={...}>...</LoginAs></AuthProvider></MemoryRouter>` render
shape.

T073b2 (a separate, future task) will change `guards.tsx`'s `login()` signature from
`(user: AuthUser) => void` to `(email: string, password: string) => Promise<void>` (real credential-
based sign-in requires this — role can no longer be supplied directly by the caller, it comes from a
separate async `resolveRole()` call). That change would break all 10 files' `LoginAs` helper
identically and simultaneously. This task extracts ONE shared helper now, as a pure refactor with
zero behavior change, so T073b2 only has to update one file's test-authentication seam instead of
ten's.

**This task does NOT touch `guards.tsx` and does NOT change `login()`'s signature.** `LoginAs` keeps
calling `login(user)` exactly as it does today — this is a pure extract-and-reuse refactor, not a
preview of T073b2's contract change. `login`'s signature only changes in T073b2, once this
extraction has already landed and been Passed.

## Allowed Files
- `src/test-utils/authHarness.tsx` (new file — the shared helper)
- `src/pages/home/CoachHome.test.tsx`
- `src/pages/home/StudentHome.test.tsx`
- `src/pages/home/ParentHome.test.tsx`
- `src/pages/home/DashboardPage.test.tsx`
- `src/pages/meetings/MeetingsList.test.tsx`
- `src/pages/meetings/LiveConsole.test.tsx`
- `src/pages/outreach/OutreachList.test.tsx`
- `src/pages/roster/ParentsTab.test.tsx`
- `src/pages/roster/AdminToggles.test.tsx`
- `src/pages/settings/SeasonSettings.test.tsx`

(No non-test `src/pages/**` file needs to change for this task — only the 10 test files' shared
boilerplate and one new shared helper file.)

## Forbidden Files
- `src/app/guards.tsx` — do not touch. `login()`'s signature stays exactly as-is for this task.
- Every non-test page component file (`CoachHome.tsx`, `StudentHome.tsx`, etc.) — read-only.
- `src/pages/settings/SettingsPage.test.tsx` — confirmed NOT to use the `LoginAs` pattern (it tests
  the `logout()` path directly, observing `user` start/stay `null`), so it's out of this task's
  scope. Do not touch it.
- `docs/swarm/**`, `.claude/**`.

## Known Context / Traps

**1. Where to put the new shared file.** No `src/test-utils/` directory exists yet in this repo
(confirmed). Create it. Check whether `vitest.config.ts`/`vite.config.ts` needs any path/include
adjustment for a new top-level test-support directory (it likely doesn't, since Vitest picks up
imports transitively — verify this rather than assuming, and report what you found either way).

**2. What to extract — exactly the boilerplate, not more.** Each of the 10 files' `LoginAs`
component and the `<MemoryRouter><AuthProvider>...</AuthProvider></MemoryRouter>` wrapping shape is
near-identical, but double-check each file for small variations before assuming they're byte-
identical (e.g. some may wrap additional providers, some may pass extra props to `MemoryRouter` like
`initialEntries`). Your shared helper needs to accommodate the real variations found, not force a
one-size-fits-all shape that breaks a file's actual needs. A reasonable shape: a
`renderWithAuth(ui: ReactNode, user: AuthUser, options?: { initialEntries?: string[] })` function
that returns whatever the test's existing `createRoot`/`act` pattern needs — but read all 10 files
first and adapt the helper's real signature to what they actually need, don't guess.

**3. Zero behavior change is the acceptance bar.** Every one of the 10 test files' existing
assertions must still pass, unmodified in their expectations — only the `LoginAs`/wrapper
boilerplate at the top of each file should shrink to an import + a call into the shared helper.

**4. `DashboardPage.test.tsx` is the newest of the 10** (built by T075, Passed) — its `LoginAs`
usage is the most recently-written and may be the cleanest reference for what the "current" pattern
looks like, worth checking first before the other 9.

## Acceptance Criteria
- `src/test-utils/authHarness.tsx` exists, exports a shared helper (or helpers) that all 10 test
  files use in place of their own local `LoginAs`/wrapper boilerplate.
- All 10 test files still pass, unmodified in their actual test assertions/expectations.
- `npm run typecheck`, `npm run lint`, `npm run test`, `npm run build`, `npm run format:check` all
  clean, zero regressions (full repo-wide test count should be unchanged from before this task).
- No file outside the Allowed Files list touched.

## Relevant Constitution Excerpts
> No worker may mark its own work complete; every PASS requires independent checker-inspected
> evidence.

## Most Recent Failure
None. This is attempt 1 for T073b1 (attempt count: 0) — first dispatch.

## Context Note
This task exists specifically to shrink the blast radius of T073b2's upcoming `login()` signature
change (per boss-architect consultation on the router-wiring series' design). T073b2 is a separate,
larger, not-yet-dispatched task — this task does not implement any part of it, only prepares for it.

## Required Worker Output
- Full diff/new-file listing.
- Confirmation all 10 files' actual assertions are unchanged (only the auth-setup boilerplate
  shrank).
- Any real variations found across the 10 files' original `LoginAs`/wrapper shapes and how your
  shared helper accommodates them.
- Full test/typecheck/lint/build output, with the before/after total test count confirmed unchanged.
- Known risks; whether a dispute is needed (you flag, you don't resolve).
