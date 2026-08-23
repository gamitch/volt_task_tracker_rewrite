Closes GAM-489

Ignore GAM-451
Ignore GAM-444
Ignore GAM-446
Ignore GAM-490

## What changed

Constitution item 26 is replaced wholesale with the owner-approved revision 4:
unconditional HEAVY triggers applied first, STANDARD as the default bounded
tier with a conditional checker and bounded reversible writes, FAST with
deterministic orchestrator evidence, process-level verification parallelism at
every tier, and worker ceilings (FAST 0, STANDARD 2, HEAVY 3 after a
premise-approved split). Four companion amendments update the Non-Negotiables,
the item 19 opening and 19b, the Definition of Ready, and the Definition of
Done. Live guidance is synchronized in the same commit — `AGENTS.md`,
`CODEX.md`, the `swarm-run` skill (tier routing), the `linear-task-writing`
template's tier checklist, the worker-implementer / checker-premise /
checker-reviewer role files, and KICKOFF-PROMPTS, SWARM-QUICKSTART, overview,
MACHINE-SETUP, RESUME-HERE, WORKFLOWS. The owner's 2026-08-23 authorization
and its approved scope are recorded in `docs/swarm/auto-mode-decisions.md`.

Historical records — run logs, dated lessons documents, the frozen ledger, and
banner-marked historical sections — are deliberately left as written: they
quote the item 26 in force at the time. GAM-451, GAM-444 and GAM-446 are named
above only as the amendment's calibration evidence; nothing here reopens them.

## Tier, stated and defended

FAST, and the row was born tiered (`tier/fast`, GAM-489). Docs-only governance
change: 15 files, +603/−161, zero production code — no migration, RLS, auth,
metric SQL, write path, external contract, or any other unconditional HEAVY
trigger. The orchestrator implemented directly under live owner direction; the
owner reviewed four drafted revisions and authorized the fourth. The losing
argument (STANDARD) rested on size alone, and file count is not a trigger.

Declared deviation from FAST's evidence conditions: no named mutation exists
for a governance document — there is no production behavior a mutation could
redden. Verification is the gate run below plus the revision-by-revision
fact-check recorded on GAM-489 (owner quote byte-checked against the prior
item 26; T305's payload quoted in its recorded fields; T189 matched to its
ledger row; T321/T323 split per the ledger; GAM-451's HEAVY entry
re-attributed to the GAM-444 frozen-contract trigger with sibling timing
confirmed from GAM-446's run log).

## Verification

```
GATE RUN — f1f77e2 on claude/article-26-heavy-workflow-cu8rq2 — tree clean

  1 tsc              exit 0  PASS
  2 vite build       exit 0  PASS
  3 format:check     exit 0  PASS
  4 eslint           exit 0  PASS       0 errors, 382 warnings
  5 vitest (full)    exit 0  PASS       114 files / 2768 tests  (no baseline given — regression not checked)
  6 vitest (scoped)      –  SKIP
                            no scope given and none derivable from the diff -- pass --scope <path> to run it

VERDICT: PASS — 5 of 6 gates. NOT all six: 1 skipped.
```

5 of 6: gate 6 is SKIPPED because the diff touches no `src/` file, so no
scoped run is derivable — the honest-SKIP case the amended item 26 itself
codifies. No test-count baseline was taken; the diff touches no test or source
file, so the count could not move by this change. No mutation was run, per the
declared deviation above.

## Scope: what this does and does not close

Governance documents only. No runtime behavior, schema, test, or user-visible
surface changes — item 27 has nothing to attach to. The narrow claim: the
constitution, its companion sections, and the live guidance documents now
state the owner-approved revision 4 process; nothing about the application
changed.

## Follow-ups filed

- GAM-490 (`Backlog`, `unreviewed` + `human`) — the Linear workspace label
  descriptions for `tier/standard` and `tier/heavy` still describe the retired
  item 26; label editing is a workspace-settings action only the owner can
  perform, so it cannot be in scope here.

## Known gaps, disclosed

- Historical documents intentionally still quote the old item 26 (see above);
  a reader must date-check citations against `auto-mode-decisions.md`
  "2026-08-23 — George authorizes the item 26 rewrite".
- The nine KICKOFF-PROMPTS dispatch blocks were left as written: they defer to
  "as constitution item 26 prescribes for the tier", which is self-updating;
  only their tie-break lines and the W4 whole-workflow tier claim were edited.

Linear-Issue: GAM-489
