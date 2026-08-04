# T187 + T800 — worker packet (one wave, owner-ruled)

**Rows:** T187 (W5) + T800 (W5) · **Tier: HEAVY** · **Branch:**
`claude/t187-student-teams-scoping` off `origin/main` (`fa93516`)

## Why one wave

Owner ruling 2026-08-04, verbatim *"T187 + T800 as one wave"* (`auto-mode-decisions.md`). Both are
the same defect — a student on two teams is scoped to one — on two surfaces reached by different
paths, and **they share one new read**, so splitting them means building that read twice.

## Tier

**HEAVY.** It changes what a student sees about their own data, and it edits `loaders/students.ts`,
which belongs to **W7**. W7 is unassigned, so this wave takes it — **say so in the PR**, the same
disposition the kickoffs give T200 and T204.

**Note the kickoffs' stated reason for HEAVY is wrong and you should not rely on it.** They say
widening `resolveStudentScope` is *"an export another session builds against"* because `parentHome`
consumes the factory. **Measured: `parentHome` reads only `goalHours`/`confirmedHours` off the scope
(`:482-483`) and never touches `teamId`** — so no *production* consumer breaks. **That is not the
same as "nothing breaks"**: the gate measured 30 tsc errors and 18 failing tests from the literal
build. See "What actually breaks" below. The tier stands on the two grounds above, not on blast
radius.

## The defect, and the correction to T187's own row

**T187's row says `resolveStudentScope` reads `students.team_id`. It does not.** It reads
`v_student_goal_projection.team_id` (`loaders/students.ts:407-408`), and that view's column is
`s.team_id` (`dashboard_views.sql:326`) — documented at `:311-320` as *"used here ONLY for the row's
display badge … never for any rollup math."*

So a live route scopes off a column the schema says is display-only. **That is also T186.** These are
one mechanism seen from two sides. Do not try to close T186 here, but **do** state in your report
what this wave leaves for it.

**Surface 1 (T187) — `StudentHome`.** `resolveStudentScope` returns a single `teamId`.
`isEventInTeamScope` (`StudentHome.tsx:649-654`) is `event.teamIds === null || event.teamIds.includes(teamId)`
and gates three things: live meeting check-in (`:680`), "Next up" (`:717`), and unanswered outreach
opportunities (`:768`). A two-team student silently loses her second team's meetings, check-in and
sign-ups.

**Surface 2 (T800) — `ParentHome`.** `makeLoadStudentHomeCardData` (`parentHome.ts:463`) takes
`(studentId: string, teamId: string)` — a single id threaded in from `ParentHome.tsx` — and passes it
to `buildNextEventsForStudent`. Same loss, on the parent's view of that child.

## Prescription

**1. New read — a student's ACTIVE team ids.** Add it to `loaders/students.ts` beside
`makeResolveStudentScope`, same injectable-`getClient` + `createLoader` convention every export there
already uses. Read `student_teams` filtered to the student, **with `left_on is null`** — that is the
ACTIVE predicate the already-migrated readers use (`membership_views.sql:63`/`:92`,
`dashboard_views.sql:205-206`). **RLS is not an obstacle:** `student_teams` carries
`read_all for select to authenticated using (true)` (`20260721000000_student_teams.sql:86`).

**Use the `left_on is null` form** — a student who left a team must not still be scoped to it.
`.is('left_on', null)` has in-repo precedent (`calendarFeed.ts:103`, `endMeeting.ts:398`).

**Correction, and do NOT go looking for this:** an earlier draft of this packet claimed the migrated
readers disagree, because `kpi_views.sql:256`'s join carries no predicate. **That was wrong** — the
gate measured it: `:252-254` applies `count(distinct st.student_id) filter (where s.is_active and
st.left_on is null)`, so the view's output does respect ACTIVE membership. **There is no divergence
to report and no defect to file.**

