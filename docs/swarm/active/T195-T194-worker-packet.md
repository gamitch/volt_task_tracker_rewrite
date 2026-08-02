# Worker Packet: T195 + T194 — Provision and atomically reset calendar feeds

## Dispatch

- Workflow: **W6 — Calendar & subscribe**
- Tasks: **T195** (provision the first `calendar_feeds` row) and **T194**
  (replace the Reset-link stub with a real atomic reset)
- Process tier: **HEAVY** (constitution items 18 and 26) — this changes schema,
  adds a migration, and creates a write path
- Branch: `codex/t195-t194-calendar-feed-lifecycle`
- Worktree: `/private/tmp/volt-t195-t194`
- Base: `origin/main` at `690e757`
- Required sequence: premise checker → Frontier/Sol worker → independent
  Frontier/Sol checker → orchestrator integration
- The worker may edit the implementation and test files listed below. The
  orchestrator alone owns workflow, ledger, verification, and handoff records.

## Objective

Complete the calendar subscription lifecycle so every real profile receives
one persisted active feed, and Reset link atomically revokes the caller's
current feed and returns a newly persisted token. A successful reset must make
the old ICS URL stop working and the new URL start working without fabricating
ids or tokens in the browser.

T195 and T194 are deliberately paired. Shipping only T194 leaves every
existing profile on T177's honest missing-row error; shipping only T195 leaves
the production Reset action as a `console.warn` plus locally generated fake
row.

## Verified current facts — re-check before relying on them

1. `calendar_feeds` is created in
   `supabase/migrations/20260717000001_support_audit.sql`. It has a UUID primary
   key, `profile_id` foreign key, unique UUID token with
   `gen_random_uuid()` default, nullable `revoked_at`, and `created_at`. It has
   no one-active-row-per-profile constraint.
2. `20260717000002_rls.sql` gives authenticated callers a `self_all` policy on
   `calendar_feeds`, with both `USING` and `WITH CHECK` constrained to
   `profile_id = auth.uid()`.
3. `20260718000000_invite_trigger.sql` creates `profiles` rows during invite
   acceptance, but no migration, trigger, function, or application path
   creates a `calendar_feeds` row.
4. T177 made `loadCalendarFeed` real. It explicitly filters the requested
   profile and `revoked_at IS NULL`, orders newest first, limits to one, and
   fails loudly when none exists. Its duplicate-active-row tolerance is a
   temporary compatibility posture, not the final CAL-05 invariant.
5. `SubscribePopover` already sends one `ResetFeedTokenPayload` containing the
   active row id and profile id, awaits one callback, installs the returned row
   only after success, and preserves the prior row while showing an error on
   rejection. That UI state machine is already correct.
6. The production default for that callback is still
   `defaultOnResetFeedToken`, which logs and returns browser-generated fake
   ids/tokens. This is the T194 defect.
7. No production `supabase.rpc(...)` precedent exists in `src`. The shared
   `runMutation` helper does exist and normalizes client acquisition,
   transport, and Supabase errors. An RPC is nevertheless required here
   because revoke-old plus insert-new must be one database transaction.
8. `supabase/functions/ics/index.ts` uses the service-role client to resolve a
   persisted token and rejects missing or revoked rows with the same generic
   unauthorized response. Persisting `revoked_at` therefore invalidates the
   old URL without an ICS-function edit.
9. The repository has a plain-Postgres scratch harness precedent in
   `supabase/tests/run.sh`: apply `auth_stub.sql`, apply migrations unchanged,
   load fixtures, execute SQL assertions, and drop the database. There is no
   pgTAP or JavaScript Postgres dependency.
10. The latest existing migration is
    `20260731000000_leaderboard_students_view.sql`; this work needs one new,
    later additive migration.

## Security and lifecycle contract

The database, not the browser, owns the lifecycle.

- At migration time, reconcile any historical duplicate active rows by
  retaining one deterministic winner per profile and soft-revoking the rest.
  Do not delete audit history.
- Backfill exactly one active feed for every existing profile that has none.
- Provision one active feed for each future `profiles` insert. The trigger must
  work for the invite-acceptance path and direct administrative profile inserts.
