# GAM-344 — worker packet (HEAVY) — **revision 2**

**Issue:** E2E — W3 Run a meeting: schedule → attendance → participation %
<https://linear.app/gamitch/issue/GAM-344>
**Branch:** `claude/gam-344-w3-meeting-e2e`
**Tier:** HEAVY. Carried on the issue as the `heavy` label, so no tiering
judgement was owed at claim time (item 28d applies to `tier/unreviewed` only).
It is also right on item 26's own test: the work drives the app's riskiest
multi-step **write path** (mark absences → stamp checkouts → flip status, no
transaction) and a **destructive** one (series reconcile can delete sessions
and RSVPs).

> **Revision 2 exists because round 1 of the premise gate returned REVISE with
> three BLOCKERs.** Every number in §3.2 of revision 1 was derived from a
> **superseded** view definition, and the journey built on it could not have
> moved the figure it claimed to measure. The gate ran `pg_get_viewdef` and a
> `begin … rollback` experiment; this revision is written against what it
> measured, and the measurements are quoted inline so the next reader does not
> have to trust either of us. Round 2 is the last round item 19a allows.

---

## 0. Environment — measured, do not re-derive

| Fact | How established |
| --- | --- |
| `npm ci` installs cleanly; `npm run typecheck` exits 0 | run |
| `playwright` is **not** a repo dependency. Install with `npm install --no-save playwright` | run |
| **Never** `npm install --no-package-lock` | measured: re-resolves `@astryxdesign/core` `^0.1.6`→0.1.9, `AvatarSize` drops `'small'`/`'large'`, 6 files stop typechecking. Not a repo defect — see the run log's 11:52Z retraction |
| Harness needs **root**: `sudo -E bash tests/e2e-harness/start.sh` | `scratch-postgres/start.sh` does `chown postgres` + `su postgres` |
| Harness is **already up** in this container: cluster 55432, API 54321, preview 4174 | run |
| **`vite preview` binds `[::1]` only here**, while the config polls `127.0.0.1:4174`, so the config's own `webServer` block times out at 180 s | measured; `ss -lntp` shows `LISTEN [::1]:4174` |

```bash
sudo -E bash tests/e2e-harness/start.sh          # only if not already up
npm run build -- --mode e2e --outDir dist-e2e
nohup npm run preview -- --outDir dist-e2e --port 4174 --strictPort --host 127.0.0.1 \
  > /tmp/volt-preview.log 2>&1 &
npx playwright test -c tests/e2e-harness/playwright.personas.config.ts <file>
```

**Do not edit `tests/e2e-harness/playwright.personas.config.ts`** to add
`--host`. Outside Allowed Files, and an environment quirk of one container
rather than a repo defect. Record it as a NIT in the findings file if you judge
it worth recording.

**File order is alphabetical and the suite is serial** (`fullyParallel: false`,
`workers: 1`). **Measured with `npx playwright test --list`:**

```
coach-checkin.spec.ts / coach-meeting-end.spec.ts / coach-meeting.spec.ts
```

`coach-meeting-end.spec.ts` runs **BEFORE** `coach-meeting.spec.ts` — `-`
(0x2D) sorts before `.` (0x2E). Revision 1 asserted the opposite. This is
load-bearing; see §3.1.

---

## 1. What exists, and the one thing broken on `main`

`tests/e2e-personas/coach-meeting.spec.ts` covers the schedule dialog's
defaults, the team-scope dropdown, a single meeting round-trip, weekly
recurring expansion, and an RLS denial. Read it first — it is the longest
worked example in the suite, and **lift its `eventsTitled` / `sessionsFor`
helper shape rather than inventing new row readers.**

**Two of its five tests fail on a clean `main`:**

```
- Expected  - 1
+ Received  + 0
  Array [ "Select all", "Volt Robotics 9911", "Volt Junior 4402",
-   "Volt Legacy 2201",
  ]
  at tests/e2e-personas/coach-meeting.spec.ts:96:47
```

