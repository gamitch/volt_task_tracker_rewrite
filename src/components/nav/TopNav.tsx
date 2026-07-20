/**
 * T006: NAV-02 top navigation bar.
 *
 * `TopNav` contains:
 *  - the VOLT wordmark/logo, linking Home (`routePaths.dashboard`);
 *  - an `ActiveSeasonDisplay` (T115), visible only when the authenticated
 *    user's role is `'admin'` or `'coach'`, showing the ONE real active
 *    season resolved via `useActiveSeason()` (see that hook's own module
 *    doc, `../../app/SeasonProvider.tsx`);
 *  - a user menu (`Avatar` + `DropdownMenu`) with exactly three items, in
 *    order: Profile, Appearance, Sign out.
 *
 * Auth-state edge case: this component mounts as a sibling of `<AppRoutes>`
 * (via `AppShell`), not inside each route's `RequireAuth` guard, so it can
 * render for a moment while `useAuth().user` is still `null` (e.g. a direct
 * navigation to a protected URL, in the instant before `RequireAuth`
 * redirects to `/login`). Every read of `user` below is null-safe
 * (`user?.role`, `user ? ... : null`), and the season display / user menu
 * sections are skipped entirely when there is no authenticated user, rather
 * than assuming `user` is always non-null.
 *
 * D004 note (T008 rework): this file needs no edit for NAV-05's "triggered
 * from TopNav" mobile-drawer-toggle requirement. `AppShell.tsx` wires
 * `mobileNav={{ content: <MobileNav /> }}` (the `MobileNavConfig` object
 * form); any non-ReactNode `mobileNav` value puts the installed
 * `@astryxdesign/core@0.1.6` `TopNav` into its "mobile-bar" render mode
 * below the 768px breakpoint, which auto-injects its own `MobileNavToggle`
 * inside the real `TopNav` bar with no project code required. T008's
 * attempt-1 edit here (`startContent={<MobileNavToggle />}`) has been
 * reverted: under mobile-bar mode `startContent` is not rendered at all
 * below the breakpoint, so that edit was permanently dead code. See
 * docs/swarm/dispute-log.md D004 for the full evidence and ruling.
 *
 * -----------------------------------------------------------------------
 * T115 (PRD v2 SCH-02): replaces the old `PLACEHOLDER_SEASON_OPTIONS`
 * two-item fixture `Selector` ("2025-2026 Season (placeholder active
 * season)") with a real, honest display of the ONE combined active season
 * (D-2, decided by George: "One season for all and reporting will handle
 * the team metrics" -- no per-program seasons, so there is never more than
 * one real option to choose from).
 *
 * 1. Provider-position investigation (worker packet Trap #1) -- verified,
 *    not assumed. `SeasonProvider.tsx`'s own module doc ("Mount point"
 *    section) and `AppShell.tsx`'s own module doc (T091 paragraph) both
 *    independently confirm `SeasonProvider` wraps `AppShell`'s normal
 *    (non-chromeless) branch, and `TopNav` is rendered INSIDE that same
 *    branch -- `AppShell.tsx`'s JSX passes `<TopNav />` as the `topNav` prop
 *    of `<AstryxAppShell>`, which itself is nested inside `<SeasonProvider>`
 *    (`AppShell.tsx`, the `return (<SeasonProvider><AstryxAppShell
 *    topNav={<TopNav />} ...>` block). Passing an element as a prop does not
 *    change its position in the React tree/context graph -- `<TopNav />` is
 *    still a descendant of `<SeasonProvider>` for context-resolution
 *    purposes, exactly like `sideNav`/`mobileNav`'s own already-working
 *    slot-content. `TopNav` never renders on the chromeless `/login` /
 *    `/accept-invite` routes at all (`AppShell`'s early return skips
 *    `<TopNav />` entirely there), so there is no case where `TopNav` could
 *    ever mount outside `SeasonProvider`. Conclusion: `TopNav` already
 *    mounts inside `SeasonProvider`'s subtree -- no provider hoist is
 *    needed, and `AppShell.tsx` is therefore NOT touched by this task
 *    (worker packet's own "conditionally allowed" file, condition not met).
 *    `useActiveSeason()` is called directly below, the same way
 *    `ReportsShell.tsx`/`SeasonSettings.tsx` (T091) already do.
 *
 * 2. Control-choice reasoning (worker packet Trap #2) -- a `Selector`
 *    (dropdown), NOT reused here. `astryx-api.md`'s own "Selector" Best
 *    Practices are explicit: "Don't: Use when there are only two options;
 *    use a SegmentedControl or radio buttons instead" -- and under D-2 there
 *    is now only ONE real option ever (the one combined active season), not
 *    even two. A one-option dropdown would be actively misleading (it
 *    implies choices that do not exist) and historical-season switching is
 *    explicitly deferred (PRD v2 SCH-02: "season create/activate stays where
 *    it is (`/settings/season`)"; PRD v2 section 8's guiding principle,
 *    "keep things simple" -- a nav-level season SWITCHER is exactly the kind
 *    of rigor-for-its-own-sake complexity that principle weighs against when
 *    the one-season model makes it unnecessary). `ActiveSeasonDisplay` below
 *    is therefore a plain, NON-interactive labeled display (`HStack` +
 *    `Text`, with a `VisuallyHidden` "Season" label for assistive tech,
 *    since `Text` has no visible-label slot of its own the way `Selector`
 *    did) -- arguably more honest than a one-option `Selector` per the
 *    worker packet's own framing, and matches `astryx-api.md`'s "Text" Best
 *    Practices ("Do: Pick a semantic type... for body copy, labels").
 *
 * 3. DES-12 states (worker packet Trap #2) -- all four `useActiveSeason()`
 *    states are modeled honestly, scaled down to fit a compact nav slot
 *    (this is NOT a full page section the way `ReportsSeasonState` in
 *    `../../pages/reports/ReportsShell.tsx` is):
 *      - `'loading'`: a `Skeleton` sized like the control (roughly the width
 *        of a real season name) plus a `VisuallyHidden` `role="status"`
 *        announcement -- same T081 loading pattern `ReportsShell.tsx`/
 *        `SeasonSettings.tsx` already use, scaled to nav size.
 *      - `'none'`: muted `Text` reading "No active season" -- NEVER a
 *        fabricated year (worker packet's own explicit instruction). No
 *        create-a-season action is offered here (that flow lives at
 *        `/settings/season`, unchanged, per SCH-02).
 *      - `'error'`: `ReportsShell.tsx`'s own `'error'` treatment (a real
 *        `SupabaseLoaderError` message + a `refresh()`-wired Retry action)
 *        SCALED DOWN for a nav control, not its full-size `Banner` (a
 *        `Banner` is documented as "a persistent message at the TOP OF A
 *        PAGE OR SECTION" -- oversized and out of place stacked inline next
 *        to the user avatar menu, and would risk exploding the nav's fixed
 *        height, the worker packet's own explicit "must not explode the
 *        page" constraint). Instead: a compact `Badge` (`variant="error"`,
 *        one-two word label, exactly the "system status that demands
 *        attention" case `astryx-api.md`'s own Badge Best Practices call
 *        out) plus a `size="sm"` `variant="ghost"` `Button` "Retry" calling
 *        `useActiveSeason().refresh()` -- the same retry mechanism
 *        `ReportsSeasonState`/`SeasonSettings.tsx` already use, just without
 *        the full `Banner` chrome.
 *      - `'ready'`: the real `season.name` (e.g. "2026-27"), never the old
 *        placeholder string.
 *
 * 4. Astryx prop sourcing (constitution item 2) -- every prop cited below
 *    grepped directly against `docs/swarm/astryx-api.md` for this task:
 *      - `HStack` ("Stack" Props table): `gap`, `vAlign` used.
 *      - `Text` ("Text" Props table): `type`, `color`, `weight` used.
 *      - `VisuallyHidden` ("VisuallyHidden" Props table): `children`, `as`,
 *        `role="status"` (an HTML attribute passed through, same posture
 *        `ReportsShell.tsx`'s `VisuallyHidden` usage already establishes)
 *        used.
 *      - `Skeleton` ("Skeleton" Props table): `width`, `height` used.
 *      - `Badge` ("Badge" Props table): `variant="error"`, `label` used.
 *      - `Button` ("Button" Props table): `label`, `variant="ghost"`,
 *        `size="sm"`, `onClick` used.
 *      - `Selector`/`SelectorOptionType` are no longer imported here at all
 *        (reasoning above).
 */
