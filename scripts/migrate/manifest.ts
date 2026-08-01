// T063b: the migration manifest -- a record of exactly which rows a real
// (non-dry-run) migration run created in the new project, written so a
// later teardown (scripts/migrate/teardown.ts) can remove exactly those
// rows and nothing else.
//
// Why this exists (see the worker packet for the full context): the ETL is
// re-run twice -- once now, for app testing against real data, and again at
// cutover. Between the two runs the migrated data must be removable
// *without* touching the owner's own accounts (`profiles`, `guardian_links`,
// `auth.users`) or any student that already existed independently of the
// migration. A heuristic ("delete students with no account and no guardian
// link") is only safe while the old data happens to produce no accounts --
// it silently deletes real records the moment that stops being true. This
// file replaces the heuristic with a record of exactly what was written.
//
// The single most important correctness property here: a manifest MUST
// only ever contain ids for rows this run *created*. A row that already
// existed and was matched by the natural-key upsert (see dataSink.ts's
// header comment on natural keys) must never appear here, or teardown would
// delete pre-existing data the migration never owned. `ManifestRecordingSink`
// below is what enforces this -- it records only the `createdIds` that
// `scripts/migrate/dataSink.ts`'s `IdentifyingNewDataSink` variant exposes,
// never the full row list and never anything reported "matched"/"existing".
//
// `NewDataSink`'s public interface (used by core.ts and every other caller)
// only ever returns *counts* (`UpsertResult`), not which specific ids were
// created -- see dataSink.ts's T063b comment block for why that needed a
// (purely additive) change there before a manifest could be built at all.

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import type { IdentifyingNewDataSink, NewDataSink } from './dataSink.ts';
import type {
  NewAttendanceRow,
  NewEventRow,
  NewEventSessionRow,
  NewRsvpRow,
  NewSeasonUpsert,
  NewStudentRow,
  NewTeamUpsert,
} from './types.ts';

// ---------------------------------------------------------------------------
// Manifest shape
// ---------------------------------------------------------------------------

/** Per-table record: exactly the ids this run created, plus the count as an
 * explicit, redundant cross-check (a hand-inspecting human, or a future
 * schema-version reader, doesn't have to trust `createdIds.length`). */
export interface MigrationManifestTable {
  createdIds: string[];
  createdCount: number;
}

/** Table keys match the new project's actual table names (snake_case where
 * the table itself is snake_case, e.g. `event_sessions`) so teardown.ts can
 * use them directly as `.from(table)` arguments with no translation layer
 * to get wrong. */
export interface MigrationManifestTables {
  teams: MigrationManifestTable;
  seasons: MigrationManifestTable;
  students: MigrationManifestTable;
  events: MigrationManifestTable;
  event_sessions: MigrationManifestTable;
  rsvps: MigrationManifestTable;
  attendance: MigrationManifestTable;
}

/** Where the old-project data came from for this run -- part of the
 * "auditable" requirement (run timestamp, cutover date, source directory,
 * per-table id lists and counts). `--fixture` runs never reach here (they
 * never write a manifest -- see migrate.ts's CLI wiring), so this union only
 * needs to cover the two real sources. */
export type MigrationManifestSource = { kind: 'from-dir'; path: string } | { kind: 'live' };

export interface MigrationManifest {
  schemaVersion: 1;
  runAt: string; // ISO 8601 timestamp (UTC, per constitution item 14's "timestamps stored UTC" convention -- this is an operational log, not a UI display value, so no America/Chicago conversion applies).
  cutoverDate: string; // "YYYY-MM-DD", same value passed to --cutover-date
  source: MigrationManifestSource;
  newProjectUrl: string; // NEW_SUPABASE_URL this run wrote to -- teardown refuses to run against a manifest whose recorded project doesn't match its own NEW_SUPABASE_URL (guards against tearing down the wrong project).
  tables: MigrationManifestTables;
}

const MANIFEST_TABLE_NAMES = [
  'teams',
  'seasons',
  'students',
  'events',
  'event_sessions',
  'rsvps',
  'attendance',
] as const satisfies readonly (keyof MigrationManifestTables)[];

function emptyManifestTable(): MigrationManifestTable {
  return { createdIds: [], createdCount: 0 };
}

function emptyManifestTables(): MigrationManifestTables {
  return {
    teams: emptyManifestTable(),
    seasons: emptyManifestTable(),
    students: emptyManifestTable(),
    events: emptyManifestTable(),
    event_sessions: emptyManifestTable(),
    rsvps: emptyManifestTable(),
    attendance: emptyManifestTable(),
  };
}

// ---------------------------------------------------------------------------
// ManifestRecordingSink -- a NewDataSink decorator that records exactly
// what a real run creates, without changing core.ts's orchestration at all.
// core.ts (T062, not in this task's Allowed Files) only ever calls
// `sink.upsertX(rows, dryRun)` on whatever `NewDataSink`-shaped object
// migrate.ts hands it and never inspects the extra fields on the result --
// so wrapping the real sink here is enough to capture every created id
// without touching core.ts, types.ts, or fixtures.ts.
// ---------------------------------------------------------------------------

