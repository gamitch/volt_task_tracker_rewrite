Closes GAM-442

**DRAFT — opened early on purpose.** The `ghs_` PR credential this run holds
expires at `2026-08-21T06:02:29Z` (decoded at minute 1). `AGENTS.md` wall 3
says open the PR before that and push into it, so this body opens incomplete
and is finalized before the draft flag is cleared.

## What changed

One additive migration creating `v_event_attendance`, a per-event attendance
aggregate so the coach series card's attendance percentage comes from SQL
rather than from TypeScript division (constitution item 3 / PRD DATA-01).

## Tier, stated and defended

**HEAVY.** The issue proposed STANDARD; that is wrong under item 26, which
names "a migration or metric-view SQL" as a HEAVY trigger — this change is
both at once (a new file under `supabase/migrations/` whose whole content is
metric math). Item 26 also says take the heavier tier when two are arguable,
and item 1 puts the constitution above issue text. Item 18 independently
forces `model: "opus"` on the worker for the same two triggers.

Chain: packet → `checker-premise` → opus `worker-implementer` →
`checker-reviewer`.

## Verification

_To be filled from the real `gate-run` block and the scratch-postgres proofs
before the draft flag is cleared._

## Known gaps, disclosed

_To be filled._

Linear-Issue: GAM-442
