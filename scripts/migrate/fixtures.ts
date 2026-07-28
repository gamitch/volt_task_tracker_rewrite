// T062 (MIG-03): fabricated fixture data + in-memory implementations of
// OldDataSource / NewDataSink, used ONLY because no live old-project
// connection is reachable in this sandbox (see docs/migration/source-schema.md,
// and the External Blocker section of this task's worker packet). All
// names below are fictional (constitution item 6: "fixtures use fabricated
// names") -- none of these people, teams, or events are real.
//
// This file is never imported by a real migration run against live
// Supabase projects; it exists solely for `scripts/migrate.ts --fixture`,
// the offline structural/idempotency/dry-run-writes-nothing demonstration
// this task's External Blocker section requires.

import type { OldDataSource } from './dataSource.ts';
import type { NewDataSink, TeamsUpsertOutcome } from './dataSink.ts';
import type {
  NewAttendanceRow,
  NewEventRow,
  NewEventSessionRow,
  NewRsvpRow,
  NewSeasonUpsert,
  NewStudentRow,
  NewTeamUpsert,
  OldAppSettings,
  OldEvent,
  OldEventSession,
  OldSessionAttendance,
  OldStudent,
  OldTeam,
  UpsertResult,
} from './types.ts';

// ---------------------------------------------------------------------------
// Fabricated old-project data (fictional names only)
// ---------------------------------------------------------------------------

// Two pre-existing old-project teams (one active, one already archived).
export const FIXTURE_OLD_TEAMS: OldTeam[] = [
  {
    id: 'team-old-1',
    name: 'Gearheads',
    short_name: 'GH',
    color: '#2563eb',
    archived: false,
    sort_order: 1,
  },
  {
    id: 'team-old-2',
    name: 'Bolt Squad',
    short_name: 'BS',
    color: '#9333ea',
    archived: true,
    sort_order: 2,
  },
];

// Students: covers (a) normal matched-team case x2, (b) unmatched-team case
// ("Nighthawks" matches no old team name), (c) null team_affiliation.
export const FIXTURE_OLD_STUDENTS: OldStudent[] = [
  {
    id: 'student-old-1',
    name: 'Robin Vega',
    team_affiliation: 'Gearheads',
    active: true,
    goal_hours: 40,
  },
  {
    id: 'student-old-2',
    name: 'Sam Cortez',
    team_affiliation: 'Bolt Squad',
    active: true,
    goal_hours: null,
  },
  {
    id: 'student-old-3',
    name: 'Jordan Blake',
    team_affiliation: 'Nighthawks', // unmatched -- no such old team
    active: true,
    goal_hours: 20,
  },
  {
    id: 'student-old-4',
    name: 'Casey Nguyen',
    team_affiliation: null, // edge case beyond the packet's required list:
    // exercises the same "(none)" unmatched-team bucket via a null
    // affiliation rather than a non-matching string.
    active: false,
    goal_hours: null,
  },
];

// Events: A = meeting (normal case), B = outreach (carries the attendees[]
// backfill mismatch), C = competition (planned, no attendees[]).
export const FIXTURE_OLD_EVENTS: OldEvent[] = [
  {
    id: 'event-old-A',
    name: 'Weekly Build Meeting',
    location: 'Team Shop',
    notes: 'Regular Tuesday build session.',
    category: 'meeting',
    adult_volunteers_count: 2,
    adult_volunteer_hours: 4,
    status: 'completed',
    attendees: ['student-old-1', 'student-old-2'],
  },
  {
    id: 'event-old-B',
    name: 'Library STEM Night',
    location: 'Public Library',
    notes: 'Community outreach booth.',
    category: 'outreach',
    adult_volunteers_count: 1,
    adult_volunteer_hours: 3,
    status: 'completed',
    // 'student-old-3' (Jordan) is listed as an attendee here but has NO
    // matching session_attendance row below -- this is the deliberate
    // attendees-backfill mismatch fixture.
    attendees: ['student-old-3'],
  },
  {
    id: 'event-old-C',
    name: 'Regional Qualifier',
    location: 'Convention Center',
    notes: null,
    category: 'competition',
    adult_volunteers_count: 0,
    adult_volunteer_hours: 0,
    status: 'planned',
    attendees: null,
  },
];

