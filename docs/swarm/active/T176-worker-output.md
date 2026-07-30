# T176 — Worker Output

**Worker:** sonnet (per packet §8). **Packet revision pinned:** 2, commit
`477dd9ec2f92cab7da46465a330a61841e0e18a1` — confirmed via
`git log -1 --format=%H -- docs/swarm/active/T176-worker-packet.md` before
reading it, matched exactly.

## 1. Merge result

```
git fetch origin
git merge origin/claude/swarm-plan-zl575z
```

Fast-forward, `f7ff055..477dd9e`, no conflicts. 19 files changed (T155/T157
history, both T176 packet artifacts, the audit inbox files, the ledger,
verification log). `npm ci` succeeded (340 packages, 9 pre-existing
vulnerabilities unrelated to this task, not touched).

## 2. Final commit

`9ccefcd98145df40a2e6019fcbb51ac7ab494585` — `git log -1 --format=%H` after
committing confirms `HEAD` moved from `477dd9e` to this SHA. Working tree is
clean at this SHA (`git status --short` empty) after every mutation
experiment below was reverted with `git checkout -- <file>` against this
same commit (item 23: every mutation applied, run, and reverted inside this
worktree only; nothing was ever written to
`/home/user/volt_task_tracker_rewrite`).

Files changed (5): `src/pages/home/StudentHome.tsx`,
`src/pages/home/StudentHome.test.tsx`, `src/pages/home/DashboardPage.test.tsx`,
`src/lib/supabase/loaders/students.ts`, `src/lib/supabase/loaders/students.test.ts`
(new).

## 3. Design summary (§6 prescribed shape, followed as written)

Three tiers, exactly as prescribed:

1. **`StudentHome`** (outer): `useAuth()` + `useActiveSeason()` called
   unconditionally; `user === null` checked strictly before the
   `activeSeason.status` switch; on `'ready'`, renders
   `StudentHomeIdentityGate`, passing `activeSeason.season.id` and
   `activeSeason.season.defaultGoalHours` through. No more `seasonId` prop
   (same T155/`CoachHome` precedent — grep-confirmed no test or production
   call site ever passed one).
2. **Identity-resolution tier** — `StudentHomeIdentityGate` (no hooks,
   pure branch: mounts `ResolvedStudentHomeView` unless BOTH
   `explicitStudentId` and `explicitTeamId` are supplied, in which case it
   renders `StudentHomeContent` directly with `goalHoursOverride: null`) +
   `ResolvedStudentHomeView` (calls `useLoadState` on the new exported
   `resolveStudentIdentity(viewer, explicitStudentId, explicitTeamId,
   resolveStudentId, resolveStudentScope)`, owns its own distinct
   loading/error/no-student-linked DES-12 copy).
3. **Content tier** — `StudentHomeContent`: the pre-T176 `StudentHome` body,
   parameterized by real `studentId`/`teamId`/`seasonId`/
   `seasonDefaultGoalHours`/`goalHoursOverride`, the last two feeding
   `resolveGoalHours` instead of `data.defaultGoalHours`/
   `data.goalHoursOverride`.

**Deviation from a literal reading of §7 criterion 2/4's mutation, disclosed
(item 6):** the packet's own mutation text ("remove the bypass branch so
resolution always fires") assumes the explicit-id short-circuit lives only
in the outer container (`MeetingsList.tsx`'s own precedent:
`ResolvedStudentMeetingsView` unconditionally calls `resolveStudentId`,
and `StudentMeetingsViewContainer`'s branch is the ONLY thing preventing
that call). This implementation instead follows §6's own literal
instruction more strongly — "resolve `studentId` (skip the call if
`explicitStudentId` is given)" is built as a `??` short-circuit **inside**
`resolveStudentIdentity` itself, not only in the outer gate. Consequence:
removing `StudentHomeIdentityGate`'s skip-mount branch alone does **not**
break criterion 2(a) (measured — see §5 below), because
`resolveStudentIdentity`'s own internal short-circuit is a second,
independent guard. I mutated the **actual** call-site instead (the `??`
expression inside `resolveStudentIdentity`) to reproduce "resolution always
fires," and it failed exactly as intended. Net effect: this implementation
is more defense-in-depth than the literal precedent, at the cost of the
packet's mutation description not applying verbatim to this exact code
location. Flagged for the checker.

