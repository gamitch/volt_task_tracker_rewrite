# GAM-479 — run log

Issue: <https://linear.app/gamitch/issue/GAM-479/cycling-an-attendance-chip-to-unset-deletes-the-whole-row-the-qr-check>
Branch: `claude/gam-479-attendance-unset-preserve`
Runtime: Claude (dispatch run), started 2026-08-22 03:02Z.

Credential deadline read at minute ~1 (AGENTS.md wall 3): the `ghs_` App token's
JWT payload is `iat 1787367738`, `exp 1787371338` — 3600s, expiring
**2026-08-22 04:02:18Z**. `gh pr create` must happen well before that; `git push`
uses the long-lived PAT and survives.

## Log

- **03:03Z — claimed.** `Todo → In Progress` via `issueUpdate`, then read back:
  `state=In Progress`, labels `meetings-redesign`, `heavy`. Item 28c satisfied
  (read-after-write), item 28d satisfied (tiered before the move).
- **03:03Z — tier judged HEAVY** (`tier/unreviewed` → `tier/heavy`). Defence:
  item 26 names "a write path or destructive operation" as a HEAVY trigger, and
  the whole subject of this issue *is* a destructive write path — the fifth stop
  of the attendance cycle issues a row `DELETE` that takes `check_in_at`,
  `check_out_at`, `hours_override`, `method` and `recorded_by` with it. A
  mistake here corrupts data a coach cannot recover, which is item 26's own
  deciding question answered "yes". Any fix that preserves the row instead of
  deleting it also plausibly needs a schema change (nullable status /
  constraint), which is a second independent HEAVY trigger and an item 18
  `model: "opus"` trigger for the worker. Two tiers are not arguable here; even
  if they were, item 26 says take the heavier.
- **03:08Z — draft PR #238 opened** (<https://github.com/gamitch/volt_task_tracker_rewrite/pull/238>),
  ~minute 6, with `docs/swarm/active/GAM-479-pr-body.md` written before the API
  call. Wall 3 satisfied with ~54 minutes of credential left.
- **03:09Z — claim comment posted to Linear** (`**Run log · Claude · claim ·
  2026-08-22**`), carrying the branch, the tier defence and the one thing known
  to be unresolved: the issue asks for a *decision* (undo affordance vs. null-status
  preservation) and does not pick one.
- **03:10Z — measuring the premise before anything else.** If it does not hold,
  this run stops and the issue goes back to `Todo` with the measurement recorded.
