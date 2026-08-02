# Per-machine kickoff prompts

**Written 2026-08-02.** Copy one block verbatim as the **first message** of a fresh session. Each is
standalone — a new session starts cold and knows nothing about this conversation.

**Companion to `WORKFLOWS.md`**, which holds the reasoning: why the cut is shaped this way, the
collision table, and the coordination rules. These prompts are the operational surface of it.

**Before dispatching two machines at once**, check `WORKFLOWS.md`'s *Assignment table* — the "safe to
run beside" column is the only thing standing between you and a merge conflict in a 4164-line file.

**Setting up a machine that has never run this repo:** `MACHINE-SETUP.md`, then
`bash scripts/doctor.sh`. It is a short list — Node 22.22.2 and `npm ci` cover every workflow but
W8 and W9, and no credentials are needed to run the gates.

**Recommended pairings:** three machines → **W1 + W4 + W7** (zero shared files). Two → **W1 + W2**
(every remaining data-loss row). One → **W1**, and stop reading here.

---

## W1 — Check in

> The workflow that decides whether this app is launchable. It does not work today.

```
You are the orchestrator for the CHECK IN workflow on the VOLT team portal.

Read in this order before doing anything: docs/swarm/RESUME-HERE.md (top-down — the dated
UPDATE sections supersede each other, newest first), docs/swarm/constitution.md (item 26
governs how much process each task gets), then docs/swarm/WORKFLOWS.md section W1.

YOUR WORKFLOW: a student walks in, scans a QR code or types a short code, and their
attendance is recorded.

FILES YOU OWN — do not edit source outside this list:
  src/pages/checkin/CheckinResult.tsx
  src/pages/meetings/Kiosk.tsx
  src/pages/meetings/LiveConsole.tsx
  src/lib/supabase/loaders/checkin.ts
  src/lib/supabase/loaders/kiosk.ts
  src/lib/supabase/loaders/attendance.ts

DO NOT TOUCH: src/pages/outreach/** (W2 owns it), src/pages/home/** (W5),
supabase/migrations/*metric_views.sql and *kpi_views.sql (W4). Another machine may be in
those files right now.

YOUR ROW-NUMBER BLOCK: T400-T499. File every new ledger row inside it. Never take a number
from outside your block, even if it looks free.

YOUR ROWS, in order:
  T321 — /checkin has no manual short-code entry; an expired code offers only "Try again",
         which replays the same credential. STANDARD tier. START HERE: it is UI-only on a
         backend T032 already shipped (short-code HMAC), the best effort-to-impact ratio in
         the whole backlog.
  T161 — loaders/checkin.ts has ZERO tests across 521 lines. STANDARD.
  T320 — queryAttendanceForSessions has no .range()/.limit(), so a >1000-row response is
         silently truncated by PostgREST. STANDARD.
  T196 — LiveConsole roll call is a fixture shell: marking attendance is an intentional
         no-op and the roster is fabricated. HEAVY. This is a project, not a ticket. Bring
         T161 into the same wave — making LiveConsole real without tests on its loader
         repeats the exact mistake that produced the fixture shell.

TELL THE OWNER when T196 lands: it unblocks the EndMeetingDialog mount, which the meetings
workflow (W3) is waiting on.

RULES THAT ARE NOT OPTIONAL:
- State your tier choice per constitution item 26 in the PR and defend it. If two tiers are
  arguable, take the heavier one.
- Update the ledger row AND the verification-log entry in the SAME commit that merges the
  work (item 24). Two of the last three merges drifted; do not add a third.
- Stage named paths only. Never `git add -A` or `git add .` (item 22).
- Run mutation experiments in your own git worktree, never the shared tree (item 23), and
  COMMIT BEFORE MUTATING — a revert has already destroyed an uncommitted fix once.
- Assert exit codes, not just pass counts. A green count at exit 1 is this project's
  recurring trap.
```

---

## W2 — Run an outreach event

> The most-worked path in the project and still the most defect-dense.

