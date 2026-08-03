# The backlog, cut by workflow — for assigning parallel machines

**Written 2026-08-02.** The ledger is ordered by when things were found. That is the wrong axis for
handing work to separate computers. This file re-cuts the **~60 open rows** into the user-facing
workflows they belong to, and — more importantly — says **which workflows can safely run at the same
time**, because that is decided by file overlap, not by topic.

**This file is a view, not a source of truth.** `task-ledger.md` remains authoritative for row
status; `AUDIT-TRIAGE.md` remains authoritative for the audit reconciliation. If they disagree with
this file, they win and this file is stale.

**To actually dispatch a machine, use `KICKOFF-PROMPTS.md`** — one copy-pasteable standalone prompt
per workflow, carrying that workflow's owned files, row-number block, do-not-touch list, and task
order. This file holds the reasoning; that one is the operational surface.

---

## Read this before you assign anything

**Two workflows sharing a file cannot run in parallel.** This project has already paid for that
lesson twice: the T196/T197 number collision (two branches filed follow-ups from the same "next free
row number" on the same afternoon), and the `events.team_ids` fixture-type failure that escaped
because two tasks each correctly deferred the same wiring.

Three files are collision magnets, and they are the reason the cut below is shaped the way it is:

| File | Lines | Open rows touching it |
|---|---:|---|
| `src/pages/outreach/OutreachList.tsx` | 4164 | T157, T168, T169, T188, T190, T193, T306, T325 |
| `src/pages/outreach/OutreachDetail.tsx` | — | T157, T169, T174, T300, T301, T306 |
| `src/pages/home/StudentHome.tsx` | — | T172, T182, T186, T187, T199, T200, T202 |

Plus `src/lib/supabase/loaders/outreach.ts` (T152, T157, T165, T169, T309, T327, T330) and the
metric-view SQL (T186, T187, T188, T201, T204, T308, T322).

**`src/lib/supabase/loaders/attendance.ts` is a fourth collision magnet, and this table missed it
until W1 walked into it on T320 (2026-08-02).** It is imported at *runtime* by three workflows:
`endMeeting.ts:191` (**W3**) calls `makeLoadAttendanceForSessions` directly, and three **W2** pages
consume it (`AttendancePanel`, `MarkEventCompleteDialog`, `MarkDayCompleteDialog`). It sits in
`loaders/`, which reads like W1 territory, and nothing on the row or in this file said otherwise —
so a change W1 correctly scoped to its own files broke six tests in two other workflows' files.

**The lesson generalises past this one file:** a shared *loader* is more dangerous than a shared
*page*, because the coupling is invisible from the filename and the ownership lists here are written
per-directory. Before editing anything under `src/lib/supabase/loaders/`, grep for importers across
`src/` first — the owning workflow is whoever *imports* it, not whoever the directory suggests.

**`docs/swarm/task-ledger.md` is edited by every task and is the one guaranteed conflict.** See
*Coordination rules* at the bottom — do not skip it.

---

## Assignment table

Tier is the **heaviest** item in the workflow, per constitution item 26.

| # | Workflow | Open rows | Tier | State | Safe to run beside |
|---|---|---:|---|---|---|
| **W1** | **Check in** — student arrives and gets counted | 4 | HEAVY | **Broken end to end** | W4, W6, W7, W8 |
| **W2** | **Run an outreach event** — create → RSVP → attend → complete | 13 | HEAVY | Partly working | W1, W3, W6, W7 |
| **W3** | **Run a meeting** — schedule → attendance → participation % | 4 | HEAVY | **Backend built; mount UNBLOCKED 2026-08-03** | W2, W4, W6, W7 |
| **W4** | **Hours & goal accounting** — the numbers users are shown | 10 | HEAVY | **One confirmed bug** | W1, W3, W6, W7 |
| **W5** | **Home dashboards** — student/parent/coach landing state | 10 | STANDARD | Mostly real | W6, W7, W8 |
| **W6** | **Calendar & subscribe** | 0 | — | **Merged; database deployed; hosted smoke pending** | everything |
| **W7** | **Roster & invites** | 5 | STANDARD | Working | everything |
| **W8** | **Email & notifications** | 2 | — | **Blocked on owner** | everything |
| **W9** | **Migration & go-live** | 4 | HEAVY | Migration has run | everything |
| **W10** | **Cross-cutting hygiene** | 8 | FAST/STANDARD | — | **nothing — see below** |

**W10 must not run in parallel with anything.** Every row in it is a sweep across `src/pages/**` and
`src/components/**` by definition, so it collides with all nine others. Run it alone, between waves,
or fold each row into whichever workflow owns the file.

**If you have three machines,** the highest-value non-colliding split is **W1 + W4 + W7**. W1 is the
launch blocker, W4 is the only confirmed-wrong number on screen, and W7 is low-risk throughput. None
of the three share a file.

**If you have two,** run **W1 + W2**. They are the two halves of "did this student's time get
recorded", they do not share files, and between them they contain every remaining data-loss row.

---

## W1 — Check in

> A student walks in, scans a QR code (or types a short code), and their attendance is recorded.

**This is the workflow that decides whether the app is launchable.** It does not work today.

| Row | What | Tier |
|---|---|---|
| **T321** | `/checkin` has no manual short-code entry; expiry offers only "Try again", replaying the same credential | STANDARD |
| ~~**T196**~~ | ~~`LiveConsole` roll call is a fixture shell~~ — **✅ DONE, and it was never T196.** This work shipped as **T403** (2026-08-03): real roster, real check-in credential, real `attendance` writes, all fixtures deleted. **The number `T196` belongs to W3's `EndMeetingDialog` mount**, not to W1 — see W3's table below. This line was an instance of the very T196 collision this file warns about at the top; it is struck rather than deleted so the collision stays visible. | — |
| **T161** | `loaders/checkin.ts` has **0 tests** across 521 lines | STANDARD |
| **T320** | `queryAttendanceForSessions` has no `.range()`/`.limit()` — a >1000-row response is silently truncated | STANDARD |

**Owns:** `pages/checkin/CheckinResult.tsx`, `pages/meetings/Kiosk.tsx`,
`pages/meetings/LiveConsole.tsx`, `loaders/checkin.ts`, `loaders/kiosk.ts`, `loaders/attendance.ts`

**Plus, added 2026-08-03 by owner ruling — the `attendance` TABLE AND ITS TRIGGERS in
`supabase/migrations/**`.** Verbatim: *"w1 owns attendance schema"*
(`auto-mode-decisions.md`, *"W1 OWNS ATTENDANCE SCHEMA"*). Granted because T404 and T405 had no
owner: W1 held six source files and no migrations, and W4 owns only the view migrations.
**Still NOT W1's:** `*metric_views.sql` / `*kpi_views.sql` / `*dashboard_views.sql` (W4's — and
several READ `attendance`, so W1 must verify against them without editing them), and
`supabase/functions/**`. **Every migration is HEAVY tier** (item 26 names migrations explicitly);
this grant obliges more process, not less.

