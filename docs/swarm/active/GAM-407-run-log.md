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
- 2026-08-18 — **PG 17 pin achieved and measured, before the packet was revised**
  (item 19c). The container shipped only `/usr/lib/postgresql/16` and
  `apt-cache policy postgresql-17` had no candidate. Added the PGDG apt repo,
  `apt-get install -y postgresql-17` → exit 0, `postgres (PostgreSQL) 17.11
  (Ubuntu 17.11-1.pgdg24.04+2)`. **No skill edit was needed and none is
  permitted**: `start.sh:33` already picks the highest installed major, so
  installing the package *is* the pin. Re-run: `ready: postgres 17.11`,
  24 of 25 migrations applied (`pg_cron` one skipped). Scratch is **17.11**, live
  is **17.6.1.141** — same major, different minor, and the report says so.
- 2026-08-18 — **Two of the four BLOCKER findings re-established on PG 17.11 by
  me, not assumed**: F1 `request.jwt.claims` is still an unrecognised custom GUC
  a plain session can `set` and read back; F3 a fresh function's `proacl` is
  still **null**, i.e. `EXECUTE TO PUBLIC` by default. Also re-measured:
  `sha256(bytea)` → 64 hex chars and `gen_random_uuid()` work with **no**
  extension installed. F2 and F4 are role-semantics and are re-established by the
  harness under new **AC12** rather than by prose.
- 2026-08-18 — **Baseline re-measured on this branch**: `npm ci` exit 0 (
  `node_modules` was absent), `npx vitest run` exit 0 = **96 files / 2466 tests**.
  Unchanged from run 1, so the packet's gate figures stand.
- 2026-08-18 — **Packet revision 4 written and pushed** (`cb9b18b`). Changes:
  Definition of Ready #3 now **met** (escalation approved, not merely named);
  the live-project deferral **withdrawn as unnecessary** because GAM-408 measured
  it; a new §"PG 17" recording the pin and what it makes provisional; the plan
  document added to Forbidden Files for the GAM-410 collision; new **AC12**
  requiring a `server_version_num >= 170000` abort and harness re-establishment
  of F2/F4; and the item-19d list rewritten — LCD 1 is now the pin itself
  (implicit, version-floor rather than exact) and a new LCD 2a says the owner's
  measurement covered extensions and plan tier but **not `pg_roles`**, which is
  what criterion 3's whole argument rests on.
- 2026-08-18 — **DISPATCHED `checker-premise` (round 3) on packet revision 4**,
  item 19 gate, `run_in_background: false`, blocking. The owner closed round 1/2's
  escalation, so this round is on the *revised* packet and is instructed not to
  re-raise it. **If this line is the last one in this file, the run died holding
  this subagent** — the packet has NOT cleared the gate and no worker was
  dispatched.
