# GAM-299 run log

`T806 — events/event_sessions RLS scopes by the legacy students.team_id`

Dispatched from Linear 2026-08-12. Branch `claude/gam-299-events-rls-memberships`.

Append-only. Every line is written **before** the thing it describes is waited on,
so that if a line is the last one in this file, the run died holding whatever that
line names.

---

- **Claimed.** Read `AGENTS.md` § "Where work comes from" and `docs/swarm/constitution.md`
  (items 18, 19, 26, 28) first. Fetched GAM-299 live from Linear.
- **Tier judged HEAVY** (item 26; done before `In Progress` per item 28d). Reasoning:
  the change is a new `supabase/migrations/` file that drops and recreates two RLS
  `select` policies. Item 26 names "RLS/auth/role logic" and "a migration" as
  HEAVY triggers directly, and item 18's first two bullets (creates a file under
  `supabase/migrations/`, creates or modifies an RLS policy) both fire, so the
  worker also carries a `model: "opus"` override. The heavier reading is also the
  correct one on consequences: the issue itself records that moving the policy onto
  memberships without handling the missing-membership gap turns "one team's events
  are missing" into "every event is missing", which is a lie-to-the-user-about-their-
  own-data failure — item 26's exact test.
- **Label swapped** `tier/unreviewed` → `tier/heavy`, then state `Todo → In Progress`,
  then re-read: state `In Progress`, labels `w5` + `heavy`. Claim confirmed (item 28c).
- **Packet written** — `docs/swarm/active/GAM-299-packet.md`. Citations re-verified
  against `main` (`28f7394`) while writing it (item 19c). Two corrections to the
  issue text recorded in the packet §2: the `event_sessions` policy ends at
  `:189` not `:188`, and T705 (the missing `student_teams` writer) is **GAM-298,
  which reads `Done` in Linear while the writer still does not exist in code** —
  re-measured by grep rather than taken from the tracker.
- **Packet-time wall check (`AGENTS.md` "Two walls", #1):** the packet's Allowed
  Files contain **no** `.github/workflows/**` path, deliberately. The new
  assertions land in `tests/rls/`, which `ci.yml:227` already runs inside the
  `sql` job, so criterion 7 is satisfied with no workflow edit and nothing
  undeliverable.
- **Dispatching `checker-premise` (opus, `run_in_background: false`)** — round 1
  of the item-19 gate, capped at two rounds (19a). *If this line is the last one
  in this file, the run died holding this subagent.*
- **Premise gate round 1 verdict: REVISE** (3 MAJOR, 6 MINOR, 1 NIT, **no BLOCKER**).
  Subagent returned; nothing left in flight.

  **The premise itself is CONFIRMED, by measurement rather than by reading** — the
  thing this row has never had. On a scratch PostgreSQL 16 cluster carrying the
  real migrations, a fixture student with ACTIVE `student_teams` memberships in
  teams A and B saw `dual sees event B = 0` and `dual sees session B = 0`, while
  `admin`/`coach` saw all 4 events. The bug is real. We proceed.

  The gate also measured the packet's own prescription working (`dual sees event B`
  1, criteria 2/3/4/5/6 all green) and ran every other SQL suite green with the
  new migration applied.

  Findings that change the work:
  * **MAJOR-1** — §3.3 permitted `tee "$REPORT_FILE"`, which **truncates** it, so
    `grep -q FAIL` at `tests/rls/run.sh:118` would only ever see the new file.
    The gate planted a FAIL in the *existing* assertions and got
    `ALL CASES PASSED`, exit 0. `tee -a` is mandatory, and a planted-FAIL check
    becomes an acceptance criterion.
  * **MAJOR-2** — constitution item 3 (PRD 8.4 RLS authority) was never addressed
    by the packet.
  * **MAJOR-3** — a cheaper route was never considered: an **additive second
    permissive policy**, leaving the shipped `own_or_linked_read` byte-for-byte
    intact. Measured working, needs no bridge clause, and the closest in-repo
    precedent (`20260804000001_widen_rsvp_read_all_authenticated.sql:7-14`) took
    exactly that route on exactly this policy name.
  * MINOR-4 corrects a sentence `T701` had already corrected once (`run.sh` skips
    two migrations by name); MINOR-5/6/7 are the author's own bad citations
    (item 19c's predicted failure mode); MINOR-8 restates §7.3's mechanism —
    `student_teams`' RLS **is** evaluated inside the `events` policy, so the
    prescription depends on `read_all … using (true)`; MINOR-9 notes the existing
    fixture students have no membership rows and ride the bridge; NIT-10 wording.
  * §7.4 resolved in the packet's favour: the new policy is ~33% **faster** than
    what ships today (2670-2681 ms vs 3975-4009 ms over 20,004 events).
- **Revising the packet for gate round 2** (19a caps this at two rounds; round 2 is
  the last one before escalation to the owner).
