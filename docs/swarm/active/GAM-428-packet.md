# GAM-428 task packet **v2** — Reports "Planned hrs" must match the confirmed-hours predicate

**Tier:** STANDARD (item 26), re-argued in v2 — see "Tier" below.
**Branch:** `claude/gam-428-planned-hours-competition-filter`. **Base:** `main` @ `b9396c9`.
**Worker model:** default (`sonnet`). Item 18's four triggers (migration,
RLS/`security definer`, metric-view SQL, auth/role logic) are all absent from
this packet's scope — v2 explicitly removes the metric-view half.

> **v1 was gated REVISE with three BLOCKERs and this is the revision.** The
> round-1 `checker-premise` did not merely read: it applied v1's exact
> prescription in its own worktree, ran 2583 tests, and stood up a scratch
> PostgreSQL cluster with all migrations applied. What it falsified is recorded
> under "What v1 got wrong" — that section is not decoration, it is the reason
> this packet is half the size.

## What v1 got wrong (kept, per item 30c — deleting the error deletes the evidence)

1. **`StudentHome.tsx`'s `computePlannedHours` is dead on the render path.**
   T176 round 2 moved that card onto `v_student_goal_projection.planned_hours`
   (`StudentHome.tsx:1536-1543`, `students.ts:531`); the rendered string at
   `StudentHome.tsx:1647` reads a prop, not this function. The gate applied v1's
   change to both files and the full suite was unchanged at 2583/2583 green.
   **v1's File 1 fixed nothing a user can see, and it is removed from v2.**
2. **The real student-facing defect is in a metric view v1 never named.**
   `v_planned_rsvp_hours` joins on `e.counts_volunteer_hours` with **no `type`
   test**. T322 fixed `v_student_hours` and `v_season_kpis` and left the planned
   views behind. That is item 3 territory and is **filed separately**, not fixed
   here. See "The half this packet does not fix".
3. **v1's criterion 7 ordered a false comment.** `v_student_hours` is the
   *confirmed*-hours view; it is not the authority for planned hours.

Everything else in v1 was measured correct: every line number, the view's
`and e.type = 'outreach'::text` clause (read via `pg_get_viewdef` on an applied
cluster), and the absence of any test asserting the old behaviour.

## The defect this packet fixes

The **Reports → Hours** tab renders a per-student row carrying **Confirmed hrs**
beside **Planned hrs**. Confirmed comes from `v_student_hours`, whose join is
`... and e.counts_volunteer_hours and e.type = 'outreach'` — **both** required
(measured: `pg_get_viewdef('v_student_hours', true)`). Planned is computed in
TypeScript by `computeStudentPlannedHours`, which tests only the flag. A
competition whose admin-editable "Counts toward volunteer hours" Switch is on
therefore lands in Planned and can never land in Confirmed. Both numbers are in
the same table row, so the gap needs no navigation to see.

`events.type` is `text NOT NULL` with
`CHECK (type = ANY (ARRAY['meeting','outreach','competition']))` — measured on
the applied cluster, no enum. The domain is closed at three, so an allow-list on
`'outreach'` is correct and cannot silently exclude a fourth type.

**Who sees it:** coaches and admins. `Reports` is `staffOnly: true`
(`SideNav.tsx:129`, `MobileNav.tsx:146`). This is a staff-facing number, not a
student-facing one — v1 claimed otherwise and was wrong.

## The change

**One file: `src/pages/reports/HoursTab.tsx`.**

In `computeStudentPlannedHours` (`:470-490`), line **481** currently reads:

```ts
    if (!event || !event.countsVolunteerHours) continue;
```

It must also skip events whose `type` is not `'outreach'`. `HoursEventRow.type`
(`:378`) is populated on the real path — `src/lib/supabase/loaders/reports.ts:437`
selects `id, season_id, type, team_ids, counts_volunteer_hours`, and
`loadHoursData` (`reports.ts:577`) is `HoursTab`'s real default `loadData`
(`:1177`). Item 27 is therefore satisfied: this runs on real data on the path a
user actually takes, not on a fixture.

