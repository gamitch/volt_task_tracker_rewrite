Closes GAM-481

**Draft, opened early on purpose.** `AGENTS.md` wall 3: the `ghs_` credential
that opens a PR expires 3600s after job start — decoded live on this run,
`iat 2026-08-22T03:18:56Z` / `exp 2026-08-22T04:18:56Z`. The deciding variable
is when `gh pr create` is *called*, so it is called at minute ~5 with the run
log as the only content, and the work is pushed into it.

## What changed

Placeholder — filled before the draft flag is cleared.

## Tier, stated and defended

**HEAVY.** Item 26's trigger *"an export another session builds against"*
applies literally: `.claude/skills/meetings-design/SKILL.md` is the shared
design contract that eleven parallel `meetings-redesign` tickets read before
writing code, and a wrong edit to it is caught by no test and no gate — it just
silently mis-instructs every sibling worker. The cost is measured rather than
imagined: GAM-448's premise gate returned REVISE with two BLOCKERs traceable to
this exact gap. FAST is unavailable on its own terms (no named mutation turns a
test red for a Markdown contract), and item 26's tiebreak — take the heavier of
two arguable tiers — points the same way.

**Declared process deviation, at claim time rather than after the fact.**
`.claude/skills/**` is on the constitution's Authority Boundaries forbidden list
for workers *and* checkers. So HEAVY runs here in its orchestrator-implements
form: `checker-premise` (read-only) gates the packet, the **orchestrator** makes
the edit because no worker may, `checker-reviewer` (read-only) grades it. The
issue anticipates this in its own text.

## Verification

Placeholder — the `gate-run` evidence block goes here verbatim.

Linear-Issue: GAM-481
