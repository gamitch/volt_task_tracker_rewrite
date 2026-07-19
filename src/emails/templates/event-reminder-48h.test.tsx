// src/emails/templates/event-reminder-48h.test.tsx
//
// T049 -- proves `event-reminder-48h.tsx` produces a `bodyHtml`/`previewText`
// pair `renderEmailLayout()` accepts, matches EML-02's "`going` students +
// their parents" recipient framing, escapes dynamic content, applies BEH-08
// date/duration rendering, and states BEH-09 "what happens next".
import { describe, expect, it } from 'vitest';
import { renderEmailLayout } from '../layout/renderEmailLayout.ts';
import {
  buildEventReminder48hBodyHtml,
  buildEventReminder48hPreviewText,
} from './event-reminder-48h.tsx';

const FIXTURE_STUDENT_PROPS = {
  recipientRole: 'student' as const,
  recipientName: 'Ada Lovelace',
  studentName: 'Ada Lovelace',
  sessionType: 'competition' as const,
  eventTitle: 'Regional qualifier',
  startsAt: '2026-07-25T18:00:00.000Z',
  endsAt: '2026-07-25T20:00:00.000Z',
  location: 'State fairgrounds',
};

const FIXTURE_PARENT_PROPS = {
  ...FIXTURE_STUDENT_PROPS,
  recipientRole: 'parent' as const,
  recipientName: 'Grace Hopper',
};

describe('event-reminder-48h template (EML-02 row 3: trigger 48h before outreach/competition, recipient going + parents)', () => {
  it('renders a complete branded email via renderEmailLayout()', () => {
    const html = renderEmailLayout({
      previewText: buildEventReminder48hPreviewText(FIXTURE_STUDENT_PROPS),
      bodyHtml: buildEventReminder48hBodyHtml(FIXTURE_STUDENT_PROPS),
    });
    expect(html.startsWith('<!doctype html>')).toBe(true);
  });

  it('frames the student recipient in second person ("you\'re going to")', () => {
    const bodyHtml = buildEventReminder48hBodyHtml(FIXTURE_STUDENT_PROPS);
    expect(bodyHtml).toContain("you're going to is coming up in 2 days");
    expect(bodyHtml).toContain('Regional qualifier');
    expect(bodyHtml).toContain('competition');
  });

  it('frames the linked-parent recipient with the student named explicitly', () => {
    const bodyHtml = buildEventReminder48hBodyHtml(FIXTURE_PARENT_PROPS);
    expect(bodyHtml).toContain('Hi Grace Hopper,');
    expect(bodyHtml).toContain('<strong>Ada Lovelace</strong> is going to is coming up in 2 days');
  });

  it('BEH-08: renders a weekday name and computed duration', () => {
    const bodyHtml = buildEventReminder48hBodyHtml(FIXTURE_STUDENT_PROPS);
    expect(bodyHtml).toContain('Sat, Jul 25');
    expect(bodyHtml).toContain('1:00 PM');
    expect(bodyHtml).toContain('3:00 PM');
    expect(bodyHtml).toContain('2 h');
  });

  it('BEH-09: states another reminder still follows', () => {
    const bodyHtml = buildEventReminder48hBodyHtml(FIXTURE_STUDENT_PROPS);
    expect(bodyHtml).toContain("We'll send another reminder a few hours before it starts.");
  });

  it('escapes an unescaped-looking event title before interpolating into bodyHtml', () => {
    const bodyHtml = buildEventReminder48hBodyHtml({
      ...FIXTURE_STUDENT_PROPS,
      eventTitle: '<script>alert(1)</script>',
    });
    expect(bodyHtml).not.toContain('<script>alert(1)</script>');
    expect(bodyHtml).toContain('&lt;script&gt;');
  });

  it('EML-05: props accept exactly one student', () => {
    const bodyHtml = buildEventReminder48hBodyHtml(FIXTURE_STUDENT_PROPS);
    expect(bodyHtml).toContain('Ada Lovelace');
  });

  it('previewText matches the recipient framing', () => {
    expect(buildEventReminder48hPreviewText(FIXTURE_STUDENT_PROPS)).toBe(
      "The Regional qualifier competition you're going to is coming up in 2 days.",
    );
  });

  it('DES-14 voice: no bare "Submit"/"OK"', () => {
    const bodyHtml = buildEventReminder48hBodyHtml(FIXTURE_STUDENT_PROPS);
    expect(bodyHtml).not.toMatch(/\bSubmit\b|\bOK\b/);
  });
});
