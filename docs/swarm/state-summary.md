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
- **T020 — AUTH-04 no-access screen + NFR-02 RLS-denial test.** PASS (1st attempt, clean). Two independent deliverables both verified: the page (schema has no team-contact column anywhere — a genuine schema gap, disclosed via a data seam) and a from-scratch-Postgres RLS test suite the checker independently reran and stress-tested with its own negative control (injected a fake profile for the orphan session, confirmed the suite correctly flips to FAIL, then reverts). **E3 is now fully Passed — the entire auth/invites epic is done.**
- **T021 — `/roster` shell + TabList (first real content-page task in the ledger).** PASS (1st attempt, two MINOR follow-ups). Established a novel, checker-validated pattern: nesting `guards.tsx`'s `RequireRole` inside a page component (since `router.tsx` is forbidden) produces byte-identical guard behavior to route-level usage. Surfaced a pre-existing, not-T021-caused latent risk in `guards.tsx`'s `RequireRole` (render-phase `pushToast`, StrictMode double-toast). **T022, T025, T026, T027, T028, T029 unblocked (Blocked→Ready) — the rest of E4's first wave.**

- **T055 — Parent Home.** PASS (1st attempt, MINOR). Checker independently re-read PRD BEH-06's actual text and concurred reusing T037's already-streak-audited `ConsistencyStrip` was the defensible, lower-risk choice. Multi-linked-student independence reproduced via staggered loading/error tests.
- **T054 — Student Home.** PASS (attempt 2). Attempt 1 FAIL was a legitimate MAJOR (Divider labels instead of real `Heading` landmarks, breaking screen-reader navigation) after the StudentHomeSlot scope-tension resolution and BEH-03's combined-state CTA invariant were both independently confirmed correct. Attempt 2's fix matched `CoachHome.tsx`'s established pattern exactly, re-verified with zero regressions.
- **T033 — Live console `/meetings/live/:sessionId`.** PASS (attempt 2). Attempt 1 was a legitimate FAIL (MAJOR, real constitution item 5 secret-name leak in a comment) after checker independently confirmed the BLOCKER-class DES-17 keyboard path, MTG-11 coach-override precedence, and MTG-12 excused-gating all genuinely correct at the DOM/library-source level. Attempt 2's narrow one-comment fix re-verified with zero regressions. **T036 unblocked.**
- **T053 — Coach/Admin Home.** PASS (1st attempt, MINOR: zero-roster test-coverage gap on the attendance-rate KPI, plus a NIT traced to the vendor Astryx template itself, not this task). Checker rendered a separate constitution-item-3 verdict per KPI card since 2 of 4 didn't map onto a single T013 view — all four ruled compliant (team participation % is a pure view passthrough; hours-vs-goal sums already-computed per-student values with the underlying formula never reproduced in TS; the single-meeting attendance rate is a legitimately new, disclosed metric, not a re-derivation; events-in-7-days isn't metric-view-adjacent at all).
- **T031 — Schedule meetings dialog.** PASS (1st attempt, NIT only). Checker independently re-confirmed T010's applied migration was genuinely untouched (no BLOCKER item-10 violation) and independently re-derived the session-generation boundary math from scratch (not trusting the worker's claimed counts) — confirmed exactly correct. **T033 (live check-in console) unblocked** — its other dependency, T032, was already Passed.
- **T022 — Students tab table + row actions.** PASS (1st attempt, NIT only). Checker independently re-derived the "Invite (if email)" judgment call against the real schema and ruled it correct; independently verified the parent-invite-decoy handling and ROS-09 reversibility by direct source read; confirmed a worker-flagged MoreMenu/jsdom quirk is a real test-environment limitation, not an accessibility defect. **T023, T024 unblocked.**
- **T037 — Student/parent meeting view + consistency strip.** PASS (1st attempt, NIT only — clean). Checker independently re-verified the worker's scope call (a standalone consistency-strip widget, not a duplicate of T030's already-built history view) by reading `MeetingsList.tsx` directly and confirming its placeholder unambiguously deferred this exact scope. BLOCKER-class BEH-06 check cleared with independent re-derivation. **T055 unblocked.** Full-ledger sweep also caught and fixed a missed unblock: **T054**'s four dependencies were all already Passed but the row was never flipped to Ready — corrected.
- **T038 — `/outreach` list + season goal bar.** PASS (1st attempt, MINOR: heading-level skip on empty state, incomplete router-gap disclosure note — both non-blocking). Checker independently confirmed `SideNav.tsx` byte-unchanged and ruled the worker's handling of the badge-wiring scope tension (export a reusable `getUnansweredRsvpCount`, flag as dispute candidate, don't edit the forbidden file) correct and faithful to the packet's pre-authorized instruction. Found and correctly worked-around a genuine Astryx `Toast` prop-table doc bug. **T039, T044, T045, T053 unblocked (Blocked→Ready).**
- **T062 — ETL script `scripts/migrate.ts` (MIG-03).** PASS (1st attempt, clean — no findings). Checker independently reproduced the 33-assertion idempotency/dry-run-safety harness itself, re-confirmed `hours_override=old.hours` is genuinely unconditional, confirmed the attendees-backfill assertion gate really blocks writes on a real run, and re-verified UUIDv5 determinism directly. T063 (MIG-04 human gate) remains externally blocked on George's real old-project credentials — unaffected by this PASS.
- **T030 — `/meetings` list.** PASS (1st attempt, MINOR: 3 small non-blocking follow-ups — ProgressBar rounding-vs-label mismatch, one heading-level skip, stale JSDoc). Checker independently re-derived NAV-07 cleanliness structurally (traced the code path, not just one test string) and re-verified participation-% sourcing against the real `v_student_participation` SQL (zero arithmetic in executable code). Cancel/AlertDialog flow confirmed genuinely real (real `showModal()`, real state update). **T031, T037 unblocked (Blocked→Ready).**
- **T071 — Shared Supabase client + auth/session surface + typed loader seam.** PASS (1st attempt, clean — no findings). Closes the cross-cutting gap flagged independently by T018/T020/T021/T034/T035/T056. Checker re-derived every safety-relevant claim rather than trusting the worker: lazy-init unconfigured-mode safety genuinely holds (module import never throws), `resolveRole`'s found/no-profile/genuine-error three-way split confirmed never conflated, `loader.ts` has zero fake-data fallback (2 throw sites, 1 success path), all 8 row types in `types.ts` re-verified column-by-column against the real migration SQL, secret hygiene re-checked against a freshly-built `dist/` (module fully tree-shaken, contributes zero bytes since unused so far). Purely additive — does not touch `guards.tsx` or any page; sets up (doesn't yet dispatch) a future T016a-pattern wiring series.
- **T035 — `/checkin` result screen + Check-in Bolt.** PASS (1st attempt, MINOR: running-tally data-source gap opens a tracked follow-up — DES-01 calls for a tally, the real `checkin` payload has no such field and RLS blocks a client-side count; worker's honest omission-with-disclosure was pre-authorized by its own packet's Acceptance Criteria, checker independently confirmed the disclosure marker is tree-shaken from production). DES-02 "only orchestrated animation," `prefers-reduced-motion` gating, and DES-16 error-copy style all independently re-verified.
- **T034 — Kiosk view `/kiosk/:sessionId`.** PASS (1st attempt, MINOR: two correctly-deferred infra gaps — no token-minting Edge Function, no shared Supabase client — plus one NIT duplicated caption). Checker independently re-derived the HMAC/QR scheme against `hmac.ts`, confirmed real `qrcode.react` QR rendering via jsdom render (not a static/fake SVG), confirmed `aria-live="polite"` and zero PII, and ruled the `package.json` `qrcode.react` addition in-scope (allowlisted, mechanically required).
- **T048 — Resend integration + branded layout + `email_log`.** PASS (1st attempt, NIT only). Checker independently re-derived (not trusted) that the constitution item 7 test-mode gate is genuinely airtight — `fetch()` to `api.resend.com` is structurally unreachable in any non-`'production'` `RESEND_SEND_MODE`. `index.ts` diff vs. T017's Passed version confirmed to be exactly two additive hunks. Cross-runtime import into `src/emails/layout/**` ruled a correctly-flagged residual risk, deferred to T052's human gate. **T049, T050 unblocked (Blocked→Ready).**
- **T056 — `/reports` shell + Participation tab.** PASS (1st attempt, NIT only). Checker independently re-derived constitution item 3 compliance against `v_student_participation`'s real SQL (zero formula re-derivation in executable code) and re-verified the RLS-on-views security claim against the real migration files (plain view, base-table `staff_all`/`is_staff()` policies — correct, no view-level gap needed). Below-70% strict-`<` boundary independently re-tested with a checker-authored fixture. Two flagged gaps (RPT-06 router-level gate, shared Supabase client) correctly deferred, same recurring pattern as T018/T020/T021/T034.
- **T023 — Add/edit student dialog.** PASS (1st attempt, NIT only). Applied `StudentsTab.tsx`'s established "email (optional)" resolution consistently and correctly handled an edit-mode wrinkle (email field disables when the student already has a linked profile account).
- **T024 — Invite parent dialog.** PASS (1st attempt, NIT only). Grounded its multi-student-invite data shape in a real, checker-reconfirmed citation of T019's own migration trigger comment (not an invented shape); disclosed that `guardian_links.relationship` is hardcoded `'guardian'` by that same trigger with no real persistence path yet. **T023, T024 unblock nothing further directly.**
- **T028 — Roster admin toggles.** PASS (1st attempt, NIT only). Confirmed a real schema gap (no leaderboard-privacy persistence column anywhere), flagged as a best-guess follow-up. Deliberately bypassed `guards.tsx`'s `RequireRole` in favor of `useAuth()` directly for a sub-widget-level gate — checker independently confirmed via `RosterShell.tsx` this was correct (a nested `RequireRole` would have wrongly redirected coaches off the whole `/roster` page).
- **T025 — Parents tab.** PASS (1st attempt, MINOR). Confirmed real schema gap (`profiles` has no active/inactive column); split "Remove" into a real `guardian_links`-deletion effect (profile-backed parents) plus an honestly-disclosed local-only "deactivate" UI marker, and a real `invites.status='revoked'` effect (invite-only parents). Checker independently reproduced the schema gap, confirmed no overclaiming, and flagged a genuine (currently non-exploitable) self-gating inconsistency across sibling roster tabs.
- **T026 — Teams tab (CRUD + archive).** PASS (1st attempt, NIT only). Reversible Archive vs. gated, irreversible Hard Delete behind a single shared `canHardDelete` predicate (checker confirmed no divergent second implementation exists anywhere). Confirmed via grep no Astryx `ColorPicker` exists; built the color chip from real `Token`+`Selector.renderOption` instead — checker independently reproduced the grep and the source-level claims.
- **T027 — Invites tab.** PASS (1st attempt, MINOR). Cited and did not duplicate the already-applied `trg_audit_invite_revocation` DB trigger (checker opened the migration directly and confirmed it fires exactly as claimed, zero client-side `audit_log` writes). Added a disclosed fourth "Revoked" display status beyond ROS-07's literal three-status wording — checker independently traced the three-status text to AUTH-06 (predates the Revoke action) and ruled the addition correct, not overreach.
- **T044 — Leaderboard.** PASS (1st attempt, NIT only). BLOCKER-class SEC-04/ROS-08 name-format enforcement proven via both `textContent` and `innerHTML` checks. Correctly reversed its own initial toggle-OFF guess after discovering real evidence in T028's already-Passed `AdminToggles.tsx` Switch description — checker independently confirmed the citation and the reversal was correct (OFF means fully anonymized, not full names).

