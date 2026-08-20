Closes GAM-389

**DRAFT — opened at minute ~5 under AGENTS.md wall 3, before the work exists.**
The `ghs_` credential that opens a PR in a dispatched run expires 60 minutes in
(decoded on this run: `iat 2026-08-20T03:00:03Z`, `exp 2026-08-20T04:00:03Z`),
so the PR is opened while the branch carries only a run log and pushed into
afterwards. This body is finalized before the draft flag is cleared.

## What changed

Pending. The issue asks for one deliberate, recorded posture on anonymous
(`anon`) read access across six student-hours views, applied consistently —
either revoking the five that currently answer unauthenticated requests, or
keeping public read and writing down why.

## Tier, stated and defended

**HEAVY** (item 26), judged before the `In Progress` move as item 28d requires.
The trigger is the mechanism, not the severity: the deliverable is a file under
`supabase/migrations/` changing `anon` grants on `SECURITY DEFINER` views that
bypass the RLS protecting the tables underneath. Item 26 names "a migration or
metric-view SQL" and RLS logic as HEAVY triggers; item 18 names the same two as
`model: "opus"` worker triggers.

The losing argument was item 25 — this is a volunteer robotics team, no PII is
stored, and the issue itself explicitly declines to claim a compliance problem
or any exposure. That is a real and correct reading of the *severity*, and it
is why this row is not being treated as an emergency. But item 25 lowers the
security threat model; it does not lower the process tier for grant and
migration work, and it says in terms that correctness and data integrity are
unaffected by it. A silently wrong `revoke` breaks signed-in screens for real
users, which is a correctness failure item 25 does not touch.

## Verification

Pending.

## Known gaps, disclosed

Item 16 reserves applying a migration to the human owner. This PR can add a
migration file; it cannot cut it over.

Linear-Issue: GAM-389
