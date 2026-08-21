# GAM-442 — run log

Issue: <https://linear.app/gamitch/issue/GAM-442>
Branch: `claude/gam-442-event-attendance-view`
Runtime: Claude (dispatched run), 2026-08-21.

PR credential (`ghs_`) decoded at minute 1: `iat 2026-08-21T05:02:29Z`,
`exp 2026-08-21T06:02:29Z`. Draft PR must be open well before that.

---

- **05:03Z — claimed.** Read `AGENTS.md` § "Where work comes from" and
  `docs/swarm/constitution.md` (items 3, 10, 18, 19, 22, 26, 28) first.
  Fetched GAM-442 live from Linear. State was `Todo`; labels
  `tier/unreviewed`, `meetings-redesign`, `Improvement`; no `gate/human`,
  no `executor/*` route → legacy Claude-only path, claimable by this
  runtime (item 28b).

  **Tier judged before the move (item 28d): `tier/heavy`.** The issue text
  proposes STANDARD. That is wrong under item 26, whose HEAVY trigger list
  names "a migration or metric-view SQL" — this change is *both*: one new
  file under `supabase/migrations/` creating a view containing metric math
  (PRD 8.4 / DATA-01 territory). Item 26 also says take the heavier tier
  when two are arguable, and item 1 puts the constitution above issue text.
  Item 18 independently forces `model: "opus"` on the worker for the same
  two triggers. Label swapped `tier/unreviewed` → `tier/heavy`, state moved
  `Todo → In Progress`, and **read back**: state `In Progress`, label
  `heavy` (item 28c). Claim held.

  Intent: author a HEAVY packet for one additive migration creating
  `v_event_attendance`, gate it through `checker-premise`, dispatch one
  opus `worker-implementer`, then `checker-reviewer`. Known-unresolved at
  claim time: whether the `attendance` / `event_sessions` column shapes and
  the `20260806000000_met01_explicit_marks.sql` denominator convention the
  issue cites are actually as described — to be measured before the packet
  is written, not assumed from the issue.

- **05:07Z — draft PR open.** `docs/swarm/active/GAM-442-pr-body.md` written and
  validated (`check.mjs` → `OK declaration closes GAM-442`), PR
  [#222](https://github.com/gamitch/volt_task_tracker_rewrite/pull/222) opened
  as a draft at roughly minute 3 of the credential's 60. Claim comment posted to
  Linear.

- **05:16Z — packet written.** `docs/swarm/active/GAM-442-worker-packet.md`.
  Premise re-measured against `main` at `789e58b` **before** writing it
  (item 19c), and the measurement contradicted the issue in three places, all
  recorded in packet §3:

  1. **PRD 8.2 defines no per-event attendance metric** (MET-01…05 are
     student/team, season-scoped), so item 3 has **no 8.4 verbatim SQL to copy**
     for this view. `dispute-log.md:1873-1878` supplies the operative test
     instead: an entry is required when an 8.3 grant or an 8.4 formula *moves*.
     Neither moves here. That conclusion is the gate's first target.
  2. **Two attendance conventions coexist on `main`.** T509 moved
     `v_student_participation`/`v_team_participation` to explicit marks + NULL
     but left `v_season_attendance_rate` on the old eligibility cross-product
     with `greatest(count(*),1)` (`20260723000001_dashboard_views.sql:197-222`).
     Pre-existing, out of scope, explicitly not to be "fixed" here.
  3. **`held_ct` counts sessions while every other count counts marks** — two
     different things the issue's column list runs together.

  Packet deviates from the issue's "exactly one new file" to three (migration +
  assertions + runner), stated in §2 rather than done silently: the issue makes
  `scratch-postgres` mandatory, and `run_t509_explicit_marks.sh`'s own header
  records that shipping assertions without a runner was T509's defect.

  Five least-confident decisions declared (§8, item 19d).

- **05:18Z — `checker-premise` DISPATCHED** (round 1 of the two-round cap,
  item 19a), `run_in_background: false`, orchestrator blocking on the result.
  Target: packet §8's five least-confident decisions first (its charter §0),
  then §3's premise table, then §5.1's authority argument. Told to *run* a
  scratch cluster, not merely read — item 26: "a gate that only reads is worth
  much less than one that runs."

  **If this line is the last one in this file, the run died holding this
  subagent** — the packet was never gated, no worker was ever dispatched, and
  nothing under `supabase/` was written. Resume by re-running the premise gate
  against `docs/swarm/active/GAM-442-worker-packet.md`.

