# Item 28 amendment draft: the atomic claim (GAM-400)

**Status: APPROVED by the owner on 2026-08-18 (GAM-399, decision 3) — gate 1 of
2 satisfied. Nothing here is in force, and `constitution.md` is not edited,
until gate 2 (the Phase 2 controller spike) is also met.**

Written 2026-08-18 against `constitution.md` item 28 as amended for GAM-397,
implementing §5.4 and §5.7 of
`docs/swarm/2026-08-15-durable-multi-agent-execution-plan.md`.

## The two activation gates

1. **Owner approval** of this text (GAM-399 decision 3). Approval alone changes
   nothing in the tree.
2. **The Phase 2 controller spike is proven** (plan §5.1): one atomic
   conditional update validating `run_id`, `generation`, and `version`;
   idempotent duplicate webhooks; run-scoped result publication without
   executor credentials. Until the spike passes, the current item 28c remains
   the live rule even if this text is approved.

Both gates exist for the same reason GAM-398 existed: the constitution must
never describe machinery that is not deployed. When both gates are met, the
issue applying this amendment edits `constitution.md`, cites this file and the
owner's approval, and states the activation date.

## What is preserved, verbatim in intent

- **28a unchanged.** Promotion to `Todo` remains the owner's authorization to
  work and the only ordinary authorization. The controller cannot authorize
  work; it can only execute authorized work.
- **28b unchanged.** Tier labels are identity; `gate/human` overrides every
  executor label and forbids a machine claim; `executor/claude` and
  `executor/codex` route exactly as GAM-397/GAM-398 deployed them. The
  controller enforces these checks before reservation instead of after.
- **28d's requirement unchanged, its enforcer replaced.** A `tier/unreviewed`
  row still may not enter `In Progress` until tiered; under the amendment the
  controller holds it in a `tier_pending` reservation (no Linear movement)
  while a read-only tier judgement runs.
- **28e, 28f, 28g untouched.** Completion still lands in `In Review`, the
  merge still closes the issue, linking rules and automations are unchanged.
  (Phase 5's steward will later take over the `In Review` write; that is a
  separate future amendment, deliberately not folded into this one.)

## Replacement text for item 28c

The current 28c ("Claim before reading anything else", the read-after-write
race) is replaced in full by:

> c. **The claim is the controller's atomic run reservation — Linear reflects
>    it, and never is it.** On a valid `Todo` webhook for a tiered,
>    machine-routable issue, the controller atomically creates the run record
>    for `(issue, todo_event_id)` at generation 1. That record — not any Linear
>    state — is ownership. A duplicate webhook returns the existing record and
>    creates nothing. Two claimants cannot both hold a reservation, because
>    the store provides the compare-and-set Linear does not.
>
>    After reserving, the controller projects the claim into Linear as
>    `In Progress` and reads the projection back as evidence. An executor is
>    dispatched only after both the reservation and the projection succeed.
>    An executor never claims for itself: it receives a claim — `run_id`,
>    `generation`, branch, base SHA — and a run-scoped capability that cannot
>    target any other issue or generation.
>
>    For a `tier/unreviewed` row, the controller reserves `tier_pending`
>    without moving the issue, dispatches a read-only tier judgement, applies
>    the selected tier itself, and only then projects `In Progress` (28d's
>    requirement, now mechanically enforced).
>
>    **Recovery budgets are three separate counters, and none resets the
>    clock.** `infrastructure_retry_count` (container/workflow deaths; budget
>    starts at one), `worker_attempt_count` (item 26's worker/checker loop,
>    budget three, unchanged), and `premise_round` are tracked independently
>    on the run record. A retry advances the generation first — a stale
>    executor's writes are rejected, not raced — and never resets the episode's
>    originating `todo_event_id` or its metric clock. An exhausted budget moves
>    the episode to `Needs Attention` with one deduplicated notification; it
>    does not return the issue to `Todo`, which would re-authorize work the
>    owner authorized once.
>
>    **When no controller holds the issue** — interactive owner sessions,
>    owner-granted exceptions, or controller outage — the legacy protocol
>    applies as the explicit fallback: move `Todo → In Progress` before reading
>    anything else, then re-read and confirm you hold it. The read-back shrinks
>    the race; it does not close it. Record in the issue that the claim was
>    manual and why.

## What this deliberately does not do

- It does not weaken any gate: premise review, tiering, worker/checker
  separation, mutation replay, and the declaration gate are outside item 28
  and outside this amendment.
- It does not give the controller authority to promote, tier-judge
  substantively, or close issues. Judgement stays with models and the owner
  (plan principle 9); the controller owns mechanics.
- It does not enable automatic retry beyond the single infrastructure retry,
  and even that only after the Phase 2 manual-resume fire drill has passed
  (plan principle 6).
- It does not touch the executor-credential rules; those land in Phase 3 and
  will be their own amendment if the constitution needs one.

## Fault scenarios this text must survive (plan §7)

Scenario 1 (duplicate webhook → one run), 2 (raced claims → one reservation),
13 (paused old executor, advanced generation → every old mutation rejected),
14 (duplicate terminal event → one effect). The Phase 2 acceptance tests
exercise all four before gate 2 is satisfied.
