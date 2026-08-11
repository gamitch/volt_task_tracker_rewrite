# 2026-08-11 — Evaluation of the Linear ↔ GitHub integration, and a proposal to replace semantic automation with explicit event-driven sync

**Status: PROPOSAL, for owner review. Nothing in this document changes any code, any
Linear setting, or any constitution wording.** The build it proposes is a new write
path against the live tracker, which is item 26's own HEAVY trigger — it gets a
premise gate and its own row before a line of it ships. What this document asks the
owner to decide is listed in §11, and every factual claim below carries its source.

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

Four research passes were run on 2026-08-11, in parallel, and everything below is
grounded in one of them:

| Pass | Source | What it read |
| --- | --- | --- |
| Repo evidence | this repository | constitution item 28 (corrected text), the webhook design doc, the GAM-315 packet/run-log/mechanism-comparison/deliverable-B, WORKFLOWS.md, AGENTS.md, all four workflows, all `scripts/linear*` code |
| Linear live | Linear MCP (read-only) | workspace/team config, workflow states, labels, `gitAutomationStates`, state history + comments on GAM-303/304/308/310/315/322, `list_diffs`, Linear's own docs search |
| GitHub live | GitHub MCP (read-only) | all 30 PRs #124–#153 with bodies, branch commits of 4 merged PRs, full run history of `claude-linear-dispatch.yml` (11 runs) and `linear-export.yml` (26 runs), workflow inventory |
| Vendor docs | web (primary sources) | linear.app/docs + /developers (GitHub integration, webhooks, GraphQL, agents, Slack), docs.github.com (events, tokens, branch protection), Slack docs |

---

## 2. Inventory — the integration is four mechanisms, not one

| # | Mechanism | Direction | Nature | Verdict |
| --- | --- | --- | --- | --- |
| 1 | `linear-dispatch` webhook chain (Linear webhook → Supabase edge fn → `repository_dispatch` → claude-code-action) | Linear → work | **Event-driven, explicit, filtered, signed** | **Keep.** Proven live; 11 runs. Gaps are observability, not mechanism (§4.5) |
| 2 | Linear's native GitHub automations: `start → In Progress`, `review → In Review`, `merge → Done`, all unscoped | GitHub → Linear state | **Semantic** — infers intent from identifier text in branch names / PR titles / magic words | **Replace.** The subject of this proposal |
| 3 | `linear-export.yml` (git-side backup) | Linear → git | Scheduled + push-triggered healing job | Keep. 24/26 runs green; 2 known push-race failures, benign |
| 4 | Agents' own state moves (claim `Todo → In Progress`, finish `→ In Review`) via ad-hoc GraphQL over `scripts/linear/client.mjs` | agent → Linear | Explicit, rule-governed (items 28c/28e) | Keep. This is already the explicit model §6 extends |

The thing the owner is unhappy with is mechanism 2 — and only mechanism 2. The
inbound half already is the durable, webhook-driven design being asked for; the
outbound half is text inference, and it is the source of every documented failure.

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
is parsed**, every decision is **enumerated and named** (45 tests assert the skip
reasons, four guard mutations were shown red), and the state transition it reacts to
is read from `updatedFrom.stateId` — a structured field, not text. Run history:
11 dispatches, 9 success / 1 failure / 1 cancelled, and both failures produced
measured fixes (turn cap 80→300, timeout 60→120).

The replacement in §6 deliberately copies this design grammar.

---

## 4. What fails: the semantic outbound automations

### 4.1 The failure catalogue

Every documented wrong move, all within ~48 hours of the automations being live, all
from `docs/swarm/active/GAM-315-*` and the issues' own state histories:

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
| 9 | 08-09 | GAM-310 | **Wrong close** — PR #132 merged with the identifier in its **title only**, `Closes` deliberately omitted, 3 of the issue's 7 steps done; reopened by hand | title link; falsified old item 28f |
| 10 | 08-10 15:38 | GAM-303 | **Backwards move** `In Review → In Progress` the millisecond PR #126 attached | `start` automation on link |
| 11 | 08-10 02:23 | GAM-304 | `Backlog → In Progress` with **no attachment and no PR** — cause never established | unexplained |

