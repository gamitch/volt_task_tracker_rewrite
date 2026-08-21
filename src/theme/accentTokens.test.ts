/**
 * GAM-436 / D020 — guards for the brand accent tokens.
 *
 * Why this file exists: before it, the accent was measurably unguarded. Reverting
 * `--color-accent` in `volt.ts` from Tracker Orange back to Volt Violet and
 * running the whole suite produced **2588 passed, 0 failed** — the brand accent
 * could be changed, or silently reverted by a bad merge, with every gate green.
 * The badge variant and the email constants each had a test; the token the whole
 * theme derives from did not.
 *
 * `theme.smoke.test.tsx` does not cover this: it asserts the app renders without
 * throwing, which is true of any accent.
 *
 * These are value assertions rather than behaviour assertions, deliberately. The
 * accent is a decision (D020, owner-ruled), not a computation — there is no
 * behaviour to exercise, and the failure mode being guarded is "the decision got
 * changed without the ruling changing".
 */
import { describe, expect, it } from 'vitest';
import { voltTheme } from './volt';
import {
  ACCENT_DARK,
  ACCENT_LIGHT,
  ON_ACCENT_DARK,
  ON_ACCENT_LIGHT,
} from '../emails/layout/constants';

// D020's ruled values. The DARK pair is the production app's own `--accent` /
// `--accent-ink`, read from its deployed stylesheet. The LIGHT accent is derived
// for this repo because production is `color-scheme: dark` only and `#f79a4a`
// scores 2.11:1 on the light card, failing DES-06's both-modes-AA requirement.
const ACCENT = { light: '#A8560A', dark: '#f79a4a' } as const;
const ON_ACCENT = { light: '#FFFFFF', dark: '#081310' } as const;

// The progress bar carries its OWN light stop rather than the text accent: it is
// measured against its track under WCAG 2.1 SC 1.4.11 (3:1), where the text
// accent manages only 2.30:1. `#6E3300` is Astryx's own `--color-icon-orange`.
const PROGRESS_BAR = { light: '#6E3300', dark: '#f79a4a' } as const;

describe('D020 brand accent tokens', () => {
  it('pins --color-accent to Tracker Orange in both modes', () => {
    expect(voltTheme.tokens['--color-accent']).toBe(`light-dark(${ACCENT.light}, ${ACCENT.dark})`);
  });

  it('pins --color-on-accent to the contrast-checked pair', () => {
    expect(voltTheme.tokens['--color-on-accent']).toBe(
      `light-dark(${ON_ACCENT.light}, ${ON_ACCENT.dark})`,
    );
  });

  it('gives the accent progress bar its own vivid stop, not the text accent', () => {
    expect(voltTheme.components?.progressbar?.['variant:accent']).toEqual({
      '--color-accent': `light-dark(${PROGRESS_BAR.light}, ${PROGRESS_BAR.dark})`,
    });
    // The distinction is the point: if these ever collapse to the same value,
    // the bar has silently inherited a stop that fails 1.4.11 against its track.
    expect(PROGRESS_BAR.light).not.toBe(ACCENT.light);
  });

  it('leaves the neutral ramp seed alone', () => {
    // Re-seeding `color.accent` to orange repaints every neutral surface --
    // measured on GAM-436's first attempt: card #FEFBFF -> #FFFBF7, text
    // #1D1A21 -> #211A16. The seed drives the neutral ramp only; the accent
    // itself comes from the token override above. See `volt.ts` for the full note.
    expect(voltTheme.tokens['--color-background-card']).toBe('light-dark(#FEFBFF, #1D1A21)');
  });
});

describe('email accent constants mirror the theme', () => {
  /**
   * `src/emails/layout/constants.ts` re-declares the accent as literal hex,
   * because email clients cannot consume CSS custom properties. Its header states
   * the invariant in prose: "If `src/theme/volt.ts` ever changes its accent
   * tokens, these must be updated by hand to match."
   *
   * Prose does not fail a build. This does. The two copies drifting is how VOLT
   * ends up mailing a violet brand accent from an orange app.
   */
  it('matches --color-accent', () => {
    expect(`light-dark(${ACCENT_LIGHT}, ${ACCENT_DARK})`).toBe(voltTheme.tokens['--color-accent']);
  });

  it('matches --color-on-accent', () => {
    expect(`light-dark(${ON_ACCENT_LIGHT}, ${ON_ACCENT_DARK})`).toBe(
      voltTheme.tokens['--color-on-accent'],
    );
  });
});
