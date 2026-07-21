// src/emails/templates/event-reminder-48h.tsx
//
// T049 -- EML-02 "event-reminder-48h" template (row 3, PRD line 318-326,
// cited verbatim): trigger "48 h before outreach/competition session",
// recipient "`going` students + their parents".
//
// TRAP #1: same plain-TypeScript-with-`.tsx`-filename decision documented in
// full at the top of `invite.tsx` (this task's own sibling file) -- read
// that comment for the complete reasoning. Not repeated verbatim here.
//
// EML-05: props accept exactly one student's data (`studentName`) and one
// recipient's data (`recipientName`) -- no list/array prop, matching
// `signup-confirm.tsx`'s own EML-05 note.
//
// Escaping: every freeform value below is escaped before interpolation via
// the local `escapeHtml`, duplicated per-file the same way `invite.tsx`
// documents (no shared-util file is in this task's Allowed Files).
//
// BEH-08 date rendering is implemented locally below the same way
// `signup-confirm.tsx` documents (independently reimplemented, not
// imported from the read-only `src/pages/home/StudentHome.tsx`).

export type EventReminderSessionType = 'outreach' | 'competition';

export interface EventReminder48hTemplateProps {
  /** Distinguishes "you're going" (sent to the student) from
   * "{studentName} is going" (sent to a linked parent) -- keeps recipient
   * context obvious in this template's own props, per this task's worker
   * packet trap #3. */
  recipientRole: 'student' | 'parent';
  /** Freeform display name of the actual recipient -- escaped before
   * interpolation. */
  recipientName: string;
  /** Freeform display name of the `going` student this reminder is for.
   * Equal to `recipientName` when `recipientRole === 'student'`. */
  studentName: string;
  sessionType: EventReminderSessionType;
  /** Freeform event/session title -- escaped before interpolation. */
  eventTitle: string;
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

const SESSION_TYPE_LABEL: Record<EventReminderSessionType, string> = {
  outreach: 'outreach event',
  competition: 'competition',
};

/** DES-14 sentence case, plain verbs. BEH-09: reminds the recipient of the
 * existing RSVP status and that a closer-in reminder (`event-reminder-3h`)
 * still follows -- honest about which reminders exist as scheduled system
 * behavior once T051 (currently Blocked) lands. */
export function buildEventReminder48hBodyHtml(props: EventReminder48hTemplateProps): string {
  const recipientName = escapeHtml(props.recipientName);
  const studentName = escapeHtml(props.studentName);
  const eventTitle = escapeHtml(props.eventTitle);
  const sessionTypeLabel = SESSION_TYPE_LABEL[props.sessionType];
  const dateTimeText = formatDateTimeRange(props.startsAt, props.endsAt);

  const reminderLine =
    props.recipientRole === 'student'
      ? `The <strong>${eventTitle}</strong> ${sessionTypeLabel} you're going to is coming up in 2 days.`
      : `The <strong>${eventTitle}</strong> ${sessionTypeLabel} <strong>${studentName}</strong> is going to is coming up in 2 days.`;

  const locationLine = props.location
    ? `<p style="margin:0 0 16px;">Location: ${escapeHtml(props.location)}</p>`
    : '';

  return `
    <p style="margin:0 0 16px;">Hi ${recipientName},</p>
    <p style="margin:0 0 16px;">${reminderLine}</p>
    <p style="margin:0 0 16px;">${dateTimeText}</p>
    ${locationLine}
    <p style="margin:0; color:#6b6480; font-size:13px;">We'll send another reminder a few hours before it starts.</p>
  `;
}

export function buildEventReminder48hPreviewText(props: EventReminder48hTemplateProps): string {
  const sessionTypeLabel = SESSION_TYPE_LABEL[props.sessionType];
  return props.recipientRole === 'student'
    ? `The ${props.eventTitle} ${sessionTypeLabel} you're going to is coming up in 2 days.`
    : `The ${props.eventTitle} ${sessionTypeLabel} ${props.studentName} is going to is coming up in 2 days.`;
}
