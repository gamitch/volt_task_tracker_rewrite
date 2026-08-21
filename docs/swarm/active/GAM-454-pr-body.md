Closes GAM-454

## What changed

Applies `docs/swarm/active/GAM-441-meetings-design-skill.patch` verbatim,
creating `.claude/skills/meetings-design/SKILL.md` (180 lines). The patch
content is untouched — it was authored and verified by the GAM-441 run
(`git apply --check` exit 0 there and again here); this PR only performs the
apply that run's permission layer refused, exactly as GAM-454 specifies.

## Tier

FAST, as filed: one file materialized from an already-verified patch, no
`src/**` change. Run owner-directed from the interactive session (plan
approved by George 2026-08-21); the dispatched path cannot write under
`.claude/**` by design, which is why this row exists.

## Verification

- `git apply --check` exit 0, then `git apply` clean; resulting file is
  byte-identical to the patch hunk (single-file create, no fuzz).
- Frontmatter is valid skill frontmatter (name + description); content
  read and confirmed to be the design contract the GAM-441 close-out
  described (palette rule, chip format, tap-to-cycle a11y contract, frozen
  type names, figure-reading instruction).
- Gates: no code change; not re-run for that reason — stated rather than
  implied.

## Second commit — follow the rows' cleanup instructions

The GAM-454 row directs deleting the two staging files once applied, and the
GAM-453 row directs removing the skill's "there are no reference figures
yet" warning block once the figures exist (they land in PR #225). A second
commit does exactly those two things: removes the 962-char warning block
(the only edit to the skill body; everything else is patch-verbatim) and
deletes `GAM-441-meetings-design-SKILL.md` +
`GAM-441-meetings-design-skill.patch` from `docs/swarm/active/` — git
history remains the provenance record, as the rows intend.

## Scope

Complete per both rows' instructions.

## Known gaps

Merge #225 (figures) before or with this PR so the skill's figure-reading
instruction never points at missing files.

Linear-Issue: GAM-454
