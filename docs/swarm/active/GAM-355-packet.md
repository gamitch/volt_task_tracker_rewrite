# Task packet — GAM-355

**Tier:** HEAVY (packet → `checker-premise` → worker → `checker-reviewer`).
**Branch:** `claude/gam-355-stale-persona-failures`.
**Repository path:** `/home/runner/work/volt_task_tracker_rewrite/volt_task_tracker_rewrite`
(the shared tree — no worktree; see §6).

---

## 1. What is wrong

Three persona tests were written as *witnesses to bugs*. All three bugs have
since been fixed and merged. The tests still assert the broken behaviour, so
they are red against a correct application, and one of them is red-or-green
depending on which other spec ran first.

Every claim below was measured on `main` @ `896e8df`, on a cluster reseeded
from scratch, with each spec run **in isolation**. Evidence is in
`docs/swarm/active/GAM-355-run-log.md`.

| Test | Asserts today | Reality | Fix that shipped |
| -- | -- | -- | -- |
| `coach-meeting.spec.ts:88` | archived `Volt Legacy 2201` is offered in the scope picker | it is filtered out | GAM-305 |
| `coach-meeting.spec.ts:115` | same — clicks that option at line 126 | option absent; 90s timeout | GAM-305 |
| `student-parent.spec.ts:27` | student hours render as a raw float | render is `4.0 / 100.0 h (4%)` | GAM-303 |
| `student-parent.spec.ts:121` | parent view, same | same | GAM-303 |
| `student-parent.spec.ts:66` | an RSVP "never reaches the database" | it writes `rsvps` | GAM-304 |

### 1a. The one that is worse than stale

`student-parent.spec.ts:66` **passes in the full suite and fails in
isolation**, and the green is the wrong answer. It grabs
`page.getByRole('button', { name: 'Sign up' }).first()` and then queries
`rsvps` for one hardcoded `session_id` (`5e550000-…-000000000008`). When
`outreach-lifecycle.spec.ts` runs first it creates an outreach event whose
opportunity takes that first slot, so the click RSVPs to a *different* session,
the query finds nothing, and "no write happened" is satisfied by looking at a
row the user never touched. Fixing only the premise and leaving `.first()`
in place re-arms exactly this.

