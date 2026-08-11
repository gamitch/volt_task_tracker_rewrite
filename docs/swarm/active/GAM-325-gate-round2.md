# GAM-325 — premise gate, round 2 (FINAL, item 19a)

**VERDICT: DISPATCH — conditional on edits E1–E9 below**, which are
documentation-only and land in `docs/swarm/**` (orchestrator-owned). No lane's
code changes. **Lane D must not be dispatched until E3 and E4 are in the
packet**: a lane-D worker without them walks into the exact wall that cost
GAM-314 two gate rounds and a worker.

| | |
| -- | -- |
| Packet | `docs/swarm/active/GAM-325-packet.md` draft 3 (`f4c6840`, tree at `54ed165`) |
| Round | 2 of 2 — **final**, item 19a. Verdict is DISPATCH or REFUSE |
| Charter | (A) did F1–F5 land verbatim; (B) the `.github/workflows/**` push wall; (C) the two claims draft 3 introduced; (D) item 19c spot-checks |
| Method | executed, not read: 14 live `gh api`/`curl` measurements, 3 live Linear read queries, local tooling probes |

Findings: **2 MAJOR, 5 MINOR, 2 NIT, 0 BLOCKER.** Both MAJORs are false or
missing *premises* in a document, not defects in the work the packet
commissions, and both have a remedy already proven in this repository. That is
why this is DISPATCH-with-edits rather than REFUSE: escalating to the owner
would spend a human on a question `AGENTS.md` has already answered.

---

## Evidence inspected

**Files:** `docs/swarm/active/GAM-325-packet.md`, `-gate-round1.md`,
`-run-log.md`, `-checker-packet.md`; `AGENTS.md` (branch **and** `main`);
`docs/swarm/constitution.md` items 19/19a–d, 22, 23, 28f, 28g and the severity
scale; `docs/swarm/2026-08-11-linear-github-integration-proposal.md` §6.3, §6.4,
§8, §8a; `main:docs/swarm/active/GAM-314-run-log.md`; `.github/workflows/ci.yml`,
`linear-export.yml`, `claude-linear-dispatch.yml`; `eslint.config.js`;
`scripts/linear/`; `supabase/functions/linear-dispatch/`.

**Commands (selected, all run this round):**

```
gh api repos/gamitch/volt_task_tracker_rewrite --jq '{private,visibility,default_branch}'
  → {"default_branch":"main","private":false,"visibility":"public"}
gh api .../actions/workflows -i            → HTTP 200   (X-Accepted-Github-Permissions: actions=read)
gh api .../actions/runs?per_page=1 -i      → HTTP 200
gh api .../actions/secrets -i              → HTTP 403
gh api user -i                             → HTTP 403 "Resource not accessible by integration"

# wall 1, measured both credentials, both directions, nothing mutated (deliberately wrong sha):
gh api -X PUT .../contents/.github/workflows/ci.yml   -f sha=000…0 -f branch=main
  → 403 {"message":"Resource not accessible by integration"}
gh api -X PUT .../contents/docs/swarm/constitution.md -f sha=000…0 -f branch=main
  → 409 {"message":"docs/swarm/constitution.md does not match 000…0"}
# same two requests with the token embedded in `origin` (40 chars, the one `git push` uses):
  → 403 on the workflow path, 409 on the docs path
```

The 403/409 split is the whole finding: the permission check fires *before* the
sha check on `.github/workflows/**`, and the identical request one directory
over is refused only by the sha. The wall is path-scoped, live today, and holds
for both credentials this run has.

---

## (A) Did round 1's five findings land verbatim?

