# GAM-355 run log

**Issue:** [GAM-355 — Five pre-existing persona-suite failures are stale against
shipped fixes, not real regressions](https://linear.app/gamitch/issue/GAM-355/five-pre-existing-persona-suite-failures-are-stale-against-shipped)
**Branch:** `claude/gam-355-stale-persona-failures` (from `896e8df`)
**Orchestrator:** dispatched run, 2026-08-14.

Append-only. One line per milestone, pushed immediately. If the last line in
this file is a dispatch with no matching verdict, **the run died holding that
subagent** — that is the failure shape the constitution's delegation rule and
`AGENTS.md` § "Two walls" exist to make unmistakable.

---

## Timeline

- **Claimed.** GAM-355 moved `Todo → In Progress` and read back to confirm
  (state `720f56bf` = In Progress). Read-back is the whole claim; Linear has no
  compare-and-set.
- **Tiered HEAVY** (item 28d — tiering is part of claiming, not of finishing).
  `tier/unreviewed` swapped for `tier/heavy` on the same mutation as the claim.

  **Reasoning, stated and defensible per item 26.** The *deliverable* is almost
  certainly confined to two Playwright spec files, and on file-shape alone that
  reads STANDARD. But the deliverable is not the task. The task is a **verdict
  on five red tests: stale or real**, and the failure mode of that verdict is
  asymmetric. Three of the five assert user-facing correctness that this
  project has already been burned on — raw float hours shown to students and
  parents (GAM-303, the defect the owner personally could not read), and an
  RSVP control that wrote nothing while saying it did (GAM-304). Relabelling a
  *live* regression as "stale" edits the test until the suite is green over a
  defect that lies to a user about their own data. That is item 26's trigger
  question answered yes, one level of indirection out.

  Three further reasons the heavier tier is the right call here:
  1. The filer explicitly disclaims the premise — *"Re-verify before acting:
     this project has filed rows on premises that turned out false."* A task
     whose own body says its premise is unverified is the paradigm case for
     item 19's gate.
  2. Item 26: *"If two tiers are arguable, take the heavier one."* Both are
     arguable here; HEAVY wins by that rule alone.
  3. HEAVY's premise gate is the exact instrument this task needs — and item 26
     requires a gate that **runs** rather than reads, which here means executing
     the persona suite against a real browser and a real database, not reading
     the spec files and reasoning about them.

  Against HEAVY: none of item 26's literal HEAVY triggers (write path, RLS/auth,
  migration or metric-view SQL, cross-session export) is present, and no
  production source file is expected to change. Recorded so a wrong call is
  visible and correctable rather than silent.
- **Run log created and pushed** — this file, as the first file write.
- **Harness brought up.** `tests/e2e-harness/start.sh` needs root here (the
  scratch cluster `chown`s its data dir), and this container had no
  `node_modules`, no Playwright and no browser. Environment work, all outside
  the repo: `sudo bash tests/e2e-harness/start.sh`, `npm ci`,
  `npm i -g playwright@1.62.1`, `npx playwright install chromium --with-deps`,
  and symlinks `node_modules/playwright{,-core}` → the global install so the
  config's `import 'playwright/test'` resolves. One further adaptation worth
  recording: `npm run preview` binds **`::1` only** by default here, while the
  config's `baseURL` is `http://127.0.0.1:4174`, so `webServer` never saw its
  own server come up and timed out at 180s. Pre-starting the preview with
  `--host 127.0.0.1` lets `reuseExistingServer` find it. **No repo file was
  changed for any of this.**
