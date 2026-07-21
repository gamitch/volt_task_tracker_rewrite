/**
 * T104 (ED-1 Packet P11): real `seasons.leaderboard_privacy_enabled`
 * data-layer wiring -- closes the schema gap two already-Passed tasks (T028
 * `AdminToggles.tsx`, T044 `Leaderboard.tsx`) each independently
 * investigated and disclosed (both files' own module docs, read in full for
 * this task, independently confirmed zero privacy-shaped column existed
 * anywhere in the schema as of their own dispatch). This module owns the
 * ONE new column this same task's own migration
 * (`supabase/migrations/20260720000000_leaderboard_privacy.sql`) adds --
 * same "one loader file per table/concern" convention `loaders/seasons.ts`/
 * `loaders/teams.ts`/etc. already establish for this `loaders/` directory.
 *
 * -----------------------------------------------------------------------
 * Column re-verification (packet Trap #1) -- see the migration file's own
 * header comment for the full, evidence-based reasoning (not repeated
 * here): table placement (`seasons`, not `teams`) is KEPT from T028's own
 * guess; the column NAME is DEVIATED from T028's own guess
 * (`leaderboard_show_full_name`) to `leaderboard_privacy_enabled`, because
 * neither state of this boolean ever reveals a full name (SEC-04 forbids
 * it in both states -- confirmed against both consuming files' own shipped
 * code/copy), and the new name matches the boolean vocabulary
 * (`privacyOn` / `isPrivacyOn` / `LoadPrivacySettingFn`) both files already
 * independently converged on.
 *
 * -----------------------------------------------------------------------
 * "Caller's relevant season" (packet Trap #3) -- resolved as the
 * CURRENTLY-ACTIVE season, mirroring `loaders/seasons.ts`'s own
 * `queryActiveSeason` / `SeasonProvider.tsx`'s own `is_active = true`
 * pattern (both read directly, read-only, for this decision; neither is
 * imported here -- see below). Both functions below filter/target
 * `seasons` by `is_active = true` directly, in a single round trip --
 * deliberately NOT a two-step "load the active season's id first, then
 * query/update by id": `seasons_single_active_idx`
 * (`20260716000000_identity_roster.sql`, lines 52-55, read-only reference)
 * guarantees at most one row can ever match that predicate, so filtering
 * directly by it is already as precise as filtering by a separately-
 * resolved id, with one fewer round trip.
 *
 * `loaders/seasons.ts`'s own exported `loadActiveSeason` singleton is
 * deliberately NOT imported here (even though `loaders/seasons.ts` is not
 * in this task's own Forbidden Files list) -- that file's own module doc
 * restricts it to `SeasonProvider.tsx` as "the ONLY file permitted to
 * import this" (that task's own Known Context/Traps #7). This module
 * honors that restriction by independently querying the same
 * `is_active = true` predicate itself, rather than reusing that function --
 * a "structurally mirrored, not literally reused" relationship, the same
 * category of relationship `Leaderboard.tsx`'s own pre-this-task
 * `PLACEHOLDER_SEASON_ID` already had to the real active-season concept.
 *
 * -----------------------------------------------------------------------
 * "No currently-active season" outcome -- a real, first-class case (not
 * hypothetical: `SeasonProvider.tsx`'s own module doc states the real
 * production database has zero `seasons` rows at all today), handled
 * differently for read vs. write, both deliberately, both disclosed here:
 *
 *  - `loadPrivacySetting()`: resolves the SEC-04/ROS-08 stated default
 *    (`true`) when no active-season row is found. Same "nothing to load,
 *    fall back to the already-documented default" posture
 *    `defaultLoadPrivacySetting` already had in both consuming files
 *    before this task, and consistent with `SeasonProvider.tsx`'s own
 *    framing of "no active season" as an honest, non-error outcome rather
 *    than something to surface as a loader failure.
 *  - `togglePrivacy(nextValue)`: DISCLOSED RISK (Required Worker Output,
 *    independently confirmed against a real scratch-Postgres run for this
 *    task -- an `UPDATE ... WHERE is_active = true` against zero matching
 *    rows genuinely resolves `UPDATE 0`, not a Postgrest error) --
 *    `.update({...}).eq('is_active', true)` against zero currently-active
 *    seasons silently persists nothing while still resolving successfully
 *    to the caller. This mirrors `loaders/teams.ts`'s own `archived`/
 *    `sort_order` toggle mutations, which likewise never verify an
 *    affected-row count (the established convention already in this
 *    `loaders/` directory, not a new gap introduced here) -- flagged
 *    explicitly here since, unlike `teams.ts`'s toggles (which always
 *    target a known, already-loaded row's real id), this function's own
 *    target row is resolved implicitly via `is_active = true` rather than
 *    a caller-supplied id, so the "nothing to persist to" case is
 *    realistically reachable in the documented zero-active-seasons
 *    production state today, not merely a theoretical edge case.
 *
 * -----------------------------------------------------------------------
 * RLS sufficiency (packet Trap #2) -- independently verified against a
 * real scratch-Postgres instance for this task (this task's own Required
 * Worker Output has the full transcript): an `admin` session and a
 * `coach` session can both genuinely persist a write to this new column
 * (`staff_all`'s `is_staff()` check covers both roles, matching every
 * other `seasons` write in this codebase); a `student` session can read
 * it (`read_all`) but a write attempt from that session genuinely affects
 * zero rows (RLS-blocked, not merely UI-hidden). No new RLS policy was
 * added by this task's migration -- see that file's own header comment.
 *
 * -----------------------------------------------------------------------
 * Shared vs. separate implementation (packet Trap #3) -- ONE shared
 * `loadPrivacySetting` (this file's own singleton, below) is imported as
 * the real default by BOTH `AdminToggles.tsx` and `Leaderboard.tsx` -- not
 * two separate implementations. Unlike T101's own RSVP shared-function
 * decision (which had to reconcile two genuinely different callers --
 * student-self vs. parent-on-behalf -- converging through
 * `my_student_ids()`'s own union), this case has zero variation to
 * reconcile at all: both consumers already independently declare the
 * exact same `() => Promise<boolean>` shape, need the exact same "current
 * active season's privacy flag" value, and neither has any caller-specific
 * parameter the other lacks -- so a single shared function is the more
 * defensible choice here, not merely the simpler one. `togglePrivacy` has
 * no such symmetry (`Leaderboard.tsx` has no write side at all), so it
 * stays singular, exported only for `AdminToggles.tsx` to consume.
 *
 * `LoadPrivacySettingFn`/`TogglePrivacyFn` below are structurally
 * identical to (deliberately NOT imported from) `AdminToggles.tsx`'s and
 * `Leaderboard.tsx`'s own independently-declared local types of the same
 * name/shape -- same "two files independently converging on one
 * structural shape without a shared nominal type" relationship those two
 * files already had to each other before this task; this file keeps its
 * own copy for the same reason, rather than picking one page as the
 * "winner" to import from.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { createLoader, runMutation, type LoaderQueryResult } from '../loader';
import { getSupabaseClient } from '../client';

export type LoadPrivacySettingFn = () => Promise<boolean>;
export type TogglePrivacyFn = (nextValue: boolean) => Promise<void>;

/**
 * `public.seasons.leaderboard_privacy_enabled` -- added by this same
 * task's own migration, `supabase/migrations/
 * 20260720000000_leaderboard_privacy.sql` (read-only reference; not
 * re-derived here beyond this one column's name/type).
 */
