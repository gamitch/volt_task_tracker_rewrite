// src/emails/templates/meeting-reminder-3h.tsx
//
// T049 -- EML-02 "meeting-reminder-3h" template (row 5, PRD line 318-326,
// cited verbatim): trigger "3 h before meeting session", recipient
// "students in scope (pref-gated, default on)".
//
// TRAP #1: same plain-TypeScript-with-`.tsx`-filename decision documented in
// full at the top of `invite.tsx` (this task's own sibling file) -- read
// that comment for the complete reasoning. Not repeated verbatim here.
//
// EML-05: this template's props accept exactly one recipient's data
// (`recipientName`) and one meeting's data -- no list/array prop, matching
// this task's other four templates' own EML-05 notes. Meetings have no RSVP
// (unlike outreach/competition sessions, CMP-03) -- the recipient set here
// is "students in scope" per EML-02's own literal wording, not a `going`
// filter; this template does not itself decide who is "in scope" (that is
// T051's send/scheduling job, currently Blocked) -- it only renders content
// for one already-resolved recipient.
//
// Escaping: every freeform value below is escaped before interpolation via
// the local `escapeHtml`, duplicated per-file the same way `invite.tsx`
// documents (no shared-util file is in this task's Allowed Files).
//
// BEH-08 date rendering is implemented locally below the same way this
// task's other reminder templates document (independently reimplemented,
// not imported from the read-only `src/pages/home/StudentHome.tsx`).

export interface MeetingReminder3hTemplateProps {
  /** Freeform display name of the recipient student -- escaped before
   * interpolation. Recipient is always a student per EML-02's "students in
   * scope" wording (meeting reminders are not sent to parents). */
  recipientName: string;
  /** Freeform meeting title (e.g. "Build season meeting") -- escaped before
   * interpolation. */
  meetingTitle: string;
  /** ISO 8601 timestamp, stored UTC (NFR-09); rendered in America/Chicago. */
  startsAt: string;
  /** ISO 8601 timestamp, stored UTC (NFR-09); rendered in America/Chicago. */
  endsAt: string;
  /** Optional freeform location -- escaped before interpolation. */
  location?: string;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const CHICAGO_TIME_ZONE = 'America/Chicago';

const WEEKDAY_DATE_FORMATTER = new Intl.DateTimeFormat('en-US', {
  weekday: 'short',
  month: 'short',
  day: 'numeric',
  timeZone: CHICAGO_TIME_ZONE,
});

const CLOCK_TIME_FORMATTER = new Intl.DateTimeFormat('en-US', {
  hour: 'numeric',
  minute: '2-digit',
  timeZone: CHICAGO_TIME_ZONE,
});

function formatDateOnly(iso: string): string {
  return WEEKDAY_DATE_FORMATTER.format(new Date(iso));
}

function formatDurationHours(startsAt: string, endsAt: string): string {
  const ms = new Date(endsAt).getTime() - new Date(startsAt).getTime();
  const hours = ms / (1000 * 60 * 60);
  const rounded = Math.round(hours * 2) / 2;
  const label = Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
  return `${label} h`;
}

/** BEH-08: weekday name + computed duration, e.g. "Sat, Jul 25 · 6:00–8:00
 * PM · 2 h". */
function formatDateTimeRange(startsAt: string, endsAt: string): string {
  const startText = CLOCK_TIME_FORMATTER.format(new Date(startsAt));
  const endText = CLOCK_TIME_FORMATTER.format(new Date(endsAt));
  return `${formatDateOnly(startsAt)} · ${startText}–${endText} · ${formatDurationHours(startsAt, endsAt)}`;
}

/** DES-14 sentence case, plain verbs. BEH-09: names the meeting and time,
 * and is honest that this reminder is on by default and can be turned off
 * from notification settings (EML-02's own "pref-gated, default on"
 * wording) -- the footer's manage-preferences link (EML-01/EML-04) already
 * points at `/settings#notifications`; this line makes the pref-gating
 * itself legible rather than silent. */
export function buildMeetingReminder3hBodyHtml(props: MeetingReminder3hTemplateProps): string {
  const recipientName = escapeHtml(props.recipientName);
  const meetingTitle = escapeHtml(props.meetingTitle);
  const dateTimeText = formatDateTimeRange(props.startsAt, props.endsAt);

  const locationLine = props.location
    ? `<p style="margin:0 0 16px;">Location: ${escapeHtml(props.location)}</p>`
    : '';

  return `
    <p style="margin:0 0 16px;">Hi ${recipientName},</p>
    <p style="margin:0 0 16px;"><strong>${meetingTitle}</strong> starts in a few hours.</p>
    <p style="margin:0 0 16px;">${dateTimeText}</p>
    ${locationLine}
    <p style="margin:0; color:#6b6480; font-size:13px;">Meeting reminders are on by default. Manage that anytime from your notification settings.</p>
  `;
}

export function buildMeetingReminder3hPreviewText(props: MeetingReminder3hTemplateProps): string {
  return `${props.meetingTitle} starts in a few hours.`;
}
