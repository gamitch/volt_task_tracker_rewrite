# GAM-443 — run log

Issue: <https://linear.app/gamitch/issue/GAM-443/meeting-datetime-formatters-are-duplicated-between-meetingslist-and>
Branch: `claude/gam-443-meetings-format-extract`
Runtime: Claude (Opus 5), dispatched from Linear on `Todo` transition.

This log is appended and pushed at every milestone. If it ends mid-chain, the
last line says what the run was holding when it died.

## Credential deadline (AGENTS.md wall 3)

- `ghs_` App token `iat 2026-08-21T05:02:45Z`, `exp 2026-08-21T06:02:45Z` (3600s).
- Decoded at 05:04Z — 58.3 minutes of PR credential. Draft PR opens immediately.

## Milestones

- **05:03Z — claimed.** Fetched GAM-443 live from Linear (no Linear MCP tool in
  this runtime; used `scripts/linear/client.mjs` + `LINEAR_API_KEY`, which is
  this repo's own read/write path). No `gate/human`; no `executor/*` label, and
  item 28b makes a missing route legacy Claude-only, so this runtime may claim
  it. Moved `Todo → In Progress`, swapped `tier/unreviewed → tier/heavy`,
  read back: state `In Progress`, labels `meetings-redesign, Improvement,
  heavy`. Claim held.

- **05:04Z — tier judged HEAVY (item 26/28d), against the issue's own
  suggestion of STANDARD.** The filer's suggestion is input, not authority, and
  the row arrived `tier/unreviewed` precisely so the tier is decided here.
  Defence: item 26's HEAVY trigger list includes *"an export another session
  builds against"*, and that is this ticket's entire stated purpose — it creates
  `src/lib/meetings/format.ts` as the import surface for five parallel
  `meetings-redesign` components, and GAM-441's decomposition ticket **freezes
  `buildScheduleChips`'s input shape into `types.ts`**. A wrong signature here
  is not one rework, it is every Wave-2 ticket's rework. Item 26's tie-break
  ("if two tiers are arguable, take the heavier one") points the same way.
  What would make this wrong: if `buildScheduleChips` were already consumed by
  a merged component, the shape would be settled and STANDARD would be right.
  It is not — the function does not exist yet.

- **05:05Z — branch created, run log written, draft PR next.**

- **05:07Z — draft PR #223 opened** (<https://github.com/gamitch/volt_task_tracker_rewrite/pull/223>),
  at minute ~5 of the 60-minute credential, carrying only the run log and the
  PR-body artifact. Body artifact written *before* the API call and validated
  by `.claude/skills/pr-body/scripts/check.mjs` (exit 0, `closes GAM-443`).

- **05:08Z — reading the real code to verify the issue's citations** before
  writing the HEAVY packet (item 19c: roughly half of a gate's round-1 findings
  are the author's own unverified line numbers).
