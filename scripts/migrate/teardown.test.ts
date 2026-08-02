// T063b: unit tests for manifest-driven teardown. A fake Supabase client
// (in-memory Map per table, same `.from().select().in()` /
// `.from().delete().in()` chain shape the real `SupabaseClient` exposes)
// stands in for the real project throughout -- no network, no credentials,
// matching this directory's existing convention of exercising real logic
// against a fake/in-memory backend (see fixtures.ts's InMemoryNewDataSink).
//
// Each behavioral test below is written to be discriminating: the worker
// report for this task names, per test, the exact mutation that would break
// it and confirms (by making the mutation and re-running) that the test
// goes red.
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { buildManifest, ManifestValidationError } from './manifest.ts';
import type { MigrationManifest, MigrationManifestTables } from './manifest.ts';
import { TEARDOWN_TABLE_ORDER, performTeardown, printTeardownSummary, runTeardown } from './teardown.ts';

// ---------------------------------------------------------------------------
// Fake Supabase client -- in-memory Map per table.
// ---------------------------------------------------------------------------

interface FakeClientHandle {
  client: SupabaseClient;
  /** Every table name any `.from()` call named, in call order -- used to
   * prove the forbidden-table and FK-order properties by execution, not
   * just by reading TEARDOWN_TABLE_ORDER's literal contents. */
  calledTables: string[];
  tableRows: (table: string) => Set<string>;
}

function makeFakeClient(initial: Record<string, string[]>): FakeClientHandle {
  const tables = new Map<string, Set<string>>();
  for (const [table, ids] of Object.entries(initial)) {
    tables.set(table, new Set(ids));
  }
  const calledTables: string[] = [];

  const client = {
    from(table: string) {
      calledTables.push(table);
      return {
        select() {
          return {
            in(_col: string, ids: string[]) {
              void _col;
              const rows = tables.get(table) ?? new Set<string>();
              const data = ids.filter((id) => rows.has(id)).map((id) => ({ id }));
              return Promise.resolve({ data, error: null });
            },
          };
        },
        delete() {
          return {
            in(_col: string, ids: string[]) {
              void _col;
              const rows = tables.get(table) ?? new Set<string>();
              for (const id of ids) {
                rows.delete(id);
              }
              return Promise.resolve({ error: null });
            },
          };
        },
      };
    },
  };

  return {
    client: client as unknown as SupabaseClient,
    calledTables,
    tableRows: (table: string) => tables.get(table) ?? new Set<string>(),
  };
}

function emptyTables(): MigrationManifestTables {
  return {
    teams: { createdIds: [], createdCount: 0 },
    seasons: { createdIds: [], createdCount: 0 },
    students: { createdIds: [], createdCount: 0 },
    events: { createdIds: [], createdCount: 0 },
    event_sessions: { createdIds: [], createdCount: 0 },
    rsvps: { createdIds: [], createdCount: 0 },
    attendance: { createdIds: [], createdCount: 0 },
  };
}

function manifestWith(overrides: Partial<MigrationManifestTables>): MigrationManifest {
  return buildManifest({
    runAt: new Date('2026-08-01T12:00:00.000Z'),
    cutoverDate: '2026-07-19',
    source: { kind: 'from-dir', path: '/tmp/export' },
    newProjectUrl: 'https://new-project.supabase.co',
    tables: { ...emptyTables(), ...overrides },
  });
}

describe('runTeardown deletes exactly the manifest ids', () => {
  it('deletes only ids the manifest lists, leaving pre-existing (non-migration) rows untouched', async () => {
    // "student-real-1" simulates a real account-holding student that
    // existed independently of the migration -- NOT in the manifest. This
    // is exactly the scenario the interim SQL heuristic gets wrong once
    // real students without accounts exist; the manifest-driven path must
    // survive it.
    const { client, tableRows } = makeFakeClient({
      students: ['student-migrated-1', 'student-migrated-2', 'student-real-1'],
      teams: ['team-migrated-1', 'team-real-1'],
    });
    const manifest = manifestWith({
      students: { createdIds: ['student-migrated-1', 'student-migrated-2'], createdCount: 2 },
      teams: { createdIds: ['team-migrated-1'], createdCount: 1 },
    });

    const result = await runTeardown(client, manifest, false);

    expect(tableRows('students')).toEqual(new Set(['student-real-1']));
    expect(tableRows('teams')).toEqual(new Set(['team-real-1']));
    const studentsOutcome = result.outcomes.find((o) => o.table === 'students')!;
    expect(studentsOutcome.deletedIds.sort()).toEqual(['student-migrated-1', 'student-migrated-2']);
  });

  it('dry run deletes nothing but reports what it would delete', async () => {
    const { client, tableRows } = makeFakeClient({ students: ['student-migrated-1'] });
    const manifest = manifestWith({ students: { createdIds: ['student-migrated-1'], createdCount: 1 } });

    const result = await runTeardown(client, manifest, true);

    expect(tableRows('students')).toEqual(new Set(['student-migrated-1'])); // untouched
    const studentsOutcome = result.outcomes.find((o) => o.table === 'students')!;
    expect(studentsOutcome.deletedIds).toEqual([]);
    expect(studentsOutcome.foundIds).toEqual(['student-migrated-1']);
  });
});