## 4. `loaders/students.ts` — additive-only confirmation

Diff only **appends** after `updateStudent` (the last pre-existing export);
no existing line was touched. New exports: `StudentScopeDbRow` (new
interface, not a reuse of `StudentDbRow`), `queryStudentScopeById`,
`makeResolveStudentScope`, `resolveStudentScope`. Confirmed via
`git diff 477dd9e 9ccefcd -- src/lib/supabase/loaders/students.ts` that
`StudentDbRow`, `TeamDbRow`, `InviteDbRow`, `mapStudentDbRowToStudentRow`,
`queryStudents`, `makeLoadStudentsTabData`, `makeSetStudentActive`,
`makeCreateStudent`, `makeUpdateStudent` are byte-identical to the merge
base.

`src/lib/supabase/loaders/students.test.ts` is a **new file**, scoped to
`makeResolveStudentScope`/`resolveStudentScope` only — explicitly **not** a
full coverage sweep of `loaders/students.ts` (no ledger row currently
claims that broader scope; disclosed in the file's own header comment).

## 5. Per-criterion mutation evidence

Every mutation below was applied directly to the committed source at
`9ccefcd`, run, captured, then reverted with `git checkout -- <file>` and
re-verified green (`git status --short` empty, `npx tsc --noEmit` clean,
full suite green) before moving to the next. All experiments ran in this
worktree only (item 23).

### Criterion 1 — real `studentId` reaches `loadData`

Positive+paired test added: spy on `loadData`, inject
`resolveStudentId: async () => 'student-fixture-resolved'`, assert
`loadDataSpy.mock.calls[0][0] === 'student-fixture-resolved'` and
`!== PLACEHOLDER_CURRENT_STUDENT_ID`.

**Mutation:** `const studentId = explicitStudentId ?? (await
resolveStudentId(viewer));` → `const studentId =
PLACEHOLDER_CURRENT_STUDENT_ID;`

**Result — RED (confirmed):**
```
AssertionError: expected 'student-placeholder-current-viewer' to be 'student-fixture-resolved'
 ❯ src/pages/home/StudentHome.test.tsx:1143:44
```
(Criterion 11's own render-and-enumerate test also went red as an
incidental, correct side effect — its `confirmedHours` assertion is
sensitive to which student id resolves, since the placeholder id matches
the shipped fixture's `FIXTURE_STUDENT_HOURS` row.)

Reverted; `git status --short` empty; suite green.

### Criterion 2 — explicit `studentId` bypasses `resolveStudentId`, paired (BLOCKER 2 fix)

Test added: (a) `resolveStudentIdSpy` never called, (b) `loadData` receives
the explicit value AND two different explicit ids render two different
`displayName`s.

**Mutation A ("resolution always fires" — see §3's disclosed deviation for
why this targets `resolveStudentIdentity`'s own short-circuit rather than
`StudentHomeIdentityGate`'s mount-skip):**
```
- const studentId = explicitStudentId ?? (await resolveStudentId(viewer));
+ const resolvedStudentIdMutation = await resolveStudentId(viewer);
+ const studentId = explicitStudentId ?? resolvedStudentIdMutation;
```
**Result — RED, on the intended (a) assertion:**
```
AssertionError: expected "spy" to not be called at all, but actually been called 1 times
 ❯ src/pages/home/StudentHome.test.tsx:1161:37
```

**Mutation B (vacuity probe — the gate's own BLOCKER-2-finding probe):**
`resolveStudentIdentity` body replaced with `return null;` (identity tier
disabled entirely).

**Result — RED, on (b) only, (a) stays green (nothing rendered, `loadData`
never called, matching the probe's own prediction):**
```
AssertionError: expected 'No student account linked yetWe could…' to contain 'Hi Student student-explicit-alpha'
 ❯ src/pages/home/StudentHome.test.tsx:1162:35
```

Both reverted; suite green after each.

### Criterion 3 — real, resolved `teamId` reaches team-scoped widgets, three distinct non-placeholder ids (BLOCKER 1 fix)

Test uses `'team-fixture-alpha'` (in-scope, injected via
`resolveStudentScope`) / `'team-fixture-beta'` (excluded) — both distinct
from each other and from `PLACEHOLDER_CURRENT_TEAM_ID` (asserted directly
in the test), and does **not** reuse `StudentHome.tsx`'s own shipped
Titans-scope fixture (revision-1's BLOCKER).

**Mutation:** the resolved-path return statement changed from `teamId:
scope.teamId` to `teamId: PLACEHOLDER_CURRENT_TEAM_ID`.

**Result — RED, genuinely (the in-scope event no longer matches):**
```
AssertionError: expected 'Hi Ada Reyes...' to contain 'In-Scope Team Meeting C3'
 ❯ src/pages/home/StudentHome.test.tsx:1233:35
```
(Confirms the BLOCKER-1 fix: unlike revision 1's version, this mutation
genuinely fails — the in-scope fixture team id is never
`PLACEHOLDER_CURRENT_TEAM_ID`, so reverting to it breaks the match.)

Reverted; suite green.

### Criterion 4 — explicit `teamId` bypasses `resolveStudentScope` entirely, paired (BLOCKER 2 fix extended)

Same three-distinct-string discipline (`'team-explicit-c4'` /
`'team-fixture-other-c4'`, both `!== PLACEHOLDER_CURRENT_TEAM_ID`).

**Mutation A (resolution always fires):** moved `const scope = await
resolveStudentScope(studentId);` to execute unconditionally, before the
`explicitTeamId !== undefined` check.

**Result — RED, on the intended (a) assertion:**
```
AssertionError: expected "spy" to not be called at all, but actually been called 1 times
 ❯ src/pages/home/StudentHome.test.tsx:1294:40
```

**Mutation B (vacuity probe, same `resolveStudentIdentity → return null`
mutation as criterion 2's probe):**

**Result — RED, on (b) only:**
```
AssertionError: expected 'No student account linked yetWe could…' to contain 'C4 In Scope'
 ❯ src/pages/home/StudentHome.test.tsx:1295:35
```

Both reverted; suite green after each.

### Criterion 5a — `user === null` strictly precedes the `activeSeason.status` switch

**Mutation:** moved the `user === null` check from before the `switch` to
inside the `'ready'` case (after `switch`'s `'loading'`/`'none'`/`'error'`
cases).

**Result — RED, exactly as the packet predicted (existing "shows a sign-in
prompt when signed out" test, rendered synchronously, no flush):**
```
AssertionError: expected 'Loading Home…' to contain 'Sign in to view Home'
 ❯ src/pages/home/StudentHome.test.tsx:800:35
```

Reverted; suite green (51/51).

### Criterion 5b — season switch precedes identity-resolution mounting

**STRUCTURAL, not mutation-provable**, per the packet's own classification
(MAJOR 8). The identity tier (`StudentHomeIdentityGate`) is a child
rendered only inside the `'ready'` case's JSX — this is a type-level
consequence of the JSX tree, not a separately-testable runtime behavior. No
test written for it; stated here instead, as instructed.

### Criterion 6a — fail-loud outside `<SeasonProvider>`

New tests added (mirroring T155's own criterion-4 pattern): a
class-based error boundary catches the thrown error from `<StudentHome />`
rendered with no `<SeasonProvider>` ancestor, asserting the exact message;
a companion test confirms the same probe does **not** throw when wrapped.
Both pass against the real (unmutated) `useActiveSeason()` — this is
inherently mutation-proof by construction (the throw is
`SeasonProvider.tsx`'s own, unmodified by this task); confirmed passing,
not separately mutated (mutating `SeasonProvider.tsx` is out of this
task's Allowed Files).

### Criterion 6b — `seasonId` from `useActiveSeason()`, isolated assertion

Test asserts `loadDataSpy.mock.calls[0]?.[1]` (the second argument) in
isolation, per the packet's own MAJOR-8 fix (not the combined
`(studentId, seasonId)` assertion revision 1 used, which the gate measured
going red for the wrong reason on 6/14 tests during mutation 1).

**Mutation:** `seasonId={activeSeason.season.id}` →
`seasonId={PLACEHOLDER_SEASON_ID}` (hardcoded literal, matching MINOR fix:
`PLACEHOLDER_SEASON_ID` is module-private, not exported — hardcoded the
literal in the mutation rather than exporting it, per the packet's own
disclosed option).

**Result — RED, exactly this criterion's isolated assertion (plus criterion
11, an incidental but legitimate consequence since that test also exercises
real end-to-end season flow through the default fixture loader); every
other test — including the DES-12 loading/error tests, which use
non-resolving/rejecting `loadData` functions that ignore their arguments —
stayed green:**
```
 × <StudentHome /> T176 -- seasonId sourced from useActiveSeason(), asserted in isolation (criterion 6b) > ...
   → expected ... (isolated seasonId assertion)
 × <StudentHome /> T176 -- render-and-enumerate ... (criterion 11) > ...
 Tests  2 failed | 49 passed (51)
```

Reverted; suite green (51/51).

### Criterion 7 — identity tier's own DES-12 states, three independent sub-mutations

Three separate copy-collision mutations, run and reverted one at a time,
each targeting only its own sub-case:

**(i) loading** — text changed from `"Finding your student record…"` to
`"Loading Home…"` (the content tier's own text).
**Result — RED on (i) only, (ii) and (iii) stayed green (2 passed):**
```
AssertionError: expected 'Loading Home…' to contain 'Finding your student record'
 ❯ src/pages/home/StudentHome.test.tsx:1380:35
```

**(ii) error** — banner title/description changed to the content tier's own
`"Couldn't load Home"` copy.
**Result — RED on (ii) only, (i) and (iii) stayed green (2 passed):**
```
AssertionError: expected 'Couldn\'t load HomeSomething went wro…' to contain 'Couldn\'t find your student record'
 ❯ src/pages/home/StudentHome.test.tsx:1396:35
```

**(iii) null** — `EmptyState` title changed from `"No student account linked
yet"` to `"Nothing scheduled"` (the content tier's own Next-up empty-state
title).
**Result — RED on (iii) only, (i) and (ii) stayed green (2 passed):**
```
AssertionError: expected 'Nothing scheduledWe couldn\'t find a …' to contain 'No student account linked yet'
 ❯ src/pages/home/StudentHome.test.tsx:1412:35
```

Confirms the packet's own MINOR note explicitly: the null-case (iii)
genuinely survives a mutation aimed at the (i)/(ii) copy-collision cases,
and vice versa — all three are independent, not redundant. Each reverted;
suite green after each.

### Criterion 8 — own-row query scoped only by the resolved student's own id

**Mutation-provable half:** stub exposes `.maybeSingle()` at BOTH the
filtered chain position (after `.eq(...)`) and directly on `.select(...)`'s
own result (the MINOR fix). Mutation applied directly to the real loader
(`queryStudentScopeById` in `src/lib/supabase/loaders/students.ts`), not
just simulated in the test:
```
- .eq('id', studentId)
  .maybeSingle();
+ // .eq(...) dropped
  .maybeSingle();
```
**Result — RED, on the intended `eqSpy` assertion, NOT a `TypeError`
(confirmed the exact failure mode the MINOR fix requires):**
```
AssertionError: expected "spy" to be called 1 times, but got 0 times
 ❯ src/lib/supabase/loaders/students.test.ts:59:19
 ❯ src/lib/supabase/loaders/students.test.ts:96:19
2 failed | 4 passed (6)
```
(`tsc --noEmit` also correctly flagged the now-unused `studentId` parameter
under this mutation — expected, not a bug in the mutation.)

Reverted; `git checkout -- src/lib/supabase/loaders/students.ts`; `tsc`
clean; suite green (6/6).

**Inspection-only half, not mutation-provable, labeled as such:** diff
review (`git diff 477dd9e 9ccefcd`) confirms no new role/family
authorization logic was added anywhere in this task's diff. RLS
(`own_or_linked_read` on `students`, `supabase/migrations/
20260717000002_rls.sql`) is the sole authorization boundary; the new
`.eq('id', studentId)` filter is defense-in-depth, cited as such in
`loaders/students.ts`'s own new doc comment.

### Criterion 9 — no metric-math re-derivation (constitution item 3)

**Inspection-only, not mutation-provable, labeled as such.**
`git diff 477dd9ec2f92cab7da46465a330a61841e0e18a1 9ccefcd -- src/pages/home/StudentHome.tsx
| grep -E "^\+function|^\+export function|^-function|^-export function"`
shows only four NEW functions added (`StudentHomeLoadingSkeleton`,
`StudentHomeContent`, `ResolvedStudentHomeView`, `StudentHomeIdentityGate`)
and the pre-existing `StudentHome` renamed/rewritten as the new outer
wrapper. `resolveGoalHours`, `hoursVsGoalPercent`, `computePlannedHours`,
`buildNextUp`, `getUnansweredOutreachOpportunities`,
`selectLiveMeetingSession` do not appear in that grep at all — their
definitions are byte-unchanged. Only their CALL SITES changed which
values are passed in (`data.goalHoursOverride, data.defaultGoalHours` →
`goalHoursOverride, seasonDefaultGoalHours`), confirmed by the same diff.

### Criterion 10 — goal-hours denominator real across all three DOM surfaces (§2c)

Two tests: `defaultGoalHours: 7` (season fixture, deliberately not `100`)
with a `null` override (falls to 7) and a real override `12` (wins). Both
assert the visible `ProgressBar` label (via `container.innerHTML`),
`aria-valuemax`, and `aria-valuetext` — checked both via
`.getAttribute(...)` AND a literal `container.innerHTML.toContain('aria-
valuemax="7"')`/`'aria-valuetext="..."'` substring check, per the packet's
own "enumerate over `innerHTML`, not `textContent`" instruction.

**Mutation:** `resolveGoalHours(goalHoursOverride, seasonDefaultGoalHours)`
→ `resolveGoalHours(data.goalHoursOverride, data.defaultGoalHours)`.

**Result — RED, both tests, all three surfaces regress to the fabricated
`100`:**
```
AssertionError: expected '100' to be '7'   (null-override test)
AssertionError: expected '100' to be '12'  (real-override test)
2 failed | 49 skipped (51)
```

Reverted; suite green (51/51).

## 6. Criterion 11 — render-and-enumerate over `container.innerHTML`

Rendered with the **default** `loadData` (`defaultLoadStudentHomeData`,
unmodified), a real season (`season-real-c11`, `defaultGoalHours: 45`),
resolved student `student-real-c11`, resolved team `team-real-c11`,
`nowFn = FIXTURE_REFERENCE_NOW`. Full `container.innerHTML` dump captured
via a throwaway local test file (`src/pages/home/__t176_c11_dump.test.tsx`,
written, run once with `console.log(container.innerHTML)`, then deleted —
never committed) and cross-checked against the table below; every row
confirmed matching the gate's own measured table. Key excerpts, verbatim
from the real capture:

```html
<h1 ...>Hi Ada Reyes</h1>
<span ...>You're all caught up. Nothing needs your attention right now.</span>
...
<span ...>Outreach hours vs. your goal</span><span ...>0 / 45 h (0%)</span>
...
<div role="progressbar" aria-valuenow="0" aria-valuemin="0" aria-valuemax="45"
     aria-labelledby="_r_2_" aria-valuetext="0 / 45 h (0%)" ...>
...
<span ...>0 h confirmed + 0 h planned</span>
<span ...>Participation: —</span>
...
<h3 ...>Nothing scheduled</h3>
<div ...>Your team's next meetings, and the outreach events you're going to, will show up here.</div>
...
<h3 ...>You're all caught up</h3>
<div ...>Outreach events awaiting your response will show up here.</div>
```
No `Meeting live now`, no `events to answer` text anywhere in the full
dump.

| # | Exact string(s) on screen | Origin | Verdict — confirmed |
|---|---|---|---|
| 1 | `Hi Ada Reyes` | `defaultLoadStudentHomeData.displayName` literal, ignores both params | **STAYS FABRICATED** — lead item (§3 decision 2) |
| 2 | `0 / 45 h (0%)` visible label | `useActiveSeason().season.defaultGoalHours` (real, `45`, not `100`) | **FIXED by criterion 10** |
| 3 | `aria-valuemax="45"` | same real field | **FIXED** |
| 4 | `aria-valuetext="0 / 45 h (0%)"` | same real field | **FIXED** |
| 5 | `0 h confirmed + 0 h planned` | `studentHours` → `null` (real student id ≠ shipped fixture's placeholder-keyed row) | honestly empty |
| 6 | `Participation: —` | `participation` → `null` | honestly empty |
| 7 | `Nothing scheduled` + helper copy | `events` → `[]` (real season id never matches `FIXTURE_EVENTS`' own hardcoded `PLACEHOLDER_SEASON_ID` literal) | honestly empty |
| 8 | `You're all caught up` (Sign-up opportunities `EmptyState`, scoped via its own `[role="group"]`, description `"Outreach events awaiting your response will show up here."`) | `opportunities` → `[]` | honestly empty |
| 9 | `You're all caught up. Nothing needs your attention right now.` (quiet-greeting hero, full sentence, NOT inside any `role="group"`) | `selectHeroState(false, 0)` | honestly empty, but this is a positive-reassurance string rendered where the app in fact knows nothing about this real student — stated explicitly, not omitted |
| 10 | *(absent)* live check-in card, unanswered-RSVP hero, all list rows | joins miss once `events` is `[]` | honestly empty |

Confirmed the enumeration hazard directly: `container.textContent.match(/You're all caught up/g)` has length **2** (rows 8 and 9); the test scopes row 8 by its `[role="group"]` ancestor rather than a bare substring match, per the packet's own instruction.

No correction needed to the gate's own table — every row confirmed as
measured.

## 7. Constitution item 3 confirmation

**Explicitly confirmed: threading the real `seasonDefaultGoalHours`/
`goalHoursOverride` values into the existing, byte-unchanged
`resolveGoalHours` does NOT cross the MET-04/constitution-item-3 line.**
No SQL/metric arithmetic was written in TypeScript anywhere in this diff —
`resolveGoalHours` is a plain nullish-coalesce that existed, unchanged,
before this task; only WHICH two already-real scalar values are passed to
it changed (from two still-fixture `StudentHomeData` fields to
`useActiveSeason().season.defaultGoalHours` and the new
`resolveStudentScope`'s own real `goal_hours_override` column read). See
criterion 9 above for the diff-level proof.

## 8. Follow-up ledger rows (item 20 — text only; I cannot write the ledger myself)

**12a — `StudentHome`'s T173-sibling row** (lead item named first, per §3
decision 2):

> `StudentHome`'s remaining fixture surfaces, closed by T176 for
> `studentId`/`teamId`/`seasonId` and the goal-hours denominator only.
> Lead item: `Hi Ada Reyes` — `defaultLoadStudentHomeData` ignores both its
> parameters, so every real signed-in student's Home is greeted by a
> fabricated human name, unconditionally; T176 does not touch it. Also
> stays fabricated: `events`/`sessions`/`rsvps` (Next up + Sign-up
> opportunities always empty for a real season, since `FIXTURE_EVENTS`'
> `seasonId` field is a hardcoded literal that a real season id never
> matches), `studentHours`/`participation` (both `null` for any real,
> non-fixture-keyed student id, showing "0 h confirmed + 0 h planned" /
> "Participation: —" regardless of the student's actual data).
> `LoadStudentHomeDataFn` has no real implementation beyond the one field
> criterion 10 lands (the goal-hours denominator). Same defect class as
> `CoachHome`'s pre-T173 state and `ParentHome`/T181.

**12b — the `student_teams` follow-up** (§2b):

> `StudentHome` scopes `teamId` off the legacy `students.team_id`
> primary-team column (`resolveStudentScope`, `loaders/students.ts`), not
> `student_teams` ACTIVE memberships. Per
> `supabase/migrations/20260721000000_student_teams.sql`'s own header, "a
> student may belong to more than one team... `students.team_id` remains
> the legacy/primary-team read path until a later SCH-03+ packet migrates
> readers over to this junction." Every other current reader
> (`v_student_participation`/`v_team_hours`, `dashboard_views.sql`,
> `kpi_views.sql`) has already migrated. Consequence: a dual-team-member
> student silently loses her SECOND team's meetings, live check-in, and
> sign-up opportunities on this page — the same defect class T120 already
> fixed once on `ParticipationTab.tsx`. Deliberate, disclosed narrowing
> (this task's own packet's bounded decision, not an oversight); moving
> `StudentHome`'s scoping onto `student_teams` ACTIVE memberships is filed
> as its own follow-up.

Both labeled **non-mutation-provable — documentation deliverables, not
tests** (criterion 12, MAJOR 8).

## 9. Criterion 13 — `DashboardPage.test.tsx` stays green

**Non-mutation-provable — a no-regression check, per the packet's own
classification.** All 5 pre-existing tests pass unmodified (confirmed via
`npx vitest run src/pages/home/DashboardPage.test.tsx` → `5 passed`). Exact
diff (harness-only, zero `it(`/`expect(` lines touched):

```diff
+vi.mock('../../lib/supabase/loaders/meetings', async (importOriginal) => {
+  const actual = await importOriginal<typeof import('../../lib/supabase/loaders/meetings')>();
+  return {
+    ...actual,
+    resolveCurrentStudentId: async () => 'student-fixture-dashboardpage',
+  };
+});
+vi.mock('../../lib/supabase/loaders/students', async (importOriginal) => {
+  const actual = await importOriginal<typeof import('../../lib/supabase/loaders/students')>();
+  return {
+    ...actual,
+    resolveStudentScope: async () => ({
+      teamId: 'team-fixture-dashboardpage',
+      goalHoursOverride: null,
+    }),
+  };
+});
```

**Reasoning:** `DashboardPage.tsx` renders `<StudentHome />` with zero
props (unchanged, Forbidden file), so both new resolvers hit their real,
unconfigured-in-jsdom defaults unless mocked at the module level — exactly
the gate's own MAJOR-6 finding (mocking `resolveCurrentStudentId` alone is
insufficient; the new `resolveStudentScope` hop also hits the real,
unconfigured `getSupabaseClient()`). Both modules mocked together; no extra
`flushMicrotasks()` needed (the existing three flushes already cover both
added async hops, matching the gate's own measurement).

## 10. Criterion 14 — blast radius, actual numbers

Measured directly (not assumed from the packet):

- **`StudentHome.test.tsx`: 13 of 33 pre-existing tests broke**, all
  render-path tests; the 20 pure-function tests
  (`isEventInTeamScope` through `withLocalRsvpOverride`) were unaffected.
  Matches the gate's own measured baseline exactly. Fixes: (a) harness —
  `<SeasonProvider>` + default `resolveStudentId`/`resolveStudentScope`
  props added to `renderAsUser`; (b) two of the 13 tests ("renders the
  shipped default fixture data end to end" and the T129 "populated branch"
  test) additionally needed their `loadData` prop VALUE swapped from
  `defaultLoadStudentHomeData` (called directly) to a new
  `fixtureLoadData(studentId)` wrapper that pins the season id argument to
  the literal `PLACEHOLDER_SEASON_ID` — because those two tests' real
  season id (now genuinely `useActiveSeason().season.id`, not a
  placeholder default) no longer matches `FIXTURE_EVENTS`' own hardcoded
  `seasonId` literal. **This is a delta from the packet's own "zero
  assertion changes" framing for the blast radius as a whole** (it's not
  an assertion change — no `expect(...)` line changed in either test — but
  it IS a change to a test's own setup beyond `renderAsUser` itself).
  Disclosed explicitly: this exact `fixtureLoadData`/
  `PLACEHOLDER_SEASON_ID_FOR_TESTS` pattern is not new to this task —
  it mirrors `CoachHome.test.tsx`'s own pre-existing (T053-era, predating
  T155) `fixtureLoadData`/`PLACEHOLDER_SEASON_ID_FOR_TESTS` convention,
  which solves the identical problem for that sibling component and
  already existed in the merged tree before this task started.
- **`DashboardPage.test.tsx`: 1 of 5** (the `student`-role test).
  Matches the gate's own measured baseline exactly.
- **Nothing else in the repo broke.** Full suite: 66→67 test files
  (+1, the new `students.test.ts`), 1567→1591 tests (+24: 33→51 in
  `StudentHome.test.tsx`, +6 in `students.test.ts`, 5→5 unchanged in
  `DashboardPage.test.tsx`).

## 11. All five gates — baselines computed at merge base, then re-run with changes

Baselines computed by reference (item 19c: not trusted from the packet) —
`git stash push -u` at commit `9ccefcd` reverted the working tree to the
merge base `477dd9ec2f92cab7da46465a330a61841e0e18a1` for measurement, then
`git stash pop` restored this task's changes:

| Gate | Baseline (`477dd9e`) | With T176 changes | Delta |
|---|---|---|---|
| `npx tsc --noEmit` | 0 errors | 0 errors | none |
| `npx vite build` | succeeds (`✓ built in 5.88s`) | succeeds (`✓ built in 5.27s`) | none (only asset hash churn) |
| `npx prettier --check ...` (`format:check`) | all files pass | all files pass (after `prettier --write` on the 3 new/changed test files — see below) | none, once formatted |
| `npx eslint .` | 0 errors, 356 warnings | 0 errors, 357 warnings | **+1 warning**, same pre-existing `react-refresh/only-export-components` class already present on 15 other exports in this same file (e.g. `buildNextUp`, `selectHeroState`) — the new `resolveStudentIdentity` export triggers the identical, benign warning. Not a new class of issue. |
| `npx vitest run` | 66 files / 1567 tests, all green | 67 files / 1591 tests, all green | +1 file, +24 tests, 0 regressions |

**`format:check` was NOT a formality (item non-negotiable #4):** the first
`format:check` run against my changes genuinely failed
(`src/lib/supabase/loaders/students.test.ts`,
`src/pages/home/DashboardPage.test.tsx`, `src/pages/home/StudentHome.test.tsx`
all flagged). Fixed with `npx prettier --write` on exactly those three
files; re-ran `format:check` clean before committing.

## 12. Deferrals / scope discipline

Nothing beyond the one field (goal-hours denominator) was brought into
scope. `events`/`sessions`/`rsvps`/`studentHours`/`participation`/
`displayName` remain exactly as fixture-fed as before this task — see
criterion 11's table and follow-up 12a. `loaders/meetings.ts` was not
edited (read-only reference, per the packet's own Forbidden Files list).
`MeetingsList.tsx`/`MeetingsList.test.tsx` were not edited. No migration
was added or needed.

## 13. Anything not verified — stated plainly

- I did not independently re-verify the `MeetingsList.tsx:698`/`:706`
  citation for `CurrentViewerIdentity`/`ResolveCurrentStudentIdFn` beyond
  reading those exact lines directly (confirmed correct — both are
  `export`ed at those lines) and successfully importing/using both types;
  I did not re-audit the rest of that file's content beyond what this
  task's design required reading.
- The `supabase/migrations/20260721000000_student_teams.sql` citation
  (§2b's "a student may belong to more than one team..." sentence) was
  read directly by me during design (not re-derived from the packet's own
  quoted text) — confirmed present verbatim in that migration's own header.
- I did not run this task's changes against a real, configured Supabase
  instance (no `.env` exists in this environment, consistent with every
  prior task's own disclosed gap) — `resolveStudentScope`'s real query
  shape is verified by the stubbed-client unit tests in
  `students.test.ts` only, not against a live database.

## 14. Dispute filing

**None.** The packet's premises matched the live tree everywhere I checked
(item 19c); no citation mismatch found. The one deviation (§3, criterion
2/4's mutation targeting a different code location than the packet's own
literal phrasing implies) is disclosed as a design choice, not a dispute —
it does not change what the criteria require, only which exact line the
mutation needs to touch for THIS implementation's architecture.

**Not marking this task complete — a checker verifies it, per instruction.**
