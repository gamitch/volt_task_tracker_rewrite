# GAM-407 — spike report: is Supabase/PostgreSQL a viable operational run store?

**Verdict on plan §11.1 decision 1: YES at the database layer — but only under a
configuration that three of four measured findings show is _not_ the default.**

|               |                                                                                                                        |
| ------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Issue         | [GAM-407](https://linear.app/gamitch/issue/GAM-407/supabase-as-the-operational-run-store-is-the-plans-least-confident) |
| Branch / work | `claude/gam-407-run-store-spike`, harness at `4c4389d`, wording at `268c3b3`                                           |
| Packet        | `docs/swarm/active/GAM-407-packet.md` revision 6 (DISPATCH, premise-gate round 4)                                      |
| Measured on   | PostgreSQL **17.11** (`170011`), disposable cluster, 24 of 25 product migrations applied                               |
| Live target   | PostgreSQL **17.6.1.141**, plan tier **free** (owner-measured, GAM-408)                                                |
| Harness       | `bash supabase/tests/run_gam407_run_store_spike.sh` → **37 assertions, 0 failed, exit 0**                              |
| Node suites   | `npx vitest run scripts/` → 13 files / 299 tests (+39 over a 260 baseline)                                             |
| Gates         | all six PASS                                                                                                           |

---

## 1. Per-criterion verdict

Plan §5.1's five criteria. **A criterion is PASS only where a committed,
re-runnable assertion measures it and a named mutation turns that assertion
red.** Everything else is PARTIAL, and says why.

| #   | Criterion                                                                                                   | Verdict                         | What actually measures it                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| --- | ----------------------------------------------------------------------------------------------------------- | ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **Atomic compare-and-set** — one conditional update validates `run_id`, `generation` and `version` together | **PASS**                        | `ac2-single-update-cas` asserts via `pg_get_functiondef` that `ops.publish_checkpoint` contains exactly **one** `update ops.run` whose `where` names all three. The behavioural half is the load-bearing one: `stale_generation` is **observed in both directions of mismatch** (asserted generation above _and_ below the row's), `version_conflict` on a stale version, `no_such_capability` on a forged token — each with a field-by-field re-read proving the row did not move. **Mutation 1** (drop `version` from the `where`) turns it red.                                                                                                                                                                                                                                                         |
| 2   | **Idempotent duplicate webhooks**                                                                           | **PASS**                        | Two `ops.reserve_run` calls → one row, same `run_id`, `created` true→false, token issued once. Under **genuine concurrency** the second session **blocked 1027 ms** on the winner's speculative-insert token — no advisory lock needed — then read the winner's row back. **Mutation 2** turns both scenarios red.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| 3   | **Run-scoped, non-derivable capability**                                                                    | **PASS, with one stated limit** | Ten negatives, each a real `42501` (`aclcheck_error, aclchk.c:2843` / `guc.c:6938`), all from a **direct `ops_executor` login** with `session_user=ops_executor, usesuper=false` asserted first; plus a positive control that publishes. Structural guards: every `ops` function's `proacl` non-null with no `PUBLIC` grantee, `ops_executor` holding **no** table privilege at all, return shape pinned to `(outcome, new_version)` with zero `ops.run` columns leaked. **Mutation 3** turns the ownership guard red. **The limit, narrowed 2026-08-19:** hosted `pg_roles` attributes are now **measured** and confirm `service_role` is `BYPASSRLS` (GAM-414; see §5.1). What remains unverified is the _membership graph_ for a hosted `ops_executor`, which does not exist until Phase 2 creates one. |
| 4   | **Validate-then-write ordering**                                                                            | **PASS**                        | `scripts/run-store-controller.test.mjs`: six `it.each` cases asserting `github` and `linear` are called **zero** times on an invalid candidate, plus a store-error case and an exploding-sinks case. **Mutation 4** (call the sinks before validating) turns **8** tests red.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| 5   | **Durable git evidence**                                                                                    | **PARTIAL**                     | `run-store-episode-summary.mjs` renders a run record and its events into markdown that is **byte-identical across two renders**, asserted over an inline fixture with a literal snapshot. **Nothing writes to git.** Plan §5.1 says "summarized **into git**"; what exists is the deterministic renderer that half needs. The git-write half is Phase 2's.                                                                                                                                                                                                                                                                                                                                                                                                                                                 |

### §7 fault scenarios

| #   | Scenario                                                       | Verdict               | Evidence                                                                                                                                                                                                                                                                                                          |
| --- | -------------------------------------------------------------- | --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Same Todo webhook twice                                        | **PASS**              | one row, same `run_id`, `created` t→f                                                                                                                                                                                                                                                                             |
| 2   | Raced claims for one Todo event                                | **PASS**              | two concurrent sessions, loser blocked 1027 ms, one row, exactly one `created=true`                                                                                                                                                                                                                               |
| 13  | Paused executor, advanced generation, stale mutations rejected | **PASS, both routes** | (i) stale _belief_ — current token, wrong `p_expected_generation` → `stale_generation`; (ii) **fencing** — `advance_generation` bumps generation _and rotates `capability_hash`_, so the old token → `no_such_capability` and the **new** token still publishes. Row re-read field-by-field as unchanged in both. |
| 14  | Same terminal event twice, one effect                          | **PASS**              | `recorded` then `duplicate`; one `run_event` row; `status=terminal`; version delta exactly 1                                                                                                                                                                                                                      |
| 15  | Store unavailable during checkpoint publication                | **PARTIAL**           | Store-side half **PASS** (below). Controller half **PASS** (criterion 4). **The ambiguous case is exercised nowhere** — see §5.                                                                                                                                                                                   |

---

## 2. The four findings about plan §5.1's capability model

**These are the spike's most transferable output and they are true whether or not
this schema ever ships.** Each was found by a premise-gate round building the
design and attacking it, and **all four are re-established on PostgreSQL 17.11**
after the owner's pin (both gate rounds 1 and 2 had measured on 16.14).

**F1 — RLS keyed on `request.jwt.claims` enforces nothing against a holder who
can issue SQL.** It is an unrecognised two-part custom GUC and therefore
`USERSET`. Measured on 17.11: after `revoke set on parameter … from public` **and
`from <role>`**, a `NOSUPERUSER NOBYPASSRLS` role still set a **forged** claim,
saw another run's row, and `UPDATE 1` — re-read as `postgres`: `r2 | FORGED`.
`REVOKE SET ON PARAMETER` restrains nothing. **The security of that design lives
entirely in PostgREST, not in the database.** Kept as a committed, re-runnable
**negative control** (`d2a-claims-keyed-forgeable`), so the finding survives as a
fact rather than as prose.

**F2 — a `security definer` function owned by a `BYPASSRLS` role runs with RLS
off.** `force row level security` binds the table _owner_; it does not defeat the
`BYPASSRLS` role _attribute_. Measured on 17.11: a `postgres`-owned
`security definer` function moved a row on a table with `enable` **and** `force`
RLS, **with no claim set at all**.

**F2's wording is load-bearing, and hosted reality confirms it (GAM-414,
2026-08-19).** This finding is an _attribute_ claim — "owned by a `BYPASSRLS`
role" — not a superuser claim. On the live project, **`postgres` measures
`rolsuper = f` and `rolbypassrls = t`**. The round-1 escalation's looser
phrasing, "a `security definer` function owned by `postgres`", implied
superuser and would now read as **wrong** against hosted Supabase; the precise
attribute framing is what survived contact with production. Anyone restating
F2 should keep the attribute, not the role name.

