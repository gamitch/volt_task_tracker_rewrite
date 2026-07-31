# T176 — Worker Output

**Worker:** sonnet (per packet §8). **Packet revision pinned:** 2, commit
`477dd9ec2f92cab7da46465a330a61841e0e18a1` — confirmed via
`git log -1 --format=%H -- docs/swarm/active/T176-worker-packet.md` before
reading it, matched exactly.

**This document has been through two rounds.** Round 1 shipped a design
(raw `students.team_id`/`goal_hours_override` read, coalesced in
TypeScript) that the checker returned FAIL — one MAJOR on: it violated
constitution item 3 because a shipped view, `v_student_goal_projection`,
already computes that exact coalesce in SQL. The checker traced the error
to its own brief, not to my execution, and confirmed everything else
(all five gates, all mutation evidence, the blast radius, the criterion-11
enumeration with a third distinct value) reproduced exactly. **Round 2**
(this document, current) replaces the raw-column read with a read of that
view, corrects the two false/imprecise claims the checker flagged, and
re-verifies every mutation against the new code. Section headers below are
marked `[ROUND 2]` where the content changed; unmarked sections are
unchanged from round 1 and still accurate.

## 1. Merge result

Round 1:
```
git fetch origin
git merge origin/claude/swarm-plan-zl575z
```
Fast-forward, `f7ff055..477dd9e`, no conflicts. `npm ci` succeeded.

Round 2: `git fetch origin && git merge origin/claude/swarm-plan-zl575z` →
**"Already up to date."** No new commits landed between rounds; nothing to
merge.

## 2. Final commit `[ROUND 2]`

Two commits on top of the merge base:
- `9ccefcd98145df40a2e6019fcbb51ac7ab494585` — round 1 implementation.
- `934f4ceb3eda52cad22bc5a9012fbd47a10cba19` — round 2 fix (this document
  also amended after this commit; see below).

`git log -1 --format=%H` after the round-2 commit confirms `HEAD` at
`934f4ce...`. Working tree is clean at this SHA after every mutation
experiment below was reverted with `git checkout -- <file>` (item 23:
every mutation applied, run, and reverted inside this worktree only).

This document itself (`T176-worker-output.md`) is committed separately
after the round-2 code commit, since it documents that commit's own
mutation evidence — its own SHA is reported at the end of this document
once committed.

Files changed across both rounds (5 code files, unchanged set from round
1 — round 2 touched the same files, no new files added or removed):
`src/pages/home/StudentHome.tsx`, `src/pages/home/StudentHome.test.tsx`,
`src/pages/home/DashboardPage.test.tsx`,
`src/lib/supabase/loaders/students.ts`,
`src/lib/supabase/loaders/students.test.ts`.

## 3. The MAJOR, and the fix `[ROUND 2, new section]`

**Round 1's error:** `resolveStudentScope` read `students.team_id`/
`students.goal_hours_override` directly and `StudentHome.tsx`'s content
tier called `resolveGoalHours(goalHoursOverride, seasonDefaultGoalHours)`
— a plain nullish-coalesce — to compute the denominator. This is
constitution item 3 territory: `v_student_goal_projection`
(`supabase/migrations/20260723000001_dashboard_views.sql:322-334`)
already performs `coalesce(s.goal_hours_override, se.default_goal_hours)
as goal_hours` in SQL, scoped to the currently-active season, and already
has a working in-repo reader (`src/lib/supabase/loaders/dashboard.ts`'s
`queryGoalProjection`, `.select('student_id, season_id, team_id,
goal_hours, confirmed_hours, planned_hours')`) whose consumer
(`CoachHome.tsx`'s module doc, "(g) Goal source") states the required
posture verbatim: *"`StudentGoalProjectionEntry.goalHours` is a verbatim
passthrough, never recomputed here."* `kpi_views.sql:216` independently
carries the SUMMED form of the identical coalesce
(`coalesce(sum(coalesce(s.goal_hours_override, se.default_goal_hours)),
0)`), confirming this is real, already-shipped SQL formula territory, not
a gap this task could legitimately fill in TypeScript.

**The fix (substitution, not addition):** `resolveStudentScope`
(`loaders/students.ts`) now reads `v_student_goal_projection`, selecting
`team_id, goal_hours, confirmed_hours, planned_hours`, scoped by
`.eq('student_id', studentId)`. `goalHours` is now a verbatim passthrough
of that view's own column — `resolveGoalHours` is not called anywhere in
`StudentHome.tsx`'s render path anymore (it stays exported and directly
unit-tested, byte-unchanged, per criterion 9's own discipline — simply
unused by this one call site now). The same single read also returns
`confirmed_hours`/`planned_hours` (that view's own `v_student_hours`/
`v_student_planned_hours` LEFT JOINs), threaded through so the content
tier's "N h confirmed + M h planned" legend and the `ProgressBar`'s
`value` no longer read `data.studentHours`/call `computePlannedHours(...)`
(both still-fixture, unrelated `loadData` fields/functions) — this
reclassifies criterion 11's enumeration row 5 from "honestly empty via a
fixture-null" to genuinely real (see §6 below).

