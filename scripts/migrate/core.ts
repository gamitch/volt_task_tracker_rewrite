// T062 (MIG-03): the shared orchestration logic. Known Context/Traps #5:
// this single function is used for BOTH --dry-run and real-run invocations
// -- the *only* difference between the two modes is the `dryRun` flag
// threaded down into each `sink.upsertX(rows, dryRun)` call, which gates
// just the final write step inside dataSink.ts. Every read, every
// transform, every validation in this file runs identically in both modes.

import { mapAttendance, mapEvent, mapEventSession, mapRsvp, mapStudent, mapTeam, mapUnmatchedTeam, buildSeasonUpsert } from './transform.ts';
import { emptyCounts } from './report.ts';
import type { OldDataSource } from './dataSource.ts';
import type { NewDataSink } from './dataSink.ts';
import type {
  AttendeesBackfillMismatchEntry,
  MigrationOptions,
  MigrationReport,
  NewAttendanceRow,
  NewEventRow,
  NewEventSessionRow,
  NewRsvpRow,
  NewStudentRow,
  OrphanedAttendanceEntry,
  UnmatchedTeamEntry,
  UnparseableTimeEntry,
} from './types.ts';

/** Thrown when Known Context/Traps #2's data-integrity gate fails on a real
 * (non-dry-run) invocation: at least one old `events.attendees[]` uuid has
 * no matching `session_attendance` row, so migration 2's backfill (an old-
 * project event, not something this script performs) cannot be assumed
 * complete. Thrown BEFORE any write call reaches the new project. */
export class AttendeesBackfillAssertionError extends Error {
  readonly mismatches: AttendeesBackfillMismatchEntry[];

  constructor(mismatches: AttendeesBackfillMismatchEntry[]) {
    super(
      `Attendees-backfill assertion failed: ${mismatches.length} events.attendees[] uuid(s) have no matching session_attendance row. Refusing to write. Re-run with --dry-run to see the full list, or fix the old-project data and re-run.`,
    );
    this.name = 'AttendeesBackfillAssertionError';
    this.mismatches = mismatches;
  }
}

function groupBy<T, K>(items: T[], keyFn: (item: T) => K): Map<K, T[]> {
  const map = new Map<K, T[]>();
  for (const item of items) {
    const key = keyFn(item);
    const bucket = map.get(key);
    if (bucket) {
      bucket.push(item);
    } else {
      map.set(key, [item]);
    }
  }
  return map;
}

