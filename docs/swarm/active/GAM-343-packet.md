# GAM-343 worker packet — E2E W2 outreach lifecycle

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

> **Where this packet and the Linear issue body disagree, this packet is right
> and the issue is stale.** Three of the issue's operative claims were measured
> against the tree before this packet was written; two were wrong. They are
> corrected in §2 with citations. Do not "restore" the issue's wording.

---

## 0. Environment

Nothing is running on a fresh container and `node_modules` starts absent. Bring
it up in this order:

```bash
npm ci                                   # several minutes
bash tests/e2e-harness/start.sh          # ~40s; needs root for `su postgres`
npx playwright install chromium          # if the browser is missing
npx playwright test -c tests/e2e-harness/playwright.personas.config.ts
bash tests/e2e-harness/stop.sh           # ALWAYS, at the end
```

`start.sh` recreates the cluster and reloads `seed.sql` each time, so a dirtied
run starts clean again. `stop.sh` deletes the data directory and `.env.e2e`; a
leftover cluster holds port 55432 and silently breaks the next run.

**Establish your own baseline before writing a line of spec.** Run the existing
persona suite and record the pass/fail split. GAM-342's run recorded `21 passed,
5 failed` with all five pre-existing and in files you may not edit. **Do not
assume that number still holds — measure it, and report what you measure.**
Known-stale among them (measured by GAM-342's own premise gate, round 2):
`student-parent.spec.ts:66` is titled *"an RSVP made on the student home never
reaches the database"* and **that premise is false** — the gate deleted the
suspected residue row, re-ran the test alone, and a *fresh* `rsvps` row still
appeared. The control writes. Do not treat that test as evidence about the RSVP
path, and do not fix it — it is not yours.

---

## 1. Acceptance criteria

Verbatim from GAM-343, renumbered only for reference. Corrections in §2 change
*how* some are satisfied, never *whether*.

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
never a deletion candidate during completion fan-out."* Two errors in one
sentence:

- **The protection is gone.** `src/lib/supabase/loaders/outreach.ts:1398-1441`
  (`computeExpectedAttendeeRsvpPlan`) documents T119 / PRD v2 D-7, George's
  2026-07-20 override: *"`selfAuthoredKeys` (T118's protection mechanism) is
  gone -- there is no longer any row this fan-out skips."*
- **It is not "completion" fan-out.** It is the expected-attendee
  reconciliation inside `makeSaveOutreachEvent`. `markDayComplete`
  (`outreach.ts:1281-1377`) never touches `rsvps` at all — it writes
  `attendance`, flips `event_sessions.status`, then does a disclosed
  non-atomic additive `events` update.

**The current rule — "the checklist wins" — is what you test instead**
(`outreach.ts:1403-1420`): a **checked** student gets `status: 'going'` upserted
for every final session id regardless of the prior row's author or status, with
`responded_by` becoming the acting coach's id; an **unchecked** student has
their `status = 'going'` rows **deleted** regardless of author; and a
`'declined'`/`'maybe'` row is left completely untouched by an uncheck. That last
clause is a status filter, not an author rule.

### 2b. ✅ The RLS constraint is real, with a nuance that decides AC 3

`supabase/migrations/20260717000002_rls.sql:205-211` — both write policies
carry `responded_by = auth.uid()`:

```sql
create policy own_or_linked_write on rsvps
  for insert to authenticated
  with check (student_id in (select my_student_ids()) and responded_by = auth.uid());

create policy own_or_linked_update on rsvps
  for update to authenticated
  using (student_id in (select my_student_ids()))
  with check (student_id in (select my_student_ids()) and responded_by = auth.uid());
