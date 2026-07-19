# Task Ledger — VOLT Team Portal Rewrite

Source plan: `docs/swarm/VOLT_Portal_PRD.md` v1.6 (authoritative, requirement IDs outrank this ledger), `docs/swarm/constitution.md`, PRD Section 13 epics E1–E11.

## Legend / ledger-wide rules

- **Forbidden files (every task, no exceptions):** `docs/swarm/**`, `.claude/**`, and any file outside the task's own **Allowed files**. Workers are never given write access to these paths. This is stated once here instead of on all 70 rows.
- **Worker agent:** always `worker-implementer` (only worker defined) — omitted from per-task detail, shown once here.
- **Status key:** Not Started · Ready · In Progress · In Check · Needs Rework · Passed · Escalated · Blocked · Done.
- **Init state:** tasks with no dependencies start `Not Started`; tasks with dependencies start `Blocked`.
- **Human-gate tasks** (constitution item 16): checker = `human (George)`. No worker/checker loop — boss-architect records George's sign-off directly on the ledger row (date + method). Attempts/escalation columns are N/A ("—") for these rows.
- **Range dependency shorthand:** `T0xx–T0yy` in a Dependencies cell means "all tasks in that ID range must be Passed," used only for E11 tasks that legitimately fan in across most of the app.
- **External prerequisites (NOT ledger tasks):** Supabase project creation, Google OAuth client credentials, Resend sending-domain DNS verification, and the Vercel CNAME record are actions only George can take outside the swarm. They block specific tasks below (flagged inline) and are tracked as risks in `docs/swarm/state-summary.md`, not as task rows — the swarm cannot create them.
- **Constitution item 17 / BEH-06:** any task touching progress bars, milestones, or meeting history carries an explicit no-streak / no-loss-aversion acceptance bullet — flagged per task below rather than as a separate epic.
- **Astryx props:** every UI task's acceptance includes "props verified against `docs/swarm/astryx-api.md` (DES-19); CLI `npm run astryx -- component <Name>` is a cross-check only."

Epic dependency order (PRD Section 13): **E1 → E2 → E3 → (E4, E5, E6 parallel) → (E7, E8, E9 parallel) → E10 → E11.**

---

## Summary table

