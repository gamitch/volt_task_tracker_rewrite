# GAM-345 — worker packet (HEAVY) — **revision 2**

**Issue:** [GAM-345](https://linear.app/gamitch/issue/GAM-345/e2e-w4-hours-and-goal-accounting-the-same-students-numbers-agree-on)
**Tier:** HEAVY (packet → `checker-premise` → worker → `checker-reviewer`), judged and defended in `GAM-345-run-log.md`.
**Branch:** `claude/gam-345-e2e-w4-hours-accounting`
**Baseline:** `main` at `93c89d0`.

**Revision 2 supersedes revision 1 in full.** Round 1 of the premise gate
returned **REVISE (BLOCKER)** and every correction below is the gate's, measured
by it against a live cluster and a live browser — not the author's second guess.
Two of the author's own claims were false and are struck. **Where this packet
contradicts the Linear issue's wording, this packet wins, and the paragraph
"Where this packet departs from the issue" says exactly where and why.**

---

## Goal

One new persona end-to-end spec that drives the W4 reporting surfaces in a real
browser as real personas, against the real cluster, and establishes whether the
same student's numbers agree across every surface that shows them — including
the two cases the metric views deliberately distinguish: a real `0%` and a
genuine *no rate*.

**This is a measurement task, not a fix.** No production file changes are
landed. Disagreements are **findings**, filed as JSON and into Linear `Backlog`
— never corrected by editing a view (the issue forbids it; T509's SQL is
correct and the gate confirmed it returns the right values).

---

## Where this packet departs from the issue, and why

The issue was written before anyone drove these screens. Three of its
statements did not survive measurement:

1. **"the CSV export" / "confirm the exported file carries the same figures".**
   There is no CSV control. `buildRosterCsv`, `buildEventsCsv` and
   `buildAttendanceCsv` (`src/pages/reports/csvExport.ts:305,372,437`) are
   **called from nowhere in `src/`**; `csvExport.ts:24-32` says so itself, and
   the gate confirmed in-browser that no export, download or CSV control exists
   on any of the three tabs. The issue's AC5 is therefore unsatisfiable. It is
   replaced by **AC5′**, a finding obligation — dead RPT-05/RPT-06 builders are
   a real item-27-shaped defect and a better deliverable than a test of a button
   that does not exist.
2. **"the leaderboard" and "the staff KPI strip" as independent witnesses.**
   The leaderboard, the Hours tab and the student's home page share **one**
   database read (see Verified context). The KPI strip carries **no per-student
   figure at all**. AC2 and AC6 are rewritten so the comparison is one that
   could actually fail.
3. **"if it is still live, the finding cites [GAM-300] rather than opening a
   new one".** GAM-300's `Math.max` floor is real but *unreachable* on the path
   this test takes. A different, live, watched defect sits there instead. It
   gets its **own** row, cross-referencing GAM-300.

Nothing here reduces the issue's intent. The cross-screen check it asks for is
still the deliverable; it is now aimed at comparisons that can fail.

---

## Verified context — measured, not assumed

Every line below was either read in the tree at `93c89d0` or **executed** by the
round-1 premise gate against a live cluster and browser. Where a fact was
executed, it says so.

### The harness API

`tests/e2e-personas/personaHarness.ts` — confirmed line-by-line by the gate:

| Export | Line | Note |
| --- | --- | --- |
| `PERSONA_PASSWORD` | `:30` | `'VoltTest!2026'` |
| `PERSONAS` | `:41` | `{admin, coach, student, parent}`, each `{email, displayName, role, profileId}` |
| `SEED` | `:71` | all 8 ids verified verbatim |
| `readRows<T>` | `:101` | superuser, **bypasses RLS** — this is your ground-truth witness |
| `readRowsAs<T>` | `:110` | `authenticated` + that persona's `auth.uid()` |
| `execAdmin` | `:126` | fixture seeding only, never an assertion |
| `execAs` | `:138` | persona write, top-level; throws 42501 on RLS denial |
| `signIn` | `:153` | real login form |
| `capture` | `:167` | full-page PNG into `tests/e2e-personas/screenshots/` |
| `visibleNavLinks` | `:173` | |

```bash
bash tests/e2e-harness/start.sh          # ~40s
npx playwright test -c tests/e2e-harness/playwright.personas.config.ts
bash tests/e2e-harness/stop.sh           # ALWAYS, even on failure
```

**The harness serves every one of these surfaces.** The gate curled every query
`loaders/reports.ts`, `loaders/leaderboard.ts` and `loaders/kpi.ts` emit —
including all four `.in(...)` list queries, the two `maybeSingle` reads, and
every view read — and got **HTTP 200 on all of them**, zero
`HARNESS_UNSUPPORTED`, zero console errors, all three tabs rendering real seeded
data. **Budget nothing for extending the harness.**

### The metric semantics under test

`supabase/migrations/20260806000000_met01_explicit_marks.sql:119-125`, quoted
verbatim (view spans `:102-130`; `v_team_participation` `:139-146`):

```sql
case
  when count(*) - count(*) filter (where status = 'excused') = 0 then null
  else round(
    100.0 * count(*) filter (where status in ('present', 'late'))
    / (count(*) - count(*) filter (where status = 'excused')), 1)
end as participation_pct
```

The `marked` CTE **inner joins** `attendance`, so a student with no marks has no
row at all. Three states, and the spec must tell all three apart:

| Case | View row | `participation_pct` | Screens must read |
| --- | --- | --- | --- |
| Marks exist, some non-excused, none present | present | `0.0` | `0%` |
| Every mark excused | **row exists** | `NULL` | em dash |
| No marks at all | **no row** | — | em dash |

`expected_ct` does **not** mean eligibility since T509; RPT-02 labels it
"Marked" (gate confirmed the live header row is
`Student Marked Present Late Excused Participation %`).

### GAM-300's floor is real but unreachable here — **corrected**

Revision 1 claimed an all-excused student reads `0%` through `checkin.ts` and
`meetings.ts`. **That was false.** Both functions return the single view row
verbatim before reaching the floor:

- `src/lib/supabase/loaders/checkin.ts:362-365` — `if (seasonRows.length === 1) { return seasonRows[0]; }`
- `src/lib/supabase/loaders/meetings.ts:517` — `if (rows.length === 1) return rows[0];`

The `Math.max(expectedCt - excusedCt, 1)` at `checkin.ts:375` and
`meetings.ts:527` executes **only** for a student with ≥2
`v_student_participation` rows in one season — a dual-team member with a mark on
a team-agnostic event. Gate-measured:

```
A no student_teams        -> 0 view rows
A with student_teams      -> expected 3, excused 3, participation_pct = NULL  (ONE row)
C dual-team all-excused   -> still ONE row (build event team_ids = [FRC] only)
C2 + team-agnostic mark   -> TWO rows (FRC 4/4 excused, FTC 1/1 excused)
```

**Do not build a dual-team student to reach the floor.** The single-team
all-excused student already produces a live red, for a different and better
reason — next section.

### The live defect this run will find, already watched once

The gate set every one of Priya's marks to `excused` (confirming
`participation_pct` read back as `null` *before* touching a screen), signed in
as `student`, and loaded `/meetings`:

