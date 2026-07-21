/**
 * T059: RPT-05/06 CSV exports, Epic E9 -- pure, client-generated CSV
 * builders for `roster.csv`, `events.csv`, `attendance.csv`, and
 * `hours_by_student.csv`.
 *
 * -----------------------------------------------------------------------
 * 1. Scope boundary -- pure transform layer, ZERO data-fetching (worker
 *    packet Known Context/Traps #1 / Forbidden Files).
 *
 * Every export below is a plain, synchronous `(rows) => string` function.
 * This file contains no `async`, no `fetch`, no Supabase import of any
 * kind (grep-provable: zero `supabase`/`createClient` references anywhere
 * below) -- the QUERIES that produce each function's input rows live in
 * each report tab's own `loadData` seam (`ParticipationTab.tsx`,
 * `HoursTab.tsx`, `EventsTab.tsx`, `StudentsTab.tsx`, all forbidden/
 * read-only reference here), never duplicated here. This is a deliberate
 * design choice (not an oversight): a shared Supabase client does not
 * exist anywhere in `src/` yet (the same gap every sibling report task in
 * this batch has independently disclosed), so this file is designed to
 * work identically today (fed hand-built fixture rows, see the test file)
 * and once that client lands (fed real query results) without needing to
 * change at all.
 *
 * This file also does NOT build the `Button variant="secondary"`-per-tab
 * UI trigger or wire a download button into `ReportsShell.tsx`/
 * `ParticipationTab.tsx`/`HoursTab.tsx`/`EventsTab.tsx` (all forbidden
 * files here, read-only reference only) -- it builds the pure
 * CSV-generation functions a future wiring task will call from each tab's
 * own export button (e.g. via a `Blob`/`URL.createObjectURL` download,
 * standard browser-side CSV-download idiom, not implemented here since it
 * requires touching those forbidden files' render trees).
 *
 * -----------------------------------------------------------------------
 * 2. Each of the four row shapes below is independently re-derived (not
 *    imported -- every sibling file is forbidden/read-only here) to match
 *    that sibling's own established column semantics exactly, per the
 *    worker packet's "same report queries" instruction and Ground Truth
 *    section. Which sibling shape each export mirrors:
 *
 *   - `buildRosterCsv` / `RosterCsvRow` mirrors `StudentsTab.tsx`'s
 *     (T022) `StudentDisplayRow`: student name, team, grad year, active
 *     status, goal hours override. `StudentsTab.tsx`'s own column is
 *     literally labeled "Goal override" and renders the RAW
 *     `students.goal_hours_override` value ("—"/blank for `null`), never
 *     resolved against a season's `default_goal_hours` -- that resolution
 *     is `HoursTab.tsx`'s job (module doc #4 below), not this roster
 *     export's. `RosterCsvRow.goalHoursOverride` mirrors that same raw,
 *     unresolved column, not a computed effective goal.
 *     `StudentDisplayRow.accountStatus` (Active/Invited/No account -- a
 *     profile/invite-derived UI concept) is deliberately NOT included:
 *     the packet's own Ground Truth text for `roster.csv` lists exactly
 *     "name, team, grad year, active status, goal hours" (five fields,
 *     `isActive`, not `accountStatus`) -- a disclosed, literal reading of
 *     that column list, not an oversight.
 *   - `buildEventsCsv` / `EventsCsvRow` mirrors `EventsTab.tsx`'s (T058)
 *     `EventSessionDisplayRow`: one row per SESSION (not per event, same
 *     grain `EventsTab.tsx`'s own module doc #1 establishes), type, date,
 *     attendance counts (present/late/excused/absent), signup counts
 *     (going/maybe/declined, blank for meeting rows -- `EventsTab.tsx`'s
 *     own "not applicable, never a fabricated 0" convention, module doc
 *     #3), hours awarded, people reached, adult volunteers (count + hours,
 *     repeated per session of the same event, same disclosed repetition
 *     choice `EventsTab.tsx`'s own module doc #5 already made and this
 *     export's header explicitly labels "(per event)" for the identical
 *     reason), and status.
 *   - `buildAttendanceCsv` / `AttendanceCsvRow` is a NEW shape (no prior
 *     task built it) sourced directly from the real `attendance` table
 *     columns (`supabase/migrations/20260717000000_scheduling_attendance.sql`
 *     lines 79-91: `session_id`, `student_id`, `status`, `check_in_at`,
 *     `check_out_at`, `hours_override`, `method`) -- one row per
 *     student-per-session attendance record, with `studentName`/
 *     `teamName`/`eventTitle`/`sessionDate` added for human readability
 *     (a CSV of bare UUIDs would be useless to a coach opening it in
 *     Excel), the same "display-only fields added for readability, not
 *     invented business data" precedent `ParticipationTab.tsx`'s own
 *     `studentName`/`teamName` fields already established.
 *   - `buildHoursByStudentCsv` / `HoursByStudentCsvRow` mirrors
 *     `HoursTab.tsx`'s (T057) per-student `HoursTableRow` fields
 *     (`confirmedHours`, `plannedHours`, `goalHours`, `percentToGoal`) --
 *     see module doc #4 for why this file never recomputes any of them.
 *
 * -----------------------------------------------------------------------
 * 3. Constitution item 3 -- confirmed/planned hours and % to goal in
 *    `hours_by_student.csv` are NEVER recomputed here, same discipline as
 *    T057/T058.
 *
 * `HoursByStudentCsvRow.confirmedHours` / `.plannedHours` / `.goalHours` /
 * `.percentToGoal` are typed as plain, ALREADY-COMPUTED input numbers --
 * exactly the same "already-loaded row data" contract every other export
 * in this file has (module doc #1). `buildHoursByStudentCsv` performs
 * ZERO arithmetic on any of them (grep-provable: no `/`, no `resolveGoal`,
 * no `hoursVsGoal`-shaped expression anywhere in this file) -- it only
 * formats each already-computed number to one decimal place (the same
 * precision `HoursTab.tsx`'s own `renderHoursCell`/`round1` convention
 * already uses) and writes it to a CSV field. The real caller (the future
 * export-button wiring task, per module doc #1) is expected to feed this
 * function rows built the SAME way `HoursTab.tsx`'s own `buildStudentRows`
 * builds `HoursTableRow`s -- i.e. `confirmedHours` sourced from
 * `v_student_hours` (never recomputed from raw `attendance`), `goalHours`
 * from `resolveGoalHours(goalHoursOverride, defaultGoalHours)`, and
 * `percentToGoal` from `hoursVsGoalPercent(confirmedHours, goalHours)` --
 * `HoursTab.tsx` is forbidden/read-only here so those two functions are
 * NOT imported (and NOT reimplemented in this file, since this file never
 * needs to call them: it only formats numbers a caller already computed).
 * See this task's worker output for a real cross-check of
 * `buildHoursByStudentCsv`'s formatted output against `HoursTab.tsx`'s own
 * documented fixture numbers.
 *
 * -----------------------------------------------------------------------
 * 4. RFC 4180 CSV escaping and formatting decisions (worker packet Known
 *    Context/Traps #2 -- "the actual craft of this task").
 *
 *   - Any field value containing a comma, a double-quote, a `\n`, or a
 *     `\r` is wrapped in double-quotes, with every embedded double-quote
 *     doubled (`escapeCsvField` below) -- the two RFC 4180 rules this task
 *     exists to prove. See the colocated test file for real fixture names
 *     containing BOTH a comma (`"Ortiz, Jr."`, a team name) and a literal
 *     double-quote (`Alex "Ace" Nguyen`, a student name), plus a
 *     newline-containing value, not just happy-path names.
 *   - Line terminator: CRLF (`\r\n`), RFC 4180's own literal specified
 *     terminator (section 2, rule 1: "Each record is located on a
 *     separate line, delimited by a line break (CRLF)"), including after
 *     the final data row (a common, broadly-compatible convention --
 *     Excel/Numbers/Google Sheets all accept a trailing CRLF without
 *     producing a spurious blank row).
 *   - UTF-8 BOM: INCLUDED, prefixed to every generated CSV string
 *     (`UTF8_BOM = '\uFEFF'`, `buildCsv` below). RPT-05's own PRD text
 *     explicitly flags this ("UTF-8, header row, ISO dates... UTF-8 BOM
 *     if needed"). DECISION: needed, so included unconditionally --
 *     Excel on Windows (the realistic primary consumer of a coach-facing
 *     "export to CSV" report button) auto-detects a file's encoding by
 *     sniffing its leading bytes and, without a BOM, will frequently
 *     misinterpret a plain UTF-8 CSV as the system's legacy ANSI code
 *     page, corrupting any non-ASCII character (e.g. an accented name).
 *     A BOM costs nothing for well-behaved UTF-8 CSV parsers (RFC 4180
 *     itself is silent on BOMs; every mainstream consumer -- Excel,
 *     Google Sheets, Numbers, Python's `csv` module via `utf-8-sig`,
 *     Node's own `TextDecoder`) either strips a leading BOM transparently
 *     or ignores it, so unconditionally including it is the safer default
 *     for a downloadable report file whose primary reader is a
 *     non-technical coach opening it in spreadsheet software, not a
 *     machine-to-machine pipe with a hand-rolled naive line-splitter.
 *   - Dates: ISO 8601 throughout, PASSED THROUGH VERBATIM from each input
 *     row's already-ISO string field -- this file never reformats a date
 *     into a locale string (no `toLocaleDateString`/`Intl.DateTimeFormat`
 *     anywhere below, unlike `EventsTab.tsx`'s own display-only
 *     `formatSessionDate`, which exists for on-screen human rendering and
 *     is intentionally NOT mirrored here). Date-only fields
 *     (`RosterCsvRow` has none; `EventsCsvRow.sessionDate`,
 *     `AttendanceCsvRow.sessionDate`) are `YYYY-MM-DD` strings, matching
 *     `event_sessions.session_date`'s own real column type (a plain SQL
 *     `date`, no time component). Datetime fields
 *     (`AttendanceCsvRow.checkInAt`/`.checkOutAt`) are full ISO 8601 UTC
 *     timestamps (or blank for `null`), matching `attendance.check_in_at`/
 *     `.check_out_at`'s own real `timestamptz` column type -- never
 *     converted to `America/Chicago` local time here (NFR-09's timezone
 *     rendering is a UI-display concern for on-screen tables; a CSV export
 *     column keeps the unambiguous stored UTC instant, the more correct
 *     choice for a file that may be re-imported or machine-processed
 *     downstream, where a silently-tz-shifted timestamp would be a real
 *     correctness hazard).
 *   - Numeric fields (hours, counts, percentages) are written as PLAIN
 *     numbers (`45.5`, not `45.5h`; `56.9`, not `56.9%`) -- deliberately
 *     NOT reusing the on-screen unit-suffixed display strings
 *     `HoursTab.tsx`/`EventsTab.tsx` render (`${value.toFixed(1)}`+`"h"`,
 *     `${percentToGoal}%`), because a unit suffix baked into a CSV cell
 *     defeats spreadsheet software's ability to sum/average/sort that
 *     column as a number. Hours fields are still rounded to one decimal
 *     place (matching `HoursTab.tsx`'s own `round1`/`toFixed(1)`
 *     precision convention, module doc #3) so the exported figure never
 *     silently differs in precision from what the on-screen report shows
 *     for the identical underlying number.
 *   - Not-applicable / not-yet-determined values (`null` fields -- e.g. a
 *     meeting session's `signups`, a not-yet-completed session's
 *     `hoursAwarded`, a student with no `v_student_hours` row handled
 *     upstream) render as an EMPTY CSV field (`''`), not the "—" (em dash)
 *     glyph `ParticipationTab.tsx`/`EventsTab.tsx` use on-screen. Disclosed
 *     judgment call: "—" is a UI-only convention for a rendered table cell
 *     a human reads directly; a machine-oriented CSV file (RPT-05's own
 *     "client-generated CSV" framing) should leave a numeric/date column
 *     genuinely blank so spreadsheet software treats it as empty (not a
 *     stray text value that would break a `SUM()`/date-parse over that
 *     column), the more conservative, more broadly interoperable choice
 *     for an exported data file.
 *
 * -----------------------------------------------------------------------
 * 5. Constitution item 13 -- no box-drawing/bracket characters in any
 *    header/label text. Deliberate sweep, disclosed per the worker packet
 *    Known Context/Traps #5: every header string below is plain ASCII
 *    (grep-provable -- no `—`/`│`/`┌`/`[`/`]`/similar glyph anywhere in
 *    this file's header arrays); the "not applicable" convention for CSV
 *    cells is an EMPTY STRING (module doc #4's last bullet), not even the
 *    em dash `ParticipationTab.tsx`/`EventsTab.tsx` use on-screen, so this
 *    file uses strictly fewer non-ASCII glyphs than its sibling UI files,
 *    not more.
 *
 * -----------------------------------------------------------------------
 * 6. Old-app CSV-consumer column parity (RPT-05's own "parity requirement:
 *    old app's CSV consumers keep working (columns superset of old ones --
 *    verified during migration)") is EXPLICITLY DEFERRED to T063/MIG-04, a
 *    human-gated migration-verification task, per worker packet Known
 *    Context/Traps #3. No old-system CSV sample or live old-project access
 *    exists anywhere in this task's scope (same "External Blocker" class
 *    the packet cites for T061's MIG-01 schema verification) -- this file
 *    builds a sensible, complete column set from the REAL current schema
 *    (module doc #2's citations above) and does not fabricate a guess at
 *    what the old app's exact column names were. A future MIG-04 pass, once
 *    a real old-app CSV sample exists, may require adding columns here to
 *    achieve the literal "superset of old ones" parity RPT-05 names --
 *    NOT resolved in this task.
 */

