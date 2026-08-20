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
- **VERDICT RECEIVED: `checker-premise` round 2 → REVISE** (1 MAJOR, 7 MINOR,
  3 NIT, no BLOCKER). Subagent returned; nothing left in flight. It executed
  a 16-case input matrix against the revised `classifyTerminalFailure` in its
  own detached worktree (removed after), reproduced the full patch-delivery
  round trip (`git format-patch` → `git apply --check` → `js-yaml` structural
  parse, all green), and reconfirmed the baseline (`npx vitest run scripts/`:
  13 files / 299 tests). Round 1's BLOCKER is genuinely closed — no fixture
  import from the sibling test file remains.

  **The one MAJOR (M1): `NO_FAILURE` is reachable and produces silence on a
  red job — the packet's own "unreachable" claim is false, twice.** The new
  step's `if:` fires whenever the Assert step itself failed, for *any*
  reason — not only `In Progress`. `linear-assert-released.mjs` also fails
  the Assert step on `UNDETERMINED` (a transient read error surviving three
  retries, or Linear returning a null state) and on `NOT FOUND`. If, on the
  *new* script's own (second) read, the issue now reads a released state
  (e.g. the transient error had already cleared, or a null state resolves to
  `''`) and `workResult` is `'success'`, `classifyTerminalFailure` falls
  through to `{ shape: 'NO_FAILURE', notify: false }` — a **red
  `assert-released` job with nobody told**, which is the exact defect this
  issue exists to close, now reachable through the *new* code path rather
  than the old one. Measured by the gate: `{state:{name:'In Review'}}` +
  `workResult:'success'` → `NO_FAILURE`; `{state:null}` + `'success'` →
  same. Fix (all four parts, and this is the one required change before
  dispatch): give the Assert step `id: assert`, thread
  `${{ steps.assert.outcome }}` into the new script as `assertOutcome`,
  return a notifying shape when `assertOutcome === 'failure'` and nothing
  else matched, and correct both places the packet falsely claims
  `NO_FAILURE` is unreachable.

  Seven MINOR (all cheap, one-line-each): the delivery mechanism's own step
  3 ("revert the working-tree change") would leave a workflow-touching
  commit in history if written as stated — must export to an **untracked**
  path then `git reset --hard HEAD~1`, not revert-then-commit;
  `isIssueNotFoundError` (already exported by the very file this packet
  imports `classifyState` from) should catch a real not-found so criterion 4
  tests a reachable case instead of routing every real not-found into
  `READ_FAILED`; criterion 7 must require the Slack body to contain the
  issue *title*, not just the identifier, or round 1's "`title` threaded but
  unused" finding survives untested; a citation renumbering slip introduced
  this revision (step 1 pointed at "criterion 8", now criterion 10); a
  citation slip in §6 (`client.mjs:17` is `RATE_FLOOR`, the 2500/hour figure
  is at `:40`); criterion 10 should say `js-yaml` is present only
  transitively (via `@eslint/eslintrc`), not a declared dependency; `title`
  precedence between the payload param and `issue.title` is unspecified and
  the payload value is attacker-controllable, so prefer `issue.title` when
  the read succeeded. Three NIT (logged only): a narrower residual
  normalization mismatch between `detectEscalation`'s exact match and
  `classifyState`'s trim/lowercase (errs toward notifying, harmless);
  `readFailed` short-circuits ahead of `workResult` so a cancelled-and-
  unreadable case doesn't mention the cancellation; no line anywhere
  disclaims that a run that never reaches the `assert-released` job at all
  (e.g. whole-run infrastructure loss) still notifies nobody.

  **Per constitution item 19a: the gate is capped at two rounds, and this is
  round 2's REVISE — it escalates to the human owner rather than looping to
  a round 3.** Matching the GAM-301 precedent exactly (same cap, same
  outcome shape): I am not applying round 2's fix myself and re-submitting a
  third time, even though the one MAJOR is narrow and the gate itself said
  an owner could reasonably authorize it as an amendment — doing so would
  make me my own gate on a design an independent check has now reviewed
  twice. Stopping here.