**RLS — reasoned, not measured (no live Supabase in this environment, the
same disclosed gap every task in this codebase carries).** The
migration's own header (`dashboard_views.sql:49-52`) states none of its
views are `security_definer`/`security_barrier`, so
`v_student_goal_projection` runs under the CALLING session's own RLS
against its base tables. For a `student`-role caller reading their own
`student_id`: `students` carries `own_or_linked_read`
(`rls.sql:100-102`); `seasons` carries `read_all` (`rls.sql:78-79`); the
view's own `v_student_hours` LEFT JOIN reads `attendance`
(`own_or_linked_read`, `rls.sql:230-232`) via `event_sessions`
(`own_or_linked_read`, `rls.sql:180`) and `events`
(`own_or_linked_read`, `rls.sql:153`); `v_student_planned_hours` reads
`v_planned_rsvp_hours`, itself over `rsvps` (`own_or_linked_read`,
`rls.sql:201`) via the same `event_sessions`/`events`. Every base table
this view touches already grants a student read access to exactly their
own row(s). This exact composition (a multi-table view whose every base
table is `own_or_linked_read`-covered, read by a student for their own
id) has no direct precedent elsewhere in this codebase to point to as a
live-tested example — **flagged for the checker to independently confirm
rather than accepted on my own reasoning alone**, exactly as requested.

**The `resolveGoalHours`/`computePlannedHours` byte-unchanged discipline
is preserved.** Both stay exported, both keep their own direct
pure-function unit tests unchanged in this file, both are simply no
longer called from the content tier's render body — confirmed by diff
(§7 below).

## 4. Two corrections to false/imprecise claims `[ROUND 2]`

1. **`StudentHome.tsx`'s module doc #4** previously claimed MET-04's
   denominator "has no SQL view of its own" and that `resolveGoalHours`
   "is not a re-derivation of anything the views compute." **Both are
   false, corrected** with the `dashboard_views.sql:322-334`/
   `kpi_views.sql:216` citations above, and an explicit statement that
   `resolveGoalHours` is no longer called from this render path at all.
2. **The `student_teams.sql` quote in module doc #8** (and in this
   document's own §8 follow-up 12b) spliced two non-contiguous lines
   (line 2, and lines 10-12) with an ellipsis inside quote marks, implying
   contiguity. Both fragments are individually verbatim and accurate, but
   the splice was misleading. Corrected in both `StudentHome.tsx` and this
   document to cite the two fragments explicitly as separate, with their
   own line numbers.

## 5. The skip-mount branch — deleted, not pinned `[ROUND 2]`

The checker measured that `StudentHomeIdentityGate`'s skip-mount branch
(both `explicitStudentId`/`explicitTeamId` given → render
`StudentHomeContent` directly, bypassing `ResolvedStudentHomeView`
entirely) was pinned by nothing — disabling it left 56/56 tests green.

