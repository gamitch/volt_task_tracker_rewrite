// src/emails/templates/weekly-digest.tsx
//
// T050 -- EML-02 row 6, "Weekly digest" parent-facing email. Per linked
// student: last week's attendance, hours vs. goal, next week's schedule.
// Sent Sundays 5pm CT -- the actual cron scheduling/send call is T051's job
// (`supabase/functions/send-reminders/**`, currently Blocked, a Forbidden
// File never referenced here). This file builds ONLY the rendered content:
// a pure function of typed props in, an HTML string out.
//
// -----------------------------------------------------------------------
// 1. `.tsx`-extension decision (Known Context/Traps #1). This task's packet
//    instructs: match T049's choice if it has already landed, otherwise make
//    and disclose an independent one. At the time this file was written,
//    `src/emails/templates/**` was empty (T049 had not yet landed) -- so
//    this is this task's OWN decision, made for the same reason T048's
//    `renderEmailLayout.ts`/`constants.ts` header comments already give:
//    this module contains NO JSX syntax at all (it is plain
//    template-literal-built HTML strings, exactly like
//    `inviteFixtureBody.ts`), even though the file is named `.tsx` per this
//    task's own Allowed Files list. A `.tsx` extension with zero JSX inside
//    it is valid TypeScript either way (tsc only engages JSX parsing rules
//    when it actually encounters JSX syntax) -- named `.tsx` to satisfy the
//    packet's literal Allowed Files path, built with the same
//    zero-React/zero-JSX-dependency posture as `renderEmailLayout.ts` so
//    this file remains importable, byte-unchanged, from a future Deno
//    `send-reminders` Edge Function the same way `renderEmailLayout.ts`
//    itself is designed to be (T051, separate, currently Blocked, would be
//    the one to actually wire that import). A React/JSX email-rendering
//    package (`@react-email/*`-style) was rejected for the identical reason
//    `renderEmailLayout.ts`'s own header comment already documents: it is
//    not on the constitution item 9 dependency allowlist, and there is no
//    bundler step between `src/` and a Deno Edge Function that would make a
//    JSX-based renderer consumable from both runtimes without new
//    infrastructure this task is not scoped to build.
//
// -----------------------------------------------------------------------
// 2. EML-05 -- BLOCKER-class for this template specifically (Known Context/
//    Traps #2). This is the ONE template in the whole EML-02 set that
//    structurally handles multiple students (however many children a parent
//    has linked) in a single email. The leakage-proof structure here is
//    deliberately the simplest one available: `WeeklyDigestParams.students`
//    is a plain, REQUIRED, caller-supplied array with no default value and
//    no fallback -- there is no "load all students" seam anywhere in this
//    file (unlike e.g. `ParentHome.tsx`'s injectable `loadLinkedStudents`
//    seam, which defaults to a fixture roster; that class of default seam is
//    deliberately NOT reproduced here, since Known Context/Traps #6
//    explicitly scopes this task to "pure function of typed props", no
//    Supabase wiring, no roster-loading of any kind). `buildWeeklyDigestBodyHtml`
//    and `renderWeeklyDigestEmail` below iterate ONLY over
//    `params.students` -- grep-provable: neither function references any
//    module-level "all students"/"all families" constant, only the
//    function's own parameter. Whichever caller eventually wires this up
//    (T051) is responsible for passing an array already scoped to exactly
//    one parent's own `guardian_links` rows (the same responsibility
//    `ParentHome.tsx`'s own `loadLinkedStudents` seam already carries for
//    the in-app Home page) -- this file cannot silently broaden that scope
//    since it has no data-fetching code path of its own to broaden. See
//    `weekly-digest.test.tsx`'s "EML-05" describe block for the real,
//    two-distinct-fabricated-family proof this packet requires.
//
// -----------------------------------------------------------------------
// 3. Hours vs. goal (Known Context/Traps #3, Dependencies). `confirmedHours`
//    on `WeeklyDigestStudentEntry` is a plain number prop -- sourced
//    upstream from `v_student_hours` (`supabase/migrations/
//    20260717000003_metric_views.sql` lines 3-18, `confirmed_hours` per
//    `(student_id, season_id)`), NEVER summed/recomputed in this file
//    (constitution item 3, BLOCKER if violated -- grep-provable: no
//    `reduce`/`+=`/manual accumulation over `lastWeekAttendance` or any
//    other per-session array feeds `confirmedHours` anywhere below).
//    `studentGoalHours`/`hoursVsGoalPercent` below are the identical
//    UI-side idiom already established and independently checker-approved
//    in `StudentHome.tsx`/`ParentHome.tsx`/`CoachHome.tsx` (all Forbidden
//    Files/read-only reference only for this task -- `ParentHome.tsx` was
//    the one read for this task, its own `studentGoalHours`/
//    `hoursVsGoalPercent`/`round1` functions, lines ~770-800, reproduced
//    here as the SAME shape, independently reimplemented rather than
//    imported): `goalHours = goalHoursOverride ?? defaultGoalHours` (a
//    plain nullish-coalesce, not a formula), `hoursVsGoalPercent` a clamped
//    (`Math.min(100, ...)`), rounded-to-one-decimal ratio, `goalHours <= 0`
//    guarded to `0`.
//
// -----------------------------------------------------------------------
// 4. Week boundaries (Known Context/Traps #4, this task's own disclosed
//    judgment call -- no PRD text pins this down). Interpretation chosen: a
//    Sun-Sat calendar week aligned to the Sunday 5pm CT send time (EML-02),
//    NOT a trailing "7 days before send" rolling window. Concretely,
//    `computeWeeklyDigestWeekBoundaries(sendInstant)` treats whichever
//    calendar day `sendInstant` falls on in America/Chicago as the FIRST day
//    of "next week" (`nextWeekStart`), the 6 days after that as the rest of
//    "next week" (`nextWeekEnd`), and the 7 days immediately before
//    `nextWeekStart` as "last week" (`lastWeekStart`..`lastWeekEnd`). This
//    function does not itself validate that `sendInstant` actually falls on
//    a Sunday -- EML-02's own cron schedule (T051, separate, Blocked) is
//    what guarantees that in production; this function is a pure date-math
//    helper only. The Sun-Sat-calendar-week reading was chosen over a
//    trailing-7-days reading because it produces round, human-legible date
//    ranges in the email copy ("Jul 13 – Jul 18") that line up with how a
//    recipient would naturally think about "last week"/"next week" relative
//    to a fixed Sunday send, rather than a window that silently shifts by a
//    few hours depending on exact send latency.
//
// -----------------------------------------------------------------------
// 5. BEH-01/BEH-02 (Known Context/Traps #5). The ONLY progress number
//    rendered per student is `confirmedHours` vs. `goalHours` -- there is no
//    "planned hours" concept in a past-tense weekly digest (unlike
//    `OutreachList.tsx`'s coach goal-bar, which pairs confirmed with
//    upcoming/planned signups), so there is no confirmed+planned sum to
//    accidentally produce here; `lastWeekAttendance`'s per-session list is
//    rendered as a literal list of individual sessions with their own
//    status label, never rolled into a second numeric total that could
//    double-count against `confirmedHours`. Milestone framing reuses the
//    same `[25, 50, 75, 100]` idiom already established in
//    `OutreachList.tsx`'s `GOAL_MILESTONES`/`crossedMilestones` (Forbidden
//    File/read-only reference only here, independently reimplemented as
//    `GOAL_MILESTONES`/`highestMilestoneReached` below) -- computed from
//    `confirmedHours` only, per that same file's own "planned hours are
//    provisional, so they never contribute to reaching a milestone" rule.
//    There is no toast/dedupe mechanism here (that is a UI-session concept,
//    `localStorage`-backed, meaningless for a one-shot rendered email) --
//    just an optional single sentence naming the highest milestone reached,
//    or nothing at all below the first milestone.
//
// -----------------------------------------------------------------------
// 6. No shared Supabase client, no real send path (Known Context/Traps #6).
//    Every function below is a pure function of typed props; the only
//    "fixture" data in this file lives in `weekly-digest.test.tsx`
//    (obviously-fake names, constitution item 6), not in this module itself
//    -- unlike `ParentHome.tsx`/`inviteFixtureBody.ts`, this template has no
//    default-parameter fixture fallback of its own (see module doc #2 above
//    for why that is a deliberate EML-05 hardening choice, not an oversight).
import { ACCENT_LIGHT, MANAGE_PREFERENCES_URL, SENDER_ADDRESS } from '../layout/constants.ts';
import { renderEmailLayout } from '../layout/renderEmailLayout.ts';

