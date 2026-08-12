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
- **Packet revision 2 written**, answering all 10 round-1 findings (§9 tables the
  dispositions). The substantive change: **the route flipped from drop-and-replace
  to an additive second permissive policy** (MAJOR-3). Reasoning, which is the
  orchestrator's call and is defended in packet §5.1: an additive policy can only
  ever *add* visibility, so the failure the issue itself feared — "every event is
  missing" instead of "one team's events are missing" — becomes structurally
  unreachable rather than merely guarded against by a bridge clause. It also
  leaves the shipped 8.4-derived policy byte-for-byte intact, which dissolves most
  of MAJOR-2's item-3 exposure. The cost is stated openly in §5.2 rather than
  hidden: a student who left a team that is *also* their legacy `students.team_id`
  keeps seeing it — a state no code path can produce, since nothing writes
  `student_teams`.
- **Dispatching `checker-premise` round 2 (opus, `run_in_background: false`)** —
  the last round before item 19a escalates to the owner. *If this line is the last
  one in this file, the run died holding this subagent.*
- **Premise gate round 2 verdict: DISPATCH** (5 MINOR, 2 NIT, no MAJOR, no
  BLOCKER). Subagent returned; nothing left in flight. The item-19 gate is
  satisfied and a worker may now be dispatched (Definition of Ready #1).

  Round 2 re-reproduced the premise independently on its own cluster and
  fixtures, then measured the **adopted** route (shipped policies untouched +
  the additive policy) across all ten acceptance criteria in both directions,
  and executed the whole four-file change end to end: six pre-existing cases
  PASS, four new cases PASS, `run.sh` exit 0, no `.github/workflows/**` edit.

  Three findings are corrections the orchestrator got wrong and is recording
  rather than quietly fixing:
  * **§5.2 was incomplete, and its blanket defence was false.** The route gives
    up a **second** configuration, not one: a **re-teamed** student. The app's
    only write path (`loaders/students.ts`) moves `students.team_id` and never
    touches memberships, so the 2026-07-21 backfill row for the *old* team is
    still `left_on is null` — and that student gains read of their **former**
    team's events (measured 0 → 1). "No code path can produce that state" is
    true of `left_on` and **false** here: the app's only write path produces it,
    and D018 records the drift as already present in data. Graded MINOR because
    `v_student_participation` already counts that stale membership, so RLS moves
    toward what the app already computes, and item 25's threat model does not
    make a former teammate's meeting list a security finding.
  * **Criterion 4's mutation was vacuous** — it does not redden. The orphan is
    denied by a *second* mechanism the packet never named: RLS on `students`
    filters the policy's own subquery. A worker replaying it would have reported
    "mutation applied, still green" and burned a rework loop on a packet defect.
    The gate supplied the mutation that does redden.
  * **§5.4's perf headline was wrong for the route actually adopted.** Round 1's
    "~33% faster" belongs to the *rejected* drop-and-replace route, which
    replaced the subplan. The additive route stacks a subplan on top: **+57% at
    20,004 events (1922-1936 ms → 2997-3038 ms), +22 ms at a realistic 500
    events.** Accepted at this scale, and now stated instead of implied.
- **Folding findings 1-8 into packet revision 3, then dispatching the worker.**
- **Packet revision 3 written** — all eight round-2 findings folded in (§12 tables
  them). The three that change what the worker will actually do: §5.2 now names
  **two** given-up configurations and withdraws the false defence, §6.4 carries the
  criterion-4 mutation that actually reddens, and §5.4 states the perf regression
  instead of claiming a win that belonged to the rejected route.
- **Dispatching `worker-implementer` with `model: "opus"`** (item 18: creates a
  file under `supabase/migrations/`, creates an RLS policy — two triggers) and
  `run_in_background: false`. *If this line is the last one in this file, the run
  died holding this subagent.*
- **Worker returned. Commit `3f1a262e3fce6bfa580a5b0b477ef4ba973b7283`.**
  Subagent returned; nothing left in flight.

  **Existence verified independently (item 21), not taken from the report:**
  `git show --stat` at that SHA lists exactly the four Allowed Files
  (migration 168 lines, `gam299_assertions.sql` 191, `gam299_seed.sql` 134,
  `run.sh` +23/-1); `git diff --name-only 28f7394..HEAD` matched **no**
  forbidden path (`.github/`, `src/`, `.claude/`, `20260717000002_rls.sql`,
  `tests/rls/assertions.sql`, `tests/rls/seed.sql`); working tree clean. The
  policy SQL in the committed blob is byte-identical to packet §5.1.

  Worker's own headline results (to be graded by a separate checker, not
  accepted here): all ten criteria green with the change and red under each
  named mutation, `run.sh` exit 0 with 38 PASS / 0 FAIL, the six pre-existing
  cases byte-identical to a merge-base run, and — the one this row has never
  had — **criterion 7 measured on real PostgreSQL 16.14**: without the
  migration the dual-team student sees 0 of team B's event and 0 of its
  session; with it, 1 and 1.

  Three things it reported that I am recording rather than smoothing over:
  * **Gate 6 (scoped vitest) did not run — 5 of 6 gates, and the worker said
    five.** There is no `src/` change, so no scope is derivable. Correct, and
    stated instead of rounded up.
  * **The performance regression reproduced**: ~+40% at 20,004 events, ~+9 ms
    at 500, on faster hardware than the gate's (+57% / +22 ms). Direction and
    cause match; absolute numbers are machine-dependent. It is in the migration
    header and must be in the PR body.
  * **The migration comment says the item-20 follow-up "is filed as a Linear
    issue". It is not filed yet** — that is orchestrator-owned work and the
    comment is currently ahead of reality. Filing it before the PR is what
    makes the sentence true.