// Sessions: A1 has a cleanly parseable time; B1 has a deliberately
// unparseable start_time; C1 is a normal future/planned session.
export const FIXTURE_OLD_EVENT_SESSIONS: OldEventSession[] = [
  {
    id: 'session-old-A1',
    event_id: 'event-old-A',
    date: '2026-01-10',
    start_time: '18:00',
    end_time: '20:00',
  },
  {
    id: 'session-old-B1',
    event_id: 'event-old-B',
    date: '2026-02-05',
    start_time: 'whenever folks show up', // unparseable -- falls back to 00:00
    end_time: '17:00',
  },
  {
    id: 'session-old-C1',
    event_id: 'event-old-C',
    date: '2026-03-01',
    start_time: '08:00',
    end_time: '18:00',
  },
];

// session_attendance: covers both planned=true (RSVP) and planned=false
// (confirmed attendance, hours_override-always-set). Deliberately omits any
// row for student-old-3 / session-old-B1 (the attendees[] mismatch above).
export const FIXTURE_OLD_SESSION_ATTENDANCE: OldSessionAttendance[] = [
  {
    id: 'attendance-old-1',
    session_id: 'session-old-A1',
    student_id: 'student-old-1',
    hours: 2,
    planned: true, // -> rsvps, status 'going'
  },
  {
    id: 'attendance-old-2',
    session_id: 'session-old-A1',
    student_id: 'student-old-2',
    hours: 1.5,
    planned: false, // -> attendance, hours_override = 1.5 always
  },
  {
    id: 'attendance-old-3',
    session_id: 'session-old-B1',
    student_id: 'student-old-1',
    hours: 3,
    planned: false, // -> attendance, hours_override = 3 always
  },
];

export const FIXTURE_OLD_APP_SETTINGS: OldAppSettings = { season_goal: 100 };

export class FixtureOldDataSource implements OldDataSource {
  async listTeams(): Promise<OldTeam[]> {
    return FIXTURE_OLD_TEAMS;
  }
  async listStudents(): Promise<OldStudent[]> {
    return FIXTURE_OLD_STUDENTS;
  }
  async listEvents(): Promise<OldEvent[]> {
    return FIXTURE_OLD_EVENTS;
  }
  async listEventSessions(): Promise<OldEventSession[]> {
    return FIXTURE_OLD_EVENT_SESSIONS;
  }
  async listSessionAttendance(): Promise<OldSessionAttendance[]> {
    return FIXTURE_OLD_SESSION_ATTENDANCE;
  }
  async getAppSettings(): Promise<OldAppSettings> {
    return FIXTURE_OLD_APP_SETTINGS;
  }
}

// ---------------------------------------------------------------------------
// In-memory NewDataSink -- simulates the new project's tables well enough
// to demonstrate real natural-key upsert / idempotency / dry-run-writes-
// nothing behavior without a live Supabase connection. Uses the exact same
// dryRun-gated read-then-maybe-write shape as SupabaseNewDataSink so the
// behavior it's demonstrating is representative, not a separately-maintained
// fake.
// ---------------------------------------------------------------------------

interface StoredTeam extends NewTeamUpsert {
  id: string;
}

export class InMemoryNewDataSink implements NewDataSink {
  readonly teams = new Map<string, StoredTeam>(); // keyed by name
  readonly seasons = new Map<string, { id: string } & NewSeasonUpsert>(); // keyed by name
  readonly students = new Map<string, NewStudentRow>(); // keyed by id
  readonly events = new Map<string, NewEventRow>(); // keyed by id
  readonly eventSessions = new Map<string, NewEventSessionRow>(); // keyed by id
  readonly rsvps = new Map<string, NewRsvpRow>(); // keyed by `${session_id}:${student_id}`
  readonly attendance = new Map<string, NewAttendanceRow>(); // keyed by `${session_id}:${student_id}`

