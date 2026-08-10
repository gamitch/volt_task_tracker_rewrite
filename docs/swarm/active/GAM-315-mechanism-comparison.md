# GAM-315 revision 5 — which mechanism, before any wording

**This is a comparison with a recommendation. It is not an implementation and it
is not constitution wording.** The owner ruled on 2026-08-10, verbatim:

> have the next revision evaluate your webhook idea first

and directed that no 28f wording be written until the mechanism question is
answered, because the wording is downstream of it.

Packet revision 4 (`GAM-315-packet.md`) is unchanged and remains Option A's
prescription. Nothing in it has been dispatched; the constitution is untouched.

---

## Recommendation, up front

**Adopt neither in full. Take Option A now, and file Option B as a separate,
owner-gated row — with one narrow change to A's prescription.**

The reasoning is below and the recommendation is defeasible, but the short form:

- Option B removes the *class* of bug, which is the strongest argument on the
  row and it is a real one.
- **But B's stated premise — "the trailer is already there" — is measurably
  false.** The trailer is on 15% of the last 200 commits, on **zero** of the
  last eleven merge commits, and is enforced by nothing. B needs a
  trailer-enforcement CI check before it can work at all, which the proposal
  does not include. See § "Measured implementation surface".
- But B's failure mode is **silent and worse than A's**: a wrong trailer closes
  a wrong issue with nothing a human can see. A's wrong closes at least
  correlate with a branch name visible in `git branch`. Substituting an
  invisible failure for a visible one is not obviously a win, and this row
  exists because a *silent* wrong close is the worst failure this tracker has.
- B does not need to block A. A is three prose edits that are true under both
  mechanisms once one sentence is conditioned. Holding the false sentence in the
  constitution while a workflow is designed, reviewed and gated is the more
  expensive error — **item 28f is false today and every day it stays false an
  agent may act on it.**

**The one change to A:** C1 must not re-justify `Closes GAM-nnn` in terms that
B would falsify a second time. See § "Check 4" — this is the only place the two
options actually conflict, and it costs one sentence to make A B-proof.

---

## The baseline is still live, and it got worse during this run

Measured at 22:48 on 2026-08-10, while this revision was being written:

```
22:48:28.000Z  PR #151 opened (branch claude/gam-304-failure-p3y021)
22:48:31.430Z  GAM-304 attachment created for PR #151
22:48:31.430Z  GAM-304  Done -> In Progress        <- same millisecond
```

Three things follow, and all three matter to the comparison:

1. **The three automations are on right now**, not merely historically. Any
   comparison that treats the current behaviour as settled history is wrong.
2. **`start → In Progress` reopened an issue that was `Done`.** The catalogue
   on this row has been counting wrong *closes*; this is a wrong *reopen*, and
   the sixth wrong move overall. It was caused by a PR that does none of
   GAM-304's work, on a branch merged long ago and reused.
3. **A third millisecond-identical attachment/transition pair**, attributed to
   `USER:George Mitchom`. Three independent instances now (GAM-303 15:38:55.013,
   GAM-304 14:50:55.661, GAM-304 22:48:31.430). The actor column is not
   evidence of a human, and anything reading this history must be told so.

## F8 now clears the owner's bar

The ruling set a specific condition on Option B:

> Option B rests on exactly one measured fact — **F8** … **One observation is
> not enough to build a closing mechanism on.** If B is recommended, F8 needs a
> positive control.

**It has one, and the control is inside the same webhook delivery.** Commit
`c865b51` — F8's original subject — was a commit *in PR #143*:

| Channel, all within PR #143 | Issue | Attachment |
| -- | -- | -- |
| Branch name `claude/gam-304-rsvp-write` | GAM-304 | **yes**, `13:37:17.125Z` |
| Commit message only, `c865b51` | GAM-318 | **no** — 0 attachments, 0 transitions |
| Commit message only, `c865b51` | GAM-319 | **no** — 0 attachments, 0 transitions |
| Commit message only, `c865b51` | GAM-320 | **no** — 0 attachments, 0 transitions |