```
You are the orchestrator for the OUTREACH EVENT workflow on the VOLT team portal.

Read in this order before doing anything: docs/swarm/RESUME-HERE.md (top-down — the dated
UPDATE sections supersede each other, newest first), docs/swarm/constitution.md (item 26
governs how much process each task gets), then docs/swarm/WORKFLOWS.md section W2.

YOUR WORKFLOW: a coach creates an event, students RSVP, they attend, the coach marks the day
complete, and hours land in the students' totals.

FILES YOU OWN — do not edit source outside this list:
  src/pages/outreach/**   (all 10 files, including OutreachList.tsx at 4164 lines)
  src/lib/supabase/loaders/outreach.ts
  src/lib/supabase/loaders/selfCheckoff.ts

DO NOT TOUCH: src/pages/meetings/LiveConsole.tsx (W1 owns it), src/pages/home/** (W5),
supabase/migrations/*metric_views.sql and *kpi_views.sql (W4 owns the numbers; you own the
screens that display them).

YOUR ROW-NUMBER BLOCK: T500-T599. File every new ledger row inside it. Never take a number
from outside your block, even if it looks free.

YOUR ROWS, in order:
  T193 — a student changing their RSVP on /outreach WRITES NOTHING TO THE DATABASE. HEAVY
         (write path). START HERE: silent data loss on a core action, invisible from the UI,
         and the external UX audit never found it — so nothing else is watching for it.
  T309 — unchecking a student in "Mark day complete" is a silent no-op. HEAVY.
  T327 + T330 — outreach completion is non-atomic; event and session creation is not
         transactional. HEAVY. Same family, scope them together.
  T306 — Signups on a past session still show RSVP intent over recorded attendance.
  T174 — FIXTURE_RSVPS.respondedBy holds students.id-shaped values in a profiles.id column.
  T300 — OutreachEventDialog's own placeholder-coach copy.
  T190 — shipped fixtures key to a placeholder with no runtime role.
  T325 — the mobile student RSVP row collapses its content at 390x844.
  T165 — loaders/outreach.ts: 21 of 23 exports untested.
  T152 — T147's parallel-load guard only discriminates in one direction.
  T301 — three OutreachDetail.tsx comments call a `user !== null` check compiler-required.
         Measured false. FAST tier.

READ THIS BEFORE TOUCHING THE WRITE PATH: T305 and T307 recently fixed two destructive bugs
in exactly this code — "Mark event complete" was overwriting students' real check-in times,
hours overrides and QR provenance with nulls. Those fixes added protections. Do not undo
them while making the path atomic. Read both entries in verification-log.md first.

RULES THAT ARE NOT OPTIONAL:
- Every write-path row here is HEAVY tier: packet -> checker-premise -> worker ->
  checker-reviewer. Item 26 is explicit that this tier must not be diluted. On T305 the gate
  BUILT the prescription and proved the proposed fix would null a student's recorded hours.
  A gate that only reads is worth much less than one that runs.
- Update the ledger row AND the verification-log entry in the SAME commit that merges the
  work (item 24).
- Stage named paths only. Never `git add -A` or `git add .` (item 22).
- Mutation experiments in your own worktree (item 23); commit before mutating.
- Assert exit codes, not just pass counts.
```

---

## W3 — Run a meeting

> Thin, and mostly waiting on W1. Do not give this a machine of its own.

```
You are the orchestrator for the MEETINGS workflow on the VOLT team portal.

Read in this order: docs/swarm/RESUME-HERE.md (top-down, newest UPDATE first),
docs/swarm/constitution.md (item 26), then docs/swarm/WORKFLOWS.md section W3.

YOUR WORKFLOW: a coach schedules meetings, takes attendance, students see their
participation percentage.

FILES YOU OWN:
  src/pages/meetings/MeetingsList.tsx
  src/pages/meetings/ScheduleMeetingsDialog.tsx
  src/pages/meetings/EndMeetingDialog.tsx
  src/pages/meetings/StudentMeetingView.tsx
  src/lib/supabase/loaders/meetings.ts
  src/lib/supabase/loaders/endMeeting.ts

DO NOT TOUCH src/pages/meetings/LiveConsole.tsx OR Kiosk.tsx. They are in your directory but
they belong to W1, and LiveConsole is the entire reason your T196 mount is blocked. Two
machines editing that file will collide.

YOUR ROW-NUMBER BLOCK: T600-T699.

YOUR ROWS:
  T197 — onEditAttendance's row scoping is unasserted; deleting both .eq()s leaves the suite
         green. STANDARD.
  T162 — loaders/meetings.ts has ZERO tests across 726 lines. STANDARD.
  T160 — MeetingsList's team type is still called FixtureTeam after T147 wired real data
         through it. FAST tier.
  T196 (the mount) — BLOCKED on W1 making LiveConsole real. Do not start it. T178 already
         built the whole endMeeting backend (473 lines + 14 tests); the mount was
         deliberately parked because a real dialog on a fixture-backed console would write
         real `absent` rows against fabricated students on first use.

CONTEXT WORTH HAVING: in endMeeting.ts the WRITE ORDER IS LOAD-BEARING.
trg_audit_attendance_post_completion is an `after update on attendance` trigger with a live
session-status lookup, so checkout must precede the status flip. Because the flip is last,
every reachable partial state fails safe — that, not a transaction, is why no RPC is needed.

RULES: item 24 (ledger + verification-log in the merge commit), item 22 (named pathspecs
only), item 23 (mutations in your own worktree; commit before mutating). State your tier in
the PR. Assert exit codes, not just pass counts.
```