// ---------------------------------------------------------------------------
// Generic RFC 4180 CSV primitives -- module doc #4.
// ---------------------------------------------------------------------------

const CRLF = '\r\n';
const UTF8_BOM = '\uFEFF';

/**
 * RFC 4180 escaping: wrap in double-quotes and double any embedded
 * double-quote whenever the raw field value contains a comma, a
 * double-quote, or a line break (`\n`/`\r`). Otherwise returned verbatim.
 */
export function escapeCsvField(raw: string): string {
  if (raw.includes('"') || raw.includes(',') || raw.includes('\n') || raw.includes('\r')) {
    return `"${raw.replace(/"/g, '""')}"`;
  }
  return raw;
}

function formatCsvRecord(fields: readonly string[]): string {
  return fields.map(escapeCsvField).join(',');
}

/**
 * Builds a full CSV document: UTF-8 BOM (module doc #4) + header record +
 * one record per data row, every record CRLF-terminated (module doc #4).
 */
export function buildCsv(headers: readonly string[], rows: readonly (readonly string[])[]): string {
  const records = [formatCsvRecord(headers), ...rows.map((row) => formatCsvRecord(row))];
  return UTF8_BOM + records.map((record) => record + CRLF).join('');
}

// ---------------------------------------------------------------------------
// Shared field formatters -- module doc #4.
// ---------------------------------------------------------------------------

