# GAM-407 run log

Issue: [GAM-407](https://linear.app/gamitch/issue/GAM-407/supabase-as-the-operational-run-store-is-the-plans-least-confident)
Tier: `tier/heavy` (label `heavy`), route `executor/claude` (label `claude`), no `gate/human`.
Branch: `claude/gam-407-supabase-run-store-spike`
Runtime: Claude (Opus 5), dispatched from Linear on 2026-08-18.

Append-only. One line per milestone, pushed immediately. If the last line of this
file is a dispatch with no matching verdict, **the run died holding that subagent** —
that is the failure signature `AGENTS.md` § "Two walls" describes, not a mystery.

---

- 2026-08-18 — **Claimed.** Read `AGENTS.md` § "Where work comes from" and
  `docs/swarm/constitution.md` items 18, 19, 26, 28 before touching Linear.
  Moved GAM-407 `Todo → In Progress` via `scripts/linear/client.mjs`
  (`issueUpdate` success: true) and **read back**: state `In Progress`, labels
  `other, heavy, Improvement, claude`. Claim held, not hoped. Tier already
  `tier/heavy`, so item 28d tiering-at-claim did not apply; item 26 concurrence
  recorded below.
- 2026-08-18 — **Run log created and pushed as the first file write** (this file).
- 2026-08-18 — **Item 26 tier concurrence: HEAVY, and I agree with the label.**
  The row creates an ops schema with RLS and a `security definer` reservation
  function, and its artifact decides the store every later phase builds on.
  Item 18's `model: "opus"` override therefore applies to the schema worker
  (migration/RLS/`security definer` triggers, all three).
- 2026-08-18 — **Environment premises measured before any packet was written**
  (item 19c — verify your own citations first). All five measured in this
  container, on this branch:
  1. `scripts/linear/client.mjs` + `LINEAR_API_KEY` reach Linear. ✅
  2. **No Supabase credential of any kind is present in this run** — `env` has
     no `SUPABASE_*`, no service-role key, no `VITE_SUPABASE_*`, no
     `DATABASE_URL`. **The live project is unreachable from here.** This is the
     single most consequential premise: the spike is scratch-only, and the
     issue's own "not verified from this session" caveat (live extension set,
     plan tier) **stays unverified** and must be reported as such, not assumed.
  3. `scratch-postgres` works — but **only under `sudo`**. As `runner` it dies
     on `chown: … Operation not permitted`; `sudo -n` is available and the
     cluster comes up as PostgreSQL 16.14 with 24 of 25 migrations applied
     (`20260719000000_cron.sql` skipped, needs `pg_cron`).
  4. Extensions on the scratch cluster: `pgcrypto` and `uuid-ossp` available
     (neither installed by default), `pgjwt`/`pg_net`/`pg_cron`/`pgsodium`
     **absent**. Roles `authenticated` and `anon` exist as
     `NOSUPERUSER NOBYPASSRLS`; `postgres` is superuser + `BYPASSRLS`.
  5. `node_modules` was **absent** on a fresh container — `npm ci` first.
     Baseline after install: `npx vitest run` = **96 files / 2466 tests**, all
     passing. That is the number the packet's gates 5/6 are written against.
- 2026-08-18 — **Packet written**: `docs/swarm/active/GAM-407-packet.md`.
- 2026-08-18 — **DISPATCHED `checker-premise` (round 1) on the packet**, item 19
  gate, `run_in_background: false`, blocking. **If this line is the last one in
  this file, the run died holding this subagent** — nothing after this point was
  measured, and the packet has NOT passed the premise gate.
