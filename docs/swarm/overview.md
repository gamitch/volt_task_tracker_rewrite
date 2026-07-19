# VOLT Team Portal — Swarm Overview

**Read this file first.** It's the lean entry point. For anything not covered
here, go to the specific doc — don't re-read `task-ledger.md`,
`verification-log.md`, or `dispute-log.md` in full just to get oriented.

| Need | File |
|---|---|
| Per-task status, deps, Allowed Files, acceptance criteria | `task-ledger.md` |
| Full evidence/reasoning for a specific task's PASS/FAIL | `verification-log.md` (search `## T0xx`) |
| Boss-arbiter rulings (D001–D005) | `dispute-log.md` |
| Project rules, severity rubric, Non-Negotiables | `constitution.md` |
| Per-agent token/cost data | `metrics.md` |
| Astryx component API ground truth | `astryx-api.md` (grep, don't read whole file) |
| Archived worker/checker packets for Passed tasks | `archive/T0xx-*.md` |

## Status snapshot (2026-07-19, post-T034/T035/T048/T056)

74 tasks (T001–T070 + T002a + T002b + T006a + T016a) across epics E1–E11.
**31 Passed · 13 Ready · 0 In Progress · 30 Blocked.**

- **E1–E3 — fully complete** (T001–T020, incl. T002a/T002b/T006a/T016a
  corrective tasks). App has a real AppShell/TopNav/SideNav/MobileNav,
  `/login`→`/accept-invite` auth flow works end to end, dark-mode contrast is
  WCAG AA across the board.
- **E4 (Roster) — open.** T021 (`/roster` shell) Passed. **T022, T025, T026,
  T027, T028, T029** (rest of E4's first wave) Ready, undispatched, no
  packets yet.
- **E5 (Meetings/Check-in) — in progress.** T030 (`/meetings` list) Ready,
  undispatched (packet pre-built). **T034** (Kiosk) and **T035** (Check-in
  result) both Passed. T035 opened a tracked MINOR follow-up: DES-01's
  "running tally" has no real data source in the `checkin` payload; the
  worker's honest omission-with-disclosure was pre-authorized by its own
  packet and does not block PASS, but a small `checkin`-extending
  corrective task (or an explicit permanent-descope decision) is still
  needed eventually.
- **E6 — T038** (`/outreach` list) Ready, undispatched, packet pre-built.
- **E8 — T048** (Resend integration) **Passed** (NIT only — test-mode gate
  independently re-verified airtight). Unblocked **T049, T050**, both Ready.
- **E9 — T056** (`/reports` shell + Participation tab) **Passed** (NIT
  only). Unblocked **T057, T058**, both Ready.
- **E10 — T061 Passed.** T062 (ETL script) Ready, undispatched, packet
  pre-built.
- **E7, E9 (rest, T059+), E11** — still Blocked, waiting on E4/E5/E6's list
  pages or on T057/T058.

Worker packets pre-built and ready to dispatch without a foreman round-trip:
T030, T038, T049, T050, T057, T058, T062 (`docs/swarm/active/` for T030/
T038/T062 — need building for T049/T050/T057/T058).
T022/T025–T029 don't have packets yet either.

Two real incidents earlier this session, both handled cleanly — see Known
Decisions/Current Risks in `state-summary.md` if ever needed: (1) a
concurrent-checker scratch-file collision (T020/T021 checkers running in
parallel, no lasting harm); (2) a pre-existing `RequireRole` React 19
console warning surfaced by T021's checker, logged for later reconciliation,
not caused by or fixable within T021's own scope.

**Recurring cross-cutting gap, flagged by T018/T020/T021/T034/T035/T056
independently**: no shared Supabase client exists anywhere in `src/` yet.
Every content page so far ships an injectable `loadData`-style seam
defaulting to honest fixture/null data rather than fabricating. Worth
scheduling as a deliberate task once enough content pages exist to size it
properly — not yet a dispatched task.

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
- **D005**: PRD DES-03's raw dark-accent override breaks Astryx's baked
  `--color-on-accent` (dark primary-button text 4.04:1, below AA 4.5:1).
  Fixed via corrective task **T002b** (one authorized `volt.ts` token line +
  `theme.css` regen). `volt.ts`'s verbatim check is now "DES-03 byte-identical
  *except the D005-authorized on-accent line*." Standing rule: contrast checks
  must include foreground-ON-accent pairings in both modes, not only
  accent-on-surface. `astryx-api.md` Button section has a second marked
  annotation.
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

Thirteen tasks are Ready: T022, T025, T026, T027, T028, T029, T030, T038,
T049, T050, T057, T058, T062. Worker packets already exist for T030/T038/
T062 — dispatch those directly. The rest need packets built first (T049/T050
straightforward from the ledger's T048 detail block; T057/T058 from T056's;
T022/T025–T029 need foreman planning against E4's roster spec). All are
file-disjoint and independently dispatchable in parallel if budget allows;
pace per session/weekly usage as usual.