Ten wrong moves attributable to the automations, plus one that was never explained,
across three issues. The owner hand-corrected GAM-304 and GAM-310. Additionally, the
audit trail lies: automation transitions are attributed to the PR author's mapped
Linear user — four of the six merge-coincident GAM-304 transitions read
**"George Mitchom"** in Linear's history although all were automation firings, with
attachment/transition timestamps identical to the millisecond.

### 4.2 Root causes — why this is a class, not a bug list

**RC1 — Linking is inference from free text.** Linear links a PR to an issue when the
identifier appears in the branch name, the PR title, or beside a magic word in the
body (measured in this workspace; commit messages and bare prose mentions measured
*not* to link — `GAM-315` F8, with a positive control). There is no way to say "this
PR merely *mentions* GAM-304"; any occurrence in a linking channel is read as
intent.

**RC2 — State is computed from the aggregate linked-PR set.** `merge → Done` fires
when the **last open linked PR** merges — any linked PR, not the work. `start → In
Progress` fires on any linked PR opening, and outranks the merge rule while another
linked PR is open — which is how an issue's own fix moved it backwards (row 5).

**RC3 — The scoping that would help cannot be expressed.** Linear's automation
`targetBranch` scopes the PR's **base** branch, not its head (confirmed from the API
schema on GAM-315 round 3). Every PR here targets `main`, so no branch-naming scheme
can scope the automations. The knobs Linear offers cannot fix RC1/RC2.

**RC4 — Failures are silent and misattributed.** No notification exists anywhere in
the chain — not for a wrong close, not for a skipped dispatch. `Done` is, in
deliverable B's words, "the one state nobody re-reads."

### 4.3 The convention tax — what semantics costs even when it works

