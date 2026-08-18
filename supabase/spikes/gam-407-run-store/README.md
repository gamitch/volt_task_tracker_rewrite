# GAM-407 — run-store spike schema and fault harness

**This is a spike, not infrastructure.** Nothing here is deployed, nothing here
is a migration, and nothing here may quietly become the production run store —
Phase 2 proper does that. The artifact this row ships is **evidence**: a per
criterion verdict for the five things the durable-execution plan §5.1 requires
before the run schema may be committed to.

| File | What it is |
|---|---|
| `supabase/spikes/gam-407-run-store/schema.sql` | The `ops` schema under test: two roles, two tables, four `security definer` functions, plus the D2a negative control |
| `supabase/tests/run_gam407_run_store_spike.sh` | The driver. Builds the rig, runs the multi-session halves, prints the roll-up, sets the exit code |
| `supabase/tests/gam407_run_store_assertions.sql` | The single-session assertions the driver runs as `postgres` |

`schema.sql` deliberately lives under `supabase/spikes/`, **not**
`supabase/migrations/`. `supabase/migrations/` is the chain the owner applies to
the hosted project; a file there *is* production. The harness applies this file
explicitly **after** the product migrations, in the same database, so
coexistence with the real product schema is still proven.

## How to run it

The harness is **local-only**. It needs a PostgreSQL **server**, not just
`psql`, and it creates and drops its own database on whatever cluster you point
it at.

```bash
# 1. stand up a disposable cluster carrying this repo's migrations.
#    This works only under `sudo -n`, and it picks the highest installed major.
sudo -n bash .claude/skills/scratch-postgres/scripts/start.sh \
     --port 55440 --repo "$PWD"

# 2. run the harness against it
PGHOST=/tmp PGPORT=55440 PGUSER=postgres \
     bash supabase/tests/run_gam407_run_store_spike.sh

# 3. leave nothing behind
sudo -n bash .claude/skills/scratch-postgres/scripts/start.sh \
     --stop --port 55440
```

Pick a port nothing else is using. Exit code is `0` only if every assertion
passed; every assertion prints its own `PASS <id> :: <detail>` or
`FAIL <id> :: <detail>` line, and the driver ends with a per-criterion and
per-scenario roll-up.

Shape precedent is `supabase/tests/run_t503_widen_rsvp_read.sh`, which runs
standalone. It is **not** `run_t205_anon_grant.sh`, which fails standalone with
`ERROR: role "service_role" does not exist` and passes in CI only through a
hidden ordering dependency. This harness creates `service_role` itself, and
creates it `nologin noinherit bypassrls` — hosted Supabase's `service_role`
**is** `BYPASSRLS`, and T503's `create role service_role nologin` would make
"cannot escalate to service-role" measure something weaker than the hosted
condition.

### Which version it measures

The first line of output is always

```
server_version=<v> server_version_num=<n>
```

The harness is **pinned to PostgreSQL 17 and degrades honestly rather than
aborting**. Below `170000` it prints `PARTIAL: measured on PG <v>, not the
pinned 17` and appends that qualifier to **every** result line, so a PG-16 run
is never presented as a PG-17 one. It does not refuse to run.

Measured green on **PostgreSQL 17.11** (`server_version_num = 170011`). The live
Supabase project is **17.6.1.141** — *same major, different minor*. That is a
claim about which behaviours are minor-version-scoped, not an identity, and it
is stated as one.

### Why it is not in CI

`.github/workflows/ci.yml:196` runs the `sql` job against a **`postgres:16`**
service container and installs only `postgresql-client`, so neither delivery
path can run this harness: there is no server binary to start a cluster with,
and a PG-16 run would be qualified `PARTIAL` at best. Bumping the CI image would
move **nine currently-green SQL suites** onto a new major, which is the owner's
call and must not be smuggled in as a side effect of a spike. Not-CI-wiring this
is therefore a **knowing deferral with a filed row (GAM-415)**, not an oversight.

## What each scenario proves

