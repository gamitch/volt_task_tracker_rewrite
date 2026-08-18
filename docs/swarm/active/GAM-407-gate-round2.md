# GAM-407 — `checker-premise` round 2 (item 19), verdict **REVISE**

Artifact: `docs/swarm/active/GAM-407-packet.md` **revision 2**
Round 2 of 2 (item 19a). Agent: `checker-premise`, `model: "opus"`, dispatched
`run_in_background: false` and waited. ~94K tokens, 43 tool calls.

**Closure of round 1: 13 CLOSED, 4 PARTIALLY CLOSED, 1 NOT CLOSED.**
**New: 3 BLOCKER, 3 MAJOR, 3 MINOR, 1 NIT.**

Round 1 ended with an instruction the author did not follow: *"Revisions 1 and 2
are the ones that must be **measured**, not argued: re-run the forgery probe and
the `security definer` probe against the revised design before resubmitting."*
Round 2 did that. Every new BLOCKER below came from **building revision 2's
design on a scratch cluster and attacking it**, not from reading it.

Scratch cluster: PG 16.14 on port 55434, stopped and its data directory deleted.

---

## BLOCKER-R2-1 — PUBLIC holds `EXECUTE` on new functions by default; the executor hijacks any run in two statements

Revision 2 granted `ops_executor` only `usage` on `ops` and `execute` on
`publish_checkpoint`, and stated twice that the other functions were "not granted
to `ops_executor`". **It contained no `revoke`.** PostgreSQL grants `EXECUTE` on
every new function to `PUBLIC` by default. Measured ACLs on the design as
specified:

```
      proname       |   owner   | prosecdef |                proacl
 advance_generation | ops_owner | t         |            <-- NULL = default = EXECUTE TO PUBLIC
 publish_checkpoint | ops_owner | t         | {=X/ops_owner, ops_owner=X/…, ops_executor=X/…}
 reserve_run        | ops_owner | t         |            <-- NULL = default = EXECUTE TO PUBLIC
```

`ops_executor`, holding literally the packet's two grants and nothing else:

```
set role ops_executor;
select * from ops.reserve_run('GAM-HIJACK','evt-h');
 c5d0c4a5-… | t | d43c80e5-…fcbd0eb9-…      <-- created a run AND was handed its plaintext token

select * from ops.advance_generation('3736cdf4-…'::uuid, 2);   -- GAM-A: a run it does not own
 ok | 2544d5bc-…68f8cef2-…                  <-- handed GAM-A's NEW plaintext capability token

select * from ops.publish_checkpoint('2544d5bc-…68f8cef2-…', 3, '{"hijacked":true}');
 ok | 4
```

Re-read as `postgres`:
`3736cdf4-… | GAM-A | generation 3 | version 4 | published | {"hijacked": true}`

The executor **stole another run's capability, fenced it, and published to it.**
`advance_generation` is additionally an unauthenticated DoS on every other
executor's token. Note also that `anon` and `authenticated` hold `EXECUTE` on
`publish_checkpoint` (`=X/ops_owner`), gated today only by their lack of `usage`
on `ops`.

**Measured fix:**
```sql
revoke execute on function ops.reserve_run(text,text) from public;
revoke execute on function ops.advance_generation(uuid,int) from public;
revoke execute on function ops.publish_checkpoint(text,int,jsonb) from public;
grant  execute on function ops.publish_checkpoint(text,int,jsonb) to ops_executor;
```
→ `ERROR: 42501: permission denied for function reserve_run` / `… advance_generation`;
positive control still `ok`.

## BLOCKER-R2-2 — forced RLS + a `NOBYPASSRLS` owner + a claims-keyed policy deadlocks the design

Built exactly as revision 2 prescribed, with the mandated
`nullif(current_setting('request.jwt.claims', true), '')::jsonb` predicate:

```
select * from ops.reserve_run('GAM-A','evt-1');
ERROR:  42501: new row violates row-level security policy for table "run"
CONTEXT: SQL statement "insert into ops.run (…) on conflict … do nothing returning …"
         PL/pgSQL function reserve_run(text,text) line 5 at SQL statement
```

