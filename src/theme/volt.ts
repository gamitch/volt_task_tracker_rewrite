import {defineTheme} from '@astryxdesign/core/theme';
import {neutralTheme} from '@astryxdesign/theme-neutral';

export const voltTheme = defineTheme({
  name: 'volt',
  extends: neutralTheme,
  color: {accent: '#5B2EE5', neutralStyle: 'cool'},
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
  radius: {base: 6, multiplier: 1},
  tokens: {
    // [light, dark]
    '--color-accent': ['#5B2EE5', '#9B7BFF'],
    // D005: re-pinned to Astryx's P[10] stop for dark-mode AA contrast.
    '--color-on-accent': ['#FFFFFF', '#00008D'],
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
});
