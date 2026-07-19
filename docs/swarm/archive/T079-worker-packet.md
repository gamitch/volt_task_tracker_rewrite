# Worker Packet: T079

## Task ID
T079 — Fix Google OAuth hard-redirect return-leg on `AcceptInvitePage.tsx` (MINOR follow-up from
T077), Epic E3.

## Objective
T077's checker independently confirmed a real, disclosed MINOR gap: `AcceptInvitePage.tsx`'s
`googleSignInStarted` completion signal (a React `useState` boolean) does not survive a genuine
production browser hard redirect. `signInWithGoogle` performs a real `window.location` navigation
to Google and back; on the return leg, the page fully remounts, resetting `googleSignInStarted` to
`false`. At that point, a resolved `user` (from the OAuth callback) looks structurally identical to
"arrived via the invite link with a pre-existing session, did nothing yet" — so the navigate effect
correctly does NOT fire (matching T077's own fix), but this means a real user who genuinely
completed the Google sign-in sees the "Set a password" form again instead of being navigated to
their destination. Not a crash or security issue — the user is genuinely authenticated — but a real
UX gap on the return-leg landing.

## Allowed Files
- `src/pages/accept-invite/AcceptInvitePage.tsx`
- `src/pages/accept-invite/AcceptInvitePage.test.tsx`
- `src/pages/login/LoginPage.tsx` (see Known Context #2 — only if your investigation confirms an
  analogous issue exists there too)
- `src/pages/login/LoginPage.test.tsx`

## Forbidden Files
- `src/app/guards.tsx` — no contract change needed; this is a page-level fix.
- `src/lib/supabase/**`, `src/app/router.tsx`, every other page.
- `docs/swarm/**`, `.claude/**`.

## Known Context / Traps

**1. The fix needs to survive a real page unload/reload, so React state alone cannot hold it.**
Use `sessionStorage` (survives same-tab navigation, cleared when the tab closes — appropriate for
a short-lived, single-flow signal like this) to persist the "Google sign-in was explicitly
initiated on this page" fact across the redirect: set a flag in `sessionStorage` immediately before
calling `loginWithGoogle` (mirroring where `googleSignInStarted` is currently set), and on mount,
check for that flag (not just the in-memory `useState`) before deciding whether a resolved `user`
represents "just completed OAuth" vs. "arrived with a pre-existing session." Clear the flag once
consumed (read-and-clear, same pattern `guards.tsx`'s own `consumeIntendedUrl()` already
establishes — reuse that idiom, don't invent a different one).

**2. Investigate whether `LoginPage.tsx` has an analogous issue before assuming it doesn't.** T077's
checker suggested "the base case (user clicks Google on login page, returns) has the same issue
structurally," but this needs verification, not blind trust: read `LoginPage.tsx`'s actual current
navigate-effect logic. Unlike `AcceptInvitePage.tsx`, `LoginPage.tsx` may not need to distinguish
"arrived via a link with a pre-existing session" from "completed an action" — for a login page, ANY
resolved authenticated user arguably already means "signed in successfully," with no analogous
"but they haven't set a password yet" complication. If your investigation confirms `LoginPage.tsx`
does NOT have this bug (because its completion semantics are genuinely simpler), say so explicitly
with your reasoning and leave it untouched — do not apply the `AcceptInvitePage.tsx` fix there
just for symmetry if it isn't actually needed.

**3. Test this fix realistically.** Since Vitest/jsdom doesn't perform a real page reload, simulate
the remount by unmounting and remounting the component tree (or an equivalent technique already
established elsewhere in this codebase's test suite) with `sessionStorage` still holding the flag
from a "before" step — proving the completion signal genuinely survives past a component remount,
not just within one render tree's lifetime.

**4. Do not weaken or remove the actual fix T077 built** (the `hasCompletedSetup`/
`googleSignInStarted` state gating the navigate effect, replacing the old "navigate on any resolved
user" logic) — this task extends it to survive a hard redirect, it doesn't revert the underlying
correctness fix.

## Acceptance Criteria
- A genuine Google OAuth hard-redirect return leg (simulated via remount + persisted
  `sessionStorage` flag) correctly navigates the user to their intended destination.
- The flag is read-and-cleared, not left lingering in `sessionStorage` indefinitely.
- `LoginPage.tsx` investigated; either fixed with the same pattern (if genuinely needed) or left
  untouched with explicit reasoning why it wasn't needed.
- `npm run typecheck`, `npm run lint`, `npm run test`, `npm run build`, `npm run format:check` all
  clean, zero regressions.

## Relevant Constitution Excerpts
> No worker may mark its own work complete; every PASS requires independent checker-inspected
> evidence.

## Most Recent Failure
None. This is attempt 1 for T079 (attempt count: 0) — first dispatch.

## Required Worker Output
- Full diff of every changed file.
- Your `sessionStorage` key naming and read-and-clear design.
- Your investigation finding on `LoginPage.tsx` and reasoning either way.
- Full test/typecheck/lint/build output.
- Known risks; whether a dispute is needed (you flag, you don't resolve).
