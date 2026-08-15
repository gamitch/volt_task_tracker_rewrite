# GAM-397 run log — explicit executor routing before Claude dispatch

Date: 2026-08-15
Branch: `claude/gam-397-executor-routing`

## Outcome

The repository guard and governance rule are implemented and independently
reviewed. A valid `executor/codex` Todo transition now takes the dispatcher's
existing named-skip path instead of reaching GitHub's Claude dispatch. Explicit
`executor/claude` and missing executor routes retain the legacy Claude path
during migration.

This is not a live rollout. Deployment, creation of the Linear `executor`
label group, and the live canary were not performed. Blocked follow-up GAM-398
owns those actions, in that order.

## Claim and premise gate

- The owner authorized GAM-397 as the one-time bootstrap exception: it moved
  directly `Backlog → In Progress` and never entered `Todo`, because Todo still
  triggered the unguarded Claude route.
- Premise round 1 returned REVISE / MAJOR. The packet was narrowed to repository
  acceptance, GAM-398 was filed for rollout, webhook-shape claims and payload
  preservation were made measurable, and route precedence was completed.
- Premise round 2 returned DISPATCH / NIT with no remaining blocker.
- Pre-change dispatcher baseline: 51 passed, 0 failed.

## Commits and boundaries

- Packet: `3c11883` — `docs: gate explicit executor routing`
- Worker: `6b4662f` — `fix: route Todo issues to the selected executor`
  - changed only `supabase/functions/linear-dispatch/filter.ts`
  - changed only `supabase/functions/linear-dispatch/filter.test.ts`
- Governance: `380f23f` — `docs: define executor routing ownership`
  - changed only `AGENTS.md`
  - changed only `docs/swarm/constitution.md`
- No workflow, dispatcher adapter, notification module, migration, dependency,
  deployed secret, or product source changed.

## Dispatcher verification

From `supabase/functions/linear-dispatch/`:

`npx --yes --package=deno deno test --allow-env --allow-read`

- primary: exit 0 — 63 passed, 0 failed
- independent checker: exit 0 — 63 passed, 0 failed
- `git diff --check 3c11883...380f23f`: exit 0

The new cases cover grouped and bare Claude/Codex routes, duplicate and
conflicting routes, empty and unknown path routes, mixed recognized/unknown
routes, missing-route compatibility, `gate/human` precedence, state-unchanged
precedence, payload preservation, and both label entity shapes.

## Mutation proof

The primary committed the candidate before mutation, then removed only the
`executor/codex` named-skip branch in the isolated worker worktree so Codex
routes continued to the positive Claude-dispatch result.

- mutated focused test: exit 1 — 0 passed, 1 failed
- exact failure: `assert.ok(!decision.dispatch)` in
  `executor/codex skips Claude dispatch and tells the owner to open and claim in Codex`
- restored focused test: exit 0 — 1 passed, 0 failed
- restored worktree matched committed `d446a68` with no diff

This proves the test fails on the routing defect itself rather than merely on
the reason string or notification copy.

## Repository gates

The gate-run skill ran against clean detached worktree commit `380f23f` with
full-suite baseline 2458. The baseline was measured for GAM-350 at `6e8a791`;
the path diff from GAM-350's accepted gate commit through current `main`
contains no application test files.

| Gate | Exit | Result |
| -- | --: | -- |
| `npx tsc --noEmit` | 0 | PASS |
| `npx vite build` | 0 | PASS |
| `npm run format:check` | 0 | PASS |
| `npx eslint .` | 0 | PASS — 0 errors, 379 warnings |
| `npx vitest run` | 0 | PASS — 95 files / 2458 tests, baseline +0 |
| scoped Vitest | — | SKIPPED — no `src/` scope exists for this Edge Function/governance diff |

Verdict: PASS — 5 of 6 repository gates; do not describe this as all six. The
changed Edge Function is covered by the separate 63-test Deno suite above.

## Independent acceptance review

Frontier checker verdict: PASS / NIT, with no actionable finding and no
follow-up. It confirmed the worker sabotage boundary, route precedence,
migration behavior, payload compatibility, generic skip-path connection,
governance wording, live label inventory, and the meaning of the mutation.

## Remaining live work

GAM-398 remains Backlog and blocked by GAM-397. It must:

1. deploy the accepted dispatcher guard;
2. create the Linear `executor/claude` and `executor/codex` labels only after
   the guarded revision is live;
3. run a live Codex-route canary and confirm Claude/GitHub dispatch is absent.

Until GAM-398 completes, missing routes remain legacy Claude-only and
`executor/codex` must not be created or applied.
