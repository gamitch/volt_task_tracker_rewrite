Closes GAM-418

Ignore GAM-407
Ignore GAM-414

## What changed

Three amendments to `docs/swarm/active/GAM-407-spike-report.md`, carrying GAM-414's live-project role measurement into the report that plan §11.1 decision 1 rests on. **No verdict changed. One limit narrowed.**

The report's §5 is explicitly binding and explicitly the checker's list, and its item 1 said hosted role attributes were **unmeasured** while forbidding any criterion-3 PASS from being quoted without that caveat. GAM-414 measured them on 2026-08-19. A binding "always attach this caveat" instruction naming a caveat the evidence has removed is worse than a stale note, because it will be obeyed.

## Why `Ignore GAM-414` is here and must stay

**GAM-414 carries `gate/human`**, whose label reads _"Requires the human owner. No machine may close this."_ A merge closes a declared or linked row automatically, so this PR must not close it — the measurement is delivered but marking the row Done is the owner's act. `Ignore GAM-407` is here for a different reason: that row is `Done` with PR #201 already linked, and item 28f records that a second linked PR can move an issue **backwards**. Neither line is tidy-able.

## The three amendments

| §              | Was                                                                                             | Now                                                                                                                       |
| -------------- | ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| §5 item 1      | "hosted role attributes **unmeasured** … no criterion-3 PASS may be quoted without this caveat" | The measurement table, the confirmation, and a **narrower** residual limit                                                |
| §1 criterion 3 | "The limit: the hosted project's `pg_roles` attributes are unmeasured"                          | The limit restated as the hosted `ops_executor` membership graph                                                          |
| §2 F2          | attribute framing, unremarked                                                                   | Records that hosted `postgres` measures `rolsuper = f` / `rolbypassrls = t`, so the attribute framing survives production |

**What the measurement found.** Hosted `service_role` **is** `BYPASSRLS` — the harness's assumption is confirmed on the attribute criterion 3's whole argument rests on, and hosted matches the harness rather than `run_t503_widen_rsvp_read.sh:35`'s plainly-created role (`rolbypassrls = f`). Nothing executor-shaped holds it: `anon` and `authenticated` are both `f`.

**What survives as a limit.** `ops_executor` does not exist on the hosted project — the harness creates it — so the membership graph for a real hosted `ops_executor` is unverifiable until Phase 2 creates one. §5 item 1 is **narrowed, not struck**, and its numbering is preserved because #201's body references this list by number.

**One rig/production divergence, recorded as reasoning rather than measurement**, under §5's own standard: hosted `service_role` is `rolinherit = t` while the harness creates it `noinherit`. The argument that this does not weaken the escalation negatives — inheritance governs privileges acquired through membership, while the negatives probe `SET ROLE` and RLS bypass — is not measured, and the report now says so.

## Tier, stated and defended

**FAST** under item 26: one markdown file, no code, no schema, no write path, nothing imports it. The losing STANDARD argument is that this edits a document a checker declared binding and that an architecture decision quotes — real, but it loses because the change _removes_ an overstated constraint and adds a measurement, rather than introducing anything a later design must satisfy. The measurement it carries was itself taken and independently written up on GAM-414 before this row existed.

## Verification

```
GATE RUN — f3e5f1a on claude/gam-418-spike-report-role-caveat — tree clean

  1 tsc              exit 0  PASS
  2 vite build       exit 0  PASS
  3 format:check     exit 0  PASS
  4 eslint           exit 0  PASS       0 errors, 379 warnings
  5 vitest (full)    exit 0  PASS       98 files / 2505 tests  (no baseline given — regression not checked)
  6 vitest (scoped)      –  SKIP        no scope derivable from the diff

VERDICT: PASS — 5 of 6 gates. NOT all six: 1 skipped.
```

**Five of six, and gate 6 is a genuine SKIP.** `gates.py` derives the scoped run from changed files under `src/`; this PR changes one file under `docs/swarm/active/`, so there is nothing to scope. No mutation table: there is no behaviour here to mutate — the change is prose, and the honest evidence is the diff plus the fact that the full suite is unchanged at 2505.

The diff is larger than the three edits suggest (+95/−57) because Prettier reflows an entire markdown table when any cell's width changes, and two of the three edits are inside tables. Content was checked after formatting: all eight `##` sections present, and the report's verdicts, mutation table and stop rule are untouched.

## Scope

Item 27 does not apply — no user-visible surface. The claim is narrow: **the report now states what was measured and what remains unmeasured.** It does not re-run the spike, re-establish any finding, or change any criterion's verdict.

## Known gaps, disclosed

- The `rolinherit` divergence is **assessed, not tested.** No assertion covers it; the report labels it reasoning.
- The hosted `ops_executor` membership question is not merely unmeasured but currently unmeasurable, and stays open by construction until Phase 2.
- GAM-414 remains **open on purpose.** Its measurement is complete; its closure is the owner's.

Linear-Issue: GAM-418
