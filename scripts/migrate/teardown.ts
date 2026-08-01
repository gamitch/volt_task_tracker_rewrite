// T063b: manifest-driven teardown for the migration ETL. Deletes exactly
// the rows a real migration run recorded as *created* (scripts/migrate/
// manifest.ts), in an order that respects the new schema's foreign keys,
// and nothing else.
//
// Why this exists instead of the interim SQL rule (kept, unmodified,
// wherever it's documented -- this file does not replace it, it adds the
// durable mechanism the interim rule was always a stand-in for): "delete
// students with no account and no guardian link" is correct only because
// today's old-project data has no emails, so the ETL creates no accounts
// and no guardian links. It stops being safe the moment a real student
// exists without an account of their own -- a normal, expected state -- at
// which point it silently deletes real records. This file replaces the
// heuristic with knowledge: the manifest says exactly what the migration
// wrote, and teardown deletes exactly that.
//
// Structural safety guard (not a convention -- see TEARDOWN_TABLE_ORDER
// below): `profiles`, `guardian_links`, and `auth.users` hold the owner's
// own accounts (including the "Test student" account he uses to test a
// parent with multiple students) and are never touched here under any
// circumstances. `TeardownTableName` is a closed 7-name literal union that
// does not include them, every delete call is typed against that union, and
// the iteration loop below walks a fixed literal array rather than
// `Object.keys(manifest.tables)` -- so even a hand-edited manifest file that
// somehow contains a "profiles" key is never read (see teardown.test.ts's
// "ignores an injected profiles key" case, which proves this by adversarial
// input rather than by inspection).

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { loadNewSupabaseEnv, redactSecret } from './env.ts';
import { readManifest } from './manifest.ts';
import type { MigrationManifest, MigrationManifestTables } from './manifest.ts';

/**
 * Delete order, children before parents, derived directly from the FK
 * graph in supabase/migrations/20260716000000_identity_roster.sql and
 * 20260717000000_scheduling_attendance.sql (all FKs in that batch are
 * `on delete restrict` except event_sessions.event_id, so a parent row
 * cannot be deleted while a child still references it):
 *   attendance, rsvps       -> reference event_sessions AND students
 *   event_sessions          -> references events
 *   events                  -> references seasons
 *   students                -> references teams
 *   seasons, teams          -> no dependency on anything else in this list
 * `profiles`, `guardian_links`, and `auth.users` are deliberately absent --
 * see this file's header comment. This is a `const` literal, not derived
 * from the manifest's own keys, precisely so nothing else can extend it.
 */
export const TEARDOWN_TABLE_ORDER = [
  'attendance',
  'rsvps',
  'event_sessions',
  'events',
  'students',
  'seasons',
  'teams',
] as const satisfies readonly (keyof MigrationManifestTables)[];

export type TeardownTableName = (typeof TEARDOWN_TABLE_ORDER)[number];

export interface TeardownTableOutcome {
  table: TeardownTableName;
  /** Ids the manifest says this run created. */
  requestedIds: string[];
  /** Of `requestedIds`, the ones that currently exist in the new project --
   * i.e. what this invocation will delete (dry run) or did delete (real
   * run). */
  foundIds: string[];
  /** Of `requestedIds`, the ones that do NOT currently exist -- already
   * removed by a prior teardown run. Reported, not treated as an error:
   * re-running teardown against the same manifest must be safe. */
  alreadyGoneIds: string[];
  /** Ids actually deleted THIS invocation. Always `[]` when `dryRun`. */
  deletedIds: string[];
}

export interface TeardownResult {
  dryRun: boolean;
  outcomes: TeardownTableOutcome[];
}

export class TeardownProjectMismatchError extends Error {}

/**
 * Runs teardown against `manifest` using `client`. Read-then-maybe-delete,
 * same shape as dataSink.ts's dry-run convention: the existence check
 * (`foundIds` / `alreadyGoneIds`) always runs, in both modes; only the
 * actual `delete()` call is skipped when `dryRun` is true. This is what
 * makes `--dry-run --teardown=<path>` show an accurate preview, and what
 * makes a second real run against an already-torn-down manifest report
 * "already gone" instead of erroring.
 *
 * Iterates `TEARDOWN_TABLE_ORDER` -- a fixed 7-name literal, never
 * `Object.keys(manifest.tables)` -- so a manifest carrying extra keys
 * (however they got there) can never cause a delete against a table this
 * function doesn't already know about by name.
 */
