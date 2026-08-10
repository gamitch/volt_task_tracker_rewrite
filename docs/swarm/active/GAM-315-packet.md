# GAM-315 task packet — correct item 28f, and name the mention-vs-work distinction

**Revision 2**, after premise-gate round 1 returned REVISE (2 BLOCKER, 2 MAJOR,
4 MINOR, 2 NIT). Round 1's findings and this revision's response are in
`GAM-315-run-log.md`. Item 19a caps the gate at two rounds; this is round 2's
input.

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

Nothing else. No code. No `.claude/**`. Do not touch the frozen ledger.

## The measured facts this edit must encode

Measured 2026-08-10 against Linear's GraphQL API and `gh`, on `main` `43d99c7`.
Cite nothing that is not in this list.

### F1 — Three things are known to link a PR to an issue. A bare prose mention is not one of them.

**(a) The branch name.** And it fires *before any PR exists*: GAM-304 moved
`Backlog → In Progress` at `2026-08-10T02:23:20.568Z` on a branch push — 48
minutes before PR #138 was created (`03:11:02Z`) and with no attachment
recorded. **Automation firing, not attachment count, is the instrument here**;
attachments are the weaker test because a link can act without creating one.

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
`Closes GAM-309`). A sweep of all 200 PRs found exactly three with a
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

### F4 — A branch-name link alone closes the issue.

Clean exhibits — identifier in the branch name only, **no** magic-word token
anywhere in the body: #139 (merged `04:56:36Z` → `In Progress → Done`
`04:56:38.276Z`), #141 (`11:54:41Z` → `11:54:43.137Z`), #144 (`14:56:17Z` →
`14:56:19.490Z`).

Counts, stated precisely because round 1 got them wrong: of GAM-304's seven
linked PRs, **six** intended no magic word (only #143 did), **three** contain no
magic-word token at all (#139, #141, #144), and **five** drove the issue to
`Done` (#138, #139, #140, #141, #144). **#138 and #140 are not clean exhibits**
— each contains `close GAM-304` inside the very sentence disclaiming it (#140:
*"This PR does not close GAM-304. It deliberately omits the `Closes` magic
word."*). Do not cite them for the "no magic word" point.

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

- **Linking** — branch name, title, or magic word (F1a-c). Note that the
  branch name links on push, before a PR exists.
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
implementation**: `claude/gam-304-failure-p3y021` carried four PRs of CI and
salvage work and closed GAM-304 four times. Rule 2's existing exemption
(line 495) covers only work with *no* issue.

**Primary instruction — give mention-work its own issue.** This is already the
repository's own recorded conclusion
(`2026-08-09-dispatch-session-report.md:134-135`,
`linear-webhook-dispatch.md:441-443`: *"keep the identifier out of the title, or
give partial work its own issue"*). It depends on no measured *absence* in a
third-party parser, so prefer it.

**Mechanical fallback, when a separate issue is not warranted.** Extend line
495's existing sentence rather than adding a competing paragraph — the rule
belongs in one place. The identifier must appear in **none** of: the branch
name, the PR title, or adjacent to `close`/`fix`/`resolve` anywhere in the
body. A bare prose mention elsewhere in the body is measured safe (F1d).

**This constraint is not optional and round 1 got it wrong.** Prose written
*about* a linking hazard reliably contains the magic-word pattern: #142, #138
and #140 each carry `close(s) GAM-304` in the sentence explaining they must not
close it. A rule that renames the branch but permits that sentence converts a
branch-name link into a magic-word link and changes nothing. Demonstrate the
rewritten rule against #142, #138 and #140 and show it rejects all three.

Line 493 reads "Constitution item 28f depends on it." Check against 28f as
rewritten and correct if it no longer holds.

**Do not** weaken the identifier-in-branch rule for real work. Its rationale
(the `claude/swarm-plan-zl575z` collision, lines 498-503) is untouched here, and
the issue forbids that fix. Say so directly: this carves out mention-branches
only, and the issue's constraint is respected.

### C4 — `2026-08-09-tracker-migration.md:245`

Mark the "enable *PR merged → Done*" outstanding item done, pointing at 28g as
rewritten. One line. Do not restructure the document.

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
   the three-place fallback (branch, title, magic-word adjacency), demonstrated
   against #142, #138 and #140.
7. Every factual claim added traces to F1-F7. No new unmeasured claim; in
   particular nothing that resolves F1c's disjunction.
8. **Runnable:** `grep -n "links only" docs/swarm/constitution.md` → no match.
   `grep -n "sitting in" docs/swarm/constitution.md` → no match.
   `grep -rn "Until that is on\|Until it is on" docs/swarm/` → no match.
   `git diff --name-only main` lists only the three Allowed files.

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
3. **That the three-place fallback is complete.** It is the union of everything
   measured to link. Wrong if a fourth channel exists — commit messages and PR
   *comments* were never tested, and Linear parses both in some
   configurations. C1 should not claim the list is exhaustive, only that these
   three are known.
4. **That prose enumeration in C2 is acceptable at all.** LCD #4 of round 1 and
   the gate both note it goes stale silently the moment Deliverable B lands.
   The date-stamp and named query are a mitigation, not a fix. Wrong if the
   owner acts on Deliverable B and nobody re-runs the query.
5. **That HEAVY is now the right tier.** Re-tiered on the gate's argument. It
   may be over-correction: the diff is prose in three governance files with no
   data path, and the real risk was in the *premise*, which two gate rounds
   have now attacked. Wrong if the `checker-reviewer` round finds nothing a
   careful read would not — but item 26's tie-break makes that the cheap error.

## Deliverable B — separate, not part of this diff

File a Linear follow-up for the owner's automation decision (item 20, written
per item 30 / `linear-task-writing`), labelled `gate/human`: three unscoped
automations are live where item 28g asked for one, `start → In Progress` is
what moves an issue backwards, and `targetBranch` cannot express a head-branch
scheme. The owner decides; no agent may change it.