The controller has no JWT claim to set — D2 removed it. So the `with check` is
`NULL` and `force` binds the owner. **No run can ever be created**, and every
scenario (1, 2, 13, 14, 15) is unreachable.

The only working variant is a policy that unconditionally permits the owner —
which makes "defence-in-depth" false, since the policy permits the only role that
ever touches the table. And it is doubly vacuous: RLS is never consulted for
`ops_executor` at all, because with no table grants the **privilege** check fires
first (`aclcheck_error`, not a policy denial).

**Recommended resolution: drop RLS from `ops.run`/`ops.run_event` and say why.**
"No table grants" is a stronger and simpler statement than "RLS plus no table
grants". Keep RLS only on the D2a negative-control table.

## BLOCKER-R2-3 — `SET ROLE` is authorized against `session_user`, not `current_user`

Revision 2 mandated all roles `nologin`, so the harness must `set role
ops_executor` from a `postgres` session. Measured from there:

```
set role ops_executor;  select session_user, current_user;   -> postgres | ops_executor
set role ops_owner;     SET      -> postgres | ops_owner        <-- ESCALATED
set role postgres;      SET      -> postgres | postgres         <-- ESCALATED
set role service_role;  SET      -> postgres | service_role     <-- ESCALATED
```

All three of criterion-3 negative #3's assertions **succeed**, and AC4 ("if any
negative fails, criterion 3 is FAIL") would therefore have forced an automatic
FAIL for a rig artifact rather than a property of the design.

**Measured fix.** `pg_hba.conf` on the scratch cluster is `local all all trust`,
so a LOGIN role connects with no secret. With `alter role ops_executor login` and
a direct `psql -U ops_executor`:

```
select session_user, current_user;                 -> ops_executor | ops_executor
set role ops_owner;      ERROR: 42501: permission denied to set role "ops_owner"
set role postgres;       ERROR: 42501: permission denied to set role "postgres"
set role service_role;   ERROR: 42501: permission denied to set role "service_role"
select * from ops.run;                    ERROR: 42501: permission denied for table run
select * from ops.reserve_run(…);         ERROR: 42501: permission denied for function reserve_run
select * from ops.advance_generation(…);  ERROR: 42501: permission denied for function advance_generation
```

Strictly stronger as well as correct: `session_user` is no longer a superuser.

---

## MAJOR-R2-1 — the packet misdescribed the precedent it was told to re-point at

Revision 2 claimed `run_t503_widen_rsvp_read.sh` is "a strict superset … plus
`create role service_role nologin noinherit bypassrls`". Line 35 actually reads:

```
    create role service_role nologin;
```

Measured after running T503: `service_role | rolbypassrls = f`. Hosted Supabase's
`service_role` **is** `BYPASSRLS`. So round 1's MINOR-5 is **not closed** — the
packet closed a finding about unverified citations by making an unverified
citation (item 19c). The new harness must add `noinherit bypassrls` itself.

## MAJOR-R2-2 — least-confident #3's stated safeguard is a measured no-op for schema `ops`

```
select defaclnamespace::regnamespace, defaclobjtype, defaclacl from pg_default_acl;
 public | r | {authenticated=arwdDxt/postgres,anon=arwdDxt/postgres,service_role=arwdDxt/postgres}
(1 row)
```

`alter default privileges **in schema public**` constrains nothing in schema
`ops`. It is a valid control for criterion-3 negative #2 (product tables) and for
nothing else. The generalization hazard that actually fired — PUBLIC `EXECUTE` on
functions — is a stock PostgreSQL default the packet never mentioned.

## MAJOR-R2-3 — Definition of Ready #3 is unmet at dispatch time

The escalation is named and posted (`commentCreate success: true` in the run log)
but explicitly **pending**. DoR #3 requires "named **and pre-approved**". Honestly
declared, still not Ready. This is the one genuine owner question.

## MINOR-R2-1 — `publish_checkpoint`'s return payload is unconstrained

