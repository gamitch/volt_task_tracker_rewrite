// supabase/functions/ics/description.ts
//
// DESCRIPTION "includes RSVP status when applicable" (CAL-04). Decision made
// here, per the worker packet's explicit instruction to decide and disclose
// rather than silently omit or fabricate:
//
//   - student: DESCRIPTION shows the caller's OWN rsvp status for that
//     session ("Your RSVP: <status>"), when one exists. This is the one case
//     where "applicable" unambiguously means something -- a student's own
//     `rsvps` row (unique on (session_id, student_id), T010 migration) is a
//     single, obviously-relevant value to surface.
//   - admin | coach: DESCRIPTION is omitted (no property set at all -- not
//     an empty string). A staff member's feed spans every student on every
//     team; there is no single "this session's RSVP status" to show (RSVPs
//     are per-student, not per-session), so showing one specific student's
//     answer would be arbitrary and misleading, and showing an aggregate
//     tally is out of CAL-04's stated scope for this Edge Function.
//   - parent: DESCRIPTION is also omitted, for the same reason applied to
//     the multi-child case explicitly flagged in the worker packet ("a
//     parent has one [RSVP] per linked child") -- a parent with two linked
//     students on the same team would otherwise need two different, silently
//     chosen answers merged into one line for the same VEVENT, which is
//     exactly the kind of "fabricate a value" the packet says not to do.
//     Per-child RSVP display would need a real UI surface (e.g. the
//     `/calendar` page itself, not this token feed, which has no student
//     selector), and is out of this task's scope.
//
// This is a pure decision function, independent of the database, so
// index.ts's own row-shaping code is the only caller that needs to look up
// the real rsvp status (see its own comments for that query).

export type IcsRole = 'admin' | 'coach' | 'student' | 'parent';

const RSVP_STATUS_LABELS: Record<string, string> = {
  going: 'Going',
  maybe: 'Maybe',
  declined: 'Declined',
};

export function buildDescription(role: IcsRole, rsvpStatus: string | null): string | undefined {
  if (role !== 'student') return undefined;
  if (!rsvpStatus) return undefined;

  const label = RSVP_STATUS_LABELS[rsvpStatus] ?? rsvpStatus;
  return `Your RSVP: ${label}`;
}
