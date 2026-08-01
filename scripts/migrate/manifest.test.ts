// T063b: unit tests for the migration manifest -- write/read round-trip,
// `readManifest`'s rejection of malformed/empty/tampered files, and
// `ManifestRecordingSink`'s core correctness property: it must record ONLY
// ids a real upsert call reports as `createdIds`, never anything reported
// as pre-existing/matched. Each throwaway directory pattern matches
// jsonFileSource.test.ts (mkdtemp/rm per test, nothing shared).
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { IdentifyingNewDataSink, NewDataSink, TeamsUpsertOutcomeWithIds, UpsertResultWithIds } from './dataSink.ts';
import {
  ManifestRecordingSink,
  ManifestValidationError,
  buildManifest,
  defaultManifestPath,
  readManifest,
  writeManifest,
} from './manifest.ts';
import type { MigrationManifest, MigrationManifestTables } from './manifest.ts';
import type {
  NewAttendanceRow,
  NewEventRow,
  NewEventSessionRow,
  NewRsvpRow,
  NewSeasonUpsert,
  NewStudentRow,
  NewTeamUpsert,
} from './types.ts';

let dir: string;

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'volt-manifest-test-'));
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

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

function sampleManifest(): MigrationManifest {
  return buildManifest({
    runAt: new Date('2026-08-01T12:00:00.000Z'),
    cutoverDate: '2026-07-19',
    source: { kind: 'from-dir', path: '/tmp/export' },
    newProjectUrl: 'https://new-project.supabase.co',
    tables: {
      ...emptyTables(),
      students: { createdIds: ['student-a', 'student-b'], createdCount: 2 },
      teams: { createdIds: ['team-a'], createdCount: 1 },
    },
  });
}

describe('manifest write/read round-trip', () => {
  it('reads back exactly what was written', async () => {
    const manifest = sampleManifest();
    const path = join(dir, 'manifest.json');

    await writeManifest(manifest, path);
    const readBack = await readManifest(path);

    expect(readBack).toEqual(manifest);
  });

  it('creates missing parent directories', async () => {
    const manifest = sampleManifest();
    const path = join(dir, 'nested', 'deeper', 'manifest.json');

    await writeManifest(manifest, path);

    await expect(readManifest(path)).resolves.toEqual(manifest);
  });

  it('round-trips a "live" source manifest (no source.path)', async () => {
    const manifest = buildManifest({
      runAt: new Date('2026-08-01T12:00:00.000Z'),
      cutoverDate: '2026-07-19',
      source: { kind: 'live' },
      newProjectUrl: 'https://new-project.supabase.co',
      tables: emptyTables(),
    });
    const path = join(dir, 'manifest.json');

    await writeManifest(manifest, path);

    await expect(readManifest(path)).resolves.toEqual(manifest);
  });

  it('defaultManifestPath produces a filesystem-safe, distinct path per run', () => {
    const a = defaultManifestPath(new Date('2026-08-01T12:00:00.000Z'));
    const b = defaultManifestPath(new Date('2026-08-01T12:00:01.000Z'));
    expect(a).not.toContain(':');
    expect(a).not.toEqual(b);
    expect(a).toMatch(/^docs\/migration\/manifests\/.*\.json$/);
  });
});

