# GAM-342 worker packet — E2E W1 check-in journey

**Issue:** GAM-342 — E2E — W1 Check in: a student arrives and gets counted
**Tier:** HEAVY (item 26). **Worker model:** default pin (`sonnet`) — none of
item 18's four triggers apply: no migration, no RLS policy or `security
definer`, no metric-view SQL, no auth/session/role logic. This packet adds
test files only.
**Branch:** `claude/gam-342-e2e-w1-checkin` (already created and pushed).

---

## 0. What the orchestrator already measured, so you do not repeat it

The environment is **up and working right now**. Do not re-derive it, and do
not run `start.sh` again — it recreates the cluster and would drop rows other
steps depend on.

| Fact | Measured |
| -- | -- |
| Scratch Postgres | `127.0.0.1:55432`, db `scratch`, seeded (5 profiles, 6 students, 3 events, 8 sessions, 10 attendance) |
| Harness API | `http://127.0.0.1:54321`, healthy |
| Preview bundle | `http://127.0.0.1:4174`, **started with `--host 127.0.0.1`** |
| Playwright | `playwright@1.62.1` installed `--no-save`; chromium headless shell present |
| Baseline | `coach-checkin.spec.ts` → **1 passed (5.4s)** |

Run the suite with exactly this (the preview server is already up, and
`reuseExistingServer: true` means Playwright will adopt it):

```bash
npx playwright test -c tests/e2e-harness/playwright.personas.config.ts
```

**If the preview server has died**, restart it detached and IPv4-bound —
`npm run preview` alone binds `[::1]` only and the config polls `127.0.0.1`,
which is a 180s silent timeout:

```bash
(setsid npm run preview -- --outDir dist-e2e --port 4174 --strictPort \
   --host 127.0.0.1 > /tmp/preview.log 2>&1 < /dev/null &)
```

---

## 1. Corrections to the issue body — verified against the tree

The issue is accurate about intent and wrong about three paths. **Use these,
not the issue's.**

1. **Loader paths.** The issue says `loaders/checkin.ts`, `loaders/kiosk.ts`,
   `loaders/attendance.ts`. The real directory is
   **`src/lib/supabase/loaders/`**. All three files exist there.
2. **`SelfCheckoffDialog` is an *outreach* surface, not a meetings one.** It
   lives at `src/pages/outreach/SelfCheckoffDialog.tsx`, is opened from
   `/outreach/:eventId` (`OutreachDetail`), and is backed by
   `src/lib/supabase/loaders/selfCheckoff.ts`. The issue's framing ("student
   self-checkoff" as part of the check-in journey) is about the *write*, which
   is genuinely `attendance` with `method='self'` — that part is correct.
3. **`selfCheckoff.ts` is INSERT + DELETE, never upsert** (its module doc §4:
   *"plain INSERT, never upsert… no update policy… delete + re-insert"*).
   `insertSelfCheckoff` writes `status:'present'`, `method:'self'`,
   `recorded_by: <acting profile id>`; `removeSelfCheckoff` deletes filtered by
   `.eq('method','self')`. **So acceptance criterion 3 (a changed mark
   overwrites rather than duplicates) belongs to the coach console upsert, not
   to self-checkoff.** Do not try to prove upsert semantics on the self path.

## 2. Route and structure facts you will need

Verified in `src/app/router.tsx:190-250`:

| Route | Guard | Component |
| -- | -- | -- |
| `/checkin` | `RequireAuth` (any role) | `CheckinResult` |
| `/kiosk/:sessionId` | `RequireAuth` + `RequireRole ['coach','admin']` | `KioskPage` |
| `/meetings/live/:sessionId` | `RequireAuth` | `LiveConsolePage` |
| `/outreach/:eventId` | `RequireAuth` | `OutreachDetail` |

**The single most important structural fact, and it is not obvious from the
issue.** In `CheckinResult.tsx` the code field and the open-sessions picker
render **inside the `error` state branch** (`src/pages/checkin/CheckinResult.tsx:809-890`),
not on a neutral landing state. Navigating to `/checkin` with no credential in
the URL therefore lands on "Couldn't check you in" **by design**, and that
error card is where the journey continues:

- no session id knowable → the **open-sessions picker** renders (`:855-880`),
  one `Button` per open session whose `label` is the *event* title;
- after `setPickedSessionId`, the **`TextInput label="Check-in code"`** plus
  `Button label="Check in with code"` render (`:832-847`).

