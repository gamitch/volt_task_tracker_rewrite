-- T105 (ED-1 Packet P12): closes the one genuine new-infrastructure gap
-- `SettingsPage.tsx`'s own module doc already disclosed (module doc #8, T060):
-- no Supabase Storage bucket, and no RLS policies on `storage.objects`, exist
-- anywhere for avatar upload. See this migration's own worker packet
-- (`docs/swarm/active/T105-worker-packet.md`) for the full investigation this
-- comment summarizes.
--
-- Additive-only (constitution item 10): one `insert into storage.buckets`
-- plus four new `create policy` statements on the platform-managed
-- `storage.objects` table. No existing migration file is modified by this
-- one, and this file does not touch `public.profiles` or any other
-- application table at all -- `profiles.avatar_url` (created by
-- 20260716000000_identity_roster.sql, line 21; widened to nullable by
-- 20260718000000_invite_trigger.sql, lines 44-45) already exists and is
-- written by the application layer only (`src/lib/supabase/loaders/
-- settings.ts`'s `uploadAvatar`), never by a database trigger here.
--
-- `storage.buckets`/`storage.objects` themselves are NOT created by this
-- migration -- they are managed, pre-existing tables the real Supabase
-- platform provisions for every project (confirmed: grepped every file
-- under `supabase/migrations/` for `storage.buckets`/`storage.objects`
-- before writing this file -- zero hits, only unrelated `config.toml`
-- sections, per this task's own Known Context/Traps #3). This migration only
-- inserts one row into the platform's existing `storage.buckets` table and
-- attaches RLS policies to the platform's existing `storage.objects` table,
-- the same scope every real Supabase Storage-bucket migration has.
--
-- -----------------------------------------------------------------------
-- Bucket-visibility decision -- PUBLIC (`public = true`), investigated
-- against this task's own Known Context/Traps #3 prompt (verify against
-- SEC-04/ROS-08, not just "avatars are shown across the app"):
--
--   1. Consumer-compatibility (the deciding, technical reason): two
--      already-Passed, forbidden-to-this-task files bind `profiles
--      .avatar_url` directly as a `src=` prop with no signed-URL refresh
--      mechanism anywhere in this codebase --
--      `src/pages/roster/ParentsTab.tsx` (`<Avatar ... src={row.avatarUrl
--      ?? undefined} />`, that file's own module doc citing `avatar_url`
--      directly off `profiles`) and `src/components/nav/TopNav.tsx`. A
--      PRIVATE bucket's URLs are short-lived signed URLs; storing one in
--      the long-lived `profiles.avatar_url` text column would silently
--      start 404ing once it expired, and neither of those two consuming
--      files (nor any other reader of `avatar_url` in this codebase) has
--      any mechanism to notice an expired URL and re-request a fresh
--      signed one. This task is not authorized to edit either consumer
--      (both outside this task's Allowed Files). A PUBLIC bucket's
--      `getPublicUrl()` produces a stable URL that never expires, matching
--      what every existing consumer of this column already assumes.
--   2. Path convention (`{auth.uid()}/...`, enforced by the policies below)
--      keeps object names effectively unguessable even though the bucket
--      is public: discovering an avatar requires already knowing both the
--      owning user's real `auth.uid()` (a random UUID, never exposed in
--      any URL/log per SEC-02) and the exact generated filename.
--   3. Real, disclosed tension with SEC-04, NOT resolved by this migration:
--      PRD Section 8.3's own literal text states "no photos in v1" for
--      students (who are minors). This is in genuine tension with PRD line
--      354 ("Profile (display name, avatar upload via `FileInput` ->
--      Supabase Storage)", already an explicit part of SET-01) and with
--      `SettingsPage.tsx`'s own FileInput-based avatar UI, which T060
--      already built and Passed before this task existed. This task's own
--      packet scopes it to WIRING that already-shipped, already-Passed UI
--      to real infrastructure ("this task's own packet... not
--      re-litigating T060's already-Passed decision to build the UI at
--      all") -- it does not re-open whether avatar upload should exist in
--      v1 at all. Flagged here, in the worker's Required Output, and left
--      for a follow-up product/scope decision, not silently resolved
--      either way by this migration.
--   4. Scope check on WHO is actually photographed: of this codebase's real
--      `Avatar` usages, only two show another person's real photo
--      (uploaded via this exact flow) to someone other than themselves --
--      `TopNav.tsx` (a user's own avatar, self-view only) and
--      `ParentsTab.tsx` (a parent/guardian's -- an adult's -- avatar,
--      shown to admin/coach staff on the roster). Every STUDENT-identifying
--      `Avatar` usage already confirmed elsewhere in this codebase
--      (`StudentsTab.tsx`, `OutreachList.tsx`'s `AvatarGroup`s) renders
--      `name`-only initials, never a `src`/photo, because `public.students`
--      itself has no `avatar_url` column at all (only `public.profiles`
--      does) -- a real, pre-existing, independently-arrived-at schema
--      boundary this migration does not change. A minor with `role =
--      'student'` who also happens to have their own `profiles` row could
--      still upload a photo of themselves via this exact Settings flow,
--      which remains the live tension noted in point 3 above.

insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

-- T110 HOTFIX: the `alter table storage.objects enable row level security;`
-- statement that previously lived here has been REMOVED. It failed hard
-- against George's real, live, hosted Supabase project:
--
--   ERROR: must be owner of table objects (SQLSTATE 42501)
--   At statement: 1
--   alter table storage.objects enable row level security
--
-- Root cause: on every real, hosted Supabase project, `storage.objects` is
-- owned by a Supabase-managed system role and RLS is force-enabled on it by
-- the platform from project creation -- it can never be altered by the
-- ordinary migration-applying role, full stop. That is not a bug to work
-- around; it is the correct, by-design platform posture, and this line was
-- never actually necessary in the first place. The line only ever passed
-- during T105's own local verification because that verification ran
-- against a hand-built scratch-Postgres `storage.objects` STAND-IN table
-- that this project's own migration files create fresh with RLS off (bare
-- Postgres has no `storage` schema at all) -- a stub that does not
-- replicate real Supabase's ownership/force-RLS model, so this failure mode
-- was invisible until this migration actually ran against a real project.
-- The standard, documented Supabase Storage-policy migration pattern is
-- exactly what remains below: `create policy ... on storage.objects`
-- statements with no preceding `alter table ... enable row level security`,
-- because that statement only ever makes sense for a schema you fully own
-- yourself, which `storage.objects` on a hosted project never is.

-- Readable by anyone -- matches the public bucket's own `getPublicUrl()`
-- contract every existing consumer (`ParentsTab.tsx`, `TopNav.tsx`,
-- `SettingsPage.tsx`) already relies on, and covers authenticated API-level
-- reads (`.list()`, etc.) in addition to the public CDN URL path (which does
-- not require a `storage.objects` SELECT policy at all per Supabase's own
-- documented `getPublicUrl()` RLS requirements: "objects table permissions:
-- none"). `drop policy if exists` immediately before each `create policy`
-- below (T110 hotfix hygiene) makes this migration safely re-runnable if a
-- future `supabase db push` needs to retry after a partial failure, without
-- changing what any policy actually allows.
drop policy if exists avatars_read on storage.objects;
create policy avatars_read on storage.objects
  for select
  using (bucket_id = 'avatars');

-- A caller may upload ONLY into their own `{auth.uid()}/...` folder --
-- `storage.foldername(name)` is the documented Supabase Storage RLS idiom
-- for extracting the folder-path segments of an object's `name`; comparing
-- its first segment against `auth.uid()::text` is what actually prevents
-- one authenticated user from writing (or overwriting) another user's
-- avatar object, the one hard requirement this task's packet flags. Scoped
-- to `to authenticated` (never `anon`) -- an unauthenticated caller has no
-- `auth.uid()` to scope a folder to at all.
drop policy if exists avatars_insert_own on storage.objects;
create policy avatars_insert_own on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- A caller may overwrite/replace ONLY an existing object already inside
-- their own folder -- both `using` (which existing rows are even
-- reachable) and `with check` (what the replaced row is allowed to look
-- like afterward) are scoped identically, so this policy alone cannot be
-- used to move/rename an object into another user's folder either.
drop policy if exists avatars_update_own on storage.objects;
create policy avatars_update_own on storage.objects
  for update to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- A caller may delete ONLY their own existing object(s) -- not required by
-- the upload/update flow `src/lib/supabase/loaders/settings.ts`'s
-- `uploadAvatar` itself exercises (which always uploads under a fresh,
-- timestamped filename and never issues a DELETE), but included for the
-- same "own folder only, nothing broader" scope as the two policies above,
-- so this bucket is never left with an insert/update-only, delete-denied-
-- for-everyone gap that would silently accumulate orphaned objects with no
-- owner-initiated way to clean them up.
drop policy if exists avatars_delete_own on storage.objects;
create policy avatars_delete_own on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
