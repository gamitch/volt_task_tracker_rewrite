---
name: pr-body
description: Write a pull request body this repo's declaration gate accepts, and preserve it so a stranded run's work is never reconstructed. Use whenever you are about to open a pull request, write or edit a PR description, or paste a body for someone else's run. Also use before "tidying" an existing body — `Ignore GAM-nnn` lines are deliberate convention, not defects — and whenever a `Linear declaration` check has gone red.
---

# PR body

Line 1 of a PR body on this repo is **parsed**, and the `Linear declaration`
check that parses it is wired into branch protection. A body is not prose with
a header; it is one machine-read line followed by prose.

```bash
node .claude/skills/pr-body/scripts/check.mjs docs/swarm/active/GAM-nnn-pr-body.md
```

Exit 0 means the declaration gate will accept it. Exit 1 means it will not, and
names which of the five shapes you wrote.

## The one line that is parsed

`scripts/linear/declaration.mjs` owns this parse. **It is the only copy**, and
its header forbids a second one by name — `#131`'s branch/declaration mismatch
class and `#140`'s negation-read-as-declaration class are what a second copy
reproduces. The checker script above imports it rather than re-deriving it, and
so must anything else that needs this answer.

| Line 1 | Result |
|---|---|
| `Closes GAM-123` | **ok** |
| `Closes GAM-123 — and here is why` | **ok**, trailing prose is allowed |
| `closes gam-123` | `HALF_DECLARATION` — case-sensitive |
| `Fixes GAM-123` | `HALF_DECLARATION` — the verb must be `Closes` |
| `This closes GAM-123` | `HALF_DECLARATION` — nothing may precede it |
| `This PR does not close GAM-123` | `HALF_DECLARATION` — a negation is not a declaration |
| `Closes GAM-1 and GAM-2` | `AMBIGUOUS_DECLARATION` — one identifier only |
| `Closes GAM-000` | `PLACEHOLDER` — the template default is still there |
| `  Closes GAM-123` | `HALF_DECLARATION` — the anchor is at position 0, so indentation breaks it |
| blank, absent, or prose carrying no identifier | `NO_DECLARATION` |

Nothing may precede `Closes`, not even a space. That is deliberate:
under-closing costs one more push, mis-closing writes to the wrong Linear row.

The two rejection codes differ by whether line 1 carried an identifier at all —
`HALF_DECLARATION` means "you nearly wrote a declaration", `NO_DECLARATION`
means "there is nothing here to read". Both block the merge.

`Also-fixes:` may appear on any line and **never closes anything**. It exists
for existence-validation and human awareness only.

## Two conventions that are load-bearing and easy to destroy

**1. `Ignore GAM-nnn` is deliberate. Never remove it.**

A branch named `claude/gam-123-*` or a PR title containing `GAM-123` links that
issue **by itself**, and such a link closes the row on merge *with no magic word
present*. Omitting `Closes` therefore protects nothing. Only `skip`, `ignore`,
or a non-closing word like `ref` holds a linked PR back — `AGENTS.md` item 5.

So a body that says both `Closes GAM-200` and `Ignore GAM-123` is not
self-contradictory. It is a PR that closes one row while stopping a merge from
closing a second row it merely mentions. **Three bodies were "corrected" this
way once (#173, #174, #175) before anyone read item 5.** If a line looks
contradictory, read item 5 before editing it.

**2. Write the body to a file before you try to open the PR.**

```
docs/swarm/active/GAM-nnn-pr-body.md
```

A dispatched run frequently cannot open its own pull request (GAM-333). The run
that has already written its body loses nothing — a human opens it from the
artifact with one paste. The run that has not must have its body reconstructed
from a run log, if it left one.

Nine PRs in one session depended on this. **Eight had the artifact; one did
not**, because that run was killed at the timeout before writing it. Write the
file *before* attempting the API call, not after it fails.

## Publishing someone else's body

When you open a PR on behalf of a run that could not, **publish the artifact
verbatim.** You did not do the work, you did not run the gates, and you cannot
tell a sloppy sentence from a precise one about a measurement you never made.

If something in it looks wrong, say so to the human — do not silently improve
it. This is the specific failure mode item 5 above records.

## The shape

`.github/pull_request_template.md` carries the sections and the reason for each.
The short version, in order:

1. **`Closes GAM-nnn`** — line 1, nothing before it.
2. **What changed** — one or two sentences.
3. **What the issue got wrong** — premise gates falsify something in most rows
   they touch. Recording the correction is how the next reader avoids
   inheriting it.
4. **Tier, stated and defended** — item 26. Name it, give the trigger, say what
   the losing argument was. Declare a process deviation rather than relabelling
   the row to match what you actually did.
5. **Verification** — the `gate-run` evidence block pasted verbatim, plus the
   mutations table. A SKIPPED gate stays visible; "5 of 6" with a reason beats
   "all six" when one was skipped.
6. **Scope** — item 27. If any part of the surface is reached only through a
   fixture on the user's real path, this closes Partial, not Passed.
7. **Follow-ups filed** — item 20. Filed *before* the PR opens, to `Backlog`
   carrying `unreviewed`. A row created directly in `Todo` is never dispatched
   (GAM-382), and promotion is the owner's signal.
8. **Known gaps, disclosed.**
9. **`Linear-Issue: GAM-nnn`** trailer — the git-side record. No automation
   reads it; it is for the human reading `git log`.

Delete any section that does not apply. An empty heading is worse than none.

## Numbers

Every number in a body should be one you can point at. Paste the gate block
rather than retyping it, quote commit SHAs rather than run-log timestamps —
**three runs in one session wrote timestamps that disagreed with their own
commit times** — and do not describe a mutation you did not run.
