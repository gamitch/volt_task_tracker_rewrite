# GAM-325 — premise gate, round 1

**Verdict: REVISE.** Five findings, all mechanical. None requires rethinking the
design or the lane split; each is an omission whose failure direction is the
*silent* one this row exists to remove. Two of them would let Phase 2 finish and
be untrustworthy anyway, which is why this is REVISE rather than DISPATCH.

| | |
| -- | -- |
| Packet | `docs/swarm/active/GAM-325-packet.md` draft 2 (`fb22340`) |
| Gate run by | the session that authored the design document (§6, §8), acting as `checker-premise` after two dispatched runs ended with the verdict unrecorded |
| Round | 1 of 2 (item 19a) |
| Charter | attack §8's least-confident list first; verify citations (item 19c); test the traps the issue names |

---

## What holds — verified, not assumed (item 19c)

Every repo-fact the packet cites was re-checked against the branch, not the docs:

| Claim | Verified |
| -- | -- |
| `scripts/linear/client.mjs` exports `gql(query, variables)` | ✅ line 25, signature exact |
| `linear-export.yml` runs with **no** `npm ci`, and says why | ✅ the only `npm ci` hit is the comment refusing it |
| Node pinned `22.22.2` in `ci.yml` | ✅ |
| `format:check` scopes to `src/**` + root configs, so `scripts/**` and `.github/**` are out of prettier's reach | ✅ exact glob confirmed — the packet is right to forbid adding them |
| Edge-function tests run `deno test --allow-env --allow-read` per directory | ✅ `ci.yml:354` |
| `vite.config.ts` excludes `**/.claude/**`, so lane worktrees cannot inflate test counts | ✅ line 45, and the comment already anticipates worktrees |

Draft 2 also applied all three defects raised on the issue, and did better than
asked on one: `queue: max` was **re-measured** against GitHub's changelog rather
than copied, including the `cancel-in-progress: true` validation-error pairing,
and the residual risk was recorded as LCD 6 rather than waved through.

**LCD 1's core argument survives attack.** Every write path was traced: shadow
suppresses the `issueUpdate` *and* the claim comment *and* the "closed without
merge" comment; the sweep is read-only by construction; lane E writes only to
Slack. Nothing in the build can move a Linear issue while `SYNC_MODE` is not the
exact string `live`. The "nothing relies on an unmeasured answer" claim is true.

---

## F1 — BLOCKER-class: the measure step is invisible under the Slack filter the owner was just advised to set

The whole of LCD 1's mitigation is *"the `measure` step makes it visible on the
first merge"*. That visibility runs through `#tracker`, and it does not survive
the noise fix recommended to the owner earlier today:

```
/github subscribe gamitch/volt_task_tracker_rewrite workflows:{… branch:"main"}
```

For a `pull_request`-triggered run, GitHub sets the run's branch to the **PR's
head branch**, not the base. The sync workflow (`pull_request: [closed]`) and the
gate workflow (`pull_request`) therefore report on `claude/…` branches — and a
`branch:"main"` filter drops **every one of them**, including the measure step's
output and every sync failure. The build would run correctly and report into a
channel that has been told not to listen.

**Fix — and it is a better noise fix than the branch filter anyway.** The
cancellation noise is entirely `CI` runs; filter by workflow *name* instead of
branch, which excludes CI on every branch while keeping the four that matter:

```
/github subscribe gamitch/volt_task_tracker_rewrite workflows:{name:"Linear sync","Linear declaration","Linear reconcile","Claude — Linear dispatch","Linear export"}
```

This is an **owner action**, not a lane's work, and belongs in packet §5.0
beside the three secrets. Lane D must additionally name its workflows exactly as
the subscription lists them, or the filter silently matches nothing — so the
`name:` values and the workflows' `name:` keys are now a contract between an
owner action and a lane.

## F2 — BLOCKER-class: the shadow exit criterion inverts if the incumbent is disabled early

Shadow's `MATCH`/`MISMATCH` compares the sync's intended action against *the
incumbent automation's observed transition*. That comparison is only meaningful
while `On PR merge → Done` is still enabled. §8's phase order keeps it on
through Phase 2 — but nothing in the packet **says** so, and the owner has spent
today disabling automations one by one with good reason.

