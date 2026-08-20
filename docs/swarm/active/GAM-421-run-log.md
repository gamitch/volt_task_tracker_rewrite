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
