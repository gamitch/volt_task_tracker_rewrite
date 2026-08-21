# GAM-446 — run log

Coach cards need attendance %, roster counts and a parent child-list the
meetings loaders don't return — extend `loadCoachMeetingsData` and add
`listGuardianChildren`.

Branch: `claude/gam-446-coach-card-loader-data`
Orchestrator: Claude (dispatched run, 2026-08-21)

Append-only. One line per milestone, pushed immediately. If this file ends
mid-chain, the last line names what the run was holding when it died.

## Timeline (UTC)

- **22:41 — dispatched.** Read `AGENTS.md` § "Where work comes from" and
  `docs/swarm/constitution.md` (items 18, 19, 22, 26, 28) before opening any
  other file.
- **22:44 — tiered HEAVY (item 28d, before the `In Progress` move).** The issue
  arrived `tier/unreviewed` and suggests STANDARD; I am overriding upward.
  Item 26's deciding question — *can a mistake here lie to a user about their
  own data?* — is yes: a wrong join against `v_event_attendance` shows a
  student a false attendance percentage. And item 26's explicit HEAVY trigger
  **"an export another session builds against"** is met literally: this
  ticket's row model is the frozen contract the parallel Wave-2 UI tickets and
  the integration ticket code against. Item 26 also says when two tiers are
  arguable, take the heavier one. Not FAST (changes a signature other modules
  import; >20 lines). Recorded as `tier/heavy`.
- **22:45 — claimed.** `Todo → In Progress` via `issueUpdate`, then re-read
  (item 28c): state reads `In Progress`, labels `tier/heavy`,
  `meetings-redesign`, `Improvement`. No `gate/human`; no executor label, which
  under item 28b is the legacy Claude-only route. **Correction made during the
  claim:** my first `issueUpdate` passed `labelIds` as a full replacement and
  dropped `meetings-redesign` and `Improvement`; the read-back caught it and the
  next write restored both. `executor/claude` deliberately NOT applied — the
  missing route already means Claude, and adding it would change routing beyond
  what item 28d asks of a claim.
- **22:46 — credential deadline measured (wall 3).** Decoded the live `ghs_`
  token: `iat 2026-08-21T22:40:39Z`, `exp 2026-08-21T23:40:39Z`. The PR must be
  opened well before 23:40Z. `git push` uses the long-lived PAT in the
  extraheader (confirmed present) and survives past it.
- **22:47 — run log created and pushed; draft PR next, before any source work.**
