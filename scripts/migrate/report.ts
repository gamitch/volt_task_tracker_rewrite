// T062 (MIG-03): migration report construction and printing.
//
// Constitution item 6 ("No PII... in logs"): this report intentionally
// never prints student/team *names* -- only old-project row ids (uuids),
// which are opaque identifiers, not personal information. An operator with
// service-role access can look up a specific old id in the old project if
// they need the human-readable name; the report/log output itself stays
// PII-free.

import type { MigrationReport, TableCounts } from './types.ts';

export function emptyCounts(): TableCounts {
  return {
    teamsCreated: 0,
    teamsExisting: 0,
    teamsUnmatchedArchived: 0,
    seasonsCreated: 0,
    seasonsExisting: 0,
    students: 0,
    events: 0,
    eventSessions: 0,
    rsvps: 0,
    attendance: 0,
  };
}

export function printReport(report: MigrationReport): void {
  const mode = report.dryRun ? 'DRY RUN (nothing written)' : 'REAL RUN (written)';
  const lines: string[] = [];
  lines.push('='.repeat(72));
  lines.push(`VOLT migration report -- ${mode}`);
  lines.push(`Cutover date: ${report.cutoverDate}`);
  lines.push('='.repeat(72));
  lines.push('');
  lines.push('Per-table counts:');
  lines.push(`  teams            : ${report.counts.teamsCreated} created, ${report.counts.teamsExisting} existing (of which ${report.counts.teamsUnmatchedArchived} unmatched-archived)`);
  lines.push(`  seasons          : ${report.counts.seasonsCreated} created, ${report.counts.seasonsExisting} existing`);
  lines.push(`  students         : ${report.counts.students}`);
  lines.push(`  events           : ${report.counts.events}`);
  lines.push(`  event_sessions   : ${report.counts.eventSessions}`);
  lines.push(`  rsvps            : ${report.counts.rsvps}`);
  lines.push(`  attendance       : ${report.counts.attendance}`);
  lines.push('');

  lines.push(`Unmatched teams (${report.unmatchedTeams.length}):`);
  if (report.unmatchedTeams.length === 0) {
    lines.push('  (none)');
  } else {
    for (const entry of report.unmatchedTeams) {
      lines.push(
        `  student old_id=${entry.studentOldId} team_affiliation="${entry.teamAffiliation}" -> created archived team "${entry.createdArchivedTeamName}"`,
      );
    }
  }
  lines.push('');

  lines.push(`Unparseable times (${report.unparseableTimes.length}):`);
  if (report.unparseableTimes.length === 0) {
    lines.push('  (none)');
  } else {
    for (const entry of report.unparseableTimes) {
      lines.push(
        `  event_session old_id=${entry.eventSessionOldId} field=${entry.field} raw=${JSON.stringify(entry.rawValue)} -> fell back to 00:00`,
      );
    }
  }
  lines.push('');

  lines.push(`Attendees-backfill mismatches (${report.attendeesBackfillMismatches.length}):`);
  if (report.attendeesBackfillMismatches.length === 0) {
    lines.push('  (none)');
  } else {
    for (const entry of report.attendeesBackfillMismatches) {
      lines.push(
        `  event old_id=${entry.eventOldId} attendees[] student_id=${entry.missingStudentId} has no matching session_attendance row`,
      );
    }
  }
  lines.push('');

  if (report.orphanedAttendanceRows.length > 0) {
    lines.push(`Orphaned session_attendance rows (${report.orphanedAttendanceRows.length}) [defensive, beyond mapping.md's required categories]:`);
    for (const entry of report.orphanedAttendanceRows) {
      lines.push(`  session_attendance old_id=${entry.sessionAttendanceOldId} reason=${entry.reason}`);
    }
    lines.push('');
  }

  lines.push('='.repeat(72));

  console.log(lines.join('\n'));
}
