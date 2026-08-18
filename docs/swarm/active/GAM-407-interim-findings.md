# GAM-407 — interim spike findings on plan §5.1's operational run store

**Status: INTERIM. This is not the spike report GAM-407 asks for.** No worker was
dispatched, because `checker-premise` returned REVISE in both of item 19a's two
permitted rounds and item 19 forbids a packet reaching a worker without a
DISPATCH verdict. Nothing here is a PASS/FAIL verdict on the five criteria.

What it *is*: everything the two premise-gate rounds **measured on a real
PostgreSQL cluster** while attacking the proposed design. Four of those
measurements are BLOCKER-class facts about plan §5.1's capability model, and they
are true whether or not GAM-407 ever ships. They cost two gate rounds to find and
would cost the same again if they were left in a run log nobody reads.

Provenance: `docs/swarm/active/GAM-407-gate-round1.md` and `-round2.md` carry the
full transcripts. Both rounds ran `checker-premise` on `opus`, on a disposable
cluster built by `.claude/skills/scratch-postgres/` carrying this repo's 24
applicable product migrations (PG **16.14**; `supabase/config.toml` declares
`major_version = 17` for the hosted target — the skew is immaterial to the
privilege and RLS semantics below, but it is stated rather than assumed).

---

## Part 1 — Four ways the obvious capability design is not secure

Plan §5.1 criterion 3 requires a run-scoped capability that "can only submit a
checkpoint candidate for that run and generation". Each finding below is a way a
reasonable reading of that produces something that is not.

### F1. RLS keyed on `request.jwt.claims` enforces nothing against a holder who can issue SQL

`request.jwt.claims` is an *unrecognised two-part custom GUC*. PostgreSQL
therefore classifies it `USERSET` — any session may assign it. Measured with
`force row level security` on the run table, policies keyed on the claim, and an
executor role created `nologin nosuperuser nobypassrls` holding only `usage` on
the schema and `select, update` on the table:

```
set role ops_executor;
set request.jwt.claims = '{"run_id":"<own>","generation":"1"}';
select count(*) from ops.run;                              -- 1   (correct)
set request.jwt.claims = '{"run_id":"<someone else>","generation":"1"}';
select count(*), string_agg(issue_identifier,',') from ops.run;   -- 1 | GAM-B  (forged)
update ops.run set status='HIJACKED', version=version+1
  where run_id='<someone else>' and generation=1 and version=1;   -- UPDATE 1
```

Re-read as `postgres`: `GAM-B | HIJACKED | version 2`. The row moved.

The one lockdown Postgres offers does not apply: `REVOKE SET ON PARAMETER
"request.jwt.claims" FROM PUBLIC` (and from the role) both report `REVOKE`, and
the subsequent `SET` succeeds anyway. `GRANT/REVOKE … ON PARAMETER` has no effect
on an unrecognised custom GUC.

**What this means for the plan.** The non-derivability of a claims-keyed
capability lives entirely in the **transport** — PostgREST verifying a JWT and
setting the claim on a connection whose holder cannot issue arbitrary SQL. It is
not a property of the database. Any design that says "RLS keyed on per-run JWT
claims" is really saying "PostgREST, plus RLS as bookkeeping", and its threat
model must say so.

### F2. A `security definer` function owned by a `BYPASSRLS` role runs with RLS off

`force row level security` binds the table **owner**; it does not defeat the
`BYPASSRLS` role *attribute*. Default ownership on both a scratch cluster and
hosted Supabase is `postgres`, which carries `BYPASSRLS`. Measured, with RLS
forced and **no claim set at all**:

```
select pg_get_userbyid(proowner) from pg_proc where proname='publish_checkpoint';  -- postgres
set role ops_executor;  reset request.jwt.claims;
select ops.publish_checkpoint('<run>',1,1);   -- 'ok'
```

Row re-read: `published | version 2`. Every RLS-based assertion routed through
such a function is vacuous.

**Consequence:** any ops schema that mixes RLS with `security definer` helpers
must own its objects with a `NOSUPERUSER NOBYPASSRLS` role and **assert that
mechanically** — `select rolbypassrls from pg_roles where rolname =
pg_get_userbyid(proowner)` must read `false` for every object. Without that
assertion the security result is unfalsifiable. This is the same shape as the
`security_invoker` view claim this repository got wrong three times.

