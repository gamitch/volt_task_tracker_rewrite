/**
 * T007: NAV-03 role-filtered sidebar navigation, NAV-04 active-item
 * highlight + `document.title`, NAV-07 nav-level Meetings/Outreach
 * separation, BEH-04 Outreach badge slot, NAV-01 collapsibility.
 *
 * Role filtering (K2 gap): `guards.tsx`'s `Role` union is
 * `'admin' | 'staff' | 'volunteer' | 'coach'`, not the PRD's
 * `admin`/`coach`/`student`/`parent` vocabulary (AUTH-05). `guards.tsx` is a
 * forbidden file for this task and is not fixed here. NAV-03's table only
 * produces two distinct visibility sets (Admin/Coach see all 7 items;
 * Student/Parent see 5, no Roster/no Reports), so item *visibility* only
 * needs an "is this a staff-tier role" check -- it never needs to
 * distinguish `student` from `parent` (that only matters for page-level
 * RSVP behavior inside Meetings/Outreach, out of scope for the nav itself).
 * This mirrors TopNav's (T006) existing `isStaffRole` check verbatim,
 * including null-safety: `user === null` degrades to the non-staff 5-item
 * set rather than crashing.
 *
 * Astryx prop sourcing (constitution item 2):
 *  - `AstryxSideNav`'s `collapsible` prop: astryx-api.md "SideNav" Props
 *    table (packet-embedded excerpt, doc lines ~5659-5744, `collapsible`
 *    row). Passed as the bare boolean (uncontrolled mode with its own
 *    default toggle button) rather than the `handleRef` +
 *    `SideNavCollapseButton`-in-`TopNav` pattern shown in the doc's
 *    Example block, specifically so NAV-01's collapsibility requirement is
 *    met without editing the forbidden `TopNav.tsx`.
 *  - No `header`/`SideNavHeading` is passed: the doc's own Best Practice
 *    ("Don't: Include a SideNavHeading when a TopNav is already providing
 *    app identity; this duplicates branding") rules it out -- `TopNav`
 *    (T006) already renders the VOLT wordmark via `TopNavHeading`.
 *  - `SideNavHeading`/`SideNavItem`/`SideNavSection`/`SideNavCollapseButton`
 *    have no Props table in astryx-api.md at all (doc-generation gap, same
 *    category as T006's `Theme` gap / T002's `astryx-augment.d.ts` gap).
 *    Per the worker packet's mandated cross-check, `npm run astryx --
 *    component <Name>` output is cited verbatim below for every prop used
 *    from these four components; nothing is used here that appears in
 *    neither the doc's Example block nor this CLI output.
 *
 *    `npm run astryx -- component SideNavItem` (verbatim, relevant rows):
 *      | `label` | `string` | -- | Item label. (required) |
 *      | `isSelected` | `boolean` | `false` | Marks this item as the
 *        current page. |
 *      | `href` | `string` | -- | Navigation URL. |
 *      | `endContent` | `ReactNode` | -- | Right-side content such as
 *        badges or counts. |
 *    (`icon`/`selectedIcon` also appear in this output but are
 *    deliberately omitted -- see icon note below.)
 *
 *    `npm run astryx -- component SideNavSection` (verbatim, relevant
 *    rows):
 *      | `title` | `string` | -- | Section title. (required) |
 *      | `children` | `ReactNode` | -- | Section items. |
 *    Note the doc's own Example block is internally inconsistent here --
 *    one snippet shows `<SideNavSection heading="Main">`, another shows
 *    `<SideNavSection title="Main">`. The CLI is the tie-breaker per the
 *    packet's mandated-cross-check instruction (this doc section has no
 *    Props table to override, so the normal "CLI is a cross-check, not a
 *    source" rule doesn't block using it to resolve a real, disclosed
 *    doc gap): `title` is used below.
 *
 *    `AstryxSideNav`'s own `collapsible` prop (documented, not part of the
 *    CLI-gap set) is cited above from the doc directly.
 *
 * Badge-slot resolution (BEH-04): path 2 of the packet's "Badge-slot
 * resolution path" applies -- the CLI confirms `SideNavItem` has a real
 * dedicated `endContent: ReactNode` slot ("Right-side content such as
 * badges or counts", verbatim above), so the Outreach item's badge is
 * passed via `endContent={<Badge variant="neutral" .../>}` rather than
 * composing a `ReactNode` into `label` (path 1 is explicitly *not* used:
 * the CLI shows `label` is `string`, not `ReactNode`, so that composition
 * would itself be an undocumented-prop-type guess). `variant="neutral"` is
 * passed explicitly (never inferred from the component default) so the
 * "never error/red" requirement is visible in the code. The count itself
 * (`PLACEHOLDER_OUTREACH_BADGE_COUNT`) is a disclosed placeholder, same
 * spirit as TopNav's `PLACEHOLDER_SEASON_OPTIONS` (T006) -- the real
 * unanswered-RSVP count is wired later by T038.
 *
 * Icons: deliberately omitted. None of `Icon`'s built-in semantic names is
 * a clean match for these 7 items, and the dependency allowlist
 * (constitution item 9) does not include an icon package (the doc's own
 * `SideNavItem` icon examples use `@heroicons/react`, not authorized here).
 * The SideNav Anatomy table marks "Product icon and name" as not required.
 *
 * `document.title` scope: only the 7 NAV-03 items (and their sub-routes via
 * the prefix match below) drive `document.title` here. `/login`,
 * `/accept-invite` (chromeless, `SideNav` doesn't render), `/checkin`, and
 * `/kiosk/:sessionId` (no NAV-03 entry) are out of scope by design, not an
 * oversight.
 */
