Closes GAM-421 — the dispatch credential's expiry is now measured rather than documented, and this PR was opened at minute ~8 to prove the cheapest fix

> **Status: draft, opened early on purpose.** This PR was opened at minute ~8 of
> the run rather than minute ~100, which is GAM-421's own **option 3**. The body
> is finalized before the draft flag comes off. If this text is still
> preliminary when you read it, the run was killed mid-chain — read
> `docs/swarm/active/GAM-421-run-log.md`, whose last line says where.

## What changed

Work in progress. See the run log for the measurement that is already landed.

## What the issue got wrong

GAM-421 is right about the failure and understates it. Two corrections, both
measured in this run:

1. **The lifetime did not need a long run to measure.** The issue's own
   Verification note says the one-hour figure "is GitHub's documented behaviour
   … and was **not** independently measured here", bounding it only between
   minute 6 and minute 74. In fact the credential is a JWT and **states its own
   expiry**: `iat 2026-08-20T00:46:26Z`, `exp 2026-08-20T01:46:26Z`, a lifetime
   of exactly **3600 s**. Any run can read its own deadline at minute 0.

2. **The branch is not a safe harbour, and the issue assumes it is.** GAM-421
   says the PAT "is long-lived and still pushes fine at minute 74", so "the work
   survives on the pushed branch". In this run `secrets.CLAUDE_PR_TOKEN` is
   **empty**: `GH_TOKEN`, `GITHUB_TOKEN` and the token `actions/checkout` writes
   into the `origin` remote URL are byte-identical (same SHA-256), all falling
   back to `github.token`. So `git push` is on the **same 60-minute clock** as
   `gh pr create`. Past minute 60 a run loses the branch too.

## Tier, stated and defended

**HEAVY**, per item 26, judged at claim time as item 28d requires.

- **Trigger:** this is the credential path of the external dispatch write path.
  Item 26's HEAVY list names auth/role logic and "an export another session
  builds against"; the dispatch workflow is what every later run builds against,
  and a wrong credential path strands *every* run, not one task.
- **The losing argument:** options 2 and 4 in the issue are a settings toggle and
  a doctrine change — near-zero code, which reads STANDARD or even FAST. Item 26
  resolves an arguable pair to the heavier tier, and the blast radius is the
  whole dispatch loop.

## Verification

Pending.

## Known gaps, disclosed

- `.github/workflows/**` is behind the credential wall (GAM-328), so any fix
  that edits the dispatch workflow ships here as an applyable patch, not as a
  merged change.
- Choosing between GAM-421's four options is **the owner's call**, and the issue
  says so. This PR does not make that choice.

Linear-Issue: GAM-421
