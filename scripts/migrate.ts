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
import type { OldDataSource } from './migrate/dataSource.ts';
import type { NewDataSink } from './migrate/dataSink.ts';
import type { MigrationOptions } from './migrate/types.ts';

interface CliArgs {
  dryRun: boolean;
  fixture: boolean;
  cutoverDate: string | null;
  help: boolean;
}

function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = { dryRun: false, fixture: false, cutoverDate: null, help: false };
  for (const arg of argv) {
    if (arg === '--dry-run') {
      args.dryRun = true;
    } else if (arg === '--fixture') {
      args.fixture = true;
    } else if (arg === '--help' || arg === '-h') {
      args.help = true;
    } else if (arg.startsWith('--cutover-date=')) {
      args.cutoverDate = arg.slice('--cutover-date='.length);
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
      '  --cutover-date=YYYY-MM-DD  Required. Wall-clock America/Chicago cutover date used',
      '                           for the event_sessions.status rule (mapping.md).',
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

  if (!args.cutoverDate || !CUTOVER_DATE_PATTERN.test(args.cutoverDate)) {
    console.log('Error: --cutover-date=YYYY-MM-DD is required (see mapping.md\'s event_sessions.status rule).');
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
  } else {
    try {
      const oldEnv = loadOldSupabaseEnv();
      const newEnv = loadNewSupabaseEnv();
      console.log(
        `Connecting to old project ${oldEnv.url} (key ${redactSecret(oldEnv.serviceRoleKey)}) and new project ${newEnv.url} (key ${redactSecret(newEnv.serviceRoleKey)})`,
      );
      source = new SupabaseOldDataSource(oldEnv);
      sink = new SupabaseNewDataSink(newEnv);
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