- 2026-08-18 — **`checker-premise` round 1 VERDICT: REVISE.** Returned and read in
  full (subagent `af0c1c13ab9c3528f`, ~115K tokens, 50 tool calls, 12.7 min).
  **2 BLOCKER, 5 MAJOR, 9 MINOR, 2 NIT.** It re-measured every environment claim
  in the packet (all confirmed, incl. the 96/2466 baseline and that vitest does
  collect `scripts/*.test.mjs`) and then broke the design by running it:
  - **BLOCKER-1 — the packet's D2 rationale is inverted.** `request.jwt.claims`
    is an unrecognised two-part custom GUC, therefore `USERSET`. The gate
    *demonstrated* an `ops_executor` role (`NOSUPERUSER NOBYPASSRLS`) re-setting
    its own claim to another run's id and updating that row (`UPDATE 1`, row
    re-read as `HIJACKED`). `REVOKE SET ON PARAMETER "request.jwt.claims"` does
    not restrain it on PG 16. So the scratch cluster is **not** the weaker case —
    it is a stronger-attacker case, and my "holds a fortiori" sentence was
    backwards.
  - **BLOCKER-2 — RLS and `security definer` cancel as I specified them.** A
    `security definer` function owned by `postgres` (superuser, `BYPASSRLS`)
    runs with RLS off; `force row level security` binds the owner, not the role
    attribute. Measured: the RPC moved a row with **no claim set at all**.
  - MAJOR-3: my cited harness precedent `run_t205_anon_grant.sh` **does not run**
    standalone (`ERROR: role "service_role" does not exist`); it passes in CI only
    via a hidden ordering dependency on `tests/rls/auth_stub.sql`.
    `run_t503_widen_rsvp_read.sh` is the superset that works.
  - MAJOR-4: I assigned scenario 15's "no external write" half to Worker A, whose
    Allowed Files exclude the module that would prove it.
  - **MAJOR-5: an owner escalation, not a packet defect.** The issue says the
    spike "must measure" the live project's extension set and plan tier. This
    container has no Supabase credential of any kind. I had converted "must
    measure" into "report as unmeasured" — Definition of Ready #3 says an
    escalation must be named **and pre-approved**, and GAM-399 decision 5
    authorized running the spike, not dropping a stated deliverable.
  - MAJOR-6: `ci.yml` enumerates SQL suites explicitly (no glob), so a new
    harness would never be invoked; the repo's `format-patch` precedent applies.
  - MAJOR-7: AC6 named a generated artifact with no allowed path to write it.
  Round 2 of 2 remains before item 19a forces owner escalation.
- 2026-08-18 — **MAJOR-5 escalated to the owner on GAM-407** (comment posted,
  `commentCreate` success: true). It names the two SQL statements that would
  close the gap, states that I am proceeding with the database-layer half as
  **Partial** (item 27) rather than stopping the whole row, and offers to stop
  if the owner prefers. Both BLOCKER findings are surfaced there too, because
  they are results about plan §5.1 regardless of what the rest of the spike does.
- 2026-08-18 — **Packet revision 2 written**, all 18 findings addressed. The two
  substantive redesigns: (D2) the capability is now execute-only on a
  token-verifying RPC that derives run/generation from `sha256(token)` inside the
  function — `ops_executor` holds **no table grants at all** — and (D3) every
  `ops` object is owned by a `NOSUPERUSER NOBYPASSRLS` role with a mechanical
  ownership assertion, without which every criterion-3 result is unfalsifiable.
  The broken claims-keyed design is kept as a committed **negative control**
  (D2a) so the round-1 finding survives as a re-runnable fact rather than prose.
- 2026-08-18 — **DISPATCHED `checker-premise` (round 2, final under item 19a) on
  packet revision 2**, `run_in_background: false`, blocking. **If this line is
  the last one in this file, the run died holding this subagent** — no worker was
  dispatched and the packet has NOT cleared the gate.