The archived team is no longer offered. That is **correct current behaviour** —
GAM-305 (legacy T615) added `src/lib/teams/archivedTeams.ts`'s
`excludeArchivedTeams`, called from `ScheduleMeetingsDialog.tsx:854`. The spec
is stale, and its own comment at `:101-105` nominates the exact line to delete.

**Why it rotted:** `grep -rn "e2e-personas" .github/workflows/` returns
**nothing**. CI never runs this suite. That is a finding (§6).

---

## 2. Allowed Files

- `tests/e2e-personas/coach-meeting.spec.ts` — repair only, per Task 1
- `tests/e2e-personas/coach-meeting-end.spec.ts` — **new** (Turn A)
- `tests/e2e-personas/coach-meeting-series.spec.ts` — **new** (Turn B)
- `tests/e2e-personas/screenshots/*.png`
- `docs/swarm/inbox/claude-gam-344-w3-meeting-e2e-findings.json` — **new**

Everything else is forbidden: all of `src/`, all of `supabase/`, all of
`tests/e2e-harness/`, all of `.github/workflows/**`, every other file under
`docs/swarm/`.

**No production code changes are expected.** The issue is explicit: *"if the run
needs one, that is a finding."* If you believe `src/` must change, stop, write
the finding, and say so — do not edit `src/`.

### Two things the issue forbids outright

1. **Do not "fix" the asymmetry in `loaders/meetings.ts`.** `cancelSession`
   (`:788-792`) is permanently *not* time-guarded while
   `deleteSessionIfStillFuture` (`:764-773`) carries `.gt('starts_at','now')`
   (`:770`). The comment at `:775-787` explains that a symmetric guard would
   silently no-op in exactly the raced case the function exists to repair —
   D016 §3 ruled it load-bearing. **Record it; do not file it.**
