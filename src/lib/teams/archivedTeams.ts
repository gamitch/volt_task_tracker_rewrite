/**
 * GAM-305 (legacy T615) §3a -- the ONE place archived teams are excluded
 * from a selectable option list. `ScheduleMeetingsDialog.tsx`,
 * `OutreachEventDialog.tsx` and `StudentDialog.tsx` (via
 * `filterSelectableTeams`, which delegates here) all call this instead of
 * re-deriving their own `!team.archived` predicate -- constitution item 3's
 * "no second predicate" is satisfied by delegation, not by three copies that
 * happen to agree today.
 */
export function excludeArchivedTeams<T extends { archived: boolean }>(teams: readonly T[]): T[] {
  return teams.filter((team) => !team.archived);
}
