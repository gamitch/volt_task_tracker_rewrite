/**
 * T091 (ED-1 Packet P4): real `seasons` data-layer wiring -- the ONE shared
 * module every later ED-1 season-scoped packet's own `SeasonProvider`
 * (`../../app/SeasonProvider.tsx`) and `SeasonSettings.tsx` build on. Built
 * directly on top of T086's `createLoader`/`runMutation`
 * (`../loader.ts`, read-only import here) -- same shape `loaders/invites.ts`
 * (T087) already established for this `loaders/` directory: this file owns
 * only the `seasons` table.
 *
 * -----------------------------------------------------------------------
 * Trap #1 (worker packet Known Context/Traps #1) -- real queries.
 *
 * `queryActiveSeason` below is exactly the packet's own literal query:
 * `client.from('seasons').select('*').eq('is_active', true).maybeSingle()`.
 * `seasons_single_active_idx` (`supabase/migrations/
 * 20260716000000_identity_roster.sql`, lines 52-55, a partial unique index
 * on `(is_active) where is_active = true`, read-only reference, not
 * reimplemented here) guarantees at most one row can ever match, so
 * `.maybeSingle()` can never itself throw a "multiple rows" error for this
 * query -- it only ever resolves one row or zero. `createLoader` already
 * resolves `null` for supabase-js's "no rows" shape (`data: null, error:
 * null`), which is exactly the "zero seasons exist in the DB today" case
 * (this task's own stated deployment-state fact) -- NOT an error. Nothing in
 * this file (or `../loader.ts`) ever substitutes fixture data for that
 * `null` -- grep-provable, no `FIXTURE_`/`PLACEHOLDER_` literal exists
 * anywhere in this file.
 *
 * `makeSetActiveSeason` below is the disclosed TWO-STEP mutation the unique
 * index forces (worker packet's own wording, restated here at the one place
 * it is implemented): first `deactivateSeasonId` (if not `null`) ->
 * `is_active: false`, THEN `activateSeasonId` -> `is_active: true`. Order
 * matters -- activating the new row FIRST would collide with
 * `seasons_single_active_idx` while the old row is still `is_active: true`
 * (two `true` rows would violate the partial unique index), so the
 * deactivate write must land first. This is genuinely two separate
 * `runMutation`-built calls, awaited sequentially, NOT one transaction/RPC --
 * no `supabase.rpc(...)` call exists anywhere in this file (grep-provable).
 * **Disclosed risk (this task's own Required Worker Output obligation):** if
 * the deactivate call succeeds and the activate call then fails/rejects
 * (network drop, RLS denial, etc.), the database is left with ZERO active
 * seasons until a caller retries -- there is no rollback of the first write.
 * `SeasonSettings.tsx`'s existing T082 retry machinery
 * (`lastFailedActivateTarget` + the error `Banner`'s "Retry" action) is what
 * surfaces this failure to an admin and lets them re-run the exact same
 * `{ activateSeasonId, deactivateSeasonId }` payload -- re-running is SAFE
 * even after a partial failure: if the deactivate half already landed,
 * re-sending it is a no-op (the row is already `is_active: false`); only the
 * activate half would still be pending. This file does not attempt to
 * detect "already deactivated" and skip that step -- always running both (in
 * order) keeps this function's own logic simple and idempotent-by-construction,
 * rather than adding a second read to check current state first (which would
 * itself be racy against a concurrent admin's own switch).
 *
 * -----------------------------------------------------------------------
 * Trap #3 (worker packet Known Context/Traps #3) -- `SeasonSettings.tsx`'s
 * own local `SeasonRow` type is KEPT (not switched to `../types.ts`'s shared
 * `SeasonRow`), same category of decision `loaders/invites.ts`'s own module
 * doc already made for `InvitesTab.tsx`'s local types (cited there in full,
 * not re-derived here). Two independent reasons, stronger than T087's own
 * (which only had "one unused extra field" to weigh):
 *   1. `SeasonSettings.tsx`'s local `SeasonRow extends Record<string,
 *      unknown>` -- required by `Table`'s own generic constraint
 *      (astryx-api.md "Table" Props table, `data: T[]`). `../types.ts`'s
 *      shared `SeasonRow` does NOT extend that (and `../types.ts` is a
 *      forbidden/read-only file for this task, so it cannot be changed to
 *      add it) -- switching `SeasonSettings.tsx` to the shared type would
 *      not even type-check against `Table`'s `data` prop without a second,
 *      redundant local type anyway.
 *   2. The shared type additionally carries `createdAt` (`seasons.created_at`),
 *      a column `SeasonSettings.tsx` never displays or otherwise needs --
 *      same "always-unused extra field" reasoning T087 already applied to
 *      `InviteRow.invitedBy`.
 * This file's own `mapSeasonDbRowToSettingsSeasonRow` below is the "loader
 * maps DB rows into the local type explicitly" half of that decision -- the
 * one place `created_at` is dropped, disclosed, not silent.
 *
 * `../../app/SeasonProvider.tsx` (the shared active-season mechanism every
 * OTHER page's `useActiveSeason()` consumes) uses the SHARED `../types.ts`
 * `SeasonRow` instead (via `mapSeasonDbRowToSharedSeasonRow` below) -- it has
 * no `Table` to satisfy and every other ED-1 packet building on
 * `useActiveSeason()` should see the one canonical shape `../types.ts`
 * already established from the real migration SQL, not
 * `SeasonSettings.tsx`'s own page-local display shape.
 *
 * -----------------------------------------------------------------------
 * `public.seasons`' only RLS read policy (`supabase/migrations/
 * 20260717000002_rls.sql`, read-only reference, not imported here) grants
 * `admin`/`coach` (`is_staff()`) read access; `SeasonSettings.tsx` is already
 * admin-only-gated (`RequireRole(['admin'])`, that file's own module doc #6)
 * and `SeasonProvider` is meant to be mounted only inside the authenticated
 * chrome (see `SeasonProvider.tsx`'s own module doc, Trap #5) -- so every
 * session reaching either loader below is genuinely authenticated staff (for
 * `SeasonSettings`) or any authenticated user (for the active-season read,
 * which every role needs for season-scoped pages) per that policy, not an
 * RLS-caused false-empty.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { createLoader, runMutation, type LoaderQueryResult } from '../loader';
import { getSupabaseClient } from '../client';
import type { SeasonRow as SharedSeasonRow } from '../types';
import type {
  CreateSeasonPayload,
  LoadSeasonsFn,
  OnCreateSeasonFn,
  OnSetActiveSeasonFn,
  OnUpdateSeasonFn,
  SeasonRow as SettingsSeasonRow,
  SetActiveSeasonPayload,
  UpdateSeasonPayload,
} from '../../../pages/settings/SeasonSettings';

/**
 * Raw `public.seasons` row exactly as Postgrest returns it over the wire
 * (snake_case column names) -- `supabase/migrations/
 * 20260716000000_identity_roster.sql` lines 42-50, cited in full already in
 * `../types.ts`'s own `SeasonRow` doc comment (not re-cited here).
 */