interface SeasonPrivacyDbRow {
  leaderboard_privacy_enabled: boolean;
}

/** SEC-04/ROS-08's stated default -- also this module's own disclosed
 * fallback for the "no currently-active season" read case (module doc
 * above). */
const DEFAULT_PRIVACY_ENABLED = true;

async function queryActiveSeasonPrivacy(
  client: SupabaseClient,
): Promise<LoaderQueryResult<SeasonPrivacyDbRow>> {
  const result = await client
    .from('seasons')
    .select('leaderboard_privacy_enabled')
    .eq('is_active', true)
    .maybeSingle();
  return { data: (result.data as SeasonPrivacyDbRow | null) ?? null, error: result.error };
}

/**
 * `getClient` is injectable (defaults to the shared singleton), same
 * convention `loaders/seasons.ts`/`loaders/teams.ts` already establish, so
 * tests can supply a stubbed transport with zero real network calls.
 */
export function makeLoadPrivacySetting(
  getClient: () => SupabaseClient = getSupabaseClient,
): LoadPrivacySettingFn {
  const loadRow = createLoader<void, SeasonPrivacyDbRow>(queryActiveSeasonPrivacy, getClient);
  return async (): Promise<boolean> => {
    const row = await loadRow();
    // Module doc above: "no currently-active season" resolves the
    // documented default rather than being bridged to an error.
    return row === null ? DEFAULT_PRIVACY_ENABLED : row.leaderboard_privacy_enabled;
  };
}

/** The real, SHARED default for BOTH `AdminToggles.tsx`'s and
 * `Leaderboard.tsx`'s own `loadPrivacySetting` prop (module doc above). */
export const loadPrivacySetting: LoadPrivacySettingFn = makeLoadPrivacySetting();

/** Same injectable-`getClient` convention as `makeLoadPrivacySetting`
 * above. */
export function makeTogglePrivacy(
  getClient: () => SupabaseClient = getSupabaseClient,
): TogglePrivacyFn {
  const update = runMutation<boolean, void>(
    (client, nextValue) =>
      client
        .from('seasons')
        .update({ leaderboard_privacy_enabled: nextValue })
        .eq('is_active', true),
    getClient,
  );
  return async (nextValue: boolean): Promise<void> => {
    await update(nextValue);
  };
}

/** `AdminToggles.tsx`'s own real default `onTogglePrivacy`. */
export const togglePrivacy: TogglePrivacyFn = makeTogglePrivacy();
