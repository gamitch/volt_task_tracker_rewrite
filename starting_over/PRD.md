# VOLT Team Portal — Rebuild PRD (v1.0)

**Status: v1.1 — ratified by George 2026-08-26 (all §12 decisions
answered). Ready to build.**
This PRD starts the project over. It replaces `VOLT_Portal_PRD.md` (v1.5),
`VOLT_Portal_PRD_v2.md`, and `VOLT_UX_Craft_PRD_v3.md`. It keeps everything
those documents learned — the domain rules, the owner rulings, the design
language — and discards their scope and their process. Companion documents:
`DECISIONS.md` (binding rulings, cited here as P-x/D-x/S-x/PR-x), `LESSONS.md`
(why the first rewrite failed), `CONSTITUTION.md` (how the rebuild works),
`SALVAGE.md` (what to carry over, by file path).

The two rules this document holds itself to, because their absence killed the
last one:

1. **It stays one document.** Changes edit the text in place; the changelog
   at the bottom records what changed and why. No layered supersessions
   across files.
2. **It specifies outcomes, not layouts.** What each role must be able to
   do, what each number must equal, what each flow must survive. Visual
   craft has a reference standard (§9) and a design pass per milestone — not
   ASCII wireframes with normative field order.

---

## 1. Mission

A private, role-aware portal for the VOLT robotics program (FRC Team 11195
and sibling FTC/FLL teams) that:

- tracks **meeting attendance** as a participation percentage,
- tracks **outreach volunteering** as hours toward season goals,
- keeps those two ideas cleanly separate everywhere (D-1),
- makes recording attendance easy enough that it actually happens — coach
  roll-call first, student self check-off second (D-10; the QR/kiosk path
  is retired to post-launch, R-2),
- and keeps students informed without nagging them (P-4) — parents join
  post-launch (R-3).

It replaces volt-timetracker.lovable.app, whose workflow the team likes and
whose total lack of authentication — children's names, teams, and hours
world-readable — is the single worst thing this project exists to fix (P-1).

**The bar for "done" is not features. It is: George runs a real meeting and a
real outreach event through the deployed app, and every number that results
is correct on every screen that shows it.**

## 2. Who it's for

| Persona | Device | Needs |
|---|---|---|
| **Admin / head coach** (George) | desktop | Runs everything: roster, seasons, events, attendance, reports. |
| **Coaches / mentors** (2–5) | desktop + phone | Schedule events, run check-in/roll-call, correct attendance, read the dashboard. |
| **Students** (~20, ages 13–18) | phone | RSVP to outreach, self-report attendance they missed recording, watch their own hours and participation. |
| **Parents** *(post-launch, R-3)* | phone + email | See their own kids' events, attendance, and progress; RSVP on a kid's behalf. |

Org ground truth (carried from `docs/backlog.html` §1 — it lives in no code
file): VOLT FRC 11195, P3 FTC 16751, Gear Girls FTC 23469, plus five
student-coached FLL teams meeting at external venues. Dual team membership is
real (D-4). Seasons overlap across programs but the portal runs **one
combined season** (D-3). Adult mentor hours are tracked off-app. Scouting is
out of scope.

Two realities from the old app that the rebuild must respect:

- **Coach-managed attendance is the workflow heart.** The edit-event dialog
  with a per-student attendance checklist and hour override is what the team
  actually uses. Any design where attendance only happens if students act
  will fail (D-10).
- **Young students don't manage accounts well.** Retroactive self check-off
  must be one tap on a phone, and coach features must work for students who
  have no account at all (account-less roster rows are first-class).

## 3. The product in one page

Two loops and a read layer:

**The meetings loop.** A coach schedules a recurring meeting series (e.g.
"Build season — Mon/Thu 6–8 PM"). Sessions materialize from the stored
recurrence rule. At a meeting the coach runs roll-call: tap a student,
cycle present → late → excused → absent → unmarked. Ending a meeting
records exactly what was marked (D-7). Completed meetings produce each
student's **participation %** (§5), and don't produce volunteer hours
unless an admin opts a specific meeting in (D-2b).

