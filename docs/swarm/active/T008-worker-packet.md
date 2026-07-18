# Worker Packet: T008

## Task ID
T008

## Attempt
1 (of 3 before mandatory escalation to boss-arbiter — constitution "Loop Limit").

## Objective
Two independent deliverables:

1. **`MobileNav`** (`src/components/nav/MobileNav.tsx`) — the mobile counterpart to `SideNav` (T007), a slide-out drawer shown below 768px, satisfying **NAV-05**: *"Mobile (< 768px): `SideNav` is replaced by Astryx `MobileNav` drawer triggered from `TopNav`."* Wire it into the real app (`AppShell.tsx` + a scoped `TopNav.tsx` trigger edit — see below) so it's genuinely reachable, not just buildable in isolation.
2. **`StudentHomeSlot`** (`src/pages/home/StudentHomeSlot.tsx`) — an **isolated placeholder component only**, reserving where T054's real "Check in" live-meeting card (MTG-10) will later render on Student Home. **Do not build a Student Home page. Do not wire anything into `router.tsx`.** See "StudentHomeSlot Scope" below — this is deliberately narrow.

## Why AppShell.tsx AND TopNav.tsx Are Both In Scope This Time (read before you start)

T007 established the precedent: a component that builds cleanly in isolation but is never wired into the real render tree is a load-bearing gap (dispute D003 on T006), not a footnote. The same investigation was done for T008 before this packet was written — here are the results, so you don't have to rediscover them:

**AppShell.tsx wiring (mirrors T007 exactly):** `AppShell.tsx` currently has `mobileNav={false}` — astryx-api.md's own documented way to *disable* the mobile drawer entirely (line 2550: `<AppShell mobileNav={false} />`). If this isn't changed to pass your `MobileNav`, the drawer will never render in the app no matter how correct `MobileNav.tsx` is in isolation. `AppShell.tsx` is therefore in this packet's Allowed Files, scoped to exactly two mechanical edits (below).