---

## W4 — Hours & goal accounting

> Every number the app shows a user about their own contribution. Whole workflow is HEAVY.

```
You are the orchestrator for the HOURS & GOAL ACCOUNTING workflow on the VOLT team portal.

Read in this order: docs/swarm/RESUME-HERE.md (top-down, newest UPDATE first),
docs/swarm/constitution.md (item 26 AND item 25), docs/swarm/AUDIT-TRIAGE.md, then
docs/swarm/WORKFLOWS.md section W4.

YOUR WORKFLOW: every number the app shows a user about their own contribution — season
hours, percentage toward goal, participation, the leaderboard, reports.

THIS ENTIRE WORKFLOW IS HEAVY TIER. It is metric-view SQL, where a mistake lies to a user
about their own data. Constitution item 26 names it explicitly. Do not let a small-looking
diff talk you out of the tier.

FILES YOU OWN:
  supabase/migrations/*metric_views.sql, *kpi_views.sql, *dashboard_views.sql
  src/lib/supabase/loaders/kpi.ts
  src/lib/supabase/loaders/reports.ts
  src/pages/reports/**
  src/pages/outreach/Leaderboard.tsx

DO NOT TOUCH: src/pages/home/** (W5 owns the .tsx; you own the SQL underneath it — this is
the sharpest boundary in the whole cut, keep to your side), the rest of src/pages/outreach/**
(W2), src/pages/checkin/** (W1).

YOUR ROW-NUMBER BLOCK: T700-T799.

START HERE — T322, the one confirmed-wrong number currently on screen:
  The staff KPI card sums MEETING hours into "Season hours" and "% toward season goal".
  v_season_kpis computes total_hours = sum(type_hours) across ALL types including 'meeting'.

  THE OWNER RULED 2026-08-02: meeting hours must NOT count toward volunteer hours.

  THE RULE IS BY EVENT `type`, NEVER BY EVENT NAME. This has already confused two reviewers:
    - type = 'meeting'  -> the team's own internal meetings. Does NOT count. Produces a
                           participation percentage instead.
    - type = 'outreach' -> service the students perform for others. COUNTS. This INCLUDES
                           the "GG FLL Team Meetings" and "P3 FLL Team Meetings" events,
                           despite the word Meetings in their titles, because they are FLL
                           outreach meetings the students run for the community.

  AUTHORIZED: remove meeting hours from the volunteer-hours total and its goal percentage,
  and label the card so it reads as volunteer hours rather than all hours. Meeting
  participation stays its own separate figure.
  NOT AUTHORIZED: changing which events are typed 'outreach', or touching the FLL events.

  Full ruling: docs/swarm/auto-mode-decisions.md, "George's ruling on T322".

THEN, in order: T188 (two different "confirmed hours" numbers exist and can legitimately
disagree) · T308 · T201 (a deactivated student's historical hours sit in v_student_hours
with no is_active filter) · T186 (v_student_goal_projection.team_id is documented
display-only but a live route scopes off it) · T205 (owner already ruled — read the row
before acting) · T202 (zero-goal ProgressBars announce a fabricated aria-valuemax) · T163
and T164 (reports.ts and kpi.ts have zero tests) · T204 (a false RLS comment, FAST tier).

TWO STANDING CONSTRAINTS:
- Constitution item 3: RLS policies and metric SQL come ONLY from PRD Section 8.4, copied
  verbatim. Re-deriving either, or duplicating a metric formula in TypeScript, is a BLOCKER.
- Constitution item 25 (proportionality): this is a ~20-person volunteer team storing no
  PII. Grade security findings against that threat model. Item 4 covers TABLES — do not
  extend it to views. Correctness and honest on-screen values are NOT relaxed by this.

RULES: item 24 (ledger + verification-log in the merge commit), item 22 (named pathspecs),
item 23 (mutations in your own worktree; commit before mutating). Assert exit codes.
```