```

**Nuance the mutation depends on:** `staff_all` (`:197-199`) is `for all` with
`using (is_staff()) with check (is_staff())`, and PostgreSQL OR's permissive
policies. **A coach may write any `responded_by` it likes.** AC 3's mutation is
therefore only red when the actor is the **student** — as the student,
`own_or_linked_write` fails on the uid mismatch and `staff_all` fails on
`is_staff()`, so the INSERT raises `42501`. Drive it as the student or the
mutation proves nothing.

Per the skill's trap list: a blocked INSERT raises `42501`, but a blocked
**UPDATE** does not — it reports `UPDATE 0`. Use `execAs` and assert the
SQLSTATE for the insert case; re-read the row for the update case.

### 2c. ✅ AC 5 / T309 is real and sharper than stated

`src/pages/outreach/MarkDayCompleteDialog.tsx:494-515` and `:831`: the uncheck
writes `status: 'absent'` — it does **not** delete. `'absent'` was chosen over
DELETE precisely because a DELETE would need a second non-atomic write step in
`markDayComplete`.

**The precision that matters:** the dialog only emits an `'absent'` row for a
student who **already has a recorded attendance row** whose status is an
attending one. Unchecking a student who was never recorded is a **legitimate
no-op**, not a bug. A spec that unchecks a never-recorded student and asserts a
database change will fail against correct code; one that asserts "no change" is
vacuous. **Seed the recorded row first, by checking the student and completing,
then re-open and uncheck** — that is also AC 1's "at least one saved record
edited afterwards".

### 2d. ❌ `RsvpControl` has no "Going" label

`src/pages/outreach/RsvpControl.tsx:301-308`:

```ts
export const RSVP_ITEMS: readonly { value: RsvpStatus; label: string }[] = [
  { value: 'going',    label: 'Sign up' },
  { value: 'maybe',    label: 'Maybe' },
  { value: 'declined', label: "Can't go" },
];
```

`RsvpControl.test.tsx:100` asserts this explicitly against "Going". "Going"
exists only in `OutreachList.tsx:3534-3538`'s own inline copy for the
`/outreach` list view. **Route the student through `/outreach/:eventId`** — the
only mount of `RsvpControl` (`OutreachDetail.tsx:812`, rendered at
`:2406-2419`) and the surface the issue names — and click **`Sign up`**, then
**`Can't go`**. The `status` values written are still `going` then `declined`,
so the issue's database-level claim is unchanged; only the label differs.

Apostrophe in `Can't go` is ASCII `U+0027`, codepoint-verified in both files. A
plain `"Can't go"` in a Playwright name matches.

### 2e. 🔴 The journey is not achievable on one session *as the issue describes it*

Two predicates pull in opposite directions:

| Control | Predicate | Citation |
| -- | -- | -- |
| `RsvpControl` editable | `now < starts_at` **and** status `scheduled` | `RsvpControl.tsx:327-329`, `:518` |
| `Mark day complete` trigger visible | staff **and** `formatChicagoDateOnly(now) >= session.sessionDate` | `OutreachDetail.tsx:1492-1497` |

Future-only versus today-or-past. **Resolution this packet adopts: one session
dated *today* whose start time is later today.** `today >= today` satisfies the
completion predicate, and `now < starts_at` satisfies the RSVP predicate, so a
single session carries the whole chain. **Verify this holds in the browser
before building the spec around it** — it is decision #1 in §7. If the create
dialog cannot express a same-day-but-later start, fall back to `Custom dates`
mode with two sessions (one today, one future) and say so in your report.

---

## 3. Measured terrain — selectors

Every row below carries a citation. Where a role is **not** established, the
packet says so; verify live rather than guessing.

### Routes
`/outreach` → `OutreachList`, `/outreach/:eventId` → `OutreachDetail`
(`src/app/router.tsx:169-170, 241, 249`). Both auth-only, **no `RequireRole`** —
students reach the same two paths.

### Coach creates the event — `OutreachEventDialog.tsx`

| Control | Locator | Citation |
| -- | -- | -- |
| Open dialog | `getByRole('button', { name: 'New outreach event' })` — **see RISK 1** | `OutreachList.tsx:3419` |
| Scope | `page.getByRole('dialog').filter({ hasText: 'Basics' }).first()` | `OutreachEventDialog.tsx:1294, 1314` |
| Title | `dialog.getByLabel(/^Title/)` — regex because `isRequired` decorates the label | `:1317-1323` |
| Schedule mode | `getByRole('radiogroup', { name: 'Schedule mode' })` → `radio` `Single`/`Multi-day`/`Recurring`/`Custom dates` | `:1386-1392` |
| Date (single) | `getByRole('combobox', { name: /^Date/ })`, fill `MM/DD/YYYY`, press Enter | `:1397`; proven live at `coach-meeting.spec.ts:129` |
| Team scope | `getByRole('combobox', { name: 'Team scope' })`; options are `role=option`, **portalled** — query `page.getByRole('option')`, not `dialog.…`; `hasSelectAll` injects a first `Select all` row | `:1558-1567`; `coach-meeting.spec.ts:92-111` |
| Expected attendees | one `CheckboxList` **per team**, labelled with the team name; each item named by the **student display name** | `:1596-1611` |
| Submit | `dialog.locator('button', { hasText: /^Create event — \d+ session/ })` | `:1639-1645`, `:951-954` |

