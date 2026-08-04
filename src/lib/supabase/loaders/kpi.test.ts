// T164: the first tests for `loaders/kpi.ts`, which shipped with ZERO tests
// across 255 lines. Verified (three times -- worker packet §1): no test
// imports this module at runtime, and neither of its two exports
// (`makeLoadKpiStripData`/`loadKpiStripData`) is ever invoked. Every
// apparent use of `loadKpiStripData` in `KpiStrip.test.tsx` is that
// component's own INJECTED PROP being stubbed -- that exercises `KpiStrip`,
// not this loader.
//
// Mirrors `loaders/coachHome.test.ts`'s `.from(table)` dispatcher, adapted
// for this file's two query shapes: `v_season_kpis` terminates in
// `.eq(...).maybeSingle()` (same chain shape `students.test.ts`'s
// `makeRecordingClient` already established), `v_season_kpi_team_counts`
// terminates in a bare `.order(...)` (same shape `coachHome.test.ts`'s own
// unfiltered-query dispatcher established, extended one link with `.order`).
//
// No `@vitest-environment jsdom` docblock -- `kpi.ts` imports no page/React
// code (only `@supabase/supabase-js` types and this directory's own
// `loader.ts`/`client.ts`), so this exercises pure loader logic in vitest's
// default node environment, the posture `coachHome.test.ts`/
// `students.test.ts` already established.
//
// Only `makeLoadKpiStripData` is tested (through its factory, with a
// stubbed client) -- the packet's own instruction: the bare default export
// `loadKpiStripData` calls the real `getSupabaseClient()` singleton and is
// left untouched here, same posture every sibling loader test file already
// takes (`coachHome.test.ts`/`checkin.test.ts` never invoke their own bare
// `loadX` exports either).
import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it, vi } from 'vitest';
import { makeLoadKpiStripData } from './kpi';

// ---------------------------------------------------------------------------
// Fixtures -- fabricated names only (constitution item 6).
//
// Packet §3 -- the defect class this row exists for: `mapKpisDbRowToKpiStripData`
// is a verbatim 11-field column rename with no logic, so swapping any two
// fields crashes nothing and mislabels a coach's own data (e.g. meeting
// hours shown as outreach hours). Every field below is given a DISTINCT,
// non-zero value -- never two fields sharing a value, never `0` for more
// than one -- so a swap is observable in a single `toEqual` assertion.
// ---------------------------------------------------------------------------

interface KpisRowFixture {
  season_id: string;
  total_hours: number;
  meeting_hours: number;
  outreach_hours: number;
  competition_hours: number;
  events_logged_count: number;
  most_recent_event_title: string | null;
  most_recent_event_date: string | null;
  active_students_count: number;
  goal_target_hours: number;
  goal_pct: number;
}

function kpisRow(overrides: Partial<KpisRowFixture> = {}): KpisRowFixture {
  return {
    season_id: 'season-2026-fall',
    total_hours: 101,
    meeting_hours: 22,
    outreach_hours: 33,
    competition_hours: 44,
    events_logged_count: 7,
    most_recent_event_title: 'Regional Qualifier',
    most_recent_event_date: '2026-03-14',
    active_students_count: 19,
    goal_target_hours: 150,
    goal_pct: 68,
    ...overrides,
  };
}

interface TeamCountRowFixture {
  team_id: string;
  team_name: string;
  team_sort_order: number;
  active_students_count: number;
}

function teamCountRow(overrides: Partial<TeamCountRowFixture> = {}): TeamCountRowFixture {
  return {
    team_id: 'team-falcons',
    team_name: 'Falcons',
    team_sort_order: 1,
    active_students_count: 9,
    ...overrides,
  };
}

/**
 * Records `.from(table)` dispatch for both views this loader reads.
 * `v_season_kpis` exposes `.select().eq().maybeSingle()`; `v_season_kpi_team_counts`
 * exposes `.select().order()` (no `.eq()` -- the view is not season-scoped,
 * `kpi.ts`'s own module doc).
 */
function makeRecordingClient(
  kpiData: KpisRowFixture | null,
  teamData: TeamCountRowFixture[] | null,
) {
  const kpisMaybeSingleSpy = vi.fn().mockResolvedValue({ data: kpiData, error: null });
  const kpisEqSpy = vi.fn(() => ({ maybeSingle: kpisMaybeSingleSpy }));
  const kpisSelectSpy = vi.fn(() => ({ eq: kpisEqSpy }));

  const teamOrderSpy = vi.fn().mockResolvedValue({ data: teamData, error: null });
  const teamSelectSpy = vi.fn(() => ({ order: teamOrderSpy }));

  const fromSpy = vi.fn((table: string) => {
    if (table === 'v_season_kpis') return { select: kpisSelectSpy };
    if (table === 'v_season_kpi_team_counts') return { select: teamSelectSpy };
    throw new Error(`unexpected table: ${table}`);
  });

  return {
    client: { from: fromSpy } as unknown as SupabaseClient,
    fromSpy,
    kpisSelectSpy,
    kpisEqSpy,
    kpisMaybeSingleSpy,
    teamSelectSpy,
    teamOrderSpy,
  };
}

// ---------------------------------------------------------------------------
// Both queries actually run (packet §4.4 / criterion C6) -- Promise.all
// against BOTH views, every call.
// ---------------------------------------------------------------------------