**I measured why, directly, before deciding.** Built a throwaway local
test file (`src/pages/home/__t176_pin_experiment.test.tsx`, written, run,
then deleted — never committed) rendering `<StudentHome
studentId="..." teamId="..." loadData={() => new Promise(() => {})} />`
and logging `container.textContent` synchronously and after each of three
`Promise.resolve()` flushes, **both with and without the skip-mount
branch present** (the "without" case built by temporarily replacing
`StudentHomeIdentityGate`'s body with `return
<ResolvedStudentHomeView {...props} />;`, run, then reverted). Result:
**identical in both configurations** — after exactly one flush, both show
`"Loading Home…"` (the content tier's own skeleton), never
`"Finding your student record…"`. Reasoning: `resolveStudentIdentity`'s
own internal `explicitStudentId ?? await resolveStudentId(viewer)`
short-circuit means the right-hand `await` expression is never even
evaluated when both ids are explicit — the function still returns a
`Promise` (it's declared `async`), but with no real asynchronous work
inside it, so it settles on the very next microtask regardless of whether
`ResolvedStudentHomeView` mounted at all. The skip-mount branch was
therefore **genuinely behaviorally redundant**, not merely untested.

**Per the checker's own instruction ("delete if genuinely redundant, pin
otherwise"): deleted.** `StudentHomeIdentityGate` no longer exists;
`StudentHome`'s outer wrapper renders `ResolvedStudentHomeView` directly
in the `'ready'` case. This also simplifies the identity-resolution
tier's own module doc, which now records this measurement instead of
describing a branch that no longer exists.

## 6. `loaders/students.ts` — additive-only confirmation `[ROUND 2]`

Diff only **appends** after `updateStudent` (the last pre-existing
export); no existing line was touched, confirmed again against the
round-2 diff. New exports: `StudentGoalProjectionDbRow` (new interface,
replacing round 1's `StudentScopeDbRow`, still not a reuse of
`StudentDbRow`), `queryStudentGoalProjectionById` (replacing round 1's
`queryStudentScopeById`), `makeResolveStudentScope`, `resolveStudentScope`
(both names unchanged from round 1 — only their internal implementation
changed). `git diff 477dd9e 934f4ce -- src/lib/supabase/loaders/students.ts`
confirms `StudentDbRow`, `TeamDbRow`, `InviteDbRow`,
`mapStudentDbRowToStudentRow`, `queryStudents`, `makeLoadStudentsTabData`,
`makeSetStudentActive`, `makeCreateStudent`, `makeUpdateStudent` remain
byte-identical to the merge base across both rounds.

`src/lib/supabase/loaders/students.test.ts` rewritten for the new table
name (`v_student_goal_projection`, not `students`) and column set
(`team_id, goal_hours, confirmed_hours, planned_hours`, not `team_id,
goal_hours_override`), still scoped to `makeResolveStudentScope`/
`resolveStudentScope` only — not a full coverage sweep of
`loaders/students.ts`.

## 7. Constitution item 3 confirmation `[ROUND 2]`

**Round 1's confirmation was wrong** (it confirmed threading
`season.defaultGoalHours`/a raw `goal_hours_override` column into the
existing `resolveGoalHours` did not cross the line — but it never checked
whether a view already computed that exact coalesce, which is precisely
what item 3 forbids re-deriving).

**Round 2, explicitly re-confirmed, correctly this time:** the fix is a
verbatim SQL-to-TypeScript passthrough, not a re-derivation. `goalHours`/
`confirmedHours`/`plannedHours` are read directly off
`v_student_goal_projection`'s own already-computed columns with zero
arithmetic applied in `loaders/students.ts` or `StudentHome.tsx`. Diff
proof (unchanged from round 1's own method, re-run against the round-2
diff):

```
git diff 477dd9ec2f92cab7da46465a330a61841e0e18a1 934f4ce -- src/pages/home/StudentHome.tsx \
  | grep -E "^\+function|^\+export function|^-function|^-export function"
```
→ only `StudentHomeLoadingSkeleton`, `StudentHomeContent`,
`ResolvedStudentHomeView`, and the renamed/rewritten `StudentHome` appear.
`resolveGoalHours`, `hoursVsGoalPercent`, `computePlannedHours`,
`buildNextUp`, `getUnansweredOutreachOpportunities`,
`selectLiveMeetingSession` do not appear at all — their definitions
remain byte-unchanged across both rounds. `hoursVsGoalPercent`'s division
(confirmed/goal → a percent) is the one legitimate UI-side computation
still performed here, and `dashboard_views.sql`'s own module doc (heading
9) explicitly disclaims computing this exact ratio in SQL ("Percent-of-
goal ... is deliberately NOT computed here"), confirming it is not a gap.

## 8. Per-criterion mutation evidence `[re-verified against round 2 code; unchanged outcomes for 1-9, new/updated for 10]`

Every mutation below was re-applied directly to the round-2 committed
source at `934f4ce`, run, captured, then reverted with `git checkout --
<file>` and re-verified green before moving to the next. All experiments
ran in this worktree only (item 23).

### Criterion 1 — real `studentId` reaches `loadData`

**Mutation:** `const studentId = explicitStudentId ?? (await
resolveStudentId(viewer));` → `const studentId =
PLACEHOLDER_CURRENT_STUDENT_ID;`

**Result — RED (re-confirmed):**
```
AssertionError: expected 'student-placeholder-current-viewer' to be 'student-fixture-resolved'
 ❯ src/pages/home/StudentHome.test.tsx:1200:44
```
(Criterion 11 also went red as an incidental, correct side effect — same
as round 1.) Reverted; suite green.

### Criterion 2 — explicit `studentId` bypasses `resolveStudentId`, paired (BLOCKER 2 fix)

**Mutation A (resolution always fires):**
```
- const studentId = explicitStudentId ?? (await resolveStudentId(viewer));
+ const resolvedStudentIdMutation = await resolveStudentId(viewer);
+ const studentId = explicitStudentId ?? resolvedStudentIdMutation;
```
**Result — RED, on the intended (a) assertion (re-confirmed):**
```
AssertionError: expected "spy" to not be called at all, but actually been called 1 times
```

**Mutation B (vacuity probe — `resolveStudentIdentity` body replaced with
`return null;`):**
**Result — RED, on (b) only, (a) stays green (re-confirmed):**
```
AssertionError: expected 'No student account linked yetWe could…' to contain 'Hi Student student-explicit-alpha'
```

Both reverted; suite green after each. **§3's own disclosed design note
still applies and is now checker-confirmed correct, not merely
disclosed:** the packet's literal "remove the bypass branch" phrasing
described `MeetingsList.tsx`'s own architecture (the container is the
ONLY guard); this implementation places the guard inside
`resolveStudentIdentity` itself (§6's own prescribed "skip the call if
explicitStudentId is given" instruction, read literally and strongly),
so mutation A targets that internal short-circuit directly, not the
(now-deleted) outer container branch.

### Criterion 3 — real, resolved `teamId` reaches team-scoped widgets, three distinct non-placeholder ids (BLOCKER 1 fix)

**Mutation:** `teamId: scope.teamId` → `teamId:
PLACEHOLDER_CURRENT_TEAM_ID`.

**Result — RED, genuinely (re-confirmed):**
```
AssertionError: expected 'Hi Ada Reyes...' to contain 'In-Scope Team Meeting C3'
```
Reverted; suite green.

### Criterion 4 — explicit `teamId` bypasses `resolveStudentScope` entirely, paired (BLOCKER 2 fix extended)

**Mutation A (resolution always fires — moved `const scope = await
resolveStudentScope(studentId);` to execute unconditionally, before the
`explicitTeamId !== undefined` check):**

**Result — RED, on the intended (a) assertion (re-confirmed):**
```
AssertionError: expected "spy" to not be called at all, but actually been called 1 times
```

**Mutation B (vacuity probe, same `resolveStudentIdentity → return null`
mutation as criterion 2's probe, re-run against criterion 4's own test):**

**Result — RED, on (b) only (re-confirmed):**
```
AssertionError: expected 'No student account linked yetWe could…' to contain 'C4 In Scope'
```

Both reverted; suite green after each.

### Criterion 5a — `user === null` strictly precedes the `activeSeason.status` switch

**Mutation:** moved the `user === null` check from before the `switch` to
inside the `'ready'` case.

**Result — RED (re-confirmed, existing "shows a sign-in prompt when
signed out" test, no flush):**
```
AssertionError: expected 'Loading Home…' to contain 'Sign in to view Home'
```
Reverted; suite green (51/51).

### Criterion 5b — structural, not mutation-provable (unchanged)

Still true after round 2: the identity tier
(`ResolvedStudentHomeView`, formerly reached via
`StudentHomeIdentityGate`, now rendered directly) is a child mounted only
inside the outer wrapper's `'ready'` case JSX — a type-level consequence,
not a separately-testable runtime behavior.

### Criterion 6a/6b — unchanged mechanism, re-verified

6a (fail-loud outside `<SeasonProvider>`): unmutated, passes against the
real, unmodified `useActiveSeason()` (the throw is `SeasonProvider.tsx`'s
own, a forbidden file here).

6b mutation: `seasonId={activeSeason.season.id}` →
`seasonId={PLACEHOLDER_SEASON_ID}`.

**Result — RED, exactly this criterion's isolated assertion plus
criterion 11 (incidental, legitimate — re-confirmed identical to round
1):**
```
 × criterion 6b's own isolated seasonId assertion
 × criterion 11 (also exercises real end-to-end season flow)
 Tests  2 failed | 49 passed (51)
```
Reverted; suite green.

### Criterion 7 — identity tier's own DES-12 states, three independent sub-mutations

All three re-run against the round-2 code (the identity tier's copy
didn't change in round 2, only its data shape did):

**(i) loading** — `"Finding your student record…"` → `"Loading Home…"`.
**Result — RED on (i) only, (ii)/(iii) green (re-confirmed):**
```
AssertionError: expected 'Loading Home…' to contain 'Finding your student record'
```

**(ii) error** — banner copy → content tier's own `"Couldn't load
Home"`/description.
**Result — RED on (ii) only, (i)/(iii) green (re-confirmed):**
```
AssertionError: expected 'Couldn\'t load HomeSomething went wro…' to contain 'Couldn\'t find your student record'
```

**(iii) null** — `EmptyState` title → `"Nothing scheduled"`.
**Result — RED on (iii) only, (i)/(ii) green (re-confirmed):**
```
AssertionError: expected 'Nothing scheduledWe couldn\'t find a …' to contain 'No student account linked yet'
```

All three independently reverted; suite green after each.

### Criterion 8 — own-row query scoped only by the resolved student's own id `[ROUND 2: re-scoped to the new view/column]`

**Mutation applied directly to the real, round-2 loader**
(`queryStudentGoalProjectionById` in `src/lib/supabase/loaders/students.ts`):
```
- .from('v_student_goal_projection')
-  .select('team_id, goal_hours, confirmed_hours, planned_hours')
-  .eq('student_id', studentId)
-  .maybeSingle();
+ .from('v_student_goal_projection')
+  .select('team_id, goal_hours, confirmed_hours, planned_hours')
+  .maybeSingle();
```
**Result — RED, on the intended `eqSpy` assertion, NOT a `TypeError`
(re-confirmed, MINOR fix still holds under the new table/columns):**
```
AssertionError: expected "spy" to be called 1 times, but got 0 times
 ❯ src/lib/supabase/loaders/students.test.ts:78:19
 ❯ src/lib/supabase/loaders/students.test.ts:129:19
2 failed | 4 passed (6)
```
(`tsc --noEmit` also correctly flagged the now-unused `studentId`
parameter under this mutation, same as round 1.) Reverted; `tsc` clean;
suite green (6/6).

**Inspection-only half, re-confirmed:** `git diff 477dd9e 934f4ce`
confirms no new role/family authorization logic anywhere in either
round's diff. RLS is the sole authorization boundary; the `.eq('student_id',
studentId)` filter is defense-in-depth — see §3 above for the fuller RLS
composition record (reasoned, not measured).

### Criterion 9 — no metric-math re-derivation (constitution item 3)

Re-confirmed for the round-2 diff — see §7 above for the full proof
(round 2 re-ran the same diff-based check, not just re-asserted round 1's
finding).

### Criterion 10 — goal-hours denominator + confirmed/planned hours, all verbatim passthroughs `[ROUND 2, redesigned]`

Round 1's version of this criterion tested "does a `null` override fall
back to the season default, does a real override win" — a design that
assumed the coalesce happened in TypeScript. That design is gone; the
coalesce now happens entirely in SQL, so round 2's version of this
criterion instead proves: **the rendered `goalHours`/`confirmedHours`/
`plannedHours` come verbatim from `resolveStudentScope`, never from the
season default and never from the still-fixture `loadData`'s own
`data.studentHours`/`computePlannedHours(...)`.**

Two tests: (1) `resolveStudentScope` returns `goalHours: 8,
confirmedHours: 2, plannedHours: 1`, while the season's own
`defaultGoalHours` is a deliberately different, unused `999`, and
`loadData`'s own `data.studentHours.confirmedHours` is a deliberately
different, unused `999` — proving neither leaks into the render. (2) A
second, differently-valued `resolveStudentScope` result (`goalHours: 40,
confirmedHours: 10, plannedHours: 5`) renders different real numbers,
proving nothing is hardcoded. Both assert the visible label, `aria-
valuemax`, and `aria-valuetext` via `container.innerHTML` (both
`.getAttribute(...)` and literal substring checks), per the packet's own
"enumerate over `innerHTML`" instruction.

**Mutation:** reverted the content tier's three destructured props to
unused shadow bindings (`goalHours: goalHoursPropMutation10`, etc.) and
recomputed `confirmedHours`/`plannedHours`/`goalHours` locally from
`data.studentHours`/`computePlannedHours(...)`/`resolveGoalHours(data.goalHoursOverride,
data.defaultGoalHours)` — the exact round-1 sourcing.

**Result — RED, both tests, all three surfaces regress to the fabricated
`100` (`data.defaultGoalHours`, `buildDataFixture`'s own default):**
```
AssertionError: expected '100' to be '8'    (test 1)
AssertionError: expected '100' to be '40'   (test 2)
2 failed | 49 skipped (51)
```
Reverted; suite green (51/51).

## 9. Criterion 11 — render-and-enumerate over `container.innerHTML` `[ROUND 2: row 5 reclassified]`

Rendered with the **default** `loadData` (`defaultLoadStudentHomeData`,
unmodified), a real season (`season-real-c11`, `defaultGoalHours: 999` —
deliberately different from `resolveStudentScope`'s own `goalHours`
below, to prove it isn't used), resolved student `student-real-c11`,
resolved team `team-real-c11`, `resolveStudentScope` returning
`{teamId: 'team-real-c11', goalHours: 50, confirmedHours: 5,
plannedHours: 2}`, `nowFn = FIXTURE_REFERENCE_NOW`. Full
`container.innerHTML` dump re-captured (throwaway local test file,
`__t176_c11_dump2.test.tsx`, written, run, deleted, never committed) and
cross-checked against the table below.

| # | Exact string(s) on screen | Origin | Verdict |
|---|---|---|---|
| 1 | `Hi Ada Reyes` | `defaultLoadStudentHomeData.displayName` literal, ignores both params | **STAYS FABRICATED** — lead item (§3 decision 2, unchanged) |
| 2 | `5 / 50 h (10%)` visible label | `resolveStudentScope`'s own `goalHours`/`confirmedHours` (real, from `v_student_goal_projection`) | **REAL** — never the season default (999), never `FIXTURE_DEFAULT_GOAL_HOURS` (100) |
| 3 | `aria-valuemax="50"` | same real fields | **REAL** |
| 4 | `aria-valuetext="5 / 50 h (10%)"` | same real fields | **REAL** |
| 5 | `5 h confirmed + 2 h planned` | **RECLASSIFIED, round 2:** `resolveStudentScope`'s own `confirmedHours`/`plannedHours` (`v_student_goal_projection`'s own `confirmed_hours`/`planned_hours` columns) — no longer "honestly empty via a fixture-null `data.studentHours`"; genuinely real numbers from the same single read as row 2-4 | **REAL** |
| 6 | `Participation: —` | `participation` → `null` (still-fixture, unchanged by this task) | honestly empty |
| 7 | `Nothing scheduled` + helper copy | `events` → `[]` (real season id never matches `FIXTURE_EVENTS`' own hardcoded literal) | honestly empty |
| 8 | `You're all caught up` (Sign-up opportunities `EmptyState`, scoped via `[role="group"]`) | `opportunities` → `[]` | honestly empty |
| 9 | `You're all caught up. Nothing needs your attention right now.` (quiet-greeting hero, full sentence, not inside any `role="group"`) | `selectHeroState(false, 0)` | honestly empty, positive-reassurance string stated explicitly |
| 10 | *(absent)* live check-in card, unanswered-RSVP hero, all list rows | joins miss once `events` is `[]` | honestly empty |

