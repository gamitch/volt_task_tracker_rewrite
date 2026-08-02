// T062 (MIG-03): the new-project write target interface + a Supabase-backed
// implementation. Known Context/Traps #5 ("--dry-run must write nothing"):
// every method below takes a `dryRun` flag and is structured so the *read*
// (existence-check) half always runs identically in both modes -- only the
// trailing insert/upsert call is skipped when `dryRun` is true. This is
// what lets dry-run print an accurate created-vs-existing preview without
// ever calling insert/update/upsert against the new project.
//
// Natural-key / upsert strategy (see also types.ts doc comments and the
// worker report's dedicated section):
//   - teams   : natural key = `name` (unique in both schemas) -- upsert
//               onConflict('name'), `id` never included in the payload so
//               an existing team's primary key is never rewritten.
//   - seasons : no unique constraint on `name` in the new schema -- explicit
//               select-by-name-then-insert-if-missing (Known Context/Traps #6).
//   - students, events, event_sessions : no natural-key unique constraint
//               in the new schema -- idempotency comes from a deterministic
//               UUIDv5 derived from the old row's id (scripts/migrate/uuid.ts),
//               upserted onConflict('id').
//   - rsvps, attendance : natural key = (session_id, student_id), which the
//               new schema already enforces via a unique constraint --
//               upsert onConflict('session_id,student_id').

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { SupabaseProjectEnv } from './env.ts';
import type {
  NewAttendanceRow,
  NewEventRow,
  NewEventSessionRow,
  NewRsvpRow,
  NewSeasonUpsert,
  NewStudentRow,
  NewTeamUpsert,
  UpsertResult,
} from './types.ts';

export interface TeamsUpsertOutcome {
  idByName: Map<string, string>;
  result: UpsertResult;
}

export interface NewDataSink {
  upsertTeams(rows: NewTeamUpsert[], dryRun: boolean): Promise<TeamsUpsertOutcome>;
  findOrCreateSeason(row: NewSeasonUpsert, dryRun: boolean): Promise<{ id: string; created: boolean }>;
  upsertStudents(rows: NewStudentRow[], dryRun: boolean): Promise<UpsertResult>;
  upsertEvents(rows: NewEventRow[], dryRun: boolean): Promise<UpsertResult>;
  upsertEventSessions(rows: NewEventSessionRow[], dryRun: boolean): Promise<UpsertResult>;
  upsertRsvps(rows: NewRsvpRow[], dryRun: boolean): Promise<UpsertResult>;
  upsertAttendance(rows: NewAttendanceRow[], dryRun: boolean): Promise<UpsertResult>;
}

// ---------------------------------------------------------------------------
// T063b (manifest write path): additive-only "which ids did this call
// actually create" variants of the two result shapes above. `UpsertResult`
// and `TeamsUpsertOutcome` (and therefore the `NewDataSink` interface) are
// left completely untouched on purpose -- every other implementation of
// `NewDataSink` (scripts/migrate/fixtures.ts's `InMemoryNewDataSink`) and
// every caller that only holds a `NewDataSink`-typed reference (core.ts,
// migrate.ts) is unaffected by what follows. Only `SupabaseNewDataSink`'s
// own concrete methods below declare the wider return type, so only a
// caller that holds a `SupabaseNewDataSink`-typed (or
// `IdentifyingNewDataSink`-typed) reference can see `createdIds` -- which
// is exactly and only `scripts/migrate/manifest.ts`'s
// `ManifestRecordingSink`. This is what lets the manifest distinguish
// "created" from "matched": each helper below already computes the id set
// that was NOT pre-existing before deciding whether to write; the only
// change here is returning that set instead of throwing it away.
export interface UpsertResultWithIds extends UpsertResult {
  createdIds: string[];
}

export interface TeamsUpsertOutcomeWithIds extends TeamsUpsertOutcome {
  createdIds: string[];
}

/** Structural (not `implements`-declared) supertype of `SupabaseNewDataSink`
 * that exposes the id-carrying result shapes above. Consumers that need to
 * know exactly which rows a real run created -- currently only
 * `ManifestRecordingSink` -- depend on this instead of the plain
 * `NewDataSink` interface. */