```
Recent attendance
Last 4 completed meetings
Participation
Participation: null%
0%
```

Mechanism, all four links verified: `src/lib/supabase/loaders/meetings.ts:302`
declares `participation_pct: number` while the view returns SQL NULL →
`aggregateParticipationRows` returns the row verbatim (`meetings.ts:517`) →
`src/pages/meetings/StudentMeetingView.tsx:757` interpolates it into
`` label={`Participation: ${participation.participationPct}%`} `` →
`ProgressBar value={null}` renders `0%`.

**The other two surfaces are correct.** StudentHome shows `Participation: —`
(`src/lib/supabase/loaders/students.ts:838-840` returns `null` when the
denominator is 0) and the reports Participation tab shows `—`.

Reproduce this **from your spec**, on your own seeded student, and file it as a
new finding cross-referencing GAM-300 — the type lie is a distinct defect from
the arithmetic floor, and filing it under GAM-300 would bury it.

### Which surfaces are genuinely independent — **corrected**

| Surface | Reads | Independent? |
| --- | --- | --- |
| Hours tab | `.from('v_student_hours').select('student_id, season_id, confirmed_hours').eq('season_id', …)` — `reports.ts:424-428` | — |
| Leaderboard (`CoachHome.tsx:2817` → `leaderboard.ts:137-142,175`) | **byte-identical query** | **No** |
| StudentHome hours | `v_student_goal_projection` = `coalesce(sh.confirmed_hours, 0)` over the same view — `students.ts:457`, `20260723000001_dashboard_views.sql:328-332` | **No** |
| KPI strip (`AppShell.tsx:165`, `kpi.ts:175-191`) | `v_season_kpis` (season) + `v_season_kpi_team_counts` (team) — **four tiles, nothing per-student** | n/a |
| `readRows` | straight to Postgres, superuser | **Yes — the only one** |

