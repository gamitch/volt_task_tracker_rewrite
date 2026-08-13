# GAM-343 worker packet — E2E W2 outreach lifecycle (round 2, post-gate)

**Issue:** GAM-343 — E2E — W2 Run an outreach event: create → RSVP → attend →
complete → hours land
**Tier:** HEAVY (item 26). Defended in the run log and the PR: the deliverable
is test-only, which argues STANDARD, but the artifact's whole value is an
assertion about a **write path** and an **RLS policy** on the path
`WORKFLOWS.md` calls the most defect-dense in the project, whose three worst
bugs (T193, T309, T327) were all invisible from the screen. A vacuous spec here
is a false green certifying that volunteer hours are right when they are not.
Item 26's tiebreak: when two tiers are arguable, take the heavier one.
**Worker model:** default pin (`sonnet`). None of item 18's four triggers apply
— no migration, no RLS policy or `security definer`, no metric-view SQL, no
auth/session/role logic. Test files only.
**Branch:** `claude/gam-343-e2e-w2-outreach-lifecycle` (already checked out).

> **Round 1 of the premise gate returned REVISE (6 BLOCKER, 5 MAJOR, 6 MINOR)
> and this is the revision.** Everything marked *(gate-measured)* was verified
> by `checker-premise` in a real browser or against the live cluster, running 8
> probe specs in its own worktree — not read from source. **Where this packet
> and the Linear issue body disagree, this packet is right and the issue is
> stale.** Where this packet and round 1 disagree, round 1 was wrong; do not
> restore it.

---

## 0. Environment

**The environment is already up. Do NOT run `start.sh`** — it recreates the
cluster and would destroy state *(gate MINOR 17)*. Only run it if you have
verified the services are down.

| Service | Where |
| -- | -- |
| Postgres | `psql -h 127.0.0.1 -p 55432 -U postgres -d scratch` |
| Harness API | http://127.0.0.1:54321 |
| Preview bundle | http://127.0.0.1:4174 (already built and **IPv4-bound**) |
| Runner | `playwright@1.62.1`, installed `--no-save`; chromium present |

```bash
npx playwright test -c tests/e2e-harness/playwright.personas.config.ts
```

If the preview has died, restart it **IPv4-bound** — `npm run preview` alone
binds `[::1]` while the config polls `127.0.0.1`, costing a silent 180s timeout:

```bash
(setsid npm run preview -- --outDir dist-e2e --port 4174 --strictPort \
   --host 127.0.0.1 > /tmp/preview.log 2>&1 < /dev/null &)
```

**Measured baseline, this run: `27 passed, 5 failed` (3.4m).** All five are
pre-existing, live in files you may not edit, and are **not yours**:
`coach-meeting.spec.ts:88` and `:115` (the archived team is no longer offered —
stale against shipped work), and `student-parent.spec.ts:27`, `:66`, `:121`.

Note `student-parent.spec.ts:66` is titled *"an RSVP made on the student home
never reaches the database"* and **that premise is false** — GAM-342's gate
deleted the suspected residue row, re-ran it alone, and a *fresh* `rsvps` row
still appeared. The control writes. Do not treat it as evidence about the RSVP
path, and do not fix it.

Run `bash tests/e2e-harness/stop.sh` only if you are the last consumer; the
orchestrator will otherwise handle teardown.

---

## 1. Acceptance criteria

Verbatim from GAM-343, renumbered for reference. §2 and §4 change *how* several
are satisfied — never *whether*.

1. **Every step is driven, not inspected** — text typed, selectors opened and
   chosen from, checkboxes toggled, forms saved, and at least one saved record
   edited afterwards.
2. **Every write is proven by reading the row back and comparing values.**
   *Mutation: drop the RSVP upsert → red.*
3. **A student's own RSVP is written as that student**, with `responded_by`
   matching their auth id. *Mutation: write it with the coach's id → red, via
   an RLS denial.*
4. **Changing an answer updates rather than accumulates.** Going then Can't go
   leaves one row with the later status. *Mutation: switch the upsert to an
   insert → red.*
5. **Unchecking a student in Mark day complete changes the database.**
   *Mutation: make the uncheck a no-op → red.*
6. **Hours after completion match what the recorded attendance implies**, read
   from the database rather than from the page.