export async function runMigration(
  source: OldDataSource,
  sink: NewDataSink,
  options: MigrationOptions,
): Promise<MigrationReport> {
  const counts = emptyCounts();
  const unmatchedTeams: UnmatchedTeamEntry[] = [];
  const unparseableTimes: UnparseableTimeEntry[] = [];
  const orphanedAttendanceRows: OrphanedAttendanceEntry[] = [];

  const [oldTeams, oldStudents, oldEvents, oldSessions, oldAttendance, oldAppSettings] =
    await Promise.all([
      source.listTeams(),
      source.listStudents(),
      source.listEvents(),
      source.listEventSessions(),
      source.listSessionAttendance(),
      source.getAppSettings(),
    ]);

  // ---------------------------------------------------------------------
  // Known Context/Traps #2: attendees[] backfill assertion. Computed
  // BEFORE any write call, in both modes, so a real run can safely abort
  // before touching the new project at all.
  // ---------------------------------------------------------------------
  const sessionsByEvent = groupBy(oldSessions, (s) => s.event_id);
  const attendanceBySession = groupBy(oldAttendance, (a) => a.session_id);
  const attendeesBackfillMismatches: AttendeesBackfillMismatchEntry[] = [];
  for (const event of oldEvents) {
    const attendeeIds = event.attendees ?? [];
    if (attendeeIds.length === 0) {
      continue;
    }
    const eventSessions = sessionsByEvent.get(event.id) ?? [];
    const coveredStudentIds = new Set<string>();
    for (const session of eventSessions) {
      for (const record of attendanceBySession.get(session.id) ?? []) {
        coveredStudentIds.add(record.student_id);
      }
    }
    for (const studentId of attendeeIds) {
      if (!coveredStudentIds.has(studentId)) {
        attendeesBackfillMismatches.push({ eventOldId: event.id, missingStudentId: studentId });
      }
    }
  }

  if (!options.dryRun && attendeesBackfillMismatches.length > 0) {
    throw new AttendeesBackfillAssertionError(attendeesBackfillMismatches);
  }

  // ---------------------------------------------------------------------
  // teams (mapping.md: teams.* -> teams.* 1:1) + unmatched-team creation
  // ---------------------------------------------------------------------
  const knownTeamNames = new Set(oldTeams.map((t) => t.name));
  const teamRowsToUpsert = oldTeams.map(mapTeam);

  const unmatchedAffiliationLabels = new Set<string>();
  for (const student of oldStudents) {
    const affiliation = student.team_affiliation?.trim() || null;
    const label = affiliation ?? '(none)';
    if (!knownTeamNames.has(label)) {
      if (!unmatchedAffiliationLabels.has(label)) {
        unmatchedAffiliationLabels.add(label);
        teamRowsToUpsert.push(mapUnmatchedTeam(label));
      }
      unmatchedTeams.push({
        studentOldId: student.id,
        teamAffiliation: affiliation ?? '(null)',
        createdArchivedTeamName: label,
      });
    }
  }

  const { idByName: teamIdByName, result: teamsResult } = await sink.upsertTeams(
    teamRowsToUpsert,
    options.dryRun,
  );
  counts.teamsCreated = teamsResult.createdCount;
  counts.teamsExisting = teamsResult.updatedCount;
  counts.teamsUnmatchedArchived = unmatchedAffiliationLabels.size;

  // ---------------------------------------------------------------------
  // students (mapping.md: students.* -> students.*)
  // ---------------------------------------------------------------------
  const studentRows: NewStudentRow[] = [];
  const oldStudentIdToNewId = new Map<string, string>();
  for (const student of oldStudents) {
    const affiliation = student.team_affiliation?.trim() || null;
    const label = affiliation ?? '(none)';
    const teamId = teamIdByName.get(label);
    if (!teamId) {
      throw new Error(`Internal error: no resolved new-project team id for label "${label}"`);
    }
    const row = mapStudent(student, teamId);
    studentRows.push(row);
    oldStudentIdToNewId.set(student.id, row.id);
  }
  await sink.upsertStudents(studentRows, options.dryRun);
  counts.students = studentRows.length;

  // ---------------------------------------------------------------------
  // seasons (mapping.md: app_settings.season_goal -> seasons.default_goal_hours)
  // ---------------------------------------------------------------------
  if (oldSessions.length === 0) {
    throw new Error(
      'No event_sessions found in old project -- cannot compute the "2025–2026" season\'s min->max session date range required by mapping.md.',
    );
  }
  const sortedSessionDates = oldSessions.map((s) => s.date).sort();
  const minSessionDate = sortedSessionDates[0] as string;
  const maxSessionDate = sortedSessionDates[sortedSessionDates.length - 1] as string;
  const seasonUpsert = buildSeasonUpsert(oldAppSettings.season_goal, minSessionDate, maxSessionDate);
  const seasonOutcome = await sink.findOrCreateSeason(seasonUpsert, options.dryRun);
  if (seasonOutcome.created) {
    counts.seasonsCreated = 1;
  } else {
    counts.seasonsExisting = 1;
  }

  // ---------------------------------------------------------------------
  // events (mapping.md: events.name/location/notes/category/... -> events.title/...)
  // ---------------------------------------------------------------------
  const eventRows: NewEventRow[] = [];
  const oldEventIdToNewId = new Map<string, string>();
  for (const event of oldEvents) {
    const row = mapEvent(event, seasonOutcome.id);
    eventRows.push(row);
    oldEventIdToNewId.set(event.id, row.id);
  }
  await sink.upsertEvents(eventRows, options.dryRun);
  counts.events = eventRows.length;

  // ---------------------------------------------------------------------
  // event_sessions (mapping.md: date+start/end_time -> starts_at/ends_at)
  // ---------------------------------------------------------------------
  const eventById = new Map(oldEvents.map((e) => [e.id, e]));
  const sessionRows: NewEventSessionRow[] = [];
  const oldSessionIdToNewId = new Map<string, string>();
  for (const session of oldSessions) {
    const parentEvent = eventById.get(session.event_id);
    if (!parentEvent) {
      throw new Error(
        `Data integrity error: event_session old_id=${session.id} references unknown event_id=${session.event_id}`,
      );
    }
    const newEventId = oldEventIdToNewId.get(session.event_id);
    if (!newEventId) {
      throw new Error(`Internal error: no resolved new-project event id for old event_id=${session.event_id}`);
    }
    const { row, unparseable } = mapEventSession(
      session,
      newEventId,
      parentEvent.status,
      options.cutoverDate,
      options.timeZone,
    );
    sessionRows.push(row);
    oldSessionIdToNewId.set(session.id, row.id);
    unparseableTimes.push(...unparseable);
  }
  await sink.upsertEventSessions(sessionRows, options.dryRun);
  counts.eventSessions = sessionRows.length;

  // ---------------------------------------------------------------------
  // session_attendance split on `planned` -> rsvps / attendance
  // ---------------------------------------------------------------------
  const rsvpRows: NewRsvpRow[] = [];
  const attendanceRows: NewAttendanceRow[] = [];
  for (const record of oldAttendance) {
    const newSessionId = oldSessionIdToNewId.get(record.session_id);
    const newStudentId = oldStudentIdToNewId.get(record.student_id);
    if (!newSessionId) {
      orphanedAttendanceRows.push({ sessionAttendanceOldId: record.id, reason: 'unknown_session' });
      continue;
    }
    if (!newStudentId) {
      orphanedAttendanceRows.push({ sessionAttendanceOldId: record.id, reason: 'unknown_student' });
      continue;
    }
    if (record.planned) {
      rsvpRows.push(mapRsvp(newSessionId, newStudentId));
    } else {
      attendanceRows.push(mapAttendance(record, newSessionId, newStudentId));
    }
  }
  await sink.upsertRsvps(rsvpRows, options.dryRun);
  await sink.upsertAttendance(attendanceRows, options.dryRun);
  counts.rsvps = rsvpRows.length;
  counts.attendance = attendanceRows.length;

  return {
    dryRun: options.dryRun,
    cutoverDate: options.cutoverDate,
    counts,
    unmatchedTeams,
    unparseableTimes,
    attendeesBackfillMismatches,
    orphanedAttendanceRows,
  };
}
