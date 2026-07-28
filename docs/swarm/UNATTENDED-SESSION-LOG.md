# Unattended session log — 2026-07-28

George is away ~8 hours. This file is the first thing to read on return: it
records what I decided alone, and every decision I deliberately did **not**
make.

## Operating rules I am running under

**I decide alone (routine orchestration):**
- Revising packets in response to gate findings.
- Dispatching workers and checkers; resuming a failed worker for rework.
- Merging a worktree branch into `claude/swarm-plan-zl575z` after its checker
  returns PASS.
- Fixing MINOR/NIT findings myself when they are comment-only or mechanical,
  disclosing in the commit that they are unreviewed.
- Committing and pushing to the feature branch.
- Writing and gating the next packets in wave 5.

**I defer to George (recorded below, not acted on):**
- Any reversal of a passed task not already authorized in writing.
- Any third gate REVISE. Constitution item 19a escalates to the human owner;
  with no human available I **park the task** and move to the next rather than
  loop or override.
- Anything touching `supabase/migrations/`, RLS, `security definer` helpers,
  metric-math SQL, or auth/session/permission logic (constitution item 18's
  high-risk class, plus the standing human gates T052 / T063-065 / T070).
- Merging PR #2, or opening any further PR.
- Any change to `docs/swarm/constitution.md`.
- Product decisions where two readings would produce materially different UI.

**Default posture:** when a call is genuinely ambiguous, I park it with a
follow-up entry here and continue with work that is not blocked. Scaling scope
down is George's call, not mine — so I finish everything that is unambiguous
and say plainly what I left.

---

## Deferred decisions

**D-1 — `ListItem` label-slot truncation is lost, wave-wide.** Putting the
title into `ListItem`'s `label` as a `<Link>` (the PRD-mandated UXC-04 shape)
silently disables truncation: `Item.tsx:353-360` applies its single-line
truncate style only when the label is a **string**, and a `ReactNode` label gets
none. Measured in real Chromium — the anchor runs past the row at 1440px *and*
375px with no ellipsis. This is a **regression against today's behaviour**, on
every `ListItem` surface the wave converts (T132's student/parent rows, T133's
calendar rows).

Page-level horizontal scroll is *not* affected (`scrollWidth === innerWidth`
holds at both widths) and row height is unchanged, so nothing breaks — a long
coach-entered event title simply paints across the type badge without an
ellipsis.

There is a partial fix, and it needs George: `labelLines={1}` reaches `Item` at
runtime through `ListItem`'s `restProps` spread and restores
`overflow:hidden; nowrap`, bounding the paint inside the row. But it is absent
from `ListItemProps`, so it needs a TypeScript escape hatch — an escalation no
packet authorizes — and it *clips* rather than ellipsizes, because
`text-overflow` cannot act on an atomic `inline-flex` box. So the real choice is
between a TS cast for a clip, or accepting no truncation, or asking the vendor.
**Not decided. Both packets now instruct workers to measure and report rather
than chase an ellipsis.**

**D-2 — `/roster` cannot be captured with real data, and this will recur.**
`RosterShell`/`StudentsTab` expose no injectable loader seam, and there is no
`.env` in this environment, so any roster screenshot shows a
Supabase-not-configured error rather than the table. T134 shipped that as the
canonical `new-roster.webp` and its checker correctly failed it; the original
figure is being restored. Every future task needing a roster capture hits this
identically. **Options for George:** add an injectable loader seam to
`RosterShell`/`StudentsTab` (mirrors the pattern every other page already has),
or drop roster captures from the wave. Not decided.

**D-3 — archived worker outputs leave the repository.** `.gitignore` ignores
`docs/swarm/archive/`, so when a task's packet and output are archived, any
disclosure recorded only in the worker output is deleted from the repo. This is
deliberate (the archive is large), but it means **a caveat about a shipped
artifact must live somewhere else** — the ledger, the verification log, or
beside the artifact. Surfaced by T134's checker. Worth a constitution note, but
constitution edits are deferred.

*(appended as they arise)*

---

## Standing dispatch rule added 2026-07-28

**Every worker dispatched with `isolation: "worktree"` must merge the working
branch before doing anything else**, and report the result:

```
git fetch origin
git merge origin/claude/swarm-plan-zl575z
```

The `Agent` tool creates worktrees from the repository's default branch
(`main`), not from the branch the session is working on, and it exposes no way
to choose the base. T132's worker was therefore handed a tree in which T131 had
never shipped: it saw the coach rows still carrying a separate "View details"
link and an actions column at `pixel(420)`, and correctly reported that two of
its acceptance criteria described behaviour that did not exist.

The worker caught this itself and refused to work around it. That is the
mechanism working — but it cost a full cycle, and the next one might not catch
it. The merge-first step is cheap insurance.

Worktree isolation stays. It is the only reason the stale base affected one
task instead of corrupting the shared tree.

## Timeline

*(appended as work completes)*

### Session start
In flight at handover:
- **T134** — worker finished, opus checker re-deriving from worktree
  `agent-a3a474e983006218e`.
- **T132** — worker running in worktree `agent-ad764a3b400299d32`.
- **T133** — third premise round, explicitly authorized by George before he
  left, past item 19a's two-round cap.

Merged and pushed so far this session: T131 (accepted), PR #2 opened,
Wave A packets written and gated, vitest/eslint worktree-exclusion fix.
