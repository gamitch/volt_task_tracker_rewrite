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
(`:482-483`) and never touches `teamId`.** An additive field disturbs no consumer.

## The defect, and the correction to T187's own row

**T187's row says `resolveStudentScope` reads `students.team_id`. It does not.** It reads
`v_student_goal_projection.team_id` (`loaders/students.ts:409`), and that view's column is
`s.team_id` (`dashboard_views.sql:322`) — documented at `:311-320` as *"used here ONLY for the row's
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

**⚠️ The migrated readers do NOT agree with each other.** `kpi_views.sql:256` joins `student_teams`
**without** `left_on is null`. Use the `left_on is null` form — a student who left a team should not
still be scoped to it — and **report the divergence**; do not "fix" `kpi_views.sql` here.

**2. Widen the scope additively.** Add `teamIds: readonly string[]` to `ResolveStudentScopeFn`'s
return. **Keep `teamId`** — it is the primary-team value and may still serve display. Additive means
no consumer breaks.

**3. `isEventInTeamScope` takes a set.** Change its second parameter to the active team ids and test
intersection: an event is in scope if `teamIds === null` (all-teams event) or it shares at least one
team with the student. Update all three call sites.

**4. `ParentHome`'s path.** Thread active team ids instead of the single `teamId` through
`makeLoadStudentHomeCardData` → `buildNextEventsForStudent`. `parentHome.ts` and `ParentHome.tsx` are
both W5's, so this is in-house.

## ⚠️ The harness trap — it is in these exact files and has bitten four tasks

**`src/pages/home/DashboardPage.test.tsx:36-46` documents it verbatim.** A zero-props
`<StudentHome />` reaches **three** real seams that must all be module-mocked, and mocking
`resolveCurrentStudentId` alone still leaves `resolveStudentScope` hitting the real
`getSupabaseClient()`. **You are changing the shape `resolveStudentScope` returns, so every mock of
it must change too** — `DashboardPage.test.tsx`, `StudentHome.test.tsx`, `ParentHome.test.tsx`.

**Open each `vi.mock` block and read it before writing a single criterion.** Do not describe a
harness you have not opened. Four consecutive orchestrators have written criteria against an imagined
one.

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

## Acceptance criteria — each names a mutation that turns it red

| # | Criterion | Mutation that must turn it RED |
|---|---|---|
| 1 | A two-team student sees BOTH teams' meetings/check-in/sign-ups on StudentHome | Revert `isEventInTeamScope` to the single-id test → the new two-team test must FAIL |
| 2 | A parent of a two-team child sees both teams' events on that child's card | Revert `parentHome`'s threading to a single id → the ParentHome two-team test must FAIL |
| 3 | A student who LEFT a team is no longer scoped to it | Drop `left_on is null` from the new read → a left-team fixture's events must appear, failing the test |
| 4 | An all-teams event (`teamIds === null`) still reaches every student | Change the null branch to return `false` → must FAIL |
| 5 | Single-team students are unaffected | The existing single-team assertions stay green **without being edited** |

Criterion 5 is the regression guard — **if your change turns an existing single-team test red, you
have done something wrong.** Constitution Non-Negotiables: existing tests pass unless the owner
approves an update, and **no such approval exists for this wave.**

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
