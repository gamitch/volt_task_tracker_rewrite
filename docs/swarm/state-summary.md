# Swarm State Summary

**For orientation, read `overview.md` first — it's the lean entry point.**
This file keeps a compact per-task log (one line each) and the standing
decisions/risks that don't belong in a single-page overview. Full
reasoning/evidence for any task lives in `verification-log.md`; full dispute
rulings live in `dispute-log.md`. Older, longer versions of this file's
entries are preserved in git history if ever needed — this file is kept
deliberately terse going forward.

## Completed (one line each — full detail in verification-log.md)

- T001 — Vite/TS/ESLint scaffold. PASS (2nd check, 1st was a D001 false alarm).
- T002 — Astryx install + volt.ts theme. PASS (2nd attempt, 1st was a legit upstream type-gap FAIL).
- T002a — React 18→19 upgrade (D002). PASS (2nd attempt, 1st was a narrow pre-existing format gap).
- T003 — CSS cascade layers. PASS (1st attempt, clean).
- T004 — CI pipeline. PASS (1st attempt, clean). *2 real CI breaks found on live infra afterward — see Known Decisions.*
- T005 — Router + guards. PASS (2nd attempt; 1st was a legit BLOCKER, kiosk route left public).
- T006 — AppShell + TopNav. PASS (1st attempt; own deliverable clean, but broke a pre-existing test — D003, resolved via T006a).
- T006a — D003 corrective task (CI test fix). PASS (1st attempt, clean).
- T007 — SideNav. PASS (2nd attempt; 1st was a legit BLOCKER, hard-navigation/session-loss on every click).
- T008 — MobileNav (E1's last task, epic now fully done). PASS (1st attempt, D004-amended scope after a correct mid-attempt escalation).
- T009 — Migration: identity/roster. PASS (1st attempt, MINOR: avatar_url default gap, routed to T019).
- T010 — Migration: scheduling/attendance. PASS (1st attempt, MINOR: notes column default gap, routed to T031/T039).
- T011 — Migration: support + audit triggers. PASS (1st attempt, MINOR: notification_prefs defaults, accepted as-is).
- T012 — RLS helpers + policies (highest-stakes task to date). PASS (1st attempt, clean).
- T013 — Metric views (verbatim PRD 8.4). PASS (1st attempt, clean).
- T014 — NFR-03 fixture tests. PASS (1st attempt, clean).
- T015 — Supabase Auth provider config. PASS (1st attempt, NIT only).
- T016 — `/login` screen. PASS (1st attempt, MINOR: latency-sim timing gap on Google path).
- T016a — Wire LoginPage into router.tsx (corrective task). PASS (1st attempt, clean; 2 earlier attempts hit session-limit interruptions, not quality issues).
- T017 — `send-invite` Edge Function. PASS (1st attempt, MINOR: no retry idempotency, routed as follow-up).
- T061 — Schema verification + mapping doc copy (MIG-01/02). PASS (1st attempt, clean). MIG-01 scoped to an honest, checker-reconfirmed blocker report (no live old-project access reachable); MIG-02 (`mapping.md`) confirmed byte-identical to PRD 10.2. T062 unblocked (Blocked→Ready).

**E1 and E2 are fully complete.** Full evidence for every row above is in
`verification-log.md` under its `## T0xx` heading.

## Active

T032: worker done, checker packet built
(`docs/swarm/active/T032-checker-packet.md`), checker not yet dispatched
(Wave 2 of a batch, paced deliberately).

## Known Decisions (condensed — full rulings in dispute-log.md)

- **Stack lock**: Vite + React 19 (D002 deviation from PRD's "React 18") + TS
  strict + Supabase + Astryx only, no Tailwind/shadcn.
- **D001** (resolved): never infer worker authorship from git history —
  compare Allowed Files against the file tree instead. Standing rule for
  every checker packet.
- **D002** (resolved): React 19 required at runtime by `@astryxdesign/core`;
  T002a closed this out end-to-end.
- **D003** (resolved): T006's mandated wiring broke a pre-existing test in a
  forbidden file; T006a fixed it same-day. Standing rule: when a wiring
  change mounts a component tree for the first time, checkers should
  consider whether adjacent forbidden-file tests could break.
- **D004** (resolved): Astryx's `mobileNav={<X/>}` shorthand silently
  disables the toggle in the installed version; use `{ content: <X/> }`
  instead. `astryx-api.md` corrected with marked annotations.
- **Full-ledger sweep standing rule**: every PASS close-out sweeps the
  *entire* Deps column for newly-unblocked tasks, not just direct
  dependents. This has been done consistently since T001; the audit trail
  of each individual sweep is in git history of this file if ever needed —
  `task-ledger.md`'s live Status column is the current source of truth.
- **Checker-packet calibration**: new `docs/swarm/active/*.md` files and
  hook-appended `verification-log.md` lines are expected background
  artifacts of swarm operation, not per-task findings. Standing instruction
  in every checker packet.
- **`audit_log.actor NOT NULL`**: any service-role/background write to
  `attendance`/`profiles`/`students`/`event_sessions`/`invites` must
  `SET LOCAL app.actor_id` first or the audit trigger hard-fails. Watch for
  this on T032, T036, T042, T051, and any future automated job.
- **4 real CI-breaking regressions**, all fixed same-day: (1) vitest 4.x
  required Vite 6+, incompatible with the pinned Vite 5 — downgraded to
  vitest 3.x. (2) Node 20.18.1 predates `require(esm)` support jsdom's
  transitive deps need — bumped to 22.22.2. (3) D003 above. (4) Deno Edge
  Function files leaked into root ESLint/vitest scope (both tools default to
  scanning the whole repo) — excluded `supabase/functions/**` from both.
  **Pattern**: any new non-frontend runtime under a new top-level directory
  needs a matching root-config exclusion — check this proactively.

## Current Risks

- **No real Supabase auth client anywhere in `src/`**: `guards.tsx`'s
  `login()`/`loginWithGoogle()` are still T005's in-memory placeholder — no
  real `signInWithPassword`/`signInWithOAuth`, no real role lookup. This is
  core-requirement debt (AUTH-01) accumulating across multiple Passed tasks.
  Not yet scheduled — flagged for deliberate prioritization, not an ordinary
  backlog item.
- **External prerequisites (George-only, not swarm tasks)**: (1) Supabase
  project creation — blocks live verification beyond scratch-Postgres.
  (2) Google OAuth client — blocks T015 end-to-end. (3) ~~Resend domain
  verification~~ — done, confirmed. (4) Vercel CNAME — blocks T070.
- **T018 will need its own router.tsx wiring task** for `AcceptInvitePage`,
  same shape as T016a — not automatically covered.
- Loop limit: 3 failed attempts per task before mandatory boss-arbiter
  escalation (constitution "Loop Limit").
- No task is ever marked complete on worker self-report — every PASS
  requires independent checker-inspected evidence.

## Metrics note

`docs/swarm/metrics.md` was stale (only T001/T002) until a 2026-07-17
backfill reconstructed T003–T015 from the session transcript's actual usage
data. Going forward, each close-out should append its own invocation rows —
this has not been consistently maintained since the backfill; treat
`metrics.md` as directionally useful, not complete, until re-audited.