**2. Widen the scope.** Add `teamIds: readonly string[]` to `ResolveStudentScopeFn`'s return.
**Keep `teamId`** — it is the primary-team value and may still serve display, and keeping it means no
*production* consumer changes. **Existing tests do break** — that is expected, approved and bounded;
see the approval section below.

**The owner rejected a union `string | readonly string[]` signature.** Do not reintroduce one to
avoid test churn.

**3. `isEventInTeamScope` takes a set.** Change its second parameter to the active team ids and test
intersection: an event is in scope if `teamIds === null` (all-teams event) or it shares at least one
team with the student. Update all three call sites.

**4. `ParentHome`'s path — specified from the gate's build, because the first draft was vague.**

The active ids come from the scope **already loaded inside** `makeLoadStudentHomeCardDataForParentHome`
(`parentHome.ts:450`; the returned fn is at `:463`, the scope load at `:466`). **Keep
`LoadStudentHomeCardDataFn`'s signature** — do not change what `ParentHome.tsx` passes in.

Two edge cases you must handle and state:
- **Scope is `null`** → fall back to the threaded single `teamId`.
- **Scope present but ZERO active memberships** → decide and say which: scope to nothing, or fall
  back. The gate measured that scoping-to-nothing reds two existing `parentHome.test.ts` tests until
  a membership row is seeded in `baseTables`. Seeding an ACTIVE row mirrors the production backfill.

**Also in scope, and unnamed in the first draft:** `ParentHome.tsx` has its **own independent**
`isEventInTeamScope` (`:840`) and a **second** `buildNextEventsForStudent` caller in its fixture
loader (`:978`). Both must change. `CoachHome.tsx`'s copy (`:1033`) is a separate component's and
must **not**.

## ⚠️ What actually breaks — measured by the gate, NOT what the trap section used to say

**An earlier draft of this packet named the wrong files.** It warned that `DashboardPage.test.tsx`,
`StudentHome.test.tsx` and `ParentHome.test.tsx` all carry `vi.mock` blocks of the scope that would
need updating. The gate built the change and measured otherwise:

- **`DashboardPage.test.tsx` is the ONLY file with a `vi.mock` of the students loader** (`:59-86`),
  and it stayed **green unedited**, under both vitest and tsc — its factory is `unknown`-typed and
  its zero-events fixture never reaches the predicate. A hygiene update is optional, not required.
- **`StudentHome.test.tsx` and `ParentHome.test.tsx` contain ZERO `vi.mock` blocks of the scope.**
  They inject via DI props. What breaks there is scope *literals* and direct-call sites, not mocks.
- **The hard breaks are elsewhere and were unnamed:** `students.test.ts` (its recording client throws
  `unexpected table: student_teams`, `:55-58`, and its exact-shape `toEqual`s at `:95`/`:112`), and
  `parentHome.test.ts` plus both page fakes, whose query chains have **no `.is()` method at all**.

**Measured fallout from the literal build, before any test edit:** `tsc --noEmit` exit 2 with
**30 errors** (21 in `StudentHome.test.tsx`, 9 in `ParentHome.test.tsx`); targeted vitest exit 1 with
**18 failed / 323 passed** across four files.

`DashboardPage.test.tsx:36-46` still documents a real mount-time trap and is worth reading — it is
just not the thing this change breaks. **Open every `vi.mock` and fake-client block before writing a
criterion. Do not describe a harness you have not opened.**

## Allowed files

```
src/lib/supabase/loaders/students.ts        (W7's — taken, W7 unassigned; say so in the PR)
src/lib/supabase/loaders/students.test.ts   (W7's — same)
src/lib/supabase/loaders/parentHome.ts      + .test.ts
src/pages/home/StudentHome.tsx              + .test.tsx
src/pages/home/ParentHome.tsx               + .test.tsx
src/pages/home/DashboardPage.test.tsx       (mock update only)
```