| | Verdict | Quoted packet text |
| -- | -- | -- |
| **F1** Slack filter hides the measure step | **LANDED** | §5.0: *"#### Fourth owner action — the Slack subscription filter (gate round 1, F1)"* … *"a `branch:"main"` filter drops **every one of them** — the measure step's output and every sync failure included."* … *"**This makes lane D's `name:` keys a contract with an owner action.**"* + criterion 9: *"**The three top-level `name:` keys are exactly `Linear sync`, `Linear declaration` and `Linear reconcile`**"* |
| **F2** shadow criterion inverts if the incumbent is disabled | **LANDED** | §3: *"**The shadow window requires the incumbent to stay enabled, and the run must assert it (gate round 1, F2).**"* … *"read `gitAutomationStates` for team `Gamitch` once at startup. If no `event=merge → Done` automation is present, post ⚠ `INCUMBENT_DISABLED`, mark the comparison **void**, and do **not** emit a `MATCH` or a `MISMATCH` for that merge. A void run neither advances nor resets the consecutive-`MATCH` counter."* + criterion 3a |
| **F3** nothing proves the workflows parse and run | **LANDED (text) / defective (executability)** | Criterion 10: *"**The workflows are proved to parse and run, not merely to lint (gate round 1, F3).**"* … *"trigger `linear-reconcile.yml` once via `workflow_dispatch` and record the run's `conclusion` and URL; confirm all three appear in `GET /actions/workflows` with `"state": "active"`"*. The prescription landed verbatim; the sentence draft 3 **added** — *"this criterion is executable and is not a wish"* — is false. See (B). |
| **F4** history field names are single-source | **LANDED** | §3: *"**Probe the history shape before writing a line of reconstruction code (gate round 1, F4).** Lane B's *first* action is a live probe that prints the raw `history` connection of one issue"* … *"The fixture in acceptance criterion 3 is built from **that printed response**, not from this packet's description of it."* + criterion 3 |
| **F5** lane ordering is advice, not a constraint | **LANDED** | §1: *"### Lane ordering is binding, not advice (gate round 1, F5)"* … *"**Lane A lands before lanes B and C start.**"* … *"**Lanes D and E may run in parallel with A.**"* |

Five of five landed. Round 1's own test — *"if draft 3 applies all five verbatim,
round 2 is a re-read rather than a re-derivation"* — is met for the F-list. The
two MAJORs below are not in the F-list; one is the new question round 1 never
asked, the other is a premise draft 3 restated without re-measuring.

---

## (B) The `.github/workflows/**` push wall — the round's centre of gravity

### Is the wall real, and does it apply to lane D as written?

**Yes to both, and it is measured, not inherited.**