/** One-decimal numeric field (matches `HoursTab.tsx`'s own `round1`/
 * `toFixed(1)` precision convention, module doc #3/#4), never unit-suffixed. */
function hoursField(value: number): string {
  return value.toFixed(1);
}

/** Plain integer/count field, never unit-suffixed. */
function countField(value: number): string {
  return String(value);
}

/** `null` = not-yet-determined / not-applicable -> empty CSV field (module
 * doc #4's last bullet), never the on-screen "—" glyph. */
function nullableHoursField(value: number | null): string {
  return value === null ? '' : value.toFixed(1);
}

function nullableCountField(value: number | null): string {
  return value === null ? '' : String(value);
}

/** ISO date/datetime fields are passed through verbatim (module doc #4) --
 * `null` renders as an empty field. */
function nullableIsoField(value: string | null): string {
  return value ?? '';
}

function booleanField(value: boolean, trueLabel: string, falseLabel: string): string {
  return value ? trueLabel : falseLabel;
}

// ---------------------------------------------------------------------------
// roster.csv -- mirrors `StudentsTab.tsx`'s `StudentDisplayRow` (module
// doc #2).
// ---------------------------------------------------------------------------

export interface RosterCsvRow {
  studentId: string;
  name: string;
  teamName: string;
  gradYear: number | null;
  isActive: boolean;
  /** Raw `students.goal_hours_override` -- mirrors `StudentsTab.tsx`'s own
   * unresolved "Goal override" column, module doc #2. */
  goalHoursOverride: number | null;
}

