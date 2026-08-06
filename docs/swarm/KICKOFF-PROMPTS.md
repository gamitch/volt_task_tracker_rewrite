# Per-machine kickoff prompts

**Written 2026-08-02.** Copy one block verbatim as the **first message** of a fresh session. Each is
standalone — a new session starts cold and knows nothing about this conversation.

**Companion to `WORKFLOWS.md`**, which holds the reasoning: why the cut is shaped this way, the
collision table, and the coordination rules. These prompts are the operational surface of it.

**Every block below authorizes subagent dispatch explicitly.** The blocks are copied into cold
sessions whose harness may default to not spawning agents, so the authorization is repeated inside
each one rather than stated once here -- a preamble a session never reads is not an authorization.

**Before dispatching two machines at once**, check `WORKFLOWS.md`'s *Assignment table* — the "safe to
run beside" column is the only thing standing between you and a merge conflict in a 4164-line file.

**Setting up a machine that has never run this repo:** `MACHINE-SETUP.md`, then
`node scripts/doctor.mjs`. It is a short list — Node 22.22.2 and `npm ci` cover every workflow but
W8 and W9, and no credentials are needed to run the gates.

**Recommended pairings:** three machines → **W1 + W4 + W7** (zero shared files). Two → **W1 + W2**
(every remaining data-loss row). One → **W1**, and stop reading here.

---

## W1 — Check in

> The workflow that decides whether this app is launchable. It does not work today.