**E1, E2, and E3 are all fully complete.** Full evidence for every row above is in
`verification-log.md` under its `## T0xx` heading.

## Active (2026-07-19, updated after T025/T026/T027 close-out)

49 tasks Passed. T029 (Season management) and T039 (Outreach event dialog) are In Progress — both
workers done (shared commit `569a5d9`), checker packets being built/dispatched now. Once T039
Passes, T040/T043 unblock (then T041, then T042) — the last blocked chain in E6. 18 tasks remain
Blocked, mostly gated on that T039 chain, E7/E8 infra, E9's remaining content pages, the E10 human
migration gates, and E11's final sweeps. See `overview.md` for the current tiered priority list.

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
- **T071 created (2026-07-19, boss-architect)** — shared Supabase client
  scheduled as a deliberate task instead of remaining tracked debt. Trigger:
  six independent worker tasks (T018, T020, T021, T034, T035, T056) each hit
  the identical wall — zero `createClient`/`supabase-js` usages anywhere in
  `src/` — and each independently converged on the same seam shape rather
  than fabricating a backend: a typed async loader `(args) => Promise<Data |
  null>` injected as an optional prop with an obviously-fake fixture/null
  default (`LoadInviteFn`, `LoadNoAccessDataFn`, `KioskDisplayTokenLoader`/
  `KioskTallyLoader`, `LoadParticipationDataFn`). That six-way convergence is
  treated as the design signal for the real client's API surface: T071 ships
  a `src/lib/supabase/**` singleton (T015's exact `VITE_SUPABASE_URL`/
  `VITE_SUPABASE_ANON_KEY` names), an auth/session surface shaped to slot
  into `guards.tsx`'s existing `AuthContextValue` contract without touching
  `guards.tsx`, and a `createLoader`-style typed query helper matching the
  convergent seam signature. Deliberately **purely additive** (new files +
  `@supabase/supabase-js` in package.json only): `guards.tsx` is load-bearing
  for many Passed tasks, carries the known stale `Role`-union mismatch and
  the render-time `pushToast` bug, and D003 history shows first-mount wiring
  changes break adjacent tests — so integration is split into T016a-pattern
  follow-up wiring tasks with their own checkers. Not blocked on George's
  missing Supabase project: fail-loud `SupabaseNotConfiguredError` +
  `isSupabaseConfigured()` posture (same staged-not-blocked stance as
  T015/T061), never fabricated credentials, never fixture data in the data
  layer. Homed in E3 (operationalizes T015; PRD Section 13 has no infra
  epic, and inventing an E12 would fork the PRD's epic vocabulary). Checker:
  checker-tests (deterministic infra — unit tests, secret-hygiene greps of
  src + dist, bundle-size gate, migration cross-check of hand-authored row
  types).

## Current Risks

- **Concurrent-checker scratch-file collision (2026-07-19, T020/T021 — resolved, no harm done).**
  T020's checker-tests found T021's checker-accessibility's still-in-use scratch files on disk,
  assumed they were stale leftovers, and deleted them mid-run. T021's checker noticed the
  interference (logged it explicitly in its own report), recreated its harness, and completed a
  full independent verification anyway — final PASS, clean `git status`, no gap in its evidence.
  No corrective action needed this time, but the **standing rule stands** for future parallel
  dispatches sharing a worktree: scratch/harness filenames should be prefixed with the task ID
  (e.g. `T021-checker-harness-*`, not a generic `checker-harness-*`) so a concurrently-running agent
  can't mistake another task's in-progress files for its own stale leftovers.
- **No real Supabase auth client anywhere in `src/`**: `guards.tsx`'s
  `login()`/`loginWithGoogle()` are still T005's in-memory placeholder — no
  real `signInWithPassword`/`signInWithOAuth`, no real role lookup. This is
  core-requirement debt (AUTH-01) accumulating across multiple Passed tasks.
  **Update 2026-07-19: now scheduled — T071 (Ready) builds the shared client
  module; the `guards.tsx` swap itself remains a follow-up wiring task after
  T071 Passes (see Known Decisions).**
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
- **`guards.tsx`'s `RequireRole` fires `pushToast` during render, not in an effect** (T005-era,
  surfaced by T021's checker): produces a real React 19 console error ("Cannot update a component
  while rendering a different component") and a StrictMode double-toast; also never checks
  `isLoading` before evaluating role, a latent bug once a real async session check lands. Not
  caused by, or fixable within, T021's scope (`guards.tsx` forbidden). Reconcile whenever
  `guards.tsx` is next in scope for editing.
- **T021 MINOR follow-ups (not yet scheduled as their own tasks)**: (1) the four `EmptyState`s in
  `RosterShell.tsx` default to `headingLevel=3`, skipping h2 in the outline — one-line fix; (2)
  their copy names internal task IDs ("T021, ROS-01") which must be reworded before any real user
  reaches `/roster` (not yet possible given the router-wiring gap).
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
