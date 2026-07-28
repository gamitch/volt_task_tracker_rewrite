// src/emails/templates/signup-confirm.tsx
//
// T049 -- EML-02 "signup-confirm" template (row 2, PRD line 318-326, cited
// verbatim): trigger "RSVP set to `going`", recipient "student (+ linked
// parents)".
//
// TRAP #1: this file follows the same plain-TypeScript-with-`.tsx`-filename
// decision `invite.tsx` (this task's own sibling file) documents in full at
// the top of its module doc -- read that comment for the complete reasoning
// (T048's cross-runtime precedent, the constitution item 9 allowlist gap for
// a JSX-based email renderer, and why `.tsx` does not force JSX content).
// Not repeated verbatim here to avoid five copies of the same paragraph.
//
// EML-05 ("No email content may include another student's data"): this
// template's props below accept exactly one student's data (`studentName`)
// and one recipient's data (`recipientName`) -- there is no list/array prop
// here, so a caller cannot pass multiple students' data into a single
// render even by mistake. RSVP applies to outreach/competition sessions
// only (CMP-03, PRD 6.4/6.5) -- meetings have no RSVP, hence a separate
// `meeting-reminder-3h` template with its own recipient shape.
//
// Escaping: `bodyHtml` is trusted, unescaped-by-the-layout HTML (see
// `renderEmailLayout.ts`'s own doc) -- every freeform value below
// (`recipientName`, `studentName`, `eventTitle`, `location`) is escaped
// before interpolation via the local `escapeHtml`, duplicated per-file
// across this task's five templates the same way `invite.tsx` documents
// (no shared-util file is in this task's Allowed Files).
//
// BEH-08 date rendering ("dates always carry weekday names... ranges and
// schedules show computed counts and durations... Applies everywhere
// sessions render, including emails") is implemented locally below
// (`formatDateTimeRange`), independently reimplemented rather than imported
// -- `src/pages/home/StudentHome.tsx`'s own `formatDateOnly`/
// `formatDateTimeRange` is a read-only reference file outside this task's
// Allowed Files, matching that file's own "independently reimplemented"
// posture for the same reason.

export type SignupConfirmSessionType = 'outreach' | 'competition';

export interface SignupConfirmTemplateProps {
  /** Distinguishes "you're signed up" (sent to the student) from
   * "{studentName} is signed up" (sent to a linked parent) -- keeps the
   * recipient context in this template's props obvious rather than
   * assuming a generic "Hi there", per this task's worker packet trap #3. */
  recipientRole: 'student' | 'parent';
  /** Freeform display name of the actual recipient (the student, or a
   * linked parent) -- escaped before interpolation. */
  recipientName: string;
  /** Freeform display name of the student whose RSVP triggered this send.
   * Equal to `recipientName` when `recipientRole === 'student'`. */
  studentName: string;
  sessionType: SignupConfirmSessionType;
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
 * PM · 2 h" (matches the PRD's own literal example format). */
function formatDateTimeRange(startsAt: string, endsAt: string): string {
  const startText = CLOCK_TIME_FORMATTER.format(new Date(startsAt));
  const endText = CLOCK_TIME_FORMATTER.format(new Date(endsAt));
  return `${formatDateOnly(startsAt)} · ${startText}–${endText} · ${formatDurationHours(startsAt, endsAt)}`;
}

const SESSION_TYPE_LABEL: Record<SignupConfirmSessionType, string> = {
  outreach: 'outreach event',
  competition: 'competition',
};

/** DES-14 sentence case, plain verbs. BEH-09 "say what happens next": the
 * PRD's own literal example is "You're signed up — we'll remind you 2 days
 * before" -- this template states that, honestly scoped to the two
 * reminder templates that actually exist as scheduled system behavior
 * (`event-reminder-48h`, `event-reminder-3h`) once T051 (currently Blocked)
 * lands, matching the same forward-looking-but-honest posture T035 already
 * took for its own "no real tally source" disclosure. */
export function buildSignupConfirmBodyHtml(props: SignupConfirmTemplateProps): string {
  const recipientName = escapeHtml(props.recipientName);
  const studentName = escapeHtml(props.studentName);
  const eventTitle = escapeHtml(props.eventTitle);
  const sessionTypeLabel = SESSION_TYPE_LABEL[props.sessionType];
  const dateTimeText = formatDateTimeRange(props.startsAt, props.endsAt);

  const signupLine =
    props.recipientRole === 'student'
      ? `You're signed up for the <strong>${eventTitle}</strong> ${sessionTypeLabel}.`
      : `<strong>${studentName}</strong> is signed up for the <strong>${eventTitle}</strong> ${sessionTypeLabel}.`;

  const locationLine = props.location
    ? `<p style="margin:0 0 16px;">Location: ${escapeHtml(props.location)}</p>`
    : '';

  return `
    <p style="margin:0 0 16px;">Hi ${recipientName},</p>
    <p style="margin:0 0 16px;">${signupLine}</p>
    <p style="margin:0 0 16px;">${dateTimeText}</p>
    ${locationLine}
    <p style="margin:0; color:#6b6480; font-size:13px;">We'll remind you 2 days before and again a few hours before the event starts.</p>
  `;
}

export function buildSignupConfirmPreviewText(props: SignupConfirmTemplateProps): string {
  const sessionTypeLabel = SESSION_TYPE_LABEL[props.sessionType];
  return props.recipientRole === 'student'
    ? `You're signed up for the ${props.eventTitle} ${sessionTypeLabel}.`
    : `${props.studentName} is signed up for the ${props.eventTitle} ${sessionTypeLabel}.`;
}