describe('makeLoadKpiStripData -- both views are queried (T164 criterion C6)', () => {
  it('reads v_season_kpis, scoped to the given seasonId, and v_season_kpi_team_counts, unfiltered', async () => {
    const { client, fromSpy, kpisEqSpy, teamOrderSpy } = makeRecordingClient(kpisRow(), [
      teamCountRow(),
    ]);
    await makeLoadKpiStripData(() => client)('season-2026-fall');
    expect(fromSpy).toHaveBeenCalledWith('v_season_kpis');
    expect(fromSpy).toHaveBeenCalledWith('v_season_kpi_team_counts');
    expect(kpisEqSpy).toHaveBeenCalledWith('season_id', 'season-2026-fall');
    expect(teamOrderSpy).toHaveBeenCalledWith('team_sort_order', { ascending: true });
  });

  it('passes seasonId through verbatim on different calls -- a real passthrough of the argument, not a hardcoded literal', async () => {
    const { client, kpisEqSpy } = makeRecordingClient(kpisRow(), []);
    const loadKpiStripData = makeLoadKpiStripData(() => client);
    await loadKpiStripData('season-alpha');
    await loadKpiStripData('season-beta');
    expect(kpisEqSpy).toHaveBeenNthCalledWith(1, 'season_id', 'season-alpha');
    expect(kpisEqSpy).toHaveBeenNthCalledWith(2, 'season_id', 'season-beta');
  });
});

// ---------------------------------------------------------------------------
// The mapping (:202) -- highest value, packet §3/§4.1. C1 and C2.
// ---------------------------------------------------------------------------

describe('makeLoadKpiStripData -- mapKpisDbRowToKpiStripData is field-accurate (T164 criteria C1/C2)', () => {
  it('maps every field of a real v_season_kpis row to its OWN distinct camelCase field -- a swap of any two is observable here', async () => {
    const { client } = makeRecordingClient(kpisRow(), [
      teamCountRow({ team_id: 'team-falcons', team_name: 'Falcons', team_sort_order: 1 }),
      teamCountRow({ team_id: 'team-herons', team_name: 'Herons', team_sort_order: 2 }),
    ]);
    const data = await makeLoadKpiStripData(() => client)('season-2026-fall');
    expect(data).toEqual({
      seasonId: 'season-2026-fall',
      totalHours: 101,
      meetingHours: 22,
      outreachHours: 33,
      competitionHours: 44,
      eventsLoggedCount: 7,
      mostRecentEventTitle: 'Regional Qualifier',
      mostRecentEventDate: '2026-03-14',
      activeStudentsCount: 19,
      goalTargetHours: 150,
      goalPct: 68,
      teamBreakdown: [
        { teamId: 'team-falcons', teamName: 'Falcons', activeStudentsCount: 9 },
        { teamId: 'team-herons', teamName: 'Herons', activeStudentsCount: 9 },
      ],
    });
  });

  it('preserves a null mostRecentEventTitle/mostRecentEventDate verbatim -- never coalesced to a fabricated placeholder', async () => {
    const { client } = makeRecordingClient(
      kpisRow({ most_recent_event_title: null, most_recent_event_date: null }),
      [],
    );
    const data = await makeLoadKpiStripData(() => client)('season-2026-fall');
    expect(data.mostRecentEventTitle).toBeNull();
    expect(data.mostRecentEventDate).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// The zero path (:183) -- packet §4.2. C3 and C4.
// ---------------------------------------------------------------------------

describe('makeLoadKpiStripData -- the no-KPI-row zero path (T164 criteria C3/C4)', () => {
  it('returns an honest all-zero/all-null shape when v_season_kpis has no row for this seasonId', async () => {
    const { client } = makeRecordingClient(null, [teamCountRow()]);
    const data = await makeLoadKpiStripData(() => client)('season-missing');
    expect(data.seasonId).toBe('season-missing');
    expect(data.totalHours).toBe(0);
    expect(data.meetingHours).toBe(0);
    expect(data.outreachHours).toBe(0);
    expect(data.competitionHours).toBe(0);
    expect(data.eventsLoggedCount).toBe(0);
    expect(data.mostRecentEventTitle).toBeNull();
    expect(data.mostRecentEventDate).toBeNull();
    expect(data.activeStudentsCount).toBe(0);
    expect(data.goalTargetHours).toBe(0);
    expect(data.goalPct).toBe(0);
  });

  it('still carries the real team breakdown on the zero path -- a strip showing zeroes must not also lose its team list', async () => {
    const { client } = makeRecordingClient(null, [
      teamCountRow({ team_id: 'team-falcons', team_name: 'Falcons', active_students_count: 9 }),
      teamCountRow({ team_id: 'team-herons', team_name: 'Herons', active_students_count: 4 }),
    ]);
    const data = await makeLoadKpiStripData(() => client)('season-missing');
    expect(data.teamBreakdown).toEqual([
      { teamId: 'team-falcons', teamName: 'Falcons', activeStudentsCount: 9 },
      { teamId: 'team-herons', teamName: 'Herons', activeStudentsCount: 4 },
    ]);
  });
});

// ---------------------------------------------------------------------------
// teamCountRows ?? [] (:247) -- packet §4.3. C5.
// ---------------------------------------------------------------------------

describe('makeLoadKpiStripData -- a null team-count response (T164 criterion C5)', () => {
  it('yields an empty teamBreakdown, not a crash, when v_season_kpi_team_counts resolves no rows', async () => {
    const { client } = makeRecordingClient(kpisRow(), null);
    const data = await makeLoadKpiStripData(() => client)('season-2026-fall');
    expect(data.teamBreakdown).toEqual([]);
  });

  it('yields an empty teamBreakdown on the zero path too, when both queries come back empty', async () => {
    const { client } = makeRecordingClient(null, null);
    const data = await makeLoadKpiStripData(() => client)('season-missing');
    expect(data.teamBreakdown).toEqual([]);
  });
});
