# Worker Packet: T007

## Task ID
T007

## Attempt
1 (of 3 before mandatory escalation to boss-arbiter — constitution "Loop Limit").

## Objective
Build `SideNav` (`src/components/nav/SideNav.tsx`), the app's role-filtered sidebar navigation, and wire it into the real app so it actually renders:

1. **NAV-03** — render exactly the item set each authenticated role is entitled to see, per the verbatim table below.
2. **NAV-04** — the currently-active item is highlighted using `SideNavItem`'s own `isSelected` state (not custom CSS), and the current page also sets `document.title` to `"<Item Label> · VOLT"`.
3. **NAV-07** — enforced *at the nav level* only: Meetings and Outreach must remain two separate `SideNavItem`s pointing at two separate routes. Never merge them into one combined nav entry. (The rest of NAV-07 — no combined list *screens* outside Calendar/Reports — is a future page-level concern, not this task's job.)
4. **BEH-04** — the Outreach item gets a neutral count-`Badge` **slot** (never error/red styling). The real unanswered-RSVP count is wired later by T038; for now render a clearly-labeled placeholder count (e.g. `0` or a small fixed number), same spirit as TopNav's `PLACEHOLDER_SEASON_OPTIONS` from T006.
5. **NAV-01** — `SideNav` must be `collapsible` (see Required Composition below).
6. Wire the result into `src/app/AppShell.tsx` (see "AppShell.tsx — Scoped Wiring Edit" below) so `SideNav` is genuinely reachable in the running app, not just buildable in isolation.

## Why AppShell.tsx Is In Scope This Time (read this before you start)

T006 shipped with `sideNav={undefined}` in `AppShell.tsx` as an explicit, sanctioned placeholder — the comment there says outright that `SideNav` "does not exist yet." It now does. If nothing wires `sideNav={<SideNav />}` into `AppShell.tsx`, your component will build and typecheck cleanly but will **never render inside the actual app** — exactly the kind of unlisted-but-load-bearing wiring gap that produced dispute D003 on T006 (a mandated edit that fell outside that task's stated Allowed Files, discovered late and expensively). We are not repeating that. `src/app/AppShell.tsx` is therefore explicitly added to this packet's Allowed Files — see the scoped rule below. Do not treat this as license to make other AppShell.tsx changes.

## Allowed Files
- `src/components/nav/SideNav.tsx` (new)
- `src/app/AppShell.tsx` (edit — **scoped to exactly two mechanical edits, see below**)

## AppShell.tsx — Scoped Wiring Edit (the only permitted changes to this file)
Current relevant lines (`src/app/AppShell.tsx`):
```tsx
import { AppShell as AstryxAppShell } from '@astryxdesign/core';
import { routePaths } from './router';
import { TopNav } from '../components/nav/TopNav';
...
  return (
    <AstryxAppShell topNav={<TopNav />} sideNav={undefined} mobileNav={false}>
      {children}
    </AstryxAppShell>
  );
```
You may make **exactly** these two changes and nothing else:
1. Add one import line for your new component: `import { SideNav } from '../components/nav/SideNav';`
2. Change `sideNav={undefined}` to `sideNav={<SideNav />}` on the existing `<AstryxAppShell>` JSX call.

You may additionally correct the module-doc comment lines that currently describe `sideNav={undefined}` as intentional (they will become false once you wire this in) — this is the only other edit permitted, purely to keep the file's own documentation accurate. Do **not** touch: the `mobileNav={false}` prop or its surrounding prose (still true — `MobileNav` is T008's job), the chromeless `/login`/`/accept-invite` bypass logic, the `topNav` prop, provider order, or anything else in the file. If you believe any further AppShell.tsx change is genuinely required to complete this task, stop and flag it in your worker output as a dispute candidate rather than editing it — do not improvise around this boundary.

**Known, deliberately out-of-scope gap (do not fix):** `/kiosk/:sessionId` is documented elsewhere (router.tsx's own comments) as a "fullscreen" route, which suggests it should probably render chromeless like `/login`/`/accept-invite` do — but `AppShell.tsx` does not currently special-case it, and fixing that is not part of your two permitted edits. Note it in your worker output as a known risk for a future task; do not touch it.

## Forbidden Files
- `docs/swarm/**`, `.claude/**` (constitution-wide, no exceptions)
- `src/app/router.tsx` — **read-only**. Import `routePaths` from here; do not edit.
- `src/app/guards.tsx` — **read-only**. Import `useAuth`, `Role` from here; do not edit. See "Known Role-Type Gap (K2)" below for a real limitation this creates and exactly how to work within it.
- `src/components/nav/TopNav.tsx` — T006, already Passed. Do not touch, including for the `SideNavCollapseButton`/`handleRef` cross-component collapse pattern shown in the Astryx doc (see Required Composition below — use the self-contained collapsible mode instead, specifically to avoid needing to touch this file).
- `src/components/nav/MobileNav.tsx` — T008's file, not yours.
- Anything else outside the two Allowed Files above (`src/pages/**`, `src/theme/**`, migrations, etc.).

## Astryx Ground Truth — Props (verbatim from `docs/swarm/astryx-api.md`; a prop not listed here or confirmed via the CLI cross-check per the gap note below is presumed hallucinated — constitution item 2, MAJOR)

### AppShell — `sideNav` prop only (rest already verified in T006)
`docs/swarm/astryx-api.md` line 2590: `| \`sideNav\` | \`ReactNode\` | — | Side navigation slot, typically SideNav. |`
Line 2566 example: `sideNav={<SideNav>{navSections}</SideNav>}` — confirms `<SideNav>...</SideNav>` passed directly as the prop value is the sanctioned pattern.

### SideNav (astryx-api.md lines 5659–5744)
| Prop | Type | Default | Description |
|---|---|---|---|
| `header` | `ReactNode` | — | Header area (typically `SideNavHeading`). Sticky. |
| `topContent` | `ReactNode` | — | Content below the header, e.g. a create button. |
| `children` | `ReactNode` | — | Navigation sections and items. Scrollable. |
| `footer` | `ReactNode` | — | Footer area above the icon bar. |
| `footerIcons` | `ReactNode` | — | Footer icon bar. |
| `collapsible` | `boolean \| { defaultIsCollapsed?: boolean; isCollapsed?: boolean; onCollapsedChange?: (isCollapsed: boolean) => void; hasButton?: boolean; buttonLabel?: string }` | `false` | Enables collapse behavior. `true` = uncontrolled with a default toggle button; object = controlled/advanced config. |
| `handleRef` | `Ref<SideNavImperativeCollapseHandle>` | — | Imperative collapse handle for a `SideNavCollapseButton` rendered *outside* this `SideNav` (e.g. in `TopNav`). Not needed here — see Required Composition. |
| `xstyle` | `StyleXStyles` | — | StyleX styles only (`stylex.create()` value, never an inline `style={{}}`). |

**Best practice explicitly stated in the doc (line 5729):** *"Don't: Include a `SideNavHeading` when a `TopNav` is already providing app identity; this duplicates branding."* TopNav (T006) already renders the VOLT wordmark via `TopNavHeading`. **Do not pass a `header` prop with a `SideNavHeading`** — this would be a direct violation of the doc's own stated rule, and NAV-02 already owns brand identity.

### SideNavHeading / SideNavItem / SideNavSection / SideNavCollapseButton — DOCUMENTED GAP, read carefully
`astryx-api.md` literally has no Props table for these four (lines 5747–5768 each say `undefined` where a table should be). This is an upstream doc-generation gap, the same category as T006's `Theme` gap and T002/T002a's `astryx-augment.d.ts` gap — **not** a signal that these components lack props, just that this doc has no data for them. Your **only** ground truth is the SideNav "Example" block (astryx-api.md lines 5666–5715), reproduced here verbatim:
```tsx
<SideNav
  header={<SideNavHeading heading="My App" headingHref="/" />}
  topContent={<Button label="Create new" variant="primary" />}>
  <SideNavSection heading="Main">
    <SideNavItem label="Dashboard" isSelected href="/dashboard" />
    <SideNavItem label="Projects" href="/projects" />
  </SideNavSection>
</SideNav>

<SideNav isCollapsible footerIcons={<SideNavCollapseButton />}>
  ...
</SideNav>

const ref = useRef(null);
<TopNav endContent={<SideNavCollapseButton handleRef={ref} />} />
<SideNav handleRef={ref} collapsible>...</SideNav>

<SideNavItem
  label="Dashboard"
  icon={HomeIcon}
  selectedIcon={HomeIconSolid}
  isSelected
  href="/dashboard"
/>
<SideNavItem label="Settings" icon={CogIcon}>
  <SideNavItem label="General" href="/settings/general" />
  <SideNavItem label="Security" href="/settings/security" />
</SideNavItem>
```
From this you can infer, with reasonable confidence: `SideNavItem` accepts `label` (shown only as a plain string in every example — do not assume it also accepts `ReactNode` without confirming, see the Badge-slot note below), `isSelected` (boolean), `href` (string), `icon`/`selectedIcon` (icon component references), and `children` (nested `SideNavItem`s, for submenus — not relevant here, none of your 7 items nest). `SideNavSection` accepts `heading` and `children`. Nothing else about these four sub-components is documented.

**Required action, not optional:** before writing `SideNav.tsx`, run `npm run astryx -- component SideNavItem` (and `SideNavHeading`, `SideNavSection` if useful) as your cross-check. Per constitution item 2 the CLI is normally "a cross-check, not a source" — but that rule exists to stop the CLI from *overriding* a documented prop table. Here there is no prop table to override; the CLI is your only way to fill a real, disclosed gap, exactly like T002/T002a used `astryx-augment.d.ts` to fill a real upstream type gap. Cite the CLI's raw output verbatim in your worker output for every prop you rely on from it. Do not invent a prop (e.g. a hypothetical `badge`/`endContent`/`suffix` prop on `SideNavItem`) that appears in neither the doc's Example block nor the CLI output — that is a hallucination risk (MAJOR).

**Badge-slot resolution path, in order:**
1. If the CLI confirms `SideNavItem.label` accepts `ReactNode` (not just `string`), compose the Outreach item's label as a small inline node containing the text "Outreach" plus a `<Badge variant="neutral" label={placeholderCount} />` (or similar layout primitive already in the allowlist — no new dependency).
2. If the CLI reveals a real dedicated slot prop for this purpose, use exactly that prop, citing the CLI output as your source.
3. If neither is confirmed, **stop and flag this as a dispute candidate** in your worker output rather than hacking around it with inline styles, a wrapping `<div>` with manual positioning, or any other approach that skips the DES-21 escalation order (component → theme token → xstyle → custom CSS, constitution item 11). Ship the other 6 items and the role-filtering logic regardless — don't let this one sub-problem block the rest of the task.

**Icons:** none of `Icon`'s built-in semantic names (`close, chevronDown, chevronLeft, chevronRight, check, success, error, warning, info, calendar, clock, externalLink, menu, moreHorizontal, search, arrowUp, arrowDown, arrowsUpDown, funnel, eyeSlash, viewColumns, copy, checkDouble, wrench, stop, microphone`) is a clean semantic match for most of your 7 items, and the dependency allowlist (constitution item 9: `@astryxdesign/*`, `@supabase/supabase-js`, `@tanstack/react-query`, `react-router-dom`, `qrcode.react`, `ical-generator`, plus dev tooling) does **not** include an icon package like `@heroicons/react` or `lucide-react` (the doc's own `SideNavItem`/`NavIcon` examples use `@heroicons/react`, which you are not authorized to install). **Omit `icon`/`selectedIcon` entirely** — the SideNav Anatomy table marks "Product icon and name" as not required, and this avoids both an undocumented-prop-type guess and an unauthorized new dependency. If you believe icons are genuinely required, flag it as a dispute candidate rather than installing anything.

### Badge (astryx-api.md lines 493–538)
| Prop | Type | Default | Description |
|---|---|---|---|
| `variant` | `'neutral' \| 'info' \| 'success' \| 'warning' \| 'error' \| 'blue' \| 'cyan' \| 'green' \| 'orange' \| 'pink' \| 'purple' \| 'red' \| 'teal' \| 'yellow'` | `'neutral'` | Semantic variants use solid backgrounds; non-semantic color variants use tinted backgrounds. |
| `label` | `ReactNode` | — | Badge text content. |
| `icon` | `ReactNode` | — | Optional leading icon (do not use — see icons note above). |

Pass `variant="neutral"` explicitly on the Outreach badge (don't rely on the default alone — make the "never error/red" requirement visible in the code, not implicit).

## PRD Ground Truth — verbatim (`docs/swarm/VOLT_Portal_PRD.md`)

**NAV-01** (line 72): *"Use Astryx `AppShell` with `TopNav` (top slot) and `SideNav` (sidebar slot, `collapsible`); wrap the app in `Layer` provider and `Theme`."*

**NAV-03** (lines 74–85), verbatim table:

| Item | Route | Admin | Coach | Student | Parent |
|---|---|---|---|---|---|
| Home | `/` | ✓ | ✓ | ✓ | ✓ |
| Meetings | `/meetings` | ✓ | ✓ | ✓ | ✓ (read) |
| Outreach | `/outreach` | ✓ | ✓ | ✓ | ✓ (read + RSVP for kid) |
| Calendar | `/calendar` | ✓ | ✓ | ✓ | ✓ |
| Roster | `/roster` | ✓ | ✓ | — | — |
| Reports | `/reports` | ✓ | ✓ | — | — |
| Settings | `/settings` | ✓ | ✓ | ✓ | ✓ |

Note the table only produces **two distinct visibility sets**: Admin/Coach see all 7 items; Student/Parent see 5 (no Roster, no Reports). The "(read)" / "(read + RSVP for kid)" annotations describe *page-level behavior differences* for Student vs. Parent once inside Meetings/Outreach — they do not change which items appear in the nav, so they are out of scope for `SideNav` itself.

**NAV-04** (line 86): *"Active item highlighted by `SideNav`'s built-in state; current page also sets `document.title` (\"Meetings · VOLT\")."*

**NAV-07** (line 90): *"Meetings and Outreach are separate routes with separate queries. No screen may render a combined meetings+outreach list except Calendar (`/calendar`) and per-student history in Reports, where every row carries a type `Badge`."*

**BEH-04** (line 233): *"RSVP completion nudge: the SideNav Outreach item shows a neutral count `Badge` of unanswered future outreach sessions (student: own; parent: linked kids combined). Clears as answered. Neutral styling — never error/red, never urgency copy."*

## Known Role-Type Gap (K2) — read before implementing role filtering
`guards.tsx`'s `Role` union is currently `'admin' | 'staff' | 'volunteer' | 'coach'` — **not** the PRD's `admin`/`coach`/`student`/`parent` vocabulary (AUTH-05). This is a pre-existing, already-flagged gap (T005/T006 close-out notes), and `guards.tsx` is a forbidden file for you — do not fix the `Role` union yourself.

This does **not** block you, because of the two-bucket observation above: NAV-03's item visibility only depends on "is this an admin/coach (staff-tier) role, or not" — it never needs to distinguish `student` from `parent` for *item visibility* purposes (only for page-level RSVP behavior, out of scope here). Implement filtering the same way TopNav (T006) already does its own admin/coach check:
```ts
const isStaffRole = user?.role === 'admin' || user?.role === 'coach';
```
Show all 7 items when `isStaffRole` is true; show the 5-item subset (no Roster, no Reports) otherwise — including when `user` is `null` (degrade to the non-staff item set, don't crash; matches TopNav's established null-safety pattern from T006).

**For your role-by-role screenshots (see Evidence below):** since the real `Role` type has no `student`/`parent` literals to construct a test user with, use the two non-staff values that *do* exist (`'staff'` and `'volunteer'`) as disclosed stand-ins for the visually-identical Student and Parent buckets, in addition to real `'admin'` and `'coach'` values. State this substitution explicitly in your worker output — do not silently relabel `'staff'`/`'volunteer'` as if they were `'student'`/`'parent'`.

## Required Composition
```tsx
// SideNav.tsx (illustrative -- not prescriptive on exact internal structure)
import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { SideNav as AstryxSideNav, SideNavItem, SideNavSection, Badge } from '@astryxdesign/core';
import { routePaths } from '../../app/router';
import { useAuth } from '../../app/guards';

const NAV_ITEMS = [
  { label: 'Home', route: routePaths.dashboard, staffOnly: false },
  { label: 'Meetings', route: routePaths.meetings, staffOnly: false },
  { label: 'Outreach', route: routePaths.outreach, staffOnly: false },
  { label: 'Calendar', route: routePaths.calendar, staffOnly: false },
  { label: 'Roster', route: routePaths.roster, staffOnly: true },
  { label: 'Reports', route: routePaths.reports, staffOnly: true },
  { label: 'Settings', route: routePaths.settings, staffOnly: false },
] as const;

export function SideNav() {
  const { user } = useAuth();
  const location = useLocation();
  const isStaffRole = user?.role === 'admin' || user?.role === 'coach';
  const visibleItems = NAV_ITEMS.filter((item) => !item.staffOnly || isStaffRole);

  // Active-item matching: exact match for Home ("/"), prefix match for
  // everything else so sub-routes (e.g. /outreach/:eventId) still highlight
  // their parent nav item and inherit its document.title.
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
      <SideNavSection>
        {visibleItems.map((item) => (
          <SideNavItem
            key={item.route}
            label={
              item.label === 'Outreach'
                ? /* see Badge-slot resolution path above */ /* ... */
                : item.label
            }
            href={item.route}
            isSelected={activeItem?.route === item.route}
          />
        ))}
      </SideNavSection>
    </AstryxSideNav>
  );
}
```
Use `collapsible` (bare boolean, uncontrolled mode) rather than the `handleRef`/`TopNav`-integrated collapse-button pattern shown in the doc — that pattern requires editing `TopNav.tsx` (forbidden) to place a `SideNavCollapseButton` in its `endContent`. NAV-01 only requires the sidebar to *be* collapsible, not that the toggle live in `TopNav`; the bare `collapsible` prop's built-in default toggle button satisfies this without touching a forbidden file.

`document.title` scope note: this only covers the 7 NAV-03 items (and their sub-routes via the prefix match above). Routes with no NAV-03 entry at all (`/login`, `/accept-invite`, `/checkin`, `/kiosk/:sessionId`) are out of scope — `SideNav` doesn't even render on the first two (chromeless), and the other two aren't part of the nav table. Note this scope boundary in your worker output; it is expected, not a gap you need to close.

## Acceptance Criteria
1. `SideNav.tsx` renders exactly the NAV-03 item set for each role bucket: all 7 items for `admin`/`coach`, 5 items (no Roster, no Reports) for everyone else including `user === null`.
2. Active item highlighted via `SideNavItem`'s own `isSelected` (not custom CSS/xstyle overlay) — genuinely wired to the current route via `useLocation()`, not hardcoded.
3. `document.title` is set to `"<Item Label> · VOLT"` based on the active item, genuinely wired via a real effect keyed off route changes — not just present in one render.
4. Meetings and Outreach remain two separate `SideNavItem`s with two separate `href`s (NAV-07 nav-level enforcement) — no merged/combined item.
5. Outreach item has a neutral-styled (`variant="neutral"`, never error/red) count `Badge` slot with a disclosed placeholder count — resolved per the "Badge-slot resolution path" above, or explicitly flagged as a dispute candidate if none of the three paths is confirmable.
6. `SideNav` passes `collapsible` (NAV-01) without requiring any edit to `TopNav.tsx`.
7. No `header`/`SideNavHeading` on this `SideNav` (avoids duplicating TopNav's brand identity, per the doc's own Best Practice).
8. Every prop used on `SideNav`, `SideNavItem`, `SideNavSection`, `Badge` is either in the Astryx Ground Truth excerpts above, in `docs/swarm/astryx-api.md` directly, or confirmed via the CLI cross-check with verbatim output cited (constitution item 2). No invented props.
9. `SideNav` is keyboard-navigable: Tab reaches each visible item, Enter/Space activates navigation, visible focus indicator on every item in both light and dark mode (DES-17 / constitution item 15 — BLOCKER if broken).
10. `SideNav` does not crash when rendered with `user === null` — degrades to the non-staff item set.
11. `AppShell.tsx` changed by exactly the two permitted edits (plus optionally the stale-comment correction) — no other diff. Verify via diff, not by trusting your own memory of what you changed.
12. `router.tsx`, `guards.tsx`, `TopNav.tsx`, `MobileNav.tsx` confirmed byte-identical / zero diff after this task (same D001/T006 method — diff or checksum).
13. `SideNav` genuinely appears in the running app: real dev server + real Chromium (Playwright, pre-installed — same pattern T016a's checker used), navigating through the real `/login` sign-in flow (this currently always lands on the `'staff'` placeholder role per `LoginPage.tsx`), confirming `SideNav` renders with the correct (non-staff-tier: 5-item) set for that role in the actual route tree — not just in an isolated render harness. Screenshots for the other three role buckets (admin, coach, and the `'volunteer'` stand-in) may come from a self-contained, self-deleted scratch harness (same pattern T016/T016a's checker used), since the real login flow cannot currently produce those roles.
14. Build/typecheck/lint/format:check all exit 0.

## Relevant Constitution Excerpts

> 1. Precedence: PRD requirement IDs > this constitution > task-ledger text > agent judgment. Conflicts are disputes for boss-arbiter — never improvised around.

> 2. Astryx component props come **only** from `docs/swarm/astryx-api.md` (PRD DES-19). A prop absent from that file is presumed hallucinated → MAJOR. The CLI (`npm run astryx -- component <Name>`) is a cross-check, not a source.

> 9. Dependency allowlist: `@astryxdesign/*`, `@supabase/supabase-js`, `@tanstack/react-query`, `react-router-dom`, `qrcode.react`, `ical-generator` (Edge Function), plus dev tooling. Anything else requires boss-architect approval recorded in the ledger.

> 11. UI is built from Astryx components; styling escalation order per PRD DES-21 (component → theme token → xstyle → custom CSS); ejecting component source needs boss approval.

> 15. Accessibility per PRD DES-17 / NFR-07 is a shipping requirement; keyboard path failures on core flows → BLOCKER.

Definition of Done (constitution): no worker may mark its own work complete; the checker inspects the actual artifact, not your summary.

## Most Recent Failure
None — this is attempt 1 for T007.

## Required Worker Output
- Full contents (or clear diff) of `src/components/nav/SideNav.tsx`.
- Diff of `src/app/AppShell.tsx` — must show only the two permitted edits (plus the optional comment fix). Call out explicitly if it's anything more.
- Prop-by-prop cross-check: for every Astryx prop used, cite the exact `docs/swarm/astryx-api.md` line number, or the CLI output you relied on (verbatim) for the four undocumented sub-components.
- Your resolution of the Badge-slot problem (which of the 3 paths, and evidence).
- Explicit statement of your icon decision (expected: omitted, per guidance above — flag if you believe otherwise).
- Role-by-role screenshots: 4 roles (`admin`, `coach`, `staff`-as-student-stand-in, `volunteer`-as-parent-stand-in) × light/dark mode, showing correct item filtering. State the stand-in mapping explicitly.
- Keyboard walkthrough notes (Tab/Enter, focus visibility, both modes).
- Live Playwright evidence: real dev server, real sign-in through `/login`, `SideNav` confirmed present and correct in the actual route tree for the `'staff'` role.
- Confirmation (diff/checksum) that `router.tsx`, `guards.tsx`, `TopNav.tsx`, `MobileNav.tsx` are unchanged.
- `npm run build` / `npm run typecheck` / `npm run lint` / `npm run format:check` output.
- Known risks (including the flagged `/kiosk/:sessionId` chromeless gap — do not fix it, just note it).
- Whether a dispute is needed (Badge-slot unresolved, AppShell.tsx scope, or anything else you believe is genuinely blocked by a forbidden file).
