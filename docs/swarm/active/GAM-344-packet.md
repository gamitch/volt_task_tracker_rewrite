# GAM-344 — worker packet (HEAVY)

**Issue:** E2E — W3 Run a meeting: schedule → attendance → participation %
<https://linear.app/gamitch/issue/GAM-344>
**Branch:** `claude/gam-344-w3-meeting-e2e`
**Tier:** HEAVY — carried on the issue as the `heavy` label, so no tiering
judgement was owed at claim time (item 28d applies to `tier/unreviewed` only).
It is also the right tier on item 26's own test: the work drives the app's
riskiest multi-step **write path** (mark absences → stamp checkouts → flip
status, no transaction) and a **destructive** one (series reconcile can delete
sessions and RSVPs). Nothing here changes production code, but the criteria
below are the only thing standing between that write path and a green report.

---

## 0. Environment — measured by the orchestrator, do not re-derive

Every line here was run in this container today. It is stated so the worker
spends its turns on the specs, not on the harness.

| Fact | How established |
| --- | --- |
| `npm ci` installs cleanly; `npm run typecheck` exits 0 with no output | run |
| `playwright` is **not** a repo dependency. Install it with `npm install --no-save playwright` | run |
| **Never** `npm install --no-package-lock` | measured: it re-resolves `@astryxdesign/core` from `^0.1.6` to 0.1.9, whose `AvatarSize` drops `'small'`/`'large'`, and 6 files stop typechecking. This is not a repo defect; see the run log's 11:52Z retraction |
| `npx playwright install chromium` succeeds (114.7 MiB) | run |
| The harness needs **root**: `sudo -E bash tests/e2e-harness/start.sh` | `scratch-postgres/start.sh` does `chown postgres` + `su postgres`, which fail as `runner` |
| Harness comes up: cluster 55432, API 54321, seed `5 profiles / 6 students / 3 events / 8 sessions / 10 attendance` | run |
| **`vite preview` binds `[::1]` only here**, but the config polls `http://127.0.0.1:4174`, so the `webServer` block times out at 180 s | measured; `ss -lntp` shows `LISTEN [::1]:4174` |
| Workaround, and it is a *local run* workaround, **not** a repo change: pre-build and pre-start the preview yourself, then let `reuseExistingServer: true` adopt it | run, works |

```bash
sudo -E bash tests/e2e-harness/start.sh
npm run build -- --mode e2e --outDir dist-e2e
nohup npm run preview -- --outDir dist-e2e --port 4174 --strictPort --host 127.0.0.1 \
  > /tmp/volt-preview.log 2>&1 &
npx playwright test -c tests/e2e-harness/playwright.personas.config.ts <file>
```

**Do not edit `tests/e2e-harness/playwright.personas.config.ts`** to add
`--host`. It is outside Allowed Files, and this is an environment quirk of one
container, not a defect the repo has. Record it in the findings file as a NIT
if you judge it worth recording; do not fix it here.

The suite is **serial** (`fullyParallel: false`, `workers: 1`) and Playwright
orders files alphabetically. `coach-meeting-end.spec.ts` therefore runs after
`coach-meeting.spec.ts` and **before** `student-checkin.spec.ts`. That ordering
is load-bearing — see §3.1.

---

## 1. What already exists, and the one thing on `main` that is broken

`tests/e2e-personas/coach-meeting.spec.ts` covers the schedule dialog's
defaults, the team-scope dropdown, a single meeting round-trip, weekly
recurring expansion, and an RLS denial for a student. Read it first; it is the
longest worked example in the suite and your new file should look like it.

**Two of its five tests fail on a clean `main` right now.** Measured, not
inferred — full output in the run log:

```
- Expected  - 1
+ Received  + 0
  Array [
    "Select all",
    "Volt Robotics 9911",
    "Volt Junior 4402",
-   "Volt Legacy 2201",
  ]
  at tests/e2e-personas/coach-meeting.spec.ts:96:47
```

The archived team `Volt Legacy 2201` is no longer offered in the scope picker.
That is **correct current behaviour**: GAM-305 (legacy T615) added
`src/lib/teams/archivedTeams.ts`'s `excludeArchivedTeams`, which
`ScheduleMeetingsDialog.tsx` now calls. The spec is stale, and its own comment
at `coach-meeting.spec.ts:101-105` nominates the exact line to delete when this
happens:

