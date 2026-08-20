# GAM-421 run log

**Issue:** [GAM-421](https://linear.app/gamitch/issue/GAM-421/the-credential-that-opens-pull-requests-expires-after-an-hour-and-a)
— "The credential that opens pull requests expires after an hour, and a HEAVY
run takes two — so the preflight verifies a token that is dead by the time the
PR is opened"

**Branch:** `claude/gam-421-token-expiry-pr-window`
**Runtime:** Claude (dispatched from Linear on `Todo` → this run)

This file is append-only and is pushed after every milestone. If it ends
mid-chain, the run was killed at that line — read the last entry as the
statement of where it died, not as a summary.

---

## Milestones

- **00:47Z — claimed.** GAM-421 moved `Todo → In Progress` and re-read back
  (item 28c read-after-write): state `In Progress`, labels `tier/heavy`, `Bug`,
  `provenance/other`. No `gate/human`, no executor label → legacy Claude-only
  route under item 28b, so this runtime may claim it.

- **00:47Z — tiered HEAVY** (item 28d: tiering is part of claiming, not of
  finishing). `tier/unreviewed` replaced with `tier/heavy`. Reasoning, stated
  here and defended in the PR per item 26: the change is the credential path of
  the *external dispatch write path*. Item 26's HEAVY list names auth/role logic
  and "an export another session builds against"; the dispatch workflow is what
  every subsequent run builds against, and a wrong credential path strands every
  run rather than one task. Two tiers are arguable — options 2 and 4 in the
  issue are a settings toggle and a doctrine change, near-zero code — and item 26
  resolves an arguable pair to the heavier tier. The issue's own analysis
  reaches HEAVY independently.

- **00:48Z — run log created and pushed** as the first file write, before any
  measurement, per the dispatch standing order.

- **00:49Z — premise measured: CONFIRMED, and stronger than the issue claims.**
  Measured in this run, not read from documentation. The dispatch credential is
  a JWT and carries its own expiry claims, so the lifetime is readable at
  minute 0 by the run that holds it:

  | Claim | Value |
  | -- | -- |
  | `iat` | `2026-08-20T00:46:26Z` (job start) |
  | `exp` | `2026-08-20T01:46:26Z` |
  | lifetime | **3600 s, exactly 60 minutes** |

  This closes GAM-421's own stated verification gap. Its Verification note says
  the one-hour lifetime "is GitHub's documented behaviour … and was **not**
  independently measured here", bounding it only between minute 6 and minute 74.
  It is now measured, and it is exact — and it did not need a long run to
  measure, because the credential asserts it.

  **Correction to the issue's model, and it is more severe than what is filed.**
  GAM-421 describes two complementary credentials: a `ghs_` App token that can
  open PRs but expires, and a long-lived PAT that "still pushes fine at minute
  74". In *this* run there is no second credential. `GH_TOKEN`, `GITHUB_TOKEN`
  and the token `actions/checkout` bakes into the `origin` remote URL are
  **byte-identical** (same SHA-256), i.e. `secrets.CLAUDE_PR_TOKEN` is empty and
  every path falls back to `github.token`:

  | Probe at 00:48Z (minute ~6) | Result |
  | -- | -- |
  | `GH_TOKEN` `GET /repos/…` | `200` |
  | `GH_TOKEN` `POST /pulls` head==base | `422` → authorized to create PRs |
  | `PAT` env var | **empty (length 0)** |
  | `PAT` `GET /repos/…` | `401` |

  **Correction, made at 01:01Z against my own claim above — read this before
  citing the table.** I first wrote that `secrets.CLAUDE_PR_TOKEN` is unset. I
  had not established that and it is not observable from here. The workflow
  passes `CLAUDE_PR_TOKEN` only to `actions/checkout` (`with: token:`) and into
  `GH_TOKEN`; it is never exported to the agent under its own name, so its
  presence cannot be read from this environment. What actually happened is that
  `claude-code-action` **replaced the credential on every path** — PR #208's
  author is `claude[bot]`, the `origin` remote carries a `ghs_` App token in its
  userinfo, and there is no `http.*.extraheader` in the local git config
  (`actions/checkout` writes one). All three are the action's own minted token,
  which is why the three hashes match. The identical hashes prove *one
  credential reached me*, not *which secret is configured*.

  **What survives the correction, and it is the finding that matters.**
  Regardless of what `CLAUDE_PR_TOKEN` holds, the `origin` remote **the agent
  actually pushes through** is configured with the 60-minute App token. So the
  agent's `git push` is on the same clock as its `gh pr create` — and GAM-421's
  consolation that "the work survives on the pushed branch" is not free either.
  It holds only for as long as the same credential does. This is narrower than
  what I first wrote and it is measured rather than inferred.

  Premise holds → continuing. Not stopping.

- **00:50Z — PR body artifact written, then PR opened as a draft: #208.**
  Order matters and the `pr-body` skill requires it — the artifact is written
  *before* the API call, so a run that cannot open its PR still loses nothing.
  `node .claude/skills/pr-body/scripts/check.mjs` → `OK declaration closes
  GAM-421`, exit 0.

  **This is GAM-421's own option 3, and it needed no workflow patch.** The issue
  files options 1 and 3 as owner-applied patches because they edit
  `.github/workflows/**`. That is true of the *automated* form. But the agent
  chooses when it calls `gh pr create`, so the behavioural form of option 3 —
  open the PR at minute 8 and push into it — is doctrine, available today, and
  is what this run did. Deadline measured at 01:46:26Z; PR opened at 00:50:54Z,
  with ~56 minutes of credential left rather than ~-40.

  Consequence for the rest of this run: the terminal step is already done, so a
  kill from here costs the remaining *content*, not the PR.

- **00:55Z — GAM-333 re-analysis run. It confirms GAM-421's mechanism and
  corrects its proposed variable.** GAM-421 offers this as "a hypothesis this
  issue offers, not a result … that is a cheap query and it either confirms this
  or kills it." Query run over all 50 `claude-linear-dispatch.yml` runs and all
  repository PRs.

  | Measurement | Result |
  | -- | -- |
  | `claude[bot]` PRs opened inside a dispatch run | 21 |
  | …opened at ≤ 60 min into the run | **21** |
  | …opened at > 60 min into the run | **0** |
  | Latest one ever, worst-case attribution | **53.2 min** (PR #205) |
  | The only PR anywhere opened at > 60 min | PR #162, at 81.9 min — author `gamitch`, **not** the bot |

  Attribution across concurrent runs is ambiguous, so each PR is charged its
  **maximum** plausible minutes-into-run. That biases the search *toward*
  finding a late bot PR. None exists.

  **The correction: the deciding variable is not run duration.** GAM-421
  proposes "run duration, not wall-clock window, is the variable this predicts."
  Nearly right, and the data separates the two. Run #42 lasted **94 minutes and
  opened two PRs**; run #47 lasted **73 minutes and opened PR #205 at minute
  53**, then kept running for another 20. Meanwhile run #6 lasted 60 minutes and
  opened none. The variable is **elapsed time at the moment `gh pr create` is
  called**, not the run's total length. A long run is not doomed; a run that
  *defers* its PR past minute 60 is.

  That distinction is the whole reason option 3 works, and it means the fix does
  not require the run to get faster.

  14 of the 19 long (>60 min) runs opened no bot PR at all — GAM-333's stranded
  population, now explained.

- **01:03Z — packet written** (`docs/swarm/active/GAM-421-packet.md`), HEAVY,
  with the item 19d least-confident list. Allowed Files are
  `scripts/dispatch-preflight.mjs` and its test only; `.github/workflows/**`
  named as forbidden *at packet time* rather than at push time, per the
  `AGENTS.md` "two walls" section.

- **01:03Z — DISPATCHING `checker-premise`** (item 19: no packet reaches a
  worker until this returns DISPATCH), `run_in_background: false`, blocking.
  **If this line is the last one in this file, the run died holding this
  subagent.**

- **01:12Z — `checker-premise` VERDICT: REVISE (BLOCKER).** Round 1 of the two
  the item 19a cap allows. It cost ~94K tokens and was worth every one: it
  falsified a claim I had already published, and it killed the code change.

  Findings I acted on, in order of consequence:

  1. **It falsified my 01:01Z "correction" — I was wrong and GAM-421 was
     right.** I claimed the agent's `git push` runs on the 60-minute App token.
     Re-measured myself at 01:14Z rather than taking the gate's word:
     `http.https://github.com/.extraheader` **is present**, carrying
     `x-access-token:github_pat_…`, 93 chars, one dot segment,
     `sha256 e815b2b5…` — **distinct** from `GH_TOKEN` (`sha256 0b8eb244…`).
     My earlier probe missed it because it is not in `.git/config` local scope:
     it lives in `/home/runner/work/_temp/git-credentials-*.config`, so
     `git config --local --get-regexp` returns nothing while
     `git config --get` returns it. And per this repo's own
     `scripts/dispatch-preflight.mjs:31-41`, the extraheader **outranks** any
     credential in the remote URL's userinfo.

     So `git push` authenticates as the **long-lived PAT**, not the expiring
     App token. **GAM-421's two-credential model is correct as filed.** The
     branch *is* a safe harbour. Retracted: "the branch is not a safe harbour",
     "the agent's push is on the same 60-minute clock", "there is no second
     credential". The 3600 s measurement and the GAM-333 re-analysis are
     untouched by this.

     **This restores option 2 to the owner's table**, which my error had
     written off — and it is the cheapest of the four: the PAT is long-lived
     and already present, so granting it `pull_requests: write` needs no code,
     no workflow patch and no preflight.

  2. **Nothing in this repository invokes `scripts/dispatch-preflight.mjs`** —
     no workflow step, no `AGENTS.md` order, no skill, no hook. GAM-403's
     wiring is still an unmerged patch behind the credential wall. So the
     `pr-window` check my packet specified would have shipped **dormant**, and
     my packet's claim that the preflight "already proves capability at minute
     1" is false today.

  3. My packet's forbidden-files citation was overbroad: `constitution.md:26-33`
     names four specific `docs/swarm/` files and three `.claude/` paths. It does
     **not** forbid `AGENTS.md`, which dispatched runs amend routinely.

  4. Acceptance criterion 1 was not runnable: the test file imports `vitest`, so
     `node --test` dies with `ERR_MODULE_NOT_FOUND`.

- **01:16Z — code change WITHDRAWN; no worker dispatched. Scope reduced, and
  the reduction is the finding.** With one gate round left and ~30 minutes of
  App-token life, the choice was: re-gate a check that lands dormant, or spend
  the remaining run correcting a false published claim and shipping the
  doctrine that works today. I took the second. The `pr-window` check is not
  abandoned — it is refiled, because it is a good idea whose prerequisite
  (GAM-403's wiring) is not merged.

  **Process deviation, declared rather than relabelled** (item 26): this row is
  and remains HEAVY, and it got the HEAVY gate. It did not get a worker or a
  `checker-reviewer`, because after the gate there is no production code in
  scope. What remains — the run log, the PR body, `AGENTS.md` — are records the
  orchestrator owns and which the constitution forbids a worker to edit.

- **01:18Z — `AGENTS.md` wall 3 written and pushed.** The gate's highest-value
  recommendation: a standing order in a file a dispatched run *can* push
  delivers option 3's benefit today, whether or not the owner ever applies a
  workflow patch. Section retitled "Three walls"; wall 3 carries the 3600 s
  measurement, the read-your-own-`exp` instruction, the 21/21-before-minute-53
  evidence, the open-early-as-draft order, and the two-credential table
  including the extraheader gotcha that cost me a wrong claim earlier in this
  run.