- Enforce at most one row with `revoked_at IS NULL` per profile at the database
  level, including under concurrent requests. A partial unique index is the
  expected minimal mechanism.
- Reset must be one PostgreSQL function/RPC call and therefore one transaction:
  validate the authenticated identity, soft-revoke exactly the named current
  row, insert one replacement using database defaults, and return that row.
- Do not trust a client-supplied profile id for authorization or for selecting
  the row to revoke. Identity comes from `auth.uid()`. A caller must not reset
  another profile's feed, a revoked row, or an arbitrary nonexistent row.
- Preserve RLS. Prefer a security-invoker function so the shipped `self_all`
  policy remains the authorization boundary. If that is not feasible, stop and
  file a dispute rather than silently introducing a security-definer bypass.
- Revoke the function's default `PUBLIC` execute privilege and grant only the
  role(s) that need the RPC. Anonymous callers must not execute it.
- Keep UUID/token generation in PostgreSQL. The TypeScript reset path must not
  call `crypto.randomUUID()` or synthesize a successful row.
- A rejected reset leaves the original row active. PostgreSQL function
  transaction semantics must prevent a half-reset.

## Required implementation

### 1. Additive lifecycle migration

Create one migration later than the current migration set. It must:

1. deterministically soft-revoke all but one active row for any profile with
   duplicates;
2. create an active feed for every pre-existing profile that lacks one;
3. enforce at most one active row per profile;
4. create a narrowly scoped profile-insert provisioning function and trigger;
5. create an authenticated reset function callable through Supabase RPC;
6. set safe function search paths and explicit execute privileges; and
7. leave revoked rows present as audit history.

Use idempotent migration constructs where PostgreSQL supports them without
masking real schema drift. Do not edit an already-shipped migration.

### 2. Real reset mutation

Extend `src/lib/supabase/loaders/calendarFeed.ts` with the reset writer.

- Export an injectable `makeResetCalendarFeed(getClient)` and a singleton-bound
  production `resetCalendarFeed`.
- Accept the existing `ResetFeedTokenPayload` at the page seam so the component
  API remains stable.
- Send only the data the RPC needs. The server must derive the profile from
  `auth.uid()`; `payload.profileId` may be used for a defensive client/result
  consistency check, but never as server authorization.
- Invoke the reset function once, map the returned snake_case database row to
  `CalendarFeedRow`, and reject through the shared error-normalization posture.
- Treat a successful response with no returned row as an error; never fabricate
  a fallback result.

### 3. Production wiring

In `SubscribePopover.tsx`:

- default `onResetFeedToken` to the real `resetCalendarFeed`;
- remove the production fake reset implementation and its stale documentation;
- preserve the injectable prop, one-call payload builder, confirmation dialog,
  awaited state replacement, failure UI, and existing copy/URL behavior; and
- do not change T177's read loader or restore any fixture as a production
  fallback.

### 4. Deterministic tests

Add or extend TypeScript tests to prove:

- the reset writer makes exactly one RPC call with the named active feed id;
- it does not send the caller-provided profile id as the authorization target;
- it maps the returned row exactly and rejects Supabase, transport, or null-row
  failures;
- the component's production default reaches the real reset writer after
  confirmation, while injected reset tests remain deterministic; and
- the existing successful replacement and rejection/no-local-half-flip tests
  stay green.

Add a dedicated scratch-Postgres lifecycle test using the existing
`supabase/tests/auth_stub.sql` and `supabase/tests/run.sh` approach, without a
new dependency. It must apply the repository migrations unchanged and prove:

- a profile that existed before the new migration is backfilled;
- duplicate active rows present before migration are reconciled without
  deletion;
- a profile inserted after migration is provisioned;
- a second active row for one profile is rejected by the database;
- an authenticated owner can reset the named active row and receives exactly
  one new active row while the old row remains revoked;
- a different authenticated profile cannot revoke that row, and the failed
  attempt changes neither profile's active feed;
- resetting a revoked or nonexistent row fails without changing active state;
  and
- `PUBLIC`/anonymous execution is denied.

The SQL harness may use a task-specific runner/assertion file rather than
turning the existing NFR-03 runner into an unrelated omnibus suite. It must
drop its scratch database on both success and failure.

