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
- T032 — `checkin` Edge Function (HMAC rotating token). PASS (1st attempt, two MINOR follow-ups: MTG-04 manual-override schema gap, in-memory-only rate limiter — both genuinely undoable within frozen-schema scope). `ON CONFLICT DO NOTHING` design judged PASS-AS-DESIGNED, stricter than the packet's illustrative SQL. T034, T035 unblocked (Blocked→Ready).
- **T019 — DB trigger: invite acceptance → profile/link (critical-path task).** PASS (1st attempt, MINOR: live-GoTrue re-verification follow-up once a real Supabase project exists). Resolved a genuinely tricky "first successful sign-in" signal design (OR of `email_confirmed_at`/`last_sign_in_at` transitions, since T017's `inviteUserByEmail` runs at invite-send time not acceptance time) — checker independently re-ran 6 scenarios + 3 adversarial probes on its own scratch Postgres, rendered an explicit weighed verdict, and concluded no boss-arbiter escalation was needed. **T021, T030, T038 unblocked (Blocked→Ready) — the first real content-page tasks in the entire ledger** (Roster, Meetings, Outreach).

- T018 — `/accept-invite` screen. PASS (1st attempt, MINOR copy-nit finding, non-blocking). Two dispute-candidate gaps re-confirmed (router.tsx wiring; invite-data-loading seam, `invites` RLS is staff-only + no `name` column) and routed to the orchestrating session, same class as T016's identical gaps — not blocking. **One incidental cross-cutting MAJOR finding routed to boss-arbiter as D005**: dark-mode `Button variant="primary"` text contrast measures ~4.04:1 (below WCAG AA 4.5:1), a `volt.ts`/Button-level defect inherited unchanged by the already-Passed T016 `/login` page too — not T018's own defect, potentially reopens T002/T016's contrast sign-off. **T020 unblocked (Blocked→Ready) — closes out E3.**
- **T002b — D005 corrective task: dark-mode `--color-on-accent` contrast fix.** PASS (1st attempt, clean). Boss-arbiter-authorized one-line `volt.ts` token addition + `theme.css` regeneration, independently pixel-re-measured live on `/login` (4.818:1 dark / 7.078:1 light, both clear WCAG AA). D005 fully closed end-to-end.

**E1 and E2 are fully complete. E3 is now fully Passed pending T020 (dispatch-ready).** Full evidence
for every row above is in `verification-log.md` under its `## T0xx` heading.

## Active

Nothing currently dispatched. **T002b Passed 2026-07-19 (1st attempt, clean)** — D005 fully closed
out end-to-end, live WCAG AA shortfall on `/login` genuinely fixed and independently re-measured by
the checker (4.818:1 dark / 7.078:1 light). Nine Ready/undispatched tasks: T020, T021, T030, T034,
T035, T038, T048, T056, T062 (see `overview.md` for the current count and recommended next action).

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
- **D005** (resolved 2026-07-19): T018's checker's ~4.04:1 dark-mode
  primary-button contrast measurement independently confirmed (4.041:1
  recomputed; AA needs 4.5:1 at 14px/500). Root cause is a PRD-internal
  conflict, not a worker/checker error: DES-03's raw dark-accent token
  override (`#9B7BFF`) silently invalidates Astryx's *baked* dark
  `--color-on-accent` (`#0000B3` = P[20], computed against the derived
  P[80] `#D6BAFF`, never re-derived for raw overrides — verified in
  installed `expandColorScale.ts`). DES-06 (WCAG AA both modes) wins per
  the accessibility Non-Negotiable. Authorized fix: ONE added line in
  `volt.ts`'s tokens map — `'--color-on-accent': ['#FFFFFF', '#00008D']`
  (Astryx's own P[10] ramp stop, 4.818:1) — plus lockstep `theme.css`
  regeneration, via corrective task **T002b**. Brand accent hexes and the
  PRD file byte-untouched; volt.ts's standing verbatim check is now
  "byte-identical to DES-03 *except the D005-authorized on-accent line*."
  T002/T016 verdicts NOT reopened (forward-only per D002/D003 precedent;
  T016's "button-text pairs all pass" evidence sub-claim formally
  corrected). `astryx-api.md` given a second D004-style marked annotation
  (Button Theming section) so checkers don't flag the token as
  hallucinated. **Standing rule for all future checker packets: contrast
  checks must include foreground-ON-accent pairings in both modes, not
  only accent-on-surface — pixel-level measurement preferred when it
  disagrees with token arithmetic.** George informed with veto
  opportunity before T002b dispatches (no human-locked decision reversed,
  so no hard human gate).
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
  same shape as T016a — not automatically covered. T018's checker confirmed
  by direct read that `/accept-invite` is *not* the last such placeholder in
  `router.tsx` — every page task not yet built (Dashboard, Meetings, Kiosk,
  Check-in, Outreach, Calendar, Roster, Reports, Settings) still has an
  inline placeholder there too. Consider a standing convention ("wire the
  route once its page task Passes") rather than one-off wiring tasks per
  page, to avoid an ever-growing backlog of T0xxa-style corrective tasks.
- **No mechanism exists to supply real invite data to `/accept-invite`**:
  `invites` RLS is `staff_all`-only and the table has no `name` column, so
  AUTH-03 (the app's only sign-up path) cannot work end-to-end without a new
  read-only, token-keyed data channel (e.g. an Edge Function). T018's checker
  recommended scheduling this as its own ledger task rather than an
  indefinitely-deferred gap, given AUTH-03 is core-path. Not yet scheduled.
- **D005 — fully closed 2026-07-19.** T002b Passed (1st attempt, clean):
  `volt.ts`/`theme.css` fix shipped and independently pixel-re-measured by
  the checker (4.818:1 dark / 7.078:1 light, both clear AA). No residual
  risk remains — any task checked from this point on measures against the
  corrected token. Full ruling + close-out evidence in `dispute-log.md`
  D005 and `verification-log.md` T002b entry.
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
