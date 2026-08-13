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
| `student-parent.spec.ts:66` | The RSVP control genuinely writes; that test's premise is stale. |

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
   Match by **regex**. It renders **only when `unmarkedCount > 0`**
   (`:1034`, gated at `:989`) — if everyone already has a mark, there is no
   checkbox to tick and AC 4 has nothing to assert.

4. **The seed's live session cannot be *edited*.** `makeSaveMeetingSession`
   (`meetings.ts:1036-1046`) guards `.eq('status','scheduled')` **and**
   `.gt('starts_at','now')` and *rejects* on zero matched rows.
   `SEED.liveSession` (`5e550000-…-04`) starts **in the past**. Single-session
   edits must target a **future** session (`…-05`, +7 days) or one you created.

---

## §3. The one thing that must not happen

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
| `docs/swarm/inbox/claude-gam-344-e2e-w3-meeting-findings.json` | AC 9 |

**Forbidden:** all of `src/**`, `supabase/**`, `tests/e2e-harness/**`,
`package.json`, `package-lock.json`, `.claude/**`, `docs/swarm/**` except the
inbox file above, and **anything under `.github/workflows/**` (a dispatched run
physically cannot push those — do not try).**

---

## §4. Ground truth — measured on the live cluster, copy these numbers

Seed state, `psql` output, before any spec runs:

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
numerator's denominator, and the status flip is what admits the session to the
view at all. Ending session `…-04` with the opt-in **on** and nobody marked
predicts, exactly:

| Student | before | after | why |
| -- | -- | -- | -- |
| Priya | 4/4 → **100.0** | 5 marked, 4 present → **80.0** | gains one `absent` |
| Jordan | 3/2 → **66.7** | 4 marked, 2 present → **50.0** | gains one `absent` |
| Sam | 3/2/1ex → **100.0** | 4 marked, 2 present, 1 excused → **66.7** | denominator 3 |

Assert the *predicted numbers*, not merely "it changed".

### The student's own surface

`MeetingsList.tsx:2769` renders `<StudentMeetingView variant="own" …>`, so a
student reads their participation figure at **`/meetings`** — the same route the
coach uses, rendering differently by role. Read it as the student
(`readRowsAs('student', …)`) **and** off the screen, and compare.

### Locator traps on THIS surface (beyond the skill's list)

* **Two controls are named "End meeting"** — the trigger `Button`
  (`EndMeetingDialog.tsx:1042`) and the confirm `AlertDialog`'s `actionLabel`
  (`:1057`). An unscoped `getByRole('button', { name: 'End meeting' })` is a
  strict-mode violation once the dialog opens. Scope to the `alertdialog`
  (title **"End this meeting?"**) for the confirm.
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
`SEED.liveSession`. Two reasons, both measured: `coach-checkin.spec.ts` already
writes to `…-04` and asserts on it, and the existing `beforeEach` in
`coach-meeting.spec.ts:63` only clears `title like 'E2E %'`. A self-created
event keeps you inside that cleanup and collides with nothing.

**AC 3 — opt-in OFF writes nothing.** Create a meeting, go to
`/meetings/live/<its session id>`, leave the checkbox **unticked**, confirm.
Then assert **zero** `attendance` rows for that session — *and* assert the
session flipped to `completed` anyway, because `endMeeting.ts:442-449` runs
steps 2 and 3 unconditionally. Ticking nothing must not mean doing nothing.

**AC 4 — opt-in ON writes one row per unmarked student.** Same shape, but mark
**one** student present in the live console first, then tick the checkbox
(regex-matched; assert its label says the count you expect) and confirm.
Assert: exactly one `absent`/`method='coach'`/`recorded_by is null` row per
*unmarked* student, and the already-marked student's row **unchanged** —
`ignoreDuplicates: true` (`endMeeting.ts:405`) is what protects it, so that is
the property under test.

**AC 5 — a series edit changes only what was touched.** Create a **recurring**
event (several sessions), note every session's `starts_at`, reopen it in edit
mode and change only a **shared** field (title / location / description), save,
then assert **every** session's `starts_at`/`ends_at` is byte-identical to
before and only the `events` row moved. `makeSaveMeetingSeries`
(`meetings.ts:842`) only issues `updateSessionTime` for `plan.toUpdate`; this
test is what proves the plan is not "everything".

**Cancelling one occurrence** — drive the per-session Cancel
(`MeetingsList.tsx` module doc #7c/#10d, `onCancelSession` →
`cancelMeetingSession`) and assert that session is `canceled` and **its
siblings are not**. Cancel a **future** session; see §2.4.

**AC 7 — UTC.** `coach-meeting.spec.ts:166-167` already does this for the
single-meeting case; do the same for anything new you create.

### 5b. `student-participation.spec.ts` — new file, AC 6

Sign in as the **student**, land on `/meetings`, read the participation figure
off the screen, and compare it against **`readRowsAs('student',
'select … from v_student_participation …')`** — the persona read, so the
assertion also proves RLS lets the student see their own row. Then run the
end-meeting action and assert the figure moves **to the predicted number** in
§4's table, on both the screen and the row.

Note honestly in a comment whether the screen renders `80.0` or `80` — read it,
do not guess the formatting.

### 5c. Re-runnability (AC 10) — the trap that bit GAM-342

`beforeEach` cleanup alone is not enough: **`student-parent.spec.ts:48-64`
asserts a global row count for Priya with no session predicate**, and path order
runs files alphabetically. Before you finish:

1. Run the **full** persona suite twice in a row without reseeding and show both
   figures.
2. Restore anything you mutated outside your own `E2E %` events — in an
   `afterAll`/`finally`, so it fires even when a test fails mid-write.
3. **Do not delete attendance for session `…-06`** — it is Priya's only
   `v_student_hours` row and other specs read it.

---

## §6. Mutations (AC 10) — each must produce real red output, pasted

Commit before mutating; revert and re-verify green after (item 26's fast-tier
rule, which applies to any mutation). **Mutations of `src/**` run in your own
worktree (item 23), never the shared tree, and are never committed.**

| # | Mutation | Where | Must turn red |
| -- | -- | -- | -- |
| 1 | point the status flip at a wrong session id | `endMeeting.ts:423` | AC 2 |
| 2 | remove the `markAbsentStudentIds.length > 0` guard so the upsert always sends | `endMeeting.ts:434` | AC 3 |
| 3 | force every session into `plan.toUpdate` so all times are rewritten | `meetings.ts:842` | AC 5 |

Mutation 2 is the one that matters most: it is *literally* the defect T508
closed, and if AC 3 stays green with the guard removed, AC 3 is worthless.

Report each as: the exact diff, the exact failing assertion text
(`Expected … Received …`), and the restored green run.

---

## §7. Findings (AC 9)

Emit `docs/swarm/inbox/claude-gam-344-e2e-w3-meeting-findings.json` in the
schema in `docs/swarm/active/FINDINGS-PIPELINE.md`, **even if you find
nothing** — an empty `findings` array is a claim that you looked; a missing file
is indistinguishable from never having checked. `findingKey` is
`e2e-personas/<stable-slug>`, never `file:line`.

Already known — **do not re-file**: the `cancelSession` asymmetry (§3, by
design), partial-failure reporting (**GAM-283**), the IPv6 preview bind
(GAM-342), `events.created_by` never set (`coach-meeting.spec.ts:169-175`), and
the archived team in the scope picker (`:100-105`).

---

## §8. Least confident decisions (item 19d) — attack these first

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
