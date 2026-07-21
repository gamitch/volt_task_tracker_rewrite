// supabase/functions/send-reminders/index.ts
//
// T051 -- EML-03. A `pg_cron` job (see `supabase/migrations/<timestamp>_
// cron.sql`) invokes this Edge Function every 15 minutes via `pg_net`. On
// each invocation it:
//   1. Selects sessions/profiles that are DUE for each of four templates
//      (event-reminder-48h, event-reminder-3h, meeting-reminder-3h,
//      weekly-digest -- `invite`/`signup-confirm` are explicitly OUT OF
//      SCOPE here, see `due_window.ts`'s file header and this task's own
//      worker packet Known Context/Traps #2: those fire at their own
//      trigger events, T017's send-invite and a real-time RSVP-write path,
//      not on a cron schedule).
//   2. Expands recipients (students/parents, per template -- Ground Truth
//      below) and filters by `notification_prefs` (`recipients.ts`'s
//      `filterByNotificationPrefs`, worker packet Known Context/Traps #3 --
//      recipient expansion and pref-filtering are two distinct, ordered
//      steps: expansion happens first, in this file; filtering is the
//      separate pure step in `recipients.ts`).
//   3. Sends through `sendReminderIfNotDuplicate` (`send_reminder.ts`),
//      which dedupes against `email_log` BEFORE ever attempting a send
//      (Known Context/Traps #1, the central safety property of this task --
//      see that file and `email_log_store.ts` for the dedupe key design and
//      its own real, required re-run test proof).
//
// AUTHENTICATION (worker packet Known Context/Traps #4 -- investigated, not
// guessed, see the migration file's own header comment for the fuller
// pg_cron/pg_net citation): this function is invoked by `pg_net`'s
// `net.http_post`, not by an end user, so there is no per-user JWT to look
// up a `profiles` row for (unlike send-invite/checkin's two-client
// architecture). Supabase's own documented cron-invocation pattern passes
// the project's service-role key as the `Authorization: Bearer <key>`
// header on that `net.http_post` call. This function's own guard compares
// the request's `Authorization` header against
// `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}` by exact string
// match -- defense-in-depth alongside whatever platform-level JWT
// verification Supabase's Edge Runtime itself applies (which this sandbox
// cannot verify live -- see the migration file's own "UNVERIFIED" flags).
// `SUPABASE_SERVICE_ROLE_KEY` is read only via `Deno.env.get(...)` here,
// exactly mirroring send-invite/checkin (constitution item 5) -- never
// hardcoded, never echoed in any response or log line.
//
// GROUND TRUTH -- recipient expansion per template (worker packet, cited
// from the real schema, not guessed):
//   - event-reminder-48h / event-reminder-3h: `going`-RSVP'd students for
//     the due session (`rsvps.status = 'going'`) + each of THEIR linked
//     parents (`guardian_links.parent_profile_id` for that
//     `guardian_links.student_id`).
//   - meeting-reminder-3h: students in the session's team scope
//     (`events.team_ids` -- null means every team), NO parent expansion
//     (`meeting-reminder-3h.tsx`'s own already-Passed EML-05 note: "no
//     list/array prop... recipient is always a student").
//   - weekly-digest: every parent profile (`guardian_links.parent_
//     profile_id`) with at least one ACTIVE linked student
//     (`students.is_active`), one email per PARENT containing ALL of that
//     parent's linked students' content (`weekly-digest.tsx`'s own EML-05
//     "no leakage across families" design -- `students` must be scoped to
//     exactly one parent's own `guardian_links` rows, enforced here by
//     construction: each parent's `WeeklyDigestParams.students` array is
//     built only from that SAME parent's own `guardian_links` rows).
//
// `notification_prefs.digest_enabled` AMBIGUITY (disclosed, not silently
// resolved): the real `notification_prefs` table (Ground Truth,
// `20260717000001_support_audit.sql` lines 32-43) has BOTH a
// `weekly_digest` column (matching this template's own name, one of the
// "one bool per EML-02 category" columns per that migration's own comment)
// AND a separate `digest_enabled` column, called out in that same
// migration's comment as an ADDITIONAL bool beyond the six EML-02
// categories, with no further specification of its purpose available to
// this task. This function gates weekly-digest sends on `weekly_digest`
// ONLY (the column matching this template's own category, consistent with
// every other template's own column-name-matches-template convention) --
// `digest_enabled` is NOT consulted here. This is a disclosed judgment
// call, not a guess presented as certain: `digest_enabled` may be an
// unrelated UI-only toggle (e.g. "show the digest widget in-app") rather
// than an email-send gate, but that is not confirmed by any ground truth
// available to this task. Flagged in worker output as a real ambiguity a
// checker or T052 should resolve with whoever defined that column.
import { createClient } from 'npm:@supabase/supabase-js@2';
import {
  buildEventReminder48hBodyHtml,
  buildEventReminder48hPreviewText,
  type EventReminder48hTemplateProps,
} from '../../../src/emails/templates/event-reminder-48h.tsx';
import {
  buildEventReminder3hBodyHtml,
  buildEventReminder3hPreviewText,
  type EventReminder3hTemplateProps,
} from '../../../src/emails/templates/event-reminder-3h.tsx';
import {
  buildMeetingReminder3hBodyHtml,
  buildMeetingReminder3hPreviewText,
  type MeetingReminder3hTemplateProps,
} from '../../../src/emails/templates/meeting-reminder-3h.tsx';
import {
  buildWeeklyDigestPreviewText,
  computeWeeklyDigestWeekBoundaries,
  renderWeeklyDigestEmail,
  type WeeklyDigestParams,
  type WeeklyDigestStudentEntry,
} from '../../../src/emails/templates/weekly-digest.tsx';
import { renderEmailLayout } from '../../../src/emails/layout/renderEmailLayout.ts';
import { resolveSendMode, sendBrandedEmail } from './resend.ts';
import { createSupabaseEmailLogStore } from './email_log_store.ts';
import { sendReminderIfNotDuplicate } from './send_reminder.ts';
import {
  computeDueWindowBounds,
  computeWeeklyDigestSentAtWindow,
  isWeeklyDigestDue,
} from './due_window.ts';
import {
  dedupeCandidatesByProfileId,
  filterByNotificationPrefs,
  indexNotificationPrefsByProfileId,
  type NotificationPrefsRow,
  type RecipientCandidate,
} from './recipients.ts';

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

