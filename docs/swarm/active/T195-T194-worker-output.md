# T195 + T194 worker output

Worker implementation only; independent checker/orchestrator acceptance is still required.

## Commits

- `3ed3f9c55f6665dbb6d4faa4e1794112c9e7dd3e` — lifecycle migration, RPC writer,
  component reconciliation, and deterministic tests.
- `5a88c26f8a9085f06a74c84ca68ec5be90a60cf7` — keep the real reset default
  callable when an existing test partially mocks only the loader module's read export.
- The eight mutations were replayed against exact candidate `5a88c26` after this
  compatibility commit; its detached mutation worktree was restored, verified clean,
  and removed.

## Files changed

- `supabase/migrations/20260802000000_calendar_feed_lifecycle.sql`
- `src/lib/supabase/loaders/calendarFeed.ts`
- `src/lib/supabase/loaders/calendarFeed.test.ts`
- `src/pages/calendar/SubscribePopover.tsx`
- `src/pages/calendar/SubscribePopover.test.tsx`
- `supabase/tests/calendar_feed_platform_stub.sql`
- `supabase/tests/calendar_feed_lifecycle_pre.sql`
- `supabase/tests/calendar_feed_lifecycle_assertions.sql`
- `supabase/tests/run_calendar_feed_lifecycle.sh`
- `docs/swarm/active/T195-T194-worker-output.md` (this evidence record)

No existing migration, other swarm/governance record, package file, ICS function, or
other forbidden path was changed.

## Behavior implemented

- Reconciles duplicate active feeds by retaining greatest `(created_at, id)` and
  soft-revoking every other row without deleting history.
- Enforces at most one active feed per profile with a partial unique index.
- Backfills existing profiles and provisions future profile inserts through a locked,
  trigger-only `SECURITY DEFINER` function with `PUBLIC` execution revoked.
- Adds `reset_calendar_feed(uuid)` as an explicit `SECURITY INVOKER` SETOF RPC. It
  derives ownership from `auth.uid()`, atomically revokes the named active row, inserts
  a database-generated replacement, returns exactly that row, and grants execution only
  to `authenticated`.
- Adds injectable `makeResetCalendarFeed` and singleton `resetCalendarFeed`; the writer
  makes one `.rpc(...).single()` call and never sends `payload.profileId` as server
  authorization.
- Makes the real RPC writer the component default. Reset rejection always reconciles by
  reading the active feed: an old or newly committed authoritative row is installed;
  if reconciliation also fails, the possibly stale URL and copy/reset actions are hidden
  behind an honest unknown-status banner.
- Adds deterministic loader/component tests and a PostgreSQL 17 lifecycle runner. The
  runner applies every production migration byte-unchanged except it prints and skips
  exactly `20260719000000_cron.sql`.

## Final verification at `5a88c26`

- `npm test -- --run src/lib/supabase/loaders/calendarFeed.test.ts src/pages/calendar/SubscribePopover.test.tsx`
  — exit `0`; 2 files, 29 tests passed.
- `PATH="/usr/local/opt/postgresql@17/bin:$PATH" PGHOST=/tmp PGPORT=55432 PGUSER=georgemitchom bash supabase/tests/run_calendar_feed_lifecycle.sh`
  — exit `0`; all 10 named lifecycle/security assertions passed; runner printed the
  exact cron-only skip; scratch database cleanup ran through the EXIT trap.
- `npm run typecheck` — exit `0`.
- `npm run format:check` — exit `0`.
- `npm run lint` — exit `0`; 0 errors, 359 warnings. Packet-dispatch baseline
  `a98501c` measured 0 errors, 360 warnings, so this change reduces warnings by 1.
- `npm run test` — exit `0`; 76 files, 1,837 tests passed.
- `npm run build` — exit `0`; 2,397 modules transformed. Vite emitted its existing
  large-chunk advisory; build completed successfully.

The component tests continue to emit the repository's existing jsdom `act`, canvas, and
`scrollTo` diagnostics; they do not change exit status or assertions.

## Mutation evidence at exact candidate `5a88c26`

1. Removed backfill insert — SQL runner exit `3`: `FAIL existing-profile-backfill`
   (expected 1 active feed, got 0).
2. Removed profile trigger — SQL runner exit `3`: `FAIL invite-acceptance-provisioning`.
3. Removed partial unique index — SQL runner exit `3` while applying the unchanged
   conflict-safe backfill: no unique/exclusion constraint matched the conflict target.
4. Changed reset to `SECURITY DEFINER` and removed the `auth.uid()` owner predicate —
   SQL runner exit `3`: `FAIL cross-owner-reset-denied` because the target feed reset.
5. Sent `payload.profileId` instead of the current feed id — loader test exit `1`;
   1 failed / 10 passed, with the recorded RPC argument mismatch.
6. Replaced the production default with a resolving local fake — component test exit
   `1`; 1 failed / 17 passed, because the real reset writer spy received 0 calls.
7. Removed rejection reconciliation — component test exit `1`; 3 failed / 15 passed,
   including `installs the authoritative new URL when the reset response is lost after commit`
   and the unknown-status URL-hiding test.
8. Removed the reset RPC's `PUBLIC` revoke — SQL runner exit `3`:
   `FAIL rpc-privilege-boundary` (`anon`/`PUBLIC` could execute).

No mutation stayed green. The final mutation worktree returned clean at `5a88c26` before
removal; the candidate branch remained unchanged.

## Known risks / verification boundaries

- The task-specific stub intentionally models only the hosted Supabase platform objects
  current migrations reference. It is not a full local Supabase stack. The suite still
  exercises real PostgreSQL 17 RLS roles and applies every non-cron production migration
  unchanged.
- No live hosted migration, push, deployment, or PR was performed; those external actions
  remain with the orchestrator/owner.

## Disputes

None.

## Deferred — for the ledger

None.