> **Both rows this grant was issued for are now resolved (2026-08-03, `main` = `c9b4698`).**
> **T404 CANCELLED** by a second owner ruling — `trg_audit_attendance_post_completion` was
> **removed**, not widened, because correcting attendance post-completion is a normal workflow for
> this team, not fraud. **T405 CLOSED** by `trg_attendance_touch_updated_at`. The grant itself
> stands and still covers future `attendance` schema work.
>
> **The W4 boundary was exercised, not just asserted:** `v_student_hours` and
> `v_student_participation` were verified to return identical results before and after the
> migration, without either file being edited. That is the pattern for any future change here.

**Start with T321.** It is UI-only on a backend T032 already shipped (short-code HMAC), which makes
it the best effort-to-impact ratio in the entire backlog. **T161 is still open and still worth
pairing with any further `LiveConsole` work** — making that console real without tests on its loader
is what produced the fixture shell in the first place, and T403 shipped the real console without
closing T161.

**Overlap warning — DISCHARGED 2026-08-03.** This used to read *"whoever takes W1 should tell
whoever has W3 when `LiveConsole` becomes real."* It is real (T403), W3 has been told
(`inbox/w1-to-w3-T196-unblocked.md`), and **T196 is unblocked**. Nothing further is owed from W1
to W3 on this.

