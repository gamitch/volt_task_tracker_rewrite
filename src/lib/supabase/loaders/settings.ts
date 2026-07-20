/**
 * T105 (ED-1 Packet P12): real `SettingsPage.tsx` (SET-01/02/03) data-layer
 * wiring -- `loadSettingsData`/`updateProfile`/`uploadAvatar`/`changeTheme`/
 * `toggleNotificationPref`/`signOutEverywhere`. Same `loaders/*.ts` shape
 * every prior ED-1 packet already established (`../loader.ts`'s
 * `createLoader`/`runMutation`, injectable `getClient`, `make*` factory +
 * a real-singleton-bound default export) -- see `loaders/seasons.ts`/T091
 * for the closest, most-recently-landed precedent this file follows.
 *
 * -----------------------------------------------------------------------
 * 1. Real reads/writes -- profile, theme, notification prefs (Known
 *    Context/Traps #1).
 * -----------------------------------------------------------------------
 *
 * `public.profiles` (`../../../../supabase/migrations/
 * 20260716000000_identity_roster.sql`, lines 16-24, already cited in full by
 * `../types.ts`'s own `ProfileRow` doc comment, not re-cited here) and
 * `public.notification_prefs` (`20260717000001_support_audit.sql`, lines
 * 32-43, already cited in full by `../types.ts`'s own `NotificationPrefsRow`
 * doc comment) are read/written directly, one row each, for the CALLER'S OWN
 * id -- never any other profile's.
 *
 * T109 fix (HIGH PRIORITY, live-reported by George): NOTHING anywhere ever
 * inserts a `notification_prefs` row for a profile -- `fn_handle_invite_
 * acceptance` (the invite trigger, `20260718000000_invite_trigger.sql`)
 * creates only `profiles`, no migration backfills `notification_prefs`, and
 * no app code inserted one either. So EVERY real user's `notification_prefs`
 * query returns zero rows, and the pre-T109 `loadSettingsData` threw on that
 * (`'No notification preferences were found for your account.'`), making
 * `/settings` unusable for every real user. Since every one of the table's
 * seven boolean columns is `not null default true` (confirmed by reading
 * `20260717000001_support_audit.sql` lines 32-43 directly, not assumed --
 * see `DEFAULT_NOTIFICATION_PREFS` below), a missing row is semantically
 * IDENTICAL to a row of those seven defaults, so `loadSettingsData` now
 * synthesizes that default row instead of throwing (see `loadSettingsData`'s
 * own body below). The missing-`profiles`-row case is UNCHANGED and still throws --
 * that case genuinely indicates the invite trigger never ran, a real bug
 * worth surfacing loudly. `toggleNotificationPref` is switched from a plain
 * UPDATE (which silently zero-row-no-ops against a nonexistent row, the same
 * class of bug T104 already disclosed for `togglePrivacy`) to a genuine
 * UPSERT so a user's very first toggle actually persists -- see that
 * function's own doc comment below for the full RLS + column-default
 * reasoning.
 *
 * RLS already scopes every one of these writes correctly (`
 * 20260717000002_rls.sql`, read-only reference, not reimplemented here):
 *   - `profiles_self_update` (lines 42-45): `using (id = auth.uid())` --
 *     `updateProfile`/`changeTheme`/`uploadAvatar`'s own `profiles.update(...)
 *     .eq('id', userId)` below can only ever actually affect the caller's
 *     own row even if `userId` were ever wrong, but see point 2 below for why
 *     it never is.
 *   - `self_all` on `notification_prefs` (lines 240-243): `using (profile_id
 *     = auth.uid()) with check (profile_id = auth.uid())` -- `
 *     toggleNotificationPref` below relies on this directly (module doc #3).
 *   - `profiles_read` (lines 36-37): `for select to authenticated using
 *     (true)` -- ALL profiles are readable by ANY authenticated session (PRD
 *     8.3: "read all" for admin, "read+update own" for every other role,
 *     Ground Truth). This means `loadSettingsData` below CANNOT rely on RLS
 *     alone to scope its own `profiles` read to "just my row" the way `
 *     notification_prefs`'s `self_all` policy does -- it must explicitly
 *     `.eq('id', userId)` (point 2 below), or it would silently be able to
 *     read the wrong row for a malformed query. This file's own
 *     `queryProfileById` always supplies an explicit `id`, never relies on
 *     RLS to narrow an unfiltered `select`.
 *
 * -----------------------------------------------------------------------
 * 2. `resolveCurrentUserId` -- why every one of `loadSettingsData`/
 *    `updateProfile`/`uploadAvatar`/`changeTheme` needs it, but
 *    `toggleNotificationPref` does not (Known Context/Traps #1).
 * -----------------------------------------------------------------------
 *
 * `SettingsPage.tsx`'s own established payload shapes (unchanged by this
 * task -- not this task's job to redesign that already-Passed T060 file's
 * seam signatures): `UpdateProfilePayload` (`{ displayName }`) and
 * `ChangeThemePayload` (`{ themeMode }`) carry NO caller id at all --
 * `ToggleNotificationPrefPayload` is the one exception, already carrying a
 * real `profileId` (supplied by `SettingsPage.tsx`'s own already-loaded
 * `profile.id`, module doc #3's own citation of that file). So
 * `toggleNotificationPref` below can trust the caller-supplied `profileId`
 * directly (same trust model `loaders/outreach.ts`'s `OutreachRsvpChangeParams
 * .respondedBy` already established for an RLS `with check`-enforced column),
 * while the other three must resolve the caller's own id themselves.
 *
 * `resolveCurrentUserId` does this via `../auth.ts`'s already-exported,
 * already-tested `getInitialSession` (the SAME call `
 * src/lib/supabase/loaders/accept.ts`'s own `makeLoadInvite` already uses to
 * get `session.user.id` -- this file follows that exact precedent, not a new
 * pattern) -- one extra `client.auth.getSession()` round trip per mutation,
 * traded deliberately against the ALTERNATIVE (widening `UpdateProfilePayload`
 * /`ChangeThemePayload` to also carry a caller-supplied id, mirroring `
 * ToggleNotificationPrefPayload`) because that alternative would require
 * editing `SettingsPage.tsx`'s own already-Passed, already-tested
 * `handleSaveProfile`/`persistTheme` handlers AND every existing assertion in
 * `SettingsPage.test.tsx` that checks the exact payload shape those handlers
 * send (e.g. `expect(calls).toEqual([{ displayName: 'Casey N.' }])`) -- a
 * strictly larger, riskier surface change for zero functional benefit over
 * one extra already-cached-session lookup. `getInitialSession` throwing
 * `null` (no session) is mapped to a plain, fail-loud `Error` here (same
 * "should not happen, but defend rather than assume" posture `../auth.ts`'s
 * own `signInWithPassword`/`updateUserPassword` already established for their
 * own "missing expected data" cases) -- SettingsPage.tsx's own module doc
 * #11 already assumes an authenticated session by the time this page
 * renders at all, so this is a defensive guard, not an expected runtime path.
 *
 * -----------------------------------------------------------------------
 * 3. Avatar upload -- the new Storage bucket, wired for real (Known Context
 *    /Traps #3).
 * -----------------------------------------------------------------------
 *
 * `../../../../supabase/migrations/20260720000001_avatar_storage.sql` (this
 * same task's own new migration, read in full there for the complete
 * bucket-visibility investigation and RLS-policy reasoning, not repeated
 * verbatim here) creates the `avatars` bucket (`public = true`) and four RLS
 * policies on `storage.objects` scoping insert/update/delete to each
 * caller's own `{auth.uid()}/...` folder.
 *
 * `uploadAvatar` below:
 *   1. Resolves the caller's own id (point 2 above).
 *   2. Builds a path `${userId}/${Date.now()}${extension}` -- the `Date.now()`
 *      timestamp (not the original filename) keeps the object name free of
 *      any user-supplied string in the URL/path (SEC-02: "No PII in URLs" --
 *      an original filename could itself carry a name, e.g.
 *      "jordan-rivera.png"), while still varying per upload so `{ upsert:
 *      true }` never silently collides two uploads issued in the same
 *      millisecond in a way that would look like data loss (a `Date.now()`
 *      collision is already vanishingly unlikely for one interactive user
 *      clicking "Upload" through a `FileInput`, and `upsert: true` makes an
 *      exact collision a harmless overwrite of the caller's own just-uploaded
 *      file, never another user's, per the migration's own RLS scoping).
 *      DISCLOSED, non-fatal edge case: re-uploading a DIFFERENT file
 *      extension than a prior upload produces a new object path rather than
 *      overwriting the old one, leaving the old object orphaned in the
 *      bucket (still only reachable/deletable by the same caller, per the
 *      migration's own RLS) -- this file does not add extra bookkeeping to
 *      track/delete a caller's prior avatar object(s), the same
 *      "disclose, don't silently over-engineer" posture `loaders/seasons.ts`
 *      already took for `makeSetActiveSeason`'s own two-step partial-failure
 *      risk.
 *   3. Uploads via `client.storage.from('avatars').upload(path, file, {
 *      upsert: true, contentType: file.type || undefined })`. Storage API
 *      errors (a DIFFERENT transport than Postgrest -- `StorageError`, not a
 *      `{message, code}` Postgrest shape) are let PROPAGATE UNWRAPPED, a
 *      deliberate, disclosed choice mirroring `../auth.ts`'s own module doc
 *      for its six `client.auth.*`-calling functions ("the worker packet's
 *      DES-16 requirement is scoped explicitly to 'the Loader helper'...
 *      wrapping it a second time would risk losing [transport-specific]
 *      fields"): `StorageError extends Error` (confirmed directly against
 *      the installed `@supabase/storage-js` source), so `SettingsPage.tsx`'s
 *      own existing `avatarError` catch (`error instanceof Error ?
 *      error.message : ...`) already renders it correctly with zero changes
 *      needed there.
 *   4. Resolves the public URL via `client.storage.from('avatars')
 *      .getPublicUrl(path)` -- requires ZERO `storage.objects` RLS
 *      permissions per Storage's own documented contract (confirmed directly
 *      against the installed `@supabase/storage-js` source's own doc
 *      comment: "objects table permissions: none"), consistent with the
 *      migration's own public-bucket decision.
 *   5. Writes the resulting URL to `profiles.avatar_url` via `runMutation`
 *      (the normal DES-16-wrapped path, since this step IS a plain Postgrest
 *      table write like every other mutation in this file).
 *   6. Returns `{ avatarUrl }`, matching `SettingsPage.tsx`'s own already-
 *      established `UploadAvatarResult` shape unchanged.
 *
 * -----------------------------------------------------------------------
 * 4. `signOutEverywhere` -- real global-scope Auth call, distinct from `
 *    ../auth.ts`'s own `signOut` (module doc #2 / Known Context/Traps #2).
 * -----------------------------------------------------------------------
 *
 * Calls `client.auth.signOut({ scope: 'global' })` directly (verified
 * against the installed `@supabase/auth-js` `GoTrueClient.signOut`'s own doc
 * comment: "the default `scope` is `'global'`... signs the user out of every
 * device they are currently signed in on" -- `{ scope: 'global' }` is passed
 * explicitly here anyway, even though it is already the SDK's own default,
 * so this call site is self-documenting about which of the three scopes
 * (`'global' | 'local' | 'others'`) it deliberately means, matching SET-01's
 * "Sign out everywhere" copy). Deliberately NOT built on top of `../auth.ts`'s
 * own exported `signOut(client)` (which calls `client.auth.signOut()` with
 * no options and is documented there as mapping to `guards.tsx`'s single-
 * device `logout()`) -- `../auth.ts` is a read-only import-only file for this
 * task, and reusing that function here would blur the "these are two
 * genuinely different actions" distinction `SettingsPage.tsx`'s own module
 * doc #3 (T060) already carefully drew, even though both currently resolve
 * to the same default-global SDK behavior under the hood. `AuthError` (like
 * every other `client.auth.*` rejection in this codebase) propagates
 * unwrapped -- same posture as `../auth.ts`'s own six functions, and matching
 * `SettingsPage.tsx`'s own existing `signOutError` catch, which already
 * handles any `Error` correctly with zero changes needed there.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { createLoader, runMutation, type LoaderQueryResult } from '../loader';
import { getSupabaseClient } from '../client';
import { getInitialSession } from '../auth';
import {
  isValidThemeMode,
  type LoadSettingsDataFn,
  type NotificationPrefKey,
  type NotificationPrefsRow,
  type OnChangeThemeFn,
  type OnSignOutEverywhereFn,
  type OnToggleNotificationPrefFn,
  type OnUpdateProfileFn,
  type OnUploadAvatarFn,
  type ProfileRole,
  type SettingsData,
  type SettingsProfile,
  type ThemeMode,
  type ToggleNotificationPrefPayload,
  type UploadAvatarResult,
} from '../../../pages/settings/SettingsPage';

const AVATAR_BUCKET = 'avatars';

/** Point 2 above -- resolves the real, currently-signed-in caller's
 * `profiles.id` (== `auth.uid()`), for the three seams whose own
 * `SettingsPage.tsx`-established payload shapes carry no id of their own. */
