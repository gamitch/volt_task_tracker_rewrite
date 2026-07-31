# T183 branch handoff

Written 2026-07-30 by the orchestrator session that provisioned this branch, purely as
infrastructure — no packet authoring or dispatch happened here. Read this, then
`docs/swarm/constitution.md`, then the T183 row in `docs/swarm/task-ledger.md` (search
`T183`), before doing anything else.

## What this branch is

- Branch: `claude/t183-student-home-loader`, cut from `origin/main` @ `a3b9f00` (the tip at
  provisioning time — confirm nothing has landed on `main` since and rebase/merge it in
  first if it has; constitution item on worktree base applies: cut from the branch tip, not
  a stale `main`).
- Worktree: sibling directory `volt_task_tracker_rewrite-t183` next to the main checkout,
  created via plain `git worktree add`. A separate session can join it with
  `EnterWorktree(path: "<absolute path to this worktree>")`.
- PR: opened against `main`, draft, title prefixed `T183 —`. No source changes yet — this
  commit is docs-only scaffolding so the PR has something to diff.

## The task (T183)

`StudentHome`'s `defaultLoadStudentHomeData` returns the literal string `'Ada Reyes'` and
ignores both its parameters — every real signed-in student is greeted by a fabricated name.
`LoadStudentHomeDataFn` is declared at `StudentHome.tsx:383` and implemented nowhere; there
is no real loader for this page. T176 (landed) already made the goal-hours denominator, the
confirmed/planned hours, and the participation/empty-state surfaces real — this row's scope
is narrower: replace the fabricated name with a real one, sourced the same way T176 and T155
sourced their real values. Full detail, including exact line citations as of T176's merge, is
in the T183 row of `task-ledger.md` — re-verify every citation against current `main` before
relying on it (constitution item 19c); line numbers drift.

## Before dispatching a worker

- This is a rollout of an already-proven pattern (T155's outer-wrapper-sources-real-identity
  shape, reused by T176), not a novel one — constitution item 19b says a light premise check
  or a scoped skip is appropriate, not a full round. Use judgment once the real source of the
  student's name is confirmed to exist (check whatever `students` loader/table T176 and T155
  already read from for this same student).
- Sonnet tier is correct per item 18 — this touches display-name plumbing on an existing
  route, not migrations, RLS, security-definer SQL, or auth/session/role logic.
- Watch for the vacuous-absence trap (RESUME-HERE.md's process-lessons section): a criterion
  that only asserts "the name is not `'Ada Reyes'`" can pass with the bug half-fixed. Pair
  any such assertion with a positive: the name matches the real signed-in student's actual
  name from its data source.
- The subagent-pipeline dispatch pattern (packet → premise-gate → worker → checker, each in
  its own subagent transcript) measurably reduced orchestrator context growth on T169 and
  T177 — default to it here too.
- Definition of Done item 24 applies: update `task-ledger.md` and `verification-log.md` in
  the same commit that merges the work, not as a follow-up.