### The two comments that must be corrected

Both are measurably false today and both are load-bearing.

**(a) `HoursTab.tsx:65-75`** argues the flag alone is the right guard, on this
ground:

> `event.countsVolunteerHours` must also be true -- the same flag
> `v_student_hours`'s own join (`join events e ... and e.counts_volunteer_hours`)
> uses for confirmed hours, so a session that could never contribute confirmed
> hours once completed never contributes planned hours either.

**That stated principle is exactly right and is the reason for this fix.** What
is stale is the predicate it quotes: the join gained `and e.type = 'outreach'`
in `20260804000000_volunteer_hours_outreach_only.sql`. Update the quoted join
and the conclusion so the comment describes the two-part predicate it now
implements. Keep the principle — do not rewrite the paragraph from scratch.

**(b) `HoursTab.tsx:54`** reads:

> `2. Planned hours -- NO SQL view exists for this; computed in TypeScript,`

Measurably false: `v_planned_rsvp_hours` and `v_student_planned_hours` both
exist and are applied (16 views enumerated on the cluster). Correct it to say
that planned-hours views **do** exist, that this tab deliberately computes its
own from raw rows, and that the two are **not** currently equivalent — see the
next paragraph.

**Ground the comments in the owner ruling, not in `v_student_hours`.** The
citable source is the header of
`supabase/migrations/20260804000000_volunteer_hours_outreach_only.sql`,
ruling 2 (2026-08-03): *"Volunteer hours = `type = 'outreach'` ONLY."*

**Do not overclaim parity.** Even after this fix the TypeScript number still
differs from `v_planned_rsvp_hours` by that view's `starts_at >= now()` future
guard (added by `20260724000001_planned_hours_future_guard.sql`, T128), which
the TypeScript has no equivalent of. Say so rather than claiming the two agree.

## Explicitly NOT in scope

- **Do not touch `supabase/migrations/**` or any view.** Re-deriving metric SQL
  is a BLOCKER under item 3. The known `v_planned_rsvp_hours` defect is filed
  separately and is deliberately left alone here.
- **Do not touch `src/pages/home/StudentHome.tsx`.** Its `computePlannedHours`
  is dead on the render path; changing it fixes nothing and would put a
  misleading "fixed" claim on the student card. Leave it byte-unchanged.
- **Do not use `OutreachList.tsx`'s `filterOutreachEvents`.** `OutreachList.tsx:41`
  documents it as *"the ONLY `event.type` predicate in this file"* and that
  file's invariant depends on it staying local. Note also that
  `OutreachList.tsx`'s own `computeStudentHours` (`:1380-1398`) needs **no**
  change — it only ever receives already-outreach-filtered sessions, so it is
  correct by construction, not overlooked.
- **Do not extract a shared helper.** No shared `event.type` predicate exists in
  `src/lib/` (the gate searched); creating one is a signature other modules
  would depend on, which STANDARD excludes.
- **Do not touch `OutreachEventDialog.tsx`.** Whether the admin Switch should
  exist is an owner product call, filed separately.

## Allowed files

```
src/pages/reports/HoursTab.tsx
src/pages/reports/HoursTab.test.tsx
```

Everything else is forbidden, including `src/pages/home/**`, all of
`supabase/**`, `docs/swarm/**`, `.claude/**` and `.github/**`.

## Acceptance criteria

1. `computeStudentPlannedHours` returns **0** for a `scheduled` session on a
   `competition` event with `countsVolunteerHours: true` and a `going` RSVP.
2. It still returns the correct **non-zero** total for an `outreach` event with
   `countsVolunteerHours: true` and a `going` RSVP. **This is the criterion that
   catches an over-correction and it is not optional** — a fix that zeroes
   legitimate planned hours is worse than the bug.
