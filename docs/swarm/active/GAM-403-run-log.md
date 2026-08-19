# GAM-403 — run log

**Issue:** [GAM-403](https://linear.app/gamitch/issue/GAM-403/a-dispatched-run-discovers-a-dead-credential-only-after-the) —
"A dispatched run discovers a dead credential only after the implementation is
spent — nothing preflights push or PR capability, and the token expression at
play is the availability-dependent fallback the plan forbids"
**Tier:** HEAVY (label `heavy`; re-affirmed below, not re-judged — the row was
not `tier/unreviewed`)
**Branch:** `claude/gam-403-dispatch-credential-preflight`
**Run:** GitHub Actions, dispatched from Linear on 2026-08-19.

Every line below is appended and pushed immediately. **If the last line of this
file is a subagent dispatch with no matching verdict line, the run died holding
that subagent** — that is the failure signature AGENTS.md names, and it means
the work after that point never happened.

## Log

- `21:28Z` — **CLAIMED.** `GAM-403` moved `Todo → In Progress` via
  `scripts/linear/client.mjs`; read-back confirms `state.name = "In Progress"`,
  `updatedAt = 2026-08-19T21:28:40.423Z`. Labels are `heavy`, `other`,
  `Improvement` — no `gate/human`, no `executor/*` route, so under item 28b the
  missing route is the legacy Claude-only path and this runtime may hold it.
- `21:30Z` — branch `claude/gam-403-dispatch-credential-preflight` created off
  `main` at `e37605f`. Run log written as the first file write (per the dispatch
  contract) and pushed before any other work.
- `21:35Z` — **PREMISE MEASURED (item 19c), before writing the packet.** All
  three of the issue's citations confirmed at the exact lines
  (`claude-linear-dispatch.yml:126,137` fallback expression; `:40-43` PAT
  comment; plan §5.3 at
  `docs/swarm/2026-08-15-durable-multi-agent-execution-plan.md:332-344`). Three
  facts the issue does **not** contain were measured live in this run and change
  the prescription:
  - the PAT (`CLAUDE_PR_TOKEN`) is **`403` on PR creation** and the agent's
    `ghs_` App token is **`422`** (authorized) — so the credentials are near
    complementary, and "pin `GH_TOKEN` to the push token" would break the only
    PR path that works;
  - `GET /repos/{repo}.permissions` reports `push:false` for the App token that
    then pushes successfully — a **false negative**, so capability must be
    probed, never read off a permissions field;
  - a `refs/preflight/*` probe push **creates no workflow run** (measured with
    both credentials, both refs deleted afterwards), so ref-write can be proven
    without spending CI or leaving evidence behind.
- `21:38Z` — **PACKET WRITTEN.** `docs/swarm/active/GAM-403-packet.md`. HEAVY
  defended on item 26's write-path and export triggers. Allowed Files for the
  worker are the preflight script and its tests only; the workflow half is
  orchestrator-owned and ships as a patch (GAM-328 wall). Five **Least confident
  decisions** declared per item 19d.
- `21:40Z` — **DISPATCHED `checker-premise` (round 1, opus pin, `run_in_background: false`).**
  Target: `docs/swarm/active/GAM-403-packet.md`, charter §0 first — the five
  Least confident decisions in packet §5. **If this line is the last one in this
  file, the run died holding this subagent** and the gate verdict below was never
  recorded.