Because any identifier occurrence is treated as intent, the project has had to build
an avoidance discipline: 11 of the last 30 PRs are **deliberately identifier-free**
(#149/#150/#152 open with a paragraph explaining their own branch naming), three
consecutive GAM-315 sessions each had to rename their default branch off the
identifier, WORKFLOWS.md rule 2 now carries a mention-vs-work sub-rule with a
"same sentence as close/fix/resolve" phrasing guide, and item 28f spends ~40 lines
teaching agents what text is safe to write where. That is process spent protecting
the tracker *from* the automation, and all of it becomes unnecessary under §6.

### 4.4 What semantics got right — kept honestly

With exactly **one** linked PR the three automations produce the intended lifecycle
end-to-end: GAM-308 went `Todo → In Progress → In Review → Done` with zero manual
moves. The single-PR case works; the design fails on multiplicity and on mention.
Also true: `start → In Progress` and `review → In Review` merely duplicate what
items 28c/28e already require agents to do by hand, so a replacement owes nothing
there (GAM-315 mechanism comparison, Check 3). **Only `merge → Done` does work no
rule duplicates — the replacement has to reproduce one transition, not three.**

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

- **R1 — Explicit declaration.** A PR's linked issue is *declared*, once, in a
  structured place — never inferred from prose, titles, or branch names. (RC1)
- **R2 — Exactly one issue per PR.** Multiplicity is rejected loudly, not resolved
  by an aggregate rule. (RC2)
- **R3 — Event-driven.** State moves happen on the PR lifecycle event itself
  (merge), not on polling and not on text re-scans.
- **R4 — Validated, precondition-checked, idempotent writes.** The mover verifies
  the issue exists and is in an expected state before writing, re-reads after
  writing (the same read-back item 28c already demands of claims), and is safe to
  re-deliver.
- **R5 — Audited.** Every state move leaves a comment on the issue naming the PR,
  the event, and the mechanism — because Linear's actor column is proven unreliable.
- **R6 — Loud on every refusal.** Every skip and every failure is named and
  notified (Slack); a silent no-op that looks like success is this project's
  recorded recurring defect. (RC4)
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
        │  GitHub Actions: on pull_request (types: closed) — an event, not a poll
        ▼
scripts/linear-sync.mjs          (node, reuses scripts/linear/client.mjs)
        │  1. read the DECLARATION: body line 1 `Closes GAM-nnn`   ← the one channel
        │  2. validate: exactly one; issue exists; branch-name consistency
        │  3. precondition: issue state ∈ {In Progress, In Review}
        │  4. mutate: issueUpdate → Done; read back state
        │  5. audit: comment on the issue — PR #, event, run URL, mechanism
        │  6. notify: Slack — every action AND every named skip
        ▼
Linear GraphQL (LINEAR_SYNC_API_KEY, write-scoped, new secret)
```

Native automations: **all three disabled** by the owner in Linear team settings
(§11). The GitHub integration itself stays installed — with automations off,
identifier linking still produces attachments and linkbacks, which become what they
should always have been: cosmetic, and harmless.

### 6.2 The declaration contract

The declaration is **`Closes GAM-nnn` as the PR body's first line** — which item 28f
*already requires* of every work PR, and which all 7 of the last 30 PRs that were an
issue's work actually carried (#126, #127, #131, #133, #136, #143, #153 — 7 of 7;
the other 23 were investigation/infra PRs that deliberately declared nothing). This
is deliberately NOT the commit-trailer channel: the GAM-315 mechanism comparison
measured trailers at 15% coverage, 0 of 11 recent merge commits, squash-fragile, and
already carrying a real two-identifier ambiguity. The body-line-1 declaration is
read from the **PR object via the API at event time**, so it is squash-immune,
unaffected by `merge_commit_message=PR_TITLE`, and cannot be dropped by a hand-edited
merge body.

Parsing is anchored and strict — `^Closes (GAM-\d+)\b` on line 1 only, exactly one
match permitted anywhere in line 1. An identifier in the title, the branch name, a
commit message, or body prose is **never** read as a declaration. The word "Closes"
finally becomes true again: under this design the token *is* what closes the issue
(via the sync), where item 28f today has to teach that it closes nothing.

### 6.3 The sync worker

Trigger and transport — a GitHub Actions workflow, not a new public endpoint:

```yaml
on:
  pull_request:
    types: [closed]        # fires for merged and unmerged closes; the script branches on merged
```

Why Actions rather than a GitHub webhook → Supabase relay (the mirror of
`linear-dispatch`): the inbound relay exists because **Linear cannot send custom
headers** and GitHub dispatch requires them — a constraint that does not exist in
this direction. GitHub Actions receives the same `pull_request` events a webhook
would, runs on GitHub's own retried infrastructure, needs no new deployed endpoint,
no HMAC handling, no `verify_jwt` trap, and keeps the whole mechanism reviewable in
one repo. (GitHub webhook deliveries, by contrast, are *not* auto-redelivered on
failure.) The blast-radius critique that GAM-315 levelled at push-triggered write
paths is answered by scope: this workflow runs only on `pull_request closed`, holds
one write-scoped key, and its entire behaviour is one testable script.

Behaviour table (every row either acts or produces a **named skip** — the
`filter.ts` discipline applied outbound):

| Event | Declaration | Precondition | Action |
| --- | --- | --- | --- |
| merged | `Closes GAM-nnn`, valid | issue in `In Progress` or `In Review` | `issueUpdate → Done`; read back; audit comment; Slack ✓ |
| merged | valid | issue already `Done` | skip `ALREADY_DONE` (idempotent re-delivery) |
| merged | valid | issue in any other state (`Backlog`, `Todo`, `Canceled`…) | **no move**; audit comment + Slack ⚠ `UNEXPECTED_STATE` — a human decides |
| merged | none on line 1 | — | skip `NO_DECLARATION` (Slack, info level — legitimate for mention/infra PRs) |
| merged | two+ identifiers on line 1, or malformed | — | **no move**; Slack ⚠ `AMBIGUOUS_DECLARATION` |
| merged | valid but issue does not exist | — | Slack ⚠ `UNKNOWN_ISSUE` |
| closed, not merged | any | — | no state change; if declared, audit comment on the issue (`PR closed without merge`); Slack info |
| opened / reopened | — | — | *(not in scope for v1 — no state move; see below)* |

Deliberately **not** reproduced: `start → In Progress` and `review → In Review`.
Items 28c/28e already make the agent perform both moves with read-back, the
automations' versions of them caused rows 5/6/8/10 of the catalogue, and Check 3 of
the mechanism comparison already established that removing them is "a simplification,
not a gap." The one real loss — a crude backstop when an agent dies mid-run — is
accepted and visible: the issue sits in `Todo`/`In Progress`, which is exactly the
signal the owner needs anyway.

Consistency guard (catches the #131 class, where the branch named a different row
than the body): if the head branch matches `claude/gam-(\d+)-`, the branch's number
must equal the declared number, else `DECLARATION_MISMATCH`, no move, Slack ⚠. A
branch with no identifier (mention PRs, `claude/<slug>` work) passes untouched.

Write path mechanics: `issueUpdate(id, {stateId})` with the state UUID resolved by
name at run time (prior art: `linear-migrate.mjs`, `linear-file-findings.mjs`); the
transport is `scripts/linear/client.mjs` unchanged (rate-floor guard, complexity
notes); after the mutation the script re-reads `issue.state.name` and fails the run
if the read-back disagrees. The audit comment names PR number, merge SHA, the
workflow run URL, and the mechanism — so the tracker's history is explained by the
issue itself even though the API attributes the transition to the key's owner (the
same misattribution the native automation has; the difference is the comment sitting
next to it saying so).

Secrets: a new `LINEAR_SYNC_API_KEY` (write, scoped like `LINEAR_DISPATCH_API_KEY`)
rather than widening either existing key — the same one-key-per-job discipline the
export and dispatch keys already follow. Fork PRs get no secrets from GitHub on
`pull_request`; the script detects the absent key and exits with a named skip —
fork PRs are outside the swarm's flow anyway.

### 6.4 The CI gate — making the declaration reliable before anything relies on it

The mechanism comparison's strongest finding was that Option B trusted a convention
followed 15% of the time and enforced nowhere. The body-line-1 convention is at 100%
among work PRs — and it still gets a gate, because "enforced by agent discipline" is
this catalogue's recurring cause. A new job (in `ci.yml`, on `pull_request`
opened/edited/synchronize/ready_for_review — metadata only, no checkout of PR code,
no secrets needed for the syntax half):

1. Body line 1 either matches `^Closes GAM-\d+$` exactly or contains no
   issue-identifier-like token at all (a mention PR must not half-declare).
2. At most one identifier on line 1; `GAM-000` placeholder rejected in a
   declaration.
3. If the head branch matches `claude/gam-nnn-`, the declaration must exist and
   match it — the #131 mismatch and the row-1/-8 stale-branch class both go red at
   PR time instead of moving the tracker at merge time.

Because this repo is **public, branch protection — including required status
checks — is free**; the owner can mark this check required so an undeclarable PR
cannot merge. (Private repos would need GitHub Pro; not this repo's situation.)

### 6.5 What this retires

- The mention-branch contortions (§4.3): with the automations off, an identifier in
  a branch name or title moves nothing, ever. Sessions stop renaming branches;
  WORKFLOWS.md rule 2 keeps only its original collision/readability rationale.
- Item 28f's ~40 lines of "which text is safe where" reduce to: *declare the work
  PR on body line 1; the sync closes on merge; dated 2026-08-…* — exactly the
  one-dated-sentence replacement the corrected 28f was written to permit ("If the
  mechanism is ever replaced, one dated sentence changes and this requirement does
  not").
- GAM-322 resolves: its three options were disable-one / disable-merge / rely-on-
  convention; this supersedes the trilemma by replacing the mechanism the options
  were rationing.

### 6.6 Observability — Slack, closing RC4 and the inbound gap in one move

All free-tier:

1. **A Slack incoming webhook** (one channel, e.g. `#tracker-sync`) posted to by
   *both* halves: the sync script (§6.3 — every action, every named skip) and the
   `linear-dispatch` edge function (every `dispatched: true` and every skip reason —
   closing the design doc's "sharpest open item", where a wrongly-skipped dispatch
   currently looks like a quiet week). The edge function's post must not eat its 5 s
   budget: fire the notification after the dispatch decision, tolerate its failure,
   never let it change the response code.
2. **The official GitHub Slack app** (free): `/github subscribe
   gamitch/volt_task_tracker_rewrite workflows` — failure notifications for the
   dispatch workflow, the sync workflow, and CI, without writing anything.
3. Optional: **Linear's Slack integration** (free plan; per-team channel
   notifications for status changes) as an independent witness of every state move —
   useful during the shadow phase (§8), owner's taste after that.