/**
 * Wraps a real `SupabaseNewDataSink` (anything satisfying both `NewDataSink`
 * and dataSink.ts's `IdentifyingNewDataSink`) and records the `createdIds`
 * each call reports. Every actual write is delegated to `inner` unchanged --
 * this class performs no I/O of its own and reimplements no upsert logic,
 * so migration behavior is identical with or without manifest recording
 * turned on. On a dry run, `inner`'s `createdIds` are already `[]` (nothing
 * was actually created -- see dataSink.ts), so recording is a no-op; callers
 * additionally must not write the resulting manifest for a dry run (T063b's
 * spec: "--dry-run must not write a manifest") -- that gate lives in
 * migrate.ts, not here, since this class has no opinion on whether it's
 * wrapping a dry or real run.
 */
export class ManifestRecordingSink implements NewDataSink {
  // `IdentifyingNewDataSink` alone (not intersected with `NewDataSink`) is
  // deliberate: every method on it already returns a WIDER type than the
  // matching `NewDataSink` method (see dataSink.ts), so anything satisfying
  // `IdentifyingNewDataSink` structurally satisfies `NewDataSink` too --
  // and typing `inner` as the intersection instead would make TypeScript
  // resolve each call against whichever member's signature the intersection
  // happens to pick first, silently narrowing `createdIds` back away.
  private readonly inner: IdentifyingNewDataSink;
  private readonly tables: MigrationManifestTables = emptyManifestTables();

  constructor(inner: IdentifyingNewDataSink) {
    this.inner = inner;
  }

  /** Everything recorded so far, deep-copied so later mutation of this
   * sink's internal state can never retroactively change a manifest object
   * a caller already captured. */
  snapshotTables(): MigrationManifestTables {
    const snapshot = emptyManifestTables();
    for (const name of MANIFEST_TABLE_NAMES) {
      snapshot[name] = { createdIds: [...this.tables[name].createdIds], createdCount: this.tables[name].createdCount };
    }
    return snapshot;
  }

  private record(table: keyof MigrationManifestTables, ids: string[]): void {
    if (ids.length === 0) {
      return;
    }
    this.tables[table].createdIds.push(...ids);
    this.tables[table].createdCount = this.tables[table].createdIds.length;
  }

  async upsertTeams(rows: NewTeamUpsert[], dryRun: boolean) {
    const outcome = await this.inner.upsertTeams(rows, dryRun);
    this.record('teams', outcome.createdIds);
    return outcome;
  }

  async findOrCreateSeason(row: NewSeasonUpsert, dryRun: boolean): Promise<{ id: string; created: boolean }> {
    const outcome = await this.inner.findOrCreateSeason(row, dryRun);
    if (outcome.created) {
      this.record('seasons', [outcome.id]);
    }
    return outcome;
  }

  async upsertStudents(rows: NewStudentRow[], dryRun: boolean) {
    const outcome = await this.inner.upsertStudents(rows, dryRun);
    this.record('students', outcome.createdIds);
    return outcome;
  }

  async upsertEvents(rows: NewEventRow[], dryRun: boolean) {
    const outcome = await this.inner.upsertEvents(rows, dryRun);
    this.record('events', outcome.createdIds);
    return outcome;
  }

  async upsertEventSessions(rows: NewEventSessionRow[], dryRun: boolean) {
    const outcome = await this.inner.upsertEventSessions(rows, dryRun);
    this.record('event_sessions', outcome.createdIds);
    return outcome;
  }

  async upsertRsvps(rows: NewRsvpRow[], dryRun: boolean) {
    const outcome = await this.inner.upsertRsvps(rows, dryRun);
    this.record('rsvps', outcome.createdIds);
    return outcome;
  }

  async upsertAttendance(rows: NewAttendanceRow[], dryRun: boolean) {
    const outcome = await this.inner.upsertAttendance(rows, dryRun);
    this.record('attendance', outcome.createdIds);
    return outcome;
  }
}

// ---------------------------------------------------------------------------
// Building, writing, and reading manifests
// ---------------------------------------------------------------------------

export function buildManifest(params: {
  runAt: Date;
  cutoverDate: string;
  source: MigrationManifestSource;
  newProjectUrl: string;
  tables: MigrationManifestTables;
}): MigrationManifest {
  return {
    schemaVersion: 1,
    runAt: params.runAt.toISOString(),
    cutoverDate: params.cutoverDate,
    source: params.source,
    newProjectUrl: params.newProjectUrl,
    tables: params.tables,
  };
}

/** Sensible default path when `--manifest-out` is not given: a real run must
 * never complete without leaving a record of what it did, so this is what
 * gets used (and the CLI prints it) rather than silently skipping the
 * write. Timestamp is sanitized for filesystem-safety (`:` is not always
 * safe in a filename); the manifest's own `runAt` field keeps the exact ISO
 * value. */
