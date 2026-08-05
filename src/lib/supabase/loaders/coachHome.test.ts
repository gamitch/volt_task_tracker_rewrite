// T173: tests for `loaders/coachHome.ts`'s two new real queries
// (`teams`/`students`) and the composed `makeLoadCoachHomeData`. No sibling
// `dashboard.test.ts` exists to mirror (confirmed via `ls`), so this mirrors
// `loaders/students.test.ts`'s own `makeRecordingClient`-style `.from(table)`
// dispatcher instead, adapted for two UNFILTERED queries (no `.eq(...)`
// chain -- matches `loaders/dashboard.ts`'s own `queryDashboardTeams`/
// `queryDashboardStudents` precedent, so this dispatcher only needs to
// expose `select` per table, not `eq`/`maybeSingle`).
//
// No `@vitest-environment jsdom` docblock -- `coachHome.ts` only imports
// page types (`import type`), so this exercises pure loader logic in
// vitest's default node environment, same posture `students.test.ts`/
// `outreach.test.ts` already established.
import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it, vi } from 'vitest';
import { makeLoadCoachHomeData } from './coachHome';

interface TeamRowFixture {
  id: string;
  name: string;
}

interface StudentRowFixture {
  id: string;
  display_name: string;
  team_id: string;
  is_active: boolean;
  goal_hours_override: number | null;
}

/**
 * T198 -- the dispatcher gains the six tables/views the loader now reads, plus
 * the `.eq(...)`/`.in(...)`/`.maybeSingle()` chain methods those queries use.
 * The original two-argument signature is preserved so every T173 test above
 * keeps working unchanged; extra rows are supplied via the optional third
 * argument, defaulting to empty.
 *
 * The chain is deliberately a PASSTHROUGH: `.eq`/`.in` record their arguments
 * and return the same chain rather than filtering. That is why the query-shape
 * assertions below spy on the arguments directly -- a fixture-visibility test
 * would pass here even if the loader dropped a filter entirely (the same trap
 * T187's premise gate caught in this repo's other fake clients).
 */
type ExtraRows = Partial<Record<string, unknown[] | null>>;

function makeChain(rows: unknown[] | null) {
  const eqSpy = vi.fn(() => chain);
  const inSpy = vi.fn(() => chain);
  const maybeSingleSpy = vi.fn(async () => ({ data: rows?.[0] ?? null, error: null }));
  const chain = {
    eq: eqSpy,
    in: inSpy,
    maybeSingle: maybeSingleSpy,
    then: (resolve: (v: { data: unknown[] | null; error: null }) => unknown) =>
      Promise.resolve({ data: rows, error: null }).then(resolve),
  };
  return { chain, eqSpy, inSpy, maybeSingleSpy };
}

function makeRecordingClient(
  teams: TeamRowFixture[] | null,
  students: StudentRowFixture[] | null,
  extra: ExtraRows = {},
) {
  const teamsSelectSpy = vi.fn().mockResolvedValue({ data: teams, error: null });
  const studentsSelectSpy = vi.fn().mockResolvedValue({ data: students, error: null });
  const selectSpies: Record<string, ReturnType<typeof vi.fn>> = {};
  const chains: Record<string, ReturnType<typeof makeChain>> = {};

  const chainedTable = (table: string) => {
    const built = makeChain(extra[table] ?? []);
    chains[table] = built;
    const selectSpy = vi.fn(() => built.chain);
    selectSpies[table] = selectSpy;
    return { select: selectSpy };
  };

  const CHAINED = [
    'events',
    'event_sessions',
    'rsvps',
    'attendance',
    'v_student_hours',
    'v_season_attendance_rate',
  ];
  const tableStubs: Record<string, { select: ReturnType<typeof vi.fn> }> = {};
  for (const table of CHAINED) tableStubs[table] = chainedTable(table);

  const fromSpy = vi.fn((table: string) => {
    if (table === 'teams') return { select: teamsSelectSpy };
    if (table === 'students') return { select: studentsSelectSpy };
    if (tableStubs[table]) return tableStubs[table];
    throw new Error(`unexpected table: ${table}`);
  });
  return {
    client: { from: fromSpy } as unknown as SupabaseClient,
    fromSpy,
    teamsSelectSpy,
    studentsSelectSpy,
    selectSpies,
    chains,
  };
}