`Leaderboard.tsx:394` `defaultLoadLeaderboardData` is a **fixture** and is not
the user's path. Do not test through it.

**What actually varies across those three renderers is formatting**, and the
gate measured a real divergence: Hours tab renders `4.0`, the CoachHome
leaderboard renders `4 hrs`.

### `confirmed_hours` is a non-terminating float

Gate-measured on a fresh seed: Priya's `v_student_hours.confirmed_hours` is
**`3.999999112222222`** (`now()`-relative seed timestamps through
`extract(epoch …)/3600.0`, `metric_views.sql:7-14`). Screens show `4.0` / `4
hrs`. **No screen carries the underlying value** — this is precisely GAM-303's
shape, and `docs/swarm/active/FINDINGS-PIPELINE.md:44-52` uses it as its worked
example. Compare with a stated tolerance.

### The seed, and the exact recipe for a new student

`tests/e2e-harness/seed.sql` (135 lines). Live values, gate-measured — do not
re-derive:

| Student | id suffix | Team | Marked | Present | Excused | `participation_pct` |
| --- | --- | --- | --- | --- | --- | --- |
| Priya Raman | `…0001` | FRC | 4 | 4 | 0 | `100` |
| Jordan Okafor | `…0002` | FRC | 3 | 2 | 0 | `66.7` |
| Sam Whitfield | `…0003` | FRC | 3 | 2 | 1 | `100.0` |
| Nina Kowalski | `…0004` | FTC | — | — | — | **no row** |
| Theo Brandt | `…0005` | FTC | — | — | — | **no row** |
| Casey Lindqvist | `…0006` | FRC | inactive | | | **no row** |

Note **Sam's excused mark raises his rate to 100%** — excused leaves the
denominator, it does not depress the rate. The three-state table invites the
opposite expectation; it is wrong.

**Neither case this task is about exists in the seed** — no all-excused student,
no genuine `0%`. Build both from the spec.

**The recipe, measured by the gate in three experiments:**

- `insert into students (…)` **alone → ZERO view rows.** This silently produces
  the *no-marks* case while you believe you built the all-excused one. It is the
  single easiest way to write a green test that proves nothing.
- Add `insert into student_teams (student_id, team_id, joined_on)` with
  `left_on` **null** → the row appears, `participation_pct` NULL.
- `students.profile_id` may be `null` — `profiles`/`auth.users` are **not**
  required for the view.
- **But AC2/AC3 read StudentHome and `/meetings`, which require a login.** For
  those legs you also need `auth.users` (with
  `harness_password = encode(sha256('VoltTest!2026'::bytea), 'hex')`),
  a `profiles` row with `role='student'`, and `students.profile_id` pointing at
  it. `seed.sql:40-54` is the pattern.
- `students.team_id` must intersect the event's `team_ids`, and the marks must
  land on **completed** sessions of an event with `counts_participation`.

**Copy `tests/e2e-personas/admin-roster.spec.ts:30-34` for cleanup** — it
already does `delete from student_teams …; delete from students where
display_name like 'E2E %'`. Do not invent a second pattern. Clean up in
`beforeEach` **and** after the run: seeded students move
`v_season_kpi_team_counts.active_students_count`, which the gate watched shift
the KPI strip to `5 · 3`.

---

## Allowed Files

Create or edit **only**:

- `tests/e2e-personas/reports-accounting.spec.ts` — new. The deliverable.
- `tests/e2e-personas/screenshots/*.png` — new captures, committed.
- `docs/swarm/inbox/claude-gam-345-e2e-w4-hours-accounting-findings.json` — new.

**Forbidden:** anything under `src/`, anything under `supabase/`,
`tests/e2e-harness/**` (including `seed.sql` — seed your awkward cases from the
spec so the shared fixture stays stable), `.github/workflows/**`, `.claude/**`,
`docs/swarm/**` other than the inbox file above, `AGENTS.md`.

**Mutation proofs are not an exception to this list.** A mutation is a
temporary, uncommitted edit made inside an **isolated `git worktree` you create**
(constitution item 23), measured, reverted, and **never landed on
`claude/gam-345-e2e-w4-hours-accounting`**. Commit your spec *before* mutating
(item 26's fast-tier working rule: T323's mutation was reverted with
`git checkout --`, which also reverted the uncommitted fix).

