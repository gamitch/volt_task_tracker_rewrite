# GAM-407 — `checker-premise` round 1 (item 19), verdict **REVISE**

Artifact: `docs/swarm/active/GAM-407-packet.md` (as committed at the time of the gate)
Round 1 of at most 2 (item 19a). Agent: `checker-premise`, `model: "opus"`,
dispatched `run_in_background: false` and waited. ~115K tokens, 50 tool calls.

**2 BLOCKER, 5 MAJOR, 9 MINOR, 2 NIT.**

This file is the durable record of the gate. It exists because item 19 says
"record the verdict alongside the plan," and because the two BLOCKERs below are
**spike findings in their own right** — they are the first measured evidence
anyone in this repository has about the plan's §11.1 decision 1, and they would
be lost if only the revised packet survived.

---

## Environment claims: all re-measured, all confirmed

The gate independently re-ran every claim in the packet's "Current measured
state" table on its own cluster (port 55433) and confirmed each one:
`start.sh` needs `sudo -n`; PostgreSQL 16.14; 24 of 25 migrations; `pgcrypto`
and `uuid-ossp` available-not-installed, `pgjwt`/`pg_net`/`pg_cron`/`pgsodium`
absent; no Supabase credential of any kind in the environment; the vitest
baseline is **96 files / 2466 tests**.

Two corrections to the table:

- **`service_role` does not exist on the scratch cluster** — only `anon`,
  `authenticated`, `postgres`. The packet did not say so and it is load-bearing.
- **`node_modules` absent** is an operational note about a *different* container,
  not a measurement of this one; it should not sit in a measured-state table.

One implicit claim the gate checked and confirmed: `vite.config.ts` sets no
`include`, so vitest's default glob applies and **`scripts/*.test.mjs` IS
collected** — `vitest list --filesOnly | grep ^scripts/` returns 11 files,
6 of them `.mjs`. `npx vitest run scripts/` → **11 files / 260 tests**.

---

## BLOCKER-1 — RLS keyed on `request.jwt.claims` enforces nothing against a role that can issue SQL, and the packet's "a fortiori" argument is inverted

The packet's D2 argued that proving criterion 3 under a `NOSUPERUSER NOBYPASSRLS`
role on a scratch cluster is the *weaker* case, so a pass generalizes upward to
hosted Supabase. **The gate built the prescribed design and broke it.**

`request.jwt.claims` is an unrecognised two-part custom GUC. Postgres therefore
classifies it `USERSET` — any session can assign it. Measured on PG 16.14, with
`force row level security` on `ops.run` and policies keyed on the claim, and
`ops_executor` created `nologin nosuperuser nobypassrls` holding only `usage` on
`ops` and `select, update` on `ops.run`:

```
set role ops_executor;                       -- current_user -> ops_executor
set request.jwt.claims = '{"run_id":"1111...","generation":"1"}';
select count(*) from ops.run;                -- own run visible: 1        (correct)

-- the role simply re-sets its own claim:
set request.jwt.claims = '{"run_id":"2222...","generation":"1"}';
select count(*), string_agg(issue_identifier,',') from ops.run;
                                             -- FORGED other run visible: 1 | GAM-B
update ops.run set status='HIJACKED', version=version+1
  where run_id='2222...' and generation=1 and version=1;
                                             -- UPDATE 1
reset role;
select run_id, issue_identifier, status, version from ops.run;
-- 2222...|GAM-B|HIJACKED|2      <-- the row moved
```

The only lockdown Postgres offers was tested and does not apply:

```
revoke set on parameter "request.jwt.claims" from public;        -- REVOKE
revoke set on parameter "request.jwt.claims" from ops_executor;  -- REVOKE
set role ops_executor; set request.jwt.claims = '{"run_id":"2222..."}';  -- SET (succeeded anyway)
```

`GRANT/REVOKE ... ON PARAMETER` has no effect on an unrecognised custom GUC.