- **BASELINE MEASURED on `main` @ `896e8df`, fresh seed, full suite, one run:
  32 passed / 6 failed, exit 1** (4.2m). This is the premise measurement item
  26 requires a gate to *run* rather than read — and **the premise as filed does
  not hold**:

  | Issue's claimed failure | Measured on `896e8df` |
  | -- | -- |
  | `coach-meeting.spec.ts:88` team-scope dropdown | **FAILS** — as filed |
  | `coach-meeting.spec.ts:115` meeting round-trips | **FAILS** — as filed |
  | `student-parent.spec.ts:66` FINDING 4 (RSVP write) | **PASSES** — contradicts the filing |
  | `student-parent.spec.ts:27` FINDING 3 (hours float) | **FAILS** — as filed |
  | `student-parent.spec.ts:121` FINDING 3, parent view | **FAILS** — as filed |
  | *(not in the issue)* `outreach-lifecycle.spec.ts:149` | **FAILS** — new, unfiled |
  | *(not in the issue)* `student-checkin.spec.ts:182` | **FAILS** — new, unfiled |

  So the filed set of five is **4 right, 1 wrong, and 2 missing**. The issue
  itself says *"Re-verify before acting"*; this is that re-verification, and it
  moved the answer. Counts differ from the filed 21/5 and 27/5 for a legitimate
  reason — specs from GAM-343 and GAM-345 have merged since — but the
  *membership* of the failing set is the part that matters and it has changed.
  Investigation continues before any packet is written.
