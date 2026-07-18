# Worker Packet: T006

## Task ID
T006

## Objective
Build the authenticated app's chrome: an `AppShell` wrapper component (`src/app/AppShell.tsx`) that composes Astryx `AppShell` with the `LayerProvider` and `Theme` providers (PRD NAV-01), and a `TopNav` component (`src/components/nav/TopNav.tsx`) per PRD NAV-02 (wordmark→Home, admin/coach-only season `Selector`, user menu `Avatar`+`DropdownMenu` with Profile/Appearance/Sign out). This task also wires the result into `src/App.tsx` so it actually renders and is testable end-to-end — `main.tsx`/`App.tsx` were deliberately left unwired by T005 specifically for this task to close (see T005's module doc comment and its close-out note in `docs/swarm/state-summary.md`).

`SideNav` (T007) and `MobileNav` (T008) do not exist yet. Do not build them here — pass `sideNav={undefined}` and `mobileNav={false}` to Astryx `AppShell` (both are explicitly documented, sanctioned prop values — `mobileNav={false}` "disables" it per the AppShell doc's own example, it is not a hack).

## Allowed Files
- `src/app/AppShell.tsx` (new)
- `src/components/nav/TopNav.tsx` (new)
- `src/App.tsx` (edit — wire `BrowserRouter` + `AuthProvider` + `LayerProvider` + `Theme` + the new `AppShell` + `AppRoutes` together; this file is currently just a placeholder `<div><h1>VOLT Team Portal</h1></div>`, see current contents below)

## Forbidden Files
- `docs/swarm/**`
- `.claude/**`
- `src/app/router.tsx` — **read-only** (import `AppRoutes`, `routePaths` from here; do not edit). If you believe a change here is genuinely required to complete this task, stop and flag it in your worker output as a dispute candidate rather than editing it.
- `src/app/guards.tsx` — **read-only** (import `AuthProvider`, `useAuth`, `Role`, toast helpers from here; do not edit). Two known issues are logged against this file from T005's close-out and are explicitly **not** this task's job to fix: (a) K2 — the `Role` union (`'admin' | 'staff' | 'volunteer' | 'coach'`) is only minimally patched and doesn't yet cover the full PRD role vocabulary (`admin`/`coach`/`student`/`parent` per AUTH-05) — TopNav's admin/coach check (`role === 'admin' || role === 'coach'`) works fine against the current union as-is, so this shouldn't block you; (b) K3 — `RequireRole` calls `pushToast` during render instead of in an effect — leave it alone, out of scope.
- `src/theme/**` — out of scope; do not touch `volt.ts`, `theme.css`, or the smoke test.
- `src/pages/**`, `src/components/nav/SideNav.tsx`, `src/components/nav/MobileNav.tsx` — these belong to T007/T008/T016+, not this task.
- Anything outside the Allowed Files above.

## Current State of `src/App.tsx` (what you're replacing)
```tsx
function App() {
  return (
    <div>
      <h1>VOLT Team Portal</h1>
    </div>
  );
}

export default App;
```
`src/main.tsx` just renders `<App />` inside `<StrictMode>` and imports `theme.css` — it does not need to change for this task.

## Why Wiring Belongs Here, Not T005 or a Later Task
T005's `router.tsx` module doc says explicitly: *"Wiring `AppRoutes` (and `AuthProvider` from `./guards`) into `main.tsx` / `App.tsx` is T006's job (AppShell + TopNav)."* Right now `App.tsx` renders neither the router nor any auth/theme/layer provider — `TopNav` cannot be keyboard-tested or screenshotted in either color mode unless it is actually mounted in the app. Wiring is therefore in scope for this task, not deferred further.

## Required Composition Shape
Something equivalent to the following, split however you judge best between `App.tsx` and `AppShell.tsx` — the key structural requirement is the provider order and where the public-auth-route bypass lives:

```tsx
// App.tsx (illustrative — not prescriptive on exact file boundaries)
<BrowserRouter>
  <AuthProvider>
    <LayerProvider>
      <Theme theme={voltTheme}>
        <AppShell>
          <AppRoutes />
        </AppShell>
      </Theme>
    </LayerProvider>
  </AuthProvider>
</BrowserRouter>
```

```tsx
// AppShell.tsx (illustrative)
function AppShell({ children }: { children: ReactNode }) {
  const location = useLocation();
  const isChromeless = location.pathname === routePaths.login || location.pathname === routePaths.acceptInvite;
  if (isChromeless) {
    return <>{children}</>;
  }
  return (
    <AstryxAppShell topNav={<TopNav />} sideNav={undefined} mobileNav={false}>
      {children}
    </AstryxAppShell>
  );
}
```

**Why the chromeless bypass exists:** PRD 7.1 assigns `/login` the `Basic Login` template with "VOLT wordmark above the card" as its own standalone identity element, and `/accept-invite` the `Login Card` pattern — neither is described as living inside the app's `TopNav`/`SideNav` chrome, and both are public pre-auth entry points. `/login` and `/accept-invite` are currently still placeholder page components (T016/T018's job to build for real), but the AppShell/TopNav chrome should not wrap them even now, so that T016/T018 don't inherit an incorrect assumption from this task. Reference `routePaths.login` / `routePaths.acceptInvite` (exported by `router.tsx`) rather than hardcoding the path strings, so a future path change doesn't silently break this. `LayerProvider` and `Theme` still wrap the *entire* app, including those two routes (NAV-01 says wrap the app, not just the shell) — only the Astryx `AppShell`/`TopNav` chrome itself is conditional.