// ---------------------------------------------------------------------------
// Types -- verbatim camelCase shapes matching the real schema (module doc
// #3), cited from `supabase/migrations/20260717000000_scheduling_attendance.sql`
// (`attendance.status` check, line 86: 'present' | 'late' | 'excused' |
// 'absent'; `events.type`, line ~40: 'meeting' | 'outreach' | 'competition')
// and `20260717000003_metric_views.sql` (`v_student_hours`, lines 3-18).
// ---------------------------------------------------------------------------

export type AttendanceStatus = 'present' | 'late' | 'excused' | 'absent';
export type DigestEventType = 'meeting' | 'outreach' | 'competition';

export interface WeeklyDigestAttendanceEntry {
  sessionId: string;
  eventTitle: string;
  /** `event_sessions.session_date` shape, 'YYYY-MM-DD'. */
  sessionDate: string;
  status: AttendanceStatus;
}

export interface WeeklyDigestScheduleEntry {
  sessionId: string;
  eventTitle: string;
  eventType: DigestEventType;
  sessionDate: string;
  startsAt: string;
  endsAt: string;
}

/**
 * One linked student's digest content. `confirmedHours` is a verbatim
 * `v_student_hours.confirmed_hours` lookup for this student's current
 * season -- never recomputed here (module doc #3). `goalHoursOverride`/
 * `defaultGoalHours` are `students.goal_hours_override`/
 * `seasons.default_goal_hours` (MET-04's denominator, module doc #3).
 */