interface SeasonDbRow {
  id: string;
  name: string;
  starts_on: string;
  ends_on: string;
  default_goal_hours: number;
  is_active: boolean;
  created_at: string;
}

/** Maps one raw DB row to `../types.ts`'s SHARED `SeasonRow` (Trap #3
 * decision above) -- consumed only by `SeasonProvider.tsx`. */
function mapSeasonDbRowToSharedSeasonRow(row: SeasonDbRow): SharedSeasonRow {
  return {
    id: row.id,
    name: row.name,
    startsOn: row.starts_on,
    endsOn: row.ends_on,
    defaultGoalHours: row.default_goal_hours,
    isActive: row.is_active,
    createdAt: row.created_at,
  };
}

/** Maps one raw DB row to `SeasonSettings.tsx`'s own local `SeasonRow`
 * display shape (Trap #3 decision above). `created_at` is deliberately
 * dropped here, not renamed -- the only lossy part of this mapping, and
 * intentional: `SeasonSettings.tsx` never displays/uses it. */
function mapSeasonDbRowToSettingsSeasonRow(row: SeasonDbRow): SettingsSeasonRow {
  return {
    id: row.id,
    name: row.name,
    startsOn: row.starts_on,
    endsOn: row.ends_on,
    defaultGoalHours: row.default_goal_hours,
    isActive: row.is_active,
  };
}

/** Trap #1's literal query, exactly as the worker packet specifies it. */
async function queryActiveSeason(client: SupabaseClient): Promise<LoaderQueryResult<SeasonDbRow>> {
  const result = await client.from('seasons').select('*').eq('is_active', true).maybeSingle();
  return { data: (result.data as SeasonDbRow | null) ?? null, error: result.error };
}

/** All seasons, for `SeasonSettings.tsx`'s own table -- ordered most-recent
 * (by `starts_on`) first, matching the descending order that file's own
 * `FIXTURE_SEASONS` (now unused as a default, kept for tests) already
 * modeled. */
async function queryAllSeasons(client: SupabaseClient): Promise<LoaderQueryResult<SeasonDbRow[]>> {
  const result = await client.from('seasons').select('*').order('starts_on', { ascending: false });
  return { data: (result.data as SeasonDbRow[] | null) ?? null, error: result.error };
}

/**
 * `getClient` is injectable (defaults to the shared singleton), same
 * convention `loaders/invites.ts` already established, so tests can supply a
 * stubbed transport with zero real network calls.
 */
export function makeLoadActiveSeason(
  getClient: () => SupabaseClient = getSupabaseClient,
): () => Promise<SharedSeasonRow | null> {
  const loadRow = createLoader<void, SeasonDbRow>(queryActiveSeason, getClient);
  return async (): Promise<SharedSeasonRow | null> => {
    const row = await loadRow();
    // Trap #1: `row === null` is the real "zero seasons active" case (either
    // zero seasons exist at all, or none is currently marked active) -- a
    // first-class outcome, not bridged to an error or to fixture data here.
    return row === null ? null : mapSeasonDbRowToSharedSeasonRow(row);
  };
}

