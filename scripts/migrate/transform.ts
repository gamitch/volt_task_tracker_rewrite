// T062 (MIG-03): pure transform functions, one per docs/migration/mapping.md
// row. No I/O here -- these are deliberately side-effect-free so the same
// functions run identically whether the script is in --dry-run or a real
// write run (Known Context/Traps #5: only the final write step is gated by
// the flag, not the transform logic itself).

import { deterministicId } from './uuid.ts';
import { parseSessionTimeField, DEFAULT_MIGRATION_TIME_ZONE } from './time.ts';
import type {
  OldEvent,
  OldEventCategory,
  OldEventSession,
  OldSessionAttendance,
  OldStudent,
  OldTeam,
  NewAttendanceRow,
  NewEventRow,
  NewEventSessionRow,
  NewEventType,
  NewRsvpRow,
  NewSessionStatus,
  NewStudentRow,
  NewTeamUpsert,
  UnparseableTimeEntry,
} from './types.ts';

// --- mapping.md row: teams.* -> teams.* (1:1) --------------------------

export function mapTeam(old: OldTeam): NewTeamUpsert {
  return {
    name: old.name,
    short_name: old.short_name,
    program: null, // "left null for George to set later"
    color: old.color,
    archived: old.archived,
    sort_order: old.sort_order,
  };
}

/** An archived placeholder team created for an unmatched team_affiliation
 * value, per mapping.md: "unmatched values create an archived team and
 * appear in the migration report." */
export function mapUnmatchedTeam(teamAffiliation: string): NewTeamUpsert {
  return {
    name: teamAffiliation,
    short_name: teamAffiliation,
    program: null,
    color: '#6b7280', // neutral gray placeholder -- not specified by mapping.md
    archived: true,
    sort_order: 0,
  };
}

// --- mapping.md row: students.* -> students.* ---------------------------

export function mapStudent(old: OldStudent, resolvedTeamId: string): NewStudentRow {
  return {
    id: deterministicId('student', old.id),
    profile_id: null,
    display_name: old.name,
    team_id: resolvedTeamId,
    grad_year: null,
    is_active: old.active,
    goal_hours_override: old.goal_hours ?? null,
  };
}

// --- mapping.md row: app_settings.season_goal -> seasons.default_goal_hours

export const MIGRATION_SEASON_NAME = '2025–2026';

export function buildSeasonUpsert(
  seasonGoal: number,
  minSessionDate: string,
  maxSessionDate: string,
): { name: string; starts_on: string; ends_on: string; default_goal_hours: number; is_active: false } {
  return {
    name: MIGRATION_SEASON_NAME,
    starts_on: minSessionDate,
    ends_on: maxSessionDate,
    default_goal_hours: seasonGoal,
    is_active: false,
  };
}

// --- mapping.md row: events.* -> events.* + CMP-02 per-type defaults ----

const CATEGORY_TO_TYPE: Record<OldEventCategory, NewEventType> = {
  outreach: 'outreach',
  meeting: 'meeting',
  competition: 'competition',
};

/**
 * CMP-02 (PRD 6.5): "default false for competitions, fixed true/false for
 * meetings/outreach respectively." Meetings drive MET-01/02 participation;
 * outreach drives MET-03/04 volunteer hours (the old student_hour_summary
 * view already filters to category='outreach' per PRD 10.1, confirming this
 * split). Competitions default both flags false; an admin may opt a
 * specific competition in later via the UI (out of scope for this ETL).
 */
export function eventTypeMetricDefaults(type: NewEventType): {
  counts_participation: boolean;
  counts_volunteer_hours: boolean;
} {
  switch (type) {
    case 'meeting':
      return { counts_participation: true, counts_volunteer_hours: false };
    case 'outreach':
      return { counts_participation: false, counts_volunteer_hours: true };
    case 'competition':
      return { counts_participation: false, counts_volunteer_hours: false };
  }
}

export function mapEvent(old: OldEvent, seasonId: string): NewEventRow {
  const type = CATEGORY_TO_TYPE[old.category];
  const { counts_participation, counts_volunteer_hours } = eventTypeMetricDefaults(type);
  return {
    id: deterministicId('event', old.id),
    season_id: seasonId,
    type,
    title: old.name,
    description: old.notes ?? '', // mapping note (c): notes -> description
    location_name: old.location ?? '',
    address: '', // no old-schema equivalent; not covered by mapping.md
    team_ids: null, // "all-team scope"
    counts_participation,
    counts_volunteer_hours,
    adult_volunteers_count: old.adult_volunteers_count ?? 0,
    adult_volunteer_hours: old.adult_volunteer_hours ?? 0,
    created_by: null,
  };
}

// --- mapping.md row: event_sessions.date+start/end_time -> starts_at/ends_at

export interface EventSessionTransformResult {
  row: NewEventSessionRow;
  unparseable: UnparseableTimeEntry[];
}

/**
 * `status`: mapping.md -- "'completed' when old event status='completed'
 * AND session date <= cutover date, else 'scheduled'."
 */
function resolveSessionStatus(
  oldEventStatus: OldEvent['status'],
  sessionDate: string,
  cutoverDate: string,
): NewSessionStatus {
  return oldEventStatus === 'completed' && sessionDate <= cutoverDate ? 'completed' : 'scheduled';
}

export function mapEventSession(
  old: OldEventSession,
  newEventId: string,
  parentEventStatus: OldEvent['status'],
  cutoverDate: string,
  timeZone: string = DEFAULT_MIGRATION_TIME_ZONE,
): EventSessionTransformResult {
  const unparseable: UnparseableTimeEntry[] = [];

  const start = parseSessionTimeField(old.date, old.start_time, timeZone);
  if (start.fellBack) {
    unparseable.push({
      eventSessionOldId: old.id,
      field: 'start_time',
      rawValue: old.start_time ?? null,
    });
  }

  const end = parseSessionTimeField(old.date, old.end_time, timeZone);
  if (end.fellBack) {
    unparseable.push({
      eventSessionOldId: old.id,
      field: 'end_time',
      rawValue: old.end_time ?? null,
    });
  }

  const row: NewEventSessionRow = {
    id: deterministicId('event_session', old.id),
    event_id: newEventId,
    session_date: old.date,
    starts_at: start.iso,
    ends_at: end.iso,
    status: resolveSessionStatus(parentEventStatus, old.date, cutoverDate),
    people_reached: null,
    notes: '', // no old event_sessions.notes column
  };

  return { row, unparseable };
}

// --- mapping.md rows: session_attendance split on `planned` -------------

// Note: unlike mapAttendance, this deliberately does not take the old
// session_attendance row -- per mapping.md, `rsvps` carries no field
// sourced from the old row's data beyond the (session, student) pair
// itself (status is always 'going', responded_by is always null).
export function mapRsvp(newSessionId: string, newStudentId: string): NewRsvpRow {
  return {
    session_id: newSessionId,
    student_id: newStudentId,
    status: 'going',
    responded_by: null,
  };
}

export function mapAttendance(
  old: OldSessionAttendance,
  newSessionId: string,
  newStudentId: string,
): NewAttendanceRow {
  return {
    session_id: newSessionId,
    student_id: newStudentId,
    status: 'present',
    check_in_at: null,
    check_out_at: null,
    // Known Context/Traps #4: ALWAYS the old row's literal `hours` value,
    // never derived/recomputed from session duration.
    hours_override: old.hours,
    method: 'import',
    recorded_by: null,
  };
}