The seeded live session `5e550000-…-0004` starts 30 minutes ago and ends in two
hours, and `OPEN_SESSION_GRACE_MS` is two hours either side
(`src/lib/supabase/loaders/checkin.ts:564`), so it **is** inside the window and
**will** appear in that picker, titled `Weeknight Build Session` (the event
title, not the session's). This is real-loader data, which is what item 27
requires the spec to prove it reads.

## 3. The Tier-2 boundary — measured, and worse than the issue says

The issue says the `checkin` Edge Function stand-in is "deliberately shallow".
**Measured, it is not shallow — redemption is entirely absent.**
`tests/e2e-harness/server.mjs:475-492` is the whole stand-in: it validates
`identity.sub` and a `sessionId`, then **mints a rotating QR token and returns
it**. That is the *coach/kiosk* side of the contract. There is **no branch that
accepts a short code or a token and writes an `attendance` row.**

Consequence, and it is binding on what you may claim:

- Submitting a code on `/checkin` **cannot** produce an `attendance` row in
  this harness. Do not write an assertion that waits for one — it will hang for
  the full timeout and then fail for the wrong reason.
- You may drive the form for real (type, submit) and assert **the app's
  handling of the documented contract** — that it posts, and renders the error
  path when redemption does not come back with attendance.
- **Acceptance criterion 5 is a file-level obligation**: the spec file itself
  carries a comment naming `supabase/functions/checkin/` and stating that HMAC
  validation, rate limiting, session liveness and team scope are **not proven
  here**, because Deno does not run in this harness. A green suite must not
  read as QR coverage.

## 4. Allowed Files

Create or edit **only** these:

- `tests/e2e-personas/coach-checkin.spec.ts` *(extend)*
- `tests/e2e-personas/student-checkin.spec.ts` *(new)*
- `tests/e2e-personas/screenshots/*.png` *(generated by `capture()`)*
- `docs/swarm/inbox/claude-gam-342-e2e-w1-checkin-findings.json` *(new)*

**Forbidden.** Everything under `src/**`, `supabase/**`, `tests/e2e-harness/**`,
`package.json`, `package-lock.json`, `.github/workflows/**`, `docs/swarm/**`
other than the one inbox file above. **No production code changes are in scope.
If a test cannot pass without one, that is a finding — emit it, do not fix it.**

## 5. What to build

### 5a. `coach-checkin.spec.ts` — extend, do not rewrite

Keep the existing test exactly as it is; it is the proven baseline. Add:

1. **A changed mark overwrites rather than duplicates (AC 3).** Sign in as
   coach, go to `/meetings/live/${SEED.liveSession}`, mark Priya **Present**,
   wait for the row, then mark her **Late**. Assert **exactly one** row for
   `(session_id, student_id)` and that its `status` is `late`. One row is the
   assertion that matters — `attendance` has `unique (session_id, student_id)`,
   so a second insert would raise rather than duplicate; assert the **count and
   the updated value together** so the test fails if the mark silently did not
   take.
2. **Screenshot** the console after the change.

Locators, from the skill's trap list and the existing test — do not improvise:
`page.getByRole('radiogroup', { name: 'Attendance for Priya Raman' })` then
`.getByRole('radio', { name: 'Present' | 'Late' })`. An unscoped "Present"
matches one control per student.

### 5b. `student-checkin.spec.ts` — new

Three describes, in this order:

1. **`/checkin` open-sessions picker and code form (Tier 2 boundary).**
   Sign in as `student`. `goto('/checkin')`. Assert the error card appears
   (this is the designed landing, and say so in a comment). Assert the picker
   offers **`Weeknight Build Session`** — read from the real loader, so also
   assert it against the database: the session the button represents is the one
   `readRows` finds open. Click it, then **type a 6-character code into
   `Check-in code`** and submit. Assert what the app does with the response.
   **Do not assert an attendance row appears.** Screenshot the picker and the
   form. Carry the §3 boundary comment at the top of this describe.
2. **Student self-checkoff writes `method='self'` for real (AC 4).**
   Sign in as `student`, go to `/outreach/e0e00000-0000-4000-8000-000000000002`
   (Library STEM Night), open the self-checkoff dialog, and check off an
   eligible day. Prove it by reading the row back: exactly one `attendance` row
   for that `(session_id, student_id)` with `method='self'`, `status='present'`,
   `recorded_by` = `PERSONAS.student.profileId`. Then **remove** it and prove
   the row is gone. Screenshot the dialog with the day checked.
   **Explore the dialog's real accessible names before writing selectors** —
   read `SelfCheckoffDialog.tsx` first. If the student persona cannot reach this
   surface at all in seeded data, that is a **finding**, not a workaround:
   record it and move on.
3. **A comment block stating what was not proven (AC 5).**

### 5c. Cleanup (AC 8)

`beforeEach` deletes only rows the run creates:
`delete from attendance where session_id = '<the session this file writes to>'`
— scoped per describe. **Never** delete seeded rows the other specs assert on.
The suite must be re-runnable with no reseed; prove it by running it twice.

### 5d. Findings (AC 7)

Write `docs/swarm/inbox/claude-gam-342-e2e-w1-checkin-findings.json` in the
schema in `docs/swarm/active/FINDINGS-PIPELINE.md` — **read that file for the
exact schema**. Emit it **even if you find nothing** (empty `findings` array);
a missing file is indistinguishable from never having looked. One finding is
already known and **you must include it**:

- **`vite preview` binds IPv6-only, so the persona suite's `webServer` times
  out.** `severity: MINOR`, `area: w1`, `source: e2e-personas`,
  `findingKey: e2e-personas/preview-ipv6-only-webserver-timeout`. Evidence:
  `ss -lntp` shows `LISTEN [::1]:4174` while
  `tests/e2e-harness/playwright.personas.config.ts:29` polls
  `http://127.0.0.1:4174`; the run dies on `Timed out waiting 180000ms from
  config.webServer` with the server up and answering on `localhost`.
  `verifiedBy`: watched it happen. Consequence: a fresh checkout cannot run this
  suite without knowing the flag; costs a session to diagnose.

### 5e. Mutation proofs (AC 2, 9) — this is the criterion most likely to be faked

Per the `mutation-replay` skill. **Commit your work first, then mutate, then
revert** (item 26's fast-tier working rule — `git checkout --` on an
uncommitted fix loses the fix). For each, record the **real red output** and the
exit code:

1. **Wrong session id.** Point a write assertion at a different session id →
   the read-back finds nothing → **red**. Proves the assertion reads rows rather
   than trusting the UI.
2. **Upsert → insert.** You may not edit `src/**`. Prove AC 3's guard the
   database way instead: with one row present, attempt a second INSERT for the
   same `(session_id, student_id)` via `execAdmin` and show it raises on the
   unique constraint — then show your spec's single-row assertion is what would
   catch a duplicate if one ever appeared. **State plainly in the run output
   which of the two you did**, and do not describe a database-level proof as if
   it were a code mutation.
3. **Self-checkoff method.** Mutate your own assertion to expect
   `method='coach'` → **red**.

## 6. Evidence you must return

- The exact command(s) run and their **exit codes**.
- Full pass/fail line for the persona suite, run **twice** (AC 8).
- The **red output** of each mutation, verbatim, plus proof you restored it.
- List of screenshots written.
- The commit SHA your work landed in (item 21 — "clean" is not "committed").
- Anything you could not prove, named. **Do not report green with an unfiled
  finding** — the skill's "Before reporting green" section is binding.

## 7. Least confident decisions (item 19d)

1. **That the self-checkoff dialog is reachable by the `student` persona at
   `/outreach/e0e00000-…-0002` in seeded data.** I verified the loader, the
   route and the event row, but I did **not** open the dialog in a browser. It
   would be wrong if `OutreachDetail` gates the dialog on RSVP state, on the
   session being past, or on a coach-only control. If so, §5b.2 is
   unbuildable as written and the honest outcome is a finding plus a narrowed
   spec — not an invented path.
2. **That `/checkin`'s error-state landing is intended rather than a defect.**
   I read the code and it is clearly deliberate (T400's comment explains the
   picker exists precisely for this case), but a student landing on "Couldn't
   check you in" as the *normal* entry is a UX claim I am not certain of. If the
   gate finds evidence it is a defect, it is a finding, and the spec should
   record behaviour without blessing it (skill: "Record behaviour; do not bless
   it").
3. **That asserting "the app posts to the Edge Function and handles the
   response" is worth writing at all**, given §3 proves the stand-in cannot
   redeem. It may be that the honest deliverable for `/checkin` is *only* the
   picker plus the boundary statement, and that driving the submit tests the
   stand-in rather than the app. I lean toward driving it because AC 1 demands
   the form be typed into and submitted, but I would change this on argument.
4. **That the kiosk is worth including at all.** The issue lists
   `pages/meetings/Kiosk.tsx` in scope and claims it "currently reports 'QR not
   available yet'". **I did not verify that claim**, and I deliberately left the
   kiosk out of §5 — the stand-in *does* mint a token, so the kiosk may well
   render a real QR, which would make the issue's claim stale. If the gate finds
   the kiosk is cheaply drivable, adding a screenshot-and-assert describe is a
   correct expansion. I would rather be told to add it than have a worker invent
   kiosk coverage.
5. **That `unique (session_id, student_id)` on `attendance` is live in the
   applied migrations.** I read it in `selfCheckoff.ts`'s module doc, which is a
   *comment*, and item 19c is explicit that a comment is not proof. §5e.2 leans
   on it. Verify against the running cluster.