`AGENTS.md` on `main` (§ *Two walls a dispatched run hits*, added by `9f91c23`,
PR #161, merged 21:54Z today) says a dispatched run cannot push
`.github/workflows/**` with either credential, that this is deliberate — *"it is
the only thing stopping an autonomous run from rewriting the workflow that
constrains it"* — and: *"Check for `.github/workflows/**` in your packet's
Allowed Files at packet time, not at push time."*

Corroboration, all independent:

1. **My own measurement, this run** — the 403/409 split quoted above, for both
   the `gh` credential and the token embedded in `origin`.
2. **GAM-314's live measurement** (`main:docs/swarm/active/GAM-314-run-log.md`,
   20:45Z): rejection reproduced three ways — PAT push (*"refusing to allow a
   Personal Access Token to create or update workflow … without workflow
   scope"*), App-token push, and `PUT /contents/.github/workflows/…` → 403.
3. **The patch route works end to end.** PR #159 — author `app/claude`, files
   `docs/swarm/active/GAM-314-*`, `docs/swarm/verification-log.md`,
   `scripts/linear-assert-released.{mjs,test.mjs}` — **no workflow file**.
   PR #160 — author `gamitch`, one file, `.github/workflows/claude-linear-dispatch.yml`.
   The stranded half was preserved as
   `docs/swarm/active/GAM-314-workflow-wiring.patch` in commit `86fcbb1`. PR #161
   repeated the pattern.

**Lane D's Allowed Files are exactly `.github/workflows/linear-sync.yml`,
`linear-declaration-gate.yml`, `linear-reconcile.yml` — 100 % inside the wall.**
No draft of the packet mentions it. The consequence is not partial: a `git push`
whose pack contains any object at that path is rejected outright, so a lane-D
worker that commits and pushes strands *the entire commit*, not just the
workflow files.

### Undispatchable, or a deliverability problem with a prescribed remedy?

**Deliverability, with a remedy this repository proved twice today.** Lane D's
work is buildable, and acceptance criteria 1–9 are all local file operations
(`grep`, `python3 -c "import yaml…"`) that pass in a worktree with nothing
pushed. Only *delivery* and criterion 10 are blocked. The packet does not become
wrong — it becomes silent about the single thing that will stop it, which is the
class item 19 exists to catch. **MAJOR**, remedied by E3/E4.

### Does it cascade?

Yes, three ways, and this is the part the packet must say out loud.

1. **Criterion 10 is not executable by anyone in this run.** The packet says
   *"The orchestrator executes this at integration, not the worker."* The
   orchestrator is itself a dispatched run holding the same two credentials; it
   cannot put the file on `main`, on the working branch, or anywhere else. Both
   halves of criterion 10 require the file to be on a ref GitHub can see. As
   written the criterion is a wish — not because the observation channel is
   closed (it is open), but because the **delivery** channel is closed.
2. **The §8 Phase 2 shadow window cannot begin from this run.** The window needs
   `linear-sync.yml` live on `main`. That is now an owner action gated on the
   owner applying a preserved patch as a PR, exactly as #160.
3. **LCD 1's entire mitigation is suspended on the same hook.** LCD 1 accepts
   shipping with §8's checklist unexecuted because *"the `measure` step is
   designed to make that visible on the first merge"*. The measure step cannot
   run until the owner applies the patch. LCD 1's declared risk was "the workflow
   might not fire on `closed`"; its real dominant risk is now "the workflow sits
   in a patch file and never fires at all."

### What the packet must state for lane D to be dispatchable

Verbatim requirements, in E3/E4/E5 below. In one sentence: **lane D builds and
commits in its worktree and never pushes; the orchestrator preserves the commit
as `git format-patch` under `docs/swarm/active/`; the PR body leads with the
undeliverable half; criterion 10 becomes an owner action carried to the issue
beside checklist items 4, 5, 8 and §5.0's three secrets.**

---

## (C) The two claims draft 3 introduced

### C1 — the re-opened `/actions/*` observation channel

Re-measured by me, this round:

| Endpoint | Run 1 | **This round** |
| -- | -- | -- |
| `GET /actions/runs` | 403 | **200** |
| `GET /actions/workflows` | 403 | **200** |
| `GET /actions/secrets` | 403 | **403** |
| `GET /user` | — | 403 (`Resource not accessible by integration`) |

Criterion 10's added sentence — *"**Measured this run: `GET /actions/runs` and
`GET /actions/workflows` both return 200 for the dispatch token**"* — is
**CONFIRMED**.

Two things follow, and neither is in the packet.

**(a) A capability that flipped once can flip back.** Run 1 measured 403, runs
3/4 measure 200. Nothing in the repository controls it; it is the installation's
permission set. What depends on it: only the *verification* half of criterion 10
and any orchestrator observation at integration. Nothing in the shipped build
reads `/actions/*`. The fallback is the GitHub UI (Actions tab shows a workflow
in the *invalid workflow file* state without any token), and the owner has it
regardless. State the fallback in criterion 10 so a future 403 does not strand
the criterion a second time.

**(b) §0 still says the opposite, in the same document.** §0 bullet 2 reads
*"The dispatch token gets HTTP 403 on `GET /actions/runs` and `/actions/secrets`.
… the observation channel is closed. This is a capability limit, not an effort
limit."* Draft 3 patched criterion 10 and left §0 untouched. §0 is the packet's
justification for the largest deviation from the design of record (§8 requires
the checklist *"before anything is built on the answers"*), and that
justification is now measurably false. The checklist **is** still blocked — but
by wall 1, not by the token. This is the "true, but for the wrong reason" class.
**MAJOR**, remedied by E2.

### C2 — "`workflow_dispatch` on a non-default branch requires the workflow to exist on the default branch first"

**The assertion is CONFIRMED verbatim.** GitHub's own documentation source, not
intuition:

- `github/docs` → `data/reusables/actions/branch-requirement.md`, the note
  attached to the `workflow_dispatch` event: *"This event will only trigger a
  workflow run if the workflow file exists on the default branch."*
- `content/actions/how-tos/manage-workflow-runs/manually-run-a-workflow.md:26`:
  *"To trigger the `workflow_dispatch` event, your workflow must be in the
  default branch."*

`linear-reconcile.yml` carries only `schedule` + `workflow_dispatch`, so it
cannot run at all — by any trigger, from any ref — until it is on `main`.

**The conclusion the packet draws from it is FALSE.** The packet writes: *"The
orchestrator executes this at integration, not the worker — the worker's branch
is not the default branch, and `workflow_dispatch` on a non-default branch
requires the workflow to exist on the default branch first."* The orchestrator is
under the same wall. Correct premise, wrong actor.

**And one half of criterion 10 is more available than the packet thinks.**
Measured: a workflow file pushed only to a **non-default** branch *does* register
and *does* run for branch-scoped events. Exhibit —
`.github/workflows/claude-auth-smoke.yml`, workflow id `330685844`,
`"state": "active"`, `GET /contents/…` on `main` → **404** (it has never been on
`main`, and appears in no fetched ref), with two real runs on branch
`claude/linear-webhook-dispatch-aoobwx`: `31336375814` (`push`, failure) and
`31336934778` (`pull_request`, success). Its pushing commit `2e355ad` was pushed
by actor `gamitch` — consistent with the wall, not a counter-example to it.

So once the **owner** pushes the three files anywhere, `state: active` is
observable immediately; only the `workflow_dispatch` run needs `main`.

Caveat worth recording in the same breath: that exhibit also shows GitHub keeps
listing a **deleted** workflow as `"state": "active"`. `state: active` is
therefore a weak instrument on its own — record the `workflow_dispatch` run's
**`conclusion` and URL** (which criterion 10 already asks for) as the strong one.

---

## (D) Item 19c — citations spot-checked (round 1's six not redone)

**Hold (verified this round):**

| Claim | Verified |
| -- | -- |
| `queue: max` + `cancel-in-progress: true` is a validation error | ✅ verbatim: *"The combination of `queue: max` and `cancel-in-progress: true` is not allowed and will result in a workflow validation error."* (`data/reusables/actions/actions-group-concurrency.md`) |
| `queue: single` cancels the pending run | ✅ verbatim: *"any existing `pending` job or workflow in the same concurrency group is canceled and replaced"* |
| `queue:` is a real key, live on github.com | ✅ documented under the `actions-nga` feature gate; `data/features/actions-nga.yml` → `fpt: '*'`, `ghec: '*'` (not GHES) |
| A `pull_request` run reports on the PR's **head** branch (F1's premise) | ✅ live, 6 of 6 runs: `head_branch=claude/gam-328-subagent-blocking`, `claude/gam-314-wiring`, `claude/gam-314-assert-run-released-claim` |
| `node -e "require('js-yaml')"` unavailable; `python3` + PyYAML available (criterion 2) | ✅ js-yaml MODULE_NOT_FOUND; PyYAML 6.0.1 parses all three existing workflows, exit 0 |
| `linear-export.yml` is `cron: '0 6 * * *'` and `name: Linear export` | ✅ lines 40, 1 — the 07:00 reconcile slot does not contend, and the name matches §5.0's subscription list |
| `ci.yml`'s edge-function job **discovers** directories | ✅ `ci.yml:309-334`, including the comment saying why a hardcoded list would reopen the gap |
| `LINEAR_DISPATCH_API_KEY` scoped to the dispatch workflow; `LINEAR_API_KEY` to the export | ✅ `claude-linear-dispatch.yml:110`, `linear-export.yml:71,100` |
| `eslint.config.js` has a `scripts/**/*.mjs` Node block | ✅ line 53 |
| `scripts/linear/` contains only `client.mjs` | ✅ lane A's four new files collide with nothing |
| `SLACK_WEBHOOK_URL` appears nowhere in the repo | ✅ no hit in `*.yml`/`*.mjs`/`*.ts`/`*.json` outside `node_modules` |
| #126 / #127 line-1 prefix-plus-prose; #140's negated line 1 | ✅ #126 `Closes GAM-303 (T808). Dispatched from Linear's \`Todo\` column…`; #127 same shape; #140 `**This PR does not close GAM-304.** It deliberately omits the \`Closes\` magic` |
| F2's prescription is *feasible*: `gitAutomationStates` is readable and exposes `event` + `state{name}` | ✅ live read: team `GAM`/`Gamitch` returns exactly one node, `event: "merge"`, `state: {name:"Done", type:"completed"}` — matching item 28g |
| F4's history shape, verified independently of run 3 | ✅ live read of GAM-303 `history(first:50)`: newest-first; `fromState:null,toState:null` entries real and numerous (5 of the first 8); `In Review → In Progress` 15:38:55.013, `In Progress → Done` 15:41:13.379 |
| Item 28g: `On PR merge → Done` is the only live automation | ✅ `constitution.md` §28g table + the live `gitAutomationStates` read above |

