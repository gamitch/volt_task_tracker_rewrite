# GAM-343 run log

**Issue:** [GAM-343 — E2E — W2 Run an outreach event: create → RSVP → attend → complete → hours land](https://linear.app/gamitch/issue/GAM-343/e2e-w2-run-an-outreach-event-create-rsvp-attend-complete-hours-land)
**Branch:** `claude/gam-343-e2e-w2-outreach-lifecycle`
**Run:** GitHub Actions, dispatched from Linear on GAM-343 entering `Todo`.

Append-only. One line per milestone, pushed immediately — this file is the only
thing that survives if the container is killed.

## Milestones

- **Claimed.** Read `AGENTS.md` § "Where work comes from" and
  `docs/swarm/constitution.md` (items 18, 19, 22, 26, 28) before opening any
  other file. Fetched GAM-343 live from Linear; body was `tier/unreviewed`.
- **Tiered HEAVY** (item 28d — judged *before* `In Progress`, not after).
  Reasoning: the deliverable is test-only, which argues STANDARD, but item 26's
  question is whether a mistake can corrupt data or lie to a user about their
  own data. The artifact's whole value is an assertion about a **write path**
  and an **RLS policy** (`rsvps.responded_by = auth.uid()`), on the path
  `WORKFLOWS.md` calls the most defect-dense in the project, whose three worst
  bugs (T193, T309, T327) were all invisible from the screen. A vacuous spec is
  a false green certifying that volunteer hours are right when they are not —
  the same lie, laundered through a test. Item 26's tiebreak is explicit: when
  two tiers are arguable, take the heavier one. Labels set
  `tier/unreviewed → tier/heavy`.
- **Moved `Todo → In Progress` and re-read to confirm the claim** (item 28c;
  Linear has no compare-and-set). Read-back at 2026-08-13T03:36:36Z:
  `state = In Progress`, labels `w2 / other / heavy`, assignee null. Claim held.