- **Escalation comment posted to GAM-404 in Linear**, opening with the
  `**Escalating` marker per the convention `linear-escalation-notify.mjs:60`
  keys off, recording both rounds' findings and the concrete, narrow next
  step (round 2's four-part `NO_FAILURE` fix plus the seven MINOR/NIT items,
  all mechanical) so the human owner or `boss-architect` can accept the fix
  directly without a third gate round, per item 19a. Issue left `In
  Progress` deliberately — one of `linear-assert-released.mjs`'s three named
  benign shapes; a red `assert-released` check here is the intended signal,
  not a defect in this run.
- **Escalation comment read back and confirmed**: comment id
  `b1886716-8be9-4068-a423-349b1f4ef2ea`, issue state re-read immediately
  after and confirmed still `In Progress` — the correct benign shape, not a
  claim-loss.
- **No PR opened. No source file was changed** — only planning artifacts
  under `docs/swarm/active/` (`GAM-404-packet.md`, this run log), already
  pushed to `claude/gam-404-terminal-failure-notify`. Nothing to merge yet.
- **Run complete (escalated, not delivered).** Both premise-gate rounds were
  dispatched with `run_in_background: false` and waited on; every dispatch
  line above has a matching verdict line; nothing was ever left in flight.
  Delivered: a live-reverified defect, a twice-independently-checked design
  with round 2's remaining gap narrow and named, and a concrete unblock path.
  Not delivered: working code — item 19a's cap stops this run one packet
  revision short of dispatchable. Next session: fold round 2's required
  revision (§ above) into packet revision 3, and per item 19a's own
  reading (matching GAM-301's next-session note) this does not need a third
  premise-gate round if the human owner or `boss-architect` accepts the
  verified fix directly — only `worker-implementer` need be dispatched next.

---

## Owner session, 2026-08-20 — packet revision 3

- **Packet revision 3 written** at the owner's direction, in an interactive
  owner-present session rather than a dispatched run. This is the unblock path
  the escalation named: item 19a caps the premise gate at two rounds, round 2
  returned no BLOCKER, and the owner accepts round 2's fix directly rather than
  looping to a round 3.
- **Round 2's findings were re-verified against the repository before being
  folded in**, not transcribed from the verdict. All five load-bearing claims
  hold:
  - `linear-assert-released.mjs` exits 1 on `NOT FOUND` (`:219-220`),
    `UNDETERMINED` read error (`:226-227`), `UNDETERMINED` null state
    (`:232-233`) and unexpected error (`:274`) — so `if: failure()` fires for
    three causes, only one of which is `In Progress`. **The MAJOR is real.**
  - `- name: Assert the run released its claim` at `:540` carries **no `id:`**,
    so `steps.assert.outcome` is undefined today and part 1 of the fix is
    genuinely required.
  - `isIssueNotFoundError` is exported at `:174` of the same file the packet
    already imports `classifyState` from.
  - `js-yaml@4.3.0` is **not** declared in `dependencies` or `devDependencies`;
    it resolves only via `eslint@9.39.5 > @eslint/eslintrc@3.3.6`
    (`npm ls js-yaml`). Revision 2's "already a dependency" was half false.
  - `scripts/linear/client.mjs:17` is `RATE_FLOOR = 150`; the 2500/hour figure
    is at `:40`.
- **All 8 findings folded in** — the MAJOR in all four parts, and all seven
  MINOR. The three NITs are disclosed in §6 rather than actioned, per the
  severity rules. §7 of the packet is a finding-by-finding table so the
  acceptor can check the revision against round 2's verdict without re-reading
  the packet.
- **New shape `ASSERT_FAILED`** closes the MAJOR: notify when the Assert step
  went red for a reason the notify script's own second read can no longer see.
  Criterion 5 asserts it for both shapes round 2 measured
  (`{state:{name:'In Review'}}` and `{state:null}`), with a named mutation that
  turns only that criterion red.
- **No code written, no worker dispatched, no gate re-run.** This entry changes
  one planning artifact. The six gates are unaffected — nothing under `src/` or
  `scripts/` was touched — and the branch still carries zero product code.
- **Next step unchanged from the escalation, now unblocked:** dispatch
  `worker-implementer` against packet revision 3. The row should move to `Todo`
  for that dispatch; it must **not** move to `Done`, which would close a row
  whose deliverable does not exist.