**Do not hold — see N3, N4, N5, N6 below.**

---

## Findings

### N1 — MAJOR. Wall 1 is unmentioned; lane D cannot be delivered by push, and criterion 10 cannot be executed by the run

Full ruling in (B). Cascades to §8 Phase 2 and to LCD 1's mitigation.
*What would make this wrong:* if a `PUT`/push to `.github/workflows/**` succeeded
with either credential. Measured twice this round, in both directions, and three
more ways by GAM-314. It does not.
**Remedy: E3, E4, E5.**

### N2 — MAJOR. §0's "the observation channel is closed" is measured false, and contradicts criterion 10 inside the same document

§0 bullet 2 is the load-bearing justification for building before §8's checklist
is executed. `/actions/runs` and `/actions/workflows` return **200**. The
checklist is still blocked — by wall 1 — so §0's *conclusion* survives and its
*premise* does not. A packet that carries a false measurement labelled
"measured" is precisely what `gate/unverified` exists to mark.
*What would make this wrong:* a 403 on `/actions/runs`. I measured 200 at
2026-08-11 22:0xZ.
**Remedy: E2.**

### N3 — MINOR. §0's private-repo measurement is stale and now false, and the correction it demands has already been made in the opposite direction

§0 bullet 1: *"**The repository is `private`, not public.** … `gh api
repos/gamitch/volt_task_tracker_rewrite` returns `"visibility": "private"` …
the proposal must be corrected."* Measured now:
`{"private":false,"visibility":"public"}`. The proposal was corrected at
`7d5d8b1` and §6.4:580-597 already records the private→public sequence; run 3's
log records the re-measurement. Draft 3 carried the original bullet through
unchanged. `branches/main` is still `"protected": false`, so Phase 3 step (a)
remains a live owner action — but it is no longer paywalled, which is the
opposite of what §0 tells a reader.
*What would make this wrong:* the repo flipping back to private.
**Remedy: E1.**

### N4 — MINOR. GAM-303 is the wrong exhibit for the `completedAt` claim, twice

§4 says the sweep reads state history *"never `completedAt`" (§6.3, measured
2026-08-11: a reopen/re-close left `completedAt` frozen at the original close
while only the history recorded the truth — the orchestrator re-confirmed both
fields exist and disagree in exactly this way on **GAM-303**)"*, and §3 calls
GAM-303 *"the documented reopen/re-close case"*.

Measured live:

```
GAM-303  completedAt 2026-08-09T15:41:13.412Z   state Done
         15:41:13.379  In Progress -> Done      <- its ONLY Done transition
         15:38:55.013  In Review   -> In Progress
         15:30:19.848  In Progress -> In Review
         15:13:10.427  Backlog     -> In Progress
