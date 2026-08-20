# Owner session record — 2026-08-19

Interactive Claude Code (remote) session, owner present. Written as a handoff
because the session's context was filling. **Read §1 and §7 first; the rest is
reference.**

Companion to `2026-08-18-owner-session-record.md`, which covers Phase 0.

---

## 1. State right now

**All three product rows are merged and `Done`.** They were promoted by the
owner, dispatched together, and closed within ninety minutes:

| Row         | What                                                     | Tier judged | PR   | Outcome                        |
| ----------- | -------------------------------------------------------- | ----------- | ---- | ------------------------------ |
| **GAM-387** | app has no error boundary — any deploy blanks the screen | **HEAVY**   | #206 | merged 00:37 — stranded first |
| **GAM-377** | outreach dialog saves inverted sessions → negative hours | HEAVY       | #207 | merged 00:37 — stranded first |
| **GAM-356** | `participation_pct` mistyped, renders `null%`            | STANDARD    | #205 | merged 00:10 — self-published |

Their file surfaces were verified disjoint before promotion (the manual version
of plan §5.9 admission control), and that held: three branches, no conflicts,
three clean merges. **GAM-378 remains deliberately queued** — it edits
`OutreachEventDialog.tsx`, which GAM-377 has now changed, and it also collides
with GAM-363/364 on `OutreachDetail.tsx`.

**GAM-387 was judged HEAVY, not STANDARD** as the pre-dispatch note in this
section originally recorded. Its packet took HEAVY under item 26's "if two tiers
are arguable, take the heavier one", on item 19b's novel-pattern trigger. The
gate then earned it — see §2.