**The outreach loop.** A coach creates an outreach event (single or
multi-day) with expected attendees. Students RSVP; the coach can RSVP on
anyone's behalf (D-5). After each day the coach "marks the day complete,"
checking who attended with per-student hour overrides. Students can
retroactively self-check-off attendance (badged `self`, trusted, D-10).
Completed outreach sessions produce **volunteer hours** toward each
student's season goal (§5).

**The read layer.** A coach dashboard that answers the questions George
actually asks weekly (§8); a student home showing *their own* numbers; a
combined calendar; CSV export for season reporting.

## 4. What's explicitly out of v1

Cut deliberately — ratified by George 2026-08-26 (§12). Each was fully or
partially built last time and none was ever functional-and-used; they
return only as post-launch milestones if George asks:

- **All parent scope** (R-3): accounts, guardian linking, parent home,
  RSVP-on-behalf by parents. First post-launch candidate.
- **The entire QR/kiosk check-in path** (R-2): kiosk, rotating QR, short
  codes, `/checkin`. The coach takes attendance; the proven implementation
  is preserved (ATT-5/6 dormant, `SALVAGE.md` §3).
- ICS calendar feeds (never worked end-to-end last time)
- Digest and reminder emails — the only v1 email is the staff invite, via
  Supabase's built-in mailer; students have no email at all (R-1)
- Milestone celebration toasts, avatar upload, activity feed
- Reports beyond one participation table, one hours table, and CSV export
- Any Band-style community features (posts, chat, files), push
  notifications, two-way calendar sync, payments (never in scope)

## 5. Domain rules (normative)

These are the crown jewels of the first rewrite. The SQL that implements
them exists and is proven (`SALVAGE.md` §2); the rebuild ports it, it does
not re-derive it.

### Metrics

- **MET-1 · Participation %** = (present + late marks) ÷ (explicit marks −
  excused) over **completed** sessions of events with
  `counts_participation = true`, in the student's team scope. `unmarked`
  sentinel rows are excluded. When the denominator is empty the value is
  **NULL, rendered as an em-dash, never 0%** (D-15, D-16).
- **MET-2 · Volunteer hours** = Σ over present/late marks on **completed**
  sessions of events with `counts_volunteer_hours = true`, of:
  `hours_override` if set, else the scheduled session length (the
  check-in-interval middle term returns only if the QR path ever does).
- **MET-2a · What the flag may say, by type (D-2, D-2a, D-2b, Q14).**
  Defaults are set by event **type**, never name: `outreach` counts hours,
  `meeting` doesn't, `competition` doesn't. Two overrides exist and one is
  forbidden: an admin may *exclude* a specific event from its own type's
  metric, and per George's 2026-08-26 ruling (D-2b, "a Meeting can
  sometimes also count for outreach") an admin may opt a **specific
  meeting** into volunteer hours — it then earns hours *in addition to*
  participation. Competitions can never be opted in (D-2a, reaffirmed in
  §12 Q14): the database CHECK-forbids `counts_volunteer_hours` on
  `type='competition'`. Consequence for the ported SQL: the hours view
  keys on the flag, with the competition exclusion enforced by the
  constraint, replacing the old view's `type='outreach'` filter.
- **MET-3 · Goal** = `student.goal_hours_override ?? season.default_goal_hours`
  (90h — the old tracker's season goal, carried by the ETL; the abandoned
  project's active test season and its schema column default both read 100
  and are not authoritative). **Planned hours** (future `going` RSVPs ×
  scheduled duration) display separately and are never summed into
  confirmed (D-12).
- **MET-4 · Team rollups** double-count dual-membership students; personal
  totals count once (D-4). Team participation is an attendance-weighted
  aggregate, not an average of averages.
- **MET-5 · Late counts as present** in every metric; it exists only as a
  visible flag (D-15).
- **MET-6 · One number, one view.** Every metric has exactly one owning SQL
  view, and every surface that shows it reads that view (PR-1). Two screens
  disagreeing about a student's hours is a launch-blocking defect. **New in
  the rebuild:** the *attendance rate* of a session is computed against the
  expected roster, not against marks given — an unmarked student lowers (or
  pends) the figure rather than inflating it. This kills the D014 class of
  lie (100% attendance shown for a 60%-skipped event).

