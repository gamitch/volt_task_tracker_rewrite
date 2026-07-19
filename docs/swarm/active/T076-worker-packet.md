# Worker Packet: T076

## Task ID
T076 — Fix `RequireRole`'s misuse of `NoAccessPage` for routine role-mismatches (Gap B from
T073b2), Epic E3.

## Objective
T073b2 (Passed) changed `RequireRole`'s denial behavior from `<Navigate to="/" />` + a toast to
rendering `<NoAccessPage />` in place. Both the worker and an independent checker later confirmed
(after reading `NoAccessPage.tsx`'s actual built copy/behavior) that this is likely the wrong
screen for this case: `NoAccessPage` (T020, Passed) is explicitly built for AUTH-04's "you're not
on the roster, we are unconditionally signing you out" scenario — a genuinely broken account with
no matching `profiles` row. Reusing it for a routine role-mismatch (e.g. a perfectly valid `coach`
account hitting an `admin`-only page) means:
- The user is fully signed out of a valid session, for no real reason.
- They see "You're not on the roster yet" — factually wrong; they ARE on the roster, they just
  hit a page their role doesn't cover.

This task builds a distinct, non-destructive "wrong page for your role" screen and re-points
`RequireRole`'s role-mismatch branch at it, leaving `NoAccessPage`'s actual AUTH-04 usages (in
`RequireAuth`'s `noProfile` case, and `RequireRole`'s own `isLoading`/`noProfile` early-outs — see
Known Context #2) untouched.

## Allowed Files
- `src/pages/no-access/AccessDeniedPage.tsx` (new)
- `src/pages/no-access/AccessDeniedPage.test.tsx` (new)
- `src/app/guards.tsx`
- `src/app/guards.test.tsx`

## Forbidden Files
- `src/pages/no-access/NoAccessPage.tsx`, `types.ts`, `index.ts` — read-only reference. Do not
  modify; you are adding a sibling, not editing this one.
- `src/lib/supabase/**`, `src/app/router.tsx`, every other page component.
- `docs/swarm/**`, `.claude/**`.

## Known Context / Traps

**1. Read the current `guards.tsx` in full before editing** — it has changed since earlier in this
series (T073b2 wired real auth). The exact spot to change is `RequireRole`'s role-mismatch branch:
```tsx
if (!user || !allowedRoles.includes(user.role)) {
  return <NoAccessPage />;   // <-- change this line to <AccessDeniedPage />
}
```
Do NOT touch the two lines immediately above it (`if (isLoading) return null;` and `if (noProfile)
return <NoAccessPage />;`) — those are genuine AUTH-04 cases and correctly stay pointed at
`NoAccessPage`. Also do NOT touch `RequireAuth`'s own `noProfile` branch (a separate function in
the same file) — same reasoning.

**2. The `!user` half of that branch is a defensive fallback, not the real case this task is
about.** `RequireRole`'s own doc comment already discloses it's meant to be nested inside
`RequireAuth`, so `user` is normally guaranteed non-null by the time this runs — the `!user` half
only matters if `RequireRole` is ever used standalone. `AccessDeniedPage` (this task's new
component) is a reasonable render for that edge case too (there's no real authenticated session to
sign out of in that branch either way, so `NoAccessPage`'s sign-out-on-mount behavior doesn't even
make sense there) — you don't need a third component or a special case, just route the whole
condition to the new component.

**3. `AccessDeniedPage.tsx` design — model it on `NoAccessPage.tsx`'s established composition
(`Center > VStack[Heading level=1 "VOLT", Card > EmptyState]`, the same outer shell
`LoginPage.tsx`/`AcceptInvitePage.tsx`/`NoAccessPage.tsx` all already share, per constitution item
13's "adapt content only, do not invent a custom layout") — but with two deliberate differences**:
- **No sign-out on mount.** This is the core behavioral fix. The user's session is completely
  valid; they just hit a page outside their role. Don't call `useAuth().logout()` anywhere in this
  component.
- **A real action, not none.** `NoAccessPage` deliberately omits any button because, after signing
  the user out, there's genuinely nothing left to do. This screen is different: the user still has
  a valid session and a real home to go to. Include a real action (e.g. a `Button`/`Link` to `/` —
  check `routePaths.dashboard` in `router.tsx`, read-only reference, for the exact path constant)
  labeled something like "Go to your dashboard" or "Go home". This actually matches the Astryx
  `EmptyStateContainer` skeleton's default shape more closely than `NoAccessPage` does (that
  skeleton includes action buttons by default; `NoAccessPage`'s own module doc explains in detail
  why it omitted them — read that reasoning, then note why it does NOT apply here).

**4. Copy — must NOT claim the user isn't on the roster.** They are. Write copy that's accurate for
a role-mismatch: something conveying "this page isn't available for your role" (not "your account
wasn't found" or any variant implying account/roster trouble). Word it well; this is real
user-facing copy per DES-14/DES-16's plain-language requirements (no jargon, say what happened and
what to do) — check those PRD sections if you want the exact phrasing bar, but the core content
requirement is: accurate about what happened (wrong page for your role, not "you're not
recognized"), and offers the real "go home" action per Trap #3.

**5. No data-loading seam needed.** Unlike `NoAccessPage`, this screen has no ambiguous "which
team's contact" problem to solve (per `NoAccessPage.tsx`'s own disclosed gap #2) — the user is a
valid, resolved account with a real role; there's nothing to look up. Keep this component simpler:
static copy plus the one real action link, no `loadData` prop, no async state.

## Acceptance Criteria
- `AccessDeniedPage.tsx` exists, renders without signing the user out, includes a real working
  navigation action to `/`, and its copy is accurate (does not claim the user isn't on the roster).
- `RequireRole`'s role-mismatch branch renders `AccessDeniedPage`, not `NoAccessPage`.
- `RequireAuth`'s `noProfile` branch and `RequireRole`'s own `isLoading`/`noProfile` branches are
  completely unchanged, still rendering `NoAccessPage`.
- New test coverage proves: (a) a role-denied but otherwise valid user sees `AccessDeniedPage`, not
  `NoAccessPage`; (b) that user's session/`user` state is genuinely still intact afterward (not
  signed out) — observe this the same way `SettingsPage.test.tsx`'s existing logout test does
  (render an `AuthObserver` component alongside, assert `user` is still non-null after the
  role-denied render, not cleared); (c) the real "go home" action is present and points to `/`.
- `npm run typecheck`, `npm run lint`, `npm run test`, `npm run build`, `npm run format:check` all
  clean, zero regressions.

## Relevant Constitution Excerpts
> Constitution item 13: adapt content only, do not invent a custom layout — reuse the established
> `Card > EmptyState` composition, don't build something new.

> DES-14/DES-16 (paraphrased): plain-language copy, say what happened and what to do, no jargon, no
> factually-inaccurate claims.

## Most Recent Failure
None. This is attempt 1 for T076 (attempt count: 0) — first dispatch.

## Context Note
This task exists because T073b2's own packet (written by the orchestrator, following an earlier
boss-architect consultation's general recommendation) instructed `RequireRole` to reuse
`NoAccessPage` for role-mismatches. Both the T073b2 worker and its checker, after reading
`NoAccessPage.tsx`'s actual built semantics, independently judged this to be a real design defect
(MAJOR severity) rather than an acceptable choice — this task is the correction, not a dispute
against T073b2's own work (which correctly implemented what its packet asked for).

## Required Worker Output
- Full diff/new-file listing.
- Your exact copy for `AccessDeniedPage.tsx`'s title/description, and your reasoning that it's
  accurate for the role-mismatch case.
- Confirmation `NoAccessPage.tsx` and its two still-correct usages in `guards.tsx` are untouched.
- Full test/typecheck/lint/build output.
- Known risks; whether a dispute is needed (you flag, you don't resolve).
