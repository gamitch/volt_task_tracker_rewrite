---
name: shared-doc-merge
description: Resolve merge conflicts in append-only shared project documents — task ledgers, verification logs, decision records, dispute logs — without losing either side's entry. Use whenever a merge or rebase conflicts in docs/swarm/*.md, or in any file where several parallel workflows append at the end. Also use when a conflict shows two unrelated entries side by side rather than a genuine disagreement about the same text.
---

# Shared-doc merge

Several workflows run against this repo at once, and each appends to the same
handful of documents: `task-ledger.md`, `verification-log.md`,
`auto-mode-decisions.md`, `dispute-log.md`. Two branches appending near the end of
the same file conflict every time, and the conflict looks alarming while being
entirely mechanical.

This resolution happened roughly a dozen times in a single session here. It is
worth doing the same way each time, because the failure mode — quietly dropping
someone else's entry — is invisible in review.

## Recognising the case

**Look at what the two sides contain.** If they are two *different* entries — your
task's log section and another workflow's, or two different ledger rows — nobody
disagrees about anything. Git has flagged adjacency, not conflict.

If both sides genuinely edit *the same* entry, this is not that case; read both
and decide on the merits.

## Resolving

```bash
python3 .claude/skills/shared-doc-merge/scripts/resolve.py docs/swarm/verification-log.md
```

The script keeps **both sides, `main`'s first**, separated by a horizontal rule,
and refuses to write anything if it cannot parse the conflict cleanly.

Ordering `main`'s content first keeps the file roughly chronological by merge
order, which matches how everything else in these documents reads.

## Verify nothing was lost

Resolving by hand or by script, prove it afterwards. The check is cheap and it is
the only thing that catches a dropped entry:

```bash
git show origin/main:docs/swarm/task-ledger.md | grep -oE '^\| T[0-9]+ \|' | sort -u > /tmp/a
grep -oE '^\| T[0-9]+ \|' docs/swarm/task-ledger.md | sort -u > /tmp/b
comm -23 /tmp/a /tmp/b   # anything printed was lost from main
```

`resolve.py --verify-rows` does this for ledger files automatically.

Also confirm your own entry survived — a resolution that keeps `main` and drops
your work passes the check above and is still wrong.

## The ledger needs care the log does not

`verification-log.md` and `auto-mode-decisions.md` are pure append; keeping both
sides is always right.

**`task-ledger.md` is different.** Both branches may have edited *the same row* —
each marking its own task MERGED. Taking one side wholesale silently reverts the
other's status.

Resolve the ledger **per row**: for each conflicting row, take the side that
actually changed it. When both changed the same row, read both and merge the
cells by hand. `resolve.py` deliberately refuses to auto-resolve a conflict whose
two sides contain the same row ID, and tells you which.

## After resolving

Re-run the checks that the merge could have broken — `format:check` at minimum,
and the full suite if the merge touched anything under `src/`. A doc-only merge
still changes files CI inspects.

Commit with a message that names what collided, so the next person seeing the same
conflict recognises it as routine:

```
Merge origin/main — verification-log append collision with T704, both kept
```
