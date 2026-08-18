Closes GAM-411

## Undeliverable half, first

Half of this fix could not be written by this dispatched run: `.claude/skills/pr-body/SKILL.md` rejected both `Edit` and `Write` on the permission layer, the same class of wall `AGENTS.md` documents for `.github/workflows/**`, while the identical edit to `AGENTS.md` succeeded moments earlier in the same run. The intended change is preserved as a dry-run-verified patch at `docs/swarm/active/GAM-411-pr-body-skill.patch` and handed off as **GAM-413** (`Backlog`, `unreviewed`) for an owner or a session with `.claude/**` write access to apply.

## What changed

`AGENTS.md` item 5 now says explicitly: a salvage row filed after a blocked packet needs its **own** branch (`claude/gam-<salvage-nnn>-*`), not the blocked row's branch with `Ignore GAM-nnn` bolted on. `Ignore` suppresses Linear's own linking; it does not satisfy the repository's own `Linear declaration` CI check, whose rule 3 (`scripts/linear-declaration-check.mjs:158-170`) is an unconditional branch/line-1 equality with no `Ignore` exemption — confirmed by reading the source directly, not taken on the issue's word.

## What the issue got wrong

Nothing measured — the premise held under re-verification. One thing was stale: the issue's "Unblocking PR #196 specifically" section was **already done** by a prior run before this one started. PR #196 is closed; its replacement #197 (branch `claude/gam-409-premise-gate-findings`, self-consistent under rule 3) is merged. This PR does not touch that; it only carries the documentation fix (the issue's recommended Option A) so the pattern does not recur.

## Tier, stated and defended

**FAST** under item 26 — no write path, no schema/RLS/migration/auth logic, no changed signature, prose-only (zero lines of production code). This matches the issue's own recommendation and its assigned `tier/fast` label; no re-tiering judgement was needed since it was not `tier/unreviewed`. Verification was not reduced: all applicable gates ran below.

## Verification

```
GATE RUN — 87bba09 on claude/gam-411-declaration-gate-ignore-exemption — tree clean

  1 tsc              exit 0  PASS
  2 vite build       exit 0  PASS
  3 format:check     exit 0  PASS
  4 eslint           exit 0  PASS       0 errors, 379 warnings
  5 vitest (full)    exit 0  PASS       96 files / 2466 tests  (no baseline given — regression not checked)
  6 vitest (scoped)      –  SKIP
                            no scope given and none derivable from the diff -- pass --scope <path> to run it

VERDICT: PASS — 5 of 6 gates. NOT all six: 1 skipped.
```

Gate 6 skipped defensibly — no `src/` files changed. No mutation table: this is a prose-only doc change with no code to mutate, matching the issue's own framing of Option A as "no code, no write path."

## Scope

Item 27 does not apply — no user-visible surface, documentation only.

## Follow-ups filed

- **GAM-413** (`Backlog`, `unreviewed`) — apply `docs/swarm/active/GAM-411-pr-body-skill.patch` to `.claude/skills/pr-body/SKILL.md`; this run's write access did not cover that path.

## Known gaps, disclosed

- The `pr-body` skill's own documentation is not yet updated (GAM-413, above) — only `AGENTS.md` carries the fix in this PR. Until GAM-413 lands, a future run reading the `pr-body` skill in isolation (without also reading `AGENTS.md` item 5) will not see this clarification.
- Option B (teaching rule 3 itself the `Ignore` exemption) was explicitly **not** taken, per the issue's own recommendation — it would be a STANDARD-tier change to a required check, and Option A makes it unnecessary.

Linear-Issue: GAM-411
