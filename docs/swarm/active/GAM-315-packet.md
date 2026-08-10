# GAM-315 task packet — correct item 28f, and name the mention-vs-work distinction

> ## ⛔ ESCALATED TO THE HUMAN OWNER — DO NOT DISPATCH THIS PACKET YET
>
> **Revision 4.** The premise gate has now run **three** rounds and returned
> **REVISE** every time (round 1: 2 BLOCKER, 2 MAJOR, 4 MINOR, 2 NIT; round 2:
> 1 BLOCKER, 2 MAJOR, 3 MINOR, 1 NIT; **round 3: 0 BLOCKER, 3 MAJOR, 4 MINOR,
> 1 NIT**). Round 3 was an explicit owner exception to item 19a's two-round cap
> (*"approve the 3rd gate request"*, 2026-08-10). That ruling closed with:
> *"Do **not** open a fourth round. If round 3 returns REVISE, escalate to the
> owner again — that is the same cap, one notch out."*
>
> **So: no fourth round, and no `boss-architect` dispatch.** The constitution
> is unchanged and stays unchanged until the owner rules again.
>
> Revision 4 applies **all eight** of round 3's findings — see the change list
> below — so the owner again reviews the best available version. **That is not
> a pass**, for the same reason revision 3 was not: the orchestrator may not
> certify its own packet through a gate it has closed.
>
> **What the owner is being asked, and the argument has changed since round 2.**
> The counter-argument offered last time was that the gate's BLOCKERs were
> unmeasured *factual* claims and the plan was converging. Round 3 weakens that
> reading and the packet should say so rather than re-run it:
>
> - **The severity did fall** — 2 BLOCKER → 1 BLOCKER → **0 BLOCKER**, and
>   round 3 was a clean item 19c round with zero citation drift, where rounds 1
>   and 2 both lost budget to it. Every number the owner asked round 3 to
>   re-check (five closes, one clean exhibit, `targetBranch` = base) **held**.
> - **But round 3 still found two unmeasured claims**, and found them in
>   `WORKFLOWS.md` — a file all three rounds had been treating as settled while
>   they polished the F-list. One of them, *"connects from the first push"*, is
>   the **same claim** F1a withdrew in revision 3: struck in one file and left
>   standing in another.
> - **And the orchestrator running round 3 supplied a third one itself** (the
>   withdrawn "finding B" in the run log), which the gate refuted for want of a
>   positive control.
>
> Three rounds, three different agents, and each one found an unmeasured claim
> about the same subject. **That is the honest case for the owner deciding this
> directly rather than authorizing a fourth round** — the residual risk is not
> in any one sentence, it is that this topic reliably produces confident claims
> nobody measured, which is precisely what the row exists to fix.

Round 1's, round 2's and round 3's findings, and each revision's response, are
in `GAM-315-run-log.md`.

