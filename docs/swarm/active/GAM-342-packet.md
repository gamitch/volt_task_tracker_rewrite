# GAM-342 worker packet — E2E W1 check-in journey (round 2, post-gate)

**Issue:** GAM-342 — E2E — W1 Check in: a student arrives and gets counted
**Tier:** HEAVY (item 26). **Worker model:** default pin (`sonnet`) — none of
item 18's four triggers apply: no migration, no RLS policy or `security
definer`, no metric-view SQL, no auth/session/role logic. Test files only.
**Branch:** `claude/gam-342-e2e-w1-checkin`.

> **Round 1 of the premise gate returned REVISE (BLOCKER) and this is the
> revision.** Everything below marked *(gate-measured)* was verified in a real
> browser or against the live cluster by `checker-premise`, not read from
> source. Where this packet and the Linear issue body disagree, **this packet
> is right and the issue is stale** — the gate measured it.

---

## 0. Environment — already up; do not rebuild it

Do **not** run `tests/e2e-harness/start.sh`; it recreates the cluster and would
destroy state other specs read.

| Fact | Measured |
| -- | -- |
| Scratch Postgres | `psql -h 127.0.0.1 -p 55432 -U postgres -d scratch` |
| Harness API | `http://127.0.0.1:54321` |
| Preview bundle | `http://127.0.0.1:4174` (started with `--host 127.0.0.1`) |
| Playwright | `playwright@1.62.1`, installed `--no-save`; chromium present |

```bash
npx playwright test -c tests/e2e-harness/playwright.personas.config.ts
```

If the preview server has died, restart it **IPv4-bound** — `npm run preview`
alone binds `[::1]` only while the config polls `127.0.0.1`, which costs a
silent 180s timeout:

```bash
(setsid npm run preview -- --outDir dist-e2e --port 4174 --strictPort \
   --host 127.0.0.1 > /tmp/preview.log 2>&1 < /dev/null &)
```

**Baseline, stated honestly (gate revision 6).** `coach-checkin.spec.ts` alone
passes (1 passed, 5.4s). **The full persona suite is `21 passed, 5 failed`,
reproducible across two runs, exit 1.** All five failures are pre-existing, live
in files you may not edit, and are **not yours**:

| Failing test | Why |
| -- | -- |
| `coach-meeting.spec.ts:88` and `:115` | `Volt Legacy 2201` (archived) is no longer offered in the team picker — the test is stale against shipped archived-team-picker work |
| `student-parent.spec.ts:66` | **The RSVP control genuinely writes** — the gate deleted the suspected residue row, re-ran the test alone, and it still failed with a *fresh* `rsvps` row appearing. That test's premise is stale. (Round 2 corrected round 1's "leftover row" theory.) |
| `student-parent.spec.ts:27` and `:121` | both fail on `getByText(/\/ 100 h \(/)` not found — the hours-float assertions |

These five are **deterministic across three separate runs**, not order-dependent.

Do not chase or "fix" these. Record them; they are findings, not your task.

---

## 1. Acceptance criteria — verbatim from GAM-342 (gate revision 7)

1. **Every step is driven, not inspected.** The run types into fields, opens and selects from controls, submits, and edits something already saved. A spec that only asserts rendered text has not tested this workflow.
2. **Every write is proven by reading the row back and comparing values**, never by asserting which request was sent. *Mutation: point a write at the wrong session id → red.*
3. **A changed mark overwrites rather than duplicates.** Marking a student Present, then Late, leaves one row with the later value. *Mutation: switch the upsert to an insert → red.*
4. **Student self-checkoff is covered for real**, writing `method='self'`, and is not conflated with the QR path.
5. **The QR/short-code boundary is stated in the spec file itself**, naming the Edge Function and what was therefore not proven.
6. **Screenshots exist for the evidence-bearing moments** and are committed.
7. **Findings are emitted as JSON and filed.** A run that finds nothing records that explicitly rather than staying silent.
8. **The suite is re-runnable without a reseed.** Cleanup happens in `beforeEach` and touches only rows the run created.
9. **Each new spec is proven non-vacuous by at least one mutation**, per the `mutation-replay` skill, and the red output is recorded.