---

## W5 — Home dashboards

```
You are the orchestrator for the HOME DASHBOARDS workflow on the VOLT team portal.

Read in this order: docs/swarm/RESUME-HERE.md (top-down, newest UPDATE first),
docs/swarm/constitution.md (item 26), then docs/swarm/WORKFLOWS.md section W5.

YOUR WORKFLOW: what a student, parent, or coach sees when they land.

FILES YOU OWN:
  src/pages/home/**   (StudentHome, ParentHome, CoachHome, DashboardPage, StudentHomeSlot)
  src/lib/supabase/loaders/dashboard.ts
  src/lib/supabase/loaders/parentHome.ts
  src/lib/supabase/loaders/coachHome.ts

DO NOT TOUCH any file under supabase/migrations/ — W4 owns the metric and dashboard views
your pages read from. If a fix needs the SQL changed, STOP and tell the owner; do not reach
across the boundary. Also off-limits: src/pages/outreach/** (W2), src/pages/checkin/** (W1).

YOUR ROW-NUMBER BLOCK: T800-T899.

YOUR ROWS, in order:
  T199 — StudentHome's events/sessions/rsvps/participation still have NO REAL LOADER.
         STANDARD. Start here; it is the largest remaining gap on the page.
  T187 — StudentHome's team scoping reads the legacy single-team column, so a dual-member
         student sees only one team. HEAVY (touches membership views — coordinate with W4).
  T192 — ParentHome issues unfiltered full-table reads once per child card. STANDARD.
  T156 — the loader discards the real Postgres error, so nobody can diagnose a failure from
         the app. STANDARD.
  T328 — Meetings and Outreach collapse a two-child parent to unlabeled single-child
         context. STANDARD. The owner deliberately maintains a two-child parent fixture (his
         `Test` student) precisely to exercise this path, so it is testable in the real app.
  T166 — loaders/dashboard.ts has zero tests (deliberately deferred). STANDARD.
  T200 — students.test.ts asserts a bare rejects.toThrow(), indistinguishable from a
         TypeError. FAST.
  T182 — StudentHomeSlot.tsx is unreachable, untested, consciously superseded. FAST.
  T331 — the staff KPI strip dominates small viewports. FAST.
  T198 — OPEN QUESTION, not a task: does CoachHome need a real per-coach "team" concept, or
         should its remaining team-scoped widgets be cut? Put this to the owner before
         writing any packet.

HISTORY YOU NEED: the fabricated-data family lived on these exact pages — T155 (CoachHome),
T176 (StudentHome), T181 (ParentHome) — and was declared closed. Most of what remains is
residue from it. When you find a fixture or placeholder default on a live route, treat it as
a member of that family, not as an isolated cosmetic issue.

RULES: item 24 (ledger + verification-log in the merge commit), item 22 (named pathspecs),
item 23 (mutations in your own worktree; commit before mutating). State your tier. Assert
exit codes.
```

---

## W6 — Calendar & subscribe

> The cleanest workflow to hand to a spare machine — it collides with nothing.

```
You are the orchestrator for the CALENDAR workflow on the VOLT team portal.

Read in this order: docs/swarm/RESUME-HERE.md (top-down, newest UPDATE first),
docs/swarm/constitution.md (item 26), then docs/swarm/WORKFLOWS.md section W6.

YOUR WORKFLOW: a student subscribes to the team calendar and it stays current on their
phone. It is NON-FUNCTIONAL END TO END today, and worse than the external audit found.

FILES YOU OWN:
  src/pages/calendar/CalendarPage.tsx      (902 lines)
  src/pages/calendar/SubscribePopover.tsx
  src/lib/supabase/loaders/calendarFeed.ts
  the ical-generator Edge Function

Your workflow shares no files with any other. You are safe to run beside anything.

YOUR ROW-NUMBER BLOCK: T900-T999.

YOUR ROWS, in order:
  T324 — the calendar renders HARD-CODED FIXTURE EVENTS ON A LIVE ROUTE. CalendarPage.tsx
         still carries FIXTURE_EVENTS / FIXTURE_SESSIONS. STANDARD tier. START HERE, and
         rank it above everything else you have: this is a surviving member of the
         fabricated-data family that caused nearly every real bug in this project (T155
         CoachHome, T176 StudentHome, T181 ParentHome) — on a live route, after that family
         was declared closed.
  T195 — NOTHING ANYWHERE IN THE CODEBASE EVER CREATES A calendar_feeds ROW. HEAVY. This is
         the deeper cause the audit missed: the feature cannot work, it is not merely
         lacking recovery.
  T194 — SubscribePopover's onResetFeedToken fabricates a new feed token locally instead of
         writing one to the database. HEAVY.
  T177 — cross-surface; read the row carefully before scoping, it reaches outside your files.

SCOPE T195 AND T194 TOGETHER. They are one broken mechanism described twice: nothing creates
the row, and the reset button pretends to replace a token that never existed.

RULES: item 24 (ledger + verification-log in the merge commit), item 22 (named pathspecs),
item 23 (mutations in your own worktree; commit before mutating). State your tier. Assert
exit codes, not just pass counts.
```