---

## W2 — Run an outreach event

> A coach creates an event, students RSVP, they attend, the coach marks the day complete, hours land.

The most-worked path in the project and still the most defect-dense. T305 and T307 fixed the two
destructive bugs; what remains is silent no-ops and non-atomic writes.

| Row | What | Tier |
|---|---|---|
| **T193** | A student changing their RSVP on `/outreach` **writes nothing to the database** | HEAVY |
| **T309** | Unchecking a student in "Mark day complete" is a silent no-op | HEAVY |
| **T327** | Outreach completion is non-atomic | HEAVY |
| **T306** | Signups on a past session still show RSVP intent over recorded attendance | STANDARD |
| **T174** | `FIXTURE_RSVPS.respondedBy` holds `students.id`-shaped values in a `profiles.id` column | STANDARD |
| **T300** | `OutreachEventDialog`'s own placeholder-coach copy | STANDARD |
| **T301** | Three comments call a `user !== null` check compiler-required — measured false | FAST |
| **T190** | Shipped fixtures key to a placeholder with no runtime role | STANDARD |
| **T325** | Mobile student RSVP row collapses at 390×844 | STANDARD |
| **T165** | `loaders/outreach.ts`: 21 of 23 exports untested | STANDARD |
| **T152** | T147's parallel-load guard only discriminates in one direction | STANDARD |
| **T157** | (cross-cutting; see W10) | — |

**Owns:** `pages/outreach/**` (all 10 files), `loaders/outreach.ts`, `loaders/selfCheckoff.ts`

**Start with T193.** It is silent data loss on a core action, invisible from the UI, and **the
external audit never found it** — meaning nothing else is watching for it. Heavy tier: it is a write
path.

**Sequencing:** T193 → T309 → T327 → T330 — **all four merged 2026-08-02/03**, as have T401 and T402
(W1-block rows W2 executed). Remaining W2 rows start at **T306**. The historical note: T327/T330 were
the same "non-atomic" family and were
scoped together, carefully — T305/T307 added protections to this exact path that must not be undone.

---

## W3 — Run a meeting

> A coach schedules meetings, takes attendance, students see their participation percentage.

T178 built the whole `endMeeting` backend (473 lines + 14 tests). The mount was **deliberately
parked** because putting a real dialog on a fixture-backed console would write real `absent` rows.

> **✅ T196 IS UNBLOCKED as of 2026-08-03** — W1's T403 made `LiveConsole` real. Read
> `docs/swarm/inbox/w1-to-w3-T196-unblocked.md` first; it carries an UPDATE banner covering the
> `attendance` schema changes that landed after it was written (audit trigger removed,
> `updated_at` now maintained, `audit_log.actor` nullable). **W3 is the next wave.**

| Row | What | Tier |
|---|---|---|
| **T196** | *(the mount — **UNBLOCKED 2026-08-03**, `LiveConsole` is real)* | HEAVY |
| **T197** | `onEditAttendance`'s row scoping is unasserted — deleting both `.eq()`s leaves the suite green | STANDARD |
| **T162** | `loaders/meetings.ts` has **0 tests** across 726 lines | STANDARD |
| **T160** | `MeetingsList`'s team type is still called `FixtureTeam` after T147 wired real data through it | FAST |

**Owns:** `pages/meetings/MeetingsList.tsx`, `ScheduleMeetingsDialog.tsx`, `EndMeetingDialog.tsx`,
`StudentMeetingView.tsx`, `loaders/meetings.ts`, `loaders/endMeeting.ts`