### Attendance

- **ATT-1** · Statuses: `present | late | excused | absent | unmarked`.
  Absent is only ever set by explicit coach action (D-7). Un-marking writes
  the `unmarked` sentinel, never deletes the row (D-8).
- **ATT-2** · Last write wins, whoever writes it (D-6). The row records
  `method` and `recorded_by`. v1 methods are `coach | self`; `qr | code`
  exist in the enum for the day that path returns (R-2).
- **ATT-3** · Excused is settable only by coach/admin. Excused shrinks the
  participation denominator and never renders as failure (D-15).
- **ATT-4** · No audit trail on attendance edits beyond
  `recorded_by`/`updated_at` — corrections are normal workflow (D-9).
- **ATT-5 · (dormant)** · Check-in timing, preserved for the day the QR
  path returns (R-2): a session accepts check-ins from 15 minutes before
  start until end; check-in ≤ start+10 min is `present`, later is `late`;
  duplicates are idempotent and friendly ("Already checked in at 6:04 PM").
  In v1 the coach sets present/late directly; no timing rule applies.
- **ATT-6 · (dormant)** · QR/code mechanics, preserved likewise:
  HMAC-SHA256 over `sessionId:floor(unix/60)`; QR token = first 16 digest
  bytes; 6-char A-Z/2-9 code from bytes 16–22; current + previous bucket
  accepted; constant-time compare; server assigns status, never the
  client; manual code entry ships in the same slice as QR, with a durable
  5/min-per-user rate limit. The proven implementation is preserved per
  `SALVAGE.md` §3.

### Scheduling

- **SCH-1** · Event types: `meeting | outreach | competition`. Competitions
  count toward neither metric, ever (D-2a). The `counts_participation` /
  `counts_volunteer_hours` flags default by type and follow MET-2a's rules:
  exclusion within a type, plus the one sanctioned cross-type opt-in — a
  meeting into hours (D-2b).
- **SCH-2** · **Recurrence is stored, not reverse-derived.** A series stores
  its rule (weekdays + start/end minutes + date range); sessions materialize
  from it; schedule chips, next-session lines, and the edit form all read the
  rule. (The old app derived chips from materialized sessions — four copies
  of wall-time conversion and silently wrong chips.) Migrated series get
  their rule derived once by the ETL at import — a sanctioned one-time
  reverse-derivation; a series with no derivable rule renders a defined
  dates-only fallback.
- **SCH-3** · Timezone: UTC instants in the database; `session_date` is a
  Chicago calendar date; all display America/Chicago; date-only parsing at
  noon UTC to dodge DST (S-7). DST-window unit tests are required, and the
  database CHECK-constrains `ends_at > starts_at`.
- **SCH-4** · Event + sessions creation is **transactional** (one RPC) — no
  orphan events (the old app's non-transactional insert pair produced
  invisible orphans that double-counted totals).
- **SCH-5** · Events are scoped to teams (`team_ids`, null = all teams);
  session lifecycle is `scheduled | completed | canceled`, two buckets in the
  UI, coach closes days (D-14).

### Roster & identity

- **ROS-1** · Closed roster; public signups disabled; a session with no
  role reaches zero data. Two sign-in paths (R-1): **staff** (admin/coach)
  use email/password + Google via email invites; **students** use a
  username + team-issued password, provisioned in bulk from George's
  roster spreadsheet — no student email addresses exist or are collected.
  Students change the default password on first sign-in; a coach/admin
  resets a forgotten one (there is no email recovery for students).
  Implementation note: Supabase auth is email-keyed, so usernames are
  backed by synthetic addresses (`<username>@students.voltfrc.org`-style)
  that are never displayed or mailed. Wherever this PRD or a ruling says
  "authenticated," it means a role-holding account (the scope D-13 and P-2
  operate within).
- **ROS-2** · Roles: `admin | coach | student` in v1; `parent` stays in the
  role enum and `guardian_links` in the schema design, but all parent
  surfaces, linking, and accounts are out of v1 (R-3) — they are the first
  post-launch milestone candidate. Students may exist with no account.
