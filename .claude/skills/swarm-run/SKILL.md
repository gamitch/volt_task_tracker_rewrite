---
name: swarm-run
description: Execute the swarm workflow with bounded worker/checker loops, compact task packets, and boss escalation.
---

When invoked, run this workflow:

1. Read docs/swarm/task-ledger.md and docs/swarm/state-summary.md.

2. Select the next unblocked task unless the user specifies a task ID.

3. Ask foreman-planner to create a compact worker packet in:
   docs/swarm/active/TASK-worker-packet.md

4. Invoke the assigned worker using only the worker packet.

5. Ask foreman-planner to create a compact checker packet in:
   docs/swarm/active/TASK-checker-packet.md

6. Invoke the assigned checker using only the checker packet.

7. If PASS:
   - Update docs/swarm/task-ledger.md
   - Update docs/swarm/state-summary.md
   - Add a concise entry to docs/swarm/verification-log.md
   - Archive detailed evidence if needed

8. If PASS with MINOR or NIT findings:
   - Mark the task passed
   - Create follow-up tasks for MINOR findings
   - Log NIT findings only

9. If FAIL:
   - Increment the attempt count for this task.
   - Record the exact failure in:
     docs/swarm/active/TASK-latest-failure.md

10. If attempt count is 1, 2, or 3:
    - Send only the original worker packet and latest failure back to the worker.
    - Do not send the full task ledger.
    - Do not send the full verification log.
    - Rerun the checker after rework.

11. If attempt count exceeds 3:
    - Stop the worker/checker loop.
    - Mark the task Escalated.
    - Invoke boss-arbiter.

12. If the worker disputes the checker at any point:
    - Invoke boss-arbiter immediately.

13. Never loop indefinitely.
