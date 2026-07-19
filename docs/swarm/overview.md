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

## Status snapshot (2026-07-19, post-T033; T054/T055 dispatched)

75 tasks (T001–T071 + T002a + T002b + T006a + T016a) across epics E1–E11.
**40 Passed · 15 Ready · 2 In Progress (T054, T055 workers running) · 18 Blocked.**

- **T033 (live check-in console) Passed on attempt 2** — a legitimate FAIL on attempt 1 (MAJOR,
  real constitution item 5 secret-name leak in a comment) after the checker independently confirmed
  the BLOCKER-class DES-17 keyboard path, MTG-11, and MTG-12 all genuinely correct. Unblocks T036.
- Worker packets written (not yet dispatched) for **T025, T026, T027, T028, T029** — the rest of
  E4's roster CRUD. T025 (Parents) and T028 (Admin toggles) each flag a real, undocumented schema
  gap (no `profiles` active/inactive concept; no leaderboard-privacy persistence column anywhere)
  for the assigned worker to investigate and disclose rather than silently invent a migration for.
  T027 (Invites) cites an already-applied DB trigger (`trg_audit_invite_revocation`) so its worker
  doesn't redundantly reimplement the audit-log write. See `docs/swarm/active/T02{5,6,7,8,9}-worker-packet.md`.

- T022 (Students tab) Passed, NIT — unblocked T023, T024.
- T031 (Schedule meetings dialog) Passed, NIT — unblocked **T033, the live
  check-in console** (its other dependency, T032, was already Passed). This
  is high-priority — the single most operationally critical screen in the
  app (real-time attendance during an actual meeting).
- T037 (consistency strip) Passed, NIT — unblocked T055 (Parent Home). A
  full-ledger sweep also caught and fixed a missed unblock: **T054**
  (Student Home) had all four dependencies already Passed but was never
  flipped to Ready — corrected.
- T053 (Coach/Admin Home) Passed, MINOR — checker independently rendered a
  separate constitution-item-3 verdict per KPI card (2 of 4 don't map onto
  a single T013 view); all four ruled compliant. First page in the ledger
  built on Astryx's real `dashboard` template.
- E9 (Reports/Home) now has 3 of 8 tasks Passed (T053, T056, T061-adjacent
  work aside) with T054/T055 Ready and T057/T058 Ready — closing in on
  being fully open.

**T071 (shared Supabase client) Passed, clean, no findings.** The recurring
cross-cutting gap flagged by six prior tasks is now closed at the
infrastructure level — `src/lib/supabase/**` exists, is fully tested, and
is safe (lazy-init, zero secrets in the built bundle, zero fake-data
fallback). It is not wired into `guards.tsx` or any page yet (deliberately
out of scope, see Standing Rules) — a follow-up T016a-pattern wiring series
is the next step whenever it's prioritized, one small task per
page/`guards.tsx`.

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

**Recurring cross-cutting gap, flagged by T018/T020/T021/T034/T035/T056,
now resolved at the infra level**: T071 (`src/lib/supabase/**` — client
singleton, auth/session surface, typed loader helper) **Passed clean on
2026-07-19**. Every page so far still renders its own fixture/null data
(none are wired to T071 yet — that's a deliberate, separate follow-up
series, T016a-pattern, one small task per page + one for `guards.tsx`).
See the T071 detail block in `task-ledger.md` (end of E3) and its
`verification-log.md` entry for full evidence.

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
- A real Supabase client now exists (`src/lib/supabase/**`, T071, Passed)
  but is not wired in anywhere yet — `guards.tsx` is still T005's in-memory
  placeholder. Wiring is a deliberate future follow-up series, not yet
  dispatched tasks.
- 4 real CI-breaking regressions have occurred and been fixed same-day
  (vitest/Vite mismatch, Node version floor, T006 wiring/D003, Deno files
  leaking into root ESLint/vitest scope) — see state-summary.md if a 5th
  ever needs the pattern-matching history.

## Next recommended action

Seventeen tasks are Ready: T023, T024, T025, T026, T027, T028, T029, T033,
T039, T044, T045, T049, T050, T054, T055, T057, T058. None currently have
worker packets pre-built — each needs one built first, either directly or
via foreman-planner. All are file-disjoint and independently dispatchable
in parallel if budget allows; pace per session/weekly usage as usual.
**T033 (live check-in console) is the highest-leverage pick** — the single
most operationally critical screen in the app.

Separately, worth deciding when to prioritize: drafting the T016a-pattern
wiring series that connects T071's new client into `guards.tsx` and the
six pages that flagged the gap (T018/T020/T021/T034/T035/T056) — this is
what actually makes the app show real data instead of fixtures, once
George's Supabase project exists.