| ID | Epic | Title | Worker | Checker | Deps | Attempts | Status | Last Result | Escalated |
|---|---|---|---|---|---|---:|---|---|---|
| T001 | E1 | Vite + TS(strict) + ESLint/Prettier scaffold | worker-implementer | checker-tests | none | 0 | Passed | PASS (2nd check, on merits): build/typecheck/lint/format:check all exit 0, dev server boots clean, tsconfig strict:true confirmed, zero Tailwind/shadcn confirmed via grep on package.json + package-lock.json, index.html + package-lock.json verified per D001-approved scope exceptions (not re-litigated), file tree = Allowed Files + approved exceptions only. No findings. | No |
| T002 | E1 | Astryx install + `volt.ts` theme (DES-03 exact spec) | worker-implementer | checker-accessibility | T001 | 1 | Passed | PASS (2nd check, on merits): Astryx installed, `volt.ts` byte-for-byte verbatim vs DES-03, `astryx-augment.d.ts` correctly scoped to fix the upstream `TypographyRole`/`url` type gap only (empirically verified via negative-control test — checker removed `export{}`, reproduced a real TS2305 break on `defineTheme` resolution project-wide, restored it, reconfirmed clean), `npx tsc --noEmit` and `npm run build` both exit 0, WCAG AA contrast passes both modes, no forbidden-file violations, astryx script/CLI cross-check confirmed. NIT: upstream `@astryxdesign/core@0.1.6` type gap logged as a follow-up note, not a new task. | No |
| T002a | E1 | React 18→19 upgrade (D002 corrective task) | worker-implementer | checker-tests | T002 | 1 | Passed | PASS (2nd check, on merits): react/react-dom at 19.2.7, `npm ls` clean (no ELSPROBLEMS), `react.use()` confirmed a function, build/typecheck/lint/vitest all exit 0, mandatory runtime smoke test genuinely renders Theme+App and passes. `format:check` now exits 0 via a `package.json` glob negation scoped to `src/theme/volt.ts` only (independently verified not over-broad via checker's own injected-violation test on a different file). `astryx-augment.d.ts` unchanged, `volt.ts` still byte-identical to DES-03, no forbidden-file violations. Attempt 1's FAIL was legitimate but narrow (pre-existing Prettier drift traced to T002, not a T002a worker fault). | No |
| T003 | E1 | CSS cascade layers + `theme.css` build pattern | worker-implementer | checker-tests | T002,T002a | 0 | Passed | PASS (1st attempt, clean, no findings): build/typecheck/lint/format:check all exit 0; `theme.css` declares `@layer reset, astryx-base, app;` first, matching NFR-08 exactly; every rule confirmed inside one of the three layer blocks (no unlayered global CSS); Astryx's own `reset.css`/`astryx.css` confirmed pre-wrapped in their own layers by the package (not something the worker needed to wrap); `volt.ts` re-confirmed byte-identical to DES-03 (untouched); `main.tsx` diff confirmed exactly two lines (vite/client reference + theme.css import); `dist/assets/theme.css` confirmed a real static file linked via `<link>` in `dist/index.html` (DES-07, no runtime injection); no forbidden-file violations. | No |
| T004 | E1 | CI pipeline (typecheck/lint/unit/build + bundle budget) | worker-implementer | checker-tests | T001,T002,T003 | 0 | Passed | PASS (1st attempt, clean, no defect findings): `.github/workflows/ci.yml` structurally verified (push/pull_request triggers, Node 20.18.1 pinned via `actions/setup-node`, `npm ci`, five real-fail steps — typecheck/lint/test/build/bundle-size — no `continue-on-error`/`\|\| true` anywhere); `package.json` confirmed zero diff; checker independently re-ran typecheck/lint/test/build commands extracted verbatim from the YAML, all exit 0; checker ran its own full bundle-size inflate/revert cycle (not trusting worker's numbers) — clean build passes at 60236 bytes gzip vs 307200 byte budget, checker's own inflated build correctly fails at 334497 bytes (a different number from the worker's 414185 due to a different injection method, both independently proving the gate works), fully reverted and reconfirmed pass; NFR-04 scoping (eager entry chunks only via `dist/index.html`, not total `dist/`) confirmed correct and forward-compatible with future route-level splitting; YAML validated via PyYAML; deliverable location (`.github/workflows/`) confirmed correct. MINOR (non-defect, calibration note only): checker flagged new `docs/swarm/active/*.md` files and a hook-appended `verification-log.md` line as a "technical violation" of the zero-net-diff-outside-allowed-files criterion — this is expected background swarm-process artifact present on every task (every checker packet is itself a new `docs/swarm/active/*.md` file; the SubagentStop hook appends a verification-log.md line on every worker completion regardless of task) and does not affect deliverable quality; logged as a checker-packet-writing calibration point for future packets, not a task defect. | No |
| T005 | E1 | Router skeleton + route guards + deep-link redirect | worker-implementer | checker-reviewer | T001 | 1 | Passed | PASS (2nd check, targeted re-check of attempt 2's fix, on merits): `/kiosk/:sessionId` now genuinely wrapped in RequireAuth + RequireRole(['coach','admin']) in the real JSX tree (verified by reading the file directly, not by trusting worker claims); Role union correctly extended with 'coach'; RequireRole's K3 toast-during-render pattern deliberately left untouched and confirmed byte-identical (deferred to T006); checker's own independent 5-test suite against the real AppRoutes tree confirmed all 3 kiosk-access cases (unauthenticated→stores intended URL and redirects to /login; wrong-role staff/volunteer→redirects to / with exact toast; correct-role coach/admin→renders through); all 13 PRD Section 7 routes still present; main.tsx/App.tsx still correctly unwired (deferred to T006); build/typecheck/lint clean (0 errors, same 8 pre-existing non-blocking fast-refresh warnings); no forbidden-file violations; no leftover scratch files. Attempt 1's FAIL (BLOCKER-class, kiosk route left public against PRD Section 7/SEC-04) was legitimate and is now fully resolved. | No |
| T006 | E1 | AppShell + TopNav | worker-implementer | checker-accessibility | T002,T005 | 1 | Passed | PASS (attempt 1 FAIL was a structural CI-gate issue, not a defect in this task's own deliverable — resolved via corrective task T006a per D003, and T006a's PASS serves as T006's required re-verification per D003 Ruling F, no separate checker-accessibility re-run needed): AppShell.tsx/TopNav.tsx/App.tsx independently verified clean on every axis by checker-accessibility on attempt 1 — NAV-01/02 compliance, Astryx prop cross-check against astryx-api.md (zero hallucinated props, TopNavHeading's lack of an `as`/`LinkComponentType` prop independently confirmed per constitution item 2), DES-17 keyboard/focus operability (verified via a real scratch-test KeyboardEvent-dispatch harness, not just screenshots), season Selector correctly gated to admin/coach roles, `user===null` no-crash confirmed both as a direct mount and full end-to-end redirect, forbidden-file boundary (router.tsx/guards.tsx untouched, confirmed via mtime + content re-read), build/typecheck/lint/format:check all clean. See `docs/swarm/verification-log.md` T006 entry and `docs/swarm/archive/T006-worker-packet.md` / `docs/swarm/archive/T006-checker-packet.md` for full packets. | No |
| T006a | E1 | Fix CI test regression from T006 wiring (D003 corrective task) | worker-implementer | checker-tests | T006 | 0 | Passed | PASS (1st attempt, clean, no findings): implements boss-arbiter's D003 ruling verbatim. `theme.smoke.test.tsx` now renders `<App/>` directly instead of double-wrapping in `<Theme>` (App owns Theme per NAV-01), stale `'VOLT Team Portal'` h1 assertion replaced with a non-empty-render check (`.not.toThrow()` kept as the core assertion) — checker independently confirmed no `'Login (placeholder)'` copy was asserted either, avoiding the same staleness trap for whenever T016 changes that copy. New `src/test-setup.ts` provides a guarded `matchMedia` polyfill (checker independently tested the guard logic: installs only when `window.matchMedia` is undefined, never clobbers a real one), wired via `vite.config.ts`'s `test.setupFiles`; T003's `build.rollupOptions` block confirmed byte-unchanged via git-history checksum comparison (before/after both `e22252de279f3624ad4e17cae517fe46`). Checker independently re-ran `npm run test`/`typecheck`/`lint`/`build`/`format:check` (all exit 0) and manually re-executed the exact bundle-size-gate shell logic from `.github/workflows/ci.yml` against a fresh build (128,239 bytes gzip vs. 307,200 byte budget — PASS). D001-method forbidden-file check clean: only the three D003-authorized files changed. Checker's explicit conclusion: this re-verifies T006's own CI gate too — both tasks Passed together per D003 Ruling F. See `docs/swarm/verification-log.md` T006a entry and `docs/swarm/archive/T006a-worker-packet.md` for the full worker packet (checker-tests was dispatched directly with instructions, without a separate foreman-authored checker packet file for this small corrective task). | No |
| T007 | E1 | SideNav (role-filtered) + outreach badge scaffold | worker-implementer | checker-accessibility | T006 | 2 | Passed | PASS (attempt 2, on merits; attempt 1 FAIL was a legitimate BLOCKER, not a false alarm): attempt 1 found every axis correct (NAV-03/04/07/BEH-04, Astryx prop sourcing including CLI cross-checks, keyboard/focus, D001 wiring boundary) except a real hard-navigation/session-loss defect — `SideNavItem`'s plain `<a href>` caused a full page reload + session loss on every click/Enter. Checker itself found and empirically proved the fix (`SideNavItem`'s CLI-confirmed `as: LinkComponentType` wired to React Router's `Link`) before reverting it and failing the task. Attempt 2: worker applied exactly that fix, scoped entirely to `SideNav.tsx`. Checker independently re-verified via its own live Playwright harness (real dev server + Chromium): zero `load` events on both mouse click and keyboard Enter-activation, session preserved, URL/`document.title`/`aria-current` all update correctly — and ran a negative control (reverted the fix, reproduced the exact original defect, restored it byte-identical) to validate its own test methodology before signing off. NAV-03/04/07/BEH-04 spot-re-checked clean; `AppShell.tsx`/`router.tsx`/`guards.tsx`/`TopNav.tsx` confirmed byte-unchanged since attempt 1; build/typecheck/lint/format:check all clean. NIT logged (not blocking): `TopNav.tsx`'s wordmark link has the same structural `as`/`LinkProvider` gap, pre-existing from T006, flagged for whenever that file is next touched. See `docs/swarm/verification-log.md` T007 entries and `docs/swarm/archive/T007-worker-packet.md` / `docs/swarm/archive/T007-checker-packet.md` for full packets. | No |
| T008 | E1 | MobileNav drawer + Student Home live-card slot | worker-implementer | checker-accessibility | T006,T007 | 1 | Passed | PASS (attempt 1, D004-amended scope; the mid-attempt escalation was a correct worker judgment call, not a FAIL): worker discovered the packet-mandated `mobileNav={<MobileNav />}` ReactNode shorthand actually disables `MobileNavToggle` entirely in the installed `@astryxdesign/core@0.1.6`, contradicting astryx-api.md's own prose, and correctly escalated rather than improvising a fix outside its Allowed Files. **Boss-arbiter D004** independently verified this against the installed library source and authorized `mobileNav={{ content: <MobileNav /> }}` (the `MobileNavConfig` object form) in `AppShell.tsx`, with `TopNav.tsx`'s now-dead-code `MobileNavToggle` edit reverted back to T006's exact Passed state (the config form forces TopNav into a mobile-bar mode that auto-injects its own toggle — no project code needed). `astryx-api.md` corrected with two marked D004 annotations. Checker independently re-derived the entire `mobileNavEnabled`/`MobileNavConfig` gating mechanism from the actual installed source (not trusting D004's or the worker's citations) and confirmed it holds up exactly; byte-diffed `TopNav.tsx` against the real T006-Passed git commit (zero code diff, only a D004-authorized doc-comment addition) and `MobileNav.tsx` against attempt 1 (zero diff outside its doc comment). Live-verified via real Chromium in both light and dark mode: exactly one auto-injected toggle below 768px and zero at/above, exactly one drawer (Astryx's auto-generated drawer confirmed genuinely suppressed), three independent close paths (Escape/backdrop/close-button), visible keyboard focus throughout, `document.title` parity through the now-functional trigger, zero full-page reloads with session survival confirmed via `performance.getEntriesByType('navigation')`. `StudentHomeSlot.tsx` confirmed still isolated/unwired via grep sweep of `router.tsx`. D001-method forbidden-file check clean (exactly the 4 expected files touched across all of T008). Two non-blocking MINOR/NIT findings logged: a stale Astyx line-citation in `StudentHomeSlot.tsx`'s own doc comment, and a vendor-library (not project-code) native-`<dialog>` Tab-cycle quirk that doesn't break the keyboard trap. D004 Ruling C's drawer-doesn't-auto-close-on-navigate MINOR re-confirmed still true, correctly left unfixed (no sanctioned Astryx lever exists today). See `docs/swarm/verification-log.md` T008 entries, `docs/swarm/dispute-log.md` D004, and `docs/swarm/archive/T008-worker-packet.md` / `docs/swarm/archive/T008-checker-packet.md` for full packets. | No |
| T009 | E2 | Migration: identity/roster tables | worker-implementer | checker-tests | T001 | 0 | Passed | PASS (1st attempt, MINOR finding, non-blocking): checker-tests verified all 5 tables (profiles, teams, seasons, students, guardian_links) column-by-column against PRD 8.1 ground truth — zero deltas; id/created_at/FK-restrict conventions correct; `seasons` partial unique index on `(is_active) where true` verified correct via static SQL review; no RLS/policy statements present (correctly out of scope, T012's job); constitution item 10 confirmed (exactly one migration file exists); `role_enum` placement judged reasonable with a forward note that future migrations must reuse, not redefine, the type. MINOR: `profiles.avatar_url text not null` with no default is a genuine PRD 8.1 ambiguity (SET-01 implies avatar upload is a post-creation settings action) that would block INSERT into `profiles` until resolved — not a worker error, tracked as an amended acceptance criterion on T019 (see T019 detail block below), not a new task. | No |
| T010 | E2 | Migration: scheduling/attendance tables | worker-implementer | checker-tests | T009 | 0 | Passed | PASS (1st attempt, MINOR finding, non-blocking): checker-tests verified all 5 tables (invites, events, event_sessions, rsvps, attendance) column-by-column against PRD 8.1 ground truth — zero deltas; FK on-delete scoping correct (event_sessions.event_id cascade per explicit PRD note, all 10 other FKs restrict); role_enum correctly referenced from T009, not redefined; unique(session_id,student_id) on rsvps/attendance confirmed; check constraints on status/type/method columns confirmed; T009's migration file confirmed zero diff (constitution item 10). MINOR: `event_sessions.notes text not null` with no default follows the same "no null-marker = NOT NULL" convention T009 established, but checker found stronger evidence than T009's avatar_url case that this should be optional — PRD's MTG-02 dialog doesn't require notes to enable its create button, and OUT-02's dialog omits notes from the form spec entirely. Not a worker error; tracked as amended acceptance criteria on T031 and T039 (see detail blocks below), not a new task. | No |
| T011 | E2 | Migration: support tables + audit triggers (DATA-02) | worker-implementer | checker-tests | T010 | 0 | Passed | PASS (1st attempt, MINOR finding, non-blocking): all 4 support tables (notification_prefs, calendar_feeds, email_log, audit_log) verified column-by-column against PRD 8.1 ground truth — zero deltas; role_enum reused from T009, not redefined; all 5 DATA-02 triggers independently tested against a real scratch Postgres instance with full positive AND negative controls (attendance edit while scheduled=0 rows / while completed=1 row; profile role no-op=0/real change=1; student reactivation=0 new rows; session status change to non-canceled=0 rows; invite status no-op/non-revoke=0 rows) — all 12 sub-tests passed; T009/T010 confirmed zero diff (constitution item 10); all 5 meta jsonb payloads independently read from trigger source, confirmed IDs/enum values/booleans only, no PII (constitution item 6). MINOR (checker-recommended accept-as-is, no amendment needed): notification_prefs extends "not null default true" to all 6 EML-02 category bools, not just digest_enabled — judged a reasonable, well-documented opt-in-by-default UX interpretation; future EML-02 spec work should make per-column defaults explicit. Also confirmed non-issues: audit_log.actor NOT NULL design (operational note on SET LOCAL app.actor_id for future service-role writes logged centrally in state-summary.md rather than amended onto specific tasks — see Known Decisions); no FK on email_log.session_id/profile_id (correct reading of PRD's null-not-fk marking). | No |
| T012 | E2 | RLS helper functions + policies (verbatim 8.4) | worker-implementer | checker-tests | T009,T010,T011 | 0 | Passed | PASS (1st attempt, clean, no findings): all three PRD 8.4 helper functions (`auth_role`, `is_staff`, `my_student_ids`) confirmed byte-verbatim via SHA-256 checksum match, not just eyeballed diff; all 14 T009/T010/T011 tables confirmed RLS-enabled with at least one real policy each — zero gaps; grep-swept every `create policy` statement and confirmed no self-referential same-table subqueries anywhere (all role/ownership checks route through the three security-definer helpers or safe cross-table subqueries only — e.g. an `events` policy subquerying `students`, never `events` itself). The `profiles.role::text` cast fix (needed because `auth_role()` returns `text` but `profiles.role` is `role_enum`) was independently reproduced as genuinely necessary: uncast form throws `operator does not exist: role_enum = text` on a live scratch Postgres, cast form works, and `auth_role()`'s own body confirmed untouched from ground truth — cast lives only in the policy. Two flagged deviations both adjudicated on the merits, not rubber-stamped: (1) Trap 1 — `students` "teammate visibility for leaderboard" deliberately scoped down to `staff_all` + `own_or_linked_read` only, gap explicitly deferred to T013's views; confirmed intentional and correctly reasoned, not a defect. (2) Trap 2 — `events`/`event_sessions` team-scope policy moved the `team_ids is null` check *inside* the cross-table `exists()` against `students` rather than a standalone top-level `OR`, so an authenticated session with zero linked `students`/`guardian_links` rows (including a bare orphan `auth.users` row with no `profiles` row) sees zero events rather than leaking every globally-scoped ("all teams") event; independently re-tested on a fresh scratch Postgres and confirmed correct — orphan sessions get 0 rows, while student1/parent1 still see both their own team's event and the all-teams event (2/2). Checker gave an explicit reasoned verdict that this is the security-correct default-deny posture per constitution item 4 (no links = no scope), not an over-restriction, even though it also denies a hypothetical "real profile, zero links yet" onboarding-lag edge case PRD 8.3 doesn't explicitly address. `teams`/`seasons` (`read_all` authenticated + staff writes) and `guardian_links` (`staff_all` + `own_read` via `parent_profile_id`/`my_student_ids()`) interpretations — both outside the literal 8.3 matrix — judged reasonable, spirit-consistent defaults, not disputes. T009/T010/T011 migration files confirmed zero diff (constitution item 10); no service-role keys/secrets in the file; no forbidden-file violations. Full evidence includes real scratch-Postgres commands/output for anon, orphan-authenticated, student1, parent1, and admin/coach sessions across `students`/`attendance`/`events`/`event_sessions`/`profiles`/`notification_prefs`/`calendar_feeds`, plus a `profiles` role-escalation block-attempt test and a no-infinite-recursion confirmation across every role type. See `docs/swarm/verification-log.md` T012 entry for full detail and `docs/swarm/archive/T012-worker-packet.md` / `docs/swarm/archive/T012-checker-packet.md` for the complete packets. | No |
| T013 | E2 | Metric views (verbatim 8.4) | worker-implementer | checker-tests | T010,T012 | 0 | Passed | PASS (1st attempt, clean, no findings): all three PRD 8.4 views (`v_student_hours`, `v_student_participation`, `v_team_participation`) confirmed byte-verbatim vs. ground truth via SHA-256 checksum match on the SQL body (not eyeballed diff); prescribed implementation-note comment present and substantively unchanged; grep swept `src/` for `participation_pct`/`confirmed_hours`/`hours_override` — zero hits, no formula duplicated in TypeScript. All 4 NFR-03 fixture cases independently re-validated on a fresh scratch Postgres with the checker's own independently-designed fixtures (not reusing the worker's): (a) excused attendance correctly shrinks the participation denominator (2 expected, 1 excused → 100% off a denominator of 1); (b) `hours_override` wins over computed check-in/check-out duration (override=3.5h shipped even though raw duration ≈1.667h); (c) check-in/check-out clamping to session-window boundaries confirmed both for partial overlap (clamped to the 2h window) and for a check-in/out pair entirely outside the window (clamps to 0, not negative); (d) a session with no `completed`-status event_sessions correctly produces zero rows, not a row with `expected_ct=0`. Null-`team_ids` ("applies to all teams") semantics independently re-verified against a 5-student/4-team fixture — all 5 students correctly pulled into the expected-CTE for a null-team_ids event, confirming NULL is treated as "all teams" per spec. T009–T012 migration files confirmed unchanged. Zero PII columns in any of the three views (student_id/team_id/season_id + numeric metrics only); no self-referential `students` subquery — correctly leaves the Trap 1 teammate-leaderboard-visibility gap deferred to a future task (most likely T044), not a T013 defect. No forbidden-file violations; exactly one new migration file. See `docs/swarm/verification-log.md` T013 entry and `docs/swarm/archive/T013-worker-packet.md` / `docs/swarm/archive/T013-checker-packet.md` for full packets. | No |
| T014 | E2 | NFR-03 metric-view fixture tests | worker-implementer | checker-tests | T013 | 0 | Passed | PASS (1st attempt, clean, no findings): new `supabase/tests/{auth_stub,seed,assertions}.sql` + `run.sh` — plain psql/shell fallback used since neither the Supabase CLI nor the pgtap extension is available in this sandbox (disclosed, not silently substituted). Checker independently re-ran the suite 3 times from a fresh scratch Postgres, designed and ran its own negative-control patch (not reusing the worker's — changed `participation_pct` expectation to a wrong value, confirmed the suite correctly fails and identifies the bad case), and independently re-derived the arithmetic for all 4 NFR-03 cases directly against `supabase/migrations/20260717000003_metric_views.sql`'s real formulas (excused-shrinks-denominator: `round(100*1/greatest(2-1,1),1)=100.0`; hours_override-wins: `9.25` not the clamped `2.0`; check-in clamping positive: `2.0`; check-in clamping zero-floor: `0`, never negative; no-completed-sessions: zero rows, not a row with `expected_ct=0`). All 5 migration files confirmed byte-unchanged via SHA-256. Fabricated-names-only fixture data confirmed (constitution item 6). Zero TS formula duplication confirmed via grep. D001-method forbidden-file check clean (only `supabase/tests/**` touched). Build/typecheck/lint/format:check/test all re-run independently, all clean. See `docs/swarm/verification-log.md` T014 entry and `docs/swarm/archive/T014-worker-packet.md` / `docs/swarm/archive/T014-checker-packet.md` for full packets. | No |
| T015 | E3 | Supabase Auth provider config | worker-implementer | checker-tests | T012 | 0 | Passed | PASS (1st attempt, NIT only, no rework): `supabase/config.toml` (new) authored from scratch + `.env.example` extended. Checker independently confirmed `enable_signup = false` at both `[auth]` (line 133, AUTH-01 master switch) and `[auth.email]` (line 173, provider-scoped) levels; `[auth.external.google]` (`enabled = true`, line 205) uses `env(...)` references only — `client_id = env(SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID)`, `secret = env(SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET)` — zero literal secrets anywhere (3 independent grep patterns: secret/password/key/token/credential, JWT-shaped strings, 40+-char alphanumeric runs — all zero matches). Worker's env-var naming deviated from the packet's illustrative `SUPABASE_AUTH_GOOGLE_*` example to `SUPABASE_AUTH_EXTERNAL_GOOGLE_*` (matching the `auth.external.google` section path); Supabase CLI was not available in the checker's environment to reproduce the worker's claimed CLI validation, so the checker instead did a rigorous manual structural review and judged the worker's section-path-derived naming logically sound and within the packet's explicit allowance for "the exact equivalent current Supabase CLI env-reference syntax" — passed with a caveat noted rather than treated as unverifiable. `.env.example` confirmed to contain only blank `VITE_SUPABASE_URL=`/`VITE_SUPABASE_ANON_KEY=` placeholders; `.env` (real file) confirmed not created and covered by existing `.gitignore` pattern (`.env.example` correctly NOT matched, so it will commit). Worker's unrequested `minimum_password_length = 8` hardening (CLI default is 6) given an explicit NIT verdict — reasonable in-scope security hardening per Supabase's own documented recommendation, not a defect, does not block. D001-method forbidden-file check clean: only `supabase/config.toml` and `.env.example` touched, no `docs/swarm/**`/`.claude/**` writes. External blocker (George's real Google OAuth client does not yet exist) correctly handled — config is staged/functional-once-credentialed, no fake/placeholder secret fabricated. See `docs/swarm/verification-log.md` T015 entry and `docs/swarm/archive/T015-worker-packet.md` / `docs/swarm/archive/T015-checker-packet.md` for full packets. | No |
| T016 | E3 | `/login` screen | worker-implementer | checker-accessibility | T006,T015 | 0 | Passed | PASS (1st attempt, MINOR finding, non-blocking): `LoginPage.tsx`/`index.ts` built under `src/pages/login/**` — Basic Login template, AUTH-02 email/password + Google fields with zero self-serve signup affordance anywhere (verified via full DOM text scan across every reachable state, both modes), DES-12 four-state handling traced to real conditional renders (empty/loading/error/success-equivalent, plus a reset-panel sub-flow), all Astryx props independently re-verified against astryx-api.md's actual line numbers with zero hallucinations, keyboard walkthrough and visible focus confirmed via real KeyboardEvent dispatch and computed-style checks in both light and dark mode (checker built its own independent Playwright render harness, self-deleted, rather than trusting the worker's screenshots), WCAG AA contrast confirmed passing on every token pair the component actually uses in both modes, submission wiring to `guards.tsx`'s real `login()`/`loginWithGoogle()`/`consumeIntendedUrl()` contract confirmed matching. Two judgment calls explicitly adjudicated: (a) `Link`+`onClick` for "Forgot password" instead of `Button variant="ghost"` — checker discovered Astryx's `Link` renders a genuine semantic `<button>` when given no `href`, so the doc's generic prose warning doesn't apply here in substance; NIT-level stylistic preference only, zero accessibility impact. (b) `SIMULATED_AUTH_LATENCY_MS=350` (disclosed, non-PRD timing-only addition) — MINOR: acceptable in scope, but checker independently discovered it's inconsistently applied (missing from the Google sign-in path, undermining its own stated observability purpose there) — routed as a follow-up, not rework. D001-method forbidden-file check clean: only the two new files exist, `router.tsx`/`guards.tsx`/`AppShell.tsx`/nav components all confirmed untouched. Page is not yet reachable live at `/login` in the running app — two dispute-candidate gaps flagged by both worker and checker (router.tsx wiring; no real Supabase auth client exists anywhere in `src/` yet) routed to the orchestrating session for scheduling, not blocking this task's own PASS. See `docs/swarm/verification-log.md` T016 entry and `docs/swarm/archive/T016-worker-packet.md` / `docs/swarm/archive/T016-checker-packet.md` for full packets. | No |
| T016a | E3 | Wire real LoginPage into router.tsx | worker-implementer | checker-tests | T016 | 1 | Passed | PASS (1st attempt, clean, no findings): checker independently re-derived every claim rather than trusting the worker's report — re-read router.tsx directly and confirmed only `/login`-related lines changed (inline placeholder `LoginPage()` + its `signInAs`/`continueWithGoogle` helpers removed, now-unused imports removed, `import { LoginPage } from '../pages/login'` added, every other route/placeholder/`routePaths` byte-unchanged); independently re-ran typecheck/lint/build/format:check/test (all exit 0, only the same 8 pre-existing warnings); built its own live Playwright verification against a real dev server + Chromium reproducing all 4 scenarios (real component renders at `/login` with old placeholder text confirmed absent, full sign-in round trip lands on Dashboard placeholder at `/`, NAV-08 intended-URL preservation confirmed via `/roster`, `/kiosk/:sessionId` unauthenticated regression spot-check still redirects correctly) plus a 5th spot-check (`/accept-invite` placeholder unaffected); D001-method forbidden-file check clean (`src/pages/login/**` and `guards.tsx` confirmed untouched). `/login` is now genuinely reachable in the running app — first real page in the app viewable end-to-end, not just in isolation. See `docs/swarm/verification-log.md` T016a entry and `docs/swarm/archive/T016a-worker-packet.md` / `docs/swarm/archive/T016a-checker-packet.md` for full packets. | No |
| T017 | E3 | `send-invite` Edge Function | worker-implementer | checker-reviewer | T009,T012 | 0 | Passed | PASS (1st attempt, MINOR finding, non-blocking): new `supabase/functions/send-invite/{index.ts,validation.ts,validation.test.ts,deno.json,deno.lock}`. Checker independently confirmed the two-client architecture (anon-JWT client for identity/RLS-subject reads, service-role client only for writes, authorization gate runs BEFORE the service-role client is even constructed — traced from code, not comments); secret hygiene clean (constitution item 5) — `SUPABASE_SERVICE_ROLE_KEY` only ever sourced via `Deno.env.get`, never logged/echoed, no hardcoded key literal anywhere; `invites` insert payload and RLS posture cross-checked against the real migrations, confirming the function's own role gate is genuinely load-bearing since the service-role client bypasses RLS entirely; AUTH-06 14-day expiry hand-verified. `deno`/Docker were both unavailable in the checker's sandbox too (deno.land and Docker Hub CDN both return 403 under the egress policy — checker went further than the worker, manually starting a Docker daemon to confirm this is a genuine environment-level block, not a shortcut) — checker instead ported all 21 test assertions to Node and independently confirmed all 21 pass. Three flagged judgment calls adjudicated: custom error-response shape (NIT, acceptable, DES-16-compliant copy) and wildcard CORS (NIT, safe given bearer-token auth with no credentials flag) both accepted as-is; no dedup/idempotency on `inviteUserByEmail` retries (MINOR — real but low-severity, a client retry could create a duplicate pending `invites` row/duplicate email, not a security break) routed as a follow-up task. D001-method forbidden-file check clean. See `docs/swarm/verification-log.md` T017 entry and `docs/swarm/archive/T017-worker-packet.md` / `docs/swarm/archive/T017-checker-packet.md` for full packets. | No |
| T018 | E3 | `/accept-invite` screen | worker-implementer | checker-accessibility | T016,T017 | 0 | Ready | Unblocked 2026-07-18 on T017's PASS full-ledger sweep (T016 and T017 both now Passed). Worker packet drafted at `docs/swarm/active/T018-worker-packet.md`. Not yet dispatched. | No |
| T019 | E3 | DB trigger: invite acceptance → profile/link | worker-implementer | checker-reviewer | T017,T009 | 0 | Passed | PASS (1st attempt, MINOR finding, non-blocking — critical-path task, everything downstream in E4/E5/E6 depends on this): new additive migration `20260718000000_invite_trigger.sql`. Resolves T009's `profiles.avatar_url` nullability gap (dropped NOT NULL). `fn_handle_invite_acceptance()` (SECURITY DEFINER, same pattern as T011's audit triggers) + `AFTER UPDATE ON auth.users` trigger, WHEN-gated on the OR of two independent NULL→NOT-NULL transitions (`email_confirmed_at`, `last_sign_in_at`) — chosen specifically because `inviteUserByEmail` (T017) runs at invite-SEND time, so a naive INSERT trigger would fire too early; `encrypted_password` explicitly rejected as a signal since OAuth-only accounts never set it. Checker independently stood up its own scratch Postgres with its own fixtures and re-ran all 6 scenarios (student invite, parent multi-invite-row per ROS-05, idempotent re-fire via the *other* signal, no-invite no-op, expired-invite no-op, admin invite) plus 3 adversarial probes of its own devising: a role-leak probe (confirmed `raw_user_meta_data.role` is genuinely ignored, `invites.role` is the sole source), a WHEN-gate probe (confirmed the trigger does not fire early on unrelated `auth.users` updates), and a display_name-fallback probe. Checker rendered an explicit, weighed severity verdict on the signal-choice design (not a rubber stamp): false-positive risk judged negligible (any real transition IS a sign-in event, and the `status='pending' and expires_at>now()` guard backstops anything unrelated), false-negative risk judged low (both columns would need to be pre-populated at invite-send time for the OR to miss, contradicting `inviteUserByEmail`'s documented starting state), no real concurrency race (per-row AFTER UPDATE serializes on the row lock, `ON CONFLICT DO NOTHING` is an independent backstop) — explicitly concluded this does NOT warrant boss-arbiter escalation, since there's no demonstrable failure mode and the only residual is unverifiable live-GoTrue behavior, the same already-accepted structural limitation as T015/T017/T032. Constitution item 10 confirmed via content-diff of all 5 pre-existing migrations (identical, additive-only). Role provenance independently grepped and adversarially tested. `avatar_url` nullability change confirmed to collide with no other insert path (only insert-into-profiles site in real source is this trigger). D001-method forbidden-file check clean. Two NITs (display_name email-local-part fallback, guardian_links.relationship='guardian' literal) — both clearly disclosed placeholders, not spec-derived truth, accepted as-is. See `docs/swarm/verification-log.md` T019 entry and `docs/swarm/archive/T019-worker-packet.md` / `docs/swarm/archive/T019-checker-packet.md` for full packets. | No |
| T020 | E3 | AUTH-04 uninvited path + RLS-denial test | worker-implementer | checker-tests | T012,T018,T019 | 0 | Blocked | None | No |
| T021 | E4 | `/roster` shell + TabList | worker-implementer | checker-accessibility | T007,T019 | 0 | Ready | Unblocked 2026-07-18 on T019's PASS full-ledger sweep (T007 and T019 both now Passed) — first real content-page task in the ledger. Not yet dispatched. | No |
| T022 | E4 | Students tab table + row actions | worker-implementer | checker-accessibility | T021,T009 | 0 | Blocked | None | No |
| T023 | E4 | Add/edit student dialog | worker-implementer | checker-reviewer | T022 | 0 | Blocked | None | No |
| T024 | E4 | Invite parent dialog | worker-implementer | checker-reviewer | T022,T017 | 0 | Blocked | None | No |
| T025 | E4 | Parents tab | worker-implementer | checker-accessibility | T021 | 0 | Blocked | None | No |
| T026 | E4 | Teams tab (CRUD + archive) | worker-implementer | checker-accessibility | T021 | 0 | Blocked | None | No |
| T027 | E4 | Invites tab | worker-implementer | checker-accessibility | T021,T017 | 0 | Blocked | None | No |
| T028 | E4 | Roster admin toggles (ROS-08) | worker-implementer | checker-reviewer | T021 | 0 | Blocked | None | No |
| T029 | E4 | Season management `/settings/season` | worker-implementer | checker-reviewer | T021,T009 | 0 | Blocked | None | No |
| T030 | E5 | `/meetings` list | worker-implementer | checker-accessibility | T007,T019 | 0 | Ready | Unblocked 2026-07-18 on T019's PASS full-ledger sweep (T007 and T019 both now Passed) — first real content-page task in E5. Not yet dispatched. | No |
| T031 | E5 | Schedule meetings dialog | worker-implementer | checker-reviewer | T030 | 0 | Blocked | None | No |
| T032 | E5 | `checkin` Edge Function (HMAC rotating token) | worker-implementer | checker-tests | T010,T012 | 0 | Passed | PASS (1st attempt, two MINOR follow-ups, non-blocking): new `supabase/functions/checkin/{index.ts,hmac.ts,grace.ts,liveness.ts,rate_limit.ts,validation.ts,attendance_upsert.ts}` + 6 matching `.test.ts` files (53 tests). Checker independently re-derived and re-executed representative tests (HMAC bucket/token/short-code math, grace-period boundary at exactly 10:00 vs 10:00:01, MTG-11 coach-row preservation, MTG-09 idempotent duplicate check-in) via a Node/tsx port since Deno wasn't available, all passing. Unconditional `ON CONFLICT DO NOTHING` (vs. the packet's illustrative conditional `WHERE method <> 'coach'`) judged PASS-AS-DESIGNED: it's a strict superset that still satisfies MTG-11 and better satisfies MTG-09 (never silently overwrites an earlier check-in's timestamp on a later duplicate scan), and no code path in this function ever needs a legitimate second write. Secret hygiene (constitution item 5, BLOCKER-class) clean: `CHECKIN_HMAC_SECRET` only ever read via `Deno.env.get`, never hardcoded/logged/echoed. D001-method forbidden-file check clean: only `supabase/functions/checkin/**` touched, no `src/**`/migrations changes. Two MINOR follow-ups (both genuinely undoable within this task's frozen-schema scope, correctly flagged rather than worked around): (1) MTG-04's manual "start check-in early/late" override has no schema column yet (`checkin_opened_at`/`checkin_opened_by` don't exist), deferred to a future migration task; (2) the 5/min rate limiter is in-memory per-isolate only (no persisted rate-limit table in the frozen schema), a best-effort limit rather than a globally precise one. See `docs/swarm/verification-log.md` T032 entry and `docs/swarm/archive/T032-worker-packet.md` / `docs/swarm/archive/T032-checker-packet.md` for full packets. | No |
| T033 | E5 | Live console `/meetings/live/:sessionId` | worker-implementer | checker-accessibility | T031,T032 | 0 | Blocked | None | No |
| T034 | E5 | Kiosk view `/kiosk/:sessionId` | worker-implementer | checker-accessibility | T032 | 0 | Ready | Unblocked 2026-07-19 on T032's PASS full-ledger sweep (sole dependency T032 now Passed). Worker packet drafted at `docs/swarm/active/T034-worker-packet.md`. Not yet dispatched. | No |
| T035 | E5 | `/checkin` result screen + Check-in Bolt | worker-implementer | checker-accessibility | T032 | 0 | Ready | Unblocked 2026-07-19 on T032's PASS full-ledger sweep (sole dependency T032 now Passed). Worker packet drafted at `docs/swarm/active/T035-worker-packet.md`. Not yet dispatched. | No |
| T036 | E5 | End meeting flow (MTG-13) | worker-implementer | checker-reviewer | T033 | 0 | Blocked | None | No |
| T037 | E5 | Student/parent meeting view + consistency strip | worker-implementer | checker-reviewer | T030,T013 | 0 | Blocked | None | No |
| T038 | E6 | `/outreach` list + season goal bar | worker-implementer | checker-accessibility | T007,T019 | 0 | Ready | Unblocked 2026-07-18 on T019's PASS full-ledger sweep (T007 and T019 both now Passed) — first real content-page task in E6. Not yet dispatched. | No |
| T039 | E6 | New/edit outreach event dialog + competition flags | worker-implementer | checker-reviewer | T038 | 0 | Blocked | None | No |
| T040 | E6 | RSVP control (OUT-03) | worker-implementer | checker-reviewer | T039 | 0 | Blocked | None | No |
| T041 | E6 | Outreach detail `/outreach/:eventId` | worker-implementer | checker-accessibility | T039,T040 | 0 | Blocked | None | No |
| T042 | E6 | Mark day complete dialog (OUT-05) | worker-implementer | checker-reviewer | T041 | 0 | Blocked | None | No |
| T043 | E6 | Parent RSVP-on-behalf (OUT-06) | worker-implementer | checker-reviewer | T040 | 0 | Blocked | None | No |
| T044 | E6 | Leaderboard (OUT-08) | worker-implementer | checker-reviewer | T038,T013 | 0 | Blocked | None | No |
| T045 | E7 | `/calendar` month grid + filters + detail links | worker-implementer | checker-accessibility | T030,T038 | 0 | Blocked | None | No |
| T046 | E7 | Subscribe popover + reset link (CAL-03) | worker-implementer | checker-reviewer | T045 | 0 | Blocked | None | No |
| T047 | E7 | `ics` Edge Function via `ical-generator` | worker-implementer | checker-tests | T045,T010 | 0 | Blocked | None | No |
| T048 | E8 | Resend integration + branded layout + `email_log` | worker-implementer | checker-reviewer | T017 | 0 | Ready | Unblocked 2026-07-18 on T017's PASS full-ledger sweep (sole dependency T017 now Passed). Worker packet drafted at `docs/swarm/active/T048-worker-packet.md`. Not yet dispatched. | No |
| T049 | E8 | Transactional email templates | worker-implementer | checker-content | T048 | 0 | Blocked | None | No |
| T050 | E8 | Weekly digest template | worker-implementer | checker-content | T048,T013 | 0 | Blocked | None | No |
| T051 | E8 | `send-reminders` Edge Function + `pg_cron` + dedupe | worker-implementer | checker-tests | T049,T050,T011 | 0 | Blocked | None | No |
| T052 | E8 | **HUMAN GATE** — production email enablement | — | human (George) | T051 | — | Blocked | None | — |
| T053 | E9 | Coach/Admin Home (HOME-01/04) | worker-implementer | checker-accessibility | T030,T038,T013 | 0 | Blocked | None | No |
| T054 | E9 | Student Home (HOME-02) | worker-implementer | checker-accessibility | T030,T032,T038,T013 | 0 | Blocked | None | No |
| T055 | E9 | Parent Home (HOME-03) | worker-implementer | checker-accessibility | T038,T037,T013 | 0 | Blocked | None | No |
| T056 | E9 | `/reports` shell + Participation tab | worker-implementer | checker-accessibility | T013,T014 | 0 | Ready | Unblocked 2026-07-18 on T014's PASS full-ledger sweep (T013 and T014 both now Passed). Worker packet drafted at `docs/swarm/active/T056-worker-packet.md`. Not yet dispatched. | No |
| T057 | E9 | Hours tab (RPT-03) | worker-implementer | checker-reviewer | T056,T013 | 0 | Blocked | None | No |
| T058 | E9 | Events tab (RPT-04) | worker-implementer | checker-reviewer | T056 | 0 | Blocked | None | No |
| T059 | E9 | CSV exports (RPT-05/06) | worker-implementer | checker-tests | T057,T058,T056 | 0 | Blocked | None | No |
| T060 | E9 | `/settings` screen (SET-01/02/03) | worker-implementer | checker-accessibility | T003,T011,T046 | 0 | Blocked | None | No |
| T061 | E10 | Schema verification + mapping doc copy (MIG-01/02) | worker-implementer | checker-reviewer | T009,T010,T011 | 0 | Passed | PASS (1st attempt, clean, no findings): `docs/migration/{source-schema.md,mapping.md}`. Checker independently re-ran all five no-live-access sub-checks (env vars, filesystem `.env` search, repo grep, network reachability, mirror search) rather than trusting the worker's report, and confirmed the genuine 403 from `github.com/gamitch/volt-timetracker` byte-for-byte matches what `source-schema.md` quotes. `mapping.md` confirmed byte-identical to PRD Section 10.2 (lines 695–710) via diff + matching md5 checksum. `source-schema.md` confirmed to make no fabricated "drift found"/"no drift found" claim and to unambiguously label its PRD 10.1 reference as a non-independently-verified transcription. D001-method forbidden-file check clean: only the two `docs/migration/**` files exist as new, no `src/**`/`supabase/**` changes, no WRITE/ALTER/DELETE against the old project (constitution item 16). Unblock path (George supplies `OLD_SUPABASE_URL`/`OLD_SERVICE_ROLE_KEY` via secure channel) confirmed consistent with how other external-prerequisite blockers are handled elsewhere in the ledger. See `docs/swarm/verification-log.md` T061 entry and `docs/swarm/archive/T061-worker-packet.md` / `docs/swarm/archive/T061-checker-packet.md` for full packets. | No |
| T062 | E10 | ETL script `scripts/migrate.ts` (MIG-03) | worker-implementer | checker-tests | T061 | 0 | Ready | Unblocked 2026-07-18 on T061's PASS full-ledger sweep (sole dependency T061 now Passed). Worker packet drafted at `docs/swarm/active/T062-worker-packet.md`. Not yet dispatched. | No |
| T063 | E10 | **HUMAN GATE** — MIG-04 validation gates + sign-off | — | human (George) | T062,T014 | — | Blocked | None | — |
| T064 | E10 | Roster → accounts post-migration verification (MIG-05) | worker-implementer | checker-reviewer | T063 | 0 | Blocked | None | No |
| T065 | E10 | **HUMAN GATE** — MIG-06 cutover | — | human (George) | T064 | — | Blocked | None | — |
| T066 | E11 | Playwright persona smoke tests + login + RLS-denial | worker-implementer | checker-tests | T033,T037,T042,T053–T060 | 0 | Blocked | None | No |
| T067 | E11 | Accessibility sweep (all screens, both modes) | worker-implementer | checker-accessibility | T053–T060 | 0 | Blocked | None | No |
| T068 | E11 | Responsive sweep 375–1440px | worker-implementer | checker-accessibility | T053–T060 | 0 | Blocked | None | No |
| T069 | E11 | Empty/error state copy audit (DES-12/15/16) | worker-implementer | checker-content | T053–T060 | 0 | Blocked | None | No |
| T070 | E11 | **HUMAN GATE** — Vercel domain go-live | — | human (George) | T065,T066,T067,T068,T069 | — | Blocked | None | — |

---

## Task details

### E1 — Scaffold + theme (D2, D3, DES-03…21, NAV-01…07, NFR-01/04/08)

**T001 — Vite + TS(strict) + ESLint/Prettier scaffold**
Objective: Initialize the Vite + React 18 + TypeScript-strict SPA per D2; add ESLint + Prettier config; no Tailwind/shadcn present anywhere.
Allowed files: repo root config (`package.json`, `tsconfig*.json`, `vite.config.ts`, `.eslintrc*`, `.prettierrc*`), `src/main.tsx`, `src/App.tsx`.
Acceptance: builds and runs; `tsconfig` has `strict: true`; ESLint has zero Tailwind/shadcn deps in `package.json`; matches D2/dependency allowlist (constitution item 9).
Evidence: `npm run build`, `npm run typecheck`, `npm run lint` output; `package.json` diff.

**T002 — Astryx install + `volt.ts` theme**
Objective: Install `@astryxdesign/core` + `@astryxdesign/theme-neutral` + CLI; add `astryx` npm script (DES-18); create `src/theme/volt.ts` matching the DES-03 code block exactly (accent `#5B2EE5`/`#9B7BFF`, Space Grotesk/Inter, radius, tokens).
Allowed files: `package.json`, `src/theme/volt.ts`.
Acceptance: theme file matches DES-03 verbatim (accent hex, font families/URLs, radius, token array order); `npm run astryx -- component --list` runs; both light/dark accent-on-surface pass WCAG AA (DES-06) — cite constitution item 2 (Astryx props only from `astryx-api.md`).
Evidence: contrast-check output (both modes), CLI run log, file diff vs DES-03 block.

**T002a — React 18 → React 19 upgrade (D002 corrective task)**
Objective: Upgrade the stack from React 18 to React 19 per the D002 stack-lock reversal (constitution item 8), closing the runtime gap a typecheck-only T002 check missed — `@astryxdesign/core`'s shipped `Theme.js` calls React's `use()` hook, which does not exist in React 18 and throws at first render.
Allowed files: `package.json`, `package-lock.json`, `src/theme/astryx-augment.d.ts` (adjust only if the @types/react 19 compiler forces a change — do not touch speculatively), one minimal new runtime-smoke test file, which must live under `src/theme/` (e.g. `src/theme/theme.smoke.test.tsx`) or a new `src/test-setup/**` if a shared setup file is genuinely required — worker's call on exact naming.
Note: `src/theme/volt.ts` is explicitly forbidden for this task — it is already verbatim-correct per D001/D002; this task is a dependency + infra upgrade only, not a theme-content change.
Acceptance:
- `react`/`react-dom` bumped to `^19`, `@types/react`/`@types/react-dom` bumped to `19`, in `package.json`.
- Clean reinstall performed WITHOUT `--legacy-peer-deps`; regenerated `package-lock.json` committed.
- `npm ls react react-dom @astryxdesign/core` clean — no ELSPROBLEMS/invalid markers.
- `node -e` check confirms `typeof require('react').use === 'function'`.
- build/typecheck/lint/format all exit 0; tsconfig `strict` unchanged.
- **Mandatory runtime smoke check** (this is the failure mode typecheck missed on T002): render the app root together with the Astryx Theme provider (vitest + jsdom, or an equivalent minimal runtime render) and assert no throw. A green typecheck alone does NOT close this task.
- `src/theme/astryx-augment.d.ts` re-verified to still compile against `@types/react` 19; adjust only if the compiler forces it.
- Any allowlisted runtime dep (`@tanstack/react-query`, `react-router-dom`, `qrcode.react` when added) whose peer range forces a version bump on install is reported explicitly in the worker output, not silently taken.
Evidence: `npm ls` output, `node -e` check output, build/typecheck/lint/format:check output, test-runner output showing the smoke test passing, `package.json`/`package-lock.json` diff, diff (or explicit "no change needed") for `astryx-augment.d.ts`.

**T003 — CSS cascade layers + `theme.css` build**
Objective: Declare explicit `@layer reset, astryx-base, app` (NFR-08); wire the `/built` theme import + prebuilt `theme.css` pattern (DES-07), no runtime style injection.
Allowed files: `src/theme/theme.css` (generated), `src/main.tsx` (import only), `vite.config.ts` if needed for the build step.
Acceptance: no unlayered global CSS; production build emits static `theme.css`; layer order matches NFR-08.
Evidence: build output showing generated CSS, grep for `@layer` declarations.

**T004 — CI pipeline**
Objective: CI runs typecheck, lint, unit (Vitest), build (NFR-01) and fails on any error; enforce initial route JS < 300 KB gz budget (NFR-04).
Allowed files: `.github/workflows/ci.yml` (or equivalent), `package.json` scripts.
Acceptance: pipeline green on a clean checkout; bundle-size check fails the build over budget; route-level code splitting present.
Evidence: CI run log/link, bundle analyzer output.

**T005 — Router skeleton + route guards + deep-link redirect**
Objective: React Router route table stub for every route in Section 7 (even as placeholders); NAV-06 auth/role guards; NAV-08 store-intended-URL-and-redirect-after-login mechanism (including Google OAuth round-trip).
Allowed files: `src/app/router.tsx`, `src/app/guards.tsx`.
Acceptance: unauthenticated → `/login`; wrong-role → `/` + Toast "You don't have access to that page."; deep link to a protected route survives a login round-trip.
Evidence: manual walkthrough notes/screenshots per guard case.

**T006 — AppShell + TopNav**
Objective: Astryx `AppShell` wrapping `Layer` + `Theme` providers; `TopNav` per NAV-02 (wordmark→Home, admin/coach season `Selector`, user menu `Avatar`+`DropdownMenu`: Profile/Appearance/Sign out).
Allowed files: `src/app/AppShell.tsx`, `src/components/nav/TopNav.tsx`.
Acceptance: matches NAV-01/02 exactly; props verified against `astryx-api.md`; keyboard-operable menu, visible focus (DES-17).
Evidence: keyboard walkthrough, prop cross-check list, screenshots both modes.

**T006a — Fix CI test regression from T006 wiring (D003 corrective task)**
Objective: Close the CI-gate regression created when T006's mandated `App.tsx` wiring (per T005's own module doc — not worker scope creep) broke the pre-existing, already-Passed `theme.smoke.test.tsx` (T002a). Real GitHub Actions CI has been red on the required `npm run test` step since commit e20b8d1. Per boss-arbiter ruling D003 (`docs/swarm/dispute-log.md`), T006's worker was not at fault — the fix requires editing a file forbidden to T006 — and no T006 rework exists or is permitted; this is a same-day forward-fix task in the T002a/D002 corrective-task pattern, dispatched immediately per CI-break precedent.
Allowed files: exactly `src/theme/theme.smoke.test.tsx` (scoped edit per D003 Ruling C), `src/test-setup.ts` (new, per D003 Ruling D), `vite.config.ts` (scoped edit per D003 Ruling D — `test.setupFiles` wiring plus the one mechanical typing change the `test` key requires; T003's `build.rollupOptions` block must stay byte-untouched).
Forbidden files: everything else, explicitly including `src/theme/volt.ts`, `src/App.tsx`, `src/app/**`, `src/components/**`, `package.json`, `.github/workflows/ci.yml`, and T006's own deliverables (`AppShell.tsx`/`TopNav.tsx`) — D003 is explicit that no T006 rework exists.
Acceptance: `npm run test` exits 0 (full suite); `npm run typecheck`/`npm run lint`/`npm run build`/`npm run format:check` all exit 0; smoke test renders the real `<App />` tree directly (no outer `<Theme>` double-wrap, no shallow/mock render) with `.not.toThrow()` kept as the core assertion and the stale `'VOLT Team Portal'` h1 assertion replaced with `expect(container.textContent?.trim()).toBeTruthy()`; `src/test-setup.ts`'s `matchMedia` polyfill confirmed minimal and guarded (only assigns if `window.matchMedia` is undefined); T003's `vite.config.ts` `build.rollupOptions` block confirmed byte-unchanged; production build artifacts unchanged and the bundle-size gate re-verified still passing (re-check `.github/workflows/ci.yml`'s bundle-size gate logic manually, since CI itself also re-verifies).
Evidence: full `npm run test` output; typecheck/lint/build/format:check output; diff or checksum proving `build.rollupOptions` byte-unchanged; confirmation `dist/assets/theme.css` still emitted plus the manual bundle-size gate re-check output.
Dependencies: T006. Sequencing per D003 Ruling F: T006 stays "In Progress" until T006a Passes; T006a's checker-tests PASS is the re-verification T006 is waiting on — no separate checker-accessibility re-run of T006 is required. T007/T008/T016 remain blocked until T006 flips to Passed (i.e., until T006a passes).

**T007 — SideNav (role-filtered) + outreach badge scaffold**
Objective: `SideNav` per NAV-03 role matrix; active-item highlight + `document.title` per NAV-04; enforce NAV-07 (Meetings/Outreach never combined outside Calendar/Reports) at the nav level; add the **Outreach** item's neutral count-`Badge` slot (BEH-04) — real count wired later in T038.
Allowed files: `src/components/nav/SideNav.tsx`.
Acceptance: correct items per role per NAV-03 table; badge slot renders neutral styling (never error/red) even with placeholder count; keyboard-navigable.
Evidence: role-by-role screenshot/DOM check, keyboard walkthrough.

**T008 — MobileNav drawer + Student Home live-card slot**
Objective: `MobileNav` drawer for < 768px triggered from `TopNav` (NAV-05); reserve the persistent "Check in" card slot on Student Home for when a meeting is live (logic wired in T054).
Allowed files: `src/components/nav/MobileNav.tsx`, `src/pages/home/StudentHomeSlot.tsx` (placeholder only).
Acceptance: drawer opens/closes via keyboard and touch; slot renders nothing when no live session (real query lands in T054).
Evidence: responsive screenshots 375px, keyboard walkthrough.

### E2 — Schema + RLS + views (Section 8, DATA-01/02, NFR-03)

**T009 — Migration: identity/roster tables**
Objective: Additive Supabase migration for `profiles`, `teams`, `seasons`, `students`, `guardian_links` exactly per PRD 8.1 field lists.
Allowed files: `supabase/migrations/<timestamp>_identity_roster.sql`.
External blocker: requires George's new Supabase project to exist (D1) — cannot run against a live instance until then; migration file can still be authored and applied to a local/dev Supabase instance for CI.
Acceptance: matches 8.1 column-for-column; FKs `on delete restrict` unless noted; no edits to prior migration files (constitution item 10).
Evidence: `supabase db reset` / migration apply log, schema diff vs PRD 8.1.

**T010 — Migration: scheduling/attendance tables**
Objective: Additive migration for `invites`, `events`, `event_sessions`, `rsvps`, `attendance` per PRD 8.1.
Allowed files: `supabase/migrations/<timestamp>_scheduling_attendance.sql`.
Acceptance: matches 8.1 (incl. `attendance` unique(session,student), `method` enum, `hours_override`); additive only.
Evidence: migration apply log, schema diff.

**T011 — Migration: support tables + audit triggers**
Objective: Additive migration for `notification_prefs`, `calendar_feeds`, `email_log`, `audit_log`; DB triggers for DATA-02 events (attendance edits post-completion, role changes, deactivations, event/session cancellations, invite revocations).
Allowed files: `supabase/migrations/<timestamp>_support_audit.sql`.
Acceptance: all DATA-02 trigger cases fire and write `audit_log`; no PII beyond IDs in `meta jsonb` (constitution item 6).
Evidence: trigger test output per DATA-02 case.

**T012 — RLS helper functions + policies**
Objective: Copy PRD 8.4's `auth_role()`, `is_staff()`, `my_student_ids()` and the three canonical policy shapes verbatim; apply the 8.3 matrix to every table.
Allowed files: `supabase/migrations/<timestamp>_rls.sql`.
Acceptance: **verbatim** copy of 8.4 SQL (constitution item 3, BLOCKER if re-derived); every table in 8.1 has RLS enabled with no gaps (constitution item 4, BLOCKER); no policy subqueries its own table (`profiles` recursion bug) — must use helpers only.
Evidence: SQL diff vs PRD 8.4 block, RLS-enabled table list, policy-per-table matrix vs 8.3.

**T013 — Metric views**
Objective: Copy PRD 8.4's `v_student_hours`, `v_student_participation`, `v_team_participation` verbatim.
Allowed files: `supabase/migrations/<timestamp>_metric_views.sql`.
Acceptance: verbatim copy (constitution item 3, BLOCKER if re-derived or duplicated in TS anywhere in the repo — checker greps `src/` for formula duplication).
Evidence: SQL diff vs 8.4 block, `grep` confirming no TS reimplementation.

**T014 — NFR-03 metric-view fixture tests**
Objective: SQL/unit fixture tests covering excused-shrinks-denominator, `hours_override`-wins, check-in clamping to session window, and the no-completed-sessions "—" case.
Allowed files: `supabase/tests/**` or `tests/metrics/**` (fixtures + runner only).
Acceptance: all four documented cases pass against T013's views; test data uses fabricated names only (constitution item 6).
Evidence: test run output, fixture data listing.

### E3 — Auth + invites (AUTH-01…08, ROS-05/07 invite plumbing, EML invite)

**T015 — Supabase Auth provider config**
Objective: Enable email/password + Google OAuth providers; disable public signup (AUTH-01).
Allowed files: `supabase/config.toml` or equivalent auth config, `.env.example` (no secrets committed — constitution item 5).
External blocker: requires George's Google Cloud OAuth client (redirect = Supabase callback) — task can be authored/staged but cannot be verified end-to-end until that credential exists.
Acceptance: public signup off; both providers configured; no secrets in repo.
Evidence: config diff, `.env*` gitignore check.

**T016 — `/login` screen**
Objective: `Basic Login` template (DES-08) with email/password fields, "Continue with Google" secondary button, "Forgot password" link, VOLT wordmark above card, no self-serve create-account link (AUTH-02).
Allowed files: `src/pages/login/**`.
Acceptance: template used as-is (constitution item 13 — no invented layout); all four DES-12 states where applicable; keyboard path complete.
Evidence: screenshots both modes, keyboard walkthrough, astryx-api.md prop cross-check.

**T016a — Wire real LoginPage into router.tsx (corrective task)**
Objective: Close the wiring gap T016 left open — `src/app/router.tsx`'s `/login` route still renders its own inline placeholder `LoginPage()` function (defined in `router.tsx` itself) instead of the real, fully-verified `LoginPage` component T016 built at `src/pages/login/LoginPage.tsx` (barrel-exported from `src/pages/login/index.ts`). `router.tsx` was a forbidden file for T016, so T016's worker/checker could not close this themselves; both independently flagged it as a small, low-risk, mechanical follow-up. The user approved doing this now rather than deferring to T018's equivalent gap.
Allowed files: `src/app/router.tsx` only.
Forbidden files: `src/pages/login/**` (T016's deliverable — must not be touched/reinterpreted), `src/app/guards.tsx`, `src/app/AppShell.tsx`, everything else.
Acceptance: inline placeholder `LoginPage()` and its `signInAs`/`continueWithGoogle` helpers removed from `router.tsx`; `/login` route's element resolves to the real component imported from `../pages/login`; `npm run typecheck`/`lint`/`build`/`format:check`/`test` all exit 0; live-browser verification (Playwright) confirms the real component renders at `/login` (not the old placeholder), a full sign-in round trip works (submit → redirect to `/` or the intended URL), and the NAV-08 intended-URL-preservation flow (unauthenticated deep link to a protected route → `/login` → sign in → back to the originally-requested URL) still works end-to-end; no other route or behavior in `router.tsx` regresses (diff confirms only `/login`-related lines changed).
Evidence: `router.tsx` diff, typecheck/lint/build/format:check/test output, Playwright scripts + output for the render check, sign-in round trip, and intended-URL-preservation flow, confirmation `src/pages/login/**` is untouched.
Dependencies: T016 (Passed). Does not touch `guards.tsx` or attempt real Supabase auth — that gap (also flagged at T016 close-out) remains separately tracked and deliberately out of scope here.

**T017 — `send-invite` Edge Function**
Objective: Edge Function creating an `invites` row and calling Supabase `inviteUserByEmail`, triggering the branded Resend invite template (AUTH-03 steps 1–2, EML-01 wiring).
Allowed files: `supabase/functions/send-invite/**`.
Acceptance: no service-role key in frontend bundle (constitution item 5, BLOCKER); invite row created with correct role/student linkage; 14-day `expires_at` (AUTH-06).
Evidence: function invocation log, bundle grep for service-role key.

**T018 — `/accept-invite` screen**
Objective: `Login Card` pattern (DES-08) showing invitee name + role, "Set a password" or "Continue with Google" (AUTH-03 step 3).
Allowed files: `src/pages/accept-invite/**`.
Acceptance: template as-is; both auth paths work; DES-12 error state for expired/revoked invites.
Evidence: screenshots, expired-invite walkthrough.

**T019 — DB trigger: invite acceptance → profile/link**
Objective: On first sign-in, match `auth.users.email` to pending invite, create `profiles` with invited role, link `students.profile_id` or `guardian_links`, mark invite accepted (AUTH-03 step 4).
Allowed files: `supabase/migrations/<timestamp>_invite_trigger.sql`.
Acceptance: trigger handles student and parent invite types correctly; idempotent on re-trigger; role stamped from invite, never client-supplied.
- **Amended 2026-07-16 (T009 MINOR follow-up):** resolve `profiles.avatar_url` nullability. T009's migration defines `avatar_url text not null` with no default, following a literal reading of PRD 8.1's "no null-marker = NOT NULL" rule — but PRD SET-01 describes avatar upload as a post-creation settings action, so a NOT NULL column with no default blocks this task's own INSERT into `profiles` at invite acceptance. This task must either (a) add a sensible default for `avatar_url` (e.g. empty string or a generated placeholder URL) or (b) make the column nullable, whichever better matches how the invite-acceptance INSERT is written — and should do so via a new additive migration (do not edit T009's migration file per constitution item 10). Flag the choice explicitly in this task's worker output so the checker can confirm it doesn't silently diverge from PRD 8.1 elsewhere.
Evidence: trigger test output for both invite types; explicit note of the `avatar_url` nullability resolution and why.

**T020 — AUTH-04 uninvited path + RLS-denial test**
Objective: Google sign-in with no pending invite/profile lands on "You're not on the roster yet" screen (team contact name, no data), session signed out; independently verify RLS denies all data to profile-less users (NFR-02 RLS-denial test).
Allowed files: `src/pages/no-access/**`, `tests/rls/**`.
Acceptance: screen shows zero roster/event data even via direct query attempt; RLS test proves zero rows returned for a profile-less authenticated user across `students`, `events`, `attendance`.
Evidence: RLS-denial test run output (row counts = 0), screenshot of the no-access screen.

### E4 — Roster + teams + seasons (ROS-01…09, SET-04)

**T021 — `/roster` shell + TabList**
Objective: `TabList`: Students | Parents | Teams | Invites (ROS-01), coach/admin only route.
Allowed files: `src/pages/roster/RosterShell.tsx`.
Acceptance: route guard restricts to admin/coach; tabs keyboard-navigable; NAV-06 redirect for other roles.
Evidence: role-walkthrough screenshots, keyboard test.

**T022 — Students tab table + row actions**
Objective: `Table` + `PowerSearch` (name/team/status/active filters); columns per ROS-02; row `MoreMenu` → Edit, Invite (if email), Invite parent, Deactivate (`AlertDialog`, ROS-09), View history.
Allowed files: `src/pages/roster/StudentsTab.tsx`.
Acceptance: all ROS-02 columns present; deactivate uses `AlertDialog` (DES-11); deactivated students drop from future expected rosters/leaderboards but keep history (ROS-09).
Evidence: table screenshot, deactivate flow walkthrough, astryx-api.md prop check.

**T023 — Add/edit student dialog**
Objective: `Dialog` per ROS-03 fields in listed order (name, email, team, grad year, active switch, goal override).
Allowed files: `src/pages/roster/StudentDialog.tsx`.
Acceptance: field order matches ROS-03; confirm button states computed outcome per BEH-07 ("Add student"/"Save changes", never bare "Submit"/"OK" — MAJOR if violated); blank goal override inherits season default (MET-04).
Evidence: field-order screenshot, button-copy check.

**T024 — Invite parent dialog**
Objective: `Dialog` per ROS-05 (email, relationship label, optional `MultiSelector` of additional linked students), calls `send-invite` (T017).
Allowed files: `src/pages/roster/InviteParentDialog.tsx`.
Acceptance: confirm button computed copy per BEH-07 ("Send invite", toast "Invite sent to …" per DES-14); relationship label required.
Evidence: screenshot, toast-copy check.

**T025 — Parents tab**
Objective: Parent rows with linked-student `AvatarGroup`, invite status, `MoreMenu` → Edit links, Resend invite, Remove (unlink + deactivate, `AlertDialog`) — ROS-04.
Allowed files: `src/pages/roster/ParentsTab.tsx`.
Acceptance: Remove confirms via `AlertDialog` (DES-11); no parent sees another family's data (SEC-01 spot check).
Evidence: screenshot, AlertDialog walkthrough.

**T026 — Teams tab (CRUD + archive)**
Objective: Manage teams (name, short_name, program FRC/FTC/Other, color chip, sort order) — ROS-06; archive not delete by default; hard delete via `AlertDialog` only when no students/history.
Allowed files: `src/pages/roster/TeamsTab.tsx`.
Acceptance: archived teams disappear from selectors/expected rosters but keep history; hard-delete path blocked when history exists.
Evidence: archive/delete walkthrough screenshots.

**T027 — Invites tab**
Objective: All invites with status (Pending/Accepted/Expired), sent `Timestamp`, Resend/Revoke actions — ROS-07, using `send-invite` (T017).
Allowed files: `src/pages/roster/InvitesTab.tsx`.
Acceptance: status badge matches AUTH-06 expiry rule (14 days); Revoke sets `invites.status='revoked'` and audit-logs (DATA-02).
Evidence: status-transition walkthrough, audit_log row check.

**T028 — Roster admin toggles**
Objective: Admin-only toggles on `/roster`: leaderboard privacy ("Show first name + last initial publicly", default on) and season default goal shortcut link (ROS-08).
Allowed files: `src/pages/roster/AdminToggles.tsx`.
Acceptance: toggle persists and is read by T044's leaderboard; SEC-04 default-on privacy respected.
Evidence: toggle-persistence check, leaderboard-name-format screenshot.

**T029 — Season management `/settings/season`**
Objective: Admin-only create/edit seasons (name, start/end `DateRangeInput`, default goal hours), set active season, exactly-one-active enforced with `AlertDialog` on switch — SET-04.
Allowed files: `src/pages/settings/SeasonSettings.tsx`.
Acceptance: DB constraint/UI both enforce single active season; switching active season confirms via `AlertDialog` (DES-11).
Evidence: switch-season walkthrough, constraint violation test.

### E5 — Meetings + check-in (MTG-01…14, DES-01, NFR-05)

**T030 — `/meetings` list**
Objective: coach `Section` Upcoming/Past `Item` rows (date, time range, team scope, status `Badge`, past attendance summary); student/parent variant = own history + participation % (MTG-01). Actions: Schedule meetings, row `MoreMenu` (Edit, Cancel via `AlertDialog`).
Allowed files: `src/pages/meetings/MeetingsList.tsx`.
Acceptance: BEH-08 dates carry weekday names and computed durations; NAV-07 — this route never mixes in outreach items; DES-12 four states.
Evidence: screenshot both role variants, DES-12 state walkthrough.

**T031 — Schedule meetings dialog**
Objective: `Dialog purpose="form"` per MTG-02 field order (title, team scope `MultiSelector`, location, schedule mode `SegmentedControl`, date/time pickers, weekday checklist for recurring, notes); creates one `events` row + one `event_sessions` row per date; disabled until title + ≥1 valid date.
Allowed files: `src/pages/meetings/ScheduleMeetingsDialog.tsx`.
Acceptance: field order matches MTG-02 exactly; confirm button states computed outcome (BEH-07, e.g. "Create 14 meetings" — bare "Create" is checker MAJOR); nothing persisted until confirm.
- **Amended 2026-07-17 (T010 MINOR follow-up):** resolve `event_sessions.notes` nullability. T010's migration defines `notes text not null` with no default, following a literal reading of PRD 8.1's "no null-marker = NOT NULL" rule — but MTG-02's own field spec doesn't require notes to enable the "Create meetings" button, implying it's optional. This task's `event_sessions` INSERT must either always supply a value (even an empty string) or this task must ship a small additive migration making the column nullable/defaulted — do not edit T010's migration file per constitution item 10. Flag the choice explicitly in this task's worker output.
Evidence: field-order screenshot, button-copy check across recurrence modes; explicit note of the `event_sessions.notes` nullability resolution and why.

**T032 — `checkin` Edge Function**
Objective: HMAC-SHA256(sessionId + 60s bucket, `CHECKIN_HMAC_SECRET`) token + derived 6-char short code (MTG-06); validates current/previous bucket (≤2 min), session liveness, team scope; upserts `attendance` (`method='qr'`); auto present/late per 10-min grace (OQ-3); idempotent duplicate check-in (MTG-09); short-code rate limit 5/min/user.
Allowed files: `supabase/functions/checkin/**`.
Acceptance: secret never in frontend bundle (constitution item 5, BLOCKER); coach `method='coach'` rows never overwritten by QR writes (MTG-11); expired/invalid tokens produce DES-16-style error payload.
Evidence: unit tests for token validity window, grace-period boundary, override-precedence, rate limit.

**T033 — Live console `/meetings/live/:sessionId`**
Objective: Two-pane layout (QR panel + roster) per 4.2 wireframe; roll-call `SegmentedControl` [Present|Late|Excused|Absent] per row (MTG-11); coach-only excused (MTG-12); Realtime subscription on `attendance` for the session (NFR-05, ≤2s update).
Allowed files: `src/pages/meetings/LiveConsole.tsx`.
Acceptance: full keyboard path — arrow through roster rows, 1–4 keys set status on focused row (DES-17, BLOCKER if broken); `aria-live="polite"` on tally; coach override always wins over QR (MTG-11).
Evidence: keyboard walkthrough recording/notes, Realtime latency measurement, override-precedence test.

**T034 — Kiosk view `/kiosk/:sessionId`**
Objective: Fullscreen QR + short code + live tally, no student names (privacy) — MTG-07.
Allowed files: `src/pages/meetings/Kiosk.tsx`.
Acceptance: zero PII rendered (SEC-04, constitution item 6, BLOCKER if a name leaks); `aria-live` tally; code refreshes ~45s client-side.
Evidence: DOM grep for any name field, screenshot.

**T035 — `/checkin` result screen + Check-in Bolt**
Objective: Three end states (success/already-in/error) per 7.1 wireframe; DES-01 Bolt animation (~400ms draw-in, accent flash, "You're in" + Timestamp + running tally); respects `prefers-reduced-motion` (instant state, no draw-in).
Allowed files: `src/pages/checkin/CheckinResult.tsx`.
Acceptance: this is the only orchestrated animation in the app (DES-02 — no gradients/glows elsewhere); reduced-motion path verified; error copy matches DES-16 pattern verbatim style ("what happened + what to do").
Evidence: reduced-motion toggle test, three-state screenshots, copy check.

**T036 — End meeting flow**
Objective: "End meeting" button → `AlertDialog` summary ("14 present · 2 late · 1 excused · 1 absent") → sets session `completed`, backfills `absent` for no-attendance roster members, sets `check_out_at=end_time` for open check-ins (MTG-13); attendance remains coach-editable post-completion (audit-logged, DATA-02).
Allowed files: `src/pages/meetings/EndMeetingDialog.tsx`.
Acceptance: summary counts match live roster state at click time; post-completion edits write `audit_log`.
Evidence: end-to-end walkthrough with count verification, audit_log row check.

**T037 — Student/parent meeting view + consistency strip**
Objective: `/meetings` read-only history for students (own) and parents (per linked student) + participation % from `v_student_participation` (T013); render last 5 completed meetings as `StatusDot`s per DES-05 (BEH-06 "consistency strip").
Allowed files: `src/pages/meetings/StudentMeetingView.tsx`.
Acceptance: **constitution item 17 / BEH-06** — no streak counters, no "don't break it" mechanics, excused marks never rendered as failures (BLOCKER if violated); participation % sourced from the view only, never recomputed in TS (constitution item 3).
Evidence: explicit check for absence of streak/counter copy or logic, view-vs-UI number cross-check.

### E6 — Outreach + RSVP + hours (OUT-01…08, CMP-01…03)

**T038 — `/outreach` list + season goal bar**
Objective: coach view: season goal `ProgressBar` (team total vs sum of goals) with BEH-01 milestone ticks at 25/50/75/100%, Upcoming (`AvatarGroup` signup counts)/Past sections, New outreach event action, Outreach nav badge (BEH-04) wired to real unanswered-RSVP count; student variant: own goal bar (BEH-01/BEH-02 confirmed+planned segments, never summed) + RSVP `SegmentedControl` per row (OUT-01, OUT-03 preview).
Allowed files: `src/pages/outreach/OutreachList.tsx`.
Acceptance: BEH-01 milestone `Toast` dedupes per device/season (localStorage); BEH-02 confirmed (accent) vs planned (lighter) segments never summed into one number; nav badge neutral styling only (BEH-04); NAV-07 no meeting items mixed in.
Evidence: milestone-toast dedupe test, badge-count cross-check against unanswered RSVPs, screenshot both role variants.

**T039 — New/edit outreach event dialog + competition flags**
Objective: `Dialog` per OUT-02 field order (title, description, location name+address, category, schedule mode, per-session times, people-reached placeholder, adult volunteers count+hours, team scope, share-to-calendar default on); type `Selector` exposes `counts_participation`/`counts_volunteer_hours` flags only for competitions (CMP-01/02); disabled until title + ≥1 dated session.
Allowed files: `src/pages/outreach/OutreachEventDialog.tsx`.
Acceptance: field order matches OUT-02 exactly; BEH-07 computed confirm button copy; competition flags hidden for non-competition events (CMP-02 — UI exposes them only for competitions).
- **Amended 2026-07-17 (T010 MINOR follow-up):** resolve `event_sessions.notes` nullability (same issue as T031's amendment — OUT-02's own field spec omits notes from the outreach event form entirely, stronger evidence it's optional than T031's case). This task's `event_sessions` INSERT must either always supply a value or a small additive migration must make the column nullable/defaulted (whichever task lands first — T031 or T039 — should do the migration once, not twice; coordinate via this note). Flag the choice explicitly in worker output.
Evidence: field-order screenshot, flag-visibility check across event types; explicit note of the `event_sessions.notes` nullability resolution and why.

**T040 — RSVP control**
Objective: Student `SegmentedControl` [Sign up|Maybe|Can't go] → `rsvps.status`, `responded_by=student`; editable until session start (OUT-03); helper text per BEH-09 ("You can change this until the event starts").
Allowed files: `src/pages/outreach/RsvpControl.tsx`.
Acceptance: confirmation states next system event per BEH-09 ("we'll remind you 2 days before"); control locks after session start.
Evidence: copy check, lock-after-start test.

**T041 — Outreach detail `/outreach/:eventId`**
Objective: `MetadataList` (when/where/scope/creator), per-session signup lists grouped Going/Maybe/Can't go/No response, plain Google Maps link, edit/cancel via `MoreMenu`, Copy link (NAV-08) — OUT-04.
Allowed files: `src/pages/outreach/OutreachDetail.tsx`.
Acceptance: unauthenticated/invalid ID renders DES-12 error state revealing nothing (NAV-08); Copy link toast "Link copied".
Evidence: invalid-ID walkthrough, copy-link toast check.

**T042 — Mark day complete dialog**
Objective: `Dialog` per OUT-05: attendee checklist pre-checked from `going` RSVPs, people-reached `NumberInput`, per-student hours override defaulting to session duration; confirm sets session `completed`, checked students get `attendance` rows (`method='coach'`, present), hours per MET-03; not reversible without audit-logged edit.
Allowed files: `src/pages/outreach/MarkDayCompleteDialog.tsx`.
Acceptance: BEH-07 confirm button states computed outcome ("Mark complete — 6 attended · 42 h"); hours computation matches MET-03 (verified against T013 view, not re-derived in TS).
Evidence: button-copy check, hours cross-check vs `v_student_hours`.

**T043 — Parent RSVP-on-behalf**
Objective: Parent sets linked student's RSVP (`responded_by=parent`); student sees "Mom signed you up" (`Timestamp`+responder) and may change it (OUT-06).
Allowed files: `src/pages/outreach/ParentRsvp.tsx`.
Acceptance: responder attribution renders correctly; student can override a parent-set RSVP.
Evidence: cross-role walkthrough (parent sets, student changes).

**T044 — Leaderboard**
Objective: `Section` on `/outreach`, top 10 by season volunteer hours, all roles; "First L." format when privacy toggle (T028) is on (default on) — OUT-08.
Allowed files: `src/pages/outreach/Leaderboard.tsx`.
Acceptance: SEC-04/ROS-08 — no last names when toggle on (BLOCKER if leaked); hours sourced from `v_student_hours` only.
Evidence: privacy-toggle-off/on screenshots, name-format grep.

### E7 — Calendar + ICS (CAL-01…05)

**T045 — `/calendar` month grid + filters + detail links**
Objective: Astryx `Calendar` month grid (`weekStartsOn="sun"`) + chronological session list, filter `SegmentedControl` All|Meetings|Outreach|Competitions, dots colored per DES-04, click-through to session detail routes (CAL-01/02).
Allowed files: `src/pages/calendar/CalendarPage.tsx`.
Acceptance: BEH-08 date/duration rendering everywhere sessions appear; this route is one of the two permitted combined-type list surfaces (NAV-07) and every row carries a type `Badge`.
Evidence: screenshot with filter states, prop cross-check.

**T046 — Subscribe popover + reset link**
Objective: `Popover` with personal ICS URL, Copy link, "Add to Google Calendar" helper text, Reset link (`AlertDialog`, revokes old token) — CAL-03.
Allowed files: `src/pages/calendar/SubscribePopover.tsx`.
Acceptance: BEH-09 — popover states what the feed contains; reset confirms via `AlertDialog` and invalidates the prior URL.
Evidence: reset-invalidation test, copy check.

**T047 — `ics` Edge Function**
Objective: `GET /functions/v1/ics?token=<uuid>` returning `text/calendar`, `X-WR-CALNAME: VOLT`, 6h refresh interval, 30-days-past→all-future role-scoped `VEVENT`s, canceled sessions as `STATUS:CANCELLED` — CAL-04/05. **Must use `ical-generator`; hand-built VCALENDAR strings are a checker BLOCKER.**
Allowed files: `supabase/functions/ics/**`.
Acceptance: uses `ical-generator` (grep for manual VCALENDAR string concatenation → BLOCKER if found); role scoping matches 8.3 matrix (students team-scoped, parents linked-only, staff all); feed validates (parses without error).
Evidence: dependency grep, feed-parse test output, role-scoping test per role.

### E8 — Email + scheduling (EML-01…05)

**T048 — Resend integration + branded layout + `email_log`**
Objective: Shared branded layout (wordmark, violet accent, manage-preferences footer link), sender `VOLT Robotics <notifications@mail.voltfrc.org>`, every send logged to `email_log` — EML-01. **Test-mode sending only; production requires T052 sign-off (constitution item 7).**
Allowed files: `src/emails/layout/**`, wiring in `supabase/functions/send-invite/**` (extend, not new function).
Acceptance: no live sends outside Resend test mode (BLOCKER if violated per constitution item 7); every send writes `email_log`.
Evidence: `email_log` row check, Resend test-mode confirmation.

**T049 — Transactional email templates**
Objective: invite, signup-confirm, event-reminder-48h, event-reminder-3h, meeting-reminder-3h templates (EML-02 table rows 1–5).
Allowed files: `src/emails/templates/{invite,signup-confirm,event-reminder-48h,event-reminder-3h,meeting-reminder-3h}.tsx`.
Acceptance: BEH-08 date rendering in email bodies (weekday names, computed durations); copy fidelity to DES-14 voice; no other-student data leakage (EML-05).
Evidence: rendered-template side-by-side vs spec, copy fidelity check.

**T050 — Weekly digest template**
Objective: `weekly-digest` template, per-kid last-week attendance, hours vs goal, next week's schedule (EML-02 row 6), Sundays 5pm CT.
Allowed files: `src/emails/templates/weekly-digest.tsx`.
Acceptance: **EML-05** — a parent digest covers only linked students, never another family's data (BLOCKER if violated); hours/participation sourced from T013 views; BEH-01/BEH-02 rules apply to any progress display in the email (no inflated totals).
Evidence: multi-child rendering test, cross-family leakage check.

**T051 — `send-reminders` Edge Function + `pg_cron` + dedupe**
Objective: `pg_cron` every 15 min invokes `send-reminders`; selects due sessions, expands recipients, filters `notification_prefs`, dedupes against `email_log` (never same template+session+recipient twice), batches to Resend — EML-03.
Allowed files: `supabase/functions/send-reminders/**`, `supabase/migrations/<timestamp>_cron.sql`.
Acceptance: dedupe is a correctness requirement not an optimization (constitution item 7) — duplicate-send test must show zero duplicates; preference filtering respected.
Evidence: dedupe test (re-run same window twice, assert no duplicate `email_log` rows), preference-filter test.

**T052 — HUMAN GATE — production email enablement**
Objective: George reviews T048–T051 test-mode output and approves flipping Resend out of test mode for `mail.voltfrc.org`.
Allowed files: none (approval only, recorded by boss-architect in this ledger row).
External blocker: requires George's `mail.voltfrc.org` Resend domain verification (SPF/DKIM/DMARC) — cannot proceed until DNS is verified.
Acceptance: George's explicit sign-off recorded (constitution item 16); no automated checker may approve this.
Evidence: sign-off record (name, date, method) in this row's Last Result.

### E9 — Reports + CSV + Home dashboards (RPT-01…06, HOME-01…04, SET-01…03)

**T053 — Coach/Admin Home**
Objective: `Analytics Dashboard` template base; KPI cards (team participation %, hours-vs-goal bar, last-meeting attendance rate, next-7-days count); Start check-in / New outreach event actions; Next up (5 sessions); Recent signups (last 10 RSVP changes) — HOME-01; Admin adds Season-setup shortcut card when active season lacks goals/teams (HOME-04).
Allowed files: `src/pages/home/CoachHome.tsx`.
Acceptance: **BEH-05** one metric per Card, never two equal-weight numbers in one card; **BEH-01** milestone ticks on the hours-vs-goal bar; template base used, not invented layout (constitution item 13).
Evidence: card-by-card metric-count check, screenshot.

**T054 — Student Home**
Objective: mobile-first; live-meeting check-in card (MTG-10, wired into T008's slot) with 6-char code entry; hours `ProgressBar` (MET-04) + participation % (MET-01); Next up = `going` sessions; Sign-up opportunities with inline Sign up/Can't go — HOME-02.
Allowed files: `src/pages/home/StudentHome.tsx`.
Acceptance: **BEH-03** hero resolves to exactly one primary CTA by priority (live check-in → oldest unanswered RSVP → quiet greeting), never two primary Buttons; **BEH-02** confirmed/planned hours never summed; check-in path reuses T032's validation, not a re-implementation.
Evidence: hero-CTA priority test across three states, screenshot.

**T055 — Parent Home**
Objective: one Card per linked student (name+team badge, hours bar, participation %, next 3 events + RSVP-on-behalf), footer digest note — HOME-03.
Allowed files: `src/pages/home/ParentHome.tsx`.
Acceptance: **constitution item 17 / BEH-06** — if a meeting-history element is shown per student, no streak counters/loss-aversion framing; RSVP-on-behalf control reuses T043.
Evidence: per-child data isolation check (SEC-01), copy/mechanics audit for BEH-06.

**T056 — `/reports` shell + Participation tab**
Objective: `TabList` Participation|Hours|Events (RPT-01); Participation tab: `Grouped Table`-style, grouped by team, meetings expected/present/late/excused, participation % with `ProgressBar`, `PowerSearch` (team/below-% threshold/name), "below 70%" quick filter chip (RPT-02, answers P-COACH2).
Allowed files: `src/pages/reports/ReportsShell.tsx`, `src/pages/reports/ParticipationTab.tsx`.
Acceptance: below-70% chip returns correct rows against `v_student_participation`; coach/admin-only route (RPT-06); template = `Grouped Table` as-is.
Evidence: P-COACH2 scenario walkthrough ("which students are below 70%?" answered without export).

**T057 — Hours tab**
Objective: student, team, confirmed hours, planned hours (future `going` × duration), goal, % to goal `ProgressBar`, team subtotals, season totals for people reached / adult volunteers — RPT-03.
Allowed files: `src/pages/reports/HoursTab.tsx`.
Acceptance: **BEH-01/BEH-02** milestones + confirmed-vs-planned never summed; numbers sourced from `v_student_hours`, never recomputed.
Evidence: view-vs-UI number cross-check.

**T058 — Events tab**
Objective: all sessions with type, date, attendance/signup counts, hours awarded, people reached, adult volunteers, status — RPT-04.
Allowed files: `src/pages/reports/EventsTab.tsx`.
Acceptance: type `Badge` per row (NAV-07 combined-list exception); data matches underlying session/attendance tables.
Evidence: row-count cross-check vs DB.

**T059 — CSV exports**
Objective: `roster.csv`, `events.csv`, `attendance.csv`, `hours_by_student.csv`, client-generated from the same report queries, UTF-8, header row, ISO dates; columns superset of old app's exports (RPT-05).
Allowed files: `src/pages/reports/csvExport.ts`.
Acceptance: opens correctly in Excel/Sheets simulation (header row, ISO dates, UTF-8 BOM if needed); parity check against old CSV column list from PRD 10.1.
Evidence: generated CSV sample + header diff vs old export columns.

**T060 — `/settings` screen**
Objective: Sections per SET-01 (Profile w/ `FileInput` avatar upload, Appearance, Notifications, Calendar feed, Danger zone/sign-out-everywhere); Notifications = `Switch` per EML-02 category + parent digest toggle (SET-02); Appearance = `RadioList` System/Light/Dark → `theme_mode` (SET-03); Calendar feed section reuses T046's Subscribe control.
Allowed files: `src/pages/settings/SettingsPage.tsx`.
Acceptance: Settings template as-is, section order per SET-01; theme choice persists to `profiles.theme_mode`; every email footer's manage-preferences link lands here (EML-04).
Evidence: section-order screenshot, theme-persistence test.

### E10 — Migration (MIG-01…06)

**T061 — Schema verification + mapping doc copy**
Objective: Introspect the live old project, diff against PRD 10.1 (MIG-01); copy Section 10.2 verbatim to `docs/migration/mapping.md` (MIG-02).
Allowed files: `docs/migration/source-schema.md`, `docs/migration/mapping.md`.
Acceptance: any drift from 10.1 halts and is documented for boss review, not silently reconciled; mapping doc is an unchanged copy of 10.2.
Evidence: diff report, mapping.md-vs-PRD-10.2 comparison.

**T062 — ETL script `scripts/migrate.ts`**
Objective: Idempotent script using service-role keys (env-provided, never committed) for both projects, natural-key upserts, `--dry-run` mode printing per-table counts + migration report (unmatched teams, unparseable times, attendees-backfill mismatches) — MIG-03.
Allowed files: `scripts/migrate.ts`, `scripts/migrate/**`.
Acceptance: no service-role key committed (constitution item 5, BLOCKER); dry-run writes nothing; column mapping matches T061's `mapping.md` exactly, including the `session_attendance.planned` split (→`rsvps` vs `attendance`) and `hours_override` always-set rule from 10.2.
Evidence: dry-run report output, `.env*`/secret grep, mapping-vs-script cross-check.

**T063 — HUMAN GATE — MIG-04 validation gates + sign-off**
Objective: Per-table row counts match; per-student confirmed hours in `v_student_hours` ≡ old `student_hour_summary.attended_hours`; per-event totals ≡ old `event_hour_summary`; adult volunteer sums match; George spot-checks 5 students.
Allowed files: none (validation report may be produced by T062's dry-run tooling; this row is the approval gate itself).
Acceptance: George's explicit sign-off recorded (constitution item 16) after reviewing the validation report; no checker agent may pass this on its own.
Evidence: validation report (row counts, hours reconciliation) + George's sign-off record.

**T064 — Roster → accounts post-migration verification**
Objective: Confirm migrated students land with `profile_id=null` and that George can add emails via Roster → Send invite afterward without breaking coach-side features (AUTH-07) — MIG-05.
Allowed files: none beyond a verification note attached to this task's evidence (no code change expected; if a gap is found, file a follow-up task rather than editing migration/roster code here).
Acceptance: post-migration roster is fully usable coach-side pre-invite; invite flow (T017/T019) works unmodified against migrated rows.
Evidence: walkthrough: migrated student → send invite → accept → profile linked correctly.

**T065 — HUMAN GATE — MIG-06 cutover**
Objective: Old app stays live/read-only until T063 passes with sign-off; then retire the Lovable link and rotate/pause the old project's keys (its `anon` policies are world-writable and the repo is public).
Allowed files: none (operational action outside the repo; ledger records completion).
Acceptance: George's explicit sign-off recorded (constitution item 16); old project keys rotated/paused only after sign-off, never before.
Evidence: sign-off record + confirmation old project keys were rotated/paused.

### E11 — Polish + a11y + smoke (DES-12/15/16, NFR-02/06/07)

**T066 — Playwright persona smoke tests**
Objective: P-COACH, P-STUDENT, P-COACH2, P-PARENT (Section 3) + login + RLS-denial (student fetching another student's attendance gets zero rows) — NFR-02.
Allowed files: `tests/e2e/**`, `playwright.config.ts`.
Acceptance: all four persona flows pass on a production build, both color modes; RLS-denial assertion present and passing; matches PRD Section 14 acceptance criteria #1, #3, #4, #9.
Evidence: Playwright report (all suites), RLS-denial assertion output.

**T067 — Accessibility sweep**
Objective: WCAG 2.1 AA sign-off across every screen, both modes (NFR-07/DES-17), superseding/aggregating the per-screen checks already done during E1–E9.
Allowed files: none expected (fixes for findings go back to the owning screen's file, tracked as follow-up tasks per constitution's MINOR rule — this task itself is the audit).
Acceptance: keyboard path complete on every core flow (BLOCKER class per constitution if any core flow fails); contrast AA both modes; visible focus everywhere; `aria-live` regions correct.
Evidence: per-screen checklist results, contrast measurements, keyboard-walkthrough log.

**T068 — Responsive sweep 375–1440px**
Objective: Verify layouts 375px→1440px, coach console usable on phone (panes stack, QR collapses behind a button) — NFR-06.
Allowed files: none expected (findings → follow-up tasks on owning screens).
Acceptance: no horizontal scroll/clipping at any breakpoint in the range; live console specifically verified on a phone-width viewport.
Evidence: viewport screenshots at 375/768/1024/1440px per screen.

**T069 — Empty/error state copy audit**
Objective: Verify every async list screen implements all four DES-12 states and that empty/error copy matches the DES-15/16 verbatim defaults where specified.
Allowed files: none expected (findings → follow-up tasks on owning screens).
Acceptance: DES-15 empty-state copy matches verbatim examples where the PRD gives exact text; DES-16 error copy states what happened + what to do, no apologies; happy-path-only screens flagged MAJOR.
Evidence: screen-by-screen copy checklist vs DES-15/16.

**T070 — HUMAN GATE — Vercel domain go-live**
Objective: George approves cutting `portal.voltfrc.org` over to the production Vercel deployment after T066–T069 pass.
Allowed files: none (operational action; ledger records completion).
External blocker: requires George's Vercel CNAME record for `portal.voltfrc.org` (OQ-4) — cannot go live until DNS is in place.
Acceptance: George's explicit sign-off recorded (constitution item 16); smoke tests (T066) and a11y/responsive/copy sweeps (T067–T069) all Passed first.
Evidence: sign-off record + production URL smoke check.
