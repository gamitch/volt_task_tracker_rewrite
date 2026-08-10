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