**W3 is the thinnest workflow and mostly waits on W1.** Do not assign a machine to W3 alone — give it
to whoever has W2 or W4, or run T197/T162/T160 as a short standalone wave.

**Do not put `LiveConsole.tsx` in W3's allowed files.** It belongs to W1. That file is the entire
reason T196 is blocked and two machines editing it will collide.

---

## W4 — Hours & goal accounting

> Every number the app shows a user about their own contribution.

**Constitution item 26 puts this whole workflow at HEAVY** — it is metric-view SQL, where a mistake
lies to a user about their own data. Do not let a small-looking diff talk you out of the tier.

| Row | What | Tier |
|---|---|---|
| **T322** | Staff KPI card sums **meeting** hours into "Season hours" and "% toward season goal" — **owner ruled this is wrong** | HEAVY |
| **T188** | Two different "confirmed hours" numbers exist and can legitimately disagree | HEAVY |
| **T308** | *(metric views + `MarkDayCompleteDialog`)* | HEAVY |
| **T201** | A deactivated student's historical hours sit in `v_student_hours` with no `is_active` filter | HEAVY |
| **T186** | `v_student_goal_projection.team_id` is documented display-only, but a live route scopes off it | HEAVY |
| **T204** | `loaders/students.ts`'s RLS-reasoning comment cites a claim about view mechanics that is false | FAST |
| **T205** | `v_leaderboard_students` is readable by the unauthenticated `anon` key *(owner ruled — check the row)* | HEAVY |
| **T202** | Zero-goal `ProgressBar`s announce a fabricated `aria-valuemax` to assistive tech | STANDARD |
| **T163** | `loaders/reports.ts` has **0 tests** across 729 lines | STANDARD |
| **T164** | `loaders/kpi.ts` has **0 tests** across 255 lines | STANDARD |

**Owns:** `supabase/migrations/*metric_views.sql`, `*kpi_views.sql`, `*dashboard_views.sql`,
`loaders/kpi.ts`, `loaders/reports.ts`, `pages/reports/**`, `pages/outreach/Leaderboard.tsx`

**Start with T322.** The owner ruled 2026-08-02 that meeting hours must not count toward volunteer
hours. **The rule is by event `type`, never by event name** — this has already confused two
reviewers. `type = 'meeting'` does not count; `type = 'outreach'` does, and that **includes** the
`GG FLL Team Meetings` and `P3 FLL Team Meetings` events despite the word *Meetings* in their titles,
because they are service the students run for the community. **Not authorized:** retyping any event.

**W4 conflicts with W5** on `dashboard_views.sql` and `StudentHome.tsx` (T186, T187, T201, T202).
Give both to one machine, or split strictly: W4 takes the SQL, W5 takes the `.tsx`.

---

## W5 — Home dashboards

> What a student, parent, or coach sees when they land.

The fabricated-data family lived here (T155 CoachHome, T176 StudentHome, T181 ParentHome) and was
declared closed. Most of what remains is residue plus real loader gaps.

| Row | What | Tier |
|---|---|---|
| **T199** | `StudentHome`'s `events`/`sessions`/`rsvps`/`participation` still have **no real loader** | STANDARD |
| **T187** | `StudentHome`'s team scoping reads the legacy single-team column — a dual-member student sees one team | HEAVY |
| **T192** | `ParentHome` issues unfiltered full-table reads once per child card | STANDARD |
| **T198** | Does `CoachHome` need a real per-coach team concept? *(open question)* | STANDARD |
| **T200** | `students.test.ts`'s row-not-found test asserts a bare `rejects.toThrow()` | FAST |
| **T182** | `StudentHomeSlot.tsx` is unreachable, untested, consciously superseded | FAST |
| **T166** | `loaders/dashboard.ts` has 0 tests — deliberately deferred | STANDARD |
| **T156** | The loader discards the real Postgres error, so failures can't be diagnosed from the app | STANDARD |
| **T331** | Staff KPI strip dominates small viewports | FAST |
| **T328** | Meetings and Outreach collapse a two-child parent to unlabeled single-child context | STANDARD |