**F3 — `PUBLIC` holds `EXECUTE` on every new function by default.** With exactly
the two intended grants and no `revoke`, an executor called `reserve_run`, then
called `advance_generation` **on another run**, was handed that run's freshly
rotated **plaintext** token, and published to it. Nothing about the code looked
wrong. Re-measured on 17.11 as part of this spike: removing the four
`revoke execute … from public` lines reproduces the escalation exactly
(`crit3-neg4b … got rc=0 -- ok|2|2|10459bc7…`).

**F4 — `SET ROLE` is authorized against `session_user`, not `current_user`.** A
`nologin` test rig therefore makes _every_ escalation assertion succeed. Measured
on 17.11: from a `postgres` session, `set role` to `ops_owner`, `postgres` and
`service_role` **all succeed**; from the direct login, all three are
`ERROR: 42501: permission denied to set role`. **A rig artifact that would have
been reported as a design FAIL.**

**What the four amount to.** Three of them are _defaults_ — the GUC's
settability, `EXECUTE TO PUBLIC`, `SET ROLE`'s subject. The design is viable, and
none of these is a reason to reject Supabase. But **the default configuration is
not the viable one**, and every one of these would have shipped green under a
review that read the code instead of running it.

---

## 3. The design that was measured (D2), and the one that was not