If a criterion genuinely cannot be met without landing a change in a forbidden
file, **stop and say so** with the specific reason. Do not edit it and disclose
afterwards.

---

## Acceptance criteria

1. **The run interacts, not just loads.** Switch between all three reports tabs,
   then **change the Participation tab's filter and apply its sort** — filter
   and sort exist *only* on that tab (`grep -c onChange` is **0** for both
   `HoursTab.tsx` and `EventsTab.tsx`). Screenshot each tab.
   *Falsified by:* a spec that only calls `page.goto` and reads text.

2. **One student's figures are read from every surface that shows them and
   compared against `readRows` as the witness**, plus an explicit
   **formatting-divergence** check between the renderers.
   The three hours surfaces share one database read, so a cross-screen *value*
   agreement there could not fail — say that plainly in the spec rather than
   claiming a comparison you did not really make. The comparison that *can*
   fail is database → each screen, and `4.0` (Hours tab) vs `4 hrs`
   (leaderboard).
   *Mutation proof required:* in your own worktree, change
   `loaders/reports.ts`'s hours mapping, re-run, record the **real red output**,
   revert, re-run green.

3. **The all-excused case reads as no-rate, not zero.** Seed the student per the
   recipe; assert `participation_pct is null` via `readRows` **before** reading
   any screen. Then assert: Participation tab `—`, StudentHome
   `Participation: —`, and `/meetings` — where the expected result is the
   **defect**, `Participation: null%`. Pin it with a comment naming
   `meetings.ts:302` + `StudentMeetingView.tsx:757` and what to change when
   fixed (skill rule: record behaviour, do not bless it). File a **new**
   finding cross-referencing GAM-300.
   *Mutation proof required, in your own worktree:* reintroduce a
   `Math.max(x, 1)`-style floor in `loaders/students.ts`'s participation path →
   the StudentHome em-dash assertion goes red.

4. **A genuine zero still reads as zero.** Seed a student with marks, none
   excused, none present — `readRows` must show `0.0`, screens `0%`.
   *Mutation proof required, in your own worktree:* make that loader return
   no-rate whenever the percentage is zero → red.

