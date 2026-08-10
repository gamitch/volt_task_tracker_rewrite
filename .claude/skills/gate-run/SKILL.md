---
name: gate-run
description: Run this repo's six verification gates — tsc, vite build, format:check, eslint, the full vitest suite and a scoped vitest run — in one call, and print one evidence block other agents can check. Use this whenever you are about to report, record or quote gate results: finishing a worker task, reviewing completed work as a checker, verifying a branch before opening a PR, writing gate figures into a run log or verification log, or answering "does this build / typecheck / pass". Also use whenever you catch yourself about to run tsc, eslint or vitest as separate shell calls, or about to pipe a test command into tail, grep or wc.
---

# Gate run

Six commands decide whether work on this repo is shippable. They are always the
same six, they are run several times per task by different agents, and their
output gets quoted into run logs, verification logs and PR bodies. That makes
them worth running one way rather than six ad-hoc ways.

```bash
python3 .claude/skills/gate-run/scripts/gates.py \
  --scope src/pages/home/ \
  --baseline-tests 2156 \
  --baseline-scoped 219
```

## The six gates

| # | Command | Passes when |
|---|---------|-------------|
| 1 | `npx tsc --noEmit` | exit 0 |
| 2 | `npx vite build` | exit 0 |
| 3 | `npm run format:check` | exit 0 |
| 4 | `npx eslint .` | zero **errors** — warnings are counted and reported, not judged |
| 5 | `npx vitest run` | exit 0, and the test count did not fall below baseline |
| 6 | `npx vitest run <scope>` | exit 0, and the scoped count did not fall below baseline |

Gate 4 tolerates warnings because this repo carries a standing 377 of them, all
the same pre-existing `react-refresh/only-export-components` class. Freezing
that number as a hard ceiling would make an unrelated task's first new warning
look like a failed gate. If you want it enforced for a particular run, pass
`--max-warnings 377` and say in your log that you did.

## Why one call instead of six

**Exit codes must come from the process, not from a pipe.** `npx vitest run |
tail -5` reports `tail`'s exit status — always 0 — so a suite with failures
prints a green tick. The run logs already say gates are asserted "directly, not
through a pipe"; this script is that rule made executable. It uses argument
lists with no shell in between, so each gate's own status is what gets reported.

**Turns are the expensive unit, not commands.** Every turn re-sends the whole
conversation, so six separate gate calls in the middle of a long run cost six
full context re-transmissions to learn six integers. One call, one block. This
is a real but modest saving — roughly 5% of a heavy run. It is not the reason
to use the skill; comparable evidence is.

**The block has the same shape every time.** Three agents ran these gates on
GAM-304 and reported one set of numbers; that agreement is only meaningful
because the numbers were comparable. Ad-hoc pasting makes agreement hard to
check and disagreement easy to miss.

## Where the baselines come from

A test count means nothing on its own — 2162 is good news only against 2156.

Take the baseline from the task packet when it names one. When it does not,
derive it by running gate 5 at the merge base before your change and record
that you did. Then say which you used, because "baseline 2156" and "baseline
2156, measured at `49096db`" are different claims.

A count that comes in **below** baseline fails the gate. Tests do not disappear
by accident, and a suite that shrank while exiting 0 is the failure a green
tick hides best.

Run without a baseline and gates 5 and 6 print `(no baseline given — regression
not checked)`. Nothing is wrong with that — plenty of runs legitimately have no
baseline to compare against — but the block has to say so. A bare count next to
a green PASS reads as though the comparison ran and succeeded, which is a
stronger claim than the run actually made.

## Gate 6's scope

Pass `--scope` when the packet names a path. Otherwise the script derives the
deepest directory containing every changed `src/` file, and prints that it did
so — read that line, because a derived scope is a guess about intent.

When the change spans unrelated trees, the only shared prefix is `src/` itself,
which is just gate 5 again. The script reports gate 6 SKIPPED and the verdict
says **"5 of 6"**. It will not print "all six gates pass" when it ran five.
If you need the sixth, choose a path yourself and pass it.

## Reading the verdict honestly

The script distinguishes three bad outcomes, because they call for different
responses:

- **FAIL** (exit 1) — a gate went red. The tree is not shippable. This is
  information; act on it.