async function resolveCurrentUserId(client: SupabaseClient): Promise<string> {
  const session = await getInitialSession(client);
  if (!session?.user) {
    // Defensive, "should not happen" guard -- SettingsPage.tsx's own module
    // doc #11 already assumes an authenticated session by the time this page
    // renders at all (point 2 above).
    throw new Error('No active session was found. Please log in again.');
  }
  return session.user.id;
}

// ---------------------------------------------------------------------------
// Raw DB row shapes, exactly as Postgrest returns them (snake_case) --
// column citations already given in full by module doc #1 above.
// ---------------------------------------------------------------------------

interface ProfileDbRow {
  id: string;
  display_name: string;
  email: string;
  role: string;
  avatar_url: string | null;
  theme_mode: string;
}

interface NotificationPrefsDbRow {
  profile_id: string;
  invite: boolean;
  signup_confirm: boolean;
  event_reminder_48h: boolean;
  event_reminder_3h: boolean;
  meeting_reminder_3h: boolean;
  weekly_digest: boolean;
  digest_enabled: boolean;
}

function mapProfileDbRowToSettingsProfile(row: ProfileDbRow): SettingsProfile {
  return {
    id: row.id,
    displayName: row.display_name,
    email: row.email,
    // `role_enum`'s vocabulary matches `ProfileRole` verbatim (Ground
    // Truth, already cited by `SettingsPage.tsx`'s own module doc #4).
    role: row.role as ProfileRole,
    // `profiles.avatar_url` is nullable (T086 amendment, Known Context/
    // Traps #3) -- passed through as-is, never coerced to `''`.
    avatarUrl: row.avatar_url,
    // `theme_mode` is free-text at the DB level (module doc #6 of
    // `SettingsPage.tsx`, not re-derived here) -- guarded through the same
    // `isValidThemeMode` the UI itself uses, falling back to the column's
    // own documented default ('system') for any legacy/invalid value
    // rather than crashing or rendering an un-selectable `RadioList` value.
    themeMode: isValidThemeMode(row.theme_mode) ? row.theme_mode : 'system',
  };
}