const ROSTER_CSV_HEADERS = [
  'Student ID',
  'Name',
  'Team',
  'Grad Year',
  'Active',
  'Goal Hours Override',
] as const;

export function buildRosterCsv(rows: readonly RosterCsvRow[]): string {
  const records = rows.map((row) => [
    row.studentId,
    row.name,
    row.teamName,
    nullableCountField(row.gradYear),
    booleanField(row.isActive, 'Active', 'Inactive'),
    nullableCountField(row.goalHoursOverride),
  ]);
  return buildCsv(ROSTER_CSV_HEADERS, records);
}

// ---------------------------------------------------------------------------
// events.csv -- mirrors `EventsTab.tsx`'s `EventSessionDisplayRow`, one row
// per SESSION (module doc #2).
// ---------------------------------------------------------------------------

export type EventsCsvSessionType = 'meeting' | 'outreach' | 'competition';
export type EventsCsvSessionStatus = 'scheduled' | 'completed' | 'canceled';

export interface EventsCsvRow {
  sessionId: string;
  eventTitle: string;
  type: EventsCsvSessionType;
  /** `event_sessions.session_date` -- ISO date-only (`YYYY-MM-DD`), module
   * doc #4. */
  sessionDate: string;
  status: EventsCsvSessionStatus;
  presentCt: number;
  lateCt: number;
  excusedCt: number;
  absentCt: number;
  /** `null` for every meeting-type row -- not applicable, same convention
   * `EventsTab.tsx`'s own `signups` field uses (module doc #2). */
  signupsGoingCt: number | null;
  signupsMaybeCt: number | null;
  signupsDeclinedCt: number | null;
  /** `null` = session not yet completed (not-yet-determined); a real `0` is
   * a genuine zero (module doc #3/#4 of `EventsTab.tsx`, not re-derived
   * here -- this field is already-computed input, per module doc #1). */
  hoursAwarded: number | null;
  peopleReached: number | null;
  /** Per-EVENT figures, repeated on every session row of that event (module
   * doc #2). */
  adultVolunteersCount: number;
  adultVolunteerHours: number;
}