export interface IdentifyingNewDataSink {
  upsertTeams(rows: NewTeamUpsert[], dryRun: boolean): Promise<TeamsUpsertOutcomeWithIds>;
  findOrCreateSeason(row: NewSeasonUpsert, dryRun: boolean): Promise<{ id: string; created: boolean }>;
  upsertStudents(rows: NewStudentRow[], dryRun: boolean): Promise<UpsertResultWithIds>;
  upsertEvents(rows: NewEventRow[], dryRun: boolean): Promise<UpsertResultWithIds>;
  upsertEventSessions(rows: NewEventSessionRow[], dryRun: boolean): Promise<UpsertResultWithIds>;
  upsertRsvps(rows: NewRsvpRow[], dryRun: boolean): Promise<UpsertResultWithIds>;
  upsertAttendance(rows: NewAttendanceRow[], dryRun: boolean): Promise<UpsertResultWithIds>;
}

const DRY_RUN_PLACEHOLDER_PREFIX = 'dry-run-placeholder:';

async function idUpsert<T extends { id: string }>(
  client: SupabaseClient,
  table: string,
  rows: T[],
  dryRun: boolean,
): Promise<UpsertResultWithIds> {
  if (rows.length === 0) {
    return { createdCount: 0, updatedCount: 0, createdIds: [] };
  }
  const ids = rows.map((r) => r.id);
  const { data: existingRows, error: selectError } = await client.from(table).select('id').in('id', ids);
  if (selectError) {
    throw new Error(`New project: failed to read existing ${table} rows: ${selectError.message}`);
  }
  const existingIds = new Set((existingRows ?? []).map((r) => (r as { id: string }).id));
  const createdRows = rows.filter((r) => !existingIds.has(r.id));
  const createdCount = createdRows.length;
  const updatedCount = rows.length - createdCount;

  if (!dryRun) {
    const { error: upsertError } = await client.from(table).upsert(rows, { onConflict: 'id' });
    if (upsertError) {
      throw new Error(`New project: failed to upsert ${table}: ${upsertError.message}`);
    }
  }

  // Ids are deterministic (uuidv5 derived from the old row's id, computed
  // before this function is ever called -- see transform.ts/uuid.ts), so
  // "created" ids are already fully known from `createdRows` without a
  // second query. On a dry run nothing was actually created, so report none.
  return { createdCount, updatedCount, createdIds: dryRun ? [] : createdRows.map((r) => r.id) };
}

async function compositeKeyUpsert<T extends { session_id: string; student_id: string }>(
  client: SupabaseClient,
  table: string,
  rows: T[],
  dryRun: boolean,
): Promise<UpsertResultWithIds> {
  if (rows.length === 0) {
    return { createdCount: 0, updatedCount: 0, createdIds: [] };
  }
  const sessionIds = Array.from(new Set(rows.map((r) => r.session_id)));
  const { data: existingRows, error: selectError } = await client
    .from(table)
    .select('session_id, student_id')
    .in('session_id', sessionIds);
  if (selectError) {
    throw new Error(`New project: failed to read existing ${table} rows: ${selectError.message}`);
  }
  const existingKeys = new Set(
    (existingRows ?? []).map(
      (r) => `${(r as { session_id: string }).session_id}:${(r as { student_id: string }).student_id}`,
    ),
  );
  const createdCount = rows.filter((r) => !existingKeys.has(`${r.session_id}:${r.student_id}`)).length;
  const updatedCount = rows.length - createdCount;

  let createdIds: string[] = [];
  if (!dryRun) {
    // Unlike `idUpsert`'s tables, these rows carry no `id` field of their
    // own (the natural key is the session_id/student_id pair; `id` is a
    // separate DB-assigned uuid -- see the migration's `default
    // gen_random_uuid()`). `.select()` chained onto `.upsert()` is a single
    // round trip (no extra query), the same pattern `upsertTeams` below
    // already uses to recover DB-assigned ids after a natural-key upsert.
    const { data: upserted, error: upsertError } = await client
      .from(table)
      .upsert(rows, { onConflict: 'session_id,student_id' })
      .select('id, session_id, student_id');
    if (upsertError) {
      throw new Error(`New project: failed to upsert ${table}: ${upsertError.message}`);
    }
    const idByKey = new Map<string, string>(
      (upserted ?? []).map((r) => [
        `${(r as { session_id: string }).session_id}:${(r as { student_id: string }).student_id}`,
        (r as { id: string }).id,
      ]),
    );
    createdIds = rows
      .filter((r) => !existingKeys.has(`${r.session_id}:${r.student_id}`))
      .map((r) => idByKey.get(`${r.session_id}:${r.student_id}`))
      .filter((id): id is string => id !== undefined);
  }

  return { createdCount, updatedCount, createdIds };
}

