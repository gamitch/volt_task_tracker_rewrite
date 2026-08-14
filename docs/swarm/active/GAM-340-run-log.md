# GAM-340 — run log

`student_teams` has no writer, so any student added since the 2026-07-21 backfill
has no membership row and returns zero rows from `v_student_participation`.

Orchestrator: Claude Code (Opus 5), dispatched from Linear 2026-08-14.
Branch: `claude/gam-340-student-teams-writer`. Base: `9d84bed`.

**How to read this file.** One line per milestone, appended and pushed as it
happens. A dispatch line with no matching verdict line beneath it means **the run
died holding that subagent** — not that the subagent is still working. This
container is ephemeral and the transcript is not saved when the job is cancelled,
so this file is the only thing that survives.

## Log

- **22:00Z — claimed.** GAM-340 fetched live from Linear: `Todo`, labels
  `area/w5` + `tier/unreviewed`, so it is ours under item 28b. Tiered **HEAVY**
  under item 26 before entering `In Progress` (item 28d): the change is a roster
  **write path**, it performs a destructive close (`left_on`) on an existing
  membership row, its output is **metric-view input** (`v_student_participation`
  INNER JOINs `student_teams`, so a bad row removes a student from the metric
  rather than skewing it), and the same rows become **RLS input** once GAM-299's
  migration is applied. Worker will carry `model: "opus"` under item 18.
  Moved `Todo → In Progress`, labels swapped to `tier/heavy`, reasoning posted as
  comment `336fb597`. **Read back: `In Progress`, `tier/heavy`, my comment last —
  claim confirmed, no competing agent.**
- **22:01Z — scope fixed.** This row takes **Part 1 only** (the writer). Part 2
  (drop the two legacy `own_or_linked_read` policies + seed `tests/rls/seed.sql`)
  is excluded on the issue's own constraint — *"Do not drop the legacy policies in
  the same change as the writer"* — and will be filed as its own row under item 20.
  The backfill decision for students created between 2026-07-21 and this fix is an
  **owner call** (`gate/human`), not decided here.
- **22:01Z — run log created and pushed.** Next: measure the premise before
  writing any packet. If `student_teams` turns out to have a writer on current
  `main`, this row goes back to `Todo` with the measurement recorded, per the
  dispatch instructions.
- **22:06Z — premise measured by the orchestrator, and it HOLDS.** Re-measured
  against branch base `9d84bed` rather than trusted from the issue (item 30c):
  (1) no `insert`/`upsert`/`update`/`delete` against `student_teams` anywhere in
  `src/`, `supabase/functions/`, `scripts/` or any migration except the backfill
  at `20260721000000_student_teams.sql:37` — the only application access is the
  read at `students.ts:486`; (2) `makeCreateStudent` (`students.ts:274-295`) and
  (3) `makeUpdateStudent` (`students.ts:302-324`) write `students.team_id` alone;
  (4) `met01_explicit_marks.sql:109` is an INNER join on `left_on is null`, and
  `st.team_id` also feeds the `e.team_ids` predicate at :113. **The run proceeds.**
- **22:06Z — packet written** to `docs/swarm/active/GAM-340-packet.md`, carrying
  two traps the issue text does not: **Trap A** — the PK is `(student_id,
  team_id)` and the migration's own text says re-joining is an UPDATE of
  `left_on`, so a plain insert raises a unique violation; **Trap B** — closing
  every non-matching active membership would silently delete a *dual-team*
  student's legitimate second team, converting a participation-gap fix into a
  participation-loss bug. Five Least confident decisions declared (item 19d).
  Allowed Files checked for `.github/workflows/**` at packet time: none present.
- **22:07Z — DISPATCHED `checker-premise` (round 1 of max 2, item 19a)** on
  `docs/swarm/active/GAM-340-packet.md`, `run_in_background: false`, model opus.
  **If this line is the last one in this file, the run died holding this
  subagent** — the packet was never gated, no worker ran, and nothing was
  implemented. Waiting for the verdict now; the next line is the verdict.
