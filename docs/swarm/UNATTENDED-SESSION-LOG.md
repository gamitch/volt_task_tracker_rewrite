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

**D-1 — DECIDED 2026-07-28 by George: accept no truncation. No cast.**

Putting the title into `ListItem`'s `label` as a `<Link>` (the PRD-mandated
UXC-04 shape) disables text truncation. `Item.tsx:353-360` applies its
single-line truncate style only when the label is a **string**; a `ReactNode`
label gets none, and `Link`'s own `maxLines` has nothing constraining its box.
Measured in real Chromium: the anchor runs past the row at 1440px *and* 375px
with no ellipsis. This is a regression against the previous plain-text label,
on every `ListItem` surface the wave converts.

**What is NOT affected:** page-level horizontal scroll
(`scrollWidth === innerWidth` holds at both widths) and row height (0px delta).
The failure mode is cosmetic — a long coach-entered title paints across the
type badge instead of ellipsizing.

**Decision:** accept it. The only available fix is `labelLines={1}`, which
reaches `Item` at runtime through `ListItem`'s `restProps` spread but is absent
from `ListItemProps` — so it needs a TypeScript escape hatch — and it *clips*
rather than ellipsizes, because `text-overflow` cannot act on an atomic
`inline-flex` box. A cast to reach a non-public prop, in exchange for a clip
rather than an ellipsis, is not worth it.

**Standing consequence — checkers must not flag this.** On any `ListItem`
surface carrying a linked title, absent truncation is accepted behaviour, not a
defect. Workers report the measurement and move on; they do not propose the
cast. If the vendor later exposes `labelLines` on `ListItemProps`, revisit.

**D-2 — `/roster` cannot be captured with real data, and this will recur.**
`RosterShell`/`StudentsTab` expose no injectable loader seam, and there is no
`.env` in this environment, so any roster screenshot shows a
Supabase-not-configured error rather than the table. T134 shipped that as the
canonical `new-roster.webp` and its checker correctly failed it; the original
figure is being restored. Every future task needing a roster capture hits this
identically. **Options for George:** add an injectable loader seam to
`RosterShell`/`StudentsTab` (mirrors the pattern every other page already has),
or drop roster captures from the wave. Not decided.

**D-3 — DECIDED 2026-07-28 by George: commit the archive.**

`docs/swarm/archive/` was gitignored on the assumption it "can grow large".
Measured: **2.1 MB of markdown across 200 files** — smaller than
`docs/swarm/figures/` (2.3 MB) and ~3% of `.git`. The premise was wrong.

The cost was real: every packet and worker output moves there on completion, so
a caveat recorded only in a worker output was deleted from the repo at the
moment the task archived, while the artifact it described stayed. T134 surfaced
it.

**The actual state was worse than "excluded":** 156 of 200 files were already
tracked (committed before the ignore rule existed) and 44 were not. The archive
looked present while a fifth of it silently was not.

Committed in `0a90e11` after scanning for secrets and PII per constitution
items 5 and 6 — zero secret values, zero real email addresses.

**Standing consequence:** worker outputs are now durable. Caveats no longer
need hand-carrying into the ledger, though anything that must change *behaviour*
(like D-1's "checkers must not flag this") still belongs in the PRD, where
checkers actually read.

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

## Environment facts (verified, not assumed)

**All 15 migrations are applied to George's remote Supabase project**, verified
2026-07-28 by `supabase migration list` against the repo's
`supabase/migrations/` — 15 local files, 15 remote entries, identical
timestamps, ending at `20260724000001_planned_hours_future_guard`.

Recorded because earlier session notes claimed "six unapplied migrations" and
that claim was repeated without checking. It was stale: it predated George
running `supabase db push`. Nothing in this container can see his remote
project, so **any statement about applied migrations must come from
`supabase migration list`, run by George from inside the repo, or be labelled
unverified.**

Note that `migration list` run from outside the repo shows an empty Local
column — the CLI finds no `supabase/migrations/` directory. That is not a
missing-migration signal.

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
