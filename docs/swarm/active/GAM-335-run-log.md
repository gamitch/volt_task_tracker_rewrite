# GAM-335 run log

Issue: [GAM-335](https://linear.app/gamitch/issue/GAM-335/shadow-mode-computes-its-intended-action-from-the-post-automation) —
"Shadow mode computes its intended action from the post-automation state, so
an ordinary declared merge always scores MISMATCH — the 10-MATCH exit
criterion is unreachable"

Append-only. One line per milestone, committed and pushed immediately.

---

- **claimed** — read `AGENTS.md` § "Where work comes from" and
  `docs/swarm/constitution.md` items 19, 26, 28 first, in that order, per the
  dispatch prompt. No Linear MCP tool in this runtime; used direct GraphQL via
  `scripts/linear/client.mjs` (`LINEAR_API_KEY` present in env). Moved
  GAM-335 `Todo` → `In Progress` (`issueUpdate`), then re-read the issue:
  `state.name = "In Progress"`. Read-back confirms the claim (item 28c).
  Issue already carries `tier/fast`, not `tier/unreviewed`, so item 28d's
  claim-time tiering duty does not apply — tier judgement below is item 26's
  independent check, not a first tiering.