- **22:19Z — VERDICT round 1: `REVISE`** (subagent returned; the run did not die
  holding it). 1 BLOCKER, 2 MAJOR, 3 MINOR, 2 NIT. **The premise itself was
  independently re-measured and HOLDS** — the gate stood up scratch PostgreSQL
  16.14 with all 25 migrations and executed the counterfactual: membership-less
  student `vp_rows = 0`, student with membership `vp_rows = 1`. It explicitly
  recommends *not* returning GAM-340 to `Todo`. Both of my traps were confirmed
  by execution: Trap A reproduced SQLSTATE 23505 on re-join and confirmed the
  prescribed upsert reactivates; Trap B confirmed dual ACTIVE memberships are
  intended and fixtured, and team C survived the prescribed A→B move under a
  real `coach` RLS session (`is_staff() = t`).
  **The three findings that changed the outcome:**
  * **BLOCKER — my Allowed Files were undeliverable.** The gate implemented my
    prescription verbatim in a throwaway worktree and ran the suite:
    `StudentsTab.test.tsx`'s two green T089 mutation tests fail with
    `TypeError: client.from(...).upsert is not a function` and
    `client.from(...).select is not a function` (2 failed | 2456 passed). That
    file was not in Allowed Files, so a worker could not have fixed them — and
    my criterion 7 asserted the opposite of what is measurably true.
  * **MAJOR — my Trap B criterion was vacuous.** The gate implemented the exact
    design Trap B forbids (`.neq('team_id', new)`) and applied my criterion 3 to
    it: it PASSES, because the forbidden design never names team C. The
    criterion guarding the packet's headline trap guarded nothing.
  * **MAJOR — a second broken population I had not named.** The re-teamed
    students with a stale ACTIVE row for a team they left
    (`20260812000000_...sql:91-112`, fixtured `gam299_seed.sql:129-135`) are
    corrupting `v_student_participation` **today**, with no dependency on
    GAM-299 being applied — and my "close only the previous primary" rule
    *permanently entrenches* them.
  Also: `met01` `e.team_ids` predicate is at `:114`, not `:113` (my error).
  Next: revise the packet, then round 2 (item 19a caps the gate at two rounds).
- **22:24Z — packet revised for round 2.** All 8 findings dispositioned (table at
  the foot of the packet). BLOCKER fixed by adding `src/pages/roster/StudentsTab.test.tsx`
  to Allowed Files with the amendment scope bounded; criterion 3 rewritten to a
  stateful row-state assertion plus a no-`.neq()` rule, and criterion 9 gains a
  third mutation whose whole job is to prove criterion 3 can now fail; both
  broken populations documented. Two of the gate's suggestions were **declined
  with reasons rather than adopted**: the step-2.4 guard (it does not prevent the
  case it targets) and threading `previousTeamId` from the call site (the
  read-back is more correct — threading trusts a possibly-stale browser row and
  would close the wrong team). Baselines measured on this branch after `npm ci`:
  full **2458**, `loaders/` **235**, `StudentsTab.test.tsx` **34**.
- **22:25Z — DISPATCHED `checker-premise` round 2 of max 2 (item 19a)**,
  `run_in_background: false`, model opus. **If this line is the last one in this
  file, the run died holding this subagent** — the revised packet was never
  re-gated and no worker ran. A third REVISE escalates to the human owner rather
  than looping. The next line is the verdict.
- **22:35Z — VERDICT round 2: `DISPATCH`** (subagent returned; the run did not
  die holding it). No BLOCKER, no MAJOR — 4 MINOR, 2 NIT to fold in. The gate
  **executed** the round-1 fixes rather than reading them:
  * **Criterion 3 now works.** It rebuilt the rewritten criterion and ran it
    against the forbidden `.neq` implementation from round 1: all three
    assertions go red, including the row-state diff showing team C flipped
    `active → closed`. The criterion that guarded nothing now catches the exact
    design it exists to forbid.
  * **BLOCKER fix verified deliverable** — it implemented the round-2
    prescription and amended only the two T089 tests: `tsc` exit 0, full suite
    **2458 passed**, `StudentsTab.test.tsx` **34 passed**, every existing
    assertion intact.
  * **Both of my declined findings were withdrawn by the gate.** (1) Its own
    step-2.4 guard was proven a no-op across all four reachable states — "true
    precisely when the row is closed, so it opens the gate for exactly the case
    it was meant to block." (2) The threading race is **real**, and my argument
    was *understated but wrong about the mechanism*: threading does not close
    the wrong team, it **fails to close any team and re-creates population 2**
    from the very code meant to prevent it. Read-back kept, reasoning corrected.
  * **§2a measured through a real PostgREST container**, not the docs: omitting
    `joined_on` keeps it out of `DO UPDATE SET` (join date preserved); including
    it resets the date. Both directions.
  Folding MINOR-1..4 + both NITs in before dispatching the worker. MINOR-1 is
  load-bearing: my amendment instruction named the wrong failing call — it is
  `students.select()` (the read-back, the FIRST `from()`), not the second.
- **22:40Z — all 6 round-2 findings folded into the packet.** Packet is now
  gate-passed (DISPATCH) and ready for the worker. Verified no stale `:1029`,
  `:1078`, `1014-1110` or `dates.ts:41` citations remain.
- **22:41Z — DISPATCHED `worker-implementer`** with `model: "opus"` (item 18 —
  the rows written are role/permission scope input), `run_in_background: false`.
  **If this line is the last one in this file, the run died holding this
  subagent** — the packet was gated but nothing was implemented, and the branch
  carries planning artifacts only. The next line is the worker's verdict and
  commit SHA.