**Two criteria are re-scoped, with reasons, because the gate proved them
unmeasurable as written:**

- **AC 4 is met through the real UI.** *(Round 2 correction — the round-1
  packet wrongly declared this impossible.)* The surface is unreachable in
  **unmodified** seeded fixtures, but it is **reachable from a spec via one
  `execAdmin` arrangement line**, which is a thing specs in this suite already
  do (`coach-checkin.spec.ts:28-31`). The gate drove the whole path in a real
  browser and got a real `method='self'` row. Build it as a UI test (§6b.3).
- **AC 8** is scoped to **the new spec files' own re-runnability**, not the
  whole suite, because five pre-existing failures live in files you may not
  edit and one of them is *caused* by prior-run residue. Prove your own files
  run twice cleanly. **AC 8's "cleanup happens in `beforeEach`" is additionally
  strengthened to require an `afterAll`** — see §6.
- **AC 6** is satisfied by `capture()` calls listed in §5; screenshots are
  tracked (not gitignored), so they must be committed.

---

## 2. Corrections to the issue body — all gate-verified

1. **Loader paths.** The issue says `loaders/*.ts`; the real directory is
   **`src/lib/supabase/loaders/`**.
2. **`SelfCheckoffDialog` is NOT opened from `/outreach/:eventId`.** *(gate
   revision 1 — my round-1 claim was false.)* It is imported **only** by
   `src/pages/outreach/OutreachList.tsx:851`, on route **`/outreach`**, behind
   `Button label={`Mark attendance – ${event.title}`}` (`:3642`, **en dash
   U+2013**), gated by `allowSelfCheckoff && hasCompletedSession` (`:3592`),
   with `allowSelfCheckoff={false}` on the Upcoming section (`:4019`) and
   `true` only on Past (`:4031`).
3. **`selfCheckoff.ts` is INSERT + DELETE, never upsert** (module doc §4).
   **AC 3's upsert semantics therefore belong to the coach console only** — do
   not try to prove them on the self path.
4. **The kiosk calls a *different* Edge Function than the packet assumed.**
   *(gate revision 4.)* `kiosk.ts:369` invokes **`checkin-token`**, and
   `EDGE_FUNCTIONS` (`server.mjs:474-500`) has no such key → `404
   {"message":"harness: no stand-in for Edge Function \"checkin-token\""}`. The
   issue's claim that the kiosk "reports 'QR not available yet'" is **still
   true**, measured.

## 3. Routes (verified, `src/app/router.tsx:196-250`)

| Route | Guard | Component |
| -- | -- | -- |
| `/checkin` | `RequireAuth` (any role) | `CheckinResult` |
| `/kiosk/:sessionId` | `RequireAuth` + `RequireRole ['coach','admin']` | `KioskPage` |
| `/meetings/live/:sessionId` | `RequireAuth` | `LiveConsolePage` |
| `/outreach` | `RequireAuth` | `OutreachList` |

**Structural fact that is not obvious from the issue.** In `CheckinResult.tsx`
the code field and open-sessions picker render **inside the `error` state
branch** (branch starts `:809`; TextInput+Button `:832-847`; picker block
`~:857-895`, map at `:866`). Landing on `/checkin` with no URL credential
therefore shows "Couldn't check you in" **by design**, and that card is where
the journey continues. The seeded live session `5e550000-…-0004` is inside
`OPEN_SESSION_GRACE_MS` (2h, `checkin.ts:564`; window at `:457-458`) and appears
titled **`Weeknight Build Session`** *(gate-measured in a browser)*.

## 4. Two hard boundaries — measured, and binding on what you may claim

### 4a. The `checkin` Edge Function stand-in has no redemption branch

`tests/e2e-harness/server.mjs:475-492` is the whole stand-in: it checks
`identity.sub` and a `sessionId`, then **mints a rotating QR token**. There is
**no branch that accepts a short code and writes `attendance`.** So submitting a
code **cannot** produce a row here. Never write an assertion waiting for one.

