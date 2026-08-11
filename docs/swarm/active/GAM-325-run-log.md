# GAM-325 run log

Issue: [GAM-325](https://linear.app/gamitch/issue/GAM-325/build-the-explicit-linear-closer-pr-merge-declares-its-issue-one-sync)
Tier: `tier/heavy` (declared on the issue; not `tier/unreviewed`, so no tiering judgement was owed at claim time)
Branch: `claude/gam-325-linear-closer`
Started: 2026-08-11

Append-only. One line per milestone, pushed immediately.

- 2026-08-11 — **claimed**: `GAM-325` moved `Todo → In Progress` via `issueUpdate`, read back as `In Progress`. Labels `other, heavy`, assignee none.
- 2026-08-11 — branch `claude/gam-325-linear-closer` created off `main` at `ccf77b1`; run log is the first file write.
- 2026-08-11 — **premise measurements, orchestrator, before any packet** (5 checks, run against live Linear and the live GitHub repo):
  1. **HOLDS** — Phase 0 is done. `gitAutomationStates` on team `Gamitch (GAM)` returns exactly one row: `event=merge state=Done target=(any)`. `On PR open` and `On PR review request or activity` are gone from the list entirely, not merely `No action`. `merge → Done` is the only live automation, as item 28g and §8a claim.
  2. **HOLDS** — no `issueUpdate` mutation exists in the repository (`grep -rn issueUpdate` over `*.mjs`/`*.ts` hits only prose in `docs/swarm/`). The state write is genuinely new; HEAVY stands on item 26's write-path trigger.
  3. **FAILS — §6.4's branch-protection premise is false.** `gh api repos/gamitch/volt_task_tracker_rewrite` returns `"private": true, "visibility": "private"`. §6.4 asserts *"Because this repo is public, branch protection — including required status checks — is free. (Private repos would need GitHub Pro; not this repo's situation.)"* It **is** this repo's situation. `branches/main` returns `"protected": false` today. This does not block the Phase-2 build; it lands squarely on **Phase 3 step (a)**, whose halt condition is "if it cannot be made blocking, halt". Recorded on the issue and corrected in the proposal.
  4. **BLOCKED — §8's throwaway-PR measurement checklist cannot be executed by this agent.** The dispatch token (`claude[bot]` installation) gets HTTP 403 on `GET /actions/runs` and on `/actions/secrets`. I can open a PR; I cannot observe whether a workflow ran, which file version it ran, what the payload contained, or whether secrets were present. Items 1–7 of the checklist are *all* observations of a workflow run. Measuring them is not a matter of effort here — the observation channel is closed. See the run log entry below for what was built instead.
  5. **HOLDS** — `SLACK_WEBHOOK_URL` appears nowhere in the repo (workflows, scripts, edge functions), matching §8a's "deliberately deferred to Phase 2".
- 2026-08-11 — **packet written**: `docs/swarm/active/GAM-325-packet.md`. Five lanes (A shared parse + Slack, B sync worker, C gate + sweep scripts, D three workflows, E edge-function notifier), disjoint Allowed Files, six deliverables covered. Item 19d least-confident list has 5 entries. Baseline before any lane: **83 test files / 2162 tests, all passing** (`npx vitest run`, 170 s).
- 2026-08-11 — **premise gate round 1 dispatched** (`checker-premise`, opus, item 19 + 19a). Told to attack the least-confident list first and to *re-measure* LCD 2 (the 7-of-7 line-1 compliance claim) against real PRs #124–#153 rather than trusting §6.2.
- 2026-08-11 — proposal corrected by the orchestrator (owner of `docs/swarm/**`) for measurement 3: §6.4's "this repo is public" paragraph struck and replaced with the measured finding; §9's two "$0 because public" cost rows corrected. Phase 3 step (a) is now an open owner question.
- 2026-08-11 — premise findings posted to GAM-325 as a comment (`#comment-6dda6816`): the private-repo correction with the owner decision it forces before Phase 3, the blocked-checklist reasoning, and the three premises that hold.