**Measured: an execute-only, token-verifying RPC.** `ops_executor` holds **no
table grants at all** — only `execute` on `ops.publish_checkpoint(text, int, int,
jsonb)`, which looks the run up by `sha256(token)`, derives **`run_id` only**
from that row, and validates `generation` and `version` against the **caller's
asserted values**. Enforcement is the _absence of grants_, which is stronger and
simpler than RLS: the privilege check denies the executor before any policy is
consulted.

**Deliberately NOT measured: the Edge-Function-holds-service-role variant.** The
report compares the two below, and **that comparison is reasoning, not
evidence.** Only the token-RPC design was built.

| Under §7 scenario 15 (store unavailable) | Token-RPC (measured)                                                                                                                                                        | Edge Function (reasoned)                                                                                                       |
| ---------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Failure surface                          | The executor's own `psql`/PostgREST call fails. `57P01` is named and the transaction rolls back                                                                             | The Edge Function fails, and the executor sees an HTTP error that may or may not distinguish "store down" from "function down" |
| Blast radius of a compromised executor   | One run, one generation. It cannot read `ops.run`, cannot escalate, cannot reach the product schema                                                                         | Same, **if** the function is correct — but the function holds the service-role key, so a defect in it is unbounded             |
| Extra dependency                         | **None.** No extension, no PostgREST exposure — `supabase/config.toml:13` shows `schemas = ["public", "graphql_public"]`, so `ops` is not reachable through PostgREST today | A deployed function, its own auth, its own availability                                                                        |
| Where the secret lives                   | A per-run token whose `sha256` is all the database stores                                                                                                                   | A long-lived service-role key                                                                                                  |

**On the evidence available, the token-RPC design is the better default**, mainly
because it adds no component that can fail independently. That is a
recommendation, not a measurement.

### Design decisions worth carrying into Phase 2

- **No RLS on the run tables.** Forced RLS with a `NOBYPASSRLS` owner was
  _measured_ to deadlock `reserve_run` outright (`ERROR: 42501: new row violates
row-level security policy`) — no run could ever be created. RLS also buys
  nothing here: with no table grants the privilege check denies first.
- **Every `ops` object owned by a `NOSUPERUSER NOBYPASSRLS` role**, asserted
  mechanically. Without this, every criterion-3 result is unfalsifiable (F2).
- **Every function ACL explicit**, asserted directly (`proacl` non-null, no
  `PUBLIC` grantee). One ACL assertion is a better regression guard than six
  behavioural negatives (F3).
- **The executor is a `LOGIN` role and the harness connects as it** (F4).
- **No extension dependency.** `sha256(bytea)` and `gen_random_uuid()` are PG
  built-ins. The hosted project _does_ have `pgcrypto`, so this is now a
  simplicity choice — keep it: depending on nothing keeps the schema portable if
  the owner ever picks a different store. Note `gen_random_bytes` is pgcrypto and
  is **absent** on the scratch cluster, so the token is built from UUIDs.

---

## 4. Portability: the design is not PostgreSQL-17-specific

The owner pinned the harness to PG 17 because both earlier gate rounds had
measured on 16.14 while the live server is 17.6.1.141. Having done that, two
independent agents then ran the **whole harness against a PostgreSQL 16.14
cluster**: **37 assertions, 0 failed, exit 0**, with the version-degrade path
printing `PARTIAL: measured on PG 16.14 …, not the pinned 17` on the banner and
appended to **every** result line.

