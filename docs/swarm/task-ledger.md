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
| T002a | E1 | React 18→19 upgrade (D002 corrective task) | worker-implementer | checker-tests | T002 | 1 | Needs Rework | FAIL/MAJOR (checker-tests, attempt 1): React 19 upgrade itself fully verified sound — clean install with no `--legacy-peer-deps`, `npm ls` clean, `react.use()` confirmed a function, build/typecheck/lint exit 0, mandatory runtime smoke test (vitest+jsdom, real render of Theme+App, asserts h1 text) passes. Sole gap: `npm run format:check` exits 1 on `src/theme/volt.ts` — pre-existing bracket-spacing drift between verbatim DES-03 block and `.prettierrc.json` defaults, confirmed by checker via git-show to predate T002a (traces to T002). Fix = narrow the `format`/`format:check` glob in `package.json` (already an Allowed File) to exclude `src/theme/volt.ts`; do NOT edit `volt.ts` content. Rework dispatched. | No |
| T003 | E1 | CSS cascade layers + `theme.css` build pattern | worker-implementer | checker-tests | T002,T002a | 0 | Blocked | Reverted Ready→Blocked per D002: T003 builds `theme.css` from the same theme system and must wait for the React 19 upgrade (T002a) to land first. | No |
| T004 | E1 | CI pipeline (typecheck/lint/unit/build + bundle budget) | worker-implementer | checker-tests | T001,T002,T003 | 0 | Blocked | None | No |
| T005 | E1 | Router skeleton + route guards + deep-link redirect | worker-implementer | checker-reviewer | T001 | 0 | Ready | None | No |
| T006 | E1 | AppShell + TopNav | worker-implementer | checker-accessibility | T002,T005 | 0 | Blocked | None | No |
| T007 | E1 | SideNav (role-filtered) + outreach badge scaffold | worker-implementer | checker-accessibility | T006 | 0 | Blocked | None | No |
| T008 | E1 | MobileNav drawer + Student Home live-card slot | worker-implementer | checker-accessibility | T006,T007 | 0 | Blocked | None | No |
| T009 | E2 | Migration: identity/roster tables | worker-implementer | checker-tests | T001 | 0 | Passed | PASS (1st attempt, MINOR finding, non-blocking): checker-tests verified all 5 tables (profiles, teams, seasons, students, guardian_links) column-by-column against PRD 8.1 ground truth — zero deltas; id/created_at/FK-restrict conventions correct; `seasons` partial unique index on `(is_active) where true` verified correct via static SQL review; no RLS/policy statements present (correctly out of scope, T012's job); constitution item 10 confirmed (exactly one migration file exists); `role_enum` placement judged reasonable with a forward note that future migrations must reuse, not redefine, the type. MINOR: `profiles.avatar_url text not null` with no default is a genuine PRD 8.1 ambiguity (SET-01 implies avatar upload is a post-creation settings action) that would block INSERT into `profiles` until resolved — not a worker error, tracked as an amended acceptance criterion on T019 (see T019 detail block below), not a new task. | No |
| T010 | E2 | Migration: scheduling/attendance tables | worker-implementer | checker-tests | T009 | 0 | Ready | Unblocked: T009 Passed 2026-07-16. | No |
| T011 | E2 | Migration: support tables + audit triggers (DATA-02) | worker-implementer | checker-tests | T010 | 0 | Blocked | None | No |
| T012 | E2 | RLS helper functions + policies (verbatim 8.4) | worker-implementer | checker-tests | T009,T010,T011 | 0 | Blocked | None | No |
| T013 | E2 | Metric views (verbatim 8.4) | worker-implementer | checker-tests | T010,T012 | 0 | Blocked | None | No |
| T014 | E2 | NFR-03 metric-view fixture tests | worker-implementer | checker-tests | T013 | 0 | Blocked | None | No |
| T015 | E3 | Supabase Auth provider config | worker-implementer | checker-tests | T012 | 0 | Blocked | None | No |
| T016 | E3 | `/login` screen | worker-implementer | checker-accessibility | T006,T015 | 0 | Blocked | None | No |
| T017 | E3 | `send-invite` Edge Function | worker-implementer | checker-reviewer | T009,T012 | 0 | Blocked | None | No |
| T018 | E3 | `/accept-invite` screen | worker-implementer | checker-accessibility | T016,T017 | 0 | Blocked | None | No |
| T019 | E3 | DB trigger: invite acceptance → profile/link | worker-implementer | checker-reviewer | T017,T009 | 0 | Blocked | None | No |
| T020 | E3 | AUTH-04 uninvited path + RLS-denial test | worker-implementer | checker-tests | T012,T018,T019 | 0 | Blocked | None | No |
| T021 | E4 | `/roster` shell + TabList | worker-implementer | checker-accessibility | T007,T019 | 0 | Blocked | None | No |
| T022 | E4 | Students tab table + row actions | worker-implementer | checker-accessibility | T021,T009 | 0 | Blocked | None | No |
| T023 | E4 | Add/edit student dialog | worker-implementer | checker-reviewer | T022 | 0 | Blocked | None | No |
| T024 | E4 | Invite parent dialog | worker-implementer | checker-reviewer | T022,T017 | 0 | Blocked | None | No |
| T025 | E4 | Parents tab | worker-implementer | checker-accessibility | T021 | 0 | Blocked | None | No |
| T026 | E4 | Teams tab (CRUD + archive) | worker-implementer | checker-accessibility | T021 | 0 | Blocked | None | No |
| T027 | E4 | Invites tab | worker-implementer | checker-accessibility | T021,T017 | 0 | Blocked | None | No |
| T028 | E4 | Roster admin toggles (ROS-08) | worker-implementer | checker-reviewer | T021 | 0 | Blocked | None | No |
| T029 | E4 | Season management `/settings/season` | worker-implementer | checker-reviewer | T021,T009 | 0 | Blocked | None | No |
| T030 | E5 | `/meetings` list | worker-implementer | checker-accessibility | T007,T019 | 0 | Blocked | None | No |
| T031 | E5 | Schedule meetings dialog | worker-implementer | checker-reviewer | T030 | 0 | Blocked | None | No |
| T032 | E5 | `checkin` Edge Function (HMAC rotating token) | worker-implementer | checker-tests | T010,T012 | 0 | Blocked | None | No |
| T033 | E5 | Live console `/meetings/live/:sessionId` | worker-implementer | checker-accessibility | T031,T032 | 0 | Blocked | None | No |
| T034 | E5 | Kiosk view `/kiosk/:sessionId` | worker-implementer | checker-accessibility | T032 | 0 | Blocked | None | No |
| T035 | E5 | `/checkin` result screen + Check-in Bolt | worker-implementer | checker-accessibility | T032 | 0 | Blocked | None | No |
| T036 | E5 | End meeting flow (MTG-13) | worker-implementer | checker-reviewer | T033 | 0 | Blocked | None | No |
| T037 | E5 | Student/parent meeting view + consistency strip | worker-implementer | checker-reviewer | T030,T013 | 0 | Blocked | None | No |
| T038 | E6 | `/outreach` list + season goal bar | worker-implementer | checker-accessibility | T007,T019 | 0 | Blocked | None | No |
| T039 | E6 | New/edit outreach event dialog + competition flags | worker-implementer | checker-reviewer | T038 | 0 | Blocked | None | No |
| T040 | E6 | RSVP control (OUT-03) | worker-implementer | checker-reviewer | T039 | 0 | Blocked | None | No |
| T041 | E6 | Outreach detail `/outreach/:eventId` | worker-implementer | checker-accessibility | T039,T040 | 0 | Blocked | None | No |
| T042 | E6 | Mark day complete dialog (OUT-05) | worker-implementer | checker-reviewer | T041 | 0 | Blocked | None | No |
| T043 | E6 | Parent RSVP-on-behalf (OUT-06) | worker-implementer | checker-reviewer | T040 | 0 | Blocked | None | No |
| T044 | E6 | Leaderboard (OUT-08) | worker-implementer | checker-reviewer | T038,T013 | 0 | Blocked | None | No |
| T045 | E7 | `/calendar` month grid + filters + detail links | worker-implementer | checker-accessibility | T030,T038 | 0 | Blocked | None | No |
| T046 | E7 | Subscribe popover + reset link (CAL-03) | worker-implementer | checker-reviewer | T045 | 0 | Blocked | None | No |
| T047 | E7 | `ics` Edge Function via `ical-generator` | worker-implementer | checker-tests | T045,T010 | 0 | Blocked | None | No |
| T048 | E8 | Resend integration + branded layout + `email_log` | worker-implementer | checker-reviewer | T017 | 0 | Blocked | None | No |
| T049 | E8 | Transactional email templates | worker-implementer | checker-content | T048 | 0 | Blocked | None | No |
| T050 | E8 | Weekly digest template | worker-implementer | checker-content | T048,T013 | 0 | Blocked | None | No |
| T051 | E8 | `send-reminders` Edge Function + `pg_cron` + dedupe | worker-implementer | checker-tests | T049,T050,T011 | 0 | Blocked | None | No |
| T052 | E8 | **HUMAN GATE** — production email enablement | — | human (George) | T051 | — | Blocked | None | — |
| T053 | E9 | Coach/Admin Home (HOME-01/04) | worker-implementer | checker-accessibility | T030,T038,T013 | 0 | Blocked | None | No |
| T054 | E9 | Student Home (HOME-02) | worker-implementer | checker-accessibility | T030,T032,T038,T013 | 0 | Blocked | None | No |
| T055 | E9 | Parent Home (HOME-03) | worker-implementer | checker-accessibility | T038,T037,T013 | 0 | Blocked | None | No |
| T056 | E9 | `/reports` shell + Participation tab | worker-implementer | checker-accessibility | T013,T014 | 0 | Blocked | None | No |
| T057 | E9 | Hours tab (RPT-03) | worker-implementer | checker-reviewer | T056,T013 | 0 | Blocked | None | No |
| T058 | E9 | Events tab (RPT-04) | worker-implementer | checker-reviewer | T056 | 0 | Blocked | None | No |
| T059 | E9 | CSV exports (RPT-05/06) | worker-implementer | checker-tests | T057,T058,T056 | 0 | Blocked | None | No |
| T060 | E9 | `/settings` screen (SET-01/02/03) | worker-implementer | checker-accessibility | T003,T011,T046 | 0 | Blocked | None | No |
| T061 | E10 | Schema verification + mapping doc copy (MIG-01/02) | worker-implementer | checker-reviewer | T009,T010,T011 | 0 | Blocked | None | No |
| T062 | E10 | ETL script `scripts/migrate.ts` (MIG-03) | worker-implementer | checker-tests | T061 | 0 | Blocked | None | No |
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
Evidence: field-order screenshot, button-copy check across recurrence modes.

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
Evidence: field-order screenshot, flag-visibility check across event types.

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
