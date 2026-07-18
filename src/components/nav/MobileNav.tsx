/**
 * T008: NAV-05 mobile counterpart to `SideNav` (T007) -- a slide-out drawer
 * shown below 768px, intended to be triggered from `TopNav` via
 * `MobileNavToggle` (astryx-api.md line 4698: "Inside AppShell, use
 * MobileNavToggle as the trigger; it reads state from context
 * automatically.").
 *
 * *** KNOWN BLOCKER (verified via installed component source + live
 * Playwright, not assumed -- see worker output for full evidence) ***
 * The `mobileNav={<MobileNav />}` ReactNode-shorthand wiring in
 * `AppShell.tsx` (the exact, packet-mandated edit, matching astryx-api.md's
 * own sanctioned example at line 2549/4703) produces a **non-functional**
 * `MobileNavToggle` in the actually-installed `@astryxdesign/core@0.1.6`:
 * reading that package's own `AppShell.tsx` source shows `mobileNavEnabled`
 * (the flag `MobileNavToggle`/`openMobileNav` gate their rendering/behavior
 * on) is computed as
 * `!mobileNavDisabled && hasNavContent && mobileNavReactNode == null` --
 * i.e. it is **forced `false`** whenever `mobileNav` is passed as a raw
 * ReactNode (our case), even though astryx-api.md's prose claims
 * "Inside AppShell, this is managed automatically via context" for this
 * exact usage with no such carve-out documented anywhere. Confirmed live:
 * at <768px in the real signed-in app, `MobileNavToggle` renders nothing at
 * all (no button in the DOM, not even hidden), and even forcing the native
 * `<dialog>` open via `showModal()` directly has no visual effect (Astryx's
 * own `display:none` styling is gated on the same permanently-`false`
 * `isOpen` state). The only in-source fix identified (not applied here,
 * since it exceeds this task's packet-mandated "exactly these two edits"
 * scope for `AppShell.tsx`) is switching to the `MobileNavConfig`
 * config-object form: `mobileNav={{ content: <MobileNav ... /> }}`, which
 * this same source shows resolves `mobileNavReactNode` to `null` and lets
 * `mobileNavEnabled` evaluate `true`. Flagged as a dispute candidate -- see
 * worker output. Everything else in this file (drawer content, active-item
 * highlight, `as={Link}` SPA nav, the `document.title` effect, close
 * behavior) was independently verified via a working-context scratch
 * harness and is correct on its own merits; only the real app's trigger
 * path is broken.
 *
 * This component intentionally duplicates most of `SideNav.tsx`'s internals
 * (`NAV_ITEMS`, `isStaffRole` filtering, active-item matching, the Outreach
 * `Badge` slot, and the `document.title` effect) rather than importing from
 * it. `SideNav.tsx` is a forbidden file for this task (already Passed under
 * T007) and exports only the `SideNav` component -- no shared `NAV_ITEMS`
 * array to import, even though astryx-api.md's own Best Practice says
 * "Do: Share the same nav items between MobileNav and SideNav by extracting
 * them into a variable" (line 4723). This duplication is a disclosed,
 * intentional limitation, not an oversight: a future task (whenever
 * `SideNav.tsx` is next legitimately open for edits) should extract a
 * shared `NAV_ITEMS` module. This task does not create that follow-up task
 * itself, only flags it.
 *
 * Astryx prop sourcing (constitution item 2), all verbatim from
 * `docs/swarm/astryx-api.md`:
 *  - `MobileNav`'s `children`/`header` props: doc lines 4730-4741 (Props
 *    table). `isOpen`/`onOpenChange` are deliberately NOT passed here --
 *    the doc states both are "managed automatically via context" when
 *    `MobileNav` is used inside `AppShell`'s `mobileNav` slot (which is how
 *    `AppShell.tsx` wires this component), and passing them ourselves would
 *    fight that context mechanism (same class of error the doc explicitly
 *    forbids for `MobileNavToggle` at line 4725: "Do not pass
 *    isOpen/onOpenChange to the toggle").
 *  - `header="Navigation"`: doc line 4739 ("Pass a string for a simple text
 *    heading") and Best Practice line 4724 ("Do: Provide a header when the
 *    drawer's purpose is not obvious from its content"). Unlike `SideNav`'s
 *    `header` prop (which T007 correctly omitted to avoid duplicating
 *    `TopNav`'s brand identity via `SideNavHeading`), `MobileNav`'s `header`
 *    explicitly supports a plain string and is not a `SideNavHeading`/logo
 *    duplication risk -- this is a disclosed, optional choice, not a
 *    requirement.
 *  - `SideNavItem`/`SideNavSection`/`Badge` props: astryx-api.md documents
 *    `MobileNav` as accepting "the same children" as `SideNav` (line 4698),
 *    so these are the exact same props T007 already cross-checked via the
 *    CLI (`npm run astryx -- component <Name>`, cited verbatim in
 *    `SideNav.tsx`'s own module doc and archived
 *    `docs/swarm/archive/T007-worker-packet.md`) -- not re-derived here:
 *      `SideNavItem`: `label: string` (required), `as: LinkComponentType`,
 *        `isSelected: boolean` (default `false`), `href: string`,
 *        `endContent: ReactNode`.
 *      `SideNavSection`: `title: string` (required, CLI-confirmed over the
 *        doc's own internally-inconsistent `heading`/`title` Example
 *        block), `children: ReactNode`.
 *      `Badge`: `variant`, `label: ReactNode`.
 *
 * `as={Link}` (T007's proven fix, applied here from the start -- not
 * rediscovered): T007's attempt 1 shipped `SideNavItem` with a plain `href`
 * and no `as` prop, which caused a full page reload on every click/Enter
 * activation (loses the in-memory `AuthProvider` session, bounces to
 * `/login`). Every `SideNavItem` below passes `as={Link}` (from
 * `react-router-dom`) from the first attempt.
 *
 * `document.title` / NAV-04 parity (investigated, not assumed -- see worker
 * output for the live-Playwright evidence): astryx-api.md documents that
 * `AppShell` "handles responsive mobile navigation... automatically" (line
 * 2539) but does not document whether `SideNav` is unmounted (vs. just
 * CSS-hidden) below 768px. Live-resizing the real signed-in app's viewport
 * from 1280px down to 375px (same page, same session, no reload) and
 * inspecting the DOM confirms `SideNav`'s `<a href="/meetings">`-style
 * elements disappear from the DOM entirely below 768px (only the
 * `MobileNav` drawer's copy remains, inside its `<dialog>`) -- `SideNav` is
 * genuinely unmounted, not just CSS-hidden, so its `document.title` effect
 * cannot fire below 768px. This effect is therefore duplicated here as the
 * load-bearing fix for NAV-04 parity on mobile (confirmed by force-clicking
 * a drawer nav item at 375px in the real app and observing `document.title`
 * update correctly to the new route's label), not a redundant safety net.
 *
 * Drawer-close-on-navigate (empirically tested via the scratch harness
 * noted above, not assumed): astryx-api.md documents `MobileNav` closing
 * via "backdrop click, Escape key, or close button" (line 4737) but does
 * not document whether selecting a `SideNavItem` inside it also closes the
 * drawer. Live testing (with a working, manually-supplied context so the
 * drawer could actually be opened) confirms the drawer does **NOT**
 * auto-close on `SideNavItem` selection: the native `<dialog>` stayed
 * `open === true` after clicking a nav item and navigating via `as={Link}`.
 * This is internal `AstryxMobileNav` behavior with no exposed prop to
 * change it, and no manual `onOpenChange` override was added here (that
 * would violate the "don't pass isOpen/onOpenChange inside AppShell" rule
 * above). Flagged as a UX gap / dispute candidate in worker output --
 * moot in the real app today since the trigger itself doesn't work (see
 * KNOWN BLOCKER above), but relevant once that is fixed.
 */
