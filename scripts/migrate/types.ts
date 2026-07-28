// T062 (MIG-03): shared type definitions for the old-project read shapes,
// new-project write shapes, and the migration report. Pure types only --
// no I/O, no secrets, nothing environment-specific lives in this file.
//
// Old-schema shapes are transcribed from docs/migration/source-schema.md
// (itself a transcription of PRD Section 10.1). New-schema shapes are
// transcribed from the actual applied migrations:
//   supabase/migrations/20260716000000_identity_roster.sql
//   supabase/migrations/20260717000000_scheduling_attendance.sql
// (read directly, not guessed -- see worker report for the row-by-row
// cross-check against docs/migration/mapping.md).

// ---------------------------------------------------------------------------
// Old project (read-only source) row shapes
// ---------------------------------------------------------------------------

export interface OldTeam {
  id: string;
  name: string;
  short_name: string;
  color: string;
  archived: boolean;
  sort_order: number;
}

export interface OldStudent {
  id: string;
  name: string;
  team_affiliation: string | null;
  active: boolean;
  goal_hours: number | null;
}

export type OldEventCategory = 'outreach' | 'meeting' | 'competition';
export type OldEventStatus = 'planned' | 'completed';

export interface OldEvent {
  id: string;
  name: string;
  location: string | null;
  notes: string | null;
  category: OldEventCategory;
  adult_volunteers_count: number | null;
  adult_volunteer_hours: number | null;
  status: OldEventStatus;
  // Dropped per mapping.md (sessions are authoritative): date, start_time,
  // end_time, is_multi_day, duration_hours. `attendees` is kept below only
  // for the pre-drop backfill assertion (Known Context/Traps #2) -- it is
  // never written to the new project.
  attendees: string[] | null;
}

export interface OldEventSession {
  id: string;
  event_id: string;
  date: string; // proper SQL `date` column (not free text) -- "YYYY-MM-DD"
  start_time: string | null; // free text, may be unparseable
  end_time: string | null; // free text, may be unparseable
}

export interface OldSessionAttendance {
  id: string;
  session_id: string;
  student_id: string;
  hours: number;
  planned: boolean; // true = expected/RSVP, false = confirmed actual
}

export interface OldAppSettings {
  season_goal: number;
}

// ---------------------------------------------------------------------------
// New project (write target) row shapes -- only the columns this ETL sets.
// ---------------------------------------------------------------------------

export interface NewTeamUpsert {
  // Deliberately no `id` field: teams.name is a genuine natural key (unique
  // in both schemas), so the id is left for the database to assign on
  // first insert and never touched on update -- see scripts/migrate/dataSink.ts
  // and the worker report's "Natural-key / upsert strategy" section for why
  // (setting id explicitly on an ON CONFLICT (name) DO UPDATE would risk
  // rewriting an existing team's primary key out from under its FK
  // references).
  name: string;
  short_name: string;
  program: null;
  color: string;
  archived: boolean;
  sort_order: number;
}

export interface NewSeasonUpsert {
  name: string;
  starts_on: string;
  ends_on: string;
  default_goal_hours: number;
  is_active: false;
}

export interface NewStudentRow {
  id: string; // deterministic uuidv5 derived from old student id
  profile_id: null;
  display_name: string;
  team_id: string;
  grad_year: null;
  is_active: boolean;
  goal_hours_override: number | null;
}

export type NewEventType = 'meeting' | 'outreach' | 'competition';

export interface NewEventRow {
  id: string; // deterministic uuidv5 derived from old event id
  season_id: string;
  type: NewEventType;
  title: string;
  description: string;
  location_name: string;
  address: string;
  team_ids: null;
  counts_participation: boolean;
  counts_volunteer_hours: boolean;
  adult_volunteers_count: number;
  adult_volunteer_hours: number;
  created_by: null;
}

export type NewSessionStatus = 'scheduled' | 'completed' | 'canceled';

export interface NewEventSessionRow {
  id: string; // deterministic uuidv5 derived from old event_session id
  event_id: string;
  session_date: string;
  starts_at: string;
  ends_at: string;
  status: NewSessionStatus;
  people_reached: null;
  notes: string;
}

export interface NewRsvpRow {
  session_id: string;
  student_id: string;
  status: 'going';
  responded_by: null;
}

export interface NewAttendanceRow {
  session_id: string;
  student_id: string;
  status: 'present';
  check_in_at: null;
  check_out_at: null;
  hours_override: number; // ALWAYS set -- Known Context/Traps #4
  method: 'import';
  recorded_by: null;
}

// ---------------------------------------------------------------------------
// Migration report
// ---------------------------------------------------------------------------

export interface UnmatchedTeamEntry {
  studentOldId: string;
  teamAffiliation: string;
  createdArchivedTeamName: string;
}

export interface UnparseableTimeEntry {
  eventSessionOldId: string;
  field: 'start_time' | 'end_time';
  rawValue: string | null;
}

export interface AttendeesBackfillMismatchEntry {
  eventOldId: string;
  missingStudentId: string;
}

export interface OrphanedAttendanceEntry {
  sessionAttendanceOldId: string;
  reason: 'unknown_session' | 'unknown_student';
}

export interface TableCounts {
  teamsCreated: number;
  teamsExisting: number;
  teamsUnmatchedArchived: number;
  seasonsCreated: number;
  seasonsExisting: number;
  students: number;
  events: number;
  eventSessions: number;
  rsvps: number;
  attendance: number;
}

export interface MigrationReport {
  dryRun: boolean;
  cutoverDate: string;
  counts: TableCounts;
  unmatchedTeams: UnmatchedTeamEntry[];
  unparseableTimes: UnparseableTimeEntry[];
  attendeesBackfillMismatches: AttendeesBackfillMismatchEntry[];
  orphanedAttendanceRows: OrphanedAttendanceEntry[];
}

export interface MigrationOptions {
  dryRun: boolean;
  cutoverDate: string; // "YYYY-MM-DD", America/Chicago wall-clock date
  timeZone: string; // always 'America/Chicago' per mapping.md; kept
  // as an option only so tests can assert the value is actually used,
  // not hardcoded deep in the parsing logic.
}

// Result of a batch upsert against the new project (or the in-memory
// fixture sink) -- used to build accurate per-table counts in both
// dry-run (would-write) and real-run (actually written) modes.
export interface UpsertResult {
  createdCount: number;
  updatedCount: number;
}