export interface WeeklyDigestStudentEntry {
  studentId: string;
  displayName: string;
  teamName: string;
  confirmedHours: number;
  defaultGoalHours: number;
  goalHoursOverride: number | null;
  /** Every attendance record for this ONE student within the digest's
   * "last week" window (module doc #4) -- never another student's rows. */
  lastWeekAttendance: readonly WeeklyDigestAttendanceEntry[];
  /** Every scheduled meeting/outreach/competition session in this ONE
   * student's own team scope within the digest's "next week" window. */
  nextWeekSchedule: readonly WeeklyDigestScheduleEntry[];
}

/**
 * Top-level props for one parent's weekly digest email (EML-05, module doc
 * #2). `students` MUST already be scoped, by the caller, to exactly this
 * parent's own `guardian_links` rows -- this file has no roster-loading
 * code path of its own that could silently broaden that scope.
 */
export interface WeeklyDigestParams {
  parentDisplayName: string;
  /** The instant this digest is (or would be) sent -- EML-02's Sunday 5pm
   * CT schedule. Used only to compute the week-boundary date ranges shown
   * in the copy (module doc #4); never used to filter `students`. */
  sendInstant: Date;
  students: readonly WeeklyDigestStudentEntry[];
}

// ---------------------------------------------------------------------------
// Pure hours-vs-goal helpers -- module doc #3. Same shape as
// `ParentHome.tsx`'s `studentGoalHours`/`hoursVsGoalPercent`/`round1`
// (Forbidden File/read-only reference only here, independently
// reimplemented, not imported).
// ---------------------------------------------------------------------------

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

/** MET-04's denominator: `goal_hours_override ?? default_goal_hours`. */
export function studentGoalHours(
  student: { goalHoursOverride: number | null },
  defaultGoalHours: number,
): number {
  return student.goalHoursOverride ?? defaultGoalHours;
}

/** UI-side percent math, no metric-view equivalent to duplicate. */
export function hoursVsGoalPercent(confirmedHours: number, goalHours: number): number {
  if (goalHours <= 0) return 0;
  return Math.min(100, round1((confirmedHours / goalHours) * 100));
}

// ---------------------------------------------------------------------------
// Milestone framing -- module doc #5. Same `[25, 50, 75, 100]` idiom as
// `OutreachList.tsx`'s `GOAL_MILESTONES`/`crossedMilestones` (Forbidden
// File/read-only reference only here, independently reimplemented).
// ---------------------------------------------------------------------------

export const GOAL_MILESTONES = [25, 50, 75, 100] as const;
export type GoalMilestone = (typeof GOAL_MILESTONES)[number];

/** Every milestone at or below the current CONFIRMED-hours percent
 * (module doc #5) -- planned/scheduled hours never contribute. */
export function crossedMilestones(percent: number): GoalMilestone[] {
  return GOAL_MILESTONES.filter((milestone) => percent >= milestone);
}

/** The single highest milestone reached, or `null` below 25%. */
export function highestMilestoneReached(percent: number): GoalMilestone | null {
  const crossed = crossedMilestones(percent);
  return crossed.length === 0 ? null : crossed[crossed.length - 1];
}

// ---------------------------------------------------------------------------
// Week-boundary date math -- module doc #4.
// ---------------------------------------------------------------------------

const CHICAGO_TIME_ZONE = 'America/Chicago';

