# GAM-407 — bounded spike: is Supabase/Postgres a viable operational run store?

**Revision 4** — the owner cleared item 19a's escalation on 2026-08-18 and
re-dispatched the row. Revision 3 answered round 2 (REVISE; 3 BLOCKER, 3 MAJOR,
3 MINOR, 1 NIT), which answered round 1 (REVISE; 2 BLOCKER, 5 MAJOR, 9 MINOR,
2 NIT). Both gate reports are preserved at
`docs/swarm/active/GAM-407-gate-round1.md` and `-round2.md`, and the measured
facts they produced are consolidated in
`docs/swarm/active/GAM-407-interim-findings.md`.

**What changed in revision 4, and nothing else did:**

1. **Definition of Ready #3 is now met.** The escalation is no longer merely
   named — it is **pre-approved**. Owner, on GAM-407 at 12:01:52Z relaying
   GAM-408's 11:50Z answer verbatim: *"proceed, pin the harness to PG 17"*, and
   explicitly: *"The item-19a blocker is cleared — this is no longer an open
   escalation, and a fresh gate round should not re-raise it as one."*
2. **The live-project half is measured and is no longer a deferral at all.**
   GAM-408 is `Done`. Plan tier **free**; extensions installed: `plpgsql`,
   `pg_cron`, `pgcrypto`, `uuid-ossp`, `pg_net`, `pg_stat_statements`,
   `supabase_vault`; server **PostgreSQL 17.6.1.141**. As this packet predicted,
   **nothing in the design needs an extension.**
3. **The harness is pinned to PostgreSQL 17, and every round-1/round-2 finding
   is now provisional until re-established there.** Both gate rounds measured on
   16.14. This is the owner's explicit instruction, not an inference, and it is
   the substantive new work in this revision (§"PG 17" below).
4. **A file-collision constraint from the owner:** GAM-410 / PR #198 is editing
   `docs/swarm/2026-08-15-durable-multi-agent-execution-plan.md`. **No agent on
   this row edits the plan document.** Findings that belong there are filed under
   item 20 instead.

⚠ **This packet has still NOT received a DISPATCH verdict, and item 19 forbids
it reaching a worker until it does.** Item 19a's cap counts rounds against an
open escalation; the owner has closed that escalation and re-dispatched, so one
fresh round (round 3) is in order and must not re-raise the closed escalation as
a finding.