**And the observable outcome is not an error card — it is a crash.** *(gate
revision 3; my round-1 claim was false.)* Measured: submitting posts
`{"session_id":"5e550000-…-0004","code":"ABC234"}`, gets `200` with a token
body, and the page **white-screens** — `pageerror: TypeError: Cannot read
properties of undefined (reading 'check_in_at')`, `document.body.innerText ===
""`, `#root` empty. Root cause: `CheckinResult.tsx:343` casts with `payload as
CheckinResponsePayload` without validating, and `:773`/`:792` then dereference
`state.attendance.check_in_at`. There is no error boundary. Note
`StudentHome`'s own code field does **not** crash on the same response — this is
`CheckinResult`-specific.

**AC 5 is a file-level obligation:** the spec file itself must name
`supabase/functions/checkin/` and state that HMAC validation, rate limiting,
session liveness and team scope are **not proven here** because Deno does not
run in this harness. A green suite must not read as QR coverage.

### 4b. The self-checkoff UI is unreachable in *unmodified* fixtures — and one line fixes that

*(Round 2 correction. The round-1 packet said "impossible, do not go looking."
That was **false**: the gate went looking and drove the entire path to a real
row. Arrange the fixture and test the feature.)*

Why it is invisible by default:

- Library STEM Night (`e0e00000-…-0002`) buckets **Upcoming**, because its
  session `5e550000-…-0008` is `scheduled` (2026-08-23) — and Upcoming passes
  `allowSelfCheckoff={false}` (`OutreachList.tsx:4019`).
- Measured on unmodified seed: `/outreach` as student exposes only
  `button "Hide session details – Library STEM Night"` and a `radiogroup` for
  RSVP. No `Mark attendance` button.

**The arrangement, both lines gate-measured:**

```ts
// beforeEach — moves STEM Night into Past, where allowSelfCheckoff is true
execAdmin(`update event_sessions set status = 'completed' where id = '5e550000-0000-4000-8000-000000000008'`);
// finally / afterAll — MANDATORY restore, or student-parent.spec.ts:66/74-78
// loses the "Sign-up opportunities" fixture it reads
execAdmin(`update event_sessions set status = 'scheduled' where id = '5e550000-0000-4000-8000-000000000008'`);
```

With that in place the gate measured, in a real browser as `student`:

1. `/outreach` exposes `button "Mark attendance – Library STEM Night"` (**en
   dash U+2013**, byte-checked).