export async function runTeardown(
  client: SupabaseClient,
  manifest: MigrationManifest,
  dryRun: boolean,
): Promise<TeardownResult> {
  const outcomes: TeardownTableOutcome[] = [];

  for (const table of TEARDOWN_TABLE_ORDER) {
    const requestedIds = manifest.tables[table].createdIds;
    if (requestedIds.length === 0) {
      outcomes.push({ table, requestedIds: [], foundIds: [], alreadyGoneIds: [], deletedIds: [] });
      continue;
    }

    const { data: existingRows, error: selectError } = await client
      .from(table)
      .select('id')
      .in('id', requestedIds);
    if (selectError) {
      throw new Error(`Teardown: failed to read existing ${table} rows: ${selectError.message}`);
    }
    const foundSet = new Set((existingRows ?? []).map((r) => (r as { id: string }).id));
    const foundIds = requestedIds.filter((id) => foundSet.has(id));
    const alreadyGoneIds = requestedIds.filter((id) => !foundSet.has(id));

    let deletedIds: string[] = [];
    if (!dryRun && foundIds.length > 0) {
      const { error: deleteError } = await client.from(table).delete().in('id', foundIds);
      if (deleteError) {
        throw new Error(`Teardown: failed to delete ${table} rows: ${deleteError.message}`);
      }
      deletedIds = foundIds;
    }

    outcomes.push({ table, requestedIds, foundIds, alreadyGoneIds, deletedIds });
  }

  return { dryRun, outcomes };
}

/** Human-readable summary, printed both before anything is deleted (so a
 * `--dry-run --teardown=` preview is meaningful) and after a real run
 * completes. No display names are ever available here (the manifest only
 * ever holds opaque ids -- constitution item 6), so, matching report.ts's
 * convention, this only ever prints ids, never anything PII-shaped. */
export function printTeardownSummary(manifestPath: string, result: TeardownResult): void {
  const mode = result.dryRun ? 'DRY RUN (nothing deleted)' : 'REAL RUN (deleted)';
  const lines: string[] = [];
  lines.push('='.repeat(72));
  lines.push(`VOLT migration teardown -- ${mode}`);
  lines.push(`Manifest: ${manifestPath}`);
  lines.push('='.repeat(72));
  lines.push('');
  for (const outcome of result.outcomes) {
    const verb = result.dryRun ? 'would delete' : 'deleted';
    lines.push(
      `  ${outcome.table.padEnd(15)}: ${outcome.requestedIds.length} in manifest, ` +
        `${outcome.alreadyGoneIds.length} already gone, ${verb} ${
          result.dryRun ? outcome.foundIds.length : outcome.deletedIds.length
        }`,
    );
  }
  lines.push('');
  lines.push('='.repeat(72));
  console.log(lines.join('\n'));
}

/**
 * CLI-level orchestration: read + validate the manifest, load the new
 * project's env vars (same `NEW_SUPABASE_URL` / `NEW_SERVICE_ROLE_KEY` a
 * real migration run needs -- fails clearly, via `MissingEnvError`, if
 * they're absent), refuse to proceed if the manifest was written against a
 * different project than the one this invocation is configured for, then
 * run and print the summary. Manifest validation happens before any network
 * call, so a malformed/empty manifest is rejected without needing env vars
 * or a live connection at all.
 */
export async function performTeardown(manifestPath: string, dryRun: boolean): Promise<TeardownResult> {
  const manifest = await readManifest(manifestPath);

  const env = loadNewSupabaseEnv();
  if (env.url !== manifest.newProjectUrl) {
    throw new TeardownProjectMismatchError(
      `Teardown: manifest ${manifestPath} was written against ${manifest.newProjectUrl}, but NEW_SUPABASE_URL ` +
        `is currently ${env.url} -- refusing to run teardown against a different project than the manifest ` +
        `describes.`,
    );
  }
  console.log(`Tearing down against ${env.url} (key ${redactSecret(env.serviceRoleKey)})`);

  const client = createClient(env.url, env.serviceRoleKey, { auth: { persistSession: false } });
  const result = await runTeardown(client, manifest, dryRun);
  printTeardownSummary(manifestPath, result);
  return result;
}