**TopNav.tsx trigger edit (new category, not covered by T007's precedent — read carefully):** NAV-05 requires the drawer to be *"triggered from `TopNav`"*. astryx-api.md's MobileNav section (line 4698) states: *"Inside AppShell, use `MobileNavToggle` as the trigger; it reads state from context automatically."* `MobileNavToggle` (astryx-api.md lines 4743–4750) is a self-contained hamburger button that "Renders nothing above the mobile breakpoint" and must be rendered *somewhere* inside the `AppShell` tree for the drawer to be openable at all — `MobileNav.tsx` itself cannot render its own trigger (that would violate the doc's Best Practice "Don't: Use MobileNav on desktop" symmetry and isn't how the doc's own example composes it). `TopNav.tsx` (astryx-api.md lines 2079–2237) has no dedicated "mobile menu button" prop — its only content slots are `heading`, `startContent`, `centerContent`, `endContent`. The only way to satisfy "triggered **from TopNav**" (not just "triggered from somewhere in AppShell") is for `TopNav.tsx` itself to render `<MobileNavToggle />` in one of its own slots. There is no alternative composition (e.g. wrapping `<MobileNavToggle /><TopNav />` together as the `AppShell` `topNav` prop value) that keeps the toggle visually and semantically inside the actual `TopNav` bar rather than as an ad hoc sibling outside it — that path was considered and rejected as hackier and less faithful to the doc's own composition pattern than a one-line addition to `TopNav.tsx`.

**Resolution:** `TopNav.tsx` is added to this packet's Allowed Files, scoped to exactly two mechanical edits (below) — the same narrow-scope discipline as T007's `AppShell.tsx` edit. This is a genuinely new precedent (T007 avoided touching `TopNav.tsx` entirely by using `SideNav`'s bare `collapsible` prop instead of the `handleRef`-in-`TopNav` pattern); here there is no such escape hatch, because the trigger mechanism is architecturally different (a toggle button that must live somewhere real, not a ref handshake). Do not treat this as blanket license to make other `TopNav.tsx` changes.

## Allowed Files
- `src/components/nav/MobileNav.tsx` (new)
- `src/pages/home/StudentHomeSlot.tsx` (new, placeholder only — see scope section)
- `src/app/AppShell.tsx` (edit — **scoped to exactly two mechanical edits, see below**)
- `src/components/nav/TopNav.tsx` (edit — **scoped to exactly two mechanical edits, see below**)

## AppShell.tsx — Scoped Wiring Edit (the only permitted changes to this file)
Current relevant lines (`src/app/AppShell.tsx`, post-T007):
```tsx
import { AppShell as AstryxAppShell } from '@astryxdesign/core';
import { routePaths } from './router';
import { TopNav } from '../components/nav/TopNav';
import { SideNav } from '../components/nav/SideNav';
...
  return (
    <AstryxAppShell topNav={<TopNav />} sideNav={<SideNav />} mobileNav={false}>
      {children}
    </AstryxAppShell>
  );
```
You may make **exactly** these two changes and nothing else:
1. Add one import line: `import { MobileNav } from '../components/nav/MobileNav';`
2. Change `mobileNav={false}` to `mobileNav={<MobileNav />}` on the existing `<AstryxAppShell>` JSX call.

You may additionally correct the module-doc comment (lines 4–11) that currently describes `MobileNav` as not existing yet and `mobileNav={false}` as intentional — it becomes false once you wire this in. This is the only other edit permitted, purely to keep the file's own documentation accurate (same allowance T007 used). Do **not** touch: `sideNav={<SideNav />}`, the chromeless `/login`/`/accept-invite` bypass logic, the `topNav` prop, provider order, or anything else in the file.

## TopNav.tsx — Scoped Wiring Edit (the only permitted changes to this file)
Current relevant lines (`src/components/nav/TopNav.tsx`, T006, already Passed):
```tsx
import {
  Avatar,
  DropdownMenu,
  Selector,
  TopNav as AstryxTopNav,
  TopNavHeading,
  type SelectorOptionType,
} from '@astryxdesign/core';
...
  return (
    <AstryxTopNav
      label="Main navigation"
      heading={<TopNavHeading heading="VOLT" headingHref={routePaths.dashboard} />}
      endContent={ ... }
    />
  );
```
You may make **exactly** these two changes and nothing else:
1. Add `MobileNavToggle` to the existing `@astryxdesign/core` import list (astryx-api.md line 4743 confirms this export).
2. Add `startContent={<MobileNavToggle />}` to the existing `<AstryxTopNav>` JSX call — no other prop, no wrapping fragment, no custom label override (default `'Open navigation'` accessible label, astryx-api.md line 4750, is sufficient — do not invent a custom `label` unless you have a specific accessibility reason, and if so, disclose it).

You may additionally add a short doc-comment above the `startContent` line (or in the module header) explaining *why* this line exists (NAV-05 + the `MobileNavToggle` context-read mechanism) — matching this file's own existing documentation style. This is the only other edit permitted. Do **not** touch: `heading`, `endContent`, the season-selector logic, the user-menu logic, `handleSignOut`, or anything else in the file. `MobileNavToggle` "renders nothing above the mobile breakpoint" (astryx-api.md line 4745) — confirm via your desktop-viewport evidence that this addition produces **zero visible change** above 768px.

## Forbidden Files
- `docs/swarm/**`, `.claude/**` (constitution-wide, no exceptions)
- `src/app/router.tsx` — **read-only**. Import `routePaths` from here if needed; do not edit. **`StudentHomeSlot` must not be added to any `<Route>` here** — see scope section.
- `src/app/guards.tsx` — **read-only**. Import `useAuth`, `Role` from here; do not edit. See "Known Role-Type Gap (K2)" below.
- `src/components/nav/SideNav.tsx` — T007, already Passed. Do not touch, and **do not import from it** (it exports only the `SideNav` component, no shared items array) — see "Item-list duplication" note below.
- Anything else outside the four Allowed Files above (`src/pages/home/StudentHome.tsx` does not exist yet and is not yours to create — that's T054; `src/theme/**`, migrations, etc.).

## Astryx Ground Truth — Props (verbatim from `docs/swarm/astryx-api.md`; a prop not listed here or confirmed via the CLI cross-check is presumed hallucinated — constitution item 2, MAJOR)

### AppShell — `mobileNav` prop only (rest already verified in T006/T007)
Line 2591: `| \`mobileNav\` | \`ReactNode\` | — | Mobile navigation configuration. Accepts false (disable), config object (tune auto behavior), or ReactNode (full custom drawer). |`
Line 2549 example: `<AppShell mobileNav={<MobileNav title="Menu">...</MobileNav>} />` — confirms passing a `<MobileNav>...</MobileNav>` element directly as the prop value is a sanctioned pattern (same shape as T007's `sideNav={<SideNav>...</SideNav>}`).
Line 4698: *"Inside AppShell, use `MobileNavToggle` as the trigger; it reads state from context automatically."*

### MobileNav (astryx-api.md lines 4730–4741)
| Prop | Type | Default | Description |
|---|---|---|---|
| `isOpen` | `boolean` | — | Whether the drawer is open. **Inside AppShell, this is managed automatically via context.** Outside AppShell, provide this prop to control the drawer yourself. |
| `onOpenChange` | `(isOpen: boolean) => void` | — | Called when the drawer visibility changes (backdrop click, Escape key, or close button). **Inside AppShell, this is managed automatically via context.** |
| `children` | `ReactNode` | — | Drawer content: typically `SideNavSection`/`SideNavItem`, or any ReactNode. **(required)** |
| `header` | `ReactNode` | — | Header content for the drawer. Rendered next to the close button. Pass a string for a simple text heading, or a ReactNode for custom content. |
| `width` | `number` | `320` | Drawer width in pixels. Capped at 85vw. |
| `side` | `'start' \| 'end' \| 'auto'` | `'auto'` | Which side the drawer slides from. |

**Because you are wiring `MobileNav` inside `AppShell`'s `mobileNav` slot (per the resolution above), do NOT pass `isOpen`/`onOpenChange`** — the doc explicitly says this is context-managed automatically inside `AppShell`. Passing them yourself would fight the context mechanism (same class of error as passing `isOpen` to `MobileNavToggle`, which the doc explicitly forbids at line 4725: *"Do not pass isOpen/onOpenChange to the toggle"*).

`header`: unlike `SideNav`'s `header` prop (which T007 correctly omitted to avoid duplicating `TopNav`'s brand identity via `SideNavHeading`), `MobileNav`'s `header` explicitly supports a plain string ("simple text heading") — this is not a `SideNavHeading`/logo duplication risk. A short string such as `header="Navigation"` is a reasonable, doc-endorsed choice per the Best Practice "Do: Provide a header when the drawer's purpose is not obvious from its content" (line 4724), but is not mandatory — your call, disclose whichever you pick.

### MobileNavToggle (astryx-api.md lines 4743–4750)
| Prop | Type | Default | Description |
|---|---|---|---|
| `children` | `ReactNode` | — | Custom content to render instead of the default hamburger icon. |
| `label` | `string` | `'Open navigation'` | Accessible label for the toggle button. |

"Reads open state from AppShell context automatically: does NOT accept isOpen or onOpenChange props. Renders nothing above the mobile breakpoint." (line 4745)

### SideNavItem / SideNavSection / Badge — reuse T007's already-resolved ground truth
`astryx-api.md` documents `MobileNav` as accepting "the same children" as `SideNav` (line 4698) — i.e. the exact same `SideNavSection`/`SideNavItem` components T007 already used and cross-checked. **Do not re-derive their props from scratch or re-run the CLI** — cite T007's already-verified ground truth directly (from `src/components/nav/SideNav.tsx`'s own module doc, and `docs/swarm/archive/T007-worker-packet.md`):
- `SideNavItem`: `label: string` (required), `as: LinkComponentType`, `isSelected: boolean` (default `false`), `href: string`, `endContent: ReactNode` (right-side content such as badges or counts). `icon`/`selectedIcon` deliberately omitted, same reasoning as T007 (no icon package in the dependency allowlist).
- `SideNavSection`: `title: string` (required — confirmed via CLI in T007, the doc's own Example block is internally inconsistent between `heading`/`title`; `title` is the CLI-confirmed correct one), `children: ReactNode`.
- `Badge`: `variant` (pass `'neutral'` explicitly), `label: ReactNode`.

**Item-list duplication (disclosed, intentional, not laziness):** `SideNav.tsx` is a forbidden file and exports only the `SideNav` component — no shared `NAV_ITEMS` array to import. astryx-api.md's own Best Practice says "Do: Share the same nav items between MobileNav and SideNav by extracting them into a variable" (line 4723), but doing that here would require editing the forbidden, already-Passed `SideNav.tsx` to extract a shared export — out of scope. **Duplicate the same `NAV_ITEMS` array, `isStaffRole` filtering logic, active-item matching logic, and Outreach badge slot in `MobileNav.tsx`, verbatim in spirit to `SideNav.tsx`.** State this duplication explicitly in your worker output as a disclosed limitation, not a discovery to hide — a future task (whenever `SideNav.tsx` is next legitimately open for edits) should extract a shared `NAV_ITEMS` module; do not create that task yourself, just note it.

**`as={Link}` — apply from the start, do not rediscover this bug:** T007's attempt 1 shipped `SideNavItem` with a plain `href` and no `as` prop, which the checker found causes a full page reload on every click (loses the in-memory `AuthProvider` session, bounces to `/login`). T007's fix, confirmed via live Playwright by the checker: pass `as={Link}` (from `react-router-dom`) on every `SideNavItem`. **Apply `as={Link}` to every `SideNavItem` inside your `MobileNav.tsx` on your first attempt** — do not repeat T007's attempt-1 mistake.

**Document.title / NAV-04 parity — investigate, don't assume:** astryx-api.md says `AppShell` "handles responsive mobile navigation... automatically" (line 2539) but does not document whether `SideNav` is unmounted (not just CSS-hidden) below 768px. If it is unmounted, `SideNav.tsx`'s `document.title`-setting `useEffect` would stop firing at narrow widths, silently regressing NAV-04. **Duplicate the same `document.title` effect in `MobileNav.tsx`** (keyed off the same active-item match) as a safe default regardless of which way that ambiguity resolves — redundant-but-harmless if `SideNav` stays mounted, load-bearing if it doesn't. Confirm via your live-viewport-resize evidence (see Evidence below) which case actually holds, and report it.

**Drawer-close-on-navigate — known unresolved doc gap, do not hack around it:** astryx-api.md documents `MobileNav` closing via "backdrop click, Escape key, or close button" (line 4737) but does not document whether selecting a `SideNavItem` inside it also closes the drawer automatically. This is internal `AstryxMobileNav` behavior you have no documented lever to control (no exposed prop for it) and no allowed file to patch it in (`AstryxMobileNav`'s source is not yours to eject — constitution item 11). **Test it empirically and report what you observe; do not invent a manual `onOpenChange` override to force a close** (that would violate the "don't pass `isOpen`/`onOpenChange` inside `AppShell`" rule above). If it does not auto-close, flag it as a known risk/dispute candidate in your worker output — do not attempt a workaround.

## PRD Ground Truth — verbatim (`docs/swarm/VOLT_Portal_PRD.md`)

**NAV-05** (line 87): *"Mobile (< 768px): `SideNav` is replaced by Astryx `MobileNav` drawer triggered from `TopNav`. Student Home additionally surfaces a persistent **Check in** card whenever a meeting session is live (MTG-10) so check-in never requires navigation."*

**MTG-10** (line 284): *"Student Home live card (NAV-05): 'Meeting live now' + 6-char code input + **Check in** button; same validation path as QR."* — **this is T054's job (see below), not yours.**

**HOME-02** (line 264): *"Student Home (mobile-first): live-meeting check-in card when a session is live (MTG-10); hours `ProgressBar` (MET-04) + participation % (MET-01); 'Next up' = their `going` sessions; 'Sign-up opportunities' = future outreach sessions not yet responded to..."* — **also T054's job in full. Your only responsibility is the reserved slot component itself, not the rest of Student Home.**

## Known Role-Type Gap (K2) — same as T007, reused here
`guards.tsx`'s `Role` union is `'admin' | 'staff' | 'volunteer' | 'coach'`, not the PRD's `admin`/`coach`/`student`/`parent` vocabulary. `guards.tsx` is forbidden — do not fix it. NAV-03's item-visibility table only needs an "is this a staff-tier role" binary, so use the same check T006/T007 already established:
```ts
const isStaffRole = user?.role === 'admin' || user?.role === 'coach';
```
Non-staff (including `user === null`) gets the 5-item set (no Roster, no Reports) — same null-safety pattern as `TopNav`/`SideNav`.

## StudentHomeSlot Scope — read carefully, do not overbuild

There is currently no real "Student Home" page. `router.tsx`'s `"/"` route renders a role-undifferentiated `DashboardPage` placeholder (`function DashboardPage(): ReactNode { return <div>Dashboard (placeholder)</div>; }`) — role-specific home pages (`CoachHome`/`StudentHome`/`ParentHome`) are T053/T054/T055, all currently unstarted with unmet dependencies. **You are not building any of those pages, and you must not touch `router.tsx` to wire anything in.**

`StudentHomeSlot.tsx`'s job is narrower than the ledger's one-line objective might suggest: it is an **isolated, standalone component** that exists so T054 has a defined contract to render inside the real `StudentHome.tsx` it builds later. Build it as:

```tsx
// src/pages/home/StudentHomeSlot.tsx (illustrative — not prescriptive on exact internals)
export interface StudentHomeSlotProps {
  /**
   * Whether a meeting session is currently live for this student. No real
   * query exists yet (T054 wires the real Supabase-backed value from MTG-10 /
   * the live-session data model). Defaults to false so this component is
   * inert (renders nothing) until T054 passes real data through it.
   */
  hasLiveSession?: boolean;
}

export function StudentHomeSlot({ hasLiveSession = false }: StudentHomeSlotProps) {
  if (!hasLiveSession) {
    return null;
  }
  // Minimal, explicitly-labeled reservation — NOT the real MTG-10 UI
  // (6-char code entry, Check in button, QR-equivalent validation path).
  // That is T054's job, reusing T032's validation per T054's own acceptance
  // criteria. This is only proving the slot's on/off contract.
  return (
    <Card>
      Check-in card placeholder — reserved for MTG-10 live check-in UI (built in T054)
    </Card>
  );
}
```
Do not build the 6-char code input, the "Check in" button, any Supabase query, or any real live-session detection logic — that is explicitly T054's job (ledger T054: *"live-meeting check-in card (MTG-10, wired into T008's slot)... check-in path reuses T032's validation, not a re-implementation"*). Your only obligations: (1) the component renders nothing by default/when `hasLiveSession` is false or absent, satisfying the ledger's stated acceptance ("slot renders nothing when no live session"), and (2) the component's existence and prop contract are stable enough for T054 to render it. Do not add this component to any route, page, or the AppShell tree — it is deliberately unreachable in the running app today.

## Acceptance Criteria
1. `MobileNav.tsx` renders the same NAV-03 item set per role bucket as `SideNav` (7 items staff-tier, 5 otherwise, including `user === null`) — duplicated logic, disclosed per "Item-list duplication" above.
2. Every `SideNavItem` inside `MobileNav.tsx` uses `as={Link}` from the start (no reload/session-loss regression — T007's already-proven fix, not rediscovered).
3. Active item highlighted via `isSelected`, genuinely wired to `useLocation()`.
4. `document.title` parity investigated and either confirmed redundant-but-safe or confirmed load-bearing at <768px — reported either way (see "Document.title / NAV-04 parity" above).
5. Outreach item carries the same neutral (`variant="neutral"`) placeholder count `Badge` via `endContent`, never error/red.
6. No `header`/`SideNavHeading`-style branding duplication; a plain-string `header` on `MobileNav` (e.g. `"Navigation"`) is optional and allowed since it isn't a branding duplication risk — disclose your choice.
7. `MobileNav` is not passed `isOpen`/`onOpenChange` (context-managed inside `AppShell`).
8. Drawer opens via `MobileNavToggle` (keyboard: Tab reaches it, Enter/Space activates it; touch: tap activates it) and closes via keyboard (Escape) and touch (backdrop tap / close button) — DES-17, BLOCKER if broken.
9. `MobileNavToggle` added to `TopNav.tsx` produces zero visible/layout change at ≥768px (confirmed via desktop-viewport evidence).
10. `AppShell.tsx` changed by exactly the two permitted edits (plus optionally the stale-comment correction) — verify via diff, not memory.
11. `TopNav.tsx` changed by exactly the two permitted edits (plus optionally a short doc comment) — verify via diff, not memory.
12. `StudentHomeSlot.tsx` renders `null` when `hasLiveSession` is false/absent; renders a clearly-labeled, non-final placeholder when true. Not wired into `router.tsx`, any page, or `AppShell.tsx`.
13. `router.tsx`, `guards.tsx`, `SideNav.tsx` confirmed byte-identical / zero diff after this task (diff or checksum, same D001/T006/T007 method).
14. Every prop used on `MobileNav`, `MobileNavToggle`, `SideNavItem`, `SideNavSection`, `Badge` is either in the Astryx Ground Truth excerpts above or in `docs/swarm/astryx-api.md` directly, with exact line-number citations. No invented props.
15. `MobileNav` genuinely appears and functions in the running app below 768px: real dev server + real Chromium (Playwright), viewport resized/set below 768px, real sign-in through `/login`, drawer open/close confirmed in the actual route tree.
16. Build/typecheck/lint/format:check all exit 0.

## Relevant Constitution Excerpts

> 1. Precedence: PRD requirement IDs > this constitution > task-ledger text > agent judgment. Conflicts are disputes for boss-arbiter — never improvised around.

> 2. Astryx component props come **only** from `docs/swarm/astryx-api.md` (PRD DES-19). A prop absent from that file is presumed hallucinated → MAJOR. The CLI (`npm run astryx -- component <Name>`) is a cross-check, not a source.

> 9. Dependency allowlist: `@astryxdesign/*`, `@supabase/supabase-js`, `@tanstack/react-query`, `react-router-dom`, `qrcode.react`, `ical-generator` (Edge Function), plus dev tooling. Anything else requires boss-architect approval recorded in the ledger.

> 11. UI is built from Astryx components; styling escalation order per PRD DES-21 (component → theme token → xstyle → custom CSS); ejecting component source needs boss approval.

> 15. Accessibility per PRD DES-17 / NFR-07 is a shipping requirement; keyboard path failures on core flows → BLOCKER.

Definition of Done (constitution): no worker may mark its own work complete; the checker inspects the actual artifact, not your summary.

## Most Recent Failure
None — this is attempt 1 for T008.

## Required Worker Output
- Full contents of `src/components/nav/MobileNav.tsx` and `src/pages/home/StudentHomeSlot.tsx`.
- Diff of `src/app/AppShell.tsx` — must show only the two permitted edits (plus optional comment fix). Call out explicitly if it's anything more.
- Diff of `src/components/nav/TopNav.tsx` — must show only the two permitted edits (plus optional comment). Call out explicitly if it's anything more.
- Prop-by-prop cross-check with exact `docs/swarm/astryx-api.md` line-number citations for every Astryx prop used.
- Your finding on the `document.title` mount/unmount ambiguity (does `SideNav`'s effect keep firing below 768px, or not) — with evidence.
- Your finding on drawer-close-on-navigate behavior (auto-closes or not) — with evidence, and whether you believe this needs a dispute.
- Confirmation `as={Link}` is applied on every `SideNavItem` in `MobileNav.tsx` from the first attempt.
- Live Playwright evidence: real dev server, real sign-in through `/login`, viewport set below 768px, `MobileNavToggle` opening/closing the drawer in the actual route tree, plus a ≥768px screenshot proving zero visible change from the `TopNav.tsx` edit.
- Screenshots: drawer open + drawer closed at 375px width, both light/dark mode if feasible; `StudentHomeSlot` both states (`hasLiveSession` true/false) via a self-contained, self-deleted scratch harness (same pattern T007's checker used for role screenshots) since it isn't wired into any real page.
- Keyboard walkthrough notes (Tab to toggle, Enter/Space to open, Tab through drawer items, Escape to close, focus visibility in both modes).
- Confirmation (diff/checksum) that `router.tsx`, `guards.tsx`, `SideNav.tsx` are unchanged.
- `npm run build` / `npm run typecheck` / `npm run lint` / `npm run format:check` output.
- Known risks (drawer-close-on-navigate gap, `NAV_ITEMS` duplication between `SideNav.tsx`/`MobileNav.tsx` as a future-extraction candidate, anything else).
- Whether a dispute is needed (any of the above, or anything else you believe is genuinely blocked by a forbidden file).
