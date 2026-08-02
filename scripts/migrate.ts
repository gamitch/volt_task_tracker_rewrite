// T062 (MIG-03): idempotent ETL script -- reads from the old (Lovable
// Cloud) Supabase project and writes to the new project, using
// service-role keys for both (env-provided, NEVER committed), natural-key
// upserts, and a `--dry-run` mode that writes nothing and prints per-table
// counts plus the migration report (unmatched teams, unparseable times,
// attendees-backfill mismatches).
//
// Column mapping: docs/migration/mapping.md (verbatim copy of PRD Section
// 10.2 -- authoritative; this script's transform logic in
// scripts/migrate/transform.ts is cross-checked against it row-by-row in
// the worker report for this task).
//
// Required environment variables (values are NEVER hardcoded here -- see
// scripts/migrate/env.ts):
//   OLD_SUPABASE_URL       -- old (Lovable Cloud) Supabase project URL.
//   OLD_SERVICE_ROLE_KEY   -- old project service-role key (read-only use;
//                             this script never writes to the old project).
//   NEW_SUPABASE_URL       -- new (rewrite) Supabase project URL.
//   NEW_SERVICE_ROLE_KEY   -- new project service-role key.
// (OLD_SUPABASE_URL / OLD_SERVICE_ROLE_KEY names are as already documented
// in docs/swarm/COWORK-HANDOFF.md; NEW_SUPABASE_URL / NEW_SERVICE_ROLE_KEY
// follow the same naming convention for the write target -- not previously
// named anywhere else in the repo, flagged as a naming choice in the
// worker report.)
//
// External Blocker (see docs/migration/source-schema.md -- cited, not
// re-investigated here): no live old-project connection is reachable in
// this sandbox, so a genuine live dry-run against real old-project data is
// not possible in this environment. `--fixture` mode below runs this exact
// script's logic against fabricated fixture data
// (scripts/migrate/fixtures.ts, fictional names only per constitution item
// 6) instead of a live Supabase connection, so the transform/validation/
// reporting code path can be demonstrated end-to-end while that blocker
// remains open.
//
// Usage:
//   node --experimental-strip-types scripts/migrate.ts --dry-run --cutover-date=2026-07-19
//   node --experimental-strip-types scripts/migrate.ts --cutover-date=2026-07-19   (real run)
//   node --experimental-strip-types scripts/migrate.ts --dry-run --fixture --cutover-date=2026-02-01
//     (fabricated-fixture demo -- no env vars / network required)
//   node --experimental-strip-types scripts/migrate.ts --dry-run --from-dir=/path/to/export --cutover-date=2026-07-19
//     (T063/MIG-04: real old-project data read from George's Lovable Cloud SQL-editor
//     JSON export directory instead of a live connection -- no env vars required)
//   node --experimental-strip-types scripts/migrate.ts --from-dir=/path/to/export --cutover-date=2026-07-19 --manifest-out=/tmp/manifest.json
//     (real run -- writes a manifest recording exactly what was created; see
//     scripts/migrate/manifest.ts. --manifest-out is optional -- a sensible
//     default path is used and printed if omitted. A real run never
//     completes without leaving a manifest behind.)
//   node --experimental-strip-types scripts/migrate.ts --teardown=/tmp/manifest.json --dry-run
//     (T063b: manifest-driven teardown -- deletes exactly the ids the named
//     manifest recorded, in FK-safe order, never touching profiles/
//     guardian_links/auth.users. --dry-run previews without deleting.
//     Requires NEW_SUPABASE_URL / NEW_SERVICE_ROLE_KEY, same as a real
//     migration run. See scripts/migrate/teardown.ts.)

declare const process: {
  env: Record<string, string | undefined>;
  argv: string[];
  exit: (code?: number) => never;
};