  /** Total row count across every simulated table -- used by the worker's
   * verification harness to prove --dry-run writes nothing (before/after
   * row-count check) and that a real run is idempotent (no growth on the
   * second identical run). */
  totalRowCount(): number {
    return (
      this.teams.size +
      this.seasons.size +
      this.students.size +
      this.events.size +
      this.eventSessions.size +
      this.rsvps.size +
      this.attendance.size
    );
  }

  async upsertTeams(rows: NewTeamUpsert[], dryRun: boolean): Promise<TeamsUpsertOutcome> {
    const idByName = new Map<string, string>();
    let createdCount = 0;
    let updatedCount = 0;
    for (const row of rows) {
      const existing = this.teams.get(row.name);
      if (existing) {
        updatedCount += 1;
        idByName.set(row.name, existing.id);
        if (!dryRun) {
          // Update every field except `id` (natural-key upsert: never
          // rewrite an existing row's primary key).
          this.teams.set(row.name, { ...row, id: existing.id });
        }
      } else {
        createdCount += 1;
        if (!dryRun) {
          const id = `team-new-${this.teams.size + 1}-${row.name}`;
          this.teams.set(row.name, { ...row, id });
          idByName.set(row.name, id);
        } else {
          idByName.set(row.name, `dry-run-placeholder:team:${row.name}`);
        }
      }
    }
    return { idByName, result: { createdCount, updatedCount } };
  }

  async findOrCreateSeason(
    row: NewSeasonUpsert,
    dryRun: boolean,
  ): Promise<{ id: string; created: boolean }> {
    const existing = this.seasons.get(row.name);
    if (existing) {
      return { id: existing.id, created: false };
    }
    if (dryRun) {
      return { id: `dry-run-placeholder:season:${row.name}`, created: true };
    }
    const id = `season-new-${row.name}`;
    this.seasons.set(row.name, { ...row, id });
    return { id, created: true };
  }

  async upsertStudents(rows: NewStudentRow[], dryRun: boolean): Promise<UpsertResult> {
    let createdCount = 0;
    let updatedCount = 0;
    for (const row of rows) {
      if (this.students.has(row.id)) {
        updatedCount += 1;
      } else {
        createdCount += 1;
      }
      if (!dryRun) {
        this.students.set(row.id, row);
      }
    }
    return { createdCount, updatedCount };
  }

  async upsertEvents(rows: NewEventRow[], dryRun: boolean): Promise<UpsertResult> {
    let createdCount = 0;
    let updatedCount = 0;
    for (const row of rows) {
      if (this.events.has(row.id)) {
        updatedCount += 1;
      } else {
        createdCount += 1;
      }
      if (!dryRun) {
        this.events.set(row.id, row);
      }
    }
    return { createdCount, updatedCount };
  }

  async upsertEventSessions(rows: NewEventSessionRow[], dryRun: boolean): Promise<UpsertResult> {
    let createdCount = 0;
    let updatedCount = 0;
    for (const row of rows) {
      if (this.eventSessions.has(row.id)) {
        updatedCount += 1;
      } else {
        createdCount += 1;
      }
      if (!dryRun) {
        this.eventSessions.set(row.id, row);
      }
    }
    return { createdCount, updatedCount };
  }

  async upsertRsvps(rows: NewRsvpRow[], dryRun: boolean): Promise<UpsertResult> {
    let createdCount = 0;
    let updatedCount = 0;
    for (const row of rows) {
      const key = `${row.session_id}:${row.student_id}`;
      if (this.rsvps.has(key)) {
        updatedCount += 1;
      } else {
        createdCount += 1;
      }
      if (!dryRun) {
        this.rsvps.set(key, row);
      }
    }
    return { createdCount, updatedCount };
  }

  async upsertAttendance(rows: NewAttendanceRow[], dryRun: boolean): Promise<UpsertResult> {
    let createdCount = 0;
    let updatedCount = 0;
    for (const row of rows) {
      const key = `${row.session_id}:${row.student_id}`;
      if (this.attendance.has(key)) {
        updatedCount += 1;
      } else {
        createdCount += 1;
      }
      if (!dryRun) {
        this.attendance.set(key, row);
      }
    }
    return { createdCount, updatedCount };
  }
}