const CHICAGO_DATE_ONLY_FORMATTER = new Intl.DateTimeFormat('en-CA', {
  timeZone: CHICAGO_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

const MONTH_DAY_FORMATTER = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  timeZone: CHICAGO_TIME_ZONE,
});

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

/** `instant` (a real timestamptz) -> its own calendar date, as observed in
 * America/Chicago, 'YYYY-MM-DD'. `en-CA` locale formats as YYYY-MM-DD
 * directly, avoiding manual part-reassembly. */
function formatDateOnlyInChicago(instant: Date): string {
  return CHICAGO_DATE_ONLY_FORMATTER.format(instant);
}

/** 'YYYY-MM-DD' -> a real calendar date, parsed at noon UTC to avoid a
 * local-timezone day-shift (same idiom `ParentHome.tsx`'s own
 * `parseDateOnly` already established, independently reimplemented). */
function parseDateOnly(isoDate: string): Date {
  const [year, month, day] = isoDate.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day, 12));
}

function addDaysDateOnly(isoDate: string, days: number): string {
  const parsed = parseDateOnly(isoDate);
  parsed.setUTCDate(parsed.getUTCDate() + days);
  return parsed.toISOString().slice(0, 10);
}

export interface WeeklyDigestWeekBoundaries {
  lastWeekStart: string;
  lastWeekEnd: string;
  nextWeekStart: string;
  nextWeekEnd: string;
}

/**
 * Sun-Sat calendar week aligned to the Sunday 5pm CT send time (module doc
 * #4) -- NOT a trailing 7-days-from-send window. `sendInstant`'s own
 * America/Chicago calendar date is treated as `nextWeekStart`; the 7 days
 * immediately before that are `lastWeekStart`..`lastWeekEnd`.
 */
export function computeWeeklyDigestWeekBoundaries(sendInstant: Date): WeeklyDigestWeekBoundaries {
  const nextWeekStart = formatDateOnlyInChicago(sendInstant);
  return {
    lastWeekStart: addDaysDateOnly(nextWeekStart, -7),
    lastWeekEnd: addDaysDateOnly(nextWeekStart, -1),
    nextWeekStart,
    nextWeekEnd: addDaysDateOnly(nextWeekStart, 6),
  };
}

function formatDateOnly(isoDate: string): string {
  return MONTH_DAY_FORMATTER.format(parseDateOnly(isoDate));
}

function formatWeekRange(startIsoDate: string, endIsoDate: string): string {
  return `${formatDateOnly(startIsoDate)} – ${formatDateOnly(endIsoDate)}`;
}

function formatSessionDateOnly(row: { sessionDate: string }): string {
  return WEEKDAY_DATE_FORMATTER.format(parseDateOnly(row.sessionDate));
}

function formatSessionDateTime(row: {
  sessionDate: string;
  startsAt: string;
  endsAt: string;
}): string {
  const startText = CLOCK_TIME_FORMATTER.format(new Date(row.startsAt));
  const endText = CLOCK_TIME_FORMATTER.format(new Date(row.endsAt));
  return `${formatSessionDateOnly(row)} · ${startText}–${endText}`;
}

// ---------------------------------------------------------------------------
// HTML string helpers -- same trusted-content-owns-its-own-escaping posture
// as `renderEmailLayout.ts`/`inviteFixtureBody.ts` (this file owns escaping
// every dynamic value it interpolates into `bodyHtml` before handing that
// string to `renderEmailLayout`, which does not re-escape it).
// ---------------------------------------------------------------------------

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const ATTENDANCE_STATUS_LABELS: Record<AttendanceStatus, string> = {
  present: 'Present',
  late: 'Late',
  excused: 'Excused',
  absent: 'Absent',
};

function buildAttendanceListHtml(entries: readonly WeeklyDigestAttendanceEntry[]): string {
  if (entries.length === 0) {
    return `<p style="margin:0 0 4px; color:#6b6480; font-size:14px;">No sessions last week.</p>`;
  }
  const rows = entries
    .map(
      (row) =>
        `<li style="margin:0 0 4px;">${escapeHtml(row.eventTitle)} (${formatSessionDateOnly(row)}) — ${escapeHtml(ATTENDANCE_STATUS_LABELS[row.status])}</li>`,
    )
    .join('');
  return `<ul style="margin:0 0 4px; padding-left:20px; font-size:14px;">${rows}</ul>`;
}