**GAM-387 and GAM-377 both stranded at PR creation and were published by hand**
from their preserved `docs/swarm/active/GAM-<n>-pr-body.md` artifacts, verbatim.
The preservation convention worked exactly as designed: no work was
reconstructed, no gate was re-run, and the only edit to either body was the
attribution footer. **This is the second time the artifact has been the thing
that saved a run** (#159→#160, then GAM-403). Treat it as load-bearing.

**PR #203 (GAM-403) is merged** (00:17, by the owner). The preflight patch is
**still unapplied** — `docs/swarm/active/GAM-403-dispatch-preflight.patch`,
`git apply --check` exits 0. Until an owner-scoped session applies it, the
script on `main` is not wired to anything and the dispatch loop still has no
credential preflight. **Merging #203 changed no runtime behaviour; this is the
half that does.**

**GAM-404 did not strand — it escalated and stopped deliberately** at 23:00,
after ~30 minutes, when `checker-premise` returned REVISE for the second time
and item 19a's two-round cap fired. Its branch
(`claude/gam-404-terminal-failure-notify`) carries a packet and run log, no
product code, and its own next-session instruction: fold round 2's required
revision into packet revision 3, then dispatch `worker-implementer` directly —
no third premise round needed if the owner or `boss-architect` accepts the fix.
**Its Linear row still reads `In Progress`**, which is precisely the failure
shape GAM-404 exists to fix, occurring on GAM-404 itself.

---

## 2. The finding that matters most: a PR strands on _when you call `gh pr create`_

> **Corrected 2026-08-20, after GAM-421 measured it properly.** This section
> originally read "PR strands are a _duration_ effect" and concluded that "tier
> predicts stranding only because tier predicts duration". **That conclusion is
> wrong**, and the table below was mislabelled: its figures were the minute each
> run *called* `gh pr create`, not how long the run lasted. The numbers were
> right; the column header and the causal claim on top of them were not. What
> the corrected evidence says is at the end of this section — and it is better
> news, because it means no run has to get faster.

GAM-403's run measured it directly rather than inferring it. The `claude[bot]`
installation token that opens pull requests **expires an hour after it is
minted**:

```
POST /pulls  ->  422 (authorized)      at minute 6
POST /pulls  ->  401 Bad credentials   at minute 74
```

Across every run on 2026-08-18/19, **by the minute each run called
`gh pr create`** — not by how long the run lasted:

| Run               | Minute of the PR call | Opened its own PR? |
| ----------------- | --------------------- | ------------------ |
| GAM-412           | ~4 min                | yes                |
| GAM-410 / GAM-411 | ~10 min               | yes                |
| GAM-404           | n/a — escalated, never called it | n/a     |
| **GAM-356**       | **~51 min**           | **yes**            |
| **GAM-387**       | **~70 min**           | **no**             |
| **GAM-377**       | **~71 min**           | **no**             |
| GAM-403           | 74 min                | **no**             |
| GAM-407           | 92 min                | **no**             |

Every call before the hour succeeded; every call after it failed. **GAM-333's
"8 of 13 stranded" is very likely this, not a permissions defect.** Filed as
**GAM-421**, and now answered by it — see below.

**The 2026-08-19 batch confirmed the boundary prospectively**, which is stronger
than the retrospective fit. §7 of this record predicted before the fact that
GAM-377 (HEAVY) would strand. All three rows were dispatched within 37 seconds
of each other, ran the same loop against the same repo, and split cleanly:

```
GAM-356  In Progress 23:10:24  ->  PR opened  00:01:46   (minute ~51)  PASS
GAM-387  In Progress 23:10:02  ->  401        00:20:29   (minute ~70)  STRAND
GAM-377  In Progress 23:09:47  ->  401        00:20:38   (minute ~71)  STRAND
```

These minutes are measured from each row's Linear `In Progress` stamp; GAM-421
measures the same PR from job start and gets 53.2 for GAM-356, so treat the
basis as ±2 minutes, not to the second.

### What GAM-421 then established, correcting this section

**The lifetime is exact, not approximate.** The `ghs_` token is a JWT that
states its own expiry. Decoded live on GAM-421's run: `iat 00:46:26Z`,
`exp 01:46:26Z` — **3600 seconds to the second.** GAM-421's own filing had
admitted the one-hour figure was GitHub's documented behaviour rather than a
measurement; it is a measurement now. A run can read its own deadline at minute
1 by base64url-decoding the payload.

**The deciding variable is the PR call, not the run's length.** Measured across
all 50 dispatch runs and every PR in this repository: of the **21** PRs
`claude[bot]` has ever opened inside a dispatch run, **21 were at or before
minute 60 and 0 after** — latest 53.2 min (PR #205), under worst-case
attribution across concurrent runs, which biases the search toward finding a
late one. The only PR opened later anywhere, #162 at 81.9 min, was opened by a
human.

**And long runs are not doomed.** Run #42 lasted **94 minutes and opened two
PRs**. Run #47 lasted 73 minutes, opened PR #205 at minute 53, then ran another
20. Run #6 lasted 60 minutes and opened none.

So the original conclusion here — that tier predicts stranding because tier
predicts duration — **was a coincidence of this batch**, in which both HEAVY
runs happened to defer their PR to the very end. The rule is simply: **open the
PR early, as a draft, and push into it.** No run has to get faster. GAM-421 made
that `AGENTS.md`'s third wall and its own run opened PR #208 at minute 8, with
~56 minutes of credential to spare.

**One correction inside the correction, from GAM-421's own gate:** that run
published a claim that `git push` is on the same 60-minute clock and that "the
branch is not a safe harbour". Both false, both retracted. `git push`
authenticates as the long-lived `github_pat_` in
`http.https://github.com/.extraheader`, which **outranks** the expiring token in
the remote URL. **The branch is a safe harbour after the hour; only the PR call
is not.** This also revives the cheapest of the four fixes — granting the PAT
`pull_requests: write` — which the retracted claim had written off.
**GAM-425** holds that choice; all four options remain unchosen.

Two related corrections from the same run, worth not re-deriving:

- **The two credentials are complementary, not redundant.** The PAT: `200` on
  `/user`, **`403` on PR creation**. The App token: `403` on `/user`, **`422` on
  PR creation — meaning authorized.** Pinning "the proven credential" naively
  would hand the agent the one token that cannot open a PR.
- **`.permissions` is a false negative.** The App token reports `push:false`
  and then pushes successfully. Probe capability by attempting the operation.

---

## 3. Awaiting the owner

| Row                       | Decision                                                                                                                                                                                                                                                                                                                                                           |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **GAM-419**               | Where the control plane lives. Recommendation: **A2 — dedicated Supabase project, on free, with a tripwire.** Measured effort: one project, one redeploy, six secrets, one webhook field, one config convention. **The ops schema does not move because it is not deployed anywhere** (zero migrations reference it). Today a redeploy; after Phase 2 a migration. |
| **GAM-403 patch**         | #203 is merged. **The preflight patch is still unapplied** — `docs/swarm/active/GAM-403-dispatch-preflight.patch`, `git apply --check` exits 0. Needs an owner-scoped session; a dispatched run cannot write `.github/workflows/` (GAM-328)                                                                                                                          |
| **GAM-404**               | escalated at item 19a's two-round cap, not stranded. Accept the round-2 revision and dispatch `worker-implementer` directly, or send it back for a third premise round. Its row still reads `In Progress` and should be corrected either way                                                                                                                        |
| **GAM-425**               | **which of the four fixes for the expiring PR credential.** GAM-421 measured the defect and made "open the PR early" doctrine, but chose nothing. The cheapest option — grant the PAT `pull_requests: write` — was briefly written off by a claim GAM-421 has since retracted, so it is live again                                                                  |
| **GAM-424**               | `scripts/dispatch-preflight.mjs` is 574 merged, tested lines that **nothing calls**. GAM-403's wiring is still the unapplied patch, so the defect GAM-403 was filed to fix is still live. Half is unblocked today: `--stage=pr` is an `AGENTS.md` standing order, and a dispatched run can push `AGENTS.md`                                                        |
| **GAM-415**               | CI runs SQL suites on `postgres:16` while `config.toml` says 17. Bumping moves nine green suites onto a new major — owner's call                                                                                                                                                                                                                                   |
| **GAM-384 / GAM-394**     | **duplicates of each other** (both: `gate-run` documents 377 warnings, real is 379). Mark one Duplicate                                                                                                                                                                                                                                                            |
| **GAM-62 / 74 / 75 / 80** | migration-era `gate/human` rows from 2026-08-09, untouched since. Done, obsolete, or real?                                                                                                                                                                                                                                                                         |

---

## 4. Backlog triage (done 2026-08-19)

**91 open rows. 47 carried `unreviewed`** — no tier judged, so item 28d forbids
starting them. Roughly **20 product bugs, 15 test-harness, 45 process/meta**.
The process rows outnumber product rows more than 2:1.

Priorities set this session:

- **Urgent:** GAM-387 (error boundary), GAM-395 (kiosk `checkin-token` undeployed
  — user-facing broken), GAM-404 (silent terminal failures)
- **High:** GAM-352, GAM-377, GAM-378, GAM-359, GAM-196, GAM-390, GAM-391
- **Medium:** GAM-356, GAM-358, GAM-363, GAM-364, GAM-337, GAM-357
- **Demoted to Low:** GAM-312, 313, 321, 324, 286, 297 — process documentation

**GAM-387 supersedes GAM-352.** The error-boundary row says so explicitly:
GAM-352 reported the blank screen as a check-in defect when it is app-wide.

---

## 5. Two open questions nobody has answered

1. **Do dispatched runs read Linear comments, or only the issue body?**
   **Evidence now points at "no", by this question's own stated test.** All
   three rows carried a posted parallelism instruction. None of the three run
   logs mentions it — no occurrence of "parallel", "concurrent" or
   "simultaneous" in any of them — and GAM-356's log records its subagent
   dispatches as `run_in_background: false`, i.e. serial by choice. That is the
   outcome this entry named in advance as the answer.

   **Not yet proof, and worth closing properly.** Absence from a run log is not
   the same as absence from the run's context; a run may read a comment and
   simply not act on it or log it. What would settle it is one cheap
   experiment: post a comment containing an instruction whose execution is
   *visible in the diff* — rename a variable, add a specific file — and see
   whether it lands. **Until that runs, treat every mid-flight Linear comment as
   likely unread**, which is the expensive half of this either way.
2. **Does intra-run parallelism pay?** `Task,Agent` is granted at
   `claude-linear-dispatch.yml:426`, but the prompt never says "parallel",
   "concurrent" or "simultaneous" — zero matches. Capability without
   instruction. Recorded on **GAM-321**, which already covers the same root
   cause from the cost angle (238 Bash calls on opus). **Constraint:** Claude
   subagents share one filesystem in a dispatched container — no worktree
   isolation, unlike the Codex path — so fan-out must be conditioned on disjoint
   files, not merely independent-sounding subtasks.

   **Still unanswered, and the 2026-08-19 batch did not test it.** All three
   runs dispatched their subagents serially, so there is no intra-run
   parallelism to price. What the batch *does* price is **inter-run**
   parallelism, and that paid: three rows dispatched at once, disjoint file
   surfaces, three clean merges inside ninety minutes with no conflict and no
   admission-control failure. If parallelism is worth buying, the measured win
   so far is at the row level, not inside a run.

---

## 6. Errors made this session, recorded so they are not repeated

- **Misattributed GAM-407's strand to GAM-333's credential defect** and stated it
  as fact on a durable record. The owner suggested a GitHub outage; GAM-403 then
  measured the real cause (token expiry). Both earlier stories were wrong.
  Corrected on GAM-407.
- **Overstated a "near-miss"** on GAM-407's re-dispatch, claiming a relay comment
  landed ~20s before the run claimed. The owner's own pointer comment preceded
  the dispatch — the run was never at risk. Checked my timestamp, not theirs.
- **Filed rows freely and contributed to the backlog problem** — eight on
  2026-08-18, more since. Each individually defensible; collectively part of why
  the board reached 91. **Standing commitment: raise the filing bar.** If a
  finding does not affect the product or block work, it belongs as a comment on
  an existing row, or nowhere.
- **Raised the control-plane hosting question four or five times in conversation
  without ever filing it.** The owner asked "is there a ticket for me to read?"
  and there was not. Now GAM-419. Chat is not the record.
- **Recorded GAM-387's tier wrong in §1** — written as "`unreviewed`, judged
  STANDARD" when its packet had taken HEAVY. Small on its face, and it made §7's
  strand warning wrong in a way that mattered: §7 named only GAM-377 as the
  strand risk, on the grounds that it was the HEAVY one. Both HEAVY rows
  stranded. The tier was written from the pre-dispatch conversation rather than
  read back from the packet the run had already committed. **Read the artifact,
  not the memory of deciding it.**
- **Called the strand a duration effect, and built §2 on it.** The figures were
  the minute each run *called* `gh pr create`; I labelled the column "Duration"
  and then reasoned from the label — concluding that tier predicts stranding
  because tier predicts duration. GAM-421 measured it a day later across all 50
  runs and found the opposite: a 94-minute run opened two PRs, and what decides
  is when the call happens. **The data was fine; the header was the hypothesis,
  and I read it back as evidence.** Corrected in §2 rather than deleted, because
  the wrong version had already been acted on.

---

## 7. Suggested next actions

Item 1 of the original list is **done** — all three rows merged, the two that
stranded published from their preserved bodies. What remains:

1. **Apply the GAM-403 preflight patch.** #203 is merged; this is the half that
   changes runtime behaviour, and it needs an owner-scoped session.
2. **Answer GAM-419.**
3. **Decide GAM-404** — accept the round-2 revision and dispatch a worker, or
   send it back. Fix its `In Progress` row either way.
4. **Run GAM-377's e2e spec.** `tests/e2e-personas/outreach-lifecycle.spec.ts`
   was edited by reasoning, not execution — `11:59 PM` → `11:58 PM` on Start —
   and merged that way. **The six gates do not run Playwright and no CI job
   does**, so nothing that has run so far is evidence the spec survives. This
   is the one merged change with no verification behind it.
5. **Do not start new infrastructure work.** Phase 0 is closed, the spike is
   answered, the foundation is on `main`. The measured problem is that the
   process outnumbers the product 2:1 on the board. The next sessions should
   spend the infrastructure rather than extend it. **The 2026-08-19 batch is
   what spending it looks like** — three product rows promoted, dispatched and
   merged in one evening, using the admission control, the tier rules, the
   premise gate and the body-preservation convention exactly as built. Nothing
   new was needed.

**New rows this batch left behind**, all `Backlog` / `unreviewed` unless noted:
**GAM-422** (a throw in the app chrome still blanks the screen — `KpiStrip` runs
a Supabase loader on every chrome-bearing route, so it is live), **GAM-423**
(editing one outreach time field wipes the other and silently drops that day),
**GAM-420** (the entrypoint-guard defect in five sibling `scripts/*.mjs`).
**GAM-421** was filed, dispatched and merged the same night — it is the source
of §2's correction. It left two behind: **GAM-424** and **GAM-425**, both above.
**GAM-300** now carries GAM-356's measured evidence and a green blocking test.
**GAM-352 was re-scoped, not closed** — the `Ignore GAM-352` line in #206 was
deliberate; its unvalidated cast at `CheckinResult.tsx:343` is untouched.

---

## 8. What merged on 2026-08-19 / 08-20

| PR   | Row     | What                                                                      |
| ---- | ------- | ------------------------------------------------------------------------- |
| #201 | GAM-407 | the Supabase run-store spike — criteria 1-4 PASS, stop rule does not fire |
| #200 | GAM-411 | salvage rows get their own branch name                                    |
| #199 | GAM-412 | plan §11 entry 6 — control plane scoped to one application                |
| #202 | GAM-418 | spike report amended with GAM-414's measured role attributes              |
| #203 | GAM-403 | dispatch credential preflight — script only; **patch still unapplied**    |
| #205 | GAM-356 | `participation_pct` widened to `number \| null`; renders an em dash        |
| #206 | GAM-387 | app-wide route error boundary, keyed on `pathname + search`               |
| #207 | GAM-377 | outreach session end guarded against an earlier/equal start               |
| #208 | GAM-421 | `AGENTS.md` wall 3 — the PR credential dies at 60 min; open the PR early  |

GAM-414 was closed by the owner — correct, since `gate/human` means no machine
may close it.

**Three product rows in one evening, against 45 process rows on the board.**
That ratio is what §7.5 is about.
