# GAM-441 — run log

**Issue:** [GAM-441](https://linear.app/gamitch/issue/GAM-441/prd-still-mandates-the-table-based-meetings-page-amend-mtg-0171-for)
**Branch:** `claude/gam-441-prd-meetings-card-redesign`
**Runtime:** Claude (dispatched run)
**PR credential:** `iat 2026-08-21T05:02:24Z`, `exp 2026-08-21T06:02:24Z` — decoded, not guessed
  (AGENTS.md wall 3). Draft PR must be opened well before `exp`.

Append-only. One line per milestone, pushed immediately. If the last line of this
file is a dispatch with no matching verdict, **the run died holding that subagent** —
that is the AGENTS.md wall-2 signature, not an ambiguous ending.

---

- **05:03Z — claimed.** Read `AGENTS.md` § "Where work comes from" and
  `docs/swarm/constitution.md` items 19/26/28 before opening any other file.
  Fetched GAM-441 live from Linear (no Linear MCP tool in this runtime; used
  `scripts/linear/client.mjs` + `LINEAR_API_KEY`, the same GraphQL path the repo's
  own `linear-*.mjs` scripts use).
  Route check (item 28b): labels were `meetings-redesign`, `tier/unreviewed`,
  `Improvement` — no `gate/human`, no `executor/*`, so the missing route is the
  legacy Claude-only path and this runtime may claim it.
  **Tier judged before the state move (item 28d): `tier/fast`.** Label swapped
  `tier/unreviewed` → `tier/fast`, then `Todo → In Progress`, then **re-read**:
  `state = In Progress`, `labels = meetings-redesign, Improvement, tier/fast`.
  The claim is confirmed, not hoped for.

## Tier defence (item 26 requires this be stated and defended)

**FAST**, with an independent premise round added on top. Three legs:

1. **The FAST preconditions hold at zero.** No write path or destructive
   operation; no schema, RLS, migration, auth/role or metric-view SQL; no change
   to a signature another module imports; and *zero* lines of production change —
   the deliverables are two documentation files, two figure files and one skill
   file. Item 26's question ("can a mistake here corrupt data, or lie to a user
   about their own data?") answers no.
2. **STANDARD and HEAVY are structurally unavailable, not merely surplus.** Every
   Allowed File on this issue sits under `docs/swarm/**` or `.claude/skills/**`.
   AGENTS.md § "Ownership and protected files" is explicit: *"Workers and checkers
   must not edit `.claude/**`, `docs/swarm/**` … The primary orchestrator owns
   those records."* The constitution's Authority Boundaries say the same. So a
   tier whose defining act is "a worker implements it" cannot be executed here.
   The orchestrator implementing directly is the only lawful shape.
3. **Item 26 says take the heavier tier when two are arguable — so I take the
   heaviest verification that is actually available.** The counter-argument to
   FAST is real and worth naming: this artifact becomes the *premise* that eleven
   sibling `meetings-redesign` packets are graded against, which is precisely the
   exposure item 19 exists for (*"the planning layer is otherwise unverified …
   plans were the sole exception"*). The answer is to put an independent
   `checker-premise` round on the drafted amendment **before** it is final.
   `checker-premise` is read-only, so it does not collide with the protected-path
   rule in leg 2. That is strictly more checking than either FAST or STANDARD
   nominally provides, and it lands on the thing that can actually be wrong — the
   text's correctness as a premise — rather than on a worker's diff.

**One FAST clause I cannot satisfy, stated rather than faked:** item 26 requires
"a named mutation exists that turns a test red." A documentation and governance
change has no test to turn red, and I am not going to invent one to tick the box.
The clause's purpose is to guarantee the verification is real; the substitutes here
are the independent premise round above and the full six gates, both recorded below.