If you find a cleaner way to achieve the same effect (e.g. a layout-route pattern) without touching `router.tsx`/`guards.tsx`, that's fine — the behavioral requirement (chrome present on every route except `/login`/`/accept-invite`; `Theme`/`LayerProvider` present everywhere) is what matters, not this literal shape.

**Auth-state edge case:** because `AppShell`/`TopNav` mount as a sibling of `<AppRoutes>` rather than inside each route's `RequireAuth` guard, `TopNav` may briefly render while `useAuth().user` is still `null` (e.g. a direct navigation to a protected URL, in the instant before `RequireAuth` redirects to `/login`). `TopNav` must not crash in that state — degrade gracefully (e.g. skip rendering the user-menu / season-selector sections when there is no authenticated user) rather than assuming `user` is always non-null.

## Astryx Ground Truth — Props (from `docs/swarm/astryx-api.md`; do not use any prop not listed here or there — constitution item 2)

### AppShell
| Prop | Type | Default | Description |
|---|---|---|---|
| `children` | `ReactNode` | — | Main content area, rendered inside a `<main>` element. |
| `contentPadding` | `0\|0.5\|1\|1.5\|2\|3\|4\|5\|6\|8\|10` | `0` | Padding for the main content area. |
| `topNav` | `ReactNode` | — | Top navigation slot, typically TopNav. |
| `sideNav` | `ReactNode` | — | Side navigation slot, typically SideNav. |
| `mobileNav` | `ReactNode` | — | Mobile navigation configuration. Accepts `false` (disable), a config object, or a ReactNode. |
| `banner` | `ReactNode` | — | Banner slot for system-wide announcements, above `topNav`. |
| `height` | `'fill'\|'auto'` | `'fill'` | Height behavior. |
| `variant` | `'wash'\|'surface'\|'section'\|'elevated'` | `'elevated'` | Nav background style. |
| `xstyle` | `StyleXStyles` | — | StyleX styles. |

Don't: nest one AppShell inside another. Don't: use AppShell for sub-page layouts.

### TopNav
| Prop | Type | Default | Description |
|---|---|---|---|
| `heading` | `ReactNode` | — | Heading slot (logo, brand), left edge — use `TopNavHeading`. |
| `startContent` | `ReactNode` | — | Nav items/breadcrumbs, after the heading, left-aligned. |
| `children` | `ReactNode` | — | Alias for `startContent`. |
| `centerContent` | `ReactNode` | — | Center slot (tabs/search); switches layout to 3-column grid. |
| `endContent` | `ReactNode` | — | End slot for search/icons/user profile — right edge. Use for the season `Selector` + user `Avatar`/`DropdownMenu`. |
| `label` | `string` | — | Accessible label, applied as `aria-label` on `<nav>`. |
| `xstyle` | `StyleXStyles` | — | StyleX styles. |