- **ROS-3** · **`student_teams` is the only membership source** — there is
  no legacy `team_id` column, and the membership writer ships in the same
  milestone as the table (the writer-less junction was the costliest single
  defect last time).
- **ROS-4** · Teams archive, never delete; deactivated students keep history
  and see nothing (ROS-09 carry-over).
- **ROS-5** · One active season, enforced by partial unique index (D-3);
  season goal default editable inline (column-scoped write — inline editors
  never write full rows).

### Privacy & ethics (hard floors — see CONSTITUTION.md)

- **SEC-1** · RLS default-deny on every table; students are minors; no
  public pages (P-1, P-3).
- **SEC-2** · First name + last-initial is the display form outside staff
  surfaces and is not PII; team visibility is the product (P-2).
- **SEC-3** · No engagement mechanics: no streaks, countdowns, guilt copy,
  FOMO (P-4). Honest progress only.
- **SEC-4** · Every new relation gets an explicit anon posture; the default
  is `revoke all from anon`, asserted by a standing CI check. View security
  (`security_invoker`) is decided once, in the baseline migration, not
  rediscovered per view.

## 6. Build plan — vertical slices, each done-in-production

Each milestone is a **vertical slice**: schema + writes + UI + fallback +
persona test, accepted by George **on the deployed app** before the next
starts. No parallel waves. Acceptance criteria are the persona tests in §11.

- **M0 · Deployed skeleton (week 1).** Fresh Supabase project. One squashed
  baseline migration: the 10-table baseline schema, RLS helpers + policies,
  and the final metric views, ported per `SALVAGE.md` §2. Generated DB
  types. Auth + role guards + route error boundary. Deployed to the real
  domain with CI (typecheck, build, lint, unit, **and the persona e2e
  suite — at M0 that's sign-in, zero-data, and role-guard specs — green on
  a clean checkout**). Real data seeded by the **adapted** ETL: the proven
  script must first be updated for the new baseline (it wrote
  `students.team_id`, which no longer exists — it now emits `student_teams`
  rows per membership, and backfills a stored recurrence rule per imported
  series), then re-proven with a clean dry run per RUNBOOK §3. The baseline
  is the sanctioned C-4 exception for the tables the ETL actually writes;
  no UI ships against any table before its writer's milestone lands.
  *Accepted when: George signs in as admin on the production URL and sees
  the real roster, matching the fresh export's signed-off dry-run report
  exactly (20 students / 4 teams / 341.75 hours are the 2026-08 reference
  figures; a fresh export from the still-live old app may differ).*
- **M1 · Run a meeting.** Roster CRUD (with membership writer), bulk
  student-account provisioning from George's spreadsheet (R-1), season
  settings, meeting series creation from a stored recurrence rule,
  roll-call console with tap-to-cycle marking writing real rows, end-meeting
  per D-7, participation % correct on coach and student views.
  *Accepted when: George schedules and runs a real team meeting end-to-end.*
- **M2 · Outreach hours.** Outreach event creation (transactional, expected
  attendees), RSVP (student, or coach-on-behalf per D-5),
  mark-day-complete with per-student hours, retroactive student self
  check-off, mark-whole-event-complete, hours + goal + planned on student
  home. *Accepted when: a real outreach event's hours land correctly for
  every attendee, verified against the database.*
- **M3 · One set of numbers.** Coach dashboard (the §8 shortlist),
  leaderboard (S-5), reports (participation table, hours table, CSV export).
  Acceptance is the same-numbers-everywhere gate from the first rewrite,
  promoted to a release gate: *the same student's numbers agree on every
  screen that shows them.*
- **M4 · Calendar & deep links.** Combined calendar page on real data, and
  meeting deep links (`/meetings/:sessionId` — specced and never built last
  time).
- **Launch.** The gates, scheduled with dates, not open-ended tickets:
  domain live (already at M0), data cutover/teardown decision executed,
  student accounts provisioned from George's spreadsheet and staff invites
  sent, RLS anon audit passes, George's sign-off on the §11 persona suite
  run against production.

