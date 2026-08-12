// GAM-305 (legacy T615) §3a -- unit test for the one shared predicate every
// team-scope picker delegates to.
import { describe, expect, it } from 'vitest';
import { excludeArchivedTeams } from './archivedTeams.ts';

interface FixtureTeam {
  id: string;
  name: string;
  archived: boolean;
}

const FIXTURE_TEAMS: readonly FixtureTeam[] = [
  { id: 'team-active', name: 'Active Team', archived: false },
  { id: 'team-archived', name: 'Legacy Forge', archived: true },
];

describe('excludeArchivedTeams', () => {
  it('drops archived teams and keeps active ones', () => {
    expect(excludeArchivedTeams(FIXTURE_TEAMS)).toEqual([
      { id: 'team-active', name: 'Active Team', archived: false },
    ]);
  });

  it('returns an empty array when every team is archived', () => {
    expect(
      excludeArchivedTeams([{ id: 'team-archived', name: 'Legacy Forge', archived: true }]),
    ).toEqual([]);
  });

  it('returns every team unchanged when none are archived', () => {
    const allActive: FixtureTeam[] = [{ id: 'team-active', name: 'Active Team', archived: false }];
    expect(excludeArchivedTeams(allActive)).toEqual(allActive);
  });
});
