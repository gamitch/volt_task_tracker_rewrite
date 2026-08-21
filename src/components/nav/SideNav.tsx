/**
 * T007: NAV-03 role-filtered sidebar navigation, NAV-04 active-item
 * highlight + `document.title`, NAV-07 nav-level Meetings/Outreach
 * separation, BEH-04 Outreach badge slot, NAV-01 collapsibility.
 *
 * Attempt 2 fix (checker-accessibility BLOCKER on attempt 1): every
 * `SideNavItem` now passes `as={Link}` (from `react-router-dom`, already
 * allowlisted). Without it, `SideNavItem`'s `href` renders a plain `<a>`,
 * so every click/Enter-activation does a full document navigation instead
 * of an SPA transition -- that reload resets `AuthProvider`'s in-memory
 * session and bounces back to `/login` via `RequireAuth`. `as` is a
 * documented `SideNavItem` prop: `npm run astryx -- component SideNavItem`
 * lists `| \`as\` | \`LinkComponentType\` | -- | Custom link component. |`,
 * resolved via Astryx's `useLinkComponent()` (priority: `as` prop >
 * `LinkProvider` context > native `<a>`, with automatic `to`-prop injection
 * for React Router compatibility). Re-verified fix eliminates the reload
 * (no `load` event refire, session preserved, URL + `document.title` still
 * update correctly) -- see worker output for the live-Playwright evidence.
 *
 * Role filtering (K2 gap): `guards.tsx`'s `Role` union now matches AUTH-05's
 * `admin`/`coach`/`student`/`parent` vocabulary exactly (fixed by T073a;
 * previously a stale `'admin' | 'staff' | 'volunteer' | 'coach'`
 * placeholder). NAV-03's table only produces two distinct visibility sets
 * (Admin/Coach see all 7 items;
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
 *      | `as` | `LinkComponentType` | -- | Custom link component. |
 *      | `isSelected` | `boolean` | `false` | Marks this item as the
 *        current page. |
 *      | `href` | `string` | -- | Navigation URL. |
 *      | `endContent` | `ReactNode` | -- | Right-side content such as
 *        badges or counts. |
 *      | `icon` | `IconType` | -- | Icon displayed in the outline
 *        (unselected) variant. |
 *    (`selectedIcon` also appears in this output -- deliberately unused, see
 *    icon note below.)
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
 * "never error/red" requirement is visible in the code. GAM-301 (T407)
 * round 3: the count is now the real BEH-04 unanswered-future-outreach
 * count, via `useOutreachBadgeCount` (`./useOutreachBadgeCount.ts`), called
 * directly by this component (not threaded through `AppShell.tsx` -- see
 * that hook's own module doc for the full seam-decision record). The badge
 * is omitted entirely (not rendered with a fabricated `0`) whenever the hook
 * returns `null` (unknown/loading/error/staff role).
 *
 * Icons (GAM-437): each item now renders a real icon via `SideNavItem`'s
 * `icon` prop, so a collapsed nav (the `collapsible` prop above) still has
 * something to show besides an empty rail. `icon`/`selectedIcon` are real,
 * non-hallucinated `SideNavItem` props (constitution item 2), verified two
 * ways: `npm run astryx -- component SideNavItem --json` lists both (type
 * `IconType`, "See `npx astryx docs icons` for valid semantic names") and
 * the installed package source itself,
 * `node_modules/@astryxdesign/core/dist/SideNav/SideNavItem.d.ts` --
 * `icon?: ReactNode | IconType` / `selectedIcon?: ReactNode | IconType`,
 * where `IconType = ComponentType<SVGProps<SVGSVGElement>>`
 * (`node_modules/@astryxdesign/core/dist/Icon/Icon.d.ts`). A rendered lucide
 * element (`<House aria-hidden="true" />`, a `ReactNode`) is a valid value
 * for that union -- the *rendered element* is passed at the JSX call site
 * below, not the bare component reference (`NAV_ITEMS` itself still stores
 * the bare component per entry, as data).
 *
 * None of `Icon`'s own ~26 built-in semantic names is a clean match for all
 * 7 items (Home/Meetings/Outreach/Roster/Reports have no equivalent) --
 * dispute-log D021 records this gap and allowlists `lucide-react` (^1.33.0,
 * constitution item 9) as the resolution, since `Icon`'s own props table in
 * astryx-api.md directs callers to lucide/heroicons for anything outside
 * that built-in set. Each of the 7 exports used below (`House`, `Users`,
 * `Megaphone`, `CalendarDays`, `ClipboardList`, `ChartColumn`, `Settings`)
 * was confirmed as a real, exported `lucide-react` symbol before use (not
 * just named by the source issue) via
 * `node_modules/lucide-react/dist/lucide-react.d.ts`.
 *
 * `selectedIcon` is deliberately NOT passed: lucide ships outline-only
 * icons, so there is no filled variant to hand the "selected" slot --
 * faking one (e.g. reusing the same outline icon) would misrepresent what
 * `selectedIcon`'s own doc says it does ("Icon displayed when the item is
 * selected (filled variant)"). This is the disclosed divergence dispute-log
 * D021 already records, not an oversight.
 *
 * The SideNav Anatomy table marks "Product icon and name" as not required,
 * which is why this was previously omitted entirely -- GAM-437 revisits that
 * because a *collapsed* nav has nothing else to render per item once labels
 * disappear, which the Anatomy table's "not required" framing didn't
 * account for.
 *
 * `document.title` scope: only the 7 NAV-03 items (and their sub-routes via
 * the prefix match below) drive `document.title` here. `/login`,
 * `/accept-invite` (chromeless, `SideNav` doesn't render), `/checkin`, and
 * `/kiosk/:sessionId` (no NAV-03 entry) are out of scope by design, not an
 * oversight.
 */