export function defaultManifestPath(runAt: Date): string {
  const sanitized = runAt.toISOString().replace(/[:.]/g, '-');
  return `docs/migration/manifests/migration-manifest-${sanitized}.json`;
}

/** Writes `manifest` as pretty-printed JSON to `path`, creating any missing
 * parent directories. Never called for a dry run -- see this file's header
 * comment and migrate.ts's CLI wiring, which is the sole gate on that. */
export async function writeManifest(manifest: MigrationManifest, path: string): Promise<void> {
  const dir = dirname(path);
  if (dir && dir !== '.') {
    await mkdir(dir, { recursive: true });
  }
  await writeFile(path, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
}

export class ManifestValidationError extends Error {}

/**
 * Reads and validates a manifest written by `writeManifest`. Throws
 * `ManifestValidationError` with a clear, specific reason for every way this
 * can go wrong -- missing file, empty file, invalid JSON, or valid JSON
 * missing/mistyping a required field -- rather than ever returning a
 * partially-trusted object. Teardown depends on this validation running
 * before it issues a single delete: a malformed manifest must never reach
 * teardown's delete loop.
 */
export async function readManifest(path: string): Promise<MigrationManifest> {
  let raw: string;
  try {
    raw = await readFile(path, 'utf8');
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    throw new ManifestValidationError(`Manifest: failed to read ${path}: ${reason}`);
  }

  if (raw.trim().length === 0) {
    throw new ManifestValidationError(`Manifest: ${path} is empty`);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    throw new ManifestValidationError(`Manifest: ${path} is not valid JSON: ${reason}`);
  }

  return validateManifestShape(parsed, path);
}

function validateManifestShape(value: unknown, path: string): MigrationManifest {
  if (typeof value !== 'object' || value === null) {
    throw new ManifestValidationError(`Manifest: ${path} must contain a JSON object, got ${typeof value}`);
  }
  const obj = value as Record<string, unknown>;

  if (obj.schemaVersion !== 1) {
    throw new ManifestValidationError(
      `Manifest: ${path} has unsupported or missing schemaVersion (expected 1, got ${JSON.stringify(obj.schemaVersion)})`,
    );
  }
  if (typeof obj.runAt !== 'string' || obj.runAt.length === 0) {
    throw new ManifestValidationError(`Manifest: ${path} is missing a valid "runAt" timestamp`);
  }
  if (typeof obj.cutoverDate !== 'string' || obj.cutoverDate.length === 0) {
    throw new ManifestValidationError(`Manifest: ${path} is missing a valid "cutoverDate"`);
  }
  if (typeof obj.newProjectUrl !== 'string' || obj.newProjectUrl.length === 0) {
    throw new ManifestValidationError(`Manifest: ${path} is missing a valid "newProjectUrl"`);
  }
  if (typeof obj.source !== 'object' || obj.source === null) {
    throw new ManifestValidationError(`Manifest: ${path} is missing a valid "source"`);
  }
  const source = obj.source as Record<string, unknown>;
  if (source.kind !== 'from-dir' && source.kind !== 'live') {
    throw new ManifestValidationError(
      `Manifest: ${path} has an unrecognized "source.kind" (expected "from-dir" or "live", got ${JSON.stringify(source.kind)})`,
    );
  }
  if (source.kind === 'from-dir' && (typeof source.path !== 'string' || source.path.length === 0)) {
    throw new ManifestValidationError(`Manifest: ${path} has source.kind="from-dir" but no valid "source.path"`);
  }

  if (typeof obj.tables !== 'object' || obj.tables === null) {
    throw new ManifestValidationError(`Manifest: ${path} is missing a valid "tables" object`);
  }
  const tablesObj = obj.tables as Record<string, unknown>;
  const tables = emptyManifestTables();
  for (const name of MANIFEST_TABLE_NAMES) {
    const entry = tablesObj[name];
    if (typeof entry !== 'object' || entry === null) {
      throw new ManifestValidationError(`Manifest: ${path} is missing a valid "tables.${name}" entry`);
    }
    const entryObj = entry as Record<string, unknown>;
    if (!Array.isArray(entryObj.createdIds) || !entryObj.createdIds.every((id) => typeof id === 'string')) {
      throw new ManifestValidationError(`Manifest: ${path} has a non-string-array "tables.${name}.createdIds"`);
    }
    if (typeof entryObj.createdCount !== 'number' || entryObj.createdCount !== entryObj.createdIds.length) {
      throw new ManifestValidationError(
        `Manifest: ${path} has "tables.${name}.createdCount" that doesn't match createdIds.length -- refusing a manifest that may have been hand-edited or truncated`,
      );
    }
    tables[name] = { createdIds: [...entryObj.createdIds], createdCount: entryObj.createdCount };
  }

  return {
    schemaVersion: 1,
    runAt: obj.runAt,
    cutoverDate: obj.cutoverDate,
    newProjectUrl: obj.newProjectUrl,
    source: source as MigrationManifestSource,
    tables,
  };
}