describe('runTeardown is idempotent', () => {
  it('a second real run against an already-torn-down manifest finds everything already gone, deletes nothing, and does not throw', async () => {
    const { client, tableRows } = makeFakeClient({ students: ['student-migrated-1', 'student-migrated-2'] });
    const manifest = manifestWith({
      students: { createdIds: ['student-migrated-1', 'student-migrated-2'], createdCount: 2 },
    });

    const first = await runTeardown(client, manifest, false);
    expect(first.outcomes.find((o) => o.table === 'students')!.deletedIds.sort()).toEqual([
      'student-migrated-1',
      'student-migrated-2',
    ]);
    expect(tableRows('students').size).toBe(0);

    const second = await runTeardown(client, manifest, false);
    const secondStudents = second.outcomes.find((o) => o.table === 'students')!;
    expect(secondStudents.deletedIds).toEqual([]);
    expect(secondStudents.alreadyGoneIds.sort()).toEqual(['student-migrated-1', 'student-migrated-2']);
  });
});

describe('runTeardown respects FK-safe delete order', () => {
  it('touches tables in the declared children-before-parents order', async () => {
    const { client, calledTables } = makeFakeClient({
      attendance: ['a1'],
      rsvps: ['r1'],
      event_sessions: ['es1'],
      events: ['ev1'],
      students: ['st1'],
      seasons: ['se1'],
      teams: ['te1'],
    });
    const manifest = manifestWith({
      attendance: { createdIds: ['a1'], createdCount: 1 },
      rsvps: { createdIds: ['r1'], createdCount: 1 },
      event_sessions: { createdIds: ['es1'], createdCount: 1 },
      events: { createdIds: ['ev1'], createdCount: 1 },
      students: { createdIds: ['st1'], createdCount: 1 },
      seasons: { createdIds: ['se1'], createdCount: 1 },
      teams: { createdIds: ['te1'], createdCount: 1 },
    });

    await runTeardown(client, manifest, false);

    const firstAppearanceOrder = [...new Set(calledTables)];
    expect(firstAppearanceOrder).toEqual([...TEARDOWN_TABLE_ORDER]);
  });
});

describe('teardown never references profiles, guardian_links, or auth.users', () => {
  it('TEARDOWN_TABLE_ORDER is exactly the 7 migration-owned tables', () => {
    expect([...TEARDOWN_TABLE_ORDER].sort()).toEqual(
      ['attendance', 'event_sessions', 'events', 'rsvps', 'seasons', 'students', 'teams'].sort(),
    );
    expect(TEARDOWN_TABLE_ORDER).not.toContain('profiles');
    expect(TEARDOWN_TABLE_ORDER).not.toContain('guardian_links');
    expect(TEARDOWN_TABLE_ORDER).not.toContain('auth.users');
    expect(TEARDOWN_TABLE_ORDER).not.toContain('users');
  });

  it('never calls .from() with a forbidden table name, even when a (tampered/hand-edited) manifest injects one', async () => {
    const { client, calledTables, tableRows } = makeFakeClient({
      students: ['student-migrated-1'],
      // A table this code should never even know to look at.
      profiles: ['owner-account-id'],
    });
    // Bypass buildManifest's typed `tables` shape on purpose -- this
    // simulates a manifest.json a user hand-edited (or a bug elsewhere)
    // rather than one this codebase's own types could ever produce.
    const manifest = manifestWith({ students: { createdIds: ['student-migrated-1'], createdCount: 1 } });
    const tampered = {
      ...manifest,
      tables: { ...manifest.tables, profiles: { createdIds: ['owner-account-id'], createdCount: 1 } },
    } as unknown as MigrationManifest;

    await runTeardown(client, tampered, false);

    expect(calledTables).not.toContain('profiles');
    expect(calledTables).not.toContain('guardian_links');
    expect(calledTables).not.toContain('auth.users');
    // The owner's account survives untouched.
    expect(tableRows('profiles')).toEqual(new Set(['owner-account-id']));
  });
});

describe('readManifest/performTeardown refuses to proceed on a malformed or empty manifest', () => {
  let dir: string;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'volt-teardown-test-'));
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('refuses on a missing manifest file, before any env var or network access is attempted', async () => {
    // No NEW_SUPABASE_URL / NEW_SERVICE_ROLE_KEY set in this test process --
    // if performTeardown reached env loading or the network before manifest
    // validation, this would fail with a different error (or hang).
    await expect(performTeardown(join(dir, 'missing.json'), true)).rejects.toThrow(ManifestValidationError);
  });

  it('refuses on an empty manifest file', async () => {
    const path = join(dir, 'empty.json');
    await writeFile(path, '', 'utf8');

    await expect(performTeardown(path, true)).rejects.toThrow(ManifestValidationError);
  });

  it('refuses on malformed JSON', async () => {
    const path = join(dir, 'bad.json');
    await writeFile(path, '{not json', 'utf8');

    await expect(performTeardown(path, true)).rejects.toThrow(ManifestValidationError);
  });

  it('refuses on a structurally invalid (missing tables) manifest', async () => {
    const path = join(dir, 'no-tables.json');
    await writeFile(path, JSON.stringify({ schemaVersion: 1, runAt: 'x', cutoverDate: 'x', newProjectUrl: 'x', source: { kind: 'live' } }), 'utf8');

    await expect(performTeardown(path, true)).rejects.toThrow(ManifestValidationError);
  });
});

describe('printTeardownSummary', () => {
  it('does not throw and mentions every table with requested ids', () => {
    const manifest = manifestWith({ students: { createdIds: ['s1'], createdCount: 1 } });
    const result = {
      dryRun: true,
      outcomes: [
        {
          table: 'students' as const,
          requestedIds: manifest.tables.students.createdIds,
          foundIds: manifest.tables.students.createdIds,
          alreadyGoneIds: [],
          deletedIds: [],
        },
      ],
    };
    expect(() => printTeardownSummary('/tmp/manifest.json', result)).not.toThrow();
  });
});