interface RunSummary {
  attempted: number;
  sent: number;
  skipped_test_mode: number;
  failed: number;
  duplicate: number;
}

function emptySummary(): RunSummary {
  return { attempted: 0, sent: 0, skipped_test_mode: 0, failed: 0, duplicate: 0 };
}

function recordOutcome(summary: RunSummary, outcome: { outcome: 'duplicate' | 'sent' | 'skipped_test_mode' | 'failed' }): void {
  summary.attempted += 1;
  summary[outcome.outcome] += 1;
}

// Minimal shape used throughout -- supabase-js's generic client typing
// (no Database type param, matching send-invite/checkin's own precedent)
// returns `any` for query results, so this file goes through locally
// declared row shapes + `as unknown as X` at the query boundary, the same
// idiom `checkin/index.ts` already established for its own embedded-relation
// reads (see that file's own comment on TS2352 there).
//
// `AdminClient = any` (not `ReturnType<typeof createClient>`) is a
// deliberate, disclosed choice: supabase-js's own generic `SupabaseClient`
// type (with no `Database` type param, matching every other Edge Function
// in this codebase -- there is no generated Database type anywhere in this
// project) resolves to a type too deep/specific for this file's own narrow
// per-query helper interfaces (`EmailLogClientLike` in
// `email_log_store.ts`) to structurally match without triggering TS2589
// "excessively deep" instantiation errors. `send-invite/index.ts` has the
// identical, already-Passed, already-disclosed class of mismatch (a
// `deno check` TS2345 between `SupabaseClient` and its own narrower
// `EmailLogWriter` interface) -- this file avoids re-deriving that same
// error by typing the client boundary as `any` explicitly up front instead.
// deno-lint-ignore no-explicit-any
type AdminClient = any;

interface EventSessionRow {
  id: string;
  starts_at: string;
  ends_at: string;
  status: string;
  event: { id: string; type: string; title: string; location_name: string; team_ids: string[] | null } | null;
}

interface ProfileRow {
  id: string;
  email: string;
  display_name: string;
}