**What this means for the plan, not just for the packet.** The non-derivability
of a claims-keyed capability comes entirely from the **transport** — PostgREST
verifying a JWT and setting the claim on a connection whose holder cannot issue
arbitrary SQL. Strip the transport and the "capability" is a variable its holder
assigns to itself. So the scratch cluster is not the weaker case; it is a
*stronger-attacker* case, and in it the design has no enforcement at all.

Worse, the realistic failure mode was a green test: a worker would have written
the negative as *"with no claim set, the executor sees 0 rows"*, never attempted
the forgery, and passed. That is verbatim the failure `scratch-postgres`
SKILL.md § "Denials do not all look alike" exists to prevent.

**Accepted correction:** the executor gets **no table grants at all** — only
`execute` on a token-verifying `security definer` RPC that derives `run_id` and
`generation` from a secret it checks *inside* the function, never from a
settable GUC. That negative is real and provable on a scratch cluster, needs
neither `pgjwt` nor PostgREST, and restores the weaker-case argument.

## BLOCKER-2 — `security definer` and RLS cancel each other as the packet specified them

The packet required both `security definer` functions and forced RLS on the same
objects, and never said who owns the functions. Default ownership is `postgres`,
which on this cluster is `rolsuper=t rolbypassrls=t` — the packet's own table
recorded that and did not draw the consequence.

```
select pg_get_userbyid(proowner) from pg_proc where proname='publish_checkpoint';  -- postgres
set role ops_executor;
reset request.jwt.claims;
select count(*) from ops.run;                    -- ERROR (see MINOR-4)
select ops.publish_checkpoint('1111...',1,1);    -- 'ok'
reset role;
-- 1111...|GAM-A|published|2   <-- row moved, with NO claim and RLS FORCED
```

`force row level security` binds the table **owner**; it does not defeat the
`BYPASSRLS` role *attribute*. Every criterion-3 assertion routed through an RPC
owned by `postgres` would have been vacuous. This is the same class as the
`security_invoker` view claim this repo got wrong three times.

**Accepted correction:** a dedicated `ops_owner` role created
`nosuperuser nobypassrls` owns every `ops.*` function and table, and the harness
asserts `rolbypassrls = false` for the owner of each — otherwise the whole
criterion-3 result is unfalsifiable.

---

## MAJOR findings

**MAJOR-3 — the cited harness precedent does not run.**
`PGHOST=/tmp PGPORT=55433 bash supabase/tests/run_t205_anon_grant.sh` →
`ERROR: role "service_role" does not exist`, exit 1. Its line 29 grants default
privileges to `service_role`, which neither `start.sh` nor
`calendar_feed_platform_stub.sql` creates. It passes in CI only because
`tests/rls/run.sh` runs first and applies `tests/rls/auth_stub.sql` (`create role
service_role nologin noinherit bypassrls`) — a hidden ordering dependency.
`supabase/tests/run_t503_widen_rsvp_read.sh:27-38` already carries the fix and
says so in a comment. Accepted: re-point the precedent.

