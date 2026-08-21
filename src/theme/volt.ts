import { defineTheme } from '@astryxdesign/core/theme';
import { neutralTheme } from '@astryxdesign/theme-neutral';

export const voltTheme = defineTheme({
  name: 'volt',
  extends: neutralTheme,
  // D020 (GAM-436): the seed deliberately stays `#5B2EE5` even though the brand
  // accent is now orange. `ColorScaleConfig.neutralStyle`'s own doc -- "controls
  // how much of the seed's hue bleeds into neutral/background colors" -- means
  // re-seeding to orange repaints EVERY neutral: measured on the first attempt,
  // `--color-background-card` moved #FEFBFF -> #FFFBF7, `--color-text-primary`
  // #1D1A21 -> #211A16, `--color-border-emphasized` #AFA9B7 -> #B8A89F. That is
  // a warm-tinted surface palette, which moves AWAY from the production app this
  // task is matching (its neutrals are cool blue-greys: #111318 / #181c24 /
  // #323a49) and is far wider than the accent change D020 authorises.
  //
  // `defineTheme`'s own contract makes the seed unnecessary here: "Explicit
  // `tokens` entries always take precedence", and every accent-derived token
  // (`--color-accent-muted`, `--color-text-accent`, `--color-icon-accent`)
  // resolves through `var(--color-accent)`, so overriding the token below is
  // sufficient and the seed's only remaining effect is the neutral ramp we want
  // left alone.
  color: { accent: '#5B2EE5', neutralStyle: 'cool' },
  typography: {
    heading: {
      family: 'Space Grotesk',
      url: 'https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&display=swap',
      fallbacks: 'system-ui, sans-serif',
    },
    body: {
      family: 'Inter',
      url: 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap',
      fallbacks: '-apple-system, sans-serif',
    },
  },
  radius: { base: 6, multiplier: 1 },
  tokens: {
    // [light, dark]
    // D020 (GAM-436): the brand accent is Tracker Orange, not Volt Violet. The
    // DARK value is the production app's own `--accent`, read from its deployed
    // stylesheet -- not a colour chosen here. Production is `color-scheme: dark`
    // only, so it supplies NO light value; `#A8560A` is derived for this repo
    // because DES-06 requires both modes clear WCAG AA and `#f79a4a` scores
    // 2.11:1 on the light card (fails). Measured for D020: `#A8560A` is 5.11:1
    // on `--color-background-card` light and 5.25:1 for white-on-swatch.
    '--color-accent': ['#A8560A', '#f79a4a'],
    // D005: re-pinned to Astryx's P[10] stop for dark-mode AA contrast.
    // D020: dark is production's own `--accent-ink` (#081310 on #f79a4a =
    // 8.71:1); light stays white (5.25:1 on #A8560A).
    '--color-on-accent': ['#FFFFFF', '#081310'],
    // T136 (UXC-05 foundation): confirmed/planned hours colour system for
    // `GoalBar`. Both are real `DataTokenName` keys (dataTokens.d.ts) that
    // ship defaults but are never emitted into theme.css until overridden
    // here -- this override is what makes them exist as CSS custom
    // properties inside the volt @scope.
    //
    // NOT the dataTokenDefaults hex (`#0B991F`/`#6B1EFD`, same value both
    // modes) -- measured against `GoalBar`'s track (`--color-border
    // -emphasized`, the `.astryx-progressbar` remap of `--color-background
    // -muted`, `theme.css:496-498`), those defaults fail WCAG 2.1 SC 1.4.11
    // (<3:1) in both themes; see this task's worker output for the full
    // measurement. Re-picked per mode (darker in light mode, lighter in
    // dark mode -- the same `[light, dark]` pattern `--color-accent` above
    // already uses) from Astryx's own vetted sequential data-viz ramps
    // (dataTokens.d.ts: `--color-data-shamrock-*` / `--color-data-purple-*`)
    // rather than hand-picked hex, so the per-mode "each fill vs track"
    // check (criterion 2) passes with real margin. The "confirmed vs
    // planned" mutual-contrast check does NOT clear 3:1 with these (or any)
    // genuinely-two-hued values -- proven mathematically infeasible given
    // this track's luminance; disclosed, not silently shipped as passing.
    '--color-data-categorical-green': ['#0B603D', '#8EF7AA'], // confirmed hours
    '--color-data-categorical-purple': ['#3E0697', '#B3B0FE'], // planned hours
  },
  components: {
    // D020 (GAM-436). `neutralTheme` pins the accent progress bar to a vivid
    // blue stop (`#0074e2`, chosen there to match the filled `variant:info`
    // badge) INDEPENDENTLY of `--color-accent`. Left alone, the goal bar would
    // stay blue under an orange theme -- the most visible element on the coach
    // dashboard disagreeing with everything around it.
    //
    // NOT simply `var(--color-accent)`. The bar is a UI component measured
    // against its own track (`--color-border-emphasized`, via `neutralTheme`'s
    // `progressbar.base` remap of `--color-background-muted`), and WCAG 2.1
    // SC 1.4.11 wants 3:1 there. Measured for this task:
    //
    //   light  #A8560A on #AFA9B7 = 2.30:1  FAILS
    //   light  #6E3300 on #AFA9B7 = 4.30:1  passes
    //   dark   #f79a4a on #4A4551 = 4.28:1  passes
    //
    // `#6E3300` is Astryx's own `--color-icon-orange` light stop, not a
    // hand-mixed hex -- the same "re-pick from a vetted ramp rather than
    // invent" reasoning the `--color-data-categorical-*` note above records.
    //
    // Disclosed: this FIXES a pre-existing failure rather than introducing one.
    // The blue it replaces scored 2.00:1 light and 2.03:1 dark against the same
    // track -- both already below 3:1 before this task touched anything.
    progressbar: {
      'variant:accent': {
        '--color-accent': 'light-dark(#6E3300, #f79a4a)',
      },
    },
    // GAM-437: side nav labels ship at the base 14px text size, which reads
    // too small once the nav is collapsible and icons are its only other
    // visual weight. `SideNavItem` DOES have a `size` prop (`'sm' | 'md' |
    // 'lg'`, `NavItemSize`,
    // node_modules/@astryxdesign/core/dist/NavItem/navItemStyles.stylex.d.ts:15)
    // -- this is NOT the "no size prop exists" case. Checked against the
    // compiled CSS (node_modules/@astryxdesign/core/dist/astryx.css, the
    // `--size-element-{sm,md,lg}` / `--spacing-{1,2}` rules) that `size`
    // only maps to `height` / `padding-inline`; it has no effect on font
    // size at all, so there is no size lever to reach for here. A
    // component-level `fontSize` override is the correct DES-21 escalation
    // step (component prop -> theme token -> xstyle -> custom CSS) once the
    // component itself has no matching lever. `--font-size-base` is
    // deliberately left untouched -- that resizes every base-sized element
    // in the app, not just the nav.
    //
    // Key is `'side-nav-item'`, not the naively-lowercased `sidenavitem` --
    // verified against the installed package source
    // (`node_modules/@astryxdesign/core/dist/SideNav/SideNavItem.js`, both
    // `themeProps('side-nav-item', ...)` call sites), which is what actually
    // determines the rendered `.astryx-side-nav-item` class the generated
    // CSS selector below has to match. `astryx theme build`'s own
    // `KNOWN_COMPONENTS` typo-check list
    // (`node_modules/@astryxdesign/cli/src/commands/build-theme.mjs`) has no
    // entry for this component at all (new/undocumented in that list, same
    // category as the other CLI/doc gaps already on record in this file and
    // in `SideNav.tsx`'s module doc) -- confirmed the naive `sidenavitem` key
    // silently emits a selector, `.astryx-sidenavitem`, that never matches
    // real markup, while `side-nav-item` does.
    'side-nav-item': {
      base: {
        fontSize: '16px',
      },
    },
  },
});
