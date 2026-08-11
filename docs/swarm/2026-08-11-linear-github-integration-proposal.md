# 2026-08-11 — Evaluation of the Linear ↔ GitHub integration, and a proposal to replace semantic automation with explicit event-driven sync

**Status: PROPOSAL, for owner review. Nothing in this document changes any code, any
Linear setting, or any constitution wording.** The build it proposes is a new write
path against the live tracker, which is item 26's own HEAVY trigger — it gets a
premise gate and its own row before a line of it ships. What this document asks the
owner to decide is listed in §11, and every factual claim below carries its source.
An adversarial verification pass ran against a draft of this document (§12); its
corrections are folded in.

Written in response to the owner's request, verbatim:

> _"Currently our setup with Linear, Github and Claude 'automates' movment of tickets
> in Linear using semantics. texts in the pr title and other text methods. I'd like to
> propose a better integration that would utilize something more durable and
> predicatble such as webhooks or another event driven integration that would yield
> better more dependable actions"_

This is the same question the owner asked on GAM-315 on 2026-08-10 — _"can we not
have something like a webhook that when the main pr closes, it triggers an update to
linear to close the ticket? why rely on text searches?"_ — now asked at the scale of
the whole integration. The GAM-315 mechanism comparison answered the narrow version
(trailer-driven closing, assessed and deferred); this document answers the broad one.

---

## 1. Method

Four research passes ran on 2026-08-11, in parallel, followed by a four-checker
adversarial verification pass (§12). Everything below is grounded in one of them:

| Pass | Source | What it read |
| --- | --- | --- |
| Repo evidence | this repository | constitution item 28 (corrected text), the webhook design doc, the GAM-315 packet/run-log/mechanism-comparison/deliverable-B, WORKFLOWS.md, AGENTS.md, all four workflows, all `scripts/linear*` code |
| Linear live | Linear MCP (read-only) | workspace/team config, workflow states, labels, `gitAutomationStates`, state history + comments on GAM-303/304/308/310/315/322, `list_diffs`, Linear's own docs search |
| GitHub live | GitHub MCP (read-only) | all 30 PRs #124–#153 with bodies, branch commits of 4 merged PRs, full run history of `claude-linear-dispatch.yml` (11 runs) and `linear-export.yml` (26 runs), workflow inventory |
| Vendor docs | web (primary sources) | linear.app/docs + /developers (GitHub integration, webhooks, GraphQL, agents, Slack, Diffs), docs.github.com (events, tokens, branch protection), Slack docs. The GitHub-integration page serves a JS shell to plain fetches; the owner supplied section anchors on 2026-08-11 that unlocked its full text, and §4.2/§7 cite it directly |

---

## 2. Inventory — the integration is five mechanisms, not one

| # | Mechanism | Direction | Nature | Verdict |
| --- | --- | --- | --- | --- |
| 1 | `linear-dispatch` webhook chain (Linear webhook → Supabase edge fn → `repository_dispatch` → claude-code-action) | Linear → work | **Event-driven, explicit, filtered, signed** | **Keep.** Proven live; 11 runs. Gaps are observability, not mechanism (§4.5) |
| 2 | Linear's native GitHub **team** automations: `start → In Progress`, `review → In Review`, `merge → Done`, all unscoped | GitHub → Linear state | **Semantic** — infers intent from identifier text in branch names / PR titles / magic words | **Replace.** The subject of this proposal |
| 3 | Linear's **personal** automations: "move issue to a started status on git branch copy" + auto-assign (Settings → Account → Code & reviews, per user) | UI gesture → Linear state | Semantic/gesture-driven; **enabled-state unknown here** | **Owner to check** (§8 Phase 0). Candidate cause of the one unexplained move (§4.1 row 11) |
| 4 | `linear-export.yml` (git-side backup) | Linear → git | Scheduled + push-triggered healing job | Keep. 24/26 runs green; the 2 failures landed 13 s apart in a three-merge push race, benign |
| 5 | Agents' own state moves (claim `Todo → In Progress`, finish `→ In Review`) via ad-hoc GraphQL over `scripts/linear/client.mjs` | agent → Linear | Explicit, rule-governed (items 28c/28e) | Keep. This is already the explicit model §6 extends |

Two further vendor mechanisms are documented and **deliberately not in use** — named
here so nobody enables one into a single-writer design by accident: the
workspace-level **commit-linking toggle** ("Link commits to issues with magic
words" — when on, a magic-worded commit moves an issue to `In Progress` on push and
`Done` on reaching the default branch, bypassing PRs entirely), and **GitHub Issues
sync**, whose two-way mode syncs *status* among its properties — a second
independent writer to issue state. Neither is *known* to be off — what is measured
(§4.2) is that end-to-end commit linking is **inert**; the toggle's own state is
unknown until Phase 0 reads it. And the commit-linking toggle is the sharper hazard
by far: **item 28f's required trailer `Linear-Issue: GAM-nnn` contains
`linear issue`, which is on Linear's *closing* magic-word list** (PR #154's hazard
note). Whether the hyphenated form matches the parser is unverified in both
directions — but if it does, enabling that toggle turns the traceability trailer
riding on dozens of merged commits into closing instructions. §8 Phase 0 checks
this toggle *first*, not as an aside.

The thing the owner is unhappy with is mechanism 2 — and only mechanism 2. The
inbound half already is the durable, webhook-driven design being asked for; the
outbound half is text inference, and it is the source of every attributed failure.

---

## 3. What already works: the inbound dispatch webhook

For contrast, the shape of the half worth keeping (built for GAM-310, live since
2026-08-09, design and evidence in `docs/swarm/2026-08-09-linear-webhook-dispatch.md`):

```
owner drags GAM-nnn  Backlog → Todo
        │  Linear webhook (Issues, team Gamitch) — HMAC-SHA256 over raw body
        ▼
supabase/functions/linear-dispatch     verify → parse → filter (8 rules,
        │                              every skip carries a named reason)
        ▼
repository_dispatch → claude-linear-dispatch.yml → claude-code-action
```