**Submit label is dynamic and uses an EM DASH (U+2014):** `Create event — 1
session` / `Create event — 3 sessions` / `Save changes — 1 session`
(`computeConfirmLabel`, `:951-954`). It is **not** the meetings dialog's "Create
N meetings" form. Read the label, then assert the database agrees with the
number it promised.

`DateRangeInput`'s role is **not established** by any spec here. The proven path
is text-then-day-cell: click `getByText('Select date range').first()`, then
`page.getByRole('button', { name: /^\w+day, \w+ \d+, \d{4}$/ })`
(`coach-meeting.spec.ts:198`). **Never press Escape to close the calendar** — it
closes the whole `Dialog` and loses the form. Escape after a `MultiSelector` is
fine.

### Student answers — `RsvpControl.tsx` on `/outreach/:eventId`

- Group: `getByRole('radiogroup', { name: 'Your RSVP for {title} on {date}' })`
  (`:508`, `:517`). Date is `en-US` `{ weekday:'short', month:'short',
  day:'numeric' }` in `America/Chicago` → e.g. `Sat, Aug 15` (`:356-361`).
- Options: `role=radio` named `Sign up` / `Maybe` / `Can't go`; assert
  `aria-checked`.
- **Locks** when `now >= starts_at` or status ≠ `scheduled` (`:327-329`,
  `:518`) — this is §2e's constraint.

### Coach completes the day — `MarkDayCompleteDialog.tsx`

| Control | Locator | Citation |
| -- | -- | -- |
| Trigger | `getByRole('button', { name: /^Mark day complete — / })` | `OutreachDetail.tsx:2337-2345` |
| Scope | `page.getByRole('dialog')` — **mandatory, see RISK 2** | `MarkDayCompleteDialog.tsx:1126-1133` |
| Per-student | `dialog.getByRole('checkbox', { name: student.name })` | `:1151-1160` |
| People reached | `dialog.getByLabel(/^People reached/)` | `:1162-1170` |
| Confirm | `dialog.locator('button', { hasText: /^Mark complete — / })` | `:1058`, `:758-760` |

🔴 **The trigger is the highest-risk selector in the flow.** Astryx `Button`'s
`label` becomes the `aria-label` and `children` only sets visible text, so the
accessible name is `Mark day complete — Sat, Aug 15` and **a bare
`getByRole('button', { name: 'Mark day complete' })` will not match.**
`OutreachDetail.tsx:2331-2336` says this is deliberate — N sessions get N
distinct names. EM DASH U+2014.

Confirm label is also dynamic: `Mark complete — {n} attended · {h} h`
(`:758-760`) — EM DASH U+2014 **and** MIDDLE DOT U+00B7, both codepoint-verified.
It recomputes on every checkbox toggle.

**Do not assert that the confirm label's hour sum equals `v_student_hours`.**
`MarkDayCompleteDialog.tsx:463-467` discloses that the two can legitimately
disagree when preserved check-in/out timestamps make the view's tier-2 rule
fire. AC 6 reads hours from the database; the label is not the witness.

**Ineligible branch:** if `session.status !== 'scheduled'` the dialog renders no
checklist, no inputs and no confirm — only a `Close` button and a banner
`This session can't be marked complete from here` (`:1142`, `:1246`). If you
land here, your session predicate is wrong; re-read §2e.

### Strict-mode hazards — all six are real

1. 🔴 **`New outreach event` renders twice on an empty `/outreach`** — page
   header (`OutreachList.tsx:3419`, unconditional) **and** the `EmptyState`
   action (`:3451`, when `events.length === 0`). Not mutually exclusive. The
   seed ships outreach events so you should be safe, but wait for real data
   (`await expect(page.getByText('Library STEM Night').first()).toBeVisible()`)
   before clicking, exactly as `coach-meeting.spec.ts:48-52` documents.
