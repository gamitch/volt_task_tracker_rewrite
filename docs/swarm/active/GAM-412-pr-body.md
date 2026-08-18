Closes GAM-412

## What changed

Appended a sixth entry to `docs/swarm/2026-08-15-durable-multi-agent-execution-plan.md` §11 (Least confident decisions), naming "a control plane scoped to one application" as an undisclosed doubt: the run store, dispatch function, and §5.1's run record all assume one repository and one Linear team, and §5.1's field table has no `repo`/`project` column. No other section of the plan changed.

## What the issue got wrong

Nothing — the issue's citations were verified live against current `main` and held: §11 (line 833) had exactly five entries (line numbers shifted from the issue's cited 798/801/804/806/808 to 835/839/842/844/846 because GAM-410 inserted §5.2a after the issue's `283b444` measurement, but the content matched); §5.1's field table (lines 249-271) has no `repo`/`project` column; §2.5's out-of-scope list (lines 127-139) never mentions multi-application reuse. The proposed entry-6 text was used verbatim.

## Tier, stated and defended

**FAST** (item 26), matching the row's own `fast` label. Trigger: this is a doubts-register entry appended to an existing plan document — no write path, no schema/RLS/migration/auth logic, no changed signature, well under 20 lines, and the issue supplied the exact text. The losing STANDARD argument (raised in the issue itself): this edits the owner-approved canonical plan, the same reason GAM-410 was STANDARD. It loses here because GAM-410 added *invariants* that later designs must satisfy mechanically, whereas §11 is by construction a register of doubts — adding one constrains no implementation and changes no acceptance criterion. FAST tier has no worker and no packet; the orchestrator implemented directly and verified its own citations against the repository before editing (item 19c), which substitutes for item 19's premise gate since that gate governs packets reaching a worker and none was dispatched here.

## Verification

```
GATE RUN — f12ee8e on claude/gam-412-durable-exec-multi-app-doubt — tree clean

  1 tsc              exit 0  PASS
  2 vite build       exit 0  PASS
  3 format:check     exit 0  PASS
  4 eslint           exit 0  PASS       0 errors, 379 warnings
  5 vitest (full)    exit 0  PASS       96 files / 2466 tests  baseline 2466 (+0)
  6 vitest (scoped)      –  SKIP
                            no scope given and none derivable from the diff -- pass --scope <path> to run it

VERDICT: PASS — 5 of 6 gates. NOT all six: 1 skipped.
```

Baseline 2466 taken from GAM-410's last recorded run on this same plan document (PR #198). No mutation-replay table: this is a prose addition to a Markdown planning document with no code path, no test, and nothing that imports it — there is nothing a mutation could redden. The six repo-wide gates above are the applicable evidence.

## Scope: what this does and does not close

This records a doubt; it does not resolve one. It does not decide whether multi-application reuse is in scope, does not touch GAM-407's spike premise or design, and does not add a `repo`/`project` column to §5.1 or any code. The entry itself states its own overturning evidence (a second application entering the process) and its own bounded migration sketch, and neither is executed here.

## Follow-ups filed

None. The issue is explicit that this is a doubts-register entry, not a redesign, and names GAM-407 as the row it must not touch.

## Known gaps, disclosed

§2.5's out-of-scope list still does not state whether multi-application reuse is in or out of scope — the issue offered this as an optional companion clause and this PR skipped it to keep the change to the one required entry. Filing it is a matter for a future row if the owner wants it, not implied by this one.

Linear-Issue: GAM-412