function buildScheduleListHtml(entries: readonly WeeklyDigestScheduleEntry[]): string {
  if (entries.length === 0) {
    return `<p style="margin:0; color:#6b6480; font-size:14px;">Nothing scheduled next week.</p>`;
  }
  const rows = entries
    .map(
      (row) =>
        `<li style="margin:0 0 4px;">${escapeHtml(row.eventTitle)} — ${formatSessionDateTime(row)}</li>`,
    )
    .join('');
  return `<ul style="margin:0; padding-left:20px; font-size:14px;">${rows}</ul>`;
}

/** One student's digest section (module docs #2/#3/#4/#5). */
function buildStudentSectionHtml(
  entry: WeeklyDigestStudentEntry,
  boundaries: WeeklyDigestWeekBoundaries,
): string {
  const goalHours = studentGoalHours(entry, entry.defaultGoalHours);
  const percent = hoursVsGoalPercent(entry.confirmedHours, goalHours);
  const milestone = highestMilestoneReached(percent);
  const milestoneHtml =
    milestone === null
      ? ''
      : `<p style="margin:0 0 12px; font-size:13px; color:${ACCENT_LIGHT};">Reached the ${milestone}% milestone toward this season's goal.</p>`;

  return `
    <div style="margin:0 0 24px; padding:16px; border:1px solid #eae7f5; border-radius:8px;">
      <h2 style="margin:0 0 4px; font-size:17px; color:#1c1830;">${escapeHtml(entry.displayName)}<span style="font-weight:400; color:#6b6480; font-size:13px;"> · ${escapeHtml(entry.teamName)}</span></h2>
      <p style="margin:0 0 4px; font-size:14px;"><strong>${entry.confirmedHours} / ${goalHours} h</strong> toward this season's goal (${percent}%)</p>
      ${milestoneHtml}
      <p style="margin:0 0 4px; font-size:13px; font-weight:600; color:#1c1830;">Last week's attendance (${formatWeekRange(boundaries.lastWeekStart, boundaries.lastWeekEnd)})</p>
      ${buildAttendanceListHtml(entry.lastWeekAttendance)}
      <p style="margin:12px 0 4px; font-size:13px; font-weight:600; color:#1c1830;">Next week's schedule (${formatWeekRange(boundaries.nextWeekStart, boundaries.nextWeekEnd)})</p>
      ${buildScheduleListHtml(entry.nextWeekSchedule)}
    </div>`;
}

/**
 * Builds the trusted `bodyHtml` for one parent's weekly digest -- EML-05
 * (module doc #2): iterates ONLY over `params.students`, the caller-scoped
 * array, never any other data source.
 */
export function buildWeeklyDigestBodyHtml(params: WeeklyDigestParams): string {
  const boundaries = computeWeeklyDigestWeekBoundaries(params.sendInstant);
  const sections = params.students
    .map((student) => buildStudentSectionHtml(student, boundaries))
    .join('');

  return `
    <p style="margin:0 0 16px;">Hi ${escapeHtml(params.parentDisplayName)}, here's your weekly VOLT Robotics digest.</p>
    ${sections}
    <p style="margin:16px 0 0; color:#6b6480; font-size:13px;">You're receiving this because you're linked as a parent/guardian in the VOLT Robotics team portal.</p>
  `;
}

/** Preview-pane text (module doc #1) -- plain text, escaped by
 * `renderEmailLayout` itself, not pre-escaped here. */
export function buildWeeklyDigestPreviewText(params: WeeklyDigestParams): string {
  const boundaries = computeWeeklyDigestWeekBoundaries(params.sendInstant);
  return `Your weekly VOLT digest: hours, attendance (${formatWeekRange(boundaries.lastWeekStart, boundaries.lastWeekEnd)}), and next week's schedule.`;
}

/**
 * Full, standalone HTML document for one parent's weekly digest, wrapped in
 * the shared EML-01 branded layout (T048's `renderEmailLayout`). This is
 * the ONLY function in this file that touches `renderEmailLayout` -- the
 * eventual Resend `html` send field value (T051's job to actually send).
 */
export function renderWeeklyDigestEmail(params: WeeklyDigestParams): string {
  return renderEmailLayout({
    previewText: buildWeeklyDigestPreviewText(params),
    bodyHtml: buildWeeklyDigestBodyHtml(params),
  });
}

// Re-exported so a future send-reminders wiring (T051) has a single import
// surface for both the shared sender address and this template, matching
// the same re-export convenience `constants.ts` already documents for
// T049/T050/T051.
export { SENDER_ADDRESS, MANAGE_PREFERENCES_URL };
