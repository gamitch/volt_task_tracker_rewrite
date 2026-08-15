# GAM-397 — explicit executor routing before Claude dispatch

## Objective

Prepare and independently verify the repository guard and governance rule that
will make `Todo` safe for Codex-owned issues after rollout, without changing
its meaning as the owner's authorization event. A tiered issue carrying
`executor/codex` must be observably rejected by the Claude dispatcher;
`executor/claude` and legacy issues with no executor label continue through the
current Claude path during the migration period.

Live deployment, label creation, and the first canary are explicitly split to
blocked follow-up GAM-398. GAM-397 must not claim the live queue is safe; it
delivers the accepted revision that GAM-398 will deploy and verify.

This issue is the bootstrap exception authorized by the owner on 2026-08-15:
it moved directly `Backlog → In Progress` and never entered `Todo`, because the
defect being fixed makes the ordinary transition unsafe.

## Current measured state

- `filter.ts:247-322` validates eight conditions and returns `dispatch: true`
  for every tiered, non-human-gated Todo transition.
- `filter.ts:132-140` has no routing skip reasons.
- `filter.ts:183-231` already normalizes grouped labels and handles both
  `group/name` paths and bare child names.
- `index.ts:162-211` already logs, returns, and schedules a notification for
  every named `dispatch: false` result before calling GitHub. A Codex route can
  use that existing skip path; it does not need a second side-effect branch.
- The Linear workspace currently has no `executor` label group. Existing
  tiered issues therefore have no executor label and must retain their current
  Claude behavior until a separately verified backfill/cutover.

## Required behavior

Add the following routing vocabulary to the pure decision module:

- grouped paths: `executor/claude`, `executor/codex`;
- bare child fallbacks: `claude`, `codex`, because Linear webhook payloads may
  omit the parent object just as they do for the existing `tier` group;
- `ROUTED_TO_CODEX`: exactly one Codex route was present;
- `EXECUTOR_CONFLICT`: more than one distinct recognized executor route was
  present;
- `UNKNOWN_EXECUTOR`: a path-form `executor/<value>` was empty or unsupported.

Routing runs only after the existing issue-shape, target-state, state-change,
tier, and `gate/human` checks. Consequently `gate/human` remains the winning
reason when an issue also carries an executor route.

After `gate/human`, precedence is deterministic:

1. any empty or unsupported path-form `executor/*` value produces
   `UNKNOWN_EXECUTOR`, even when a recognized route is also present;
2. otherwise, more than one distinct recognized route produces
   `EXECUTOR_CONFLICT`;
3. duplicate copies of the same recognized route collapse to one route;
4. exactly `codex` produces `ROUTED_TO_CODEX`;
5. exactly `claude`, or no route during migration, dispatches Claude.

Migration behavior is deliberately asymmetric:

| Labels on a valid Todo transition | Result |
| -- | -- |
| no `executor/*` label | existing Claude dispatch (legacy compatibility) |
| exactly `executor/claude` | existing Claude dispatch |
| exactly `executor/codex` | skip with `ROUTED_TO_CODEX` |
| both recognized routes | skip with `EXECUTOR_CONFLICT` |
| unknown path route | skip with `UNKNOWN_EXECUTOR` |
| recognized route plus unknown/empty path route | skip with `UNKNOWN_EXECUTOR` |
| duplicate copies of one recognized route | treat as that one route |
| any route plus `gate/human` | skip with `HUMAN_GATED` |

The Codex skip detail must name the issue identifier and say that the owner
must open Codex and claim it. It must not claim that Codex was launched.

## Allowed files

Worker:

- `supabase/functions/linear-dispatch/filter.ts`
- `supabase/functions/linear-dispatch/filter.test.ts`

Governance, owned by the orchestrator/boss-architect after the code result is
durable:

- `AGENTS.md`
- `docs/swarm/constitution.md`