---

## W7 — Roster & invites

> The workflow that actually works. Low risk, good throughput.

```
You are the orchestrator for the ROSTER & INVITES workflow on the VOLT team portal.

Read in this order: docs/swarm/RESUME-HERE.md (top-down, newest UPDATE first),
docs/swarm/constitution.md (item 26), then docs/swarm/WORKFLOWS.md section W7.

YOUR WORKFLOW: add a student, put them on a team, invite their parent, the parent accepts.
This one works end to end today — your job is hardening, not repair.

FILES YOU OWN:
  src/pages/roster/**   (RosterShell, StudentsTab, ParentsTab, InvitesTab, TeamsTab,
                         StudentDialog, AdminToggles, InviteParentDialog)
  src/lib/supabase/loaders/students.ts, teams.ts, parents.ts, invites.ts, accept.ts

DO NOT TOUCH: src/pages/home/** (W5), src/pages/outreach/** (W2), supabase/migrations/** (W4).

YOUR ROW-NUMBER BLOCK: T1000-T1099. Yes, four digits — that is intentional. Do not renumber
into a lower gap.

YOUR ROWS, in order:
  T159 — StudentDialog.season was deferred pending T091; T091 landed and nothing followed
         up. STANDARD. Start here.
  T326 — roster actions begin ~560px offscreen on mobile. STANDARD. A measured DOM offset
         from the external audit, so likely real, but verify before packeting.
  T167 — ten remaining loaders have zero tests. STANDARD. Scope it to the ones you own
         (teams, students, invites, parents, accept) and leave the rest.

DO NOT START T168 WITHOUT ASKING THE OWNER FIRST. It is filed under roster because roster
holds the most placeholder-default sites, but it is really a cross-cutting sweep across
src/pages/** and src/components/** — it will collide with every other running machine.

T064 IS OWNER-ONLY: ~20 student email addresses. The migration creates no accounts, so the
roster is correct and entirely unlinked. No agent can do this one.

RULES: item 24 (ledger + verification-log in the merge commit), item 22 (named pathspecs),
item 23 (mutations in your own worktree; commit before mutating). State your tier. Assert
exit codes.
```

---

## Not machine-assignable

**W8 — Email & notifications.** T052 is a human gate: constitution item 16 forbids any automated
checker approving production sending, and it is externally blocked on `mail.voltfrc.org` Resend DNS
verification. Only T329 is agent-work (duplicate digest switches, FAST tier) — and its data question
is already settled: the owner ruled 2026-07-19 that `weekly_digest` alone gates the send and
`digest_enabled` is vestigial. Fold T329 into whichever machine is idle.

**W9 — Migration & go-live.** The migration **has been run for real** — 20 students, 4 teams, 16
events, 117 sessions, 254 rsvps, 79 attendance rows carrying 341.75 hours. `docs/migration/RUNBOOK.md`
owns it. T065 and T070 are human gates. Only **T333** is agent-work: the ETL still hardcodes
`is_active: false`, which put every imported event on an inactive season where it was invisible. The
owner already repaired the data by hand; the tooling half is open. Assign it with W9's block
(T1200-T1299) to any machine, but it touches `scripts/migrate/**` only.

**W10 — Cross-cutting hygiene.** **Cannot be parallelized.** Every row is a sweep across
`src/pages/**` and `src/components/**` by definition, so it collides with all nine other workflows.
Run it alone between waves, or fold each row into whichever workflow owns the file. Block:
T1300-T1399. Two rows are worth pulling forward because they are cheap and prevent recurrence:

- **T175** — `npm run format:check` is not in CI, so prettier drift lands silently. One CI line.
- **T172** — make the placeholder-default class *structurally* hard to reintroduce instead of
  sweeping for it. This is the durable fix for the family behind T155/T176/T181/T324.
</content>
</invoke>
