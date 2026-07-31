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

function makeRecordingClient(teams: TeamRowFixture[] | null, students: StudentRowFixture[] | null) {
  const teamsSelectSpy = vi.fn().mockResolvedValue({ data: teams, error: null });
  const studentsSelectSpy = vi.fn().mockResolvedValue({ data: students, error: null });
  const fromSpy = vi.fn((table: string) => {
    if (table === 'teams') return { select: teamsSelectSpy };
    if (table === 'students') return { select: studentsSelectSpy };
    throw new Error(`unexpected table: ${table}`);
  });
  return {
    client: { from: fromSpy } as unknown as SupabaseClient,
    fromSpy,
    teamsSelectSpy,
    studentsSelectSpy,
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

  it('returns honest-empty literals for events/sessions/rsvps/attendance/teamParticipation/studentHours -- no real query for any of these six fields (filed as T198)', async () => {
    const { client } = makeRecordingClient([], []);
    const data = await makeLoadCoachHomeData(() => client)('season-1');
    expect(data.events).toEqual([]);
    expect(data.sessions).toEqual([]);
    expect(data.rsvps).toEqual([]);
    expect(data.attendance).toEqual([]);
    expect(data.teamParticipation).toBeNull();
    expect(data.studentHours).toEqual([]);
  });

  it('composes the full CoachHomeData shape end-to-end against a stub client -- real teams/students, everything else honest-empty', async () => {
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
      teamParticipation: null,
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
      throw new Error(`unexpected table: ${table}`);
    });
    const client = { from: fromSpy } as unknown as SupabaseClient;
    await expect(makeLoadCoachHomeData(() => client)('season-1')).rejects.toMatchObject({
      code: '500',
    });
  });
});