The packet pins the inputs and the named outcomes but says nothing about what the
function returns. A worker returning the full run row (or `capability_hash`) from
a `security definer` function would hand the executor exactly the read access
negative #1 asserts it lacks — **with the harness green**. Pin the return to
`(outcome text, new_version int)` and assert no other `ops.run` column reaches
the caller.

## MINOR-R2-2 — item 27 miscited for the Partial ruling

Item 27 governs *"a user-visible surface that reads from a fixture, stub, or
hardcoded value"* and excludes work with no user-visible surface. A database
spike has none. The correct authority is **item 20** plus the linked follow-up.
The outcome is defensible; the rule cited does not say it.

## MINOR-R2-3 — D2a's negative control hits the same insert deadlock

Its fixture rows must be seeded before `force` RLS applies, or its policy must
permit the owner.

## NIT-R2-1 — "24 of 25 migrations" vs the tool's own "applying 25 of 25 … SKIPPED 1"

Same fact; quote the tool's wording so a reader diffing the two does not stop.

---

## What round 2 confirmed as working

Recorded because these are **spike results**, not packet review:

| Claim | Measured |
|---|---|
| `sha256(bytea)` and `gen_random_uuid()` are PG-16 built-ins | Both in `pg_catalog`; only `plpgsql` installed. The packet's dodge of the hosted-extension question is legitimate |
| Single-statement CAS on `(run_id, generation, version)` | Built; `pg_get_functiondef` regexp for `update ops.run` returned exactly **1**; `ok` / `no_such_capability` / `version_conflict` all produced via `get diagnostics row_count` + one classifying select |
| Token-verifying `security definer` RPC, executor with no table grants | `select * from ops.run` → `42501`; `public.events`, `public.rsvps`, `public.students`, `pg_authid` → all `42501` |
| Forged/random token | `no_such_capability`, nothing moved |
| `advance_generation` rotates the hash → old token fails closed | `no_such_capability`; row re-read `GAM-D \| generation 2 \| version 3 \| {"ok": true}` — unchanged |
| Positive control | executor publishes for its own run: `ok \| 2`, row re-read `published` |
| D3 ownership assertion is producible | `rolbypassrls`: `ops_owner=f`, `ops_executor=f`, `service_role=f`, `postgres=t` |
| Scenario 15 store-side | `pg_terminate_backend` → `FATAL: 57P01: terminating connection due to administrator command`, psql exit 2; on reconnect the mid-flight `update` is rolled back (`GAM-B \| reserved`, not `midflight`). Needs `\set VERBOSITY verbose` for the SQLSTATE to be capturable |
| `run_t503_widen_rsvp_read.sh` standalone | exit **0** on a fresh cluster |
| `gates.py --scope scripts/ --baseline-scoped 260` | flags exist; `npx vitest run scripts/` → 11 files / 260 tests; `eslint.config.js` covers `scripts/**/*.mjs` |
| `docs/swarm/verification-log.md` | pure append, only the orchestrator writes it, `shared-doc-merge` names the resolver — no two-worker conflict |
| No conflict with shipped work | every path is new; the `2466`/`260` floors are satisfied |

Scenario 2 (raced claims) and `reserve_run`'s create-or-return were measured in
round 1 and **not** re-measured in round 2; that inheritance is stated rather
than hidden.

---

## The gate's own recommendation on item 19a

> Revisions 1-3 are not judgement calls. They are three mechanical corrections
> whose fixes I have already measured working on a real cluster — nine lines of
> SQL and one `alter role`. Sending the owner a packet to arbitrate
> `revoke execute … from public` would waste the escalation.
>
> The one thing genuinely worth the owner's attention is least-confident entry 1
> / MAJOR-R2-3 — Definition of Ready #3's "pre-approved".
>
> Attach BLOCKER-R2-1 and BLOCKER-R2-2 as *spike findings*, not as packet
> defects — the PUBLIC-EXECUTE hijack and the forced-RLS deadlock are the first
> measured evidence about plan §5.1's capability model, and like round 1's two
> BLOCKERs they are worth more than the packet they were found in.
>
> If the owner answers "hold the row", stop — and file the two new BLOCKERs
> against plan §5.1 regardless, because they are true independently of whether
> GAM-407 ships.