- 2026-08-18 — **`checker-premise` round 3 VERDICT: REVISE.** Returned and read in
  full (subagent `a30e6172561071873`, ~107K tokens, 41 tool calls, 12.1 min).
  **1 BLOCKER, 2 MAJOR, 2 MINOR, 4 NIT.** It did what rounds 1 and 2 established
  is the only version of this job worth paying for: it **rebuilt the entire
  prescribed design on its own PG 17.11 cluster (port 55437) and attacked it**.
  **The design survived.** Every criterion-3 negative, the CAS, idempotency,
  generation fencing, scenario 14 (never previously exercised), scenario 15 and
  the D2a forgery control all reproduce on the pinned major. It did not re-raise
  the owner-closed escalation.
  - **BLOCKER-R3-1 — the PG 17 pin collides with CI, and my new AC12 turned that
    into a guaranteed red.** `.github/workflows/ci.yml:196` runs the `sql` job
    against a **`postgres:16` service container**, and T503 — my own named shape
    precedent — creates a scratch *database* on that ambient server rather than
    starting a cluster. So the MAJOR-6 CI patch I mandated would ship a step
    whose only possible effect is failure. Second half, same root: D7's whole
    basis is the scratch cluster's `local all all trust`; CI is TCP with
    `scram-sha-256`, where a passwordless `ops_executor` cannot authenticate at
    all. The version skew is pre-existing (`config.toml` says `major_version =
    17`, CI tests on 16) — this packet is just the first artifact to make it
    load-bearing.
  - **MAJOR-R3-1 — `stale_generation` is unreachable under D2's signature, and
    that means criterion 1 was not actually being tested.** `publish_checkpoint`
    takes no generation, so deriving it from the row it then filters on is
    tautological: measured, no input produces `stale_generation`
    (`ok → version_conflict → no_such_capability`, three names, not four). The
    name survived from revision 1's signature, which D2 changed. Worker A cannot
    produce a name Worker B is required to emit — the exact cross-worker seam
    my own LCD 5 claimed was closed.
  - **MAJOR-R3-2 — AC12 does not re-establish F2 or F4, and my §"PG 17" table
    said it does.** D3 checks `rolbypassrls = false` for `ops` owners: that
    proves the F2 *precondition is avoided*, not that a `BYPASSRLS` owner still
    defeats forced RLS on 17. Rig-correctness guards mislabelled as findings.
    **The gate then closed both by direct measurement on 17.11** — F2 HOLDS
    (a `postgres`-owned `security definer` moved a row with forced RLS and no
    claim), F4 HOLDS (`set role` from a `postgres` session escalates to
    `ops_owner`, `postgres` and `service_role`; the direct login gets three real
    `42501`s).
  - MINOR-R3-1: my "not deferrable to another run either" is false — GAM-408 is
    the counterexample, on this row, today. One `pg_roles` query on the owner's
    channel converts LCD 2a and most of LCD 3 from honesty into evidence.
    Withdrawing revision 3's item-20 row without a narrower successor left a
    known, closable gap with no triage record.
  - MINOR-R3-2, NIT-R3-1…4: AC2 wording, an inexact `start.sh:33` quote, PG 17's
    new `MAINTAIN` bit in the default ACL string (`arwdDxtm`, not `arwdDxt`), six
    LCD entries where item 19d says three to five, and an under-inclusive
    Forbidden list.
  - **All nine of round 2's required revisions verified still correctly applied.**
    F1 and F3 independently re-established on 17.11, confirming my own
    measurements.
- 2026-08-18 — **Round 3 report preserved** as
  `docs/swarm/active/GAM-407-gate-round3.md`, including its positive-results
  table, which is spike evidence in its own right and is reused in the report.
- 2026-08-18 — **Packet revision 5 written and pushed** (`56f101a`). All six
  required revisions applied. The two judgement calls, stated so a wrong one is
  correctable:
  1. **BLOCKER-R3-1 — took the gate's remedy #2+#3, not #1.** The harness is
     **local-only and deliberately not CI-wired**, and AC12's hard abort becomes
     **record-and-degrade** (print `server_version`, and on < 170000 print
     `PARTIAL: measured on PG <v>, not the pinned 17` and qualify every
     subsequent line). Remedy #1 — bumping `ci.yml:196` to `postgres:17` — would
     move **nine currently-green SQL suites** onto a new major, which is a
     Definition of Ready #5 reversal **the owner authorizes, not me**. Two
     supporting reasons: the issue's own constraint says the spike schema must
     not quietly become the production store, and a CI step running the spike
     harness on every push is exactly that promotion. Also added AC13:
     `ops_executor` gets a password so criterion 3 does not depend on the scratch
     cluster's `trust` auth.
  2. **MAJOR-R3-1 — took option (a), the signature change, not the deletion.**
     `publish_checkpoint` now takes `p_expected_generation`. This is the more
     invasive fix and I took it because criterion 1 as plan §5.1 words it
     requires one update to validate `run_id`, `generation` **and** `version`
     together — deleting the name would have left the packet reporting criterion
     1 PASS while testing two thirds of it. AC2 now additionally requires
     `stale_generation` to be **observed behaviourally**, or criterion 1 is
     PARTIAL however green the `pg_get_functiondef` check is.
  Also: F2/F4 rows rewritten with round 3's direct measurements and correctly
  attributed (D3/D7 are described as standing **rig guards**, not as proofs); the
  LCD list rebuilt to five entries carrying the doubts revision 5's own fixes
  create; all four NITs applied, including PG 17's `arwdDxt`**`m`** MAINTAIN bit,
  which would have made a worker's exact-match ACL assertion red.
