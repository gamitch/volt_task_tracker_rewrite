// @vitest-environment jsdom
/**
 * T095 (ED-1 Packet P6): tests for `ParticipationTab.tsx`'s new real
 * `loaders/reports.ts` seam (`loadParticipationData`/`makeLoadParticipationData`).
 * `ParticipationTab.tsx` never had its own colocated test file before this
 * task (T056's original dispatch shipped without one) -- this file is a
 * deliberate, disclosed addition beyond the literal `ParticipationTab.tsx`
 * Allowed Files entry, the same class of addition `HoursTab.test.tsx`/
 * `EventsTab.test.tsx` (this task's own sibling tabs) already make in this
 * same directory, existing to produce this task's own "Required Worker
 * Output" proof (column-by-column citation, a real DOM render still using
 * fixture data with zero real network calls, and a loader-level
 * `SupabaseClient`-stubbed proof of the real query).
 *
 * No `@testing-library/react` is installed in this repo (confirmed via
 * `package.json`) -- uses the same raw `createRoot`/`act` pattern
 * `HoursTab.test.tsx`/`EventsTab.test.tsx` already established.
 * `ParticipationTab` performs no self-gating (`ReportsShell.tsx` already
 * gates `/reports`), so no `AuthProvider`/role wrapping is needed here.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { makeLoadParticipationData } from '../../lib/supabase/loaders/reports';
import {
  buildDisplayRows,
  defaultLoadParticipationData,
  isBelowThreshold,
  ParticipationTab,
  PLACEHOLDER_CURRENT_SEASON_ID,
  type ParticipationDisplayRow,
} from './ParticipationTab';

// ---------------------------------------------------------------------------
// Render harness -- same pattern as `HoursTab.test.tsx`/`EventsTab.test.tsx`.
// ---------------------------------------------------------------------------

let container: HTMLDivElement;
let root: Root;

/**
 * T095: `ParticipationTab`'s own default `loadData` is now the REAL
 * Supabase-backed `loadParticipationData` -- `loadData` defaults to
 * `defaultLoadParticipationData` (the fixture generator, unchanged) here so
 * every render test below keeps exercising the same deterministic fixture
 * numbers, with zero real network calls; any test that wants different
 * behavior overrides `loadData` via its own `props`.
 */
function render(props: Parameters<typeof ParticipationTab>[0]): void {
  act(() => {
    root.render(<ParticipationTab loadData={defaultLoadParticipationData} {...props} />);
  });
}

async function flushMicrotasks(): Promise<void> {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });
}

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => {
    root.unmount();
  });
  container.remove();
});

// ---------------------------------------------------------------------------
// Render-level proof (DES-12 + real DOM fixture cross-check).
// ---------------------------------------------------------------------------

describe('ParticipationTab render', () => {
  it('shows a loading Skeleton, then the populated, team-grouped report', async () => {
    render({ seasonId: PLACEHOLDER_CURRENT_SEASON_ID });
    expect(container.textContent).toContain('Loading participation data');
    await flushMicrotasks();
    expect(container.textContent).toContain('Falcons');
    expect(container.textContent).toContain('Comets');
    expect(container.textContent).toContain('Ava Thompson');
  });

  it('renders an error banner when loadData rejects', async () => {
    render({
      seasonId: PLACEHOLDER_CURRENT_SEASON_ID,
      loadData: () => Promise.reject(new Error('boom')),
    });
    await flushMicrotasks();
    expect(container.textContent).toContain("Couldn't load participation data");
  });

  it('renders "—" for a student absent from the view (no completed sessions), never a fabricated 0%', async () => {
    render({ seasonId: PLACEHOLDER_CURRENT_SEASON_ID });
    await flushMicrotasks();
    const rows = Array.from(container.querySelectorAll('tr'));
    const noahRow = rows.find((row) => row.textContent?.includes('Noah Bennett'));
    expect(noahRow?.textContent).toContain('—');
  });
});

// ---------------------------------------------------------------------------
// T095: real `loaders/reports.ts` seam -- `makeLoadParticipationData`.
// Stubbed `SupabaseClient` only, same DI pattern `StudentsTab.test.tsx`'s
// own `loadStudentsTabData` tests already established -- zero real network
// calls.
// ---------------------------------------------------------------------------