**Revision 4 change list** (round 3 finding → what moved):
1. MAJOR — C3 said the branch "carried four PRs"; it carried **five** (#138,
   #139, #141, #142, #144), with four closes and one no-op. Corrected in C3.
2. MAJOR — `WORKFLOWS.md:491-492`'s "from the first push" is F1a's withdrawn
   claim surviving in an Allowed File. New instruction in C3; new criterion 7b.
3. MAJOR — `AGENTS.md:36-37` carries the same false sentence. Ruled out of
   scope **explicitly**, with the authority question named, and filed as a
   Linear row (item 20). See "Deliberately NOT in scope" below.
4. MINOR — round 3 refuted this run's "branch does not link on push"
   observation. **F1a and criterion 7 stand unchanged**; the retraction is in
   the run log. F1a's weak-instrument caveat is instead *removed*, because all
   three F1d negatives are firing-armed.
5. MINOR — criterion 8's file-set check was pathspec-restricted and could not
   detect a fourth file. Replaced with an unrestricted form.
6. MINOR — "a sweep of all 200 PRs" → **148** (200 was the `--limit`).
7. MINOR — the third stale "still outstanding" site,
   `linear-webhook-dispatch.md:378`, is now in scope as **C5**.
8. NIT — round 3's clean item 19c result recorded in the run log.

Tier: **HEAVY** (re-tiered from STANDARD on the gate's finding — item 26 says
take the heavier when two are arguable, and this row is in fact receiving the
full chain: packet → premise gate → `boss-architect` → `checker-reviewer`.
Linear label updated `tier/standard` → `tier/heavy`, read back.)

Authority: `constitution.md` is `boss-architect` / `boss-arbiter` only
(Authority Boundaries, `constitution.md:22-24`); `docs/swarm/**` is
orchestrator-owned (`AGENTS.md` § Ownership). The edit goes to
**`boss-architect`**, never `worker-implementer`.

## Allowed files

- `docs/swarm/constitution.md` — item 28f, item 28g
- `docs/swarm/WORKFLOWS.md` — rule 2
- `docs/swarm/2026-08-09-tracker-migration.md` — line 245 only (F7)
- `docs/swarm/2026-08-09-linear-webhook-dispatch.md` — **line 378 only (C5)**.
  *Added in revision 4.* It carries the same falsified "still outstanding:
  enable *PR merged → Done*" request as `tracker-migration.md:245`. Round 3
  found the packet's scope arbitrary while it corrected one and not the other,
  and the distinction it might have relied on — dated narrative vs live
  checklist — does not hold, because both sentences are written as outstanding
  actions. Correcting one and leaving the other is the drift this row exists to
  stop, so both are in.

Nothing else. No code. No `.claude/**`. Do not touch the frozen ledger.

### Deliberately NOT in scope: `AGENTS.md:36-37` — deferred under item 20, and filed

`AGENTS.md:36-37` reads *"An identifier in the title or branch links but does
**not** close."* — verbatim the sentence 28f is being corrected for, in the file
Codex agents read at startup. `AGENTS.md:30` carries the same unmeasured
push-linking claim as `WORKFLOWS.md:491`. A repo-wide grep (gate round 3) finds
exactly **two** live assertions of the falsified mechanism: `constitution.md:467`
(in scope) and `AGENTS.md:37` (not). The two dated session reports quote it only
to refute it.

**It is excluded because the authority is genuinely unresolved, not because it
is unimportant.** `AGENTS.md:188-192` reserves that file to "the primary
orchestrator" and names **no boss role**; `constitution.md:22-24` reserves the
constitution to `boss-architect`/`boss-arbiter`. So the agent this packet
dispatches is the one agent the repository does not clearly authorize to edit
`AGENTS.md`, and a packet may not settle an authority question by assuming it.
Silence was the one option round 3 ruled out, so this is the explicit deferral
item 20 requires, **and the follow-up row is filed rather than left as a
comment** — item 20's whole rationale being that comments are not triaged.

**Filed as `GAM-323`** (`Backlog`, `tier/standard`, written per item 30). It
carries the authority question, both ways to close it, and a recommendation to
fold it back in here. It also records `AGENTS.md:30`'s *"connects from the first
push"* as unmeasured rather than false — the same distinction F1a draws.

**Owner: if you would rather fold this in than run a second row, say so and it
becomes a fourth Allowed File.** That is a one-line change to this section.

## The measured facts this edit must encode

Measured 2026-08-10 against Linear's GraphQL API and `gh`, on `main` `43d99c7`.
Cite nothing that is not in this list.

### F1 — Three things are known to link a PR to an issue. A bare prose mention is not one of them.

**(a) The branch name.** Sole clean exhibit: **#141** — see F4. **Automation
firing, not attachment count, is the instrument** wherever the two differ.
*Revision 4 removes the caveat that used to sit here:* **all three of F1d's
negatives are firing-armed**, not just GAM-315, so none of them depends on
attachment counts at all (gate round 3, measured). Attachment emptiness on its
own proves nothing in this workspace — a sweep of the first 40 GAM issues
returned 13 attachments, every one `sourceType: "github"` with a `/pull/` URL
and **zero** of branch type, so there is no positive control that a branch link
ever produces an attachment.

*Withdrawn in revision 3:* an earlier draft claimed GAM-304's
`Backlog → In Progress` at `2026-08-10T02:23:20.568Z` was a branch push 48
minutes before PR #138 existed. **That is not measured and git does not support
it** — the earliest commit on any `gam-304`-named ref is `2467554` at
`03:09:32Z`, *after* the transition, and GitHub's events API returns nothing
for those refs. A branch pushed at `main`'s tip with no commit of its own would
explain it, but that is a hypothesis. Whether the branch name links *on push,
before a PR exists* is **unmeasured**; do not write it into the constitution.

**(b) A magic word** (`Closes`/`Fixes`/`Resolves` + identifier) in the body.
Clean exhibit: #126 → GAM-303, whose branch `claude/next-ready-task-xvmtcj`
carries no identifier.

**(c) An identifier in the PR *title*, OR a magic-word token appearing in
negated prose.** These two cannot be separated by any data in this repository,
and the packet does not pretend otherwise. #132's title carries `GAM-310`, its
branch does not — and its body line 3 reads **"Deliberately not
`Closes GAM-310`."**, which contains the magic-word token. GAM-310 went
`Backlog → In Progress` on open and `→ Done` on merge, and was reopened by
hand. #131 is confounded the same way (title `GAM-309`, plus a genuine
`Closes GAM-309`). A sweep of all **148** PRs found exactly three with a
title identifier absent from the branch — #132, #131, and #125 (`GAM-000`, not
a real issue) — so no clean case exists.