```

GAM-303 was never reopened *after* a close; it took one backwards move before
its single close, and `completedAt` **agrees** with that close to 33 ms. The
design's real exhibit is **GAM-315** (proposal §4.1 row 13), and it holds
exactly as described:

```
GAM-315  completedAt 2026-08-10T23:36:32.146Z   state Done
         2026-08-11T00:47:24.148  In Progress -> Done      <- re-close, not reflected
         2026-08-11T00:27:43.816  Done        -> In Progress
         2026-08-10T23:36:31.815  In Progress -> Done      <- completedAt frozen here
```

The *rule* (read history, never `completedAt`) is CONFIRMED. The *citation* is
wrong, and it has a downstream cost: lane C's criterion 3 demands *"a fixture
where the two disagree"*, and a worker pointed at GAM-303 will find they agree.
**Remedy: E6.** GAM-303 remains a fine subject for lane B's *history-shape*
probe — it has the null entries and the real transitions the probe needs — it is
simply not a reopen/re-close.

### N5 — MINOR. §5.0's fourth owner action must say it *replaces* the as-built subscription, not adds to it

Proposal §8a records Phase 1 as-built: *"GitHub app subscribed as
`workflows:{event:"repository_dispatch","push","schedule"}`"*. Filters inside
`workflows:{}` are ANDed. So the channel **today** already drops every
`pull_request`-triggered run — the same defect F1 names, from a different cause,
and already live rather than merely advised. Adding `name:{…}` on top of the
existing event filter would leave the sync and gate workflows silent anyway.
**Remedy: E7.**

### N6 — MINOR. Lane E's acceptance criterion 3 is unverifiable with today's tooling

Criterion 3: *"`cd supabase/functions/linear-dispatch && deno test --allow-env
--allow-read` exits 0."* Measured: `which deno` → empty; nothing under
`node_modules/.bin`; no `deno` binary anywhere on the container. CI installs it
per-run via `denoland/setup-deno@v2` (`ci.yml:316-321`). Round 1 verified the CI
*invocation*; nobody verified the worker could run it.
**Remedy: E8.**

### N7 — MINOR. The working branch is 24 commits behind `main`, and its `AGENTS.md` predates the wall

`git rev-list --count HEAD..main` → **24**. `AGENTS.md` on
`claude/gam-325-linear-closer` contains no *"Two walls a dispatched run hits"*
section; it arrived on `main` in `9f91c23` (PR #161, merged 21:54Z). Every agent
dispatched from this tree therefore reads a version of `AGENTS.md` that does not
contain the rule this gate round is about — which is a sufficient explanation
for why no draft mentions it, and a reason to fix the tree, not only the packet.
The branch is also missing `scripts/linear-assert-released.mjs` (PR #159) and the
`assert-released` wiring (PR #160) — the job that now fails any run leaving its
issue `In Progress`.
**Remedy: E9.**

### N8 — NIT. `queue:` prose overstates FIFO, and understates one caveat

§5 says *"FIFO by the time each entered the group"*. The docs add: *"Since the
actual start time of a job or run may vary, **ordering is not guaranteed**."*
Separately, LCD 6's residual risk is smaller than stated (the key is fully
documented and gated `fpt: '*' / ghec: '*'`, i.e. live on github.com) but carries
a caveat LCD 6 does not name: it does **not** exist on GHES. Neither changes any
decision.

### N9 — NIT. Lane D's acceptance criteria are numbered 1, 2, 3, 4, 6, 7, 8, 5, 9, 10

Criterion 5 (header comments) sits between 8 and 9. A checker works down a list.

---

## Least-confident list verdicts (item 19d)

The list is present, numbered, six entries. Per charter, LCD 2 (discharged),
LCD 3 (ruled keep) and LCD 4 (stands) are not re-litigated.

| LCD | Verdict | Evidence |
| -- | -- | -- |
| **1** — ship while §8's checklist is unexecuted, because shadow relies on nothing | **UNRESOLVED — the declared risk is no longer the dominant one.** Round 1 traced every write path and the "nothing relies on an unmeasured answer" claim held. But the entry's *"what would make it wrong"* names only "a `closed` event might not run the workflow", mitigated by "the `measure` step makes that visible on the first merge". Wall 1 means the measure step cannot run until an owner applies a patch. The doubt is real and correctly declared; its stated failure mode is now the second-largest. **E5** |
| **2** — strict line-1 parsing | Discharged (round 1). Not re-derived. |
| **3** — gate rule 4 | Ruled keep (design's author). Not re-derived. |
| **4** — the 120 s window | Stands (round 1). Not re-derived. |
| **5** — five lanes vs one worker | **SOUND.** F5 landed as a binding §1 constraint; lane A's contract in §2 is exact and its file set (`scripts/linear/`) collides with nothing — measured, `scripts/linear/` contains only `client.mjs`. |
| **6** — `queue: max` is load-bearing and only measured today | **SOUND, and stronger than the entry allows.** Both the key and the `cancel-in-progress: true` incompatibility are confirmed verbatim from `github/docs` source, gated `fpt: '*' / ghec: '*'`. The behavioural half stays open by construction and D4 is correctly named as the instrument. Add the GHES caveat and the "ordering is not guaranteed" wording (N8). |

---

## Required edits (conditions of DISPATCH)

E1–E9 are documentation changes to `docs/swarm/active/GAM-325-packet.md`, which
the orchestrator owns. **E3 and E4 gate lane D specifically**; E1, E2, E5, E6,
E7, E8 gate the packet as a whole; E9 gates the tree.

**E1 — §0 bullet 1.** Replace the private-repo bullet with the measured fact:
`gh api repos/gamitch/volt_task_tracker_rewrite --jq '{private,visibility}'` →
`{"private":false,"visibility":"public"}` (2026-08-11 22:0xZ); `branches/main`
still `"protected": false`, so Phase 3 step (a) stays an owner action but is not
paywalled. Note the proposal was already corrected in that direction at
`7d5d8b1` / §6.4:580-597, so the sentence *"the proposal must be corrected"* is
spent.

**E2 — §0 bullet 2.** Replace *"the observation channel is closed"* with:
`/actions/runs` **200**, `/actions/workflows` **200**, `/actions/secrets` **403**,
`/user` **403** (measured by the premise gate, 2026-08-11 22:0xZ). Then replace
the *reason* the checklist is unexecutable with the true one, keeping the
conclusion: **a dispatched run cannot push `.github/workflows/**` at all**, so no
throwaway PR carrying the sync workflow can exist. Cite the measurement:
`PUT /contents/.github/workflows/ci.yml` → 403 `Resource not accessible by
integration` on both this run's credentials, while the identical request against
`docs/swarm/constitution.md` returns 409 sha-mismatch.

**E3 — new subsection at the head of §5, "Lane D cannot be delivered by push
(AGENTS.md wall 1)".** It must state, in the packet, all five of:

1. The wall, cited to `AGENTS.md` § *Two walls a dispatched run hits* on `main`
   (`9f91c23`, PR #161), plus the measurement in E2. Note it is deliberate —
   *"the only thing stopping an autonomous run from rewriting the workflow that
   constrains it"* — and that no other channel is to be attempted.
2. Lane D's worker **builds and commits the three files in its own worktree and
   never pushes.** A push whose pack touches `.github/workflows/**` is rejected
   outright and strands the *entire* commit, not just those files.
3. Lane D's criteria 1–9 are all local (`grep`, `python3 -c "import yaml…"`) and
   are satisfied without any push — so lane D is still fully reviewable by
   `checker-reviewer`.
4. The **orchestrator** (owner of `docs/swarm/**`; no lane may write there per §1)
   runs `git format-patch` over lane D's commit and preserves it as
   `docs/swarm/active/GAM-325-lane-d-workflows.patch`, exactly as
   `docs/swarm/active/GAM-314-workflow-wiring.patch` was preserved in `86fcbb1`.
5. The PR body **leads with the undeliverable half** and a handover is filed —
   the route proven end to end by PR #159 (`app/claude`, no workflow file) →
   PR #160 (`gamitch`, `.github/workflows/claude-linear-dispatch.yml` only).

**E4 — lane D criterion 10.** Reclassify it from a lane/orchestrator criterion to
an **owner action**, carried to the issue beside checklist items 4, 5, 8 and
§5.0's three secrets. It must say:

- Neither the worker nor the orchestrator can put the file on any ref; the
  sentence *"The orchestrator executes this at integration, not the worker"* is
  false and must go.
- `workflow_dispatch` requiring the default branch is **CONFIRMED** — quote
  `github/docs` `data/reusables/actions/branch-requirement.md`: *"This event will
  only trigger a workflow run if the workflow file exists on the default
  branch."* `linear-reconcile.yml` (schedule + `workflow_dispatch` only) can
  therefore not run at all before the owner's PR merges.
- The `state: active` half **is** observable from a non-default branch once the
  owner pushes the files — exhibit `claude-auth-smoke.yml` (workflow id
  `330685844`, `state: active`, 404 on `main`, ran on `push` and `pull_request`
  from `claude/linear-webhook-dispatch-aoobwx`).
- But `state: active` is a weak instrument on its own: that same exhibit shows
  GitHub keeps listing a **deleted** workflow as `active`. Record the
  `workflow_dispatch` run's `conclusion` and URL as the strong signal.
- Delete *"this criterion is executable and is not a wish"*. Replace with: the
  observation channel is open **and may close again** (run 1 measured 403 on both
  endpoints); the fallback instrument is the Actions tab in the GitHub UI, which
  shows the *invalid workflow file* state with no token at all.

**E5 — LCD 1.** Rewrite *"what would make it wrong"* to lead with the dominant
risk: the three workflows land as a patch file and the owner never applies them,
so shadow mode never starts, the `measure` step never runs, and §8's checklist
stays unexecuted indefinitely rather than "merely deferred". Name the mitigation:
the handover filed on GAM-325 with the patch path from E3, and the `NO_SYNC_KEY`
/ shadow defaults that make the un-applied state silent-but-safe.

**E6 — §3 and §4, the `completedAt` exhibit.** Change **GAM-303 → GAM-315** for
the `completedAt`-versus-history claim, with the measured numbers: GAM-315
`completedAt` `2026-08-10T23:36:32.146Z`, frozen across `Done → In Progress`
`2026-08-11T00:27:43.816Z` and `In Progress → Done` `2026-08-11T00:47:24.148Z`.
Direct lane C's criterion-3 fixture at those numbers. Keep GAM-303 as lane B's
history-shape probe subject if wanted, but stop calling it *"the documented
reopen/re-close case"* — measured, its transitions are
`Backlog → In Progress → In Review → In Progress → Done` and its `completedAt`
(15:41:13.412Z) agrees with its single `Done` (15:41:13.379Z) to 33 ms.

**E7 — §5.0 fourth owner action.** State that the `workflows:{name:…}`
subscription **replaces** the as-built
`workflows:{event:"repository_dispatch","push","schedule"}` recorded in proposal
§8a. Filters inside `workflows:{}` are ANDed, so keeping the event filter would
still drop every `pull_request` run of the sync and gate workflows — the F1
defect is live today, not hypothetical.

**E8 — lane E criterion 3.** `deno` is not installed on the dispatch container.
Either require the lane E worker to install it and report the exit code, or move
the criterion to observation of the PR's `Edge Function tests (Deno)` job
(`ci.yml:309`). As written it cannot be measured with today's tooling.

**E9 — the tree, not the packet.** Merge `main` into
`claude/gam-325-linear-closer` before dispatching any lane. The branch is 24
commits behind; its `AGENTS.md` has no *"Two walls"* section, so every dispatched
agent would read the pre-wall version of the very rule this round turns on. The
merge also brings `scripts/linear-assert-released.mjs` and the `assert-released`
wiring; neither collides with any lane's Allowed Files.

*Optional (NIT):* renumber lane D's acceptance criteria 1–10 in order (N9), and
fold N8's two wording corrections into §5 and LCD 6.

---

## What round 2 did not touch

Per charter and round 1's rulings: LCD 2 (discharged by live 7-of-7 line-1
measurement), LCD 3 (ruled keep), LCD 4 (stands), the five-lane split, the
behaviour table, the claim-marker format, §5.0's secrets, and round 6's cuts
(`REVERT_MERGED`, the three-strikes reminder, `pull_request_target`). Round 1's
six re-verified repo facts were not redone.
