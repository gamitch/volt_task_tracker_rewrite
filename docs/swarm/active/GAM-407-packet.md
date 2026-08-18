# GAM-407 — bounded spike: is Supabase/Postgres a viable operational run store?

Issue: [GAM-407](https://linear.app/gamitch/issue/GAM-407/supabase-as-the-operational-run-store-is-the-plans-least-confident)
Tier: **HEAVY** (item 26 — creates an ops schema with RLS and a `security definer`
function, and the artifact decides the architecture Phase 2 onward builds on).
Plan: `docs/swarm/2026-08-15-durable-multi-agent-execution-plan.md` §5.1, §5.2,
§5.4, §7, §11.1, principle 10.

## Objective

Produce **evidence, not infrastructure**: a PASS/FAIL verdict, per criterion,
for the five things plan §5.1 requires before the run schema may be committed
to — measured on a disposable PostgreSQL cluster carrying this repo's real
migrations, never against the live Supabase project.

The stop rule is binding and pre-authorized (GAM-399 decision 5): **a failed
criterion ends in a written FAIL with evidence and an explicit owner decision on
another store.** It never ends in a silent fallback to Linear-as-lock or a
product-branch file. A crisp FAIL is a successful outcome of this packet.

## Current measured state (measured 2026-08-18 on this branch, not cited from the issue)

| Claim | Measurement |
|---|---|
| No run/ops/checkpoint table exists | `supabase/migrations/` holds 25 files, all product schema; latest `20260812000000_events_rls_active_membership_read.sql` |
| `linear-dispatch` writes no state | `index.ts` verifies HMAC → `decideDispatch()` (pure, `filter.ts`) → `repository_dispatch`. Modules present: `filter/dispatch/notify/signature`. No storage client anywhere in the function |
| Scratch cluster is available | `.claude/skills/scratch-postgres/scripts/start.sh` works **only under `sudo -n`** (as `runner` it fails `chown … Operation not permitted`). Comes up PostgreSQL **16.14**, applies **24 of 25** migrations; `20260719000000_cron.sql` skipped (`pg_cron` unavailable locally) |
| Extensions on that cluster | `pgcrypto`, `uuid-ossp` **available, not installed**. `pgjwt`, `pg_net`, `pg_cron`, `pgsodium` **absent** |
| Roles on that cluster | `authenticated`, `anon` exist as `NOSUPERUSER NOBYPASSRLS`; `postgres` is superuser **with `BYPASSRLS`** |
| **Live Supabase project reachability** | **NONE.** This container holds no `SUPABASE_*`, no service-role key, no `VITE_SUPABASE_*`, no `DATABASE_URL`. The live project cannot be measured from here at all |
| Node baseline | `node_modules` absent on a fresh container (`npm ci` first). After install: `npx vitest run` = **96 files / 2466 tests**, green |

**The last row governs the whole packet.** The issue's own verification note
already flagged the live project's extension set and plan tier as unverified;
this run cannot close that gap, so the report must carry it forward as an
explicit *unmeasured* item rather than let a green scratch result imply it.

## The five criteria, restated as things a machine can decide

Quoted from plan §5.1 and the issue; numbering is the plan's.

1. **Atomic compare-and-set.** One conditional update validates `run_id`,
   `generation` **and** `version` together. Not a read-then-write, not a
   transaction with a `select … for update` preamble — one statement whose
   `WHERE` carries all three.
2. **Idempotent duplicate webhooks.** A second delivery of the same
   `(issue, todo_event_id)` returns the existing run record and creates nothing.
3. **Run-scoped capability.** An executor publishes a checkpoint candidate while
   holding no service-role key, no GitHub token and no Linear key — and the
   capability is **non-derivable**: it cannot be escalated to service-role,
   another run, another generation, or the product schema.
4. **Validate-then-write ordering.** The controller makes GitHub and Linear
   writes only *after* validating the executor's result. A stubbed write against
   a test target is sufficient; the ordering and the validation are the point.
5. **Durable git evidence.** Controller state is summarized into git at episode
   completion.

Plus the §7 store-level fault scenarios the issue names: **1** (same webhook
twice), **2** (raced claims for one Todo event), **13** (paused old executor,
advanced generation, every stale mutation rejected), **14** (same terminal event
twice, one effect), **15** (store unavailable during checkpoint publication —
the failure is *named*, not silent).

## Design decisions this packet makes, so the worker does not drift into them

**D1 — the spike SQL does NOT go in `supabase/migrations/`.** It goes in
`supabase/spikes/gam-407-run-store/`. `supabase/migrations/` is the chain the
owner applies to hosted Supabase; anything landing there *is* production. The
issue requires the ops schema be "additive and operationally separate" and that
"the spike schema must not quietly become the production run store — Phase 2
proper does that, against this spike's findings." A file in the production
migration chain would satisfy neither. The harness applies the spike SQL
explicitly, after the 24 product migrations, so the ops schema is still proven
to coexist with the real product schema.

**D2 — criterion 3 is measured as Postgres RLS keyed on per-run JWT claims, and
the Edge-Function variant is analyzed but not claimed as measured.** The issue
names both options and demands the report say which was chosen and why. The
deciding fact is measurement, not preference: the RLS variant is fully provable
on a scratch cluster under a `NOSUPERUSER NOBYPASSRLS` role — which per the
`scratch-postgres` skill is the *weaker* case, so a pass there holds on hosted
Supabase *a fortiori*. The Edge-Function-holds-service-role variant cannot be
exercised at all without deploying to a project this run cannot reach, and an
unmeasured design must not be presented as a spike result. The report must
compare the two under **scenario 15** — they fail differently there — and must
say plainly that only one of them was measured.

**D3 — nothing is deployed and no live secret is touched.** Dark-launch
(principle 10). No `supabase functions deploy`, no live SQL, no change to
`supabase/config.toml`, no product schema change, no existing write path
modified.

## Allowed files

Worker A (schema + fault harness) — `model: "opus"` per item 18:

- `supabase/spikes/gam-407-run-store/schema.sql` (new)
- `supabase/spikes/gam-407-run-store/README.md` (new)
- `supabase/tests/run_gam407_run_store_spike.sh` (new)
- `supabase/tests/gam407_run_store_assertions.sql` (new)

Worker B (controller ordering + evidence exporter) — default pin:

- `scripts/run-store-controller.mjs` (new)
- `scripts/run-store-controller.test.mjs` (new)
- `scripts/run-store-episode-summary.mjs` (new)

Orchestrator, after both results are durable:

- `docs/swarm/active/GAM-407-spike-report.md`
- `docs/swarm/active/GAM-407-run-log.md`
- `docs/swarm/active/GAM-407-pr-body.md`

**Forbidden to every agent on this row:** `supabase/migrations/**` (D1),
`.github/workflows/**` (dispatched runs cannot push it — `AGENTS.md` § "Two
walls"), `supabase/config.toml`, `src/**`, `vite.config.ts`, any dependency
change, and any command that contacts a live Supabase, GitHub or Linear
endpoint other than the run log's own `git push`.

## Required behavior

### Worker A — `supabase/spikes/gam-407-run-store/schema.sql`

Additive, idempotent (`create schema if not exists ops`), and self-contained.

- **`ops.run`** — at minimum the §5.1 fields the five criteria exercise:
  `run_id uuid primary key`, `issue_identifier text not null`,
  `todo_event_id text not null`, `todo_at timestamptz`,
  `version integer not null default 1`, `generation integer not null default 1`,
  `status text not null`, `phase text`, `active_executor text`,
  `result_refs jsonb not null default '{}'::jsonb`, phase timestamps.
  **`unique (issue_identifier, todo_event_id)`** — this constraint is what makes
  criterion 2 a property of the database rather than of the caller.
- **`ops.reserve_run(p_issue text, p_todo_event_id text, …)`** — `security
  definer`, `set search_path`. Implements create-or-return atomically
  (`insert … on conflict (issue_identifier, todo_event_id) do nothing
  returning …`, then read back on the empty case). Returns the run row **and a
  boolean saying whether this call created it.** Criterion 2, scenarios 1 and 2.
- **`ops.publish_checkpoint(p_run_id uuid, p_generation int, p_expected_version
  int, …)`** — criterion 1. The compare-and-set must be **one `update`
  statement** whose `where` names all three of `run_id`, `generation` and
  `version`, and which bumps `version`. It must distinguish "no such run",
  "stale generation" and "version conflict" as **named** outcomes.
  ⚠ The `scratch-postgres` skill's own warning applies directly here: a
  cross-user or non-matching `UPDATE` **reports `UPDATE 0` rather than raising**.
  An assertion that catches an exception will pass while proving nothing.
- **`ops.advance_generation(p_run_id uuid, p_expected_version int)`** —
  scenario 13 / §5.2 fencing. After it, every mutation carrying the old
  generation fails closed.
- **`ops.run_event(run_id, event_key, …)` with `unique (run_id, event_key)`** —
  scenario 14: the same terminal event delivered twice has exactly one effect.
- **RLS**, forced, on `ops.run` and `ops.run_event`, keyed on the per-run claims
  (`current_setting('request.jwt.claims', true)::jsonb ->> 'run_id'` and
  `->> 'generation'`), plus a role `ops_executor` created
  **`NOSUPERUSER NOBYPASSRLS`** holding only the grants a checkpoint submission
  needs. No `pgjwt` dependency — claim *verification* is PostgREST's job and is
  out of this spike's reach; claim *enforcement* is the thing being measured.

### Worker A — `supabase/tests/run_gam407_run_store_spike.sh`

Follows `supabase/tests/run_t205_anon_grant.sh`'s shape (scratch database, trap
cleanup, `ON_ERROR_STOP=1`, skip `20260719000000_cron.sql`). Applies the 24
product migrations, then `schema.sql`, then the assertions. Prints a per-scenario
`PASS`/`FAIL` line and exits non-zero if any assertion fails.

Scenarios, and what each must actually demonstrate:

| # | Scenario | The assertion that makes it real |
|---|---|---|
| 1 | Same Todo webhook twice | Two `ops.reserve_run` calls, identical arguments → **one** row in `ops.run`, same `run_id` returned twice, `created=true` then `created=false` |
| 2 | Raced claims for one Todo event | **Two genuinely concurrent sessions** (background `psql`, released by an advisory-lock barrier so both are inside the call before either commits) → one row, both callers see the same `run_id`, exactly one reports `created=true` |
| 13 | Generation fencing | Advance generation, then replay a checkpoint at the old generation → rejected as a **named** outcome, and `ops.run`'s row is byte-identical to before the replay (re-read the row; do **not** trust an absent exception) |
| 14 | Duplicate terminal event | Same `(run_id, event_key)` twice → one row, one effect on `ops.run` |
| 15 | Store unavailable mid-publication | Point the controller at a dead port / terminate the backend mid-call → the caller surfaces a **named failure class**, no external write is attempted, and nothing is recorded as published |

**Both directions, per the skill.** For criterion 1 it is not enough to show a
correct CAS succeeds — a stale `version`, a stale `generation` and a wrong
`run_id` must each be shown to fail, and the row re-read to prove it did not
move. For criterion 3 it is not enough to show `ops_executor` can publish for
its own run — it must be shown **unable** to: read another run's row, publish at
another generation, `set role` to anything stronger, read any product table, or
reach `ops` objects it was not granted. That negative half is criterion 3.

### Worker B — `scripts/run-store-controller.mjs` + `.test.mjs`

Criterion 4, as a pure module with injected write sinks — no network, no
credentials, consistent with the existing `scripts/linear-*.test.mjs` pattern
that the vitest suite already collects.

- `validateCheckpointCandidate(candidate, expected)` → a result object naming
  every rejection reason (wrong run, stale generation, version mismatch, missing
  head SHA, malformed evidence).
- `publishExternal(candidate, expected, sinks)` where `sinks` is
  `{ github, linear }` — **invokes neither sink unless validation passed**, and
  records the order in which it did.
- Tests must assert the **negative**: on an invalid candidate, `github` and
  `linear` were called **zero** times. A test that only checks the happy path
  proves nothing about ordering.
- Tests must also cover the scenario-15 shape: a store error during publication
  produces a named failure class and **no** external write.

### Worker B — `scripts/run-store-episode-summary.mjs`

Criterion 5. Reads a run record + its events (from a JSON file or `psql -tAJ`
output — no live connection) and renders a deterministic markdown episode
summary. Deterministic means: same input → byte-identical output, no
`Date.now()`, no ordering that depends on a hash iteration.

## Acceptance criteria

1. `bash supabase/tests/run_gam407_run_store_spike.sh` exits **0** on a scratch
   cluster started per the measured procedure (`sudo -n`), and prints an explicit
   `PASS`/`FAIL` line for **each** of scenarios 1, 2, 13, 14, 15.
2. Criterion 1 is demonstrated by **one** `update` statement whose `where`
   carries `run_id`, `generation` and `version`; the packet's reviewer can point
   at that statement. All three stale cases are shown rejected **by re-reading
   the row**, not by catching an exception.
3. Criterion 2 is demonstrated under genuine concurrency (scenario 2), not only
   sequentially.
4. Criterion 3 is demonstrated **in both directions** under a
   `NOSUPERUSER NOBYPASSRLS` role, including every negative listed above. If any
   negative fails, criterion 3 is **FAIL** even though a checkpoint went through
   — the issue is explicit on this.
5. Criterion 4 is demonstrated by tests asserting zero sink invocations on an
   invalid candidate.
6. Criterion 5 is demonstrated by an actual generated summary file, produced by
   running the exporter, with byte-identical output on a second run.
7. **No file under `supabase/migrations/` is created or modified**, and no live
   Supabase/GitHub/Linear endpoint is contacted.
8. The six gates pass, against the measured baseline **96 files / 2466 tests**
   (gates 5/6 must not fall below it).
9. The final report carries a PASS/FAIL verdict **per criterion**, names the
   chosen capability design and why (D2), compares both designs under scenario
   15, and states in its own section what was **not** measured — specifically
   the live project's extension set and plan tier, which this container could
   not reach.
10. If any criterion is FAIL, the report ends in the stop rule: a written FAIL
    and a named owner decision, never a fallback.

## Verification and mutation

- Gates: `python3 .claude/skills/gate-run/scripts/gates.py --baseline-tests 2466`
  (run `npm ci` first — `node_modules` is absent on a fresh container). Report
  literal exit codes.
- Mutation replay, on the load-bearing assertion: drop `version` from the
  compare-and-set `where` clause. The scenario-13/stale-version assertion **must**
  turn red. Commit before mutating, revert, re-verify green (item 26's
  fast-tier working rule, and item 23 — mutate in your own worktree).
- Second mutation: remove the `unique (issue_identifier, todo_event_id)`
  constraint. Scenarios 1 and 2 must both turn red. If they stay green, the
  harness is proving the caller's behavior rather than the database's.
- Leave nothing behind: stop the scratch cluster and delete its data directory,
  and say so.

## Least confident decisions (item 19d)

1. **Keeping the spike SQL out of `supabase/migrations/` (D1).** This is wrong
   if the owner reads "one additive ops-schema migration" in the issue as
   literally requiring a file in the production migration chain, or if Phase 2
   is expected to inherit an already-applied ops schema rather than author one
   against this spike's findings. What would settle it: the owner saying which
   of "operationally separate" and "a migration" wins. I have taken
   *operationally separate* as the stronger constraint because the issue also
   says the spike schema "must not quietly become the production run store."
2. **Measuring only the RLS variant of criterion 3 (D2).** This is wrong if the
   real design is the Edge-Function variant and the RLS result does not transfer
   — in particular if hosted PostgREST does not surface the custom per-run claims
   this schema keys on, or if the ops schema would have to be exposed through
   PostgREST at all to be reachable, which is itself an escalation surface. What
   would make it wrong: a measurement on the live project that this container
   cannot perform. The report must therefore mark criterion 3 as *measured at
   the database layer, unmeasured at the transport layer.*
3. **Treating a `NOSUPERUSER NOBYPASSRLS` scratch role as an adequate stand-in
   for a hosted Supabase role.** The skill argues this is the weaker case and so
   generalizes upward. This is wrong if hosted Supabase grants the executor's
   role something the local role lacks — a default privilege, a `service_role`
   grant inherited through `public`, or PostgREST's own `db-anon-role` chain.
   `supabase/tests/run_t205_anon_grant.sh` already found that Supabase's stock
   default privileges matter and must be simulated *before* the object under test
   is created; the harness must do the same or the pass is vacuous.
4. **Scenario 15 by killing the connection.** This is wrong if the failure mode
   that actually matters is a *partial* write — the store accepting the
   checkpoint and then failing to acknowledge — rather than an unreachable
   store. A connection kill proves the named-failure requirement but not the
   ambiguity requirement. If the worker cannot exercise the ambiguous case, the
   report must say scenario 15 is **partially** exercised rather than PASS.
5. **Splitting the work across two workers.** This is wrong if criterion 4's
   ordering module needs to import the schema's own outcome names to be
   meaningful, in which case the split creates a seam where the two halves agree
   with each other by construction rather than by measurement. Mitigation: the
   checker must verify the names in `run-store-controller.mjs` against the ones
   `schema.sql` actually returns, not against each other's tests.