import { useEffect, type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { Badge, SideNav as AstryxSideNav, SideNavItem, SideNavSection } from '@astryxdesign/core';
import { routePaths } from '../../app/router';
import { useAuth } from '../../app/guards';

/**
 * BEH-04 placeholder unanswered-RSVP count for the Outreach nav item. No
 * real outreach/RSVP data source exists yet as of this task -- the real
 * count is wired by T038. Same category of clearly-labeled placeholder as
 * TopNav's `PLACEHOLDER_SEASON_OPTIONS` (T006).
 */
const PLACEHOLDER_OUTREACH_BADGE_COUNT = 0;

interface NavItemConfig {
  label: string;
  route: string;
  /** Roster/Reports only -- see NAV-03 table (Admin/Coach only). */
  staffOnly: boolean;
}

/** NAV-03's full 7-item table, verbatim route mapping via `routePaths`. */
const NAV_ITEMS: readonly NavItemConfig[] = [
  { label: 'Home', route: routePaths.dashboard, staffOnly: false },
  { label: 'Meetings', route: routePaths.meetings, staffOnly: false },
  { label: 'Outreach', route: routePaths.outreach, staffOnly: false },
  { label: 'Calendar', route: routePaths.calendar, staffOnly: false },
  { label: 'Roster', route: routePaths.roster, staffOnly: true },
  { label: 'Reports', route: routePaths.reports, staffOnly: true },
  { label: 'Settings', route: routePaths.settings, staffOnly: false },
];

export function SideNav(): ReactNode {
  const { user } = useAuth();
  const location = useLocation();

  // K2 gap workaround -- see module doc above. Matches TopNav's (T006)
  // `isStaffRole` check verbatim, including null-safety.
  const isStaffRole = user?.role === 'admin' || user?.role === 'coach';
  const visibleItems = NAV_ITEMS.filter((item) => !item.staffOnly || isStaffRole);

  // NAV-04 active-item matching: exact match for Home ("/"), prefix match
  // for everything else so sub-routes (e.g. /outreach/:eventId) still
  // highlight their parent nav item and inherit its document.title.
  const activeItem = visibleItems.find((item) =>
    item.route === routePaths.dashboard
      ? location.pathname === item.route
      : location.pathname === item.route || location.pathname.startsWith(`${item.route}/`),
  );

  useEffect(() => {
    document.title = activeItem ? `${activeItem.label} · VOLT` : 'VOLT';
  }, [activeItem]);

  return (
    <AstryxSideNav collapsible>
      <SideNavSection title="Main">
        {visibleItems.map((item) => (
          <SideNavItem
            key={item.route}
            label={item.label}
            href={item.route}
            isSelected={activeItem?.route === item.route}
            endContent={
              // BEH-04: neutral, never-red badge slot -- see module doc
              // "Badge-slot resolution" above. NAV-07: Meetings and
              // Outreach stay two separate SideNavItems with two separate
              // hrefs; only Outreach's own item gets a badge.
              item.label === 'Outreach' ? (
                <Badge variant="neutral" label={PLACEHOLDER_OUTREACH_BADGE_COUNT} />
              ) : undefined
            }
          />
        ))}
      </SideNavSection>
    </AstryxSideNav>
  );
}