2. **Ending a meeting reports partial failures badly, and that is already
   [GAM-283](https://linear.app/gamitch/issue/GAM-283).** Cite it; do not
   duplicate it. (`endMeeting.ts:98-114` discloses it in full.)

---

## 3. The facts the criteria rest on

### 3.1 Fixtures, cleanup, and the FK that is **not** a cascade

`tests/e2e-harness/seed.sql` at `bebcded`:

- `SEED.liveSession` = `5e550000-…-004`, event `…-001` *Weeknight Build
  Session* (`team_ids = [teamFrc]`), `scheduled`, running now.
- Active students on `teamFrc`: **Priya** (`SEED.studentPriya`), **Jordan**
  (`SEED.studentJordan`), **Sam** (`57000000-…-003`). Casey (`…-006`) is
  `is_active = false`. Nina and Theo are on `teamFtc`.
- One active `student_teams` membership per student (`seed.sql:63`) — nobody is
  dual-team, so no participation row is duplicated across teams.

**Never end, cancel or re-time a seeded session.** `student-checkin.spec.ts`
drives `/kiosk/${SEED.liveSession}` and runs after your files.

**Use the title prefix `W3END ` (Turn A) and `W3SER ` (Turn B). Do NOT use
`E2E `.** Measured: `'E2E END Opt-Out Night' like 'E2E %'` → `t`, and
`coach-meeting-end.spec.ts` runs **before** `coach-meeting.spec.ts`, whose
`beforeEach` (`:63`) does `delete from events where title like 'E2E %'`. That
delete would hit your rows.

**And it would not merely delete them — it would throw.** Measured:

```
ERROR: update or delete on table "event_sessions" violates foreign key
constraint "attendance_session_id_fkey" on table "attendance"
```

`attendance_session_id_fkey` and `rsvps_session_id_fkey` are **`ON DELETE
RESTRICT`**, not cascade. `execAdmin` runs with `ON_ERROR_STOP=1`, so a
`beforeEach` that hits this raises and **fails every test in that file**. A
colliding prefix would have taken `coach-meeting.spec.ts` from 3/5 to 0/5.

**Your `beforeEach` must delete children first, in this order** —
`student-checkin.spec.ts:272-281` is the existing precedent:

```sql
delete from attendance where session_id in (
  select id from event_sessions where event_id in (
    select id from events where title like 'W3END %'));
delete from rsvps where session_id in (
  select id from event_sessions where event_id in (
    select id from events where title like 'W3END %'));
delete from events where title like 'W3END %';
```

(`event_sessions` does follow `events` by cascade; it is `attendance` and
`rsvps` that do not follow `event_sessions`. Verify that rather than assuming
it.)

**Criterion 10 is proven by running the file twice in a row with no reseed.**

### 3.2 The participation view — **rewritten; revision 1 was wrong here**

`v_student_participation` is **not** what
`20260722000000_membership_views.sql` defines. It was replaced by
`supabase/migrations/20260806000000_met01_explicit_marks.sql` (T509 / D014).
The live definition, from `pg_get_viewdef`:

```sql
WITH marked AS (
  SELECT ... FROM students s
  JOIN student_teams st ON ...
  JOIN attendance a ON a.student_id = s.id            -- INNER JOIN
  JOIN event_sessions es ON es.id = a.session_id AND es.status = 'completed'
  JOIN events e ON ... )
...
CASE WHEN (count(*) - count(*) FILTER (WHERE status='excused')) = 0
     THEN NULL ...
```

**`expected_ct` counts explicit attendance MARKS on completed sessions — not
eligibility.** Three consequences, all of which revision 1 got wrong:

- An **unmarked** student contributes **no row at all**. Ending a meeting she
  was not marked in does not move her numbers.
- There is **no `greatest(…,1)`**. The view returns **`NULL`** when
  `count(*) − excused` is 0, which the UI renders as `—`.
- T509's own header calls the pre-T509 behaviour — an unmarked student
  inflating the denominator — *"a LIE"*. Do not reintroduce reasoning based on
  it.

**Measured by the gate against the live cluster**, Priya
(`57000000-…-001`), baseline `expected 4 / present 4 / pct 100.0`:

| One extra completed FRC meeting, Priya … | expected | present | pct |
| --- | --- | --- | --- |
| **unmarked** | 4 | 4 | 100.0 |
| **present** | 5 | 5 | 100.0 |
| **absent** | 5 | 4 | **80.0** |

**Only an explicit `absent` mark moves the figure.** That is what makes the
opt-in checkbox — not the status flip — the thing criterion 6 hangs on, and it
is why 2b and 2e are one test in this revision.

**Do not hardcode a final percentage.** Turn A ends two meetings, so the
absolute numbers depend on test order within the file. Read the row
**immediately before** the ending, inside the same test, and assert the change.
See §4 2b for the exact assertions.

### 3.3 The end-meeting write path — `src/lib/supabase/loaders/endMeeting.ts`

`makeOnEndMeeting` (`:392-451`) issues three calls, in order, never parallel:

1. **Mark absences — guarded** (`:434`): `if (payload.markAbsentStudentIds.length > 0)`.
   `.upsert(rows, { onConflict: 'session_id,student_id', ignoreDuplicates: true })`,
   one row per student, `status:'absent'`, `method:'coach'`, `recorded_by:null`.
2. **Checkout — unconditional** (`:442`): `.update({ check_out_at: payload.endsAt })`,
   `.eq('session_id',…).in('student_id',…).is('check_out_at', null)`.
3. **Status flip — unconditional, always last** (`:423`, called at `:449`):
   `.update({ status:'completed' }).eq('id', sessionId)`.

The guard on step 1 is T508's ruling and is **criterion 3**: with the opt-in
unticked the app must issue **no `attendance` write at all** — not even an
empty upsert.

**The checkout leg (step 2) is unreachable from the UI in this harness, and you
must say so rather than assert around it.** `computeCheckoutStudentIds`
(`EndMeetingDialog.tsx:430-441`) requires `record.checkInAt !== null`. No UI
writer sets `check_in_at`: the coach console's upsert deliberately never
includes it (`attendance.ts` module doc `:135-136` — *"`check_in_at`/
`check_out_at` are DELIBERATELY never included in any upsert payload"*),
`selfCheckoff.ts:191` writes `check_in_at: null`, and the only real writer is
the QR `checkin` Edge Function, which is a shallow stand-in here (Tier 2 —
`student-checkin.spec.ts:110`). So `checkoutStudentIds` is always `[]`.

**To exercise step 2 at all, pre-seed Priya's `check_in_at` with `execAdmin`**
— harness bookkeeping, in the same class as the `beforeEach` deletes
(`personaHarness.ts:125`: "never an assertion") — and **say in a comment that
the UI cannot produce this state**, so the next reader does not mistake the
assertion for proof of a path a coach can walk. Then assert `check_out_at`
equals the session's `ends_at`.

**Gating facts, measured, replacing revision 1's guesses:**

- **There is no time gate.** `LiveConsole.tsx` renders roster and mounts
  `EndMeetingDialog` unconditionally (`:1187-1192`, outside every load branch),
  and `makeLoadLiveConsoleData` (`kiosk.ts:440-483`) applies no time filter.
  The End-meeting affordance is gated on
  **`data.session.status === 'scheduled'`** (`EndMeetingDialog.tsx:1026`).
  Verified in the browser on a session dated a week in the future: full console,
  dialog opens, checkbox present. **Revision 1's `execAdmin` time-shift step is
  deleted — it was unnecessary.**
- `endsAt` is **not** stale: `makeLoadEndMeetingSummary` returns
  `endsAt: session.ends_at` (`endMeeting.ts:356`) and `buildEndMeetingPayload`
  passes `endsAt: session.endsAt` (`EndMeetingDialog.tsx:455`) — same value.
- The opt-in label is built by `buildMarkRemainingAbsentLabel`
  (`EndMeetingDialog.tsx:571-573`):
  `` `Mark ${count} ${count === 1 ? 'student' : 'students'} with no attendance record absent` ``
- The checkbox renders only when `unmarkedCount > 0` — the guard is at
  **`:1034`** (`:987` is a comment; revision 1 cited the wrong line).
- Confirm is `Button` `End meeting` (`:1042`), then an `AlertDialog`
  `End this meeting?` (`:1051`) with `actionLabel="End meeting"` (`:1057`).
  **Measured: once the confirm is open, TWO controls are named `End meeting`.**
  `getByRole('button', { name: 'End meeting' })` hits a strict-mode violation —
  scope to the `AlertDialog`, or use `.first()`/`.last()` deliberately and say
  which.

### 3.4 The series edit — `makeSaveMeetingSeries` (`meetings.ts:668-870`)

- `updateEvent` (`:684-699`) names exactly four columns (`:692-695`): `title`,
  `team_ids`, `location_name`, `description`. `address`,
  `counts_participation`, `counts_volunteer_hours`, `adult_volunteers_count`,
  `adult_volunteer_hours` are never in the update's column set.
- `updateSessionTime` (`:701-711`) is applied over `plan.toUpdate` (`:842`).

**Correction to revision 1, which the gate measured:** `plan.toUpdate` is
**every** desired-future session whose date matches a reconcilable existing one
(`ScheduleMeetingsDialog.tsx:643-651`) — it is **not** filtered by "did the
times change". For a freshly created, all-future series, `plan.toUpdate` is the
whole loaded set. So untouched sessions **are** rewritten; their times survive
only because the dialog re-derives **identical values**.

**Criterion 5 is therefore about value identity, not about exclusion from
`toUpdate`** — which is also why revision 1's mutation 3 was vacuous. Say this
in the spec's comment; a reader who thinks untouched rows are skipped will
misread what the test guards.

### 3.5 Entry points in `MeetingsList.tsx` — accessible names

| Control | Accessible name | Site |
| --- | --- | --- |
| Edit the whole series | `Edit – <event title>` (en dash U+2013) | `:1573` |
| Edit one session | `Edit <weekday date> session` | `:1739` |
| Cancel one session | `Cancel <weekday date> session` | `:1751` |

**Correction to revision 1:** `isMeetingSessionReconcilable(session, new Date())`
(`:1735`) wraps **Edit only** (`:1735-1743`). **Cancel (`:1744-1755`) is outside
it** — the source comment at `:1723-1733` says so explicitly ("it is still
cancellable individually through the existing per-session Cancel").

The date fragment comes from `formatWeekdayDate`. **Resolve the real string in
the browser rather than reimplementing that formatter** — prefer a regex
(`/^Cancel .* session$/`) scoped to the row.

### 3.6 Times

The app writes Chicago wall time and stores UTC. `5:30 PM on 15 Dec 2026` is
`2026-12-15 23:30:00+00` (CST, UTC−6); `7:45 PM` is `2026-12-16 01:45:00+00` —
note the **date rollover**. `coach-meeting.spec.ts:166-167` asserts exactly this
pair; **criterion 7 wants the same assertion on the meetings your files
create.**

---

## 4. The tasks

**Split into two turns** (the gate's recommendation 12; the seam is that Turn A
and Turn B have separate fixture-and-cleanup stories). **Turn A is the
priority** — it carries criteria 3, 4 and 6, which are the untested half the
issue was filed about. If only one turn lands, it must be A.

### Task 1 — repair `coach-meeting.spec.ts` (Turn A, do it first)

Make the two failing tests green **by recording current behaviour**, not by
loosening the assertion:

- `:96-106` — delete the `'Volt Legacy 2201'` entry. **Replace the FINDING 1
  comment**; do not leave a comment describing a guard that no longer exists.
  Say GAM-305 landed `excludeArchivedTeams`, that the archived team is now
  correctly absent, and keep the list exact so a regression re-admitting it
  turns this red.
- `:126` — drop the click deselecting `'Volt Legacy 2201'`. **Measured by the
  gate in the browser:** options are exactly
  `["Select all","Volt Robotics 9911","Volt Junior 4402"]`, and deselecting only
  `Volt Junior 4402` leaves `Volt Robotics 9911` selected, so `:152`'s
  `toEqual([SEED.teamFrc])` still holds unchanged.

Do not touch the other three tests.

### Turn A — `coach-meeting-end.spec.ts`

`beforeEach` per §3.1, prefix `W3END `.

**Every meeting in this file must have its team scope narrowed to
`Volt Robotics 9911`** (deselect `Volt Junior 4402`). The dialog defaults to
**both** live teams — measured default text `"Volt Robotics 9911, Volt Junior 4402"`.
Without narrowing, the roster is 5 students and the checkbox label counts
differently. Note also that `admin-roster.spec.ts` runs earlier and leaves
`E2E Rowan Adeyemi` (active, `teamFtc`) behind, which shifts an all-teams count
again. Narrowing removes the whole dependency.

#### A1. Schedule → run → end with the opt-in **OFF** (criteria 1, 2, 3, 7)

1. As `coach`, **drive** the schedule dialog: type the title (`W3END Opt-Out
   Night`), type a location, narrow the scope, pick the date, set both times,
   type the notes.
2. Assert the stored rows: `events` — `type`, `season_id`, `location_name`,
   `team_ids = [SEED.teamFrc]`; `event_sessions` — `status='scheduled'`,
   `notes`, and **`starts_at`/`ends_at` in UTC** (criterion 7, §3.6).
3. `execAdmin` a `check_in_at` onto **Priya**'s row *after* step 4 marks her —
   see §3.3. Comment that the UI cannot produce this state.
4. Go to `/meetings/live/<sessionId>` (no time shift needed — §3.3). Mark
   **Priya** present through the real control: `role=radio` named `Present`
   **scoped to** the `role=radiogroup` named `Attendance for Priya Raman`. An
   unscoped `Present` matches one control per student. Leave Jordan and Sam
   unmarked.
5. Open **End meeting**. Assert the checkbox reads
   `Mark 2 students with no attendance record absent` — the count is itself an
   assertion about roster resolution and **proves Casey (`is_active=false`) was
   excluded**. Leave it **unticked**. Screenshot.
6. Confirm (mind the two `End meeting` controls — §3.3). Then assert:
   - `event_sessions.status = 'completed'`;
   - `attendance` for this session has **exactly one row**, Priya's, and
     **zero** rows for Jordan and Sam. Not "no absent rows": *no rows at all*.
     **This is criterion 3.**
   - Priya's `status` is still `present`, and her `check_out_at` equals the
     session's `ends_at` (write-path step 2, reachable only because of step 3).

#### A2. The same journey with the opt-in **ON**, and the participation figure (criteria 1, 2, 4, 6)

One test, because the participation move is produced by this ending.

1. New meeting `W3END Opt-In Night`, same shape, scope narrowed.
2. In the live console mark **Jordan** present. **Leave Priya and Sam
   unmarked** — this is deliberate and is what makes criterion 6 measurable
   (§3.2: only an explicit `absent` mark moves the figure).
3. **Immediately before confirming**, read and record, for Priya and for
   Jordan: `readRowsAs('student', "select … from v_student_participation where
   student_id = '<id>'")`. **Filter by `student_id`** — measured: the student
   persona's read returns **all three** students' rows. (Whether a student
   should see peers' percentages at all is worth a findings row; see §6.)
4. Open End meeting, assert the label reads `Mark 2 students …`, **tick** it,
   screenshot, confirm.
5. Assert on `attendance` for this session — **criterion 4**:
   - three rows;
   - Priya and Sam: `status='absent'`, `method='coach'`, `recorded_by is null`;
   - **Jordan's row is untouched** — still `present`, original `method` and
     `recorded_by`. That is `ignoreDuplicates` working, and it is the half of
     criterion 4 a naive count would miss.
6. Assert on participation — **criterion 6**, as a **delta against the values
   read in step 3, not against a hardcoded percentage**:
   - Priya: `expected_ct` **+1**, `present_ct` **unchanged**,
     `participation_pct` **strictly decreased**;
   - and, as an **independent witness**, that the view agrees with the raw
     table: `expected_ct` equals the number of Priya's `attendance` rows on
     `completed` sessions of participation-counting events, and `present_ct`
     equals how many of those are `present` or `late`. Read those counts with
     their own SQL against `attendance`, **not** by re-running the view's own
     formula — recomputing the view's arithmetic and comparing it to the view
     proves nothing.
   - Jordan corroborates in the other direction (he was marked present).
7. Sign in as `student` and read the **rendered** figure. Measured: it renders
   at `/` as `Participation: 100%` (`StudentHome.tsx:1649`) and on `/meetings`.
   **The comparison must be numeric, not string equality and not a substring
   match**: the value is interpolated as a raw JS number, so `80.0` renders
   `80` and `66.7` renders `66.7`. Parse it
   (`Number(text.replace('%','').trim())`) and compare to the view's
   `participation_pct` as a number. **Add an explicit branch for `NULL`**,
   which renders `—` (§3.2). Screenshot.

#### A3. Mutations for Turn A (criteria 2, 3, 10)

Per §5. Two:

| # | Mutation | Must turn red |
| --- | --- | --- |
| 1 | `endMeeting.ts:423` — point the flip at the wrong session: `.eq('id', sessionId)` → a different id | A1's `status='completed'` assertion |
| 2 | `endMeeting.ts:434` — delete the `if (payload.markAbsentStudentIds.length > 0)` guard so the upsert is unconditional | A1's "exactly one row, none for Jordan or Sam" assertion |

### Turn B — `coach-meeting-series.spec.ts`

`beforeEach` per §3.1, prefix `W3SER `.

#### B1. A series edit changes only what was touched (criteria 1, 2, 5)

1. Create a **weekly recurring** series `W3SER Series`, ≥3 sessions. Recurring
   mode needs a date range **and** weekday chips — chips alone leave the submit
   at `Create 0 meetings`. Chips resolve to both a `<label>` and a `<button>`:
   use `getByRole('button', { name: 'Tue', exact: true })`. The second calendar
   click completes the range and dismisses the calendar — **do not press
   Escape**, which closes the whole dialog.
2. Snapshot every session's `id`, `session_date`, `starts_at`, `ends_at`.
3. Open `Edit – W3SER Series`, change **only** the title, save.
4. Assert `events.title` changed and **every session's `starts_at`/`ends_at` is
   byte-identical** to the snapshot, and the id set is unchanged. Compare the
   whole set. Comment that these rows *were* rewritten with re-derived
   identical values (§3.4) — the test guards value identity, not that the
   write was skipped.

#### B2. Cancel one occurrence (criteria 1, 2)

Click `Cancel <date> session` for one future session. Assert that session's
`status='canceled'` and **every sibling is untouched** (same status, same
times). Screenshot. Note that Cancel is **not** behind the reconcilable guard
(§3.5).

#### B3. Mutation for Turn B (criteria 2, 5, 10)

Revision 1's mutation 3 was **vacuous** and is replaced. Use one that perturbs
the written **value**:

| # | Mutation | Must turn red |
| --- | --- | --- |
| 3 | `meetings.ts:707-709` — in `updateSessionTime`, write `ends_at` one hour later than `args.session.endsAt` | B1's byte-identical times assertion |

---

## 5. Mutation procedure, and the evidence to report

**Every mutation runs in your own git worktree (item 23), and you commit the
candidate work before mutating** (item 26's "commit before mutating" — T323 lost
an uncommitted fix to `git checkout --` doing double duty).

```bash
git worktree add /tmp/gam344-mutate -b claude/gam-344-mutation HEAD
```

The harness database, API server and port 4174 are **shared** — run mutations
one at a time. For each: build `dist-e2e` in the worktree, stop the main
preview, start preview from the worktree on 4174, run **only** the affected
test, capture the **real red output verbatim with its exit code**, revert,
rebuild, re-run green.

**A mutation that does not turn its test red is a finding about the test**, not
a footnote: the criterion is vacuous and must be fixed until it fails.
`.claude/skills/mutation-replay` is the procedure.

Report:

- `npx playwright test -c tests/e2e-harness/playwright.personas.config.ts` —
  the **whole** persona suite with its exit code. Not just your file; Task 1
  exists because a sibling was left red.
- The same command **twice with no reseed** (criterion 10).
- Each mutation: exact diff, command, failing assertion, exit code.
- Screenshots under `tests/e2e-personas/screenshots/`, `<nn>-<persona>-<moment>`,
  for evidence-bearing moments only — the opt-in visible and unticked; ticked;
  the list after a cancel; the student's participation figure. Not every page.
- `.claude/skills/gate-run` for the six gates.
- The findings file, **even if empty** (§6).
- **The commit SHA your work landed in** (item 21). "Clean" is not "committed";
  the orchestrator verifies HEAD moved and the change is in the committed blob.

---

## 6. Findings

Write `docs/swarm/inbox/claude-gam-344-w3-meeting-e2e-findings.json` in the
schema in `docs/swarm/active/FINDINGS-PIPELINE.md`. **Emit it even if you find
nothing** — an empty `findings` array is a claim that you looked; a missing file
cannot be told apart from never having checked.
`docs/swarm/inbox/claude-gam-342-e2e-w1-checkin-findings.json` is a worked
example from the sibling W1 run.

Established already; **re-verify rather than take on trust**:

- **The persona suite is not run by any CI workflow, and two of its tests had
  gone stale on `main` unnoticed.** `grep -rn "e2e-personas" .github/workflows/`
  returns nothing. Argue the severity yourself per item 30b — who is affected
  today, what it costs. Note honestly that the fix is a `.github/workflows/**`
  change, which **a dispatched run cannot push** (`AGENTS.md` § "Two walls"), so
  this necessarily lands as a filed row. `findingKey`:
  `e2e-personas/persona-suite-not-in-ci`.

Candidates you will be in a position to judge — file them only if you can state
the user-visible consequence:

- **A student's `v_student_participation` read returns every student's row**,
  not just their own (measured by the premise gate). Item 25 says grade against
  *this* threat model — a volunteer team, no PII, and a leaderboard that already
  shows everyone's hours by design. Decide honestly whether that makes it a
  non-finding, and if you file it, say why it is not the same shape as the T185
  mistake item 25 records. `findingKey`: `e2e-personas/student-sees-peer-participation`.
- **The checkout leg of the end-meeting write path is unreachable from any UI
  in this harness** (§3.3). This is a coverage-honesty note, not necessarily a
  defect.

Do **not** file: the `cancelSession` asymmetry (§2.1), or the end-meeting error
reporting (§2.2 — already GAM-283).

`findingKey` is the dedupe identity and must never contain `file:line`. Findings
land in `Backlog` with `tier/unreviewed`, unassigned, no priority.

---

## 7. Least confident decisions (item 19d) — revision 2

Round 1's list was worth its cost: decisions 1, 2 and 5 were all wrong, and the
gate found them by running things. These are the new ones.

1. **Asserting criterion 6 as a delta plus a raw-table cross-check, instead of
   a fixed percentage.** I chose it because Turn A ends two meetings, so any
   absolute number depends on within-file test order. **What would make it
   wrong:** if `expected_ct` can move for a reason other than the ending — e.g.
   an earlier spec in the serial suite leaving a completed session with a mark
   for Priya — then "+1" is not stable either, and the test is flaky rather
   than wrong. I believe the `beforeEach` prefix isolation prevents it; I have
   not proven no other file marks Priya on a completed session.
2. **Pre-seeding `check_in_at` with `execAdmin` to reach the checkout leg
   (§3.3).** The alternative was to drop the assertion entirely. **What would
   make it wrong:** if a state no UI can produce also makes the *rest* of the
   dialog behave differently — the summary's status dots, or
   `computeCheckoutStudentIds` interacting with the opt-in count — then A1's
   `Mark 2 students` assertion could shift underneath the seeding, and I would
   have coupled two criteria that should be independent.
3. **Ordering step 3 after step 4 in A1** (mark Priya in the UI, *then* seed her
   `check_in_at`). **What would make it wrong:** if the console's upsert is
   still in flight when the seed lands, the seed could be overwritten, or the
   upsert could clobber it — a race that would show up as an intermittently
   null `check_out_at`. A poll on the row before seeding fixes it; I have not
   prescribed one, and should have.
4. **Splitting into two turns with Turn A prioritised.** **What would make it
   wrong:** if criterion 5's series-edit path is the one the owner actually
   cares most about — T510 closed two data-loss paths there — then shipping A
   alone delivers the wrong half. I weighted by the issue's own sentence
   ("*the half that writes the most has none*"), which points at the
   end-meeting path, but that is a reading of emphasis, not an instruction.
5. **Telling the worker to narrow every Turn A meeting to `Volt Robotics 9911`
   to stabilise the roster count.** **What would make it wrong:** it means no
   Turn A test exercises the all-teams default scope, which is what a coach
   actually gets if they change nothing — so a defect that only appears with a
   multi-team roster would be invisible to this file. That is a real coverage
   hole I am accepting to buy a deterministic assertion, and it should be named
   in the worker's report rather than discovered later.