Post-launch candidates, in George's stated order of interest: **parent
scope first** (accounts, guardian linking, parent home, RSVP-on-behalf —
R-3), then only by request: the QR/code check-in path (R-2, ATT-5/6),
reminder emails + digest, ICS feeds, activity feed backed by a real event
log, avatars. v1 ships **zero Edge Functions**; NFR-12 applies when the
first one returns.

## 7. Screens & routes

Carried from the audited route map, minus what §4 cuts:

| Route | Roles | Purpose |
|---|---|---|
| `/login`, `/accept-invite` | public | Auth (staff email/Google, student username); staff invite acceptance |
| `/` | all | Role dashboard dispatcher (admin/coach → coach home; student → student home) |
| `/meetings` | all | Coach: series cards (S-3). Student: hero card + upcoming + attendance summary (port GAM-451's shipped design) |
| `/meetings/live/:sessionId` | staff | Roll-call console (chromeless) |
| `/meetings/:sessionId` | all | Meeting detail / deep-link target (M4) |
| `/outreach`, `/outreach/:eventId` | all | Dense event rows (S-4); RSVP; detail with day list |
| `/calendar` | all | Combined view, real data only (M4) |
| `/roster` | staff | Students, teams, memberships, account provisioning, staff invites |
| `/reports` | staff | Participation + hours tables, CSV |
| `/settings` | per-role | Profile, password change; admin: season settings (notification prefs return with email post-launch) |

(`/checkin` and the kiosk routes return with the QR path, post-launch;
parent views of `/meetings`, `/outreach`, and `/calendar` return with
parent scope.)

Meetings UX: the series-card model is settled (S-3) and its design contract
(`.claude/skills/meetings-design/SKILL.md`) carries forward: schedule-chip
format ("Tue 6–8 PM"), stored-Chicago-date bucketing, touching intervals
don't overlap, DES-05 status colors, the 5-point no-urgency test, the 4-rule
tap-to-cycle accessibility contract, series identity colors **shipped in the
same slice as their first consumer**.

## 8. The coach dashboard, scoped by questions

The old dashboard grew ~15 widget surfaces; the rebuild ships the answers to
the questions a coach actually asks weekly, and nothing else until asked:

1. Where are we against the season goal? (one figure, from `v_season_kpis`,
   shown once)
2. Who's below target / needs attention? (goal projection per student)
3. What's next? (next 3 upcoming sessions with expected counts)
4. How did the last event/meeting go? (most recent completed, attendance +
   hours)
5. How are hours spread across teams? (hours-by-team)
6. Participation health (team participation %, students below 70%)
7. Who's leading? (the leaderboard, embedded on the dashboard per your
   earlier ruling — proportional bars + % of goal, S-5, anonymization per
   P-3)

Every figure comes from a SQL view (PR-1), rendered once — the old app
computed the goal figure in two different layers on one screen. KPI strip:
one row of four tiles on the dashboard only; whether it persists across
staff pages is a §12 question (it dominated small viewports last time).

## 9. Design language

- **Reference standard:** the old tracker's density and instrument feel
  (S-4) — the reference figures in `docs/swarm/figures/ux-craft/` are the
  binding craft benchmark. Judged at mechanism level (alignment, density,
  color encoding), not "directionally matching."
- **Tokens:** Tracker Orange accent with the measured WCAG pairs (S-1);
  semantic status colors (confirmed=green, planned=purple, DES-05
  attendance colors); per-team hues; lucide icons (S-2). Port
  `src/theme/volt.ts` values verbatim — do not re-derive contrast math.
- **Type & layout:** content max-width ~1120px (forms 720); friendly dates
  everywhere (no raw ISO in UI); sentence case; zero internal jargon or
  ticket IDs in user-facing copy; the display-H1 + eyebrow header pattern
  from the 2026-08-21 design session, with real theme tokens for display
  size/weight so it needs no inline overrides.
- **Mobile is a primary target, not a sweep:** every list/table surface has
  a designed ≤390px variant; no horizontal scroll at 375px; ≥44px touch
  targets. (Three separate audits found the same overflow class last time.)