| Assertion id | What it proves |
|---|---|
| `scenario-1` | **Criterion 2.** Two identical `ops.reserve_run` calls → **one** row, the same `run_id` both times, `created` true then false, and the capability token issued exactly once. Idempotency is a property of the `unique (issue_identifier, todo_event_id)` constraint, not of the caller |
| `scenario-2` | **Criterion 2 under genuine concurrency.** A background session holds its transaction open across `pg_sleep(2)`; a second enters ~1s later, **blocks on the winner's speculative-insert token with no advisory-lock barrier**, and then reads the winner's row back. The driver reports the measured block time |
| `crit1-cas-ok` / `crit1-stale-version` / `crit1-stale-generation` / `crit1-unknown-capability` | **Criterion 1, both directions.** One conditional `update` validates `run_id`, `generation` **and** `version` together. Each rejection is proved by **re-reading the row field by field** — a non-matching `UPDATE` reports `UPDATE 0` rather than raising, so an absent exception proves nothing |
| `ac2-single-update-cas` | The mechanical half of criterion 1: `pg_get_functiondef` shows exactly **one** `update ops.run`, whose `where` names all three columns. **Necessary and not sufficient** — a `where` clause can name `generation` and still be incapable of rejecting on it, which is why `crit1-stale-generation` exists |
| `scenario-13-route-i-stale-belief` | **Fencing route (i).** The executor asserts a `p_expected_generation` that does not match the row, holding the **current** token → named `stale_generation`, row unmoved. This is the criterion-1 proof |
| `scenario-13-route-ii-fencing` | **Fencing route (ii).** `advance_generation` bumps the generation **and rotates `capability_hash`**, so the paused executor's old token no longer resolves at all → named `no_such_capability`, row unmoved — and the **new** token still works, so this is fencing rather than breakage. This is the §5.2 proof. The two routes fail differently and both are exercised |
| `scenario-14` | The same `(run_id, event_key)` terminal event delivered twice → `recorded` then `duplicate`, **one** `ops.run_event` row, and **exactly one** effect on `ops.run` (version delta of 1) |
| `scenario-15-store-side` | **Store-side half only.** The victim transaction first reports `published=ok`, so a publication genuinely **was** in flight; the connection is then killed mid-statement: `FATAL: 57P01`, psql exit 2. On re-connect the **four columns the assertion reads** — `version`, `generation`, `head_sha`, `status` — are unchanged from their pre-publication values, so the version bump that `ok` implies is not visible: the in-flight `update` **rolled back**. Scoped to those four columns of `ops.run`; the assertion does not read `result_refs`, `phase`, `updated_at` or any other table. Without the `published=ok` term the `after = before` comparison passes **trivially** whenever no publication happened at all (round-1 checker finding MAJOR-1, demonstrated with `schema.sql` intact). The failure is *named*, not silent. `\set VERBOSITY verbose` is required or psql prints the message without the SQLSTATE. The **"no external write was attempted"** half is Worker B's, in `scripts/run-store-controller.test.mjs` |
| `crit3-neg1…neg6`, `crit3-pos-control-own-run` | **Criterion 3, both directions**, every negative run from a **direct `ops_executor` login**. `SET ROLE` is authorized against `session_user`, so running these via `set role` from a `postgres` session makes the escalations *succeed* and turns the criterion into a false FAIL |
| `guard-d3-ownership`, `guard-d3-role-attributes`, `guard-d7-direct-login`, `guard-service-role-shape` | **Standing guards, not findings.** They keep the F2/F4 preconditions from creeping back in (no `ops` object owned by a `BYPASSRLS` role; the measuring session is a genuine unprivileged login). They do **not** re-establish that a `BYPASSRLS` owner defeats forced RLS, or that `SET ROLE` keys off `session_user` — those were measured directly and live in the packet |
| `d5-acl-non-null`, `d5-public-holds-no-execute`, `d5-executor-execute-scope`, `d5-executor-no-table-grants` | **`PUBLIC` holds `EXECUTE` on every new function by default.** A **null** `proacl` means that default is in force. This one ACL assertion is a better regression guard than the six behavioural negatives around it |
| `return-shape-publish-checkpoint` | `publish_checkpoint` returns `(outcome, new_version)` and nothing more. Returning the run row — or `capability_hash` — would hand the executor exactly the read access negative #1 asserts it lacks, **with the harness green** |
| `d2a-precondition`, `d2a-claims-keyed-forgeable` | **Negative control: the REJECTED design.** A PASS here means the forgery **succeeded** — the executor re-set its own `request.jwt.claims` to another run's id and moved that row. `request.jwt.claims` is an unrecognised two-part custom GUC and therefore `USERSET`; `revoke set on parameter` does not restrain it. This is why the capability is a token-verifying RPC and not RLS keyed on a claim |
| `coexistence-product-schema` | The `ops` schema was created **on top of** the 24 applicable product migrations, in the same database, and collides with nothing |

