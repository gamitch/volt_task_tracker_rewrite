Closes GAM-000

<!--
LINE 1 IS PARSED, NOT DECORATION. `scripts/linear/declaration.mjs` reads it and
the `Linear declaration` check is a required check, so getting it wrong blocks
the merge.

  Closes GAM-123          ok
  closes gam-123          HALF_DECLARATION -- case-sensitive, anchored at start
  Fixes GAM-123           HALF_DECLARATION -- the verb must be "Closes"
  This closes GAM-123     HALF_DECLARATION -- nothing may precede it
  Closes GAM-1 and GAM-2  AMBIGUOUS_DECLARATION -- one identifier only
  Closes GAM-000          PLACEHOLDER -- you left this template's default in
  (blank first line)      NO_DECLARATION

Trailing prose on line 1 is allowed. A blank or indented first line is not.

CLOSING NOTHING? Delete line 1. But read this first: a branch named
`claude/gam-123-*` or a PR title containing `GAM-123` links the issue BY ITSELF
and closes it on merge with no magic word present. Deleting `Closes` protects
nothing. To link without closing, write `Ignore GAM-123` (or `skip`/`ref`) --
see AGENTS.md item 5. Those lines are deliberate; do not "tidy" them away.

Run `node .claude/skills/pr-body/scripts/check.mjs <file>` to check a body
before opening. See the `pr-body` skill for the full shape.

Delete any section below that does not apply. An empty heading is worse than
no heading.
-->

## What changed

<!-- One or two sentences. What can the code do now that it could not before,
or what can it no longer do? -->

## What the issue got wrong

<!-- Delete if nothing. Premise gates on this repo falsify something in most
rows they touch, and a correction recorded here is how the next reader avoids
inheriting it. State what the issue claimed, what you measured, and which one
the code now follows. -->

## Tier, stated and defended

<!-- Constitution item 26 requires the tier be stated and argued, not assumed.
Name it (FAST / STANDARD / HEAVY), give the trigger it rests on, and say what
the losing tier's argument was. If the row arrived `unreviewed`, say so -- you
tiered it, and that judgement is reviewable. If the run deviated from its
tier's process, declare it here rather than relabelling the row. -->

## Verification

<!-- Paste the gate-run evidence block verbatim. Do not retype the numbers.

    python3 .claude/skills/gate-run/scripts/gates.py --require-clean

If a gate was SKIPPED, leave it visible and say why. "5 of 6" with a reason is
honest; "all six" when one was skipped is not. -->

<!-- Then the mutations. A passing test is not evidence until you have watched
it fail. See the `mutation-replay` skill.

| Mutation | Result |
| -- | -- |
| <what you changed> | <red/green, and which assertions> |

A mutation that fails to BUILD is not a mutation that failed to redden -- if
tsc rejects it, reshape it and run it again. -->

## Scope: what this does and does not close

<!-- Constitution item 27. If any part of the surface you touched is reached
only through a fixture or stub on the user's real path, this closes Partial,
not Passed. State the narrow claim: "this dialog cannot persist X", not
"X cannot be persisted". -->

## Follow-ups filed

<!-- Constitution item 20 -- findings get rows, filed BEFORE this PR opens, not
promised in prose. List them with one line each on why they are separate rather
than in scope here. File them to `Backlog` carrying `unreviewed`: promotion to
`Todo` is the owner's signal, and a row created directly in `Todo` is never
dispatched (GAM-382). -->

## Known gaps, disclosed

<!-- Delete if none, but think before you do. Anything untested, any residual
path left open by design, any assertion weaker than it looks. Disclosing a gap
costs a line; having a reviewer find it costs the review. -->

Linear-Issue: GAM-000
