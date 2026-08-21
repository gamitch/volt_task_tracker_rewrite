Closes GAM-440

## What changed

`AGENTS.md`, Verification and close-out: a claimed row now carries a run log in
its comments at **exactly three transitions** — claim, blocked/escalating,
close-out — and explicitly not on routine pushes or individual gate runs.

Each comment opens `**Run log · <agent> · <stage> · YYYY-MM-DD**`. That prefix is
load-bearing: the Linear MCP connection authenticates as the **owner's account**,
so an agent comment renders as authored by George and is otherwise
indistinguishable from an owner instruction. Verified by read-back on GAM-436
(`author: George Mitchom`). Without it, machine chatter dilutes real directives
like the owner's parallel-subagent note on GAM-356.

Also records that the close-out comment does **not** link the PR — Linear does
not link on comments; the branch name and the `Closes GAM-nnn` line do.

## What the issue got wrong

Nothing material. One thing it could not know at filing time: `AGENTS.md` had
moved on `main` (PRs #208/#209/#215, including the new "Three walls" section), so
the commit was cherry-picked onto a branch cut from current `main` rather than
the branch it was authored on. Auto-merged with no conflict; placement verified
by reading the file — the block sits between the item-30 and item-27 paragraphs,
both intact.

## Tier, stated and defended

**FAST.** One documentation file, 29 lines added, no source, no schema, no write
path, no signature change.

**Declared deviation:** item 26's FAST bar asks for a named mutation that turns a
test red. There is none — prose in `AGENTS.md` has no test to turn. Declaring
that rather than relabelling the row STANDARD to dodge the requirement, since
STANDARD would not add anything a checker could act on either. Verification is
that the gates stay green and the surrounding paragraphs are undisturbed.

## Verification

```
GATE RUN — 33a242c on claude/gam-440-run-log-convention — tree clean

  1 tsc              exit 0  PASS
  2 vite build       exit 0  PASS
  3 format:check     exit 0  PASS
  4 eslint           exit 0  PASS       0 errors, 380 warnings
  5 vitest (full)    exit 0  PASS       101 files / 2588 tests  baseline 2588 (+0)
  6 vitest (scoped)      –  SKIP
                            no scope given and none derivable from the diff

VERDICT: PASS — 5 of 6 gates. NOT all six: 1 skipped.
```

**5 of 6, not six.** Gate 6 is skipped because the diff touches no `src/` file,
so there is no defensible scope to run. Baseline measured directly at
`origin/main` (`faab36c`).

## Scope

Closes GAM-440 fully. Documentation only — no user-visible surface, so item 27
does not apply.

The convention is **already in use** on GAM-436, which carries all three comments
(claim, escalating, close-out). This PR is the missing authority for a practice
that already exists, not a proposal.

## Known gaps, disclosed

- **Nothing enforces this.** It is prose in `AGENTS.md`, like the rest of the
  section. A run that ignores it fails no check. That is consistent with how
  every other convention in this file works, but worth stating rather than
  implying the rule is self-enforcing.
- **Codex reads the same file**, so this binds that runtime too. It has not been
  exercised there.

Linear-Issue: GAM-440