`TopNavHeading` props (undocumented table in astryx-api.md, but shown in its example): `logo`, `heading`, `headingHref`, `superheading`, `superheadingHref`, `menu`. Example: `<TopNavHeading logo={<NavIcon icon={<HomeIcon />} />} heading="My App" headingHref="/" />`.

Best practice from the doc: "Limit primary navigation items to 5 or fewer" and "Don't use TopNav to filter page content" — not directly relevant here since T006 only builds the heading/season-selector/user-menu, not nav links (that's `SideNav`, T007).

### Selector (season selector — admin/coach only)
| Prop | Type | Default | Description |
|---|---|---|---|
| `label` | `string` | — | **(required)** Label text for accessibility. |
| `options` | `SelectorOption[]` | — | **(required)** Array of items (strings, or `{value,label,icon?,disabled?}`, dividers, sections). |
| `value` | `string` | — | Currently selected value. |
| `onChange` | `(value: string) => void` | — | Selection callback. |
| `placeholder` | `string` | `'Select...'` | Shown when no value selected. |
| `size` | `'sm'\|'md'\|'lg'` | `'md'` | Size variant. |
| `isLabelHidden` | `boolean` | `false` | Visually hide the label (still accessible). Recommended for a compact TopNav slot. |
| `isDisabled`, `disabledMessage`, `hasClear`, `hasSearch`, `searchPlaceholder`, `description`, `isOptional`, `isRequired`, `status`, `renderOption`, `htmlName`, `xstyle` | — | — | See full doc if needed; not required for this task's minimal use. |

**No real season data source exists yet** — no season-fetching task has run. Populate `options` with a clearly-labeled placeholder/mock list (e.g. a hardcoded array reflecting a plausible active season) and flag in your worker output that this is expected to be replaced with real Supabase-backed season data by a future task (most likely whichever task first wires season data — T029 or a shared context). This is the same kind of intentional placeholder T008's `StudentHomeSlot` used.

### Avatar (user menu trigger identity)
| Prop | Type | Default | Description |
|---|---|---|---|
| `src` | `string` | — | Image source URL. |
| `name` | `string` | — | User name — used for initials + alt text. Always pass this. |
| `size` | `'tiny'\|'xsmall'\|'small'\|'medium'\|'large'\|number` | `'small'` | Avatar size. Only full words, not `'sm'/'md'/'lg'`. |
| `fallbackSrc` | `string` | — | Fallback image. |
| `alt` | `string` | — | Alt text (falls back to `name`). |
| `status` | `ReactNode` | — | Corner status indicator — not needed here. |

`AuthUser` (from `guards.tsx`) only has `id`/`email`/`role`, no display name field yet — pass `user.email` as `Avatar`'s `name` prop (best available identity string right now); do not invent a `displayName` field that doesn't exist on the type.

### DropdownMenu (user menu: Profile / Appearance / Sign out)
| Prop | Type | Default | Description |
|---|---|---|---|
| `button` | `DropdownMenuButtonProps` | `{label:'Menu'}` | Trigger button props (Button props minus `onClick`). |
| `items` | `DropdownMenuOption[]` | — | **(required)** Array of `{label,onClick?,icon?,isDisabled?}`, dividers, or sections. |
| `isMenuOpen` | `boolean` | — | Controlled open state. |
| `onOpenChange` | `(isOpen:boolean)=>void` | — | Open-state callback. |
| `menuWidth` | `number\|string` | — | Custom width. |
| `hasChevron` | `boolean` | `true` | Set `false` for an icon-only trigger (recommended when the trigger is the `Avatar`, not a labeled button). |
| `children` | `(item)=>ReactNode` | — | Custom per-item render fn. |

Doc explicitly says: "Don't use a DropdownMenu for navigation; use a navigation component instead." NAV-02 nonetheless explicitly specifies `DropdownMenu` for this exact user menu (Profile/Appearance/Sign out) — PRD requirement IDs outrank component-doc "don't" guidance (constitution item 1). Treat "Profile" and "Appearance" as `onClick` handlers that call `useNavigate()` (e.g. `navigate('/settings')` — SET-01 places both Profile and Appearance as sections *within* `/settings`, there is no separate `/profile` route in PRD Section 7's route table), and "Sign out" as an `onClick` that calls `useAuth().logout()` and navigates to `/login`. A `/settings#profile` / `/settings#appearance` hash-fragment convention (matching EML-04's existing `/settings#notifications` pattern) is a reasonable, spec-consistent choice — use it or a plain `/settings` navigation, your call, just be explicit about which in your output.

### LayerProvider (NAV-01's "Layer" provider)
| Prop | Type | Default | Description |
|---|---|---|---|
| `children` | `ReactNode` | — | **(required)** App subtree. |
| `toast` | `LayerToastConfig` | — | Toast viewport config (position, maxVisible, inset). |

Doc: "Don't add nested LayerProvider instances." Use exactly one, at/near the app root.

### `Theme` (NAV-01's "Theme" provider) — not documented in `astryx-api.md`
There is no `# Theme` entry in `astryx-api.md` — this is a known gap (the same upstream package quirk T002/T002a already worked around via `astryx-augment.d.ts`). The established, already-working call signature is `<Theme theme={voltTheme}>{children}</Theme>`, imported as `import { Theme } from '@astryxdesign/core'` — see `src/theme/theme.smoke.test.tsx` (T002a) for the exact precedent. Reuse that exact pattern; do not invent additional props for `Theme` since none are documented anywhere.

## Acceptance Criteria
1. `AppShell.tsx` renders the whole app inside `LayerProvider` → `Theme` (using `voltTheme` from `src/theme/volt.ts`, imported read-only) → Astryx `AppShell`, with `topNav={<TopNav />}`, `sideNav={undefined}`, `mobileNav={false}` — except for `/login` and `/accept-invite`, which render chromeless (see "Required Composition Shape" above). `LayerProvider`/`Theme` still cover those two routes.
2. `TopNav` matches NAV-02 exactly: wordmark/logo linking Home (`/`, i.e. `routePaths.dashboard`), a season `Selector` visible **only** when `user?.role` is `'admin'` or `'coach'`, and a user menu (`Avatar` + `DropdownMenu`) with exactly three items — Profile, Appearance, Sign out — in that order.
3. Every prop used on `AppShell`, `TopNav`/`TopNavHeading`, `Selector`, `Avatar`, `DropdownMenu`, `LayerProvider` appears in the Astryx Ground Truth excerpts above or in `docs/swarm/astryx-api.md` directly. A prop not present there is presumed hallucinated (constitution item 2, MAJOR). `npm run astryx -- component <Name>` is a cross-check only, never a source.
4. `App.tsx` is wired: `BrowserRouter` + `AuthProvider` + `LayerProvider` + `Theme` + `AppShell` + `AppRoutes` compose correctly and the app actually renders (not just typechecks).
5. Full keyboard path through the user menu: Tab to the `Avatar`/`DropdownMenu` trigger, open with Enter/Space, arrow through Profile/Appearance/Sign out, activate with Enter, close with Escape — all via keyboard only, no mouse. Same for the season `Selector` when visible (Tab to it, open/select via keyboard).
6. Visible focus indicator on every interactive element in both `TopNav` and the season `Selector`/user menu, in both light and dark mode (DES-17 / constitution item 15 — BLOCKER if a keyboard path is broken or focus isn't visible).
7. `TopNav` does not crash when rendered with `user === null` (see "Auth-state edge case" above) — verify this explicitly, don't just assume it.
8. No box-drawing/bracket wireframe characters rendered in the DOM (constitution item 13 — not directly relevant here since NAV-02 has no ASCII wireframe, but stated for completeness).
9. `router.tsx` and `guards.tsx` confirmed byte-identical / zero diff after this task (constitution-adjacent discipline, same method T009–T013 used for their own untouched-file confirmations — diff or checksum, not just "I didn't mean to change it").
10. Build/typecheck/lint all exit 0.

## Relevant Constitution Excerpts

> 2. Astryx component props come **only** from `docs/swarm/astryx-api.md` (PRD DES-19). A prop absent from that file is presumed hallucinated → MAJOR. The CLI (`npm run astryx -- component <Name>`) is a cross-check, not a source.

> 15. Accessibility per PRD DES-17 / NFR-07 is a shipping requirement; keyboard path failures on core flows → BLOCKER.

> 13. Wireframes are structural intent: rendering box-drawing/bracket characters in the DOM → MAJOR. Routes marked "template as-is" (PRD 7.1) get the named Astryx template; inventing custom layout there → MAJOR.

> 1. Precedence: PRD requirement IDs > this constitution > task-ledger text > agent judgment. Conflicts are disputes for boss-arbiter — never improvised around.

Definition of Done (constitution): no worker may mark its own work complete; the checker inspects the actual artifact, not your summary.

## PRD Ground Truth (NAV-01/NAV-02, verbatim)
> **NAV-01** Use Astryx `AppShell` with `TopNav` (top slot) and `SideNav` (sidebar slot, `collapsible`); wrap the app in `Layer` provider and `Theme`.
>
> **NAV-02** `TopNav` contains: VOLT wordmark/logo (links Home), season selector (`Selector`, admin/coach only, defaults to active season), and user menu (`Avatar` + `DropdownMenu`: Profile, Appearance, Sign out).

(`SideNav` itself is T007's job — NAV-01's mention of it here is ground truth for the overall shell shape, not something to build in this task; `sideNav={undefined}` is the correct value until T007 lands.)

## Most Recent Failure
None — this is attempt 1 for T006.

## Deferred Context From T005 (informational, not new acceptance criteria unless noted above)
- K2: `guards.tsx`'s `Role` union (`'admin'|'staff'|'volunteer'|'coach'`) is incompletely reconciled against the PRD's full role vocabulary (`admin`/`coach`/`student`/`parent`, AUTH-05). `guards.tsx` is forbidden for this task — do not fix it here even if you notice it's incomplete; your admin/coach check against the existing union is sufficient for NAV-02's stated requirement.
- K3: `RequireRole` fires `pushToast` during render, not in an effect. Also in the forbidden `guards.tsx` — not this task's concern.
- Known pre-existing route-guard mismatch (do not fix, informational only): `router.tsx`'s current `/settings` route is guarded `RequireRole(['admin'])`, but PRD Section 7 lists `/settings` as `all` roles. `router.tsx`'s own module doc already flags this as an "illustrative placeholder... should be reconciled... before treated as final." This is a `router.tsx` file, which is forbidden for you to touch — just don't be surprised by it if you read the file, and don't silently work around it by routing "Profile"/"Appearance" anywhere other than `/settings`.

## Required Worker Output
- Files changed (`src/app/AppShell.tsx`, `src/components/nav/TopNav.tsx`, `src/App.tsx`) — full contents or clear diffs.
- Explicit prop-by-prop cross-check: for every Astryx component prop used, cite which line of the Astryx Ground Truth section (or `astryx-api.md` directly, with a line reference) it comes from.
- Screenshots of the rendered `TopNav`/`AppShell` in **both** light and dark mode (at least one non-admin-role screenshot showing the season Selector hidden, and one admin/coach-role screenshot showing it visible).
- Keyboard walkthrough notes: step-by-step (Tab/Enter/Arrow/Escape) through the season Selector and the user-menu DropdownMenu, confirming focus visibility at each step in both modes.
- Explicit confirmation of the `user === null` no-crash case (how you tested it, what renders).
- Confirmation (diff or checksum) that `router.tsx` and `guards.tsx` are unchanged.
- `npm run build` / `npm run typecheck` / `npm run lint` output.
- Explicit note on the season-Selector placeholder-data decision and the `/settings#profile` vs `/settings#appearance` vs plain `/settings` navigation decision for Profile/Appearance.
- Known risks.
- Whether a dispute is needed (e.g. if you believe `router.tsx`/`guards.tsx` genuinely must change to complete this task — stop and flag it here rather than editing a forbidden file).