Slack free-plan caveats, stated: 10-app workspace limit (this uses 2–3), 90-day
history (fine — durable records live in the issues and this repo).

---

## 7. Alternatives considered

| Alternative | Why not |
| --- | --- |
| **Keep automations, patch conventions** (status quo + discipline) | The catalogue *is* the record of that approach failing: every mitigation is a behavioural rule enforced by nothing, and RC3 means Linear's own knobs cannot scope the risk away |
| **Disable `start → In Progress` only** (GAM-322 option 1) | Right first click, insufficient endpoint: rows 1–4, 7, 9 (all six wrong closes) came from `merge → Done`, which stays. Adopted here as Phase 0, not as the destination |
| **Commit-trailer closer** (GAM-315 "Option B") | Measured against it: 15% trailer coverage, 0/11 recent merge commits, squash-fragile, real ambiguity case, invisible-failure critique. §6 differs on each point: PR-body channel (squash-immune, 7/7 on work PRs), CI-enforced, single-channel anchored parse, every refusal Slack-visible |
| **GitHub webhook → Supabase `github-sync` edge function** | Symmetric with `linear-dispatch` and fully viable — but adds a second public endpoint, second HMAC scheme, second deploy surface, and GitHub does not auto-redeliver failed webhook deliveries. Actions delivers the same events with less standing surface. Revisit only if Actions latency (typically seconds–low minutes) ever matters |
| **Linear Agents platform** (AgentSession webhooks; delegate an issue to a "Claude" app user) | The genuinely first-class future: free plan includes it, agents aren't billable seats, delegation fires `AgentSessionEvent` webhooks. But it is a Developer Preview API requiring a hosted OAuth app — new standing infrastructure and a moving target. **Watch item, not this proposal.** The §6 design loses nothing to it: the closer stays correct under any inbound mechanism |
| **Polling cron** (the webhook doc's §12 honest-cheaper-alternative) | No longer cheaper: the Actions transport in §6.3 is event-driven *and* needs no endpoint, so polling's one advantage (no relay) is now moot in both directions |

---

## 8. Migration plan — each phase reversible, nothing big-bang

| Phase | Who | What | Reverses by |
| --- | --- | --- | --- |
| 0 | Owner, 2 min | Disable `start → In Progress` (and `review → In Review`) in Linear team settings. Removes the backwards-move/reopen class (rows 5, 6, 8, 10) **today**, before any code | re-enabling the toggle |
| 1 | Owner, 15 min | Create the Slack channel + incoming webhook; `/github subscribe` the repo's workflows; add `SLACK_WEBHOOK_URL` secret (GitHub) and Supabase secret | deleting the webhook |
| 2 | HEAVY row + premise gate | Build `scripts/linear-sync.mjs` + workflow + CI declaration check, with the sync in **shadow mode**: it computes and Slack-posts what it *would* do, writes nothing. `merge → Done` stays on. Run both in parallel until N consecutive merges agree (suggest N=10, covering at least one mention-PR and one multi-PR issue) | deleting the workflow |
| 3 | Owner, 1 min + flag flip | Disable `merge → Done`; set the sync live (`SYNC_MODE=live`). Item 28f/AGENTS.md/WORKFLOWS.md get their one-dated-sentence updates (owner-authorized edit or `boss-architect`, per Authority Boundaries) | re-enabling the automation, re-flagging shadow |
| 4 | Owner's option | Mark the declaration check required under branch protection; close GAM-322 and GAM-323 with pointers here | unmarking |

Shadow mode is the premise gate's teeth: the mechanism comparison's complaint about
building write automation on unmeasured claims is answered by measuring the exact
replacement against the incumbent on live traffic before it holds the pen.

## 9. Cost

| Component | Price |
| --- | --- |
| GitHub Actions (public repo) | $0 |
| Linear webhooks + GraphQL API (free plan: "API and webhook access", 5,000 req/h documented, 2,500/h measured here; the sync adds ~3–5 requests per merged PR) | $0 |
| Supabase edge function (already deployed; unchanged) | $0 |
| Slack incoming webhook + GitHub Slack app + Linear Slack app (free plan) | $0 |
| Branch protection on a public repo | $0 |
| **Total** | **$0** |

## 10. Risks and open questions

1. **`pull_request: closed` semantics** — which ref the workflow file is read from
   on a closed event, and secrets availability, are documented-but-untested in this
   repo; the Phase-2 premise gate verifies both with a live throwaway PR before
   anything relies on them. (Same-repo branches receive secrets on `pull_request`;
   forks do not — handled, §6.3.)
2. **Attribution** — the sync's transitions will attribute to the key owner's user,
   like the automation's did. Mitigated by R5's audit comment; truly fixed only by
   the Agents/OAuth route (§7). Accepted for now, stated honestly.
3. **A wrong declaration closes the wrong issue** — the residual risk class. Narrowed
   by: anchored single-channel parse, the branch-consistency guard, the CI gate at
   PR time, the precondition check (a wrongly-named issue is rarely sitting in
   `In Review`), and the Slack ⚠ on every anomaly. Under the incumbent, this class
   fires from *any* text channel with no gate at all.
4. **Actions delay or outage at merge time** — an issue briefly sits `In Review`
   after its merge; fail-safe direction, visible on the board, self-heals on the
   next run or by re-running the workflow (idempotent by design).
5. **Linear payload/API drift** — the sync depends on the PR event payload and two
   GraphQL operations, both versioned and documented; the named-skip discipline
   turns drift into a loud `UNEXPECTED_STATE`/`UNKNOWN_ISSUE` rather than silence.
6. **Owner hand-moves** — the owner dragging cards remains fully compatible: the
   sync only ever acts on a merge event for a declared issue in an expected state.

## 11. What the owner is asked to decide

1. **Approve the direction** (§6) — or redline it. Nothing ships on this document
   alone.
2. **Phase 0 now?** Two clicks in Linear team settings, valuable independently of
   everything else, already recommended by deliverable B / GAM-322.
3. **Slack**: name the workspace/channel to use (Phase 1), or strike §6.6 down to
   the GitHub Slack app only.
4. **File the build row**: one HEAVY issue for Phase 2 (script + workflow + CI gate
   + shadow mode), premise-gated per item 19, with this document as its packet's
   starting evidence.
5. **Ratifications owed regardless** (pre-existing debt this document merely
   surfaces): the orchestrator model-by-tier policy living only in workflow comments,
   and GAM-323's now-stale subject.
