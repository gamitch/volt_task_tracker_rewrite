// src/emails/templates/meeting-reminder-3h.test.tsx
//
// T049 -- proves `meeting-reminder-3h.tsx` produces a `bodyHtml`/`previewText`
// pair `renderEmailLayout()` accepts, matches EML-02's "students in scope
// (pref-gated, default on)" recipient framing, escapes dynamic content, and
// applies BEH-08 date/duration rendering.
import { describe, expect, it } from 'vitest';
import { renderEmailLayout } from '../layout/renderEmailLayout.ts';
import {
  buildMeetingReminder3hBodyHtml,
  buildMeetingReminder3hPreviewText,
} from './meeting-reminder-3h.tsx';

const FIXTURE_PROPS = {
  recipientName: 'Ada Lovelace',
  meetingTitle: 'Build season meeting',
  startsAt: '2026-07-25T18:00:00.000Z',
  endsAt: '2026-07-25T20:00:00.000Z',
  location: 'Team workshop',
};

describe('meeting-reminder-3h template (EML-02 row 5: trigger 3h before meeting, recipient students in scope, pref-gated default on)', () => {
  it('renders a complete branded email via renderEmailLayout()', () => {
    const html = renderEmailLayout({
      previewText: buildMeetingReminder3hPreviewText(FIXTURE_PROPS),
      bodyHtml: buildMeetingReminder3hBodyHtml(FIXTURE_PROPS),
    });
    expect(html.startsWith('<!doctype html>')).toBe(true);
  });

  it('addresses the recipient student by name and names the meeting', () => {
    const bodyHtml = buildMeetingReminder3hBodyHtml(FIXTURE_PROPS);
    expect(bodyHtml).toContain('Hi Ada Lovelace,');
    expect(bodyHtml).toContain('<strong>Build season meeting</strong> starts in a few hours.');
  });

  it('BEH-08: renders a weekday name and computed duration', () => {
    const bodyHtml = buildMeetingReminder3hBodyHtml(FIXTURE_PROPS);
    expect(bodyHtml).toContain('Sat, Jul 25');
    expect(bodyHtml).toContain('1:00 PM');
    expect(bodyHtml).toContain('3:00 PM');
    expect(bodyHtml).toContain('2 h');
  });

  it('renders the optional location when provided', () => {
    const bodyHtml = buildMeetingReminder3hBodyHtml(FIXTURE_PROPS);
    expect(bodyHtml).toContain('Location: Team workshop');
  });

  it('omits the location line when not provided', () => {
    const withoutLocation = { ...FIXTURE_PROPS, location: undefined };
    const bodyHtml = buildMeetingReminder3hBodyHtml(withoutLocation);
    expect(bodyHtml).not.toContain('Location:');
  });

  it('discloses the pref-gated, default-on nature of this reminder (EML-02)', () => {
    const bodyHtml = buildMeetingReminder3hBodyHtml(FIXTURE_PROPS);
    expect(bodyHtml).toContain(
      'Meeting reminders are on by default. Manage that anytime from your notification settings.',
    );
  });

  it('escapes an unescaped-looking meeting title before interpolating into bodyHtml', () => {
    const bodyHtml = buildMeetingReminder3hBodyHtml({
      ...FIXTURE_PROPS,
      meetingTitle: '<script>alert(1)</script>',
    });
    expect(bodyHtml).not.toContain('<script>alert(1)</script>');
    expect(bodyHtml).toContain('&lt;script&gt;');
  });

  it('previewText matches the meeting-reminder framing', () => {
    expect(buildMeetingReminder3hPreviewText(FIXTURE_PROPS)).toBe(
      'Build season meeting starts in a few hours.',
    );
  });

  it('DES-14 voice: no bare "Submit"/"OK"', () => {
    const bodyHtml = buildMeetingReminder3hBodyHtml(FIXTURE_PROPS);
    expect(bodyHtml).not.toMatch(/\bSubmit\b|\bOK\b/);
  });
});