/** T109: column defaults straight from `notification_prefs`'s own migration
 * (`20260717000001_support_audit.sql`, lines 32-43) -- every one of the
 * seven boolean columns is declared `not null default true`, confirmed by
 * reading the actual migration rather than assumed. A profile with no
 * `notification_prefs` row yet (every real user today -- see module doc
 * above) is therefore semantically identical to a row of these seven
 * defaults. */
const DEFAULT_NOTIFICATION_PREFS: Omit<NotificationPrefsRow, 'profileId'> = {
  invite: true,
  signupConfirm: true,
  eventReminder48h: true,
  eventReminder3h: true,
  meetingReminder3h: true,
  weeklyDigest: true,
  digestEnabled: true,
};

function mapNotificationPrefsDbRowToRow(row: NotificationPrefsDbRow): NotificationPrefsRow {
  return {
    profileId: row.profile_id,
    invite: row.invite,
    signupConfirm: row.signup_confirm,
    eventReminder48h: row.event_reminder_48h,
    eventReminder3h: row.event_reminder_3h,
    meetingReminder3h: row.meeting_reminder_3h,
    weeklyDigest: row.weekly_digest,
    digestEnabled: row.digest_enabled,
  };
}

async function queryProfileById(
  client: SupabaseClient,
  id: string,
): Promise<LoaderQueryResult<ProfileDbRow>> {
  const result = await client
    .from('profiles')
    .select('id, display_name, email, role, avatar_url, theme_mode')
    .eq('id', id)
    .maybeSingle();
  return { data: (result.data as ProfileDbRow | null) ?? null, error: result.error };
}

