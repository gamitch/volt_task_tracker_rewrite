# Worker Packet: T109

## Task ID
T109 — Fix `loadSettingsData` hard-failing for every user who has no
`notification_prefs` row (which is currently every user).

## Objective
George live-tested `/settings` and got "Couldn't load settings." Root cause,
confirmed by code inspection: `loaders/settings.ts`'s `loadSettingsData` throws
`'No notification preferences were found for your account.'` when the
`notification_prefs` query returns no row — and **nothing anywhere ever creates
that row**: `fn_handle_invite_acceptance` (the invite trigger) creates only the
`profiles` row, no code inserts into `notification_prefs`, and no migration
backfills it. So every real user hits this error and the Settings page is
unusable.

## Allowed Files
- `src/lib/supabase/loaders/settings.ts`
- `src/pages/settings/SettingsPage.test.tsx` (for the loader-level tests that
  live there)

## Forbidden Files
- `src/pages/settings/SettingsPage.tsx` — already correct (T105), read-only. The
  fix belongs in the loader, not the page.
- `supabase/migrations/**` — read-only. Do NOT write a migration/trigger for this
  (see Trap #2 for why the loader-side fix is the right scope here).
- Every other file.

## Known Context / Traps

**1. The fix: treat a missing `notification_prefs` row as "all defaults," not an
error.** The table's own migration (`20260717000001_support_audit.sql`) gives
every pref column a `default true` — a missing row is semantically identical to a
row of defaults. `loadSettingsData` should synthesize the default
`NotificationPrefsRow` (all `true`, matching the column defaults — read the
actual migration to confirm each column's real default rather than assuming all
are `true`) when `maybeSingle()` returns null, instead of throwing. Keep the
missing-`profiles`-row case as a real error (that genuinely indicates something
wrong — the trigger should always have created it).

**2. The write side — investigate `toggleNotificationPref` against a missing
row.** `toggleNotificationPref` currently does an UPDATE keyed on `profile_id`.
Against a user with no row, a plain UPDATE matches zero rows and silently no-ops
(same class of issue T104 disclosed for `togglePrivacy`). Since the read side now
synthesizes defaults, the write side must genuinely persist: switch it to an
UPSERT (`onConflict: 'profile_id'`) that writes the full defaults row plus the
one toggled value on first write. Check `notification_prefs`' RLS (`self_all`,
`with check (profile_id = auth.uid())`) permits the insert — read the actual
policy. This keeps the whole fix client-side with no migration/trigger needed,
which is why the migration path is forbidden here: additive-trigger changes are a
bigger decision (constitution item 10) and unnecessary once upsert handles it.

**3. Tests.** Extend the existing loader-level suites in `SettingsPage.test.tsx`
(T105's pattern, stubbed `SupabaseClient`): missing-prefs-row → resolves
defaults, doesn't reject; `toggleNotificationPref` against no existing row →
upserts a full row with the toggled value; existing-row paths unchanged.

## Acceptance Criteria
- `/settings` loads for a user with a `profiles` row but no `notification_prefs`
  row (the current state of every real user).
- Toggling a pref genuinely persists for such a user (upsert, not a silent
  zero-row update).
- `npm run typecheck`, `npm run lint`, `npm run test`, `npm run build`, `npm run
  format:check` all clean, zero regressions.

## Relevant Constitution Excerpts
> No worker may mark its own work complete; every PASS requires independent
> checker-inspected evidence.

## Most Recent Failure
None. Attempt 1 (attempt count: 0). HIGH PRIORITY — live-reported by George.

## Required Worker Output
- Full diff.
- Confirmation of each pref column's real DB default (Trap #1) and the RLS check
  for the upsert (Trap #2).
- Full test/typecheck/lint/build/format:check output.
- Known risks; dispute flag if needed.
