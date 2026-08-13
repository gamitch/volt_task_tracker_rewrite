# GAM-344 — task packet (HEAVY)

**Issue:** [GAM-344 — E2E — W3 Run a meeting: schedule → attendance → participation %](https://linear.app/gamitch/issue/GAM-344/e2e-w3-run-a-meeting-schedule-attendance-participation-percent)
**Branch:** `claude/gam-344-e2e-w3-run-a-meeting`
**Base commit:** `93c89d0`
**Tier:** HEAVY (item 26). Premise gate scoped light per item 19b — the
persona-E2E pattern is proven (GAM-342/PR #176 shipped it for W1); what is
*not* proven is this surface's own facts, which is what §4 measures.

Everything in §0 and §4 was **executed against the live cluster and the real
browser build on this container**, not read out of the issue. Where the issue
body and the tree disagree, §2 says so and the tree wins.

---

## §0. Environment — measured, and it does not work out of the box

`node_modules/` is empty on checkout and `playwright` is **not in
`package.json`** (constitution item 9 allows it as dev tooling; nobody declared
it). Four steps, in order, all verified on this container:

```bash
npm ci                                                    # exit 0
npm install --no-save playwright@1.62.1                   # exit 0 -> 1.62.1
npx playwright install --with-deps chromium               # exit 0
sudo bash tests/e2e-harness/start.sh                      # exit 0
```

| Gap | Symptom | Fix |
| -- | -- | -- |
| `start.sh` assumes **root** | `.claude/skills/scratch-postgres/scripts/start.sh:58` does `chown postgres` + `su postgres`; as uid 1001 `runner` it dies `chown: … Operation not permitted`, exit 1 | run it under `sudo` (passwordless sudo is available) |
| `playwright` undeclared | `Cannot find package 'playwright' imported from …playwright.personas.config.ts` | `npm install --no-save` — **`--no-save` is mandatory**, `package.json` and the lockfile must stay byte-identical (`git status --porcelain package.json package-lock.json` empty; verified) |
| **`vite preview` binds IPv6-only** | `webServer` polls `http://127.0.0.1:4174` and times out after its full 180s against a server that is up on `[::1]:4174` | start the preview yourself with `--host 127.0.0.1`; `reuseExistingServer: true` makes Playwright adopt it |

This IPv6 trap is **already a filed finding from GAM-342** — do **not** patch
`playwright.personas.config.ts`, it is correct in the sandbox it was written
for. Bring the server up yourself:

```bash
npm run build -- --mode e2e --outDir dist-e2e
npm run preview -- --outDir dist-e2e --port 4174 --strictPort --host 127.0.0.1 &
npx playwright test -c tests/e2e-harness/playwright.personas.config.ts
```

`psql -h 127.0.0.1 -p 55432 -U postgres -d scratch` works as `runner` once the
cluster is up, so `readRows` / `readRowsAs` / `execAs` need no change.

### §0a. Baseline — measured on this container, twice, at `93c89d0`

**Full persona suite: `27 passed, 5 failed`, exit 1.** These five are
pre-existing and are **not yours**. Report your figures as a *delta* against
this; a bare pass count is not a result.

| Failing test | Cause |
| -- | -- |
| `coach-meeting.spec.ts:88` | `'Volt Legacy 2201'` (archived) is **no longer offered** in the scope picker. Measured: `Expected − 1 / Received + 0`, the array is missing exactly that entry. |
| `coach-meeting.spec.ts:115` | Same root cause — times out 90s on `getByRole('option', { name: 'Volt Legacy 2201' })`, an option that no longer exists. |
| `student-parent.spec.ts:27`, `:121` | `getByText(/\/ 100 h \(/)` not found — the hours-float assertions. |
| `student-parent.spec.ts:66` | Fails at its **precondition**, line 71 (`expect(before).toHaveLength(0)`), on a leftover `rsvps` row for Priya on session `…-08`. The deeper stale-premise story (the RSVP control genuinely writes) is real but is *not* the observed failure. **This is a live example of the re-runnability hazard §5c warns you about — read it before you write your own cleanup.** |

**Two of those five are in the file you are extending, and you must still leave
them alone.** Diagnosis, verified: `coach-meeting.spec.ts:100-105` deliberately
pinned the archived team as visible, and its own comment says *"If a fix lands
that filters archived teams out of the scope picker, this line is the one to
delete."* **That fix landed** — `dd6e166` ("GAM-305: exclude archived teams from
meeting/outreach team-scope pickers") and `1c9dbbb`, with the filter at
`ScheduleMeetingsDialog.tsx:885` and `:1236`. The assertion is stale, exactly as
predicted.

**Do not fix it anyway.** It is already filed as **GAM-355**, which sits in
`Backlog` — and constitution item 28a says `Backlog` means filed, not
dispatchable. Fixing it here would be taking work from `Backlog` and would put
two rows on one change. This is the one place where "the file is in your Allowed
Files" does **not** mean "you may repair it": ownership of the file is not
ownership of the row. **Do not re-file it either** — GAM-355 exists, and the
`findingKey` `e2e-personas/five-pre-existing-w1-suite-failures-not-in-scope` is
already taken.

Practical consequence for you: after your change the suite should read
**`27 + <your new passing tests>` passed, `5` failed**. If any *other* number
appears in the failed column, it is yours.

---

## §1. What this row is, and what it is not

Extend the persona suite so the **W3 meeting journey** is driven end to end:
schedule → run → **end** → edit the series → cancel one occurrence → and the
**participation % a student reads**, each step proven by reading rows back.

`coach-meeting.spec.ts` (250 lines) already covers schedule-dialog defaults,
team scope, a single round-trip, weekly recurrence, and an RLS denial. **Never
driven:** ending a meeting, editing a saved series, cancelling one occurrence
inside one, and the student-facing participation figure.

**No production change is expected.** If you believe one is needed, that is a
**finding** (§7), not a licence to edit `src/**`.

---

## §2. Four corrections to the issue body — verified against the tree

The issue is good but four of its statements do not survive contact. Item 19c:
these were checked, not assumed.

1. **Loader paths.** Issue says `loaders/meetings.ts` / `loaders/endMeeting.ts`.
   Real: **`src/lib/supabase/loaders/`**.

2. **`EndMeetingDialog` is NOT reachable from `MeetingsList`.** The issue's
   screen list implies it is. Its **only** non-test mount is
   **`LiveConsole.tsx:1187`** (`endMeeting.ts:478` states this; grep confirms no
   other). The coach reaches it at **`/meetings/live/:sessionId`**. A worker
   following the issue's screen list will hunt for a button that does not exist.

3. **The opt-in checkbox's accessible name is dynamic.**
   `EndMeetingDialog.tsx:572` builds it as
   `Mark ${count} ${count === 1 ? 'student' : 'students'} with no attendance record absent`.
   Match by **regex**. It renders only when `unmarkedCount > 0` (gate at
   `:1033`, control at `:1035`).

   **But the count in it is STALE, and that is a real defect — see §5a AC 4.**
   The summary is loaded exactly once (`EndMeetingDialog.tsx:875`,
   `useLoadState(() => loadSummary(sessionId), [loadSummary, sessionId])`) and
   nothing in `LiveConsole` invalidates it. Gate-measured: after marking Priya
   **Present** in the console and waiting for the row to land, the label still
   read `Mark 3 students with no attendance record absent`. **Never assert the
   number.**

4. **The seed's live session cannot be *edited*.** `makeSaveMeetingSession`
   (`meetings.ts:1029`, guards at `:1043-1044`, throw at `:1062`) requires
   `.eq('status','scheduled')` **and** `.gt('starts_at','now')` and *rejects* on
   zero matched rows. `SEED.liveSession` (`5e550000-…-04`) starts **in the
   past**. Single-session edits must target a **future** session (`…-05`, +7
   days) or one you created.

---

## §3. The one thing that must not happen

**First, disambiguate two functions with confusingly similar names.** They are
different, and only one is protected:

| Function | Where | Role here |
| -- | -- | -- |
| `cancelSession` | `meetings.ts:788-792`, a closure inside `makeSaveMeetingSeries` | **PROTECTED — do not touch.** This is the D016 asymmetry below. |
| `makeCancelMeetingSession` | `meetings.ts:966-977`, reached from `MeetingsList.tsx:2946` | **This is the one §5a tells you to drive** for "cancel one occurrence". Also unguarded. |

**Do not "fix" the `cancelSession` asymmetry in `meetings.ts`.** Verified live:

* `deleteSessionIfStillFuture` — `meetings.ts:764-773` — **carries**
  `.gt('starts_at', 'now')`.
* `cancelSession` — `meetings.ts:788-792` — **carries no time guard**, and the
  comment at `:775-787` says it is *"DELIBERATELY, PERMANENTLY NOT time-guarded
  (D016 §3 — load-bearing, do not 'harden' this back into the defect)"*.

A symmetric guard there would silently no-op in exactly the raced case the
function exists to repair, leaving a session `scheduled` on screen with its
RSVPs already destroyed. **If a spec makes this look like a bug, the spec is
describing a deliberate decision — record it in a comment, do not file it and
do not change it.**

**Ending a meeting reports failures poorly — already tracked as
[GAM-283](https://linear.app/gamitch/issue/GAM-283).** `endMeeting.ts:98-114`
explains why (`runMutation` normalises rejections to a non-`Error` object, so
`EndMeetingDialog.tsx`'s `instanceof Error` check always falls through to a
generic string). If you reach it, **cite GAM-283; do not file a duplicate.**

### Allowed Files

| Path | Why |
| -- | -- |
| `tests/e2e-personas/coach-meeting.spec.ts` | extend — end-meeting + series edit |
| `tests/e2e-personas/student-participation.spec.ts` | **new** — AC 6 |
| `tests/e2e-personas/screenshots/*.png` | AC 8 |
| `docs/swarm/inbox/claude-gam-344-e2e-w3-run-a-meeting-findings.json` | AC 9 |

**Forbidden:** all of `src/**`, `supabase/**`, `tests/e2e-harness/**`,
`package.json`, `package-lock.json`, `.claude/**`, `docs/swarm/**` except the
inbox file above, and **anything under `.github/workflows/**` (a dispatched run
physically cannot push those — do not try).**

---

## §4. Ground truth — measured on the live cluster, copy these numbers

> **Read this before trusting any number below.** These figures were read from a
> cluster that **had already run the persona suite**, not from a pristine seed.
> The gate caught me claiming "before any spec runs" and it was false — the
> cluster carries a `Priya / …-04 / late / coach` row that `seed.sql` never
> writes (it seeds `…-01/02/03/06` only); `coach-checkin.spec.ts` put it there.
> Anything you assert about **Priya's participation** is reseed-sensitive.
> `sudo bash tests/e2e-harness/start.sh` is documented re-runnable and recreates
> the cluster and reloads the seed, so **reseed before the AC 6 spec** rather
> than engineering around the drift.

Seed structure, `psql` output:

```
event e0e00000-…-01  "Weeknight Build Session"  type=meeting
  team_ids = {7ea11000-…-01}   counts_participation = t

sessions:  …-01 2026-07-23 completed   …-02 2026-07-30 completed
           …-03 2026-08-06 completed   …-04 2026-08-13 scheduled  <- SEED.liveSession, STARTED 30m AGO
           …-05 2026-08-20 scheduled                              <- the future one
```

Active students on team FRC `7ea11000-…-01` (**Casey is `is_active=false`** and
is filtered out server-side by `endMeeting.ts:286`; Nina/Theo are FTC and are
filtered out by team scope):

```
Priya Raman   57000000-…-01
Jordan Okafor 57000000-…-02
Sam Whitfield 57000000-…-03
```

**So the end-meeting roster for any session of event `…-01` is exactly three
students.**

### `v_student_participation` — the AC 6 arithmetic, live

```
 display_name  | expected_ct | present_ct | late_ct | excused_ct | participation_pct
---------------+-------------+------------+---------+------------+-------------------
 Jordan Okafor |           3 |          2 |       0 |          0 |              66.7
 Priya Raman   |           4 |          4 |       0 |          0 |             100.0
 Sam Whitfield |           3 |          2 |       0 |          1 |             100.0
```

The view (`\d+ v_student_participation`, read from the live database):

* counts only sessions the student has an **explicit attendance mark** for,
* on `event_sessions.status = 'completed'` **only**,
* on events with `counts_participation`, team-scoped,
* `participation_pct = round(100.0 * (present+late) / (marked - excused), 1)`,
  **null when the denominator is 0** — and a student with **no** marks has **no
  row at all**, which the UI renders as an em dash, never `0%`.

**This is why AC 6 is a real test and not decoration:** the end-meeting action
moves this figure by *both* of its writes — the absence rows add to the
denominator, and the status flip is what admits the session to the view at all.

### The prediction table — for a NEWLY CREATED meeting, from a pristine reseed

These numbers are for **a meeting you create yourself** on team FRC with
`counts_participation`, ended with the opt-in **on** and nobody marked, against
**freshly reseeded** fixtures. They are **not** for `SEED.liveSession`
(`…-04`) — §5a forbids using it, and against the drifted cluster Priya does not
move at all (100.0 → 100.0, gate-measured in a rolled-back transaction).

| Student | before | after | why |
| -- | -- | -- | -- |
| Priya | 4/4 → **100.0** | 5 marked, 4 present → **80.0** | gains one `absent`. **Reseed-sensitive — this is the one that drifts.** |
| Jordan | 3/2 → **66.7** | 4 marked, 2 present → **50.0** | gains one `absent`. Held in every state the gate tested. |
| Sam | 3/2/1ex → **100.0** | 4 marked, 2 present, 1 excused → **66.7** | denominator 3. Held in every state the gate tested. |

Assert the *predicted numbers*, not merely "it changed" — but **reseed first**,
and say in a comment that you did.

### The student's own surface, and its exact rendered format

`MeetingsList.tsx:2769` renders `<StudentMeetingView variant="own" …>`, so a
student reads their participation figure at **`/meetings`**. **The format is
already pinned in-repo — do not spend a turn discovering it.**
`StudentMeetingView.tsx:757` renders ``​`Participation: ${participation.participationPct}%`​``
(`StudentHome.tsx:1649` the same), and `MeetingsList.test.tsx:2045` already pins
`'Participation: 85.7%'`. So: **a whole number renders `80%`, a fractional one
renders `66.7%`.**

**Cheap second witness (take it):** `StudentHome.tsx:1649` renders the same
string on `/`. One extra `goto` proves the figure is not route-local.

### Locator traps on THIS surface — gate-measured, use verbatim

* **Two controls are named "End meeting"** — the trigger `Button`
  (`EndMeetingDialog.tsx:1042`) and the confirm `AlertDialog`'s `actionLabel`
  (`:1057`). Unscoped, that is a strict-mode violation once the dialog opens.
  Scope the confirm to the `alertdialog` titled **"End this meeting?"**.
* **The series-edit confirm has the SAME trap and it is silent.** The row button
  and the confirm `AlertDialog` are **both** named **"Save changes"** — the count
  goes 1 → 2 on open. A single click appears to work and **saves nothing**; the
  gate reproduced exactly that. Scope the second one.
* **The series-edit trigger uses an EN DASH:** `Edit – <title>`, e.g.
  `Edit – Weeknight Build Session`. `getByRole('button', { name: 'Edit', exact: true })`
  **times out** — the gate burned a 90s timeout on precisely this.
* **The expander** is `Show session details – <title>` /
  `Hide session details – <title>` (en dash again); its *visible* text is
  `Session details (5)`.
* **Per-session cancel has three overlapping names:** the row trigger
  `Cancel <date> session` (e.g. `Cancel Tue, Sep 1 session`), the alert dialog's
  dismiss `Cancel`, and its confirm `Cancel session`. Scope all three.
* The dialog that opens is titled **"Edit meeting series"** and is prefilled in
  **Custom dates** mode with a *single shared* Start/End pair.
* The skill's `Escape`-closes-the-whole-dialog trap and the
  recurring-mode-needs-a-date-range trap were both learned on **this** file.
  Re-read `.claude/skills/e2e-personas/SKILL.md` § "Traps" before writing.

---

## §5. What to build, mapped to the issue's own acceptance criteria

The AC text below is the issue's, verbatim. Do not re-scope it silently; if one
cannot be met, say so and why in your report and emit it as a finding.

> 1. **Every step is driven, not inspected** — fields typed, dropdowns and weekday chips used, forms saved, and a saved series edited afterwards.
> 2. **Every write is proven by reading the row back and comparing values.** *Mutation: point the status flip at the wrong session → red.*
> 3. **Ending a meeting with the absence opt-in off writes no** `attendance` **rows.** *Mutation: send the upsert unconditionally → red.* T508 exists because the opposite shipped.
> 4. **Ending a meeting with the opt-in on writes one absent row per unmarked student**, and no row for anyone already marked.
> 5. **A series edit changes only what was touched.** Editing shared fields leaves untouched meeting times as they were. *Mutation: rewrite every session's time on save → red.* This is T611's defect.
> 6. **The participation figure a student reads matches the recorded attendance**, read as the student and compared against the database.
> 7. **Stored times are asserted in UTC.** The app writes Chicago wall time; 5:30 PM on 15 Dec is `2026-12-15 23:30Z`.
> 8. **Screenshots exist for the evidence-bearing moments** and are committed.
> 9. **Findings are emitted as JSON and filed.** A run that finds nothing records that explicitly.
> 10. **The suite is re-runnable without a reseed**, and each new spec is proven non-vacuous by at least one mutation with the red output recorded.

### 5a. `coach-meeting.spec.ts` — new `describe` blocks

**Build the journey on a meeting the spec creates through the UI**, not on
`SEED.liveSession` — `coach-checkin.spec.ts` already writes to `…-04` and
asserts on it.

#### FIRST, FIX THE CLEANUP — otherwise every test in this file dies on run 2

`attendance_session_id_fkey` is **`ON DELETE RESTRICT`**. The existing
`beforeEach` at `coach-meeting.spec.ts:63` does
`delete from events where title like 'E2E %'`, which cascades to
`event_sessions` — and `attendance` **blocks it**. Gate-measured:

```
ERROR:  update or delete on table "event_sessions" violates foreign key constraint
        "attendance_session_id_fkey" on table "attendance"
```

`execAdmin` throws, so from the second run onward **every test in the file**
errors in `beforeEach`, including the three that pass today. AC 10 fails
outright.

**Editing line 63 is explicitly AUTHORISED** — it is the one repair in this file
you *are* meant to make (unlike the two stale archived-team assertions, which
belong to GAM-355). Widen it, children first:

```sql
delete from attendance where session_id in (
  select id from event_sessions where event_id in (
    select id from events where title like 'E2E %'));
delete from rsvps where session_id in (
  select id from event_sessions where event_id in (
    select id from events where title like 'E2E %'));
delete from events where title like 'E2E %' or title = 'Rogue Meeting';
```

**AC 3 — opt-in OFF writes nothing.** Create a meeting, go to
`/meetings/live/<its session id>`, leave the checkbox **unticked**, confirm.
Then assert **zero** `attendance` rows for that session — *and* assert the
session flipped to `completed` anyway, because `endMeeting.ts:442-449` runs
steps 2 and 3 unconditionally. Ticking nothing must not mean doing nothing.

**AC 4 — opt-in ON writes one row per unmarked student.** Same shape, but mark
**one** student present in the live console first, then tick the checkbox and
confirm. Assert: exactly one `absent`/`method='coach'`/`recorded_by is null` row
per *unmarked* student, and the already-marked student's row **unchanged**
(gate-verified: Priya stayed `present`/`recorded_by=<coach>` while Jordan and
Sam got `absent`/`coach`/`null`). `ignoreDuplicates: true`
(`endMeeting.ts:405`) is what protects it, so that is the property under test.

> **Match the checkbox label by regex ONLY —
> `/Mark \d+ students? with no attendance record absent/` — and do NOT assert
> the number.** The summary is loaded once (`EndMeetingDialog.tsx:875`) and
> LiveConsole never invalidates it, so after marking Priya the label still says
> `Mark 3 …` and the confirm dialog still says
> `Current attendance: 0 present · 0 late · 0 excused · 0 absent. 3 students
> with no attendance record will be marked absent.` **This is a real defect and
> it is yours to file** (§7) — the coach is shown a count that the write will
> not honour. It is *not* GAM-283, which is about failure *reporting*. Record
> the stale count in a comment; the row assertions are the real test.

**AC 5 — a series edit changes only what was touched.** Create a **recurring**
event, note every session's `starts_at`, reopen it via `Edit – <title>`, change
only a **shared** field (title / location / description), save (**twice** — see
the duplicate "Save changes" trap in §4), then assert **every** session's
`starts_at`/`ends_at` is byte-identical and only the `events` row moved.

> **Correction — my first draft taught a false mechanism, and the gate proved it
> by running the real function.** `plan.toUpdate` **already contains every kept
> session** (measured 3/3 for an unchanged three-session series; the app's own
> confirm dialog agrees: *"0 session(s) added · 0 session(s) removed · 3
> session(s) kept"*). So `makeSaveMeetingSeries` is **not** where T611's
> protection lives. It lives in
> **`ScheduleMeetingsDialog.tsx:1145-1151`**, whose
> `buildEditDesiredFutureSessions(sessionDates, startTime, endTime, timeFieldsTouched, originalTimesByDate)`
> reuses each untouched date's **own stored time verbatim**. That is what your
> test and your mutation must target.

> **The fixture must carry MIXED times or the test is vacuous.** If every
> session already shares one start time, even a correct mutation writes
> identical values and stays green. After creating the series, move one
> session's time (e.g. `update event_sessions set starts_at = …` on the second
> one) so the series is genuinely non-uniform, then do the shared-field save.

**Free on-screen witness for AC 5 — take it.** The series-edit confirm
`AlertDialog` states, before any write: *"0 session(s) added · 0 session(s)
removed · 3 session(s) kept."* That is the user-visible form of this criterion,
in one locator. Assert it alongside the row read.

**Cancelling one occurrence** — drive the per-session Cancel, which is
**`makeCancelMeetingSession` (`meetings.ts:966-977`)** reached via
`MeetingsList.tsx:2946` — **not** the protected `cancelSession` of §3. Assert
that session is `canceled` and **its siblings are not**. Cancel a **future**
session; see §2.4. Mind the three-way `Cancel` naming in §4.

**AC 7 — UTC.** `coach-meeting.spec.ts:166-167` already does this for the
single-meeting case; do the same for anything new you create.

### 5b. `student-participation.spec.ts` — new file, AC 6

**Reseed first** (`sudo bash tests/e2e-harness/start.sh`) — §4's numbers are
reseed-relative and Priya's is the one that drifts.

Sign in as the **student**, land on `/meetings`, read the participation figure
off the screen, and compare it against `readRowsAs('student', 'select … from
v_student_participation where student_id = …')`. Then run the end-meeting action
and assert the figure moves **to the predicted number** in §4's table, on both
the screen and the row. Format is settled: `80%` / `66.7%` (§4).

> **Do not claim this proves RLS scopes the view.** It does not.
> `readRowsAs('student', 'select * from v_student_participation')` returns **all
> three students** — the view has no `security_invoker`. A worker writing
> `toHaveLength(1)` goes red for the wrong reason, so **filter by
> `student_id`**. Under item 25 this is *not* a security finding: a leaderboard
> that shows everyone is the product, and item 25 explicitly says do not extend
> item 4's table rule to views. State what the assertion actually proves — that
> the figure the student is shown matches the recorded attendance — and nothing
> more.

### 5c. Re-runnability (AC 10) — the trap that bit GAM-342

**The hazard is not hypothetical — it is failing on `main` right now.**
`student-parent.spec.ts:66` fails at its own precondition (line 71,
`expect(before).toHaveLength(0)`) because a **leftover `rsvps` row** for Priya on
session `…-08` survived a previous run. That is exactly the failure mode this
section exists to stop you from adding a second instance of.

`beforeEach` cleanup alone is not enough: **`student-parent.spec.ts:48-64`
asserts a global row count for Priya with no session predicate**
(`select 1 from attendance where student_id = <Priya> and method = 'self'` — no
session filter, so no choice of session avoids it), and path order runs files
alphabetically. Before you finish:

1. Run the **full** persona suite twice in a row without reseeding and show both
   figures.
2. Restore anything you mutated outside your own `E2E %` events — in an
   `afterAll`/`finally`, so it fires even when a test fails mid-write.
3. **Do not delete attendance for session `…-06`** — it is Priya's only
   `v_student_hours` row and other specs read it.

---

## §6. Mutations (AC 10) — each must produce real red output, pasted

### READ THIS FIRST: a `src/**` mutation does NOT reach the browser by default

The persona suite drives a **prebuilt bundle**.
`playwright.personas.config.ts` hardcodes `baseURL = http://127.0.0.1:4174` and
sets `reuseExistingServer: true`, and `tests/e2e-harness/**` is Forbidden so you
cannot change the port. Item 23 requires you to mutate `src/**` only in your own
worktree. **Put those together and the mutated source is never built into the
bundle the browser loads — every mutation stays green and proves nothing.** The
gate measured this: probe runs finished in 4-6s with no build step, because
Playwright adopted the already-running preview.

**Port 4174 is owned by whatever preview is currently serving it.** For a
mutation run you must take it over and give it back. The loop, in full:

```bash
# in YOUR OWN worktree (item 23), with the mutation applied:
npm run build -- --mode e2e --outDir dist-e2e          # build the MUTATED bundle
# stop whatever holds 4174, then serve YOUR dist-e2e on it:
npm run preview -- --outDir dist-e2e --port 4174 --strictPort --host 127.0.0.1 &
npx playwright test -c tests/e2e-harness/playwright.personas.config.ts <spec>
#   ^ expect RED. Paste the real "Expected … Received …".
# revert the mutation, rebuild, restart the preview, re-run -> expect GREEN.
```

Commit before mutating (item 26's fast-tier rule, which applies to any
mutation). Never commit a mutation. Restore port 4174 to a clean-tree bundle
when you are done and say that you did.

| # | Mutation | Where | Must turn red |
| -- | -- | -- | -- |
| 1 | point the status flip at a wrong session id | `endMeeting.ts:423` | AC 2 |
| 2 | remove the `markAbsentStudentIds.length > 0` guard so the upsert always sends | `endMeeting.ts:434` | AC 3 |
| 3 | in `buildEditDesiredFutureSessions`'s call site, **ignore `timeFieldsTouched`/`originalTimesByDate`** and apply the dialog's shared start/end to **every** date | `ScheduleMeetingsDialog.tsx:1145-1151` | AC 5 |

**Mutation 2 is the one that matters most:** it is *literally* the defect T508
closed. If AC 3 stays green with the guard removed, AC 3 is worthless.

**Mutation 3 was wrong in the first draft and is corrected here.** The original
("force every session into `plan.toUpdate`") is a **no-op** — `toUpdate` already
holds every kept session, measured 3/3. It also only bites if the fixture has
**mixed times** (§5a); with a uniform series even the correct mutation writes
identical values and stays green.

Report each as: the exact diff, the exact failing assertion text
(`Expected … Received …`), and the restored green run.

---

## §7. Findings (AC 9)

Emit `docs/swarm/inbox/claude-gam-344-e2e-w3-run-a-meeting-findings.json` in the
schema in `docs/swarm/active/FINDINGS-PIPELINE.md`, **even if you find
nothing** — an empty `findings` array is a claim that you looked; a missing file
is indistinguishable from never having checked. `findingKey` is
`e2e-personas/<stable-slug>`, never `file:line`.

### One finding is pre-specified — file it

`findingKey`: **`e2e-personas/end-meeting-summary-stale-after-console-marking`**
Severity **MAJOR**, `area` `w3`, `verifiedBy` `browser`.
The end-meeting summary loads once (`EndMeetingDialog.tsx:875`) and nothing in
`LiveConsole` invalidates it, so attendance marked in the console during the
meeting is invisible to the dialog. The coach is shown
`Mark 3 students with no attendance record absent` and
`Current attendance: 0 present · … 3 students … will be marked absent` **immediately
before confirming a write that will not do that** — the upsert's
`ignoreDuplicates` correctly spares the already-marked student, so the *write* is
right and the *number the coach was shown* is wrong. Gate-measured in a browser.
This is **not** GAM-283 (failure reporting) and has no existing row.

Already known — **do not re-file**: the `cancelSession` asymmetry (§3, by
design), partial-failure reporting (**GAM-283**), the IPv6 preview bind and the
five pre-existing suite failures (**GAM-355**, `Backlog` — its `findingKey`
`e2e-personas/five-pre-existing-w1-suite-failures-not-in-scope` is taken),
`events.created_by` never set (`coach-meeting.spec.ts:169-175`), and the
archived team in the scope picker (`:100-105`).

---

## §8. Least confident decisions — ROUND 2 (item 19d)

Round 1's list is preserved below as §8-round-1 with the gate's verdicts, per
item 30d's principle that a rewrite keeps the original. These are the *new*
doubts, after the gate closed the old ones.

1. **That the mutation loop in §6 actually works end to end.** I wrote it from
   the gate's diagnosis; **nobody has run it**. It assumes a second `vite
   preview` can take port 4174 after the first is stopped, and that
   `globalSetup.mjs` will not object to a bundle built from a worktree.
   **What would make it wrong:** `--strictPort` races the dying preview, or
   `globalSetup` pins something to the original build.
2. **That reseeding before the AC 6 spec is safe for the rest of the suite.**
   `start.sh` recreates the cluster wholesale. If the worker reseeds mid-run,
   every other spec's assumptions reset too. **What would make it wrong:** the
   suite is order-dependent in a way that makes a mid-run reseed worse than the
   drift it fixes — in which case AC 6 should run against a computed
   *before/after delta* instead of absolute numbers.
3. **That widening the `beforeEach` cleanup is sufficient and not excessive.**
   My SQL deletes `attendance` and `rsvps` for `E2E %` sessions. **What would
   make it wrong:** another table also has a RESTRICT FK to `event_sessions`
   that no test has hit yet, or the delete is broad enough to catch a fixture
   row some other spec reads.
4. **That the stale-summary defect is genuinely unfiled.** The gate searched and
   found nothing, and I checked GAM-283 is a different row. **What would make it
   wrong:** an existing row phrased around "the coach sees the wrong count"
   rather than around the summary loading once.
5. **That AC 5 is now provable.** It depends on both corrections landing
   together — the repointed mutation *and* the mixed-time fixture. **What would
   make it wrong:** `buildEditDesiredFutureSessions` is not reachable from a
   worktree mutation in a way that survives the build, making AC 5 verifiable as
   an outcome but still not provably non-vacuous.

---

## §8-round-1. The original list, with the gate's verdicts (preserved)

| # | Doubt | Gate verdict |
| -- | -- | -- |
| 1 | Can a future session be ended through `LiveConsole`? | **REFUTED — it can.** Drove `/meetings/live/…-05`, got `End meeting` + `Mark 3 students…`, completed a full end. Design safe. |
| 2 | Is the series-edit surface reachable as described? | **REFUTED as a risk**, but the description was wrong in three ways (en-dash `Edit – <title>` row button, not a menu; dialog "Edit meeting series"; prefilled Custom dates). Corrected in §4/§5a. |
| 3 | Is AC 4's already-marked case reachable? | **CONFIRMED as a real defect** — the summary is stale. Became the §7 finding. |
| 4 | Do §4's participation predictions hold exactly? | **PARTLY WRONG.** Jordan/Sam hold everywhere; Priya's 80.0 needs a pristine reseed. Corrected in §4. |
| 5 | Is `--host 127.0.0.1` still needed? | **SOUND**, and now directly observed (`LISTEN [::1]:4179`; `curl 127.0.0.1` → 000, `curl [::1]` → 200). |
| 6 | Is leaving the two red tests alone right? | **SOUND.** GAM-355 confirmed in `Backlog`; §0a's delta rule neutralises the competing reading. |

Original text of the six, verbatim:

## §8-original. Least confident decisions (item 19d) — attack these first

1. **That a *future* session can be ended at all through `LiveConsole`.** §5a
   builds the whole journey on a self-created meeting, which is necessarily in
   the future. I verified `endMeeting.ts` has no time guard and that
   `EndMeetingDialog` renders the trigger purely on `status === 'scheduled'`
   (`:1026`) — but I did **not** drive `LiveConsole` in a browser against a
   future session, and `LiveConsole` may gate the console itself on the session
   being live. **What would make it wrong:** the console redirects, or hides the
   End-meeting header action, for a session that has not started. If so the
   journey must run on `SEED.liveSession` and §5c's collision problem returns —
   which is a materially different packet.
2. **That the series-edit surface is reachable as I describe.**
   `MeetingsList.tsx:194/241/249` documents a real edit mode wiring
   `initialData`/`onSaveMeetingSeries` into `ScheduleMeetingsDialog`, but I read
   that from module docs and did **not** open the menu in a browser. **What
   would make it wrong:** edit mode is coach-only in a way the persona lacks, or
   it opens a different dialog than AC 5 assumes.
3. **That AC 4's "already-marked student" case is reachable.** It needs the live
   console's own attendance marking to write a real row first
   (`coach-checkin.spec.ts` proves it does for `…-04`), *then* the checkbox to
   render with `unmarkedCount === 2`. **What would make it wrong:** the
   end-meeting summary loads once and does not see a mark made moments earlier
   in the same page session, making the count stale.
4. **That the §4 participation predictions hold exactly.** The arithmetic is
   mine, derived from the live view definition and the live seed. **What would
   make it wrong:** `student_teams` membership or an `excused` status
   interacting differently than I read — Sam's row already shows the excused
   branch behaves non-obviously (3 marked, 1 excused, still 100.0).
5. **That `--host 127.0.0.1` is still needed.** GAM-342 filed it; I reproduced
   the *fix* but never watched the *failure* on this container, so I am asserting
   a workaround for a symptom I did not personally observe here.
6. **That leaving `coach-meeting.spec.ts`'s two red tests alone is right.** I
   argued it from item 28a (GAM-355 is in `Backlog`), and I believe that is the
   correct rule. But the competing reading is real: the file is in Allowed
   Files, its own comment prescribes the one-line remedy, and AC 10 asks for a
   suite that is re-runnable and non-vacuous — which is harder to demonstrate
   with two permanent reds in the same file. **What would make it wrong:** if
   the checker cannot separate the worker's signal from the baseline noise, the
   cost of the rule lands on the deliverable rather than on the queue.

---

## §9. Definition of done for the worker

1. Every AC in §5 addressed, or explicitly reported as not met with the reason.
2. All three §6 mutations run, red output pasted, reverted, green re-verified.
3. Full persona suite run **twice** without reseed; both figures reported and
   compared against §0a's baseline. **Do not report a bare pass count** —
   report it as a delta against the baseline.
4. Findings JSON emitted (empty array is fine and is itself a claim).
5. Screenshots committed.
6. **A commit SHA in your report** (item 21). "Clean" is not "committed".
7. You do **not** self-certify. A `checker-reviewer` reviews this next.