import { useEffect, type ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  Badge,
  MobileNav as AstryxMobileNav,
  SideNavItem,
  SideNavSection,
} from '@astryxdesign/core';
import { routePaths } from '../../app/router';
import { useAuth } from '../../app/guards';

/**
 * BEH-04 placeholder unanswered-RSVP count for the Outreach nav item. No
 * real outreach/RSVP data source exists yet as of this task -- the real
 * count is wired by T038. Duplicated verbatim from `SideNav.tsx`'s own
 * placeholder (see "Item-list duplication" note above).
 */
const PLACEHOLDER_OUTREACH_BADGE_COUNT = 0;

interface NavItemConfig {
  label: string;
  route: string;
  /** Roster/Reports only -- see NAV-03 table (Admin/Coach only). */
  staffOnly: boolean;
}

/**
 * NAV-03's full 7-item table, verbatim route mapping via `routePaths`.
 * Duplicated from `SideNav.tsx` -- see module doc "Item-list duplication"
 * above.
 */
const NAV_ITEMS: readonly NavItemConfig[] = [
  { label: 'Home', route: routePaths.dashboard, staffOnly: false },
  { label: 'Meetings', route: routePaths.meetings, staffOnly: false },
  { label: 'Outreach', route: routePaths.outreach, staffOnly: false },
  { label: 'Calendar', route: routePaths.calendar, staffOnly: false },
  { label: 'Roster', route: routePaths.roster, staffOnly: true },
  { label: 'Reports', route: routePaths.reports, staffOnly: true },
  { label: 'Settings', route: routePaths.settings, staffOnly: false },
];

export function MobileNav(): ReactNode {
  const { user } = useAuth();
  const location = useLocation();

  // K2 gap workaround (same as SideNav/TopNav) -- see module doc above.
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

  // Load-bearing at <768px, not redundant -- see module doc "document.title
  // / NAV-04 parity" above for the investigation this is based on.
  useEffect(() => {
    document.title = activeItem ? `${activeItem.label} · VOLT` : 'VOLT';
  }, [activeItem]);

  return (
    <AstryxMobileNav header="Navigation">
      <SideNavSection title="Main">
        {visibleItems.map((item) => (
          <SideNavItem
            key={item.route}
            label={item.label}
            href={item.route}
            as={Link}
            isSelected={activeItem?.route === item.route}
            endContent={
              // BEH-04: neutral, never-red badge slot -- see SideNav.tsx's
              // own "Badge-slot resolution" doc for the full reasoning
              // (duplicated behavior, not re-derived here).
              item.label === 'Outreach' ? (
                <Badge variant="neutral" label={PLACEHOLDER_OUTREACH_BADGE_COUNT} />
              ) : undefined
            }
          />
        ))}
      </SideNavSection>
    </AstryxMobileNav>
  );
}