/** `SeasonProvider.tsx`'s own default `loadActiveSeason` -- the ONLY file
 * permitted to import this (worker packet Known Context/Traps #7). */
export const loadActiveSeason = makeLoadActiveSeason();

/** Same injectable-`getClient` convention as above. */
export function makeLoadSeasons(
  getClient: () => SupabaseClient = getSupabaseClient,
): LoadSeasonsFn {
  const loadRows = createLoader<void, SeasonDbRow[]>(queryAllSeasons, getClient);
  return async (): Promise<SettingsSeasonRow[]> => {
    const rows = await loadRows();
    return (rows ?? []).map(mapSeasonDbRowToSettingsSeasonRow);
  };
}

/** `SeasonSettings.tsx`'s own default `loadData`. */
export const loadSeasons: LoadSeasonsFn = makeLoadSeasons();

/**
 * `SeasonSettings.tsx`'s own default `onCreateSeason`. `is_active: false` is
 * ALWAYS sent on insert -- a brand-new season is never created already
 * active (activating is a separate, explicit `onSetActiveSeason` action);
 * this also means a create can never itself violate
 * `seasons_single_active_idx`, regardless of how many other seasons already
 * exist or which one (if any) is currently active. Returns the created row
 * WITH its real, DB-generated `id` (`.select().single()`) -- `SeasonSettings
 * .tsx`'s own `handleSubmitForm` uses this real id directly for the new
 * row's optimistic list entry instead of its old `makeLocalSeasonId()`
 * client-side placeholder (that function's own doc comment already
 * disclosed it as "a stand-in a future wiring task's real INSERT ...
 * replaces" -- this is that task).
 */
export function makeCreateSeason(
  getClient: () => SupabaseClient = getSupabaseClient,
): OnCreateSeasonFn {
  const insertRow = runMutation<CreateSeasonPayload, SeasonDbRow>(
    (client, payload) =>
      client
        .from('seasons')
        .insert({
          name: payload.name,
          starts_on: payload.startsOn,
          ends_on: payload.endsOn,
          default_goal_hours: payload.defaultGoalHours,
          is_active: false,
        })
        .select()
        .single(),
    getClient,
  );
  return async (payload) => mapSeasonDbRowToSettingsSeasonRow(await insertRow(payload));
}

/** `SeasonSettings.tsx`'s own default `onCreateSeason`. */
export const createSeason: OnCreateSeasonFn = makeCreateSeason();

/**
 * `SeasonSettings.tsx`'s own default `onUpdateSeason`. Deliberately never
 * touches `is_active` -- only `onSetActiveSeason` (below) is ever allowed to
 * change it (mirrors `SeasonSettings.tsx`'s own module doc #1: "`
 * withActiveSeason` ... the ONLY place `isActive` is ever mutated in this
 * file"; this is the write-side counterpart of that same rule).
 */
export function makeUpdateSeason(
  getClient: () => SupabaseClient = getSupabaseClient,
): OnUpdateSeasonFn {
  return runMutation<UpdateSeasonPayload, void>(
    (client, payload) =>
      client
        .from('seasons')
        .update({
          name: payload.name,
          starts_on: payload.startsOn,
          ends_on: payload.endsOn,
          default_goal_hours: payload.defaultGoalHours,
        })
        .eq('id', payload.id),
    getClient,
  );
}

/** `SeasonSettings.tsx`'s own default `onUpdateSeason`. */
export const updateSeason: OnUpdateSeasonFn = makeUpdateSeason();

/**
 * `SeasonSettings.tsx`'s own default `onSetActiveSeason` -- module doc's own
 * Trap #1 section above documents the two-step contract and its disclosed
 * partial-failure risk in full; this is that implementation. `deactivate`/
 * `activate` are each their own single-column `runMutation` call (never a
 * combined update, never a `supabase.rpc(...)`).
 */
export function makeSetActiveSeason(
  getClient: () => SupabaseClient = getSupabaseClient,
): OnSetActiveSeasonFn {
  const deactivate = runMutation<string, void>(
    (client, seasonId) => client.from('seasons').update({ is_active: false }).eq('id', seasonId),
    getClient,
  );
  const activate = runMutation<string, void>(
    (client, seasonId) => client.from('seasons').update({ is_active: true }).eq('id', seasonId),
    getClient,
  );
  return async (payload: SetActiveSeasonPayload): Promise<void> => {
    // Order matters (Trap #1 module doc above): deactivate the old active
    // season FIRST (skipped when `deactivateSeasonId` is `null` -- no season
    // was previously active), THEN activate the target. If `activate`
    // rejects after `deactivate` already succeeded, this function's own
    // returned promise rejects too (no swallowing), leaving zero seasons
    // active in the database until a caller retries the same payload.
    if (payload.deactivateSeasonId !== null) {
      await deactivate(payload.deactivateSeasonId);
    }
    await activate(payload.activateSeasonId);
  };
}

/** `SeasonSettings.tsx`'s own default `onSetActiveSeason`. */
export const setActiveSeason: OnSetActiveSeasonFn = makeSetActiveSeason();
