# VOLT Team Portal — Swarm Overview

**Read this file first.** It's the lean entry point. For anything not covered
here, go to the specific doc — don't re-read `task-ledger.md`,
`verification-log.md`, or `dispute-log.md` in full just to get oriented.

| Need | File |
|---|---|
| Per-task status, deps, Allowed Files, acceptance criteria | `task-ledger.md` |
| Full evidence/reasoning for a specific task's PASS/FAIL | `verification-log.md` (search `## T0xx`) |
| Boss-arbiter rulings (D001–D004) | `dispute-log.md` |
| Project rules, severity rubric, Non-Negotiables | `constitution.md` |
| Per-agent token/cost data | `metrics.md` |
| Astryx component API ground truth | `astryx-api.md` (grep, don't read whole file) |
| Archived worker/checker packets for Passed tasks | `archive/T0xx-*.md` |

## Status snapshot (2026-07-19, ~night)

73 tasks (T001–T070 + T002a + T006a + T016a) across epics E1–E11.
**22 Passed · 7 Ready · 0 In Progress · 44 Blocked.**

- **E1 (Scaffold/shell/nav) — fully complete.** T001–T008 all Passed. App has a
  real AppShell/TopNav/SideNav/MobileNav, `/login` is genuinely reachable and
  wired into the router.
- **E2 (Schema/RLS/metrics) — fully complete.** T009–T014 all Passed. Schema,
  RLS policies, metric views, and their fixture tests are all done.
- **E3 (Auth/invites) — in progress.** T015/T016/T016a/T017 Passed.
  **T018** (`/accept-invite` screen) and **T019** (invite-acceptance DB
  trigger) are Ready and undispatched — **this is the critical-path unlock**
  for the first real content pages (Roster/Meetings/Outreach all need T019).
- **E5 — T032** (`checkin` Edge Function) **Passed** (1st attempt, two MINOR
  follow-ups: MTG-04 manual-override schema gap and in-memory-only rate
  limiter, both genuinely undoable within the frozen schema). **T034**
  (Kiosk view) and **T035** (`/checkin` result screen) are now Ready,
  undispatched. T033/T054 remain Blocked on other deps (T031/T030/T038).
- **E8 — T048** (Resend integration) Ready, undispatched.
- **E9 — T056** (`/reports` shell) Ready, undispatched.
- **E10 — T061** (schema verification + mapping doc) **Passed** (1st attempt,
  clean). MIG-01 scoped to an honest, checker-reconfirmed blocker report (no
  live old-project access reachable); MIG-02 (`mapping.md`) confirmed
  byte-identical to PRD 10.2. **T062** (ETL script `scripts/migrate.ts`) is
  now Ready, undispatched.
- **E4, E6, E7, E9 (rest), E11** — all Blocked on T019 or later, not yet
  reachable.

Everything else (all 44 Blocked rows) is waiting transitively on T019 or on
one of the seven Ready tasks above. See `task-ledger.md`'s Deps column for
exact chains if needed — don't re-derive from memory.

## Standing rules (condensed — full reasoning lives in state-summary.md/dispute-log.md if ever needed)

- **D001**: never infer worker authorship from git history — compare Allowed
  Files against the current file tree instead.
- **D002**: stack is locked to **React 19** (not PRD's literal "React 18") —
  `@astryxdesign/core` requires it at runtime.
- **D003**: when a task's wiring change mounts a component tree for the first
  time, check whether pre-existing tests in adjacent forbidden files could
  break — this has happened 3 times (T006/CI-break, plus 2 earlier CI breaks).
- **D004**: Astryx's `mobileNav={<X/>}` shorthand silently disables the
  toggle in the installed version — use the `{ content: <X/> }` config form.
  `astryx-api.md` has been corrected with marked annotations.
- Every task's close-out includes a full-ledger sweep (not just direct
  dependents) — this is why the Ready/Blocked counts above are trustworthy.
- No worker self-certifies; every PASS requires independent checker
  re-derivation of evidence, not trust of worker claims.
- External prerequisites still open: Supabase project creation, Google OAuth
  client, Vercel CNAME (all George). Resend domain verification is done.
- No real Supabase auth client exists yet anywhere in `src/` — `guards.tsx`
  is still T005's in-memory placeholder. Flagged as debt needing deliberate
  scheduling, not yet a dispatched task.
- 4 real CI-breaking regressions have occurred and been fixed same-day
  (vitest/Vite mismatch, Node version floor, T006 wiring/D003, Deno files
  leaking into root ESLint/vitest scope) — see state-summary.md if a 5th
  ever needs the pattern-matching history.

## Next recommended action

Dispatch **T018 + T019** — T019 is the highest-value next task since it
unblocks the first real content pages (Roster/Meetings/Outreach). T034,
T035, T048, T056, and T062 are also Ready and undispatched, all
independently dispatchable in parallel with T018/T019 (file-disjoint).