If `merge → Done` is switched off during the shadow window, every declared merge
produces "shadow would close / automation did nothing" — **`MISMATCH` on
correct behaviour**, and the 10-consecutive-`MATCH` exit criterion becomes
unreachable while looking like the sync is broken.

**Fix:** state in lane B and in §8's exit criterion that the shadow window
**requires `merge → Done` to remain enabled**, and have the shadow run assert
it — one `gitAutomationStates` read at startup, and if the merge automation is
absent, post ⚠ `INCUMBENT_DISABLED` and mark the comparison void rather than
emitting a false `MISMATCH`.

## F3 — MAJOR: nothing proves the workflows parse and run

§7's evidence list is `eslint` / `typecheck` / `test` / `format:check` — all of
which pass on three YAML files that GitHub might reject outright. LCD 6 concedes
`queue:` is three months old and behaviourally unverified here; the failure mode
it does *not* name is the worse one: **if the runner rejects `queue: max` as
invalid syntax, the workflow does not run at all**, and the build lands three
inert files that look shipped. That is this project's named recurring defect,
reached by a new road.

**Fix:** add to lane D's acceptance criteria — after the workflows are on a
branch, trigger `linear-reconcile.yml` once via `workflow_dispatch` and paste
the run's conclusion, and confirm the sync workflow appears in the repository's
workflow list rather than in the "invalid workflow file" state. Both are
observable from the GitHub UI without the token permissions the first run
lacked.

## F4 — MAJOR: lane B's shadow reconstruction rests on a single-source API claim

Lane B's entire comparison depends on `issue.history(first: 50)` exposing
`fromState{name}` / `toState{name}` / `actor{name}`, newest-first, with
`fromState: null` entries to be filtered. The packet marks this *"verified live
by the orchestrator 2026-08-11"* — a run that ended without recording its own
gate verdict, and this gate **cannot re-verify it**: no `LINEAR_API_KEY` is
present in this session, and Linear's schema reference is a JavaScript shell to
plain fetches. The Linear MCP confirms a state history exists and is queryable;
it does not confirm those field names, because it returns its own derived shape.

The detail in the claim (the null-entry filtering) reads like something actually
observed rather than assumed, which is why this is MAJOR and not BLOCKER. But
GAM-315's whole history is three gate rounds each finding one confident
unmeasured claim about this exact subject, and inheriting one unexamined is how
that happens a fourth time.

**Fix:** lane B's **first** action is a live probe that prints the raw shape of
one issue's `history` connection (GAM-303 is the documented reopen/re-close case
and is the natural subject), and the fixture in acceptance criterion 3 is built
from **that printed response**, not from the packet's description of it. If the
field names differ, the probe costs minutes; inheriting them costs a lane.

## F5 — MINOR: lane ordering is advice, not a constraint

"Run lane A first" appears only inside LCD 5's prose. §1's lane table reads as
five independent lanes with disjoint files, which is exactly how a foreman would
dispatch them — in parallel. Lanes B and C import lane A's module; if they start
against the contract *as written* and it lands *as built* with any difference,
the drift is three files wide, which is the risk LCD 5 itself names.

**Fix:** make it binding in §1 — lane A merges before lanes B and C start; lanes
D and E may run in parallel with A since they import nothing from it.

---

## What the next revision does not need to touch

* **LCD 2 stays discharged.** The live measurement (all 7 completing work PRs
  match `^Closes (GAM-\d+)\b` on line 1, no BOM, no leading whitespace, first
  codepoint `0x43` in every case) settles the strict-parse risk against this
  repository's real corpus. Do not spend a round re-deriving it.
* **LCD 3 stays ruled keep.** Gate rule 4 is a refinement of rule 1's intent and
  its failure direction is the silent under-close.
* **LCD 4 stands as written.** The 120 s window degrades a comparison, never a
  write, and the hand-move confound is correctly named. F2 is the larger risk in
  the same area and supersedes worrying about the window's width.
* The five-lane split, the behaviour table, the claim-comment marker format, and
  §5.0's secrets table are all sound. Two of the three secrets now exist; the
  third is created and stored.

## Round 2 is not required if the five fixes land as specified

Each fix above is a stated constraint or an added acceptance criterion — none
reopens a design question. If draft 3 applies all five verbatim, this gate's
round 2 is a re-read, not a re-derivation, and item 19a's two-round cap is not
in danger.
