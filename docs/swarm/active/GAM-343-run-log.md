# GAM-343 run log

**Issue:** [GAM-343 — E2E — W2 Run an outreach event: create → RSVP → attend → complete → hours land](https://linear.app/gamitch/issue/GAM-343/e2e-w2-run-an-outreach-event-create-rsvp-attend-complete-hours-land)
**Branch:** `claude/gam-343-e2e-w2-outreach-lifecycle`
**Run:** GitHub Actions, dispatched from Linear on GAM-343 entering `Todo`.

Append-only. One line per milestone, pushed immediately — this file is the only
thing that survives if the container is killed.

## Milestones

- **Claimed.** Read `AGENTS.md` § "Where work comes from" and
  `docs/swarm/constitution.md` (items 18, 19, 22, 26, 28) before opening any
  other file. Fetched GAM-343 live from Linear; body was `tier/unreviewed`.
- **Tiered HEAVY** (item 28d — judged *before* `In Progress`, not after).
  Reasoning: the deliverable is test-only, which argues STANDARD, but item 26's
  question is whether a mistake can corrupt data or lie to a user about their
  own data. The artifact's whole value is an assertion about a **write path**
  and an **RLS policy** (`rsvps.responded_by = auth.uid()`), on the path
  `WORKFLOWS.md` calls the most defect-dense in the project, whose three worst
  bugs (T193, T309, T327) were all invisible from the screen. A vacuous spec is
  a false green certifying that volunteer hours are right when they are not —
  the same lie, laundered through a test. Item 26's tiebreak is explicit: when
  two tiers are arguable, take the heavier one. Labels set
  `tier/unreviewed → tier/heavy`.
- **Moved `Todo → In Progress` and re-read to confirm the claim** (item 28c;
  Linear has no compare-and-set). Read-back at 2026-08-13T03:36:36Z:
  `state = In Progress`, labels `w2 / other / heavy`, assignee null. Claim held.

- **Premise measurement, before any packet.** Three of the issue's operative
  claims checked against the tree at `b365a71`:
  - ✅ **TRUE** — `rsvps` write policies require `responded_by = auth.uid()`:
    `supabase/migrations/20260717000002_rls.sql:205-211`, on both
    `own_or_linked_write` (INSERT) and `own_or_linked_update` (UPDATE). AC 3 is
    achievable. Nuance the packet must carry: `staff_all` (`:197-199`) is `for
    all` with `check (is_staff())`, and policies are OR'd, so the RLS denial
    only fires for a **student-role** actor. A coach may write any
    `responded_by`. The mutation in AC 3 is therefore only red when driven as
    the student.
  - ❌ **FALSE / STALE** — the issue's constraint that `loaders/outreach.ts`
    "treats a student's own `responded_by` as never a deletion candidate during
    completion fan-out". That was **T118**, and T119 (PRD v2 D-7, George's
    2026-07-20 override) explicitly reversed it:
    `src/lib/supabase/loaders/outreach.ts:1398-1441` — *"`selfAuthoredKeys`
    (T118's protection mechanism) is gone -- there is no longer any row this
    fan-out skips."* Two errors in one sentence: the protection no longer
    exists, and the fan-out is in `saveOutreachEvent`'s expected-attendee
    reconciliation, not in completion — `markDayComplete` (`:1281-1377`) never
    touches `rsvps` at all. Does **not** block the work: the true current rule
    ("the checklist wins") is more interesting and is what will be tested.
  - ✅ **TRUE, and sharper than stated** — AC 5 / T309. The uncheck writes
    `status: 'absent'` rather than deleting
    (`src/pages/outreach/MarkDayCompleteDialog.tsx:494-515, 831`), and it only
    changes the database for a student who **already has a recorded attending
    row**. Unchecking a never-recorded student is a legitimate no-op. A packet
    omitting this buys the worker a wasted round or a vacuous test.


- **Dispatched `Explore` (terrain survey, read-only)** — mapping the accessible
  names/roles of every control the journey touches across
  `src/pages/outreach/**`, so the packet carries selectors the worker does not
  have to guess. *If this line is the last one in this file, the run died
  holding this subagent.* Dispatched `run_in_background: false`.
- **Verdict: `Explore` returned.** High value; two findings change the shape of
  the packet, and both would have cost the worker a round:
  1. 🔴 **The issue's journey is not achievable on one session as described.**
     `RsvpControl` is editable only while `now < starts_at` and status is
     `scheduled` (`src/pages/outreach/RsvpControl.tsx:327-329, 518`), while the
     Mark-day-complete trigger only appears when
     `formatChicagoDateOnly(now) >= session.sessionDate`
     (`src/pages/outreach/OutreachDetail.tsx:1492-1497`). Future-only vs
     today-or-past. Resolution the packet adopts: **one session dated today
     that starts later today** satisfies both predicates simultaneously.
     Fallback if the create dialog cannot express that: two sessions via
     `Custom dates`. Carried into the packet's Least-confident list.
  2. 🔴 **`RsvpControl` has no "Going" label.** `RSVP_ITEMS` is `Sign up` /
     `Maybe` / `Can't go` (`RsvpControl.tsx:301-308`), and
     `RsvpControl.test.tsx:100` asserts exactly that against "Going". "Going"
     exists only in `OutreachList.tsx:3534-3538`'s own inline copy. The issue
     says "answers Going"; the surface it names (`RsvpControl`) says
     `Sign up`. Packet routes through `/outreach/:eventId`, the only mount of
     `RsvpControl` (`OutreachDetail.tsx:812, 2406-2419`), and uses `Sign up`.
  Also carried: `Mark day complete — {date}` is the accessible name (Astryx
  `label` beats `children`, `OutreachDetail.tsx:2337-2345`) so a bare
  `Mark day complete` never matches; `AttendancePanel` and
  `MarkDayCompleteDialog` both render `checkbox`es named for the same students,
  so every dialog interaction must be scoped to `getByRole('dialog')`; and
  `StudentHome`'s RSVP is a known-open finding
  (`tests/e2e-personas/student-parent.spec.ts:66`) — do not route through it.
  One unresolved: two green specs disagree on `CheckboxListItem`'s role
  (`checkbox` vs `button`) — the worker verifies live.
- **Packet written** — `docs/swarm/active/GAM-343-packet.md`. HEAVY shape:
  environment, AC verbatim, five measured corrections to the issue body (§2),
  a cited selector map (§3), the six-step journey (§4), four required mutations
  (§5), Allowed Files (§6), and the item-19d Least-confident list (§7, five
  entries). `npm ci` completed exit 0.
- **Environment up, baseline measured.** `npm ci` exit 0; harness started under
  `sudo` (the script needs root for `su postgres`; `.env.e2e` chowned back to
  `runner`); chromium installed; `playwright@1.62.1` installed `--no-save` as
  the config's comment requires; bundle built exit 0 and previewed **IPv4-bound**
  to dodge the `[::1]` trap GAM-342 recorded. **Baseline persona suite: 27
  passed, 5 failed (3.4m).** The five are exactly the ones GAM-342 recorded as
  pre-existing — `coach-meeting.spec.ts:88` and `:115` (archived team no longer
  offered) and `student-parent.spec.ts:27`, `:66`, `:121`. Not mine; not to be
  chased.
- **Dispatched `checker-premise` (item 19 gate, round 1) on the packet**, with
  the environment LIVE so the gate can run rather than only read (item 26: "a
  gate that only reads is worth much less than one that runs"). *If this line
  is the last one in this file, the run died holding this subagent.* Dispatched
  `run_in_background: false`.
- **Verdict: `checker-premise` round 1 returned REVISE — 6 BLOCKER, 5 MAJOR,
  6 MINOR, 1 NIT.** It ran 8 probe specs in its own worktree (item 23) against
  the live cluster and browser, and confirmed its cleanup afterwards. This is
  item 26's "a gate that only reads is worth much less than one that runs"
  earning its cost: four of the six blockers are things no amount of reading
  would have found.
  - **B1** §4 step 5 is **impossible**: step 4 flips the session to `completed`,
    and `isSessionMarkDayCompleteEligible` requires `scheduled`
    (`OutreachDetail.tsx:1496`) — measured `MARK DAY TRIGGER COUNT 0`. AC 5 was
    unreachable through the prescribed journey.
  - **B2** §4 step 1 **poisons** AC 3: checking Priya in Expected attendees makes
    `computeExpectedAttendeeRsvpPlan` upsert her `going` row authored by the
    **coach** at save time — measured `responded_by` = coach id before the
    student acted. Her later click is then a no-op on an already-selected
    control. §2a documented the fan-out and I still sequenced around it wrongly.
  - **B3** AC 9 cleanup **fails**: `rsvps_session_id_fkey` and
    `attendance_session_id_fkey` are `ON DELETE RESTRICT`, so the prescribed
    cascade raises `23503` and `beforeEach` kills run 2.
  - **B4** The keystone (§7 #1) is sound **only** under two conditions I did not
    state: the date must be Chicago-derived (measured divergence *right now* —
    `CHICAGO_TODAY 2026-08-12` vs `UTC_TODAY 2026-08-13`, and the UTC value makes
    the completion trigger invisible), and the start time must be set explicitly
    late (the dialog defaults to 09:00, which locks `RsvpControl` for any run
    after 9am Chicago).
  - **B5** The `role=status` loading gate can **never** pass — permanent empty
    live regions mean it is 4 on the detail page, 8 on the list.
  - **B6** AC 4's mutation **cannot go red**: the `UNIQUE (session_id,
    student_id)` constraint turns `.insert()` into `23505`, so "still exactly one
    row" stays green.
  - **MAJOR 7** reverses my Escape guidance: the calendar is its own
    `role=dialog`, Escape closes only it, and **without** that Escape the team
    option click is intercepted by the footer. I had imported the skill's trap
    list, which describes a different dialog.
  - Also: persona switching needs explicit cookie/storage clearing (M8); only 3
    team options, archived filtered by GAM-305 (M9); a bare
    `Mark day complete` name **does** match, Playwright names are substrings
    (M10); AC 6 as written is vacuous — Priya carries 4.0 **seed** hours, so
    "Priya > 0" passes with the whole write path deleted (M11).
  - Two of my five declared doubts resolved in my favour (the dialog *can*
    express today; the additive `events` update does *not* drift a fixture), and
    `CheckboxListItem` turns out to expose **both** roles by construction, so
    neither disagreeing spec was wrong.
- **Packet revised (round 2)** — all 6 BLOCKERs and 5 MAJORs addressed. Journey
  re-routed per the gate's Cheaper Path 1: Priya is left **unchecked** in
  Expected attendees (so the coach-authored fan-out cannot poison AC 3),
  attendance is recorded through `AttendancePanel` while the session is still
  `scheduled`, and the uncheck happens in the **same** dialog pass that
  completes — there is no second pass. AC 6 becomes a before/after delta on
  `v_student_hours` cross-witnessed by the confirm label, replacing the vacuous
  "Priya > 0". AC 4's mutation red re-pointed at the status assertion (the
  UNIQUE constraint makes the row-count red impossible). Escape guidance
  reversed. Cleanup rewritten as three ordered deletes. New five-entry
  Least-confident list, all genuinely new doubts. Verified `AttendancePanel`'s
  write path myself before building on it (`AttendancePanel.tsx:641, 712, 785`).
- **Dispatched `checker-premise` (item 19 gate, round 2 of a cap of 2)** on the
  revised packet, environment still live. *If this line is the last one in this
  file, the run died holding this subagent.* Dispatched `run_in_background: false`.
- **Verdict: `checker-premise` round 2 returned DISPATCH** (2 MAJOR, both with
  measured one-line remedies; no BLOCKER). The gate did the strongest possible
  thing: it **drove the entire §4 journey green end to end, twice**, in its own
  worktree (11.6s), and confirmed cleanup returned `v_student_hours` to the
  byte-exact baseline. All six round-1 BLOCKERs verified **fixed by
  measurement**, not by acknowledgement.
  - Least-confident #1 was sound but **worse than I wrote it**: the dialog does
    seed from recorded attendance, but there is an observable transient RSVP-only
    seed first (`DLG IMMEDIATE Priya false Jordan true` → `DLG ARRIVAL Priya
    true Jordan true`), and `hasCoachTouchedChecklistRef`
    (`MarkDayCompleteDialog.tsx:1072-1075`) **latches** — so an uncheck during
    that window freezes the wrong seed and inverts AC 5 and AC 6 silently.
  - Least-confident #3 was right: the confirm label and the view do **not**
    agree exactly — `2.5` vs `2.4999999999999996`. A tolerance is mandatory.
  - The gate found a defect my §2e fix introduced: `11:59 PM` start = end makes
    the session zero-duration, so AC 6 would read `delta == label == 0` and
    **pass with the whole attendance write path deleted** — round 1's MAJOR 11
    re-entering through my own blocker fix.
  - Three caveats folded into the packet verbatim and binding: click the date
    combobox **before** filling (the prescribed order destroys the form —
    measured, cost the gate a 7-minute timeout); set an explicit per-student
    hours override so AC 6 is non-vacuous; use auto-retrying
    `toBeChecked()` on both students before the uncheck.
- **Packet gated DISPATCH and caveats folded in** (§3 date row + caveat 1 block,
  §4 step 1, §4 step 5 caveats 2 and 3, §4 step 6 tolerance, §5 AC-5 mutation
  re-cited, §2b UPDATE nuance corrected). Item 19's Definition of Ready is
  satisfied: gate returned DISPATCH in round 2 of a cap of 2.
- **Dispatched `worker-implementer`** on the gated packet. Model: default pin
  (`sonnet`) — none of item 18's four triggers apply (test files only; no
  migration, RLS, metric SQL or auth logic). *If this line is the last one in
  this file, the run died holding this subagent.* Dispatched
  `run_in_background: false`.
