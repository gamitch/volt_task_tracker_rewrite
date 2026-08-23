---
name: swarm-run
description: Execute the swarm workflow with tier-routed packets, bounded worker/checker loops, and boss escalation.
---

When invoked, run this workflow:

1. Claim the task from the Linear `Todo` queue (constitution item 28) unless
   the user names an issue, and read docs/swarm/state-summary.md for context.
   docs/swarm/task-ledger.md is frozen history (item 29) — provenance only.

2. Measure and record the task's tier — FAST, STANDARD, or HEAVY — per
   constitution item 26's tier-selection order, and defend it in the claim
   comment. Route by tier; do not run the full chain on a tier that does not
   require it.

3. FAST: implement and verify directly, exactly as item 26 prescribes —
   commit before mutating, mutate only in a disposable worktree, record the
   named mutation red then green, run all six repository gates, inspect the
   final diff. No packet, worker, premise checker, or separate checker.
   Continue at step 8.

4. STANDARD: write the compact worker packet yourself in
   docs/swarm/active/TASK-worker-packet.md (item 26 lists its required
   contents) and dispatch one worker — two only for genuinely disjoint
   packets with a declared collision analysis. On completion, final
   verification has exactly one owner: run it yourself, or dispatch the
   separate acceptance checker when item 26's checker triggers apply.

5. HEAVY: dispatch `checker-premise` on the packet and proceed only on
   DISPATCH — full or light per item 19b, never skipped, two-round cap per
   item 19a. Then dispatch the worker (up to three only after the premise
   checker approves the explicit split), then one independent acceptance
   checker against the committed result.

6. If FAIL: one bounded correction round may reuse the same worker and
   checker — send only the original packet and the exact failure, recorded
   in docs/swarm/active/TASK-latest-failure.md. Never the full ledger or
   log files.

7. A second failed correction, a replacement worker, or a worker dispute
   escalates to boss-arbiter (and the owner where item 26 requires it).
   Never loop indefinitely.

8. On PASS: append the verification-log entry, file follow-up issues for
   MINOR findings (item 20), log NITs, and close out through the normal PR
   and Linear path — the issue moves to `In Review`, never `Done` (item 28e).
