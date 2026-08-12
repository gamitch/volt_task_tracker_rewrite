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
- **premise measured against current `main` (`2d22664`) — HOLDS.**
  `scripts/linear-sync.mjs:619` fetches `issue` live (post-automation, since
  the incumbent `merge -> Done` fires ~2s after merge and the sync run starts
  well after that). `decide()` is called with that live `issue` at line 624.
  `runShadowComparison` (541-583) separately reconstructs the prior state via
  `reconstructAutomationTransition` (565) but uses it **only** to decide
  whether `automationClosed` is true (567) — the reconstructed state is never
  fed back into `decide()`. So `decide()` sees `state.name === 'Done'` for any
  ordinary already-closed-by-automation merge, hits the `stateName === 'Done'`
  branch (251-269) with no `ownClaim` (shadow never posts a claim comment),
  and returns `DUPLICATE_CLOSE_CLAIM` → `action: 'none'` →
  `intendedWouldClose = false`, which mismatches the automation's real
  `automationClosed = true` every time. Matches the issue's cited run
  31600702807 exactly. Confirmed by reading, not re-running (a network probe
  against Linear isn't warranted for a wiring bug already reproduced live).
- **tier judgement (item 26) — FAST confirmed.** Trigger question: *can a
  mistake here corrupt data, or lie to a user about their own data?* No —
  `SYNC_MODE` is hardcoded `shadow`; shadow mode never writes to Linear
  (confirmed: `runShadowComparison` only reads + posts to Slack; the write
  path in `main()` is gated behind `syncMode === 'shadow'` returning early at
  line 643 before any `issueUpdate`/`postComment` call). No schema, RLS,
  migration, or auth/role logic. No signature another module imports changes
  (new export only). Single module (`scripts/linear-sync.mjs` +
  `scripts/linear-sync.test.mjs`). Fix is call-site rearrangement, well under
  20 lines. A named mutation exists (see below) that turns a new test red.
  **FAST**, matching the issue's own tier claim.