**MAJOR-4 — scenario 15 was assigned to a worker whose Allowed Files exclude its
subject.** "No external write is attempted" is a property of injected sinks in a
JS module (Worker B's file); a `psql` harness cannot observe it. Accepted: split
the scenario, and reword AC1 so the shell harness is asked only for what it can
produce.

**MAJOR-5 — the packet self-approved a scope reduction the issue states as
binding.** The issue's verification note ends: *"the spike must measure both
rather than assume them"* (live extension set, plan tier). The packet converted
"must measure" into "report as unmeasured". Definition of Ready #3 requires an
escalation to be named **and pre-approved**; GAM-399 decision 5 authorized
running the spike, not dropping a deliverable. **Accepted — see the escalation
recorded on GAM-407 and in the revised packet's own scope section.** No
dispatched run can close this: this container holds no Supabase credential, and
by the plan's own §5.2 an executor should not hold one.

**MAJOR-6 — the harness would never be invoked.** `.github/workflows/ci.yml`
enumerates each SQL suite as an explicit step; there is no glob. The comment
block in that file records that "green-but-never-executed" already cost this
repo a task (T701). A dispatched run cannot push workflow files, so the repo's
established remedy applies: `git format-patch` under `docs/swarm/active/`
(precedents `GAM-314-workflow-wiring.patch`, `GAM-325-lane-d-workflows.patch`,
delivered end to end by PRs #159/#160). Accepted.

**MAJOR-7 — AC6 named an artifact with no allowed path.** Neither the input
fixture nor the generated summary had a writable path. Accepted: fold
determinism into a test with an inline fixture.

---

## MINOR / NIT findings, all accepted

1. **AC8 "the six gates pass" is not achievable.** `gates.py` derives gate 6's
   scope from changed **`src/`** files; every file here is outside `src/`, so
   gate 6 reports SKIPPED and the verdict prints "5 of 6". Measured replacement:
   `--scope scripts/ --baseline-scoped 260`.
2. **AC7 contradicted the run itself** — the dispatch protocol mandates
   `git push` of the run log and item 28 mandates Linear status moves. Align
   with the forbidden-list carve-out.
3. **AC2 was subjective** ("the reviewer can point at that statement"). Make it
   mechanical via `pg_get_functiondef`.
4. **The prescribed RLS predicate raises instead of denying.** With the GUC at
   `''`, `current_setting('request.jwt.claims', true)::jsonb` raises
   `invalid input syntax for type json`. A negative assertion that catches an
   exception passes while proving nothing. Use
   `nullif(current_setting(...), '')::jsonb` and compare a **row count**.
5. **`service_role` must be created** with hosted fidelity
   (`create role service_role nologin noinherit bypassrls`) or AC4's
   "cannot escalate to service-role" is unmeasurable.
6. **Version skew unstated:** scratch is PG **16.14**; `supabase/config.toml`
   declares `major_version = 17` for the hosted target.
7. **Schema/validator mismatch:** the validator rejected on "missing head SHA"
   and scenario 15 wanted a named failure class, but the minimum schema carried
   neither `head_sha` nor `failure_class`. Both are in plan §5.1's table.
8. **Item 24 paths missing** from Allowed Files (`task-ledger.md` is frozen by
   item 29, but `verification-log.md` is not).
9. **NIT-1:** "not a read-then-write" over-forbids — a zero-row CAS cannot
   self-classify, so a *post-failure* classifying `select` is required and is
   not a read-then-write. Measured: `get diagnostics row_count` plus one
   follow-up select yields `no_such_run` / `stale_generation` /
   `version_conflict` cleanly.
10. **NIT-2:** `ops.run_event` was written as a function signature but given a
    `unique` constraint. It is a table.

---

## Findings that went the packet's way

Recorded because a gate that only ever says "wrong" is not measuring.

- **D1 (spike SQL outside `supabase/migrations/`) is SOUND**, and more strongly
  than the packet argued: the issue's own "Size and tier" line says *"One
  additive ops-schema migration **(scratch-first)**"*, and `supabase/spikes/`
  does not yet exist, so nothing collides.
- **`ops.reserve_run` as `insert … on conflict do nothing returning` with a
  read-back is correct under genuine concurrency.** The gate expected this to
  fail and it did not: two background `psql` sessions, the loser blocked on the
  winner's speculative-insert token, then returned the winner's `run_id` with
  `created=false`; `count(*) = 1`.
- **Scenario 2 needs no advisory-lock barrier.** The loser blocks on the
  speculative token by itself; a background session holding its transaction open
  is a complete, genuinely concurrent proof. Simpler than the packet specified.
- **Criterion 1's single-statement CAS works** exactly as specified.
- **`scripts/*.test.mjs` is collected by vitest**, so AC8 was not broken on that
  point.
- **Worker A's `model: "opus"` is correct** under item 18.

## Free evidence the gate found for the report

`supabase/config.toml` sets `schemas = ["public", "graphql_public"]`. For an
executor to reach an `ops` schema through PostgREST at all, `ops` must be added
to that list — a change to a file the packet forbids. That is an in-repo answer
to half of the D2 comparison the spike report owes, obtained without touching
the live project.