**Nothing in this design is PG-17-specific.** That is a genuine strengthening of
the §11.1 answer and it was measured, not argued. The one difference found across
the majors is cosmetic and is _not_ asserted anywhere: PG 17 adds the `MAINTAIN`
privilege, so a default table ACL reads `arwdDxtm` on 17 and `arwdDxt` on 16.

**The harness measured 17.11; the live server is 17.6.1.141.** Same major,
different minor. No behaviour here is minor-scoped, but that is a claim.

---

## 5. What was NOT measured — read this before quoting anything above

This section is binding, and it is the checker's list rather than the author's.

1. **The hosted project's role attributes — MEASURED 2026-08-19, and this item
   is narrowed rather than struck (GAM-414, GAM-418).** The original entry read
   that hosted `service_role`, `authenticated` and `anon` attributes were
   unmeasured, and forbade quoting a criterion-3 PASS without that caveat. The
   query was run on the live project through the owner's authorized connector —
   not a dispatched run, so plan §5.2 held. Results, PostgreSQL 17.6.1.141:

   | rolname          | super | bypassrls | inherit | canlogin |
   | ---------------- | ----- | --------- | ------- | -------- |
   | `anon`           | f     | f         | t       | f        |
   | `authenticated`  | f     | f         | t       | f        |
   | `postgres`       | f     | t         | t       | t        |
   | `service_role`   | f     | **t**     | **t**   | f        |
   | `supabase_admin` | t     | t         | t       | t        |

   **Hosted `service_role` IS `BYPASSRLS`** — the harness's assumption is
   confirmed on the attribute that carries criterion 3's whole argument, and
   hosted matches the harness rather than `run_t503_widen_rsvp_read.sh:35`'s
   plainly-created role (`rolbypassrls = f`). Nothing executor-shaped holds it:
   `anon` and `authenticated` are both `f`.

   **What survives as a limit, and it is narrower:** `ops_executor` does not
   exist on the hosted project — the harness creates it — so the _membership
   graph_ for a real hosted `ops_executor` remains unverified, necessarily,
   until Phase 2 creates one. **A criterion-3 PASS may now be quoted, provided
   it carries that residual limit** rather than the original, broader one.

   **One rig/production divergence, stated rather than absorbed:** hosted
   `service_role` is `rolinherit = t`; the harness creates it `noinherit`. The
   argument that this does not weaken the escalation negatives — inheritance
   governs privileges acquired through _membership_, while the negatives probe
   `SET ROLE` and RLS bypass — is **reasoning, not measurement**, and is
   recorded here as such under this section's own standard.

2. **Scenario 15's ambiguous case.** Only the _unreachable store_ is exercised —
   the store accepting a checkpoint and then failing to acknowledge appears
   nowhere in the harness or either test file. That is why scenario 15 is
   PARTIAL.
3. **Scenario 15's store-side assertion is scoped to four columns of one row** —
   `version`, `generation`, `head_sha`, `status`. `publish_checkpoint` also
   writes `result_refs`, `phase` and `updated_at`, and the assertion reads none
   of them. **Do not claim "no row records the checkpoint as published."** Nor
   was the row observed to move and return: what is measured is that the victim
   transaction reported `published=ok` — which certifies a one-row CAS update
   inside it — and that after reconnect those four columns are unchanged.
4. **The Edge-Function comparison is reasoning.** Only the token-RPC was built.
5. **Criterion 5 does not reach git.** It is a deterministic renderer.
6. **Mutation 2's red is a hard `42P10`**, not a duplicate row: without the unique
   constraint `on conflict` is unplannable and `reserve_run` raises. A checker
   probe confirmed the _stronger_ form separately — constraint dropped **and**
   conflict target rewritten so the database genuinely admits a duplicate →
   `rows=2`, two distinct `run_id`s, both `created=true`, 26 ms with no blocking.
7. **`20260719000000_cron.sql` is not applied** on the scratch cluster (needs
   `pg_cron`). Nothing depending on it is represented in these 37 assertions.
8. **The harness is not in CI.** Local-only, deliberately — see §6. **GAM-415.**
9. **The executor password guards nothing.** The scratch cluster is
   `local all all trust`; a wrong password and no password both connect. Its
   existence is asserted against `pg_authid`, never by "the connection
   succeeded". It exists so the harness is portable to a `scram-sha-256` server.
