// src/emails/layout/constants.ts
//
// T048 -- shared constants for VOLT's branded transactional email layout
// (EML-01). This is a plain TypeScript module (no React/JSX, no
// `@astryxdesign/*` import, no `.css` import) so the exact same source file
// can be imported unmodified by both:
//   - the src/ Vite/tsc toolchain (future T049/T050/T051 templates under
//     src/emails/templates/**), and
//   - the Deno runtime `supabase/functions/send-invite/index.ts`, via a
//     relative import reaching outside its own function directory.
// See `renderEmailLayout.ts`'s header comment for the full reasoning on why
// no framework/rendering dependency was introduced.

// EML-01: "All email through Resend as `VOLT Robotics
// <notifications@mail.voltfrc.org>`". T049/T050/T051 (invite,
// signup-confirm, reminder, weekly-digest templates -- all currently
// Blocked) must import this rather than duplicating the literal string.
export const SENDER_ADDRESS = 'VOLT Robotics <notifications@mail.voltfrc.org>';

// PRD Section 673/787 ("Hosting" table, OQ-4): the deployed frontend's
// public domain is `portal.voltfrc.org` (Vercel, CNAME). Needed here
// because email links must be absolute URLs -- a bare "/settings#notifications"
// href is meaningless outside a browser tab with an existing origin, but
// resolves correctly once resolved against this origin.
export const SITE_URL = 'https://portal.voltfrc.org';

// EML-04: "Every email footer links to `/settings#notifications`". That
// route does not exist yet (T060, currently Blocked) -- this is a
// deliberate forward-compatible literal path per this task's worker packet
// ("use the literal path /settings#notifications even though the route
// isn't live yet"), matching the same hash-fragment convention already
// used by `src/components/nav/TopNav.tsx` for `/settings#profile` and
// `/settings#appearance`.
export const MANAGE_PREFERENCES_PATH = '/settings#notifications';
export const MANAGE_PREFERENCES_URL = `${SITE_URL}${MANAGE_PREFERENCES_PATH}`;

// `src/theme/volt.ts` (read-only reference -- NOT imported here; see
// `renderEmailLayout.ts` for why) defines:
//   color.accent: '#5B2EE5'
//   tokens['--color-accent']: ['#5B2EE5' (light), '#9B7BFF' (dark)]
//   tokens['--color-on-accent']: ['#FFFFFF' (light), '#00008D' (dark)]
// Email HTML cannot load the Astryx `<Theme>` provider or consume CSS
// custom properties reliably across email clients, so these are
// re-declared here as literal hex values. If `src/theme/volt.ts` ever
// changes its accent tokens, these must be updated by hand to match.
export const ACCENT_LIGHT = '#5B2EE5';
export const ACCENT_DARK = '#9B7BFF';
export const ON_ACCENT_LIGHT = '#FFFFFF';
export const ON_ACCENT_DARK = '#00008D';
