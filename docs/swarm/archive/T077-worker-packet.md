# Worker Packet: T077

## Task ID
T077 — Real invite-completion password flow (Gap A from T073b2), Epic E3.

## Objective
T073b2 (Passed) migrated `AcceptInvitePage.tsx`'s "Set a password" submit handler to call the real
`login(email, password)` instead of the old placeholder. This was correctly disclosed as an
incomplete fix, not a working one: `login()` performs a genuine Supabase *sign-in* attempt — it does
not set a password on the backend at all. There is no real password to sign in with yet, so this
call will genuinely fail for any actual invited user. This task builds the real fix.

**Read this whole packet before writing any code — Known Context #2 below describes a second,
deeper bug this task also needs to fix, not just "add the missing Supabase call."**

## Ground Truth — how the real invite mechanism actually works (verified, not guessed)
- `supabase/functions/send-invite/index.ts` (read-only reference) calls Supabase's own
  `adminClient.auth.admin.inviteUserByEmail(email, { data: {...} })` at invite-*send* time. This
  creates the `auth.users` row immediately and emails the invitee a link containing an access
  token.
- `supabase/migrations/20260718000000_invite_trigger.sql` (read-only reference, T019) installs a DB
  trigger that fires around that user's first sign-in (i.e., when they click the emailed link) and
  creates their matching `profiles` row with the invited role. **Read this migration file in full**
  to understand exactly when it fires relative to the client-side session becoming available —
  don't assume timing, verify it.
- **This means clicking the invite link establishes a real, valid Supabase session client-side**,
  using the same auto-parse-the-callback-URL mechanism `guards.tsx`'s `AuthProvider` already relies
  on for the Google OAuth return leg (`getInitialSession()`/`subscribeToAuthStateChange` pick it up
  automatically on mount — no special-case code needed for this page to "receive" that session).
  The invited user is genuinely, if briefly, authenticated the moment they land on this page from
  their email — this is a normal part of Supabase's invite design, not a bug: it's specifically
  what makes `updateUser({ password })` (see below) possible while "signed in" as that
  not-yet-fully-onboarded user.

## Allowed Files
- `src/lib/supabase/auth.ts`
- `src/lib/supabase/auth.test.ts`
- `src/pages/accept-invite/AcceptInvitePage.tsx`
- `src/pages/accept-invite/AcceptInvitePage.test.tsx`

## Forbidden Files
- `src/app/guards.tsx` — `login()`'s contract does not change in this task; this task adds one new
  function to `auth.ts` and changes how `AcceptInvitePage.tsx` calls into it, nothing in `guards.tsx`
  needs to change.
