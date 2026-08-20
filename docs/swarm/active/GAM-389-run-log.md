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
- 03:18Z — own verification done, four results, two of which correct the issue:
  1. **The issue's one self-declared "Not verified" item is now measured, and
     it goes against the issue's framing.** None of the five views exposes a
     name. Every one is UUIDs and figures. The single view that *does* carry
     `display_name` is `v_leaderboard_students` — the one already revoked.
  2. `v_event_student_hours` is not a per-student view at all despite its
     name: it is per-**event** (`event_id, season_id, title, starts_on,
     ends_on, student_count, total_hours`). The issue lists it among views
     leaking "22 team members'" figures; it leaks no student identity.
  3. All five are aggregate or multi-table, so none is auto-updatable — the
     `DELETE`-without-`SELECT` path that forced `revoke all` on the
     leaderboard (`20260803000001:32-38`, measured `DELETE 2`) does **not**
     exist here. `revoke all` is still the right form, but for consistency and
     future-proofing, not because a live write path is open.
  4. **No unauthenticated surface reads any of them.** `src/app/router.tsx`
     :72-88 — only `/login` and `/accept-invite` are public, and PRD SEC-04
     forbids public pages outright. Every reader (`loaders/dashboard.ts:363`,
     `loaders/leaderboard.ts:147`, reports/home pages, weekly digest) sits
     behind `RequireAuth`.
- 03:19Z — next: write the HEAVY packet, then the item-19 premise gate.
- 03:24Z — packet written: `docs/swarm/active/GAM-389-packet.md`. HEAVY, worker
  pinned **opus** per item 18. Chooses **revoke** over document-and-keep, on the
  ground that the alternative requires reconsidering an owner ruling
  ("Close it off", 2026-07-31) and no agent may do that. Carries three
  corrections to the issue and a five-entry Least confident decisions list
  (item 19d).
- 03:25Z — **DISPATCHING `checker-premise` (opus, blocking, item 19).** If this
  line is the last one in this file, the run died holding this subagent.