import { runMigration, AttendeesBackfillAssertionError } from './migrate/core.ts';
import { printReport } from './migrate/report.ts';
import { loadNewSupabaseEnv, loadOldSupabaseEnv, redactSecret, MissingEnvError } from './migrate/env.ts';
import { SupabaseOldDataSource } from './migrate/dataSource.ts';
import { SupabaseNewDataSink } from './migrate/dataSink.ts';
import { FixtureOldDataSource, InMemoryNewDataSink } from './migrate/fixtures.ts';
import { JsonFileOldDataSource } from './migrate/jsonFileSource.ts';
import {
  ManifestRecordingSink,
  buildManifest,
  defaultManifestPath,
  writeManifest,
  ManifestValidationError,
} from './migrate/manifest.ts';
import { performTeardown, TeardownProjectMismatchError } from './migrate/teardown.ts';
import type { OldDataSource } from './migrate/dataSource.ts';
import type { NewDataSink } from './migrate/dataSink.ts';
import type { MigrationManifestSource } from './migrate/manifest.ts';
import type { MigrationOptions } from './migrate/types.ts';

interface CliArgs {
  dryRun: boolean;
  fixture: boolean;
  fromDir: string | null;
  cutoverDate: string | null;
  manifestOut: string | null;
  teardown: string | null;
  help: boolean;
}

function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = {
    dryRun: false,
    fixture: false,
    fromDir: null,
    cutoverDate: null,
    manifestOut: null,
    teardown: null,
    help: false,
  };
  for (const arg of argv) {
    if (arg === '--dry-run') {
      args.dryRun = true;
    } else if (arg === '--fixture') {
      args.fixture = true;
    } else if (arg === '--help' || arg === '-h') {
      args.help = true;
    } else if (arg.startsWith('--cutover-date=')) {
      args.cutoverDate = arg.slice('--cutover-date='.length);
    } else if (arg.startsWith('--from-dir=')) {
      args.fromDir = arg.slice('--from-dir='.length);
    } else if (arg.startsWith('--manifest-out=')) {
      args.manifestOut = arg.slice('--manifest-out='.length);
    } else if (arg.startsWith('--teardown=')) {
      args.teardown = arg.slice('--teardown='.length);
    }
  }
  return args;
}

function printHelp(): void {
  console.log(
    [
      'Usage: node --experimental-strip-types scripts/migrate.ts [options]',
      '',
      'Options:',
      '  --dry-run                Write nothing; print per-table counts + migration report.',
      '  --fixture                Use fabricated fixture data instead of a live Supabase',
      '                           connection (see External Blocker in the worker packet --',
      '                           no live old-project connection is reachable in this',
      '                           sandbox). Implies no env vars are required.',
      '  --from-dir=<path>        Read old-project tables from a directory of exported JSON',
      '                           files (teams.json, students.json, events.json,',
      '                           event_sessions.json, session_attendance.json,',
      '                           app_settings.json) instead of a live old-project Supabase',
      '                           connection -- the old project (Lovable Cloud) has no',
      '                           service-role key to obtain, so this is the real MIG-04',
      '                           path, not a demo. Mutually exclusive with --fixture. Does',
      '                           not require OLD_SUPABASE_URL / OLD_SERVICE_ROLE_KEY;',
      '                           combined with --dry-run, no env vars are required at all.',
      '  --cutover-date=YYYY-MM-DD  Required (unless --teardown is given). Wall-clock',
      '                           America/Chicago cutover date used for the',
      '                           event_sessions.status rule (mapping.md).',
      '  --manifest-out=<path>    Where to write the manifest recording exactly which rows',
      '                           this real (non-dry-run) run created. Optional -- if',
      '                           omitted, a real run writes to a sensible default path and',
      '                           prints it. Never written on --dry-run (nothing was',
      '                           created). See scripts/migrate/manifest.ts.',
      '  --teardown=<path>        Manifest-driven teardown instead of a migration run:',
      '                           deletes exactly the ids the named manifest recorded, in',
      '                           FK-safe order, never touching profiles/guardian_links/',
      '                           auth.users. Mutually exclusive with --fixture/--from-dir/',
      '                           --cutover-date. Requires NEW_SUPABASE_URL /',
      '                           NEW_SERVICE_ROLE_KEY. Combine with --dry-run to preview',
      '                           without deleting. See scripts/migrate/teardown.ts.',
      '  --help, -h               Print this message.',
    ].join('\n'),
  );
}

