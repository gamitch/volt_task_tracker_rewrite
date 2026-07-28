// supabase/functions/send-reminders/recipients.ts
//
// T051 -- EML-03 recipient expansion + notification_prefs filtering (worker
// packet Known Context/Traps #3: "two distinct steps, don't conflate them").
//
// STEP 1, "expansion" (WHO is in scope for a due session/template), is real
// database work (rsvps/students/guardian_links/profiles joins) that lives in
// index.ts, NOT in this file -- it has no meaningful "pure function" shape
// of its own (same class of limitation as `checkin/index.ts`'s own
// session/student/team-scope queries, which are also not independently
// pure-testable without a live database; `checkin/liveness.ts`/`grace.ts`
// are the PURE pieces THAT function factors out, and this file plays the
// equivalent role here). Per template (Ground Truth, worker packet):
//   - event-reminder-48h / event-reminder-3h: `going`-RSVP'd students for
//     the due session + each of THEIR linked parents (`guardian_links`).
//   - meeting-reminder-3h: students in the session's team scope
//     (`events.team_ids` -- null means all teams), NO parent expansion
//     (matching T049's own already-Passed template's deliberate
//     no-parent-branching design, cited in this task's own worker packet).
//   - weekly-digest: every parent profile with >=1 active linked student
//     (`guardian_links`), one email per PARENT (never per student) --
//     `weekly-digest.tsx`'s own EML-05 note is the template-level "no
//     leakage across families" concern; the PARENT-level uniqueness here is
//     this task's own recipient-expansion concern, distinct from that.
//
// STEP 2, notification_prefs filtering, IS a pure function of already-
// fetched data -- `filterByNotificationPrefs` below. This is where the
// "recipient with no notification_prefs row at all defaults to sending"
// rule (worker packet Known Context/Traps #3) is implemented and tested.

export type NotificationPrefColumn =
  | 'event_reminder_48h'
  | 'event_reminder_3h'
  | 'meeting_reminder_3h'
  | 'weekly_digest';

export type RecipientRole = 'student' | 'parent';

export interface RecipientCandidate {
  /** `profiles.id` -- the actual recipient's own profile, never the
   * student's own id when `role === 'parent'`. */
  profileId: string;
  /** `profiles.email` -- always populated (schema: `profiles.email text not
   * null unique`), used as this task's dedupe recipient key (see
   * `email_log_store.ts`'s file header for why `to_email`, not
   * `profile_id`, was chosen as that key). */
  email: string;
  /** Freeform display name, passed straight through to the template props
   * (e.g. `EventReminder48hTemplateProps.recipientName`). */
  displayName: string;
  role: RecipientRole;
  /** The `going`-RSVP'd (or in-team-scope, for meeting-reminder-3h)
   * student this reminder concerns -- equal to the recipient's own name
   * when `role === 'student'`. Not used by `filterByNotificationPrefs`
   * itself; carried through for template rendering in index.ts. */
  studentDisplayName: string;
}

/** Only the notification_prefs columns this task's five templates actually
 * consult -- `invite`/`signup_confirm` are out of scope (worker packet
 * Known Context/Traps #2: those fire at their own trigger events, not this
 * cron). `digest_enabled` also exists on the real table but is deliberately
 * NOT consulted here -- see index.ts's header comment "digest_enabled
 * ambiguity" note for why. */
export interface NotificationPrefsRow {
  profile_id: string;
  event_reminder_48h: boolean;
  event_reminder_3h: boolean;
  meeting_reminder_3h: boolean;
  weekly_digest: boolean;
}

/**
 * Step 2 (Known Context/Traps #3): given already-expanded candidates (step
 * 1, done by the caller) and a map of `profile_id -> notification_prefs`
 * row (only rows that actually exist -- profiles with none at all are
 * simply absent from this map, never present with a synthetic default
 * value), filters OUT any candidate whose relevant boolean pref column is
 * explicitly `false`. A candidate with no `notification_prefs` row at all
 * (a map lookup miss) is KEPT -- the column's own `not null default true`
 * (Ground Truth, `20260717000001_support_audit.sql` lines 32-43) means
 * "no row" and "a row with this column true" are the same real-world
 * state (opt-in-by-default; absence is not an opt-out) -- so treating a
 * missing row as "send" is the only reading consistent with that default,
 * not an assumption invented by this file.
 */
export function filterByNotificationPrefs(
  candidates: readonly RecipientCandidate[],
  prefsByProfileId: ReadonlyMap<string, NotificationPrefsRow>,
  column: NotificationPrefColumn,
): RecipientCandidate[] {
  return candidates.filter((candidate) => {
    const row = prefsByProfileId.get(candidate.profileId);
    if (!row) return true; // no row => default true (Ground Truth column default)
    return row[column] !== false;
  });
}

/** Builds a `profile_id -> row` lookup map from a flat array of fetched
 * `notification_prefs` rows -- a thin, pure helper so index.ts's query
 * result can be handed straight to `filterByNotificationPrefs` above. */
export function indexNotificationPrefsByProfileId(
  rows: readonly NotificationPrefsRow[],
): Map<string, NotificationPrefsRow> {
  const map = new Map<string, NotificationPrefsRow>();
  for (const row of rows) {
    map.set(row.profile_id, row);
  }
  return map;
}

/**
 * De-duplicates candidates by `profileId` -- used for weekly-digest, where
 * `guardian_links` can produce the SAME parent once per linked student; the
 * digest is one email per parent (containing all of that parent's linked
 * students), never one email per (parent, student) pair. Not needed by the
 * other four templates (each recipient already appears at most once per
 * session by construction: one `going` RSVP per student, one guardian_links
 * row per (parent, student) pair, one team-scope membership per student).
 * Keeps the FIRST occurrence's `displayName`/`studentDisplayName` (both are
 * only used for template rendering, which index.ts overrides with the
 * fully-assembled multi-student weekly-digest props regardless -- this
 * function's real job is producing a unique recipient LIST, not final
 * per-recipient content).
 */
export function dedupeCandidatesByProfileId(candidates: readonly RecipientCandidate[]): RecipientCandidate[] {
  const seen = new Set<string>();
  const result: RecipientCandidate[] = [];
  for (const candidate of candidates) {
    if (seen.has(candidate.profileId)) continue;
    seen.add(candidate.profileId);
    result.push(candidate);
  }
  return result;
}
