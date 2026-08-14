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