- 2026-08-18 — **`checker-premise` round 2 VERDICT: REVISE.** Returned and read in
  full (subagent `a31f227037340fe7c`, ~94K tokens, 43 tool calls, 9.1 min).
  Of round 1's 18 findings: **13 CLOSED, 4 PARTIALLY CLOSED, 1 NOT CLOSED.**
  **3 new BLOCKER, 3 new MAJOR, 3 new MINOR, 1 NIT** — every one of them found by
  *building revision 2's design on a scratch cluster and attacking it*, which is
  exactly what round 1 said had to happen and what I had not done:
  - **BLOCKER-R2-1 — PUBLIC holds `EXECUTE` on new functions by default.** My
    packet said `reserve_run` and `advance_generation` were "not granted to
    `ops_executor`" and contained no `revoke`. Measured: the executor called
    `ops.reserve_run`, then called `ops.advance_generation` on **another run**,
    was handed that run's freshly-rotated plaintext capability token, and
    published to it (`{"hijacked": true}`, version 4). Total compromise of
    criterion 3, and `advance_generation` is also an unauthenticated DoS on every
    other executor's token.
  - **BLOCKER-R2-2 — my "defence-in-depth" RLS deadlocks the design.** Forced RLS
    + a `NOBYPASSRLS` owner + a claims-keyed policy means `reserve_run` cannot
    insert at all: `ERROR: 42501: new row violates row-level security policy for
    table "run"`. The controller has no claim to set — D2 removed it. **No run
    can ever be created**, so every scenario is unreachable. And RLS on `ops.run`
    defends against nobody anyway: with no table grants the privilege check
    denies the executor *before* any policy is consulted.
  - **BLOCKER-R2-3 — `SET ROLE` is authorized against `session_user`, not
    `current_user`.** I required all roles `nologin`, so the harness must
    `set role ops_executor` from a `postgres` session — from which `set role
    ops_owner`, `set role postgres` and `set role service_role` all **succeed**.
    AC4 would therefore have forced an automatic FAIL for a rig artifact. Fix
    measured: `alter role ops_executor login` and connect as it directly, after
    which all three denials are real `42501`s.
  - MAJOR-R2-1: I closed round 1's MINOR-5 by asserting `run_t503_widen_rsvp_read.sh`
    already creates `service_role` with `noinherit bypassrls`. Line 35 actually
    reads `create role service_role nologin;` — measured `rolbypassrls = f`. That
    is item 19c (unverified citation) committed while closing a finding about
    unverified citations.
  - MAJOR-R2-3: Definition of Ready #3 requires an escalation to be named **and
    pre-approved**. Mine is named and posted but **pending**. Not Ready.
  **Positive results the gate measured and I am recording as spike evidence:**
  `sha256`/`gen_random_uuid` are PG-16 built-ins (no extension needed); the
  single-statement CAS works with a post-failure classifying select; the
  token-RPC capability produces real `42501` denials on every escalation route
  once the three fixes are applied, with the positive control still publishing;
  `advance_generation` rotating the hash fences an old token (row re-read
  unchanged); `pg_terminate_backend` yields `57P01` with the mid-flight update
  rolled back; `run_t503_widen_rsvp_read.sh` runs standalone (exit 0).
- 2026-08-18 — **ITEM 19a REACHED: two REVISE rounds, no DISPATCH. No worker may
  be dispatched** (item 19: nothing reaches a worker until `checker-premise`
  returns DISPATCH). Escalating to the human owner rather than looping. No
  `worker-implementer` was spawned at any point in this run.
- 2026-08-18 — **Interim findings written and pushed**:
  `docs/swarm/active/GAM-407-interim-findings.md`. Four BLOCKER-class facts about
  plan §5.1's capability model (F1 claims-GUC forgery, F2 `security definer` +
  `BYPASSRLS` owner, F3 PUBLIC `EXECUTE` hijack, F4 `SET ROLE` rig artifact), the
  parts measured to work, the `config.toml` transport evidence, and what is still
  unknown. This is explicitly **not** the PASS/FAIL spike report GAM-407 asks for.
- 2026-08-18 — **Item 20 deferrals filed as Linear rows, not comments.** All three
  land in `Backlog` — `Todo` is the owner's authorization to work and is not mine
  to grant (item 28a):
  - **GAM-408** (`tier/fast`, `gate/human`) — the live extension-set / plan-tier
    measurement no dispatched run can perform, plus the one approve-or-hold
    question that unblocks GAM-407.
  - **GAM-409** (`tier/fast`, `executor/claude`) — the investigation/salvage row
    `AGENTS.md` item 5 prescribes, so this branch's evidence can merge **without**
    closing GAM-407, whose spike is genuinely unfinished. This is the row the PR
    declares `Closes` on.
  - **GAM-410** (`tier/standard`) — fold the four findings into plan §5.1/§11.1 as
    invariants, so they survive even if GAM-407 is held.
- 2026-08-18 — **Gates run** (`gates.py --baseline-tests 2466`, `0ff1894`, tree
  clean): tsc `exit 0`, vite build `exit 0`, format:check `exit 0`, eslint
  `exit 0` (0 errors / 379 warnings, the repo's standing
  `react-refresh/only-export-components` class), vitest full `exit 0`
  **96 files / 2466 tests, baseline +0**. Gate 6 **SKIPPED**, honestly — this
  branch changes only `docs/swarm/active/`, so `gates.py` can derive no `src/`
  scope. **5 of 6, and the verdict says so** rather than claiming six.