2. The dialog opens with two rows: `…-0006` **disabled / "Already recorded"**
   (Priya's existing coach row, via `computeLockedSessionIds`) and `…-0008`
   checkable, labelled "Counts as about 4h".
3. Checking `…-0008` and pressing `button "Save"` wrote, through the real app
   and real RLS: `session_id=…-0008, student_id=57000000-…-0001,
   status=present, method=self, recorded_by=a0000000-…-0003`.

## 5. Allowed Files

Create or edit **only**:

- `tests/e2e-personas/coach-checkin.spec.ts` *(extend)*
- `tests/e2e-personas/student-checkin.spec.ts` *(new)*
- `tests/e2e-personas/screenshots/*.png` *(generated by `capture()`)*
- `docs/swarm/inbox/claude-gam-342-e2e-w1-checkin-findings.json` *(new)*

**Forbidden:** all of `src/**`, `supabase/**`, `tests/e2e-harness/**`,
`package.json`, `package-lock.json`, `.github/workflows/**`, and every
`docs/swarm/**` path except the one inbox file. **No production code changes.
If a test cannot pass without one, that is a finding — emit it, do not fix it.**

## 6. What to build

### 6a. `coach-checkin.spec.ts` — extend, do not rewrite

Keep the existing test verbatim; it is the proven baseline. Add:

1. **A changed mark overwrites rather than duplicates (AC 3).** Coach →
   `/meetings/live/${SEED.liveSession}` → mark Priya **Present**, wait for the
   row, then mark **Late**. Assert **exactly one** row for
   `(session_id, student_id)` **and** `status === 'late'` together, so the test
   fails if the mark silently did not take. *(gate-measured to work:
   `count=1, status=late`.)*
2. `capture()` the console after the change.

Locators — use verbatim, do not improvise:
`page.getByRole('radiogroup', { name: 'Attendance for Priya Raman' })` then
`.getByRole('radio', { name: 'Present' | 'Late' })`.

### 6b. `student-checkin.spec.ts` — new. Four describes.

**1. `/checkin` picker (the genuinely new ground).** Sign in as `student`,
`goto('/checkin')`. Assert the error card is the designed landing (comment that
it is). Assert the picker offers `Weeknight Build Session`, **and** corroborate
it against the database — the session that button represents is the one
`readRows` finds open. Click it; assert the code field and submit button appear.
`capture()` both moments.

Measured accessible names:
```
alert   "Couldn't check you in …"
button  "Try again"
button  "Weeknight Build Session"      // then, after clicking it:
textbox "Check-in code"                // placeholder "ABC234"
button  "Check in with code"
```

**2. The submit, as a boundary test — assert the crash, do not invent an error
card.** Type a 6-character code, submit, and assert the measured outcome:
`#root` empties / a `pageerror` fires. **Label it explicitly in a comment as a
harness-shaped input the deployed function would not produce**, so nobody reads
this as a production bug report. Assert **no `attendance` row** was written.
File the finding in §6d. Note §6b.1 partially overlaps
`student-parent.spec.ts:48-64`, which already drives a bad code through
`StudentHome`'s field — say so; the new ground is the **picker**.

**3. Self-checkoff through the real UI (AC 4) — this is the criterion the issue
cares most about.** Arrange the fixture (§4b), then drive it as a person does:

- `beforeEach`: the `…-0008 → completed` line, **plus** a defensive
  `execAdmin("delete from attendance where student_id = '${SEED.studentPriya}' and method = 'self'")`.
- Sign in as `student` → `/outreach` → click
  `button "Mark attendance – Library STEM Night"` (**en dash U+2013** — copy it,
  do not retype it).
- In the dialog, check the **`…-0008` / `Sun, Aug 23`** row (the `…-0006` row is
  disabled, "Already recorded" — assert that too; it is real evidence that the
  lock works) and press `button "Save"`.
- **Read the row back and compare values:** exactly one `attendance` row for
  `(…-0008, SEED.studentPriya)` with `status='present'`, `method='self'`,
  `recorded_by = PERSONAS.student.profileId`.
- `capture()` the dialog with the day checked.
- Wrap the write in **`try/finally`**, restoring `…-0008` to `scheduled` and
  deleting the self row in the `finally`.

**3b. The same write proven against real RLS (recommended, and the natural home
for mutation 3).** A second, clearly-labelled describe using `execAs`, which
runs as `authenticated` with the persona's real `auth.uid()`
(`personaHarness.ts:138-150`) — the **real `self_insert`/`self_delete`
policies**, not a superuser bypass. Use the verified SQL in §9, on session
**`5e550000-0000-4000-8000-000000000005`** (Priya has no row there, and a self
row there leaves `v_student_hours` unchanged — measured). Label it as a
**policy-level** proof; it complements §6b.3 and does not replace it.

**4. Kiosk (AC 1/6; gate revision 4 — cheap and high value).** Coach →
`/kiosk/5e550000-0000-4000-8000-000000000004`. Assert, measured:
```
heading level=1 "Weeknight Build Session"
text "QR not available yet."
text "1 of 3 checked in"
text "No student names are shown on this screen."
link "Back to meetings"
```
**`1 of 3 checked in` is data-dependent** — it holds only because
`coach-checkin.spec.ts` runs first, clears `…-0004` and re-marks Priya (and
`late` counts, `kiosk.ts:326`). **Corroborate the number with `readRows`**
rather than hard-coding it, or state the ordering dependency in a comment.
`capture()` it. This is the app degrading **honestly** when its Edge Function is
absent — record that. File the missing-stand-in finding (§6d).

### 6c. Cleanup (AC 8) — read this twice; it is the sharpest trap here

- Reuse the established pattern: `execAdmin` delete scoped to the session, in
  `beforeEach` (`coach-checkin.spec.ts:28-31`).
- **`student-parent.spec.ts:48-64` is green today and asserts ZERO
  `method='self'` rows for Priya — with NO session predicate** (`:59-61`).
  Playwright runs files in path order, so `student-checkin.spec.ts` runs
  **before** it. **No choice of session avoids this hazard** *(round 2 corrected
  my round-1 suggestion that one could)*. Defend it three ways, all required:
  1. **Defensive `beforeEach`:**
     `execAdmin("delete from attendance where student_id = '${SEED.studentPriya}' and method = 'self'")`
  2. **`try/finally`** around every self-checkoff write.
  3. **`afterAll`** as the backstop — and note it does *not* run on a hard crash
     or timeout kill, which is exactly why 1 and 2 exist.
- **Also restore `…-0008` to `status='scheduled'`** in the same `finally` /
  `afterAll`, or `student-parent.spec.ts:66` and `:74-78` lose the
  "Sign-up opportunities" fixture they read.
- **FORBIDDEN:** `delete from attendance where session_id =
  '5e550000-0000-4000-8000-000000000006'`. The gate measured that this removes
  Priya's only `v_student_hours` row (`3.9999990941666667` → 0 rows), which
  `student-parent.spec.ts:27-46` and `:121-128` read.
- Prove re-runnability by running **your new/changed files** twice.

### 6d. Findings (AC 7)

Write `docs/swarm/inbox/claude-gam-342-e2e-w1-checkin-findings.json` in the
schema in `docs/swarm/active/FINDINGS-PIPELINE.md` — **read that file for the
exact schema**. Emit it even if empty. **Four findings are already established
and must be included** (all `source: e2e-personas`, `area: w1`):

| findingKey | Severity | Substance |
| -- | -- | -- |
| `checkin/unvalidated-200-payload-white-screens-result-page` | MINOR | `CheckinResult.tsx:343` casts an unvalidated payload; `:773` then dereferences `state.attendance.check_in_at` → `TypeError`, blank `#root`, no error boundary. Harness-shaped input; `StudentHome` does not crash on the same response. `verifiedBy`: watched it happen. |
| `e2e-personas/self-checkoff-requires-fixture-arrangement` | MINOR | `SelfCheckoffDialog` is unreachable in **unmodified** seeded fixtures — Library STEM Night buckets Upcoming, where `allowSelfCheckoff={false}`. One `execAdmin` line in a spec makes it reachable. **The UI is not broken**; the seed simply has no Past outreach event with an unrecorded session. Retitled and downgraded from MAJOR in round 2, after the gate drove the real path successfully. |
| `e2e-personas/harness-missing-checkin-token-stand-in` | MINOR | `kiosk.ts:369` invokes `checkin-token`; `EDGE_FUNCTIONS` has no such key → 404, kiosk shows "QR not available yet". `tests/e2e-harness/**` is forbidden here, so a finding is the correct deliverable. |
| `e2e-personas/preview-ipv6-only-webserver-timeout` | MINOR | `vite preview` binds `[::1]` only while `playwright.personas.config.ts:29` polls `127.0.0.1` → silent 180s `webServer` timeout on a fresh checkout. |

Also record, as a fifth finding or as a stated observation, the **five
pre-existing suite failures** (§0) — including that `student-parent.spec.ts:66`
fails because an RSVP control *does* now write, contradicting that test's
premise.

### 6e. Mutation proofs (AC 2, 9) — the criterion most likely to be faked

Per `mutation-replay`. **Commit first, then mutate, then revert** (item 26's
rule — `git checkout --` on an uncommitted fix loses the fix). Record the
**real red output** and exit code for each:

1. **Wrong session id.** Repoint a read-back at a different session id → finds
   nothing → **red**. Proves the assertion reads rows, not the UI.
2. **AC 3's guard, database-side.** You may not edit `src/**`, so prove it with
   the live constraint: with one row present, attempt a second INSERT for the
   same `(session_id, student_id)` via `execAdmin` and show it raises on
   `attendance_session_id_student_id_key` *(gate-confirmed live)*. **State
   plainly that this is a database-level proof, not a code mutation** — do not
   dress it up as switching an upsert to an insert.
3. **Self-checkoff method.** Mutate your §6b.3 assertion to expect
   `method='coach'` → **red**.

## 7. Evidence you must return

- Exact commands and their **exit codes**.
- Full pass/fail lines, with your new files run **twice** (AC 8), and the
  pre-existing 5 failures identified as such.
- **Verbatim red output** of each mutation, plus proof you restored it.
- Screenshots written.
- The **commit SHA** your work landed in (item 21 — "clean" ≠ "committed").
- Anything you could not prove, named. **Do not report green with an unfiled
  finding.**

## 9. Settled ground truth — copy this, do not re-derive it

*(Round 2 replaced my open §8.1 question with a measured answer. All of this was
run against the live cluster by the gate.)*

**Column truth.** `attendance.student_id` takes a **`students.id`**
(`attendance_student_id_fkey → students(id)`; `my_student_ids()` returns
`students.id`). `attendance.recorded_by` takes a **`profiles.id`** and must
equal `auth.uid()`. So: `SEED.studentPriya` → `student_id`,
`PERSONAS.student.profileId` → `recorded_by`. Getting these backwards produces a
`42501` that reads exactly like a policy bug.

**Verified INSERT** (exit 0; row landed; readable back as the student through
`own_or_linked_read`):

```ts
execAs('student', `insert into attendance (session_id, student_id, status, method, recorded_by)
  values ('5e550000-0000-4000-8000-000000000005',
          '${SEED.studentPriya}',
          'present', 'self', '${PERSONAS.student.profileId}')`);
```

**Verified DELETE** (exit 0; satisfies `self_delete`):

```ts
execAs('student', `delete from attendance
  where session_id = '5e550000-0000-4000-8000-000000000005'
    and student_id = '${SEED.studentPriya}'
    and method = 'self'`);
```

**Measured negative controls** — all real, and all usable as mutation evidence:

| Mutation | Result |
| -- | -- |
| `student_id` = the **profile** id | `42501` RLS violation |
| `recorded_by` omitted | `42501` |
| `method='coach'` as the student | `42501` |
| session `…-0006` (Priya has a coach row) | `23505` `attendance_session_id_student_id_key` |

**Session choice for the policy proof: `5e550000-0000-4000-8000-000000000005`.**
Priya has no row there and a self row there leaves `v_student_hours` unchanged.
Do **not** use `…-0006` (23505) or `…-0004` (the coach-console fixture).

## 10. Least confident decisions (item 19d), round 3

1. **That asserting a white-screen is a legitimate test rather than pinning a
   bug.** The skill says record behaviour, do not bless it — §6b.2 follows that,
   but a future reader could mistake it for approval. The comment is doing all
   the work, and comments rot.
2. **That the fixture arrangement in §6b.3 is safe under parallel pressure.**
   The config is `workers: 1, fullyParallel: false`, so it should be — but the
   `…-0008` mutation is globally visible while it is in effect, and any spec
   reading "Sign-up opportunities" during that window would see the wrong thing.
   Serial execution is what makes this safe; if that ever changes, this breaks.
3. **That the `1 of 3 checked in` corroboration is worth the complexity.**
   Reading the tally back with `readRows` is more honest but couples the kiosk
   test to attendance state; hard-coding it is simpler and stale-prone. I chose
   corroboration; a checker could reasonably prefer the comment.

---

## 11. Gate status — read this before treating the packet as blessed

`checker-premise` ran **two rounds** (item 19a's cap) and returned **REVISE**
both times. This packet does **not** carry a DISPATCH verdict. Round 2's
remaining items were titled by the gate itself "Required Revisions (mechanical;
last round)" and each came with measured, copy-paste-ready ground truth; all six
are applied above. The orchestrator's judgment to proceed to a worker without a
third round is recorded and defended in `GAM-342-run-log.md` and in the PR body,
so it is visible and correctable rather than silent. The HEAVY tier's
independent `checker-reviewer` round on the finished work is **not** waived.