async function queryNotificationPrefsByProfileId(
  client: SupabaseClient,
  profileId: string,
): Promise<LoaderQueryResult<NotificationPrefsDbRow>> {
  const result = await client
    .from('notification_prefs')
    .select(
      'profile_id, invite, signup_confirm, event_reminder_48h, event_reminder_3h, ' +
        'meeting_reminder_3h, weekly_digest, digest_enabled',
    )
    .eq('profile_id', profileId)
    .maybeSingle();
  return { data: (result.data as NotificationPrefsDbRow | null) ?? null, error: result.error };
}

/**
 * `SettingsPage.tsx`'s own default `loadSettingsData` (module doc #1/#2).
 * `getClient` is injectable, same convention every prior `loaders/*.ts` file
 * already established.
 */
export function makeLoadSettingsData(
  getClient: () => SupabaseClient = getSupabaseClient,
): LoadSettingsDataFn {
  const loadProfile = createLoader<string, ProfileDbRow>(queryProfileById, getClient);
  const loadNotificationPrefs = createLoader<string, NotificationPrefsDbRow>(
    queryNotificationPrefsByProfileId,
    getClient,
  );

  return async (): Promise<SettingsData> => {
    const client = getClient();
    const userId = await resolveCurrentUserId(client);

    const [profileRow, prefsRow] = await Promise.all([
      loadProfile(userId),
      loadNotificationPrefs(userId),
    ]);

    // SettingsPage.tsx's own module doc #11 assumes a `profiles` row already
    // exists for the current viewer by the time it renders -- a missing
    // `profiles` row is a genuine, fail-loud error (routed into the page's
    // existing DES-12 error Banner state), never bridged to fixture data:
    // the invite trigger (`fn_handle_invite_acceptance`) should always have
    // created it, so its absence means something is genuinely wrong.
    if (profileRow === null) {
      throw new Error('No profile was found for your account.');
    }

    // T109: a missing `notification_prefs` row is NOT an error -- see module
    // doc above. Nothing anywhere ever inserts this row today, so treating a
    // null result as fail-loud broke `/settings` for every real user.
    // Synthesize the column-default row instead (`DEFAULT_NOTIFICATION_PREFS`
    // above), identical to what a fresh row would actually contain.
    const notificationPrefs: NotificationPrefsRow =
      prefsRow === null
        ? { profileId: userId, ...DEFAULT_NOTIFICATION_PREFS }
        : mapNotificationPrefsDbRowToRow(prefsRow);

    return {
      profile: mapProfileDbRowToSettingsProfile(profileRow),
      notificationPrefs,
    };
  };
}

