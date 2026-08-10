# GAM-315 task packet — correct item 28f, and name the mention-vs-work distinction

Tier: **STANDARD** (item 26). Premise: **measured and holding** — see
`GAM-315-run-log.md` § "Premise measured". Authority: `constitution.md` is
`boss-architect` / `boss-arbiter` only (Authority Boundaries, lines 22-24);
`docs/swarm/**` is orchestrator-owned (`AGENTS.md` § Ownership). Therefore the
edit is dispatched to **`boss-architect`**, not `worker-implementer`.

## Allowed files

- `docs/swarm/constitution.md` — item 28f, item 28g
- `docs/swarm/WORKFLOWS.md` — rule 2

Nothing else. No code. No `.claude/**`. Do not touch the frozen ledger.

## The measured facts this edit must encode

All measured 2026-08-10 against Linear's GraphQL API and `gh`, on `main`
`43d99c7`. Cite nothing that is not in this list.

**F1. Two things create a Linear link, and a magic word is only one of them.**
A PR is linked to an issue if its **branch name** contains the identifier, or
its **body** contains a magic word (`Closes`/`Fixes`/`Resolves` + identifier).
A bare prose mention in the body does **not** link: PR #142's body line 1 names
`GAM-315`, and GAM-315 has **zero** attachments — and GAM-315 was created
04:54:22Z, more than eight hours before #142 opened (13:17:02Z), so the issue
existed for the whole of #142's life. *A bare identifier in the PR **title** was
not tested; do not make a claim about it.*

**F2. The magic word is not what closes the issue.** Team `GAM` carries three
global git automations, read from Linear's `gitAutomationStates`:

```
event=start   targetBranch=ANY -> In Progress (started)
event=review  targetBranch=ANY -> In Review   (started)
event=merge   targetBranch=ANY -> Done        (completed)
```

`targetBranch: ANY` means unscoped — every repository, every base branch.

