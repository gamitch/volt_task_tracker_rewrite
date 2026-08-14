# GAM-290 run log

**T614 — The End time field has no lower bound, so a series edit can persist a
meeting whose end is before its start**

Issue: <https://linear.app/gamitch/issue/GAM-290/t614-the-end-time-field-has-no-lower-bound-so-a-series-edit-can>
Branch: `claude/gam-290-end-time-lower-bound`

This file is appended to and pushed at every milestone. It is the only artifact
that survives if this container is killed. **If the last line of this file is a
subagent dispatch with no matching verdict line, the run died holding that
subagent** — that is the failure signature described in `AGENTS.md` § "Two walls
a dispatched run hits".

## Log

- **2026-08-14 10:14Z — claimed.** `GAM-290` moved `Todo → In Progress` via
  `issueUpdate`, then re-read (item 28c read-back): `state.name = "In Progress"`,
  `updatedAt 2026-08-14T10:14:26.642Z`. No compare-and-set exists; the read-back
  is the claim.
- **2026-08-14 10:14Z — tiered HEAVY** (item 28d: tiering is part of claiming,
  not of finishing; label was `tier/unreviewed`). Reasoning, per item 26's single
  question — *can a mistake here corrupt data, or lie to a user about their own
  data?*:
  - The change guards a **write path**: `updateSessionTime`
    (`src/lib/loaders/meetings.ts`) persists the `startsAt`/`endsAt` interval.
    Item 26 names "a write path or destructive operation" as a HEAVY trigger.
  - The corrupted value **feeds metric SQL**: `v_planned_rsvp_hours` derives
    from that interval, so an inverted span reaches the metric as negative
    planned hours for every RSVP'd student — the "lies to a user about their own
    data" half of the test, not merely the "corrupts data" half.
  - The issue's own Verification note records that **the effect was never
    reproduced** — only the missing-guard cause was checked by reading the field.
    An unmeasured premise is precisely what item 19's gate exists to attack, and
    item 26 notes a gate that *runs* is worth much more than one that reads.
  - Item 26: "If two tiers are arguable, take the heavier one." STANDARD vs
    HEAVY is arguable here on diff size alone; the write path settles it.
  - Item 18 (worker model override) assessed separately and **not** triggered on
    current scope: no migration, no RLS/`security definer`, no metric-view SQL,
    no auth/session/role logic. Revisit if the premise gate returns a scope that
    adds a `CHECK` constraint on `event_sessions`, which would be a migration and
    would trigger the `model: "opus"` override.
- **2026-08-14 10:15Z — branch created**, run log written, first push.
