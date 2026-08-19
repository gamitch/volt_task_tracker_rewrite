# GAM-404 run log

Issue: [GAM-404](https://linear.app/gamitch/issue/GAM-404/a-dispatched-run-that-dies-without-leaving-an-escalating-comment) —
a dispatched run that dies without leaving an `**Escalating` comment notifies
no one; workflow death, timeout, and stranded work surface only as a red job
nobody watches.
Branch: `claude/gam-404-terminal-failure-notify`
Base: `main` at time of claim.

Append-only. Every dispatch line is written *before* the subagent is awaited;
its verdict is a separate line written the moment the subagent returns.
**If a dispatch line is the last line in this file, the run died holding that
subagent** — that is the failure that killed runs 31354278407, 31385764526,
31514339272, 31523233268 and 31527801235, and this wording exists to make
that signature unmistakable.

---

## Log

- **Read `AGENTS.md` § "Where work comes from" and `docs/swarm/constitution.md`
  item 28 first**, before opening any other file, per the dispatch instruction.
- **Fetched GAM-404 live from Linear** (GraphQL `issues` query, not the pasted
  dispatch copy). State `Todo`, labels `other` + `standard` + `Improvement`,
  team `GAM`. No `gate/human`, no `tier/unreviewed` — the tier is already set.
- **CLAIMED**: `issueUpdate` moved the issue `Todo → In Progress`
  (stateId `720f56bf-e85a-441f-892f-c2ca7418d575`). **Read back** via a fresh
  `issue` query immediately after: `state.name === "In Progress"`. Claim
  confirmed (item 28c) before any other file in this repository was opened.
- **Tier: STANDARD, affirming the pre-set `tier/standard` label** (item 28d
  does not apply — the row was never `tier/unreviewed`). Reasoning per item 26:
  no write path or destructive operation touches product data; no schema, RLS,
  migration, or auth/role logic; the change is a script extension
  (`scripts/linear-assert-released.mjs`, `scripts/linear-escalation-notify.mjs`
  or a sibling) plus tests, and one workflow step edit that is undeliverable
  from this container (credential wall, `AGENTS.md` "Two walls" #1) and must be
  preserved as a patch rather than pushed. The issue's own filing already
  states "STANDARD under item 26" with the same reasoning — affirmed
  independently rather than taken on the filer's word.
- Branch `claude/gam-404-terminal-failure-notify` created off `main`.
- **Run log created — first file write of this run.** Committing and pushing
  immediately.
- **Citations re-verified against current `main` (item 19c)** before writing
  the packet: `linear-escalation-notify.mjs:60`'s marker regex, the
  `claude-linear-dispatch.yml:576-582` notify step, `linear-assert-released.mjs`'s
  `classifyState` (confirmed it does **not** itself distinguish the three
  benign shapes — only its header comment narrates them), and the plan's own
  Phase 1 line (`docs/swarm/2026-08-15-durable-multi-agent-execution-plan.md:577`,
  "notify on every terminal failure"). No corrections to the issue's own
  citations found. Confirmed `npx vitest run scripts/linear-escalation-notify.test.mjs`
  is a working scoped-test invocation (13 passed) — this packet's own
  criterion 9 depends on that pattern existing.
- **Packet written**: `docs/swarm/active/GAM-404-packet.md`. Design: a new
  file `scripts/linear-terminal-failure-notify.mjs` that imports
  `detectEscalation`/`fetchIssueForEscalation` unchanged from the sibling
  script (so the escalation path is provably untouched, not just described
  as untouched), plus one new workflow step in the same job gated on the same
  `if: failure()`, positioned so it no-ops for the `ESCALATED` shape the
  sibling step already reports. Full reasoning, rejected alternative
  (extending `classifyState` — rejected because it cannot see comments), and
  a 5-entry least-confident-decisions list are in the packet. Not yet gated —
  no worker may see it until `checker-premise` returns DISPATCH (item 19).