Why it is dependable, in exactly the ways mechanism 2 is not: the trigger is an
**explicit human gesture** (a drag into `Todo`), the payload is **verified before it
is parsed**, every decision is **enumerated and named** (45 tests — 30 of them
asserting the filter's skip reasons — and four guard mutations shown red), and the
state transition it reacts to is read from `updatedFrom.stateId` — a structured
field, not text. Run history: 11 dispatches, 9 success / 1 failure / 1 cancelled,
and both failures produced measured fixes (turn cap 80→300, timeout 60→120).

The replacement in §6 deliberately copies this design grammar.

---

## 4. What fails: the semantic outbound automations

### 4.1 The failure catalogue

Every documented wrong move, all within ~48 hours of the automations being live, all
from `docs/swarm/active/GAM-315-*` and the issues' own state histories (each row
re-verified against those records on 2026-08-11; the automations were still firing
as of 2026-08-10 23:36:32 UTC, when the merge of PR #153 auto-closed GAM-315 two
seconds later):

| # | When (UTC) | Issue | What happened | Cause |
| --- | --- | --- | --- | --- |
| 1 | 08-10 04:02 | GAM-304 | **Wrong close** — PR #138 (CI salvage work, none of GAM-304's code) merged; issue → `Done` +2s | branch `claude/gam-304-failure-p3y021` carries the identifier |
| 2 | 08-10 04:56 | GAM-304 | **Wrong close** — PR #139 merged | same branch |
| 3 | 08-10 05:29 | GAM-304 | **Wrong close** — PR #140 merged; its body line 1 is literally "This PR does not close GAM-304" | branch `claude/gam-304-wire-rsvp-controls` |
| 4 | 08-10 11:54 | GAM-304 | **Wrong close** — PR #141 merged (the one clean branch-name-only exhibit: no title identifier, no magic word) | branch name alone |
| 5 | 08-10 14:00 | GAM-304 | **Backwards move** `In Review → In Progress` — caused by the merge of PR #143, **the issue's actual fix**, because PR #142 was still open and `start → In Progress` outranks `merge → Done` while any linked PR is open | aggregate-of-linked-PRs rule |
| 6 | 08-10 14:50 | GAM-304 | **Wrong reopen** `Done → In Progress` — PR #144 *opened* | same branch as #1 |
| 7 | 08-10 14:56 | GAM-304 | **Wrong close** — PR #144 merged | same |
| 8 | 08-10 22:48 | GAM-304 | **Wrong reopen** `Done → In Progress` — PR #151 opened on the *reused* branch from #1, doing entirely unrelated work | stale branch name |
| 9 | 08-09 21:34 | GAM-310 | **Wrong close** — PR #132 merged with the identifier in its title and in a negated body sentence ("Deliberately not `Closes GAM-310`"), none in the branch, 3 of the issue's 7 steps done; reopened by hand 4m48s later | title link and/or the negated magic-word token — PR #154 settled against Linear's docs that **both channels link independently**, so the "disjunction" was never one; falsified old item 28f either way |
| 10 | 08-09 15:38 | GAM-303 | **Backwards move** `In Review → In Progress` the millisecond PR #126 attached (~2.5 min before its merge) | `start` automation on link |
| 11 | 08-10 02:23 | GAM-304 | `Backlog → In Progress` with **no attachment and no PR** — cause never established. New candidate (2026-08-11, from vendor docs): the **personal** "move to started status on git branch copy" automation (§2 row 3), which produces exactly this signature if the owner copied the branch name with that toggle on. Testable: check the toggle | unexplained |
| 12 | 08-10 22:55 | GAM-304 | **Wrong close** — PR #151's *merge* re-closed the issue its own open had wrongly reopened seven minutes earlier (row 8); one PR, two wrong moves | same stale branch |
| 13 | 08-11 00:27 / 00:47 | GAM-315 | **Wrong reopen, then re-close** — PR #154 (that issue's own documentation fix, its branch deliberately carrying the identifier as the corrected rule requires) reopened the `Done` row on open at 00:27:43.931 and re-closed it on merge at 00:47:24.218 — the row-8 class firing on the very row that documents it, while this proposal was in review. Bonus measurement: `completedAt` stayed frozen at the original 23:36:32 close through both moves; only the state history records them (§6.3 pins the sweep to state history for exactly this reason) | identifier branch on a `Done` issue |

Thirteen wrong moves attributable to the team automations (rows 12–13 added
2026-08-11 from the post-merge reviews, timestamps reviewer-supplied and consistent
with the PR events), plus one that remains unexplained, across three issues. The owner hand-corrected GAM-304 and GAM-310.
Additionally, the audit trail lies twice over: automation transitions are attributed
to the PR author's mapped Linear user — the merge-coincident closes above (landing
2–3 s after their merges) read **"George Mitchom"** in Linear's history although all
were automation firings — and the three attach-time transitions (rows 6, 8, 10) are
millisecond-identical with their attachment records (15:38:55.013, 14:50:55.661,
22:48:31.430), so neither the actor column nor the timestamps distinguish a human
act from an automation.

### 4.2 Root causes — why this is a class, not a bug list

**RC1 — Linking is inference from free text.** Per Linear's own docs
(linear.app/docs/github), a PR links when the identifier appears in the **branch
name**, the **PR title**, or beside a **magic word** in the description or title;
with a workspace toggle, magic-worded **commit messages** link too — measured
*inert end-to-end* here, on the strongest evidence available (post-merge review,
2026-08-11): PR #125 referenced GAM-303 **only** via a commit carrying
`Closes GAM-303` — no branch identifier, placeholder title, silent body — and
GAM-303 has exactly one attachment (#126), with positive controls including
attachment to an already-`Done` issue; F8's bare-identifier commits are the weaker,
earlier negative, and the toggle's own state remains unknown until Phase 0 reads it;
"Magic words in PR comments won't create links." The only suppression the vendor
offers is itself another text convention — _"To prevent a specific issue from being
linked automatically, use `skip` or `ignore` with that issue ID"_ — documented,
never known to this project during the failures above, and enforced by nothing.
There is no structural way to say "this PR merely *mentions* GAM-304"; any
occurrence in a linking channel is read as intent unless yet more text opts out.

**RC2 — State is computed from the aggregate linked-PR set.** `merge → Done` fires
when the **last open linked PR** merges — any linked PR, not the work. `start → In
Progress` fires on any linked PR opening, and outranks the merge rule while another
linked PR is open — which is how an issue's own fix moved it backwards (row 5).

**RC3 — The scoping that would help is vendor-documented as impossible.** Linear's
docs state: _"Branch rules apply only to target branches—the branch a PR is being
merged into. Automations are not supported for source branches, the branch the PR is
created from."_ (The feature exists for multi-environment pipelines — their example
maps merges to `staging`/`main` onto "In QA"/"Deployed".) Every PR here targets
`main`, so no head-branch naming scheme can scope the automations — confirming what
GAM-322 had established from the API schema.

