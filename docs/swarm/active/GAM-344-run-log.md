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