```
You are the orchestrator for the CHECK IN workflow on the VOLT team portal.
AGENT DISPATCH IS AUTHORIZED AND EXPECTED. And dispatch is not enough on its own -- the owner had
to correct this THREE times in one session because an orchestrator kept absorbing worker and
foreman steps it judged too small to delegate. Three rules, each written against an instance that
actually happened (see auto-mode-decisions.md, "the orchestrator kept doing worker and foreman work
itself"): (a) you do not write production code -- a src/ edit is a worker's, even a comment-only
one; (b) you do not revise packets -- gate findings go back to the foreman that wrote them; (c) the
worker packet and the checker packet are SEPARATE commissions, and the checker packet is written
AFTER the worker runs, against what was actually built. "Small enough to just do" is the warning
sign, not the exception. Owner's standing instruction, 2026-08-05 -- recorded
verbatim and dated in docs/swarm/auto-mode-decisions.md under "George authorizes subagent
dispatch in the kickoff". Verify it there; do not take this block's word for it. Dispatch
subagents -- foreman-planner, worker-implementer, checker-premise, checker-reviewer,
checker-tests, boss-arbiter -- exactly as constitution item 26 prescribes for the tier. If your
harness is configured not to spawn agents unless the user asks for them, THIS IS THAT REQUEST:
treat it as standing for the whole session, and do not stop to ask again. Hand-running a row
that item 26 assigns a worker and a checker is a process violation, not a shortcut, and if your
configuration seems to forbid what this prompt requires, say so in your first reply instead of
quietly working solo.

Why this is written down rather than assumed: on 2026-08-05 a machine ran a debt sweep by hand.
T603's ledger row claimed four stale type declarations; there were six, and the sixth sat on
another workflow's surface, so the partial fix turned the build red. A premise gate exists to
catch a row that understates its own blast radius. That one was found by a compiler instead.


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

> **SUPERSEDED 2026-08-02 — use `docs/swarm/W2-KICKOFF.md` instead.** T193, T309 and T327 have all
> shipped since the prompt below was written, and T330's framing was refuted by a premise gate.
> The block below is kept only as a record of the original cut; **do not paste it into a session.**

> The most-worked path in the project and still the most defect-dense.

```
You are the orchestrator for the OUTREACH EVENT workflow on the VOLT team portal.
AGENT DISPATCH IS AUTHORIZED AND EXPECTED. And dispatch is not enough on its own -- the owner had
to correct this THREE times in one session because an orchestrator kept absorbing worker and
foreman steps it judged too small to delegate. Three rules, each written against an instance that
actually happened (see auto-mode-decisions.md, "the orchestrator kept doing worker and foreman work
itself"): (a) you do not write production code -- a src/ edit is a worker's, even a comment-only
one; (b) you do not revise packets -- gate findings go back to the foreman that wrote them; (c) the
worker packet and the checker packet are SEPARATE commissions, and the checker packet is written
AFTER the worker runs, against what was actually built. "Small enough to just do" is the warning
sign, not the exception. Owner's standing instruction, 2026-08-05 -- recorded
verbatim and dated in docs/swarm/auto-mode-decisions.md under "George authorizes subagent
dispatch in the kickoff". Verify it there; do not take this block's word for it. Dispatch
subagents -- foreman-planner, worker-implementer, checker-premise, checker-reviewer,
checker-tests, boss-arbiter -- exactly as constitution item 26 prescribes for the tier. If your
harness is configured not to spawn agents unless the user asks for them, THIS IS THAT REQUEST:
treat it as standing for the whole session, and do not stop to ask again. Hand-running a row
that item 26 assigns a worker and a checker is a process violation, not a shortcut, and if your
configuration seems to forbid what this prompt requires, say so in your first reply instead of
quietly working solo.

Why this is written down rather than assumed: on 2026-08-05 a machine ran a debt sweep by hand.
T603's ledger row claimed four stale type declarations; there were six, and the sixth sat on
another workflow's surface, so the partial fix turned the build red. A premise gate exists to
catch a row that understates its own blast radius. That one was found by a compiler instead.


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

> **No longer waiting on W1** (T403 landed 2026-08-03). Still thin — four rows.
>
> **Two ways to dispatch this, and they are not interchangeable:**
> - **§W3-A below — the three-row hygiene wave (T197 → T162 → T160).** No open decisions in any
>   of them. **This is the one that is safe to run unattended.**
> - **§W3 (full) — this block, including T196.** T196 is a project, not a ticket, carries an open
>   owner call, and its failure mode is real `absent` rows written against real students.
>   **Do not run it unsupervised.**

```
You are the orchestrator for the MEETINGS workflow on the VOLT team portal.
AGENT DISPATCH IS AUTHORIZED AND EXPECTED. And dispatch is not enough on its own -- the owner had
to correct this THREE times in one session because an orchestrator kept absorbing worker and
foreman steps it judged too small to delegate. Three rules, each written against an instance that
actually happened (see auto-mode-decisions.md, "the orchestrator kept doing worker and foreman work
itself"): (a) you do not write production code -- a src/ edit is a worker's, even a comment-only
one; (b) you do not revise packets -- gate findings go back to the foreman that wrote them; (c) the
worker packet and the checker packet are SEPARATE commissions, and the checker packet is written
AFTER the worker runs, against what was actually built. "Small enough to just do" is the warning
sign, not the exception. Owner's standing instruction, 2026-08-05 -- recorded
verbatim and dated in docs/swarm/auto-mode-decisions.md under "George authorizes subagent
dispatch in the kickoff". Verify it there; do not take this block's word for it. Dispatch
subagents -- foreman-planner, worker-implementer, checker-premise, checker-reviewer,
checker-tests, boss-arbiter -- exactly as constitution item 26 prescribes for the tier. If your
harness is configured not to spawn agents unless the user asks for them, THIS IS THAT REQUEST:
treat it as standing for the whole session, and do not stop to ask again. Hand-running a row
that item 26 assigns a worker and a checker is a process violation, not a shortcut, and if your
configuration seems to forbid what this prompt requires, say so in your first reply instead of
quietly working solo.

Why this is written down rather than assumed: on 2026-08-05 a machine ran a debt sweep by hand.
T603's ledger row claimed four stale type declarations; there were six, and the sixth sat on
another workflow's surface, so the partial fix turned the build red. A premise gate exists to
catch a row that understates its own blast radius. That one was found by a compiler instead.


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
they belong to W1. (This used to add "and LiveConsole is the entire reason your T196 mount is
blocked" — that reason is gone as of T403, but the ownership boundary is unchanged and two
machines editing that file will still collide.)

YOUR ROW-NUMBER BLOCK: T600-T699.

YOUR ROWS:
  T197 — onEditAttendance's row scoping is unasserted; deleting both .eq()s leaves the suite
         green. STANDARD.
  T162 — loaders/meetings.ts has ZERO tests across 726 lines. STANDARD.
  T160 — MeetingsList's team type is still called FixtureTeam after T147 wired real data
         through it. FAST tier.
  T196 (the mount) — ✅ UNBLOCKED 2026-08-03. START HERE. W1's T403 made LiveConsole real
         (real roster, real check-in credential, real attendance writes; all fixtures
         deleted). T178 already built the whole endMeeting backend (473 lines + 14 tests);
         the mount was parked only because a real dialog on a fixture-backed console would
         have written real `absent` rows against fabricated students. That reason is gone.
         READ FIRST: docs/swarm/inbox/w1-to-w3-T196-unblocked.md — it has an UPDATE banner
         covering schema changes that landed after it was written.

CONTEXT WORTH HAVING: in endMeeting.ts the WRITE ORDER IS LOAD-BEARING — but NOT for the
reason the file's older comments gave. It was originally required because
trg_audit_attendance_post_completion (`after update on attendance`, live session-status
lookup) would have logged the coach's own meeting-close checkout as a post-completion
correction. THAT TRIGGER NO LONGER EXISTS — it was removed 2026-08-03 by owner ruling
(attendance corrections are a normal workflow here, not fraud). The ordering is RETAINED on
an independent justification: because the flip is last, every reachable partial state fails
safe — that, not a transaction, is why no RPC is needed. DO NOT reorder these writes on the
grounds that the trigger is gone.

ALSO CHANGED ON `attendance` (2026-08-03, main = c9b4698): `updated_at` is now maintained by
`trg_attendance_touch_updated_at` (before insert or update) — it is trustworthy now, and
anything you send in a payload is overwritten by the database. `audit_log.actor` is nullable
so an audit write can never abort the write it audits. Post-completion attendance edits are
audited NOWHERE, deliberately — see VOLT_Portal_PRD.md DATA-02's "do not re-add" note before
you treat that as a bug.

RULES: item 24 (ledger + verification-log in the merge commit), item 22 (named pathspecs
only), item 23 (mutations in your own worktree; commit before mutating). State your tier in
the PR. Assert exit codes, not just pass counts.
```

---

## W3-A — Run a meeting: the three-row hygiene wave (T197 → T162 → T160)

> ## ✅ EXECUTED AND COMPLETE 2026-08-04 — DO NOT RE-DISPATCH
>
> All three rows shipped. See `active/W3A-handoff.md` and `auto-mode-decisions.md` ("W3-A auto-mode
> window", D1–D6). **Retained as a worked example of an unattended-wave prompt, not as live work.**
>
> **What the wave learned, for whoever writes the next one:**
> - **T162's premise was false.** "0 tests across 726 lines" came from an audit that counted *files
>   named `meetings.test.ts`*, not tests *of* the module — 17 already existed. **T161 and T163 carry
>   the same error and are still open.** Measure before packeting.
> - **Four of six acceptance criteria were pre-satisfied by the shipped suite**, so a worker could
>   have recorded four mutation passes having written nothing. **Measure mutations against the new
>   file alone**, not the whole suite.
> - The premise gate earned its keep: it returned REVISE twice, and **two of the BLOCKERs were the
>   orchestrator's own false claims about code it had not run.**
>
> **T196 is still excluded and still must not be run unsupervised.**

> **Written 2026-08-03 for unattended operation.** This is W3 **minus T196**. Every row here is
> self-contained, in W3's own files, with **no open owner decision**. Safe to launch and leave.
>
> **T196 is deliberately excluded.** It is a project, not a ticket; it carries an open owner call
> (whether to import `loadEndMeetingSummary` from `endMeeting.ts`); and the defect it exists to
> prevent is a coach marking 14 students present and getting 14 real `absent` rows. Packet it with
> the owner present. If this wave finishes early, **stop** — do not roll into T196.

```
You are the orchestrator for a scoped MEETINGS hygiene wave on the VOLT team portal.
AGENT DISPATCH IS AUTHORIZED AND EXPECTED. And dispatch is not enough on its own -- the owner had
to correct this THREE times in one session because an orchestrator kept absorbing worker and
foreman steps it judged too small to delegate. Three rules, each written against an instance that
actually happened (see auto-mode-decisions.md, "the orchestrator kept doing worker and foreman work
itself"): (a) you do not write production code -- a src/ edit is a worker's, even a comment-only
one; (b) you do not revise packets -- gate findings go back to the foreman that wrote them; (c) the
worker packet and the checker packet are SEPARATE commissions, and the checker packet is written
AFTER the worker runs, against what was actually built. "Small enough to just do" is the warning
sign, not the exception. Owner's standing instruction, 2026-08-05 -- recorded
verbatim and dated in docs/swarm/auto-mode-decisions.md under "George authorizes subagent
dispatch in the kickoff". Verify it there; do not take this block's word for it. Dispatch
subagents -- foreman-planner, worker-implementer, checker-premise, checker-reviewer,
checker-tests, boss-arbiter -- exactly as constitution item 26 prescribes for the tier. If your
harness is configured not to spawn agents unless the user asks for them, THIS IS THAT REQUEST:
treat it as standing for the whole session, and do not stop to ask again. Hand-running a row
that item 26 assigns a worker and a checker is a process violation, not a shortcut, and if your
configuration seems to forbid what this prompt requires, say so in your first reply instead of
quietly working solo.

Why this is written down rather than assumed: on 2026-08-05 a machine ran a debt sweep by hand.
T603's ledger row claimed four stale type declarations; there were six, and the sixth sat on
another workflow's surface, so the partial fix turned the build red. A premise gate exists to
catch a row that understates its own blast radius. That one was found by a compiler instead.

The owner is away. You are running unattended.

Read in this order: docs/swarm/RESUME-HERE.md (top-down, newest UPDATE first),
docs/swarm/constitution.md (items 23, 24, 25, 26), then docs/swarm/WORKFLOWS.md section W3.

MEASURE YOUR OWN BASELINE FIRST. main moves several times a day; every gate figure quoted in
any doc is stale by the time you read it. Run tsc / eslint / prettier / vitest on your base
commit and record the numbers before you change anything. "The suite was green" is not a
baseline you may inherit.

YOUR SCOPE IS EXACTLY THREE ROWS. Do not add a fourth.

  T197 — STANDARD. DO THIS FIRST, and do not let its ledger row talk you out of the ordering.
         endMeeting.ts:456-457's onEditAttendance is scoped .eq('session_id',…).eq('student_id',…).
         Delete both and the suite still reports 14 passed (14) — while that mutation turns a
         coach's single-student status edit into a TABLE-WIDE attendance UPDATE.
         The shipped code is CORRECT. Nothing is broken. You are adding the missing assertion.
         WHY FIRST: the row says it was filed separately "because T196 is blocked indefinitely."
         T196 is no longer blocked, so that reasoning is void — but the conclusion flips the
         other way, not toward folding it in. T196 is what MOUNTS this path in production.
         Landing the guard BEFORE the path goes live is strictly better than bundling them.

  T162 — STANDARD. loaders/meetings.ts has ZERO tests across 726 lines. Cover:
         aggregateParticipationRows, makeLoadCoachMeetingsData, makeLoadStudentMeetingsData,
         makeCancelMeetingSession, makeResolveCurrentStudentId, makeCreateMeetings —
         the participation math and each mutation's Supabase call shape.
         This is the loader behind the owner's OWN meeting-creation failure (T147), and
         meetings.ts:570 still carries the fixture-fallback comment from that incident.
         Highest regression value of the three.
         THERE IS NO DRAFT PACKET. The ledger used to claim one was "in inbox"; it does not
         exist and that cell is corrected. Write the packet yourself.

  T160 — FAST. MeetingsList.tsx:548 declares `interface FixtureTeam`, used by the real prop at
         :648 and by teamScopeLabel at :888 — while a genuine FIXTURE_TEAMS sits at :722.
         T147 wired real Supabase data through that type (:2224 passes teams={teams} from
         loadCoachMeetingsData), so the name now actively misleads. Rename only. No behaviour
         change. Do it LAST — it touches a file T162 may also touch.

FILES YOU OWN:
  src/pages/meetings/MeetingsList.tsx
  src/pages/meetings/ScheduleMeetingsDialog.tsx
  src/pages/meetings/EndMeetingDialog.tsx
  src/pages/meetings/StudentMeetingView.tsx
  src/lib/supabase/loaders/meetings.ts
  src/lib/supabase/loaders/endMeeting.ts

DO NOT TOUCH LiveConsole.tsx or Kiosk.tsx — W1's, despite sitting in your directory.
DO NOT TOUCH supabase/migrations/** — attendance schema is W1's, and every migration is HEAVY.
DO NOT START T196.

YOUR ROW-NUMBER BLOCK: T600-T699. File anything you find; do not fix out of scope.

UNATTENDED POSTURE — the part that matters most:

  YOU DECIDE ALONE: revising your own packets after gate findings; dispatching workers and
  checkers; resuming a failed worker; fixing MINOR/NIT findings that are comment-only or
  mechanical (disclose in the commit that they are unreviewed); committing and pushing to
  your branch.

  YOU DEFER TO THE OWNER — park the row, log it, move on, do NOT work around it:
    - anything touching supabase/migrations/, RLS, security definer, metric-math SQL, or
      auth/session/permission logic
    - any THIRD gate REVISE on one packet (item 19a escalates to the human; with no human,
      park it rather than loop or override)
    - any product decision where two readings produce materially different UI
    - opening or merging any PR
  Log every decision you make alone in docs/swarm/auto-mode-decisions.md under a new
  "W3-A auto-mode window" heading, marked as YOURS and reversible — never attributed to him.
  Precedent to copy: the "W4+W5 auto-mode window" entry in that same file.

TWO FAILURE MODES THIS PROJECT HAS PAID FOR, BOTH LIVE IN YOUR SCOPE:

  1. A test can pass for the wrong reason (7+ recorded instances), and it can go VACUOUS
     rather than red — T401 deleted an exported constant and a dependent test kept passing
     while testing nothing (Array.from({length: undefined - 1}) → []). Only tsc caught it.
     For T197 specifically: asserting ".eq was called" is a call-shape check and proves
     nothing. Build a fake whose stored rows let a missing .eq produce an OBSERVABLE wrong
     outcome — the wrong row count changing — the way T402's C2 did.

  2. A premise can be true on the branch that states it and false on the branch you act on.
     Check every premise against YOUR base commit, not against the doc that asserts it.

MUTATIONS ARE THE ACCEPTANCE BAR, NOT THE TEST COUNT. Commit before mutating (item 23). For
every criterion, break the code deliberately and show the suite goes RED AT EXIT 1. A green
suite at exit 0 after a mutation means the criterion is not covered, regardless of pass count.

RULES: item 24 (ledger + verification-log entry in the merge commit), item 22 (named pathspecs
only), item 23 (mutations in your own worktree). State your tier per row in the PR.
Assert exit codes, not just pass counts.

WHEN THE THREE ROWS ARE DONE: stop. Write a short handoff at
docs/swarm/active/W3A-handoff.md — what shipped, what you decided alone, what you parked, and
your measured gate numbers. Do not roll into T196.
```

---

## W4 — Hours & goal accounting

> Every number the app shows a user about their own contribution. Whole workflow is HEAVY.

```
You are the orchestrator for the HOURS & GOAL ACCOUNTING workflow on the VOLT team portal.
AGENT DISPATCH IS AUTHORIZED AND EXPECTED. And dispatch is not enough on its own -- the owner had
to correct this THREE times in one session because an orchestrator kept absorbing worker and
foreman steps it judged too small to delegate. Three rules, each written against an instance that
actually happened (see auto-mode-decisions.md, "the orchestrator kept doing worker and foreman work
itself"): (a) you do not write production code -- a src/ edit is a worker's, even a comment-only
one; (b) you do not revise packets -- gate findings go back to the foreman that wrote them; (c) the
worker packet and the checker packet are SEPARATE commissions, and the checker packet is written
AFTER the worker runs, against what was actually built. "Small enough to just do" is the warning
sign, not the exception. Owner's standing instruction, 2026-08-05 -- recorded
verbatim and dated in docs/swarm/auto-mode-decisions.md under "George authorizes subagent
dispatch in the kickoff". Verify it there; do not take this block's word for it. Dispatch
subagents -- foreman-planner, worker-implementer, checker-premise, checker-reviewer,
checker-tests, boss-arbiter -- exactly as constitution item 26 prescribes for the tier. If your
harness is configured not to spawn agents unless the user asks for them, THIS IS THAT REQUEST:
treat it as standing for the whole session, and do not stop to ask again. Hand-running a row
that item 26 assigns a worker and a checker is a process violation, not a shortcut, and if your
configuration seems to forbid what this prompt requires, say so in your first reply instead of
quietly working solo.

Why this is written down rather than assumed: on 2026-08-05 a machine ran a debt sweep by hand.
T603's ledger row claimed four stale type declarations; there were six, and the sixth sat on
another workflow's surface, so the partial fix turned the build red. A premise gate exists to
catch a row that understates its own blast radius. That one was found by a compiler instead.


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
AGENT DISPATCH IS AUTHORIZED AND EXPECTED. And dispatch is not enough on its own -- the owner had
to correct this THREE times in one session because an orchestrator kept absorbing worker and
foreman steps it judged too small to delegate. Three rules, each written against an instance that
actually happened (see auto-mode-decisions.md, "the orchestrator kept doing worker and foreman work
itself"): (a) you do not write production code -- a src/ edit is a worker's, even a comment-only
one; (b) you do not revise packets -- gate findings go back to the foreman that wrote them; (c) the
worker packet and the checker packet are SEPARATE commissions, and the checker packet is written
AFTER the worker runs, against what was actually built. "Small enough to just do" is the warning
sign, not the exception. Owner's standing instruction, 2026-08-05 -- recorded
verbatim and dated in docs/swarm/auto-mode-decisions.md under "George authorizes subagent
dispatch in the kickoff". Verify it there; do not take this block's word for it. Dispatch
subagents -- foreman-planner, worker-implementer, checker-premise, checker-reviewer,
checker-tests, boss-arbiter -- exactly as constitution item 26 prescribes for the tier. If your
harness is configured not to spawn agents unless the user asks for them, THIS IS THAT REQUEST:
treat it as standing for the whole session, and do not stop to ask again. Hand-running a row
that item 26 assigns a worker and a checker is a process violation, not a shortcut, and if your
configuration seems to forbid what this prompt requires, say so in your first reply instead of
quietly working solo.

Why this is written down rather than assumed: on 2026-08-05 a machine ran a debt sweep by hand.
T603's ledger row claimed four stale type declarations; there were six, and the sixth sat on
another workflow's surface, so the partial fix turned the build red. A premise gate exists to
catch a row that understates its own blast radius. That one was found by a compiler instead.


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

> Implementation closed; hosted first-feed/reset smoke test pending.

```
You are the orchestrator for the CALENDAR workflow on the VOLT team portal.
AGENT DISPATCH IS AUTHORIZED AND EXPECTED. And dispatch is not enough on its own -- the owner had
to correct this THREE times in one session because an orchestrator kept absorbing worker and
foreman steps it judged too small to delegate. Three rules, each written against an instance that
actually happened (see auto-mode-decisions.md, "the orchestrator kept doing worker and foreman work
itself"): (a) you do not write production code -- a src/ edit is a worker's, even a comment-only
one; (b) you do not revise packets -- gate findings go back to the foreman that wrote them; (c) the
worker packet and the checker packet are SEPARATE commissions, and the checker packet is written
AFTER the worker runs, against what was actually built. "Small enough to just do" is the warning
sign, not the exception. Owner's standing instruction, 2026-08-05 -- recorded
verbatim and dated in docs/swarm/auto-mode-decisions.md under "George authorizes subagent
dispatch in the kickoff". Verify it there; do not take this block's word for it. Dispatch
subagents -- foreman-planner, worker-implementer, checker-premise, checker-reviewer,
checker-tests, boss-arbiter -- exactly as constitution item 26 prescribes for the tier. If your
harness is configured not to spawn agents unless the user asks for them, THIS IS THAT REQUEST:
treat it as standing for the whole session, and do not stop to ask again. Hand-running a row
that item 26 assigns a worker and a checker is a process violation, not a shortcut, and if your
configuration seems to forbid what this prompt requires, say so in your first reply instead of
quietly working solo.

Why this is written down rather than assumed: on 2026-08-05 a machine ran a debt sweep by hand.
T603's ledger row claimed four stale type declarations; there were six, and the sixth sat on
another workflow's surface, so the partial fix turned the build red. A premise gate exists to
catch a row that understates its own blast radius. That one was found by a compiler instead.


Read in this order: docs/swarm/RESUME-HERE.md (top-down, newest UPDATE first),
docs/swarm/constitution.md (item 26), then docs/swarm/WORKFLOWS.md section W6.

YOUR WORKFLOW: a student subscribes to the team calendar and it stays current on their
phone. Implementation is merged and the database migration is deployed. Do not dispatch
new implementation work; only the hosted application smoke test remains.

FILES YOU OWN:
  src/pages/calendar/CalendarPage.tsx      (902 lines)
  src/pages/calendar/SubscribePopover.tsx
  src/lib/supabase/loaders/calendarFeed.ts
  the ical-generator Edge Function

Your workflow shares no files with any other. You are safe to run beside anything.

YOUR ROW-NUMBER BLOCK: T900-T999.

YOUR ROWS, in order:
  T324 — MERGED in PR #32. CalendarPage now resolves the active season and loads real,
         role-visible events/sessions through Supabase. Do not reopen it.
  T195 — MERGED in PR #37; migration 20260802000000 DEPLOYED to hosted Supabase. The
         migration backfills existing profiles, provisions future profiles, reconciles
         duplicates, and enforces one active feed. HEAVY.
  T194 — MERGED in PR #37. Reset is a persisted SECURITY INVOKER RPC, with the real writer
         as production default and authoritative reconciliation after transport loss. HEAVY.
  T177 — MERGED. Real subscription loader/link; do not reopen it.

DO NOT REDISPATCH T177/T324/T195/T194. W6 has no remaining implementation row. Confirm the
hosted app includes PR #37, then smoke-test first provisioning and one reset.

RULES: item 24 (ledger + verification-log in the merge commit), item 22 (named pathspecs),
item 23 (mutations in your own worktree; commit before mutating). State your tier. Assert
exit codes, not just pass counts.
```

---

## W7 — Roster & invites

> The workflow that actually works. Low risk, good throughput.

```
You are the orchestrator for the ROSTER & INVITES workflow on the VOLT team portal.
AGENT DISPATCH IS AUTHORIZED AND EXPECTED. And dispatch is not enough on its own -- the owner had
to correct this THREE times in one session because an orchestrator kept absorbing worker and
foreman steps it judged too small to delegate. Three rules, each written against an instance that
actually happened (see auto-mode-decisions.md, "the orchestrator kept doing worker and foreman work
itself"): (a) you do not write production code -- a src/ edit is a worker's, even a comment-only
one; (b) you do not revise packets -- gate findings go back to the foreman that wrote them; (c) the
worker packet and the checker packet are SEPARATE commissions, and the checker packet is written
AFTER the worker runs, against what was actually built. "Small enough to just do" is the warning
sign, not the exception. Owner's standing instruction, 2026-08-05 -- recorded
verbatim and dated in docs/swarm/auto-mode-decisions.md under "George authorizes subagent
dispatch in the kickoff". Verify it there; do not take this block's word for it. Dispatch
subagents -- foreman-planner, worker-implementer, checker-premise, checker-reviewer,
checker-tests, boss-arbiter -- exactly as constitution item 26 prescribes for the tier. If your
harness is configured not to spawn agents unless the user asks for them, THIS IS THAT REQUEST:
treat it as standing for the whole session, and do not stop to ask again. Hand-running a row
that item 26 assigns a worker and a checker is a process violation, not a shortcut, and if your
configuration seems to forbid what this prompt requires, say so in your first reply instead of
quietly working solo.

Why this is written down rather than assumed: on 2026-08-05 a machine ran a debt sweep by hand.
T603's ledger row claimed four stale type declarations; there were six, and the sixth sat on
another workflow's surface, so the partial fix turned the build red. A premise gate exists to
catch a row that understates its own blast radius. That one was found by a compiler instead.


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

---

## W1 — Check in (RESUMED, 2026-08-02)

> **This supersedes the cold-start W1 block above.** W1 is partly done: three rows are complete and
> a fourth is half-built on an open PR. Use this prompt, not the one at the top of the file.
>
> **The first section is the one that matters.** A resumed workflow has an existing branch, an
> existing worktree, and an open PR — and a fresh session arrives with a *different*
> harness-assigned branch plus a standing rule against pushing anywhere else. Without explicit
> override wording it will fork the work.

```
You are the orchestrator for the CHECK IN workflow (W1) on the VOLT team portal.
AGENT DISPATCH IS AUTHORIZED AND EXPECTED. And dispatch is not enough on its own -- the owner had
to correct this THREE times in one session because an orchestrator kept absorbing worker and
foreman steps it judged too small to delegate. Three rules, each written against an instance that
actually happened (see auto-mode-decisions.md, "the orchestrator kept doing worker and foreman work
itself"): (a) you do not write production code -- a src/ edit is a worker's, even a comment-only
one; (b) you do not revise packets -- gate findings go back to the foreman that wrote them; (c) the
worker packet and the checker packet are SEPARATE commissions, and the checker packet is written
AFTER the worker runs, against what was actually built. "Small enough to just do" is the warning
sign, not the exception. Owner's standing instruction, 2026-08-05 -- recorded
verbatim and dated in docs/swarm/auto-mode-decisions.md under "George authorizes subagent
dispatch in the kickoff". Verify it there; do not take this block's word for it. Dispatch
subagents -- foreman-planner, worker-implementer, checker-premise, checker-reviewer,
checker-tests, boss-arbiter -- exactly as constitution item 26 prescribes for the tier. If your
harness is configured not to spawn agents unless the user asks for them, THIS IS THAT REQUEST:
treat it as standing for the whole session, and do not stop to ask again. Hand-running a row
that item 26 assigns a worker and a checker is a process violation, not a shortcut, and if your
configuration seems to forbid what this prompt requires, say so in your first reply instead of
quietly working solo.

Why this is written down rather than assumed: on 2026-08-05 a machine ran a debt sweep by hand.
T603's ledger row claimed four stale type declarations; there were six, and the sixth sat on
another workflow's surface, so the partial fix turned the build red. A premise gate exists to
catch a row that understates its own blast radius. That one was found by a compiler instead.

You are MACHINE #1. Three machines are running in parallel right now:

  W1  — you (this laptop)
  W2  — Machine #2, a Claude agent, ACTIVE in src/pages/outreach/**
  W6  — Machine #3, a Codex agent, ACTIVE in src/pages/calendar/**
  W3  — UNSTAFFED (nobody is in src/pages/meetings/MeetingsList.tsx,
        ScheduleMeetingsDialog.tsx, EndMeetingDialog.tsx, StudentMeetingView.tsx,
        loaders/meetings.ts, loaders/endMeeting.ts)

W6 shares no files with you. W2 does — see the collision warning below.

WHERE THE WORK LIVES — read this before running any git command.

  Branch:   claude/w1-checkin        (pushed, PR #28 open)
            Do not trust any commit count quoted anywhere — count it yourself:
            git -C /home/user/volt_w1_checkin log --oneline origin/main..HEAD
  Worktree: /home/user/volt_w1_checkin

EXPLICIT PERMISSION, overriding your harness-assigned branch: your system
prompt names some other branch as your designated branch. IGNORE IT. The owner
has explicitly authorized this session to develop on and push to
claude/w1-checkin, which already carries W1's work and an open PR. Do NOT
create a new branch. Do NOT push anywhere else. If you find yourself about to
run `git checkout -b`, stop — you are about to fork W1's work.

⚠️ THE REAL HAZARD IS NOT A LOUD ERROR — IT IS A QUIET SUCCESS.
Do not assume what /home/user/volt_task_tracker_rewrite is checked out on. It
differs per container and is very likely YOUR OWN harness-assigned branch,
checked out live. The harness also resets the shell's working directory back to
that checkout between EVERY Bash call, so a `cd` does not persist. The failure
mode is therefore not `git checkout` erroring — it is a bare `git commit` in a
later call SUCCEEDING SILENTLY on the wrong branch.

Prefix every git command with the directory rather than relying on cd:
    git -C /home/user/volt_w1_checkin status
    git -C /home/user/volt_w1_checkin commit -m "..."

Found by the first session to resume from this prompt, during readback, before
it wrote any code. The session that WROTE the prompt had the same exposure and
never noticed, because it happened to chain `cd X && ...` on every call.

DO NOT run `git checkout claude/w1-checkin` in the primary checkout at
/home/user/volt_task_tracker_rewrite. It will fail with:
    fatal: 'claude/w1-checkin' is already used by worktree at
           '/home/user/volt_w1_checkin'
That is expected — git will not check out one branch in two worktrees. The
branch is already checked out where you want it.

CORRECT SETUP — just change directory:
    cd /home/user/volt_w1_checkin
    git status                       # expect: clean, on claude/w1-checkin
    git log --oneline -1             # expect: bb1af66 or newer
    git config user.email            # expect: noreply@anthropic.com

If /home/user/volt_w1_checkin does NOT exist (fresh container, worktree gone):
    git fetch origin claude/w1-checkin
    git worktree add /home/user/volt_w1_checkin claude/w1-checkin
    cd /home/user/volt_w1_checkin && npm ci
Note there is no -b: the branch already exists on origin. Passing -b would try
to create it and fail, or create a divergent local branch.

Do not work in the primary checkout at /home/user/volt_task_tracker_rewrite
whatever branch it happens to be on — see the cwd warning above.

READ IN THIS ORDER before doing anything: docs/swarm/RESUME-HERE.md (top-down —
the dated UPDATE sections supersede each other, newest first),
docs/swarm/constitution.md (item 26 governs how much process each task gets),
docs/swarm/WORKFLOWS.md section W1, then the T403 row in
docs/swarm/task-ledger.md — it carries the settled design for the work you are
picking up, so you do not need to re-derive it. The prompt you are reading is
also checked in at docs/swarm/KICKOFF-PROMPTS.md under "W1 — RESUMED"; that
copy is canonical if the two ever disagree.

GATES AT YOUR HEAD (verify before trusting anything; .env.local must be ABSENT):
  tsc 0 · vite build ✓ · prettier clean · eslint 0 errors / 364 warnings ·
  vitest 77 files / 1863 tests, exit 0
  (origin/main baseline for comparison: 75 files / 1817 tests, exit 0)

FILES YOU OWN — do not edit source outside this list:
  src/pages/checkin/CheckinResult.tsx
  src/pages/meetings/Kiosk.tsx
  src/pages/meetings/LiveConsole.tsx
  src/lib/supabase/loaders/checkin.ts
  src/lib/supabase/loaders/kiosk.ts
  src/lib/supabase/loaders/attendance.ts

DO NOT TOUCH: src/pages/outreach/** (W2 is in there right now),
src/pages/calendar/** (W6), src/pages/home/** (W5),
supabase/migrations/*metric_views.sql and *kpi_views.sql (W4).

⚠️ COLLISION WARNING, learned the expensive way:
src/lib/supabase/loaders/attendance.ts is imported at RUNTIME by three
workflows — endMeeting.ts:191 (W3) and three W2 pages (AttendancePanel,
MarkEventCompleteDialog, MarkDayCompleteDialog). It sits in loaders/, which
reads like W1 territory, and WORKFLOWS.md's collision table did not list it
until T320 added it. A change correctly scoped to W1's own files broke six
tests in two other workflows' files. BEFORE editing anything under
src/lib/supabase/loaders/, grep for importers across src/ first — the owning
workflow is whoever IMPORTS the module, not whoever the directory suggests.

YOUR ROW-NUMBER BLOCK: T400–T499. Next free number is T404. File every new row
inside the block. Never take a number from outside it, even if it looks free.

DONE ALREADY — do not redo:
  T321 — manual short-code entry on /checkin. In PR #28.
  T161 — loaders/checkin.ts brought under test (was 521 lines, zero tests).
  T320 — .range() pagination on the attendance read; PostgREST was silently
         truncating at max_rows = 1000 and returning 200.
  T403 step 1 — LiveConsole's QR panel now shows the REAL check-in credential
         (loadKioskDisplayToken) instead of FIXTURE_QR_TOKEN / 'FXTURE'.

YOUR NEXT TASK — T403 step 2. STANDARD tier. Read the T403 ledger row first.

  LiveConsole's loadData still defaults to defaultLoadLiveConsoleData, which
  returns 7 fabricated students and fixture attendance on a live route. This is
  the fabricated-data family that produced T155 / T176 / T181 / T324, and this
  console is a surviving member of it.

  The design is already settled and recorded on the T403 row:
    - Extend querySessionEventId in loaders/kiosk.ts (YOUR file) to also select
      starts_at, ends_at. LiveConsoleData needs startsAt; the end-meeting
      summary does not carry it.
    - Compose makeLoadLiveConsoleData in loaders/kiosk.ts from that session
      query plus loadEndMeetingSummary (loaders/endMeeting.ts — W3's file,
      IMPORT-ONLY, do not edit it). Importing avoids duplicating the roster
      logic (event → team_ids → active students), which the constitution
      forbids re-deriving. W3 is unstaffed, so the import carries no
      concurrent-edit risk. AttendanceRecordState is already shared in the
      reverse direction, so the shapes line up.
    - Swap LiveConsole's default, then DELETE FIXTURE_ROSTER and
      FIXTURE_ATTENDANCE. Delete them — do not keep them as a fallback. A
      fallback is how a fixture reaches a live route.
    - Expect existing LiveConsole.test.tsx tests to break by inheriting the
      real loader where they silently inherited a fixture. That is T151's
      mechanism working. The file already has renderBody (injects a display
      token) and renderBodyNoInjection (does not) — use the latter for anything
      asserting on the component's own default.

THEN T403 step 3. HEAVY tier — do not dilute it.
  notWiredSetAttendanceStatus (LiveConsole.tsx) is an intentional no-op, so a
  meeting run through this console records ZERO real attendance rows no matter
  what a coach clicks. Making it real is a WRITE PATH.
    - The pieces exist and are tested: upsertAttendance / removeAttendance
      (loaders/attendance.ts) and resolveAttendanceWriteMethod for qr/coach
      provenance. recordedBy is useAuth().user.id — that IS the profile id;
      loaders/checkin.ts already uses the session user id as parent_profile_id.
    - The OWNER HAS AUTHORIZED the full chain for this step: packet →
      checker-premise → worker → checker-reviewer, with the premise gate
      running on FABLE (model: "fable" on the Agent dispatch). Item 26 is
      explicit that a gate which only reads is worth much less than one that
      runs — have it BUILD the prescription in its own worktree (item 23).

AFTER STEP 3 LANDS, TELL THE OWNER: it unblocks T196, the EndMeetingDialog
mount, which is W3's row and NOT yours. WORKFLOWS.md W1 says so explicitly.
Do not mount it yourself.

ALSO OPEN IN YOUR BLOCK:
  T400 — a student who cannot scan has no session id, so the kiosk short code
         alone verifies against nothing. OWNER RULED option (a): /checkin
         offers a picker of currently-open sessions. Folded into T196's wave
         because it needs the same open-sessions query. Ruling is recorded in
         auto-mode-decisions.md — cite it, never paraphrase.
  T401, T402 — both filed by W1 but belong to W2. Do not execute them.

RULES THAT ARE NOT OPTIONAL:
- State your tier choice per constitution item 26 in the PR and defend it. If
  two tiers are arguable, take the heavier one.
- Update the ledger row AND the verification-log entry in the SAME commit that
  merges the work (item 24).
- Stage named paths only. Never `git add -A` or `git add .` (item 22).
- Run mutation experiments in your own git worktree (item 23), and COMMIT
  BEFORE MUTATING.
- Assert exit codes, not just pass counts. A green count at exit 1 is this
  project's recurring trap.
- An owner-approval claim must cite a section of auto-mode-decisions.md, or it
  is your decision and must say so.

TWO LESSONS THIS WORKFLOW PAID FOR — both cost a mutation that passed at exit 0:
1. A test that SUPPLIES the thing it is checking cannot detect a change to it.
   T161: an errored-session fixture returned {session: null, error}, making the
   error branch indistinguishable from the no-session branch. T403 step 1: a
   render helper injected a display token by default, so no test exercised the
   component's own default — including the test that claimed to prove there was
   no fabricated code. Both looked thorough. Only the mutation exposed either.
2. Run the mutation before believing the test. Every finding that changed an
   outcome came from executing, never from reading.

A NOTE ON THE STOP HOOK: it will report four commits as "Unverified"
(e422123, 187a6b2, 0c2c664, c7a3980). All four are ancestors of origin/main and
were not authored by any W1 session. Do NOT run the suggested rebase — it would
rewrite published history that W2 and W6 are branched from. Just confirm
`git config user.email` is noreply@anthropic.com and continue.
```
