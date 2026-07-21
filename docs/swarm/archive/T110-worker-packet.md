# Worker Packet: T110

## Task ID
T110 — HOTFIX: `20260720000001_avatar_storage.sql` fails `supabase db push` against
a real hosted Supabase project.

## Objective
George ran `supabase db push` against his real, live Supabase project. The first
migration (`20260720000000_leaderboard_privacy.sql`) applied cleanly. The second
(`20260720000001_avatar_storage.sql`) failed hard:

```
ERROR: must be owner of table objects (SQLSTATE 42501)
At statement: 1
alter table storage.objects enable row level security
```

Root cause: on every real, hosted Supabase project, `storage.objects` is owned by
a Supabase-managed system role, RLS is force-enabled on it by the platform from
project creation, and it can never be altered by the ordinary migration-applying
role. The migration's own comment (read it — it explicitly frames this line as
"idempotent/defensive" against a project that "somehow" doesn't have RLS on
already) was written and tested against a **hand-built local Postgres stub schema**
(the checker's own from-scratch `storage.buckets`/`storage.objects` stand-in used
for local RLS verification, since bare Postgres has no `storage` schema at all) —
that stub does not replicate real Supabase's ownership model, so this failure mode
was invisible during T105's original verification. This is a real gap in how that
migration was verified, not a new design question — fix the migration so it
applies cleanly against a real project.

## Allowed Files
- `supabase/migrations/20260720000001_avatar_storage.sql`

## Forbidden Files
- `supabase/migrations/20260720000000_leaderboard_privacy.sql` — already applied
  successfully to the real project, read-only, do not touch.
- Every other migration file — read-only.
- `src/lib/supabase/loaders/settings.ts`, `src/pages/settings/SettingsPage.tsx` —
  the frontend seam this migration backs is already correct (T105/T109), out of
  scope, do not touch.
- Every other file. `docs/swarm/**`, `.claude/**`.

## Known Context / Traps

**1. The fix, with high confidence: remove the `alter table storage.objects
enable row level security;` statement entirely.** This is not a workaround, it is
the objectively correct fix: `storage.objects` RLS is unconditionally already
enabled on every Supabase-managed project from creation and cannot be
disabled by any project-level role — the statement is not just unnecessary,
it is one Supabase actively prevents ordinary roles from touching. Real-world
Supabase Storage-policy migrations (this is a widely-documented, standard
pattern — Supabase's own official docs on Storage access control show exactly
this) consist of `create policy ... on storage.objects` statements with NO
preceding `alter table ... enable row level security` line, because that
line only ever makes sense for a schema you fully own yourself.

**2. Verify `create policy` itself will actually succeed for the real
migration-applying role.** In Postgres, `CREATE POLICY` also nominally requires
table-owner-equivalent privilege — but Supabase specifically grants its
migration/CLI role (`postgres`, or whatever role `supabase db push` authenticates
as) the necessary rights to manage policies on `storage.objects` without full
ownership, precisely so that Storage RLS policies CAN be defined via ordinary SQL
migrations — this is the standard, supported, widely-used workflow, not an edge
case. You cannot test this against a real hosted project from this sandbox (no
network access to George's actual Supabase instance) — investigate and cite
whatever documented evidence you can find for this claim (check if this repo has
any `.md`/README notes about Supabase Storage migrations, check
`docs/swarm/VOLT_Portal_PRD.md` for any Storage-related guidance, and reason
carefully from Postgres/Supabase's well-established permission model) rather than
guessing blind. Document your confidence level explicitly.

**3. Defense in depth — consider wrapping the four `create policy` statements
too.** Given position #2's uncertainty (you cannot empirically verify against a
real project), consider making each `create policy` statement resilient to a
possible future re-run (e.g. `drop policy if exists <name> on storage.objects;`
immediately before each `create policy`, so the migration is safely re-runnable
if George needs to retry after a partial failure) — this is good migration
hygiene regardless of whether the CREATE POLICY permission question above turns
out fine. Do NOT wrap the CREATE POLICY statements in an exception-swallowing
block that would silently skip creating them on a real permission failure — that
would leave the avatar upload feature silently broken with no RLS protection,
which is worse than a loud migration failure. If CREATE POLICY genuinely can't
succeed for the applying role on a real project, that needs to surface loudly, not
be silently swallowed.

**4. `insert into storage.buckets (...)`.** Read the rest of the migration file —
confirm the bucket-insert statement itself doesn't have the same class of
ownership problem (it almost certainly doesn't; `storage.buckets` INSERT is the
standard, always-supported way to create a bucket via SQL, distinct from altering
RLS state on `storage.objects` — but verify this reasoning rather than assuming).

## Acceptance Criteria
- The migration no longer contains the `alter table storage.objects enable row
  level security` statement (or any other statement requiring `storage.objects`
  table ownership).
- The bucket insert and all four `create policy` statements are preserved,
  unchanged in their actual security semantics (same bucket id/name/public value,
  same four policies with the same `(storage.foldername(name))[1] =
  auth.uid()::text` gating logic T105's checker already verified).
- Your confidence-leveled investigation into whether `create policy` itself will
  succeed against a real project is documented in full.
- Re-verify the migration is still syntactically valid the same way T105's worker
  originally verified it (local scratch Postgres + hand-built storage stub, same
  precedent) — this won't catch the ownership issue itself (that's the whole
  problem, per this task's own root-cause framing) but should still confirm no
  other syntax regression was introduced by your edit.
- `npm run typecheck`, `npm run lint`, `npm run test`, `npm run build`, `npm run
  format:check` all clean (this migration has no direct frontend test coverage,
  but confirm zero regressions elsewhere in the repo).

## Relevant Constitution Excerpts
> Constitution item 10: migrations are additive-only, a properly-scoped decision.

> No worker may mark its own work complete; every PASS requires independent
> checker-inspected evidence.

## Most Recent Failure
This IS the failure report — a real `supabase db push` against George's live
project, exact error pasted above. Attempt 1 for T110 (attempt count: 0). HIGH
PRIORITY — George is actively blocked from finishing his live deployment.

## Required Worker Output
- Full diff of the one changed file.
- Your Trap #1/#2 investigation and confidence level on whether `create policy`
  will succeed against a real project, in full — this is the one thing that
  cannot be verified from this sandbox and George needs an honest confidence
  assessment, not false certainty.
- Confirmation the migration is still syntactically valid.
- Full test/typecheck/lint/build/format:check output.
- Known risks; whether a dispute is needed (you flag, you don't resolve).