const EVENTS_CSV_HEADERS = [
  'Session ID',
  'Type',
  'Session Date',
  'Session',
  'Status',
  'Present',
  'Late',
  'Excused',
  'Absent',
  'Signups Going',
  'Signups Maybe',
  'Signups Declined',
  'Hours Awarded',
  'People Reached',
  'Adult Volunteers Count (per event)',
  'Adult Volunteer Hours (per event)',
] as const;

export function buildEventsCsv(rows: readonly EventsCsvRow[]): string {
  const records = rows.map((row) => [
    row.sessionId,
    row.type,
    row.sessionDate,
    row.eventTitle,
    row.status,
    countField(row.presentCt),
    countField(row.lateCt),
    countField(row.excusedCt),
    countField(row.absentCt),
    nullableCountField(row.signupsGoingCt),
    nullableCountField(row.signupsMaybeCt),
    nullableCountField(row.signupsDeclinedCt),
    nullableHoursField(row.hoursAwarded),
    nullableCountField(row.peopleReached),
    countField(row.adultVolunteersCount),
    hoursField(row.adultVolunteerHours),
  ]);
  return buildCsv(EVENTS_CSV_HEADERS, records);
}

// ---------------------------------------------------------------------------
// attendance.csv -- new shape, sourced from the real `attendance` table
// columns (module doc #2).
// ---------------------------------------------------------------------------

