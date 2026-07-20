# Worker Packet: T105

## Task ID
T105 — ED-1 Packet P12: real `SettingsPage.tsx` data + mutations, including a new
Supabase Storage bucket + policies for avatar upload.

## Objective
`SettingsPage.tsx` (SET-01/02/03) has five real, already-built sections, all
currently backed by fixture/stub seams (`defaultLoadSettingsData`,
`defaultOnUpdateProfile`, `defaultOnUploadAvatar`, `defaultOnChangeTheme`,
`defaultOnToggleNotificationPref`, `defaultOnSignOutEverywhere`). Every backing
column already exists (`profiles.avatar_url`, `profiles.theme_mode`, the full
`notification_prefs` table) EXCEPT avatar upload, which the file's own module doc
already discloses has no Storage bucket yet — that part needs a real, small,
additive migration, same class of gap T104 closes for the leaderboard.

## Allowed Files
- `supabase/migrations/20260720000001_avatar_storage.sql` (new — use exactly this
  filename/timestamp, chosen to sort after the existing latest migration and to
  avoid colliding with a sibling task's own new migration file)
- `src/lib/supabase/loaders/settings.ts` (new)
- `src/pages/settings/SettingsPage.tsx`, `SettingsPage.test.tsx`

## Forbidden Files
- Every existing file under `supabase/migrations/` — read-only (additive-only, new
  file, per constitution item 10).
- `src/pages/settings/SeasonSettings.tsx` — already correctly real (T091), not in
  scope here, read-only if you need to check its own Supabase-wiring conventions
  for consistency.
- `src/lib/supabase/loaders/{client,auth,types,loader,functions}.ts` — read-only
  imports as needed.
- `src/app/guards.tsx` — read-only; `logout()` stays distinct from
  `onSignOutEverywhere` per the file's own module doc #3, do not conflate them or
  modify this file.
- Every other file. `router.tsx`, `docs/swarm/**`, `.claude/**`.

## Known Context / Traps

**1. Profile, theme, notification-prefs — ordinary real wiring, same pattern as
every other ED-1 packet.** `loadSettingsData` (real `profiles` row for the caller +
real `notification_prefs` row, joined/shaped into `SettingsData`), `onUpdateProfile`
(real `profiles.display_name` update), `onChangeTheme` (real
`profiles.theme_mode` update), `onToggleNotificationPref` (real
`notification_prefs` column update, keyed by `NotificationPrefKey` — read the
file's own snake_case/camelCase field mapping in `NotificationPrefsRow`). All
straightforward Postgrest reads/writes via `loaders/settings.ts`, same DI
(`getClient`) convention every prior `loaders/*.ts` file already established.

**2. `onSignOutEverywhere` — a real Supabase Auth call, no schema needed.** Per the
file's own module doc #3 (already correctly reasoned through by T060, do not
re-litigate it): call the real global-scope sign-out
(`client.auth.signOut({ scope: 'global' })` or equivalent — verify the exact
supabase-js v2 API shape yourself against `auth.ts`'s existing client usage rather
than assuming), distinct from and never a substitute for `guards.tsx`'s own
`logout()`. `SettingsPage.tsx`'s own `handleConfirmSignOutEverywhere` already
correctly awaits this seam FIRST, then separately calls `logout()` — do not change
that ordering, only make the seam itself real.

**3. Avatar upload — THE actual new-infrastructure trap, investigate before
writing the migration.** No Storage bucket exists yet (confirmed: grep every
migration file yourself for `storage.buckets`/`storage.objects`/`bucket` — you
will find zero hits, only unrelated `config.toml` sections). You need:
   - A new bucket (likely a `insert into storage.buckets (id, name, public, ...)
     values (...)` in your new migration — investigate whether `public = true` is
     appropriate here: avatars are shown across the app (leaderboard, roster, etc.
     per T044/other already-Passed tasks' own module docs) and are not
     privacy-sensitive PII themselves in the way a name/email is, so a public
     bucket with a predictable/scoped path structure is a reasonable default, but
     verify this reasoning against the PRD's own data-classification language
     (SEC-04/ROS-08) yourself rather than assuming — document your decision either
     way.
   - RLS policies on `storage.objects` scoped to that bucket: a caller should be
     able to upload/update only their OWN avatar (path convention: investigate a
     sensible one, e.g. keyed by `auth.uid()` as part of the object path, verified
     via `storage.foldername(name)` or equivalent Supabase Storage RLS idiom — this
     is a well-established Supabase pattern, look at how Supabase's own docs/the
     installed `@supabase/supabase-js` types describe Storage RLS if you need a
     reference shape, but do not fabricate a policy that would let any
     authenticated user overwrite another user's avatar).
   - The real `onUploadAvatar` implementation: uploads the file to this bucket
     under the caller's own scoped path, then updates `profiles.avatar_url` to the
     resulting public URL (or signed URL, matching whatever bucket-visibility
     decision you made above), returning `{ avatarUrl }` per the existing
     `UploadAvatarResult` shape.
   - `profiles.avatar_url` is `not null` but nullable was later relaxed by a prior
     migration (`20260718000000_invite_trigger.sql` — read-only reference, already
     landed) for the invite-acceptance case specifically; that does not change
     this task's own upload path, which always has a real file and always produces
     a real non-empty URL.

**4. Update stale disclosures.** The current `defaultOnUploadAvatar`'s "no bucket
exists yet" `console.warn` and the file's own module doc #8/#9 gap language must be
removed/updated once this is genuinely wired — do not leave stale "not wired"
claims once it's real.

**5. Test files.** Same "inject the fixture explicitly through the seam" pattern
established by every prior ED-1 packet. For the Storage-upload path specifically,
a real network/Storage call cannot run in `vitest` — inject a stubbed Supabase
client's `storage.from(...).upload(...)` the same way every prior loader test in
this project has stubbed `SupabaseClient` table methods; do not attempt to hit a
real bucket in tests.

## Acceptance Criteria
- Profile/theme/notification-prefs are real reads/writes.
- `onSignOutEverywhere` makes a real global-scope Supabase Auth sign-out call,
  distinct from and chained before `logout()`, matching the file's existing
  two-step flow.
- A new Storage bucket + RLS policies exist, scoped so a caller can only write
  their own avatar; `onUploadAvatar` is a real upload + `profiles.avatar_url`
  update.
- Stale "not wired"/"no bucket" disclosures are removed/updated.
- `npm run typecheck`, `npm run lint`, `npm run test`, `npm run build`, `npm run
  format:check` all clean, zero regressions elsewhere.
- Migration SQL verified valid the same way T104/prior migration-writing tasks
  verified theirs (check `docs/swarm/verification-log.md` for the established
  approach) — do not just assume it's syntactically correct.

## Relevant Constitution Excerpts
> Constitution item 10: migrations are additive-only, a properly-scoped decision.

> No worker may mark its own work complete; every PASS requires independent
> checker-inspected evidence.

## Most Recent Failure
None. This is attempt 1 for T105 (attempt count: 0) — first dispatch.

## Required Worker Output
- Full diff of every changed/new file, including the full new migration SQL.
- Your bucket-visibility (public vs. private/signed) decision and reasoning
  (Trap #3), with the exact RLS policies you wrote and why they're sufficient to
  prevent one user overwriting another's avatar.
- Full test/typecheck/lint/build/format:check output, plus however you verified
  the migration SQL itself is valid.
- Known risks; whether a dispute is needed (you flag, you don't resolve).