**This is already recorded in the repository and the round-1 packet missed it:**
`docs/swarm/2026-08-09-linear-webhook-dispatch.md:423-449`, headed *"Item 28f is
wrong: a title identifier closes the issue too."*, and
`docs/swarm/2026-08-09-dispatch-session-report.md:129-136`.

**The disjunction does not need resolving, because the safe rule is identical
under both horns:** keep the identifier out of the branch name *and* the title,
and away from `close`/`fix`/`resolve`. Write 28f so it is correct either way.
The experiment that would settle it — a throwaway issue plus a PR carrying its
identifier in the title and no magic-word token anywhere — was **deliberately
not run**, because it means firing a live automation against the tracker to
learn something that changes no prescription. Say so in the constitution rather
than leaving a reader to wonder.

**(d) NOT a bare prose mention.** Three independent negatives:
- #142's body line 1 names `GAM-315`. GAM-315 was created `04:54:22Z`, eight
  hours before #142 opened (`13:17:02Z`); it sat in `Backlog` with no
  attachment and **no state transition** across #142's entire open→merge life.
- #146 (branch `claude/cost-analysis-review-239rld`, no magic-word token
  anywhere) names GAM-304 and is not among its seven attachments.
- #128 names GAM-303, GAM-308, GAM-309, GAM-237, GAM-302 with no magic-word
  token; GAM-303's only attachment is #126 and GAM-309's only attachment is
  #131.

### F2 — The magic word is not what closes. A team automation is.

Team `GAM`'s `gitAutomationStates`, read from Linear on 2026-08-10:

```
event=start   targetBranch=null (ANY) -> In Progress (started)
event=review  targetBranch=null (ANY) -> In Review   (started)
event=merge   targetBranch=null (ANY) -> Done        (completed)
```

`targetBranch: null` means unscoped. It is also the PR's **base** branch, not
its head — so no branch-naming scheme can be expressed there. Reproduce with:

```js
gql('{ teams(first:5){ nodes{ key gitAutomationStates(first:30){ nodes{ event targetBranch{ id branchPattern isRegex } state{ name type } } } } } }')
```

### F3 — `merge → Done` computes from the aggregate linked-PR set, not the merge event.

