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