/** `SettingsPage.tsx`'s own real default `loadSettingsData`. */
export const loadSettingsData: LoadSettingsDataFn = makeLoadSettingsData();

/** `SettingsPage.tsx`'s own default `onUpdateProfile` (module doc #1/#2). */
export function makeUpdateProfile(
  getClient: () => SupabaseClient = getSupabaseClient,
): OnUpdateProfileFn {
  const mutate = runMutation<{ id: string; displayName: string }, void>(
    (client, payload) =>
      client.from('profiles').update({ display_name: payload.displayName }).eq('id', payload.id),
    getClient,
  );

  return async (payload) => {
    const client = getClient();
    const userId = await resolveCurrentUserId(client);
    await mutate({ id: userId, displayName: payload.displayName });
  };
}

/** `SettingsPage.tsx`'s own real default `onUpdateProfile`. */
export const updateProfile: OnUpdateProfileFn = makeUpdateProfile();

/** `SettingsPage.tsx`'s own default `onChangeTheme` (module doc #1/#2). */
export function makeChangeTheme(
  getClient: () => SupabaseClient = getSupabaseClient,
): OnChangeThemeFn {
  const mutate = runMutation<{ id: string; themeMode: ThemeMode }, void>(
    (client, payload) =>
      client.from('profiles').update({ theme_mode: payload.themeMode }).eq('id', payload.id),
    getClient,
  );

  return async (payload) => {
    const client = getClient();
    const userId = await resolveCurrentUserId(client);
    await mutate({ id: userId, themeMode: payload.themeMode });
  };
}