5. **(AC5′, replacing the issue's CSV criterion.) File the dead CSV builders as
   a finding.** `buildRosterCsv`/`buildEventsCsv`/`buildAttendanceCsv`
   (`csvExport.ts:305,372,437`) are unreachable from any user path — RPT-05/06
   ship no export. Confirm it yourself in the browser (enumerate the buttons on
   each tab and record the list), then file it with `verifiedBy: "browser"`,
   `area: "w4"`, in constitution item 27's shape. **Do not build a download
   assertion and do not add the missing control** — it is out of scope and out
   of Allowed Files.
   **Name [GAM-69](https://linear.app/gamitch/issue/GAM-69/t059-csv-exports-rpt-0506)
   in the finding.** The orchestrator searched Linear: GAM-69 (`T059 — CSV
   exports (RPT-05/06)`) is marked **Done**, and no open row covers the gap.
   So this is item 27's exact shape — a task recorded Passed whose user-visible
   surface no user can reach — and that, not the missing button, is the finding
   worth writing.

6. **Hours are read back from the database and compared to the screens, with a
   stated tolerance.** `readRows` on `v_student_hours.confirmed_hours`, compared
   via `toBeCloseTo(…, 3)` or equivalent — the real value is
   `3.999999112222222`-shaped and **no screen carries it**. State the
   rounding/formatting rule each screen applies. A formatting fix must not be
   able to hide a wrong value.

7. **A screenshot exists for every surface compared**, committed, named
   `<nn>-<persona>-<moment>`.

8. **Findings are emitted as JSON and filed.** Write the inbox file in
   `docs/swarm/active/FINDINGS-PIPELINE.md`'s schema **even if empty** — an
   empty `findings` array is a claim that you looked. Each finding carries
   `findingKey`, `area: "w4"`, the `provenance/e2e-personas` source, and
   `verifiedBy` naming the strongest evidence (`browser` > `mutation` >
   `database` > `source`).

9. **The suite is re-runnable without a reseed** — run the **whole** persona
   suite twice and report both exit codes — and every new assertion group is
   proven non-vacuous by at least one mutation with the real red output
   recorded. Note: the round-1 gate did **not** verify the existing suite is
   green today, so establish that baseline first and report it separately from
   your own spec's result.

Criteria 2, 3 and 4 are the point. A green run that satisfies the rest while
skipping a mutation on 2–4 is **not** a pass.

---

## Traps — do not rediscover these

- **The reports tabs are NOT `role=tab`.** Gate-measured: `getByRole('tab')`
  and `getByRole('tablist')` both count **0**. Astryx `Tab` renders
  `<button type="button" … aria-current="page">` inside `<nav aria-label="Tabs">`.
  Switch with `getByRole('button', { name: 'Hours', exact: true })`.
- Live Participation-tab controls: `Filter students` (`role=combobox`), a
  `Below 70%` toggle, `Student name` / `Participation %` radios, `Sort
  descending`. Nothing equivalent on Hours or Events.
- **`readRows` bypasses RLS.** Use `readRowsAs` when visibility is the point.
- **`execAs` for persona writes** — a data-modifying CTE is only legal at top level.
- **A blocked INSERT raises 42501; a blocked UPDATE reports `UPDATE 0`.** An
  exception-catching assertion silently passes for the UPDATE case.
- **`getByRole('heading', {name})` matches substrings** — pass `exact: true`.
- **Lists render an empty-state card with a duplicate primary button while the
  query is in flight** — wait for real data before selecting a control.
- **`Escape` closes the whole Dialog**, not just a popover inside it.
- **`pg_cron` is unavailable**, so `20260719000000_cron.sql` is not applied.
- Known unrelated baseline: three `/accept-invite` tests in
  `tests/e2e/public-routes.spec.ts` fail on a clean checkout. Not yours.
- **Stop the cluster** (`stop.sh`) when done, and say you did — a leftover
  cluster holds port 55432 and breaks the next run.
- Candidate finding the gate spotted in passing, worth confirming: the KPI strip
  showed `Active students 7` against a team breakdown of `5 · 3 = 8` — the
  breakdown appears to double-count a dual-team student.

---

## Evidence required in the completion report

- Files inspected and changed, with the **commit SHA** the work landed in
  (item 21 — "clean" is not "committed").
- Every command with its **real exit code**. Do not infer success from a pass
  count when the process exited nonzero.
- The **verbatim red output** of every mutation, the green re-run after
  reverting, and confirmation each mutation happened in an isolated worktree
  (item 23) that you then removed.
- The six gates via the `gate-run` skill — one evidence block, not piped through
  `tail`/`grep`/`wc`.
- The findings JSON path, and per finding either a Linear issue id or a stated
  reason there is none.
- An explicit statement of **what you did not check**.

---

## Least confident decisions (revision 2)

Round 1's list is retired: four of its five entries were load-bearing and two
were wrong in the direction feared. These are the remaining doubts.

1. **That the existing persona suite is green on this branch today.** The gate
   explicitly did **not** run it — it ran only throwaway probes. AC9 rests on
   that baseline. *Wrong if:* something in the suite is already red, in which
   case report the pre-existing failure separately and do not absorb it.
2. **That `loaders/students.ts` is the right mutation target for AC3.** I chose
   it because `students.ts:838-840` is the code that correctly produces the
   em dash on StudentHome. *Wrong if:* the Participation tab's em dash comes
   from `ParticipationTab.tsx`'s own `buildDisplayRows` synthesising an
   all-null row rather than from that loader — then the mutation turns only one
   of the two assertions red and the other is vacuous.
3. **That the all-excused student can be given a working login from the spec.**
   The gate proved the *view* needs only `students` + `student_teams`, and read
   the `auth.users` seeding pattern, but never created a spec-seeded student and
   logged in as them. *Wrong if:* `harness_password` or the profile trigger
   (`20260718000000_invite_trigger.sql`) rejects a row inserted this way — then
   AC3's StudentHome and `/meetings` legs must run against **Priya** with her
   marks temporarily set to excused and restored in cleanup, which is what the
   gate itself did.
4. **That a formatting-divergence check is worth asserting rather than just
   recording.** `4.0` vs `4 hrs` is a deliberate difference between a report and
   a leaderboard, not obviously a defect. *Wrong if:* asserting it pins
   cosmetic behaviour and makes the suite brittle — in which case record the
   divergence in the findings JSON as a NIT and assert only database → screen.
5. ~~That AC5′'s finding is not already filed.~~ **Resolved before dispatch.**
   The orchestrator queried Linear and grepped `docs/swarm/linear-export.md`:
   the only CSV row is **GAM-69 / T059, state `Done`**. No open row covers the
   unreachable builders, so AC5′ files a new one and cites GAM-69. Recorded
   here rather than deleted, because the search itself is the evidence.
