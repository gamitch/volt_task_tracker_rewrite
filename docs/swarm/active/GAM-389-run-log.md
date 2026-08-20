# GAM-389 run log

Issue: <https://linear.app/gamitch/issue/GAM-389>
Branch: `claude/gam-389-anon-view-grants`
Runtime: Claude (dispatched from Linear on `Todo` transition)

This file is appended to at every milestone and pushed immediately. If it ends
mid-chain, the last line says what the run was holding when it died.

## Credential deadline (AGENTS.md wall 3)

Decoded the live `ghs_` App token at minute 1 rather than guessing:

- `iat 2026-08-20T03:00:03Z`
- `exp 2026-08-20T04:00:03Z` — 60 minutes exactly
- `gh pr create` must be called well before 03:53Z. `git push` uses the
  long-lived `github_pat_` in the extraheader and survives past it.

## Milestones

- 03:00Z — read `AGENTS.md` § "Where work comes from" and `constitution.md`
  (items 16, 18, 19, 20, 22, 23, 24, 25, 26, 28, 30) before opening any other
  file.
- 03:01Z — decoded credential deadline (above).
- 03:02Z — **tier judged before the `In Progress` move** (item 28d). GAM-389
  carried `tier/unreviewed`. Verdict **HEAVY**, and it is not arguable: the
  deliverable is a file under `supabase/migrations/` that changes `anon`
  grants on five `SECURITY DEFINER` views which bypass the RLS on the tables
  underneath. Item 26 names "a migration or metric-view SQL" and "RLS/auth/role
  logic" as HEAVY triggers; item 18 names the same two as `model: "opus"`
  worker triggers. The issue's own "Size and tier" section reaches the same
  conclusion. Note item 25 pulls the *other* way on severity — this is a
  volunteer team with no PII, and the issue itself declines to call it a
  compliance problem — but item 25 lowers the **security threat model**, not
  the process tier for migration/grant work. Tier follows the change's
  mechanism, not its severity.
- 03:02Z — claimed: `Todo → In Progress`, `tier/unreviewed` → `tier/heavy`,
  **read back and confirmed** (`state: In Progress`, labels `other`, `Bug`,
  `heavy`). No `gate/human`; no executor label, which under item 28b is the
  migration-era legacy Claude route, so this runtime may hold it.
- 03:03Z — branch `claude/gam-389-anon-view-grants` created; this run log is
  the first file write.
- 03:06Z — **draft PR #211 opened at minute ~6**, per AGENTS.md wall 3, while
  the branch carried only the run log and the PR-body artifact. ~54 minutes of
  credential to spare. Body artifact written *before* the API call and passing
  `.claude/skills/pr-body/scripts/check.mjs` (exit 0).
- 03:07Z — starting my own repo-side verification of the issue's premise
  before writing the HEAVY packet (item 19c: verify your own citations, do not
  make an opus gate discover them).