- **All four async states** (loading / empty / error / populated) on every
  data surface, backed by the real loader.
- **Accessibility floors:** keyboard path on every core flow; visible focus;
  contrast measured in both themes including on-accent pairings; headings
  don't skip levels.

## 10. Architecture & non-functional requirements

Each of these is a defect class from the first rewrite turned into a rule:

- **NFR-1 · No fixture data on live routes, ever.** Pages have exactly one
  data path (the real one). Identity/scope values are required props or
  context — no placeholder defaults. `PLACEHOLDER_*` in `src/` is a lint
  error.
- **NFR-2 · No silent writes.** Every mutation surfaces success or failure;
  loaders preserve and surface the underlying Postgres error; an app-level
  error boundary exists from the first commit.
- **NFR-3 · Generated database types** (`supabase gen types`) from day one;
  no `as unknown as` at query boundaries; one thin typed data-access layer
  with server-side filters (no fetch-whole-table-and-join-in-JS).
- **NFR-4 · Transactions for multi-step writes** (event+sessions, end
  meeting) as Postgres RPCs.
- **NFR-5 · Every list query has an explicit `.limit()`/pagination**
  (PostgREST silently truncates at 1,000).
- **NFR-6 · One home per utility.** Date/timezone logic in one module;
  shared hooks in one place; a page file over ~500 lines is a review flag
  (`OutreachList.tsx` hit 4,506).
- **NFR-7 · Comments explain the domain, never the process.** No ticket
  archaeology in source (≈45% of page lines last time).
- **NFR-8 · Realtime is decided, not stubbed:** v1 uses interval refresh on
  the roll-call console (10s) and says so; no "honest no-op" seams.
- **NFR-9 · Performance:** initial route chunk ≤ 300KB gzip; dashboard
  interactive < 2s on a phone.
- **NFR-10 · (dormant with ATT-6)** Durable rate limiting for code entry
  (a small table, not per-isolate memory) — 5/min per user (MTG-06) —
  applies when the QR/code path returns.
- **NFR-11 · Testing pyramid inverted from last time:** persona e2e flows
  (real Postgres, real migrations, real browser) are the primary acceptance
  layer and run in CI; unit tests cover pure domain logic (metrics,
  recurrence, formatters); jsdom component tests are the exception, not the
  default. Target: the e2e suite green on clean checkout forever.
- **NFR-12 · Edge Functions share code via `_shared/` or a build step**
  (never `../../../src/` imports), and CI verifies deployed functions match
  the repo. v1 ships zero Edge Functions; this applies when the first one
  returns.

Stack: Vite + React 19 + TypeScript strict + Supabase (fresh project),
deployed on Vercel. Design system (R-4, George 2026-08-26): **Astryx is
dropped.** The rebuild uses a mainstream system — proposed default:
shadcn/ui + Tailwind CSS, chosen for component completeness (real tables,
cross-row alignment, segmented progress) and agent fluency; the old
no-Tailwind/no-shadcn ban was an artifact of the Astryx lock and dissolves
with it. The volt tokens (S-1), lucide icons, and the §9 design language
carry unchanged.

## 11. Acceptance — the persona suite

The persona smoke tests survived every churn of the old project and are
the rebuild's release gate, run against the **deployed** app in both color
modes, verified by reading rows back from the database. The suite grows one
flow per milestone (M0 ships sign-in + zero-data + role-guard specs only),
the ported harness config gains mobile-viewport and dark-mode projects
(today it defines a single desktop-light project), and the
both-color-modes-against-production run is the launch gate — distinct from
the CI harness run, which uses local stand-ins for auth:

- **P-COACH:** signs in on a phone, starts roll-call for tonight's meeting
  in ≤ 2 taps from the dashboard, marks three students, ends the meeting;
  the participation views reflect exactly those marks (and nothing else —
  D-7).
- **P-STUDENT:** signs in on a phone with username + password; sees own
  hours, goal, participation, and next events above the fold; RSVPs to an
  outreach event and the row exists in the database; self-checks-off a
  past outreach day and the `self`-badged attendance row exists.
- **P-COACH2:** answers "which students are below 70% participation?" and
  "who is short of their hours goal?" from the dashboard without exporting.