describe('readManifest rejects bad input before any delete could run', () => {
  it('rejects a missing file', async () => {
    await expect(readManifest(join(dir, 'does-not-exist.json'))).rejects.toThrow(ManifestValidationError);
  });

  it('rejects an empty file', async () => {
    // Deliberately named so the word "empty" appears nowhere in the path --
    // readManifest's own error-message interpolation includes the path, and
    // an earlier draft of this test used `empty.json`, which made the
    // `/empty/` assertion below pass for the wrong reason (it matched the
    // *filename*, not a real "this file is empty" diagnosis) even after a
    // mutation that deleted the dedicated empty-file check entirely. Caught
    // by mutation-testing this exact test -- see the worker report.
    const path = join(dir, 'blank-manifest-fixture.json');
    await writeFile(path, '', 'utf8');

    await expect(readManifest(path)).rejects.toThrow(ManifestValidationError);
    await expect(readManifest(path)).rejects.toThrow(/is empty/);
  });

  it('rejects invalid JSON', async () => {
    const path = join(dir, 'bad.json');
    await writeFile(path, '{not valid json', 'utf8');

    await expect(readManifest(path)).rejects.toThrow(ManifestValidationError);
    await expect(readManifest(path)).rejects.toThrow(/not valid JSON/);
  });

  it('rejects valid JSON missing the tables object', async () => {
    // Filename deliberately avoids the word "tables" -- see the "rejects an
    // empty file" test above for why a fixture filename containing the
    // word under test can make the message-regex assertion pass for the
    // wrong reason (readManifest's error messages interpolate the path).
    const path = join(dir, 'incomplete-fixture.json');
    await writeFile(path, JSON.stringify({ schemaVersion: 1, runAt: 'x', cutoverDate: 'x', newProjectUrl: 'x', source: { kind: 'live' } }), 'utf8');

    await expect(readManifest(path)).rejects.toThrow(ManifestValidationError);
    await expect(readManifest(path)).rejects.toThrow(/"tables"/);
  });

  it('rejects a manifest whose createdCount was hand-edited to disagree with createdIds', async () => {
    const manifest = sampleManifest();
    const tampered = {
      ...manifest,
      tables: { ...manifest.tables, students: { createdIds: ['student-a', 'student-b'], createdCount: 99 } },
    };
    const path = join(dir, 'tampered.json');
    await writeFile(path, JSON.stringify(tampered), 'utf8');

    await expect(readManifest(path)).rejects.toThrow(ManifestValidationError);
    await expect(readManifest(path)).rejects.toThrow(/createdCount/);
  });

  it('rejects an unsupported schemaVersion', async () => {
    const manifest = sampleManifest();
    const path = join(dir, 'wrong-version.json');
    await writeFile(path, JSON.stringify({ ...manifest, schemaVersion: 2 }), 'utf8');

    await expect(readManifest(path)).rejects.toThrow(ManifestValidationError);
    await expect(readManifest(path)).rejects.toThrow(/schemaVersion/);
  });
});

// ---------------------------------------------------------------------------
// ManifestRecordingSink -- the created-vs-matched correctness property.
// ---------------------------------------------------------------------------

/** A minimal fake satisfying both `NewDataSink` and `IdentifyingNewDataSink`
 * so this suite never needs a real Supabase connection. Its job is only to
 * report, per call, exactly which ids it "created" vs "matched" -- callers
 * configure that via `fixtureCreated`. This mirrors what
 * scripts/migrate/dataSink.ts's `SupabaseNewDataSink` guarantees for real:
 * `createdIds` never includes anything the natural-key upsert matched. */