Timing confound eliminated: GAM-318/319/320 were created `13:33:06–13:33:09Z`,
**before** `c865b51` (`13:33:21Z`), before PR #143 opened (`13:37:13Z`) and
before it merged (`14:00:01Z`). They existed at every event that could have
linked them.

So F8 is n=3 on the negative side with a simultaneous positive in the same
delivery. **The instrument demonstrably fires and it did not fire for the
commit-message channel.** The owner's bar is met — B is not disqualified on this
ground, and the run log records the method.

**One residual, stated rather than buried:** this shows a commit message does not
create a *Linear attachment or state change*. It does not show GitHub's own
`Closes #nnn` issue-closing is unaffected, which is a different system and out
of scope here.

---

## Check 1 — cost and blast radius

| | Option A — correct the wording | Option B — replace the mechanism |
| -- | -- | -- |
| Repo change | 4 prose files, no code | 4 prose files **plus** a new workflow + secret wiring |
| Outside the repo | none | disable 3 Linear automations (irreversible-ish; owner-only) |
| Reviewable by | reading | reading **plus** a live end-to-end test against the real tracker |
| Fails when | an agent names a branch carelessly | a trailer is missing, wrong, or dropped by a squash |
| Failure visibility | wrong issue named in the branch — **visible in `git branch`** | wrong issue named only in a trailer — **visible nowhere a human looks** |
| Reverts by | editing prose | re-enabling automations *and* removing the workflow, having lost the interim state |

A is inert. B touches a live tracker with a write-capable key on every push to
`main`, which is a materially larger blast radius than anything this row has
contemplated so far.

*(Implementation-surface measurements — merge strategy, trailer survival,
existing workflows, credentials — are recorded in § "Measured implementation
surface" below. They are the strongest evidence in this document and they cut
against B.)*

## Check 2 — the squash-merge case

The owner already identified the hazard: *"Read trailers from the pushed
commits, not the merge commit — a hand-edited squash body can drop a trailer."*

This is the single most likely way B fails quietly, and it is not hypothetical
in this repository: **PR bodies here are routinely hand-written at length**, and
several carry warning banners as body line 1. A squash body is the PR body by
default. An agent that writes a careful warning banner and loses the trailer
below it produces a merge that closes nothing — or, worse, a body assembled from
a *different* PR's template that closes the wrong row.

Reading `github.event.commits` on the push event avoids the hand-edited body,
**but only if the merge preserves the branch commits.** A squash does not: it
produces exactly one commit on `main` whose message is the squash body. So under
squash-merge, "read the pushed commits" and "read the merge commit" are the same
thing, and the mitigation the owner named is unavailable.

**This is decisive for the design and is measured, not assumed** — see
§ "Measured implementation surface".

## Measured implementation surface

Measured 2026-08-10 by a delegated agent against the real repository and the
GitHub API. Every figure below is from a command that was run.

### The finding that matters most: B's stated premise is false