> *"If a fix lands that filters archived teams out of the scope picker, this
> line is the one to delete — the assertion records today's behaviour, it does
> not bless it."*

**Task 1 (below) is to take the spec up on that offer.** The second failure,
at `:126`, is the same root cause: the test clicks the option
`'Volt Legacy 2201'` to deselect it, and it is not there.

**Why it rotted:** `grep -n "e2e-personas" .github/workflows/*.yml` returns
**nothing**. CI never runs this suite, so nothing was ever going to tell anyone.
That is a finding and §6 requires you to file it.

---

## 2. Allowed Files

Edit only these. Everything else — all of `src/`, all of `supabase/`, all of
`tests/e2e-harness/`, all of `.github/workflows/**`, and every other file under
`docs/swarm/` — is **forbidden**.

- `tests/e2e-personas/coach-meeting.spec.ts` — repair only, per Task 1
- `tests/e2e-personas/coach-meeting-end.spec.ts` — **new**, the bulk of the work
- `tests/e2e-personas/screenshots/*.png` — committed evidence
- `docs/swarm/inbox/claude-gam-344-w3-meeting-e2e-findings.json` — **new**

**No production code changes are expected.** The issue is explicit: *"if the run
needs one, that is a finding."* If you believe `src/` must change, stop, write
the finding, and say so in your report — do not edit `src/`.

### Two things the issue forbids outright

1. **Do not "fix" the asymmetry in `loaders/meetings.ts`.** `cancelSession`
   (`:788-792`) is permanently *not* time-guarded while
   `deleteSessionIfStillFuture` (`:764-773`) carries `.gt('starts_at', 'now')`.
   The comment at `:775-787` explains that a symmetric guard would silently
   no-op in exactly the raced case the function exists to repair — D016 §3 ruled
   it load-bearing. If a spec makes this look like a bug, **the spec is
   describing a deliberate decision. Record it; do not file it.**