Issue: [GAM-407](https://linear.app/gamitch/issue/GAM-407/supabase-as-the-operational-run-store-is-the-plans-least-confident)
Tier: **HEAVY** (item 26 — creates an ops schema with RLS and `security definer`
functions, and the artifact decides the architecture Phase 2 onward builds on).
Plan: `docs/swarm/2026-08-15-durable-multi-agent-execution-plan.md` §4
(principle 10), §5.1, §5.2, §5.4, §7, §11.1.

## Objective

Produce **evidence, not infrastructure**: a PASS / PARTIAL / FAIL verdict, per
criterion, for the five things plan §5.1 requires before the run schema may be
committed to — measured on a disposable PostgreSQL cluster carrying this repo's
real migrations, never against the live Supabase project.

The stop rule is binding and pre-authorized (GAM-399 decision 5): **a failed
criterion ends in a written FAIL with evidence and an explicit owner decision on
another store.** It never ends in a silent fallback to Linear-as-lock or a
product-branch file. A crisp FAIL is a successful outcome of this packet.

## Scope: what this run measures, what the owner measured, and what stays unmeasured

The issue requires the spike to measure the live project's **extension set** and
**plan tier**. **No dispatched run can.** Re-measured in this container on the
run-2 branch: no `SUPABASE_*`, no service-role key, no `VITE_SUPABASE_*`, no
`DATABASE_URL`, no `.env`. That is also the correct posture — plan §5.2 says an
executor holds no service-role key, and the owner reaffirmed it on re-dispatch:
*"No service-role key goes to a dispatched run — plan §5.2."*

**This is no longer an open escalation and no longer a deferral.** The owner took
the measurement from an authorized interactive connector and posted it on GAM-408
(now `Done`), then relayed it onto this row. The result is recorded in the state
table below. Revision 3's item-20 follow-up for the live measurement is therefore
**withdrawn as unnecessary** — the thing it deferred has happened.

**Authority note, retained from revision 3 (round 2, MINOR-R2-2).** Revision 2
cited **item 27** for the deferral. Item 27 governs a *user-visible surface*
reading from a fixture or stub and explicitly excludes work with no user-visible
surface; a database spike has none. The rule was **item 20**. Recorded because
deleting a corrected citation deletes the evidence that the correction happened
(item 30c).

**Definition of Ready #3 is met.** The escalation was named on GAM-408 and
approved there at 11:50Z. A gate round that re-raises it is re-raising a closed
question.

**What remains genuinely unmeasured, and the report must say so:** the hosted
project's *role* configuration — whether hosted `service_role`, `authenticated`
and `anon` carry exactly the attributes this harness creates locally, and whether
hosted Supabase grants an executor-shaped role anything the local one lacks. The
owner's GAM-408 measurement covered extensions and plan tier, not `pg_roles`.
This is least-confident decision 3 below and it is a **stated limit on the
verdict**, not a deferral.

## PG 17 — the pin, how it was achieved, and what it makes provisional

The owner's instruction: *"Pin the harness to PostgreSQL 17. The live database is
17.6.1.141; both gate rounds measured on 16.14. All four BLOCKER findings rest on
GUC, RLS, role and grant semantics established on the wrong major version, so
re-establish all four on PG 17 and treat the packet's PG-16 citations as
provisional until you have."*

**Measured by the orchestrator on the run-2 branch, 2026-08-18, before this
revision was written:**

- The container shipped **only** `/usr/lib/postgresql/16`. `apt-cache policy
  postgresql-17` found no candidate until the PGDG repository was added.
- Adding `deb https://apt.postgresql.org/pub/repos/apt noble-pgdg main` and
  `apt-get install -y postgresql-17` succeeds (exit 0) and yields
  **`postgres (PostgreSQL) 17.11 (Ubuntu 17.11-1.pgdg24.04+2)`**.
- **No edit to the scratch-postgres skill is needed, and none is permitted** —
  `.claude/skills/**` is protected by the constitution's Authority Boundaries.
  `start.sh:33` reads `PGBIN=$(ls -d /usr/lib/postgresql/*/bin | sort -V | tail
  -1)`: it already selects the **highest** installed major. Installing the
  package *is* the pin.
- Re-run under 17: `applying 25 of 25 migrations`, one skipped
  (`006-20260719000000_cron.sql [needs pg_cron]`), i.e. **24 applied**, and
  `ready: postgres 17.11`.

**The version the harness measures is 17.11; the live server is 17.6.1.141.**
Same major, different minor, and the report must say that rather than write
"PG 17" and let a reader assume identity. No behaviour this spike depends on is
minor-version-scoped, but that is a claim, and it is stated as one.

**Two of the four findings are already re-established on 17.11 by the
orchestrator** (item 19c — verify your own citations before submitting):

| Finding | Re-measured on PG 17.11 | Evidence |
|---|---|---|
| F1 — `request.jwt.claims` is a settable custom GUC | **HOLDS** | absent from `pg_settings` before and after; `set request.jwt.claims = '{"run_id":"a"}'` returns `SET`, `current_setting` reads it back |
| F3 — `EXECUTE` defaults to `PUBLIC` on new functions | **HOLDS** | fresh `probe.f()` has `proacl` **null**, which is the default `EXECUTE TO PUBLIC` |
| F2 — `security definer` owned by a `BYPASSRLS` role runs with RLS off | re-established **by the harness** (D3 ownership assertion) | AC12 |
| F4 — `SET ROLE` is authorized against `session_user` | re-established **by the harness** (D7 `LOGIN` executor) | AC4 / AC12 |

Also re-measured on 17.11: `sha256(bytea)` returns 64 hex chars and
`gen_random_uuid()` works, **with no extension installed** — the built-in
dependency D2 relies on holds on the pinned major.

**F2 and F4 are not yet re-established, and the harness must do it.** AC12 makes
that a criterion rather than a hope.

## Current measured state

Rows marked **(run 2)** were re-measured on this branch on 2026-08-18 under the
PG 17 pin. Unmarked rows were measured in run 1 and independently confirmed by
the round-1 and round-2 gates on their own clusters.

| Claim | Measurement |
|---|---|
| No run/ops/checkpoint table exists | `supabase/migrations/` holds 25 files, all product schema; latest `20260812000000_events_rls_active_membership_read.sql`. `supabase/spikes/` does not exist yet |
| `linear-dispatch` writes no state | `index.ts` imports exactly `filter/dispatch/notify/signature`; no storage client in any non-test source |
| **Scratch cluster (run 2)** | `.claude/skills/scratch-postgres/scripts/start.sh` works **only under `sudo -n`** (as `runner`: `chown … Operation not permitted`). After `apt-get install postgresql-17` it reports **`ready: postgres 17.11`**; `applying 25 of 25`, `SKIPPED 1 … 006-20260719000000_cron.sql [needs pg_cron]`, i.e. **24 applied** |
| **Live Supabase project (owner-measured, GAM-408)** | Plan tier **free**. Extensions installed: `plpgsql`, `pg_cron`, `pgcrypto`, `uuid-ossp`, `pg_net`, `pg_stat_statements`, `supabase_vault`. Server **PostgreSQL 17.6.1.141**. **Nothing in this design needs any of them** |
| **Built-ins on 17.11 (run 2)** | `sha256(bytea)` → 64 hex chars; `gen_random_uuid()` → ok. Neither needs `pgcrypto` |
| Roles | `authenticated`, `anon` are `NOSUPERUSER NOBYPASSRLS`; `postgres` is superuser **with `BYPASSRLS`**. **`service_role` does not exist** and must be created by the harness |
| PostgREST exposure | `supabase/config.toml` sets `schemas = ["public", "graphql_public"]`. Reaching an `ops` schema through PostgREST would require adding it there — a file this packet forbids |
| **Live credential in this run** | **Absent, by design** (plan §5.2). Re-checked on the run-2 branch |
| **Node / vitest (run 2)** | `node_modules` was **absent** on this fresh container; `npm ci` exit 0. Baseline `npx vitest run` = **96 files / 2466 tests**, green. `npx vitest run scripts/` = **11 files / 260 tests**. `vite.config.ts` sets no `include`, so vitest's default glob **does** collect `scripts/*.test.mjs` |

**Second-order input to §11.1 decision 1, from the owner's GAM-408 note, which
the report must carry:** on the **free** tier a project pauses on inactivity —
the sibling project `robotics-kanban` in this same org currently reads
`INACTIVE`. **A store whose entire purpose is outliving executor death, hosted
where the store itself pauses, is a genuine architectural input**, and §7
scenario 15 ("store unavailable") is therefore not a hypothetical fault but the
tier's steady-state behaviour. The report states this under criterion 3/§11.1,
labelled as the owner's measurement rather than this run's.

## The five criteria, restated as things a machine can decide

1. **Atomic compare-and-set.** One conditional `update` validates `run_id`,
   `generation` **and** `version` together.
2. **Idempotent duplicate webhooks.** A second delivery of the same
   `(issue, todo_event_id)` returns the existing run record and creates nothing.
3. **Run-scoped capability.** An executor publishes a checkpoint candidate while
   holding no service-role key, no GitHub token and no Linear key — and the
   capability is **non-derivable**: it cannot be escalated to service-role,
   another run, another generation, or the product schema.
4. **Validate-then-write ordering.** The controller makes GitHub and Linear
   writes only *after* validating the executor's result.
5. **Durable git evidence.** Controller state is summarized into git at episode
   completion.

§7 store-level fault scenarios: **1** (same webhook twice), **2** (raced claims),
**13** (paused executor, advanced generation, stale mutations rejected),
**14** (same terminal event twice, one effect), **15** (store unavailable during
checkpoint publication — the failure is *named*, not silent).

## Design decisions this packet makes, so the worker does not drift into them

**D1 — the spike SQL does NOT go in `supabase/migrations/`.** It goes in
`supabase/spikes/gam-407-run-store/`. The issue's own "Size and tier" line says
"One additive ops-schema migration **(scratch-first)**", and its constraint
paragraph says the spike schema "must not quietly become the production run
store — Phase 2 proper does that." `supabase/migrations/` is the chain the owner
applies to hosted Supabase; a file there *is* production. The harness applies the
spike SQL explicitly, **after** the 24 product migrations, so coexistence with
the real product schema is still proven. (The round-1 gate confirmed D1 is sound
and that nothing collides.)

**D2 — the capability is an execute-only token-verifying RPC, NOT RLS keyed on
`request.jwt.claims`.** Revision 1 chose the latter and the gate broke it by
running it. `request.jwt.claims` is an unrecognised two-part custom GUC and is
therefore `USERSET`: a `NOSUPERUSER NOBYPASSRLS` role re-set its own claim to
another run's id and updated that row (`UPDATE 1`, re-read as `HIJACKED`), and
`REVOKE SET ON PARAMETER` does not restrain it on PG 16 — and the settability
half is **re-measured on PG 17.11** (§"PG 17", F1), so the finding is no longer
scoped to the wrong major. That design's security
lives entirely in PostgREST, which this spike cannot exercise.

So: **`ops_executor` gets no table grants at all** — only `execute` on
`ops.publish_checkpoint(p_token text, …)`, which derives `run_id` and
`generation` from a secret it verifies *inside* the function. That negative is
real on a scratch cluster, needs neither `pgjwt` nor PostgREST, and restores the
"weaker case generalizes upward" argument the gate correctly called inverted.

**D2a — the broken design is kept as a committed negative control.** The
forgery above is a *spike finding about plan §5.1*, not just a packet defect, and
it must not survive only as prose. The harness asserts it: a claims-keyed policy
**is** forgeable by the role it purports to constrain.

**D5 — every grant is explicit, and PUBLIC is revoked first. (Round 2,
BLOCKER-R2-1.)** Revision 2 said `reserve_run` and `advance_generation` were "not
granted to `ops_executor`" and contained no `revoke`. **PostgreSQL grants
`EXECUTE` on every new function to `PUBLIC` by default.** Measured: the executor
called `reserve_run`, then called `advance_generation` on *another run*, was
handed that run's freshly-rotated plaintext token, and published to it. Not
granting is not the same as denying. The schema therefore ends with:

```sql
revoke execute on function ops.reserve_run(text, text)                from public;
revoke execute on function ops.advance_generation(uuid, int)          from public;
revoke execute on function ops.record_terminal_event(uuid, text, jsonb) from public;
revoke execute on function ops.publish_checkpoint(text, int, jsonb)   from public;
grant  execute on function ops.publish_checkpoint(text, int, jsonb)   to ops_executor;
```

and the harness asserts the ACLs directly — `select proname, proacl from pg_proc
where pronamespace = 'ops'::regnamespace` — because one ACL assertion is a better
regression guard than six behavioural negatives and would have caught this at a
glance.

**D6 — no RLS on `ops.run` or `ops.run_event`, and the packet says why. (Round 2,
BLOCKER-R2-2.)** Revision 2 called forced RLS "defence-in-depth". Measured, it is
a deadlock: with a `NOBYPASSRLS` owner and a claims-keyed policy, `reserve_run`
cannot insert at all — `ERROR: 42501: new row violates row-level security policy
for table "run"` — because the controller has no claim to set, D2 having removed
it. **No run can ever be created**, so every scenario is unreachable. And RLS
buys nothing here regardless: with no table grants the *privilege* check denies
the executor before any policy is consulted (`aclcheck_error`, not a policy
denial). **"No table grants" is the enforcement, and it is a stronger and simpler
statement than "RLS plus no table grants."** RLS and the `nullif(current_setting
('request.jwt.claims', true), '')::jsonb` predicate appear **only** on the D2a
negative-control table.

**D7 — `ops_executor` is a `LOGIN` role and the harness connects as it. (Round 2,
BLOCKER-R2-3.)** `SET ROLE` is authorized against `session_user`, not
`current_user`. Revision 2 made every role `nologin`, so the harness had to
`set role ops_executor` from a `postgres` session — from which `set role
ops_owner`, `set role postgres` and `set role service_role` all **succeed**, and
AC4 would have forced an automatic FAIL for a rig artifact. With `alter role
ops_executor login` and a direct `psql -U ops_executor` (the scratch cluster's
`pg_hba.conf` is `local all all trust`), all three denials are real `42501`s and
`session_user` is no longer a superuser. Strictly stronger as well as correct.

**D3 — every `ops` object is owned by a `NOSUPERUSER NOBYPASSRLS` role.** The
gate measured a `security definer` function owned by `postgres` moving a row with
**no claim set at all**: `force row level security` binds the table owner and does
not defeat the `BYPASSRLS` role *attribute*. Without D3 every criterion-3
assertion is vacuous, so the harness asserts ownership mechanically.

**D4 — nothing is deployed and no live secret is touched.** Dark-launch
(principle 10). No `supabase functions deploy`, no live SQL, no change to
`supabase/config.toml`, no product schema change, no existing write path
modified.

## Allowed files

**Worker A** (schema + fault harness) — dispatch with `model: "opus"` per item 18
(migration-shaped SQL, RLS policies, `security definer` helpers — all three
triggers fire):

- `supabase/spikes/gam-407-run-store/schema.sql` (new)
- `supabase/spikes/gam-407-run-store/README.md` (new)
- `supabase/tests/run_gam407_run_store_spike.sh` (new)
- `supabase/tests/gam407_run_store_assertions.sql` (new)

**Worker B** (controller ordering + evidence exporter) — default pin:

- `scripts/run-store-controller.mjs` (new)
- `scripts/run-store-controller.test.mjs` (new)
- `scripts/run-store-episode-summary.mjs` (new)
- `scripts/run-store-episode-summary.test.mjs` (new)

**Orchestrator**, after both results are durable:

- `docs/swarm/active/GAM-407-spike-report.md`
- `docs/swarm/active/GAM-407-run-log.md`
- `docs/swarm/active/GAM-407-gate-round*.md`
- `docs/swarm/active/GAM-407-pr-body.md`
- `docs/swarm/active/GAM-407-ci-sql-step.patch` (see MAJOR-6 remedy below)
- `docs/swarm/verification-log.md` (item 24 — same commit as the merge)

**Forbidden to every agent on this row:** `supabase/migrations/**` (D1),
`.github/workflows/**` (a dispatched run cannot push it), `supabase/config.toml`,
`src/**`, `vite.config.ts`, `docs/swarm/task-ledger.md` (frozen, item 29),
**`.claude/skills/**` and `.claude/agents/**`** (constitution Authority
Boundaries — and the PG 17 pin deliberately needs no skill edit, see §"PG 17"),
**`docs/swarm/2026-08-15-durable-multi-agent-execution-plan.md`** (owner-imposed:
GAM-410 / PR #198 is editing §5.1 concurrently; a finding that belongs in the
plan is **filed under item 20**, not written), any dependency change, and any
command contacting a live Supabase, GitHub or Linear endpoint — other than the
run log's own `git push` and the orchestrator's item-28 Linear status moves,
which the dispatch protocol and constitution require.

**Orchestrator-only, and not delegated:** installing `postgresql-17`. It is a
container-level `sudo apt-get` outside every worker's Allowed Files, it was
already done before this revision was written, and a worker re-running it wastes
a package install. Workers **assert** the version (AC12); they do not provision
it.

**CI note (MAJOR-6).** `.github/workflows/ci.yml` enumerates each SQL suite as an
explicit step; there is no glob. A new harness therefore lands as a committed
script **nothing invokes** — the "green-but-never-executed" condition that
already cost this repo T701. A dispatched run cannot push workflow files, so the
orchestrator produces `docs/swarm/active/GAM-407-ci-sql-step.patch`
(`git format-patch`, precedents `GAM-314-workflow-wiring.patch` and
`GAM-325-lane-d-workflows.patch`, delivered by PRs #159/#160) and leads the PR
body with that undeliverable half.

## Required behavior

### Worker A — `supabase/spikes/gam-407-run-store/schema.sql`

Additive and idempotent (`create schema if not exists ops`). Self-contained: no
extension is required — use the built-in `sha256(bytea)` (PG 11+) and
`gen_random_uuid()` (PG 13+) rather than `pgcrypto`, both **re-measured working
on the pinned 17.11 cluster with no extension installed**. The hosted project
does have `pgcrypto` (GAM-408), so this is now a simplicity choice rather than a
necessity — keep it anyway: depending on nothing is the stronger result for
§11.1, and it keeps the spike schema portable to whatever store the owner picks
if criterion 3 fails.

**Roles, created by the schema:**

| Role | Attributes | Grants |
|---|---|---|
| `ops_owner` | `nologin nosuperuser nobypassrls` | owns the schema, every table, every function |
| `ops_executor` | **`login`** `nosuperuser nobypassrls` (D7) | `usage` on `ops`; `execute` on `ops.publish_checkpoint` **only**, after `revoke … from public` (D5). **No table privileges whatsoever** |

**`ops.run`** — the §5.1 fields the criteria exercise. `head_sha`, `base_sha`,
`branch`, `failure_class` and `failure_detail` are **required** (revision 1 omitted
them while the validator named them — MINOR-7):

`run_id uuid primary key default gen_random_uuid()`, `issue_identifier text not
null`, `todo_event_id text not null`, `todo_at timestamptz`, `version integer not
null default 1`, `generation integer not null default 1`, `status text not null`,
`phase text`, `pipeline_version text`, `constitution_sha text`, `branch text`,
`base_sha text`, `head_sha text`, `active_executor text`, `required_next_role
text`, `result_refs jsonb not null default '{}'::jsonb`, `capability_hash text`,
`failure_class text`, `failure_detail text`, `reserved_at`/`updated_at`
timestamps, and **`unique (issue_identifier, todo_event_id)`** — the constraint
that makes criterion 2 a property of the database rather than of the caller.

**`ops.run_event`** — a **table** (NIT-2), `unique (run_id, event_key)`.

**Functions**, all owned by `ops_owner`, all `security definer` with an explicit
`set search_path`:

- **`ops.reserve_run(p_issue text, p_todo_event_id text, …)`** — create-or-return,
  atomically: `insert … on conflict (issue_identifier, todo_event_id) do nothing
  returning …`, and on the empty case read the existing row back. Returns the run
  **and a boolean saying whether this call created it**, and — only when it
  created it — the **plaintext capability token** (returned once; only its
  `sha256` hex is stored). Not granted to `ops_executor`.
- **`ops.publish_checkpoint(p_token text, p_expected_version int, p_payload jsonb)`**
  — criterion 3's capability *and* criterion 1's compare-and-set. It looks the run
  up **by `sha256(p_token)`**, derives `run_id` and `generation` from that row,
  and then performs **one `update` statement** whose `where` names `run_id`,
  `generation` **and** `version`, bumping `version`. It must distinguish
  `no_such_capability`, `stale_generation` and `version_conflict` as **named**
  outcomes.
  - **Its return shape is pinned to `(outcome text, new_version int)` and nothing
    more (round 2, MINOR-R2-1).** A `security definer` function that returned the
    run row — or `capability_hash` — would hand the executor exactly the read
    access criterion-3 negative #1 asserts it lacks, **with the harness green**.
    The harness asserts that no `ops.run` column beyond the version reaches the
    caller.
  - NIT-1: a zero-row CAS cannot self-classify. A **post-failure** classifying
    `select` is required and is explicitly **not** the read-then-write criterion 1
    forbids; what is forbidden is a `select … for update` preamble *deciding* the
    update. Use `get diagnostics row_count` plus one follow-up select.
  - ⚠ A non-matching `UPDATE` **reports `UPDATE 0` rather than raising**. Every
    assertion here must compare an affected-row count or re-read the row.
- **`ops.advance_generation(p_run_id uuid, p_expected_version int)`** — fencing
  (§5.2, scenario 13). It bumps `generation` **and rotates `capability_hash`**, so
  the paused executor's old token fails closed. Not granted to `ops_executor`.
- **`ops.record_terminal_event(p_run_id uuid, p_event_key text, …)`** — scenario
  14, idempotent on `(run_id, event_key)`.

**No RLS on `ops.run` or `ops.run_event` — see D6.** The enforcement is the
absence of table grants, which is stronger and simpler, and forced RLS with a
`NOBYPASSRLS` owner was *measured* to deadlock `reserve_run` outright. RLS and the
`nullif(current_setting('request.jwt.claims', true), '')::jsonb` predicate belong
only to the D2a negative-control table, where the bare form's `invalid input
syntax for type json` on an empty GUC would otherwise make an
exception-catching assertion pass while proving nothing (round 1, MINOR-4).

### Worker A — `supabase/tests/run_gam407_run_store_spike.sh` + `gam407_run_store_assertions.sql`

**Shape precedent: `supabase/tests/run_t503_widen_rsvp_read.sh` lines 27-45 —
NOT `run_t205_anon_grant.sh`.** T205's script fails standalone with `ERROR: role
"service_role" does not exist`; it passes in CI only through a hidden ordering
dependency on `tests/rls/auth_stub.sql`. T503 runs standalone (measured: exit 0).

⚠ **Correction to revision 2, which got this wrong (round 2, MAJOR-R2-1).**
Revision 2 claimed T503 already creates `service_role` with `noinherit
bypassrls`. **It does not.** `run_t503_widen_rsvp_read.sh:35` reads
`create role service_role nologin;`, and `rolbypassrls` was measured as `f`.
Hosted Supabase's `service_role` **is** `BYPASSRLS`, so **this harness must add
`noinherit bypassrls` itself**:

```sql
create role service_role nologin noinherit bypassrls;
```

Otherwise AC4's "cannot escalate to service-role" measures something weaker than
the hosted condition. Take T503's *structure*, not its role DDL.

The `service_role` creation and the default-privileges simulation must both run
**before** any `ops` object is created. Note what the simulation does and does
not do (round 2, MAJOR-R2-2): `alter default privileges **in schema public**`
produces exactly one `pg_default_acl` row, scoped to `public`. It is a valid
control for negative #2 (product tables) and constrains **nothing** in schema
`ops`.

Prints a `PASS`/`FAIL` line per scenario; exits non-zero if any assertion fails.

| # | Scenario | The assertion that makes it real |
|---|---|---|
| 1 | Same Todo webhook twice | Two identical `ops.reserve_run` calls → **one** row, same `run_id` both times, `created=true` then `created=false` |
| 2 | Raced claims | **Two genuinely concurrent sessions.** No advisory-lock barrier is needed — the gate measured that the loser blocks on the winner's speculative-insert token by itself. A background `psql` holding its transaction open (`begin; select ops.reserve_run(…); select pg_sleep(2); commit;`) with a second entering ~1s later is a complete proof → one row, same `run_id`, exactly one `created=true` |
| 13 | Generation fencing | `advance_generation`, then replay `publish_checkpoint` with the **old token** → named `no_such_capability`/`stale_generation`, and `ops.run` re-read field-by-field as unchanged. Do **not** trust an absent exception |
| 14 | Duplicate terminal event | Same `(run_id, event_key)` twice → one `ops.run_event` row, one effect on `ops.run` |
| 15 | Store unavailable — **store-side half only** | `pg_terminate_backend` mid-statement (or a dead port) → measured `FATAL: 57P01: terminating connection due to administrator command`, psql exit 2, and on re-connect the mid-flight `update` is rolled back so **no** row records the checkpoint as published. **`\set VERBOSITY verbose` is required** or psql prints the message without the SQLSTATE and the assertion cannot key on `57P01`. The "no external write was attempted" half belongs to Worker B (MAJOR-4) |

**Criterion 3's negative half — this is the criterion, not a supplement.** Run
these from a **direct connection as `ops_executor`** (`psql -U ops_executor`),
**never** via `set role` from a `postgres` session — `SET ROLE` is authorized
against `session_user`, so the `set role` form makes negatives 3 succeed and
turns AC4 into a guaranteed FAIL (D7). Each is asserted by return value or
SQLSTATE, never by "an exception happened":

1. `select * from ops.run` → `42501` (no table grant at all).
2. `select … from public.events` (any product table) → denied.
3. `set role ops_owner`, `set role postgres`, `set role service_role` → all denied.
4. `select ops.reserve_run(…)`, `select ops.advance_generation(…)` → execute denied.
5. `publish_checkpoint` with **another run's** token is impossible to construct;
   assert instead that a *forged/random* token yields `no_such_capability` and
   moves nothing.
6. After `advance_generation`, the executor's previously-valid token fails closed.
7. **Ownership assertion (D3):** for every `ops.*` function and table,
   `select rolbypassrls from pg_roles where rolname = pg_get_userbyid(proowner)`
   (and `relowner`) is **`false`**. Without this the rest is unfalsifiable.
   Measured expectation: `ops_owner=f`, `ops_executor=f`, `service_role=f`,
   `postgres=t`.
7a. **ACL assertion (D5):** `select proname, proacl from pg_proc where
   pronamespace = 'ops'::regnamespace` — every function's ACL is non-null and
   grants `EXECUTE` to exactly the intended roles. A **null** `proacl` means the
   PostgreSQL default is in force, i.e. `EXECUTE TO PUBLIC`, which is how
   BLOCKER-R2-1 happened. This single assertion is a better regression guard
   than the six behavioural negatives around it.
7b. The return-shape assertion from `publish_checkpoint`'s spec: no `ops.run`
   column beyond `new_version` reaches the caller.
8. **Positive control:** the executor *can* publish for its own run with its own
   valid token. A negative-only result proves only that nothing works.

**Negative control (D2a):** create a second table with a claims-keyed RLS policy,
grant the executor `select, update` on it, and assert the executor **can** forge
another run's claim and move that row. This records the round-1 finding as a
standing, re-runnable fact about the rejected design.
**Seed its fixture rows before `force` RLS is applied, or give it an
owner-permitting policy (round 2, MINOR-R2-3)** — otherwise it hits the same
insert deadlock D6 describes and the control never gets off the ground.

**Both directions on criterion 1:** a correct CAS succeeds; a stale `version`, a
stale `generation` and an unknown capability each fail **and the row is re-read
to prove it did not move**.

**AC2 mechanically (MINOR-3):** assert that `pg_get_functiondef` for
`ops.publish_checkpoint` contains exactly one `update ops.run`, and that its
`where` clause mentions `run_id`, `generation` and `version`.

### Worker B — `scripts/run-store-controller.mjs` + `.test.mjs`

Criterion 4, as a pure module with injected write sinks — no network, no
credentials, matching the existing `scripts/linear-*.test.mjs` pattern the vitest
suite already collects.

- `validateCheckpointCandidate(candidate, expected)` → a result naming every
  rejection reason: `wrong_run`, `stale_generation`, `version_conflict`,
  `missing_head_sha`, `malformed_evidence`, `store_unavailable`.
- `publishExternal(candidate, expected, sinks)` with `sinks = { github, linear }`
  — invokes **neither** sink unless validation passed, and records call order.
- Tests must assert the **negative**: on an invalid candidate, `github` and
  `linear` were called **zero** times. A happy-path-only test proves nothing
  about ordering.
- Tests must cover scenario 15's other half (MAJOR-4): a store error thrown
  during publication yields a named failure class and **zero** external writes.
- **Name fidelity:** the rejection reasons must match the outcome names
  `schema.sql` actually returns. The checker verifies this against `schema.sql`,
  not against Worker B's own tests.

### Worker B — `scripts/run-store-episode-summary.mjs` + `.test.mjs`

Criterion 5. Renders a run record + its events into a deterministic markdown
episode summary. Deterministic means byte-identical output for identical input:
no `Date.now()`, no `new Date()`, no hash-iteration-order dependence.

**AC6 is a test, not a loose artifact (MAJOR-7):** determinism is asserted inside
`run-store-episode-summary.test.mjs` over an **inline fixture** — rendering twice
and comparing byte-for-byte, plus a snapshot of the expected markdown. No new
fixture path is needed and the checker can inspect the artifact.

## Acceptance criteria

1. `bash supabase/tests/run_gam407_run_store_spike.sh` exits **0** on a scratch
   cluster started per the measured procedure (`sudo -n`), printing an explicit
   `PASS`/`FAIL` line for scenarios 1, 2, 13, 14 and **the store-side half of**
   15. Scenario 15's external-write half is Worker B's, asserted in
   `run-store-controller.test.mjs`, and the report states which artifact owns
   which half.
2. Criterion 1 is demonstrated by **one** `update` statement whose `where`
   carries `run_id`, `generation` and `version`, asserted mechanically via
   `pg_get_functiondef`. All three failure cases are shown rejected **by
   re-reading the row**, not by catching an exception.
3. Criterion 2 is demonstrated under genuine concurrency (scenario 2), not only
   sequentially.
4. Criterion 3 is demonstrated in **both directions** — every negative above
   (1-7b) plus the positive control — from a **direct `ops_executor`
   connection**, under roles created `NOSUPERUSER NOBYPASSRLS`, with
   `service_role` created `nologin noinherit bypassrls` and Supabase's stock
   default privileges simulated first. If any negative fails, criterion 3 is
   **FAIL** — so negatives 3 and 4 must be run the way D5 and D7 specify, or the
   FAIL measures the rig rather than the design.
5. The D2a negative control passes: the rejected claims-keyed design is shown
   forgeable.
6. Criterion 4 is demonstrated by tests asserting **zero** sink invocations on an
   invalid candidate and on a store error.
7. Criterion 5 is demonstrated by a determinism assertion over an inline fixture
   in `run-store-episode-summary.test.mjs`.
8. **No file under `supabase/migrations/` is created or modified**; no live
   Supabase endpoint is contacted; no GitHub or Linear endpoint is contacted
   other than the run log's `git push` and the orchestrator's item-28 status
   moves.
9. Gates: `python3 .claude/skills/gate-run/scripts/gates.py --baseline-tests 2466
   --scope scripts/ --baseline-scoped 260`. **All six** must pass. (Without
   `--scope`, gate 6 is SKIPPED because no changed file is under `src/`, and the
   script correctly reports "5 of 6" — MINOR-1.)
10. The report carries a PASS / PARTIAL / FAIL verdict **per criterion**, names
    the chosen capability design and why (D2), compares the token-RPC and
    Edge-Function designs under **scenario 15**, cites `supabase/config.toml`'s
    `schemas` list as in-repo evidence about PostgREST exposure, and has its own
    section naming what was **not** measured. That section now says: the hosted
    project's **role attributes** (`pg_roles`) — the extension set and plan tier
    were measured by the owner on GAM-408 and are recorded, not deferred.
    **The Edge-Function side of that comparison is reasoned, not measured**, and
    the report must label it so; only the token-RPC design is built. A checker
    reading AC10 must not be able to mistake the comparison for evidence.
    The report also carries the **free-tier pause** observation as an input to
    §11.1 decision 1, attributed to the owner's GAM-408 measurement.
11. If any criterion is FAIL, the report ends in the stop rule: a written FAIL
    and a named owner decision, never a fallback.
12. **The PG 17 pin is asserted, not assumed, and all four prior findings are
    re-established on it.** The harness aborts with a clear message unless
    `show server_version_num` is **≥ 170000**, prints the exact
    `server_version` it measured on, and the report records it beside the live
    server's `17.6.1.141` — same major, different minor, stated as such. Both
    findings the orchestrator has **not** already re-measured on 17.11 are
    re-established by harness assertions rather than by prose:
    - **F2** — `security definer` owned by a `BYPASSRLS` role runs with RLS off:
      the D3 ownership assertion (negative 7) is the standing proof, and the
      D2a negative-control table exercises the claims-keyed path it breaks.
    - **F4** — `SET ROLE` authorized against `session_user`: satisfied by D7's
      direct `psql -U ops_executor` connection; the harness asserts
      `session_user = 'ops_executor'` **and** `usesuper = false` for it before
      running negative 3, so a rig regression fails loudly instead of turning
      AC4 into a false FAIL.
    If any of the four does **not** hold on 17, that is a **finding, not a
    failure** — record it, keep the evidence, and say which design conclusion
    changes.

## Verification and mutation

- Run `npm ci` first if `node_modules` is absent.
- Mutation 1 (Worker A): drop `version` from the compare-and-set `where` clause.
  The stale-version assertion **must** turn red. Commit before mutating, revert,
  re-verify green (item 26's fast-tier working rule; item 23 — mutate in your own
  worktree).
- Mutation 2 (Worker A): remove `unique (issue_identifier, todo_event_id)`.
  Scenarios 1 and 2 must **both** turn red. If they stay green the harness is
  proving the caller's behavior rather than the database's.
- Mutation 3 (Worker A): `alter function ops.publish_checkpoint owner to
  postgres`. The D3 ownership assertion **must** turn red — that is the whole
  point of BLOCKER-2.
- Mutation 4 (Worker B): make `publishExternal` call the sinks before validating.
  The zero-invocation test **must** turn red.
- Leave nothing behind: stop the scratch cluster, delete its data directory, say
  so.

## Least confident decisions (item 19d)

1. **Treating "install `postgresql-17` from PGDG" as satisfying the owner's
   *"pin the harness to PG 17"*.** The pin is implicit: `start.sh:33` selects the
   highest installed major, so the harness follows the container rather than
   declaring a version. This is wrong if the owner meant an *explicit* pin the
   harness itself enforces — and it is wrong in a way that bites elsewhere,
   because a machine with 16 and 17 installed but 18 added later silently moves.
   Partially mitigated by AC12's `server_version_num >= 170000` abort, which
   makes the *floor* explicit even though the selection is not. It is **also**
   wrong if 17.11-vs-17.6.1.141 matters; I have asserted it does not and that
   assertion is not measured. What would settle it: the owner saying whether a
   version floor is the pin they meant, or the harness growing an exact-version
   argument. **Round 3 should attack this first.**
2. **The token-RPC capability (D2) as the design the spike measures.** This is
   wrong if the production design must be the Edge-Function-holds-service-role
   variant and the token-RPC result does not transfer — in particular if the ops
   schema would have to be exposed through PostgREST at all, which
   `supabase/config.toml`'s `schemas = ["public","graphql_public"]` shows it is
   not today. The report must compare both under scenario 15 and say plainly
   that only one was measured.
2a. **That the owner's GAM-408 measurement closes the "live project" deliverable
   entirely.** It closed extensions and plan tier — the two things the issue
   named. It did **not** cover `pg_roles`, and criterion 3's whole argument is a
   role-attribute argument. This is wrong if hosted `service_role`,
   `authenticated` or `anon` differ from what the harness creates, in which case
   a green AC4 measures the local rig and not Supabase. Not deferrable to another
   run either — the same §5.2 credential constraint applies. **Mitigation is
   honesty, not evidence:** AC10 requires the report to name hosted role
   attributes as unmeasured, and no criterion-3 verdict may read PASS without
   that caveat attached in the same sentence.

3. **A scratch role as a stand-in for a hosted Supabase role.** Round 1 showed
   the naive version of this argument was inverted; round 2 then showed my
   *replacement* safeguard was a no-op. `alter default privileges in schema
   public` produces exactly one `pg_default_acl` row, scoped to `public`, and
   constrains **nothing** in schema `ops` — so it is a control for negative #2
   and nothing else. The generalization hazard that actually fired was a stock
   **PostgreSQL** default I had never named: `EXECUTE TO PUBLIC` on new
   functions (D5). What makes the scratch result generalize now is three
   explicit, asserted properties — no `ops` object owned by a `BYPASSRLS` role
   (D3), every function ACL non-null and explicitly granted (D5/7a), and a
   genuine unprivileged `LOGIN` session doing the measuring (D7). This is still
   wrong if hosted Supabase grants the executor something the local role lacks,
   or if `service_role` differs from the `nologin noinherit bypassrls` the
   harness creates. **Two rounds found two different wrong reasons to believe
   this generalizes; treat the third with corresponding suspicion.**
4. **Scenario 15 by killing the connection.** This is wrong if the failure that
   matters is a *partial* write — the store accepting the checkpoint and then
   failing to acknowledge — rather than an unreachable store. A connection kill
   proves the named-failure requirement but not the ambiguity requirement. If
   the ambiguous case is not exercised, the report says scenario 15 is
   **partially** exercised, not PASS.
5. **Splitting across two workers.** Revision 1's seam was real and the gate
   found it before either worker started (`missing head SHA` named a column the
   schema did not have). The fix is in the specification, not the review:
   `head_sha` and `failure_class` are now required columns, and the rejection
   names are pinned in both sections. This is still wrong if further names drift;
   the checker verifies `run-store-controller.mjs`'s names against what
   `schema.sql` returns, not against Worker B's tests.