2. 🔴 **Student-named checkboxes exist twice on the detail page while the
   dialog is open** — `AttendancePanel.tsx:611-616` renders a page-level
   `CheckboxInput label={student.name}` and the dialog renders
   `CheckboxListItem label={student.name}`. Same role, byte-identical name. The
   hours fields collide too (`AttendancePanel.tsx:621` vs
   `MarkDayCompleteDialog.tsx:1209`, both `${student.name} hours`). **Scope
   every dialog interaction to `getByRole('dialog')`.**
3. `Mark day complete` is both the trigger's visible text and the dialog's
   header title — `getByText` is ambiguous once open; role queries are safe
   because the trigger's name carries the date.
4. Multi-session events multiply every per-session control; names differ only
   by date, so two sessions on one calendar day collide.
5. `Retry` appears six times across the two pages — never target a bare one.
6. `Cancel` / `Close` appear in both dialogs — scope.

**Loading gate.** Every loading state is `role="status"` with `aria-busy="true"`
and visually-hidden text (`OutreachList.tsx:4211-4213`,
`OutreachDetail.tsx:2105-2107`). `await expect(page.getByRole('status')).toHaveCount(0)`
is the cleanest "data has loaded" wait.

**One unresolved role.** Two green specs disagree on `CheckboxListItem`:
`student-checkin.spec.ts:216-218` drives it as `checkbox`,
`coach-meeting.spec.ts:191-192` as `button`. The `checkbox` reading has more
support (jsdom sees a real `input[type=checkbox]`;
`MarkDayCompleteDialog.test.tsx:123-126, 580`). **Verify live before committing
to a role, and record which one was true.**

---

## 4. The journey to drive

One spec file, `tests/e2e-personas/outreach-lifecycle.spec.ts`. Split into a
second file only if a single one becomes unreadable; say so if you do.

1. **Coach creates the outreach event.** Sign in as `coach`. `/outreach` → open
   the dialog → type a title → set the date (§2e: today, starting later today)
   → open the `Team scope` `MultiSelector` and **narrow** it (do not leave
   `Select all`) → set the expected-attendee checklist → read the submit
   label's session count → save. **Read back:** an `events` row with your title
   and the `team_ids` you chose, and `event_sessions` rows matching the count
   the button promised.
2. **Student answers.** Sign in as `student` (Priya). `/outreach/{eventId}` →
   `Sign up`. **Read back:** exactly one `rsvps` row, `status = 'going'`,
   `responded_by = PERSONAS.student.profileId`.
3. **Student changes the answer.** `Can't go`. **Read back:** still exactly one
   row, `status = 'declined'`, later `updated_at`.
4. **Coach records the day and completes it.** Sign in as `coach`. Open
   `Mark day complete — {date}` → check Priya and Jordan → type a people-reached
   number → confirm. **Read back:** `attendance` rows with `status='present'`,
   `method='coach'`, `recorded_by` = the coach; `event_sessions.status =
   'completed'` and `people_reached` = what you typed.
5. **Coach edits a saved record — the uncheck.** Re-open the dialog on the same
   session and **uncheck Jordan**, confirm. **Read back:** Jordan's row is now
   `status='absent'` (§2c — this only works because step 4 recorded him first).
   This is AC 1's "saved record edited afterwards" and AC 5's whole point.
6. **Hours land.** Read `v_student_hours`
   (`supabase/migrations/20260717000003_metric_views.sql:3`) and compare against
   what the recorded attendance implies: Priya present contributes, Jordan
   absent contributes zero (`MarkDayCompleteDialog.tsx:481`). Read from the
   database, not the page.

**Assert post-write row state, never the request.** Use `expect.poll(() =>
rows(...).length, { timeout: 20_000 })` before reading values —
`coach-checkin.spec.ts:54` is the idiom.

**Cleanup in `beforeEach`, only rows this spec creates** (AC 9). The spec
creates its own event, so delete by the title it uses — cascade from the
`events` row rather than truncating anything. **Fixtures stay.** The seed's own
outreach event (`e0e00000-…-002`, `Library STEM Night`) and its sessions are
read by other specs; do not touch them.

---

## 5. Mutations required — AC 2, 3, 4, 5, 10

Per the `mutation-replay` skill, and item 26's fast-tier working rule that
applies to every tier: **commit before mutating, mutate, capture the red output
and exit code, revert, re-run green.** Run mutations in **your own worktree**
(item 23) — never the shared tree.

