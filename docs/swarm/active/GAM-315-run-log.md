# GAM-315 run log

Issue: [GAM-315](https://linear.app/gamitch/issue/GAM-315/any-branch-named-claudegam-nnn-closes-that-issue-on-merge-item-28f) —
"Any branch named `claude/gam-nnn-*` closes that issue on merge — item 28f says
it only links, and that is false here"

Branch: `claude/gam-315-branch-link-closes` (base `43d99c7`)

Append-only. One line per milestone, committed and pushed immediately.

---

- **claimed** — read `AGENTS.md` § "Where work comes from" and constitution
  items 19, 26, 28. Fetched GAM-315 live from Linear. Set `tier/unreviewed` →
  `tier/standard`, then `Todo` → `In Progress`, then re-read: state
  `In Progress`, labels `other, standard`. Read-back confirms the claim.
- **tier judgement (item 28d / item 26)** — **STANDARD**. Trigger question:
  *can a mistake here corrupt data, or lie to a user about their own data?*
  No. The deliverable is a correction to a governance document; no code, no
  write path, no schema/RLS/migration/auth, no signature another module
  imports. **FAST is unavailable** because it requires "a named mutation exists
  that turns a test red" and a prose correction has no test to redden — the
  evidence FAST refuses to give up cannot be produced in that form here.
  **HEAVY's literal triggers do not apply** (no write path, no RLS/auth, no
  migration or metric SQL, no export another session builds against), and item
  26 forbids "it sounds important" as a trigger. So STANDARD — *but* the
  entire issue is a factual claim about an external system's behaviour that
  the filer twice marks unverified ("Hypothesis, not verified"; "Not verified:
  whether the automation is scoped or global"). That is precisely item 19's
  subject, so this row gets a **full** premise gate (item 19b) before any
  worker touches `constitution.md`, regardless of tier.
- **branch name** — follows `WORKFLOWS.md` rule 2 / item 28g deliberately,
  even though this issue is *about* that convention's hazard. Changing it
  unilaterally would pre-judge the fix. The hazard is live on this branch and
  is recorded here so the merge is not a surprise.

## Premise measured — **HOLDS, and is broader than filed**

Measured 2026-08-10 by the orchestrator against Linear's API and `gh`, not
read from the issue. Six findings; the two the filer marked "not verified" are
now read from Linear's own settings rather than inferred from behaviour.

**P1 — CONFIRMED. Item 28f's "links only" is false.** Every PR merge on a
branch named `claude/gam-304-*` produced a GAM-304 state transition within
2–3 seconds. Five of the seven carried **no** magic word — #140's body line 1
is literally *"This PR does not close GAM-304. It deliberately omits the
`Closes` magic word."* Four of those bare-link merges drove the issue to
`Done`.

| PR | branch | merged (GitHub) | GAM-304 transition | Δ |
| -- | -- | -- | -- | -- |
| #138 | `claude/gam-304-failure-p3y021` | 04:01:59Z | In Progress → **Done** | +2s |
| #139 | `claude/gam-304-failure-p3y021` | 04:56:36Z | In Progress → **Done** | +2s |
| #140 | `claude/gam-304-wire-rsvp-controls` | 05:29:20Z | In Progress → **Done** | +2s |
| #141 | `claude/gam-304-failure-p3y021` | 11:54:41Z | In Progress → **Done** | +2s |
| #143 | `claude/gam-304-rsvp-write` | 14:00:01Z | In Review → **In Progress** | +3s |
| #144 | `claude/gam-304-failure-p3y021` | 14:56:17Z | In Progress → **Done** | +2s |

**P2 — CONFIRMED. The inverse is real.** #143 is the actual RSVP fix and the
only PR whose body line 1 is `Closes GAM-304`. On merge it moved the issue
**backwards**, In Review → In Progress. The magic word item 28f prescribes did
not close the issue on the one occasion it mattered.

**P3 — CONFIRMED, and now read rather than inferred.** Team `GAM`'s
`gitAutomationStates` (Linear GraphQL):

```
event=start   targetBranch=ANY -> In Progress (started)
event=review  targetBranch=ANY -> In Review   (started)
event=merge   targetBranch=ANY -> Done        (completed)
```

So the filer's open question — *"whether the automation is scoped or global"* —
resolves to **global**: `targetBranch: ANY`, no branch pattern, no regex.
And item 28g asked the owner to enable **one** automation (*PR merged → Done*);
**three** are on. The two extra ones are not mentioned anywhere in the
constitution, and one of them is what causes P2.

**P4 — CONFIRMED. The filer's unverified hypothesis is correct.**
`merge → Done` fired exactly when the merging PR was the *last open* linked PR
(#138, #139, #140, #141, #144). It did not fire for #143 — the only merge with
another linked PR still open (#142, created 13:17:02Z, merged 14:22:46Z).
There, `start → In Progress` won instead. The automation computes from the
**aggregate state of the linked PR set**, not from the merge event.

**P5 — NEW. Item 28f's own cited precedent proves the opposite of what it is
cited for.** 28f offers PR #126 / GAM-303 as proof that the magic word "links
**and** closes." Measured: #126's branch is `claude/next-ready-task-xvmtcj` —
it carries **no** identifier, so `Closes GAM-303` supplied the *link* and the
same team `merge → Done` automation supplied the *close*. The example is
consistent with the magic word doing nothing but linking. GAM-303 also shows
the P2 regression already present: at 15:38:55Z, the moment #126 was attached,
`start` moved it In Review → **In Progress**.

**P6 — NEW. The state history's actor column is misleading, which is why this
went unseen.** Four of the seven GAM-304 transitions are attributed to
"George Mitchom" and two to `bot:GitHub(integration)`. The split tracks the PR
**author** — `app/claude` → bot actor, `gamitch` → mapped Linear user — not who
acted. Every one of them lands 2–3s after a merge; `mergedBy` is `gamitch` for
all seven. Reading the history at face value credits a human with automated
moves.

**Consequence for item 28f.** Both of its operative sentences are false in this
workspace: a bare identifier does not "link only" (it closes), and it does not
"leave the issue sitting in `In Review` after merge" (it leaves it in `Done`).

**Tier re-checked after measurement: still STANDARD.** The premise grew, the
deliverable did not — it remains a prose correction to a governance document.
Item 26's trigger question still answers *no*.

**Authority (Authority Boundaries, constitution.md:22-24):** only
`boss-architect` and `boss-arbiter` may modify `constitution.md`. A
`worker-implementer` may not, so the edit is dispatched to `boss-architect`.

## Run milestones (continued)

- **packet written** — `docs/swarm/active/GAM-315-packet.md`. Scope: item 28f,
  item 28g, `WORKFLOWS.md` rule 2. Six measured facts F1-F6, eight acceptance
  criteria, five least-confident decisions (item 19d, included though STANDARD
  does not require it). Assigned to `boss-architect` because Authority
  Boundaries reserves `constitution.md` to boss roles.
- **F1 measured (new, packet-blocking)** — a bare prose mention of `GAM-nnn` in
  a PR body does **not** create a Linear link. PR #142's body line 1 names
  GAM-315; GAM-315 has zero attachments; GAM-315 was created 04:54:22Z, eight
  hours before #142 opened at 13:17:02Z, so the timing confound is eliminated.
  This is what makes a mention-vs-work branch convention possible at all.
- **premise gate round 1 (item 19) — VERDICT: REVISE.** `checker-premise` on
  opus, 32 tool calls, ~98K tokens. 2 BLOCKER, 2 MAJOR, 4 MINOR, 2 NIT. It ran
  rather than only read (item 26): five Linear GraphQL queries, ~20 `gh pr view`
  calls, `npm run format:check`. All seven line-number citations verified
  correct — a clean item 19c result. The gate paid for itself twice over:
  - **BLOCKER 1 — the packet said the PR-title case "was not tested." It was,
    and the result is in two already-merged documents in the same directory.**
    `docs/swarm/2026-08-09-linear-webhook-dispatch.md:423-449` is headed *"Item
    28f is wrong: a title identifier closes the issue too."* PR #132 (branch
    `claude/linear-webhook-dispatch-aoobwx`, no identifier) closed GAM-310 on
    merge. My F1 caveat was not caution, it was an unread repository.
  - **BLOCKER 2 — C3's prose convention fails on the packet's own exhibits.**
    Prose written *about* a linking hazard reliably contains the magic-word
    pattern: #142, #138 and #140 all contain "close(s) GAM-304" in exactly the
    sentence explaining that they must not close it. Renaming those branches
    per C3 converts a branch-name link into a magic-word link and changes
    nothing. LCD #3's stated mitigation ("degrades to a wrong link, not a wrong
    close") is false — a magic word degrades to a close.
  - MAJOR 3/4: my P1/F4 counts are wrong under every reading, and #142's merge
    produced **no** transition (already `Done`), so the table is not exhaustive.
  - The gate also *strengthened* F1's conclusion on three independent negatives
    (#146→GAM-304, #128→GAM-303/309) and found a better instrument than
    attachment count: GAM-304 moved `Backlog → In Progress` at 02:23:20.568Z on
    a branch push, 48 minutes before #138 existed and with no attachment — so
    automation silence, not attachment absence, is the proof.
  - LCD verdicts: #1 WRONG, #2 SOUND, #3 UNRESOLVED (wrong risk declared),
    #4 SOUND, #5 UNRESOLVED.
- **corrections to the premise section above** (this log is append-only, so the
  errors stay visible and are corrected here rather than edited away):
  - **P1 is overstated.** "Every PR merge … produced a transition" is false:
    #142 merged at 14:22:46Z and produced **none**, because GAM-304 was already
    `Done` from the owner's hand-close at 14:18:16.288Z. A no-op merge is
    unobservable in state history.
  - **P1/F4 counts were wrong.** Of the seven linked PRs: six intended no magic
    word, **three** contain no magic-word token at all (#139, #141, #144), and
    **five** drove the issue to `Done`. #138 and #140 both contain
    `close GAM-304` in the sentence disclaiming it, so neither is a clean
    exhibit for the no-magic-word point — #140 was the round-1 packet's
    flagship and was the weakest available.
  - **P6 said "seven transitions".** There are six merge-coincident ones (four
    user-attributed, two bot); the seventh is the owner's hand-close, which
    follows no merge. The author→actor correlation itself is confirmed.
  - **F1's instrument was weak.** Attachment count is the wrong test: GAM-304
    moved `Backlog → In Progress` at 02:23:20.568Z on a branch push, 48 minutes
    before #138 existed and with no attachment created. Automation firing is
    the strong instrument. F1's conclusion survives and is now re-armed on
    three independent negatives (#142→GAM-315, #146→GAM-304, #128→GAM-303/309).
- **title disjunction probed and left open, deliberately.** Swept all 200 PRs
  for an identifier in the title but not the branch: only #132, #131 and #125
  (`GAM-000`, not a real issue). #132 and #131 both carry a magic-word token in
  the body, so title-link and negated-magic-word-link cannot be separated by
  any data in this repository. The experiment that would settle it — a
  throwaway issue plus a PR titled with its identifier and no magic-word token
  — was **not run**: it fires a live automation against the tracker to learn
  something that changes no prescription, because the safe rule is identical
  under both horns.
- **re-tiered STANDARD → HEAVY** on the gate's MINOR 8. Item 26: take the
  heavier when two are arguable. The row is in fact receiving the full HEAVY
  chain (packet → premise gate → `boss-architect` → `checker-reviewer`), so
  HEAVY is the honest label. Linear label updated and read back:
  `In Progress | other, heavy`.
- **packet revision 2 written** — all nine required revisions addressed, plus
  the gate's three cheaper paths (own-issue as the primary instruction;
  extend `WORKFLOWS.md:495` rather than add a competing paragraph; date-stamp
  C2 and name the reproducing query). Allowed files now three; acceptance
  criterion 8 is runnable and can fail.
- **premise gate round 2 dispatched** — same `checker-premise` agent resumed
  with its round-1 context, so it verifies its own nine required revisions
  rather than re-deriving them. Item 19a: this is the last round; a third
  REVISE escalates to the human owner.
- **Deliverable B drafted** — `docs/swarm/active/GAM-315-deliverable-b.md`,
  written through `.claude/skills/linear-task-writing` per item 30. Not yet
  filed in Linear. Recommends option 1 (disable `start → In Progress`) and
  records that `targetBranch` cannot express a head-branch scheme, so scoping
  is not among the options.
- **orchestrator probe of LCD #3's untested channels (commit trailers)** — could
  not be settled from existing data. Eight issues carry `Linear-Issue: GAM-nnn`
  commit trailers, but every one of them (GAM-303, 304, 307, 308, 309, 310, 288,
  315) also has a PR linked by branch name or magic word, so no clean case
  isolates the trailer channel. The constitution's existing claim that "Linear
  does not read commit trailers" is therefore **unverified here, not refuted**.
  Recorded rather than resolved; the packet's LCD #3 already forbids claiming
  the link list is exhaustive.
- **premise gate round 2 — VERDICT: REVISE.** 1 BLOCKER, 2 MAJOR, 3 MINOR,
  1 NIT. Seven of round 1's nine required revisions were accepted as addressed;
  two were "addressed in conclusion, broken in evidence."
  - **BLOCKER 1 — and it is the gate correcting its own round-1 finding.** F1a
    claimed GAM-304's `02:23:20.568Z` transition was a branch push 48 minutes
    before #138 existed. Not measured: the earliest commit on any `gam-304`
    ref is `2467554` at `03:09:32Z`, *after* the transition, and GitHub's
    events API returns nothing for those refs. I adopted the gate's round-1
    finding 9 verbatim without checking the git side. **An unmeasured claim was
    one dispatch away from entering the constitution — which is the exact
    defect GAM-315 exists to remove from item 28f.** Withdrawn in revision 3.
  - **MAJOR 2 — the clean-exhibit set was wrong again, in a new way.** #139 and
    #144 carry `GAM-304` in their *titles*, which F1c had just established as a
    live channel one page earlier. Revision 2 removed the magic-word confound
    and introduced a title confound in the same sentence by not applying F1c
    backwards. **Exactly one PR of the seven is a clean branch-name-only link:
    #141.** The premise still holds — but on one observation, not three, and
    the packet now says so and carries the seven-row channel matrix.
  - MAJOR 3 — criterion 8, the criterion advertised as "can fail", could not
    *pass*: grep 3 matched the packet itself, and never matched the file it
    targeted (`tracker-migration.md` wraps the phrase across `:245`/`:246`);
    grep 4 was unsatisfiable. Both corrected.
  - MINOR 5 — **the gate closed one of my open channels for me.** Commit
    messages do not link: `GAM-318` is named only in commit `c865b51` on PR
    #143's branch and took zero attachments and zero transitions across push,
    open and merge. Promoted to F8; LCD #3 narrowed to PR comments alone.
  - The gate also *upheld* the two judgement calls I most expected to lose:
    declining the F1c experiment ("I would not require it" — the only team is
    the live one, and `linear-export.yml` would commit the throwaway into the
    git-side record), and the HEAVY re-tier ("a label that matches observed
    reality is not inflation").
- **ITEM 19a CAP REACHED — ESCALATED TO THE HUMAN OWNER.** Two rounds, two
  REVISEs. Item 19a forbids a third round. **No `boss-architect` dispatch has
  been made and the constitution is unchanged.** Revision 3 applies all six of
  round 2's required changes so the owner reviews the best version, but that is
  explicitly *not* a self-issued pass — certifying my own packet through a
  closed gate is the self-certification item 28e forbids.
- **branch renamed, applying this issue's own finding to itself.**
  `claude/gam-315-branch-link-closes` → `claude/item-28f-linking-measurement`.
  **Item 28f is still wrong in `constitution.md`, so GAM-315 must not close** —
  and a branch carrying the identifier would have closed it on merge (F4/#141).
  GAM-315 had no attachment at rename time (attachments are created when a PR
  opens, not on branch push), so the link was still preventable. The PR carries
  no identifier in its title and no magic word; the issue is referenced in
  prose only, which F1d measures as non-linking. This is the C3 rule applied by
  its own author before it is ratified — and the strongest evidence available
  that the finding is real and actionable.
- **GAM-322 filed** — `Backlog`, `gate/human`, `provenance/premise-gate`,
  `tier/unreviewed` (tiering is the picker's first act, item 28c/d, so it is
  not mine to pre-judge). The owner's automation decision, with three options
  and a recommendation.
- **escalation recorded on the row** — comment posted; labels now
  `other, heavy, human, escalated`; state left `In Progress`, because the work
  is not finished and item 28e's `In Review` would misrepresent it.
- **PR #149 opened** — https://github.com/gamitch/volt_task_tracker_rewrite/pull/149
- **THE MITIGATION IS CONFIRMED LIVE.** After PR #149 opened, GAM-315 has
  **zero attachments** and no new state transitions. Every prior PR in this
  investigation attached to its row within ~3 seconds of creation (GAM-304's
  seven attachments each match a PR creation time to the millisecond). GAM-304
  and GAM-322 are both named in #149's body in prose and neither took a new
  attachment either. So: branch renamed off the identifier + no identifier in
  the title + no magic word = **no link, therefore no close**. F1d and C3's
  mechanical fallback hold under their first live test.
- **the PR body had to be scrubbed to comply with the rule it proposes.** Two
  sentences violated C3's same-sentence constraint — one put `fix` within a few
  words of `GAM-304`, which under a looser parser could have moved *another*
  issue. Caught by grepping the body before opening. **This is direct evidence
  for MINOR 4's point that "adjacent" needs a definition a checker can apply:**
  the author of the rule broke it twice while writing the very PR that proposes
  it, and only a mechanical check caught it.
- **gates run** — `gate-run` with `--require-clean`, on the final branch state:

  ```
  GATE RUN — 8f89fb6 on claude/item-28f-linking-measurement — tree clean
    1 tsc              exit 0  PASS
    2 vite build       exit 0  PASS
    3 format:check     exit 0  PASS
    4 eslint           exit 0  PASS   0 errors, 377 warnings
    5 vitest (full)    exit 0  PASS   83 files / 2162 tests
                                      (no baseline given — regression not checked)
    6 vitest (scoped)      –  SKIP    no scope derivable from the diff
  VERDICT: PASS — 5 of 6 gates. NOT all six: 1 skipped.
  ```

  **Five, not six**, and gate 5 carried no baseline. Gate 6 is unskippable-by-
  choice here: the diff contains no `src/` file, so no scope exists to derive.
  The 377 warnings match the standing pre-existing count the skill documents.
  These gates say the tree still builds and stays green; they say **nothing**
  about this diff, which is markdown that no gate reads — as PR #149 states
  rather than implying a green tick covers it.

---

# Round 3 — second dispatch, 2026-08-10T21:25Z

Different agent, different container. The owner ruled at `21:23:26Z`
(*"approve the 3rd gate request"*), removed `gate/human` and `escalated`, and
moved the row `In Progress → Todo` at `21:24:00Z`, which re-dispatched it. This
section is that run. **PR #149 stays open and unmerged** per the ruling.

- **claimed** — `Todo → In Progress` at `21:25:13.352Z` via Linear GraphQL
  (no Linear MCP tool in this runtime; `LINEAR_API_KEY` is present). Read back:
  `state.name = "In Progress"`. Item 28c satisfied. Label was already `heavy`,
  so item 28d tiering was not part of claiming — the previous run re-tiered it.
- **premise re-measured independently, before PR #149 was known.** The dispatch
  order is explicit that a premise nobody checked is worse than a refusal, so
  this run measured the load-bearing facts from scratch rather than reading them
  off the row. It reached **the same three unscoped `gitAutomationStates`**
  (`start → In Progress`, `review → In Review`, `merge → Done`, all
  `branchPattern: null`, `targetBranch: null`) and **the same aggregate-state
  conclusion** from the same #143/#142 exhibit. Two runs, two containers, one
  result — recorded because independent corroboration is worth more than a
  citation, and because it cost four API calls.

  **This is corroboration, not new work.** The ruling says the measurements
  "must not be re-derived"; that instruction was read after the fact, and the
  duplicate spend is noted here rather than hidden.
- **two things this run adds that the packet does not have:**

  **A. `AGENTS.md:36-37` carries the same false claim and is outside the
  packet's Allowed Files.** A delegated `checker-premise` (opus) verifying the
  issue's repo-side citations found `AGENTS.md:36-37` — *"An identifier in the
  title or branch links but does **not** close."* — verbatim the sentence item
  28f is being corrected for, in the file agents read at startup. The packet's
  Allowed Files are `constitution.md`, `WORKFLOWS.md`, and
  `2026-08-09-tracker-migration.md:245`. **A correction that lands only in those
  three leaves the falsehood standing in `AGENTS.md`.** This goes to round 3.

  **B. A branch name does not link on push — the link is created when the PR is
  opened.** The packet's F1a explicitly withdraws a claim here and marks it
  *"unmeasured; do not write it into the constitution."* This run supplies the
  negative: branch `claude/gam-315-branch-link-closes-issue` (identifier in the
  name) was pushed to `origin` twice, at `21:27Z` and `21:36Z`, with **no PR
  opened**. GAM-315's `attachments` read back **empty** at `21:40Z` and its
  state history shows no transition from either push. Scope honestly: this shows
  push-without-PR does not attach *in this workspace with these settings*; it
  does not prove the timing of attachment in every case. It is enough to stop
  F1a's withdrawn claim from being reinstated, and it is why the rename below
  was still possible.
- **branch restructured, and the finding applied to this run too.** This run
  started on `claude/gam-315-branch-link-closes-issue` — which carries the
  identifier and would have closed GAM-315 on merge, exactly the hazard under
  repair, and wrong here because round 3 may yet return REVISE. Renamed to
  **`claude/item-28f-gate-round3`**, no identifier, before any PR existed and
  while attachments were still empty. Rebased onto
  `claude/item-28f-linking-measurement` (PR #149) instead of `main`, so this
  work **stacks on** #149 rather than racing it: both runs would otherwise have
  written this same file on two branches and conflicted head-on. The old remote
  branch is deleted.
- **premise gate round 3 dispatched** — `checker-premise`, opus, on revision 3
  of `docs/swarm/active/GAM-315-packet.md` at `ce16bdd`. Briefed with the
  owner's three priorities (remaining unmeasured claims; the five-closes /
  one-clean-exhibit arithmetic; the `targetBranch` base-vs-head finding), its
  charter §0 duty to attack the item 19d list first, and this run's additions A
  (`AGENTS.md:36-37`, outside Allowed Files) and B (push does not attach).
  **This is the last round.** Per the ruling, a REVISE escalates to the owner;
  it does not open a fourth.
- **premise gate round 3 — VERDICT: REVISE.** `checker-premise` on opus, 35 tool
  calls, ~81K tokens. **0 BLOCKER, 3 MAJOR, 4 MINOR, 1 NIT.** It ran rather than
  only read (item 26): 7 Linear GraphQL calls, ~20 `gh` calls, a team-wide
  attachment `sourceType` sweep, and GraphQL schema introspection.

  **The owner's three priorities, answered:**
  1. *A third unmeasured claim is present.* **Found — two of them**, both MAJOR,
     and both in `WORKFLOWS.md`/C3 rather than in the F-list the last two rounds
     had been polishing.
  2. *The five-closes / one-clean-exhibit arithmetic.* **Both CONFIRMED.** All 28
     cells of F4's matrix re-verified; #141 is the only PR with neither a title
     identifier nor a magic-word token, merged `11:54:41Z` → transition
     `11:54:43.137Z`, 2.1s.
  3. *`targetBranch` is base, not head.* **CONFIRMED from the API's own schema
     description** ("pull requests *targeting* the specified branch pattern"),
     which is a better instrument than the behavioural inference. GAM-322's
     option set stands.

  **Clean item 19c round:** every line citation in revision 3 verified correct.
  Rounds 1 and 2 each lost budget to citation drift; round 3 lost none.

- **CORRECTION — this run's own "finding B" is withdrawn.** The gate refuted it,
  and it is recorded here rather than quietly dropped, because getting this wrong
  is the exact defect GAM-315 exists to remove.

  This run claimed above that pushing `claude/gam-315-branch-link-closes-issue`
  twice with no PR, and reading GAM-315's `attachments` back empty, showed **a
  branch name does not link on push**. It shows no such thing. **Both instruments
  were blind:**
  - *Firing:* GAM-315 was already `In Progress` (`21:25:13.352Z`) before either
    push, so `start → In Progress` would have been a **no-op** — unobservable, by
    the packet's own F3 caveat, which this run had read and did not apply.
  - *Attachments:* there is **no positive control**. A sweep of the first 40 GAM
    issues returned 13 attachments, every one `sourceType: "github"` with a
    `/pull/` URL and **zero** of branch type — so an empty array says nothing
    about branch links either way.

  Correct status: *consistent with, does not measure.* **F1a's withdrawal and
  acceptance criterion 7 stand unchanged** — revision 3 was right and this run
  was wrong. An unmeasured claim came within one packet revision of the
  constitution for the third round running, and this time the orchestrator
  supplied it.
- **packet revision 4 written** — all eight of round 3's findings applied to
  `docs/swarm/active/GAM-315-packet.md`: C3's PR count corrected to five (four
  closes, one no-op); `WORKFLOWS.md:491-492`'s "from the first push" added to C3
  as a strike-or-qualify instruction with new criterion 7b; `AGENTS.md:36-37`
  ruled explicitly out of scope with the authority question named and a Linear
  row filed (item 20); F1a's weak-instrument caveat removed since all three F1d
  negatives are firing-armed; criterion 8's file-set check replaced with an
  unrestricted form that can actually fail; "200 PRs" → 148;
  `linear-webhook-dispatch.md:378` added as C5. **This is not a pass** — same
  reason revision 3 was not.
- **item 20 deferral filed — `GAM-323`** (`Backlog`, `tier/standard`, priority
  Medium), written per item 30 via `.claude/skills/linear-task-writing`:
  *"AGENTS.md tells every agent a branch-name identifier does not close its issue
  — measured, it closes"*. Carries the unresolved authority question
  (`AGENTS.md:190-192` reserves the file to the primary orchestrator and names no
  boss role, while `constitution.md:22-24` reserves the constitution to boss
  roles), both ways to close it, and a recommendation to fold it back into
  GAM-315's Allowed Files. Line numbers re-verified against `origin/main` before
  writing; `git diff --stat origin/main -- AGENTS.md` empty. `Backlog`, not
  `Todo` — promotion is the owner's signal (item 28a).
- **escalated to the owner on the row** — comment posted on GAM-315 with round
  3's verdict, the three priorities answered, the retraction, and the
  recommendation (rule on revision 4 directly, or dispatch `boss-architect` on it
  as it stands; a fourth gate round is not worth ~81K opus tokens against a
  0-BLOCKER result). Labels `gate/human` + `escalated` re-added; **state left
  `In Progress`, deliberately not `Todo`** — `Todo` is what re-dispatches, and
  dispatching a fresh agent onto a row awaiting an owner decision is how this run
  began. Read back: `In Progress`, labels `other, heavy, human, escalated`.
- **PR opened — #150**, base `main`, head `claude/item-28f-gate-round3`, stacked
  on #149. No identifier in branch or title, no magic word, the row named in
  prose only. **No `boss-architect` dispatch was made and the constitution is
  untouched** — `git diff --name-only main` is three files, all markdown under
  `docs/swarm/active/`.
- **mitigation test on #150 — held, and this one has a positive control.**
  Opening PR #150 (no identifier in branch or title, no magic word, row named in
  prose only) produced **no attachment on GAM-315 and no state transition**;
  state read back `In Progress`, `attachments: []`.

  **Scoped honestly, because this run already over-claimed once today.** The
  *state* half is confounded exactly as finding B was — the row was already
  `In Progress`, so `start → In Progress` would be a no-op. The *attachment* half
  is **not** confounded, and that is the difference: for PRs a positive control
  exists, since all seven of GAM-304's linked PRs carry a `/pull/` attachment and
  every one of the 13 attachments in round 3's 40-issue sweep is a `/pull/` URL.
  So an empty array after a PR opens is informative, where an empty array after a
  bare branch push was not. **This measures the PR channel only** and says
  nothing about push timing; F1a stays withdrawn.
- **gates run** — `gate-run --require-clean`, on the final branch state, after
  `npm ci` (the container had no `node_modules`; the script refused outright
  rather than reporting six failures that were really one missing install):

  ```
  GATE RUN — 202c6b9 on claude/item-28f-gate-round3 — tree clean
    1 tsc              exit 0  PASS
    2 vite build       exit 0  PASS
    3 format:check     exit 0  PASS
    4 eslint           exit 0  PASS   0 errors, 377 warnings
    5 vitest (full)    exit 0  PASS   83 files / 2162 tests
                                      (no baseline given — regression not checked)
    6 vitest (scoped)      –  SKIP    no scope derivable from the diff
  VERDICT: PASS — 5 of 6 gates. NOT all six: 1 skipped.
  ```

  **Five, not six.** Gate 6 has no defensible scope because the diff contains no
  `src/` file, and gate 5 carried no baseline. **Every figure matches the run on
  #149 exactly** — 83 files / 2162 tests, 0 errors / 377 warnings — which is the
  independent agreement the skill exists to produce, across two containers and
  two agents. These gates say the tree still builds and stays green; they say
  **nothing** about this diff, which is markdown no gate reads.

## Round 3 outcome

**REVISE → escalated to the owner. The constitution is unchanged.** No
`boss-architect` dispatch was made and no fourth gate round was opened, per the
owner's ruling. Awaiting an owner decision on packet revision 4.

Artifacts: PR #150 (stacked on #149), `GAM-315` `In Progress` + `gate/human` +
`escalated`, `GAM-323` filed in `Backlog`.

---

# Run 4 — revision 5: evaluate the mechanism before writing wording

Dispatched 2026-08-10T22:44:48Z by the owner's `In Progress → Todo` move at
22:43:48Z, one minute after the ruling *"have the next revision evaluate your
webhook idea first"*. Branch `claude/item-28f-revision-5-mechanism`, stacked on
`claude/item-28f-gate-round3` (PR #150) for the same reason that branch stacked
on #149 — three runs writing this file on three branches would collide head-on.

- **claimed** — fetched GAM-315 live, `Todo → In Progress`, re-read and
  confirmed `In Progress` (item 28c read-back). Labels `other, heavy`; already
  tiered, so no item 28d judgement was required. `gate/human` and `escalated`
  are **off**, consistent with the ruling's stated sequence.
- **branch renamed before any PR existed** — this run's first branch was
  `claude/gam-315-item-28f-links-only`, which carries the identifier and would
  have closed this row on merge. GAM-315 had **zero attachments** at that
  moment, so the link was still preventable; the remote branch was deleted and
  the work moved to `claude/item-28f-revision-5-mechanism`. Third run running,
  and third run to have to undo its own default branch name — which is itself
  evidence for the packet's convention.
- **prior work read, not re-derived** — PRs #149 and #150, the packet at
  revision 4, this run log, and all six owner comments on GAM-315. The owner's
  ruling to leave #149 and #150 open is honoured; neither is merged.

## Independent re-measurement (item 28 step 6: a recorded figure is evidence, not proof)

Before reading the prior runs' artifacts, this run measured the premise from
scratch. Everything it found **agrees** with runs 1-3, by a different route:
the merge→transition correlation on all of #138-#144, the aggregate-state
behaviour, and the falsity of both of item 28f's operative sentences.

Two observations this run adds:

- **The actor column in Linear's history is not evidence of a human.** Two
  transitions share a timestamp with the attachment that caused them *to the
  millisecond* — GAM-303 `In Review → In Progress` at `15:38:55.013Z` equals
  PR #126's attachment time; GAM-304 `Done → In Progress` at `14:50:55.661Z`
  equals PR #144's. Both are attributed to `USER:George Mitchom`. A future
  investigation that filters this history by actor will conclude a human did it.
- **Item 28f's own cited precedent does not isolate the magic word.** 28f
  offers PR #126/GAM-303 as proof that `Closes` "links **and** closes". #126's
  branch is `claude/next-ready-task-xvmtcj` — no identifier — so the magic word
  supplied the *link* and the team's `merge → Done` automation supplied the
  *close*. The case is fully explained without the magic word closing anything.

## F8 positive control — the owner's bar for Option B, met

The ruling required that F8 (a commit message creates no link) get a positive
control before any design rests on it, because "an empty result is informative
rather than merely absent" only if the instrument is known to fire.

**Commit `c865b51` was inside PR #143.** That single PR provides the positive
and the negative in one webhook delivery, through one query:

| Channel, same PR #143 | Issue | Attachment? |
| -- | -- | -- |
| Branch name `claude/gam-304-rsvp-write` | GAM-304 | **yes** — `13:37:17.125Z` |
| Commit message only (`c865b51`) | GAM-318 | **no** — 0 attachments, 0 transitions |
| Commit message only (`c865b51`) | GAM-319 | **no** — 0 attachments, 0 transitions |
| Commit message only (`c865b51`) | GAM-320 | **no** — 0 attachments, 0 transitions |

The timing confound is eliminated: GAM-318/319/320 were created
`13:33:06-13:33:09Z`, **before** commit `c865b51` (`13:33:21Z`), before PR #143
opened (`13:37:13Z`) and before it merged (`14:00:01Z`). They existed at every
event that could have linked them.

So F8 is no longer one observation. It is **n=3 on the negative side with a
simultaneous positive control in the same delivery** — the instrument
demonstrably fires, and it did not fire for the commit-message channel.

## Live re-test of the automations, during this run

`22:48:28Z` PR #151 opened (branch `claude/gam-304-failure-p3y021`, unrelated
work) → `22:48:31.430Z` GAM-304 attachment → `22:48:31.430Z` GAM-304
**`Done → In Progress`**, same millisecond. Three findings: the automations are
live *now*, not just historically; this is a wrong **reopen** of a closed issue
(the sixth wrong move on GAM-304, and the first of this shape); and it is a
third millisecond-identical attachment/transition pair attributed to
`USER:George Mitchom`.

- **revision 5 written** — `docs/swarm/active/GAM-315-mechanism-comparison.md`.
  Per the owner's ruling this is a **comparison with a recommendation, not
  wording and not an implementation**. Packet revision 4 is left unchanged.
  All five required checks answered; F8's positive control met. Recommends
  **A now + GAM-322 option 1 + B as its own gated row**, with a one-sentence
  amendment to C1 that makes A's text true under either mechanism. Records five
  least-confident decisions and puts the gate question to the owner rather than
  assuming an answer.
- **subagent dispatched** — `general-purpose` on opus, to measure Option B's
  implementation surface (trailer coverage and survival, merge strategy,
  push-workflow visibility, credentials, prior art, blast radius). Measurement
  only; explicitly told not to design and not to edit.
- **subagent verdict** — 29 tool calls, ~46K tokens. **The decisive finding is
  that Option B's stated premise is false.** The owner's proposal opens *"the
  trailer is already there"*; measured, a `Linear-Issue:` trailer is on **30 of
  the last 200 commits (15%)**, on **0 of the last 11 merge commits**, and is
  enforced by nothing. `merge_commit_message=PR_TITLE` is the mechanical reason
  it never reaches the merge commit. Also measured: squash is enabled (the
  owner's Check 2 hazard is one dropdown away), a two-identifier ambiguity case
  already exists in the last 200 commits, the `(Tnnn)` suffix is omitted by 4 of
  7 distinct values, the write-capable key is scoped to a workflow a push cannot
  trigger, and **no `issueUpdate` mutation exists anywhere** — B is a new write
  path, item 26's own HEAVY trigger. One point in B's favour: PR #143, the merge
  that actually mattered, carried the trailer on 8 of 14 branch commits.
  The agent flagged its own limits, including that "72% of merges have no
  trailer" is a coverage figure and **not** a missed-closure figure — recorded
  in the comparison rather than smoothed over.
- **packet updated (bookkeeping only, no wording)** — applied the owner's 22:40
  ruling, which postdates revision 4: `AGENTS.md` added as a fourth Allowed
  File scoped to lines 30 and 37, and the "Deliberately NOT in scope" section
  marked superseded. **New scope question raised, not assumed:** `AGENTS.md:35-36`
  carries a *third* false sentence — *"that magic word both links the issue and
  moves it to `Done` on merge"* — inside the same numbered item, falsified by
  F5. Correcting line 37 alone leaves the paragraph self-contradictory. Asked
  of the owner rather than taken, per round 3's rule that a packet may not
  settle scope by assuming it.

## The convention worked, with a positive control 4 minutes earlier

PRs #149 and #150 both asked to be watched **on merge**. This run produced the
first live test on **open**, and it is a clean paired control in one window:

| PR | identifier in branch/title? | magic word? | GAM attachment created? |
| -- | -- | -- | -- |
| #151 @ `22:48:28` | **yes** (`claude/gam-304-...`) | no | **yes** — GAM-304 `22:48:31.430Z`, and it reopened the row |
| **#152 @ this run** | **no** (`claude/item-28f-revision-5-mechanism`) | no | **no** — GAM-315 still has **zero** attachments |

Read back after opening PR #152: GAM-315 `In Progress`, attachments `0`. So a
PR that names the row in prose only, from a branch carrying no identifier, does
**not** enter the linked set — measured, with a positive control from the same
repository minutes earlier proving the instrument fires.

**This is C3's convention working, not an argument that it will.** It does not
yet test the merge case, which is what #149 and #150 are still open to observe.

- **gates run** — six-gate skill, `--baseline-tests 2162`. Figures below.
- **PR opened** — **#152**, based on `claude/item-28f-gate-round3` (stacked, not
  racing). No identifier in branch or title, no magic word, row named in prose
  only. The `Linear-Issue: GAM-315` commit trailer is present per item 28f and
  is measured (F8, now n=3 with a positive control) not to link.
- **escalated** — comment posted on GAM-315 with the three questions (mechanism,
  gate, `AGENTS.md` scope). Labels `gate/human` + `escalated` restored and read
  back; row deliberately left `In Progress`, **not** `Todo`, because `Todo`
  re-dispatches it and that is how runs 3 and 4 both began. Evidence comment
  added to GAM-322 for the reopen; that row's option set is not rewritten.