### F3. PUBLIC holds `EXECUTE` on every new function by default — the executor hijacks any run in two statements

This is the sharpest finding, because the proposed design *looked* correct: the
executor was granted `usage` on the schema and `execute` on the publish function
only, and the privileged functions were simply never granted to it. PostgreSQL
grants `EXECUTE` to `PUBLIC` on every new function unless you revoke it.

```
      proname       |   owner   | prosecdef |                proacl
 advance_generation | ops_owner | t         |            <-- NULL = default = EXECUTE TO PUBLIC
 publish_checkpoint | ops_owner | t         | {=X/ops_owner, ops_owner=X/…, ops_executor=X/…}
 reserve_run        | ops_owner | t         |            <-- NULL = default = EXECUTE TO PUBLIC
```

The executor, holding exactly those two intended grants:

```
select * from ops.reserve_run('GAM-HIJACK','evt-h');
  -> created a run AND was handed its plaintext capability token
select * from ops.advance_generation('<another run>', 2);
  -> ok | <that run's NEW plaintext capability token>
select * from ops.publish_checkpoint('<that token>', 3, '{"hijacked":true}');
  -> ok | 4
```

Re-read as `postgres`: `GAM-A | generation 3 | version 4 | published |
{"hijacked": true}`. The executor **stole another run's capability, fenced it,
and published to it.** `advance_generation` is additionally an unauthenticated
denial of service against every other executor's token — exactly the fencing
mechanism §5.2 relies on, turned into a weapon.

Note the second-order exposure: `anon` and `authenticated` also hold `EXECUTE` on
the publish function (`=X/ops_owner` in the ACL), gated today only by their lack
of `usage` on the schema.

**Fix, measured working:** explicit `revoke execute on function … from public` on
every ops function, then re-grant only what the executor needs. And assert the
ACLs directly — one `select proacl from pg_proc where pronamespace =
'ops'::regnamespace` is a better regression guard than six behavioural negatives,
and would have caught this at a glance.

### F4. `SET ROLE` is authorized against `session_user`, not `current_user` — a `nologin` test rig cannot measure escalation at all

If every ops role is `nologin`, a harness must `set role ops_executor` from a
superuser session. From there:

```
set role ops_executor;  select session_user, current_user;  -> postgres | ops_executor
set role ops_owner;      SET   -> postgres | ops_owner       <-- escalated
set role postgres;       SET   -> postgres | postgres        <-- escalated
set role service_role;   SET   -> postgres | service_role    <-- escalated
```

Every "the executor cannot escalate" assertion fails — not because the design is
insecure but because the rig is. A test suite written this way either reports a
false FAIL, or gets "fixed" into proving nothing.