- **05:27Z — `checker-premise` round 1 VERDICT: `REVISE`.** Returned, waited on,
  read. It stood up PostgreSQL 16.15 in its own worktree, applied all 25
  migrations, **wrote four candidate versions of the view**, and ran every §6
  criterion against them. Two BLOCKERs, three MAJORs, three MINORs, one NIT.

  **BLOCKER-1 — the packet walked the worker into a fan-out, and none of its own
  acceptance criteria would have caught it.** §4 defined `held_ct` as completed
  sessions and `graded_marks_ct` as marks on those sessions, then mandated
  `left join`s from `events`. In the single join chain a held session with *n*
  marks appears *n* times, so `held_ct` counts sessions once per mark. Measured
  on the §6(a) fixture: `held_ct = 5` where the truth is 2, and `2` where the
  truth is 1. `attendance_pct` stays **correct**, so nothing looks wrong — and
  `held_ct` is the "across 21 held" half of the card's own headline. All four
  of §6's criteria passed on the corrupted view. Prescribed fix:
  `count(distinct es.id)` + `count(a.id)` (never `count(*)`), following
  `v_event_student_hours` (`20260723000001_dashboard_views.sql:269-291`), which
  is the same join and already solves this — plus a new criterion (a2) and a
  third mutant that asserts it.

  **BLOCKER-2 — §8 declared the wrong doubt.** Decision 2 worried about MET-01
  rollup consistency; the gate found that is *not* the live risk
  (`CoachHome.tsx:1168-1170` already ships a deliberately divergent ratio with a
  comment saying so — divergence is house practice). The real risk is the
  inverted failure mode **D014 itself records**: since T508, "no attendance row"
  is the *normal* shape for an unmarked student, so forgetting to mark someone
  **inflates** the percentage. Measured: 5-student roster, 20 held sessions,
  coach marks only the 2 who turned up each night → `attendance_pct = 100.0`.
  That is item 26's own tier test ("lie to a user about their own data") landing
  on this task. D014's stated mitigation is that the counts stay visible, and
  `20260806000000_met01_explicit_marks.sql:107-112` says verbatim that if they
  stop being shown, D014 must be revisited.

  Three MAJORs, all "this criterion passes for the wrong reason": §6(e) is
  vacuous and §6(d) is *unpassable* in the harness §6 prescribed (measured —
  `authenticated` is denied on **every** view in a bare scratch cluster, and
  `anon` has no privilege to revoke, so the runner must prepend T205's
  `alter default privileges` line); §6(f) diffs four empty result sets on an
  unseeded cluster; §8-4's fallback is already filed as **GAM-389** and shipping
  the revoke pre-empts it in one direction.

  Gate also found `run_t205_anon_grant.sh` is **red on `main` today**
  (`ERROR: role "service_role" does not exist`) and that the `scratch-postgres`
  skill's `start.sh` **cannot run in this container** (non-root `chown` refusal)
  — both pre-existing, neither caused here, both needed by the worker.

  Decisions 1, 3, 5 upheld; 4 upheld with a corrected justification (the view is
  `is_updatable = NO`, so T205's DELETE rationale does not transfer, and item 25
  forbids writing this up as a security finding); 2 overturned and re-declared.
  **No `gate/human` required for the SQL itself** — the one question that could
  have stopped work today is settled: PRD 8.2 defines no per-event metric, so no
  8.4 formula moves and no dispute-log entry is owed.

  Cluster stopped, data directory deleted, worktree removed — confirmed by the
  gate and by an empty `git status` in the shared tree.

  Round 2 of 2 (item 19a cap) now: revising the packet against all six
  prioritized revisions. A third REVISE escalates to the owner rather than
  looping.

- **05:38Z — packet revision 2 written**, all six prioritized revisions applied:
  §4.1 added (the fan-out, with the gate's measured output and
  `v_event_student_hours` named as the shape to copy); §5.3 added (D014's
  inverted failure mode carried forward, with the 100.0% measurement); §6.0
  added (the three harness facts — `start.sh` non-root failure, the T509 loop,
  and T205's `alter default privileges` line without which (d) is unpassable and
  (e) vacuous); criteria (a2) and (b3) added; (d)(e)(f) rewritten; a third
  mutant added to (g); §8 rewritten with the gate's verdict on each of the five
  original decisions plus three fresh doubts; MINOR citation fixes folded in.

- **05:39Z — `checker-premise` round 2 DISPATCHED**, `run_in_background: false`,
  orchestrator blocking. Same agent context continued via `SendMessage` so it
  grades its own findings rather than re-deriving them from scratch.

  **If this line is the last one in this file, the run died holding this
  subagent** — revision 2 of the packet was never gated and no worker was ever
  dispatched. `supabase/` is still untouched. Resume by re-gating
  `docs/swarm/active/GAM-442-worker-packet.md` at revision 2.