function makeFakeIdentifyingSink(): NewDataSink & IdentifyingNewDataSink {
  return {
    async upsertTeams(rows: NewTeamUpsert[], dryRun: boolean): Promise<TeamsUpsertOutcomeWithIds> {
      const createdIds = dryRun ? [] : rows.filter((r) => r.name.startsWith('new-')).map((r) => `team-id:${r.name}`);
      return {
        idByName: new Map(rows.map((r) => [r.name, `team-id:${r.name}`])),
        result: { createdCount: createdIds.length, updatedCount: rows.length - createdIds.length },
        createdIds,
      };
    },
    async findOrCreateSeason(row: NewSeasonUpsert, dryRun: boolean) {
      const created = row.name.startsWith('new-');
      return { id: `season-id:${row.name}`, created: !dryRun && created };
    },
    async upsertStudents(rows: NewStudentRow[], dryRun: boolean): Promise<UpsertResultWithIds> {
      const createdIds = dryRun ? [] : rows.filter((r) => r.id.startsWith('new-')).map((r) => r.id);
      return { createdCount: createdIds.length, updatedCount: rows.length - createdIds.length, createdIds };
    },
    async upsertEvents(rows: NewEventRow[], dryRun: boolean): Promise<UpsertResultWithIds> {
      const createdIds = dryRun ? [] : rows.filter((r) => r.id.startsWith('new-')).map((r) => r.id);
      return { createdCount: createdIds.length, updatedCount: rows.length - createdIds.length, createdIds };
    },
    async upsertEventSessions(rows: NewEventSessionRow[], dryRun: boolean): Promise<UpsertResultWithIds> {
      const createdIds = dryRun ? [] : rows.filter((r) => r.id.startsWith('new-')).map((r) => r.id);
      return { createdCount: createdIds.length, updatedCount: rows.length - createdIds.length, createdIds };
    },
    async upsertRsvps(rows: NewRsvpRow[], dryRun: boolean): Promise<UpsertResultWithIds> {
      const createdIds = dryRun
        ? []
        : rows.filter((r) => r.student_id.startsWith('new-')).map((r) => `rsvp-id:${r.session_id}:${r.student_id}`);
      return { createdCount: createdIds.length, updatedCount: rows.length - createdIds.length, createdIds };
    },
    async upsertAttendance(rows: NewAttendanceRow[], dryRun: boolean): Promise<UpsertResultWithIds> {
      const createdIds = dryRun
        ? []
        : rows
            .filter((r) => r.student_id.startsWith('new-'))
            .map((r) => `attendance-id:${r.session_id}:${r.student_id}`);
      return { createdCount: createdIds.length, updatedCount: rows.length - createdIds.length, createdIds };
    },
  };
}

describe('ManifestRecordingSink', () => {
  it('records only created ids, never matched/pre-existing ones', async () => {
    const inner = makeFakeIdentifyingSink();
    const sink = new ManifestRecordingSink(inner);

    // "existing-1" simulates a row the natural-key upsert MATCHED (already
    // present before this run); "new-1"/"new-2" simulate rows it CREATED.
    await sink.upsertStudents(
      [
        { id: 'existing-1', profile_id: null, display_name: 'x', team_id: 't', grad_year: null, is_active: true, goal_hours_override: null },
        { id: 'new-1', profile_id: null, display_name: 'x', team_id: 't', grad_year: null, is_active: true, goal_hours_override: null },
        { id: 'new-2', profile_id: null, display_name: 'x', team_id: 't', grad_year: null, is_active: true, goal_hours_override: null },
      ],
      false,
    );

    const snapshot = sink.snapshotTables();
    expect(snapshot.students.createdIds.sort()).toEqual(['new-1', 'new-2']);
    expect(snapshot.students.createdIds).not.toContain('existing-1');
    expect(snapshot.students.createdCount).toBe(2);
  });

  it('records nothing on a dry run', async () => {
    const inner = makeFakeIdentifyingSink();
    const sink = new ManifestRecordingSink(inner);

    await sink.upsertStudents(
      [{ id: 'new-1', profile_id: null, display_name: 'x', team_id: 't', grad_year: null, is_active: true, goal_hours_override: null }],
      true, // dryRun
    );

    const snapshot = sink.snapshotTables();
    expect(snapshot.students.createdIds).toEqual([]);
    expect(snapshot.students.createdCount).toBe(0);
  });

  it('records exactly one season id when findOrCreateSeason reports created=true, and none when created=false', async () => {
    const inner = makeFakeIdentifyingSink();
    const sink = new ManifestRecordingSink(inner);

    await sink.findOrCreateSeason({ name: 'new-season', starts_on: '2026-01-01', ends_on: '2026-06-01', default_goal_hours: 10, is_active: false }, false);
    await sink.findOrCreateSeason({ name: 'existing-season', starts_on: '2026-01-01', ends_on: '2026-06-01', default_goal_hours: 10, is_active: false }, false);

    const snapshot = sink.snapshotTables();
    expect(snapshot.seasons.createdIds).toEqual(['season-id:new-season']);
  });

  it('records created team ids from a natural-key (name) upsert, not matched ones', async () => {
    const inner = makeFakeIdentifyingSink();
    const sink = new ManifestRecordingSink(inner);

    await sink.upsertTeams(
      [
        { name: 'existing-team', short_name: 'ET', program: null, color: '#fff', archived: false, sort_order: 1 },
        { name: 'new-team', short_name: 'NT', program: null, color: '#000', archived: false, sort_order: 2 },
      ],
      false,
    );

    const snapshot = sink.snapshotTables();
    expect(snapshot.teams.createdIds).toEqual(['team-id:new-team']);
  });

  it('accumulates across multiple calls to the same table', async () => {
    const inner = makeFakeIdentifyingSink();
    const sink = new ManifestRecordingSink(inner);

    await sink.upsertStudents([{ id: 'new-1', profile_id: null, display_name: 'x', team_id: 't', grad_year: null, is_active: true, goal_hours_override: null }], false);
    await sink.upsertStudents([{ id: 'new-2', profile_id: null, display_name: 'x', team_id: 't', grad_year: null, is_active: true, goal_hours_override: null }], false);

    expect(sink.snapshotTables().students.createdIds.sort()).toEqual(['new-1', 'new-2']);
  });

  it('never delegates to anything but the wrapped inner sink (behavior-preserving)', async () => {
    const inner = makeFakeIdentifyingSink();
    const sink = new ManifestRecordingSink(inner);

    const outcome = await sink.upsertStudents(
      [{ id: 'new-1', profile_id: null, display_name: 'x', team_id: 't', grad_year: null, is_active: true, goal_hours_override: null }],
      false,
    );

    // The exact same UpsertResult the inner sink produced is what callers
    // relying on NewDataSink (e.g. core.ts's per-table counts) still see.
    expect(outcome).toEqual({ createdCount: 1, updatedCount: 0, createdIds: ['new-1'] });
  });

  it('snapshotTables returns an independent copy (later mutation does not retroactively change a captured manifest)', async () => {
    const inner = makeFakeIdentifyingSink();
    const sink = new ManifestRecordingSink(inner);

    await sink.upsertStudents([{ id: 'new-1', profile_id: null, display_name: 'x', team_id: 't', grad_year: null, is_active: true, goal_hours_override: null }], false);
    const first = sink.snapshotTables();

    await sink.upsertStudents([{ id: 'new-2', profile_id: null, display_name: 'x', team_id: 't', grad_year: null, is_active: true, goal_hours_override: null }], false);

    expect(first.students.createdIds).toEqual(['new-1']);
  });
});