export class SupabaseNewDataSink implements NewDataSink {
  private readonly client: SupabaseClient;

  constructor(env: SupabaseProjectEnv) {
    this.client = createClient(env.url, env.serviceRoleKey, {
      auth: { persistSession: false },
    });
  }

  async upsertTeams(rows: NewTeamUpsert[], dryRun: boolean): Promise<TeamsUpsertOutcomeWithIds> {
    if (rows.length === 0) {
      return { idByName: new Map(), result: { createdCount: 0, updatedCount: 0 }, createdIds: [] };
    }
    const names = rows.map((r) => r.name);
    const { data: existingRows, error: selectError } = await this.client
      .from('teams')
      .select('id, name')
      .in('name', names);
    if (selectError) {
      throw new Error(`New project: failed to read existing teams: ${selectError.message}`);
    }
    const idByName = new Map<string, string>(
      (existingRows ?? []).map((r) => [(r as { name: string }).name, (r as { id: string }).id]),
    );
    // Snapshot which names were already known BEFORE this upsert runs -- the
    // only reliable way to say "created" afterward, since `idByName` below
    // gets filled in for both created and matched rows alike.
    const preExistingNames = new Set(idByName.keys());
    const createdCount = rows.filter((r) => !idByName.has(r.name)).length;
    const updatedCount = rows.length - createdCount;

    if (!dryRun) {
      const { data: upserted, error: upsertError } = await this.client
        .from('teams')
        .upsert(rows, { onConflict: 'name' })
        .select('id, name');
      if (upsertError) {
        throw new Error(`New project: failed to upsert teams: ${upsertError.message}`);
      }
      for (const row of upserted ?? []) {
        idByName.set((row as { name: string }).name, (row as { id: string }).id);
      }
    } else {
      for (const row of rows) {
        if (!idByName.has(row.name)) {
          idByName.set(row.name, `${DRY_RUN_PLACEHOLDER_PREFIX}team:${row.name}`);
        }
      }
    }

    const createdIds = dryRun
      ? []
      : rows
          .filter((r) => !preExistingNames.has(r.name))
          .map((r) => idByName.get(r.name))
          .filter((id): id is string => id !== undefined);

    return { idByName, result: { createdCount, updatedCount }, createdIds };
  }

  async findOrCreateSeason(
    row: NewSeasonUpsert,
    dryRun: boolean,
  ): Promise<{ id: string; created: boolean }> {
    const { data, error: selectError } = await this.client
      .from('seasons')
      .select('id')
      .eq('name', row.name)
      .limit(1);
    if (selectError) {
      throw new Error(`New project: failed to read existing seasons: ${selectError.message}`);
    }
    const existing = (data ?? [])[0] as { id: string } | undefined;
    if (existing) {
      return { id: existing.id, created: false };
    }
    if (dryRun) {
      return { id: `${DRY_RUN_PLACEHOLDER_PREFIX}season:${row.name}`, created: true };
    }
    const { data: inserted, error: insertError } = await this.client
      .from('seasons')
      .insert(row)
      .select('id')
      .single();
    if (insertError || !inserted) {
      throw new Error(`New project: failed to insert season: ${insertError?.message ?? 'no row returned'}`);
    }
    return { id: (inserted as { id: string }).id, created: true };
  }

  async upsertStudents(rows: NewStudentRow[], dryRun: boolean): Promise<UpsertResultWithIds> {
    return idUpsert(this.client, 'students', rows, dryRun);
  }

  async upsertEvents(rows: NewEventRow[], dryRun: boolean): Promise<UpsertResultWithIds> {
    return idUpsert(this.client, 'events', rows, dryRun);
  }

  async upsertEventSessions(rows: NewEventSessionRow[], dryRun: boolean): Promise<UpsertResultWithIds> {
    return idUpsert(this.client, 'event_sessions', rows, dryRun);
  }

  async upsertRsvps(rows: NewRsvpRow[], dryRun: boolean): Promise<UpsertResultWithIds> {
    return compositeKeyUpsert(this.client, 'rsvps', rows, dryRun);
  }

  async upsertAttendance(rows: NewAttendanceRow[], dryRun: boolean): Promise<UpsertResultWithIds> {
    return compositeKeyUpsert(this.client, 'attendance', rows, dryRun);
  }
}

export const DRY_RUN_PLACEHOLDER = DRY_RUN_PLACEHOLDER_PREFIX;