- **PREMISE RESOLVED — it holds for all five, and the one apparent
  contradiction is a worse problem than the one filed.** Every line below is a
  measurement, each on a cluster reseeded from scratch via
  `stop.sh` + `start.sh`, each spec run **in isolation** so no other spec's
  writes are in play.

  1. **`coach-meeting.spec.ts:88` / `:115` — STALE, exactly as filed.**
     `Volt Legacy 2201` is `teams.archived = true` in the seed and is no longer
     offered by the scope picker: `ScheduleMeetingsDialog.tsx:277,885` filters
     through `excludeArchivedTeams` and `:1236` disables any archived team that
     is still selected. That is **GAM-305 shipped**, and the spec at
     `coach-meeting.spec.ts:100-104` predicted this exact outcome in a comment —
     *"If a fix lands that filters archived teams out of the scope picker, this
     line is the one to delete."* `:88` fails on the option-list equality;
     `:115` times out at 90s clicking an option that no longer exists (line 126).
  2. **`student-parent.spec.ts:27` / `:121` — STALE, and the "selector
     regression" the issue asked us to investigate is the fix landing.** The
     page snapshot at failure reads `Outreach hours vs. your goal 4.0 / 100.0 h
     (4%)`. The old selector `getByText(/\/ 100 h \(/)` requires the literal
     `/ 100 h (`; the rounded render says `/ 100.0 h (`, so it matches nothing.
     Note this is **not** merely a selector drift — `:44` asserts
     `expect(label).not.toMatch(/^\d+(\.\d)? \/ 100 h/)`, i.e. it asserts the
     label is *not* a clean rounded figure, which is now the opposite of the
     truth. **GAM-303 shipped.** The test is a bug-witness that outlived its bug.
  3. **`student-parent.spec.ts:66` — STALE as filed, and the reason my first
     run disagreed is a second defect.** Isolated on a fresh seed it **fails**
     at line 88 (`expect(after).toHaveLength(0)`), and the database confirms the
     write it denies: `session 5e55…0008, status=going, responded_by=a000…0003`
     (Priya's own profile). **GAM-304 shipped.** In the *full* suite the same
     test **passes** — because `outreach-lifecycle.spec.ts` runs first, creates
     an outreach event, and that new opportunity takes the slot the test's
     `getByRole('button', {name:'Sign up'}).first()` grabs. The RSVP is then
     written against a different session, the query against `…0008` finds
     nothing, and the assertion "no write happened" is satisfied **by looking at
     the wrong row.** A test that proves nothing while green is worse than one
     that is honestly red, and this one is currently both depending on how it is
     invoked. The packet must fix the order-dependence, not just the premise.

  So the issue's five are **all genuinely stale against shipped fixes** and its
  headline claim is correct. The mismatch in the first baseline was the suite's
  own order-dependence, not a wrong filing.

  **The two unfiled failures are real, reproduce in isolation, and are NOT this
  issue's work** (item 20 — they get their own rows, not a widened scope):
  - `outreach-lifecycle.spec.ts:149` fails at line 233 on a fresh seed with no
    other spec running: the coach's RSVP fan-out writes **no** `rsvps` row for
    Jordan (`toHaveLength(1)` receives `[]`). A write path that records nothing
    is a candidate production defect, not a stale test.
  - `student-checkin.spec.ts:182` fails at line 216 on a fresh seed: it waits
    for a checkbox named `/Jul 14/`, and the dialog renders `Wed, Jul 15` and
    `Mon, Aug 24`. `seed.sql` builds every date from `current_date`, so these
    hardcoded labels track the day the harness was seeded — Aug 13 when the
    spec was written, Aug 14 today. A calendar-dated test against a
    relative-dated seed goes red on its own the next morning.
- **Packet written** — `docs/swarm/active/GAM-355-packet.md`. Two Allowed Files
  (`coach-meeting.spec.ts`, `student-parent.spec.ts`), seven acceptance
  criteria, five declared least-confident decisions (item 19d). No `src/**` in
  scope: every underlying fix has already shipped.
- **DISPATCHED `checker-premise`** on `docs/swarm/active/GAM-355-packet.md`
  (round 1 of the two-round cap, item 19a), `run_in_background: false`.
  *If this line is the last one in this file, the run died holding this
  subagent* — no verdict was ever seen, and nothing below it happened.
- **`checker-premise` round 1 VERDICT: REVISE** (MAJOR). Verdict seen and
  recorded — the dispatch above did not orphan. The gate ran rather than read:
  it took its own worktree (`/tmp/gate355`, item 23), authored a full candidate
  fix for AC1-AC5, executed it, ran the full suite twice on fresh seeds, and
  left the shared tree byte-identical. It cost ~113K tokens and 65 tool calls,
  which item 19a prices as break-even-to-positive for one round. It was worth
  more than that here.

  **It falsified a claim of mine, and the correction matters more than the
  packet edits.** I wrote above that `outreach-lifecycle.spec.ts:149` shows
  *"a write path that records nothing … a candidate production defect."*
  **That is false.** The gate queried the database after a run in which line 233
  failed with `Received array: []`, and the row was there:
  `student_id=57000000-…-0002, status=going, responded_by=a0000000-…-0002` —
  exactly what lines 234-235 assert. The spec polls only for the `events` row
  (`:222`) and then reads `rsvps` synchronously (`:232`), while
  `reconcileExpectedAttendeeRsvps` runs after `createOutreachEvent` and
  `insertSessions` (`src/lib/supabase/loaders/outreach.ts:1626-1640`). It is a
  read-after-write race **in the test**. Had I filed it as I first wrote it, I
  would have filed a production defect that does not exist — the precise failure
  `docs/swarm/2026-08-09-tracker-migration.md` records and that this issue's own
  last line warns about. The earlier entry is left standing rather than edited,
  because deleting the error deletes the evidence that the check happened
  (item 30c).

  Three MAJORs against the packet, all measured:
  1. **AC6's remaining-failure set is not deterministic.** Two full-suite runs,
     same code, same fresh seed: run 1 left `reports-accounting.spec.ts:333` +
     `student-checkin.spec.ts:182` red; run 2 left `outreach-lifecycle.spec.ts:149`
     + `:182`. `outreach-lifecycle:149` and `reports-accounting:333` are a
     **coupled pair** — when :149 passes it logs a `2.5 h` override for Priya on
     a surviving event, and :333 then reads `6.499999118888889` against an
     expected `4`. Exactly one of the two fails per run. A worker told to expect
     a fixed set would chase a phantom or edit a third file.
  2. **AC7 is unsatisfiable.** `capture()` rewrites
     `tests/e2e-personas/screenshots/*.png` on every run, so running the suite
     dirties the tree by construction — 37 PNGs are already modified here, by my
     own measurement runs.
  3. **The `outreach-lifecycle:149` filing** must be corrected before it is
     written, per the falsification above.

  Plus four MINORs and two NITs, each with the measurement behind it:
  `coach-meeting.spec.ts:110` also clicks the archived option and must go (AC1
  named only the option list); the exclusion actually happens at
  `ScheduleMeetingsDialog.tsx:854-855,861`, not `:885` (which does the
  opposite); **`events.created_by` is still `NULL` — FINDING 2 has not shipped,
  so AC2's "run it and decide whether to flip" is answered and lines 172-175
  stay verbatim**; and the rewritten AC5 test needs a `test.beforeEach` cleanup
  or it fails its own `before` assertion on a second run without a reseed.

  Confirmed sound: all five §1 staleness claims, the `.first()` order-dependence
  mechanism, §7.1 (the Sign up button *can* be pinned, via
  `role=group "Sign-up opportunities"` + `listitem` filtered on
  `Library STEM Night`), §7.2 (no product finding hiding behind line 126),
  §7.3 (`4.0 / 100.0 h` is stable — both surfaces share one format string,
  `StudentHome.tsx:1643-1645` / `ParentHome.tsx:1452-1454`), and §7.5 (no
  `src/**` change needed; the gate's candidate fix turned all 12 tests in the
  two files green with zero source edits, `tsc --noEmit` clean).
- **Packet revised** against all nine round-1 findings (3 MAJOR, 4 MINOR,
  2 NIT) and pushed. AC1 gains the line-110 deletion and the corrected
  `ScheduleMeetingsDialog.tsx:854-855,861` citation; AC2 carries the measured
  `created_by IS NULL` answer instead of a question; AC3/AC4 gain the shared
  format string and the warning that the hours value moves every reseed; AC5
  gains the gate's tested locator and a `beforeEach` cleanup, and withdraws the
  §7.1 fallback; AC6 stops naming a fixed failure set and names the coupled
  flaky pair instead; AC7 becomes
  `git status --porcelain -- ':!tests/e2e-personas/screenshots'`. New §8 records
  the falsified `outreach-lifecycle` claim. §7's original doubts are kept
  verbatim with the gate's answers appended.
- **DISPATCHED `checker-premise` round 2** (the cap, item 19a) — continued on
  the *same* agent so it re-checks its own findings against its own
  measurements, scoped to the revision deltas per item 19b rather than
  re-auditing settled ground. `run_in_background: false`.
  *If this line is the last one in this file, the run died holding this
  subagent.*
- **`checker-premise` round 2 VERDICT: DISPATCH.** Verdict seen and recorded —
  the dispatch above did not orphan. Scoped as instructed (5 tool calls, no
  suite re-run): no BLOCKER, no MAJOR, all three round-1 MAJORs confirmed fully
  fixed. It also empirically verified AC7's new measurement command —
  `git status --porcelain -- ':!tests/e2e-personas/screenshots'` returns **0**
  lines against the 37 dirty PNGs — rather than taking my word that the
  pathspec does what it says.

  Four fold-in edits, all applied before the worker is dispatched:
  1. **§8 cited the wrong line for the `events` poll — `:222` is the sessions
     assertion; the poll is `:217`.** An unverified line number *inside the
     paragraph correcting an unverified claim*, which is item 19c's failure
     class arriving twice in a row. Fixed, and the `outreach.ts` span widened
     from `1626-1640` to `1627-1643` so it no longer truncates the call.
  2. AC5's `beforeEach` had an elided `student_id = '…'` and silently required
     an import that does not exist — `execAdmin` is not in
     `student-parent.spec.ts`'s import line. Both resolved in the packet; a
     literal `…` pasted into SQL would have failed all 7 tests with an opaque
     `invalid input syntax for type uuid`.
  3. AC2's "lines 172-175" started mid-comment; corrected to 169-175 with the
     comment/assertion split named.
  4. AC5 now says the locator is *"the gate's measured starting point, not a
     substitute for running it"* and admits the click line is a condensed form
     of what was actually executed — the gate's own point that over-specifying
     invites transcription in place of verification.

  Polish also taken: §7.4's label softened from WRONG to "decision SOUND,
  supporting claim FALSE" (the *decision* to keep those two out of scope
  stands, and AC6 depends on it); §1a's "passes in the full suite" qualified as
  contingent on `outreach-lifecycle:149` failing; and AC3 now names the three
  false things in the spec's own comment rather than calling it merely stale.
  **Definition of Ready satisfied — item 19's gate has returned DISPATCH.**