describe('manifest read/write never touches manifest.tables keys beyond the fixed 7', async () => {
  it('round-trip preserves exactly the 7 table keys, nothing else', async () => {
    const manifest = sampleManifest();
    const path = join(dir, 'manifest.json');
    await writeManifest(manifest, path);
    const readBack = await readManifest(path);

    expect(Object.keys(readBack.tables).sort()).toEqual(
      ['attendance', 'event_sessions', 'events', 'rsvps', 'seasons', 'students', 'teams'].sort(),
    );
  });

  it('drops an injected extra key (e.g. "profiles") rather than passing it through', async () => {
    const manifest = sampleManifest();
    const withInjectedKey = {
      ...manifest,
      tables: { ...manifest.tables, profiles: { createdIds: ['owner-account'], createdCount: 1 } },
    };
    const path = join(dir, 'injected.json');
    await writeFile(path, JSON.stringify(withInjectedKey), 'utf8');

    const readBack = await readManifest(path);

    expect(Object.keys(readBack.tables)).not.toContain('profiles');
    expect(JSON.stringify(readBack)).not.toContain('owner-account');
  });
});

// Sanity check that this file's fs helper is actually reading back what
// writeManifest wrote (guards against a future refactor of writeManifest
// silently changing its serialization without a round-trip test noticing
// via some other code path).
describe('writeManifest output shape', () => {
  it('writes pretty-printed JSON ending in a trailing newline', async () => {
    const manifest = sampleManifest();
    const path = join(dir, 'manifest.json');
    await writeManifest(manifest, path);

    const raw = await readFile(path, 'utf8');
    expect(raw.endsWith('\n')).toBe(true);
    expect(raw).toContain('\n  "schemaVersion"');
  });
});
