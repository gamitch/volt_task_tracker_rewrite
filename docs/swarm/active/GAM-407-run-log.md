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
