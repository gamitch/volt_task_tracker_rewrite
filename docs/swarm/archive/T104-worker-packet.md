# Worker Packet: T104

## Task ID
T104 — ED-1 Packet P11: close the leaderboard-privacy schema gap (a real, small,
additive migration) and wire `AdminToggles.tsx` + `Leaderboard.tsx` to it for real.

## Objective
Two already-Passed tasks (T028 `AdminToggles.tsx`, T044 `Leaderboard.tsx`) each
independently investigated and confirmed there is genuinely no persisted column
anywhere in the schema for ROS-08's leaderboard-privacy setting, and each disclosed
this as a dispute-candidate follow-up rather than silently inventing one. Both
already built real, working UI against a matching `LoadPrivacySettingFn = () =>
Promise<boolean>` seam (`AdminToggles.tsx` also has a write side —
`TogglePrivacyFn`, read the file for its exact shape), defaulting to fixture
stand-ins. This packet closes the actual gap: a real column, and real reads/writes
against it from both files.

## Allowed Files
- `supabase/migrations/20260720000000_leaderboard_privacy.sql` (new — use exactly
  this filename/timestamp, chosen to sort after the existing latest migration
  `20260719000000_cron.sql` and to avoid colliding with a sibling task's own new
  migration file)
- `src/lib/supabase/loaders/leaderboard_privacy.ts` (new)
- `src/pages/roster/AdminToggles.tsx`, `AdminToggles.test.tsx`
- `src/pages/outreach/Leaderboard.tsx`, `Leaderboard.test.tsx`

## Forbidden Files
- Every existing file under `supabase/migrations/` — read-only (you are adding a
  new file, not editing an existing one; additive-only per constitution item 10).
- `src/lib/supabase/loaders/{client,auth,types,loader,functions}.ts` — read-only
  imports as needed.
- Every other file. `router.tsx`, `guards.tsx`, `docs/swarm/**`, `.claude/**`.

## Known Context / Traps

**1. The column — already reasoned through by T028, re-verify then use it.**
`AdminToggles.tsx`'s own module doc (read it in full) reasons through and
recommends: `seasons.leaderboard_show_full_name boolean not null default true`
(SEC-04's default-ON), on `seasons` rather than `teams`, because the setting is
framed as a season-wide preference, matching `seasons.default_goal_hours` as the
one other roster-adjacent per-period configurable value already in this schema.
**Independently re-verify this reasoning yourself before writing the migration**
(re-read ROS-08/SEC-04 in `docs/swarm/VOLT_Portal_PRD.md`, re-grep the current
schema) — you are not required to agree with T028's guess if your own
investigation finds it wrong, but if you deviate, document exactly why, the same
standard T102's checker held that task's own deviation to.

**2. RLS — already covers this correctly, verify, don't add new policy.**
`supabase/migrations/20260717000002_rls.sql`'s existing `seasons` policies
(`staff_all` for insert/update/delete/all via `is_staff()`, `read_all` for any
authenticated select) already correctly gate a new column on this table with no
changes needed — `AdminToggles.tsx` is UI-gated admin-only but the RLS floor is
"any staff (admin or coach) may write," matching every other `seasons` write in
this codebase (e.g. `updateSeason`). Verify this yourself against the actual RLS
file before assuming it; do not write a new RLS policy unless your own
verification finds the existing ones genuinely insufficient (if so, stop and
document why rather than writing one — a new RLS policy is a bigger decision than
this packet's scope, flag it as a dispute candidate instead).

**3. Loader.** `loaders/leaderboard_privacy.ts`: a real `loadPrivacySetting`
(reads the new column for the caller's relevant season — investigate whether
"caller's relevant season" means the currently-active season, mirroring
`loaders/seasons.ts`'s own `loadActiveSeason`/`SeasonProvider.tsx` pattern; read
both, read-only, for this) and a real `togglePrivacy`/`onTogglePrivacy` (updates
the column for that same season). Both files (`AdminToggles.tsx`,
`Leaderboard.tsx`) already independently declare matching
`LoadPrivacySettingFn`/`TogglePrivacyFn`-shaped types — investigate whether they
can share one real implementation here (same class of decision T101 made for RSVP)
or need two; document your decision either way.

**4. Wire both consumers.** `AdminToggles.tsx`'s `loadPrivacySetting`/
`onTogglePrivacy` props and `Leaderboard.tsx`'s `loadPrivacySetting` prop both
switch their real defaults to this new loader. Remove/update each file's own
"schema gap" disclosure `Banner`/module-doc language once it's genuinely closed —
do not leave a stale "no column exists" disclosure once one does.

**5. Test files.** Same "inject the fixture explicitly through the seam" pattern
established by every prior ED-1 packet, across both files.

## Acceptance Criteria
- New migration is additive-only, adds exactly the reasoned-through column (or a
  documented, justified deviation), with a sensible `default` and `not null`
  matching SEC-04's default-ON requirement.
- `AdminToggles.tsx` and `Leaderboard.tsx` both read/write the real column via a
  real loader; both stale schema-gap disclosures are removed/updated.
- `npm run typecheck`, `npm run lint`, `npm run test`, `npm run build`, `npm run
  format:check` all clean, zero regressions elsewhere.
- If this project has a migration-apply/verification step used by prior migration-
  writing tasks (check `docs/swarm/verification-log.md` for how T009's or T028's
  own migration-adjacent work was verified), follow the same verification
  approach — do not just assume the SQL is syntactically valid, prove it.

## Relevant Constitution Excerpts
> Constitution item 10: migrations are additive-only, a properly-scoped decision.

> No worker may mark its own work complete; every PASS requires independent
> checker-inspected evidence.

## Most Recent Failure
None. This is attempt 1 for T104 (attempt count: 0) — first dispatch.

## Required Worker Output
- Full diff of every changed/new file, including the full new migration SQL.
- Your independent re-verification of T028's column-naming/placement reasoning
  (Trap #1), confirming or documenting a deviation.
- Your RLS-sufficiency verification (Trap #2).
- Your shared-vs-separate loader-function decision (Trap #3).
- Full test/typecheck/lint/build/format:check output, plus however you verified
  the migration SQL itself is valid.
- Known risks; whether a dispute is needed (you flag, you don't resolve).