import { useEffect, type ComponentType, type ReactNode, type SVGProps } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Badge, SideNav as AstryxSideNav, SideNavItem, SideNavSection } from '@astryxdesign/core';
import {
  House,
  Users,
  Megaphone,
  CalendarDays,
  ClipboardList,
  ChartColumn,
  Settings,
} from 'lucide-react';
import { routePaths } from '../../app/router';
import { useAuth } from '../../app/guards';
import { useOutreachBadgeCount, type UseOutreachBadgeCountOptions } from './useOutreachBadgeCount';

interface NavItemConfig {
  label: string;
  route: string;
  /** Roster/Reports only -- see NAV-03 table (Admin/Coach only). */
  staffOnly: boolean;
  /** Bare lucide component reference -- see icon note in the module doc
   * above. Rendered as `<icon aria-hidden="true" />` at the call site below,
   * never stored pre-rendered here. */
  icon: ComponentType<SVGProps<SVGSVGElement>>;
}

/** NAV-03's full 7-item table, verbatim route mapping via `routePaths`. */
const NAV_ITEMS: readonly NavItemConfig[] = [
  { label: 'Home', route: routePaths.dashboard, staffOnly: false, icon: House },
  { label: 'Meetings', route: routePaths.meetings, staffOnly: false, icon: Users },
  { label: 'Outreach', route: routePaths.outreach, staffOnly: false, icon: Megaphone },
  { label: 'Calendar', route: routePaths.calendar, staffOnly: false, icon: CalendarDays },
  { label: 'Roster', route: routePaths.roster, staffOnly: true, icon: ClipboardList },
  { label: 'Reports', route: routePaths.reports, staffOnly: true, icon: ChartColumn },
  { label: 'Settings', route: routePaths.settings, staffOnly: false, icon: Settings },
];

export interface SideNavProps {
  /** Test seam: injected options for the badge hook. Production passes
   * nothing (the hook's own real defaults apply). */
  outreachBadgeCountOptions?: UseOutreachBadgeCountOptions;
}

export function SideNav({ outreachBadgeCountOptions }: SideNavProps = {}): ReactNode {
  const { user } = useAuth();
  const location = useLocation();
  const outreachBadgeCount = useOutreachBadgeCount(outreachBadgeCountOptions);

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
            as={Link}
            isSelected={activeItem?.route === item.route}
            icon={<item.icon aria-hidden="true" />}
            endContent={
              // BEH-04: neutral, never-red badge slot -- see module doc
              // "Badge-slot resolution" above. NAV-07: Meetings and
              // Outreach stay two separate SideNavItems with two separate
              // hrefs; only Outreach's own item gets a badge. `null` means
              // "no badge" (module doc, `useOutreachBadgeCount`'s own
              // return-type contract) -- never a fabricated `0`.
              item.label === 'Outreach' && outreachBadgeCount !== null ? (
                <Badge
                  variant="neutral"
                  label={outreachBadgeCount}
                  data-testid="outreach-nav-badge"
                />
              ) : undefined
            }
          />
        ))}
      </SideNavSection>
    </AstryxSideNav>
  );
}
