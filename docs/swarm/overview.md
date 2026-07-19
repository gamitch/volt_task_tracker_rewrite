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

## Status snapshot (2026-07-19, post-T041/T043/T046/T047/T051/T059 batch — all 6 closed)

75 tasks (T001–T071 + T002a + T002b + T006a + T016a) across epics E1–E11.
**64 Passed · 2 Ready · 0 In Progress · 9 Blocked.**

- **E1–E8 all fully Passed for every automatable task.** E6's last automatable piece was T042
  (still Ready — the one remaining outreach task); E7/E8 are both now 100% Passed.
- **E9 (Reports/Home) — one task from fully complete.** T053–T059 all Passed. **T060 (`/settings`)**
  Ready (unblocked by T046).
- **T042 (Mark day complete dialog)** Ready — the last piece of E6, unblocked by T041.
- **E10 (Migration)** — T061, T062 Passed. T063/T064/T065 remain Blocked, gated on human-supplied
  old-project credentials and sign-offs (George).
- **E11 (Launch sweeps)** — T066–T069 remain Blocked, waiting on T042 and T060 (the last two pieces
  of the T053–T060-equivalent range) before they can start.
- **Only two Ready tasks left with no packet yet: T042, T060** — once both land, essentially
  everything left in the ledger is a human gate (T052, T063, T065, T070) or an E11 sweep waiting on
  them.
- **This session's four legitimate FAIL→rework→PASS cycles** (across both recent batches): T033
  (secret-name leak), T054 (Divider-instead-of-Heading), T040 (`setTimeout` int32 overflow), T045
  (non-unique link text). Every one was fixed with a narrow attempt-2 rework and re-verified by a
  narrow re-check that independently reproduced the worker's own regression proof.

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
- **E4 (Roster) — fully complete.** T021–T029 all Passed.
- **E5 (Meetings/Check-in) — fully complete.** T030–T036 all Passed
  (T033, T036 each had one legitimate FAIL→rework→PASS cycle).
- **E6 (Outreach) — one task left.** T038–T041, T043, T044 all Passed.
  **T042 (Mark day complete dialog)** Ready, undispatched — the last piece.
- **E7 (Calendar) — fully complete.** T045–T047 all Passed.
- **E8 (Reminders) — fully complete for all automatable work.** T048–T051
  all Passed. T052 (human gate) Blocked, externally gated on George's
  `mail.voltfrc.org` domain verification and sign-off — carries a real,
  disclosed follow-up question (does `notification_prefs.digest_enabled`
  need to also gate weekly-digest sends?) for that sign-off to resolve.
- **E9 (Reports/Home) — one task left.** T053–T059 all Passed. **T060
  (`/settings`)** Ready, undispatched — the last piece.
- **E10 (Migration) — T061, T062 Passed.** T063 is a human gate blocked on
  George's real old-project credentials; T064/T065 blocked behind it.
- **E11 (Launch sweeps) — Blocked**, waiting on T042 and T060 (the last two
  pieces of the T053–T060-equivalent completion range) before any of
  T066–T069 can start.

Two Ready tasks have no packets built yet: T042, T060 — each needs one
built (directly or via foreman-planner) before dispatch. Once both land,
essentially everything remaining in the ledger is either a human gate
(T052, T063, T065, T070) or an E11 sweep waiting on them.

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

Two tasks are Ready: T042, T060. Neither has a worker packet pre-built yet
— both need one built first, either directly or via foreman-planner. They
are file-disjoint and dispatchable in parallel.
**Both are equally high-leverage** — they are the last two pieces standing
between the current state and E11's launch sweeps (T066–T069) becoming
dispatchable. T060 (`/settings`) also closes out E9 entirely; T042 (Mark
day complete dialog) closes out E6 entirely.

Separately, worth deciding when to prioritize: drafting the T016a-pattern
wiring series that connects T071's new client into `guards.tsx` and the
six pages that flagged the gap (T018/T020/T021/T034/T035/T056) — this is
what actually makes the app show real data instead of fixtures, once
George's Supabase project exists.
