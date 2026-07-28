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

*(appended as they arise)*

---

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
