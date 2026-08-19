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