**Forbidden:** any migration — this is a TypeScript-only change, and `student_teams` already exists
with the policy you need. `src/pages/outreach/**` (W2's), `src/pages/checkin/**` (W1's),
`loaders/teams.ts`/`parents.ts`/`invites.ts`/`accept.ts` (W7's, not needed).

## Owner approval for the existing-test edits — granted, and bounded

**This change cannot be implemented without editing existing passing tests.** The gate proved it: no
implementation that makes the scope carry real ACTIVE ids can keep `students.test.ts` green unedited.

**The owner has approved those edits** — 2026-08-04, verbatim: *"i dont like the idea of making the
code have a workaround to avoid writing tests… I would prefer we write the code correctly and test
should validate that"*. Full ruling in `auto-mode-decisions.md`. **He explicitly rejected the union
`string | readonly string[]` design** the gate offered to spare test churn. **The signature is
`readonly string[]`. No union, no compatibility shim.**

**The boundary, and it is the whole point of the approval — every edit must be SHAPE-ONLY and
BEHAVIOUR-PRESERVING:**

| Permitted | Not permitted |
|---|---|
| `isEventInTeamScope(e, 'team-a')` → `(e, ['team-a'])` | Changing which events a test expects in scope |
| A fixture or expectation object gaining `teamIds` | Deleting or loosening an assertion |
| Teaching a fake client the `student_teams` table | Removing a test |
| Adding `.is()` to a fake query chain | Weakening a `toEqual` to `toMatchObject` |

**If an existing test cannot be made green by a shape-only edit, STOP and report it. That is a
signal the implementation is wrong, not the test.** Several of these are proof artifacts from T176,
T181, T183 and T184; silently reversing one is the failure class item 19's rationale records.

**You must enumerate every edited line and classify it** — call-site shape / fixture shape /
expectation shape / harness plumbing — so the checker can verify no behavioural assertion moved.

## Acceptance criteria — each names a mutation that turns it red

| # | Criterion | Mutation that must turn it RED |
|---|---|---|
| 1 | A two-team student sees BOTH teams' meetings/check-in/sign-ups on StudentHome | Revert the predicate to the single-id test → the new two-team tests must FAIL |
| 2 | A parent of a two-team child sees both teams' events on that child's card | Revert ParentHome's threading to a single id → the ParentHome two-team test must FAIL |
| 3 | The read is scoped to ACTIVE memberships | **Query-shape spy**: assert `.is('left_on', null)` was called. Dropping it must FAIL that spy. **Do NOT write this as a fixture-visibility test** — the gate proved every fake client in this repo returns configured rows regardless of chained filters, so a left-team fixture would still appear and the mutation would leave the suite GREEN. Precedent for the spy form: `students.test.ts:127-135`'s own eq-drop proof. |
| 4 | An all-teams event (`teamIds === null`) still reaches every student | Change the null branch to return `false` → must FAIL |
| 5 | Single-team behaviour is unchanged | For every edited existing test, the **assertion** is identical and only its shape moved. Enumerate them. A behavioural change here is a BLOCKER, not a criterion. |

**A criterion whose mutation leaves the suite green is not evidence — report that instead of
shipping it.**

## Gates, `.env.local` ABSENT — assert exit codes directly, not through a pipe

```
npx tsc --noEmit ; echo $?
npx vite build ; echo $?
npm run format:check ; echo $?
npx eslint . ; echo $?
npx vitest run ; echo $?
npx vitest run src/pages/home/ src/lib/supabase/loaders/ ; echo $?
```

Measure your own branch-point numbers — `main` moves hourly with three other machines merging. Do
not inherit a figure from this packet.

## Report

State the **commit SHA** (item 21 — the orchestrator verifies HEAD moved and the change is in the
committed blob). Every command with its exit code. Say plainly anything you could not run. **State
what this wave leaves for T186.** Item 22 — named pathspecs only. Item 23 — your own worktree,
**commit before mutating**. You do **not** self-certify. If the packet is wrong or impossible,
**say so** rather than quietly picking a side.
