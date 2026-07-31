/**
 * T177: the real backend behind `SubscribePopover.tsx`'s injectable
 * `loadCalendarFeed` seam (that file's own module doc section 7) -- reads
 * the caller's currently-active (non-revoked) `calendar_feeds` row. Same
 * `loaders/*.ts` shape every prior file in this directory already
 * establishes (`createLoader` from `../loader.ts`, injectable `getClient`, a
 * `make*` factory plus a real-singleton-bound default export, snake_case DB
 * row + explicit-column `select()` + a `mapXDbRowToRow` function, types
 * imported from the page file this loader serves) -- `settings.ts`'s own
 * precedent, this task's packet §3c.
 *
 * -----------------------------------------------------------------------
 * 1. The multi-row hazard (packet §3d) -- order + limit BEFORE
 *    `.maybeSingle()`.
 * -----------------------------------------------------------------------
 *
 * `calendar_feeds` (`supabase/migrations/20260717000001_support_audit.sql:
 * 47-53`) has a `unique` constraint on `token` but NONE on `profile_id` --
 * `SubscribePopover.tsx`'s own module doc section 1 already establishes in
 * detail that a profile CAN accumulate multiple non-revoked rows over time.
 * `postgrest-js` (the installed client library) does not enforce
 * single-row cardinality server-side for `.maybeSingle()` -- it fetches the
 * response as an ordinary list and enforces cardinality CLIENT-SIDE,
 * synthesizing a `{ code: 'PGRST116', message: 'JSON object requested,
 * multiple (or no) rows returned' }` error if the array has more than one
 * element (`PostgrestBuilder.ts`, confirmed directly against the installed
 * source). `queryActiveCalendarFeedByProfileId` below therefore orders by
 * `created_at` descending and limits to 1 BEFORE calling `.maybeSingle()`,
 * so the array the client-side cardinality check ever inspects never has
 * more than one element -- resolving the most-recently-created active row
 * rather than ever synthesizing a spurious `PGRST116` rejection on a real,
 * legitimate duplicate.
 *
 * -----------------------------------------------------------------------
 * 2. Missing-row posture -- fail loud (packet §3e/§3f).
 * -----------------------------------------------------------------------
 *
 * `SubscribePopover.tsx`'s own module doc section 10 already assumes a
 * `calendar_feeds` row exists for `profileId` by the time this widget
 * renders. Unlike `notification_prefs` (whose every column has a real
 * Postgres column default, so a missing row is semantically identical to a
 * fresh default row -- `settings.ts`'s own T109 precedent), `calendar_feeds`'
 * one meaningful column, `token`, is a database-generated `uuid` with no
 * default VALUE a client could honestly synthesize: inventing one
 * client-side would not synthesize "the row that doesn't exist yet," it
 * would recreate `SubscribePopover.tsx`'s own `FIXTURE_ACTIVE_FEED`, the
 * exact bug this task exists to remove. So `makeLoadCalendarFeed`'s
 * returned function throws a plain, fail-loud `Error` on a null result,
 * matching `settings.ts`'s own `loadSettingsData` "missing profiles row"
 * precedent (`settings.ts:358-360`), never bridged to fixture data.
 *
 * DISCLOSED SCOPE (packet §1/§3f): nothing anywhere in this codebase
 * currently inserts a `calendar_feeds` row for any profile -- not the
 * invite trigger, not any migration backfill, not any app code. So this
 * fail-loud path is not a rare edge case this loader defends against -- it
 * is the outcome for EVERY real profile today, until a provisioning path is
 * built (a follow-up, not this task's job -- see the worker output doc).
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { createLoader, type LoaderQueryResult } from '../loader';
import { getSupabaseClient } from '../client';
import type { CalendarFeedRow, LoadCalendarFeedFn } from '../../../pages/calendar/SubscribePopover';

// ---------------------------------------------------------------------------
// Raw DB row shape, exactly as Postgrest returns it (snake_case) -- column
// citations already given in full by `SubscribePopover.tsx`'s own module doc
// section 1 (`supabase/migrations/20260717000001_support_audit.sql:45-52`).
// ---------------------------------------------------------------------------

interface CalendarFeedDbRow {
  id: string;
  profile_id: string;
  token: string;
  revoked_at: string | null;
  created_at: string;
}

function mapCalendarFeedDbRowToRow(row: CalendarFeedDbRow): CalendarFeedRow {
  return {
    id: row.id,
    profileId: row.profile_id,
    token: row.token,
    revokedAt: row.revoked_at,
    createdAt: row.created_at,
  };
}

/** Module doc section 1 above -- order + limit BEFORE `.maybeSingle()`, and
 * explicit `.eq('profile_id', ...)`/`.is('revoked_at', null)` filters, not
 * RLS-only (packet §4 -- `self_all`'s `using (profile_id = auth.uid())`
 * would already scope this correctly, but the loader still supplies its own
 * explicit filter, same defense-in-depth convention `settings.ts`'s own
 * `queryProfileById` already established). */
async function queryActiveCalendarFeedByProfileId(
  client: SupabaseClient,
  profileId: string,
): Promise<LoaderQueryResult<CalendarFeedDbRow>> {
  const result = await client
    .from('calendar_feeds')
    .select('id, profile_id, token, revoked_at, created_at')
    .eq('profile_id', profileId)
    .is('revoked_at', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  return { data: (result.data as CalendarFeedDbRow | null) ?? null, error: result.error };
}

/**
 * `SubscribePopover.tsx`'s own default `loadCalendarFeed` (that file's own
 * module doc section 7). `getClient` is injectable, same convention every
 * prior `loaders/*.ts` file already established.
 */
export function makeLoadCalendarFeed(
  getClient: () => SupabaseClient = getSupabaseClient,
): LoadCalendarFeedFn {
  const loadRow = createLoader<string, CalendarFeedDbRow>(
    queryActiveCalendarFeedByProfileId,
    getClient,
  );

  return async (profileId: string): Promise<CalendarFeedRow> => {
    const row = await loadRow(profileId);
    // Module doc section 2 above -- fail loud, never bridged to fixture
    // data. `LoadCalendarFeedFn` is `Promise<CalendarFeedRow>` (non-null),
    // but `loadRow` resolves `TData | null` -- this null-check is a type
    // requirement, not just a design preference.
    if (row === null) {
      throw new Error('No calendar feed was found for your account.');
    }
    return mapCalendarFeedDbRowToRow(row);
  };
}

/** `SubscribePopover.tsx`'s own real default `loadCalendarFeed`. */
export const loadCalendarFeed: LoadCalendarFeedFn = makeLoadCalendarFeed();