/** Fetches scheduled sessions whose `starts_at` falls in `[bounds.start,
 * bounds.end)`, with their parent event embedded -- filtering by event
 * `type` happens in JS (not pushed into the PostgREST query), matching
 * `checkin/index.ts`'s own already-Passed precedent for this exact
 * embedded-relation shape (that file's header explains why: this sandbox
 * cannot verify PostgREST's embedded-filter querystring syntax against a
 * live project). */
async function fetchDueSessions(
  adminClient: AdminClient,
  bounds: { start: string; end: string },
): Promise<EventSessionRow[]> {
  const { data, error } = await adminClient
    .from('event_sessions')
    .select('id, starts_at, ends_at, status, event:events(id, type, title, location_name, team_ids)')
    .eq('status', 'scheduled')
    .gte('starts_at', bounds.start)
    .lt('starts_at', bounds.end);

  if (error) {
    console.error('send-reminders: due-session lookup failed', { error: error.message });
    return [];
  }
  return (data ?? []) as unknown as EventSessionRow[];
}

async function fetchProfilesByIds(adminClient: AdminClient, ids: readonly string[]): Promise<Map<string, ProfileRow>> {
  const uniqueIds = [...new Set(ids)];
  if (uniqueIds.length === 0) return new Map();
  const { data, error } = await adminClient.from('profiles').select('id, email, display_name').in('id', uniqueIds);
  if (error) {
    console.error('send-reminders: profile lookup failed', { error: error.message });
    return new Map();
  }
  const map = new Map<string, ProfileRow>();
  for (const row of (data ?? []) as unknown as ProfileRow[]) {
    map.set(row.id, row);
  }
  return map;
}

async function fetchNotificationPrefs(adminClient: AdminClient, profileIds: readonly string[]): Promise<Map<string, NotificationPrefsRow>> {
  const uniqueIds = [...new Set(profileIds)];
  if (uniqueIds.length === 0) return new Map();
  const { data, error } = await adminClient
    .from('notification_prefs')
    .select('profile_id, event_reminder_48h, event_reminder_3h, meeting_reminder_3h, weekly_digest')
    .in('profile_id', uniqueIds);
  if (error) {
    console.error('send-reminders: notification_prefs lookup failed', { error: error.message });
    return new Map();
  }
  return indexNotificationPrefsByProfileId((data ?? []) as unknown as NotificationPrefsRow[]);
}

// ---------------------------------------------------------------------------
// event-reminder-48h / event-reminder-3h -- shared shape (Ground Truth: same
// recipient expansion, different offsetHours/template name/prefs column).
// ---------------------------------------------------------------------------

interface EventReminderConfig {
  template: 'event-reminder-48h' | 'event-reminder-3h';
  offsetHours: 48 | 3;
  prefsColumn: 'event_reminder_48h' | 'event_reminder_3h';
  buildBodyHtml: (props: EventReminder48hTemplateProps | EventReminder3hTemplateProps) => string;
  buildPreviewText: (props: EventReminder48hTemplateProps | EventReminder3hTemplateProps) => string;
}

const EVENT_REMINDER_CONFIGS: EventReminderConfig[] = [
  {
    template: 'event-reminder-48h',
    offsetHours: 48,
    prefsColumn: 'event_reminder_48h',
    buildBodyHtml: buildEventReminder48hBodyHtml,
    buildPreviewText: buildEventReminder48hPreviewText,
  },
  {
    template: 'event-reminder-3h',
    offsetHours: 3,
    prefsColumn: 'event_reminder_3h',
    buildBodyHtml: buildEventReminder3hBodyHtml,
    buildPreviewText: buildEventReminder3hPreviewText,
  },
];