Measured write, fresh seed, spec isolated:
`session_id=5e550000-0000-4000-8000-000000000008, status=going,
responded_by=a0000000-0000-4000-8000-000000000003` (Priya's own profile).

---

## 2. Allowed Files — the complete list

- `tests/e2e-personas/coach-meeting.spec.ts`
- `tests/e2e-personas/student-parent.spec.ts`

**Nothing else.** In particular **do not** touch `src/**` (every underlying fix
has already shipped — a source change here means you have misread the task),
`tests/e2e-harness/**`, `docs/swarm/**`, `.claude/**`, or `.github/workflows/**`
(that last one is unpushable from a dispatched run at all — `AGENTS.md`
§ "Two walls").

If you believe a file outside this list must change, **stop and report it**
rather than changing it. Under item 20 a deferral becomes a filed row, not a
comment.

---

## 3. Acceptance criteria

Each is measurable today, against fixtures that exist today. **Every line
number below is a PRE-EDIT line number** — they shift as soon as your first
deletion lands (`:115` becomes `:110`, `:66` becomes `:64`), so navigate by
test name once you have started editing.

**AC1 — `coach-meeting.spec.ts:88` passes.** Two edits, not one:
  - the expected option list becomes exactly
    `['Select all', 'Volt Robotics 9911', 'Volt Junior 4402']`; **and**
  - **line 110 — `await page.getByRole('option', { name: 'Volt Legacy 2201' }).click();`
    — must also be deleted.** It clicks an option that no longer exists, so
    removing only the list entry leaves the test red. (Gate finding, round 1.)

The comment at lines 100-104 is a stale regression guard for FINDING 1 and must
be replaced with one recording that GAM-305 shipped and that `Volt Legacy 2201`
is `teams.archived = true` in `seed.sql`. **Cite it correctly:** the exclusion
happens at `ScheduleMeetingsDialog.tsx:854-855` and `:861` —
`excludeArchivedTeams` → `allTeamIds` → the initial `selectedTeamIds`. Line
`:885` does the *opposite* (it re-includes an archived team that is already
selected) and `:1236` renders such a team disabled; cite those two only for
that secondary behaviour, and do not attribute the exclusion to them.

The test must still prove the *narrowing* half: after deselecting
`Volt Junior 4402` the combobox reads `Volt Robotics 9911`.

**AC2 — `coach-meeting.spec.ts:115` passes end to end.** Delete the
`Volt Legacy 2201` click (line 126). That is the whole change — measured by the
round-1 gate, which deleted exactly that line and watched the test pass
(`✓ a single meeting round-trips to events + event_sessions (4.3s)`).
**Keep every post-write row assertion exactly as it is** — `type`,
`location_name`, `season_id`, `team_ids`, `counts_participation`,
`counts_volunteer_hours`, the session date, the `23:30:00Z` / `01:45:00Z`
boundary, `status`, `notes`. Those are the point of the test and none of them
is stale.

**`events.created_by` is still `NULL`. Do not change lines 172-175.** The
earlier version of this packet asked you to run it and decide; that question is
answered — the gate created a meeting as the coach on a fresh seed and read the
row back: `team_ids={7ea11000-…-0001}, created_by=<null>, counts_participation=t,
counts_volunteer_hours=f`. FINDING 2 has **not** shipped and its assertions stay
verbatim.

Sanity check while you are here: `team_ids` arriving as `[SEED.teamFrc]` is the
measured outcome, because the dialog defaults to all **non-archived** teams and
you deselect one of the two.

**AC3 — `student-parent.spec.ts:27` asserts the shipped behaviour.** Rename it
so it no longer claims hours are a raw float; it is now a regression guard for
GAM-303. It must assert that the label is a *rounded* figure and that it does
**not** contain the raw float from `confirmedHours()`. Do not weaken it to
"some text is visible" — the whole value of this test is that it compares the
screen against `v_student_hours`. Note the goal now renders `100.0`, not `100`,
so the old `/\/ 100 h \(/` selector matches nothing; pick a selector that
survives a goal of `100.0` and does not depend on a specific hours value.

The `.0` is not incidental and you can rely on it: both surfaces share one
format string, `` `${value.toFixed(1)} / ${max.toFixed(1)} h (${hoursPercent}%)` ``
(`StudentHome.tsx:1643-1645`, `ParentHome.tsx:1452-1454`), and `max` is
`goal_hours = 100`. The **hours** value is not stable — `confirmed_hours` is
recomputed from `now()` at every reseed (`3.9999991025` at the time of the
gate's run, not the `3.9999983633333334` the spec's own comment claims), so do
not pin to a literal. That stale comment should be corrected too.

**AC4 — `student-parent.spec.ts:121` does the same for the parent view.** Same
rename, same substance. The parent-side test currently asserts
`toContain(String(raw))`; that must invert.

**AC5 — `student-parent.spec.ts:66` asserts the write, and is
order-independent.** Rename it: the RSVP does reach the database. It must
assert the row that is actually written — `status` and `responded_by` — for
the session the click actually targeted, and it must **not** use
`getByRole('button', { name: 'Sign up' }).first()` against an unqualified list.
Pin the click to the seeded session so that a spec running before this one
cannot change which button `.first()` finds. Prove the fix: this test passes
both in isolation *and* in the full suite.

The pin is feasible and the round-1 gate wrote and ran it — use this rather
than rediscovering it. Session `5e55…0008` belongs to event `Library STEM Night`
(`seed.sql:96-97`), the section is a `role=group` labelled
`Sign-up opportunities` (`StudentHome.tsx:1683-1706`), and each opportunity is a
`listitem` whose label is the event title (`StudentHome.tsx:1326-1362`,
`unansweredOutreach.ts:122`):

```ts
const opportunities = page.getByRole('group', { name: 'Sign-up opportunities' });
const row = opportunities.getByRole('listitem').filter({ hasText: 'Library STEM Night' });
await expect(row).toHaveCount(1);
await row.getByRole('button', { name: 'Sign up' }).click();
```

The §7.1 fallback (a before/after `rsvps` diff by `student_id`) is **withdrawn**
— it is weaker, because it would no longer prove *which* session the click
targeted, which is the whole point of AC5.

**The rewritten test must also be re-runnable without a reseed.** Add a
`test.beforeEach` to `student-parent.spec.ts` that deletes only its own row,
mirroring the in-repo idiom at `coach-meeting.spec.ts:62-64`:
`execAdmin("delete from rsvps where student_id = '…' and session_id = '5e550000-0000-4000-8000-000000000008'")`.
Measured necessary: without it, a second run on the same database fails at the
test's own `expect(before).toHaveLength(0)`.

**AC6 — both specs are green in both invocations.** Fresh seed + spec alone,
and fresh seed + full suite. Concretely: **all 5 tests in `coach-meeting.spec.ts`
and all 7 in `student-parent.spec.ts` pass**, in isolation and in the full suite.
Report both exit codes and both pass/fail counts verbatim.

**The full suite will still exit 1, and that is expected — do not chase it and
do not edit a third file to make it green.** Three known failures live outside
your Allowed Files:
  - `student-checkin.spec.ts:182` — fails every run (hardcoded calendar labels
    against a `current_date`-relative seed).
  - `outreach-lifecycle.spec.ts:149` and `reports-accounting.spec.ts:333` — a
    **coupled pair**. `:149` has a read-after-write race, and when it happens to
    pass it logs a `2.5 h` override for Priya on an event that survives into the
    rest of the suite, which then turns `:333` red. **Exactly one of the two
    fails on any given run, and which one is not deterministic** — the gate
    measured both orderings from identical code on identical fresh seeds.

So expect `36 passed / 2 failed`, exit 1, with `student-checkin.spec.ts:182`
plus *one* of that pair. List whatever you actually see, verbatim. If a failure
appears outside those three, stop and report it — that one would be yours.

**AC7 — no file outside the two Allowed Files is modified by you.** Measure it
with:

```bash
git status --porcelain -- ':!tests/e2e-personas/screenshots'
```

Screenshots are excluded deliberately and this is not a loophole:
`capture()` rewrites `tests/e2e-personas/screenshots/*.png` on every run
(`personaHarness.ts:167-170`), so *running* the suite dirties the tree by
construction, and **37 of those PNGs were already modified before you started**
by the measurement runs that produced this packet. Leave them alone; do not
stage them. **Do not rename any `capture()` id** — renaming creates a new
untracked PNG and orphans the old one.

Report the commit SHA (item 21 — a clean tree is not a committed one), and
stage with explicit pathspecs only (item 22 — never `git add -A` or `git add .`).

---

## 4. How to run it

The harness is **already up** in this container and you do not need to rebuild
the app bundle (these specs exercise the served bundle, and you are changing no
source):

```bash
# Reseed between runs — several of these specs write, and a dirty database
# is how a rerun disagrees with itself:
sudo -n bash tests/e2e-harness/stop.sh
sudo -n bash tests/e2e-harness/start.sh
sudo chown runner:runner .env.e2e

# One spec:
npx playwright test -c tests/e2e-harness/playwright.personas.config.ts \
  tests/e2e-personas/student-parent.spec.ts

# Everything:
npx playwright test -c tests/e2e-harness/playwright.personas.config.ts
```

Environment notes, all already done — do not redo them and do not "fix" them
in the repo: `npm ci` has run; `playwright@1.62.1` is installed globally and
symlinked into `node_modules/`; Chromium is installed; a preview server is
serving `dist-e2e` on `127.0.0.1:4174` (started with `--host 127.0.0.1`, because
`npm run preview` binds `::1` only here and the config's `baseURL` is
`127.0.0.1`). **If the preview dies, restart it with that flag** rather than
editing the config.

Query the database directly when you need to check a row:

```bash
psql -h 127.0.0.1 -p 55432 -U postgres -d scratch -X -q -c "select …"
```

---

## 5. Evidence you must report

Per the constitution's Evidence Requirements: files inspected, commands run,
relevant output, pass/fail, exact failure reason if any, and the commit SHA.
Quote the real pass/fail counts and exit codes — not a summary of them. Do not
report a criterion green that you have not watched turn green.

---

## 6. Worktree

Work in the shared tree at the path above. This is an explicit exception to the
usual isolation habit and the reason is item 23's own logic: you are running
**no mutation experiment** — you change two test files and run them. The
services the suite needs (PostgreSQL on 55432, the API on 54321, the preview on
4174) are container-level and are not duplicated by a worktree, and only one
editing agent runs against this tree at a time. If you find yourself wanting to
revert application source to see a test go red, **stop and say so** — that is a
mutation and it needs its own worktree.

---

## 7. Least confident decisions (item 19d) — ROUND 1 RESOLVED

**All five were attacked by `checker-premise` in round 1 and four came back
sound. They are left below verbatim rather than deleted**, because the record
of what the author doubted is the thing item 19d is for; each now carries the
gate's answer. The verdict was REVISE on grounds none of them anticipated —
AC6's non-determinism and AC7's unsatisfiability — which is itself worth
recording: the declared doubts were not where the packet was weakest.

- **§7.1 — SOUND.** The pin is achievable; the prescribed locator is now in
  AC5 and the fallback is withdrawn.
- **§7.2 — SOUND.** No product finding. Archived teams are never in the
  selected set in create mode, so `team_ids` is unaffected; deleting line 126
  is sufficient and was measured green.
- **§7.3 — SOUND on both surfaces.** One shared format string; `100.0` is
  reliable, the hours value is not.
- **§7.4 — WRONG, and not for the reason declared.** The two RSVP writers are
  genuinely separate code paths (`submitRsvpChange` vs
  `upsertExpectedAttendeeRsvps`), so the declared falsifier does not fire — but
  the underlying claim failed anyway: `outreach-lifecycle:149` is a
  read-after-write race in the spec, not a write path that records nothing.
  See §8.
- **§7.5 — SOUND.** The gate turned all 12 tests in the two files green with
  zero `src/**` edits and `tsc --noEmit` clean.

### The original list

1. **That AC5's "pin the click to the seeded session" is achievable through the
   UI at all.** I have not read `StudentHome.tsx`'s "Sign-up opportunities"
   markup, so I do not know whether the Sign up buttons carry anything
   distinguishing — an accessible name including the event title, a row
   container that can be filtered by text. **What would make it wrong:** the
   buttons are identical and unnameable, in which case the honest fix is to
   assert against *whichever* session the click targeted (read it back from
   `rsvps` by `student_id` with a before/after diff) rather than a hardcoded
   `session_id`. Either satisfies AC5's intent; I am prescribing the first and
   the second may be the only one that exists.

2. **That deleting line 126 is the whole of AC2.** The dialog defaults to all
   teams selected and the test narrows by deselecting two. With only two teams
   offered, deselecting one leaves `Volt Robotics 9911` and `team_ids` should
   still be `[SEED.teamFrc]`. **What would make it wrong:** the picker's
   "Select all" default or its `selectableTeams` union at
   `ScheduleMeetingsDialog.tsx:885` still includes the archived team in the
   *selected* set even though it is not *offered* — in which case `team_ids`
   would arrive with a third id and the assertion at line 156 fails for a real
   reason. That would be a product finding, not a test fix, and it stops the
   task.

3. **That the hours label is stable enough to assert on precisely.** I have
   one measurement of one render: `4.0 / 100.0 h (4%)`. **What would make it
   wrong:** the `.0` on the goal is incidental formatting that differs by
   season configuration, or the whole label is assembled differently on the
   parent surface than on the student one. A selector over-fitted to that one
   string re-creates exactly the brittleness this task is cleaning up.

4. **That `outreach-lifecycle.spec.ts:149` and `student-checkin.spec.ts:182`
   are genuinely out of scope.** Both reproduce in isolation and neither is
   named in GAM-355. **What would make it wrong:** the outreach failure and
   this task's RSVP work share a code path — if the coach-side fan-out at
   `outreach-lifecycle.spec.ts:233` and the student-side RSVP write at
   `student-parent.spec.ts:66` are the same writer, then "the RSVP writes" and
   "the fan-out writes nothing" cannot both be true of one mechanism, and one
   of my two conclusions is wrong.

5. **That no `src/**` change is needed.** Every one of the three bugs has a
   shipped fix I traced to a real line. **What would make it wrong:** the
   rewritten assertions, which are stricter than the current ones, catch a
   *partial* fix — e.g. hours round on the student home and not on the parent
   home. Then the correct outcome is a red test and a filed row, not a relaxed
   assertion.

---

## 8. Correction to this packet's own evidence (round 1)

The run log's first characterisation of `outreach-lifecycle.spec.ts:149` — *"the
coach's RSVP fan-out writes no `rsvps` row … a candidate production defect"* —
**is false**, and it is corrected here rather than quietly dropped.

The gate queried the database after a run in which line 233 failed with
`Received array: []`, and found the row present:

```
             title           |              session_id              |              student_id              | status |             responded_by
-----------------------------+--------------------------------------+--------------------------------------+--------+--------------------------------------
 GAM343 Lifecycle — Outreach | 765acc6a-d303-424b-af12-baa04b52e716 | 57000000-0000-4000-8000-000000000002 | going  | a0000000-0000-4000-8000-000000000002
```

`status` and `responded_by` are exactly what lines 234-235 assert. The spec
polls only for the `events` row (`:222`) and then reads `rsvps` synchronously
(`:232`), while `reconcileExpectedAttendeeRsvps` runs after
`createOutreachEvent` and `insertSessions`
(`src/lib/supabase/loaders/outreach.ts:1626-1640`). The fix is a poll, not a
product change.

**This is not the worker's problem** — it is recorded here so the follow-up row
is filed accurately, and as the reason AC6 no longer names a fixed set of
remaining failures.
