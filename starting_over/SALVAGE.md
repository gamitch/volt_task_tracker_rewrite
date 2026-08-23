# Salvage — what to carry out of this repo, by path

"Start over" does not mean "type it all again." The first rewrite produced a
set of finished, proven artifacts that the rebuild ports rather than
re-derives. This file is the shopping list, in this repo at commit `5bf0cb7`.
Everything not listed here is presumed **not** carried.

## 1. Rules and reference (carry as documents)

| What | Where | How to carry |
|---|---|---|
| Owner rulings | consolidated in `starting_over/DECISIONS.md` | Already done — that file is the extract |
| Meetings design contract | `.claude/skills/meetings-design/SKILL.md` | Lift the domain rules into the rebuild's meetings work: chip format, Chicago bucketing, overlap semantics, DES-05 colors, 5-point no-urgency test, tap-to-cycle a11y contract |
| Visual craft reference | `docs/swarm/figures/ux-craft/*.webp` (`old-*` = the reference app) | Copy the figures directory; it is the binding density/alignment benchmark (S-4) |
| Org ground truth | `docs/backlog.html` §1–2 | Folded into PRD §2; keep the HTML for detail |
| Capability map of the old app | `docs/swarm/current-app-capability-map.md` + `.html` | Reference for coach-workflow parity — the edit-dialog attendance checklist is the workflow heart |

## 2. Database (carry as one squashed baseline)

The single most valuable asset. Port the **final** state of
`supabase/migrations/` (27 files) into **one baseline migration**:

- **15 tables**: profiles, teams, seasons, students, guardian_links,
  invites, events, event_sessions, rsvps, attendance, notification_prefs,
  calendar_feeds, email_log, audit_log, student_teams — with the rebuild's
  two deliberate changes: drop `students.team_id` (ROS-3: junction only, and
  ship its writer), and store recurrence rules on series (SCH-2).
- **RLS**: the three security-definer helpers (`auth_role()`, `is_staff()`,
  `my_student_ids()`), the uniform `staff_all` policy shape, `own_or_linked_read`,
  self-scoped prefs/feeds. Decide view security once (SEC-4): every view
  `security_invoker` or documented owner-bypass + `revoke all from anon`.
- **Views — final forms only**: `v_student_hours` (20260804 form:
  outreach-only, override-wins, clamped), `v_student_participation`
  (20260822 form: explicit marks, unmarked excluded, NULL not 0),
  `v_team_*`, `v_season_kpis`, goal projection, leaderboard (with privacy
  gate). Rename the lying `expected_ct` column to `marked_ct` — the rebuild
  is the one chance. Recompute session attendance rate against the expected
  roster (MET-6).
- **Keepers**: the `unmarked` sentinel (20260822), one-active-season and
  one-active-feed partial indexes, `leaderboard_privacy_enabled`, the
  invite-acceptance trigger design (but live-verify it this time), the
  anon-revoke discipline (20260803000001's lesson).
- **Leave behind**: the audit trigger machinery (D-9), comment-only
  migrations, the two dueling attendance-rate conventions, process prose in
  SQL comments.

## 3. Domain logic (port near-verbatim)

| What | Where | Notes |
|---|---|---|
| Check-in HMAC scheme | `supabase/functions/checkin/hmac.ts` | Pure, tested, exactly ATT-6. Port with its tests |
| Grace + liveness rules | `supabase/functions/checkin/grace.ts`, `liveness.ts` | ATT-5's implementation |
| Idempotent attendance upsert | `supabase/functions/checkin/index.ts` | onConflict(session_id,student_id), server-assigned status |
| Timezone discipline | `src/lib/meetings/format.ts` (`parseDateOnly`, chips, meridiem), `overlap.ts` | The noon-UTC/Chicago reasoning is hard-won; port as the **one** date module (NFR-6) |
| Meetings pure models | `src/lib/meetings/coachModel.ts` partition/build functions | Good shape (loader → pure model → view); strip the process comments |
| ICS builder | `supabase/functions/ics/ics_builder.ts` | Only if/when ICS returns post-launch |
| Email templates + dedupe design | `src/emails/*`, `send-reminders` email_log key `(template, session_id, to_email)` | Only if/when email returns post-launch |
| Theme tokens | `src/theme/volt.ts` | Accent pairs, on-accent, GoalBar fills, side-nav overrides — measured WCAG work, port verbatim (S-1) |

## 4. Test infrastructure (carry as-is, then promote to CI)

- **Persona e2e harness**: `tests/e2e-harness/` (real Postgres + PostgREST +
  JWT personas) and the `tests/e2e-personas/` spec patterns. This found the
  bugs everything else missed. Rebuild requirement: green on clean checkout,
  wired into CI from M0 (NFR-11).
- **Scratch-Postgres RLS suites**: `tests/rls/` and `supabase/tests/` —
  cheap, dependency-free, caught real security bugs (including anon DELETE
  through an updatable view). Port the runner pattern.
- **Mutation-replay discipline**: `.claude/skills/mutation-replay/` — keep
  the technique, scoped to the high-stakes zone (C-8).

## 5. Data (the real 341.75 hours)

- **ETL + runbook**: `scripts/migrate.ts`, `docs/migration/mapping.md`,
  `docs/migration/RUNBOOK.md`. Proven against live data on 2026-08-02
  (20 students, 4 teams, 16 events, 117 sessions, 254 RSVPs, 79 attendance
  rows = 341.75 hours, matching the signed-off dry run). Re-run against the
  fresh project per PRD §12 Q1; run the account-preserving teardown first.
- Known cleanups to fold into the re-run: any false `absent` rows T508 wrote
  before 2026-08-05, and the mixed test-data state in the current project.
- Still owed by George: ~20 student/guardian email addresses (the T064
  blocker) — without them accounts can never link.

## 6. UI designs worth rebuilding to (not copying code)

- The **student/parent meetings view** (GAM-451, `src/pages/meetings/student/`)
  shipped complete and browser-verified — rebuild to its design directly.
- The **series-card coach meetings page** (S-3) — the model is right; the
  rebuild ships it *with* its roster loader and palette this time.
- The **role dispatcher** (`src/pages/home/DashboardPage.tsx`) — the one
  dashboard file that stayed simple; copy the pattern.
- The **2026-08-21 dashboard visual language** (gradient metric cards,
  accent goal card, eyebrow + display H1) — from the design canvas and PR
  #220, per PRD §9.
- The chromeless-route handling pattern in `src/app/AppShell.tsx`
  (matchPath, not `===`).

## 7. Explicitly left behind

- All of `docs/swarm/` process machinery (ledgers, verification logs,
  packets, dispute log, kickoff prompts, the 1,223-line constitution) —
  mined already; `LESSONS.md`/`DECISIONS.md` are the extract.
- The Linear dispatch pipeline (`supabase/functions/linear-dispatch/`,
  5 of 6 GitHub workflows), tier labels, declaration gates.
- The injectable fixture-default loader seams, back-compat re-export shims,
  `PLACEHOLDER_*` constants, and the ~50k LOC jsdom suite (NFR-11 replaces
  it).
- The 131 open Linear issues (PRD §12 Q13): mass-close with a `rebuild`
  label; their ~30 real domain findings are already encoded in PRD §5/§10.
- `src/` wholesale. Individual pure modules listed in §3 are the exceptions.