2. **Ending a meeting reports partial failures badly, and that is already
   tracked** as [GAM-283](https://linear.app/gamitch/issue/GAM-283). Cite that
   row; do not file a duplicate. (`endMeeting.ts:98-114` discloses it in full:
   `runMutation` normalizes rejections to a plain object, never an `Error`, so
   `EndMeetingDialog`'s `error instanceof Error` check always falls through to
   the generic message.)

---

## 3. The facts the criteria rest on — all verified today

### 3.1 Fixtures, and why you must not end `SEED.liveSession`

`tests/e2e-harness/seed.sql`, read at `bebcded`:

- `SEED.liveSession` = `5e550000-…-004`, on event `…-001` *Weeknight Build
  Session* (`team_ids = [teamFrc]`), status `scheduled`, running **now**
  (`starts_at = now() - 30 min`, `ends_at = now() + 2 h`).
- Active students on `teamFrc`: **Priya** (`SEED.studentPriya`), **Jordan**
  (`SEED.studentJordan`), **Sam** (`57000000-…-003`). Casey (`…-006`) is
  `is_active = false` and must therefore **not** appear on any roster.
  Nina and Theo are on `teamFtc`.
- `student_teams` gives every student exactly one active membership
  (`seed.sql:63`), so no student is dual-team and no participation row is
  duplicated across teams.

**`student-checkin.spec.ts` drives `/kiosk/${SEED.liveSession}` and asserts on
it, and it runs *after* your new file.** Flipping that session to `completed`
would break it. So: **your specs create their own meetings and end those.**
Never end, cancel or re-time a seeded session.

### 3.2 The participation view — this is what makes AC 6 provable

`supabase/migrations/20260722000000_membership_views.sql:62-83`, quoted:

```sql
join event_sessions es on es.event_id = e.id and es.status = 'completed'
```

`expected_ct` counts **only sessions whose status is `completed`**. So the
status flip at the end of `onEndMeeting` is *itself* what moves the student's
participation figure. That is the whole journey in one number, and it is why
this task is one task rather than two.

`participation_pct` is
`round(100.0 * present_ct / greatest(expected_ct - excused_ct, 1), 1)`, where
`present_ct` counts `status in ('present','late')`.

**Priya's baseline, arithmetic you must confirm against the live database
before relying on it** (`expected` = completed sessions of participation-counting
events scoped to her team): sessions `…-001`, `…-002`, `…-003` on the meeting
event, plus `…-006` on the outreach event (`team_ids is null` = every team) =
`expected_ct 4`, `present_ct 4`, `excused_ct 0`, **`participation_pct 100.0`**.

After you end **one** newly created meeting whose scope includes her team,
without marking her: `expected_ct 5`, `present_ct 4`, → **`80.0`**.

Do not hardcode `100.0` as an assumption. Read the row first, assert the
*delta* the ending produced, and assert the final value.

### 3.3 The end-meeting write path — `src/lib/supabase/loaders/endMeeting.ts`

`makeOnEndMeeting` (`:392-451`) issues three calls, always in this order, never
parallel:

1. **Mark absences — guarded** (`:434`): `if (payload.markAbsentStudentIds.length > 0)`.
   `.upsert(rows, { onConflict: 'session_id,student_id', ignoreDuplicates: true })`
   on `attendance`, one row per student, `status: 'absent'`, `method: 'coach'`,
   `recorded_by: null`.
2. **Checkout — unconditional** (`:442`): `.update({ check_out_at: payload.endsAt })`
   on `attendance`, `.eq('session_id', …).in('student_id', …).is('check_out_at', null)`.
3. **Status flip — unconditional, always last** (`:449`):
   `.update({ status: 'completed' })` on `event_sessions`, `.eq('id', sessionId)`.

The guard on step 1 is T508's ruling and is **acceptance criterion 3**: with the
opt-in unticked the app must issue *no* `attendance` write at all — not even an
empty upsert.

The opt-in control is a `CheckboxInput` whose label is built by
`buildMarkRemainingAbsentLabel` (`EndMeetingDialog.tsx:569-573`):

```ts
return `Mark ${count} ${count === 1 ? 'student' : 'students'} with no attendance record absent`;
```

It renders **only when there is at least one unmarked student**
(`EndMeetingDialog.tsx:987`). Confirming is a `Button` labelled `End meeting`
(`:1042`) followed by an `AlertDialog` titled `End this meeting?` (`:1051`).
Discover the confirm control's exact accessible name **in the browser**; it is
not asserted here because the orchestrator did not verify it.

### 3.4 The series edit — `makeSaveMeetingSeries` (`meetings.ts:668-870`)

- `updateEvent` (`:684-699`) names exactly four columns: `title`, `team_ids`,
  `location_name`, `description`. `address`, `counts_participation`,
  `counts_volunteer_hours`, `adult_volunteers_count`, `adult_volunteer_hours`
  are never in the update's column set.
- `updateSessionTime` (`:701-711`) writes `starts_at`/`ends_at` **only for the
  rows `computeMeetingSeriesReconcilePlan` put in `plan.toUpdate`** (`:842`).
  A session the coach did not touch must come back byte-identical. **This is
  acceptance criterion 5, and it is T611's defect.**

### 3.5 Entry points in `MeetingsList.tsx` — accessible names, read from source

| Control | Accessible name | Site |
| --- | --- | --- |
| Edit the whole series | `Edit – <event title>` (en dash `–`, U+2013) | `:1573` |
| Edit one session | `Edit <weekday date> session` | `:1739` |
| Cancel one session | `Cancel <weekday date> session` | `:1751` |

The date fragment comes from `formatWeekdayDate(session.sessionDate)`.
**Resolve the real string in the browser rather than reimplementing that
formatter** — a name you construct yourself is a second implementation that can
agree with the first today and drift tomorrow. Prefer a regex
(`/^Cancel .* session$/`) scoped to the row.

The per-session Edit/Cancel controls render only when
`isMeetingSessionReconcilable(session, new Date())` (`:1735`) — i.e. future,
non-canceled sessions. Choose your target session accordingly.

### 3.6 Times

The app writes Chicago wall time and stores UTC. `5:30 PM on 15 Dec 2026` is
`2026-12-15 23:30:00+00` (CST, UTC−6); `7:45 PM` the same day is
`2026-12-16 01:45:00+00` — note the **date rollover**, which is the classic way
a scheduling app drifts by a day. `coach-meeting.spec.ts:166-167` already
asserts exactly this pair; **criterion 7 wants the same assertion made on the
meetings your new file creates**, not a re-run of that one.

---

## 4. The tasks

### Task 1 — repair `coach-meeting.spec.ts` (small, do it first)

Make the two failing tests green **by recording current behaviour**, not by
loosening the assertion:

- `:96-106` — delete the `'Volt Legacy 2201'` entry from the expected option
  list. **Replace the FINDING 1 comment**; do not leave a comment describing a
  guard that is gone. Say that GAM-305 landed `excludeArchivedTeams`, that the
  archived team is now correctly absent, and keep the list exact so a
  regression that re-admits it turns this red again.
- `:126` — drop the click that deselects `'Volt Legacy 2201'`. The scope must
  still narrow to `[SEED.teamFrc]`, and `:152`'s
  `expect(event.team_ids).toEqual([SEED.teamFrc])` must still pass. **Confirm
  that in the browser** — with one fewer option the remaining deselection may
  leave a different set, and if it does, the assertion changes with a comment
  explaining why, not silently.

Do not touch the other three tests.

### Task 2 — `coach-meeting-end.spec.ts` (new)

One file, one `test.describe`. A `beforeEach` that deletes **only** rows this
file creates — events titled like `'E2E END %'` (`event_sessions` and
`attendance` follow by `on delete cascade`; verify that cascade exists rather
than assuming it). Fixtures stay. The suite must be re-runnable with no reseed
(criterion 10) — **prove it by running the file twice in a row.**

#### 2a. Schedule → run → end, with the opt-in OFF (criteria 1, 2, 3, 7)

1. As `coach`, open the schedule dialog and **drive it**: type the title
   (`E2E END Opt-Out Night`), type a location, pick the date, set both times,
   type the notes. Fields typed, not injected.
2. Assert the stored row: `type`, `season_id`, `location_name`, `notes`,
   `status = 'scheduled'`, and **`starts_at`/`ends_at` in UTC** (criterion 7).
3. **Then**, and only then, `execAdmin` the session's `starts_at`/`ends_at` to
   bracket `now()` so the live console will run it. This is harness
   bookkeeping in the same class as the `beforeEach` deletes — `execAdmin` is
   documented as "never an assertion" (`personaHarness.ts:125`). **Say so in a
   comment**, and say what it does *not* weaken: every criterion below is about
   what the *UI* wrote, and criterion 7 was already asserted in step 2, before
   the shift.
4. Go to `/meetings/live/<sessionId>`. Mark **Priya** present through the real
   control — `role=radio` named `Present`, scoped to the
   `role=radiogroup` named `Attendance for Priya Raman`. An unscoped `Present`
   matches one control per student. Leave Jordan and Sam unmarked.
5. Open **End meeting**. Assert the opt-in checkbox is present and reads
   `Mark 2 students with no attendance record absent` — the count is itself an
   assertion about who the roster resolved to, and **it proves Casey
   (`is_active = false`) was excluded**. Leave it **unticked**. Screenshot.
6. Confirm. Then assert, reading rows back:
   - `event_sessions.status = 'completed'` for this session;
   - `attendance` for this session has **exactly one row** — Priya's — and
     **zero** rows for Jordan and Sam. Not "no absent rows": *no rows at all*.
   - Priya's `check_out_at` equals the session's `ends_at` (step 2 of the write
     path), and her `status` is still `present`.

#### 2b. The same journey with the opt-in ON (criterion 4)

A second meeting, `E2E END Opt-In Night`. Same shape, but mark Priya present,
**tick** the checkbox, confirm. Assert:

- three `attendance` rows for the session;
- Jordan and Sam: `status = 'absent'`, `method = 'coach'`, `recorded_by is null`;
- **Priya's row is untouched** — still `present`, still her original
  `method`/`recorded_by`. That is `ignoreDuplicates` doing its job, and
  "no row for anyone already marked" is the half of criterion 4 that a naive
  count would miss.

#### 2c. Series edit changes only what was touched (criteria 1, 2, 5)

1. Create a **weekly recurring** series, `E2E END Series`, with ≥3 sessions.
   Recurring mode needs a date range *and* weekday chips — chips alone leave
   the submit at `Create 0 meetings`. Weekday chips resolve to both a `<label>`
   and a `<button>`; use `getByRole('button', { name: 'Tue', exact: true })`.
2. Snapshot every session's `id`, `session_date`, `starts_at`, `ends_at`.
3. Open `Edit – E2E END Series`, change **only** the title (to
   `E2E END Series Renamed`), save.
4. Assert `events.title` changed, and **every session's `starts_at` and
   `ends_at` are byte-identical to the snapshot**, and the session id set is
   unchanged. Compare the whole set, not one row.

#### 2d. Cancel one occurrence (criteria 1, 2)

On the renamed series, click `Cancel <date> session` for one future session.
Assert that session's `status = 'canceled'` and that **every sibling is
untouched** — same status, same times. Screenshot the list showing it canceled.

#### 2e. The student reads a participation figure that matches (criterion 6)

1. **Before** 2a runs its ending, read Priya's `v_student_participation` row
   with `readRowsAs('student', …)` and record `expected_ct`, `present_ct`,
   `participation_pct`.
2. After the endings above, read it again as the student. Assert the deltas
   follow §3.2's arithmetic, and assert the final `participation_pct`
   explicitly.
3. Sign in as `student` in the browser, reach the screen that renders the
   figure, and assert the **rendered** number equals the database's
   `participation_pct`. Screenshot it.
   Find that screen in the browser; the orchestrator did not verify which route
   renders it, and a route asserted from source-reading is exactly the class of
   claim this project has been wrong about before. `MeetingsList.tsx`'s student
   view reads `participationPct` (`loaders/meetings.ts:515-539`
   `aggregateParticipationRows`) — that is a starting point, not a citation.

**Ordering:** 2e's baseline read must happen before any ending in the file.
Either put it in a `beforeAll`, or make 2e a single test that performs its own
ending. Do not depend on test order within the file for correctness of the
arithmetic — state which you chose and why.

### Task 3 — mutations (criteria 2, 3, 5, 10)

**Every mutation runs in your own git worktree (item 23), and you commit the
candidate work before mutating (item 26's "commit before mutating").** T323 lost
an uncommitted fix to `git checkout --` doing double duty.

```bash
git worktree add /tmp/gam344-mutate -b claude/gam-344-mutation HEAD
```

The harness database and the API server are **shared**; run mutations one at a
time. For each: build `dist-e2e` in the worktree, stop the main preview, start
preview from the worktree on 4174, run **only** the affected test, capture the
**real red output verbatim with its exit code**, revert, rebuild, re-run green.

Three mutations are named by the issue and all three are required:

| # | Mutation | Must turn red |
| --- | --- | --- |
| 1 | Point the status flip at the wrong session — in `endMeeting.ts:423`, `.eq('id', sessionId)` → a different id | 2a's `status = 'completed'` assertion |
| 2 | Send the upsert unconditionally — delete the `if (payload.markAbsentStudentIds.length > 0)` guard at `endMeeting.ts:434` | 2a's "exactly one row, none for Jordan or Sam" assertion |
| 3 | Rewrite every session's time on save — in `meetings.ts:842`, run `updateSessionTime` over *all* loaded sessions instead of `plan.toUpdate` | 2c's "untouched times" assertion |

A mutation that does **not** turn its test red is a finding about the test, not
a footnote: the criterion is vacuous and must be fixed until it fails.

Record each as: the exact diff, the command, the failing assertion, and the
exit code. `.claude/skills/mutation-replay` is the procedure; follow it.

---

## 5. Evidence the checker will replay

- `npx playwright test -c tests/e2e-harness/playwright.personas.config.ts` —
  the **whole** persona suite, exit code reported. Not just your file: Task 1
  exists because a sibling file was left red.
- The same command run **twice** with no reseed between (criterion 10).
- Three mutation transcripts with real red output and exit codes.
- Screenshots committed under `tests/e2e-personas/screenshots/`, named
  `<nn>-<persona>-<moment>`, for the evidence-bearing moments only: the
  end-meeting dialog with the opt-in visible and unticked; the same ticked; the
  list after a cancel; the student's participation figure. Not every page.
- `npm run typecheck`, `npm run lint`, `npm run format:check`, `npm run test`,
  `npm run build` — the persona specs are TypeScript in the repo and the gates
  cover them. Use `.claude/skills/gate-run`.
- The findings file, **even if empty** (§6).

Report the commit SHA your work landed in (item 21). "Clean" is not
"committed"; the orchestrator will verify HEAD moved and the change is in the
committed blob.

---

## 6. Findings

Write `docs/swarm/inbox/claude-gam-344-w3-meeting-e2e-findings.json` in the
schema in `docs/swarm/active/FINDINGS-PIPELINE.md`. Emit it **even if you find
nothing** — an empty `findings` array is a claim that you looked; a missing file
cannot be told apart from never having checked.
`docs/swarm/inbox/claude-gam-342-e2e-w1-checkin-findings.json` is a worked
example from the sibling W1 run.

One finding is already established and must be in the file — the orchestrator
measured it, you should re-verify it rather than take it on trust:

- **The persona suite is not run by any CI workflow, and two of its tests had
  gone stale on `main` unnoticed.** `grep -n "e2e-personas" .github/workflows/*.yml`
  returns nothing. Consequence: a suite whose entire value is being a real
  witness silently stops being one, and the next agent to touch it pays the
  repair. Severity is yours to argue — say who is affected today and what it
  costs, per item 30b. `findingKey`: `e2e-personas/persona-suite-not-in-ci`.
  Note honestly in the body that **the fix is a `.github/workflows/**` change,
  which a dispatched run cannot push** (`AGENTS.md` § "Two walls"), so this
  necessarily lands as a filed row rather than a fix here.

Do **not** file: the `cancelSession` asymmetry (§2.1) or the end-meeting error
reporting (§2.2, already GAM-283).

`findingKey` is the dedupe identity and must never contain `file:line`.
Findings land in `Backlog` with `tier/unreviewed`, unassigned, no priority.

---

## 7. Least confident decisions (item 19d)

Attack these first.

1. **Shifting a UI-created session's `starts_at`/`ends_at` with `execAdmin` so
   the live console will run it (§4 2a step 3).** I chose it over hunting for a
   way to make the dialog produce a live session, because the dialog's defaults
   are 6:00 PM–8:00 PM and the run's wall-clock time is not controllable.
   **What would make it wrong:** if the live console's own gating reads
   something other than the session's times — the `session_date`, or the
   status, or an `events`-level field — then the shift produces a session that
   still will not run, and the worker burns a round discovering it. It would
   *also* be wrong if `EndMeetingDialog`'s summary derives `endsAt` from
   something the shift does not move, which would make 2a's `check_out_at`
   assertion compare against a stale value and pass for the wrong reason.
2. **Priya's participation baseline of `100.0` (§3.2).** Derived by reading the
   view SQL and the seed, not by querying. **What would make it wrong:** any
   completed session I have miscounted — in particular whether the outreach
   event `…-002` really contributes (it has `team_ids is null` and
   `counts_participation = true`, so I believe it does), and whether
   `student_teams`' single membership per student holds after `admin-roster.spec.ts`
   has run earlier in the same serial suite and created `E2E %` students. The
   packet already tells the worker to read the row rather than assume it, which
   contains the damage but does not remove the error.
3. **That Task 1's `:126` repair needs only the deletion of one click.** I
   reasoned it from the option list, and did not run it. **What would make it
   wrong:** if the `MultiSelector`'s "Select all" semantics mean deselecting one
   of two remaining teams leaves a different `team_ids` than `[teamFrc]` — in
   which case `:152`'s assertion changes, and a worker who "fixed" the test by
   editing that expectation without noticing would be recording a scope bug as
   correct behaviour.
4. **That criterion 6's student-visible figure is reachable at all as a
   student.** I did not open the student view. **What would make it wrong:** if
   the figure renders only under a season/team condition the harness seed does
   not satisfy, or if it is rounded/formatted (e.g. `80%` not `80.0`) such that
   "the rendered number equals `participation_pct`" is not literally true — in
   which case the criterion needs restating as a formatted comparison, and
   silently loosening it to a substring match would gut it.
5. **Splitting the work into one repair task and one new file, rather than
   letting the new file also cover the schedule-dialog paths.** **What would
   make it wrong:** if `coach-meeting.spec.ts`'s `beforeEach`
   (`delete from events where title like 'E2E %'`) also deletes *my* new file's
   `E2E END %` events when the two files run in the same session — they do run
   in the same session, serially, and `'E2E %'` **matches** `'E2E END %'`. If
   the ordering ever changes, or if a future author adds a test to the older
   file, the new file's fixtures vanish underneath it. I think the alphabetical
   order saves it today; I am not confident that is a property worth relying on,
   and the worker should consider a title prefix that does **not** collide.