**Fix, measured working:** make the executor role `LOGIN` and *connect as it*
(`psql -U ops_executor`; the scratch cluster's `pg_hba.conf` is `local all all
trust`). Then all three denials are real `42501`s, and `session_user` is no
longer a superuser — strictly stronger as well as correct.

---

## Part 2 — What was measured to work

These are the parts of plan §5.1 that survived attack. They are **not** a PASS on
the criteria — a criterion needs the full harness the packet specifies, run end to
end — but they are positive evidence, and they are the cheaper half.

| §5.1 concern | Measured result |
|---|---|
| **Atomic compare-and-set** (criterion 1) | One `update … where run_id = … and generation = … and version = …` works. `pg_get_functiondef` regexp confirms exactly one `update` in the function. `get diagnostics row_count` plus **one post-failure classifying select** yields named `no_such_run` / `stale_generation` / `version_conflict`. A zero-row CAS cannot self-classify, so that follow-up select is required — and it is not the read-then-write the criterion forbids |
| **Idempotent duplicate webhooks** (criterion 2) | `insert … on conflict (issue_identifier, todo_event_id) do nothing returning …`, with a read-back on the empty case, is correct **under genuine concurrency**. Two background `psql` sessions, the loser entering while the winner's transaction was still open: the loser **blocked on the winner's speculative-insert token**, then returned the winner's `run_id` with `created=false`; `count(*) = 1`. No advisory-lock barrier is needed — the round-1 gate expected this to fail and recorded that it did not |
| **Run-scoped capability** (criterion 3), *after* F3's and F4's fixes | A token-verifying `security definer` RPC that looks the run up by `sha256(token)` and derives `run_id`/`generation` **inside** the function, with the executor holding **no table grants at all**, produces real denials from a genuine unprivileged session: `ops.run` → `42501`; `public.events`, `public.rsvps`, `public.students`, `pg_authid` → `42501`; `set role ops_owner/postgres/service_role` → `42501`; `reserve_run`/`advance_generation` → `42501`; a forged/random token → `no_such_capability`, nothing moved. Positive control: the executor publishes for its own run, `ok | 2` |
| **Generation fencing** (§5.2, scenario 13) | `advance_generation` bumping the generation **and rotating the capability hash** makes the paused executor's old token fail closed: `no_such_capability`, with the row re-read field-by-field as unchanged |
| **Store unavailable** (scenario 15, store side) | `pg_terminate_backend` mid-statement → `FATAL: 57P01: terminating connection due to administrator command`, psql exit 2; on reconnect the mid-flight `update` is rolled back. The failure is named, not silent. `\set VERBOSITY verbose` is required for the SQLSTATE to be capturable |
| **No hosted-extension dependency** | `sha256(bytea)` (PG 11+) and `gen_random_uuid()` (PG 13+) are both in `pg_catalog` with only `plpgsql` installed. An ops schema can avoid `pgcrypto`/`pgjwt` entirely — which matters because the hosted extension set is the thing this run could not measure |

**The headline, stated carefully:** at the database layer, on PostgreSQL 16.14
carrying this repo's real product schema, plan §5.1's compare-and-set and
idempotency semantics **hold**, and a non-derivable run-scoped capability **is
constructible** — but only under a specific configuration that three of the four
findings above show is not the default and is not what a careful reader would
first write.

## Part 3 — In-repo evidence about the transport, obtained without touching the live project

`supabase/config.toml` sets `schemas = ["public", "graphql_public"]`. For an
executor to reach an `ops` schema through PostgREST at all, `ops` would have to
be added to that list. That is a real, checkable answer to half of the
"Edge Function versus RLS" comparison the spike owes, and it did not require a
credential:

- **RLS-on-JWT-claims** needs the ops schema *exposed* through PostgREST, which
  is both a config change and — per F1 — the only place its security actually
  lives.
- **A token-verifying RPC** can be reached through an Edge Function holding the
  service-role key, leaving the ops schema unexposed. Under scenario 15 the two
  differ: the Edge Function can classify and name a store outage itself, whereas
  a direct-PostgREST executor sees the outage as an HTTP error it must not be
  trusted to interpret.

**Neither was measured against the live project**, and this run could not measure
it: no `SUPABASE_*`, no service-role key, no `DATABASE_URL`, no `.env`. Plan §5.2
says an executor should hold none of those, so no dispatched run can close this.

## Part 4 — What is still unknown

1. **The live project's extension set and plan tier** — the issue requires the
   spike to measure both. Escalated to the owner on GAM-407; two SQL statements
   would close it.
2. **Criteria 4 and 5** (controller validate-then-write ordering; durable git
   evidence at episode completion) — not built, not measured. They are the two
   criteria with no database component.
3. **Scenarios 1, 2, 14 as a committed, re-runnable harness.** Scenarios 1 and 2
   were measured by hand in round 1; scenario 14 was not exercised at all.
4. **Scenario 15's ambiguous case** — the store accepting a checkpoint and then
   failing to acknowledge. A connection kill proves the named-failure
   requirement, not the ambiguity requirement.
5. **`service_role` fidelity.** Hosted Supabase's `service_role` is `BYPASSRLS`;
   `supabase/tests/run_t503_widen_rsvp_read.sh:35` creates it as
   `create role service_role nologin;` (`rolbypassrls = f`). Any "cannot escalate
   to service-role" assertion built on that helper measures something weaker than
   the hosted condition.

## What should happen next

The corrected packet (`GAM-407-packet.md` revision 3) carries all nine of round
2's required revisions and is dispatch-ready **except** for Definition of Ready
#3: the owner has not yet approved delivering the database half while the
live-project half stays unmeasured. That question is on the issue.

If the answer is "hold", these findings stand on their own and should be filed
against plan §5.1 regardless — F1 through F4 are true independently of whether
GAM-407 ships, and F3 in particular would have shipped as a working, green,
completely compromised capability.
