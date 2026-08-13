# GAM-344 — run log

**Issue:** [GAM-344 — E2E — W3 Run a meeting: schedule → attendance → participation %](https://linear.app/gamitch/issue/GAM-344/e2e-w3-run-a-meeting-schedule-attendance-participation-percent)
**Branch:** `claude/gam-344-e2e-w3-run-a-meeting`
**Base:** `93c89d0`

This file is appended to and pushed at every milestone. It exists because the
container is ephemeral and the transcript is not saved when the job is
cancelled (run 31358757094 lost roughly an hour of real work that way). If it
ends mid-sequence, the last line is what happened.

**Convention for delegation, written so a truncated log indicts the run:** a
dispatch line and its verdict line are two separate entries. *If a dispatch
line is the last line in this file, the run died holding that subagent* — five
runs have (31354278407, 31385764526, 31514339272, 31523233268, 31527801235).
Every subagent here is dispatched `run_in_background: false` and waited on.

---

## Log

- **03:37Z — claimed.** `Todo → In Progress`, read back and confirmed held
  (state `In Progress`, labels `other`, `w3`, `heavy`). Claim comment posted to
  the issue before the state write.
- **03:37Z — tiered HEAVY** (item 28d: judged *before* entering `In Progress`).
  `tier/unreviewed` removed, `tier/heavy` applied. Reasoning, recorded on the
  issue and defended again in the PR per item 26:
  - Item 26's test is "can a mistake here corrupt data, or lie to a user about
    their own data?" This row ships tests, not production code — but it drives
    `endMeeting`'s three-step untransacted write (absences → checkouts →
    status flip) and a saved-series edit that T510 closed two data-loss paths
    in. Write paths are a named HEAVY trigger.
  - The issue carries a booby-trap: `cancelSession` in `loaders/meetings.ts` is
    *deliberately* time-unguarded, and adding the guard for symmetry was
    measured to restore data loss. A packet that does not pre-empt that can
    send a worker to reintroduce a known defect. That is what `checker-premise`
    is for.
  - An argument for STANDARD exists (no production diff expected). Item 26's
    tie-break — take the heavier tier when two are arguable — settles it.
  - **Gate cost is scoped by item 19b, not waived.** The persona-E2E pattern is
    already proven (GAM-342 shipped it for W1), so the premise round is a
    *light* check aimed at the trap, the mutation prescriptions and the
    acceptance criteria — not a re-audit of `personaHarness.ts`.
- **03:38Z — branch created**, run log written first (before any other file
  write), committed and pushed.
- **03:40Z — orientation, and four corrections to the issue's own premises.**
  Item 19c says verify your citations before submitting, so these were measured
  against the tree at `93c89d0` rather than copied from the description:
  1. **Paths.** The issue says `loaders/meetings.ts` / `loaders/endMeeting.ts`.
     The real paths are `src/lib/supabase/loaders/`.
  2. **`EndMeetingDialog` is NOT reachable from `MeetingsList`.** The issue's
     screen list implies it is. Its *only* mount is `LiveConsole.tsx:1187`
     (`endMeeting.ts:478` says so and grep confirms: no other non-test mount).
     A coach reaches it at `/meetings/live/:sessionId`, not from the list.
     A worker given the issue's screen list would hunt for a button that does
     not exist.
  3. **The absence opt-in checkbox has a dynamic accessible name.**
     `EndMeetingDialog.tsx:572` builds it as `Mark ${count} student(s) with no
     attendance record absent`. It must be matched by regex, not literal text —
     and it renders only when there is something to mark (`:987`).
  4. **The seed's live session cannot be edited.** `makeSaveMeetingSession`
     (`meetings.ts:1036-1046`) guards `.eq('status','scheduled')` **and**
     `.gt('starts_at','now')`, and rejects on zero matched rows. `SEED.liveSession`
     (`5e550000-…-04`) starts 30 minutes in the *past* (`seed.sql:91`), so an
     edit against it rejects by design. Session `…-05` (+7 days) is the editable
     one.
- **03:41Z — the `cancelSession` trap confirmed as the issue describes it, and
  it is real.** `meetings.ts:788-792` `cancelSession` carries no time guard;
  `deleteSessionIfStillFuture` at `:764-773` carries `.gt('starts_at','now')`.
  The comment at `:775-787` states the asymmetry is deliberate and load-bearing
  (D016 §3) and that "hardening" it back reintroduces the defect. This is the
  single most likely way this row damages production code, and the packet must
  forbid it explicitly.
- **03:45Z — environment premise MEASURED, and it needed a fix.**
  `node_modules` and the Playwright browsers were absent: `npm ci` + `npx
  playwright install --with-deps chromium` both exit 0.
  `bash tests/e2e-harness/start.sh` **fails as `runner`** —
  `.claude/skills/scratch-postgres/scripts/start.sh:58` does `chown postgres`
  and `su postgres`, i.e. it assumes root (`chown: … Operation not permitted`,
  exit 1). **`sudo bash tests/e2e-harness/start.sh` succeeds** (exit 0):
  postgres 16.14, seeded 5 profiles / 6 students / 3 events / 8 sessions / 10
  attendance, API on `127.0.0.1:54321`. `psql` as `runner` over loopback TCP
  works, so `readRows`/`execAs` need no change. **This `sudo` correction is not
  in the skill and not in the issue; it goes in the packet.**
  Two further gaps, both matching GAM-342's record: `playwright` is not in
  `package.json` at all, installed `--no-save` at `1.62.1` (`package.json` and
  the lockfile verified byte-identical afterwards); and `vite preview` binds
  IPv6-only while the config polls `127.0.0.1`, so the preview is started by
  hand with `--host 127.0.0.1` and `reuseExistingServer` adopts it.