/** `SettingsPage.tsx`'s own real default `onChangeTheme`. */
export const changeTheme: OnChangeThemeFn = makeChangeTheme();

/** `NotificationPrefKey` -> real `notification_prefs` column name (module
 * doc #2's `toggleNotificationPref` -- the ONE place this mapping lives). */
const NOTIFICATION_PREF_COLUMN: Record<NotificationPrefKey, string> = {
  invite: 'invite',
  signupConfirm: 'signup_confirm',
  eventReminder48h: 'event_reminder_48h',
  eventReminder3h: 'event_reminder_3h',
  meetingReminder3h: 'meeting_reminder_3h',
  weeklyDigest: 'weekly_digest',
  digestEnabled: 'digest_enabled',
};

/**
 * `SettingsPage.tsx`'s own default `onToggleNotificationPref` (module doc
 * #2). Unlike the three seams above, this one needs no `resolveCurrentUserId`
 * call -- the caller-supplied `payload.profileId` (SettingsPage.tsx's own
 * already-loaded `profile.id`) is trusted directly, matching
 * `notification_prefs`'s own RLS `self_all` policy (`20260717000002_rls.sql`,
 * lines 240-243: `for all to authenticated using (profile_id = auth.uid())
 * with check (profile_id = auth.uid())`, read directly rather than assumed)
 * -- `for all` covers select/insert/update/delete under that identical
 * using/with-check condition, so a caller-supplied `profileId` that doesn't
 * match the caller's own `auth.uid()` is REJECTED outright by RLS on the
 * INSERT half of the upsert below (a real, surfaced error -- not the old
 * silent zero-row UPDATE no-op).
 *
 * T109 fix: switched from a plain UPDATE keyed on `profile_id` to an UPSERT
 * (`onConflict: 'profile_id'`). Against a profile with no existing
 * `notification_prefs` row -- every real user today, per module doc above --
 * a bare UPDATE matches zero rows and silently no-ops (the same class of bug
 * T104 already disclosed for `togglePrivacy`), so a user's very first toggle
 * never actually persisted even though the UI showed it as changed.
 *
 * The upsert payload deliberately sends ONLY `profile_id` plus the one
 * toggled column -- never the other six columns -- for two reasons, both
 * confirmed directly against `notification_prefs`'s own migration
 * (`20260717000001_support_audit.sql`, lines 32-43, `not null default
 * true` on every one of the seven boolean columns):
 *   - On INSERT (no existing row, the first-toggle case): every column
 *     omitted from the payload falls back to its own real Postgres column
 *     default (`true`), so the resulting row ends up "all seven column
 *     defaults plus the one toggled value" -- exactly matching what
 *     `loadSettingsData`'s own synthesized `DEFAULT_NOTIFICATION_PREFS` row
 *     above already assumes a fresh row would contain.
 *   - On UPDATE (conflict on `profile_id`, an existing row): PostgREST's
 *     generated `ON CONFLICT (profile_id) DO UPDATE SET ...` only assigns
 *     the columns actually present in the request body, so every OTHER
 *     already-customized pref on that row is left untouched. Sending the
 *     full seven-column defaults object on every call instead (an
 *     alternative considered and rejected) would have CLOBBERED any
 *     previously toggled-off pref back to `true` on every subsequent,
 *     unrelated toggle -- a real data-loss bug this narrower payload avoids.
 */