The proposal opens: *"**The trailer is already there.** `Linear-Issue: GAM-nnn
(Tnnn)` appears on merged commits today; item 28f already requires it."*

**Measured, it is mostly not there.**

| Measurement | Result |
| -- | -- |
| Last 200 commits on `main` carrying a `Linear-Issue:` trailer | **30 (15%)** |
| Merge commits (of 46) carrying one | **4** |
| PRs #138-#148 whose **merge commit** carried one | **0 of 11** |
| PRs #138-#148 with a trailer on any **branch** commit | **2 of 11** |
| Recent merges with **no** trailer anywhere in the pushed range | **33 of 46 (72%)** |
| CI checks enforcing the trailer | **none** — `grep -rn "Linear-Issue" .github/` finds one comment |

The mechanical reason the trailer never reaches the merge commit is measured
too: the repo's `merge_commit_message` setting is **`PR_TITLE`**, so the PR body
— where the trailer is written — is never copied into the merge commit.

**Be careful what this does and does not show.** It is a statement about
*coverage*, not about missed closures: many of those 46 merges are chores that
should close nothing, and a merge with no trailer fails **safe** under B (the
issue sits visibly in `In Review`). The load-bearing point is narrower and
survives that caveat: **B's reliability rests on a convention that is currently
followed about 15% of the time and enforced nowhere.** Adopting B therefore
carries a prerequisite the proposal does not mention — a CI check that fails a
PR with no trailer — and that is new scope, not free.

In B's favour, honestly: **the one merge that actually mattered would have
worked.** PR #143, the real GAM-304 fix, carried the trailer on 8 of its 14
branch commits.

### The other measurements

- **Squash is live.** All three merge methods are enabled. Every one of
  #138-#148 landed as a true 2-parent merge commit, so branch commits are
  readable *today* — but nothing prevents the next merge being a squash, which
  collapses them into one hand-editable body. **The hazard the owner named in
  Check 2 is not hypothetical; it is one dropdown away**, and the mitigation
  ("read the pushed commits, not the merge commit") is unavailable the moment it
  happens.
- **A real ambiguity case already exists.** One merge range in the last 200
  contained **two distinct** trailer identifiers (GAM-309 and GAM-310). A naive
  "read the trailer, set that issue" rule has no answer for it.
- **The trailer format is inconsistent.** 4 of the 7 distinct values omit the
  `(Tnnn)` suffix item 28f prescribes, so a regex demanding it would miss most
  of them.
- **Two workflows already fire on push to `main`** (`ci.yml`,
  `linear-export.yml`). Only `claude-linear-dispatch.yml` sets `fetch-depth: 0`;
  every other checkout is shallow, so a new workflow must set it itself to read
  branch commits at all.
- **`linear-export.yml` commits back to `main` on every push to `main`.** A new
  push-triggered workflow would fire on those bot commits too. Harmless (no
  trailer) but it must be guarded, and `[skip ci]` does not suppress it.
- **The write key is not wired for this.** `LINEAR_API_KEY` is deliberately
  read-only; the write-capable `LINEAR_DISPATCH_API_KEY` is scoped to the
  `repository_dispatch` workflow, which a push cannot trigger. B needs the write
  key on a push-triggered workflow — a genuine widening of what a push to `main`
  can do.
- **No `issueUpdate` mutation exists anywhere in the repo.** The transport
  (`gql`) and the state-name→UUID lookup are prior art; **the state write is
  not.** B is a new write path, which is item 26's own HEAVY trigger.
- **No loop risk at the `Done` edge** — good news for B. The dispatch workflow
  fires only on a transition *into* `Todo` for `tier/*`-labelled rows, so a
  workflow setting `Done` cannot re-trigger it.

### Unmeasured, and the agent said so

- The runtime push payload was never observed — no workflow reads
  `github.event.commits`. GitHub's documented **20-commit cap** on that array is
  untested here, and **PR #143 pushed 15 commits**. One larger PR truncates it
  silently. Reading `git log before..after` with `fetch-depth: 0` avoids the cap
  but was not verified against this repo's pushes.
- `LINEAR_DISPATCH_API_KEY`'s write scope is asserted in a code comment, not
  verified.
- Whether the five wrong closures would have been *prevented* by B was not
  established from git.

**Net effect on the comparison: B is a larger piece of work than proposed.** It
is not "a workflow plus a settings change" — it is a workflow, a new write path,
a credential rewiring, a trailer-enforcement CI check, an ambiguity rule, a
format fix, and a squash-merge decision. Each is tractable. Together they are a
project, and none of them has had a premise gate.

## Check 3 — what replaces `start → In Progress` and `review → In Review`

**Nothing needs to. Both are already duplicated by rules agents must follow by
hand, and one of them is the defect.**

- `start → In Progress` duplicates **item 28c**, which requires the agent to
  move `Todo → In Progress` itself *and read it back*, because Linear has no
  compare-and-set. The automation cannot satisfy 28c — a claim the agent did not
  make is not a claim. And this automation is precisely what produces the
  backwards move (F3) and the reopen measured above.
- `review → In Review` duplicates **item 28e**, which requires the agent to move
  the issue to `In Review` on completion and forbids it moving to `Done`.

So removing these two is a **simplification, not a gap** — with one honest
exception: today they provide a crude backstop when an agent dies mid-run
without updating the row. That backstop is worth little (it sets state on
evidence the agent never produced) and this row's own history shows it doing
harm, but it is a real loss and should not be waved away.

`merge → Done` is the only one doing work no rule duplicates — and it is the one
Option B replaces.

**Consequence: Option B's scope is smaller than it first looks.** It does not
need to reproduce three automations. It needs to reproduce one.

## Check 4 — does item 28f still need correcting either way?

**Yes under both — and this is the one place the two options actually conflict,
so it changes A's prescription.**

The owner asserted "It does." Confirmed, with the specific reason, which is
sharper than "the correction is shorter under B":

Item 28f makes two operative claims. Under B they do **not** both improve:

| 28f's claim | True today? | True under B? |
| -- | -- | -- |
| "An identifier in the title or branch name **links only**" | **false** (it closes) | **becomes true** — *if* linking survives; see below |
| "…leaves the issue sitting in `In Review` after merge" | **false** (it leaves it `Done`) | **becomes true** |
| "`Closes GAM-nnn` … links **and** it closes" | **false** (the automation closes) | **stays false** — the *trailer* would close |

The "becomes true" column assumes disabling the three automations stops state
changes without stopping linking. That assumption is **reasoned, not measured**
and is flagged in Check 5. If linking also stopped, 28f's first sentence would
be false in the opposite direction and B's correction would be *different*
again, not shorter. Either way the row still needs correcting, which is the
question being answered here.

So B fixes two of the three sentences by accident and leaves the third wrong —
and it makes the third wrong *in a new way*, because agents would keep writing
`Closes GAM-nnn` believing it operative while the trailer silently governs.

**This is the conflict, and it is cheap to neutralise.** Packet revision 4's C1
says: *"Keep the `Closes GAM-nnn` requirement, re-justified honestly: it is the
explicit human-readable record of which PR is the work…"* That justification is
**already mechanism-independent** and survives B intact. What must change is one
instruction: C1 must state that `Closes` is a *declaration of intent for human
readers*, and must **not** re-attach any closing behaviour to it — not the
automation's, and not a future workflow's. Written that way, A's text stays true
if B ever lands.

**Recommended amendment to C1 (one sentence, no new measurement required):**
> Say what closes the issue *by naming the mechanism and dating it*, not by
> attributing it to a token in the PR body. If the mechanism changes, one dated
> sentence changes; the `Closes` requirement does not.

## Check 5 — does least-confident decision #2 evaporate under B?

**Mostly, and the owner's instinct is right — but not entirely, and a new
uncertainty replaces it.**

LCD #2 asks whether "give mention-work its own issue" is cheaper than the
tracker noise it creates. That trade exists **only because a spurious link can
cause a wrong close.** Under B nothing computes from the linked set, so a
spurious link is harmless and the convention stops being load-bearing for
correctness. The trade-off the packet asks the owner to judge does evaporate.

What does **not** evaporate:

- Attachments probably still accumulate on the issue under B, so GAM-304 would
  still show eight PRs, five of which are not its work — cosmetic rather than
  dangerous, which is exactly the demotion B buys.

  **⚠ Reasoned, NOT measured.** This rests on linking and state-setting being
  separate systems: attachments are `issue.attachments` records, while the state
  rules are distinct `team.gitAutomationStates` entities, and the two are
  separately represented in Linear's data model. That is structural evidence,
  not behavioural proof — **only the owner can disable an automation and observe
  the result**, so this cannot be measured from here. It is flagged because
  three gate rounds on this row died on claims exactly this shape.
- `WORKFLOWS.md` rule 2's identifier-in-branch requirement stands on its
  original rationale (collision avoidance, human readability), untouched by
  either option.

**And a new least-confident decision appears under B**, which should be recorded
rather than inherited silently: *that a trailer is more reliably correct than a
branch name*. Both are written by the same agent at the same moment. B's premise
is that a trailer is harder to get wrong — but nothing measured on this row
supports that, and a trailer is **less** visible to review than a branch name.

---

## The case against Option B, stated as strongly as it deserves

B is genuinely attractive and the owner's reasoning for it is sound: it is
fail-safe in the missing-trailer direction, and it removes a class of bug rather
than documenting it. Three counter-arguments, in descending strength:

1. **B converts a visible failure into an invisible one.** A's wrong closes were
   found because a human noticed a branch name that did not match the work. A
   wrong *trailer* has no such tell — it is one line in a commit message nobody
   re-reads, driving a state change attributed to a bot. This row exists because
   "`Done` is the one state nobody re-reads." B does not fix that; it removes the
   one clue that led to the discovery.
2. **B is a write-capable automation designed on this subject.** Every one of
   three gate rounds, plus the orchestrator running the third, produced an
   unmeasured claim about exactly this mechanism. The response to "this topic
   reliably generates confident claims nobody measured" should not be "so let us
   build an automation on it" without a gate — and no gate round is authorized.
3. **B's cheapest benefit is available without B.** The measured harm is
   overwhelmingly from `start → In Progress` (the backwards move, the reopen),
   not from `merge → Done`. Deliverable B / GAM-322 already recommends disabling
   exactly that one automation. **That single owner click removes the two worst
   observed failures at zero engineering cost**, and it is compatible with A, B,
   or neither.

**That last point is the most useful thing in this document.** The comparison as
framed — A versus B — omits the cheapest option on the table.

## What this means for GAM-322

Per the ruling, noted here rather than rewritten there: if B is adopted,
GAM-322's option set changes from "scope the automations" to "turn them off."
**If the recommendation above is taken instead, GAM-322 is unchanged and becomes
the highest-value row of the three** — its option 1 (disable
`start → In Progress`) is the recommendation's first component.

## Recommendation in full

1. **Now, no gate needed:** ship Option A (packet revision 4) with the one-line
   C1 amendment in Check 4. Item 28f stops being false.
2. **Now, owner-only, one click:** act on GAM-322 option 1 — disable
   `start → In Progress`. Removes the backwards move and the reopen.
3. **Later, as its own row with its own gate:** Option B. It is a real
   improvement and should not be discarded — but it is a write-capable
   automation against a live tracker, and it deserves a premise gate that this
   row is explicitly not authorized to run. Its row should carry the measured
   prerequisites: a trailer-enforcement CI check (15% coverage today), a rule
   for the two-identifier ambiguity case that already exists, the optional
   `(Tnnn)` suffix, a squash-merge decision, and wiring the write-capable key
   to a push-triggered workflow. **It is a new write path, which is item 26's
   own HEAVY trigger** — so it gets the full chain regardless of how small the
   YAML looks.

## Least confident decisions in this comparison (item 19d)

1. **That A and B are separable at all.** Recommended on the argument that A's
   text can be made B-proof by one sentence. Wrong if the owner intends B
   imminently, in which case writing A's wording twice is the waste.
2. **That the visible-vs-invisible failure argument outweighs fail-safety.** It
   is a judgement about which failure a human catches, not a measurement.
   *Partly resolved since drafting:* trailers are **not** near-perfectly
   reliable (15% coverage, unenforced), which strengthens this. But note the
   direction — a *missing* trailer fails safe, so the coverage figure argues B
   is ineffective, not that it is dangerous. The danger case is a *wrong*
   trailer, and its frequency is **not measured** because it has never run.
3. **That disabling `start → In Progress` is safe.** It rests on Check 3's
   reading that items 28c and 28e already duplicate it. Wrong if any tooling
   reads `In Progress` as a signal set by something other than the agent — not
   exhaustively checked across `.github/workflows/`.
4. **That B needs a gate round and A does not.** Defensible — A has had three
   rounds and B has had none — but it is also convenient for a run that cannot
   authorize a fourth round. Named so the owner can overrule it.
5. **That this document is not itself a re-plan requiring a gate.** The ruling
   says revision 5 is "a change of question", not a re-plan, and that if a gate
   is judged necessary the run must *ask* rather than assume. **This run judges
   one is not required for A**, whose prescription is unchanged but for one
   sentence — but the question is put to the owner explicitly in § "What this
   run is asking for", below.

## What this run is asking for

One ruling, three parts:

1. **Mechanism:** A now, B as its own gated row, plus GAM-322 option 1 — or
   overrule and take B.
2. **Gate:** whether the one-sentence C1 amendment in Check 4 needs a fourth
   premise-gate round. **This run has not opened one and will not.**
3. **Dispatch:** if A is approved, whether `boss-architect` may be dispatched on
   revision 4-as-amended without further review.
