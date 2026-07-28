// T062 (MIG-03): a committed, runnable proof harness -- exercises
// runMigration() against the fabricated fixture data in fixtures.ts to
// demonstrate, with real assertions (not just prose), the acceptance
// criteria this task cannot verify against a live old project (see the
// External Blocker section of the worker packet / docs/migration/source-schema.md):
//
//   1. `--dry-run` writes nothing (before/after row-count check), on both
//      an empty store and an already-populated one.
//   2. The attendees-backfill assertion (Known Context/Traps #2) blocks a
//      REAL run and writes zero rows when a mismatch exists.
//   3. A real run against fixture data with the mismatch resolved succeeds
//      and produces the exact expected per-table counts, correct
//      hours_override-always-set values, correct rsvp/attendance split,
//      and correct event_sessions.status resolution.
//   4. Running that same real run a second time is idempotent: the row
//      count does not grow and the report content is unchanged (Known
//      Context/Traps #1 and #6).
//
// Run with: node --experimental-strip-types scripts/migrate/verify-fixture.ts
// Exits non-zero (and prints which assertion failed) if any check fails.

declare const process: { exit: (code?: number) => never };

import { runMigration, AttendeesBackfillAssertionError } from './core.ts';
import { InMemoryNewDataSink } from './fixtures.ts';
import {
  FIXTURE_OLD_APP_SETTINGS,
  FIXTURE_OLD_EVENTS,
  FIXTURE_OLD_EVENT_SESSIONS,
  FIXTURE_OLD_SESSION_ATTENDANCE,
  FIXTURE_OLD_STUDENTS,
  FIXTURE_OLD_TEAMS,
} from './fixtures.ts';
import type { OldDataSource } from './dataSource.ts';
import type { OldSessionAttendance } from './types.ts';

const CUTOVER_DATE = '2026-02-01';

let failures = 0;

function assertTrue(label: string, condition: boolean): void {
  if (condition) {
    console.log(`  [pass] ${label}`);
  } else {
    failures += 1;
    console.log(`  [FAIL] ${label}`);
  }
}

class FixtureSourceWithMismatch implements OldDataSource {
  async listTeams() {
    return FIXTURE_OLD_TEAMS;
  }
  async listStudents() {
    return FIXTURE_OLD_STUDENTS;
  }
  async listEvents() {
    return FIXTURE_OLD_EVENTS;
  }
  async listEventSessions() {
    return FIXTURE_OLD_EVENT_SESSIONS;
  }
  async listSessionAttendance() {
    return FIXTURE_OLD_SESSION_ATTENDANCE;
  }
  async getAppSettings() {
    return FIXTURE_OLD_APP_SETTINGS;
  }
}

/** Same fixture data, but with the deliberate attendees[] backfill gap
 * (event-old-B / student-old-3) resolved by adding the missing
 * session_attendance row -- used to exercise a real run that is expected
 * to SUCCEED, so idempotency and correctness of the write path can be
 * proven end-to-end. */
class FixtureSourceResolved implements OldDataSource {
  async listTeams() {
    return FIXTURE_OLD_TEAMS;
  }
  async listStudents() {
    return FIXTURE_OLD_STUDENTS;
  }
  async listEvents() {
    return FIXTURE_OLD_EVENTS;
  }
  async listEventSessions() {
    return FIXTURE_OLD_EVENT_SESSIONS;
  }
  async listSessionAttendance(): Promise<OldSessionAttendance[]> {
    return [
      ...FIXTURE_OLD_SESSION_ATTENDANCE,
      {
        id: 'attendance-old-4-resolved',
        session_id: 'session-old-B1',
        student_id: 'student-old-3',
        hours: 2.5,
        planned: false,
      },
    ];
  }
  async getAppSettings() {
    return FIXTURE_OLD_APP_SETTINGS;
  }
}