- **Dispatching `checker-reviewer` (opus, `run_in_background: false`).** *If this
  line is the last one in this file, the run died holding this subagent.*
- **`checker-reviewer` verdict: FAIL** — 1 MAJOR, 2 MINOR, 2 NIT, no BLOCKER.
  Subagent returned; nothing left in flight.

  It replayed rather than trusted: seven mutations on its own PostgreSQL 16.14
  cluster, six reddening (criteria 1, 2, 3, 4, 5, 6) and the seventh confirming
  the documented trap stays green. Criterion 10 reproduced in both directions
  (`tee -a` → exit 1; plain `tee` → exit 0 with the FAIL printed on screen).
  Criterion 8: the pre-existing report block is **byte-identical** to a
  merge-base run. Every citation in the migration header spot-checked correct,
  including D018's verbatim quote and both PRD references — the T801/D010
  defect class, clean here. It also verified the perf figures independently
  (500 events: 22.86/23.07/25.06 ms → 31.61/32.78/34.21 ms).

  * **MAJOR-1 — the artifact ships a false sentence.** The migration comment
    says the item-20 follow-up *"is filed as a Linear issue"*. It is not filed.
    The checker queried Linear live and found no such row. This is worse than
    the T101/T121 failure item 20 was written about: those comments at least
    told the reader work was outstanding; this one tells a future reader the
    triage record already exists, so nobody files it — while the additive route
    leaves both legacy policies granting by `students.team_id` permanently and
    that row is the only thing scheduling their removal. **Correct call, and my
    error rather than the worker's** — I flagged the discrepancy in this log
    when the worker returned and then dispatched the checker without fixing it.
  * MINOR-1 — the checker partly disagrees with packet §4: it accepts that item
    3 does not bite, but argues §5.2(b)'s former-team over-grant is a widening
    the 8.3 matrix does not describe, and that D013's precedent took an owner
    ruling for exactly that. Packet §4 invited this disagreement and said it
    would be an escalation, not a rework. **Routing it to `boss-arbiter`.**
  * MINOR-2 — the `my_student_ids()` clause in the new policies is currently an
    *equivalent* mutation (removing it stays green, because `students`' own RLS
    already restricts the join). Not a defect today; becomes the sole guard if
    `students`' read policy is ever widened, which `rls.sql:90-92` anticipates.
    Follow-up row.
  * NIT-1 — the suite is **37 PASS / 0 FAIL** (6 pre-existing + 31 new), not the
    38 the worker reported and this log repeated. 37 is the number to carry.
- **Fixing MAJOR-1: filing the item-20 deferral in Linear first, so the sentence
  the migration ships is true when it cites an identifier.**