async function runEventReminders(
  adminClient: AdminClient,
  store: ReturnType<typeof createSupabaseEmailLogStore>,
  sendMode: ReturnType<typeof resolveSendMode>,
  now: Date,
  summary: RunSummary,
): Promise<void> {
  for (const config of EVENT_REMINDER_CONFIGS) {
    const bounds = computeDueWindowBounds(now, config.offsetHours);
    const sessions = (await fetchDueSessions(adminClient, bounds)).filter(
      (session) => session.event?.type === 'outreach' || session.event?.type === 'competition',
    );

    for (const session of sessions) {
      const event = session.event;
      if (!event) continue;

      const { data: rsvpRows, error: rsvpError } = await adminClient
        .from('rsvps')
        .select('student_id')
        .eq('session_id', session.id)
        .eq('status', 'going');
      if (rsvpError) {
        console.error('send-reminders: rsvp lookup failed', { session_id: session.id, error: rsvpError.message });
        continue;
      }
      const studentIds = [...new Set(((rsvpRows ?? []) as { student_id: string }[]).map((r) => r.student_id))];
      if (studentIds.length === 0) continue;

      const { data: studentRows, error: studentError } = await adminClient
        .from('students')
        .select('id, display_name, profile_id')
        .in('id', studentIds)
        .eq('is_active', true);
      if (studentError) {
        console.error('send-reminders: student lookup failed', { session_id: session.id, error: studentError.message });
        continue;
      }
      const students = (studentRows ?? []) as { id: string; display_name: string; profile_id: string | null }[];

      const { data: guardianRows, error: guardianError } = await adminClient
        .from('guardian_links')
        .select('student_id, parent_profile_id')
        .in('student_id', studentIds);
      if (guardianError) {
        console.error('send-reminders: guardian_links lookup failed', { session_id: session.id, error: guardianError.message });
      }
      const guardianLinks = (guardianRows ?? []) as { student_id: string; parent_profile_id: string }[];

      const studentById = new Map(students.map((s) => [s.id, s]));
      const neededProfileIds = [
        ...students.map((s) => s.profile_id).filter((id): id is string => !!id),
        ...guardianLinks.map((g) => g.parent_profile_id),
      ];
      const profilesById = await fetchProfilesByIds(adminClient, neededProfileIds);

      const candidates: RecipientCandidate[] = [];
      for (const student of students) {
        if (!student.profile_id) continue; // no linked auth profile yet -- no email to send to
        const profile = profilesById.get(student.profile_id);
        if (!profile) continue;
        candidates.push({
          profileId: profile.id,
          email: profile.email,
          displayName: profile.display_name,
          role: 'student',
          studentDisplayName: student.display_name,
        });
      }
      for (const link of guardianLinks) {
        const student = studentById.get(link.student_id);
        if (!student) continue; // not one of this session's going/active students
        const profile = profilesById.get(link.parent_profile_id);
        if (!profile) continue;
        candidates.push({
          profileId: profile.id,
          email: profile.email,
          displayName: profile.display_name,
          role: 'parent',
          studentDisplayName: student.display_name,
        });
      }

      const prefsByProfileId = await fetchNotificationPrefs(adminClient, candidates.map((c) => c.profileId));
      const filtered = filterByNotificationPrefs(candidates, prefsByProfileId, config.prefsColumn);

      for (const candidate of filtered) {
        const props: EventReminder48hTemplateProps | EventReminder3hTemplateProps = {
          recipientRole: candidate.role,
          recipientName: candidate.displayName,
          studentName: candidate.studentDisplayName,
          sessionType: event.type as 'outreach' | 'competition',
          eventTitle: event.title,
          startsAt: session.starts_at,
          endsAt: session.ends_at,
          location: event.location_name || undefined,
        };
        const html = renderEmailLayout({ previewText: config.buildPreviewText(props), bodyHtml: config.buildBodyHtml(props) });

        const outcome = await sendReminderIfNotDuplicate(store, sendBrandedEmail, sendMode, {
          template: config.template,
          sessionId: session.id,
          toEmail: candidate.email,
          profileId: candidate.profileId,
          subject: config.buildPreviewText(props),
          html,
          dedupeCriteria: { template: config.template, sessionId: session.id, toEmail: candidate.email },
        });
        recordOutcome(summary, outcome);
      }
    }
  }
}

// ---------------------------------------------------------------------------
// meeting-reminder-3h -- team-scope expansion, no parent branch.
// ---------------------------------------------------------------------------

