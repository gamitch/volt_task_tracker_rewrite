/**
 * T006: NAV-02 top navigation bar.
 *
 * `TopNav` contains:
 *  - the VOLT wordmark/logo, linking Home (`routePaths.dashboard`);
 *  - a season `Selector`, visible only when the authenticated user's role
 *    is `'admin'` or `'coach'`, defaulting to a placeholder "active" season
 *    (see `PLACEHOLDER_SEASON_OPTIONS` below -- no real season data source
 *    exists yet, see that constant's doc comment);
 *  - a user menu (`Avatar` + `DropdownMenu`) with exactly three items, in
 *    order: Profile, Appearance, Sign out.
 *
 * Auth-state edge case: this component mounts as a sibling of `<AppRoutes>`
 * (via `AppShell`), not inside each route's `RequireAuth` guard, so it can
 * render for a moment while `useAuth().user` is still `null` (e.g. a direct
 * navigation to a protected URL, in the instant before `RequireAuth`
 * redirects to `/login`). Every read of `user` below is null-safe
 * (`user?.role`, `user ? ... : null`), and the season selector / user menu
 * sections are skipped entirely when there is no authenticated user, rather
 * than assuming `user` is always non-null.
 */
import { useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Avatar,
  DropdownMenu,
  Selector,
  TopNav as AstryxTopNav,
  TopNavHeading,
  type SelectorOptionType,
} from '@astryxdesign/core';
import { routePaths } from '../../app/router';
import { useAuth } from '../../app/guards';

/**
 * No real season-fetching task has run yet (no Supabase-backed season data
 * source exists as of T006). This is a clearly-labeled placeholder list
 * standing in for "the active season" until a future task (most likely
 * whichever task first wires season data -- T029 or a shared season
 * context) replaces it with real data. Same category of intentional
 * placeholder as T008's `StudentHomeSlot`.
 */
const PLACEHOLDER_SEASON_OPTIONS: SelectorOptionType[] = [
  { value: '2025-2026', label: '2025-2026 Season (placeholder active season)' },
  { value: '2024-2025', label: '2024-2025 Season (placeholder)' },
];
const PLACEHOLDER_ACTIVE_SEASON = '2025-2026';

export function TopNav(): ReactNode {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [seasonValue, setSeasonValue] = useState(PLACEHOLDER_ACTIVE_SEASON);

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
            {isSeasonSelectorVisible ? (
              <Selector
                label="Season"
                isLabelHidden
                options={PLACEHOLDER_SEASON_OPTIONS}
                value={seasonValue}
                onChange={setSeasonValue}
                size="sm"
              />
            ) : null}
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
