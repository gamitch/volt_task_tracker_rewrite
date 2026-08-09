---
name: mutation-replay
description: Prove a test actually guards what it claims, by changing the code it covers and confirming the test turns red. Use this whenever you are about to treat a passing test as evidence — replaying a worker's acceptance criteria, reviewing completed work, adding coverage, writing a criterion into a packet, or saying a change is safe because the suite is green. Also use whenever you have not personally watched a test fail, or when a task's whole claim rests on "this is tested".
---

# Mutation replay

A passing test proves nothing on its own. It proves something only when you have
seen it fail for the right reason.

This repo has shipped **67 recorded instances** of assertions that passed for the
wrong reason, across **202 task entries** in `docs/swarm/verification-log.md`.
Mutation replay is the counter-measure, and it is the single most-used mechanic
here — **73 of those 202 entries** record one.

## The loop

1. Establish a baseline: run the target tests, record **pass count and exit code**.
2. Change the production code so the behaviour under test is wrong.
3. Re-run. The test must fail, and fail *because of your change*.
4. Revert. Confirm the tree is clean before the next mutation.

`scripts/replay.py` does all four and refuses to report a result it cannot stand
behind. Prefer it over hand-rolled `sed`/Python — every failure mode below was
found the hard way by doing this manually.

```bash
python3 .claude/skills/mutation-replay/scripts/replay.py \
  --file src/lib/foo.ts \
  --old "status === 'going' && !checked.has(id)" \
  --new "status === 'going'" \
  --test "npx vitest run src/lib/foo.test.ts" \
  --label "drop the checked-set guard"
```

## What makes a mutation worth running

**Name the mutation before you write the test.** A criterion that cannot name one
is not a criterion. When a packet says "assert X is covered", ask what edit would
break X — if you cannot answer, the test will be shaped by the implementation
rather than by the requirement.

**The mutation must remove the guard, not merely edit the file.** This is where
most bad criteria come from. Three examples from this repo, all written in good
faith, all of which changed nothing a test could see:

- Restoring a default value to a prop that every call site already passes.
  Nothing omits it, so nothing errors.
- Re-adding a field to a payload where the assertion only checked the payload's
  *shape*, so both states satisfied it.
- Changing a row-count constant that the test computed from, rather than
  compared against.

**Prefer outcome assertions to call-shape assertions.** `toHaveBeenCalledWith`
proves a function was invoked a certain way; it does not prove the result was
right. Where the point is the outcome — a row's final state, what a user sees —
assert that instead. A shape assertion turns red for the wrong reasons and stays
green for the wrong ones.

## Reading the result honestly

**A mutation that leaves the suite green is a finding, not a pass.** It means the
guard you believed in does not exist. Record it and either add the missing test or
say plainly that the behaviour is unguarded.

**Check the count moved, not just the exit code.** A test run that skipped
everything exits 0. A filter that matched no test name reports success while
proving nothing. `replay.py` fails loudly on this, because it happened three
times in one session here: an anchor that threw yet still printed `exit=0`, a
`-t` filter that silently skipped all 108 tests, and a hash comparison of two
empty strings that "matched".

**A verdict you cannot parse is not a verdict.** `replay.py` reads the runner's
whole summary line and refuses the replay outright — naming the line it could
not read — rather than counting an unreadable shape as zero. It did the latter
once (T612): a focused `-t` run where the only matched test *failed* prints
`Tests  1 failed | 69 skipped (70)`, with no `passed` segment at all, and the
old parser scored that genuinely red run `failed=0 passed=0` and called it
`UNTRUSTWORTHY: the mutated run executed no tests`. A false UNTRUSTWORTHY is
worse than a crash: it tells you to throw away real evidence. If you ever see
that verdict, check the counts it printed against the run's own output before
believing it.

The parser has its own tests, over summary lines captured from real runs
(vitest and Jest shapes, colour codes, and every refusal path):

```bash
python3 .claude/skills/mutation-replay/scripts/test_replay.py
```

They run in CI as the `skill-scripts` job — vitest's `exclude` covers
`.claude/**`, so nothing else would ever execute them.

**Distinguish a genuinely equivalent mutation from a coverage gap.** Sometimes the
mutated code really does behave identically, and no test *should* redden. Work out
which you are looking at before concluding either — the question is whether an
observable differs, not whether a line changed.

## Bounding the edit

**Anchor to the smallest unique string, and bound the replacement to the target
block.** Large test files repeat identical fixture blocks; an unbounded replace
hits the wrong one. Two over-replacements happened here in one session — one
flipped 33 call sites across unrelated tasks' tests, another matched a different
test's identical mock and produced a syntax error.

When the anchor is not unique, slice the file to the enclosing `it(...)` or
function first, mutate inside that range, then splice it back. `replay.py`
`--start-marker` / `--end-marker` does this.

**Always revert between mutations.** Running two at once tells you nothing about
either.

## When there is no possible mutation

Some changes carry no behaviour: comment corrections, fixture values nothing
reads, a glyph swap. Do not invent an assertion to create the appearance of
coverage — a test that greps for comment text looks like a guard and is not.

Instead, prove the change is inert and say so:

- **Comment-only:** transpile both revisions with comments stripped and compare
  hashes. Identical output is a stronger claim than "I read the diff".
- **Value nothing reads:** set every occurrence to garbage and run the suite. If
  it stays green, that *is* the finding — state it rather than hiding it.

Both are honest evidence. A vacuous test is not.