- **DISPATCHED `worker-implementer`** on the gated packet, default (sonnet)
  tier — item 18's four opus triggers are all absent: no migration, no RLS or
  security definer, no metric-view SQL, no auth/session/role logic. Two test
  files, no `src/**`. `run_in_background: false`.
  *If this line is the last one in this file, the run died holding this
  subagent.*
- **`worker-implementer` VERDICT: work delivered, commit `1861561`.** Verdict
  seen and recorded — the dispatch above did not orphan. Independently verified
  by the orchestrator rather than taken from the report (item 21: "clean" and
  "committed" are different claims): `git log` shows HEAD at `1861561`,
  `git show --stat` shows exactly
  `tests/e2e-personas/coach-meeting.spec.ts` (+15) and
  `tests/e2e-personas/student-parent.spec.ts` (+64), 47 insertions / 32
  deletions, **two files, both in Allowed Files, no `src/**`**, and
  `git status --porcelain -- ':!tests/e2e-personas/screenshots'` is empty.
  The worker reports `npm run typecheck` exit 0, both specs green in isolation
  (7 passed / 5 passed) and the full suite at 36 passed / 2 failed, exit 1,
  with the two failures being exactly the out-of-scope pair AC6 predicted. It
  correctly declined to self-certify.

  One deviation it declared rather than hid: it widened the percentage match to
  `\d+(\.\d)?%` instead of the measured `\d+%`, on the packet's own "do not
  over-fit" instruction. That is a judgement call the checker should grade, not
  something to wave through here.
