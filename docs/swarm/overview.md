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

## Status snapshot (2026-07-19, post-T073b2 — router-wiring series COMPLETE)

81 tasks (T001–T075 + T002a + T002b + T006a + T016a + T073a + T073b1 + T073b2) across epics
E1–E11 plus the now-complete router-wiring series (E3).
**75 Passed · 1 Ready · 0 In Progress · 5 Blocked.**

**The router-wiring series is done.** All 13 app routes resolve to real components with real,
working Supabase authentication end to end (`guards.tsx`'s `AuthProvider` now genuinely calls
Supabase via T071's auth module — two-step async session→role resolution, AUTH-04 no-profile
handling, async `login`/`loginWithGoogle`/`logout`, a real OAuth intended-URL bug fixed). Two
MAJOR-severity gaps were disclosed and independently checker-confirmed, both awaiting a follow-up
task decision — see `## T073b2` in `verification-log.md` for full detail:
- **Gap A**: `AcceptInvitePage`'s "Set a password" now genuinely fails (previously silently
  fake-succeeded) — needs a real invite-completion Supabase function that doesn't exist yet.
- **Gap B**: `RequireRole` denial reuses `NoAccessPage`'s unconditional-sign-out AUTH-04 treatment,
  which is likely the wrong screen/copy for a routine role-mismatch (signs out a perfectly valid
  session, shows "you're not on the roster" to a user who very much is).

- **E1–E9 all fully Passed for every automatable task.** Every content page, dialog, and Edge
  Function in the entire app is built and independently checker-verified.
- **E10 (Migration)** — T061, T062 Passed. T063/T064/T065 remain Blocked, gated on human-supplied
  old-project credentials and sign-offs (George).
- **E11 (Launch sweeps) — T067/T068/T069 Passed, T066 held.** All three completed audits surfaced
  real, evidenced findings routed as follow-up candidates (see `verification-log.md`
  `## T067`/`## T068`/`## T069`):
  - T068's BLOCKER-severity NFR-06 finding on `LiveConsole.tsx` (no QR show/hide toggle, missing
    `maxWidth` safety net) was fixed and Passed as **T072**.
  - T067 (MINOR, not yet actioned): widespread `EmptyState` heading-level skips (~19 locations
    across 13 files) and a DES-04 event-type color-mapping inconsistency on `CoachHome.tsx`.
  - T069 (MINOR, not yet actioned): `Skeleton` never used (universal `Spinner` substitution),
    error-Banner retry actions missing almost everywhere, all 5 DES-15 verbatim copy examples ship
    as paraphrases.
  - **T066 still held**, per George's instruction, pending the router-wiring series below — its own
    packet flagged that a literal "click through the real running app" Playwright suite couldn't be
    honestly built while every route was still a placeholder. That's no longer true (see below).
- **Router-wiring series (E3), dispatched mid-session after a boss-architect consultation —
  route-swap phase now complete**: `src/app/router.tsx` had only `/login` wired to a real component
  since T016a; every other route rendered a placeholder `<div>`. Four tasks so far:
  - **T073a** (Passed): fixed `guards.tsx`'s stale `Role` type (was missing `'student'`/`'parent'`)
    — a hard blocker for anything role-aware.
  - **T074** (Passed): wired 11 of 12 remaining routes to their real components in one batched task;
    included a real bug fix (`/settings`'s incorrect `RequireRole(['admin'])` removed — PRD says
    `all` roles). Surfaced a new finding: `AppShell.tsx`'s chromeless-bypass list omits
    `/kiosk/:sessionId`, so it renders with normal chrome despite PRD 7.1 specifying `fullscreen` —
    **no follow-up task created yet, needs a decision.**
  - **T075** (Passed): built the last route, `/` — a small role dispatcher (`DashboardPage`) sending
    coach/admin→`CoachHome`, student→`StudentHome`, parent→`ParentHome`, with a genuinely
    TypeScript-exhaustive switch.
  - **T072** (Passed, dispatched between T073a/T074): the T068 QR-toggle BLOCKER fix, see above.
  - **All 13 routes in the app now resolve to real components.** Only **T073b** (real Supabase
    `AuthProvider` wiring — the `login()` contract itself must change signature, not just
    internals; not yet created) remains in the series. It is independent of the route-swap work and
    does not block T066.
- **Once T066 and T073b land, essentially everything left is a human gate**: T052 (production email
  — only needs George's Resend domain verification + final sign-off now), T063/T065 (migration
  gates), T070 (final go-live).
- **This session's five legitimate FAIL→rework→PASS cycles**: T033 (secret-name leak), T054
  (Divider-instead-of-Heading), T040 (`setTimeout` int32 overflow), T045 (non-unique link text).
  T072/T073a/T074/T075 all Passed on the first attempt. Every FAIL→rework was fixed with a narrow
  attempt-2 rework and re-verified by a narrow re-check that independently reproduced the worker's
  own regression proof.


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
- **E11 (Launch sweeps) — T067, T068, T069 all Passed.** T066 remains
  Ready but held per George's instruction. T068's BLOCKER finding was fixed
  as T072 (Passed).
- **Router-wiring series (E3) — route-swap phase complete.** T073a, T074,
  T075 all Passed; all 13 app routes now resolve to real components. Only
  T073b (real Supabase `AuthProvider` wiring) remains.

T066's worker packet is pre-built (`docs/swarm/active/T066-worker-packet.md`)
— its original blocking tension (no real routes existed) is now resolved,
worth a fresh look before dispatch. Two follow-up decisions still open,
neither yet turned into a task: `AppShell.tsx`'s chromeless-bypass gap on
`/kiosk/:sessionId` (found by T074), and whether/when to action T067/T069's
MINOR findings.

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