- `src/lib/supabase/client.ts`, `loader.ts`, `types.ts` — read-only reference.
- `src/pages/login/LoginPage.tsx` — do not touch, even though it shares a similar pattern; this
  task's fix is specific to `AcceptInvitePage.tsx`'s different completion semantics (see Known
  Context #2).
- `src/app/router.tsx`, every other page component.
- `docs/swarm/**`, `.claude/**`.

## Known Context / Traps

**1. Add a real `updateUserPassword` function to `src/lib/supabase/auth.ts`, following the file's
own established conventions exactly** (read the whole file first — every existing function follows
the same shape): a thin, typed wrapper around `client.auth.updateUser({ password })`, an injectable
`client` parameter defaulting to `getSupabaseClient()`, letting the raw `AuthError` propagate
unwrapped (matching every sibling function's disclosed error-propagation choice — this file's
module doc explains why). Check the real `@supabase-js` SDK's `updateUser` return shape
(`{ data: { user }, error }`) and decide what this wrapper should return (mirroring
`signInWithPassword`'s "fail loud if the expected data is missing" pattern) — state your choice.

**2. THE CENTRAL DESIGN PROBLEM OF THIS TASK — read carefully.** `AcceptInvitePage.tsx` currently
has a `useEffect` (added by T073b2) that navigates away the moment `useAuth()`'s `user` resolves
(non-null, not loading, not no-profile) — mirroring `LoginPage.tsx`'s identical pattern. For
`LoginPage.tsx` this is correct: reaching a resolved user IS the completion signal, no matter which
sign-in method got them there. **For `AcceptInvitePage.tsx`, per the Ground Truth section above,
this is a real bug**: the invite link itself already establishes a resolved, valid `user` the moment
the page loads — before the visitor has done anything at all, let alone set a password. Under the
current code, once a real backend exists, this effect will fire immediately on page load and
navigate the user away before they ever see or complete the "Set a password" form.

This page has TWO genuinely different completion signals, and they are not both "any resolved
user":
- **Google OAuth path** (`handleGoogleSignIn`): reaching a resolved user after that round trip IS
  completion — same as `LoginPage.tsx`.
- **"Set a password" path** (`handleSetPassword`): merely HAVING a resolved user (from the invite
  link's own session) is NOT completion. Completion is specifically "the user explicitly submitted
  the form AND `updateUserPassword` succeeded."

Design a fix that distinguishes these. One reasonable direction (verify and adjust as needed, don't
blindly copy if you find a better approach — explain your reasoning either way): introduce an
explicit local "onboarding completed" signal (e.g. a `hasCompletedSetup` boolean, `useState(false)`)
that starts `false` and is set `true` only inside `handleSetPassword`'s success path (after
`updateUserPassword` resolves) — then change the navigate-effect's condition to fire when EITHER
the Google path completed OR `hasCompletedSetup` is true, not merely "any resolved user." Think
through how to distinguish "arrived via Google" from "arrived via the invite link with no action
taken yet" without over-engineering — you may find you don't need to distinguish them explicitly if
your `hasCompletedSetup` gate is structured correctly (e.g., start it `true` only via an explicit
success callback from each of the two submit handlers, never from the passive session-resolution
effect itself).

**3. Test this exact race condition explicitly, not just the happy path.** Write a test where the
injected fake `authModule`'s `getInitialSession`/`resolveRole` resolve to an already-valid user on
initial mount (simulating "arrived via the invite link, already has a session") and assert the page
does NOT navigate away and still renders the "Set a password" form, until the form is actually
submitted and succeeds. This is the test that would have caught T073b2's premature-navigation bug —
make sure it's real and would fail against the old (pre-this-task) code.

**4. `handleSetPassword` should call the new `updateUserPassword(password)`, not `login(email,
password)`.** Since a session already exists (from the invite link), there's no need to sign in
again at all — `updateUserPassword` sets the real password on the already-authenticated session.
Remove the `login(...)` call from this handler entirely.

**5. Error handling** — `updateUserPassword` can genuinely fail for real reasons (e.g. password too
weak per Supabase's own policy, or no valid session exists because the invite link expired/was
already used). Surface real errors via the existing `formError`/`describeAuthError` pattern already
established in this file — don't invent a new error-display mechanism.

## Acceptance Criteria
- `src/lib/supabase/auth.ts` has a new, real `updateUserPassword` function following the file's
  established conventions.
- `AcceptInvitePage.tsx`'s "Set a password" flow calls `updateUserPassword`, not `login`.
- The premature-navigation bug (Known Context #2) is fixed and explicitly tested (Known Context #3).
- Google OAuth path's completion behavior is unchanged/still correct.
- `npm run typecheck`, `npm run lint`, `npm run test`, `npm run build`, `npm run format:check` all
  clean, zero regressions.

## Relevant Constitution Excerpts
> No worker may mark its own work complete; every PASS requires independent checker-inspected
> evidence — this is especially true here: the central bug this task fixes (Known Context #2) is
> subtle and easy to miss in review, so the checker will specifically re-derive it, not just trust
> your test.

## Most Recent Failure
None. This is attempt 1 for T077 (attempt count: 0) — first dispatch.

## Context Note
Gap A was originally disclosed by T073b2's own worker as "a real behavior change, correct
architecture but incomplete feature." Investigating it further (reading the real
`send-invite`/T019-trigger mechanism) surfaced the deeper premature-navigation issue in Known
Context #2, which T073b2's own packet did not anticipate — this task's scope reflects that fuller
understanding, not just "add the missing function."

## Required Worker Output
- Full diff of every changed file.
- Your `updateUserPassword` return-type choice and why.
- Your chosen design for distinguishing "arrived via invite link, nothing done yet" from "genuinely
  completed onboarding" (Known Context #2) and why.
- Confirmation the race-condition test (Known Context #3) is real and would fail against the
  pre-this-task code (describe how you verified this, e.g. by temporarily reverting your fix and
  confirming the test fails).
- Full test/typecheck/lint/build output.
- Known risks; whether a dispute is needed (you flag, you don't resolve).
