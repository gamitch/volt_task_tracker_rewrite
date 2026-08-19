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
- **DISPATCHING `checker-premise` (round 1 of 2, item 19a cap), scoped
  light-to-medium per 19b, `run_in_background: false`, orchestrator is
  blocking on it now.** *If this line is the last one in this file, the run
  died holding this subagent.*
- **VERDICT RECEIVED: `checker-premise` round 1 → REVISE** (1 BLOCKER, 3
  MAJOR, 4 MINOR). Subagent returned; nothing left in flight. It executed the
  packet's own pseudocode in a throwaway `/tmp` tree against real copies of
  the sibling modules (item 23 respected — shared tree never touched),
  reproduced both named mutations reddening, and ran `npx vitest run
  scripts/` (13 files / 299 tests green baseline). Findings that change the
  work:
  * **BLOCKER — the prescribed test-fixture reuse is impossible.**
    `scripts/linear-escalation-notify.test.mjs` exports nothing, so
    `import { ESCALATION_COMMENT, issueWith } from './linear-escalation-notify.test.mjs'`
    is a hard `SyntaxError` at collection time.
  * **MAJOR — coverage claim overstated.** `if: failure()` only fires when
    the `assert-released` job's own Assert step fails. A `work` job that
    itself fails or is cancelled, but leaves Linear in a state
    `classifyState` treats as released (e.g. still `Todo` because the claim
    never landed, or already `In Review`), produces **no notification at
    all** — exactly the issue's own title. Fix: widen the new step's `if:`
    to also fire on `needs.work.result == 'failure' \|\| 'cancelled'`, and
    feed that into classification.
  * **MAJOR — "never two Slack pings" is false.** If the escalation step
    posts and then this script's own Linear read throws (a transient
    network blip), a second, duplicate ping goes out. Correct the claim to
    "at most one, except a duplicate is preferred to silence on a read
    failure" and say so in the Slack body.
  * **MAJOR — Allowed Files self-contradicts criterion 8.** Listing
    `.github/workflows/claude-linear-dispatch.yml` as an editable Allowed
    File is incompatible with the credential wall (no commit touching that
    path can be pushed); criterion 8 ("read the committed YAML") is
    therefore unmeasurable on this branch. Deliver the edit as a
    `git format-patch` artifact under `docs/swarm/active/`, per the GAM-314
    precedent, and grade the patch mechanically instead.
  * MINOR findings: `UNEXPECTED_STATE_*` is actually reachable today (not
    "defensive-only" as packet §6 claimed) via `assert-released`'s
    `not-found`/`error`/null-state paths; `detectEscalation`'s exact
    state-name match and my hand-rolled trim/lowercase check can disagree —
    fix by importing `classifyState` from the sibling script instead of
    reimplementing the check (also closes the reachability finding, since
    that becomes the same source of truth `assert-released` itself uses);
    the `title` env var was threaded through but never consumed; two
    citation slips (`:74` should be `:103` for the timeout setting).
  * **§3's refusal to touch `classifyState` affirmed SOUND**, and handed a
    stronger argument than mine: `linear-assert-released.mjs` is a gate that
    exits 1, while every notify concern in this codebase is bound by
    "never a gate, always exit 0" — mixing an always-0 concern into an
    exit-1 script is the wrong shape regardless of dependency direction.
  Revising the packet now — round 2 of the item 19a cap, the last round
  before an owner escalation rather than a round 3.
- **Packet revision 2 written**, folding in all 8 round-1 findings: dropped
  the impossible test-fixture reuse in favor of an inline fixture;
  `classifyTerminalFailure` now takes a `workResult` parameter and adds
  `WORK_JOB_FAILURE`/`WORK_JOB_CANCELLED`/`NO_FAILURE` shapes, closing the
  coverage gap; imports `classifyState` from the sibling gate script instead
  of a hand-rolled state check (closes the normalization mismatch and the
  "unreachable" claim in one move); the workflow deliverable is now an
  explicit `git format-patch` artifact in Allowed Files
  (`docs/swarm/active/GAM-404-workflow-terminal-failure-notify.patch`)
  with `.github/workflows/claude-linear-dispatch.yml` itself removed from
  Allowed Files and criterion 10 rewritten to grade the patch mechanically;
  the "never two pings" claim corrected to name the one case where a
  duplicate is preferred to silence, and the `READ_FAILED` Slack body now
  says so; `title` is consumed in the Slack message; two citations fixed.
- **DISPATCHING `checker-premise` round 2 (last round before item 19a
  escalates to the owner rather than looping to round 3),
  `run_in_background: false`, orchestrator is blocking on it now.** *If this
  line is the last one in this file, the run died holding this subagent.*