- **DISPATCHED `checker-reviewer`** on commit `1861561` against the packet's
  AC1-AC7. `run_in_background: false`.
  *If this line is the last one in this file, the run died holding this
  subagent.*
- **`checker-reviewer` VERDICT: PASS, one MINOR + two NITs.** Verdict seen and
  recorded — the dispatch above did not orphan. It ran rather than read: three
  reseeds, isolated and full-suite runs, direct `psql` reads, and **four
  mutation experiments in its own worktree** (`/tmp/gam355-mut`, own bundle on
  port 4185, removed after — item 23 honoured).

  It independently confirmed every worker claim: typecheck 0; 7 and 5 passed in
  isolation; 36/2 exit 1 on the full suite; FINDING 2's assertions verbatim;
  nothing outside the two Allowed Files. It also proved AC5's order-independence
  the only way that counts — in its full-suite run `outreach-lifecycle` inserted
  its RSVP at `02:23:59` and this spec's click still landed on
  `5e55…0008 / Library STEM Night` at `02:25:20`. That is the exact interference
  that made the old test lie, now defeated.

  **Mutation proofs that the rewritten tests have teeth**, which is the evidence
  I most wanted: forcing the RSVP write to `status:'maybe'` turned AC5 red
  (`Expected "going" / Received "maybe"`); forcing `respondedBy` to another id
  turned it red via RLS. Reverting the student-side format string to the
  pre-GAM-303 raw float turned the student test red
  (`Received "6.499999118888889 / 100.0 h (6.5%)"`) while the parent test stayed
  green — the partial-fix scenario §7.5 declared as a doubt, caught.

  **The worker's declared deviation was not merely defensible — it was
  necessary, and my packet was wrong.** `hoursVsGoalPercent` is
  `Math.min(100, round1(...))`, so a decimal percentage is reachable by
  construction, and the checker observed `(6.5%)` live. Pinning to the packet's
  measured `4%`, as I specified, would have shipped a test that is red on
  today's database. Recorded because I over-fitted a locator to one observation
  in the same packet where I warned the worker not to.

  **I am escalating the MINOR to MAJOR and sending the work back.** The checker
  offered that grading explicitly — *"if the orchestrator reads AC3's
  screen-vs-database sentence as a hard requirement of a positive comparison,
  escalate to MAJOR."* I do, and I wrote that sentence. Its demonstration is
  decisive: with the formatter mutated to `(value / 2).toFixed(1)` the page
  rendered **`3.2 / 100.0 h`** against a database value of
  **`6.4999991188888889`**, and **both rewritten hours tests stayed green**. A
  student's own hours halved on screen, undetected. The test being replaced did
  compare screen to database (`toContain(String(raw))`); the rewrite kept only
  the negative half. Passing that as MINOR-with-a-follow-up would make this task
  a net loss on the one property it is named for — and item 26's trigger
  question, "can a mistake here lie to a user about their own data", is the
  reason this row was tiered HEAVY in the first place. The fix is one line, the
  checker showed `confirmed_hours` is stable within a run (identical across two
  reads 20s apart) so a strict comparison is not flaky, and attempt 2 of 3 is
  free.
- **DISPATCHED `worker-implementer` (attempt 2 of 3)** for the one-line
  strengthening. `run_in_background: false`.
  *If this line is the last one in this file, the run died holding this
  subagent.*