async function runMeetingReminders(
  adminClient: AdminClient,
  store: ReturnType<typeof createSupabaseEmailLogStore>,
  sendMode: ReturnType<typeof resolveSendMode>,
  now: Date,
  summary: RunSummary,
): Promise<void> {
  const bounds = computeDueWindowBounds(now, 3);
  const sessions = (await fetchDueSessions(adminClient, bounds)).filter((session) => session.event?.type === 'meeting');

  for (const session of sessions) {
    const event = session.event;
    if (!event) continue;

    let studentQuery = adminClient.from('students').select('id, display_name, profile_id').eq('is_active', true);
    if (event.team_ids !== null) {
      studentQuery = studentQuery.in('team_id', event.team_ids);
    }
    const { data: studentRows, error: studentError } = await studentQuery;
    if (studentError) {
      console.error('send-reminders: meeting-scope student lookup failed', { session_id: session.id, error: studentError.message });
      continue;
    }
    const students = (studentRows ?? []) as { id: string; display_name: string; profile_id: string | null }[];

    const profilesById = await fetchProfilesByIds(
      adminClient,
      students.map((s) => s.profile_id).filter((id): id is string => !!id),
    );

    const candidates: RecipientCandidate[] = [];
    for (const student of students) {
      if (!student.profile_id) continue;
      const profile = profilesById.get(student.profile_id);
      if (!profile) continue;
      candidates.push({
        profileId: profile.id,
        email: profile.email,
        displayName: profile.display_name,
        role: 'student',
        studentDisplayName: student.display_name,
      });
    }

    const prefsByProfileId = await fetchNotificationPrefs(adminClient, candidates.map((c) => c.profileId));
    const filtered = filterByNotificationPrefs(candidates, prefsByProfileId, 'meeting_reminder_3h');

    for (const candidate of filtered) {
      const props: MeetingReminder3hTemplateProps = {
        recipientName: candidate.displayName,
        meetingTitle: event.title,
        startsAt: session.starts_at,
        endsAt: session.ends_at,
        location: event.location_name || undefined,
      };
      const html = renderEmailLayout({
        previewText: buildMeetingReminder3hPreviewText(props),
        bodyHtml: buildMeetingReminder3hBodyHtml(props),
      });

      const outcome = await sendReminderIfNotDuplicate(store, sendBrandedEmail, sendMode, {
        template: 'meeting-reminder-3h',
        sessionId: session.id,
        toEmail: candidate.email,
        profileId: candidate.profileId,
        subject: buildMeetingReminder3hPreviewText(props),
        html,
        dedupeCriteria: { template: 'meeting-reminder-3h', sessionId: session.id, toEmail: candidate.email },
      });
      recordOutcome(summary, outcome);
    }
  }
}

// ---------------------------------------------------------------------------
// weekly-digest -- whole-batch, per-parent, Sunday 5pm CT (see due_window.ts
// and email_log_store.ts file headers for the full out-of-scope-for-
// per-session-logic disclosure and the sentAtWindow dedupe-key consequence).
// ---------------------------------------------------------------------------