## Design decisions worth not re-deriving

- **`ops_executor` holds no table grants at all.** Its only privilege is
  `execute` on `ops.publish_checkpoint`. The privilege check denies it before
  any policy is consulted (`aclcheck_error`, not a policy denial).
- **No RLS on `ops.run` / `ops.run_event`, deliberately.** With a `NOBYPASSRLS`
  owner and a claims-keyed policy, forced RLS was *measured* to make
  `reserve_run` unable to insert at all, so no run could ever be created and
  every scenario became unreachable. "No table grants" is the enforcement, and
  it is stronger and simpler than "RLS plus no table grants". RLS appears only
  on the D2a negative-control table.
- **`p_expected_generation` is the caller's asserted value, never the row's.**
  Deriving the generation from the row the update then filters on is
  tautological and can never reject — measured — which would make criterion 1
  report PASS while testing two thirds of it.
- **No extension is required.** Randomness is `gen_random_uuid()` and hashing is
  `sha256(bytea)`, both built-in. `gen_random_bytes` is **pgcrypto**, which is
  absent on the scratch cluster and present on the hosted project — exactly the
  local-red / hosted-green asymmetry this schema exists to avoid. The capability
  token is two concatenated UUIDs (244 bits); only its `sha256` hex is stored,
  and the plaintext is returned exactly once, to the `reserve_run` call that
  created the run.
- **Both `int` arguments are always passed by name.**
  `publish_checkpoint(text, int, int, jsonb)` has two adjacent `int`s that are
  both `1` on every freshly reserved run, so a swapped pair would be silently
  indistinguishable at exactly the state the harness starts from.
- **`ops_executor` has a password**, and the harness exports `PGPASSWORD`. It
  guards nothing on this cluster — `pg_hba.conf` is `local all all trust` and a
  *wrong* password connects — which is why its existence is asserted against
  **`pg_authid`** and never by "the connection succeeded". Its purpose is
  portability to a `scram-sha-256` server a later phase might point this at.

## Known discrepancy with packet revision 6

Criterion 3's negative 7 records the measured expectation as
`ops_owner=f, ops_executor=f, service_role=f, postgres=t`, but AC4 and the
harness section require `create role service_role nologin noinherit
**bypassrls**`. Both cannot hold: creating `service_role` `BYPASSRLS` makes
`rolbypassrls = t` by construction, and the gate rounds' `service_role=f` was
measured against T503's weaker `create role service_role nologin`.

`guard-d3-role-attributes` therefore asserts
`ops_owner=f ops_executor=f postgres=t service_role=t` and says so in its
detail line. D3's load-bearing property — **no `ops` object is owned by a
`BYPASSRLS` role** — is asserted separately and unaffected by
`guard-d3-ownership`; `service_role` owns no `ops` object.

## What this harness does not measure

- **The hosted project's role attributes** (`pg_roles`). Extensions and plan
  tier were measured by the owner on GAM-408; `pg_roles` was not, and it is
  carried by GAM-414. Every criterion-3 verdict must name that as unmeasured in
  the same sentence.
- **The Edge-Function-holds-service-role capability variant.** Only the
  token-RPC design is built here. Any comparison of the two is *reasoned*, not
  measured.
- **Scenario 15's ambiguous case** — the store accepting a checkpoint and then
  failing to acknowledge it. A connection kill proves the *named-failure*
  requirement, not the *ambiguity* requirement.
- **Criteria 4 and 5** and scenario 15's external-write half, which belong to
  `scripts/run-store-controller.test.mjs` and
  `scripts/run-store-episode-summary.test.mjs`.
- **PostgREST exposure.** `supabase/config.toml` sets
  `schemas = ["public", "graphql_public"]`; reaching an `ops` schema through
  PostgREST would require adding it there, which this row forbids. That is
  in-repo evidence, not something this harness exercises.
