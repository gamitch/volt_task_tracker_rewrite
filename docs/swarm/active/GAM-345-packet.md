# GAM-345 — worker packet (HEAVY)

**Issue:** [GAM-345](https://linear.app/gamitch/issue/GAM-345/e2e-w4-hours-and-goal-accounting-the-same-students-numbers-agree-on)
**Tier:** HEAVY (packet → `checker-premise` → worker → `checker-reviewer`), judged and defended in `GAM-345-run-log.md`.
**Branch:** `claude/gam-345-e2e-w4-hours-accounting`
**Baseline:** `main` at `93c89d0`; every citation below was read in the working tree at that commit.

---

## Goal

One new persona end-to-end spec that drives the W4 reporting surfaces in a real
browser as real personas, against the real cluster, and proves that **the same
student's numbers agree on every screen that shows them** — including the two
cases the metric views deliberately distinguish: a real `0%` and a genuine
*no rate*.

**This is a measurement task, not a fix.** No production file changes. If a
screen disagrees with the database or with another screen, that is a **finding**
filed as JSON and into Linear `Backlog` — not something to correct here, and
explicitly not something to correct by editing a view (the issue forbids it and
T509's SQL is correct).

---

## Verified context — read this before writing a line

Everything in this section was measured against the tree, not assumed. Line
numbers are from the baseline commit; re-check before quoting them anywhere.

### The harness API is exactly this, and it is all you need

`tests/e2e-personas/personaHarness.ts` exports, verified by reading the file:

| Export | Signature | Note |
| --- | --- | --- |
| `PERSONAS` | `{admin, coach, student, parent}` | each `{email, displayName, role, profileId}` |
| `SEED` | fixed ids | `teamFrc`, `teamFtc`, `teamArchived`, `activeSeason`, `meetingEvent`, `liveSession`, `studentPriya`, `studentJordan` |
| `readRows<T>(select)` | superuser, **bypasses RLS** | use for ground truth |
| `readRowsAs<T>(persona, select)` | `authenticated` + that persona's `auth.uid()` | use when visibility is the point |
| `execAdmin(stmt)` | superuser write | fixture seeding only, never an assertion |
| `execAs(persona, stmt)` | persona write, top-level | throws on RLS denial (42501) |
| `signIn(page, persona)` | real login form | polls until the path leaves `/login` |
| `capture(page, name)` | full-page PNG into `tests/e2e-personas/screenshots/` | committed |
| `visibleNavLinks(page)` | side-nav link texts | |

`PERSONA_PASSWORD` is `VoltTest!2026`. Copy the shape of
`tests/e2e-personas/coach-checkin.spec.ts`.

Run:
```bash
bash tests/e2e-harness/start.sh          # ~40s
npx playwright test -c tests/e2e-harness/playwright.personas.config.ts
bash tests/e2e-harness/stop.sh           # ALWAYS, even on failure
```

### The metric semantics you are testing — quoted, not paraphrased

`supabase/migrations/20260806000000_met01_explicit_marks.sql:102-130` is the
current `v_student_participation`. The denominator is **explicit marks minus
excused**, and the no-rate case is a real SQL `NULL`:

```sql
case
  when count(*) - count(*) filter (where status = 'excused') = 0 then null
  else round(
    100.0 * count(*) filter (where status in ('present', 'late'))
    / (count(*) - count(*) filter (where status = 'excused')), 1)
end as participation_pct
```

The `marked` CTE **inner joins** `attendance`, so a student with **no marks at
all has no row in the view whatsoever** — a different mechanism from the
all-excused NULL, and both must reach the screen as an em dash.
`v_team_participation` (`:139-148`) carries the same `case ... then null`.

Three distinct states, and the spec must tell all three apart:

| Case | View row | `participation_pct` | Screen must read |
| --- | --- | --- | --- |
| Marks exist, some non-excused, none present | present | `0.0` | `0%` |
| Every mark excused | **row exists** | `NULL` | em dash |
| No marks at all | **no row** | — | em dash |

`expected_ct` **does not mean eligibility** since T509 — the migration's own
`comment on column` says so and says the name was kept deliberately because
three loaders select it by name. RPT-02 labels it "Marked".

### GAM-300 is still live, and this is where

The issue says two loaders still apply the removed floor. **Confirmed at the
baseline commit:**

- `src/lib/supabase/loaders/checkin.ts:375` — `const denominator = Math.max(expectedCt - excusedCt, 1);`
- `src/lib/supabase/loaders/meetings.ts:527` — `const denominator = Math.max(expectedCt - excusedCt, 1);`

Both reproduce the pre-T509 `greatest(x, 1)` floor client-side, so an
all-excused student reads `0%` through those two paths while
`v_student_participation` returns `NULL`. `src/lib/supabase/loaders/reports.ts`
does **not** (its module doc #1 claims no arithmetic, and grep confirms). If the
spec catches this disagreement on screen, **the finding cites GAM-300 and does
not open a new row** (issue AC3). If it does *not* surface it, say so and name
which surfaces those two loaders actually feed — that is a real result too.

### Which surfaces are wired to real data (item 27 matters here)

Verified by grep at the baseline; do not re-derive:

- **Reports tabs** — `src/pages/reports/{ParticipationTab,HoursTab,EventsTab}.tsx`
  under `ReportsShell.tsx`, backed by `src/lib/supabase/loaders/reports.ts`
  (`loadParticipationData`, `loadHoursData`, `loadEventSessionsData`). Real.
  `/reports` is `coach`/`admin` only via `RequireRole` — a student is denied
  (there is already a screenshot `02-student-denied-reports.png`).
- **Leaderboard** — `src/pages/outreach/Leaderboard.tsx`, rendered **only** from
  `src/pages/home/CoachHome.tsx:2817`, wired to the real
  `loadLeaderboardData` (`src/lib/supabase/loaders/leaderboard.ts:175`,
  imported at `CoachHome.tsx:653`). **`defaultLoadLeaderboardData`
  (`Leaderboard.tsx:394`) is a fixture and is NOT the path a user takes** — do
  not test through it and do not report the fixture as the shipped surface.
- **KPI strip** — `src/components/kpi/KpiStrip.tsx`, mounted in
  `src/app/AppShell.tsx:165`, backed by `src/lib/supabase/loaders/kpi.ts`
  over `v_season_kpis` / `v_season_kpi_team_counts`.
- **Student home** — `src/pages/home/StudentHome.tsx`; parent equivalent
  `ParentHome.tsx`.

### The seed, and what it does *not* contain

`tests/e2e-harness/seed.sql` (135 lines). Students on season
`SEED.activeSeason`:

| Student | id suffix | Team | Marks on completed participation sessions |
| --- | --- | --- | --- |
| Priya Raman | `…0001` | FRC | 3 build present + 1 outreach present = 4 present |
| Jordan Okafor | `…0002` | FRC | present, **absent**, present |
| Sam Whitfield | `…0003` | FRC | present, present, **excused** |
| Nina Kowalski | `…0004` | FTC | none → **no view row** |
| Theo Brandt | `…0005` | FTC | none → **no view row** |
| Casey Lindqvist | `…0006` | FRC | inactive (`is_active = false`) |

**Neither of the two cases the issue's constraint is about exists in the
seed.** There is no all-excused student and no genuine-`0%` student. You must
build both deliberately, in `beforeAll`/`beforeEach`, with `execAdmin`, and
delete only your own rows so rule 3 (re-runnable without a reseed) holds.

Note `counts_participation` is true on all three seeded events, and the
outreach event has `team_ids = null` so it counts for everyone — Priya's
denominator is **4**, not 3. Do the arithmetic from the rows you seed, not from
this table.

---

## Allowed Files

Create or edit **only** these:

- `tests/e2e-personas/reports-accounting.spec.ts` — new. The whole deliverable.
- `tests/e2e-personas/screenshots/*.png` — new captures, committed.
- `docs/swarm/inbox/claude-gam-345-e2e-w4-hours-accounting-findings.json` — new.

**Forbidden, without exception:** anything under `src/`, anything under
`supabase/`, `tests/e2e-harness/**` (including `seed.sql` — seed your awkward
cases from the spec instead, so the fixture stays shared), `.github/workflows/**`,
`.claude/**`, `docs/swarm/**` other than the inbox file above, `AGENTS.md`.

If you conclude the task cannot be done without editing a forbidden file, **stop
and say so** with the specific reason. Do not edit it and disclose afterwards.

---

## Acceptance criteria

Each is graded against evidence you produce, and each names how a checker
falsifies it.

1. **The run interacts, not just loads.** At minimum: switch between all three
   reports tabs, change one filter, apply one sort, and trigger the CSV export.
   *Evidence:* the spec's own actions plus a screenshot per tab.
   *Falsified by:* a spec that only calls `page.goto` and reads text.

2. **One student's figure is read from every surface that shows it, and the
   surfaces are compared to each other — not each to a hardcoded literal.**
   The comparison is between screens, so a single wrong loader turns the
   *comparison* red rather than only its own screen's assertion.
   *Mutation proof required:* change one loader's arithmetic in **your own
   worktree** (item 23 — commit first, then mutate), re-run, and record the real
   red output showing the **cross-screen comparison** failing. Restore, re-run
   green.

3. **The all-excused case reads as no-rate, not zero, on every surface that
   shows it.** Seed a student whose every mark on completed
   participation-counting sessions is `excused`, and confirm
   `v_student_participation.participation_pct is null` via `readRows` **before**
   reading any screen.
   *Mutation proof required:* reintroduce a `Math.max(x, 1)`-style floor in a
   loader → red. `checkin.ts:375` and `meetings.ts:527` already contain one, so
   if either feeds a surface you read, the red is available without mutating
   anything — say which.
   If the defect is live, the finding **cites GAM-300** and opens no new row.

4. **A genuine zero still reads as zero.** Seed a student with marks present,
   none excused, none present — expect `0.0`, displayed `0%`.
   *Mutation proof required:* make a loader return no-rate whenever the
   percentage is zero → red.

5. **The CSV export matches the table it came from, field by field.** Not a row
   count, not a substring. Parse the download and compare cell values against
   the values read from the rendered table for the same student.

6. **Hours are read back from the database and compared to what the screens
   show.** `readRows` on `v_student_hours.confirmed_hours` for your student, and
   compare to the Hours tab, the leaderboard and the student's own home page.
   State the rounding/formatting rule you had to apply to compare, and assert
   the **underlying value**, so a formatting fix cannot hide a wrong number
   (this is what GAM-303 was).

7. **A screenshot exists for every surface compared**, committed, named
   `<nn>-<persona>-<moment>` per the harness convention.

8. **Findings are emitted as JSON and filed.** Write the inbox file in the
   schema in `docs/swarm/active/FINDINGS-PIPELINE.md` **even if you found
   nothing** — an empty `findings` array is a claim that you looked. Every
   finding carries `findingKey`, `area: "w4"`, `source` for
   `provenance/e2e-personas`, and `verifiedBy` naming the strongest evidence
   (`browser` > `mutation` > `database` > `source`).

9. **The suite is re-runnable without a reseed** — prove it by running the
   persona suite twice in a row and reporting both exit codes — and **each new
   assertion group is proven non-vacuous by at least one mutation with the real
   red output recorded**, per `mutation-replay`.

Criteria 2, 3 and 4 are the point of the task. A green run that satisfies 1 and
5–9 while quietly skipping a mutation on 2–4 is **not** a pass.

---

## Traps that have already cost time here

From the skill and from this repo's own history — do not rediscover them:

- **`readRows` bypasses RLS.** For "can this persona see it", use `readRowsAs`.
- **`execAs` for persona writes**, not `readRowsAs` — a data-modifying CTE is
  only legal at the top level.
- **A blocked INSERT raises 42501; a blocked UPDATE reports `UPDATE 0`.** An
  exception-catching assertion silently passes for the UPDATE case.
- **`getByRole('heading', {name})` matches substrings** — pass `exact: true`.
- **Lists render an empty-state card with a duplicate primary button while the
  query is in flight** — wait for real data before selecting a control.
- **`Escape` closes the whole Dialog**, not just a popover inside it.
- **Downloads:** use Playwright's `waitForEvent('download')` and read the
  saved file. Do not assert on the anchor's `href`.
- **`pg_cron` is unavailable**, so `20260719000000_cron.sql` is not applied.
- Known unrelated baseline: three `/accept-invite` tests in
  `tests/e2e/public-routes.spec.ts` fail on a clean checkout. Not yours.
- **Stop the cluster** (`stop.sh`) when done and say that you did — a leftover
  cluster holds port 55432 and breaks the next run.

---

## Evidence required in the completion report

Per constitution "Evidence Requirements" and item 21:

- Files inspected and files changed, with the **commit SHA** the work landed in
  (item 21 — "clean" is not "committed").
- Every command run, with its **real exit code**. Do not infer success from a
  pass count when the process exited nonzero.
- The **verbatim red output** of every mutation, and the green re-run after
  restoring it, plus confirmation the mutation happened in an isolated worktree
  (item 23).
- The six gates via the `gate-run` skill — one evidence block, not piped
  through `tail`/`grep`/`wc`.
- The findings JSON path and, per finding, either a Linear issue id or a stated
  reason there is none.
- An explicit statement of **what you did not check**.

---

## Least confident decisions (item 19d)

Five, each with what would make it wrong. Attack these first.

1. **That the persona harness can reach `/reports` and render all three tabs at
   all.** The skill's Tier 1 list names "roster/reports/settings/calendar/
   outreach" as verified, but no committed spec drives the reports tabs, and
   `33-coach-reports.png` exists without a spec I could attribute it to. *Wrong
   if:* any reports query hits `HARNESS_UNSUPPORTED` in
   `tests/e2e-harness/lib/postgrest.mjs` — most likely on a **view** read
   (`v_student_participation`, `v_student_hours`, `v_season_kpis`) or on the
   `.in(...)` list queries. If so the harness needs extending, which is
   **outside Allowed Files**, and the packet must come back for that decision
   rather than the worker widening its own scope.

2. **That the CSV export is reachable and downloadable in this harness.**
   `csvExport.ts` exports `buildRosterCsv`/`buildEventsCsv`/
   `buildAttendanceCsv` as pure functions; I did **not** verify which control on
   which tab invokes them, nor that the download path works headless. *Wrong
   if:* the export is triggered by a code path Playwright cannot observe, or the
   button lives on a surface other than the three reports tabs — in which case
   AC5 needs restating against whatever the real control is.

3. **That seeding the all-excused and genuine-zero students from the spec (not
   from `seed.sql`) keeps the suite re-runnable.** I forbade editing `seed.sql`
   so the shared fixture stays stable for other specs. *Wrong if:* the new
   students must exist before the app's first render in a way `beforeEach`
   cannot achieve, or if creating a `students` row also requires
   `student_teams`, `profiles` and `auth.users` rows to make the view's joins
   fire — `v_student_participation` joins `student_teams` on
   `left_on is null`, so a bare `students` insert produces **no view row**, and
   a spec that missed that would silently test the no-marks case while
   believing it tested all-excused.

4. **That the leaderboard is a genuine cross-check rather than the same read
   twice.** `Leaderboard.tsx` and `HoursTab.tsx` may both bottom out in
   `v_student_hours`, in which case AC2's "comparison" across those two is
   nearly tautological and the real independent witness is `readRows`. *Wrong
   if:* they share a loader — then say so plainly and rest AC6 on the database
   read, rather than claiming a cross-screen agreement that could not have
   failed.

5. **That the KPI strip shows a per-student figure at all.** `kpi.ts` reads
   `v_season_kpis` (season-level) and `v_season_kpi_team_counts` (per-team) —
   neither is per-student. *Wrong if:* the strip carries no figure traceable to
   one student, in which case the honest comparison is *team* or *season*
   rollup vs. the sum of the students beneath it, and the packet's AC2 should
   be read that way rather than forced.

**Not on this list because they are disclosed and accepted:** that the harness's
PostgREST is a subset (it fails loudly by design); that Edge Functions are
stand-ins (none of these surfaces uses one).