Fired on #138, #139, #140, #141, #144 — each the last *open* linked PR at its
own merge. Did **not** fire on #143, the only merge with another linked PR
still open (#142, open `13:17:02Z` → `14:22:46Z`); there `start → In Progress`
won and moved the issue **backwards** from `In Review`.

**#142's own merge produced no transition at all.** GAM-304 was already `Done`
(owner hand-close `14:18:16.288Z`), so the rule was a no-op. A no-op merge is
unobservable in state history, which bounds what this data can ever show — the
predicate is only testable where the target state differs.

### F4 — A branch-name link alone closes the issue. One clean exhibit: #141.

Per-channel matrix for GAM-304's seven linked PRs. Every later claim is
checkable against it:

| PR | `GAM-304` in title | in branch | magic-word token in body | outcome |
| -- | -- | -- | -- | -- |
| #138 | no | **yes** | **yes** | → Done |
| #139 | **yes** | **yes** | no | → Done |
| #140 | **yes** | **yes** | **yes** | → Done |
| **#141** | **no** | **yes** | **no** | **→ Done** |
| #142 | no | **yes** | **yes** | no transition (already Done) |
| #143 | **yes** | **yes** | **yes** | → In Progress |
| #144 | **yes** | **yes** | no | → Done |

**Exactly one PR is a clean branch-name-only link: #141** (merged `11:54:41Z` →
`In Progress → Done` `11:54:43.137Z`). Its body mentions `GAM-304` only in bare
prose, which F1d measures as non-linking.

**The other six are confounded** — #138, #140, #142 by a magic-word token;
#139 and #144 by a **title** identifier, which F1c has just established as a
live channel; #143 by both. Revision 2 removed the magic-word confound from
this exhibit set and introduced a title confound in the same sentence, by not
applying F1c backwards.

**Say this plainly in the constitution: the branch-name channel rests on a
single clean observation.** It is enough — #141's transition is unambiguous and
2.1 seconds after merge — but an architect must not write "three PRs
demonstrate".

