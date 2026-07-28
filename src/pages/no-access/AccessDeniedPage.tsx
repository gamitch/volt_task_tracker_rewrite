/**
 * T076: `RequireRole`'s (`../../app/guards.tsx`) role-mismatch screen -- the
 * fix for a MAJOR-severity design defect flagged against T073b2 (Passed):
 * `RequireRole` used to render `NoAccessPage` (T020) for a routine
 * role-mismatch (e.g. a valid `coach` account hitting an `admin`-only page).
 * `NoAccessPage` is built for AUTH-04's genuinely different case -- a signed-in
 * session with NO matching `profiles` row at all -- and reacts to that by
 * unconditionally signing the session out on mount and showing "You're not on
 * the roster yet." Reusing it here was wrong on both counts: the user IS on
 * the roster (they have a real, valid `profiles` row and a real role), so
 * signing them out destroys a perfectly good session for no reason, and the
 * copy is simply false for this case.
 *
 * `AccessDeniedPage` is `NoAccessPage`'s sibling for this distinct case, not
 * a replacement for it -- `NoAccessPage` itself is untouched (still correct
 * for `RequireAuth`'s `noProfile` branch and `RequireRole`'s own
 * `isLoading`/`noProfile` early-outs; see `guards.tsx`). This file only
 * replaces `RequireRole`'s role-mismatch branch.
 *
 * Composition: same outer `Center > VStack[Heading level=1 "VOLT", Card]`
 * shell `LoginPage.tsx`/`AcceptInvitePage.tsx`/`NoAccessPage.tsx` already
 * established for this family of screens, and the same `Card > EmptyState`
 * pairing `NoAccessPage.tsx` uses -- per constitution item 13 ("adapt content
 * only, do not invent a custom layout"), reusing the design system's
 * sanctioned composition rather than inventing something new.
 *
 * Two deliberate differences from `NoAccessPage`, both required by this
 * task's packet:
 *
 * 1. NO sign-out on mount. This screen's entire reason to exist is that the
 *    user's session is completely valid -- they only hit a page outside
 *    their role. There is nothing to protect by ending the session, and
 *    doing so would be actively harmful (it would force a re-login for
 *    someone who did nothing wrong). No `useAuth()` call anywhere in this
 *    component -- there is no need to touch auth state at all.
 *
 * 2. A REAL action, not none. `NoAccessPage`'s own module doc explains in
 *    detail why it omits the generic `EmptyStateContainer` skeleton's two
 *    `Button`s: after an unconditional sign-out, there is genuinely nothing
 *    left for that screen's user to do. That reasoning does NOT carry over
 *    here -- this user still has a valid session and a real home to go back
 *    to, so omitting an action here would leave a valid, signed-in user
 *    stranded on a dead end for no reason. The action below is real
 *    navigation (not a data-mutating action), so it is built as a `Link`
 *    rather than a `Button` per the design system's own guidance ("Don't use
 *    a button for navigation... use a link instead"), using the same
 *    `<Link as={RouterLink} href={...}>` SPA-navigation idiom already
 *    established at several other call sites (e.g. `CalendarPage.tsx`,
 *    `LiveConsole.tsx`, `AdminToggles.tsx`) so this is a genuine client-side
 *    route change, not a full page reload.
 *
 * `DASHBOARD_PATH` below is the literal string `'/'`, deliberately NOT
 * imported from `../../app/router`'s `routePaths.dashboard` constant (its
 * value was read directly from that file, a read-only reference per this
 * task's packet, and confirmed to be `'/'`) -- `router.tsx` itself imports
 * `RequireAuth`/`RequireRole` from `../app/guards`, which imports this file,
 * so importing `router.tsx` back from here would create a real import cycle
 * through `guards.tsx` (`router.tsx` -> `guards.tsx` -> `AccessDeniedPage.tsx`
 * -> `router.tsx`) that no other file in this cluster currently has to cross.
 * A hardcoded literal, with this comment as the paper trail back to the real
 * constant, avoids introducing that cycle while keeping the same value
 * `routePaths.dashboard` resolves to.
 *
 * Copy: see the `EmptyState` `title`/`description` below. Deliberately does
 * NOT say or imply "you're not recognized"/"not on the roster" (DES-14/
 * DES-16: plain language, say what happened and what to do, no inaccurate
 * claims) -- the user IS a valid, resolved account with a real role; the only
 * true thing that happened is that this particular page isn't part of what
 * their role can access.
 *
 * No data-loading seam (unlike `NoAccessPage`'s `loadData`/`NoAccessData`):
 * there is no "which team's contact" ambiguity to solve here (the caller is
 * a valid, resolved account, not an unaffiliated visitor), so this component
 * is fully static -- no async state, no props at all.
 */
import type { ReactNode } from 'react';
import { Card, Center, EmptyState, Heading, Link, VStack } from '@astryxdesign/core';
import { Link as RouterLink } from 'react-router-dom';

/** See module doc above for why this is a hardcoded literal rather than an
 * import of `../../app/router`'s `routePaths.dashboard` -- same value. */
const DASHBOARD_PATH = '/';

export function AccessDeniedPage(): ReactNode {
  return (
    <Center axis="both" height="100vh" width="100%">
      <VStack gap={6} hAlign="center">
        <Heading level={1}>VOLT</Heading>

        <Card width={400} maxWidth="100%" padding={6} variant="default">
          <EmptyState
            title="This page isn't part of your role"
            description="You're signed in and your account is fine -- this specific page just isn't available for your role. Head back to your dashboard, or check with your coach or team admin if you think this is a mistake."
            actions={
              <Link as={RouterLink} href={DASHBOARD_PATH} isStandalone>
                Go to your dashboard
              </Link>
            }
          />
        </Card>
      </VStack>
    </Center>
  );
}

export default AccessDeniedPage;