- **P-PARENT** *(dormant — becomes the parent milestone's acceptance test
  post-launch, R-3)*: signs in, sees each linked kid's next event above
  the fold and their attendance/hours; RSVPs on a kid's behalf; the
  student sees who did it; sees **zero private data** about unlinked
  students — no attendance, hours, contact info, or full names. (Seeing
  unlinked students as "First L." on shared surfaces like event signups is
  expected behavior per D-13/P-2, not a failure.)

Plus the standing gates: same-numbers-everywhere (M3), a role-less sign-in
reaches zero data, RLS anon audit, DST-window tests, CSV export opens in
Sheets with ISO dates.

## 12. Decisions — taken by George, 2026-08-26

**All fourteen answered by George on 2026-08-26.** This section is now the
record of those answers (new rulings carry R-x / D-2b ids in
`DECISIONS.md`); nothing here is open.

1. **Data — YES.** Fresh Supabase project, seeded by re-running the
   adapted ETL from a fresh export (RUNBOOK §2 → §3 dry run → §4 real
   run); the current half-built project is decommissioned after cutover,
   not before (§5's account-preserving teardown applies then; its durable
   manifest-teardown branch is unmerged and unverified — check first).
2. **Design system — DO NOT KEEP ASTRYX** (R-4). Mainstream system;
   proposed default shadcn/ui + Tailwind (see §10); volt tokens and design
   language carry.
3. **Student accounts — username + password** (R-1). George supplies a
   spreadsheet of usernames and a default password; accounts provisioned
   in bulk in M1; no student emails. FLL kids still get no accounts
   (counts only).
4. **Confirmed hours are attendance-backed only — YES.** RSVPs never
   accrue hours (GAM-431's finding; completes D-12's planned-vs-confirmed
   separation).
5. **Attendance % against the expected roster — YES** (MET-6), with a
   pending state until fully marked.
6. **Kiosk/QR — ABANDONED for v1** (R-2). The coach takes attendance.
   ATT-5/6 and the proven implementation go dormant, not lost.
7. **Cut list — CONFIRMED.** ICS, digest emails, kiosk TV view, toasts,
   avatars, activity feed all out of v1.
8. **Parent scope — REMOVED from v1 entirely** (R-3). First post-launch
   milestone candidate; guardian_links leaves the baseline until then.
9. **KPI strip — dashboard-only.** This amends S-4's "persistent KPI
   strip" element (it dominated small viewports last time).
10. **Dashboard widgets — YES**, the §8 shortlist and nothing more.
11. **Series palette hues — DELEGATED** to the design system's categorical
    ramp.
12. **H1 font — Space Grotesk** (R-5).
13. **Old Linear backlog — close all 131 open issues** with a `rebuild`
    label, infrastructure tickets included (R-6): the ~45 process tickets
    serve the dispatch machinery being abandoned with the codebase, the
    Linear export backup already preserves history, and the rebuild's CI
    is specced here. The ~30 domain-rule findings are already folded into
    §5/§10.
14. **Competition hours stay out, permanently — YES.** D-2a reaffirmed;
    PRD v1's competition-opt-in design (CMP-02) is retired. Note the
    same-day companion ruling D-2b: a **meeting** can be opted into
    outreach hours per-event (MET-2a) — the opt-in door that stays open is
    meetings, never competitions.

## 13. Changelog

- **v1.1 (2026-08-26)** — George answered all fourteen §12 decisions and
  added ruling D-2b ("a Meeting can sometimes also count for outreach").
  Folded in: Astryx dropped (R-4), student username auth (R-1), QR/kiosk
  path dormant (R-2), parent scope out of v1 (R-3), milestones
  restructured to M0–M4, 10-table baseline, §12 converted from questions
  to the record of answers.
- **v1.0 (2026-08-23)** — Initial rebuild PRD, synthesized from the first
  rewrite's PRDs v1.5/v2/v3.1, the external UX audit + triage, the live
  Linear backlog (496 issues), the meetings and coach-dashboard redesigns,
  the migration runbook, and the full lessons record. See `LESSONS.md`.
