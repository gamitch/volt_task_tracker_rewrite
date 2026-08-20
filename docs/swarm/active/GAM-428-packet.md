# GAM-428 task packet — planned hours must match the confirmed-hours predicate

**Tier:** STANDARD (item 26). **Branch:** `claude/gam-428-planned-hours-competition-filter`.
**Base:** `main` @ `b9396c9`. **Worker model:** default (`sonnet`) — item 18's four
triggers (migration, RLS/`security definer`, metric-view SQL, auth/role logic) are
all absent; this is a display-layer predicate change.

## The defect, in one paragraph

`v_student_hours` — the view **Confirmed** hours come from — joins
`events e on e.id = es.event_id and e.counts_volunteer_hours and e.type = 'outreach'`.
It requires **both**. The two TypeScript functions that compute **Planned** hours
test only `countsVolunteerHours`. A competition whose admin-editable
"Counts toward volunteer hours" Switch is on therefore contributes to Planned and
can never contribute to Confirmed, no matter how the student attends. The two
numbers render side by side (`HoursTab` table row, `StudentHome` card), so the
gap is visible with no navigation and nothing on screen explains it.

## The change

Add the missing `type` test to both functions, so each pairs with the view it
is displayed beside.

**File 1 — `src/pages/home/StudentHome.tsx`**, in `computePlannedHours`
(defined at `:861-881`). Line **872** currently reads:

```ts
    if (!event || !event.countsVolunteerHours) continue;
```

It must also skip events whose `type` is not `'outreach'`. `HomeEventRow.type`
(`src/lib/outreach/unansweredOutreach.ts:52`) is `'meeting' | 'outreach' | 'competition'`
and is already populated on the real path — `students.ts:863` selects
`id, season_id, type, title, team_ids, counts_volunteer_hours`.

**File 2 — `src/pages/reports/HoursTab.tsx`**, in `computeStudentPlannedHours`
(defined at `:470-490`). Line **481** is the identical line and takes the
identical change. `HoursEventRow.type` (`:378`) is populated by
`reports.ts:437`, which selects `id, season_id, type, team_ids, counts_volunteer_hours`.

Both functions' **doc comments must be updated too.** Each currently describes
the flag as the whole predicate, and `HoursTab.tsx:461-468` positively argues
that the flag alone is the right guard for this tab. That comment is now wrong
and is the reason the parent investigation read this file as exemplary rather
than as under-filtered. Say what the predicate is and name `v_student_hours` as
what it must agree with.

## Explicitly NOT in scope

- **Do not change `v_student_hours` or any file under `supabase/migrations/`.**
  The view is the output of the T322 owner ruling and re-deriving metric SQL is a
  BLOCKER under constitution item 3. The TypeScript comes up to the view, never
  the reverse.
- **Do not use `OutreachList.tsx`'s `filterOutreachEvents`** as a shared helper.
  `OutreachList.tsx:41` documents it as *"the ONLY `event.type` predicate in this
  file"* and that file's invariant depends on it staying local. It is the obvious
  reuse and it is the wrong seam.
- **Do not touch `OutreachEventDialog.tsx`.** Whether the admin Switch should
  exist at all is an owner product call, filed separately. It is a write path
  (event creation) and would be a different tier.
- **Do not extract a shared helper across the two files.** They are two
  independent page modules with deliberately duplicated local pure functions
  (each file's own module docs record the duplication as intentional). Creating a
  cross-page import is a signature another module depends on, which STANDARD
  excludes.

## Allowed files

```
src/pages/home/StudentHome.tsx
src/pages/home/StudentHome.test.tsx
src/pages/reports/HoursTab.tsx
src/pages/reports/HoursTab.test.tsx
```

Everything else is forbidden, including all of `docs/swarm/**`, `.claude/**`,
`supabase/**` and `.github/**`.

## Acceptance criteria

1. `computePlannedHours` returns **0** for a `scheduled` session on a
   `competition` event with `countsVolunteerHours: true` and a `going` RSVP.
2. `computeStudentPlannedHours` returns **0** for the same shape.
3. Both still return the correct non-zero total for an `outreach` event with
   `countsVolunteerHours: true` and a `going` RSVP — the fix must not zero out
   legitimate planned hours. **This is the criterion that catches an
   over-correction**, and it is not optional.
4. Both still return 0 for a `meeting` event, and for a `competition` with the
   flag off — unchanged behaviour, asserted so a later refactor cannot quietly
   drop the flag test.
5. A test in **each** file names the competition case explicitly and would fail
   if its file's `type` test were removed. The worker states, for each file, the
   exact one-line mutation that turns its new test red — the orchestrator
   replays both.
6. Every existing test in both files still passes, unmodified. If an existing
   test asserts the old behaviour, **stop and report it** rather than editing it
   — that would be a reversal of passed work and needs authorization.
7. Both doc comments describe the real two-part predicate and name
   `v_student_hours`.

## Evidence the worker must return

- The commit SHA its work landed in (item 21 — "clean" is not "committed").
- The two mutation strings for criterion 5.
- `npx vitest run src/pages/home/StudentHome.test.tsx src/pages/reports/HoursTab.test.tsx`
  output with its exit code.
- The list of files it changed, so the Allowed Files boundary can be checked.

## Least confident decisions (item 19d)

1. **That the fix belongs in both functions rather than in one shared helper.**
   Wrong if the two files already import a common predicate I did not find, in
   which case duplicating the test in two places is the inferior seam. I checked
   both files' imports and found no shared events predicate, but I did not
   exhaustively search `src/lib/` for one.
2. **That `'outreach'` is the right literal, rather than "not `'meeting'` and
   not `'competition'`".** Wrong if a fourth event type exists anywhere in the
   schema or is planned, in which case an allow-list silently excludes it. I read
   the union type in two TypeScript files; I did not read the database enum or
   the `events.type` check constraint.
3. **That `20260804000000_volunteer_hours_outreach_only.sql` is the live
   definition of `v_student_hours`.** Wrong if any later migration replaces the
   view. I listed the six migrations dated after it and none names
   `v_student_hours`, but I read filenames plus a `grep`, not the applied result
   of running them in order.
4. **That no existing test asserts the current (flag-only) behaviour for a
   competition.** Wrong if one does, which would make this a reversal of passed
   work needing authorization rather than a bug fix. Criterion 6 is written to
   surface that rather than let a worker quietly edit it, but I did not read all
   13 existing planned-hours tests myself.
5. **That STANDARD is the right tier.** Wrong if the change turns out to alter a
   number a *coach* acts on rather than a number a student reads — the argument
   for HEAVY would be that Planned hours feed a decision somewhere I have not
   traced. I confirmed both call sites render into a student-facing figure; I did
   not trace every consumer of `computeStudentPlannedHours`'s output through
   `buildStudentRows`.