- **04:05Z — BASELINE MEASURED: full persona suite `27 passed / 5 failed`,
  exit 1**, and it is not what I expected. **Two of the five failures are in
  `coach-meeting.spec.ts` — the exact file this row extends.** Root-caused
  rather than noted: both fail because `'Volt Legacy 2201'` (archived) is no
  longer offered in the team-scope picker. `coach-meeting.spec.ts:100-105`
  pinned that team as visible and its own comment says *"If a fix lands that
  filters archived teams out of the scope picker, this line is the one to
  delete."* **That fix landed** — `dd6e166` / `1c9dbbb` (GAM-305), filter at
  `ScheduleMeetingsDialog.tsx:885`/`:1236`. The assertion is stale exactly as
  its author predicted.
- **04:08Z — and I nearly widened scope on it.** My first instinct was that the
  worker should fix the two stale assertions, since unlike GAM-342 this row
  *owns* `coach-meeting.spec.ts`. Checked before acting: the failures are
  already filed as **GAM-355**, which sits in **`Backlog`**. Item 28a says
  `Backlog` means filed, not dispatchable — so fixing them here is taking
  Backlog work and would put two rows on one change. **Owning the file is not
  owning the row.** The packet now forbids both fixing and re-filing them, and
  the tension is recorded as Least confident decision #6 for the gate to
  attack rather than buried.
- **04:10Z — packet written** — `docs/swarm/active/GAM-344-packet.md`. Carries
  the four corrected premises, the measured baseline and its delta rule, the
  live `v_student_participation` arithmetic with exact predicted numbers for
  AC 6, the two-controls-named-"End meeting" strict-mode trap, an explicit
  forbidden list, and six Least confident decisions (item 19d).
- **04:12Z — DISPATCHED `checker-premise` (opus, round 1)** on
  `docs/swarm/active/GAM-344-packet.md`, with **`run_in_background: false`**,
  scoped per item 19b to this surface's facts and the six declared doubts rather
  than a re-audit of the proven harness pattern. **If this line is the last one
  in this file, the run died holding this subagent** — the gate never returned a
  verdict, no worker was dispatched, and nothing below was written. The next
  reader should treat the packet as UNGATED and re-run the gate rather than
  trust it. Round 2 is the cap (item 19a); a third REVISE escalates to the owner.
- **04:40Z — VERDICT round 1: REVISE (3 BLOCKER, 3 MAJOR, 4 MINOR, 2 NIT).**
  The gate returned. It ran rather than read — ~10 throwaway browser probes, a
  full suite run, `psql` simulations in rolled-back transactions, and `vitest`
  against the real exported `computeMeetingSeriesReconcilePlan`. It worked in
  its own worktree (`/tmp/gate-344`, removed) and restored the shared database
  to identical counts. **All three BLOCKERs were things my packet missed
  entirely, not things it got wrong** — which is the distinction item 19d exists
  to buy.
  - **BLOCKER 1 — my "collides with nothing" was false.**
    `attendance_session_id_fkey` is `ON DELETE RESTRICT`, so
    `coach-meeting.spec.ts:63`'s `delete from events where title like 'E2E %'`
    **throws** once any new test has written attendance. From run 2 onward every
    test in the file errors in `beforeEach`. AC 10 fails outright.
  - **BLOCKER 2 — none of my three mutations could reach the browser.** The
    suite drives a **prebuilt bundle** with `reuseExistingServer: true` against a
    hardcoded `127.0.0.1:4174`. A `src/**` mutation in the worker's worktree
    (which item 23 requires) never gets built into the bundle the browser loads,
    so all three mutations stay green and the required red output is
    unobtainable. Measured: probe runs finished in 4-6s with no build step.
  - **BLOCKER 3 — mutation 3 was a no-op and my stated mechanism was wrong.**
    `plan.toUpdate` already contains **every** kept session (measured 3/3 by
    running the real function), so "force every session into `toUpdate`" changes
    nothing. T611's actual protection lives in
    `ScheduleMeetingsDialog.tsx:1145-1151`'s `buildEditDesiredFutureSessions`.
    My §5a taught the worker a false mechanism.
  - **Two of my six declared doubts were REFUTED, and the design survives.**
    §8.1: a future session **can** be ended through `LiveConsole` — the gate
    drove `/meetings/live/…-05` and got `End meeting` plus `Mark 3 students…`,
    then completed a full end. §8.2: the series edit **is** reachable, though my
    description was wrong in three ways (a row button named `Edit – <title>`
    with an **en dash**, dialog "Edit meeting series", prefilled Custom dates).
  - **§8.3 CONFIRMED as a real defect.** The end-meeting summary loads once
    (`EndMeetingDialog.tsx:875`) and never invalidates, so marking a student in
    the console does **not** change the checkbox count. The coach is shown
    "0 present · 3 will be marked absent" immediately before a write that will
    not do that. New finding; not GAM-283 (that is failure *reporting*).
  - **§8.4 PARTLY WRONG.** Jordan 50.0 / Sam 66.7 hold everywhere; **Priya's
    100.0 → 80.0 holds only from a pristine reseed** — against the cluster as it
    stands she goes 100.0 → 100.0, because `coach-checkin.spec.ts` has already
    left her a `late` row on `…-04`. My §4 said "before any spec runs" and that
    was false.
  - **§8.5 and §8.6 SOUND.** The IPv6 bind was reproduced directly
    (`LISTEN [::1]:4179`, `curl 127.0.0.1 → 000`, `curl [::1] → 200`), and
    GAM-355's existence in `Backlog` was confirmed in the export.
  - Also returned four cheaper paths I had missed, including that the
    series-edit confirm dialog **already states** "0 added · 0 removed · 3 kept"
    on screen — the user-visible form of AC 5, free in one locator.
