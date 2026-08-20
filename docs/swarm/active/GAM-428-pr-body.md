Closes GAM-428

**DRAFT — opened at minute 3 so the PR exists while the credential is alive.**
Body is finalized before the draft flag is cleared.

## What changed

Nothing yet. This PR currently carries only `docs/swarm/active/GAM-428-run-log.md`.

## Plan

A student who RSVPs `going` to a **competition** an admin flagged "Counts toward
volunteer hours" sees those hours in **Planned**, and they can never become
**Confirmed** — `v_student_hours` requires both `counts_volunteer_hours` **and**
`type = 'outreach'`, while the two TypeScript planned-hours functions test only
the flag. The fix brings those two functions up to the view's predicate. The
view is not touched (constitution item 3).

## Tier

`STANDARD`, judged before the claim per item 28d, defended in a comment on
GAM-428 and restated here before this leaves draft.

Linear-Issue: GAM-428
