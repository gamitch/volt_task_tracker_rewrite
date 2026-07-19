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

## Status snapshot (2026-07-19, post-T042/T060 — E6 and E9 both fully complete)

75 tasks (T001–T071 + T002a + T002b + T006a + T016a) across epics E1–E11.
**66 Passed · 4 Ready · 0 In Progress · 5 Blocked.**

- **E1–E9 all fully Passed for every automatable task.** Every content page, dialog, and Edge
  Function in the entire app is built and independently checker-verified.
- **E10 (Migration)** — T061, T062 Passed. T063/T064/T065 remain Blocked, gated on human-supplied
  old-project credentials and sign-offs (George).
- **E11 (Launch sweeps) — all four now Ready**, unblocked by T060 completing the full T053–T060
  range: **T066** (Playwright persona smoke tests), **T067** (accessibility sweep), **T068**
  (responsive sweep), **T069** (empty/error copy audit). Worker packets are pre-built for all four.
  **T066's packet flags a major, unresolved tension worth reading before dispatch**: no page in the
  app is wired into a real route with a real backend yet, so a literal "click through the real
  running app" Playwright suite may not be buildable as PRD Section 14 literally describes — the
  packet gives three honest resolution paths (build against fixture data with disclosed skips,
  escalate as a dispute that this task is scheduled ahead of the still-undispatched T016a wiring
  series, or a disclosed combination).
- **Once T066–T069 land, essentially everything left is a human gate**: T052 (production email —
  only needs George's Resend domain verification + final sign-off now; the `digest_enabled`
  question is resolved), T063/T065 (migration gates), T070 (final go-live).
- **This session's four legitimate FAIL→rework→PASS cycles**: T033 (secret-name leak), T054
  (Divider-instead-of-Heading), T040 (`setTimeout` int32 overflow), T045 (non-unique link text).
  Every one was fixed with a narrow attempt-2 rework and re-verified by a narrow re-check that
  independently reproduced the worker's own regression proof.


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
- **E6 (Outreach) — fully complete.** T038–T044 all Passed.
- **E7 (Calendar) — fully complete.** T045–T047 all Passed.
- **E8 (Reminders) — fully complete for all automatable work.** T048–T051
  all Passed. T052 (human gate) Blocked, externally gated on George's
  `mail.voltfrc.org` domain verification and final sign-off — the
  `digest_enabled`-vs-`weekly_digest` question is resolved (George
  confirmed `weekly_digest` alone is correct, `digest_enabled` is
  vestigial).
- **E9 (Reports/Home) — fully complete.** T053–T060 all Passed.
- **E10 (Migration) — T061, T062 Passed.** T063 is a human gate blocked on
  George's real old-project credentials; T064/T065 blocked behind it.
- **E11 (Launch sweeps) — all four tasks now Ready**, unblocked by T060
  completing the full T053–T060 range: T066, T067, T068, T069.

Four Ready tasks have worker packets already pre-built: T066, T067, T068,
T069 (`docs/swarm/active/T0{66,67,68,69}-worker-packet.md`). T066's packet
flags a major, unresolved tension worth reading before dispatch — see the
Status snapshot above.

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

Four tasks are Ready, all with worker packets already pre-built: T066,
T067, T068, T069 (E11's launch sweeps). **Read T066's packet before
dispatching it** — it flags a major, unresolved tension (no page is wired
into a real route with a real backend yet, so its literal "click through
the real app" acceptance criteria may not be satisfiable as written) and
gives three honest resolution paths, one of which is escalating a dispute
rather than proceeding. T067/T068/T069 (accessibility/responsive/copy
sweeps) are lower-risk audit tasks and can be dispatched as-is.

Separately, worth deciding when to prioritize: drafting the T016a-pattern
wiring series that connects T071's new client into `guards.tsx` and the
six pages that flagged the gap (T018/T020/T021/T034/T035/T056) — this is
what actually makes the app show real data instead of fixtures, once
George's Supabase project exists.