3. It still returns 0 for a `meeting` event, and for a `competition` with the
   flag off — unchanged behaviour, asserted so a later refactor cannot quietly
   drop either half of the predicate.
4. The competition case is asserted through **`buildStudentRows`** (`:534`), not
   only against the pure function, so the test follows the value into the row
   the table actually renders. v1's criteria could all have gone green while the
   surface stayed broken; this one closes that gap.
5. The worker states the exact one-line mutation that turns the new test red.
   The orchestrator replays it.
6. Every existing test in `HoursTab.test.tsx` passes **unmodified**. The gate
   measured 2583/2583 green with this change applied, so no test asserts the old
   behaviour and none should need editing. If one does, **stop and report it**
   rather than editing it — that would be a reversal of passed work.
7. Both comments in "The two comments that must be corrected" are fixed, cite
   the 2026-08-03 owner ruling rather than `v_student_hours`, and do not claim
   parity with `v_planned_rsvp_hours`.

## The half this packet does not fix, disclosed

`v_planned_rsvp_hours` is missing the same `type = 'outreach'` predicate, which
puts the identical wrong number on the **student** home card and on **CoachHome**'s
goal projection (`CoachHome.tsx:1433/1439/2050`). That is metric-view SQL: item 3
routes it through PRD 8.4 and the owner, and it is HEAVY, not STANDARD. It is
filed as its own Linear row before this PR opens (item 20) and is **not**
attempted here. This PR therefore fixes the staff-facing Reports surface and
leaves the student-facing card to that row.

## Tier

**STANDARD**, re-argued after the gate falsified v1's basis.

v1 defended STANDARD partly on "both call sites render into a student-facing
figure", which is false — `Reports` is `staffOnly: true`. The tier survives the
correction on better grounds: item 26's four HEAVY triggers are a write path or
destructive operation, RLS/auth/role logic, a migration or metric-view SQL, or
an export another session builds against, and **v2 touches none of them** —
precisely because the metric-view half has been carved out and filed. What is
left is one predicate and its comments in a single read-only display module,
plus tests. That is STANDARD's own description.

Not FAST: FAST is the orchestrator implementing directly with a mutation already
in hand, and this needs new test seams and two comment corrections whose accuracy
is the point.

## Evidence the worker must return

- The commit SHA its work landed in (item 21 — "clean" is not "committed").
- The mutation string for criterion 5.
- `npx vitest run src/pages/reports/HoursTab.test.tsx` output and exit code.
- The list of files it changed, so the Allowed Files boundary can be checked.

## Least confident decisions (item 19d)

1. **That leaving `StudentHome.tsx:872` byte-unchanged is right rather than
   fixing it anyway "for consistency".** Wrong if anything outside the render
   path consumes `computePlannedHours` for a real decision — the gate found only
   type-only imports and tests, but an unused export is also a trap for the next
   author, who may wire it up and inherit the bug. Mitigated by the follow-up
   row naming it.
2. **That correcting comment (b) at `:54` is in scope rather than scope creep.**
   Wrong if the worker rewrites the module doc more broadly than the one false
   sentence. The instruction is deliberately narrow; a large doc diff is a
   failure of this criterion, not a bonus.
3. **That asserting through `buildStudentRows` (criterion 4) is reachable
   without a large fixture.** Wrong if `buildStudentRows` needs season/team/goal
   scaffolding the existing tests do not already build — the gate reported
   existing fixture shapes at `HoursTab.test.tsx:137`, but I did not confirm one
   can be driven end-to-end with a competition event specifically.
4. **That the `starts_at >= now()` divergence is worth only a comment and not a
   fix.** Wrong if a coach reads Reports "Planned hrs" beside the student card's
   planned number and needs them to agree; then this packet ships a *second*
   knowingly-divergent pair. I judge one disclosed divergence better than
   widening a STANDARD row into the metric-view route, but it is a judgement.