7. **Screenshots exist for the evidence-bearing moments** and are committed.
8. **Findings are emitted as JSON and filed.** A run that finds nothing records
   that explicitly.
9. **The suite is re-runnable without a reseed.** Cleanup in `beforeEach`,
   touching only rows the run created.
10. **Each new spec is proven non-vacuous by at least one mutation**, per the
    `mutation-replay` skill, with the red output recorded.

---

## 2. Corrections to the issue body — measured, with citations

### 2a. ❌ The "never a deletion candidate" constraint is stale (T118, reversed by T119)

The issue says `loaders/outreach.ts` *"treats a student's own `responded_by` as
never a deletion candidate during completion fan-out."* Two errors:

- **The protection is gone.** `src/lib/supabase/loaders/outreach.ts:1398-1441`
  documents T119 / PRD v2 D-7, George's 2026-07-20 override: *"`selfAuthoredKeys`
  (T118's protection mechanism) is gone -- there is no longer any row this
  fan-out skips."* *(gate-confirmed)*
- **It is not "completion" fan-out.** It is the expected-attendee reconciliation
  inside `makeSaveOutreachEvent`. `markDayComplete` (`:1355-1377`) touches only
  `attendance`, `event_sessions.status` and `events` totals — never `rsvps`.
  *(gate-confirmed)*

**The current rule — "the checklist wins"** (`outreach.ts:1403-1420`): a
**checked** student gets `status: 'going'` upserted for every final session id
regardless of the prior row's author or status, with `responded_by` becoming the
**acting coach's** id; an **unchecked** student has their `'going'` rows deleted
regardless of author; a `'declined'`/`'maybe'` row is untouched by an uncheck.

🔴 **This fan-out is a trap for AC 3 and §4 sequences around it — see §4 step 1.**

### 2b. ✅ The RLS constraint is real, with the nuance that decides AC 3

`supabase/migrations/20260717000002_rls.sql:205-211` — both write policies carry
`responded_by = auth.uid()`. But `staff_all` (`:197-199`) is `for all` with
`using (is_staff()) with check (is_staff())`, and PostgreSQL OR's permissive
policies, so **a coach may write any `responded_by`**.

*(gate-measured, live cluster, through `execAs`'s exact statement shape)*:

- student inserting `responded_by = <coach>` →
  `ERROR: 42501: new row violates row-level security policy for table "rsvps"`
- coach inserting `responded_by = <student>` → **succeeds silently**

AC 3's mutation is therefore only red when the actor is the **student**.

Skill trap, with a round-2 correction: a blocked INSERT raises `42501`. For an
UPDATE it depends which arm blocks — a `USING`-filtered update is silent
(`UPDATE 0`), but an update *setting* a foreign `responded_by` raises `42501`
from the `WITH CHECK` arm (gate-measured). Re-reading the row is safe either
way; do not rely on an exception alone.

### 2c. ✅ AC 5 / T309 is real and sharper than stated

`src/pages/outreach/MarkDayCompleteDialog.tsx:815-840`: the uncheck writes
`status: 'absent'` — it does **not** delete. `'absent'` was chosen over DELETE
because a DELETE would need a second non-atomic write step in `markDayComplete`.

**The precision that matters** *(gate-confirmed at the `isAttendingStatus(existing?.status)`
guard)*: the dialog only emits an `'absent'` row for a student who **already has
a recorded attending row**. Unchecking a never-recorded student is a
**legitimate no-op**, not a bug. §4 step 4 therefore records the row first,
through a different surface.

### 2d. ❌ `RsvpControl` has no "Going" label

`src/pages/outreach/RsvpControl.tsx:301-308` — `Sign up` / `Maybe` / `Can't go`;
`RsvpControl.test.tsx:100` asserts exactly this against "Going". *(gate-measured
live: `RADIOS [ 'Sign up', 'Maybe', "Can't go" ]`.)* "Going" exists only in
`OutreachList.tsx:3534-3538`'s inline copy for the `/outreach` list.

Route the student through `/outreach/:eventId` — the only mount of `RsvpControl`
(`OutreachDetail.tsx:812`, rendered `:2406-2419`) — and click **`Sign up`** then
**`Can't go`**. The written `status` values are still `going` then `declined`.
Apostrophe is ASCII `U+0027`.

### 2e. 🔴 The keystone: one session dated today — sound, under two conditions

| Control | Predicate | Citation |
| -- | -- | -- |
| `RsvpControl` editable | `now < starts_at` **and** status `scheduled` | `RsvpControl.tsx:318-329`, `:518` |
| `Mark day complete` visible | staff **and** `formatChicagoDateOnly(now) >= session.sessionDate` **and** status `scheduled` | `OutreachDetail.tsx:1493-1497` |

*(gate-measured — both true simultaneously on one session)*:

```
SESSIONS [{"session_date":"2026-08-12","starts_at":"2026-08-13 04:59:00+00","status":"scheduled"}]
NOW { n: '2026-08-13 04:02:50+00', chi: '2026-08-12 23:02:50' }
SIGNUP aria-disabled null          <- editable
TRIG aria= "Mark day complete — Wed, Aug 12"
```

**Two conditions round 1 omitted, both BLOCKER-grade:**

1. **Derive the date in Chicago, never from `toISOString()`.** The container
   clock is UTC and the two diverge *right now* — gate-measured
   `CHICAGO_TODAY 2026-08-12` vs `UTC_TODAY 2026-08-13`. The UTC value makes
   `formatChicagoDateOnly(now) >= session_date` false and **the completion
   trigger never renders**. Use:
   ```ts
   new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Chicago' }).format(new Date())
   ```
   `session_date` itself is stored verbatim from the picked calendar date
   (`OutreachEventDialog.tsx:884`), so the risk lives entirely in *your* date
   arithmetic.
2. **Set the start time explicitly and late.** `DEFAULT_START_TIME` is `09:00`
   Chicago (`OutreachEventDialog.tsx:641`), so with the defaults `now <
   starts_at` is **false for any run after 9am Chicago** and `RsvpControl` is
   locked. Set start `11:59 PM` (and end at or after it).

**Disclosed residual — a real dead window.** No single session can satisfy both
predicates in the final minutes of the Chicago day, and a run that crosses the
chosen `starts_at` mid-execution locks the RSVP control between steps 2 and 3.
**Order the spec so both RSVP writes complete before the completion step**, and
if the window is missed, report it as an environment condition rather than a
product defect.

---

## 3. Measured terrain — selectors

Every claim below was **gate-measured in the live browser** unless marked
otherwise. Round 1 got four of these wrong; the corrections are flagged.

### Routes
`/outreach` → `OutreachList`, `/outreach/:eventId` → `OutreachDetail`
(`src/app/router.tsx:169-170, 241, 249`). Both auth-only, **no `RequireRole`**.

### Coach creates the event — `OutreachEventDialog.tsx`

| Control | Locator | Citation |
| -- | -- | -- |
| Open dialog | `getByRole('button', { name: 'New outreach event' })` (see hazard 1) | `OutreachList.tsx:3419` |
| Scope | `page.getByRole('dialog').filter({ hasText: 'Basics' }).first()` | `:1294`, `:1314` |
| Title | `dialog.getByLabel(/^Title/)` — regex; `isRequired` decorates the label | `:1317` |
| Schedule mode | `getByRole('radiogroup', { name: 'Schedule mode' })` → `radio` | `:1386-1392` |
| Date (single) | `getByRole('combobox', { name: /^Date/ })` — **CLICK it, then fill `MM/DD/YYYY`, Enter, Escape** (caveat 1) | `:1397` |
| **Start time** | `dialog.getByLabel(/^Start time/)` — label is `Start time ({friendly date})`; also `input[placeholder="Select a time"]` nth(0) | `:1492-1503` |
| **End time** | `dialog.getByLabel(/^End time/)` — or nth(1) | `:1492-1503` |
| Team scope | `getByRole('combobox', { name: 'Team scope' })`; options `role=option` | `:1558-1567` |
| Expected attendees | one `CheckboxList` **per team**, labelled with the team name; each item named by the **student display name** | `:1596-1611` |
| Submit | `dialog.locator('button', { hasText: /^Create event — \d+ session/ })` | `:951-954`, `:1639-1645` |

Time defaults *(gate-measured)*: `9:00 AM` / `12:00 PM`. `fill('11:59 PM')` works.

Submit label *(gate-measured)*: `"Create event — 1 session"`, EM DASH U+2014, and
its `aria-label` is `null` — `hasText` is the correct matcher, not a name match.
Read the label, then assert the database agrees with the count it promised.

🔴 **`Team scope` has THREE options, not four** *(gate-measured:
`OPTIONS [ 'Select all', 'Volt Robotics 9911', 'Volt Junior 4402' ]`)*. Archived
teams are filtered out of `teamOptions` (`:1052-1055`, GAM-305) — **unlike** the
meetings dialog. A worker copying `coach-meeting.spec.ts:92-111` will wait
forever on `Volt Legacy 2201`. All three start `aria-selected="true"`; narrowing
means **deselecting** `Volt Junior 4402`.

🔴 **Round 1's Escape guidance was BACKWARDS — you MUST press Escape**
*(gate MAJOR 7)*. The calendar popover is **its own `role=dialog`**, and Escape
closes only that layer:

```
after Enter:  dialogs 2
after Escape: dialogs 1, dateValue "August 12, 2026"   <- form intact
```

**Without** the Escape, the team-option click is intercepted:
`<div class="astryx-layout-footer …"> subtree intercepts pointer events`, and
`force: true` silently lands on the footer, leaving the scope unnarrowed.
Prescribed order: **fill date → Enter → Escape → open `Team scope` → plain
click.** (`Close calendar` resolves to **2** buttons and its footer button is
itself covered — Escape is the only working route.)

*Round 1 imported this trap from the `e2e-personas` skill's list, which
describes the meetings dialog. It does not transfer.*

🔴 **CAVEAT 1 (binding, round 2) — CLICK the date combobox BEFORE filling.**
The calendar popover opens on **pointer**, not on `fill()`. Both branches
gate-measured:

```
click → fill → Enter → Escape:   dialogs 2 → 2 → 1, form intact, dateValue "August 12, 2026"
        fill → Enter → Escape:   dialogs 1 → 1 → 0,  FORM DIALOG DESTROYED
```

The second is what round 2's §4 step 1 literally prescribed, and it cost the
gate a 7-minute test timeout on its first probe. Without the opening click there
is no calendar layer, so the Escape falls through and closes the **form**.

### Student answers — `RsvpControl.tsx` on `/outreach/:eventId`

- Group: `getByRole('radiogroup', { name: 'Your RSVP for {title} on {date}' })`
  (`:508`, `:517`). Date is `en-US` `{ weekday:'short', month:'short',
  day:'numeric' }` in `America/Chicago` (`:356-361`). *(gate-measured:
  `"Your RSVP for E2E GATE Lifecycle on Wed, Aug 12"`.)*
- Options: `role=radio` named `Sign up` / `Maybe` / `Can't go`; assert
  `aria-checked`.
- **Locks** when `now >= starts_at` or status ≠ `scheduled` — §2e.

### Coach completes the day — `MarkDayCompleteDialog.tsx`

| Control | Locator | Citation |
| -- | -- | -- |
| Trigger | `getByRole('button', { name: /^Mark day complete — / })` | `OutreachDetail.tsx:2337-2345` |
| Scope | `page.getByRole('dialog')` — **mandatory**, hazard 2 | `:1140-1175` |
| Per-student | `dialog.getByRole('checkbox', { name: student.name })` | `:1151-1160` |
| People reached | `dialog.getByLabel(/^People reached/)` | `:1162-1170` |
| Confirm | `dialog.locator('button', { hasText: /^Mark complete — / })` | `:758-760` |

⚠ **Round 1 claimed a bare `getByRole('button', { name: 'Mark day complete' })`
would not match. That is FALSE** *(gate: `BARE COUNT 1`, `BARE EXACT 0`)* —
Playwright's default name match is a case-insensitive **substring**, so the bare
name matches and only `exact: true` fails. The accessible name really is
`Mark day complete — Wed, Aug 12` (Astryx `label` beats `children`), so **keep
the regex** — but for the real reason: **multi-session disambiguation**, not
non-matching.

Confirm label *(gate-measured)*: `"Mark complete — 2 attended · 0 h"` — EM DASH
U+2014 **and** MIDDLE DOT U+00B7. It recomputes on every toggle.

**Ineligible branch:** if `status !== 'scheduled'` the dialog renders no
checklist, no inputs, no confirm — only `Close` and a banner
`This session can't be marked complete from here` (`:1142`, `:1246`). Landing
here means the session is already `completed` — see §4 step 5.

### Coach records attendance on the page — `AttendancePanel.tsx`

New in round 2; this is how AC 5 becomes reachable.

- Mounted staff-only at `OutreachDetail.tsx:2429-2435`.
- Per student: `CheckboxInput label={student.name}` (`AttendancePanel.tsx:609-616`),
  plus a `NumberInput` `${student.name} hours` once checked (`:621`).
- Toggling **writes `attendance` directly** via `onUpsertAttendance`
  (`:641`, `:712`, `:785`) and **does not flip `event_sessions.status`** —
  verified independently of the gate. Unchecking here calls `onRemoveAttendance`
  (`:725`), a DELETE — which is *not* the dialog's `'absent'` behaviour; do not
  conflate them.

### `CheckboxListItem` — settled

It exposes **both** roles by construction: `CheckboxListItem` composes
`ListItem`→`Item`, which renders an invisible `<button>` carrying the label
(`node_modules/@astryxdesign/core/src/Item/Item.tsx:438-447`) **and** a real
`<input type="checkbox">` with the same accessible name
(`CheckboxInput.tsx:487-495`). Neither disagreeing spec was wrong. `.check()` on
the `checkbox` role works *(gate-measured: `DLG CB Priya 1 … PAGE BTN Priya 1`)*.

### Strict-mode hazards

1. **`New outreach event` renders twice on an empty `/outreach`** — header
   (`OutreachList.tsx:3419`, unconditional) and `EmptyState` action (`:3451`).
   With the seed present it is 1 *(gate-measured)*, but your spec creates and
   deletes events — wait for real data before clicking.
2. 🔴 **Student names collide page-vs-dialog** *(gate: `DLG CB Priya 1`,
   `PAGE CB Priya 2`)* — `AttendancePanel` and `MarkDayCompleteDialog` both
   render controls named for the same students, and the hours fields collide
   byte-for-byte. **Scope every dialog interaction to `getByRole('dialog')`.**
3. While the calendar is open `page.getByRole('dialog')` resolves to **2**, and
   `Close calendar` resolves to **2** buttons.
4. Multi-session events multiply per-session controls; names differ only by date.
5. `Retry` appears six times across the two pages — never target a bare one.
6. `Cancel` / `Close` appear in both dialogs — scope.

🔴 **Do NOT use `role=status` as a loading gate** *(gate BLOCKER 5)*. It never
reaches 0 — measured **4** on the detail page and **8** on the list. Those are
permanent empty live regions (`<span role="status" aria-live="polite">`),
distinct from the real announcers at `OutreachDetail.tsx:2105-2107`. Use a
content wait (`await expect(page.getByText(title).first()).toBeVisible()`) or
`await expect(page.locator('[aria-busy="true"]')).toHaveCount(0)`.

### Switching personas — required, and not in the harness

*(gate MAJOR 8)* No existing persona spec switches persona inside a test.
`page.goto('/login')` while authenticated redirects to `/` with
`EMAIL INPUT COUNT 0`, and `signIn` then hangs to the 90s timeout. Before each
**subsequent** `signIn`, inline this **in the spec file**:

```ts
await context.clearCookies();
await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
```

*(gate-measured working: `AFTER CLEAR: URL .../login EMAIL COUNT 1`.)*
`personaHarness.ts` stays **out** of Allowed Files — do not "fix" it there.

---

## 4. The journey to drive

One spec file, `tests/e2e-personas/outreach-lifecycle.spec.ts`. Split only if it
becomes unreadable; say so if you do.

Use a distinctive title prefix (e.g. `GAM343 Lifecycle`) — cleanup keys on it.

1. **Coach creates the outreach event.** Sign in as `coach`. `/outreach` → open
   the dialog → type the title → set the date to **Chicago-today** and **start
   time `11:59 PM`** (§2e) → **click the date combobox, then** fill, Enter,
   **Escape** (caveat 1 — the other order destroys the form) → open `Team scope`
   and **deselect `Volt Junior 4402`** → in Expected attendees check
   **Jordan only** → read the submit label's session count → save.

   🔴 **Leave Priya UNCHECKED, and this is the whole reason** *(gate BLOCKER 2)*:
   `computeExpectedAttendeeRsvpPlan`'s fan-out upserts a `going` row for every
   checked student **at save time, authored by the coach**. Gate-measured
   immediately after create, before the student acted:
   ```
   RSVP ROWS [{"student_id":"…0001","status":"going","responded_by":"a0000000-…-002"}]
   SIGNUP … checked true
   ```
   If Priya is checked, her control is already selected, her click is a no-op,
   the row stays coach-authored, and **AC 3 and AC 2 both become unfalsifiable.**

   **Read back:** the `events` row with your title and chosen `team_ids`;
   `event_sessions` rows matching the promised count; and — a free bonus
   assertion — **Jordan's** `rsvps` row `going` with `responded_by` = the
   **coach**, which proves the fan-out documented in §2a.

2. **Student answers.** Clear cookies/storage (§3), sign in as `student`.
   `/outreach/{eventId}` → `Sign up`. **Read back:** exactly one `rsvps` row for
   Priya, `status='going'`, `responded_by = PERSONAS.student.profileId`.

3. **Student changes the answer.** `Can't go`. **Read back:** still exactly one
   row, `status='declined'`, `updated_at` later than step 2's.

4. **Coach records attendance on the page.** Clear, sign in as `coach`,
   `/outreach/{eventId}`. In **`AttendancePanel`** (not the dialog) check
   **Priya and Jordan**. This writes `attendance` while the session stays
   `scheduled`. **Read back:** two rows, `status='present'`.

   This exists so step 5's uncheck has a recorded row to change — §2c.

5. **Coach completes the day, unchecking Jordan — ONE dialog pass.** Open
   `Mark day complete — {date}`.

   🔴 **CAVEAT 3 (binding) — wait for the settled arrival state before touching
   anything.** The dialog seeds its checklist from recorded **attendance**
   (`MarkDayCompleteDialog.tsx:699-731`), but only once its own
   `loadAttendance` resolves. Before that there is an observable transient seeded
   from **RSVPs** — gate-measured `DLG IMMEDIATE Priya false Jordan true` (Priya
   `declined`, Jordan coach-authored `going`) settling to `DLG ARRIVAL Priya
   true Jordan true`. And `handleCheckedStudentIdsChange` **latches**
   `hasCoachTouchedChecklistRef` (`:1072-1075`), so an edit made during that
   window freezes the checklist at the RSVP seed forever — Priya would be
   written `absent` and **AC 5 and AC 6 would both silently invert**.

   So use an auto-retrying assertion on **both** students, never a one-shot
   `isChecked()`:
   ```ts
   await expect(dlg.getByRole('checkbox', { name: 'Priya Raman' })).toBeChecked();
   await expect(dlg.getByRole('checkbox', { name: 'Jordan Okafor' })).toBeChecked();
   ```

   Then: **uncheck Jordan** → **set Priya's hours** (caveat 2) → type a
   people-reached number → read the confirm label's hours → confirm.

   🔴 **CAVEAT 2 (binding) — set an explicit per-student hours override, or AC 6
   is vacuous.** §2e's `11:59 PM` start makes the session **zero-duration**, so
   `computeSessionDurationHours` is 0 and `AttendancePanel` writes
   `hours_override: null`. Gate-measured on the un-overridden run: `CONFIRM
   LABEL "… · 0 h"`, `DELTA PRIYA 0`, `DELTA JORDAN 0` — **AC 6 passes with the
   entire attendance write path deleted.** That is round 1's MAJOR 11 re-entering
   through the fix for BLOCKER 4. Remedy, gate-measured working:
   ```ts
   await dlg.getByLabel(/^Priya Raman hours/).fill('2.5');   // then blur
   // → hours_override 2.5, label "Mark complete — 1 attended · 2.5 h",
   //   DELTA PRIYA 2.4999999999999996, DELTA JORDAN 0
   ```
   Scope it to the dialog — the field name collides with `AttendancePanel`'s.
   Give **Jordan** a non-zero hours value in step 4 too, so `delta(Jordan) == 0`
   detects the `absent` write instead of being an arithmetic tautology.

   🔴 **There is no second pass** *(gate BLOCKER 1)*. Round 1 prescribed
   completing first and re-opening to uncheck; measured, the trigger is **gone**
   once the session is `completed` (`MARK DAY TRIGGER COUNT 0`), because
   `isSessionMarkDayCompleteEligible` requires `scheduled`. The uncheck must
   happen in the same pass that completes.

   **Read back:** Jordan `status='absent'` (AC 5, T309's exact defect); Priya
   `status='present'`, `method='coach'`, `recorded_by` = coach;
   `event_sessions.status='completed'` and `people_reached` = what you typed.

   AC 1's "at least one saved record edited afterwards" is satisfied here:
   Jordan's row was saved in step 4 and edited in step 5.

6. **Hours land — before/after delta, no formula re-derivation.** Constitution
   item 3 makes duplicating a metric formula in TypeScript a **BLOCKER** (PRD
   DATA-01), so read `v_student_hours`
   (`supabase/migrations/20260717000003_metric_views.sql:3`) — never compute
   expected hours yourself.

   🔴 **"Priya > 0" is VACUOUS** *(gate MAJOR 11)*: she carries **4.0 seed
   hours** before your spec writes anything (`HOURS [{…"confirmed_hours":3.99999…}]`),
   so it passes with the entire write path deleted. Assert instead:
   - read `v_student_hours` **before** step 5 and **after**;
   - `delta(Priya)` equals the hours the confirm label promised (`· {h} h`) —
     the app's own UI as an independent witness, nothing duplicated. **Use a
     tolerance: `toBeCloseTo(2.5, 6)`.** Exact equality is red for a correct
     app — gate-measured `2.5` (label) vs `2.4999999999999996` (view), and
     `formatHours` (`:751-754`) additionally rounds to 1 dp;
   - `delta(Jordan) == 0` — he is `absent` and contributes nothing
     (`MarkDayCompleteDialog.tsx:481`);
   - while the session is still `scheduled` its contribution is **0** (the view
     inner-joins `es.status = 'completed'`), which makes the delta attributable.

   The `MarkDayCompleteDialog.tsx:463-467` disclaimer (label vs view can
   disagree) **does not apply here**: it fires only when preserved check-in/out
   timestamps trigger the view's tier-2 rule, and neither write path in this
   journey sets them *(gate-measured `check_in_at: null, check_out_at: null`;
   `AttendancePanel` never writes them either)*.

**Assert post-write row state, never the request.** Use `expect.poll(() =>
rows(...).length, { timeout: 20_000 })` before reading values —
`coach-checkin.spec.ts:54` is the idiom.

### Cleanup (AC 9) — ordered, three statements

🔴 **Round 1's "cascade from the `events` row" FAILS** *(gate BLOCKER 3)*:

```
ERROR: 23503: update or delete on table "event_sessions" violates foreign key
constraint "rsvps_session_id_fkey" on table "rsvps"
```

`rsvps_session_id_fkey` and `attendance_session_id_fkey` are both
`ON DELETE RESTRICT`; only `event_sessions.event_id` cascades. `execAdmin` runs
with `ON_ERROR_STOP=1`, so `beforeEach` throws and the whole file dies on run 2.
Delete in this order, scoped by your title prefix:

```sql
delete from attendance where session_id in (
  select id from event_sessions where event_id in (
    select id from events where title like 'GAM343 Lifecycle%'));
delete from rsvps where session_id in (
  select id from event_sessions where event_id in (
    select id from events where title like 'GAM343 Lifecycle%'));
delete from events where title like 'GAM343 Lifecycle%';
```

**Fixtures stay.** Never touch the seed's `Library STEM Night`
(`e0e00000-…-002`) or its sessions — other specs read them.

---

## 5. Mutations required — AC 2, 3, 4, 5, 10

Per `mutation-replay`, and item 26's rule that applies at every tier: **commit
before mutating, mutate, capture the real red output and exit code, revert,
re-run green.** Mutations run in **your own worktree** (item 23) — never the
shared tree, which other agents are using.

| # | Mutation | Expected red |
| -- | -- | -- |
| AC 2 | Drop the `rsvps` upsert in `makeSubmitRsvpChange` (`outreach.ts:1226-1239`) | step 2's row-count assertion |
| AC 3 | Send the **coach's** id as `respondedBy` while acting as the student | `42501` from the RLS insert policy — only red as the student (§2b) |
| AC 4 | Switch the upsert to a plain `.insert()` | **the `status='declined'` assertion** — see below |
| AC 5 | Make `buildAttendanceAbsenceRows` return `[]` (`MarkDayCompleteDialog.tsx:~800-840`) | step 5's `status='absent'` assertion |

🔴 **AC 4's red is NOT the row count** *(gate BLOCKER 6)*. `rsvps` carries
`UNIQUE (session_id, student_id)`, so `.insert()` raises `23505`, the write is
rejected, and "still exactly one row" stays **green**. The detector is that the
row remains `going` with its original `updated_at` instead of becoming
`declined`. (This is the same shape `coach-checkin.spec.ts:68-80` already
documents for `attendance`.)

Record the **real** red output — actual assertion text and exit code, not a
paraphrase. A mutation that will not go red means the spec does not test what it
claims: fix the spec, not the mutation.

---

## 6. Allowed files

**You may create or edit only:**

- `tests/e2e-personas/outreach-lifecycle.spec.ts` *(new; a second spec file is
  permitted if you say why)*
- `tests/e2e-personas/screenshots/*.png` *(committed — AC 7)*
- `docs/swarm/inbox/claude-gam-343-e2e-w2-outreach-lifecycle-findings.json`
  *(new — AC 8; emit it even if empty)*

**You may not edit anything else.** In particular:

- **`tests/e2e-personas/personaHarness.ts` is NOT allowed** — the persona-switch
  fix (§3) is inlined in your spec file.
- **`tests/e2e-harness/seed.sql` is off limits.** ~32 other persona tests read
  those fixtures, and the spec creates its own event through the UI anyway
  (AC 1). If you become convinced you need a seed change, **stop and report it**.
- No production source. The issue is explicit: *"No production code changes are
  expected; if the run needs one to proceed, that is a finding."* File it.
- Not `.claude/**`, `docs/swarm/**` other than the inbox file, `AGENTS.md`, or
  any governance record.
- Not `.github/workflows/**` — a dispatched run **cannot push it**
  *(gate-confirmed nothing here needs one)*.

Stage explicit pathspecs. **Never `git add -A` or `git add .`** (item 22).

---

## 7. Least confident decisions (round 2)

Round 1's five are resolved: #1 and #2 confirmed sound under §2e's two stated
conditions; #3 settled (both roles exist by construction); #4 was justified and
is fixed by §4 step 6's delta; #5 was wrong in my favour — the additive `events`
update targets the spec's own event and drifts no fixture *(gate-measured
`EVENT AFTER adult_volunteers_count 0`)*. These are the new ones.

1. **That the dialog pre-checks BOTH students from the `AttendancePanel` rows
   in step 5.** The whole re-route depends on `MarkDayCompleteDialog` deriving
   checked state from recorded attendance (`:693`, `:722` —
   `checked iff isAttendingStatus(row.status)`). *What would make it wrong:* the
   dialog seeding its checklist from **RSVPs** rather than attendance, in which
   case Jordan (whose RSVP is coach-authored `going`) and Priya (`declined` as
   of step 3) arrive in the opposite states from what step 5 assumes, and the
   uncheck targets the wrong student. **Verify the arrival state before
   unchecking, and assert it.**
2. **That `AttendancePanel`'s checkbox write completes before the dialog reads
   it.** Two surfaces on one page, one cache. *What would make it wrong:* the
   dialog reading a stale react-query snapshot, so the row exists in Postgres
   but the checklist shows unchecked. Poll the database after step 4 **and**
   assert the dialog's arrival state in step 5 rather than assuming.
3. **That the confirm label's `· {h} h` equals `delta(Priya)` exactly.** AC 6's
   cross-witness assumes the label and the view agree to the decimal. *What
   would make it wrong:* the label rounding (`formatHours`) while the view
   returns a float — the seed already shows `3.9999970769444446`, so an
   equality assertion on a rounded label would be red for a correct app. **Use a
   tolerance, and say what it is.**
4. **That the dead window in §2e does not fire during a real run.** A run
   starting near midnight Chicago, or slow enough to cross `11:59 PM`, locks the
   RSVP control mid-spec. *What would make it wrong:* CI scheduling. If it
   fires, it is an environment condition — report it, do not "fix" it by
   loosening an assertion.
5. **That no production defect is found.** The issue budgets for one
   (*"if the run needs [a production change] to proceed, that is a finding"*),
   and this path has three fixed-but-never-watched silent bugs in it. *What
   would make it wrong:* discovering that one of T193/T309/T327's fixes does not
   hold in a real browser. **That is a finding to file, not a spec to bend** —
   pin the real behaviour, say so in a comment per the skill, and emit it in the
   findings JSON.
