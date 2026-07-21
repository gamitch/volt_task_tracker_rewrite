// src/emails/templates/invite.test.tsx
//
// T049 -- proves `invite.tsx` produces a `bodyHtml`/`previewText` pair that
// `renderEmailLayout()` (T048) accepts end-to-end, matches EML-02's "invitee"
// recipient framing, escapes dynamic content, and follows DES-14/BEH-09
// copy voice. No `@vitest-environment jsdom` pragma needed -- this only
// builds strings, matching `renderEmailLayout.test.ts`'s own posture.
import { describe, expect, it } from 'vitest';
import { renderEmailLayout } from '../layout/renderEmailLayout.ts';
import { buildInviteBodyHtml, buildInvitePreviewText } from './invite.tsx';

describe('invite template (EML-02 row 1: trigger AUTH-03, recipient invitee)', () => {
  it('renders a complete branded email via renderEmailLayout()', () => {
    const html = renderEmailLayout({
      previewText: buildInvitePreviewText({ role: 'coach' }),
      bodyHtml: buildInviteBodyHtml({ role: 'coach' }),
    });
    expect(html.startsWith('<!doctype html>')).toBe(true);
    expect(html).toContain('>VOLT<');
  });

  it('addresses the invitee directly when no inviter name is known (real send path constraint)', () => {
    const bodyHtml = buildInviteBodyHtml({ role: 'coach' });
    expect(bodyHtml).toContain("You've been invited to join");
    expect(bodyHtml).toContain('<strong>coach</strong>');
  });

  it('names the inviter when one is provided', () => {
    const bodyHtml = buildInviteBodyHtml({ role: 'parent', inviterName: 'Jordan Lee' });
    expect(bodyHtml).toContain('<strong>Jordan Lee</strong> invited you');
    expect(bodyHtml).toContain('<strong>parent</strong>');
  });

  it('states the AUTH-06 expiry (BEH-09 "what happens next"), defaulting to 14 days', () => {
    const bodyHtml = buildInviteBodyHtml({ role: 'student' });
    expect(bodyHtml).toContain('This invite link expires in 14 days.');
  });

  it('honors an explicit expiresInDays override', () => {
    const bodyHtml = buildInviteBodyHtml({ role: 'student', expiresInDays: 7 });
    expect(bodyHtml).toContain('This invite link expires in 7 days.');
  });

  it('escapes an unescaped-looking inviter name before interpolating into bodyHtml', () => {
    const bodyHtml = buildInviteBodyHtml({
      role: 'admin',
      inviterName: '<script>alert(1)</script>',
    });
    expect(bodyHtml).not.toContain('<script>alert(1)</script>');
    expect(bodyHtml).toContain('&lt;script&gt;');
  });

  it('previewText matches the invitee framing and is escaped by renderEmailLayout itself', () => {
    const previewText = buildInvitePreviewText({ role: 'coach' });
    expect(previewText).toBe("You're invited to join VOLT Robotics as a coach.");
    // renderEmailLayout() escapes previewText itself (its own documented
    // contract) -- the apostrophe becomes `&#39;` in the rendered output, so
    // this asserts against the escaped form rather than the raw string.
    const html = renderEmailLayout({ previewText, bodyHtml: '<p>hi</p>' });
    expect(html).toContain('You&#39;re invited to join VOLT Robotics as a coach.');
  });

  it('DES-14 voice: no bare "Submit"/"OK"', () => {
    const bodyHtml = buildInviteBodyHtml({ role: 'coach' });
    expect(bodyHtml).not.toMatch(/\bSubmit\b|\bOK\b/);
  });
});