import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Avatar,
  Badge,
  Button,
  DropdownMenu,
  HStack,
  Skeleton,
  Text,
  TopNav as AstryxTopNav,
  TopNavHeading,
  VisuallyHidden,
} from '@astryxdesign/core';
import { routePaths } from '../../app/router';
import { useAuth } from '../../app/guards';
import { useActiveSeason } from '../../app/SeasonProvider';

/**
 * Module doc #3 above. Rendered only when `isSeasonSelectorVisible`
 * (unchanged role gating, worker packet Trap #3) -- `TopNav` itself decides
 * visibility; this component only decides WHAT to render once visible.
 */
function ActiveSeasonDisplay(): ReactNode {
  const activeSeason = useActiveSeason();

  switch (activeSeason.status) {
    case 'loading':
      return (
        <HStack gap={2} vAlign="center" aria-busy="true">
          <VisuallyHidden as="div" role="status">
            Loading the active season…
          </VisuallyHidden>
          <Skeleton width={96} height={20} />
        </HStack>
      );
    case 'none':
      return (
        <Text type="supporting" color="secondary">
          No active season
        </Text>
      );
    case 'error':
      return (
        <HStack gap={2} vAlign="center">
          <Badge variant="error" label="Season unavailable" />
          <Button
            variant="ghost"
            size="sm"
            label="Retry loading the active season"
            onClick={activeSeason.refresh}
          >
            Retry
          </Button>
        </HStack>
      );
    case 'ready':
      return (
        <HStack gap={1} vAlign="center">
          <VisuallyHidden>Season</VisuallyHidden>
          <Text type="label" weight="semibold">
            {activeSeason.season.name}
          </Text>
        </HStack>
      );
  }
}

export function TopNav(): ReactNode {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const isSeasonSelectorVisible = user?.role === 'admin' || user?.role === 'coach';

  const handleSignOut = () => {
    logout();
    navigate(routePaths.login, { replace: true });
  };

  return (
    <AstryxTopNav
      label="Main navigation"
      heading={<TopNavHeading heading="VOLT" headingHref={routePaths.dashboard} />}
      endContent={
        user ? (
          <>
            {isSeasonSelectorVisible ? <ActiveSeasonDisplay /> : null}
            <DropdownMenu
              hasChevron={false}
              button={{
                label: `Account menu for ${user.email}`,
                icon: <Avatar name={user.email} size="small" />,
                isIconOnly: true,
              }}
              items={[
                // SET-01 places Profile and Appearance as sections within
                // /settings (there is no separate /profile route in PRD
                // Section 7's route table). A `/settings#profile` /
                // `/settings#appearance` hash-fragment convention matches
                // EML-04's existing `/settings#notifications` pattern.
                { label: 'Profile', onClick: () => navigate('/settings#profile') },
                { label: 'Appearance', onClick: () => navigate('/settings#appearance') },
                { label: 'Sign out', onClick: handleSignOut },
              ]}
            />
          </>
        ) : null
      }
    />
  );
}