- **22:58Z — WORKER VERDICT: complete, committed `74340f0`** (subagent returned;
  the run did not die holding it). Six gates all exit 0: tsc, vite build,
  format:check, eslint, full suite **2476** (baseline 2458, +18), scoped
  `loaders/` **253** (baseline 235, +18); `StudentsTab.test.tsx` still **34**.
  No total dropped. All three mutation proofs reddened, including the third —
  the forbidden `.neq` design produced criterion 3c's diff
  `"team-cedar": "active"` → `"closed"`, **exactly** the diff the round-2 gate
  predicted, which is the evidence that criterion 3 is no longer vacuous.
- **22:59Z — orchestrator verified the work independently** (item 21 — existence
  is verified, not assumed): `74340f0` is real, the writer is in the **committed
  blob** (20 `student_teams` occurrences in `git show 74340f0:...students.ts`),
  the commit touches **exactly** the three Allowed Files and nothing else, and
  the tree is clean. Checked the worker's most self-serving claim rather than
  taking it: the only four removed lines in `StudentsTab.test.tsx` are
  fake-client plumbing (`const fromSpy/selectSpy/eqSpy = vi.fn(...)`), **zero
  `expect(` lines removed anywhere in the commit, and zero `.skip`/`.only`/
  `.todo` introduced.** The claim holds.
- **23:00Z — DISPATCHED `checker-reviewer`** (HEAVY requires a separate checker;
  a worker may not self-certify), `run_in_background: false`, model opus.
  **If this line is the last one in this file, the run died holding this
  subagent** — the work is committed at `74340f0` and pushed, but unreviewed,
  and no PR was opened. The next line is the checker's verdict.
- **23:08Z — CHECKER VERDICT: `PASS WITH FOLLOW-UPS`** (subagent returned; the
  run did not die holding it). No BLOCKER, no MAJOR. 1 MINOR, 1 NIT.
  It reproduced the gates independently (2476 / 253 / 34, all six exit 0),
  traced the item-27 connection end to end through `router.tsx:268` →
  `RosterShell.tsx:258` → `StudentsTab.tsx:1081` → the real
  `getSupabaseClient` (real path, real client, no stub), and verified the
  amendment boundary literally.
  **It ran SEVEN of its own mutations in its own worktree rather than trusting
  the worker's three** — including writing the forbidden `.neq` design itself
  end to end, which reddened criteria 2, 3a, 3b and 3c with exactly the
  predicted `team-cedar: active → closed` diff.
  * **MINOR — a real gap the packet's criteria did not catch.** Its mutation M5
    moved the previous-team read-back to *after* the `students` update: **the
    whole suite stays green**, yet in production that ordering makes
    `previousTeamId === payload.teamId` always, so **no close would ever fire**.
    The shipped code is correct; the guard against a future reordering is not.
    The `students` double returns a constant regardless of the update, and the
    `fromSpy` order assertion is invariant under the swap. Filed as a follow-up.
  * **NIT** — `gate-run/SKILL.md` documents 377 standing eslint warnings; the
    real figure at base `9d84bed` is **379**. Pre-existing; this change adds zero.
    Verified by the checker against base content, not accepted from the worker.
  It also confirmed the worker's "two-part mutation" was **not** an evasion: under
  the extracted helper, a one-line `.eq`→`.neq` swap would negate against the
  *previous* team, a different and weaker proof.
- **23:20Z — five follow-up rows filed** (item 20), all `Backlog` +
  `tier/unreviewed` per the `pr-body` skill's convention — a row created directly
  in `Todo` is never dispatched, and promotion is the owner's signal. GAM-390
  (missing-membership backfill, `gate/human`), GAM-391 (stale-membership
  backfill, `gate/human`), GAM-392 (**Part 2**, the legacy RLS policy drop),
  GAM-393 (the ordering-test gap the checker's M5 found), GAM-394 (eslint
  baseline 377 → 379). GAM-392 exists so this row's closure does not lose Part 2.
- **23:22Z — verification-log entry added** (item 24 — it lands with the merge).
- **23:24Z — PR body written, validated, pushed. PR NOT opened: `HTTP 401 Bad
  credentials` on both available credentials** — the GAM-333 wall, not a mistake
  to retry. Body preserved verbatim at `docs/swarm/active/GAM-340-pr-body.md`;
  `.claude/skills/pr-body/scripts/check.mjs` exits 0 on it. A human opens it with
  one paste; the command is in the Linear comment.
- **23:25Z — GAM-340 moved `In Progress → In Review`** (item 28e — never `Done`;
  the merge closes it, not me), with a handover comment leading with the one
  action needed. **Read back: `In Review`, `tier/heavy`.**
- **23:25Z — RUN COMPLETE.** No subagent was in flight at any point when this
  file was last written; every dispatch line above has a matching verdict line.
  Work is at `74340f0`, everything is pushed, nothing lives only in this
  container.
