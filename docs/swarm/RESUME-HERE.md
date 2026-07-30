# Resume here — state of play at `main` = `f7ff055`

Written 2026-07-30 so this session's context can be cleared without losing anything.
If you are a fresh orchestrator session, read this file, then `constitution.md`, then the
open rows in `task-ledger.md`. Everything below is on disk; nothing important lives only
in a conversation.

## Where the repo is

- **PR #2 is merged.** `main` = `f7ff055` and contains all work through T154.
- `claude/swarm-plan-zl575z` has been **restarted off that `main`** (PR #2 is finished and
  must not be reused; further work opens a **new** PR).
- Working tree clean. Gates measured green on this base: `tsc` exit 0 · eslint
  **0 errors / 355 warnings** · **66 files / 1536 tests** · prettier clean · `vite build` ✓.
- One worktree is deliberately preserved: `.claude/worktrees/agent-a640406e50762373c`
  (T144's contrast evidence, D011). **Do not delete it.** All other agent worktrees were
  cleaned up (~940 MB freed).

## Ready to dispatch, in priority order

1. **T155** — the owner's dashboard bug (`22P02 invalid input syntax for type uuid`).
   Packet at `docs/swarm/active/T155-worker-packet.md`, **revision 3**, gated **twice**
   (item 19a's two-round cap is **spent** — dispatch a worker, do **not** re-gate).
   Worker sonnet + checker opus. This is the highest-value open item: it is a live
   user-facing failure the owner reported with screenshots.
2. **T157** — mount `ParentRsvp` in `OutreachDetail.tsx` (owner-ruled placement).
   Packet exists; gate round 1 returned REVISE. **Revision 2 must be written from
   `docs/swarm/active/T157-gate-round1-findings.md`** — twelve required revisions, recorded
   verbatim there. Round 2 of 2 is still available.
3. **T151** — generalise the fix: make three dialogs' `teams` required, delete the fixtures.
   Premise re-measured: **34 TS2741 errors, zero in production source**, all in two test
   files. Sequence **after or with T159** (`StudentDialog` has a fourth such prop, `season`).
4. **T170** — `/outreach`'s `viewerStudentId` placeholder. **Hard-blocks T169's student
   half**; wiring a persisting RSVP control first would write real rows keyed to a
   non-existent student.

## Open rows worth knowing about

`T152` T147's half-strength guard · `T156` the loader discards the real Postgres error ·
`T158` Leaderboard (owner ruled: embed in the dashboard; **blocked on T155**, same file) ·
`T159` `StudentDialog.season` · `T161`–`T167` loader tests · `T168` placeholder sweep
(**discovery only**) · `T169` `RsvpControl` on both surfaces (owner-ruled) · `T171` T154's
no-stale-frame property is true but pinned by nothing · `T172` fix the placeholder
**mechanism**, not instances.

## Owner rulings — cite the record, never a paraphrase

All verbatim in `docs/swarm/auto-mode-decisions.md`. Three sessions' worth of packets have
falsely promoted the orchestrator's own decisions to owner authority — **twice shipped**,
once gate-caught. Rule: if a packet says the owner approved something, it must cite a
section of that file. Otherwise it is the orchestrator's decision and must say so.

Rulings on record: keep the localStorage seed · ratify the `CoachHome.test.tsx:1194-1196`
amendment · fix the shared-browser theme bleed properly · embed the leaderboard in the
dashboard · `ParentRsvp` in `OutreachDetail` · `RsvpControl` on **both** `OutreachDetail`
and the student-facing outreach view.

## The two defect families that have produced almost every real bug

**1. Optional prop + plausible fixture default + call site that passes nothing.**
Six instances; **three reached the owner as production bugs in one afternoon.**
`OutreachEventDialog.teams` and `ScheduleMeetingsDialog.teams` (fixed, T147),
`CoachHome.seasonId` (T155), `Leaderboard.seasonId` (T158), `StudentDialog.season` (T159),
`OutreachList.viewerStudentId` (T170), plus `RsvpControl.currentUserProfileId`.
It hides because the surrounding fixtures are keyed to the **same** placeholder, so the
page renders plausible fabricated data instead of erroring. T168 finds them; T172 is the
mechanism fix; each instance is its own work task.

**2. Nothing asserts reachability.** Three finished, fully-tested feature areas shipped
mounted nowhere — a component's own test file counts as an importer, so "is it used" greps
come back clean, and a green suite proves a component works without proving anyone can
reach it. `Leaderboard`, `RsvpControl`, `ParentRsvp` were each imported by exactly one
file: their own test. Worse variant found in `OutreachList :: handleRsvpChange` — a
**present** RSVP control that writes nothing, so a student RSVPs, sees it apply, and it is
discarded on reload.

## Hard-won process lessons — these were each paid for

- **Cite by symbol, not line number.** Ten citation errors reached artifacts in one day.
  The dominant cause: line numbers lifted from grep output without checking which construct
  they belonged to (a function's parameter list mistaken for a props interface; `:2396`
  for `:2320`; `:1392-1397` for `:1391-1396`). See `architecture-review-parallelism.md` §3.1.
- **A criterion that cannot fail is worse than no criterion.** Multiple acceptance criteria
  this project were mathematically incapable of failing. Always prescribe the mutation, run
  it, and report the failure output.
- **A negative-only assertion passes vacuously.** "B does not see A's value" passes when the
  feature is disabled entirely. Always pair it with the positive: assert what B *should* see.
- **DOM-only assertions cannot see a one-commit-late render.** `act()` flushes effects before
  the assertion. Record every render and assert `renders[0]`.
- **Do not tell the owner what is on screen from reading code — render it.** Three
  successive descriptions of one screen were wrong; each correction came from an agent that
  executed rather than read.
- **Verify the fix's premise, not just its logic.** The prescribed remedy for T154's MAJOR
  would never have fired: it assumed a non-null → non-null user transition, but `logout()`
  sets `user: null` first, so the real flow is A → null → B. Measured: the literal rule
  left a **green suite with the bug intact**.
- **Mutations run in the agent's own worktree** (item 23), never the shared tree.
- **Record and merge in one action** (item 24): ledger row + verification-log entry move in
  the same commit as the merge.
- **A read-only role cannot build a prescription.** Do not ask `checker-premise` to apply
  multi-line changes; it has no Write or Edit tool.

## Parallel audit session

A second session may be auditing on its own branch off `main`. Contract: it writes
**only** `docs/swarm/inbox/<branch-name>.md`, never `task-ledger.md` or `constitution.md`
(both append-at-end, so concurrent writes conflict on the same line every time). Fold its
file in by **merging its branch** rather than transcribing, so provenance survives — see
`docs/swarm/inbox/claude-loader-tests-audit-inbox.md`, folded in that way at `f8929ba`.
Re-verify its citations before acting, but note the first such session produced **zero**
citation errors across 99 lines, better than this session's own record.