- 2026-08-18 — **Two item-20 rows filed** (both `Backlog` — `Todo` is the owner's
  authorization, not mine to grant, item 28a). Both written through the
  `linear-task-writing` skill, every citation re-verified against current `main`:
  - **GAM-414** (`tier/fast`, `gate/human`, `provenance/premise-gate`) — the
    hosted `pg_roles` query. Round 3 was right that revision 4's "not deferrable
    to another run either" was **false**: GAM-408 is the counterexample on this
    same row. One SQL statement on the owner's channel upgrades criterion 3 from
    PASS-with-caveat to PASS.
  - **GAM-415** (`tier/standard`, `Bug`, `provenance/premise-gate`) — CI runs all
    nine SQL suites on `postgres:16` while `config.toml:33` declares
    `major_version = 17`. Verified today: `ci.yml:196` `image: postgres:16`,
    suites at `:231-256` with no glob, `config.toml:33` `major_version = 17`.
    Not a hypothetical difference either — PG 17's new **MAINTAIN** privilege
    changes the default ACL string these suites assert against.
- 2026-08-18 — **DISPATCHED `checker-premise` (round 4) on packet revision 5**,
  `run_in_background: false`, blocking. Round 3 opened a fresh gate cycle by
  owner authorization, so this is round 2 of 2 in that cycle and item 19a's cap
  binds again after it. **If this line is the last one in this file, the run died
  holding this subagent** — the packet has NOT cleared the gate and no worker was
  dispatched.
- 2026-08-18 — **`checker-premise` round 4 VERDICT: DISPATCH.** Returned and read
  in full (subagent `aed665c932b17afec`, ~91K tokens, 31 tool calls, 8.4 min).
  **0 BLOCKER, 0 MAJOR, 5 MINOR, 4 NIT.** **Item 19's gate is satisfied and a
  worker may now be dispatched** — the first time on this row, after four rounds.
  It closed both judgement calls **by construction, not by reading**: it built
  the 4-arg `publish_checkpoint` on its own 17.11 cluster (port 55438) and
  produced **all four outcomes** (`ok`, `version_conflict`, `stale_generation`,
  `no_such_capability`) across nine cases, proved the two scenario-13 routes are
  cleanly separable, found **no fencing bypass** via the new argument, and
  re-ran the concurrent CAS to exactly-once. It also verified GAM-414 and
  GAM-415 exist in Linear with the stated tiers and states.
  - Round 3's ten findings: **all CLOSED**, and its "latent reversal" (nine green
    SQL suites onto a new major) **removed** by declining remedy #1.
  - **MINOR-1 is the one that would have cost a rework**: D2's prose at
    `:243-245` still said the function "derives `run_id` **and generation**" from
    the token — verbatim the tautology revision 5 removed, contradicting
    `:454-476`. A worker reading D2 first would have rebuilt it.
  - MINOR-2: **AC13 is vacuous as written.** Measured — on `local all all trust`
    a *wrong* password and *no* password both connect, so "the harness connects
    successfully" cannot detect the regression it exists to prevent. Falsifiable
    substitute measured: `select rolpassword is not null from pg_authid`.
  - MINOR-3: the capability token's randomness source was never specified, and
    the idiomatic `gen_random_bytes` is **pgcrypto and absent locally** (present
    hosted — a local-red/hosted-green asymmetry). Use `gen_random_uuid()`.
  - MINOR-4: Worker B's rejection list omits `no_such_capability` — the outcome
    that carries the fencing — while the name-fidelity rule would bounce four
    legitimately controller-local names. Scope the rule to the store-derived set.
  - MINOR-5: record-and-degrade lets a PG-16 run satisfy AC1 and exit 0. Honest,
    but the wrong deliverable — **the orchestrator must verify
    `server_version_num >= 170000` before dispatching Worker A.**
  - NIT-1 (my `arwdDxtm` attribution is inverted — that string is 17's, not round
    2's), NIT-2 (two adjacent `int` args, indistinguishable when both are 1 —
    use named notation), NIT-3 (the outcome name is a generation oracle to a
    valid-token holder; true, not a criterion-3 violation, do not over-report
    negative 7b), NIT-4 (route (i) `stale_generation` is a synthetic stale belief
    and is **not production-reachable**; the fencing is the hash rotation, and
    the report must not credit the CAS conjunct with it).