- **UNTRUSTWORTHY** (exit 2) — git provenance could not be established, `--base`
  does not resolve, a summary could not be read, a run collected no tests,
  eslint exited 2 or otherwise died for a non-lint reason, a gate timed out,
  `node_modules` is missing, or the tree was dirty under `--require-clean`.
  **Do not record these numbers as evidence.** Fix the condition and re-run.
  The first three are checked before any gate runs, so a broken environment
  costs you nothing.
- **SKIPPED** — gate 6 had no defensible scope. Five gates passed. Say five.

What actually catches a wrong `--scope`, measured rather than assumed: vitest
3.2.7 here exits **1** on an empty match, printing `No test files found,
exiting with code 1` and no summary — so the unreadable-summary refusal and the
exit code both fire. An earlier draft of this file claimed such a run "exits 0";
that was wrong, and worth correcting because a reader who trusts it would go
looking for a green tick that never appears.

The zero-collected branch is kept anyway, as insurance rather than as today's
mechanism: setting `passWithNoTests` — not set anywhere in this config — flips
an empty run to exit 0, and at that point a filter typo or a renamed directory
would produce a genuinely green run that proves nothing. That is the same
reason `mutation-replay` checks the count moved rather than trusting the exit
code alone.

## Every agent runs it themselves

Worker, checker and orchestrator each run the gates independently, and that
duplication is deliberate — it is what turns one agent's claim into three
agents' agreement. Quoting a prior agent's numbers instead of running them
collapses that back into a single unverified assertion, which is the shape of
error the chain exists to catch.

So: run it, then compare your block against theirs. Matching figures are
evidence. Differing figures are a finding worth stopping for — on GAM-304 a
worker reported 8 tests where the reference said 9, and only an independent
run surfaced it.

Gates run against a **commit**, not a hope. The block prints the short SHA and
whether the tree was dirty; a dirty-tree result describes uncommitted work and
should not be quoted as a verdict on a commit. Re-run on the final branch state
before opening a PR — appended log entries and doc edits can move gate 3.

**Pass `--require-clean` whenever the run is about to become a verdict** — the
pre-PR run, and a checker's run. It refuses outright on a dirty tree instead of
printing a SHA its numbers do not describe. Item 21 puts it plainly: "clean"
and "committed" are different claims, and T142 is the recorded case of work
that was real, measured, and entirely uncommitted. Dirty runs stay allowed by
default because mid-work gating is legitimate and frequent; the flag is how a
final run stops relying on the operator to remember the difference.

When it refuses, the remedy is to **commit your own changes, or point `--cwd`
at a clean dedicated worktree**. Not `git stash` — `AGENTS.md` forbids it here,
and pre-existing changes must be preserved.

Provenance is established before any gate runs, and a failure there is fatal.
This is worth knowing because it was once the opposite: `git status` failing
left its stdout empty, `dirty` computed to `False`, and `--require-clean`
passed a tree it had never inspected — in a directory that was not a git
repository at all, it printed `tree clean`. A safety flag that disarms exactly
when the environment is broken is worse than no flag, because it reads as
checked. An unresolvable `--base` is fatal for the same reason: a request git
cannot answer is not the same as a change with no scope, and the two must not
produce the same quiet `SKIPPED`.

Running in a worktree is the normal case for a checker: pass `--cwd
/tmp/whatever-check`, and run `npm ci` there first. The script refuses outright
when `node_modules` is absent rather than reporting six failures that are
really one missing install.

## What the gates do not tell you

Six green gates mean the tree builds, lints, formats and stays green. They say
nothing about whether the tests assert anything worth asserting — a suite of
vacuous tests passes every gate here. That question belongs to
`mutation-replay`, and a completion report that offers gate output *instead of*
a replay has answered an easier question than the one that was asked.

## The parser has its own tests

```bash
python3 .claude/skills/gate-run/scripts/test_gates.py
```

They cover the summary shapes that have actually broken parsers in this repo —
a failing focused run with no `passed` segment, ANSI colour codes, a missing
total, eslint output with no tally — plus every scope-derivation refusal. They
run in CI as part of the `skill-scripts` job, since vitest's `exclude` covers
`.claude/**` and nothing else would ever execute them.
