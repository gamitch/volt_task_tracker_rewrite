Closes GAM-409

Ignore GAM-407
Ignore GAM-408
Ignore GAM-410

**No worker ran, and that is the result, not a shortfall.** GAM-407's packet went
to `checker-premise` twice and came back REVISE twice. Item 19 forbids a packet
reaching a worker without a DISPATCH verdict, and item 19a caps the gate at two
rounds — so the next step is the human owner, not a third round. This PR is the
evidence that produced that decision, written down so nobody re-derives it.

## Read this first if you read nothing else

Both gate rounds **built the proposed design on a real PostgreSQL cluster and
attacked it**, rather than reviewing it. Four of the findings are BLOCKER-class
facts about plan §5.1's capability model, and they are true whether or not
GAM-407 ever ships:

1. **RLS keyed on `request.jwt.claims` enforces nothing against a holder who can
   issue SQL.** It is an unrecognised two-part custom GUC, therefore `USERSET`.
   An executor role created `nologin nosuperuser nobypassrls` re-set its own claim
   to another run's id and updated that row — `UPDATE 1`, re-read as `HIJACKED`.
   `REVOKE SET ON PARAMETER` reports `REVOKE` and restrains nothing.
2. **A `security definer` function owned by a `BYPASSRLS` role runs with RLS
   off.** `force row level security` binds the table *owner*; it does not defeat
   the role *attribute*. The function moved a row with **no claim set at all**.
3. **PUBLIC holds `EXECUTE` on every new function by default.** Holding exactly
   the two intended grants, the executor called `reserve_run`, then
   `advance_generation` on *another run*, was handed that run's freshly-rotated
   plaintext capability token, and published to it. `advance_generation` is also
   an unauthenticated DoS on every other executor's token. **Not granting is not
   the same as denying**, and nothing about the code looked wrong.
4. **`SET ROLE` is authorized against `session_user`, not `current_user`.** A
   `nologin` test rig must `set role` from a superuser session — from which every
   "the executor cannot escalate" assertion **succeeds**. That is a rig artifact
   that would have been reported as a design FAIL.

Finding 3 is the one to take personally: it would have shipped as a working,
green, completely compromised capability.

## What was measured to work

Recorded because a review that only says "wrong" is not measuring: the
single-statement compare-and-set on `(run_id, generation, version)`;
`insert … on conflict do nothing returning` plus a read-back as a correct atomic
create-or-return **under genuine concurrency** (the loser blocks on the winner's
speculative-insert token — no advisory-lock barrier needed); generation fencing
by rotating the capability hash, with the old token failing closed and the row
re-read unchanged; `pg_terminate_backend` producing a named `57P01` with the
mid-flight update rolled back; and no hosted-extension dependency at all, since
`sha256(bytea)` and `gen_random_uuid()` are PG-16 built-ins.

At the database layer, plan §5.1's compare-and-set and idempotency semantics
**hold**, and a non-derivable run-scoped capability **is** constructible — but
only under a configuration that three of the four findings show is not the
default and is not what a careful reader would first write.

## What is in this PR

| File | What it is |
| -- | -- |
| `docs/swarm/active/GAM-407-interim-findings.md` | the four findings, what held, the in-repo transport evidence, what is still unknown |
| `docs/swarm/active/GAM-407-gate-round1.md` | round 1 — REVISE, 2 BLOCKER / 5 MAJOR / 9 MINOR / 2 NIT, with probe transcripts |
| `docs/swarm/active/GAM-407-gate-round2.md` | round 2 — REVISE, 3 BLOCKER / 3 MAJOR / 3 MINOR / 1 NIT, plus a closure check on all 18 of round 1's |
| `docs/swarm/active/GAM-407-packet.md` | packet **revision 3** — every one of round 2's nine required revisions applied, dispatch-ready pending one owner answer |
| `docs/swarm/active/GAM-407-run-log.md` | the run's own record, pushed at every milestone |
| `docs/swarm/active/GAM-407-pr-body.md` | this body, written before the PR was attempted |

**Documentation only.** No production code, no schema, no migration, no test, no
workflow file. Nothing under `supabase/migrations/`, `src/`, or
`.github/workflows/` is touched.

## The one thing the owner has to decide