export type AttendanceCsvStatus = 'present' | 'late' | 'excused' | 'absent';
export type AttendanceCsvMethod = 'qr' | 'coach' | 'import';

export interface AttendanceCsvRow {
  studentId: string;
  studentName: string;
  teamName: string;
  sessionId: string;
  /** Display-only, for readability -- module doc #2. */
  eventTitle: string;
  /** `event_sessions.session_date` -- ISO date-only, module doc #4. */
  sessionDate: string;
  status: AttendanceCsvStatus;
  /** `attendance.check_in_at` -- ISO 8601 UTC timestamp, `null` if not
   * recorded (module doc #4). */
  checkInAt: string | null;
  /** `attendance.check_out_at` -- ISO 8601 UTC timestamp, `null` if not
   * recorded. */
  checkOutAt: string | null;
  /** `attendance.hours_override` -- `null` if not set. */
  hoursOverride: number | null;
  method: AttendanceCsvMethod;
}

const ATTENDANCE_CSV_HEADERS = [
  'Student ID',
  'Student Name',
  'Team',
  'Session ID',
  'Session',
  'Session Date',
  'Status',
  'Check-in At',
  'Check-out At',
  'Hours Override',
  'Method',
] as const;

export function buildAttendanceCsv(rows: readonly AttendanceCsvRow[]): string {
  const records = rows.map((row) => [
    row.studentId,
    row.studentName,
    row.teamName,
    row.sessionId,
    row.eventTitle,
    row.sessionDate,
    row.status,
    nullableIsoField(row.checkInAt),
    nullableIsoField(row.checkOutAt),
    nullableHoursField(row.hoursOverride),
    row.method,
  ]);
  return buildCsv(ATTENDANCE_CSV_HEADERS, records);
}

// ---------------------------------------------------------------------------
// hours_by_student.csv -- mirrors `HoursTab.tsx`'s per-student
// `HoursTableRow` fields, never recomputed here (module doc #2/#3).
// ---------------------------------------------------------------------------

export interface HoursByStudentCsvRow {
  studentId: string;
  studentName: string;
  teamName: string;
  /** Already-computed input, sourced (by the caller) from `v_student_hours`
   * -- never recomputed in this file (module doc #3). */
  confirmedHours: number;
  /** Already-computed input, sourced (by the caller) the same way
   * `HoursTab.tsx`'s own `computeStudentPlannedHours` does -- never
   * recomputed in this file (module doc #3). */
  plannedHours: number;
  /** Already-computed input -- `resolveGoalHours(goalHoursOverride,
   * defaultGoalHours)`, computed by the caller (module doc #3). */
  goalHours: number;
  /** Already-computed input -- `hoursVsGoalPercent(confirmedHours,
   * goalHours)`, computed by the caller (module doc #3). */
  percentToGoal: number;
}

const HOURS_BY_STUDENT_CSV_HEADERS = [
  'Student ID',
  'Student Name',
  'Team',
  'Confirmed Hours',
  'Planned Hours',
  'Goal Hours',
  'Percent to Goal',
] as const;

export function buildHoursByStudentCsv(rows: readonly HoursByStudentCsvRow[]): string {
  const records = rows.map((row) => [
    row.studentId,
    row.studentName,
    row.teamName,
    hoursField(row.confirmedHours),
    hoursField(row.plannedHours),
    hoursField(row.goalHours),
    String(row.percentToGoal),
  ]);
  return buildCsv(HOURS_BY_STUDENT_CSV_HEADERS, records);
}

// ---------------------------------------------------------------------------
// Filename constants -- RPT-05's own literal filenames, exported as a
// convenience for the future export-button wiring task (module doc #1).
// ---------------------------------------------------------------------------

export const ROSTER_CSV_FILENAME = 'roster.csv';
export const EVENTS_CSV_FILENAME = 'events.csv';
export const ATTENDANCE_CSV_FILENAME = 'attendance.csv';
export const HOURS_BY_STUDENT_CSV_FILENAME = 'hours_by_student.csv';