| # | Mutation | Expected red |
| -- | -- | -- |
| AC 2 | Drop the `rsvps` upsert in `makeSubmitRsvpChange` (`outreach.ts:1226-1239`) | the step-2 row-count assertion |
| AC 3 | Send the **coach's** id as `respondedBy` while acting as the student | `42501` from the RLS insert policy — see §2b, this only works as the student |
| AC 4 | Switch the upsert to a plain `.insert()` | step 3's "still exactly one row" |
| AC 5 | Make the uncheck a no-op — return early from the `'absent'` branch (`MarkDayCompleteDialog.tsx:831`) | step 5's `status='absent'` assertion |

Record the **real** red output — the actual assertion text and exit code, not a
paraphrase. A mutation that does not turn the spec red means the spec does not
test what it claims; fix the spec, not the mutation.

---

## 6. Allowed files

**You may create or edit only:**

- `tests/e2e-personas/outreach-lifecycle.spec.ts` *(new; a second spec file is
  permitted if you say why)*
- `tests/e2e-personas/screenshots/*.png` *(committed — AC 7)*
- `docs/swarm/inbox/claude-gam-343-e2e-w2-outreach-lifecycle-findings.json`
  *(new — AC 8; emit it even if empty)*

**You may not edit anything else.** In particular:

- **`tests/e2e-harness/seed.sql` is off limits.** The skill offers editing it as
  a route to different data, but ~26 other persona tests read those fixtures and
  the spec is supposed to *create* its own event through the UI anyway (AC 1).
  If you become convinced you need a seed change, **stop and report it** — that
  is an escalation, not a decision you take.
- No production source. The issue is explicit: *"No production code changes are
  expected; if the run needs one to proceed, that is a finding."* File it.
- Not `.claude/**`, `docs/swarm/**` other than the inbox file, `AGENTS.md`, or
  any governance record. Those are the orchestrator's.
- Not `.github/workflows/**` — a dispatched run **cannot push it** (both
  credentials are refused by design). Nothing here should need one.

Stage explicit pathspecs. **Never `git add -A` or `git add .`** (item 22).

---

## 7. Least confident decisions (item 19d)

Attack these first.

1. **That one session dated today, starting later today, satisfies both the
   RSVP-editable and mark-day-complete-eligible predicates simultaneously**
   (§2e). This is the packet's structural keystone — if it is false, the whole
   journey needs two sessions and step 4 acts on a different session than steps
   2-3. *What would make it wrong:* `sessionDate` being derived from
   `starts_at` in UTC rather than Chicago wall time, so a late-evening Chicago
   start rolls to tomorrow's date and the completion predicate fails; or the
   create dialog defaulting `starts_at` to a fixed morning hour with no way to
   set a later one, making `now < starts_at` false for any afternoon run. **The
   gate should measure this in the browser, not read it.**
2. **That the create dialog can express "today" at all.** `DateInput` may floor
   or reject a same-day pick, and `Single` mode may derive times from a preset.
   *What would make it wrong:* a `min` on the date input, or a validation rule
   requiring a future start. If so, §2e's `Custom dates` fallback is not a
   fallback but the only path.
3. **That `CheckboxListItem` resolves as `role=checkbox`.** Two green specs in
   this repo disagree and I did not resolve it — `node_modules` was absent
   during the survey so Astryx's compiled DOM could not be read. *What would
   make it wrong:* Astryx rendering a `button[role=checkbox]`-less toggle, in
   which case every checklist locator in §3 is wrong and `coach-meeting.spec.ts`
   has the right idiom.
4. **That AC 6's "hours the attendance implies" is computable without
   re-deriving the metric formula.** Constitution item 3 makes duplicating a
   metric formula in TypeScript a BLOCKER (PRD DATA-01), so the spec must read
   `v_student_hours` rather than compute expected hours itself — but then the
   assertion risks being a tautology (the view agreeing with itself). *What
   would make it wrong:* if the only honest assertion is "Priya > 0 and Jordan
   unchanged", that is thin, and the gate should say so and propose a stronger
   one that still does not re-derive the formula.
5. **That the spec can clean up after itself without a reseed (AC 9)** when
   step 4 also mutates `events.adult_volunteers_count` additively
   (`outreach.ts:1363-1375`). *What would make it wrong:* the additive update
   landing on a **seed** event rather than the spec's own — it targets the
   session's own event, so it should be self-created, but if the spec ever
   completes a seeded session it would permanently drift a fixture other specs
   read.