Key excerpts, verbatim from the real re-capture:
```html
<span ...>5 / 50 h (10%)</span>
<div role="progressbar" aria-valuenow="5" ... aria-valuemax="50" ...
     aria-valuetext="5 / 50 h (10%)" ...>
<span ...>5 h confirmed + 2 h planned</span>
<span ...>Participation: —</span>
<h3 ...>Nothing scheduled</h3>
<h3 ...>You're all caught up</h3>
```
`container.textContent.match(/You're all caught up/g)` still has length
**2** (rows 8/9); scoped by `[role="group"]` ancestor in the test, per the
enumeration hazard.

Only row 5's classification changed from round 1's table (was: `0 h
confirmed + 0 h planned`, "honestly empty," fixture-null-driven). Every
other row confirmed identical to the round-1/gate-measured table.

## 10. Follow-up ledger rows (item 20) `[12b's quote fixed]`

**12a — `StudentHome`'s T173-sibling row** (unchanged from round 1):

> `StudentHome`'s remaining fixture surfaces, closed by T176 for
> `studentId`/`teamId`/`seasonId` and the goal-hours/confirmed/planned
> triple (round 2 widened this from "the denominator only" to the full
> `v_student_goal_projection` read — one single query, not three). Lead
> item: `Hi Ada Reyes` — `defaultLoadStudentHomeData` ignores both its
> parameters, so every real signed-in student's Home is greeted by a
> fabricated human name, unconditionally; T176 does not touch it. Also
> stays fabricated: `events`/`sessions`/`rsvps` (Next up + Sign-up
> opportunities always empty for a real season, since `FIXTURE_EVENTS`'
> `seasonId` field is a hardcoded literal a real season id never
> matches), `participation` (`null` for any real, non-fixture-keyed
> student id, showing "Participation: —" regardless of the student's
> actual data). `LoadStudentHomeDataFn` has no real implementation
> beyond the fields `v_student_goal_projection` now covers. Same defect
> class as `CoachHome`'s pre-T173 state and `ParentHome`/T181.

