---
name: swarm-check
description: Run final review using checker agents and boss review before accepting a project milestone.
---

When invoked:

1. Ask checker-tests to run deterministic verification:
   - lint
   - typecheck
   - tests
   - build

2. Ask checker-reviewer to review changed files against:
   - active task acceptance criteria
   - project constitution
   - forbidden modification rules

3. If UI exists, ask checker-accessibility to inspect:
   - semantic HTML
   - keyboard navigation
   - contrast
   - light/dark mode
   - visible focus
   - assistive technology concerns

4. If content exists, ask checker-content to verify:
   - source fidelity
   - protected text
   - names
   - dates
   - team numbers
   - unsupported claims

5. Ask boss-architect for final acceptance.

6. Write final results to:
   docs/swarm/verification-log.md

7. Update:
   docs/swarm/state-summary.md
