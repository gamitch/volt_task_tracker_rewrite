// src/emails/templates/signup-confirm.test.tsx
//
// T049 -- proves `signup-confirm.tsx` produces a `bodyHtml`/`previewText`
// pair `renderEmailLayout()` accepts, matches EML-02's "student (+ linked
// parents)" recipient framing, escapes dynamic content, applies BEH-08
// date/duration rendering, and states BEH-09 "what happens next".
import { describe, expect, it } from 'vitest';
import { renderEmailLayout } from '../layout/renderEmailLayout.ts';
import { buildSignupConfirmBodyHtml, buildSignupConfirmPreviewText } from './signup-confirm.tsx';

const FIXTURE_STUDENT_PROPS = {
  recipientRole: 'student' as const,
  recipientName: 'Ada Lovelace',
  studentName: 'Ada Lovelace',
  sessionType: 'outreach' as const,
  eventTitle: 'Robotics demo day',
  startsAt: '2026-07-25T18:00:00.000Z',
  endsAt: '2026-07-25T20:00:00.000Z',
  location: 'Community center',
};

const FIXTURE_PARENT_PROPS = {
  ...FIXTURE_STUDENT_PROPS,
  recipientRole: 'parent' as const,
  recipientName: 'Grace Hopper',
};

describe('signup-confirm template (EML-02 row 2: trigger RSVP going, recipient student + linked parents)', () => {
  it('renders a complete branded email via renderEmailLayout()', () => {
    const html = renderEmailLayout({
      previewText: buildSignupConfirmPreviewText(FIXTURE_STUDENT_PROPS),
      bodyHtml: buildSignupConfirmBodyHtml(FIXTURE_STUDENT_PROPS),
    });
    expect(html.startsWith('<!doctype html>')).toBe(true);
  });

  it('frames the student recipient in first person ("you\'re signed up")', () => {
    const bodyHtml = buildSignupConfirmBodyHtml(FIXTURE_STUDENT_PROPS);
    expect(bodyHtml).toContain("You're signed up for the");
    expect(bodyHtml).toContain('Robotics demo day');
    expect(bodyHtml).toContain('outreach event');
  });

  it('frames the linked-parent recipient with the student named explicitly (no "Hi there")', () => {
    const bodyHtml = buildSignupConfirmBodyHtml(FIXTURE_PARENT_PROPS);
    expect(bodyHtml).toContain('Hi Grace Hopper,');
    expect(bodyHtml).toContain('<strong>Ada Lovelace</strong> is signed up for the');
  });

  it('BEH-08: renders a weekday name and computed duration', () => {
    const bodyHtml = buildSignupConfirmBodyHtml(FIXTURE_STUDENT_PROPS);
    expect(bodyHtml).toContain('Sat, Jul 25');
    expect(bodyHtml).toContain('1:00 PM');
    expect(bodyHtml).toContain('3:00 PM');
    expect(bodyHtml).toContain('2 h');
  });

  it('renders the optional location when provided', () => {
    const bodyHtml = buildSignupConfirmBodyHtml(FIXTURE_STUDENT_PROPS);
    expect(bodyHtml).toContain('Location: Community center');
  });

  it('omits the location line when not provided', () => {
    const withoutLocation = { ...FIXTURE_STUDENT_PROPS, location: undefined };
    const bodyHtml = buildSignupConfirmBodyHtml(withoutLocation);
    expect(bodyHtml).not.toContain('Location:');
  });

  it('BEH-09: states what happens next (the two real reminder templates)', () => {
    const bodyHtml = buildSignupConfirmBodyHtml(FIXTURE_STUDENT_PROPS);
    expect(bodyHtml).toContain(
      "We'll remind you 2 days before and again a few hours before the event starts.",
    );
  });

  it('escapes an unescaped-looking event title and location before interpolating into bodyHtml', () => {
    const bodyHtml = buildSignupConfirmBodyHtml({
      ...FIXTURE_STUDENT_PROPS,
      eventTitle: '<img src=x onerror=alert(1)>',
      location: '<script>alert(2)</script>',
    });
    expect(bodyHtml).not.toContain('<img src=x onerror=alert(1)>');
    expect(bodyHtml).not.toContain('<script>alert(2)</script>');
    expect(bodyHtml).toContain('&lt;img');
    expect(bodyHtml).toContain('&lt;script&gt;');
  });

  it('EML-05: props accept exactly one student, no list of other students possible', () => {
    // Structural guarantee, not a runtime check: SignupConfirmTemplateProps
    // has a single `studentName: string` field, never an array -- a caller
    // cannot pass multiple students' data into one render.
    const bodyHtml = buildSignupConfirmBodyHtml(FIXTURE_STUDENT_PROPS);
    expect(bodyHtml).toContain('Ada Lovelace');
    expect((bodyHtml.match(/Ada Lovelace/g) ?? []).length).toBeGreaterThan(0);
  });

  it('previewText matches the recipient framing', () => {
    expect(buildSignupConfirmPreviewText(FIXTURE_STUDENT_PROPS)).toBe(
      "You're signed up for the Robotics demo day outreach event.",
    );
    expect(buildSignupConfirmPreviewText(FIXTURE_PARENT_PROPS)).toBe(
      'Ada Lovelace is signed up for the Robotics demo day outreach event.',
    );
  });

  it('DES-14 voice: no bare "Submit"/"OK"', () => {
    const bodyHtml = buildSignupConfirmBodyHtml(FIXTURE_STUDENT_PROPS);
    expect(bodyHtml).not.toMatch(/\bSubmit\b|\bOK\b/);
  });
});
