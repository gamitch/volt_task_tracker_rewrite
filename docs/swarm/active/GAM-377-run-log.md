# GAM-377 run log

**Issue:** [GAM-377](https://linear.app/gamitch/issue/GAM-377/the-outreach-event-dialog-has-no-startend-ordering-guard-so-a-coach) —
the outreach event dialog has no start/end ordering guard.
**Tier:** `tier/heavy` (label `heavy`), labels `w2`, `Bug`.
**Branch:** `claude/gam-377-outreach-end-ordering-guard`
**Base:** `debe8e4`

This file is appended to at every milestone and pushed immediately. If the last
line is a dispatch with no matching verdict, **the run died holding that
subagent** — that is the failure signature `AGENTS.md` § "Two walls" describes,
not a run that merely ran out of things to say.

## Timeline

- **Claimed.** Read `AGENTS.md` § "Where work comes from" and
  `docs/swarm/constitution.md` items 18/19/26/28 before opening any source file.
  Fetched GAM-377 live from Linear: state `Todo`, labels `heavy` / `w2` / `Bug`,
  no `gate/human`, no executor label (item 28b: a missing route is the legacy
  Claude-only path, so this run may claim it). Tier is **not** `tier/unreviewed`,
  so item 28d's tiering-as-claiming step does not apply — the tier is given.
  Moved `Todo → In Progress` (`issueUpdate` returned `success: true`) and
  **read back**: `{"identifier":"GAM-377","state":{"name":"In Progress"}}`.
  Item 28c's read-after-write is satisfied; the claim is held, not hoped.
- **Run log created** and pushed as the first file write, before any packet work.
  Commit `9683853`, pushed.
- **Tier confirmed HEAVY** under item 26 without needing item 28d's judgement —
  the label is `heavy`, not `tier/unreviewed`. It is also the correct call on the
  merits: the change guards a **write path**, and the value it guards feeds
  metric SQL (`OUTREACH_FIXED_FLAGS.countsVolunteerHours: true`). HEAVY means
  packet → `checker-premise` → worker → `checker-reviewer`.
- **Citations re-verified first-hand before writing the packet** (item 19c),
  against base `debe8e4`, rather than trusting the issue text:
  `OutreachEventDialog.tsx:1200` `isValid` is presence-only (verbatim match);
  the two per-session `TimeInput`s at `:1492-1503` carry no `min` and no
  `status`; `computeEndTimeError` is at `ScheduleMeetingsDialog.tsx:534` as
  described; `OUTREACH_FIXED_FLAGS` at `:660-663`. Two things the issue did not
  say, both found by checking: `timeStringToMinutesSinceMidnight`
  (`ScheduleMeetingsDialog.tsx:512`) is **module-private and not exported**, so
  the port cannot be a bare cross-import; and `TimeInput`'s `status` and `min`
  props are real (`astryx-api.md:1755` and `:1747`), so item 2 is satisfied.
- **Packet written** — `docs/swarm/active/GAM-377-packet.md`, with the item 19d
  **Least confident decisions** list (5 entries). It rules on the open question
  the issue left ("whole save vs per-day"): block the whole save AND mark the
  offending day, because silently skipping the bad day is the accept-show-discard
  shape this codebase has a standing ruling against. Not yet dispatched to a
  worker — item 19 forbids that until `checker-premise` returns DISPATCH.
