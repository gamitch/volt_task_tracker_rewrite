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
  },
});
