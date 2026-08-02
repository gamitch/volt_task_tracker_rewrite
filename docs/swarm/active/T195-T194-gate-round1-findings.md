# T195 + T194 premise gate — round 1

## Verdict

**REVISE — BLOCKER.** The combined task remains valid, but the first packet was
not safe to dispatch.

## Material findings

1. The packet incorrectly treated every rejected reset promise as proof that
   PostgreSQL rolled back. An RPC is an HTTP POST: the transaction can commit
   and its response can be lost. Keeping the old URL displayed would then label
   a revoked token as current. The revised packet requires an authoritative
   `loadCalendarFeed` reconciliation and hides the URL if reconciliation also
   fails.
2. The original ownership mutation removed only the RPC's explicit identity
   predicate. It could not turn the test red because the required
   security-invoker execution plus existing `self_all` RLS would still hide the
   other profile's row. The replacement mutation defeats both layers together,
   so the cross-owner test is discriminating.
3. The historical SQL auth stub always returns `NULL` from `auth.uid()` and runs
   as superuser. It cannot prove ownership, RLS, or anonymous denial, and later
   migrations also require additional `auth.users` and `storage` scaffolding.
   The revised packet requires a task-specific platform stub and real
   `SET ROLE` assertions.
4. A profile provisioning trigger must be narrowly `SECURITY DEFINER`: staff
   are allowed to insert another user's profile, but an invoker trigger would
   be denied by `calendar_feeds.self_all`. The user-callable reset RPC remains
   explicitly `SECURITY INVOKER`; no RLS policy edit is authorized.
5. The migration order, deterministic duplicate winner, RPC return/cardinality
   contract, invite-path proof, staff-insert proof, and execute-privilege
   mutation all needed to be pinned explicitly.
6. The premise checker found no local PostgreSQL or Docker runtime. The
   orchestrator supplied PostgreSQL 17 on a disposable local gate before the
   second premise round; SQL evidence is not waived.

## Evidence baseline

- Existing calendar feed suites: **21/21 passed** across two files.
- TypeScript typecheck: passed.
- Current production source contains no calendar-feed insert and no real reset
  RPC.
- Existing RLS constrains `calendar_feeds` to `profile_id = auth.uid()`.
- ICS already rejects persisted missing/revoked tokens uniformly, so no Edge
  Function edit is needed.

The full checker response remains in the orchestration transcript. This file
records the dispatch-affecting conclusions and the changes folded into round 2.
