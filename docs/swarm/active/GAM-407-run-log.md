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