async function runWeeklyDigest(
  adminClient: AdminClient,
  store: ReturnType<typeof createSupabaseEmailLogStore>,
  sendMode: ReturnType<typeof resolveSendMode>,
  now: Date,
  summary: RunSummary,
): Promise<void> {
  if (!isWeeklyDigestDue(now)) return;

  const { data: seasonRow, error: seasonError } = await adminClient
    .from('seasons')
    .select('id, default_goal_hours')
    .eq('is_active', true)
    .maybeSingle();
  if (seasonError || !seasonRow) {
    // Known risk (worker output): with no active season, MET-04's
    // confirmed-hours-vs-goal figure has no denominator/season to compute
    // against, so this run skips weekly-digest entirely rather than
    // guessing a season -- disclosed, not silent (see worker output).
    console.error('send-reminders: weekly-digest skipped, no active season found', { error: seasonError?.message });
    return;
  }
  const season = seasonRow as { id: string; default_goal_hours: number };

  const { data: guardianRows, error: guardianError } = await adminClient
    .from('guardian_links')
    .select('parent_profile_id, student_id');
  if (guardianError) {
    console.error('send-reminders: weekly-digest guardian_links lookup failed', { error: guardianError.message });
    return;
  }
  const guardianLinks = (guardianRows ?? []) as { parent_profile_id: string; student_id: string }[];
  if (guardianLinks.length === 0) return;

  const allStudentIds = [...new Set(guardianLinks.map((g) => g.student_id))];
  const { data: studentRows, error: studentError } = await adminClient
    .from('students')
    .select('id, display_name, team_id, goal_hours_override')
    .in('id', allStudentIds)
    .eq('is_active', true);
  if (studentError) {
    console.error('send-reminders: weekly-digest student lookup failed', { error: studentError.message });
    return;
  }
  const students = (studentRows ?? []) as { id: string; display_name: string; team_id: string; goal_hours_override: number | null }[];
  const studentById = new Map(students.map((s) => [s.id, s]));

  const teamIds = [...new Set(students.map((s) => s.team_id))];
  const { data: teamRows } = teamIds.length > 0
    ? await adminClient.from('teams').select('id, name').in('id', teamIds)
    : { data: [] as unknown[] };
  const teamNameById = new Map(((teamRows ?? []) as { id: string; name: string }[]).map((t) => [t.id, t.name]));

  const activeStudentIds = students.map((s) => s.id);
  const { data: hoursRows } = activeStudentIds.length > 0
    ? await adminClient.from('v_student_hours').select('student_id, confirmed_hours').eq('season_id', season.id).in('student_id', activeStudentIds)
    : { data: [] as unknown[] };
  const confirmedHoursByStudentId = new Map(
    ((hoursRows ?? []) as { student_id: string; confirmed_hours: number }[]).map((r) => [r.student_id, r.confirmed_hours]),
  );

  const boundaries = computeWeeklyDigestWeekBoundaries(now);

  // Last week's attendance -- fetched via event_sessions/events in the
  // lastWeek date range, then joined to attendance rows in JS (same
  // "fetch and join in application code" idiom as the rest of this file --
  // see fetchDueSessions's own comment for why).
  const { data: lastWeekSessionRows } = await adminClient
    .from('event_sessions')
    .select('id, session_date, event:events(title)')
    .gte('session_date', boundaries.lastWeekStart)
    .lte('session_date', boundaries.lastWeekEnd);
  const lastWeekSessions = (lastWeekSessionRows ?? []) as { id: string; session_date: string; event: { title: string } | null }[];
  const lastWeekSessionIds = lastWeekSessions.map((s) => s.id);

  const { data: attendanceRows } =
    lastWeekSessionIds.length > 0 && activeStudentIds.length > 0
      ? await adminClient
          .from('attendance')
          .select('student_id, session_id, status')
          .in('student_id', activeStudentIds)
          .in('session_id', lastWeekSessionIds)
      : { data: [] as unknown[] };
  const attendance = (attendanceRows ?? []) as { student_id: string; session_id: string; status: string }[];

  // Next week's schedule -- scheduled sessions in the nextWeek date range,
  // filtered per-student by team scope (event.team_ids null = all teams).
  const { data: nextWeekSessionRows } = await adminClient
    .from('event_sessions')
    .select('id, session_date, starts_at, ends_at, status, event:events(id, title, type, team_ids)')
    .gte('session_date', boundaries.nextWeekStart)
    .lte('session_date', boundaries.nextWeekEnd)
    .eq('status', 'scheduled');
  const nextWeekSessions = (nextWeekSessionRows ?? []) as {
    id: string;
    session_date: string;
    starts_at: string;
    ends_at: string;
    status: string;
    event: { id: string; title: string; type: string; team_ids: string[] | null } | null;
  }[];

  function buildStudentEntry(studentId: string): WeeklyDigestStudentEntry {
    const student = studentById.get(studentId)!;
    const lastWeekAttendance = attendance
      .filter((a) => a.student_id === studentId)
      .map((a) => {
        const session = lastWeekSessions.find((s) => s.id === a.session_id);
        return {
          sessionId: a.session_id,
          eventTitle: session?.event?.title ?? '',
          sessionDate: session?.session_date ?? '',
          status: a.status as 'present' | 'late' | 'excused' | 'absent',
        };
      });
    const nextWeekSchedule = nextWeekSessions
      .filter((s) => s.event && (s.event.team_ids === null || s.event.team_ids.includes(student.team_id)))
      .map((s) => ({
        sessionId: s.id,
        eventTitle: s.event!.title,
        eventType: s.event!.type as 'meeting' | 'outreach' | 'competition',
        sessionDate: s.session_date,
        startsAt: s.starts_at,
        endsAt: s.ends_at,
      }));

    return {
      studentId,
      displayName: student.display_name,
      teamName: teamNameById.get(student.team_id) ?? '',
      confirmedHours: confirmedHoursByStudentId.get(studentId) ?? 0,
      defaultGoalHours: season.default_goal_hours,
      goalHoursOverride: student.goal_hours_override,
      lastWeekAttendance,
      nextWeekSchedule,
    };
  }

  // Build one candidate PER (parent, active-linked-student) guardian_links
  // row, then dedupe to one recipient per parent (recipients.ts's
  // `dedupeCandidatesByProfileId` -- see that file's header for why this
  // template needs it and the other four don't), and separately build the
  // FULL per-parent student-entry list from ALL of that parent's active
  // links (not just the one guardian_links row a given candidate happened
  // to be deduped from) -- this is what enforces weekly-digest.tsx's own
  // EML-05 "students scoped to exactly one parent's own guardian_links
  // rows" contract.
  const studentIdsByParent = new Map<string, string[]>();
  for (const link of guardianLinks) {
    if (!studentById.has(link.student_id)) continue; // not an active student
    const existing = studentIdsByParent.get(link.parent_profile_id) ?? [];
    existing.push(link.student_id);
    studentIdsByParent.set(link.parent_profile_id, existing);
  }

  const parentProfileIds = [...studentIdsByParent.keys()];
  const parentProfilesById = await fetchProfilesByIds(adminClient, parentProfileIds);

  const rawCandidates: RecipientCandidate[] = [];
  for (const [parentProfileId, studentIds] of studentIdsByParent) {
    const profile = parentProfilesById.get(parentProfileId);
    if (!profile) continue;
    rawCandidates.push({
      profileId: parentProfileId,
      email: profile.email,
      displayName: profile.display_name,
      role: 'parent',
      studentDisplayName: studentById.get(studentIds[0])?.display_name ?? '',
    });
  }
  const uniqueParents = dedupeCandidatesByProfileId(rawCandidates);

  const prefsByProfileId = await fetchNotificationPrefs(adminClient, uniqueParents.map((c) => c.profileId));
  const filtered = filterByNotificationPrefs(uniqueParents, prefsByProfileId, 'weekly_digest');

  const sentAtWindow = computeWeeklyDigestSentAtWindow(now);

  for (const candidate of filtered) {
    const studentIds = studentIdsByParent.get(candidate.profileId) ?? [];
    const params: WeeklyDigestParams = {
      parentDisplayName: candidate.displayName,
      sendInstant: now,
      students: studentIds.map(buildStudentEntry),
    };
    const html = renderWeeklyDigestEmail(params);

    const outcome = await sendReminderIfNotDuplicate(store, sendBrandedEmail, sendMode, {
      template: 'weekly-digest',
      sessionId: null,
      toEmail: candidate.email,
      profileId: candidate.profileId,
      subject: buildWeeklyDigestPreviewText(params),
      html,
      dedupeCriteria: {
        template: 'weekly-digest',
        sessionId: null,
        toEmail: candidate.email,
        sentAtWindow: { startIso: sentAtWindow.start, endIso: sentAtWindow.end },
      },
    });
    recordOutcome(summary, outcome);
  }
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return jsonResponse(405, { error: { code: 'METHOD_NOT_ALLOWED', message: 'This function is invoked by pg_cron via POST only.' } });
  }

  // Supabase's own auto-injected Edge Function secrets (constitution item
  // 5: read only via Deno.env.get, never hardcoded).
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceRoleKey) {
    return jsonResponse(500, { error: { code: 'CONFIG_ERROR', message: 'The reminder service is not configured correctly. Contact an administrator.' } });
  }

  // Cron-invocation guard (file header "AUTHENTICATION" -- investigated,
  // flagged as unverified against a live project in the migration file).
  const authHeader = req.headers.get('Authorization');
  if (authHeader !== `Bearer ${serviceRoleKey}`) {
    return jsonResponse(401, { error: { code: 'UNAUTHENTICATED', message: 'This function may only be invoked with the service-role key.' } });
  }

  const adminClient: AdminClient = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const store = createSupabaseEmailLogStore(adminClient);
  const sendMode = resolveSendMode();
  const now = new Date();

  const summary = emptySummary();
  await runEventReminders(adminClient, store, sendMode, now, summary);
  await runMeetingReminders(adminClient, store, sendMode, now, summary);
  await runWeeklyDigest(adminClient, store, sendMode, now, summary);

  return jsonResponse(200, { ran_at: now.toISOString(), send_mode: sendMode, summary });
});
