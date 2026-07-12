---
name: swarm-plan
description: Turn a project request into a constitution, task plan, checker plan, and execution ledger.
---

When invoked, run this workflow:

1. Ask boss-architect to read the user's project request.

2. Create or update:
   - docs/swarm/project-brief.md
   - docs/swarm/constitution.md

3. Ask foreman-planner to create:
   - docs/swarm/task-ledger.md
   - docs/swarm/state-summary.md

4. Ensure every task has:
   - task id
   - objective
   - allowed files
   - forbidden files
   - worker
   - checker
   - acceptance criteria
   - evidence requirement
   - dependency status
   - attempt count initialized to 0

5. Stop before implementation unless the user explicitly asked to start.

Important:
- Do not create huge task descriptions.
- Prefer compact, independently checkable tasks.
- Do not let workers edit planning or constitution files.
