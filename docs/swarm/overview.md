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

## Status snapshot (2026-07-19, ~1am)

73 tasks (T001–T070 + T002a + T006a + T016a) across epics E1–E11.
**23 Passed · 9 Ready · 1 In Progress · 40 Blocked.**

- **E1 (Scaffold/shell/nav) — fully complete.** T001–T008 all Passed. App has a
  real AppShell/TopNav/SideNav/MobileNav, `/login` is genuinely reachable and
  wired into the router.
- **E2 (Schema/RLS/metrics) — fully complete.** T009–T014 all Passed. Schema,
  RLS policies, metric views, and their fixture tests are all done.
- **E3 (Auth/invites) — T019 Passed, this was the critical-path unlock.**
  T015/T016/T016a/T017/**T019** all Passed. **T019** (invite-acceptance DB
  trigger) resolved a genuinely tricky design decision (which `auth.users`
  column-transition signals mean "first successful sign-in," given invite
  emails are sent earlier via T017) — checker independently re-ran 6
  scenarios + 3 adversarial probes on its own scratch Postgres and explicitly
  concluded no dispute escalation was needed. **T018** (`/accept-invite`
  screen) is Ready, undispatched — the one remaining piece of the auth chain.
- **E4 — T021** (`/roster` shell) now Ready — **the first real content-page
  task in the entire ledger.**
- **E5 — T030** (`/meetings` list) now Ready (first content page in E5).
  T032 (`checkin` Edge Function) Passed earlier. T034/T035 also Ready.
- **E6 — T038** (`/outreach` list) now Ready (first content page in E6).
- **E8 — T048** (Resend integration) Ready, undispatched.
- **E9 — T056** (`/reports` shell) Ready, undispatched.
- **E10 — T061 Passed.** T062 (ETL script) Ready, undispatched.
- **E7, E9 (rest), E11** — still Blocked, waiting on E4/E5/E6's list pages
  landing first.

Worker packets are already pre-built for T018, T034, T035, T048, T056, T062
(`docs/swarm/active/T0xx-worker-packet.md`) — ready to dispatch without
another foreman round-trip. T021/T030/T038 (the new unblocks) don't have
packets yet.

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

Nine tasks are Ready: T018, T021, T030, T034, T035, T038, T048, T056, T062.
Worker packets already exist for T018/T034/T035/T048/T056/T062 — dispatch
those directly. T021/T030/T038 (the new content-page unblocks) need packets
built first. All nine are file-disjoint and independently dispatchable in
parallel if budget allows; pace per session/weekly usage as usual.