**Owns:** `pages/home/**`, `loaders/dashboard.ts`, `loaders/parentHome.ts`, `loaders/coachHome.ts`

**T328 is worth doing** — the owner deliberately maintains a two-child parent fixture (his `Test`
student) precisely to exercise this path, so it is testable in the real app.

---

## W6 — Calendar & subscribe

> A student subscribes to the team calendar and it stays current in their phone.

**Implementation merged in PR #37 and migration `20260802000000` deployed to hosted Supabase;
hosted application smoke test pending.**

| Row | What | Tier |
|---|---|---|
| **T324** | **MERGED in PR #32** — calendar now loads active-season Supabase data | STANDARD |
| **T195** | **MERGED in PR #37; DATABASE DEPLOYED** — migration provisions/backfills real feeds and enforces one active row | HEAVY |
| **T194** | **MERGED in PR #37** — Reset is one authenticated atomic RPC with authoritative failure reconciliation | HEAVY |
| **T177** | **MERGED** — real subscription loader/link; do not reopen | STANDARD |

**Owns:** `pages/calendar/**`, `loaders/calendarFeed.ts`, the `ical-generator` edge function

**Next: confirm the hosted application release includes PR #37, then smoke-test one initial feed
and one reset against hosted Supabase.** No open W6 implementation row remains. The
plain-PostgreSQL lifecycle/security suite, all eight named mutations, the full application suite,
and an independent Frontier checker are green on the branch.

**W6 collides with nothing.** It is the cleanest workflow to hand to a spare machine.

---

## W7 — Roster & invites

> Add a student, put them on a team, invite their parent, parent accepts.

The workflow that actually works. Low risk, good throughput.

| Row | What | Tier |
|---|---|---|
| **T159** | `StudentDialog.season` was deferred pending T091; T091 landed and nothing followed up | STANDARD |
| **T326** | Roster actions begin ~560px offscreen on mobile | STANDARD |
| **T167** | Ten remaining loaders have 0 tests | STANDARD |
| **T168** | The placeholder-default sweep covered 7 sites; `src/pages/**` and `src/components/**` are unswept | STANDARD |
| **T064** | **Owner-only** — ~20 student email addresses; the migration creates no accounts, so the roster is correct and entirely unlinked | — |

**Owns:** `pages/roster/**`, `loaders/students.ts`, `teams.ts`, `parents.ts`, `invites.ts`, `accept.ts`

**T168 is really a W10 sweep** — it is listed here because roster owns the most placeholder sites,
but it will touch other workflows' files. Coordinate before starting it.

---

## W8 — Email & notifications

| Row | What | Tier |
|---|---|---|
| **T052** | **HUMAN GATE** — production email enablement (blocked on `mail.voltfrc.org` Resend DNS + owner sign-off) | — |
| **T329** | Duplicate digest switches leave email preference authority unresolved | FAST |

**T329's data question is already settled** — the owner ruled 2026-07-19 that `weekly_digest` alone
gates the send and `digest_enabled` is vestigial. If two switches still render, that is UI cleanup,
not an authority question.

**W8 cannot be finished without you.** Constitution item 16 forbids any automated checker approving
production sending.

---

## W9 — Migration & go-live

The migration **has been run for real** (2026-08-02): 20 students, 4 teams, 16 events, 117 sessions,
254 rsvps, 79 attendance rows carrying 341.75 hours. `docs/migration/RUNBOOK.md` owns this.

| Row | What | Tier |
|---|---|---|
| **T333** | The ETL hardcodes `is_active: false`, so imported events landed on an inactive season and were invisible — **owner already fixed the data**; the tooling half is open | HEAVY |
| **T064** | Roster → accounts post-migration verification | — |
| **T065** | **HUMAN GATE** — MIG-06 cutover | — |
| **T070** | **HUMAN GATE** — Vercel domain go-live | — |

