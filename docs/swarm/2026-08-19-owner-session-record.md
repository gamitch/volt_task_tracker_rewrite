# Owner session record — 2026-08-19

Interactive Claude Code (remote) session, owner present. Written as a handoff
because the session's context was filling. **Read §1 and §7 first; the rest is
reference.**

Companion to `2026-08-18-owner-session-record.md`, which covers Phase 0.

---

## 1. State right now

**Three product rows are in flight**, promoted by the owner and dispatched:

| Row         | What                                                     | Tier                          | Parallelism instruction posted                   |
| ----------- | -------------------------------------------------------- | ----------------------------- | ------------------------------------------------ |
| **GAM-387** | app has no error boundary — any deploy blanks the screen | `unreviewed`, judged STANDARD | yes — told it may work serially; least separable |
| **GAM-377** | outreach dialog saves inverted sessions → negative hours | HEAVY                         | yes — parallel investigation, serial edit        |
| **GAM-356** | `participation_pct` mistyped, renders `null%`            | `unreviewed`                  | yes — cleanest split of the three                |

Their file surfaces were verified disjoint before promotion (the manual version
of plan §5.9 admission control). **GAM-378 is deliberately queued behind
GAM-377** — both edit `OutreachEventDialog.tsx`, and GAM-378 also collides with
GAM-363/364 on `OutreachDetail.tsx`.

**PR #203 (GAM-403) is open and awaiting merge.** Merging it alone changes no
runtime behaviour — half the work is behind the workflow credential wall and
sits as an applyable patch at `docs/swarm/active/GAM-403-dispatch-preflight.patch`
(`git apply --check` exits 0). An owner-scoped session must apply it.

**GAM-404 is In Progress** (claimed 22:30) — terminal-failure notification.

---

## 2. The finding that matters most: PR strands are a _duration_ effect

GAM-403's run measured it directly rather than inferring it. The `claude[bot]`
installation token that opens pull requests **expires about an hour after it is
minted**:

```
POST /pulls  ->  422 (authorized)      at minute 6
POST /pulls  ->  401 Bad credentials   at minute 74
```

Across every run on 2026-08-18/19:

| Run               | Duration | Opened its own PR? |
| ----------------- | -------- | ------------------ |
| GAM-412           | ~4 min   | yes                |
| GAM-410 / GAM-411 | ~10 min  | yes                |
| GAM-403           | 74 min   | **no**             |
| GAM-407           | 92 min   | **no**             |

Everything under an hour succeeded; everything over stranded. **GAM-333's
"8 of 13 stranded" is very likely this, not a permissions defect.** Treat it as
the leading hypothesis when GAM-333 is next worked. Filed as **GAM-421**.

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
| **PR #203**               | merge, then apply the preflight patch from an owner session                                                                                                                                                                                                                                                                                                        |
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

1. **Do dispatched runs read Linear comments, or only the issue body?** Still
   unmeasured after a full day of relying on it. Mid-flight corrections were
   posted to GAM-407, GAM-411 and all three in-flight rows. If a run acts on a
   comment posted after its claim, that answers it. **If GAM-387/377/356 come
   back having worked serially with no mention of the split, that is the
   answer** — and it would mean every mid-flight correction has landed in a void.
2. **Does intra-run parallelism pay?** `Task,Agent` is granted at
   `claude-linear-dispatch.yml:426`, but the prompt never says "parallel",
   "concurrent" or "simultaneous" — zero matches. Capability without
   instruction. Recorded on **GAM-321**, which already covers the same root
   cause from the cost angle (238 Bash calls on opus). **Constraint:** Claude
   subagents share one filesystem in a dispatched container — no worktree
   isolation, unlike the Codex path — so fan-out must be conditioned on disjoint
   files, not merely independent-sounding subtasks.

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

---

## 7. Suggested next actions

1. **Watch GAM-387 / GAM-377 / GAM-356.** Publish any stranded PR verbatim from
   its preserved `docs/swarm/active/GAM-<n>-pr-body.md` — check the branch name
   matches the declared row first (the rule-3 trap that forced #196 → #197).
   Expect GAM-377 (HEAVY) to strand if it exceeds an hour.
2. **Merge PR #203 and apply the preflight patch.**
3. **Answer GAM-419.**
4. **Do not start new infrastructure work.** Phase 0 is closed, the spike is
   answered, the foundation is on `main`. The measured problem is that the
   process outnumbers the product 2:1 on the board. The next sessions should
   spend the infrastructure rather than extend it.

---

## 8. What merged on 2026-08-19

| PR   | Row     | What                                                                      |
| ---- | ------- | ------------------------------------------------------------------------- |
| #201 | GAM-407 | the Supabase run-store spike — criteria 1-4 PASS, stop rule does not fire |
| #200 | GAM-411 | salvage rows get their own branch name                                    |
| #199 | GAM-412 | plan §11 entry 6 — control plane scoped to one application                |
| #202 | GAM-418 | spike report amended with GAM-414's measured role attributes              |

GAM-414 was closed by the owner — correct, since `gate/human` means no machine
may close it.