function buildFakeParticipationClient(db: {
  students: Record<string, unknown>[];
  teams: Record<string, unknown>[];
  metrics: Record<string, unknown>[];
}): { client: SupabaseClient; fromSpy: ReturnType<typeof vi.fn> } {
  const fromSpy = vi.fn((table: string) => {
    switch (table) {
      case 'students':
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              order: vi.fn().mockResolvedValue({ data: db.students, error: null }),
            })),
          })),
        };
      case 'teams':
        return {
          select: vi.fn(() => ({
            order: vi.fn().mockResolvedValue({ data: db.teams, error: null }),
          })),
        };
      case 'v_student_participation':
        return {
          select: vi.fn(() => ({
            eq: vi.fn().mockResolvedValue({ data: db.metrics, error: null }),
          })),
        };
      default:
        throw new Error(`buildFakeParticipationClient: unexpected table "${table}"`);
    }
  });
  return { client: { from: fromSpy } as unknown as SupabaseClient, fromSpy };
}

describe('loadParticipationData (T095 real load)', () => {
  it("queries students/teams/v_student_participation, maps snake_case DB rows, and reuses this file's own buildDisplayRows join", async () => {
    const { client, fromSpy } = buildFakeParticipationClient({
      students: [
        { id: 'student-db-1', display_name: 'DB Student', team_id: 'team-db-1' },
        // No matching metric row below -- the real "no completed sessions"
        // absent-row case.
        { id: 'student-db-2', display_name: 'No Sessions Yet', team_id: 'team-db-1' },
      ],
      teams: [{ id: 'team-db-1', name: 'DB Team' }],
      metrics: [
        {
          student_id: 'student-db-1',
          team_id: 'team-db-1',
          season_id: 'season-1',
          expected_ct: 10,
          present_ct: 9,
          late_ct: 1,
          excused_ct: 0,
          participation_pct: 90.0,
        },
      ],
    });

    const load = makeLoadParticipationData(() => client);
    const result = await load('season-1');

    expect(fromSpy).toHaveBeenCalledWith('students');
    expect(fromSpy).toHaveBeenCalledWith('teams');
    expect(fromSpy).toHaveBeenCalledWith('v_student_participation');

    // Cross-checked directly against this file's own exported
    // `buildDisplayRows` -- proves the loader reuses that exact join,
    // never a re-implementation of it.
    const expected = buildDisplayRows(
      [
        { id: 'student-db-1', name: 'DB Student', teamId: 'team-db-1' },
        { id: 'student-db-2', name: 'No Sessions Yet', teamId: 'team-db-1' },
      ],
      [{ id: 'team-db-1', name: 'DB Team' }],
      [
        {
          studentId: 'student-db-1',
          teamId: 'team-db-1',
          seasonId: 'season-1',
          expectedCt: 10,
          presentCt: 9,
          lateCt: 1,
          excusedCt: 0,
          participationPct: 90.0,
        },
      ],
    );
    expect(result).toEqual<ParticipationDisplayRow[]>(expected);

    const noSessionsRow = result.find((row) => row.studentId === 'student-db-2');
    expect(noSessionsRow?.expectedCt).toBeNull();
    expect(noSessionsRow?.participationPct).toBeNull();
    expect(isBelowThreshold(noSessionsRow?.participationPct ?? null, 70)).toBe(false);
  });

  it('bridges the "no rows" case for all three queries to empty arrays, not a crash', async () => {
    const { client } = buildFakeParticipationClient({ students: [], teams: [], metrics: [] });
    const load = makeLoadParticipationData(() => client);
    const result = await load('season-empty');
    expect(result).toEqual([]);
  });

  it('rejects with the real SupabaseLoaderError when any one of the three queries fails', async () => {
    const fromSpy = vi.fn((table: string) => {
      if (table === 'v_student_participation') {
        return {
          select: vi.fn(() => ({
            eq: vi
              .fn()
              .mockResolvedValue({ data: null, error: { message: 'denied', code: '42501' } }),
          })),
        };
      }
      if (table === 'students') {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({ order: vi.fn().mockResolvedValue({ data: [], error: null }) })),
          })),
        };
      }
      if (table === 'teams') {
        return {
          select: vi.fn(() => ({ order: vi.fn().mockResolvedValue({ data: [], error: null }) })),
        };
      }
      throw new Error(`unexpected table ${table}`);
    });
    const client = { from: fromSpy } as unknown as SupabaseClient;

    const load = makeLoadParticipationData(() => client);
    await expect(load('season-1')).rejects.toMatchObject({ code: '42501' });
  });
});
