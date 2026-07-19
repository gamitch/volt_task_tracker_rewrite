// src/emails/templates/event-reminder-3h.test.tsx
//
// T049 -- proves `event-reminder-3h.tsx` produces a `bodyHtml`/`previewText`
// pair `renderEmailLayout()` accepts, matches EML-02's "same" (`going`
// students + their parents) recipient framing, escapes dynamic content,
// applies BEH-08 date/duration rendering, and states BEH-09 "what happens
// next" (honestly, with no further reminder promised).
import { describe, expect, it } from 'vitest';
import { renderEmailLayout } from '../layout/renderEmailLayout.ts';
import {
  buildEventReminder3hBodyHtml,
  buildEventReminder3hPreviewText,
} from './event-reminder-3h.tsx';

const FIXTURE_STUDENT_PROPS = {
  recipientRole: 'student' as const,
  recipientName: 'Ada Lovelace',
  studentName: 'Ada Lovelace',
  sessionType: 'outreach' as const,
  eventTitle: 'STEM night',
  startsAt: '2026-07-25T18:00:00.000Z',
  endsAt: '2026-07-25T20:00:00.000Z',
  location: 'Central library',
};

const FIXTURE_PARENT_PROPS = {
  ...FIXTURE_STUDENT_PROPS,
  recipientRole: 'parent' as const,
  recipientName: 'Grace Hopper',
};

describe('event-reminder-3h template (EML-02 row 4: trigger 3h before same, recipient same as event-reminder-48h)', () => {
  it('renders a complete branded email via renderEmailLayout()', () => {
    const html = renderEmailLayout({
      previewText: buildEventReminder3hPreviewText(FIXTURE_STUDENT_PROPS),
      bodyHtml: buildEventReminder3hBodyHtml(FIXTURE_STUDENT_PROPS),
    });
    expect(html.startsWith('<!doctype html>')).toBe(true);
  });

  it('frames the student recipient with "starts in a few hours"', () => {
    const bodyHtml = buildEventReminder3hBodyHtml(FIXTURE_STUDENT_PROPS);
    expect(bodyHtml).toContain("you're going to starts in a few hours");
    expect(bodyHtml).toContain('STEM night');
    expect(bodyHtml).toContain('outreach event');
  });

  it('frames the linked-parent recipient with the student named explicitly', () => {
    const bodyHtml = buildEventReminder3hBodyHtml(FIXTURE_PARENT_PROPS);
    expect(bodyHtml).toContain('Hi Grace Hopper,');
    expect(bodyHtml).toContain('<strong>Ada Lovelace</strong> is going to starts in a few hours');
  });

  it('BEH-08: renders a weekday name and computed duration', () => {
    const bodyHtml = buildEventReminder3hBodyHtml(FIXTURE_STUDENT_PROPS);
    expect(bodyHtml).toContain('Sat, Jul 25');
    expect(bodyHtml).toContain('1:00 PM');
    expect(bodyHtml).toContain('3:00 PM');
    expect(bodyHtml).toContain('2 h');
  });

  it('BEH-09: does not falsely promise a further reminder (this is the last one)', () => {
    const bodyHtml = buildEventReminder3hBodyHtml(FIXTURE_STUDENT_PROPS);
    expect(bodyHtml).toContain('See you there.');
    expect(bodyHtml).not.toContain('another reminder');
  });

  it('escapes an unescaped-looking location before interpolating into bodyHtml', () => {
    const bodyHtml = buildEventReminder3hBodyHtml({
      ...FIXTURE_STUDENT_PROPS,
      location: '<script>alert(1)</script>',
    });
    expect(bodyHtml).not.toContain('<script>alert(1)</script>');
    expect(bodyHtml).toContain('&lt;script&gt;');
  });

  it('previewText matches the recipient framing', () => {
    expect(buildEventReminder3hPreviewText(FIXTURE_STUDENT_PROPS)).toBe(
      "The STEM night outreach event you're going to starts in a few hours.",
    );
  });

  it('DES-14 voice: no bare "Submit"/"OK"', () => {
    const bodyHtml = buildEventReminder3hBodyHtml(FIXTURE_STUDENT_PROPS);
    expect(bodyHtml).not.toMatch(/\bSubmit\b|\bOK\b/);
  });
});