export function makeToggleNotificationPref(
  getClient: () => SupabaseClient = getSupabaseClient,
): OnToggleNotificationPrefFn {
  return runMutation<ToggleNotificationPrefPayload, void>(
    (client, payload) =>
      client.from('notification_prefs').upsert(
        {
          profile_id: payload.profileId,
          [NOTIFICATION_PREF_COLUMN[payload.key]]: payload.value,
        },
        { onConflict: 'profile_id' },
      ),
    getClient,
  );
}

/** `SettingsPage.tsx`'s own real default `onToggleNotificationPref`. */
export const toggleNotificationPref: OnToggleNotificationPrefFn = makeToggleNotificationPref();

function buildAvatarObjectPath(userId: string, file: File): string {
  const dotIndex = file.name.lastIndexOf('.');
  // SEC-02 ("No PII in URLs"): the ORIGINAL filename is never used as part
  // of the stored object path (module doc #3) -- only its extension, if any.
  const extension = dotIndex >= 0 ? file.name.slice(dotIndex) : '';
  return `${userId}/${Date.now()}${extension}`;
}

/**
 * `SettingsPage.tsx`'s own default `onUploadAvatar` (module doc #3) -- the
 * real upload against the `avatars` Storage bucket
 * (`../../../../supabase/migrations/20260720000001_avatar_storage.sql`) plus
 * the `profiles.avatar_url` update.
 */
export function makeUploadAvatar(
  getClient: () => SupabaseClient = getSupabaseClient,
): OnUploadAvatarFn {
  const updateAvatarUrl = runMutation<{ id: string; avatarUrl: string }, void>(
    (client, payload) =>
      client.from('profiles').update({ avatar_url: payload.avatarUrl }).eq('id', payload.id),
    getClient,
  );

  return async (file: File): Promise<UploadAvatarResult> => {
    const client = getClient();
    const userId = await resolveCurrentUserId(client);
    const path = buildAvatarObjectPath(userId, file);

    // Module doc #3, point 3: a DIFFERENT transport than Postgrest -- errors
    // here propagate unwrapped (`StorageError extends Error`), not run
    // through `runMutation`'s Postgrest-shaped error normalization.
    const { error: uploadError } = await client.storage.from(AVATAR_BUCKET).upload(path, file, {
      upsert: true,
      contentType: file.type || undefined,
    });
    if (uploadError) {
      throw uploadError;
    }

    // Module doc #3, point 4: requires zero storage.objects RLS permissions
    // per Storage's own documented contract for a public bucket.
    const {
      data: { publicUrl },
    } = client.storage.from(AVATAR_BUCKET).getPublicUrl(path);

    await updateAvatarUrl({ id: userId, avatarUrl: publicUrl });

    return { avatarUrl: publicUrl };
  };
}

/** `SettingsPage.tsx`'s own real default `onUploadAvatar`. */
export const uploadAvatar: OnUploadAvatarFn = makeUploadAvatar();

/**
 * `SettingsPage.tsx`'s own default `onSignOutEverywhere` (module doc #4) --
 * the real, global-scope Supabase Auth sign-out, distinct from `guards.tsx`'s
 * `logout()` per that file's own module doc #3 (T060), untouched here.
 */
export function makeSignOutEverywhere(
  getClient: () => SupabaseClient = getSupabaseClient,
): OnSignOutEverywhereFn {
  return async () => {
    const client = getClient();
    const { error } = await client.auth.signOut({ scope: 'global' });
    if (error) {
      throw error;
    }
  };
}

/** `SettingsPage.tsx`'s own real default `onSignOutEverywhere`. */
export const signOutEverywhere: OnSignOutEverywhereFn = makeSignOutEverywhere();