**F3. `merge → Done` fires on the aggregate linked-PR set, not the merge
event.** It closed GAM-304 on each merge that was the *last open* linked PR
(#138, #139, #140, #141, #144). It did **not** fire for #143 — the only merge
with another linked PR still open (#142) — where `start → In Progress` won
instead and moved the issue **backwards** from `In Review`.

**F4. A bare branch-name link closes the issue.** Four merges did so. #140's
body line 1 reads *"This PR does not close GAM-304. It deliberately omits the
`Closes` magic word."* It closed GAM-304 anyway, 2 seconds after merge.

**F5. `Closes GAM-304` on body line 1 did not close GAM-304.** PR #143, the
actual RSVP fix, moved it In Review → In Progress. The owner closed it by hand.

**F6. Item 28f's own precedent does not support it.** 28f cites PR #126 /
GAM-303. #126's branch is `claude/next-ready-task-xvmtcj` — **no** identifier —
so `Closes GAM-303` supplied the *link* and the same `merge → Done` automation
supplied the *close*. GAM-303 also shows F3's regression: at 15:38:55Z, the
moment #126 attached, `start` moved it In Review → In Progress.

## What to change

### C1 — item 28f (`constitution.md`, currently lines 458-476)

Both operative sentences are false and must go: an identifier in the branch
name does **not** "link only", and it does **not** leave the issue "sitting in
`In Review` after merge" — it leaves it in `Done`.

Rewrite 28f so it separates the two mechanisms it currently conflates:

- **Linking** — branch name *or* magic word (F1).
- **Closing** — the team's `merge → Done` automation, on the last linked PR
  (F2, F3). Never the magic word by itself.

Keep the `Closes GAM-nnn` requirement, but re-justify it honestly. It earns its
place because it is the explicit human-readable record of *which* PR is the
work, it survives a branch rename, and it is the only link a branch without an
identifier can have. Delete the claim that it is what closes the issue.

State the consequence an agent must act on: **once a PR is linked, its merge
participates in the issue's state, and omitting the magic word protects
nothing** (F4). And: **an issue with more than one linked PR can be moved
backwards by the merge of its own fix** (F3, F5) — so keep the linked set to
one PR where you can.

Preserve the commit-trailer paragraph as-is; it is unaffected and still true.

### C2 — item 28g (`constitution.md`, currently lines 485-488)

The "Owner action, once, outside the repo: enable *PR merged → Done*" paragraph
describes a pending request. It is done, and it is not the whole picture:
**three** automations are live and **all** are unscoped (F2). Replace the
request with the measured configuration, and note that `start → In Progress` is
the rule that produces F3's backwards move. Do not prescribe an automation
change here — that is the owner's, and it is filed separately (see Deliverable
B).

### C3 — `WORKFLOWS.md` rule 2 (currently lines 479-511)

Rule 2 already exempts *work with no issue* (line 495). The real gap is work
that **has** an issue but is **not that issue's implementation** — which is
what actually happened: `claude/gam-304-failure-p3y021` carried four PRs of CI
and salvage work and closed GAM-304 four times.

Add the distinction, using F1's measured escape:

> Only the branch that **does** an issue's work carries its identifier. A
> branch that merely **mentions** an issue — an investigation, a salvage
> commit, a CI or infrastructure fix, a follow-up that is not the
> implementation — must not put the identifier in its branch name and must not
> use a magic word. Name it `claude/<short-slug>` and refer to the issue in the
> PR body prose: a bare `GAM-nnn` in the body is measured not to link.

Line 493 currently reads "Constitution item 28f depends on it." Check that
against 28f as rewritten and correct it if it no longer holds.

**Do not** weaken the identifier-in-branch rule for real work. Its rationale
(the `claude/swarm-plan-zl575z` collision, lines 498-503) is untouched by this
issue, and the issue explicitly forbids that fix.

## Acceptance criteria

1. `constitution.md` contains no surviving claim that a branch-name or title
   identifier "links only", and none that it leaves an issue in `In Review`
   after merge.
2. Item 28f names the `merge → Done` automation — not the magic word — as the
   mechanism that closes, and states the last-open-PR condition.
3. Item 28f still requires `Closes GAM-nnn` on body line 1, on the re-stated
   grounds.
4. Item 28g states the three live automations and that they are unscoped.
5. `WORKFLOWS.md` rule 2 states the mention-vs-work distinction and the
   `claude/<short-slug>` form for a mention branch.
6. Every factual claim added traces to F1-F6. No new unmeasured claim, and in
   particular **no claim about a bare identifier in the PR title**.
7. Item 3's no-restatement rule is respected: the branch-name rule lives in
   `WORKFLOWS.md`; the constitution references it rather than duplicating it.
8. `npm run format:check` passes. No source file changed.

## Least confident decisions (item 19d)

1. **That the link set is exactly {branch name, magic word}.** F1 rests on one
   negative instance (GAM-315 unattached despite #142's prose mention). Wrong
   if Linear's body parser ignores prose but the **title** parser does not, or
   if attachment creation is asynchronous and simply never retried. This is why
   criterion 6 forbids any title claim.
2. **That `merge → Done` keys on "last open linked PR" specifically.** Five
   positives and one negative all fit, but "no other *open* PR" and "no other
   *unmerged* PR" are indistinguishable in this data — #142 was open, never
   closed-unmerged. Wrong if the real predicate is something else that happens
   to correlate.
3. **That prose-mention-without-link is stable enough to build a convention
   on.** C3 tells agents to rely on a measured *absence*. If Linear later adds
   prose-mention linking, the convention silently stops working and this issue
   recurs. Mitigation: the convention degrades to a wrong link, not a wrong
   close, and the rewritten 28f teaches the reader why either matters.
4. **That the fix belongs in prose at all.** The robust fix is scoping or
   disabling the automations in Linear, which no repository edit can reach —
   `targetBranch` scopes the PR's *base* branch, not its head, so it cannot
   express "only branches that do this issue's work." Deliverable B exists
   because of this, and if the owner disables `start → In Progress`, C2 needs
   re-measuring.
5. **That the tier is STANDARD.** Defensible because the deliverable is prose
   with no data path. Wrong if a constitution edit read by every future agent
   should count as "an export another session builds against" under item 26's
   HEAVY trigger — the compensating control is that this packet goes through a
   full item 19 premise gate regardless of tier.

## Deliverable B — separate, and not part of this diff

File a Linear follow-up for the owner's automation decision (item 20; written
per item 30 / `linear-task-writing`), labelled `gate/human`: three unscoped
automations are live, item 28g asked for one, and `start → In Progress` is what
moves an issue backwards. The owner decides; no agent may change it.