**RC4 — Failures are silent and misattributed.** No notification exists anywhere in
the chain — not for a wrong close, not for a skipped dispatch. `Done` is, in
deliverable B's words, "the one state nobody re-reads."

### 4.3 The convention tax — what semantics costs even when it works

Because any identifier occurrence is treated as intent, the project has had to build
an avoidance discipline: 11 of the last 30 PRs are **deliberately identifier-free**
(#149/#150/#152 open with a paragraph explaining their own branch naming), four
GAM-315 sessions faced the branch-name decision — three renamed off the identifier,
and the fourth (PR #154) kept it deliberately, the first case where that was
correct under the corrected rule, at the accepted cost of catalogue row 13 —
WORKFLOWS.md rule 2 now carries a mention-vs-work sub-rule with a
"same sentence as close/fix/resolve" phrasing guide, and item 28f spends ~40 lines
teaching agents what text is safe to write where. That is process spent protecting
the tracker *from* the automation; §6.5 states honestly which parts of it §6
retires and which one survives in a smaller, gate-enforced form.

### 4.4 What semantics got right — kept honestly

With exactly **one** linked PR the three automations produce the intended lifecycle:
GAM-308 went `Todo → In Progress → In Review → Done` with no wrong moves. The
single-PR case works; the design fails on multiplicity and on mention. Also true:
`start → In Progress` and `review → In Review` merely duplicate what items 28c/28e
already require agents to do by hand, so a replacement owes nothing there (GAM-315
mechanism comparison, Check 3). **Only `merge → Done` does work no rule duplicates —
the replacement has to reproduce one transition, not three.**

### 4.5 Known gaps on the inbound half (for completeness)

Not failures of mechanism, but recorded so this document is the full evaluation:
(a) nothing tells the owner a dispatch was **skipped** — the design doc calls this
"the sharpest open item"; (b) an issue created directly in `Todo` is not dispatched
(rule 2 requires a state *transition* — deliberate, but a plausible accident is
silent); (c) an agent that dies leaving its issue `In Progress` strands it where the
`Backlog → Todo` webhook can never re-dispatch (recovery: re-drag); (d) whether
Linear re-stamps `webhookTimestamp` on its 1 h/6 h retries is unverified — if not,
late retries die in the 60 s replay window. §6.6 closes (a); the rest stay open,
tracked, and are not made worse by anything here.

---

## 5. Requirements for the replacement

Derived from §4, each traceable to a failure it prevents:

- **R1 — Explicit declaration through one enforced channel.** A PR's linked issue
  is *declared*, once, in a single machine-read channel — never inferred from
  titles, branch names, commits, or free prose. Stated honestly (post-merge review
  finding): the channel is still text — a strict parse of one anchored position —
  so this is an **enforced declaration channel**, not structured metadata; what
  changes the failure class is one channel, one shared parser, a CI gate, and
  preconditions, not the medium. §6.2 records why structured alternatives lost. (RC1)
- **R2 — Exactly one issue per PR.** Multiplicity is rejected loudly, not resolved
  by an aggregate rule. The live counterexample (post-merge review): PR #153 fixed
  two rows by owner ruling and could declare one — GAM-323 sits in `Backlog` today
  with its defect fixed. §6.3's `Also-fixes:` advisory line handles folded-in work
  without widening the closing channel. (RC2)
- **R3 — Event-driven.** State moves happen on the PR lifecycle event itself
  (merge), not on polling and not on text re-scans.
- **R4 — Validated, precondition-checked, at-least-once writes with a durable
  claim record.** The mover verifies the issue exists and is in an expected state
  before writing, re-reads after writing (the read-back item 28c already demands of
  claims), and is safe to re-deliver. Stated precisely (post-merge review finding):
  the two Linear writes cannot be atomic, so processing is **at-least-once**, made
  safe by ordering — the audit comment is written *first* as the durable claim
  record, then the state mutation, then read-back — plus a per-issue workflow
  `concurrency` group serializing concurrent merges (§6.3).
- **R5 — Audited.** Every state move leaves a comment on the issue naming the PR,
  the event, and the mechanism — because Linear's actor column is proven unreliable.
- **R6 — Loud on every refusal.** Every skip and every failure is named and
  notified (Slack); a silent no-op that looks like success is this project's
  recorded recurring defect. Under the `pull_request_target` trigger (§6.3) even
  fork-PR runs carry secrets and reach Slack — the earlier fork carve-out
  dissolves; the GitHub Slack app's workflow subscription remains the independent
  witness for runs that die before their first post. (RC4)
- **R7 — Free.** Nothing that costs money. Slack is allowed. (Owner's constraint,
  2026-08-11; consistent with item 25's "please keep it simple".)

---

## 6. Proposed design

### 6.1 Shape

Replace the three native automations with **one explicit closer**, built from parts
already proven in this repo, plus a CI gate that makes the declaration reliable and
a Slack channel that makes every decision visible:

```
PR merged into main
        │  GitHub Actions: on pull_request_target (types: closed, branches: main)
        │  — workflow, checkout, and parser all from main's version, by construction
        ▼
scripts/linear-sync.mjs          (node, reuses scripts/linear/client.mjs)
        │  1. resolve the PR NUMBER from the event, then FETCH the PR via the
        │     GitHub API — the payload is never trusted for body/merged/branches
        │  2. read the DECLARATION: body line 1 `Closes GAM-nnn`   ← the one channel
        │  3. validate: exactly one; issue exists; branch-name consistency
        │  4. precondition: issue state ∈ {In Progress, In Review}
        │  5. claim: audit comment on the issue — PR #, event, run URL, mechanism
        │     (the durable attempt record, written BEFORE the mutation)
        │  6. mutate: issueUpdate → Done; read back state; fail loudly on mismatch
        │  7. notify: Slack — every action AND every named skip
        ▼
Linear GraphQL (LINEAR_SYNC_API_KEY, write-scoped, new secret)
```

Native team automations: **all three disabled** by the owner in Linear team settings
(§11). The GitHub integration itself stays installed — the live workspace has 3 of
the 5 configurable events set, which is direct evidence events are individually
optional, so "integration on, zero status movement" is expressible; with automations
off, identifier linking still produces attachments and linkbacks, which become what
they should always have been: cosmetic, and harmless.

### 6.2 The declaration contract

The declaration is **`Closes GAM-nnn` opening the PR body's first line** — which
item 28f *already requires* of every work PR. Measured across PRs #124–#153: every
one of the 7 PRs that completed an issue's work carried it on line 1 (#126, #127,
#131, #133, #136, #143, #153 — on #126 and #127 as a line-1 prefix followed by
prose, which the shared parse below accepts). One PR, #132, was **partial** work
that deliberately declared nothing — a third class the design must serve, and does:
under §6 a partial-work PR correctly declares nothing and closes nothing. The
remaining 22 were investigation/infra PRs with no line-1 declaration.

This is deliberately NOT the commit-trailer channel: the GAM-315 mechanism
comparison measured trailers at 15% coverage, 0 of 11 recent merge commits,
squash-fragile, and already carrying a real two-identifier ambiguity. The
body-line-1 declaration is read from the **PR object via the API at event time**, so
it is squash-immune, unaffected by `merge_commit_message=PR_TITLE`, cannot be
dropped by a hand-edited merge body, and post-gate body edits are re-validated at
merge time by construction.

**One parse, shared.** The gate (§6.4) and the sync import the same function:
line 1 must match `^Closes (GAM-\d+)\b` (prefix-anchored; trailing prose permitted),
and line 1 must contain exactly one identifier token. Nothing else — titles, branch
names, commits, prose, later body lines — is ever read as a declaration. The word
"Closes" finally becomes true again: under this design the token *is* what closes
the issue (via the sync), where item 28f today has to teach that it closes nothing.

**Why not structured GitHub metadata instead?** (Post-merge review, finding 2 —
the honest answer to "this is still text.") The candidates each lose on this
repo's constraints: **labels** are mutable by anyone with triage after the gate
passes, invisible in the body a human reviews, and unbounded in count (recreating
the multiplicity problem the gate exists to reject); **linked GitHub issues** would
require mirroring every Linear row into GitHub Issues — the §2 second-writer
hazard by another door; **milestones/projects** carry no per-PR issue identity.
The line-1 declaration is reviewable in the same glance as the diff, versioned
with the PR, gate-checked on every edit, and already this repo's habit. The trade
is accepted, named, and revisitable if GitHub ever ships a first-class PR field
for external-tracker references.

### 6.3 The sync worker

Trigger and transport — a GitHub Actions workflow, not a new public endpoint:

```yaml
on:
  pull_request_target:     # NOT pull_request — see the note below this block
    types: [closed]        # fires for merged and unmerged closes; the script branches on merged
    branches: [main]       # a stacked or backport PR merging elsewhere must not close anything

concurrency:
  group: linear-sync-${{ github.event.pull_request.number }}   # replays serialize;
  cancel-in-progress: false                                    # per-ISSUE serialization
                                                               # is enforced in the script
                                                               # via the claim comment (below)
```

**Why `pull_request_target`, stated carefully.** Three reasons, two of them from the
post-merge reviews. (1) *The payload cannot be trusted:* GitHub's events reference
states, on the same page that documents the `merged == true` pattern, that "the
`pull_request` webhook event payload is empty for merged pull requests" — the two
statements cannot both be operationally true, so the design stops depending on
either: the script takes only the PR *number* from the event and fetches the PR
object via the API as its first act (review 2, finding 3 — the premise gate still
proves this end-to-end with a live throwaway PR). (2) *The judged code must not be
judgeable:* `pull_request_target` runs the workflow file **and** the checkout from
the base repo's default branch, so the parser that reads a PR's declaration — in
the gate and in the sync — is always `main`'s parser, structurally; a PR cannot
modify the code that judges it (review 2, finding 5). (3) The security caveat that
makes `pull_request_target` dangerous elsewhere — secrets exposed to fork PRs — is
inert here **by a rule the implementation must keep**: the workflow never checks
out, builds, or executes anything from the PR head; the PR body is data, parsed by
a regex, never evaluated. A fork PR therefore gets the same treatment as any other:
its declaration is validated, and closing a declared issue on a merge the owner
performed is correct behaviour.

Why Actions rather than a GitHub webhook → Supabase relay (the mirror of
`linear-dispatch`): the inbound relay exists because **Linear cannot send custom
headers** and GitHub dispatch requires them — a constraint that does not exist in
this direction. GitHub Actions receives the same `pull_request` events a webhook
would, runs on GitHub's own infrastructure, needs no new deployed endpoint, no HMAC
handling, no `verify_jwt` trap, and keeps the whole mechanism reviewable in one
repo. (GitHub webhook deliveries, by contrast, are *not* auto-redelivered on
failure: "GitHub does not automatically redeliver failed webhook deliveries.") The
blast-radius critique that GAM-315 levelled at push-triggered write paths is
answered by scope: this workflow runs only on `pull_request_target closed` against
`main`, holds one write-scoped key, and its entire behaviour is one testable script.

Behaviour table (every row either acts or produces a **named skip** — the
`filter.ts` discipline applied outbound):

| Event | Declaration | Precondition | Action |
| --- | --- | --- | --- |
| merged | `Closes GAM-nnn`, valid | issue in `In Progress` or `In Review` | `issueUpdate → Done`; read back; audit comment; Slack ✓ |
| merged | valid | issue already `Done`, closed by **this** PR (audit comment matches) | skip `ALREADY_DONE` — genuine re-delivery, benign |
| merged | valid | issue already `Done`, closed by a **different** PR | **no move**; Slack ⚠ `DUPLICATE_CLOSE_CLAIM` — two PRs declared one issue; a human decides |
| merged | valid | issue archived | skip `ARCHIVED` (info if `Done`, ⚠ otherwise) |
| merged | valid | issue in any other state (`Backlog`, `Todo`, `Canceled`…) | **no move**; audit comment + Slack ⚠ `UNEXPECTED_STATE` — a human decides |
| merged | none on line 1 | — | skip `NO_DECLARATION` (Slack, info level — legitimate for mention/infra/partial-work PRs) |
| merged | two+ identifiers on line 1, or a non-canonical magic-word pairing | — | **no move**; Slack ⚠ `AMBIGUOUS_DECLARATION` |
| merged | valid but issue does not exist | — | Slack ⚠ `UNKNOWN_ISSUE` |
| merged, base ≠ `main` (belt to the trigger filter's braces) | any | — | skip `NON_MAIN_BASE` |
| merged, revert-shaped (body `Reverts …#NNN` or branch `revert-…`) | usually none | — | no state change; Slack ⚠ `REVERT_MERGED` naming the issue whose fix was reverted, if the reverted PR had declared one. **Policy: no automatic reopen** — a human decides whether the issue reopens |
| closed, not merged | any | — | no state change; if declared, audit comment on the issue (`PR closed without merge`); Slack info |
| opened / reopened | — | — | *(not in scope for v1 — no state move)* |

Deliberately **not** reproduced: `start → In Progress` and `review → In Review`.
Items 28c/28e already make the agent perform both moves with read-back, the
automations' versions of them caused rows 5/6/8/10 of the catalogue, and Check 3 of
the mechanism comparison already established that removing them is "a simplification,
not a gap." The one real loss — a crude backstop when an agent dies mid-run — is
accepted and visible: the issue sits in `Todo`/`In Progress`, which is exactly the
signal the owner needs anyway.

Consistency guard (catches the #131 class, where the branch named a different row
than the body): if the head branch matches `^claude/gam-(\d+)-` — **anchored**, so
GitHub's `revert-NNN-claude/gam-…` branches do not match — the branch's number must
equal the declared number, else `DECLARATION_MISMATCH`, no move, Slack ⚠. A branch
with no identifier (mention PRs, `claude/<slug>` work) passes untouched.

Folded-in work — the R2 counterexample, answered without widening the channel:
when one PR completes a second row by owner ruling (PR #153 fixed both GAM-315's
defect and GAM-323's, and could declare one — GAM-323 sits in `Backlog` today,
defect fixed), the PR may carry an **`Also-fixes: GAM-nnn`** body line. The sync
reads it, **never closes from it**, and Slack-flags it as a hand-close owed, with
the sweep re-flagging until the row moves. The closing channel stays single-issue;
the zombie-row accumulation the fail-safe direction would otherwise cause gets a
named, recurring reminder instead of silence.

Write path mechanics — **claim, then mutate, then confirm** (review 2, finding 4:
two Linear writes cannot be atomic, so the order is the safety). The audit comment
is written *first*, as the durable claim record — it names PR number, merge SHA,
the workflow run URL, and the mechanism. Then `issueUpdate(id, {stateId})` with the
state UUID resolved by name at run time (prior art: `linear-migrate.mjs`,
`linear-file-findings.mjs`); the transport is `scripts/linear/client.mjs` unchanged
(rate-floor guard, complexity notes). Then the script re-reads `issue.state.name`
and fails the run loudly if the read-back disagrees. A crash between claim and
mutation leaves a comment pointing at an issue still in `In Review` — visible,
replayable, and the replay recognises its own claim (that is what distinguishes
`ALREADY_DONE` from `DUPLICATE_CLOSE_CLAIM`); a crash after the mutation leaves
both records consistent. Concurrent merges declaring the *same* issue serialize on
the claim comment: a second run finding a fresh claim it did not write defers to
it. Processing is at-least-once by declaration (R4), never silently at-most-once.
The audit comment also answers attribution: the tracker's history is explained by
the issue itself even though the API attributes the transition to the key's owner —
the same misattribution the native automation has; the difference is the comment
sitting next to it saying so.

Recovery: the workflow also declares `workflow_dispatch` with a PR-number input, so
a missed or failed event can be replayed by hand (idempotent by the table above).
Optionally — recommended, and prior art exists in `linear-export.yml`'s cron — a
daily reconciliation sweep lists the last 48 h of merged declared PRs **on any base
branch** — a stacked child PR merging into its parent hits `NON_MAIN_BASE` and
closes nothing, and the parent's later merge declares only its own issue, so the
child's declared row surfaces *only* here (review 1, finding 5; this repo stacked
three times in one evening) — and compares each declared issue's **state history,
never `completedAt`** (measured 2026-08-11: a reopen/re-close left `completedAt`
frozen at the original close while only the history recorded the truth), reporting
drift to Slack **without writing**; a human decides. There is deliberately no claim that a missed event "self-heals": an
undelivered event leaves the issue visibly in `In Review` until the sweep or a human
notices, which is the fail-safe direction.

Secrets: a new `LINEAR_SYNC_API_KEY` (write, scoped like `LINEAR_DISPATCH_API_KEY`)
rather than widening either existing key — the same one-key-per-job discipline the
export and dispatch keys already follow. Under `pull_request_target` the secrets
are present for fork PRs too; that is safe here only because of the no-execution
rule stated above, and the implementation should still guard for an absent key
with a named skip so a misconfigured deploy fails loudly rather than mysteriously.

### 6.4 The CI gate — making the declaration reliable before anything relies on it

The mechanism comparison's strongest finding was that Option B trusted a convention
followed 15% of the time and enforced nowhere. The line-1 convention is at 7-of-7
among completing work PRs — and it still gets a gate, because "enforced by agent
discipline" is this catalogue's recurring cause. A new workflow on
`pull_request_target` (types opened/edited/synchronize/ready_for_review) — so the
workflow file, the checkout, and therefore **the parser are always `main`'s
version**: a PR cannot modify the code that judges its own declaration (review 2,
finding 5). It reads PR metadata via the API, never checks out or executes
anything from the PR head, and imports **the same parse as the sync**:

1. If line 1 pairs a magic word with an identifier, it must be the canonical
   anchored declaration — `Closes GAM-nnn` opening the line, exactly one identifier
   on the line. Half-declarations go red with a message naming the canonical form
   ("nothing closes unless line 1 starts with `Closes GAM-nnn`") — that includes
   negated ones like #140's "This PR does not close GAM-304", which are unreadable
   by machines and misleading to humans, and are simply unnecessary once nothing
   semantic is listening. Bare identifier *mentions* (no magic word) remain legal
   everywhere, line 1 included — only the anchored prefix is ever parsed.
2. `GAM-000` placeholders are never a valid declaration.
3. If the head branch matches `^claude/gam-(\d+)-`, a canonical declaration for that
   exact issue must be present — the #131 mismatch and the rows-1/8 stale-branch
   class both go red at PR time instead of moving the tracker at merge time.

Because this repo is **public, branch protection — including required status
checks — is free**; the owner can mark this check required so an undeclarable PR
cannot merge. (Private repos would need GitHub Pro; not this repo's situation.)

### 6.5 What this retires — and the one rule that survives

- The *safety* motive for identifier-free branches disappears: with the automations
  off, an identifier in a branch name or title moves nothing, ever. What survives is
  the same discipline as **hygiene, gate-enforced**: §6.4 rule 3 means a branch
  carrying `claude/gam-nnn-` still must be that issue's work (or be renamed), now
  because a check says so rather than because the tracker will misfire. Honest
  statement: the rows-1/8 pattern (reusing an identifier branch for unrelated work)
  is converted from a silent hazard into a red check, not made unnecessary.
- One text rule survives in miniature and must be written where the old ones were:
  **keep magic-word + identifier pairings off body line 1 unless declaring** (§6.4
  rule 1). Everything else — titles, branch mentions, prose anywhere, commit
  messages — becomes unrestricted.
- Item 28f's ~40 lines of "which text is safe where" reduce to the declaration
  contract plus that one sentence — exactly the dated-mechanism replacement the
  corrected 28f was written to permit ("If the mechanism is ever replaced, one dated
  sentence changes and this requirement does not"). Item 28g's verbatim
  three-automation enumeration goes stale the day settings change and is on the §8
  edit list at **both** phases that touch settings, not just the last one.
- GAM-322 resolves: its three options were disable-one / disable-merge / rely-on-
  convention; this supersedes the trilemma by replacing the mechanism the options
  were rationing.

### 6.6 Observability — Slack, closing RC4 and the inbound gap in one move

All free-tier:

1. **A Slack incoming webhook** (one channel, e.g. `#tracker-sync`) posted to by
   *both* halves: the sync script (§6.3 — every action, every named skip) and the
   `linear-dispatch` edge function (every `dispatched: true` and every skip reason —
   closing the design doc's "sharpest open item", where a wrongly-skipped dispatch
   currently looks like a quiet week). The edge-function change is real code against
   live, tested inbound infrastructure and is **scheduled as part of the Phase 2
   build row** (§8), not assumed: the post must ride after the dispatch decision,
   tolerate its own failure, and never touch the response code or the 5 s budget.
2. **The official GitHub Slack app** (free): `/github subscribe
   gamitch/volt_task_tracker_rewrite workflows` — failure notifications for the
   dispatch workflow, the sync workflow, and CI, without writing anything. Also the
   witness channel for fork-PR runs (R6's exception).
3. **Linear's Slack integration** (free plan — its per-team channel notifications
   for status changes; not to be confused with "Slack intake"/Asks, which is a
   paid-tier feature): an independent witness of every state move. **Non-optional
   through the Phase 2–3 window** — it is the only detector that would catch a
   recurrence of row 11's unexplained-move class, which §6 does *not* claim to
   prevent. Owner's taste thereafter.
4. Native extra, no setup cost: with Diffs enabled, Linear's own **Code & reviews
   notifications** can push PR comments, review requests, and failed checks to the
   owner's inbox — a personal-awareness layer; it does not report what the
   automation did, which is what the Slack channel is for.

---

## 7. Alternatives considered

| Alternative | Why not |
| --- | --- |
| **Keep automations, patch conventions** (status quo + discipline) | The catalogue *is* the record of that approach failing: every mitigation is a behavioural rule enforced by nothing, and RC3 means Linear's own knobs cannot scope the risk away. The newly-found `skip`/`ignore` magic words (§4.2) would help the mention-PR case — but they are one more unenforced text convention, in the opposite direction |
| **Disable `start → In Progress` only** (GAM-322 option 1) | Right first click, insufficient endpoint: rows 1–4, 7, 9 (all six wrong closes) came from `merge → Done`, which stays. Adopted here as Phase 0, not as the destination |
| **Commit-trailer closer** (GAM-315 "Option B") | Measured against it: 15% trailer coverage, 0/11 recent merge commits, squash-fragile, real ambiguity case, invisible-failure critique. §6 differs on each point: PR-body channel (squash-immune, 7/7 on completing work PRs), CI-enforced, single shared anchored parse, every refusal Slack-visible |
| **GitHub webhook → Supabase `github-sync` edge function** | Symmetric with `linear-dispatch` and fully viable — but adds a second public endpoint, second HMAC scheme, second deploy surface, and GitHub does not auto-redeliver failed webhook deliveries. Actions delivers the same events with less standing surface. Revisit only if Actions latency (typically seconds–low minutes) ever matters |
| **Linear Agents platform** (AgentSession webhooks; delegate an issue to a "Claude" app user) | The genuinely first-class future: free plan includes it, agents aren't billable seats, delegation fires `AgentSessionEvent` webhooks. But it is a Developer Preview API requiring a hosted OAuth app — new standing infrastructure and a moving target. **Watch item, not this proposal.** The §6 design loses nothing to it: the closer stays correct under any inbound mechanism |
| **GitHub Issues sync** (vendor two-way issue mirror) | Not an alternative for this flow, and its two-way mode syncs *status* — a second independent writer to issue state, incompatible with the single-writer premise here. Recorded as leave-off (§2) |
| **Polling cron** (the webhook doc's §12 honest-cheaper-alternative) | No longer cheaper: the Actions transport in §6.3 is event-driven *and* needs no endpoint, so polling's one advantage (no relay) is now moot in both directions. A read-only daily *reconciliation* sweep survives as §6.3's optional drift detector — reporting, never moving |

---

## 8. Migration plan — each phase reversible, nothing big-bang

| Phase | Who | What | Reverses by |
| --- | --- | --- | --- |
| 0 | Owner, ~5 min | **First**: read the workspace **commit-linking toggle** in the GitHub integration settings and record its state — first because of the trailer collision (§2: `Linear-Issue:` contains the closing magic word `linear issue`); if it is on, turn it off before anything else. Then in **Settings → Team → Workflows & automations → Pull request and commit automations**: disable `start → In Progress` and `review → In Review`. Then the personal "move issue to started status on branch copy" automation (Settings → Account → Code & reviews — candidate cause of §4.1 row 11). Removes the backwards-move/reopen class (rows 5, 6, 8, 10) **today**, before any code. Same day: re-run the `gitAutomationStates` query and update item 28g's enumeration (owner-authorized edit path — its prose goes stale the moment settings change, by its own warning). One carried-forward caveat from the mechanism comparison (LCD 3): this assumes nothing machine-reads `In Progress` as an automation-set signal — not exhaustively checked across `.github/workflows/`; the premise gate re-checks it | re-enabling the toggles |
| 1 | Owner, 15 min | Create the Slack channel + incoming webhook; `/github subscribe` the repo's workflows; enable Linear's per-team Slack notifications (§6.6 item 3 — non-optional through Phase 3); add `SLACK_WEBHOOK_URL` secret (GitHub) and Supabase secret | deleting the webhook |
| 2 | HEAVY row + premise gate | Build `scripts/linear-sync.mjs` + workflow (`pull_request_target`, per-PR concurrency, claim-then-mutate ordering) + CI declaration check + **the edge-function Slack notification** (§6.6 item 1), with the sync in **shadow mode** — see below. The premise gate's live throwaway-PR test covers §10 risk 1 (payload, number resolution, API fetch, secrets) before anything relies on it. `merge → Done` stays on during shadow | deleting the workflow |
| 3 | Owner, 1 min + flag flip | Disable `merge → Done`; set the sync live (`SYNC_MODE=live`). Item 28f, item 28g (again), AGENTS.md, and WORKFLOWS.md rule 2 get their dated-mechanism updates — including §6.5's surviving one-line text rule — via the authorized channel (owner-directed edit or `boss-architect`, per Authority Boundaries) | re-enabling the automation, re-flagging shadow |
| 4 | Owner's option | Mark the declaration check required under branch protection; close GAM-322 and GAM-323 with pointers here | unmarking |

**Shadow mode, specified against the confound.** The naive spec — "run the shadow,
compare with the incumbent" — is broken by the incumbent itself: `merge → Done`
fires ~2 s after a merge, while an Actions run starts seconds-to-minutes later, so
a live precondition read would see `Done` and report `ALREADY_DONE` on exactly the
happy-path merges the test needs, masking both agreement and one direction of
disagreement (and the race is non-deterministic). So the shadow does **not** use
its live precondition read for the comparison: at event time it reads the issue's
**state history** and reconstructs the state immediately *before* any
merge-coincident automation transition (the data demonstrably supports this — §4.1
was mined from it), computes its intended action from that reconstructed state, and
posts `MATCH`/`MISMATCH` per merged PR: *shadow's intended outcome (close /
named-skip) vs the automation's observed transition (closed / no-op) for the
declared issue*. Exit criterion: **10 consecutive `MATCH`es on real merges, plus
three staged control PRs** run against a throwaway issue — (a) a mention PR
carrying the identifier in prose only → shadow `NO_DECLARATION`, automation
no-op-or-misfire recorded; (b) a canonical work PR → both close; (c) a second PR
declaring the already-closed throwaway → shadow `DUPLICATE_CLOSE_CLAIM`. Staged
controls exist because the covering cases may never occur naturally in the window —
the phase must not depend on luck to terminate.

## 9. Cost

| Component | Price |
| --- | --- |
| GitHub Actions (public repo) | $0 |
| Linear webhooks + GraphQL API (free plan lists "API and webhook access"; documented limit 5,000 req/h for personal keys, 2,500/h measured here; the sync adds ~3–5 requests per merged PR) | $0 |
| Supabase edge function (already deployed; one additive change in Phase 2) | $0 |
| Slack incoming webhook + GitHub Slack app + Linear Slack app (free plan: 10-app limit — this uses 2–3 — and 90-day history; durable records live in the issues and this repo) | $0 |
| Branch protection on a public repo | $0 |
| **Total** | **$0** |

## 10. Risks and open questions

1. **Event payload and file-version semantics on `closed`.** GitHub's events
   reference is internally contradictory here: it documents the
   `github.event.pull_request.merged == true` pattern *and* states "the
   `pull_request` webhook event payload is empty for merged pull requests" (review
   2's blocker). The design therefore stops trusting the payload — the script
   takes only the PR number from the event and API-fetches the PR object — and
   runs on `pull_request_target`, whose workflow file and checkout are documented
   to come from the base repo's default branch. The Phase-2 premise gate still
   proves the whole path end-to-end with a live throwaway PR (payload shape,
   number resolution, API fetch, secrets) before anything relies on it.
2. **Attribution** — the sync's transitions will attribute to the key owner's user,
   like the automation's did. Mitigated by R5's audit comment; truly fixed only by
   the Agents/OAuth route (§7). Accepted for now, stated honestly.
3. **A wrong declaration closes the wrong issue** — the residual risk class.
   Narrowed by: the shared anchored parse, the branch-consistency guard, the CI gate
   at PR time, the precondition check (a wrongly-named issue is rarely sitting in
   `In Review`), `DUPLICATE_CLOSE_CLAIM`, and the Slack ⚠ on every anomaly. Under
   the incumbent, this class fires from *any* text channel with no gate at all.
4. **Actions delay or outage at merge time** — the issue sits visibly in
   `In Review`; recovery is the `workflow_dispatch` replay and the daily
   reconciliation sweep (§6.3). Fail-safe direction; no self-healing is claimed.
5. **Linear payload/API drift** — the sync depends on the PR event payload and two
   GraphQL operations, both versioned and documented; the named-skip discipline
   turns drift into a loud `UNEXPECTED_STATE`/`UNKNOWN_ISSUE` rather than silence.
6. **Row 11's class is not claimed prevented.** The unexplained `Backlog → In
   Progress` move was never attributed to the three automations §6 disables; if its
   cause was the personal branch-copy automation, Phase 0's toggle check removes it,
   and either way the Linear-Slack state-move witness (§6.6 item 3, non-optional
   through Phase 3) makes any recurrence attributable instead of invisible.
7. **Owner hand-moves** — the owner dragging cards remains fully compatible: the
   sync only ever acts on a merge event for a declared issue in an expected state.

## 11. What the owner is asked to decide

1. **Approve the direction** (§6) — or redline it. Nothing ships on this document
   alone.
2. **Phase 0 now?** A few clicks in Linear settings (team automations + the two
   adjacent toggles), valuable independently of everything else, already
   recommended by deliverable B / GAM-322.
3. **Slack**: name the workspace/channel to use (Phase 1), or strike §6.6 down to
   the GitHub Slack app only — accepting that the sync's own decisions then have no
   push channel, which re-opens R6.
4. **File the build row**: one HEAVY issue for Phase 2 — `scripts/linear-sync.mjs`,
   the sync workflow, the CI declaration check, the edge-function Slack
   notification, and shadow mode per §8's spec — premise-gated per item 19, with
   this document as its packet's starting evidence.
5. **Ratifications owed regardless** (pre-existing debt this document surfaces):
   the orchestrator model-by-tier policy living only in workflow comments; GAM-323's
   now-stale subject; and item 28g/28f each needing their dated updates at Phases 0
   and 3 (§8). The commit-message narrowing of 28f this item originally requested
   is **already discharged**: it landed on `main` via PR #154 (2026-08-11, with the
   toggle named) while this document was in review.

## 12. Verification record

A draft of this document was adversarially verified on 2026-08-11 by four
independent checkers before this revision: repo-facts (46 checks: 35 confirmed,
3 partly wrong, 8 unverifiable-from-repo — all 8 subsequently confirmed by the
live-services checker), live GitHub/Linear (6 checks: run tallies, board state,
GAM-310 history, workflow states — 2 partly wrong), vendor docs (10 checks:
9 confirmed with primary-source quotes, 1 partly wrong), and design logic
(23 checks: 10 survived, 12 partly wrong, 1 refuted — the original shadow-mode
spec, rewritten in §8). Every defect they found is corrected in this revision:
the row-9 cause and row-10 date, the millisecond-attribution sentence, the
7-of-7 framing and the gate/sync regex divergence, the missing revert /
duplicate-close / base-branch / archived rows, the false "self-heals" claim, the
28g and edge-function scheduling omissions, the fork-PR notification exception,
and the shadow-mode confound. Claims that remain deliberately unproven are marked
where they stand (§10 items 1 and 6).

## 13. Post-merge review disposition (2026-08-11)

Two further independent reviews arrived after PR #155 merged (recorded verbatim in
its comments, per owner direction, before any of this revision was written). All
eleven findings were accepted; this section records what each changed, so the
revision is auditable against the reviews.

**Review 1 (agent, six findings):**
1. Trailer/`linear issue` collision → §2 reworded; §8 Phase 0 now checks the
   commit-linking toggle *first*, with the rationale.
2. Stronger commit-linking evidence (PR #125/GAM-303, with positive controls);
   28f narrowing already discharged via PR #154 → §4.2 RC1 re-grounded; §11 item 5
   updated. The #125 measurement is reviewer-supplied and so marked.
3. Folded-in work counterexample (PR #153 / GAM-323) → R2 amended; §6.3 gains the
   `Also-fixes:` advisory line (read, never closed from, Slack-flagged, swept).
4. Catalogue three moves short → rows 12–13 added; totals corrected to thirteen
   attributable plus one unexplained; row 9's "not separable" cause updated per
   PR #154's docs finding that both channels link independently.
5. Stacked PRs slip past the base filter → the reconciliation sweep now scans
   merged declared PRs on any base branch, with the rationale stated.
6. `completedAt` freezes across reopen/re-close → the sweep is pinned to state
   history, with the measurement cited (also folded into row 13).
Minor: §4.3's rename count corrected to four sessions, one correctly keeping its
identifier.

**Review 2 (non-Claude agent, one blocker + four majors):**
1. Commit-linking status overstated → §2 now states the toggle's state is unknown
   and only end-to-end inertness is measured.
2. R1 promised "structure" while parsing prose → R1 reworded to "one enforced
   declaration channel", stated honestly; §6.2 gains the why-not-structured-
   metadata trade note.
3. **Blocker** — merged-PR payload may be empty → verified against GitHub's events
   reference, which is internally contradictory on this exact point; design
   changed: `pull_request_target` trigger + API-fetch-first (the payload
   contributes only the PR number); §10 risk 1 rewritten; premise-gate live test
   widened to the whole path.
4. Write sequence not idempotent → R4 restated as at-least-once with a durable
   claim record; §6.3 adopts claim-then-mutate-then-confirm ordering, per-PR
   workflow concurrency, and claim-comment-based serialization for same-issue
   merges; `ALREADY_DONE` vs `DUPLICATE_CLOSE_CLAIM` now keys off the claim
   record.
5. Gate parser loadable from the judged PR → resolved structurally by
   `pull_request_target` for both gate and sync: workflow, checkout, and parser
   are always `main`'s version.

Both reviewers approved the direction while holding Phase 2; this revision is the
response their holds asked for. The §11 asks are unchanged in kind — the Phase 2
row now carries these constraints into its packet.