Counts, stated precisely because round 1 got them wrong: of the seven, **six**
intended no magic word (only #143 did), **three** contain no magic-word token
at all (#139, #141, #144), and **five** drove the issue to `Done`.

### F8 — Commit messages do not link.

Commit `c865b51` (`2026-08-10T13:33:21Z`), message *"docs(swarm): GAM-304 three
MINOR follow-ups filed as GAM-318/319/320"*, sits on `claude/gam-304-rsvp-write`
→ PR #143, whose branch, title and body reference **only** GAM-304. `GAM-318`
appears nowhere but that commit message. Measured: **GAM-318 has zero
attachments and zero state transitions**, created `13:33:06.738Z` and still
`Backlog` — unmoved across the push (`13:33:21Z`), the PR opening (`13:37:13Z`)
and the merge (`14:00:01Z`). On a team whose automations are unscoped, a link
would have fired `start` at open and `merge → Done` at merge. Nothing fired.

This is stronger than the constitution's existing "Linear does not read commit
trailers" claim, because it is a commit-message **body** in canonical form.
GAM-319 and GAM-320 corroborate only weakly — they appear as bare suffixes in
`GAM-318/319/320`, so their tokenization is not established. **GAM-318 alone
carries the test; say so.**

### F5 — `Closes GAM-304` on body line 1 did not close GAM-304.

PR #143, the actual RSVP fix, moved it `In Review → In Progress`. The owner
closed it by hand at `14:18:16.288Z`.

### F6 — The state history's actor column is misleading.

Six merge-coincident transitions on GAM-304 (`04:02:01.165`, `04:56:38.276`,
`05:29:22.791`, `11:54:43.137`, `14:00:04.088`, `14:56:19.490`): four
attributed to "George Mitchom", two to `bot:GitHub(integration)`. The split
tracks the **PR author** — `app/claude` (#140, #143) → bot actor; `gamitch`
(#138, #139, #141, #144) → mapped Linear user. `mergedBy` is `gamitch` for all
seven. The seventh transition in that window (`14:18:16.288Z`) is the owner's
hand-close and follows no merge.

### F7 — Item 28f's own precedent does not support it, and a third file repeats the falsified sentence.

28f cites PR #126 / GAM-303 as proof the magic word "links **and** closes."
#126's branch carries no identifier, so `Closes GAM-303` supplied the *link* and
the same `merge → Done` automation supplied the *close* — consistent with the
magic word doing nothing but linking. GAM-303 shows F3's regression too: at
`15:38:55.013Z`, the millisecond #126 attached, `start` moved it
`In Review → In Progress`.

`docs/swarm/2026-08-09-tracker-migration.md:245` still carries the same
falsified request ("Enable the Linear automation *PR merged → Done*… Until it
is on, issues sit in `In Review` after their PR lands").

## What to change

### C1 — item 28f (`constitution.md:458-476`)

Both operative sentences are false and must go: an identifier in the branch
name or title does **not** "link only", and it does **not** leave the issue
"sitting in `In Review` after merge" — it leaves it in `Done`.

Rewrite 28f to separate the two mechanisms it currently conflates:

- **Linking** — branch name, title, or magic word (F1a-c). Not a bare prose
  mention (F1d) and not a commit message (F8). **Write "known to link", not an
  exhaustive list** — PR comments were never testable here.
- **Closing** — the team's `merge → Done` automation, when the last linked PR
  merges (F2, F3). Never the magic word by itself.

Keep the `Closes GAM-nnn` requirement, re-justified honestly: it is the explicit
human-readable record of *which* PR is the work, it survives a branch rename,
and it is the only link a branch without an identifier has. Delete the claim
that it is what closes.

State the two consequences an agent must act on:
1. **Once a PR is linked, its merge participates in the issue's state, and
   omitting the magic word protects nothing** (F4, F1c).
2. **An issue with more than one linked PR can be moved backwards by the merge
   of its own fix** (F3, F5) — keep the linked set to one PR.

Record the unresolved F1c disjunction in one sentence, and that the experiment
was declined on purpose. A constitution that says "we do not know which of
these two, and here is the rule that is safe either way" is more useful than
one that picks a horn it cannot defend.

Preserve the commit-trailer paragraph unchanged; it is unaffected and true.

The 28f heading currently reads *"Put the identifier in the PR title, and keep
the commit trailer."* Reconcile it — as rewritten, a title identifier is a
*link*, so the heading must not imply it is a safe, non-closing reference.

### C2 — item 28g (`constitution.md:478-488`, owner-action paragraph at 485-488)

The "Owner action, once, outside the repo: enable *PR merged → Done*" paragraph
describes a pending request. It is done, and three automations are live, all
unscoped (F2). Replace the request with the measured configuration —
**date-stamped and naming the query that reproduces it** (F2), because a prose
enumeration goes stale silently the moment the owner acts, which is the exact
failure being corrected. Note that `start → In Progress` is the rule producing
F3's backwards move. Do not prescribe an automation change; that is the owner's
and is filed as Deliverable B.

### C3 — `WORKFLOWS.md` rule 2 (`479-511`)

The gap is work that **has** an issue but is **not that issue's
implementation**: `claude/gam-304-failure-p3y021` carried **five** PRs of CI and
salvage work — #138, #139, #141, #142, #144 — and drove GAM-304 to `Done`
**four** times. **The fifth (#142) was a no-op**, because the owner had
hand-closed the issue four minutes before it merged; a merge rule is only
observable where the target state differs (F3). *Corrected in revision 4 — the
packet said "four PRs … four times", and the count of PRs was wrong.* Quote the
numbers in this form, with the no-op named, so the fifth is not re-derived as a
fifth close. Rule 2's existing exemption (line 495) covers only work with *no*
issue.

**Primary instruction — give mention-work its own issue.** This is already the
repository's own recorded conclusion
(`2026-08-09-dispatch-session-report.md:134-135`,
`linear-webhook-dispatch.md:441-443`: *"keep the identifier out of the title, or
give partial work its own issue"*). It depends on no measured *absence* in a
third-party parser, so prefer it.

**Mechanical fallback, when a separate issue is not warranted.** Extend line
495's existing sentence rather than adding a competing paragraph — the rule
belongs in one place. The identifier must appear in **none** of: the branch
name, the PR title, or the same sentence as a `close`/`fix`/`resolve` token.
A bare prose mention elsewhere in the body is measured safe (F1d).

**"Adjacent" must be defined, because a checker has to apply it.** Use
*same sentence* — deliberately stricter than the parser. The bound is #142's
own body line 1: *"Merging closes GAM-304 via the branch-name link
(GAM-315)"*. `GAM-315` sits in the same sentence as `closes` and was measurably
**not** linked (F1d), so Linear's parser is *not* sentence-scoped; the tight
form (identifier must not immediately follow the token) is what the data
supports. A rule should prescribe the safe side of a boundary it knows only
approximately, so prescribe *same sentence* and say why it is stricter than
measured.

**This constraint is not optional and round 1 got it wrong.** Prose written
*about* a linking hazard reliably contains the magic-word pattern: #142, #138
and #140 each carry `close(s) GAM-304` in the sentence explaining they must not
close it. A rule that renames the branch but permits that sentence converts a
branch-name link into a magic-word link and changes nothing.

**Show the compliant form, not only the rejections.** All three exhibits
*needed* to say "merging this must not close GAM-304"; a rule that forbids the
only sentence its authors wanted, without showing what to write instead,
invites improvisation. The worked rewrite: **"merging this must not close the
issue this branch is named for"** — no identifier, so no channel. Or take the
primary instruction and give the work its own issue.

**Strike or qualify the "from the first push" clause at `WORKFLOWS.md:491-492`.
Added in revision 4; the packet had missed it for three rounds.** The sentence
reads: *"Linear links a branch whose name contains the issue identifier, so the
issue connects **from the first push** rather than waiting on a PR title.
Constitution item 28f depends on it."* **That is the exact claim F1a withdraws
as unmeasured**, sitting in an Allowed File — and previous revisions told the
editor to check line 493, the *last* sentence of that same paragraph, while
saying nothing about the unmeasured claim two lines above it. Rewrite it to say
only what is measured: a branch-name identifier links (F1a, one clean exhibit,
#141) — with no claim about *when* the link is created. Round 3's attempt to
measure the push timing was itself refuted for want of a positive control, so
do not replace one unmeasured timing claim with another.

Line 493 reads "Constitution item 28f depends on it." Check against 28f as
rewritten and correct if it no longer holds.

**Do not** weaken the identifier-in-branch rule for real work. Its rationale
(the `claude/swarm-plan-zl575z` collision, lines 498-503) is untouched here, and
the issue forbids that fix. Say so directly: this carves out mention-branches
only, and the issue's constraint is respected.

### C4 — `2026-08-09-tracker-migration.md:245`

Mark the "enable *PR merged → Done*" outstanding item done, pointing at 28g as
rewritten. One line. Do not restructure the document.

### C5 — `2026-08-09-linear-webhook-dispatch.md:378` *(added in revision 4)*

Same one-line correction as C4, same reason. Line 378 reads *"Also still
outstanding from the migration: enable the Linear automation **PR merged →
Done**."* It is not outstanding — three automations are live and unscoped (F2).
Mark it done and point at 28g as rewritten. Do not restructure the document,
and do not touch §10 (`423-449`), which is already correct and is F1c's source.

## Acceptance criteria

Criteria 1-7 are prose judgements for `checker-reviewer`. Criterion 8 is
mechanical and **can fail** — round 1's `format:check` criterion could not,
because that script's glob (`src/**/*.{ts,tsx}`, `*.{ts,js,json,html}`) matches
**no markdown**, so it measures nothing about this diff.

1. No surviving claim in `constitution.md` that a branch-name or title
   identifier "links only", and none that it leaves an issue in `In Review`
   after merge.
2. Item 28f names the `merge → Done` automation — not the magic word — as what
   closes, and states the last-linked-PR condition.
3. Item 28f still requires `Closes GAM-nnn` on body line 1, on the re-stated
   grounds, and its heading no longer implies a title identifier is a safe
   non-closing reference.
4. Item 28f records the F1c disjunction and that the settling experiment was
   declined deliberately.
5. Item 28g states the three live automations, that they are unscoped,
   date-stamped, and names the reproducing query.
6. `WORKFLOWS.md` rule 2 leads with "give mention-work its own issue" and gives
   the three-place fallback (branch, title, same-sentence magic word) with
   "same sentence" stated explicitly, demonstrated against #142, #138 and #140
   **plus one worked compliant rewrite**.
7. Every factual claim added traces to F1-F8. No new unmeasured claim; in
   particular nothing that resolves F1c's disjunction, and nothing asserting
   that a branch name links on push (F1a, withdrawn).
7b. **Surviving claims count, not only added ones.** No unmeasured claim is
   left standing in any Allowed File — specifically, `WORKFLOWS.md:491-492`'s
   "connects **from the first push**" is struck or qualified. *Added in
   revision 4:* criteria 1 and 7 between them covered `constitution.md`
   surviving claims and `WORKFLOWS.md` *added* ones, and a checker applying
   them literally would have passed a diff leaving that sentence in place.
8. **Runnable — each check can fail, and none matches this packet.** Round 1's
   `format:check` criterion could not fail; revision 2's greps 3 and 4 could
   not pass. Both are corrected here:
   - `grep -n "links only" docs/swarm/constitution.md` → no match
     (matches `:467` today, so it can fail).
   - `grep -n "sitting in" docs/swarm/constitution.md` → no match
     (matches `:469` today).
   - `grep -n "Until that is on" docs/swarm/constitution.md` → no match.
   - `grep -n "Until it" docs/swarm/2026-08-09-tracker-migration.md` → no
     match. **Anchored to the file, and to `Until it` alone**, because that
     document wraps the phrase across `:245`/`:246` — revision 2's
     `Until it is on` never matched it, and its `-r docs/swarm/` form matched
     this packet, so correct work was marked failed.
   - `grep -n "from the first push" docs/swarm/WORKFLOWS.md` → no match
     (matches `:491` today, so it can fail). *Added in revision 4 for 7b.*
   - **File-set check, corrected in revision 4.** The previous form was
     `git diff --name-only main -- <the three files>`, which is
     pathspec-restricted and therefore **could only ever return a subset of
     those three** — it could not detect a fourth file, so the second half of
     the criterion had no command behind it. Use the unrestricted form:
     ```sh
     git diff --name-only main \
       | grep -vE '^docs/swarm/(constitution|WORKFLOWS|2026-08-09-tracker-migration)\.md$' \
       | grep -v '^docs/swarm/active/'
     ```
     → no output. This can fail, and it measures the whole diff.

## Least confident decisions (item 19d)

1. **That declining the F1c experiment is right.** A throwaway issue plus one
   PR would settle title-vs-negated-magic-word for good. Wrong if the
   distinction ever drives a different prescription — it does not today,
   because the safe rule is the same under both horns, but a future reader who
   wants to *use* a title identifier deliberately has no answer.
2. **That "give mention-work its own issue" is actually cheaper.** It trades a
   parser dependency for tracker noise: every CI fix touching an issue's
   context becomes a new row. Wrong if that noise is worse than the rare wrong
   close — the owner, not this packet, is the judge of that.
3. **That the three-place fallback is complete.** Narrowed in revision 3: the
   commit-message channel is now **closed** by F8 (GAM-318 took zero
   attachments and zero transitions across push, open and merge), so the only
   untested channel left is **PR comments**. Those were untestable here — the
   sole comments naming an identifier anywhere in the window are
   `linear-code[bot]`'s own linkbacks, posted *because* the PR is already
   linked. C1 must therefore say "known to link", not "these are all".
4. **That prose enumeration in C2 is acceptable at all.** LCD #4 of round 1 and
   the gate both note it goes stale silently the moment Deliverable B lands.
   The date-stamp and named query are a mitigation, not a fix. Wrong if the
   owner acts on Deliverable B and nobody re-runs the query.
5. **That HEAVY is now the right tier.** Re-tiered on the gate's argument. It
   may be over-correction: the diff is prose in three governance files with no
   data path, and the real risk was in the *premise*, which two gate rounds
   have now attacked. Wrong if the `checker-reviewer` round finds nothing a
   careful read would not — but item 26's tie-break makes that the cheap error.

## Deliverable B — a separate Linear filing, but its draft *is* in this diff

Corrected in revision 3: revision 2 said "not part of this diff" while
`docs/swarm/active/GAM-315-deliverable-b.md` was already committed at
`929c0be`. Both could not be true.

**The draft file is part of this diff** — it lives under
`docs/swarm/active/`, which is orchestrator-owned, alongside the packet and run
log. What is *not* part of this diff is the **Linear issue** it becomes, and
the owner action it requests.

The filing (item 20, written per item 30 / `linear-task-writing`) is labelled
`gate/human`: three unscoped automations are live where item 28g asked for one,
`start → In Progress` is what moves an issue backwards, and `targetBranch`
scopes the PR's *base* branch so it cannot express a head-branch scheme. The
owner decides; no agent may change it.