- 2026-08-18 — **Packet revision 6 written and pushed** (`3e3780b`). All five
  MINORs and four NITs applied, including the two the workers would otherwise
  have tripped on: D2's contradictory sentence, and AC13's unfalsifiable
  password check replaced with `select rolpassword is not null from pg_authid`.
  Added **AC14** (named argument notation) because two adjacent `int` parameters
  that are both `1` on a fresh run make a swapped pair undetectable.
- 2026-08-18 — **Orchestrator precondition from round 4's MINOR-5 satisfied
  before dispatching Worker A**: `show server_version_num` = **170011**,
  `server_version` = `17.11 (Ubuntu 17.11-1.pgdg24.04+2)`. A `PARTIAL: measured
  on PG 16` result is a re-provision trigger, not an accepted deliverable.
- 2026-08-18 — **Two isolated worktrees created** (item 23; `AGENTS.md` forbids
  two editing agents in one tree): `/tmp/gam407-a` on `claude/gam-407-worker-a`
  and `/tmp/gam407-b` on `claude/gam-407-worker-b`, both from `3e3780b`, each
  with `node_modules` symlinked. Their file sets are disjoint
  (`supabase/spikes` + `supabase/tests` vs `scripts/`).
- 2026-08-18 — **DISPATCHED Worker A (`worker-implementer`, `model: "opus"` per
  item 18 — migration-shaped SQL and `security definer` helpers, two of item
  18's four triggers) and Worker B (`worker-implementer`, default pin) in one
  message, both `run_in_background: false`, both blocking.** **If this line is
  the last one in this file, the run died holding these two subagents** — no
  worker output was verified, nothing was integrated, and the branch carries
  only the packet and the gate reports.
- 2026-08-18 — **Worker A VERDICT: complete, self-reported, NOT self-certified.**
  Subagent `ad080423907f60444`, opus, ~166K tokens, 63 tool calls, 21.4 min.
  HEAD `6f79372` on `claude/gam-407-worker-a`; three commits, four new files
  (schema 459 lines, README 168, harness 416, assertions 563). Harness:
  **37 assertions, 0 failed, exit 0** on PG **17.11** (`170011`). Gates: all six
  PASS. **The mutations did their job and found two real defects in the worker's
  own first cut**, which is the whole argument for item 26's mutation rule:
  - Mutation 1 exposed a **vacuous conjunct in the worker's own assertions** —
    `now()` is transaction-scoped, so `updated_at unchanged=t` could never fail
    inside a `DO` block. Fixed with `clock_timestamp()` (`a31281d`). Four
    "row did not move" assertions had been carrying a conjunct that could not
    fail.
  - Mutation 2 exposed that the harness **aborted mid-run** under `set -e`
    instead of reporting (`6f79372`).
  - Mutation 3 turned the D3 ownership guard red as specified.
  - **Honest caveat the worker volunteered:** mutation 2's red arrives as a hard
    `42P10` (`on conflict` unplannable) rather than as two duplicate rows.
    Scenarios 1 and 2 both go red as required, but by the function raising, not
    by the database permitting a duplicate.
  - **A packet contradiction the worker found and deliberately deviated from,
    flagging it for the checker:** criterion-3 negative 7 records the expectation
    `service_role=f`, while AC4 and the harness section require creating it
    `nologin noinherit bypassrls`. Both cannot hold. It asserts
    `service_role=t`, documents the discrepancy in the README, and keeps D3's
    load-bearing property (`no ops object owned by a BYPASSRLS role`) asserted
    separately. **The worker is right and the packet line is the stale one** —
    it survived from a revision where `service_role` was created `nologin` only.
  - **A spike finding nobody asked for:** the worker stood up a second cluster on
    PG **16.14** and ran the whole harness against it — **37/0, green**, with
    AC12's degrade path printing `PARTIAL: measured on PG 16.14 …` on every line.
    **Nothing in the design is PG-17-specific.** That materially strengthens the
    §11.1 answer and it was measured, not argued.
  - Not measured, and the worker says so: hosted `pg_roles` (GAM-414), the
    Edge-Function variant (reasoned only), and **scenario 15's ambiguous case** —
    only the unreachable-store case is exercised, so **scenario 15 is PARTIAL**.
  - One thing to check before integration: `schema.sql` carries a hardcoded
    scratch-only password literal, which AC13 requires and which may trip a
    secret scanner.
- 2026-08-18 — **Worker B VERDICT: complete, self-reported, NOT self-certified.**
  Subagent `a5f113e76b245cad9`, sonnet (default pin — no item-18 trigger fires on
  two pure JS modules), ~127K tokens, 42 tool calls, 12.0 min. HEAD `77e7ea9` on
  `claude/gam-407-worker-b`; four new files. Scoped suite **13 files / 299 tests**
  (baseline 11/260, so +39); full suite **98 files / 2505** (baseline 96/2466).
  Gates: all six PASS. Mutation 4 (sinks called before validation) → **exit 1,
  8 failed**, and the 8 are exactly the zero-invocation assertions plus the
  ordering test; reverted, green re-run confirmed.
  - Name split implemented as the packet requires: store-derived
    `stale_generation`, `version_conflict`, `no_such_capability`;
    controller-local `wrong_run`, `missing_head_sha`, `malformed_evidence`,
    `store_unavailable`.
  - **One modelling decision flagged for the checker:** the packet pins the
    signature but not the candidate shape, so the worker carried the store's
    response on `candidate.storeOutcome` and added `attemptStoreCall(callStore)`
    that genuinely calls a throwing function, so scenario 15's "thrown during
    publication" is literal rather than pre-built data.
  - It did **not** read `/tmp/gam407-a`, as instructed — so the store-derived
    names are pinned from the packet and their agreement with Worker A's actual
    `schema.sql` is unverified by either worker. **That cross-worker seam is the
    checker's first job**; it is the seam three gate rounds kept reopening.
- 2026-08-18 — **Item 21 existence verification (not assumed).** Both workers'
  HEADs moved and both changes are in the **committed blob**, not merely in a
  working tree: A `6f79372`, 4 files / +1613 lines, worktree clean; B `77e7ea9`,
  4 files / +942 lines, worktree clean. Every path is inside the packet's Allowed
  Files; nothing under `supabase/migrations/`, `.github/`, `src/`, `docs/` or
  `.claude/` was touched by either.
- 2026-08-18 — **Merged both into `claude/gam-407-run-store-spike`** (`c043598`,
  `6308d57`) and pushed. Disjoint file sets, no conflicts.
- 2026-08-18 — **The cross-worker name seam checked by me before the checker,
  because it is the seam three gate rounds kept reopening and neither worker
  could see the other's artifact.** `schema.sql` returns `ok`,
  `stale_generation`, `version_conflict`, `no_such_capability`;
  `run-store-controller.mjs`'s `STORE_OUTCOMES` is the same four, with the
  rejection subset derived from it. **They agree exactly.** The four
  controller-local names are correctly absent from `schema.sql`.
- 2026-08-18 — **Gates run on the merged branch** (`gates.py --baseline-tests
  2466 --scope scripts/ --baseline-scoped 260`, `6308d57`, tree clean):
  **VERDICT PASS — all six.** tsc 0, vite build 0, format:check 0, eslint 0
  (0 errors / 379 warnings, the repo's standing
  `react-refresh/only-export-components` class), vitest full **98 files / 2505**
  (+39), vitest `scripts/` **13 files / 299** (+39). Six of six this time — the
  branch now carries `scripts/` changes, so gate 6 has a real scope, unlike
  run 1 where it was honestly SKIPPED.
- 2026-08-18 — **DISPATCHED `checker-reviewer` on the merged work**,
  `run_in_background: false`, blocking. **If this line is the last one in this
  file, the run died holding this subagent** — the work is merged to the branch
  and pushed, but **no independent check has passed on it** and no spike report
  exists.
- 2026-08-18 — **`checker-reviewer` VERDICT: FAIL (rework required).** Subagent
  `a1da821f90852a659`, opus, ~151K tokens, 39 tool calls, 9.1 min. **1 MAJOR,
  3 MINOR, 3 NIT, 0 BLOCKER.** It ran rather than read: two private clusters
  (55445 PG 17.11, 55446 PG 16.14), a private worktree, the packet's four
  mutations **and three probes of its own**. Sabotage check clean; no worker
  commit touches `.claude/`, `docs/swarm/`, migrations, workflows or `src/`.
  - **It confirmed Worker A's headline rather than taking it**: 37 assertions,
    0 failed, exit 0 on 17.11 — reproduced independently.
  - **MAJOR-1 — scenario 15's rollback conjunct is vacuous, and it proved it by
    construction.** The four-term conjunction's last term (`S15_AFTER =
    S15_BEFORE`) is satisfied trivially whenever **no publication ever
    occurred**. With `schema.sql` completely untouched it pointed the token at a
    no-such-run value; the harness reported `37 assertions, 0 failed`, `ALL
    PASS`, exit 0 — **and the line still read "the in-flight publication ROLLED
    BACK"**. This is the exact defect class four premise-gate rounds were
    chasing, surviving to the last artifact. The claim is independently true
    (round 3 measured it); **this artifact does not measure it**, and both the
    detail line and `README.md:95` state it as measured. One-line fix available:
    `$WORK/s15.out` already contains the `published=ok` line and is never
    inspected.
  - MINOR-1: criterion 5 renders markdown but **nothing writes to git** — plan
    §5.1 says "summarized into git". AC7 is fully satisfied; the *criterion* is
    PARTIAL and the report must scope the claim.
  - MINOR-2/MINOR-3: two more anchoring gaps of the same family — three
    assertions compare two possibly-empty strings (only scenario 15 lacks an
    anchor, which is why MAJOR-1 is MAJOR and these are MINOR), and
    `guard-d3-ownership` passes on an **empty** `ops` schema because
    `string_agg` over zero rows is null.
  - **Rulings on the three items I referred to it, all three settled by
    measurement rather than argument:**
    1. `service_role=f` vs `bypassrls` — **Worker A endorsed, the packet line is
       stale**, and the checker found the packet's own proof at lines 547-552:
       `f` was a measurement *of T503's role*, carried forward by inertia.
    2. Mutation 2's `42P10` — **adequate**, and it did not argue the point: it
       built the stronger variant (constraint dropped **and** conflict target
       rewritten so the DB genuinely permits a duplicate) and got `rows=2`, two
       distinct `run_id`s, both `created=true`, 26 ms with no blocking. No
       rewrite required.
    3. Worker B's `candidate.storeOutcome` + `attemptStoreCall` — **accepted**,
       and judged the better call, because keeping `publishExternal` synchronous
       and pure is what makes the zero-invocation assertion mean anything.
  - Password literal: **not a finding** under item 25 — it authenticates to
    nothing that outlives the harness, and it removes a `trust`-auth dependency.
  - **Worker A's PG 16.14 bonus claim: independently verified.** The checker
    built its own 16.14 cluster: 37/0, exit 0, with the `PARTIAL` qualifier on
    the banner and on every result line. Safe for the report as portability
    evidence.
  - It supplied an eleven-item list of things **the spike report must not
    claim**. That list is now binding on the report.
- 2026-08-18 — **Attempt 2 of 3 (Loop Limit).** Returning to Worker A for the
  MAJOR-1 fix only. Worker B's `77e7ea9` is **accepted as-is** and is not
  re-dispatched. The spike report is deliberately **not** written until MAJOR-1
  closes, because the stop-rule constraint list depends on its outcome.
- 2026-08-18 — **DISPATCHED Worker A (attempt 2, `model: "opus"`)** for the
  scenario-15 fix, `run_in_background: false`, blocking. **If this line is the
  last one in this file, the run died holding this subagent** — the branch
  carries merged work that a checker has **FAILED**, and no spike report exists.
- 2026-08-18 — **Worker A attempt 2 VERDICT: fix delivered, self-reported, NOT
  self-certified.** Subagent `ad4d347b015b02577`, opus, ~40K tokens, 22 tool
  calls, 3.2 min. HEAD `4c4389d`, **exactly two files** changed
  (`run_gam407_run_store_spike.sh`, `README.md`); `schema.sql` and
  `gam407_run_store_assertions.sql` byte-identical to `91d1621`, as instructed.
  - **The acceptance test the checker set is RED**: probe C, with `schema.sql`
    entirely intact and the token pointed at a no-such-run value, now yields
    `EXIT=1`, `37 assertions, 1 failed`, `in-flight=[published=no_such_capability]`.
    The old assertion's only substantive term (`before=…reserved
    after=…reserved`) is **still satisfied** there — the red comes purely from
    the new `published=ok` term, which is precisely the hole.
  - Unmutated re-run still **37/0, exit 0** on 17.11, run twice (once after
    reverting both probes, to prove the reverts were complete).
  - Mutation 2 now fails on the degenerate case too: `before= after=`, previously
    PASS, now caught by both new terms.
  - Two judgement calls it made and declared rather than hid: it anchored the
    grep as `'^published=ok$'` rather than the unanchored form the dispatch
    wrote (the term fails **closed** if `-At` is ever dropped), and it **removed
    an overstatement I had not asked it to touch** — "no row records the
    checkpoint as published" is a universal claim over all rows and tables that
    a four-column re-read of one row cannot support. The wording is now scoped
    to the four columns actually read.
  - It checked, specifically, whether MINOR-2/MINOR-3/NIT-1 needed fixing
    together for coherence, and reported **no** with reasons, keeping the diff
    at two files.
- 2026-08-18 — **DISPATCHED `checker-reviewer` (re-review of attempt 2)**,
  `run_in_background: false`, blocking. **If this line is the last one in this
  file, the run died holding this subagent** — attempt 2 is committed and pushed
  but **unverified**, and no spike report exists.
- 2026-08-18 — **`checker-reviewer` re-review VERDICT: ACCEPT WITH FOLLOW-UPS.
  MAJOR-1 CLOSED.** Subagent `ad5eecf13eaa6a7de`, opus, ~45K tokens, 27 tool
  calls, 4.5 min. It closed the finding **by construction on its own probe**, and
  then went looking for a replacement vacuity in the fix — which is the right
  instinct, because a fix to a vacuity finding is a natural place for a second
  one to hide. Three vectors, all closed:
  - **Probe D, which it designed and I did not ask for**, is stronger evidence
    than the acceptance test: it left the token *valid* and set
    `p_expected_version => 999` so the CAS could not match. Result
    `in-flight=[published=version_conflict]`, assertion **red** — the token
    resolved, nothing was published, and the old term was *still* trivially
    green. That discriminates "the update happened" from "the token was valid",
    which is exactly the property scenario 15 needs.
  - It traced `ok` into `schema.sql:252-270` and confirmed it is set **only**
    inside `if v_rows = 1`, so `published=ok` certifies a one-row CAS update
    rather than a resolvable token.
  - It measured the one realistic flake vector — psql's block-buffered stdout
    losing the line to the FATAL kill — at **15/15 iterations clean**.
  - Both of Worker A's unrequested judgement calls **upheld**: the `^…$` anchor
    is *stricter than what the checker prescribed* (measured under `-At`, `-t`
    and no flags — the unanchored form would have matched all three; the
    anchored one fails **closed**), and the scope correction fixes an
    overstatement the checker said it *should have caught in round 1*.
  - Mutation 3 re-verified red for its stated reason. `schema.sql` blob-identical
    across both attempts (`20270f11…`), verified rather than assumed.
- 2026-08-18 — **NIT-A and NIT-B applied by me as integrator**, because the
  checker asked for them before the report quotes the line: "are **back at**
  their pre-publication values" → "are **unchanged from**" (the moved state was
  never observed from a second session, so "back at" implies a departure and
  return nobody watched), and "the version bump the transaction had already
  reported" → "the version bump that `ok` implies" (the victim SQL selects only
  `'published=' || outcome`; it never selects `new_version`). Harness re-run
  after the change: **37 assertions, 0 failed**, ALL PASS.
