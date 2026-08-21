# GAM-437 worker packet — STANDARD tier

## Task

Give the side nav real icons and a 16px label so a collapsed nav stays
usable. Currently `SideNav` renders seven text-only 14px labels; `collapsible`
is already passed (`src/components/nav/SideNav.tsx:163`) but a collapsed nav
has nothing to show.

## Premise, verified by the orchestrator before this packet was written

- **GAM-435 (blocker) is `Done`** — verified live via the Linear API.
- **`lucide-react` is allowlisted** — constitution item 9 already records it
  (dispute-log D021: Astryx's 26-name semantic icon set has no match for
  Home/Meetings/Outreach/Roster/Reports; `Icon`'s own props table in
  `docs/swarm/astryx-api.md` directs callers to lucide/heroicons for anything
  outside that list).
- **`SideNavItem`'s `icon`/`selectedIcon` props are real, not hallucinated**
  (constitution item 2's concern). Verified two ways just now:
  1. `npm run astryx -- component SideNavItem --json` lists both props,
     type `IconType`, "See `npx astryx docs icons` for valid semantic names."
  2. The installed package source,
     `node_modules/@astryxdesign/core/dist/SideNav/SideNavItem.d.ts`:
     `icon?: ReactNode | IconType` and `selectedIcon?: ReactNode | IconType`,
     where `IconType = ComponentType<SVGProps<SVGSVGElement>>`
     (`node_modules/@astryxdesign/core/dist/Icon/Icon.d.ts:110`). A rendered
     lucide element (`<House {...}/>`, a `ReactNode`) is a valid value for
     both — pass the *rendered element*, not the bare component reference.
- **Correction to the issue's own text — `SideNavItem` DOES have a `size`
  prop** (`'sm' | 'md' | 'lg'`, `NavItemSize`,
  `node_modules/@astryxdesign/core/dist/NavItem/navItemStyles.stylex.d.ts:15`).
  This does **not** change the plan: verified against the compiled CSS
  (`node_modules/@astryxdesign/core/dist/astryx.css:1230-1232` plus the
  `padding-inline` rule) that `size` only maps to `height` /
  `padding-inline` (`--size-element-{sm,md,lg}` / `--spacing-{1,2}`) — it has
  no effect on font size. So the theme-level override below is still the
  correct DES-21 escalation step; only the reason has changed (no size lever
  for font, not no size prop at all). Use this corrected reasoning in any
  code comment that cites the `size` prop — don't repeat "no `size` prop
  exists."

## What to change

1. **`package.json`** — add `lucide-react` (pin to `^1.33.0`, matching the
   version the issue names its icon exports from) to `dependencies`. Run
   `npm install` so `package-lock.json` updates too. Before using any of the
   seven icon names below, confirm each is a real export —
   `grep -o "export declare const \(House\|Users\|Megaphone\|CalendarDays\|ClipboardList\|ChartColumn\|Settings\)\b" node_modules/lucide-react/dist/lucide-react.d.ts`
   (or equivalent) — the issue names them but nobody has run this yet; treat
   it the same as the `astryx` CLI cross-check for an unverified prop.

2. **`src/components/nav/SideNav.tsx`**
   - Import from `lucide-react`: `House`, `Users`, `Megaphone`,
     `CalendarDays`, `ClipboardList`, `ChartColumn`, `Settings`.
   - `NAV_ITEMS` (currently `label`/`route`/`staffOnly` at line 123) gains an
     `icon` field per entry, one lucide component per the mapping below.
     Keep the array as data (component references, e.g. `icon: House`), then
     render `<Icon {...props} />` in JSX — don't store rendered elements in
     the const array.
     | Item | Icon |
     | -- | -- |
     | Home | `House` |
     | Meetings | `Users` |
     | Outreach | `Megaphone` |
     | Calendar | `CalendarDays` |
     | Roster | `ClipboardList` |
     | Reports | `ChartColumn` |
     | Settings | `Settings` |
   - Each `<SideNavItem>` (currently lines 166-187) passes
     `icon={<item.icon aria-hidden="true" />}`. Do **not** pass
     `selectedIcon` — lucide ships outline-only, so there is no filled
     variant to hand it (this is the disclosed divergence dispute-log D021
     already records; don't try to fake a filled variant).
   - Update the module doc comment: the existing "Icons: deliberately
     omitted" paragraph (currently around lines 96-100) is now false and
     must be rewritten to describe what's actually implemented and cite this
     packet's verification (CLI + type-source check for `icon`/
     `selectedIcon`, and why `selectedIcon` is still unused). Same for the
     "(`icon`/`selectedIcon` also appear in this output but are deliberately
     omitted — see icon note below.)" line near the `SideNavItem` CLI-output
     citation block (currently around line 61-62) — it must now cite `icon`
     the same way the other cited props are cited.

3. **`src/theme/volt.ts`** — add a `components.sidenavitem.base.fontSize`
   override to `16px` (the `defineTheme` component-style-map convention
   already used for `progressbar` in this file — key is the lowercased
   component name, `base` applies to all instances, values are camelCase CSS
   properties). Do **not** touch `--font-size-base` — that resizes the whole
   app, not just the nav (explicit constraint in the source issue).

4. **Regenerate `src/theme/theme.css`** per its own header instructions
   (lines 27-33): run
   `npx astryx theme build src/theme/volt.ts -o /tmp/volt-theme.css`, then
   copy the new `astryx-theme` layer body for `.astryx-side-nav-item` into
   `theme.css`'s `@layer app` section (renaming `astryx-theme` to `app` to
   match this file's existing 3-layer scheme, same as every other block in
   the file already does). Do not hand-write the CSS — generate it and copy
   it, so the checked-in file matches what the CLI actually emits.

5. **`src/components/nav/SideNav.test.tsx`** — add cases asserting each nav
   item's icon renders (query by role/accessible name is still `label`, not
   the icon — icons are decorative here since `label` already carries the
   name). Follow this file's existing test conventions; read it before
   adding anything.

## Accessibility — do not skip

DES-17/NFR-07 make this a shipping requirement, not a nicety. `SideNavItem`
keeps its `label` prop when collapsed (per the Astryx doc's own Anatomy
description), so the accessible name should survive collapse — but the
issue this packet comes from explicitly flags that this has never been
watched happen, only read off the API surface. Two things the *orchestrator*
will verify after this packet lands (not required from the worker, since
`layout-measurement`/browser tooling isn't in this agent's toolset): the
collapsed rail's real accessible names, and that `aria-hidden="true"` on the
icon doesn't strip the item's name. If you have a way to sanity-check this
in a unit test (e.g. asserting the rendered link's accessible name via
testing-library, both expanded and with the `collapsible` control toggled),
add it — but the live-browser check is the real gate, not a substitute for
one.

## Constraints

- No write path, no schema/RLS/auth change, no signature another module
  imports — stays STANDARD per constitution item 26.
- Allowed files: `package.json`, `package-lock.json`,
  `src/components/nav/SideNav.tsx`, `src/components/nav/SideNav.test.tsx`,
  `src/theme/volt.ts`, `src/theme/theme.css`. Nothing else.
- Constitution item 22: stage explicit paths only, never `git add -A`.
- Report your commit SHA. Report exact commands run and their exit codes for
  `npm run typecheck`, `npm run lint`, `npm run test -- SideNav`, and
  `npm run build`. Do not self-certify completion — a separate check follows.