No workflow file, migration, dependency, product source, or deployed secret is
in scope. Do not create the live Linear executor labels or deploy the Edge
Function in GAM-397. Blocked follow-up GAM-398 owns the load-bearing rollout
order: deploy the exact accepted guard first, create the labels second, then
run a live Codex-route canary. Creating the labels first would make them look
supported while the old live filter still ignores them.

## Acceptance criteria

1. Pure helper tests cover path-form and bare-form Claude/Codex routes,
   duplicate/conflicting routes, empty and unknown path routes, mixed
   recognized/unknown routes, and no-route legacy behavior.
2. A valid `executor/codex` Todo transition returns `dispatch: false` with
   reason `ROUTED_TO_CODEX`; the GitHub dispatch function is therefore never
   reached through the existing `index.ts` branch.
3. A valid `executor/claude` transition and a legacy no-route transition
   preserve the existing client-payload keys and types. The legacy case keeps
   its exact prior values; the explicit Claude case retains the normalized
   executor label in `clientPayload.labels` and otherwise matches.
4. `gate/human` takes precedence over every executor route.
5. An edit that merely adds or changes an executor label while an issue is
   already in Todo still returns `STATE_UNCHANGED`.
6. The grouped-label test covers the parent-present GraphQL/entity shape used
   by the export, and a separate synthetic test covers the defensive
   parent-absent webhook fallback. Neither test is described as proof that a
   captured real webhook omitted its parent.
7. The existing filter, notification, and signature suites remain green.
8. `AGENTS.md` and constitution item 28 state that `Todo` authorizes work and
   the executor label routes it; Codex claims `executor/codex`, Claude claims
   `executor/claude`, and no agent claims the other route.
9. The final evidence names deployment, Linear label creation, and the live
   canary as unperformed work owned by linked blocked follow-up GAM-398. Local
   code success must not be described as a live fix.

## Verification and mutation

- Run the linear-dispatch Deno suite from
  `supabase/functions/linear-dispatch/` (so its local `deno.json` is selected)
  with the approved ephemeral runner: `npx --yes --package=deno deno test
  --allow-env --allow-read`. Deno 2.9.5 was provisioned successfully on
  2026-08-15 without adding a dependency; the current baseline is 51 passed,
  0 failed. The root-directory form is invalid because it selects the wrong
  dependency context.
- Run the repository's six named gates and report literal exit codes.
- Mutation: force the `executor/codex` route to continue to the positive
  dispatch return. The focused Codex-routing test must fail while the legacy
  no-route and explicit-Claude cases remain green. Restore the mutation and
  re-run green in an isolated worktree.

## Least confident decisions

1. **Recognizing bare `codex` and `claude` labels.** This is wrong if a current
   ungrouped label collides with either name, or if Linear now guarantees parent
   objects in every webhook payload. Re-check the live label inventory and the
   existing payload precedent.
2. **Defaulting a missing executor route to Claude during migration.** This is
   wrong if the owner prefers an immediate fail-closed cutover and can backfill
   every dispatchable issue before deployment. The current workspace has no
   executor group, so immediate fail-closed behavior would otherwise stop the
   live queue.
3. **Using the existing named-skip path rather than adding a tri-state result.**
   This is wrong if the first release must automatically create or wake a Codex
   task. No such callable Codex dispatch adapter has been established in this
   repository; the initial promise is suppression plus notification only.
4. **Leaving `index.ts` and `notify.ts` unchanged.** This is wrong if their
   generic skip handling drops the identifier or makes `ROUTED_TO_CODEX`
   operationally indistinguishable from a malformed webhook. Inspect and test
   the real response/log/notification text before accepting the narrower diff.
5. **Splitting rollout into GAM-398.** This is wrong if repository acceptance
   cannot produce an immutable revision that the rollout issue can deploy and
   verify exactly. GAM-397 must end with a checked commit SHA and must say the
   live defect remains; GAM-398 is blocked by that commit and owns deployment,
   label creation, and the canary in that order.