**12b — the `student_teams` follow-up** (§2b, quote discontinuity fixed):

> `StudentHome` scopes `teamId` off the legacy `students.team_id`
> primary-team column (`v_student_goal_projection`'s own `team_id`
> column, read via `resolveStudentScope`, `loaders/students.ts`), not
> `student_teams` ACTIVE memberships. Per
> `supabase/migrations/20260721000000_student_teams.sql`'s own header —
> two separate, non-contiguous verbatim fragments, quoted as such: line
> 2, "a student may belong to more than one team"; and lines 10-12,
> "[`students.team_id`] remains the legacy/primary-team read path until a
> later SCH-03+ packet migrates readers over to this junction." Every
> other current reader (`v_student_participation`/`v_team_hours`,
> `dashboard_views.sql`, `kpi_views.sql`) has already migrated.
> Consequence: a dual-team-member student silently loses her SECOND
> team's meetings, live check-in, and sign-up opportunities on this page
> — the same defect class T120 already fixed once on
> `ParticipationTab.tsx`. Deliberate, disclosed narrowing (this task's
> own packet's bounded decision, not an oversight); moving `StudentHome`'s
> scoping onto `student_teams` ACTIVE memberships is filed as its own
> follow-up.

Both labeled **non-mutation-provable — documentation deliverables, not
tests** (criterion 12, MAJOR 8).

## 11. Criterion 13 — `DashboardPage.test.tsx` stays green `[ROUND 2: mock shape updated]`

**Non-mutation-provable — a no-regression check.** All 5 pre-existing
tests pass unmodified (`npx vitest run src/pages/home/DashboardPage.test.tsx`
→ `5 passed`). The only round-2 change to this file was updating the
`resolveStudentScope` mock's return shape to match the new
`{teamId, goalHours, confirmedHours, plannedHours}` type (was
`{teamId, goalHoursOverride}`) — still harness-only, zero `it(`/`expect(`
lines touched:

```diff
     resolveStudentScope: async () => ({
       teamId: 'team-fixture-dashboardpage',
-      goalHoursOverride: null,
+      goalHours: 100,
+      confirmedHours: 0,
+      plannedHours: 0,
     }),
```

## 12. Criterion 14 — blast radius, actual numbers `[unchanged from round 1]`

Round 2 did not change which pre-existing tests break without the fix —
the underlying architecture (three tiers, real identity resolution) is
the same; only the shape of the goal-hours/hours data changed. Numbers
re-confirmed:

- **`StudentHome.test.tsx`: 13 of 33 pre-existing tests broke**, all
  render-path tests; the 20 pure-function tests unaffected.
- **`DashboardPage.test.tsx`: 1 of 5.**
- **Nothing else in the repo broke.**
- Full suite: 66→67 test files (+1, `students.test.ts`), 1567→1591 tests
  (+24). Round 2 redistributed test bodies within the same files (no net
  test-count change from round 1: still 51 in `StudentHome.test.tsx`, 6
  in `students.test.ts`, 5 in `DashboardPage.test.tsx`).

Two of the 13 pre-existing tests needed a `loadData`-VALUE change (the
`fixtureLoadData`/`PLACEHOLDER_SEASON_ID_FOR_TESTS` wrapper, mirroring
`CoachHome.test.tsx`'s own pre-existing, T053-era convention — unchanged
from round 1). **Round 2 additionally required two of those SAME tests
("renders the shipped default fixture data end to end" and the BEH-02
"confirmed/planned hours never summed" test) to gain an explicit
`resolveStudentScope` override** (previously they relied on the harness
default or an explicit `teamId` prop) — because `confirmedHours`/
`plannedHours`/`goalHours` moved from being fixture-derived
(`data.studentHours`/`computePlannedHours`) to being
`resolveStudentScope`-sourced, and an explicit `teamId` now takes the
`resolveStudentIdentity` bypass path (confirmedHours/plannedHours default
to `0`/`0`), which would have made their own pre-existing "62 h
confirmed"/"3 h planned" assertions structurally unreachable. **This is a
genuine assertion-adjacent test-body change** (not touching any
`expect(...)` line's text, but changing which prop supplies the
underlying data) — disclosed here explicitly rather than folded silently
into "harness-only."

## 13. All five gates `[ROUND 2: re-run against 934f4ce]`

Baseline unchanged from round 1 (computed at merge base `477dd9e` via
`git stash push -u`/`pop`, item 19c — not re-measured since nothing
upstream changed):

| Gate | Baseline (`477dd9e`) | Round 2 (`934f4ce`) | Delta |
|---|---|---|---|
| `npx tsc --noEmit` | 0 errors | 0 errors | none |
| `npx vite build` | succeeds | succeeds (`✓ built in 5.09s`) | none (asset hash churn only) |
| `npx prettier --check ...` | all files pass | all files pass (after `prettier --write` on `students.test.ts` post-rewrite) | none, once formatted |
| `npx eslint .` | 0 errors, 356 warnings | 0 errors, 357 warnings | **+1 warning**, same benign pre-existing class as round 1 (the `resolveStudentIdentity` export) — `StudentHomeIdentityGate`'s deletion (round 2) removed no warning since it was never exported |
| `npx vitest run` | 66 files / 1567 tests, all green | 67 files / 1591 tests, all green | +1 file, +24 tests, 0 regressions (same totals as round 1 — round 2 redistributed test bodies, no net count change) |

`format:check` genuinely failed once during round 2 too (`students.test.ts`
after its full rewrite) — fixed with `prettier --write`, re-verified clean
before committing.

## 14. Deferrals / scope discipline

Nothing beyond the goal-hours/confirmed/planned triple (one single read,
per the coordinator's own explicit round-2 instruction) was brought into
scope. `events`/`sessions`/`rsvps`/`participation`/`displayName` remain
exactly as fixture-fed as before this task. `loaders/meetings.ts` was not
edited. `MeetingsList.tsx`/`MeetingsList.test.tsx` were not edited. No
migration was added, edited, or needed (the view already existed,
shipped by a sibling task, T124).

## 15. Anything not verified — stated plainly `[ROUND 2: RLS composition explicitly flagged]`

- **The RLS composition for `v_student_goal_projection` under a
  `student`-role caller is reasoned, not measured** — no live Supabase in
  this environment. See §3 above for the full chain of policy citations.
  This is the single largest unverified claim in this round's work;
  explicitly flagged for the checker to confirm independently rather than
  accepted on my own reasoning, per the coordinator's own instruction.
- I did not independently re-verify the `MeetingsList.tsx:698`/`:706`
  citation beyond reading those exact lines directly (unchanged from
  round 1).
- The `supabase/migrations/20260721000000_student_teams.sql` citation
  was read directly by me (unchanged from round 1), and the exact line
  numbers for both non-contiguous fragments (line 2; lines 10-12) were
  re-verified directly against the file for this round's correction.
- I did not run this task's changes against a real, configured Supabase
  instance (no `.env` exists in this environment).

## 16. Dispute filing

**None, either round.** Round 1's disclosed "deviation" (§3, criterion
2/4's mutation targeting `resolveStudentIdentity`'s own internal
short-circuit rather than the packet's literal "remove the bypass
branch" wording) was independently judged by the checker to be the
correct reading of §6's own prescribed shape, not an actual deviation —
noted here for the record, not re-litigated. Round 2's MAJOR was the
coordinator's own disclosed premise error, fixed as instructed; nothing
about it constitutes a packet/tree mismatch I would file a dispute over.

**Not marking this task complete — the same checker re-verifies it, per
instruction.**
