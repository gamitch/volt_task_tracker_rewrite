// T063 (MIG-04): JSON-file old-data source. T062's SupabaseOldDataSource
// remains permanently blocked -- the old project lives on Lovable Cloud,
// which keeps Postgres inside its own platform with no service-role key
// ever exposed (confirmed with George directly, not a temporary credential
// gap). George instead exported each old table from Lovable's SQL editor
// with `select json_agg(row_to_json(t)) from <table> t` -- one JSON array
// file per table -- and this class reads those files directly so the rest
// of the ETL (scripts/migrate/core.ts, transform.ts) can run unmodified
// against real old-project data. Wired to the `--from-dir=<path>` CLI flag
// in scripts/migrate.ts, mutually exclusive with `--fixture`.
//
// Same contract as SupabaseOldDataSource: every row is returned exactly as
// read from disk, with zero coercion or reshaping -- the transform layer
// owns all mapping (see dataSource.ts's own header comment on this). The
// only work this file does beyond "read and parse" is validation: a
// missing, unreadable, non-array, or (for app_settings) not-exactly-one-row
// file must fail loudly and name the exact file and problem. A silent empty
// array here is the worst possible outcome -- it would let the ETL run to
// completion and print a clean-looking report that migrated nothing.
//
// Read-only, same as SupabaseOldDataSource: nothing below ever writes to
// `dir`.

import { readFile } from 'node:fs/promises';
import type { OldDataSource } from './dataSource.ts';
import type {
  OldAppSettings,
  OldEvent,
  OldEventSession,
  OldSessionAttendance,
  OldStudent,
  OldTeam,
} from './types.ts';

function joinPath(dir: string, fileName: string): string {
  return dir.endsWith('/') ? `${dir}${fileName}` : `${dir}/${fileName}`;
}

/**
 * Reads `<dir>/<fileName>`, parses it as JSON, and confirms the result is
 * an array -- the shape `select json_agg(row_to_json(t)) from <table> t`
 * produces. Throws a clear, file-path-named error for every way this can go
 * wrong (missing file, unreadable file, invalid JSON, JSON that parses but
 * isn't an array) rather than ever falling back to an empty array.
 */
async function readJsonArrayFile(dir: string, fileName: string): Promise<unknown[]> {
  const path = joinPath(dir, fileName);
  let raw: string;
  try {
    raw = await readFile(path, 'utf8');
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    throw new Error(`Old project (--from-dir): failed to read ${path}: ${reason}`);
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    throw new Error(`Old project (--from-dir): ${path} is not valid JSON: ${reason}`);
  }
  if (!Array.isArray(parsed)) {
    throw new Error(
      `Old project (--from-dir): ${path} must contain a JSON array (the output of ` +
        `"select json_agg(row_to_json(t)) from <table> t"), got ${typeof parsed} instead`,
    );
  }
  return parsed;
}

/**
 * Old-project data source backed by a directory of one exported-table JSON
 * file each (see this file's header comment for the exact export shape),
 * used in place of SupabaseOldDataSource when no live old-project
 * connection is reachable. Every method below is a pure file read -- no
 * method issues a write against `dir`, matching SupabaseOldDataSource's
 * read-only contract (constitution item 16).
 */
export class JsonFileOldDataSource implements OldDataSource {
  private readonly dir: string;

  constructor(dir: string) {
    this.dir = dir;
  }

  async listTeams(): Promise<OldTeam[]> {
    return (await readJsonArrayFile(this.dir, 'teams.json')) as unknown as OldTeam[];
  }

  async listStudents(): Promise<OldStudent[]> {
    return (await readJsonArrayFile(this.dir, 'students.json')) as unknown as OldStudent[];
  }

  async listEvents(): Promise<OldEvent[]> {
    return (await readJsonArrayFile(this.dir, 'events.json')) as unknown as OldEvent[];
  }

  async listEventSessions(): Promise<OldEventSession[]> {
    return (await readJsonArrayFile(this.dir, 'event_sessions.json')) as unknown as OldEventSession[];
  }

  async listSessionAttendance(): Promise<OldSessionAttendance[]> {
    return (await readJsonArrayFile(
      this.dir,
      'session_attendance.json',
    )) as unknown as OldSessionAttendance[];
  }

  async getAppSettings(): Promise<OldAppSettings> {
    const fileName = 'app_settings.json';
    const rows = await readJsonArrayFile(this.dir, fileName);
    if (rows.length !== 1) {
      throw new Error(
        `Old project (--from-dir): ${joinPath(this.dir, fileName)} must contain exactly one row ` +
          `(app_settings is a singleton table), got ${rows.length}`,
      );
    }
    return rows[0] as unknown as OldAppSettings;
  }
}