GAM-407 says the spike "must measure" the live Supabase project's extension set
and plan tier. **No dispatched run can.** Measured in this container: no
`SUPABASE_*`, no service-role key, no `VITE_SUPABASE_*`, no `DATABASE_URL`, no
`.env` — and per plan §5.2 that credential absence is a design property of the
executor, not an inconvenience to route around.

My first packet quietly converted "must measure" into "report as unmeasured".
The gate caught that (Definition of Ready #3 requires an escalation to be named
**and pre-approved**), so it is now on GAM-407 as a question rather than a
decision I made for you. **GAM-408** carries it: two SQL statements, plus
approve-or-hold.

## Follow-up rows filed (item 20 — a deferral files a task, not a comment)

All three in `Backlog`; `Todo` is your authorization to work and not mine to grant.

- **GAM-408** (`tier/fast`, `gate/human`) — the live measurement, and the
  approve-or-hold question that unblocks GAM-407.
- **GAM-409** (`tier/fast`) — this row. The investigation/salvage row `AGENTS.md`
  item 5 prescribes, so this evidence can merge **without** closing GAM-407.
- **GAM-410** (`tier/standard`) — fold the four findings into plan §5.1/§11.1 as
  invariants, so they survive even if GAM-407 is held.

## Why `Ignore GAM-407`

The branch is named `claude/gam-407-…`, and a branch name links an issue **by
itself** — such a link closes the row on merge with no magic word present.
GAM-407's spike is genuinely unfinished: no harness exists, no criterion has a
verdict, and criteria 4 and 5 were never touched. `Ignore GAM-407` is what stops
this merge from closing it. Per `AGENTS.md` item 5 and constitution item 28f,
that line is deliberate — please do not tidy it away.

## Tier judgement (item 26 requires this stated and defended)

**HEAVY, and the label was already right.** The row creates an ops schema with
RLS and `security definer` helpers — item 18's override triggers fire on all
three counts — and the artifact decides the store every later phase builds on.
The premise gate earned its cost here exactly as item 26 says it must: it did not
review the plan, it *ran* it, and everything that changed an outcome came from
execution rather than reading.

## Gates

`python3 .claude/skills/gate-run/scripts/gates.py --baseline-tests 2466` on
`0ff1894`, tree clean:

```
  1 tsc              exit 0  PASS
  2 vite build       exit 0  PASS
  3 format:check     exit 0  PASS
  4 eslint           exit 0  PASS       0 errors, 379 warnings
  5 vitest (full)    exit 0  PASS       96 files / 2466 tests  baseline 2466 (+0)
  6 vitest (scoped)      –  SKIP        no scope derivable from the diff

VERDICT: PASS — 5 of 6 gates. NOT all six: 1 skipped.
```

**Five of six, and gate 6 is a genuine SKIP, not a pass.** `gates.py` derives the
scoped run from changed files under `src/`; this PR changes only
`docs/swarm/active/`, so there is nothing to scope. The 379 eslint warnings are
the repo's standing `react-refresh/only-export-components` class and predate this
branch — no file in this PR is linted at all.

## What was NOT done, stated plainly

- No worker was dispatched. No `supabase/spikes/**`, no harness, no controller
  module, no exporter exists.
- No criterion has a PASS/FAIL verdict. Criteria 4 and 5 were never touched.
- Scenarios 1, 2, 13 and 15 were measured **by hand by the gate agents**, not by
  a committed re-runnable harness. Scenario 14 was not exercised at all.
- The live Supabase project was never contacted.

## Notes for whoever picks GAM-407 up next

Packet revision 3 is ready. Three things in it are measured fixes, not
suggestions: `revoke execute … from public` on every ops function then explicit
re-grant; **no** RLS on the run tables (forced RLS with a `NOBYPASSRLS` owner was
measured to deadlock `reserve_run` outright — "no table grants" is the
enforcement); and `ops_executor` as a `LOGIN` role the harness connects as.

One correction the packet carries against itself: revision 2 claimed
`supabase/tests/run_t503_widen_rsvp_read.sh` creates `service_role` with
`noinherit bypassrls`. Line 35 reads `create role service_role nologin;` and
`rolbypassrls` measures `f`. Hosted Supabase's `service_role` **is** `BYPASSRLS`,
so the new harness must add those attributes itself. That was an unverified
citation committed while closing a finding about unverified citations — worth
knowing about, because the same reflex will recur.