10. **`service_role=t`, not `f`.** Packet revision 6's negative-7 expectation
    contradicts its own AC4 (`create role service_role … bypassrls`). The
    requirement wins; the expectation was a stale measurement of
    `run_t503_widen_rsvp_read.sh:35`'s role carried forward by inertia.
11. **Criteria 4 and 5 are not this harness's.** They are Worker B's node suites.
12. **The four findings are not "re-established by the harness."** They were
    re-established on 17.11 by gate rounds 3 and 4 and by the orchestrator. What
    the harness carries is two standing **guards** that their preconditions do
    not return.

---

## 6. Why the harness is not wired into CI

`.github/workflows/ci.yml:196` runs the `sql` job against a **`postgres:16`
service container**, and it installs only `postgresql-client`, so no cluster can
be started there. Wiring this harness in would either go red immediately or
require bumping that image — which would move **nine currently-green SQL suites**
(`tests/rls/run.sh`, `supabase/tests/run.sh`, T700, T801, T205, T322, T503, T195,
T509) onto a new major in one change. **That is a Definition of Ready #5 decision
belonging to the owner, and it must not arrive as a side effect of a spike's CI
wiring.**

There is also a principled reason: this row ships **evidence, not
infrastructure**, and the issue's own constraint says the spike schema must not
quietly become the production run store. A CI step running it on every push is
that promotion.

**Filed as GAM-415**, which carries both halves — CI-wiring the run store when
Phase 2 builds the real one, and the pre-existing skew this surfaced:
`supabase/config.toml:33` declares `major_version = 17` while CI has tested every
SQL suite on `postgres:16`.

---

## 7. Stop rule

Plan §5.1: _"If that spike fails, stop."_ **No criterion is FAIL, so the stop
rule does not fire.** Two are PARTIAL (criterion 5; scenario 15), and neither is
a failure of the store — criterion 5's missing half is a git write nobody
attempted, and scenario 15's is an ambiguity case nobody injected. Both are named
above rather than rounded up.

**The store-level answer to §11.1 decision 1 is yes.** What this spike did not
and could not decide is the **operational** half, and one measured fact belongs
in that decision: **the live project is on the `free` tier, where a project
pauses on inactivity** — the sibling project `robotics-kanban` in the same org
currently reads `INACTIVE` (owner-measured, GAM-408). A store whose entire
purpose is outliving executor death, hosted where the store itself pauses, is a
genuine architectural input. §7 scenario 15 is not a hypothetical fault on that
tier; it is the steady state. **That is the owner's call, not this spike's**, and
it is the one thing that could still turn decision 1 around.

---

## 8. Provenance

|                  |                                                                                                                                                                                         |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Premise gate     | Four rounds: REVISE, REVISE, REVISE, **DISPATCH**. Reports at `GAM-407-gate-round1.md` … `-round4.md`                                                                                   |
| Workers          | A (opus, item 18 — SQL + `security definer`): `6f79372`, then `4c4389d` after a FAIL. B (default pin): `77e7ea9`                                                                        |
| Checker          | `checker-reviewer`: **FAIL** on attempt 1 (MAJOR-1, a vacuous scenario-15 conjunct it proved by construction with `schema.sql` intact), **ACCEPT WITH FOLLOW-UPS** on attempt 2         |
| Follow-ups filed | GAM-414 (hosted `pg_roles` — **measured 2026-08-19**; row stays open as `gate/human` for the owner to close), GAM-415 (CI PG-version skew), plus the checker's MINOR-2/MINOR-3/NIT rows |
| Amended          | 2026-08-19 by GAM-418 — §1 criterion 3, §2 F2, and §5 item 1 updated with GAM-414's measurement. No verdict changed; one limit narrowed.                                                |
| Run log          | `docs/swarm/active/GAM-407-run-log.md` — every dispatch and every verdict                                                                                                               |

**The single most useful thing this row demonstrates about its own process:**
every finding that changed an outcome — all four capability findings, the
tautological generation predicate, and the vacuous scenario-15 assertion — came
from an agent that **executed** the prescription. None came from reading it.