- 2026-08-18 — **PR body written to `docs/swarm/active/GAM-407-pr-body.md`
  BEFORE attempting the API call** (pr-body skill: the one run in nine that
  lacked its artifact was the one killed at the timeout). Declaration checker:
  `OK declaration closes GAM-409`, exit 0.
- 2026-08-18 — **PR opened: https://github.com/gamitch/volt_task_tracker_rewrite/pull/196**
  — "GAM-409: record GAM-407's premise-gate findings and its correctly blocked
  packet". Body declares `Closes GAM-409` with `Ignore GAM-407`/`408`/`410`, so
  merging records the evidence **without** closing a spike that is not done.
- 2026-08-18 — **Item 19a escalation posted on GAM-407** (`commentCreate`
  success: true) with the four findings, the parts that held, the provisional
  read on §11.1 decision 1, and the single approve-or-hold question.
- 2026-08-18 — **Linear states moved and read back** (item 28c's read-after-write,
  applied to the release as well as the claim):
  `GAM-407 => Needs Attention`, `GAM-408 => Backlog`, `GAM-409 => In Review`,
  `GAM-410 => Backlog`. GAM-407 goes to `Needs Attention` rather than back to
  `Todo` deliberately: in `Todo` the next agent burns a run reaching the same
  wall. Nothing is left in `In Progress`.
- 2026-08-18 — **RUN COMPLETE. No subagent was in flight at any point when this
  process could have ended.** Two `checker-premise` agents were dispatched, both
  with `run_in_background: false`, both waited for, both verdicts recorded above
  before the next step began. No `worker-implementer` was ever spawned, because
  item 19 forbade it. Scratch clusters: mine on port 55432 is stopped below; the
  two gate agents each reported stopping and deleting theirs (55433, 55434).

---

## Run 2 — 2026-08-18, re-dispatched after the owner cleared the item-19a escalation

Branch: `claude/gam-407-run-store-spike` (run 1's branch carried PR #196, which the
owner closed; its evidence merged as PR #197 from `claude/gam-409-premise-gate-findings`
and is on `main`). This branch does GAM-407's own work, so it declares `Closes GAM-407`
and satisfies the declaration gate's rule 3 that blocked #196 (GAM-411).

- 2026-08-18 — **Claimed (run 2).** Read `AGENTS.md` § "Where work comes from" and
  `docs/swarm/constitution.md` items 18/19/26/28 before touching Linear. Moved
  GAM-407 `Todo → In Progress` (`issueUpdate` success: true) and **read back**:
  state `In Progress`. Labels re-read: `tier/heavy`, `executor/claude`,
  `provenance/other`, `Improvement` — **no `gate/human`**, route is mine. Tier is
  already `heavy`, so item 28d does not apply; item 26 concurrence unchanged from
  run 1 (HEAVY: additive migration + `security definer` + the external dispatch
  path; item 18's `model: "opus"` override applies to the schema worker).
- 2026-08-18 — **Owner's re-dispatch conditions read from the GAM-407 comment of
  12:01:52Z and treated as binding:**
  1. *"proceed, pin the harness to PG 17"* — the Definition-of-Ready #3
     pre-approval both gate rounds found missing. **The item-19a blocker is
     cleared; a fresh gate round must not re-raise it.**
  2. **Live measurement is done** (GAM-408, now `Done`): plan tier `free`;
     extensions `plpgsql, pg_cron, pgcrypto, uuid-ossp, pg_net,
     pg_stat_statements, supabase_vault`; **PostgreSQL 17.6.1.141**. Nothing in
     the design needs an extension. Both gate rounds measured on **16.14**, so all
     four BLOCKER findings are provisional until re-established on 17.
  3. **No service-role key reaches this run** (plan §5.2) — unchanged, and correct.
  4. **File collision:** GAM-410 / PR #198 is editing
     `docs/swarm/2026-08-15-durable-multi-agent-execution-plan.md`. **This row does
     not touch the plan document.** Findings that belong there are filed under
     item 20 instead.
  Deliverables named by the owner: `supabase/spikes/**`, a migration, and a spike
  report under `docs/swarm/active/`.
