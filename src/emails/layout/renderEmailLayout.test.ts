// src/emails/layout/renderEmailLayout.test.ts
//
// T048 -- string-contains assertions for `renderEmailLayout`'s required
// EML-01 elements (wordmark, violet accent color, manage-preferences footer
// link) plus basic HTML-safety checks. Run via `npm run test` (vitest),
// matching every other `src/**` test in this repo (see
// `src/theme/theme.smoke.test.tsx`) -- no live rendering/DOM required since
// this module only produces a string, so no `@vitest-environment jsdom`
// pragma is needed here.
import { describe, expect, it } from 'vitest';
import { ACCENT_DARK, ACCENT_LIGHT, MANAGE_PREFERENCES_URL, SENDER_ADDRESS } from './constants.ts';
import { buildInviteFixtureBodyHtml, buildInviteFixturePreviewText } from './inviteFixtureBody.ts';
import { renderEmailLayout } from './renderEmailLayout.ts';

describe('renderEmailLayout (EML-01 shared branded layout)', () => {
  const html = renderEmailLayout({
    previewText: buildInviteFixturePreviewText({ role: 'coach' }),
    bodyHtml: buildInviteFixtureBodyHtml({ role: 'coach' }),
  });

  it('is a complete standalone HTML document', () => {
    expect(html.startsWith('<!doctype html>')).toBe(true);
    expect(html).toContain('<html');
    expect(html).toContain('</html>');
  });

  it('contains the VOLT wordmark', () => {
    expect(html).toContain('>VOLT<');
    expect(html).toContain('volt-wordmark');
  });

  it('uses the violet accent color (light mode literal + dark-mode override)', () => {
    expect(ACCENT_LIGHT).toBe('#5B2EE5');
    expect(ACCENT_DARK).toBe('#9B7BFF');
    expect(html).toContain(ACCENT_LIGHT);
    expect(html).toContain(ACCENT_DARK);
    expect(html).toContain('prefers-color-scheme: dark');
  });

  it('contains a manage-preferences footer link pointing at /settings#notifications', () => {
    expect(MANAGE_PREFERENCES_URL).toBe('https://portal.voltfrc.org/settings#notifications');
    expect(html).toContain(`href="${MANAGE_PREFERENCES_URL}"`);
    expect(html).toContain('Manage which emails you receive');
  });

  it('embeds the caller-supplied bodyHtml verbatim (trusted content, not re-escaped)', () => {
    expect(html).toContain("You've been invited to join");
    expect(html).toContain('<strong>coach</strong>');
  });

  it('escapes previewText (defense-in-depth even though callers are expected to pass plain text)', () => {
    const unsafe = renderEmailLayout({
      previewText: '<script>alert(1)</script>',
      bodyHtml: '<p>hi</p>',
    });
    expect(unsafe).not.toContain('<script>alert(1)</script>');
    expect(unsafe).toContain('&lt;script&gt;');
  });

  it('does not hardcode a different sender than the shared SENDER_ADDRESS constant', () => {
    // This layout itself has no "From" header (that's set by the Resend
    // API call in supabase/functions/send-invite/resend.ts), but asserts
    // here that the constant this task requires every template to share
    // exists with the exact EML-01 value, since layout + resend.ts both
    // import it from the same place.
    expect(SENDER_ADDRESS).toBe('VOLT Robotics <notifications@mail.voltfrc.org>');
  });
});
