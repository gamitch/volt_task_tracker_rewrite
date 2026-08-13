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
| `student-parent.spec.ts:66` | `expect(before).toHaveLength(0)` got `[{"status":"going"}]` — an rsvp row on `5e550000-…-0008` left by a prior run |
| (2 further failures in the same files) | same shape |

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

- **AC 4** cannot be met through the UI — the surface is unreachable in seeded
  fixtures (§4). It is met against **real RLS** instead, via `execAs`, plus a
  filed finding. The substance of AC 4 (a `method='self'` row is genuinely
  written and is not the QR path) is fully preserved.
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

### 4b. The self-checkoff UI is unreachable in seeded fixtures — this is a fact, not a task

*(gate revision 2. Do not go looking for a way in; the gate already did, in a
browser, and there is none.)*

- Library STEM Night (`e0e00000-…-0002`) buckets **Upcoming**, because its
  session `5e550000-…-0008` is `scheduled` (2026-08-23) — and Upcoming passes
  `allowSelfCheckoff={false}`.
- Its only `completed` session, `5e550000-…-0006`, **already holds a
  `method='coach'` row for Priya**, so `computeLockedSessionIds` would render it
  `isDisabled` even if the section allowed it.
- Measured: `/outreach` as student exposes only `button "Hide session details –
  Library STEM Night"` and `radiogroup "Your RSVP for Library STEM Night on Sun,
  Aug 23"`. **No `Mark attendance` button exists.** `/outreach/e0e00000-…-0002`
  renders no self-checkoff control at all.

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

**3. Self-checkoff proven against real RLS (AC 4).** The UI path does not exist
(§4b), so prove the substance directly with `execAs`, which runs as
`authenticated` with the persona's real `auth.uid()`
(`personaHarness.ts:138-150`) — i.e. against the **real `self_insert` /
`self_delete` policies**, not a superuser bypass:

- `execAs('student', …)` INSERT into `attendance` with `method='self'`,
  `status='present'`, `recorded_by = PERSONAS.student.profileId`, on a session
  the student may self-record. Read the row back and compare values.
- `execAs('student', …)` DELETE it and prove it is gone.
- Comment that this is a **policy-level** proof and that the UI route is
  unreachable, cross-referencing the filed finding. Do not describe it as UI
  coverage.

**4. Kiosk (AC 1/6; gate revision 4 — cheap and high value).** Coach →
`/kiosk/5e550000-0000-4000-8000-000000000004`. Assert, measured:
```
heading level=1 "Weeknight Build Session"
text "QR not available yet."
text "1 of 3 checked in"
text "No student names are shown on this screen."
link "Back to meetings"
```
`capture()` it. This is the app degrading **honestly** when its Edge Function is
absent — record that. File the missing-stand-in finding (§6d).

### 6c. Cleanup (AC 8) — read this twice; it is the sharpest trap here

- Reuse the established pattern: `execAdmin` delete scoped to the session, in
  `beforeEach` (`coach-checkin.spec.ts:28-31`).
- **Add an `afterAll` too**, not `beforeEach` only. `student-parent.spec.ts:48-64`
  is **green today** and asserts **zero `method='self'` rows for Priya
  globally** — and Playwright runs files in path order, so
  `student-checkin.spec.ts` runs **before** it. A failed or aborted self-checkoff
  test that leaves a row turns a passing test red. Clean up on the way out.
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
| `e2e-personas/self-checkoff-unreachable-in-seeded-fixtures` | MAJOR | No reachable path to `SelfCheckoffDialog` for any persona in seeded data (§4b, with the two gating reasons). AC 4 could only be met at the policy layer. |
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

## 8. Least confident decisions (item 19d), round 2

1. **That `execAs('student', …)` will actually satisfy `self_insert`'s `with
   check` on a session of my choosing.** The policy requires `student_id in
   (select my_student_ids()) and method='self' and recorded_by = auth.uid()`.
   `PERSONAS.student.profileId` is a **profile** id; `SEED.studentPriya` is a
   **student** id. Confusing the two would make §6b.3 fail for a reason that
   looks like a policy denial. The worker must check which column takes which.
2. **That asserting a white-screen is a legitimate test rather than pinning a
   bug.** The skill says record behaviour, do not bless it — §6b.2 follows that,
   but a future reader could mistake it for approval. The comment is doing all
   the work, and comments rot.
3. **That `afterAll` is sufficient** to protect `student-parent.spec.ts`. It is
   not run on a hard crash or a `--timeout` kill. If that worries the checker,
   the stronger form is for §6b.3 to write to a session Priya has no `self` row
   expectation on at all.
4. **That the five pre-existing failures are genuinely pre-existing** and not
   something this branch introduced. The gate reproduced them twice, but one is
   explicitly caused by prior-run residue, which means the suite is not
   currently idempotent and "pre-existing" is a slightly soft claim.