const CUTOVER_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    printHelp();
    return;
  }

  // --teardown short-circuits everything else: it is not a migration run
  // (no old-project source, no cutover date, no --fixture/--from-dir) --
  // see scripts/migrate/teardown.ts.
  if (args.teardown) {
    if (args.fixture || args.fromDir || args.cutoverDate) {
      console.log(
        'Error: --teardown is mutually exclusive with --fixture / --from-dir / --cutover-date -- ' +
          'it does not run a migration.',
      );
      printHelp();
      process.exit(1);
    }
    try {
      await performTeardown(args.teardown, args.dryRun);
    } catch (err) {
      if (
        err instanceof MissingEnvError ||
        err instanceof ManifestValidationError ||
        err instanceof TeardownProjectMismatchError
      ) {
        console.log(`Error: ${err.message}`);
        process.exit(1);
      }
      throw err;
    }
    return;
  }

  if (!args.cutoverDate || !CUTOVER_DATE_PATTERN.test(args.cutoverDate)) {
    console.log('Error: --cutover-date=YYYY-MM-DD is required (see mapping.md\'s event_sessions.status rule).');
    printHelp();
    process.exit(1);
  }

  if (args.fixture && args.fromDir) {
    console.log('Error: --fixture and --from-dir are mutually exclusive -- pick one old-project source.');
    printHelp();
    process.exit(1);
  }

  const options: MigrationOptions = {
    dryRun: args.dryRun,
    cutoverDate: args.cutoverDate,
    timeZone: 'America/Chicago',
  };

  let source: OldDataSource;
  let sink: NewDataSink;
  // Set only when `sink` is a real SupabaseNewDataSink wrapped for manifest
  // recording (never for --fixture, never for a dry-run --from-dir, both of
  // which use the in-memory sink and never touch the real project) -- see
  // this function's post-runMigration manifest-write step below.
  let manifestSink: ManifestRecordingSink | null = null;
  let manifestSource: MigrationManifestSource | null = null;
  let manifestNewProjectUrl: string | null = null;

  if (args.fixture) {
    console.log(
      [
        '*'.repeat(72),
        '* FIXTURE MODE',
        '* This is fixture-driven verification against fabricated data',
        '* (scripts/migrate/fixtures.ts, fictional names only), NOT a real',
        '* old-project dry run. No live connection to the old Lovable Cloud',
        '* Supabase project is reachable in this sandbox -- see',
        '* docs/migration/source-schema.md for the exhaustive record of what',
        '* was checked (env vars, local files, GitHub access, network',
        '* reachability). The genuine MIG-03 acceptance criterion (a real',
        '* dry-run report against the actual old project) remains blocked on',
        '* George supplying OLD_SUPABASE_URL / OLD_SERVICE_ROLE_KEY -- same',
        '* unblock path T061 already documented.',
        '*'.repeat(72),
      ].join('\n'),
    );
    source = new FixtureOldDataSource();
    sink = new InMemoryNewDataSink();
  } else if (args.fromDir) {
    console.log(
      [
        '*'.repeat(72),
        '* FILE MODE',
        `* Reading old-project tables from ${args.fromDir} (George's Lovable Cloud SQL-editor`,
        '* export -- see this task\'s worker report). OLD_SUPABASE_URL /',
        '* OLD_SERVICE_ROLE_KEY are not required: the old project has no service-role key',
        '* to obtain (Lovable Cloud keeps Postgres inside its own platform), so this file',
        '* is the real MIG-04 source, not a stand-in for a live connection.',
        '*'.repeat(72),
      ].join('\n'),
    );
    source = new JsonFileOldDataSource(args.fromDir);
    if (args.dryRun) {
      // Dry-run + --from-dir must require no env vars at all (this task's
      // spec) -- the in-memory sink already used by --fixture mode gives an
      // accurate created-vs-existing preview against an as-yet-unmigrated
      // new project without a live NEW_SUPABASE_URL / NEW_SERVICE_ROLE_KEY
      // connection. A real (non-dry-run) --from-dir run still writes to the
      // real new project below and so still needs those two env vars.
      sink = new InMemoryNewDataSink();
    } else {
      try {
        const newEnv = loadNewSupabaseEnv();
        console.log(`Connecting to new project ${newEnv.url} (key ${redactSecret(newEnv.serviceRoleKey)})`);
        const recordingSink = new ManifestRecordingSink(new SupabaseNewDataSink(newEnv));
        sink = recordingSink;
        manifestSink = recordingSink;
        manifestSource = { kind: 'from-dir', path: args.fromDir };
        manifestNewProjectUrl = newEnv.url;
      } catch (err) {
        if (err instanceof MissingEnvError) {
          console.log(`Error: ${err.message}`);
          process.exit(1);
        }
        throw err;
      }
    }
  } else {
    try {
      const oldEnv = loadOldSupabaseEnv();
      const newEnv = loadNewSupabaseEnv();
      console.log(
        `Connecting to old project ${oldEnv.url} (key ${redactSecret(oldEnv.serviceRoleKey)}) and new project ${newEnv.url} (key ${redactSecret(newEnv.serviceRoleKey)})`,
      );
      source = new SupabaseOldDataSource(oldEnv);
      // Wrapped for manifest recording even on a live dry run (this branch
      // is the only one that reuses the same SupabaseNewDataSink for both
      // modes) -- harmless, since ManifestRecordingSink only ever records
      // what its inner sink reports as created, which dataSink.ts already
      // makes `[]` on a dry run. The manifest is only ever WRITTEN below
      // when `!options.dryRun`.
      const recordingSink = new ManifestRecordingSink(new SupabaseNewDataSink(newEnv));
      sink = recordingSink;
      manifestSink = recordingSink;
      manifestSource = { kind: 'live' };
      manifestNewProjectUrl = newEnv.url;
    } catch (err) {
      if (err instanceof MissingEnvError) {
        console.log(`Error: ${err.message}`);
        console.log(
          'No live old-project connection is available in this sandbox -- see docs/migration/source-schema.md. ' +
            'Use --fixture for an offline structural/idempotency demonstration instead.',
        );
        process.exit(1);
      }
      throw err;
    }
  }

  try {
    const report = await runMigration(source, sink, options);
    printReport(report);
    if (!options.dryRun) {
      console.log('Real run complete. Rows above were written to the new project.');
      // A real migration run must never complete without leaving a record
      // of what it did (this task's spec) -- write a manifest whenever the
      // sink actually reached the real project (never for --fixture, never
      // for a dry-run --from-dir -- both stay on the in-memory sink and
      // never set `manifestSink`).
      if (manifestSink && manifestSource && manifestNewProjectUrl) {
        const runAt = new Date();
        const manifest = buildManifest({
          runAt,
          cutoverDate: options.cutoverDate,
          source: manifestSource,
          newProjectUrl: manifestNewProjectUrl,
          tables: manifestSink.snapshotTables(),
        });
        const manifestPath = args.manifestOut ?? defaultManifestPath(runAt);
        await writeManifest(manifest, manifestPath);
        console.log(`Manifest written: ${manifestPath}`);
      }
    }
  } catch (err) {
    if (err instanceof AttendeesBackfillAssertionError) {
      console.log(`Error: ${err.message}`);
      for (const mismatch of err.mismatches) {
        console.log(`  event old_id=${mismatch.eventOldId} missing student_id=${mismatch.missingStudentId}`);
      }
      process.exit(1);
    }
    throw err;
  }
}

await main();