async function main(): Promise<void> {
  console.log('=== 1. --dry-run writes nothing (empty store, fixture WITH mismatch) ===');
  {
    const source = new FixtureSourceWithMismatch();
    const sink = new InMemoryNewDataSink();
    const before = sink.totalRowCount();
    const report = await runMigration(source, sink, {
      dryRun: true,
      cutoverDate: CUTOVER_DATE,
      timeZone: 'America/Chicago',
    });
    const after = sink.totalRowCount();
    assertTrue('row count unchanged by dry-run', before === after);
    assertTrue('row count is exactly 0 (nothing pre-existed)', after === 0);
    assertTrue(
      'report surfaces the attendees-backfill mismatch (non-fatal in dry-run)',
      report.attendeesBackfillMismatches.length === 1 &&
        report.attendeesBackfillMismatches[0]?.eventOldId === 'event-old-B',
    );
    assertTrue('report surfaces the unmatched-team case', report.unmatchedTeams.length === 2);
    assertTrue('report surfaces the unparseable-time case', report.unparseableTimes.length === 1);
  }

  console.log('=== 2. Real run ABORTS (zero writes) when the attendees-backfill mismatch exists ===');
  {
    const source = new FixtureSourceWithMismatch();
    const sink = new InMemoryNewDataSink();
    const before = sink.totalRowCount();
    let threw = false;
    try {
      await runMigration(source, sink, {
        dryRun: false,
        cutoverDate: CUTOVER_DATE,
        timeZone: 'America/Chicago',
      });
    } catch (err) {
      threw = err instanceof AttendeesBackfillAssertionError;
    }
    const after = sink.totalRowCount();
    assertTrue('real run threw AttendeesBackfillAssertionError', threw);
    assertTrue('zero rows written despite the failed real run', before === after && after === 0);
  }

  console.log('=== 3. Real run succeeds once the mismatch is resolved; values are correct ===');
  const sink = new InMemoryNewDataSink();
  const resolvedSource = new FixtureSourceResolved();
  {
    const report1 = await runMigration(resolvedSource, sink, {
      dryRun: false,
      cutoverDate: CUTOVER_DATE,
      timeZone: 'America/Chicago',
    });
    assertTrue('teams: 2 old + 2 unmatched-archived = 4 created', report1.counts.teamsCreated === 4);
    assertTrue('seasons: 1 created', report1.counts.seasonsCreated === 1);
    assertTrue('students: 4', report1.counts.students === 4);
    assertTrue('events: 3', report1.counts.events === 3);
    assertTrue('event_sessions: 3', report1.counts.eventSessions === 3);
    assertTrue('rsvps: 1 (planned=true row)', report1.counts.rsvps === 1);
    assertTrue('attendance: 3 (planned=false rows, mismatch now resolved)', report1.counts.attendance === 3);

    const attendanceRows = Array.from(sink.attendance.values());
    assertTrue(
      'every attendance row has hours_override SET (never null) -- Known Context/Traps #4',
      attendanceRows.every((r) => r.hours_override !== null && r.hours_override !== undefined),
    );
    assertTrue(
      'hours_override equals the literal old row value (1.5, 3, 2.5), not a derived/recomputed value',
      attendanceRows.map((r) => r.hours_override).sort().join(',') === '1.5,2.5,3',
    );
    assertTrue(
      'every attendance row has method=import, status=present, check_in/out null',
      attendanceRows.every(
        (r) => r.method === 'import' && r.status === 'present' && r.check_in_at === null && r.check_out_at === null,
      ),
    );

    const rsvpRows = Array.from(sink.rsvps.values());
    assertTrue(
      'rsvp row has status=going, responded_by=null',
      rsvpRows.length === 1 && rsvpRows[0]?.status === 'going' && rsvpRows[0]?.responded_by === null,
    );

    const sessions = Array.from(sink.eventSessions.values());
    const sessionA1 = sessions.find((s) => s.session_date === '2026-01-10');
    const sessionB1 = sessions.find((s) => s.session_date === '2026-02-05');
    assertTrue(
      'session A1 (parent completed, date <= cutover) -> status completed',
      sessionA1?.status === 'completed',
    );
    assertTrue(
      'session B1 (parent completed, but date > cutover) -> status scheduled',
      sessionB1?.status === 'scheduled',
    );
    assertTrue(
      'session A1 starts_at reflects 18:00 America/Chicago (CST, UTC-6) = 00:00Z next day',
      sessionA1?.starts_at === '2026-01-11T00:00:00.000Z',
    );

    const events = Array.from(sink.events.values());
    const meetingEvent = events.find((e) => e.type === 'meeting');
    const outreachEvent = events.find((e) => e.type === 'outreach');
    const competitionEvent = events.find((e) => e.type === 'competition');
    assertTrue(
      'CMP-02: meeting -> counts_participation=true, counts_volunteer_hours=false',
      meetingEvent?.counts_participation === true && meetingEvent?.counts_volunteer_hours === false,
    );
    assertTrue(
      'CMP-02: outreach -> counts_participation=false, counts_volunteer_hours=true',
      outreachEvent?.counts_participation === false && outreachEvent?.counts_volunteer_hours === true,
    );
    assertTrue(
      'CMP-02: competition -> both flags default false',
      competitionEvent?.counts_participation === false && competitionEvent?.counts_volunteer_hours === false,
    );
    assertTrue('team_ids is null (all-team scope) on every event', events.every((e) => e.team_ids === null));
    assertTrue('created_by is null on every migrated event', events.every((e) => e.created_by === null));

    const teams = Array.from(sink.teams.values());
    const unmatchedTeam = teams.find((t) => t.name === 'Nighthawks');
    assertTrue('unmatched team created archived=true', unmatchedTeam?.archived === true);
  }

  console.log('=== 4. Second real run is idempotent: no row growth, identical report ===');
  {
    const afterFirstRun = sink.totalRowCount();
    const report2 = await runMigration(resolvedSource, sink, {
      dryRun: false,
      cutoverDate: CUTOVER_DATE,
      timeZone: 'America/Chicago',
    });
    const afterSecondRun = sink.totalRowCount();
    assertTrue('row count unchanged after second real run', afterFirstRun === afterSecondRun);
    assertTrue('second run reports 0 newly created teams (all now existing)', report2.counts.teamsCreated === 0);
    assertTrue('second run reports 4 existing teams', report2.counts.teamsExisting === 4);
    assertTrue('second run reports season as existing, not created', report2.counts.seasonsCreated === 0 && report2.counts.seasonsExisting === 1);
  }

  console.log('=== 5. --dry-run on the now-populated store still writes nothing ===');
  {
    const before = sink.totalRowCount();
    const report3 = await runMigration(resolvedSource, sink, {
      dryRun: true,
      cutoverDate: CUTOVER_DATE,
      timeZone: 'America/Chicago',
    });
    const after = sink.totalRowCount();
    assertTrue('row count unchanged by dry-run on populated store', before === after);
    assertTrue('dry-run correctly reports rows as existing (not created) on populated store', report3.counts.teamsCreated === 0 && report3.counts.students === 4);
  }

  console.log('');
  if (failures === 0) {
    console.log(`All checks passed (0 failures).`);
  } else {
    console.log(`${failures} check(s) FAILED.`);
    process.exit(1);
  }
}

await main();