describe('makeLoadCoachHomeData (T173 criterion 7)', () => {
  it("reads teams, unfiltered, via exactly .select('id, name') -- no archived filter invented (matches queryDashboardTeams precedent)", async () => {
    const { client, fromSpy, teamsSelectSpy } = makeRecordingClient([], []);
    await makeLoadCoachHomeData(() => client)('season-1');
    expect(fromSpy).toHaveBeenCalledWith('teams');
    expect(teamsSelectSpy).toHaveBeenCalledWith('id, name');
    expect(teamsSelectSpy).toHaveBeenCalledTimes(1);
  });

  it("reads students, unfiltered, via exactly .select('id, display_name, team_id, is_active, goal_hours_override')", async () => {
    const { client, fromSpy, studentsSelectSpy } = makeRecordingClient([], []);
    await makeLoadCoachHomeData(() => client)('season-1');
    expect(fromSpy).toHaveBeenCalledWith('students');
    expect(studentsSelectSpy).toHaveBeenCalledWith(
      'id, display_name, team_id, is_active, goal_hours_override',
    );
    expect(studentsSelectSpy).toHaveBeenCalledTimes(1);
  });

  it('maps team rows verbatim (id/name -- both already the same shape as HomeTeamRow, no rename needed)', async () => {
    const { client } = makeRecordingClient([{ id: 'team-falcons', name: 'Falcons' }], []);
    const data = await makeLoadCoachHomeData(() => client)('season-1');
    expect(data.teams).toEqual([{ id: 'team-falcons', name: 'Falcons' }]);
  });

  it('maps student rows: team_id/display_name/is_active/goal_hours_override -> teamId/displayName/isActive/goalHoursOverride (camelCase, verbatim -- no coalesce/arithmetic here)', async () => {
    const { client } = makeRecordingClient(
      [],
      [
        {
          id: 'student-remy-okafor',
          display_name: 'Remy Okafor',
          team_id: 'team-falcons',
          is_active: true,
          goal_hours_override: 15,
        },
      ],
    );
    const data = await makeLoadCoachHomeData(() => client)('season-1');
    expect(data.students).toEqual([
      {
        id: 'student-remy-okafor',
        displayName: 'Remy Okafor',
        teamId: 'team-falcons',
        isActive: true,
        goalHoursOverride: 15,
      },
    ]);
  });

  it('preserves a null goal_hours_override verbatim -- no independent coalesce is applied here (that coalesce now happens in CoachHome.tsx, via the defaultGoalHours PROP, never this loader)', async () => {
    const { client } = makeRecordingClient(
      [],
      [
        {
          id: 'student-tobias-lindqvist',
          display_name: 'Tobias Lindqvist',
          team_id: 'team-falcons',
          is_active: true,
          goal_hours_override: null,
        },
      ],
    );
    const data = await makeLoadCoachHomeData(() => client)('season-1');
    expect(data.students[0].goalHoursOverride).toBeNull();
  });

  it('resolves an empty array (never null) for teams/students when zero rows are found', async () => {
    const { client } = makeRecordingClient(null, null);
    const data = await makeLoadCoachHomeData(() => client)('season-1');
    expect(data.teams).toEqual([]);
    expect(data.students).toEqual([]);
  });

  it('passes seasonId through verbatim on different calls, proving a real passthrough of the argument, not a hardcoded literal', async () => {
    const { client } = makeRecordingClient([], []);
    const loadCoachHomeData = makeLoadCoachHomeData(() => client);
    const dataOne = await loadCoachHomeData('season-alpha');
    const dataTwo = await loadCoachHomeData('season-beta');
    expect(dataOne.seasonId).toBe('season-alpha');
    expect(dataTwo.seasonId).toBe('season-beta');
  });

  it("returns the literal defaultGoalHours: 0 -- inert, never read by CoachHome.tsx's render path (Round 2 redesign; mirrors loaders/students.ts:538's identical loadStudentHomeData precedent)", async () => {
    const { client } = makeRecordingClient([], []);
    const data = await makeLoadCoachHomeData(() => client)('season-1');
    expect(data.defaultGoalHours).toBe(0);
  });

  it('returns the literal seasonSetupStatus: { hasGoalsConfigured: true } (Scope ruling #2 -- every season default_goal_hours is NOT NULL, and the create form structurally cannot submit a null value)', async () => {
    const { client } = makeRecordingClient([], []);
    const data = await makeLoadCoachHomeData(() => client)('season-1');
    expect(data.seasonSetupStatus).toEqual({ hasGoalsConfigured: true });
  });

  // -------------------------------------------------------------------------
  // T198 -- the six fields that were honest-empty literals are real queries.
  //
  // The test this replaces asserted the OPPOSITE ("no real query for any of
  // these six fields"). It is not preserved, because it pinned the deferral
  // itself; keeping it would mean asserting the bug. Its replacements below
  // are strictly stronger -- they pin the query SHAPE, not just the output.
  // -------------------------------------------------------------------------

  it('still resolves all six to empty/null when every table is empty -- an honest empty, now measured rather than hardcoded', async () => {
    const { client } = makeRecordingClient([], []);
    const data = await makeLoadCoachHomeData(() => client)('season-1');
    expect(data.events).toEqual([]);
    expect(data.sessions).toEqual([]);
    expect(data.rsvps).toEqual([]);
    expect(data.attendance).toEqual([]);
    expect(data.studentHours).toEqual([]);
  });

  it('scopes events by season, selecting exactly the HomeEventRow columns', async () => {
    const { client, selectSpies, chains } = makeRecordingClient([], []);
    await makeLoadCoachHomeData(() => client)('season-42');
    expect(selectSpies.events).toHaveBeenCalledWith('id, season_id, type, title, team_ids');
    expect(chains.events.eqSpy).toHaveBeenCalledWith('season_id', 'season-42');
  });

  it('scopes v_student_hours by season id', async () => {
    const { client, selectSpies, chains } = makeRecordingClient([], []);
    await makeLoadCoachHomeData(() => client)('season-42');
    expect(selectSpies.v_student_hours).toHaveBeenCalledWith(
      'student_id, season_id, confirmed_hours',
    );
    expect(chains.v_student_hours.eqSpy).toHaveBeenCalledWith('season_id', 'season-42');
  });

  // T803 -- this loader must NOT read `v_season_attendance_rate` any more.
  // The assertion is the point of the task, not a leftover: T198 fetched that
  // view here purely to feed a tile the T124 analytics section already
  // rendered from its own `loaders/dashboard.ts` read. A regression that
  // re-adds the query would be invisible on screen (the surviving tile looks
  // identical) and would only show up as a silent extra round trip -- so it
  // is pinned here, where it IS visible.
  it('never queries v_season_attendance_rate -- that read belongs to loaders/dashboard.ts alone', async () => {
    const { client, fromSpy } = makeRecordingClient([], []);
    await makeLoadCoachHomeData(() => client)('season-1');
    expect(fromSpy).not.toHaveBeenCalledWith('v_season_attendance_rate');
  });

  it('never issues an empty .in(...) -- no events means no session query, and no sessions means no rsvp/attendance query', async () => {
    const { client, fromSpy } = makeRecordingClient([], []);
    await makeLoadCoachHomeData(() => client)('season-1');
    expect(fromSpy).toHaveBeenCalledWith('events');
    expect(fromSpy).not.toHaveBeenCalledWith('event_sessions');
    expect(fromSpy).not.toHaveBeenCalledWith('rsvps');
    expect(fromSpy).not.toHaveBeenCalledWith('attendance');
  });

  it('chains events -> sessions -> (rsvps, attendance) on the ids each stage returns', async () => {
    const { client, chains } = makeRecordingClient([], [], {
      events: [
        { id: 'event-1', season_id: 'season-1', type: 'meeting', title: 'X', team_ids: null },
      ],
      event_sessions: [
        {
          id: 'session-1',
          event_id: 'event-1',
          starts_at: '2026-08-01T00:00:00.000Z',
          ends_at: '2026-08-01T01:00:00.000Z',
          status: 'scheduled',
        },
      ],
    });
    await makeLoadCoachHomeData(() => client)('season-1');
    expect(chains.event_sessions.inSpy).toHaveBeenCalledWith('event_id', ['event-1']);
    expect(chains.rsvps.inSpy).toHaveBeenCalledWith('session_id', ['session-1']);
    expect(chains.attendance.inSpy).toHaveBeenCalledWith('session_id', ['session-1']);
  });

  it('maps snake_case to camelCase for all six, preserving events.team_ids null as the "all teams" sentinel', async () => {
    const { client } = makeRecordingClient([], [], {
      events: [
        { id: 'e1', season_id: 'season-1', type: 'meeting', title: 'Build', team_ids: null },
        { id: 'e2', season_id: 'season-1', type: 'outreach', title: 'Drive', team_ids: ['team-a'] },
      ],
      event_sessions: [
        {
          id: 's1',
          event_id: 'e1',
          starts_at: '2026-08-01T00:00:00.000Z',
          ends_at: '2026-08-01T01:00:00.000Z',
          status: 'completed',
        },
      ],
      rsvps: [
        {
          id: 'r1',
          session_id: 's1',
          student_id: 'stu-1',
          status: 'going',
          updated_at: '2026-08-01T00:30:00.000Z',
        },
      ],
      attendance: [{ session_id: 's1', student_id: 'stu-1', status: 'present' }],
      v_student_hours: [{ student_id: 'stu-1', season_id: 'season-1', confirmed_hours: 12.5 }],
    });
    const data = await makeLoadCoachHomeData(() => client)('season-1');
    expect(data.events).toEqual([
      { id: 'e1', seasonId: 'season-1', type: 'meeting', title: 'Build', teamIds: null },
      { id: 'e2', seasonId: 'season-1', type: 'outreach', title: 'Drive', teamIds: ['team-a'] },
    ]);
    expect(data.sessions).toEqual([
      {
        id: 's1',
        eventId: 'e1',
        startsAt: '2026-08-01T00:00:00.000Z',
        endsAt: '2026-08-01T01:00:00.000Z',
        status: 'completed',
      },
    ]);
    expect(data.rsvps).toEqual([
      {
        id: 'r1',
        sessionId: 's1',
        studentId: 'stu-1',
        status: 'going',
        updatedAt: '2026-08-01T00:30:00.000Z',
      },
    ]);
    expect(data.attendance).toEqual([{ sessionId: 's1', studentId: 'stu-1', status: 'present' }]);
    expect(data.studentHours).toEqual([
      { studentId: 'stu-1', seasonId: 'season-1', confirmedHours: 12.5 },
    ]);
  });

  it('composes the full CoachHomeData shape end-to-end against a stub client -- real teams/students, empty tables for the rest', async () => {
    const { client } = makeRecordingClient(
      [
        { id: 'team-falcons', name: 'Falcons' },
        { id: 'team-herons', name: 'Herons' },
      ],
      [
        {
          id: 'student-remy-okafor',
          display_name: 'Remy Okafor',
          team_id: 'team-falcons',
          is_active: true,
          goal_hours_override: null,
        },
        {
          id: 'student-tobias-lindqvist',
          display_name: 'Tobias Lindqvist',
          team_id: 'team-herons',
          is_active: false,
          goal_hours_override: 20,
        },
      ],
    );
    const data = await makeLoadCoachHomeData(() => client)('season-fixture-1');
    expect(data).toEqual({
      seasonId: 'season-fixture-1',
      defaultGoalHours: 0,
      teams: [
        { id: 'team-falcons', name: 'Falcons' },
        { id: 'team-herons', name: 'Herons' },
      ],
      students: [
        {
          id: 'student-remy-okafor',
          displayName: 'Remy Okafor',
          teamId: 'team-falcons',
          isActive: true,
          goalHoursOverride: null,
        },
        {
          id: 'student-tobias-lindqvist',
          displayName: 'Tobias Lindqvist',
          teamId: 'team-herons',
          isActive: false,
          goalHoursOverride: 20,
        },
      ],
      events: [],
      sessions: [],
      rsvps: [],
      attendance: [],
      studentHours: [],
      seasonSetupStatus: { hasGoalsConfigured: true },
    });
  });

  it('rejects with the real SupabaseLoaderError on a genuine query error -- no fixture fallback', async () => {
    const fromSpy = vi.fn((table: string) => {
      if (table === 'teams') {
        return {
          select: vi
            .fn()
            .mockResolvedValue({ data: null, error: { message: 'boom', code: '500' } }),
        };
      }
      if (table === 'students') {
        return { select: vi.fn().mockResolvedValue({ data: [], error: null }) };
      }
      // T198 -- the loader now reads six more tables in the same Promise.all.
      // Without these, the dispatcher's own `unexpected table` throw would
      // surface as UNKNOWN and MASK the 500 this test exists to assert.
      const emptyChain = {
        eq: () => emptyChain,
        in: () => emptyChain,
        maybeSingle: async () => ({ data: null, error: null }),
        then: (resolve: (v: { data: never[]; error: null }) => unknown) =>
          Promise.resolve({ data: [], error: null }).then(resolve),
      };
      return { select: () => emptyChain };
    });
    const client = { from: fromSpy } as unknown as SupabaseClient;
    await expect(makeLoadCoachHomeData(() => client)('season-1')).rejects.toMatchObject({
      code: '500',
    });
  });
});