**Owns:** `scripts/migrate/**`

---

## W10 — Cross-cutting hygiene

**Do not run this beside anything.** Every row is a sweep.

T157 · T168 · T171 · T172 · T175 · T204 · T301 · T332

Two worth pulling forward because they are cheap and prevent recurrence:

- **T175** — `npm run format:check` is not in CI, so prettier drift lands silently. One CI line.
- **T172** — make the placeholder-default class *structurally* hard to reintroduce instead of
  sweeping for it. This is the durable fix for the family that caused T155/T176/T181/T324.

---

## Coordination rules for parallel machines

These are not suggestions. Each one is written against a failure this project has already had.

1. **Reserve a row-number block per workflow before starting.** "Next free row number" read from a
   shared file is not a reservation — that is exactly how two different tasks both became T196 and
   both became T197.

   **Blocks of 100, one per workflow** (owner's call, 2026-08-02). The existing ledger ends at
   **T333**, so T400 is a clean start with room left below it:

   | | | | | |
   |---|---|---|---|---|
   | **W1** T400-499 | **W2** T500-599 | **W3** T600-699 | **W4** T700-799 | **W5** T800-899 |
   | **W6** T900-999 | **W7** T1000-1099 | **W8** T1100-1199 | **W9** T1200-1299 | **W10** T1300-1399 |

   **Why 100 and not 20:** a block that can run out reintroduces the exact failure it prevents — the
   moment a workflow exhausts its range, someone reaches for a number outside it and the reservation
   is gone. At 100 no workflow here can plausibly exhaust one; the largest, W2, holds 13 open rows
   today. Blocks are deliberately over-sized because unused numbers cost nothing and a collision
   costs a corrupted ledger.

   **Row IDs go to four digits from W7 on.** That is fine — nothing parses these — but do not
   "helpfully" renumber T1000 back down into a gap. Gaps are the point.

2. **Branch names are task-scoped, never session-scoped: `claude/t<row>-<short-slug>`.**
   `claude/t193-persist-rsvp`, `claude/t321-manual-code`. **Never a session-plan name** like
   `claude/swarm-plan-<id>`.

   **This is the row-number failure wearing different clothes.** A generic branch name looks
   reserved and is not. `claude/swarm-plan-zl575z` was used by one session for PR #27 and, the same
   afternoon, by another session as the working branch for T193 — two machines pointed at one
   mutable ref with nothing announcing the overlap. It was caught by the owner asking whether T193
   would get its own branch, not by any check. T193 was moved to `claude/t193-persist-rsvp` before
   its PR.

   **Corollary, from the same incident:** when the PR for a branch has already merged, **do not
   reuse the branch for follow-up work.** Restart it from `main` (`git checkout -B <name>
   origin/main`) so no merged history is re-proposed, and open a **new** PR — a merged PR cannot
   track new work. Better still, use a new task-scoped name and leave the old branch to be deleted.

   **Delete merged branches.** Sixteen had accumulated by 2026-08-02. Turning on GitHub's
   *Settings → General → Automatically delete head branches* removes the whole class.

3. **One machine owns a file, not a workflow.** If two workflows need `OutreachList.tsx`, the second
   one waits. Check the collision table at the top before dispatching.

4. **Never resolve a `task-ledger.md` conflict by taking one side wholesale.** Both sides are real
   rows. This is written in the ledger's own history and it has bitten once already.

5. **Record and merge in the same commit** (item 24). Two of the three most recent merges drifted
   from their ledger rows — T303 recorded into the wrong column, T323 merged with no
   verification-log entry at all. With N machines running, that drift multiplies by N.

6. **State the tier in the PR and defend it** (item 26). If two tiers are arguable, take the heavier
   one — but "it sounds important" is not a trigger and neither is file count.

7. **Mutation experiments run in the agent's own worktree** (item 23), and **commit before mutating**
   — T323's mutation revert also reverted the uncommitted fix, and only the full suite caught it.
</content>
</invoke>
