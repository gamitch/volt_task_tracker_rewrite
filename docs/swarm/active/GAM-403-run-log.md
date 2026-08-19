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
- `21:51Z` — **VERDICT round 1: `REVISE`.** 1 BLOCKER, 4 MAJOR, 6 MINOR, 2 NIT.
  The gate ran the prescription rather than reading it (item 26) and the BLOCKER
  is one I could not have found by inspection:
  - **BLOCKER — the ref-write probe cannot test the credential it claims to
    test.** In an `actions/checkout` workspace, `http.…extraheader` outranks the
    URL userinfo, so `git push https://x-access-token:$TOKEN@…` authenticates
    with the *checkout's* credential. Measured: a garbage token
    (`ghp_FAKE…`) pushed successfully in this workspace, and failed with
    `Authentication failed` in a control repo with no extraheader. Stage A would
    have returned PASS for a dead token — the exact false positive the packet's
    own tier defence calls disqualifying. Verified fix:
    `git -c "http.https://github.com/.extraheader=" push …`, which the gate
    confirmed fails on the fake token and passes on both real ones.
  - MAJOR — the CI-trigger check compares against `GITHUB_TOKEN`, which is unset
    in Stage A (vacuous PASS) and is *not* the built-in token inside the agent
    (false FAIL). Must take an explicit `PREFLIGHT_BUILTIN_TOKEN` and SKIP when
    absent.
  - MAJOR — §6 item 2 pinned `GH_TOKEN` to the PAT, the one credential measured
    at 403 on PR-create, against plan §5.3's "pin the proven GitHub App path".
    Delete line 137 instead; the action sets `GH_TOKEN` itself.
  - MAJOR — "all six gates" is unsatisfiable: gate 6 scopes off `src/` changes
    and this task touches only `scripts/`, so the honest figure is 5 of 6.
  - MAJOR — criterion 3 was not performable: a worker has no `secrets.` context.
  - 6 MINOR / 2 NIT, incl. require the `No commits between` message rather than a
    bare 422 (the gate built the counter-case: a typo'd base yields a green
    422), stdlib-only imports (no `node_modules` in a dispatch checkout), and
    my "a dead push token strands 100% of runs" being unmeasured — GAM-333 is
    0 of 13 at push time, 8 of 13 at PR time.
  Gate isolated its mutations in `/tmp/gate-403` (item 23) and confirmed cleanup;
  remote left with no `refs/preflight/*`.