## Allowed files

- one new `supabase/migrations/*_calendar_feed_lifecycle.sql`
- `src/lib/supabase/loaders/calendarFeed.ts`
- `src/lib/supabase/loaders/calendarFeed.test.ts`
- `src/pages/calendar/SubscribePopover.tsx`
- `src/pages/calendar/SubscribePopover.test.tsx`
- new task-specific files under `supabase/tests/` needed to run the calendar
  feed lifecycle SQL assertions
- `docs/swarm/active/T195-T194-worker-output.md` (worker evidence only)

## Forbidden

- Do not edit any existing migration.
- Do not edit `supabase/functions/ics/**`; its persisted-token behavior is
  already correct for this task.
- Do not change profile/invite acceptance logic in the shipped migration.
  Provision from a new additive trigger instead.
- Do not add a dependency or change package/build configuration.
- Do not weaken or bypass `calendar_feeds` RLS.
- Do not hard-delete revoked feeds.
- Do not create a browser-generated token or a multi-request reset sequence.
- Do not touch W1/W2 files, routing, unrelated calendar behavior, `.claude/**`,
  `AGENTS.md`, or swarm governance/ledger/verification files.
- Every file not listed under Allowed files is forbidden.

## Acceptance criteria and required mutation evidence

Commit the candidate implementation before mutation testing. Apply each
mutation only in an isolated gate worktree, capture the named red result and
exit code, restore it, and prove the candidate commit is unchanged afterward.

1. **Existing-profile backfill.** A pre-migration profile has exactly one
   active feed afterward.
   - Mutation: remove the migration's backfill insert. The SQL lifecycle test
     must fail.
2. **Future provisioning.** A post-migration profile immediately has exactly
   one active feed.
   - Mutation: remove/disable the new profile trigger. The SQL lifecycle test
     must fail.
3. **Database-enforced active-row invariant.** A direct second active insert
   for the same profile is rejected.
   - Mutation: remove the partial unique index. The SQL lifecycle test must
     fail.
4. **Authenticated ownership.** A caller cannot reset another profile's active
   row, and the target remains active.
   - Mutation: remove the `auth.uid()` ownership predicate/validation from the
     reset function. The SQL lifecycle test must fail.
5. **Real RPC contract.** The TypeScript writer sends the current feed id once,
   maps the database result, and never authorizes with `payload.profileId`.
   - Mutation: send the profile id instead of the revoke id, or add it as the
     server identity argument. The loader test must fail.
6. **Production default.** Confirming Reset without an injected handler calls
   the real reset writer; no `console.warn`/generated fake row is reachable.
   - Mutation: replace the real component default with a resolving local fake.
     The production-default test must fail.
7. **Atomic failure posture.** Invalid, revoked, and cross-owner reset attempts
   leave the previously active rows unchanged, and component-level RPC
   rejection leaves the displayed link unchanged with an honest error.
   - Mutation: make the server accept a cross-owner row or remove the
     component's rejection preservation/error assertion. The relevant SQL or
     component test must fail.

If any mutation stays green, report the test gap and stop; do not present it as
evidence.

## Required verification

Report every command and exit code:

1. task-specific calendar feed loader/component tests;
2. the new scratch-Postgres calendar feed lifecycle runner;
3. `npm run typecheck`;
4. `npm run format:check`;
5. `npm run lint` (report warning count and any change);
6. `npm run test` (report files/tests); and
7. `npm run build`.

If the local PostgreSQL prerequisite is unavailable, do not silently skip the
SQL proof. Report the exact blocker to the orchestrator so the gate can supply
an equivalent disposable database or formally dispute the criterion.

## Commit and worker response

- Work only in `/private/tmp/volt-t195-t194` on the named branch.
- Stage Allowed files with explicit pathspecs; never use broad staging.
- Do not commit `node_modules` or any local environment file.
- Commit the implementation before mutation testing.
- Do not push or open a PR; the orchestrator owns integration.
- Report commit SHA, files changed, behavior implemented, all command exit
  codes/counts, mutation failures, known risks, and disputes.
- Include a `Deferred — for the ledger` section even if it says `None`.
- Do not mark T194 or T195 complete and do not edit governance records.
